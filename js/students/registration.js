const renderRoundHeader = () => window.renderRoundHeader?.();

// --- Module Bridges ---
const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : (reg?.officialSupervisors || reg?.supervisors || []));
const normalizeOfficialAssignment = (a, r) => (typeof window !== 'undefined' && window.normalizeOfficialAssignment ? window.normalizeOfficialAssignment(a, r) : (a || r));
const shouldSkipStudentSupervisorPreference = (rnd) => (typeof window !== 'undefined' && window.shouldSkipStudentSupervisorPreference ? window.shouldSkipStudentSupervisorPreference(rnd) : false);
async function loadStudentSelfProfile(mssv) {
  if (typeof window !== 'undefined' && window.loadStudentSelfProfile && window.loadStudentSelfProfile !== loadStudentSelfProfile) {
    return window.loadStudentSelfProfile(mssv);
  }
  if (!mssv) return null;
  try {
    const snap = await getDoc(doc(db, 'graduationStudentProfiles', mssv));
    state.studentSelfProfile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    state.studentSelfProfile = null;
  }
  return state.studentSelfProfile;
}
if (typeof window !== 'undefined') window.loadStudentSelfProfile = loadStudentSelfProfile;

const populateRegistrationStudentForm = () => window.populateRegistrationStudentForm?.();
const collectOfficialFormFields = () => (typeof window !== 'undefined' && window.collectOfficialFormFields ? window.collectOfficialFormFields() : {});
const validateOfficialFormFields = (f) => (typeof window !== 'undefined' && window.validateOfficialFormFields ? window.validateOfficialFormFields(f) : true);

export function applyStudentProgressVisibility() {
  const isStudentView = state.currentView === 'student' || state.impersonation?.target?.type === 'student' || (!state.isAdmin && state.isStudent);
  if (!isStudentView && state.isAdmin && !state.impersonation) {
    return;
  }

  const journeyCard = document.getElementById('student-journey-card');
  const milestonesWrap = document.getElementById('hero-milestones-count-wrap')
    || document.getElementById('hero-milestones-count')?.closest('div');
  const thesisGuideLink = document.getElementById('hero-thesis-guide-link');
  const supervisorCard = document.getElementById('hero-supervisor-info-card');
  const finalScoreCard = document.getElementById('student-final-score-card');
  const ctaCard = document.getElementById('registration-cta-card');
  const flowContainer = document.getElementById('registration-flow-container');
  const reviewInProgressCard = document.getElementById('review-in-progress-card');
  const alreadyRegCard = document.getElementById('already-registered-card');

  // Not eligible state: hide hero & journey (already handled by not_eligible check)
  if (state.eligibilityState === 'not_eligible') {
    const hero = document.getElementById('student-hero-card');
    if (hero) hero.classList.add('hidden');
    if (journeyCard) journeyCard.classList.add('hidden');
    return;
  }

  const reg = state.myRegistration;
  const assignment = state.myOfficialAssignment;
  const effectiveAssignment = (typeof normalizeOfficialAssignment === 'function')
    ? normalizeOfficialAssignment(assignment, reg)
    : (assignment || reg);
  const officialList = (effectiveAssignment && typeof getOfficialSupervisors === 'function')
    ? getOfficialSupervisors(effectiveAssignment)
    : (effectiveAssignment?.officialSupervisors || effectiveAssignment?.supervisors || []);

  const hasTopic = Boolean(
    reg && (reg.topicTitle || reg.topic || reg.proposalTitle || reg.title || reg.topicName)
  );
  const isDraft = Boolean(reg && reg.status === 'draft');
  const isSubmitted = Boolean(reg && !isDraft && hasTopic);

  const hasOfficialSup = Boolean(
    (assignment?.assignmentStatus === 'published' && officialList.length > 0) ||
    (reg?.assignmentStatus === 'published' && officialList.length > 0) ||
    (reg?.reviewStatus === 'accepted' && officialList.length > 0) ||
    (reg?.reviewStatus === 'manually_assigned' && officialList.length > 0)
  );

  // Case 4: BOTH completed topic registration AND has official supervisor
  const shouldShowRoadmap = isSubmitted && hasOfficialSup;

  // 1. Roadmap card
  if (journeyCard) {
    journeyCard.classList.toggle('hidden', !shouldShowRoadmap);
  }

  // 1b. Timeline Roadmap section (Kế hoạch & Nộp bài ĐATN/ĐATH)
  const timelineSection = document.getElementById('student-timeline-section');
  if (timelineSection) {
    timelineSection.classList.toggle('hidden', !shouldShowRoadmap);
  }

  // 2. Hero milestones count badge
  if (milestonesWrap) {
    milestonesWrap.classList.toggle('hidden', !shouldShowRoadmap);
  }

  // 3. Thesis guide link
  if (thesisGuideLink) {
    thesisGuideLink.classList.toggle('hidden', !shouldShowRoadmap);
  }

  // 4. Hero supervisor card: only show when there is an official supervisor
  if (supervisorCard) {
    supervisorCard.classList.toggle('hidden', !hasOfficialSup);
  }

  // 5. Final scores card
  if (finalScoreCard && !shouldShowRoadmap) {
    finalScoreCard.classList.add('hidden');
  }

  // 6. Manage Cases 1, 2, 3 messages & UI components
  if (!shouldShowRoadmap) {
    if (timelineSection) timelineSection.classList.add('hidden');
    if (!hasTopic && !isDraft) {
      // CASE 1: Joined round, no registration, no supervisor
      const isCurrentlyRegistering = Boolean(state.isRegisteringTopic);
      if (ctaCard && !isCurrentlyRegistering) {
        ctaCard.classList.remove('hidden');
        const ctaTitle = document.getElementById('registration-cta-title');
        const ctaDesc = document.getElementById('registration-cta-description');
        if (ctaTitle) {
          ctaTitle.classList.remove('hidden');
          ctaTitle.textContent = 'Đăng ký Đề tài ĐATN/ĐATH';
        }
        if (ctaDesc) {
          ctaDesc.classList.remove('hidden');
          ctaDesc.textContent = 'Bạn chưa hoàn tất đăng ký đề tài và phân công giảng viên hướng dẫn. Vui lòng thực hiện đăng ký để tiếp tục.';
        }
      } else if (ctaCard && isCurrentlyRegistering) {
        ctaCard.classList.add('hidden');
      }
      if (flowContainer && isCurrentlyRegistering) {
        flowContainer.classList.remove('hidden');
      } else if (flowContainer && !isCurrentlyRegistering) {
        flowContainer.classList.add('hidden');
      }
      if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
    } else if (isDraft) {
      // CASE 2: Draft registration saved, not submitted
      if (ctaCard) ctaCard.classList.add('hidden');
      if (flowContainer) flowContainer.classList.remove('hidden');
      if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
    } else if (isSubmitted && !hasOfficialSup) {
      // CASE 3: Submitted registration, awaiting official supervisor assignment
      if (ctaCard) ctaCard.classList.add('hidden');
      if (flowContainer) flowContainer.classList.add('hidden');
      if (reviewInProgressCard) {
        reviewInProgressCard.classList.remove('hidden');
        const reviewText = reviewInProgressCard.querySelector('p');
        if (reviewText) {
          reviewText.textContent = 'Hồ sơ đăng ký của bạn đang được xử lý. Lộ trình thực hiện sẽ hiển thị khi hoàn tất phân công giảng viên hướng dẫn.';
        }
      }
      if (alreadyRegCard) alreadyRegCard.classList.remove('hidden');
    }
  }
}
if (typeof window !== 'undefined') window.applyStudentProgressVisibility = applyStudentProgressVisibility;

/**
 * IFA+ Graduation — Students, Eligibility & IFAA Master Module
 */
