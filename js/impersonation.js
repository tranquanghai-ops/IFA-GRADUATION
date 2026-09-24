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

window.isImpersonating = isImpersonating;
window.getRealUser = getRealUser;
window.getEffectiveActor = getEffectiveActor;
window.checkImpersonationWriteGuard = checkImpersonationWriteGuard;

export async function loadSystemSettingsDoc() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'main')).catch(() => null);
    if (snap && snap.exists()) {
      const data = snap.data();
      state.allowImpersonation = Boolean(data.allowImpersonation);
    } else {
      state.allowImpersonation = false;
    }
  } catch (e) {
    console.warn('[IFA-Graduation] loadSystemSettingsDoc notice:', e);
    state.allowImpersonation = false;
  }
}
window.loadSystemSettingsDoc = loadSystemSettingsDoc;

let unsubscribeSettings = null;

export function setupSystemSettingsRealtimeListener() {
  if (unsubscribeSettings) {
    try { unsubscribeSettings(); } catch (e) {}
    unsubscribeSettings = null;
  }

  try {
    const settingsDocRef = doc(db, 'settings', 'main');
    unsubscribeSettings = onSnapshot(settingsDocRef, async (snap) => {
      let isAllowed = false;
      if (snap && snap.exists()) {
        const data = snap.data();
        isAllowed = Boolean(data?.allowImpersonation);
      }

      state.allowImpersonation = isAllowed;

      // Update toggle / status label / control box in Admin Settings if open
      const toggle = document.getElementById('toggle-admin-impersonation');
      const label = document.getElementById('impersonation-status-label');
      const box = document.getElementById('settings-actas-control-box');
      if (toggle) toggle.checked = isAllowed;
      if (label) {
        label.textContent = isAllowed ? 'Đang bật' : 'Đang tắt';
        label.className = isAllowed ? 'text-[11px] font-bold text-amber-600' : 'text-[11px] font-bold text-slate-500';
      }
      if (box) {
        if (isAllowed) box.classList.remove('hidden');
        else box.classList.add('hidden');
      }

      // Realtime session termination if turned off while an impersonation session is active
      if (!isAllowed && state.impersonation) {
        console.warn('[Impersonation] allowImpersonation turned OFF in real-time. Terminating active session immediately.');
        await exitImpersonation();
        if (typeof showToast === 'function') {
          showToast('⚠️ Tính năng đóng vai đã bị Chủ sở hữu tắt. Phiên làm việc đã tự động kết thúc.', 'warning', 6000);
        }
      }
    }, (err) => {
      console.warn('[SystemSettings] Realtime settings listener notice:', err);
    });
  } catch (err) {
    console.warn('[SystemSettings] Could not attach realtime settings listener:', err);
  }
}
window.setupSystemSettingsRealtimeListener = setupSystemSettingsRealtimeListener;

export async function loadAdminSystemSettings() {
  const toggle = document.getElementById('toggle-admin-impersonation');
  const label = document.getElementById('impersonation-status-label');
  const warning = document.getElementById('impersonation-permission-warning');
  const box = document.getElementById('settings-actas-control-box');
  const isOwner = isSystemOwner();

  try {
    const snap = await getDoc(doc(db, 'settings', 'main')).catch(() => null);
    const data = snap?.exists() ? snap.data() : {};
    state.allowImpersonation = Boolean(data.allowImpersonation);

    if (toggle) {
      toggle.checked = state.allowImpersonation;
      toggle.disabled = !isOwner;
    }

    if (label) {
      label.textContent = state.allowImpersonation ? 'Đang bật' : 'Đang tắt';
      label.className = state.allowImpersonation ? 'text-[11px] font-bold text-amber-600' : 'text-[11px] font-bold text-slate-500';
    }

    if (warning) {
      if (!isOwner) warning.classList.remove('hidden');
      else warning.classList.add('hidden');
    }

    if (box) {
      if (state.allowImpersonation) {
        box.classList.remove('hidden');
        // Populate Round options in System Settings
        const roundSelect = document.getElementById('settings-actas-round');
        if (roundSelect) {
          const rounds = (state.rounds || []).filter(r => !r.deleted);
          let opts = '<option value="all">-- Tất cả các đợt --</option>';
          rounds.forEach(r => {
            const isAct = r.isActive ? ' (Hiện hành)' : '';
            opts += `<option value="${r.id}">${escapeHtml(r.roundName || r.title || r.id)}${isAct}</option>`;
          });
          roundSelect.innerHTML = opts;
          if (state.selectedRoundId && rounds.some(r => r.id === state.selectedRoundId)) {
            roundSelect.value = state.selectedRoundId;
          }
        }
        await populateSettingsActAsCandidates();
      } else {
        box.classList.add('hidden');
      }
    }

    updateSettingsActAsSessionUI();
  } catch (e) {
    console.warn('[SystemSettings] Error loading settings:', e);
  }
}
window.loadAdminSystemSettings = loadAdminSystemSettings;

