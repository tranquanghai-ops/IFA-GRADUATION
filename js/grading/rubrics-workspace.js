
// --- Module Bridges ---
export const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : (reg?.officialSupervisors || []));
export const getPreliminarySummary = (sid, rId) => (typeof window !== 'undefined' && typeof window.getPreliminarySummary === 'function' ? window.getPreliminarySummary(sid, rId) : null);

export function getStudentFullProfile(sid, arg2 = null, arg3 = null, arg4 = null) {
  if (!sid) return { studentId: '', mssv: '', fullName: '', topicTitle: '--' };

  const cleanId = String(sid).trim().toUpperCase();

  // Detect whether arg2 is round object or activity object
  let roundObj = null;
  let actObj = null;
  let councilObj = null;

  if (arg2 && (arg2.eligibleStudents || arg2.registrations || arg2.officialAssignments || arg2.activities || arg2.academicYear)) {
    roundObj = arg2;
  } else if (arg4 && (arg4.eligibleStudents || arg4.registrations || arg4.officialAssignments || arg4.activities)) {
    roundObj = arg4;
    actObj = arg2;
    councilObj = arg3;
  } else {
    actObj = arg2;
    councilObj = arg3;
    roundObj = arg4;
  }

  const currentRound = roundObj
    || (state.rounds || []).find(r => r.id === (state.activeCouncilWorkspace?.roundId || state.selectedAssessmentRoundId || state.selectedRoundId))
    || state.activeRound;
  const roundId = currentRound?.id || state.activeCouncilWorkspace?.roundId;

  const cachedList = state.councilStudentsByRound?.[roundId] || currentRound?.councilStudents || [];
  const cachedStudent = cachedList.find(s => (s.studentId === cleanId || s.mssv === cleanId || s.studentId === sid || s.mssv === sid));

  const off = (currentRound?.officialAssignments || []).find(a => (a.studentId === cleanId || a.mssv === cleanId || a.id === cleanId || a.studentId === sid));
  const reg = (currentRound?.registrations || []).find(r => (r.studentId === cleanId || r.mssv === cleanId || r.id === cleanId || r.studentId === sid));
  const adminReg = (state.adminReviewData?.registrations || []).find(r => (r.studentId === cleanId || r.mssv === cleanId || r.id === cleanId || r.studentId === sid));
  const el = (currentRound?.eligibleStudents || []).find(e => (e.studentId === cleanId || e.mssv === cleanId || e.id === cleanId || e.studentId === sid));
  const cStudent = (currentRound?.councilStudents || []).find(s => (s.studentId === cleanId || s.mssv === cleanId || s.id === cleanId || s.studentId === sid));
  const topicReg = currentRound?.topicRegistrations?.[cleanId] || currentRound?.topicRegistrations?.[cleanId.toLowerCase()] || currentRound?.topicRegistrations?.[sid];

  let sObj = {
    studentId: cleanId,
    mssv: cleanId,
    ...(cachedStudent || {}),
    ...(el || {}),
    ...(cStudent || {}),
    ...(adminReg || {}),
    ...(reg || {}),
    ...(off || {}),
    ...(topicReg || {})
  };

  const fac = (typeof window !== 'undefined' && typeof window.getFacultyStudent === 'function') 
    ? window.getFacultyStudent(cleanId) 
    : ((typeof window !== 'undefined' && typeof window.getFacultyStudentByMssv === 'function') ? window.getFacultyStudentByMssv(cleanId) : null);

  if (fac && !fac.isMissing) {
    sObj.fullName = sObj.fullName || sObj.studentName || fac.fullName || fac.name || cleanId;
    sObj.studentName = sObj.studentName || sObj.fullName || fac.name || fac.fullName || cleanId;
    sObj.className = sObj.className || sObj.studentClass || fac.className || fac.studentClass || '--';
    sObj.studentClass = sObj.className;
    sObj.major = sObj.major || fac.major;
    sObj.topicTitle = (sObj.topicTitle && sObj.topicTitle !== '--' && sObj.topicTitle !== 'Chưa đăng ký đề tài') ? sObj.topicTitle : (fac.topicTitle || fac.topic || '--');
    if (!sObj.acceptedSupervisorName && !sObj.supervisorName && (fac.supervisorName || fac.acceptedSupervisorName)) {
      sObj.acceptedSupervisorName = fac.supervisorName || fac.acceptedSupervisorName;
      sObj.supervisorName = sObj.acceptedSupervisorName;
    }
  }

  sObj.fullName = sObj.fullName || sObj.studentName || sObj.name || cleanId;
  sObj.topicTitle = (sObj.topicTitle && sObj.topicTitle !== '--') ? sObj.topicTitle : (sObj.topic || sObj.topicVietnamese || sObj.topicName || topicReg?.topicTitle || topicReg?.topic || fac?.topicTitle || fac?.topic || 'Chưa đăng ký đề tài');

  if (!sObj.acceptedSupervisorName && !sObj.supervisorName) {
    const adminRegMatch = (state.adminReviewData?.registrations || []).find(r => r.studentId === cleanId);
    if (adminRegMatch) {
      sObj.acceptedSupervisorName = adminRegMatch.acceptedSupervisorName || adminRegMatch.supervisorName;
      sObj.supervisorName = sObj.acceptedSupervisorName;
    } else if (fac?.supervisorName || fac?.acceptedSupervisorName) {
      sObj.acceptedSupervisorName = fac.supervisorName || fac.acceptedSupervisorName;
      sObj.supervisorName = sObj.acceptedSupervisorName;
    }
  }

  if (!sObj.officialSupervisors || sObj.officialSupervisors.length === 0) {
    if (typeof window !== 'undefined' && typeof window.getOfficialSupervisors === 'function') {
      sObj.officialSupervisors = window.getOfficialSupervisors(sObj);
    }
  }

  return sObj;
}

