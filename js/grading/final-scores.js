// ============================================================================
// IFA+ GRADUATION BETA v2.1.0-beta.1: FINAL SCORE + RANKING + TITLES + EXCEL
// ============================================================================

// 1. DEFENSE SCORE RESOLVER HELPER (Single Source of Truth)
export function getStudentDefenseScore(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) return null;

  const activities = targetRound.activities || [];
  for (const act of activities) {
    if (!act.councilEnabled) continue;
    const councils = act.councils || [];
    for (const c of councils) {
      const asgns = act.councilStudentAssignments || [];
      const hasStudent = asgns.some(a => a.councilId === c.id && a.studentId === studentId);
      if (hasStudent) {
        // If council already has finalDefenseScores cached
        if (c.finalDefenseScores?.[studentId]?.score !== undefined) {
          return c.finalDefenseScores[studentId].score;
        }
        // Otherwise compute via getOfficialDefenseScore
        const official = getOfficialDefenseScore(studentId, c, act, targetRound);
        if (official && official.score !== null) {
          return official.score; // Full precision IEEE 754 float
        }
      }
    }
  }
  return null;
}

// 2. CONFIGURABLE FINAL SCORE CALCULATION ENGINE (NO INTERMEDIATE ROUNDING)
export function getFinalScore(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) {
    return { complete: false, missing: ['Không tìm thấy đợt tốt nghiệp'], rawScore: null, displayScore: '--', components: {} };
  }

  // Use frozen snapshot if round is finalized
  const cfg = (targetRound.finalScoreConfig?.isFinalized && targetRound.finalScoreConfigSnapshot)
    ? targetRound.finalScoreConfigSnapshot
    : (targetRound.finalScoreConfig || {
        enabled: false,
        supervisorWeight: 20,
        thesisWeight: 20,
        defenseWeight: 60,
        runnerUpCount: 2
      });

  const wSup = Number(cfg.supervisorWeight || 0);
  const wThe = Number(cfg.thesisWeight || 0);
  const wDef = Number(cfg.defenseWeight || 0);

  const missing = [];
  let gvhdRaw = null;
  let tmRaw = null;
  let defRaw = null;

  // A. Supervisor Score
  if (wSup > 0) {
    const sc = targetRound.supervisorScores?.[studentId];
    if (sc && sc.status === 'completed' && typeof sc.score === 'number') {
      gvhdRaw = Number(sc.score);
    } else {
      missing.push('Điểm GVHD');
    }
  }

  // B. Thesis Final Score: (TM HD + TM PB) / 2
  if (wThe > 0) {
    const theScore = getThesisFinalScore(studentId, targetRound.id);
    if (theScore !== null && typeof theScore === 'number') {
      tmRaw = Number(theScore);
    } else {
      missing.push('Điểm Thuyết minh');
    }
  }

  // C. Official Defense Score
  if (wDef > 0) {
    const dScore = getStudentDefenseScore(studentId, targetRound.id);
    if (dScore !== null && typeof dScore === 'number') {
      defRaw = Number(dScore);
    } else {
      missing.push('Điểm Bảo vệ');
    }
  }

  const components = {
    gvhd: gvhdRaw !== null ? { raw: gvhdRaw, display: gvhdRaw.toFixed(1) } : null,
    tm: tmRaw !== null ? { raw: tmRaw, display: tmRaw.toFixed(2) } : null,
    defense: defRaw !== null ? { raw: defRaw, display: defRaw.toFixed(2) } : null
  };

  if (missing.length > 0) {
    return {
      studentId,
      complete: false,
      missing,
      rawScore: null,
      displayScore: '--',
      components
    };
  }

  // FULL IEEE 754 PRECISION: NO intermediate rounding!
  const rawScore = (gvhdRaw * (wSup / 100)) + (tmRaw * (wThe / 100)) + (defRaw * (wDef / 100));
  const displayScore = rawScore.toFixed(2);

  return {
    studentId,
    complete: true,
    missing: [],
    rawScore, // Full precision IEEE 754 float
    displayScore,
    components
  };
}

// 3. ADMIN FINAL SCORE CONFIG CONTROLS & VALIDATION
window.validateFinalScoreWeights = function() {
  const wSup = parseFloat(document.getElementById('cfg-weight-supervisor')?.value) || 0;
  const wThe = parseFloat(document.getElementById('cfg-weight-thesis')?.value) || 0;
  const wDef = parseFloat(document.getElementById('cfg-weight-defense')?.value) || 0;
  const total = Math.round((wSup + wThe + wDef) * 100) / 100;

  const totalEl = document.getElementById('cfg-weights-total-display');
  const msgEl = document.getElementById('cfg-weights-msg');
  const statusBox = document.getElementById('cfg-weights-status-box');
  const chkEnable = document.getElementById('chk-admin-final-score-enabled');

  if (totalEl) totalEl.textContent = `${total}%`;

  const isValid = (Math.abs(total - 100) < 0.000001);

  if (statusBox) {
    if (isValid) {
      statusBox.className = 'p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-wrap items-center justify-between gap-3 text-xs';
      if (msgEl) msgEl.innerHTML = '<span class="text-emerald-700 font-bold flex items-center gap-1"><span>✓</span> Hợp lệ (Tổng trọng số đúng 100%)</span>';
    } else {
      statusBox.className = 'p-4 rounded-xl border border-rose-300 bg-rose-50/80 flex flex-wrap items-center justify-between gap-3 text-xs';
      if (msgEl) msgEl.innerHTML = `<span class="text-rose-700 font-bold flex items-center gap-1"><span>⚠️</span> Không hợp lệ (Hiện tại: ${total}% — Phải đúng bằng 100%)</span>`;
      if (chkEnable && chkEnable.checked) {
        chkEnable.checked = false;
        showToast('Không thể kích hoạt: Tổng trọng số phải đúng bằng 100%!', 'warning');
      }
    }
  }
  return isValid;
};

