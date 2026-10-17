/**
 * IFA+ Graduation — Admin Preliminary & Defense Scores Dashboard
 */
window.switchAdminScoringSubTab = function(tabKey) {
  let mainTab = tabKey;
  if (tabKey === 'overview') mainTab = 'summary';
  else if (tabKey === 'preliminary-config') mainTab = 'preliminary';
  else if (tabKey === 'reviewer-assignment' || tabKey === 'supervisor-config') mainTab = 'thesis';
  else if (tabKey === 'final-score-config' || tabKey === 'ranking' || tabKey === 'export') mainTab = 'summary';

  // 7 horizontal top-level navigation buttons
  const mainTabs = ['duyet-1', 'duyet-2', 'duyet-3', 'thesis', 'preliminary', 'defense', 'summary'];
  mainTabs.forEach(t => {
    const btn = document.getElementById('ascore-tab-btn-' + t);
    if (btn) {
      if (t === mainTab) {
        btn.className = 'ascore-nav-btn px-3.5 py-2 rounded-lg bg-slate-900 text-white shadow-xs font-bold transition-all whitespace-nowrap';
      } else {
        btn.className = 'ascore-nav-btn px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all whitespace-nowrap font-semibold';
      }
    }
  });

  // Hide all panels
  const allPanels = [
    'duyet-1', 'duyet-2', 'duyet-3', 'defense',
    'overview', 'preliminary-config', 'supervisor-config', 'reviewer-assignment', 'final-score-config', 'ranking', 'export'
  ];
  allPanels.forEach(pId => {
    const p = document.getElementById('ascore-panel-' + pId);
    if (p) p.classList.add('hidden');
  });

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;

  // Show target panel based on requested tabKey
  if (tabKey === 'duyet-1') {
    const p = document.getElementById('ascore-panel-duyet-1');
    if (p) p.classList.remove('hidden');
    renderAdminProgressReviewTable(1);
  } else if (tabKey === 'duyet-2') {
    const p = document.getElementById('ascore-panel-duyet-2');
    if (p) p.classList.remove('hidden');
    renderAdminProgressReviewTable(2);
  } else if (tabKey === 'duyet-3') {
    const p = document.getElementById('ascore-panel-duyet-3');
    if (p) p.classList.remove('hidden');
    renderAdminProgressReviewTable(3);
  } else if (tabKey === 'thesis' || tabKey === 'reviewer-assignment') {
    const p = document.getElementById('ascore-panel-reviewer-assignment');
    if (p) p.classList.remove('hidden');
    renderAdminReviewerAssignmentTable();
  } else if (tabKey === 'supervisor-config') {
    const p = document.getElementById('ascore-panel-supervisor-config');
    if (p) p.classList.remove('hidden');
    renderAdminSupervisorScoreConfig();
  } else if (tabKey === 'preliminary' || tabKey === 'preliminary-config') {
    const p = document.getElementById('ascore-panel-preliminary-config');
    if (p) p.classList.remove('hidden');
    renderAdminPreliminaryConfig();
  } else if (tabKey === 'defense') {
    const p = document.getElementById('ascore-panel-defense');
    if (p) p.classList.remove('hidden');
    renderAdminDefenseScoresTable();
  } else if (tabKey === 'summary' || tabKey === 'overview') {
    const p = document.getElementById('ascore-panel-overview');
    if (p) p.classList.remove('hidden');
    renderAdminScoresTable();
  } else if (tabKey === 'final-score-config') {
    const p = document.getElementById('ascore-panel-final-score-config');
    if (p) p.classList.remove('hidden');
    loadAdminFinalScoreConfig(roundId);
  } else if (tabKey === 'ranking') {
    const p = document.getElementById('ascore-panel-ranking');
    if (p) p.classList.remove('hidden');
    loadAdminRankingTab(roundId);
  } else if (tabKey === 'export') {
    const p = document.getElementById('ascore-panel-export');
    if (p) p.classList.remove('hidden');
    loadAdminExportTab(roundId);
  }
};


export function getScoringRoundStudents(targetRound) {
  const roundId = targetRound?.id || state.selectedRoundId;
  if (!roundId) return [];

  // If adminReviewData belongs to this round, merge registrations, officialAssignments, eligible
  if (state.adminReviewData && state.adminReviewData.roundId === roundId) {
    const regs = state.adminReviewData.registrations || [];
    const assignments = state.adminReviewData.officialAssignments || [];
    const eligible = state.adminReviewData.eligible || [];

    const studentMap = new Map();
    // 1. From registrations
    regs.forEach(r => {
      const sid = String(r.studentId || r.mssv || r.id || '').trim().toUpperCase();
      if (sid) {
        const rTopic = (typeof window !== 'undefined' && typeof window.getOfficialApprovedTopicTitle === 'function')
          ? window.getOfficialApprovedTopicTitle(r, r.topicTitle || '')
          : (r.topicTitle || '');
        studentMap.set(sid, {
          ...r,
          studentId: sid,
          mssv: sid,
          studentName: r.studentName || r.name || r.fullName || sid,
          className: r.currentClass || r.studentClass || r.className || '--',
          acceptedSupervisorName: r.acceptedSupervisorName || '',
          topicTitle: rTopic
        });
      }
    });

    // 2. Merge with officialAssignments
    assignments.forEach(a => {
      const sid = String(a.studentId || a.mssv || a.id || '').trim().toUpperCase();
      if (sid) {
        const existing = studentMap.get(sid) || {};
        const primary = (a.supervisors || []).find(s => s.role === 'primary') || (a.supervisors || [])[0];
        const aTopic = (typeof window !== 'undefined' && typeof window.getOfficialApprovedTopicTitle === 'function')
          ? window.getOfficialApprovedTopicTitle(a, a.topicTitle || '')
          : (a.topicTitle || '');
        studentMap.set(sid, {
          ...existing,
          ...a,
          studentId: sid,
          mssv: sid,
          studentName: a.studentName || existing.studentName || existing.name || sid,
          className: a.className || a.studentClass || existing.className || existing.currentClass || '--',
          acceptedSupervisorName: a.acceptedSupervisorName || primary?.supervisorName || existing.acceptedSupervisorName || '',
          topicTitle: existing.topicTitle || aTopic || ''
        });
      }
    });

    // 3. Merge with eligible
    eligible.forEach(e => {
      const sid = String(e.studentId || e.mssv || e.id || '').trim().toUpperCase();
      if (sid && !studentMap.has(sid)) {
        studentMap.set(sid, {
          ...e,
          studentId: sid,
          mssv: sid,
          studentName: e.fullName || e.name || sid,
          className: e.className || e.studentClass || '--',
          topicTitle: ''
        });
      }
    });

    if (studentMap.size > 0) {
      return Array.from(studentMap.values());
    }
  }

  // Fallback if adminReviewData is not for this round:
  if (Array.isArray(targetRound?.eligibleStudents) && targetRound.eligibleStudents.length > 0) {
    return targetRound.eligibleStudents;
  }
  return [];
}
if (typeof window !== 'undefined') {
  window.getScoringRoundStudents = getScoringRoundStudents;
}

export function findProgressReviewActivity(targetRound, phase) {
  if (!targetRound || !Array.isArray(targetRound.activities)) return null;
  const pNum = Number(phase);
  // 1. Direct match on phase or milestoneType
  let act = targetRound.activities.find(a =>
    Number(a.phase) === pNum ||
    a.milestoneType === `duyet_${pNum}` ||
    a.type === `duyet_${pNum}` ||
    a.id === `act_duyet_${pNum}`
  );
  if (act) return act;

  // 2. Regex match on title / name / slug (matching Duyệt đợt X or Duyệt X)
  const regex = new RegExp(`(?:duyệt|duyet)\\s*(?:đồ\\s*án|do\\s*an)?\\s*(?:tốt\\s*nghiệp|tot\\s*nghiep)?\\s*(?:đợt|dot)?\\s*${pNum}\\b`, 'i');
  act = targetRound.activities.find(a => {
    const text = `${a.title || ''} ${a.name || ''} ${a.driveFolderName || ''} ${a.slug || ''}`;
    return regex.test(text);
  });
  return act || null;
}

