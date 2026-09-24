// ============================================================================
// IFA+ GRADUATION BETA v1.9.0-beta.1: SCORING CONFIG & COUNCIL OPERATION MODULE
// ============================================================================

// 1. SCORING CONFIG HELPERS
window.toggleActivityScoringConfig = function(enabled) {
  const panel = document.getElementById('activity-scoring-config-panel');
  if (panel) {
    if (enabled) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }
};

window.switchActivityScoringMode = function(mode) {
  const numWrap = document.getElementById('activity-scoring-numeric-wrap');
  const letterWrap = document.getElementById('activity-scoring-letter-wrap');
  const rubricWrap = document.getElementById('activity-scoring-rubric-wrap');
  const rNum = document.querySelector('input[name="activity_scoring_mode"][value="numeric"]');
  const rLet = document.querySelector('input[name="activity_scoring_mode"][value="letter"]');
  const rRub = document.querySelector('input[name="activity_scoring_mode"][value="defense_rubric"]');

  if (mode === 'letter') {
    if (rLet) rLet.checked = true;
    if (numWrap) numWrap.classList.add('hidden');
    if (letterWrap) letterWrap.classList.remove('hidden');
    if (rubricWrap) rubricWrap.classList.add('hidden');
  } else if (mode === 'defense_rubric') {
    if (rRub) rRub.checked = true;
    if (numWrap) numWrap.classList.add('hidden');
    if (letterWrap) letterWrap.classList.add('hidden');
    if (rubricWrap) rubricWrap.classList.remove('hidden');
    renderActivityRubricList();
  } else {
    if (rNum) rNum.checked = true;
    if (numWrap) numWrap.classList.remove('hidden');
    if (letterWrap) letterWrap.classList.add('hidden');
    if (rubricWrap) rubricWrap.classList.add('hidden');
  }
};

window.renderActivityRubricList = function() {
  const container = document.getElementById('activity-scoring-rubric-list');
  const totalMaxEl = document.getElementById('activity-scoring-rubric-total-max');
  if (!container) return;

  const list = state._currentActivityRubric || [];
  if (list.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-slate-400">Chưa có tiêu chí nào. Bấm "+ Thêm tiêu chí".</div>';
    if (totalMaxEl) totalMaxEl.textContent = '0.0';
    return;
  }

  let totalMax = 0;
  container.innerHTML = list.map((crit, idx) => {
    totalMax += Number(crit.maxScore || 0);
    return `
      <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold text-slate-400">#${idx + 1}</span>
          <span class="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">${crit.key}</span>
          <span class="font-bold text-slate-900">${crit.label}</span>
          <span class="text-emerald-700 font-bold font-mono">(${crit.maxScore}đ)</span>
          ${crit.description ? `<span class="text-[10px] text-slate-400 truncate max-w-xs">(${crit.description})</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 text-[11px]">
          <button type="button" onclick="editRubricCriterion('${crit.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
          <button type="button" onclick="deleteRubricCriterion('${crit.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
        </div>
      </div>
    `;
  }).join('');

  if (totalMaxEl) totalMaxEl.textContent = totalMax.toFixed(1);
};

window.openAddRubricCriterionModal = function() {
  document.getElementById('rubric-criterion-id').value = '';
  document.getElementById('rubric-criterion-key').value = '';
  document.getElementById('rubric-criterion-label').value = '';
  document.getElementById('rubric-criterion-max').value = '2.5';
  document.getElementById('rubric-criterion-desc').value = '';
  document.getElementById('modal-rubric-criterion-title').textContent = 'Thêm tiêu chí Rubric mới';
  document.getElementById('modal-rubric-criterion')?.classList.remove('hidden');
};

window.closeRubricCriterionModal = function() {
  document.getElementById('modal-rubric-criterion')?.classList.add('hidden');
};

window.editRubricCriterion = function(id) {
  const crit = (state._currentActivityRubric || []).find(c => c.id === id);
  if (!crit) return;
  document.getElementById('rubric-criterion-id').value = crit.id;
  document.getElementById('rubric-criterion-key').value = crit.key;
  document.getElementById('rubric-criterion-label').value = crit.label;
  document.getElementById('rubric-criterion-max').value = crit.maxScore;
  document.getElementById('rubric-criterion-desc').value = crit.description || '';
  document.getElementById('modal-rubric-criterion-title').textContent = 'Chỉnh sửa tiêu chí Rubric';
  document.getElementById('modal-rubric-criterion')?.classList.remove('hidden');
};

window.deleteRubricCriterion = function(id) {
  state._currentActivityRubric = (state._currentActivityRubric || []).filter(c => c.id !== id);
  renderActivityRubricList();
};

window.saveRubricCriterion = function() {
  const id = document.getElementById('rubric-criterion-id')?.value?.trim();
  const key = document.getElementById('rubric-criterion-key')?.value?.trim().toLowerCase();
  const label = document.getElementById('rubric-criterion-label')?.value?.trim();
  const maxScore = parseFloat(document.getElementById('rubric-criterion-max')?.value);
  const desc = document.getElementById('rubric-criterion-desc')?.value?.trim() || '';

  if (!key || !label) {
    showToast('Vui lòng nhập đầy đủ Mã tiêu chí và Tên tiêu chí!', 'warning');
    return;
  }
  if (isNaN(maxScore) || maxScore <= 0) {
    showToast('Điểm tối đa của tiêu chí phải là số dương (> 0)!', 'warning');
    return;
  }

  state._currentActivityRubric = state._currentActivityRubric || [];
  
  // Check duplicate key
  const duplicate = state._currentActivityRubric.find(c => c.key === key && c.id !== id);
  if (duplicate) {
    showToast(`Mã tiêu chí "${key}" đã tồn tại! Vui lòng chọn mã khác.`, 'warning');
    return;
  }

  if (id) {
    const idx = state._currentActivityRubric.findIndex(c => c.id === id);
    if (idx >= 0) {
      state._currentActivityRubric[idx] = {
        ...state._currentActivityRubric[idx],
        key,
        label,
        maxScore,
        description: desc
      };
    }
  } else {
    const newId = 'crit_' + Date.now().toString(36);
    state._currentActivityRubric.push({
      id: newId,
      key,
      label,
      maxScore,
      description: desc,
      order: state._currentActivityRubric.length + 1
    });
  }

  closeRubricCriterionModal();
  renderActivityRubricList();
};

window.renderActivityLetterOptions = function() {
  const container = document.getElementById('activity-scoring-letter-list');
  if (!container) return;
  const list = state._currentActivityLetterOptions || [];
  if (list.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-slate-400">Chưa có mức điểm chữ nào. Bấm "+ Thêm mức điểm" hoặc "↺ Khôi phục mặc định".</div>';
    return;
  }
  container.innerHTML = list.map((opt, idx) => {
    const numDisplay = (typeof opt.numericValue === 'number' && !isNaN(opt.numericValue))
      ? `<span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono text-xs font-bold" title="Điểm quy đổi nội bộ của Admin">Quy đổi: ${opt.numericValue} điểm</span>`
      : `<span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono text-[10px]" title="Chưa cấu hình điểm quy đổi">Chưa có điểm quy đổi</span>`;

    return `
    <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono text-xs">${escapeHtml(opt.key || opt.code || '')}</span>
        <span class="font-bold text-slate-800 text-xs">${escapeHtml(opt.label || '')}</span>
        ${numDisplay}
        ${opt.description ? `<span class="text-[10px] text-slate-400">(${escapeHtml(opt.description)})</span>` : ''}
      </div>
      <div class="flex items-center gap-1.5 text-[11px] shrink-0">
        <button type="button" onclick="editLetterOption('${opt.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
        <button type="button" onclick="deleteLetterOption('${opt.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
      </div>
    </div>
  `;
  }).join('');
};

