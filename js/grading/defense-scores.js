// ============================================================================
import { getCouncilMemberScorerId, getCouncilMemberSlots } from './council-score-helpers.js';
import { normalizeBoundedScoreInput } from './council-score-input.js';
import { DEFAULT_LETTER_GRADE_SCALE, normalizeLetterGradeOptions } from '../planning/activities-manager.js';
// v2.0.0-beta.1: RUBRIC EVENT HANDLERS & OFFICIAL DEFENSE SCORE & CALIBRATION
// ============================================================================

window.onRubricComponentChange = function(critKey, val) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  const input = document.getElementById(`cws-rubric-input-${critKey}`);
  const maxScore = Number(input?.dataset.maxScore);
  if (input && Number.isFinite(maxScore)) {
    const bounded = normalizeBoundedScoreInput(val, 0, maxScore);
    if (bounded !== val) input.value = bounded;
    val = input.value;
  }
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].components = state.councilLocalDrafts[sid].components || {};
  
  if (val === '' || val === null || val === undefined) {
    delete state.councilLocalDrafts[sid].components[critKey];
  } else {
    state.councilLocalDrafts[sid].components[critKey] = Number(val);
  }

  window.updateCouncilRubricScoreFeedback();
};

window.updateCouncilRubricScoreFeedback = function() {
  const inputs = document.querySelectorAll('input[data-crit-key]');
  let sum = 0;
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) sum += v;
  });

  const sumEl = document.getElementById('cws-rubric-comp-sum');
  if (sumEl) sumEl.textContent = sum.toFixed(2);

  const totalInput = document.getElementById('cws-score-input-numeric');
  const warnEl = document.getElementById('cws-rubric-mismatch-warning');
  if (totalInput && warnEl) {
    const curTot = parseFloat(totalInput.value);
    const mismatch = !isNaN(curTot) && Math.abs(sum - curTot) >= 0.000001;
    warnEl.classList.toggle('hidden', !mismatch);
    const message = document.getElementById('cws-rubric-mismatch-text');
    if (message && mismatch) message.textContent = `Tổng tiêu chí (${sum.toFixed(2)}) chưa khớp với Điểm tổng (${curTot}). Vui lòng bấm "Cộng tiêu chí vào Điểm tổng" hoặc điều chỉnh trước khi hoàn tất.`;
  }
};

window.syncRubricSumToTotal = function() {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  const inputs = document.querySelectorAll('input[data-crit-key]');
  let sum = 0;
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) sum += v;
  });

  const totalInput = document.getElementById('cws-score-input-numeric');
  if (totalInput) {
    const maxTotal = Number(totalInput.max) || 10;
    if (sum > maxTotal) {
      showToast(`Tổng điểm thành phần vượt quá ${maxTotal}. Vui lòng điều chỉnh trước khi cộng.`, 'warning');
      return;
    }
    totalInput.value = sum.toFixed(2);
    onScoreInputChange(totalInput.value);
  }

  const warnEl = document.getElementById('cws-rubric-mismatch-warning');
  if (warnEl) warnEl.classList.add('hidden');
  showToast(`Đã cập nhật Điểm tổng: ${sum.toFixed(2)}`, 'info');
};

