const { test } = require('node:test');
const assert = require('node:assert/strict');

// Import the schedule copier module dynamically via ESM
async function getCopier() {
  return await import('../js/rounds/rounds-schedule-copier.js');
}

test('1. Date Parsing & Vietnam Monday snapping', async (t) => {
  const { parseDateToVietnamComponents, getVietnamMonday } = await getCopier();

  await t.test('1.1. Parses YYYY-MM-DD correctly', () => {
    const p = parseDateToVietnamComponents('2026-03-20');
    assert.equal(p.year, 2026);
    assert.equal(p.month, 3);
    assert.equal(p.date, 20);
    assert.equal(p.dayOfWeek, 4); // Friday
  });

  await t.test('1.2. Parses ISO with +07:00 offset correctly', () => {
    const p = parseDateToVietnamComponents('2026-03-20T08:30:00+07:00');
    assert.equal(p.year, 2026);
    assert.equal(p.month, 3);
    assert.equal(p.date, 20);
    assert.equal(p.hours, 8);
    assert.equal(p.minutes, 30);
    assert.equal(p.dayOfWeek, 4);
  });

  await t.test('1.3. getVietnamMonday snaps any day of week to Monday', () => {
    // 2026-03-20 is Friday -> Monday is 2026-03-16
    const m1 = getVietnamMonday('2026-03-20');
    assert.equal(m1.dateStr, '2026-03-16');

    // 2026-03-22 is Sunday -> Monday is 2026-03-16
    const m2 = getVietnamMonday('2026-03-22');
    assert.equal(m2.dateStr, '2026-03-16');

    // 2026-03-16 is Monday -> remains 2026-03-16
    const m3 = getVietnamMonday('2026-03-16');
    assert.equal(m3.dateStr, '2026-03-16');
  });
});

