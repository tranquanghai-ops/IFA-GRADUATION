
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
    showToast(decision === 'approved' ? 'Đã duyệt tên đề tài.' : (decision === 'rejected' ? 'Đã gửi yêu cầu sinh viên chỉnh sửa tên đề tài.' : 'Đã hủy trạng thái duyệt tên đề tài.'), 'success');
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
  const btnCancelApproval = document.getElementById('btn-topic-preview-cancel-approval');
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
    if (btnCancelApproval) {
      if (isStudentViewer) {
        btnCancelApproval.classList.add('hidden');
      } else {
        btnCancelApproval.classList.remove('hidden');
      }
    }
    if (btnReject) {
      if (isStudentViewer) {
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
    if (btnCancelApproval) btnCancelApproval.classList.add('hidden');
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
      window.printOfficialTopicRegistrationPaper(studentId);
    };
  }

  // Handle start in edit mode if requested
  window.toggleTopicPreviewEditMode(Boolean(startInEditMode && isStudentViewer));

  modal.classList.remove('hidden');
};

window.toggleTopicPreviewEditMode = function(isEdit = true) {
  const modal = document.getElementById('modal-supervisor-topic-preview');
  if (!modal) return;
  const isStudent = Boolean(modal._isStudentViewer);
  if (isEdit && !isStudent) return;

  const titleTextEl = document.getElementById('topic-preview-doc-title');
  const titleEditWrap = document.getElementById('topic-preview-doc-title-edit-wrap');
  const titleInput = document.getElementById('topic-preview-edit-title');

  const descTextEl = document.getElementById('topic-preview-doc-description');
  const descEditWrap = document.getElementById('topic-preview-doc-desc-edit-wrap');
  const descInput = document.getElementById('topic-preview-edit-description');

  const btnEdit = document.getElementById('btn-topic-preview-student-edit');
  const btnSave = document.getElementById('btn-topic-preview-save-edit');
  const btnCancel = document.getElementById('btn-topic-preview-cancel-edit');
  const btnPdf = document.getElementById('btn-topic-preview-download-pdf');

  const footerSave = document.getElementById('btn-topic-preview-footer-save');
  const footerCancel = document.getElementById('btn-topic-preview-footer-cancel-edit');
  const footerClose = document.getElementById('btn-topic-preview-close');
  const footerNote = document.getElementById('topic-preview-footer-note');

  if (isEdit) {
    if (titleTextEl) titleTextEl.classList.add('hidden');
    if (titleEditWrap) titleEditWrap.classList.remove('hidden');
    if (titleInput) {
      const currentTitle = modal._currentRegistration?.topicTitle || (titleTextEl?.textContent !== '--' ? titleTextEl?.textContent : '') || '';
      titleInput.value = currentTitle;
      setTimeout(() => titleInput.focus(), 100);
    }

    if (descTextEl) descTextEl.classList.add('hidden');
    if (descEditWrap) descEditWrap.classList.remove('hidden');
    if (descInput) {
      const currentDesc = modal._currentRegistration?.topicDescription || (descTextEl?.textContent !== '--' ? descTextEl?.textContent : '') || '';
      descInput.value = currentDesc;
    }

    if (btnEdit) btnEdit.classList.add('hidden');
    if (btnSave) btnSave.classList.remove('hidden');
    if (btnCancel) btnCancel.classList.remove('hidden');
    if (btnPdf) btnPdf.classList.add('hidden');

    if (footerSave) footerSave.classList.remove('hidden');
    if (footerCancel) footerCancel.classList.remove('hidden');
    if (footerClose) footerClose.classList.add('hidden');

    if (footerNote) {
      footerNote.textContent = '✏️ Chế độ sửa: Chỉ mở khóa chỉnh sửa Tên đề tài và Mô tả định hướng thiết kế. Các thông tin hành chính khác được bảo lưu.';
    }
  } else {
    if (titleTextEl) titleTextEl.classList.remove('hidden');
    if (titleEditWrap) titleEditWrap.classList.add('hidden');

    if (descTextEl) descTextEl.classList.remove('hidden');
    if (descEditWrap) descEditWrap.classList.add('hidden');

    if (btnEdit) btnEdit.classList.toggle('hidden', !isStudent);
    if (btnSave) btnSave.classList.add('hidden');
    if (btnCancel) btnCancel.classList.add('hidden');
    if (btnPdf) btnPdf.classList.remove('hidden');

    if (footerSave) footerSave.classList.add('hidden');
    if (footerCancel) footerCancel.classList.add('hidden');
    if (footerClose) footerClose.classList.remove('hidden');

    const st = modal._currentRegistration || {};
    const status = st?.topicApprovalStatus || 'pending';
    if (footerNote) {
      if (status === 'approved') {
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
    if (typeof renderStudentTimelineWeeks === 'function') {
      renderStudentTimelineWeeks();
    }

    showToast(`🎉 Đã cập nhật phiếu đăng ký (Lần ${nextVersion}) và chuyển GVHD duyệt lại!`, 'success');
  } catch (err) {
    console.error('Lỗi khi lưu phiếu đăng ký:', err);
    showToast('Lỗi khi lưu phiếu đăng ký: ' + err.message, 'error');
  } finally {
    if (btnSaveTop) { btnSaveTop.disabled = false; btnSaveTop.innerHTML = '<span>💾</span> <span>Lưu & Gửi duyệt lại</span>'; }
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