window.resetDefaultLetterOptions = async function() {
  if (!await showConfirm('Khôi phục thang điểm chữ', 'Thao tác sẽ thay thế danh sách mức điểm chữ hiện tại bằng bộ mặc định đầy đủ 13 mức (A++ → D-). Bạn có muốn tiếp tục?', { confirmText: 'Khôi phục' })) {
    return;
  }
  state._currentActivityLetterOptions = JSON.parse(JSON.stringify(DEFAULT_LETTER_GRADE_SCALE));
  renderActivityLetterOptions();
  showToast('Đã khôi phục bộ 13 mức điểm chữ mặc định (A++ → D-)!', 'success');
};

window.openAddLetterOptionModal = function() {
  document.getElementById('letter-option-id').value = '';
  document.getElementById('letter-option-key').value = '';
  document.getElementById('letter-option-label').value = '';
  document.getElementById('letter-option-numeric').value = '';
  document.getElementById('letter-option-desc').value = '';
  document.getElementById('modal-letter-option-title').textContent = 'Thêm mức điểm chữ mới';
  document.getElementById('modal-add-letter-option')?.classList.remove('hidden');
};

window.closeLetterOptionModal = function() {
  document.getElementById('modal-add-letter-option')?.classList.add('hidden');
};

window.editLetterOption = function(id) {
  const opt = (state._currentActivityLetterOptions || []).find(o => o.id === id);
  if (!opt) return;
  document.getElementById('letter-option-id').value = opt.id;
  document.getElementById('letter-option-key').value = opt.key || opt.code || '';
  document.getElementById('letter-option-label').value = opt.label || '';
  document.getElementById('letter-option-numeric').value = (typeof opt.numericValue === 'number' && !isNaN(opt.numericValue)) ? opt.numericValue : '';
  document.getElementById('letter-option-desc').value = opt.description || '';
  document.getElementById('modal-letter-option-title').textContent = 'Chỉnh sửa mức điểm chữ';
  document.getElementById('modal-add-letter-option')?.classList.remove('hidden');
};

window.deleteLetterOption = function(id) {
  state._currentActivityLetterOptions = (state._currentActivityLetterOptions || []).filter(o => o.id !== id);
  renderActivityLetterOptions();
};

window.saveLetterOption = function() {
  const id = document.getElementById('letter-option-id')?.value?.trim();
  const key = document.getElementById('letter-option-key')?.value?.trim().toUpperCase();
  const label = document.getElementById('letter-option-label')?.value?.trim();
  const numRaw = document.getElementById('letter-option-numeric')?.value?.trim();
  const desc = document.getElementById('letter-option-desc')?.value?.trim() || '';

  if (!key || !label) {
    showToast('Vui lòng nhập đầy đủ Mã mức điểm và Nhãn hiển thị', 'warning');
    return;
  }

  const numericValue = parseFloat(numRaw);
  if (isNaN(numericValue) || numericValue < 0 || numericValue > 10) {
    showToast('Vui lòng nhập Điểm quy đổi hợp lệ từ 0 đến 10 (ví dụ: 10, 9.5, 8.0...)', 'warning');
    document.getElementById('letter-option-numeric')?.focus();
    return;
  }

  state._currentActivityLetterOptions = state._currentActivityLetterOptions || [];
  if (id) {
    const idx = state._currentActivityLetterOptions.findIndex(o => o.id === id);
    if (idx >= 0) {
      state._currentActivityLetterOptions[idx] = {
        id,
        key,
        code: key,
        label,
        numericValue: Number(numericValue.toFixed(2)),
        description: desc
      };
    }
  } else {
    const newId = 'opt_' + Date.now().toString(36);
    state._currentActivityLetterOptions.push({
      id: newId,
      key,
      code: key,
      label,
      numericValue: Number(numericValue.toFixed(2)),
      description: desc
    });
  }

  closeLetterOptionModal();
  renderActivityLetterOptions();
};

