/**
 * IFA+ Graduation — Impersonation Session Lifecycle & Routing
 */
/**
 * IFA+ Graduation — Exact Act-As Impersonation Test Mode Module
 */
// --- ADMIN: PREVIEW AS STUDENT ---
async function preparePreviewStudentDropdown() {
  const select = document.getElementById('preview-select-mssv');
  if (!select) return;

  const roundId = state.selectedRoundId;
  if (!roundId) return;

  try {
    if (typeof ensureFacultyDatasetLoaded === 'function') {
      try { await ensureFacultyDatasetLoaded(); } catch (e) {}
    }

    const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
    const list = snap.docs.map(d => {
      const data = d.data() || {};
      const mssv = String(d.id || data.studentId || data.mssv || '').trim().toUpperCase();
      const facStudent = (typeof window.getFacultyStudentByMssv === 'function') ? window.getFacultyStudentByMssv(mssv) : null;
      let name = (facStudent?.fullName || facStudent?.name || data.fullName || data.name || '').trim();
      if (name === mssv || name.startsWith('Sinh viên ' + mssv)) name = '';
      const className = (facStudent?.className || data.className || '').trim();
      return {
        studentId: mssv,
        name: name,
        className: className
      };
    });

    select.innerHTML = list.length === 0 
      ? '<option value="">(Chưa có danh sách SV đủ điều kiện)</option>'
      : list.map(s => {
          const namePart = s.name ? ` — ${s.name}` : '';
          const classPart = s.className ? ` (${s.className})` : '';
          return `<option value="${s.studentId}">${s.studentId}${namePart}${classPart}</option>`;
        }).join('');
  } catch (e) {
    console.warn('[preview] preparePreviewStudentDropdown error:', e);
  }
}

window.launchStudentPreview = function() {
  const selectedMssv = document.getElementById('preview-select-mssv')?.value;
  const customMssv = (document.getElementById('preview-custom-mssv')?.value || '').trim().toUpperCase();

  const targetMssv = customMssv || selectedMssv || '52000888';

  state.isPreviewMode = true;
  state.previewMssv = targetMssv;

  document.getElementById('preview-mode-banner').classList.remove('hidden');
  document.getElementById('preview-mssv-badge').textContent = targetMssv;

  switchView('student');
  checkStudentEligibilityAndRegistration(state.selectedRoundId);
};

window.exitPreviewMode = function() {
  state.isPreviewMode = false;
  state.previewMssv = '';
  document.getElementById('preview-mode-banner').classList.add('hidden');
  if (state.isAdmin) {
    switchView('admin');
  } else {
    checkStudentEligibilityAndRegistration(state.selectedRoundId);
  }
};

// ============================================================================

// FEATURE: ADMIN EXACT ACT-AS TEST MODE (v2.7.0-beta.1)
// ============================================================================

export function isImpersonating() {
  return Boolean(state.impersonation);
}

export function getRealUser() {
  return state.realUser || auth.currentUser;
}

export function getEffectiveActor() {
  if (state.impersonation && state.impersonation.target) {
    const target = state.impersonation.target || {};
    const mssv = target.mssv || (target.type === 'student' ? target.id : '');
    const email = (target.email || (mssv ? `${mssv.toLowerCase()}@student.tdtu.edu.vn` : '')).toLowerCase().trim();
    const uid = target.id || target.uid || email || mssv;
    return {
      user: state.realUser || state.user, // Authentic Firebase Auth user preserved
      uid: uid,
      email: email,
      displayName: target.name || mssv || email || 'Người dùng đóng vai',
      photoURL: null,
      isAdmin: false, // Strict: zero admin privilege leak
      isSupervisor: target.type === 'supervisor' || target.type === 'reviewer' || target.type === 'council' || target.type === 'preliminary',
      isStudent: target.type === 'student',
      isReviewer: target.type === 'reviewer',
      isCouncil: target.type === 'council',
      isPreliminary: target.type === 'preliminary',
      studentMssv: mssv,
      targetType: target.type,
      roundId: target.roundId || '',
      roundTitle: target.roundTitle || '',
      roleLabel: target.roleLabel || target.type,
      councilId: target.councilId || '',
      councilName: target.councilName || '',
      councilRole: target.councilRole || '',
      activityName: target.activityName || '',
      impersonating: true,
      readOnly: false, // EXACT ACT-AS MODE: real test actions enabled
      realUser: state.realUser || state.user
    };
  }
  const mssv = state.studentMssv || (state.user?.email ? state.user.email.split('@')[0] : '');
  return {
    user: state.user,
    uid: state.user?.uid || '',
    email: (state.user?.email || '').toLowerCase().trim(),
    displayName: state.user?.displayName || '',
    photoURL: state.user?.photoURL || null,
    isAdmin: Boolean(state.isAdmin),
    isSupervisor: Boolean(state.isSupervisor),
    isStudent: Boolean(state.isStudent),
    isReviewer: false,
    isCouncil: false,
    isPreliminary: false,
    studentMssv: mssv,
    targetType: state.isAdmin ? 'admin' : (state.isSupervisor ? 'supervisor' : 'student'),
    roleLabel: state.isAdmin ? 'Quản trị viên' : (state.isSupervisor ? 'Giảng viên' : 'Sinh viên'),
    impersonating: false,
    readOnly: false,
    realUser: state.user
  };
}