function updateSettingsActAsSessionUI() {
  const currentInfo = document.getElementById('settings-actas-current-info');
  const exitBtn = document.getElementById('btn-settings-actas-exit');
  const startBtn = document.getElementById('btn-settings-actas-start');

  if (state.impersonation && state.impersonation.target) {
    const t = state.impersonation.target;
    if (currentInfo) {
      currentInfo.innerHTML = `<span class="text-amber-800 font-bold">🎭 Đang đóng vai:</span> <span class="font-bold text-slate-900">${escapeHtml(t.name || '')}</span> <span class="text-slate-500 text-[11px]">(${escapeHtml(t.mssv || t.email || '')})</span> <span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 font-bold">${escapeHtml(t.roleLabel || t.type)}</span>`;
    }
    if (exitBtn) exitBtn.classList.remove('hidden');
  } else {
    if (currentInfo) {
      currentInfo.innerHTML = `<span class="text-slate-500 text-xs">Chưa có phiên đóng vai nào đang kích hoạt.</span>`;
    }
    if (exitBtn) exitBtn.classList.add('hidden');
  }
}

export async function onSettingsActAsRoundOrRoleChange() {
  await populateSettingsActAsCandidates();
}
window.onSettingsActAsRoundOrRoleChange = onSettingsActAsRoundOrRoleChange;

let settingsActAsSearchTimer = null;
export function onSettingsActAsSearchInput(val) {
  clearTimeout(settingsActAsSearchTimer);
  settingsActAsSearchTimer = setTimeout(async () => {
    await populateSettingsActAsCandidates();
  }, 250);
}
window.onSettingsActAsSearchInput = onSettingsActAsSearchInput;

export async function populateSettingsActAsCandidates() {
  const roundSelect = document.getElementById('settings-actas-round');
  const roleSelect = document.getElementById('settings-actas-role');
  const searchInput = document.getElementById('settings-actas-search');
  const userSelect = document.getElementById('settings-actas-user');
  const countEl = document.getElementById('settings-actas-user-count');

  if (!userSelect) return;

  const roundFilter = roundSelect ? roundSelect.value : 'all';
  const roleFilter = roleSelect ? roleSelect.value : 'student';
  const searchQuery = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';

  userSelect.innerHTML = '<option value="">⏳ Đang nạp danh sách người dùng...</option>';

  if ((roleFilter === 'student' || roleFilter === 'all') && typeof ensureFacultyDatasetLoaded === 'function') {
    await ensureFacultyDatasetLoaded().catch(error => console.warn('[ActAs] Student Master load notice:', error));
  }
  if (roleFilter !== 'student' && typeof ensureSupervisorsMasterLoaded === 'function') {
    await ensureSupervisorsMasterLoaded().catch(error => console.warn('[ActAs] Lecturer directory load notice:', error));
  }

  const candidates = await gatherRoundCandidates(roundFilter, roleFilter, searchQuery);
  state.settingsActAsCandidates = candidates;

  if (countEl) countEl.textContent = `${candidates.length} người dùng`;

  if (candidates.length === 0) {
    userSelect.innerHTML = '<option value="">(Không tìm thấy người dùng phù hợp với bộ lọc)</option>';
    return;
  }

  userSelect.innerHTML = candidates.map((c, idx) => {
    const ident = c.mssv || c.email || c.id || '';
    const details = [c.registrationStatus, c.className, c.major, c.department, c.notFoundInMaster ? 'Chưa tìm thấy thông tin sinh viên' : ''].filter(Boolean).join(' • ');
    const extra = details ? ` - ${details}` : (c.roundTitle ? ` - ${c.roundTitle}` : '');
    return `<option value="${idx}">[${escapeHtml(c.roleLabel)}] ${escapeHtml(c.name)} (${escapeHtml(ident)})${escapeHtml(extra)}</option>`;
  }).join('');
  userSelect.selectedIndex = 0;
}
window.populateSettingsActAsCandidates = populateSettingsActAsCandidates;