export function resolveScoreNumericValue(score, act) {
  if (!score) return null;
  if (typeof score.numericValue === 'number' && !isNaN(score.numericValue)) return score.numericValue;
  if (typeof score.selectedLetterNumericValue === 'number' && !isNaN(score.selectedLetterNumericValue)) return score.selectedLetterNumericValue;
  if (typeof score.value === 'number' && !isNaN(score.value)) return score.value;
  if (typeof score.value === 'string') {
    const rawOpts = (Array.isArray(act?.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0)
      ? act.scoringConfig.letterOptions
      : (typeof DEFAULT_LETTER_GRADE_SCALE !== 'undefined' ? DEFAULT_LETTER_GRADE_SCALE : (window.DEFAULT_LETTER_GRADE_SCALE || []));
    const opt = rawOpts.find(o => String(o.key).trim().toUpperCase() === score.value.trim().toUpperCase() || String(o.code).trim().toUpperCase() === score.value.trim().toUpperCase());
    if (opt && typeof opt.numericValue === 'number' && !isNaN(opt.numericValue)) return opt.numericValue;
    const parsed = parseFloat(score.value);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export function resolveNumericToLetter(numericScore, act) {
  if (numericScore === null || numericScore === undefined || isNaN(Number(numericScore))) {
    return null;
  }
  const rawOpts = (Array.isArray(act?.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0)
    ? act.scoringConfig.letterOptions
    : (typeof DEFAULT_LETTER_GRADE_SCALE !== 'undefined' ? DEFAULT_LETTER_GRADE_SCALE : (window.DEFAULT_LETTER_GRADE_SCALE || []));

  const normalizer = typeof normalizeLetterGradeOptions === 'function'
    ? normalizeLetterGradeOptions
    : (window.normalizeLetterGradeOptions || (opts => opts));
  const normOpts = normalizer(rawOpts);

  const validOpts = (normOpts || [])
    .filter(o => o && typeof o.numericValue === 'number' && !isNaN(o.numericValue) && (o.key || o.code))
    .map(o => ({
      key: String(o.key || o.code).trim(),
      code: String(o.code || o.key).trim(),
      label: o.label || o.description || o.key || o.code,
      numericValue: Number(o.numericValue)
    }));

  if (validOpts.length === 0) return null;

  // Sort descending by numericValue (highest score first)
  validOpts.sort((a, b) => b.numericValue - a.numericValue);

  if (validOpts.length === 1) return validOpts[0];

  const scoreNum = Number(numericScore);

  // Dynamic midpoint threshold between consecutive letter grades
  for (let i = 0; i < validOpts.length - 1; i++) {
    const higher = validOpts[i];
    const lower = validOpts[i + 1];
    const midpoint = (higher.numericValue + lower.numericValue) / 2;
    if (scoreNum >= midpoint) {
      return higher;
    }
  }

  // Fallback to lowest option when below the last midpoint
  return validOpts[validOpts.length - 1];
}

export function getOfficialDefenseScore(studentId, council, act, round) {
  if (!council || !act) return { score: null, isComplete: false, count: 0, mandatoryComplete: false };
  const slots = getCouncilMemberSlots(council, act);
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
    const scorerId = getCouncilMemberScorerId(assigned);
    if (!scorerId) continue;
    const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
    const score = state.councilScores?.[scoreKey] || round?.councilScores?.[scoreKey];
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
        const isIncluded = council.guestInclusion?.[studentId]?.[s.key] !== false;
        if (isIncluded) {
          includedGuestScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: resolvedNumeric, displayValue: score.value });
        } else {
          excludedGuestScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: resolvedNumeric, displayValue: score.value });
        }
      }
    }
  }

  const mandatoryComplete = (mandatoryTotal > 0 && mandatoryCompleted === mandatoryTotal);
  const allIncluded = [...mandatoryScores.map(s => s.value), ...includedGuestScores.map(s => s.value)];
  // Retain full IEEE 754 precision!
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

  // formattedScore: in letter mode, official score must display the letter grade (A/B/C)!
  // in numeric/defense_rubric, displays 2 decimal places.
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