test('2. Schedule Shifting: Preserving Week 4/8/12, Weekday & Hours', async (t) => {
  const { calculateShiftedRoundSchedule } = await getCopier();

  // Source round setup:
  // Starts Monday 2025-09-01 (Week 1)
  // Duyệt 1: Friday of Week 4 (2025-09-26 08:00 - 17:00, deadline 2025-09-25 23:59, open 2025-09-22 08:00)
  // Duyệt 2: Friday of Week 8 (2025-10-24 08:00 - 17:00)
  // Duyệt 3: Friday of Week 12 (2025-11-21 08:00 - 17:00)
  const sourceRound = {
    id: 'round_2025_hk1',
    title: 'Đồ án Tốt nghiệp - Đợt 1 (2025-2026)',
    academicYear: '2025-2026',
    slug: 'dot-1-2025-2026',
    startDate: '2025-09-01',
    durationWeeks: 12,
    preferenceCount: 3,
    selectionMode: 'cards',
    supervisorAssignmentMode: 'student_preference',
    driveSubfolderNames: ['01 - Ho so', '02 - Phuc khao'],
    driveRootFolderId: 'REAL_DRIVE_FOLDER_ID_123',
    activities: [
      {
        id: 'act_src_duyet_1',
        title: 'Duyệt đợt 1',
        activityType: 'review',
        order: 1,
        startAt: '2025-09-26T08:00:00+07:00',
        endAt: '2025-09-26T17:00:00+07:00',
        submissionEnabled: true,
        submissionConfig: {
          openAt: '2025-09-22T08:00:00+07:00',
          deadlineAt: '2025-09-25T23:59:00+07:00',
          maxFiles: 5,
          driveFolderId: 'SUBMISSION_DRIVE_SRC_ID_456'
        },
        submissions: [{ id: 'sub_1', studentId: '5190001' }],
        scores: [{ studentId: '5190001', score: 8.5 }],
        councils: [{ councilId: 'hd_1', members: ['gv1@tdtu.edu.vn'] }]
      },
      {
        id: 'act_src_duyet_2',
        title: 'Duyệt đợt 2',
        activityType: 'review',
        order: 2,
        startAt: '2025-10-24T08:00:00+07:00',
        endAt: '2025-10-24T17:00:00+07:00'
      },
      {
        id: 'act_src_duyet_3',
        title: 'Duyệt đợt 3',
        activityType: 'review',
        order: 3,
        startAt: '2025-11-21T08:00:00+07:00',
        endAt: '2025-11-21T17:00:00+07:00'
      }
    ]
  };

  // Target: New round starting on Monday 2026-02-02
  const targetStartDate = '2026-02-02';
  const result = calculateShiftedRoundSchedule(sourceRound, targetStartDate);

  await t.test('2.1. Basic round dates & duration calculated correctly', () => {
    assert.equal(result.newStartDate, '2026-02-02');
    assert.equal(result.durationWeeks, 12);
    // Sunday of week 12: 2026-02-02 + 12*7 - 1 days = 2026-04-26
    assert.equal(result.newEndDate, '2026-04-26');
  });

  await t.test('2.2. Duyệt 1 is accurately shifted to Friday of Week 4', () => {
    const d1 = result.activities.find(a => a.title === 'Duyệt đợt 1');
    assert.ok(d1, 'Duyệt 1 must exist');
    assert.equal(d1.computedWeek, 4, 'Duyệt 1 must be in Week 4');
    // Week 4 Monday is 2026-02-23; Friday is 2026-02-27
    assert.equal(d1.startAt, '2026-02-27T08:00:00+07:00', 'Council startAt must be Friday 08:00');
    assert.equal(d1.endAt, '2026-02-27T17:00:00+07:00', 'Council endAt must be Friday 17:00');

    // Submission window
    assert.equal(d1.submissionConfig.openAt, '2026-02-23T08:00:00+07:00', 'Open must be Monday 08:00 of Week 4');
    assert.equal(d1.submissionConfig.deadlineAt, '2026-02-26T23:59:00+07:00', 'Deadline must be Thursday 23:59 of Week 4');
  });

  await t.test('2.3. Duyệt 2 is accurately shifted to Friday of Week 8', () => {
    const d2 = result.activities.find(a => a.title === 'Duyệt đợt 2');
    assert.ok(d2, 'Duyệt 2 must exist');
    assert.equal(d2.computedWeek, 8, 'Duyệt 2 must be in Week 8');
    // Week 8 Friday: 2026-02-02 + 7*7 + 4 = 2026-03-27
    assert.equal(d2.startAt, '2026-03-27T08:00:00+07:00', 'Duyệt 2 must be Friday 08:00');
    assert.equal(d2.endAt, '2026-03-27T17:00:00+07:00', 'Duyệt 2 must be Friday 17:00');
  });

  await t.test('2.4. Duyệt 3 is accurately shifted to Friday of Week 12', () => {
    const d3 = result.activities.find(a => a.title === 'Duyệt đợt 3');
    assert.ok(d3, 'Duyệt 3 must exist');
    assert.equal(d3.computedWeek, 12, 'Duyệt 3 must be in Week 12');
    // Week 12 Friday: 2026-02-02 + 11*7 + 4 = 2026-04-24
    assert.equal(d3.startAt, '2026-04-24T08:00:00+07:00', 'Duyệt 3 must be Friday 08:00');
    assert.equal(d3.endAt, '2026-04-24T17:00:00+07:00', 'Duyệt 3 must be Friday 17:00');
  });

  await t.test('2.5. Strict Data Isolation: Excludes runtime data and concrete Drive IDs', () => {
    const d1 = result.activities.find(a => a.title === 'Duyệt đợt 1');
    assert.notEqual(d1.id, 'act_src_duyet_1', 'Activity ID must be new');
    assert.equal(d1.submissions, undefined, 'Submissions must be removed');
    assert.equal(d1.scores, undefined, 'Scores must be removed');
    assert.deepEqual(d1.councils, [], 'Councils array must be empty');
    assert.equal(d1.submissionConfig.driveFolderId, null, 'Drive folder ID must be null');
    assert.equal(d1.driveFolderId, null, 'Root activity driveFolderId must be null');
    assert.equal(d1.publicationStatus, 'draft', 'Must start in draft status');
    assert.equal(d1.visibility, false, 'Must start hidden');
  });

  await t.test('2.6. Source round remains completely immutable', () => {
    assert.equal(sourceRound.activities[0].submissions.length, 1);
    assert.equal(sourceRound.activities[0].scores.length, 1);
    assert.equal(sourceRound.activities[0].submissionConfig.driveFolderId, 'SUBMISSION_DRIVE_SRC_ID_456');
    assert.equal(sourceRound.activities[0].startAt, '2025-09-26T08:00:00+07:00');
  });
});