window.loadAdminFinalScoreConfig = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const cfg = targetRound.finalScoreConfig || {
    enabled: false,
    supervisorWeight: 20,
    thesisWeight: 20,
    defenseWeight: 60,
    runnerUpCount: 2,
    tieThukhoaRule: 'co_title',
    tieAkhoaRule: 'co_title'
  };

  const chkEnable = document.getElementById('chk-admin-final-score-enabled');
  if (chkEnable) chkEnable.checked = Boolean(cfg.enabled);

  const inpSup = document.getElementById('cfg-weight-supervisor');
  if (inpSup) inpSup.value = cfg.supervisorWeight ?? 20;

  const inpThe = document.getElementById('cfg-weight-thesis');
  if (inpThe) inpThe.value = cfg.thesisWeight ?? 20;

  const inpDef = document.getElementById('cfg-weight-defense');
  if (inpDef) inpDef.value = cfg.defenseWeight ?? 60;

  const inpRunner = document.getElementById('cfg-runner-up-count');
  if (inpRunner) inpRunner.value = cfg.runnerUpCount ?? 2;

  const rTie = document.querySelector(`input[name="cfg_tie_rule"][value="${cfg.tieThukhoaRule || 'co_title'}"]`);
  if (rTie) rTie.checked = true;

  const chkPubScore = document.getElementById('chk-publish-final-score');
  if (chkPubScore) chkPubScore.checked = Boolean(targetRound.publishFinalScoreToStudents);

  const chkPubRank = document.getElementById('chk-publish-ranking');
  if (chkPubRank) chkPubRank.checked = Boolean(targetRound.publishRankingToStudents);

  validateFinalScoreWeights();
};

window.saveAdminFinalScoreConfig = async function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const isEnabled = document.getElementById('chk-admin-final-score-enabled')?.checked === true;
  const wSup = parseFloat(document.getElementById('cfg-weight-supervisor')?.value) || 0;
  const wThe = parseFloat(document.getElementById('cfg-weight-thesis')?.value) || 0;
  const wDef = parseFloat(document.getElementById('cfg-weight-defense')?.value) || 0;
  const runnerUpCount = parseInt(document.getElementById('cfg-runner-up-count')?.value, 10) || 2;
  const tieRule = document.querySelector('input[name="cfg_tie_rule"]:checked')?.value || 'co_title';
  const publishFinalScore = document.getElementById('chk-publish-final-score')?.checked === true;
  const publishRanking = document.getElementById('chk-publish-ranking')?.checked === true;

  const total = Math.round((wSup + wThe + wDef) * 100) / 100;
  if (isEnabled && Math.abs(total - 100) >= 0.000001) {
    showToast(`Không thể kích hoạt: Tổng trọng số các thành phần phải đúng bằng 100% (Hiện tại: ${total}%)!`, 'error');
    return;
  }

  const finalScoreConfig = {
    ...(targetRound.finalScoreConfig || {}),
    enabled: isEnabled,
    supervisorWeight: wSup,
    thesisWeight: wThe,
    defenseWeight: wDef,
    runnerUpCount: Math.max(0, runnerUpCount),
    tieThukhoaRule: tieRule,
    tieAkhoaRule: tieRule,
    updatedAt: new Date().toISOString()
  };

  targetRound.finalScoreConfig = finalScoreConfig;
  targetRound.publishFinalScoreToStudents = publishFinalScore;
  targetRound.publishRankingToStudents = publishRanking;

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      finalScoreConfig,
      publishFinalScoreToStudents: publishFinalScore,
      publishRankingToStudents: publishRanking,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu Cấu hình Điểm Tổng kết thành công!', 'success');
  } catch (e) {
    console.warn('Persist finalScoreConfig notice:', e);
    showToast('✓ Đã cập nhật cấu hình Điểm Tổng kết!', 'success');
  }

  renderAdminScoresTable();
};

// 4. ROUND RANKING ENGINE (FULL RAW PRECISION & TRUE TIE RESOLUTION)
export function computeRoundRanking(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;
  if (!targetRound) return { rankedStudents: [], incompleteStudents: [], hasTrueTie: false, tieGroups: {} };

  // Use snapshot if finalized
  if (targetRound.finalScoreConfig?.isFinalized && Array.isArray(targetRound.rankingSnapshot)) {
    return {
      rankedStudents: targetRound.rankingSnapshot,
      incompleteStudents: [],
      hasTrueTie: false,
      tieGroups: {},
      isFinalized: true,
      calculatedAt: targetRound.finalScoreConfig.finalizedAt
    };
  }

  const registrations = state.adminReviewData?.registrations || [];
  const eligibleStudents = targetRound.eligibleStudents || [];

  // Deduplicate all student IDs in round
  const studentMap = new Map();
  eligibleStudents.forEach(s => {
    const sid = s.mssv || s.studentId;
    if (sid) {
      const facName = (window.getFacultyStudent ? window.getFacultyStudent(sid)?.name : '') || sid;
      studentMap.set(sid, { studentId: sid, fullName: s.fullName || s.studentName || facName });
    }
  });
  registrations.forEach(r => {
    const sid = r.studentId || r.mssv;
    if (sid) studentMap.set(sid, { studentId: sid, fullName: r.studentName || r.fullName || sid });
  });

  const allStudents = Array.from(studentMap.values());
  const completedList = [];
  const incompleteList = [];

  allStudents.forEach(st => {
    const fScore = getFinalScore(st.studentId, targetRound.id);
    if (fScore.complete) {
      completedList.push({
        studentId: st.studentId,
        fullName: st.fullName,
        rawScore: fScore.rawScore, // Full IEEE 754 precision
        displayScore: fScore.displayScore,
        components: fScore.components
      });
    } else {
      incompleteList.push({
        studentId: st.studentId,
        fullName: st.fullName,
        missing: fScore.missing,
        components: fScore.components
      });
    }
  });

  // SORT STRICTLY BY RAW SCORE DESCENDING (NEVER SORT BY DISPLAY ROUNDED!)
  completedList.sort((a, b) => b.rawScore - a.rawScore);

  // Group True Ties (epsilon < 1e-9)
  const tieGroups = {};
  let tieGroupIdCounter = 1;
  for (let i = 0; i < completedList.length - 1; i++) {
    const a = completedList[i];
    const b = completedList[i + 1];
    if (Math.abs(a.rawScore - b.rawScore) < 1e-9) {
      let gId = a.tieGroup;
      if (!gId) {
        gId = 'tie_' + (tieGroupIdCounter++);
        a.tieGroup = gId;
        tieGroups[gId] = [a];
      }
      b.tieGroup = gId;
      if (!tieGroups[gId].includes(b)) tieGroups[gId].push(b);
    }
  }

  // Apply ranking overrides if Admin decided manual order
  const overrides = targetRound.finalScoreConfig?.rankingOverrides || {};
  Object.keys(overrides).forEach(gId => {
    const orderedSids = overrides[gId];
    if (Array.isArray(orderedSids) && tieGroups[gId]) {
      const groupStudents = [...tieGroups[gId]];
      groupStudents.sort((x, y) => orderedSids.indexOf(x.studentId) - orderedSids.indexOf(y.studentId));
      tieGroups[gId] = groupStudents;
    }
  });

  // Assign Ranks and Titles
  const runnerUpCount = targetRound.finalScoreConfig?.runnerUpCount ?? 2;
  const tieRule = targetRound.finalScoreConfig?.tieThukhoaRule || 'co_title';
  const rankedStudents = [];

  let currentRank = 1;
  let i = 0;
  while (i < completedList.length) {
    const currentStudent = completedList[i];
    const gId = currentStudent.tieGroup;

    if (gId && tieRule === 'co_title') {
      const tiedGroup = tieGroups[gId];
      const count = tiedGroup.length;
      
      // Determine Title
      let title = '';
      if (currentRank === 1) {
        title = 'Đồng Thủ khoa';
      } else if (currentRank <= 1 + runnerUpCount) {
        title = 'Đồng Á khoa';
      }

      tiedGroup.forEach(st => {
        rankedStudents.push({
          ...st,
          rank: currentRank,
          title,
          isTie: true
        });
      });

      i += count;
      currentRank += count;
    } else {
      let title = '';
      if (currentRank === 1) {
        title = 'Thủ khoa';
      } else if (currentRank <= 1 + runnerUpCount) {
        title = 'Á khoa';
      }

      rankedStudents.push({
        ...currentStudent,
        rank: currentRank,
        title,
        isTie: Boolean(gId)
      });

      i++;
      currentRank++;
    }
  }

  return {
    rankedStudents,
    incompleteStudents,
    hasTrueTie: Object.keys(tieGroups).length > 0,
    tieGroups,
    isFinalized: Boolean(targetRound.finalScoreConfig?.isFinalized),
    calculatedAt: new Date().toISOString()
  };
}