window.finalizeCouncilSession = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council || !act) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền chốt điểm Hội đồng!', 'error');
    return;
  }

  // Verification: all mandatory scorers must have completed scores for all students
  const reqSlots = getRequiredScorers(council, act);
  const assignments = (act.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  
  const missingStudents = [];
  for (const asgn of assignments) {
    const sId = asgn.studentId;
    let missingForStudent = false;
    for (const s of reqSlots) {
      const assignedMem = council.membersBySlot?.[s.key];
      const scorerId = getCouncilMemberScorerId(assignedMem);
      if (scorerId) {
        const k = `${activityId}_${councilId}_${sId}_${scorerId}`;
        const sc = state.councilScores?.[k] || targetRound?.councilScores?.[k];
        if (sc?.status !== 'completed') {
          missingForStudent = true;
          break;
        }
      } else {
        missingForStudent = true;
        break;
      }
    }
    if (missingForStudent) {
      missingStudents.push(sId);
    }
  }

  if (missingStudents.length > 0) {
    const confirmMissing = await showConfirm(
      'Chốt điểm Hội đồng',
      `Còn ${missingStudents.length} sinh viên chưa hoàn tất đủ phiếu chấm của tất cả thành viên bắt buộc (ví dụ có thành viên vắng mặt). Bạn có chắc chắn muốn khóa và chốt điểm chính thức cho toàn bộ ${assignments.length} sinh viên của Hội đồng "${council.name}" với các phiếu chấm hiện có?`,
      { confirmText: 'Xác nhận Khóa & Chốt điểm', danger: true }
    );
    if (!confirmMissing) return;
  } else {
    const confirmed = await showConfirm(
      'Chốt điểm Hội đồng',
      `Xác nhận khóa và chốt điểm chính thức cho toàn bộ ${assignments.length} sinh viên của Hội đồng "${council.name}"?`,
      { confirmText: 'Khóa & Chốt điểm', danger: false }
    );
    if (!confirmed) return;
  }

  council.finalDefenseScores = council.finalDefenseScores || {};
  for (const asgn of assignments) {
    const sId = asgn.studentId;
    const official = getOfficialDefenseScore(sId, council, act, targetRound);
    council.finalDefenseScores[sId] = {
      score: official.score,
      letterGrade: official.letterGrade,
      letterLabel: official.letterLabel,
      formattedScore: official.formattedScore,
      completedScoresCount: official.allScoresCount,
      finalizedAt: new Date().toISOString()
    };
  }

  council.status = 'finalized';
  council.finalizedAt = new Date().toISOString();
  council.finalizedBy = getEffectiveActor().email || 'admin';

  // If this activity corresponds to a progress review (Duyệt 1/2/3), also sync to progressReviews map
  const actTitle = String(act.title || '');
  const progressMatch = actTitle.match(/(?:duyệt|duyet)\s*(?:đồ\s*án|do\s*an)?\s*(?:tốt\s*nghiệp|tot\s*nghiep)?\s*(?:đợt|dot)?\s*([1-3])/i);
  if (progressMatch) {
    const phase = progressMatch[1];
    targetRound.progressReviews = targetRound.progressReviews || {};
    targetRound.progressReviews['duyet_' + phase] = targetRound.progressReviews['duyet_' + phase] || {};
    for (const asgn of assignments) {
      const sId = asgn.studentId;
      const fin = council.finalDefenseScores[sId];
      if (fin && (fin.score !== null || fin.letterGrade !== null)) {
        targetRound.progressReviews['duyet_' + phase][sId] = {
          roundId: targetRound.id,
          studentId: sId,
          phase,
          score: fin.score,
          letterGrade: fin.letterGrade,
          letterLabel: fin.letterLabel,
          status: (fin.score !== null && fin.score >= 5) || (fin.letterGrade && !['D', 'D-', 'F'].includes(fin.letterGrade)) ? 'passed' : 'failed',
          councilId: council.id,
          councilName: council.name,
          finalizedAt: council.finalizedAt,
          updatedAt: council.finalizedAt
        };
      }
    }
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`✓ Đã chốt điểm Hội đồng "${council.name}" thành công! Kết quả chính thức đã được ghi nhận.`, 'success');
};

window.openReopenCouncilModal = function() {
  const { auth } = state.activeCouncilWorkspace || {};
  if (!auth || !auth.isAdmin) {
    showToast('Chỉ Quản trị viên mới có quyền mở lại Hội đồng đã chốt điểm!', 'error');
    return;
  }
  document.getElementById('reopen-council-reason').value = '';
  document.getElementById('modal-reopen-council')?.classList.remove('hidden');
};

window.closeReopenCouncilModal = function() {
  document.getElementById('modal-reopen-council')?.classList.add('hidden');
};

