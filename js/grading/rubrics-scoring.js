/**
 * IFA+ Graduation — Council Live Scoring & Admin Monitor Submodule
 */
function getActiveCouncilScorerId() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const round = (state.rounds || []).find(r => r.id === roundId);
  const activity = (round?.activities || []).find(a => a.id === activityId);
  const council = (activity?.councils || []).find(c => c.id === councilId);
  return window.resolveCouncilScorerId(council, auth, getEffectiveActor());
}
const findStudentInRound = (sid, roundId) => {
  if (typeof window !== 'undefined' && typeof window.getStudentFullProfile === 'function') {
    const r = (state.rounds || []).find(rd => rd.id === (roundId || state.activeCouncilWorkspace?.roundId || state.selectedAssessmentRoundId || state.selectedRoundId)) || state.activeRound;
    const act = (r?.activities || []).find(a => a.id === state.activeCouncilWorkspace?.activityId);
    const council = (act?.councils || []).find(c => c.id === state.activeCouncilWorkspace?.councilId);
    return window.getStudentFullProfile(sid, act, council, r);
  }
  if (typeof window !== 'undefined' && typeof window.findStudentInRound === 'function') {
    return window.findStudentInRound(sid, roundId);
  }
  const r = (state.rounds || []).find(rd => rd.id === (roundId || state.activeCouncilWorkspace?.roundId || state.selectedAssessmentRoundId || state.selectedRoundId)) || state.activeRound;
  const all = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (r?.eligibleStudents || r?.registrations || []);
  const found = all.find(s => (s.mssv || s.studentId) === sid);
  return found || { studentId: sid, mssv: sid };
};
function renderScoringSection() {
  const container = document.getElementById('cws-scoring-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  const scoringEnabled = Boolean(act?.scoringConfig?.enabled !== false && (act?.councilEnabled || act?.scoringConfig?.enabled));
  if (!scoringEnabled) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const sid = state.activeCouncilSelectedStudentId;
  const myScorerId = getActiveCouncilScorerId();
  const scoreKey = `${activityId}_${councilId}_${sid}_${myScorerId}`;
  const savedScore = state.councilScores?.[scoreKey];
  const draft = state.councilLocalDrafts?.[sid];

  // Resolve current working values
  const currentVal = draft?.value !== undefined ? draft.value : (savedScore?.value ?? '');
  const currentComment = draft?.comment !== undefined ? draft.comment : (savedScore?.comment ?? '');
  const isCompleted = (savedScore?.status === 'completed' && !draft);
  const councilEnded = (council.status === 'ended' || council.status === 'completed');

  // Count draft scores across all students assigned to this council for current scorer
  const assignments = (act?.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  let councilDraftsCount = 0;
  assignments.forEach(asgn => {
    const k = `${activityId}_${councilId}_${asgn.studentId}_${myScorerId}`;
    const sc = state.councilScores?.[k];
    const hasLocalDraft = Boolean(state.councilLocalDrafts?.[asgn.studentId]?.value !== undefined || state.councilLocalDrafts?.[asgn.studentId]?.components);
    if (sc?.status === 'draft' || hasLocalDraft) {
      councilDraftsCount++;
    }
  });

  const batchFinalizeBtnHtml = councilDraftsCount > 0 ? `
    <button type="button" onclick="batchFinalizeAllCouncilScores()" class="cws-score-action w-full sm:w-auto px-3.5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5" title="Hoàn tất và nộp tất cả ${councilDraftsCount} phiếu điểm đang lưu tạm trong hội đồng này">
      <span>✓ Hoàn tất chấm tất cả</span>
      <span class="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px] font-mono">${councilDraftsCount}</span>
    </button>
  ` : '';

  const scoringConfig = act.scoringConfig || { enabled: true, mode: 'defense_rubric' };
  const mode = scoringConfig.mode || 'defense_rubric';

  let inputHtml = '';
  if (mode === 'letter') {
    const opts = (act.scoringConfig.letterOptions && act.scoringConfig.letterOptions.length > 0)
      ? act.scoringConfig.letterOptions
      : (typeof DEFAULT_LETTER_GRADE_SCALE !== 'undefined' ? DEFAULT_LETTER_GRADE_SCALE : []);

    // Helper for rendering a single letter button
    const renderLetterBtn = (o) => {
      if (!o) return '';
      const isSelected = String(currentVal) === String(o.key) || String(currentVal) === String(o.code);
      return `
        <button type="button" ${isCompleted ? 'disabled' : ''} onclick="onSelectLetterScore('${o.key}')" class="p-2 sm:p-2.5 rounded-xl border text-center transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500 font-black text-emerald-950 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300 font-semibold text-slate-700 hover:bg-slate-50'} ${isCompleted ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}">
          <span class="text-sm sm:text-base block font-mono font-black text-emerald-700">${o.key}</span>
          <span class="text-[10px] sm:text-[11px] block mt-0.5 text-slate-600 truncate">${o.label || o.description || ''}</span>
        </button>
      `;
    };

    // Find top tier A++ / A+++
    const appOpt = opts.find(o => String(o.key).includes('++') || String(o.key).includes('+++') || String(o.code).includes('++'));
    
    // Group A tier (ordered: A-, A, A+)
    const aOrder = ['A-', 'A', 'A+'];
    const aOpts = aOrder.map(k => opts.find(o => o.key === k || o.code === k)).filter(Boolean);
    // If standard keys not found, fallback to any A
    const allA = opts.filter(o => o !== appOpt && (String(o.key).startsWith('A') || String(o.code).startsWith('A')));
    const finalAOpts = aOpts.length > 0 ? aOpts : allA;

    // Group B tier (ordered: B-, B, B+)
    const bOrder = ['B-', 'B', 'B+'];
    const bOpts = bOrder.map(k => opts.find(o => o.key === k || o.code === k)).filter(Boolean);
    const allB = opts.filter(o => String(o.key).startsWith('B') || String(o.code).startsWith('B'));
    const finalBOpts = bOpts.length > 0 ? bOpts : allB;

    // Group C tier (ordered: C-, C, C+)
    const cOrder = ['C-', 'C', 'C+'];
    const cOpts = cOrder.map(k => opts.find(o => o.key === k || o.code === k)).filter(Boolean);
    const allC = opts.filter(o => String(o.key).startsWith('C') || String(o.code).startsWith('C'));
    const finalCOpts = cOpts.length > 0 ? cOpts : allC;

    // Any other tiers (D, F, etc.)
    const usedSet = new Set([appOpt, ...finalAOpts, ...finalBOpts, ...finalCOpts].filter(Boolean));
    const otherOpts = opts.filter(o => !usedSet.has(o));

    inputHtml = `
      <div class="space-y-2">
        <label class="font-bold text-slate-800 text-xs block mb-1">Mức điểm / Đánh giá (*):</label>
        
        <!-- ROW 1: A++ / A+++ (FULL WIDTH) -->
        ${appOpt ? `
          <div class="w-full">
            <button type="button" ${isCompleted ? 'disabled' : ''} onclick="onSelectLetterScore('${appOpt.key}')" class="w-full p-2.5 sm:p-3 rounded-xl border text-center transition-all flex items-center justify-center gap-3 ${String(currentVal) === String(appOpt.key) ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500 font-black text-emerald-950 shadow-xs' : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300 font-bold text-emerald-900 hover:bg-emerald-100/50'} ${isCompleted ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}">
              <span class="text-base font-mono font-black text-emerald-800">${appOpt.key}</span>
              <span class="text-xs font-bold text-emerald-950">${appOpt.label || 'Xuất sắc'}</span>
            </button>
          </div>
        ` : ''}

        <!-- ROW 2: A-, A, A+ (3 COLUMNS) -->
        ${finalAOpts.length > 0 ? `
          <div class="grid grid-cols-3 gap-2">
            ${finalAOpts.map(o => renderLetterBtn(o)).join('')}
          </div>
        ` : ''}

        <!-- ROW 3: B-, B, B+ (3 COLUMNS) -->
        ${finalBOpts.length > 0 ? `
          <div class="grid grid-cols-3 gap-2">
            ${finalBOpts.map(o => renderLetterBtn(o)).join('')}
          </div>
        ` : ''}

        <!-- ROW 4: C-, C, C+ (3 COLUMNS) -->
        ${finalCOpts.length > 0 ? `
          <div class="grid grid-cols-3 gap-2">
            ${finalCOpts.map(o => renderLetterBtn(o)).join('')}
          </div>
        ` : ''}

        <!-- OTHER ROWS (D, F, etc.) -->
        ${otherOpts.length > 0 ? `
          <div class="grid grid-cols-3 gap-2">
            ${otherOpts.map(o => renderLetterBtn(o)).join('')}
          </div>
        ` : ''}

        <input type="hidden" id="cws-score-input-letter" value="${currentVal}">
      </div>
    `;
  } else if (mode === 'defense_rubric') {
    const rubric = act.scoringConfig.rubric || [
      { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1 },
      { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2 },
      { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3 },
      { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4 }
    ];
    const components = (draft?.components !== undefined)
      ? draft.components
      : (savedScore?.components || {});

    let compSum = 0;
    const compRows = rubric.map(crit => {
      const cVal = components[crit.key] !== undefined ? components[crit.key] : '';
      if (cVal !== '' && !isNaN(Number(cVal))) {
        compSum += Number(cVal);
      }
      return `
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div class="flex items-center justify-between">
            <label class="font-bold text-slate-800 text-xs">${crit.label} <span class="text-indigo-600 font-mono text-[11px]">(tối đa ${crit.maxScore}đ)</span></label>
            <div class="flex items-center gap-1.5">
              <input type="number" id="cws-rubric-input-${crit.key}" data-crit-key="${crit.key}" data-max-score="${crit.maxScore}" value="${cVal}" min="0" max="${crit.maxScore}" step="0.1" ${isCompleted ? 'disabled' : ''} oninput="onRubricComponentChange('${crit.key}', this.value)" placeholder="0 – ${crit.maxScore}" class="w-24 p-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-right ${isCompleted ? 'bg-slate-100' : 'bg-white focus:ring-2 focus:ring-indigo-500'}">
              <span class="text-[11px] text-slate-500 font-mono font-bold">/${crit.maxScore}</span>
            </div>
          </div>
          ${crit.description ? `<p class="text-[10px] text-slate-500">${crit.description}</p>` : ''}
        </div>
      `;
    }).join('');

    const totalValNum = currentVal !== '' && !isNaN(Number(currentVal)) ? Number(currentVal) : null;
    const hasMismatch = (totalValNum !== null && Math.abs(compSum - totalValNum) >= 0.000001);

    inputHtml = `
      <div class="space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <label class="font-bold text-slate-800 text-xs">Chấm điểm theo Rubric Bảo vệ (Defense Rubric):</label>
          <button type="button" ${isCompleted ? 'disabled' : ''} onclick="syncRubricSumToTotal()" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 transition-colors">
            ∑ Cộng tiêu chí vào Điểm tổng
          </button>
        </div>

        <div class="space-y-2">
          ${compRows}
        </div>

        <div class="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
          <div>
            <span class="font-bold text-indigo-950 text-xs block">Điểm Tổng kết Bảo vệ (*):</span>
            <span class="text-[10px] text-indigo-700">Tổng các tiêu chí: <strong id="cws-rubric-comp-sum">${compSum.toFixed(2)}</strong></span>
          </div>
          <div class="flex items-center gap-2">
            <input type="number" id="cws-score-input-numeric" value="${currentVal}" min="0" max="10" step="0.1" oninput="onScoreInputChange(this.value)" ${isCompleted ? 'disabled' : ''} placeholder="0 – 10" class="w-28 p-2 border border-slate-300 rounded-xl font-mono text-sm font-black text-slate-900 text-right ${isCompleted ? 'bg-slate-100' : 'bg-white focus:ring-2 focus:ring-blue-500'}">
            <span class="text-xs text-slate-500 font-semibold">/ 10 điểm</span>
          </div>
        </div>

        ${hasMismatch ? `
          <div id="cws-rubric-mismatch-warning" class="p-2.5 bg-amber-100/70 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>Tổng tiêu chí (${compSum.toFixed(2)}) chưa khớp với Điểm tổng (${totalValNum})! Vui lòng bấm "Cộng tiêu chí vào Điểm tổng" hoặc điều chỉnh trước khi hoàn tất.</span>
          </div>
        ` : ''}
      </div>
    `;
  } else {
    const nCfg = act.scoringConfig.numericConfig || { min: 0, max: 10, step: 0.1 };
    inputHtml = `
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="font-bold text-slate-800 text-xs">Điểm đánh giá (*) [Thang điểm ${nCfg.min} – ${nCfg.max}]:</label>
          <span class="text-[11px] text-slate-400 font-mono">Bước điểm: ${nCfg.step}</span>
        </div>
        <div class="flex items-center gap-3">
          <input type="number" id="cws-score-input-numeric" value="${currentVal}" min="${nCfg.min}" max="${nCfg.max}" step="${nCfg.step}" oninput="onScoreInputChange(this.value)" ${isCompleted ? 'disabled' : ''} placeholder="${nCfg.min} – ${nCfg.max}" class="w-36 p-2 border border-slate-300 rounded-xl font-mono text-sm font-black text-slate-900 ${isCompleted ? 'bg-slate-100' : 'bg-white focus:ring-2 focus:ring-blue-500'}">
          <span class="text-xs text-slate-500 font-semibold">/ ${nCfg.max} điểm</span>
        </div>
      </div>
    `;
  }

  // Action buttons
  let actionsHtml = '';
  if (isCompleted) {
    actionsHtml = `
      <div class="flex items-center justify-between gap-2 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex-wrap">
        <span class="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
          <span>✓</span> Bạn đã hoàn tất chấm lúc ${fmt24h(savedScore.completedAt || savedScore.updatedAt)}
        </span>
        <div class="flex items-center justify-center gap-2 flex-wrap w-full sm:w-auto">
          ${batchFinalizeBtnHtml}
          ${!councilEnded ? `
            <button type="button" onclick="reopenCurrentScore()" class="px-3 py-1.5 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold shadow-xs cursor-pointer">
              ✏️ Mở lại để sửa
            </button>
          ` : ''}
        </div>
      </div>
    `;
  } else {
    actionsHtml = `
      <div class="flex flex-col items-center gap-2 pt-2 border-t border-slate-100">
        <button type="button" onclick="saveCurrentScore(true)" class="cws-score-action w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
          <span>✓</span> <span>Hoàn tất chấm SV này</span>
        </button>
        ${batchFinalizeBtnHtml}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h3 class="font-black text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
        <span>📝</span> PHIẾU CHẤM ĐIỂM CỦA BẠN
      </h3>
    </div>

    ${inputHtml}

    <div>
      <label class="font-bold text-slate-800 text-xs block mb-1">Nhận xét chuyên môn (không bắt buộc):</label>
      <textarea id="cws-score-comment" rows="4" ${isCompleted ? 'disabled' : ''} oninput="onScoreCommentChange(this.value)" placeholder="Góp ý chuyên môn, ưu khuyết điểm cho sinh viên..." class="w-full p-3 border border-slate-300 rounded-xl text-xs resize-y min-h-[100px] ${isCompleted ? 'bg-slate-100 text-slate-600' : 'bg-white focus:ring-2 focus:ring-blue-500'}" style="resize: vertical; min-height: 100px;">${escapeHtml(currentComment)}</textarea>
    </div>

    ${actionsHtml}

    <p class="text-[10px] text-slate-400 italic">🔒 Điểm và nhận xét của bạn được bảo mật riêng tư, các thành viên khác trong Hội đồng và Sinh viên không thể xem chi tiết điểm này.</p>
  `;
}

window.onSelectLetterScore = function(key) {
  const input = document.getElementById('cws-score-input-letter');
  if (input) input.value = key;
  onScoreInputChange(key);
  renderScoringSection();
};

window.onScoreInputChange = function(val) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].value = val;
};

window.onScoreCommentChange = function(comm) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].comment = comm;
};

