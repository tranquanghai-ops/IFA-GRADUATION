/**
 * IFA+ Graduation — Round Self-Join Link Subsystem
 * Allows students to self-join a graduation round via a secure dedicated link.
 * Handles Admin join link modal, link toggle, and Student self-join validation & registration.
 */

// --- Admin: Join Link Modal & Toggle ---

window.openRoundJoinLinkModal = async function(roundId) {
  const targetId = roundId || document.getElementById('admin-round-student-select')?.value || state.selectedRoundId || state.activeRound?.id;
  if (!targetId) {
    showToast('Vui lòng chọn đợt tốt nghiệp trước khi cấu hình link.', 'warning');
    return;
  }

  // Find round in memory or fetch from Firestore
  let round = (state.rounds || []).find(r => r.id === targetId);
  if (!round) {
    try {
      const snap = await getDoc(doc(db, 'graduationRounds', targetId));
      if (snap.exists()) {
        round = { id: snap.id, ...snap.data() };
      }
    } catch (e) {
      console.warn('[SelfJoin] Fetch round doc notice:', e);
    }
  }

  if (!round) {
    showToast('Không tìm thấy thông tin đợt tốt nghiệp.', 'error');
    return;
  }

  state.currentJoinLinkRound = round;
  state.currentJoinLinkRoundId = round.id;

  // Title & Academic year
  const titleEl = document.getElementById('round-join-link-title');
  const yearEl = document.getElementById('round-join-link-year');
  if (titleEl) titleEl.textContent = round.title || round.roundName || round.name || 'Đợt tốt nghiệp';
  if (yearEl) yearEl.textContent = round.academicYear ? `Năm học: ${round.academicYear}` : '';

  // Toggle switch and status badge
  const isEnabled = Boolean(round.allowSelfJoin);
  const toggleEl = document.getElementById('round-join-link-toggle');
  const badgeEl = document.getElementById('round-join-link-status-badge');
  if (toggleEl) toggleEl.checked = isEnabled;
  if (badgeEl) {
    if (isEnabled) {
      badgeEl.textContent = '● Đang BẬT (Cho phép tự tham gia)';
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
    } else {
      badgeEl.textContent = '○ Đang TẮT (Khóa tham gia)';
      badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200';
    }
  }

  // Generate unique join link: ?join=ROUND_ID
  const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://ifa-graduation.web.app';
  const joinUrl = `${origin}/?join=${encodeURIComponent(round.id)}`;
  const inputEl = document.getElementById('round-join-link-url');
  if (inputEl) inputEl.value = joinUrl;

  const modal = document.getElementById('modal-round-join-link');
  if (modal) modal.classList.remove('hidden');
};

window.closeRoundJoinLinkModal = function() {
  const modal = document.getElementById('modal-round-join-link');
  if (modal) modal.classList.add('hidden');
};

window.toggleRoundSelfJoin = async function(enabled) {
  const roundId = state.currentJoinLinkRoundId;
  if (!roundId) return;

  const badgeEl = document.getElementById('round-join-link-status-badge');
  const toggleEl = document.getElementById('round-join-link-toggle');

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      allowSelfJoin: Boolean(enabled),
      updatedAt: serverTimestamp()
    });

    // Update in-memory round
    if (state.currentJoinLinkRound) state.currentJoinLinkRound.allowSelfJoin = Boolean(enabled);
    const inList = (state.rounds || []).find(r => r.id === roundId);
    if (inList) inList.allowSelfJoin = Boolean(enabled);
    if (state.activeRound && state.activeRound.id === roundId) state.activeRound.allowSelfJoin = Boolean(enabled);

    if (badgeEl) {
      if (enabled) {
        badgeEl.textContent = '● Đang BẬT (Cho phép tự tham gia)';
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
      } else {
        badgeEl.textContent = '○ Đang TẮT (Khóa tham gia)';
        badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200';
      }
    }

    showToast(enabled ? '✓ Đã BẬT link cho phép sinh viên tự tham gia!' : '✓ Đã KHÓA link tự tham gia của đợt này.', enabled ? 'success' : 'info');
  } catch (err) {
    console.error('[SelfJoin] Toggle error:', err);
    showToast('Lỗi cập nhật trạng thái link: ' + err.message, 'error');
    if (toggleEl) toggleEl.checked = !enabled;
  }
};