export const findStudentInRound = (sid, roundId) => {
  return getStudentFullProfile(sid, null, null, null);
};

if (typeof window !== 'undefined') {
  if (typeof initCouncilTouchSwipeListeners !== 'undefined') window.initCouncilTouchSwipeListeners = initCouncilTouchSwipeListeners;
  window.getStudentFullProfile = getStudentFullProfile;
  window.findStudentInRound = findStudentInRound;
}
/**
 * IFA+ Graduation — Council Live Workspace & Session Controls Submodule
 */

export function checkCouncilAuthorization(round, act, council, user) {
  if (!round || !act || !council) return { authorized: false, reason: 'Không tìm thấy dữ liệu Hội đồng' };
  
  const actor = user || getEffectiveActor();
  const isDirectMode = Boolean(state.isCouncilDirectMode || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('councilDirectMode') === 'true'));

  if (!actor || !actor.email) {
    return { authorized: false, reason: 'Vui lòng đăng nhập để truy cập Hội đồng.' };
  }

  const userEmail = actor.email.toLowerCase().trim();
  const userId = actor.uid || actor.email;
  const membersBySlot = council.membersBySlot || {};

  // Check all members assigned to this council
  for (const [slotKey, assigned] of Object.entries(membersBySlot)) {
    if (assigned) {
      let isMatch = false;
      if (typeof window.isUserMatchingCouncilMember === 'function') {
        isMatch = window.isUserMatchingCouncilMember(assigned, userEmail, userId);
      }
      if (!isMatch) {
        const memEmail = String(assigned.memberEmail || assigned.email || '').toLowerCase().trim();
        const memId = String(assigned.memberId || assigned.id || '').trim();
        const isEmailMatch = Boolean(memEmail && userEmail && memEmail === userEmail);
        const isIdMatch = Boolean(memId && (memId === userId || memId.toLowerCase() === userEmail));
        let isMasterMatch = false;
        if (memId && state.supervisorsMaster && state.supervisorsMaster.length > 0) {
          const matchedSup = state.supervisorsMaster.find(s => s.id === memId);
          if (matchedSup && matchedSup.email && matchedSup.email.toLowerCase().trim() === userEmail) {
            isMasterMatch = true;
          }
        }
        isMatch = isEmailMatch || isIdMatch || isMasterMatch;
      }

      if (isMatch) {
        const isSec = (slotKey === 'secretary' || slotKey.startsWith('secretary') || String(assigned.role || '').toLowerCase().includes('thư ký'));
        const isChair = (slotKey === 'chair' || slotKey.startsWith('chair') || String(assigned.role || '').toLowerCase().includes('chủ tịch'));
        const roleLabel = isChair ? 'Chủ tịch Hội đồng' : (isSec ? 'Thư ký Hội đồng' : (assigned.role || 'Thành viên Hội đồng'));
        return {
          authorized: true,
          role: slotKey,
          roleName: roleLabel,
          slotKey: slotKey,
          canScore: true,
          isSecretary: isSec,
          isChair: isChair,
          isAdmin: isDirectMode ? false : Boolean(actor.isAdmin && !actor.impersonating),
          canCalibrate: isChair || Boolean(actor.isAdmin && !isDirectMode),
          canFinalize: isChair || Boolean(actor.isAdmin && !isDirectMode)
        };
      }
    }
  }

  // Real Admin handling:
  // If in direct council mode (?hd=CODE), Admin acts as a normal council member if not explicitly assigned
  if (actor.isAdmin && !actor.impersonating) {
    if (isDirectMode) {
      return {
        authorized: true,
        role: 'member',
        roleName: 'Thành viên Hội đồng',
        slotKey: 'member_evaluator',
        canScore: true,
        isSecretary: false,
        isChair: false,
        isAdmin: false,
        canCalibrate: false,
        canFinalize: false
      };
    }
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

  const isDirectMode = Boolean(state.isCouncilDirectMode || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('councilDirectMode') === 'true'));
  if (isDirectMode && typeof document !== 'undefined' && document.body) {
    document.body.classList.add('council-standalone-active');
  }

  // AUTHORIZATION CHECK
  const authCheck = checkCouncilAuthorization(targetRound, act, council, getEffectiveActor());
  if (!authCheck.authorized) {
    showToast(authCheck.reason || 'Bạn không có quyền truy cập Hội đồng này.', 'error');
    return;
  }

  // Ensure faculty dataset is loaded for student names, topics & supervisor resolution
  if (typeof window !== 'undefined' && typeof window.ensureFacultyDatasetLoaded === 'function' && (!state.facultyStudents || state.facultyStudents.length === 0)) {
    await window.ensureFacultyDatasetLoaded().catch(() => {});
  } else if (typeof ensureFacultyDatasetLoaded === 'function' && (!state.facultyStudents || state.facultyStudents.length === 0)) {
    await ensureFacultyDatasetLoaded().catch(() => {});
  }

  // Ensure round students are loaded
  if (typeof window !== 'undefined' && typeof window.loadCouncilRoundStudents === 'function') {
    await window.loadCouncilRoundStudents(roundId).catch(() => {});
  } else if (typeof loadCouncilRoundStudents === 'function') {
    await loadCouncilRoundStudents(roundId).catch(() => {});
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

  // Sync live timer from council
  const currentCouncil = (act.councils || []).find(c => c.id === councilId);
  if (currentCouncil) {
    syncLiveTimerFromCouncil(currentCouncil);
  }

  // Render UI
  renderCouncilWorkspaceFull();

  // Show modal
  document.getElementById('modal-council-workspace')?.classList.remove('hidden');

  // Real-time Firestore Listener
  setupCouncilRealtimeSync(roundId, activityId, councilId);
};

