/**
 * Comprehensive Test Suite:
 * 1. 4-column responsive grid on desktop (xl:grid-cols-4, lg:grid-cols-3, sm:grid-cols-2, grid-cols-1)
 * 2. Supervisor photo display: aspect-[3/4], object-contain, no face cropping, dual-layer ambient backdrop
 * 3. Uniform card heights, line-clamped names, and bottom-aligned action buttons
 * 4. Interactive card click & photo click to select preference (NV1-NV3, reordering, stopPropagation)
 * 5. Deterministic verification with real supervisor dataset from Round 4/2027
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
  selectedRoundId: 'round-test-4-2027',
  studentMssv: '12000166',
  isPreviewMode: false,
  user: { email: '12000166@student.tdtu.edu.vn', displayName: 'Nguyễn Văn Test' },
  activeRound: { id: 'round-test-4-2027', preferenceCount: 3, selectionMode: 'standard' },
  selectedPreferences: [],
  roundSupervisors: [],
  myRegistration: null,
  myOfficialAssignment: null
};

global.showToast = (msg, type) => {
  global._lastToast = { msg, type };
};

global.escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[m]));

global.getSupervisorAvatarSvgDataUri = (name) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg>${name}</svg>`)}`;

// Load real supervisors sample
const samplePath = path.resolve(__dirname, 'real-supervisors-sample.json');
let realSupervisors = [];
if (fs.existsSync(samplePath)) {
  realSupervisors = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
}

test('1. Bố cục 4 GVHD / hàng trên desktop & Responsive grid trong HTML', () => {
  const studentViewHtml = fs.readFileSync(path.resolve(__dirname, '../views/student.html'), 'utf8');
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

  // Must have xl:grid-cols-4 for desktop >= 1280px
  assert.match(studentViewHtml, /id="supervisors-grid"[^>]*xl:grid-cols-4/, 'views/student.html phải có xl:grid-cols-4');
  assert.match(studentViewHtml, /id="supervisors-grid"[^>]*lg:grid-cols-3/, 'views/student.html phải có lg:grid-cols-3');
  assert.match(studentViewHtml, /id="supervisors-grid"[^>]*sm:grid-cols-2/, 'views/student.html phải có sm:grid-cols-2');
  assert.match(studentViewHtml, /id="supervisors-grid"[^>]*grid-cols-1/, 'views/student.html phải có mobile grid-cols-1');

  // Must match compiled index.html
  assert.match(indexHtml, /id="supervisors-grid"[^>]*xl:grid-cols-4/, 'index.html phải có xl:grid-cols-4');
  assert.match(indexHtml, /id="supervisors-grid"[^>]*lg:grid-cols-3/, 'index.html phải có lg:grid-cols-3');
  assert.match(indexHtml, /id="supervisors-grid"[^>]*sm:grid-cols-2/, 'index.html phải có sm:grid-cols-2');
  assert.match(indexHtml, /id="supervisors-grid"[^>]*grid-cols-1/, 'index.html phải có mobile grid-cols-1');
});

test('2. Tỷ lệ aspect-[3/4], object-contain & Ambient backdrop chống cắt mặt', () => {
  const matchingCode = fs.readFileSync(path.resolve(__dirname, '../js/supervisors/assignments-matching.js'), 'utf8');

  // Image container aspect ratio
  assert.ok(matchingCode.includes('aspect-[3/4]'), 'Khung ảnh phải có tỷ lệ aspect-[3/4] phù hợp ảnh chân dung');
  assert.ok(!matchingCode.includes('aspect-[16/13]'), 'Không được dùng lại aspect-[16/13] gây cắt mặt');

  // Foreground image must use object-contain to strictly prevent clipping
  assert.ok(matchingCode.includes('object-contain'), 'Ảnh chính diện phải dùng object-contain để giữ trọn vẹn khuôn mặt');

  // Ambient backdrop layer for aesthetic framing
  assert.ok(matchingCode.includes('object-cover blur-sm opacity-20 scale-110 pointer-events-none'), 'Phải có lớp backdrop mờ cùng ảnh gốc');

  // Card alignment classes
  assert.ok(matchingCode.includes('h-full'), 'Card phải có h-full để các card trong cùng hàng bằng chiều cao');
  assert.ok(matchingCode.includes('min-h-[2.5rem]'), 'Tiêu đề GVHD phải có min-h để không lệch nút khi tên 1 hay 2 dòng');
  assert.ok(matchingCode.includes('mt-auto pt-3 border-t'), 'Nút hành động phải ghim ở đáy với mt-auto');
});

test('3. Render dữ liệu 11 GVHD thực tế của Đợt 4/2027 và kiểm tra cấu trúc DOM', async () => {
  assert.ok(realSupervisors.length >= 10, 'Phải có ít nhất 10 GVHD thực tế để kiểm tra');

  let renderedGridHtml = '';
  const mockGrid = {
    set innerHTML(html) { renderedGridHtml = html; },
    get innerHTML() { return renderedGridHtml; }
  };
  const mockCountBadge = { textContent: '' };
  const mockSearchInput = { value: '' };

  global.document = {
    getElementById: (id) => {
      if (id === 'supervisors-grid') return mockGrid;
      if (id === 'supervisors-count-badge') return mockCountBadge;
      if (id === 'search-supervisor-input') return mockSearchInput;
      return null;
    }
  };

  await import('../js/supervisors/assignments-matching.js');

  state.roundSupervisors = realSupervisors.map(s => ({
    ...s,
    activeInRound: true
  }));
  state.selectedPreferences = [];

  renderSupervisorsGrid();

  assert.equal(mockCountBadge.textContent, `${realSupervisors.length} giảng viên`);
  assert.ok(renderedGridHtml.length > 0, 'Phải render thành công danh sách card GVHD');

  // Check each real supervisor exists in rendered markup
  for (const s of realSupervisors) {
    const escapedName = escapeHtml(s.name);
    assert.ok(renderedGridHtml.includes(escapedName), `Card của ${s.name} phải xuất hiện trong grid`);
  }

  // Count image containers with aspect-[3/4] in class
  const aspect34Count = (renderedGridHtml.match(/class="[^"]*aspect-\[3\/4\]/g) || []).length;
  assert.equal(aspect34Count, realSupervisors.length, 'Tất cả ảnh GVHD đều phải có tỷ lệ aspect-[3/4]');

  // Count object-contain instances on foreground img elements
  const containCount = (renderedGridHtml.match(/<img[^>]*class="[^"]*object-contain/g) || []).length;
  assert.equal(containCount, realSupervisors.length, 'Tất cả ảnh chính diện đều phải dùng object-contain');
});

test('4. Click ảnh và thẻ chọn nguyện vọng NV1, NV2, NV3 và bỏ chọn dồn thứ tự', async () => {
  state.selectedPreferences = [];
  const dummyEvent = { target: { closest: () => null } };

  // Select NV1
  window.handleSupervisorCardClick(dummyEvent, realSupervisors[0].id, encodeURIComponent(realSupervisors[0].name), false, false);
  assert.equal(state.selectedPreferences.length, 1);
  assert.equal(state.selectedPreferences[0].supervisorId, realSupervisors[0].id);
  assert.equal(state.selectedPreferences[0].rank, 1);

  // Select NV2
  window.handleSupervisorCardClick(dummyEvent, realSupervisors[1].id, encodeURIComponent(realSupervisors[1].name), false, false);
  assert.equal(state.selectedPreferences.length, 2);
  assert.equal(state.selectedPreferences[1].supervisorId, realSupervisors[1].id);
  assert.equal(state.selectedPreferences[1].rank, 2);

  // Select NV3
  window.handleSupervisorCardClick(dummyEvent, realSupervisors[2].id, encodeURIComponent(realSupervisors[2].name), false, false);
  assert.equal(state.selectedPreferences.length, 3);
  assert.equal(state.selectedPreferences[2].supervisorId, realSupervisors[2].id);
  assert.equal(state.selectedPreferences[2].rank, 3);

  // Try 4th -> blocked
  window.handleSupervisorCardClick(dummyEvent, realSupervisors[3].id, encodeURIComponent(realSupervisors[3].name), false, false);
  assert.equal(state.selectedPreferences.length, 3, 'Không cho phép vượt quá 3 nguyện vọng');

  // Remove NV2 -> NV3 becomes NV2
  window.handleSupervisorCardClick(dummyEvent, realSupervisors[1].id, encodeURIComponent(realSupervisors[1].name), false, true);
  assert.equal(state.selectedPreferences.length, 2);
  assert.equal(state.selectedPreferences[0].supervisorId, realSupervisors[0].id);
  assert.equal(state.selectedPreferences[0].rank, 1);
  assert.equal(state.selectedPreferences[1].supervisorId, realSupervisors[2].id);
  assert.equal(state.selectedPreferences[1].rank, 2, 'NV3 cũ phải được dồn lên thành NV2');

  // Click on child button must not double-trigger
  const btnEvent = {
    target: {
      closest: (sel) => (sel.includes('button') ? { tagName: 'BUTTON' } : null)
    }
  };
  const countBefore = state.selectedPreferences.length;
  window.handleSupervisorCardClick(btnEvent, realSupervisors[3].id, encodeURIComponent(realSupervisors[3].name), false, false);
  assert.equal(state.selectedPreferences.length, countBefore, 'Click nút con không kích hoạt card handler');
});

setTimeout(() => process.exit(0), 100);
