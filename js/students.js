/**
 * IFA+ Graduation — Students, Eligibility & IFAA Master Module
 */
async function checkStudentEligibilityAndRegistration(roundId) {
  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  
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

  if (!mssv) {
    if (nonEligibleAlert) nonEligibleAlert.classList.add('hidden');
    if (heroCard) heroCard.classList.remove('hidden');
    if (journeyCard) journeyCard.classList.remove('hidden');
    if (alreadyRegCard) alreadyRegCard.classList.add('hidden');
    if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
    if (officialResultCard) officialResultCard.classList.add('hidden');
    if (ctaCard) ctaCard.classList.remove('hidden');
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

    const hasExplicitBlacklist = elDoc?.exists() && elDoc.data()?.eligible === false;
    const hasExplicitEligible = elDoc?.exists() && elDoc.data()?.eligible !== false;
    const hasReg = Boolean(regDoc?.exists());
    const hasAssignment = Boolean(assignmentDoc?.exists());
    const isActAsStudent = Boolean(state.impersonation && (state.impersonation.target?.type === 'student' || state.impersonation.target?.mssv === mssv));
    const roundHasNoRoster = !roundData?.eligibilityFinalized && (!roundData?.eligibleCount || roundData?.eligibleCount === 0) && (!roundData?.eligibleStudentsCount || roundData?.eligibleStudentsCount === 0);

    const isOfficiallyEligible = !hasExplicitBlacklist && (hasExplicitEligible || hasReg || hasAssignment || isActAsStudent || roundHasNoRoster);

    if (isOfficiallyEligible) {
      state.isEligible = true;
      state.eligibilityState = 'eligible';
      if (nonEligibleAlert) nonEligibleAlert.classList.add('hidden');
      if (heroCard) heroCard.classList.remove('hidden');
      if (journeyCard) journeyCard.classList.remove('hidden');
    } else if (allowPre) {
      state.isEligible = 'pending';
      state.eligibilityState = 'pending';
      if (nonEligibleAlert) nonEligibleAlert.classList.add('hidden');
      if (heroCard) heroCard.classList.remove('hidden');
      if (journeyCard) journeyCard.classList.remove('hidden');
    } else {
      state.isEligible = false;
      state.eligibilityState = 'not_eligible';
      if (nonEligibleAlert) nonEligibleAlert.classList.remove('hidden');
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
        return;
      }

      // 2. Registered without a published assignment is a normal waiting state.
      if (!hasPublishedAssignment) {
        if (alreadyRegCard) alreadyRegCard.classList.remove('hidden');
        renderStudentExistingRegistration(state.myRegistration);
        if (officialResultCard) officialResultCard.classList.add('hidden');
        
        const reviewTag = document.getElementById('review-round-tag');
        if (reviewTag) reviewTag.textContent = 'ĐANG XỬ LÝ';
        if (reviewInProgressCard) reviewInProgressCard.classList.remove('hidden');
        updateStudentJourneyStepper();
        updateStudentPersonalSidebar();
        renderRoundHeader();
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

    } else {
      if (alreadyRegCard) alreadyRegCard.classList.add('hidden');
      if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
      if (state.myOfficialAssignment?.assignmentStatus === 'published') {
        renderStudentOfficialResult(normalizeOfficialAssignment(state.myOfficialAssignment, null));
        if (officialResultCard) officialResultCard.classList.add('hidden');
      } else if (officialResultCard) {
        officialResultCard.classList.add('hidden');
      }
      if (ctaCard) ctaCard.classList.remove('hidden');
      if (flowContainer) flowContainer.classList.add('hidden');
      goToStep(1);
      updateStudentJourneyStepper();
      updateStudentPersonalSidebar();
      renderRoundHeader();
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
      const sup = (state.roundSupervisors || []).find(s => s.id === item.supervisorId || s.supervisorId === item.supervisorId)
        || (state.supervisorsMaster || []).find(s => s.id === item.supervisorId);

      const isPrimary = (item.role === 'primary');
      const roleBadge = isPrimary
        ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[10px] shadow-sm uppercase tracking-wide">GVHD chính</span>'
        : '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500 text-white font-black text-[10px] shadow-sm uppercase tracking-wide">GVHD 2</span>';

      const showEmail = (state.activeRound?.showEmailAfterPublish !== false && sup?.email);
      const showPhone = (state.activeRound?.showPhoneAfterPublish !== false && sup?.phone);
      const supName = item.supervisorName || sup?.name || 'Giảng viên Hướng dẫn';
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
      bannerEl.className = 'mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2.5';
      bannerEl.innerHTML = `
        <span class="text-base">✓</span>
        <div>
          <span class="font-bold block">GVHD đã được Khoa phân công: ${escapeHtml(assignedName)}</span>
          <p class="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">Bạn có thể tiếp tục đăng ký và nộp đề tài theo kế hoạch của đợt.</p>
        </div>
      `;
      bannerEl.classList.remove('hidden');
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
      bannerEl.className = 'mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2.5';
      bannerEl.innerHTML = `
        <span class="text-base">✓</span>
        <div>
          <span class="font-bold block">Trạng thái điều kiện: Đủ điều kiện làm ĐATN</span>
          <p class="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
            Hồ sơ của bạn đã được xác nhận đủ điều kiện và đang tham gia quy trình xét duyệt của GVHD.
          </p>
        </div>
      `;
      bannerEl.classList.remove('hidden');
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
    const sup = (state.roundSupervisors || []).find(s => s.id === p.supervisorId) ||
                (state.supervisorsMaster || []).find(s => s.id === p.supervisorId);
    const avatarSrc = (sup?.showPhoto !== false && sup?.photoUrl && sup.photoUrl.trim())
      ? sup.photoUrl
      : getSupervisorAvatarSvgDataUri(p.supervisorName || 'GV');
    const escapedName = escapeHtml(p.supervisorName || '');

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
  document.getElementById('input-topic-title').value = state.myRegistration.topicTitle || '';
  const storedTypes = state.myRegistration.projectTypes || parseStoredProjectTypes(state.myRegistration.projectType || '');
  setSelectedProjectTypes(storedTypes, state.myRegistration.projectTypeOther || '');
  populateRegistrationStudentForm();
  state.selectedPreferences = [...(state.myRegistration.preferences || [])];

  const alreadyCard = document.getElementById('already-registered-card');
  const ctaCard = document.getElementById('registration-cta-card');
  const flowContainer = document.getElementById('registration-flow-container');
  if (alreadyCard) alreadyCard.classList.add('hidden');
  if (ctaCard) ctaCard.classList.add('hidden');
  if (flowContainer) flowContainer.classList.remove('hidden');
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

window.validateAndGoToStep2 = function() {
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

window.validateAndGoToStep3 = async function() {
  if (shouldSkipStudentSupervisorPreference()) {
    goToStep(3);
    return;
  }
  const maxPref = parseInt(state.activeRound?.preferenceCount || 3, 10);
  const count = state.selectedPreferences.length;

  if (count === 0) {
    showToast('Vui lòng chọn ít nhất 1 nguyện vọng GVHD trước khi tiếp tục.', 'warning');
    return;
  }

  if (count < maxPref) {
    const ok = await window.showConfirm(
      'Xác nhận số lượng nguyện vọng',
      `Bạn hiện chỉ mới chọn ${count}/${maxPref} nguyện vọng GVHD. Nếu không chọn đủ ${maxPref} nguyện vọng, cơ hội được phân công đúng ý nguyện có thể giảm.\n\nBạn có chắc chắn muốn tiếp tục với ${count} nguyện vọng đã chọn?`,
      {
        confirmText: `Tiếp tục với ${count} nguyện vọng`,
        cancelText: 'Chọn thêm GVHD',
        danger: false
      }
    );
    if (!ok) return;
  }

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
  if (!listEl) return;

  const medalOrder = [2, 1, 3];
  const orderedPreferences = [...state.selectedPreferences].sort((a, b) => {
    const aIndex = medalOrder.indexOf(Number(a.rank));
    const bIndex = medalOrder.indexOf(Number(b.rank));
    return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
  });

  listEl.className = 'flex flex-wrap sm:flex-nowrap items-end justify-center gap-3 sm:gap-5 pt-5 pb-2';
  listEl.innerHTML = orderedPreferences.map(p => {
    const sup = (state.roundSupervisors || []).find(s => s.id === p.supervisorId) ||
                (state.supervisorsMaster || []).find(s => s.id === p.supervisorId);
    const avatarSrc = (sup?.showPhoto !== false && sup?.photoUrl && sup.photoUrl.trim()) 
      ? sup.photoUrl 
      : getSupervisorAvatarSvgDataUri(p.supervisorName);
    const escapedName = escapeHtml(p.supervisorName || '');

    const rank = Number(p.rank);
    const isFirst = rank === 1;
    const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : '🥉');
    const rankLabel = rank === 1 ? 'Nguyện vọng 1' : `Nguyện vọng ${rank}`;
    return `
      <div class="relative flex flex-col items-center text-center w-[135px] sm:w-[175px] ${isFirst ? 'order-2 -translate-y-5' : (rank === 2 ? 'order-1' : 'order-3')}" title="${rankLabel}: ${escapedName}">
        <div class="absolute -top-3 -right-1 sm:right-3 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-xl">${medal}</div>
        <div class="${isFirst ? 'w-28 h-28 sm:w-32 sm:h-32 ring-4 ring-amber-300' : 'w-24 h-24 sm:w-28 sm:h-28 ring-4 ring-slate-200'} rounded-full bg-white p-1 shadow-lg">
          <img src="${avatarSrc}" onerror="this.onerror=null; this.src=getSupervisorAvatarSvgDataUri('${escapedName}');" class="w-full h-full rounded-full object-cover object-top" alt="${escapedName}">
        </div>
        <span class="mt-3 inline-flex px-3 py-1 rounded-full ${isFirst ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white text-tdtu-blue border-slate-200'} border text-[10px] sm:text-xs font-black uppercase tracking-wide shadow-sm">${rankLabel}</span>
        <span class="mt-2 font-black text-slate-900 text-xs sm:text-sm leading-snug min-h-[36px] flex items-start justify-center">${escapedName}</span>
      </div>
    `;
  }).join('');
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

  const btn = document.getElementById('btn-submit-registration');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Đang ghi nhận đăng ký...</span>';

  try {
    const isPending = (state.isEligible === 'pending' || state.eligibilityState === 'pending');
    const eligibilityStatus = isPending ? 'pending' : 'eligible';
    const directAssignment = shouldSkipStudentSupervisorPreference();
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
    const titleChanged = !previous || String(previous.topicTitle || '').trim() !== topicTitle;
    const previousHistory = Array.isArray(previous?.topicTitleHistory) ? previous.topicTitleHistory : [];
    const nextVersion = titleChanged ? Math.max(Number(previous?.topicTitleVersion || 0) + 1, previousHistory.length + 1) : Number(previous?.topicTitleVersion || 1);
    const topicTitleHistory = titleChanged ? previousHistory.concat([{
      version: nextVersion,
      title: topicTitle,
      submittedAt: new Date().toISOString(),
      status: 'pending'
    }]) : previousHistory;

    const payload = {
      studentId: mssv,
      studentName: studentName,
      email: studentEmail,
      topicTitle,
      projectType,
      projectTypes,
      projectTypeOther,
      ...officialFormFields,
      major: getRegistrationStudentIdentity().major,
      topicTitleVersion: nextVersion,
      topicTitleHistory,
      topicApprovalStatus: titleChanged ? 'pending' : (previous?.topicApprovalStatus || 'pending'),
      topicApprovalNote: titleChanged ? '' : (previous?.topicApprovalNote || ''),
      preferences: directAssignment ? [] : state.selectedPreferences.map(p => ({
        rank: p.rank,
        supervisorId: p.supervisorId,
        supervisorName: p.supervisorName,
        department: p.department || ''
      })),
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'submitted',
      // A faculty assignment can be published before the student submits the
      // topic. Preserve that published relationship rather than sending the
      // student back to the waiting state on first registration.
      reviewStatus: directAssignment && primaryPublishedSupervisor ? 'manually_assigned' : (directAssignment ? 'direct_assignment_pending' : 'waiting'),
      eligibilityStatus: eligibilityStatus
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
    
    showToast(directAssignment
      ? (primaryPublishedSupervisor ? '🎉 ĐĂNG KÝ THÀNH CÔNG! GVHD đã phân công được giữ nguyên.' : '🎉 ĐĂNG KÝ THÀNH CÔNG! Vui lòng chờ Khoa phân công GVHD.')
      : '🎉 ĐĂNG KÝ NGUYỆN VỌNG THÀNH CÔNG!', 'success');
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
// TAB B: ELIGIBLE STUDENTS HELPERS
// ============================================================================

// Helper to remove Vietnamese tones for flexible search
function removeVietnameseTones(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function renderRoundModalEligibleTable() {
  const tbody = document.getElementById('round-eligible-students-tbody');
  if (!tbody) return;

  const list = state.roundModalEligibleStudents || [];
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400 font-medium">Chưa có sinh viên nào trong đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((s, idx) => {
    const mssv = String(s.studentId || s.mssv || '').trim().toUpperCase();
    const master = window.getFacultyStudent ? window.getFacultyStudent(mssv) : null;
    const isFoundInMaster = master && !master.notFoundInMaster;

    let displayName = '';
    let displayMajor = s.major || '--';
    let displayClass = s.className || s.studentClass || '--';
    let showNotFoundBadge = false;

    if (isFoundInMaster) {
      displayName = master.fullName || master.name || s.name || s.fullName || '';
      displayMajor = master.major || s.major || '--';
      displayClass = master.className || master.studentClass || s.className || s.studentClass || '--';
    } else {
      const rawName = String(s.name || s.fullName || '').trim();
      // Ensure we NEVER display MSSV or 'Sinh viên MSSV' in Họ và tên column
      if (rawName && rawName !== mssv && !rawName.startsWith('Sinh viên ' + mssv)) {
        displayName = rawName;
      } else {
        displayName = '<span class="text-slate-400 italic">Chưa có thông tin</span>';
      }
      showNotFoundBadge = true;
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
        <td class="p-2.5 text-center text-slate-400 font-mono">${idx + 1}</td>
        <td class="p-2.5 font-mono font-bold text-slate-900">${mssv}</td>
        <td class="p-2.5">
          <div class="font-bold text-slate-800">${displayName}</div>
          ${showNotFoundBadge ? '<div class="mt-0.5"><span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Không tìm thấy trong SV Khoa</span></div>' : ''}
        </td>
        <td class="p-2.5 text-slate-600">${displayMajor}</td>
        <td class="p-2.5 font-mono text-slate-600">${displayClass}</td>
        <td class="p-2.5 text-right">
          <button type="button" onclick="removeRoundModalEligibleStudent('${mssv}')" class="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded font-bold text-xs transition-colors">Xóa</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.removeRoundModalEligibleStudent = function(studentId) {
  const cleanId = String(studentId || '').trim().toUpperCase();
  state.roundModalEligibleStudents = (state.roundModalEligibleStudents || []).filter(
    s => String(s.studentId || s.mssv || '').trim().toUpperCase() !== cleanId
  );
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
};

window.clearRoundModalEligibleStudents = function() {
  if (!state.roundModalEligibleStudents || state.roundModalEligibleStudents.length === 0) return;
  state.roundModalEligibleStudents = [];
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
  showToast('Đã xóa toàn bộ sinh viên khỏi đợt (bấm [Lưu Đợt] để lưu thay đổi).', 'info');
};

// ----------------------------------------------------------------------------
// QUICK SEARCH & ADD HELPERS
// ----------------------------------------------------------------------------
window.clearRoundQuickSearch = function() {
  const input = document.getElementById('round-add-student-input');
  const box = document.getElementById('round-student-suggestions');
  const clearBtn = document.getElementById('round-add-student-clear-btn');
  if (input) input.value = '';
  if (box) box.classList.add('hidden');
  if (clearBtn) clearBtn.classList.add('hidden');
};

document.addEventListener('click', (e) => {
  const box = document.getElementById('round-student-suggestions');
  const input = document.getElementById('round-add-student-input');
  if (box && !box.classList.contains('hidden')) {
    if (!box.contains(e.target) && e.target !== input) {
      box.classList.add('hidden');
    }
  }
});

window.suggestFacultyStudentsForRound = async function(query) {
  const box = document.getElementById('round-student-suggestions');
  const clearBtn = document.getElementById('round-add-student-clear-btn');
  if (!box) return;

  const rawQ = String(query || '').trim();
  if (clearBtn) {
    if (rawQ) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  if (rawQ.length < 2) {
    box.classList.add('hidden');
    return;
  }

  let rows = state.facultyStudents;
  if (!rows || rows.length === 0) {
    rows = await ensureFacultyDatasetLoaded().catch(() => []);
  }

  const qLower = rawQ.toLowerCase();
  const qNorm = removeVietnameseTones(rawQ);

  const matches = (rows || []).filter(s => {
    const mssvMatch = s.mssv && s.mssv.toLowerCase().includes(qLower);
    const nameMatch = removeVietnameseTones(s.fullName || s.name).includes(qNorm);
    const classMatch = removeVietnameseTones(s.className || s.studentClass).includes(qNorm);
    return mssvMatch || nameMatch || classMatch;
  }).slice(0, 10);

  if (matches.length === 0) {
    box.innerHTML = '<div class="p-3 text-center text-slate-400 font-medium">Không tìm thấy sinh viên phù hợp trong SV Khoa</div>';
    box.classList.remove('hidden');
    return;
  }

  const currentSet = new Set(
    (state.roundModalEligibleStudents || []).map(x => String(x.studentId || x.mssv || '').trim().toUpperCase())
  );

  box.innerHTML = matches.map(s => {
    const cleanMssv = String(s.mssv || '').trim().toUpperCase();
    const isAdded = currentSet.has(cleanMssv);
    return `
      <div class="p-2.5 hover:bg-indigo-50 flex items-center justify-between transition-colors">
        <div class="min-w-0 pr-2">
          <div class="flex items-center gap-2">
            <span class="font-bold font-mono text-slate-900 text-xs">${cleanMssv}</span>
            <span class="font-semibold text-slate-800 text-xs truncate">${s.fullName || s.name}</span>
          </div>
          <span class="text-[11px] text-slate-500 block truncate">${s.major || 'Chưa có ngành'} • ${s.className || s.studentClass || 'Chưa có lớp'}</span>
        </div>
        <div class="shrink-0">
          ${isAdded
            ? '<span class="px-2 py-1 bg-slate-100 text-slate-400 font-bold text-[11px] rounded">Đã có trong đợt</span>'
            : `<button type="button" onclick="addFacultyStudentToRound('${cleanMssv}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded font-bold text-xs transition-colors">+ Thêm</button>`
          }
        </div>
      </div>
    `;
  }).join('');
  box.classList.remove('hidden');
};

window.addFacultyStudentToRound = function(mssv) {
  const cleanMssv = String(mssv || '').trim().toUpperCase();
  if (!cleanMssv) return;

  clearRoundQuickSearch();

  const currentList = state.roundModalEligibleStudents || [];
  if (currentList.some(s => String(s.studentId || s.mssv || '').trim().toUpperCase() === cleanMssv)) {
    showToast(`Sinh viên ${cleanMssv} đã có trong danh sách đợt!`, 'warning');
    return;
  }

  const s = (state.facultyStudents || []).find(x => String(x.mssv || '').trim().toUpperCase() === cleanMssv) ||
            (window.getFacultyStudent ? window.getFacultyStudent(cleanMssv) : null);

  if (!s || s.notFoundInMaster) {
    showToast(`Không tìm thấy sinh viên ${cleanMssv} trong SV Khoa!`, 'error');
    return;
  }

  const fullName = s.fullName || s.name || '';
  const className = s.className || s.studentClass || '';

  currentList.push({
    studentId: cleanMssv,
    mssv: cleanMssv,
    name: fullName,
    fullName: fullName,
    gender: s.gender || '',
    major: s.major || '',
    className: className,
    studentClass: className,
    email: s.email || `${cleanMssv.toLowerCase()}@student.tdtu.edu.vn`,
    phone: s.phone || '',
    eligible: true
  });

  state.roundModalEligibleStudents = currentList;
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
  showToast(`✓ Đã thêm sinh viên ${cleanMssv} (${fullName}) vào đợt!`, 'success');
};

// ----------------------------------------------------------------------------
// MODAL: + THÊM SINH VIÊN (MULTI-SELECT FROM FACULTY STUDENT MASTER)
// ----------------------------------------------------------------------------
state.selectedEligibleCandidates = new Set();
state.currentCandidateMatches = [];

window.openAddEligibleStudentModal = async function() {
  state.selectedEligibleCandidates = new Set();
  state.currentCandidateMatches = [];

  const input = document.getElementById('add-eligible-student-search-input');
  if (input) input.value = '';

  const clearBtn = document.getElementById('add-eligible-clear-btn');
  if (clearBtn) clearBtn.classList.add('hidden');

  const selectAll = document.getElementById('select-all-eligible-candidates');
  if (selectAll) selectAll.checked = false;

  const modal = document.getElementById('modal-add-eligible-student');
  if (modal) modal.classList.remove('hidden');

  updateAddEligibleSelectionUI();

  // Load faculty dataset if not loaded
  let rows = state.facultyStudents;
  if (!rows || rows.length === 0) {
    if (typeof ensureFacultyDatasetLoaded === 'function') {
      rows = await ensureFacultyDatasetLoaded().catch(() => []);
    }
  }

  renderAddEligibleCandidateResults('');
};

window.closeAddEligibleStudentModal = function() {
  const modal = document.getElementById('modal-add-eligible-student');
  if (modal) modal.classList.add('hidden');
  state.selectedEligibleCandidates.clear();
  state.currentCandidateMatches = [];
};

window.clearAddEligibleSearch = function() {
  const input = document.getElementById('add-eligible-student-search-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('add-eligible-clear-btn');
  if (clearBtn) clearBtn.classList.add('hidden');
  renderAddEligibleCandidateResults('');
};

window.onAddEligibleStudentSearchInput = function(query) {
  const rawQ = String(query || '').trim();
  const clearBtn = document.getElementById('add-eligible-clear-btn');
  if (clearBtn) {
    if (rawQ) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  renderAddEligibleCandidateResults(rawQ);
};

function renderAddEligibleCandidateResults(query = '') {
  const tbody = document.getElementById('add-eligible-students-tbody');
  const countLabel = document.getElementById('add-eligible-search-count');
  if (!tbody) return;

  const rawQ = String(query || '').trim();
  const qLower = rawQ.toLowerCase();
  const qNorm = removeVietnameseTones(rawQ);

  const allRows = state.facultyStudents || [];
  let matches = [];

  if (!rawQ) {
    matches = allRows.slice(0, 40);
  } else {
    matches = allRows.filter(s => {
      const mssvMatch = s.mssv && s.mssv.toLowerCase().includes(qLower);
      const nameMatch = removeVietnameseTones(s.fullName || s.name).includes(qNorm);
      const classMatch = removeVietnameseTones(s.className || s.studentClass).includes(qNorm);
      const majorMatch = removeVietnameseTones(s.major).includes(qNorm);
      return mssvMatch || nameMatch || classMatch || majorMatch;
    }).slice(0, 60);
  }

  state.currentCandidateMatches = matches;

  if (countLabel) {
    countLabel.textContent = rawQ
      ? `Tìm thấy ${matches.length} sinh viên phù hợp`
      : `Hiển thị ${matches.length} sinh viên (Gõ để tìm kiếm...)`;
  }

  if (matches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400 font-medium">Không tìm thấy sinh viên nào phù hợp trong SV Khoa.</td></tr>';
    updateAddEligibleSelectionUI();
    return;
  }

  const currentSet = new Set(
    (state.roundModalEligibleStudents || []).map(x => String(x.studentId || x.mssv || '').trim().toUpperCase())
  );

  tbody.innerHTML = matches.map(s => {
    const cleanMssv = String(s.mssv || '').trim().toUpperCase();
    const isAlreadyInRound = currentSet.has(cleanMssv);
    const isChecked = state.selectedEligibleCandidates.has(cleanMssv);

    return `
      <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${isAlreadyInRound ? 'bg-slate-50/60 opacity-60' : ''}">
        <td class="p-2.5 text-center">
          ${isAlreadyInRound
            ? '<input type="checkbox" disabled class="rounded text-slate-300 cursor-not-allowed">'
            : `<input type="checkbox" ${isChecked ? 'checked' : ''} onchange="onCandidateCheckboxChange('${cleanMssv}', this.checked)" class="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer">`
          }
        </td>
        <td class="p-2.5 font-mono font-bold text-slate-900">${cleanMssv}</td>
        <td class="p-2.5 font-bold text-slate-800">${s.fullName || s.name}</td>
        <td class="p-2.5 text-slate-600">${s.major || '--'}</td>
        <td class="p-2.5 font-mono text-slate-600">${s.className || s.studentClass || '--'}</td>
        <td class="p-2.5 text-center">
          ${isAlreadyInRound
            ? '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">Đã có trong đợt</span>'
            : isChecked
              ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Đang chọn</span>'
              : '<span class="px-2 py-0.5 rounded text-[11px] text-slate-400">Chưa thêm</span>'
          }
        </td>
      </tr>
    `;
  }).join('');

  updateAddEligibleSelectionUI();
}

window.onCandidateCheckboxChange = function(mssv, isChecked) {
  const cleanMssv = String(mssv || '').trim().toUpperCase();
  if (isChecked) {
    state.selectedEligibleCandidates.add(cleanMssv);
  } else {
    state.selectedEligibleCandidates.delete(cleanMssv);
  }
  updateAddEligibleSelectionUI();
};

window.toggleSelectAllEligibleCandidates = function(isChecked) {
  const currentSet = new Set(
    (state.roundModalEligibleStudents || []).map(x => String(x.studentId || x.mssv || '').trim().toUpperCase())
  );

  (state.currentCandidateMatches || []).forEach(s => {
    const cleanMssv = String(s.mssv || '').trim().toUpperCase();
    if (!currentSet.has(cleanMssv)) {
      if (isChecked) {
        state.selectedEligibleCandidates.add(cleanMssv);
      } else {
        state.selectedEligibleCandidates.delete(cleanMssv);
      }
    }
  });

  // Re-render table checkboxes to reflect change
  const query = document.getElementById('add-eligible-student-search-input')?.value || '';
  renderAddEligibleCandidateResults(query);
};

function updateAddEligibleSelectionUI() {
  const selectedCount = state.selectedEligibleCandidates.size;
  const selectedCountEl = document.getElementById('add-eligible-selected-count');
  const confirmBtn = document.getElementById('btn-confirm-add-eligible-students');
  const selectAll = document.getElementById('select-all-eligible-candidates');

  if (selectedCountEl) {
    selectedCountEl.textContent = `Đã chọn: ${selectedCount} SV`;
  }

  if (confirmBtn) {
    confirmBtn.disabled = selectedCount === 0;
    confirmBtn.textContent = `Thêm ${selectedCount} sinh viên đã chọn vào đợt`;
  }

  // Check if all selectable matches are checked
  if (selectAll && state.currentCandidateMatches && state.currentCandidateMatches.length > 0) {
    const currentSet = new Set(
      (state.roundModalEligibleStudents || []).map(x => String(x.studentId || x.mssv || '').trim().toUpperCase())
    );
    const selectable = state.currentCandidateMatches.filter(s => !currentSet.has(String(s.mssv || '').trim().toUpperCase()));
    if (selectable.length > 0 && selectable.every(s => state.selectedEligibleCandidates.has(String(s.mssv || '').trim().toUpperCase()))) {
      selectAll.checked = true;
    } else {
      selectAll.checked = false;
    }
  }
}

window.addSelectedEligibleCandidatesToRound = function() {
  if (state.selectedEligibleCandidates.size === 0) return;

  const currentList = state.roundModalEligibleStudents || [];
  const currentMssvSet = new Set(
    currentList.map(s => String(s.studentId || s.mssv || '').trim().toUpperCase())
  );

  let addedCount = 0;
  for (const mssv of state.selectedEligibleCandidates) {
    const cleanMssv = String(mssv || '').trim().toUpperCase();
    if (!currentMssvSet.has(cleanMssv)) {
      const s = (state.facultyStudents || []).find(x => String(x.mssv || '').trim().toUpperCase() === cleanMssv) ||
                (window.getFacultyStudent ? window.getFacultyStudent(cleanMssv) : null);
      if (s && !s.notFoundInMaster) {
        const fullName = s.fullName || s.name || '';
        const className = s.className || s.studentClass || '';
        currentList.push({
          studentId: cleanMssv,
          mssv: cleanMssv,
          name: fullName,
          fullName: fullName,
          gender: s.gender || '',
          major: s.major || '',
          className: className,
          studentClass: className,
          email: s.email || `${cleanMssv.toLowerCase()}@student.tdtu.edu.vn`,
          phone: s.phone || '',
          eligible: true
        });
        currentMssvSet.add(cleanMssv);
        addedCount++;
      }
    }
  }

  state.roundModalEligibleStudents = currentList;
  closeAddEligibleStudentModal();
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
  showToast(`✓ Đã thêm thành công ${addedCount} sinh viên vào đợt!`, 'success');
};

// ----------------------------------------------------------------------------
// EXCEL IMPORT FOR ROUND ELIGIBLE STUDENTS
// ----------------------------------------------------------------------------
window.handleRoundEligibleUpload = async function(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      showToast('File Excel rỗng.', 'error');
      return;
    }

    const keys = Object.keys(rawRows[0]);
    const cleanHeader = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const findKey = (...aliases) => keys.find(k => aliases.includes(cleanHeader(k)));

    const mssvKey = findKey('masv', 'maso', 'mssv', 'masinhvien', 'studentid');
    const fullNameKey = findKey('hoten', 'hovaten', 'fullname', 'name');
    const familyKey = findKey('holot', 'hodem', 'ho', 'familyname');
    const givenKey = findKey('ten', 'firstname');
    const genderKey = findKey('gioitinh', 'phai', 'gender');
    const majorKey = findKey('nganh', 'nganhhoc', 'chuyennganh', 'major');
    const classKey = findKey('lop', 'lophoc', 'lopquanly', 'class');
    const emailKey = findKey('email', 'thudientu', 'mail');
    const phoneKey = findKey('sodienthoai', 'dienthoai', 'sdt', 'phone');

    if (!mssvKey) {
      showToast('File cần có cột MSSV (Mã SV / Mã số).', 'error');
      return;
    }

    // Ensure Faculty dataset is loaded to resolve names if file only has MSSV
    if (typeof ensureFacultyDatasetLoaded === 'function') {
      await ensureFacultyDatasetLoaded().catch(() => []);
    }

    let addedCount = 0;
    const existingMssv = new Set(
      (state.roundModalEligibleStudents || []).map(s => String(s.studentId || s.mssv || '').trim().toUpperCase())
    );

    rawRows.forEach(row => {
      const rawMssv = String(row[mssvKey] || '').trim().toUpperCase();
      if (!rawMssv || rawMssv.length < 5 || existingMssv.has(rawMssv)) return;

      let fileFullName = '';
      if (fullNameKey && String(row[fullNameKey] || '').trim()) {
        fileFullName = String(row[fullNameKey]).trim();
      } else {
        const fam = familyKey ? String(row[familyKey] || '').trim() : '';
        const giv = givenKey ? String(row[givenKey] || '').trim() : '';
        fileFullName = [fam, giv].filter(Boolean).join(' ');
      }
      fileFullName = fileFullName.replace(/\s+/g, ' ');

      // Strictly prevent using MSSV as full name
      const validFileFullName = (fileFullName && fileFullName !== rawMssv) ? fileFullName : '';

      // Look up student from Faculty Master
      const master = window.getFacultyStudent ? window.getFacultyStudent(rawMssv) : null;
      const isFoundInMaster = master && !master.notFoundInMaster;

      const finalName = validFileFullName || (isFoundInMaster ? (master.fullName || master.name || '') : '');
      const finalGender = (genderKey && String(row[genderKey] || '').trim()) || (isFoundInMaster ? (master.gender || '') : '');
      const finalMajor = (majorKey && String(row[majorKey] || '').trim()) || (isFoundInMaster ? (master.major || '') : '');
      const rawClass = (classKey && String(row[classKey] || '').trim());
      const finalClass = rawClass || (isFoundInMaster ? (master.className || master.studentClass || '') : '');
      let rawEmail = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : '';
      if (!rawEmail || rawEmail.includes('undefined')) {
        rawEmail = (isFoundInMaster && master.email) ? master.email : `${rawMssv.toLowerCase()}@student.tdtu.edu.vn`;
      }
      const finalPhone = (phoneKey && String(row[phoneKey] || '').trim()) || (isFoundInMaster ? (master.phone || '') : '');

      state.roundModalEligibleStudents.push({
        studentId: rawMssv,
        mssv: rawMssv,
        name: finalName,
        fullName: finalName,
        gender: finalGender,
        major: finalMajor,
        className: finalClass,
        studentClass: finalClass,
        email: rawEmail,
        phone: finalPhone,
        eligible: true
      });

      existingMssv.add(rawMssv);
      addedCount++;
    });

    renderRoundModalEligibleTable();
    updateRoundModalBadges();
    showToast(`✓ Đã thêm ${addedCount} sinh viên đủ điều kiện vào đợt!`, 'success');
  } catch (err) {
    showToast('Lỗi đọc file: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
};


// --- ADMIN: ELIGIBLE STUDENTS (EXCEL PARSING & BATCH IMPORT) ---
window.loadAdminEligibleStudents = async function(roundId) {
  try {
    if (typeof loadFacultyDatasetFromIFAA === 'function' && !state.facultyStudentsLoaded) {
      loadFacultyDatasetFromIFAA().then(() => {
        if (state.eligibleStudentDetails?.roundId === roundId) renderAdminEligibleStudentsTable();
      }).catch(err => console.warn('[EligibleStudents] Faculty dataset load notice:', err));
    }
    const [eligibleSnap, registrationSnap, assignmentSnap, draftSnap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents')),
      getDocs(collection(db, 'graduationRounds', roundId, 'registrations')),
      getDocs(collection(db, 'graduationRounds', roundId, 'officialAssignments')),
      getDocs(collection(db, 'graduationRounds', roundId, 'assignmentDrafts'))
    ]);
    if (document.getElementById('admin-round-student-select')?.value !== roundId) return;
    state.eligibleStudents = eligibleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.eligibleStudentDetails = {
      roundId,
      registrations: new Map(registrationSnap.docs.map(d => [d.id.toUpperCase(), d.data()])),
      assignments: new Map(assignmentSnap.docs.map(d => [d.id.toUpperCase(), d.data()])),
      drafts: new Map(draftSnap.docs.map(d => [d.id.toUpperCase(), d.data()]))
    };
    renderAdminEligibleStudentsTable();
  } catch (e) {
    console.error('Error loading eligible students:', e);
  }
};

function renderAdminEligibleStudentsTable() {
  const tbody = document.getElementById('admin-eligible-students-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('search-eligible-input')?.value || '').toLowerCase().trim();
  const roundId = state.eligibleStudentDetails?.roundId;
  const round = (state.rounds || []).find(item => item.id === roundId);
  const directAssignment = isDirectSupervisorAssignment(round);
  const details = state.eligibleStudentDetails;

  // Merge each eligible record with Faculty Student Master
  const mergedList = (state.eligibleStudents || []).map(s => {
    const rawMssv = s.studentId || s.mssv || s.id || '';
    const mssv = String(rawMssv).trim().replace(/\s+/g, '').toUpperCase();
    const master = (typeof window.getFacultyStudentByMssv === 'function') ? window.getFacultyStudentByMssv(mssv) : null;
    const isFoundInMaster = Boolean(master && !master.notFoundInMaster && master.name);

    let displayName = '';
    let displayEmail = '';
    let displayClass = '';
    let displayMajor = '';
    let isMissingInfo = false;

    if (isFoundInMaster) {
      displayName = master.fullName || master.name;
      displayEmail = master.email || `${mssv.toLowerCase()}@student.tdtu.edu.vn`;
      displayClass = master.className || master.studentClass || 'Chưa có thông tin';
      displayMajor = master.major || 'Thiết kế Nội thất';
    } else {
      // Fallback to snapshot in eligible record
      const rawName = String(s.name || s.fullName || s.studentName || '').trim();
      if (rawName && rawName !== mssv && !rawName.startsWith('Sinh viên ' + mssv)) {
        displayName = rawName;
      } else {
        displayName = '<span class="text-slate-400 italic">Chưa có thông tin</span>';
        isMissingInfo = true;
      }
      displayEmail = s.email || (mssv ? `${mssv.toLowerCase()}@student.tdtu.edu.vn` : '<span class="text-slate-400 italic">Chưa có thông tin</span>');
      displayClass = s.className || s.studentClass || s.class || '<span class="text-slate-400 italic">Chưa có thông tin</span>';
      displayMajor = s.major || 'Thiết kế Nội thất';
    }

    return {
      ...s,
      mssv,
      studentId: mssv,
      resolvedName: displayName,
      resolvedEmail: displayEmail,
      resolvedClass: displayClass,
      resolvedMajor: displayMajor,
      isFoundInMaster,
      isMissingInfo
    };
  });

  const getStudentStatus = student => {
    const registration = details?.registrations.get(student.studentId) || null;
    const published = details?.assignments.get(student.studentId) || null;
    const draft = details?.drafts.get(student.studentId) || null;
    const effective = normalizeOfficialAssignment(
      published?.assignmentStatus === 'published' ? published : (draft || published), registration
    );
    const supervisors = getOfficialSupervisors(effective);
    const names = supervisors.map(item => item.supervisorName || item.name || '').filter(Boolean);
    if (!names.length) {
      const fallback = effective?.acceptedSupervisorName || effective?.assignedSupervisorName || effective?.supervisorName || registration?.acceptedSupervisorName;
      if (fallback) names.push(fallback);
    }
    const topic = String(registration?.topicTitle || registration?.topic || '').trim();
    const preferences = !directAssignment && !names.length && Array.isArray(registration?.preferences)
      ? registration.preferences.slice().sort((a, b) => Number(a.rank) - Number(b.rank))
        .map(pref => `NV${pref.rank}: ${pref.supervisorName || pref.name || ''}`).filter(item => !item.endsWith(': '))
      : [];
    return { topic, names, preferences };
  };

  const filtered = mergedList.filter(s => {
    if (!searchTerm) return true;
    const nameText = typeof s.resolvedName === 'string' ? s.resolvedName.replace(/<[^>]*>/g, '').toLowerCase() : '';
    const status = getStudentStatus(s);
    return (s.studentId || '').toLowerCase().includes(searchTerm) ||
      nameText.includes(searchTerm) ||
      status.topic.toLowerCase().includes(searchTerm) ||
      status.names.join(' ').toLowerCase().includes(searchTerm) ||
      status.preferences.join(' ').toLowerCase().includes(searchTerm) ||
      (s.resolvedClass || '').toLowerCase().includes(searchTerm);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400 font-medium">Chưa có dữ liệu sinh viên trong đợt này. Tải file Excel lên để nhập danh sách.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const status = getStudentStatus(s);
    const supervisorLine = status.names.length
      ? `<div class="mt-1 text-[11px] text-emerald-700"><b>GVHD:</b> ${escapeHtml(status.names.join(' · '))}</div>`
      : (status.preferences.length
        ? `<div class="mt-1 text-[11px] text-slate-600">${status.preferences.map(escapeHtml).join(' · ')}</div>`
        : (directAssignment ? '<div class="mt-1 text-[11px] text-slate-500">GVHD: Chưa phân công</div>' : ''));
    return `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-3 font-mono font-bold text-slate-900">${escapeHtml(s.studentId)}</td>
      <td class="p-3">
        <div class="font-bold text-slate-800">${s.isMissingInfo ? s.resolvedName : escapeHtml(s.resolvedName)}</div>
        ${!s.isFoundInMaster && !s.isMissingInfo ? '<span class="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-500">Từ file nhập</span>' : ''}
      </td>
      <td class="p-3 min-w-[260px]"><div class="font-bold ${status.topic ? 'text-blue-900' : 'text-slate-500 italic'}">${status.topic ? escapeHtml(status.topic) : 'Sinh viên chưa đăng ký đề tài'}</div>${supervisorLine}</td>
      <td class="p-3 font-mono text-slate-700">${String(s.resolvedClass).includes('<span') ? s.resolvedClass : escapeHtml(s.resolvedClass)}</td>
      <td class="p-3 text-slate-700">${escapeHtml(s.resolvedMajor)}</td>
      <td class="p-3"><span class="badge badge-open">Đủ ĐK</span></td>
      <td class="p-3 text-right">
        <button type="button" onclick="deleteEligibleStudent('${s.studentId}')" class="text-rose-600 hover:underline font-bold text-xs cursor-pointer">Xóa</button>
      </td>
    </tr>
  `;
  }).join('');
}

window.filterEligibleTable = function() {
  renderAdminEligibleStudentsTable();
};

window.deleteEligibleStudent = async function(studentId) {
  const roundId = document.getElementById('admin-round-student-select')?.value || state.selectedRoundId;
  if (!roundId) return;
  const normalizedId = String(studentId || '').trim().toUpperCase();
  if (!(await showConfirm('Xóa sinh viên', `Xóa sinh viên ${normalizedId} và toàn bộ thông tin đăng ký, đề tài, phân công khỏi đợt này?`, { confirmText: 'Xóa toàn bộ', danger: true }))) return;
  try {
    const deleteTasks = [
      deleteDoc(doc(db, 'graduationRounds', roundId, 'eligibleStudents', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'registrations', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'officialAssignments', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'assignmentDrafts', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'reviewDecisions', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'councilScores', normalizedId)),
      deleteDoc(doc(db, 'graduationStudentProfiles', normalizedId))
    ];

    try {
      const subSnap = await getDocs(query(collection(db, 'graduationRounds', roundId, 'submissions'), where('studentId', '==', normalizedId)));
      subSnap.forEach(d => {
        deleteTasks.push(deleteDoc(d.ref));
      });
    } catch (subErr) {}

    await Promise.allSettled(deleteTasks);

    showToast(`✓ Đã xóa sinh viên ${normalizedId} và toàn bộ dữ liệu đã nhập khỏi đợt.`, 'success');
    await loadAdminEligibleStudents(roundId);
    await refreshRoundCardMetrics(roundId);
    if (typeof loadSupervisorPortalData === 'function' && (state.selectedRoundId === roundId || state.activeRound?.id === roundId)) {
      loadSupervisorPortalData(roundId);
    }
  } catch (e) {
    showToast('Lỗi xóa: ' + e.message, 'error');
  }
};

// Add one supplementary student without requiring an Excel import.  The
// authoritative profile is always resolved from the Faculty Student Master,
// so a manually-added row has the same data shape as an imported student.
window.addEligibleStudentByMssv = async function() {
  const input = document.getElementById('quick-add-eligible-mssv');
  const rawMssv = String(input?.value || '').trim().replace(/\s+/g, '').toUpperCase();
  const roundId = document.getElementById('admin-round-student-select')?.value;

  if (!roundId) {
    showToast('Vui lòng chọn đợt tốt nghiệp trước khi thêm sinh viên.', 'warning');
    return;
  }
  if (!rawMssv) {
    showToast('Nhập MSSV sinh viên cần bổ sung.', 'warning');
    input?.focus();
    return;
  }
  if (!/^[A-Z0-9_-]+$/.test(rawMssv)) {
    showToast('MSSV chỉ gồm chữ cái, chữ số, dấu gạch nối hoặc gạch dưới.', 'warning');
    return;
  }

  try {
    if (typeof ensureFacultyDatasetLoaded === 'function') {
      await ensureFacultyDatasetLoaded();
    } else if (typeof loadFacultyDatasetFromIFAA === 'function' && !state.facultyStudentsLoaded) {
      await loadFacultyDatasetFromIFAA();
    }

    const master = typeof window.getFacultyStudentByMssv === 'function'
      ? window.getFacultyStudentByMssv(rawMssv)
      : (state.facultyStudents || []).find(s => String(s.mssv || s.studentId || '').trim().toUpperCase() === rawMssv);
    if (!master || master.notFoundInMaster || !(master.fullName || master.name)) {
      showToast(`Không tìm thấy MSSV ${rawMssv} trong dữ liệu sinh viên Khoa.`, 'error');
      return;
    }

    const studentRef = doc(db, 'graduationRounds', roundId, 'eligibleStudents', rawMssv);
    const existing = await getDoc(studentRef);
    if (existing.exists()) {
      showToast(`Sinh viên ${rawMssv} đã có trong đợt này.`, 'warning');
      return;
    }

    // A student removed from the round configuration may still have records
    // created before that removal.  Never silently reuse those records when
    // the student is added again: the operator explicitly chooses whether to
    // clear the old topic and supervisor assignment for this round.
    const [oldRegistration, oldOfficialAssignment, oldDraftAssignment] = await Promise.all([
      getDoc(doc(db, 'graduationRounds', roundId, 'registrations', rawMssv)),
      getDoc(doc(db, 'graduationRounds', roundId, 'officialAssignments', rawMssv)),
      getDoc(doc(db, 'graduationRounds', roundId, 'assignmentDrafts', rawMssv))
    ]);
    if (oldRegistration.exists() || oldOfficialAssignment.exists() || oldDraftAssignment.exists()) {
      const shouldReset = await showConfirm(
        'Dữ liệu cũ của sinh viên',
        `MSSV ${rawMssv} vẫn còn thông tin đăng ký hoặc phân công từ lần trước. Xóa dữ liệu cũ để thêm lại sinh viên với trạng thái mới?`,
        { confirmText: 'Xóa dữ liệu cũ & thêm lại', danger: true }
      );
      if (!shouldReset) return;
      const cleanupResults = await Promise.allSettled([
        deleteDoc(doc(db, 'graduationRounds', roundId, 'registrations', rawMssv)),
        deleteDoc(doc(db, 'graduationRounds', roundId, 'officialAssignments', rawMssv)),
        deleteDoc(doc(db, 'graduationRounds', roundId, 'assignmentDrafts', rawMssv)),
        deleteDoc(doc(db, 'graduationRounds', roundId, 'reviewDecisions', rawMssv))
      ]);
      if (cleanupResults.some(result => result.status === 'rejected')) {
        throw new Error('Không thể xóa đầy đủ dữ liệu cũ của sinh viên.');
      }
    }

    const fullName = master.fullName || master.name;
    const className = master.className || master.studentClass || '';
    await setDoc(studentRef, {
      studentId: rawMssv,
      mssv: rawMssv,
      name: fullName,
      fullName,
      email: master.email || `${rawMssv.toLowerCase()}@student.tdtu.edu.vn`,
      className,
      studentClass: className,
      major: master.major || 'Thiết kế Nội thất',
      eligible: true,
      source: 'manual_supplement',
      createdAt: serverTimestamp()
    });

    if (input) input.value = '';
    showToast(`Đã thêm ${fullName} (${rawMssv}) vào đợt.`, 'success');
    await loadAdminEligibleStudents(roundId);
    await refreshRoundCardMetrics(roundId);
  } catch (e) {
    console.error('Quick add eligible student failed:', e);
    showToast('Không thể thêm sinh viên: ' + e.message, 'error');
  }
};

window.handleExcelFileUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('excel-filename').textContent = file.name;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      parseAndValidateExcel(rawRows);
    } catch (err) {
      showToast('Không đọc được file Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
};

function parseAndValidateExcel(rows) {
  if (!rows || rows.length < 2) {
    showToast('File Excel rỗng hoặc thiếu tiêu đề cột.', 'warning');
    return;
  }

  // Find header indices
  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  let mssvIdx = header.findIndex(h => h.includes('mssv') || h.includes('mã số') || h.includes('student'));
  let nameIdx = header.findIndex(h => h.includes('họ') || h.includes('tên') || h.includes('name'));
  let emailIdx = header.findIndex(h => h.includes('email') || h.includes('thư điện tử'));
  let classIdx = header.findIndex(h => h.includes('lớp') || h.includes('class'));
  let majorIdx = header.findIndex(h => h.includes('ngành') || h.includes('major'));

  if (mssvIdx === -1) mssvIdx = 0;
  if (nameIdx === -1) nameIdx = 1;

  const existingMssvSet = new Set(state.eligibleStudents.map(s => s.studentId));
  const seenInFile = new Set();
  const staging = [];

  let validCount = 0;
  let invalidCount = 0;
  let dupCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const rawMssv = String(r[mssvIdx] || '').trim().toUpperCase();
    const rawName = String(r[nameIdx] || '').trim();
    let rawEmail = emailIdx !== -1 ? String(r[emailIdx] || '').trim().toLowerCase() : '';
    const rawClass = classIdx !== -1 ? String(r[classIdx] || '').trim() : '';
    const rawMajor = majorIdx !== -1 ? String(r[majorIdx] || '').trim() : 'Thiết kế Nội thất';

    if (!rawMssv) {
      invalidCount++;
      continue;
    }

    if (!rawEmail) {
      rawEmail = `${rawMssv.toLowerCase()}@student.tdtu.edu.vn`;
    }

    const isDupInFile = seenInFile.has(rawMssv);
    const isDupInDb = existingMssvSet.has(rawMssv);

    if (isDupInFile || isDupInDb) {
      dupCount++;
    } else {
      validCount++;
    }
    seenInFile.add(rawMssv);

    staging.push({
      studentId: rawMssv,
      name: rawName,
      email: rawEmail,
      className: rawClass,
      major: rawMajor,
      isDup: isDupInFile || isDupInDb,
      isValid: Boolean(rawMssv)
    });
  }

  state.excelStaging = staging;

  document.getElementById('excel-stat-valid').textContent = validCount;
  document.getElementById('excel-stat-invalid').textContent = invalidCount;
  document.getElementById('excel-stat-duplicate').textContent = dupCount;

  // Render preview snippet
  const tbody = document.getElementById('excel-preview-tbody');
  tbody.innerHTML = staging.slice(0, 15).map(s => `
    <tr class="hover:bg-slate-50">
      <td class="p-2 font-mono font-bold text-slate-800">${s.studentId}</td>
      <td class="p-2 font-medium">${s.name}</td>
      <td class="p-2 text-slate-500 text-[11px]">${s.email}</td>
      <td class="p-2">${s.className}</td>
      <td class="p-2">${s.major}</td>
      <td class="p-2">
        ${s.isDup ? '<span class="text-amber-600 font-bold">Trùng</span>' : '<span class="text-emerald-600 font-bold">Hợp lệ</span>'}
      </td>
    </tr>
  `).join('');

  document.getElementById('excel-preview-card').classList.remove('hidden');
}

window.cancelExcelImport = function() {
  state.excelStaging = [];
  document.getElementById('excel-preview-card').classList.add('hidden');
  document.getElementById('excel-file-input').value = '';
};

window.confirmExcelImport = async function() {
  const roundId = document.getElementById('admin-round-student-select').value;
  if (!roundId || state.excelStaging.length === 0) return;

  const mode = document.querySelector('input[name="excel-import-mode"]:checked')?.value || 'append';
  const existingSet = new Set(state.eligibleStudents.map(s => s.studentId));

  const itemsToImport = state.excelStaging.filter(s => {
    if (!s.isValid) return false;
    if (mode === 'skip' && existingSet.has(s.studentId)) return false;
    return true;
  });

  if (itemsToImport.length === 0) {
    showToast('Không có sinh viên nào cần import theo tùy chọn đã chọn.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-confirm-excel-import');
  btn.disabled = true;
  btn.textContent = '⏳ Đang lưu vào Firestore...';

  try {
    // Process in batches of 400
    const chunkSize = 400;
    for (let i = 0; i < itemsToImport.length; i += chunkSize) {
      const chunk = itemsToImport.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach(s => {
        const ref = doc(db, 'graduationRounds', roundId, 'eligibleStudents', s.studentId);
        batch.set(ref, {
          studentId: s.studentId,
          name: s.name,
          email: s.email,
          className: s.className || '',
          major: s.major || 'Thiết kế Nội thất',
          eligible: true,
          createdAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
    }

    showToast(`Đã import thành công ${itemsToImport.length} sinh viên đủ điều kiện!`, 'info');
    cancelExcelImport();
    await loadAdminEligibleStudents(roundId);
    await refreshRoundCardMetrics(roundId);
  } catch (err) {
    showToast('Lỗi import Firestore: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Xác nhận Nhập vào Firestore';
  }
};


// --- ADMIN: REGISTRATIONS LIST & CSV EXPORT ---
window.loadAdminRegistrations = async function(roundId) {
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.currentAdminRegistrations = list;
    filterAdminRegistrationsTable();
  } catch (e) {
    console.error('Error loading registrations:', e);
  }
};

window.filterAdminRegistrationsTable = function() {
  const filter = document.getElementById('admin-reg-filter-status')?.value || 'all';
  const list = state.currentAdminRegistrations || [];
  let filtered = list;
  if (filter === 'eligible') {
    filtered = list.filter(r => r.eligibilityStatus === 'eligible' || (!r.eligibilityStatus && r.status === 'submitted'));
  } else if (filter === 'pending') {
    filtered = list.filter(r => r.eligibilityStatus === 'pending');
  } else if (filter === 'not_eligible') {
    filtered = list.filter(r => r.eligibilityStatus === 'not_eligible');
  }
  renderAdminRegistrationsTable(filtered);
};

function renderAdminRegistrationsTable(list) {
  const tbody = document.getElementById('admin-registrations-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="p-6 text-center text-slate-400">Không có nguyện vọng đăng ký nào phù hợp bộ lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const getSupName = rank => (r.preferences || []).find(p => p.rank === rank)?.supervisorName || '--';
    const subDate = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)) : null;

    let elBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Đủ ĐK</span>';
    if (r.eligibilityStatus === 'pending') {
      elBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Chờ nạp danh sách đủ điều kiện chính thức">Chờ xét</span>';
    } else if (r.eligibilityStatus === 'not_eligible') {
      elBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300" title="Không có trong danh sách đủ điều kiện">Không đủ ĐK</span>';
    }

    let reviewBadge = '<span class="text-slate-500 font-semibold text-xs">Chờ duyệt</span>';
    if (r.reviewStatus === 'accepted') {
      reviewBadge = '<span class="text-emerald-700 font-bold text-xs">✓ Đã tiếp nhận</span>';
    } else if (r.reviewStatus === 'rejected') {
      reviewBadge = '<span class="text-rose-600 font-bold text-xs">Chuyển NV sau</span>';
    }

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-mono font-bold text-slate-900">${r.studentId}</td>
        <td class="p-3.5 font-semibold text-slate-800">${r.studentName || '--'}</td>
        <td class="p-3.5 max-w-[200px] truncate font-bold text-blue-900" title="${r.topicTitle}">${r.topicTitle || '--'}</td>
        <td class="p-3.5 text-slate-600">${r.projectType || '--'}</td>
        <td class="p-3.5 font-bold text-slate-700">${getSupName(1)}</td>
        <td class="p-3.5 text-slate-600">${getSupName(2)}</td>
        <td class="p-3.5 text-slate-600">${getSupName(3)}</td>
        <td class="p-3.5 text-center">${elBadge}</td>
        <td class="p-3.5">${reviewBadge}</td>
        <td class="p-3.5 text-[11px] text-slate-400">${subDate ? subDate.toLocaleString('vi-VN') : '--'}</td>
      </tr>
    `;
  }).join('');
}

window.exportRegistrationsCSV = function() {
  const roundId = document.getElementById('admin-round-reg-select')?.value;
  if (!roundId) return;

  getDocs(collection(db, 'graduationRounds', roundId, 'registrations')).then(snap => {
    const list = snap.docs.map(d => d.data());
    if (list.length === 0) {
      showToast('Không có dữ liệu đăng ký để xuất.', 'warning');
      return;
    }

    const headers = ['MSSV', 'Họ và tên', 'Email', 'Tên đề tài', 'Loại hình đồ án', 'Nguyện vọng 1', 'Nguyện vọng 2', 'Nguyện vọng 3', 'Điều kiện', 'Trạng thái xét', 'Thời gian nộp'];
    const rows = list.map(r => {
      const getSup = rank => (r.preferences || []).find(p => p.rank === rank)?.supervisorName || '';
      const dt = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)).toLocaleString('vi-VN') : '';
      let elText = 'Đủ điều kiện';
      if (r.eligibilityStatus === 'pending') elText = 'Chờ xét';
      else if (r.eligibilityStatus === 'not_eligible') elText = 'Không đủ điều kiện';

      return [
        r.studentId || '',
        r.studentName || '',
        r.email || '',
        `"${(r.topicTitle || '').replace(/"/g, '""')}"`,
        `"${(r.projectType || '').replace(/"/g, '""')}"`,
        `"${getSup(1)}"`,
        `"${getSup(2)}"`,
        `"${getSup(3)}"`,
        `"${elText}"`,
        `"${r.reviewStatus || 'Chờ duyệt'}"`,
        dt
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DS_DangKy_DATN_${roundId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
};

window.applyOfficialEligibilityToRegistrations = async function() {
  const roundId = document.getElementById('admin-round-reg-select')?.value;
  if (!roundId) {
    showToast('Vui lòng chọn đợt tốt nghiệp cần áp dụng.', 'warning');
    return;
  }
  const round = state.rounds?.find(r => r.id === roundId) || state.activeRound;

  const btn = document.getElementById('btn-apply-official-eligibility');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Đang đối soát...</span>';
  }

  try {
    // 1. Fetch official eligible students subcollection
    const elSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
    if (elSnap.empty) {
      showToast('⚠️ Đợt này chưa có danh sách sinh viên đủ điều kiện chính thức. Vui lòng nạp danh sách SV tại Cấu hình Đợt trước.', 'warning', 6000);
      return;
    }
    const eligibleMap = new Set(elSnap.docs.filter(d => d.data().eligible !== false).map(d => d.id));

    // 2. Fetch all registrations of the round
    const regSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    if (regSnap.empty) {
      showToast('Đợt này chưa có sinh viên nào nộp đăng ký.', 'info');
      return;
    }

    let eligibleCount = 0;
    let notEligibleCount = 0;
    let unchangedCount = 0;

    // Process in batches of 450
    const docs = regSnap.docs;
    for (let offset = 0; offset < docs.length; offset += 450) {
      const batch = writeBatch(db);
      const chunk = docs.slice(offset, offset + 450);
      let batchOps = 0;

      chunk.forEach(docSnap => {
        const reg = docSnap.data();
        const studentId = docSnap.id;
        const isEligible = eligibleMap.has(studentId);
        const newStatus = isEligible ? 'eligible' : 'not_eligible';

        if (reg.eligibilityStatus !== newStatus) {
          batch.update(docSnap.ref, {
            eligibilityStatus: newStatus,
            eligibilityVerifiedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          batchOps++;
          if (isEligible) eligibleCount++;
          else notEligibleCount++;
        } else {
          unchangedCount++;
        }
      });

      if (batchOps > 0) {
        await batch.commit();
      }
    }

    // 3. Mark round as eligibilityFinalized: true
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      eligibilityFinalized: true,
      updatedAt: serverTimestamp()
    }).catch(console.warn);

    if (round) {
      round.eligibilityFinalized = true;
    }

    showToast(`✓ Đã áp dụng DS đủ điều kiện thành công: ${eligibleCount} Đủ ĐK, ${notEligibleCount} Không đủ ĐK (Không xóa bất kỳ nguyện vọng nào)!`, 'success', 6000);
    await loadAdminRegistrations(roundId);
  } catch (err) {
    console.error('Lỗi khi áp dụng danh sách đủ điều kiện:', err);
    showToast('Lỗi khi áp dụng danh sách đủ điều kiện: ' + err.message, 'error', 5000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>⚖️ Áp dụng DS đủ điều kiện</span>';
    }
  }
};



// =========================================================================
// --- CENTRAL STUDENT RESOLVER FOR REGISTRATIONS & REVIEWS ---
// =========================================================================
window.resolveStudentName = function(sid, fallbackName = '') {
  if (!sid) return fallbackName || '--';
  const cleanId = String(sid).trim().toUpperCase();
  const raw = String(fallbackName || '').trim();
  if (raw && raw.toUpperCase() !== cleanId && !raw.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
    return raw;
  }

  // 1. Check eligibleStudents in review data or state
  const eligibleList = state.adminReviewData?.eligible || state.eligibleStudents || [];
  const el = eligibleList.find(e => {
    const eid = String(e.studentId || e.mssv || e.id || '').trim().toUpperCase();
    return eid === cleanId;
  });
  if (el) {
    const elName = String(el.fullName || el.name || el.studentName || '').trim();
    if (elName && elName.toUpperCase() !== cleanId && !elName.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
      return elName;
    }
  }

  // 2. Check IFAA central master lookup
  if (typeof window.getFacultyStudentByMssv === 'function') {
    const fac = window.getFacultyStudentByMssv(cleanId);
    if (fac) {
      const facName = String(fac.fullName || fac.name || '').trim();
      if (facName && facName.toUpperCase() !== cleanId && !facName.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
        return facName;
      }
    }
  }

  // 3. Check in-memory facultyStudents array
  if (Array.isArray(state.facultyStudents) && state.facultyStudents.length > 0) {
    const inFac = state.facultyStudents.find(s => {
      const sId = String(s.mssv || s.studentId || s.studentCode || '').trim().toUpperCase();
      return sId === cleanId;
    });
    if (inFac) {
      const fn = String(inFac.fullName || inFac.name || inFac.hoTen || '').trim();
      if (fn && fn.toUpperCase() !== cleanId && !fn.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
        return fn;
      }
    }
  }

  return raw || cleanId;
};


// ============================================================================
// ADMIN: DANH SÁCH SINH VIÊN KHOA (MASTER DATASET - IFAA MECHANISM)
// ============================================================================

// Standard Majors
const FACULTY_MAJORS = [
  'Thiết kế nội thất',
  'Thiết kế đồ họa',
  'Thiết kế thời trang',
  'Thiết kế công nghiệp',
  'Nghệ thuật số'
];

// ============================================================================
// IFAA FACULTY STUDENT MASTER — READ-ONLY INTEGRATION (v2.3.4)
// Single Source of Truth: ifa-activities (IFAA)
// Graduation is STRICT CONSUMER ONLY. 0 Writes to IFAA.
// ============================================================================

export const IFAA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDoz3iLOjU1JpHkgTDQHPyh29vUYOCcJhU",
  authDomain: "ifa-activities.firebaseapp.com",
  projectId: "ifa-activities",
  storageBucket: "ifa-activities.firebasestorage.app",
  messagingSenderId: "633545868576",
  appId: "1:633545868576:web:c1509233a2b5046b320345"
};

export const DEFAULT_IFAA_DATASET_URL = "https://firebasestorage.googleapis.com/v0/b/ifa-activities.firebasestorage.app/o/datasets%2Ffaculty-students.json.gz?alt=media&token=f66324b5-2ec1-45ad-a580-5f4d4041e431";
export const BACKUP_IFAA_DATASET_URL = "https://firebasestorage.googleapis.com/v0/b/ifa-activities.firebasestorage.app/o/datasets%2Ffaculty-students.json.gz?alt=media&token=9a1e615e-3d20-48e7-8c9e-967e21140a21";

let ifaaAppInstance = null;
let ifaaFirestoreInstance = null;
let ifaaStorageInstance = null;

export function getIFAAFirebase() {
  try {
    if (!ifaaAppInstance) {
      const existing = getApps().find(a => a.name === 'ifaa-readonly');
      ifaaAppInstance = existing || initializeApp(IFAA_FIREBASE_CONFIG, 'ifaa-readonly');
    }
    if (!ifaaFirestoreInstance && ifaaAppInstance) {
      ifaaFirestoreInstance = getFirestore(ifaaAppInstance);
    }
    if (!ifaaStorageInstance && ifaaAppInstance) {
      ifaaStorageInstance = getStorage(ifaaAppInstance);
    }
    return { app: ifaaAppInstance, db: ifaaFirestoreInstance, storage: ifaaStorageInstance };
  } catch (err) {
    console.warn('[IFAA ReadOnly] Không thể khởi tạo secondary app:', err);
    return { app: null, db: null, storage: null };
  }
}

// IndexedDB Cache for Faculty Dataset
const FACULTY_CACHE_DB = 'graduation-faculty-dataset';
const FACULTY_CACHE_STORE = 'datasets';
const FACULTY_CACHE_KEY = 'faculty-students';

function openFacultyCache() {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null);
    try {
      const req = indexedDB.open(FACULTY_CACHE_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(FACULTY_CACHE_STORE)) {
          req.result.createObjectStore(FACULTY_CACHE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getFacultyCache() {
  try {
    const database = await openFacultyCache();
    if (!database) return null;
    return await new Promise((resolve) => {
      const tx = database.transaction(FACULTY_CACHE_STORE, 'readonly');
      const req = tx.objectStore(FACULTY_CACHE_STORE).get(FACULTY_CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => database.close();
    });
  } catch {
    return null;
  }
}

async function setFacultyCache(data) {
  try {
    const database = await openFacultyCache();
    if (!database) return;
    await new Promise((resolve) => {
      const tx = database.transaction(FACULTY_CACHE_STORE, 'readwrite');
      tx.objectStore(FACULTY_CACHE_STORE).put(data, FACULTY_CACHE_KEY);
      tx.oncomplete = () => {
        database.close();
        resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function gunzipData(bytes) {
  if (!('DecompressionStream' in window)) {
    throw new Error('Trình duyệt chưa hỗ trợ DecompressionStream(gzip).');
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  } catch (err) {
    console.error('Lỗi giải nén gzip:', err);
    throw err;
  }
}

// Module State
state.facultyDatasetMeta = null;
state.facultyStudentsLoaded = false;
state.facultyFilteredStudents = [];
state.facultyCurrentPage = 1;
state.facultyPageSize = 15;
if (!state.facultyStudentsMap) {
  state.facultyStudentsMap = new Map();
}

function updateFacultyStatusUI(text, stateType = 'info') {
  const textEl = document.getElementById('faculty-dataset-status-text');
  const dotEl = document.getElementById('faculty-dataset-status-dot');
  if (textEl) textEl.textContent = text;
  if (dotEl) {
    dotEl.className = 'w-2 h-2 rounded-full ' + (
      stateType === 'success' ? 'bg-emerald-500' :
      stateType === 'warning' ? 'bg-amber-500' :
      stateType === 'error' ? 'bg-rose-500' :
      'bg-slate-400'
    );
  }
}

export function normalizeFacultyStudent(item) {
  if (!item) return null;
  const rawId = item.mssv || item.studentId || item.studentCode || item.student_id || item.code || item.id;
  if (!rawId) return null;
  const mssv = String(rawId).trim().replace(/\s+/g, '').toUpperCase();
  if (!mssv) return null;

  const rawName = item.fullName || item.name || item.hoTen || item.studentName || item.student_name || item.hoten || '';
  const fullName = String(rawName).trim().replace(/\s+/g, ' ');
  const rawClass = item.className || item.class || item.studentClass || item.lop || item.student_class || '';
  const studentClass = String(rawClass).trim();
  const rawMajor = item.major || item.majorName || item.nganh || item.major_name || item.chuyenNganh || '';
  const major = String(rawMajor).trim();
  const rawEmail = item.email || (mssv ? `${mssv.toLowerCase()}@student.tdtu.edu.vn` : '');
  const email = String(rawEmail).trim().toLowerCase();

  return {
    mssv,
    studentId: mssv,
    name: fullName,
    fullName,
    email,
    gender: String(item.gender || item.gioiTinh || '').trim(),
    major: major || 'Thiết kế Nội thất',
    majorName: major || 'Thiết kế Nội thất',
    className: studentClass,
    class: studentClass,
    studentClass,
    admissionYear: item.admissionYear || item.khoa || '',
    course: item.course || '',
    phone: item.phone || item.soDienThoai || ''
  };
}
window.normalizeFacultyStudent = normalizeFacultyStudent;

function normalizeFacultyRows(value) {
  const rows = Array.isArray(value) ? value : (value?.students || value?.data || []);
  if (!Array.isArray(rows)) return [];
  const results = [];
  for (const item of rows) {
    const norm = normalizeFacultyStudent(item);
    if (norm) results.push(norm);
  }
  return results;
}

// ============================================================================
// CENTRAL STUDENT RESOLVER API (READ-ONLY)
// ============================================================================

window.getFacultyStudentByMssv = function(mssv) {
  if (!mssv) return null;
  const cleanId = String(mssv).trim().replace(/\s+/g, '').toUpperCase();
  if (!cleanId) return null;

  // 1. In-memory Map lookup (O(1))
  if (state.facultyStudentsMap && state.facultyStudentsMap.has(cleanId)) {
    return state.facultyStudentsMap.get(cleanId);
  }

  // 2. In-memory array fallback
  if (Array.isArray(state.facultyStudents) && state.facultyStudents.length > 0) {
    const inList = state.facultyStudents.find(s => {
      const sId = String(s.mssv || s.studentId || s.studentCode || '').trim().replace(/\s+/g, '').toUpperCase();
      return sId === cleanId;
    });
    if (inList) {
      const norm = normalizeFacultyStudent(inList);
      if (state.facultyStudentsMap) state.facultyStudentsMap.set(cleanId, norm);
      return norm;
    }
  }

  return null;
};

window.getFacultyStudent = function(studentId) {
  if (!studentId) return null;
  const cleanId = String(studentId).trim().replace(/\s+/g, '').toUpperCase();

  const found = window.getFacultyStudentByMssv(cleanId);
  if (found) return found;

  // Graceful fallback for missing student in master (never crash)
  return {
    mssv: cleanId,
    studentId: cleanId,
    name: `Sinh viên ${cleanId}`,
    fullName: `Sinh viên ${cleanId}`,
    gender: '',
    major: '',
    className: '',
    studentClass: '',
    email: `${cleanId.toLowerCase()}@student.tdtu.edu.vn`,
    phone: '',
    isMissing: true,
    notFoundInMaster: true
  };
};

window.getFacultyStudents = function(filterFn) {
  const list = state.facultyStudents || [];
  return typeof filterFn === 'function' ? list.filter(filterFn) : list;
};

window.searchFacultyStudents = async function(query, options = {}) {
  await ensureFacultyDatasetLoaded();
  const q = String(query || '').trim().toLowerCase();
  let results = state.facultyStudents || [];

  if (q) {
    results = results.filter(s =>
      (s.mssv && s.mssv.toLowerCase().includes(q)) ||
      (s.fullName && s.fullName.toLowerCase().includes(q)) ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.className && s.className.toLowerCase().includes(q)) ||
      (s.studentClass && s.studentClass.toLowerCase().includes(q))
    );
  }

  if (options.major) {
    results = results.filter(s => (s.major || '').toLowerCase() === String(options.major).toLowerCase());
  }

  if (options.className || options.studentClass) {
    const cls = options.className || options.studentClass;
    results = results.filter(s => (s.className || s.studentClass || '') === cls);
  }

  if (options.gender) {
    results = results.filter(s => (s.gender || '').toLowerCase() === String(options.gender).toLowerCase());
  }

  return results;
};

// Main Loader: Fetches from IFAA Secondary App / Storage + IndexedDB Cache
export async function loadFacultyDatasetFromIFAA({ force = false } = {}) {
  // 1. In-memory cached
  if (!force && state.facultyStudentsLoaded && state.facultyStudents && state.facultyStudents.length > 0) {
    return state.facultyStudents;
  }

  // 2. Local IndexedDB Cache
  const cached = await getFacultyCache();

  // 3. Read metadata: Try primary tknt-tdtu first, then secondary ifaaDb
  let meta = null;
  try {
    const primarySnap = await getDoc(doc(db, 'facultyStudentMeta', 'current')).catch(() => null);
    if (primarySnap && primarySnap.exists()) {
      meta = primarySnap.data();
      state.facultyDatasetMeta = meta;
    }
  } catch (err) {
    // ignore
  }

  if (!meta) {
    try {
      const { db: ifaaDb } = getIFAAFirebase();
      if (ifaaDb) {
        const metaSnap = await getDoc(doc(ifaaDb, 'facultyStudentMeta', 'current')).catch(() => null);
        if (metaSnap && metaSnap.exists()) {
          meta = metaSnap.data();
          state.facultyDatasetMeta = meta;
        }
      }
    } catch (err) {
      console.warn('[IFAA ReadOnly] Không thể đọc facultyStudentMeta từ IFAA:', err.message);
    }
  }

  const currentVersion = Number(meta?.datasetVersion || meta?.version || 0);

  // 4. Cache validation check: if cached version matches metadata version, use cache
  if (!force && cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
    if (!currentVersion || Number(cached.version) === currentVersion) {
      state.facultyStudents = cached.rows;
      state.facultyStudentsMap = new Map(cached.rows.map(s => [s.mssv, s]));
      state.facultyStudentsLoaded = true;
      populateFacultyClassFilter(cached.rows);
      updateFacultyStatusUI(`Dữ liệu IFAA: ${cached.rows.length.toLocaleString('vi-VN')} SV (từ Cache)`, 'success');
      return cached.rows;
    }
  }

  // 5. Download Gzipped JSON from IFAA Storage / URL
  updateFacultyStatusUI('Đang tải dữ liệu từ IFA+ Activities...', 'info');
  let bytes = null;

  // Compile candidate URLs: meta.datasetUrl first, then default and backup tokenized Storage URLs
  const candidateUrls = [];
  if (meta?.datasetUrl && typeof meta.datasetUrl === 'string') {
    candidateUrls.push(meta.datasetUrl);
  }
  if (DEFAULT_IFAA_DATASET_URL && !candidateUrls.includes(DEFAULT_IFAA_DATASET_URL)) {
    candidateUrls.push(DEFAULT_IFAA_DATASET_URL);
  }
  if (typeof BACKUP_IFAA_DATASET_URL !== 'undefined' && BACKUP_IFAA_DATASET_URL && !candidateUrls.includes(BACKUP_IFAA_DATASET_URL)) {
    candidateUrls.push(BACKUP_IFAA_DATASET_URL);
  }

  for (const rawUrl of candidateUrls) {
    if (bytes) break;
    try {
      let fetchUrl = rawUrl;
      if (force) {
        const sep = fetchUrl.includes('?') ? '&' : '?';
        fetchUrl = `${fetchUrl}${sep}v=${Date.now()}`;
      }
      const res = await fetch(fetchUrl, { cache: 'no-store' });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        if (buffer && buffer.byteLength > 0) {
          bytes = new Uint8Array(buffer);
          break;
        }
      }
    } catch (e) {
      console.warn('[IFAA ReadOnly] Lỗi tải từ URL:', rawUrl, e.message);
    }
  }

  // Method B: Download via Firebase Storage SDK (read-only fallback)
  if (!bytes) {
    try {
      const { storage: ifaaStorage } = getIFAAFirebase();
      if (ifaaStorage) {
        const path = meta?.datasetPath || 'datasets/faculty-students.json.gz';
        bytes = await storageGetBytes(storageRef(ifaaStorage, path), 15 * 1024 * 1024);
      }
    } catch (e) {
      console.warn('[IFAA ReadOnly] Lỗi tải từ Storage getBytes:', e.message);
    }
  }

  // 6. Decompress & Parse
  if (bytes && bytes.length > 0) {
    try {
      const text = await gunzipData(bytes);
      const parsed = JSON.parse(text);
      const rows = normalizeFacultyRows(parsed);
      rows.sort((a, b) => String(a.mssv).localeCompare(String(b.mssv)));

      if (rows.length > 0) {
        state.lastFacultyLoadWasFallback = false;
        state.facultyStudents = rows;
        state.facultyStudentsMap = new Map(rows.map(s => [s.mssv, s]));
        state.facultyStudentsLoaded = true;

        // Save to IndexedDB with metadata
        const metaPayload = {
          version: currentVersion || Date.now(),
          rows: rows,
          cachedAt: Date.now(),
          count: rows.length,
          sourceUpdatedAt: meta?.datasetUpdatedAt || meta?.updatedAt || new Date().toISOString(),
          generation: String(meta?.datasetVersion || currentVersion || Date.now()),
          isLive: true
        };
        await setFacultyCache(metaPayload);
        state.studentDatasetMeta = metaPayload;

        // Sync metadata to tknt-tdtu if admin
        if (state.realIsAdmin && db) {
          setDoc(doc(db, 'facultyStudentMeta', 'current'), {
            count: rows.length,
            datasetVersion: currentVersion || Date.now(),
            datasetPath: 'datasets/faculty-students.json.gz',
            datasetUrl: candidateUrls[0] || DEFAULT_IFAA_DATASET_URL,
            datasetEncoding: 'gzip',
            datasetBytes: bytes.byteLength,
            datasetUpdatedAt: meta?.datasetUpdatedAt || serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        }

        populateFacultyClassFilter(rows);
        updateFacultyStatusUI(`Dữ liệu IFAA: ${rows.length.toLocaleString('vi-VN')} SV (Đã làm mới)`, 'success');
        const metaInfoEl = document.getElementById('faculty-dataset-meta-info');
        if (metaInfoEl) {
          metaInfoEl.textContent = `· Nguồn: IFAA · ${rows.length.toLocaleString('vi-VN')} SV · Đồng bộ mới nhất`;
        }
        return rows;
      }
    } catch (err) {
      console.error('[IFAA ReadOnly] Lỗi giải nén / phân tích dữ liệu IFAA:', err);
    }
  }

  // 7. Fallback to cached rows if available
  if (cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
    state.lastFacultyLoadWasFallback = true;
    state.facultyStudents = cached.rows;
    state.facultyStudentsMap = new Map(cached.rows.map(s => [s.mssv, s]));
    state.facultyStudentsLoaded = true;
    state.studentDatasetMeta = cached;
    populateFacultyClassFilter(cached.rows);
    updateFacultyStatusUI(`Dữ liệu IFAA: ${cached.rows.length.toLocaleString('vi-VN')} SV (Bản lưu offline)`, 'warning');
    if (force) {
      showToast(`⚠️ Không thể tải dữ liệu mới từ IFAA. Đang dùng bản lưu gần nhất: ${cached.rows.length.toLocaleString('vi-VN')} sinh viên.`, 'warning', 6000);
    }
    return cached.rows;
  }

  // 8. Error handling when both live download and cache failed
  state.lastFacultyLoadWasFallback = false;
  state.facultyStudents = [];
  state.facultyStudentsMap = new Map();
  state.facultyStudentsLoaded = true;
  updateFacultyStatusUI('Chưa thể kết nối nguồn dữ liệu IFAA', 'warning');
  if (force) {
    throw new Error('Không thể tải dữ liệu sinh viên từ IFAA. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.');
  }
  return [];
}

window.ensureFacultyDatasetLoaded = async function(force = false) {
  return await loadFacultyDatasetFromIFAA({ force });
};

window.syncFacultyDatasetFromIFAA = async function() {
  showToast('🔄 Đang làm mới danh mục sinh viên từ IFA+ Activities...', 'info');
  updateFacultyStatusUI('Đang làm mới từ IFAA...', 'info');
  try {
    state.lastFacultyLoadWasFallback = false;
    const rows = await loadFacultyDatasetFromIFAA({ force: true });
    if (!rows || rows.length === 0) {
      showToast('⚠️ Không tìm thấy sinh viên nào từ IFAA.', 'warning');
      updateFacultyStatusUI('Dữ liệu IFAA trống', 'warning');
      return;
    }
    applyFacultyFiltersAndRender(1);
    const totalCountEl = document.getElementById('faculty-students-total-count');
    if (totalCountEl) totalCountEl.textContent = rows.length.toLocaleString('vi-VN');

    if (!state.lastFacultyLoadWasFallback) {
      showToast(`✓ Đã tải ${rows.length.toLocaleString('vi-VN')} sinh viên mới nhất từ IFAA.`, 'success', 5000);
    }
  } catch (err) {
    showToast('Lỗi đồng bộ dữ liệu: ' + err.message, 'error', 5000);
  }
};

window.openFacultyStudentsTab = async function() {
  const totalCountEl = document.getElementById('faculty-students-total-count');
  const filteredCountEl = document.getElementById('faculty-students-filtered-count');
  const metaInfoEl = document.getElementById('faculty-dataset-meta-info');

  if (state.facultyStudentsLoaded && state.facultyStudents && state.facultyStudents.length > 0) {
    if (totalCountEl) totalCountEl.textContent = state.facultyStudents.length.toLocaleString('vi-VN');
    updateFacultyStatusUI(`Dữ liệu IFAA: ${state.facultyStudents.length} SV (sẵn sàng)`, 'success');
    return;
  }

  updateFacultyStatusUI('Đang kiểm tra dữ liệu từ IFA+ Activities...', 'info');

  try {
    const rows = await ensureFacultyDatasetLoaded(false);
    if (rows && rows.length > 0) {
      if (totalCountEl) totalCountEl.textContent = rows.length.toLocaleString('vi-VN');
      if (filteredCountEl) filteredCountEl.textContent = '0';
      if (metaInfoEl) {
        metaInfoEl.textContent = `· Nguồn: IFAA · ${rows.length} SV`;
      }
      applyFacultyFiltersAndRender(1);
    } else {
      if (totalCountEl) totalCountEl.textContent = '0';
      updateFacultyStatusUI('Chưa có dữ liệu sinh viên từ IFAA', 'warning');
    }
  } catch (err) {
    console.error('Lỗi nạp danh sách SV khoa:', err);
    updateFacultyStatusUI('Lỗi tải dữ liệu: ' + err.message, 'error');
  }
};

function populateFacultyClassFilter(rows) {
  const classSelect = document.getElementById('faculty-class-filter');
  if (!classSelect || !Array.isArray(rows)) return;
  const curVal = classSelect.value;
  const classes = [...new Set(rows.map(s => s.className || s.studentClass).filter(Boolean))].sort();
  classSelect.innerHTML = '<option value="">-- Tất cả lớp --</option>' +
    classes.map(c => `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`).join('');
}

window.loadAndRenderFacultyStudents = async function() {
  const tbody = document.getElementById('faculty-students-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500">⏳ Đang tải danh sách sinh viên từ IFAA...</td></tr>';
  }

  try {
    await ensureFacultyDatasetLoaded();
    applyFacultyFiltersAndRender(1);
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-rose-500">Lỗi: ${err.message}</td></tr>`;
    }
  }
};

function applyFacultyFiltersAndRender(targetPage = 1) {
  const search = (document.getElementById('faculty-search-input')?.value || '').trim().toLowerCase();
  const genderFilter = document.getElementById('faculty-gender-filter')?.value || '';
  const majorFilter = document.getElementById('faculty-major-filter')?.value || '';
  const classFilter = document.getElementById('faculty-class-filter')?.value || '';

  let list = state.facultyStudents || [];

  if (search) {
    list = list.filter(s =>
      (s.mssv && s.mssv.toLowerCase().includes(search)) ||
      (s.fullName && s.fullName.toLowerCase().includes(search)) ||
      (s.name && s.name.toLowerCase().includes(search)) ||
      (s.email && s.email.toLowerCase().includes(search)) ||
      (s.phone && s.phone.includes(search))
    );
  }

  if (genderFilter) {
    list = list.filter(s => (s.gender || '').toLowerCase() === genderFilter.toLowerCase());
  }

  if (majorFilter) {
    list = list.filter(s => (s.major || '').toLowerCase() === majorFilter.toLowerCase());
  }

  if (classFilter) {
    list = list.filter(s => (s.className || s.studentClass || '') === classFilter);
  }

  state.facultyFilteredStudents = list;
  state.facultyCurrentPage = targetPage;

  renderFacultyStudentsCurrentPage();
}

function renderFacultyStudentsCurrentPage() {
  const tbody = document.getElementById('faculty-students-tbody');
  if (!tbody) return;

  const totalEl = document.getElementById('faculty-students-total-count');
  const filtEl = document.getElementById('faculty-students-filtered-count');
  const pageInfo = document.getElementById('faculty-page-info');
  const prevBtn = document.getElementById('faculty-btn-prev');
  const nextBtn = document.getElementById('faculty-btn-next');

  const total = (state.facultyStudents || []).length;
  const filtered = state.facultyFilteredStudents || [];
  const pageSize = state.facultyPageSize || 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  let page = state.facultyCurrentPage || 1;
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  state.facultyCurrentPage = page;

  if (totalEl) totalEl.textContent = total.toLocaleString('vi-VN');
  if (filtEl) filtEl.textContent = filtered.length.toLocaleString('vi-VN');
  if (pageInfo) pageInfo.textContent = `Trang ${page} / ${totalPages} (${filtered.length} kết quả)`;
  if (prevBtn) prevBtn.disabled = (page <= 1);
  if (nextBtn) nextBtn.disabled = (page >= totalPages);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không tìm thấy sinh viên nào phù hợp với bộ lọc.</td></tr>';
    return;
  }

  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pageRows = filtered.slice(startIdx, endIdx);

  tbody.innerHTML = pageRows.map(s => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-3 font-mono font-bold text-slate-900">${s.mssv}</td>
      <td class="p-3 font-bold text-slate-800">${s.fullName || s.name || '--'}</td>
      <td class="p-3 text-slate-600">${s.gender || '--'}</td>
      <td class="p-3 text-slate-700 font-medium">${s.major || '--'}</td>
      <td class="p-3 font-mono text-slate-600">${s.className || s.studentClass || '--'}</td>
      <td class="p-3 text-slate-500 font-mono text-[11px]">${s.email || '--'}</td>
      <td class="p-3 text-slate-500 font-mono text-[11px]">${s.course || s.admissionYear || s.phone || '--'}</td>
      <td class="p-3 text-right">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          IFAA Master
        </span>
      </td>
    </tr>
  `).join('');
}

window.changeFacultyPageSize = function(size) {
  state.facultyPageSize = parseInt(size, 10) || 15;
  applyFacultyFiltersAndRender(1);
};

window.prevFacultyStudentPage = function() {
  if (state.facultyCurrentPage > 1) {
    state.facultyCurrentPage--;
    renderFacultyStudentsCurrentPage();
  }
};

window.nextFacultyStudentPage = function() {
  const pageSize = state.facultyPageSize || 15;
  const totalPages = Math.ceil((state.facultyFilteredStudents || []).length / pageSize);
  if (state.facultyCurrentPage < totalPages) {
    state.facultyCurrentPage++;
    renderFacultyStudentsCurrentPage();
  }
};

window.resetFacultyStudentFilters = function() {
  const sInput = document.getElementById('faculty-search-input');
  const gSelect = document.getElementById('faculty-gender-filter');
  const mSelect = document.getElementById('faculty-major-filter');
  const cSelect = document.getElementById('faculty-class-filter');
  if (sInput) sInput.value = '';
  if (gSelect) gSelect.value = '';
  if (mSelect) mSelect.value = '';
  if (cSelect) cSelect.value = '';

  if (state.facultyStudentsLoaded) {
    applyFacultyFiltersAndRender(1);
  }
};

// ============================================================================
// STRICT READ-ONLY LOCKDOWN: LEGACY MUTATION FUNCTIONS INTERCEPTED
// Zero writes to IFAA. Zero writes to Graduation facultyStudents.
// ============================================================================

window.saveSingleFacultyStudent = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  showToast('⚠️ Chế độ Read-Only: Dữ liệu sinh viên toàn khoa được quản lý tập trung tại IFA+ Activities. Vui lòng thêm/sửa tại hệ thống IFAA.', 'warning');
  return false;
};

window.editFacultyStudentInline = function(mssv) {
  showToast(`ℹ️ Chế độ Read-Only: Hồ sơ sinh viên ${mssv} được quản lý tại IFA+ Activities (ifa-activities).`, 'info');
  return false;
};

window.deleteFacultyStudent = async function(mssv) {
  showToast('⚠️ Chế độ Read-Only: Danh sách sinh viên được đồng bộ từ IFA+ Activities. Không thể xóa sinh viên tại Graduation.', 'warning');
  return false;
};

window.clearAllFacultyStudents = async function() {
  showToast('⚠️ Chế độ Read-Only: Danh mục sinh viên được quản lý tại IFA+ Activities. Thao tác xóa bị vô hiệu hóa.', 'warning');
  return false;
};

window.handleFacultyStudentsUpload = async function(event) {
  if (event?.target) event.target.value = '';
  showToast('⚠️ Chế độ Read-Only: Vui lòng tải lên danh sách sinh viên toàn khoa tại trang Quản trị IFA+ Activities để cập nhật master dataset.', 'warning');
  return false;
};

window.rebuildFacultyDataset = async function() {
  return await window.syncFacultyDatasetFromIFAA();
};

window.downloadFacultyStudentsTemplate = function() {
  showToast('ℹ️ Quản lý danh mục sinh viên toàn khoa được thực hiện tại IFA+ Activities.', 'info');
  return false;
};

// Export to Excel (Read-Only Utility)
window.exportFacultyStudentsExcel = async function() {
  try {
    let rows = state.facultyStudents;
    if (!state.facultyStudentsLoaded || !rows || rows.length === 0) {
      showToast('Đang tải dữ liệu từ IFAA để xuất Excel...', 'info');
      rows = await ensureFacultyDatasetLoaded();
    }

    if (!rows || rows.length === 0) {
      showToast('Không có dữ liệu sinh viên để xuất.', 'warning');
      return;
    }

    const exportRows = rows.map((s, idx) => ({
      'STT': idx + 1,
      'MSSV': s.mssv,
      'Họ và tên': s.fullName || s.name || '',
      'Giới tính': s.gender || '',
      'Ngành': s.major || '',
      'Lớp': s.className || s.studentClass || '',
      'Email': s.email || '',
      'Khóa / Tuyển sinh': s.course || s.admissionYear || '',
      'Số điện thoại': s.phone || '',
      'Nguồn dữ liệu': 'IFAA Master'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachSVKhoa_IFAA');
    XLSX.writeFile(wb, `DANH_SACH_SINH_VIEN_IFAA_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`✓ Đã xuất Excel ${exportRows.length} sinh viên từ IFAA Master!`, 'success');
  } catch (err) {
    showToast('Lỗi xuất Excel: ' + err.message, 'error');
  }
};




// ============================================================================
// PHASE 2: STUDENT PORTAL ENHANCEMENTS
// ============================================================================

window.startStudentRegistration = function() {
  const ctaCard = document.getElementById('registration-cta-card');
  const flowContainer = document.getElementById('registration-flow-container');
  if (ctaCard) ctaCard.classList.add('hidden');
  positionStudentRegistrationCta();
  if (flowContainer) {
    flowContainer.classList.remove('hidden');
    flowContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  state.selectedPreferences = [];
  const topicInput = document.getElementById('input-topic-title');
  if (topicInput) topicInput.value = '';
  setSelectedProjectTypes([]);
  populateRegistrationStudentForm();
  goToStep(1);
};

window.cancelRegistrationEdit = function() {
  const flowContainer = document.getElementById('registration-flow-container');
  const ctaCard = document.getElementById('registration-cta-card');
  const alreadyCard = document.getElementById('already-registered-card');
  if (flowContainer) flowContainer.classList.add('hidden');
  if (state.myRegistration) {
    if (alreadyCard) alreadyCard.classList.remove('hidden');
  } else {
    if (ctaCard) ctaCard.classList.remove('hidden');
  }
  positionStudentRegistrationCta();
};

window.updateStudentJourneyStepper = function() {
  positionStudentRegistrationCta();
  const container = document.getElementById('journey-steps-list');
  if (!container) return;

  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const userMssv = mssv || state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const round = state.activeRound;
  const reg = state.myRegistration;
  const effectiveAssignment = normalizeOfficialAssignment(state.myOfficialAssignment, reg);
  const officialList = effectiveAssignment ? getOfficialSupervisors(effectiveAssignment) : [];
  const hasOfficialSup = (state.myOfficialAssignment?.assignmentStatus === 'published')
    ? (officialList.length > 0 || Boolean(effectiveAssignment?.assignedSupervisorId || effectiveAssignment?.officialSupervisor || effectiveAssignment?.acceptedSupervisorName))
    : (officialList.length > 0 || Boolean(reg?.assignedSupervisorId || reg?.officialSupervisor));

  const activities = Array.isArray(round?.activities) ? round.activities : [];

  const findAct = (pattern) => activities.find(a => {
    const text = `${a.title || ''} ${a.name || ''} ${a.activityType || ''} ${a.slug || ''}`.toLowerCase();
    return pattern.test(text);
  });

  const getActStepStatus = (act, prevCompleted) => {
    if (!act) {
      return prevCompleted ? { status: 'upcoming', label: 'Chờ mở' } : { status: 'upcoming', label: 'Chưa tới' };
    }
    const actStatus = (typeof getActivityStatus === 'function') ? getActivityStatus(act) : 'upcoming';
    let isSubmitted = false;
    if (typeof getEffectiveSubmissionRules === 'function' && userMssv) {
      try {
        const rules = getEffectiveSubmissionRules(userMssv, act, round);
        if (rules?.currentSubmission && rules.currentSubmission.status === 'submitted') {
          isSubmitted = true;
        }
      } catch (e) {}
    }

    if (isSubmitted) {
      return { status: 'completed', label: 'Hoàn tất' };
    }
    if (actStatus === 'ongoing') {
      return { status: 'active', label: 'Đang mở' };
    }
    if (actStatus === 'past') {
      return { status: 'completed', label: 'Đã qua' };
    }
    if (prevCompleted) {
      return { status: 'active', label: 'Chuẩn bị' };
    }
    return { status: 'upcoming', label: 'Chưa tới' };
  };

  // 1. Phân công GVHD
  // Yêu cầu: khi khoa đã công bố GVHD rồi thì mục này sẽ xanh lên
  let s1Status = 'upcoming';
  let s1Label = 'Chờ phân công';
  if (hasOfficialSup) {
    s1Status = 'completed'; // Green
    s1Label = 'Đã công bố';
  } else if (round?.status === 'reviewing' || round?.status === 'open' || round?.status === 'finalized') {
    s1Status = 'active';
    s1Label = 'Đang phân công';
  }

  // 2. Đăng ký đề tài
  let s2Status = 'upcoming';
  let s2Label = 'Chưa đăng ký';
  const hasTopic = Boolean(reg?.topicTitle || reg?.topic || reg?.proposalTitle || reg?.title || reg?.topicName);
  if (hasTopic) {
    s2Status = 'completed';
    s2Label = 'Đã đăng ký';
  } else if (s1Status === 'completed' || round?.status === 'open') {
    s2Status = 'active';
    s2Label = 'Đang nhận ĐK';
  }

  // 3. Duyệt đợt 1
  const actDuyet1 = findAct(/(duyệt\s*(đợt)?\s*1|duyet\s*1|review\s*1)/i);
  const s3 = getActStepStatus(actDuyet1, s2Status === 'completed');

  // 4. Duyệt Đợt 2
  const actDuyet2 = findAct(/(duyệt\s*(đợt)?\s*2|duyet\s*2|review\s*2)/i);
  const s4 = getActStepStatus(actDuyet2, s3.status === 'completed');

  // 5. Duyệt Đợt 3
  const actDuyet3 = findAct(/(duyệt\s*(đợt)?\s*3|duyet\s*3|review\s*3)/i);
  const s5 = getActStepStatus(actDuyet3, s4.status === 'completed');

  // 6. Kiểm tra đạo văn
  const actDaoVan = findAct(/(đạo\s*văn|dao\s*van|turnitin|plagiarism)/i);
  const s6 = getActStepStatus(actDaoVan, s5.status === 'completed');

  // 7. Nộp Thuyết minh
  const actThuyetMinh = findAct(/(thuyết\s*minh|thuyet\s*minh)/i);
  const s7 = getActStepStatus(actThuyetMinh, s6.status === 'completed');

  // 8. Nộp Sơ Khảo
  const actSoKhao = findAct(/(sơ\s*khảo|so\s*khao)/i);
  const s8 = getActStepStatus(actSoKhao, s7.status === 'completed');

  // 9. Bảo vệ TN
  const actBaoVe = findAct(/(bảo\s*vệ|bao\s*ve|defense|hội\s*đồng)/i);
  let s9Status = 'upcoming';
  let s9Label = 'Chưa tới';
  const hasDefenseScore = Boolean(reg?.defenseScore || reg?.finalDefenseScore || state.studentDefenseScore);
  if (hasDefenseScore) {
    s9Status = 'completed';
    s9Label = 'Đã bảo vệ';
  } else if (actBaoVe) {
    const actBvStatus = (typeof getActivityStatus === 'function') ? getActivityStatus(actBaoVe) : 'upcoming';
    if (actBvStatus === 'ongoing') {
      s9Status = 'active';
      s9Label = 'Đang diễn ra';
    } else if (actBvStatus === 'past') {
      s9Status = 'completed';
      s9Label = 'Đã diễn ra';
    } else if (s8.status === 'completed') {
      s9Status = 'active';
      s9Label = 'Chuẩn bị BV';
    }
  } else if (s8.status === 'completed') {
    s9Status = 'active';
    s9Label = 'Chuẩn bị BV';
  }

  // 10. Kết quả
  let s10Status = 'upcoming';
  let s10Label = 'Chưa tới';
  const isResultsPublished = Boolean(round?.publishFinalScoreToStudents || round?.resultsPublished || (round?.status === 'finalized' && hasDefenseScore));
  if (isResultsPublished) {
    s10Status = 'completed';
    s10Label = 'Đã công bố';
  } else if (s9Status === 'completed' || s9Status === 'active') {
    s10Status = 'active';
    s10Label = 'Chờ công bố';
  }

  const steps = [
    { num: 1, title: 'Phân công GVHD', shortTitle: '1. Phân công GVHD', status: s1Status, label: s1Label },
    { num: 2, title: 'Đăng ký đề tài', shortTitle: '2. Đăng ký đề tài', status: s2Status, label: s2Label },
    { num: 3, title: 'Duyệt đợt 1', shortTitle: '3. Duyệt đợt 1', status: s3.status, label: s3.label },
    { num: 4, title: 'Duyệt Đợt 2', shortTitle: '4. Duyệt Đợt 2', status: s4.status, label: s4.label },
    { num: 5, title: 'Duyệt Đợt 3', shortTitle: '5. Duyệt Đợt 3', status: s5.status, label: s5.label },
    { num: 6, title: 'Kiểm tra đạo văn', shortTitle: '6. Đạo văn', status: s6.status, label: s6.label },
    { num: 7, title: 'Nộp Thuyết minh', shortTitle: '7. Thuyết minh', status: s7.status, label: s7.label },
    { num: 8, title: 'Nộp Sơ Khảo', shortTitle: '8. Sơ Khảo', status: s8.status, label: s8.label },
    { num: 9, title: 'Bảo vệ TN', shortTitle: '9. Bảo vệ TN', status: s9Status, label: s9Label },
    { num: 10, title: 'Kết quả', shortTitle: '10. Kết quả', status: s10Status, label: s10Label }
  ];

  const statusStyles = {
    completed: {
      circle: 'bg-emerald-600 text-white font-black shadow-sm',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      border: 'border-emerald-200 bg-emerald-50/50',
      icon: '✓'
    },
    active: {
      circle: 'bg-blue-600 text-white font-black shadow-sm animate-pulse',
      badge: 'bg-blue-50 text-blue-800 border-blue-300 font-bold',
      border: 'border-blue-300 bg-blue-50/70 shadow-xs ring-1 ring-blue-300',
      icon: '●'
    },
    warning: {
      circle: 'bg-rose-600 text-white font-black shadow-sm',
      badge: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
      border: 'border-rose-200 bg-rose-50/50',
      icon: '✕'
    },
    upcoming: {
      circle: 'bg-slate-200 text-slate-600 font-bold',
      badge: 'bg-slate-50 text-slate-500 border-slate-200',
      border: 'border-slate-100 bg-slate-50/60',
      icon: null
    }
  };

  container.innerHTML = steps.map(s => {
    const st = statusStyles[s.status] || statusStyles.upcoming;
    return `
      <div class="p-2 sm:p-2.5 rounded-xl border ${st.border} flex flex-col items-center text-center transition-all min-w-0">
        <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${st.circle}">
          ${st.icon || s.num}
        </div>
        <span class="font-bold text-[10px] sm:text-[11px] text-slate-800 leading-tight mb-1 whitespace-nowrap overflow-hidden text-ellipsis w-full" title="${s.title}">${s.shortTitle}</span>
        <span class="text-[9px] px-1 py-0.5 rounded-full border ${st.badge} whitespace-nowrap leading-none">${s.label}</span>
      </div>
    `;
  }).join('');
};

window.onRoundStartDateChanged = function(val) {
  const input = document.getElementById('round-form-start-date');
  const feedback = document.getElementById('round-start-date-feedback');
  if (!val) {
    if (feedback) feedback.innerHTML = '<span class="text-slate-500 italic">Chưa chọn ngày bắt đầu (mặc định sẽ dùng ngày mở đợt).</span>';
    window.refreshRoundWeekDayPickers?.();
    return;
  }
  const parts = val.split('-');
  if (parts.length !== 3) return;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const day = d.getDay(); // 0: Sun, 1: Mon, ...
  const pad = n => String(n).padStart(2, '0');

  if (day !== 1) {
    // Auto-snap to Monday of this week
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const monStr = `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())}`;
    if (input) input.value = monStr;
    if (feedback) {
      feedback.innerHTML = `<span class="text-blue-700 font-bold">✓ Đã tự động chuyển về Thứ Hai: <b>${monStr}</b></span>`;
    }
  } else {
    if (feedback) {
      feedback.innerHTML = `<span class="text-emerald-700 font-bold">✓ Hợp lệ: Thứ Hai (${val})</span>`;
    }
  }
  window.refreshRoundWeekDayPickers?.();
};

window.prevTimelineWeek = function() {
  if (typeof state.timelineTrackIndex !== 'number') state.timelineTrackIndex = 0;
  if (state.timelineTrackIndex > 0) {
    state.timelineTrackIndex--;
    renderStudentTimelineWeeks();
  }
};

window.nextTimelineWeek = function() {
  if (typeof state.timelineTrackIndex !== 'number') state.timelineTrackIndex = 0;
  const track = document.getElementById('timeline-cards-track');
  if (!track) return;
  const totalCards = track.children.length;
  const visibleCount = _getTimelineVisibleCount();
  const maxIndex = Math.max(0, totalCards - visibleCount);
  if (state.timelineTrackIndex < maxIndex) {
    state.timelineTrackIndex++;
    renderStudentTimelineWeeks();
  }
};

// Aliases for compatibility
window.prevTimelineWeeksPage = window.prevTimelineWeek;
window.nextTimelineWeeksPage = window.nextTimelineWeek;

// Helper: determine how many cards are visible based on container width
function _getTimelineVisibleCount() {
  const wrapper = document.getElementById('timeline-cards-track')?.parentElement;
  if (!wrapper) return 4;
  const w = wrapper.offsetWidth;
  if (w < 720) return 1;
  if (w < 1150) return 2;
  return 3;
}

function renderSupervisorRoundTimeline(round) {
  const container = document.getElementById('supervisor-round-timeline');
  if (!container) return;
  const allWeeks = getRoundTimelineWeeksWithActivities(round, true);
  const weeks = allWeeks.filter(week => week.visible);
  rememberRoundTimelineEvents(round.id, weeks);
  container.classList.toggle('hidden', weeks.length === 0);
  if (!weeks.length) return;
  const current = allWeeks.find(week => week.status === 'ongoing');
  const completed = allWeeks.filter(week => week.status === 'completed').length;
  const currentTitle = current ? resolveRoundWeekTitle(current.week, current.title) : null;
  const hasCustomSokhao = allWeeks.some(w => w.week >= 13 && resolveRoundWeekTitle(w.week, w.title).toLowerCase().includes('sơ khảo')) || allWeeks.length >= 13;
  const hasCustomBaove = allWeeks.some(w => w.week >= 14 && resolveRoundWeekTitle(w.week, w.title).toLowerCase().includes('bảo vệ')) || allWeeks.length >= 14;
  const hasCustomKetqua = allWeeks.some(w => w.week >= 15 && resolveRoundWeekTitle(w.week, w.title).toLowerCase().includes('kết quả')) || allWeeks.length >= 15;
  const stageCard = (icon, title, note) => `<div class="ifa-timeline-card min-w-[290px] max-w-[290px] snap-start rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col items-center justify-center text-center"><span class="mb-2 text-2xl">${icon}</span><strong class="text-xs text-slate-900">${title}</strong><span class="mt-1 text-[10px] text-slate-500">${note}</span></div>`;
  container.innerHTML = `<div class="mb-3 flex flex-wrap items-center justify-between gap-2"><div class="flex items-center gap-2"><span class="text-xl">🗓️</span><div><h2 class="text-sm font-black text-slate-900">Lộ trình đồ án tốt nghiệp & tiến độ thực hiện</h2><p class="text-[11px] text-slate-500">Kế hoạch ${allWeeks.length} tuần · Chọn sự kiện để xem chi tiết</p></div></div><span class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">${current ? `Đang diễn ra: ${escapeHtml(currentTitle)}` : `Đã qua ${completed}/${allWeeks.length} tuần`}</span></div>
    <div class="flex gap-3 overflow-x-auto pb-2 snap-x">${stageCard('📝', 'Đăng ký đề tài', 'Sinh viên đăng ký đề tài')}${stageCard('👨‍🏫', 'Phân công GVHD', isDirectSupervisorAssignment(round) ? 'Khoa phân công' : 'Xét nguyện vọng')}${weeks.map(week => {
      const resolvedTitle = resolveRoundWeekTitle(week.week, week.title);
      const circleContent = week.status === 'completed' ? '✓' : week.status === 'ongoing' ? '●' : (week.week > 12 ? (week.week === 13 ? '📄' : week.week === 14 ? '🎓' : '📌') : week.week);
      return `<div class="ifa-timeline-card min-w-[290px] max-w-[290px] snap-start rounded-2xl border p-3 ${week.status === 'ongoing' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'}">
      <div class="flex items-center justify-between gap-1"><strong class="text-xs text-slate-900 whitespace-nowrap">${escapeHtml(resolvedTitle)}</strong>${week.milestone ? `<span class="rounded-md bg-amber-500 px-1.5 py-0.5 text-center text-[9px] font-black leading-tight text-white">🚩 ${escapeHtml(week.milestone)}</span>` : ''}<span class="text-[10px] font-bold text-slate-500 whitespace-nowrap">${week.status === 'ongoing' ? 'Đang diễn ra' : week.status === 'completed' ? 'Đã qua' : 'Chưa tới'}</span></div>
      <div class="mx-auto my-2 flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${week.status === 'ongoing' ? 'bg-blue-600 text-white' : week.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}">${circleContent}</div>
      <p class="mt-2 text-center font-mono text-[11px] font-bold text-slate-700">${week.dateText}</p>
      ${renderTimelineWeekDays(week.days, week.events, week.week, round.id)}
      ${renderTimelineWeekEvents(week.events, week.week, round.id)}
      ${week.note ? `<p class="mt-2 text-[10px] text-slate-600">${escapeHtml(week.note)}</p>` : ''}
    </div>`;
    }).join('')}${!hasCustomSokhao ? stageCard('📄', 'Nộp Sơ khảo', 'Sau giai đoạn thực hiện') : ''}${!hasCustomBaove ? stageCard('🎓', 'Bảo vệ Tốt nghiệp', 'Theo lịch của Khoa') : ''}${!hasCustomKetqua ? stageCard('🏆', 'Kết quả', 'Sau bảo vệ tốt nghiệp') : ''}</div>`;
}

function renderSupervisorPlanList(round) {
  const section = document.getElementById('supervisor-plan-section');
  const container = document.getElementById('supervisor-plan-list');
  if (!section || !container) return;
  section.classList.remove('hidden');
  const activities = (Array.isArray(round.activities) ? round.activities : [])
    .map((activity, index) => normalizeActivity(activity, round.id, index))
    .filter(activity => isActivityPublished(activity))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!activities.length) {
    container.innerHTML = '<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">Khoa chưa công bố mốc kế hoạch cho đợt này.</div>';
    return;
  }
  const nearest = findNearestMilestone(activities);
  container.innerHTML = activities.map(activity => {
    const isNearest = Boolean(nearest && nearest.act && nearest.act.id === activity.id);
    return renderUnifiedActivityCard(activity, round, {
      isStudent: false,
      isNearest,
      nearestType: nearest?.type || 'ongoing',
      nearestTargetMs: nearest?.targetMs || null,
      prefix: 'sup'
    });
  }).join('');
  startMilestoneCountdownTicker();
}

let studentRegistrationCtaOriginalPosition = null;
function positionStudentRegistrationCta() {
  const cta = document.getElementById('registration-cta-card');
  const journey = document.getElementById('student-journey-card');
  if (!cta || !journey) return;
  if (!studentRegistrationCtaOriginalPosition) {
    studentRegistrationCtaOriginalPosition = document.createComment('registration-cta-original-position');
    cta.parentNode?.insertBefore(studentRegistrationCtaOriginalPosition, cta);
  }
  if (!state.myRegistration && !cta.classList.contains('hidden')) {
    journey.parentNode?.insertBefore(cta, journey);
  } else if (studentRegistrationCtaOriginalPosition.parentNode) {
    studentRegistrationCtaOriginalPosition.parentNode.insertBefore(cta, studentRegistrationCtaOriginalPosition.nextSibling);
  }
}

window.renderStudentTimelineWeeks = function() {
  // NEW: target the card slider track (old grid is kept hidden for compat)
  const track = document.getElementById('timeline-cards-track');
  const rangeEl = document.getElementById('timeline-weeks-dates-range');
  const badgeEl = document.getElementById('timeline-weeks-current-badge');
  if (!track) return;

  const round = state.activeRound || (state.rounds || []).find(r => r.id === state.selectedRoundId) || (state.rounds || [])[0];
  positionStudentRegistrationCta();
  const durationWeeks = parseInt(round?.durationWeeks, 10) || 12;

  // ── Date helpers ──────────────────────────────────────────────
  const pad = n => String(n).padStart(2, '0');
  const fmtShortDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const fmtFullDate  = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  // ── Determine starting Monday ──────────────────────────────────
  let startMonday = null;
  const configuredStart = round?.startDate || round?.datnStartDate;
  if (configuredStart) {
    let d = new Date(configuredStart?.toDate ? configuredStart.toDate() : configuredStart);
    if (!isNaN(d.getTime())) {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      startMonday = new Date(d.setDate(diff));
      startMonday.setHours(0, 0, 0, 0);
    }
  }
  if (!startMonday) {
    let d = round?.openAt ? new Date(round.openAt?.toDate ? round.openAt.toDate() : round.openAt) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    startMonday = new Date(d.setDate(diff));
    startMonday.setHours(0, 0, 0, 0);
  }

  const now = new Date();
  let currentWeekNum = null;
  const weeks = [];

  for (let w = 0; w < durationWeeks; w++) {
    const wStart = new Date(startMonday.getTime() + w * 7 * 24 * 3600 * 1000);
    wStart.setHours(0, 0, 0, 0);
    const wEnd = new Date(wStart.getTime() + 6 * 24 * 3600 * 1000);
    wEnd.setHours(23, 59, 59, 999);
    const weekNum = w + 1;
    let status = 'upcoming';
    if (now > wEnd) {
      status = 'completed';
    } else if (now >= wStart && now <= wEnd) {
      status = 'ongoing';
      currentWeekNum = weekNum;
    }
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(wStart.getTime() + dayIndex * 86400000);
      return { dayIndex, shortName: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][dayIndex], date, label: fmtShortDate(date), key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` };
    });
    weeks.push({ num: weekNum, start: wStart, end: wEnd,
      dateText: `${fmtFullDate(wStart)} – ${fmtFullDate(wEnd)}`, status, days });
  }

  // ── Header badge & date range ──────────────────────────────────
  const firstWeekStart = weeks[0]?.start;
  const lastWeekEnd   = weeks[weeks.length - 1]?.end;
  if (rangeEl && firstWeekStart && lastWeekEnd) {
    rangeEl.textContent = `Kế hoạch ${durationWeeks} tuần: ${fmtFullDate(firstWeekStart)} – ${fmtFullDate(lastWeekEnd)}`;
  }
  if (badgeEl) {
    if (currentWeekNum) {
      const activeTitle = resolveRoundWeekTitle(currentWeekNum, (weeklyConfig.find(c => c.week === currentWeekNum) || {}).title);
      badgeEl.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5 animate-pulse';
      badgeEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> Đang diễn ra: ${escapeHtml(activeTitle)}`;
    } else if (firstWeekStart && now < firstWeekStart) {
      badgeEl.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200';
      badgeEl.textContent = `Sắp bắt đầu (${fmtShortDate(firstWeekStart)})`;
    } else {
      badgeEl.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200';
      badgeEl.textContent = `✓ Đã kết thúc ${durationWeeks} tuần`;
    }
  }

  // ── Derive student state for intro/outro cards ────────────────
  const reg        = state.myRegistration;
  const hasTopic   = !!(reg?.topicTitle || reg?.topic);
  const effectiveAssignment = normalizeOfficialAssignment(state.myOfficialAssignment, reg);
  const officialSups = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(effectiveAssignment) : [];
  const hasGVHD = officialSups.length > 0 || Boolean(effectiveAssignment?.acceptedSupervisorId || effectiveAssignment?.assignedSupervisorId || reg?.supervisorName);
  const directAssign = round?.supervisorAssignmentMode === 'direct_assignment';

  // ── Default milestone labels per week (overrideable by admin) ──
  const defaultMilestones = { 4: 'Duyệt đợt 1', 8: 'Duyệt đợt 2', 12: 'Duyệt đợt 3' };
  const weeklyConfig = Array.isArray(round?.timelineWeeksConfig) ? round.timelineWeeksConfig : [];
  const activitySource = state.studentVisibleActivities?.roundId === round?.id
    ? state.studentVisibleActivities.activities
    : (Array.isArray(round?.activities) ? round.activities : []);
  const toLocalDateKey = value => {
    if (!value) return '';
    const date = new Date(value?.toDate ? value.toDate() : value);
    return isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const activityEvents = activitySource
    .filter(activity => isActivityPublished(activity) && (activity.startAt || activity.endAt))
    .map(activity => {
      const startDate = toLocalDateKey(activity.startAt || activity.endAt);
      const endDate = toLocalDateKey(activity.endAt || activity.startAt);
      return { id: `activity-${activity.id}`, activityId: activity.id, activity,
        title: String(activity.title || '').trim(), startDate: startDate <= endDate ? startDate : endDate,
        endDate: startDate <= endDate ? endDate : startDate, color: normalizeRoundWeekEventColor(activity.color) };
    }).filter(event => event.title && event.startDate && event.endDate);

  // ── Build the full unified card array (17 cards) ──────────────
  const allCards = [];

  // Card 0 – Đăng ký đề tài
  allCards.push({
    type: 'milestone',
    id: 'reg-topic',
    icon: '📝',
    title: 'Đăng ký đề tài',
    subtitle: hasTopic ? (reg.topicTitle || reg.topic || 'Đề tài ĐATN') : 'Đề tài ĐATN',
    status: hasTopic ? 'completed' : (round?.status === 'open' ? 'active' : 'upcoming'),
    note: hasTopic ? '✓ Đã đăng ký' : (round?.status === 'open' ? 'Đang mở đăng ký' : 'Chưa mở'),
  });

  // Card 1 – Phân công GVHD
  let gvhdStatus = 'upcoming';
  if (hasGVHD) {
    gvhdStatus = 'completed';
  } else if (directAssign || round?.status === 'reviewing') {
    gvhdStatus = 'active';
  }
  const supervisorProfiles = hasGVHD ? resolveStudentSupervisorProfiles(officialSups, effectiveAssignment).slice(0, 2) : [];
  allCards.push({
    type: 'milestone',
    id: 'gvhd',
    icon: '👨‍🏫',
    title: 'Phân công GVHD',
    subtitle: hasGVHD
      ? ''
      : (directAssign ? 'Khoa đang phân công' : 'Chờ kết quả xét'),
    status: gvhdStatus,
    note: hasGVHD ? '✓ Đã phân công' : (gvhdStatus === 'active' ? 'Đang xử lý' : 'Chưa phân công'),
    supervisors: supervisorProfiles,
  });

  // Cards 2–13 – 12 weekly cards (or durationWeeks)
  weeks.forEach((w, i) => {
    const cfg = weeklyConfig.find(c => c.week === w.num) || {};
    if (cfg.visible === false) return;
    const defMilestone = defaultMilestones[w.num] || null;
    const milestone = cfg.milestone || (defMilestone ? defMilestone : null);
    const manualEvents = (Array.isArray(cfg.events) ? cfg.events : []).map((event, index) => ({
      id: event.id || `legacy-${w.num}-${index}`,
      title: String(event.title || event.name || '').trim(),
      dayIndex: Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      date: event.date || event.startDate || '',
      startDayIndex: Number.isInteger(Number(event.startDayIndex)) ? Math.max(0, Math.min(6, Number(event.startDayIndex))) : Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      endDayIndex: Number.isInteger(Number(event.endDayIndex)) ? Math.max(0, Math.min(6, Number(event.endDayIndex))) : Math.max(0, Math.min(6, Number(event.dayIndex) || 0)),
      startDate: event.startDate || event.date || '',
      endDate: event.endDate || event.date || '',
      color: normalizeRoundWeekEventColor(event.color)
    })).filter(event => event.title);
    const firstDay = w.days[0]?.key;
    const lastDay = w.days[6]?.key;
    const events = distinguishOverlappingTimelineEvents(
      [...manualEvents, ...activityEvents.filter(event => event.startDate <= lastDay && event.endDate >= firstDay)], w.days
    );
    const resolvedTitle = resolveRoundWeekTitle(w.num, cfg.title);
    allCards.push({
      type: 'week',
      num: w.num,
      dateText: w.dateText,
      status: w.status,
      title: resolvedTitle,
      subtitle: cfg.note || '',
      milestone,
      days: w.days,
      events,
    });
  });
  state.studentTimelineEventMap = new Map(allCards.filter(card => card.type === 'week').map(card => [card.num, card.events]));

  const hasCustomSokhaoWeek = weeks.some(w => w.num >= 13 && resolveRoundWeekTitle(w.num, (weeklyConfig.find(c => c.week === w.num) || {}).title).toLowerCase().includes('sơ khảo')) || durationWeeks >= 13;
  const hasCustomBaoveWeek = weeks.some(w => w.num >= 14 && resolveRoundWeekTitle(w.num, (weeklyConfig.find(c => c.week === w.num) || {}).title).toLowerCase().includes('bảo vệ')) || durationWeeks >= 14;
  const hasCustomKetquaWeek = weeks.some(w => w.num >= 15 && resolveRoundWeekTitle(w.num, (weeklyConfig.find(c => c.week === w.num) || {}).title).toLowerCase().includes('kết quả')) || durationWeeks >= 15;

  const afterWeeks = lastWeekEnd ? now > lastWeekEnd : false;

  // Card N – Sơ khảo (only show if not covered in weekly cards)
  if (!hasCustomSokhaoWeek) {
    allCards.push({
      type: 'milestone',
      id: 'sokhao',
      icon: '📄',
      title: 'Nộp Sơ khảo',
      subtitle: 'Nộp hồ sơ Sơ khảo',
      status: afterWeeks ? 'completed' : 'upcoming',
      note: afterWeeks ? '✓ Đã nộp' : 'Sau 12 tuần',
    });
  }

  // Card N+1 – Bảo vệ TN (only show if not covered in weekly cards)
  if (!hasCustomBaoveWeek) {
    allCards.push({
      type: 'milestone',
      id: 'baove',
      icon: '🎓',
      title: 'Bảo vệ Tốt nghiệp',
      subtitle: 'Trình bày & Hội đồng chấm',
      status: afterWeeks ? 'completed' : 'upcoming',
      note: afterWeeks ? '✓ Đã bảo vệ' : 'Lịch do Khoa thông báo',
    });
  }

  // Card N+2 – Kết quả (only show if not covered in weekly cards)
  if (!hasCustomKetquaWeek) {
    allCards.push({
      type: 'milestone',
      id: 'ketqua',
      icon: '🏆',
      title: 'Kết quả',
      subtitle: 'Điểm tổng kết chính thức',
      status: afterWeeks ? 'completed' : 'upcoming',
      note: afterWeeks ? '✓ Đã công bố' : 'Sau bảo vệ TN',
    });
  }

  // ── Compute card pixel width ────────────────────────────────────
  const visibleCount = _getTimelineVisibleCount();
  const trackWrapper = track.parentElement;
  const gap = 12; // gap-3 = 12px
  const totalGaps = (visibleCount - 1) * gap;
  const cardPxWidth = Math.floor((trackWrapper.offsetWidth - totalGaps) / visibleCount);

  // ── Render cards into track ─────────────────────────────────────
  const stMap = {
    completed: {
      card: 'bg-emerald-50 border-emerald-300 text-emerald-900',
      icon_bg: 'bg-emerald-600 text-white shadow-sm',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      label: 'Hoàn thành',
    },
    active: {
      card: 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 text-blue-950',
      icon_bg: 'bg-blue-600 text-white shadow-sm animate-pulse',
      badge: 'bg-blue-600 text-white border-blue-600',
      label: 'Đang diễn ra',
    },
    ongoing: {
      card: 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 text-blue-950',
      icon_bg: 'bg-blue-600 text-white shadow-sm animate-pulse',
      badge: 'bg-blue-600 text-white border-blue-600',
      label: 'Đang diễn ra',
    },
    upcoming: {
      card: 'bg-slate-50 border-slate-200 text-slate-600',
      icon_bg: 'bg-slate-200 text-slate-500',
      badge: 'bg-slate-100 text-slate-500 border-slate-200',
      label: 'Chưa tới',
    },
  };

  track.innerHTML = allCards.map((card, idx) => {
    const st = stMap[card.status] || stMap.upcoming;
    const isActive = card.status === 'ongoing' || card.status === 'active';

    if (card.type === 'week') {
      // Weekly card
      const milestoneHtml = card.milestone
        ? `<span class="min-w-0 rounded-md bg-amber-500 px-1.5 py-0.5 text-center text-[9px] font-black leading-tight text-white">🚩 ${escapeHtml(card.milestone)}</span>`
        : '';
      const noteHtml = card.subtitle
        ? `<p class="text-[10px] text-slate-500 mt-1 leading-tight line-clamp-2">${card.subtitle}</p>`
        : '';
      const circleContent = card.status === 'completed' ? '✓' : (card.status === 'ongoing' || card.status === 'active') ? '●' : (card.num > 12 ? (card.num === 13 ? '📄' : card.num === 14 ? '🎓' : '📌') : card.num);
      return `<div class="ifa-timeline-card flex-shrink-0 rounded-2xl border ${st.card} flex flex-col items-center text-center p-3 shadow-xs relative overflow-hidden transition-all ${isActive ? 'shadow-md' : ''}"
                   style="width:${cardPxWidth}px;min-width:${cardPxWidth}px;">
        <div class="flex items-center justify-between gap-1 w-full mb-1.5">
          <span class="font-black text-sm text-inherit whitespace-nowrap">${escapeHtml(card.title)}</span>
          ${milestoneHtml}
          <span class="text-[10px] px-1.5 py-0.5 rounded-full border ${st.badge} font-bold whitespace-nowrap leading-none">${st.label}</span>
        </div>
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${st.icon_bg} my-1">
          ${circleContent}
        </div>
        <span class="text-[13px] font-mono font-bold text-slate-700 tracking-tight">${card.dateText}</span>
        ${renderTimelineWeekDays(card.days, card.events, card.num)}
        ${renderTimelineWeekEvents(card.events, card.num)}
        ${noteHtml}
      </div>`;
    } else {
      // Milestone card (intro/outro)
      const isGvhdCompleted = card.id === 'gvhd' && card.status === 'completed';
      const cardBg = isGvhdCompleted ? 'bg-emerald-50 border-emerald-300' : (card.status === 'completed' ? 'bg-emerald-50 border-emerald-300' : card.status === 'active' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300' : 'bg-slate-50 border-slate-200');
      const iconBg = card.status === 'completed' ? 'bg-emerald-600 text-white' : card.status === 'active' ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500';
      const noteColor = card.status === 'completed' ? 'text-emerald-700 font-bold' : card.status === 'active' ? 'text-blue-700 font-bold' : 'text-slate-400';
      const supervisorInfo = card.id === 'gvhd' && card.supervisors?.length
        ? `<div class="grid w-full ${card.supervisors.length > 1 ? 'grid-cols-2 gap-2' : 'grid-cols-1'}">${card.supervisors.map(profile => {
          const fallback = getSupervisorAvatarSvgDataUri(profile.name);
          const avatar = profile.photoUrl || fallback;
          const phoneHref = String(profile.phone || '').replace(/[^\d+]/g, '');
          return `<div class="min-w-0 flex flex-col items-center text-center"><span class="mb-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-900">${profile.label}</span><img src="${escapeHtml(avatar)}" data-fallback="${escapeHtml(fallback)}" onerror="this.onerror=null;this.src=this.dataset.fallback" alt="${escapeHtml(profile.name)}" class="${card.supervisors.length > 1 ? 'h-16 w-16' : 'h-24 w-24'} rounded-2xl border-2 border-emerald-300 object-cover shadow-sm"><b class="mt-2 block w-full break-words text-xs text-emerald-950">${escapeHtml(profile.name)}</b>${profile.email ? `<small class="mt-1 block w-full break-all text-[10px] text-emerald-700">${escapeHtml(profile.email)}</small>` : ''}${profile.phone ? `<a href="tel:${escapeHtml(phoneHref)}" class="mt-1 text-[11px] font-bold text-emerald-800 hover:underline">📞 ${escapeHtml(profile.phone)}</a>` : ''}</div>`;
        }).join('')}</div>`
        : '';
      if (card.id === 'gvhd' && card.supervisors?.length) {
        return `<div class="ifa-timeline-card flex-shrink-0 rounded-2xl border ${cardBg} flex flex-col items-center justify-center text-center p-4 shadow-xs relative overflow-hidden transition-all"
                     style="width:${cardPxWidth}px;min-width:${cardPxWidth}px;">
          ${supervisorInfo}
        </div>`;
      }
      return `<div class="ifa-timeline-card flex-shrink-0 rounded-2xl border ${cardBg} flex flex-col items-center text-center p-3 shadow-xs relative overflow-hidden transition-all"
                   style="width:${cardPxWidth}px;min-width:${cardPxWidth}px;">
        <div class="w-12 h-12 rounded-full flex items-center justify-center text-xl ${iconBg} mb-2 shadow-xs">
          ${card.icon}
        </div>
        <span class="font-black text-sm text-slate-900 leading-tight">${card.title}</span>
        ${card.subtitle ? `<span class="text-xs text-slate-600 mt-1 leading-snug line-clamp-3">${escapeHtml(card.subtitle)}</span>` : ''}
        <span class="mt-2 text-[11px] ${noteColor}">${card.note}</span>
        ${supervisorInfo}
      </div>`;
    }
  }).join('');

  // ── Track index management ──────────────────────────────────────
  const totalCards = allCards.length;
  const maxTrackIndex = Math.max(0, totalCards - visibleCount);

  // Reset on round change
  if (state.timelineWeeksRoundId !== round?.id) {
    state.timelineWeeksRoundId = round?.id;
    state.timelineTrackIndex = null;
  }

  // Auto-scroll to the currently active card
  if (typeof state.timelineTrackIndex !== 'number') {
    if (currentWeekNum) {
      const activeIdx = allCards.findIndex(card => card.type === 'week' && card.num === currentWeekNum);
      state.timelineTrackIndex = activeIdx >= 0
        ? Math.max(0, Math.min(maxTrackIndex, activeIdx - 1))
        : 0;
    } else if (hasTopic && !hasGVHD) {
      state.timelineTrackIndex = 1; // scroll to show GVHD card
    } else {
      state.timelineTrackIndex = 0;
    }
  }
  state.timelineTrackIndex = Math.max(0, Math.min(maxTrackIndex, state.timelineTrackIndex));

  // Apply CSS transform to slide the track
  const slideOffset = state.timelineTrackIndex * (cardPxWidth + gap);
  track.style.transform = `translateX(-${slideOffset}px)`;

  // ── Navigation buttons ─────────────────────────────────────────
  const prevBtn = document.getElementById('timeline-weeks-prev-btn');
  const nextBtn = document.getElementById('timeline-weeks-next-btn');
  if (prevBtn) prevBtn.classList.toggle('hidden', state.timelineTrackIndex <= 0);
  if (nextBtn) nextBtn.classList.toggle('hidden', state.timelineTrackIndex >= maxTrackIndex);

  // ── Step indicator ─────────────────────────────────────────────
  const stepIndicator = document.getElementById('timeline-track-step-indicator');
  if (stepIndicator) {
    stepIndicator.textContent = `${state.timelineTrackIndex + 1} / ${totalCards}`;
  }
  // Legacy page indicator compat
  const pageIndicator = document.getElementById('timeline-weeks-page-indicator');
  if (pageIndicator && weeks.length > 0) {
    const startW = Math.max(1, state.timelineTrackIndex - 1);
    pageIndicator.textContent = `${startW} / ${durationWeeks} tuần`;
  }
};

async function loadStudentSelfProfile(mssv) {
  if (!mssv) return null;
  try {
    const snap = await getDoc(doc(db, 'graduationStudentProfiles', mssv));
    state.studentSelfProfile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn('[StudentProfile] Unable to load self profile:', err.message);
    state.studentSelfProfile = null;
  }
  return state.studentSelfProfile;
}

function getRegistrationStudentIdentity() {
  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(mssv) : null;
  return {
    mssv,
    fullName: studentObj?.fullName || studentObj?.name || state.myRegistration?.studentName || state.user?.displayName || `Sinh viên ${mssv}`,
    major: studentObj?.major || state.myRegistration?.major || 'Thiết kế nội thất',
    email: state.myRegistration?.email || (state.impersonation?.target?.email) || state.user?.email || `${mssv}@student.tdtu.edu.vn`
  };
}

function populateRegistrationStudentForm() {
  const identity = getRegistrationStudentIdentity();
  const reg = state.myRegistration || {};
  const profile = state.studentSelfProfile || {};
  const values = {
    'registration-student-name': identity.fullName,
    'registration-student-id': identity.mssv,
    'registration-student-major': identity.major,
    'registration-personal-email': reg.personalEmail || profile.personalEmail || '',
    'registration-current-class': reg.currentClass || profile.currentClass || '',
    'registration-student-phone': reg.studentPhone || profile.phone || '',
    'registration-student-permanent-address': reg.studentPermanentAddress || profile.permanentAddress || '',
    'registration-student-temporary-address': reg.studentTemporaryAddress || reg.studentAddress || profile.temporaryAddress || profile.address || '',
    'registration-course-name': reg.courseName || 'Đồ án tốt nghiệp',
    'registration-course-code': reg.courseCode || '',
    'registration-course-group': reg.courseGroup || '',
    'input-topic-description': reg.topicDescription || ''
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  const counter = document.getElementById('topic-description-char-count');
  if (counter) counter.textContent = String(values['input-topic-description'].length);
}

function collectOfficialFormFields() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  return {
    currentClass: val('registration-current-class'),
    personalEmail: val('registration-personal-email'),
    studentPhone: val('registration-student-phone'),
    studentPermanentAddress: val('registration-student-permanent-address'),
    studentTemporaryAddress: val('registration-student-temporary-address'),
    studentAddress: val('registration-student-temporary-address'),
    courseName: val('registration-course-name'),
    courseCode: val('registration-course-code'),
    courseGroup: val('registration-course-group'),
    topicDescription: val('input-topic-description')
  };
}

function validateOfficialFormFields(fields) {
  const labels = {
    currentClass: 'lớp', personalEmail: 'email cá nhân', studentPhone: 'số điện thoại',
    studentPermanentAddress: 'địa chỉ thường trú', studentTemporaryAddress: 'địa chỉ tạm trú',
    courseName: 'môn học', courseCode: 'mã môn học', courseGroup: 'nhóm', topicDescription: 'mô tả định hướng thiết kế'
  };
  const missing = Object.entries(labels).find(([key]) => !String(fields[key] || '').trim());
  if (missing) {
    showToast(`Vui lòng nhập ${missing[1]} để hoàn thiện phiếu đăng ký chính thức.`, 'warning');
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.personalEmail)) {
    showToast('Email cá nhân chưa đúng định dạng.', 'warning');
    return false;
  }
  return true;
}

export function getCleanRegistrationAddress(st, studentObj = null) {
  const isInvalid = (val) => {
    if (!val) return true;
    const s = String(val).trim().toLowerCase();
    return s === '' || s === 'không có' || s === 'khong co' || s === 'không' || s === 'khong' || 
           s === 'k' || s === 'ko' || s === 'none' || s === '-' || s === '--' || s === 'n/a';
  };

  const temp = st?.studentTemporaryAddress || st?.temporaryAddress || '';
  const perm = st?.studentPermanentAddress || st?.permanentAddress || '';
  const gen = st?.studentAddress || st?.address || studentObj?.address || '';

  if (!isInvalid(temp)) return temp.trim();
  if (!isInvalid(perm)) return perm.trim();
  if (!isInvalid(gen)) return gen.trim();
  return temp || perm || gen || '--';
}
window.getCleanRegistrationAddress = getCleanRegistrationAddress;

window.printOfficialTopicRegistrationPaper = function(targetStudentId = null) {
  const paper = document.getElementById('topic-preview-paper');
  if (!paper) {
    if (typeof window.downloadOfficialTopicRegistrationPdf === 'function') {
      window.downloadOfficialTopicRegistrationPdf(targetStudentId);
    }
    return;
  }

  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);

  const doc = printFrame.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Phieu-dang-ky-de-tai</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          * {
            box-sizing: border-box;
            font-family: 'Times New Roman', Times, serif !important;
            color: #000 !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
            font-size: 13pt;
            line-height: 1.4;
          }
          table {
            border-collapse: collapse;
          }
          td.has-value {
            border-bottom: 0 !important;
          }
        </style>
      </head>
      <body>
        ${paper.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  const innerPaper = doc.getElementById('topic-preview-paper');
  if (innerPaper) {
    innerPaper.style.boxShadow = 'none';
    innerPaper.style.border = 'none';
    innerPaper.style.padding = '0';
    innerPaper.style.margin = '0';
    innerPaper.style.width = '100%';
    innerPaper.style.minWidth = '100%';
    innerPaper.style.minHeight = 'auto';
  }

  setTimeout(() => {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    } catch (e) {
      console.warn('Iframe print notice:', e);
      window.print();
    }
    setTimeout(() => {
      printFrame.remove();
    }, 2000);
  }, 250);
};

window.downloadOfficialTopicRegistrationPdf = function(targetStudentId = null) {
  let reg = null;
  let identity = null;

  if (targetStudentId && typeof targetStudentId === 'string') {
    reg = (state.supervisorAssignedStudents || []).find(st => (st.studentId || st.id) === targetStudentId) ||
      (typeof findStudentInRound === 'function' ? findStudentInRound(targetStudentId) : null);
    const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(targetStudentId) : null;
    identity = {
      mssv: targetStudentId,
      fullName: reg?.studentName || studentObj?.fullName || studentObj?.name || targetStudentId,
      major: reg?.major || studentObj?.major || 'Thiết kế nội thất',
      email: reg?.personalEmail || reg?.email || studentObj?.email || `${targetStudentId}@student.tdtu.edu.vn`
    };
  } else {
    reg = state.myRegistration;
    identity = getRegistrationStudentIdentity();
  }

  if (!reg) {
    showToast('Không tìm thấy thông tin đăng ký.', 'warning');
    return;
  }
  if (!targetStudentId && reg.topicApprovalStatus !== 'approved') {
    showToast('Phiếu PDF chỉ được tải sau khi GVHD xác nhận tên đề tài.', 'warning');
    return;
  }
  if (!window.pdfMake) {
    showToast('Bộ tạo PDF chưa tải xong. Vui lòng thử lại sau vài giây.', 'warning');
    return;
  }

  identity = identity || getRegistrationStudentIdentity();
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(identity.mssv) : null;
  const round = state.activeRound || {};
  const approvedDate = reg.topicReviewedAt?.toDate ? reg.topicReviewedAt.toDate() : new Date();
  const dd = String(approvedDate.getDate()).padStart(2, '0');
  const mm = String(approvedDate.getMonth() + 1).padStart(2, '0');
  const yyyy = approvedDate.getFullYear();
  const roundLabel = round.title || round.roundName || 'ĐỒ ÁN TỐT NGHIỆP';
  const version = Number(reg.topicTitleVersion || 1);
  const normalizedRoundLabel = roundLabel.toUpperCase().replace(/\s+/g, ' ').trim();
  const roundHeadingMatch = normalizedRoundLabel.match(/^(.*?)(?:\s*-\s*)?(ĐỢT\s+.+)$/);
  const programHeading = roundHeadingMatch?.[1] || 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP';
  const roundHeading = roundHeadingMatch?.[2] || (round.roundName ? `ĐỢT ${round.roundName}` : '');
  const descriptionText = String(reg.topicDescription || '').trim();
  const studentClass = reg.currentClass || reg.studentClass || reg.className || studentObj?.className || studentObj?.studentClass || '--';
  const studentAddress = getCleanRegistrationAddress(reg, studentObj);

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [54, 36, 54, 36],
    defaultStyle: { font: 'Roboto', fontSize: 12, lineHeight: 1.2 },
    content: [
      {
        columns: [
          {
            width: '46%',
            stack: [
              { text: 'TRƯỜNG ĐẠI HỌC TÔN ĐỨC THẮNG', fontSize: 10.5, alignment: 'center' },
              { text: 'KHOA MỸ THUẬT CÔNG NGHIỆP', fontSize: 10.5, bold: true, alignment: 'center', margin: [0, 2, 0, 4] },
              { canvas: [{ type: 'line', x1: 25, y1: 0, x2: 175, y2: 0, lineWidth: 0.8 }] }
            ]
          },
          {
            width: '54%',
            stack: [
              { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', fontSize: 10.5, bold: true, alignment: 'center' },
              { text: 'Độc lập -Tự do – Hạnh phúc', fontSize: 10.5, bold: true, alignment: 'center', margin: [0, 2, 0, 4] },
              { canvas: [{ type: 'line', x1: 45, y1: 0, x2: 175, y2: 0, lineWidth: 0.8 }] }
            ]
          }
        ],
        margin: [0, 0, 0, 20]
      },
      { text: 'PHIẾU ĐĂNG KÝ ĐỀ TÀI CHÍNH THỨC', bold: true, fontSize: 15, alignment: 'center' },
      { text: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP', bold: true, fontSize: 13.5, alignment: 'center', margin: [0, 2, 0, 0] },
      ...(roundHeading
        ? [{ text: roundHeading, bold: true, italics: true, fontSize: 13.5, alignment: 'center', margin: [0, 2, 0, 18] }]
        : [{ text: '', margin: [0, 0, 0, 18] }]),

      // Thông tin sinh viên (inline, không bị cách xa, không bold giá trị)
      {
        columns: [
          {
            width: '62%',
            text: [
              { text: 'HỌ VÀ TÊN: ', bold: true },
              { text: identity.fullName || '', bold: false }
            ]
          },
          {
            width: '38%',
            text: [
              { text: 'MSSV: ', bold: true },
              { text: identity.mssv || '', bold: false }
            ]
          }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        columns: [
          {
            width: '46%',
            text: [
              { text: 'LỚP: ', bold: true },
              { text: studentClass, bold: false }
            ]
          },
          {
            width: '54%',
            text: [
              { text: 'NGÀNH: ', bold: true },
              { text: reg.major || identity.major || 'Thiết kế nội thất', bold: false }
            ]
          }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        text: [
          { text: 'EMAIL: ', bold: true },
          { text: reg.personalEmail || identity.email || '', bold: false }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        text: [
          { text: 'ĐIỆN THOẠI: ', bold: true },
          { text: reg.studentPhone || '', bold: false }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        text: [
          { text: 'ĐỊA CHỈ: ', bold: true },
          { text: studentAddress, bold: false }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        columns: [
          {
            width: '45%',
            text: [
              { text: 'MÔN HỌC: ', bold: true },
              { text: reg.courseName || reg.projectType || 'Đồ án tốt nghiệp', bold: false }
            ]
          },
          {
            width: '35%',
            text: [
              { text: 'MÃ MÔN HỌC: ', bold: true },
              { text: reg.courseCode || '', bold: false }
            ]
          },
          {
            width: '20%',
            text: [
              { text: 'NHÓM: ', bold: true },
              { text: reg.courseGroup || '1', bold: false }
            ]
          }
        ],
        margin: [0, 0, 0, 14]
      },
      {
        text: `Đăng ký đề tài chính thức lần thứ : ${version}`,
        italics: true,
        fontSize: 12,
        alignment: 'center',
        margin: [0, 0, 0, 14]
      },
      {
        text: [
          { text: 'TÊN ĐỀ TÀI : ', bold: true },
          { text: reg.topicTitle || '', bold: false }
        ],
        lineHeight: 1.35,
        margin: [0, 0, 0, 14]
      },
      {
        text: 'MÔ TẢ CHI TIẾT ĐỊNH HƯỚNG THIẾT KẾ CỦA ĐỀ TÀI :',
        bold: true,
        alignment: 'center',
        fontSize: 12,
        margin: [0, 0, 0, 8]
      },
      {
        text: descriptionText || '',
        alignment: 'justify',
        fontSize: 12,
        lineHeight: 1.35,
        margin: [0, 0, 0, 14]
      },
      {
        text: 'Tôi xin cam đoan thực hiện đúng đề tài đã đăng ký.',
        bold: true,
        fontSize: 12,
        alignment: 'center',
        margin: [0, 4, 0, 18]
      },
      {
        columns: [
          {
            width: '56%',
            stack: [
              { text: 'Ý KIẾN CỦA GIẢNG VIÊN HƯỚNG DẪN', bold: true, fontSize: 12, alignment: 'center', margin: [0, 18, 0, 0] }
            ]
          },
          {
            width: '44%',
            stack: [
              { text: `Tp.HCM, ngày ${dd} tháng ${mm} năm ${yyyy}`, italics: true, fontSize: 12, alignment: 'center' },
              { text: 'NGƯỜI ĐĂNG KÝ', bold: true, fontSize: 12, alignment: 'center', margin: [0, 3, 0, 0] },
              { text: '(ký và ghi rõ họ tên)', italics: true, fontSize: 11, alignment: 'center', margin: [0, 1, 0, 40] },
              { text: identity.fullName, bold: false, fontSize: 12, alignment: 'center' }
            ]
          }
        ]
      }
    ],
    styles: {}
  };

  const safeId = String(identity.mssv || 'sinh-vien').replace(/[^0-9A-Za-z_-]/g, '');
  window.pdfMake.createPdf(docDefinition).download(`Phieu-dang-ky-de-tai-${safeId}-lan-${version}.pdf`);
};

window.updateStudentPersonalSidebar = function() {
  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const heroName = document.getElementById('hero-student-name');
  const heroMssv = document.getElementById('hero-student-mssv');
  const heroAvatar = document.getElementById('hero-student-avatar');
  const modalBody = document.getElementById('student-profile-modal-body');

  if (!mssv) {
    if (heroName) heroName.textContent = state.user?.displayName || 'Sinh viên';
    if (heroMssv) heroMssv.textContent = 'Chưa đăng nhập';
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          Vui lòng đăng nhập bằng tài khoản @student.tdtu.edu.vn để xem thông tin cá nhân.
        </div>
      `;
    }
    return;
  }

  const impTarget = (state.impersonation && state.impersonation.target?.type === 'student') ? state.impersonation.target : null;
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(mssv) : null;
  const fullName = impTarget?.name || studentObj?.fullName || studentObj?.name || state.myRegistration?.studentName || state.user?.displayName || `Sinh viên ${mssv}`;
  const studentClass = state.studentSelfProfile?.currentClass || state.myRegistration?.currentClass || impTarget?.currentClass || impTarget?.studentClass || impTarget?.className || studentObj?.className || studentObj?.studentClass || 'Chưa cập nhật';
  const major = impTarget?.major || studentObj?.major || state.myRegistration?.major || 'Thiết kế nội thất';

  const avatarUrl = state.user?.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%2394a3b8'/%3E%3Cpath fill='%2394a3b8' d='M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z'/%3E%3C/svg%3E";

  // Update Hero Banner Pill
  if (heroName) heroName.textContent = fullName;
  if (heroMssv) heroMssv.textContent = `MSSV: ${mssv}`;
  if (heroAvatar) heroAvatar.src = avatarUrl;

  if (!state.facultyStudentsLoaded && typeof loadFacultyDatasetFromIFAA === 'function') {
    loadFacultyDatasetFromIFAA().then(() => {
      updateStudentPersonalSidebar();
    }).catch(() => {});
  }

  // Eligibility
  let eligibilityBadge = '<span class="text-[11px] font-bold text-slate-500">Chưa xác định</span>';
  if (state.isEligible === true) {
    eligibilityBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đủ điều kiện</span>';
  } else if (state.isEligible === 'pending') {
    eligibilityBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">⏳ Chờ xác nhận</span>';
  } else if (state.isEligible === false) {
    eligibilityBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Chưa đủ ĐK</span>';
  }

  // Registration
  let regBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Chưa đăng ký</span>';
  if (state.myRegistration) {
    regBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã đăng ký</span>';
  } else if (state.activeRound?.status === 'open') {
    regBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">● Đang mở ĐK</span>';
  }

  // Assignment & Supervisor
  let supDisplay = 'Chưa phân công';
  let assignBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Chưa có</span>';
  
  const officialList = state.myRegistration ? getOfficialSupervisors(state.myRegistration) : [];
  if (officialList.length > 0) {
    const primary = officialList.find(s => s.role === 'primary') || officialList[0];
    supDisplay = primary.supervisorName || 'GVHD chính thức';
    assignBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã phân công</span>';
  } else if (state.myRegistration && (state.activeRound?.status === 'reviewing' || (state.activeRound?.reviewStatus && state.activeRound.reviewStatus.startsWith('round_')))) {
    assignBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">Đang xét duyệt</span>';
  }

  // Upcoming Submission
  let upcomingText = 'Không có mốc nộp bài sắp tới';
  let upcomingBadge = '';
  if (state.activeRound) {
    const activities = Array.isArray(state.activeRound.activities) ? state.activeRound.activities : [];
    const submissionActs = activities.filter(a => a.submissionEnabled && (a.closeAtDate || a.endDate || a.date));
    const now = new Date();
    const upcoming = submissionActs
      .map(a => ({
        title: a.title,
        deadline: a.closeAtDate ? new Date(a.closeAtDate) : (a.endDate ? new Date(a.endDate) : new Date(a.date))
      }))
      .filter(a => !isNaN(a.deadline.getTime()) && a.deadline >= now)
      .sort((a, b) => a.deadline - b.deadline)[0];

    if (upcoming) {
      upcomingText = `${upcoming.title}`;
      upcomingBadge = `<span class="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Hạn: ${fmtIsoToVietnameseDateTime(upcoming.deadline.toISOString())}</span>`;
    }
  }

  // Populate Modal Body
  if (modalBody) {
    modalBody.innerHTML = `
      <!-- Header -->
      <div class="flex items-center gap-3 pb-3 border-b border-slate-100">
        <img src="${avatarUrl}" class="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0" alt="Avatar">
        <div class="min-w-0 flex-1">
          <h3 class="font-bold text-sm text-slate-900 truncate leading-snug">${fullName}</h3>
          <p class="text-xs text-slate-500 font-mono">MSSV: <span class="font-bold text-tdtu-blue">${mssv}</span></p>
        </div>
      </div>

      <div class="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2.5">
        <div>
          <span class="font-black text-xs text-blue-900 block">Thông tin sinh viên tự cập nhật</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label class="text-[11px] font-bold text-slate-600">Lớp<input id="profile-current-class" maxlength="50" value="${escapeHtml(state.studentSelfProfile?.currentClass || state.myRegistration?.currentClass || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
          <label class="text-[11px] font-bold text-slate-600">Điện thoại<input id="profile-student-phone" maxlength="20" value="${escapeHtml(state.studentSelfProfile?.phone || state.myRegistration?.studentPhone || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
        </div>
        <label class="text-[11px] font-bold text-slate-600 block">Email cá nhân<input id="profile-personal-email" type="email" maxlength="120" value="${escapeHtml(state.studentSelfProfile?.personalEmail || state.myRegistration?.personalEmail || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
        <label class="text-[11px] font-bold text-slate-600 block">Địa chỉ thường trú<input id="profile-student-permanent-address" maxlength="250" value="${escapeHtml(state.studentSelfProfile?.permanentAddress || state.myRegistration?.studentPermanentAddress || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
        <label class="text-[11px] font-bold text-slate-600 block">Địa chỉ tạm trú<input id="profile-student-temporary-address" maxlength="250" value="${escapeHtml(state.studentSelfProfile?.temporaryAddress || state.myRegistration?.studentTemporaryAddress || state.studentSelfProfile?.address || state.myRegistration?.studentAddress || '')}" class="mt-1 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"></label>
        <button type="button" onclick="saveStudentSelfProfile()" class="w-full px-3 py-2 bg-tdtu-blue hover:bg-tdtu-dark text-white rounded-lg text-xs font-black">Lưu thông tin sinh viên</button>
      </div>

      <!-- Student Details -->
      <div class="space-y-2.5 text-xs">
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Lớp:</span>
          <span class="font-bold text-slate-800 font-mono">${studentClass}</span>
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Ngành:</span>
          <span class="font-bold text-slate-800">${major}</span>
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Điều kiện ĐATN:</span>
          ${eligibilityBadge}
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Trạng thái đăng ký:</span>
          ${regBadge}
        </div>
        <div class="flex items-center justify-between py-1 border-b border-slate-50">
          <span class="text-slate-500">Phân công GVHD:</span>
          ${assignBadge}
        </div>
        <div class="py-1 border-b border-slate-50">
          <div class="flex items-center justify-between">
            <span class="text-slate-500">GVHD chính:</span>
            <span class="font-bold text-slate-900">${supDisplay}</span>
          </div>
        </div>
        <div class="pt-1">
          <span class="text-slate-500 block mb-1">Mốc nộp bài gần nhất:</span>
          <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span class="font-bold text-slate-800 text-[11px] block">${upcomingText}</span>
            ${upcomingBadge ? `<div>${upcomingBadge}</div>` : ''}
          </div>
        </div>
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="text-[11px] text-slate-400">Tài khoản sinh viên</span>
          <button type="button" onclick="handleStudentLogout()" class="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    `;
  }
};

window.openStudentProfileModal = function() {
  updateStudentPersonalSidebar();
  const modal = document.getElementById('modal-student-profile');
  if (modal) modal.classList.remove('hidden');
};

window.closeStudentProfileModal = function() {
  const modal = document.getElementById('modal-student-profile');
  if (modal) modal.classList.add('hidden');
};

window.handleStudentLogout = async function() {
  try {
    await signOut(auth);
  } catch (e) {}
  window.location.reload();
};

window.updateTeacherPersonalModal = function() {
  const actor = getEffectiveActor();
  const modalBody = document.getElementById('teacher-profile-modal-body');
  if (!modalBody) return;

  const emailLower = (actor.email || '').toLowerCase().trim();
  const currentSup = (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower) ||
                    (state.supervisorsMaster || []).find(s => (s.email || '').toLowerCase().trim() === emailLower);
  
  const displayName = currentSup?.name || actor.displayName || 'Giảng viên';
  const email = currentSup?.email || actor.email || '--';
  const dept = currentSup?.department || 'Khoa Mỹ thuật Công nghiệp';
  const photoUrl = currentSup?.photoUrl || actor.photoURL || '';
  const avatarSrc = (photoUrl && photoUrl.trim()) ? photoUrl : getSupervisorAvatarSvgDataUri(displayName);

  let roleBadges = [];
  if (actor.isAdmin) roleBadges.push('<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Quản trị viên</span>');
  if (actor.isSupervisor || currentSup) roleBadges.push('<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Giảng viên Hướng dẫn</span>');
  roleBadges.push('<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Hội đồng / Đánh giá</span>');

  modalBody.innerHTML = `
    <div class="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
      <img src="${avatarSrc}" class="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" alt="${escapeHtml(displayName)}">
      <div class="min-w-0 flex-1">
        <h4 class="font-bold text-sm text-slate-900 truncate">${escapeHtml(displayName)}</h4>
        <p class="text-xs text-slate-500 font-mono truncate">${escapeHtml(email)}</p>
        <p class="text-[11px] text-tdtu-blue font-semibold mt-0.5">${escapeHtml(dept)}</p>
      </div>
    </div>

    <div class="space-y-2 text-xs">
      <div>
        <span class="text-slate-500 block mb-1 font-semibold">Vai trò hệ thống:</span>
        <div class="flex flex-wrap gap-1.5">${roleBadges.join('')}</div>
      </div>
      <div>
        <span class="text-slate-500 block mb-1 font-semibold">Đợt đang xem:</span>
        <span class="font-bold text-slate-800 block p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">${escapeHtml(state.activeRound?.title || '--')} (${escapeHtml(state.activeRound?.academicYear || '--')})</span>
      </div>
    </div>

    <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <a href="/graduation/" class="text-xs text-blue-600 font-bold hover:underline">🎓 Cổng SV</a>
        ${actor.isAdmin ? '<a href="/graduation/admin/" class="text-xs text-amber-600 font-bold hover:underline ml-2">⚙️ Quản trị</a>' : ''}
      </div>
      <button type="button" onclick="handleTeacherLogout()" class="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-200 cursor-pointer">
        <span>🚪</span>
        <span>Đăng xuất</span>
      </button>
    </div>
  `;
};

window.openTeacherProfileModal = function() {
  updateTeacherPersonalModal();
  const modal = document.getElementById('modal-teacher-profile');
  if (modal) modal.classList.remove('hidden');
};

window.closeTeacherProfileModal = function() {
  const modal = document.getElementById('modal-teacher-profile');
  if (modal) modal.classList.add('hidden');
};

window.handleTeacherLogout = async function() {
  try {
    await signOut(auth);
  } catch (e) {}
  window.location.reload();
};


// Global window bridges for cross-module accessibility
window.checkStudentEligibilityAndRegistration = checkStudentEligibilityAndRegistration;
window.renderStudentOfficialResult = renderStudentOfficialResult;
window.renderStudentExistingRegistration = renderStudentExistingRegistration;
window.applySupervisorAssignmentModeToRegistrationUI = applySupervisorAssignmentModeToRegistrationUI;
window.renderConfirmationPanel = renderConfirmationPanel;
window.removeVietnameseTones = removeVietnameseTones;
window.renderRoundModalEligibleTable = renderRoundModalEligibleTable;
window.renderAddEligibleCandidateResults = renderAddEligibleCandidateResults;
window.updateAddEligibleSelectionUI = updateAddEligibleSelectionUI;
window.renderAdminEligibleStudentsTable = renderAdminEligibleStudentsTable;
window.parseAndValidateExcel = parseAndValidateExcel;
window.renderAdminRegistrationsTable = renderAdminRegistrationsTable;
window.getIFAAFirebase = getIFAAFirebase;
window.openFacultyCache = openFacultyCache;
window.getFacultyCache = getFacultyCache;
window.setFacultyCache = setFacultyCache;
window.gunzipData = gunzipData;
window.updateFacultyStatusUI = updateFacultyStatusUI;
window.normalizeFacultyRows = normalizeFacultyRows;
window.loadFacultyDatasetFromIFAA = loadFacultyDatasetFromIFAA;
window.populateFacultyClassFilter = populateFacultyClassFilter;
window.applyFacultyFiltersAndRender = applyFacultyFiltersAndRender;
window.renderFacultyStudentsCurrentPage = renderFacultyStudentsCurrentPage;
window._getTimelineVisibleCount = _getTimelineVisibleCount;
window.renderSupervisorRoundTimeline = renderSupervisorRoundTimeline;
window.renderSupervisorPlanList = renderSupervisorPlanList;
window.positionStudentRegistrationCta = positionStudentRegistrationCta;
window.loadStudentSelfProfile = loadStudentSelfProfile;
window.getRegistrationStudentIdentity = getRegistrationStudentIdentity;
window.populateRegistrationStudentForm = populateRegistrationStudentForm;
window.collectOfficialFormFields = collectOfficialFormFields;
window.validateOfficialFormFields = validateOfficialFormFields;

window.IFAA_FIREBASE_CONFIG = IFAA_FIREBASE_CONFIG;
window.DEFAULT_IFAA_DATASET_URL = DEFAULT_IFAA_DATASET_URL;
window.BACKUP_IFAA_DATASET_URL = BACKUP_IFAA_DATASET_URL;
window.FACULTY_MAJORS = FACULTY_MAJORS;