window.handleCouncilDirectLogout = async function() {
  if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi phiên chấm Hội đồng?')) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('pendingCouncilCode');
      sessionStorage.removeItem('councilDirectMode');
      sessionStorage.removeItem('directCouncilCode');
    }
    state.isCouncilDirectMode = false;
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('council-standalone-active');
    }
    if (typeof window.handleLogout === 'function') {
      await window.handleLogout();
    } else {
      window.location.href = window.location.origin;
    }
  }
};

window.closeCouncilWorkspace = function() {
  const isDirectMode = Boolean(state.isCouncilDirectMode || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('councilDirectMode') === 'true'));
  if (isDirectMode) {
    window.handleCouncilDirectLogout();
    return;
  }

  if (state.activeCouncilUnsubscribe) {
    try { state.activeCouncilUnsubscribe(); } catch (e) {}
    state.activeCouncilUnsubscribe = null;
  }
  if (state.councilTimer?.intervalId) {
    clearInterval(state.councilTimer.intervalId);
    state.councilTimer.intervalId = null;
  }
  if (state.councilTimer) {
    state.councilTimer.isRunning = false;
  }
  document.getElementById('modal-council-workspace')?.classList.add('hidden');

  // Seamless live auto-update of outer defense list
  if (typeof window.renderAssessmentDefenseList === 'function' && state.currentView === 'assessment') {
    window.renderAssessmentDefenseList();
  }
  if (typeof window.renderAssessmentHeroCard === 'function' && state.currentView === 'assessment') {
    window.renderAssessmentHeroCard();
  }
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

      // Sync council live timer across all connected members
      const updatedAct = (updatedData.activities || []).find(a => a.id === activityId);
      const updatedCouncil = (updatedAct?.councils || []).find(c => c.id === councilId);
      if (updatedCouncil) {
        syncLiveTimerFromCouncil(updatedCouncil);
      }

      // Re-render Council Workspace WITHOUT changing selected student!
      renderCouncilWorkspacePartialSync();

      // Refresh outer assessment list in real-time
      if (typeof window.renderAssessmentDefenseList === 'function' && state.currentView === 'assessment') {
        window.renderAssessmentDefenseList();
      }
      if (typeof window.renderAssessmentHeroCard === 'function' && state.currentView === 'assessment') {
        window.renderAssessmentHeroCard();
      }
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

  // Role & Member Badges
  const actor = getEffectiveActor();
  const councilMember = council.membersBySlot?.[auth.slotKey];
  const memberDisplayName = councilMember?.memberName || councilMember?.name || actor?.name || actor?.displayName || state.user?.displayName || '';
  const memberRoleText = auth.roleName || 'Thành viên';

  const roleBadge = document.getElementById('cws-my-role-badge');
  if (roleBadge) {
    roleBadge.textContent = memberRoleText;
  }

  const headerMemberBadge = document.getElementById('cws-member-header-badge');
  if (headerMemberBadge) {
    if (memberDisplayName) {
      headerMemberBadge.textContent = `• ${memberDisplayName}`;
      headerMemberBadge.classList.remove('hidden');
    } else {
      headerMemberBadge.classList.add('hidden');
    }
  }

  const memberInfoText = document.getElementById('cws-member-info-text');
  if (memberInfoText) {
    memberInfoText.textContent = memberDisplayName ? `${memberDisplayName} (${memberRoleText})` : memberRoleText;
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

  // Direct Council Link Mode Header Actions
  const isDirectMode = Boolean(state.isCouncilDirectMode || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('councilDirectMode') === 'true'));
  const directActions = document.getElementById('cws-direct-user-actions');
  const normalClose = document.getElementById('btn-cws-normal-close');
  const directEmail = document.getElementById('cws-direct-user-email');

  if (isDirectMode) {
    if (directActions) {
      directActions.classList.remove('hidden');
      directActions.classList.add('flex');
    }
    if (normalClose) normalClose.classList.add('hidden');
    if (directEmail) {
      const email = getEffectiveActor()?.email || state.user?.email || '';
      directEmail.textContent = email;
    }
  } else {
    if (directActions) {
      directActions.classList.add('hidden');
      directActions.classList.remove('flex');
    }
    if (normalClose) normalClose.classList.remove('hidden');
  }

  renderCouncilStudentList();
  renderCouncilSelectedStudentDetails();
  renderPresentationTimerUI();
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

  // Update countdown timer
  renderPresentationTimerUI();

  // Update scorers completion progress & admin monitor
  renderScorersProgress();
  renderAdminMonitor();

  // Update post-council calibration and audit logs
  renderPostCouncilSection();
  renderAuditLogsSection();
}