// 11. SAVE & REOPEN SCORE (CONCURRENCY & PRIVACY)
window.saveCurrentScore = async function(isCompleted) {
  if (!checkImpersonationWriteGuard('Lưu điểm thành viên hội đồng')) return;

  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!act || !council) return;

  const effectiveScorer = getEffectiveActor();
  const scorerId = getActiveCouncilScorerId();
  const scorerEmail = (effectiveScorer.email || '').toLowerCase().trim();
  const scorerName = effectiveScorer.displayName || auth?.roleName || 'Thành viên Hội đồng';
  const scoreKey = `${activityId}_${councilId}_${sid}_${scorerId}`;

  const mode = act.scoringConfig?.mode || 'numeric';
  let val = '';
  let components = {};

  if (mode === 'letter') {
    val = document.getElementById('cws-score-input-letter')?.value || state.councilLocalDrafts?.[sid]?.value || '';
  } else if (mode === 'defense_rubric') {
    val = document.getElementById('cws-score-input-numeric')?.value ?? state.councilLocalDrafts?.[sid]?.value ?? '';
    const rubric = act.scoringConfig.rubric || [
      { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4 },
      { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3 },
      { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2 },
      { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1 }
    ];

    // Read current components
    components = state.councilLocalDrafts?.[sid]?.components || state.councilScores?.[scoreKey]?.components || {};
    rubric.forEach(crit => {
      const inp = document.getElementById(`cws-rubric-input-${crit.key}`);
      if (inp && inp.value !== '' && !isNaN(Number(inp.value))) {
        components[crit.key] = Number(inp.value);
      }
    });

    if (isCompleted) {
      if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
        showToast('Vui lòng nhập điểm tổng trước khi hoàn tất chấm!', 'warning');
        return;
      }
      const totalNum = Number(val);
      if (totalNum < 0 || totalNum > 10) {
        showToast('Điểm tổng kết bảo vệ phải từ 0 đến 10!', 'warning');
        return;
      }

      let compSum = 0;
      for (const crit of rubric) {
        const cVal = components[crit.key];
        if (cVal === undefined || cVal === null || cVal === '' || isNaN(Number(cVal))) {
          showToast(`Vui lòng chấm tiêu chí "${crit.label}"!`, 'warning');
          return;
        }
        const nVal = Number(cVal);
        if (nVal < 0 || nVal > crit.maxScore) {
          showToast(`Tiêu chí "${crit.label}" phải từ 0 đến ${crit.maxScore}!`, 'warning');
          return;
        }
        compSum += nVal;
      }

      if (Math.abs(compSum - totalNum) >= 0.000001) {
        showToast(`Tổng tiêu chí (${compSum.toFixed(2)}) chưa khớp với Điểm tổng (${totalNum})! Vui lòng bấm "Cộng tiêu chí vào Điểm tổng".`, 'warning');
        return;
      }
    }
  } else {
    val = document.getElementById('cws-score-input-numeric')?.value || state.councilLocalDrafts?.[sid]?.value || '';
  }
  const comment = document.getElementById('cws-score-comment')?.value || state.councilLocalDrafts?.[sid]?.comment || '';

  if (isCompleted) {
    if (val === '' || val === null || val === undefined) {
      showToast('Vui lòng chọn hoặc nhập điểm trước khi hoàn tất chấm!', 'warning');
      return;
    }
    if (mode === 'numeric') {
      const num = parseFloat(val);
      const min = act.scoringConfig.numericConfig?.min ?? 0;
      const max = act.scoringConfig.numericConfig?.max ?? 10;
      if (isNaN(num) || num < min || num > max) {
        showToast(`Điểm phải nằm trong thang điểm từ ${min} đến ${max}!`, 'warning');
        return;
      }
    }

    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const confirmed = await showConfirm(
      'Xác nhận hoàn tất chấm',
      `Xác nhận hoàn tất chấm sinh viên "${sName}" (${sid}) với kết quả: ${val}?`,
      { confirmText: 'Hoàn tất chấm', danger: false }
    );
    if (!confirmed) return;
  }

  let selectedLetterCode = undefined;
  let selectedLetterNumericValue = undefined;
  if (mode === 'letter') {
    selectedLetterCode = String(val);
    const letterOpt = (act.scoringConfig?.letterOptions || []).find(o => String(o.key) === selectedLetterCode || String(o.code) === selectedLetterCode);
    if (letterOpt && typeof letterOpt.numericValue === 'number') {
      selectedLetterNumericValue = letterOpt.numericValue;
    }
  }

  const existing = state.councilScores?.[scoreKey] || {};
  const scoreRecord = {
    activityId,
    councilId,
    studentId: sid,
    scorerId,
    scorerEmail,
    scorerName,
    decidedBy: scorerEmail,
    supervisorEmail: scorerEmail,
    slotKey: auth.slotKey || 'admin',
    role: auth.role || 'member',
    mode,
    value: (mode === 'numeric' || mode === 'defense_rubric') ? parseFloat(val) : String(val),
    selectedLetterCode,
    selectedLetterNumericValue,
    numericValue: (mode === 'numeric' || mode === 'defense_rubric')
      ? parseFloat(val)
      : (typeof selectedLetterNumericValue === 'number' ? selectedLetterNumericValue : undefined),
    components: mode === 'defense_rubric' ? components : undefined,
    comment: String(comment || '').trim(),
    status: isCompleted ? 'completed' : 'draft',
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: isCompleted ? (existing.completedAt || new Date().toISOString()) : null
  };

  // Persist first: a failed write must never look like a completed score.
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', scoreKey);
    await setDoc(decRef, scoreRecord, { merge: true });

    // Admin cache remains compatible with legacy reports. FieldPath keeps IDs
    // containing periods (email addresses) as a single map key.
    if (state.isAdmin) {
      await updateDoc(roundRef, new window.FieldPath('councilScores', scoreKey), scoreRecord, 'updatedAt', serverTimestamp()).catch(err => console.warn('Council score cache notice:', err));
    }
  } catch (err) {
    console.error('Persist council score failed:', err);
    showToast('Không lưu được điểm. Vui lòng thử lại; kết quả chưa được ghi nhận.', 'error');
    return;
  }

  state.councilScores[scoreKey] = scoreRecord;
  delete state.councilLocalDrafts[sid];

  // Refresh Views
  renderCouncilStudentList();
  renderScoringSection();
  renderScorersProgress();
  renderAdminMonitor();

  if (typeof window.renderAssessmentDefenseList === 'function' && state.currentView === 'assessment') {
    window.renderAssessmentDefenseList();
  }
  if (typeof window.renderAssessmentHeroCard === 'function' && state.currentView === 'assessment') {
    window.renderAssessmentHeroCard();
  }

  const sObj = findStudentInRound(sid);
  const sName = sObj?.fullName || sObj?.studentName || sid;
  if (isCompleted) {
    showToast(`✓ Đã hoàn tất chấm điểm sinh viên ${sName}!`, 'success');
  } else {
    showToast(`Đã lưu tạm điểm cho sinh viên ${sName}.`, 'info');
  }
};

