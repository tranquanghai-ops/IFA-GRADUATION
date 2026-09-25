
const ACTIVITY_TYPES = (typeof window !== 'undefined' && window.ACTIVITY_TYPES) || {
  announcement: { label: 'Thông báo', icon: '📢', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  submission: { label: 'Nộp bài', icon: '📥', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  review: { label: 'Duyệt hội đồng', icon: '📋', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  preliminary: { label: 'Sơ khảo', icon: '🔍', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  thesis: { label: 'Chấm thuyết minh', icon: '📖', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  defense: { label: 'Bảo vệ', icon: '🎓', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  other: { label: 'Khác', icon: '📌', color: 'bg-slate-100 text-slate-700 border-slate-200' }
};
const isActivityPublished = (a) => (typeof window !== 'undefined' && window.isActivityPublished ? window.isActivityPublished(a) : (a && a.visibility !== false));

// --- Module Bridges ---
const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : []);
const normalizeOfficialAssignment = (a, r) => (typeof window !== 'undefined' && window.normalizeOfficialAssignment ? window.normalizeOfficialAssignment(a, r) : (a || r));
const renderAdminRoundsTable = () => window.renderAdminRoundsTable?.();
const renderAdminRoundsCards = () => window.renderAdminRoundsCards?.();
/**
 * IFA+ Graduation — Rounds Loader & Header Module
 */
let countdownInterval = null;

async function loadRounds() {
  state.roundsLoaded = false;
  state.roundsLoadError = null;
  if (typeof renderAdminRoundsCards === 'function') {
    renderAdminRoundsCards();
  }

  try {
    const snap = await getDocs(collection(db, 'graduationRounds'));
    const parseRoundDate = val => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      if (typeof val.toDate === 'function') {
        try { return val.toDate(); } catch (e) {}
      }
      if (typeof val === 'number') return new Date(val);
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    state.rounds = snap.docs.map(d => {
      const data = d.data();
      const openAtVal = data.openAt || data.openAtDate || data.startDate || data.registrationOpenAt || data.registrationOpenAtDate || null;
      const closeAtVal = data.closeAt || data.closeAtDate || data.endDate || data.registrationCloseAt || data.registrationCloseAtDate || null;
      const createdAtVal = data.createdAt || data.createdAtDate || null;
      return {
        id: d.id,
        ...data,
        openAtDate: parseRoundDate(openAtVal),
        closeAtDate: parseRoundDate(closeAtVal),
        createdAtDate: parseRoundDate(createdAtVal)
      };
    });

    state.rounds.sort((a, b) => {
      const orderA = Number(a.displayOrder);
      const orderB = Number(b.displayOrder);
      const hasOrderA = a.displayOrder !== undefined && Number.isFinite(orderA);
      const hasOrderB = b.displayOrder !== undefined && Number.isFinite(orderB);
      if (hasOrderA && hasOrderB && orderA !== orderB) return orderA - orderB;
      if (hasOrderA !== hasOrderB) return hasOrderA ? 1 : -1;
      const timeA = a.createdAtDate ? a.createdAtDate.getTime() : 0;
      const timeB = b.createdAtDate ? b.createdAtDate.getTime() : 0;
      return timeB - timeA;
    });

    // Round documents do not always contain denormalized assignment counters.
    // Hydrate admin cards from the same sources used by the assignment workspace.
    if (state.isAdmin && !state.impersonation) {
      await Promise.all(state.rounds.filter(r => !r.deleted).map(async round => {
        try {
          const [officialSnap, draftSnap, eligibleSnap, supervisorsSnap, activitiesSnap, registrationsSnap] = await Promise.all([
            getDocs(collection(db, 'graduationRounds', round.id, 'officialAssignments')),
            getDocs(collection(db, 'graduationRounds', round.id, 'assignmentDrafts')),
            getDocs(collection(db, 'graduationRounds', round.id, 'eligibleStudents')),
            getDocs(collection(db, 'graduationRounds', round.id, 'supervisors')),
            Array.isArray(round.activities) ? Promise.resolve(null) : getDocs(collection(db, 'graduationRounds', round.id, 'activities')),
            getDocs(collection(db, 'graduationRounds', round.id, 'registrations'))
          ]);
          if (activitiesSnap) round.activities = activitiesSnap.docs.map(activityDoc => ({ id: activityDoc.id, ...activityDoc.data() }));
          const effectiveAssignments = new Map();
          officialSnap.docs.forEach(assignmentDoc => effectiveAssignments.set(assignmentDoc.id, assignmentDoc));
          draftSnap.docs.forEach(assignmentDoc => effectiveAssignments.set(assignmentDoc.id, assignmentDoc));
          const assignedStudentIds = new Set();
          effectiveAssignments.forEach(assignmentDoc => {
            const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
            const supervisors = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(assignment) : (window.getOfficialSupervisors ? window.getOfficialSupervisors(assignment) : []);
            const hasAssignment = supervisors.length > 0 || Boolean(
              assignment.acceptedSupervisorId || assignment.assignedSupervisorId || assignment.officialSupervisor
            );
            const studentId = String(assignment.studentId || assignment.id || '').trim().toUpperCase();
            if (hasAssignment && studentId) assignedStudentIds.add(studentId);
          });
          round.assignedCount = assignedStudentIds.size;
          round.officialAssignmentsCount = officialSnap.size;
          // These values must come from the subcollections, not stale counters
          // stored on the round document after manual add/remove operations.
          round.eligibleCount = eligibleSnap.size;
          round.eligibleStudentsCount = eligibleSnap.size;
          round.registrationsCount = registrationsSnap ? registrationsSnap.size : 0;
          round.supervisorCount = supervisorsSnap.size;
          round.supervisorsCount = supervisorsSnap.size;
        } catch (error) {
          console.warn(`[Rounds] Could not hydrate assignment count for ${round.id}:`, error);
        }
      }));
    }

    renderRoundsDropdowns();
    if (typeof renderAdminRoundsTable === 'function') renderAdminRoundsTable(); else if (window.renderAdminRoundsTable) window.renderAdminRoundsTable();

    // Check ?x=SHORTCODE URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const xCode = urlParams.get('x') || urlParams.get('round') || urlParams.get('e');
    const aCode = urlParams.get('a');
    if (aCode) {
      state.targetActivitySlug = aCode;
    }

    let targetRound = null;
    if (xCode) {
      // Find round matching shortCode, roundName or id
      targetRound = state.rounds.find(r => !r.deleted && (r.shortCode === xCode || r.roundName === xCode || r.id === xCode || r.slug === xCode || r.title === xCode));
    }

    // Restore exact simulated round after F5
    const simulationTarget = state.impersonation?.target || null;
    if (simulationTarget && !targetRound) {
      const matchId = String(simulationTarget.roundId || '').trim();
      const matchCode = String(simulationTarget.roundShortCode || simulationTarget.roundTitle || '').trim();

      const simulatedRound = state.rounds.find(r => !r.deleted && (
        (matchId && (r.id === matchId || r.shortCode === matchId || r.slug === matchId || r.roundName === matchId || r.title === matchId)) ||
        (matchCode && (r.shortCode === matchCode || r.slug === matchCode || r.roundName === matchCode || r.title === matchCode || r.id === matchCode))
      ));

      if (simulatedRound) {
        targetRound = simulatedRound;
        simulationTarget.roundId = simulatedRound.id;
        simulationTarget.roundTitle = simulatedRound.title || simulatedRound.roundName || simulatedRound.id;
        simulationTarget.roundShortCode = simulatedRound.shortCode || simulatedRound.slug || '';
        simulationTarget.roundAcademicYear = simulatedRound.academicYear || '';
        try { sessionStorage.setItem('ifa_graduation_impersonation', JSON.stringify(state.impersonation)); } catch (e) {}
      }
    }

    // A student lands in a round where their MSSV is on the official roster.
    // Keep explicit deep links and admin simulation targets authoritative.
    if (!targetRound && state.currentView === 'student' && state.isStudent && !state.impersonation && state.studentMssv) {
      const eligibleMatches = await Promise.all(state.rounds.filter(r => !r.deleted).map(async round => {
        try {
          const eligibleDoc = await getDoc(doc(db, 'graduationRounds', round.id, 'eligibleStudents', state.studentMssv));
          return eligibleDoc.exists() && eligibleDoc.data().eligible !== false ? round : null;
        } catch (error) {
          console.warn(`[Rounds] Could not check student roster in ${round.id}:`, error);
          return null;
        }
      }));
      const matchedRounds = eligibleMatches.filter(Boolean);
      targetRound = matchedRounds.find(round => round.isActive === true) || matchedRounds[0] || null;
    }

    // If no direct link, ONLY use the ACTIVE round
    if (!targetRound) {
      targetRound = state.rounds.find(r => !r.deleted && r.isActive === true);
    }

    // Fallback to latest available round if active flag is not set
    if (!targetRound && state.rounds.length > 0) {
      targetRound = state.rounds.find(r => !r.deleted) || state.rounds[0];
    }

    state.activeRound = targetRound || null;
    state.selectedRoundId = targetRound ? targetRound.id : null;

    if (state.selectedRoundId) {
      await selectRound(state.selectedRoundId);
      if (state.impersonation) { if (typeof updateAuthUI === 'function') updateAuthUI(); else if (window.updateAuthUI) window.updateAuthUI(); }
    }
  } catch (e) {
    console.error('[Rounds] Error loading rounds:', e);
    state.rounds = state.rounds || [];
    state.roundsLoadError = e;
  } finally {
    state.roundsLoaded = true;
    if (typeof renderAdminRoundsCards === 'function') {
      renderAdminRoundsCards();
    }
  }
}
window.loadRounds = loadRounds;

async function refreshRoundCardMetrics(roundId) {
  if (!roundId) return;
  const round = (state.rounds || []).find(item => item.id === roundId);
  if (!round) return;

  try {
    const [eligibleSnap, supervisorsSnap, officialSnap, draftSnap, registrationsSnap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents')),
      getDocs(collection(db, 'graduationRounds', roundId, 'supervisors')),
      getDocs(collection(db, 'graduationRounds', roundId, 'officialAssignments')),
      getDocs(collection(db, 'graduationRounds', roundId, 'assignmentDrafts')),
      getDocs(collection(db, 'graduationRounds', roundId, 'registrations'))
    ]);
    const effectiveAssignments = new Map();
    officialSnap.docs.forEach(assignmentDoc => effectiveAssignments.set(assignmentDoc.id, assignmentDoc));
    draftSnap.docs.forEach(assignmentDoc => effectiveAssignments.set(assignmentDoc.id, assignmentDoc));
    const assignedStudentIds = new Set();
    effectiveAssignments.forEach(assignmentDoc => {
      const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
      const hasAssignment = getOfficialSupervisors(assignment).length > 0 || Boolean(
        assignment.acceptedSupervisorId || assignment.assignedSupervisorId || assignment.officialSupervisor
      );
      const studentId = String(assignment.studentId || assignmentDoc.id || '').trim().toUpperCase();
      if (hasAssignment && studentId) assignedStudentIds.add(studentId);
    });

    round.eligibleCount = eligibleSnap.size;
    round.eligibleStudentsCount = eligibleSnap.size;
    round.registrationsCount = registrationsSnap ? registrationsSnap.size : 0;
    round.supervisorCount = supervisorsSnap.size;
    round.supervisorsCount = supervisorsSnap.size;
    round.assignedCount = assignedStudentIds.size;
    round.officialAssignmentsCount = officialSnap.size;
    // The round card may still hold the pre-publication review state. Only copy
    // counters here; never overwrite the freshly fetched review status.
    if (state.activeRound?.id === roundId && state.activeRound !== round) {
      Object.assign(state.activeRound, {
        eligibleCount: round.eligibleCount,
        eligibleStudentsCount: round.eligibleStudentsCount,
        registrationsCount: round.registrationsCount,
        supervisorCount: round.supervisorCount,
        supervisorsCount: round.supervisorsCount,
        assignedCount: round.assignedCount,
        officialAssignmentsCount: round.officialAssignmentsCount
      });
    }
    renderAdminRoundsCards();
  } catch (error) {
    console.warn(`[Rounds] Could not refresh live metrics for ${roundId}:`, error);
  }
}


// Safe helper to populate round selectors across views
window.populateRoundSelectors = function() {
  try {
    renderRoundsDropdowns();
  } catch (err) {
    console.warn('[IFA-Graduation] renderRoundsDropdowns warning:', err);
  }
};

function renderRoundsDropdowns() {
  const selectActive = document.getElementById('select-active-round');
  const selectAdminSup = document.getElementById('admin-round-sup-select');
  const selectAdminStudent = document.getElementById('admin-round-student-select');
  const selectAdminReg = document.getElementById('admin-round-reg-select');
  const selectAdminReview = document.getElementById('admin-review-round-select');
  
  const validRounds = (state.rounds || []).filter(r => !r.deleted);
  const optionsHtml = validRounds.map(r => '<option value="' + r.id + '" ' + (r.id === state.selectedRoundId ? 'selected' : '') + '>' + r.title + ' (' + (r.academicYear || '') + ')' + (r.isActive ? ' ★ Hiện hành' : '') + '</option>').join('');

  if (selectActive) {
    selectActive.innerHTML = optionsHtml;
    document.getElementById('multi-round-selector-wrap')?.classList.add('hidden');
  }
  if (selectAdminSup) selectAdminSup.innerHTML = optionsHtml;
  if (selectAdminStudent) selectAdminStudent.innerHTML = optionsHtml;
  if (selectAdminReg) selectAdminReg.innerHTML = optionsHtml;
  if (selectAdminReview) selectAdminReview.innerHTML = optionsHtml;
  const selectAdminTimeline = document.getElementById('admin-timeline-round-select');
  if (selectAdminTimeline) selectAdminTimeline.innerHTML = optionsHtml;
}

window.onRoundSelected = function(roundId) {
  selectRound(roundId);
};

export async function selectRound(roundId) {
  state.selectedRoundId = roundId;
  state.activeRound = state.rounds.find(r => r.id === roundId) || null;
  if (!state.activeRound) return;

  const emptyCard = document.getElementById('student-empty-round');
  if (emptyCard) emptyCard.classList.add('hidden');

  renderRoundHeader();
  startCountdown();
  
  if (typeof loadRoundSupervisors === 'function') await loadRoundSupervisors(roundId); else if (window.loadRoundSupervisors) await window.loadRoundSupervisors(roundId);
  if (typeof checkStudentEligibilityAndRegistration === 'function') await checkStudentEligibilityAndRegistration(roundId); else if (window.checkStudentEligibilityAndRegistration) await window.checkStudentEligibilityAndRegistration(roundId);
  
  if (typeof updateStudentPersonalSidebar === 'function') {
    if (typeof updateStudentPersonalSidebar === 'function') updateStudentPersonalSidebar(); else if (window.updateStudentPersonalSidebar) window.updateStudentPersonalSidebar();
  }

  if (state.isSupervisor) {
    if (typeof loadSupervisorReviewData === 'function') loadSupervisorReviewData(roundId); else if (window.loadSupervisorReviewData) window.loadSupervisorReviewData(roundId);
  }
  if (typeof loadStudentRoundActivities === 'function') await loadStudentRoundActivities(roundId); else if (window.loadStudentRoundActivities) await window.loadStudentRoundActivities(roundId);
  renderRoundHeader();
}

function resolveStudentSupervisorProfiles(officialList = [], effectiveAssignment = null) {
  const fallbackName = effectiveAssignment?.acceptedSupervisorName || effectiveAssignment?.supervisorName || effectiveAssignment?.officialSupervisor?.name || '';
  const assigned = officialList.length ? officialList : (fallbackName ? [{
    supervisorId: effectiveAssignment.acceptedSupervisorId || effectiveAssignment.assignedSupervisorId || '',
    supervisorName: fallbackName,
    role: 'primary'
  }] : []);
  return [...assigned].sort((a, b) => (a.role === 'primary' ? -1 : 1) - (b.role === 'primary' ? -1 : 1)).map((item, index) => {
    const id = String(item.supervisorId || item.id || '').trim();
    const itemEmail = String(item.supervisorEmail || item.email || '').trim().toLowerCase();
    const itemName = String(item.supervisorName || item.name || '').trim().toLowerCase();
    const profiles = [...(state.roundSupervisors || []), ...(state.supervisorsMaster || [])];
    const profile = profiles.find(s => id && (s.id === id || s.supervisorId === id))
      || profiles.find(s => itemEmail && String(s.email || '').trim().toLowerCase() === itemEmail)
      || profiles.find(s => itemName && String(s.name || s.supervisorName || '').trim().toLowerCase() === itemName)
      || {};
    const master = (state.supervisorsMaster || []).find(s =>
      (id && (s.id === id || s.supervisorId === id)) ||
      (itemEmail && String(s.email || '').trim().toLowerCase() === itemEmail)) || {};
    return {
      label: assigned.length > 1 ? `GVHD ${index + 1}` : 'GVHD',
      name: item.supervisorName || item.name || profile.name || master.name || 'Giảng viên hướng dẫn',
      email: item.supervisorEmail || item.email || profile.email || master.email || effectiveAssignment?.supervisorEmail || '',
      phone: item.phone || item.phoneNumber || profile.phone || profile.phoneNumber || profile.mobile || master.phone || master.phoneNumber || master.mobile || effectiveAssignment?.supervisorPhone || '',
      photoUrl: item.photoUrl || profile.photoUrl || master.photoUrl || ''
    };
  });
}

function renderRoundHeader() {
  const round = state.activeRound;
  if (!round) return;

  const heroCard = document.getElementById('student-hero-card');
  const journeyCard = document.getElementById('student-journey-card');
  if (state.eligibilityState === 'not_eligible' && (!state.isAdmin || state.impersonation)) {
    if (heroCard) heroCard.classList.add('hidden');
    if (journeyCard) journeyCard.classList.add('hidden');
    return;
  }

  const titleDisplay = document.getElementById('round-title-display');
  if (titleDisplay) titleDisplay.textContent = round.title;

  // Hero Card Quick Metrics
  const milestonesCountEl = document.getElementById('hero-milestones-count');
  if (milestonesCountEl) {
    const roundActivities = Array.isArray(round.activities) ? round.activities : [];
    const canSeeDrafts = state.isAdmin && !state.impersonation;
    const actCount = canSeeDrafts
      ? roundActivities.length
      : roundActivities.filter(activity => isActivityPublished(activity)).length;
    milestonesCountEl.textContent = `${actCount} mốc kế hoạch`;
  }
  const assignedSupEl = document.getElementById('hero-assigned-sup');
  const effectiveAssignment = normalizeOfficialAssignment(state.myOfficialAssignment, state.myRegistration);
  const officialList = effectiveAssignment ? ((typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(effectiveAssignment) : (window.getOfficialSupervisors ? window.getOfficialSupervisors(effectiveAssignment) : [])) : [];
  const hasOfficialSup = officialList.length > 0 || Boolean(effectiveAssignment?.assignedSupervisorId || effectiveAssignment?.officialSupervisor || effectiveAssignment?.acceptedSupervisorName || effectiveAssignment?.supervisorName);

  if (assignedSupEl) {
    if (officialList.length > 0) {
      const p = officialList.find(s => s.role === 'primary') || officialList[0];
      assignedSupEl.textContent = `GVHD: ${p.supervisorName || effectiveAssignment?.acceptedSupervisorName || 'Đã phân công'}`;
    } else if (effectiveAssignment?.acceptedSupervisorName) {
      assignedSupEl.textContent = `GVHD: ${effectiveAssignment.acceptedSupervisorName}`;
    } else {
      assignedSupEl.textContent = 'GVHD: Chưa phân công';
    }
  }

  // Render one or two published supervisors with contact details (Horizontal compact layout: Image left, text right).
  const supervisorCard = document.getElementById('hero-supervisor-info-card');
  if (supervisorCard) {
    const profiles = hasOfficialSup ? resolveStudentSupervisorProfiles(officialList, effectiveAssignment).slice(0, 2) : [];
    supervisorCard.innerHTML = profiles.length
      ? `<div class="space-y-2.5">${profiles.map(profile => {
        const fallback = getSupervisorAvatarSvgDataUri(profile.name);
        const avatar = profile.photoUrl || fallback;
        const phoneHref = String(profile.phone || '').replace(/[^\d+]/g, '');
        return `<div class="flex items-center gap-3 min-w-0">
          <img src="${escapeHtml(avatar)}" data-fallback="${escapeHtml(fallback)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHtml(profile.name)}" class="w-13 h-13 sm:w-14 sm:h-14 rounded-xl border-2 border-white/30 object-cover shrink-0 shadow-2xs bg-white/10">
          <div class="min-w-0 flex-1 space-y-0.5 text-left">
            <div class="flex items-center gap-1.5">
              <span class="rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950 uppercase tracking-wide">${escapeHtml(profile.label)}</span>
            </div>
            <h4 class="text-xs sm:text-sm font-black text-white truncate leading-snug" title="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}</h4>
            ${profile.email ? `<a href="mailto:${escapeHtml(profile.email)}" class="truncate flex items-center gap-1 text-[11px] text-blue-100 hover:underline" title="${escapeHtml(profile.email)}"><span>✉️</span><span class="truncate">${escapeHtml(profile.email)}</span></a>` : ''}
            ${profile.phone ? `<a href="tel:${escapeHtml(phoneHref)}" class="flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:underline" title="${escapeHtml(profile.phone)}"><span>📞</span><span>${escapeHtml(profile.phone)}</span></a>` : ''}
          </div>
        </div>`;
      }).join('')}</div>`
      : '<div class="flex items-center gap-3 text-left"><div class="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-xl shrink-0">👨‍🏫</div><div class="min-w-0"><span class="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-black text-white uppercase">GVHD</span><p class="mt-0.5 text-xs text-blue-100 font-bold">Chưa phân công</p></div></div>';
  }

  // Tinh giản banner sinh viên theo yêu cầu: ẩn các badge và thông tin trùng lặp
  const studentStateBadge = document.getElementById('hero-student-state-badge');
  if (studentStateBadge) studentStateBadge.classList.add('hidden');

  const statusBadge = document.getElementById('round-status-badge');
  if (statusBadge) statusBadge.classList.add('hidden');

  const timeRangeEl = document.getElementById('round-time-range');
  if (timeRangeEl) timeRangeEl.classList.add('hidden');

  const studentProfileBtn = document.getElementById('hero-student-profile-btn');
  if (studentProfileBtn) studentProfileBtn.classList.add('hidden');

  const assignedSupWrap = document.getElementById('hero-assigned-sup-wrap');
  if (assignedSupWrap) assignedSupWrap.classList.add('hidden');

  const prefCount = round.preferenceCount || 3;
  // Banner bỏ ghi chú 3 nguyện vọng theo yêu cầu
  document.getElementById('round-mode-badge')?.classList.add('hidden');

  const fmtDate = value => {
    if (!value) return '';
    const date = value?.toDate ? value.toDate() : new Date(value);
    return isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const openStr = round.openAtDate ? fmtDate(round.openAtDate) : '--';
  const closeStr = round.closeAtDate ? fmtDate(round.closeAtDate) : '--';
  if (timeRangeEl) timeRangeEl.innerHTML = `<span>📅 Thời gian: ${openStr} — ${closeStr}</span>`;

  const trayHint = document.getElementById('tray-mode-hint');
  if (trayHint) trayHint.textContent = `Chọn đủ ${prefCount} nguyện vọng theo thứ tự ưu tiên giảm dần`;

  // Đưa tên đề tài SV đăng ký lên hero banner khi sinh viên đã đăng ký tên đề tài
  const topicWrap = document.getElementById('hero-registered-topic-wrap');
  const topicNameEl = document.getElementById('hero-registered-topic-name');
  const topicMetaEl = document.getElementById('hero-registered-topic-meta');
  const topicApprovalBadge = document.getElementById('hero-topic-approval-badge');
  const topicVersionBadge = document.getElementById('hero-topic-version-badge');
  const topicReviewNoteEl = document.getElementById('hero-registered-topic-review-note');
  const topicDownloadBtn = document.getElementById('hero-download-topic-form-btn');
  const reg = state.myRegistration;
  const registeredTopic = reg?.topicTitle || reg?.topic || reg?.proposalTitle || reg?.title || reg?.topicName;

  if (topicWrap) {
    if (registeredTopic) {
      topicWrap.classList.remove('hidden');
      if (topicNameEl) topicNameEl.textContent = registeredTopic;

      const approvalStatus = reg?.topicApprovalStatus || 'pending';
      if (topicApprovalBadge) {
        if (approvalStatus === 'approved') {
          topicApprovalBadge.textContent = '✅ GVHD ĐÃ DUYỆT';
          topicApprovalBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-emerald-400 text-emerald-950 shadow-2xs';
        } else if (approvalStatus === 'rejected') {
          topicApprovalBadge.textContent = '⚠️ GVHD YÊU CẦU SỬA';
          topicApprovalBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-rose-400 text-rose-950 shadow-2xs';
        } else {
          topicApprovalBadge.textContent = '⏳ Chờ GVHD duyệt';
          topicApprovalBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-amber-400 text-slate-950 shadow-2xs';
        }
      }

      if (topicVersionBadge) {
        topicVersionBadge.textContent = `Lần ${reg?.topicTitleVersion || 1}`;
      }

      if (topicMetaEl) {
        const submittedAt = fmtDate(reg?.submittedAt);
        const timeStr = submittedAt ? `🕒 Đã nộp: ${submittedAt}` : '';
        const typeStr = reg?.projectType ? `📁 Loại hình: ${reg.projectType}` : '';
        topicMetaEl.innerHTML = [typeStr, timeStr].filter(Boolean).map(item => `<span>${escapeHtml(item)}</span>`).join('<span class="text-white/30">•</span>');
      }

      if (topicReviewNoteEl) {
        const hasNote = approvalStatus === 'rejected' && String(reg?.topicApprovalNote || '').trim();
        if (hasNote) {
          topicReviewNoteEl.innerHTML = `<span>💬 <strong>Ý kiến GVHD:</strong> ${escapeHtml(reg.topicApprovalNote)}</span>`;
          topicReviewNoteEl.classList.remove('hidden');
        } else {
          topicReviewNoteEl.classList.add('hidden');
          topicReviewNoteEl.innerHTML = '';
        }
      }

      if (topicDownloadBtn) {
        topicDownloadBtn.classList.toggle('hidden', approvalStatus !== 'approved');
      }
    } else {
      topicWrap.classList.add('hidden');
      if (topicDownloadBtn) topicDownloadBtn.classList.add('hidden');
    }
  }

  // Render thanh tiến độ 12 tuần thực hiện ĐATN
  if (typeof renderStudentTimelineWeeks === 'function') {
    renderStudentTimelineWeeks();
  }
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  const toMillis = value => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value.toDate === 'function') {
      try { return value.toDate().getTime(); } catch (e) {}
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  
  const updateTimer = () => {
    const round = state.activeRound;
    if (!round) return;

    const now = new Date().getTime();
    const openTime = toMillis(round.openAtDate || round.openAt || round.startDate || round.registrationOpenAt || round.registrationOpenAtDate);
    const closeTime = toMillis(round.closeAtDate || round.closeAt || round.endDate || round.registrationCloseAt || round.registrationCloseAtDate);

    const valEl = document.getElementById('countdown-value');
    const labelEl = document.getElementById('countdown-label');
    if (!valEl || !labelEl) return;

    if (openTime && now < openTime) {
      labelEl.textContent = 'MỞ ĐĂNG KÝ SAU';
      valEl.textContent = formatDuration(openTime - now);
      valEl.classList.add('pulse-timer');
    } else if (closeTime && now <= closeTime && round.status === 'open') {
      labelEl.textContent = 'THỜI GIAN CÒN LẠI';
      valEl.textContent = formatDuration(closeTime - now);
      valEl.classList.add('pulse-timer');
    } else if (closeTime && now > closeTime) {
      labelEl.textContent = 'TRẠNG THÁI';
      valEl.textContent = 'ĐÃ HẾT HẠN';
      valEl.classList.remove('pulse-timer');
    } else {
      labelEl.textContent = 'TRẠNG THÁI';
      valEl.textContent = round.status === 'published' ? 'ĐÃ CÔNG BỐ KẾT QUẢ' : (round.status === 'reviewing' ? 'ĐANG XÉT DUYỆT' : (round.status === 'open' ? 'ĐANG MỞ ĐĂNG KÝ' : 'ĐÃ ĐÓNG ĐĂNG KÝ'));
      valEl.classList.remove('pulse-timer');
    }
  };

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = n => String(n).padStart(2, '0');

  if (days > 0) return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// --- ELIGIBILITY & REGISTRATION CHECK ---

// --- SOFT DELETE & TRASH ---
if (typeof window !== "undefined") { window.selectRound = selectRound; window.loadRounds = loadRounds; }

if (typeof window !== 'undefined') {
  window.renderRoundHeader = renderRoundHeader;
  window.renderRoundsDropdowns = renderRoundsDropdowns;
}