// --- PRESENTATION COUNTDOWN TIMER CONTROLS ---

export function syncLiveTimerFromCouncil(council) {
  const liveTimer = council?.liveTimer;
  state.councilTimer = state.councilTimer || {
    intervalId: null,
    durationSeconds: 15 * 60,
    remainingSeconds: 15 * 60,
    isRunning: false,
    studentId: null
  };
  const timer = state.councilTimer;

  if (!liveTimer) return;

  timer.durationSeconds = liveTimer.durationSeconds || (15 * 60);
  timer.studentId = liveTimer.studentId || null;

  if (liveTimer.isRunning && liveTimer.startedAt) {
    const elapsed = Math.floor((Date.now() - liveTimer.startedAt) / 1000);
    const baseRem = (liveTimer.remainingSeconds !== undefined && liveTimer.remainingSeconds !== null)
      ? liveTimer.remainingSeconds
      : timer.durationSeconds;
    timer.remainingSeconds = Math.max(0, baseRem - elapsed);
    timer.isRunning = true;

    if (!timer.intervalId) {
      timer.intervalId = setInterval(onPresentationTimerTick, 1000);
    }
  } else {
    timer.remainingSeconds = (liveTimer.remainingSeconds !== undefined && liveTimer.remainingSeconds !== null)
      ? liveTimer.remainingSeconds
      : timer.durationSeconds;
    timer.isRunning = false;

    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
  }
}

async function broadcastCouncilLiveTimer() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace || {};
  if (!roundId || !activityId || !councilId) return;

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  const timer = state.councilTimer || {};
  const actor = getEffectiveActor();
  const uEmail = actor.email || 'user';

  council.liveTimer = {
    durationSeconds: timer.durationSeconds || (15 * 60),
    remainingSeconds: timer.remainingSeconds != null ? timer.remainingSeconds : (timer.durationSeconds || (15 * 60)),
    startedAt: timer.isRunning ? Date.now() : null,
    isRunning: Boolean(timer.isRunning),
    studentId: timer.studentId || state.activeCouncilSelectedStudentId || null,
    updatedAt: Date.now(),
    updatedBy: uEmail
  };

  try {
    if (typeof persistActivityCouncilChanges === 'function') {
      await persistActivityCouncilChanges(targetRound);
    }
  } catch (err) {
    console.warn('Broadcast live timer notice:', err);
  }
}

export function initPresentationTimer(sid = null) {
  state.councilTimer = state.councilTimer || {};
  if (state.councilTimer.intervalId) {
    clearInterval(state.councilTimer.intervalId);
    state.councilTimer.intervalId = null;
  }
  state.councilTimer.studentId = sid || state.activeCouncilSelectedStudentId;
  state.councilTimer.durationSeconds = state.councilTimer.durationSeconds || (15 * 60);
  state.councilTimer.remainingSeconds = state.councilTimer.durationSeconds;
  state.councilTimer.isRunning = true;
  state.councilTimer.intervalId = setInterval(onPresentationTimerTick, 1000);
  renderPresentationTimerUI();
  broadcastCouncilLiveTimer();
}

function onPresentationTimerTick() {
  const timer = state.councilTimer;
  if (!timer || !timer.isRunning) return;

  if (timer.remainingSeconds > 0) {
    timer.remainingSeconds--;
  } else {
    timer.remainingSeconds = 0;
  }
  renderPresentationTimerUI();
}

