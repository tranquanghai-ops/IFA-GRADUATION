/**
 * IFA+ Graduation — Supervisor & Reviewer Score Entry Modals
 */
// ============================================================================
// IFA+ GRADUATION BETA v1.9.0-beta.1: PRELIMINARY + GVHD + THESIS HD/PB
// ============================================================================

// --- 1. CORE CALCULATION & HELPER FUNCTIONS ---

export function getPreliminarySummary(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) return { average: null, count: 0, totalSubmitted: 0, scores: [], excludedScores: [] };

  const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId)
    || (targetRound.eligibleStudents || []).find(s => (s.mssv === studentId || s.studentId === studentId))
    || { studentId };

  const excludedIds = new Set(getPreliminaryExcludedSupervisorIds(reg));
  const allScores = Object.values(targetRound.preliminaryScores || {}).filter(s => s.studentId === studentId);

  const included = [];
  const excluded = [];
  let sum = 0;

  allScores.forEach(sc => {
    const isExcluded = excludedIds.has(sc.scorerId);
    if (isExcluded) {
      excluded.push({ ...sc, reason: 'official_supervisor' });
    } else {
      if (sc.status === 'completed') {
        included.push(sc);
        sum += Number(sc.score);
      }
    }
  });

  // FULL PRECISION (NO intermediate rounding!)
  const average = included.length > 0 ? (sum / included.length) : null;

  return {
    average,
    count: included.length,
    totalSubmitted: allScores.length,
    scores: included,
    excludedScores: excluded
  };
}

export function getPreliminaryAverage(studentId, roundId = null) {
  const summary = getPreliminarySummary(studentId, roundId);
  return summary.average;
}

export function getThesisFinalScore(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) return null;

  const thesis = targetRound.thesisScores?.[studentId];
  if (!thesis || !thesis.hd || !thesis.pb) return null;
  if (thesis.hd.status !== 'completed' || thesis.pb.status !== 'completed') return null;

  // FULL PRECISION: (TM HD + TM PB) / 2
  return (Number(thesis.hd.score) + Number(thesis.pb.score)) / 2;
}

// --- 2. SUPERVISOR ACCEPTED TABLE SCORING CELLS ---

function renderSupervisorScoreCell(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  const sc = targetRound?.supervisorScores?.[studentId];

  if (sc?.status === 'completed') {
    return `
      <div class="flex items-center justify-center gap-1.5">
        <span class="badge bg-emerald-100 text-emerald-800 font-bold font-mono text-xs">${Number(sc.score).toFixed(1)}</span>
        <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="text-blue-600 hover:underline text-[11px] font-bold">Xem</button>
      </div>
    `;
  } else if (sc?.status === 'draft') {
    return `
      <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg font-bold text-[11px]">
        ● Lưu tạm (${sc.score ?? '--'})
      </button>
    `;
  }
  return `
    <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg font-bold text-[11px]">
      + Nhập điểm
    </button>
  `;
}

function renderThesisHdScoreCell(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  const sc = targetRound?.thesisScores?.[studentId]?.hd;

  if (sc?.status === 'completed') {
    return `
      <div class="flex items-center justify-center gap-1.5">
        <span class="badge bg-blue-100 text-blue-800 font-bold font-mono text-xs">${Number(sc.score).toFixed(1)}</span>
        <button type="button" onclick="openScoreEntryModal('tm_hd', '${studentId}')" class="text-blue-600 hover:underline text-[11px] font-bold">Xem</button>
      </div>
    `;
  } else if (sc?.status === 'draft') {
    return `
      <button type="button" onclick="openScoreEntryModal('tm_hd', '${studentId}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg font-bold text-[11px]">
        ● Lưu tạm (${sc.score ?? '--'})
      </button>
    `;
  }
  return `
    <button type="button" onclick="openScoreEntryModal('tm_hd', '${studentId}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg font-bold text-[11px]">
      + Nhập TM HD
    </button>
  `;
}

