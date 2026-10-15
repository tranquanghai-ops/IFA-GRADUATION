const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('js/drive/drive-provisioning-folders.js exports normalizeRoundDriveFolderNames and attaches to window', () => {
  const code = read('js/drive/drive-provisioning-folders.js');
  assert.match(code, /export function normalizeRoundDriveFolderNames/);
  assert.match(code, /window\.normalizeRoundDriveFolderNames = normalizeRoundDriveFolderNames/);
  assert.match(code, /export async function provisionRoundDriveFolders/);
  assert.match(code, /window\.provisionRoundDriveFolders = provisionRoundDriveFolders/);

  // Runtime verification in VM context
  const context = { window: {}, console, Set, Array, String };
  const fnMatch = code.match(/function normalizeRoundDriveFolderNames\([\s\S]*?\n\}/);
  assert.ok(fnMatch, 'normalizeRoundDriveFolderNames function found');
  vm.runInNewContext(fnMatch[0], context);

  const res = context.normalizeRoundDriveFolderNames(['Thư mục 1', '  thư mục 1  ', 'Thư mục 2', 'Thư mục 3']);
  assert.equal(res.length, 3);
  assert.equal(res[0], 'Thư mục 1');
  assert.equal(res[1], 'Thư mục 2');
  assert.equal(res[2], 'Thư mục 3');
});

test('js/rounds/rounds-modal-timeline.js exports and bridges updateRoundModalBadges and getRoundWeekDraftEvents', () => {
  const code = read('js/rounds/rounds-modal-timeline.js');
  assert.match(code, /export function updateRoundModalBadges/);
  assert.match(code, /window\.updateRoundModalBadges = updateRoundModalBadges/);
  assert.match(code, /export function updateRoundModalConfigSummary/);
  assert.match(code, /window\.updateRoundModalConfigSummary = updateRoundModalConfigSummary/);
  assert.match(code, /export function getRoundWeekDraftEvents/);
  assert.match(code, /window\.getRoundWeekDraftEvents = getRoundWeekDraftEvents/);

  // Runtime verification of updateRoundModalBadges in VM
  const domElements = {
    'round-tab-eligible-count': { textContent: '' },
    'round-eligible-count-badge': { textContent: '' },
    'round-tab-sup-count': { textContent: '' },
    'round-sup-count-badge': { textContent: '' },
    'round-summary-eligible-status': { textContent: '', className: '' },
    'round-summary-sup-status': { textContent: '', className: '' }
  };
  const context = {
    state: {
      roundModalEligibleStudents: [{ studentId: '52100001' }, { studentId: '52100002' }],
      roundModalSupervisors: new Map([['sup1', { id: 'sup1' }]]),
      roundWeekEventsDraft: { 1: [{ id: 'e1', title: 'Nộp thuyết minh' }] }
    },
    document: {
      getElementById: (id) => domElements[id] || null
    },
    window: {},
    console,
    Array
  };

  const badgeFn = code.match(/function updateRoundModalBadges\(\)[\s\S]*?\n\}/);
  const summaryFn = code.match(/function updateRoundModalConfigSummary\(\)[\s\S]*?\n\}/);
  const draftFn = code.match(/function getRoundWeekDraftEvents\([\s\S]*?\n\}/);

  vm.runInNewContext(badgeFn[0] + '\n' + summaryFn[0] + '\n' + draftFn[0], context);

  context.updateRoundModalBadges();
  assert.equal(domElements['round-tab-eligible-count'].textContent, 2);
  assert.equal(domElements['round-eligible-count-badge'].textContent, '2 SV');
  assert.equal(domElements['round-tab-sup-count'].textContent, 1);
  assert.equal(domElements['round-sup-count-badge'].textContent, '1 GVHD');

  const drafts = context.getRoundWeekDraftEvents(1);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].title, 'Nộp thuyết minh');
});

test('js/students/student-eligibility-modal.js exports renderRoundModalEligibleTable and attaches to window', () => {
  const code = read('js/students/student-eligibility-modal.js');
  assert.match(code, /export function renderRoundModalEligibleTable/);
  assert.match(code, /window\.renderRoundModalEligibleTable = renderRoundModalEligibleTable/);

  // Runtime verification in VM
  let tbodyHtml = '';
  const context = {
    state: {
      roundModalEligibleStudents: [
        { studentId: '521H0012', name: 'Trần Thị B', major: 'Thiết kế đồ họa' }
      ]
    },
    document: {
      getElementById: (id) => id === 'round-eligible-students-tbody' ? { set innerHTML(val) { tbodyHtml = val; } } : null
    },
    window: {},
    console,
    String
  };

  const renderFn = code.match(/function renderRoundModalEligibleTable\(\)[\s\S]*?\n\}/);
  vm.runInNewContext(renderFn[0], context);

  context.renderRoundModalEligibleTable();
  assert.match(tbodyHtml, /521H0012/);
  assert.match(tbodyHtml, /Trần Thị B/);
});

