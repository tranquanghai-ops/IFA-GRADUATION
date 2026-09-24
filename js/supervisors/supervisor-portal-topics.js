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

