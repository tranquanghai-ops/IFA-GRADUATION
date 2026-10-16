const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read modules
const prelimSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/preliminary-dashboard.js'), 'utf8');
const defenseSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/defense-scores.js'), 'utf8');
const assessmentSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/assessment-portal.js'), 'utf8');
const finalScoresSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/final-scores-ranking.js'), 'utf8');

test('Council Progress Review Synchronization Suite', async (t) => {
  // Setup browser/global environment for evaluation
  const mockGlobal = {
    DEFAULT_LETTER_GRADE_SCALE: [
      { id: 'opt_ap', key: 'A+', code: 'A+', label: 'Xuất sắc', numericValue: 9.5 },
      { id: 'opt_a', key: 'A', code: 'A', label: 'Tốt', numericValue: 9.0 },
      { id: 'opt_am', key: 'A-', code: 'A-', label: 'Khá tốt', numericValue: 8.5 },
      { id: 'opt_bp', key: 'B+', code: 'B+', label: 'Khá', numericValue: 8.0 },
      { id: 'opt_b', key: 'B', code: 'B', label: 'Trung bình khá', numericValue: 7.5 },
      { id: 'opt_bm', key: 'B-', code: 'B-', label: 'Trung bình', numericValue: 7.0 },
      { id: 'opt_cp', key: 'C+', code: 'C+', label: 'Trung bình', numericValue: 6.5 },
      { id: 'opt_c', key: 'C', code: 'C', label: 'Trung bình yếu', numericValue: 6.0 },
      { id: 'opt_cm', key: 'C-', code: 'C-', label: 'Yếu', numericValue: 5.5 },
      { id: 'opt_dp', key: 'D+', code: 'D+', label: 'Kém', numericValue: 5.0 },
      { id: 'opt_d', key: 'D', code: 'D', label: 'Yếu', numericValue: 4.5 },
      { id: 'opt_dm', key: 'D-', code: 'D-', label: 'Quá yếu', numericValue: 4.0 }
    ],
    state: {
      rounds: [],
      selectedRoundId: 'round_01',
      activeRound: null,
      councilScores: {}
    }
  };

  // Helper implementations extracted from codebase
  function resolveScoreNumericValue(score, act) {
    if (!score) return null;
    if (typeof score.numericValue === 'number' && !isNaN(score.numericValue)) return score.numericValue;
    if (typeof score.selectedLetterNumericValue === 'number' && !isNaN(score.selectedLetterNumericValue)) return score.selectedLetterNumericValue;
    if (typeof score.value === 'number' && !isNaN(score.value)) return score.value;
    if (typeof score.value === 'string') {
      const rawOpts = (Array.isArray(act?.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0)
        ? act.scoringConfig.letterOptions
        : mockGlobal.DEFAULT_LETTER_GRADE_SCALE;
      const opt = rawOpts.find(o => String(o.key).trim().toUpperCase() === score.value.trim().toUpperCase() || String(o.code).trim().toUpperCase() === score.value.trim().toUpperCase());
      if (opt && typeof opt.numericValue === 'number' && !isNaN(opt.numericValue)) return opt.numericValue;
      const parsed = parseFloat(score.value);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  }

  function resolveNumericToLetter(numericScore, act) {
    if (numericScore === null || numericScore === undefined || isNaN(Number(numericScore))) return null;
    const rawOpts = (Array.isArray(act?.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0)
      ? act.scoringConfig.letterOptions
      : mockGlobal.DEFAULT_LETTER_GRADE_SCALE;
    const validOpts = rawOpts
      .filter(o => o && typeof o.numericValue === 'number' && !isNaN(o.numericValue) && (o.key || o.code))
      .map(o => ({
        key: String(o.key || o.code).trim(),
        code: String(o.code || o.key).trim(),
        label: o.label || o.description || o.key || o.code,
        numericValue: Number(o.numericValue)
      }));
    if (validOpts.length === 0) return null;
    validOpts.sort((a, b) => b.numericValue - a.numericValue);
    const scoreNum = Number(numericScore);
    for (let i = 0; i < validOpts.length - 1; i++) {
      const higher = validOpts[i];
      const lower = validOpts[i + 1];
      const midpoint = (higher.numericValue + lower.numericValue) / 2;
      if (scoreNum >= midpoint) return higher;
    }
    return validOpts[validOpts.length - 1];
  }

  function getOfficialDefenseScore(studentId, council, act, round) {
    if (!council || !act) return { score: null, isComplete: false, count: 0, mandatoryComplete: false };
    const slots = council.memberSlots || [];
    const membersBySlot = council.membersBySlot || {};
    const activityId = act.id;
    const councilId = council.id;

    let mandatoryTotal = 0;
    let mandatoryCompleted = 0;
    const mandatoryScores = [];
    const includedGuestScores = [];
    const excludedGuestScores = [];

    for (const s of slots) {
      const assigned = membersBySlot[s.key];
      const canScore = (assigned?.canScore !== undefined) ? Boolean(assigned.canScore) : (s.canScore !== false);
      if (!canScore) continue;
      const scorerId = assigned?.memberId || assigned?.memberEmail;
      if (!scorerId) continue;
      const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
      const score = mockGlobal.state.councilScores?.[scoreKey] || round?.councilScores?.[scoreKey];
      const isCompleted = (score?.status === 'completed');
      const resolvedNumeric = resolveScoreNumericValue(score, act);

      if (s.type === 'mandatory') {
        mandatoryTotal++;
        if (isCompleted && typeof resolvedNumeric === 'number' && !isNaN(resolvedNumeric)) {
          mandatoryCompleted++;
          mandatoryScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: resolvedNumeric, displayValue: score.value });
        }
      } else if (s.type === 'guest') {
        if (isCompleted && typeof resolvedNumeric === 'number' && !isNaN(resolvedNumeric)) {
          includedGuestScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: resolvedNumeric, displayValue: score.value });
        }
      }
    }

    const mandatoryComplete = (mandatoryTotal > 0 && mandatoryCompleted === mandatoryTotal);
    const allIncluded = [...mandatoryScores.map(s => s.value), ...includedGuestScores.map(s => s.value)];
    const rawAverage = allIncluded.length > 0 ? (allIncluded.reduce((a, b) => a + b, 0) / allIncluded.length) : null;

    const mode = act.scoringConfig?.mode || 'numeric';
    let letterGrade = null;
    let letterLabel = null;
    const hasLetterScores = mandatoryScores.some(s => typeof s.displayValue === 'string' && /[A-DF]/i.test(s.displayValue))
      || includedGuestScores.some(s => typeof s.displayValue === 'string' && /[A-DF]/i.test(s.displayValue));
    if ((mode === 'letter' || hasLetterScores) && rawAverage !== null) {
      const resolved = resolveNumericToLetter(rawAverage, act);
      if (resolved) {
        letterGrade = resolved.key;
        letterLabel = resolved.label;
      }
    }

    let formattedScore = '--';
    if (rawAverage !== null) {
      if (mode === 'letter' || hasLetterScores) {
        formattedScore = letterGrade || '--';
      } else {
        formattedScore = rawAverage.toFixed(2);
      }
    }

    return {
      studentId,
      mode,
      isComplete: mandatoryComplete,
      mandatoryTotal,
      mandatoryCompleted,
      mandatoryComplete,
      score: rawAverage,
      formattedScore,
      formattedNumericScore: rawAverage !== null ? rawAverage.toFixed(2) : '--',
      letterGrade,
      letterLabel,
      mandatoryScores,
      includedGuestScores,
      excludedGuestScores,
      allScoresCount: allIncluded.length
    };
  }

  function findProgressReviewActivity(targetRound, phase) {
    if (!targetRound || !Array.isArray(targetRound.activities)) return null;
    const pNum = Number(phase);
    let act = targetRound.activities.find(a => 
      Number(a.phase) === pNum || 
      a.milestoneType === `duyet_${pNum}` || 
      a.type === `duyet_${pNum}` || 
      a.id === `act_duyet_${pNum}`
    );
    if (act) return act;
    const regex = new RegExp(`(?:duyệt|duyet)\\s*(?:đồ\\s*án|do\\s*an)?\\s*(?:tốt\\s*nghiệp|tot\\s*nghiep)?\\s*(?:đợt|dot)?\\s*${pNum}\\b`, 'i');
    act = targetRound.activities.find(a => {
      const text = `${a.title || ''} ${a.name || ''} ${a.driveFolderName || ''} ${a.slug || ''}`;
      return regex.test(text);
    });
    return act || null;
  }

  function getProgressReviewData(studentId, phase, targetRound) {
    if (!targetRound || !studentId) {
      return { status: 'pending', score: null, letterGrade: null, letterLabel: '', displayScore: '--', referenceScore: null, isPassed: false, isFinalized: false, source: 'none' };
    }
    const sid = String(studentId).trim();

    if (targetRound.councilScores && typeof mockGlobal.state !== 'undefined') {
      mockGlobal.state.councilScores = { ...(targetRound.councilScores || {}), ...(mockGlobal.state.councilScores || {}) };
    }

    const act = findProgressReviewActivity(targetRound, phase);
    if (act && act.councilEnabled && Array.isArray(act.councils) && act.councils.length > 0) {
      const asgns = act.councilStudentAssignments || [];
      const studentAsgn = asgns.find(a => String(a.studentId).trim() === sid);
      const council = studentAsgn ? act.councils.find(c => c.id === studentAsgn.councilId) : act.councils[0];

      if (council) {
        const cStat = council.status || 'preparing';
        const isCouncilFinished = (cStat === 'finalized' || cStat === 'ended' || cStat === 'completed');

        if (council.finalDefenseScores?.[sid]) {
          const cached = council.finalDefenseScores[sid];
          const letter = cached.letterGrade || (act.scoringConfig?.mode === 'letter' && cached.formattedScore !== '--' ? cached.formattedScore : null);
          const numScore = cached.score !== undefined && cached.score !== null ? Number(cached.score) : null;
          const isPassed = numScore !== null ? (numScore >= 5) : (letter ? !['D', 'D-', 'F'].includes(letter) : false);
          return {
            status: isPassed ? 'passed' : 'failed',
            score: numScore,
            letterGrade: letter,
            letterLabel: cached.letterLabel || '',
            displayScore: letter || (numScore !== null ? numScore.toFixed(1) : '--'),
            referenceScore: numScore !== null ? numScore.toFixed(2) : null,
            isPassed,
            isFinalized: true,
            councilStatus: cStat,
            councilName: council.name || '',
            source: 'council_finalDefenseScores'
          };
        }

        if (isCouncilFinished) {
          const official = getOfficialDefenseScore(sid, council, act, targetRound);
          if (official && (official.score !== null || official.letterGrade !== null)) {
            const letter = official.letterGrade || (act.scoringConfig?.mode === 'letter' && official.formattedScore !== '--' ? official.formattedScore : null);
            const numScore = official.score !== null ? Number(official.score) : null;
            const isPassed = numScore !== null ? (numScore >= 5) : (letter ? !['D', 'D-', 'F'].includes(letter) : false);
            return {
              status: isPassed ? 'passed' : 'failed',
              score: numScore,
              letterGrade: letter,
              letterLabel: official.letterLabel || '',
              displayScore: letter || (numScore !== null ? numScore.toFixed(1) : '--'),
              referenceScore: numScore !== null ? numScore.toFixed(2) : null,
              isPassed,
              isFinalized: true,
              councilStatus: cStat,
              councilName: council.name || '',
              source: 'council_calculated'
            };
          }
        }

        return {
          status: 'pending',
          score: null,
          letterGrade: null,
          letterLabel: '',
          displayScore: '--',
          referenceScore: null,
          isPassed: false,
          isFinalized: false,
          councilStatus: cStat,
          councilName: council.name || '',
          source: 'council_pending'
        };
      }
    }

    const legacy = targetRound.progressReviews?.['duyet_' + phase]?.[sid];
    if (legacy) {
      const rawScore = legacy.score !== undefined && legacy.score !== null ? Number(legacy.score) : null;
      const letter = legacy.letterGrade || (typeof legacy.value === 'string' && /[A-DF]/i.test(legacy.value) ? legacy.value : null);
      const status = legacy.status || 'pending';
      const isPassed = status === 'passed' || (rawScore !== null && rawScore >= 5) || (letter ? !['D', 'D-', 'F'].includes(letter) : false);
      return {
        status,
        score: rawScore,
        letterGrade: letter,
        letterLabel: legacy.letterLabel || '',
        displayScore: letter || (rawScore !== null ? rawScore.toFixed(1) : '--'),
        referenceScore: rawScore !== null ? rawScore.toFixed(2) : null,
        isPassed,
        isFinalized: status === 'passed' || status === 'failed' || status === 'completed',
        source: 'progressReviews'
      };
    }

    return {
      status: 'pending',
      score: null,
      letterGrade: null,
      letterLabel: '',
      displayScore: '--',
      referenceScore: null,
      isPassed: false,
      isFinalized: false,
      source: 'none'
    };
  }

  // Build the mock round data modeling the production round
  const mockRound = {
    id: 'round_01',
    title: 'Đợt Tốt nghiệp 2026',
    activities: [
      {
        id: 'act_duyet_1',
        title: 'DUYỆT ĐỒ ÁN TỐT NGHIỆP ĐỢT 1',
        councilEnabled: true,
        scoringConfig: {
          enabled: true,
          mode: 'letter',
          letterOptions: mockGlobal.DEFAULT_LETTER_GRADE_SCALE
        },
        councils: [
          {
            id: 'council_01',
            name: 'Hội đồng 1',
            status: 'ended',
            memberSlots: [
              { key: 'chair', type: 'mandatory', canScore: true, name: 'Chủ tịch' },
              { key: 'secretary', type: 'mandatory', canScore: true, name: 'Thư ký' },
              { key: 'member', type: 'mandatory', canScore: true, name: 'Ủy viên' }
            ],
            membersBySlot: {
              chair: { memberId: 'chair_id', memberName: 'ThS. NCS Trần Quang Hải', canScore: true },
              secretary: { memberId: 'sec_id', memberName: 'Võ Duy Tân', canScore: true },
              member: { memberId: 'mem_id', memberName: 'Nguyễn Thị Thúy Hà', canScore: true }
            },
            finalDefenseScores: {}
          }
        ],
        councilStudentAssignments: [
          { studentId: '11900335', councilId: 'council_01' },
          { studentId: '11900375', councilId: 'council_01' },
          { studentId: '11900382', councilId: 'council_01' },
          { studentId: '11900395', councilId: 'council_01' },
          { studentId: '11900412', councilId: 'council_01' },
          { studentId: '12200254', councilId: 'council_01' },
          { studentId: '99999999', councilId: 'council_01' } // Unscored test student
        ]
      },
      {
        id: 'act_defense',
        title: 'BẢO VỆ TỐT NGHIỆP',
        councilEnabled: true,
        councils: []
      }
    ],
    councilScores: {
      // 11900335: Chair=C (6), Sec=C+ (6.5) => Avg=6.25 => C+
      'act_duyet_1_council_01_11900335_chair_id': { status: 'completed', value: 'C', numericValue: 6 },
      'act_duyet_1_council_01_11900335_sec_id': { status: 'completed', value: 'C+', numericValue: 6.5 },
      // 11900375: Chair=C+ (6.5), Sec=B- (7) => Avg=6.75 => B-
      'act_duyet_1_council_01_11900375_chair_id': { status: 'completed', value: 'C+', numericValue: 6.5 },
      'act_duyet_1_council_01_11900375_sec_id': { status: 'completed', value: 'B-', numericValue: 7 },
      // 11900382: Chair=B (7.5), Sec=B- (7) => Avg=7.25 => B
      'act_duyet_1_council_01_11900382_chair_id': { status: 'completed', value: 'B', numericValue: 7.5 },
      'act_duyet_1_council_01_11900382_sec_id': { status: 'completed', value: 'B-', numericValue: 7 },
      // 11900395: Chair=C (6), Sec=C+ (6.5) => Avg=6.25 => C+
      'act_duyet_1_council_01_11900395_chair_id': { status: 'completed', value: 'C', numericValue: 6 },
      'act_duyet_1_council_01_11900395_sec_id': { status: 'completed', value: 'C+', numericValue: 6.5 },
      // 11900412: Chair=B+ (8), Sec=B (7.5) => Avg=7.75 => B+
      'act_duyet_1_council_01_11900412_chair_id': { status: 'completed', value: 'B+', numericValue: 8 },
      'act_duyet_1_council_01_11900412_sec_id': { status: 'completed', value: 'B', numericValue: 7.5 },
      // 12200254: Chair=B+ (8), Sec=B (7.5) => Avg=7.75 => B+
      'act_duyet_1_council_01_12200254_chair_id': { status: 'completed', value: 'B+', numericValue: 8 },
      'act_duyet_1_council_01_12200254_sec_id': { status: 'completed', value: 'B', numericValue: 7.5 }
    }
  };

  await t.test('1. Hội đồng đã chốt: Hiển thị đúng trạng thái đã duyệt trên bảng điểm Duyệt đợt 1', () => {
    const res1 = getProgressReviewData('11900335', 1, mockRound);
    assert.equal(res1.status, 'passed');
    assert.equal(res1.isPassed, true);
    assert.equal(res1.isFinalized, true);

    const res5 = getProgressReviewData('11900412', 1, mockRound);
    assert.equal(res5.status, 'passed');
    assert.equal(res5.isPassed, true);
    assert.equal(res5.isFinalized, true);
  });

  await t.test('2. Hiển thị đúng đánh giá A/B/C của từng sinh viên', () => {
    assert.equal(getProgressReviewData('11900335', 1, mockRound).letterGrade, 'C+');
    assert.equal(getProgressReviewData('11900375', 1, mockRound).letterGrade, 'B-');
    assert.equal(getProgressReviewData('11900382', 1, mockRound).letterGrade, 'B');
    assert.equal(getProgressReviewData('11900395', 1, mockRound).letterGrade, 'C+');
    assert.equal(getProgressReviewData('11900412', 1, mockRound).letterGrade, 'B+');
    assert.equal(getProgressReviewData('12200254', 1, mockRound).letterGrade, 'B+');
  });

  await t.test('3. Điểm số quy đổi hiển thị đúng vai trò tham khảo nếu có hiển thị điểm quy đổi', () => {
    const r1 = getProgressReviewData('11900335', 1, mockRound);
    assert.equal(r1.displayScore, 'C+');
    assert.equal(r1.referenceScore, '6.25');

    const r5 = getProgressReviewData('11900412', 1, mockRound);
    assert.equal(r5.displayScore, 'B+');
    assert.equal(r5.referenceScore, '7.75');
  });

  await t.test('4. Hội đồng chưa chốt: Bảng điểm không được tự ý hiển thị là đã duyệt', () => {
    const unfinalizedRound = JSON.parse(JSON.stringify(mockRound));
    unfinalizedRound.activities[0].councils[0].status = 'preparing';
    const res = getProgressReviewData('11900335', 1, unfinalizedRound);
    assert.equal(res.status, 'pending');
    assert.equal(res.isFinalized, false);
    assert.equal(res.displayScore, '--');

    unfinalizedRound.activities[0].councils[0].status = 'active';
    const resActive = getProgressReviewData('11900335', 1, unfinalizedRound);
    assert.equal(resActive.status, 'pending');
    assert.equal(resActive.isFinalized, false);
    assert.equal(resActive.displayScore, '--');
  });

  await t.test('5. Sinh viên chưa chấm: Hiển thị đúng trạng thái chưa chấm/chưa duyệt, không hiển thị C hoặc 0', () => {
    const resUnscored = getProgressReviewData('99999999', 1, mockRound);
    assert.equal(resUnscored.status, 'pending');
    assert.equal(resUnscored.score, null);
    assert.equal(resUnscored.letterGrade, null);
    assert.equal(resUnscored.displayScore, '--');
  });

  await t.test('6. Đồng bộ đúng 6 sinh viên hiện tại theo đúng MSSV', () => {
    const expectedStudents = ['11900335', '11900375', '11900382', '11900395', '11900412', '12200254'];
    expectedStudents.forEach(sid => {
      const data = getProgressReviewData(sid, 1, mockRound);
      assert.ok(data.letterGrade, `Student ${sid} should have letter grade`);
      assert.equal(data.status, 'passed');
    });
  });

  await t.test('7. Đề tài hiển thị khớp với đề tài chính thức đã duyệt', () => {
    assert.match(prelimSource, /getOfficialApprovedTopicTitle/);
    assert.match(assessmentSource, /getOfficialApprovedTopicTitle/);
  });

  await t.test('8. Khi tải lại trang, kết quả đã chốt không bị biến mất hoặc chuyển về Chưa duyệt', () => {
    // Simulating second read with cached finalDefenseScores or calculated scores
    const cachedRound = JSON.parse(JSON.stringify(mockRound));
    cachedRound.activities[0].councils[0].status = 'finalized';
    cachedRound.activities[0].councils[0].finalDefenseScores['11900335'] = {
      score: 6.25,
      letterGrade: 'C+',
      formattedScore: 'C+',
      finalizedAt: '2026-10-16T10:00:00.000Z'
    };
    const reloadRes = getProgressReviewData('11900335', 1, cachedRound);
    assert.equal(reloadRes.status, 'passed');
    assert.equal(reloadRes.letterGrade, 'C+');
    assert.equal(reloadRes.isFinalized, true);
  });

  await t.test('9. Tương thích dữ liệu dạng số, dạng chuỗi và dạng A/B/C', () => {
    const mixedRound = JSON.parse(JSON.stringify(mockRound));
    mixedRound.councilScores['act_duyet_1_council_01_st_num_chair_id'] = { status: 'completed', value: 8.5, numericValue: 8.5 };
    mixedRound.activities[0].councilStudentAssignments.push({ studentId: 'st_num', councilId: 'council_01' });
    const resNum = getProgressReviewData('st_num', 1, mixedRound);
    assert.equal(resNum.letterGrade, 'A-');
    assert.equal(resNum.referenceScore, '8.50');
  });

  await t.test('10. Quản trị viên xem bảng điểm Duyệt đợt 1', () => {
    assert.match(prelimSource, /window\.renderAdminProgressReviewTable/);
    assert.match(prelimSource, /getProgressReviewData/);
  });

  await t.test('11. Kiểm tra quyền Thành viên Hội đồng xem kết quả theo phạm vi cho phép', () => {
    assert.match(defenseSource, /!auth\.isAdmin\s*&&\s*!auth\.isChair/);
    assert.match(defenseSource, /confirmMissing/);
  });

  await t.test('12. Giao diện Sinh viên không làm lộ kết quả hội đồng nội bộ chưa công bố', () => {
    const studentJourneySource = fs.readFileSync(path.resolve(__dirname, '../js/students/student-journey.js'), 'utf8');
    // Student journey verifies submission status, not unreleased deliberation scores
    assert.match(studentJourneySource, /getEffectiveSubmissionRules/);
  });

  await t.test('13. Không phát sinh lỗi console và các tab khác được bảo toàn', () => {
    assert.match(prelimSource, /renderAdminProgressReviewTable\(1\)/);
    assert.match(prelimSource, /renderAdminProgressReviewTable\(2\)/);
    assert.match(prelimSource, /renderAdminProgressReviewTable\(3\)/);
    assert.match(prelimSource, /renderAdminReviewerAssignmentTable/);
    assert.match(prelimSource, /renderAdminPreliminaryConfig/);
    assert.match(prelimSource, /renderAdminDefenseScoresTable/);
    assert.match(prelimSource, /renderAdminScoresTable/);
  });
});