// 5. RANKING TAB RENDER & ACTIONS
window.loadAdminRankingTab = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  state._currentRoundRanking = computeRoundRanking(roundId);
  renderRankingTables();
};

window.executeCalculateRanking = function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  if (targetRound.finalScoreConfig?.isFinalized) {
    showToast('Đợt này đã chốt kết quả. Vui lòng bấm "Mở lại kết quả Đợt" nếu cần tính toán lại!', 'warning');
    return;
  }

  state._currentRoundRanking = computeRoundRanking(roundId);
  state._rankingCalculatedAt = new Date().toISOString();
  
  // Hide stale warning
  document.getElementById('ranking-stale-warning')?.classList.add('hidden');

  renderRankingTables();
  showToast('✓ Đã tính xong xếp hạng toàn đợt theo Điểm Tổng kết!', 'success');
};

window.filterRankingTop = function(topCount) {
  state._rankingTopFilter = topCount;
  const buttons = document.querySelectorAll('.ranking-top-btn');
  buttons.forEach(btn => {
    const bTop = btn.dataset.top;
    if (String(bTop) === String(topCount)) {
      btn.className = 'ranking-top-btn active px-2.5 py-1 rounded-lg border font-bold bg-indigo-600 text-white border-indigo-600';
    } else {
      btn.className = 'ranking-top-btn px-2.5 py-1 rounded-lg border font-bold text-slate-600 hover:bg-white transition-colors';
    }
  });
  renderRankingTables();
};

