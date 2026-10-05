
// --- Module Bridges ---
const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : []);
/**
 * IFA+ Graduation — Supervisor Topic Review & Preview
 */
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
  } else if (decision === 'cancel' || decision === 'pending') {
    if (!await showConfirm('Hủy duyệt tên đề tài', `Bạn có chắc chắn muốn hủy trạng thái đã duyệt của đề tài “${registration.topicTitle}” để chuyển về chờ duyệt?`, { confirmText: 'Hủy duyệt đề tài', danger: true })) {
      return;
    }
    decision = 'pending';
    note = 'Đã hủy duyệt đề tài';
  } else if (!await showConfirm('Duyệt tên đề tài', `Duyệt tên đề tài “${registration.topicTitle}”?`, { confirmText: 'Duyệt đề tài', danger: false })) {
    return;
  }

  const actor = getEffectiveActor();
  const version = Number(registration.topicTitleVersion || 1);
  const history = Array.isArray(registration.topicTitleHistory) ? [...registration.topicTitleHistory] : [];
  const idx = history.findIndex(item => Number(item.version) === version);
  const reviewedEntry = {
    ...(idx >= 0 ? history[idx] : { version, title: registration.topicTitle, submittedAt: new Date().toISOString() }),
    version,
    title: registration.topicTitle,
    topicDescription: registration.topicDescription || '',
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
    if (typeof window.trackUserActivity === 'function') {
      const actionText = decision === 'approved' ? `Duyệt đề tài SV ${studentId}` : (decision === 'rejected' ? `Yêu cầu SV ${studentId} sửa đề tài` : `Hủy duyệt đề tài SV ${studentId}`);
      window.trackUserActivity(actionText, { context: registration.topicTitle });
    }
    renderSupervisorAssignedStudents();
    showToast(decision === 'approved' ? 'Đã duyệt tên đề tài.' : (decision === 'rejected' ? 'Đã gửi yêu cầu sinh viên chỉnh sửa tên đề tài.' : 'Đã hủy trạng thái duyệt tên đề tài.'), 'success');
  } catch (err) {
    console.error('Topic title review failed:', err);
    showToast('Không thể lưu quyết định duyệt: ' + err.message, 'error');
  }
};