export function checkImpersonationWriteGuard(actionDesc = 'Thao tác') {
  if (state.impersonation) {
    return assertWriteAllowedForEffectiveActor(actionDesc);
  }
  return true;
}

export function loadImpersonationSession() {
  try {
    const raw = sessionStorage.getItem('ifa_graduation_impersonation');
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.target) {
      state.impersonation = session;
      if (session.target.roundId) {
        state.selectedRoundId = session.target.roundId;
      }
      applyImpersonationActor(session.target);
      return session;
    }
  } catch (e) {
    console.warn('[Impersonation] Failed to load session:', e);
    try { sessionStorage.removeItem('ifa_graduation_impersonation'); } catch (err) {}
    state.impersonation = null;
  }
  return null;
}

window.isImpersonating = isImpersonating;
window.getRealUser = getRealUser;
window.getEffectiveActor = getEffectiveActor;
window.checkImpersonationWriteGuard = checkImpersonationWriteGuard;
window.loadImpersonationSession = loadImpersonationSession;

export function applyImpersonationActor(target) {
  if (!target) return;

  const mssv = target.mssv || (target.type === 'student' ? target.id : '');

  // 1. Real user preservation: do NOT replace real Firebase Auth user
  state.user = state.realUser || state.user;

  // 2. Strict Privilege Demotion - Zero Admin Leak
  state.isAdmin = false;

  // 3. Set specific roles
  if (target.type === 'student') {
    state.actualRole = 'student';
    state.isStudent = true;
    state.isSupervisor = false;
    state.studentMssv = mssv;
    state.userStudentId = mssv;
  } else if (target.type === 'supervisor') {
    state.actualRole = 'supervisor';
    state.isStudent = false;
    state.isSupervisor = true;
    state.studentMssv = '';
    state.userStudentId = '';
  } else if (target.type === 'reviewer' || target.type === 'council' || target.type === 'preliminary') {
    state.actualRole = 'supervisor';
    state.isStudent = false;
    state.isSupervisor = true;
    state.studentMssv = '';
    state.userStudentId = '';
  } else {
    state.actualRole = 'student';
    state.isStudent = false;
    state.isSupervisor = false;
    state.studentMssv = '';
    state.userStudentId = '';
  }

  // 4. Update banner elements
  const banner = document.getElementById('global-impersonation-banner');
  if (banner) {
    banner.classList.remove('hidden');
    const nameEl = document.getElementById('impersonate-banner-name');
    const idEl = document.getElementById('impersonate-banner-identifier');
    const roleEl = document.getElementById('impersonate-banner-role');
    const roundEl = document.getElementById('impersonate-banner-round');

    if (nameEl) nameEl.textContent = target.name || mssv || target.email;
    if (idEl) idEl.textContent = mssv ? `(${mssv})` : (target.email ? `(${target.email})` : '');
    if (roleEl) roleEl.textContent = target.roleLabel || target.type;
    if (roundEl) {
      let rTitle = target.roundTitle || '';
      let rShort = target.roundShortCode || '';
      let rYear = target.roundAcademicYear || '';
      if (target.roundId && (!rTitle || !rShort)) {
        const foundRound = (state.rounds || []).find(r => r.id === target.roundId);
        if (foundRound) {
          rTitle = rTitle || foundRound.title || foundRound.roundName || foundRound.id;
          rShort = rShort || foundRound.shortCode || '';
          rYear = rYear || foundRound.academicYear || '';
        }
      }

      if (rTitle || target.roundId) {
        let displayRound = rTitle || target.roundId;
        if (rYear && !displayRound.includes(rYear)) displayRound += ` (${rYear})`;
        if (rShort && !displayRound.includes(rShort)) displayRound += ` [${rShort}]`;
        roundEl.textContent = `Đợt: ${displayRound}`;
        roundEl.classList.remove('hidden');
      } else {
        roundEl.classList.add('hidden');
      }
    }
  }

  // 5. Update admin lock card elements
  const lockTargetName = document.getElementById('admin-lock-target-name');
  const lockTargetRole = document.getElementById('admin-lock-target-role');
  if (lockTargetName) lockTargetName.textContent = `${target.name} (${target.email || mssv})`;
  if (lockTargetRole) lockTargetRole.textContent = target.roleLabel || target.type;

  updateSettingsActAsSessionUI();
}
window.applyImpersonationActor = applyImpersonationActor;

