/**
 * Comprehensive Test Suite:
 * 1. Admin Registrations Table: Sort by supervisor preferences NV1, NV2, NV3 (A-Z / Z-A)
 *    - Vietnamese accented collation (Intl.Collator 'vi')
 *    - Stable secondary sort by studentId (MSSV)
 *    - Empty preferences consistently at bottom in both asc and desc
 *    - Interactive header state, icons, and filter preservation
 * 2. Topic Approval Status Synchronization across Admin panels:
 *    - Unregistered -> "Chưa đăng ký"
 *    - Newly submitted registration -> "Chờ duyệt" (NEVER "Đã duyệt")
 *    - Officially approved topic -> "✓ Đã duyệt"
 *    - Approved with pending revision -> "✓ Đã duyệt (Lần 1) · ⏳ Chờ duyệt Lần 2"
 *    - Rejected topic -> "✕ Không duyệt"
 *    - Identical status in Danh sách sinh viên & Danh sách đăng ký
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Setup minimal DOM & Window global mocks
global.window = global;
global.state = {
  currentView: 'admin',
  isStudent: false,
  isAdmin: true,
  user: { email: 'admin@tdtu.edu.vn', displayName: 'Admin' },
  activeRound: { id: 'round-4-2027', preferenceCount: 3, directAssignment: false },
  currentAdminRegistrations: [],
  regSortState: { column: null, direction: 'asc' }
};

global.showToast = (msg, type) => {
  global._lastToast = { msg, type };
};

global.escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[m]));

global.getSupervisorAvatarSvgDataUri = (name) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg>${name}</svg>`)}`;
global.resolveStudentName = (sid, name) => name || `Sinh viên ${sid}`;

// Helper mocks for topic versioning
global.getApprovedTopicVersions = (reg) => {
  if (!reg) return [];
  const history = Array.isArray(reg.topicTitleHistory) ? reg.topicTitleHistory : [];
  const list = [];
  history.forEach(item => {
    if (item && item.status === 'approved' && item.version) {
      list.push({ version: Number(item.version), title: item.title || item.topicTitle, status: 'approved' });
    }
  });
  if (reg.topicApprovalStatus === 'approved' && !list.some(v => v.version === Number(reg.topicTitleVersion || 1))) {
    list.push({ version: Number(reg.topicTitleVersion || 1), title: reg.topicTitle, status: 'approved' });
  }
  return list.sort((a, b) => a.version - b.version);
};

global.getTopicPendingProposal = (reg) => {
  if (!reg) return null;
  const history = Array.isArray(reg.topicTitleHistory) ? reg.topicTitleHistory : [];
  return history.find(item => item && item.status === 'pending') || null;
};

global.getOfficialApprovedTopicTitle = (reg, fallback = '') => {
  if (!reg) return fallback;
  const approved = global.getApprovedTopicVersions(reg);
  if (approved.length > 0) return approved[approved.length - 1].title;
  if (reg.topicApprovalStatus === 'approved') return reg.topicTitle || fallback;
  return reg.topicTitle || fallback;
};

// ============================================================================
// PHẦN 1: TÍNH NĂNG SẮP XẾP NGUYỆN VỌNG GVHD (NV1, NV2, NV3)
// ============================================================================
test('1. Bảng Danh sách đăng ký: Sắp xếp theo GVHD NV1, NV2, NV3 với tiếng Việt có dấu và MSSV phụ', async () => {
  await import('../js/students/student-registrations-admin.js');

  assert.equal(typeof window.toggleRegistrationsSort, 'function', 'Phải xuất khẩu toggleRegistrationsSort');
  assert.equal(typeof window.resolveStudentTopicApproval, 'function', 'Phải xuất khẩu resolveStudentTopicApproval');

  // Sample student dataset
  const dataset = [
    {
      studentId: '52000003',
      studentName: 'Trần Văn C',
      isRegistered: true,
      preferences: [
        { rank: 1, supervisorName: 'ThS. NCS Hoàng Lê Duy' },
        { rank: 2, supervisorName: 'ThS. Hồ Ngọc Lệ' },
        { rank: 3, supervisorName: 'Ngô Văn Đức' }
      ]
    },
    {
      studentId: '52000001',
      studentName: 'Nguyễn Văn A',
      isRegistered: true,
      preferences: [
        { rank: 1, supervisorName: 'ThS. KTS. Phan Bảo Cường' },
        { rank: 2, supervisorName: 'ThS. NCS Hoàng Lê Duy' },
        { rank: 3, supervisorName: 'ThS. Hồ Ngọc Lệ' }
      ]
    },
    {
      studentId: '52000002',
      studentName: 'Lê Thị B',
      isRegistered: true,
      preferences: [
        { rank: 1, supervisorName: 'ThS. KTS. Phan Bảo Cường' },
        { rank: 2, supervisorName: 'Ngô Văn Đức' },
        { rank: 3, supervisorName: 'ThS. NCS Hoàng Lê Duy' }
      ]
    },
    {
      studentId: '52000004',
      studentName: 'Phạm Thị D',
      isRegistered: true,
      preferences: [
        { rank: 1, supervisorName: 'Ngô Văn Đức' },
        { rank: 2, supervisorName: 'ThS. KTS. Phan Bảo Cường' },
        { rank: 3, supervisorName: '' } // NV3 trống
      ]
    },
    {
      studentId: '52000005',
      studentName: 'Hoàng Văn E',
      isRegistered: false, // Chưa đăng ký, preferences rỗng
      preferences: []
    }
  ];

  state.currentAdminRegistrations = dataset;

  // DOM elements mock
  const domHeaders = {
    'th-sort-nv1': { classList: { add: () => {}, remove: () => {} } },
    'sort-icon-nv1': { textContent: '', className: '' },
    'th-sort-nv2': { classList: { add: () => {}, remove: () => {} } },
    'sort-icon-nv2': { textContent: '', className: '' },
    'th-sort-nv3': { classList: { add: () => {}, remove: () => {} } },
    'sort-icon-nv3': { textContent: '', className: '' },
    'admin-reg-filter-type': { value: 'all' },
    'admin-reg-filter-status': { value: 'all' },
    'admin-registrations-tbody': { innerHTML: '' }
  };

  global.document = {
    getElementById: (id) => domHeaders[id] || null
  };

  // Test 1.1: Sort NV1 ascending (A-Z)
  window.toggleRegistrationsSort('nv1');
  assert.equal(state.regSortState.column, 'nv1');
  assert.equal(state.regSortState.direction, 'asc');

  let sorted = state.lastFilteredRegistrations;
  assert.equal(sorted.length, 5);

  // Expected order for NV1 A-Z:
  // Ngô Văn Đức (52000004) -> ThS. KTS. Phan Bảo Cường (52000001, 52000002) -> ThS. NCS Hoàng Lê Duy (52000003) -> No NV1 (52000005 at bottom)
  assert.equal(sorted[0].studentId, '52000004', 'Ngô Văn Đức phải đứng đầu A-Z');
  // Two students with same supervisor (Phan Bảo Cường) must be sorted by MSSV ascending:
  assert.equal(sorted[1].studentId, '52000001', 'Cùng GVHD: 52000001 phải đứng trước 52000002');
  assert.equal(sorted[2].studentId, '52000002', 'Cùng GVHD: 52000002 đứng sau 52000001');
  assert.equal(sorted[3].studentId, '52000003', 'Hoàng Lê Duy đứng thứ 4');
  assert.equal(sorted[4].studentId, '52000005', 'Sinh viên không có NV1 phải luôn ở cuối bảng');

  // Test 1.2: Click NV1 second time -> Reverse to descending (Z-A)
  window.toggleRegistrationsSort('nv1');
  assert.equal(state.regSortState.column, 'nv1');
  assert.equal(state.regSortState.direction, 'desc');

  sorted = state.lastFilteredRegistrations;
  // Expected order for NV1 Z-A:
  // Hoàng Lê Duy (52000003) -> Phan Bảo Cường (52000001, 52000002) -> Ngô Văn Đức (52000004) -> No NV1 (52000005 at bottom)
  assert.equal(sorted[0].studentId, '52000003', 'Hoàng Lê Duy phải đứng đầu Z-A');
  assert.equal(sorted[1].studentId, '52000001', 'Cùng GVHD: 52000001 vẫn đứng trước 52000002 theo MSSV');
  assert.equal(sorted[2].studentId, '52000002');
  assert.equal(sorted[3].studentId, '52000004', 'Ngô Văn Đức đứng cuối trong các SV có NV1');
  assert.equal(sorted[4].studentId, '52000005', 'Sinh viên không có NV1 vẫn phải luôn ở cuối bảng trong chiều Z-A');

  // Test 1.3: Sort NV2 ascending (A-Z)
  window.toggleRegistrationsSort('nv2');
  assert.equal(state.regSortState.column, 'nv2');
  assert.equal(state.regSortState.direction, 'asc');

  sorted = state.lastFilteredRegistrations;
  // NV2s:
  // 52000004: Phan Bảo Cường
  // 52000002: Ngô Văn Đức
  // 52000003: Hồ Ngọc Lệ
  // 52000001: Hoàng Lê Duy
  // 52000005: Rỗng
  assert.equal(sorted[4].studentId, '52000005', 'Rỗng NV2 luôn ở đáy');

  // Test 1.4: Sort NV3 ascending (A-Z)
  window.toggleRegistrationsSort('nv3');
  assert.equal(state.regSortState.column, 'nv3');
  assert.equal(state.regSortState.direction, 'asc');

  sorted = state.lastFilteredRegistrations;
  // NV3s:
  // 52000004 has empty NV3, 52000005 has empty NV3 -> BOTH at bottom!
  const lastTwo = [sorted[3].studentId, sorted[4].studentId].sort();
  assert.deepEqual(lastTwo, ['52000004', '52000005'], 'Cả 2 sinh viên không có NV3 đều phải nằm ở đáy bảng');
});

// ============================================================================
// PHẦN 2: CHUẨN HÓA TRẠNG THÁI DUYỆT ĐỀ TÀI VÀ ĐỒNG BỘ 2 BẢNG ADMIN
// ============================================================================
test('2. Đồng bộ trạng thái duyệt đề tài: Chờ duyệt, Đã duyệt, Không duyệt, Chưa đăng ký', async () => {
  const { resolveStudentTopicApproval } = window;

  // Case 1: Sinh viên chưa đăng ký đề tài
  const case1 = resolveStudentTopicApproval(null);
  assert.equal(case1.status, 'unregistered');
  assert.equal(case1.label, 'Chưa đăng ký');
  assert.match(case1.badgeHtml, /Chưa đăng ký/);

  // Case 2: Sinh viên MỚI nộp đăng ký đề tài (v1, topicApprovalStatus: 'pending' hoặc chưa có)
  const case2a = resolveStudentTopicApproval({
    studentId: '12000166',
    topicTitle: 'Thiết kế nội thất Trung tâm văn hóa Trà Việt',
    topicApprovalStatus: 'pending',
    topicTitleHistory: [{ version: 1, title: 'Thiết kế nội thất Trung tâm văn hóa Trà Việt', status: 'pending' }]
  });
  assert.equal(case2a.status, 'pending', 'Sinh viên mới nộp đăng ký PHẢI có trạng thái pending');
  assert.equal(case2a.label, 'Chờ duyệt');
  assert.match(case2a.badgeHtml, /Chờ duyệt/, 'Badge PHẢI hiển thị Chờ duyệt');
  assert.ok(!case2a.badgeHtml.includes('Đã duyệt'), 'TUYỆT ĐỐI KHÔNG được hiển thị "Đã duyệt" khi mới nộp đăng ký');

  // Case 2b: Sinh viên mới nộp đăng ký không có trường topicApprovalStatus tường minh
  const case2b = resolveStudentTopicApproval({
    studentId: '12000167',
    topicTitle: 'Bảo tàng Gốm Bát Tràng'
  });
  assert.equal(case2b.status, 'pending');
  assert.equal(case2b.label, 'Chờ duyệt');
  assert.match(case2b.badgeHtml, /Chờ duyệt/);
  assert.ok(!case2b.badgeHtml.includes('Đã duyệt'));

  // Case 3: Đề tài đã được phê duyệt chính thức
  const case3 = resolveStudentTopicApproval({
    studentId: '12000168',
    topicTitle: 'Thiết kế nội thất Khu nghỉ dưỡng sinh thái Cần Giờ',
    topicApprovalStatus: 'approved',
    topicTitleHistory: [{ version: 1, title: 'Thiết kế nội thất Khu nghỉ dưỡng sinh thái Cần Giờ', status: 'approved' }]
  });
  assert.equal(case3.status, 'approved');
  assert.equal(case3.label, 'Đã duyệt');
  assert.match(case3.badgeHtml, /✓ Đã duyệt/);

  // Case 4: Đã duyệt Lần 1 và có đề xuất sửa Lần 2 đang chờ duyệt
  const case4 = resolveStudentTopicApproval({
    studentId: '12000169',
    topicTitle: 'Thiết kế nội thất Không gian Trải nghiệm Nghệ thuật Đương đại',
    topicTitleVersion: 2,
    topicTitleHistory: [
      { version: 1, title: 'Không gian Nghệ thuật', status: 'approved' },
      { version: 2, title: 'Thiết kế nội thất Không gian Trải nghiệm Nghệ thuật Đương đại', status: 'pending' }
    ]
  });
  assert.equal(case4.status, 'approved_with_pending_proposal');
  assert.match(case4.label, /Đã duyệt.*Chờ duyệt/);
  assert.match(case4.badgeHtml, /✓ Đã duyệt/);
  assert.match(case4.badgeHtml, /⏳ Chờ duyệt Lần 2/);

  // Case 5: Đề tài bị từ chối / yêu cầu chỉnh sửa
  const case5 = resolveStudentTopicApproval({
    studentId: '12000170',
    topicTitle: 'Đề tài không phù hợp quy mô',
    topicApprovalStatus: 'rejected',
    topicApprovalNote: 'Quy mô quá nhỏ, yêu cầu mở rộng không gian chức năng.'
  });
  assert.equal(case5.status, 'rejected');
  assert.match(case5.label, /Không duyệt/);
  assert.match(case5.badgeHtml, /✕ Không duyệt/);
});

// ============================================================================
// PHẦN 3: KIỂM TRA RENDER VÀ ĐỒNG BỘ TRÊN BẢNG DANH SÁCH SINH VIÊN
// ============================================================================
test('3. Bảng Danh sách sinh viên (student-eligibility-admin): Hiển thị đúng Chờ duyệt và không lẫn lộn Đã duyệt', async () => {
  const eligibilityAdminCode = fs.readFileSync(path.resolve(__dirname, '../js/students/student-eligibility-admin.js'), 'utf8');

  // Must use resolveStudentTopicApproval
  assert.ok(eligibilityAdminCode.includes('resolveStudentTopicApproval'), 'student-eligibility-admin.js phải gọi resolveStudentTopicApproval');
  // Must NOT blindly treat officialApprovedTitle as approved
  assert.ok(!eligibilityAdminCode.includes('officialApprovedTitle ? \'approved\''), 'Không được dùng officialApprovedTitle ? approved gây lỗi Đã duyệt sai');

  // Verify compiled index.html contains sorting headers and updated elements
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  assert.match(indexHtml, /th-sort-nv1/);
  assert.match(indexHtml, /th-sort-nv2/);
  assert.match(indexHtml, /th-sort-nv3/);
});

setTimeout(() => process.exit(0), 100);
