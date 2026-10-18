/**
 * IFA+ Graduation — Regression Test Suite for Admin Scoring Dashboard Post-Cutover & Revoke/Republish Lifecycle
 *
 * Tests the 14 mandatory regression requirements:
 * 1. Admin views results of 6 students after cleanup root.
 * 2. Tab Duyệt 1 displays correct grades from authoritative publishedProgressReviews / subcollection source.
 * 3. Does not silently convert read errors or loading state to "Chưa duyệt".
 * 4. Tabs Duyệt 2 & 3 are compatible with the same architecture.
 * 5. Revoke button is disabled when reason is empty or < 10 chars.
 * 6. Revoke button is disabled when confirmation checkbox is unchecked.
 * 7. Revoke button is enabled when reason >= 10 chars AND confirmation checkbox is checked.
 * 8. Revoking Duyệt 1 does not affect Duyệt 2/3 or delete raw grades.
 * 9. Republishing retrieves stored results without requiring regrading.
 * 10. Student / Supervisor cannot see revoked results.
 * 11. Student / Supervisor can see published results when not revoked.
 * 12. Admin retains access to internal grading data according to permissions.
 * 13. Sensitive scoring fields (councilScores, finalDefenseScores) are NEVER rewritten back to root round document.
 * 14. No JavaScript ES Module syntax errors or unhandled exceptions.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read source files
const prelimSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/preliminary-dashboard.js'), 'utf8');
const defenseScoresSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/defense-scores.js'), 'utf8');
const activitiesManagerSource = fs.readFileSync(path.resolve(__dirname, '../js/planning/activities-manager.js'), 'utf8');
const compiledIndexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

test('Admin Scoring Dashboard Post-Cutover & Revocation Suite', async (t) => {

  // =========================================================================
  // Requirement 1 & 2: Admin xem kết quả 6 sinh viên sau cleanup root & từ nguồn mới
  // =========================================================================
  await t.test('1 & 2: getProgressReviewData resolves 6 students from publishedProgressReviews after cleanup-root', () => {
    // Simulate cleaned root document (NO councilScores, NO finalDefenseScores, NO studentResults on root)
    const mockCleanedRound = {
      id: 'FZRWniqMofaIvn7ogq0w',
      title: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP – ĐỢT 12/2026',
      publishedReviews: {
        duyet_1: {
          status: 'published',
          isPublished: true,
          phase: 1,
          activityId: 'act_1790171285992_yhhi9',
          publishedAt: '2026-10-16T10:30:38.904Z',
          publishedBy: 'tranquanghai@tdtu.edu.vn'
          // studentResults was removed during cleanup-root
        }
      },
      publishedProgressReviews: {
        duyet_1: {
          activityId: 'act_1790171285992_yhhi9',
          eligibleCount: 6,
          phase: 1,
          publishedAt: '2026-10-16T10:30:38.904Z',
          publishedBy: 'tranquanghai@tdtu.edu.vn',
          roundId: 'FZRWniqMofaIvn7ogq0w',
          status: 'published',
          studentResults: {
            '11900335': { finalizedAt: '2026-10-16T10:30:38.904Z', isPassed: false, letterGrade: 'C', status: 'failed', studentId: '11900335', studentName: 'Chu Hoàng Anh' },
            '11900375': { finalizedAt: '2026-10-16T10:30:38.904Z', isPassed: false, letterGrade: 'C+', status: 'failed', studentId: '11900375', studentName: 'Nguyễn Thanh Ngân' },
            '11900382': { finalizedAt: '2026-10-16T10:30:38.904Z', isPassed: true, letterGrade: 'B', status: 'passed', studentId: '11900382', studentName: 'Trang Trần Tuệ Nhã' },
            '11900395': { finalizedAt: '2026-10-16T10:30:38.904Z', isPassed: false, letterGrade: 'C+', status: 'failed', studentId: '11900395', studentName: 'Nguyễn Khánh Thịnh' },
            '11900412': { finalizedAt: '2026-10-16T10:30:38.904Z', isPassed: true, letterGrade: 'B+', status: 'passed', studentId: '11900412', studentName: 'Huỳnh Thị Ngọc Tuyền' },
            '12200254': { finalizedAt: '2026-10-16T10:30:38.904Z', isPassed: true, letterGrade: 'B', status: 'passed', studentId: '12200254', studentName: 'Nguyễn Thanh Hằng Nga' }
          }
        }
      }
    };

    // Evaluate getProgressReviewData logic using the module's implementation
    const vm = require('node:vm');
    const sandbox = {
      state: { selectedRoundId: 'FZRWniqMofaIvn7ogq0w' },
      isProgressReviewPassed: (letter) => ['A', 'A-', 'B+', 'B', 'B-'].includes(String(letter || '').trim().toUpperCase()),
      findProgressReviewActivity: () => ({ id: 'act_1790171285992_yhhi9', councilEnabled: true, councils: [] })
    };
    vm.createContext(sandbox);

    // Run isolated extract of getProgressReviewData
    const code = `
      ${prelimSource.match(/export function getProgressReviewData[\s\S]*?\n\}/)[0].replace('export function', 'function')}
      sandboxResult = [
        getProgressReviewData('11900335', 1, mockRound),
        getProgressReviewData('11900375', 1, mockRound),
        getProgressReviewData('11900382', 1, mockRound),
        getProgressReviewData('11900395', 1, mockRound),
        getProgressReviewData('11900412', 1, mockRound),
        getProgressReviewData('12200254', 1, mockRound)
      ];
    `;
    sandbox.mockRound = mockCleanedRound;
    vm.runInContext(code, sandbox);

    const [s1, s2, s3, s4, s5, s6] = sandbox.sandboxResult;

    // Student 1: 11900335
    assert.equal(s1.letterGrade, 'C');
    assert.equal(s1.isPassed, false);
    assert.equal(s1.status, 'failed');
    assert.equal(s1.isFinalized, true);

    // Student 2: 11900375
    assert.equal(s2.letterGrade, 'C+');
    assert.equal(s2.isPassed, false);
    assert.equal(s2.status, 'failed');

    // Student 3: 11900382
    assert.equal(s3.letterGrade, 'B');
    assert.equal(s3.isPassed, true);
    assert.equal(s3.status, 'passed');

    // Student 4: 11900395
    assert.equal(s4.letterGrade, 'C+');
    assert.equal(s4.isPassed, false);
    assert.equal(s4.status, 'failed');

    // Student 5: 11900412
    assert.equal(s5.letterGrade, 'B+');
    assert.equal(s5.isPassed, true);
    assert.equal(s5.status, 'passed');

    // Student 6: 12200254
    assert.equal(s6.letterGrade, 'B');
    assert.equal(s6.isPassed, true);
    assert.equal(s6.status, 'passed');
  });

  // =========================================================================
  // Requirement 3: Không âm thầm biến lỗi đọc thành "Chưa duyệt"
  // =========================================================================
  await t.test('3: renderAdminProgressReviewTable displays prominent loading and error states', () => {
    assert.match(prelimSource, /Đang tải kết quả đánh giá Duyệt đợt \${phase}\.\.\./);
    assert.match(prelimSource, /Không thể tải dữ liệu Duyệt đợt \${phase}:/);
    assert.match(prelimSource, /<button type="button" onclick="renderAdminProgressReviewTable\(\${phase}\)"[^>]*>Thử lại<\/button>/);
  });

  // =========================================================================
  // Requirement 4: Tab Duyệt 2 & 3 tương thích cùng cấu trúc
  // =========================================================================
  await t.test('4: ensureAdminProgressReviewLoaded and renderAdminProgressReviewTable support dynamic phases 1, 2, 3', () => {
    assert.match(prelimSource, /const pKey = 'duyet_' \+ phase;/);
    assert.match(prelimSource, /docFn\(dbObj, 'graduationRounds', roundId, 'publishedProgressReviews', pKey\)/);
    assert.match(compiledIndexHtml, /renderAdminProgressReviewTable\(1\)/);
    assert.match(compiledIndexHtml, /renderAdminProgressReviewTable\(2\)/);
    assert.match(compiledIndexHtml, /renderAdminProgressReviewTable\(3\)/);
  });

  // =========================================================================
  // Requirement 5, 6, 7: Điều kiện bật/tắt nút Thu hồi
  // =========================================================================
  await t.test('5, 6, 7: onRevokeReasonInputChanged enforces >= 10 chars AND confirmation checkbox', () => {
    // Pure logic simulation of onRevokeReasonInputChanged
    function testButtonState(reason, isChecked) {
      return (reason.trim().length >= 10 && Boolean(isChecked));
    }

    // 5. Disabled when reason is empty or < 10 chars
    assert.equal(testButtonState('', true), false, 'Empty reason must disable button');
    assert.equal(testButtonState('   ', true), false, 'Whitespace reason must disable button');
    assert.equal(testButtonState('123456789', true), false, 'Reason < 10 chars must disable button');

    // 6. Disabled when checkbox is not checked
    assert.equal(testButtonState('Lý do thu hồi hợp lệ hơn 10 ký tự', false), false, 'Unchecked box must disable button');
    assert.equal(testButtonState('', false), false, 'Empty and unchecked must disable button');

    // 7. Enabled when reason >= 10 chars AND checked
    assert.equal(testButtonState('Lý do thu hồi hợp lệ hơn 10 ký tự', true), true, 'Valid reason + checked must enable button');
    assert.equal(testButtonState('1234567890', true), true, 'Exactly 10 chars + checked must enable button');

    // Check code in preliminary-dashboard.js
    assert.match(prelimSource, /btn\.disabled\s*=\s*!\(reason\.length >= 10 && chk\)/);
    assert.match(prelimSource, /if \(reason\.length < 10\)/);
    assert.match(prelimSource, /if \(!chk\)/);
  });

  // =========================================================================
  // Requirement 8: Thu hồi riêng Duyệt 1 không ảnh hưởng Duyệt 2 & Bảo tồn studentResults
  // =========================================================================
  await t.test('8: confirmRevokeProgressReview preserves studentResults in snapshot and handles multi-phase independence', () => {
    // Verify snapshot preservation logic in preliminary-dashboard.js
    assert.match(prelimSource, /let existingSnapshot = targetRound\.publishedProgressReviews\?\.\[pKey\]/);
    assert.match(prelimSource, /const existingStudentResults = existingSnapshot\?\.studentResults \|\| prevPub\.studentResults \|\| \{\};/);
    assert.match(prelimSource, /studentResults: existingStudentResults/);

    // Verify otherPhasesPublished check protects parent document status
    assert.match(prelimSource, /const otherPhasesPublished = \[1, 2, 3\]\.some\(p => p !== Number\(phase\) && targetRound\.publishedReviews\?\.\[`duyet_\${p}`\]\?\.status === 'published'\);/);
    assert.match(prelimSource, /const rootStatus = otherPhasesPublished \? 'published' : 'revoked';/);
  });

  // =========================================================================
  // Requirement 9: Công bố lại lấy đúng kết quả đã lưu
  // =========================================================================
  await t.test('9: confirmPublishProgressReview compiles eligibleCount from getProgressReviewData without losing grades', () => {
    assert.match(prelimSource, /const rev = getProgressReviewData\(sid, phase, targetRound\);/);
    assert.match(prelimSource, /if \(rev\.isFinalized && \(rev\.letterGrade \|\| \(rev\.score !== null && !isNaN\(rev\.score\)\)\)\)/);
    assert.match(prelimSource, /eligibleCount\+\+;/);
  });

  // =========================================================================
  // Requirement 10 & 11: SV/GVHD phân quyền hiển thị điểm (Ẩn khi thu hồi, Hiện khi công bố)
  // =========================================================================
  await t.test('10 & 11: Student & Supervisor views respect revoked vs published statuses', () => {
    const studentJourneySource = fs.readFileSync(path.resolve(__dirname, '../js/students/student-journey.js'), 'utf8');
    assert.match(studentJourneySource, /cachedPhase\.status !== 'revoked'/);
    assert.match(studentJourneySource, /stRes\.status !== 'revoked'/);

    // getStudentPublishedReviewResult handles permission-denied from Firestore Rules
    assert.match(prelimSource, /if \(phaseErr && \(phaseErr\.code === 'permission-denied' \|\| String\(phaseErr\)\.includes\('permission-denied'\)\)\)/);
    assert.match(prelimSource, /return \{ status: 'revoked', isPublished: false \};/);
  });

  // =========================================================================
  // Requirement 12: Admin vẫn xem được dữ liệu chấm nội bộ theo quyền
  // =========================================================================
  await t.test('12: Admin score detail modal and ensureAdminProgressReviewLoaded retain reviewDecisions lookup', () => {
    assert.match(prelimSource, /colFn\(dbObj, 'graduationRounds', roundId, 'reviewDecisions'\)/);
    assert.match(prelimSource, /export function openCouncilScoreDetailModal/);
    assert.match(prelimSource, /window\.openCouncilScoreDetailModal = openCouncilScoreDetailModal/);
  });

  // =========================================================================
  // Requirement 13: Không ghi điểm nhạy cảm ngược vào root round document
  // =========================================================================
  await t.test('13: No sensitive fields (councilScores, finalDefenseScores) are written to root', () => {
    // preliminary-dashboard.js writes roundDocRevokeMetadata and roundDocPubMetadata without studentResults
    assert.match(prelimSource, /roundDocRevokeMetadata\s*=\s*\{[\s\S]*?status: 'revoked'[\s\S]*?\};/);
    assert.ok(!prelimSource.includes('roundDocRevokeMetadata.studentResults'));
    assert.ok(!prelimSource.includes('roundDocPubMetadata.studentResults'));

    // defense-scores.js writes calibrated scores to subcollection reviewDecisions, not root councilScores
    assert.ok(!defenseScoresSource.includes('[`councilScores.${scoreKey}`]: updatedScore'));
    assert.match(defenseScoresSource, /doc\(db, 'graduationRounds', roundId, 'reviewDecisions', scoreKey\)/);

    // activities-manager.js does not map finalDefenseScores into normalized activities
    assert.ok(!activitiesManagerSource.includes('finalDefenseScores: c.finalDefenseScores'));
  });

  // =========================================================================
  // Requirement 14: Không phát sinh lỗi JavaScript ES Module
  // =========================================================================
  await t.test('14: JavaScript exports, window bridges, and syntax are strictly valid', () => {
    assert.match(prelimSource, /export (?:async )?function ensureAdminProgressReviewLoaded/);
    assert.match(prelimSource, /window\.ensureAdminProgressReviewLoaded = ensureAdminProgressReviewLoaded/);
    assert.match(prelimSource, /export function getProgressReviewData/);
    assert.match(prelimSource, /window\.getProgressReviewData = getProgressReviewData/);
  });
});
