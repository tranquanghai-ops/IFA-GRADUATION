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
