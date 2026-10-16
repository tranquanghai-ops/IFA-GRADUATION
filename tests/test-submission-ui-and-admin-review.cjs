const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Phần A & Phần B: Submission UI and Admin Review Rounds Suite', async (t) => {
  const panelSource = read('js/drive/drive-upload-panel.js');
  const filesSource = read('js/drive/drive-files.js');
  const reviewSource = read('js/students/student-review-submissions.js');
  const tabStudentsSource = read('views/admin/tab-students.html');
  const inspectModalSource = read('templates/modals/shared/modal-admin-submission-inspect.html');
  const indexHtml = read('index.html');

  await t.test('A1: Single-row horizontal layout for desktop (file selector + filename + submit button)', () => {
    // Hidden native file input + custom styled label
    assert.match(panelSource, /<input type="file" id="sub-input-file-\$\{act\.id\}"[^>]*class="hidden"/);
    assert.match(panelSource, /<label for="sub-input-file-\$\{act\.id\}"[\s\S]*?Chọn file[\s\S]*?<\/label>/);
    // Display area for selected file with truncate
    assert.match(panelSource, /id="sub-selected-file-info-\$\{act\.id\}"[^>]*class="flex-1 min-w-0/);
    // Responsive flex layout (stacked on mobile, row on sm:)
    assert.match(panelSource, /flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3/);
    assert.match(panelSource, /id="btn-submit-file-\$\{act\.id\}"/);
  });

  await t.test('A2: Attempt counter and dynamic button label synchronization', () => {
    // Attempt counter display
    assert.match(panelSource, /Số lần đã nộp \/ Tối đa/);
    assert.match(panelSource, /\$\{rules\.completedAttempts\}\/\$\{rules\.totalAllowedAttempts\} lần/);
    // Submit button label: Nộp bài (Lần completedAttempts + 1/totalAllowedAttempts)
    assert.match(panelSource, /📤 Nộp bài \(Lần \$\{rules\.completedAttempts \+ 1\}\/\$\{rules\.totalAllowedAttempts\}\)/);
    // Submit button disabled with "🚫 Đã hết lượt nộp" when remainingAttempts <= 0
    assert.match(panelSource, /rules\.remainingAttempts <= 0/);
    assert.match(panelSource, /🚫 Đã hết lượt nộp/);
    assert.match(panelSource, /disabled class="[^"]*cursor-not-allowed/);
  });

  await t.test('A3: Automatic in-place UI update post-submission (without requiring F5)', () => {
    // In submitStudentFiles: panel re-rendered in-place
    assert.match(filesSource, /const panelEl = document\.getElementById\('sub-panel-' \+ act\.id\);/);
    assert.match(filesSource, /panelEl\.outerHTML = renderStudentSubmissionPanel\(act, round\);/);
    // In retryStudentComplete: panel re-rendered in-place as well
    assert.match(filesSource, /panelEl\.outerHTML = renderStudentSubmissionPanel\(act, round\);/);
  });

  await t.test('A4: Enriched latest submission card with file details and Drive view link', () => {
    assert.match(panelSource, /BÀI ĐÃ NỘP GẦN NHẤT/);
    assert.match(panelSource, /Lần \$\{rules\.currentSubmission\.attempt \|\| rules\.completedAttempts\}\/\$\{rules\.totalAllowedAttempts\}/);
    assert.match(panelSource, /👁️ Xem bài đã nộp/);
    assert.match(panelSource, /https:\/\/drive\.google\.com\/file\/d\//);
    assert.match(panelSource, /rules\.currentSubmission\.receiptId/);
  });

  await t.test('B1: Sub-tab navigation in modal Danh sách sinh viên', () => {
    // Tab header buttons
    assert.match(tabStudentsSource, /id="btn-subtab-eligible-students"/);
    assert.match(tabStudentsSource, /onclick="switchEligibleStudentsSubTab\('students'\)"/);
    assert.match(tabStudentsSource, /Danh sách sinh viên/);

    assert.match(tabStudentsSource, /id="btn-subtab-review-rounds"/);
    assert.match(tabStudentsSource, /onclick="switchEligibleStudentsSubTab\('reviews'\)"/);
    assert.match(tabStudentsSource, /Quản lý các đợt duyệt/);

    // Tab panels
    assert.match(tabStudentsSource, /id="subtab-panel-eligible-students"/);
    assert.match(tabStudentsSource, /id="subtab-panel-review-rounds"/);
  });

  await t.test('B2: Sub-tab 2 UI elements (KPIs, Filters, Table)', () => {
    // KPI stat cards
    assert.match(tabStudentsSource, /id="review-sub-stat-total"/);
    assert.match(tabStudentsSource, /id="review-sub-stat-none"/);
    assert.match(tabStudentsSource, /id="review-sub-stat-partial"/);
    assert.match(tabStudentsSource, /id="review-sub-stat-completed"/);

    // Filters
    assert.match(tabStudentsSource, /id="review-sub-round-select"/);
    assert.match(tabStudentsSource, /id="review-sub-activity-select"/);
    assert.match(tabStudentsSource, /id="review-sub-search-input"/);
    assert.match(tabStudentsSource, /id="review-sub-status-filter"/);

    // Submissions table & tbody
    assert.match(tabStudentsSource, /id="admin-review-submissions-tbody"/);
    assert.match(tabStudentsSource, /<th[^>]*>STT<\/th>/);
    assert.match(tabStudentsSource, /<th[^>]*>MSSV<\/th>/);
    assert.match(tabStudentsSource, /<th[^>]*>Họ và tên<\/th>/);
    assert.match(tabStudentsSource, /<th[^>]*>Đề tài<\/th>/);
    assert.match(tabStudentsSource, /<th[^>]*>GVHD<\/th>/);
    assert.match(tabStudentsSource, /<th[^>]*>Đã nộp \/ Tối đa<\/th>/);
    assert.match(tabStudentsSource, /<th[^>]*>Lần mới nhất<\/th>/);
    assert.match(tabStudentsSource, /<th[^>]*>Thời gian nộp<\/th>/);
    assert.match(tabStudentsSource, /<th[^>]*>Trạng thái<\/th>/);
    assert.match(tabStudentsSource, /<th[^>]*>Xem file<\/th>/);
  });

  await t.test('B3: Admin inspection modal features current file, attempts history, and actions', () => {
    assert.match(inspectModalSource, /id="modal-admin-submission-inspect"/);
    assert.match(inspectModalSource, /Chi tiết bài nộp & Lịch sử các lần nộp/);
    assert.match(inspectModalSource, /id="inspect-sub-student-id"/);
    assert.match(inspectModalSource, /id="inspect-sub-student-name"/);
    assert.match(inspectModalSource, /id="inspect-sub-current-card"/);
    assert.match(inspectModalSource, /id="inspect-sub-history-list"/);
    assert.match(inspectModalSource, /closeAdminSubmissionInspectModal/);
  });

  await t.test('B4: JS submodule student-review-submissions.js implements all handlers and window bridges', () => {
    assert.match(reviewSource, /window\.switchEligibleStudentsSubTab\s*=\s*function/);
    assert.match(reviewSource, /window\.loadAdminReviewSubmissionsTab\s*=\s*async function/);
    assert.match(reviewSource, /window\.onReviewRoundSelectChange\s*=\s*function/);
    assert.match(reviewSource, /window\.onReviewActivitySelectChange\s*=\s*function/);
    assert.match(reviewSource, /window\.filterReviewSubmissionsTable\s*=\s*function/);
    assert.match(reviewSource, /window\.openAdminSubmissionInspectModal\s*=\s*function/);
    assert.match(reviewSource, /window\.closeAdminSubmissionInspectModal\s*=\s*function/);
  });

  await t.test('B5: Compiled index.html contains modal-admin-submission-inspect and subtab-panel-review-rounds', () => {
    assert.match(indexHtml, /id="subtab-panel-review-rounds"/);
    assert.match(indexHtml, /id="modal-admin-submission-inspect"/);
    assert.match(indexHtml, /id="admin-review-submissions-tbody"/);
    assert.match(indexHtml, /id="btn-subtab-review-rounds"/);
  });
});