window.copyRoundJoinLink = async function() {
  const inputEl = document.getElementById('round-join-link-url');
  if (!inputEl || !inputEl.value) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(inputEl.value);
    } else {
      inputEl.select();
      document.execCommand('copy');
    }
    showToast('✓ Đã sao chép link tham gia vào bộ nhớ tạm!', 'success');
  } catch (err) {
    inputEl.select();
    showToast('Vui lòng bấm Ctrl+C để sao chép link.', 'info');
  }
};

window.testOpenRoundJoinLink = function() {
  const inputEl = document.getElementById('round-join-link-url');
  if (inputEl && inputEl.value) {
    window.open(inputEl.value, '_blank');
  }
};


// --- Student Self-Join Flow & URL Interceptor ---

function cleanJoinUrlParam() {
  if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('join')) {
      url.searchParams.delete('join');
      const newSearch = url.searchParams.toString();
      const newUrl = url.pathname + (newSearch ? '?' + newSearch : '') + url.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  } catch (e) {}
}

window.checkAndHandlePendingRoundJoin = async function() {
  if (typeof window === 'undefined') return;

  const urlParams = new URLSearchParams(window.location.search);
  const joinParam = urlParams.get('join');
  if (joinParam) {
    try { sessionStorage.setItem('pendingJoinRound', joinParam.trim()); } catch (e) {}
  }

  let pendingKey = null;
  try {
    pendingKey = sessionStorage.getItem('pendingJoinRound') || joinParam;
  } catch (e) {
    pendingKey = joinParam;
  }
  if (!pendingKey) return;

  // 1. If user is NOT authenticated yet
  if (!state.user) {
    const standardInst = document.getElementById('login-standard-instruction');
    if (standardInst) {
      standardInst.innerHTML = `
        <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs text-left mb-2 space-y-1">
          <strong class="font-bold block">🎓 Bạn đang truy cập link tham gia Đợt Tốt nghiệp.</strong>
          <p>Vui lòng bấm <b>Đăng nhập với Google</b> bằng tài khoản sinh viên TDTU (<code>@student.tdtu.edu.vn</code>) để xác nhận tham gia.</p>
        </div>
      `;
    }
    return;
  }

  // 2. User IS authenticated: Verify student account
  if (!state.isStudent && !state.studentMssv) {
    showToast('Link tự tham gia chỉ áp dụng cho tài khoản sinh viên TDTU (@student.tdtu.edu.vn).', 'error', 6000);
    try { sessionStorage.removeItem('pendingJoinRound'); } catch (e) {}
    cleanJoinUrlParam();
    return;
  }

  // 3. Find target round
  let targetRound = (state.rounds || []).find(r => !r.deleted && (
    r.id === pendingKey || r.shortCode === pendingKey || r.slug === pendingKey || r.roundName === pendingKey
  ));

  if (!targetRound) {
    try {
      const snap = await getDoc(doc(db, 'graduationRounds', pendingKey));
      if (snap.exists() && !snap.data().deleted) {
        targetRound = { id: snap.id, ...snap.data() };
      }
    } catch (e) {
      console.warn('[SelfJoin] Fetch target round notice:', e);
    }
  }

  if (!targetRound) {
    showToast('Đợt tốt nghiệp không tồn tại hoặc đã bị xóa.', 'error', 6000);
    try { sessionStorage.removeItem('pendingJoinRound'); } catch (e) {}
    cleanJoinUrlParam();
    return;
  }

  // Check if round is archived or closed
  if (targetRound.isClosed || targetRound.status === 'closed') {
    showToast(`Đợt tốt nghiệp "${targetRound.title || targetRound.roundName}" đã kết thúc. Không thể tham gia mới.`, 'warning', 6000);
    try { sessionStorage.removeItem('pendingJoinRound'); } catch (e) {}
    cleanJoinUrlParam();
    return;
  }

  if (targetRound.isHidden) {
    showToast(`Đợt tốt nghiệp "${targetRound.title || targetRound.roundName}" đã được lưu trữ. Không thể tham gia mới.`, 'warning', 6000);
    try { sessionStorage.removeItem('pendingJoinRound'); } catch (e) {}
    cleanJoinUrlParam();
    return;
  }

  // Check if self-join is allowed
  if (targetRound.allowSelfJoin !== true) {
    showToast(`Đợt tốt nghiệp "${targetRound.title || targetRound.roundName}" hiện không mở tính năng tự tham gia qua link. Vui lòng liên hệ Quản trị viên Khoa.`, 'warning', 6000);
    try { sessionStorage.removeItem('pendingJoinRound'); } catch (e) {}
    cleanJoinUrlParam();
    return;
  }

  // 4. Check if student already joined
  const studentMssv = state.studentMssv || state.userStudentId || (state.user?.email && state.user.email.toLowerCase().endsWith('@student.tdtu.edu.vn') ? state.user.email.split('@')[0].toUpperCase() : '');
  state.pendingJoinTargetRound = targetRound;

  let existingEligibleDoc = null;
  try {
    if (studentMssv) {
      existingEligibleDoc = await getDoc(doc(db, 'graduationRounds', targetRound.id, 'eligibleStudents', studentMssv));
    }
  } catch (err) {
    console.warn('[SelfJoin] Check existing eligible doc notice:', err);
  }

  if (existingEligibleDoc && existingEligibleDoc.exists()) {
    try {
      sessionStorage.setItem('student_selected_round_id', targetRound.id);
      localStorage.setItem('student_selected_round_id', targetRound.id);
      sessionStorage.removeItem('pendingJoinRound');
    } catch (e) {}
    state.selectedRoundId = targetRound.id;
    state.activeRound = targetRound;
    cleanJoinUrlParam();

    const flowContainer = document.getElementById('registration-flow-container');
    const isRegistering = Boolean(state.isRegisteringTopic || (flowContainer && !flowContainer.classList.contains('hidden')));
    if (joinParam && !isRegistering) {
      // Student already joined and arrived via join link: Display confirmation banner without interrupting registration
      openStudentAlreadyJoinedModal(targetRound, existingEligibleDoc.data());
    }
    return;
  }

  // 5. Student NOT yet joined: Open confirmation modal
  await openStudentConfirmJoinModal(targetRound);
};