// --- 3. SUPERVISOR PRELIMINARY SCORING TAB ---

window.renderSupervisorPreliminaryList = function() {
  const container = document.getElementById('sup-prelim-cards-container');
  if (!container) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const actor = getEffectiveActor();
  const myScorerId = actor.uid || actor.email;
  const isAuthorized = actor.isAdmin || (targetRound.preliminaryConfig?.scorerIds || []).includes(myScorerId) || (targetRound.preliminaryConfig?.scorerIds || []).includes(actor.email);

  if (!isAuthorized) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Thầy/Cô chưa được phân quyền chấm Sơ khảo trong Đợt này.</div>';
    return;
  }

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('sup-prelim-search')?.value || '').toLowerCase().trim();
  const filterStatus = document.getElementById('sup-prelim-filter-status')?.value || 'all';

  let myScoredCount = 0;
  const filtered = allStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '';
    const topic = s.topicTitle || '';
    if (q && !sid.toLowerCase().includes(q) && !name.toLowerCase().includes(q) && !topic.toLowerCase().includes(q)) {
      return false;
    }

    const key = `prelim_${sid}_${myScorerId}`;
    const myScore = targetRound.preliminaryScores?.[key];
    const isCompleted = myScore?.status === 'completed';
    if (isCompleted) myScoredCount++;

    if (filterStatus === 'scored' && !isCompleted) return false;
    if (filterStatus === 'unscored' && isCompleted) return false;
    return true;
  });

  const progressEl = document.getElementById('sup-prelim-my-progress');
  if (progressEl) progressEl.textContent = `${myScoredCount} / ${allStudents.length} đã chấm`;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Không có sinh viên phù hợp điều kiện lọc.</div>';
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '--';
    const pType = s.projectType || '--';
    const supervisorsStr = formatStudentSupervisorsForDisplay(s);

    const key = `prelim_${sid}_${myScorerId}`;
    const myScore = targetRound.preliminaryScores?.[key];
    const isCompleted = myScore?.status === 'completed';

    let scoreStatusHtml = '<span class="text-slate-400 text-xs">— Chưa chấm</span>';
    if (isCompleted) {
      scoreStatusHtml = `<span class="badge bg-emerald-100 text-emerald-800 font-bold font-mono text-xs">✓ Đã chấm: ${Number(myScore.score).toFixed(1)}</span>`;
    } else if (myScore?.status === 'draft') {
      scoreStatusHtml = `<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Lưu tạm (${myScore.score ?? '--'})</span>`;
    }

    return `
      <div class="card-surface p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-2.5 shadow-xs transition-all">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${name}</h4>
            <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
          </div>
          <div>${scoreStatusHtml}</div>
        </div>

        <div class="text-xs text-slate-700 space-y-1">
          <p><strong class="text-slate-500">Đề tài:</strong> ${topic}</p>
          <p><strong class="text-slate-500">Loại hình:</strong> ${pType}</p>
          <div><strong class="text-slate-500">GVHD:</strong> ${supervisorsStr}</div>
        </div>

        <div class="pt-2 border-t flex justify-end">
          <button type="button" onclick="openScoreEntryModal('preliminary', '${sid}')" class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs">
            ${isCompleted ? 'Sửa điểm Sơ khảo' : 'Chấm Sơ khảo'}
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// --- 4. SUPERVISOR REVIEWER (TM PB) TAB ---

window.renderSupervisorReviewerList = function() {
  const container = document.getElementById('sup-reviewer-cards-container');
  if (!container) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const actor = getEffectiveActor();
  const myUserId = actor.uid || actor.email;
  const assignments = targetRound.reviewerAssignments || {};

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const assignedStudents = allStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    return actor.isAdmin || assignments[sid] === myUserId || assignments[sid] === actor.email;
  });

  const countBadge = document.getElementById('sup-reviewer-count-badge');
  if (countBadge) countBadge.textContent = assignedStudents.length;

  if (assignedStudents.length === 0) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Thầy/Cô chưa được phân công phản biện sinh viên nào trong Đợt này.</div>';
    return;
  }

  container.innerHTML = assignedStudents.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '--';
    const supervisorsStr = formatStudentSupervisorsForDisplay(s);

    const sc = targetRound.thesisScores?.[sid]?.pb;
    const isCompleted = sc?.status === 'completed';

    let scoreStatusHtml = '<span class="text-slate-400 text-xs">— Chưa chấm TM PB</span>';
    if (isCompleted) {
      scoreStatusHtml = `<span class="badge bg-blue-100 text-blue-800 font-bold font-mono text-xs">✓ TM PB: ${Number(sc.score).toFixed(1)}</span>`;
    } else if (sc?.status === 'draft') {
      scoreStatusHtml = `<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Lưu tạm (${sc.score ?? '--'})</span>`;
    }

    return `
      <div class="card-surface p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-2.5 shadow-xs transition-all">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${name}</h4>
            <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
          </div>
          <div>${scoreStatusHtml}</div>
        </div>

        <div class="text-xs text-slate-700 space-y-1">
          <p><strong class="text-slate-500">Đề tài:</strong> ${topic}</p>
          <div><strong class="text-slate-500">GVHD:</strong> ${supervisorsStr}</div>
        </div>

        <div class="pt-2 border-t flex justify-end">
          <button type="button" onclick="openScoreEntryModal('tm_pb', '${sid}')" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs">
            ${isCompleted ? 'Sửa điểm TM PB' : 'Nhập điểm TM PB'}
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// --- 5. GENERIC SCORE ENTRY MODAL (SƠ KHẢO, GVHD, TM HD, TM PB) ---

