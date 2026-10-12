const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Mock DOM environment for drive-rules-naming.js
function setupMockDom() {
  const elements = new Map();
  const radios = new Map([
    ['sub_filename_mode:exact', { name: 'sub_filename_mode', value: 'exact', checked: true }],
    ['sub_open_mode:immediate', { name: 'sub_open_mode', value: 'immediate', checked: false }],
    ['sub_open_mode:custom', { name: 'sub_open_mode', value: 'custom', checked: true }],
    ['sub_open_mode:activity_start', { name: 'sub_open_mode', value: 'activity_start', checked: false }],
    ['sub_deadline_mode:custom', { name: 'sub_deadline_mode', value: 'custom', checked: true }],
    ['sub_deadline_mode:activity_end', { name: 'sub_deadline_mode', value: 'activity_end', checked: false }]
  ]);

  function setRadio(name, val) {
    for (const [k, r] of radios.entries()) {
      if (r.name === name) r.checked = (r.value === val);
    }
  }

  function getOrCreate(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: '',
        checked: false,
        classList: {
          contains: () => false,
          add: () => {},
          remove: () => {},
          toggle: () => {}
        }
      });
    }
    return elements.get(id);
  }

  global.window = global.window || {};
  global.document = {
    getElementById: id => getOrCreate(id),
    querySelector: sel => {
      for (const [k, r] of radios.entries()) {
        if (sel.includes(r.name) && sel.includes(`value="${r.value}"`)) return r;
        if (sel.includes(r.name) && sel.includes(':checked') && r.checked) return r;
      }
      return null;
    }
  };
  return {
    get: id => getOrCreate(id),
    getOrCreate,
    setRadio
  };
}

test('Milestone Time Separation - Scenario 1: Council with earlier submission deadline succeeds without bogus errors', async () => {
  const dom = setupMockDom();
  await import('../js/drive/submission-deadline-date.js');
  await import('../js/drive/drive-rules-naming.js');

  // Council: 16/10/2026 13:00 to 17:00
  dom.get('activity-form-start-date').value = '16/10/2026';
  dom.get('activity-form-start-time').value = '13:00';
  dom.get('activity-form-end-date').value = '16/10/2026';
  dom.get('activity-form-end-time').value = '17:00';

  // Submission: 10/10/2026 08:00 to 15/10/2026 23:59
  dom.get('sub-open-date').value = '10/10/2026';
  dom.get('sub-open-time').value = '08:00';
  dom.get('sub-deadline-date').value = '15/10/2026';
  dom.get('sub-deadline-time').value = '23:59';
  dom.get('sub-ext-pdf').checked = true;

  // Reading the submission form must NOT throw "Giờ bắt đầu nhận bài phải trước hạn chót nhận bài"
  assert.doesNotThrow(() => {
    const config = window.readActivitySubmissionForm();
    assert.equal(config.enabled, true);
    assert.equal(config.openAt, '2026-10-10T01:00:00.000Z'); // 08:00 GMT+7
    assert.equal(config.deadlineAt, '2026-10-15T16:59:00.000Z'); // 23:59 GMT+7
  });
});

test('Milestone Time Separation - Scenario 2: Submission start >= deadline throws meaningful error', async () => {
  const dom = setupMockDom();
  await import('../js/drive/drive-rules-naming.js');

  // Open is later than deadline
  dom.get('sub-open-date').value = '16/10/2026';
  dom.get('sub-open-time').value = '08:00';
  dom.get('sub-deadline-date').value = '15/10/2026';
  dom.get('sub-deadline-time').value = '23:59';

  assert.throws(
    () => window.readActivitySubmissionForm(),
    /Thời gian bắt đầu nhận bài phải trước hạn chót nhận bài/
  );

  // Open is exactly equal to deadline
  dom.get('sub-open-date').value = '15/10/2026';
  dom.get('sub-open-time').value = '10:00';
  dom.get('sub-deadline-date').value = '15/10/2026';
  dom.get('sub-deadline-time').value = '10:00';

  assert.throws(
    () => window.readActivitySubmissionForm(),
    /Thời gian bắt đầu nhận bài phải trước hạn chót nhận bài/
  );
});