window.openTopicRegistrationPreviewModal = function(studentId = null, startInEditMode = false, targetVersion = null) {
  const modal = document.getElementById('modal-supervisor-topic-preview');
  if (!modal) return;

  const round = state.activeRound || {};
  let st = null;
  let identity = null;
  let isStudentViewer = false;

  const isCurrentStudentRole = Boolean(
    state.currentRole === 'student' ||
    state.currentView === 'student' ||
    state.role === 'student' ||
    state.isStudent ||
    state.impersonation?.target?.type === 'student'
  );

  if (!studentId || (typeof studentId === 'string' && (studentId === state.myRegistration?.studentId || studentId === state.studentMssv))) {
    st = state.myRegistration;
    identity = (typeof getRegistrationStudentIdentity === 'function') ? getRegistrationStudentIdentity() : null;
    studentId = identity?.mssv || st?.studentId || st?.mssv || state.studentMssv;
    isStudentViewer = isCurrentStudentRole;
  } else {
    st = (state.supervisorAssignedStudents || []).find(s => (s.studentId || s.id) === studentId) ||
      (typeof findStudentInRound === 'function' ? findStudentInRound(studentId) : null);
    isStudentViewer = isCurrentStudentRole && !state.isAdmin;
  }

  if (!st && studentId) {
    st = (typeof findStudentInRound === 'function' ? findStudentInRound(studentId) : null);
  }

  if (!st) {
    showToast('Không tìm thấy thông tin đăng ký của sinh viên.', 'warning');
    return;
  }

  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(studentId) : null;
  const fullName = (typeof window.resolveOfficialStudentFullName === 'function')
    ? window.resolveOfficialStudentFullName(studentId, st, studentObj)
    : (st?.studentName || identity?.fullName || (studentObj && !studentObj.isMissing ? studentObj.fullName : '') || studentId);
  const className = st?.currentClass || st?.studentClass || st?.className || studentObj?.className || studentObj?.studentClass || '--';
  const major = st?.major || studentObj?.major || identity?.major || 'Thiết kế nội thất';
  const personalEmail = st?.personalEmail || st?.email || studentObj?.email || identity?.email || '--';
  const phone = st?.studentPhone || studentObj?.phone || '--';
  const address = (typeof getCleanRegistrationAddress === 'function') ? getCleanRegistrationAddress(st, studentObj) : (st?.address || '--');
  const courseName = st?.courseName || 'Đồ án tốt nghiệp';
  const courseCode = st?.courseCode || '--';
  const courseGroup = st?.courseGroup || '--';

  const approvedVersions = (typeof window.getApprovedTopicVersions === 'function')
    ? window.getApprovedTopicVersions(st)
    : [];

  let viewingVersion = Number(st?.topicTitleVersion || 1);
  let topicTitle = st?.topicTitle || 'Chưa đăng ký đề tài';
  let topicDescription = st?.topicDescription || '(Chưa có mô tả định hướng thiết kế)';
  let isViewingPastVersion = false;
  let status = st?.topicApprovalStatus || 'pending';

  if (targetVersion) {
    const matched = approvedVersions.find(v => Number(v.version) === Number(targetVersion)) ||
      (Array.isArray(st.topicTitleHistory) ? st.topicTitleHistory.find(h => Number(h.version) === Number(targetVersion)) : null);
    if (matched) {
      viewingVersion = Number(matched.version);
      topicTitle = matched.title || topicTitle;
      topicDescription = matched.topicDescription || topicDescription;
      status = (matched.status === 'approved') ? 'approved' : status;
      isViewingPastVersion = (viewingVersion !== Number(st?.topicTitleVersion || 1));
    }
  }

  modal._approvedVersions = approvedVersions;
  modal._viewingVersion = viewingVersion;
  modal._isViewingPastVersion = isViewingPastVersion;

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
  setEl('topic-preview-doc-version', `Đăng ký đề tài chính thức lần thứ : ${viewingVersion}`);
  setEl('topic-preview-doc-title', topicTitle);
  setEl('topic-preview-doc-description', topicDescription);
  setEl('topic-preview-doc-sign-student', fullName);
  setEl('topic-preview-doc-date', `Tp.HCM, ngày ${dd} tháng ${mm} năm ${yyyy}`);

  // Supervisor info
  const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : [];
  const primary = officials.find(s => s.role === 'primary') || officials[0];
  const supName = (typeof window.resolveOfficialSupervisorName === 'function')
    ? window.resolveOfficialSupervisorName(st)
    : (primary?.supervisorName || st.acceptedSupervisorName || 'Giảng viên Hướng dẫn');
  setEl('topic-preview-doc-sup-name', supName);

  // Version selector in header
  const versionSelectorWrap = document.getElementById('topic-preview-version-selector-wrap');
  const versionBtnText = document.getElementById('topic-preview-version-btn-text');
  const versionDropdown = document.getElementById('topic-preview-version-dropdown');

  if (approvedVersions.length > 1) {
    if (versionSelectorWrap) versionSelectorWrap.classList.remove('hidden');
    if (versionBtnText) versionBtnText.textContent = `Phiếu ĐK lần ${viewingVersion}`;
    if (versionDropdown) {
      const sortedVersions = [...approvedVersions].sort((a, b) => b.version - a.version);
      versionDropdown.innerHTML = sortedVersions.map(v => `
        <button type="button" onclick="openTopicRegistrationPreviewModal('${studentId}', false, ${v.version}); document.getElementById('topic-preview-version-dropdown').classList.add('hidden');" class="w-full text-left px-3.5 py-2 hover:bg-slate-100 transition flex items-center justify-between gap-2 cursor-pointer ${v.version === viewingVersion ? 'bg-blue-50/70 font-bold text-tdtu-blue' : 'text-slate-700'}">
          <span>📄 Phiếu ĐK lần ${v.version}</span>
          ${v.version === Number(st.topicTitleVersion || 1) ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Mới nhất</span>' : ''}
        </button>
      `).join('');
    }
  } else {
    if (versionSelectorWrap) versionSelectorWrap.classList.add('hidden');
  }

  // Status badge & sup status in document
  const badgeEl = document.getElementById('topic-preview-status-badge');
  const docSupStatusEl = document.getElementById('topic-preview-doc-sup-status');
  const footerNoteEl = document.getElementById('topic-preview-footer-note');
  const btnApprove = document.getElementById('btn-topic-preview-approve');
  const btnReject = document.getElementById('btn-topic-preview-reject');
  const btnCancelApproval = document.getElementById('btn-topic-preview-cancel-approval');
  const btnStudentEdit = document.getElementById('btn-topic-preview-student-edit');

  // Role-based button visibility
  if (btnStudentEdit) {
    btnStudentEdit.classList.toggle('hidden', !isStudentViewer || isViewingPastVersion);
  }

  if (status === 'approved') {
    if (badgeEl) {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
      badgeEl.textContent = '✓ Đã duyệt đề tài';
    }
    if (docSupStatusEl) {
      docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-emerald-700 italic';
      docSupStatusEl.textContent = '✓ Đã duyệt đề tài';
      docSupStatusEl.classList.remove('hidden');
    }
    if (footerNoteEl) {
      if (isViewingPastVersion) {
        footerNoteEl.textContent = `📌 Bạn đang xem Phiếu đăng ký đề tài đã duyệt lần ${viewingVersion}.`;
      } else {
        footerNoteEl.textContent = isStudentViewer
          ? `Tên đề tài của bạn đã được GVHD phê duyệt${st.topicReviewedAt ? ' lúc ' + fmtIsoToVietnameseDateTime(st.topicReviewedAt) : ''}.`
          : `Tên đề tài đã được GVHD phê duyệt${st.topicReviewedAt ? ' lúc ' + fmtIsoToVietnameseDateTime(st.topicReviewedAt) : ''}.`;
      }
    }
    if (btnApprove) btnApprove.classList.add('hidden');
    if (btnCancelApproval) {
      if (isStudentViewer || isViewingPastVersion) {
        btnCancelApproval.classList.add('hidden');
      } else {
        btnCancelApproval.classList.remove('hidden');
      }
    }
    if (btnReject) {
      if (isStudentViewer || isViewingPastVersion) {
        btnReject.classList.add('hidden');
      } else {
        btnReject.classList.remove('hidden');
        btnReject.innerHTML = '<span>🔄</span> <span>Yêu cầu sửa lại</span>';
      }
    }
  } else if (status === 'rejected') {
    if (btnCancelApproval) btnCancelApproval.classList.add('hidden');
    if (badgeEl) {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300';
      badgeEl.textContent = '✕ Yêu cầu chỉnh sửa';
    }
    if (docSupStatusEl) {
      docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-rose-700 italic';
      docSupStatusEl.textContent = `✕ Yêu cầu chỉnh sửa: ${st.topicApprovalNote || ''}`;
      docSupStatusEl.classList.remove('hidden');
    }
    if (footerNoteEl) {
      footerNoteEl.textContent = isStudentViewer
        ? `GVHD yêu cầu chỉnh sửa: "${st.topicApprovalNote || ''}". Vui lòng sửa lại tên đề tài.`
        : `Đã yêu cầu sinh viên chỉnh sửa: "${st.topicApprovalNote || ''}".`;
    }
    if (btnApprove) {
      if (isStudentViewer || isViewingPastVersion) {
        btnApprove.classList.add('hidden');
      } else {
        btnApprove.classList.remove('hidden');
        btnApprove.innerHTML = '<span>✓</span> <span>Duyệt tên đề tài</span>';
      }
    }
    if (btnReject) btnReject.classList.add('hidden');
  } else {
    if (btnCancelApproval) btnCancelApproval.classList.add('hidden');
    if (badgeEl) {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300';
      badgeEl.textContent = '⌛ Chờ duyệt tên đề tài';
    }
    if (docSupStatusEl) {
      docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-amber-700 italic';
      docSupStatusEl.textContent = '(Chờ GVHD xem xét & ký duyệt)';
      docSupStatusEl.classList.remove('hidden');
    }
    if (footerNoteEl) {
      footerNoteEl.textContent = isStudentViewer
        ? 'Phiếu đăng ký đang chờ GVHD xem xét & ký duyệt chính thức.'
        : 'GVHD xem xét nội dung phiếu đăng ký và xác nhận duyệt hoặc yêu cầu chỉnh sửa.';
    }
    if (btnApprove) {
      if (isStudentViewer || isViewingPastVersion) {
        btnApprove.classList.add('hidden');
      } else {
        btnApprove.classList.remove('hidden');
        btnApprove.innerHTML = '<span>✓</span> <span>Duyệt tên đề tài</span>';
      }
    }
    if (btnReject) {
      if (isStudentViewer || isViewingPastVersion) {
        btnReject.classList.add('hidden');
      } else {
        btnReject.classList.remove('hidden');
        btnReject.innerHTML = '<span>✕</span> <span>Không duyệt (Yêu cầu sửa)</span>';
      }
    }
  }

  modal._currentStudentId = studentId;
  modal._currentRegistration = st;
  modal._isStudentViewer = isStudentViewer;

  // Bind actions
  if (btnApprove && !isStudentViewer) {
    btnApprove.onclick = async () => {
      await window.reviewStudentTopicTitle(studentId, 'approved');
      window.openTopicRegistrationPreviewModal(studentId);
    };
  }
  if (btnCancelApproval && !isStudentViewer) {
    btnCancelApproval.onclick = async () => {
      await window.reviewStudentTopicTitle(studentId, 'cancel');
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
      const activeVer = modal?._viewingVersion || viewingVersion || null;
      if (typeof window.downloadOfficialTopicRegistrationPdf === 'function') {
        window.downloadOfficialTopicRegistrationPdf(studentId, activeVer);
      } else if (typeof window.printOfficialTopicRegistrationPaper === 'function') {
        window.printOfficialTopicRegistrationPaper(studentId);
      }
    };
  }

  // Handle start in edit mode if requested
  window.toggleTopicPreviewEditMode(Boolean(startInEditMode && isStudentViewer && !isViewingPastVersion));

  modal.classList.remove('hidden');
};