async function openStudentConfirmJoinModal(round) {
  if (!round) return;
  state.pendingJoinTargetRound = round;
  const studentMssv = state.studentMssv;

  if (typeof ensureFacultyDatasetLoaded === 'function') {
    await ensureFacultyDatasetLoaded().catch(() => []);
  }

  const master = (typeof window.getFacultyStudentByMssv === 'function')
    ? window.getFacultyStudentByMssv(studentMssv)
    : null;

  const roundTitleEl = document.getElementById('student-join-round-title');
  const roundYearEl = document.getElementById('student-join-round-year');
  if (roundTitleEl) roundTitleEl.textContent = round.title || round.roundName || 'Đợt tốt nghiệp';
  if (roundYearEl) roundYearEl.textContent = round.academicYear ? `Năm học: ${round.academicYear}` : '--';

  const mssvInput = document.getElementById('student-join-mssv');
  const emailInput = document.getElementById('student-join-email');
  const nameInput = document.getElementById('student-join-fullname');
  const classInput = document.getElementById('student-join-class');
  const majorSelect = document.getElementById('student-join-major');

  if (mssvInput) mssvInput.value = studentMssv;
  if (emailInput) emailInput.value = state.user?.email || `${studentMssv.toLowerCase()}@student.tdtu.edu.vn`;

  const resolvedName = (master && (master.fullName || master.name)) || state.user?.displayName || '';
  const resolvedClass = (master && (master.className || master.studentClass)) || '';
  const resolvedMajor = (master && master.major) || 'Thiết kế Nội thất';

  if (nameInput) nameInput.value = resolvedName;
  if (classInput) classInput.value = resolvedClass;
  if (majorSelect) {
    if (resolvedMajor) majorSelect.value = resolvedMajor;
    else majorSelect.value = 'Thiết kế Nội thất';
  }

  const formSection = document.getElementById('student-join-form-section');
  const resultSection = document.getElementById('student-join-result-section');
  const confirmBtn = document.getElementById('btn-confirm-student-join');
  const viewRoundBtn = document.getElementById('btn-view-joined-round');

  if (formSection) formSection.classList.remove('hidden');
  if (resultSection) resultSection.classList.add('hidden');
  if (confirmBtn) {
    confirmBtn.classList.remove('hidden');
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<span>✓</span><span>Xác nhận tham gia</span>';
  }
  if (viewRoundBtn) viewRoundBtn.classList.add('hidden');

  const modal = document.getElementById('modal-student-confirm-join-round');
  if (modal) modal.classList.remove('hidden');
}

