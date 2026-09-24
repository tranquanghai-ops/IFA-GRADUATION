// PHASE 3: SUPERVISOR PORTAL COMPLETE IMPLEMENTATION
// ============================================================================

state.supervisorStudentFilter = 'all';
state.supervisorAssignedStudents = [];

window.initSupervisorPortal = async function() {
  if (typeof ensureSupervisorsMasterLoaded === 'function') {
    try { await ensureSupervisorsMasterLoaded(); } catch (e) {}
  }
  if (typeof ensureFacultyDatasetLoaded === 'function') {
    try { await ensureFacultyDatasetLoaded(); } catch (e) {}
  }

  const deniedCard = document.getElementById('supervisor-access-denied');
  const workspaceContainer = document.getElementById('supervisor-workspace-container');

  // ACCESS RULE: Only supervisor, support supervisor, or admin can access
  const actor = getEffectiveActor();
  const emailLower = (actor.email || '').toLowerCase().trim();
  const isSupervisorCandidate = actor.isSupervisor || actor.isAdmin ||
    (state.roundSupervisors || []).some(s => (s.email || '').toLowerCase().trim() === emailLower) ||
    (state.supervisorsMaster || []).some(s => (s.email || '').toLowerCase().trim() === emailLower);

  if (!actor.email || !isSupervisorCandidate) {
    if (deniedCard) deniedCard.classList.remove('hidden');
    if (workspaceContainer) workspaceContainer.classList.add('hidden');
    return;
  }

  if (deniedCard) deniedCard.classList.add('hidden');
  if (workspaceContainer) workspaceContainer.classList.remove('hidden');

  // Populate round selector filtered to rounds supervisor participates in (or all for admin)
  const supervisorRounds = await renderSupervisorRoundsDropdown();

  // Prefer a round where this supervisor is actually in the round roster.
  // This prevents the active round of another semester from incorrectly
  // showing "không tham gia" when the teacher belongs to a later round.
  const currentRoundId = document.getElementById('supervisor-round-select')?.value
    || supervisorRounds?.[0]?.id
    || state.selectedRoundId
    || state.activeRound?.id
    || (state.rounds && state.rounds[0]?.id);
  if (currentRoundId) {
    await loadSupervisorPortalData(currentRoundId);
  }
};

window.renderSupervisorRoundsDropdown = async function() {
  const select = document.getElementById('supervisor-round-select');
  if (!select) return [];

  const actor = getEffectiveActor();
  const toolbar = document.getElementById('supervisor-round-selector-toolbar');
  const lockedBadge = document.getElementById('sup-round-locked-badge');
  const validRounds = (state.rounds || []).filter(r => !r.deleted);

  // Check if session is locked to a specific round
  const lockedRoundId = (state.impersonation && state.impersonation.target && state.impersonation.target.roundId) || '';

  if (lockedRoundId) {
    state.selectedRoundId = lockedRoundId;
    const lockedRound = validRounds.find(r => r.id === lockedRoundId);
    if (lockedRound) state.activeRound = lockedRound;

    const roundTitle = lockedRound ? `${lockedRound.title} (${lockedRound.academicYear || ''})` : `Đợt: ${lockedRoundId}`;

    select.innerHTML = `<option value="${lockedRoundId}" selected>${roundTitle}</option>`;
    select.disabled = true;
    select.className = 'bg-slate-900/80 text-white border border-white/25 rounded-xl px-3 py-1.5 text-xs font-bold max-w-full truncate';
    if (lockedBadge) lockedBadge.classList.remove('hidden');
    if (toolbar) toolbar.classList.add('hidden');
    return lockedRound ? [lockedRound] : [];
  }

  // Not locked - normal dropdown
  select.disabled = false;
  select.className = 'bg-slate-900/80 hover:bg-slate-900 text-white border border-white/25 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all cursor-pointer max-w-full truncate';
  if (lockedBadge) lockedBadge.classList.add('hidden');

  const emailLower = (actor.email || '').toLowerCase().trim();
  let filteredRounds = validRounds;
  if (!actor.isAdmin) {
    // The source of truth is the per-round supervisors subcollection. Round
    // documents may not carry a legacy `supervisors` array, which previously
    // hid a teacher's newly added T4/2027 round.
    const matchingMaster = (state.supervisorsMaster || []).find(s =>
      String(s.email || '').toLowerCase().trim() === emailLower ||
      (actor.uid && (s.id === actor.uid || s.supervisorId === actor.uid))
    );
    const supervisorIdentityIds = new Set([
      actor.uid,
      matchingMaster?.id,
      matchingMaster?.supervisorId
    ].filter(Boolean).map(value => String(value).trim()));
    const membership = await Promise.all(validRounds.map(async r => {
      try {
        const snap = await getDocs(collection(db, 'graduationRounds', r.id, 'supervisors'));
        const isMember = snap.docs.some(d => {
          const data = d.data() || {};
          const roundSupervisorIds = [d.id, data.supervisorId, data.id]
            .filter(Boolean)
            .map(value => String(value).trim());
          return String(data.email || '').toLowerCase().trim() === emailLower ||
            roundSupervisorIds.some(id => supervisorIdentityIds.has(id));
        });
        return [r.id, isMember];
      } catch (error) {
        console.warn(`[Supervisor] Cannot check round membership for ${r.id}:`, error);
        return [r.id, false];
      }
    }));
    const memberRoundIds = new Set(membership.filter(([, isMember]) => isMember).map(([id]) => id));
    filteredRounds = validRounds.filter(r => memberRoundIds.has(r.id));
    if (filteredRounds.length === 0 && validRounds.length > 0) {
      filteredRounds = [validRounds.find(r => r.isActive) || validRounds[0]];
    }
  }

  select.innerHTML = filteredRounds.map(r => `
    <option value="${r.id}" ${r.id === state.selectedRoundId ? 'selected' : ''}>
      ${r.title} (${r.academicYear || ''})${r.isActive ? ' ★ Hiện hành' : ''}
    </option>
  `).join('');

  if (filteredRounds.length === 0) {
    select.innerHTML = '<option value="">-- Chưa có đợt tốt nghiệp --</option>';
  }
  if (toolbar) toolbar.classList.toggle('hidden', filteredRounds.length <= 1);
  return filteredRounds;
};

window.onSupervisorRoundSelected = async function(roundId) {
  if (!roundId) return;
  const lockedRoundId = (state.impersonation && state.impersonation.target && state.impersonation.target.roundId) || '';
  if (lockedRoundId && roundId !== lockedRoundId) {
    showToast('Phiên đóng vai đang bị khóa trong đợt tốt nghiệp này.', 'warning');
    return;
  }
  state.selectedRoundId = roundId;
  state.activeRound = (state.rounds || []).find(r => r.id === roundId) || null;
  await loadSupervisorPortalData(roundId);
};

