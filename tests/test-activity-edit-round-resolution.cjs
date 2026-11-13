const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Activity Edit & Milestone Round Resolution Resilience', async (t) => {
  const activitiesMgrCode = fs.readFileSync(path.join(__dirname, '../js/planning/activities-manager.js'), 'utf8');
  const previewCode = fs.readFileSync(path.join(__dirname, '../js/rounds/rounds-timeline-preview.js'), 'utf8');
  const driveFilesCode = fs.readFileSync(path.join(__dirname, '../js/drive/drive-files.js'), 'utf8');

  await t.test('1. activities-manager.js exports findActivityAndRound helper', () => {
    assert.match(activitiesMgrCode, /export async function findActivityAndRound/);
  });

  await t.test('2. editActivityModal accepts optRoundId and uses findActivityAndRound', () => {
    assert.match(activitiesMgrCode, /window\.editActivityModal\s*=\s*async function\(actId,\s*optRoundId\s*=\s*null\)/);
    assert.match(activitiesMgrCode, /await findActivityAndRound\(actId,\s*optRoundId\)/);
  });

  await t.test('3. editActivityModal automatically closes open timeline event popup first', () => {
    assert.match(activitiesMgrCode, /window\.closeStudentTimelineEvent\(\)/);
  });

  await t.test('4. rounds-timeline-preview.js passes roundId to editActivityModal in both timeline view and day popup', () => {
    assert.match(previewCode, /editActivityModal\('\$\{escapeHtml\(event\.activityId\)\}',\s*'\$\{escapeHtml\(roundId\s*\|\|\s*''\)\}'\)/);
  });

  await t.test('5. copyActivityModal, duplicateActivityWithinRound, deleteActivity use findActivityAndRound', () => {
    assert.match(activitiesMgrCode, /window\.copyActivityModal\s*=\s*async function/);
    assert.match(activitiesMgrCode, /window\.duplicateActivityWithinRound\s*=\s*async function/);
    assert.match(activitiesMgrCode, /window\.deleteActivity\s*=\s*async function/);
  });

  await t.test('6. openActivitySubmissionDashboard searches across all rounds if actId not in target round', () => {
    assert.match(driveFilesCode, /String\(a\.id\)\s*===\s*String\(actId\)/);
  });

  await t.test('7. Logic Simulation: findActivityAndRound resolves activity across different rounds in memory', async () => {
    // Setup isolated mock environment
    const state = {
      rounds: [
        {
          id: 'round-1',
          title: 'Đợt 1/2026',
          activities: [
            { id: 'act-101', title: 'Nộp thuyết minh', roundId: 'round-1' }
          ]
        },
        {
          id: 'round-2',
          title: 'Đợt 2/2026',
          activities: [
            { id: 'act-202', title: 'DUYỆT ĐỒ ÁN TỐT NGHIỆP ĐỢT 2', roundId: 'round-2' }
          ]
        }
      ],
      selectedRoundId: 'round-1' // Admin select is pointing to round-1
    };

    // Simulate findActivityAndRound logic
    async function simFindActivityAndRound(actId, explicitRoundId = null) {
      if (!actId) return { act: null, targetRound: null, roundId: null };
      const targetIdStr = String(actId).trim();
      let roundId = explicitRoundId || null;
      let targetRound = null;
      let act = null;

      if (roundId) {
        targetRound = (state.rounds || []).find(r => r.id === roundId);
        act = (targetRound?.activities || []).find(a => String(a.id) === targetIdStr);
      }

      if (!act) {
        const selRoundId = state.selectedRoundId;
        if (selRoundId) {
          const candidateRound = (state.rounds || []).find(r => r.id === selRoundId);
          const candidateList = candidateRound?.activities || [];
          const found = candidateList.find(a => String(a.id) === targetIdStr);
          if (found) {
            act = found;
            roundId = selRoundId;
            targetRound = candidateRound;
          }
        }
      }

      if (!act) {
        for (const r of (state.rounds || [])) {
          const found = (r.activities || []).find(a => String(a.id) === targetIdStr);
          if (found) {
            act = found;
            targetRound = r;
            roundId = r.id;
            break;
          }
        }
      }

      return { act, targetRound, roundId: roundId || targetRound?.id || null };
    }

    // Case A: When explicit roundId is passed (from day popup or timeline preview)
    const resultA = await simFindActivityAndRound('act-202', 'round-2');
    assert.ok(resultA.act, 'Should find activity with explicit roundId');
    assert.equal(resultA.act.title, 'DUYỆT ĐỒ ÁN TỐT NGHIỆP ĐỢT 2');
    assert.equal(resultA.roundId, 'round-2');

    // Case B: When explicit roundId is NOT passed, but selectedRoundId points to round-1
    // It should seamlessly search across all rounds and find round-2!
    const resultB = await simFindActivityAndRound('act-202', null);
    assert.ok(resultB.act, 'Should find activity across rounds when select is on another round');
    assert.equal(resultB.act.title, 'DUYỆT ĐỒ ÁN TỐT NGHIỆP ĐỢT 2');
    assert.equal(resultB.roundId, 'round-2');
    assert.equal(resultB.targetRound.id, 'round-2');

    // Case C: Numeric id vs String id
    const stateNum = {
      rounds: [
        {
          id: 'round-num',
          activities: [{ id: 998877, title: 'Numeric ID Milestone' }]
        }
      ]
    };
    state.rounds.push(...stateNum.rounds);
    const resultC = await simFindActivityAndRound('998877');
    assert.ok(resultC.act, 'Should match numeric ID when searched by string');
    assert.equal(resultC.act.title, 'Numeric ID Milestone');
  });
});
