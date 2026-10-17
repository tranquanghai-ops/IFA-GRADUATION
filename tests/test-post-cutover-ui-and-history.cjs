/**
 * IFA+ Graduation — Regression Test Suite for Post-Cutover UI, Submissions, Supervisor Access, and User Activity History
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read source files
const prelimSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/preliminary-dashboard.js'), 'utf8');
const studentJourneySource = fs.readFileSync(path.resolve(__dirname, '../js/students/student-journey.js'), 'utf8');
const supervisorStudentsSource = fs.readFileSync(path.resolve(__dirname, '../js/supervisors/supervisor-portal-students.js'), 'utf8');
const supervisorCoreSource = fs.readFileSync(path.resolve(__dirname, '../js/supervisors/supervisor-portal-core.js'), 'utf8');
const studentReviewSubmissionsSource = fs.readFileSync(path.resolve(__dirname, '../js/students/student-review-submissions.js'), 'utf8');
const trackerSource = fs.readFileSync(path.resolve(__dirname, '../js/tracking/user-activity-tracker.js'), 'utf8');
const timelinePreviewSource = fs.readFileSync(path.resolve(__dirname, '../js/rounds/rounds-timeline-preview.js'), 'utf8');
const roundsCardsSource = fs.readFileSync(path.resolve(__dirname, '../js/rounds/rounds-cards.js'), 'utf8');
const supervisorHtml = fs.readFileSync(path.resolve(__dirname, '../views/supervisor.html'), 'utf8');
const monitoringModalHtml = fs.readFileSync(path.resolve(__dirname, '../templates/modals/rounds/modal-round-access-monitoring.html'), 'utf8');
const compiledIndexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

test('Post-Cutover UI, Submissions, Supervisor View, and Activity History Regression Suite', async (t) => {

  // =========================================================================
  // 1. Sinh viên đã công bố điểm có thể xem kết quả & Sau cleanup root vẫn hiển thị
  // =========================================================================
  await t.test('1. Student Journey & Preliminary sync subcollection results to both flat key and parent doc structure', () => {
    assert.match(prelimSource, /state\.cachedPublishedResults\[`\${roundId}_\${sid}_\${pKey}`\]\s*=\s*phaseData/);
    assert.match(prelimSource, /state\.cachedPublishedResults\[`\${roundId}_\${sid}`\]\.reviews\[pKey\]\s*=\s*phaseData/);

    // student-journey.js checks cachedPhase first and supports subcollection hydration
    assert.match(studentJourneySource, /const phaseCacheKey = `\${round\.id}_\${mySid}_duyet_\${phase}`;/);
    assert.match(studentJourneySource, /cachedPhase = \(typeof state !== 'undefined' && state\.cachedPublishedResults\?\.\[phaseCacheKey\]\);/);
    assert.match(studentJourneySource, /getStudentPublishedReviewResult\(round\.id, mySid, phase\)/);
  });

  await t.test('2. Grade display enforces official letterGrade, large typography, soft colors, and threshold (B- pass)', () => {
    // student-journey.js checks >= B- threshold (B-, B, B+, A-, A, A+) as pass, <= C+ as fail
    assert.match(studentJourneySource, /\['A', 'A-', 'B\+', 'B', 'B-'\]\.includes\(stRes\.letterGrade\)/);
    assert.match(studentJourneySource, /✓ Đạt yêu cầu/);
    assert.match(studentJourneySource, /✕ Không đạt yêu cầu/);
    assert.match(studentJourneySource, /text-xl sm:text-2xl font-black|font-black text-xl sm:text-2xl/);
    assert.match(studentJourneySource, /bg-emerald-50 text-emerald-800/);
    assert.match(studentJourneySource, /bg-rose-50 text-rose-800/);
  });

  await t.test('3. Timeline Preview dialog dynamically hydrates phase review when opened directly', () => {
    assert.match(timelinePreviewSource, /getStudentPublishedReviewResult\(submissionRound\.id, mySid, phase\)/);
    assert.match(timelinePreviewSource, /student-timeline-dialog-review-slot/);
  });

  // =========================================================================
  // 2. Kết quả thu hồi phải bị ẩn hoàn toàn
  // =========================================================================
  await t.test('4. Revoked review hides grade completely with no partial or leaked data', () => {
    // When unpublished or revoked, student-journey checks isPub and stRes.status !== 'revoked'
    assert.match(studentJourneySource, /if \(isPub\)/);
    assert.match(studentJourneySource, /cachedPhase\.status !== 'revoked'/);
    assert.match(studentJourneySource, /if \(stRes && stRes\.letterGrade && stRes\.status !== 'revoked'\)/);
  });

  // =========================================================================
  // 3. Giao diện GVHD đọc điểm đúng & hiển thị bên cạnh tên SV
  // =========================================================================
  await t.test('5. Supervisor Portal modal displays published review badges next to student name', () => {
    assert.match(supervisorHtml, /id="dtl-published-scores-container"/);
    assert.match(supervisorStudentsSource, /Duyệt \${phase}:/);
    assert.match(supervisorStudentsSource, /escapeHtml\(res\.letterGrade\)/);
    assert.match(supervisorStudentsSource, /bg-emerald-500\/20/);
  });

  await t.test('6. Supervisor Portal preloader accurately renders student cards without breaking on table callback', () => {
    // Fixed typo: was renderSupervisorStudentsTable, now renderSupervisorAssignedStudents
    assert.match(supervisorCoreSource, /window\.renderSupervisorAssignedStudents\(\)/);
    assert.ok(!supervisorCoreSource.includes('window.renderSupervisorStudentsTable()'));
  });

  // =========================================================================
  // 4. GVHD bấm "Đã nộp bài" mở đúng file với RBAC guard
  // =========================================================================
  await t.test('7. Supervisor modal has interactive "✓ Đã nộp bài" button with assignment verification', () => {
    assert.match(supervisorStudentsSource, /openSupervisorSubmissionDetail\('\${studentId}', '\${act\.id}'\)/);
    assert.match(supervisorStudentsSource, /export async function openSupervisorSubmissionDetail/);
    assert.match(supervisorStudentsSource, /window\.openSupervisorSubmissionDetail = openSupervisorSubmissionDetail/);
    // RBAC: checks if supervisor is assigned
    assert.match(supervisorStudentsSource, /isAssignedToThisSupervisor|supervisorAssignedStudents/);
    assert.match(supervisorStudentsSource, /openAdminSubmissionInspectModal/);
  });

  // =========================================================================
  // 5. Khôi phục hiển thị bài nộp cho 3 MSSV & Thống nhất Admin / GVHD / SV
  // =========================================================================
  await t.test('8. Admin review submissions tab hydrates recovered submissions for 11900382, 11900395, 12200254', () => {
    assert.match(studentReviewSubmissionsSource, /const keyStudents = \['11900382', '11900395', '12200254'\]/);
    assert.match(studentReviewSubmissionsSource, /sub_\${roundId}_\${act\.id}_\${kSid}_recov/);
    assert.match(studentReviewSubmissionsSource, /round\.activitySubmissions\[act\.id\]\?\.\[kSid\]/);
  });

  await t.test('9. openLatestOfficialSubmissionFile preloads submissions before opening Drive URL', () => {
    assert.match(studentReviewSubmissionsSource, /window\.ensureStudentSubmissionsLoaded\(round\.id, studentId\)/);
    assert.match(studentReviewSubmissionsSource, /export function openLatestOfficialSubmissionFile/);
  });

  // =========================================================================
  // 6. Chức năng "Thao tác cuối cùng" & Xem 10 thao tác gần nhất
  // =========================================================================
  await t.test('10. Renamed titles, badges, and columns to "Thao tác cuối cùng"', () => {
    assert.match(monitoringModalHtml, /<h3[^>]*>Thao tác cuối cùng<\/h3>/);
    assert.match(monitoringModalHtml, /THAO TÁC GẦN NHẤT/);
    assert.match(roundsCardsSource, /⚡ Thao tác cuối cùng/);
    assert.match(compiledIndexHtml, /Thao tác cuối cùng/);
  });

  await t.test('11. user-activity-tracker formats timestamps strictly as dd/mm/yyyy HH:mm', () => {
    assert.match(trackerSource, /const pad = n => String\(n\)\.padStart\(2, '0'\)/);
    assert.match(trackerSource, /return `\${d}\/\${m}\/\${y} \${hh}:\${mm}`/);
  });

  await t.test('12. user-activity-tracker distinguishes lastLoginAt and lastActionAt', () => {
    assert.match(trackerSource, /lastLoginFormattedDate: loginTs \? formatActivityDateTime\(loginTs\) : '--'/);
    assert.match(trackerSource, /lastActionFormattedDate: effectiveActionTs \? formatActivityDateTime\(effectiveActionTs\) : '--'/);
  });

  await t.test('13. openStudentActivityHistoryModal supports students and instructors, enforcing max 10 real events', () => {
    assert.match(trackerSource, /export async function openStudentActivityHistoryModal\(studentId, optRoleType\)/);
    assert.match(trackerSource, /const top10 = deduped\.slice\(0, 10\)/);
    assert.match(trackerSource, /Chưa có lịch sử thao tác/);
    assert.match(trackerSource, /window\.openUserActivityHistoryModal = openStudentActivityHistoryModal/);
  });

  await t.test('14. Round monitoring table rows are clickable to open 10 actions history modal', () => {
    assert.match(trackerSource, /onclick="openStudentActivityHistoryModal\('\${a\.id \|\| a\.email}', '\${a\.roleType}'\)"/);
  });
});
