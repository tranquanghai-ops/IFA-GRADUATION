const renderSupervisorRoundTimeline = (rnd) => window.renderSupervisorRoundTimeline?.(rnd);
const renderSupervisorPlanList = (rnd) => window.renderSupervisorPlanList?.(rnd);
/**
 * IFA+ Graduation — Supervisor Portal Core & Data Loading
 */
// --- Module Bridges ---
const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : []);
const normalizeOfficialAssignment = (a, r) => (typeof window !== 'undefined' && window.normalizeOfficialAssignment ? window.normalizeOfficialAssignment(a, r) : (a || r));
const isDirectSupervisorAssignment = (rnd) => (typeof window !== 'undefined' && window.isDirectSupervisorAssignment ? window.isDirectSupervisorAssignment(rnd) : false);

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
  if (greetingEl) greetingEl.innerHTML = `Kính chào Thầy/Cô<br class="sm:hidden"> <span class="font-black">${escapeHtml(supDisplayName)}</span>`;
  const roundYear = round.academicYear ? ` (${round.academicYear})` : '';
  if (roundInfoEl) roundInfoEl.textContent = `${round.title || ''}${roundYear}`;
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

  // Check if supervisor has active duties in this round (must have assigned students, or be in pre-assignment preference review)
  const hasSupervisorDuties = totalAssignedCount > 0 || (!isDirect && !round.isAssigned && Boolean(roundSupervisor));

  if (!hasSupervisorDuties) {
    const timelineEl = document.getElementById('supervisor-round-timeline');
    if (timelineEl) {
      timelineEl.innerHTML = '';
      timelineEl.classList.add('hidden');
    }
    const planSection = document.getElementById('supervisor-plan-section');
    if (planSection) {
      planSection.classList.add('hidden');
    }
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
    if (assignedPanel) assignedPanel.classList.remove('hidden');

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