export const PASSING_PROGRESS_LETTER_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-'];
export const FAILING_PROGRESS_LETTER_GRADES = ['C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

export function isProgressReviewPassed(letterGrade, numericScore = null) {
  if (letterGrade && typeof letterGrade === 'string') {
    const clean = letterGrade.trim().toUpperCase();
    if (PASSING_PROGRESS_LETTER_GRADES.includes(clean)) return true;
    if (FAILING_PROGRESS_LETTER_GRADES.includes(clean)) return false;
  }
  if (numericScore !== null && numericScore !== undefined && !isNaN(Number(numericScore))) {
    return Number(numericScore) >= 7.0;
  }
  return false;
}

export function isProgressReviewPublished(phase, targetRound) {
  if (!targetRound) return false;
  const pKey = 'duyet_' + phase;
  const pub = targetRound.publishedReviews?.[pKey] || targetRound.publicationState?.[pKey];
  return Boolean(pub && (pub.status === 'published' || pub.isPublished === true));
}

export function getProgressReviewPublicationInfo(phase, targetRound) {
  if (!targetRound) return null;
  const pKey = 'duyet_' + phase;
  return targetRound.publishedReviews?.[pKey] || targetRound.publicationState?.[pKey] || null;
}

export function getProgressReviewData(studentId, phase, targetRound) {
  if (!targetRound || !studentId) {
    return { status: 'pending', score: null, letterGrade: null, letterLabel: '', displayScore: '--', referenceScore: null, isPassed: false, isFinalized: false, source: 'none' };
  }
  const sid = String(studentId).trim();

  // Sync state.councilScores with targetRound.councilScores if available
  if (targetRound.councilScores && typeof state !== 'undefined') {
    state.councilScores = { ...(targetRound.councilScores || {}), ...(state.councilScores || {}) };
  }

  // 1. Check if there is an activity for this phase
  const act = findProgressReviewActivity(targetRound, phase);
  if (act && act.councilEnabled && Array.isArray(act.councils) && act.councils.length > 0) {
    // Find council assigned to this student
    const asgns = act.councilStudentAssignments || [];
    const studentAsgn = asgns.find(a => String(a.studentId).trim() === sid);
    const council = studentAsgn ? act.councils.find(c => c.id === studentAsgn.councilId) : act.councils[0];

    if (council) {
      const cStat = council.status || 'preparing';
      const isCouncilFinished = (cStat === 'finalized' || cStat === 'ended' || cStat === 'completed');

      // 1A. If council has cached finalDefenseScores for this student
      if (council.finalDefenseScores?.[sid]) {
        const cached = council.finalDefenseScores[sid];
        const letter = cached.letterGrade || (act.scoringConfig?.mode === 'letter' && cached.formattedScore !== '--' ? cached.formattedScore : null);
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

      // 1B. If council is ended or finalized, compute official score from completed member scores
      if (isCouncilFinished) {
        const resolveOfficial = (typeof window !== 'undefined' && typeof window.getOfficialDefenseScore === 'function')
          ? window.getOfficialDefenseScore
          : (typeof getOfficialDefenseScore === 'function' ? getOfficialDefenseScore : null);

        const official = resolveOfficial ? resolveOfficial(sid, council, act, targetRound) : null;

        if (official && (official.score !== null || official.letterGrade !== null)) {
          const letter = official.letterGrade || (act.scoringConfig?.mode === 'letter' && official.formattedScore !== '--' ? official.formattedScore : null);
          const numScore = official.score !== null ? Number(official.score) : null;
          const isPassed = isProgressReviewPassed(letter, numScore);
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

      // Council is not finished (preparing / active) or student has not been scored yet
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

  // 2. Fallback to targetRound.progressReviews
  const legacy = targetRound.progressReviews?.['duyet_' + phase]?.[sid];
  if (legacy) {
    const rawScore = legacy.score !== undefined && legacy.score !== null ? Number(legacy.score) : null;
    const letter = legacy.letterGrade || (typeof legacy.value === 'string' && /[A-DF]/i.test(legacy.value) ? legacy.value : null);
    const status = legacy.status || 'pending';
    const isPassed = status === 'passed' ? true : (status === 'failed' ? false : isProgressReviewPassed(letter, rawScore));
    return {
      status: isPassed ? 'passed' : (status === 'revision' ? 'revision' : (status === 'pending' ? 'pending' : 'failed')),
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

let currentPublishPhase = null;

export function renderPublishProgressReviewToolbar(phase) {
  const container = document.getElementById(`admin-duyet-${phase}-publish-zone`);
  if (!container) return;

  const targetRound = (typeof state !== 'undefined' && (state.rounds || []).find(r => r.id === state.selectedRoundId)) || state?.activeRound;
  if (!targetRound) {
    container.innerHTML = '';
    return;
  }

  const isAdminOrOwner = (typeof state !== 'undefined' && state.isAdmin && !state.impersonation) || (typeof isUserAdminOrOwner === 'function' && isUserAdminOrOwner());
  if (!isAdminOrOwner) {
    container.innerHTML = '';
    return;
  }

  const isPublished = isProgressReviewPublished(phase, targetRound);
  const pubInfo = getProgressReviewPublicationInfo(phase, targetRound);

  if (isPublished) {
    const pubDateStr = pubInfo?.publishedAt ? new Date(pubInfo.publishedAt).toLocaleDateString('vi-VN') : '';
    const pubUserStr = pubInfo?.publishedBy ? ` bởi ${pubInfo.publishedBy}` : '';
    container.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold" title="Đã công bố ngày ${pubDateStr}${pubUserStr}">
          <span class="text-emerald-600">✓</span>
          <span>Đã công bố điểm</span>
          ${pubDateStr ? `<span class="text-[10px] text-emerald-600 font-normal">(${pubDateStr})</span>` : ''}
        </div>
        <button type="button" onclick="openRevokeProgressReviewModal(${phase})" class="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs" title="Thu hồi công bố kết quả mốc duyệt">
          <span>↩️</span>
          <span>Thu hồi công bố</span>
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button type="button" onclick="openPublishProgressReviewModal(${phase})" class="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer" title="Công bố kết quả chính thức cho sinh viên và GVHD">
        <span>📢</span>
        <span>Công bố điểm</span>
      </button>
    `;
  }
}

export function openPublishProgressReviewModal(phase) {
  const isAdminOrOwner = (typeof state !== 'undefined' && state.isAdmin && !state.impersonation) || (typeof isUserAdminOrOwner === 'function' && isUserAdminOrOwner());
  if (!isAdminOrOwner) {
    if (typeof showToast === 'function') showToast('Chỉ Quản trị viên và Chủ sở hữu mới có quyền công bố điểm.', 'warning');
    return;
  }

  const pNum = Number(phase);
  currentPublishPhase = pNum;
  const targetRound = (typeof state !== 'undefined' && (state.rounds || []).find(r => r.id === state.selectedRoundId)) || state?.activeRound;
  if (!targetRound) return;

  const act = findProgressReviewActivity(targetRound, pNum);
  const actTitle = act ? (act.title || act.name || `Duyệt đợt ${pNum}`) : `Duyệt đợt ${pNum}`;
  const allStudents = getScoringRoundStudents(targetRound);

  let eligibleCount = 0;
  let pendingCount = 0;

  allStudents.forEach(s => {
    const sid = s.mssv || s.studentId;
    const rev = getProgressReviewData(sid, pNum, targetRound);
    if (rev.isFinalized && (rev.letterGrade || (rev.score !== null && !isNaN(rev.score)))) {
      eligibleCount++;
    } else {
      pendingCount++;
    }
  });

  const modal = document.getElementById('modal-publish-progress-review');
  if (!modal) return;

  const badgeEl = document.getElementById('pub-modal-phase-badge');
  const roundTitleEl = document.getElementById('pub-modal-round-title');
  const actTitleEl = document.getElementById('pub-modal-act-title');
  const eligibleEl = document.getElementById('pub-modal-eligible-count');
  const pendingEl = document.getElementById('pub-modal-pending-count');

  if (badgeEl) badgeEl.textContent = `Duyệt đợt ${pNum}`;
  if (roundTitleEl) roundTitleEl.textContent = `Đợt tốt nghiệp: ${targetRound.name || targetRound.title || targetRound.id}`;
  if (actTitleEl) actTitleEl.textContent = actTitle;
  if (eligibleEl) eligibleEl.textContent = `${eligibleCount} sinh viên`;
  if (pendingEl) pendingEl.textContent = `${pendingCount} sinh viên`;

  const btnConfirm = document.getElementById('btn-confirm-publish-scores');
  const errBox = document.getElementById('pub-modal-error-box');
  const partialWarn = document.getElementById('pub-modal-partial-warning');
  const partialNum = document.getElementById('pub-modal-partial-pending-num');
  const partialChk = document.getElementById('chk-confirm-partial-publish');

  if (eligibleCount === 0) {
    if (errBox) {
      errBox.textContent = `Chưa có kết quả điểm chốt nào từ Hội đồng cho mốc ${actTitle}. Vui lòng chốt điểm Hội đồng trước khi thực hiện công bố.`;
      errBox.classList.remove('hidden');
    }
    if (partialWarn) partialWarn.classList.add('hidden');
    if (btnConfirm) btnConfirm.disabled = true;
  } else {
    if (errBox) errBox.classList.add('hidden');
    if (pendingCount > 0) {
      if (partialWarn) partialWarn.classList.remove('hidden');
      if (partialNum) partialNum.textContent = pendingCount;
      if (partialChk) partialChk.checked = false;
      if (btnConfirm) btnConfirm.disabled = true; // Wait for explicit confirmation checkbox
    } else {
      if (partialWarn) partialWarn.classList.add('hidden');
      if (btnConfirm) btnConfirm.disabled = false;
    }
  }

  modal.classList.remove('hidden');
}

export function onPartialPublishCheckboxChanged() {
  const chk = document.getElementById('chk-confirm-partial-publish');
  const btnConfirm = document.getElementById('btn-confirm-publish-scores');
  if (btnConfirm && chk) {
    btnConfirm.disabled = !chk.checked;
  }
}

export function closePublishProgressReviewModal() {
  const modal = document.getElementById('modal-publish-progress-review');
  if (modal) modal.classList.add('hidden');
  currentPublishPhase = null;
}

export async function confirmPublishProgressReview() {
  const phase = currentPublishPhase;
  if (!phase) return;

  const targetRound = (typeof state !== 'undefined' && (state.rounds || []).find(r => r.id === state.selectedRoundId)) || state?.activeRound;
  if (!targetRound) return;

  const btnConfirm = document.getElementById('btn-confirm-publish-scores');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<span>⏳</span> <span>Đang công bố…</span>';
  }

  try {
    const act = findProgressReviewActivity(targetRound, phase);
    const allStudents = getScoringRoundStudents(targetRound);

    const studentResults = {};
    let eligibleCount = 0;

    allStudents.forEach(s => {
      const sid = s.mssv || s.studentId;
      const rev = getProgressReviewData(sid, phase, targetRound);
      if (rev.isFinalized && (rev.letterGrade || (rev.score !== null && !isNaN(rev.score)))) {
        eligibleCount++;
        studentResults[sid] = {
          studentId: sid,
          studentName: s.fullName || s.studentName || sid,
          letterGrade: rev.letterGrade,
          isPassed: rev.isPassed,
          status: rev.isPassed ? 'passed' : 'failed',
          finalizedAt: new Date().toISOString()
        };
      }
    });

    if (eligibleCount === 0) {
      throw new Error('Không có sinh viên nào có điểm chốt hợp lệ để công bố.');
    }

    const prevVersion = targetRound.publishedReviews?.['duyet_' + phase]?.publicationVersion || 0;
    const pubVersion = prevVersion + 1;

    // Full snapshot for Admin subcollection and in-memory state
    const pubRecord = {
      status: 'published',
      isPublished: true,
      publishedAt: new Date().toISOString(),
      publishedBy: state.user?.email || 'admin',
      activityId: act ? act.id : `act_duyet_${phase}`,
      phase: Number(phase),
      roundId: targetRound.id,
      eligibleCount: eligibleCount,
      publicationVersion: pubVersion,
      studentResults: studentResults
    };

    // Public metadata for Tier A root doc (STRICTLY NO studentResults map!)
    const roundDocPubMetadata = {
      status: 'published',
      isPublished: true,
      publishedAt: pubRecord.publishedAt,
      publishedBy: pubRecord.publishedBy,
      activityId: pubRecord.activityId,
      phase: Number(phase),
      roundId: targetRound.id,
      eligibleCount: eligibleCount,
      publicationVersion: pubVersion
    };

    // Update in-memory round (keeps admin views reactive)
    targetRound.publishedReviews = targetRound.publishedReviews || {};
    targetRound.publishedReviews['duyet_' + phase] = pubRecord;

    // Persist to Firestore if online
    const rawUpdate = (typeof window !== 'undefined') ? (window.updateDoc || window.rawUpdateDoc) : null;
    const rawSet = (typeof window !== 'undefined') ? (window.setDoc || window.rawSetDoc) : null;
    const docFn = (typeof window !== 'undefined') ? window.doc : null;
    const dbObj = (typeof window !== 'undefined') ? (window.db || (typeof db !== 'undefined' ? db : null)) : null;

    if (dbObj && rawUpdate && docFn) {
      const roundRef = docFn(dbObj, 'graduationRounds', targetRound.id);
      await rawUpdate(roundRef, {
        [`publishedReviews.duyet_${phase}`]: roundDocPubMetadata,
        updatedAt: (typeof window.serverTimestamp === 'function') ? window.serverTimestamp() : new Date().toISOString()
      });

      // Safe Subcollection writes (Phase B: Lớp B độc lập & Audit Log)
      try {
        if (rawSet) {
          // 1. Snapshot tổng hợp mốc duyệt cho Admin
          const subDocRef = docFn(dbObj, 'graduationRounds', targetRound.id, 'publishedProgressReviews', `duyet_${phase}`);
          await rawSet(subDocRef, pubRecord);

          // 2. Tách dữ liệu công bố riêng theo từng sinh viên (Least-Privilege RBAC)
          for (const [stId, sRes] of Object.entries(studentResults)) {
            const stDocRef = docFn(dbObj, 'graduationRounds', targetRound.id, 'publishedStudentResults', stId);
            await rawSet(stDocRef, {
              studentId: stId,
              studentName: sRes.studentName || stId,
              roundId: targetRound.id,
              status: 'published',
              isPublished: true,
              reviews: {
                [`duyet_${phase}`]: {
                  phase: Number(phase),
                  activityId: act ? act.id : `act_duyet_${phase}`,
                  letterGrade: sRes.letterGrade,
                  isPassed: sRes.isPassed,
                  status: 'published',
                  publishedAt: pubRecord.publishedAt,
                  publishedBy: pubRecord.publishedBy,
                  publicationVersion: pubVersion
                }
              },
              updatedAt: (typeof window.serverTimestamp === 'function') ? window.serverTimestamp() : new Date().toISOString()
            }, { merge: true });
          }

          // 3. Ghi nhật ký kiểm toán (Audit Log)
          const auditLogId = `pub_duyet_${phase}_${Date.now()}`;
          const auditDocRef = docFn(dbObj, 'graduationRounds', targetRound.id, 'auditLogs', auditLogId);
          await rawSet(auditDocRef, {
            by: state.user?.email || 'admin',
            actorEmail: state.user?.email || 'admin',
            action: `Công bố điểm Duyệt đợt ${phase}`,
            roundId: targetRound.id,
            activityId: act ? act.id : `act_duyet_${phase}`,
            phase: Number(phase),
            publishedCount: eligibleCount,
            pendingCount: allStudents.length - eligibleCount,
            studentIds: Object.keys(studentResults),
            publishedAt: pubRecord.publishedAt
          });
        }
      } catch (subErr) {
        console.warn('[PublishedProgressReviews] Subcollection write notice:', subErr.message);
      }
    }

    if (typeof showToast === 'function') {
      showToast(`Đã công bố điểm Duyệt đợt ${phase} thành công cho ${eligibleCount} sinh viên!`, 'success');
    }

    closePublishProgressReviewModal();
    renderAdminProgressReviewTable(phase);
  } catch (err) {
    console.error('[PublishProgressReview] Error:', err);
    const errBox = document.getElementById('pub-modal-error-box');
    if (errBox) {
      errBox.textContent = `Lỗi công bố điểm: ${err.message}`;
      errBox.classList.remove('hidden');
    } else if (typeof showToast === 'function') {
      showToast(`Lỗi công bố điểm: ${err.message}`, 'error');
    }
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<span>📢</span> <span>Xác nhận Công bố</span>';
    }
  }
}

export function openCouncilScoreDetailModal(studentId, phase) {
  const isAdminOrOwner = (typeof state !== 'undefined' && state.isAdmin && !state.impersonation) || (typeof isUserAdminOrOwner === 'function' && isUserAdminOrOwner());
  if (!isAdminOrOwner) {
    if (typeof showToast === 'function') showToast('Chỉ Quản trị viên và Chủ sở hữu mới có quyền xem chi tiết phiếu chấm Hội đồng.', 'warning');
    return;
  }

  const sid = String(studentId || '').trim();
  const pNum = Number(phase);
  const targetRound = (typeof state !== 'undefined' && (state.rounds || []).find(r => r.id === state.selectedRoundId)) || state?.activeRound;
  if (!targetRound) return;

  const act = findProgressReviewActivity(targetRound, pNum);
  const allStudents = getScoringRoundStudents(targetRound);
  const student = allStudents.find(s => String(s.mssv || s.studentId).trim() === sid) || { studentId: sid, fullName: sid };
  const studentName = student.fullName || student.studentName || sid;
  const topicTitle = (typeof window.getOfficialApprovedTopicTitle === 'function')
    ? window.getOfficialApprovedTopicTitle(student, student.topicTitle || '')
    : (student.topicTitle || 'Chưa cập nhật đề tài');
  const supName = student.acceptedSupervisorName || student.supervisorName || (Array.isArray(student.officialSupervisors) && student.officialSupervisors[0]?.supervisorName) || (Array.isArray(student.supervisors) && student.supervisors[0]?.supervisorName) || '--';

  const reviewData = getProgressReviewData(sid, pNum, targetRound);

  let council = null;
  if (act && Array.isArray(act.councils)) {
    const asgns = act.councilStudentAssignments || [];
    const studentAsgn = asgns.find(a => String(a.studentId).trim() === sid);
    council = studentAsgn ? act.councils.find(c => c.id === studentAsgn.councilId) : act.councils[0];
  }

  const modal = document.getElementById('modal-council-score-details');
  if (!modal) return;

  const phaseBadgeEl = document.getElementById('council-detail-phase-badge');
  const titleEl = document.getElementById('council-detail-title');
  const subtitleEl = document.getElementById('council-detail-subtitle');
  const stInfoEl = document.getElementById('council-detail-student-info');
  const supInfoEl = document.getElementById('council-detail-supervisor-info');
  const topicInfoEl = document.getElementById('council-detail-topic-info');

  if (phaseBadgeEl) phaseBadgeEl.textContent = `Duyệt đợt ${pNum}`;
  if (titleEl) titleEl.textContent = `Chi tiết Đánh giá Hội đồng: ${studentName} (${sid})`;
  if (subtitleEl) subtitleEl.textContent = `Đợt: ${targetRound.name || targetRound.title || targetRound.id} • Hội đồng: ${council?.name || 'Chưa gán'}`;
  if (stInfoEl) stInfoEl.textContent = `${studentName} • ${sid}`;
  if (supInfoEl) supInfoEl.textContent = supName;
  if (topicInfoEl) topicInfoEl.textContent = topicTitle;

  // Status pills
  const cStat = council?.status || 'preparing';
  const isCouncilFinished = (cStat === 'finalized' || cStat === 'ended' || cStat === 'completed');
  const statusPillEl = document.getElementById('council-detail-status-pill');
  if (statusPillEl) {
    statusPillEl.innerHTML = isCouncilFinished
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã chốt kết quả</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Đang đánh giá</span>';
  }

  const isPub = isProgressReviewPublished(pNum, targetRound);
  const pubInfo = getProgressReviewPublicationInfo(pNum, targetRound);
  const pubPillEl = document.getElementById('council-detail-publish-pill');
  if (pubPillEl) {
    pubPillEl.innerHTML = isPub
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">📢 Đã công bố (${pubInfo?.publishedAt ? new Date(pubInfo.publishedAt).toLocaleDateString('vi-VN') : ''})</span>`
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Chưa công bố</span>';
  }

  // Members scoring breakdown
  const tbody = document.getElementById('council-detail-members-tbody');
  let validVoteCount = 0;
  let totalAssignedScorers = 0;

  if (tbody) {
    if (council && act) {
      const slots = (typeof window.getCouncilMemberSlots === 'function')
        ? window.getCouncilMemberSlots(council, act)
        : (Array.isArray(council.memberSlots) ? council.memberSlots : (act.councilStructure?.slots || []));
      const membersBySlot = council.membersBySlot || {};

      const resolveScorerId = (typeof window.getCouncilMemberScorerId === 'function')
        ? window.getCouncilMemberScorerId
        : (m => {
            if (!m) return '';
            const email = String(m.memberEmail || m.email || '').toLowerCase().trim();
            return (m.type === 'guest' || m.isExternalGuest || (email && !email.endsWith('@tdtu.edu.vn')))
              ? email || m.memberId || ''
              : m.memberId || email || m.memberName || '';
          });

      const escapeFn = (typeof window.escapeHtml === 'function') ? window.escapeHtml : (str => String(str || '').replace(/[&<>"']/g, ''));

      tbody.innerHTML = slots.map((s, idx) => {
        const assigned = membersBySlot[s.key] || {};
        const scorerId = resolveScorerId(assigned);
        const memberName = assigned.memberName || assigned.name || (scorerId ? scorerId : '(Chưa phân công)');
        const roleLabel = assigned.role || s.label || s.name || s.key;

        if (assigned.memberName || assigned.name || scorerId) {
          totalAssignedScorers++;
        }

        let memberLetter = '--';
        let memberNum = '--';
        let statusHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Chưa chấm</span>';

        let sc = null;
        if (scorerId) {
          const k = `${act.id}_${council.id}_${sid}_${scorerId}`;
          const kEmail = assigned.memberEmail ? `${act.id}_${council.id}_${sid}_${String(assigned.memberEmail).toLowerCase().trim()}` : null;
          const kMemberId = assigned.memberId ? `${act.id}_${council.id}_${sid}_${String(assigned.memberId).trim()}` : null;

          sc = state.councilScores?.[k]
            || (kEmail ? state.councilScores?.[kEmail] : null)
            || (kMemberId ? state.councilScores?.[kMemberId] : null)
            || targetRound?.councilScores?.[k]
            || (kEmail ? targetRound?.councilScores?.[kEmail] : null)
            || (kMemberId ? targetRound?.councilScores?.[kMemberId] : null)
            || targetRound?.councilRubricScores?.[k]
            || (kEmail ? targetRound?.councilRubricScores?.[kEmail] : null);

          if (!sc && state.councilScores) {
            sc = Object.values(state.councilScores).find(item =>
              item && item.studentId === sid && item.councilId === council.id && (
                item.scorerId === scorerId ||
                (assigned.memberEmail && String(item.scorerEmail || item.decidedBy || '').toLowerCase() === String(assigned.memberEmail).toLowerCase()) ||
                (assigned.memberId && item.scorerId === assigned.memberId) ||
                item.slotKey === s.key
              )
            ) || null;
          }

          if (sc && sc.status === 'completed') {
            validVoteCount++;
            memberLetter = sc.value || sc.selectedLetterCode || '--';
            if (sc.numericValue !== undefined && sc.numericValue !== null) {
              memberNum = Number(sc.numericValue).toFixed(2);
            } else if (typeof sc.value === 'number') {
              memberNum = Number(sc.value).toFixed(2);
            }
            statusHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ Đã chấm</span>';
          } else if (sc && sc.status === 'draft') {
            memberLetter = sc.value || '--';
            if (sc.numericValue !== undefined && sc.numericValue !== null) memberNum = Number(sc.numericValue).toFixed(2);
            statusHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Đang chấm (nháp)</span>';
          }
        }

        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-2.5 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
            <td class="p-2.5 font-bold text-slate-800 whitespace-nowrap">${escapeFn(roleLabel)}</td>
            <td class="p-2.5 text-slate-700 whitespace-nowrap">${escapeFn(memberName)}</td>
            <td class="p-2.5 text-center font-mono font-bold text-purple-900">${escapeFn(memberLetter)}</td>
            <td class="p-2.5 text-center font-mono text-slate-600">${escapeFn(memberNum)}</td>
            <td class="p-2.5 text-center whitespace-nowrap">${statusHtml}</td>
          </tr>
        `;
      }).join('');

      if (validVoteCount < totalAssignedScorers && typeof window !== 'undefined' && !window._fetchingCouncilReviewDecisions) {
        const dbObj = window.db || (typeof db !== 'undefined' ? db : null);
        const colFn = window.collection;
        const qFn = window.query;
        const whereFn = window.where;
        const getDocsFn = window.getDocs;
        if (dbObj && colFn && qFn && whereFn && getDocsFn && targetRound?.id && council?.id) {
          window._fetchingCouncilReviewDecisions = true;
          const q = qFn(
            colFn(dbObj, 'graduationRounds', targetRound.id, 'reviewDecisions'),
            whereFn('councilId', '==', council.id),
            whereFn('studentId', '==', sid)
          );
          getDocsFn(q).then(snap => {
            window._fetchingCouncilReviewDecisions = false;
            if (snap && !snap.empty) {
              let updated = false;
              state.councilScores = state.councilScores || {};
              snap.docs.forEach(docSnap => {
                const data = docSnap.data();
                if (data && data.scorerId) {
                  const key = `${data.activityId || act.id}_${data.councilId || council.id}_${sid}_${data.scorerId}`;
                  state.councilScores[key] = data;
                  if (data.scorerEmail) {
                    state.councilScores[`${data.activityId || act.id}_${data.councilId || council.id}_${sid}_${String(data.scorerEmail).toLowerCase().trim()}`] = data;
                  }
                  updated = true;
                }
              });
              if (updated) {
                openCouncilScoreDetailModal(sid, pNum);
              }
            }
          }).catch(err => {
            window._fetchingCouncilReviewDecisions = false;
            console.warn('Review decisions async lookup notice:', err);
          });
        }
      }
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Không tìm thấy thông tin thành viên Hội đồng.</td></tr>';
    }
  }

  // Summary section
  const validVotesEl = document.getElementById('council-detail-valid-votes');
  const finalLetterEl = document.getElementById('council-detail-final-letter');
  const finalNumEl = document.getElementById('council-detail-final-num');

  if (validVotesEl) validVotesEl.textContent = `Hợp lệ: ${validVoteCount}/${totalAssignedScorers}`;
  if (finalLetterEl) finalLetterEl.textContent = reviewData.letterGrade || '--';
  if (finalNumEl) finalNumEl.textContent = reviewData.referenceScore || '--';

  const verdictEl = document.getElementById('council-detail-verdict-badge');
  if (verdictEl) {
    if (reviewData.isFinalized) {
      if (reviewData.isPassed) {
        verdictEl.innerHTML = '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đạt yêu cầu</span>';
      } else {
        verdictEl.innerHTML = '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Không đạt yêu cầu</span>';
      }
    } else {
      verdictEl.innerHTML = '<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa duyệt</span>';
    }
  }

  currentCouncilDetailContext = {
    studentId: sid,
    studentName,
    phase: pNum,
    targetRound,
    act,
    council,
    letterGrade: reviewData.letterGrade,
    numericScore: reviewData.score,
    isPassed: reviewData.isPassed,
    isFinalized: reviewData.isFinalized
  };

  const btnAdjust = document.getElementById('btn-open-adjust-council-score');
  if (btnAdjust) {
    btnAdjust.style.display = isAdminOrOwner ? 'inline-flex' : 'none';
  }

  modal.classList.remove('hidden');
}

export function closeCouncilScoreDetailModal() {
  const modal = document.getElementById('modal-council-score-details');
  if (modal) modal.classList.add('hidden');
}

let currentRevokePhase = null;
let currentCouncilDetailContext = null;

export function openRevokeProgressReviewModal(phase) {
  const isAdminOrOwner = (typeof state !== 'undefined' && state.isAdmin && !state.impersonation) || (typeof isUserAdminOrOwner === 'function' && isUserAdminOrOwner());
  if (!isAdminOrOwner) {
    if (typeof showToast === 'function') showToast('Chỉ Quản trị viên và Chủ sở hữu mới có quyền thu hồi công bố.', 'warning');
    return;
  }

  const pNum = Number(phase);
  currentRevokePhase = pNum;
  const targetRound = (typeof state !== 'undefined' && (state.rounds || []).find(r => r.id === state.selectedRoundId)) || state?.activeRound;
  if (!targetRound) return;

  const modal = document.getElementById('modal-revoke-progress-review');
  if (!modal) return;

  const pubInfo = getProgressReviewPublicationInfo(pNum, targetRound);
  const badgeEl = document.getElementById('revoke-review-phase-badge');
  const subEl = document.getElementById('revoke-review-subtitle');
  const atEl = document.getElementById('revoke-review-published-at');
  const byEl = document.getElementById('revoke-review-published-by');

  if (badgeEl) badgeEl.textContent = `Duyệt đợt ${pNum}`;
  if (subEl) subEl.textContent = `Đợt: ${targetRound.name || targetRound.title || targetRound.id}`;
  if (atEl) atEl.textContent = pubInfo?.publishedAt ? new Date(pubInfo.publishedAt).toLocaleString('vi-VN') : '--';
  if (byEl) byEl.textContent = pubInfo?.publishedBy || 'Quản trị viên';

  const reasonInput = document.getElementById('revoke-publish-reason');
  const chkConfirm = document.getElementById('chk-confirm-revoke-publish');
  const btnConfirm = document.getElementById('btn-confirm-revoke-publish');

  if (reasonInput) reasonInput.value = '';
  if (chkConfirm) chkConfirm.checked = false;
  if (btnConfirm) btnConfirm.disabled = true;

  modal.classList.remove('hidden');
}

export function closeRevokeProgressReviewModal() {
  const modal = document.getElementById('modal-revoke-progress-review');
  if (modal) modal.classList.add('hidden');
}

export function onRevokeReasonInputChanged() {
  const reason = document.getElementById('revoke-publish-reason')?.value?.trim() || '';
  const chk = document.getElementById('chk-confirm-revoke-publish')?.checked || false;
  const btn = document.getElementById('btn-confirm-revoke-publish');
  if (btn) {
    btn.disabled = !(reason.length >= 10 && chk);
  }
}

export async function confirmRevokeProgressReview() {
  const phase = currentRevokePhase;
  if (!phase) return;

  const isAdminOrOwner = (typeof state !== 'undefined' && state.isAdmin && !state.impersonation) || (typeof isUserAdminOrOwner === 'function' && isUserAdminOrOwner());
  if (!isAdminOrOwner) {
    if (typeof showToast === 'function') showToast('Chỉ Quản trị viên và Chủ sở hữu mới có quyền thu hồi công bố.', 'warning');
    return;
  }

  const targetRound = (typeof state !== 'undefined' && (state.rounds || []).find(r => r.id === state.selectedRoundId)) || state?.activeRound;
  if (!targetRound) return;

  const reason = document.getElementById('revoke-publish-reason')?.value?.trim() || '';
  if (reason.length < 10) {
    if (typeof showToast === 'function') showToast('Vui lòng nhập lý do thu hồi (tối thiểu 10 ký tự).', 'warning');
    return;
  }

  const chk = document.getElementById('chk-confirm-revoke-publish')?.checked || false;
  if (!chk) {
    if (typeof showToast === 'function') showToast('Vui lòng tích xác nhận thu hồi công bố.', 'warning');
    return;
  }

  const btnConfirm = document.getElementById('btn-confirm-revoke-publish');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<span>⏳</span> <span>Đang thu hồi...</span>';
  }

  try {
    const act = findProgressReviewActivity(targetRound, phase);
    const pKey = 'duyet_' + phase;
    const prevPub = (targetRound.publishedReviews && targetRound.publishedReviews[pKey]) || {};

    const currentUserEmail = (typeof state !== 'undefined' && state.user?.email) || 'admin';
    const revokeTimestamp = new Date().toISOString();

    const revokeRecord = {
      ...prevPub,
      status: 'revoked',
      isPublished: false,
      revokedAt: revokeTimestamp,
      revokedBy: currentUserEmail,
      revokeReason: reason
    };

    const roundDocRevokeMetadata = {
      status: 'revoked',
      isPublished: false,
      revokedAt: revokeTimestamp,
      revokedBy: currentUserEmail,
      revokeReason: reason,
      activityId: act ? act.id : `act_duyet_${phase}`,
      phase: Number(phase),
      roundId: targetRound.id
    };

    targetRound.publishedReviews = targetRound.publishedReviews || {};
    targetRound.publishedReviews[pKey] = revokeRecord;

    const rawUpdate = (typeof window !== 'undefined') ? (window.updateDoc || window.rawUpdateDoc) : null;
    const rawSet = (typeof window !== 'undefined') ? (window.setDoc || window.rawSetDoc) : null;
    const docFn = (typeof window !== 'undefined') ? window.doc : null;
    const dbObj = (typeof window !== 'undefined') ? (window.db || (typeof db !== 'undefined' ? db : null)) : null;

    if (dbObj && rawUpdate && docFn) {
      const roundRef = docFn(dbObj, 'graduationRounds', targetRound.id);
      await rawUpdate(roundRef, {
        [`publishedReviews.${pKey}`]: roundDocRevokeMetadata,
        updatedAt: (typeof window.serverTimestamp === 'function') ? window.serverTimestamp() : revokeTimestamp
      });

      try {
        if (rawSet) {
          const subDocRef = docFn(dbObj, 'graduationRounds', targetRound.id, 'publishedProgressReviews', pKey);
          await rawSet(subDocRef, revokeRecord);

          if (prevPub.studentResults) {
            for (const stId of Object.keys(prevPub.studentResults)) {
              const stDocRef = docFn(dbObj, 'graduationRounds', targetRound.id, 'publishedStudentResults', stId);
              await rawUpdate(stDocRef, {
                [`reviews.${pKey}.status`]: 'revoked',
                [`reviews.${pKey}.isPublished`]: false,
                [`reviews.${pKey}.revokedAt`]: revokeTimestamp,
                [`reviews.${pKey}.revokeReason`]: reason,
                status: 'revoked',
                isPublished: false,
                revokedAt: revokeTimestamp
              }).catch(() => {});
            }
          }

          if (typeof state !== 'undefined' && state.cachedPublishedResults) {
            delete state.cachedPublishedResults;
          }

          const auditRef = docFn(dbObj, 'auditLogs', `audit_revoke_${targetRound.id}_${pKey}_${Date.now()}`);
          await rawSet(auditRef, {
            action: 'REVOKE_PROGRESS_REVIEW_PUBLISH',
            roundId: targetRound.id,
            phase: Number(phase),
            activityId: act ? act.id : `act_duyet_${phase}`,
            reason: reason,
            performedBy: currentUserEmail,
            timestamp: (typeof window.serverTimestamp === 'function') ? window.serverTimestamp() : revokeTimestamp
          });
        }
      } catch (subErr) {
        console.warn('[RevokeReview] Non-blocking subcollection error:', subErr.message);
      }
    }

    closeRevokeProgressReviewModal();
    renderPublishProgressReviewToolbar(phase);
    renderAdminProgressReviewTable(phase);
    if (typeof showToast === 'function') {
      showToast(`✓ Đã thu hồi công bố kết quả Duyệt đợt ${phase} thành công.`, 'success');
    }
  } catch (err) {
    console.error('[RevokeReview] Error:', err);
    if (typeof showToast === 'function') showToast(`Lỗi thu hồi công bố: ${err.message}`, 'error');
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<span>↩️</span> <span>Xác nhận Thu hồi</span>';
    }
  }
}

export function openAdjustCouncilScoreModal() {
  const isAdminOrOwner = (typeof state !== 'undefined' && state.isAdmin && !state.impersonation) || (typeof isUserAdminOrOwner === 'function' && isUserAdminOrOwner());
  if (!isAdminOrOwner) {
    if (typeof showToast === 'function') showToast('Chỉ Quản trị viên và Chủ sở hữu mới có quyền điều chỉnh điểm.', 'warning');
    return;
  }

  const ctx = currentCouncilDetailContext;
  if (!ctx || !ctx.targetRound) {
    if (typeof showToast === 'function') showToast('Không tìm thấy ngữ cảnh đánh giá của sinh viên.', 'error');
    return;
  }

  const modal = document.getElementById('modal-adjust-council-score');
  if (!modal) return;

  const isPub = isProgressReviewPublished(ctx.phase || 1, ctx.targetRound);
  const warnEl = document.getElementById('adjust-score-published-warning');
  const formEl = document.getElementById('adjust-score-form-fields');
  const btnConfirm = document.getElementById('btn-confirm-adjust-score');

  if (isPub) {
    if (warnEl) warnEl.classList.remove('hidden');
    if (formEl) formEl.classList.add('opacity-50', 'pointer-events-none');
    if (btnConfirm) btnConfirm.disabled = true;
    if (typeof showToast === 'function') {
      showToast('Đợt duyệt đang ở trạng thái ĐÃ CÔNG BỐ. Hãy thực hiện Thu hồi công bố trước khi điều chỉnh điểm.', 'warning');
    }
  } else {
    if (warnEl) warnEl.classList.add('hidden');
    if (formEl) formEl.classList.remove('opacity-50', 'pointer-events-none');
  }

  const phaseBadgeEl = document.getElementById('adjust-score-phase-badge');
  const subtitleEl = document.getElementById('adjust-score-subtitle');
  const stInfoEl = document.getElementById('adjust-score-student-info');
  const councilInfoEl = document.getElementById('adjust-score-council-info');
  const curLetterEl = document.getElementById('adjust-score-current-letter');
  const curNumEl = document.getElementById('adjust-score-current-num');
  const curVerdictEl = document.getElementById('adjust-score-current-verdict');

  if (phaseBadgeEl) phaseBadgeEl.textContent = `Duyệt đợt ${ctx.phase || 1}`;
  if (subtitleEl) subtitleEl.textContent = `Đợt: ${ctx.targetRound.name || ctx.targetRound.title || ctx.targetRound.id} • Hội đồng: ${ctx.council?.name || 'Chưa gán'}`;
  if (stInfoEl) stInfoEl.textContent = `${ctx.studentName} (${ctx.studentId})`;
  if (councilInfoEl) councilInfoEl.textContent = ctx.council?.name || 'Hội đồng';
  if (curLetterEl) curLetterEl.textContent = ctx.letterGrade || '--';
  if (curNumEl) curNumEl.textContent = (ctx.numericScore !== null && ctx.numericScore !== undefined) ? `(${Number(ctx.numericScore).toFixed(2)})` : '(--)';
  if (curVerdictEl) {
    if (ctx.isFinalized) {
      curVerdictEl.innerHTML = ctx.isPassed
        ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đạt yêu cầu</span>'
        : '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Không đạt</span>';
    } else {
      curVerdictEl.innerHTML = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa duyệt</span>';
    }
  }

  const letterSelect = document.getElementById('adjust-score-new-letter');
  const basisInput = document.getElementById('adjust-score-basis');
  const reasonInput = document.getElementById('adjust-score-reason');
  const chkConfirm = document.getElementById('chk-confirm-adjust-score');
  const previewBox = document.getElementById('adjust-score-new-preview');

  if (letterSelect) letterSelect.value = '';
  if (basisInput) basisInput.value = '';
  if (reasonInput) reasonInput.value = '';
  if (chkConfirm) chkConfirm.checked = false;
  if (previewBox) previewBox.classList.add('hidden');
  if (btnConfirm) btnConfirm.disabled = true;

  modal.classList.remove('hidden');
}

export function closeAdjustCouncilScoreModal() {
  const modal = document.getElementById('modal-adjust-council-score');
  if (modal) modal.classList.add('hidden');
}

const LETTER_SCORE_MAP = {
  'A': { score: 9.0, label: 'Xuất sắc', passed: true },
  'A-': { score: 8.2, label: 'Giỏi', passed: true },
  'B+': { score: 7.7, label: 'Khá giỏi', passed: true },
  'B': { score: 7.2, label: 'Khá', passed: true },
  'B-': { score: 6.7, label: 'Trung bình khá', passed: true },
  'C+': { score: 6.2, label: 'Trung bình', passed: false },
  'C': { score: 5.7, label: 'Trung bình yếu', passed: false },
  'F': { score: 0.0, label: 'Kém', passed: false }
};

export function onAdjustScoreLetterChanged() {
  const letter = document.getElementById('adjust-score-new-letter')?.value;
  const previewBox = document.getElementById('adjust-score-new-preview');
  const previewNum = document.getElementById('adjust-score-preview-num');
  const previewVerdict = document.getElementById('adjust-score-preview-verdict');

  if (letter && LETTER_SCORE_MAP[letter]) {
    const item = LETTER_SCORE_MAP[letter];
    if (previewNum) previewNum.textContent = item.score.toFixed(1);
    if (previewVerdict) {
      previewVerdict.innerHTML = item.passed
        ? '<span class="text-emerald-700 font-bold">✓ Đạt yêu cầu</span>'
        : '<span class="text-rose-700 font-bold">✕ Không đạt</span>';
    }
    if (previewBox) previewBox.classList.remove('hidden');
  } else {
    if (previewBox) previewBox.classList.add('hidden');
  }

  onAdjustScoreInputChanged();
}

export function onAdjustScoreInputChanged() {
  const ctx = currentCouncilDetailContext;
  const isPub = ctx ? isProgressReviewPublished(ctx.phase || 1, ctx.targetRound) : false;

  const letter = document.getElementById('adjust-score-new-letter')?.value || '';
  const basis = document.getElementById('adjust-score-basis')?.value?.trim() || '';
  const reason = document.getElementById('adjust-score-reason')?.value?.trim() || '';
  const chk = document.getElementById('chk-confirm-adjust-score')?.checked || false;
  const btn = document.getElementById('btn-confirm-adjust-score');

  const isValid = !isPub && Boolean(letter) && basis.length > 0 && reason.length >= 10 && chk;
  if (btn) btn.disabled = !isValid;
}

export async function confirmAdjustCouncilScore() {
  const ctx = currentCouncilDetailContext;
  if (!ctx || !ctx.targetRound || !ctx.council) {
    if (typeof showToast === 'function') showToast('Không tìm thấy thông tin hội đồng cần điều chỉnh.', 'error');
    return;
  }

  const isAdminOrOwner = (typeof state !== 'undefined' && state.isAdmin && !state.impersonation) || (typeof isUserAdminOrOwner === 'function' && isUserAdminOrOwner());
  if (!isAdminOrOwner) {
    if (typeof showToast === 'function') showToast('Chỉ Quản trị viên và Chủ sở hữu mới có quyền điều chỉnh điểm.', 'warning');
    return;
  }

  const isPub = isProgressReviewPublished(ctx.phase || 1, ctx.targetRound);
  if (isPub) {
    if (typeof showToast === 'function') showToast('Đợt duyệt đang công bố. Bạn cần Thu hồi công bố trước khi điều chỉnh điểm.', 'error');
    return;
  }

  const letter = document.getElementById('adjust-score-new-letter')?.value;
  const basis = document.getElementById('adjust-score-basis')?.value?.trim() || '';
  const reason = document.getElementById('adjust-score-reason')?.value?.trim() || '';
  const chk = document.getElementById('chk-confirm-adjust-score')?.checked || false;

  if (!letter || !LETTER_SCORE_MAP[letter]) {
    if (typeof showToast === 'function') showToast('Vui lòng chọn mức điểm chữ hợp lệ.', 'warning');
    return;
  }
  if (!basis) {
    if (typeof showToast === 'function') showToast('Vui lòng nhập căn cứ / số biên bản họp.', 'warning');
    return;
  }
  if (reason.length < 10) {
    if (typeof showToast === 'function') showToast('Vui lòng nhập lý do điều chỉnh (tối thiểu 10 ký tự).', 'warning');
    return;
  }
  if (!chk) {
    if (typeof showToast === 'function') showToast('Vui lòng tích xác nhận điều chỉnh kết quả.', 'warning');
    return;
  }

  const btnConfirm = document.getElementById('btn-confirm-adjust-score');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<span>⏳</span> <span>Đang lưu...</span>';
  }

  try {
    const mapped = LETTER_SCORE_MAP[letter];
    const newScore = mapped.score;
    const newVerdict = mapped.passed ? 'passed' : 'failed';
    const currentUserEmail = (typeof state !== 'undefined' && state.user?.email) || 'admin';
    const adjustTimestamp = new Date().toISOString();

    const scorePayload = {
      score: newScore,
      formattedScore: letter,
      letterGrade: letter,
      letterLabel: mapped.label,
      isPassed: mapped.passed,
      verdict: newVerdict,
      isFinalized: true,
      adjusted: true,
      adjustedAt: adjustTimestamp,
      adjustedBy: currentUserEmail,
      adjustReason: reason,
      adjustBasis: basis
    };

    // Update in-memory council
    ctx.council.finalDefenseScores = ctx.council.finalDefenseScores || {};
    ctx.council.finalDefenseScores[ctx.studentId] = scorePayload;

    // Update round-level cache if present
    ctx.targetRound.councilScores = ctx.targetRound.councilScores || {};
    ctx.targetRound.councilScores[`${ctx.act?.id}_${ctx.council.id}_${ctx.studentId}`] = scorePayload;

    if (typeof state !== 'undefined' && state.councilScores) {
      state.councilScores[`${ctx.act?.id}_${ctx.council.id}_${ctx.studentId}`] = scorePayload;
    }

    const rawUpdate = (typeof window !== 'undefined') ? (window.updateDoc || window.rawUpdateDoc) : null;
    const rawSet = (typeof window !== 'undefined') ? (window.setDoc || window.rawSetDoc) : null;
    const docFn = (typeof window !== 'undefined') ? window.doc : null;
    const dbObj = (typeof window !== 'undefined') ? (window.db || (typeof db !== 'undefined' ? db : null)) : null;

    if (dbObj && docFn) {
      // 1. Persist to private grading subcollection reviewDecisions
      try {
        if (rawSet) {
          const decisionKey = `${ctx.act?.id}_${ctx.council.id}_${ctx.studentId}_official`;
          const decRef = docFn(dbObj, 'graduationRounds', ctx.targetRound.id, 'reviewDecisions', decisionKey);
          await rawSet(decRef, {
            ...scorePayload,
            activityId: ctx.act?.id,
            councilId: ctx.council.id,
            studentId: ctx.studentId,
            scorerId: 'official_adjusted',
            scorerEmail: currentUserEmail,
            decidedBy: currentUserEmail,
            mode: 'letter',
            value: letter,
            selectedLetterCode: letter,
            numericValue: newScore,
            status: 'completed'
          }, { merge: true });
        }
      } catch (decErr) {
        console.warn('[AdjustScore] Review decision subcollection notice:', decErr.message);
      }

      // 2. Touch root round document updatedAt ONLY without leaking score fields
      if (rawUpdate) {
        const roundRef = docFn(dbObj, 'graduationRounds', ctx.targetRound.id);
        await rawUpdate(roundRef, {
          updatedAt: (typeof window.serverTimestamp === 'function') ? window.serverTimestamp() : adjustTimestamp
        }).catch(() => {});
      }

      // 3. Write immutable audit log
      try {
        if (rawSet) {
          const auditRef = docFn(dbObj, 'auditLogs', `audit_adjust_${ctx.targetRound.id}_${ctx.studentId}_${Date.now()}`);
          await rawSet(auditRef, {
            action: 'ADJUST_COUNCIL_SCORE',
            studentId: ctx.studentId,
            studentName: ctx.studentName,
            roundId: ctx.targetRound.id,
            councilId: ctx.council.id,
            councilName: ctx.council.name,
            phase: ctx.phase || 1,
            oldLetter: ctx.letterGrade || '--',
            oldScore: ctx.numericScore,
            oldVerdict: ctx.isPassed ? 'passed' : 'failed',
            newLetter: letter,
            newScore: newScore,
            newVerdict: newVerdict,
            basis: basis,
            reason: reason,
            performedBy: currentUserEmail,
            timestamp: (typeof window.serverTimestamp === 'function') ? window.serverTimestamp() : adjustTimestamp
          });
        }
      } catch (auditErr) {
        console.warn('[AdjustScore] Non-blocking audit error:', auditErr.message);
      }
    }

    closeAdjustCouncilScoreModal();
    openCouncilScoreDetailModal(ctx.studentId, ctx.phase || 1);
    renderAdminProgressReviewTable(ctx.phase || 1);

    if (typeof showToast === 'function') {
      showToast(`✓ Đã điều chỉnh điểm của sinh viên ${ctx.studentId} thành ${letter} (${newScore.toFixed(1)}).`, 'success');
    }
  } catch (err) {
    console.error('[AdjustScore] Error:', err);
    if (typeof showToast === 'function') showToast(`Lỗi điều chỉnh điểm: ${err.message}`, 'error');
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<span>✏️</span> <span>Xác nhận Điều chỉnh</span>';
    }
  }
}

if (typeof window !== 'undefined') {
  window.isProgressReviewPassed = isProgressReviewPassed;
  window.isProgressReviewPublished = isProgressReviewPublished;
  window.getProgressReviewPublicationInfo = getProgressReviewPublicationInfo;
  window.renderPublishProgressReviewToolbar = renderPublishProgressReviewToolbar;
  window.openPublishProgressReviewModal = openPublishProgressReviewModal;
  window.closePublishProgressReviewModal = closePublishProgressReviewModal;
  window.confirmPublishProgressReview = confirmPublishProgressReview;
  window.onPartialPublishCheckboxChanged = onPartialPublishCheckboxChanged;
  window.openCouncilScoreDetailModal = openCouncilScoreDetailModal;
  window.closeCouncilScoreDetailModal = closeCouncilScoreDetailModal;
  window.findProgressReviewActivity = findProgressReviewActivity;
  window.getProgressReviewData = getProgressReviewData;

  // Revoke & Adjust bindings (Nhóm E)
  window.openRevokeProgressReviewModal = openRevokeProgressReviewModal;
  window.closeRevokeProgressReviewModal = closeRevokeProgressReviewModal;
  window.onRevokeReasonInputChanged = onRevokeReasonInputChanged;
  window.confirmRevokeProgressReview = confirmRevokeProgressReview;
  window.openAdjustCouncilScoreModal = openAdjustCouncilScoreModal;
  window.closeAdjustCouncilScoreModal = closeAdjustCouncilScoreModal;
  window.onAdjustScoreLetterChanged = onAdjustScoreLetterChanged;
  window.onAdjustScoreInputChanged = onAdjustScoreInputChanged;
  window.confirmAdjustCouncilScore = confirmAdjustCouncilScore;
}

window.renderAdminProgressReviewTable = function(phase) {
  // Update publish toolbar
  renderPublishProgressReviewToolbar(phase);

  const tbody = document.getElementById('admin-duyet-' + phase + '-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = getScoringRoundStudents(targetRound);

  const q = String(document.getElementById('admin-duyet-' + phase + '-search')?.value || '').toLowerCase().trim();
  const filterVal = document.getElementById('admin-duyet-' + phase + '-filter')?.value || 'all';

  const filtered = allStudents.filter(s => {
    const sid = (s.mssv || s.studentId || '').toLowerCase();
    const name = (s.fullName || s.studentName || '').toLowerCase();
    const topic = (s.topicTitle || '').toLowerCase();
    const supName = String(s.acceptedSupervisorName || s.supervisorName || '').toLowerCase();
    if (q && !sid.includes(q) && !name.includes(q) && !topic.includes(q) && !supName.includes(q)) return false;

    const reviewData = getProgressReviewData(s.mssv || s.studentId, phase, targetRound);
    const status = reviewData.status || 'pending';

    if (filterVal === 'passed') {
      return status === 'passed' || (reviewData.isPassed && reviewData.isFinalized);
    }
    if (filterVal === 'failed') {
      return status === 'failed' || (!reviewData.isPassed && reviewData.isFinalized);
    }
    if (filterVal === 'revision') {
      return status === 'revision';
    }
    if (filterVal === 'pending') {
      return status === 'pending' || !reviewData.isFinalized;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400">Chưa có dữ liệu duyệt tiến độ cho đợt này.</td></tr>';
    return;
  }

  const canViewDetail = (typeof state !== 'undefined' && state.isAdmin && !state.impersonation) || (typeof isUserAdminOrOwner === 'function' && isUserAdminOrOwner());

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = (typeof window !== 'undefined' && typeof window.getOfficialApprovedTopicTitle === 'function')
      ? window.getOfficialApprovedTopicTitle(s, s.topicTitle || '')
      : (s.topicTitle || '');
    const topicDisplay = topic || '<span class="text-slate-400 italic">Chưa đăng ký đề tài</span>';
    const supName = s.acceptedSupervisorName || s.supervisorName || (Array.isArray(s.officialSupervisors) && s.officialSupervisors[0]?.supervisorName) || (Array.isArray(s.supervisors) && s.supervisors[0]?.supervisorName) || (targetRound.supervisors || []).find(sup => sup.id === s.supervisorId)?.name || '--';
    const reviewData = getProgressReviewData(sid, phase, targetRound);
    const status = reviewData.status || 'pending';

    let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa duyệt</span>';
    if (status === 'passed') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đạt yêu cầu</span>';
    } else if (status === 'revision') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">⚠️ Cần bổ sung</span>';
    } else if (status === 'failed') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Không đạt yêu cầu</span>';
    }

    let scoreDisplay = '<span class="text-slate-400 font-mono">--</span>';
    if (reviewData.letterGrade) {
      const refText = reviewData.referenceScore ? ` <span class="text-[10px] text-slate-400 font-normal">(${reviewData.referenceScore})</span>` : '';
      if (canViewDetail) {
        scoreDisplay = `<button type="button" onclick="openCouncilScoreDetailModal('${sid}', ${phase})" class="badge bg-purple-50 hover:bg-purple-100 text-purple-900 font-black font-mono text-xs px-2.5 py-0.5 rounded-lg border border-purple-200 cursor-pointer transition-all shadow-2xs" title="Bấm để xem chi tiết phiếu chấm Hội đồng">${reviewData.letterGrade}</button>${refText}`;
      } else {
        scoreDisplay = `<span class="badge bg-purple-50 text-purple-900 font-black font-mono text-xs px-2.5 py-0.5 rounded-lg border border-purple-200">${reviewData.letterGrade}</span>${refText}`;
      }
    } else if (reviewData.score !== null && reviewData.score !== undefined) {
      if (canViewDetail) {
        scoreDisplay = `<button type="button" onclick="openCouncilScoreDetailModal('${sid}', ${phase})" class="badge bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold font-mono text-xs px-2.5 py-0.5 rounded-lg border border-blue-200 cursor-pointer transition-all shadow-2xs" title="Bấm để xem chi tiết phiếu chấm Hội đồng">${Number(reviewData.score).toFixed(1)}</button>`;
      } else {
        scoreDisplay = `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs px-2.5 py-0.5 rounded-lg border border-blue-200">${Number(reviewData.score).toFixed(1)}</span>`;
      }
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-slate-600 max-w-xs truncate" title="${topic}">${topicDisplay}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap">${supName}</td>
        <td class="p-3 text-center whitespace-nowrap">${statusBadge}</td>
        <td class="p-3 text-center whitespace-nowrap">${scoreDisplay}</td>
      </tr>
    `;
  }).join('');
};

window.renderAdminDefenseScoresTable = function() {
  const tbody = document.getElementById('admin-defense-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = getScoringRoundStudents(targetRound);

  const q = String(document.getElementById('admin-defense-search')?.value || '').toLowerCase().trim();

  const filtered = allStudents.filter(s => {
    const sid = (s.mssv || s.studentId || '').toLowerCase();
    const name = (s.fullName || s.studentName || '').toLowerCase();
    if (q && !sid.includes(q) && !name.includes(q)) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không có dữ liệu sinh viên phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const gvhd = targetRound.supervisorScores?.[sid];
    const gvhdDisplay = gvhd?.status === 'completed'
      ? `<span class="badge bg-emerald-50 text-emerald-800 font-bold font-mono text-xs">${Number(gvhd.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const tmFinal = typeof window.getThesisFinalScore === 'function' ? window.getThesisFinalScore(sid, targetRound.id) : null;
    const tmDisplay = tmFinal !== null
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${tmFinal.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const defScore = typeof window.getStudentDefenseScore === 'function' ? window.getStudentDefenseScore(sid, targetRound.id) : null;
    const defDisplay = defScore !== null
      ? `<strong class="font-mono text-xs text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded-lg">${defScore.toFixed(2)}</strong>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const councilId = targetRound.councilStudentAssignments?.[sid]?.councilId || s.councilId || '--';
    const isFinalized = defScore !== null;
    const statusPill = isFinalized
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã chốt điểm</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Đang đánh giá</span>';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap font-semibold">${councilId}</td>
        <td class="p-3 text-center whitespace-nowrap">${gvhdDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${defDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${statusPill}</td>
      </tr>
    `;
  }).join('');
};

window.loadAdminScoringDashboard = async function(targetRoundId, targetTab = 'duyet-1') {
  const roundId = targetRoundId || state.selectedRoundId || document.getElementById('admin-scoring-round-select')?.value;
  if (roundId) {
    state.selectedRoundId = roundId;
    state.activeRound = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;
  }
  const sel = document.getElementById('admin-scoring-round-select');
  if (sel) {
    sel.innerHTML = (state.rounds || []).map(r =>
      `<option value="${r.id}" ${r.id === state.selectedRoundId ? 'selected' : ''}>${r.title || r.code || r.id}</option>`
    ).join('');
    if (state.selectedRoundId) sel.value = state.selectedRoundId;
  }

  // Ensure review/registration data is loaded for the current roundId
  if (state.selectedRoundId && (typeof window.loadAdminReviewData === 'function')) {
    if (!state.adminReviewData || state.adminReviewData.roundId !== state.selectedRoundId) {
      await window.loadAdminReviewData(state.selectedRoundId);
    }
  }

  const activeNavBtn = document.querySelector('.ascore-nav-btn.bg-slate-900');
  const curSubTab = targetTab || (activeNavBtn ? activeNavBtn.id.replace('ascore-tab-btn-', '') : 'duyet-1');
  switchAdminScoringSubTab(curSubTab);
};

window.onAdminScoringRoundChange = async function(roundId) {
  state.selectedRoundId = roundId;
  state.activeRound = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;
  if (roundId && typeof window.loadAdminReviewData === 'function') {
    if (!state.adminReviewData || state.adminReviewData.roundId !== roundId) {
      await window.loadAdminReviewData(roundId);
    }
  }
  const curSubTab = document.querySelector('.ascore-nav-btn.bg-slate-900')?.id?.replace('ascore-tab-btn-', '') || 'duyet-1';
  switchAdminScoringSubTab(curSubTab);
};

window.renderAdminScoresTable = function() {
  const tbody = document.getElementById('admin-scoring-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = getScoringRoundStudents(targetRound);

  const q = String(document.getElementById('admin-scoring-search')?.value || '').toLowerCase().trim();
  const filterVal = document.getElementById('admin-scoring-filter')?.value || 'all';

  const filtered = allStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '';
    const topic = s.topicTitle || '';
    if (q && !sid.toLowerCase().includes(q) && !name.toLowerCase().includes(q) && !topic.toLowerCase().includes(q)) {
      return false;
    }

    const prelimAvg = getPreliminaryAverage(sid, targetRound.id);
    const gvhdScore = targetRound.supervisorScores?.[sid]?.status === 'completed' ? targetRound.supervisorScores[sid].score : null;
    const tmHdScore = targetRound.thesisScores?.[sid]?.hd?.status === 'completed' ? targetRound.thesisScores[sid].hd.score : null;
    const tmPbScore = targetRound.thesisScores?.[sid]?.pb?.status === 'completed' ? targetRound.thesisScores[sid].pb.score : null;

    if (filterVal === 'missing_prelim' && prelimAvg !== null) return false;
    if (filterVal === 'missing_gvhd' && gvhdScore !== null) return false;
    if (filterVal === 'missing_tm_hd' && tmHdScore !== null) return false;
    if (filterVal === 'missing_tm_pb' && tmPbScore !== null) return false;
    if (filterVal === 'completed') {
      if (prelimAvg === null || gvhdScore === null || tmHdScore === null || tmPbScore === null) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400">Không có dữ liệu sinh viên phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;

    // Sơ khảo
    const prelimAvg = getPreliminaryAverage(sid, targetRound.id);
    const prelimDisplay = prelimAvg !== null
      ? `<span class="badge bg-amber-100 text-amber-900 font-bold font-mono text-xs" title="Full precision: ${prelimAvg}">${prelimAvg.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // GVHD
    const gvhd = targetRound.supervisorScores?.[sid];
    const gvhdDisplay = gvhd?.status === 'completed'
      ? `<span class="badge bg-emerald-100 text-emerald-900 font-bold font-mono text-xs">${Number(gvhd.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // TM HD
    const tmHd = targetRound.thesisScores?.[sid]?.hd;
    const tmHdDisplay = tmHd?.status === 'completed'
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${Number(tmHd.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // TM PB
    const tmPb = targetRound.thesisScores?.[sid]?.pb;
    const tmPbDisplay = tmPb?.status === 'completed'
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${Number(tmPb.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // TM FINAL
    const tmFinal = typeof window.getThesisFinalScore === 'function' ? window.getThesisFinalScore(sid, targetRound.id) : null;
    const tmFinalDisplay = tmFinal !== null
      ? `<strong class="font-mono text-xs text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded-lg" title="Full precision: ${tmFinal}">${tmFinal.toFixed(2)}</strong>`
      : '<span class="text-slate-300 text-[10px] italic">Chưa đủ điểm</span>';

    // BẢO VỆ CHÍNH THỨC & TỔNG KẾT (v2.1.0-beta.1)
    const defScore = typeof window.getStudentDefenseScore === 'function' ? window.getStudentDefenseScore(sid, targetRound.id) : null;
    const defDisplay = defScore !== null
      ? `<span class="badge bg-purple-50 text-purple-900 font-bold font-mono text-xs" title="Full precision: ${defScore}">${defScore.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const finalInfo = typeof window.getFinalScore === 'function'
      ? window.getFinalScore(sid, targetRound.id)
      : { complete: false, missing: ['Chưa đủ điểm'], displayScore: '--' };

    const finalDisplay = finalInfo.complete
      ? `<strong class="font-mono text-sm text-indigo-950 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-200">${finalInfo.displayScore}</strong>`
      : `<span class="text-amber-700 font-semibold text-xs" title="${(finalInfo.missing || []).join(', ')}">Chưa đủ</span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-center whitespace-nowrap">${prelimDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${gvhdDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmHdDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmPbDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmFinalDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${defDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${finalDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap space-x-1">
          <button type="button" onclick="openAdminStudentScoreDetail('${sid}')" class="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs shadow-xs" title="Xem chi tiết các điểm thành phần">
            Điểm
          </button>
          ${finalInfo.complete ? `
            <button type="button" onclick="openFinalScoreDetailModal('${sid}')" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg font-bold text-indigo-700 text-xs shadow-xs" title="Xem công thức & số thực">
              ∑
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
};

// --- 7. ADMIN STUDENT SCORE DETAIL MODAL ---

window.openAdminStudentScoreDetail = function(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;

  document.getElementById('admin-score-detail-title').textContent = `Chi tiết Điểm số: ${sName} (${studentId})`;
  document.getElementById('admin-score-detail-topic').textContent = `Đề tài: ${sObj?.topicTitle || '--'}`;

  // 1. SƠ KHẢO
  const prelimSummary = getPreliminarySummary(studentId, targetRound.id);
  const prelimAvgEl = document.getElementById('admin-score-detail-prelim-avg');
  if (prelimAvgEl) {
    prelimAvgEl.textContent = prelimSummary.average !== null
      ? `TB: ${prelimSummary.average.toFixed(2)} (${prelimSummary.average})`
      : 'TB: Chưa đủ điểm';
  }

  const prelimListEl = document.getElementById('admin-score-detail-prelim-list');
  const allPrelim = [...prelimSummary.scores, ...prelimSummary.excludedScores];
  if (allPrelim.length === 0) {
    prelimListEl.innerHTML = '<div class="text-slate-400 italic">Chưa có giảng viên nào chấm Sơ khảo cho sinh viên này.</div>';
  } else {
    prelimListEl.innerHTML = allPrelim.map(sc => {
      const isEx = sc.reason === 'official_supervisor';
      return `
        <div class="flex items-center justify-between p-2 bg-white rounded-xl border ${isEx ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-800">${sc.scorerName || sc.scorerEmail}</span>
            ${isEx ? '<span class="badge bg-amber-200 text-amber-900 font-bold text-[10px]">Không tính — GVHD</span>' : '<span class="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">Tính vào TB</span>'}
          </div>
          <div class="flex items-center gap-2">
            <span class="font-mono font-black text-sm text-slate-900">${sc.score}</span>
            <span class="text-[10px] text-slate-400 font-mono">${fmt24h(sc.completedAt || sc.updatedAt)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. ĐIỂM GVHD
  const gvhd = targetRound.supervisorScores?.[studentId];
  const gvhdBody = document.getElementById('admin-score-detail-gvhd-body');
  const gvhdActions = document.getElementById('admin-score-detail-gvhd-actions');

  if (gvhd?.status === 'completed') {
    gvhdBody.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <span class="text-slate-500 font-semibold">Người nhập điểm:</span>
          <strong class="text-slate-900 ml-1">${gvhd.submittedByName || gvhd.submittedByEmail}</strong>
          <p class="text-[11px] text-slate-400 mt-0.5">Hoàn tất lúc: ${fmt24h(gvhd.completedAt)}</p>
          ${gvhd.comment ? `<p class="text-slate-700 italic mt-1.5 p-2 bg-slate-50 rounded-lg">"${escapeHtml(gvhd.comment)}"</p>` : ''}
        </div>
        <div class="text-right">
          <span class="text-2xl font-mono font-black text-emerald-700">${Number(gvhd.score).toFixed(1)}</span>
        </div>
      </div>
    `;
    gvhdActions.innerHTML = `
      <button type="button" onclick="reopenSupervisorScore('${studentId}')" class="px-2.5 py-1 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 font-bold rounded-lg text-xs shadow-xs">
        🔄 Mở lại Điểm GVHD
      </button>
    `;
  } else {
    gvhdBody.innerHTML = '<div class="text-slate-400 italic">Chưa có điểm GVHD chính thức.</div>';
    gvhdActions.innerHTML = '';
  }

  // 3. THUYẾT MINH
  const tmHd = targetRound.thesisScores?.[studentId]?.hd;
  const tmPb = targetRound.thesisScores?.[studentId]?.pb;
  const tmFinal = getThesisFinalScore(studentId, targetRound.id);

  const tmFinalEl = document.getElementById('admin-score-detail-tm-final');
  if (tmFinalEl) {
    tmFinalEl.textContent = tmFinal !== null
      ? `TM FINAL: ${tmFinal.toFixed(2)} (${tmFinal})`
      : 'TM FINAL: Chưa đủ điểm';
  }

  document.getElementById('admin-score-detail-tm-hd-card').innerHTML = `
    <span class="font-bold text-slate-700 block mb-1">TM HD (GVHD Thuyết minh):</span>
    ${tmHd?.status === 'completed' ? `
      <div class="flex items-center justify-between">
        <span class="font-mono font-black text-lg text-blue-700">${Number(tmHd.score).toFixed(1)}</span>
        <span class="text-[10px] text-slate-400">${tmHd.submittedByName || 'GVHD'}</span>
      </div>
    ` : '<span class="text-slate-400 italic">Chưa chấm</span>'}
  `;

  document.getElementById('admin-score-detail-tm-pb-card').innerHTML = `
    <span class="font-bold text-slate-700 block mb-1">TM PB (GVPB Thuyết minh):</span>
    ${tmPb?.status === 'completed' ? `
      <div class="flex items-center justify-between">
        <span class="font-mono font-black text-lg text-blue-700">${Number(tmPb.score).toFixed(1)}</span>
        <span class="text-[10px] text-slate-400">${tmPb.reviewerName || 'GVPB'}</span>
      </div>
    ` : '<span class="text-slate-400 italic">Chưa chấm</span>'}
  `;

  document.getElementById('modal-admin-score-detail')?.classList.remove('hidden');
};

window.closeAdminStudentScoreDetail = function() {
  document.getElementById('modal-admin-score-detail')?.classList.add('hidden');
};

window.reopenSupervisorScore = async function(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const confirmed = await showConfirm(
    'Mở lại Điểm GVHD',
    'Bạn có chắc chắn muốn mở lại Điểm GVHD cho sinh viên này không? Giảng viên hướng dẫn sẽ có thể nhập và hoàn tất lại điểm.',
    { confirmText: 'Mở lại', danger: true }
  );
  if (!confirmed) return;

  if (targetRound.supervisorScores?.[studentId]) {
    targetRound.supervisorScores[studentId].status = 'reopened';
    targetRound.supervisorScores[studentId].updatedAt = new Date().toISOString();
  }

  await persistScoreItem(targetRound.id, `supervisorScores.${studentId}.status`, 'reopened', `sup_${studentId}`);
  openAdminStudentScoreDetail(studentId);
  renderAdminScoresTable();
  showToast('Đã mở lại Điểm GVHD thành công.', 'info');
// --- 8. ADMIN PRELIMINARY CONFIG & SUPERVISOR CONFIG ---

// ==========================================
// TẦNG C HELPER: ĐỌC KẾT QUẢ CÔNG BỐ AN TOÀN CHO SINH VIÊN VÀ GVHD
// ==========================================
export async function getStudentPublishedReviewResult(roundId, studentId, phase) {
  if (!roundId || !studentId || !phase) return null;
  const pKey = 'duyet_' + phase;
  const sid = String(studentId).trim();

  // 1. Check in-memory state cache
  if (typeof state !== 'undefined') {
    state.cachedPublishedResults = state.cachedPublishedResults || {};
    const cacheKey = `${roundId}_${sid}`;
    if (state.cachedPublishedResults[cacheKey]) {
      const cachedDoc = state.cachedPublishedResults[cacheKey];
      if (cachedDoc.status !== 'revoked' && cachedDoc.reviews?.[pKey]?.status === 'published') {
        return cachedDoc.reviews[pKey];
      }
      if (cachedDoc.status === 'revoked' || cachedDoc.reviews?.[pKey]?.status === 'revoked') {
        return { status: 'revoked', isPublished: false };
      }
    }
  }

  // 2. Query Firestore subcollection publishedStudentResults
  try {
    const dbObj = (typeof window !== 'undefined') ? (window.db || (typeof db !== 'undefined' ? db : null)) : null;
    const docFn = (typeof window !== 'undefined') ? (window.doc || (typeof doc !== 'undefined' ? doc : null)) : null;
    const getDocFn = (typeof window !== 'undefined') ? (window.getDoc || (typeof getDoc !== 'undefined' ? getDoc : null)) : null;

    if (dbObj && docFn && getDocFn) {
      const stDocRef = docFn(dbObj, 'graduationRounds', roundId, 'publishedStudentResults', sid);
      const snap = await getDocFn(stDocRef);
      if (snap && snap.exists()) {
        const data = snap.data();
        if (typeof state !== 'undefined') {
          state.cachedPublishedResults = state.cachedPublishedResults || {};
          state.cachedPublishedResults[`${roundId}_${sid}`] = data;
        }
        if (data.status !== 'revoked' && data.reviews?.[pKey]?.status === 'published') {
          return data.reviews[pKey];
        }
        if (data.status === 'revoked' || data.reviews?.[pKey]?.status === 'revoked') {
          return { status: 'revoked', isPublished: false };
        }
      }
    }
  } catch (err) {
    // Handled silently: Permission denied (e.g. revoked or unassigned)
  }

  // 3. Fallback to round publishedReviews if present (for test mocks / local admin preview)
  const targetRound = (typeof state !== 'undefined' && ((state.rounds || []).find(r => r.id === roundId) || (state.activeRound?.id === roundId ? state.activeRound : null)));
  if (targetRound) {
    const pubRecord = targetRound.publishedReviews?.[pKey];
    if (pubRecord && (pubRecord.status === 'published' || pubRecord.isPublished === true) && pubRecord.studentResults) {
      const stRes = pubRecord.studentResults[sid]
        || pubRecord.studentResults[sid.toUpperCase()]
        || pubRecord.studentResults[sid.toLowerCase()];
      if (stRes) return stRes;
    }
  }

  return null;
}

if (typeof window !== 'undefined') {
  window.getStudentPublishedReviewResult = getStudentPublishedReviewResult;
}