window.confirmReopenCouncil = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  if (!auth || !auth.isAdmin) {
    showToast('Chỉ Quản trị viên mới có quyền mở lại Hội đồng!', 'error');
    return;
  }

  const reason = document.getElementById('reopen-council-reason')?.value?.trim();
  if (!reason) {
    showToast('Vui lòng nhập lý do mở lại Hội đồng!', 'warning');
    return;
  }

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  council.status = 'ended';
  council.auditLogs = council.auditLogs || [];
  council.auditLogs.unshift({
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    action: 'reopen_council',
    councilId,
    reason,
    adjustedById: state.user?.uid || state.user?.email,
    adjustedByName: state.user?.displayName || 'Quản trị viên',
    adjustedByRole: 'admin',
    createdAt: new Date().toISOString()
  });

  await persistActivityCouncilChanges(targetRound);
  closeReopenCouncilModal();
  renderCouncilWorkspaceFull();
  showToast(`Đã mở lại Hội đồng "${council.name}". Trạng thái: Đã kết thúc (chưa chốt).`, 'info');
};

window.renderPostCouncilSection = function() {
  const container = document.getElementById('cws-post-council-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council || !act) {
    container.classList.add('hidden');
    return;
  }

  const isAdmin = Boolean(auth?.isAdmin);
  const isChair = Boolean(auth?.isChair);

  // Unified board is visible ONLY to Admin and Council Chair
  if (!isAdmin && !isChair) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const isEndedOrFinalized = (council.status === 'ended' || council.status === 'finalized' || council.status === 'completed');
  // Admin sees raw/draft numbers at all times. Chair sees raw numbers only when session is ended/finalized.
  const canViewRawScores = isAdmin || isEndedOrFinalized;
  const mode = act.scoringConfig?.mode || 'numeric';

  const assignments = (act.councilStudentAssignments || [])
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const slots = getCouncilMemberSlots(council, act);
  const membersBySlot = council.membersBySlot || {};

  const rowsHtml = assignments.map(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const official = getOfficialDefenseScore(sid, council, act, targetRound);

    let totalCompletedVal = 0;
    let completedCount = 0;

    const cellsHtml = slots.map(s => {
      const assigned = membersBySlot[s.key];
      const scorerId = getCouncilMemberScorerId(assigned);
      const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (!assigned) {
        return '<td class="p-2 text-center text-slate-300 font-mono text-[11px]">—</td>';
      }

      if (score?.status === 'completed') {
        completedCount++;
        if (mode === 'numeric') {
          totalCompletedVal += Number(score.value || 0);
        } else {
          const numVal = resolveScoreNumericValue(score, act);
          if (typeof numVal === 'number' && !isNaN(numVal)) {
            totalCompletedVal += numVal;
          }
        }
      }

      // 1. PRIVACY PRESERVED: Chair during live active/preparing session
      if (!canViewRawScores) {
        if (score?.status === 'completed') {
          return '<td class="p-2 text-center"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ Đã chấm</span></td>';
        } else if (score?.status === 'draft') {
          return '<td class="p-2 text-center"><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">● Đang chấm</span></td>';
        }
        return '<td class="p-2 text-center text-slate-300 font-mono text-[11px]">Chưa chấm</td>';
      }

      // 2. DETAILED SCORES: Admin at all times OR Chair when ended/finalized
      if (score?.status === 'completed') {
        const isGuest = (s.type === 'guest');
        const isIncluded = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;
        const subText = (mode === 'letter') ? (() => {
          const numVal = resolveScoreNumericValue(score, act);
          return (typeof numVal === 'number' && !isNaN(numVal)) ? `<div class="text-[9px] text-slate-400 font-normal">(${numVal}đ)</div>` : '';
        })() : '';

        return `
          <td class="p-2 text-center">
            <div class="flex flex-col items-center gap-0.5">
              <span class="font-mono font-bold text-xs ${isGuest && !isIncluded ? 'line-through text-slate-400' : 'text-slate-900'}">
                ${score.value}${subText}
              </span>
              ${isEndedOrFinalized && isGuest ? `
                <button type="button" onclick="toggleGuestInclusion('${sid}', '${s.key}', ${!isIncluded})" class="px-1.5 py-0.2 rounded text-[9px] font-black border transition-colors ${isIncluded ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}">
                  ${isIncluded ? 'LẤY' : 'BỎ'}
                </button>
              ` : ''}
              ${isEndedOrFinalized ? `
                <button type="button" onclick="openScoreCalibrationModal('${sid}', '${scorerId}', '${s.key}')" class="text-[10px] text-indigo-600 hover:underline font-bold mt-0.5" title="Hiệu chỉnh điểm">
                  Hiệu chỉnh
                </button>
              ` : ''}
            </div>
          </td>
        `;
      } else if (score?.status === 'draft') {
        return `<td class="p-2 text-center font-mono text-amber-600 text-[10px]">● ${score.value || 'Draft'} <span class="text-[9px]">(nháp)</span></td>`;
      }

      return '<td class="p-2 text-center text-slate-400 font-mono text-[11px]">Chưa chấm</td>';
    }).join('');

    // Summary / Official Column
    let summaryColumnHtml = '';
    if (isEndedOrFinalized) {
      if (mode === 'letter') {
        const letterHtml = official.letterGrade
          ? `<div class="flex flex-col items-center">
               <span class="inline-flex items-center justify-center px-3 py-1 rounded-lg text-base font-black bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-xs">
                 ${official.letterGrade}
               </span>
               <span class="text-[10px] text-slate-500 font-normal mt-0.5" title="Điểm trung bình quy đổi">
                 (Tham khảo: ${official.formattedNumericScore}đ)
               </span>
             </div>`
          : `<span class="text-slate-400 font-mono text-xs">--</span>`;
        summaryColumnHtml = `
          <td class="p-2 text-center ${official.isComplete ? 'bg-indigo-50/50' : 'bg-amber-50/50'}">
            ${letterHtml}
          </td>
        `;
      } else {
        summaryColumnHtml = `
          <td class="p-2 text-center font-mono font-black text-sm ${official.isComplete ? 'text-indigo-900 bg-indigo-50/50' : 'text-amber-700 bg-amber-50/50'}">
            ${official.formattedScore}
          </td>
        `;
      }
    } else {
      if (isAdmin) {
        let liveSummary = '--';
        if (completedCount > 0) {
          const rawAvg = totalCompletedVal / completedCount;
          if (mode === 'letter') {
            const liveResolved = resolveNumericToLetter(rawAvg, act);
            const liveLetter = liveResolved?.key || '--';
            liveSummary = `
              <div class="flex flex-col items-center">
                <span class="inline-flex items-center justify-center px-2 py-0.5 rounded text-sm font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                  ${liveLetter}
                </span>
                <span class="text-[10px] text-slate-400 font-normal mt-0.5">
                  (${rawAvg.toFixed(2)}đ · ${completedCount}/${slots.length})
                </span>
              </div>
            `;
          } else {
            const avg = rawAvg.toFixed(2);
            liveSummary = `<strong class="text-slate-900">${avg}</strong> <span class="text-[10px] text-slate-400">(${completedCount}/${slots.length})</span>`;
          }
        }
        summaryColumnHtml = `<td class="p-2 text-center font-mono font-semibold">${liveSummary}</td>`;
      } else {
        // Chair during active session
        summaryColumnHtml = `
          <td class="p-2 text-center">
            <span class="font-bold text-xs ${completedCount === slots.length && slots.length > 0 ? 'text-emerald-700 font-black' : 'text-slate-700'}">
              ${completedCount}/${slots.length} hoàn thành
            </span>
          </td>
        `;
      }
    }

    return `
      <tr class="hover:bg-amber-50/30 transition-colors">
        <td class="p-2 text-center font-mono font-bold text-slate-400">#${asgn.order || '--'}</td>
        <td class="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-2 font-bold text-slate-800 whitespace-nowrap">${sName}</td>
        ${cellsHtml}
        ${summaryColumnHtml}
      </tr>
    `;
  }).join('');

  // Title & Header info based on role & session state
  let boardTitle = '⚖️ Bảng Hiệu chỉnh & Tính điểm Bảo vệ Chính thức (Chủ tịch / Quản trị viên)';
  let boardSubtitle = 'Chủ tịch có quyền hiệu chỉnh điểm và quyết định LẤY / BỎ điểm Khách mời trước khi chốt điểm.';
  let badgeText = council.status === 'finalized' ? 'Đã chốt điểm' : 'Sẵn sàng chốt';
  let badgeClass = 'bg-amber-200 text-amber-900';

  if (!isEndedOrFinalized) {
    if (isAdmin) {
      boardTitle = '🛡️ Bảng Theo dõi Điểm & Trạng thái Hội đồng (Live Monitor)';
      boardSubtitle = 'Quản trị viên theo dõi live điểm thành viên nhập (bao gồm bản nháp) theo thời gian thực.';
      badgeText = '● Real-time Live';
      badgeClass = 'bg-indigo-600 text-white animate-pulse';
    } else {
      boardTitle = '⚖️ Bảng Theo dõi Tiến độ Chấm điểm Hội đồng (Chủ tịch)';
      boardSubtitle = 'Theo dõi tiến độ chấm của thành viên. Điểm chi tiết và công cụ hiệu chỉnh sẽ hiển thị khi kết thúc buổi bảo vệ.';
      badgeText = '● Đang diễn ra';
      badgeClass = 'bg-emerald-600 text-white';
    }
  }

  const finalHeaderTitle = isEndedOrFinalized ? 'ĐIỂM CHÍNH THỨC' : (isAdmin ? 'TỔNG HỢP LIVE' : 'TIẾN ĐỘ CHẤM');

  container.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h4 class="font-black text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
          ${boardTitle}
        </h4>
        <p class="text-[11px] text-amber-800 mt-0.5">${boardSubtitle}</p>
      </div>
      <span class="badge ${badgeClass} font-bold text-[10px]">${badgeText}</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden shadow-xs border border-amber-200">
        <thead class="bg-amber-100/70 text-amber-950 border-b border-amber-200 font-bold">
          <tr>
            <th class="p-2 text-center">#</th>
            <th class="p-2">MSSV</th>
            <th class="p-2">Họ và tên</th>
            ${slots.map(s => `<th class="p-2 text-center whitespace-nowrap">${s.label || s.name} ${s.type === 'guest' ? '<span class="text-indigo-600 font-normal">(Khách)</span>' : ''}</th>`).join('')}
            <th class="p-2 text-center whitespace-nowrap bg-indigo-100/80 text-indigo-950">${finalHeaderTitle}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
};