function openStudentAlreadyJoinedModal(round, studentData) {
  state.pendingJoinTargetRound = round;

  const roundTitleEl = document.getElementById('student-join-round-title');
  const roundYearEl = document.getElementById('student-join-round-year');
  if (roundTitleEl) roundTitleEl.textContent = round.title || round.roundName || 'Đợt tốt nghiệp';
  if (roundYearEl) roundYearEl.textContent = round.academicYear ? `Năm học: ${round.academicYear}` : '--';

  const formSection = document.getElementById('student-join-form-section');
  const resultSection = document.getElementById('student-join-result-section');
  const resultTitle = document.getElementById('student-join-result-title');
  const resultDesc = document.getElementById('student-join-result-desc');
  const confirmBtn = document.getElementById('btn-confirm-student-join');
  const viewRoundBtn = document.getElementById('btn-view-joined-round');

  if (formSection) formSection.classList.add('hidden');
  if (resultSection) resultSection.classList.remove('hidden');
  if (resultTitle) resultTitle.textContent = 'Bạn đã tham gia đợt tốt nghiệp này.';
  if (resultDesc) {
    const joinedName = studentData?.fullName || studentData?.name || state.user?.displayName || state.studentMssv;
    resultDesc.textContent = `Hồ sơ sinh viên: ${joinedName} (${state.studentMssv}) đã sẵn sàng trong đợt tốt nghiệp.`;
  }

  if (confirmBtn) confirmBtn.classList.add('hidden');
  if (viewRoundBtn) viewRoundBtn.classList.remove('hidden');

  const modal = document.getElementById('modal-student-confirm-join-round');
  if (modal) modal.classList.remove('hidden');
}

window.closeStudentJoinRoundModal = function() {
  const modal = document.getElementById('modal-student-confirm-join-round');
  if (modal) modal.classList.add('hidden');
  try { sessionStorage.removeItem('pendingJoinRound'); } catch (e) {}
  cleanJoinUrlParam();
};