async function checkStudentEligibilityAndRegistration(roundId) {
  let mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  if (!mssv) {
    if (state.user?.email && state.user.email.toLowerCase().endsWith('@student.tdtu.edu.vn')) {
      mssv = state.user.email.split('@')[0].toUpperCase();
      state.studentMssv = mssv;
      state.userStudentId = mssv;
    } else if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ifa_student_mssv')) {
      mssv = sessionStorage.getItem('ifa_student_mssv');
      state.studentMssv = mssv;
      state.userStudentId = mssv;
    }
  }

  state.isEligible = false;
  state.myRegistration = null;
  state.myOfficialAssignment = null;

  const nonEligibleAlert = document.getElementById('non-eligible-alert');
  const heroCard = document.getElementById('student-hero-card');
  const journeyCard = document.getElementById('student-journey-card');
  const timelineSection = document.getElementById('student-timeline-section');
  const alreadyRegCard = document.getElementById('already-registered-card');
  const ctaCard = document.getElementById('registration-cta-card');
  const reviewInProgressCard = document.getElementById('review-in-progress-card');
  const officialResultCard = document.getElementById('official-result-card');
  const flowContainer = document.getElementById('registration-flow-container');
  const finalScoreCard = document.getElementById('student-final-score-card');
  applySupervisorAssignmentModeToRegistrationUI();

  const isCurrentlyRegisteringTopic = Boolean(
    state.isRegisteringTopic ||
    (flowContainer && !flowContainer.classList.contains('hidden') && !state.myRegistration)
  );

  if (!mssv) {
    state.isEligible = false;
    state.eligibilityState = 'unidentified';
    if (nonEligibleAlert) {
      nonEligibleAlert.classList.remove('hidden');
      const h3 = nonEligibleAlert.querySelector('h3');
      const p = nonEligibleAlert.querySelector('p');
      if (h3) h3.textContent = 'Không xác định được Mã số sinh viên (MSSV) từ tài khoản đăng nhập.';
      if (p) p.textContent = 'Vui lòng đăng xuất và đăng nhập lại bằng tài khoản Google sinh viên TDTU chính thức (MSSV@student.tdtu.edu.vn).';
      const selfJoinDiv = document.getElementById('non-eligible-self-join-action');
      if (selfJoinDiv) selfJoinDiv.classList.add('hidden');
    }
    if (heroCard) heroCard.classList.add('hidden');
    if (journeyCard) journeyCard.classList.remove('hidden');
    if (alreadyRegCard) alreadyRegCard.classList.add('hidden');
    if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
    if (officialResultCard) officialResultCard.classList.add('hidden');
    if (ctaCard) ctaCard.classList.add('hidden');
    if (flowContainer) flowContainer.classList.add('hidden');
    renderSupervisorsGrid();
    updateStudentJourneyStepper();
    updateStudentPersonalSidebar();
    return;
  }

  try {
    await loadStudentSelfProfile(mssv);
    const roundData = state.activeRound || state.rounds?.find(r => r.id === roundId);
    const allowPre = Boolean(roundData?.allowRegistrationBeforeEligibility && !roundData?.eligibilityFinalized);

    const [elDoc, regDoc, assignmentDoc] = await Promise.all([
      getDoc(doc(db, 'graduationRounds', roundId, 'eligibleStudents', mssv)).catch(() => null),
      getDoc(doc(db, 'graduationRounds', roundId, 'registrations', mssv)).catch(() => null),
      getDoc(doc(db, 'graduationRounds', roundId, 'officialAssignments', mssv)).catch(() => null)
    ]);

    const isSelfJoined = Boolean(elDoc?.exists() && (elDoc.data()?.joinMethod === 'link' || elDoc.data()?.source === 'self_join_link'));
    const hasExplicitBlacklist = Boolean(elDoc?.exists() && elDoc.data()?.eligible === false && !isSelfJoined);
    const hasExplicitEligible = Boolean(elDoc?.exists() && (isSelfJoined ? (elDoc.data()?.eligible === true) : (elDoc.data()?.eligible !== false)));
    const hasReg = Boolean(regDoc?.exists());
    const hasAssignment = Boolean(assignmentDoc?.exists());
    const isActAsStudent = Boolean(state.impersonation && (state.impersonation.target?.type === 'student' || state.impersonation.target?.mssv === mssv));
    const roundHasNoRoster = !roundData?.eligibilityFinalized && (!roundData?.eligibleCount || roundData?.eligibleCount === 0) && (!roundData?.eligibleStudentsCount || roundData?.eligibleStudentsCount === 0);

    const isOfficiallyEligible = !hasExplicitBlacklist && (hasExplicitEligible || hasReg || hasAssignment || isActAsStudent || roundHasNoRoster);

    if (isOfficiallyEligible) {
      state.isEligible = true;
      state.eligibilityState = 'eligible';
      if (nonEligibleAlert) {
        nonEligibleAlert.classList.add('hidden');
        const selfJoinDiv = document.getElementById('non-eligible-self-join-action');
        if (selfJoinDiv) selfJoinDiv.classList.add('hidden');
      }
      if (heroCard) heroCard.classList.remove('hidden');
      if (journeyCard) journeyCard.classList.remove('hidden');
    } else if (allowPre || isSelfJoined) {
      state.isEligible = 'pending';
      state.eligibilityState = 'pending';
      if (nonEligibleAlert) {
        nonEligibleAlert.classList.add('hidden');
        const selfJoinDiv = document.getElementById('non-eligible-self-join-action');
        if (selfJoinDiv) selfJoinDiv.classList.add('hidden');
      }
      if (heroCard) heroCard.classList.remove('hidden');
      if (journeyCard) journeyCard.classList.remove('hidden');
    } else {
      state.isEligible = false;
      state.eligibilityState = 'not_eligible';
      if (nonEligibleAlert) {
        nonEligibleAlert.classList.remove('hidden');
        const h3 = nonEligibleAlert.querySelector('h3');
        const p = nonEligibleAlert.querySelector('p');
        if (h3) h3.textContent = 'Bạn chưa có trong danh sách sinh viên đủ điều kiện đăng ký Đồ án tốt nghiệp đợt này.';
        if (p) p.textContent = 'Tài khoản của bạn hiện chưa được ghi nhận trong danh sách sinh viên chính thức của đợt tốt nghiệp này. Nếu bạn thuộc đối tượng làm ĐATN hoặc cần hỗ trợ kiểm tra điều kiện, vui lòng liên hệ Văn phòng Khoa để được giải quyết.';
        const selfJoinDiv = document.getElementById('non-eligible-self-join-action');
        if (selfJoinDiv) {
          if (roundData?.allowSelfJoin === true && !roundData?.isClosed && !roundData?.isHidden && roundData?.status !== 'closed') {
            selfJoinDiv.classList.remove('hidden');
            const btn = document.getElementById('btn-self-join-from-alert');
            if (btn) {
              btn.onclick = () => {
                if (typeof window.openStudentConfirmJoinModal === 'function') {
                  window.openStudentConfirmJoinModal(roundData);
                }
              };
            }
          } else {
            selfJoinDiv.classList.add('hidden');
          }
        }
      }
      if (heroCard) heroCard.classList.add('hidden');
      if (journeyCard) journeyCard.classList.add('hidden');
      if (timelineSection) timelineSection.classList.add('hidden');
      if (alreadyRegCard) alreadyRegCard.classList.add('hidden');
      if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
      if (officialResultCard) officialResultCard.classList.add('hidden');
      if (ctaCard) ctaCard.classList.add('hidden');
      if (flowContainer) flowContainer.classList.add('hidden');
      if (finalScoreCard) finalScoreCard.classList.add('hidden');
      updateStudentJourneyStepper();
      updateStudentPersonalSidebar();
      return;
    }

    try {
      let assignment = assignmentDoc?.exists() ? { id: assignmentDoc.id, ...assignmentDoc.data() } : null;

      // Draft assignments are administrative data, never a student result (including act-as).
      if (state.isAdmin && !state.impersonation && (!assignment || assignment.assignmentStatus !== 'published')) {
        try {
          const draftDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'assignmentDrafts', mssv));
          if (draftDoc.exists()) {
            const draftData = { id: draftDoc.id, ...draftDoc.data() };
            assignment = draftData;
          }
        } catch (draftErr) {}
      }

      state.myOfficialAssignment = assignment;
    } catch (assignmentError) {
      // Expected for draft or unrelated assignments under least-privilege Rules.
      state.myOfficialAssignment = null;
    }
    if (regDoc.exists()) {
      state.myRegistration = normalizeOfficialAssignment(state.myOfficialAssignment, regDoc.data());
      const isDraft = state.myRegistration?.status === 'draft';
      if (isDraft) {
        if (flowContainer) flowContainer.classList.remove('hidden');
        if (ctaCard) ctaCard.classList.add('hidden');
        if (alreadyRegCard) alreadyRegCard.classList.add('hidden');
        if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
        if (officialResultCard) officialResultCard.classList.add('hidden');
        goToStep(1);
        updateStudentJourneyStepper();
        updateStudentPersonalSidebar();
        renderRoundHeader();
        applyStudentProgressVisibility();
        return;
      }

      if (flowContainer) flowContainer.classList.add('hidden');
      if (ctaCard) ctaCard.classList.add('hidden');

      const roundStatus = state.activeRound?.status;
      const reviewStatus = state.activeRound?.reviewStatus;

      const publishedSupervisors = getOfficialSupervisors(state.myRegistration);
      const hasPublishedAssignment = state.myRegistration?.assignmentStatus === 'published' && publishedSupervisors.length > 0;

      // 1. Only an actually published assignment may be shown as the official result.
      if (hasPublishedAssignment) {
        if (alreadyRegCard) alreadyRegCard.classList.remove('hidden');
        renderStudentExistingRegistration(state.myRegistration);
        if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
        renderStudentOfficialResult(state.myRegistration);
        if (officialResultCard) officialResultCard.classList.add('hidden');
        renderStudentFinalScoreCard(mssv, state.activeRound);
        updateStudentJourneyStepper();
        updateStudentPersonalSidebar();
        renderRoundHeader();
        applyStudentProgressVisibility();
        return;
      }

      // 2. Registered without a published assignment is a normal waiting state.
      if (!hasPublishedAssignment) {
        if (alreadyRegCard) alreadyRegCard.classList.remove('hidden');
        renderStudentExistingRegistration(state.myRegistration);
        if (officialResultCard) officialResultCard.classList.add('hidden');

        const reviewTag = document.getElementById('review-round-tag');
        if (reviewTag) reviewTag.textContent = 'ĐANG XỬ LÝ';
        if (reviewInProgressCard) {
          reviewInProgressCard.classList.remove('hidden');
          const pEl = reviewInProgressCard.querySelector('p');
          if (pEl) pEl.textContent = 'Hồ sơ đăng ký của bạn đang được xử lý. Lộ trình thực hiện sẽ hiển thị khi hoàn tất phân công giảng viên hướng dẫn.';
        }
        updateStudentJourneyStepper();
        updateStudentPersonalSidebar();
        renderRoundHeader();
        applyStudentProgressVisibility();
        return;
      }

      // 3. Normal Submitted State
      if (officialResultCard) officialResultCard.classList.add('hidden');
      if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
      renderStudentExistingRegistration(state.myRegistration);
      if (alreadyRegCard) alreadyRegCard.classList.remove('hidden');
      renderStudentFinalScoreCard(mssv, state.activeRound);
      updateStudentJourneyStepper();
      updateStudentPersonalSidebar();
      renderRoundHeader();
      applyStudentProgressVisibility();

    } else {
      if (alreadyRegCard) alreadyRegCard.classList.add('hidden');
      if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
      if (state.myOfficialAssignment?.assignmentStatus === 'published') {
        renderStudentOfficialResult(normalizeOfficialAssignment(state.myOfficialAssignment, null));
        if (officialResultCard) officialResultCard.classList.add('hidden');
      } else if (officialResultCard) {
        officialResultCard.classList.add('hidden');
      }
      const isCurrentlyRegistering = Boolean(
        state.isRegisteringTopic || 
        (flowContainer && !flowContainer.classList.contains('hidden'))
      );

      if (isCurrentlyRegistering) {
        if (ctaCard) ctaCard.classList.add('hidden');
        if (flowContainer) flowContainer.classList.remove('hidden');
      } else {
        if (ctaCard) ctaCard.classList.remove('hidden');
        if (flowContainer) flowContainer.classList.add('hidden');
        goToStep(1);
      }
      updateStudentJourneyStepper();
      updateStudentPersonalSidebar();
      renderRoundHeader();
      applyStudentProgressVisibility();
    }
  } catch (e) {
    console.error('Error checking student eligibility:', e);
  }
}