window.renderRankingTables = function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const rankingData = state._currentRoundRanking || computeRoundRanking(roundId);

  // Status badge & timestamp
  const statusBadge = document.getElementById('ranking-status-badge');
  const timeEl = document.getElementById('ranking-calc-time');
  const finalizeBtn = document.getElementById('btn-finalize-round-results');
  const reopenBtn = document.getElementById('btn-reopen-round-results');

  const isFinalized = Boolean(targetRound?.finalScoreConfig?.isFinalized);
  if (statusBadge) {
    if (isFinalized) {
      statusBadge.className = 'badge bg-slate-800 text-white font-black text-xs';
      statusBadge.textContent = '🔒 ĐÃ CHỐT KẾT QUẢ';
    } else if (rankingData.calculatedAt) {
      statusBadge.className = 'badge bg-emerald-100 text-emerald-800 font-bold text-xs';
      statusBadge.textContent = '● Đã tính xếp hạng';
    } else {
      statusBadge.className = 'badge bg-slate-100 text-slate-600 font-bold text-xs';
      statusBadge.textContent = 'Chưa tính';
    }
  }

  if (timeEl && rankingData.calculatedAt) {
    timeEl.textContent = `Cập nhật: ${fmt24h(rankingData.calculatedAt)}`;
  }

  if (finalizeBtn) finalizeBtn.classList.toggle('hidden', isFinalized);
  if (reopenBtn) reopenBtn.classList.toggle('hidden', !isFinalized);

  // Search & Filter
  const q = String(document.getElementById('ranking-search-input')?.value || '').toLowerCase().trim();
  const topLimit = state._rankingTopFilter || 'all';

  let list = rankingData.rankedStudents || [];
  if (q) {
    list = list.filter(st => st.studentId.toLowerCase().includes(q) || st.fullName.toLowerCase().includes(q));
  }

  if (topLimit !== 'all') {
    const limitNum = parseInt(topLimit, 10);
    list = list.slice(0, limitNum);
  }

  const tbody = document.getElementById('ranking-ranked-tbody');
  const countBadge = document.getElementById('ranking-count-badge');
  if (countBadge) countBadge.textContent = rankingData.rankedStudents.length;

  if (tbody) {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-slate-400 text-xs">Chưa có dữ liệu xếp hạng. Vui lòng bấm "⚡ Tính Xếp hạng".</td></tr>';
    } else {
      tbody.innerHTML = list.map(st => {
        let titleBadge = '';
        if (st.title.includes('Thủ khoa')) {
          titleBadge = '<span class="badge bg-amber-400 text-slate-950 font-black text-xs shadow-xs">🎖️ ' + st.title + '</span>';
        } else if (st.title.includes('Á khoa')) {
          titleBadge = '<span class="badge bg-slate-200 text-slate-800 font-bold text-xs">🥈 ' + st.title + '</span>';
        }

        let rankPill = `<span class="font-mono font-bold text-xs text-slate-700">#${st.rank}</span>`;
        if (st.rank === 1) rankPill = '<span class="px-2 py-0.5 bg-amber-100 text-amber-950 font-black rounded-lg font-mono text-xs border border-amber-300">#1</span>';
        else if (st.rank === 2) rankPill = '<span class="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded-lg font-mono text-xs border border-slate-300">#2</span>';
        else if (st.rank === 3) rankPill = '<span class="px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-lg font-mono text-xs border border-amber-200">#3</span>';

        return `
          <tr class="hover:bg-indigo-50/30 transition-colors">
            <td class="p-3 text-center">${rankPill}</td>
            <td class="p-3 font-mono font-bold text-slate-900">${st.studentId}</td>
            <td class="p-3 font-bold text-slate-800 whitespace-nowrap">${st.fullName}</td>
            <td class="p-3 text-center font-mono font-bold text-xs text-emerald-800">${st.components?.gvhd?.display || '--'}</td>
            <td class="p-3 text-center font-mono font-bold text-xs text-blue-800">${st.components?.tm?.display || '--'}</td>
            <td class="p-3 text-center font-mono font-bold text-xs text-purple-800">${st.components?.defense?.display || '--'}</td>
            <td class="p-3 text-center font-mono font-black text-sm text-indigo-950 bg-indigo-50/60">${st.displayScore}</td>
            <td class="p-3 text-center">
              <button type="button" onclick="openFinalScoreDetailModal('${st.studentId}')" class="text-xs text-indigo-600 hover:underline font-bold" title="Xem chi tiết số thực float">
                Chi tiết
              </button>
            </td>
            <td class="p-3 text-center">${titleBadge}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Incomplete Table
  const incTbody = document.getElementById('ranking-incomplete-tbody');
  const incBadge = document.getElementById('ranking-incomplete-count-badge');
  const incList = rankingData.incompleteStudents || [];
  if (incBadge) incBadge.textContent = incList.length;

  if (incTbody) {
    if (incList.length === 0) {
      incTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400 text-xs">Tất cả sinh viên đã có đủ điểm thành phần!</td></tr>';
    } else {
      incTbody.innerHTML = incList.map((st, idx) => `
        <tr class="hover:bg-amber-50/40 transition-colors">
          <td class="p-3 text-center font-mono font-bold text-slate-400">#${idx + 1}</td>
          <td class="p-3 font-mono font-bold text-slate-900">${st.studentId}</td>
          <td class="p-3 font-bold text-slate-800 whitespace-nowrap">${st.fullName}</td>
          <td class="p-3 text-xs text-slate-600">
            GVHD: ${st.components?.gvhd?.display || '--'} | TM: ${st.components?.tm?.display || '--'} | BV: ${st.components?.defense?.display || '--'}
          </td>
          <td class="p-3">
            <span class="badge bg-rose-100 text-rose-800 font-bold text-[11px]">${st.missing.join(', ')}</span>
          </td>
        </tr>
      `).join('');
    }
  }
};

window.finalizeRoundResults = async function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const rankingData = state._currentRoundRanking || computeRoundRanking(roundId);
  if (!rankingData || rankingData.rankedStudents.length === 0) {
    showToast('Chưa có dữ liệu xếp hạng để chốt kết quả. Vui lòng bấm "⚡ Tính Xếp hạng" trước!', 'warning');
    return;
  }

  const confirmed = await showConfirm(
    'Khóa & Chốt Kết quả Đợt Tốt nghiệp',
    `Xác nhận chốt kết quả và đóng băng (freeze) bảng xếp hạng cho toàn bộ ${rankingData.rankedStudents.length} sinh viên hoàn tất trong Đợt "${targetRound.title}"? Sau khi chốt, thứ hạng sẽ không thay đổi trừ khi Admin chủ động Mở lại kết quả.`,
    { confirmText: 'Khóa & Chốt kết quả', danger: false }
  );
  if (!confirmed) return;

  targetRound.finalScoreConfig = targetRound.finalScoreConfig || {};
  targetRound.finalScoreConfig.isFinalized = true;
  targetRound.finalScoreConfig.finalizedAt = new Date().toISOString();
  targetRound.finalScoreConfigSnapshot = JSON.parse(JSON.stringify(targetRound.finalScoreConfig));
  targetRound.rankingSnapshot = rankingData.rankedStudents;

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      finalScoreConfig: targetRound.finalScoreConfig,
      finalScoreConfigSnapshot: targetRound.finalScoreConfigSnapshot,
      rankingSnapshot: targetRound.rankingSnapshot,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã chốt và đóng băng kết quả Đợt tốt nghiệp thành công!', 'success');
  } catch (e) {
    console.warn('Persist finalizeRoundResults notice:', e);
    showToast('✓ Đã chốt kết quả Đợt tốt nghiệp!', 'success');
  }

  renderRankingTables();
};

window.openReopenRoundModal = function() {
  document.getElementById('reopen-round-reason').value = '';
  document.getElementById('modal-reopen-round')?.classList.remove('hidden');
};

window.closeReopenRoundModal = function() {
  document.getElementById('modal-reopen-round')?.classList.add('hidden');
};

window.confirmReopenRound = async function() {
  const reason = document.getElementById('reopen-round-reason')?.value?.trim();
  if (!reason) {
    showToast('Vui lòng nhập lý do mở lại kết quả đợt bắt buộc!', 'warning');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  targetRound.finalScoreConfig = targetRound.finalScoreConfig || {};
  targetRound.finalScoreConfig.isFinalized = false;

  targetRound.auditLogs = targetRound.auditLogs || [];
  targetRound.auditLogs.unshift({
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    action: 'reopen_round_results',
    roundId,
    reason,
    adjustedById: state.user?.uid || state.user?.email,
    adjustedByName: state.user?.displayName || 'Quản trị viên',
    adjustedByRole: 'admin',
    createdAt: new Date().toISOString()
  });

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      finalScoreConfig: targetRound.finalScoreConfig,
      auditLogs: targetRound.auditLogs,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã mở lại kết quả Đợt. Bảng xếp hạng có thể tính toán lại.', 'info');
  } catch (e) {
    console.warn('Persist reopenRound notice:', e);
    showToast('Đã mở lại kết quả Đợt.', 'info');
  }

  closeReopenRoundModal();
  renderRankingTables();
};

// 6. FORMULA DETAIL MODAL
window.openFinalScoreDetailModal = function(studentId) {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId)
    || (targetRound.eligibleStudents || []).find(s => (s.mssv === studentId || s.studentId === studentId))
    || { studentId };

  const sName = reg.fullName || reg.studentName || studentId;
  const cfg = targetRound.finalScoreConfig || { supervisorWeight: 20, thesisWeight: 20, defenseWeight: 60 };
  const fScore = getFinalScore(studentId, roundId);

  document.getElementById('fs-detail-student-meta').textContent = `Sinh viên: ${sName} (${studentId})`;
  document.getElementById('fs-detail-w-gvhd').textContent = cfg.supervisorWeight ?? 20;
  document.getElementById('fs-detail-w-tm').textContent = cfg.thesisWeight ?? 20;
  document.getElementById('fs-detail-w-def').textContent = cfg.defenseWeight ?? 60;

  const gvhdVal = fScore.components?.gvhd;
  const tmVal = fScore.components?.tm;
  const defVal = fScore.components?.defense;

  document.getElementById('fs-detail-gvhd-val').textContent = gvhdVal?.display || '--';
  document.getElementById('fs-detail-gvhd-raw').textContent = gvhdVal ? `Raw: ${gvhdVal.raw}` : '';

  document.getElementById('fs-detail-tm-val').textContent = tmVal?.display || '--';
  document.getElementById('fs-detail-tm-raw').textContent = tmVal ? `Raw: ${tmVal.raw}` : '';

  document.getElementById('fs-detail-def-val').textContent = defVal?.display || '--';
  document.getElementById('fs-detail-def-raw').textContent = defVal ? `Raw: ${defVal.raw}` : '';

  document.getElementById('fs-detail-formula-text').textContent =
    `Điểm = (GVHD × ${cfg.supervisorWeight}%) + (TM × ${cfg.thesisWeight}%) + (Bảo vệ × ${cfg.defenseWeight}%)`;

  document.getElementById('fs-detail-display-score').textContent = fScore.displayScore || '--';
  document.getElementById('fs-detail-raw-score').textContent = fScore.rawScore !== null ? `Raw: ${fScore.rawScore}` : '';

  // Reset raw toggle
  state._rawPrecisionVisible = false;
  toggleRawPrecisionInDetailModal(false);

  document.getElementById('modal-final-score-detail')?.classList.remove('hidden');
};

window.toggleRawPrecisionInDetailModal = function(forceVal = null) {
  state._rawPrecisionVisible = (forceVal !== null) ? forceVal : !state._rawPrecisionVisible;
  const isVis = state._rawPrecisionVisible;

  document.getElementById('fs-detail-gvhd-raw')?.classList.toggle('hidden', !isVis);
  document.getElementById('fs-detail-tm-raw')?.classList.toggle('hidden', !isVis);
  document.getElementById('fs-detail-def-raw')?.classList.toggle('hidden', !isVis);
  document.getElementById('fs-detail-raw-score')?.classList.toggle('hidden', !isVis);

  const btn = document.getElementById('btn-toggle-raw-precision');
  if (btn) {
    btn.textContent = isVis ? '✕ Ẩn điểm chi tiết' : '🔍 Hiện điểm chi tiết (Full Raw)';
  }
};

window.closeFinalScoreDetailModal = function() {
  document.getElementById('modal-final-score-detail')?.classList.add('hidden');
};

// 7. EXCEL EXPORT ENGINE (SheetJS / XLSX Integration with Security)

function sanitizeExcelCell(val) {
  if (typeof val === 'string') {
    // Formula Injection Protection
    if (/^[=+@-]/.test(val)) {
      return "'" + val;
    }
  }
  return val;
}

function sanitizeSheetName(name) {
  return String(name || 'Sheet').replace(/[\\/*?[\]:]/g, '_').substring(0, 31);
}

window.loadAdminExportTab = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  // Populate Activity select
  const acts = (targetRound.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils) && a.councils.length > 0);
  const actSel = document.getElementById('export-activity-select');
  const councilActSel = document.getElementById('export-council-activity-select');

  const optionsHtml = acts.length > 0
    ? acts.map(a => `<option value="${a.id}">${a.title} (${a.councils.length} Hội đồng)</option>`).join('')
    : '<option value="">-- Chưa có Mốc nào có Hội đồng --</option>';

  if (actSel) actSel.innerHTML = optionsHtml;
  if (councilActSel) {
    councilActSel.innerHTML = optionsHtml;
    if (acts.length > 0) onExportCouncilActivityChange(acts[0].id);
  }
};

window.onExportCouncilActivityChange = function(actId) {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  const councilSel = document.getElementById('export-single-council-select');
  if (!councilSel) return;

  const councils = act?.councils || [];
  if (councils.length === 0) {
    councilSel.innerHTML = '<option value="">-- Chưa có Hội đồng --</option>';
    return;
  }
  councilSel.innerHTML = councils.map(c => `<option value="${c.id}">${c.name} (${c.room || 'Chưa xếp phòng'})</option>`).join('');
};

window.exportRoundSummaryToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  // 1. TONG_KET SHEET
  const ranking = computeRoundRanking(roundId);
  const tongKetData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD', 'Điểm GVHD', 'TM HD', 'TM PB', 'TM Final', 'Điểm Bảo vệ', 'Điểm Tổng kết', 'Hạng', 'Danh hiệu']
  ];

  let stt = 1;
  ranking.rankedStudents.forEach(st => {
    tongKetData.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))),
      st.components?.gvhd?.raw ?? '',
      targetRound.thesisScores?.[st.studentId]?.hd?.score ?? '',
      targetRound.thesisScores?.[st.studentId]?.pb?.score ?? '',
      st.components?.tm?.raw ?? '',
      st.components?.defense?.raw ?? '',
      st.rawScore ?? '',
      st.rank,
      sanitizeExcelCell(st.title || '')
    ]);
  });

  ranking.incompleteStudents.forEach(st => {
    tongKetData.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))),
      st.components?.gvhd?.raw ?? '',
      targetRound.thesisScores?.[st.studentId]?.hd?.score ?? '',
      targetRound.thesisScores?.[st.studentId]?.pb?.score ?? '',
      st.components?.tm?.raw ?? '',
      st.components?.defense?.raw ?? '',
      'Chưa đủ',
      '--',
      '--'
    ]);
  });

  const wsTongKet = XLSX.utils.aoa_to_sheet(tongKetData);
  XLSX.utils.book_append_sheet(wb, wsTongKet, 'TONG_KET');

  // 2. XEP_HANG SHEET
  const xepHangData = [
    ['Hạng', 'MSSV', 'Họ và tên', 'Điểm hiển thị', 'Điểm chi tiết (Raw)', 'Danh hiệu', 'Ghi chú đồng điểm']
  ];
  ranking.rankedStudents.forEach(st => {
    xepHangData.push([
      st.rank,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      st.displayScore,
      st.rawScore,
      sanitizeExcelCell(st.title || ''),
      st.isTie ? 'Đồng điểm' : ''
    ]);
  });
  const wsXepHang = XLSX.utils.aoa_to_sheet(xepHangData);
  XLSX.utils.book_append_sheet(wb, wsXepHang, 'XEP_HANG');

  // 3. SO_KHAO SHEET
  const soKhaoData = [
    ['STT', 'MSSV', 'Họ và tên', 'Điểm Sơ khảo TB', 'Số lượt chấm hợp lệ', 'Ghi chú']
  ];
  let skStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const sk = getPreliminarySummary(st.studentId, roundId);
    soKhaoData.push([
      skStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sk.average !== null ? sk.average : '',
      sk.count,
      sk.excludedScores?.length > 0 ? `Đã loại ${sk.excludedScores.length} điểm GVHD` : ''
    ]);
  });
  const wsSoKhao = XLSX.utils.aoa_to_sheet(soKhaoData);
  XLSX.utils.book_append_sheet(wb, wsSoKhao, 'SO_KHAO');

  // 4. GVHD SHEET
  const gvhdData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD chính', 'GVHD 2', 'Điểm GVHD', 'Người nhập điểm']
  ];
  let gvStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const sc = targetRound.supervisorScores?.[st.studentId];
    const sObj = findStudentInRound(st.studentId);
    const officials = getOfficialSupervisors(sObj) || [];
    const primary = officials.find(o => o.role === 'primary')?.supervisorName || officials[0]?.supervisorName || '';
    const support = officials.filter(o => o.role === 'support').map(o => o.supervisorName).join(', ');
    gvhdData.push([
      gvStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(primary),
      sanitizeExcelCell(support),
      (sc && sc.status === 'completed') ? sc.score : '',
      sanitizeExcelCell(sc?.scorerName || '')
    ]);
  });
  const wsGvhd = XLSX.utils.aoa_to_sheet(gvhdData);
  XLSX.utils.book_append_sheet(wb, wsGvhd, 'GVHD');

  // 5. TM SHEET
  const tmData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD', 'GVPB', 'TM HD', 'TM PB', 'TM Final']
  ];
  let tmStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const tm = targetRound.thesisScores?.[st.studentId];
    tmData.push([
      tmStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(tm?.hd?.scorerName || ''),
      sanitizeExcelCell(tm?.pb?.scorerName || ''),
      (tm?.hd?.status === 'completed') ? tm.hd.score : '',
      (tm?.pb?.status === 'completed') ? tm.pb.score : '',
      getThesisFinalScore(st.studentId, roundId) ?? ''
    ]);
  });
  const wsTm = XLSX.utils.aoa_to_sheet(tmData);
  XLSX.utils.book_append_sheet(wb, wsTm, 'TM');

  // 6. BAO_VE SHEET
  const bvData = [
    ['STT', 'MSSV', 'Họ và tên', 'Hội đồng', 'CT', 'UV', 'TK', 'Điểm Bảo vệ chính thức']
  ];
  let bvStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const dScore = getStudentDefenseScore(st.studentId, roundId);
    bvData.push([
      bvStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      '--',
      '',
      '',
      '',
      dScore !== null ? dScore : ''
    ]);
  });
  const wsBv = XLSX.utils.aoa_to_sheet(bvData);
  XLSX.utils.book_append_sheet(wb, wsBv, 'BAO_VE');

  // 7. AUDIT SHEET
  const logs = targetRound.auditLogs || [];
  const auditData = [
    ['Thời gian', 'Hành động', 'Mã Đợt / Hội đồng', 'Sinh viên', 'Người chấm', 'Điểm cũ', 'Điểm mới', 'Người thực hiện', 'Lý do']
  ];
  logs.forEach(l => {
    auditData.push([
      fmt24h(l.createdAt),
      sanitizeExcelCell(l.action || 'calibration'),
      sanitizeExcelCell(l.councilId || l.roundId || ''),
      sanitizeExcelCell(l.studentName || l.studentId || ''),
      sanitizeExcelCell(l.scorerName || ''),
      l.originalValue ?? '',
      l.newValue ?? '',
      sanitizeExcelCell(l.adjustedByName || l.adjustedById || ''),
      sanitizeExcelCell(l.reason || '')
    ]);
  });
  const wsAudit = XLSX.utils.aoa_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'AUDIT');

  const safeRoundSlug = (targetRound.slug || targetRound.id || 'Round').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Tong-ket_${safeRoundSlug}_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công file: ${filename}`, 'success');
};

window.exportActivityCouncilsToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const actId = document.getElementById('export-activity-select')?.value;
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  if (!act || !act.councils || act.councils.length === 0) {
    showToast('Vui lòng chọn mốc kế hoạch có Hội đồng hợp lệ!', 'warning');
    return;
  }

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  // SAME COLUMN STRUCTURE ACROSS ALL COUNCILS IN ACTIVITY
  const slots = act.councilStructure?.slots || [];
  const headerRow = ['STT', 'MSSV', 'Họ và tên'];
  slots.forEach(s => {
    headerRow.push(`${s.label || s.name}${s.type === 'guest' ? ' (Khách)' : ''}`);
  });
  headerRow.push('Điểm chính thức');

  act.councils.forEach(council => {
    const cSheetName = sanitizeSheetName(council.name || council.id);
    const asgns = (act.councilStudentAssignments || [])
      .filter(a => a.councilId === council.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const sheetRows = [headerRow];
    let stt = 1;

    asgns.forEach(asgn => {
      const sid = asgn.studentId;
      const sObj = findStudentInRound(sid);
      const sName = sObj?.fullName || sObj?.studentName || sid;
      const official = getOfficialDefenseScore(sid, council, act, targetRound);

      const row = [stt++, sanitizeExcelCell(sid), sanitizeExcelCell(sName)];

      slots.forEach(s => {
        const assigned = council.membersBySlot?.[s.key];
        const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
        const scoreKey = scorerId ? `${act.id}_${council.id}_${sid}_${scorerId}` : null;
        const score = scoreKey ? state.councilScores?.[scoreKey] : null;

        if (!assigned) {
          row.push('Chưa phân công');
        } else if (!score || score.status !== 'completed') {
          row.push('Chưa xong');
        } else {
          const isGuest = (s.type === 'guest');
          const isInc = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;
          if (mode === 'all' && isGuest) {
            row.push(`${score.value} (${isInc ? 'LẤY' : 'BỎ'})`);
          } else {
            row.push(score.value);
          }
        }
      });

      row.push(official.isComplete && official.score !== null ? official.score : '');
      sheetRows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, cSheetName);
  });

  const actSlug = (act.slug || act.id || 'Activity').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${actSlug}_Toan-bo-Hoi-dong_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công: ${filename}`, 'success');
};

window.exportSingleCouncilToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const actId = document.getElementById('export-council-activity-select')?.value;
  const councilId = document.getElementById('export-single-council-select')?.value;
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!act || !council) {
    showToast('Vui lòng chọn Mốc và Hội đồng hợp lệ!', 'warning');
    return;
  }

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  const slots = act.councilStructure?.slots || [];
  const headerRow = ['STT', 'MSSV', 'Họ và tên'];
  slots.forEach(s => {
    headerRow.push(`${s.label || s.name}${s.type === 'guest' ? ' (Khách)' : ''}`);
  });
  headerRow.push('Điểm chính thức');

  const asgns = (act.councilStudentAssignments || [])
    .filter(a => a.councilId === council.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const sheetRows = [headerRow];
  let stt = 1;

  asgns.forEach(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const official = getOfficialDefenseScore(sid, council, act, targetRound);

    const row = [stt++, sanitizeExcelCell(sid), sanitizeExcelCell(sName)];

    slots.forEach(s => {
      const assigned = council.membersBySlot?.[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${act.id}_${council.id}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (!assigned) {
        row.push('Chưa phân công');
      } else if (!score || score.status !== 'completed') {
        row.push('Chưa xong');
      } else {
        const isGuest = (s.type === 'guest');
        const isInc = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;
        if (mode === 'all' && isGuest) {
          row.push(`${score.value} (${isInc ? 'LẤY' : 'BỎ'})`);
        } else {
          row.push(score.value);
        }
      }
    });

    row.push(official.isComplete && official.score !== null ? official.score : '');
    sheetRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  const cSheetName = sanitizeSheetName(council.name || 'Hoi_Dong');
  XLSX.utils.book_append_sheet(wb, ws, cSheetName);

  const actSlug = (act.slug || act.id || 'Bao-ve').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cSlug = (council.slug || council.name || 'HD').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${actSlug}_${cSlug}_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công: ${filename}`, 'success');
};

window.exportAuditLogsToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const wb = XLSX.utils.book_new();
  const logs = targetRound.auditLogs || [];

  const auditData = [
    ['Thời gian', 'Hành động', 'Mã Đợt / Hội đồng', 'Sinh viên', 'Người chấm', 'Điểm cũ', 'Điểm mới', 'Người thực hiện', 'Vai trò', 'Lý do']
  ];

  logs.forEach(l => {
    auditData.push([
      fmt24h(l.createdAt),
      sanitizeExcelCell(l.action || 'calibration'),
      sanitizeExcelCell(l.councilId || l.roundId || ''),
      sanitizeExcelCell(l.studentName || l.studentId || ''),
      sanitizeExcelCell(l.scorerName || ''),
      l.originalValue ?? '',
      l.newValue ?? '',
      sanitizeExcelCell(l.adjustedByName || l.adjustedById || ''),
      sanitizeExcelCell(l.adjustedByRole || ''),
      sanitizeExcelCell(l.reason || '')
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, ws, 'AUDIT_LOGS');

  const filename = `Audit_Logs_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất nhật ký kiểm toán: ${filename}`, 'success');
};

function fmtToday() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// 8. STUDENT FINAL SCORE & RANKING PORTAL CARD
window.renderStudentFinalScoreCard = function(userMssv, round) {
  const card = document.getElementById('student-final-score-card');
  if (!card) return;

  if (!round || !round.publishFinalScoreToStudents || !userMssv) {
    card.classList.add('hidden');
    return;
  }

  const fScore = getFinalScore(userMssv, round.id);
  if (!fScore.complete) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');

  // Fill scores
  const gvhdEl = document.getElementById('st-card-gvhd-score');
  if (gvhdEl) gvhdEl.textContent = fScore.components?.gvhd?.display || '--';

  const tmEl = document.getElementById('st-card-tm-score');
  if (tmEl) tmEl.textContent = fScore.components?.tm?.display || '--';

  const defEl = document.getElementById('st-card-defense-score');
  if (defEl) defEl.textContent = fScore.components?.defense?.display || '--';

  const finalEl = document.getElementById('st-card-final-score');
  if (finalEl) finalEl.textContent = fScore.displayScore || '--';

  // Ranking & Titles if published
  const rankWrap = document.getElementById('st-card-ranking-wrap');
  const rankDisplay = document.getElementById('st-card-rank-display');
  const titleDisplay = document.getElementById('st-card-title-display');
  const titleBadge = document.getElementById('student-final-score-title-badge');

  if (round.publishRankingToStudents) {
    const ranking = computeRoundRanking(round.id);
    const myRankItem = (ranking.rankedStudents || []).find(st => st.studentId === userMssv);

    if (myRankItem && rankWrap) {
      rankWrap.classList.remove('hidden');
      if (rankDisplay) rankDisplay.textContent = `Hạng ${myRankItem.rank}`;
      if (titleDisplay) {
        titleDisplay.textContent = myRankItem.title ? `🎖️ ${myRankItem.title}` : '';
      }
      if (titleBadge && myRankItem.title) {
        titleBadge.classList.remove('hidden');
        titleBadge.innerHTML = `<span class="badge bg-amber-400 text-slate-950 font-black text-sm shadow-md">🎖️ ${myRankItem.title}</span>`;
      }
    }
  } else {
    if (rankWrap) rankWrap.classList.add('hidden');
    if (titleBadge) titleBadge.classList.add('hidden');
  }
};




// ============================================================================
// IFA+ GRADUATION BETA v2.3.1-beta.1:
// PHASE B MIGRATION — SUBCOLLECTION NEW-WRITE + DUAL-READ + TRANSACTIONS
// ============================================================================

// Helper to sanitize keys for document IDs
window.sanitizeFirestoreKey = function(key) {
  if (!key) return 'unknown';
  return String(key).replace(/[\/\\]/g, '_').replace(/\s+/g, '_');
};

// 1. COUNCIL SCORES SUBCOLLECTION HELPERS (NEW-WRITE + DUAL-READ)
window.buildDeterministicCouncilScoreId = function(activityId, councilId, studentId, scorerId) {
  const act = sanitizeFirestoreKey(activityId);
  const cId = sanitizeFirestoreKey(councilId);
  const stId = sanitizeFirestoreKey(studentId);
  const scId = sanitizeFirestoreKey(scorerId);
  return `${act}_${cId}_${stId}_${scId}`;
};

window.saveCouncilScoreRecord = async function(roundId, scoreData) {
  if (!checkImpersonationWriteGuard('Lưu điểm đánh giá hội đồng')) return { success: false, error: 'Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm.' };
  if (!roundId || !scoreData) return { success: false, error: 'Thiếu thông tin roundId hoặc scoreData' };

  const actId = scoreData.activityId;
  const cId = scoreData.councilId;
  const stId = scoreData.studentId;
  const scId = scoreData.scorerId || (scoreData.scorerEmail ? scoreData.scorerEmail.split('@')[0] : 'scorer');
  const scoreId = buildDeterministicCouncilScoreId(actId, cId, stId, scId);

  // Clean document payload
  const docPayload = {
    roundId,
    activityId: actId,
    councilId: cId,
    studentId: stId,
    studentName: scoreData.studentName || '',
    scorerId: scId,
    scorerEmail: scoreData.scorerEmail || '',
    scorerName: scoreData.scorerName || '',
    role: scoreData.role || 'member',
    mode: scoreData.scoreMode || 'defense_rubric',
    score: scoreData.score ?? null,
    total: scoreData.score ?? null,
    rubricScores: scoreData.rubricScores || {},
    components: scoreData.components || {},
    feedback: scoreData.feedback || '',
    status: scoreData.status || 'draft',
    isGuest: Boolean(scoreData.isGuest),
    isOfficialScorer: scoreData.isOfficialScorer !== false,
    calibration: scoreData.calibration || null,
    updatedAt: new Date().toISOString()
  };

  // 1. New Write: Save to subcollection /graduationRounds/{roundId}/councilScores/{scoreId}
  let subcolSuccess = false;
  try {
    const scoreRef = doc(db, 'graduationRounds', roundId, 'councilScores', scoreId);
    await setDoc(scoreRef, docPayload, { merge: true });
    subcolSuccess = true;
  } catch (err) {
    console.warn('Notice: Subcollection councilScores write pending rules approval:', err.message);
  }

  // 2. Phase B Activated: New writes go strictly to subcollection /graduationRounds/{roundId}/councilScores/{scoreId}.
  // We do NOT write into the parent round document to prevent document size bloat.
  const legacyKey = `${actId}_${cId}_${stId}_${scId}`;

  // Update local memory
  if (!state.councilScores) state.councilScores = {};
  state.councilScores[legacyKey] = docPayload;

  return { success: true, scoreId, docPayload, subcolSuccess };
};

window.getCouncilScoreRecord = async function({ roundId, activityId, councilId, studentId, scorerId, fallbackRound }) {
  const act = sanitizeFirestoreKey(activityId);
  const cId = sanitizeFirestoreKey(councilId);
  const st = sanitizeFirestoreKey(studentId);
  const sc = sanitizeFirestoreKey(scorerId);
  const scoreId = `${act}_${cId}_${st}_${sc}`;
  const legacyKey = scoreId;

  // 1. Primary: Try reading from Subcollection
  try {
    const scoreRef = doc(db, 'graduationRounds', roundId, 'councilScores', scoreId);
    const snap = await getDoc(scoreRef);
    if (snap && snap.exists()) {
      return snap.data();
    }
  } catch (e) {}

  // 2. Fallback: Read from in-memory state or fallbackRound.councilScores
  if (state.councilScores?.[legacyKey]) {
    return state.councilScores[legacyKey];
  }
  if (fallbackRound?.councilScores?.[legacyKey]) {
    return fallbackRound.councilScores[legacyKey];
  }

  return null;
};


// 4. FIRST-COMPLETED-WINS TRANSACTIONS (GVHD & TM HD)
window.submitSupervisorScoreTransaction = async function({ roundId, studentId, supervisorId, supervisorEmail, supervisorName, score, feedback, isCompleted }) {
  if (!checkImpersonationWriteGuard('Ghi nhận điểm GVHD')) throw new Error('Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm');
  const roundRef = doc(db, 'graduationRounds', roundId);
  const now = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const roundSnap = await transaction.get(roundRef);
    if (!roundSnap.exists()) {
      throw new Error('Đợt tốt nghiệp không tồn tại.');
    }

    const roundData = roundSnap.data();
    const existing = roundData.supervisorScores?.[studentId];

    // ATOMIC CHECK: First completed wins
    if (isCompleted && existing?.status === 'completed' && existing.submittedBySupervisorId !== supervisorId && !state.isAdmin) {
      throw new Error(`Điểm GVHD đã được hoàn tất trước bởi ${existing.submittedByName || 'giảng viên khác'}.`);
    }

    const newRecord = {
      roundId,
      studentId,
      score: isNaN(score) ? null : score,
      comment: feedback || '',
      submittedBySupervisorId: supervisorId,
      submittedByName: supervisorName,
      submittedByEmail: supervisorEmail,
      decidedBy: supervisorEmail,
      supervisorEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };

    transaction.update(roundRef, {
      [`supervisorScores.${studentId}`]: newRecord,
      updatedAt: serverTimestamp()
    });

    return newRecord;
  });
};