window.openScoreCalibrationModal = function(studentId, scorerId, slotKey) {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền hiệu chỉnh điểm!', 'error');
    return;
  }

  if (council.status === 'finalized' && !auth.isAdmin) {
    showToast('Hội đồng đã chốt điểm, chỉ Quản trị viên mới có thể điều chỉnh!', 'warning');
    return;
  }

  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;
  const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
  const score = state.councilScores?.[scoreKey];
  const assigned = council.membersBySlot?.[slotKey];

  document.getElementById('calib-student-id').value = studentId;
  document.getElementById('calib-scorer-id').value = scorerId;
  document.getElementById('calib-slot-key').value = slotKey;
  document.getElementById('calib-student-meta').textContent = `Sinh viên: ${sName} (${studentId})`;
  document.getElementById('calib-scorer-info').textContent = `${assigned?.memberName || scorerId} (${assigned?.role || slotKey})`;
  document.getElementById('calib-current-val').textContent = (score?.value !== undefined && score.value !== null) ? score.value : '--';
  document.getElementById('calib-new-val').value = (score?.value !== undefined && score.value !== null) ? score.value : '';
  document.getElementById('calib-reason').value = '';

  document.getElementById('modal-score-calibration')?.classList.remove('hidden');
};

window.closeScoreCalibrationModal = function() {
  document.getElementById('modal-score-calibration')?.classList.add('hidden');
};

