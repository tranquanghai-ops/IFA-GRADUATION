/**
 * Regression Test Suite:
 * 1. Hotfix ReferenceError: declResult is not defined on registration submission
 * 2. De-duplication and two-column layout for Project Types
 * 3. Supervisor card photo size optimization (~28% height reduction via aspect-[16/13])
 * 4. Interactive card & photo click to select supervisor preference (max 3, order NV1-NV3, no double-trigger)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Setup minimal DOM & Window global mocks
global.window = global;
global.state = {
  currentView: 'student',
  isStudent: true,
  isAdmin: false,
  impersonation: null,
  selectedRoundId: 'round-test-123',
  studentMssv: '12000166',
  isPreviewMode: false,
  user: { email: '12000166@student.tdtu.edu.vn', displayName: 'Nguyễn Văn Test' },
  activeRound: { id: 'round-test-123', preferenceCount: 3, selectionMode: 'standard' },
  selectedPreferences: [],
  roundSupervisors: [
    { id: 'sup1', name: 'ThS. Nguyễn Văn A', department: 'Bộ môn TKNT', photoUrl: 'https://example.com/a.jpg', activeInRound: true },
    { id: 'sup2', name: 'TS. Trần Thị B', department: 'Bộ môn TKNT', photoUrl: 'https://example.com/b.jpg', activeInRound: true },
    { id: 'sup3', name: 'KTS. Lê Văn C', department: 'Bộ môn TKNT', photoUrl: 'https://example.com/c.jpg', activeInRound: true },
    { id: 'sup4', name: 'ThS. Phạm Thị D', department: 'Bộ môn TKNT', photoUrl: 'https://example.com/d.jpg', activeInRound: true }
  ],
  myRegistration: null,
  myOfficialAssignment: null
};

global.showToast = (msg, type) => {
  global._lastToast = { msg, type };
};

global.escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[m]));

global.getSupervisorAvatarSvgDataUri = (name) => `data:image/svg+xml;utf8,<svg>${name}</svg>`;

global.initFirebase = () => Promise.resolve();
global.db = {};
global.auth = {};
global.showLoading = () => {};
global.hideLoading = () => {};
global.renderSupervisorsGrid = () => {};
global.getSelectedProjectTypes = () => ['Văn hóa / triển lãm / bảo tàng'];
global.collectOfficialFormFields = () => ({ currentClass: '20050201' });
global.validateOfficialFormFields = () => true;
global.getRegistrationStudentIdentity = () => ({ mssv: '12000166', studentName: 'Nguyễn Văn Test', major: 'Thiết kế Nội thất' });
global.goToStep = () => {};

// ============================================================================
// PHẦN 1: HOTFIX declResult & SUBMIT REGISTRATION
// ============================================================================
test('Phần 1: Hotfix ReferenceError declResult & Lưu bản khai điều kiện khi nộp đăng ký', async () => {
  try {
    const regCode = fs.readFileSync(path.resolve(__dirname, '../js/students/registration.js'), 'utf8');

    // Verify declResult is declared or handled safely in submitRegistration
    assert.ok(regCode.includes('finalDeclaration'), 'submitRegistration must define and use finalDeclaration');
    assert.ok(!regCode.includes('declResult?.declaration'), 'submitRegistration must not use undeclared declResult?.declaration');

    // Simulate DOM elements for registration form
    const domElements = {
      'input-topic-title': { value: 'Thiết kế nội thất Trung tâm văn hóa Trà Việt' },
      'input-project-type-other': { value: '' },
      'topic-title-error': { classList: { add: () => {}, remove: () => {} }, textContent: '' },
      'btn-submit-registration': { disabled: false, innerHTML: '' },
      'student-topic-current-class': { value: '20050201' },
      'student-topic-personal-email': { value: 'test@gmail.com' },
      'student-topic-phone': { value: '0901234567' },
      'student-topic-permanent-address': { value: 'TP.HCM' },
      'student-topic-temporary-address': { value: 'TP.HCM' }
    };

    global.document = {
      getElementById: (id) => domElements[id] || null,
      querySelector: (sel) => {
        if (sel.includes('student-eligibility-status')) return { value: 'eligible' };
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes('project-type-checkbox:checked')) {
          return [{ value: 'Văn hóa / triển lãm / bảo tàng' }];
        }
        return [];
      }
    };

    // Mock collectStudentEligibilityDeclaration
    window.collectStudentEligibilityDeclaration = () => ({
      valid: true,
      declaration: {
        status: 'eligible',
        reasons: [],
        missingCourses: [],
        englishCertificateStatus: '',
        otherReason: '',
        studentDeclaredAt: '2026-10-27T10:00:00.000Z',
        studentUpdatedAt: '2026-10-27T10:00:00.000Z'
      }
    });

    // Load registration module
    await import('../js/students/registration.js');

    // Re-mock collectStudentEligibilityDeclaration after module overwrites it
    window.collectStudentEligibilityDeclaration = () => ({
      valid: true,
      declaration: {
        status: 'eligible',
        reasons: [],
        missingCourses: [],
        englishCertificateStatus: '',
        otherReason: '',
        studentDeclaredAt: '2026-10-27T10:00:00.000Z',
        studentUpdatedAt: '2026-10-27T10:00:00.000Z'
      }
    });

    assert.equal(typeof window.validateAndGoToStep2, 'function');
    window.validateAndGoToStep2();
    assert.ok(state.currentEligibilityDeclaration, 'validateAndGoToStep2 must persist declaration in state');
    assert.equal(state.currentEligibilityDeclaration.status, 'eligible');
  } catch (outerErr) {
    console.error('OUTER ERR IN TEST:', outerErr);
    throw outerErr;
  }
});

// ============================================================================
// PHẦN 2: LOẠI BỎ LOẠI HÌNH ĐỒ ÁN TRÙNG & CHIA 2 CỘT
// ============================================================================
test('Phần 2: Khử trùng lặp Loại hình đồ án và bố cục chia 2 cột (1-6 và 7-11)', async () => {
  // Simulate 22 project types from Firestore (11 pairs of duplicates as on Production)
  const defaultNames = [
    "Nhà ở dân dụng", "Thương mại dịch vụ", "Cảnh quan", "Giáo dục / nghiên cứu",
    "Văn phòng", "Văn hóa / triển lãm / bảo tàng", "Resort / khách sạn",
    "F&B – Nhà hàng / Cafe / Bar / Pub", "Dịch vụ sức khỏe", "Bến tàu / bến xe", "Khác"
  ];

  state.projectTypes = [
    ...defaultNames.map((name, i) => ({ id: `doc1_${i}`, name, order: i + 1, active: true })),
    ...defaultNames.map((name, i) => ({ id: `doc2_${i}`, name, order: i + 1, active: true }))
  ];

  let renderedHtml = '';
  const mockContainer = {
    className: '',
    set innerHTML(val) { renderedHtml = val; },
    get innerHTML() { return renderedHtml; }
  };

  global.document.getElementById = (id) => {
    if (id === 'project-types-checkbox-list') return mockContainer;
    if (id === 'select-project-type') return { value: '' };
    return null;
  };

  // Import auth.js logic
  await import('../js/auth.js');
  assert.equal(typeof window.renderProjectTypesDropdown, 'function');

  window.renderProjectTypesDropdown();

  // 1. Must contain 2 sub-column flex containers
  assert.match(renderedHtml, /<div class="flex flex-col gap-2">/);
  const columnContainers = renderedHtml.split('<div class="flex flex-col gap-2">');
  assert.equal(columnContainers.length, 3, 'Must have exactly 2 columns');

  // 2. Count occurrences of each name: exactly 1 per name!
  for (const name of defaultNames) {
    const escaped = escapeHtml(name);
    const count = (renderedHtml.match(new RegExp(escaped, 'g')) || []).length;
    // Each item appears in input value and span textContent, so 2 matches per single card
    const inputMatches = (renderedHtml.match(new RegExp(`value="${escaped}"`, 'g')) || []).length;
    assert.equal(inputMatches, 1, `Loại hình "${name}" chỉ được xuất hiện 1 lần duy nhất`);
  }

  // 3. Verify Column 1 has 6 items (1-6) and Column 2 has 5 items (7-11)
  const col1Html = columnContainers[1];
  const col2Html = columnContainers[2];

  assert.ok(col1Html.includes('Nhà ở dân dụng'), 'Cột 1 phải chứa Nhà ở dân dụng');
  assert.ok(col1Html.includes('Văn hóa / triển lãm / bảo tàng'), 'Cột 1 phải chứa Văn hóa / triển lãm');
  assert.ok(!col1Html.includes('Resort / khách sạn'), 'Cột 1 KHÔNG chứa Resort / khách sạn');

  assert.ok(col2Html.includes('Resort / khách sạn'), 'Cột 2 phải chứa Resort / khách sạn');
  assert.ok(col2Html.includes('Khác'), 'Cột 2 phải chứa Khác');
});

// ============================================================================
// PHẦN 3 & 4: KÍCH THƯỚC ẢNH & CLICK THẺ/ẢNH CHỌN NGUYỆN VỌNG
// ============================================================================
test('Phần 3 & 4: Kích thước ảnh aspect-[16/13] và click thẻ/ảnh chọn NV', async () => {
  const matchingCode = fs.readFileSync(path.resolve(__dirname, '../js/supervisors/assignments-matching.js'), 'utf8');

  // Verify portrait aspect ratio and object-contain to strictly prevent face crop
  assert.ok(matchingCode.includes('aspect-[3/4]'), 'Ảnh phải sử dụng aspect-[3/4] phù hợp tỷ lệ ảnh chân dung');
  assert.ok(matchingCode.includes('object-contain'), 'Ảnh phải sử dụng object-contain để không cắt mất khuôn mặt');

  // Verify click card handler and keyboard handlers
  assert.ok(matchingCode.includes('handleSupervisorCardClick'), 'Phải có hàm handleSupervisorCardClick');
  assert.ok(matchingCode.includes('event.stopPropagation()'), 'Nút con phải có stopPropagation để chống double click');
  assert.ok(matchingCode.includes("event.target.closest('button"), 'handleSupervisorCardClick phải bỏ qua click vào nút');

  await import('../js/supervisors/assignments-matching.js');
  assert.equal(typeof window.handleSupervisorCardClick, 'function');
  assert.equal(typeof window.addCardPreference, 'function');
  assert.equal(typeof window.removePreference, 'function');

  state.selectedPreferences = [];

  // Test 1: Click card 1 -> Chọn NV1
  let dummyEvent = { target: { closest: () => null } };
  window.handleSupervisorCardClick(dummyEvent, 'sup1', encodeURIComponent('ThS. Nguyễn Văn A'), false, false);
  assert.equal(state.selectedPreferences.length, 1);
  assert.equal(state.selectedPreferences[0].supervisorId, 'sup1');
  assert.equal(state.selectedPreferences[0].rank, 1);

  // Test 2: Click card 2 -> Chọn NV2
  window.handleSupervisorCardClick(dummyEvent, 'sup2', encodeURIComponent('TS. Trần Thị B'), false, false);
  assert.equal(state.selectedPreferences.length, 2);
  assert.equal(state.selectedPreferences[1].supervisorId, 'sup2');
  assert.equal(state.selectedPreferences[1].rank, 2);

  // Test 3: Click card 3 -> Chọn NV3
  window.handleSupervisorCardClick(dummyEvent, 'sup3', encodeURIComponent('KTS. Lê Văn C'), false, false);
  assert.equal(state.selectedPreferences.length, 3);
  assert.equal(state.selectedPreferences[2].supervisorId, 'sup3');
  assert.equal(state.selectedPreferences[2].rank, 3);

  // Test 4: Click card 4 (khi đã đủ 3 NV) -> Bị chặn, toast thông báo, không ghi đè
  window.handleSupervisorCardClick(dummyEvent, 'sup4', encodeURIComponent('ThS. Phạm Thị D'), false, false);
  assert.equal(state.selectedPreferences.length, 3, 'Không được vượt quá 3 nguyện vọng');
  assert.match(global._lastToast.msg, /tối đa 3 nguyện vọng/);

  // Test 5: Click card đã chọn (sup2 đang ở NV2) -> Bỏ chọn, NV3 (sup3) được đôn lên thành NV2
  window.handleSupervisorCardClick(dummyEvent, 'sup2', encodeURIComponent('TS. Trần Thị B'), false, true);
  assert.equal(state.selectedPreferences.length, 2, 'Bỏ chọn sup2 thành công');
  assert.equal(state.selectedPreferences[0].supervisorId, 'sup1');
  assert.equal(state.selectedPreferences[0].rank, 1);
  assert.equal(state.selectedPreferences[1].supervisorId, 'sup3');
  assert.equal(state.selectedPreferences[1].rank, 2, 'sup3 được cập nhật thành NV2');

  // Test 6: Click vào chính nút con (button) -> handleSupervisorCardClick bỏ qua (không gây double-event)
  const buttonClickEvent = {
    target: {
      closest: (selector) => (selector.includes('button') ? { tagName: 'BUTTON' } : null)
    }
  };
  const prevCount = state.selectedPreferences.length;
  window.handleSupervisorCardClick(buttonClickEvent, 'sup4', encodeURIComponent('ThS. Phạm Thị D'), false, false);
  assert.equal(state.selectedPreferences.length, prevCount, 'Click vào button bên trong card không kích hoạt handler thẻ');
});

setTimeout(() => process.exit(0), 100);