export function onSettingsActAsStartClick() {
  const userSelect = document.getElementById('settings-actas-user');
  if (!userSelect || userSelect.selectedIndex < 0) {
    showToast('Vui lòng chọn 1 người dùng từ danh sách để đóng vai.', 'warning');
    return;
  }

  const idx = parseInt(userSelect.value, 10);
  const candidates = state.settingsActAsCandidates || [];
  const selectedCand = candidates[idx];

  if (!selectedCand) {
    showToast('Người dùng không hợp lệ.', 'warning');
    return;
  }

  window.startImpersonating(selectedCand);
}
window.onSettingsActAsStartClick = onSettingsActAsStartClick;

window.onToggleAdminImpersonation = async function(enabled) {
  const isOwner = isSystemOwner();
  if (!isOwner) {
    showToast('Chỉ Chủ sở hữu hệ thống (tranquanghai@tdtu.edu.vn) có quyền cấu hình tính năng này.', 'warning');
    const toggle = document.getElementById('toggle-admin-impersonation');
    if (toggle) toggle.checked = state.allowImpersonation;
    return;
  }

  try {
    showLoading('Đang cập nhật thiết lập hệ thống...');
    await setDoc(doc(db, 'settings', 'main'), {
      allowImpersonation: Boolean(enabled),
      updatedAt: serverTimestamp(),
      updatedBy: state.realUser?.email || ''
    }, { merge: true });

    state.allowImpersonation = Boolean(enabled);

    const label = document.getElementById('impersonation-status-label');
    if (label) {
      label.textContent = state.allowImpersonation ? 'Đang bật' : 'Đang tắt';
      label.className = state.allowImpersonation ? 'text-[11px] font-bold text-amber-600' : 'text-[11px] font-bold text-slate-500';
    }

    const box = document.getElementById('settings-actas-control-box');
    if (box) {
      if (state.allowImpersonation) {
        box.classList.remove('hidden');
        await populateSettingsActAsCandidates();
      } else {
        box.classList.add('hidden');
      }
    }

    // If disabled, auto terminate any active impersonation sessions
    if (!state.allowImpersonation && state.impersonation) {
      await exitImpersonation();
    }

    updateAuthUI();
    hideLoading();
    if (typeof showToast === 'function') {
      showToast(state.allowImpersonation ? '✓ Đã bật tính năng Đóng vai người dùng (Exact Act-As Mode).' : '✓ Đã tắt tính năng Đóng vai người dùng.', 'success', 3000);
    }
  } catch (e) {
    hideLoading();
    console.error('[SystemSettings] Toggle error:', e);
    showToast('Lỗi cập nhật thiết lập: ' + e.message, 'error');
    const toggle = document.getElementById('toggle-admin-impersonation');
    if (toggle) toggle.checked = state.allowImpersonation;
  }
};

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