// 2. AUTHORIZATION & REQUIRED SCORERS HELPERS
export function checkCouncilAuthorization(round, act, council, user) {
  if (!round || !act || !council) return { authorized: false, reason: 'Không tìm thấy dữ liệu Hội đồng' };
  
  const actor = user || getEffectiveActor();

  // Admin always has full access
  if (actor.isAdmin) {
    return {
      authorized: true,
      role: 'admin',
      roleName: 'Quản trị viên',
      slotKey: null,
      canScore: true,
      isSecretary: true,
      isChair: true,
      isAdmin: true,
      canCalibrate: true,
      canFinalize: true
    };
  }

  if (!actor || !actor.email) {
    return { authorized: false, reason: 'Vui lòng đăng nhập để truy cập Hội đồng.' };
  }

  const userEmail = actor.email.toLowerCase().trim();
  const membersBySlot = council.membersBySlot || {};
  const slots = act.councilStructure?.slots || [];

  for (const s of slots) {
    const assigned = membersBySlot[s.key];
    if (assigned && assigned.memberEmail && assigned.memberEmail.toLowerCase().trim() === userEmail) {
      const isSec = (s.key === 'secretary' || s.label === 'Thư ký');
      const isChair = (s.key === 'chair' || s.label === 'Chủ tịch' || s.name === 'Chủ tịch Hội đồng');
      return {
        authorized: true,
        role: s.key,
        roleName: s.name || s.label || 'Thành viên Hội đồng',
        slotKey: s.key,
        canScore: true,
        isSecretary: isSec,
        isChair: isChair,
        isAdmin: false,
        canCalibrate: isChair,
        canFinalize: isChair
      };
    }
  }

  // Student is strictly denied
  return {
    authorized: false,
    reason: 'Bạn không phải thành viên của Hội đồng này.'
  };
}

export function getRequiredScorers(council, act) {
  const slots = act?.councilStructure?.slots || [];
  return slots.filter(s => s.type === 'mandatory');
}

export function getGuestScorers(council, act) {
  const slots = act?.councilStructure?.slots || [];
  return slots.filter(s => s.type === 'guest');
}

// 3. COUNCIL WORKSPACE OPEN & REAL-TIME LISTENER
window.openCouncilWorkspace = async function(roundId, activityId, councilId, autoSelectedStudentId = null) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!targetRound || !act || !council) {
    showToast('Không tìm thấy thông tin Hội đồng được yêu cầu.', 'error');
    return;
  }

  // AUTHORIZATION CHECK
  const authCheck = checkCouncilAuthorization(targetRound, act, council, getEffectiveActor());
  if (!authCheck.authorized) {
    showToast(authCheck.reason || 'Bạn không có quyền truy cập Hội đồng này.', 'error');
    return;
  }

  state.activeCouncilWorkspace = {
    roundId,
    activityId,
    councilId,
    auth: authCheck
  };

  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilScores = state.councilScores || {};

  // Load existing scores from round doc & subcollection
  await loadCouncilScores(roundId, activityId, councilId);

  // Setup initial selected student
  const assignments = act.councilStudentAssignments || [];
  const councilStudents = assignments
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const presentingStudent = councilStudents.find(a => a.presentationStatus === 'presenting');

  if (autoSelectedStudentId) {
    state.activeCouncilSelectedStudentId = autoSelectedStudentId;
  } else if (presentingStudent) {
    state.activeCouncilSelectedStudentId = presentingStudent.studentId;
  } else if (councilStudents.length > 0) {
    state.activeCouncilSelectedStudentId = councilStudents[0].studentId;
  } else {
    state.activeCouncilSelectedStudentId = null;
  }

  // Render UI
  renderCouncilWorkspaceFull();

  // Show modal
  document.getElementById('modal-council-workspace')?.classList.remove('hidden');

  // Real-time Firestore Listener
  setupCouncilRealtimeSync(roundId, activityId, councilId);
};

window.closeCouncilWorkspace = function() {
  if (state.activeCouncilUnsubscribe) {
    try { state.activeCouncilUnsubscribe(); } catch (e) {}
    state.activeCouncilUnsubscribe = null;
  }
  document.getElementById('modal-council-workspace')?.classList.add('hidden');
};

function setupCouncilRealtimeSync(roundId, activityId, councilId) {
  if (state.activeCouncilUnsubscribe) {
    state.activeCouncilUnsubscribe();
    state.activeCouncilUnsubscribe = null;
  }

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    state.activeCouncilUnsubscribe = onSnapshot(roundRef, (snap) => {
      if (!snap.exists()) return;
      const updatedData = { id: snap.id, ...snap.data() };
      
      // Update in state.rounds
      const rIdx = (state.rounds || []).findIndex(r => r.id === roundId);
      if (rIdx >= 0) state.rounds[rIdx] = updatedData;

      // Update nested scores if present
      if (updatedData.councilScores) {
        state.councilScores = { ...(state.councilScores || {}), ...updatedData.councilScores };
      }

      // Re-render Council Workspace WITHOUT changing selected student!
      renderCouncilWorkspacePartialSync();
    }, (err) => {
      console.warn('Realtime council listener notice:', err);
    });
  } catch (err) {
    console.warn('Firestore onSnapshot setup notice:', err);
  }
}

async function loadCouncilScores(roundId, activityId, councilId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (targetRound?.councilScores) {
    state.councilScores = { ...(state.councilScores || {}), ...targetRound.councilScores };
  }

  // Best effort query subcollection reviewDecisions
  try {
    const q = query(
      collection(db, 'graduationRounds', roundId, 'reviewDecisions'),
      where('councilId', '==', councilId)
    );
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      snap.docs.forEach(d => {
        const data = d.data();
        const k = `${data.activityId}_${data.councilId}_${data.studentId}_${data.scorerId}`;
        state.councilScores[k] = data;
      });
    }
  } catch (e) {
    // Graceful fallback to nested or memory
  }
}