function renderStudentOfficialResult(reg) {
  const container = document.getElementById('official-result-body');
  if (!container) return;

  const officialList = getOfficialSupervisors(reg);

  if ((reg.reviewStatus === 'accepted' || reg.reviewStatus === 'manually_assigned' || officialList.length > 0)) {
    const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23cbd5e1'/%3E%3Cpath fill='%23cbd5e1' d='M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z'/%3E%3C/svg%3E";

    const supervisorsCardsHtml = officialList.map(item => {
      const sup = (typeof resolveSupervisorProfile === 'function')
        ? resolveSupervisorProfile(item.supervisorId || item.id || item.supervisorEmail)
        : ((state.supervisorsMaster || []).find(s => s.id === item.supervisorId || (item.supervisorEmail && s.email === item.supervisorEmail))
          || (state.roundSupervisors || []).find(s => s.id === item.supervisorId || s.supervisorId === item.supervisorId));

      const isPrimary = (item.role === 'primary');
      const roleBadge = isPrimary
        ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[10px] shadow-sm uppercase tracking-wide">GVHD chính</span>'
        : '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500 text-white font-black text-[10px] shadow-sm uppercase tracking-wide">GVHD 2</span>';

      const showEmail = (state.activeRound?.showEmailAfterPublish !== false && sup?.email);
      const showPhone = (state.activeRound?.showPhoneAfterPublish !== false && sup?.phone);
      const supName = sup?.name || item.supervisorName || 'Giảng viên Hướng dẫn';
      const escapedSupName = escapeHtml(supName);
      const avatarSrc = (sup?.photoUrl && sup.photoUrl.trim()) ? sup.photoUrl : getSupervisorAvatarSvgDataUri(supName);

      return `
        <div class="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/20 flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 min-w-[280px]">
          <img src="${avatarSrc}" onerror="this.onerror=null; this.src=getSupervisorAvatarSvgDataUri('${escapedSupName}');" class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 ${isPrimary ? 'border-amber-400' : 'border-blue-400'} shadow-md shrink-0" alt="${escapedSupName}">
          <div class="text-center sm:text-left flex-1 min-w-0">
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              ${roleBadge}
              ${isPrimary ? `<span class="text-[10px] text-amber-300 font-semibold">${reg.acceptedRank === 'manual' ? 'Phân công của Khoa' : 'Trúng tuyển NV' + (reg.acceptedRank || 1)}</span>` : ''}
            </div>
            <h3 class="text-lg sm:text-xl font-black text-white truncate">${supName}</h3>
            <p class="text-xs text-blue-200 mt-0.5">${sup?.department || 'Khoa Mỹ thuật Công nghiệp'}</p>
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5 text-xs">
              ${showEmail ? '<span class="bg-white/15 px-2.5 py-1 rounded-lg text-white font-mono text-[11px]">✉️ ' + sup.email + '</span>' : ''}
              ${showPhone ? '<span class="bg-white/15 px-2.5 py-1 rounded-lg text-white font-mono text-[11px]">📞 ' + sup.phone + '</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="space-y-4">
        <div>
          <span class="text-xs font-bold text-amber-300 uppercase tracking-wider block mb-2">GIẢNG VIÊN HƯỚNG DẪN ĐỒ ÁN (${officialList.length})</span>
          <div class="flex flex-col md:flex-row gap-3">
            ${supervisorsCardsHtml}
          </div>
        </div>

        <div class="bg-black/30 p-4 rounded-xl border border-white/10 text-xs">
          <span class="text-blue-300 font-bold block uppercase mb-2">Thông tin đồ án đã đăng ký</span>
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div class="min-w-0">
              <span class="text-[10px] text-blue-200 uppercase font-bold">Tên đề tài</span>
              <p class="text-white font-bold text-sm leading-relaxed">${reg.topicTitle || 'Chưa đăng ký đề tài'}</p>
            </div>
            <div class="sm:text-right">
              <span class="text-[10px] text-blue-200 uppercase font-bold">Loại hình đồ án</span>
              <p class="text-white font-semibold text-xs mt-0.5">${reg.projectType || '--'}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="bg-white/10 p-5 rounded-2xl border border-white/20 text-center space-y-3">
        <p class="text-lg font-bold text-amber-300">ĐANG CHỜ PHÂN CÔNG GIẢNG VIÊN HƯỚNG DẪN</p>
        <p class="text-xs text-slate-200 leading-relaxed max-w-lg mx-auto">
          Ngành đang thực hiện phân công giảng viên hướng dẫn. Bạn vui lòng chờ và quay lại hệ thống để xem thông tin khi có kết quả.
        </p>
      </div>
    `;
  }
}

function renderStudentExistingRegistration(reg) {
  document.getElementById('reg-card-topic').textContent = reg.topicTitle;
  document.getElementById('reg-card-type').textContent = reg.projectType;

  const bannerEl = document.getElementById('reg-card-eligibility-banner');
  const statusEl = document.getElementById('reg-card-status');
  const topicStatus = reg.topicApprovalStatus || 'pending';
  const downloadBtn = document.getElementById('btn-download-official-topic-form');
  if (downloadBtn) downloadBtn.classList.toggle('hidden', topicStatus !== 'approved');
  const reviewNoteEl = document.getElementById('reg-card-topic-review-note');
  if (reviewNoteEl) {
    const showReviewNote = topicStatus === 'rejected' && String(reg.topicApprovalNote || '').trim();
    reviewNoteEl.textContent = showReviewNote ? `GVHD phản hồi: ${reg.topicApprovalNote}` : '';
    reviewNoteEl.classList.toggle('hidden', !showReviewNote);
  }
  const directAssignment = shouldSkipStudentSupervisorPreference();
  if (bannerEl) {
    if (reg.eligibilityStatus === 'pending') {
      bannerEl.className = 'mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5';
      bannerEl.innerHTML = `
        <span class="text-base">ℹ️</span>
        <div>
          <span class="font-bold block">Trạng thái điều kiện: Chờ kết quả xét từ Nhà trường / Khoa</span>
          <p class="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
            ${directAssignment
              ? 'Đăng ký đề tài của bạn đã được ghi nhận. Trạng thái điều kiện đang là <b>Chờ xét</b>. Sau khi Nhà trường/Khoa ban hành danh sách chính thức, hồ sơ sẽ tiếp tục quy trình phân công GVHD.'
              : 'Đăng ký nguyện vọng của bạn đã được ghi nhận vào hệ thống. Trạng thái điều kiện đang là <b>Chờ xét</b>. Sau khi Nhà trường/Khoa ban hành danh sách chính thức, hệ thống sẽ đối chiếu và chuyển hồ sơ sang GVHD xét duyệt.'}
          </p>
        </div>
      `;
      bannerEl.classList.remove('hidden');
      if (statusEl) {
        statusEl.textContent = 'Đã ghi nhận (Chờ xét điều kiện)';
        statusEl.className = 'font-bold text-amber-700 text-sm';
      }
    } else if (reg.eligibilityStatus === 'not_eligible') {
      bannerEl.className = 'mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-2.5';
      bannerEl.innerHTML = `
        <span class="text-base">⚠️</span>
        <div>
          <span class="font-bold block">Kết quả xét duyệt: Không đủ điều kiện làm ĐATN đợt này</span>
          <p class="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
            ${directAssignment
              ? 'Theo danh sách chính thức từ Nhà trường/Khoa, bạn chưa đủ điều kiện làm ĐATN trong đợt này. Đăng ký đề tài sẽ không được tiếp tục xử lý.'
              : 'Theo danh sách chính thức từ Nhà trường/Khoa, bạn chưa đủ điều kiện làm ĐATN trong đợt này. Nguyện vọng đăng ký không được chuyển sang GVHD xét duyệt.'}
          </p>
        </div>
      `;
      bannerEl.classList.remove('hidden');
      if (statusEl) {
        statusEl.textContent = 'Không đủ điều kiện';
        statusEl.className = 'font-bold text-rose-700 text-sm';
      }
    } else if (directAssignment && getOfficialSupervisors(reg).length > 0) {
      const assignment = getOfficialSupervisors(reg).find(item => item.role === 'primary') || getOfficialSupervisors(reg)[0];
      const assignedName = assignment?.supervisorName || reg.acceptedSupervisorName || 'Giảng viên hướng dẫn';
      bannerEl.className = 'hidden';
      bannerEl.innerHTML = '';
      if (statusEl) {
        statusEl.textContent = `Đã phân công GVHD: ${assignedName}`;
        statusEl.className = 'font-bold text-emerald-700 text-sm';
      }
    } else if (directAssignment) {
      bannerEl.className = 'mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-start gap-2.5';
      bannerEl.innerHTML = `
        <span class="text-base">ℹ️</span>
        <div>
          <span class="font-bold block">GVHD: Chưa phân công</span>
          <p class="text-[11px] text-blue-800 mt-0.5 leading-relaxed">Vui lòng chờ Khoa phân công giảng viên hướng dẫn.</p>
        </div>
      `;
      bannerEl.classList.remove('hidden');
      if (statusEl) {
        statusEl.textContent = 'Chờ Khoa phân công GVHD';
        statusEl.className = 'font-bold text-blue-700 text-sm';
      }
    } else {
      bannerEl.className = 'hidden';
      bannerEl.innerHTML = '';
      if (statusEl) {
        statusEl.textContent = 'Đã ghi nhận (Đủ điều kiện)';
        statusEl.className = 'font-bold text-emerald-700 text-sm';
      }
    }
  }

  const dateStr = reg.submittedAt ? (reg.submittedAt.toDate ? reg.submittedAt.toDate() : new Date(reg.submittedAt)).toLocaleString('vi-VN') : '--';
  document.getElementById('reg-card-time').textContent = `Thời gian nộp: ${dateStr}`;

  const prefSection = document.getElementById('reg-card-preferences-section');
  if (prefSection) {
    prefSection.classList.toggle('hidden', Boolean(directAssignment));
  }

  const listEl = document.getElementById('reg-card-preferences-list');
  if (listEl && directAssignment) {
    listEl.innerHTML = '';
    return;
  }
  listEl.innerHTML = (reg.preferences || []).map(p => {
    const sup = (typeof resolveSupervisorProfile === 'function')
      ? resolveSupervisorProfile(p.supervisorId || p.id || p.email)
      : ((state.roundSupervisors || []).find(s => s.id === p.supervisorId) ||
         (state.supervisorsMaster || []).find(s => s.id === p.supervisorId));
    const supName = sup?.name || p.supervisorName || '';
    const avatarSrc = (sup?.showPhoto !== false && sup?.photoUrl && sup.photoUrl.trim())
      ? sup.photoUrl
      : getSupervisorAvatarSvgDataUri(supName || 'GV');
    const escapedName = escapeHtml(supName || '');

    return `
      <div class="flex items-center gap-3.5 p-2.5 bg-white rounded-xl border border-emerald-100 shadow-2xs text-xs">
        <span class="w-11 sm:w-12 py-1 text-center rounded-lg bg-emerald-600 text-white font-black text-[11px] shrink-0">
          NV${p.rank}
        </span>
        <img src="${avatarSrc}" onerror="this.onerror=null; this.src=getSupervisorAvatarSvgDataUri('${escapedName}');" class="w-8 h-8 rounded-lg object-cover object-top border border-emerald-200 shadow-2xs shrink-0" alt="${escapedName}">
        <div class="flex flex-wrap items-baseline gap-x-2 min-w-0 flex-1">
          <span class="font-bold text-slate-800">${escapedName}</span>
          ${p.department ? `<span class="text-[11px] text-slate-400">(${escapeHtml(p.department)})</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const btnEdit = document.getElementById('btn-edit-existing-reg');
  const canEdit = state.activeRound?.status === 'open' && state.activeRound?.allowStudentEdit !== false;
  if (canEdit) {
    btnEdit.classList.remove('hidden');
    btnEdit.innerHTML = topicStatus === 'approved' ? '✏️ Đổi tên đề tài' : '✏️ Chỉnh sửa & đăng ký lại';
  } else {
    btnEdit.classList.add('hidden');
  }

  if (statusEl && reg.eligibilityStatus !== 'not_eligible') {
    const topicStatusUi = {
      approved: ['Tên đề tài đã được GVHD duyệt', 'font-bold text-emerald-700 text-sm'],
      rejected: ['Tên đề tài chưa được duyệt – cần chỉnh sửa', 'font-bold text-rose-700 text-sm'],
      pending: ['Tên đề tài đang chờ GVHD duyệt', 'font-bold text-amber-700 text-sm']
    }[topicStatus] || ['Tên đề tài đang chờ GVHD duyệt', 'font-bold text-amber-700 text-sm'];
    statusEl.textContent = topicStatusUi[0];
    statusEl.className = topicStatusUi[1];
  }
}

window.enableEditRegistration = function() {
  if (!state.myRegistration) return;
  const reg = state.myRegistration;
  const topicTitleInput = document.getElementById('input-topic-title');
  if (topicTitleInput) {
    topicTitleInput.value = reg.topicTitle || '';
    const charCount = document.getElementById('topic-char-count');
    if (charCount) charCount.textContent = `${(reg.topicTitle || '').length}/250`;
  }
  const storedTypes = reg.projectTypes || parseStoredProjectTypes(reg.projectType || '');
  setSelectedProjectTypes(storedTypes, reg.projectTypeOther || '');
  populateRegistrationStudentForm();
  state.selectedPreferences = [...(reg.preferences || [])];

  const alreadyCard = document.getElementById('already-registered-card');
  const ctaCard = document.getElementById('registration-cta-card');
  const reviewInProgressCard = document.getElementById('review-in-progress-card');
  const flowContainer = document.getElementById('registration-flow-container');
  if (alreadyCard) alreadyCard.classList.add('hidden');
  if (ctaCard) ctaCard.classList.add('hidden');
  if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
  if (flowContainer) {
    flowContainer.classList.remove('hidden');
    flowContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  goToStep(1);
};


// --- STEPPER NAVIGATION ---
function applySupervisorAssignmentModeToRegistrationUI() {
  const directAssignment = shouldSkipStudentSupervisorPreference();
  const ctaTitle = document.getElementById('registration-cta-title');
  const ctaDescription = document.getElementById('registration-cta-description');
  const selectionStep = document.getElementById('step-indicator-2');
  const confirmStep = document.getElementById('step-indicator-3');
  const nextButton = document.getElementById('btn-registration-step-1-next');
  const confirmBackButton = document.getElementById('btn-registration-confirm-back');
  const topicDescription = document.getElementById('registration-topic-step-description');
  const confirmTitle = document.getElementById('confirm-step-title');
  const confirmNote = document.getElementById('registration-confirm-note');

  if (ctaTitle) {
    ctaTitle.textContent = directAssignment
      ? 'Đăng ký Đề tài'
      : 'Đăng ký Đề tài & Chọn Giảng viên hướng dẫn';
  }
  if (ctaDescription) {
    ctaDescription.textContent = directAssignment
      ? 'Vui lòng nhập tên đề tài dự kiến và chọn từ 1 đến 3 loại hình đồ án trước khi xác nhận đăng ký.'
      : 'Vui lòng hoàn thành điền tên đề tài dự kiến, chọn loại hình đồ án và đăng ký các nguyện vọng GVHD theo quy định của Khoa.';
  }
  if (confirmNote) {
    confirmNote.innerHTML = directAssignment
      ? '⚠️ <strong>LƯU Ý:</strong> Sau khi bấm <em>Xác nhận Đăng ký</em>, hệ thống sẽ lưu tên đề tài và loại hình đồ án của bạn. Bạn có thể chỉnh sửa trong thời gian đợt đăng ký còn mở (nếu đợt cho phép).'
      : '⚠️ <strong>LƯU Ý:</strong> Sau khi bấm <em>Xác nhận Đăng ký</em>, hệ thống sẽ lưu thông tin của bạn vào cơ sở dữ liệu đợt. Bạn có thể thay đổi nguyện vọng trong thời gian đợt đăng ký còn mở (nếu đợt cho phép).';
  }

  if (selectionStep) {
    if (directAssignment) {
      selectionStep.classList.add('hidden');
    } else {
      selectionStep.classList.remove('hidden');
    }
  }
  if (confirmStep) {
    const circle = confirmStep.querySelector('.stepper-circle');
    const label = confirmStep.querySelector('span');
    if (circle) circle.textContent = directAssignment ? '2' : '3';
    if (label) label.textContent = 'Xác nhận';
  }
  if (confirmTitle) {
    confirmTitle.textContent = directAssignment
      ? '2. Kiểm tra & Xác nhận Đăng ký'
      : '3. Kiểm tra & Xác nhận Đăng ký';
  }
  if (nextButton) {
    nextButton.innerHTML = directAssignment
      ? '<span>Tiếp tục: Xem lại & Nộp</span><span>→</span>'
      : '<span>Tiếp tục: Chọn GVHD</span><span>→</span>';
  }
  if (topicDescription) {
    topicDescription.textContent = directAssignment
      ? 'Vui lòng điền tên đề tài dự kiến và phân loại đồ án trước khi xác nhận đăng ký.'
      : 'Vui lòng điền tên đề tài dự kiến và phân loại đồ án trước khi chọn GVHD.';
  }
  if (confirmBackButton) {
    confirmBackButton.setAttribute('onclick', directAssignment ? 'goToStep(1)' : 'goToStep(2)');
    confirmBackButton.textContent = directAssignment ? '← Quay lại Thông tin đề tài' : '← Quay lại Bước 2';
  }
}

window.goToStep = function(step) {
  const directAssignment = shouldSkipStudentSupervisorPreference();
  if (directAssignment && step === 2) step = 3;
  state.currentStep = step;

  [1, 2, 3].forEach(s => {
    const indicator = document.getElementById('step-indicator-' + s);
    const panel = document.getElementById('step-panel-' + s);

    if (indicator) {
      if (directAssignment && s === 2) {
        indicator.className = 'hidden';
      } else {
        if (s === step) {
          indicator.className = 'stepper-item active flex flex-col items-center gap-1 relative z-10 bg-white px-2 cursor-pointer';
        } else if (s < step) {
          indicator.className = 'stepper-item completed flex flex-col items-center gap-1 relative z-10 bg-white px-2 cursor-pointer';
        } else {
          indicator.className = 'stepper-item flex flex-col items-center gap-1 relative z-10 bg-white px-2 cursor-pointer';
        }
      }
    }

    if (panel) {
      if (s === step) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });

  applySupervisorAssignmentModeToRegistrationUI();

  if (step === 2) {
    renderSupervisorsGrid();
  } else if (step === 3) {
    renderConfirmationPanel();
  }
};


// ── Student Eligibility Declaration Handlers ────────────────────────────────
window.onStudentEligibilityChoiceChanged = function(choice) {
  const labelEligible = document.getElementById('label-student-decl-eligible');
  const labelIneligible = document.getElementById('label-student-decl-ineligible');
  const detailsWrap = document.getElementById('student-ineligible-details-wrap');
  const errEl = document.getElementById('student-decl-error');
  if (errEl) errEl.classList.add('hidden');

  if (choice === 'eligible') {
    if (labelEligible) {
      labelEligible.className = 'flex items-start gap-3 p-3 bg-emerald-50/50 border-2 border-emerald-500 rounded-xl cursor-pointer shadow-2xs transition-all';
    }
    if (labelIneligible) {
      labelIneligible.className = 'flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-rose-400 hover:bg-rose-50/10 transition-all';
    }
    if (detailsWrap) detailsWrap.classList.add('hidden');
  } else if (choice === 'ineligible') {
    if (labelIneligible) {
      labelIneligible.className = 'flex items-start gap-3 p-3 bg-rose-50/50 border-2 border-rose-500 rounded-xl cursor-pointer shadow-2xs transition-all';
    }
    if (labelEligible) {
      labelEligible.className = 'flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/10 transition-all';
    }
    if (detailsWrap) detailsWrap.classList.remove('hidden');
    window.onIneligibleReasonToggled();
  }
};

window.onIneligibleReasonToggled = function() {
  const checked = Array.from(document.querySelectorAll('input[name="ineligible-reason"]:checked')).map(cb => cb.value);
  const coursesWrap = document.getElementById('student-missing-courses-wrap');
  const englishWrap = document.getElementById('student-english-notes-wrap');
  const otherWrap = document.getElementById('student-other-reason-wrap');

  // Failing courses or missing credits table
  if (coursesWrap) {
    const showCourses = checked.includes('failing_courses') ||
      checked.includes('missing_credits_1_3') ||
      checked.includes('missing_credits_4_6') ||
      checked.includes('missing_credits_7_10');
    coursesWrap.classList.toggle('hidden', !showCourses);
    if (showCourses && checked.includes('failing_courses')) {
      const tbody = document.getElementById('student-missing-courses-tbody');
      if (tbody && tbody.children.length === 0) {
        window.addStudentMissingCourseRow();
      }
    }
  }

  // English notes
  if (englishWrap) {
    const showEnglish = checked.some(r =>
      r === 'no_english_cert' ||
      r === 'english_waiting_result' ||
      r === 'english_waiting_verification' ||
      r.startsWith('english_')
    );
    englishWrap.classList.toggle('hidden', !showEnglish);
  }

  // Other reason
  if (otherWrap) {
    const showOther = checked.includes('other');
    otherWrap.classList.toggle('hidden', !showOther);
  }
};

window.addStudentMissingCourseRow = function(code = '', name = '', credits = '') {
  const tbody = document.getElementById('student-missing-courses-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'hover:bg-rose-50/30 transition-colors';
  tr.innerHTML = `
    <td class="p-1.5">
      <input type="text" maxlength="30" placeholder="Mã HP (nếu biết)" value="${escapeHtml(code)}" class="missing-course-code w-full p-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono">
    </td>
    <td class="p-1.5">
      <input type="text" maxlength="120" placeholder="Tên học phần còn nợ *" value="${escapeHtml(name)}" class="missing-course-name w-full p-1.5 border border-rose-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-semibold text-slate-800" required>
    </td>
    <td class="p-1.5">
      <input type="number" min="1" max="15" placeholder="Số TC" value="${escapeHtml(credits)}" class="missing-course-credits w-full p-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500">
    </td>
    <td class="p-1.5 text-center">
      <button type="button" onclick="window.removeStudentMissingCourseRow(this)" class="text-rose-500 hover:text-rose-700 font-bold p-1 text-sm cursor-pointer" title="Xóa môn này">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
};

window.removeStudentMissingCourseRow = function(btn) {
  const tr = btn?.closest('tr');
  if (tr) tr.remove();
};

window.populateEligibilityDeclarationForm = function(decl) {
  const radioEligible = document.querySelector('input[name="student-eligibility-status"][value="eligible"]');
  const radioIneligible = document.querySelector('input[name="student-eligibility-status"][value="ineligible"]');
  const labelEligible = document.getElementById('label-student-decl-eligible');
  const labelIneligible = document.getElementById('label-student-decl-ineligible');
  const detailsWrap = document.getElementById('student-ineligible-details-wrap');
  const coursesTbody = document.getElementById('student-missing-courses-tbody');
  const englishNotesInput = document.getElementById('student-english-notes');
  const otherReasonInput = document.getElementById('student-other-reason-text');

  if (coursesTbody) coursesTbody.innerHTML = '';
  if (englishNotesInput) englishNotesInput.value = '';
  if (otherReasonInput) otherReasonInput.value = '';
  document.querySelectorAll('input[name="ineligible-reason"]').forEach(cb => cb.checked = false);

  if (!decl || !decl.status || decl.status === 'undeclared') {
    if (radioEligible) radioEligible.checked = false;
    if (radioIneligible) radioIneligible.checked = false;
    if (labelEligible) labelEligible.className = 'flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 transition-all';
    if (labelIneligible) labelIneligible.className = 'flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-rose-500 hover:bg-rose-50/20 transition-all';
    if (detailsWrap) detailsWrap.classList.add('hidden');
    return;
  }

  if (decl.status === 'eligible') {
    if (radioEligible) radioEligible.checked = true;
    window.onStudentEligibilityChoiceChanged('eligible');
  } else if (decl.status === 'ineligible') {
    if (radioIneligible) radioIneligible.checked = true;
    window.onStudentEligibilityChoiceChanged('ineligible');

    const reasons = Array.isArray(decl.reasons) ? decl.reasons : [];
    const mappedReasons = reasons.map(r => {
      if (r === 'english_not_taken') return 'no_english_cert';
      if (r === 'english_pending_result') return 'english_waiting_result';
      if (r === 'english_pending_verification') return 'english_waiting_verification';
      return r;
    });
    document.querySelectorAll('input[name="ineligible-reason"]').forEach(cb => {
      cb.checked = mappedReasons.includes(cb.value);
    });

    if (Array.isArray(decl.missingCourses) && decl.missingCourses.length > 0) {
      decl.missingCourses.forEach(c => {
        window.addStudentMissingCourseRow(c.courseCode || '', c.courseName || '', c.credits || '');
      });
    }

    if (englishNotesInput && decl.englishCertificateStatus) {
      englishNotesInput.value = decl.englishCertificateStatus;
    }

    if (otherReasonInput && decl.otherReason) {
      otherReasonInput.value = decl.otherReason;
    }

    window.onIneligibleReasonToggled();
  }
};

window.collectStudentEligibilityDeclaration = function() {
  const selectedStatus = document.querySelector('input[name="student-eligibility-status"]:checked')?.value;
  const errorEl = document.getElementById('student-decl-error');

  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  if (!selectedStatus) {
    const msg = 'Vui lòng chọn tình trạng đủ điều kiện làm DATN/DATH ("Đã đủ điều kiện" hoặc "Chưa đủ điều kiện").';
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    }
    return { valid: false, error: msg };
  }

  const existing = state.myRegistration?.eligibilityDeclaration || {};

  if (selectedStatus === 'eligible') {
    return {
      valid: true,
      declaration: {
        status: 'eligible',
        reasons: [],
        missingCourses: [],
        englishCertificateStatus: '',
        otherReason: '',
        studentDeclaredAt: existing.studentDeclaredAt || new Date().toISOString(),
        studentUpdatedAt: new Date().toISOString()
      }
    };
  }

  const checkedBoxes = Array.from(document.querySelectorAll('input[name="ineligible-reason"]:checked'));
  const selectedReasons = checkedBoxes.map(cb => cb.value);

  if (selectedReasons.length === 0) {
    const msg = 'Vui lòng chọn ít nhất một lý do bạn chưa đủ điều kiện làm DATN/DATH.';
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    }
    return { valid: false, error: msg };
  }

  let missingCourses = [];
  const hasCourseReason = selectedReasons.includes('failing_courses') ||
    selectedReasons.includes('missing_credits_1_3') ||
    selectedReasons.includes('missing_credits_4_6') ||
    selectedReasons.includes('missing_credits_7_10');

  if (hasCourseReason) {
    const rows = Array.from(document.querySelectorAll('#student-missing-courses-tbody tr'));
    missingCourses = rows.map(r => {
      const code = r.querySelector('.missing-course-code')?.value?.trim() || '';
      const name = r.querySelector('.missing-course-name')?.value?.trim() || '';
      const credits = r.querySelector('.missing-course-credits')?.value?.trim() || '';
      return { courseCode: code, courseName: name, credits: credits ? Number(credits) : null };
    }).filter(c => c.courseName);

    if (selectedReasons.includes('failing_courses') && missingCourses.length === 0) {
      const msg = 'Bạn đã chọn lý do "Còn nợ học phần/môn học chưa đạt". Vui lòng nhập ít nhất một Tên học phần còn nợ.';
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
      }
      return { valid: false, error: msg };
    }
  }

  let englishNotes = '';
  if (selectedReasons.some(r => r === 'no_english_cert' || r === 'english_waiting_result' || r === 'english_waiting_verification' || r.startsWith('english_'))) {
    englishNotes = document.getElementById('student-english-notes')?.value?.trim() || '';
  }

  let otherReason = '';
  if (selectedReasons.includes('other')) {
    otherReason = document.getElementById('student-other-reason-text')?.value?.trim() || '';
    if (!otherReason) {
      const msg = 'Bạn đã chọn "Lý do khác". Vui lòng nhập mô tả chi tiết lý do bạn chưa đủ điều kiện.';
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
      }
      return { valid: false, error: msg };
    }
  }

  return {
    valid: true,
    declaration: {
      status: 'ineligible',
      reasons: selectedReasons,
      missingCourses,
      englishCertificateStatus: englishNotes,
      otherReason,
      studentDeclaredAt: existing.studentDeclaredAt || new Date().toISOString(),
      studentUpdatedAt: new Date().toISOString()
    }
  };
};

window.validateAndGoToStep2 = function() {
  const identity = (typeof getRegistrationStudentIdentity === 'function') ? getRegistrationStudentIdentity() : null;
  if (!identity?.mssv) {
    showToast('Không xác định được MSSV từ tài khoản đăng nhập. Vui lòng đăng nhập tài khoản sinh viên TDTU (@student.tdtu.edu.vn).', 'error');
    const mssvErrEl = document.getElementById('registration-mssv-error');
    if (mssvErrEl) {
      mssvErrEl.textContent = '⚠️ Không xác định được Mã số sinh viên (MSSV) từ tài khoản đăng nhập. Vui lòng đăng nhập bằng tài khoản Google sinh viên TDTU (@student.tdtu.edu.vn).';
      mssvErrEl.classList.remove('hidden');
    }
    return;
  }

  const declResult = window.collectStudentEligibilityDeclaration?.();
  if (declResult && !declResult.valid) {
    showToast(declResult.error, 'warning');
    document.getElementById('student-eligibility-declaration-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (declResult && declResult.valid && declResult.declaration) {
    state.currentEligibilityDeclaration = declResult.declaration;
  }

  const topicInput = document.getElementById('input-topic-title');
  const errorEl = document.getElementById('topic-title-error');
  const topic = (topicInput?.value || '').trim();
  const projectTypes = getSelectedProjectTypes();
  const officialFormFields = collectOfficialFormFields();

  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  if (!topic) {
    const msg = 'Vui lòng nhập tên đề tài tốt nghiệp dự kiến.';
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    }
    showToast(msg, 'warning');
    topicInput?.focus();
    return;
  }

  // Requirement 6: Topic title MUST start with "Thiết kế nội thất" (case-insensitive)
  const trimmedTopic = topic.trim().toLowerCase();
  if (!trimmedTopic.startsWith('thiết kế nội thất')) {
    const msg = 'Tên đề tài BẮT BUỘC phải bắt đầu bằng cụm từ "Thiết kế nội thất". Ví dụ: "Thiết kế nội thất Trung tâm văn hóa..."';
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    }
    showToast(msg, 'error');
    topicInput?.focus();
    return;
  }

  if (projectTypes.length < 1 || projectTypes.length > 3) {
    showToast('Vui lòng chọn từ 1 đến 3 loại hình đồ án.', 'warning');
    document.getElementById('project-types-checkbox-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!validateOfficialFormFields(officialFormFields)) return;
  if (projectTypes.includes('Khác') && !(document.getElementById('input-project-type-other')?.value || '').trim()) {
    showToast('Vui lòng nhập nội dung cho loại hình “Khác”.', 'warning');
    document.getElementById('input-project-type-other')?.focus();
    return;
  }

  goToStep(shouldSkipStudentSupervisorPreference() ? 3 : 2);
};

export function getLegacyPreferenceCount() {
  const s = (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : null);
  if (!s || !s.myRegistration) return 0;
  const prefs = s.myRegistration.preferences;
  if (!Array.isArray(prefs)) return 0;
  if (prefs.length > 0 && prefs.length < 3) {
    return prefs.length;
  }
  return 0;
}

export function isExistingLegacyRegistration() {
  return getLegacyPreferenceCount() > 0;
}
if (typeof window !== 'undefined') {
  window.getLegacyPreferenceCount = getLegacyPreferenceCount;
  window.isExistingLegacyRegistration = isExistingLegacyRegistration;
}

window.validateAndGoToStep3 = async function() {
  if (shouldSkipStudentSupervisorPreference()) {
    goToStep(3);
    return;
  }
  const count = (state.selectedPreferences || []).length;
  const legacyCount = getLegacyPreferenceCount();

  if (legacyCount > 0) {
    if (count < legacyCount) {
      showToast(`Hồ sơ đã nộp của bạn có ${legacyCount} nguyện vọng. Không được giảm số nguyện vọng đã đăng ký.`, 'warning');
      return;
    }
    if (count === 0) {
      showToast('Vui lòng chọn ít nhất 1 nguyện vọng giảng viên hướng dẫn trước khi tiếp tục.', 'warning');
      return;
    }
  } else {
    if (count === 0) {
      showToast('Vui lòng chọn đầy đủ 3 nguyện vọng giảng viên hướng dẫn trước khi tiếp tục.', 'warning');
      return;
    }
    if (count < 3) {
      showToast(`Bạn hiện mới chọn ${count}/3 nguyện vọng. Bắt buộc phải chọn đủ 3 giảng viên hướng dẫn khác nhau trước khi tiếp tục.`, 'warning');
      return;
    }
  }

  const supervisorIds = (state.selectedPreferences || []).map(p => p.supervisorId).filter(Boolean);
  const uniqueIds = new Set(supervisorIds);
  if (uniqueIds.size !== count || supervisorIds.length !== count) {
    showToast('Mỗi giảng viên hướng dẫn chỉ được chọn ở một nguyện vọng. Vui lòng chọn các giảng viên khác nhau.', 'warning');
    return;
  }

  if (Array.isArray(state.roundSupervisors) && state.roundSupervisors.length > 0) {
    const roundSupIds = new Set(state.roundSupervisors.map(s => String(s.id || s.supervisorId || s.email || '').toLowerCase()));
    const invalidSup = state.selectedPreferences.find(p => {
      const id = String(p.supervisorId || '').toLowerCase();
      return !roundSupIds.has(id);
    });
    if (invalidSup) {
      showToast(`Giảng viên "${invalidSup.supervisorName || invalidSup.supervisorId}" không thuộc danh sách hướng dẫn của đợt này.`, 'error');
      return;
    }
  }

  // Ensure ranks are sequentially 1..count
  state.selectedPreferences.sort((a, b) => Number(a.rank) - Number(b.rank));
  state.selectedPreferences.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  goToStep(3);
};

function renderConfirmationPanel() {
  document.getElementById('confirm-topic-title').textContent = (document.getElementById('input-topic-title')?.value || '').trim();
  const other = (document.getElementById('input-project-type-other')?.value || '').trim();
  document.getElementById('confirm-project-type').textContent = getSelectedProjectTypes().map(t => t === 'Khác' && other ? `Khác: ${other}` : t).join(' • ');

  const directAssignment = shouldSkipStudentSupervisorPreference();
  const preferencesSection = document.getElementById('confirmation-preferences-section');
  if (preferencesSection) preferencesSection.classList.toggle('hidden', directAssignment);
  const listEl = document.getElementById('confirm-preferences-list');
  const submitBtn = document.getElementById('btn-submit-registration');

  if (!directAssignment) {
    const count = (state.selectedPreferences || []).length;
    const supIds = (state.selectedPreferences || []).map(p => p.supervisorId).filter(Boolean);
    const uniqueIds = new Set(supIds);
    const legacyCount = getLegacyPreferenceCount();
    const isLegacyValid = legacyCount > 0 && count >= legacyCount && count <= 3 && uniqueIds.size === count;
    const isStandardValid = count === 3 && uniqueIds.size === 3;

    if (!isStandardValid && !isLegacyValid) {
      if (listEl) {
        listEl.className = 'p-4 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-xs space-y-2';
        listEl.innerHTML = `
          <div class="font-bold flex items-center gap-2 text-rose-700">
            <span>⚠️</span>
            <span>Chưa hoàn tất đủ 3 nguyện vọng giảng viên hướng dẫn (Hiện có: ${count}/3)</span>
          </div>
          <p class="text-slate-600">Quy định bắt buộc bạn phải đăng ký đúng 3 giảng viên hướng dẫn khác nhau (Nguyện vọng 1, 2 và 3). Vui lòng quay lại Bước 2 để bổ sung.</p>
          <div class="pt-1">
            <button type="button" onclick="goToStep(2)" class="px-4 py-1.5 bg-tdtu-blue hover:bg-tdtu-dark text-white rounded-lg font-bold text-xs shadow-sm">
              ← Quay lại Bước 2 chọn GVHD
            </button>
          </div>
        `;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.title = 'Vui lòng quay lại Bước 2 để chọn đủ 3 nguyện vọng GVHD';
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
      return;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.title = '';
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  if (!listEl) return;

  const count = (state.selectedPreferences || []).length;
  const legacyCount = getLegacyPreferenceCount();
  const isLegacyValid = legacyCount > 0 && count >= legacyCount && count <= 3;

  let legacyNoticeEl = document.getElementById('confirm-legacy-notice');
  if (!legacyNoticeEl && preferencesSection) {
    legacyNoticeEl = document.createElement('div');
    legacyNoticeEl.id = 'confirm-legacy-notice';
    preferencesSection.insertBefore(legacyNoticeEl, listEl);
  }
  if (legacyNoticeEl) {
    if (isLegacyValid && count < 3) {
      legacyNoticeEl.className = 'w-full mb-3 p-3 bg-sky-50 rounded-xl border border-sky-200 text-sky-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs';
      legacyNoticeEl.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-base shrink-0">ℹ️</span>
          <span><strong>Hồ sơ nộp theo quy định trước đây (${count} nguyện vọng):</strong> Thông tin hợp lệ, bạn có thể gửi cập nhật đề tài và thông tin cá nhân bình thường.</span>
        </div>
        <button type="button" onclick="goToStep(2)" class="text-tdtu-blue hover:underline font-bold text-[11px] shrink-0 self-end sm:self-auto">
          + Bổ sung thêm GVHD
        </button>
      `;
      legacyNoticeEl.classList.remove('hidden');
    } else {
      legacyNoticeEl.innerHTML = '';
      legacyNoticeEl.classList.add('hidden');
    }
  }

  const medalOrder = [2, 1, 3];
  const orderedPreferences = [...state.selectedPreferences].sort((a, b) => {
    const aIndex = medalOrder.indexOf(Number(a.rank));
    const bIndex = medalOrder.indexOf(Number(b.rank));
    return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
  });

  const cardsHtml = orderedPreferences.map(p => {
    const sup = (typeof resolveSupervisorProfile === 'function')
      ? resolveSupervisorProfile(p.supervisorId || p.id || p.email)
      : ((state.roundSupervisors || []).find(s => s.id === p.supervisorId) ||
         (state.supervisorsMaster || []).find(s => s.id === p.supervisorId));
    const supName = sup?.name || p.supervisorName || '';
    const avatarSrc = (sup?.showPhoto !== false && sup?.photoUrl && sup.photoUrl.trim())
      ? sup.photoUrl
      : getSupervisorAvatarSvgDataUri(supName);
    const escapedName = escapeHtml(supName || '');

    const rank = Number(p.rank);
    const isFirst = rank === 1;
    const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : '🥉');
    const rankLabel = rank === 1 ? 'Nguyện vọng 1' : `Nguyện vọng ${rank}`;
    const translateYClass = count > 1 && isFirst ? '-translate-y-4' : '';
    return `
      <div class="relative flex flex-col items-center text-center w-[135px] sm:w-[175px] ${isFirst ? 'order-2 ' + translateYClass : (rank === 2 ? 'order-1' : 'order-3')}" title="${rankLabel}: ${escapedName}">
        <div class="absolute -top-3 -right-1 sm:right-3 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-xl">${medal}</div>
        <div class="${isFirst ? 'w-28 h-28 sm:w-32 sm:h-32 ring-4 ring-amber-300' : 'w-24 h-24 sm:w-28 sm:h-28 ring-4 ring-slate-200'} rounded-full bg-white p-1 shadow-lg">
          <img src="${avatarSrc}" onerror="this.onerror=null; this.src=getSupervisorAvatarSvgDataUri('${escapedName}');" class="w-full h-full rounded-full object-cover object-top" alt="${escapedName}">
        </div>
        <span class="mt-3 inline-flex px-3 py-1 rounded-full ${isFirst ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white text-tdtu-blue border-slate-200'} border text-[10px] sm:text-xs font-black uppercase tracking-wide shadow-sm">${rankLabel}</span>
        <span class="mt-2 font-black text-slate-900 text-xs sm:text-sm leading-snug min-h-[36px] flex items-start justify-center">${escapedName}</span>
      </div>
    `;
  }).join('');

  listEl.className = 'flex flex-wrap sm:flex-nowrap items-end justify-center gap-3 sm:gap-5 pt-5 pb-2';
  listEl.innerHTML = cardsHtml;
}

window.submitRegistration = async function() {
  if (!checkImpersonationWriteGuard('Nộp đăng ký nguyện vọng đồ án')) return;

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const roundId = state.selectedRoundId;
  const mssv = state.isPreviewMode ? state.previewMssv : (actor?.studentMssv || state.studentMssv);
  const topicTitle = (document.getElementById('input-topic-title')?.value || '').trim();
  const projectTypes = getSelectedProjectTypes();
  const projectTypeOther = (document.getElementById('input-project-type-other')?.value || '').trim();
  const projectType = projectTypes.map(t => t === 'Khác' && projectTypeOther ? `Khác: ${projectTypeOther}` : t).join('; ');
  const officialFormFields = collectOfficialFormFields();

  if (!roundId || !mssv) {
    showToast('Không xác định được phiên làm việc hoặc MSSV.', 'warning');
    return;
  }

  if (!validateOfficialFormFields(officialFormFields)) {
    goToStep(1);
    return;
  }

  if (!topicTitle.toLowerCase().trim().startsWith('thiết kế nội thất')) {
    showToast('Tên đề tài BẮT BUỘC phải bắt đầu bằng cụm từ "Thiết kế nội thất".', 'error');
    goToStep(1);
    return;
  }

  // Collect and validate eligibility declaration safely
  const declResult = (typeof window.collectStudentEligibilityDeclaration === 'function')
    ? window.collectStudentEligibilityDeclaration()
    : null;

  if (declResult && !declResult.valid && !state.myRegistration?.eligibilityDeclaration && !state.currentEligibilityDeclaration) {
    showToast(declResult.error, 'warning');
    goToStep(1);
    document.getElementById('student-eligibility-declaration-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const finalDeclaration = (declResult && declResult.valid && declResult.declaration)
    ? declResult.declaration
    : (state.currentEligibilityDeclaration || state.myRegistration?.eligibilityDeclaration || null);

  const directAssignment = shouldSkipStudentSupervisorPreference();
  if (!directAssignment) {
    const prefs = state.selectedPreferences || [];
    const count = prefs.length;
    const legacyCount = getLegacyPreferenceCount();
    const isLegacy = legacyCount > 0;

    if (isLegacy) {
      if (count < legacyCount) {
        showToast(`Hồ sơ đã nộp của bạn có ${legacyCount} nguyện vọng. Không được giảm số nguyện vọng đã đăng ký.`, 'warning');
        goToStep(2);
        return;
      }
      if (count === 0 || count > 3) {
        showToast('Số lượng nguyện vọng không hợp lệ (cho phép từ 1 đến 3).', 'warning');
        goToStep(2);
        return;
      }
    } else {
      if (count !== 3) {
        showToast(`Bắt buộc phải chọn đủ 3 nguyện vọng giảng viên hướng dẫn (hiện có ${count}/3).`, 'warning');
        goToStep(2);
        return;
      }
    }

    const supIds = prefs.map(p => p.supervisorId).filter(Boolean);
    const uniqueIds = new Set(supIds);
    if (uniqueIds.size !== count || supIds.length !== count) {
      showToast('Mỗi giảng viên hướng dẫn chỉ được chọn ở một nguyện vọng. Vui lòng chọn các giảng viên khác nhau.', 'warning');
      goToStep(2);
      return;
    }
    if (Array.isArray(state.roundSupervisors) && state.roundSupervisors.length > 0) {
      const roundSupIds = new Set(state.roundSupervisors.map(s => String(s.id || s.supervisorId || s.email || '').toLowerCase()));
      const invalidSup = prefs.find(p => {
        const id = String(p.supervisorId || '').toLowerCase();
        return !roundSupIds.has(id);
      });
      if (invalidSup) {
        showToast(`Giảng viên "${invalidSup.supervisorName || invalidSup.supervisorId}" không thuộc danh sách hướng dẫn của đợt này.`, 'error');
        goToStep(2);
        return;
      }
    }
  }

  const btn = document.getElementById('btn-submit-registration');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Đang ghi nhận đăng ký...</span>';

  try {
    const isPending = (state.isEligible === 'pending' || state.eligibilityState === 'pending');
    const eligibilityStatus = isPending ? 'pending' : 'eligible';
    const publishedAssignment = state.myOfficialAssignment?.assignmentStatus === 'published'
      ? normalizeOfficialAssignment(state.myOfficialAssignment, null)
      : null;
    const publishedSupervisors = publishedAssignment ? getOfficialSupervisors(publishedAssignment) : [];
    const primaryPublishedSupervisor = publishedSupervisors.find(item => item.role === 'primary') || publishedSupervisors[0] || null;

    const resolvedName = (typeof window.resolveStudentName === 'function')
      ? window.resolveStudentName(mssv, actor?.displayName || state.user?.displayName || '')
      : (actor?.displayName || state.user?.displayName || mssv);
    const studentName = resolvedName || mssv;
    const studentEmail = String(actor?.email || state.user?.email || `${mssv}@student.tdtu.edu.vn`).toLowerCase().trim();

    const previous = state.myRegistration || null;
    const previousHistory = Array.isArray(previous?.topicTitleHistory) ? previous.topicTitleHistory : [];
    const wasApproved = previous && (previous.topicApprovalStatus === 'approved' || previous.approvalStatus === 'approved');
    const currentVersion = Number(previous?.topicTitleVersion || 1);
    const nextVersion = wasApproved ? (currentVersion + 1) : currentVersion;
    const topicTitleHistory = wasApproved || !previous
      ? previousHistory.concat([{
          version: nextVersion,
          title: topicTitle,
          submittedAt: new Date().toISOString(),
          status: 'pending'
        }])
      : (previousHistory.length > 0
          ? previousHistory.slice(0, -1).concat([{
              version: nextVersion,
              title: topicTitle,
              submittedAt: new Date().toISOString(),
              status: 'pending'
            }])
          : [{
              version: nextVersion,
              title: topicTitle,
              submittedAt: new Date().toISOString(),
              status: 'pending'
            }]
        );

    const payload = {
      studentId: mssv,
      studentName: studentName,
      email: studentEmail,
      topicTitle,
      projectType,
      projectTypes,
      projectTypeOther,
      ...officialFormFields,
      className: officialFormFields.currentClass || '',
      studentClass: officialFormFields.currentClass || '',
      major: getRegistrationStudentIdentity().major,
      topicTitleVersion: nextVersion,
      topicTitleHistory,
      topicApprovalStatus: 'pending',
      topicApprovalNote: '',
      preferences: directAssignment ? [] : [...state.selectedPreferences]
        .sort((a, b) => Number(a.rank) - Number(b.rank))
        .map((p, idx) => ({
          rank: idx + 1,
          supervisorId: p.supervisorId,
          supervisorName: p.supervisorName || '',
          department: p.department || ''
        })),
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'submitted',
      // A faculty assignment can be published before the student submits the
      // topic. Preserve that published relationship rather than sending the
      // student back to the waiting state on first registration.
      reviewStatus: directAssignment && primaryPublishedSupervisor ? 'manually_assigned' : (directAssignment ? 'direct_assignment_pending' : 'waiting'),
      eligibilityStatus: eligibilityStatus,
      eligibilityDeclaration: finalDeclaration,
      ...(previous?.adminReview ? { adminReview: previous.adminReview } : {}),
      ...(primaryPublishedSupervisor ? {
        officialSupervisors: publishedSupervisors,
        acceptedSupervisorId: primaryPublishedSupervisor.supervisorId || '',
        acceptedSupervisorName: primaryPublishedSupervisor.supervisorName || '',
        acceptedRank: publishedAssignment?.acceptedRank || 'manual',
        assignmentStatus: 'published'
      } : (previous?.officialSupervisors ? {
        officialSupervisors: previous.officialSupervisors,
        acceptedSupervisorId: previous.acceptedSupervisorId || '',
        acceptedSupervisorName: previous.acceptedSupervisorName || '',
        acceptedRank: previous.acceptedRank || 'manual',
        assignmentStatus: previous.assignmentStatus || ''
      } : {}))
    };

    await setDoc(doc(db, 'graduationStudentProfiles', mssv), {
      studentId: mssv,
      email: studentEmail,
      currentClass: officialFormFields.currentClass,
      personalEmail: officialFormFields.personalEmail,
      phone: officialFormFields.studentPhone,
      permanentAddress: officialFormFields.studentPermanentAddress,
      temporaryAddress: officialFormFields.studentTemporaryAddress,
      address: officialFormFields.studentTemporaryAddress,
      updatedAt: serverTimestamp(),
      updatedBy: actor?.email || studentEmail
    }, { merge: true });
    await setDoc(doc(db, 'graduationRounds', roundId, 'registrations', mssv), payload, { merge: true });

    if (typeof window.trackUserActivity === 'function') {
      window.trackUserActivity('Đăng ký đề tài', { context: payload.topicTitle });
    }

    showToast(directAssignment
      ? (primaryPublishedSupervisor ? '🎉 ĐĂNG KÝ THÀNH CÔNG! GVHD đã phân công được giữ nguyên.' : '🎉 ĐĂNG KÝ THÀNH CÔNG! Vui lòng chờ Khoa phân công GVHD.')
      : '🎉 ĐĂNG KÝ NGUYỆN VỌNG THÀNH CÔNG!', 'success');
    state.isRegisteringTopic = false;
    state.currentEligibilityDeclaration = null;
    await checkStudentEligibilityAndRegistration(roundId);
  } catch (err) {
    console.error('Lỗi khi nộp đăng ký:', err);
    showToast('Lỗi đăng ký: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🚀 XÁC NHẬN ĐĂNG KÝ CHÍNH THỨC</span>';
  }
};

// ============================================================================
// STUDENT EDIT TOPIC TITLE & RESUBMIT FOR SUPERVISOR REVIEW
// ============================================================================

window.openEditTopicTitleModal = function() {
  if (typeof openTopicRegistrationPreviewModal === 'function') {
    openTopicRegistrationPreviewModal(null, true);
    return;
  }
  if (typeof enableEditRegistration === 'function') {
    enableEditRegistration();
    return;
  }

  const modal = document.getElementById('modal-student-edit-topic');
  if (!modal) return;

  const reg = state.myRegistration;
  if (!reg) {
    showToast('Chưa tìm thấy thông tin đăng ký để chỉnh sửa.', 'warning');
    return;
  }

  const currentTitle = reg.topicTitle || reg.topic || reg.proposalTitle || '';
  const currentVersion = Number(reg.topicTitleVersion || 1);
  const wasApproved = (reg.topicApprovalStatus === 'approved' || reg.approvalStatus === 'approved');
  const nextVersion = wasApproved ? (currentVersion + 1) : currentVersion;

  const inputEl = document.getElementById('input-edit-topic-title');
  if (inputEl) {
    inputEl.value = currentTitle;
    inputEl.focus();
  }

  const curVerEl = document.getElementById('edit-topic-current-version');
  if (curVerEl) curVerEl.textContent = `Lần ${currentVersion}`;

  const nextVerEl = document.getElementById('edit-topic-next-version');
  if (nextVerEl) nextVerEl.textContent = `Lần ${nextVersion}`;

  modal.classList.remove('hidden');
};

window.closeEditTopicTitleModal = function() {
  const modal = document.getElementById('modal-student-edit-topic');
  if (modal) modal.classList.add('hidden');
};

window.submitUpdatedTopicTitle = async function() {
  if (!checkImpersonationWriteGuard('Chỉnh sửa tên đề tài')) return;

  const reg = state.myRegistration;
  const roundId = state.selectedRoundId || state.activeRound?.id;
  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const mssv = state.isPreviewMode ? state.previewMssv : (actor?.studentMssv || state.studentMssv);

  if (!reg || !roundId || !mssv) {
    showToast('Không xác định được đợt hoặc thông tin sinh viên.', 'error');
    return;
  }

  const inputEl = document.getElementById('input-edit-topic-title');
  const newTitle = (inputEl?.value || '').trim();

  if (!newTitle) {
    showToast('Vui lòng nhập tên đề tài mới.', 'warning');
    inputEl?.focus();
    return;
  }

  if (!newTitle.toLowerCase().startsWith('thiết kế nội thất')) {
    showToast('Tên đề tài BẮT BUỘC phải bắt đầu bằng cụm từ "Thiết kế nội thất".', 'error');
    inputEl?.focus();
    return;
  }

  if (newTitle.length < 10) {
    showToast('Tên đề tài quá ngắn. Vui lòng nhập đầy đủ tên đề tài.', 'warning');
    inputEl?.focus();
    return;
  }

  if (newTitle === (reg.topicTitle || '').trim()) {
    showToast('Tên đề tài chưa có thay đổi so với hiện tại.', 'info');
    return;
  }

  const btn = document.getElementById('btn-submit-edit-topic');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Đang gửi...</span>';
  }

  try {
    const currentVersion = Number(reg.topicTitleVersion || 1);
    const wasApproved = (reg.topicApprovalStatus === 'approved' || reg.approvalStatus === 'approved');
    const nextVersion = wasApproved ? (currentVersion + 1) : currentVersion;
    const previousHistory = Array.isArray(reg.topicTitleHistory) ? reg.topicTitleHistory : [];

    const historyEntry = {
      version: nextVersion,
      title: newTitle,
      submittedAt: new Date().toISOString(),
      status: 'pending'
    };
    const topicTitleHistory = wasApproved || previousHistory.length === 0
      ? previousHistory.concat([historyEntry])
      : previousHistory.slice(0, -1).concat([historyEntry]);

    const updatePayload = {
      topicTitle: newTitle,
      topicTitleVersion: nextVersion,
      topicTitleHistory: topicTitleHistory,
      topicApprovalStatus: 'pending',
      topicApprovalNote: '',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor?.email || state.user?.email || mssv
    };

    await updateDoc(doc(db, 'graduationRounds', roundId, 'registrations', mssv), updatePayload);

    // Cập nhật state cục bộ để UI phản ánh tức thì
    state.myRegistration = {
      ...reg,
      ...updatePayload,
      submittedAt: new Date(),
      updatedAt: new Date()
    };

    // Re-render hero topic card & timeline
    if (typeof renderRoundHeader === 'function' && state.activeRound) {
      renderRoundHeader(state.activeRound);
    }
    if (typeof renderStudentTimelineWeeks === 'function') {
      renderStudentTimelineWeeks();
    }

    closeEditTopicTitleModal();
    if (typeof window.trackUserActivity === 'function') {
      window.trackUserActivity(`Chỉnh sửa tên đề tài (Lần ${nextVersion})`, { context: newTitle });
    }
    showToast(`🎉 Đã cập nhật tên đề tài (Lần ${nextVersion}) và chuyển GVHD duyệt lại!`, 'success');
  } catch (err) {
    console.error('Lỗi khi cập nhật tên đề tài:', err);
    showToast('Lỗi cập nhật tên đề tài: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🚀 Gửi GVHD duyệt lại</span>';
    }
  }
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof checkStudentEligibilityAndRegistration !== 'undefined') window.checkStudentEligibilityAndRegistration = checkStudentEligibilityAndRegistration;
  if (typeof renderStudentOfficialResult !== 'undefined') window.renderStudentOfficialResult = renderStudentOfficialResult;
  if (typeof renderStudentExistingRegistration !== 'undefined') window.renderStudentExistingRegistration = renderStudentExistingRegistration;
  if (typeof applySupervisorAssignmentModeToRegistrationUI !== 'undefined') window.applySupervisorAssignmentModeToRegistrationUI = applySupervisorAssignmentModeToRegistrationUI;
  if (typeof renderConfirmationPanel !== 'undefined') window.renderConfirmationPanel = renderConfirmationPanel;
}
