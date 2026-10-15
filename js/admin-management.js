/**
 * IFA+ Graduation — Admin Management & Role Governance Submodule (v2.7.0)
 * Allows System Owner (tranquanghai@tdtu.edu.vn) to grant, inspect, and revoke
 * business administrator privileges with email pre-provisioning & audit logging.
 */

import { state, showToast, showConfirm } from './core.js';
import { isSystemOwner } from './auth.js';

export const ROOT_OWNER_EMAIL = 'tranquanghai@tdtu.edu.vn';
export const ROOT_OWNER_NAME = 'ThS. NCS. Trần Quang Hải';

// Cache of loaded administrators
let adminsCache = [];

function formatAdminDate(ts) {
  if (!ts) return '';
  try {
    let dateObj;
    if (ts && typeof ts.toDate === 'function') {
      dateObj = ts.toDate();
    } else if (ts && ts.seconds) {
      dateObj = new Date(ts.seconds * 1000);
    } else {
      dateObj = new Date(ts);
    }
    if (isNaN(dateObj.getTime())) return '';
    if (typeof window.fmt24h === 'function') {
      return window.fmt24h(dateObj);
    }
    return dateObj.toLocaleString('vi-VN');
  } catch (e) {
    return '';
  }
}

/**
 * Loads the administrators list from Firestore `/admins` collection.
 * Strictly guarded for Owner only.
 */