// 4. WORKSPACE RENDERING METHODS
function renderCouncilWorkspaceFull() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!targetRound || !act || !council) return;

  // Header Elements
  document.getElementById('cws-council-name').textContent = council.name;
  document.getElementById('cws-council-meta').textContent = `📍 Phòng: ${council.room || 'Đang cập nhật'} • 📅 ${council.date || '--'} (${council.startTime || '--'} – ${council.endTime || '--'})`;

  // Status Badge (v2.0.0-beta.1: preparing -> active -> ended -> finalized)
  const statusBadge = document.getElementById('cws-council-status-badge');
  if (statusBadge) {
    const cStat = council.status || 'preparing';
    if (cStat === 'active' || cStat === 'ongoing') {
      statusBadge.className = 'badge bg-emerald-500 text-white font-black animate-pulse text-[10px]';
      statusBadge.textContent = '● Đang diễn ra';
    } else if (cStat === 'ended') {
      statusBadge.className = 'badge bg-amber-500 text-white font-bold text-[10px]';
      statusBadge.textContent = '⏸ Đã kết thúc (Chờ chốt)';
    } else if (cStat === 'finalized' || cStat === 'completed') {
      statusBadge.className = 'badge bg-slate-800 text-white font-bold text-[10px]';
      statusBadge.textContent = '🔒 Đã chốt điểm';
    } else {
      statusBadge.className = 'badge bg-amber-100 text-amber-800 font-bold text-[10px]';
      statusBadge.textContent = 'Chuẩn bị';
    }
  }

  // Role Badge
  const roleBadge = document.getElementById('cws-my-role-badge');
  if (roleBadge) {
    roleBadge.textContent = auth.roleName || 'Thành viên';
  }

  // Session Controls (Secretary / Chair / Admin)
  const sessionControls = document.getElementById('cws-session-controls');
  if (sessionControls) {
    if (auth.isAdmin || auth.isSecretary || auth.isChair) {
      sessionControls.classList.remove('hidden');
      sessionControls.classList.add('flex');
      const startBtn = document.getElementById('btn-start-council-session');
      const endBtn = document.getElementById('btn-end-council-session');
      const finBtn = document.getElementById('btn-finalize-council-session');
      const reopenBtn = document.getElementById('btn-reopen-council-session');
      const cStat = council.status || 'preparing';

      if (startBtn) startBtn.classList.toggle('hidden', cStat !== 'preparing');
      if (endBtn) endBtn.classList.toggle('hidden', cStat !== 'active' && cStat !== 'ongoing');
      if (finBtn) finBtn.classList.toggle('hidden', cStat !== 'ended' || (!auth.isAdmin && !auth.isChair));
      if (reopenBtn) reopenBtn.classList.toggle('hidden', cStat !== 'finalized' || !auth.isAdmin);
    } else {
      sessionControls.classList.add('hidden');
    }
  }

  renderCouncilStudentList();
  renderCouncilSelectedStudentDetails();
  renderPostCouncilSection();
  renderAuditLogsSection();
}

function renderCouncilWorkspacePartialSync() {
  // Update student list badges & counts
  renderCouncilStudentList();

  // Update presenting banner
  renderPresentingBanner();

  // Update secretary controls for current student
  renderSecretaryControls();

  // Update scorers completion progress & admin monitor
  renderScorersProgress();
  renderAdminMonitor();

  // Update post-council calibration and audit logs
  renderPostCouncilSection();
  renderAuditLogsSection();
}

function renderCouncilStudentList() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!targetRound || !act) return;

  const assignments = act.councilStudentAssignments || [];
  const councilStudents = assignments
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const countBadge = document.getElementById('cws-student-count-badge');
  if (countBadge) countBadge.textContent = councilStudents.length;

  const presentingAsgn = councilStudents.find(a => a.presentationStatus === 'presenting');
  const presentingInd = document.getElementById('cws-presenting-indicator');
  if (presentingInd) {
    if (presentingAsgn) {
      presentingInd.classList.remove('hidden');
      presentingInd.textContent = `● #${presentingAsgn.order} đang trình bày`;
    } else {
      presentingInd.classList.add('hidden');
    }
  }

  const container = document.getElementById('cws-students-list');
  if (!container) return;

  if (councilStudents.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-slate-400">Hội đồng này chưa có sinh viên nào.</div>';
    return;
  }

  const myScorerId = getEffectiveActor().uid || getEffectiveActor().email;
  const scoringEnabled = Boolean(act.scoringConfig?.enabled);

  container.innerHTML = councilStudents.map((asgn) => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const isSelected = (sid === state.activeCouncilSelectedStudentId);
    const isPresenting = (asgn.presentationStatus === 'presenting');
    const isPresented = (asgn.presentationStatus === 'presented');

    // Presentation badge
    let presBadge = '<span class="text-[10px] text-slate-400">Chờ</span>';
    if (isPresenting) {
      presBadge = '<span class="badge bg-emerald-500 text-white font-black text-[9px] animate-pulse">🔴 Đang trình bày</span>';
    } else if (isPresented) {
      presBadge = '<span class="badge bg-indigo-100 text-indigo-800 font-bold text-[9px]">✓ Đã xong</span>';
    }

    // Scoring status badge for this member
    let scoreBadge = '';
    if (scoringEnabled) {
      const scoreKey = `${activityId}_${councilId}_${sid}_${myScorerId}`;
      const myScore = state.councilScores?.[scoreKey];
      const hasDraft = Boolean(state.councilLocalDrafts?.[sid]);

      if (myScore?.status === 'completed') {
        scoreBadge = '<span class="text-[10px] text-emerald-700 font-bold">✓ Bạn đã chấm</span>';
      } else if (myScore?.status === 'draft' || hasDraft) {
        scoreBadge = '<span class="text-[10px] text-amber-600 font-bold">● Đã lưu tạm</span>';
      } else {
        scoreBadge = '<span class="text-[10px] text-slate-400">Chưa chấm</span>';
      }
    }

    return `
      <div onclick="selectCouncilStudent('${sid}')" class="p-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}">
        <div class="flex items-center justify-between gap-1">
          <span class="font-mono font-bold text-xs ${isSelected ? 'text-indigo-900' : 'text-slate-600'}">#${asgn.order || '--'}</span>
          ${presBadge}
        </div>
        <div class="font-bold text-slate-900 text-xs truncate mt-0.5">${sName}</div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-0.5">
          <span>${sid}</span>
          ${scoreBadge}
        </div>
      </div>
    `;
  }).join('');
}