window.toggleModalVersionDropdown = function(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  const dropdown = document.getElementById('topic-preview-version-dropdown');
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains('hidden');
  if (!isHidden) {
    dropdown.classList.add('hidden');
    return;
  }
  dropdown.classList.remove('hidden');
  const close = (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 10);
};

window.toggleTopicPreviewEditMode = function(isEdit = true) {
  const modal = document.getElementById('modal-supervisor-topic-preview');
  if (!modal) return;
  const isStudent = Boolean(modal._isStudentViewer);
  if (isEdit && (!isStudent || modal._isViewingPastVersion)) return;

  const titleTextEl = document.getElementById('topic-preview-doc-title');
  const titleEditWrap = document.getElementById('topic-preview-doc-title-edit-wrap');
  const titleInput = document.getElementById('topic-preview-edit-title');

  const descTextEl = document.getElementById('topic-preview-doc-description');
  const descEditWrap = document.getElementById('topic-preview-doc-desc-edit-wrap');
  const descInput = document.getElementById('topic-preview-edit-description');

  const btnEdit = document.getElementById('btn-topic-preview-student-edit');
  const btnPdf = document.getElementById('btn-topic-preview-download-pdf');

  const footerSave = document.getElementById('btn-topic-preview-footer-save');
  const footerCancel = document.getElementById('btn-topic-preview-footer-cancel-edit');
  const footerClose = document.getElementById('btn-topic-preview-close');
  const footerNote = document.getElementById('topic-preview-footer-note');

  const btnApprove = document.getElementById('btn-topic-preview-approve');
  const btnReject = document.getElementById('btn-topic-preview-reject');
  const btnCancelApproval = document.getElementById('btn-topic-preview-cancel-approval');

  const docSupStatusEl = document.getElementById('topic-preview-doc-sup-status');
  const versionSelectorWrap = document.getElementById('topic-preview-version-selector-wrap');

  const st = modal._currentRegistration || state.myRegistration || {};
  const wasApproved = (st.topicApprovalStatus === 'approved' || st.approvalStatus === 'approved');
  const currentVersion = Number(st.topicTitleVersion || 1);
  const versionEl = document.getElementById('topic-preview-doc-version');

  if (isEdit) {
    const displayVersion = wasApproved ? (currentVersion + 1) : currentVersion;
    if (versionEl) {
      versionEl.textContent = `Đăng ký đề tài chính thức lần thứ : ${displayVersion}`;
    }

    if (titleTextEl) {
      titleTextEl.classList.add('hidden');
      titleTextEl.style.display = 'none';
    }
    if (titleEditWrap) {
      titleEditWrap.classList.remove('hidden');
      titleEditWrap.style.display = 'block';
    }
    if (titleInput) {
      const currentTitle = modal._currentRegistration?.topicTitle || (titleTextEl?.textContent !== '--' ? titleTextEl?.textContent : '') || '';
      titleInput.value = currentTitle;
      setTimeout(() => titleInput.focus(), 100);
    }

    if (descTextEl) {
      descTextEl.classList.add('hidden');
      descTextEl.style.display = 'none';
    }
    if (descEditWrap) {
      descEditWrap.classList.remove('hidden');
      descEditWrap.style.display = 'block';
    }
    if (descInput) {
      const currentDesc = modal._currentRegistration?.topicDescription || (descTextEl?.textContent !== '--' ? descTextEl?.textContent : '') || '';
      descInput.value = currentDesc;
    }

    // Hide supervisor status in edit mode (requirement: "khi GVHD đã duyệt tên đề tài mà sv bấm sửa. thì không ghi GVHD đã duyệt tên đề tài bên dưới ý kiến GVHD")
    if (docSupStatusEl) {
      docSupStatusEl.classList.add('hidden');
      docSupStatusEl.textContent = '';
    }
    if (versionSelectorWrap) versionSelectorWrap.classList.add('hidden');

    if (btnEdit) btnEdit.classList.add('hidden');
    if (btnPdf) btnPdf.classList.add('hidden');

    if (footerSave) footerSave.classList.remove('hidden');
    if (footerCancel) footerCancel.classList.remove('hidden');
    if (footerClose) footerClose.classList.add('hidden');

    if (btnApprove) btnApprove.classList.add('hidden');
    if (btnReject) btnReject.classList.add('hidden');
    if (btnCancelApproval) btnCancelApproval.classList.add('hidden');

    if (footerNote) {
      footerNote.textContent = '✏️ Chế độ sửa: Chỉ mở khóa chỉnh sửa Tên đề tài và Mô tả định hướng thiết kế. Các thông tin hành chính khác được bảo lưu.';
    }
  } else {
    if (versionEl) {
      versionEl.textContent = `Đăng ký đề tài chính thức lần thứ : ${modal._viewingVersion || currentVersion}`;
    }

    if (titleTextEl) {
      titleTextEl.classList.remove('hidden');
      titleTextEl.style.display = '';
    }
    if (titleEditWrap) {
      titleEditWrap.classList.add('hidden');
      titleEditWrap.style.display = 'none';
    }

    if (descTextEl) {
      descTextEl.classList.remove('hidden');
      descTextEl.style.display = '';
    }
    if (descEditWrap) {
      descEditWrap.classList.add('hidden');
      descEditWrap.style.display = 'none';
    }

    if (btnEdit) btnEdit.classList.toggle('hidden', !isStudent || modal._isViewingPastVersion);
    if (btnPdf) btnPdf.classList.remove('hidden');

    if (footerSave) footerSave.classList.add('hidden');
    if (footerCancel) footerCancel.classList.add('hidden');
    if (footerClose) footerClose.classList.remove('hidden');

    if (isStudent) {
      if (btnApprove) btnApprove.classList.add('hidden');
      if (btnReject) btnReject.classList.add('hidden');
      if (btnCancelApproval) btnCancelApproval.classList.add('hidden');
    }

    const status = st?.topicApprovalStatus || 'pending';
    const isApproved = (status === 'approved' || modal._isViewingPastVersion);

    // Restore supervisor status when viewing
    if (docSupStatusEl) {
      if (isApproved) {
        docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-emerald-700 italic';
        docSupStatusEl.textContent = '✓ Đã duyệt đề tài';
        docSupStatusEl.classList.remove('hidden');
      } else if (status === 'rejected') {
        docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-rose-700 italic';
        docSupStatusEl.textContent = `✕ Yêu cầu chỉnh sửa: ${st.topicApprovalNote || ''}`;
        docSupStatusEl.classList.remove('hidden');
      } else {
        docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-amber-700 italic';
        docSupStatusEl.textContent = '(Chờ GVHD xem xét & ký duyệt)';
        docSupStatusEl.classList.remove('hidden');
      }
    }

    if (modal._approvedVersions && modal._approvedVersions.length > 1 && versionSelectorWrap) {
      versionSelectorWrap.classList.remove('hidden');
    }

    if (footerNote) {
      if (modal._isViewingPastVersion) {
        footerNote.textContent = `📌 Bạn đang xem Phiếu đăng ký đề tài đã duyệt lần ${modal._viewingVersion}.`;
      } else if (status === 'approved') {
        footerNote.textContent = `Tên đề tài của bạn đã được GVHD phê duyệt${st.topicReviewedAt ? ' lúc ' + fmtIsoToVietnameseDateTime(st.topicReviewedAt) : ''}.`;
      } else if (status === 'rejected') {
        footerNote.textContent = `GVHD yêu cầu chỉnh sửa: "${st.topicApprovalNote || ''}". Vui lòng sửa lại tên đề tài.`;
      } else {
        footerNote.textContent = 'Phiếu đăng ký đang chờ GVHD xem xét & ký duyệt chính thức.';
      }
    }
  }
};