window.saveScoreCalibration = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền hiệu chỉnh điểm!', 'error');
    return;
  }

  if (council.status === 'finalized' && !auth.isAdmin) {
    showToast('Hội đồng đã chốt điểm, chỉ Quản trị viên mới có thể điều chỉnh!', 'warning');
    return;
  }

  const studentId = document.getElementById('calib-student-id')?.value;
  const scorerId = document.getElementById('calib-scorer-id')?.value;
  const slotKey = document.getElementById('calib-slot-key')?.value;
  const newValStr = document.getElementById('calib-new-val')?.value;
  const reason = document.getElementById('calib-reason')?.value?.trim();

  const mode = act.scoringConfig?.mode || 'numeric';
  let newVal = newValStr;
  let numericVal = null;

  if (mode === 'letter') {
    const rawOpts = (Array.isArray(act?.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0)
      ? act.scoringConfig.letterOptions
      : (typeof DEFAULT_LETTER_GRADE_SCALE !== 'undefined' ? DEFAULT_LETTER_GRADE_SCALE : (window.DEFAULT_LETTER_GRADE_SCALE || []));
    const opt = rawOpts.find(o => String(o.key).trim().toUpperCase() === String(newValStr).trim().toUpperCase() || String(o.code).trim().toUpperCase() === String(newValStr).trim().toUpperCase());
    if (opt) {
      newVal = opt.key || opt.code;
      numericVal = opt.numericValue;
    } else if (!isNaN(Number(newValStr))) {
      const resolved = resolveNumericToLetter(Number(newValStr), act);
      if (resolved) {
        newVal = resolved.key;
        numericVal = resolved.numericValue;
      } else {
        showToast('Vui lòng nhập mức điểm chữ hợp lệ (ví dụ: A, B, C...)!', 'warning');
        return;
      }
    } else {
      showToast('Mức điểm chữ không hợp lệ trong thang điểm của đợt duyệt!', 'warning');
      return;
    }
  } else {
    if (newValStr === '' || newValStr === null || isNaN(Number(newValStr))) {
      showToast('Vui lòng nhập điểm mới hợp lệ (0 – 10)!', 'warning');
      return;
    }
    newVal = Number(newValStr);
    numericVal = newVal;
    if (newVal < 0 || newVal > 10) {
      showToast('Điểm hiệu chỉnh phải từ 0 đến 10!', 'warning');
      return;
    }
  }

  if (!reason) {
    showToast('Vui lòng nhập lý do hiệu chỉnh điểm bắt buộc!', 'warning');
    return;
  }

  const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
  const existing = state.councilScores?.[scoreKey] || {};
  const oldVal = existing.value !== undefined ? existing.value : null;

  const assigned = council.membersBySlot?.[slotKey];
  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;

  // Update score record
  const updatedScore = {
    ...existing,
    activityId,
    councilId,
    studentId,
    scorerId,
    slotKey,
    value: newVal,
    ...(mode === 'letter' ? { selectedLetterCode: newVal, selectedLetterNumericValue: numericVal, numericValue: numericVal } : { numericValue: numericVal }),
    status: 'completed',
    adjusted: true,
    adjustments: [
      ...(existing.adjustments || []),
      {
        originalValue: oldVal,
        newValue: newVal,
        adjustedById: getEffectiveActor().uid || getEffectiveActor().email,
        adjustedByName: getEffectiveActor().displayName || (auth.isAdmin ? 'Quản trị viên' : 'Chủ tịch HĐ'),
        reason,
        timestamp: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  };

  state.councilScores[scoreKey] = updatedScore;

  // Append to council audit logs
  council.auditLogs = council.auditLogs || [];
  council.auditLogs.unshift({
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    roundId,
    activityId,
    councilId,
    studentId,
    studentName: sName,
    scorerId,
    scorerName: assigned?.memberName || scorerId,
    slotKey,
    field: 'defense_score',
    originalValue: oldVal,
    newValue: newVal,
    reason,
    adjustedById: state.user?.uid || state.user?.email,
    adjustedByName: state.user?.displayName || (auth.isAdmin ? 'Quản trị viên' : 'Chủ tịch HĐ'),
    adjustedByRole: auth.isAdmin ? 'admin' : 'chair',
    createdAt: new Date().toISOString()
  });

  // Persist to Firestore
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    if (state.isAdmin) {
      await updateDoc(roundRef, {
        [`councilScores.${scoreKey}`]: updatedScore,
        activities: targetRound.activities,
        updatedAt: serverTimestamp()
      });
    } else {
      await persistActivityCouncilChanges(targetRound);
    }
  } catch (err) {
    console.warn('Persist score calibration notice:', err);
  }

  closeScoreCalibrationModal();
  renderCouncilWorkspaceFull();
  showToast(`✓ Đã hiệu chỉnh điểm cho ${sName} thành công và ghi nhận vào Audit Log!`, 'success');
};

window.toggleGuestInclusion = async function(studentId, slotKey, isIncluded) {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền chọn tính điểm Khách mời!', 'error');
    return;
  }

  if (council.status === 'finalized' && !auth.isAdmin) {
    showToast('Hội đồng đã chốt điểm, không thể thay đổi khách mời!', 'warning');
    return;
  }

  council.guestInclusion = council.guestInclusion || {};
  council.guestInclusion[studentId] = council.guestInclusion[studentId] || {};
  council.guestInclusion[studentId][slotKey] = Boolean(isIncluded);

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`Đã cập nhật tính điểm khách mời: ${isIncluded ? 'LẤY ĐIỂM' : 'KHÔNG LẤY'}.`, 'info');
};