window.loadSupervisorPortalData = async function(roundId) {
  if (!roundId) return;

  if (typeof ensureSupervisorsMasterLoaded === 'function') {
    try { await ensureSupervisorsMasterLoaded(); } catch (e) {}
  }
  if (typeof ensureFacultyDatasetLoaded === 'function') {
    try { await ensureFacultyDatasetLoaded(); } catch (e) {}
  }

  const actor = getEffectiveActor();
  const emailLower = (actor.email || '').toLowerCase().trim();
  const round = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;
  if (!round) return;
  state.selectedRoundId = roundId;
  state.activeRound = round;
  // Always reload roster for the selected round before matching the logged-in
  // teacher. `state.roundSupervisors` otherwise belongs to the previously
  // active round and produces a false "không tham gia đợt" notice.
  await loadRoundSupervisors(roundId);
  const isDirect = isDirectSupervisorAssignment(round);

  // 1. Locate current supervisor profile
  const matchingMaster = (state.supervisorsMaster || []).find(s =>
    (s.email || '').toLowerCase().trim() === emailLower ||
    (actor.uid && (s.id === actor.uid || s.supervisorId === actor.uid))
  );
  const supervisorIdentityIds = new Set([
    actor.uid,
    matchingMaster?.id,
    matchingMaster?.supervisorId
  ].filter(Boolean).map(value => String(value).trim()));
  const roundSupervisor = (state.roundSupervisors || []).find(s =>
    (s.email || '').toLowerCase().trim() === emailLower ||
    supervisorIdentityIds.has(String(s.id || '').trim()) ||
    supervisorIdentityIds.has(String(s.supervisorId || '').trim())
  );
  let currentSup = roundSupervisor;
  if (!currentSup) {
    currentSup = matchingMaster;
  }

  // Header and Hero Information
  const greetingEl = document.getElementById('supervisor-greeting-name');
  const roundInfoEl = document.getElementById('supervisor-round-info');
  const activeBadgeEl = document.getElementById('sup-active-round-badge');
  const reviewIndicator = document.getElementById('sup-round-review-indicator');

  const supDisplayName = currentSup?.name || actor.displayName || 'Thầy/Cô';
  if (greetingEl) greetingEl.textContent = `Kính chào Thầy/Cô ${supDisplayName}`;
  if (roundInfoEl) roundInfoEl.textContent = `Đợt: ${round.title} • Năm học ${round.academicYear || ''}`;
  if (activeBadgeEl) activeBadgeEl.textContent = round.roundName || round.title || 'Đợt ĐATN';

  // Update Hero Supervisor Profile Pill
  const supHeroName = document.getElementById('hero-supervisor-name');
  const supHeroEmail = document.getElementById('hero-supervisor-email');
  const supHeroAvatar = document.getElementById('hero-supervisor-avatar');
  if (supHeroName) supHeroName.textContent = supDisplayName;
  if (supHeroEmail) supHeroEmail.textContent = currentSup?.email || actor.email || '--';
  if (supHeroAvatar) {
    const photoUrl = currentSup?.photoUrl || actor.photoURL;
    supHeroAvatar.src = (photoUrl && photoUrl.trim()) ? photoUrl : getSupervisorAvatarSvgDataUri(supDisplayName);
  }

  const statusMap = {
    draft: 'Bản nháp',
    upcoming: 'Sắp mở đăng ký',
    open: 'Đang mở đăng ký',
    closed: 'Đã đóng đăng ký',
    reviewing: 'Đang xét nguyện vọng',
    finalized: 'Đã chốt phân công',
    published: 'Đã công bố'
  };
  if (reviewIndicator) {
    reviewIndicator.textContent = `Trạng thái: ${statusMap[round.status] || round.status || 'Đang thực hiện'}`;
  }

  // 2. Fetch all registrations for this round
  let allRegistrations = [];
  try {
    const regSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    allRegistrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[SupervisorPortal] Could not query registrations directly:', err);
    allRegistrations = round.registrations || [];
  }

  // Published official assignments are the independent source of truth.
  let publishedAssignments = [];
  try {
    const assignmentRef = collection(db, 'graduationRounds', roundId, 'officialAssignments');
    let assignmentSnap;
    try {
      const assignmentQuery = (actor.isAdmin && !emailLower)
        ? query(assignmentRef, where('assignmentStatus', '==', 'published'))
        : query(
            assignmentRef,
            where('assignmentStatus', '==', 'published'),
            where('supervisorEmails', 'array-contains', emailLower)
          );
      assignmentSnap = await getDocs(assignmentQuery);
    } catch (qErr) {
      console.warn('[SupervisorPortal] Specific query failed, attempting published status query:', qErr);
      try {
        assignmentSnap = await getDocs(query(assignmentRef, where('assignmentStatus', '==', 'published')));
      } catch (qErr2) {
        console.warn('[SupervisorPortal] Query published assignments by status failed, fallback to getDocs:', qErr2);
        assignmentSnap = await getDocs(assignmentRef);
      }
    }
    publishedAssignments = assignmentSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => !d.assignmentStatus || d.assignmentStatus === 'published');
  } catch (err) {
    console.warn('[SupervisorPortal] Could not query published official assignments:', err);
  }

  // 3. Fetch activities if not loaded
  let activities = Array.isArray(round.activities) ? round.activities : [];
  if (activities.length === 0) {
    try {
      const actSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'activities'));
      activities = actSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      round.activities = activities;
    } catch (e) {}
  }

  // 4. Identify Assigned Students for this supervisor
  // Fetch eligible students map for the round to exclude students deleted or ineligible
  let eligibleMap = new Map();
  let hasEligibleStudentsList = false;
  try {
    const elSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
    if (!elSnap.empty) {
      hasEligibleStudentsList = true;
      elSnap.docs.forEach(d => {
        const dData = d.data() || {};
        const key = String(d.id || dData.studentId || dData.mssv || '').trim().toUpperCase();
        if (key && dData.eligible !== false) {
          eligibleMap.set(key, true);
        }
      });
    }
  } catch (elErr) {
    console.warn('[SupervisorPortal] Could not query eligible students:', elErr);
  }

  const isStudentEligible = (stId) => {
    if (!hasEligibleStudentsList) return true;
    return eligibleMap.has(String(stId || '').trim().toUpperCase());
  };

  const mySupId = currentSup?.id || currentSup?.supervisorId;
  const currentSupName = (currentSup?.name || '').toLowerCase().trim();
  const registrationsById = new Map(allRegistrations.map(r => [String(r.studentId || r.id).trim().toUpperCase(), r]));

  const isAssignedToThisSupervisor = (item) => {
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(item) : [];
    if (officials.length > 0) {
      return officials.some(s => {
        if (mySupId && (s.supervisorId === mySupId || s.id === mySupId)) return true;
        if (emailLower && ((s.email && s.email.toLowerCase().trim() === emailLower) || (s.supervisorEmail && s.supervisorEmail.toLowerCase().trim() === emailLower))) return true;
        if (currentSupName && s.supervisorName && s.supervisorName.toLowerCase().trim() === currentSupName) return true;
        return false;
      });
    }
    if (mySupId && (item.acceptedSupervisorId === mySupId || item.finalSupervisorId === mySupId || item.supervisorId === mySupId)) return true;
    if (emailLower && ((item.supervisorEmail && item.supervisorEmail.toLowerCase().trim() === emailLower) || (Array.isArray(item.supervisorEmails) && item.supervisorEmails.map(e => (e||'').toLowerCase().trim()).includes(emailLower)))) return true;
    if (currentSupName && ((item.acceptedSupervisorName && item.acceptedSupervisorName.toLowerCase().trim() === currentSupName) || (item.supervisorName && item.supervisorName.toLowerCase().trim() === currentSupName))) return true;
    return false;
  };

  const assignedFromOfficial = publishedAssignments
    .map(assignment => {
      const studentId = String(assignment.studentId || assignment.id).trim().toUpperCase();
      const facStudent = (typeof window.getFacultyStudentByMssv === 'function') ? window.getFacultyStudentByMssv(studentId) : null;
      const normalized = normalizeOfficialAssignment(assignment, registrationsById.get(studentId) || null);
      if (facStudent && (!normalized.studentName || normalized.studentName === studentId || normalized.studentName.startsWith('Sinh viên '))) {
        normalized.studentName = facStudent.fullName || facStudent.name || normalized.studentName;
      }
      if (facStudent && (!normalized.className || normalized.className === '--')) {
        normalized.className = facStudent.className || facStudent.studentClass || normalized.className;
      }
      if (facStudent && (!normalized.major || normalized.major === 'Mỹ thuật Công nghiệp')) {
        normalized.major = facStudent.major || facStudent.majorName || normalized.major;
      }
      return normalized;
    })
    .filter(item => {
      const studentId = String(item.studentId || item.id).trim().toUpperCase();
      if (!isStudentEligible(studentId)) return false;
      if (currentSup || mySupId) {
        return isAssignedToThisSupervisor(item);
      }
      return true;
    });

  const legacyAssigned = (round.status === 'published' || round.reviewStatus === 'completed') ? allRegistrations.map(r => {
    const studentId = String(r.studentId || r.id).trim().toUpperCase();
    const facStudent = (typeof window.getFacultyStudentByMssv === 'function') ? window.getFacultyStudentByMssv(studentId) : null;
    const item = { ...r };
    if (facStudent && (!item.studentName || item.studentName === studentId || item.studentName.startsWith('Sinh viên '))) {
      item.studentName = facStudent.fullName || facStudent.name || item.studentName;
    }
    if (facStudent && (!item.className || item.className === '--')) {
      item.className = facStudent.className || facStudent.studentClass || item.className;
    }
    return item;
  }).filter(r => {
    const studentId = String(r.studentId || r.id).trim().toUpperCase();
    if (!isStudentEligible(studentId)) return false;
    if (currentSup || mySupId) {
      return isAssignedToThisSupervisor(r);
    }
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(r) : [];
    return officials.length > 0 || r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned';
  }) : [];

  const assignedMap = new Map();
  [...assignedFromOfficial, ...legacyAssigned].forEach(item => {
    const key = String(item.studentId || item.id).trim().toUpperCase();
    if (key && !assignedMap.has(key) && isStudentEligible(key)) assignedMap.set(key, item);
  });
  const assigned = [...assignedMap.values()];

  // Admin fallback: ONLY if pure admin who is NOT in the supervisor roster at all and has zero personal assignments
  let displayStudents = assigned;
  if (actor.isAdmin && !currentSup && assigned.length === 0) {
    displayStudents = [...assignedMap.values()];
    if (displayStudents.length === 0 && (round.status === 'published' || round.reviewStatus === 'completed')) displayStudents = allRegistrations.filter(r => {
      const studentId = String(r.studentId || r.id).trim().toUpperCase();
      if (!isStudentEligible(studentId)) return false;
      const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(r) : [];
      return officials.length > 0 || r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned';
    });
  }

  state.supervisorAssignedStudents = displayStudents;

  // 5. Compute Hero Stats
  const totalAssignedCount = displayStudents.length;
  const statAssignedEl = document.getElementById('sup-stat-assigned-total');
  if (statAssignedEl) statAssignedEl.textContent = totalAssignedCount;

  const quota = currentSup?.quota || currentSup?.capacity || (actor.isAdmin ? displayStudents.length : 10);
  let primaryCount = 0;
  let supportCount = 0;
  let pendingCount = 0;

  displayStudents.forEach(st => {
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : [];
    const isPrimary = officials.some(s => {
      const isMe = (mySupId && (s.supervisorId === mySupId || s.id === mySupId)) ||
        (s.email && s.email.toLowerCase().trim() === emailLower) ||
        (s.supervisorEmail && s.supervisorEmail.toLowerCase().trim() === emailLower);
      return (isMe || actor.isAdmin) && s.role === 'primary';
    });
    if (isPrimary) primaryCount++;
    else supportCount++;

    // Check if score is pending
    const sc = round.supervisorScores?.[st.studentId || st.id];
    if (!sc || sc.status !== 'completed') {
      pendingCount++;
    }
  });

  const setElVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setElVal('sup-stat-total-cap', quota);
  setElVal('sup-stat-primary-count', primaryCount);
  setElVal('sup-stat-support-count', supportCount);
  setElVal('sup-stat-pending-count', pendingCount);

  // Update tabs badges
  const assignedBadge = document.getElementById('sup-assigned-count-badge');
  if (assignedBadge) assignedBadge.textContent = displayStudents.length;

  // 6. Manage Supervisor Tabs Visibility & Default Selection
  const tabAssignedBtn = document.getElementById('sup-tab-btn-assigned');
  const tabReviewBtn = document.getElementById('sup-tab-btn-review');
  const tabAcceptedBtn = document.getElementById('sup-tab-btn-accepted');
  const tabPrelimBtn = document.getElementById('sup-tab-btn-preliminary');
  const tabReviewerBtn = document.getElementById('sup-tab-btn-reviewer');

  // Direct-assignment rounds do not use preference review or accepted-preference lists.
  if (tabReviewBtn) tabReviewBtn.classList.toggle('hidden', isDirect);
  if (tabAcceptedBtn) tabAcceptedBtn.classList.toggle('hidden', isDirect);
  // Preliminary and reviewer scoring live exclusively in the Assessment portal.
  if (tabPrelimBtn) tabPrelimBtn.classList.add('hidden');
  if (tabReviewerBtn) tabReviewerBtn.classList.add('hidden');
  if (tabAssignedBtn) tabAssignedBtn.classList.remove('hidden');

  let defaultTab = 'assigned';

  // Requirement 6: If GVHD is not assigned to supervise in this round, show notification and hide action menus
  const notAssignedAlert = document.getElementById('supervisor-not-assigned-alert');
  const subTabsContainer = document.getElementById('supervisor-sub-tabs-container');
  const assignedPanel = document.getElementById('sup-panel-assigned');

  // A supervisor in the roster is participating in the round even before a
  // student is assigned. Show the normal empty list instead of an access-like
  // warning in that case.
  const hasSupervisorDuties = actor.isAdmin || Boolean(roundSupervisor) || totalAssignedCount > 0;

  if (!hasSupervisorDuties) {
    document.getElementById('supervisor-round-timeline')?.classList.add('hidden');
    document.getElementById('supervisor-plan-section')?.classList.add('hidden');
    if (notAssignedAlert) notAssignedAlert.classList.remove('hidden');
    if (subTabsContainer) subTabsContainer.classList.add('hidden');
    if (assignedPanel) assignedPanel.classList.add('hidden');
    const reviewPanel = document.getElementById('sup-panel-review');
    if (reviewPanel) reviewPanel.classList.add('hidden');
    const acceptedPanel = document.getElementById('sup-panel-accepted');
    if (acceptedPanel) acceptedPanel.classList.add('hidden');
  } else {
    renderSupervisorRoundTimeline(round);
    renderSupervisorPlanList(round);
    if (notAssignedAlert) notAssignedAlert.classList.add('hidden');
    if (subTabsContainer) subTabsContainer.classList.remove('hidden');

    // In preference-based rounds, a participating GVHD with no assigned
    // students is normally waiting to review NV1/NV2/NV3 applications. Load
    // candidates first and focus the review tab so that work is immediately
    // visible rather than presenting an empty guidance list.
    if (!isDirect) {
      await loadSupervisorReviewData(roundId);
      if (totalAssignedCount === 0) defaultTab = 'review';
    }

    // Switch to the appropriate default tab if current tab is hidden
    const currentTab = defaultTab === 'review' ? 'review' : (state.currentSupervisorTab || defaultTab);
    const currentBtn = document.getElementById(`sup-tab-btn-${currentTab}`);
    if (!currentBtn || currentBtn.classList.contains('hidden')) {
      switchSupervisorTab(defaultTab);
    } else {
      switchSupervisorTab(currentTab);
    }

    // Render assigned students list
    renderSupervisorAssignedStudents();
  }
};