test('js/rounds/rounds-modal-form.js bridges all required functions and editRoundModal opens modal-round safely', async () => {
  const code = read('js/rounds/rounds-modal-form.js');

  // Verify bridges are present at top
  assert.match(code, /const normalizeRoundDriveFolderNames\s*=/);
  assert.match(code, /const renderRoundModalEligibleTable\s*=/);
  assert.match(code, /const updateRoundModalBadges\s*=/);
  assert.match(code, /const updateRoundModalConfigSummary\s*=/);
  assert.match(code, /const provisionRoundDriveFolders\s*=/);
  assert.match(code, /const getRoundWeekDraftEvents\s*=/);
  assert.match(code, /const getRoundWeekEventRange\s*=/);
  assert.match(code, /const updateRoundDriveFolderPreview\s*=/);
  assert.match(code, /const toggleRoundOpenImmediately\s*=/);
  assert.match(code, /const switchRoundModalTab\s*=/);

  // Verify editRoundModal has try-catch error boundary
  assert.match(code, /window\.editRoundModal = async function\([\s\S]*?try\s*\{/);
  assert.match(code, /catch\s*\(err\)\s*\{[\s\S]*?showToast/);

  // Simulate editRoundModal in VM
  const domElements = {
    'modal-round': {
      classList: {
        classes: new Set(['hidden']),
        remove(cls) { this.classes.delete(cls); },
        add(cls) { this.classes.add(cls); },
        contains(cls) { return this.classes.has(cls); }
      }
    },
    'round-form-id': { value: '' },
    'round-form-title': { value: '' },
    'round-form-year': { value: '' },
    'round-form-name': { value: '' },
    'round-form-status': { value: '' },
    'round-form-pref-count': { value: '' },
    'round-form-selection-mode': { value: '' },
    'round-form-allow-edit': { checked: false },
    'round-form-allow-topic-edit': { checked: false },
    'round-form-allow-pref-edit': { checked: false },
    'round-allow-pre-eligibility': { checked: false },
    'round-form-show-email-after-publish': { checked: false },
    'round-form-show-phone-after-publish': { checked: false },
    'round-drive-folder-url': { value: '', dataset: {} },
    'round-drive-subfolder-names': { value: '' },
    'round-form-open-immediately': { checked: false },
    'round-form-start-date': { value: '' },
    'round-form-duration-weeks': { value: '' },
    'modal-round-title': { textContent: '' }
  };

  const context = {
    window: {},
    document: {
      getElementById: (id) => domElements[id] || { value: '', textContent: '', classList: { add() {}, remove() {}, contains() { return false; } }, dataset: {} },
      querySelector: () => ({ checked: false }),
      querySelectorAll: () => []
    },
    state: {
      rounds: [
        {
          id: 'round-12-2026',
          title: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP – ĐỢT 12/2026',
          academicYear: '2025-2026',
          shortCode: 'dot-12-2026',
          status: 'published',
          durationWeeks: 12,
          driveSubfolderNames: ['01_ThuyetMinh', '02_BanVe', '03_Poster'],
          timelineWeeksConfig: []
        }
      ],
      roundModalEligibleStudents: [],
      roundModalSupervisors: new Map(),
      roundWeekEventsDraft: {},
      supervisorsMaster: []
    },
    showToast: (msg, type) => {
      if (type === 'error') throw new Error('Unexpected error toast: ' + msg);
    },
    escapeHtml: (s) => String(s),
    getDocs: async () => ({ docs: [] }),
    collection: () => ({}),
    db: {},
    console,
    Set,
    Array,
    String,
    Number,
    Boolean,
    Date,
    parseInt
  };

  // Run the sanitized script (strip ESM imports)
  const codeWithoutImports = code.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
  vm.runInNewContext(codeWithoutImports, context);

  assert.equal(typeof context.window.editRoundModal, 'function');
  await context.window.editRoundModal('round-12-2026');

  // Verify modal was opened
  assert.equal(domElements['modal-round'].classList.contains('hidden'), false);
  assert.equal(domElements['round-form-id'].value, 'round-12-2026');
  assert.equal(domElements['round-form-title'].value, 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP – ĐỢT 12/2026');
  assert.equal(domElements['round-drive-subfolder-names'].value, '01_ThuyetMinh\n02_BanVe\n03_Poster');
});

test('RBAC checks confirm both Business Admin and Owner can access round management', () => {
  const adminMgmtSource = read('js/admin-management.js');
  const authSource = read('js/auth.js');
  const cardsSource = read('js/rounds/rounds-cards.js');

  // Verify ROOT_OWNER_EMAIL constant includes tranquanghai@tdtu.edu.vn
  assert.match(adminMgmtSource, /tranquanghai@tdtu\.edu\.vn/);
  // Verify auth checks owner email
  assert.match(authSource, /tranquanghai@tdtu\.edu\.vn/);
  // Verify rounds cards provide editRoundModal button for rounds in admin view
  assert.match(cardsSource, /editRoundModal\('\$\{r\.id\}'\)/);
  // Verify openRoundWeekEditor delegates to editRoundModal
  const previewSource = read('js/rounds/rounds-timeline-preview.js');
  assert.match(previewSource, /await window\.editRoundModal\(roundId/);
});