window.openScoreEntryModal = function(type, studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;

  document.getElementById('score-entry-type').value = type;
  document.getElementById('score-entry-student-id').value = studentId;
  document.getElementById('score-entry-student-name').textContent = `Sinh viên: ${sName} (${studentId})`;

  const warningBox = document.getElementById('score-entry-warning-box');
  const valInput = document.getElementById('score-entry-value');
  const commInput = document.getElementById('score-entry-comment');
  const btnComplete = document.getElementById('btn-score-entry-complete');
  const btnDraft = document.getElementById('btn-score-entry-draft');
  const titleEl = document.getElementById('score-entry-modal-title');
  const timeEl = document.getElementById('score-entry-saved-time');

  warningBox.classList.add('hidden');
  valInput.disabled = false;
  commInput.disabled = false;
  btnComplete.disabled = false;
  btnDraft.disabled = false;
  timeEl.textContent = '';

  const myScorerId = getEffectiveActor().uid || getEffectiveActor().email;

  if (type === 'preliminary') {
    titleEl.textContent = 'Đánh giá Điểm Sơ khảo';
    const key = `prelim_${studentId}_${myScorerId}`;
    const sc = targetRound.preliminaryScores?.[key];
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;
  } else if (type === 'supervisor') {
    titleEl.textContent = 'Nhập Điểm Giảng viên Hướng dẫn (GVHD)';
    const sc = targetRound.supervisorScores?.[studentId];
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;

    // Concurrency Check: First completed wins
    if (sc?.status === 'completed' && sc.submittedBySupervisorId && sc.submittedBySupervisorId !== myScorerId && !state.isAdmin) {
      warningBox.innerHTML = `
        <strong>Điểm GVHD đã được hoàn tất bởi ${sc.submittedByName || 'GVHD khác'} lúc ${fmt24h(sc.completedAt)}.</strong><br>
        Điểm chính thức: <strong>${sc.score}</strong>. Bạn không cần nhập thêm.
      `;
      warningBox.classList.remove('hidden');
      valInput.disabled = true;
      commInput.disabled = true;
      btnComplete.disabled = true;
      btnDraft.disabled = true;
    }
  } else if (type === 'tm_hd') {
    titleEl.textContent = 'Nhập Điểm Thuyết minh GVHD (TM HD)';
    const sc = targetRound.thesisScores?.[studentId]?.hd;
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;

    // Concurrency Check: First completed wins
    if (sc?.status === 'completed' && sc.submittedBySupervisorId && sc.submittedBySupervisorId !== myScorerId && !state.isAdmin) {
      warningBox.innerHTML = `
        <strong>Điểm TM HD đã được hoàn tất bởi ${sc.submittedByName || 'GVHD khác'} lúc ${fmt24h(sc.completedAt)}.</strong><br>
        Điểm chính thức: <strong>${sc.score}</strong>. Bạn không cần nhập thêm.
      `;
      warningBox.classList.remove('hidden');
      valInput.disabled = true;
      commInput.disabled = true;
      btnComplete.disabled = true;
      btnDraft.disabled = true;
    }
  } else if (type === 'tm_pb') {
    titleEl.textContent = 'Nhập Điểm Thuyết minh Phản biện (TM PB)';
    const sc = targetRound.thesisScores?.[studentId]?.pb;
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;
  } else if (type.startsWith('duyet_')) {
    const phase = type.replace('duyet_', '');
    titleEl.textContent = `Đánh giá Tiến độ Duyệt đợt ${phase}`;
    const sc = targetRound.progressReviews?.[type]?.[studentId];
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;
  }

  document.getElementById('modal-score-entry')?.classList.remove('hidden');
};

