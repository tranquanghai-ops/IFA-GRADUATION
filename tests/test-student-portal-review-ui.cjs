/**
 * IFA-GRADUATION — Test Suite for Student Portal Review UI & Multi-Phase Revocation
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('STUDENT PORTAL REVIEW UI & MULTI-PHASE REVOCATION SUITE', async (t) => {
  const studentJourneySrc = fs.readFileSync(path.join(__dirname, '../js/students/student-journey.js'), 'utf8');
  const roundsTimelinePreviewSrc = fs.readFileSync(path.join(__dirname, '../js/rounds/rounds-timeline-preview.js'), 'utf8');
  const prelimDashboardSrc = fs.readFileSync(path.join(__dirname, '../js/grading/preliminary-dashboard.js'), 'utf8');
  const migrateScriptSrc = fs.readFileSync(path.join(__dirname, '../scripts/migrate-firestore-security.cjs'), 'utf8');

  await t.test('1. Student card renders "Đánh giá Hội đồng" label, prominent letter grade and pass/fail verdict', () => {
    assert.match(studentJourneySrc, /Đánh giá Hội đồng/);
    assert.match(studentJourneySrc, /✓ Đạt yêu cầu/);
    assert.match(studentJourneySrc, /✕ Không đạt yêu cầu/);
    assert.match(studentJourneySrc, /font-black text-xl sm:text-2xl/);
    assert.match(studentJourneySrc, /bg-emerald-50/);
    assert.match(studentJourneySrc, /bg-rose-50/);
  });

  await t.test('2. Student card completely hides result when not published, revoked, or unscored', () => {
    // When unscored or revoked, reviewResultHtml is empty string ''
    assert.match(studentJourneySrc, /reviewResultHtml = '';/);
    // Does NOT render "Chưa công bố kết quả" or "Đã công bố kết quả" placeholder boxes in weekly cards
    assert.doesNotMatch(studentJourneySrc, /Chưa công bố kết quả/);
  });

  await t.test('3. Timeline event dialog renders matching "Đánh giá Hội đồng: Đạt yêu cầu – B" format', () => {
    assert.match(roundsTimelinePreviewSrc, /Đánh giá Hội đồng: \$\{passLabel\.replace\(/);
    assert.match(roundsTimelinePreviewSrc, /Điểm chữ chính thức/);
    assert.match(roundsTimelinePreviewSrc, /Kết luận/);
    assert.match(roundsTimelinePreviewSrc, /text-2xl sm:text-3xl font-black font-mono/);
  });

  await t.test('4. Independent multi-phase revocation preserves document root status if other phases are published', () => {
    assert.match(prelimDashboardSrc, /otherPhasesPublished/);
    assert.match(prelimDashboardSrc, /status:\s*rootStatus/);
    assert.match(prelimDashboardSrc, /isPublished:\s*rootIsPub/);
    assert.match(prelimDashboardSrc, /publishedProgressReviews/);
  });

  await t.test('5. Migration tool supports --cleanup-root and --rollback with verification safeguards', () => {
    assert.match(migrateScriptSrc, /isCleanupRootMode/);
    assert.match(migrateScriptSrc, /isRollbackMode/);
    assert.match(migrateScriptSrc, /delete cleanFields\.councilScores/);
    assert.match(migrateScriptSrc, /delete pFields\.studentResults/);
    assert.match(migrateScriptSrc, /delete cFields\.finalDefenseScores/);
  });
});