test('Milestone Time Separation - Scenario 3: Submission opening left empty allows immediate submission', async () => {
  const dom = setupMockDom();
  await import('../js/drive/drive-rules-naming.js');
  const { validateActivity } = require('../functions/validation.js');

  // Immediate submission mode: open immediately from now
  dom.setRadio('sub_open_mode', 'immediate');
  dom.get('sub-open-date').value = '';
  dom.get('sub-open-time').value = '';
  dom.get('sub-deadline-date').value = '20/10/2026';
  dom.get('sub-deadline-time').value = '23:59';

  const cfg = window.readActivitySubmissionForm();
  assert.equal(cfg.openMode, 'immediate');
  assert.equal(cfg.openAt, null);
  assert.ok(cfg.deadlineAt);

  const activity = {
    id: 'act-council',
    submissionEnabled: true,
    startAt: '2026-11-01T06:00:00.000Z', // Future council
    endAt: '2026-11-01T10:00:00.000Z',
    submissionConfig: cfg
  };

  const rules = window.getEffectiveSubmissionRules('student_123', activity, {});
  assert.equal(rules.isNotStarted, false); // Not blocked by future council!
  assert.equal(rules.canSubmit, true);

  // Server-side validation does not throw "Chưa đến thời gian nhận hồ sơ"
  assert.doesNotThrow(() => validateActivity(activity, 0));
});

test('Milestone Time Separation - Scenario 4: Student submission window enforcement before council', async () => {
  setupMockDom();
  await import('../js/drive/drive-rules-naming.js');
  const { validateActivity } = require('../functions/validation.js');

  const councilActivity = {
    id: 'act-defense',
    submissionEnabled: true,
    startAt: '2099-10-16T06:00:00.000Z', // Council in far future
    endAt: '2099-10-16T10:00:00.000Z',
    submissionConfig: {
      openAt: '2000-10-10T01:00:00.000Z', // Open in past
      deadlineAt: '2099-10-15T16:59:00.000Z', // Closes before council!
      allowLateSubmission: false,
      maxAttempts: 3
    }
  };

  // Currently between open and deadline -> allowed
  const currentRules = window.getEffectiveSubmissionRules('student1', councilActivity, {});
  assert.equal(currentRules.isNotStarted, false);
  assert.equal(currentRules.isPastDeadline, false);
  assert.equal(currentRules.canSubmit, true);
  assert.doesNotThrow(() => validateActivity(councilActivity, 0));

  // If deadline has passed before council
  councilActivity.submissionConfig.deadlineAt = '2000-10-15T16:59:00.000Z';
  const expiredRules = window.getEffectiveSubmissionRules('student1', councilActivity, {});
  assert.equal(expiredRules.isPastDeadline, true);
  assert.equal(expiredRules.canSubmit, false);
  assert.throws(() => validateActivity(councilActivity, 0), /Đã quá hạn nộp hồ sơ/);
});

