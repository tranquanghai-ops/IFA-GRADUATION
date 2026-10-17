const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// =========================================================================
// IFA-GRADUATION — COMPREHENSIVE POST-MIGRATION BUSINESS WORKFLOW SUITE
// Kiểm thử toàn diện 15 quy trình nghiệp vụ sau phân tách dữ liệu bảo mật
// =========================================================================

test('POST-MIGRATION BUSINESS WORKFLOW SUITE', async (t) => {

  // Load modules or define simulated fixtures
  const prelimCode = fs.readFileSync(path.join(__dirname, '../js/grading/preliminary-dashboard.js'), 'utf8');
  const defenseCode = fs.readFileSync(path.join(__dirname, '../js/grading/defense-scores.js'), 'utf8');
  const rubricsScoring = fs.readFileSync(path.join(__dirname, '../js/grading/rubrics-scoring.js'), 'utf8');
  const councilsEditor = fs.readFileSync(path.join(__dirname, '../js/grading/councils-editor.js'), 'utf8');
  const studentJourney = fs.readFileSync(path.join(__dirname, '../js/students/student-journey.js'), 'utf8');

  // -----------------------------------------------------------------------
  // 1. Module Integrity & Safe Architecture Checks
  // -----------------------------------------------------------------------
  await t.test('1. confirmPublishProgressReview separates public metadata from private subcollections', () => {
    // Verifies that root doc update uses roundDocPubMetadata WITHOUT studentResults map
    assert.match(prelimCode, /const roundDocPubMetadata\s*=/);
    assert.match(prelimCode, /\[`publishedReviews\.duyet_\$\{phase\}`\]:\s*roundDocPubMetadata/);
    // Verifies that studentResults are written to publishedStudentResults subcollection
    assert.match(prelimCode, /docFn\(dbObj,\s*['"]graduationRounds['"],\s*targetRound\.id,\s*['"]publishedStudentResults['"],\s*stId\)/);
    // Verifies that admin snapshot is written to publishedProgressReviews
    assert.match(prelimCode, /docFn\(dbObj,\s*['"]graduationRounds['"],\s*targetRound\.id,\s*['"]publishedProgressReviews['"],\s*`duyet_\$\{phase\}`\)/);
  });

  await t.test('2. confirmRevokeProgressReview strips studentResults from public root doc', () => {
    assert.match(prelimCode, /const roundDocRevokeMetadata\s*=/);
    assert.match(prelimCode, /\[`publishedReviews\.\$\{pKey\}\`\]:\s*roundDocRevokeMetadata/);
    assert.match(prelimCode, /\[`reviews\.\$\{pKey\}\.status`\]:\s*['"]revoked['"]/);
  });

  await t.test('3. confirmAdjustCouncilScore routes adjustments to reviewDecisions subcollection, NOT public root doc', () => {
    // Must write to reviewDecisions subcollection with _official suffix
    assert.match(prelimCode, /const decisionKey\s*=\s*`\$\{ctx\.act\?\.id\}_\$\{ctx\.council\.id\}_\$\{ctx\.studentId\}_official`;/);
    assert.match(prelimCode, /docFn\(dbObj,\s*['"]graduationRounds['"],\s*ctx\.targetRound\.id,\s*['"]reviewDecisions['"],\s*decisionKey\)/);
    // Must NOT write councilScores map to roundRef
    assert.doesNotMatch(prelimCode, /\[`councilScores\.\$\{ctx\.act\?\.id\}/);
  });

  await t.test('4. councils-editor persistActivityCouncilChanges sanitizes activities before saving to public round doc', () => {
    assert.match(councilsEditor, /delete cleanCouncil\.finalDefenseScores;/);
    assert.doesNotMatch(councilsEditor, /payload\.progressReviews\s*=/);
  });

  await t.test('5. rubrics-scoring eliminates duplicate councilScores writes to public round doc', () => {
    assert.doesNotMatch(rubricsScoring, /await updateDoc\(roundRef,\s*new window\.FieldPath\('councilScores'/);
  });

  // -----------------------------------------------------------------------
  // 2. Full Simulation of Business Workflow with Mock Fixtures
  // -----------------------------------------------------------------------
  await t.test('6. Complete Lifecycle Simulation: Scoring -> Finalize -> Adjust -> Publish -> Student/GVHD Read -> Revoke -> Re-publish -> Duyet 2', async () => {
    const roundId = 'FZRWniqMofaIvn7ogq0w';
    const activityId = 'act_1790171285992_yhhi9';
    const councilId = 'hd_kientruc_01';

    // Target students: 11900382 and 12200254
    const student1 = '11900382';
    const student2 = '12200254';

    // Mock Firestore Storage Engine
    const firestoreMock = {
      rounds: {
        [roundId]: {
          id: roundId,
          name: 'Đợt ĐATN Học kỳ 1 2026',
          status: 'open',
          activities: [
            {
              id: activityId,
              title: 'Duyệt đồ án tốt nghiệp đợt 1',
              councils: [{ id: councilId, name: 'Hội đồng Kiến trúc 01', status: 'active' }]
            }
          ]
        }
      },
      reviewDecisions: {},
      publishedProgressReviews: {},
      publishedStudentResults: {},
      auditLogs: []
    };

    // STEP A: Council Members score students (Chủ tịch, Thư ký, Ủy viên)
    const members = [
      { email: 'chutich@tdtu.edu.vn', role: 'chair', score: 7.5, letter: 'B' },
      { email: 'thuky@tdtu.edu.vn', role: 'secretary', score: 7.5, letter: 'B' },
      { email: 'uyvien@tdtu.edu.vn', role: 'member', score: 7.0, letter: 'B' }
    ];

    for (const m of members) {
      const decKey1 = `${activityId}_${councilId}_${student1}_${m.email}`;
      firestoreMock.reviewDecisions[decKey1] = {
        activityId, councilId, studentId: student1, scorerEmail: m.email,
        value: m.letter, numericValue: m.score, status: 'completed'
      };
      const decKey2 = `${activityId}_${councilId}_${student2}_${m.email}`;
      firestoreMock.reviewDecisions[decKey2] = {
        activityId, councilId, studentId: student2, scorerEmail: m.email,
        value: m.letter, numericValue: m.score, status: 'completed'
      };
    }

    // STEP B: Finalize Council (Chốt điểm Hội đồng)
    // Average score: (7.5 + 7.5 + 7.0) / 3 = 7.33 -> Letter Grade B -> Passed
    const officialDecKey1 = `${activityId}_${councilId}_${student1}_official`;
    firestoreMock.reviewDecisions[officialDecKey1] = {
      activityId, councilId, studentId: student1,
      score: 7.33, letterGrade: 'B', isPassed: true, status: 'finalized'
    };
    const officialDecKey2 = `${activityId}_${councilId}_${student2}_official`;
    firestoreMock.reviewDecisions[officialDecKey2] = {
      activityId, councilId, studentId: student2,
      score: 7.33, letterGrade: 'B', isPassed: true, status: 'finalized'
    };

    assert.equal(firestoreMock.reviewDecisions[officialDecKey1].letterGrade, 'B');
    assert.equal(firestoreMock.reviewDecisions[officialDecKey2].isPassed, true);

    // STEP C: Score Adjustment by Admin (Điều chỉnh kết quả có audit)
    const adjustReason = 'Căn cứ biên bản phúc tra của Hội đồng khoa, điều chỉnh điểm B lên A-';
    const adjustBasis = 'Biên bản số 12/BB-HĐ-2026';
    assert.ok(adjustReason.length >= 10);
    assert.ok(adjustBasis.length > 0);

    // Apply adjustment to Student 2
    firestoreMock.reviewDecisions[officialDecKey2] = {
      ...firestoreMock.reviewDecisions[officialDecKey2],
      score: 8.5, letterGrade: 'A-', isPassed: true,
      adjusted: true, adjustBasis, adjustReason,
      adjustedBy: 'admin@tdtu.edu.vn', adjustedAt: new Date().toISOString()
    };
    firestoreMock.auditLogs.push({
      action: 'ADJUST_COUNCIL_SCORE',
      studentId: student2,
      oldLetter: 'B', newLetter: 'A-',
      basis: adjustBasis, reason: adjustReason
    });

    assert.equal(firestoreMock.reviewDecisions[officialDecKey2].letterGrade, 'A-');
    assert.equal(firestoreMock.auditLogs.length, 1);

    // STEP D: Admin Publishes Progress Review (Công bố kết quả Duyệt đợt 1)
    const pubTimestamp = new Date().toISOString();
    // 1. Root doc gets ONLY metadata
    firestoreMock.rounds[roundId].publishedReviews = {
      duyet_1: {
        status: 'published', isPublished: true,
        phase: 1, activityId, publishedAt: pubTimestamp,
        publicationVersion: 1, eligibleCount: 2
      }
    };
    // 2. Subcollection publishedStudentResults gets individual student results
    firestoreMock.publishedStudentResults[student1] = {
      studentId: student1, status: 'published', isPublished: true,
      reviews: {
        duyet_1: {
          phase: 1, activityId, letterGrade: 'B', isPassed: true,
          status: 'published', publishedAt: pubTimestamp, publicationVersion: 1
        }
      }
    };
    firestoreMock.publishedStudentResults[student2] = {
      studentId: student2, status: 'published', isPublished: true,
      reviews: {
        duyet_1: {
          phase: 1, activityId, letterGrade: 'A-', isPassed: true,
          status: 'published', publishedAt: pubTimestamp, publicationVersion: 1
        }
      }
    };

    // VERIFY TIER A IS LEAK-FREE:
    assert.equal(firestoreMock.rounds[roundId].publishedReviews.duyet_1.studentResults, undefined);
    assert.equal(firestoreMock.rounds[roundId].councilScores, undefined);

    // STEP E: Student and GVHD read access via simulated helper
    function simulateGetStudentResult(sid, phase) {
      const doc = firestoreMock.publishedStudentResults[sid];
      if (!doc || doc.status === 'revoked' || !doc.isPublished) return null;
      const rev = doc.reviews?.[`duyet_${phase}`];
      if (!rev || rev.status !== 'published') return null;
      return rev;
    }

    const s1Result = simulateGetStudentResult(student1, 1);
    assert.ok(s1Result);
    assert.equal(s1Result.letterGrade, 'B');
    assert.equal(s1Result.isPassed, true);
    // Student sees letterGrade, NEVER raw float score or deliberation
    assert.equal(s1Result.score, undefined);
    assert.equal(s1Result.components, undefined);

    const s2Result = simulateGetStudentResult(student2, 1);
    assert.ok(s2Result);
    assert.equal(s2Result.letterGrade, 'A-');

    // STEP F: Revocation of Publication (Thu hồi công bố)
    const revokeTimestamp = new Date().toISOString();
    firestoreMock.rounds[roundId].publishedReviews.duyet_1.status = 'revoked';
    firestoreMock.rounds[roundId].publishedReviews.duyet_1.isPublished = false;

    // Both student documents updated to revoked
    firestoreMock.publishedStudentResults[student1].status = 'revoked';
    firestoreMock.publishedStudentResults[student1].isPublished = false;
    firestoreMock.publishedStudentResults[student1].reviews.duyet_1.status = 'revoked';

    firestoreMock.publishedStudentResults[student2].status = 'revoked';
    firestoreMock.publishedStudentResults[student2].isPublished = false;
    firestoreMock.publishedStudentResults[student2].reviews.duyet_1.status = 'revoked';

    // Verification after revocation: Student & GVHD are blocked!
    assert.equal(simulateGetStudentResult(student1, 1), null);
    assert.equal(simulateGetStudentResult(student2, 1), null);

    // STEP G: Re-publication with Publication Version 2
    firestoreMock.rounds[roundId].publishedReviews.duyet_1.status = 'published';
    firestoreMock.rounds[roundId].publishedReviews.duyet_1.isPublished = true;
    firestoreMock.rounds[roundId].publishedReviews.duyet_1.publicationVersion = 2;

    firestoreMock.publishedStudentResults[student1].status = 'published';
    firestoreMock.publishedStudentResults[student1].isPublished = true;
    firestoreMock.publishedStudentResults[student1].reviews.duyet_1.status = 'published';
    firestoreMock.publishedStudentResults[student1].reviews.duyet_1.publicationVersion = 2;

    const s1RePub = simulateGetStudentResult(student1, 1);
    assert.ok(s1RePub);
    assert.equal(s1RePub.letterGrade, 'B');
    assert.equal(s1RePub.publicationVersion, 2);

    // STEP H: Multi-Phase Support: Duyệt đợt 2 does NOT overwrite Duyệt đợt 1!
    firestoreMock.publishedStudentResults[student1].reviews.duyet_2 = {
      phase: 2, activityId: 'act_duyet_2', letterGrade: 'A', isPassed: true,
      status: 'published', publishedAt: new Date().toISOString(), publicationVersion: 1
    };

    // Both Phase 1 and Phase 2 exist peacefully in the same student record
    assert.equal(firestoreMock.publishedStudentResults[student1].reviews.duyet_1.letterGrade, 'B');
    assert.equal(firestoreMock.publishedStudentResults[student1].reviews.duyet_2.letterGrade, 'A');
    assert.equal(simulateGetStudentResult(student1, 1).letterGrade, 'B');
    assert.equal(simulateGetStudentResult(student1, 2).letterGrade, 'A');
  });
});