export function renderPresentationTimerUI() {
  const widget = document.getElementById('cws-timer-widget');
  const display = document.getElementById('cws-timer-display');
  const statusEl = document.getElementById('cws-timer-status');
  const toggleBtn = document.getElementById('cws-timer-toggle-btn');
  const toggleText = document.getElementById('cws-timer-toggle-text');
  const durationSelect = document.getElementById('cws-timer-duration-select');
  if (!widget || !display) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = act?.councilStudentAssignments || [];
  const presentingAsgn = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');

  state.councilTimer = state.councilTimer || {
    intervalId: null,
    durationSeconds: 15 * 60,
    remainingSeconds: 15 * 60,
    isRunning: false
  };
  const timer = state.councilTimer;

  // Show timer whenever there is a presenting student, timer is active, or timer has started
  if (!presentingAsgn && !timer.isRunning && timer.remainingSeconds === timer.durationSeconds && !timer.studentId) {
    widget.classList.add('hidden');
    return;
  }

  widget.classList.remove('hidden');

  const totalSec = timer.remainingSeconds != null ? timer.remainingSeconds : (15 * 60);
  const mins = Math.floor(Math.max(0, totalSec) / 60);
  const secs = Math.max(0, totalSec) % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  display.textContent = formatted;

  // Visual cues
  if (totalSec <= 0) {
    display.className = 'font-mono font-black text-2xl sm:text-3xl text-rose-500 tracking-wider animate-bounce cursor-pointer';
    if (statusEl) {
      statusEl.className = 'badge bg-rose-600 text-white font-black text-[10px] animate-pulse';
      statusEl.textContent = '🚨 HẾT GIỜ BÁO CÁO';
    }
  } else if (totalSec <= 180) {
    display.className = 'font-mono font-black text-2xl sm:text-3xl text-amber-400 tracking-wider animate-pulse cursor-pointer';
    if (statusEl) {
      statusEl.className = 'badge bg-amber-500 text-slate-950 font-black text-[10px]';
      statusEl.textContent = '⚠️ Sắp hết giờ (<3p)';
    }
  } else {
    display.className = 'font-mono font-black text-2xl sm:text-3xl text-emerald-400 tracking-wider cursor-pointer';
    if (statusEl) {
      statusEl.className = 'badge bg-slate-800 text-emerald-300 font-bold text-[10px]';
      statusEl.textContent = timer.isRunning ? '● Đang tính giờ' : '⏸ Đang tạm dừng';
    }
  }

  if (toggleText) {
    toggleText.textContent = timer.isRunning ? '⏸ Tạm dừng' : '▶ Tiếp tục';
  }
  if (toggleBtn) {
    toggleBtn.className = timer.isRunning
      ? 'px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer'
      : 'px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer';
  }
  if (durationSelect && timer.durationSeconds) {
    const existingOpt = Array.from(durationSelect.options).find(o => o.value === String(timer.durationSeconds));
    if (existingOpt) {
      durationSelect.value = String(timer.durationSeconds);
    } else {
      let customOpt = durationSelect.querySelector('option[data-custom="true"]');
      if (!customOpt) {
        customOpt = document.createElement('option');
        customOpt.setAttribute('data-custom', 'true');
        durationSelect.insertBefore(customOpt, durationSelect.querySelector('option[value="custom"]'));
      }
      const durMins = Math.floor(timer.durationSeconds / 60);
      customOpt.value = String(timer.durationSeconds);
      customOpt.textContent = `${durMins} phút (Tùy chỉnh)`;
      durationSelect.value = String(timer.durationSeconds);
    }
  }

  // Controls visibility: secretary/chair/admin can control, others view
  const controlsEl = document.getElementById('cws-timer-controls');
  if (controlsEl) {
    controlsEl.classList.toggle('hidden', !(auth?.isAdmin || auth?.isSecretary || auth?.isChair));
  }
}

window.onTimerDurationSelectChange = function(val) {
  if (val === 'custom') {
    promptCustomPresentationTimer();
  } else {
    setPresentationTimerPreset(val);
  }
};

window.promptCustomPresentationTimer = async function() {
  const curMins = Math.floor((state.councilTimer?.durationSeconds || 900) / 60);
  const input = window.prompt('Nhập thời lượng báo cáo mong muốn (số phút, từ 1 đến 180):', String(curMins));
  if (input === null) {
    renderPresentationTimerUI();
    return;
  }
  const mins = parseInt(input.trim(), 10);
  if (isNaN(mins) || mins <= 0 || mins > 180) {
    showToast('Vui lòng nhập số phút hợp lệ (1 - 180 phút)!', 'error');
    renderPresentationTimerUI();
    return;
  }
  setCustomPresentationTimer(mins);
};

window.setCustomPresentationTimer = async function(mins) {
  const sec = mins * 60;
  state.councilTimer = state.councilTimer || {};
  state.councilTimer.durationSeconds = sec;
  state.councilTimer.remainingSeconds = sec;
  state.councilTimer.isRunning = false;
  if (state.councilTimer.intervalId) {
    clearInterval(state.councilTimer.intervalId);
    state.councilTimer.intervalId = null;
  }
  renderPresentationTimerUI();
  await broadcastCouncilLiveTimer();
  showToast(`⏱️ Đã tùy chỉnh thời gian báo cáo thành ${mins} phút.`, 'info');
};