window.saveTopicPreviewEdits = async function() {
  if (!checkImpersonationWriteGuard('Chỉnh sửa phiếu đăng ký')) return;

  const modal = document.getElementById('modal-supervisor-topic-preview');
  const roundId = state.selectedRoundId || state.activeRound?.id;
  const reg = state.myRegistration || modal?._currentRegistration;
  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const mssv = modal?._currentStudentId || state.studentMssv || reg?.studentId || reg?.mssv;

  if (!reg || !roundId || !mssv) {
    showToast('Không xác định được thông tin sinh viên hoặc đợt tốt nghiệp.', 'error');
    return;
  }

  const titleInput = document.getElementById('topic-preview-edit-title');
  const descInput = document.getElementById('topic-preview-edit-description');
  const newTitle = (titleInput?.value || '').trim();
  const newDesc = (descInput?.value || '').trim();

  if (!newTitle) {
    showToast('Vui lòng nhập tên đề tài.', 'warning');
    titleInput?.focus();
    return;
  }

  if (!newTitle.toLowerCase().startsWith('thiết kế nội thất')) {
    showToast('Tên đề tài BẮT BUỘC phải bắt đầu bằng cụm từ "Thiết kế nội thất".', 'error');
    titleInput?.focus();
    return;
  }

  if (newTitle.length < 10) {
    showToast('Tên đề tài quá ngắn. Vui lòng nhập đầy đủ tên đề tài.', 'warning');
    titleInput?.focus();
    return;
  }

  if (!newDesc) {
    showToast('Vui lòng nhập mô tả chi tiết định hướng thiết kế.', 'warning');
    descInput?.focus();
    return;
  }

  const btnSaveTop = document.getElementById('btn-topic-preview-save-edit');
  const btnSaveBottom = document.getElementById('btn-topic-preview-footer-save');
  if (btnSaveTop) { btnSaveTop.disabled = true; btnSaveTop.textContent = '⏳ Đang lưu...'; }
  if (btnSaveBottom) { btnSaveBottom.disabled = true; btnSaveBottom.textContent = '⏳ Đang lưu...'; }

  try {
    const wasApproved = (reg.topicApprovalStatus === 'approved' || reg.approvalStatus === 'approved');
    const currentVersion = Number(reg.topicTitleVersion || 1);
    const nextVersion = wasApproved ? (currentVersion + 1) : currentVersion;
    const previousHistory = Array.isArray(reg.topicTitleHistory) ? reg.topicTitleHistory : [];

    const historyEntry = {
      version: nextVersion,
      title: newTitle,
      topicDescription: newDesc,
      submittedAt: new Date().toISOString(),
      status: 'pending'
    };
    const topicTitleHistory = wasApproved || previousHistory.length === 0
      ? previousHistory.concat([historyEntry])
      : previousHistory.slice(0, -1).concat([historyEntry]);

    const updatePayload = {
      topicTitle: newTitle,
      topicDescription: newDesc,
      topicTitleVersion: nextVersion,
      topicTitleHistory: topicTitleHistory,
      topicApprovalStatus: 'pending',
      topicApprovalNote: '',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor?.email || state.user?.email || mssv
    };

    await updateDoc(doc(db, 'graduationRounds', roundId, 'registrations', mssv), updatePayload);
    await setDoc(doc(db, 'graduationStudentProfiles', mssv), {
      topicDescription: newDesc,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});

    state.myRegistration = {
      ...reg,
      ...updatePayload,
      submittedAt: new Date(),
      updatedAt: new Date()
    };
    if (modal) modal._currentRegistration = state.myRegistration;

    // Update DOM paper fields
    const titleTextEl = document.getElementById('topic-preview-doc-title');
    const descTextEl = document.getElementById('topic-preview-doc-description');
    const versionEl = document.getElementById('topic-preview-doc-version');
    const badgeEl = document.getElementById('topic-preview-status-badge');
    const docSupStatusEl = document.getElementById('topic-preview-doc-sup-status');

    if (titleTextEl) titleTextEl.textContent = newTitle;
    if (descTextEl) descTextEl.textContent = newDesc;
    if (versionEl) versionEl.textContent = `Đăng ký đề tài chính thức lần thứ : ${nextVersion}`;
    if (badgeEl) {
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300';
      badgeEl.textContent = '⌛ Chờ duyệt tên đề tài';
    }
    if (docSupStatusEl) {
      docSupStatusEl.className = 'mt-1.5 text-xs font-bold text-amber-700 italic';
      docSupStatusEl.textContent = '(Chờ GVHD xem xét & ký duyệt)';
    }

    window.toggleTopicPreviewEditMode(false);

    if (typeof renderRoundHeader === 'function' && state.activeRound) {
      renderRoundHeader(state.activeRound);
    }
    if (typeof renderStudentExistingRegistration === 'function' && state.myRegistration) {
      renderStudentExistingRegistration(state.myRegistration);
    }
    if (typeof renderStudentTimelineWeeks === 'function') {
      renderStudentTimelineWeeks();
    }

    showToast(`🎉 Đã cập nhật phiếu đăng ký (Lần ${nextVersion}) và chuyển GVHD duyệt lại!`, 'success');
  } catch (err) {
    console.error('Lỗi khi lưu phiếu đăng ký:', err);
    showToast('Lỗi khi lưu phiếu đăng ký: ' + err.message, 'error');
  } finally {
    if (btnSaveTop) { btnSaveTop.disabled = false; btnSaveTop.innerHTML = '<span>💾</span> <span>Lưu & Gửi GVHD duyệt lại</span>'; }
    if (btnSaveBottom) { btnSaveBottom.disabled = false; btnSaveBottom.innerHTML = '<span>💾</span> <span>Lưu & Gửi GVHD duyệt lại</span>'; }
  }
};