window.renderAuditLogsSection = function() {
  const container = document.getElementById('cws-audit-logs-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council || (!auth.isAdmin && !auth.isChair)) {
    container.classList.add('hidden');
    return;
  }

  const logs = council.auditLogs || [];
  if (logs.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
        <span>📋</span> Nhật ký Kiểm toán (Audit Log) của Hội đồng
      </h4>
      <span class="text-[10px] text-slate-500 font-mono font-bold">${logs.length} bản ghi</span>
    </div>
    <div class="space-y-1.5 max-h-48 overflow-y-auto mt-2">
      ${logs.map(log => `
        <div class="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-start justify-between gap-2">
          <div>
            <div class="font-bold text-slate-900">
              ${log.action === 'reopen_council' ? '🔓 Mở lại Hội đồng' : `Hiệu chỉnh điểm: ${log.studentName || log.studentId} (${log.originalValue} ➔ ${log.newValue})`}
            </div>
            <p class="text-[11px] text-slate-600 mt-0.5">Lý do: <span class="italic font-semibold text-slate-800">"${escapeHtml(log.reason || '')}"</span></p>
            <span class="text-[10px] text-slate-400">Bởi: ${log.adjustedByName || log.adjustedById} (${log.adjustedByRole})</span>
          </div>
          <span class="text-[10px] text-slate-400 font-mono whitespace-nowrap">${fmt24h(log.createdAt)}</span>
        </div>
      `).join('')}
    </div>
  `;
};

// Section 37: Guest Passcode Blocker Notice & Placeholders
window.openGuestPasscodeModal = function() {
  console.warn('BLOCKER: Secure Guest Passcode requires trusted backend');
  document.getElementById('modal-guest-passcode-entry')?.classList.remove('hidden');
};

window.closeGuestPasscodeModal = function() {
  document.getElementById('modal-guest-passcode-entry')?.classList.add('hidden');
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof resolveScoreNumericValue !== 'undefined') window.resolveScoreNumericValue = resolveScoreNumericValue;
  if (typeof resolveNumericToLetter !== 'undefined') window.resolveNumericToLetter = resolveNumericToLetter;
  if (typeof getOfficialDefenseScore !== 'undefined') window.getOfficialDefenseScore = getOfficialDefenseScore;
}