window.promptCustomAddTimerMinutes = async function() {
  const input = window.prompt('Nhập số phút muốn cộng thêm cho sinh viên (từ 1 đến 60 phút):', '3');
  if (input === null) return;
  const mins = parseInt(input.trim(), 10);
  if (isNaN(mins) || mins <= 0 || mins > 60) {
    showToast('Vui lòng nhập số phút cộng thêm hợp lệ (1 - 60 phút)!', 'error');
    return;
  }
  await addPresentationTimerMinutes(mins);
};

window.togglePresentationTimer = async function() {
  state.councilTimer = state.councilTimer || {
    intervalId: null,
    durationSeconds: 15 * 60,
    remainingSeconds: 15 * 60,
    isRunning: false
  };
  const timer = state.councilTimer;
  if (timer.isRunning) {
    timer.isRunning = false;
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
  } else {
    timer.isRunning = true;
    if (!timer.intervalId) {
      timer.intervalId = setInterval(onPresentationTimerTick, 1000);
    }
  }
  renderPresentationTimerUI();
  await broadcastCouncilLiveTimer();
};

window.addPresentationTimerMinutes = async function(mins = 5) {
  state.councilTimer = state.councilTimer || {
    intervalId: null,
    durationSeconds: 15 * 60,
    remainingSeconds: 15 * 60,
    isRunning: false
  };
  state.councilTimer.remainingSeconds = (state.councilTimer.remainingSeconds || 0) + mins * 60;
  renderPresentationTimerUI();
  await broadcastCouncilLiveTimer();
  showToast(`⏱️ Đã cộng thêm ${mins} phút thời gian báo cáo.`, 'info');
};

window.setPresentationTimerPreset = async function(secStr) {
  const sec = parseInt(secStr, 10);
  if (isNaN(sec) || sec <= 0) return;
  state.councilTimer = state.councilTimer || {};
  state.councilTimer.durationSeconds = sec;
  state.councilTimer.remainingSeconds = sec;
  state.councilTimer.isRunning = false;
  if (state.councilTimer.intervalId) {
    clearInterval(state.councilTimer.intervalId);
    state.councilTimer.intervalId = null;
  }
  renderPresentationTimerUI();
  await broadcastCouncilLiveTimer();
  showToast(`Đã đổi thời gian báo cáo thành ${Math.floor(sec / 60)} phút.`, 'info');
};

window.resetPresentationTimer = async function() {
  state.councilTimer = state.councilTimer || {};
  if (state.councilTimer.intervalId) {
    clearInterval(state.councilTimer.intervalId);
    state.councilTimer.intervalId = null;
  }
  state.councilTimer.remainingSeconds = state.councilTimer.durationSeconds || (15 * 60);
  state.councilTimer.isRunning = false;
  renderPresentationTimerUI();
  await broadcastCouncilLiveTimer();
  showToast('Đã đặt lại bộ đếm thời gian.', 'info');
};

function renderCouncilStudentList() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!targetRound || !act) return;

  const assignments = act.councilStudentAssignments || [];
  const councilStudents = assignments
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const countBadge = document.getElementById('cws-student-count-badge');
  if (countBadge) countBadge.textContent = councilStudents.length;
  const mobileCountBadge = document.getElementById('cws-mobile-student-count-badge');
  if (mobileCountBadge) mobileCountBadge.textContent = councilStudents.length;

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
    const sObj = getStudentFullProfile(sid, act, council, targetRound);
    const sName = sObj?.fullName || sObj?.studentName || sObj?.name || sid;
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
window.switchCouncilWorkspaceMobileTab = function(tab = 'grading') {
  const colStudents = document.getElementById('cws-col-students');
  const colGrading = document.getElementById('cws-col-grading');
  const btnStudents = document.getElementById('btn-cws-tab-students');
  const btnGrading = document.getElementById('btn-cws-tab-grading');

  if (!colStudents || !colGrading) return;

  if (tab === 'students') {
    colStudents.classList.remove('hidden');
    colGrading.classList.add('hidden');
    colGrading.classList.remove('flex');

    if (btnStudents) {
      btnStudents.className = 'flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-white shadow-xs text-indigo-900 border border-indigo-200 flex items-center justify-center gap-1.5 transition-all';
    }
    if (btnGrading) {
      btnGrading.className = 'flex-1 py-2 px-3 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-all';
    }
  } else {
    colStudents.classList.add('hidden');
    colGrading.classList.remove('hidden');
    colGrading.classList.add('flex');

    if (btnStudents) {
      btnStudents.className = 'flex-1 py-2 px-3 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-all';
    }
    if (btnGrading) {
      btnGrading.className = 'flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-white shadow-xs text-indigo-900 border border-indigo-200 flex items-center justify-center gap-1.5 transition-all';
    }
  }
};

