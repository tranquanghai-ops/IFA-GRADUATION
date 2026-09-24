/**
 * IFA+ Graduation — Impersonation System Settings & Realtime Sync
 */
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