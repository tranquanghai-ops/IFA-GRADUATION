const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Admin Submission Controls & Typography Enlargement Suite', async (t) => {
  const driveUploadPanelSource = read('js/drive/drive-upload-panel.js');
  const driveFilesSource = read('js/drive/drive-files.js');
  const modalOverrideTemplate = read('templates/modals/shared/modal-submission-override.html');
  const modalHistoryTemplate = read('templates/modals/shared/modal-submission-history.html');
  const indexHtml = read('index.html');

  await t.test('1. Typography of deadline and countdown timer are enlarged and prominent', () => {
    // Header title and deadline badge
    assert.match(driveUploadPanelSource, /text-emerald-950 text-sm sm:text-base/);
    assert.match(driveUploadPanelSource, /Hạn nộp:<\/span>\s*<span[^>]*text-xs sm:text-sm font-black font-mono/);

    // Prominent countdown box with large digits
    assert.match(driveUploadPanelSource, /border-2 border-rose-300 bg-rose-50\/90/);
    assert.match(driveUploadPanelSource, /Thời gian còn lại đến hạn chót/);
    assert.match(driveUploadPanelSource, /Kết thúc nhận bài:/);
    assert.match(driveUploadPanelSource, /text-rose-600 font-black font-mono text-base sm:text-xl lg:text-2xl/);
  });

  await t.test('2. Admin has deletion controls across dashboard table, history modal, and student panel', () => {
    // Admin delete button in Admin dashboard table
    assert.match(driveFilesSource, /adminDeleteStudentSubmission\('\${student\.studentId}', '\${act\.id}', '\${round\.id}', \${current\.attempt \|\| 1}\)/);
    assert.match(driveFilesSource, /🗑️ Xóa bài/);

    // Admin delete button in history modal
    assert.match(driveFilesSource, /adminDeleteStudentSubmission\('\${studentId}', '\${act\.id}', '\${round\.id}', \${att\.attempt \|\| \(idx \+ 1\)}\)/);
    assert.match(driveFilesSource, /🗑️ Xóa lần nộp này/);

    // Admin delete button in student submission panel
    assert.match(driveUploadPanelSource, /adminDeleteStudentSubmission\('\${userMssv}', '\${act\.id}', '\${round\.id}', \${att\.attempt \|\| \(idx \+ 1\)}\)/);
    assert.match(driveUploadPanelSource, /🗑️ Xóa bài \(Admin\)/);

    // withdrawStudentSubmission accepts optStudentId
    assert.match(driveFilesSource, /window\.withdrawStudentSubmission\s*=\s*async function\(actId,\s*attemptNum,\s*optRoundId,\s*optStudentId\)/);
    assert.match(driveFilesSource, /window\.adminDeleteStudentSubmission\s*=\s*async function/);
  });

  await t.test('3. Admin has quick controls to grant extra attempts (+1, +2, +3 lượt)', () => {
    // Modal template and compiled index.html have quick buttons
    assert.match(modalOverrideTemplate, /onclick="setQuickExtraAttempts\(1\)"/);
    assert.match(modalOverrideTemplate, /onclick="setQuickExtraAttempts\(2\)"/);
    assert.match(modalOverrideTemplate, /onclick="setQuickExtraAttempts\(3\)"/);
    assert.match(indexHtml, /onclick="setQuickExtraAttempts\(1\)"/);

    // Helper window.setQuickExtraAttempts is defined
    assert.match(driveFilesSource, /window\.setQuickExtraAttempts\s*=\s*function\(n\)/);

    // Student panel has + Thêm lượt button for Admin
    assert.match(driveUploadPanelSource, /\+ Thêm lượt/);

    // History modal has shortcut to grant extra attempts
    assert.match(driveFilesSource, /⭐ Cấp thêm lượt \/ Gia hạn/);
    assert.match(modalHistoryTemplate, /id="sub-hist-header-action"/);
  });

  await t.test('4. Backend /api/graduation/withdraw-activity supports requestedStudentId when caller is Admin', () => {
    const backendSource = read('functions/index.js');
    assert.match(backendSource, /if \(req\.auth\.isAdmin && requestedStudentId\)/);
    assert.match(backendSource, /effectiveStudentId = requestedStudentId\.trim\(\);/);
    assert.match(backendSource, /status: 'withdrawn'/);
  });
});