window.navigateCouncilPrevStudent = function() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = (act?.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  if (assignments.length === 0) return;

  const currentSid = state.activeCouncilSelectedStudentId;
  const currentIndex = assignments.findIndex(a => a.studentId === currentSid);
  const prevIndex = (currentIndex > 0) ? currentIndex - 1 : assignments.length - 1;
  const prevSid = assignments[prevIndex]?.studentId;
  if (prevSid) {
    selectCouncilStudent(prevSid, true);
  }
};

window.navigateCouncilNextStudent = function() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = (act?.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  if (assignments.length === 0) return;

  const currentSid = state.activeCouncilSelectedStudentId;
  const currentIndex = assignments.findIndex(a => a.studentId === currentSid);
  const nextIndex = (currentIndex >= 0 && currentIndex < assignments.length - 1) ? currentIndex + 1 : 0;
  const nextSid = assignments[nextIndex]?.studentId;
  if (nextSid) {
    selectCouncilStudent(nextSid, true);
  }
};

window.selectCouncilStudent = function(studentId, forceMobileGradingTab = false) {
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

  // On mobile/tablet screens (< md / 768px), auto-switch to grading tab
  if (window.innerWidth < 768 || forceMobileGradingTab) {
    switchCouncilWorkspaceMobileTab('grading');
  }
};

window.goToCurrentPresentingStudent = function() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = act?.councilStudentAssignments || [];
  const pres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');
  if (pres) {
    selectCouncilStudent(pres.studentId, true);
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
  const council = (act?.councils || []).find(c => c.id === councilId);
  const sObj = getStudentFullProfile(sid, act, council, targetRound);
  const asgn = (act?.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);

  const sName = sObj?.fullName || sObj?.studentName || sObj?.name || sid;
  const sTopic = sObj?.topicTitle || sObj?.topic || '--';
  const hideSupervisor = Boolean(act?.hideSupervisorInCouncil || council?.hideSupervisorInCouncil);

  // Update mobile active student header indicators
  const mobileNameEl = document.getElementById('cws-mobile-active-name');
  if (mobileNameEl) mobileNameEl.textContent = sName;

  const councilStudents = (act?.councilStudentAssignments || [])
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const sIndex = councilStudents.findIndex(a => a.studentId === sid);
  const mobileIndicatorEl = document.getElementById('cws-mobile-student-indicator');
  if (mobileIndicatorEl) {
    mobileIndicatorEl.textContent = `SV ${sIndex >= 0 ? sIndex + 1 : '--'} / ${councilStudents.length}`;
  }

  // Format Official Supervisors
  const supervisorsHtml = hideSupervisor
    ? '<span class="text-slate-400 italic text-xs font-normal">Đã ẩn thông tin theo cài đặt Hội đồng</span>'
    : formatStudentSupervisorsForDisplay(sObj);

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

    <div class="grid grid-cols-1 ${hideSupervisor ? '' : 'md:grid-cols-2'} gap-3 pt-2 border-t border-slate-200 text-xs">
      <div>
        <span class="text-[11px] font-bold text-slate-400 block mb-0.5">TÊN ĐỀ TÀI:</span>
        <p class="font-semibold text-slate-800 leading-snug">${sTopic}</p>
      </div>
      ${!hideSupervisor ? `
      <div>
        <span class="text-[11px] font-bold text-slate-400 block mb-0.5">GIẢNG VIÊN HƯỚNG DẪN:</span>
        <div class="font-semibold text-slate-800">${supervisorsHtml}</div>
      </div>
      ` : ''}
    </div>

    <div class="md:hidden pt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-medium border-t border-slate-200/70 select-none">
      <span>👈 Vuốt phải: SV trước</span>
      <span>Vuốt trái: SV tiếp theo 👉</span>
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

  // Update presentation timer UI
  renderPresentationTimerUI();

  // Render Secretary Actions
  renderSecretaryControls();

  // Render Scoring Section
  renderScoringSection();

  // Render Progress
  renderScorersProgress();

  // Render Admin Monitor
  renderAdminMonitor();

  // Initialize Touch Swipe Listeners for smooth mobile swipe navigation
  if (typeof initCouncilTouchSwipeListeners === 'function') {
    initCouncilTouchSwipeListeners();
  }
}

export function initCouncilTouchSwipeListeners() {
  const targetCard = document.getElementById('cws-selected-student-card');
  if (!targetCard || targetCard._swipeListenersAttached) return;
  targetCard._swipeListenersAttached = true;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  targetCard.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  }, { passive: true });

  targetCard.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const elapsed = Date.now() - touchStartTime;

      // Threshold: at least 45px horizontal movement, mostly horizontal, within 700ms
      if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && elapsed < 700) {
        if (deltaX < 0) {
          // Swiped left -> Next student
          if (typeof window.navigateCouncilNextStudent === 'function') {
            window.navigateCouncilNextStudent();
          }
        } else {
          // Swiped right -> Previous student
          if (typeof window.navigateCouncilPrevStudent === 'function') {
            window.navigateCouncilPrevStudent();
          }
        }
      }
    }
  }, { passive: true });
}