window.renderSupervisorAssignedStudents = function() {
  const container = document.getElementById('supervisor-students-list');
  const emptyCard = document.getElementById('supervisor-students-empty');
  if (!container) return;

  const round = state.activeRound;
  const actor = getEffectiveActor();
  const emailLower = (actor.email || '').toLowerCase().trim();
  const currentSup = (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower) ||
    (state.supervisorsMaster || []).find(s => (s.email || '').toLowerCase().trim() === emailLower);
  const mySupId = currentSup?.id || currentSup?.supervisorId;

  const all = state.supervisorAssignedStudents || [];
  const searchTerm = (document.getElementById('supervisor-student-search')?.value || '').toLowerCase().trim();
  const filterKey = state.supervisorStudentFilter || 'all';

  // Update filter counters
  let cntPending = 0;
  let cntInProgress = 0;
  let cntCompleted = 0;
  let cntPrimary = 0;
  let cntSupport = 0;

  all.forEach(st => {
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : [];
    const isPrimary = officials.some(s => {
      const isMe = (mySupId && (s.supervisorId === mySupId || s.id === mySupId)) ||
        (s.email && s.email.toLowerCase().trim() === emailLower) ||
        (s.supervisorEmail && s.supervisorEmail.toLowerCase().trim() === emailLower);
      return (isMe || actor.isAdmin) && s.role === 'primary';
    });
    if (isPrimary) cntPrimary++;
    else cntSupport++;

    const sc = round?.supervisorScores?.[st.studentId || st.id];
    if (sc?.status === 'completed') cntCompleted++;
    else if (sc?.status === 'draft') cntInProgress++;
    else cntPending++;
  });

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('sup-cnt-all', all.length);
  setEl('sup-cnt-pending', cntPending);
  setEl('sup-cnt-in_progress', cntInProgress);
  setEl('sup-cnt-completed', cntCompleted);
  setEl('sup-cnt-primary', cntPrimary);
  setEl('sup-cnt-support', cntSupport);

  // Filter list
  const filtered = all.filter(st => {
    const studentId = st.studentId || st.id || '';
    const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(studentId) : null;
    const name = st.studentName || studentObj?.fullName || studentObj?.name || studentId;
    const topic = st.topicTitle || '';

    // Search query
    if (searchTerm) {
      const matchQuery = studentId.toLowerCase().includes(searchTerm) ||
        name.toLowerCase().includes(searchTerm) ||
        topic.toLowerCase().includes(searchTerm);
      if (!matchQuery) return false;
    }

    // Filter pill
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : [];
    const isPrimary = officials.some(s => {
      const isMe = (mySupId && (s.supervisorId === mySupId || s.id === mySupId)) ||
        (s.email && s.email.toLowerCase().trim() === emailLower) ||
        (s.supervisorEmail && s.supervisorEmail.toLowerCase().trim() === emailLower);
      return (isMe || state.isAdmin) && s.role === 'primary';
    });

    const sc = round?.supervisorScores?.[studentId];
    if (filterKey === 'primary') return isPrimary;
    if (filterKey === 'support') return !isPrimary;
    if (filterKey === 'completed') return sc?.status === 'completed';
    if (filterKey === 'in_progress') return sc?.status === 'draft';
    if (filterKey === 'pending') return !sc || sc.status !== 'completed';
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyCard) emptyCard.classList.remove('hidden');
    return;
  }

  if (emptyCard) emptyCard.classList.add('hidden');

  // Render 1 Student = 1 Horizontal Card (IFAA Style)
  container.innerHTML = filtered.map(st => {
    const studentId = st.studentId || st.id || '';
    const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(studentId) : null;
    const name = st.studentName || studentObj?.fullName || studentObj?.name || `Sinh viên ${studentId}`;
    const className = st.currentClass || st.studentClass || st.className || studentObj?.className || studentObj?.studentClass || '--';
    const major = st.major || studentObj?.major || 'Mỹ thuật Công nghiệp';
    const hasRegistration = Boolean(st.topicTitle);
    const topicTitle = st.topicTitle || 'Chưa đăng ký đề tài';
    const projectType = st.projectType || '--';
    const topicApprovalStatus = st.topicApprovalStatus || 'pending';
    const topicVersion = Number(st.topicTitleVersion || 1);
    const topicApprovalBadge = topicApprovalStatus === 'approved'
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">✓ Tên đề tài đã duyệt</span>'
      : topicApprovalStatus === 'rejected'
        ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">✕ Yêu cầu chỉnh sửa</span>'
        : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">⌛ Chờ duyệt tên đề tài</span>';

    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : [];
    const isPrimary = officials.some(s => {
      const isMe = (mySupId && (s.supervisorId === mySupId || s.id === mySupId)) ||
        (s.email && s.email.toLowerCase().trim() === emailLower) ||
        (s.supervisorEmail && s.supervisorEmail.toLowerCase().trim() === emailLower);
      return (isMe || state.isAdmin) && s.role === 'primary';
    });

    const roleBadge = isPrimary
      ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">GVHD chính</span>'
      : '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">GVHD 2</span>';

    // Next milestone & submission check
    const activities = Array.isArray(round?.activities) ? round.activities : [];
    const subActs = activities.filter(a => a.submissionEnabled);
    let submissionStatusStr = 'Chưa có mốc nộp bài';
    if (subActs.length > 0) {
      const latestAct = subActs[0];
      const rules = (typeof getEffectiveSubmissionRules === 'function') ? getEffectiveSubmissionRules(studentId, latestAct, round) : null;
      if (rules?.currentSubmission) {
        submissionStatusStr = `<span class="text-emerald-700 font-bold">✓ Đã nộp: ${latestAct.title}</span>`;
      } else {
        submissionStatusStr = `<span class="text-slate-500">Chưa nộp ${latestAct.title}</span>`;
      }
    }

    const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23cbd5e1'/%3E%3Cpath fill='%23cbd5e1' d='M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z'/%3E%3C/svg%3E";
    const studentAvatarUrl = st.photoURL || studentObj?.photoURL || studentObj?.avatar || defaultAvatar;

    return `
      <div class="card-surface p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 hover:border-tdtu-blue/40 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <!-- Left: Student Info & Role -->
        <div class="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <img src="${studentAvatarUrl}" class="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0" alt="Avatar">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              ${roleBadge}
              ${!hasRegistration ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Chưa đăng ký đề tài</span>' : ''}
              <span class="font-mono text-xs font-bold text-tdtu-blue bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">${studentId}</span>
              <span class="text-slate-400 text-xs hidden sm:inline">•</span>
              <span class="text-xs text-slate-500 font-medium truncate">Lớp: ${className}</span>
            </div>
            <h3 class="text-sm sm:text-base font-black text-slate-900 leading-snug truncate">${name}</h3>
            <p class="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
              <strong class="text-slate-700">Đề tài:</strong>
              <span class="font-semibold text-slate-900">${topicTitle}</span>
            </p>
            <div class="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-500">
              ${hasRegistration ? topicApprovalBadge : ''}
              ${hasRegistration ? `<span>Phiên bản ${topicVersion}</span><span>•</span>` : ''}
              <span>Loại hình: <b class="text-slate-700">${projectType}</b></span>
              <span>•</span>
              <span>${submissionStatusStr}</span>
            </div>
          </div>
        </div>

        <!-- Right: Guidance actions only; scoring belongs to the Assessment portal. -->
        <div class="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <button type="button" onclick="openSupervisorStudentDetailModal('${studentId}')" class="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer" title="Xem thông tin chi tiết">
              📋 Xem hồ sơ
            </button>
            <button type="button" onclick="openSupervisorStudentDetailModal('${studentId}', 'progress')" class="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer" title="Xem tiến độ và mốc kế hoạch">
              📅 Tiến độ
            </button>
            ${hasRegistration ? (
              topicApprovalStatus === 'approved'
                ? `<button type="button" onclick="openTopicRegistrationPreviewModal('${studentId}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer" title="Xem phiếu đăng ký và trạng thái đã duyệt">
                    <span>✓</span> <span>Đã duyệt đề tài</span>
                  </button>`
                : `<button type="button" onclick="openTopicRegistrationPreviewModal('${studentId}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer" title="Xem phiếu đăng ký và duyệt tên đề tài">
                    <span>📝</span> <span>Duyệt đề tài</span>
                  </button>`
            ) : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.saveStudentSelfProfile = async function() {
  if (!checkImpersonationWriteGuard('Cập nhật thông tin sinh viên')) return;
  const identity = getRegistrationStudentIdentity();
  const currentClass = (document.getElementById('profile-current-class')?.value || '').trim();
  const personalEmail = (document.getElementById('profile-personal-email')?.value || '').trim();
  const phone = (document.getElementById('profile-student-phone')?.value || '').trim();
  const permanentAddress = (document.getElementById('profile-student-permanent-address')?.value || '').trim();
  const temporaryAddress = (document.getElementById('profile-student-temporary-address')?.value || '').trim();
  if (!currentClass || !personalEmail || !phone || !permanentAddress || !temporaryAddress) {
    showToast('Vui lòng nhập đầy đủ lớp, email cá nhân, điện thoại, địa chỉ thường trú và địa chỉ tạm trú.', 'warning');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
    showToast('Email cá nhân chưa đúng định dạng.', 'warning');
    return;
  }
  try {
    const payload = {
      studentId: identity.mssv,
      email: identity.email,
      currentClass,
      personalEmail,
      phone,
      permanentAddress,
      temporaryAddress,
      address: temporaryAddress,
      updatedAt: serverTimestamp(),
      updatedBy: getEffectiveActor().email || identity.email
    };
    await setDoc(doc(db, 'graduationStudentProfiles', identity.mssv), payload, { merge: true });
    if (state.myRegistration && state.selectedRoundId) {
      await updateDoc(doc(db, 'graduationRounds', state.selectedRoundId, 'registrations', identity.mssv), {
        currentClass,
        personalEmail,
        studentPhone: phone,
        studentPermanentAddress: permanentAddress,
        studentTemporaryAddress: temporaryAddress,
        studentAddress: temporaryAddress,
        updatedAt: serverTimestamp()
      });
      Object.assign(state.myRegistration, {
        currentClass, personalEmail, studentPhone: phone,
        studentPermanentAddress: permanentAddress,
        studentTemporaryAddress: temporaryAddress,
        studentAddress: temporaryAddress
      });
    }
    state.studentSelfProfile = { ...(state.studentSelfProfile || {}), ...payload };
    updateStudentPersonalSidebar();
    populateRegistrationStudentForm();
    showToast('Đã cập nhật thông tin sinh viên.', 'success');
  } catch (err) {
    console.error('Save student self profile failed:', err);
    showToast('Không thể lưu thông tin sinh viên: ' + err.message, 'error');
  }
};

window.reviewStudentTopicTitle = async function(studentId, decision) {
  if (!checkImpersonationWriteGuard('Duyệt tên đề tài')) return;
  const registration = (state.supervisorAssignedStudents || []).find(st => (st.studentId || st.id) === studentId);
  const roundId = state.selectedRoundId || state.activeRound?.id;
  if (!registration?.topicTitle || !roundId) return;

  if (decision === 'approved') {
    const requiredOfficialFields = ['currentClass', 'personalEmail', 'studentPhone', 'studentPermanentAddress', 'studentTemporaryAddress', 'courseName', 'courseCode', 'courseGroup', 'topicDescription'];
    const missingOfficialFields = requiredOfficialFields.filter(key => !String(registration[key] || '').trim());
    if (missingOfficialFields.length > 0) {
      showToast('Sinh viên chưa hoàn thiện đủ thông tin Phiếu đăng ký chính thức. Chưa thể xác nhận.', 'warning');
      return;
    }
  }

  let note = '';
  if (decision === 'rejected') {
    note = await showInputDialog('Yêu cầu chỉnh sửa đề tài', 'Nhập lý do hoặc nội dung cần sinh viên chỉnh sửa:', { defaultValue: registration.topicApprovalNote || '', confirmText: 'Gửi yêu cầu', required: true });
    if (note === null) return;
    if (!note.trim()) {
      showToast('Vui lòng nhập lý do khi không duyệt tên đề tài.', 'warning');
      return;
    }
  } else if (!await showConfirm('Duyệt tên đề tài', `Duyệt tên đề tài “${registration.topicTitle}”?`, { confirmText: 'Duyệt đề tài', danger: false })) {
    return;
  }

  const actor = getEffectiveActor();
  const version = Number(registration.topicTitleVersion || 1);
  const history = Array.isArray(registration.topicTitleHistory) ? [...registration.topicTitleHistory] : [];
  const idx = history.findIndex(item => Number(item.version) === version);
  const reviewedEntry = {
    ...(idx >= 0 ? history[idx] : { version, title: registration.topicTitle, submittedAt: new Date().toISOString() }),
    status: decision,
    reviewedAt: new Date().toISOString(),
    reviewedBy: actor?.email || state.user?.email || '',
    note: note.trim()
  };
  if (idx >= 0) history[idx] = reviewedEntry; else history.push(reviewedEntry);

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId, 'registrations', studentId), {
      topicApprovalStatus: decision,
      topicApprovalNote: note.trim(),
      topicReviewedAt: serverTimestamp(),
      topicReviewedBy: actor?.email || state.user?.email || '',
      topicTitleHistory: history,
      updatedAt: serverTimestamp()
    });
    registration.topicApprovalStatus = decision;
    registration.topicApprovalNote = note.trim();
    registration.topicTitleHistory = history;
    renderSupervisorAssignedStudents();
    showToast(decision === 'approved' ? 'Đã duyệt tên đề tài.' : 'Đã gửi yêu cầu sinh viên chỉnh sửa tên đề tài.', 'success');
  } catch (err) {
    console.error('Topic title review failed:', err);
    showToast('Không thể lưu quyết định duyệt: ' + err.message, 'error');
  }
};


window.openTopicRegistrationPreviewModal = function(studentId = null) {
  const modal = document.getElementById('modal-supervisor-topic-preview');
  if (!modal) return;

  const round = state.activeRound || {};
  let st = null;
  let identity = null;
  let isStudentViewer = false;

  if (!studentId || (typeof studentId === 'string' && studentId === state.myRegistration?.studentId && state.currentRole === 'student')) {
    st = state.myRegistration;
    identity = (typeof getRegistrationStudentIdentity === 'function') ? getRegistrationStudentIdentity() : null;
    studentId = identity?.mssv || st?.studentId || st?.mssv;
    isStudentViewer = true;
  } else {
    st = (state.supervisorAssignedStudents || []).find(s => (s.studentId || s.id) === studentId) ||
      (typeof findStudentInRound === 'function' ? findStudentInRound(studentId) : null);
    isStudentViewer = (state.currentRole === 'student') && (!state.isAdmin);
  }

  if (!st) {
    showToast('Không tìm thấy thông tin đăng ký của sinh viên.', 'warning');
    return;
  }

  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(studentId) : null;
  const fullName = st?.studentName || studentObj?.fullName || studentObj?.name || identity?.fullName || studentId;
  const className = st?.currentClass || st?.studentClass || st?.className || studentObj?.className || studentObj?.studentClass || '--';
  const major = st?.major || studentObj?.major || identity?.major || 'Thiết kế nội thất';
  const personalEmail = st?.personalEmail || st?.email || studentObj?.email || identity?.email || '--';
  const phone = st?.studentPhone || studentObj?.phone || '--';
  const address = (typeof getCleanRegistrationAddress === 'function') ? getCleanRegistrationAddress(st, studentObj) : (st?.address || '--');
  const courseName = st?.courseName || 'Đồ án tốt nghiệp';
  const courseCode = st?.courseCode || '--';
  const courseGroup = st?.courseGroup || '--';
  const version = Number(st?.topicTitleVersion || 1);
  const topicTitle = st?.topicTitle || 'Chưa đăng ký đề tài';
  const topicDescription = st?.topicDescription || '(Chưa có mô tả định hướng thiết kế)';
  const status = st?.topicApprovalStatus || 'pending';

  const roundLabel = round.title || round.roundName || 'ĐỒ ÁN TỐT NGHIỆP';
  const normalizedRoundLabel = roundLabel.toUpperCase().replace(/\s+/g, ' ').trim();
  const roundHeadingMatch = normalizedRoundLabel.match(/^(.*?)(?:\s*-\s*)?(ĐỢT\s+.+)$/);
  const programHeading = roundHeadingMatch?.[1] || normalizedRoundLabel;
  const roundHeading = roundHeadingMatch?.[2] || (round.roundName ? (String(round.roundName).toUpperCase().startsWith('ĐỢT') ? round.roundName.toUpperCase() : `ĐỢT ${round.roundName.toUpperCase()}`) : '');

  const approvedDate = st?.topicReviewedAt?.toDate ? st.topicReviewedAt.toDate() : (st?.topicReviewedAt ? new Date(st.topicReviewedAt) : new Date());
  const dd = String(approvedDate.getDate()).padStart(2, '0');
  const mm = String(approvedDate.getMonth() + 1).padStart(2, '0');
  const yyyy = approvedDate.getFullYear();

  // Header info
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    const filled = Boolean(String(val || '').trim() && String(val).trim() !== '--');
    el.textContent = filled ? val : (id === 'topic-preview-doc-round' ? '' : '--');
    if (el.tagName === 'TD') el.classList.toggle('has-value', filled);
  };
  setEl('topic-preview-student-name', fullName);
  setEl('topic-preview-mssv', studentId);
  setEl('topic-preview-round-name', roundLabel);

  // Doc info
  setEl('topic-preview-doc-program', programHeading);
  setEl('topic-preview-doc-round', roundHeading);
  setEl('topic-preview-doc-name', fullName);
  setEl('topic-preview-doc-mssv', studentId);
  setEl('topic-preview-doc-class', className);
  setEl('topic-preview-doc-major', major);
  setEl('topic-preview-doc-email', personalEmail);
  setEl('topic-preview-doc-phone', phone);
  setEl('topic-preview-doc-address', address);
  setEl('topic-preview-doc-course', courseName);
  setEl('topic-preview-doc-code', courseCode);
  setEl('topic-preview-doc-group', courseGroup);
  setEl('topic-preview-doc-version', `Đăng ký đề tài chính thức lần thứ : ${version}`);
  setEl('topic-preview-doc-title', topicTitle);
  setEl('topic-preview-doc-description', topicDescription);
  setEl('topic-preview-doc-sign-student', fullName);
  setEl('topic-preview-doc-date', `Tp.HCM, ngày ${dd} tháng ${mm} năm ${yyyy}`);

  // Supervisor info
  const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : [];
  const primary = officials.find(s => s.role === 'primary') || officials[0];
  const supName = primary?.supervisorName || st.acceptedSupervisorName || 'Giảng viên Hướng dẫn';
  setEl('topic-preview-doc-sup-name', supName);

  // Status badge & sup status in document
  const badgeEl = document.getElementById('topic-preview-status-badge');
  const docSupStatusEl = document.getElementById('topic-preview-doc-sup-status');
  const footerNoteEl = document.getElementById('topic-preview-footer-note');
  const btnApprove = document.getElementById('btn-topic-preview-approve');
  const btnReject = document.getElementById('btn-topic-preview-reject');
  const btnStudentEdit = document.getElementById('btn-topic-preview-student-edit');

  // Role-based button visibility
  if (btnStudentEdit) {
    btnStudentEdit.classList.toggle('hidden', !isStudentViewer);
  }

  if (status === 'approved') {
    if (badgeEl) {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
      badgeEl.textContent = '✓ Đã duyệt đề tài';
    }
    if (docSupStatusEl) {
      docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-emerald-700 italic';
      docSupStatusEl.textContent = '✓ Đã duyệt đề tài';
    }
    if (footerNoteEl) {
      footerNoteEl.textContent = isStudentViewer
        ? `Tên đề tài của bạn đã được GVHD phê duyệt${st.topicReviewedAt ? ' lúc ' + fmtIsoToVietnameseDateTime(st.topicReviewedAt) : ''}.`
        : `Tên đề tài đã được GVHD phê duyệt${st.topicReviewedAt ? ' lúc ' + fmtIsoToVietnameseDateTime(st.topicReviewedAt) : ''}.`;
    }
    if (btnApprove) btnApprove.classList.add('hidden');
    if (btnReject) {
      if (isStudentViewer) {
        btnReject.classList.add('hidden');
      } else {
        btnReject.classList.remove('hidden');
        btnReject.innerHTML = '<span>🔄</span> <span>Yêu cầu sửa lại</span>';
      }
    }
  } else if (status === 'rejected') {
    if (badgeEl) {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300';
      badgeEl.textContent = '✕ Yêu cầu chỉnh sửa';
    }
    if (docSupStatusEl) {
      docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-rose-700 italic';
      docSupStatusEl.textContent = `✕ Yêu cầu chỉnh sửa: ${st.topicApprovalNote || ''}`;
    }
    if (footerNoteEl) {
      footerNoteEl.textContent = isStudentViewer
        ? `GVHD yêu cầu chỉnh sửa: "${st.topicApprovalNote || ''}". Vui lòng sửa lại tên đề tài.`
        : `Đã yêu cầu sinh viên chỉnh sửa: "${st.topicApprovalNote || ''}".`;
    }
    if (btnApprove) {
      if (isStudentViewer) {
        btnApprove.classList.add('hidden');
      } else {
        btnApprove.classList.remove('hidden');
        btnApprove.innerHTML = '<span>✓</span> <span>Duyệt tên đề tài</span>';
      }
    }
    if (btnReject) btnReject.classList.add('hidden');
  } else {
    if (badgeEl) {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300';
      badgeEl.textContent = '⌛ Chờ duyệt tên đề tài';
    }
    if (docSupStatusEl) {
      docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-amber-700 italic';
      docSupStatusEl.textContent = '(Chờ GVHD xem xét & ký duyệt)';
    }
    if (footerNoteEl) {
      footerNoteEl.textContent = isStudentViewer
        ? 'Phiếu đăng ký đang chờ GVHD xem xét & ký duyệt chính thức.'
        : 'GVHD xem xét nội dung phiếu đăng ký và xác nhận duyệt hoặc yêu cầu chỉnh sửa.';
    }
    if (btnApprove) {
      if (isStudentViewer) {
        btnApprove.classList.add('hidden');
      } else {
        btnApprove.classList.remove('hidden');
        btnApprove.innerHTML = '<span>✓</span> <span>Duyệt tên đề tài</span>';
      }
    }
    if (btnReject) {
      if (isStudentViewer) {
        btnReject.classList.add('hidden');
      } else {
        btnReject.classList.remove('hidden');
        btnReject.innerHTML = '<span>✕</span> <span>Không duyệt (Yêu cầu sửa)</span>';
      }
    }
  }

  // Bind actions
  if (btnApprove && !isStudentViewer) {
    btnApprove.onclick = async () => {
      await window.reviewStudentTopicTitle(studentId, 'approved');
      window.openTopicRegistrationPreviewModal(studentId);
    };
  }
  if (btnReject && !isStudentViewer) {
    btnReject.onclick = async () => {
      await window.reviewStudentTopicTitle(studentId, 'rejected');
      window.openTopicRegistrationPreviewModal(studentId);
    };
  }

  const btnPdf = document.getElementById('btn-topic-preview-download-pdf');
  if (btnPdf) {
    btnPdf.onclick = () => {
      window.printOfficialTopicRegistrationPaper(studentId);
    };
  }

  modal.classList.remove('hidden');
};

window.closeTopicRegistrationPreviewModal = function() {
  const modal = document.getElementById('modal-supervisor-topic-preview');
  if (modal) modal.classList.add('hidden');
};


window.setSupervisorStudentFilter = function(filterKey) {
  state.supervisorStudentFilter = filterKey;

  const btnIds = ['all', 'pending', 'in_progress', 'completed', 'primary', 'support'];
  btnIds.forEach(k => {
    const btn = document.getElementById('sup-flt-' + k);
    if (!btn) return;
    if (k === filterKey) {
      btn.className = 'px-3 py-1.5 rounded-xl font-bold bg-tdtu-blue text-white shadow-xs cursor-pointer';
    } else {
      btn.className = 'px-3 py-1.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer';
    }
  });

  renderSupervisorAssignedStudents();
};

window.switchSupervisorTab = function(tabName) {
  state.currentSupervisorTab = tabName;
  const isDirect = isDirectSupervisorAssignment(state.activeRound);
  const tabs = {
    assigned: ['sup-tab-btn-assigned', 'sup-panel-assigned'],
    review: ['sup-tab-btn-review', 'sup-panel-review'],
    accepted: ['sup-tab-btn-accepted', 'sup-panel-accepted'],
    preliminary: ['sup-tab-btn-preliminary', 'sup-panel-preliminary'],
    reviewer: ['sup-tab-btn-reviewer', 'sup-panel-reviewer']
  };

  Object.entries(tabs).forEach(([k, [btnId, panelId]]) => {
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    const isTarget = (k === tabName);

    if (btn) {
      if (isDirect && (k === 'review' || k === 'accepted')) {
        btn.classList.add('hidden');
        if (panel) panel.classList.add('hidden');
        return;
      }
      if (isTarget) {
        btn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-white bg-tdtu-blue shadow-sm transition-all cursor-pointer';
      } else {
        btn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer';
      }
    }
    if (panel) {
      if (isTarget) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });

  if (tabName === 'preliminary' && typeof renderSupervisorPreliminaryList === 'function') {
    renderSupervisorPreliminaryList();
  }
  if (tabName === 'reviewer' && typeof renderSupervisorReviewerList === 'function') {
    renderSupervisorReviewerList();
  }
};

window.openSupervisorStudentDetailModal = function(studentId, focusSection = null) {
  const modal = document.getElementById('supervisor-student-detail-modal');
  if (!modal) return;

  const round = state.activeRound;
  const st = (state.supervisorAssignedStudents || []).find(s => (s.studentId || s.id) === studentId) ||
    findStudentInRound(studentId);
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(studentId) : null;

  const fullName = st?.studentName || studentObj?.fullName || studentObj?.name || studentId;
  const className = st?.currentClass || st?.studentClass || st?.className || studentObj?.className || studentObj?.studentClass || '--';
  const major = st?.major || studentObj?.major || 'Mỹ thuật Công nghiệp';

  document.getElementById('dtl-mssv').textContent = studentId;
  document.getElementById('dtl-full-name').textContent = fullName;
  document.getElementById('dtl-class-major').textContent = `Lớp: ${className} • Ngành: ${major}`;
  document.getElementById('dtl-topic-title').textContent = st?.topicTitle || 'Chưa cập nhật tên đề tài';
  document.getElementById('dtl-project-type').textContent = `Loại hình: ${st?.projectType || '--'}`;
  const officialFormInfo = document.getElementById('dtl-official-form-info');
  if (officialFormInfo) {
    const rows = [
      ['Lớp', st?.currentClass], ['Ngành', st?.major], ['Email cá nhân', st?.personalEmail], ['Điện thoại', st?.studentPhone],
      ['Địa chỉ thường trú', st?.studentPermanentAddress], ['Địa chỉ tạm trú', st?.studentTemporaryAddress || st?.studentAddress],
      ['Môn học', st?.courseName], ['Mã môn / Nhóm', [st?.courseCode, st?.courseGroup].filter(Boolean).join(' / ')],
      ['Đăng ký lần', st?.topicTitleVersion || 1], ['Mô tả định hướng', st?.topicDescription]
    ];
    officialFormInfo.innerHTML = rows.map(([label, value]) => `
      <div class="${label === 'Mô tả định hướng' || label.startsWith('Địa chỉ') ? 'sm:col-span-2' : ''}">
        <span class="text-slate-400 block">${label}</span>
        <span class="font-semibold text-slate-800 whitespace-pre-wrap">${escapeHtml(value || '--')}</span>
      </div>
    `).join('');
  }

  const dateStr = st?.submittedAt ? (st.submittedAt.toDate ? st.submittedAt.toDate() : new Date(st.submittedAt)).toLocaleString('vi-VN') : '--';
  document.getElementById('dtl-registered-time').textContent = `Đăng ký ngày: ${dateStr}`;

  // Supervisors List
  const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : [];
  const supsListEl = document.getElementById('dtl-supervisors-list');
  if (supsListEl) {
    if (officials.length > 0) {
      supsListEl.innerHTML = officials.map(s => `
        <div class="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-2.5">
          <span class="text-xl">👨‍🏫</span>
          <div>
            <span class="font-bold text-slate-800 text-xs block">${s.supervisorName || 'Giảng viên Hướng dẫn'}</span>
            <span class="text-[10px] ${s.role === 'primary' ? 'text-emerald-700 font-bold' : 'text-indigo-700'} uppercase">${s.role === 'primary' ? 'GVHD chính' : 'GVHD 2'}</span>
          </div>
        </div>
      `).join('');
    } else {
      supsListEl.innerHTML = '<div class="p-3 text-slate-400 italic">Chưa có thông tin phân công chính thức.</div>';
    }
  }

  // Milestones Timeline
  const milestonesEl = document.getElementById('dtl-milestones-list');
  const activities = Array.isArray(round?.activities) ? round.activities : [];
  if (milestonesEl) {
    if (activities.length > 0) {
      milestonesEl.innerHTML = activities.map((act, idx) => {
        const rules = (typeof getEffectiveSubmissionRules === 'function') ? getEffectiveSubmissionRules(studentId, act, round) : null;
        let stBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Chưa nộp</span>';
        if (rules?.currentSubmission) {
          stBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ Đã nộp bài</span>';
        }
        return `
          <div class="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">${idx + 1}</span>
              <span class="font-bold text-slate-800">${act.title}</span>
            </div>
            ${stBadge}
          </div>
        `;
      }).join('');
    } else {
      milestonesEl.innerHTML = '<div class="p-3 text-slate-400 italic">Chưa có kế hoạch mốc hoạt động.</div>';
    }
  }

  // Submissions list
  const subsListEl = document.getElementById('dtl-submissions-list');
  if (subsListEl) {
    const subActs = activities.filter(a => a.submissionEnabled);
    let attemptsCount = 0;
    let html = subActs.map(act => {
      const rules = (typeof getEffectiveSubmissionRules === 'function') ? getEffectiveSubmissionRules(studentId, act, round) : null;
      if (!rules || !rules.attemptsHistory || rules.attemptsHistory.length === 0) return '';
      attemptsCount += rules.attemptsHistory.length;

      return rules.attemptsHistory.map((att, idx) => {
        const fName = att.files?.[0]?.validatedName || att.files?.[0]?.originalName || 'Tệp đính kèm';
        const fSize = att.files?.[0]?.size ? (att.files[0].size / (1024 * 1024)).toFixed(1) + ' MB' : '';
        const timeStr = att.submittedAt ? fmtIsoToVietnameseDateTime(att.submittedAt) : '--';

        let statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ Đã nộp</span>';
        if (att.status === 'withdrawn') {
          statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Đã rút bài</span>';
        } else if (att.isLate) {
          statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Nộp trễ</span>';
        }

        return `
          <div class="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-900 truncate">${act.title} (Lần ${att.attempt || idx + 1})</span>
                <span class="text-[10px] text-slate-400 font-mono shrink-0">${timeStr}</span>
              </div>
              <span class="text-[11px] text-slate-600 font-mono block mt-0.5 truncate">${fName} ${fSize ? '(' + fSize + ')' : ''}</span>
            </div>
            <div class="shrink-0">
              ${statusBadge}
            </div>
          </div>
        `;
      }).join('');
    }).filter(Boolean).join('');

    if (attemptsCount === 0) {
      subsListEl.innerHTML = '<div class="p-3 bg-slate-50 rounded-xl text-slate-400 text-center italic">Sinh viên chưa nộp bài qua hệ thống.</div>';
    } else {
      subsListEl.innerHTML = html;
    }
  }

  // Score & Comment Section
  const sc = round?.supervisorScores?.[studentId];
  const scoreValEl = document.getElementById('dtl-score-val');
  const scoreTimeEl = document.getElementById('dtl-score-time');
  const scoreStatusEl = document.getElementById('dtl-score-status');
  const commentTextEl = document.getElementById('dtl-comment-text');

  if (sc?.status === 'completed') {
    if (scoreValEl) scoreValEl.textContent = Number(sc.score).toFixed(1);
    if (scoreTimeEl) scoreTimeEl.textContent = sc.updatedAt ? fmt24h(sc.updatedAt) : '--';
    if (scoreStatusEl) {
      scoreStatusEl.className = 'badge bg-emerald-100 text-emerald-800 font-bold';
      scoreStatusEl.textContent = 'Đã hoàn tất chấm điểm';
    }
  } else if (sc?.status === 'draft') {
    if (scoreValEl) scoreValEl.textContent = sc.score ?? '--';
    if (scoreTimeEl) scoreTimeEl.textContent = sc.updatedAt ? fmt24h(sc.updatedAt) : '--';
    if (scoreStatusEl) {
      scoreStatusEl.className = 'badge bg-amber-100 text-amber-800 font-bold';
      scoreStatusEl.textContent = 'Bản lưu tạm';
    }
  } else {
    if (scoreValEl) scoreValEl.textContent = '--';
    if (scoreTimeEl) scoreTimeEl.textContent = 'Chưa chấm';
    if (scoreStatusEl) {
      scoreStatusEl.className = 'badge bg-slate-100 text-slate-500 font-bold';
      scoreStatusEl.textContent = 'Chưa chấm';
    }
  }

  if (commentTextEl) {
    commentTextEl.textContent = sc?.comment ? `"${sc.comment}"` : '(Chưa có nhận xét nào từ GVHD)';
  }

  // Button link to open score modal
  const btnScore = document.getElementById('btn-dtl-score');
  if (btnScore) {
    btnScore.onclick = () => {
      closeSupervisorStudentDetailModal();
      openScoreEntryModal('supervisor', studentId);
    };
  }

  modal.classList.remove('hidden');
};

window.closeSupervisorStudentDetailModal = function() {
  const modal = document.getElementById('supervisor-student-detail-modal');
  if (modal) modal.classList.add('hidden');
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof isStudentEligible !== 'undefined') window.isStudentEligible = isStudentEligible;
  if (typeof isAssignedToThisSupervisor !== 'undefined') window.isAssignedToThisSupervisor = isAssignedToThisSupervisor;
  if (typeof setElVal !== 'undefined') window.setElVal = setElVal;
  if (typeof setEl !== 'undefined') window.setEl = setEl;
}