window.reopenCurrentScore = async function() {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const scorerId = getActiveCouncilScorerId();
  const scoreKey = `${activityId}_${councilId}_${sid}_${scorerId}`;

  const existing = state.councilScores?.[scoreKey];
  if (!existing) return;

  const draftScore = { ...existing, status: 'draft', updatedAt: new Date().toISOString() };

  try {
    const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', scoreKey);
    await setDoc(decRef, draftScore, { merge: true });
    if (state.isAdmin) {
      const roundRef = doc(db, 'graduationRounds', roundId);
      await updateDoc(roundRef, new window.FieldPath('councilScores', scoreKey), draftScore, 'updatedAt', serverTimestamp()).catch(err => console.warn('Council score cache notice:', err));
    }
  } catch (err) {
    showToast('Không mở lại được phiếu điểm. Vui lòng thử lại.', 'error');
    return;
  }
  state.councilScores[scoreKey] = draftScore;

  renderCouncilStudentList();
  renderScoringSection();
  renderScorersProgress();
  renderAdminMonitor();
  showToast('Đã mở lại phiếu chấm. Bạn có thể chỉnh sửa và hoàn tất lại.', 'info');
};

window.batchFinalizeAllCouncilScores = async function() {
  if (!checkImpersonationWriteGuard('Hoàn tất chấm tất cả sinh viên')) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!act || !council) return;

  const effectiveScorer = getEffectiveActor();
  const scorerId = getActiveCouncilScorerId();
  const scorerEmail = (effectiveScorer.email || '').toLowerCase().trim();
  const scorerName = effectiveScorer.displayName || auth?.roleName || 'Thành viên Hội đồng';

  const assignments = (act.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  if (assignments.length === 0) {
    showToast('Hội đồng chưa có sinh viên nào.', 'warning');
    return;
  }

  const mode = act.scoringConfig?.mode || 'defense_rubric';
  const rubric = act.scoringConfig?.rubric || [
    { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4 },
    { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3 },
    { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2 },
    { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1 }
  ];

  // Save current student input first to drafts if present in DOM
  const curSid = state.activeCouncilSelectedStudentId;
  if (curSid) {
    const valInput = document.getElementById('cws-score-input-numeric') || document.getElementById('cws-score-input-letter');
    const commInput = document.getElementById('cws-score-comment');
    if (valInput && valInput.value !== '') {
      state.councilLocalDrafts = state.councilLocalDrafts || {};
      state.councilLocalDrafts[curSid] = state.councilLocalDrafts[curSid] || {};
      state.councilLocalDrafts[curSid].value = valInput.value;
      if (commInput) state.councilLocalDrafts[curSid].comment = commInput.value;
      
      if (mode === 'defense_rubric') {
        const rubricInputs = document.querySelectorAll('input[data-crit-key]');
        const components = {};
        rubricInputs.forEach(inp => {
          if (inp.value !== '' && !isNaN(Number(inp.value))) components[inp.dataset.critKey] = Number(inp.value);
        });
        state.councilLocalDrafts[curSid].components = components;
      }
    }
  }

  const candidates = [];
  const uncompletedList = [];

  assignments.forEach(asgn => {
    const sid = asgn.studentId;
    const scoreKey = `${activityId}_${councilId}_${sid}_${scorerId}`;
    const saved = state.councilScores?.[scoreKey];
    const draft = state.councilLocalDrafts?.[sid];

    const val = draft?.value !== undefined ? draft.value : saved?.value;
    const comm = draft?.comment !== undefined ? draft.comment : (saved?.comment || '');
    const comp = draft?.components !== undefined ? draft.components : (saved?.components || {});
    const isAlreadyCompleted = (saved?.status === 'completed' && !draft);

    if (val !== undefined && val !== null && val !== '') {
      candidates.push({
        sid,
        asgn,
        scoreKey,
        value: val,
        comment: comm,
        components: comp,
        isAlreadyCompleted,
        existing: saved
      });
    } else {
      uncompletedList.push(sid);
    }
  });

  if (candidates.length === 0) {
    showToast('Bạn chưa nhập điểm hoặc lưu tạm điểm cho sinh viên nào trong Hội đồng này!', 'warning');
    return;
  }

  const draftCandidates = candidates.filter(c => !c.isAlreadyCompleted);
  if (draftCandidates.length === 0) {
    showToast('Tất cả các phiếu chấm của bạn trong Hội đồng đã được hoàn tất trước đó!', 'info');
    return;
  }

  let confirmMsg = `Bạn đang có ${draftCandidates.length} phiếu chấm lưu tạm/đang soạn thảo. Xác nhận HOÀN TẤT CHẤM toàn bộ ${draftCandidates.length} sinh viên này?`;
  if (uncompletedList.length > 0) {
    confirmMsg += `\n(Lưu ý: Có ${uncompletedList.length} sinh viên chưa nhập điểm sẽ được giữ nguyên để chấm sau).`;
  }

  const confirmed = await showConfirm('Hoàn tất chấm tất cả', confirmMsg, { confirmText: '✓ Xác nhận hoàn tất tất cả', danger: false });
  if (!confirmed) return;

  // Process and batch save
  let successCount = 0;
  const now = new Date().toISOString();
  const roundRef = doc(db, 'graduationRounds', roundId);
  const batchUpdates = [];

  for (const item of draftCandidates) {
    let selectedLetterCode = undefined;
    let selectedLetterNumericValue = undefined;
    if (mode === 'letter') {
      selectedLetterCode = String(item.value);
      const letterOpt = (act.scoringConfig?.letterOptions || []).find(o => String(o.key) === selectedLetterCode || String(o.code) === selectedLetterCode);
      if (letterOpt && typeof letterOpt.numericValue === 'number') {
        selectedLetterNumericValue = letterOpt.numericValue;
      }
    }

    const scoreRecord = {
      activityId,
      councilId,
      studentId: item.sid,
      scorerId,
      scorerEmail,
      scorerName,
      decidedBy: scorerEmail,
      supervisorEmail: scorerEmail,
      slotKey: auth?.slotKey || 'admin',
      role: auth?.role || 'member',
      mode,
      value: (mode === 'numeric' || mode === 'defense_rubric') ? parseFloat(item.value) : String(item.value),
      selectedLetterCode,
      selectedLetterNumericValue,
      numericValue: (mode === 'numeric' || mode === 'defense_rubric')
        ? parseFloat(item.value)
        : (typeof selectedLetterNumericValue === 'number' ? selectedLetterNumericValue : undefined),
      components: mode === 'defense_rubric' ? item.components : undefined,
      comment: String(item.comment || '').trim(),
      status: 'completed',
      createdAt: item.existing?.createdAt || now,
      updatedAt: now,
      completedAt: now
    };

    try {
      const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', item.scoreKey);
      await setDoc(decRef, scoreRecord, { merge: true });
      state.councilScores = state.councilScores || {};
      state.councilScores[item.scoreKey] = scoreRecord;
      if (state.councilLocalDrafts) delete state.councilLocalDrafts[item.sid];
      batchUpdates.push(new window.FieldPath('councilScores', item.scoreKey), scoreRecord);
      successCount++;
    } catch (err) {
      console.warn('Council batch score failed:', err);
    }
  }

  if (state.isAdmin && batchUpdates.length > 0) {
    try {
      await updateDoc(roundRef, ...batchUpdates, 'updatedAt', serverTimestamp());
    } catch (err) { console.warn('Council batch cache notice:', err); }
  }

  renderCouncilStudentList();
  renderScoringSection();
  renderScorersProgress();
  renderAdminMonitor();

  if (typeof window.renderAssessmentDefenseList === 'function' && state.currentView === 'assessment') {
    window.renderAssessmentDefenseList();
  }
  if (typeof window.renderAssessmentHeroCard === 'function' && state.currentView === 'assessment') {
    window.renderAssessmentHeroCard();
  }

  showToast(successCount ? `✓ Đã hoàn tất chấm điểm cho ${successCount} sinh viên!` : 'Không lưu được điểm. Vui lòng thử lại.', successCount ? 'success' : 'error');
};