window.confirmStudentSelfJoinRound = async function() {
  const round = state.pendingJoinTargetRound;
  if (!round || !round.id) {
    showToast('Chưa xác định thông tin đợt tốt nghiệp.', 'error');
    return;
  }

  const studentMssv = state.studentMssv;
  if (!studentMssv) {
    showToast('Không thể xác thực MSSV của bạn.', 'error');
    return;
  }

  const nameInput = document.getElementById('student-join-fullname');
  const classInput = document.getElementById('student-join-class');
  const majorSelect = document.getElementById('student-join-major');

  const fullName = String(nameInput?.value || '').trim();
  const className = String(classInput?.value || '').trim();
  const major = String(majorSelect?.value || 'Thiết kế Nội thất').trim();

  if (!fullName) {
    showToast('Vui lòng nhập họ và tên của bạn.', 'warning');
    nameInput?.focus();
    return;
  }

  if (!className) {
    showToast('Vui lòng nhập lớp sinh hoạt của bạn.', 'warning');
    classInput?.focus();
    return;
  }

  const confirmBtn = document.getElementById('btn-confirm-student-join');
  const origText = confirmBtn ? confirmBtn.innerHTML : 'Xác nhận tham gia';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span>⏳ Đang ghi danh...</span>';
  }

  try {
    // Pre-check round still allows join
    const roundSnap = await getDoc(doc(db, 'graduationRounds', round.id));
    if (!roundSnap.exists() || roundSnap.data().allowSelfJoin !== true) {
      throw new Error('Đợt tốt nghiệp này hiện đã khóa tính năng tự tham gia qua link.');
    }
    if (roundSnap.data().isClosed || roundSnap.data().status === 'closed' || roundSnap.data().isHidden) {
      throw new Error('Đợt tốt nghiệp này đã kết thúc hoặc lưu trữ.');
    }

    // Check if document already exists
    const studentRef = doc(db, 'graduationRounds', round.id, 'eligibleStudents', studentMssv);
    const existingDoc = await getDoc(studentRef);

    if (existingDoc.exists()) {
      showToast('Bạn đã có tên trong danh sách đợt tốt nghiệp này.', 'info');
      openStudentAlreadyJoinedModal(round, existingDoc.data());
      try { sessionStorage.removeItem('pendingJoinRound'); } catch (e) {}
      cleanJoinUrlParam();
      return;
    }

    // Write new record for self-joined student (status: undeclared, not auto-eligible)
    const payload = {
      studentId: studentMssv,
      mssv: studentMssv,
      name: fullName,
      fullName: fullName,
      email: (state.user?.email || `${studentMssv.toLowerCase()}@student.tdtu.edu.vn`).toLowerCase().trim(),
      className: className,
      studentClass: className,
      currentClass: className,
      major: major,
      roundId: round.id,
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: {
        status: 'undeclared'
      }
    };

    await setDoc(studentRef, payload);

    // Audit log (gracefully catch if rules reject)
    try {
      const actorEmail = (state.user?.email || '').toLowerCase().trim();
      await addDoc(collection(db, 'graduationRounds', round.id, 'auditLogs'), {
        action: 'Tham gia đợt tốt nghiệp',
        by: actorEmail || `${studentMssv.toLowerCase()}@student.tdtu.edu.vn`,
        email: actorEmail || `${studentMssv.toLowerCase()}@student.tdtu.edu.vn`,
        uid: state.user?.uid || '',
        roundId: round.id,
        studentId: studentMssv,
        mssv: studentMssv,
        fullName: fullName,
        joinMethod: 'link',
        source: 'link',
        timestamp: serverTimestamp()
      });
    } catch (auditErr) {
      console.warn('[SelfJoin] Audit log notice:', auditErr);
    }

    // Track user activity in userActivities
    try {
      if (typeof trackUserActivity === 'function') {
        await trackUserActivity('Tham gia đợt tốt nghiệp', {
          context: round.title || round.name || round.id,
          roundId: round.id,
          joinMethod: 'link'
        });
      } else if (typeof window !== 'undefined' && typeof window.trackUserActivity === 'function') {
        await window.trackUserActivity('Tham gia đợt tốt nghiệp', {
          context: round.title || round.name || round.id,
          roundId: round.id,
          joinMethod: 'link'
        });
      }
    } catch (trackErr) {
      console.warn('[SelfJoin] Track activity notice:', trackErr);
    }

    // Success UI State
    const formSection = document.getElementById('student-join-form-section');
    const resultSection = document.getElementById('student-join-result-section');
    const resultTitle = document.getElementById('student-join-result-title');
    const resultDesc = document.getElementById('student-join-result-desc');
    const viewRoundBtn = document.getElementById('btn-view-joined-round');

    if (formSection) formSection.classList.add('hidden');
    if (resultSection) resultSection.classList.remove('hidden');
    if (resultTitle) resultTitle.textContent = 'Bạn đã tham gia đợt tốt nghiệp thành công.';
    if (resultDesc) resultDesc.textContent = `Sinh viên: ${fullName} (${studentMssv}) đã được ghi danh vào đợt.`;

    if (confirmBtn) confirmBtn.classList.add('hidden');
    if (viewRoundBtn) viewRoundBtn.classList.remove('hidden');

    showToast('✓ Bạn đã tham gia đợt tốt nghiệp thành công!', 'success');

    // Bind current student selection to joined round
    try {
      sessionStorage.setItem('student_selected_round_id', round.id);
      localStorage.setItem('student_selected_round_id', round.id);
      sessionStorage.removeItem('pendingJoinRound');
    } catch (e) {}
    state.selectedRoundId = round.id;
    state.activeRound = round;
    if (Array.isArray(state.studentRounds) && !state.studentRounds.some(r => r.id === round.id)) {
      state.studentRounds.push(round);
    }
    cleanJoinUrlParam();

    // Background refresh
    if (typeof refreshRoundCardMetrics === 'function') refreshRoundCardMetrics(round.id).catch(() => {});
    if (typeof loadAdminEligibleStudents === 'function' && document.getElementById('admin-round-student-select')?.value === round.id) {
      loadAdminEligibleStudents(round.id).catch(() => {});
    }
  } catch (err) {
    console.error('[SelfJoin] Confirm join error:', err);
    showToast('Không thể tham gia đợt: ' + err.message, 'error', 6000);
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = origText;
    }
  }
};

window.viewJoinedRoundPortal = function() {
  const round = state.pendingJoinTargetRound;
  closeStudentJoinRoundModal();
  if (round) {
    try {
      sessionStorage.setItem('student_selected_round_id', round.id);
      localStorage.setItem('student_selected_round_id', round.id);
    } catch (e) {}
    state.selectedRoundId = round.id;
    state.activeRound = round;
    if (typeof selectRound === 'function') {
      selectRound(round.id);
    }
  }
  if (typeof switchView === 'function') {
    switchView('student');
  }
};
window.openStudentConfirmJoinModal = openStudentConfirmJoinModal;

// Auto-detect join URL on bootstrap
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
      if (typeof window.checkAndHandlePendingRoundJoin === 'function') {
        window.checkAndHandlePendingRoundJoin();
      }
    }, 200);
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        if (typeof window.checkAndHandlePendingRoundJoin === 'function') {
          window.checkAndHandlePendingRoundJoin();
        }
      }, 200);
    });
  }
}