window.closeScoreEntryModal = function() {
  document.getElementById('modal-score-entry')?.classList.add('hidden');
};

window.saveScoreEntry = async function(isCompleted) {
  if (!checkImpersonationWriteGuard('Lưu mục điểm đánh giá')) return;

  const type = document.getElementById('score-entry-type').value;
  const studentId = document.getElementById('score-entry-student-id').value;
  const valStr = document.getElementById('score-entry-value').value;
  const comment = document.getElementById('score-entry-comment').value.trim();

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound || !studentId) return;

  const numVal = parseFloat(valStr);
  if (isCompleted) {
    if (isNaN(numVal) || numVal < 0 || numVal > 10) {
      showToast('Điểm phải từ 0 đến 10!', 'warning');
      return;
    }
    const confirmed = await showConfirm(
      'Xác nhận hoàn tất',
      `Xác nhận hoàn tất lưu điểm ${numVal} cho sinh viên?`,
      { confirmText: 'Hoàn tất', danger: false }
    );
    if (!confirmed) return;
  }

  const effectiveScorer = getEffectiveActor();
  const myScorerId = effectiveScorer.uid || effectiveScorer.email;
  const myScorerEmail = (effectiveScorer.email || '').toLowerCase().trim();
  const myScorerName = effectiveScorer.displayName || 'Giảng viên';

  const roundId = targetRound.id;
  const now = new Date().toISOString();

  if (type === 'preliminary') {
    targetRound.preliminaryScores = targetRound.preliminaryScores || {};
    const key = `prelim_${studentId}_${myScorerId}`;
    const record = {
      roundId,
      studentId,
      scorerId: myScorerId,
      scorerEmail: myScorerEmail,
      scorerName: myScorerName,
      decidedBy: myScorerEmail,
      supervisorEmail: myScorerEmail,
      score: isNaN(numVal) ? null : numVal,
      comment,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? now : null
    };
    targetRound.preliminaryScores[key] = record;
    await persistScoreItem(roundId, `preliminaryScores.${key}`, record, key);
  } else if (type === 'supervisor') {
    try {
      const record = await window.submitSupervisorScoreTransaction({
        roundId,
        studentId,
        supervisorId: myScorerId,
        supervisorEmail: myScorerEmail,
        supervisorName: myScorerName,
        score: numVal,
        feedback: comment,
        isCompleted
      });
      targetRound.supervisorScores = targetRound.supervisorScores || {};
      targetRound.supervisorScores[studentId] = record;
    } catch (err) {
      showToast(err.message || 'Lỗi lưu điểm GVHD', 'error');
      return;
    }
  } else if (type === 'tm_hd') {
    try {
      const record = await window.submitThesisScoreHDTransaction({
        roundId,
        studentId,
        supervisorId: myScorerId,
        supervisorEmail: myScorerEmail,
        supervisorName: myScorerName,
        score: numVal,
        feedback: comment,
        isCompleted
      });
      targetRound.thesisScores = targetRound.thesisScores || {};
      targetRound.thesisScores[studentId] = targetRound.thesisScores[studentId] || {};
      targetRound.thesisScores[studentId].hd = record;
    } catch (err) {
      showToast(err.message || 'Lỗi lưu điểm TM HD', 'error');
      return;
    }
  } else if (type === 'tm_pb') {
    targetRound.thesisScores = targetRound.thesisScores || {};
    targetRound.thesisScores[studentId] = targetRound.thesisScores[studentId] || {};
    const existing = targetRound.thesisScores[studentId].pb;

    const record = {
      roundId,
      studentId,
      score: isNaN(numVal) ? null : numVal,
      comment,
      reviewerId: myScorerId,
      reviewerName: myScorerName,
      reviewerEmail: myScorerEmail,
      decidedBy: myScorerEmail,
      supervisorEmail: myScorerEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };
    targetRound.thesisScores[studentId].pb = record;
    await persistScoreItem(roundId, `thesisScores.${studentId}.pb`, record, `tmpb_${studentId}_${myScorerId}`);
  } else if (type.startsWith('duyet_')) {
    const phase = type.replace('duyet_', '');
    targetRound.progressReviews = targetRound.progressReviews || {};
    targetRound.progressReviews[type] = targetRound.progressReviews[type] || {};
    const status = isCompleted ? (numVal >= 5 ? 'passed' : 'failed') : 'draft';
    const record = {
      roundId,
      studentId,
      phase,
      score: isNaN(numVal) ? null : numVal,
      comment,
      status,
      scorerId: myScorerId,
      scorerName: myScorerName,
      scorerEmail: myScorerEmail,
      decidedBy: myScorerEmail,
      updatedAt: now,
      completedAt: isCompleted ? now : null
    };
    targetRound.progressReviews[type][studentId] = record;
    await persistScoreItem(roundId, `progressReviews.${type}.${studentId}`, record, `duyet_${phase}_${studentId}_${myScorerId}`);
  }

  closeScoreEntryModal();
  showToast(isCompleted ? '✓ Đã hoàn tất điểm!' : 'Đã lưu tạm.', isCompleted ? 'success' : 'info');

  // Refresh current view
  if (state.supervisorTab === 'accepted') renderSupervisorAcceptedTable();
  else if (state.supervisorTab === 'preliminary') renderSupervisorPreliminaryList();
  else if (state.supervisorTab === 'reviewer') renderSupervisorReviewerList();
  if (state.currentAdminTab === 'scoring-dashboard') renderAdminScoresTable();
  if (state.currentView === 'assessment') {
    renderAssessmentHeroCard();
    renderCurrentAssessmentTab();
  }
};

async function persistScoreItem(roundId, dotPath, record, decisionKey) {
  try {
    // 1. Subcollection reviewDecisions (authorized under current rules)
    const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', decisionKey);
    await setDoc(decRef, record, { merge: true }).catch(() => {});

    // 2. Round doc atomic dot notation if admin
    if (state.isAdmin) {
      const roundRef = doc(db, 'graduationRounds', roundId);
      await updateDoc(roundRef, {
        [dotPath]: record,
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Persist score item notice:', err);
  }
}

// --- 6. ADMIN SCORING DASHBOARD MODULE ---