export async function loadAdminsList(forceRefresh = false) {
  if (!state.realIsOwner) {
    console.warn('[AdminManagement] Access rejected: Owner role required.');
    return;
  }

  const tbody = document.getElementById('admins-list-tbody');
  if (tbody && (forceRefresh || adminsCache.length === 0)) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-400 italic">
          <div class="inline-flex items-center gap-2">
            <span class="animate-spin text-base">⏳</span>
            <span>Đang tải danh sách quản trị viên...</span>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const adminsColRef = collection(db, 'admins');
    const snap = await getDocs(adminsColRef);
    const list = [];

    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const docEmail = (data.email || docSnap.id || '').toLowerCase().trim();
      const isOwner = (docEmail === ROOT_OWNER_EMAIL);

      list.push({
        id: docSnap.id,
        email: docEmail,
        displayName: data.displayName || (isOwner ? ROOT_OWNER_NAME : ''),
        role: isOwner ? 'owner' : (data.role || 'admin'),
        status: data.status || 'active',
        grantedAt: data.grantedAt || null,
        grantedBy: data.grantedBy || '',
        isProtected: isOwner
      });
    });

    // Ensure root system owner is always present even if /admins is clean
    const hasRootOwner = list.some(a => a.email === ROOT_OWNER_EMAIL);
    if (!hasRootOwner) {
      list.unshift({
        id: ROOT_OWNER_EMAIL,
        email: ROOT_OWNER_EMAIL,
        displayName: ROOT_OWNER_NAME,
        role: 'owner',
        status: 'active',
        grantedAt: null,
        grantedBy: 'Root Administrator (Hệ thống gốc)',
        isProtected: true
      });
    } else {
      const ownerObj = list.find(a => a.email === ROOT_OWNER_EMAIL);
      if (ownerObj) {
        ownerObj.role = 'owner';
        ownerObj.isProtected = true;
        if (!ownerObj.displayName) ownerObj.displayName = ROOT_OWNER_NAME;
      }
    }

    // Sort: Owner first, then by email
    list.sort((a, b) => {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      return a.email.localeCompare(b.email);
    });

    adminsCache = list;
    state.adminsCache = list;
    renderAdminsTable(list);
  } catch (err) {
    console.error('[AdminManagement] loadAdminsList failed:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-rose-500 font-semibold">
            ✕ Không thể tải danh sách quản trị viên: ${window.escapeHtml ? window.escapeHtml(err.message) : err.message}
          </td>
        </tr>
      `;
    }
    if (typeof showToast === 'function') {
      showToast('Lỗi tải danh sách quản trị viên: ' + err.message, 'error');
    }
  }
}

/**
 * Renders the administrators table and updates KPI stats
 */
export function renderAdminsTable(list = []) {
  const tbody = document.getElementById('admins-list-tbody');
  const statTotal = document.getElementById('stat-total-admins');
  const statOwner = document.getElementById('stat-owner-count');
  const statBusiness = document.getElementById('stat-business-admins');

  const totalCount = list.length;
  const ownerCount = list.filter(a => a.role === 'owner' || a.email === ROOT_OWNER_EMAIL).length;
  const businessCount = Math.max(0, totalCount - ownerCount);

  if (statTotal) statTotal.textContent = totalCount;
  if (statOwner) statOwner.textContent = ownerCount;
  if (statBusiness) statBusiness.textContent = businessCount;

  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-400 italic">
          Chưa có quản trị viên nào trong hệ thống.
        </td>
      </tr>
    `;
    return;
  }

  const escape = window.escapeHtml || (s => String(s || ''));

  const rowsHtml = list.map((admin, idx) => {
    const isOwner = (admin.role === 'owner' || admin.email === ROOT_OWNER_EMAIL);
    const dateStr = formatAdminDate(admin.grantedAt) || (isOwner ? 'Mặc định hệ thống' : 'Chưa ghi nhận');
    const byStr = admin.grantedBy ? escape(admin.grantedBy) : (isOwner ? 'Hệ thống gốc' : 'Quản trị viên');
    const nameStr = admin.displayName ? escape(admin.displayName) : '<span class="text-slate-400 italic">Chưa cập nhật</span>';

    const roleBadge = isOwner
      ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">👑 Chủ sở hữu (Owner)</span>`
      : `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 whitespace-nowrap">🛡️ Quản trị viên (Admin)</span>`;

    const statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">● Hoạt động</span>`;

    const actionCell = isOwner || admin.isProtected
      ? `<span class="text-[11px] text-slate-400 font-medium italic px-2 py-1 bg-slate-100 rounded-lg whitespace-nowrap">🔒 Không thể thu hồi</span>`
      : `<button type="button" onclick="revokeAdmin('${escape(admin.email)}', '${escape(admin.displayName || '')}')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 transition-all cursor-pointer flex items-center gap-1 ml-auto whitespace-nowrap shadow-2xs"><span>🗑️</span> Thu hồi</button>`;

    return `
      <tr class="hover:bg-slate-50/80 transition-colors ${isOwner ? 'bg-amber-50/30' : ''}">
        <td class="p-3.5 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
        <td class="p-3.5 font-bold text-slate-900">${nameStr}</td>
        <td class="p-3.5 font-mono text-xs text-slate-700">${escape(admin.email)}</td>
        <td class="p-3.5">${roleBadge}</td>
        <td class="p-3.5">${statusBadge}</td>
        <td class="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">${dateStr}</td>
        <td class="p-3.5 text-slate-500 text-[11px] truncate max-w-[160px]" title="${byStr}">${byStr}</td>
        <td class="p-3.5 text-right">${actionCell}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}

/**
 * Filter admins table by search term
 */
export function filterAdminsTable(term = '') {
  const queryStr = (term || '').toLowerCase().trim();
  if (!queryStr) {
    renderAdminsTable(adminsCache);
    return;
  }

  const filtered = adminsCache.filter(a => {
    const em = (a.email || '').toLowerCase();
    const name = (a.displayName || '').toLowerCase();
    const role = (a.role || '').toLowerCase();
    return em.includes(queryStr) || name.includes(queryStr) || role.includes(queryStr);
  });

  renderAdminsTable(filtered);
}

/**
 * Open modal to add a new admin
 */
export function openAddAdminModal() {
  if (!state.realIsOwner) {
    showToast('Từ chối truy cập: Chỉ Chủ sở hữu hệ thống (Owner) mới có quyền cấp quyền Admin.', 'error');
    return;
  }

  const form = document.getElementById('form-add-admin');
  if (form) form.reset();

  const modal = document.getElementById('modal-add-admin');
  if (modal) {
    modal.classList.remove('hidden');
    const input = document.getElementById('add-admin-email');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

/**
 * Close modal
 */
export function closeAddAdminModal() {
  const modal = document.getElementById('modal-add-admin');
  if (modal) modal.classList.add('hidden');
}

/**
 * Submit handler for adding a new admin
 */
export async function submitAddAdmin(event) {
  if (event && event.preventDefault) event.preventDefault();

  if (!state.realIsOwner) {
    showToast('Từ chối truy cập: Chỉ Chủ sở hữu hệ thống (Owner) mới có quyền cấp quyền Admin.', 'error');
    return;
  }

  const emailInput = document.getElementById('add-admin-email');
  const nameInput = document.getElementById('add-admin-fullname');
  const submitBtn = document.getElementById('btn-submit-add-admin');

  const rawEmail = emailInput ? emailInput.value : '';
  const fullName = nameInput ? nameInput.value.trim() : '';
  const normalizedEmail = (rawEmail || '').toLowerCase().trim();

  // 1. Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    showToast('Định dạng email Google không hợp lệ. Vui lòng kiểm tra lại.', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  // 2. Prevent adding root owner
  if (normalizedEmail === ROOT_OWNER_EMAIL) {
    showToast('Tài khoản này là Chủ sở hữu hệ thống (Owner) gốc, không cần cấp lại.', 'warning');
    return;
  }

  // 3. Cache duplicate check
  if (adminsCache.some(a => a.email === normalizedEmail)) {
    showToast(`Tài khoản "${normalizedEmail}" đã có trong danh sách Quản trị viên!`, 'warning');
    return;
  }

  // 4. Save to Firestore
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳</span><span>Đang xử lý...</span>`;
    }

    // Check direct doc existence in Firestore
    const adminDocRef = doc(db, 'admins', normalizedEmail);
    const existingSnap = await getDoc(adminDocRef);
    if (existingSnap.exists()) {
      showToast(`Tài khoản "${normalizedEmail}" đã được cấp quyền trước đó!`, 'warning');
      closeAddAdminModal();
      await loadAdminsList(true);
      return;
    }

    const currentActor = state.user?.email || ROOT_OWNER_EMAIL;

    // Persist to /admins/{normalizedEmail}
    await setDoc(adminDocRef, {
      email: normalizedEmail,
      displayName: fullName || '',
      role: 'admin',
      status: 'active',
      grantedAt: serverTimestamp(),
      grantedBy: currentActor,
      updatedAt: serverTimestamp()
    });

    // Write audit log to /auditLogs
    try {
      await addDoc(collection(db, 'auditLogs'), {
        actorEmail: currentActor,
        by: currentActor,
        action: 'grant_admin',
        targetEmail: normalizedEmail,
        detail: `Cấp quyền Quản trị viên (Admin) cho tài khoản ${normalizedEmail}${fullName ? ' (' + fullName + ')' : ''}`,
        timestamp: serverTimestamp()
      });
    } catch (auditErr) {
      console.warn('[AdminManagement] Audit log write warning:', auditErr);
    }

    showToast(`Đã cấp quyền Quản trị viên thành công cho ${normalizedEmail}`, 'success', 4500);
    closeAddAdminModal();
    await loadAdminsList(true);
  } catch (err) {
    console.error('[AdminManagement] submitAddAdmin failed:', err);
    showToast('Không thể cấp quyền Quản trị viên: ' + err.message, 'error', 5000);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>🛡️</span><span>Cấp quyền Admin</span>`;
    }
  }
}

/**
 * Revoke administrator privilege
 */
export async function revokeAdmin(email, displayName = '') {
  if (!state.realIsOwner) {
    showToast('Từ chối truy cập: Chỉ Chủ sở hữu hệ thống (Owner) mới có quyền thu hồi Admin.', 'error');
    return;
  }

  const normalizedEmail = (email || '').toLowerCase().trim();

  // Root owner protection
  if (normalizedEmail === ROOT_OWNER_EMAIL) {
    showToast('Không thể thu hồi quyền của Chủ sở hữu hệ thống (Owner) gốc!', 'error', 5000);
    return;
  }

  const nameLabel = displayName ? ` (${displayName})` : '';
  const confirmed = await showConfirm(
    'Thu hồi quyền Quản trị viên',
    `Bạn có chắc chắn muốn thu hồi quyền Admin của tài khoản:\n\n• Email: ${normalizedEmail}${nameLabel}\n\nSau khi thu hồi, tài khoản sẽ mất ngay toàn bộ quyền truy cập Cổng Quản trị. Dữ liệu đợt tốt nghiệp và phân công do Admin này tạo vẫn được bảo toàn nguyên vẹn.`,
    { confirmText: 'Thu hồi quyền', cancelText: 'Hủy', danger: true }
  );

  if (!confirmed) return;

  try {
    const adminDocRef = doc(db, 'admins', normalizedEmail);
    await deleteDoc(adminDocRef);

    // Write audit log
    const currentActor = state.user?.email || ROOT_OWNER_EMAIL;
    try {
      await addDoc(collection(db, 'auditLogs'), {
        actorEmail: currentActor,
        by: currentActor,
        action: 'revoke_admin',
        targetEmail: normalizedEmail,
        detail: `Thu hồi quyền Quản trị viên của tài khoản ${normalizedEmail}${nameLabel}`,
        timestamp: serverTimestamp()
      });
    } catch (auditErr) {
      console.warn('[AdminManagement] Audit log write warning:', auditErr);
    }

    showToast(`Đã thu hồi quyền Quản trị viên của ${normalizedEmail}`, 'info', 4000);
    await loadAdminsList(true);
  } catch (err) {
    console.error('[AdminManagement] revokeAdmin failed:', err);
    showToast('Không thể thu hồi quyền Admin: ' + err.message, 'error', 5000);
  }
}

// Global bridges
if (typeof window !== 'undefined') {
  window.loadAdminsList = loadAdminsList;
  window.renderAdminsTable = renderAdminsTable;
  window.filterAdminsTable = filterAdminsTable;
  window.openAddAdminModal = openAddAdminModal;
  window.closeAddAdminModal = closeAddAdminModal;
  window.submitAddAdmin = submitAddAdmin;
  window.revokeAdmin = revokeAdmin;
}