window.closeTopicRegistrationPreviewModal = function() {
  const modal = document.getElementById('modal-supervisor-topic-preview');
  if (modal) modal.classList.add('hidden');
};

window.unlockSupervisorStudentTopic = async function(studentId) {
  if (!checkImpersonationWriteGuard('Mở khóa đề tài cho sinh viên')) return;
  const registration = (state.supervisorAssignedStudents || []).find(st => (st.studentId || st.id) === studentId) ||
    (typeof findStudentInRound === 'function' ? findStudentInRound(studentId) : null);
  if (!registration) {
    showToast('Không tìm thấy thông tin sinh viên.', 'error');
    return;
  }
  const confirmed = await showConfirm(
    'Mở khóa đề tài cho sinh viên',
    `Bạn có chắc chắn muốn mở khóa đề tài “${registration.topicTitle || ''}” cho sinh viên ${registration.studentName || studentId} chỉnh sửa? Thao tác này sẽ thu hồi quyền đã duyệt của GVHD để sinh viên cập nhật lại.`,
    { confirmText: 'Mở khóa', danger: true }
  );
  if (!confirmed) return;
  await window.reviewStudentTopicTitle(studentId, 'cancel');
};

window.openSupervisorTopicFormPreview = window.openTopicRegistrationPreviewModal;