window.startImpersonating = async function(target) {
  if (!state.allowImpersonation) {
    showToast('Tính năng đóng vai hiện đang bị tắt trong Cài đặt hệ thống.', 'warning');
    return;
  }
  if (!state.realIsAdmin) {
    showToast('Chỉ Quản trị viên mới có quyền sử dụng tính năng này.', 'warning');
    return;
  }

  if (target.roundId) {
    const matchedRound = (state.rounds || []).find(r => r.id === target.roundId);
    if (matchedRound) {
      target.roundTitle = target.roundTitle || matchedRound.title || matchedRound.roundName || matchedRound.id;
      target.roundShortCode = target.roundShortCode || matchedRound.shortCode || '';
      target.roundAcademicYear = target.roundAcademicYear || matchedRound.academicYear || '';
      state.activeRound = matchedRound;
    }
    state.selectedRoundId = target.roundId;
  }

  const sessionData = {
    realUser: {
      uid: state.realUser?.uid || '',
      email: state.realUser?.email || '',
      displayName: state.realUser?.displayName || ''
    },
    target: target,
    mode: 'act_as_write', // EXACT ACT-AS TEST MODE
    startedAt: Date.now()
  };

  try {
    sessionStorage.setItem('ifa_graduation_impersonation', JSON.stringify(sessionData));
  } catch (e) {
    console.warn('[Impersonation] Failed to write sessionStorage:', e);
  }

  state.impersonation = sessionData;
  applyImpersonationActor(target);
  closeAdminImpersonateModal();
  updateAuthUI();

  if (typeof showToast === 'function') {
    showToast(`⚡ Bắt đầu đóng vai: ${target.name} (${target.roleLabel || target.type}) — Chế độ thao tác thực tế.`, 'info', 4000);
  }

  // Navigate to corresponding portal
  if (target.type === 'student') {
    if (window.location.pathname.includes('/admin') || window.location.pathname.includes('/supervisor') || window.location.pathname.includes('/assessment')) {
      window.location.href = '/graduation/';
    } else {
      await switchView('student');
      const rId = target.roundId || state.selectedRoundId;
      if (rId && typeof selectRound === 'function') {
        await selectRound(rId);
      }
    }
  } else if (target.type === 'supervisor') {
    if (!window.location.pathname.includes('/supervisor')) {
      window.location.href = '/graduation/supervisor/';
    } else {
      await switchView('supervisor');
      if (typeof initSupervisorPortal === 'function') {
        initSupervisorPortal();
      }
    }
  } else if (target.type === 'reviewer' || target.type === 'council' || target.type === 'preliminary') {
    if (!window.location.pathname.includes('/assessment')) {
      window.location.href = '/graduation/assessment/';
    } else {
      await switchView('assessment');
      if (typeof initAssessmentPortal === 'function') {
        initAssessmentPortal();
      }
    }
  }
};

window.startImpersonatingFromData = function(cand) {
  window.startImpersonating(cand);
};

window.exitImpersonation = async function() {
  try {
    sessionStorage.removeItem('ifa_graduation_impersonation');
  } catch (e) {}

  state.impersonation = null;

  const banner = document.getElementById('global-impersonation-banner');
  if (banner) banner.classList.add('hidden');

  if (state.realUser) {
    state.user = state.realUser;
    await resolveActualRoles(state.realUser);
  }

  updateAuthUI();
  updateSettingsActAsSessionUI();

  const currentPortal = getCurrentPortal();
  if (currentPortal === 'admin' || state.currentView === 'admin') {
    await switchView('admin');
    if (typeof switchAdminTab === 'function') {
      switchAdminTab(state.currentAdminTab || 'rounds');
    }
  } else {
    window.location.href = '/graduation/admin/';
  }

  if (typeof showToast === 'function') {
    showToast('Đã thoát chế độ đóng vai. Đã khôi phục đầy đủ quyền Quản trị viên.', 'success', 4000);
  }
};

window.goToCurrentRolePortal = function() {
  if (!state.impersonation) {
    switchView('admin');
    return;
  }
  const type = state.impersonation.target?.type;
  if (type === 'student') {
    window.location.href = '/graduation/';
  } else if (type === 'supervisor') {
    window.location.href = '/graduation/supervisor/';
  } else if (type === 'reviewer' || type === 'council' || type === 'preliminary') {
    window.location.href = '/graduation/assessment/';
  } else {
    window.location.href = '/graduation/';
  }
};

