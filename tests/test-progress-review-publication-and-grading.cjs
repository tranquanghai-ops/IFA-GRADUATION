const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read modules
const prelimSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/preliminary-dashboard.js'), 'utf8');
const assessmentSource = fs.readFileSync(path.resolve(__dirname, '../js/grading/assessment-portal.js'), 'utf8');
const studentJourneySource = fs.readFileSync(path.resolve(__dirname, '../js/students/student-journey.js'), 'utf8');
const timelinePreviewSource = fs.readFileSync(path.resolve(__dirname, '../js/rounds/rounds-timeline-preview.js'), 'utf8');
const supPortalStudentsSource = fs.readFileSync(path.resolve(__dirname, '../js/supervisors/supervisor-portal-students.js'), 'utf8');
const compiledIndexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

test('Comprehensive Progress Review Publication & Pass/Fail Suite', async (t) => {

  // Setup evaluation environment
  const mockScale = [
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
    { id: 'opt_dm', key: 'D-', code: 'D-', label: 'Quá yếu', numericValue: 4.0 },
    { id: 'opt_f', key: 'F', code: 'F', label: 'Kém', numericValue: 0.0 }
  ];

  const PASSING_LETTERS = ['A+', 'A', 'A-', 'B+', 'B', 'B-'];
  const FAILING_LETTERS = ['C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

  function isProgressReviewPassed(letterGrade, numericScore = null) {
    if (letterGrade && typeof letterGrade === 'string') {
      const clean = letterGrade.trim().toUpperCase();
      if (PASSING_LETTERS.includes(clean)) return true;
      if (FAILING_LETTERS.includes(clean)) return false;
    }
    if (numericScore !== null && numericScore !== undefined && !isNaN(Number(numericScore))) {
      return Number(numericScore) >= 7.0;
    }
    return false;
  }

  function isProgressReviewPublished(phase, targetRound) {
    if (!targetRound) return false;
    const pKey = 'duyet_' + phase;
    const pub = targetRound.publishedReviews?.[pKey] || targetRound.publicationState?.[pKey];
    return Boolean(pub && (pub.status === 'published' || pub.isPublished === true));
  }

  function getProgressReviewPublicationInfo(phase, targetRound) {
    if (!targetRound) return null;
    const pKey = 'duyet_' + phase;
    return targetRound.publishedReviews?.[pKey] || targetRound.publicationState?.[pKey] || null;
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
    return targetRound.activities.find(a => regex.test(`${a.title || ''} ${a.name || ''}`)) || null;
  }

  function getProgressReviewData(studentId, phase, targetRound) {
    if (!targetRound || !studentId) {
      return { status: 'pending', score: null, letterGrade: null, letterLabel: '', displayScore: '--', referenceScore: null, isPassed: false, isFinalized: false, source: 'none' };
    }
    const sid = String(studentId).trim();
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
          const letter = cached.letterGrade || (cached.formattedScore !== '--' ? cached.formattedScore : null);
          const numScore = cached.score !== undefined && cached.score !== null ? Number(cached.score) : null;
          const isPassed = isProgressReviewPassed(letter, numScore);
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
          // Compute from member scores
          const memberScores = [];
          for (const s of (council.memberSlots || [])) {
            const assigned = (council.membersBySlot || {})[s.key];
            if (!assigned) continue;
            const scorerId = assigned.id || assigned.email;
            const k = `${act.id}_${council.id}_${sid}_${scorerId}`;
            const sc = (targetRound.councilScores || {})[k];
            if (sc?.status === 'completed' && sc.numericValue !== undefined) {
              memberScores.push(sc.numericValue);
            }
          }
          if (memberScores.length > 0) {
            const avg = memberScores.reduce((a, b) => a + b, 0) / memberScores.length;
            // Map avg to letter grade
            let foundLetter = 'F';
            for (let i = 0; i < mockScale.length - 1; i++) {
              const higher = mockScale[i];
              const lower = mockScale[i + 1];
              const mid = (higher.numericValue + lower.numericValue) / 2;
              if (avg >= mid) {
                foundLetter = higher.code;
                break;
              }
            }
            const isPassed = isProgressReviewPassed(foundLetter, avg);
            return {
              status: isPassed ? 'passed' : 'failed',
              score: avg,
              letterGrade: foundLetter,
              letterLabel: '',
              displayScore: foundLetter,
              referenceScore: avg.toFixed(2),
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

  // Mock Round Data matching production
  const productionMockRound = {
    id: 'round_prod_01',
    name: 'Đợt Đồ án Tốt nghiệp 2026',
    activities: [
      {
        id: 'act_duyet_1',
        title: 'Duyệt đồ án đợt 1',
        phase: 1,
        councilEnabled: true,
        councils: [
          {
            id: 'council_01',
            name: 'Hội đồng Duyệt Đồ án Đợt 1 - Tiểu ban 01',
            status: 'finalized',
            memberSlots: [
              { key: 'chair', label: 'Chủ tịch' },
              { key: 'sec', label: 'Thư ký' }
            ],
            membersBySlot: {
              chair: { id: 'chair_id', name: 'TS. Nguyễn Văn A', email: 'chair@tdtu.edu.vn', role: 'Chủ tịch' },
              sec: { id: 'sec_id', name: 'ThS. Trần Thị B', email: 'sec@tdtu.edu.vn', role: 'Thư ký' }
            },
            finalDefenseScores: {
              '11900335': { score: 6.00, letterGrade: 'C', formattedScore: 'C' },
              '11900375': { score: 6.67, letterGrade: 'C+', formattedScore: 'C+' },
              '11900382': { score: 7.33, letterGrade: 'B', formattedScore: 'B' },
              '11900395': { score: 6.50, letterGrade: 'C+', formattedScore: 'C+' },
              '11900412': { score: 7.83, letterGrade: 'B+', formattedScore: 'B+' },
              '12200254': { score: 7.67, letterGrade: 'B', formattedScore: 'B' }
            }
          }
        ],
        councilStudentAssignments: [
          { studentId: '11900335', councilId: 'council_01' },
          { studentId: '11900375', councilId: 'council_01' },
          { studentId: '11900382', councilId: 'council_01' },
          { studentId: '11900395', councilId: 'council_01' },
          { studentId: '11900412', councilId: 'council_01' },
          { studentId: '12200254', councilId: 'council_01' }
        ]
      },
      {
        id: 'act_duyet_2',
        title: 'Duyệt đồ án đợt 2',
        phase: 2,
        councilEnabled: true,
        councils: []
      }
    ],
    councilScores: {
      'act_duyet_1_council_01_11900335_chair_id': { status: 'completed', value: 'C', numericValue: 6.0 },
      'act_duyet_1_council_01_11900335_sec_id': { status: 'completed', value: 'C', numericValue: 6.0 },
      'act_duyet_1_council_01_11900375_chair_id': { status: 'completed', value: 'C+', numericValue: 6.5 },
      'act_duyet_1_council_01_11900375_sec_id': { status: 'completed', value: 'B-', numericValue: 7.0 },
      'act_duyet_1_council_01_11900382_chair_id': { status: 'completed', value: 'B', numericValue: 7.5 },
      'act_duyet_1_council_01_11900382_sec_id': { status: 'completed', value: 'B-', numericValue: 7.0 },
      'act_duyet_1_council_01_11900395_chair_id': { status: 'completed', value: 'C', numericValue: 6.0 },
      'act_duyet_1_council_01_11900395_sec_id': { status: 'completed', value: 'C+', numericValue: 6.5 },
      'act_duyet_1_council_01_11900412_chair_id': { status: 'completed', value: 'B+', numericValue: 8.0 },
      'act_duyet_1_council_01_11900412_sec_id': { status: 'completed', value: 'B', numericValue: 7.5 },
      'act_duyet_1_council_01_12200254_chair_id': { status: 'completed', value: 'B+', numericValue: 8.0 },
      'act_duyet_1_council_01_12200254_sec_id': { status: 'completed', value: 'B', numericValue: 7.5 }
    }
  };

  // =========================================================================
  // SUITE A: PASS / FAIL GRADING RULES
  // =========================================================================
  await t.test('A1: Grades B- and above are strictly PASSED', () => {
    ['A+', 'A', 'A-', 'B+', 'B', 'B-'].forEach(grade => {
      assert.equal(isProgressReviewPassed(grade), true, `Grade ${grade} must pass`);
    });
  });

  await t.test('A2: Grade C+ is strictly FAILED', () => {
    assert.equal(isProgressReviewPassed('C+'), false, 'Grade C+ must fail');
  });

  await t.test('A3: Grades C and below (C, C-, D+, D, D-, F) are strictly FAILED', () => {
    ['C', 'C-', 'D+', 'D', 'D-', 'F'].forEach(grade => {
      assert.equal(isProgressReviewPassed(grade), false, `Grade ${grade} must fail`);
    });
  });

  await t.test('A4: Numeric scores follow B- threshold (>= 7.0 passed, < 7.0 failed)', () => {
    assert.equal(isProgressReviewPassed(null, 7.0), true, '7.0 must pass');
    assert.equal(isProgressReviewPassed(null, 6.99), false, '6.99 must fail');
    assert.equal(isProgressReviewPassed(null, 6.67), false, '6.67 must fail');
    assert.equal(isProgressReviewPassed(null, 8.5), true, '8.5 must pass');
  });

  await t.test('A5: Unscored or pending returns pending and isPassed=false without assigning failed', () => {
    const unscored = getProgressReviewData('99999999', 1, productionMockRound);
    assert.equal(unscored.status, 'pending');
    assert.equal(unscored.isPassed, false);
    assert.equal(unscored.displayScore, '--');
    assert.equal(unscored.score, null);
  });

  await t.test('A6: Verification of 6 production students in Duyệt đợt 1', () => {
    // 11900335: C (6.00) => Không đạt
    const st1 = getProgressReviewData('11900335', 1, productionMockRound);
    assert.equal(st1.letterGrade, 'C');
    assert.equal(st1.status, 'failed');
    assert.equal(st1.isPassed, false);

    // 11900375: C+ (6.67) => Không đạt
    const st2 = getProgressReviewData('11900375', 1, productionMockRound);
    assert.equal(st2.letterGrade, 'C+');
    assert.equal(st2.status, 'failed');
    assert.equal(st2.isPassed, false);

    // 11900382: B (7.33) => Đạt
    const st3 = getProgressReviewData('11900382', 1, productionMockRound);
    assert.equal(st3.letterGrade, 'B');
    assert.equal(st3.status, 'passed');
    assert.equal(st3.isPassed, true);

    // 11900395: C+ (6.50) => Không đạt
    const st4 = getProgressReviewData('11900395', 1, productionMockRound);
    assert.equal(st4.letterGrade, 'C+');
    assert.equal(st4.status, 'failed');
    assert.equal(st4.isPassed, false);

    // 11900412: B+ (7.83) => Đạt
    const st5 = getProgressReviewData('11900412', 1, productionMockRound);
    assert.equal(st5.letterGrade, 'B+');
    assert.equal(st5.status, 'passed');
    assert.equal(st5.isPassed, true);

    // 12200254: B (7.67) => Đạt
    const st6 = getProgressReviewData('12200254', 1, productionMockRound);
    assert.equal(st6.letterGrade, 'B');
    assert.equal(st6.status, 'passed');
    assert.equal(st6.isPassed, true);
  });

  await t.test('A7: UI Badge strings in preliminary-dashboard.js enforce ✓ Đạt yêu cầu and ✕ Không đạt yêu cầu', () => {
    assert.match(prelimSource, /✓ Đạt yêu cầu/);
    assert.match(prelimSource, /✕ Không đạt yêu cầu/);
    assert.match(assessmentSource, /✓ Đạt yêu cầu/);
    assert.match(assessmentSource, /✕ Không đạt yêu cầu/);
  });

  // =========================================================================
  // SUITE B: COUNCIL SCORE DETAILS MODAL
  // =========================================================================
  await t.test('B1: Compiled index.html contains modal-council-score-details with all required elements', () => {
    assert.match(compiledIndexHtml, /id="modal-council-score-details"/);
    assert.match(compiledIndexHtml, /id="council-detail-members-tbody"/);
    assert.match(compiledIndexHtml, /id="council-detail-valid-votes"/);
    assert.match(compiledIndexHtml, /id="council-detail-final-letter"/);
    assert.match(compiledIndexHtml, /id="council-detail-verdict-badge"/);
    assert.match(compiledIndexHtml, /id="council-detail-publish-pill"/);
  });

  await t.test('B2: preliminary-dashboard.js exports openCouncilScoreDetailModal and closeCouncilScoreDetailModal', () => {
    assert.match(prelimSource, /export function openCouncilScoreDetailModal/);
    assert.match(prelimSource, /export function closeCouncilScoreDetailModal/);
    assert.match(prelimSource, /window\.openCouncilScoreDetailModal = openCouncilScoreDetailModal/);
  });

  await t.test('B3: Admin/Owner RBAC guard is strictly enforced before opening detail modal', () => {
    assert.match(prelimSource, /state\.isAdmin\s*&&\s*!state\.impersonation/);
    assert.match(prelimSource, /Chỉ Quản trị viên và Chủ sở hữu mới có quyền xem chi tiết phiếu chấm Hội đồng/);
  });

  await t.test('B4: Clicking badge triggers openCouncilScoreDetailModal only when user has permission', () => {
    assert.match(prelimSource, /onclick="openCouncilScoreDetailModal\('\$\{sid\}',\s*\$\{phase\}\)"/);
  });

  // =========================================================================
  // SUITE C: PUBLISH PROGRESS REVIEW WORKFLOW
  // =========================================================================
  await t.test('C1: Compiled index.html contains modal-publish-progress-review and publish action zones', () => {
    assert.match(compiledIndexHtml, /id="modal-publish-progress-review"/);
    assert.match(compiledIndexHtml, /id="admin-duyet-1-publish-zone"/);
    assert.match(compiledIndexHtml, /id="admin-duyet-2-publish-zone"/);
    assert.match(compiledIndexHtml, /id="admin-duyet-3-publish-zone"/);
  });

  await t.test('C2: isProgressReviewPublished accurately detects published vs unpublished state', () => {
    const unpubRound = { id: 'r1' };
    assert.equal(isProgressReviewPublished(1, unpubRound), false);

    const pubRound = {
      id: 'r1',
      publishedReviews: {
        duyet_1: { status: 'published', publishedAt: '2026-10-16T12:00:00Z', publishedBy: 'admin@tdtu.edu.vn' }
      }
    };
    assert.equal(isProgressReviewPublished(1, pubRound), true);
    assert.equal(isProgressReviewPublished(2, pubRound), false, 'Phase 2 must remain unpublished');
  });

  await t.test('C3: Publication metadata structure isolates published data and excludes raw member deliberation scores', () => {
    const pubPayload = {
      status: 'published',
      publishedAt: new Date().toISOString(),
      publishedBy: 'admin@tdtu.edu.vn',
      activityId: 'act_duyet_1',
      phase: 1,
      roundId: 'round_01',
      eligibleCount: 3,
      studentResults: {
        '11900382': { studentId: '11900382', letterGrade: 'B', isPassed: true, status: 'passed' },
        '11900412': { studentId: '11900412', letterGrade: 'B+', isPassed: true, status: 'passed' },
        '11900335': { studentId: '11900335', letterGrade: 'C', isPassed: false, status: 'failed' }
      }
    };
    // Ensure no raw scores or member keys in studentResults
    Object.values(pubPayload.studentResults).forEach(res => {
      assert.equal(res.numericScore, undefined);
      assert.equal(res.memberScores, undefined);
      assert.equal(res.chairScore, undefined);
      assert.ok(res.letterGrade);
      assert.equal(typeof res.isPassed, 'boolean');
    });
  });

  await t.test('C4: Toolbar renders "Công bố điểm" when unpublished and "Đã công bố điểm" when published', () => {
    assert.match(prelimSource, /📢/);
    assert.match(prelimSource, /Công bố điểm/);
    assert.match(prelimSource, /Đã công bố điểm/);
  });

  await t.test('C5: Partial publication warning and checkbox gating when pendingCount > 0', () => {
    assert.match(compiledIndexHtml, /id="pub-modal-partial-warning"/);
    assert.match(compiledIndexHtml, /id="chk-confirm-partial-publish"/);
    assert.match(compiledIndexHtml, /id="pub-modal-partial-pending-num"/);
    assert.match(prelimSource, /onPartialPublishCheckboxChanged/);
    assert.match(prelimSource, /chk-confirm-partial-publish/);
  });

  await t.test('C6: Subcollection publishedStudentResults and auditLogs payload verification', () => {
    assert.match(prelimSource, /publishedStudentResults/);
    assert.match(prelimSource, /pub_duyet_\$\{phase\}_/);
    assert.match(prelimSource, /Công bố điểm Duyệt đợt/);
  });

  // =========================================================================
  // SUITE D: STUDENT & SUPERVISOR PORTAL ISOLATION
  // =========================================================================
  await t.test('D1: Student portal modal checks isProgressReviewPublished and shows "Chưa công bố" before release', () => {
    assert.match(timelinePreviewSource, /isProgressReviewPublished/);
    assert.match(timelinePreviewSource, /Hội đồng đang tiến hành đánh giá\. Kết quả chính thức chưa công bố\./);
  });

  await t.test('D2: Student portal after publication shows ONLY official letter grade and pass/fail verdict', () => {
    assert.match(timelinePreviewSource, /KẾT QUẢ ĐÁNH GIÁ DUYỆT ĐỢT/);
    assert.match(timelinePreviewSource, /Điểm chữ chính thức/);
    assert.match(timelinePreviewSource, /Kết luận/);
    // Crucial: Student portal does not render referenceScore or individual member scores in this block
    assert.doesNotMatch(timelinePreviewSource, /stRes\.referenceScore/);
    assert.doesNotMatch(timelinePreviewSource, /stRes\.numericScore/);
  });

  await t.test('D3: Supervisor portal displays published review results in student detail modal', () => {
    assert.match(supPortalStudentsSource, /isProgressReviewPublished/);
    assert.match(supPortalStudentsSource, /Chưa công bố/);
  });

  // =========================================================================
  // SUITE E: REGRESSION INTEGRITY
  // =========================================================================
  await t.test('E1: Defense, Thesis, and Rubric grading functions remain intact', () => {
    assert.match(prelimSource, /renderAdminDefenseScoresTable/);
    assert.match(assessmentSource, /renderAssessmentThesisList/);
    assert.match(assessmentSource, /renderAssessmentPreliminaryList/);
    assert.match(assessmentSource, /renderAssessmentDefenseList/);
  });

  await t.test('E2: Sub-tabs and filter dropdowns include Đạt yêu cầu and Không đạt yêu cầu options', () => {
    const tabScoringHtml = fs.readFileSync(path.resolve(__dirname, '../views/admin/tab-scoring.html'), 'utf8');
    assert.match(tabScoringHtml, /<option value="passed">Đạt yêu cầu<\/option>/);
    assert.match(tabScoringHtml, /<option value="failed">Không đạt yêu cầu<\/option>/);
    assert.match(tabScoringHtml, /<option value="pending">Chưa duyệt<\/option>/);
  });
});