function formatStudentSupervisorsForDisplay(reg, hideSupervisor = false) {
  if (hideSupervisor) return '<span class="text-slate-400 italic text-xs font-normal">Đã ẩn thông tin theo cài đặt Hội đồng</span>';
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
    const council = (act?.councils || []).find(c => c.id === councilId);
    const sObj = getStudentFullProfile(pres.studentId, act, council, targetRound);
    const sName = sObj?.fullName || sObj?.studentName || sObj?.name || pres.studentId;
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
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!act) return;

  const assignments = act.councilStudentAssignments || [];
  const currentPres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');

  if (currentPres && currentPres.studentId !== targetSid) {
    const curObj = getStudentFullProfile(currentPres.studentId, act, council, targetRound);
    const targetObj = getStudentFullProfile(targetSid, act, council, targetRound);
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

  // Start presentation countdown timer
  initPresentationTimer(targetSid);

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

  // Stop timer
  resetPresentationTimer();

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

  // Reset timer
  resetPresentationTimer();

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

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof checkCouncilAuthorization !== 'undefined') window.checkCouncilAuthorization = checkCouncilAuthorization;
  if (typeof getRequiredScorers !== 'undefined') window.getRequiredScorers = getRequiredScorers;
  if (typeof getGuestScorers !== 'undefined') window.getGuestScorers = getGuestScorers;
  if (typeof openCouncilWorkspace !== 'undefined') window.openCouncilWorkspace = openCouncilWorkspace;
  if (typeof closeCouncilWorkspace !== 'undefined') window.closeCouncilWorkspace = closeCouncilWorkspace;
  if (typeof handleCouncilDirectLogout !== 'undefined') window.handleCouncilDirectLogout = handleCouncilDirectLogout;
  if (typeof setupCouncilRealtimeSync !== 'undefined') window.setupCouncilRealtimeSync = setupCouncilRealtimeSync;
  if (typeof loadCouncilScores !== 'undefined') window.loadCouncilScores = loadCouncilScores;
  if (typeof renderCouncilWorkspaceFull !== 'undefined') window.renderCouncilWorkspaceFull = renderCouncilWorkspaceFull;
  if (typeof renderCouncilWorkspacePartialSync !== 'undefined') window.renderCouncilWorkspacePartialSync = renderCouncilWorkspacePartialSync;
  if (typeof renderCouncilStudentList !== 'undefined') window.renderCouncilStudentList = renderCouncilStudentList;
  if (typeof filterCouncilWorkspaceStudents !== 'undefined') window.filterCouncilWorkspaceStudents = filterCouncilWorkspaceStudents;
  if (typeof selectCouncilStudent !== 'undefined') window.selectCouncilStudent = selectCouncilStudent;
  if (typeof goToCurrentPresentingStudent !== 'undefined') window.goToCurrentPresentingStudent = goToCurrentPresentingStudent;
  if (typeof renderCouncilSelectedStudentDetails !== 'undefined') window.renderCouncilSelectedStudentDetails = renderCouncilSelectedStudentDetails;
  if (typeof formatStudentSupervisorsForDisplay !== 'undefined') window.formatStudentSupervisorsForDisplay = formatStudentSupervisorsForDisplay;
  if (typeof renderPresentingBanner !== 'undefined') window.renderPresentingBanner = renderPresentingBanner;
  if (typeof renderSecretaryControls !== 'undefined') window.renderSecretaryControls = renderSecretaryControls;
  if (typeof startStudentPresentation !== 'undefined') window.startStudentPresentation = startStudentPresentation;
  if (typeof finishStudentPresentation !== 'undefined') window.finishStudentPresentation = finishStudentPresentation;
  if (typeof resetStudentPresentation !== 'undefined') window.resetStudentPresentation = resetStudentPresentation;
  if (typeof startCouncilSession !== 'undefined') window.startCouncilSession = startCouncilSession;
  if (typeof endCouncilSession !== 'undefined') window.endCouncilSession = endCouncilSession;
  if (typeof initPresentationTimer !== 'undefined') window.initPresentationTimer = initPresentationTimer;
  if (typeof renderPresentationTimerUI !== 'undefined') window.renderPresentationTimerUI = renderPresentationTimerUI;
  if (typeof togglePresentationTimer !== 'undefined') window.togglePresentationTimer = togglePresentationTimer;
  if (typeof addPresentationTimerMinutes !== 'undefined') window.addPresentationTimerMinutes = addPresentationTimerMinutes;
  if (typeof setPresentationTimerPreset !== 'undefined') window.setPresentationTimerPreset = setPresentationTimerPreset;
  if (typeof resetPresentationTimer !== 'undefined') window.resetPresentationTimer = resetPresentationTimer;
}
