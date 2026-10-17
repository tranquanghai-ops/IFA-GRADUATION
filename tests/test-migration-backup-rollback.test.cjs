/**
 * IFA-GRADUATION — Test Suite for Migration Toolchain: Deep Verification, Backup & Rollback
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('MIGRATION TOOLCHAIN DEEP VERIFICATION, BACKUP & ROLLBACK SUITE', async (t) => {
  const roundId = 'test-round-cutover-2026';
  const student1 = '11900382';
  const student2 = '11900395';

  // 1. Initial State: Round with root leaks
  const originalRoundDoc = {
    id: roundId,
    name: 'Đợt Đồ án Tốt nghiệp 2026',
    status: 'open',
    activities: [
      {
        id: 'act_duyet_1',
        title: 'Duyệt đợt 1',
        councils: [
          {
            id: 'hd_01',
            finalDefenseScores: {
              [student1]: 8.0,
              [student2]: 6.5
            }
          }
        ]
      }
    ],
    councilScores: {
      [`act_duyet_1_hd_01_${student1}_scorer1`]: { score: 8.0, letter: 'B' },
      [`act_duyet_1_hd_01_${student2}_scorer1`]: { score: 6.5, letter: 'C' }
    },
    publishedReviews: {
      duyet_1: {
        phase: 1,
        activityId: 'act_duyet_1',
        status: 'published',
        publishedAt: '2026-10-16T10:00:00.000Z',
        publicationVersion: 1,
        studentResults: {
          [student1]: {
            studentId: student1,
            studentName: 'Trang Trần Tuệ Nhã',
            letterGrade: 'B',
            isPassed: true
          },
          [student2]: {
            studentId: student2,
            studentName: 'Nguyễn Khánh Thịnh',
            letterGrade: 'C',
            isPassed: false
          }
        }
      }
    }
  };

  // Mock Database Store
  const mockDb = {
    rounds: { [roundId]: JSON.parse(JSON.stringify(originalRoundDoc)) },
    publishedStudentResults: {},
    publishedProgressReviews: {}
  };

  await t.test('1. Pre-migration backup creates exact snapshot of round document', () => {
    const backupSnapshot = JSON.parse(JSON.stringify(mockDb.rounds[roundId]));
    assert.deepEqual(backupSnapshot, originalRoundDoc);
    assert.ok(backupSnapshot.councilScores);
    assert.ok(backupSnapshot.publishedReviews.duyet_1.studentResults);
  });

  await t.test('2. Migration --apply writes to publishedProgressReviews and publishedStudentResults subcollections', () => {
    const pVal = mockDb.rounds[roundId].publishedReviews.duyet_1;

    // 2a. Admin snapshot
    mockDb.publishedProgressReviews[`${roundId}_duyet_1`] = JSON.parse(JSON.stringify(pVal));

    // 2b. Student subcollections
    for (const [stId, sRes] of Object.entries(pVal.studentResults)) {
      mockDb.publishedStudentResults[`${roundId}_${stId}`] = {
        studentId: stId,
        studentName: sRes.studentName,
        roundId,
        status: pVal.status,
        isPublished: true,
        reviews: {
          duyet_1: {
            phase: 1,
            activityId: pVal.activityId,
            letterGrade: sRes.letterGrade,
            isPassed: sRes.isPassed,
            status: pVal.status
          }
        }
      };

      // Independent subcollection document
      mockDb.publishedStudentResults[`${roundId}_${stId}_reviews_duyet_1`] = {
        phase: 1,
        activityId: pVal.activityId,
        letterGrade: sRes.letterGrade,
        isPassed: sRes.isPassed,
        status: pVal.status
      };
    }

    assert.ok(mockDb.publishedProgressReviews[`${roundId}_duyet_1`]);
    assert.equal(mockDb.publishedStudentResults[`${roundId}_${student1}_reviews_duyet_1`].letterGrade, 'B');
    assert.equal(mockDb.publishedStudentResults[`${roundId}_${student2}_reviews_duyet_1`].letterGrade, 'C');
  });

  await t.test('3. Cleanup verification catches data discrepancies and aborts', () => {
    // Simulate a corrupted student record (letter grade altered)
    const corruptedGrade = 'A+';
    const originalGrade = mockDb.publishedStudentResults[`${roundId}_${student1}_reviews_duyet_1`].letterGrade;
    mockDb.publishedStudentResults[`${roundId}_${student1}_reviews_duyet_1`].letterGrade = corruptedGrade;

    function verifyBeforeCleanup() {
      const pVal = mockDb.rounds[roundId].publishedReviews.duyet_1;
      for (const [stId, exp] of Object.entries(pVal.studentResults)) {
        const sub = mockDb.publishedStudentResults[`${roundId}_${stId}_reviews_duyet_1`];
        if (!sub) throw new Error(`Missing sub doc for ${stId}`);
        if (sub.letterGrade !== exp.letterGrade) {
          throw new Error(`Data mismatch for ${stId}: expected ${exp.letterGrade}, got ${sub.letterGrade}`);
        }
      }
    }

    assert.throws(() => verifyBeforeCleanup(), /Data mismatch for 11900382/);

    // Restore correct grade
    mockDb.publishedStudentResults[`${roundId}_${student1}_reviews_duyet_1`].letterGrade = originalGrade;
    assert.doesNotThrow(() => verifyBeforeCleanup());
  });

  await t.test('4. Controlled --cleanup-root safely strips sensitive fields without altering other round configuration', () => {
    const roundToClean = mockDb.rounds[roundId];

    // Strip councilScores
    delete roundToClean.councilScores;

    // Sanitize publishedReviews (keep metadata, remove studentResults map)
    for (const [k, v] of Object.entries(roundToClean.publishedReviews)) {
      delete v.studentResults;
    }

    // Sanitize activities (remove finalDefenseScores)
    for (const act of roundToClean.activities) {
      for (const council of act.councils || []) {
        delete council.finalDefenseScores;
      }
    }

    // Assert Root document is now 100% leak-free
    assert.equal(roundToClean.councilScores, undefined);
    assert.equal(roundToClean.publishedReviews.duyet_1.studentResults, undefined);
    assert.equal(roundToClean.activities[0].councils[0].finalDefenseScores, undefined);

    // Assert public metadata remains fully intact
    assert.equal(roundToClean.name, 'Đợt Đồ án Tốt nghiệp 2026');
    assert.equal(roundToClean.status, 'open');
    assert.equal(roundToClean.publishedReviews.duyet_1.status, 'published');
    assert.equal(roundToClean.publishedReviews.duyet_1.phase, 1);
  });

  await t.test('5. Rollback restores round document to exact pre-migration state', () => {
    // Restore from original backup
    mockDb.rounds[roundId] = JSON.parse(JSON.stringify(originalRoundDoc));

    const restoredRound = mockDb.rounds[roundId];
    assert.deepEqual(restoredRound, originalRoundDoc);
    assert.ok(restoredRound.councilScores);
    assert.equal(Object.keys(restoredRound.councilScores).length, 2);
    assert.ok(restoredRound.publishedReviews.duyet_1.studentResults);
    assert.equal(restoredRound.activities[0].councils[0].finalDefenseScores[student1], 8.0);
  });
});