window.submitThesisScoreHDTransaction = async function({ roundId, studentId, supervisorId, supervisorEmail, supervisorName, score, feedback, isCompleted }) {
  if (!checkImpersonationWriteGuard('Ghi nhận điểm Đồ án HD')) throw new Error('Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm');
  const roundRef = doc(db, 'graduationRounds', roundId);
  const now = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const roundSnap = await transaction.get(roundRef);
    if (!roundSnap.exists()) {
      throw new Error('Đợt tốt nghiệp không tồn tại.');
    }

    const roundData = roundSnap.data();
    const existing = roundData.thesisScores?.[studentId]?.hd;

    // ATOMIC CHECK: First completed wins
    if (isCompleted && existing?.status === 'completed' && existing.submittedBySupervisorId !== supervisorId && !state.isAdmin) {
      throw new Error(`Điểm TM HD đã được hoàn tất trước bởi ${existing.submittedByName || 'giảng viên khác'}.`);
    }

    const newRecord = {
      roundId,
      studentId,
      score: isNaN(score) ? null : score,
      comment: feedback || '',
      submittedBySupervisorId: supervisorId,
      submittedByName: supervisorName,
      submittedByEmail: supervisorEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };

    transaction.update(roundRef, {
      [`thesisScores.${studentId}.hd`]: newRecord,
      updatedAt: serverTimestamp()
    });

    return newRecord;
  });
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getStudentDefenseScore !== 'undefined') window.getStudentDefenseScore = getStudentDefenseScore;
  if (typeof getFinalScore !== 'undefined') window.getFinalScore = getFinalScore;
  if (typeof computeRoundRanking !== 'undefined') window.computeRoundRanking = computeRoundRanking;
  if (typeof sanitizeExcelCell !== 'undefined') window.sanitizeExcelCell = sanitizeExcelCell;
  if (typeof sanitizeSheetName !== 'undefined') window.sanitizeSheetName = sanitizeSheetName;
  if (typeof fmtToday !== 'undefined') window.fmtToday = fmtToday;
}
