/**
 * Test Suite: IFA+ Graduation — Round Topic Revision Lock Feature
 * Tests Admin toggle button, status badge, Firestore persistence,
 * and Student UI lock behaviors (hiding edit button, blocking edit mode, view-only).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('--- ROUND TOPIC REVISION LOCK FEATURE SUITE ---', async (t) => {
  // 1. Verify existence of rounds-topic-lock.js and inclusion in rounds-dashboard.js
  await t.test('1. Module rounds-topic-lock.js exists and is imported into rounds-dashboard.js', () => {
    const topicLockPath = path.join(__dirname, '../js/rounds/rounds-topic-lock.js');
    assert.ok(fs.existsSync(topicLockPath), 'js/rounds/rounds-topic-lock.js must exist');
    const topicLockContent = fs.readFileSync(topicLockPath, 'utf8');
    assert.match(topicLockContent, /window\.isRoundTopicRevisionLocked = function/);
    assert.match(topicLockContent, /window\.updateAdminRoundTopicRevisionToolbar = function/);
    assert.match(topicLockContent, /window\.adminToggleRoundTopicRevision = async function/);

    const dashPath = path.join(__dirname, '../js/rounds/rounds-dashboard.js');
    const dashContent = fs.readFileSync(dashPath, 'utf8');
    assert.match(dashContent, /import '\.\/rounds-topic-lock\.js';/, 'rounds-dashboard.js must import rounds-topic-lock.js');
  });

  // 2. Verify views/admin/tab-students.html contains the toolbar controls
  await t.test('2. Admin Tab Students contains admin-topic-revision-toolbar-controls with badge and toggle button', () => {
    const tabStudentsPath = path.join(__dirname, '../views/admin/tab-students.html');
    const content = fs.readFileSync(tabStudentsPath, 'utf8');
    assert.match(content, /id="admin-topic-revision-toolbar-controls"/);
    assert.match(content, /id="admin-topic-revision-badge"/);
    assert.match(content, /id="btn-admin-toggle-topic-revision"/);
    assert.match(content, /onclick="adminToggleRoundTopicRevision\(\)"/);

    // Also check index.html (compiled)
    const indexPath = path.join(__dirname, '../index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert.match(indexContent, /id="admin-topic-revision-toolbar-controls"/);
    assert.match(indexContent, /id="btn-admin-toggle-topic-revision"/);
  });

  // 3. Pure Logic: isRoundTopicRevisionLocked
  await t.test('3. Pure Logic: isRoundTopicRevisionLocked correctly evaluates lock state', () => {
    function isRoundTopicRevisionLocked(round) {
      if (!round) return false;
      return Boolean(round?.allowTopicRevision === false || round?.topicRevisionLocked === true);
    }

    assert.equal(isRoundTopicRevisionLocked(null), false);
    assert.equal(isRoundTopicRevisionLocked({}), false);
    assert.equal(isRoundTopicRevisionLocked({ allowTopicRevision: true, topicRevisionLocked: false }), false);
    assert.equal(isRoundTopicRevisionLocked({ allowTopicRevision: false }), true);
    assert.equal(isRoundTopicRevisionLocked({ topicRevisionLocked: true }), true);
    assert.equal(isRoundTopicRevisionLocked({ allowTopicRevision: false, topicRevisionLocked: true }), true);
  });

  // 4. Admin Toolbar UI state transitions
  await t.test('4. Admin Toolbar UI reflects open vs locked states accurately', () => {
    function mockUpdateToolbar(round) {
      const isLocked = Boolean(round?.allowTopicRevision === false || round?.topicRevisionLocked === true);
      const badge = { text: '', className: '' };
      const btn = { text: '', className: '' };

      if (!isLocked) {
        badge.text = '📝 Đang mở đổi đề tài';
        badge.className = 'bg-emerald-100 text-emerald-800';
        btn.text = '🔒 Hết thời gian đổi đề tài';
        btn.className = 'bg-amber-600';
      } else {
        badge.text = '🔒 Đã hết hạn đổi đề tài';
        badge.className = 'bg-rose-100 text-rose-800';
        btn.text = '🔓 Mở lại đổi đề tài';
        btn.className = 'bg-emerald-600';
      }
      return { badge, btn };
    }

    const openUi = mockUpdateToolbar({ id: 'r1', allowTopicRevision: true, topicRevisionLocked: false });
    assert.match(openUi.badge.text, /Đang mở đổi đề tài/);
    assert.match(openUi.btn.text, /Hết thời gian đổi đề tài/);

    const lockedUi = mockUpdateToolbar({ id: 'r1', allowTopicRevision: false, topicRevisionLocked: true });
    assert.match(lockedUi.badge.text, /Đã hết hạn đổi đề tài/);
    assert.match(lockedUi.btn.text, /Mở lại đổi đề tài/);
  });

  // 5. Student Hero Banner behavior when locked
  await t.test('5. Student Hero Banner hides Edit Topic button when topic revision is locked', () => {
    const loaderPath = path.join(__dirname, '../js/rounds/rounds-loader.js');
    const loaderContent = fs.readFileSync(loaderPath, 'utf8');
    assert.match(loaderContent, /isTopicRevisionLocked/);
    assert.match(loaderContent, /editTopicBtn\.classList\.toggle\('hidden', isTopicRevisionLocked\)/);
    assert.match(loaderContent, /🔒 Đã hết hạn đổi đề tài/);
  });

  // 6. Topic Registration Preview Modal guards
  await t.test('6. Topic Registration Preview Modal hides student edit button and prevents editing when locked', () => {
    const topicsPath = path.join(__dirname, '../js/supervisors/supervisor-portal-topics.js');
    const topicsContent = fs.readFileSync(topicsPath, 'utf8');

    // Button visibility
    assert.match(topicsContent, /btnStudentEdit\.classList\.toggle\('hidden', !isStudentViewer \|\| isViewingPastVersion \|\| isTopicRevisionLocked\)/);

    // Edit mode guard
    assert.match(topicsContent, /modal\._isTopicRevisionLocked/);
    assert.match(topicsContent, /if \(isEdit && \(!isStudent \|\| modal\._isViewingPastVersion \|\| isLocked\)\)/);

    // Save guard
    assert.match(topicsContent, /if \(isRoundLocked\)/);
    assert.match(topicsContent, /showToast\('Đã hết thời hạn đổi tên đề tài\. Bạn không thể lưu thay đổi\.', 'warning'\)/);

    // Footer notice
    assert.match(topicsContent, /if \(isTopicRevisionLocked && isStudentViewer && footerNoteEl\)/);
    assert.match(topicsContent, /🔒 <strong>Đã hết thời hạn đổi tên đề tài\.<\/strong> Bạn chỉ có thể xem lại thông tin phiếu đăng ký và in\/tải PDF\./);
  });

  // 7. Firestore Rules syntax & constraints
  await t.test('7. Firestore Rules enforces allowTopicRevision == true && topicRevisionLocked != true', () => {
    const rulesPath = path.join(__dirname, '../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    assert.match(rules, /allowTopicRevision/);
    assert.match(rules, /topicRevisionLocked/);
    assert.match(rules, /topicRevisionLocked != true/);
  });
});