test('Milestone Time Separation - Scenario 5: UI Modal template exposes separate Khu vực 1 and Khu vực 2', () => {
  const rootDir = path.resolve(__dirname, '..');
  const modalHtml = fs.readFileSync(path.join(rootDir, 'templates/modals/rounds/modal-activity.html'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  [modalHtml, indexHtml].forEach((html, i) => {
    const srcName = i === 0 ? 'modal-activity.html' : 'index.html';
    // Khu vực 1 checks
    assert.match(html, /Khu vực 1: Thời gian diễn ra hoạt động/, `${srcName} missing Khu vực 1 title`);
    assert.match(html, /Bắt đầu hoạt động/, `${srcName} missing Bắt đầu hoạt động`);
    assert.match(html, /Kết thúc hoạt động/, `${srcName} missing Kết thúc hoạt động`);
    assert.match(html, /id="activity-form-start-date"/, `${srcName} missing activity-form-start-date`);
    assert.match(html, /id="activity-form-end-date"/, `${srcName} missing activity-form-end-date`);

    // Khu vực 2 checks
    assert.match(html, /Khu vực 2: Thời gian tiếp nhận bài nộp/, `${srcName} missing Khu vực 2 title`);
    assert.match(html, /Thời gian nhận bài độc lập với thời gian diễn ra hoạt động/, `${srcName} missing independent description`);
    assert.match(html, /Bắt đầu nhận bài/, `${srcName} missing Bắt đầu nhận bài`);
    assert.match(html, /Hạn chót nhận bài/, `${srcName} missing Hạn chót nhận bài`);
    assert.match(html, /id="sub-open-date"/, `${srcName} missing sub-open-date`);
    assert.match(html, /id="sub-open-time"/, `${srcName} missing sub-open-time`);
    assert.match(html, /id="sub-deadline-date"/, `${srcName} missing sub-deadline-date`);
    assert.match(html, /id="sub-deadline-time"/, `${srcName} missing sub-deadline-time`);
    assert.match(html, /id="sub-allow-late"/, `${srcName} missing sub-allow-late`);
  });
});

test('Milestone Time Separation - Scenario 6: Helper date picker and clearing functions operate correctly', async () => {
  const dom = setupMockDom();
  await import('../js/drive/drive-rules-naming.js');

  assert.equal(typeof window.syncActivitySubmissionPickerToDateInput, 'function');
  assert.equal(typeof window.openActivitySubmissionDatePicker, 'function');
  assert.equal(typeof window.clearActivitySubmissionDateTime, 'function');

  // Test sync
  window.syncActivitySubmissionPickerToDateInput('open', '2026-10-10');
  assert.equal(dom.get('sub-open-date').value, '10/10/2026');
  assert.equal(dom.get('sub-open-time').value, '08:00');

  window.syncActivitySubmissionPickerToDateInput('deadline', '2026-10-15');
  assert.equal(dom.get('sub-deadline-date').value, '15/10/2026');
  assert.equal(dom.get('sub-deadline-time').value, '23:59');

  // Test clear
  window.clearActivitySubmissionDateTime('open');
  assert.equal(dom.get('sub-open-date').value, '');
  assert.equal(dom.get('sub-open-time').value, '');

  window.clearActivitySubmissionDateTime('deadline');
  assert.equal(dom.get('sub-deadline-date').value, '');
  assert.equal(dom.get('sub-deadline-time').value, '');
});

test('Milestone Time Separation - Scenario 7: Populate and reset preserve full fidelity', async () => {
  const dom = setupMockDom();
  await import('../js/drive/drive-rules-naming.js');

  const testCfg = {
    openAt: '2026-10-10T01:00:00.000Z',
    deadlineAt: '2026-10-15T16:59:00.000Z',
    allowLateSubmission: true,
    maxFiles: 2,
    maxFileSizeMB: 200,
    maxAttempts: 5
  };

  window.populateActivitySubmissionForm(testCfg);
  assert.equal(dom.get('sub-open-date').value, '10/10/2026');
  assert.equal(dom.get('sub-open-time').value, '08:00');
  assert.equal(dom.get('sub-deadline-date').value, '15/10/2026');
  assert.equal(dom.get('sub-deadline-time').value, '23:59');
  assert.equal(dom.get('sub-allow-late').checked, true);
  assert.equal(dom.get('sub-max-files').value, 2);

  window.resetActivitySubmissionForm();
  assert.equal(dom.get('sub-open-date').value, '');
  assert.equal(dom.get('sub-open-time').value, '');
  assert.equal(dom.get('sub-deadline-date').value, '');
  assert.equal(dom.get('sub-deadline-time').value, '');
  assert.equal(dom.get('sub-allow-late').checked, false);
});

test('Milestone Time Separation - Scenario 8: Immediate openMode allows student submission right now regardless of activity start', async () => {
  const dom = setupMockDom();
  await import('../js/drive/drive-rules-naming.js');
  const { validateActivity } = require('../functions/validation.js');

  // Select immediate open mode
  dom.setRadio('sub_open_mode', 'immediate');
  dom.setRadio('sub_deadline_mode', 'custom');
  dom.get('sub-deadline-date').value = '30/10/2026';
  dom.get('sub-deadline-time').value = '17:00';

  const cfg = window.readActivitySubmissionForm();
  assert.equal(cfg.openMode, 'immediate');
  assert.equal(cfg.openAt, null);
  assert.ok(cfg.deadlineAt);

  const defenseActivity = {
    id: 'act-immediate-test',
    submissionEnabled: true,
    startAt: '2026-11-15T06:00:00.000Z', // Activity starts next month
    endAt: '2026-11-15T10:00:00.000Z',
    submissionConfig: cfg
  };

  const rules = window.getEffectiveSubmissionRules('student_imm', defenseActivity, {});
  assert.equal(rules.isNotStarted, false);
  assert.equal(rules.canSubmit, true);
  assert.doesNotThrow(() => validateActivity(defenseActivity, 0));
});
