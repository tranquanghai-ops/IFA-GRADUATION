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

window.renderAdminProgressReviewTable = function(phase) {
  const tbody = document.getElementById('admin-duyet-' + phase + '-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('admin-duyet-' + phase + '-search')?.value || '').toLowerCase().trim();
  const filterVal = document.getElementById('admin-duyet-' + phase + '-filter')?.value || 'all';

  const filtered = allStudents.filter(s => {
    const sid = (s.mssv || s.studentId || '').toLowerCase();
    const name = (s.fullName || s.studentName || '').toLowerCase();
    const topic = (s.topicTitle || '').toLowerCase();
    if (q && !sid.includes(q) && !name.includes(q) && !topic.includes(q)) return false;

    const reviewData = targetRound.progressReviews?.['duyet_' + phase]?.[s.mssv || s.studentId] || {};
    const status = reviewData.status || 'pending';

    if (filterVal !== 'all' && status !== filterVal) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400">Chưa có dữ liệu duyệt tiến độ cho đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '<span class="text-slate-400 italic">Chưa đăng ký đề tài</span>';
    const supName = s.supervisorName || (targetRound.supervisors || []).find(sup => sup.id === s.supervisorId)?.name || '--';
    const reviewData = targetRound.progressReviews?.['duyet_' + phase]?.[sid] || {};
    const status = reviewData.status || 'pending';
    const score = reviewData.score !== undefined ? Number(reviewData.score).toFixed(1) : '--';

    let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa duyệt</span>';
    if (status === 'passed') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đạt yêu cầu</span>';
    } else if (status === 'revision') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">⚠️ Cần bổ sung</span>';
    } else if (status === 'failed') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Không đạt</span>';
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-slate-600 max-w-xs truncate" title="${s.topicTitle || ''}">${topic}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap">${supName}</td>
        <td class="p-3 text-center whitespace-nowrap">${statusBadge}</td>
        <td class="p-3 text-center font-mono font-bold whitespace-nowrap">${score !== '--' ? `<span class="badge bg-blue-50 text-blue-800 font-bold">${score}</span>` : '--'}</td>
      </tr>
    `;
  }).join('');
};

window.renderAdminDefenseScoresTable = function() {
  const tbody = document.getElementById('admin-defense-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

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

    const tmFinal = typeof getThesisFinalScore === 'function' ? getThesisFinalScore(sid, targetRound.id) : null;
    const tmDisplay = tmFinal !== null
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${tmFinal.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const defScore = typeof getStudentDefenseScore === 'function' ? getStudentDefenseScore(sid, targetRound.id) : null;
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

window.loadAdminScoringDashboard = async function() {
  const sel = document.getElementById('admin-scoring-round-select');
  if (sel) {
    sel.innerHTML = (state.rounds || []).map(r => 
      `<option value="${r.id}" ${r.id === state.selectedRoundId ? 'selected' : ''}>${r.title || r.code || r.id}</option>`
    ).join('');
    if (state.selectedRoundId) sel.value = state.selectedRoundId;
  }
  switchAdminScoringSubTab('duyet-1');
};

window.onAdminScoringRoundChange = function(roundId) {
  state.selectedRoundId = roundId;
  const curSubTab = document.querySelector('.ascore-nav-btn.bg-slate-900')?.id?.replace('ascore-tab-btn-', '') || 'duyet-1';
  switchAdminScoringSubTab(curSubTab);
};

window.renderAdminScoresTable = function() {
  const tbody = document.getElementById('admin-scoring-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

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
    const tmFinal = getThesisFinalScore(sid, targetRound.id);
    const tmFinalDisplay = tmFinal !== null
      ? `<strong class="font-mono text-xs text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded-lg" title="Full precision: ${tmFinal}">${tmFinal.toFixed(2)}</strong>`
      : '<span class="text-slate-300 text-[10px] italic">Chưa đủ điểm</span>';

    // BẢO VỆ CHÍNH THỨC & TỔNG KẾT (v2.1.0-beta.1)
    const defScore = getStudentDefenseScore(sid, targetRound.id);
    const defDisplay = defScore !== null
      ? `<span class="badge bg-purple-50 text-purple-900 font-bold font-mono text-xs" title="Full precision: ${defScore}">${defScore.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const finalInfo = getFinalScore(sid, targetRound.id);
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
};

// --- 8. ADMIN PRELIMINARY CONFIG & SUPERVISOR CONFIG ---

function renderAdminPreliminaryConfig() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const chk = document.getElementById('chk-admin-preliminary-enabled');
  if (chk) chk.checked = Boolean(targetRound.preliminaryConfig?.enabled);

  const container = document.getElementById('preliminary-scorers-checklist');
  if (!container) return;

  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  const selectedSet = new Set(targetRound.preliminaryConfig?.scorerIds || []);

  container.innerHTML = supervisors.map(sup => {
    const isChecked = selectedSet.has(sup.id) || (sup.email && selectedSet.has(sup.email.toLowerCase()));
    return `
      <label class="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
        <input type="checkbox" value="${sup.id}" data-email="${sup.email || ''}" class="chk-preliminary-scorer rounded text-tdtu-blue" ${isChecked ? 'checked' : ''} onchange="updatePreliminarySelectedCount()">
        <div class="truncate">
          <span class="font-bold text-slate-800 text-xs block truncate">${sup.name}</span>
          <span class="text-[10px] text-slate-400 block truncate">${sup.email || 'Khoa MTCN'}</span>
        </div>
      </label>
    `;
  }).join('');

  updatePreliminarySelectedCount();
}

window.updatePreliminarySelectedCount = function() {
  const checked = document.querySelectorAll('.chk-preliminary-scorer:checked');
  const countEl = document.getElementById('preliminary-selected-count');
  if (countEl) countEl.textContent = `Đã chọn: ${checked.length} GV`;
};

window.saveAdminPreliminaryConfig = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const enabled = document.getElementById('chk-admin-preliminary-enabled')?.checked === true;
  const checked = document.querySelectorAll('.chk-preliminary-scorer:checked');
  const scorerIds = Array.from(checked).map(cb => cb.value);

  targetRound.preliminaryConfig = {
    enabled,
    scorerIds,
    updatedAt: new Date().toISOString()
  };

  try {
    const roundRef = doc(db, 'graduationRounds', targetRound.id);
    await updateDoc(roundRef, {
      preliminaryConfig: targetRound.preliminaryConfig,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu cấu hình Sơ khảo thành công!', 'success');
  } catch (err) {
    showToast('Lỗi lưu cấu hình: ' + err.message, 'error');
  }
};

function renderAdminSupervisorScoreConfig() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;
  const chk = document.getElementById('chk-admin-supervisor-score-enabled');
  if (chk) chk.checked = Boolean(targetRound.supervisorScoreConfig?.enabled !== false);
}

window.saveAdminSupervisorScoreConfig = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const enabled = document.getElementById('chk-admin-supervisor-score-enabled')?.checked === true;
  targetRound.supervisorScoreConfig = {
    enabled,
    updatedAt: new Date().toISOString()
  };

  try {
    const roundRef = doc(db, 'graduationRounds', targetRound.id);
    await updateDoc(roundRef, {
      supervisorScoreConfig: targetRound.supervisorScoreConfig,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu cấu hình Điểm GVHD thành công!', 'success');
  } catch (err) {
    showToast('Lỗi lưu cấu hình: ' + err.message, 'error');
  }
};

// --- 9. ADMIN REVIEWER (GVPB) ASSIGNMENT MODULE ---

function renderAdminReviewerAssignmentTable() {
  const tbody = document.getElementById('admin-reviewer-assignment-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  const assignments = targetRound.reviewerAssignments || {};

  tbody.innerHTML = allStudents.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '--';
    const currentReviewerId = assignments[sid] || '';

    // Excluded supervisors: GVPB CANNOT be any officialSupervisor of this student!
    const excludedIds = new Set(getPreliminaryExcludedSupervisorIds(s));
    const supervisorsStr = formatStudentSupervisorsForDisplay(s);

    const optionsHtml = '<option value="">-- Chưa phân công GVPB --</option>' + supervisors.map(sup => {
      const isOfficial = excludedIds.has(sup.id) || (sup.email && excludedIds.has(sup.email.toLowerCase()));
      return `
        <option value="${sup.id}" ${currentReviewerId === sup.id ? 'selected' : ''} ${isOfficial ? 'disabled class="text-slate-300 italic"' : ''}>
          ${sup.name} ${isOfficial ? ' (Đang là GVHD của SV)' : ''}
        </option>
      `;
    }).join('');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 max-w-xs truncate" title="${topic}">${topic}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap">${supervisorsStr}</td>
        <td class="p-3">
          <select data-sid="${sid}" class="select-reviewer-assignment w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white ${currentReviewerId ? 'border-blue-300 bg-blue-50/50 text-blue-900' : ''}">
            ${optionsHtml}
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

window.saveAdminReviewerAssignments = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const selects = document.querySelectorAll('.select-reviewer-assignment');
  const updatedAssignments = { ...(targetRound.reviewerAssignments || {}) };

  selects.forEach(sel => {
    const sid = sel.getAttribute('data-sid');
    const val = sel.value;
    if (sid) {
      if (val) updatedAssignments[sid] = val;
      else delete updatedAssignments[sid];
    }
  });

  targetRound.reviewerAssignments = updatedAssignments;

  try {
    const roundRef = doc(db, 'graduationRounds', targetRound.id);
    await updateDoc(roundRef, {
      reviewerAssignments: updatedAssignments,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu danh sách phân công GVPB thành công!', 'success');
  } catch (err) {
    showToast('Lỗi lưu phân công: ' + err.message, 'error');
  }
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getPreliminarySummary !== 'undefined') window.getPreliminarySummary = getPreliminarySummary;
  if (typeof getPreliminaryAverage !== 'undefined') window.getPreliminaryAverage = getPreliminaryAverage;
  if (typeof getThesisFinalScore !== 'undefined') window.getThesisFinalScore = getThesisFinalScore;
  if (typeof renderSupervisorScoreCell !== 'undefined') window.renderSupervisorScoreCell = renderSupervisorScoreCell;
  if (typeof renderThesisHdScoreCell !== 'undefined') window.renderThesisHdScoreCell = renderThesisHdScoreCell;
  if (typeof persistScoreItem !== 'undefined') window.persistScoreItem = persistScoreItem;
  if (typeof renderAdminPreliminaryConfig !== 'undefined') window.renderAdminPreliminaryConfig = renderAdminPreliminaryConfig;
  if (typeof renderAdminSupervisorScoreConfig !== 'undefined') window.renderAdminSupervisorScoreConfig = renderAdminSupervisorScoreConfig;
  if (typeof renderAdminReviewerAssignmentTable !== 'undefined') window.renderAdminReviewerAssignmentTable = renderAdminReviewerAssignmentTable;
}