window.filterCouncilWorkspaceStudents = function(q) {
  const query = String(q || '').toLowerCase().trim();
  const cards = document.querySelectorAll('#cws-students-list > div');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.classList.toggle('hidden', query.length > 0 && !text.includes(query));
  });
};

// 5. SELECT STUDENT & FLEXIBLE NAVIGATION (CRITICAL BUSINESS RULE)
window.selectCouncilStudent = function(studentId) {
  // PRESERVE UNSAVED INPUTS from current student (including rubric components)
  const oldSid = state.activeCouncilSelectedStudentId;
  if (oldSid && oldSid !== studentId) {
    const valInput = document.getElementById('cws-score-input-numeric');
    const letInput = document.getElementById('cws-score-input-letter');
    const commentInput = document.getElementById('cws-score-comment');
    const rubricInputs = document.querySelectorAll('input[data-crit-key]');

    let components = null;
    if (rubricInputs.length > 0) {
      components = {};
      rubricInputs.forEach(inp => {
        const k = inp.dataset.critKey;
        const v = inp.value;
        if (v !== '' && !isNaN(Number(v))) {
          components[k] = Number(v);
        }
      });
    }

    const currentVal = valInput ? valInput.value : (letInput ? letInput.value : state.councilLocalDrafts?.[oldSid]?.value);
    const currentComm = commentInput ? commentInput.value : (state.councilLocalDrafts?.[oldSid]?.comment || '');

    if (currentVal !== undefined && currentVal !== '' || currentComm || (components && Object.keys(components).length > 0)) {
      state.councilLocalDrafts = state.councilLocalDrafts || {};
      state.councilLocalDrafts[oldSid] = {
        value: currentVal,
        comment: currentComm,
        components: components || state.councilLocalDrafts?.[oldSid]?.components
      };
    }
  }

  // SET NEW SELECTED STUDENT (NEVER changes current presenting student)
  state.activeCouncilSelectedStudentId = studentId;

  renderCouncilStudentList();
  renderCouncilSelectedStudentDetails();
};

window.goToCurrentPresentingStudent = function() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = act?.councilStudentAssignments || [];
  const pres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');
  if (pres) {
    selectCouncilStudent(pres.studentId);
  } else {
    showToast('Hội đồng hiện chưa có sinh viên nào đang trình bày.', 'info');
  }
};

// 6. RENDER SELECTED STUDENT DETAILS & SCORING
function renderCouncilSelectedStudentDetails() {
  const sid = state.activeCouncilSelectedStudentId;
  const card = document.getElementById('cws-selected-student-card');
  if (!card) return;

  if (!sid) {
    card.innerHTML = '<div class="p-8 text-center text-slate-400">Vui lòng chọn một sinh viên trong danh sách để xem thông tin và chấm điểm.</div>';
    document.getElementById('cws-secretary-actions')?.classList.add('hidden');
    document.getElementById('cws-scoring-section')?.classList.add('hidden');
    document.getElementById('cws-scorers-progress-section')?.classList.add('hidden');
    document.getElementById('cws-admin-monitor-section')?.classList.add('hidden');
    return;
  }

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const sObj = findStudentInRound(sid);
  const asgn = (act?.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);

  const sName = sObj?.fullName || sObj?.studentName || sid;
  const sTopic = sObj?.topicTitle || '--';

  // Format Official Supervisors (using officialSupervisors helper with legacy fallback)
  const supervisorsHtml = formatStudentSupervisorsForDisplay(sObj);

  // Presenting status badge
  const isPresenting = (asgn?.presentationStatus === 'presenting');
  const isPresented = (asgn?.presentationStatus === 'presented');
  let statusBadgeHtml = '<span class="badge bg-slate-100 text-slate-600 font-bold text-xs">Chờ trình bày</span>';
  if (isPresenting) {
    statusBadgeHtml = '<span class="badge bg-emerald-500 text-white font-black text-xs animate-pulse">🔴 ĐANG TRÌNH BÀY</span>';
  } else if (isPresented) {
    statusBadgeHtml = '<span class="badge bg-indigo-100 text-indigo-800 font-bold text-xs">✓ Đã trình bày</span>';
  }

  card.innerHTML = `
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono font-black text-xs px-2 py-0.5 bg-white border border-slate-300 rounded-lg">#${asgn?.order || '--'}</span>
          <h2 class="font-black text-base sm:text-lg text-slate-900">${sName}</h2>
          ${statusBadgeHtml}
        </div>
        <p class="font-mono text-xs text-slate-500 mt-0.5 font-bold">MSSV: ${sid}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
      <div>
        <span class="text-[11px] font-bold text-slate-400 block mb-0.5">TÊN ĐỀ TÀI:</span>
        <p class="font-semibold text-slate-800 leading-snug">${sTopic}</p>
      </div>
      <div>
        <span class="text-[11px] font-bold text-slate-400 block mb-0.5">GIẢNG VIÊN HƯỚNG DẪN:</span>
        <div class="font-semibold text-slate-800">${supervisorsHtml}</div>
      </div>
    </div>

    ${asgn?.presentationStatus === 'presented' ? (() => {
      const prelim = getPreliminarySummary(sid, roundId);
      if (prelim && prelim.average !== null) {
        return `
          <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs mt-2">
            <div class="flex items-center gap-2">
              <span class="text-base">🎯</span>
              <div>
                <span class="font-bold text-amber-950">Điểm Sơ khảo TB:</span>
                <span class="font-black font-mono text-sm text-amber-900 ml-1.5">${prelim.average.toFixed(2)}</span>
                <span class="text-[10px] text-amber-700 ml-1 font-semibold">(${prelim.count} lượt chấm hợp lệ)</span>
              </div>
            </div>
            <span class="text-[10px] text-slate-400 italic">Hiển thị sau khi hoàn tất trình bày</span>
          </div>
        `;
      }
      return '';
    })() : ''}
  `;

  // Update presenting banner
  renderPresentingBanner();

  // Render Secretary Actions
  renderSecretaryControls();

  // Render Scoring Section
  renderScoringSection();

  // Render Progress
  renderScorersProgress();

  // Render Admin Monitor
  renderAdminMonitor();
}

