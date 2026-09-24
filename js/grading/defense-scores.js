// ============================================================================
// v2.0.0-beta.1: RUBRIC EVENT HANDLERS & OFFICIAL DEFENSE SCORE & CALIBRATION
// ============================================================================

window.onRubricComponentChange = function(critKey, val) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].components = state.councilLocalDrafts[sid].components || {};
  
  if (val === '' || val === null || val === undefined) {
    delete state.councilLocalDrafts[sid].components[critKey];
  } else {
    state.councilLocalDrafts[sid].components[critKey] = Number(val);
  }

  // Update live component sum display
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
  if (totalInput) {
    const curTot = parseFloat(totalInput.value);
    if (!isNaN(curTot)) {
      const mismatch = Math.abs(sum - curTot) >= 0.000001;
      if (warnEl) warnEl.classList.toggle('hidden', !mismatch);
    }
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
  if (typeof score.value === 'string' && act?.scoringConfig?.letterOptions) {
    const opt = act.scoringConfig.letterOptions.find(o => String(o.key) === score.value || String(o.code) === score.value);
    if (opt && typeof opt.numericValue === 'number' && !isNaN(opt.numericValue)) return opt.numericValue;
  }
  return null;
}

export function getOfficialDefenseScore(studentId, council, act, round) {
  if (!council || !act) return { score: null, isComplete: false, count: 0, mandatoryComplete: false };
  const slots = act.councilStructure?.slots || [];
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
    const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
    if (!scorerId) continue;
    const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
    const score = state.councilScores?.[scoreKey];
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

  return {
    studentId,
    isComplete: mandatoryComplete,
    mandatoryTotal,
    mandatoryCompleted,
    mandatoryComplete,
    score: rawAverage,
    formattedScore: rawAverage !== null ? rawAverage.toFixed(2) : '--',
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
      const scorerId = assignedMem?.memberId || assignedMem?.memberEmail;
      if (scorerId) {
        const k = `${activityId}_${councilId}_${sId}_${scorerId}`;
        const sc = state.councilScores?.[k];
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
    showToast(`Không thể chốt điểm: Còn ${missingStudents.length} sinh viên chưa hoàn tất đủ các phiếu chấm bắt buộc!`, 'error');
    return;
  }

  const confirmed = await showConfirm(
    'Chốt điểm Hội đồng',
    `Xác nhận khóa và chốt điểm chính thức cho toàn bộ ${assignments.length} sinh viên của Hội đồng "${council.name}"?`,
    { confirmText: 'Khóa & Chốt điểm', danger: false }
  );
  if (!confirmed) return;

  council.finalDefenseScores = council.finalDefenseScores || {};
  for (const asgn of assignments) {
    const sId = asgn.studentId;
    const official = getOfficialDefenseScore(sId, council, act, targetRound);
    council.finalDefenseScores[sId] = {
      score: official.score,
      completedScoresCount: official.allScoresCount,
      finalizedAt: new Date().toISOString()
    };
  }

  council.status = 'finalized';
  council.finalizedAt = new Date().toISOString();
  council.finalizedBy = getEffectiveActor().email || 'admin';

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`✓ Đã chốt điểm Hội đồng "${council.name}" thành công! Điểm bảo vệ chính thức đã được ghi nhận.`, 'success');
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

  const isEndedOrFinalized = (council.status === 'ended' || council.status === 'finalized' || council.status === 'completed');
  if (!isEndedOrFinalized || (!auth.isAdmin && !auth.isChair)) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const assignments = (act.councilStudentAssignments || [])
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const slots = act.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};

  const rowsHtml = assignments.map(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const official = getOfficialDefenseScore(sid, council, act, targetRound);

    const cellsHtml = slots.map(s => {
      const assigned = membersBySlot[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (!assigned) {
        return '<td class="p-2 text-center text-slate-300 font-mono text-[11px]">—</td>';
      }

      if (!score || score.status !== 'completed') {
        return '<td class="p-2 text-center text-amber-600 font-mono text-[11px]">Chưa xong</td>';
      }

      const isGuest = (s.type === 'guest');
      const isIncluded = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;

      return `
        <td class="p-2 text-center">
          <div class="flex flex-col items-center gap-0.5">
            <span class="font-mono font-bold text-xs ${isGuest && !isIncluded ? 'line-through text-slate-400' : 'text-slate-900'}">${score.value}</span>
            ${isGuest ? `
              <button type="button" onclick="toggleGuestInclusion('${sid}', '${s.key}', ${!isIncluded})" class="px-1.5 py-0.2 rounded text-[9px] font-black border transition-colors ${isIncluded ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}">
                ${isIncluded ? 'LẤY' : 'BỎ'}
              </button>
            ` : ''}
            <button type="button" onclick="openScoreCalibrationModal('${sid}', '${scorerId}', '${s.key}')" class="text-[10px] text-indigo-600 hover:underline font-bold mt-0.5" title="Hiệu chỉnh điểm">
              Hiệu chỉnh
            </button>
          </div>
        </td>
      `;
    }).join('');

    return `
      <tr class="hover:bg-amber-50/40 transition-colors">
        <td class="p-2 text-center font-mono font-bold text-slate-400">#${asgn.order || '--'}</td>
        <td class="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-2 font-bold text-slate-800 whitespace-nowrap">${sName}</td>
        ${cellsHtml}
        <td class="p-2 text-center font-mono font-black text-sm ${official.isComplete ? 'text-indigo-900 bg-indigo-50/50' : 'text-amber-700 bg-amber-50/50'}">
          ${official.formattedScore}
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h4 class="font-black text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
          <span>⚖️</span> Bảng Hiệu chỉnh & Tính điểm Bảo vệ Chính thức (Chủ tịch / Quản trị viên)
        </h4>
        <p class="text-[11px] text-amber-800 mt-0.5">Chủ tịch có quyền hiệu chỉnh điểm và quyết định LẤY / BỎ điểm Khách mời trước khi chốt điểm.</p>
      </div>
      <span class="badge bg-amber-200 text-amber-900 font-bold text-[10px]">${council.status === 'finalized' ? 'Đã chốt điểm' : 'Sẵn sàng chốt'}</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden shadow-xs border border-amber-200">
        <thead class="bg-amber-100/70 text-amber-950 border-b border-amber-200 font-bold">
          <tr>
            <th class="p-2 text-center">#</th>
            <th class="p-2">MSSV</th>
            <th class="p-2">Họ và tên</th>
            ${slots.map(s => `<th class="p-2 text-center whitespace-nowrap">${s.label || s.name} ${s.type === 'guest' ? '<span class="text-indigo-600 font-normal">(Khách)</span>' : ''}</th>`).join('')}
            <th class="p-2 text-center whitespace-nowrap bg-indigo-100/80 text-indigo-950">ĐIỂM CHÍNH THỨC</th>
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

  if (newValStr === '' || newValStr === null || isNaN(Number(newValStr))) {
    showToast('Vui lòng nhập điểm mới hợp lệ (0 – 10)!', 'warning');
    return;
  }
  const newVal = Number(newValStr);
  if (newVal < 0 || newVal > 10) {
    showToast('Điểm hiệu chỉnh phải từ 0 đến 10!', 'warning');
    return;
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
  if (typeof getOfficialDefenseScore !== 'undefined') window.getOfficialDefenseScore = getOfficialDefenseScore;
}
