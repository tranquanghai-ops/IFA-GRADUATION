/**
 * Tests for IFA-GRADUATION — Student Participation Source, Audit Log, and New Student Journey Visibility
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = global;
global.state = global.state || {};

test('Phần 1: Chuẩn hóa nhãn Nguồn tham gia của sinh viên', async () => {
  const { getStudentJoinMethodBadge } = await import('../js/students/student-eligibility-admin.js');
  
  // 1. Link join
  const linkBadge = getStudentJoinMethodBadge({ joinMethod: 'link', source: 'self_join_link' });
  assert.match(linkBadge, /Qua link tham gia/);
  assert.match(linkBadge, /bg-blue-50/);

  // 2. Excel import
  const excelBadge = getStudentJoinMethodBadge({ joinMethod: 'excel', source: 'excel_import' });
  assert.match(excelBadge, /Từ file nhập/);
  assert.match(excelBadge, /bg-slate-100/);

  // 3. Admin manual add
  const manualBadge = getStudentJoinMethodBadge({ joinMethod: 'manual', source: 'manual_supplement' });
  assert.match(manualBadge, /Admin thêm/);
  assert.match(manualBadge, /bg-purple-50/);

  // 4. Undetermined / missing source: MUST NOT default to Excel
  const unknownBadge = getStudentJoinMethodBadge({});
  assert.match(unknownBadge, /Chưa xác định/);
  assert.doesNotMatch(unknownBadge, /Từ file nhập/);

  const emptyBadge = getStudentJoinMethodBadge({ joinMethod: '' });
  assert.match(emptyBadge, /Chưa xác định/);
  assert.doesNotMatch(emptyBadge, /Từ file nhập/);
});

test('Phần 2: Tiêu đề bảng Admin đổi thành "Danh sách sinh viên tham gia đợt tốt nghiệp"', () => {
  const tabStudentsHtml = fs.readFileSync(path.join(__dirname, '../views/admin/tab-students.html'), 'utf8');
  assert.match(tabStudentsHtml, /Danh sách sinh viên tham gia đợt tốt nghiệp:/);
  assert.doesNotMatch(tabStudentsHtml, /Danh sách Sinh viên đủ điều kiện hiện có:/);

  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(indexHtml, /Danh sách sinh viên tham gia đợt tốt nghiệp:/);
  assert.doesNotMatch(indexHtml, /Danh sách Sinh viên đủ điều kiện hiện có:/);
});

test('Phần 3: Thao tác cuối cùng & Audit Log cho sự kiện Tham gia đợt tốt nghiệp', async () => {
  global.state = { userActivitiesMap: new Map() };
  const { getUserActivityInfo } = await import('../js/tracking/user-activity-tracker.js');

  // Case A: User logged in at 10:20, joined round at 10:21 -> latest is "Tham gia đợt tốt nghiệp"
  const loginAt = new Date('2026-10-27T10:20:00.000Z');
  const joinedAt = new Date('2026-10-27T10:21:00.000Z');
  
  state.userActivitiesMap.set('12000166@student.tdtu.edu.vn', {
    email: '12000166@student.tdtu.edu.vn',
    lastLoginAt: loginAt,
    lastActiveAt: loginAt,
    lastAction: 'Đăng nhập hệ thống',
    lastActionAt: loginAt
  });

  const infoA = getUserActivityInfo('12000166', {
    eligibleRecord: { studentId: '12000166', joinedAt, joinMethod: 'link' }
  });
  assert.equal(infoA.lastAction, 'Tham gia đợt tốt nghiệp');
  assert.equal(infoA.lastActionDetails, 'Qua link tham gia');

  // Case B: User joined at 10:21, then logged in again at 11:00 -> latest is "Đăng nhập hệ thống"
  const laterLoginAt = new Date('2026-10-27T11:00:00.000Z');
  state.userActivitiesMap.set('12200238@student.tdtu.edu.vn', {
    email: '12200238@student.tdtu.edu.vn',
    lastLoginAt: laterLoginAt,
    lastActiveAt: laterLoginAt,
    lastAction: 'Đăng nhập hệ thống',
    lastActionAt: laterLoginAt
  });

  const infoB = getUserActivityInfo('12200238', {
    eligibleRecord: { studentId: '12200238', joinedAt, joinMethod: 'link' }
  });
  assert.equal(infoB.lastAction, 'Đăng nhập hệ thống');

  // Verify rounds-self-join.js writes 'Tham gia đợt tốt nghiệp'
  const selfJoinJs = fs.readFileSync(path.join(__dirname, '../js/rounds/rounds-self-join.js'), 'utf8');
  assert.match(selfJoinJs, /action:\s*['"]Tham gia đợt tốt nghiệp['"]/);
  assert.match(selfJoinJs, /trackUserActivity\(['"]Tham gia đợt tốt nghiệp['"]/);

  // Verify firestore.rules whitelist includes 'Tham gia đợt tốt nghiệp'
  const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  assert.match(rules, /'Tham gia đợt tốt nghiệp'/);
});

test('Phần 4: Ẩn mốc kế hoạch, tài liệu thuyết minh và lộ trình với sinh viên mới (4 Cases)', async () => {
  // Setup minimal DOM elements
  const mockClassList = () => {
    const classes = new Set();
    return {
      add: (...cls) => cls.forEach(c => classes.add(c)),
      remove: (...cls) => cls.forEach(c => classes.delete(c)),
      toggle: (c, force) => force ? classes.add(c) : classes.delete(c),
      contains: (c) => classes.has(c)
    };
  };

  const elements = {
    'student-journey-card': { classList: mockClassList() },
    'hero-milestones-count-wrap': { classList: mockClassList() },
    'hero-thesis-guide-link': { classList: mockClassList() },
    'hero-supervisor-info-card': { classList: mockClassList() },
    'student-final-score-card': { classList: mockClassList() },
    'registration-cta-card': { classList: mockClassList() },
    'registration-cta-title': { classList: mockClassList(), textContent: '' },
    'registration-cta-description': { classList: mockClassList(), textContent: '' },
    'registration-flow-container': { classList: mockClassList() },
    'review-in-progress-card': { classList: mockClassList(), querySelector: () => ({ textContent: '' }) },
    'already-registered-card': { classList: mockClassList() },
    'student-hero-card': { classList: mockClassList() }
  };

  global.document = {
    getElementById: (id) => elements[id] || null
  };

  global.state = {
    currentView: 'student',
    isStudent: true,
    isAdmin: false,
    impersonation: null,
    myRegistration: null,
    myOfficialAssignment: null
  };

  const { applyStudentProgressVisibility } = await import('../js/students/registration.js');

  // TRƯỜNG HỢP 1: Sinh viên vừa tham gia đợt qua link, chưa đăng ký đề tài, chưa có GVHD
  state.myRegistration = null;
  state.myOfficialAssignment = null;
  applyStudentProgressVisibility();

  assert.ok(elements['student-journey-card'].classList.contains('hidden'), 'Case 1: Lộ trình phải ẩn');
  assert.ok(elements['hero-milestones-count-wrap'].classList.contains('hidden'), 'Case 1: 0 mốc kế hoạch phải ẩn');
  assert.ok(elements['hero-thesis-guide-link'].classList.contains('hidden'), 'Case 1: Hướng dẫn Thuyết minh phải ẩn');
  assert.ok(elements['hero-supervisor-info-card'].classList.contains('hidden'), 'Case 1: Khung GVHD chưa phân công phải ẩn');
  assert.ok(!elements['registration-cta-card'].classList.contains('hidden'), 'Case 1: Nút Bắt đầu đăng ký phải hiện');
  assert.match(elements['registration-cta-description'].textContent, /Bạn chưa hoàn tất đăng ký đề tài/);

  // TRƯỜNG HỢP 2: Sinh viên bắt đầu đăng ký nhưng lưu nháp (draft)
  state.myRegistration = { status: 'draft', topicTitle: 'Nháp đề tài' };
  state.myOfficialAssignment = null;
  applyStudentProgressVisibility();

  assert.ok(elements['student-journey-card'].classList.contains('hidden'), 'Case 2: Lộ trình phải ẩn');
  assert.ok(elements['hero-milestones-count-wrap'].classList.contains('hidden'), 'Case 2: Mốc kế hoạch phải ẩn');
  assert.ok(elements['hero-thesis-guide-link'].classList.contains('hidden'), 'Case 2: Hướng dẫn Thuyết minh phải ẩn');
  assert.ok(elements['registration-cta-card'].classList.contains('hidden'), 'Case 2: CTA ẩn');
  assert.ok(!elements['registration-flow-container'].classList.contains('hidden'), 'Case 2: Form đăng ký phải hiện');

  // TRƯỜNG HỢP 3: Sinh viên đã gửi đăng ký, đang chờ phân công GVHD
  state.myRegistration = { status: 'submitted', topicTitle: 'Thiết kế Nội thất Resort Côn Đảo' };
  state.myOfficialAssignment = null;
  applyStudentProgressVisibility();

  assert.ok(elements['student-journey-card'].classList.contains('hidden'), 'Case 3: Lộ trình phải ẩn');
  assert.ok(elements['hero-milestones-count-wrap'].classList.contains('hidden'), 'Case 3: Mốc kế hoạch phải ẩn');
  assert.ok(elements['hero-thesis-guide-link'].classList.contains('hidden'), 'Case 3: Hướng dẫn Thuyết minh phải ẩn');
  assert.ok(elements['hero-supervisor-info-card'].classList.contains('hidden'), 'Case 3: Khung GVHD chưa phân công phải ẩn');
  assert.ok(!elements['review-in-progress-card'].classList.contains('hidden'), 'Case 3: Thông báo chờ phân công phải hiện');
  assert.ok(!elements['already-registered-card'].classList.contains('hidden'), 'Case 3: Thông tin đề tài đã nộp phải hiện');

  // TRƯỜNG HỢP 4: Sinh viên đã có đề tài và có phân công GVHD chính thức
  state.myRegistration = {
    status: 'submitted',
    topicTitle: 'Thiết kế Nội thất Resort Côn Đảo',
    assignmentStatus: 'published',
    officialSupervisors: [{ supervisorId: 'sup1', supervisorName: 'ThS. Nguyễn Văn A', role: 'primary' }]
  };
  state.myOfficialAssignment = {
    assignmentStatus: 'published',
    supervisors: [{ supervisorId: 'sup1', supervisorName: 'ThS. Nguyễn Văn A', role: 'primary' }]
  };
  applyStudentProgressVisibility();

  assert.ok(!elements['student-journey-card'].classList.contains('hidden'), 'Case 4: Lộ trình phải hiển thị');
  assert.ok(!elements['hero-milestones-count-wrap'].classList.contains('hidden'), 'Case 4: Mốc kế hoạch phải hiển thị');
  assert.ok(!elements['hero-thesis-guide-link'].classList.contains('hidden'), 'Case 4: Hướng dẫn Thuyết minh phải hiển thị');
  assert.ok(!elements['hero-supervisor-info-card'].classList.contains('hidden'), 'Case 4: Thông tin GVHD phải hiển thị');

  // CHẾ ĐỘ OWNER ĐÓNG VAI: Owner đóng vai Case 1 -> Không được lộ quyền admin, phải áp dụng đúng điều kiện SV mới
  state.isAdmin = true;
  state.impersonation = { target: { type: 'student', mssv: '12000166' } };
  state.myRegistration = null;
  state.myOfficialAssignment = null;
  applyStudentProgressVisibility();

  assert.ok(elements['student-journey-card'].classList.contains('hidden'), 'Owner đóng vai Case 1: Lộ trình phải ẩn');
  assert.ok(elements['hero-milestones-count-wrap'].classList.contains('hidden'), 'Owner đóng vai Case 1: Mốc kế hoạch phải ẩn');
  assert.ok(elements['hero-thesis-guide-link'].classList.contains('hidden'), 'Owner đóng vai Case 1: Hướng dẫn Thuyết minh phải ẩn');
  assert.ok(!elements['registration-cta-card'].classList.contains('hidden'), 'Owner đóng vai Case 1: Nút đăng ký phải hiện');
});
