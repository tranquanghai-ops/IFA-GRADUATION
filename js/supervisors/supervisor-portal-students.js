
// --- Module Bridges ---
const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : []);
const isDirectSupervisorAssignment = (rnd) => (typeof window !== 'undefined' && window.isDirectSupervisorAssignment ? window.isDirectSupervisorAssignment(rnd) : false);
/**
 * IFA+ Graduation — Supervisor Assigned Students & Detail Modal
 */
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
            
            <div class="mt-1.5 flex flex-wrap items-center gap-2">
              <span class="text-xs font-bold text-slate-500 shrink-0">Đề tài:</span>
              <span class="text-sm sm:text-base font-black text-slate-900 leading-snug">${escapeHtml(topicTitle)}</span>
              ${hasRegistration ? topicApprovalBadge : ''}
              ${hasRegistration ? `<button type="button" onclick="openTopicRegistrationPreviewModal('${studentId}')" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-tdtu-blue border border-slate-200 shadow-2xs transition cursor-pointer" title="Bấm để xem lại phiếu đăng ký đề tài PDF">📄 Phiên bản ${topicVersion}</button>` : ''}
            </div>

            <div class="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-slate-500">
              <span>Loại hình: <b class="text-slate-700">${escapeHtml(projectType)}</b></span>
              <span>•</span>
              <span>${submissionStatusStr}</span>
            </div>
          </div>
        </div>

        <!-- Right: Guidance actions only; scoring belongs to the Assessment portal. -->
        <div class="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" onclick="openSupervisorStudentDetailModal('${studentId}', 'profile')" class="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer" title="Xem hồ sơ chi tiết sinh viên và đề tài">
              <span>📋</span> <span>Xem hồ sơ</span>
            </button>
            <button type="button" onclick="openSupervisorStudentDetailModal('${studentId}', 'progress')" class="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer" title="Xem tiến độ và mốc kế hoạch">
              <span>📅</span> <span>Tiến độ</span>
            </button>
            ${hasRegistration ? (
              topicApprovalStatus === 'approved'
                ? `<button type="button" onclick="openTopicRegistrationPreviewModal('${studentId}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer" title="Xem phiếu đăng ký và trạng thái đã duyệt (cho phép hủy duyệt nếu bấm nhầm)">
                    <span>✓</span> <span>Đã duyệt đề tài</span>
                  </button>`
                : `<button type="button" onclick="openTopicRegistrationPreviewModal('${studentId}')" class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer" title="Xem phiếu đăng ký và duyệt tên đề tài">
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

window.switchSupervisorDetailModalTab = function(tabKey = 'profile') {
  const tabProfileBtn = document.getElementById('tab-btn-dtl-profile');
  const tabProgressBtn = document.getElementById('tab-btn-dtl-progress');
  const contentProfile = document.getElementById('dtl-tab-content-profile');
  const contentProgress = document.getElementById('dtl-tab-content-progress');

  if (tabKey === 'progress') {
    if (tabProfileBtn) {
      tabProfileBtn.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-white/60 transition cursor-pointer';
    }
    if (tabProgressBtn) {
      tabProgressBtn.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs bg-white text-tdtu-blue shadow-xs border border-blue-200 transition cursor-pointer';
    }
    if (contentProfile) contentProfile.classList.add('hidden');
    if (contentProgress) contentProgress.classList.remove('hidden');
  } else {
    if (tabProfileBtn) {
      tabProfileBtn.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs bg-white text-tdtu-blue shadow-xs border border-blue-200 transition cursor-pointer';
    }
    if (tabProgressBtn) {
      tabProgressBtn.className = 'px-3.5 py-1.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-white/60 transition cursor-pointer';
    }
    if (contentProfile) contentProfile.classList.remove('hidden');
    if (contentProgress) contentProgress.classList.add('hidden');
  }
};

window.openSupervisorStudentDetailModal = function(studentId, focusSection = null) {
  const modal = document.getElementById('supervisor-student-detail-modal');
  if (!modal) return;

  window.switchSupervisorDetailModalTab(focusSection === 'progress' ? 'progress' : 'profile');

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