function formatStudentSupervisorsForDisplay(reg) {
  if (!reg) return 'GVHD: Chưa phân công';
  const officials = getOfficialSupervisors(reg);
  if (!officials || officials.length === 0) {
    const legacy = reg.acceptedSupervisorName || reg.supervisorName || reg.finalSupervisorName;
    return legacy ? `GVHD: ${legacy}` : 'GVHD: Chưa phân công';
  }
  if (officials.length === 1) {
    return `GVHD: ${officials[0].supervisorName || 'Giảng viên'}`;
  }
  return officials.map(s => {
    const role = (s.role === 'primary') ? 'GVHD chính' : 'GVHD 2';
    return `<div>${s.supervisorName || 'Giảng viên'} <span class="text-indigo-600 font-mono text-[10px]">(${role})</span></div>`;
  }).join('');
}

// 7. BANNER: CURRENT PRESENTING STUDENT
function renderPresentingBanner() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = act?.councilStudentAssignments || [];

  const pres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');
  const banner = document.getElementById('cws-presenting-banner');
  const bannerText = document.getElementById('cws-presenting-banner-text');
  if (!banner) return;

  const currentSid = state.activeCouncilSelectedStudentId;

  if (pres && pres.studentId !== currentSid) {
    const sObj = findStudentInRound(pres.studentId);
    const sName = sObj?.fullName || sObj?.studentName || pres.studentId;
    if (bannerText) bannerText.textContent = `#${pres.order || ''} ${sName} (${pres.studentId})`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// 8. SECRETARY PRESENTATION CONTROLS
function renderSecretaryControls() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const container = document.getElementById('cws-secretary-actions');
  const btnWrap = document.getElementById('cws-secretary-buttons');
  if (!container || !btnWrap) return;

  // Only Secretary or Admin
  if (!auth.isAdmin && !auth.isSecretary) {
    container.classList.add('hidden');
    return;
  }

  const sid = state.activeCouncilSelectedStudentId;
  const asgn = (act?.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);
  if (!asgn) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  if (asgn.presentationStatus === 'presenting') {
    btnWrap.innerHTML = `
      <button type="button" onclick="finishStudentPresentation('${sid}')" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1">
        <span>✓ Hoàn tất lượt</span>
      </button>
      <button type="button" onclick="resetStudentPresentation('${sid}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold" title="Đặt lại trạng thái Chờ">
        ↺
      </button>
    `;
  } else {
    btnWrap.innerHTML = `
      <button type="button" onclick="startStudentPresentation('${sid}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1">
        <span>▶ Bắt đầu trình bày</span>
      </button>
      ${asgn.presentationStatus === 'presented' ? `
        <button type="button" onclick="resetStudentPresentation('${sid}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold" title="Đặt lại trạng thái Chờ">
          ↺ Đặt lại Chờ
        </button>
      ` : ''}
    `;
  }
}

window.startStudentPresentation = async function(targetSid) {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const assignments = act.councilStudentAssignments || [];
  const currentPres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');

  if (currentPres && currentPres.studentId !== targetSid) {
    const curObj = findStudentInRound(currentPres.studentId);
    const targetObj = findStudentInRound(targetSid);
    const curName = curObj?.fullName || curObj?.studentName || currentPres.studentId;
    const targetName = targetObj?.fullName || targetObj?.studentName || targetSid;

    const confirmed = await showConfirm(
      'Chuyển lượt trình bày',
      `${curName} đang trình bày. Bạn có muốn kết thúc lượt của sinh viên này và chuyển sang ${targetName}?`,
      { confirmText: 'Đồng ý chuyển', danger: false }
    );
    if (!confirmed) return;

    currentPres.presentationStatus = 'presented';
  }

  const targetAsgn = assignments.find(a => a.councilId === councilId && a.studentId === targetSid);
  if (targetAsgn) {
    targetAsgn.presentationStatus = 'presenting';
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspacePartialSync();
  renderSecretaryControls();
  showToast(`Đã bắt đầu lượt trình bày của sinh viên #${targetAsgn?.order || ''}`, 'success');
};

window.finishStudentPresentation = async function(sid) {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const asgn = (act.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);
  if (asgn) {
    asgn.presentationStatus = 'presented';
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspacePartialSync();
  renderSecretaryControls();
  showToast('✓ Đã hoàn tất lượt trình bày của sinh viên.', 'info');
};

window.resetStudentPresentation = async function(sid) {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const asgn = (act.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);
  if (asgn) {
    asgn.presentationStatus = 'waiting';
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspacePartialSync();
  renderSecretaryControls();
};

// 9. COUNCIL SESSION CONTROLS (START / END)
window.startCouncilSession = async function() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  council.status = 'active';
  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`Hội đồng "${council.name}" đã bắt đầu làm việc!`, 'success');
};

window.endCouncilSession = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền kết thúc buổi làm việc của Hội đồng!', 'error');
    return;
  }

  // Check required scorers completion (CT, UV, TK)
  const reqSlots = getRequiredScorers(council, act);
  const assignments = (act?.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  
  let uncompletedCount = 0;
  for (const asgn of assignments) {
    for (const s of reqSlots) {
      const assignedMem = council.membersBySlot?.[s.key];
      if (assignedMem && (assignedMem.memberId || assignedMem.memberEmail)) {
        const scorerId = assignedMem.memberId || assignedMem.memberEmail;
        const k = `${activityId}_${councilId}_${asgn.studentId}_${scorerId}`;
        const sc = state.councilScores?.[k];
        if (sc?.status !== 'completed') {
          uncompletedCount++;
        }
      } else {
        uncompletedCount++;
      }
    }
  }

  let confirmMsg = `Xác nhận kết thúc buổi làm việc của Hội đồng "${council.name}"? Sau khi kết thúc, Chủ tịch Hội đồng sẽ xem được toàn bộ điểm của các thành viên để tiến hành hiệu chỉnh điểm sau hội đồng.`;
  if (uncompletedCount > 0) {
    confirmMsg = `Còn ${uncompletedCount} lượt chấm bắt buộc (Chủ tịch, Ủy viên, Thư ký) chưa hoàn tất! Bạn có chắc chắn muốn kết thúc Hội đồng không?`;
  }

  const confirmed = await showConfirm('Kết thúc Hội đồng', confirmMsg, { confirmText: 'Kết thúc Hội đồng', danger: uncompletedCount > 0 });
  if (!confirmed) return;

  council.status = 'ended';
  council.endedAt = new Date().toISOString();
  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`Đã kết thúc phiên làm việc của Hội đồng "${council.name}".`, 'info');
};