// 12. PROGRESS OF SCORERS IN COUNCIL (PRIVACY PRESERVED)
function renderScorersProgress() {
  const container = document.getElementById('cws-scorers-progress-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  const sid = state.activeCouncilSelectedStudentId;
  const scoringEnabled = Boolean(act?.scoringConfig?.enabled !== false && (act?.councilEnabled || act?.scoringConfig?.enabled));
  const isChairOrAdmin = Boolean(auth?.isAdmin || auth?.isChair);
  if (!scoringEnabled || !sid || !council || !isChairOrAdmin) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const slots = act.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};
  const myUserId = getActiveCouncilScorerId();

  const reqSlots = getRequiredScorers(council, act);
  const guestSlots = getGuestScorers(council, act);

  let reqCompleted = 0;
  let reqTotal = 0;
  let guestCompleted = 0;
  let guestTotal = 0;

  const itemsHtml = slots.map(s => {
    const assigned = membersBySlot[s.key];
    const isAssigned = Boolean(assigned && (assigned.memberId || assigned.memberName));
    const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
    const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
    const score = scoreKey ? state.councilScores?.[scoreKey] : null;

    const isMandatory = (s.type === 'mandatory');
    if (isMandatory && isAssigned) {
      reqTotal++;
      if (score?.status === 'completed') reqCompleted++;
    } else if (!isMandatory && isAssigned) {
      guestTotal++;
      if (score?.status === 'completed') guestCompleted++;
    }

    // PRIVACY CHECK (v2.0.0-beta.1):
    // Before 'ended': Only see score value if Admin or own score. Chair CANNOT see others.
    // Once 'ended' or 'finalized': Chair sees all scores in their own council!
    const isCouncilEnded = (council.status === 'ended' || council.status === 'finalized' || council.status === 'completed');
    const isOwnScore = (scorerId && (scorerId === myUserId || (assigned?.memberEmail && assigned.memberEmail.toLowerCase() === (getEffectiveActor().email || '').toLowerCase())));
    const canSeeValue = (auth.isAdmin || isOwnScore || (isCouncilEnded && auth.isChair));

    let statusPill = '<span class="text-slate-400 font-mono text-xs">— Chưa chấm</span>';
    if (!isAssigned) {
      statusPill = '<span class="text-slate-300 italic text-[11px]">Chưa phân công</span>';
    } else if (score?.status === 'completed') {
      if (canSeeValue) {
        statusPill = `<span class="badge bg-emerald-100 text-emerald-800 font-bold text-xs">✓ Đã chấm (${score.value})</span>`;
      } else {
        statusPill = '<span class="badge bg-emerald-100 text-emerald-800 font-bold text-xs">✓ Đã hoàn tất</span>';
      }
    } else if (score?.status === 'draft') {
      if (canSeeValue) {
        statusPill = `<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Lưu tạm (${score.value || '--'})</span>`;
      } else {
        statusPill = '<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Đang chấm</span>';
      }
    }

    return `
      <div class="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs">
        <div>
          <span class="font-bold text-slate-800">${s.name || s.label}</span>
          <span class="text-slate-500 font-normal ml-1">(${assigned?.memberName || 'Chưa phân công'})</span>
          ${isMandatory ? '<span class="text-rose-500 font-bold ml-1">*</span>' : ''}
        </div>
        <div>${statusPill}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="font-black text-xs text-slate-800 uppercase tracking-wider">Tiến độ chấm điểm của Hội đồng cho SV này</h4>
      <div class="text-[11px] font-bold text-slate-600 space-x-2">
        <span>Bắt buộc: <strong class="${reqCompleted === reqTotal && reqTotal > 0 ? 'text-emerald-700' : 'text-amber-700'}">${reqCompleted}/${reqTotal}</strong></span>
        ${guestTotal > 0 ? `<span>• Khách mời: <strong>${guestCompleted}/${guestTotal}</strong></span>` : ''}
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
      ${itemsHtml}
    </div>
  `;
}

// 13. ADMIN REAL-TIME MONITOR (ONLY FOR ADMIN)
function renderAdminMonitor() {
  const container = document.getElementById('cws-admin-monitor-section');
  if (container) {
    container.classList.add('hidden');
  }
  if (typeof window.renderPostCouncilSection === 'function') {
    window.renderPostCouncilSection();
  }
}

// 14. URL DIRECT NAVIGATION LISTENER (?hd= or ?x=&a=&c=)
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      if (typeof window.checkAndHandlePendingCouncilDirectLink === 'function') {
        window.checkAndHandlePendingCouncilDirectLink();
      }

      const params = new URLSearchParams(window.location.search);
      const hdCode = params.get('hd');
      const xCode = params.get('x') || params.get('round');
      const aCode = params.get('a');
      const cCode = params.get('c');

      if (!hdCode && xCode && aCode && cCode && state.rounds && state.rounds.length > 0) {
        const targetRound = state.rounds.find(r => !r.deleted && (r.shortCode === xCode || r.roundName === xCode || r.id === xCode || r.slug === xCode));
        if (targetRound) {
          const act = (targetRound.activities || []).find(a => a.id === aCode || a.slug === aCode);
          if (act) {
            const council = (act.councils || []).find(c => c.id === cCode || c.slug === cCode);
            if (council) {
              openCouncilWorkspace(targetRound.id, act.id, council.id);
            }
          }
        }
      }
    } catch (e) {
      console.warn('URL council direct navigation notice:', e);
    }
  }, 1200);
});

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof checkCouncilAuthorization !== 'undefined') window.checkCouncilAuthorization = checkCouncilAuthorization;
  if (typeof getRequiredScorers !== 'undefined') window.getRequiredScorers = getRequiredScorers;
  if (typeof getGuestScorers !== 'undefined') window.getGuestScorers = getGuestScorers;
  if (typeof setupCouncilRealtimeSync !== 'undefined') window.setupCouncilRealtimeSync = setupCouncilRealtimeSync;
  if (typeof loadCouncilScores !== 'undefined') window.loadCouncilScores = loadCouncilScores;
  if (typeof renderCouncilWorkspaceFull !== 'undefined') window.renderCouncilWorkspaceFull = renderCouncilWorkspaceFull;
  if (typeof renderCouncilWorkspacePartialSync !== 'undefined') window.renderCouncilWorkspacePartialSync = renderCouncilWorkspacePartialSync;
  if (typeof renderCouncilStudentList !== 'undefined') window.renderCouncilStudentList = renderCouncilStudentList;
  if (typeof renderCouncilSelectedStudentDetails !== 'undefined') window.renderCouncilSelectedStudentDetails = renderCouncilSelectedStudentDetails;
  if (typeof formatStudentSupervisorsForDisplay !== 'undefined') window.formatStudentSupervisorsForDisplay = formatStudentSupervisorsForDisplay;
  if (typeof renderPresentingBanner !== 'undefined') window.renderPresentingBanner = renderPresentingBanner;
  if (typeof renderSecretaryControls !== 'undefined') window.renderSecretaryControls = renderSecretaryControls;
  if (typeof renderScoringSection !== 'undefined') window.renderScoringSection = renderScoringSection;
  if (typeof renderScorersProgress !== 'undefined') window.renderScorersProgress = renderScorersProgress;
  if (typeof renderAdminMonitor !== 'undefined') window.renderAdminMonitor = renderAdminMonitor;
  if (typeof batchFinalizeAllCouncilScores !== 'undefined') window.batchFinalizeAllCouncilScores = batchFinalizeAllCouncilScores;
}