export async function gatherRoundCandidates(roundFilter = 'all', roleFilter = 'all', searchQuery = '') {
  const candidates = [];
  const candidateKeys = new Set();
  const candidatesByKey = new Map();

  function addCandidate(cand) {
    const key = `${cand.type}_${cand.email || cand.id || cand.mssv}_${cand.roundId || ''}`;
    if (!candidateKeys.has(key)) {
      candidateKeys.add(key);
      candidates.push(cand);
      candidatesByKey.set(key, cand);
    } else if (cand.type === 'student' && cand.registrationStatus === 'Đã đăng ký') {
      Object.assign(candidatesByKey.get(key), cand);
    }
  }

  // 1. SUPERVISORS (from state.supervisorsMaster and rounds)
  if (roleFilter === 'all' || roleFilter === 'supervisor') {
    let sups = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
      ? state.supervisorsMaster
      : (typeof SAMPLE_SUPERVISORS !== 'undefined' ? SAMPLE_SUPERVISORS : []);
    if (roundFilter !== 'all') {
      try {
        const roundSupervisorSnap = await getDocs(collection(db, 'graduationRounds', roundFilter, 'supervisors'));
        sups = roundSupervisorSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (error) {
        console.warn('[ActAs] Không thể tải GVHD của đợt:', error.message);
      }
    }
    
    const selRound = roundFilter !== 'all' ? (state.rounds || []).find(r => r.id === roundFilter) : null;

    sups.forEach(s => {
      if (s.active !== false && s.email) {
        addCandidate({
          type: 'supervisor',
          id: s.id || s.email,
          name: s.name || s.displayName || s.email,
          email: s.email,
          code: s.code || s.lecturerCode || '',
          department: s.department || '',
          roundId: (roundFilter !== 'all' ? roundFilter : ''),
          roundTitle: selRound ? (selRound.title || selRound.roundName || selRound.id) : '',
          roundShortCode: selRound?.shortCode || '',
          roundAcademicYear: selRound?.academicYear || '',
          roleLabel: 'Giảng viên hướng dẫn (GVHD)'
        });
      }
    });
  }

  // 2. STUDENTS (from registrations and eligible students in rounds)
  if (roleFilter === 'all' || roleFilter === 'student') {
    const targetRounds = (roundFilter !== 'all')
      ? (state.rounds || []).filter(r => r.id === roundFilter)
      : (state.rounds || []).filter(r => !r.deleted);

    for (const r of targetRounds) {
      // In-memory registrations
      const regs = r.registrations || (state.adminReviewData?.registrations && state.selectedRoundId === r.id ? state.adminReviewData.registrations : []);
      regs.forEach(st => {
        const sid = st.mssv || st.studentId;
        if (sid) {
          addCandidate({
            type: 'student',
            id: sid,
            mssv: sid,
            name: resolveStudentName(sid, st.studentName || st.name || st.fullName || ''),
            email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
            roundId: r.id,
            roundTitle: r.roundName || r.title || r.id,
            roundShortCode: r.shortCode || '',
            roundAcademicYear: r.academicYear || '',
            topicTitle: st.topicTitle || '',
            registrationStatus: 'Đã đăng ký',
            roleLabel: 'Sinh viên'
          });
        }
      });

      // Eligible students if any
      const eligible = r.eligibleStudents || [];
      eligible.forEach(st => {
        const sid = st.mssv || st.studentId;
        if (sid) {
          addCandidate({
            type: 'student',
            id: sid,
            mssv: sid,
            name: resolveStudentName(sid, st.studentName || st.name || st.fullName || ''),
            email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
            roundId: r.id,
            roundTitle: r.roundName || r.title || r.id,
            roundShortCode: r.shortCode || '',
            roundAcademicYear: r.academicYear || '',
            topicTitle: '',
            registrationStatus: regs.some(reg => String(reg.studentId || reg.mssv || reg.id).trim().toUpperCase() === String(sid).trim().toUpperCase()) ? 'Đã đăng ký' : 'Chưa đăng ký',
            roleLabel: 'Sinh viên'
          });
        }
      });

      // Exact Act-as must query both collections even when registrations already exist.
      if (roundFilter !== 'all') {
        try {
          const snap = await getDocs(collection(db, 'graduationRounds', r.id, 'registrations'));
          snap.docs.forEach(d => {
            const st = d.data();
            const sid = d.id || st.mssv || st.studentId;
            if (sid) {
              addCandidate({
                type: 'student',
                id: sid,
                mssv: sid,
                name: resolveStudentName(sid, st.studentName || st.name || st.fullName || ''),
                email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
                roundId: r.id,
                roundTitle: r.roundName || r.title || r.id,
                roundShortCode: r.shortCode || '',
                roundAcademicYear: r.academicYear || '',
                topicTitle: st.topicTitle || '',
                registrationStatus: 'Đã đăng ký',
                roleLabel: 'Sinh viên'
              });
            }
          });
        } catch (e) {}

        try {
          const snapEligible = await getDocs(collection(db, 'graduationRounds', r.id, 'eligibleStudents'));
          snapEligible.docs.forEach(d => {
            const st = d.data();
            const sid = d.id || st.mssv || st.studentId;
            if (sid) {
              addCandidate({
                type: 'student',
                id: sid,
                mssv: sid,
                name: resolveStudentName(sid, st.studentName || st.name || st.fullName || ''),
                email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
                roundId: r.id,
                roundTitle: r.roundName || r.title || r.id,
                roundShortCode: r.shortCode || '',
                roundAcademicYear: r.academicYear || '',
                topicTitle: '',
                registrationStatus: 'Chưa đăng ký',
                roleLabel: 'Sinh viên'
              });
            }
          });
        } catch (e) {}
      }
    }

    // Also check facultyStudents if candidates are empty
    if (candidates.filter(c => c.type === 'student').length === 0 && Array.isArray(state.facultyStudents) && state.facultyStudents.length > 0) {
      state.facultyStudents.slice(0, 50).forEach(fs => {
        const sid = fs.mssv || fs.studentId;
        if (sid) {
          addCandidate({
            type: 'student',
            id: sid,
            mssv: sid,
            name: fs.name || fs.fullName || sid,
            email: fs.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
            roundId: '',
            roundTitle: '',
            roundShortCode: '',
            roundAcademicYear: '',
            topicTitle: '',
            registrationStatus: 'Chưa đăng ký',
            roleLabel: 'Sinh viên'
          });
        }
      });
    }
  }

  // 3. REVIEWERS (from round.reviewerAssignments)
  if (roleFilter === 'all' || roleFilter === 'reviewer') {
    const targetRounds = (roundFilter !== 'all')
      ? (state.rounds || []).filter(r => r.id === roundFilter)
      : (state.rounds || []);

    for (const r of targetRounds) {
      const reviewerAssignments = r.reviewerAssignments || {};
      const distinctReviewerIds = [...new Set(Object.values(reviewerAssignments))];
      distinctReviewerIds.forEach(revId => {
        if (!revId) return;
        const supInfo = (state.supervisorsMaster || []).find(s => s.id === revId || s.email === revId);
        addCandidate({
          type: 'reviewer',
          id: revId,
          name: supInfo?.name || revId,
          email: supInfo?.email || (revId.includes('@') ? revId : ''),
          roundId: r.id,
          roundTitle: r.roundName || r.title || r.id,
          roundShortCode: r.shortCode || '',
          roundAcademicYear: r.academicYear || '',
          roleLabel: 'Giảng viên phản biện (Reviewer)'
        });
      });
    }
  }

  // 4. COUNCIL MEMBERS (from round.activities councils)
  if (roleFilter === 'all' || roleFilter === 'council') {
    const targetRounds = (roundFilter !== 'all')
      ? (state.rounds || []).filter(r => r.id === roundFilter)
      : (state.rounds || []);

    for (const r of targetRounds) {
      const actsWithCouncils = (r.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils));
      for (const act of actsWithCouncils) {
        for (const c of (act.councils || [])) {
          const members = Object.values(c.membersBySlot || {});
          for (const m of members) {
            if (m.memberEmail) {
              const roleTitle = m.slotName || m.memberRole || 'Thành viên Hội đồng';
              addCandidate({
                type: 'council',
                id: m.memberId || m.memberEmail,
                name: m.memberName || m.memberEmail,
                email: m.memberEmail,
                roundId: r.id,
                roundTitle: r.roundName || r.title || r.id,
                roundShortCode: r.shortCode || '',
                roundAcademicYear: r.academicYear || '',
                councilId: c.id,
                councilName: c.councilName || c.name || 'Hội đồng',
                councilRole: roleTitle,
                activityName: act.title || act.name,
                roleLabel: `${roleTitle} - ${c.councilName || c.name || 'Hội đồng'}`
              });
            }
          }
        }
      }
    }
  }

  // 5. PRELIMINARY (Cán bộ Sơ khảo)
  if (roleFilter === 'all' || roleFilter === 'preliminary') {
    const targetRounds = (roundFilter !== 'all')
      ? (state.rounds || []).filter(r => r.id === roundFilter)
      : (state.rounds || []);

    for (const r of targetRounds) {
      const scorerIds = r.preliminaryConfig?.scorerIds || [];
      scorerIds.forEach(scorerId => {
        const s = (state.supervisorsMaster || []).find(item => item.id === scorerId || item.email === scorerId);
        const scorerEmail = s?.email || (String(scorerId).includes('@') ? String(scorerId) : '');
        if (scorerEmail) {
          addCandidate({
            type: 'preliminary',
            id: s?.id || scorerId,
            name: s?.name || scorerEmail,
            email: scorerEmail,
            department: s?.department || '',
            roundId: r.id,
            roundTitle: r.roundName || r.title || r.id,
            roundShortCode: r.shortCode || '',
            roundAcademicYear: r.academicYear || '',
            roleLabel: 'Cán bộ chấm Sơ khảo'
          });
        }
      });
    }
  }

  // Enrich students from the authoritative Faculty Student Master after the
  // eligibleStudents + registrations union has been built and deduplicated.
  candidates.filter(c => c.type === 'student').forEach(candidate => {
    const sid = String(candidate.mssv || candidate.id || '').trim().replace(/\s+/g, '').toUpperCase();
    candidate.id = sid;
    candidate.mssv = sid;
    const master = typeof window.getFacultyStudentByMssv === 'function'
      ? window.getFacultyStudentByMssv(sid)
      : null;
    if (master) {
      candidate.name = master.fullName || master.name || candidate.name || sid;
      candidate.email = master.email || candidate.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`;
      candidate.major = master.major || master.majorName || '';
      candidate.className = master.className || master.studentClass || '';
      candidate.notFoundInMaster = false;
    } else {
      const currentName = String(candidate.name || '').trim();
      candidate.name = currentName && currentName.toUpperCase() !== sid ? currentName : sid;
      candidate.notFoundInMaster = state.facultyStudentsLoaded === true;
    }
  });

  // Filter candidates by search query
  const filtered = candidates.filter(c => {
    if (!searchQuery) return true;
    const matchName = (c.name || '').toLowerCase().includes(searchQuery);
    const matchEmail = (c.email || '').toLowerCase().includes(searchQuery);
    const matchMssv = (c.mssv || '').toLowerCase().includes(searchQuery);
    const matchCode = (c.code || '').toLowerCase().includes(searchQuery);
    const matchDept = (c.department || '').toLowerCase().includes(searchQuery);
    const matchTopic = (c.topicTitle || '').toLowerCase().includes(searchQuery);
    const matchRole = (c.roleLabel || '').toLowerCase().includes(searchQuery);
    return matchName || matchEmail || matchMssv || matchCode || matchDept || matchTopic || matchRole;
  });

  return filtered;
}
window.gatherRoundCandidates = gatherRoundCandidates;

window.openAdminImpersonateModal = function() {
  if (!state.allowImpersonation || !state.realIsAdmin) {
    showToast('Tính năng đóng vai chưa được bật trong Cài đặt hệ thống hoặc bạn không có quyền.', 'warning');
    return;
  }

  const roundSelect = document.getElementById('impersonate-filter-round');
  if (roundSelect) {
    const rounds = (state.rounds || []).filter(r => !r.deleted);
    let opts = '<option value="all">-- Tất cả các đợt --</option>';
    rounds.forEach(r => {
      const isAct = r.isActive ? ' (Hiện hành)' : '';
      opts += `<option value="${r.id}">${escapeHtml(r.roundName || r.title || r.id)}${isAct}</option>`;
    });
    roundSelect.innerHTML = opts;
    if (state.selectedRoundId && rounds.some(r => r.id === state.selectedRoundId)) {
      roundSelect.value = state.selectedRoundId;
    }
  }

  const roleSelect = document.getElementById('impersonate-filter-role');
  if (roleSelect) roleSelect.value = 'all';

  const searchInput = document.getElementById('impersonate-search-input');
  if (searchInput) searchInput.value = '';

  const modal = document.getElementById('modal-admin-impersonate');
  if (modal) modal.classList.remove('hidden');

  state.selectedImpersonateCandidate = null;
  const confirmBtn = document.getElementById('btn-confirm-impersonate');
  const confirmText = document.getElementById('btn-confirm-impersonate-text');
  if (confirmBtn) confirmBtn.disabled = true;
  if (confirmText) confirmText.textContent = 'Bắt đầu đóng vai';

  gatherAndRenderImpersonateCandidates();
};

window.closeAdminImpersonateModal = function() {
  const modal = document.getElementById('modal-admin-impersonate');
  if (modal) modal.classList.add('hidden');
};

window.onImpersonateFiltersChange = function() {
  state.selectedImpersonateCandidate = null;
  const confirmBtn = document.getElementById('btn-confirm-impersonate');
  const confirmText = document.getElementById('btn-confirm-impersonate-text');
  if (confirmBtn) confirmBtn.disabled = true;
  if (confirmText) confirmText.textContent = 'Bắt đầu đóng vai';

  gatherAndRenderImpersonateCandidates();
};

let impersonateSearchTimer = null;
window.onImpersonateSearchInput = function() {
  clearTimeout(impersonateSearchTimer);
  impersonateSearchTimer = setTimeout(() => {
    gatherAndRenderImpersonateCandidates();
  }, 250);
};

async function gatherAndRenderImpersonateCandidates() {
  const roundFilter = document.getElementById('impersonate-filter-round')?.value || 'all';
  const roleFilter = document.getElementById('impersonate-filter-role')?.value || 'all';
  const searchQuery = (document.getElementById('impersonate-search-input')?.value || '').trim().toLowerCase();
  const listEl = document.getElementById('impersonate-candidates-list');
  const countEl = document.getElementById('impersonate-candidate-count');

  if (listEl) {
    listEl.innerHTML = '<div class="text-center py-6 text-slate-400">Đang tải danh sách người dùng thực tế...</div>';
  }

  if ((roleFilter === 'student' || roleFilter === 'all') && typeof ensureFacultyDatasetLoaded === 'function') {
    await ensureFacultyDatasetLoaded().catch(error => console.warn('[ActAs] Student Master load notice:', error));
  }
  if (roleFilter !== 'student' && typeof ensureSupervisorsMasterLoaded === 'function') {
    await ensureSupervisorsMasterLoaded().catch(error => console.warn('[ActAs] Lecturer directory load notice:', error));
  }

  const filtered = await gatherRoundCandidates(roundFilter, roleFilter, searchQuery);

  filtered.forEach((c, idx) => {
    c.candKey = `cand_${idx}`;
  });
  state.impersonateCandidates = filtered;

  if (countEl) countEl.textContent = String(filtered.length);

  if (listEl) {
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">Không tìm thấy người dùng thực tế phù hợp với bộ lọc.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(c => {
      let roleBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
      if (c.type === 'supervisor') roleBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      else if (c.type === 'reviewer') roleBadgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
      else if (c.type === 'council') roleBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
      else if (c.type === 'preliminary') roleBadgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';

      const isSelected = state.selectedImpersonateCandidate && state.selectedImpersonateCandidate.candKey === c.candKey;

      return `
        <div onclick="selectImpersonateCandidate('${c.candKey}')"
             ondblclick="confirmImpersonateCandidateDirectly('${c.candKey}')"
             id="cand-card-${c.candKey}"
             class="impersonate-candidate-card cursor-pointer p-3 bg-white hover:bg-amber-50/50 rounded-xl border ${isSelected ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-400/40' : 'border-slate-200'} transition-all flex items-center justify-between gap-3 shadow-2xs">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="flex items-center justify-center shrink-0 pr-1">
              <input type="radio" name="impersonate_candidate_radio" id="radio-${c.candKey}"
                     value="${c.candKey}"
                     ${isSelected ? 'checked' : ''}
                     onchange="selectImpersonateCandidate('${c.candKey}')"
                     class="w-4 h-4 text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer">
            </div>
            <div class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base shrink-0">
              ${c.type === 'student' ? '🎓' : (c.type === 'supervisor' ? '👨‍🏫' : (c.type === 'reviewer' ? '🔍' : (c.type === 'council' ? '⚖️' : '📋')))}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-slate-900 text-xs truncate">${escapeHtml(c.name)}</span>
                ${c.mssv ? `<span class="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">${escapeHtml(c.mssv)}</span>` : ''}
                ${c.type === 'student' ? `<span class="text-[10px] px-2 py-0.5 rounded-full font-bold border ${c.registrationStatus === 'Đã đăng ký' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}">${escapeHtml(c.registrationStatus || 'Chưa đăng ký')}</span>` : ''}
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold border ${roleBadgeColor}">
                  ${escapeHtml(c.roleLabel)}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-2 flex-wrap">
                <span>✉️ ${escapeHtml(c.email || '--')}</span>
                ${c.department ? `<span>• BM: ${escapeHtml(c.department)}</span>` : ''}
                ${c.className ? `<span>• Lớp: ${escapeHtml(c.className)}</span>` : ''}
                ${c.major ? `<span>• Ngành: ${escapeHtml(c.major)}</span>` : ''}
                ${c.notFoundInMaster ? '<span class="text-amber-700 font-semibold">• Chưa tìm thấy thông tin sinh viên</span>' : ''}
                ${c.roundTitle ? `<span class="text-amber-800 font-medium">• ${escapeHtml(c.roundTitle)}</span>` : ''}
                ${c.topicTitle ? `<span class="text-blue-700 font-medium italic truncate">• Đề tài: ${escapeHtml(c.topicTitle)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="shrink-0">
            <button type="button" onclick="event.stopPropagation(); selectImpersonateCandidate('${c.candKey}'); confirmImpersonateSelectedCandidate();" class="px-3 py-1.5 bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer">
              <span>🎭</span> <span>Chọn</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}
window.gatherAndRenderImpersonateCandidates = gatherAndRenderImpersonateCandidates;

window.selectImpersonateCandidate = function(candKey) {
  const list = state.impersonateCandidates || [];
  const cand = list.find(c => c.candKey === candKey);
  if (!cand) return;

  state.selectedImpersonateCandidate = cand;

  // Uncheck / unhighlight other cards
  document.querySelectorAll('.impersonate-candidate-card').forEach(el => {
    el.classList.remove('border-amber-500', 'bg-amber-50/80', 'ring-2', 'ring-amber-400/40');
    el.classList.add('border-slate-200', 'bg-white');
  });

  const card = document.getElementById(`cand-card-${candKey}`);
  if (card) {
    card.classList.remove('border-slate-200', 'bg-white');
    card.classList.add('border-amber-500', 'bg-amber-50/80', 'ring-2', 'ring-amber-400/40');
  }

  const radio = document.getElementById(`radio-${candKey}`);
  if (radio) {
    radio.checked = true;
  }

  const confirmBtn = document.getElementById('btn-confirm-impersonate');
  const confirmText = document.getElementById('btn-confirm-impersonate-text');
  if (confirmBtn) {
    confirmBtn.disabled = false;
  }
  if (confirmText) {
    const ident = cand.mssv || cand.email || cand.id || '';
    confirmText.textContent = `Bắt đầu đóng vai: ${cand.name} (${ident})`;
  }
};

window.confirmImpersonateCandidateDirectly = function(candKey) {
  window.selectImpersonateCandidate(candKey);
  window.confirmImpersonateSelectedCandidate();
};

window.confirmImpersonateSelectedCandidate = function() {
  if (!state.selectedImpersonateCandidate) {
    showToast('Vui lòng chọn một người dùng cụ thể từ danh sách.', 'warning');
    return;
  }
  window.startImpersonating(state.selectedImpersonateCandidate);
};

// Global window bridges for cross-module accessibility
window.preparePreviewStudentDropdown = preparePreviewStudentDropdown;
window.updateSettingsActAsSessionUI = updateSettingsActAsSessionUI;
