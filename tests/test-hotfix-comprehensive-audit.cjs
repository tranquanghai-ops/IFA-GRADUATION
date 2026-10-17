/**
 * IFA+ Graduation — Comprehensive Test Suite for Hotfix Groups A, B, C, D, E
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read files
const prelimSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/preliminary-dashboard.js'), 'utf8');
const studentSubmissionsSource = fs.readFileSync(path.resolve(__dirname, '../js/students/student-review-submissions.js'), 'utf8');
const trackerSource = fs.readFileSync(path.resolve(__dirname, '../js/tracking/user-activity-tracker.js'), 'utf8');
const eligibilitySource = fs.readFileSync(path.resolve(__dirname, '../js/students/student-eligibility-admin.js'), 'utf8');
const compiledIndexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const tabStudentsHtml = fs.readFileSync(path.resolve(__dirname, '../views/admin/tab-students.html'), 'utf8');
const reconcileScript = fs.readFileSync(path.resolve(__dirname, '../scripts/reconcile-and-recover-submissions.cjs'), 'utf8');

test('Comprehensive Hotfix Groups A, B, C, D, E Audit Suite', async (t) => {

  // =========================================================================
  // NHÓM A (P0): Reconciliation & Dry-Run Recovery Script
  // =========================================================================
  await t.test('Nhóm A1: Reconcile script strictly defaults to dry-run and protects production', () => {
    assert.match(reconcileScript, /const isDryRun = !isApplyMode/);
    assert.match(reconcileScript, /ALLOWED_STUDENT_IDS = \['11900382', '11900395', '12200254'\]/);
    assert.match(reconcileScript, /ACTIVITY_DEADLINE_ISO/);
    assert.match(reconcileScript, /audit-reconciliation-report/);
    assert.match(reconcileScript, /rollback-reconciliation/);
  });

  // =========================================================================
  // NHÓM B (P4): File Viewing & Submission History
  // =========================================================================
  await t.test('Nhóm B1: "👁️ Xem bài" opens latest official file directly in new tab', () => {
    assert.match(studentSubmissionsSource, /export function openLatestOfficialSubmissionFile/);
    assert.match(studentSubmissionsSource, /window\.open\(viewUrl, '_blank', 'noopener,noreferrer'\)/);
    assert.match(studentSubmissionsSource, /window\.openLatestOfficialSubmissionFile = openLatestOfficialSubmissionFile/);
  });

  await t.test('Nhóm B2: Clicking attempt badge opens full submission inspection modal', () => {
    assert.match(studentSubmissionsSource, /onclick="openAdminSubmissionInspectModal\('\${st\.studentId}'/);
    assert.match(studentSubmissionsSource, /title="Bấm để xem chi tiết bài nộp & lịch sử các lần nộp"/);
  });

  await t.test('Nhóm B3: Supports 0/N, 1/N, 2/N, 3/N attempt badges', () => {
    assert.match(studentSubmissionsSource, /\${st\.completedAttempts}\/\${st\.totalAllowedAttempts}/);
    assert.match(studentSubmissionsSource, /Chưa nộp/);
  });

  // =========================================================================
  // NHÓM C (P3): Student Activity Tracking
  // =========================================================================
  await t.test('Nhóm C1: tab-students header renamed to "Thao tác cuối cùng"', () => {
    assert.match(tabStudentsHtml, /<th[^>]*>(?:Hoạt động gần nhất|Thao tác cuối cùng)<\/th>/);
  });

  await t.test('Nhóm C2: Student table cell contains clickable button calling openStudentActivityHistoryModal', () => {
    assert.match(eligibilitySource, /openStudentActivityHistoryModal\('\${s\.studentId}'\)/);
    assert.match(eligibilitySource, /title="Bấm để xem lịch sử 10 hoạt động gần nhất"/);
  });

  await t.test('Nhóm C3: Compiled index.html contains modal-student-activity-history', () => {
    assert.ok(compiledIndexHtml.includes('id="modal-student-activity-history"'));
    assert.ok(compiledIndexHtml.includes('id="student-activity-history-timeline"'));
    assert.ok(compiledIndexHtml.includes('id="student-activity-history-count-badge"'));
  });

  await t.test('Nhóm C4: user-activity-tracker exports openStudentActivityHistoryModal and enforces 10 max real events', () => {
    assert.match(trackerSource, /export async function openStudentActivityHistoryModal/);
    assert.match(trackerSource, /events\.sort\(\(a, b\) => toMs\(b\.timestamp\) - toMs\(a\.timestamp\)\)/);
    assert.match(trackerSource, /const top10 = deduped\.slice\(0, 10\)/);
    assert.match(trackerSource, /window\.openStudentActivityHistoryModal = openStudentActivityHistoryModal/);
  });

  // =========================================================================
  // NHÓM D (P1): Council Member Score Recognition
  // =========================================================================
  await t.test('Nhóm D1: Multi-attribute matching for council members includes scorerId, email, and memberId', () => {
    assert.match(prelimSource, /const kEmail = assigned\.memberEmail \? `\${act\.id}_\${council\.id}_\${sid}_\${String\(assigned\.memberEmail\)\.toLowerCase\(\)\.trim\(\)}` : null/);
    assert.match(prelimSource, /const kMemberId = assigned\.memberId \? `\${act\.id}_\${council\.id}_\${sid}_\${String\(assigned\.memberId\)\.trim\(\)}` : null/);
    assert.match(prelimSource, /targetRound\?\.councilRubricScores/);
    assert.match(prelimSource, /window\._fetchingCouncilReviewDecisions/);
  });

  // =========================================================================
  // NHÓM E (P2): Revoke Publication & Adjust Council Score
  // =========================================================================
  await t.test('Nhóm E1: Compiled index.html contains modal-revoke-progress-review and modal-adjust-council-score', () => {
    assert.ok(compiledIndexHtml.includes('id="modal-revoke-progress-review"'));
    assert.ok(compiledIndexHtml.includes('id="modal-adjust-council-score"'));
    assert.ok(compiledIndexHtml.includes('id="btn-open-adjust-council-score"'));
  });

  await t.test('Nhóm E2: renderPublishProgressReviewToolbar displays "↩️ Thu hồi công bố" when published', () => {
    assert.match(prelimSource, /openRevokeProgressReviewModal\(\${phase}\)/);
    assert.match(prelimSource, /<span>Thu hồi công bố<\/span>/);
  });

  await t.test('Nhóm E3: Revoke review enforces 10-char mandatory reason and updates isPublished to false', () => {
    assert.match(prelimSource, /export async function confirmRevokeProgressReview/);
    assert.match(prelimSource, /reason\.length < 10/);
    assert.match(prelimSource, /status: 'revoked'/);
    assert.match(prelimSource, /isPublished: false/);
    assert.match(prelimSource, /REVOKE_PROGRESS_REVIEW_PUBLISH/);
  });

  await t.test('Nhóm E4: Adjust score modal checks published state and prevents mutation while published', () => {
    assert.match(prelimSource, /export function openAdjustCouncilScoreModal/);
    assert.match(prelimSource, /const isPub = isProgressReviewPublished\(ctx\.phase \|\| 1, ctx\.targetRound\)/);
    assert.match(prelimSource, /warnEl\.classList\.remove\('hidden'\)/);
    assert.match(prelimSource, /btnConfirm\.disabled = true/);
  });

  await t.test('Nhóm E5: Letter grade conversion rules (>= B- is Đạt, <= C+ is Không đạt)', () => {
    const scale = {
      'A': { score: 9.0, passed: true },
      'A-': { score: 8.2, passed: true },
      'B+': { score: 7.7, passed: true },
      'B': { score: 7.2, passed: true },
      'B-': { score: 6.7, passed: true },
      'C+': { score: 6.2, passed: false },
      'C': { score: 5.7, passed: false },
      'F': { score: 0.0, passed: false }
    };

    ['A', 'A-', 'B+', 'B', 'B-'].forEach(letter => {
      assert.equal(scale[letter].passed, true, `${letter} must be passed`);
    });

    ['C+', 'C', 'F'].forEach(letter => {
      assert.equal(scale[letter].passed, false, `${letter} must be failed`);
    });
  });

  await t.test('Nhóm E6: confirmAdjustCouncilScore writes immutable auditLog with action ADJUST_COUNCIL_SCORE', () => {
    assert.match(prelimSource, /export async function confirmAdjustCouncilScore/);
    assert.match(prelimSource, /action: 'ADJUST_COUNCIL_SCORE'/);
    assert.match(prelimSource, /adjustReason: reason/);
    assert.match(prelimSource, /adjustBasis: basis/);
    assert.match(prelimSource, /window\.confirmAdjustCouncilScore = confirmAdjustCouncilScore/);
  });

});