// 10. SCORING CARD RENDERING & ACTIONS
function renderScoringSection() {
  const container = document.getElementById('cws-scoring-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!act?.scoringConfig?.enabled) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const sid = state.activeCouncilSelectedStudentId;
  const myScorerId = getEffectiveActor().uid || getEffectiveActor().email;
  const scoreKey = `${activityId}_${councilId}_${sid}_${myScorerId}`;
  const savedScore = state.councilScores?.[scoreKey];
  const draft = state.councilLocalDrafts?.[sid];

  // Resolve current working values
  const currentVal = draft?.value !== undefined ? draft.value : (savedScore?.value ?? '');
  const currentComment = draft?.comment !== undefined ? draft.comment : (savedScore?.comment ?? '');
  const isCompleted = (savedScore?.status === 'completed' && !draft);
  const councilEnded = (council.status === 'ended' || council.status === 'completed');

  const mode = act.scoringConfig.mode || 'numeric';

  let inputHtml = '';
  if (mode === 'letter') {
    const opts = act.scoringConfig.letterOptions || [];
    inputHtml = `
      <div>
        <label class="font-bold text-slate-800 text-xs block mb-1.5">Mức điểm / Đánh giá (*):</label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          ${opts.map(o => {
            const isSelected = String(currentVal) === String(o.key);
            return `
              <button type="button" ${isCompleted ? 'disabled' : ''} onclick="onSelectLetterScore('${o.key}')" class="p-2.5 rounded-xl border text-left transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500 font-black text-emerald-950' : 'bg-white border-slate-200 hover:border-slate-300 font-semibold text-slate-700'} ${isCompleted ? 'opacity-80 cursor-not-allowed' : ''}">
                <span class="text-sm block font-mono font-black text-emerald-700">${o.key}</span>
                <span class="text-[11px] block mt-0.5">${o.label}</span>
              </button>
            `;
          }).join('')}
        </div>
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
      <div class="flex items-center justify-between gap-2 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
        <span class="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
          <span>✓</span> Bạn đã hoàn tất chấm lúc ${fmt24h(savedScore.completedAt || savedScore.updatedAt)}
        </span>
        ${!councilEnded ? `
          <button type="button" onclick="reopenCurrentScore()" class="px-3 py-1.5 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold shadow-xs">
            ✏️ Mở lại để sửa
          </button>
        ` : ''}
      </div>
    `;
  } else {
    actionsHtml = `
      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <span id="cws-score-draft-time" class="text-[11px] text-slate-400 font-mono">
          ${savedScore?.status === 'draft' ? `Đã lưu tạm lúc ${fmt24h(savedScore.updatedAt)}` : ''}
        </span>
        <div class="flex items-center gap-2">
          <button type="button" onclick="saveCurrentScore(false)" class="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors">
            💾 Lưu tạm
          </button>
          <button type="button" onclick="saveCurrentScore(true)" class="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors">
            ✓ Hoàn tất chấm
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h3 class="font-black text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
        <span>📝</span> PHIẾU CHẤM ĐIỂM CỦA BẠN
      </h3>
      <span class="badge bg-slate-100 text-slate-600 font-bold text-[10px]">
        Vai trò: ${auth.roleName}
      </span>
    </div>

    ${inputHtml}

    <div>
      <label class="font-bold text-slate-800 text-xs block mb-1">Nhận xét chuyên môn (không bắt buộc):</label>
      <textarea id="cws-score-comment" rows="3" ${isCompleted ? 'disabled' : ''} oninput="onScoreCommentChange(this.value)" placeholder="Góp ý chuyên môn, ưu khuyết điểm cho sinh viên..." class="w-full p-2.5 border border-slate-300 rounded-xl text-xs ${isCompleted ? 'bg-slate-100 text-slate-600' : 'bg-white focus:ring-2 focus:ring-blue-500'}">${escapeHtml(currentComment)}</textarea>
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

  const effectiveScorer = getEffectiveActor();
  const scorerId = effectiveScorer.uid || effectiveScorer.email;
  const scorerEmail = (effectiveScorer.email || '').toLowerCase().trim();
  const scorerName = effectiveScorer.displayName || auth.roleName || 'Thành viên Hội đồng';
  const scoreKey = `${activityId}_${councilId}_${sid}_${scorerId}`;

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

  // 1. In-memory update
  state.councilScores[scoreKey] = scoreRecord;
  delete state.councilLocalDrafts[sid];

  // 2. Persist to Firestore: Concurrency-safe atomic key update
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    
    // Best-effort subcollection write (authorized for both admin and staff under reviewDecisions)
    try {
      const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', scoreKey);
      await setDoc(decRef, scoreRecord, { merge: true }).catch(() => {});
    } catch (subErr) {}

    // Atomic dot-notation update on graduationRounds document (preserves other scorers)
    if (state.isAdmin) {
      await updateDoc(roundRef, {
        [`councilScores.${scoreKey}`]: scoreRecord,
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('Persist score notice:', err);
  }

  // Refresh Views
  renderCouncilStudentList();
  renderScoringSection();
  renderScorersProgress();
  renderAdminMonitor();

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
  const scorerId = getEffectiveActor().uid || getEffectiveActor().email;
  const scoreKey = `${activityId}_${councilId}_${sid}_${scorerId}`;

  const existing = state.councilScores?.[scoreKey];
  if (!existing) return;

  existing.status = 'draft';
  existing.updatedAt = new Date().toISOString();

  try {
    const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', scoreKey);
    await setDoc(decRef, existing, { merge: true }).catch(() => {});
    if (state.isAdmin) {
      const roundRef = doc(db, 'graduationRounds', roundId);
      await updateDoc(roundRef, {
        [`councilScores.${scoreKey}`]: existing,
        updatedAt: serverTimestamp()
      });
    }
  } catch (e) {}

  renderCouncilStudentList();
  renderScoringSection();
  renderScorersProgress();
  renderAdminMonitor();
  showToast('Đã mở lại phiếu chấm. Bạn có thể chỉnh sửa và hoàn tất lại.', 'info');
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
  if (!act?.scoringConfig?.enabled || !sid || !council) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const slots = act.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};
  const myUserId = getEffectiveActor().uid || getEffectiveActor().email;

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
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  if (!auth.isAdmin) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  const assignments = (act?.councilStudentAssignments || [])
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const slots = act?.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};
  const mode = act?.scoringConfig?.mode || 'numeric';

  const rowsHtml = assignments.map(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;

    let totalCompletedVal = 0;
    let completedCount = 0;
    const letterCounts = {};

    const cellsHtml = slots.map(s => {
      const assigned = membersBySlot[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (score?.status === 'completed') {
        if (mode === 'numeric') {
          totalCompletedVal += Number(score.value || 0);
          completedCount++;
          return `<td class="p-2 text-center font-mono font-bold text-emerald-700">${score.value}</td>`;
        } else {
          letterCounts[score.value] = (letterCounts[score.value] || 0) + 1;
          const numVal = resolveScoreNumericValue(score, act);
          if (typeof numVal === 'number' && !isNaN(numVal)) {
            totalCompletedVal += numVal;
            completedCount++;
          }
          const subText = (typeof numVal === 'number' && !isNaN(numVal)) ? `<div class="text-[10px] text-slate-400 font-normal">(${numVal}đ)</div>` : '';
          return `<td class="p-2 text-center font-mono font-bold text-indigo-700">${score.value}${subText}</td>`;
        }
      } else if (score?.status === 'draft') {
        return `<td class="p-2 text-center font-mono text-amber-600 text-[10px]">● ${score.value || 'Draft'}</td>`;
      }
      return '<td class="p-2 text-center text-slate-300 font-mono">--</td>';
    }).join('');

    let summaryCol = '--';
    if (mode === 'numeric') {
      if (completedCount > 0) {
        const avg = (totalCompletedVal / completedCount).toFixed(2);
        summaryCol = `<strong class="text-slate-900">${avg}</strong> <span class="text-[10px] text-slate-400">(${completedCount} chấm)</span>`;
      }
    } else {
      const entries = Object.entries(letterCounts);
      if (entries.length > 0) {
        const countsStr = entries.map(([k, c]) => `${k}: ${c}`).join(', ');
        if (completedCount > 0) {
          const avg = (totalCompletedVal / completedCount).toFixed(2);
          summaryCol = `<div class="font-bold text-slate-900">${countsStr}</div><div class="text-[10px] text-indigo-600 font-semibold mt-0.5">TB: ${avg}đ (${completedCount} chấm)</div>`;
        } else {
          summaryCol = `<div class="font-bold text-slate-900">${countsStr}</div>`;
        }
      }
    }

    return `
      <tr class="hover:bg-indigo-50/40 transition-colors">
        <td class="p-2 text-center font-mono font-bold text-slate-400">#${asgn.order || '--'}</td>
        <td class="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-2 font-bold text-slate-800 whitespace-nowrap">${sName}</td>
        ${cellsHtml}
        <td class="p-2 text-center font-mono font-semibold">${summaryCol}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="font-black text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
        <span>🛡️</span> Bảng theo dõi Điểm & Trạng thái Hội đồng (Chỉ Quản trị viên)
      </h4>
      <span class="text-[10px] text-indigo-600 font-bold">Real-time Monitor</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden shadow-xs border border-indigo-100">
        <thead class="bg-indigo-50/70 text-indigo-900 border-b border-indigo-100 font-bold">
          <tr>
            <th class="p-2 text-center">#</th>
            <th class="p-2">MSSV</th>
            <th class="p-2">Họ và tên</th>
            ${slots.map(s => `<th class="p-2 text-center whitespace-nowrap">${s.label || s.name}</th>`).join('')}
            <th class="p-2 text-center whitespace-nowrap">${mode === 'numeric' ? 'Điểm TB' : 'Tổng hợp'}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

// 14. URL DIRECT NAVIGATION LISTENER (?x=&a=&c=)
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const xCode = params.get('x') || params.get('round');
      const aCode = params.get('a');
      const cCode = params.get('c');

      if (xCode && aCode && cCode && state.rounds && state.rounds.length > 0) {
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
  }, 1500);
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
}
