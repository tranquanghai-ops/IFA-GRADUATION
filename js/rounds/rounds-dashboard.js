/**
 * IFA+ Graduation — Rounds Management Module
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
          const [officialSnap, draftSnap, eligibleSnap, supervisorsSnap, activitiesSnap] = await Promise.all([
            getDocs(collection(db, 'graduationRounds', round.id, 'officialAssignments')),
            getDocs(collection(db, 'graduationRounds', round.id, 'assignmentDrafts')),
            getDocs(collection(db, 'graduationRounds', round.id, 'eligibleStudents')),
            getDocs(collection(db, 'graduationRounds', round.id, 'supervisors')),
            Array.isArray(round.activities) ? Promise.resolve(null) : getDocs(collection(db, 'graduationRounds', round.id, 'activities'))
          ]);
          if (activitiesSnap) round.activities = activitiesSnap.docs.map(activityDoc => ({ id: activityDoc.id, ...activityDoc.data() }));
          const effectiveAssignments = new Map();
          officialSnap.docs.forEach(assignmentDoc => effectiveAssignments.set(assignmentDoc.id, assignmentDoc));
          draftSnap.docs.forEach(assignmentDoc => effectiveAssignments.set(assignmentDoc.id, assignmentDoc));
          const assignedStudentIds = new Set();
          effectiveAssignments.forEach(assignmentDoc => {
            const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
            const supervisors = getOfficialSupervisors(assignment);
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
          round.supervisorCount = supervisorsSnap.size;
          round.supervisorsCount = supervisorsSnap.size;
        } catch (error) {
          console.warn(`[Rounds] Could not hydrate assignment count for ${round.id}:`, error);
        }
      }));
    }

    renderRoundsDropdowns();
    renderAdminRoundsTable();

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
      if (state.impersonation) updateAuthUI();
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
    const [eligibleSnap, supervisorsSnap, officialSnap, draftSnap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents')),
      getDocs(collection(db, 'graduationRounds', roundId, 'supervisors')),
      getDocs(collection(db, 'graduationRounds', roundId, 'officialAssignments')),
      getDocs(collection(db, 'graduationRounds', roundId, 'assignmentDrafts'))
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
  
  await loadRoundSupervisors(roundId);
  await checkStudentEligibilityAndRegistration(roundId);
  
  if (typeof updateStudentPersonalSidebar === 'function') {
    updateStudentPersonalSidebar();
  }

  if (state.isSupervisor) {
    loadSupervisorReviewData(roundId);
  }
  await loadStudentRoundActivities(roundId);
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
  const officialList = effectiveAssignment ? getOfficialSupervisors(effectiveAssignment) : [];
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
window.softDeleteRound = async function(roundId) {
  if (!state.isAdmin) return;
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;

  if (!(await showConfirm('Chuyển vào Thùng rác', `Bạn có chắc chắn muốn chuyển đợt "${r.title}" vào Thùng rác?`, { confirmText: 'Chuyển vào Thùng rác', danger: true }))) return;

  try {
    const wasActive = Boolean(r.isActive);
    r.deleted = true;
    r.deletedAt = new Date().toISOString();
    r.isActive = false;

    renderAdminRoundsTable();
    if (typeof renderAdminRoundsCards === 'function') renderAdminRoundsCards();
    populateRoundSelectors();
    loadAdminStats().catch(() => {});

    await updateDoc(doc(db, 'graduationRounds', roundId), {
      deleted: true,
      deletedAt: serverTimestamp(),
      isActive: false,
      updatedAt: serverTimestamp()
    });

    showToast('Đã chuyển đợt vào Thùng rác.', 'warning');
  } catch (err) {
    console.error('Lỗi xóa đợt:', err);
    showToast('Lỗi xóa đợt: ' + err.message, 'error');
  }
};

window.restoreRound = async function(roundId) {
  if (!state.isAdmin) return;
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;

  try {
    r.deleted = false;
    r.deletedAt = null;
    r.isActive = false; // Never auto-reactivate

    renderAdminTrashTable();
    renderAdminRoundsTable();
    if (typeof renderAdminRoundsCards === 'function') renderAdminRoundsCards();
    populateRoundSelectors();
    loadAdminStats().catch(() => {});

    await updateDoc(doc(db, 'graduationRounds', roundId), {
      deleted: false,
      deletedAt: null,
      isActive: false,
      updatedAt: serverTimestamp()
    });

    showToast(`Đã khôi phục đợt "${r.title}". Đợt ở trạng thái không hiện hành.`, 'info');
  } catch (err) {
    console.error('Lỗi khôi phục đợt:', err);
    showToast('Lỗi khôi phục đợt: ' + err.message, 'error');
  }
};

window.permanentDeleteRound = async function(roundId) {
  if (!state.isAdmin) return;
  const r = state.rounds.find(x => x.id === roundId);
  const title = r ? r.title : roundId;

  if (!(await showConfirm('XÓA VĨNH VIỄN ĐỢT', `⚠️ HÀNH ĐỘNG KHÔNG THỂ HOÀN TÁC!\nBạn có chắc chắn muốn XÓA VĨNH VIỄN đợt "${title}"?`, { confirmText: 'Xóa vĩnh viễn', danger: true }))) return;

  try {
    state.rounds = state.rounds.filter(x => x.id !== roundId);
    renderAdminTrashTable();

    await deleteDoc(doc(db, 'graduationRounds', roundId));
    showToast('Đã xóa vĩnh viễn đợt khỏi cơ sở dữ liệu.', 'warning');
  } catch (err) {
    console.error('Lỗi xóa vĩnh viễn đợt:', err);
    showToast('Lỗi xóa vĩnh viễn: ' + err.message, 'error');
  }
};

function renderAdminTrashTable() {
  const tbody = document.getElementById('admin-trash-tbody');
  if (!tbody) return;

  const now = Date.now();
  const trashedRounds = (state.rounds || []).filter(r => r.deleted === true);

  // Auto purge items older than 30 days
  trashedRounds.forEach(r => {
    const delTime = r.deletedAt ? new Date(r.deletedAt).getTime() : now;
    const daysPassed = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
    if (daysPassed >= 30) {
      permanentDeleteRound(r.id).catch(console.warn);
    }
  });

  if (trashedRounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Thùng rác trống</td></tr>';
    return;
  }

  tbody.innerHTML = trashedRounds.map(r => {
    const delTime = r.deletedAt ? new Date(r.deletedAt).getTime() : now;
    const daysPassed = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 30 - daysPassed);
    const delDateStr = fmt24h(r.deletedAt);

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-bold text-slate-900">${r.title}</td>
        <td class="p-3.5 text-slate-600">${r.academicYear || '--'}</td>
        <td class="p-3.5 text-slate-500 font-mono text-[11px]">${delDateStr}</td>
        <td class="p-3.5">
          <span class="badge ${daysRemaining <= 5 ? 'badge-closed' : 'bg-amber-100 text-amber-800'}">Còn ${daysRemaining} ngày</span>
        </td>
        <td class="p-3.5 text-right space-x-2">
          <button onclick="restoreRound('${r.id}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-300">Khôi phục</button>
          <button onclick="permanentDeleteRound('${r.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-300">Xóa vĩnh viễn</button>
        </td>
      </tr>
    `;
  }).join('');
}


// --- ADMIN: ROUNDS TABLE ---
function renderAdminRoundsTable() {
  const tbody = document.getElementById('admin-rounds-tbody');
  if (!tbody) return;

  const activeRounds = (state.rounds || []).filter(r => !r.deleted);

  if (activeRounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400">Chưa có đợt tốt nghiệp nào. Bấm "+ Tạo đợt mới" để bắt đầu.</td></tr>';
    return;
  }

  tbody.innerHTML = activeRounds.map(r => {
    const timeRangeStr = fmtDateRange24h(r.openAtDate, r.closeAtDate);
    const isCurrentActive = Boolean(r.isActive);
    const shortCode = r.shortCode || r.roundName || r.slug || r.id;

    // Determine configuration status
    const isPreEligible = Boolean(r.allowRegistrationBeforeEligibility);
    const isIncomplete = (r.configStatus === 'incomplete') || (!isPreEligible && typeof r.eligibleCount === 'number' && r.eligibleCount === 0) || (typeof r.supervisorCount === 'number' && r.supervisorCount === 0);

    let statusColHtml = '';
    if (isCurrentActive) {
      statusColHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-300">● Đợt hiện hành</span>';
    } else if (isIncomplete) {
      statusColHtml = `
        <div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Thiếu SV đủ điều kiện hoặc GVHD">⚠️ Chưa hoàn tất</span>
          <button onclick="setActiveRound('${r.id}')" class="mt-1 block text-[11px] text-slate-500 hover:text-slate-800 underline">Kích hoạt</button>
        </div>
      `;
    } else {
      statusColHtml = `
        <div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Sẵn sàng</span>
          <button onclick="setActiveRound('${r.id}')" class="mt-1 block text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline">Đặt làm hiện hành</button>
        </div>
      `;
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-slate-900">${r.title}</span>
            ${isPreEligible ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold" title="Cho phép đăng ký trước danh sách đủ điều kiện">Chờ xét ĐK</span>' : ''}
          </div>
          <span class="text-[10px] font-mono text-slate-400 block mt-0.5">Mã: ${shortCode}</span>
        </td>
        <td class="p-3.5 text-slate-600 font-semibold">${r.academicYear}</td>
        <td class="p-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">${timeRangeStr}</td>
        <td class="p-3.5 font-bold text-slate-800">${typeof r.supervisorCount === 'number' ? r.supervisorCount : (r.supervisorsCount || '--')}</td>
        <td class="p-3.5 font-bold text-slate-800">${typeof r.eligibleCount === 'number' ? r.eligibleCount : (r.registrationsCount || '--')}</td>
        <td class="p-3.5">
          <span class="badge badge-${r.status}">${r.status}</span>
        </td>
        <td class="p-3.5">
          ${statusColHtml}
        </td>
        <td class="p-3.5">
          <button onclick="copyRoundLink('${r.id}', '${shortCode}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-tdtu-blue rounded-lg font-bold text-xs flex items-center gap-1 border border-blue-200 transition-colors" title="Sao chép link ?x=${shortCode}">
            <span>📋 Link</span>
          </button>
        </td>
        <td class="p-3.5 text-right space-x-1.5 whitespace-nowrap">
          <button onclick="openRoundTimeline('${r.id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs border border-indigo-200 transition-colors" title="Kế hoạch mốc thời gian">📅 Kế hoạch</button>
          <button onclick="editRoundModal('${r.id}')" class="text-blue-600 hover:underline font-bold text-xs">Sửa</button>
          <button onclick="softDeleteRound('${r.id}')" class="text-rose-600 hover:underline font-bold text-xs">Xóa</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================================

// PHASE 1: IFAA-STYLE ROUNDS MANAGEMENT & CARD VIEW
// ============================================================================

state.adminRoundsFilter = 'all';
state.adminRoundsSearch = '';

window.filterAdminRounds = function(filterKey) {
  state.adminRoundsFilter = filterKey;
  document.querySelectorAll('#admin-rounds-filter-pills .round-filter-btn').forEach(btn => {
    if (btn.dataset.filter === filterKey) {
      btn.className = 'round-filter-btn px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white shadow-xs transition-all';
    } else {
      btn.className = 'round-filter-btn px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all';
    }
  });
  renderAdminRoundsCards();
};

window.searchAdminRounds = function(query) {
  state.adminRoundsSearch = (query || '').trim().toLowerCase();
  renderAdminRoundsCards();
};

function getRoundStatusCategory(r) {
  if (r.deleted || r.isDeleted) return 'deleted';
  if (r.hidden || r.status === 'hidden' || r.isHidden) return 'hidden';
  
  const now = Date.now();
  const openTime = r.openAtDate ? new Date(r.openAtDate).getTime() : (r.openAt ? new Date(r.openAt.toDate ? r.openAt.toDate() : r.openAt).getTime() : null);
  const closeTime = r.closeAtDate ? new Date(r.closeAtDate).getTime() : (r.closeAt ? new Date(r.closeAt.toDate ? r.closeAt.toDate() : r.closeAt).getTime() : null);
  
  if (r.status === 'closed' || r.status === 'ended' || (closeTime && !isNaN(closeTime) && now > closeTime)) {
    return 'ended';
  }
  if (r.status === 'upcoming' || (openTime && !isNaN(openTime) && now < openTime)) {
    return 'upcoming';
  }
  return 'running';
}

function getRoundWeekSchedule(round) {
  const durationWeeks = parseInt(round?.durationWeeks, 10) || 12;
  const pad = value => String(value).padStart(2, '0');
  const formatDate = date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  let startMonday = null;
  const configuredStart = round?.startDate || round?.datnStartDate || round?.openAt || round?.openAtDate;
  if (configuredStart) {
    const parsed = new Date(configuredStart?.toDate ? configuredStart.toDate() : configuredStart);
    if (!isNaN(parsed.getTime())) {
      const day = parsed.getDay();
      parsed.setDate(parsed.getDate() - day + (day === 0 ? -6 : 1));
      parsed.setHours(0, 0, 0, 0);
      startMonday = parsed;
    }
  }
  if (!startMonday) startMonday = new Date();

  const now = new Date();
  const defaultMilestones = { 4: 'Duyệt đợt 1', 8: 'Duyệt đợt 2', 12: 'Duyệt đợt 3' };
  const weeklyConfig = Array.isArray(round?.timelineWeeksConfig) ? round.timelineWeeksConfig : [];
  return Array.from({ length: durationWeeks }, (_, index) => {
    const week = index + 1;
    const start = new Date(startMonday.getTime() + index * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);
    const config = weeklyConfig.find(item => Number(item.week) === week) || {};
    const status = now > end ? 'completed' : (now >= start ? 'ongoing' : 'upcoming');
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start.getTime() + dayIndex * 86400000);
      return { dayIndex, shortName: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][dayIndex], date, label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`, key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` };
    });
    const events = (Array.isArray(config.events) ? config.events : []).map((event, index) => ({
      id: event.id || `legacy-${week}-${index}`,
      title: String(event.title || event.name || '').trim(),
      dayIndex: Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      date: event.date || event.startDate || '',
      startDayIndex: Number.isInteger(Number(event.startDayIndex)) ? Math.max(0, Math.min(6, Number(event.startDayIndex))) : Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      endDayIndex: Number.isInteger(Number(event.endDayIndex)) ? Math.max(0, Math.min(6, Number(event.endDayIndex))) : Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      startDate: event.startDate || event.date || '',
      endDate: event.endDate || event.date || '',
      color: normalizeRoundWeekEventColor(event.color)
    })).filter(event => event.title);
    return {
      week,
      title: resolveRoundWeekTitle(week, config.title),
      note: config.note || '',
      milestone: config.milestone || (week <= 12 ? (defaultMilestones[week] || '') : ''),
      visible: config.visible !== false,
      status,
      dateText: `${formatDate(start)} – ${formatDate(end)}`,
      days,
      events
    };
  });
}

function getRoundTimelineWeeksWithActivities(round, publishedOnly = true) {
  const weeks = getRoundWeekSchedule(round);
  const pad = value => String(value).padStart(2, '0');
  const toDateKey = value => {
    if (!value) return '';
    const date = new Date(value?.toDate ? value.toDate() : value);
    return isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const activities = (Array.isArray(round?.activities) ? round.activities : [])
    .filter(activity => (!publishedOnly || isActivityPublished(activity)) && (activity.startAt || activity.endAt))
    .map(activity => {
      const first = toDateKey(activity.startAt || activity.endAt);
      const last = toDateKey(activity.endAt || activity.startAt);
      return { id: `activity-${activity.id}`, activityId: activity.id, activity,
        title: String(activity.title || '').trim(), startDate: first <= last ? first : last,
        endDate: first <= last ? last : first, color: normalizeRoundWeekEventColor(activity.color) };
    }).filter(event => event.title && event.startDate && event.endDate);
  weeks.forEach(week => {
    const first = week.days[0]?.key;
    const last = week.days[6]?.key;
    week.events = distinguishOverlappingTimelineEvents(
      [...week.events, ...activities.filter(event => event.startDate <= last && event.endDate >= first)], week.days
    );
  });
  return weeks;
}

function rememberRoundTimelineEvents(roundId, weeks) {
  if (!state.roundTimelineEventMap) state.roundTimelineEventMap = new Map();
  state.roundTimelineEventMap.set(roundId, new Map(weeks.map(week => [week.week, week.events])));
}

function renderTimelineWeekDays(days = [], events = [], weekNumber = null, roundId = null) {
  const studentCalendar = weekNumber !== null;
  return `<div class="grid grid-cols-7 ${studentCalendar ? 'gap-1.5' : 'gap-1'} w-full mt-2 pt-2 border-t border-slate-200/80">${days.map(day => {
    const dayEvents = events.filter(event => roundWeekEventOccursOnDay(event, day));
    const titles = dayEvents.map(event => escapeHtml(event.title)).join(' · ');
    const isToday = day.date instanceof Date && day.date.toDateString() === new Date().toDateString();
    const eventColors = [...new Set(dayEvents.map(event => normalizeRoundWeekEventColor(event.displayColor || event.color)))];
    const eventColor = eventColors[0] || '';
    const dayClass = dayEvents.length ? '' : (isToday ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' : 'bg-white/70 border-slate-200 text-slate-500');
    const slices = eventColors.map((color, index) => `${color}38 ${index * 100 / eventColors.length}% ${(index + 1) * 100 / eventColors.length}%`).join(',');
    const dayStyle = eventColors.length > 1
      ? ` style="background:linear-gradient(90deg,${slices});border-color:${eventColor};color:#1e293b"`
      : (eventColor ? ` style="background-color:${eventColor}18;border-color:${eventColor};color:${eventColor}"` : '');
    const clickable = weekNumber !== null && dayEvents.length;
    const tag = clickable ? 'button' : 'span';
    const click = clickable ? ` type="button" onclick="event.stopPropagation(); openStudentTimelineDay(${weekNumber}, '${day.key}', ${roundId ? `'${escapeHtml(roundId)}'` : 'null'})" aria-label="Xem ${dayEvents.length} sự kiện ngày ${day.label}"` : '';
    return `<${tag}${click} title="${titles || `${day.shortName} ${day.label}`}" class="min-w-0 rounded-md border text-center ${studentCalendar ? 'min-h-[52px] px-1 py-1.5' : 'px-0.5 py-0.5'} ${dayClass} ${clickable ? 'cursor-pointer hover:shadow-md' : ''}"${dayStyle}><b class="block ${studentCalendar ? 'text-[11px]' : 'text-[8px]'} leading-none">${day.shortName}</b><b class="block ${studentCalendar ? 'text-[11px]' : 'text-[8px]'} leading-none mt-1">${day.label}</b>${dayEvents.length ? `<span class="flex justify-center gap-0.5">${eventColors.map(color => `<i class="${studentCalendar ? 'text-[11px]' : 'text-[8px]'} leading-none not-italic" style="color:${color}">●</i>`).join('')}</span>` : ''}</${tag}>`;
  }).join('')}</div>`;
}

function renderTimelineWeekEvents(events = [], weekNumber = null, roundId = null) {
  if (!events.length) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parseEventDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  };
  const shortDate = value => {
    const date = parseEventDate(value);
    return date ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}` : '';
  };
  return `<div class="mt-2 w-full space-y-1 text-left">${events.map((event, eventIndex) => {
    const color = normalizeRoundWeekEventColor(event.displayColor || event.color);
    const startValue = event.startDate || event.date || '';
    const endValue = event.endDate || startValue;
    const startDate = parseEventDate(startValue);
    const endDate = parseEventDate(endValue) || startDate;
    const dayCount = startDate ? Math.ceil((startDate - today) / 86400000) : null;
    const countdown = !startDate
      ? ''
      : (dayCount > 0 ? `Còn ${dayCount} ngày` : (endDate >= today ? (dayCount === 0 ? 'Hôm nay' : 'Đang diễn ra') : 'Đã diễn ra'));
    const dateLabel = startValue === endValue ? shortDate(startValue) : `${shortDate(startValue)}–${shortDate(endValue)}`;
    return `<button type="button" onclick="event.stopPropagation(); openStudentTimelineEvent(${weekNumber}, ${eventIndex}, ${roundId ? `'${escapeHtml(roundId)}'` : 'null'})" title="Xem chi tiết sự kiện" class="flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight hover:shadow-sm" style="background-color:${color}18;border-color:${color}66;color:${color}">
      <span class="shrink-0">📌 ${escapeHtml(dateLabel)}</span><span class="min-w-0 flex-1 truncate font-black">${escapeHtml(event.title)}</span>${countdown ? `<span class="shrink-0 font-bold opacity-80">${countdown}</span>` : ''}
    </button>`;
  }).join('')}</div>`;
}

window.closeStudentTimelineEvent = function() {
  document.getElementById('student-timeline-event-dialog')?.remove();
};

window.openStudentTimelineEvent = function(weekNumber, eventIndex, roundId = null) {
  const eventMap = roundId ? state.roundTimelineEventMap?.get(roundId) : state.studentTimelineEventMap;
  const event = eventMap?.get(Number(weekNumber))?.[Number(eventIndex)];
  if (!event) return;
  window.closeStudentTimelineEvent();
  const activity = event.activity;
  const details = activity?.descriptionHtml
    ? sanitizeRichHtml(activity.descriptionHtml)
    : escapeHtml(activity?.description || '').replace(/\n/g, '<br>');
  const dialog = document.createElement('div');
  dialog.id = 'student-timeline-event-dialog';
  dialog.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4';
  dialog.onclick = click => { if (click.target === dialog) window.closeStudentTimelineEvent(); };
  dialog.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Chi tiết sự kiện" class="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
    <div class="flex items-start justify-between gap-3"><div><div class="text-[11px] font-bold uppercase text-blue-700">${activity ? 'Mốc kế hoạch' : 'Sự kiện trong tuần'}</div><h3 class="mt-1 text-lg font-black text-slate-900">${escapeHtml(event.title)}</h3></div><button type="button" onclick="closeStudentTimelineEvent()" class="rounded-lg bg-slate-100 px-3 py-1.5 text-lg text-slate-600" aria-label="Đóng">×</button></div>
    <div class="mt-4 space-y-2 text-sm text-slate-700"><div>🕒 ${activity ? escapeHtml(fmtActivityTime(activity.startAt, activity.endAt)) : escapeHtml(event.startDate === event.endDate ? event.startDate : `${event.startDate} – ${event.endDate}`)}</div>${activity?.location ? `<div>📍 ${escapeHtml(activity.location)}</div>` : ''}${activity?.isTentative ? '<div class="text-amber-700">Thời gian dự kiến</div>' : ''}</div>
    ${details ? `<div class="rich-rendered-content mt-4 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-700">${details}</div>` : ''}
  </div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('button')?.focus();
};

window.openStudentTimelineDay = function(weekNumber, dateKey, roundId = null) {
  const eventMap = roundId ? state.roundTimelineEventMap?.get(roundId) : state.studentTimelineEventMap;
  const events = eventMap?.get(Number(weekNumber)) || [];
  const date = new Date(`${dateKey}T00:00:00`);
  const dayIndex = (date.getDay() + 6) % 7;
  const matches = events.map((event, index) => ({ event, index }))
    .filter(item => roundWeekEventOccursOnDay(item.event, { key: dateKey, dayIndex }));
  if (matches.length === 1) {
    window.openStudentTimelineEvent(weekNumber, matches[0].index, roundId);
    return;
  }
  if (matches.length < 2) return;
  window.closeStudentTimelineEvent();
  const dialog = document.createElement('div');
  dialog.id = 'student-timeline-event-dialog';
  dialog.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4';
  dialog.onclick = click => { if (click.target === dialog) window.closeStudentTimelineEvent(); };
  dialog.innerHTML = `<div role="dialog" aria-modal="true" aria-label="Sự kiện trong ngày" class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div class="flex items-center justify-between gap-2"><h3 class="text-lg font-black text-slate-900">Sự kiện ngày ${escapeHtml(dateKey)}</h3><button type="button" onclick="closeStudentTimelineEvent()" class="rounded-lg bg-slate-100 px-3 py-1.5 text-lg" aria-label="Đóng">×</button></div><div class="mt-4 space-y-2">${matches.map(item => `<button type="button" onclick="openStudentTimelineEvent(${weekNumber}, ${item.index}, ${roundId ? `'${escapeHtml(roundId)}'` : 'null'})" class="block w-full rounded-xl border border-slate-200 p-3 text-left text-sm font-bold text-blue-800 hover:bg-blue-50">${escapeHtml(item.event.title)}</button>`).join('')}</div></div>`;
  document.body.appendChild(dialog);
};

function renderAdminRoundTimelinePreview(round) {
  if (typeof renderUnifiedRoundTimeline === 'function') {
    return renderUnifiedRoundTimeline(round, { role: 'admin', isAdmin: true });
  }
  const weeks = getRoundTimelineWeeksWithActivities(round, false);
  rememberRoundTimelineEvents(round.id, weeks);
  const visibleWeeks = weeks.filter(week => week.visible).length;
  const hiddenWeeks = weeks.length - visibleWeeks;
  const statusStyles = {
    completed: { card: 'bg-emerald-50 border-emerald-300', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Đã qua', icon: '✓' },
    ongoing: { card: 'bg-blue-50 border-blue-400 ring-2 ring-blue-200', badge: 'bg-blue-600 text-white border-blue-600', label: 'Đang diễn ra', icon: '●' },
    upcoming: { card: 'bg-slate-50 border-slate-200', badge: 'bg-white text-slate-500 border-slate-200', label: 'Chưa tới', icon: null }
  };

  const introCards = [
    { icon: '📝', title: 'Đăng ký đề tài', subtitle: 'Đề tài ĐATN' },
    { icon: '👨‍🏫', title: 'Phân công GVHD', subtitle: isDirectSupervisorAssignment(round) ? 'Khoa phân công' : 'Xét nguyện vọng' }
  ].map(card => `
    <div role="button" tabindex="0" onclick="openRoundWeekEditor('${round.id}')" class="ifa-timeline-card min-w-[215px] rounded-2xl border border-slate-200 bg-white p-3 flex flex-col items-center justify-center text-center hover:border-blue-400 hover:shadow-md cursor-pointer transition">
      <span class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg mb-2">${card.icon}</span>
      <span class="font-black text-xs text-slate-900">${card.title}</span>
      <span class="text-[10px] text-slate-500 mt-1">${card.subtitle}</span>
    </div>`).join('');

  const weekCards = weeks.map(week => {
    const style = statusStyles[week.status] || statusStyles.upcoming;
    const resolvedTitle = resolveRoundWeekTitle(week.week, week.title);
    const circleContent = style.icon || (week.week > 12 ? (week.week === 13 ? '📄' : week.week === 14 ? '🎓' : '📌') : week.week);
    return `
      <div role="button" tabindex="0" onclick="openRoundWeekEditor('${round.id}', ${week.week})" class="ifa-timeline-card relative min-w-[290px] rounded-2xl border p-3 flex flex-col items-center text-center cursor-pointer hover:shadow-md transition ${style.card} ${week.visible ? '' : 'opacity-55 border-dashed grayscale'}">
        <div class="flex items-center justify-between gap-1 w-full mb-1">
          <span class="font-black text-xs text-slate-900 whitespace-nowrap">${escapeHtml(resolvedTitle)}</span>
          ${week.milestone ? `<span class="px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-black text-[9px] leading-tight text-center truncate max-w-[100px]" title="${escapeHtml(week.milestone)}">🚩 ${escapeHtml(week.milestone)}</span>` : ''}
          <div class="flex items-center gap-1 shrink-0">
            <span class="px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${week.visible ? style.badge : 'bg-slate-200 text-slate-600 border-slate-300'}">${week.visible ? style.label : 'Đang ẩn'}</span>
            <button type="button" onclick="toggleRoundTimelineWeekVisibility('${round.id}', ${week.week}, event)" class="px-1.5 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-[9px] font-bold shadow-xs transition cursor-pointer ${week.visible ? 'text-slate-600 hover:text-slate-900' : 'text-blue-700 hover:text-blue-900'}">${week.visible ? 'Ẩn' : 'Hiện'}</button>
          </div>
        </div>
        <span class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black my-1 ${week.status === 'ongoing' ? 'bg-blue-600 text-white' : week.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}">${circleContent}</span>
        <span class="font-mono font-bold text-[11px] text-slate-700">${week.dateText}</span>
        ${renderTimelineWeekDays(week.days, week.events, week.week, round.id)}
        ${renderTimelineWeekEvents(week.events, week.week, round.id)}
        ${week.note ? `<span class="text-[9px] text-slate-500 mt-1 line-clamp-1">${escapeHtml(week.note)}</span>` : ''}
      </div>`;
  }).join('');

  return `
    <section class="px-4 py-3.5 bg-white border-b border-slate-200">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg">🗓️</span>
          <div>
            <div class="font-black text-sm text-slate-900">Lộ trình đồ án tốt nghiệp & tiến độ thực hiện</div>
            <div class="text-[10px] text-slate-500">Kế hoạch ${weeks.length} tuần · ${visibleWeeks} tuần hiển thị${hiddenWeeks ? ` · ${hiddenWeeks} tuần đang ẩn` : ''}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="openRoundWeekEditor('${round.id}')" class="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] transition">＋ Thêm / sửa mốc</button>
        </div>
      </div>
      <div class="flex gap-3 overflow-x-auto pb-2 snap-x">${introCards}${weekCards}</div>
    </section>`;
}

window.openRoundWeekEditor = async function(roundId, weekNumber = null) {
  await window.editRoundModal(roundId, 'info');
  window.setTimeout(() => {
    const target = weekNumber
      ? document.getElementById(`round-week-${weekNumber}-title`)
      : document.getElementById('round-weekly-content-editor-wrap');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (weekNumber) target?.focus();
  }, 180);
};

window.toggleRoundTimelineWeekVisibility = async function(roundId, weekNumber, event) {
  event?.stopPropagation();
  const round = (state.rounds || []).find(item => item.id === roundId);
  if (!round) return;
  const durationWeeks = parseInt(round.durationWeeks, 10) || 12;
  const existing = Array.isArray(round.timelineWeeksConfig) ? round.timelineWeeksConfig : [];
  const nextConfig = Array.from({ length: durationWeeks }, (_, index) => {
    const week = index + 1;
    const current = existing.find(item => Number(item.week) === week) || { week, title: `Tuần ${week}`, note: '', milestone: '' };
    return week === Number(weekNumber) ? { ...current, visible: current.visible === false } : { ...current, visible: current.visible !== false };
  });
  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), { timelineWeeksConfig: nextConfig, updatedAt: serverTimestamp() });
    round.timelineWeeksConfig = nextConfig;
    renderAdminRoundsCards();
    if (state.selectedRoundId === roundId && typeof renderStudentTimelineWeeks === 'function') renderStudentTimelineWeeks();
    const changed = nextConfig.find(item => Number(item.week) === Number(weekNumber));
    showToast(changed?.visible === false ? `Đã ẩn Tuần ${weekNumber} khỏi trang sinh viên.` : `Đã hiện Tuần ${weekNumber} trên trang sinh viên.`, 'success');
  } catch (error) {
    showToast('Không thể cập nhật hiển thị tuần: ' + error.message, 'error');
  }
};

window.moveAdminRoundCard = async function(roundId, neighborId) {
  if (!state.isAdmin || !neighborId || state.roundOrderSaving) return;
  const ordered = (state.rounds || []).filter(round => !round.deleted && !round.isDeleted);
  const sourceIndex = ordered.findIndex(round => round.id === roundId);
  const neighborIndex = ordered.findIndex(round => round.id === neighborId);
  if (sourceIndex < 0 || neighborIndex < 0) return;
  [ordered[sourceIndex], ordered[neighborIndex]] = [ordered[neighborIndex], ordered[sourceIndex]];
  state.roundOrderSaving = true;
  try {
    for (let offset = 0; offset < ordered.length; offset += 450) {
      const batch = writeBatch(db);
      ordered.slice(offset, offset + 450).forEach((round, index) => {
        batch.update(doc(db, 'graduationRounds', round.id), { displayOrder: offset + index });
      });
      await batch.commit();
    }
    ordered.forEach((round, index) => { round.displayOrder = index; });
    const omitted = (state.rounds || []).filter(round => round.deleted || round.isDeleted);
    state.rounds = [...ordered, ...omitted];
    renderAdminRoundsCards();
    renderAdminRoundsTable();
    renderRoundsDropdowns();
    showToast('Đã lưu thứ tự các đợt tốt nghiệp.', 'success');
  } catch (error) {
    showToast('Không thể lưu thứ tự đợt: ' + error.message, 'error');
  } finally {
    state.roundOrderSaving = false;
  }
};

window.renderAdminRoundsCards = function() {
  const container = document.getElementById('admin-rounds-cards');
  if (!container) return;

  if (!state.roundsLoaded && (!state.rounds || state.rounds.length === 0)) {
    container.innerHTML = `
      <div class="card-surface p-10 text-center space-y-3 bg-white border border-slate-200 rounded-2xl w-full">
        <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p class="text-sm font-semibold text-slate-600">Đang tải danh sách đợt tốt nghiệp...</p>
      </div>
    `;
    return;
  }

  if (state.roundsLoadError && (!state.rounds || state.rounds.length === 0)) {
    container.innerHTML = `
      <div class="card-surface p-10 text-center space-y-3 bg-white border border-rose-200 rounded-2xl w-full">
        <div class="text-3xl text-rose-500 font-bold">⚠️</div>
        <p class="text-base font-bold text-rose-800">Không thể tải danh sách đợt tốt nghiệp.</p>
        <p class="text-xs text-slate-500">${escapeHtml(state.roundsLoadError.message || 'Lỗi kết nối cơ sở dữ liệu.')}</p>
        <div class="pt-2">
          <button type="button" onclick="loadRounds()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
            🔄 Thử lại
          </button>
        </div>
      </div>
    `;
    return;
  }

  try {
    const totalBadge = document.getElementById('admin-rounds-total-badge');
    const allNonDeleted = (state.rounds || []).filter(r => !r.deleted && !r.isDeleted);
    if (totalBadge) totalBadge.textContent = `${allNonDeleted.length} đợt`;

    const filter = state.adminRoundsFilter || 'all';
    const searchQuery = (state.adminRoundsSearch || '').trim().toLowerCase();

    let filtered = allNonDeleted.filter(r => {
      const cat = getRoundStatusCategory(r);
      if (filter === 'all') return true;
      if (filter === 'hidden') return cat === 'hidden';
      if (filter === 'upcoming') return cat === 'upcoming';
      if (filter === 'running') return cat === 'running';
      if (filter === 'ended') return cat === 'ended';
      return true;
    });

    if (searchQuery) {
      filtered = filtered.filter(r => {
        const title = (r.title || '').toLowerCase();
        const code = (r.shortCode || r.slug || r.roundName || r.id || '').toLowerCase();
        const year = (r.academicYear || '').toLowerCase();
        return title.includes(searchQuery) || code.includes(searchQuery) || year.includes(searchQuery);
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card-surface p-10 text-center space-y-3 bg-white border border-dashed border-slate-300 rounded-2xl w-full">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl font-bold">
            📁
          </div>
          <p class="text-base font-bold text-slate-800">Không có đợt tốt nghiệp nào ở mục này</p>
          <p class="text-sm text-slate-500">Bạn có thể chuyển bộ lọc hoặc bấm "Tạo đợt tốt nghiệp" để thêm mới.</p>
          <div class="pt-1">
            <button onclick="openCreateRoundModal()" class="px-4 py-2 bg-tdtu-blue hover:bg-tdtu-dark text-white rounded-xl text-sm font-semibold shadow-xs transition-all">
              + Tạo đợt tốt nghiệp
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((r, cardIndex) => {
      const directAssignment = isDirectSupervisorAssignment(r);
      const cat = getRoundStatusCategory(r);
      const shortCode = r.shortCode || r.slug || r.roundName || r.id;
      const timeRangeStr = fmtDateRange24h(r.openAtDate, r.closeAtDate);
      const isCurrentActive = Boolean(r.isActive);

      let statusBadgeHtml = '';
      if (cat === 'running') {
        statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Đang diễn ra</span>';
      } else if (cat === 'upcoming') {
        statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Sắp mở</span>';
      } else if (cat === 'ended') {
        statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Đã kết thúc</span>';
      } else if (cat === 'hidden') {
        statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Đã ẩn</span>';
      }

      const activeBadgeHtml = isCurrentActive 
        ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white shadow-2xs">★ Đợt hiện hành</span>'
        : '';

      const modeBadgeHtml = directAssignment
        ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">Khoa phân công GVHD</span>'
        : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Nguyện vọng GVHD</span>';

      // Metrics
      const eligibleCount = typeof r.eligibleCount === 'number' ? r.eligibleCount : (r.eligibleStudentsCount || 0);
      const supCount = typeof r.supervisorCount === 'number' ? r.supervisorCount : (r.supervisorsCount || 0);
      const regCount = typeof r.registrationsCount === 'number' ? r.registrationsCount : 0;
      const actCount = Array.isArray(r.activities) ? r.activities.length : (typeof r.activitiesCount === 'number' ? r.activitiesCount : 0);
      const assignedCount = typeof r.assignedCount === 'number'
        ? r.assignedCount
        : (typeof r.officialAssignmentsCount === 'number' ? r.officialAssignmentsCount : null);
      const unassignedCount = assignedCount === null ? null : Math.max(eligibleCount - assignedCount, 0);
      const driveRootId = r.driveRootFolderId || r.rootDriveFolderId || '';
      const driveRootUrl = r.driveRootFolderUrl || r.rootDriveFolderUrl || (driveRootId ? `https://drive.google.com/drive/folders/${driveRootId}` : '');
      const driveFoldersCount = Array.isArray(r.driveFolderStructure)
        ? r.driveFolderStructure.length
        : normalizeRoundDriveFolderNames(r.driveSubfolderNames || []).length;

      let phaseInfo = '';
      if (directAssignment && r.reviewStatus !== 'completed') {
        phaseInfo = 'Khoa phân công trực tiếp';
      } else if (r.reviewStatus === 'completed') {
        phaseInfo = 'Đã chốt phân công GVHD';
      } else if (r.currentRank) {
        phaseInfo = `Đang xét NV${r.currentRank}`;
      } else if (cat === 'running') {
        phaseInfo = 'Đang nhận đăng ký';
      } else if (cat === 'upcoming') {
        phaseInfo = 'Chưa mở cổng';
      } else {
        phaseInfo = 'Đã đóng đợt';
      }

      const isClosed = cat === 'ended';
      const isHidden = cat === 'hidden';

      return `
        <article class="card-surface rounded-2xl overflow-hidden border ${isCurrentActive ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} shadow-sm hover:shadow-lg transition-all w-full">
          <header class="relative bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white p-4 sm:p-5">
            <div class="absolute left-4 top-4 flex flex-col gap-1" aria-label="Sắp xếp thứ tự đợt">
              <button type="button" onclick="moveAdminRoundCard('${r.id}', '${filtered[cardIndex - 1]?.id || ''}')" ${cardIndex === 0 ? 'disabled' : ''} title="Đưa đợt lên trên" aria-label="Đưa ${escapeHtml(r.title || 'đợt')} lên trên" class="h-5 w-7 rounded border border-white/25 bg-white/10 text-[10px] leading-none hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed">▲</button>
              <button type="button" onclick="moveAdminRoundCard('${r.id}', '${filtered[cardIndex + 1]?.id || ''}')" ${cardIndex === filtered.length - 1 ? 'disabled' : ''} title="Đưa đợt xuống dưới" aria-label="Đưa ${escapeHtml(r.title || 'đợt')} xuống dưới" class="h-5 w-7 rounded border border-white/25 bg-white/10 text-[10px] leading-none hover:bg-white/25 disabled:opacity-30 disabled:cursor-not-allowed">▼</button>
            </div>
            <button type="button" onclick="copyRoundLink('${r.id}', '${shortCode}')" title="Bấm để sao chép liên kết đợt" class="block w-full pl-11 text-left group mb-3">
              <h3 class="text-lg sm:text-xl xl:text-2xl font-black tracking-tight leading-tight lg:whitespace-nowrap group-hover:text-blue-200 transition-colors">${escapeHtml(r.title || '')}</h3>
            </button>
            <div class="flex flex-wrap items-center gap-2 mb-2.5">
              <span class="font-mono text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-amber-300 font-bold border border-white/10">NH ${escapeHtml(r.academicYear || '—')}</span>
              ${statusBadgeHtml}
              <span class="inline-flex items-center gap-2 whitespace-nowrap">
                ${activeBadgeHtml}
                ${modeBadgeHtml}
              </span>
            </div>
            <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
              <div class="min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span class="inline-flex items-center gap-1.5"><span>🗓️</span><span>${timeRangeStr}</span></span>
                <span class="inline-flex items-center gap-1.5"><span>📌</span><strong class="text-slate-100">${phaseInfo}</strong></span>
                <span class="inline-flex items-center gap-1.5"><span>📁</span><span class="${driveRootUrl ? 'text-emerald-300' : 'text-amber-300'}">${driveRootUrl ? `Drive đã kết nối · ${driveFoldersCount} thư mục con` : 'Chưa cấu hình Drive'}</span></span>
              </div>
              <div class="flex flex-wrap items-center gap-2 shrink-0">
                ${driveRootUrl ? `<a href="${escapeHtml(driveRootUrl)}" target="_blank" rel="noopener noreferrer" class="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"><span>↗</span><span>Thư mục Drive</span></a>` : ''}
                <button type="button" onclick="editRoundModal('${r.id}')" class="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl transition">✏️ Sửa đợt</button>
                <button type="button" onclick="toggleRoundCloseStatus('${r.id}')" class="px-3 py-2 ${isClosed ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-amber-400 hover:bg-amber-300'} text-slate-950 font-black text-xs rounded-xl transition">${isClosed ? '↺ Mở lại' : 'Kết thúc đợt'}</button>
                <button type="button" onclick="toggleRoundHiddenStatus('${r.id}')" class="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs rounded-xl transition">${isHidden ? '👁️ Hiện lại' : 'Lưu trữ'}</button>
              </div>
            </div>
          </header>

          <div class="grid grid-cols-2 lg:grid-cols-4 bg-slate-50/80 divide-x divide-y lg:divide-y-0 divide-slate-200 border-b border-slate-200">
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'eligible-students')" class="px-3 py-2.5 text-center hover:bg-blue-50 transition group">
              <div class="text-[10px] font-bold text-slate-400 group-hover:text-blue-700 uppercase tracking-wider">Tổng sinh viên ↗</div>
              <div class="text-xl font-black text-slate-950 mt-0.5">${eligibleCount}</div>
            </button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'review', 'assigned')" class="px-3 py-2.5 text-center hover:bg-emerald-50 transition group">
              <div class="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700 uppercase tracking-wider">Đã phân GVHD ↗</div>
              <div class="text-xl font-black text-emerald-600 mt-0.5">${assignedCount === null ? '—' : assignedCount} ${unassignedCount === null ? '<span class="text-[10px] font-normal text-slate-400">chưa tổng hợp</span>' : `<span class="text-[10px] font-normal text-slate-500">(${unassignedCount} chưa)</span>`}</div>
            </button>
            <button type="button" onclick="editRoundModal('${r.id}', 'supervisors')" class="px-3 py-2.5 text-center hover:bg-indigo-50 transition group">
              <div class="text-[10px] font-bold text-slate-400 group-hover:text-indigo-700 uppercase tracking-wider">GVHD tham gia ↗</div>
              <div class="text-xl font-black text-indigo-700 mt-0.5">${supCount}</div>
            </button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'timeline')" class="px-3 py-2.5 text-center hover:bg-purple-50 transition group">
              <div class="text-[10px] font-bold text-slate-400 group-hover:text-purple-700 uppercase tracking-wider">Mốc kế hoạch ↗</div>
              <div class="text-xl font-black text-purple-700 mt-0.5">${actCount}</div>
            </button>
          </div>

          ${renderAdminRoundTimelinePreview(r)}

          <div class="px-4 py-3 bg-white flex flex-wrap items-center justify-center gap-2">
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'timeline')" class="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-800 transition shadow-sm">📅 Kế hoạch (${actCount})</button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'eligible-students')" class="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-800 transition shadow-sm">🎓 Sinh viên (${eligibleCount})</button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'registrations')" class="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 transition shadow-sm">📝 Đăng ký (${regCount})</button>
            ${directAssignment ? '' : `<button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'review')" class="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-800 transition shadow-sm">🎯 Xét nguyện vọng</button>`}
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'review', 'assigned')" class="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-800 transition shadow-sm">👥 ${directAssignment ? 'Phân công GVHD' : 'Kết quả phân công'}</button>
            <button type="button" onclick="openRoundWorkspaceModal('${r.id}', 'scoring-dashboard')" class="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-300 text-slate-800 transition shadow-sm">📊 Quản lý điểm</button>
            <span class="hidden sm:block w-px h-6 bg-slate-200 mx-1" aria-hidden="true"></span>
            <div class="flex items-center justify-center gap-1 text-xs">
              ${!isCurrentActive ? `<button type="button" onclick="setActiveRound('${r.id}')" class="px-2.5 py-1.5 text-blue-700 hover:bg-blue-50 rounded-lg font-bold transition">⭐ Đặt hiện hành</button>` : ''}
              <button type="button" onclick="softDeleteRound('${r.id}')" class="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition">🗑️ Thùng rác</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (renderErr) {
    console.error('[Rounds] renderAdminRoundsCards error:', renderErr);
    container.innerHTML = `
      <div class="card-surface p-10 text-center space-y-3 bg-white border border-rose-200 rounded-2xl w-full">
        <div class="text-3xl text-rose-500 font-bold">⚠️</div>
        <p class="text-base font-bold text-rose-800">Lỗi hiển thị danh sách đợt tốt nghiệp.</p>
        <p class="text-xs text-slate-500">${escapeHtml(renderErr.message || String(renderErr))}</p>
        <div class="pt-2">
          <button type="button" onclick="renderAdminRoundsCards()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
            🔄 Thử lại
          </button>
        </div>
      </div>
    `;
  }
};

window.navigateToRoundAction = async function(roundId, actionKey, subSection = null) {
  if (!roundId) return;
  state.selectedRoundId = roundId;
  state.activeRound = (state.rounds || []).find(r => r.id === roundId) || null;

  // Sync selectors across all admin views
  const dropdownIds = [
    'select-active-round',
    'admin-timeline-round-select',
    'admin-round-student-select',
    'admin-round-reg-select',
    'admin-review-round-select',
    'admin-round-sup-select',
    'admin-scoring-round-select'
  ];
  dropdownIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = roundId;
  });

  window.switchAdminTab(actionKey);

  if (actionKey === 'review' && subSection === 'assigned') {
    setTimeout(() => {
      const targetSection = document.getElementById('admin-official-supervisors-section') ||
                            document.getElementById('admin-assigned-supervisors-tbody') ||
                            document.getElementById('admin-review-assigned-card');
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 250);
  }
};

window.openRoundWorkspaceModal = async function(roundId, actionKey, subSection = null) {
  if (!roundId || !actionKey) return;
  if (state.roundWorkspaceModal?.panel) window.closeRoundWorkspaceModal();

  await window.navigateToRoundAction(roundId, actionKey, subSection);

  const panel = document.getElementById(`atab-panel-${actionKey}`);
  const modal = document.getElementById('modal-round-workspace');
  const body = document.getElementById('modal-round-workspace-body');
  const title = document.getElementById('modal-round-workspace-title');
  const subtitle = document.getElementById('modal-round-workspace-subtitle');
  if (!panel || !modal || !body) return;

  const round = (state.rounds || []).find(item => item.id === roundId);
  const labels = {
    timeline: 'Kế hoạch đợt',
    'eligible-students': 'Danh sách sinh viên',
    registrations: 'Danh sách đăng ký',
    review: isDirectSupervisorAssignment(round) ? 'Phân công GVHD' : 'Xét nguyện vọng & Phân công',
    'scoring-dashboard': 'Quản lý điểm'
  };

  const placeholder = document.createComment(`round-workspace-${actionKey}`);
  panel.parentNode?.insertBefore(placeholder, panel);
  body.replaceChildren(panel);
  panel.classList.remove('hidden');

  state.roundWorkspaceModal = {
    panel,
    placeholder,
    previousBodyOverflow: document.body.style.overflow
  };
  if (title) title.textContent = labels[actionKey] || 'Quản lý đợt tốt nghiệp';
  if (subtitle) subtitle.textContent = round?.title || 'Đợt tốt nghiệp';
  document.body.style.overflow = 'hidden';
  modal.classList.remove('hidden');

  if (actionKey === 'review' && subSection === 'assigned') {
    setTimeout(() => {
      document.getElementById('admin-official-supervisors-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  }
};

window.closeRoundWorkspaceModal = function() {
  const modalState = state.roundWorkspaceModal;
  const modal = document.getElementById('modal-round-workspace');
  if (modalState?.panel && modalState?.placeholder?.parentNode) {
    modalState.placeholder.parentNode.insertBefore(modalState.panel, modalState.placeholder);
    modalState.placeholder.remove();
    modalState.panel.classList.add('hidden');
  }
  document.body.style.overflow = modalState?.previousBodyOverflow || '';
  state.roundWorkspaceModal = null;
  modal?.classList.add('hidden');
  window.switchAdminTab('rounds');
};

window.updateRoundBreadcrumb = function(tabKey) {
  const roundSubTabs = ['timeline', 'eligible-students', 'registrations', 'review', 'preview-student', 'scoring-dashboard'];
  if (!roundSubTabs.includes(tabKey)) return;

  const bEl = document.getElementById(`round-breadcrumb-${tabKey}`);
  if (!bEl) return;

  const currentRound = (state.rounds || []).find(r => r.id === state.selectedRoundId);
  const roundTitle = currentRound ? (currentRound.title || 'Đợt tốt nghiệp') : 'Chưa chọn đợt';
  const roundYear = currentRound ? (currentRound.academicYear || '') : '';

  const tabLabels = {
    'timeline': 'Kế hoạch đợt',
    'eligible-students': 'Danh sách SV thực hiện',
    'registrations': 'Danh sách đăng ký',
    'review': 'Xét nguyện vọng',
    'preview-student': 'Xem trước giao diện Sinh viên',
    'scoring-dashboard': 'Quản lý điểm'
  };
  const currentLabel = tabKey === 'review' && isDirectSupervisorAssignment(currentRound)
    ? 'Phân công GVHD'
    : (tabLabels[tabKey] || tabKey);

  bEl.innerHTML = `
    <div class="flex items-center justify-between gap-3 bg-slate-100/90 hover:bg-slate-100 px-4 py-3 rounded-xl border border-slate-200/80 text-sm transition-colors">
      <div class="flex items-center gap-2 min-w-0">
        <button type="button" onclick="switchAdminTab('rounds')" class="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 shrink-0 transition-colors">
          <span>←</span>
          <span>Đợt tốt nghiệp</span>
        </button>
        <span class="text-slate-300 font-bold">/</span>
        <span class="font-bold text-slate-800 truncate" title="${roundTitle}">${roundTitle}</span>
        <span class="text-slate-300 font-bold">/</span>
        <span class="text-slate-500 font-semibold shrink-0">${currentLabel}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${roundYear ? `<span class="text-xs font-bold px-2.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">${roundYear}</span>` : ''}
        <button type="button" onclick="switchAdminTab('rounds')" class="text-xs text-slate-500 hover:text-slate-900 font-medium underline">Đổi đợt</button>
      </div>
    </div>
  `;
};

window.duplicateRoundModal = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) {
    showToast('Không tìm thấy đợt tốt nghiệp cần sao chép!', 'error');
    return;
  }

  // Open create round modal
  await window.openCreateRoundModal();

  // Populate from source
  document.getElementById('modal-round-title').textContent = 'Sao chép Đợt Đồ án Tốt nghiệp';
  document.getElementById('round-form-id').value = '';
  document.getElementById('round-form-title').value = `(Bản sao) ${r.title || ''}`;
  document.getElementById('round-form-year').value = r.academicYear || '';
  document.getElementById('round-form-name').value = `${(r.shortCode || r.slug || 'round')}-copy`;
  document.getElementById('round-form-status').value = 'draft';
  document.getElementById('round-form-pref-count').value = r.preferenceCount || '3';
  document.getElementById('round-form-selection-mode').value = r.selectionMode || 'cards';
  const assignmentMode = getSupervisorAssignmentMode(r);
  const assignmentModeInput = document.querySelector(`input[name="supervisor-assignment-mode"][value="${assignmentMode}"]`);
  if (assignmentModeInput) assignmentModeInput.checked = true;
  if (document.getElementById('round-form-allow-edit')) {
    document.getElementById('round-form-allow-edit').checked = r.allowStudentEdit !== false;
  }
  if (document.getElementById('round-form-allow-topic-edit')) {
    document.getElementById('round-form-allow-topic-edit').checked = r.allowTopicEdit !== false;
  }
  if (document.getElementById('round-form-allow-pref-edit')) {
    document.getElementById('round-form-allow-pref-edit').checked = r.allowPreferenceEdit !== false;
  }

  const folderNamesInput = document.getElementById('round-drive-subfolder-names');
  if (folderNamesInput) {
    folderNamesInput.value = normalizeRoundDriveFolderNames(
      r.driveSubfolderNames || (r.driveFolderStructure || []).map(item => item?.name || item?.folderName)
    ).join('\n');
    updateRoundDriveFolderPreview();
  }

  showToast('Đã điền thông tin từ đợt gốc. Vui lòng kiểm tra và lưu đợt mới.', 'info');
};

window.toggleRoundCloseStatus = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;
  const isClosed = (r.status === 'closed') || (r.closeAtDate && Date.now() > new Date(r.closeAtDate).getTime());
  const newStatus = isClosed ? 'open' : 'closed';
  const actionText = isClosed ? 'Mở lại' : 'Kết thúc';

  const ok = await showConfirm(`Xác nhận ${actionText.toLowerCase()} đợt "${r.title}"?`);
  if (!ok) return;

  try {
    showLoading(`Đang ${actionText.toLowerCase()} đợt...`);
    const payload = {
      status: newStatus,
      updatedAt: serverTimestamp()
    };
    if (isClosed) {
      const now = new Date();
      const in30d = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
      payload.closeAt = in30d;
      payload.status = 'open';
    }
    await updateDoc(doc(db, 'graduationRounds', roundId), payload);
    r.status = payload.status;
    if (payload.closeAt) r.closeAtDate = payload.closeAt;
    showToast(`Đã ${actionText.toLowerCase()} đợt thành công!`, 'success');
    renderAdminRoundsCards();
  } catch (err) {
    console.error('toggleRoundCloseStatus error:', err);
    showToast('Lỗi cập nhật trạng thái: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
};

window.toggleRoundHiddenStatus = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;
  const isHidden = r.hidden || r.status === 'hidden';
  const newHidden = !isHidden;
  const actionText = newHidden ? 'Ẩn' : 'Bỏ ẩn (Hiện)';

  const ok = await showConfirm(`Xác nhận ${actionText.toLowerCase()} đợt "${r.title}"?`);
  if (!ok) return;

  try {
    showLoading(`Đang ${actionText.toLowerCase()} đợt...`);
    const payload = {
      hidden: newHidden,
      status: newHidden ? 'hidden' : 'open',
      updatedAt: serverTimestamp()
    };
    await updateDoc(doc(db, 'graduationRounds', roundId), payload);
    r.hidden = newHidden;
    r.status = payload.status;
    showToast(`Đã ${actionText.toLowerCase()} đợt thành công!`, 'success');
    renderAdminRoundsCards();
  } catch (err) {
    console.error('toggleRoundHiddenStatus error:', err);
    showToast('Lỗi cập nhật trạng thái ẩn: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof loadRounds !== 'undefined') window.loadRounds = loadRounds;
  if (typeof refreshRoundCardMetrics !== 'undefined') window.refreshRoundCardMetrics = refreshRoundCardMetrics;
  if (typeof renderRoundsDropdowns !== 'undefined') window.renderRoundsDropdowns = renderRoundsDropdowns;
  if (typeof selectRound !== 'undefined') window.selectRound = selectRound;
  if (typeof resolveStudentSupervisorProfiles !== 'undefined') window.resolveStudentSupervisorProfiles = resolveStudentSupervisorProfiles;
  if (typeof renderRoundHeader !== 'undefined') window.renderRoundHeader = renderRoundHeader;
  if (typeof startCountdown !== 'undefined') window.startCountdown = startCountdown;
  if (typeof formatDuration !== 'undefined') window.formatDuration = formatDuration;
  if (typeof renderAdminTrashTable !== 'undefined') window.renderAdminTrashTable = renderAdminTrashTable;
  if (typeof renderAdminRoundsTable !== 'undefined') window.renderAdminRoundsTable = renderAdminRoundsTable;
  if (typeof getRoundStatusCategory !== 'undefined') window.getRoundStatusCategory = getRoundStatusCategory;
  if (typeof getRoundWeekSchedule !== 'undefined') window.getRoundWeekSchedule = getRoundWeekSchedule;
  if (typeof getRoundTimelineWeeksWithActivities !== 'undefined') window.getRoundTimelineWeeksWithActivities = getRoundTimelineWeeksWithActivities;
  if (typeof rememberRoundTimelineEvents !== 'undefined') window.rememberRoundTimelineEvents = rememberRoundTimelineEvents;
  if (typeof renderTimelineWeekDays !== 'undefined') window.renderTimelineWeekDays = renderTimelineWeekDays;
  if (typeof renderTimelineWeekEvents !== 'undefined') window.renderTimelineWeekEvents = renderTimelineWeekEvents;
  if (typeof renderAdminRoundTimelinePreview !== 'undefined') window.renderAdminRoundTimelinePreview = renderAdminRoundTimelinePreview;
  if (typeof parseRoundDate !== 'undefined') window.parseRoundDate = parseRoundDate;
  if (typeof fmtDate !== 'undefined') window.fmtDate = fmtDate;
  if (typeof toMillis !== 'undefined') window.toMillis = toMillis;
  if (typeof updateTimer !== 'undefined') window.updateTimer = updateTimer;
  if (typeof pad !== 'undefined') window.pad = pad;
  if (typeof formatDate !== 'undefined') window.formatDate = formatDate;
  if (typeof toDateKey !== 'undefined') window.toDateKey = toDateKey;
  if (typeof parseEventDate !== 'undefined') window.parseEventDate = parseEventDate;
  if (typeof shortDate !== 'undefined') window.shortDate = shortDate;
}
