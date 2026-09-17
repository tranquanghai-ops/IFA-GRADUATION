
function getCurrentPortal() {
  try {
    const path = (window.location.pathname || '').toLowerCase();
    if (path.includes('/graduation/admin') || path.endsWith('/admin') || path.endsWith('/admin/')) {
      return 'admin';
    }
    if (path.includes('/graduation/supervisor') || path.endsWith('/supervisor') || path.endsWith('/supervisor/') ||
        path.includes('/graduation/gvhd') || path.endsWith('/gvhd') || path.endsWith('/gvhd/')) {
      if (path.includes('/graduation/gvhd') || path.endsWith('/gvhd') || path.endsWith('/gvhd/')) {
        try {
          window.history.replaceState(null, '', '/graduation/supervisor/');
        } catch (e) {}
      }
      return 'supervisor';
    }
    if (path.includes('/graduation/assessment') || path.endsWith('/assessment') || path.endsWith('/assessment/') ||
        path.includes('/graduation/mark') || path.endsWith('/mark') || path.endsWith('/mark/')) {
      if (path.includes('/graduation/mark') || path.endsWith('/mark') || path.endsWith('/mark/')) {
        try {
          window.history.replaceState(null, '', '/graduation/assessment/');
        } catch (e) {}
      }
      return 'assessment';
    }
    if (path.includes('/graduation') || path === '/' || path.endsWith('/graduation/')) {
      return 'student';
    }
  } catch (e) {}
  return 'student';
}
window.getCurrentPortal = getCurrentPortal;
window.detectInitialPortal = getCurrentPortal;


window.escapeHtml = function(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
window.fmtIsoToVietnameseDateTime = function(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${hh}:${mm} ${dd}/${mo}/${yy}`;
  } catch (e) {
    return '';
  }
};
// Expose module-level constants to fix ReferenceErrors inside the module
const escapeHtml = window.escapeHtml;
const fmtIsoToVietnameseDateTime = window.fmtIsoToVietnameseDateTime;


// ============================================================================
// OFFICIAL SUPERVISORS HELPERS (v1.6.0-beta.3)
// ============================================================================
export function getOfficialSupervisors(reg) {
  if (!reg) return [];
  if (Array.isArray(reg.officialSupervisors) && reg.officialSupervisors.length > 0) {
    return reg.officialSupervisors;
  }
  // Backward compatibility: derive from acceptedSupervisorId / finalSupervisorId
  const primaryId = reg.acceptedSupervisorId || reg.finalSupervisorId;
  if (primaryId) {
    return [{
      supervisorId: primaryId,
      supervisorName: reg.acceptedSupervisorName || '',
      source: 'preference',
      role: 'primary',
      addedAt: reg.acceptedAt || reg.updatedAt || new Date().toISOString()
    }];
  }
  return [];
}

export function isOfficialSupervisor(reg, supervisorId) {
  if (!reg || !supervisorId) return false;
  const list = getOfficialSupervisors(reg);
  return list.some(s => s.supervisorId === supervisorId);
}

export function getPreliminaryExcludedSupervisorIds(reg) {
  if (!reg) return [];
  const list = getOfficialSupervisors(reg);
  return list.map(s => s.supervisorId);
}

export function getSupervisorTotalAssignedCount(supId, registrations = []) {
  if (!supId || !Array.isArray(registrations)) return 0;
  return registrations.filter(r => {
    if (r.reviewStatus !== 'accepted' && r.reviewStatus !== 'manually_assigned') return false;
    return isOfficialSupervisor(r, supId);
  }).length;
}

/** IFA+ Graduation Beta Studio v2.6.0-beta.1 (Admin Impersonation / Act-As Test Mode) **/

// Override native alert to use non-blocking toast
window.alert = function(msg) {
  if (window.showToast) {
    window.showToast(String(msg), 'info');
  } else {
    console.log('[Alert]', msg);
  }
};


window.handleSupervisorDeptChange = function(val) {
  const customInput = document.getElementById('sup-form-dept-custom');
  const hiddenDept = document.getElementById('sup-form-dept');
  if (val === '__other__') {
    if (customInput) customInput.classList.remove('hidden');
    if (hiddenDept && customInput) hiddenDept.value = customInput.value.trim() || 'Khác';
  } else {
    if (customInput) customInput.classList.add('hidden');
    if (hiddenDept) hiddenDept.value = val;
  }
};


// ============================================================================
// UI HELPERS: TOAST NOTIFICATIONS & CUSTOM CONFIRM MODAL (NO ALERT/CONFIRM)
// ============================================================================


window.showToast = function(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.log(`[Toast ${type}] ${message}`);
    return;
  }
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠️',
    info: 'ℹ️'
  };
  const bgColors = {
    success: 'bg-emerald-600 text-white border-emerald-500',
    error: 'bg-rose-600 text-white border-rose-500',
    warning: 'bg-amber-500 text-slate-900 border-amber-400',
    info: 'bg-slate-900 text-white border-slate-800'
  };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold transform transition-all duration-200 translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold">${icons[type] || 'ℹ️'}</span>
    <span class="flex-1 leading-snug">${message}</span>
    <button type="button" class="text-white/60 hover:text-white font-bold ml-1">✕</button>
  `;

  const closeBtn = toast.querySelector('button');
  const removeToast = () => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 200);
  };
  closeBtn.onclick = removeToast;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  });

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
};

window.showConfirm = function(title, message, { confirmText = 'Xác nhận', cancelText = 'Hủy', danger = true } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirm');
    if (!modal) {
      resolve(true);
      return;
    }
    const titleEl = document.getElementById('modal-confirm-title');
    const msgEl = document.getElementById('modal-confirm-message');
    const iconEl = document.getElementById('modal-confirm-icon');
    const okBtn = document.getElementById('modal-confirm-btn-ok');
    const cancelBtn = document.getElementById('modal-confirm-btn-cancel');

    if (titleEl) titleEl.textContent = title || 'Xác nhận';
    if (msgEl) msgEl.textContent = message || '';
    if (iconEl) {
      iconEl.className = danger 
        ? 'w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 text-xl font-bold' 
        : 'w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-xl font-bold';
      iconEl.textContent = danger ? '⚠️' : '❓';
    }
    if (okBtn) {
      okBtn.textContent = confirmText;
      okBtn.className = danger
        ? 'px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors'
        : 'px-5 py-2 bg-tdtu-blue hover:bg-tdtu-dark text-white rounded-xl font-bold text-xs shadow-md transition-colors';
    }
    if (cancelBtn) cancelBtn.textContent = cancelText;

    const cleanup = (result) => {
      modal.classList.add('hidden');
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(result);
    };

    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    modal.classList.remove('hidden');
  });
};

// Safe Vietnamese slug generator
window.slugify = function(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Canonical supervisor ID resolver
export function getSupervisorId(s) {
  if (!s) return '';
  return String(s.id || s.supervisorId || s.email || (s.name ? slugify(s.name) : '')).trim();
}
window.getSupervisorId = getSupervisorId;

// Toggle "Mở ngay" checkbox
window.toggleRoundOpenImmediately = function(openNow) {
  const dateInput = document.getElementById('round-open-date');
  const hourSelect = document.getElementById('round-open-hour');
  const minSelect = document.getElementById('round-open-minute');
  if (dateInput) {
    dateInput.disabled = !!openNow;
    if (openNow) {
      dateInput.removeAttribute('required');
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      dateInput.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    } else {
      dateInput.setAttribute('required', 'required');
    }
  }
  if (hourSelect) hourSelect.disabled = !!openNow;
  if (minSelect) minSelect.disabled = !!openNow;
};


// Removed legacy copyRoundLink. Now unified at ?x=

/**
 * IFA+ Graduation — App Logic & Firestore Integration
 * Version: v1.1.0 (Phase 2A Multi-Round Review Workflow)
 * Khoa Mỹ thuật Công nghiệp — Đại học Tôn Đức Thắng
 */

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { 
  getStorage, 
  ref as storageRef, 
  getBytes as storageGetBytes 
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc as rawAddDoc,
  setDoc as rawSetDoc, 
  updateDoc as rawUpdateDoc, 
  deleteDoc as rawDeleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  writeBatch as rawWriteBatch,
  runTransaction as rawRunTransaction,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// Central Read-Only Write Guard for Impersonation / Act-As Safe Mode
export function assertNotImpersonatingForWrite(actionName = 'Thao tác') {
  if (state.impersonation) {
    const targetName = state.impersonation.target?.name || 'người dùng';
    const roleLabel = state.impersonation.target?.roleLabel || state.impersonation.target?.type || 'chế độ đóng vai';
    const msg = `[CHẾ ĐỘ CHỈ ĐỌC] Thao tác ghi (${actionName}) bị chặn khi đang đóng vai ${targetName} (${roleLabel}). Không có dữ liệu nào bị thay đổi.`;
    console.warn(`[Impersonation Guard] Blocked write operation: ${actionName}`, state.impersonation);
    if (typeof showToast === 'function') {
      showToast(msg, 'warning', 6000);
    } else {
      alert(msg);
    }
    const err = new Error(msg);
    err.code = 'permission-denied-impersonation-readonly';
    throw err;
  }
}
window.assertNotImpersonatingForWrite = assertNotImpersonatingForWrite;

export async function setDoc(...args) {
  assertNotImpersonatingForWrite('setDoc');
  return await rawSetDoc(...args);
}

export async function updateDoc(...args) {
  assertNotImpersonatingForWrite('updateDoc');
  return await rawUpdateDoc(...args);
}

export async function addDoc(...args) {
  assertNotImpersonatingForWrite('addDoc');
  return await rawAddDoc(...args);
}

export async function deleteDoc(...args) {
  assertNotImpersonatingForWrite('deleteDoc');
  return await rawDeleteDoc(...args);
}

export function writeBatch(firestore) {
  assertNotImpersonatingForWrite('writeBatch');
  const batch = rawWriteBatch(firestore);
  const origCommit = batch.commit.bind(batch);
  batch.commit = async function() {
    assertNotImpersonatingForWrite('writeBatch.commit');
    return await origCommit();
  };
  return batch;
}

export async function runTransaction(firestore, updateFunction) {
  assertNotImpersonatingForWrite('runTransaction');
  return await rawRunTransaction(firestore, updateFunction);
}

window.setDoc = setDoc;
window.updateDoc = updateDoc;
window.addDoc = addDoc;
window.deleteDoc = deleteDoc;
window.writeBatch = writeBatch;
window.runTransaction = runTransaction;


export const DEFAULT_PROJECT_TYPES = [
  "Nhà ở dân dụng",
  "Thương mại dịch vụ",
  "Cảnh quan",
  "Giáo dục / nghiên cứu",
  "Văn phòng",
  "Văn hóa / triển lãm / bảo tàng",
  "Resort / khách sạn",
  "F&B – Nhà hàng / Cafe / Bar / Pub",
  "Dịch vụ sức khỏe",
  "Bến tàu / bến xe",
  "Khác"
];




// 24H Date formatting helpers
// 24H Date formatting helpers (Strict Vietnamese DD/MM/YYYY & HH:mm)
export const fmt24h = d => {
  if (!d) return '--';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '--';
  const pad = n => String(n).padStart(2, '0');
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const dd = pad(date.getDate());
  const MM = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  return `${dd}/${MM}/${yyyy} ${hh}:${mm}`;
};

export const fmtDateRange24h = (d1, d2) => {
  if (!d1 || !d2) return '--';
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return '--';
  const pad = n => String(n).padStart(2, '0');
  const d1Str = `${pad(date1.getDate())}/${pad(date1.getMonth() + 1)}/${date1.getFullYear()}`;
  const t1Str = `${pad(date1.getHours())}:${pad(date1.getMinutes())}`;
  const d2Str = `${pad(date2.getDate())}/${pad(date2.getMonth() + 1)}/${date2.getFullYear()}`;
  const t2Str = `${pad(date2.getHours())}:${pad(date2.getMinutes())}`;
  if (d1Str === d2Str) {
    return `${d1Str} ${t1Str} → ${t2Str}`;
  }
  return `${d1Str} ${t1Str} → ${d2Str} ${t2Str}`;
};

window.copyRoundLink = function(roundId, shortCode) {
  const r = (state.rounds || []).find(x => x.id === roundId);
  const code = r?.slug || r?.shortCode || shortCode || roundId;
  const link = `${window.location.origin}${window.location.pathname}?x=${encodeURIComponent(code)}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      showToast('Đã sao chép link đợt: ' + link, 'success');
    }).catch(() => {
      prompt('Link đợt tốt nghiệp:', link);
    });
  } else {
    prompt('Link đợt tốt nghiệp:', link);
  }
};

// --- STATE MANAGEMENT ---
export const state = {
  user: null,
  actualRole: 'student', // 'admin' | 'supervisor' | 'student'
  currentView: 'student', // 'admin' | 'supervisor' | 'student'
  role: 'student', // backward compatibility
  isAdmin: false,
  isSupervisor: false,
  isStudent: false,
  studentMssv: '',
  isEligible: false,
  
  // Impersonation / Act-As Test Mode State (v2.6.0-beta.1)
  realUser: null,
  realIsAdmin: false,
  realIsOwner: false,
  impersonation: null, // { realUser, target, mode: 'read_only', startedAt }
  allowImpersonation: false,
  impersonateCandidates: [],
  impersonateFilterRound: 'all',
  impersonateFilterRole: 'all',
  impersonateSearchQuery: '',
  
  // Active Data
  rounds: [],
  selectedRoundId: null,
  activeRound: null,
  projectTypes: DEFAULT_PROJECT_TYPES.map((name, idx) => ({ id: 'default_' + (idx + 1), name, order: idx + 1, active: true })),
  supervisorsMaster: [],
  facultyStudents: [],
  facultyStudentsMap: new Map(),
  roundSupervisors: [],
  eligibleStudents: [],
  myRegistration: null,
  
  // Registration Flow State
  currentStep: 1,
  wizardRank: 1,
  selectedPreferences: [], // [{ rank: 1, supervisorId, supervisorName, photoUrl, department }]
  
  // Preview Mode
  isPreviewMode: false,
  previewMssv: '',
  
  // Excel Staging
  excelStaging: [],

  // Phase 2A: Supervisor Review State
  supervisorDecisions: {}, // { [studentId]: 'selected' | 'not_selected' }
  supervisorCandidates: [],
  supervisorAcceptedStudents: [],
  supervisorRoundProgress: {},
  supervisorTab: 'review',

  // Phase 2A: Admin Review State
  adminReviewData: {
    supervisors: [],
    registrations: [],
    decisions: [],
    eligible: []
  },
  inspectingSupervisorId: null,
  manualAssignStudentId: null
};

window.state = state;

let app, auth, db;
let countdownInterval = null;

// --- LOADING OVERLAY HELPERS ---
export function showLoading(msg = 'Đang tải IFA+ Graduation...') {
  const overlay = document.getElementById('app-loading-overlay');
  const msgEl = document.getElementById('app-loading-msg');
  if (msgEl) msgEl.textContent = msg;
  if (overlay) {
    overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
  }
}

export function hideLoading() {
  const overlay = document.getElementById('app-loading-overlay');
  if (overlay) {
    overlay.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => overlay.classList.add('hidden'), 300);
  }
}



// --- INITIALIZATION ---
async function initFirebase() {
  const config = {
    apiKey: "AIzaSyA7HDp4XThUSN2XO3m0GoBGnYf-nFjvM_M",
    authDomain: "tknt-tdtu.firebaseapp.com",
    projectId: "tknt-tdtu",
    storageBucket: "tknt-tdtu.firebasestorage.app",
    messagingSenderId: "52631763904"
  };
  app = getApps().length > 0 ? getApp() : initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}



// --- AUTH & ROLES ---
export function isSystemOwner(user = null) {
  const targetUser = user || state.realUser || state.user || auth?.currentUser;
  const email = (targetUser?.email || '').toLowerCase().trim();
  return email === 'tranquanghai@tdtu.edu.vn';
}
window.isSystemOwner = isSystemOwner;

export async function setupAuthListener() {
  showLoading('Đang khởi tạo IFA+ Graduation Beta...');

  // Fallback an toàn: Loading overlay bắt buộc phải ẩn sau tối đa 6 giây
  const safetyTimer = setTimeout(() => {
    hideLoading();
  }, 6000);

  onAuthStateChanged(auth, async user => {
    state.realUser = user;
    state.user = user;

    if (user) {
      document.getElementById('login-required-section').classList.add('hidden');
      
      try {
        // 1. Phân giải quyền nhanh
        showLoading('Đang xác định vai trò người dùng...');
        try {
          await Promise.race([
            resolveActualRoles(user),
            new Promise(r => setTimeout(r, 2500))
          ]);
        } catch (e) {
          console.warn('[IFA-Graduation] Role resolution notice:', e);
        }

        state.realIsAdmin = Boolean(state.isAdmin);
        state.realIsOwner = isSystemOwner(user);

        // 1.1 Tải thiết lập hệ thống và kích hoạt Realtime Listener
        setupSystemSettingsRealtimeListener();
        try {
          await loadSystemSettingsDoc();
        } catch (e) {}

        // 1.2 Khôi phục phiên đóng vai (nếu có và hợp lệ)
        if (state.allowImpersonation && state.realIsAdmin) {
          loadImpersonationSession();
        } else {
          try { sessionStorage.removeItem('ifa_graduation_impersonation'); } catch (e) {}
          state.impersonation = null;
        }

        updateAuthUI();

        // 2. Kích hoạt ngay view ban đầu để UI hiển thị tức thì
        const detectedPortal = getCurrentPortal();
        let initView = 'student';
        if (detectedPortal === 'admin') {
          initView = 'admin';
        } else if (detectedPortal === 'supervisor') {
          initView = 'supervisor';
        } else if (detectedPortal === 'assessment') {
          initView = 'assessment';
        } else {
          initView = 'student';
        }
        await switchView(initView);
        if (initView === 'admin' && !state.impersonation && state.isAdmin) {
          switchAdminTab('rounds');
        }

        // 3. Tải dữ liệu đợt và loại hình đồ án với timeout bảo vệ
        showLoading('Đang tải dữ liệu đợt tốt nghiệp...');
        try {
          await Promise.race([
            loadInitialData(),
            new Promise(r => setTimeout(r, 3500))
          ]);
        } catch (loadErr) {
          console.warn('[IFA-Graduation] Initial data loading notice:', loadErr);
        }

        // Tái đồng bộ view sau khi đã có dữ liệu đợt
        await switchView(state.currentView || initView);

      } catch (err) {
        console.error('[IFA-Graduation] Startup error:', err);
      } finally {
        clearTimeout(safetyTimer);
        hideLoading();
      }

      // 4. Background bootstrap cho project types nếu là Admin (chạy ngầm, không chặn startup)
      if (state.isAdmin && !state.impersonation) {
        setTimeout(() => {
          bootstrapProjectTypesIfNeeded().catch(() => {});
        }, 1200);
      }

    } else {
      clearTimeout(safetyTimer);
      if (unsubscribeSettings) {
        try { unsubscribeSettings(); } catch (e) {}
        unsubscribeSettings = null;
      }
      state.realUser = null;
      state.realIsAdmin = false;
      state.realIsOwner = false;
      state.impersonation = null;
      try { sessionStorage.removeItem('ifa_graduation_impersonation'); } catch (e) {}
      const gBanner = document.getElementById('global-impersonation-banner');
      if (gBanner) gBanner.classList.add('hidden');
      await resolveActualRoles(null);
      updateAuthUI();
      document.getElementById('login-required-section').classList.remove('hidden');
      document.getElementById('view-student').classList.add('hidden');
      document.getElementById('view-supervisor').classList.add('hidden');
      document.getElementById('view-admin').classList.add('hidden');
      document.getElementById('view-assessment')?.classList.add('hidden');
      hideLoading();
    }
  });
}

export async function resolveActualRoles(user) {
  if (!user) {
    state.actualRole = null;
    state.currentView = null;
    state.role = 'student';
    state.isAdmin = false;
    state.isSupervisor = false;
    state.isStudent = false;
    state.studentMssv = '';
    return;
  }

  const email = (user.email || '').toLowerCase().trim();

  // 1. OWNER / ADMIN Check
  let isAdmin = false;
  if (isSystemOwner(user)) {
    isAdmin = true;
  } else if (window.__tdtu_user && (window.__tdtu_user.isAdmin || window.__tdtu_user.role === 'admin')) {
    isAdmin = true;
  }

  // 2. STUDENT Check
  let isStudent = email.endsWith('@student.tdtu.edu.vn');
  let studentMssv = isStudent ? email.split('@')[0].toUpperCase() : '';

  // 3. SUPERVISOR Check: ONLY active lecturers in supervisorMaster match by email
  let isSupervisor = false;

  try {
    // Check if in-memory list already contains this active supervisor
    if (state.supervisorsMaster && state.supervisorsMaster.length > 0) {
      const match = state.supervisorsMaster.find(s => s.active !== false && s.email && s.email.toLowerCase().trim() === email);
      if (match) isSupervisor = true;
    }

    // If not found in memory, query Firestore
    if (!isSupervisor) {
      await Promise.race([
        Promise.all([
          (!isAdmin ? getDoc(doc(db, 'admins', email)).then(d => { if (d.exists()) isAdmin = true; }).catch(() => {}) : Promise.resolve()),
          getDocs(collection(db, 'supervisorMaster')).then(snap => {
            const activeSups = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.active !== false);
            if (activeSups.some(s => s.email && s.email.toLowerCase().trim() === email)) {
              isSupervisor = true;
            }
          }).catch(() => {})
        ]),
        new Promise(r => setTimeout(r, 2500))
      ]);
    }
  } catch (e) {
    console.warn('[IFA-Graduation] Admins/Supervisor lookup notice:', e);
  }

  state.isAdmin = isAdmin;
  state.isSupervisor = isSupervisor;
  state.isStudent = isStudent;
  state.studentMssv = studentMssv;

  // Strict Hierarchy: OWNER / HIGH ADMIN / ADMIN > SUPERVISOR > STUDENT
  if (isAdmin) {
    state.actualRole = 'admin';
  } else if (isSupervisor) {
    state.actualRole = 'supervisor';
  } else {
    state.actualRole = 'student';
  }

  // Determine currentView: URL param override if permitted, otherwise default to actualRole
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  if (viewParam === 'admin' && isAdmin) {
    state.currentView = 'admin';
  } else if (viewParam === 'supervisor' && (isSupervisor || isAdmin)) {
    state.currentView = 'supervisor';
  } else if (viewParam === 'student') {
    state.currentView = 'student';
  } else {
    state.currentView = state.actualRole;
  }
  state.role = state.currentView;
}

export function updateAuthUI() {
  const userInfoBar = document.getElementById('user-info-bar');
  const btnHeaderLogin = document.getElementById('btn-header-login');
  
  if (state.user) {
    userInfoBar.classList.remove('hidden');
    userInfoBar.classList.add('flex');
    btnHeaderLogin.classList.add('hidden');

    const isImp = Boolean(state.impersonation);
    const target = isImp ? (state.impersonation.target || {}) : {};

    document.getElementById('user-display-name').textContent = isImp
      ? `${target.name || state.user.displayName || state.user.email} (Đang đóng vai)`
      : (state.user.displayName || state.user.email);
    document.getElementById('user-avatar').src = state.user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23fff"/><path fill="%23fff" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';
    
    // Display ACTUAL ROLE badge
    const roleBadge = document.getElementById('user-role-badge');
    const viewingBadge = document.getElementById('user-viewing-badge');
    
    let roleName = 'Sinh viên';
    let badgeClass = 'text-[10px] bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded font-medium border border-blue-400/30';

    if (isImp) {
      roleName = `Đóng vai: ${target.roleLabel || target.type || 'Người dùng'}`;
      badgeClass = 'text-[10px] bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded font-black border border-amber-400/40';
    } else if (state.actualRole === 'admin') {
      roleName = 'Quản trị viên';
      badgeClass = 'text-[10px] bg-rose-500/30 text-rose-200 px-1.5 py-0.5 rounded font-bold border border-rose-400/30';
    } else if (state.actualRole === 'supervisor') {
      roleName = 'Giảng viên';
      badgeClass = 'text-[10px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded font-medium border border-emerald-400/30';
    }

    if (roleBadge) {
      roleBadge.textContent = roleName;
      roleBadge.className = badgeClass;
    }

    // Global Impersonation Banner sync
    const globalBanner = document.getElementById('global-impersonation-banner');
    if (globalBanner) {
      if (isImp) {
        globalBanner.classList.remove('hidden');
        const bName = document.getElementById('impersonate-banner-name');
        const bId = document.getElementById('impersonate-banner-identifier');
        const bRole = document.getElementById('impersonate-banner-role');
        const bRound = document.getElementById('impersonate-banner-round');
        if (bName) bName.textContent = target.name || target.email || 'Người dùng';
        if (bId) bId.textContent = target.mssv ? `(${target.mssv})` : (target.email ? `(${target.email})` : '');
        if (bRole) bRole.textContent = target.roleLabel || target.type || 'Sinh viên';
        if (bRound) {
          if (target.roundTitle) {
            bRound.textContent = `Đợt: ${target.roundTitle}`;
            bRound.classList.remove('hidden');
          } else {
            bRound.classList.add('hidden');
          }
        }
      } else {
        globalBanner.classList.add('hidden');
      }
    }

    // Header Impersonate button visibility
    const btnOpenImp = document.getElementById('btn-open-impersonate');
    if (btnOpenImp) {
      if (state.realIsAdmin && state.allowImpersonation && !isImp) {
        btnOpenImp.classList.remove('hidden');
        btnOpenImp.classList.add('flex');
      } else {
        btnOpenImp.classList.add('hidden');
        btnOpenImp.classList.remove('flex');
      }
    }

    // Subtext if viewing different view
    if (viewingBadge) {
      if (state.actualRole && state.currentView && state.actualRole !== state.currentView && !isImp) {
        const viewLabels = { student: 'Sinh viên', supervisor: 'GVHD', admin: 'Quản trị' };
        viewingBadge.textContent = '(Đang xem: ' + (viewLabels[state.currentView] || state.currentView) + ')';
        viewingBadge.classList.remove('hidden');
      } else {
        viewingBadge.classList.add('hidden');
      }
    }

    // Role switcher buttons visibility
    const adminDeskBtn = document.getElementById('nav-btn-admin');
    const adminMobBtn = document.getElementById('m-nav-admin');
    const supDeskBtn = document.getElementById('nav-btn-supervisor');
    const supMobBtn = document.getElementById('m-nav-supervisor');
    const studentDeskBtn = document.getElementById('nav-btn-student');
    const studentMobBtn = document.getElementById('m-nav-student');

    const roleNavGroup = document.getElementById('role-nav-group');
    const mobileRoleNav = document.getElementById('mobile-role-nav');
    const btnGotoAdmin = document.getElementById('btn-goto-admin');
    const btnGotoSupervisor = document.getElementById('btn-goto-supervisor');
    const btnGotoStudent = document.getElementById('btn-goto-student');
    const btnGotoAssessment = document.getElementById('btn-goto-assessment');

    // Luôn ẩn thanh switch role lớn cũ trên các portal chuyên biệt
    if (roleNavGroup) roleNavGroup.classList.add('hidden');
    if (mobileRoleNav) mobileRoleNav.classList.add('hidden');

    if (state.currentView === 'student') {
      if (btnGotoStudent) btnGotoStudent.classList.add('hidden');
      if (btnGotoAdmin) {
        if (state.isAdmin) { btnGotoAdmin.classList.remove('hidden'); btnGotoAdmin.classList.add('flex'); }
        else { btnGotoAdmin.classList.add('hidden'); }
      }
      if (btnGotoSupervisor) {
        if (state.isAdmin || state.isSupervisor) { btnGotoSupervisor.classList.remove('hidden'); btnGotoSupervisor.classList.add('flex'); }
        else { btnGotoSupervisor.classList.add('hidden'); }
      }
      if (btnGotoAssessment) {
        if (state.isAdmin || state.isSupervisor) { btnGotoAssessment.classList.remove('hidden'); btnGotoAssessment.classList.add('flex'); }
        else { btnGotoAssessment.classList.add('hidden'); }
      }
    } else if (state.currentView === 'supervisor') {
      if (btnGotoSupervisor) btnGotoSupervisor.classList.add('hidden');
      if (btnGotoStudent) { btnGotoStudent.classList.remove('hidden'); btnGotoStudent.classList.add('flex'); }
      if (btnGotoAdmin) {
        if (state.isAdmin) { btnGotoAdmin.classList.remove('hidden'); btnGotoAdmin.classList.add('flex'); }
        else { btnGotoAdmin.classList.add('hidden'); }
      }
      if (btnGotoAssessment) {
        btnGotoAssessment.classList.remove('hidden');
        btnGotoAssessment.classList.add('flex');
      }
    } else if (state.currentView === 'assessment') {
      if (btnGotoAssessment) btnGotoAssessment.classList.add('hidden');
      if (btnGotoStudent) { btnGotoStudent.classList.remove('hidden'); btnGotoStudent.classList.add('flex'); }
      if (btnGotoAdmin) {
        if (state.isAdmin) { btnGotoAdmin.classList.remove('hidden'); btnGotoAdmin.classList.add('flex'); }
        else { btnGotoAdmin.classList.add('hidden'); }
      }
      if (btnGotoSupervisor) {
        if (state.isAdmin || state.isSupervisor) { btnGotoSupervisor.classList.remove('hidden'); btnGotoSupervisor.classList.add('flex'); }
        else { btnGotoSupervisor.classList.add('hidden'); }
      }
    } else if (state.currentView === 'admin') {
      if (btnGotoAdmin) btnGotoAdmin.classList.add('hidden');
      if (btnGotoStudent) { btnGotoStudent.classList.remove('hidden'); btnGotoStudent.classList.add('flex'); }
      if (btnGotoSupervisor) { btnGotoSupervisor.classList.remove('hidden'); btnGotoSupervisor.classList.add('flex'); }
      if (btnGotoAssessment) { btnGotoAssessment.classList.remove('hidden'); btnGotoAssessment.classList.add('flex'); }
    } else {
      if (btnGotoAdmin) btnGotoAdmin.classList.add('hidden');
      if (btnGotoSupervisor) btnGotoSupervisor.classList.add('hidden');
      if (btnGotoStudent) btnGotoStudent.classList.add('hidden');
      if (btnGotoAssessment) btnGotoAssessment.classList.add('hidden');
    }

  } else {
    userInfoBar.classList.add('hidden');
    userInfoBar.classList.remove('flex');
    btnHeaderLogin.classList.remove('hidden');
  }
}

window.resolveActualRoles = resolveActualRoles;
window.updateAuthUI = updateAuthUI;
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// --- VIEW SWITCHER ---
window.switchView = async function(targetView) {
  state.currentView = targetView;
  state.role = targetView;
  updateAuthUI();

  const navBtns = {
    student: ['nav-btn-student', 'm-nav-student'],
    supervisor: ['nav-btn-supervisor', 'm-nav-supervisor'],
    admin: ['nav-btn-admin', 'm-nav-admin']
  };

  ['student', 'supervisor', 'admin', 'assessment'].forEach(v => {
    const isCurrent = (v === targetView);
    const deskBtn = navBtns[v] ? document.getElementById(navBtns[v][0]) : null;
    const mobBtn = navBtns[v] ? document.getElementById(navBtns[v][1]) : null;

    if (deskBtn) {
      if (isCurrent) {
        deskBtn.classList.add('bg-white/20', 'text-white');
        deskBtn.classList.remove('text-slate-300');
      } else {
        deskBtn.classList.remove('bg-white/20', 'text-white');
        deskBtn.classList.add('text-slate-300');
      }
    }
    if (mobBtn) {
      if (isCurrent) {
        mobBtn.classList.add('bg-white/20', 'text-white');
        mobBtn.classList.remove('text-slate-300');
      } else {
        mobBtn.classList.remove('bg-white/20', 'text-white');
        mobBtn.classList.add('text-slate-300');
      }
    }

    const sectionEl = document.getElementById('view-' + v);
    if (sectionEl) {
      if (isCurrent && state.user) sectionEl.classList.remove('hidden');
      else sectionEl.classList.add('hidden');
    }
  });

  if (targetView === 'admin') {
    const lockCard = document.getElementById('admin-impersonation-lock-card');
    const mainLayout = document.getElementById('admin-main-layout');

    if (state.impersonation) {
      if (lockCard) lockCard.classList.remove('hidden');
      if (mainLayout) mainLayout.classList.add('hidden');
      const target = state.impersonation.target || {};
      const lockName = document.getElementById('admin-lock-target-name');
      const lockRole = document.getElementById('admin-lock-target-role');
      if (lockName) lockName.textContent = `${target.name || target.email} ${target.mssv ? '(' + target.mssv + ')' : ''}`;
      if (lockRole) lockRole.textContent = target.roleLabel || target.type || 'Người dùng';
      return;
    } else {
      if (lockCard) lockCard.classList.add('hidden');
      if (mainLayout) mainLayout.classList.remove('hidden');
    }

    if (state.isAdmin) {
      loadAdminStats();
    }
  } else if (targetView === 'supervisor') {
    initSupervisorPortal();
  } else if (targetView === 'assessment') {
    initAssessmentPortal();
  } else if (targetView === 'student') {
    const emptyCard = document.getElementById('student-empty-round');
    const regFlow = document.getElementById('registration-flow-container');
    const targetRound = state.activeRound;

    if (!targetRound) {
      // No active round configured
      if (emptyCard) {
        emptyCard.innerHTML = `
          <div class="w-16 h-16 bg-blue-50 text-tdtu-blue rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            📋
          </div>
          <h3 class="text-lg font-black text-slate-800 mb-2 leading-snug">
            Hiện tại chưa đến đợt đăng ký<br>Đồ án tốt nghiệp.
          </h3>
          <p class="text-xs text-slate-500 leading-relaxed">
            Bạn vui lòng quay lại sau khi Khoa có thông báo chính thức.
          </p>
        `;
        emptyCard.classList.remove('hidden');
      }
      if (regFlow) regFlow.classList.add('hidden');
    } else {
      const now = new Date();
      const isNotYetOpen = targetRound.openAtDate && now < targetRound.openAtDate;
      const isClosed = (targetRound.closeAtDate && now > targetRound.closeAtDate) || targetRound.status === 'closed';

      if (isNotYetOpen) {
        if (emptyCard) {
          emptyCard.innerHTML = `
            <div class="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              ⏳
            </div>
            <h3 class="text-lg font-black text-slate-800 mb-2">
              Đợt đăng ký chưa mở
            </h3>
            <p class="text-xs text-slate-600 leading-relaxed font-semibold">
              ${targetRound.title}
            </p>
            <p class="text-xs text-slate-500 mt-1 font-mono">
              Thời gian mở: ${fmt24h(targetRound.openAtDate)}
            </p>
          `;
          emptyCard.classList.remove('hidden');
        }
        if (regFlow) regFlow.classList.add('hidden');
      } else if (isClosed) {
        if (emptyCard) {
          emptyCard.innerHTML = `
            <div class="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              🔒
            </div>
            <h3 class="text-lg font-black text-slate-800 mb-2">
              Đợt đăng ký đã kết thúc
            </h3>
            <p class="text-xs text-slate-600 leading-relaxed font-semibold">
              ${targetRound.title}
            </p>
            <p class="text-xs text-slate-500 mt-1 font-mono">
              Thời gian đóng: ${fmt24h(targetRound.closeAtDate)}
            </p>
          `;
          emptyCard.classList.remove('hidden');
        }
        if (regFlow) regFlow.classList.add('hidden');
      } else {
        // Open & in window!
        if (emptyCard) emptyCard.classList.add('hidden');
        if (state.selectedRoundId) checkStudentEligibilityAndRegistration(state.selectedRoundId);
        updateStudentJourneyStepper();
        updateStudentPersonalSidebar();
      }
    }
  }
};



// --- DATA INITIALIZATION ---
async function loadInitialData() {
  await Promise.allSettled([
    loadProjectTypes(),
    loadRounds()
  ]);
}

async function loadProjectTypes() {
  // Luôn hiển thị fallback in-memory/HTML ngay lập tức để dropdown không bao giờ trống
  renderProjectTypesDropdown();
  renderAdminProjectTypesTable();

  try {
    const snap = await getDocs(collection(db, 'graduationProjectTypes'));
    if (!snap.empty) {
      state.projectTypes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      renderProjectTypesDropdown();
      renderAdminProjectTypesTable();
    }
  } catch (e) {
    console.warn('[IFA-Graduation] Project types query notice:', e);
  }
}

async function bootstrapProjectTypesIfNeeded() {
  if (!state.isAdmin) return;
  try {
    const snap = await getDocs(collection(db, 'graduationProjectTypes'));
    if (snap.empty) {
      console.log('[IFA-Graduation] Bootstrapping 11 default project types into Firestore...');
      const batch = writeBatch(db);
      DEFAULT_PROJECT_TYPES.forEach((name, index) => {
        const ref = doc(collection(db, 'graduationProjectTypes'));
        batch.set(ref, { name, order: index + 1, active: true, createdAt: serverTimestamp() });
      });
      await batch.commit();
      console.log('[IFA-Graduation] 11 default project types bootstrapped.');
      await loadProjectTypes();
    }
  } catch (err) {
    console.warn('[IFA-Graduation] Background bootstrap notice:', err.message);
  }
}

function renderProjectTypesDropdown() {
  const select = document.getElementById('select-project-type');
  if (!select) return;
  const activeTypes = (state.projectTypes && state.projectTypes.length > 0)
    ? state.projectTypes.filter(p => p.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0))
    : DEFAULT_PROJECT_TYPES.map((name, i) => ({ name, order: i + 1 }));

  select.innerHTML = '<option value="">-- Chọn loại hình đồ án --</option>' +
    activeTypes
      .map(p => '<option value="' + p.name + '">' + p.name + '</option>')
      .join('');
}

window.renderProjectTypesDropdown = renderProjectTypesDropdown;
// Initial populate of dropdown
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderProjectTypesDropdown);
} else {
  renderProjectTypesDropdown();
}


// --- ROUNDS MANAGEMENT ---
async function loadRounds() {
  try {
    const snap = await getDocs(query(collection(db, 'graduationRounds'), orderBy('createdAt', 'desc')));
    state.rounds = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        openAtDate: data.openAt ? (data.openAt.toDate ? data.openAt.toDate() : new Date(data.openAt)) : null,
        closeAtDate: data.closeAt ? (data.closeAt.toDate ? data.closeAt.toDate() : new Date(data.closeAt)) : null
      };
    });

    renderRoundsDropdowns();
    renderAdminRoundsTable();
    if (typeof renderAdminRoundsCards === 'function') renderAdminRoundsCards();
    if (typeof renderAdminRoundsCards === 'function') renderAdminRoundsCards();

    // Check ?x=SHORTCODE URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const xCode = urlParams.get('x') || urlParams.get('round') || urlParams.get('e');
    const aCode = urlParams.get('a');
    if (aCode) {
      state.targetActivitySlug = aCode;
    }

    let targetRound = null;
    if (xCode) {
      // Find round matching shortCode, roundName or id
      targetRound = state.rounds.find(r => !r.deleted && (r.shortCode === xCode || r.roundName === xCode || r.id === xCode || r.slug === xCode));
    }

    // If no direct link, ONLY use the ACTIVE round
    if (!targetRound) {
      targetRound = state.rounds.find(r => !r.deleted && r.isActive === true);
    }

    state.activeRound = targetRound || null;
    state.selectedRoundId = targetRound ? targetRound.id : null;

    if (state.selectedRoundId) {
      await selectRound(state.selectedRoundId);
    }
  } catch (e) {
    console.error('Error loading rounds:', e);
  }
}


// Safe helper to populate round selectors across views
window.populateRoundSelectors = function() {
  try {
    renderRoundsDropdowns();
  } catch (err) {
    console.warn('[IFA-Graduation] renderRoundsDropdowns warning:', err);
  }
};

function renderRoundsDropdowns() {
  const selectActive = document.getElementById('select-active-round');
  const selectAdminSup = document.getElementById('admin-round-sup-select');
  const selectAdminStudent = document.getElementById('admin-round-student-select');
  const selectAdminReg = document.getElementById('admin-round-reg-select');
  const selectAdminReview = document.getElementById('admin-review-round-select');
  
  const validRounds = (state.rounds || []).filter(r => !r.deleted);
  const optionsHtml = validRounds.map(r => '<option value="' + r.id + '" ' + (r.id === state.selectedRoundId ? 'selected' : '') + '>' + r.title + ' (' + (r.academicYear || '') + ')' + (r.isActive ? ' ★ Hiện hành' : '') + '</option>').join('');

  if (selectActive) {
    selectActive.innerHTML = optionsHtml;
    if (validRounds.length > 1) {
      document.getElementById('multi-round-selector-wrap')?.classList.remove('hidden');
    } else {
      document.getElementById('multi-round-selector-wrap')?.classList.add('hidden');
    }
  }
  if (selectAdminSup) selectAdminSup.innerHTML = optionsHtml;
  if (selectAdminStudent) selectAdminStudent.innerHTML = optionsHtml;
  if (selectAdminReg) selectAdminReg.innerHTML = optionsHtml;
  if (selectAdminReview) selectAdminReview.innerHTML = optionsHtml;
  const selectAdminTimeline = document.getElementById('admin-timeline-round-select');
  if (selectAdminTimeline) selectAdminTimeline.innerHTML = optionsHtml;
}

window.onRoundSelected = function(roundId) {
  selectRound(roundId);
};

export async function selectRound(roundId) {
  state.selectedRoundId = roundId;
  state.activeRound = state.rounds.find(r => r.id === roundId) || null;
  if (!state.activeRound) return;

  renderRoundHeader();
  startCountdown();
  
  await loadRoundSupervisors(roundId);
  await checkStudentEligibilityAndRegistration(roundId);
  
  if (state.isSupervisor) {
    loadSupervisorReviewData(roundId);
  }
  await loadStudentRoundActivities(roundId);
}

function renderRoundHeader() {
  const round = state.activeRound;
  if (!round) return;

  const titleDisplay = document.getElementById('round-title-display');
  if (titleDisplay) titleDisplay.textContent = round.title;
  const yearDisplay = document.getElementById('round-academic-year');
  if (yearDisplay) yearDisplay.textContent = `Năm học ${round.academicYear || ''}`;

  // Hero Card Quick Metrics
  const milestonesCountEl = document.getElementById('hero-milestones-count');
  if (milestonesCountEl) {
    const actCount = (round.activities || []).length;
    milestonesCountEl.textContent = `${actCount} mốc kế hoạch`;
  }
  const assignedSupEl = document.getElementById('hero-assigned-sup');
  if (assignedSupEl) {
    const officialList = state.myRegistration ? getOfficialSupervisors(state.myRegistration) : [];
    if (officialList.length > 0) {
      const p = officialList.find(s => s.role === 'primary') || officialList[0];
      assignedSupEl.textContent = `GVHD: ${p.supervisorName}`;
    } else {
      assignedSupEl.textContent = 'GVHD: Chưa phân công';
    }
  }
  const studentStateBadge = document.getElementById('hero-student-state-badge');
  if (studentStateBadge) {
    if (state.isEligible === true) {
      studentStateBadge.className = 'badge bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30';
      studentStateBadge.textContent = 'Đủ điều kiện';
    } else if (state.isEligible === 'pending') {
      studentStateBadge.className = 'badge bg-amber-500/20 text-amber-300 font-bold border border-amber-400/30';
      studentStateBadge.textContent = 'Chờ xác nhận ĐK';
    } else if (state.isEligible === false) {
      studentStateBadge.className = 'badge bg-rose-500/20 text-rose-300 font-bold border border-rose-400/30';
      studentStateBadge.textContent = 'Chưa đủ ĐK';
    } else {
      studentStateBadge.className = 'badge bg-white/10 text-white font-mono text-[11px] border border-white/20';
      studentStateBadge.textContent = 'Sinh viên';
    }
  }
  
  const statusBadge = document.getElementById('round-status-badge');
  const statusMap = {
    draft: { text: 'Bản nháp', cls: 'badge-draft' },
    upcoming: { text: 'Sắp mở đăng ký', cls: 'badge-upcoming' },
    open: { text: 'Đang mở đăng ký', cls: 'badge-open' },
    closed: { text: 'Đã đóng đăng ký', cls: 'badge-closed' },
    reviewing: { text: 'Đang xét duyệt', cls: 'badge-upcoming' },
    finalized: { text: 'Đã chốt kết quả', cls: 'badge-open' },
    published: { text: 'Đã công bố', cls: 'badge-open' }
  };
  const st = statusMap[round.status] || { text: round.status, cls: 'badge-draft' };
  statusBadge.className = `badge ${st.cls}`;
  statusBadge.textContent = st.text;

  const prefCount = round.preferenceCount || 3;
  document.getElementById('round-mode-badge').textContent = `${prefCount} Nguyện vọng • ${round.selectionMode === 'wizard' ? 'Từng bước (Wizard)' : 'Thẻ (Cards)'}`;

  const fmtDate = d => d ? new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
  document.getElementById('round-time-range').innerHTML = `<span>📅 Thời gian: ${fmtDate(round.openAtDate)} — ${fmtDate(round.closeAtDate)}</span>`;

  document.getElementById('tray-mode-hint').textContent = `Chọn đủ ${prefCount} nguyện vọng theo thứ tự ưu tiên giảm dần`;
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  
  const updateTimer = () => {
    const round = state.activeRound;
    if (!round) return;

    const now = new Date().getTime();
    const openTime = round.openAtDate ? round.openAtDate.getTime() : 0;
    const closeTime = round.closeAtDate ? round.closeAtDate.getTime() : 0;

    const valEl = document.getElementById('countdown-value');
    const labelEl = document.getElementById('countdown-label');

    if (now < openTime) {
      labelEl.textContent = 'MỞ ĐĂNG KÝ SAU';
      valEl.textContent = formatDuration(openTime - now);
    } else if (now <= closeTime && round.status === 'open') {
      labelEl.textContent = 'THỜI GIAN CÒN LẠI';
      valEl.textContent = formatDuration(closeTime - now);
    } else {
      labelEl.textContent = 'TRẠNG THÁI';
      valEl.textContent = round.status === 'published' ? 'ĐÃ CÔNG BỐ KẾT QUẢ' : (round.status === 'reviewing' ? 'ĐANG XÉT DUYỆT' : 'ĐÃ ĐÓNG ĐĂNG KÝ');
      valEl.classList.remove('pulse-timer');
    }
  };

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = n => String(n).padStart(2, '0');

  if (days > 0) return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// --- ELIGIBILITY & REGISTRATION CHECK ---
async function checkStudentEligibilityAndRegistration(roundId) {
  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  
  state.isEligible = false;
  state.myRegistration = null;

  const nonEligibleAlert = document.getElementById('non-eligible-alert');
  const alreadyRegCard = document.getElementById('already-registered-card');
  const ctaCard = document.getElementById('registration-cta-card');
  const reviewInProgressCard = document.getElementById('review-in-progress-card');
  const officialResultCard = document.getElementById('official-result-card');
  const flowContainer = document.getElementById('registration-flow-container');

  if (!mssv) {
    if (nonEligibleAlert) nonEligibleAlert.classList.add('hidden');
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
    const roundData = state.activeRound || state.rounds?.find(r => r.id === roundId);
    const allowPre = Boolean(roundData?.allowRegistrationBeforeEligibility && !roundData?.eligibilityFinalized);

    const elDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'eligibleStudents', mssv));
    const isOfficiallyEligible = elDoc.exists() && elDoc.data().eligible !== false;

    if (isOfficiallyEligible) {
      state.isEligible = true;
      state.eligibilityState = 'eligible';
      nonEligibleAlert.classList.add('hidden');
    } else if (allowPre) {
      state.isEligible = 'pending';
      state.eligibilityState = 'pending';
      nonEligibleAlert.classList.add('hidden');
    } else {
      state.isEligible = false;
      state.eligibilityState = 'not_eligible';
      if (nonEligibleAlert) nonEligibleAlert.classList.remove('hidden');
      if (alreadyRegCard) alreadyRegCard.classList.add('hidden');
      if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
      if (officialResultCard) officialResultCard.classList.add('hidden');
      if (ctaCard) ctaCard.classList.add('hidden');
      if (flowContainer) flowContainer.classList.add('hidden');
      updateStudentJourneyStepper();
      updateStudentPersonalSidebar();
      return;
    }

    const regDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'registrations', mssv));
    if (regDoc.exists()) {
      state.myRegistration = regDoc.data();
      if (flowContainer) flowContainer.classList.add('hidden');
      if (ctaCard) ctaCard.classList.add('hidden');

      const roundStatus = state.activeRound?.status;
      const reviewStatus = state.activeRound?.reviewStatus;

      // 1. If Published / Completed: Show Official Result Card
      if (roundStatus === 'published' || reviewStatus === 'completed') {
        if (alreadyRegCard) alreadyRegCard.classList.add('hidden');
        if (reviewInProgressCard) reviewInProgressCard.classList.add('hidden');
        renderStudentOfficialResult(state.myRegistration);
        if (officialResultCard) officialResultCard.classList.remove('hidden');
        renderStudentFinalScoreCard(mssv, state.activeRound);
        updateStudentJourneyStepper();
        updateStudentPersonalSidebar();
        renderRoundHeader();
        return;
      }

      // 2. If Reviewing in Progress: Show Neutral Reviewing Card
      if (roundStatus === 'reviewing' || (reviewStatus && reviewStatus.startsWith('round_')) || reviewStatus === 'manual_assignment') {
        if (alreadyRegCard) alreadyRegCard.classList.add('hidden');
        if (officialResultCard) officialResultCard.classList.add('hidden');
        
        let roundName = 'VÒNG XÉT NGUYỆN VỌNG';
        if (reviewStatus === 'round_1') roundName = 'XÉT NGUYỆN VỌNG 1';
        else if (reviewStatus === 'round_2') roundName = 'XÉT NGUYỆN VỌNG 2';
        else if (reviewStatus === 'round_3') roundName = 'XÉT NGUYỆN VỌNG 3';
        else if (reviewStatus === 'manual_assignment') roundName = 'ĐIỀU PHỐI BỔ SUNG';
        
        const reviewTag = document.getElementById('review-round-tag');
        if (reviewTag) reviewTag.textContent = roundName;
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
      if (officialResultCard) officialResultCard.classList.add('hidden');
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
    const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23cbd5e1"/><path fill="%23cbd5e1" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';

    const supervisorsCardsHtml = officialList.map(item => {
      const sup = (state.roundSupervisors || []).find(s => s.id === item.supervisorId || s.supervisorId === item.supervisorId)
        || (state.supervisorsMaster || []).find(s => s.id === item.supervisorId);

      const isPrimary = (item.role === 'primary');
      const roleBadge = isPrimary
        ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[10px] shadow-sm uppercase tracking-wide">GVHD chính</span>'
        : '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500 text-white font-black text-[10px] shadow-sm uppercase tracking-wide">GVHD hỗ trợ</span>';

      const showEmail = (state.activeRound?.showEmailAfterPublish !== false && sup?.email);
      const showPhone = (state.activeRound?.showPhoneAfterPublish !== false && sup?.phone);

      return `
        <div class="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/20 flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 min-w-[280px]">
          <img src="${sup?.photoUrl || defaultAvatar}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 ${isPrimary ? 'border-amber-400' : 'border-blue-400'} shadow-md shrink-0">
          <div class="text-center sm:text-left flex-1 min-w-0">
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              ${roleBadge}
              ${isPrimary ? `<span class="text-[10px] text-amber-300 font-semibold">${reg.acceptedRank === 'manual' ? 'Phân công của Khoa' : 'Trúng tuyển NV' + (reg.acceptedRank || 1)}</span>` : ''}
            </div>
            <h3 class="text-lg sm:text-xl font-black text-white truncate">${item.supervisorName || sup?.name || 'Giảng viên Hướng dẫn'}</h3>
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

        <div class="bg-black/30 p-4 rounded-xl border border-white/10 text-xs space-y-1">
          <span class="text-blue-300 font-bold block uppercase">Đề tài Đồ án Tốt nghiệp chính thức:</span>
          <p class="text-white font-bold text-sm leading-relaxed">${reg.topicTitle}</p>
          <p class="text-blue-200 text-[11px] mt-1">Loại hình: ${reg.projectType}</p>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="bg-white/10 p-5 rounded-2xl border border-white/20 text-center space-y-3">
        <p class="text-lg font-bold text-amber-300">Thông báo Điều phối Đề tài</p>
        <p class="text-xs text-slate-200 leading-relaxed max-w-lg mx-auto">
          Hồ sơ của bạn hiện đang chờ điều phối bổ sung từ Hội đồng Đồ án Tốt nghiệp Khoa. Vui lòng liên hệ trực tiếp Văn phòng Khoa để được hỗ trợ phân công GVHD hướng dẫn.
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
  if (bannerEl) {
    if (reg.eligibilityStatus === 'pending') {
      bannerEl.className = 'mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5';
      bannerEl.innerHTML = `
        <span class="text-base">ℹ️</span>
        <div>
          <span class="font-bold block">Trạng thái điều kiện: Chờ kết quả xét từ Nhà trường / Khoa</span>
          <p class="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
            Đăng ký nguyện vọng của bạn đã được ghi nhận vào hệ thống. Trạng thái điều kiện đang là <b>Chờ xét</b>. Sau khi Nhà trường/Khoa ban hành danh sách chính thức, hệ thống sẽ đối chiếu và chuyển hồ sơ sang GVHD xét duyệt.
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
            Theo danh sách chính thức từ Nhà trường/Khoa, bạn chưa đủ điều kiện làm ĐATN trong đợt này. Nguyện vọng đăng ký không được chuyển sang GVHD xét duyệt.
          </p>
        </div>
      `;
      bannerEl.classList.remove('hidden');
      if (statusEl) {
        statusEl.textContent = 'Không đủ điều kiện';
        statusEl.className = 'font-bold text-rose-700 text-sm';
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

  const listEl = document.getElementById('reg-card-preferences-list');
  listEl.innerHTML = (reg.preferences || []).map(p => `
    <div class="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-emerald-100 shadow-sm text-xs">
      <span class="w-6 h-6 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-[10px]">
        NV${p.rank}
      </span>
      <div>
        <span class="font-bold text-slate-800">${p.supervisorName}</span>
        <span class="text-[11px] text-slate-400 ml-2">${p.department || ''}</span>
      </div>
    </div>
  `).join('');

  const btnEdit = document.getElementById('btn-edit-existing-reg');
  const canEdit = state.activeRound?.status === 'open' && state.activeRound?.allowStudentEdit !== false;
  if (canEdit) {
    btnEdit.classList.remove('hidden');
  } else {
    btnEdit.classList.add('hidden');
  }
}

window.enableEditRegistration = function() {
  if (!state.myRegistration) return;
  document.getElementById('input-topic-title').value = state.myRegistration.topicTitle || '';
  document.getElementById('select-project-type').value = state.myRegistration.projectType || '';
  state.selectedPreferences = [...(state.myRegistration.preferences || [])];

  const alreadyCard = document.getElementById('already-registered-card');
  const ctaCard = document.getElementById('registration-cta-card');
  const flowContainer = document.getElementById('registration-flow-container');
  if (alreadyCard) alreadyCard.classList.add('hidden');
  if (ctaCard) ctaCard.classList.add('hidden');
  if (flowContainer) flowContainer.classList.remove('hidden');
  goToStep(1);
};

// --- ROUND SUPERVISORS ---
async function loadRoundSupervisors(roundId) {
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'supervisors'));
    state.roundSupervisors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSupervisorsGrid();
  } catch (e) {
    console.error('Error loading round supervisors:', e);
  }
}

function renderSupervisorsGrid() {
  const grid = document.getElementById('supervisors-grid');
  if (!grid) return;

  const searchTerm = (document.getElementById('search-supervisor-input')?.value || '').toLowerCase();
  const maxPref = state.activeRound?.preferenceCount || 3;
  const isWizard = state.activeRound?.selectionMode === 'wizard';

  const wizardHeader = document.getElementById('wizard-sub-stepper');
  if (wizardHeader) {
    if (isWizard) {
      wizardHeader.classList.remove('hidden');
      document.getElementById('wizard-current-rank-label').textContent = `ĐANG CHỌN: NGUYỆN VỌNG ${state.wizardRank} / ${maxPref}`;
    } else {
      wizardHeader.classList.add('hidden');
    }
  }

  const activeSupervisors = state.roundSupervisors.filter(s => {
    if (s.activeInRound === false) return false;
    const matchName = (s.name || '').toLowerCase().includes(searchTerm);
    const matchExp = (s.expertise || '').toLowerCase().includes(searchTerm);
    const matchDept = (s.department || '').toLowerCase().includes(searchTerm);
    return matchName || matchExp || matchDept;
  });

  document.getElementById('supervisors-count-badge').textContent = `${activeSupervisors.length} giảng viên`;

  if (activeSupervisors.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-slate-400 text-xs">Không tìm thấy giảng viên nào phù hợp.</div>';
    renderPreferencesTray();
    return;
  }

  const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23cbd5e1"/><path fill="%23cbd5e1" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';

  grid.innerHTML = activeSupervisors.map(s => {
    const prefIndex = state.selectedPreferences.findIndex(p => p.supervisorId === s.id);
    const isSelected = prefIndex !== -1;
    const assignedRank = isSelected ? state.selectedPreferences[prefIndex].rank : null;

    let buttonHtml = '';
    if (isWizard) {
      const isSelectedForCurrentWizard = (assignedRank === state.wizardRank);
      buttonHtml = `
        <button type="button" onclick="selectWizardPreference('${s.id}', '${encodeURIComponent(s.name)}')" class="w-full py-2 px-3 rounded-xl text-xs font-bold transition-all ${isSelectedForCurrentWizard ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">
          ${isSelectedForCurrentWizard ? '✓ Đang chọn cho NV' + state.wizardRank : 'Chọn cho NV' + state.wizardRank}
        </button>
      `;
    } else {
      if (isSelected) {
        buttonHtml = `
          <button type="button" onclick="removePreference('${s.id}')" class="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all">
            ✕ Bỏ chọn (NV${assignedRank})
          </button>
        `;
      } else {
        const canAddMore = state.selectedPreferences.length < maxPref;
        buttonHtml = `
          <button type="button" onclick="addCardPreference('${s.id}', '${encodeURIComponent(s.name)}')" ${!canAddMore ? 'disabled' : ''} class="w-full py-2 px-3 bg-tdtu-blue hover:bg-tdtu-dark disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
            + Chọn Nguyện vọng
          </button>
        `;
      }
    }

    return `
      <div class="card-surface p-5 flex flex-col justify-between card-hover relative ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''}">
        ${isSelected ? `<span class="absolute right-3 top-3 px-2 py-0.5 rounded-full bg-amber-500 text-slate-900 font-extrabold text-[10px] shadow-sm">NV${assignedRank}</span>` : ''}

        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <img src="${(s.showPhoto !== false && s.photoUrl) ? s.photoUrl : defaultAvatar}" class="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm" alt="${s.name}">
            <div>
              <h3 class="font-bold text-slate-900 text-sm leading-tight">${s.name}</h3>
              <p class="text-[11px] text-slate-500">${s.department || 'Bộ môn TKNT'}</p>
            </div>
          </div>

          <div class="text-xs space-y-1">
            <span class="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">Chuyên môn hướng dẫn:</span>
            <p class="text-slate-700 leading-snug line-clamp-2" title="${s.expertise || ''}">
              ${s.expertise || 'Đang cập nhật'}
            </p>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
          <button type="button" onclick="openBioModal('${s.id}')" class="px-2.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold" title="Xem hồ sơ">
            ℹ️ Chi tiết
          </button>
          <div class="flex-1">
            ${buttonHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  renderPreferencesTray();
}

window.filterSupervisorsList = function() {
  renderSupervisorsGrid();
};

window.addCardPreference = function(supervisorId, encName) {
  const name = decodeURIComponent(encName);
  const maxPref = state.activeRound?.preferenceCount || 3;
  if (state.selectedPreferences.length >= maxPref) {
    showToast(`Bạn chỉ được chọn tối đa ${maxPref} nguyện vọng.`, 'info');
    return;
  }

  const nextRank = state.selectedPreferences.length + 1;
  const sup = state.roundSupervisors.find(s => s.id === supervisorId);

  state.selectedPreferences.push({
    rank: nextRank,
    supervisorId: supervisorId,
    supervisorName: name,
    department: sup?.department || '',
    photoUrl: sup?.photoUrl || ''
  });

  renderSupervisorsGrid();
};

window.removePreference = function(supervisorId) {
  state.selectedPreferences = state.selectedPreferences.filter(p => p.supervisorId !== supervisorId);
  state.selectedPreferences.forEach((p, idx) => p.rank = idx + 1);
  renderSupervisorsGrid();
};

window.movePreferenceOrder = function(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= state.selectedPreferences.length) return;
  const item = state.selectedPreferences.splice(fromIndex, 1)[0];
  state.selectedPreferences.splice(toIndex, 0, item);
  state.selectedPreferences.forEach((p, idx) => p.rank = idx + 1);
  renderSupervisorsGrid();
};

window.selectWizardPreference = function(supervisorId, encName) {
  const name = decodeURIComponent(encName);
  const maxPref = state.activeRound?.preferenceCount || 3;
  const currentRank = state.wizardRank;

  const sup = state.roundSupervisors.find(s => s.id === supervisorId);

  state.selectedPreferences = state.selectedPreferences.filter(p => p.rank !== currentRank);

  state.selectedPreferences.push({
    rank: currentRank,
    supervisorId,
    supervisorName: name,
    department: sup?.department || '',
    photoUrl: sup?.photoUrl || ''
  });

  state.selectedPreferences.sort((a, b) => a.rank - b.rank);

  if (currentRank < maxPref) {
    state.wizardRank = currentRank + 1;
  }
  renderSupervisorsGrid();
};

window.stepWizardRank = function(delta) {
  const maxPref = state.activeRound?.preferenceCount || 3;
  const target = state.wizardRank + delta;
  if (target >= 1 && target <= maxPref) {
    state.wizardRank = target;
    renderSupervisorsGrid();
  }
};

function renderPreferencesTray() {
  const tray = document.getElementById('preferences-tray-items');
  if (!tray) return;

  const maxPref = state.activeRound?.preferenceCount || 3;

  let html = '';
  for (let rank = 1; rank <= maxPref; rank++) {
    const pref = state.selectedPreferences.find(p => p.rank === rank);
    if (pref) {
      const idx = state.selectedPreferences.indexOf(pref);
      html += `
        <div class="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs shadow-sm">
          <span class="w-5 h-5 rounded-full bg-amber-500 text-slate-900 font-extrabold text-[10px] flex items-center justify-center">NV${rank}</span>
          <span class="font-bold text-slate-100 max-w-[120px] truncate" title="${pref.supervisorName}">${pref.supervisorName}</span>
          <div class="flex items-center gap-0.5 ml-1">
            <button type="button" onclick="movePreferenceOrder(${idx}, ${idx - 1})" ${idx === 0 ? 'disabled' : ''} class="p-0.5 text-slate-400 hover:text-white disabled:opacity-20 text-[10px]">▲</button>
            <button type="button" onclick="movePreferenceOrder(${idx}, ${idx + 1})" ${idx === state.selectedPreferences.length - 1 ? 'disabled' : ''} class="p-0.5 text-slate-400 hover:text-white disabled:opacity-20 text-[10px]">▼</button>
            <button type="button" onclick="removePreference('${pref.supervisorId}')" class="p-0.5 text-rose-400 hover:text-rose-300 text-xs ml-1">✕</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="flex items-center gap-1.5 bg-slate-800/40 border border-dashed border-slate-700 px-2.5 py-1.5 rounded-xl text-xs text-slate-400">
          <span class="w-5 h-5 rounded-full bg-slate-700 text-slate-300 font-bold text-[10px] flex items-center justify-center">${rank}</span>
          <span>Chưa chọn</span>
        </div>
      `;
    }
  }

  tray.innerHTML = html;
}

// --- STEPPER NAVIGATION ---
window.goToStep = function(step) {
  state.currentStep = step;

  [1, 2, 3].forEach(s => {
    const indicator = document.getElementById('step-indicator-' + s);
    const panel = document.getElementById('step-panel-' + s);

    if (indicator) {
      if (s === step) {
        indicator.className = 'stepper-item active flex flex-col items-center gap-1 relative z-10 bg-white px-2 cursor-pointer';
      } else if (s < step) {
        indicator.className = 'stepper-item completed flex flex-col items-center gap-1 relative z-10 bg-white px-2 cursor-pointer';
      } else {
        indicator.className = 'stepper-item flex flex-col items-center gap-1 relative z-10 bg-white px-2 cursor-pointer';
      }
    }

    if (panel) {
      if (s === step) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });

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
  const projectType = document.getElementById('select-project-type')?.value || '';

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

  // Check Interior Design requirement:
  // If student major or projectType or current round contains "nội thất"
  const studentMajor = (state.currentStudentInfo?.major || '').toLowerCase();
  const roundName = (state.activeRound?.name || '').toLowerCase();
  const isInteriorDesign = studentMajor.includes('nội thất') || 
                           projectType.toLowerCase().includes('nội thất') || 
                           roundName.includes('nội thất');

  if (isInteriorDesign) {
    if (!topic.toLowerCase().startsWith('thiết kế nội thất')) {
      const msg = 'Tên đề tài của sinh viên ngành Thiết kế nội thất BẮT BUỘC phải bắt đầu bằng cụm từ "Thiết kế nội thất".';
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
      }
      showToast(msg, 'error');
      topicInput?.focus();
      return;
    }
  }

  if (!projectType) {
    showToast('Vui lòng chọn loại hình đồ án.', 'warning');
    document.getElementById('select-project-type')?.focus();
    return;
  }

  goToStep(2);
};

window.validateAndGoToStep3 = function() {
  const maxPref = state.activeRound?.preferenceCount || 3;
  if (state.selectedPreferences.length < maxPref) {
    showToast(`Vui lòng chọn đủ ${maxPref} nguyện vọng trước khi tiếp tục.`, 'info');
    return;
  }
  goToStep(3);
};

function renderConfirmationPanel() {
  document.getElementById('confirm-topic-title').textContent = (document.getElementById('input-topic-title')?.value || '').trim();
  document.getElementById('confirm-project-type').textContent = document.getElementById('select-project-type')?.value || '';

  const listEl = document.getElementById('confirm-preferences-list');
  listEl.innerHTML = state.selectedPreferences.map(p => `
    <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
      <span class="w-6 h-6 rounded-full bg-tdtu-blue text-white font-extrabold flex items-center justify-center text-xs">
        NV${p.rank}
      </span>
      <div>
        <span class="font-bold text-slate-900">${p.supervisorName}</span>
        <span class="text-[11px] text-slate-500 ml-2">${p.department || ''}</span>
      </div>
    </div>
  `).join('');
}

window.submitRegistration = async function() {
  if (!checkImpersonationWriteGuard('Nộp đăng ký nguyện vọng đồ án')) return;

  const roundId = state.selectedRoundId;
  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const topicTitle = (document.getElementById('input-topic-title')?.value || '').trim();
  const projectType = document.getElementById('select-project-type')?.value || '';

  if (!roundId || !mssv) {
    showToast('Không xác định được phiên làm việc hoặc MSSV.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-submit-registration');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Đang ghi nhận đăng ký...</span>';

  try {
    const isPending = (state.isEligible === 'pending' || state.eligibilityState === 'pending');
    const eligibilityStatus = isPending ? 'pending' : 'eligible';

    const payload = {
      studentId: mssv,
      studentName: state.user?.displayName || mssv,
      email: state.user?.email || `${mssv}@student.tdtu.edu.vn`,
      topicTitle,
      projectType,
      preferences: state.selectedPreferences.map(p => ({
        rank: p.rank,
        supervisorId: p.supervisorId,
        supervisorName: p.supervisorName,
        department: p.department || ''
      })),
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'submitted',
      reviewStatus: 'waiting',
      eligibilityStatus: eligibilityStatus
    };

    await setDoc(doc(db, 'graduationRounds', roundId, 'registrations', mssv), payload);
    
    showToast('🎉 ĐĂNG KÝ NGUYỆN VỌNG THÀNH CÔNG!', 'success');
    await checkStudentEligibilityAndRegistration(roundId);
  } catch (err) {
    console.error('Lỗi khi nộp đăng ký:', err);
    showToast('Lỗi đăng ký: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🚀 XÁC NHẬN ĐĂNG KÝ CHÍNH THỨC</span>';
  }
};

// =========================================================================
// --- PHASE 2A: SUPERVISOR REVIEW WORKFLOW ---
// =========================================================================

export async function loadSupervisorReviewData(roundId) {
  if (!roundId) return;

  const emailLower = (state.user?.email || '').toLowerCase();
  const currentSup = state.roundSupervisors.find(s => (s.email || '').toLowerCase() === emailLower);

  const greetingEl = document.getElementById('supervisor-greeting-name');
  const roundInfoEl = document.getElementById('supervisor-round-info');
  const activeBadgeEl = document.getElementById('sup-active-round-badge');

  if (greetingEl) greetingEl.textContent = `Kính chào Thầy/Cô ${currentSup?.name || state.user?.displayName || ''}`;
  if (roundInfoEl) roundInfoEl.textContent = `Đợt tốt nghiệp: ${state.activeRound?.title || ''} (${state.activeRound?.academicYear || ''})`;
  if (activeBadgeEl) activeBadgeEl.textContent = state.activeRound?.roundName || state.activeRound?.title || 'Đợt ĐATN';

  if (!currentSup) {
    document.getElementById('sup-stat-total-cap').textContent = '0';
    document.getElementById('sup-stat-accepted-prev').textContent = '0';
    document.getElementById('sup-stat-selected-curr').textContent = '0';
    document.getElementById('sup-stat-remaining-cap').textContent = '0';
    document.getElementById('sup-round-review-indicator').textContent = 'Thầy/Cô chưa tham gia đợt này';
    document.getElementById('sup-candidates-tbody').innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">Thầy/Cô chưa được cấu hình vào danh sách GVHD đợt này.</td></tr>';
    return;
  }

  try {
    // 1. Load round supervisors fresh
    const supDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'supervisors', currentSup.id));
    const supData = supDoc.exists() ? supDoc.data() : currentSup;
    state.supervisorRoundProgress = supData.roundProgress || {};

    // 2. Load all registrations for this round
    const regSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    const allRegistrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Load decisions made in this round
    const decSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'reviewDecisions'));
    const allDecisions = decSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const currentReviewRound = state.activeRound?.currentReviewRound || 1;
    const reviewStatus = state.activeRound?.reviewStatus || 'not_started';
    const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + currentReviewRound]);
    const isCompleted = state.supervisorRoundProgress['round_' + currentReviewRound]?.status === 'completed';

    // Filter Candidates who picked this supervisor at rank == currentReviewRound AND not accepted yet AND not ineligible
    const candidates = allRegistrations.filter(r => {
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned' || r.eligibilityStatus === 'not_eligible') return false;
      const pref = (r.preferences || []).find(p => p.rank === currentReviewRound);
      return pref && (pref.supervisorId === currentSup.id || pref.supervisorId === currentSup.supervisorId);
    });

    state.supervisorCandidates = candidates;

    // Filter Accepted Students across rounds for this supervisor
    const acceptedStudents = allRegistrations.filter(r => {
      return (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') &&
        (r.acceptedSupervisorId === currentSup.id || r.acceptedSupervisorId === currentSup.supervisorId);
    });
    state.supervisorAcceptedStudents = acceptedStudents;

    // Build decisions map for current review round
    const decisionsMap = {};
    allDecisions.forEach(d => {
      if (d.round === currentReviewRound && (d.supervisorId === currentSup.id || d.supervisorId === currentSup.supervisorId)) {
        decisionsMap[d.studentId] = d.decision;
      }
    });
    state.supervisorDecisions = decisionsMap;

    // Calculate quota
    const totalCapacity = supData.capacity || 10;
    const acceptedPrev = acceptedStudents.filter(r => r.acceptedRank < currentReviewRound).length || (supData.acceptedCount || 0);
    const selectedCurr = candidates.filter(c => decisionsMap[c.studentId] === 'selected').length;
    const remainingCap = Math.max(0, totalCapacity - acceptedPrev - selectedCurr);

    // Update Top Badges
    document.getElementById('sup-stat-total-cap').textContent = totalCapacity;
    document.getElementById('sup-stat-accepted-prev').textContent = acceptedPrev;
    document.getElementById('sup-stat-selected-curr').textContent = selectedCurr;
    document.getElementById('sup-stat-remaining-cap').textContent = remainingCap;
    document.getElementById('sup-accepted-count-badge').textContent = acceptedStudents.length;
    document.getElementById('sup-total-accepted-text').textContent = `Tổng: ${acceptedStudents.length} SV`;

    // Render review UI
    renderSupervisorReviewUI(currentSup, currentReviewRound, reviewStatus, isLocked, isCompleted, remainingCap);
    renderSupervisorAcceptedTable();
  } catch (e) {
    console.error('Error loading supervisor review data:', e);
  }
}

function renderSupervisorReviewUI(currentSup, currentRound, reviewStatus, isLocked, isCompleted, remainingCap) {
  const rankBadge = document.getElementById('sup-review-rank-badge');
  const stateTag = document.getElementById('sup-round-state-tag');
  const actionBtns = document.getElementById('sup-review-action-btns');
  const indicator = document.getElementById('sup-round-review-indicator');

  rankBadge.textContent = `NGUYỆN VỌNG ${currentRound}`;

  if (reviewStatus === 'not_started' || reviewStatus === 'draft') {
    stateTag.textContent = 'Chưa bắt đầu xét';
    indicator.textContent = 'Trạng thái: Đang trong thời gian nộp đơn. Chưa mở xét duyệt.';
    actionBtns.innerHTML = '<span class="text-xs text-slate-400 italic">Chờ Quản trị viên mở vòng xét</span>';
  } else if (reviewStatus === 'completed' || state.activeRound?.status === 'published') {
    stateTag.textContent = 'Đã hoàn tất & Công bố';
    indicator.textContent = 'Trạng thái: Đã kết thúc toàn bộ quy trình xét duyệt.';
    actionBtns.innerHTML = '<span class="text-xs text-emerald-400 font-bold">✓ Đã công bố kết quả</span>';
  } else if (isLocked) {
    stateTag.textContent = 'Đã chốt vòng';
    indicator.textContent = `Trạng thái: Vòng ${currentRound} đã được Quản trị viên khóa cố định.`;
    actionBtns.innerHTML = '<span class="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold">🔒 Đã khóa danh sách</span>';
  } else if (isCompleted) {
    stateTag.textContent = 'Đã hoàn thành lựa chọn';
    indicator.textContent = `Trạng thái: Thầy/Cô đã hoàn tất lựa chọn Vòng ${currentRound}.`;
    actionBtns.innerHTML = `
      <button onclick="reopenSupervisorRound()" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5">
        <span>🔄 Mở lại để chỉnh sửa</span>
      </button>
    `;
  } else {
    stateTag.textContent = 'Đang trong thời gian xét';
    indicator.textContent = `Trạng thái: Đang xét Nguyện vọng ${currentRound}.`;
    actionBtns.innerHTML = `
      <button onclick="openSupervisorConfirmModal()" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5">
        <span>🚀 XÁC NHẬN & KẾT THÚC LỰA CHỌN</span>
      </button>
    `;
  }

  // Render candidates table
  renderSupervisorCandidatesTable(isLocked || isCompleted);
}

function renderSupervisorCandidatesTable(readOnly) {
  const tbody = document.getElementById('sup-candidates-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('search-sup-candidates')?.value || '').toLowerCase();
  const filtered = state.supervisorCandidates.filter(c => {
    return (c.studentId || '').toLowerCase().includes(searchTerm) || (c.studentName || '').toLowerCase().includes(searchTerm);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400">Không có ứng viên nào đăng ký Thầy/Cô ở Nguyện vọng này (hoặc đã được nhận ở vòng trước).</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const isSelected = state.supervisorDecisions[c.studentId] === 'selected';

    let actionBtn = '';
    if (readOnly) {
      actionBtn = isSelected
        ? '<span class="badge bg-emerald-100 text-emerald-800 font-bold">✓ Đã chọn</span>'
        : '<span class="text-slate-400 font-semibold text-xs">Không chọn</span>';
    } else {
      actionBtn = isSelected
        ? `<button onclick="toggleSupervisorDecision('${c.studentId}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all text-xs">✓ Đã chọn</button>`
        : `<button onclick="toggleSupervisorDecision('${c.studentId}')" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs">+ Chọn SV này</button>`;
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}">
        <td class="p-3.5 font-mono font-bold text-slate-900">${c.studentId}</td>
        <td class="p-3.5 font-semibold text-slate-800">${c.studentName || '--'}</td>
        <td class="p-3.5 text-slate-500">${c.className || '--'}</td>
        <td class="p-3.5 max-w-xs font-medium text-slate-900" title="${c.topicTitle}">${c.topicTitle}</td>
        <td class="p-3.5 text-slate-600">${c.projectType || '--'}</td>
        <td class="p-3.5 text-center">${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

window.filterSupervisorCandidates = function() {
  const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + (state.activeRound?.currentReviewRound || 1)]);
  const isCompleted = state.supervisorRoundProgress['round_' + (state.activeRound?.currentReviewRound || 1)]?.status === 'completed';
  renderSupervisorCandidatesTable(isLocked || isCompleted);
};

window.toggleSupervisorDecision = async function(studentId) {
  if (!checkImpersonationWriteGuard('Thay đổi quyết định chọn sinh viên')) return;

  const roundId = state.selectedRoundId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const emailLower = (state.user?.email || '').toLowerCase();
  const currentSup = state.roundSupervisors.find(s => (s.email || '').toLowerCase() === emailLower);

  if (!roundId || !currentSup) return;

  const currentDecision = state.supervisorDecisions[studentId];
  const nextDecision = currentDecision === 'selected' ? 'not_selected' : 'selected';

  // If selecting, check remaining quota
  if (nextDecision === 'selected') {
    const totalCap = currentSup.capacity || 10;
    const acceptedPrev = (state.supervisorAcceptedStudents || []).filter(r => r.acceptedRank < currentRound).length || (currentSup.acceptedCount || 0);
    const selectedCurr = Object.values(state.supervisorDecisions).filter(v => v === 'selected').length;
    const remaining = totalCap - acceptedPrev - selectedCurr;

    if (remaining <= 0) {
      showToast(`Thầy/Cô đã đạt giới hạn chỉ tiêu (${totalCap} SV). Vui lòng bỏ chọn sinh viên khác trước khi chọn thêm.`, 'info');
      return;
    }
  }

  // Update local state immediately for snappy UI
  state.supervisorDecisions[studentId] = nextDecision;
  renderSupervisorCandidatesTable(false);

  // Recalculate and update stats badges
  const totalCapacity = currentSup.capacity || 10;
  const acceptedPrev = (state.supervisorAcceptedStudents || []).filter(r => r.acceptedRank < currentRound).length || (currentSup.acceptedCount || 0);
  const selectedCurr = Object.values(state.supervisorDecisions).filter(v => v === 'selected').length;
  const remainingCap = Math.max(0, totalCapacity - acceptedPrev - selectedCurr);

  document.getElementById('sup-stat-selected-curr').textContent = selectedCurr;
  document.getElementById('sup-stat-remaining-cap').textContent = remainingCap;

  // Persist decision to Firestore
  try {
    const decId = `r${currentRound}_${studentId}_${currentSup.id}`;
    await setDoc(doc(db, 'graduationRounds', roundId, 'reviewDecisions', decId), {
      round: currentRound,
      studentId,
      supervisorId: currentSup.id,
      supervisorEmail: emailLower,
      decision: nextDecision,
      decidedAt: serverTimestamp(),
      decidedBy: emailLower
    }, { merge: true });
  } catch (err) {
    console.error('Error saving review decision:', err);
    showToast('Lỗi lưu quyết định: ' + err.message, 'error');
  }
};

window.openSupervisorConfirmModal = function() {
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const selectedCount = Object.values(state.supervisorDecisions).filter(v => v === 'selected').length;
  const remCount = document.getElementById('sup-stat-remaining-cap')?.textContent || '0';

  document.getElementById('modal-sup-confirm-round-title').textContent = `Xét duyệt Nguyện vọng ${currentRound}`;
  document.getElementById('modal-sup-selected-count').textContent = `${selectedCount} Sinh viên`;
  document.getElementById('modal-sup-rem-count').textContent = `${remCount} Sinh viên`;

  document.getElementById('modal-supervisor-confirm').classList.remove('hidden');
};

window.closeSupervisorConfirmModal = function() {
  document.getElementById('modal-supervisor-confirm').classList.add('hidden');
};

window.confirmSupervisorRoundCompletion = async function() {
  if (!checkImpersonationWriteGuard('Xác nhận hoàn thành vòng chọn sinh viên')) return;

  const roundId = state.selectedRoundId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const emailLower = (state.user?.email || '').toLowerCase();
  const currentSup = state.roundSupervisors.find(s => (s.email || '').toLowerCase() === emailLower);

  if (!roundId || !currentSup) return;

  try {
    const roundKey = `round_${currentRound}`;
    const updatePayload = {};
    updatePayload[`roundProgress.${roundKey}`] = {
      status: 'completed',
      completedAt: serverTimestamp(),
      completedBy: emailLower
    };

    await updateDoc(doc(db, 'graduationRounds', roundId, 'supervisors', currentSup.id), updatePayload);

    closeSupervisorConfirmModal();
    showToast(`✓ Thầy/Cô đã hoàn tất lựa chọn Vòng ${currentRound} thành công!`, 'info');
    await loadSupervisorReviewData(roundId);
  } catch (err) {
    showToast('Lỗi cập nhật trạng thái hoàn thành: ' + err.message, 'error');
  }
};

window.reopenSupervisorRound = async function() {
  const roundId = state.selectedRoundId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + currentRound]);

  if (isLocked) {
    showToast('Vòng này đã được Quản trị viên chốt. Không thể mở lại để chỉnh sửa.', 'warning');
    return;
  }

  const emailLower = (state.user?.email || '').toLowerCase();
  const currentSup = state.roundSupervisors.find(s => (s.email || '').toLowerCase() === emailLower);
  if (!roundId || !currentSup) return;

  if (!(await showConfirm('Mở lại vòng lựa chọn', `Mở lại Vòng ${currentRound} để chỉnh sửa danh sách lựa chọn?`, { confirmText: 'Mở lại vòng', danger: false }))) return;

  try {
    const roundKey = `round_${currentRound}`;
    const updatePayload = {};
    updatePayload[`roundProgress.${roundKey}`] = {
      status: 'pending',
      reopenedAt: serverTimestamp(),
      reopenedBy: emailLower
    };

    await updateDoc(doc(db, 'graduationRounds', roundId, 'supervisors', currentSup.id), updatePayload);
    await loadSupervisorReviewData(roundId);
  } catch (err) {
    showToast('Lỗi mở lại vòng: ' + err.message, 'error');
  }
};

window.switchSupervisorTab = function(tabKey) {
  state.supervisorTab = tabKey;
  const btnReview = document.getElementById('sup-tab-btn-review');
  const btnAccepted = document.getElementById('sup-tab-btn-accepted');
  const btnPrelim = document.getElementById('sup-tab-btn-preliminary');
  const btnReviewer = document.getElementById('sup-tab-btn-reviewer');

  const panelReview = document.getElementById('sup-panel-review');
  const panelAccepted = document.getElementById('sup-panel-accepted');
  const panelPrelim = document.getElementById('sup-panel-preliminary');
  const panelReviewer = document.getElementById('sup-panel-reviewer');

  const allBtns = [
    { btn: btnReview, panel: panelReview, key: 'review', activeCls: 'bg-indigo-600 text-white' },
    { btn: btnAccepted, panel: panelAccepted, key: 'accepted', activeCls: 'bg-emerald-600 text-white' },
    { btn: btnPrelim, panel: panelPrelim, key: 'preliminary', activeCls: 'bg-amber-600 text-white' },
    { btn: btnReviewer, panel: panelReviewer, key: 'reviewer', activeCls: 'bg-blue-600 text-white' }
  ];

  allBtns.forEach(item => {
    if (!item.btn || !item.panel) return;
    if (item.key === tabKey) {
      item.btn.className = `px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all ${item.activeCls}`;
      item.panel.classList.remove('hidden');
    } else {
      item.btn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all';
      item.panel.classList.add('hidden');
    }
  });

  if (tabKey === 'accepted') renderSupervisorAcceptedTable();
  else if (tabKey === 'preliminary') renderSupervisorPreliminaryList();
  else if (tabKey === 'reviewer') renderSupervisorReviewerList();
};

function renderSupervisorAcceptedTable() {
  const tbody = document.getElementById('sup-accepted-tbody');
  if (!tbody) return;

  if (state.supervisorAcceptedStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400">Chưa có sinh viên nào trúng tuyển chính thức.</td></tr>';
    return;
  }

  tbody.innerHTML = state.supervisorAcceptedStudents.map(s => `
    <tr class="hover:bg-slate-50">
      <td class="p-3.5 font-mono font-bold text-slate-900">${s.studentId}</td>
      <td class="p-3.5 font-semibold text-slate-800">${s.studentName || '--'}</td>
      <td class="p-3.5 max-w-xs font-medium text-blue-900 truncate" title="${s.topicTitle}">${s.topicTitle}</td>
      <td class="p-3.5">
        <span class="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">
          ${s.acceptedRank === 'manual' ? 'Phân công Khoa' : 'Nguyện vọng ' + s.acceptedRank}
        </span>
      </td>
      <td class="p-3.5 text-center">
        ${renderSupervisorScoreCell(s.studentId)}
      </td>
      <td class="p-3.5 text-center">
        ${renderThesisHdScoreCell(s.studentId)}
      </td>
    </tr>
  `).join('');
}



export async function loadAdminStats() {
  try {
    document.getElementById('stat-rounds-count').textContent = state.rounds.length;
    
    const supMasterSnap = await getDocs(collection(db, 'supervisorMaster'));
    document.getElementById('stat-supervisors-count').textContent = supMasterSnap.size;

    if (state.selectedRoundId) {
      const elSnap = await getDocs(collection(db, 'graduationRounds', state.selectedRoundId, 'eligibleStudents'));
      document.getElementById('stat-eligible-count').textContent = elSnap.size;

      const regSnap = await getDocs(collection(db, 'graduationRounds', state.selectedRoundId, 'registrations'));
      document.getElementById('stat-registrations-count').textContent = regSnap.size;
    }
  } catch (e) {
    console.error('Error loading admin stats:', e);
  }
}

window.toggleAdminRoundsAccordion = function(forceOpen) {
  const sub = document.getElementById('atab-sub-rounds');
  const chevron = document.getElementById('atab-chevron-rounds');
  if (!sub) return;
  const isCurrentlyOpen = !sub.classList.contains('hidden');
  const shouldOpen = forceOpen !== undefined ? forceOpen : !isCurrentlyOpen;

  if (shouldOpen) {
    sub.classList.remove('hidden');
    if (chevron) chevron.classList.add('rotate-180');
  } else {
    sub.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180');
  }
};

window.switchAdminTab = function(tabKey) {
  state.currentAdminTab = tabKey;

  // 1. Always bind currentRoundId to state.selectedRoundId
  if (!state.selectedRoundId && state.rounds && state.rounds.length > 0) {
    state.selectedRoundId = state.rounds[0].id;
  }

  // 2. Active button styling in clean sidebar
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    b.classList.remove('bg-slate-900', 'text-white', 'shadow-xs', 'font-bold');
    b.classList.add('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-semibold', 'text-base');
  });

  const activeBtn = document.getElementById('atab-btn-' + tabKey);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-medium');
    activeBtn.classList.add('bg-slate-900', 'text-white', 'shadow-xs', 'font-bold', 'text-base');
  }

  // 3. Tab panels toggle
  ['overview', 'review', 'rounds', 'faculty-students', 'supervisors-master', 'round-supervisors', 'eligible-students', 'project-types', 'registrations', 'preview-student', 'trash', 'timeline', 'scoring-dashboard', 'system-settings'].forEach(t => {
    const p = document.getElementById('atab-panel-' + t);
    if (p) {
      if (t === tabKey) p.classList.remove('hidden');
      else p.classList.add('hidden');
    }
  });

  // 4. Update Breadcrumb for sub-views
  if (typeof updateRoundBreadcrumb === 'function') {
    updateRoundBreadcrumb(tabKey);
  }

  // 5. Data loaders bound to current round
  const roundId = state.selectedRoundId;
  if (tabKey === 'overview') loadAdminStats();
  else if (tabKey === 'faculty-students') openFacultyStudentsTab();
  else if (tabKey === 'review') { if (roundId) loadAdminReviewData(roundId); }
  else if (tabKey === 'rounds') {
    if (typeof renderAdminRoundsCards === 'function') renderAdminRoundsCards();
    renderAdminRoundsTable();
  }
  else if (tabKey === 'supervisors-master') loadAdminSupervisorsMaster();
  else if (tabKey === 'round-supervisors' && roundId) loadAdminRoundSupervisors(roundId);
  else if (tabKey === 'eligible-students' && roundId) {
    const sel = document.getElementById('admin-round-student-select');
    if (sel && sel.value !== roundId) sel.value = roundId;
    loadAdminEligibleStudents(roundId);
  }
  else if (tabKey === 'registrations' && roundId) loadAdminRegistrations(roundId);
  else if (tabKey === 'preview-student') preparePreviewStudentDropdown();
  else if (tabKey === 'trash') renderAdminTrashTable();
  else if (tabKey === 'scoring-dashboard') loadAdminScoringDashboard();
  else if (tabKey === 'system-settings') loadAdminSystemSettings();
  else if (tabKey === 'timeline') {
    if (roundId) {
      const sel = document.getElementById('admin-timeline-round-select');
      if (sel) sel.value = roundId;
      loadAdminRoundActivities(roundId);
    }
  }
};

window.setActiveRound = async function(roundId) {
  if (!state.isAdmin) return;
  try {
    const targetRound = state.rounds.find(r => r.id === roundId);
    if (!targetRound) return;

    // VALIDATION BEFORE ACTIVATION:
    const missingItems = [];

    // 1. Time validity
    const openTime = targetRound.openAtDate ? new Date(targetRound.openAtDate).getTime() : 0;
    const closeTime = targetRound.closeAtDate ? new Date(targetRound.closeAtDate).getTime() : 0;
    if (!openTime || !closeTime || openTime >= closeTime) {
      missingItems.push('Thời gian mở/đóng đợt chưa hợp lệ');
    }

    // 2. Minimum 1 Eligible Student
    let elCount = targetRound.eligibleCount;
    if (typeof elCount !== 'number') {
      try {
        const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
        elCount = snap.docs.length;
        targetRound.eligibleCount = elCount;
      } catch (e) { elCount = 0; }
    }
    if (elCount < 1) {
      missingItems.push('Chưa có sinh viên đủ điều kiện');
    }

    // 3. Minimum 1 Supervisor
    let supCount = targetRound.supervisorCount;
    if (typeof supCount !== 'number') {
      try {
        const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'supervisors'));
        supCount = snap.docs.length;
        targetRound.supervisorCount = supCount;
      } catch (e) { supCount = 0; }
    }
    if (supCount < 1) {
      missingItems.push('Chưa có giảng viên hướng dẫn');
    }

    if (missingItems.length > 0) {
      const msg = 'Đợt chưa hoàn tất cấu hình:\n\n• ' + missingItems.join('\n• ');
      showToast(msg, 'warning', 6000);
      return;
    }

    // 1. Deactivate other rounds in local state
    state.rounds.forEach(r => {
      if (r.id === roundId) r.isActive = true;
      else r.isActive = false;
    });

    state.activeRound = targetRound;
    state.selectedRoundId = roundId;

    renderAdminRoundsTable();
    populateRoundSelectors();

    // 2. Persist in Firestore
    await updateDoc(doc(db, 'graduationRounds', roundId), { isActive: true, updatedAt: serverTimestamp() });
    for (const r of state.rounds) {
      if (r.id !== roundId && r.isActive !== false) {
        await updateDoc(doc(db, 'graduationRounds', r.id), { isActive: false, updatedAt: serverTimestamp() }).catch(() => {});
      }
    }
    showToast(`Đã đặt "${targetRound.title}" làm đợt hiện hành!`, 'info');
  } catch (err) {
    console.error('Lỗi đặt đợt hiện hành:', err);
    showToast('Lỗi đặt đợt hiện hành: ' + err.message, 'error');
  }
};

// --- SOFT DELETE & TRASH ---
window.softDeleteRound = async function(roundId) {
  if (!state.isAdmin) return;
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;

  if (!(await showConfirm('Chuyển vào Thùng rác', `Bạn có chắc chắn muốn chuyển đợt "${r.title}" vào Thùng rác?`, { confirmText: 'Chuyển vào Thùng rác', danger: true }))) return;

  try {
    const wasActive = Boolean(r.isActive);
    r.deleted = true;
    r.deletedAt = new Date().toISOString();
    r.isActive = false;

    renderAdminRoundsTable();
    populateRoundSelectors();

    await updateDoc(doc(db, 'graduationRounds', roundId), {
      deleted: true,
      deletedAt: serverTimestamp(),
      isActive: false,
      updatedAt: serverTimestamp()
    });

    showToast('Đã chuyển đợt vào Thùng rác.', 'warning');
  } catch (err) {
    console.error('Lỗi xóa đợt:', err);
    showToast('Lỗi xóa đợt: ' + err.message, 'error');
  }
};

window.restoreRound = async function(roundId) {
  if (!state.isAdmin) return;
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;

  try {
    r.deleted = false;
    r.deletedAt = null;
    r.isActive = false; // Never auto-reactivate

    renderAdminTrashTable();
    renderAdminRoundsTable();
    populateRoundSelectors();

    await updateDoc(doc(db, 'graduationRounds', roundId), {
      deleted: false,
      deletedAt: null,
      isActive: false,
      updatedAt: serverTimestamp()
    });

    showToast(`Đã khôi phục đợt "${r.title}". Đợt ở trạng thái không hiện hành.`, 'info');
  } catch (err) {
    console.error('Lỗi khôi phục đợt:', err);
    showToast('Lỗi khôi phục đợt: ' + err.message, 'error');
  }
};

window.permanentDeleteRound = async function(roundId) {
  if (!state.isAdmin) return;
  const r = state.rounds.find(x => x.id === roundId);
  const title = r ? r.title : roundId;

  if (!(await showConfirm('XÓA VĨNH VIỄN ĐỢT', `⚠️ HÀNH ĐỘNG KHÔNG THỂ HOÀN TÁC!\nBạn có chắc chắn muốn XÓA VĨNH VIỄN đợt "${title}"?`, { confirmText: 'Xóa vĩnh viễn', danger: true }))) return;

  try {
    state.rounds = state.rounds.filter(x => x.id !== roundId);
    renderAdminTrashTable();

    await deleteDoc(doc(db, 'graduationRounds', roundId));
    showToast('Đã xóa vĩnh viễn đợt khỏi cơ sở dữ liệu.', 'warning');
  } catch (err) {
    console.error('Lỗi xóa vĩnh viễn đợt:', err);
    showToast('Lỗi xóa vĩnh viễn: ' + err.message, 'error');
  }
};

function renderAdminTrashTable() {
  const tbody = document.getElementById('admin-trash-tbody');
  if (!tbody) return;

  const now = Date.now();
  const trashedRounds = (state.rounds || []).filter(r => r.deleted === true);

  // Auto purge items older than 30 days
  trashedRounds.forEach(r => {
    const delTime = r.deletedAt ? new Date(r.deletedAt).getTime() : now;
    const daysPassed = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
    if (daysPassed >= 30) {
      permanentDeleteRound(r.id).catch(console.warn);
    }
  });

  if (trashedRounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Thùng rác trống</td></tr>';
    return;
  }

  tbody.innerHTML = trashedRounds.map(r => {
    const delTime = r.deletedAt ? new Date(r.deletedAt).getTime() : now;
    const daysPassed = Math.floor((now - delTime) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 30 - daysPassed);
    const delDateStr = fmt24h(r.deletedAt);

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-bold text-slate-900">${r.title}</td>
        <td class="p-3.5 text-slate-600">${r.academicYear || '--'}</td>
        <td class="p-3.5 text-slate-500 font-mono text-[11px]">${delDateStr}</td>
        <td class="p-3.5">
          <span class="badge ${daysRemaining <= 5 ? 'badge-closed' : 'bg-amber-100 text-amber-800'}">Còn ${daysRemaining} ngày</span>
        </td>
        <td class="p-3.5 text-right space-x-2">
          <button onclick="restoreRound('${r.id}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-300">Khôi phục</button>
          <button onclick="permanentDeleteRound('${r.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-300">Xóa vĩnh viễn</button>
        </td>
      </tr>
    `;
  }).join('');
}

// --- ADMIN: ROUNDS TABLE ---
function renderAdminRoundsTable() {
  const tbody = document.getElementById('admin-rounds-tbody');
  if (!tbody) return;

  const activeRounds = (state.rounds || []).filter(r => !r.deleted);

  if (activeRounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400">Chưa có đợt tốt nghiệp nào. Bấm "+ Tạo đợt mới" để bắt đầu.</td></tr>';
    return;
  }

  tbody.innerHTML = activeRounds.map(r => {
    const timeRangeStr = fmtDateRange24h(r.openAtDate, r.closeAtDate);
    const isCurrentActive = Boolean(r.isActive);
    const shortCode = r.shortCode || r.roundName || r.slug || r.id;

    // Determine configuration status
    const isPreEligible = Boolean(r.allowRegistrationBeforeEligibility);
    const isIncomplete = (r.configStatus === 'incomplete') || (!isPreEligible && typeof r.eligibleCount === 'number' && r.eligibleCount === 0) || (typeof r.supervisorCount === 'number' && r.supervisorCount === 0);

    let statusColHtml = '';
    if (isCurrentActive) {
      statusColHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-300">● Đợt hiện hành</span>';
    } else if (isIncomplete) {
      statusColHtml = `
        <div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Thiếu SV đủ điều kiện hoặc GVHD">⚠️ Chưa hoàn tất</span>
          <button onclick="setActiveRound('${r.id}')" class="mt-1 block text-[11px] text-slate-500 hover:text-slate-800 underline">Kích hoạt</button>
        </div>
      `;
    } else {
      statusColHtml = `
        <div>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Sẵn sàng</span>
          <button onclick="setActiveRound('${r.id}')" class="mt-1 block text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline">Đặt làm hiện hành</button>
        </div>
      `;
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-slate-900">${r.title}</span>
            ${isPreEligible ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold" title="Cho phép đăng ký trước danh sách đủ điều kiện">Chờ xét ĐK</span>' : ''}
          </div>
          <span class="text-[10px] font-mono text-slate-400 block mt-0.5">Mã: ${shortCode}</span>
        </td>
        <td class="p-3.5 text-slate-600 font-semibold">${r.academicYear}</td>
        <td class="p-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">${timeRangeStr}</td>
        <td class="p-3.5 font-bold text-slate-800">${typeof r.supervisorCount === 'number' ? r.supervisorCount : (r.supervisorsCount || '--')}</td>
        <td class="p-3.5 font-bold text-slate-800">${typeof r.eligibleCount === 'number' ? r.eligibleCount : (r.registrationsCount || '--')}</td>
        <td class="p-3.5">
          <span class="badge badge-${r.status}">${r.status}</span>
        </td>
        <td class="p-3.5">
          ${statusColHtml}
        </td>
        <td class="p-3.5">
          <button onclick="copyRoundLink('${r.id}', '${shortCode}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-tdtu-blue rounded-lg font-bold text-xs flex items-center gap-1 border border-blue-200 transition-colors" title="Sao chép link ?x=${shortCode}">
            <span>📋 Link</span>
          </button>
        </td>
        <td class="p-3.5 text-right space-x-1.5 whitespace-nowrap">
          <button onclick="openRoundTimeline('${r.id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs border border-indigo-200 transition-colors" title="Kế hoạch mốc thời gian">📅 Kế hoạch</button>
          <button onclick="editRoundModal('${r.id}')" class="text-blue-600 hover:underline font-bold text-xs">Sửa</button>
          <button onclick="softDeleteRound('${r.id}')" class="text-rose-600 hover:underline font-bold text-xs">Xóa</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================================================
// ROUND CONFIGURATION: 4 SECTIONS (A: INFO, B: ELIGIBLE, C: SUPERVISORS, D: CONFIG)
// ============================================================================

state.roundModalEligibleStudents = [];
state.roundModalSupervisors = new Map(); // supId -> { supervisorId, name, email, department, photoUrl, maxQuota }

window.switchRoundModalTab = function(tabKey) {
  ['info', 'eligible', 'supervisors', 'config'].forEach(k => {
    const btn = document.getElementById('round-tab-btn-' + k);
    const panel = document.getElementById('round-modal-panel-' + k);
    if (btn) {
      if (k === tabKey) {
        btn.classList.remove('border-transparent', 'text-slate-500');
        btn.classList.add('border-tdtu-blue', 'text-tdtu-blue');
      } else {
        btn.classList.remove('border-tdtu-blue', 'text-tdtu-blue');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    }
    if (panel) {
      if (k === tabKey) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });

  updateRoundModalConfigSummary();
};

function updateRoundModalBadges() {
  const elCountBadge = document.getElementById('round-tab-eligible-count');
  const elCountCard = document.getElementById('round-eligible-count-badge');
  const supCountBadge = document.getElementById('round-tab-sup-count');
  const supCountCard = document.getElementById('round-sup-count-badge');

  const elCount = state.roundModalEligibleStudents.length;
  const supCount = state.roundModalSupervisors.size;

  if (elCountBadge) elCountBadge.textContent = elCount;
  if (elCountCard) elCountCard.textContent = `${elCount} SV`;
  if (supCountBadge) supCountBadge.textContent = supCount;
  if (supCountCard) supCountCard.textContent = `${supCount} GVHD`;

  updateRoundModalConfigSummary();
}

function updateRoundModalConfigSummary() {
  const elStatus = document.getElementById('round-summary-eligible-status');
  const supStatus = document.getElementById('round-summary-sup-status');
  const alertBox = document.getElementById('round-config-alert');

  const elCount = state.roundModalEligibleStudents.length;
  const supCount = state.roundModalSupervisors.size;

  if (elStatus) {
    if (elCount > 0) {
      elStatus.className = 'font-bold text-emerald-600';
      elStatus.textContent = `${elCount} SV (✓ Đạt)`;
    } else {
      elStatus.className = 'font-bold text-amber-600';
      elStatus.textContent = '0 SV (⚠️ Chưa có)';
    }
  }

  if (supStatus) {
    if (supCount > 0) {
      supStatus.className = 'font-bold text-emerald-600';
      supStatus.textContent = `${supCount} GV (✓ Đạt)`;
    } else {
      supStatus.className = 'font-bold text-amber-600';
      supStatus.textContent = '0 GV (⚠️ Chưa có)';
    }
  }

  if (alertBox) {
    const allowPre = document.getElementById('round-allow-pre-eligibility')?.checked === true;
    if (supCount > 0 && (elCount > 0 || allowPre)) {
      alertBox.className = 'p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold leading-relaxed';
      alertBox.innerHTML = (allowPre && elCount === 0)
        ? '✓ Đợt bật chế độ <b>Đăng ký trước điều kiện (Pre-eligibility)</b>. Sẵn sàng lưu và mở đăng ký để SV nộp nguyện vọng (trạng thái Chờ xét).'
        : '✓ Đợt đã hoàn tất cấu hình đầy đủ. Sẵn sàng kích hoạt thành Đợt hiện hành khi cần.';
    } else {
      alertBox.className = 'p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold leading-relaxed';
      const missing = [];
      if (elCount === 0 && !allowPre) missing.push('SV đủ điều kiện');
      if (supCount === 0) missing.push('GVHD tham gia');
      alertBox.innerHTML = `⚠️ Đợt chưa hoàn tất cấu hình (còn thiếu ${missing.join(' & ')}). Bạn vẫn có thể bấm <b>"Lưu Đợt"</b> dưới dạng bản nháp để bổ sung sau.`;
    }
  }
}

// Open Create Round Modal
window.openCreateRoundModal = function() {
  document.getElementById('form-round').reset();
  document.getElementById('round-form-id').value = '';
  document.getElementById('modal-round-title').textContent = 'Tạo Đợt Đồ án Tốt nghiệp Mới';

  const preEl = document.getElementById('round-allow-pre-eligibility');
  if (preEl) {
    preEl.checked = false;
    preEl.onchange = () => updateRoundModalBadges();
  }

  // Default dates
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const nextMonth = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
  const nextMonthStr = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth()+1)}-${pad(nextMonth.getDate())}`;

  const openImm = document.getElementById('round-form-open-immediately');
  if (openImm) openImm.checked = false;
  toggleRoundOpenImmediately(false);

  if (document.getElementById('round-open-date')) document.getElementById('round-open-date').value = todayStr;
  if (document.getElementById('round-close-date')) document.getElementById('round-close-date').value = nextMonthStr;
  if (document.getElementById('round-open-hour')) document.getElementById('round-open-hour').value = '08';
  if (document.getElementById('round-open-minute')) document.getElementById('round-open-minute').value = '00';
  if (document.getElementById('round-close-hour')) document.getElementById('round-close-hour').value = '17';
  if (document.getElementById('round-close-minute')) document.getElementById('round-close-minute').value = '30';

  // Reset state collections
  state.roundModalEligibleStudents = [];
  state.roundModalSupervisors = new Map();

  // Pre-populate supervisors list from Master Pool
  renderRoundModalSupervisorsList();
  renderRoundModalEligibleTable();
  updateRoundModalBadges();

  switchRoundModalTab('info');
  document.getElementById('modal-round').classList.remove('hidden');
};

// Open Edit Round Modal
window.editRoundModal = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) {
    showToast('Không tìm thấy thông tin đợt tốt nghiệp!', 'error');
    return;
  }

  document.getElementById('round-form-id').value = r.id;
  document.getElementById('round-form-title').value = r.title || '';
  document.getElementById('round-form-year').value = r.academicYear || '';
  document.getElementById('round-form-name').value = r.slug || r.shortCode || r.roundName || '';
  document.getElementById('round-form-status').value = r.status || 'draft';
  document.getElementById('round-form-pref-count').value = r.preferenceCount || '3';
  document.getElementById('round-form-selection-mode').value = r.selectionMode || 'cards';
  document.getElementById('round-form-allow-edit').checked = r.allowStudentEdit !== false;
  document.getElementById('round-form-allow-topic-edit').checked = r.allowTopicEdit !== false;
  document.getElementById('round-form-allow-pref-edit').checked = r.allowPreferenceEdit !== false;

  const preEl = document.getElementById('round-allow-pre-eligibility');
  if (preEl) {
    preEl.checked = (r.allowRegistrationBeforeEligibility === true);
    preEl.onchange = () => updateRoundModalBadges();
  }

  const emailToggle = document.getElementById('round-form-show-email-after-publish');
  if (emailToggle) emailToggle.checked = (r.showEmailAfterPublish !== false);
  const phoneToggle = document.getElementById('round-form-show-phone-after-publish');
  if (phoneToggle) phoneToggle.checked = (r.showPhoneAfterPublish !== false);

  const driveInput = document.getElementById('round-drive-folder-url');
  if (driveInput) {
    driveInput.value = r.driveRootFolderId ? `https://drive.google.com/drive/folders/${r.driveRootFolderId}` : '';
    const statusEl = document.getElementById('round-drive-folder-status');
    if (statusEl) {
      if (r.driveRootFolderId) {
        statusEl.textContent = `✅ Đã lưu (Folder ID: ${r.driveRootFolderId})`;
        statusEl.classList.remove('hidden', 'text-red-600');
        statusEl.classList.add('text-green-600');
      } else {
        statusEl.classList.add('hidden');
      }
    }
  }

  const pad = n => String(n).padStart(2, '0');

  const openImm = document.getElementById('round-form-open-immediately');
  const isImmediately = (r.openImmediately === true);
  if (openImm) openImm.checked = isImmediately;
  toggleRoundOpenImmediately(isImmediately);

  if (r.openAtDate) {
    const od = new Date(r.openAtDate);
    if (document.getElementById('round-open-date')) document.getElementById('round-open-date').value = `${od.getFullYear()}-${pad(od.getMonth()+1)}-${pad(od.getDate())}`;
    if (document.getElementById('round-open-hour')) document.getElementById('round-open-hour').value = pad(od.getHours());
    if (document.getElementById('round-open-minute')) document.getElementById('round-open-minute').value = pad(od.getMinutes());
  }
  if (r.closeAtDate) {
    const cd = new Date(r.closeAtDate);
    if (document.getElementById('round-close-date')) document.getElementById('round-close-date').value = `${cd.getFullYear()}-${pad(cd.getMonth()+1)}-${pad(cd.getDate())}`;
    if (document.getElementById('round-close-hour')) document.getElementById('round-close-hour').value = pad(cd.getHours());
    if (document.getElementById('round-close-minute')) document.getElementById('round-close-minute').value = pad(cd.getMinutes());
  }

  // Load Eligible Students for this round (strictly from round subcollection, never fallback)
  state.roundModalEligibleStudents = [];
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', r.id, 'eligibleStudents'));
    state.roundModalEligibleStudents = snap.docs.map(d => {
      const data = d.data() || {};
      const mssv = String(d.id || data.studentId || data.mssv || '').trim().toUpperCase();
      let cleanName = String(data.name || data.fullName || '').trim();
      if (cleanName === mssv || cleanName.startsWith('Sinh viên ' + mssv)) {
        cleanName = '';
      }
      return {
        studentId: mssv,
        mssv: mssv,
        ...data,
        name: cleanName,
        fullName: cleanName
      };
    });
  } catch (e) {
    console.warn('Could not load eligible students for round modal:', e);
  }

  // Load Supervisors for this round
  state.roundModalSupervisors = new Map();
  try {
    const supSnap = await getDocs(collection(db, 'graduationRounds', r.id, 'supervisors'));
    supSnap.docs.forEach(d => {
      const data = d.data();
      const supId = String(d.id || data.supervisorId || data.email || '').trim();
      if (supId) {
        state.roundModalSupervisors.set(supId, {
          id: supId,
          supervisorId: supId,
          maxQuota: data.maxQuota || 5,
          ...data
        });
      }
    });
  } catch (e) {
    console.warn('Could not load supervisors for round modal:', e);
  }

  renderRoundModalEligibleTable();
  renderRoundModalSupervisorsList();
  updateRoundModalBadges();

  // Dynamically resolve names from Faculty Student Master as soon as dataset is ready
  if (typeof ensureFacultyDatasetLoaded === 'function') {
    ensureFacultyDatasetLoaded().then(() => {
      renderRoundModalEligibleTable();
    }).catch(() => {});
  }

  document.getElementById('modal-round-title').textContent = 'Chỉnh sửa Đợt Đồ án Tốt nghiệp';
  switchRoundModalTab('info');
  document.getElementById('modal-round').classList.remove('hidden');
};

window.closeRoundModal = function() {
  document.getElementById('modal-round').classList.add('hidden');
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

// ============================================================================
// TAB C: SUPERVISORS HELPERS
// ============================================================================
function renderRoundModalSupervisorsList(filter = '') {
  const container = document.getElementById('round-supervisors-picker-list');
  if (!container) return;

  const allSups = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (typeof SAMPLE_SUPERVISORS !== 'undefined' ? SAMPLE_SUPERVISORS : []);

  const q = String(filter || '').trim().toLowerCase();
  const filtered = allSups.filter(s =>
    !q ||
    (s.name && s.name.toLowerCase().includes(q)) ||
    (s.department && s.department.toLowerCase().includes(q)) ||
    (s.email && s.email.toLowerCase().includes(q))
  );

  if (filtered.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-slate-400">Không tìm thấy giảng viên phù hợp.</div>';
    return;
  }

  container.innerHTML = filtered.map(s => {
    const supId = getSupervisorId(s);
    const isSelected = state.roundModalSupervisors.has(supId);
    const roundData = isSelected ? state.roundModalSupervisors.get(supId) : null;
    const empType = s.employmentType || 'internal';
    const maxCap = (empType === 'adjunct' ? 5 : 10);
    const initialQuota = roundData?.maxQuota || s.defaultQuota || maxCap;
    const quota = Math.min(maxCap, initialQuota);

    const typeBadge = (empType === 'adjunct')
      ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Thỉnh giảng (tối đa 5)</span>'
      : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Cơ hữu (tối đa 10)</span>';

    return `
      <div class="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
        <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleRoundModalSupervisor('${supId}', this.checked)" class="rounded text-tdtu-blue w-4 h-4">
          <img src="${s.photoUrl || 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'><circle cx=\'12\' cy=\'8\' r=\'4\' fill=\'%23cbd5e1\'/><path fill=\'%23cbd5e1\' d=\'M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z\'/></svg>'}" class="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-slate-800 text-xs block truncate">${s.name}</span>
              ${typeBadge}
            </div>
            <span class="text-[11px] text-slate-500 block truncate">${s.department || 'Thiết kế nội thất'} • ${s.email}</span>
          </div>
        </label>
        <div class="flex items-center gap-1.5 ml-3 shrink-0">
          <span class="text-[11px] text-slate-500 font-semibold">Chỉ tiêu:</span>
          <input type="number" min="1" max="${maxCap}" value="${quota}" ${!isSelected ? 'disabled' : ''} onchange="updateRoundModalSupervisorQuota('${supId}', this.value)" class="w-14 p-1 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center bg-white disabled:opacity-40 disabled:bg-slate-100">
        </div>
      </div>
    `;
  }).join('');
}

window.filterRoundModalSupervisors = function(val) {
  renderRoundModalSupervisorsList(val);
};

window.toggleRoundModalSupervisor = function(supId, isChecked) {
  if (!supId || supId === 'undefined') return;
  const allSups = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (typeof SAMPLE_SUPERVISORS !== 'undefined' ? SAMPLE_SUPERVISORS : []);

  const s = allSups.find(x => getSupervisorId(x) === supId);
  if (!s) return;

  if (isChecked) {
    // Preserve existing round quota if supervisor was previously configured in this round, otherwise default from master
    const existing = state.roundModalSupervisors.get(supId);
    const empType = s.employmentType || 'internal';
    const maxCap = (empType === 'adjunct' ? 5 : 10);
    const rawQuota = existing?.maxQuota || s.defaultQuota || maxCap;
    const initialQuota = Math.min(maxCap, Math.max(1, rawQuota));

    state.roundModalSupervisors.set(supId, {
      id: supId,
      supervisorId: supId,
      name: s.name,
      email: s.email,
      department: s.department || 'Thiết kế nội thất',
      photoUrl: s.photoUrl || '',
      employmentType: empType,
      maxQuota: initialQuota,
      active: true
    });
  } else {
    state.roundModalSupervisors.delete(supId);
  }

  renderRoundModalSupervisorsList(document.getElementById('round-sup-search-input')?.value || '');
  updateRoundModalBadges();
};

window.updateRoundModalSupervisorQuota = function(supId, val) {
  if (!supId || supId === 'undefined') return;
  const allSups = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (typeof SAMPLE_SUPERVISORS !== 'undefined' ? SAMPLE_SUPERVISORS : []);
  const s = allSups.find(x => getSupervisorId(x) === supId);
  const maxCap = (s?.employmentType === 'adjunct') ? 5 : 10;
  const q = parseInt(val, 10) || maxCap;
  if (state.roundModalSupervisors.has(supId)) {
    const item = state.roundModalSupervisors.get(supId);
    item.maxQuota = Math.max(1, Math.min(maxCap, q));
    state.roundModalSupervisors.set(supId, item);
  }
};

window.selectAllRoundModalSupervisors = function(select) {
  const allSups = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (typeof SAMPLE_SUPERVISORS !== 'undefined' ? SAMPLE_SUPERVISORS : []);

  if (select) {
    allSups.forEach(s => {
      const supId = getSupervisorId(s);
      if (!supId || supId === 'undefined') return;
      if (!state.roundModalSupervisors.has(supId)) {
        state.roundModalSupervisors.set(supId, {
          id: supId,
          supervisorId: supId,
          name: s.name,
          email: s.email,
          department: s.department || 'Thiết kế nội thất',
          photoUrl: s.photoUrl || '',
          maxQuota: s.defaultQuota || 5,
          active: true
        });
      }
    });
  } else {
    state.roundModalSupervisors.clear();
  }

  renderRoundModalSupervisorsList(document.getElementById('round-sup-search-input')?.value || '');
  updateRoundModalBadges();
};

// ============================================================================
// SAVE ROUND (HANDLES COMPLETE & INCOMPLETE CONFIG)
// ============================================================================

window.extractDriveFolderId = function(url) {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

window.testDriveFolderUrl = function(type) {
  const inputId = type === 'round' ? 'round-drive-folder-url' : 'sub-drive-folder-url';
  const statusId = type === 'round' ? 'round-drive-folder-status' : 'activity-drive-folder-status';
  
  const url = document.getElementById(inputId).value;
  const statusEl = document.getElementById(statusId);
  statusEl.classList.remove('hidden', 'text-green-600', 'text-red-600');
  
  if (!url) {
    statusEl.textContent = 'Vui lòng nhập URL';
    statusEl.classList.add('text-red-600');
    return;
  }
  
  const folderId = window.extractDriveFolderId(url);
  if (folderId) {
    statusEl.textContent = `✅ Hợp lệ (Folder ID: ${folderId})`;
    statusEl.classList.add('text-green-600');
  } else {
    statusEl.textContent = '❌ Không tìm thấy Folder ID hợp lệ trong URL';
    statusEl.classList.add('text-red-600');
  }
};

window.saveRound = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const id = document.getElementById('round-form-id')?.value?.trim();
  const title = document.getElementById('round-form-title')?.value.trim();
  const academicYear = document.getElementById('round-form-year')?.value.trim();
  let roundName = document.getElementById('round-form-name')?.value.trim();

  // Normalize shortCode to URL-safe
  const shortCode = (roundName || '').replace(/[^a-zA-Z0-9_-]/g, '');
  roundName = shortCode;

  // Read "Mở ngay" flag and 24H time components
  const openImmediately = document.getElementById('round-form-open-immediately')?.checked === true;
  const openDateStr = document.getElementById('round-open-date')?.value;
  const openHour = document.getElementById('round-open-hour')?.value || '08';
  const openMin = document.getElementById('round-open-minute')?.value || '00';

  const closeDateStr = document.getElementById('round-close-date')?.value;
  const closeHour = document.getElementById('round-close-hour')?.value || '17';
  const closeMin = document.getElementById('round-close-minute')?.value || '30';

  const preferenceCount = parseInt(document.getElementById('round-form-pref-count')?.value, 10) || 3;
  const selectionMode = document.getElementById('round-form-selection-mode')?.value || 'cards';
  const status = document.getElementById('round-form-status')?.value || 'draft';
  const allowStudentEdit = document.getElementById('round-form-allow-edit')?.checked !== false;
  const allowTopicEdit = document.getElementById('round-form-allow-topic-edit')?.checked !== false;
  const allowPreferenceEdit = document.getElementById('round-form-allow-pref-edit')?.checked !== false;

  const showEmailAfterPublish = document.getElementById('round-form-show-email-after-publish')?.checked !== false;
  const showPhoneAfterPublish = document.getElementById('round-form-show-phone-after-publish')?.checked !== false;

  if (!title || !academicYear || !roundName || (!openImmediately && !openDateStr) || !closeDateStr) {
    showToast('Vui lòng nhập đầy đủ các trường bắt buộc (*)', 'warning');
    switchRoundModalTab('info');
    return;
  }

  const submitBtn = document.querySelector('#form-round button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Đang lưu...</span>';
  }

  let openDate;
  if (openImmediately) {
    openDate = new Date();
  } else {
    const [oy, om, od] = openDateStr.split('-').map(Number);
    openDate = new Date(oy, om - 1, od, Number(openHour), Number(openMin), 0);
  }

  const [cy, cm, cd] = closeDateStr.split('-').map(Number);
  const closeDate = new Date(cy, cm - 1, cd, Number(closeHour), Number(closeMin), 0);

  const allowRegistrationBeforeEligibility = document.getElementById('round-allow-pre-eligibility')?.checked === true;
  const elCount = (state.roundModalEligibleStudents || []).length;
  const supCount = (state.roundModalSupervisors ? state.roundModalSupervisors.size : 0);
  const configStatus = (supCount > 0 && (elCount > 0 || allowRegistrationBeforeEligibility)) ? 'ready' : 'incomplete';

  const driveUrl = document.getElementById('round-drive-folder-url')?.value.trim();
  const driveRootFolderId = driveUrl ? window.extractDriveFolderId(driveUrl) : null;

  const payload = {
    title,
    academicYear,
    roundName: shortCode,
    shortCode: shortCode,
    slug: shortCode,
    openImmediately: !!openImmediately,
    openAt: openDate,
    closeAt: closeDate,
    preferenceCount,
    selectionMode,
    status,
    allowStudentEdit,
    allowTopicEdit,
    allowPreferenceEdit,
    showEmailAfterPublish,
    showPhoneAfterPublish,
    allowRegistrationBeforeEligibility: !!allowRegistrationBeforeEligibility,
    eligibilityFinalized: !allowRegistrationBeforeEligibility,
    configStatus,
    eligibleCount: elCount,
    supervisorCount: supCount,
    driveRootFolderId: driveRootFolderId || null,
    deleted: false,
    updatedAt: serverTimestamp()
  };

  try {
    let savedId = id;
    if (id) {
      await updateDoc(doc(db, 'graduationRounds', id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      payload.createdBy = state.user?.email || '';
      payload.isActive = false; // Always start non-active until explicitly activated
      const docRef = await addDoc(collection(db, 'graduationRounds'), payload);
      savedId = docRef.id;
    }

    if (!savedId) {
      throw new Error('Không thể xác định mã ID đợt tốt nghiệp');
    }

    // 1. Persist Eligible Students subcollection (strictly syncs additions, removals, and empty state)
    const currentEligibleList = state.roundModalEligibleStudents || [];
    const currentMssvSet = new Set(
      currentEligibleList
        .map(s => String(s.studentId || s.mssv || s.id || '').trim().toUpperCase())
        .filter(Boolean)
    );

    // Sync removals & clear-all: delete docs from subcollection that are no longer in current list
    try {
      const existingSnap = await getDocs(collection(db, 'graduationRounds', savedId, 'eligibleStudents'));
      if (existingSnap && !existingSnap.empty) {
        const toDeleteRefs = [];
        existingSnap.docs.forEach(d => {
          const docMssv = String(d.id || '').trim().toUpperCase();
          if (!currentMssvSet.has(docMssv)) {
            toDeleteRefs.push(d.ref);
          }
        });
        for (let offset = 0; offset < toDeleteRefs.length; offset += 450) {
          const delBatch = writeBatch(db);
          toDeleteRefs.slice(offset, offset + 450).forEach(ref => delBatch.delete(ref));
          await delBatch.commit().catch(console.warn);
        }
      }
    } catch (errSync) {
      console.warn('Lỗi đồng bộ xóa sinh viên trong subcollection eligibleStudents:', errSync);
    }

    // Persist current eligible students
    if (currentEligibleList.length > 0) {
      for (let offset = 0; offset < currentEligibleList.length; offset += 450) {
        const batch = writeBatch(db);
        const chunk = currentEligibleList.slice(offset, offset + 450);
        let validBatchCount = 0;
        chunk.forEach(s => {
          const mssv = String(s.studentId || s.mssv || s.id || '').trim().toUpperCase();
          if (!mssv || mssv === 'UNDEFINED') return;
          let studentName = String(s.name || s.fullName || '').trim();
          if (studentName === mssv || studentName.startsWith('Sinh viên ' + mssv)) {
            studentName = '';
          }
          const ref = doc(db, 'graduationRounds', savedId, 'eligibleStudents', mssv);
          batch.set(ref, {
            studentId: mssv,
            mssv: mssv,
            name: studentName,
            fullName: studentName,
            gender: s.gender || '',
            major: s.major || '',
            className: s.className || s.studentClass || '',
            email: s.email || `${mssv.toLowerCase()}@student.tdtu.edu.vn`,
            phone: s.phone || '',
            eligible: true,
            updatedAt: serverTimestamp()
          }, { merge: true });
          validBatchCount++;
        });
        if (validBatchCount > 0) {
          await batch.commit().catch(console.warn);
        }
      }
    }

    // 2. Persist Supervisors subcollection (strictly guarded against undefined supId)
    if (state.roundModalSupervisors && state.roundModalSupervisors.size > 0) {
      for (const [rawSupId, supData] of state.roundModalSupervisors.entries()) {
        const supId = String(rawSupId || supData.supervisorId || supData.id || supData.email || '').trim();
        if (!supId || supId === 'undefined') continue;
        const ref = doc(db, 'graduationRounds', savedId, 'supervisors', supId);
        await setDoc(ref, {
          supervisorId: supId,
          name: supData.name || '',
          email: supData.email || '',
          department: supData.department || 'Thiết kế nội thất',
          photoUrl: supData.photoUrl || '',
          maxQuota: supData.maxQuota || 5,
          currentCount: 0,
          active: true,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(console.warn);
      }
    }

    // Update in-memory state
    const roundObj = {
      id: savedId,
      ...payload,
      openAtDate: openDate,
      closeAtDate: closeDate
    };
    const existingIdx = (state.rounds || []).findIndex(r => r.id === savedId);
    if (existingIdx >= 0) {
      state.rounds[existingIdx] = { ...state.rounds[existingIdx], ...roundObj };
    } else {
      state.rounds.unshift(roundObj);
    }

    if (state.selectedRoundId === savedId || !state.activeRound) {
      state.selectedRoundId = savedId;
    }

    try { renderAdminRoundsTable(); } catch (e) { console.warn(e); }
    try { renderRoundsDropdowns(); } catch (e) { console.warn(e); }

    closeRoundModal();

    if (configStatus === 'incomplete') {
      showToast(`Đã lưu đợt "${title}" (Trạng thái: Chưa hoàn tất cấu hình - cần thêm SV hoặc GVHD trước khi kích hoạt).`, 'warning', 5000);
    } else {
      showToast(`✓ Đã lưu đợt "${title}" thành công (Cấu hình sẵn sàng)!`, 'success');
    }

    loadRounds().catch(console.warn);
  } catch (err) {
    console.error('Lỗi lưu đợt tốt nghiệp:', err);
    showToast('Lỗi lưu đợt: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Lưu Đợt';
    }
  }
};

// --- 6 SAMPLE INTERIOR DESIGN SUPERVISORS (SAFE STATIC IDs & NO LOCAL NETWORK PNA PROMPTS) ---
export const SAMPLE_SUPERVISORS = [
  {
    id: "sup_hoangleduy",
    supervisorId: "sup_hoangleduy",
    name: "ThS. NCS. Hoàng Lê Duy",
    email: "hoangleduy@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Quyền Trưởng Khoa - Trưởng ngành Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_ngovanduc",
    supervisorId: "sup_ngovanduc",
    name: "NTK Ngô Văn Đức",
    email: "ngovanduc@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên ngành Nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_tomailinh",
    supervisorId: "sup_tomailinh",
    name: "NTK Tô Mai Lĩnh",
    email: "tomailinh@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên ngành Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_hongocle",
    supervisorId: "sup_hongocle",
    name: "ThS. Hồ Ngọc Lệ",
    email: "hongocle@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên ngành Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_nguyenminhhieu",
    supervisorId: "sup_nguyenminhhieu",
    name: "TS. Nguyễn Minh Hiếu",
    email: "nguyenminhhieu@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên ngành Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_truongthithuydiem",
    supervisorId: "sup_truongthithuydiem",
    name: "ThS. Trương Thị Thuý Diễm",
    email: "truongthithuydiem@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên bộ môn Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  }
];

window.seedSampleSupervisors = async function(force = false) {
  if (!state.isAdmin) return;
  const existingEmails = new Set(state.supervisorsMaster.map(s => s.email?.toLowerCase()));
  const toAdd = SAMPLE_SUPERVISORS.filter(s => !existingEmails.has(s.email.toLowerCase()));
  if (toAdd.length === 0) {
    if (force) showToast('Tất cả 6 GVHD mẫu Thiết kế nội thất đã tồn tại trong danh sách!', 'warning');
    return;
  }
  try {
    for (const sup of toAdd) {
      const payload = {
        ...sup,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'supervisorMaster'), payload);
      state.supervisorsMaster.push({ id: docRef.id, ...payload });
    }
    renderAdminSupervisorsMasterTable();
    if (force) alert('Đã thêm thành công ' + toAdd.length + ' Giảng viên Hướng dẫn mẫu!');
  } catch (err) {
    console.error('Lỗi nạp GVHD mẫu:', err);
    if (force) showToast('Lỗi nạp GVHD mẫu: ' + err.message, 'error');
  }
};

// --- ADMIN: SUPERVISORS MASTER CRUD ---
async function loadAdminSupervisorsMaster() {
  try {
    const snap = await getDocs(query(collection(db, 'supervisorMaster'), orderBy('name', 'asc')));
    state.supervisorsMaster = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminSupervisorsMasterTable();
  } catch (e) {
    console.error('Error loading master supervisors:', e);
  }
}

function renderAdminSupervisorsMasterTable() {
  const tbody = document.getElementById('admin-supervisors-master-tbody');
  if (!tbody) return;

  const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23cbd5e1"/><path fill="%23cbd5e1" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';

  tbody.innerHTML = state.supervisorsMaster.map(s => {
    const isAdjunct = (s.employmentType === 'adjunct');
    const typeBadge = isAdjunct
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Thỉnh giảng</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Cơ hữu</span>';
    const quotaVal = s.defaultQuota || (isAdjunct ? 5 : 10);

    return `
    <tr class="hover:bg-slate-50">
      <td class="p-3.5"><img src="${s.photoUrl || defaultAvatar}" class="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm"></td>
      <td class="p-3.5 font-bold text-slate-900">${s.name}</td>
      <td class="p-3.5 text-slate-600">${s.gender || 'Nam'}</td>
      <td class="p-3.5 text-slate-600">${s.email || '--'} ${s.phone ? '• ' + s.phone : ''}</td>
      <td class="p-3.5 font-semibold text-slate-800">${s.department || 'Thiết kế nội thất'}</td>
      <td class="p-3.5 text-center whitespace-nowrap">${typeBadge}</td>
      <td class="p-3.5 max-w-[200px] truncate text-slate-600" title="${s.expertise || ''}">${s.expertise || '--'}</td>
      <td class="p-3.5 text-center whitespace-nowrap">
        <span class="inline-block px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg font-mono text-[11px] font-bold text-slate-700">${quotaVal} SV</span>
      </td>
      <td class="p-3.5">
        <span class="badge ${s.active !== false ? 'badge-open' : 'badge-closed'}">${s.active !== false ? 'Active' : 'Ngừng'}</span>
      </td>
      <td class="p-3.5 text-right space-x-2">
        <button onclick="editSupervisorMasterModal('${s.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
        <button onclick="deleteSupervisorMaster('${s.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
      </td>
    </tr>
  `;
  }).join('');
}


window.previewSupervisorPhoto = function(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > 2 * 1024 * 1024) {
    showToast('Vui lòng chọn ảnh dung lượng dưới 2MB', 'warning');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const previewEl = document.getElementById('sup-photo-preview');
    const photoInput = document.getElementById('sup-form-photo');
    if (previewEl) previewEl.src = dataUrl;
    if (photoInput) photoInput.value = dataUrl;
  };
  reader.readAsDataURL(file);
};

window.handleEmploymentTypeChange = function(type, isEdit = false) {
  const quotaInput = document.getElementById('sup-form-default-quota');
  if (!quotaInput) return;
  const isAdjunct = (type === 'adjunct');
  const maxCap = isAdjunct ? 5 : 10;
  quotaInput.max = maxCap;

  if (!isEdit) {
    // When creating new supervisor, set standard default
    quotaInput.value = isAdjunct ? 5 : 10;
  } else {
    // When editing, if current value exceeds new max, cap it
    const current = parseInt(quotaInput.value, 10) || 5;
    if (current > maxCap) {
      quotaInput.value = maxCap;
    }
  }
};

window.openCreateSupervisorModal = function() {
  document.getElementById('form-supervisor').reset();
  document.getElementById('sup-form-id').value = '';
  document.getElementById('sup-form-photo').value = '';
  const prevEl = document.getElementById('sup-photo-preview');
  if (prevEl) prevEl.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='8' r='4' fill='%23cbd5e1'/><path fill='%23cbd5e1' d='M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z'/></svg>";
  
  if (document.getElementById('sup-form-dept-select')) {
    document.getElementById('sup-form-dept-select').value = 'Thiết kế nội thất';
  }
  if (document.getElementById('sup-form-dept-custom')) {
    document.getElementById('sup-form-dept-custom').classList.add('hidden');
    document.getElementById('sup-form-dept-custom').value = '';
  }
  if (document.getElementById('sup-form-dept')) {
    document.getElementById('sup-form-dept').value = 'Thiết kế nội thất';
  }
  if (document.getElementById('sup-form-gender')) {
    document.getElementById('sup-form-gender').value = 'Nam';
  }
  
  // Default to internal (Cơ hữu) with defaultQuota = 10
  if (document.getElementById('sup-form-employment-type')) {
    document.getElementById('sup-form-employment-type').value = 'internal';
  }
  if (document.getElementById('sup-form-default-quota')) {
    document.getElementById('sup-form-default-quota').max = 10;
    document.getElementById('sup-form-default-quota').value = '10';
  }
  
  document.getElementById('modal-supervisor-title').textContent = 'Thêm Giảng viên Hướng dẫn';
  document.getElementById('modal-supervisor').classList.remove('hidden');
};

window.editSupervisorMasterModal = function(supId) {
  const s = state.supervisorsMaster.find(x => x.id === supId);
  if (!s) return;

  document.getElementById('sup-form-id').value = s.id;
  document.getElementById('sup-form-name').value = s.name || '';
  document.getElementById('sup-form-email').value = s.email || '';
  document.getElementById('sup-form-phone').value = s.phone || '';
  document.getElementById('sup-form-photo').value = s.photoUrl || '';
  const prevElEdit = document.getElementById('sup-photo-preview');
  if (prevElEdit) prevElEdit.src = s.photoUrl || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='8' r='4' fill='%23cbd5e1'/><path fill='%23cbd5e1' d='M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z'/></svg>";
  
  if (document.getElementById('sup-form-gender')) {
    document.getElementById('sup-form-gender').value = s.gender || 'Nam';
  }

  const dept = s.department || 'Thiết kế nội thất';
  const deptSelect = document.getElementById('sup-form-dept-select');
  const deptCustom = document.getElementById('sup-form-dept-custom');
  const deptHidden = document.getElementById('sup-form-dept');
  
  const standardDepts = ['Thiết kế nội thất', 'Thiết kế đồ họa', 'Thiết kế thời trang', 'Thiết kế công nghiệp', 'Nghệ thuật số'];
  if (standardDepts.includes(dept)) {
    if (deptSelect) deptSelect.value = dept;
    if (deptCustom) { deptCustom.classList.add('hidden'); deptCustom.value = ''; }
    if (deptHidden) deptHidden.value = dept;
  } else {
    if (deptSelect) deptSelect.value = '__other__';
    if (deptCustom) { deptCustom.classList.remove('hidden'); deptCustom.value = dept; }
    if (deptHidden) deptHidden.value = dept;
  }

  document.getElementById('sup-form-expertise').value = s.expertise || '';
  document.getElementById('sup-form-bio').value = s.bio || '';
  document.getElementById('sup-form-active').checked = s.active !== false;

  // Employment type & quota logic (preserving existing quota if within max cap)
  const empType = s.employmentType || 'internal';
  if (document.getElementById('sup-form-employment-type')) {
    document.getElementById('sup-form-employment-type').value = empType;
  }
  const maxCap = (empType === 'adjunct' ? 5 : 10);
  const existingQuota = Number(s.defaultQuota);
  const finalQuota = (!isNaN(existingQuota) && existingQuota >= 1) ? Math.min(maxCap, existingQuota) : (empType === 'adjunct' ? 5 : 10);

  if (document.getElementById('sup-form-default-quota')) {
    document.getElementById('sup-form-default-quota').max = maxCap;
    document.getElementById('sup-form-default-quota').value = finalQuota;
  }

  document.getElementById('modal-supervisor-title').textContent = 'Chỉnh sửa Giảng viên Hướng dẫn';
  document.getElementById('modal-supervisor').classList.remove('hidden');
};

window.deleteSupervisorMaster = async function(supId) {
  const sup = state.supervisorsMaster.find(s => s.id === supId);
  if (!sup) return;

  // Check if used in any rounds
  const inRound = state.roundSupervisors.some(rs => rs.supervisorId === supId || rs.id === supId);
  let msg = `Xóa giảng viên "${sup.name}" (${sup.email}) khỏi Danh sách GVHD?`;
  if (inRound) {
    msg = `⚠️ CẢNH BÁO: Giảng viên "${sup.name}" đang được phân công trong đợt tốt nghiệp hiện tại!\n\nBạn có chắc chắn muốn xóa khỏi Danh sách GVHD không?`;
  }

  const confirmed = await showConfirm('Xóa Giảng viên Hướng dẫn', msg, { confirmText: 'Xóa vĩnh viễn', danger: true });
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'supervisorMaster', supId));
    state.supervisorsMaster = state.supervisorsMaster.filter(s => s.id !== supId);
    renderAdminSupervisorsMasterTable();
    showToast(`Đã xóa giảng viên "${sup.name}" thành công.`, 'success');
  } catch (err) {
    console.error('Lỗi xóa GVHD:', err);
    showToast('Lỗi xóa GVHD: ' + err.message, 'error');
  }
};

window.closeSupervisorModal = function() {
  document.getElementById('modal-supervisor').classList.add('hidden');
};

window.saveSupervisorMaster = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const id = document.getElementById('sup-form-id')?.value;
  const name = document.getElementById('sup-form-name')?.value.trim();
  const email = document.getElementById('sup-form-email')?.value.trim().toLowerCase();
  const phone = document.getElementById('sup-form-phone')?.value.trim();
  const photoUrl = document.getElementById('sup-form-photo')?.value.trim();
  const gender = document.getElementById('sup-form-gender')?.value || 'Nam';

  let department = 'Thiết kế nội thất';
  const deptSelect = document.getElementById('sup-form-dept-select')?.value;
  if (deptSelect === '__other__') {
    department = document.getElementById('sup-form-dept-custom')?.value.trim() || 'Khác';
  } else if (deptSelect) {
    department = deptSelect;
  }

  const expertise = document.getElementById('sup-form-expertise')?.value.trim();
  const bio = document.getElementById('sup-form-bio')?.value.trim();
  const active = document.getElementById('sup-form-active')?.checked !== false;

  const employmentType = document.getElementById('sup-form-employment-type')?.value || 'internal';
  const maxCap = (employmentType === 'adjunct' ? 5 : 10);
  const defaultQuotaRaw = parseInt(document.getElementById('sup-form-default-quota')?.value, 10);
  const defaultQuota = (Number.isInteger(defaultQuotaRaw) && defaultQuotaRaw >= 1) ? Math.min(maxCap, defaultQuotaRaw) : maxCap;

  if (!name || !email || !email.includes('@')) {
    showToast('Vui lòng điền Họ tên và Email hợp lệ', 'error');
    return;
  }

  const submitBtn = document.querySelector('#form-supervisor button[type="submit"]');
  const origText = submitBtn ? submitBtn.innerHTML : 'Lưu GVHD';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Đang lưu...</span>';
  }

  const payload = {
    name, email, phone, photoUrl, gender, department, expertise, bio,
    employmentType,
    defaultQuota,
    active,
    updatedAt: serverTimestamp()
  };

  try {
    let savedId = id;
    if (id) {
      await updateDoc(doc(db, 'supervisorMaster', id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      const docRef = await addDoc(collection(db, 'supervisorMaster'), payload);
      savedId = docRef.id;
    }

    const supObj = { id: savedId, ...payload };
    const existingIdx = state.supervisorsMaster.findIndex(s => s.id === savedId);
    if (existingIdx >= 0) {
      state.supervisorsMaster[existingIdx] = { ...state.supervisorsMaster[existingIdx], ...supObj };
    } else {
      state.supervisorsMaster.unshift(supObj);
    }

    renderAdminSupervisorsMasterTable();
    closeSupervisorModal();
    showToast('Lưu Giảng viên Hướng dẫn thành công!', 'success');

    // Background sync
    loadAdminSupervisorsMaster().catch(console.error);
  } catch (err) {
    console.error('Lỗi lưu GVHD:', err);
    showToast('Lỗi lưu GVHD: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
    }
  }
};

// --- ADMIN: ROUND SUPERVISORS ---
window.loadAdminRoundSupervisors = async function(roundId) {
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'supervisors'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminRoundSupervisorsTable(roundId, list);
  } catch (e) {
    console.error('Error loading admin round supervisors:', e);
  }
};

function renderAdminRoundSupervisorsTable(roundId, list) {
  const tbody = document.getElementById('admin-round-supervisors-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Chưa có GVHD nào trong đợt này. Bấm "+ Thêm GVHD từ kho Master" để thêm.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(s => `
    <tr class="hover:bg-slate-50">
      <td class="p-3.5 font-bold text-slate-900">${s.name}</td>
      <td class="p-3.5 text-slate-600">${s.department || '--'}</td>
      <td class="p-3.5">
        <input type="number" id="cap-input-${s.id}" value="${s.capacity || 10}" min="1" max="100" class="w-20 p-1 border rounded-lg font-bold text-center">
      </td>
      <td class="p-3.5">
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" id="active-round-chk-${s.id}" ${s.activeInRound !== false ? 'checked' : ''} class="rounded text-blue-600">
          <span class="text-xs font-semibold">${s.activeInRound !== false ? 'Hoạt động' : 'Tạm ẩn'}</span>
        </label>
      </td>
      <td class="p-3.5 text-right space-x-2">
        <button onclick="saveRoundSupervisorRow('${roundId}', '${s.id}')" class="text-emerald-600 font-bold hover:underline">Lưu</button>
        <button onclick="removeRoundSupervisor('${roundId}', '${s.id}')" class="text-rose-600 font-bold hover:underline">Bỏ khỏi đợt</button>
      </td>
    </tr>
  `).join('');
}

window.saveRoundSupervisorRow = async function(roundId, supId) {
  const capacity = parseInt(document.getElementById('cap-input-' + supId).value, 10) || 10;
  const activeInRound = document.getElementById('active-round-chk-' + supId).checked;

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId, 'supervisors', supId), {
      capacity, activeInRound, updatedAt: serverTimestamp()
    });
    showToast('Đã cập nhật chỉ tiêu GVHD trong đợt thành công!', 'success');
  } catch (e) {
    showToast('Lỗi cập nhật: ' + e.message, 'error');
  }
};

window.removeRoundSupervisor = async function(roundId, supId) {
  if (!(await showConfirm('Bỏ GVHD khỏi đợt', 'Bạn có chắc chắn muốn gỡ GVHD này khỏi đợt tốt nghiệp?', { confirmText: 'Gỡ khỏi đợt', danger: true }))) return;
  try {
    await deleteDoc(doc(db, 'graduationRounds', roundId, 'supervisors', supId));
    loadAdminRoundSupervisors(roundId);
  } catch (e) {
    showToast('Lỗi xóa: ' + e.message, 'error');
  }
};

window.updateSupPickerCount = function() {
  const count = document.querySelectorAll('.sup-picker-chk:checked').length;
  const countEl = document.getElementById('sup-master-picker-selected-count');
  if (countEl) countEl.textContent = count;
};

window.toggleSelectAllSupPicker = function() {
  const chks = document.querySelectorAll('.sup-picker-chk');
  const anyUnchecked = Array.from(chks).some(c => !c.checked);
  chks.forEach(c => c.checked = anyUnchecked);
  updateSupPickerCount();
};

window.openAddSupervisorsToRoundModal = async function() {
  await loadAdminSupervisorsMaster();
  const listEl = document.getElementById('sup-master-picker-list');
  const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23cbd5e1"/><path fill="%23cbd5e1" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';
  
  const activeSups = state.supervisorsMaster.filter(s => s.active !== false);
  const totalBadge = document.getElementById('sup-picker-total-badge');
  if (totalBadge) totalBadge.textContent = `${activeSups.length} GVHD khả dụng`;

  listEl.innerHTML = activeSups.map(s => `
    <label class="flex items-center gap-3.5 p-3 hover:bg-slate-50 cursor-pointer rounded-xl transition-colors">
      <input type="checkbox" value="${s.id}" onchange="updateSupPickerCount()" class="sup-picker-chk w-4 h-4 rounded text-blue-600">
      <img src="${s.photoUrl || defaultAvatar}" class="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-sm shrink-0">
      <div class="flex-1 min-w-0">
        <span class="font-bold text-slate-800 text-xs block truncate">${s.name}</span>
        <span class="text-[11px] text-slate-500 block truncate">${s.department || 'Thiết kế nội thất'} • ${s.expertise || 'Đang cập nhật'}</span>
      </div>
    </label>
  `).join('');

  updateSupPickerCount();
  document.getElementById('modal-add-sup-to-round').classList.remove('hidden');
};

window.closeAddSupToRoundModal = function() {
  document.getElementById('modal-add-sup-to-round').classList.add('hidden');
};

window.saveSelectedSupervisorsToRound = async function() {
  const roundId = document.getElementById('admin-round-sup-select').value;
  if (!roundId) return;

  const chks = Array.from(document.querySelectorAll('.sup-picker-chk:checked'));
  if (chks.length === 0) {
    showToast('Vui lòng chọn ít nhất 1 giảng viên.', 'warning');
    return;
  }

  const batch = writeBatch(db);
  chks.forEach(chk => {
    const supId = chk.value;
    const sup = state.supervisorsMaster.find(s => s.id === supId);
    if (!sup) return;

    const ref = doc(db, 'graduationRounds', roundId, 'supervisors', supId);
    batch.set(ref, {
      supervisorId: supId,
      name: sup.name,
      email: sup.email || '',
      phone: sup.phone || '',
      photoUrl: sup.photoUrl || '',
      department: sup.department || '',
      expertise: sup.expertise || '',
      bio: sup.bio || '',
      showEmail: sup.showEmail !== false,
      showPhone: Boolean(sup.showPhone),
      showPhoto: sup.showPhoto !== false,
      capacity: 10,
      activeInRound: true,
      sortOrder: 1,
      createdAt: serverTimestamp()
    });
  });

  try {
    await batch.commit();
    closeAddSupToRoundModal();
    loadAdminRoundSupervisors(roundId);
  } catch (e) {
    showToast('Lỗi thêm GVHD: ' + e.message, 'error');
  }
};

// --- ADMIN: ELIGIBLE STUDENTS (EXCEL PARSING & BATCH IMPORT) ---
window.loadAdminEligibleStudents = async function(roundId) {
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
    state.eligibleStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminEligibleStudentsTable();
  } catch (e) {
    console.error('Error loading eligible students:', e);
  }
};

function renderAdminEligibleStudentsTable() {
  const tbody = document.getElementById('admin-eligible-students-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('search-eligible-input')?.value || '').toLowerCase();
  const filtered = state.eligibleStudents.filter(s => {
    return (s.studentId || '').toLowerCase().includes(searchTerm) || (s.name || '').toLowerCase().includes(searchTerm);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400">Chưa có dữ liệu sinh viên trong đợt này. Tải file Excel lên để nhập danh sách.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => `
    <tr class="hover:bg-slate-50">
      <td class="p-3 font-mono font-bold text-slate-900">${s.studentId}</td>
      <td class="p-3 font-semibold text-slate-800">${s.name || '--'}</td>
      <td class="p-3 text-slate-500">${s.email || '--'}</td>
      <td class="p-3">${s.className || '--'}</td>
      <td class="p-3">${s.major || 'Thiết kế Nội thất'}</td>
      <td class="p-3"><span class="badge badge-open">Đủ ĐK</span></td>
      <td class="p-3 text-right">
        <button onclick="deleteEligibleStudent('${s.studentId}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
      </td>
    </tr>
  `).join('');
}

window.filterEligibleTable = function() {
  renderAdminEligibleStudentsTable();
};

window.deleteEligibleStudent = async function(studentId) {
  const roundId = document.getElementById('admin-round-student-select').value;
  if (!(await showConfirm('Xóa sinh viên', `Xóa sinh viên ${studentId} khỏi danh sách đủ điều kiện của đợt?`, { confirmText: 'Xóa', danger: true }))) return;
  try {
    await deleteDoc(doc(db, 'graduationRounds', roundId, 'eligibleStudents', studentId));
    loadAdminEligibleStudents(roundId);
  } catch (e) {
    showToast('Lỗi xóa: ' + e.message, 'error');
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
      alert('Không đọc được file Excel: ' + err.message);
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
    loadAdminEligibleStudents(roundId);
  } catch (err) {
    showToast('Lỗi import Firestore: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Xác nhận Nhập vào Firestore';
  }
};

// --- ADMIN: PROJECT TYPES CRUD ---
function renderAdminProjectTypesTable() {
  const tbody = document.getElementById('admin-project-types-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.projectTypes.map((p, idx) => `
    <tr class="hover:bg-slate-50">
      <td class="p-3.5 font-mono font-bold text-slate-400">${idx + 1}</td>
      <td class="p-3.5 font-bold text-slate-900">${p.name}</td>
      <td class="p-3.5">
        <span class="badge ${p.active !== false ? 'badge-open' : 'badge-closed'}">${p.active !== false ? 'Hiển thị' : 'Đang ẩn'}</span>
      </td>
      <td class="p-3.5 text-right space-x-2">
        <button onclick="editProjectTypeModal('${p.id}')" class="text-blue-600 hover:underline font-bold text-xs">Sửa</button>
        <button onclick="toggleProjectTypeActive('${p.id}', ${p.active !== false})" class="text-slate-600 hover:underline font-bold text-xs">${p.active !== false ? 'Ẩn' : 'Hiện'}</button>
        <button onclick="deleteProjectType('${p.id}')" class="text-rose-600 hover:underline font-bold text-xs">Xóa</button>
      </td>
    </tr>
  `).join('');
}

window.editProjectTypeModal = function(id) {
  const pt = state.projectTypes.find(p => p.id === id);
  if (!pt) return;
  document.getElementById('pt-form-id').value = pt.id;
  document.getElementById('pt-form-name').value = pt.name || '';
  document.getElementById('pt-form-order').value = pt.order || 1;
  document.getElementById('pt-form-active').checked = pt.active !== false;
  document.getElementById('modal-project-type').classList.remove('hidden');
};

window.deleteProjectType = async function(id) {
  const pt = state.projectTypes.find(p => p.id === id);
  if (!pt) return;

  // Check if used in any rounds
  const inUse = state.rounds.some(r => (r.allowedProjectTypes || []).includes(pt.name));
  let msg = `Xóa loại hình đồ án "${pt.name}"?`;
  if (inUse) {
    msg = `⚠️ CẢNH BÁO: Loại hình đồ án "${pt.name}" đang được sử dụng trong các đợt tốt nghiệp!\n\nBạn có chắc chắn muốn xóa không?`;
  }

  const confirmed = await showConfirm('Xóa Loại hình Đồ án', msg, { confirmText: 'Xóa vĩnh viễn', danger: true });
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'graduationProjectTypes', id));
    showToast(`Đã xóa loại hình "${pt.name}".`, 'success');
    await loadProjectTypes();
  } catch (err) {
    showToast('Lỗi xóa loại hình: ' + err.message, 'error');
  }
};

window.openAddProjectTypeModal = function() {
  document.getElementById('form-project-type').reset();
  document.getElementById('pt-form-id').value = '';
  document.getElementById('pt-form-order').value = state.projectTypes.length + 1;
  document.getElementById('modal-project-type').classList.remove('hidden');
};

window.closeProjectTypeModal = function() {
  document.getElementById('modal-project-type').classList.add('hidden');
};

window.saveProjectType = async function(e) {
  e.preventDefault();
  const id = document.getElementById('pt-form-id')?.value;
  const name = document.getElementById('pt-form-name').value.trim();
  const order = parseInt(document.getElementById('pt-form-order').value, 10) || 1;
  const active = document.getElementById('pt-form-active').checked;

  if (!name) {
    showToast('Vui lòng nhập tên loại hình đồ án.', 'error');
    return;
  }

  try {
    if (id) {
      await updateDoc(doc(db, 'graduationProjectTypes', id), {
        name, order, active, updatedAt: serverTimestamp()
      });
      showToast('Đã cập nhật loại hình đồ án thành công!', 'success');
    } else {
      await addDoc(collection(db, 'graduationProjectTypes'), {
        name, order, active, createdAt: serverTimestamp()
      });
      showToast('Đã thêm loại hình đồ án thành công!', 'success');
    }
    closeProjectTypeModal();
    await loadProjectTypes();
  } catch (err) {
    showToast('Lỗi lưu loại hình: ' + err.message, 'error');
  }
};

window.toggleProjectTypeActive = async function(id, currentActive) {
  try {
    await updateDoc(doc(db, 'graduationProjectTypes', id), { active: !currentActive });
    await loadProjectTypes();
  } catch (e) {
    showToast('Lỗi cập nhật: ' + e.message, 'error');
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
// --- PHASE 2A: ADMIN REVIEW MANAGEMENT MODULE ---
// =========================================================================

window.loadAdminReviewData = async function(roundId) {
  if (!roundId) return;

  try {
    // 1. Fetch Round doc
    const roundDoc = await getDoc(doc(db, 'graduationRounds', roundId));
    if (roundDoc.exists()) {
      const data = roundDoc.data();
      state.activeRound = {
        id: roundDoc.id,
        ...data,
        openAtDate: data.openAt ? (data.openAt.toDate ? data.openAt.toDate() : new Date(data.openAt)) : null,
        closeAtDate: data.closeAt ? (data.closeAt.toDate ? data.closeAt.toDate() : new Date(data.closeAt)) : null
      };
    }

    // 2. Fetch Supervisors
    const supSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'supervisors'));
    const supervisors = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Fetch Registrations
    const regSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    const registrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 4. Fetch Decisions
    const decSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'reviewDecisions'));
    const decisions = decSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 5. Fetch Eligible Students
    const elSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
    const eligible = elSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    state.adminReviewData = {
      supervisors,
      registrations,
      decisions,
      eligible
    };

    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();
    renderAdminManualAssignmentTable();
    renderAdminAssignedSupervisorsTable();
  } catch (e) {
    console.error('Error loading admin review data:', e);
  }
};

function renderAdminReviewDashboard() {
  const round = state.activeRound;
  if (!round) return;

  const currentRound = round.currentReviewRound || 0;
  const reviewStatus = round.reviewStatus || 'not_started';
  const preferenceCount = round.preferenceCount || 3;

  const statusPill = document.getElementById('admin-review-status-pill');
  const titleEl = document.getElementById('admin-review-current-title');
  const descEl = document.getElementById('admin-review-current-desc');
  const actionsWrap = document.getElementById('admin-review-actions-wrap');

  // Compute Stats
  const totalReg = state.adminReviewData.registrations.length;
  const acceptedList = state.adminReviewData.registrations.filter(r => r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned');
  const acceptedCount = acceptedList.length;
  const unassignedCount = totalReg - acceptedCount;
  const totalQuota = state.adminReviewData.supervisors.reduce((sum, s) => sum + (s.capacity || 10), 0);
  const fillRate = totalQuota > 0 ? Math.round((acceptedCount / totalQuota) * 100) : 0;

  document.getElementById('adm-stat-total-reg').textContent = totalReg;
  document.getElementById('adm-stat-accepted').textContent = acceptedCount;
  document.getElementById('adm-stat-unassigned').textContent = unassignedCount;
  document.getElementById('adm-stat-total-quota').textContent = totalQuota;
  document.getElementById('adm-stat-fill-rate').textContent = `${fillRate}%`;
  document.getElementById('adm-unassigned-count-tag').textContent = `${unassignedCount} SV`;

  if (reviewStatus === 'not_started' || reviewStatus === 'draft' || currentRound === 0) {
    statusPill.className = 'badge bg-slate-200 text-slate-800 font-black';
    statusPill.textContent = 'Chưa bắt đầu xét';
    titleEl.textContent = 'Chưa bắt đầu Xét Nguyện vọng';
    descEl.textContent = 'Đợt đăng ký đã có ' + totalReg + ' hồ sơ. Bấm Bắt đầu Xét Nguyện vọng 1 để mở quyền lựa chọn cho Giảng viên.';
    actionsWrap.innerHTML = `
      <button onclick="startAdminReviewRound1()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>▶️ BẮT ĐẦU XÉT NGUYỆN VỌNG 1</span>
      </button>
    `;
  } else if (reviewStatus.startsWith('round_')) {
    statusPill.className = 'badge bg-amber-400 text-slate-900 font-black';
    statusPill.textContent = `Đang xét Nguyện vọng ${currentRound}`;
    titleEl.textContent = `Đang tiến hành: Xét duyệt Nguyện vọng ${currentRound} / ${preferenceCount}`;
    descEl.textContent = `Theo dõi tiến độ hoàn thành của các GVHD. Khi các GVHD đã chọn xong, bấm Chốt vòng để cập nhật kết quả và chuyển sang vòng tiếp theo.`;

    actionsWrap.innerHTML = `
      <button onclick="openAdminLockRoundModal()" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>🔒 CHỐT NGUYỆN VỌNG ${currentRound} & CHUYỂN VÒNG →</span>
      </button>
    `;
  } else if (reviewStatus === 'manual_assignment') {
    statusPill.className = 'badge bg-indigo-200 text-indigo-900 font-black';
    statusPill.textContent = 'Phân công thủ công';
    titleEl.textContent = 'Giai đoạn: Phân công GVHD Thủ công';
    descEl.textContent = `Tất cả ${preferenceCount} vòng nguyện vọng đã kết thúc. Còn ${unassignedCount} sinh viên chưa có GVHD. Hãy phân công sinh viên vào các GVHD còn chỉ tiêu trước khi Công bố kết quả.`;

    actionsWrap.innerHTML = `
      <button onclick="publishAdminResults()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>📢 HOÀN TẤT & CÔNG BỐ KẾT QUẢ CHÍNH THỨC</span>
      </button>
    `;
  } else if (reviewStatus === 'completed' || round.status === 'published') {
    statusPill.className = 'badge bg-emerald-500 text-white font-black';
    statusPill.textContent = 'Đã hoàn tất & Công bố';
    titleEl.textContent = 'Đã Hoàn tất & Công bố Kết quả ĐATN';
    descEl.textContent = `Kết quả phân công GVHD đã được công bố chính thức cho toàn thể sinh viên và giảng viên.`;
    actionsWrap.innerHTML = `
      <span class="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm">✓ ĐÃ CÔNG BỐ CHÍNH THỨC</span>
    `;
  }
}

function renderAdminReviewSupervisorsTable() {
  const tbody = document.getElementById('admin-review-supervisors-tbody');
  if (!tbody) return;

  const currentRound = state.activeRound?.currentReviewRound || 1;
  const supervisors = state.adminReviewData.supervisors;
  const registrations = state.adminReviewData.registrations;
  const decisions = state.adminReviewData.decisions;

  let completedCount = 0;

  tbody.innerHTML = supervisors.map(s => {
    const totalCap = s.capacity || 10;
    
    // Accepted previously in rounds < currentRound
    const acceptedPrev = registrations.filter(r => {
      return (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') &&
        (r.acceptedSupervisorId === s.id || r.acceptedSupervisorId === s.supervisorId) &&
        (r.acceptedRank < currentRound);
    }).length;

    // Candidates in current round
    const candidates = registrations.filter(r => {
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') return false;
      const pref = (r.preferences || []).find(p => p.rank === currentRound);
      return pref && (pref.supervisorId === s.id || pref.supervisorId === s.supervisorId);
    });

    // Currently selected in this round
    const selectedCount = candidates.filter(c => {
      const dec = decisions.find(d => d.round === currentRound && (d.supervisorId === s.id || d.supervisorId === s.supervisorId) && d.studentId === c.studentId);
      return dec && dec.decision === 'selected';
    }).length;

    const remainingCap = Math.max(0, totalCap - acceptedPrev - selectedCount);

    const isCompleted = s.roundProgress && s.roundProgress['round_' + currentRound]?.status === 'completed';
    const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + currentRound]);

    if (isCompleted || isLocked) completedCount++;

    let statusBadge = '';
    if (isLocked) {
      statusBadge = '<span class="badge bg-slate-800 text-slate-200 font-bold">🔒 Đã khóa</span>';
    } else if (isCompleted) {
      statusBadge = '<span class="badge bg-emerald-100 text-emerald-800 font-bold">✓ Đã xong</span>';
    } else {
      statusBadge = '<span class="badge bg-amber-100 text-amber-800 font-bold">⏳ Đang chờ</span>';
    }

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-bold text-slate-900">${s.name}</td>
        <td class="p-3.5 text-slate-600">${s.department || '--'}</td>
        <td class="p-3.5 text-center font-bold text-slate-800">${totalCap}</td>
        <td class="p-3.5 text-center font-bold text-emerald-600">${acceptedPrev}</td>
        <td class="p-3.5 text-center font-bold text-indigo-600">${candidates.length}</td>
        <td class="p-3.5 text-center font-bold text-blue-700">${selectedCount}</td>
        <td class="p-3.5 text-center font-bold ${remainingCap > 0 ? 'text-amber-600' : 'text-slate-400'}">${remainingCap}</td>
        <td class="p-3.5 text-center">${statusBadge}</td>
        <td class="p-3.5 text-right">
          <button onclick="openAdminInspectSupModal('${s.id}')" class="text-blue-600 hover:underline font-bold text-xs">Xem chi tiết</button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('adm-sup-progress-ratio').textContent = `${completedCount} / ${supervisors.length} GV hoàn tất`;
}

function renderAdminManualAssignmentTable() {
  const tbody = document.getElementById('admin-manual-assign-tbody');
  if (!tbody) return;

  const registrations = state.adminReviewData.registrations;
  const unassigned = registrations.filter(r => r.reviewStatus !== 'accepted' && r.reviewStatus !== 'manually_assigned');

  if (unassigned.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-emerald-700 font-bold bg-emerald-50/50">🎉 Tất cả sinh viên đã được phân công Giảng viên hướng dẫn!</td></tr>';
    return;
  }

  tbody.innerHTML = unassigned.map(r => {
    const prefsText = (r.preferences || []).map(p => `NV${p.rank}: ${p.supervisorName}`).join(' • ') || '--';

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-mono font-bold text-slate-900">${r.studentId}</td>
        <td class="p-3.5 font-semibold text-slate-800">${r.studentName || '--'}</td>
        <td class="p-3.5 max-w-xs font-medium text-slate-900" title="${r.topicTitle}">${r.topicTitle}</td>
        <td class="p-3.5 text-slate-600">${r.projectType || '--'}</td>
        <td class="p-3.5 text-[11px] text-slate-500 max-w-xs truncate" title="${prefsText}">${prefsText}</td>
        <td class="p-3.5 font-bold text-amber-700 text-xs">Chưa phân công</td>
        <td class="p-3.5 text-right">
          <button onclick="openAdminManualAssignModal('${r.studentId}')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm">
            Phân công GV
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.startAdminReviewRound1 = async function() {
  const roundId = state.selectedRoundId;
  if (!roundId) return;

  if (!(await showConfirm('Bắt đầu Xét duyệt', 'Bắt đầu quy trình xét duyệt Nguyện vọng 1? Giảng viên hướng dẫn sẽ có thể đăng nhập và chọn sinh viên.', { confirmText: 'Bắt đầu ngay', danger: false }))) return;

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      currentReviewRound: 1,
      reviewStatus: 'round_1',
      status: 'reviewing',
      updatedAt: serverTimestamp()
    });

    showToast('▶️ Đã bắt đầu xét duyệt Nguyện vọng 1 thành công!', 'success');
    await loadAdminReviewData(roundId);
  } catch (e) {
    showToast('Lỗi bắt đầu xét duyệt: ' + e.message, 'error');
  }
};

window.openAdminLockRoundModal = function() {
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const supervisors = state.adminReviewData.supervisors;
  const pendingSups = supervisors.filter(s => {
    return !(s.roundProgress && s.roundProgress['round_' + currentRound]?.status === 'completed');
  });

  document.getElementById('modal-admin-lock-round-title').textContent = `Khóa & Chốt Nguyện vọng ${currentRound}`;
  
  const warningEl = document.getElementById('modal-admin-lock-warning');
  if (pendingSups.length > 0) {
    document.getElementById('modal-admin-pending-sups-count').textContent = pendingSups.length;
    warningEl.classList.remove('hidden');
  } else {
    warningEl.classList.add('hidden');
  }

  document.getElementById('modal-admin-lock-round').classList.remove('hidden');
};

window.closeAdminLockRoundModal = function() {
  document.getElementById('modal-admin-lock-round').classList.add('hidden');
};

window.confirmAdminLockRound = async function() {
  const roundId = state.selectedRoundId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const preferenceCount = state.activeRound?.preferenceCount || 3;
  const supervisors = state.adminReviewData.supervisors;
  const registrations = state.adminReviewData.registrations;
  const decisions = state.adminReviewData.decisions;

  if (!roundId) return;

  const btn = document.querySelector('#modal-admin-lock-round button.bg-rose-600');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang thực hiện chốt vòng...';
  }

  try {
    const batch = writeBatch(db);

    const supAcceptedIncrements = {};
    supervisors.forEach(s => supAcceptedIncrements[s.id] = 0);

    // 1. Process candidate students in current round
    registrations.forEach(r => {
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') return;

      const pref = (r.preferences || []).find(p => p.rank === currentRound);
      if (!pref) return;

      const supId = pref.supervisorId;
      const dec = decisions.find(d => d.round === currentRound && (d.supervisorId === supId) && d.studentId === r.studentId);

      const isSelected = dec && dec.decision === 'selected';

      if (isSelected) {
        // Mark Student as Accepted
        const regRef = doc(db, 'graduationRounds', roundId, 'registrations', r.studentId);
        batch.update(regRef, {
          reviewStatus: 'accepted',
          acceptedSupervisorId: supId,
          acceptedSupervisorName: pref.supervisorName,
          acceptedRank: currentRound,
          acceptedAt: serverTimestamp(),
          acceptedBy: state.user?.email || 'admin'
        });

        if (supAcceptedIncrements[supId] !== undefined) {
          supAcceptedIncrements[supId] += 1;
        }
      } else {
        // Check if student has next preference
        const hasNextPref = (r.preferences || []).some(p => p.rank === currentRound + 1);
        const regRef = doc(db, 'graduationRounds', roundId, 'registrations', r.studentId);

        if (!hasNextPref || currentRound >= preferenceCount) {
          batch.update(regRef, {
            reviewStatus: 'unassigned',
            updatedAt: serverTimestamp()
          });
        }
      }
    });

    // 2. Update supervisor acceptedCount
    supervisors.forEach(s => {
      const inc = supAcceptedIncrements[s.id] || 0;
      if (inc > 0) {
        const currentCount = s.acceptedCount || 0;
        const supRef = doc(db, 'graduationRounds', roundId, 'supervisors', s.id);
        batch.update(supRef, {
          acceptedCount: currentCount + inc,
          updatedAt: serverTimestamp()
        });
      }
    });

    // 3. Lock current round & Advance round
    const roundRef = doc(db, 'graduationRounds', roundId);
    const lockKey = `reviewLocks.round_${currentRound}`;
    const nextRound = currentRound + 1;
    const nextStatus = nextRound <= preferenceCount ? `round_${nextRound}` : 'manual_assignment';

    const roundUpdate = {
      currentReviewRound: nextRound,
      reviewStatus: nextStatus,
      updatedAt: serverTimestamp()
    };
    roundUpdate[lockKey] = {
      lockedAt: serverTimestamp(),
      lockedBy: state.user?.email || 'admin'
    };

    batch.update(roundRef, roundUpdate);

    await batch.commit();

    closeAdminLockRoundModal();
    showToast(`🔒 ĐÃ CHỐT THÀNH CÔNG NGUYỆN VỌNG ${currentRound}!\nChuyển sang: ${nextStatus === 'manual_assignment' ? 'Phân công thủ công' : 'Xét Nguyện vọng ' + nextRound}`, 'info');
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi khi chốt vòng:', err);
    showToast('Lỗi chốt vòng: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔒 Xác nhận Chốt Vòng';
    }
  }
};

window.openAdminInspectSupModal = function(supId) {
  state.inspectingSupervisorId = supId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const sup = state.adminReviewData.supervisors.find(s => s.id === supId);
  if (!sup) return;

  const totalCap = sup.capacity || 10;
  const acceptedPrev = (state.adminReviewData.registrations || []).filter(r => {
    return (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') &&
      (r.acceptedSupervisorId === sup.id) &&
      (r.acceptedRank < currentRound);
  }).length;

  const candidates = (state.adminReviewData.registrations || []).filter(r => {
    if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') return false;
    const pref = (r.preferences || []).find(p => p.rank === currentRound);
    return pref && (pref.supervisorId === sup.id);
  });

  const decisions = state.adminReviewData.decisions;

  document.getElementById('inspect-sup-name').textContent = `Chi tiết Xét duyệt: ${sup.name}`;
  document.getElementById('inspect-sup-quota-info').textContent = `Chỉ tiêu: ${totalCap} | Đã nhận trước: ${acceptedPrev} | Ứng viên Vòng ${currentRound}: ${candidates.length}`;

  const tbody = document.getElementById('inspect-sup-candidates-tbody');
  if (candidates.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-400">Không có ứng viên nào đăng ký trong vòng này.</td></tr>';
  } else {
    tbody.innerHTML = candidates.map(c => {
      const dec = decisions.find(d => d.round === currentRound && d.supervisorId === sup.id && d.studentId === c.studentId);
      const isSelected = dec && dec.decision === 'selected';

      return `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-mono font-bold text-slate-900">${c.studentId}</td>
          <td class="p-3 font-semibold text-slate-800">${c.studentName || '--'}</td>
          <td class="p-3 max-w-xs font-medium text-slate-700 truncate" title="${c.topicTitle}">${c.topicTitle}</td>
          <td class="p-3">
            ${isSelected ? '<span class="badge bg-emerald-100 text-emerald-800 font-bold">✓ Giảng viên đã chọn</span>' : '<span class="text-slate-400 font-semibold">Chưa chọn</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('modal-admin-inspect-sup').classList.remove('hidden');
};

window.closeAdminInspectSupModal = function() {
  document.getElementById('modal-admin-inspect-sup').classList.add('hidden');
};

window.openAdminManualAssignModal = function(studentId) {
  state.manualAssignStudentId = studentId;
  const reg = state.adminReviewData.registrations.find(r => r.studentId === studentId);
  if (!reg) return;

  document.getElementById('manual-assign-student-info').textContent = `${reg.studentId} — ${reg.studentName || ''}`;
  document.getElementById('manual-assign-topic-info').textContent = `Đề tài: ${reg.topicTitle} (${reg.projectType})`;

  const select = document.getElementById('select-manual-supervisor');
  select.innerHTML = state.adminReviewData.supervisors.map(s => {
    const acceptedCount = (state.adminReviewData.registrations || []).filter(r => (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') && r.acceptedSupervisorId === s.id).length;
    const remaining = (s.capacity || 10) - acceptedCount;
    return `<option value="${s.id}">${s.name} (Còn ${remaining > 0 ? remaining : 0} chỗ • Tổng ${s.capacity || 10})</option>`;
  }).join('');

  document.getElementById('modal-admin-manual-assign').classList.remove('hidden');
};

window.closeAdminManualAssignModal = function() {
  document.getElementById('modal-admin-manual-assign').classList.add('hidden');
};

window.saveAdminManualAssign = async function() {
  const roundId = state.selectedRoundId;
  const studentId = state.manualAssignStudentId;
  const supervisorId = document.getElementById('select-manual-supervisor')?.value;
  const overrideCapacity = document.getElementById('chk-override-capacity')?.checked;

  if (!roundId || !studentId || !supervisorId) return;

  const sup = state.adminReviewData.supervisors.find(s => s.id === supervisorId);
  const acceptedCount = (state.adminReviewData.registrations || []).filter(r => (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') && r.acceptedSupervisorId === sup.id).length;
  const remaining = (sup?.capacity || 10) - acceptedCount;

  if (remaining <= 0 && !overrideCapacity) {
    showToast('Giảng viên này đã hết chỉ tiêu. Hãy chọn giảng viên khác hoặc tích vào ô "Quyền High Admin: Cho phép phân công vượt chỉ tiêu".', 'info');
    return;
  }

  try {
    const batch = writeBatch(db);

    // 1. Update Registration
    const regRef = doc(db, 'graduationRounds', roundId, 'registrations', studentId);
    batch.update(regRef, {
      reviewStatus: 'manually_assigned',
      acceptedSupervisorId: supervisorId,
      acceptedSupervisorName: sup?.name || 'GVHD',
      acceptedRank: 'manual',
      acceptedAt: serverTimestamp(),
      acceptedBy: state.user?.email || 'admin'
    });

    // 2. Increment Supervisor acceptedCount
    const supRef = doc(db, 'graduationRounds', roundId, 'supervisors', supervisorId);
    batch.update(supRef, {
      acceptedCount: (sup?.acceptedCount || 0) + 1,
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    closeAdminManualAssignModal();
    showToast(`✓ Đã phân công sinh viên ${studentId} cho Thầy/Cô ${sup?.name} thành công!`, 'info');
    await loadAdminReviewData(roundId);
  } catch (err) {
    showToast('Lỗi phân công: ' + err.message, 'error');
  }
};

window.publishAdminResults = async function() {
  const roundId = state.selectedRoundId;
  if (!roundId) return;

  const unassignedCount = (state.adminReviewData.registrations || []).filter(r => r.reviewStatus !== 'accepted' && r.reviewStatus !== 'manually_assigned').length;

  if (unassignedCount > 0) {
    if (!(await showConfirm('Công bố Kết quả Chính thức', `Vẫn còn ${unassignedCount} sinh viên chưa được phân công GVHD. Bạn có chắc chắn muốn hoàn tất và CÔNG BỐ KẾT QUẢ CHÍNH THỨC không?`, { confirmText: 'Công bố kết quả', danger: true }))) return;
  } else {
    if (!(await showConfirm('Công bố Kết quả Chính thức', 'Xác nhận HOÀN TẤT & CÔNG BỐ KẾT QUẢ CHÍNH THỨC cho sinh viên và giảng viên?', { confirmText: 'Xác nhận công bố', danger: false }))) return;
  }

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      reviewStatus: 'completed',
      status: 'published',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    showToast('🎉 ĐÃ CÔNG BỐ KẾT QUẢ ĐỒ ÁN TỐT NGHIỆP CHÍNH THỨC THÀNH CÔNG!', 'success');
    await loadAdminReviewData(roundId);
  } catch (err) {
    showToast('Lỗi công bố kết quả: ' + err.message, 'error');
  }
};

// --- ADMIN: PREVIEW AS STUDENT ---
async function preparePreviewStudentDropdown() {
  const select = document.getElementById('preview-select-mssv');
  if (!select) return;

  const roundId = state.selectedRoundId;
  if (!roundId) return;

  try {
    const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    select.innerHTML = list.length === 0 
      ? '<option value="">(Chưa có danh sách SV đủ điều kiện)</option>'
      : list.map(s => `<option value="${s.studentId}">${s.studentId} — ${s.name || ''} (${s.className || ''})</option>`).join('');
  } catch (e) {}
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
// FEATURE: ADMIN IMPERSONATION / ACT-AS TEST MODE (v2.6.0-beta.1)
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
      impersonating: true,
      readOnly: true,
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
    assertNotImpersonatingForWrite(actionDesc);
    return false;
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

      // Update toggle / status label in Admin Settings if open
      const toggle = document.getElementById('toggle-admin-impersonation');
      const label = document.getElementById('impersonation-status-label');
      if (toggle) toggle.checked = isAllowed;
      if (label) {
        label.textContent = isAllowed ? 'Đang bật' : 'Đang tắt';
        label.className = isAllowed ? 'text-[11px] font-bold text-amber-600' : 'text-[11px] font-bold text-slate-500';
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
  } catch (e) {
    console.warn('[SystemSettings] Error loading settings:', e);
  }
}
window.loadAdminSystemSettings = loadAdminSystemSettings;

window.onToggleAdminImpersonation = async function(enabled) {
  const isOwner = isSystemOwner();
  if (!isOwner) {
    alert('Chỉ Chủ sở hữu hệ thống (tranquanghai@tdtu.edu.vn) có quyền cấu hình tính năng này.');
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

    // If disabled, auto terminate any active impersonation sessions
    if (!state.allowImpersonation && state.impersonation) {
      await exitImpersonation();
    }

    updateAuthUI();
    hideLoading();
    if (typeof showToast === 'function') {
      showToast(state.allowImpersonation ? '✓ Đã bật tính năng Đóng vai người dùng.' : '✓ Đã tắt tính năng Đóng vai người dùng.', 'success', 3000);
    }
  } catch (e) {
    hideLoading();
    console.error('[SystemSettings] Toggle error:', e);
    alert('Lỗi cập nhật thiết lập: ' + e.message);
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
      if (target.roundTitle) {
        roundEl.textContent = `Đợt: ${target.roundTitle}`;
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
}
window.applyImpersonationActor = applyImpersonationActor;

window.startImpersonating = async function(target) {
  if (!state.allowImpersonation) {
    alert('Tính năng đóng vai hiện đang bị tắt trong Cài đặt hệ thống.');
    return;
  }
  if (!state.realIsAdmin) {
    alert('Chỉ Quản trị viên mới có quyền sử dụng tính năng này.');
    return;
  }

  const sessionData = {
    realUser: {
      uid: state.realUser?.uid || '',
      email: state.realUser?.email || '',
      displayName: state.realUser?.displayName || ''
    },
    target: target,
    mode: 'read_only',
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
    showToast(`Đã bắt đầu đóng vai: ${target.name} (${target.roleLabel || target.type}) - Chế độ Chỉ đọc.`, 'info', 4000);
  }

  // Navigate to corresponding portal
  if (target.type === 'student') {
    if (window.location.pathname.includes('/admin') || window.location.pathname.includes('/supervisor') || window.location.pathname.includes('/assessment')) {
      window.location.href = '/graduation/';
    } else {
      await switchView('student');
      if (typeof checkStudentEligibilityAndRegistration === 'function') {
        checkStudentEligibilityAndRegistration(target.roundId || state.selectedRoundId);
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

window.openAdminImpersonateModal = function() {
  if (!state.allowImpersonation || !state.realIsAdmin) {
    alert('Tính năng đóng vai chưa được bật trong Cài đặt hệ thống hoặc bạn không có quyền.');
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

  gatherAndRenderImpersonateCandidates();
};

window.closeAdminImpersonateModal = function() {
  const modal = document.getElementById('modal-admin-impersonate');
  if (modal) modal.classList.add('hidden');
};

window.onImpersonateFiltersChange = function() {
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

  const candidates = [];
  const candidateKeys = new Set();

  function addCandidate(cand) {
    const key = `${cand.type}_${cand.email || cand.id || cand.mssv}_${cand.roundId || ''}`;
    if (!candidateKeys.has(key)) {
      candidateKeys.add(key);
      candidates.push(cand);
    }
  }

  // 1. SUPERVISORS (from state.supervisorsMaster and rounds)
  if (roleFilter === 'all' || roleFilter === 'supervisor') {
    const sups = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
      ? state.supervisorsMaster
      : (typeof SAMPLE_SUPERVISORS !== 'undefined' ? SAMPLE_SUPERVISORS : []);
    
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
          roundTitle: '',
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
            name: st.studentName || st.name || sid,
            email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
            roundId: r.id,
            roundTitle: r.roundName || r.title || r.id,
            topicTitle: st.topicTitle || '',
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
            name: st.studentName || st.name || sid,
            email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
            roundId: r.id,
            roundTitle: r.roundName || r.title || r.id,
            topicTitle: '',
            roleLabel: 'Sinh viên'
          });
        }
      });

      // If registrations for selected round not in memory, query Firestore subcollection
      if (roundFilter !== 'all' && regs.length === 0 && eligible.length === 0) {
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
                name: st.studentName || st.name || sid,
                email: st.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
                roundId: r.id,
                roundTitle: r.roundName || r.title || r.id,
                topicTitle: st.topicTitle || '',
                roleLabel: 'Sinh viên'
              });
            }
          });
        } catch (e) {}
      }
    }

    // Also check facultyStudents if candidates are empty
    if (candidates.filter(c => c.type === 'student').length === 0 && Array.isArray(state.facultyStudents) && state.facultyStudents.length > 0) {
      state.facultyStudents.slice(0, 30).forEach(fs => {
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
            topicTitle: '',
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
      const rSups = r.supervisors || [];
      rSups.forEach(s => {
        if (s.email) {
          addCandidate({
            type: 'preliminary',
            id: s.id || s.email,
            name: s.name || s.email,
            email: s.email,
            roundId: r.id,
            roundTitle: r.roundName || r.title || r.id,
            roleLabel: 'Cán bộ chấm Sơ khảo'
          });
        }
      });
    }
  }

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

  if (countEl) countEl.textContent = String(filtered.length);

  if (listEl) {
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">Không tìm thấy người dùng thực tế phù hợp với bộ lọc.</div>';
      return;
    }

    listEl.innerHTML = filtered.map((c, idx) => {
      let roleBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
      if (c.type === 'supervisor') roleBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      else if (c.type === 'reviewer') roleBadgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
      else if (c.type === 'council') roleBadgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
      else if (c.type === 'preliminary') roleBadgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';

      const candDataJson = escapeHtml(JSON.stringify(c));

      return `
        <div class="p-3 bg-white hover:bg-amber-50/40 rounded-xl border border-slate-200 hover:border-amber-300 transition-all flex items-center justify-between gap-3 shadow-2xs">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base shrink-0">
              ${c.type === 'student' ? '🎓' : (c.type === 'supervisor' ? '👨‍🏫' : (c.type === 'reviewer' ? '🔍' : (c.type === 'council' ? '⚖️' : '📋')))}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-slate-900 text-xs truncate">${escapeHtml(c.name)}</span>
                ${c.mssv ? `<span class="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">${escapeHtml(c.mssv)}</span>` : ''}
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold border ${roleBadgeColor}">
                  ${escapeHtml(c.roleLabel)}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-2">
                <span>✉️ ${escapeHtml(c.email || '--')}</span>
                ${c.department ? `<span>• Khoa/BM: ${escapeHtml(c.department)}</span>` : ''}
                ${c.roundTitle ? `<span class="text-amber-800 font-medium">• ${escapeHtml(c.roundTitle)}</span>` : ''}
                ${c.topicTitle ? `<span class="text-blue-700 font-medium italic truncate">• Đề tài: ${escapeHtml(c.topicTitle)}</span>` : ''}
              </div>
            </div>
          </div>
          <button type="button" onclick='startImpersonatingFromData(${candDataJson})' class="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer">
            <span>🎭</span> <span>Đóng vai</span>
          </button>
        </div>
      `;
    }).join('');
  }
}
window.gatherAndRenderImpersonateCandidates = gatherAndRenderImpersonateCandidates;

// --- SUPERVISOR BIO MODAL ---
window.openBioModal = function(supId) {
  const sup = state.roundSupervisors.find(s => s.id === supId) || state.supervisorsMaster.find(s => s.id === supId);
  if (!sup) return;

  const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23cbd5e1"/><path fill="%23cbd5e1" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';

  document.getElementById('bio-modal-photo').src = (sup.showPhoto !== false && sup.photoUrl) ? sup.photoUrl : defaultAvatar;
  document.getElementById('bio-modal-name').textContent = sup.name || '--';
  document.getElementById('bio-modal-dept').textContent = sup.department || '--';
  document.getElementById('bio-modal-expertise').textContent = sup.expertise || 'Đang cập nhật';
  document.getElementById('bio-modal-text').textContent = sup.bio || 'Chưa có thông tin giới thiệu.';

  // Requirement 7: Hide email and phone during registration / before published
  let contactHtml = '';
  const isPublished = state.activeRound?.status === 'published' || state.activeRound?.reviewStatus === 'completed';
  if (isPublished && state.activeRound?.showEmailAfterPublish !== false && sup.email) {
    contactHtml += `<div class="flex items-center gap-1.5 text-slate-600"><span>✉️ Email:</span> <a href="mailto:${sup.email}" class="text-blue-600 hover:underline">${sup.email}</a></div>`;
  }
  if (isPublished && state.activeRound?.showPhoneAfterPublish !== false && sup.phone) {
    contactHtml += `<div class="flex items-center gap-1.5 text-slate-600"><span>📞 SĐT:</span> <a href="tel:${sup.phone}" class="text-blue-600 hover:underline">${sup.phone}</a></div>`;
  }
  if (!isPublished) {
    contactHtml = '<div class="text-[11px] text-slate-400 italic">Thông tin liên hệ (Email, SĐT) sẽ được hiển thị sau khi Khoa công bố kết quả phân công chính thức.</div>';
  }
  document.getElementById('bio-modal-contacts').innerHTML = contactHtml;

  document.getElementById('modal-sup-bio').classList.remove('hidden');
};

window.closeBioModal = function() {
  document.getElementById('modal-sup-bio').classList.add('hidden');
};

// --- AUTH BUTTONS BINDING ---
document.getElementById('btn-login-main')?.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert('Đăng nhập Google thất bại: ' + err.message);
  }
});

document.getElementById('btn-header-login')?.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert('Đăng nhập Google thất bại: ' + err.message);
  }
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.reload();
});

document.getElementById('input-topic-title')?.addEventListener('input', e => {
  const len = e.target.value.length;
  document.getElementById('topic-char-count').textContent = `${len}/250`;
});

// Start application
initFirebase().then(() => {
  setupAuthListener();
});


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

export const DEFAULT_IFAA_DATASET_URL = "https://firebasestorage.googleapis.com/v0/b/ifa-activities.firebasestorage.app/o/datasets%2Ffaculty-students.json.gz?alt=media&token=9a1e615e-3d20-48e7-8c9e-967e21140a21";

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

function normalizeFacultyRows(value) {
  const rows = Array.isArray(value) ? value : value?.students;
  if (!Array.isArray(rows)) return [];
  return rows.filter(item => item && item.mssv).map(item => {
    const mssv = String(item.mssv).trim().toUpperCase();
    const fullName = String(item.name || item.fullName || '').trim().replace(/\s+/g, ' ');
    const studentClass = String(item.studentClass || item.className || '').trim();
    return {
      mssv,
      studentId: mssv,
      name: fullName,
      fullName: fullName,
      email: String(item.email || `${mssv.toLowerCase()}@student.tdtu.edu.vn`).trim().toLowerCase(),
      gender: String(item.gender || '').trim(),
      major: String(item.major || '').trim(),
      className: studentClass,
      studentClass: studentClass,
      admissionYear: item.admissionYear || '',
      course: item.course || '',
      phone: item.phone || ''
    };
  });
}

// ============================================================================
// CENTRAL STUDENT RESOLVER API (READ-ONLY)
// ============================================================================

window.getFacultyStudent = function(studentId) {
  if (!studentId) return null;
  const cleanId = String(studentId).trim().toUpperCase();

  // 1. In-memory Map lookup (O(1))
  if (state.facultyStudentsMap && state.facultyStudentsMap.has(cleanId)) {
    return state.facultyStudentsMap.get(cleanId);
  }

  // 2. In-memory array fallback
  const inList = (state.facultyStudents || []).find(s => s.mssv === cleanId || s.studentId === cleanId);
  if (inList) {
    if (state.facultyStudentsMap) state.facultyStudentsMap.set(cleanId, inList);
    return inList;
  }

  // 3. Graceful fallback for missing student in master (never crash)
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

  // Compile candidate URLs: meta.datasetUrl first, then default tokenized Storage URL
  const candidateUrls = [];
  if (meta?.datasetUrl && typeof meta.datasetUrl === 'string') {
    candidateUrls.push(meta.datasetUrl);
  }
  if (DEFAULT_IFAA_DATASET_URL && !candidateUrls.includes(DEFAULT_IFAA_DATASET_URL)) {
    candidateUrls.push(DEFAULT_IFAA_DATASET_URL);
  }

  for (const url of candidateUrls) {
    if (bytes) break;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        if (buffer && buffer.byteLength > 0) {
          bytes = new Uint8Array(buffer);
          break;
        }
      }
    } catch (e) {
      console.warn('[IFAA ReadOnly] Lỗi tải từ URL:', url, e.message);
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
        state.facultyStudents = rows;
        state.facultyStudentsMap = new Map(rows.map(s => [s.mssv, s]));
        state.facultyStudentsLoaded = true;

        // Save to IndexedDB
        await setFacultyCache({
          version: currentVersion || Date.now(),
          rows: rows,
          cachedAt: Date.now(),
          count: rows.length
        });

        populateFacultyClassFilter(rows);
        updateFacultyStatusUI(`Dữ liệu IFAA: ${rows.length.toLocaleString('vi-VN')} SV (Đã làm mới)`, 'success');
        return rows;
      }
    } catch (err) {
      console.error('[IFAA ReadOnly] Lỗi giải nén / phân tích dữ liệu IFAA:', err);
    }
  }

  // 7. Fallback to cached rows if available
  if (cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
    state.facultyStudents = cached.rows;
    state.facultyStudentsMap = new Map(cached.rows.map(s => [s.mssv, s]));
    state.facultyStudentsLoaded = true;
    populateFacultyClassFilter(cached.rows);
    updateFacultyStatusUI(`Dữ liệu IFAA: ${cached.rows.length.toLocaleString('vi-VN')} SV (Bản lưu offline)`, 'warning');
    if (force) {
      showToast(`Không thể cập nhật từ IFAA. Đang dùng dữ liệu lưu gần nhất: ${cached.rows.length.toLocaleString('vi-VN')} SV.`, 'warning', 5000);
    }
    return cached.rows;
  }

  // 8. Error handling when both live download and cache failed
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
    const rows = await loadFacultyDatasetFromIFAA({ force: true });
    if (!rows || rows.length === 0) {
      showToast('⚠️ Không tìm thấy sinh viên nào từ IFAA.', 'warning');
      updateFacultyStatusUI('Dữ liệu IFAA trống', 'warning');
      return;
    }
    applyFacultyFiltersAndRender(1);
    showToast(`✓ Đã tải ${rows.length.toLocaleString('vi-VN')} sinh viên từ IFAA.`, 'success', 5000);
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
// MODULE: TIMELINE / KẾ HOẠCH ĐỢT TỐT NGHIỆP (IFA+ GRADUATION BETA v1.6.0)
// ============================================================================

export const ACTIVITY_TYPES = {
  announcement: { label: 'Thông báo', icon: '📢', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  submission: { label: 'Nộp bài', icon: '📥', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  review: { label: 'Duyệt hội đồng', icon: '📋', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  preliminary: { label: 'Sơ khảo', icon: '🔍', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  thesis: { label: 'Chấm thuyết minh', icon: '📖', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  defense: { label: 'Bảo vệ', icon: '🎓', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  other: { label: 'Khác', icon: '📌', color: 'bg-slate-100 text-slate-700 border-slate-200' }
};

export function getActivityStatus(act) {
  const now = new Date();
  const start = act.startAt ? new Date(act.startAt) : null;
  const end = act.endAt ? new Date(act.endAt) : null;

  if (end && !isNaN(end.getTime()) && now > end) {
    return 'past'; // Đã kết thúc
  }
  if (start && !isNaN(start.getTime()) && now < start) {
    return 'upcoming'; // Sắp tới
  }
  if ((start && now >= start && (!end || now <= end)) || (!start && end && now <= end)) {
    return 'ongoing'; // Đang diễn ra
  }
  return 'neutral'; // Không có hạn / Kế hoạch
}

export function fmtActivityTime(start, end) {
  if (!start && !end) return 'Chưa ấn định thời gian';
  const pad = n => String(n).padStart(2, '0');
  const fmtPart = iso => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return {
      date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
  };

  const p1 = start ? fmtPart(start) : null;
  const p2 = end ? fmtPart(end) : null;

  if (p1 && p2) {
    if (p1.date === p2.date) {
      return `${p1.date} • ${p1.time} → ${p2.time}`;
    }
    return `${p1.date} ${p1.time} → ${p2.date} ${p2.time}`;
  }
  if (p1) return `Bắt đầu: ${p1.date} ${p1.time}`;
  if (p2) return `Hạn cuối: ${p2.date} ${p2.time}`;
  return '--';
}

// Vietnamese Date/Time Parsing & Conversion Helpers
export function isoToVietnameseDateTime(isoStr) {
  if (!isoStr) return { date: '', time: '' };
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const pad = n => String(n).padStart(2, '0');
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
}

export function parseVietnameseDateTime(dateStr, timeStr, defaultTime = '00:00') {
  if (!dateStr || !dateStr.trim()) return '';
  const dTrim = dateStr.trim();
  const m = dTrim.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null; // Invalid format

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  // Verify real days in month
  const testDate = new Date(year, month - 1, day);
  if (testDate.getDate() !== day || testDate.getMonth() !== month - 1) return null;

  const tTrim = (timeStr && timeStr.trim()) ? timeStr.trim() : defaultTime;
  const tm = tTrim.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!tm) return null; // Invalid time

  const hour = String(parseInt(tm[1], 10)).padStart(2, '0');
  const min = String(parseInt(tm[2], 10)).padStart(2, '0');

  const pad = n => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${hour}:${min}:00`;
}

// Auto format DD/MM/YYYY while typing
window.formatDateInput = function(input) {
  let val = input.value.replace(/\D/g, '');
  if (val.length > 8) val = val.substring(0, 8);
  if (val.length >= 5) {
    input.value = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4);
  } else if (val.length >= 3) {
    input.value = val.substring(0, 2) + '/' + val.substring(2);
  } else {
    input.value = val;
  }
};

window.validateDateInput = function(input) {
  const val = input.value.trim();
  if (!val) return true;
  const parsed = parseVietnameseDateTime(val, '00:00');
  if (parsed === null) {
    showToast('Ngày không hợp lệ! Vui lòng nhập định dạng DD/MM/YYYY (ví dụ: 25/09/2026)', 'warning');
    input.classList.add('border-rose-500', 'bg-rose-50');
    return false;
  }
  input.classList.remove('border-rose-500', 'bg-rose-50');
  return true;
};

window.validateTimeInput = function(input) {
  const val = input.value.trim();
  if (!val) return true;
  const tm = val.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!tm) {
    showToast('Giờ không hợp lệ! Vui lòng nhập định dạng 24h HH:mm (ví dụ: 08:30, 21:00)', 'warning');
    input.classList.add('border-rose-500', 'bg-rose-50');
    return false;
  }
  const pad = n => String(n).padStart(2, '0');
  input.value = `${pad(tm[1])}:${pad(tm[2])}`;
  input.classList.remove('border-rose-500', 'bg-rose-50');
  return true;
};

window.syncPickerToDateInput = function(target, isoDate) {
  if (!isoDate) return;
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const vnDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    const input = document.getElementById(`activity-form-${target}-date`);
    if (input) input.value = vnDate;
    const timeInput = document.getElementById(`activity-form-${target}-time`);
    if (timeInput && !timeInput.value.trim()) {
      timeInput.value = target === 'start' ? '08:00' : '17:00';
    }
  }
};

window.clearActivityDateTime = function(target) {
  const dateInput = document.getElementById(`activity-form-${target}-date`);
  const timeInput = document.getElementById(`activity-form-${target}-time`);
  if (dateInput) {
    dateInput.value = '';
    dateInput.classList.remove('border-rose-500', 'bg-rose-50');
  }
  if (timeInput) {
    timeInput.value = '';
    timeInput.classList.remove('border-rose-500', 'bg-rose-50');
  }
};

// Rich Text Editor Helpers
window.richFormatHeading = function(tag) {
  if (!tag) return;
  document.execCommand('formatBlock', false, '<' + tag + '>');
  document.getElementById('activity-editor')?.focus();
};

window.setRichFontSize = function(size) {
  if (!size) return;
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  document.execCommand('fontSize', false, '1');
  const editor = document.getElementById('activity-editor');
  if (editor) {
    const elList = editor.querySelectorAll('font[size="1"], span[style*="font-size: x-small"]');
    elList.forEach(el => {
      el.removeAttribute('size');
      el.style.fontSize = size + 'px';
    });
  }
  document.getElementById('activity-editor')?.focus();
};

window.insertRichLink = function() {
  const url = prompt('Nhập địa chỉ liên kết (URL):', 'https://');
  if (!url || !url.trim()) return;
  const cleanUrl = url.trim();
  if (/^javascript:/i.test(cleanUrl)) {
    showToast('Liên kết không an toàn!', 'warning');
    return;
  }
  document.execCommand('createLink', false, cleanUrl);
  const editor = document.getElementById('activity-editor');
  if (editor) {
    editor.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }
  document.getElementById('activity-editor')?.focus();
};

// Safe HTML Sanitizer (Strict Whitelist)
export function sanitizeRichHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const allowedTags = new Set([
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'div', 'blockquote'
    ]);
    const allowedStyles = new Set([
      'text-align', 'color', 'background-color', 'font-size'
    ]);

    function cleanNode(node) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === 1) { // Element
          const tagName = child.tagName.toLowerCase();
          if (!allowedTags.has(tagName)) {
            if (['script', 'iframe', 'object', 'embed', 'style', 'link', 'svg'].includes(tagName)) {
              child.remove();
              continue;
            }
            const parent = child.parentNode;
            while (child.firstChild) parent.insertBefore(child.firstChild, child);
            parent.removeChild(child);
            continue;
          }

          // Clean attributes
          const attrs = Array.from(child.attributes);
          for (const attr of attrs) {
            const attrName = attr.name.toLowerCase();
            if (attrName.startsWith('on') || attrName === 'id' || attrName === 'class') {
              child.removeAttribute(attr.name);
            } else if (tagName === 'a' && attrName === 'href') {
              const href = attr.value.trim().toLowerCase();
              if (href.startsWith('javascript:') || href.startsWith('data:') || href.startsWith('vbscript:')) {
                child.removeAttribute(attr.name);
              }
            } else if (attrName === 'style') {
              const styleRules = child.style;
              const safeStyles = [];
              for (let i = 0; i < styleRules.length; i++) {
                const prop = styleRules[i].toLowerCase();
                if (allowedStyles.has(prop)) {
                  const val = styleRules.getPropertyValue(prop);
                  if (!/url\(|expression\(|javascript:/i.test(val)) {
                    safeStyles.push(`${prop}: ${val}`);
                  }
                }
              }
              if (safeStyles.length > 0) {
                child.setAttribute('style', safeStyles.join('; '));
              } else {
                child.removeAttribute('style');
              }
            } else if (tagName === 'a' && (attrName === 'target' || attrName === 'rel')) {
              // Allowed
            } else {
              child.removeAttribute(attr.name);
            }
          }

          if (tagName === 'a') {
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
          }

          cleanNode(child);
        }
      }
    }

    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  // Fallback for node test environment
  return rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
}

// Generate unique slug in round
export function generateUniqueSlug(title, existingActivities = []) {
  const baseSlug = (title ? slugify(title) : '') || ('act-' + Date.now());
  const existingSlugs = new Set((existingActivities || []).map(a => a.slug || a.id));
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }
  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
  }
  return `${baseSlug}-${counter}`;
}

export function normalizeActivity(a, roundId, idx = 0) {
  const title = String(a.title || '').trim();
  const slug = String(a.slug || (title ? slugify(title) : '') || ('act-' + (idx + 1))).trim();
  const id = String(a.id || slug).trim();
  
  // Default council structure if missing
  const defaultSlots = [
    { key: 'chair', label: 'Chủ tịch', name: 'Chủ tịch Hội đồng', type: 'mandatory' },
    { key: 'member', label: 'Ủy viên', name: 'Ủy viên Hội đồng', type: 'mandatory' },
    { key: 'secretary', label: 'Thư ký', name: 'Thư ký Hội đồng', type: 'mandatory' }
  ];

  // Default Defense Rubric (v2.0.0-beta.1)
  const defaultDefenseRubric = [
    { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1, description: 'Ý tưởng và tính sáng tạo' },
    { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2, description: 'Tính ứng dụng và khả thi' },
    { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3, description: 'Kỹ thuật thể hiện và hoàn thiện' },
    { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4, description: 'Báo cáo và trả lời câu hỏi' }
  ];

  // Default Letter Options & Scoring Config (v2.0.0-beta.1)
  const defaultLetterOptions = [
    { id: 'opt_a', key: 'A', label: 'A — Tốt', description: 'Tốt / Xuất sắc' },
    { id: 'opt_b', key: 'B', label: 'B — Khá', description: 'Khá' },
    { id: 'opt_c', key: 'C', label: 'C — Đạt', description: 'Đạt yêu cầu' },
    { id: 'opt_d', key: 'D', label: 'D — Chưa đạt', description: 'Chưa đạt / Cần hoàn thiện lại' }
  ];

  const scoringMode = (a.scoringConfig && ['numeric', 'letter', 'defense_rubric'].includes(a.scoringConfig.mode))
    ? a.scoringConfig.mode
    : 'numeric';

  const scoringConfig = a.scoringConfig ? {
    enabled: Boolean(a.scoringConfig.enabled),
    mode: scoringMode,
    rubric: (Array.isArray(a.scoringConfig.rubric) && a.scoringConfig.rubric.length > 0)
      ? a.scoringConfig.rubric
      : defaultDefenseRubric,
    letterOptions: (Array.isArray(a.scoringConfig.letterOptions) && a.scoringConfig.letterOptions.length > 0)
      ? a.scoringConfig.letterOptions
      : defaultLetterOptions,
    numericConfig: {
      min: typeof a.scoringConfig.numericConfig?.min === 'number' ? a.scoringConfig.numericConfig.min : 0,
      max: typeof a.scoringConfig.numericConfig?.max === 'number' ? a.scoringConfig.numericConfig.max : 10,
      step: typeof a.scoringConfig.numericConfig?.step === 'number' ? a.scoringConfig.numericConfig.step : 0.1
    }
  } : {
    enabled: false,
    mode: 'numeric',
    rubric: defaultDefenseRubric,
    letterOptions: defaultLetterOptions,
    numericConfig: { min: 0, max: 10, step: 0.1 }
  };

  return {
    id,
    roundId: String(a.roundId || roundId).trim(),
    title,
    activityType: a.activityType || 'other',
    description: a.description || '',
    descriptionHtml: a.descriptionHtml || a.description || '',
    startAt: a.startAt || '',
    endAt: a.endAt || '',
    location: a.location || '',
    order: typeof a.order === 'number' ? a.order : (idx + 1),
    visibility: a.visibility !== false,
    showAfterExpired: a.showAfterExpired !== false,
    submissionEnabled: Boolean(a.submissionEnabled),
    councilEnabled: Boolean(a.councilEnabled),
    showPresentationOrderToStudents: Boolean(a.showPresentationOrderToStudents),
    councilStructure: (a.councilStructure && Array.isArray(a.councilStructure.slots)) ? a.councilStructure : { slots: defaultSlots },
    councils: Array.isArray(a.councils) ? a.councils.map(c => ({
      ...c,
      status: c.status || 'preparing',
      auditLogs: Array.isArray(c.auditLogs) ? c.auditLogs : [],
      guestInclusion: c.guestInclusion || {},
      finalDefenseScores: c.finalDefenseScores || {}
    })) : [],
    councilStudentAssignments: Array.isArray(a.councilStudentAssignments) ? a.councilStudentAssignments : [],
    scoringConfig,
    slug,
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || new Date().toISOString()
  };
}

// 1. OPEN ADMIN TIMELINE FOR A ROUND
window.openRoundTimeline = function(roundId) {
  switchAdminTab('timeline');
  const sel = document.getElementById('admin-timeline-round-select');
  if (sel) {
    sel.value = roundId;
    loadAdminRoundActivities(roundId);
  }
};

// 2. LOAD & RENDER ADMIN TIMELINE ACTIVITIES TABLE
window.loadAdminRoundActivities = async function(roundId) {
  const tbody = document.getElementById('admin-timeline-activities-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Đang tải và kiểm tra lỗi...</td></tr>';
  try {
  const tbody = document.getElementById('admin-timeline-activities-tbody');
  const statsBadge = document.getElementById('admin-timeline-stats-badge');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không tìm thấy thông tin đợt tốt nghiệp.</td></tr>';
    if (statsBadge) statsBadge.textContent = '0 mốc';
    return;
  }

  // Load from targetRound.activities or subcollection
  let list = Array.isArray(targetRound.activities) ? targetRound.activities : [];
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'activities'));
    if (snap && !snap.empty) {
      list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (e) {
    // Fallback cleanly to round.activities
  }

  // Normalize and sort by order
  const normalized = list.map((a, idx) => normalizeActivity(a, roundId, idx)).sort((a, b) => (a.order || 0) - (b.order || 0));
  targetRound.activities = normalized;
  state.roundActivities = normalized;

  // Calculate stats
  let ongoingCount = 0, upcomingCount = 0, pastCount = 0;
  normalized.forEach(a => {
    const s = getActivityStatus(a);
    if (s === 'ongoing') ongoingCount++;
    else if (s === 'upcoming') upcomingCount++;
    else if (s === 'past') pastCount++;
  });

  const selAdminRoundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;

  if (statsBadge) {
    statsBadge.textContent = `${normalized.length} mốc (${ongoingCount} đang diễn ra, ${upcomingCount} sắp tới, ${pastCount} đã kết thúc)`;
  }

  if (normalized.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-10 text-center text-slate-400">
          <span class="text-2xl block mb-1">📅</span>
          Đợt "<strong>${targetRound.title}</strong>" chưa có mốc kế hoạch nào.<br>
          <div class="mt-3 flex items-center justify-center gap-2">
            <button type="button" onclick="openCopyFromRoundModal()" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-slate-300 transition-colors">
              📋 Sao chép từ Đợt khác
            </button>
            <button type="button" onclick="openCreateActivityModal()" class="px-4 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold text-xs border border-blue-200 transition-colors">
              + Thêm mốc đầu tiên
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  try {
    tbody.innerHTML = normalized.map((act, idx) => {
      const typeMeta = ACTIVITY_TYPES[act.activityType] || ACTIVITY_TYPES.other;
      const status = getActivityStatus(act);
      const timeStr = fmtActivityTime(act.startAt, act.endAt);

      let statusBadge = '';
      if (status === 'ongoing') {
        statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm whitespace-nowrap">● Đang diễn ra</span>';
      } else if (status === 'upcoming') {
        statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm whitespace-nowrap">○ Sắp tới</span>';
      } else if (status === 'past') {
        statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-slate-50 text-slate-600 border border-slate-200 shadow-sm whitespace-nowrap">✓ Đã kết thúc</span>';
      } else {
        statusBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm whitespace-nowrap">Kế hoạch</span>';
      }

      const visBadge = act.visibility !== false
        ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm whitespace-nowrap">👁️ Hiện</span>'
        : '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm whitespace-nowrap">🔒 Ẩn</span>';

      const subBadge = act.submissionEnabled
        ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm whitespace-nowrap" title="Chức năng nộp bài (Beta)">📥 Có</span>'
        : '<span class="text-slate-300 font-bold px-2 py-1">--</span>';

      return `
        <tr class="hover:bg-slate-50/80 transition-colors group border-b border-slate-100 last:border-b-0">
          <td class="p-2 text-center align-middle w-10">
            <div class="flex flex-col items-center justify-center gap-1.5">
              <span class="font-bold text-slate-500 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">#${idx + 1}</span>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onclick="moveActivity('${act.id}', 'up')" ${idx === 0 ? 'disabled' : ''} class="w-4 h-4 text-[9px] flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent shadow-sm" title="Lên">▲</button>
                <button type="button" onclick="moveActivity('${act.id}', 'down')" ${idx === normalized.length - 1 ? 'disabled' : ''} class="w-4 h-4 text-[9px] flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent shadow-sm" title="Xuống">▼</button>
              </div>
            </div>
          </td>
          
          <td class="p-2 align-top">
            <div class="flex flex-col items-start gap-1">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded whitespace-nowrap text-[9px] font-extrabold border shadow-sm ${typeMeta.color}">
                <span>${typeMeta.icon}</span> ${typeMeta.label}
              </span>
              <div>
                <span class="font-bold text-slate-800 text-xs leading-tight block">${act.title}</span>
                ${act.description ? `<p class="text-[10px] text-slate-500 mt-0.5 line-clamp-1 leading-snug" title="${escapeHtml(act.description)}">${escapeHtml(act.description)}</p>` : ''}
              </div>
            </div>
          </td>
          
          <td class="p-2 align-top text-xs text-slate-700 whitespace-nowrap">
            <div class="text-[11px] leading-snug">
              ${timeStr.replace('Hạn cuối:', '<span class="text-rose-600 font-bold">Hạn cuối:</span>')}
            </div>
          </td>
          
          <td class="p-2 align-top text-slate-600 text-[11px]">
            ${act.location ? `
              <div class="flex items-start gap-1 text-[11px]">
                <span class="text-slate-400">📍</span>
                <span class="line-clamp-2 leading-tight" title="${act.location}">${act.location}</span>
              </div>
            ` : '<span class="text-slate-300 font-bold text-[10px]">--</span>'}
          </td>
          
          <td class="p-2 align-top text-center whitespace-nowrap">
            ${statusBadge}
          </td>
          
          <td class="p-2 align-top text-center whitespace-nowrap">
            ${visBadge}
          </td>
          
          <td class="p-2 align-top text-center whitespace-nowrap">
            ${subBadge}
          </td>
          
          <td class="p-2 align-top pr-3">
            <div class="flex flex-col gap-1 items-end whitespace-nowrap">
              <div class="flex items-center gap-1">
                ${act.submissionEnabled ? `<button type="button" onclick="openActivitySubmissionDashboard('${targetRound.id}', '${act.id}')" class="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold border border-indigo-200 shadow-sm transition-all flex items-center gap-1" title="Quản lý Sinh viên Nộp bài"><span>📥</span><span>Nộp bài</span></button>` : ''}
                ${act.councilEnabled ? `<button type="button" onclick="openActivityCouncilManagement('${targetRound.id}', '${act.id}')" class="px-2 py-0.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded text-[10px] font-bold border border-violet-200 shadow-sm transition-all flex items-center gap-1" title="Quản lý Hội đồng Mốc này"><span>⚖️</span><span>Hội đồng</span><span class="bg-violet-200 text-violet-900 px-1 py-0.2 rounded-full text-[8px] leading-none">${(act.councils || []).length}</span></button>` : ''}
              </div>
              
              <div class="flex items-center gap-0.5 mt-0.5">
                <button type="button" onclick="copyActivityLink('${targetRound.id}', '${act.slug}')" class="p-1 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded border border-slate-200 shadow-sm transition-colors text-[10px]" title="Sao chép link mốc">🔗</button>
                <button type="button" onclick="copyActivityModal('${act.id}')" class="p-1 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded border border-slate-200 shadow-sm transition-colors text-[10px]" title="Nhân bản mốc">📋</button>
                <button type="button" onclick="toggleActivityVisibility('${act.id}')" class="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-600 rounded text-[9px] font-bold border border-slate-200 shadow-sm transition-colors">${act.visibility !== false ? '👁️ Ẩn' : '🔒 Hiện'}</button>
                <div class="w-px h-3 bg-slate-200 mx-0.5"></div>
                <button type="button" onclick="editActivityModal('${act.id}')" class="px-1.5 py-0.5 text-blue-600 hover:bg-blue-50 rounded font-bold text-[9px] transition-colors">Sửa</button>
                <button type="button" onclick="deleteActivity('${act.id}')" class="px-1.5 py-0.5 text-rose-600 hover:bg-rose-50 rounded font-bold text-[9px] transition-colors">Xóa</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Lỗi khi render danh sách mốc kế hoạch:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-rose-600 bg-rose-50 font-bold border border-rose-200 rounded-lg">⚠️ Đã xảy ra lỗi hiển thị danh sách mốc kế hoạch: ${err.message}. Vui lòng thử lại hoặc báo cáo kỹ thuật.</td></tr>`;
  }

  } catch (globalErr) {
    console.error('Lỗi loadAdminRoundActivities:', globalErr);
    const tbodyFallback = document.getElementById('admin-timeline-activities-tbody');
    if (tbodyFallback) {
      tbodyFallback.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-rose-600 bg-rose-50 font-bold border border-rose-200 rounded-lg">
        <h3 class="text-lg mb-2 text-rose-700">🔥 Lỗi nghiêm trọng (Global Catch)</h3>
        <p class="font-mono text-left whitespace-pre-wrap text-[10px] text-rose-800">${globalErr?.stack || globalErr?.message || String(globalErr)}</p>
      </td></tr>`;
    }
  }
};


// 3. CREATE, EDIT & COPY ACTIVITY MODAL HANDLERS
window.openCreateActivityModal = function() {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  if (!roundId) {
    showToast('Vui lòng chọn đợt tốt nghiệp trước khi thêm mốc kế hoạch!', 'warning');
    return;
  }

  document.getElementById('form-activity').reset();
  document.getElementById('activity-form-id').value = '';
  document.getElementById('activity-form-round-id').value = roundId;
  document.getElementById('activity-form-visibility').checked = true;
  document.getElementById('activity-form-show-expired').checked = true;
  document.getElementById('activity-form-submission').checked = false;
  if (typeof toggleActivitySubmissionConfig === 'function') toggleActivitySubmissionConfig(false);
  if (typeof resetActivitySubmissionForm === 'function') resetActivitySubmissionForm();
  document.getElementById('activity-form-type').value = 'review';

  // Clear date/time
  clearActivityDateTime('start');
  clearActivityDateTime('end');

  // Clear rich editor
  const editor = document.getElementById('activity-editor');
  if (editor) editor.innerHTML = '';

  if (document.getElementById('activity-form-council-enabled')) {
    document.getElementById('activity-form-council-enabled').checked = false;
    toggleActivityCouncilFields(false);
  }
  if (document.getElementById('activity-form-show-order')) {
    document.getElementById('activity-form-show-order').checked = false;
  }
  if (document.getElementById('activity-form-scoring-enabled')) {
    document.getElementById('activity-form-scoring-enabled').checked = false;
    toggleActivityScoringConfig(false);
  }
  state._currentActivityLetterOptions = [
    { id: 'opt_a', key: 'A', label: 'A — Tốt', description: 'Tốt / Xuất sắc' },
    { id: 'opt_b', key: 'B', label: 'B — Khá', description: 'Khá' },
    { id: 'opt_c', key: 'C', label: 'C — Đạt', description: 'Đạt yêu cầu' },
    { id: 'opt_d', key: 'D', label: 'D — Chưa đạt', description: 'Chưa đạt / Cần hoàn thiện lại' }
  ];
  state._currentActivityRubric = [
    { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1, description: 'Ý tưởng và tính sáng tạo' },
    { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2, description: 'Tính ứng dụng và khả thi' },
    { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3, description: 'Kỹ thuật thể hiện và hoàn thiện' },
    { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4, description: 'Báo cáo và trả lời câu hỏi' }
  ];
  switchActivityScoringMode('numeric');
  renderActivityLetterOptions();
  renderActivityRubricList();

  document.getElementById('modal-activity-title').textContent = 'Thêm Mốc Kế hoạch Đợt TN';
  document.getElementById('modal-activity').classList.remove('hidden');
};

window.editActivityModal = function(actId) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const list = targetRound?.activities || state.roundActivities || [];
  const act = list.find(a => a.id === actId);
  if (!act) {
    showToast('Không tìm thấy thông tin mốc kế hoạch!', 'error');
    return;
  }

  document.getElementById('activity-form-id').value = act.id;
  document.getElementById('activity-form-round-id').value = roundId;
  document.getElementById('activity-form-title').value = act.title || '';
  document.getElementById('activity-form-type').value = act.activityType || 'other';
  document.getElementById('activity-form-location').value = act.location || '';

  // Dates
  const startParts = isoToVietnameseDateTime(act.startAt);
  const startDateInput = document.getElementById('activity-form-start-date');
  const startTimeInput = document.getElementById('activity-form-start-time');
  if (startDateInput) startDateInput.value = startParts.date;
  if (startTimeInput) startTimeInput.value = startParts.time;

  const endParts = isoToVietnameseDateTime(act.endAt);
  const endDateInput = document.getElementById('activity-form-end-date');
  const endTimeInput = document.getElementById('activity-form-end-time');
  if (endDateInput) endDateInput.value = endParts.date;
  if (endTimeInput) endTimeInput.value = endParts.time;

  // Rich Text Editor
  const editor = document.getElementById('activity-editor');
  if (editor) {
    editor.innerHTML = act.descriptionHtml || escapeHtml(act.description || '');
  }

  document.getElementById('activity-form-visibility').checked = act.visibility !== false;
  document.getElementById('activity-form-show-expired').checked = act.showAfterExpired !== false;
  const subEnabled = Boolean(act.submissionEnabled);
  document.getElementById('activity-form-submission').checked = subEnabled;
  if (typeof toggleActivitySubmissionConfig === 'function') toggleActivitySubmissionConfig(subEnabled);
  if (typeof populateActivitySubmissionForm === 'function') populateActivitySubmissionForm(act.submissionConfig);

  const councilEnabled = Boolean(act.councilEnabled);
  if (document.getElementById('activity-form-council-enabled')) {
    document.getElementById('activity-form-council-enabled').checked = councilEnabled;
    toggleActivityCouncilFields(councilEnabled);
  }
  if (document.getElementById('activity-form-show-order')) {
    document.getElementById('activity-form-show-order').checked = Boolean(act.showPresentationOrderToStudents);
  }
  const scoringEnabled = Boolean(act.scoringConfig?.enabled);
  if (document.getElementById('activity-form-scoring-enabled')) {
    document.getElementById('activity-form-scoring-enabled').checked = scoringEnabled;
    toggleActivityScoringConfig(scoringEnabled);
  }
  const sMode = act.scoringConfig?.mode || 'numeric';
  switchActivityScoringMode(sMode);
  if (act.scoringConfig?.numericConfig) {
    if (document.getElementById('activity-scoring-min')) document.getElementById('activity-scoring-min').value = act.scoringConfig.numericConfig.min ?? 0;
    if (document.getElementById('activity-scoring-max')) document.getElementById('activity-scoring-max').value = act.scoringConfig.numericConfig.max ?? 10;
    if (document.getElementById('activity-scoring-step')) document.getElementById('activity-scoring-step').value = act.scoringConfig.numericConfig.step ?? 0.1;
  }
  state._currentActivityLetterOptions = Array.isArray(act.scoringConfig?.letterOptions) && act.scoringConfig.letterOptions.length > 0
    ? JSON.parse(JSON.stringify(act.scoringConfig.letterOptions))
    : [
        { id: 'opt_a', key: 'A', label: 'A — Tốt', description: 'Tốt / Xuất sắc' },
        { id: 'opt_b', key: 'B', label: 'B — Khá', description: 'Khá' },
        { id: 'opt_c', key: 'C', label: 'C — Đạt', description: 'Đạt yêu cầu' },
        { id: 'opt_d', key: 'D', label: 'D — Chưa đạt', description: 'Chưa đạt / Cần hoàn thiện lại' }
      ];
  state._currentActivityRubric = Array.isArray(act.scoringConfig?.rubric) && act.scoringConfig.rubric.length > 0
    ? JSON.parse(JSON.stringify(act.scoringConfig.rubric))
    : [
        { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1, description: 'Ý tưởng và tính sáng tạo' },
        { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2, description: 'Tính ứng dụng và khả thi' },
        { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3, description: 'Kỹ thuật thể hiện và hoàn thiện' },
        { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4, description: 'Báo cáo và trả lời câu hỏi' }
      ];
  renderActivityLetterOptions();
  renderActivityRubricList();

  document.getElementById('modal-activity-title').textContent = 'Chỉnh sửa Mốc Kế hoạch';
  document.getElementById('modal-activity').classList.remove('hidden');
};

window.copyActivityModal = function(actId) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const list = targetRound?.activities || state.roundActivities || [];
  const act = list.find(a => a.id === actId);
  if (!act) {
    showToast('Không tìm thấy thông tin mốc kế hoạch!', 'error');
    return;
  }

  // Clear ID so it will create a new activity on save
  document.getElementById('form-activity').reset();
  document.getElementById('activity-form-id').value = '';
  document.getElementById('activity-form-round-id').value = roundId;
  document.getElementById('activity-form-title').value = act.title ? `${act.title} (Bản sao)` : '';
  document.getElementById('activity-form-type').value = act.activityType || 'other';
  document.getElementById('activity-form-location').value = act.location || '';

  // Dates
  const startParts = isoToVietnameseDateTime(act.startAt);
  const startDateInput = document.getElementById('activity-form-start-date');
  const startTimeInput = document.getElementById('activity-form-start-time');
  if (startDateInput) startDateInput.value = startParts.date;
  if (startTimeInput) startTimeInput.value = startParts.time;

  const endParts = isoToVietnameseDateTime(act.endAt);
  const endDateInput = document.getElementById('activity-form-end-date');
  const endTimeInput = document.getElementById('activity-form-end-time');
  if (endDateInput) endDateInput.value = endParts.date;
  if (endTimeInput) endTimeInput.value = endParts.time;

  // Rich Text Editor
  const editor = document.getElementById('activity-editor');
  if (editor) {
    editor.innerHTML = act.descriptionHtml || escapeHtml(act.description || '');
  }

  document.getElementById('activity-form-visibility').checked = act.visibility !== false;
  document.getElementById('activity-form-show-expired').checked = act.showAfterExpired !== false;
  document.getElementById('activity-form-submission').checked = Boolean(act.submissionEnabled);

  document.getElementById('modal-activity-title').textContent = 'Sao chép Mốc Kế hoạch (Bản mới)';
  document.getElementById('modal-activity').classList.remove('hidden');
  showToast('Đã sao chép nội dung sang form mới. Bạn có thể chỉnh sửa trước khi lưu.', 'info');
};

window.closeActivityModal = function() {
  document.getElementById('modal-activity').classList.add('hidden');
};

// 4. COPY ACTIVITIES FROM ANOTHER ROUND
window.openCopyFromRoundModal = function() {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    showToast('Vui lòng chọn đợt tốt nghiệp tiếp nhận kế hoạch!', 'warning');
    return;
  }

  const desc = document.getElementById('copy-round-target-desc');
  if (desc) desc.textContent = `Đợt tiếp nhận: ${targetRound.title}`;

  const sel = document.getElementById('copy-round-source-select');
  if (sel) {
    const otherRounds = (state.rounds || []).filter(r => r.id !== roundId && !r.isDeleted);
    sel.innerHTML = '<option value="">-- Chọn đợt nguồn --</option>' + otherRounds.map(r => {
      const actCount = (r.activities || []).length;
      return `<option value="${r.id}">${r.title} (${actCount} mốc)</option>`;
    }).join('');
  }

  const container = document.getElementById('copy-round-milestones-container');
  if (container) container.classList.add('hidden');
  const submitBtn = document.getElementById('btn-submit-copy-from-round');
  if (submitBtn) submitBtn.disabled = true;

  document.getElementById('modal-copy-round')?.classList.remove('hidden');
};

window.closeCopyFromRoundModal = function() {
  document.getElementById('modal-copy-round')?.classList.add('hidden');
};

window.onSelectSourceRoundForCopy = async function(sourceRoundId) {
  const container = document.getElementById('copy-round-milestones-container');
  const listEl = document.getElementById('copy-round-milestones-list');
  const submitBtn = document.getElementById('btn-submit-copy-from-round');
  if (!container || !listEl) return;

  if (!sourceRoundId) {
    container.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const sourceRound = (state.rounds || []).find(r => r.id === sourceRoundId);
  let acts = sourceRound?.activities || [];
  if (acts.length === 0) {
    try {
      const snap = await getDocs(collection(db, 'graduationRounds', sourceRoundId, 'activities'));
      if (snap && !snap.empty) {
        acts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (sourceRound) sourceRound.activities = acts;
      }
    } catch (e) {}
  }

  if (acts.length === 0) {
    listEl.innerHTML = '<div class="p-6 text-center text-slate-400">Đợt được chọn chưa có mốc kế hoạch nào để sao chép.</div>';
    container.classList.remove('hidden');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const sorted = acts.map((a, i) => normalizeActivity(a, sourceRoundId, i)).sort((a, b) => (a.order || 0) - (b.order || 0));

  listEl.innerHTML = sorted.map(a => {
    const typeMeta = ACTIVITY_TYPES[a.activityType] || ACTIVITY_TYPES.other;
    const timeStr = fmtActivityTime(a.startAt, a.endAt);
    return `
      <label class="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200">
        <input type="checkbox" value="${a.id}" data-act-id="${a.id}" checked onchange="updateCopyRoundSubmitState()" class="copy-milestone-checkbox rounded text-tdtu-blue mt-0.5">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-bold border ${typeMeta.color}">
              ${typeMeta.icon} ${typeMeta.label}
            </span>
            <span class="font-bold text-slate-900 text-xs truncate">${a.title}</span>
          </div>
          <p class="text-[11px] text-slate-500 font-mono">${timeStr}</p>
        </div>
      </label>
    `;
  }).join('');

  container.classList.remove('hidden');
  updateCopyRoundSubmitState();
};

window.toggleSelectAllCopyMilestones = function(select) {
  const checkboxes = document.querySelectorAll('.copy-milestone-checkbox');
  checkboxes.forEach(cb => cb.checked = select);
  updateCopyRoundSubmitState();
};

window.updateCopyRoundSubmitState = function() {
  const submitBtn = document.getElementById('btn-submit-copy-from-round');
  if (!submitBtn) return;
  const checked = document.querySelectorAll('.copy-milestone-checkbox:checked');
  if (checked.length > 0) {
    submitBtn.disabled = false;
    submitBtn.textContent = `Sao chép các mốc đã chọn (${checked.length})`;
  } else {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sao chép các mốc đã chọn';
  }
};

window.executeCopyFromRound = async function() {
  const targetRoundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const sourceRoundId = document.getElementById('copy-round-source-select')?.value;
  const targetRound = (state.rounds || []).find(r => r.id === targetRoundId);
  const sourceRound = (state.rounds || []).find(r => r.id === sourceRoundId);

  if (!targetRound || !sourceRound) {
    showToast('Lỗi xác định đợt nguồn hoặc đợt tiếp nhận!', 'error');
    return;
  }

  const checkedBoxes = Array.from(document.querySelectorAll('.copy-milestone-checkbox:checked'));
  if (checkedBoxes.length === 0) {
    showToast('Vui lòng chọn ít nhất 1 mốc để sao chép!', 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-copy-from-round');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Đang sao chép...';
  }

  try {
    const sourceActs = sourceRound.activities || [];
    const targetActs = Array.isArray(targetRound.activities) ? [...targetRound.activities] : [];

    let copyCount = 0;
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);
    
    // 1. Prepare Target Activities
    for (const cb of checkedBoxes) {
      const actId = cb.value;
      const src = sourceActs.find(a => a.id === actId);
      if (!src) continue;

      // Unique new ID and Slug
      const newSlug = generateUniqueSlug(src.title, targetActs);
      const newId = 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      // Deep clone to keep config but avoid reference sharing
      const newAct = JSON.parse(JSON.stringify(src));

      // Overwrite identifiers and metadata
      newAct.id = newId;
      newAct.roundId = targetRoundId;
      newAct.slug = newSlug;
      newAct.order = targetActs.length + 1;
      newAct.createdAt = nowIso;
      newAct.updatedAt = nowIso;

      // EXCLUDE runtime state and avoid cross-round data pollution
      delete newAct.submissions;
      delete newAct.scores;
      delete newAct.attendance;
      delete newAct.auditLogs;
      newAct.councils = [];
      newAct.councilStudentAssignments = [];

      // SAFETY: Explicitly clear driveFolderId so the new round doesn't upload to the old round's folder
      newAct.driveFolderId = null;
      if (newAct.submissionConfig) {
        newAct.submissionConfig.driveFolderId = null;
      }

      targetActs.push(newAct);
      
      copyCount++;
    }

    // 2. Batch write to the target round document
    const roundRef = doc(db, 'graduationRounds', targetRoundId);
    batch.update(roundRef, {
      activities: targetActs,
      updatedAt: serverTimestamp()
    });

    // 3. Commit Firestore Transaction
    await batch.commit();

    // 4. Update Local State & UI
    targetRound.activities = targetActs;
    state.roundActivities = targetActs;

    closeCopyFromRoundModal();
    await loadAdminRoundActivities(targetRoundId);
    if (state.selectedRoundId === targetRoundId) {
      loadStudentRoundActivities(targetRoundId);
    }

    showToast(`✓ Đã sao chép thành công ${copyCount} mốc kế hoạch vào đợt "${targetRound.title}"!`, 'success');
  } catch (err) {
    console.error('Lỗi sao chép mốc từ đợt khác:', err);
    showToast('Lỗi sao chép: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sao chép các mốc đã chọn';
    }
  }
};

// 5. SAVE ACTIVITY (PERSISTENCE WITH VIETNAMESE DATES & RICH TEXT)
window.saveActivity = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const roundId = document.getElementById('activity-form-round-id')?.value || state.selectedRoundId;
  const id = document.getElementById('activity-form-id')?.value?.trim();
  const title = document.getElementById('activity-form-title')?.value?.trim();
  const activityType = document.getElementById('activity-form-type')?.value || 'other';
  const location = document.getElementById('activity-form-location')?.value?.trim() || '';

  // Parse start date & time (Vietnamese format DD/MM/YYYY + HH:mm)
  const startDateStr = document.getElementById('activity-form-start-date')?.value?.trim();
  const startTimeStr = document.getElementById('activity-form-start-time')?.value?.trim();
  let startAt = '';
  if (startDateStr) {
    const parsedStart = parseVietnameseDateTime(startDateStr, startTimeStr, '00:00');
    if (parsedStart === null) {
      showToast('Thời gian bắt đầu không hợp lệ! Vui lòng kiểm tra ngày DD/MM/YYYY và giờ HH:mm', 'warning');
      return;
    }
    startAt = parsedStart;
  }

  // Parse end date & time
  const endDateStr = document.getElementById('activity-form-end-date')?.value?.trim();
  const endTimeStr = document.getElementById('activity-form-end-time')?.value?.trim();
  let endAt = '';
  if (endDateStr) {
    const parsedEnd = parseVietnameseDateTime(endDateStr, endTimeStr, '23:59');
    if (parsedEnd === null) {
      showToast('Thời gian kết thúc không hợp lệ! Vui lòng kiểm tra ngày DD/MM/YYYY và giờ HH:mm', 'warning');
      return;
    }
    endAt = parsedEnd;
  }

  // Validation: endAt >= startAt if both provided
  if (startAt && endAt) {
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    if (endDate < startDate) {
      showToast('Thời gian kết thúc phải lớn hơn hoặc bằng thời gian bắt đầu!', 'warning');
      return;
    }
  }

  // Rich Text Description
  const editor = document.getElementById('activity-editor');
  const rawHtml = editor ? editor.innerHTML.trim() : '';
  const descriptionHtml = sanitizeRichHtml(rawHtml);
  const descriptionText = editor ? (editor.innerText || editor.textContent || '').trim() : '';

  const visibility = document.getElementById('activity-form-visibility')?.checked !== false;
  const showAfterExpired = document.getElementById('activity-form-show-expired')?.checked !== false;
  const submissionEnabled = document.getElementById('activity-form-submission')?.checked === true;

  if (!title) {
    showToast('Vui lòng nhập tên mốc kế hoạch (*)', 'warning');
    return;
  }

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    showToast('Không tìm thấy đợt tốt nghiệp tương ứng!', 'error');
    return;
  }

  const submitBtn = document.querySelector('#form-activity button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Đang lưu...</span>';
  }

  try {
    let activities = Array.isArray(targetRound.activities) ? [...targetRound.activities] : [];
    const slug = id ? (activities.find(a => a.id === id)?.slug || slugify(title)) : generateUniqueSlug(title, activities);
    const actId = id || ('act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

    const councilEnabled = document.getElementById('activity-form-council-enabled')?.checked === true;
    const showPresentationOrderToStudents = document.getElementById('activity-form-show-order')?.checked === true;
    const scoringEnabled = document.getElementById('activity-form-scoring-enabled')?.checked === true;
    const scoringMode = document.querySelector('input[name="activity_scoring_mode"]:checked')?.value || 'numeric';
    const sMin = parseFloat(document.getElementById('activity-scoring-min')?.value) || 0;
    const sMax = parseFloat(document.getElementById('activity-scoring-max')?.value) || 10;
    const sStep = parseFloat(document.getElementById('activity-scoring-step')?.value) || 0.1;

    if (scoringEnabled && scoringMode === 'defense_rubric') {
      const rList = state._currentActivityRubric || [];
      if (rList.length === 0) {
        showToast('Chế độ Rubric bảo vệ yêu cầu ít nhất 1 tiêu chí chấm!', 'warning');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Lưu Mốc'; }
        return;
      }
      const keys = new Set();
      for (const crit of rList) {
        if (!crit.key || !crit.label || typeof crit.maxScore !== 'number' || crit.maxScore <= 0) {
          showToast('Tiêu chí rubric không hợp lệ: vui lòng nhập mã, tên và điểm tối đa > 0!', 'warning');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Lưu Mốc'; }
          return;
        }
        if (keys.has(crit.key)) {
          showToast(`Mã tiêu chí "${crit.key}" bị trùng lặp trong Rubric!`, 'warning');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Lưu Mốc'; }
          return;
        }
        keys.add(crit.key);
      }
    }

    const scoringConfig = {
      enabled: scoringEnabled,
      mode: scoringMode,
      rubric: state._currentActivityRubric || [],
      letterOptions: state._currentActivityLetterOptions || [],
      numericConfig: { min: sMin, max: sMax, step: sStep }
    };

    // Preserve existing council data if editing
    const existingAct = activities.find(a => a.id === actId);

    const submissionConfig = submissionEnabled && typeof readActivitySubmissionForm === 'function'
      ? readActivitySubmissionForm()
      : (existingAct?.submissionConfig || null);

    const activityData = {
      id: actId,
      roundId,
      title,
      activityType,
      location,
      startAt,
      endAt,
      description: descriptionText,
      descriptionHtml,
      visibility,
      showAfterExpired,
      submissionEnabled,
      submissionConfig,
      driveFolderId: submissionConfig?.driveFolderId || existingAct?.driveFolderId || null,
      councilEnabled,
      showPresentationOrderToStudents,
      scoringConfig,
      councilStructure: existingAct?.councilStructure || {
        slots: [
          { key: 'chair', label: 'Chủ tịch', name: 'Chủ tịch Hội đồng', type: 'mandatory' },
          { key: 'member', label: 'Ủy viên', name: 'Ủy viên Hội đồng', type: 'mandatory' },
          { key: 'secretary', label: 'Thư ký', name: 'Thư ký Hội đồng', type: 'mandatory' }
        ]
      },
      councils: existingAct?.councils || [],
      councilStudentAssignments: existingAct?.councilStudentAssignments || [],
      slug,
      updatedAt: new Date().toISOString()
    };

    const existingIdx = activities.findIndex(a => a.id === actId);
    if (existingIdx >= 0) {
      activityData.order = activities[existingIdx].order || (existingIdx + 1);
      activityData.createdAt = activities[existingIdx].createdAt || activityData.updatedAt;
      activities[existingIdx] = activityData;
    } else {
      activityData.order = activities.length + 1;
      activityData.createdAt = activityData.updatedAt;
      activities.push(activityData);
    }

    // Save to Firestore round document
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities,
      updatedAt: serverTimestamp()
    });

    // Best-effort sync to subcollection has been removed as parent array is the strict source of truth.

    targetRound.activities = activities;
    state.roundActivities = activities;

    closeActivityModal();
    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }

    showToast(`✓ Đã lưu mốc "${title}" thành công!`, 'success');
  } catch (err) {
    console.error('Lỗi lưu mốc kế hoạch:', err);
    showToast('Lỗi lưu mốc: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Lưu Mốc';
    }
  }
};

// 6. DELETE ACTIVITY
window.deleteActivity = async function(actId) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const activities = targetRound.activities || [];
  const act = activities.find(a => a.id === actId);
  if (!act) return;

  const confirmed = await showConfirm(
    'Xóa mốc kế hoạch',
    `Bạn có chắc chắn muốn xóa mốc "${act.title}" khỏi kế hoạch đợt này không?`,
    { confirmText: 'Xóa vĩnh viễn', danger: true }
  );
  if (!confirmed) return;

  try {
    const updated = activities.filter(a => a.id !== actId).map((a, idx) => ({ ...a, order: idx + 1 }));
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities: updated,
      updatedAt: serverTimestamp()
    });

    // Subcollection sync removed

    targetRound.activities = updated;
    state.roundActivities = updated;

    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }
    showToast(`Đã xóa mốc "${act.title}".`, 'info');
  } catch (err) {
    console.error('Lỗi xóa mốc:', err);
    showToast('Lỗi xóa mốc: ' + err.message, 'error');
  }
};

// 7. TOGGLE VISIBILITY
window.toggleActivityVisibility = async function(actId) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const activities = targetRound.activities || [];
  const act = activities.find(a => a.id === actId);
  if (!act) return;

  act.visibility = (act.visibility === false) ? true : false;

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities,
      updatedAt: serverTimestamp()
    });

    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }
    showToast(act.visibility ? `Đã hiển thị mốc "${act.title}" cho sinh viên.` : `Đã ẩn mốc "${act.title}" đối với sinh viên.`, 'info');
  } catch (err) {
    showToast('Lỗi cập nhật: ' + err.message, 'error');
  }
};

// 8. MOVE ACTIVITY (REORDER UP/DOWN)
window.moveActivity = async function(actId, direction) {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const activities = targetRound.activities || [];
  const idx = activities.findIndex(a => a.id === actId);
  if (idx < 0) return;

  if (direction === 'up' && idx > 0) {
    const temp = activities[idx];
    activities[idx] = activities[idx - 1];
    activities[idx - 1] = temp;
  } else if (direction === 'down' && idx < activities.length - 1) {
    const temp = activities[idx];
    activities[idx] = activities[idx + 1];
    activities[idx + 1] = temp;
  } else {
    return;
  }

  activities.forEach((a, i) => a.order = i + 1);

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities,
      updatedAt: serverTimestamp()
    });

    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }
  } catch (err) {
    showToast('Lỗi đổi thứ tự: ' + err.message, 'error');
  }
};

// 9. COPY ACTIVITY LINK
window.copyActivityLink = function(roundId, activitySlug) {
  const r = (state.rounds || []).find(x => x.id === roundId);
  const rCode = r?.slug || r?.shortCode || roundId;
  const link = `${window.location.origin}${window.location.pathname}?x=${encodeURIComponent(rCode)}&a=${encodeURIComponent(activitySlug)}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      showToast('✓ Đã sao chép liên kết mốc: ' + link, 'success');
    }).catch(() => {
      prompt('Link mốc kế hoạch:', link);
    });
  } else {
    prompt('Link mốc kế hoạch:', link);
  }
};

// 10. STUDENT TIMELINE RENDERING
state.showAllActivities = false;

window.toggleStudentTimelineViewAll = function() {
  state.showAllActivities = !state.showAllActivities;
  if (state.selectedRoundId) {
    loadStudentRoundActivities(state.selectedRoundId);
  }
};

window.loadStudentRoundActivities = async function(roundId) {
  const container = document.getElementById('student-timeline-list');
  const actionWrap = document.getElementById('student-timeline-header-actions');
  if (!container) return;

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    container.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Chưa có thông tin đợt tốt nghiệp.</div>';
    if (actionWrap) actionWrap.innerHTML = '';
    return;
  }

  let list = Array.isArray(targetRound.activities) ? targetRound.activities : [];
  if (list.length === 0) {
    try {
      const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'activities'));
      if (snap && !snap.empty) {
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {}
  }

  const visible = list
    .map((a, idx) => normalizeActivity(a, roundId, idx))
    .filter(a => state.isAdmin || a.visibility !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (visible.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <span class="text-2xl block mb-1">📅</span>
        <span class="font-bold text-slate-700 text-xs block">Kế hoạch đợt tốt nghiệp đang được cập nhật</span>
        <p class="text-[11px] text-slate-400 mt-0.5">Khoa sẽ sớm công bố lộ trình và các mốc kiểm tra cho đợt này.</p>
      </div>
    `;
    if (actionWrap) actionWrap.innerHTML = '';
    return;
  }

  const mainItems = [];
  const collapsedPastItems = [];

  visible.forEach(act => {
    const status = getActivityStatus(act);
    const isExpiredAndHidden = (status === 'past' && act.showAfterExpired === false && !state.showAllActivities);
    if (isExpiredAndHidden) {
      collapsedPastItems.push(act);
    } else {
      mainItems.push(act);
    }
  });

  if (actionWrap) {
    if (collapsedPastItems.length > 0) {
      actionWrap.innerHTML = `
        <button type="button" onclick="toggleStudentTimelineViewAll()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5">
          <span>👁️ Xem toàn bộ (${visible.length})</span>
        </button>
      `;
    } else if (state.showAllActivities && visible.length > mainItems.length) {
      actionWrap.innerHTML = `
        <button type="button" onclick="toggleStudentTimelineViewAll()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5">
          <span>▲ Thu gọn mốc đã qua</span>
        </button>
      `;
    } else {
      actionWrap.innerHTML = '';
    }
  }

  function renderActivityCard(act) {
    const typeMeta = ACTIVITY_TYPES[act.activityType] || ACTIVITY_TYPES.other;
    const status = getActivityStatus(act);
    const timeStr = fmtActivityTime(act.startAt, act.endAt);

    let markerHtml = '';
    let cardBorder = 'border-slate-200';
    let statusPill = '';

    if (status === 'ongoing') {
      markerHtml = '<div class="w-7 h-7 rounded-full bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center text-xs font-black shadow-sm shrink-0 pulse-timer">●</div>';
      cardBorder = 'border-emerald-300 bg-emerald-50/20';
      statusPill = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-sm">● Đang diễn ra</span>';
    } else if (status === 'upcoming') {
      markerHtml = '<div class="w-7 h-7 rounded-full bg-amber-50 border-2 border-amber-400 text-amber-600 flex items-center justify-center text-xs font-black shadow-sm shrink-0">○</div>';
      cardBorder = 'border-amber-200/80 bg-white';
      statusPill = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">○ Sắp tới</span>';
    } else if (status === 'past') {
      markerHtml = '<div class="w-7 h-7 rounded-full bg-slate-200 border-2 border-slate-300 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">✓</div>';
      cardBorder = 'border-slate-200/70 bg-slate-50/50 opacity-90';
      statusPill = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">✓ Đã kết thúc</span>';
    } else {
      markerHtml = '<div class="w-7 h-7 rounded-full bg-blue-50 border-2 border-blue-300 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">📌</div>';
      cardBorder = 'border-slate-200 bg-white';
      statusPill = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Kế hoạch</span>';
    }

    // Rich description rendering
    let descriptionRender = '';
    if (act.descriptionHtml && act.descriptionHtml.trim()) {
      descriptionRender = `
        <div class="mt-2 text-xs text-slate-700 leading-relaxed bg-white/90 p-3 rounded-xl border border-slate-100 rich-rendered-content shadow-xs">
          ${sanitizeRichHtml(act.descriptionHtml)}
        </div>
      `;
    } else if (act.description && act.description.trim()) {
      descriptionRender = `
        <div class="mt-2 text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-white/80 p-3 rounded-xl border border-slate-100">
          ${escapeHtml(act.description)}
        </div>
      `;
    }

    return `
      <div id="activity-card-${act.slug}" data-activity-id="${act.id}" class="flex items-start gap-3.5 p-4 rounded-2xl border ${cardBorder} transition-all duration-300 relative">
        ${markerHtml}
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div class="flex flex-wrap items-center gap-1.5">
              ${statusPill}
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${typeMeta.color}">
                <span>${typeMeta.icon}</span> ${typeMeta.label}
              </span>
            </div>
            <button type="button" onclick="copyActivityLink('${targetRound.id}', '${act.slug}')" class="text-[11px] font-semibold text-slate-400 hover:text-tdtu-blue flex items-center gap-1 transition-colors" title="Sao chép link mốc này">
              <span>🔗 Link</span>
            </button>
          </div>

          <h3 class="text-sm sm:text-base font-black text-slate-900 tracking-tight">${act.title}</h3>

          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5 font-medium">
            <div class="flex items-center gap-1 font-mono text-[11px] text-slate-700">
              <span>🕒</span> ${timeStr}
            </div>
            ${act.location ? `
              <div class="flex items-center gap-1 text-[11px] text-slate-600">
                <span>📍</span> ${act.location}
              </div>
            ` : ''}
          </div>

          ${descriptionRender}

          ${act.submissionEnabled && typeof renderStudentSubmissionPanel === 'function' ? renderStudentSubmissionPanel(act, targetRound) : ''}

          ${renderStudentCouncilTimelineInfo(act)}
        </div>
      </div>
    `;
  }

  let htmlContent = '';
  if (mainItems.length > 0) {
    htmlContent += mainItems.map(renderActivityCard).join('');
  }
  if (collapsedPastItems.length > 0) {
    htmlContent += `
      <div class="pt-2">
        <button type="button" onclick="toggleStudentTimelineViewAll()" class="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 transition-colors">
          <span>▼ Xem các mốc đã qua (${collapsedPastItems.length})</span>
        </button>
      </div>
    `;
  }

  container.innerHTML = htmlContent;

  if (typeof updateStudentPersonalSidebar === 'function') updateStudentPersonalSidebar();
  if (typeof renderRoundHeader === 'function') renderRoundHeader();
  if (typeof updateStudentJourneyStepper === 'function') updateStudentJourneyStepper();

  if (state.targetActivitySlug) {
    const targetSlug = state.targetActivitySlug;
    setTimeout(() => {
      const el = document.getElementById('activity-card-' + targetSlug)
        || document.getElementById('activity-card-' + slugify(targetSlug));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-400', 'bg-amber-50/70');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-amber-400', 'bg-amber-50/70');
        }, 3500);
      }
      state.targetActivitySlug = null;
    }, 300);
  }
};


// ============================================================================
// ADMIN OFFICIAL & SUPPORT SUPERVISORS MANAGEMENT TABLE (v1.6.0-beta.3)
// ============================================================================
window.filterAdminAssignedTable = function(filterVal) {
  renderAdminAssignedSupervisorsTable(filterVal);
};

window.renderAdminAssignedSupervisorsTable = function(filterVal = '') {
  const tbody = document.getElementById('admin-assigned-supervisors-tbody');
  const countTag = document.getElementById('adm-accepted-count-tag');
  if (!tbody) return;

  const registrations = state.adminReviewData?.registrations || [];
  const assigned = registrations.filter(r => r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned');

  if (countTag) countTag.textContent = `${assigned.length} SV`;

  const q = String(filterVal || '').trim().toLowerCase();
  const filtered = assigned.filter(r => {
    if (!q) return true;
    const supNames = getOfficialSupervisors(r).map(s => s.supervisorName || '').join(' ').toLowerCase();
    return (r.studentId && r.studentId.toLowerCase().includes(q)) ||
      (r.studentName && r.studentName.toLowerCase().includes(q)) ||
      (r.topicTitle && r.topicTitle.toLowerCase().includes(q)) ||
      supNames.includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400">
          ${assigned.length === 0 ? 'Chưa có sinh viên nào có kết quả GVHD chính thức.' : 'Không tìm thấy sinh viên phù hợp từ khóa tìm kiếm.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const officials = getOfficialSupervisors(r);
    const primary = officials.find(s => s.role === 'primary') || officials[0];
    const supports = officials.filter(s => s.role === 'support');

    const primaryHtml = primary ? `
      <div>
        <span class="font-bold text-slate-900 text-xs block">${primary.supervisorName || 'GVHD chính'}</span>
        <span class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">GVHD chính</span>
      </div>
    ` : '<span class="text-slate-400">--</span>';

    const supportsHtml = (supports.length > 0) ? `
      <div class="space-y-1.5">
        ${supports.map(sup => `
          <div class="flex items-center justify-between gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <span class="font-bold text-slate-800 text-xs block">${sup.supervisorName}</span>
              <span class="text-[9px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-bold border border-indigo-200">GVHD hỗ trợ</span>
            </div>
            <button type="button" onclick="removeSupportSupervisor('${r.studentId}', '${sup.supervisorId}', '${escapeHtml(sup.supervisorName)}', '${escapeHtml(r.studentName || r.studentId)}')" class="px-2 py-0.5 text-rose-600 hover:bg-rose-50 rounded text-[10px] font-bold border border-rose-200 transition-colors" title="Gỡ GVHD hỗ trợ khỏi sinh viên này">
              Gỡ
            </button>
          </div>
        `).join('')}
      </div>
    ` : '<span class="text-slate-400 italic text-[11px]">Chưa có</span>';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5 font-mono font-bold text-slate-900">${r.studentId}</td>
        <td class="p-3.5 font-semibold text-slate-800 whitespace-nowrap">${r.studentName || '--'}</td>
        <td class="p-3.5 max-w-xs">
          <span class="font-medium text-slate-900 block truncate" title="${r.topicTitle}">${r.topicTitle}</span>
          <span class="text-[11px] text-slate-500">${r.projectType || '--'}</span>
        </td>
        <td class="p-3.5 whitespace-nowrap">${primaryHtml}</td>
        <td class="p-3.5 min-w-[200px]">${supportsHtml}</td>
        <td class="p-3.5 text-right whitespace-nowrap">
          <button type="button" onclick="openAddSupportSupervisorModal('${r.studentId}')" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs border border-indigo-200 transition-colors flex items-center gap-1 inline-flex">
            <span>+ Thêm GVHD hỗ trợ</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

window.openAddSupportSupervisorModal = function(studentId) {
  const roundId = state.selectedRoundId;
  const registrations = state.adminReviewData?.registrations || [];
  const reg = registrations.find(r => r.studentId === studentId);
  if (!reg) {
    showToast('Không tìm thấy thông tin sinh viên!', 'error');
    return;
  }

  document.getElementById('support-target-student-id').value = studentId;
  const studentInfoEl = document.getElementById('add-support-student-info');
  if (studentInfoEl) studentInfoEl.textContent = `Sinh viên: ${reg.studentName || studentId} (MSSV: ${studentId})`;

  const officials = getOfficialSupervisors(reg);
  const primary = officials.find(s => s.role === 'primary') || officials[0];
  const supports = officials.filter(s => s.role === 'support');

  const summaryEl = document.getElementById('support-current-supervisors-summary');
  if (summaryEl) {
    let htmlStr = `• GVHD chính: <strong>${primary?.supervisorName || 'Chưa xác định'}</strong>`;
    if (supports.length > 0) {
      htmlStr += `<br>• GVHD hỗ trợ: ${supports.map(s => s.supervisorName).join(', ')}`;
    }
    summaryEl.innerHTML = htmlStr;
  }

  // Populate Supervisors dropdown with duplicate protection & quota check
  const select = document.getElementById('select-support-supervisor');
  const supervisors = state.adminReviewData?.supervisors || [];
  const assignedSupsSet = new Set(officials.map(s => s.supervisorId));

  select.innerHTML = '<option value="">-- Chọn GVHD hỗ trợ --</option>' + supervisors.map(s => {
    const isAlreadyAssigned = assignedSupsSet.has(s.id);
    const empType = s.employmentType || 'internal';
    const isAdjunct = (empType === 'adjunct');
    const cap = isAdjunct ? Math.min(5, s.capacity || s.maxQuota || 5) : Math.min(10, s.capacity || s.maxQuota || 10);
    const totalAssigned = getSupervisorTotalAssignedCount(s.id, registrations);
    const remaining = cap - totalAssigned;
    const isFull = (remaining <= 0);

    let label = `${s.name} (${isAdjunct ? 'Thỉnh giảng' : 'Cơ hữu'} • ${totalAssigned}/${cap} SV)`;
    if (isAlreadyAssigned) {
      label += ' — Đã là GVHD của SV';
    } else if (isFull) {
      label += ' — Đã đủ Quota';
    }

    const disabledAttr = (isAlreadyAssigned || isFull) ? 'disabled' : '';
    return `<option value="${s.id}" data-remaining="${remaining}" data-cap="${cap}" data-assigned="${totalAssigned}" ${disabledAttr}>${label}</option>`;
  }).join('');

  document.getElementById('support-supervisor-quota-hint').textContent = '';
  document.getElementById('btn-confirm-add-support').disabled = true;

  document.getElementById('modal-add-support-supervisor')?.classList.remove('hidden');
};

window.closeAddSupportSupervisorModal = function() {
  document.getElementById('modal-add-support-supervisor')?.classList.add('hidden');
};

window.onSelectSupportSupervisorChange = function(supId) {
  const submitBtn = document.getElementById('btn-confirm-add-support');
  const hint = document.getElementById('support-supervisor-quota-hint');
  if (!supId) {
    if (submitBtn) submitBtn.disabled = true;
    if (hint) hint.textContent = '';
    return;
  }

  const select = document.getElementById('select-support-supervisor');
  const opt = select.options[select.selectedIndex];
  const remaining = parseInt(opt.getAttribute('data-remaining') || '0', 10);
  const cap = parseInt(opt.getAttribute('data-cap') || '10', 10);
  const assigned = parseInt(opt.getAttribute('data-assigned') || '0', 10);

  if (remaining <= 0) {
    if (submitBtn) submitBtn.disabled = true;
    if (hint) hint.innerHTML = '<span class="text-rose-600 font-bold">⚠️ Giảng viên này đã đủ chỉ tiêu (hết quota) trong đợt!</span>';
  } else {
    if (submitBtn) submitBtn.disabled = false;
    if (hint) hint.innerHTML = `<span class="text-emerald-700 font-bold">✓ Chỉ tiêu khả dụng: còn ${remaining} chỗ (Đang hướng dẫn ${assigned}/${cap} SV).</span>`;
  }
};

window.executeAddSupportSupervisor = async function() {
  const roundId = state.selectedRoundId;
  const studentId = document.getElementById('support-target-student-id')?.value;
  const supervisorId = document.getElementById('select-support-supervisor')?.value;

  if (!roundId || !studentId || !supervisorId) return;

  const registrations = state.adminReviewData?.registrations || [];
  const reg = registrations.find(r => r.studentId === studentId);
  const sup = (state.adminReviewData?.supervisors || []).find(s => s.id === supervisorId);

  if (!reg || !sup) {
    showToast('Không tìm thấy thông tin sinh viên hoặc giảng viên!', 'error');
    return;
  }

  // Quota validation
  const empType = sup.employmentType || 'internal';
  const cap = (empType === 'adjunct' ? 5 : 10);
  const currentAssigned = getSupervisorTotalAssignedCount(sup.id, registrations);
  if (currentAssigned >= cap) {
    showToast(`Giảng viên ${sup.name} đã đủ chỉ tiêu tối đa (${cap} SV) theo quy định!`, 'warning');
    return;
  }

  // Duplicate protection
  const officials = getOfficialSupervisors(reg);
  if (officials.some(s => s.supervisorId === supervisorId)) {
    showToast(`Thầy/Cô ${sup.name} đã là GVHD của sinh viên này!`, 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-confirm-add-support');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Đang lưu...';
  }

  try {
    const updatedOfficials = [...officials, {
      supervisorId: sup.id,
      supervisorName: sup.name,
      source: 'admin_added',
      role: 'support',
      addedAt: new Date().toISOString()
    }];

    // Update in Firestore
    const regRef = doc(db, 'graduationRounds', roundId, 'registrations', studentId);
    await updateDoc(regRef, {
      officialSupervisors: updatedOfficials,
      updatedAt: serverTimestamp()
    });

    reg.officialSupervisors = updatedOfficials;

    closeAddSupportSupervisorModal();
    renderAdminAssignedSupervisorsTable();
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();

    showToast(`✓ Đã thêm Thầy/Cô ${sup.name} làm GVHD hỗ trợ cho sinh viên ${reg.studentName || studentId}!`, 'success');
  } catch (err) {
    console.error('Lỗi thêm GVHD hỗ trợ:', err);
    showToast('Lỗi: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Thêm GVHD Hỗ trợ';
    }
  }
};

window.removeSupportSupervisor = async function(studentId, supervisorId, supervisorName, studentName) {
  const roundId = state.selectedRoundId;
  if (!roundId || !studentId || !supervisorId) return;

  const confirmed = await showConfirm(
    'Gỡ GVHD hỗ trợ',
    `Bạn có chắc chắn muốn gỡ Thầy/Cô "${supervisorName}" khỏi vai trò GVHD hỗ trợ của sinh viên "${studentName}" không?`,
    { confirmText: 'Gỡ GVHD hỗ trợ', danger: true }
  );
  if (!confirmed) return;

  const registrations = state.adminReviewData?.registrations || [];
  const reg = registrations.find(r => r.studentId === studentId);
  if (!reg) return;

  try {
    const officials = getOfficialSupervisors(reg);
    const updatedOfficials = officials.filter(s => !(s.role === 'support' && s.supervisorId === supervisorId));

    const regRef = doc(db, 'graduationRounds', roundId, 'registrations', studentId);
    await updateDoc(regRef, {
      officialSupervisors: updatedOfficials,
      updatedAt: serverTimestamp()
    });

    reg.officialSupervisors = updatedOfficials;

    renderAdminAssignedSupervisorsTable();
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();

    showToast(`Đã gỡ GVHD hỗ trợ khỏi sinh viên ${studentName}.`, 'info');
  } catch (err) {
    console.error('Lỗi gỡ GVHD hỗ trợ:', err);
    showToast('Lỗi gỡ GVHD hỗ trợ: ' + err.message, 'error');
  }
};


// ============================================================================
// COUNCIL / HỘI ĐỒNG FOUNDATION MODULE (v1.9.0-beta.1)
// ============================================================================

window.toggleActivityCouncilFields = function(checked) {
  const box = document.getElementById('activity-council-extra-fields');
  if (box) {
    if (checked) box.classList.remove('hidden');
    else box.classList.add('hidden');
  }
};

state.activeCouncilManagement = {
  roundId: null,
  activityId: null,
  currentTab: 'councils',
  filterQuery: '',
  filterCouncilId: 'all'
};

window.openActivityCouncilManagement = function(roundId, actId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    showToast('Không tìm thấy thông tin đợt tốt nghiệp!', 'error');
    return;
  }

  const act = (targetRound.activities || []).find(a => a.id === actId);
  if (!act) {
    showToast('Không tìm thấy mốc kế hoạch!', 'error');
    return;
  }

  state.activeCouncilManagement.roundId = roundId;
  state.activeCouncilManagement.activityId = actId;
  state.activeCouncilManagement.currentTab = 'councils';
  state.activeCouncilManagement.filterQuery = '';
  state.activeCouncilManagement.filterCouncilId = 'all';

  // Ensure councilStructure defaults
  if (!act.councilStructure || !Array.isArray(act.councilStructure.slots) || act.councilStructure.slots.length === 0) {
    act.councilStructure = {
      slots: [
        { key: 'chair', label: 'Chủ tịch', name: 'Chủ tịch Hội đồng', type: 'mandatory' },
        { key: 'member', label: 'Ủy viên', name: 'Ủy viên Hội đồng', type: 'mandatory' },
        { key: 'secretary', label: 'Thư ký', name: 'Thư ký Hội đồng', type: 'mandatory' }
      ]
    };
  }
  act.councils = act.councils || [];
  act.councilStudentAssignments = act.councilStudentAssignments || [];

  // Update header text
  document.getElementById('council-modal-act-title').textContent = `QUẢN LÝ HỘI ĐỒNG — ${act.title}`;
  document.getElementById('council-modal-act-subtitle').textContent = `Đợt: ${targetRound.title} • Thời gian mốc: ${fmtActivityTime(act.startAt, act.endAt)}`;

  switchCouncilTab('councils');
  refreshCouncilModalViews();

  document.getElementById('modal-activity-councils')?.classList.remove('hidden');
};

window.closeActivityCouncilManagement = function() {
  document.getElementById('modal-activity-councils')?.classList.add('hidden');
  const roundId = state.activeCouncilManagement.roundId;
  if (roundId) {
    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }
  }
};

window.switchCouncilTab = function(tabName) {
  state.activeCouncilManagement.currentTab = tabName;
  const tabs = ['councils', 'structure', 'students'];
  tabs.forEach(t => {
    const btn = document.getElementById(`ctab-btn-${t}`);
    const panel = document.getElementById(`ctab-panel-${t}`);
    if (t === tabName) {
      if (btn) {
        btn.classList.add('border-indigo-600', 'text-indigo-700');
        btn.classList.remove('border-transparent', 'text-slate-500');
      }
      if (panel) panel.classList.remove('hidden');
    } else {
      if (btn) {
        btn.classList.remove('border-indigo-600', 'text-indigo-700');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
      if (panel) panel.classList.add('hidden');
    }
  });

  refreshCouncilModalViews();
};

window.refreshCouncilModalViews = function() {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const councils = act.councils || [];
  const slots = act.councilStructure?.slots || [];
  const assignments = act.councilStudentAssignments || [];

  // Update badges in tabs
  const councilsCountBadge = document.getElementById('cbadge-councils-count');
  if (councilsCountBadge) councilsCountBadge.textContent = councils.length;

  const slotsCountBadge = document.getElementById('cbadge-slots-count');
  if (slotsCountBadge) slotsCountBadge.textContent = slots.length;

  // Render Tab 1: Councils
  renderCouncilCards(act);

  // Render Tab 2: Structure Slots
  renderCouncilSlotsTable(act);

  // Render Tab 3: Students
  renderCouncilStudentsTab(act);
};

// --- TAB 1: RENDER COUNCILS CARDS ---
function renderCouncilCards(act) {
  const container = document.getElementById('councils-cards-grid');
  if (!container) return;

  const councils = act.councils || [];
  const assignments = act.councilStudentAssignments || [];
  const slots = act.councilStructure?.slots || [];

  if (councils.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300">
        <span class="text-3xl block mb-1">🏛️</span>
        <span class="font-bold text-slate-700 text-xs block">Mốc này chưa có Hội đồng nào</span>
        <p class="text-[11px] text-slate-400 mt-1">Bấm "+ Thêm Hội đồng" để tạo hội đồng đánh giá đầu tiên cho mốc.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = councils.map(c => {
    const assignedStudents = assignments.filter(a => a.councilId === c.id);
    const assignedCount = assignedStudents.length;

    // Check currently presenting student
    const presentingAssignment = assignedStudents.find(a => a.presentationStatus === 'presenting');
    let presentingStudentHtml = '';
    if (presentingAssignment) {
      const studentObj = findStudentInRound(presentingAssignment.studentId);
      presentingStudentHtml = `
        <div class="mt-2 p-2 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span class="font-bold text-[10px] uppercase tracking-wider text-emerald-800">Đang trình bày:</span>
            <span class="font-extrabold text-xs">${studentObj?.fullName || studentObj?.studentName || presentingAssignment.studentId}</span>
          </div>
          <span class="font-mono text-[10px] text-emerald-700 font-bold">#${presentingAssignment.order || '--'}</span>
        </div>
      `;
    }

    // Member slot fulfillment
    const membersBySlot = c.membersBySlot || {};
    let filledSlotsCount = 0;
    slots.forEach(s => {
      if (membersBySlot[s.key] && (membersBySlot[s.key].memberName || membersBySlot[s.key].name)) {
        filledSlotsCount++;
      }
    });

    let statusBadge = '<span class="badge bg-slate-100 text-slate-700 font-bold">Chuẩn bị</span>';
    if (c.status === 'ongoing') statusBadge = '<span class="badge bg-emerald-100 text-emerald-800 font-bold">● Đang diễn ra</span>';
    else if (c.status === 'completed') statusBadge = '<span class="badge bg-slate-200 text-slate-600 font-bold">✓ Đã kết thúc</span>';

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-black text-sm text-slate-900 tracking-tight">${c.name}</h4>
              ${statusBadge}
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5 font-medium">📍 ${c.room || 'Chưa cập nhật phòng'}</p>
          </div>
          <div class="text-right">
            <span class="font-black text-indigo-700 text-xs block">${assignedCount} SV</span>
            <span class="text-[10px] text-slate-400">${filledSlotsCount}/${slots.length} thành viên</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded-xl border border-slate-100">
          <span>📅 ${c.date || '--'}</span>
          <span>🕒 ${c.startTime || '--'} → ${c.endTime || '--'}</span>
        </div>

        ${presentingStudentHtml}

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <button type="button" onclick="copyCouncilLink('${act.slug}', '${c.slug || c.id}')" class="text-slate-500 hover:text-indigo-600 font-semibold text-[11px] flex items-center gap-1" title="Sao chép link trực tiếp đến Hội đồng này">
            <span>🔗 Link</span>
          </button>
          <div class="space-x-1.5">
            <button type="button" onclick="openCouncilWorkspace('${state.activeCouncilManagement.roundId}', '${act.id}', '${c.id}')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs">▶ Vào phòng HĐ</button>
            <button type="button" onclick="copyCouncil('${c.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors" title="Sao chép Hội đồng">📋 Sao chép</button>
            <button type="button" onclick="editCouncilModal('${c.id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition-colors">Sửa / Thành viên</button>
            <button type="button" onclick="deleteCouncil('${c.id}')" class="px-2 py-1 text-rose-600 hover:underline font-bold text-xs">Xóa</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- TAB 2: RENDER STRUCTURE SLOTS TABLE ---
function renderCouncilSlotsTable(act) {
  const tbody = document.getElementById('council-slots-tbody');
  if (!tbody) return;

  const slots = act.councilStructure?.slots || [];
  tbody.innerHTML = slots.map((s, idx) => {
    const isMandatory = (s.type === 'mandatory');
    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3 text-center font-bold text-slate-400 font-mono">${idx + 1}</td>
        <td class="p-3 font-bold text-slate-800">${s.name || s.label}</td>
        <td class="p-3 font-mono font-bold text-indigo-700">${s.label || s.key}</td>
        <td class="p-3">
          ${isMandatory ? '<span class="badge bg-slate-100 text-slate-700 font-bold">Bắt buộc</span>' : '<span class="badge bg-amber-100 text-amber-800 font-bold">Khách mời / DN</span>'}
        </td>
        <td class="p-3 text-right">
          ${!isMandatory ? `<button type="button" onclick="deleteGuestSlot('${s.key}')" class="text-rose-600 hover:underline font-bold text-xs">Xóa</button>` : '<span class="text-slate-300 font-semibold">Cố định</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

// --- TAB 3: RENDER STUDENTS & PRESENTATION ORDER ---
function renderCouncilStudentsTab(act) {
  const tbody = document.getElementById('council-students-tbody');
  const councilFilterSelect = document.getElementById('council-student-filter-council');
  if (!tbody) return;

  const councils = act.councils || [];
  const assignments = act.councilStudentAssignments || [];

  // Update Council filter dropdown
  if (councilFilterSelect) {
    const currentVal = state.activeCouncilManagement.filterCouncilId || 'all';
    councilFilterSelect.innerHTML = '<option value="all">Tất cả sinh viên</option><option value="unassigned">Chưa phân Hội đồng</option>' + councils.map(c => {
      const cCount = assignments.filter(a => a.councilId === c.id).length;
      return `<option value="${c.id}">${c.name} (${cCount} SV)</option>`;
    }).join('');
    councilFilterSelect.value = currentVal;
  }

  // Get all registered or eligible students in round
  const roundStudents = getRoundAllStudents();
  const studentsCountBadge = document.getElementById('cbadge-students-count');
  const assignedCount = assignments.filter(a => !!a.councilId).length;
  if (studentsCountBadge) studentsCountBadge.textContent = `${assignedCount}/${roundStudents.length}`;

  const q = String(state.activeCouncilManagement.filterQuery || '').trim().toLowerCase();
  const filterCid = state.activeCouncilManagement.filterCouncilId || 'all';

  const filteredStudents = roundStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '';
    const topic = s.topicTitle || '';
    if (q && !sid.toLowerCase().includes(q) && !name.toLowerCase().includes(q) && !topic.toLowerCase().includes(q)) {
      return false;
    }

    const asgn = assignments.find(a => a.studentId === sid);
    if (filterCid === 'unassigned') {
      return !asgn || !asgn.councilId;
    }
    if (filterCid !== 'all') {
      return asgn && asgn.councilId === filterCid;
    }
    return true;
  });

  const countTag = document.getElementById('council-student-filter-count');
  if (countTag) countTag.textContent = `Hiển thị: ${filteredStudents.length} sinh viên`;

  if (filteredStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400">Không có sinh viên phù hợp điều kiện lọc.</td></tr>';
    return;
  }

  // Render rows
  tbody.innerHTML = filteredStudents.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '--';
    const topic = s.topicTitle || '--';
    const asgn = assignments.find(a => a.studentId === sid);
    const assignedCouncilId = asgn?.councilId || '';
    const order = asgn?.order || (idx + 1);
    const status = asgn?.presentationStatus || 'waiting';

    const councilOptions = '<option value="">-- Chưa phân công --</option>' + councils.map(c => {
      return `<option value="${c.id}" ${assignedCouncilId === c.id ? 'selected' : ''}>${c.name}</option>`;
    }).join('');

    let statusPill = '<span class="badge bg-slate-100 text-slate-600 font-bold">Chờ</span>';
    if (status === 'presenting') {
      statusPill = '<span class="badge bg-emerald-500 text-white font-black animate-pulse">● Đang trình bày</span>';
    } else if (status === 'presented') {
      statusPill = '<span class="badge bg-indigo-100 text-indigo-800 font-bold">✓ Đã xong</span>';
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 max-w-xs truncate text-slate-700" title="${topic}">${topic}</td>
        <td class="p-3">
          <select onchange="changeStudentCouncil('${sid}', this.value)" class="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-bold ${assignedCouncilId ? 'bg-indigo-50/60 text-indigo-900 border-indigo-200' : 'bg-white text-slate-500'}">
            ${councilOptions}
          </select>
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${assignedCouncilId ? `
            <div class="flex items-center justify-center gap-1">
              <span class="font-mono font-bold text-slate-700 w-5">#${order}</span>
              <div class="flex flex-col">
                <button type="button" onclick="moveStudentCouncilOrder('${sid}', 'up')" class="text-[10px] text-slate-400 hover:text-slate-800 leading-none">▲</button>
                <button type="button" onclick="moveStudentCouncilOrder('${sid}', 'down')" class="text-[10px] text-slate-400 hover:text-slate-800 leading-none">▼</button>
              </div>
            </div>
          ` : '<span class="text-slate-300 font-mono">--</span>'}
        </td>
        <td class="p-3 text-center whitespace-nowrap space-x-1">
          ${assignedCouncilId ? `
            ${statusPill}
            <div class="inline-flex gap-1 ml-1.5">
              <button type="button" onclick="setStudentPresentationStatus('${sid}', 'presenting')" class="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold" title="Bắt đầu trình bày">▶</button>
              <button type="button" onclick="setStudentPresentationStatus('${sid}', 'presented')" class="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold" title="Hoàn tất trình bày">✓</button>
              <button type="button" onclick="setStudentPresentationStatus('${sid}', 'waiting')" class="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold" title="Đặt lại trạng thái chờ">↺</button>
            </div>
          ` : '<span class="text-slate-300">--</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

window.filterCouncilStudents = function() {
  const searchInput = document.getElementById('council-student-search');
  const councilSelect = document.getElementById('council-student-filter-council');
  state.activeCouncilManagement.filterQuery = searchInput?.value || '';
  state.activeCouncilManagement.filterCouncilId = councilSelect?.value || 'all';

  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (act) renderCouncilStudentsTab(act);
};

// Helper: Get all students registered or eligible in round
function getRoundAllStudents() {
  const { roundId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return [];

  // Priority 1: registrations in adminReviewData
  if (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0) {
    return state.adminReviewData.registrations;
  }
  // Priority 2: eligibleStudents
  if (Array.isArray(targetRound.eligibleStudents) && targetRound.eligibleStudents.length > 0) {
    return targetRound.eligibleStudents;
  }
  return [];
}

function findStudentInRound(studentId) {
  const all = getRoundAllStudents();
  const found = all.find(s => (s.mssv === studentId || s.studentId === studentId));
  if (found) {
    if ((!found.name && !found.fullName) || (!found.className && !found.studentClass)) {
      const fac = window.getFacultyStudent ? window.getFacultyStudent(studentId) : null;
      if (fac && !fac.isMissing) {
        return {
          ...found,
          name: found.name || fac.name,
          fullName: found.fullName || fac.fullName,
          className: found.className || fac.className,
          studentClass: found.studentClass || fac.studentClass,
          major: found.major || fac.major,
          gender: found.gender || fac.gender,
          email: found.email || fac.email
        };
      }
    }
    return found;
  }
  if (window.getFacultyStudent) {
    const fac = window.getFacultyStudent(studentId);
    if (fac && !fac.isMissing) {
      return {
        studentId: fac.mssv,
        mssv: fac.mssv,
        name: fac.name,
        fullName: fac.fullName,
        className: fac.className,
        studentClass: fac.studentClass,
        major: fac.major,
        gender: fac.gender,
        email: fac.email
      };
    }
  }
  return null;
}

// --- STUDENT COUNCIL ASSIGNMENT ACTIONS ---
window.changeStudentCouncil = async function(studentId, newCouncilId) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  act.councilStudentAssignments = act.councilStudentAssignments || [];
  let existingIdx = act.councilStudentAssignments.findIndex(a => a.studentId === studentId);

  if (!newCouncilId) {
    // Unassign
    if (existingIdx >= 0) {
      act.councilStudentAssignments.splice(existingIdx, 1);
    }
  } else {
    // Assign to new council: assign max order in that council
    const councilAssignments = act.councilStudentAssignments.filter(a => a.councilId === newCouncilId);
    const maxOrder = councilAssignments.reduce((m, a) => Math.max(m, a.order || 0), 0);

    if (existingIdx >= 0) {
      act.councilStudentAssignments[existingIdx].councilId = newCouncilId;
      act.councilStudentAssignments[existingIdx].order = maxOrder + 1;
    } else {
      act.councilStudentAssignments.push({
        studentId,
        councilId: newCouncilId,
        order: maxOrder + 1,
        presentationStatus: 'waiting'
      });
    }
  }

  await persistActivityCouncilChanges(targetRound);
  refreshCouncilModalViews();
};

window.moveStudentCouncilOrder = async function(studentId, direction) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const assignments = act.councilStudentAssignments || [];
  const current = assignments.find(a => a.studentId === studentId);
  if (!current || !current.councilId) return;

  const councilStudents = assignments
    .filter(a => a.councilId === current.councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const idx = councilStudents.findIndex(a => a.studentId === studentId);
  if (idx < 0) return;

  if (direction === 'up' && idx > 0) {
    const temp = councilStudents[idx].order;
    councilStudents[idx].order = councilStudents[idx - 1].order;
    councilStudents[idx - 1].order = temp;
  } else if (direction === 'down' && idx < councilStudents.length - 1) {
    const temp = councilStudents[idx].order;
    councilStudents[idx].order = councilStudents[idx + 1].order;
    councilStudents[idx + 1].order = temp;
  } else {
    return;
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilStudentsTab(act);
};

window.setStudentPresentationStatus = async function(studentId, newStatus) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const current = (act.councilStudentAssignments || []).find(a => a.studentId === studentId);
  if (!current) return;

  // If setting to presenting, reset any other student presenting in the same council to waiting/presented
  if (newStatus === 'presenting') {
    (act.councilStudentAssignments || []).forEach(a => {
      if (a.councilId === current.councilId && a.studentId !== studentId && a.presentationStatus === 'presenting') {
        a.presentationStatus = 'waiting';
      }
    });
  }

  current.presentationStatus = newStatus;

  await persistActivityCouncilChanges(targetRound);
  refreshCouncilModalViews();
};

// --- CREATE / EDIT / COPY COUNCIL MODALS ---
window.openCreateCouncilModal = function() {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  document.getElementById('form-edit-council').reset();
  document.getElementById('council-form-id').value = '';
  document.getElementById('modal-edit-council-title').textContent = 'Thêm Hội đồng mới';

  // Suggest next council name
  const nextNum = (act.councils || []).length + 1;
  document.getElementById('council-form-name').value = `HĐ${nextNum}`;
  document.getElementById('council-form-status').value = 'preparing';

  // Inherit activity date/time if available
  const actStart = isoToVietnameseDateTime(act.startAt);
  const actEnd = isoToVietnameseDateTime(act.endAt);
  document.getElementById('council-form-date').value = actStart.date || '';
  document.getElementById('council-form-start-time').value = actStart.time || '08:00';
  document.getElementById('council-form-end-time').value = actEnd.time || '11:30';

  renderCouncilMembersFormSlots(act, {});

  document.getElementById('modal-edit-council')?.classList.remove('hidden');
};

window.editCouncilModal = function(councilId) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const council = (act.councils || []).find(c => c.id === councilId);
  if (!council) return;

  document.getElementById('council-form-id').value = council.id;
  document.getElementById('modal-edit-council-title').textContent = `Chỉnh sửa: ${council.name}`;
  document.getElementById('council-form-name').value = council.name || '';
  document.getElementById('council-form-room').value = council.room || '';
  document.getElementById('council-form-status').value = council.status || 'preparing';
  document.getElementById('council-form-date').value = council.date || '';
  document.getElementById('council-form-start-time').value = council.startTime || '';
  document.getElementById('council-form-end-time').value = council.endTime || '';
  document.getElementById('council-form-note').value = council.note || '';

  renderCouncilMembersFormSlots(act, council.membersBySlot || {});

  document.getElementById('modal-edit-council')?.classList.remove('hidden');
};

window.copyCouncil = function(councilId) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const council = (act.councils || []).find(c => c.id === councilId);
  if (!council) return;

  // Clear ID so it will create a new council!
  document.getElementById('council-form-id').value = '';
  document.getElementById('modal-edit-council-title').textContent = `Sao chép Hội đồng (Bản mới)`;
  document.getElementById('council-form-name').value = `${council.name} (Bản sao)`;
  document.getElementById('council-form-room').value = council.room || '';
  document.getElementById('council-form-status').value = 'preparing';
  document.getElementById('council-form-date').value = council.date || '';
  document.getElementById('council-form-start-time').value = council.startTime || '';
  document.getElementById('council-form-end-time').value = council.endTime || '';
  document.getElementById('council-form-note').value = council.note || '';

  renderCouncilMembersFormSlots(act, council.membersBySlot || {});

  document.getElementById('modal-edit-council')?.classList.remove('hidden');
  showToast('Đã sao chép cấu hình Hội đồng. Vui lòng kiểm tra và lưu lại.', 'info');
};

window.closeEditCouncilModal = function() {
  document.getElementById('modal-edit-council')?.classList.add('hidden');
};

function renderCouncilMembersFormSlots(act, membersBySlot = {}) {
  const container = document.getElementById('council-members-form-container');
  if (!container) return;

  const slots = act.councilStructure?.slots || [];
  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  container.innerHTML = slots.map(s => {
    const assigned = membersBySlot[s.key] || {};
    const memberId = assigned.memberId || '';
    const memberName = assigned.memberName || '';
    const isGuest = (assigned.type === 'guest');

    return `
      <div class="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <span>👤</span> ${s.name || s.label} <span class="text-indigo-600 font-mono text-[10px]">(${s.label || s.key})</span>
          </label>
          <label class="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
            <input type="checkbox" id="chk-guest-${s.key}" ${isGuest ? 'checked' : ''} onchange="toggleSlotGuestInput('${s.key}', this.checked)" class="rounded text-tdtu-blue">
            <span>Khách mời ngoài</span>
          </label>
        </div>

        <!-- Supervisor dropdown -->
        <div id="slot-sup-wrap-${s.key}" class="${isGuest ? 'hidden' : ''}">
          <select id="slot-sup-${s.key}" class="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
            <option value="">-- Chưa phân công --</option>
            ${supervisors.map(sup => `
              <option value="${sup.id}" ${memberId === sup.id ? 'selected' : ''}>${sup.name} (${sup.department || 'Khoa MTCN'})${sup.employmentType === 'adjunct' ? ' • Thỉnh giảng' : ''}</option>
            `).join('')}
          </select>
        </div>

        <!-- Guest manual inputs -->
        <div id="slot-guest-wrap-${s.key}" class="${isGuest ? '' : 'hidden'} grid grid-cols-2 gap-2">
          <input type="text" id="slot-guest-name-${s.key}" value="${isGuest ? memberName : ''}" placeholder="Họ và tên khách mời..." class="p-2 border border-slate-300 rounded-lg text-xs">
          <input type="text" id="slot-guest-org-${s.key}" value="${assigned.organization || ''}" placeholder="Đơn vị / Doanh nghiệp..." class="p-2 border border-slate-300 rounded-lg text-xs">
        </div>
      </div>
    `;
  }).join('');
}

window.toggleSlotGuestInput = function(slotKey, isGuest) {
  const supWrap = document.getElementById(`slot-sup-wrap-${slotKey}`);
  const guestWrap = document.getElementById(`slot-guest-wrap-${slotKey}`);
  if (supWrap && guestWrap) {
    if (isGuest) {
      supWrap.classList.add('hidden');
      guestWrap.classList.remove('hidden');
    } else {
      supWrap.classList.remove('hidden');
      guestWrap.classList.add('hidden');
    }
  }
};

window.syncCouncilDatePicker = function(val) {
  if (!val) return;
  const parts = val.split('-');
  if (parts.length === 3) {
    const input = document.getElementById('council-form-date');
    if (input) input.value = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
};

window.clearCouncilDateTime = function() {
  const dateInput = document.getElementById('council-form-date');
  const startInput = document.getElementById('council-form-start-time');
  const endInput = document.getElementById('council-form-end-time');
  if (dateInput) dateInput.value = '';
  if (startInput) startInput.value = '';
  if (endInput) endInput.value = '';
};

window.saveCouncil = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const id = document.getElementById('council-form-id')?.value?.trim();
  const name = document.getElementById('council-form-name')?.value?.trim();
  const room = document.getElementById('council-form-room')?.value?.trim() || '';
  const status = document.getElementById('council-form-status')?.value || 'preparing';
  const date = document.getElementById('council-form-date')?.value?.trim() || '';
  const startTime = document.getElementById('council-form-start-time')?.value?.trim() || '';
  const endTime = document.getElementById('council-form-end-time')?.value?.trim() || '';
  const note = document.getElementById('council-form-note')?.value?.trim() || '';

  if (!name) {
    showToast('Vui lòng nhập tên Hội đồng (*)', 'warning');
    return;
  }

  // Validate date & time
  if (date) {
    const parsed = parseVietnameseDateTime(date, startTime || '08:00');
    if (parsed === null) {
      showToast('Ngày đánh giá không hợp lệ (DD/MM/YYYY)!', 'warning');
      return;
    }
  }

  // Extract membersBySlot
  const slots = act.councilStructure?.slots || [];
  const membersBySlot = {};
  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  slots.forEach(s => {
    const isGuest = document.getElementById(`chk-guest-${s.key}`)?.checked === true;
    if (isGuest) {
      const gName = document.getElementById(`slot-guest-name-${s.key}`)?.value?.trim();
      const gOrg = document.getElementById(`slot-guest-org-${s.key}`)?.value?.trim();
      if (gName) {
        membersBySlot[s.key] = {
          type: 'guest',
          memberName: gName,
          organization: gOrg || '',
          slotKey: s.key
        };
      }
    } else {
      const supId = document.getElementById(`slot-sup-${s.key}`)?.value;
      if (supId) {
        const supObj = supervisors.find(x => x.id === supId);
        membersBySlot[s.key] = {
          type: 'supervisor',
          memberId: supId,
          memberName: supObj?.name || 'Giảng viên',
          memberEmail: supObj?.email || '',
          department: supObj?.department || '',
          slotKey: s.key
        };
      }
    }
  });

  const slug = id ? ((act.councils || []).find(c => c.id === id)?.slug || slugify(name)) : ('c-' + slugify(name) + '-' + Date.now().toString(36).substr(-4));
  const councilId = id || ('council_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));

  const councilData = {
    id: councilId,
    slug,
    name,
    room,
    status,
    date,
    startTime,
    endTime,
    note,
    membersBySlot,
    updatedAt: new Date().toISOString()
  };

  act.councils = act.councils || [];
  const existingIdx = act.councils.findIndex(c => c.id === councilId);
  if (existingIdx >= 0) {
    act.councils[existingIdx] = councilData;
  } else {
    councilData.createdAt = councilData.updatedAt;
    act.councils.push(councilData);
  }

  await persistActivityCouncilChanges(targetRound);
  closeEditCouncilModal();
  refreshCouncilModalViews();
  showToast(`✓ Đã lưu thông tin Hội đồng "${name}" thành công!`, 'success');
};

window.deleteCouncil = async function(councilId) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const council = (act.councils || []).find(c => c.id === councilId);
  if (!council) return;

  const confirmed = await showConfirm(
    'Xóa Hội đồng',
    `Bạn có chắc chắn muốn xóa Hội đồng "${council.name}" không? Các sinh viên đã phân vào Hội đồng này sẽ chuyển về trạng thái Chưa phân công.`,
    { confirmText: 'Xóa Hội đồng', danger: true }
  );
  if (!confirmed) return;

  act.councils = (act.councils || []).filter(c => c.id !== councilId);
  // Free assigned students
  (act.councilStudentAssignments || []).forEach(a => {
    if (a.councilId === councilId) {
      a.councilId = '';
      a.presentationStatus = 'waiting';
    }
  });

  await persistActivityCouncilChanges(targetRound);
  refreshCouncilModalViews();
  showToast(`Đã xóa Hội đồng "${council.name}".`, 'info');
};

// --- GUEST SLOTS MANAGEMENT ---
window.openAddGuestSlotModal = function() {
  document.getElementById('slot-form-name').value = '';
  document.getElementById('slot-form-label').value = '';
  document.getElementById('modal-add-guest-slot')?.classList.remove('hidden');
};

window.closeAddGuestSlotModal = function() {
  document.getElementById('modal-add-guest-slot')?.classList.add('hidden');
};

window.saveGuestSlot = async function() {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const name = document.getElementById('slot-form-name')?.value?.trim();
  const label = document.getElementById('slot-form-label')?.value?.trim();
  if (!name || !label) {
    showToast('Vui lòng nhập đầy đủ tên và mã viết tắt cho vị trí mới', 'warning');
    return;
  }

  const key = 'guest_' + Date.now().toString(36);
  act.councilStructure = act.councilStructure || { slots: [] };
  act.councilStructure.slots.push({
    key,
    label,
    name,
    type: 'guest'
  });

  await persistActivityCouncilChanges(targetRound);
  closeAddGuestSlotModal();
  refreshCouncilModalViews();
  showToast(`✓ Đã thêm vị trí "${name}" vào cấu trúc Hội đồng của Mốc!`, 'success');
};

window.deleteGuestSlot = async function(slotKey) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const slots = act.councilStructure?.slots || [];
  const targetSlot = slots.find(s => s.key === slotKey);
  if (!targetSlot || targetSlot.type === 'mandatory') {
    showToast('Không thể xóa vị trí bắt buộc!', 'warning');
    return;
  }

  const confirmed = await showConfirm(
    'Xóa Vị trí Thành viên',
    `Bạn có chắc chắn muốn xóa vị trí "${targetSlot.name || targetSlot.label}" khỏi tất cả các Hội đồng trong Mốc này không?`,
    { confirmText: 'Xóa vị trí', danger: true }
  );
  if (!confirmed) return;

  act.councilStructure.slots = slots.filter(s => s.key !== slotKey);

  // Clean up from all councils
  (act.councils || []).forEach(c => {
    if (c.membersBySlot && c.membersBySlot[slotKey]) {
      delete c.membersBySlot[slotKey];
    }
  });

  await persistActivityCouncilChanges(targetRound);
  refreshCouncilModalViews();
  showToast(`Đã xóa vị trí "${targetSlot.name}".`, 'info');
};

// --- LINK COPIERS ---
window.copyCouncilLink = function(activitySlug, councilSlug) {
  const { roundId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const rCode = targetRound?.slug || targetRound?.shortCode || roundId;
  const link = `${window.location.origin}${window.location.pathname}?x=${encodeURIComponent(rCode)}&a=${encodeURIComponent(activitySlug)}&c=${encodeURIComponent(councilSlug)}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      showToast('✓ Đã sao chép liên kết trực tiếp Hội đồng: ' + link, 'success');
    }).catch(() => {
      prompt('Liên kết Hội đồng:', link);
    });
  } else {
    prompt('Liên kết Hội đồng:', link);
  }
};

// --- PERSISTENCE HELPER ---
async function persistActivityCouncilChanges(targetRound) {
  const roundId = targetRound.id;
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities: targetRound.activities,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Lỗi lưu thay đổi Hội đồng:', err);
    showToast('Lỗi lưu dữ liệu: ' + err.message, 'error');
  }
}

// --- STUDENT TIMELINE RENDERING HELPER ---
function renderStudentCouncilTimelineInfo(act) {
  if (!act || !act.councilEnabled) return '';

  const councils = act.councils || [];
  const assignments = act.councilStudentAssignments || [];

  // Determine current student ID (logged in or viewed in preview)
  const studentMssv = state.studentMssv || state.user?.email?.split('@')[0];
  const asgn = studentMssv ? assignments.find(a => a.studentId === studentMssv) : null;
  const council = asgn && asgn.councilId ? councils.find(c => c.id === asgn.councilId) : null;

  // Check if current user is a Supervisor in any of the councils in this activity
  let memberBannerHtml = '';
  const userEmail = state.user?.email?.toLowerCase();
  if (userEmail) {
    for (const c of councils) {
      const members = Object.values(c.membersBySlot || {});
      const myMembership = members.find(m => m.memberEmail && m.memberEmail.toLowerCase() === userEmail);
      if (myMembership) {
        const slotObj = (act.councilStructure?.slots || []).find(s => s.key === myMembership.slotKey);
        memberBannerHtml = `
          <div class="mt-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
            <span class="font-bold text-blue-900 text-xs flex items-center gap-1.5">
              <span>🏛️</span> Thầy/Cô được phân công: <strong>${c.name}</strong> (${slotObj?.name || slotObj?.label || 'Thành viên'})
            </span>
            <div class="flex items-center justify-between gap-2 pt-1">
              <p class="text-[11px] text-blue-700">📍 Phòng: ${c.room || 'Đang cập nhật'} • 📅 Ngày: ${c.date || '--'} (${c.startTime || '--'} – ${c.endTime || '--'})</p>
              <button type="button" onclick="openCouncilWorkspace('${targetRound?.id}', '${act.id}', '${c.id}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0">
                🏛️ Vào phòng Hội đồng & Chấm điểm
              </button>
            </div>
          </div>
        `;
        break;
      }
    }
  }

  if (!council) {
    return `
      <div class="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
        <span class="font-semibold">⚖️ Hội đồng đánh giá: <span class="text-slate-400 italic">Chưa phân công</span></span>
        ${act.councils?.length > 0 ? `<span class="text-[10px] text-slate-400">${act.councils.length} Hội đồng</span>` : ''}
      </div>
      ${memberBannerHtml}
    `;
  }

  let statusCls = 'bg-slate-100 text-slate-700';
  let statusText = 'Chờ trình bày';
  if (asgn.presentationStatus === 'presenting') {
    statusCls = 'bg-emerald-500 text-white font-black animate-pulse';
    statusText = '● Đang trình bày';
  } else if (asgn.presentationStatus === 'presented') {
    statusCls = 'bg-indigo-100 text-indigo-800 font-bold';
    statusText = '✓ Đã trình bày';
  }

  const showOrder = act.showPresentationOrderToStudents && asgn.order;

  return `
    <div class="mt-2.5 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2 text-xs">
      <div class="flex items-center justify-between">
        <span class="font-black text-indigo-950 flex items-center gap-1.5 text-xs sm:text-sm">
          <span>⚖️</span> HỘI ĐỒNG: ${council.name}
        </span>
        <span class="badge ${statusCls} text-[10px]">${statusText}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-indigo-900 text-[11px]">
        <div>📍 <strong>Phòng:</strong> ${council.room || 'Đang cập nhật'}</div>
        <div>📅 <strong>Ngày:</strong> ${council.date || '--'} (${council.startTime || '--'} – ${council.endTime || '--'})</div>
      </div>

      ${showOrder ? `
        <div class="pt-1.5 border-t border-indigo-100 flex items-center justify-between text-indigo-900">
          <span class="font-semibold text-[11px]">Thứ tự trình bày của bạn:</span>
          <span class="font-black text-xs px-2 py-0.5 bg-white rounded-lg border border-indigo-200">#${asgn.order}</span>
        </div>
      ` : ''}
    </div>
    ${memberBannerHtml}
  `;
}



// ============================================================================
// IFA+ GRADUATION BETA v1.9.0-beta.1: SCORING CONFIG & COUNCIL OPERATION MODULE
// ============================================================================

// 1. SCORING CONFIG HELPERS
window.toggleActivityScoringConfig = function(enabled) {
  const panel = document.getElementById('activity-scoring-config-panel');
  if (panel) {
    if (enabled) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }
};

window.switchActivityScoringMode = function(mode) {
  const numWrap = document.getElementById('activity-scoring-numeric-wrap');
  const letterWrap = document.getElementById('activity-scoring-letter-wrap');
  const rubricWrap = document.getElementById('activity-scoring-rubric-wrap');
  const rNum = document.querySelector('input[name="activity_scoring_mode"][value="numeric"]');
  const rLet = document.querySelector('input[name="activity_scoring_mode"][value="letter"]');
  const rRub = document.querySelector('input[name="activity_scoring_mode"][value="defense_rubric"]');

  if (mode === 'letter') {
    if (rLet) rLet.checked = true;
    if (numWrap) numWrap.classList.add('hidden');
    if (letterWrap) letterWrap.classList.remove('hidden');
    if (rubricWrap) rubricWrap.classList.add('hidden');
  } else if (mode === 'defense_rubric') {
    if (rRub) rRub.checked = true;
    if (numWrap) numWrap.classList.add('hidden');
    if (letterWrap) letterWrap.classList.add('hidden');
    if (rubricWrap) rubricWrap.classList.remove('hidden');
    renderActivityRubricList();
  } else {
    if (rNum) rNum.checked = true;
    if (numWrap) numWrap.classList.remove('hidden');
    if (letterWrap) letterWrap.classList.add('hidden');
    if (rubricWrap) rubricWrap.classList.add('hidden');
  }
};

window.renderActivityRubricList = function() {
  const container = document.getElementById('activity-scoring-rubric-list');
  const totalMaxEl = document.getElementById('activity-scoring-rubric-total-max');
  if (!container) return;

  const list = state._currentActivityRubric || [];
  if (list.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-slate-400">Chưa có tiêu chí nào. Bấm "+ Thêm tiêu chí".</div>';
    if (totalMaxEl) totalMaxEl.textContent = '0.0';
    return;
  }

  let totalMax = 0;
  container.innerHTML = list.map((crit, idx) => {
    totalMax += Number(crit.maxScore || 0);
    return `
      <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold text-slate-400">#${idx + 1}</span>
          <span class="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">${crit.key}</span>
          <span class="font-bold text-slate-900">${crit.label}</span>
          <span class="text-emerald-700 font-bold font-mono">(${crit.maxScore}đ)</span>
          ${crit.description ? `<span class="text-[10px] text-slate-400 truncate max-w-xs">(${crit.description})</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 text-[11px]">
          <button type="button" onclick="editRubricCriterion('${crit.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
          <button type="button" onclick="deleteRubricCriterion('${crit.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
        </div>
      </div>
    `;
  }).join('');

  if (totalMaxEl) totalMaxEl.textContent = totalMax.toFixed(1);
};

window.openAddRubricCriterionModal = function() {
  document.getElementById('rubric-criterion-id').value = '';
  document.getElementById('rubric-criterion-key').value = '';
  document.getElementById('rubric-criterion-label').value = '';
  document.getElementById('rubric-criterion-max').value = '2.5';
  document.getElementById('rubric-criterion-desc').value = '';
  document.getElementById('modal-rubric-criterion-title').textContent = 'Thêm tiêu chí Rubric mới';
  document.getElementById('modal-rubric-criterion')?.classList.remove('hidden');
};

window.closeRubricCriterionModal = function() {
  document.getElementById('modal-rubric-criterion')?.classList.add('hidden');
};

window.editRubricCriterion = function(id) {
  const crit = (state._currentActivityRubric || []).find(c => c.id === id);
  if (!crit) return;
  document.getElementById('rubric-criterion-id').value = crit.id;
  document.getElementById('rubric-criterion-key').value = crit.key;
  document.getElementById('rubric-criterion-label').value = crit.label;
  document.getElementById('rubric-criterion-max').value = crit.maxScore;
  document.getElementById('rubric-criterion-desc').value = crit.description || '';
  document.getElementById('modal-rubric-criterion-title').textContent = 'Chỉnh sửa tiêu chí Rubric';
  document.getElementById('modal-rubric-criterion')?.classList.remove('hidden');
};

window.deleteRubricCriterion = function(id) {
  state._currentActivityRubric = (state._currentActivityRubric || []).filter(c => c.id !== id);
  renderActivityRubricList();
};

window.saveRubricCriterion = function() {
  const id = document.getElementById('rubric-criterion-id')?.value?.trim();
  const key = document.getElementById('rubric-criterion-key')?.value?.trim().toLowerCase();
  const label = document.getElementById('rubric-criterion-label')?.value?.trim();
  const maxScore = parseFloat(document.getElementById('rubric-criterion-max')?.value);
  const desc = document.getElementById('rubric-criterion-desc')?.value?.trim() || '';

  if (!key || !label) {
    showToast('Vui lòng nhập đầy đủ Mã tiêu chí và Tên tiêu chí!', 'warning');
    return;
  }
  if (isNaN(maxScore) || maxScore <= 0) {
    showToast('Điểm tối đa của tiêu chí phải là số dương (> 0)!', 'warning');
    return;
  }

  state._currentActivityRubric = state._currentActivityRubric || [];
  
  // Check duplicate key
  const duplicate = state._currentActivityRubric.find(c => c.key === key && c.id !== id);
  if (duplicate) {
    showToast(`Mã tiêu chí "${key}" đã tồn tại! Vui lòng chọn mã khác.`, 'warning');
    return;
  }

  if (id) {
    const idx = state._currentActivityRubric.findIndex(c => c.id === id);
    if (idx >= 0) {
      state._currentActivityRubric[idx] = {
        ...state._currentActivityRubric[idx],
        key,
        label,
        maxScore,
        description: desc
      };
    }
  } else {
    const newId = 'crit_' + Date.now().toString(36);
    state._currentActivityRubric.push({
      id: newId,
      key,
      label,
      maxScore,
      description: desc,
      order: state._currentActivityRubric.length + 1
    });
  }

  closeRubricCriterionModal();
  renderActivityRubricList();
};

window.renderActivityLetterOptions = function() {
  const container = document.getElementById('activity-scoring-letter-list');
  if (!container) return;
  const list = state._currentActivityLetterOptions || [];
  if (list.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-slate-400">Chưa có mức điểm chữ nào. Bấm "+ Thêm mức điểm".</div>';
    return;
  }
  container.innerHTML = list.map((opt, idx) => `
    <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
      <div class="flex items-center gap-2">
        <span class="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono text-xs">${opt.key}</span>
        <span class="font-bold text-slate-800 text-xs">${opt.label}</span>
        ${opt.description ? `<span class="text-[10px] text-slate-400">(${opt.description})</span>` : ''}
      </div>
      <div class="flex items-center gap-1.5 text-[11px]">
        <button type="button" onclick="editLetterOption('${opt.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
        <button type="button" onclick="deleteLetterOption('${opt.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
      </div>
    </div>
  `).join('');
};

window.openAddLetterOptionModal = function() {
  document.getElementById('letter-option-id').value = '';
  document.getElementById('letter-option-key').value = '';
  document.getElementById('letter-option-label').value = '';
  document.getElementById('letter-option-desc').value = '';
  document.getElementById('modal-letter-option-title').textContent = 'Thêm mức điểm chữ mới';
  document.getElementById('modal-add-letter-option')?.classList.remove('hidden');
};

window.closeLetterOptionModal = function() {
  document.getElementById('modal-add-letter-option')?.classList.add('hidden');
};

window.editLetterOption = function(id) {
  const opt = (state._currentActivityLetterOptions || []).find(o => o.id === id);
  if (!opt) return;
  document.getElementById('letter-option-id').value = opt.id;
  document.getElementById('letter-option-key').value = opt.key;
  document.getElementById('letter-option-label').value = opt.label;
  document.getElementById('letter-option-desc').value = opt.description || '';
  document.getElementById('modal-letter-option-title').textContent = 'Chỉnh sửa mức điểm chữ';
  document.getElementById('modal-add-letter-option')?.classList.remove('hidden');
};

window.deleteLetterOption = function(id) {
  state._currentActivityLetterOptions = (state._currentActivityLetterOptions || []).filter(o => o.id !== id);
  renderActivityLetterOptions();
};

window.saveLetterOption = function() {
  const id = document.getElementById('letter-option-id')?.value?.trim();
  const key = document.getElementById('letter-option-key')?.value?.trim();
  const label = document.getElementById('letter-option-label')?.value?.trim();
  const desc = document.getElementById('letter-option-desc')?.value?.trim() || '';

  if (!key || !label) {
    showToast('Vui lòng nhập đầy đủ Mã mức điểm và Nhãn hiển thị', 'warning');
    return;
  }

  state._currentActivityLetterOptions = state._currentActivityLetterOptions || [];
  if (id) {
    const idx = state._currentActivityLetterOptions.findIndex(o => o.id === id);
    if (idx >= 0) {
      state._currentActivityLetterOptions[idx] = { id, key, label, description: desc };
    }
  } else {
    const newId = 'opt_' + Date.now().toString(36);
    state._currentActivityLetterOptions.push({ id: newId, key, label, description: desc });
  }

  closeLetterOptionModal();
  renderActivityLetterOptions();
};

// 2. AUTHORIZATION & REQUIRED SCORERS HELPERS
export function checkCouncilAuthorization(round, act, council, user) {
  if (!round || !act || !council) return { authorized: false, reason: 'Không tìm thấy dữ liệu Hội đồng' };
  
  const actor = user || getEffectiveActor();

  // Admin always has full access
  if (actor.isAdmin) {
    return {
      authorized: true,
      role: 'admin',
      roleName: 'Quản trị viên',
      slotKey: null,
      canScore: true,
      isSecretary: true,
      isChair: true,
      isAdmin: true,
      canCalibrate: true,
      canFinalize: true
    };
  }

  if (!actor || !actor.email) {
    return { authorized: false, reason: 'Vui lòng đăng nhập để truy cập Hội đồng.' };
  }

  const userEmail = actor.email.toLowerCase().trim();
  const membersBySlot = council.membersBySlot || {};
  const slots = act.councilStructure?.slots || [];

  for (const s of slots) {
    const assigned = membersBySlot[s.key];
    if (assigned && assigned.memberEmail && assigned.memberEmail.toLowerCase().trim() === userEmail) {
      const isSec = (s.key === 'secretary' || s.label === 'Thư ký');
      const isChair = (s.key === 'chair' || s.label === 'Chủ tịch' || s.name === 'Chủ tịch Hội đồng');
      return {
        authorized: true,
        role: s.key,
        roleName: s.name || s.label || 'Thành viên Hội đồng',
        slotKey: s.key,
        canScore: true,
        isSecretary: isSec,
        isChair: isChair,
        isAdmin: false,
        canCalibrate: isChair,
        canFinalize: isChair
      };
    }
  }

  // Student is strictly denied
  return {
    authorized: false,
    reason: 'Bạn không phải thành viên của Hội đồng này.'
  };
}

export function getRequiredScorers(council, act) {
  const slots = act?.councilStructure?.slots || [];
  return slots.filter(s => s.type === 'mandatory');
}

export function getGuestScorers(council, act) {
  const slots = act?.councilStructure?.slots || [];
  return slots.filter(s => s.type === 'guest');
}

// 3. COUNCIL WORKSPACE OPEN & REAL-TIME LISTENER
window.openCouncilWorkspace = async function(roundId, activityId, councilId, autoSelectedStudentId = null) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!targetRound || !act || !council) {
    showToast('Không tìm thấy thông tin Hội đồng được yêu cầu.', 'error');
    return;
  }

  // AUTHORIZATION CHECK
  const authCheck = checkCouncilAuthorization(targetRound, act, council, getEffectiveActor());
  if (!authCheck.authorized) {
    showToast(authCheck.reason || 'Bạn không có quyền truy cập Hội đồng này.', 'error');
    return;
  }

  state.activeCouncilWorkspace = {
    roundId,
    activityId,
    councilId,
    auth: authCheck
  };

  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilScores = state.councilScores || {};

  // Load existing scores from round doc & subcollection
  await loadCouncilScores(roundId, activityId, councilId);

  // Setup initial selected student
  const assignments = act.councilStudentAssignments || [];
  const councilStudents = assignments
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const presentingStudent = councilStudents.find(a => a.presentationStatus === 'presenting');

  if (autoSelectedStudentId) {
    state.activeCouncilSelectedStudentId = autoSelectedStudentId;
  } else if (presentingStudent) {
    state.activeCouncilSelectedStudentId = presentingStudent.studentId;
  } else if (councilStudents.length > 0) {
    state.activeCouncilSelectedStudentId = councilStudents[0].studentId;
  } else {
    state.activeCouncilSelectedStudentId = null;
  }

  // Render UI
  renderCouncilWorkspaceFull();

  // Show modal
  document.getElementById('modal-council-workspace')?.classList.remove('hidden');

  // Real-time Firestore Listener
  setupCouncilRealtimeSync(roundId, activityId, councilId);
};

window.closeCouncilWorkspace = function() {
  if (state.activeCouncilUnsubscribe) {
    try { state.activeCouncilUnsubscribe(); } catch (e) {}
    state.activeCouncilUnsubscribe = null;
  }
  document.getElementById('modal-council-workspace')?.classList.add('hidden');
};

function setupCouncilRealtimeSync(roundId, activityId, councilId) {
  if (state.activeCouncilUnsubscribe) {
    state.activeCouncilUnsubscribe();
    state.activeCouncilUnsubscribe = null;
  }

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    state.activeCouncilUnsubscribe = onSnapshot(roundRef, (snap) => {
      if (!snap.exists()) return;
      const updatedData = { id: snap.id, ...snap.data() };
      
      // Update in state.rounds
      const rIdx = (state.rounds || []).findIndex(r => r.id === roundId);
      if (rIdx >= 0) state.rounds[rIdx] = updatedData;

      // Update nested scores if present
      if (updatedData.councilScores) {
        state.councilScores = { ...(state.councilScores || {}), ...updatedData.councilScores };
      }

      // Re-render Council Workspace WITHOUT changing selected student!
      renderCouncilWorkspacePartialSync();
    }, (err) => {
      console.warn('Realtime council listener notice:', err);
    });
  } catch (err) {
    console.warn('Firestore onSnapshot setup notice:', err);
  }
}

async function loadCouncilScores(roundId, activityId, councilId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (targetRound?.councilScores) {
    state.councilScores = { ...(state.councilScores || {}), ...targetRound.councilScores };
  }

  // Best effort query subcollection reviewDecisions
  try {
    const q = query(
      collection(db, 'graduationRounds', roundId, 'reviewDecisions'),
      where('councilId', '==', councilId)
    );
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      snap.docs.forEach(d => {
        const data = d.data();
        const k = `${data.activityId}_${data.councilId}_${data.studentId}_${data.scorerId}`;
        state.councilScores[k] = data;
      });
    }
  } catch (e) {
    // Graceful fallback to nested or memory
  }
}

// 4. WORKSPACE RENDERING METHODS
function renderCouncilWorkspaceFull() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!targetRound || !act || !council) return;

  // Header Elements
  document.getElementById('cws-council-name').textContent = council.name;
  document.getElementById('cws-council-meta').textContent = `📍 Phòng: ${council.room || 'Đang cập nhật'} • 📅 ${council.date || '--'} (${council.startTime || '--'} – ${council.endTime || '--'})`;

  // Status Badge (v2.0.0-beta.1: preparing -> active -> ended -> finalized)
  const statusBadge = document.getElementById('cws-council-status-badge');
  if (statusBadge) {
    const cStat = council.status || 'preparing';
    if (cStat === 'active' || cStat === 'ongoing') {
      statusBadge.className = 'badge bg-emerald-500 text-white font-black animate-pulse text-[10px]';
      statusBadge.textContent = '● Đang diễn ra';
    } else if (cStat === 'ended') {
      statusBadge.className = 'badge bg-amber-500 text-white font-bold text-[10px]';
      statusBadge.textContent = '⏸ Đã kết thúc (Chờ chốt)';
    } else if (cStat === 'finalized' || cStat === 'completed') {
      statusBadge.className = 'badge bg-slate-800 text-white font-bold text-[10px]';
      statusBadge.textContent = '🔒 Đã chốt điểm';
    } else {
      statusBadge.className = 'badge bg-amber-100 text-amber-800 font-bold text-[10px]';
      statusBadge.textContent = 'Chuẩn bị';
    }
  }

  // Role Badge
  const roleBadge = document.getElementById('cws-my-role-badge');
  if (roleBadge) {
    roleBadge.textContent = auth.roleName || 'Thành viên';
  }

  // Session Controls (Secretary / Chair / Admin)
  const sessionControls = document.getElementById('cws-session-controls');
  if (sessionControls) {
    if (auth.isAdmin || auth.isSecretary || auth.isChair) {
      sessionControls.classList.remove('hidden');
      sessionControls.classList.add('flex');
      const startBtn = document.getElementById('btn-start-council-session');
      const endBtn = document.getElementById('btn-end-council-session');
      const finBtn = document.getElementById('btn-finalize-council-session');
      const reopenBtn = document.getElementById('btn-reopen-council-session');
      const cStat = council.status || 'preparing';

      if (startBtn) startBtn.classList.toggle('hidden', cStat !== 'preparing');
      if (endBtn) endBtn.classList.toggle('hidden', cStat !== 'active' && cStat !== 'ongoing');
      if (finBtn) finBtn.classList.toggle('hidden', cStat !== 'ended' || (!auth.isAdmin && !auth.isChair));
      if (reopenBtn) reopenBtn.classList.toggle('hidden', cStat !== 'finalized' || !auth.isAdmin);
    } else {
      sessionControls.classList.add('hidden');
    }
  }

  renderCouncilStudentList();
  renderCouncilSelectedStudentDetails();
  renderPostCouncilSection();
  renderAuditLogsSection();
}

function renderCouncilWorkspacePartialSync() {
  // Update student list badges & counts
  renderCouncilStudentList();

  // Update presenting banner
  renderPresentingBanner();

  // Update secretary controls for current student
  renderSecretaryControls();

  // Update scorers completion progress & admin monitor
  renderScorersProgress();
  renderAdminMonitor();

  // Update post-council calibration and audit logs
  renderPostCouncilSection();
  renderAuditLogsSection();
}

function renderCouncilStudentList() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!targetRound || !act) return;

  const assignments = act.councilStudentAssignments || [];
  const councilStudents = assignments
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const countBadge = document.getElementById('cws-student-count-badge');
  if (countBadge) countBadge.textContent = councilStudents.length;

  const presentingAsgn = councilStudents.find(a => a.presentationStatus === 'presenting');
  const presentingInd = document.getElementById('cws-presenting-indicator');
  if (presentingInd) {
    if (presentingAsgn) {
      presentingInd.classList.remove('hidden');
      presentingInd.textContent = `● #${presentingAsgn.order} đang trình bày`;
    } else {
      presentingInd.classList.add('hidden');
    }
  }

  const container = document.getElementById('cws-students-list');
  if (!container) return;

  if (councilStudents.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-slate-400">Hội đồng này chưa có sinh viên nào.</div>';
    return;
  }

  const myScorerId = state.user?.uid || state.user?.email;
  const scoringEnabled = Boolean(act.scoringConfig?.enabled);

  container.innerHTML = councilStudents.map((asgn) => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const isSelected = (sid === state.activeCouncilSelectedStudentId);
    const isPresenting = (asgn.presentationStatus === 'presenting');
    const isPresented = (asgn.presentationStatus === 'presented');

    // Presentation badge
    let presBadge = '<span class="text-[10px] text-slate-400">Chờ</span>';
    if (isPresenting) {
      presBadge = '<span class="badge bg-emerald-500 text-white font-black text-[9px] animate-pulse">🔴 Đang trình bày</span>';
    } else if (isPresented) {
      presBadge = '<span class="badge bg-indigo-100 text-indigo-800 font-bold text-[9px]">✓ Đã xong</span>';
    }

    // Scoring status badge for this member
    let scoreBadge = '';
    if (scoringEnabled) {
      const scoreKey = `${activityId}_${councilId}_${sid}_${myScorerId}`;
      const myScore = state.councilScores?.[scoreKey];
      const hasDraft = Boolean(state.councilLocalDrafts?.[sid]);

      if (myScore?.status === 'completed') {
        scoreBadge = '<span class="text-[10px] text-emerald-700 font-bold">✓ Bạn đã chấm</span>';
      } else if (myScore?.status === 'draft' || hasDraft) {
        scoreBadge = '<span class="text-[10px] text-amber-600 font-bold">● Đã lưu tạm</span>';
      } else {
        scoreBadge = '<span class="text-[10px] text-slate-400">Chưa chấm</span>';
      }
    }

    return `
      <div onclick="selectCouncilStudent('${sid}')" class="p-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}">
        <div class="flex items-center justify-between gap-1">
          <span class="font-mono font-bold text-xs ${isSelected ? 'text-indigo-900' : 'text-slate-600'}">#${asgn.order || '--'}</span>
          ${presBadge}
        </div>
        <div class="font-bold text-slate-900 text-xs truncate mt-0.5">${sName}</div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-0.5">
          <span>${sid}</span>
          ${scoreBadge}
        </div>
      </div>
    `;
  }).join('');
}

window.filterCouncilWorkspaceStudents = function(q) {
  const query = String(q || '').toLowerCase().trim();
  const cards = document.querySelectorAll('#cws-students-list > div');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.classList.toggle('hidden', query.length > 0 && !text.includes(query));
  });
};

// 5. SELECT STUDENT & FLEXIBLE NAVIGATION (CRITICAL BUSINESS RULE)
window.selectCouncilStudent = function(studentId) {
  // PRESERVE UNSAVED INPUTS from current student (including rubric components)
  const oldSid = state.activeCouncilSelectedStudentId;
  if (oldSid && oldSid !== studentId) {
    const valInput = document.getElementById('cws-score-input-numeric');
    const letInput = document.getElementById('cws-score-input-letter');
    const commentInput = document.getElementById('cws-score-comment');
    const rubricInputs = document.querySelectorAll('input[data-crit-key]');

    let components = null;
    if (rubricInputs.length > 0) {
      components = {};
      rubricInputs.forEach(inp => {
        const k = inp.dataset.critKey;
        const v = inp.value;
        if (v !== '' && !isNaN(Number(v))) {
          components[k] = Number(v);
        }
      });
    }

    const currentVal = valInput ? valInput.value : (letInput ? letInput.value : state.councilLocalDrafts?.[oldSid]?.value);
    const currentComm = commentInput ? commentInput.value : (state.councilLocalDrafts?.[oldSid]?.comment || '');

    if (currentVal !== undefined && currentVal !== '' || currentComm || (components && Object.keys(components).length > 0)) {
      state.councilLocalDrafts = state.councilLocalDrafts || {};
      state.councilLocalDrafts[oldSid] = {
        value: currentVal,
        comment: currentComm,
        components: components || state.councilLocalDrafts?.[oldSid]?.components
      };
    }
  }

  // SET NEW SELECTED STUDENT (NEVER changes current presenting student)
  state.activeCouncilSelectedStudentId = studentId;

  renderCouncilStudentList();
  renderCouncilSelectedStudentDetails();
};

window.goToCurrentPresentingStudent = function() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = act?.councilStudentAssignments || [];
  const pres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');
  if (pres) {
    selectCouncilStudent(pres.studentId);
  } else {
    showToast('Hội đồng hiện chưa có sinh viên nào đang trình bày.', 'info');
  }
};

// 6. RENDER SELECTED STUDENT DETAILS & SCORING
function renderCouncilSelectedStudentDetails() {
  const sid = state.activeCouncilSelectedStudentId;
  const card = document.getElementById('cws-selected-student-card');
  if (!card) return;

  if (!sid) {
    card.innerHTML = '<div class="p-8 text-center text-slate-400">Vui lòng chọn một sinh viên trong danh sách để xem thông tin và chấm điểm.</div>';
    document.getElementById('cws-secretary-actions')?.classList.add('hidden');
    document.getElementById('cws-scoring-section')?.classList.add('hidden');
    document.getElementById('cws-scorers-progress-section')?.classList.add('hidden');
    document.getElementById('cws-admin-monitor-section')?.classList.add('hidden');
    return;
  }

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const sObj = findStudentInRound(sid);
  const asgn = (act?.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);

  const sName = sObj?.fullName || sObj?.studentName || sid;
  const sTopic = sObj?.topicTitle || '--';

  // Format Official Supervisors (using officialSupervisors helper with legacy fallback)
  const supervisorsHtml = formatStudentSupervisorsForDisplay(sObj);

  // Presenting status badge
  const isPresenting = (asgn?.presentationStatus === 'presenting');
  const isPresented = (asgn?.presentationStatus === 'presented');
  let statusBadgeHtml = '<span class="badge bg-slate-100 text-slate-600 font-bold text-xs">Chờ trình bày</span>';
  if (isPresenting) {
    statusBadgeHtml = '<span class="badge bg-emerald-500 text-white font-black text-xs animate-pulse">🔴 ĐANG TRÌNH BÀY</span>';
  } else if (isPresented) {
    statusBadgeHtml = '<span class="badge bg-indigo-100 text-indigo-800 font-bold text-xs">✓ Đã trình bày</span>';
  }

  card.innerHTML = `
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono font-black text-xs px-2 py-0.5 bg-white border border-slate-300 rounded-lg">#${asgn?.order || '--'}</span>
          <h2 class="font-black text-base sm:text-lg text-slate-900">${sName}</h2>
          ${statusBadgeHtml}
        </div>
        <p class="font-mono text-xs text-slate-500 mt-0.5 font-bold">MSSV: ${sid}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
      <div>
        <span class="text-[11px] font-bold text-slate-400 block mb-0.5">TÊN ĐỀ TÀI:</span>
        <p class="font-semibold text-slate-800 leading-snug">${sTopic}</p>
      </div>
      <div>
        <span class="text-[11px] font-bold text-slate-400 block mb-0.5">GIẢNG VIÊN HƯỚNG DẪN:</span>
        <div class="font-semibold text-slate-800">${supervisorsHtml}</div>
      </div>
    </div>

    ${asgn?.presentationStatus === 'presented' ? (() => {
      const prelim = getPreliminarySummary(sid, roundId);
      if (prelim && prelim.average !== null) {
        return `
          <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs mt-2">
            <div class="flex items-center gap-2">
              <span class="text-base">🎯</span>
              <div>
                <span class="font-bold text-amber-950">Điểm Sơ khảo TB:</span>
                <span class="font-black font-mono text-sm text-amber-900 ml-1.5">${prelim.average.toFixed(2)}</span>
                <span class="text-[10px] text-amber-700 ml-1 font-semibold">(${prelim.count} lượt chấm hợp lệ)</span>
              </div>
            </div>
            <span class="text-[10px] text-slate-400 italic">Hiển thị sau khi hoàn tất trình bày</span>
          </div>
        `;
      }
      return '';
    })() : ''}
  `;

  // Update presenting banner
  renderPresentingBanner();

  // Render Secretary Actions
  renderSecretaryControls();

  // Render Scoring Section
  renderScoringSection();

  // Render Progress
  renderScorersProgress();

  // Render Admin Monitor
  renderAdminMonitor();
}

function formatStudentSupervisorsForDisplay(reg) {
  if (!reg) return 'GVHD: Chưa phân công';
  const officials = getOfficialSupervisors(reg);
  if (!officials || officials.length === 0) {
    const legacy = reg.acceptedSupervisorName || reg.supervisorName || reg.finalSupervisorName;
    return legacy ? `GVHD: ${legacy}` : 'GVHD: Chưa phân công';
  }
  if (officials.length === 1) {
    return `GVHD: ${officials[0].supervisorName || 'Giảng viên'}`;
  }
  return officials.map(s => {
    const role = (s.role === 'primary') ? 'GVHD chính' : 'GVHD hỗ trợ';
    return `<div>${s.supervisorName || 'Giảng viên'} <span class="text-indigo-600 font-mono text-[10px]">(${role})</span></div>`;
  }).join('');
}

// 7. BANNER: CURRENT PRESENTING STUDENT
function renderPresentingBanner() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = act?.councilStudentAssignments || [];

  const pres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');
  const banner = document.getElementById('cws-presenting-banner');
  const bannerText = document.getElementById('cws-presenting-banner-text');
  if (!banner) return;

  const currentSid = state.activeCouncilSelectedStudentId;

  if (pres && pres.studentId !== currentSid) {
    const sObj = findStudentInRound(pres.studentId);
    const sName = sObj?.fullName || sObj?.studentName || pres.studentId;
    if (bannerText) bannerText.textContent = `#${pres.order || ''} ${sName} (${pres.studentId})`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// 8. SECRETARY PRESENTATION CONTROLS
function renderSecretaryControls() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const container = document.getElementById('cws-secretary-actions');
  const btnWrap = document.getElementById('cws-secretary-buttons');
  if (!container || !btnWrap) return;

  // Only Secretary or Admin
  if (!auth.isAdmin && !auth.isSecretary) {
    container.classList.add('hidden');
    return;
  }

  const sid = state.activeCouncilSelectedStudentId;
  const asgn = (act?.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);
  if (!asgn) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  if (asgn.presentationStatus === 'presenting') {
    btnWrap.innerHTML = `
      <button type="button" onclick="finishStudentPresentation('${sid}')" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1">
        <span>✓ Hoàn tất lượt</span>
      </button>
      <button type="button" onclick="resetStudentPresentation('${sid}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold" title="Đặt lại trạng thái Chờ">
        ↺
      </button>
    `;
  } else {
    btnWrap.innerHTML = `
      <button type="button" onclick="startStudentPresentation('${sid}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1">
        <span>▶ Bắt đầu trình bày</span>
      </button>
      ${asgn.presentationStatus === 'presented' ? `
        <button type="button" onclick="resetStudentPresentation('${sid}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold" title="Đặt lại trạng thái Chờ">
          ↺ Đặt lại Chờ
        </button>
      ` : ''}
    `;
  }
}

window.startStudentPresentation = async function(targetSid) {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const assignments = act.councilStudentAssignments || [];
  const currentPres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');

  if (currentPres && currentPres.studentId !== targetSid) {
    const curObj = findStudentInRound(currentPres.studentId);
    const targetObj = findStudentInRound(targetSid);
    const curName = curObj?.fullName || curObj?.studentName || currentPres.studentId;
    const targetName = targetObj?.fullName || targetObj?.studentName || targetSid;

    const confirmed = await showConfirm(
      'Chuyển lượt trình bày',
      `${curName} đang trình bày. Bạn có muốn kết thúc lượt của sinh viên này và chuyển sang ${targetName}?`,
      { confirmText: 'Đồng ý chuyển', danger: false }
    );
    if (!confirmed) return;

    currentPres.presentationStatus = 'presented';
  }

  const targetAsgn = assignments.find(a => a.councilId === councilId && a.studentId === targetSid);
  if (targetAsgn) {
    targetAsgn.presentationStatus = 'presenting';
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspacePartialSync();
  renderSecretaryControls();
  showToast(`Đã bắt đầu lượt trình bày của sinh viên #${targetAsgn?.order || ''}`, 'success');
};

window.finishStudentPresentation = async function(sid) {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const asgn = (act.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);
  if (asgn) {
    asgn.presentationStatus = 'presented';
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspacePartialSync();
  renderSecretaryControls();
  showToast('✓ Đã hoàn tất lượt trình bày của sinh viên.', 'info');
};

window.resetStudentPresentation = async function(sid) {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const asgn = (act.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);
  if (asgn) {
    asgn.presentationStatus = 'waiting';
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspacePartialSync();
  renderSecretaryControls();
};

// 9. COUNCIL SESSION CONTROLS (START / END)
window.startCouncilSession = async function() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  council.status = 'active';
  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`Hội đồng "${council.name}" đã bắt đầu làm việc!`, 'success');
};

window.endCouncilSession = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền kết thúc buổi làm việc của Hội đồng!', 'error');
    return;
  }

  // Check required scorers completion (CT, UV, TK)
  const reqSlots = getRequiredScorers(council, act);
  const assignments = (act?.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  
  let uncompletedCount = 0;
  for (const asgn of assignments) {
    for (const s of reqSlots) {
      const assignedMem = council.membersBySlot?.[s.key];
      if (assignedMem && (assignedMem.memberId || assignedMem.memberEmail)) {
        const scorerId = assignedMem.memberId || assignedMem.memberEmail;
        const k = `${activityId}_${councilId}_${asgn.studentId}_${scorerId}`;
        const sc = state.councilScores?.[k];
        if (sc?.status !== 'completed') {
          uncompletedCount++;
        }
      } else {
        uncompletedCount++;
      }
    }
  }

  let confirmMsg = `Xác nhận kết thúc buổi làm việc của Hội đồng "${council.name}"? Sau khi kết thúc, Chủ tịch Hội đồng sẽ xem được toàn bộ điểm của các thành viên để tiến hành hiệu chỉnh điểm sau hội đồng.`;
  if (uncompletedCount > 0) {
    confirmMsg = `Còn ${uncompletedCount} lượt chấm bắt buộc (Chủ tịch, Ủy viên, Thư ký) chưa hoàn tất! Bạn có chắc chắn muốn kết thúc Hội đồng không?`;
  }

  const confirmed = await showConfirm('Kết thúc Hội đồng', confirmMsg, { confirmText: 'Kết thúc Hội đồng', danger: uncompletedCount > 0 });
  if (!confirmed) return;

  council.status = 'ended';
  council.endedAt = new Date().toISOString();
  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`Đã kết thúc phiên làm việc của Hội đồng "${council.name}".`, 'info');
};

// 10. SCORING CARD RENDERING & ACTIONS
function renderScoringSection() {
  const container = document.getElementById('cws-scoring-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!act?.scoringConfig?.enabled) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const sid = state.activeCouncilSelectedStudentId;
  const myScorerId = state.user?.uid || state.user?.email;
  const scoreKey = `${activityId}_${councilId}_${sid}_${myScorerId}`;
  const savedScore = state.councilScores?.[scoreKey];
  const draft = state.councilLocalDrafts?.[sid];

  // Resolve current working values
  const currentVal = draft?.value !== undefined ? draft.value : (savedScore?.value ?? '');
  const currentComment = draft?.comment !== undefined ? draft.comment : (savedScore?.comment ?? '');
  const isCompleted = (savedScore?.status === 'completed' && !draft);
  const councilEnded = (council.status === 'ended' || council.status === 'completed');

  const mode = act.scoringConfig.mode || 'numeric';

  let inputHtml = '';
  if (mode === 'letter') {
    const opts = act.scoringConfig.letterOptions || [];
    inputHtml = `
      <div>
        <label class="font-bold text-slate-800 text-xs block mb-1.5">Mức điểm / Đánh giá (*):</label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          ${opts.map(o => {
            const isSelected = String(currentVal) === String(o.key);
            return `
              <button type="button" ${isCompleted ? 'disabled' : ''} onclick="onSelectLetterScore('${o.key}')" class="p-2.5 rounded-xl border text-left transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500 font-black text-emerald-950' : 'bg-white border-slate-200 hover:border-slate-300 font-semibold text-slate-700'} ${isCompleted ? 'opacity-80 cursor-not-allowed' : ''}">
                <span class="text-sm block font-mono font-black text-emerald-700">${o.key}</span>
                <span class="text-[11px] block mt-0.5">${o.label}</span>
              </button>
            `;
          }).join('')}
        </div>
        <input type="hidden" id="cws-score-input-letter" value="${currentVal}">
      </div>
    `;
  } else if (mode === 'defense_rubric') {
    const rubric = act.scoringConfig.rubric || [
      { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1 },
      { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2 },
      { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3 },
      { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4 }
    ];
    const components = (draft?.components !== undefined)
      ? draft.components
      : (savedScore?.components || {});

    let compSum = 0;
    const compRows = rubric.map(crit => {
      const cVal = components[crit.key] !== undefined ? components[crit.key] : '';
      if (cVal !== '' && !isNaN(Number(cVal))) {
        compSum += Number(cVal);
      }
      return `
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div class="flex items-center justify-between">
            <label class="font-bold text-slate-800 text-xs">${crit.label} <span class="text-indigo-600 font-mono text-[11px]">(tối đa ${crit.maxScore}đ)</span></label>
            <div class="flex items-center gap-1.5">
              <input type="number" id="cws-rubric-input-${crit.key}" data-crit-key="${crit.key}" data-max-score="${crit.maxScore}" value="${cVal}" min="0" max="${crit.maxScore}" step="0.1" ${isCompleted ? 'disabled' : ''} oninput="onRubricComponentChange('${crit.key}', this.value)" placeholder="0 – ${crit.maxScore}" class="w-24 p-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-right ${isCompleted ? 'bg-slate-100' : 'bg-white focus:ring-2 focus:ring-indigo-500'}">
              <span class="text-[11px] text-slate-500 font-mono font-bold">/${crit.maxScore}</span>
            </div>
          </div>
          ${crit.description ? `<p class="text-[10px] text-slate-500">${crit.description}</p>` : ''}
        </div>
      `;
    }).join('');

    const totalValNum = currentVal !== '' && !isNaN(Number(currentVal)) ? Number(currentVal) : null;
    const hasMismatch = (totalValNum !== null && Math.abs(compSum - totalValNum) >= 0.000001);

    inputHtml = `
      <div class="space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <label class="font-bold text-slate-800 text-xs">Chấm điểm theo Rubric Bảo vệ (Defense Rubric):</label>
          <button type="button" ${isCompleted ? 'disabled' : ''} onclick="syncRubricSumToTotal()" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 transition-colors">
            ∑ Cộng tiêu chí vào Điểm tổng
          </button>
        </div>

        <div class="space-y-2">
          ${compRows}
        </div>

        <div class="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
          <div>
            <span class="font-bold text-indigo-950 text-xs block">Điểm Tổng kết Bảo vệ (*):</span>
            <span class="text-[10px] text-indigo-700">Tổng các tiêu chí: <strong id="cws-rubric-comp-sum">${compSum.toFixed(2)}</strong></span>
          </div>
          <div class="flex items-center gap-2">
            <input type="number" id="cws-score-input-numeric" value="${currentVal}" min="0" max="10" step="0.1" oninput="onScoreInputChange(this.value)" ${isCompleted ? 'disabled' : ''} placeholder="0 – 10" class="w-28 p-2 border border-slate-300 rounded-xl font-mono text-sm font-black text-slate-900 text-right ${isCompleted ? 'bg-slate-100' : 'bg-white focus:ring-2 focus:ring-blue-500'}">
            <span class="text-xs text-slate-500 font-semibold">/ 10 điểm</span>
          </div>
        </div>

        ${hasMismatch ? `
          <div id="cws-rubric-mismatch-warning" class="p-2.5 bg-amber-100/70 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>Tổng tiêu chí (${compSum.toFixed(2)}) chưa khớp với Điểm tổng (${totalValNum})! Vui lòng bấm "Cộng tiêu chí vào Điểm tổng" hoặc điều chỉnh trước khi hoàn tất.</span>
          </div>
        ` : ''}
      </div>
    `;
  } else {
    const nCfg = act.scoringConfig.numericConfig || { min: 0, max: 10, step: 0.1 };
    inputHtml = `
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="font-bold text-slate-800 text-xs">Điểm đánh giá (*) [Thang điểm ${nCfg.min} – ${nCfg.max}]:</label>
          <span class="text-[11px] text-slate-400 font-mono">Bước điểm: ${nCfg.step}</span>
        </div>
        <div class="flex items-center gap-3">
          <input type="number" id="cws-score-input-numeric" value="${currentVal}" min="${nCfg.min}" max="${nCfg.max}" step="${nCfg.step}" oninput="onScoreInputChange(this.value)" ${isCompleted ? 'disabled' : ''} placeholder="${nCfg.min} – ${nCfg.max}" class="w-36 p-2 border border-slate-300 rounded-xl font-mono text-sm font-black text-slate-900 ${isCompleted ? 'bg-slate-100' : 'bg-white focus:ring-2 focus:ring-blue-500'}">
          <span class="text-xs text-slate-500 font-semibold">/ ${nCfg.max} điểm</span>
        </div>
      </div>
    `;
  }

  // Action buttons
  let actionsHtml = '';
  if (isCompleted) {
    actionsHtml = `
      <div class="flex items-center justify-between gap-2 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
        <span class="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
          <span>✓</span> Bạn đã hoàn tất chấm lúc ${fmt24h(savedScore.completedAt || savedScore.updatedAt)}
        </span>
        ${!councilEnded ? `
          <button type="button" onclick="reopenCurrentScore()" class="px-3 py-1.5 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold shadow-xs">
            ✏️ Mở lại để sửa
          </button>
        ` : ''}
      </div>
    `;
  } else {
    actionsHtml = `
      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <span id="cws-score-draft-time" class="text-[11px] text-slate-400 font-mono">
          ${savedScore?.status === 'draft' ? `Đã lưu tạm lúc ${fmt24h(savedScore.updatedAt)}` : ''}
        </span>
        <div class="flex items-center gap-2">
          <button type="button" onclick="saveCurrentScore(false)" class="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors">
            💾 Lưu tạm
          </button>
          <button type="button" onclick="saveCurrentScore(true)" class="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors">
            ✓ Hoàn tất chấm
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h3 class="font-black text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
        <span>📝</span> PHIẾU CHẤM ĐIỂM CỦA BẠN
      </h3>
      <span class="badge bg-slate-100 text-slate-600 font-bold text-[10px]">
        Vai trò: ${auth.roleName}
      </span>
    </div>

    ${inputHtml}

    <div>
      <label class="font-bold text-slate-800 text-xs block mb-1">Nhận xét chuyên môn (không bắt buộc):</label>
      <textarea id="cws-score-comment" rows="3" ${isCompleted ? 'disabled' : ''} oninput="onScoreCommentChange(this.value)" placeholder="Góp ý chuyên môn, ưu khuyết điểm cho sinh viên..." class="w-full p-2.5 border border-slate-300 rounded-xl text-xs ${isCompleted ? 'bg-slate-100 text-slate-600' : 'bg-white focus:ring-2 focus:ring-blue-500'}">${escapeHtml(currentComment)}</textarea>
    </div>

    ${actionsHtml}

    <p class="text-[10px] text-slate-400 italic">🔒 Điểm và nhận xét của bạn được bảo mật riêng tư, các thành viên khác trong Hội đồng và Sinh viên không thể xem chi tiết điểm này.</p>
  `;
}

window.onSelectLetterScore = function(key) {
  const input = document.getElementById('cws-score-input-letter');
  if (input) input.value = key;
  onScoreInputChange(key);
  renderScoringSection();
};

window.onScoreInputChange = function(val) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].value = val;
};

window.onScoreCommentChange = function(comm) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].comment = comm;
};

// 11. SAVE & REOPEN SCORE (CONCURRENCY & PRIVACY)
window.saveCurrentScore = async function(isCompleted) {
  if (!checkImpersonationWriteGuard('Lưu điểm thành viên hội đồng')) return;

  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!act || !council) return;

  const mode = act.scoringConfig?.mode || 'numeric';
  let val = '';
  let components = {};

  if (mode === 'letter') {
    val = document.getElementById('cws-score-input-letter')?.value || state.councilLocalDrafts?.[sid]?.value || '';
  } else if (mode === 'defense_rubric') {
    val = document.getElementById('cws-score-input-numeric')?.value ?? state.councilLocalDrafts?.[sid]?.value ?? '';
    const rubric = act.scoringConfig.rubric || [
      { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4 },
      { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3 },
      { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2 },
      { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1 }
    ];

    // Read current components
    components = state.councilLocalDrafts?.[sid]?.components || state.councilScores?.[scoreKey]?.components || {};
    rubric.forEach(crit => {
      const inp = document.getElementById(`cws-rubric-input-${crit.key}`);
      if (inp && inp.value !== '' && !isNaN(Number(inp.value))) {
        components[crit.key] = Number(inp.value);
      }
    });

    if (isCompleted) {
      if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
        showToast('Vui lòng nhập điểm tổng trước khi hoàn tất chấm!', 'warning');
        return;
      }
      const totalNum = Number(val);
      if (totalNum < 0 || totalNum > 10) {
        showToast('Điểm tổng kết bảo vệ phải từ 0 đến 10!', 'warning');
        return;
      }

      let compSum = 0;
      for (const crit of rubric) {
        const cVal = components[crit.key];
        if (cVal === undefined || cVal === null || cVal === '' || isNaN(Number(cVal))) {
          showToast(`Vui lòng chấm tiêu chí "${crit.label}"!`, 'warning');
          return;
        }
        const nVal = Number(cVal);
        if (nVal < 0 || nVal > crit.maxScore) {
          showToast(`Tiêu chí "${crit.label}" phải từ 0 đến ${crit.maxScore}!`, 'warning');
          return;
        }
        compSum += nVal;
      }

      if (Math.abs(compSum - totalNum) >= 0.000001) {
        showToast(`Tổng tiêu chí (${compSum.toFixed(2)}) chưa khớp với Điểm tổng (${totalNum})! Vui lòng bấm "Cộng tiêu chí vào Điểm tổng".`, 'warning');
        return;
      }
    }
  } else {
    val = document.getElementById('cws-score-input-numeric')?.value || state.councilLocalDrafts?.[sid]?.value || '';
  }
  const comment = document.getElementById('cws-score-comment')?.value || state.councilLocalDrafts?.[sid]?.comment || '';

  if (isCompleted) {
    if (val === '' || val === null || val === undefined) {
      showToast('Vui lòng chọn hoặc nhập điểm trước khi hoàn tất chấm!', 'warning');
      return;
    }
    if (mode === 'numeric') {
      const num = parseFloat(val);
      const min = act.scoringConfig.numericConfig?.min ?? 0;
      const max = act.scoringConfig.numericConfig?.max ?? 10;
      if (isNaN(num) || num < min || num > max) {
        showToast(`Điểm phải nằm trong thang điểm từ ${min} đến ${max}!`, 'warning');
        return;
      }
    }

    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const confirmed = await showConfirm(
      'Xác nhận hoàn tất chấm',
      `Xác nhận hoàn tất chấm sinh viên "${sName}" (${sid}) với kết quả: ${val}?`,
      { confirmText: 'Hoàn tất chấm', danger: false }
    );
    if (!confirmed) return;
  }

  const scorerId = state.user?.uid || state.user?.email;
  const scorerEmail = (state.user?.email || '').toLowerCase().trim();
  const scorerName = state.user?.displayName || auth.roleName || 'Thành viên Hội đồng';
  const scoreKey = `${activityId}_${councilId}_${sid}_${scorerId}`;

  const existing = state.councilScores?.[scoreKey] || {};
  const scoreRecord = {
    activityId,
    councilId,
    studentId: sid,
    scorerId,
    scorerEmail,
    scorerName,
    decidedBy: scorerEmail,
    supervisorEmail: scorerEmail,
    slotKey: auth.slotKey || 'admin',
    role: auth.role || 'member',
    mode,
    value: (mode === 'numeric' || mode === 'defense_rubric') ? parseFloat(val) : String(val),
    components: mode === 'defense_rubric' ? components : undefined,
    comment: String(comment || '').trim(),
    status: isCompleted ? 'completed' : 'draft',
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: isCompleted ? (existing.completedAt || new Date().toISOString()) : null
  };

  // 1. In-memory update
  state.councilScores[scoreKey] = scoreRecord;
  delete state.councilLocalDrafts[sid];

  // 2. Persist to Firestore: Concurrency-safe atomic key update
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    
    // Best-effort subcollection write (authorized for both admin and staff under reviewDecisions)
    try {
      const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', scoreKey);
      await setDoc(decRef, scoreRecord, { merge: true }).catch(() => {});
    } catch (subErr) {}

    // Atomic dot-notation update on graduationRounds document (preserves other scorers)
    if (state.isAdmin) {
      await updateDoc(roundRef, {
        [`councilScores.${scoreKey}`]: scoreRecord,
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('Persist score notice:', err);
  }

  // Refresh Views
  renderCouncilStudentList();
  renderScoringSection();
  renderScorersProgress();
  renderAdminMonitor();

  const sObj = findStudentInRound(sid);
  const sName = sObj?.fullName || sObj?.studentName || sid;
  if (isCompleted) {
    showToast(`✓ Đã hoàn tất chấm điểm sinh viên ${sName}!`, 'success');
  } else {
    showToast(`Đã lưu tạm điểm cho sinh viên ${sName}.`, 'info');
  }
};

window.reopenCurrentScore = async function() {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const scorerId = state.user?.uid || state.user?.email;
  const scoreKey = `${activityId}_${councilId}_${sid}_${scorerId}`;

  const existing = state.councilScores?.[scoreKey];
  if (!existing) return;

  existing.status = 'draft';
  existing.updatedAt = new Date().toISOString();

  try {
    const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', scoreKey);
    await setDoc(decRef, existing, { merge: true }).catch(() => {});
    if (state.isAdmin) {
      const roundRef = doc(db, 'graduationRounds', roundId);
      await updateDoc(roundRef, {
        [`councilScores.${scoreKey}`]: existing,
        updatedAt: serverTimestamp()
      });
    }
  } catch (e) {}

  renderCouncilStudentList();
  renderScoringSection();
  renderScorersProgress();
  renderAdminMonitor();
  showToast('Đã mở lại phiếu chấm. Bạn có thể chỉnh sửa và hoàn tất lại.', 'info');
};

// 12. PROGRESS OF SCORERS IN COUNCIL (PRIVACY PRESERVED)
function renderScorersProgress() {
  const container = document.getElementById('cws-scorers-progress-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  const sid = state.activeCouncilSelectedStudentId;
  if (!act?.scoringConfig?.enabled || !sid || !council) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const slots = act.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};
  const myUserId = state.user?.uid || state.user?.email;

  const reqSlots = getRequiredScorers(council, act);
  const guestSlots = getGuestScorers(council, act);

  let reqCompleted = 0;
  let reqTotal = 0;
  let guestCompleted = 0;
  let guestTotal = 0;

  const itemsHtml = slots.map(s => {
    const assigned = membersBySlot[s.key];
    const isAssigned = Boolean(assigned && (assigned.memberId || assigned.memberName));
    const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
    const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
    const score = scoreKey ? state.councilScores?.[scoreKey] : null;

    const isMandatory = (s.type === 'mandatory');
    if (isMandatory && isAssigned) {
      reqTotal++;
      if (score?.status === 'completed') reqCompleted++;
    } else if (!isMandatory && isAssigned) {
      guestTotal++;
      if (score?.status === 'completed') guestCompleted++;
    }

    // PRIVACY CHECK (v2.0.0-beta.1):
    // Before 'ended': Only see score value if Admin or own score. Chair CANNOT see others.
    // Once 'ended' or 'finalized': Chair sees all scores in their own council!
    const isCouncilEnded = (council.status === 'ended' || council.status === 'finalized' || council.status === 'completed');
    const isOwnScore = (scorerId && (scorerId === myUserId || (assigned?.memberEmail && assigned.memberEmail.toLowerCase() === (state.user?.email || '').toLowerCase())));
    const canSeeValue = (auth.isAdmin || isOwnScore || (isCouncilEnded && auth.isChair));

    let statusPill = '<span class="text-slate-400 font-mono text-xs">— Chưa chấm</span>';
    if (!isAssigned) {
      statusPill = '<span class="text-slate-300 italic text-[11px]">Chưa phân công</span>';
    } else if (score?.status === 'completed') {
      if (canSeeValue) {
        statusPill = `<span class="badge bg-emerald-100 text-emerald-800 font-bold text-xs">✓ Đã chấm (${score.value})</span>`;
      } else {
        statusPill = '<span class="badge bg-emerald-100 text-emerald-800 font-bold text-xs">✓ Đã hoàn tất</span>';
      }
    } else if (score?.status === 'draft') {
      if (canSeeValue) {
        statusPill = `<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Lưu tạm (${score.value || '--'})</span>`;
      } else {
        statusPill = '<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Đang chấm</span>';
      }
    }

    return `
      <div class="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs">
        <div>
          <span class="font-bold text-slate-800">${s.name || s.label}</span>
          <span class="text-slate-500 font-normal ml-1">(${assigned?.memberName || 'Chưa phân công'})</span>
          ${isMandatory ? '<span class="text-rose-500 font-bold ml-1">*</span>' : ''}
        </div>
        <div>${statusPill}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="font-black text-xs text-slate-800 uppercase tracking-wider">Tiến độ chấm điểm của Hội đồng cho SV này</h4>
      <div class="text-[11px] font-bold text-slate-600 space-x-2">
        <span>Bắt buộc: <strong class="${reqCompleted === reqTotal && reqTotal > 0 ? 'text-emerald-700' : 'text-amber-700'}">${reqCompleted}/${reqTotal}</strong></span>
        ${guestTotal > 0 ? `<span>• Khách mời: <strong>${guestCompleted}/${guestTotal}</strong></span>` : ''}
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
      ${itemsHtml}
    </div>
  `;
}

// 13. ADMIN REAL-TIME MONITOR (ONLY FOR ADMIN)
function renderAdminMonitor() {
  const container = document.getElementById('cws-admin-monitor-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  if (!auth.isAdmin) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  const assignments = (act?.councilStudentAssignments || [])
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const slots = act?.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};
  const mode = act?.scoringConfig?.mode || 'numeric';

  const rowsHtml = assignments.map(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;

    let totalCompletedVal = 0;
    let completedCount = 0;
    const letterCounts = {};

    const cellsHtml = slots.map(s => {
      const assigned = membersBySlot[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (score?.status === 'completed') {
        if (mode === 'numeric') {
          totalCompletedVal += Number(score.value || 0);
          completedCount++;
          return `<td class="p-2 text-center font-mono font-bold text-emerald-700">${score.value}</td>`;
        } else {
          letterCounts[score.value] = (letterCounts[score.value] || 0) + 1;
          return `<td class="p-2 text-center font-mono font-bold text-indigo-700">${score.value}</td>`;
        }
      } else if (score?.status === 'draft') {
        return `<td class="p-2 text-center font-mono text-amber-600 text-[10px]">● ${score.value || 'Draft'}</td>`;
      }
      return '<td class="p-2 text-center text-slate-300 font-mono">--</td>';
    }).join('');

    let summaryCol = '--';
    if (mode === 'numeric') {
      if (completedCount > 0) {
        const avg = (totalCompletedVal / completedCount).toFixed(2);
        summaryCol = `<strong class="text-slate-900">${avg}</strong> <span class="text-[10px] text-slate-400">(${completedCount} chấm)</span>`;
      }
    } else {
      const entries = Object.entries(letterCounts);
      if (entries.length > 0) {
        summaryCol = entries.map(([k, c]) => `${k}: ${c}`).join(', ');
      }
    }

    return `
      <tr class="hover:bg-indigo-50/40 transition-colors">
        <td class="p-2 text-center font-mono font-bold text-slate-400">#${asgn.order || '--'}</td>
        <td class="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-2 font-bold text-slate-800 whitespace-nowrap">${sName}</td>
        ${cellsHtml}
        <td class="p-2 text-center font-mono font-semibold">${summaryCol}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="font-black text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
        <span>🛡️</span> Bảng theo dõi Điểm & Trạng thái Hội đồng (Chỉ Quản trị viên)
      </h4>
      <span class="text-[10px] text-indigo-600 font-bold">Real-time Monitor</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden shadow-xs border border-indigo-100">
        <thead class="bg-indigo-50/70 text-indigo-900 border-b border-indigo-100 font-bold">
          <tr>
            <th class="p-2 text-center">#</th>
            <th class="p-2">MSSV</th>
            <th class="p-2">Họ và tên</th>
            ${slots.map(s => `<th class="p-2 text-center whitespace-nowrap">${s.label || s.name}</th>`).join('')}
            <th class="p-2 text-center whitespace-nowrap">${mode === 'numeric' ? 'Điểm TB' : 'Tổng hợp'}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

// 14. URL DIRECT NAVIGATION LISTENER (?x=&a=&c=)
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const xCode = params.get('x') || params.get('round');
      const aCode = params.get('a');
      const cCode = params.get('c');

      if (xCode && aCode && cCode && state.rounds && state.rounds.length > 0) {
        const targetRound = state.rounds.find(r => !r.deleted && (r.shortCode === xCode || r.roundName === xCode || r.id === xCode || r.slug === xCode));
        if (targetRound) {
          const act = (targetRound.activities || []).find(a => a.id === aCode || a.slug === aCode);
          if (act) {
            const council = (act.councils || []).find(c => c.id === cCode || c.slug === cCode);
            if (council) {
              openCouncilWorkspace(targetRound.id, act.id, council.id);
            }
          }
        }
      }
    } catch (e) {
      console.warn('URL council direct navigation notice:', e);
    }
  }, 1500);
});




// ============================================================================
// IFA+ GRADUATION BETA v1.9.0-beta.1: PRELIMINARY + GVHD + THESIS HD/PB
// ============================================================================

// --- 1. CORE CALCULATION & HELPER FUNCTIONS ---

export function getPreliminarySummary(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) return { average: null, count: 0, totalSubmitted: 0, scores: [], excludedScores: [] };

  const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId)
    || (targetRound.eligibleStudents || []).find(s => (s.mssv === studentId || s.studentId === studentId))
    || { studentId };

  const excludedIds = new Set(getPreliminaryExcludedSupervisorIds(reg));
  const allScores = Object.values(targetRound.preliminaryScores || {}).filter(s => s.studentId === studentId);

  const included = [];
  const excluded = [];
  let sum = 0;

  allScores.forEach(sc => {
    const isExcluded = excludedIds.has(sc.scorerId);
    if (isExcluded) {
      excluded.push({ ...sc, reason: 'official_supervisor' });
    } else {
      if (sc.status === 'completed') {
        included.push(sc);
        sum += Number(sc.score);
      }
    }
  });

  // FULL PRECISION (NO intermediate rounding!)
  const average = included.length > 0 ? (sum / included.length) : null;

  return {
    average,
    count: included.length,
    totalSubmitted: allScores.length,
    scores: included,
    excludedScores: excluded
  };
}

export function getPreliminaryAverage(studentId, roundId = null) {
  const summary = getPreliminarySummary(studentId, roundId);
  return summary.average;
}

export function getThesisFinalScore(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) return null;

  const thesis = targetRound.thesisScores?.[studentId];
  if (!thesis || !thesis.hd || !thesis.pb) return null;
  if (thesis.hd.status !== 'completed' || thesis.pb.status !== 'completed') return null;

  // FULL PRECISION: (TM HD + TM PB) / 2
  return (Number(thesis.hd.score) + Number(thesis.pb.score)) / 2;
}

// --- 2. SUPERVISOR ACCEPTED TABLE SCORING CELLS ---

function renderSupervisorScoreCell(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  const sc = targetRound?.supervisorScores?.[studentId];

  if (sc?.status === 'completed') {
    return `
      <div class="flex items-center justify-center gap-1.5">
        <span class="badge bg-emerald-100 text-emerald-800 font-bold font-mono text-xs">${Number(sc.score).toFixed(1)}</span>
        <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="text-blue-600 hover:underline text-[11px] font-bold">Xem</button>
      </div>
    `;
  } else if (sc?.status === 'draft') {
    return `
      <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg font-bold text-[11px]">
        ● Lưu tạm (${sc.score ?? '--'})
      </button>
    `;
  }
  return `
    <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg font-bold text-[11px]">
      + Nhập điểm
    </button>
  `;
}

function renderThesisHdScoreCell(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  const sc = targetRound?.thesisScores?.[studentId]?.hd;

  if (sc?.status === 'completed') {
    return `
      <div class="flex items-center justify-center gap-1.5">
        <span class="badge bg-blue-100 text-blue-800 font-bold font-mono text-xs">${Number(sc.score).toFixed(1)}</span>
        <button type="button" onclick="openScoreEntryModal('tm_hd', '${studentId}')" class="text-blue-600 hover:underline text-[11px] font-bold">Xem</button>
      </div>
    `;
  } else if (sc?.status === 'draft') {
    return `
      <button type="button" onclick="openScoreEntryModal('tm_hd', '${studentId}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg font-bold text-[11px]">
        ● Lưu tạm (${sc.score ?? '--'})
      </button>
    `;
  }
  return `
    <button type="button" onclick="openScoreEntryModal('tm_hd', '${studentId}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg font-bold text-[11px]">
      + Nhập TM HD
    </button>
  `;
}

// --- 3. SUPERVISOR PRELIMINARY SCORING TAB ---

window.renderSupervisorPreliminaryList = function() {
  const container = document.getElementById('sup-prelim-cards-container');
  if (!container) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const myScorerId = state.user?.uid || state.user?.email;
  const isAuthorized = state.isAdmin || (targetRound.preliminaryConfig?.scorerIds || []).includes(myScorerId) || (targetRound.preliminaryConfig?.scorerIds || []).includes(state.user?.email);

  if (!isAuthorized) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Thầy/Cô chưa được phân quyền chấm Sơ khảo trong Đợt này.</div>';
    return;
  }

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('sup-prelim-search')?.value || '').toLowerCase().trim();
  const filterStatus = document.getElementById('sup-prelim-filter-status')?.value || 'all';

  let myScoredCount = 0;
  const filtered = allStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '';
    const topic = s.topicTitle || '';
    if (q && !sid.toLowerCase().includes(q) && !name.toLowerCase().includes(q) && !topic.toLowerCase().includes(q)) {
      return false;
    }

    const key = `prelim_${sid}_${myScorerId}`;
    const myScore = targetRound.preliminaryScores?.[key];
    const isCompleted = myScore?.status === 'completed';
    if (isCompleted) myScoredCount++;

    if (filterStatus === 'scored' && !isCompleted) return false;
    if (filterStatus === 'unscored' && isCompleted) return false;
    return true;
  });

  const progressEl = document.getElementById('sup-prelim-my-progress');
  if (progressEl) progressEl.textContent = `${myScoredCount} / ${allStudents.length} đã chấm`;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Không có sinh viên phù hợp điều kiện lọc.</div>';
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '--';
    const pType = s.projectType || '--';
    const supervisorsStr = formatStudentSupervisorsForDisplay(s);

    const key = `prelim_${sid}_${myScorerId}`;
    const myScore = targetRound.preliminaryScores?.[key];
    const isCompleted = myScore?.status === 'completed';

    let scoreStatusHtml = '<span class="text-slate-400 text-xs">— Chưa chấm</span>';
    if (isCompleted) {
      scoreStatusHtml = `<span class="badge bg-emerald-100 text-emerald-800 font-bold font-mono text-xs">✓ Đã chấm: ${Number(myScore.score).toFixed(1)}</span>`;
    } else if (myScore?.status === 'draft') {
      scoreStatusHtml = `<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Lưu tạm (${myScore.score ?? '--'})</span>`;
    }

    return `
      <div class="card-surface p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-2.5 shadow-xs transition-all">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${name}</h4>
            <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
          </div>
          <div>${scoreStatusHtml}</div>
        </div>

        <div class="text-xs text-slate-700 space-y-1">
          <p><strong class="text-slate-500">Đề tài:</strong> ${topic}</p>
          <p><strong class="text-slate-500">Loại hình:</strong> ${pType}</p>
          <div><strong class="text-slate-500">GVHD:</strong> ${supervisorsStr}</div>
        </div>

        <div class="pt-2 border-t flex justify-end">
          <button type="button" onclick="openScoreEntryModal('preliminary', '${sid}')" class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs">
            ${isCompleted ? 'Sửa điểm Sơ khảo' : 'Chấm Sơ khảo'}
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// --- 4. SUPERVISOR REVIEWER (TM PB) TAB ---

window.renderSupervisorReviewerList = function() {
  const container = document.getElementById('sup-reviewer-cards-container');
  if (!container) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const myUserId = state.user?.uid || state.user?.email;
  const assignments = targetRound.reviewerAssignments || {};

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const assignedStudents = allStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    return state.isAdmin || assignments[sid] === myUserId || assignments[sid] === state.user?.email;
  });

  const countBadge = document.getElementById('sup-reviewer-count-badge');
  if (countBadge) countBadge.textContent = assignedStudents.length;

  if (assignedStudents.length === 0) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Thầy/Cô chưa được phân công phản biện sinh viên nào trong Đợt này.</div>';
    return;
  }

  container.innerHTML = assignedStudents.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '--';
    const supervisorsStr = formatStudentSupervisorsForDisplay(s);

    const sc = targetRound.thesisScores?.[sid]?.pb;
    const isCompleted = sc?.status === 'completed';

    let scoreStatusHtml = '<span class="text-slate-400 text-xs">— Chưa chấm TM PB</span>';
    if (isCompleted) {
      scoreStatusHtml = `<span class="badge bg-blue-100 text-blue-800 font-bold font-mono text-xs">✓ TM PB: ${Number(sc.score).toFixed(1)}</span>`;
    } else if (sc?.status === 'draft') {
      scoreStatusHtml = `<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Lưu tạm (${sc.score ?? '--'})</span>`;
    }

    return `
      <div class="card-surface p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-2.5 shadow-xs transition-all">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${name}</h4>
            <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
          </div>
          <div>${scoreStatusHtml}</div>
        </div>

        <div class="text-xs text-slate-700 space-y-1">
          <p><strong class="text-slate-500">Đề tài:</strong> ${topic}</p>
          <div><strong class="text-slate-500">GVHD:</strong> ${supervisorsStr}</div>
        </div>

        <div class="pt-2 border-t flex justify-end">
          <button type="button" onclick="openScoreEntryModal('tm_pb', '${sid}')" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs">
            ${isCompleted ? 'Sửa điểm TM PB' : 'Nhập điểm TM PB'}
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// --- 5. GENERIC SCORE ENTRY MODAL (SƠ KHẢO, GVHD, TM HD, TM PB) ---

window.openScoreEntryModal = function(type, studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;

  document.getElementById('score-entry-type').value = type;
  document.getElementById('score-entry-student-id').value = studentId;
  document.getElementById('score-entry-student-name').textContent = `Sinh viên: ${sName} (${studentId})`;

  const warningBox = document.getElementById('score-entry-warning-box');
  const valInput = document.getElementById('score-entry-value');
  const commInput = document.getElementById('score-entry-comment');
  const btnComplete = document.getElementById('btn-score-entry-complete');
  const btnDraft = document.getElementById('btn-score-entry-draft');
  const titleEl = document.getElementById('score-entry-modal-title');
  const timeEl = document.getElementById('score-entry-saved-time');

  warningBox.classList.add('hidden');
  valInput.disabled = false;
  commInput.disabled = false;
  btnComplete.disabled = false;
  btnDraft.disabled = false;
  timeEl.textContent = '';

  const myScorerId = state.user?.uid || state.user?.email;

  if (type === 'preliminary') {
    titleEl.textContent = 'Đánh giá Điểm Sơ khảo';
    const key = `prelim_${studentId}_${myScorerId}`;
    const sc = targetRound.preliminaryScores?.[key];
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;
  } else if (type === 'supervisor') {
    titleEl.textContent = 'Nhập Điểm Giảng viên Hướng dẫn (GVHD)';
    const sc = targetRound.supervisorScores?.[studentId];
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;

    // Concurrency Check: First completed wins
    if (sc?.status === 'completed' && sc.submittedBySupervisorId && sc.submittedBySupervisorId !== myScorerId && !state.isAdmin) {
      warningBox.innerHTML = `
        <strong>Điểm GVHD đã được hoàn tất bởi ${sc.submittedByName || 'GVHD khác'} lúc ${fmt24h(sc.completedAt)}.</strong><br>
        Điểm chính thức: <strong>${sc.score}</strong>. Bạn không cần nhập thêm.
      `;
      warningBox.classList.remove('hidden');
      valInput.disabled = true;
      commInput.disabled = true;
      btnComplete.disabled = true;
      btnDraft.disabled = true;
    }
  } else if (type === 'tm_hd') {
    titleEl.textContent = 'Nhập Điểm Thuyết minh GVHD (TM HD)';
    const sc = targetRound.thesisScores?.[studentId]?.hd;
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;

    // Concurrency Check: First completed wins
    if (sc?.status === 'completed' && sc.submittedBySupervisorId && sc.submittedBySupervisorId !== myScorerId && !state.isAdmin) {
      warningBox.innerHTML = `
        <strong>Điểm TM HD đã được hoàn tất bởi ${sc.submittedByName || 'GVHD khác'} lúc ${fmt24h(sc.completedAt)}.</strong><br>
        Điểm chính thức: <strong>${sc.score}</strong>. Bạn không cần nhập thêm.
      `;
      warningBox.classList.remove('hidden');
      valInput.disabled = true;
      commInput.disabled = true;
      btnComplete.disabled = true;
      btnDraft.disabled = true;
    }
  } else if (type === 'tm_pb') {
    titleEl.textContent = 'Nhập Điểm Thuyết minh Phản biện (TM PB)';
    const sc = targetRound.thesisScores?.[studentId]?.pb;
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;
  } else if (type.startsWith('duyet_')) {
    const phase = type.replace('duyet_', '');
    titleEl.textContent = `Đánh giá Tiến độ Duyệt đợt ${phase}`;
    const sc = targetRound.progressReviews?.[type]?.[studentId];
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;
  }

  document.getElementById('modal-score-entry')?.classList.remove('hidden');
};

window.closeScoreEntryModal = function() {
  document.getElementById('modal-score-entry')?.classList.add('hidden');
};

window.saveScoreEntry = async function(isCompleted) {
  if (!checkImpersonationWriteGuard('Lưu mục điểm đánh giá')) return;

  const type = document.getElementById('score-entry-type').value;
  const studentId = document.getElementById('score-entry-student-id').value;
  const valStr = document.getElementById('score-entry-value').value;
  const comment = document.getElementById('score-entry-comment').value.trim();

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound || !studentId) return;

  const numVal = parseFloat(valStr);
  if (isCompleted) {
    if (isNaN(numVal) || numVal < 0 || numVal > 10) {
      showToast('Điểm phải từ 0 đến 10!', 'warning');
      return;
    }
    const confirmed = await showConfirm(
      'Xác nhận hoàn tất',
      `Xác nhận hoàn tất lưu điểm ${numVal} cho sinh viên?`,
      { confirmText: 'Hoàn tất', danger: false }
    );
    if (!confirmed) return;
  }

  const myScorerId = state.user?.uid || state.user?.email;
  const myScorerEmail = (state.user?.email || '').toLowerCase().trim();
  const myScorerName = state.user?.displayName || 'Giảng viên';

  const roundId = targetRound.id;
  const now = new Date().toISOString();

  if (type === 'preliminary') {
    targetRound.preliminaryScores = targetRound.preliminaryScores || {};
    const key = `prelim_${studentId}_${myScorerId}`;
    const record = {
      roundId,
      studentId,
      scorerId: myScorerId,
      scorerEmail: myScorerEmail,
      scorerName: myScorerName,
      decidedBy: myScorerEmail,
      supervisorEmail: myScorerEmail,
      score: isNaN(numVal) ? null : numVal,
      comment,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? now : null
    };
    targetRound.preliminaryScores[key] = record;
    await persistScoreItem(roundId, `preliminaryScores.${key}`, record, key);
  } else if (type === 'supervisor') {
    try {
      const record = await window.submitSupervisorScoreTransaction({
        roundId,
        studentId,
        supervisorId: myScorerId,
        supervisorEmail: myScorerEmail,
        supervisorName: myScorerName,
        score: numVal,
        feedback: comment,
        isCompleted
      });
      targetRound.supervisorScores = targetRound.supervisorScores || {};
      targetRound.supervisorScores[studentId] = record;
    } catch (err) {
      showToast(err.message || 'Lỗi lưu điểm GVHD', 'error');
      return;
    }
  } else if (type === 'tm_hd') {
    try {
      const record = await window.submitThesisScoreHDTransaction({
        roundId,
        studentId,
        supervisorId: myScorerId,
        supervisorEmail: myScorerEmail,
        supervisorName: myScorerName,
        score: numVal,
        feedback: comment,
        isCompleted
      });
      targetRound.thesisScores = targetRound.thesisScores || {};
      targetRound.thesisScores[studentId] = targetRound.thesisScores[studentId] || {};
      targetRound.thesisScores[studentId].hd = record;
    } catch (err) {
      showToast(err.message || 'Lỗi lưu điểm TM HD', 'error');
      return;
    }
  } else if (type === 'tm_pb') {
    targetRound.thesisScores = targetRound.thesisScores || {};
    targetRound.thesisScores[studentId] = targetRound.thesisScores[studentId] || {};
    const existing = targetRound.thesisScores[studentId].pb;

    const record = {
      roundId,
      studentId,
      score: isNaN(numVal) ? null : numVal,
      comment,
      reviewerId: myScorerId,
      reviewerName: myScorerName,
      reviewerEmail: myScorerEmail,
      decidedBy: myScorerEmail,
      supervisorEmail: myScorerEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };
    targetRound.thesisScores[studentId].pb = record;
    await persistScoreItem(roundId, `thesisScores.${studentId}.pb`, record, `tmpb_${studentId}_${myScorerId}`);
  } else if (type.startsWith('duyet_')) {
    const phase = type.replace('duyet_', '');
    targetRound.progressReviews = targetRound.progressReviews || {};
    targetRound.progressReviews[type] = targetRound.progressReviews[type] || {};
    const status = isCompleted ? (numVal >= 5 ? 'passed' : 'failed') : 'draft';
    const record = {
      roundId,
      studentId,
      phase,
      score: isNaN(numVal) ? null : numVal,
      comment,
      status,
      scorerId: myScorerId,
      scorerName: myScorerName,
      scorerEmail: myScorerEmail,
      decidedBy: myScorerEmail,
      updatedAt: now,
      completedAt: isCompleted ? now : null
    };
    targetRound.progressReviews[type][studentId] = record;
    await persistScoreItem(roundId, `progressReviews.${type}.${studentId}`, record, `duyet_${phase}_${studentId}_${myScorerId}`);
  }

  closeScoreEntryModal();
  showToast(isCompleted ? '✓ Đã hoàn tất điểm!' : 'Đã lưu tạm.', isCompleted ? 'success' : 'info');

  // Refresh current view
  if (state.supervisorTab === 'accepted') renderSupervisorAcceptedTable();
  else if (state.supervisorTab === 'preliminary') renderSupervisorPreliminaryList();
  else if (state.supervisorTab === 'reviewer') renderSupervisorReviewerList();
  if (state.currentAdminTab === 'scoring-dashboard') renderAdminScoresTable();
  if (state.currentView === 'assessment') {
    renderAssessmentHeroCard();
    renderCurrentAssessmentTab();
  }
};

async function persistScoreItem(roundId, dotPath, record, decisionKey) {
  try {
    // 1. Subcollection reviewDecisions (authorized under current rules)
    const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', decisionKey);
    await setDoc(decRef, record, { merge: true }).catch(() => {});

    // 2. Round doc atomic dot notation if admin
    if (state.isAdmin) {
      const roundRef = doc(db, 'graduationRounds', roundId);
      await updateDoc(roundRef, {
        [dotPath]: record,
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Persist score item notice:', err);
  }
}

// --- 6. ADMIN SCORING DASHBOARD MODULE ---

window.switchAdminScoringSubTab = function(tabKey) {
  let mainTab = tabKey;
  if (tabKey === 'overview') mainTab = 'summary';
  else if (tabKey === 'preliminary-config') mainTab = 'preliminary';
  else if (tabKey === 'reviewer-assignment' || tabKey === 'supervisor-config') mainTab = 'thesis';
  else if (tabKey === 'final-score-config' || tabKey === 'ranking' || tabKey === 'export') mainTab = 'summary';

  // 7 horizontal top-level navigation buttons
  const mainTabs = ['duyet-1', 'duyet-2', 'duyet-3', 'thesis', 'preliminary', 'defense', 'summary'];
  mainTabs.forEach(t => {
    const btn = document.getElementById('ascore-tab-btn-' + t);
    if (btn) {
      if (t === mainTab) {
        btn.className = 'ascore-nav-btn px-3.5 py-2 rounded-lg bg-slate-900 text-white shadow-xs font-bold transition-all whitespace-nowrap';
      } else {
        btn.className = 'ascore-nav-btn px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all whitespace-nowrap font-semibold';
      }
    }
  });

  // Hide all panels
  const allPanels = [
    'duyet-1', 'duyet-2', 'duyet-3', 'defense',
    'overview', 'preliminary-config', 'supervisor-config', 'reviewer-assignment', 'final-score-config', 'ranking', 'export'
  ];
  allPanels.forEach(pId => {
    const p = document.getElementById('ascore-panel-' + pId);
    if (p) p.classList.add('hidden');
  });

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;

  // Show target panel based on requested tabKey
  if (tabKey === 'duyet-1') {
    const p = document.getElementById('ascore-panel-duyet-1');
    if (p) p.classList.remove('hidden');
    renderAdminProgressReviewTable(1);
  } else if (tabKey === 'duyet-2') {
    const p = document.getElementById('ascore-panel-duyet-2');
    if (p) p.classList.remove('hidden');
    renderAdminProgressReviewTable(2);
  } else if (tabKey === 'duyet-3') {
    const p = document.getElementById('ascore-panel-duyet-3');
    if (p) p.classList.remove('hidden');
    renderAdminProgressReviewTable(3);
  } else if (tabKey === 'thesis' || tabKey === 'reviewer-assignment') {
    const p = document.getElementById('ascore-panel-reviewer-assignment');
    if (p) p.classList.remove('hidden');
    renderAdminReviewerAssignmentTable();
  } else if (tabKey === 'supervisor-config') {
    const p = document.getElementById('ascore-panel-supervisor-config');
    if (p) p.classList.remove('hidden');
    renderAdminSupervisorScoreConfig();
  } else if (tabKey === 'preliminary' || tabKey === 'preliminary-config') {
    const p = document.getElementById('ascore-panel-preliminary-config');
    if (p) p.classList.remove('hidden');
    renderAdminPreliminaryConfig();
  } else if (tabKey === 'defense') {
    const p = document.getElementById('ascore-panel-defense');
    if (p) p.classList.remove('hidden');
    renderAdminDefenseScoresTable();
  } else if (tabKey === 'summary' || tabKey === 'overview') {
    const p = document.getElementById('ascore-panel-overview');
    if (p) p.classList.remove('hidden');
    renderAdminScoresTable();
  } else if (tabKey === 'final-score-config') {
    const p = document.getElementById('ascore-panel-final-score-config');
    if (p) p.classList.remove('hidden');
    loadAdminFinalScoreConfig(roundId);
  } else if (tabKey === 'ranking') {
    const p = document.getElementById('ascore-panel-ranking');
    if (p) p.classList.remove('hidden');
    loadAdminRankingTab(roundId);
  } else if (tabKey === 'export') {
    const p = document.getElementById('ascore-panel-export');
    if (p) p.classList.remove('hidden');
    loadAdminExportTab(roundId);
  }
};

window.renderAdminProgressReviewTable = function(phase) {
  const tbody = document.getElementById('admin-duyet-' + phase + '-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('admin-duyet-' + phase + '-search')?.value || '').toLowerCase().trim();
  const filterVal = document.getElementById('admin-duyet-' + phase + '-filter')?.value || 'all';

  const filtered = allStudents.filter(s => {
    const sid = (s.mssv || s.studentId || '').toLowerCase();
    const name = (s.fullName || s.studentName || '').toLowerCase();
    const topic = (s.topicTitle || '').toLowerCase();
    if (q && !sid.includes(q) && !name.includes(q) && !topic.includes(q)) return false;

    const reviewData = targetRound.progressReviews?.['duyet_' + phase]?.[s.mssv || s.studentId] || {};
    const status = reviewData.status || 'pending';

    if (filterVal !== 'all' && status !== filterVal) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400">Chưa có dữ liệu duyệt tiến độ cho đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '<span class="text-slate-400 italic">Chưa đăng ký đề tài</span>';
    const supName = s.supervisorName || (targetRound.supervisors || []).find(sup => sup.id === s.supervisorId)?.name || '--';
    const reviewData = targetRound.progressReviews?.['duyet_' + phase]?.[sid] || {};
    const status = reviewData.status || 'pending';
    const score = reviewData.score !== undefined ? Number(reviewData.score).toFixed(1) : '--';

    let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa duyệt</span>';
    if (status === 'passed') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đạt yêu cầu</span>';
    } else if (status === 'revision') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">⚠️ Cần bổ sung</span>';
    } else if (status === 'failed') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Không đạt</span>';
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-slate-600 max-w-xs truncate" title="${s.topicTitle || ''}">${topic}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap">${supName}</td>
        <td class="p-3 text-center whitespace-nowrap">${statusBadge}</td>
        <td class="p-3 text-center font-mono font-bold whitespace-nowrap">${score !== '--' ? `<span class="badge bg-blue-50 text-blue-800 font-bold">${score}</span>` : '--'}</td>
      </tr>
    `;
  }).join('');
};

window.renderAdminDefenseScoresTable = function() {
  const tbody = document.getElementById('admin-defense-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('admin-defense-search')?.value || '').toLowerCase().trim();

  const filtered = allStudents.filter(s => {
    const sid = (s.mssv || s.studentId || '').toLowerCase();
    const name = (s.fullName || s.studentName || '').toLowerCase();
    if (q && !sid.includes(q) && !name.includes(q)) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không có dữ liệu sinh viên phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const gvhd = targetRound.supervisorScores?.[sid];
    const gvhdDisplay = gvhd?.status === 'completed'
      ? `<span class="badge bg-emerald-50 text-emerald-800 font-bold font-mono text-xs">${Number(gvhd.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const tmFinal = typeof getThesisFinalScore === 'function' ? getThesisFinalScore(sid, targetRound.id) : null;
    const tmDisplay = tmFinal !== null
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${tmFinal.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const defScore = typeof getStudentDefenseScore === 'function' ? getStudentDefenseScore(sid, targetRound.id) : null;
    const defDisplay = defScore !== null
      ? `<strong class="font-mono text-xs text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded-lg">${defScore.toFixed(2)}</strong>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const councilId = targetRound.councilStudentAssignments?.[sid]?.councilId || s.councilId || '--';
    const isFinalized = defScore !== null;
    const statusPill = isFinalized
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã chốt điểm</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Đang đánh giá</span>';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap font-semibold">${councilId}</td>
        <td class="p-3 text-center whitespace-nowrap">${gvhdDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${defDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${statusPill}</td>
      </tr>
    `;
  }).join('');
};

window.loadAdminScoringDashboard = async function() {
  const sel = document.getElementById('admin-scoring-round-select');
  if (sel) {
    sel.innerHTML = (state.rounds || []).map(r => 
      `<option value="${r.id}" ${r.id === state.selectedRoundId ? 'selected' : ''}>${r.title || r.code || r.id}</option>`
    ).join('');
    if (state.selectedRoundId) sel.value = state.selectedRoundId;
  }
  switchAdminScoringSubTab('duyet-1');
};

window.onAdminScoringRoundChange = function(roundId) {
  state.selectedRoundId = roundId;
  const curSubTab = document.querySelector('.ascore-nav-btn.bg-slate-900')?.id?.replace('ascore-tab-btn-', '') || 'duyet-1';
  switchAdminScoringSubTab(curSubTab);
};

window.renderAdminScoresTable = function() {
  const tbody = document.getElementById('admin-scoring-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('admin-scoring-search')?.value || '').toLowerCase().trim();
  const filterVal = document.getElementById('admin-scoring-filter')?.value || 'all';

  const filtered = allStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '';
    const topic = s.topicTitle || '';
    if (q && !sid.toLowerCase().includes(q) && !name.toLowerCase().includes(q) && !topic.toLowerCase().includes(q)) {
      return false;
    }

    const prelimAvg = getPreliminaryAverage(sid, targetRound.id);
    const gvhdScore = targetRound.supervisorScores?.[sid]?.status === 'completed' ? targetRound.supervisorScores[sid].score : null;
    const tmHdScore = targetRound.thesisScores?.[sid]?.hd?.status === 'completed' ? targetRound.thesisScores[sid].hd.score : null;
    const tmPbScore = targetRound.thesisScores?.[sid]?.pb?.status === 'completed' ? targetRound.thesisScores[sid].pb.score : null;

    if (filterVal === 'missing_prelim' && prelimAvg !== null) return false;
    if (filterVal === 'missing_gvhd' && gvhdScore !== null) return false;
    if (filterVal === 'missing_tm_hd' && tmHdScore !== null) return false;
    if (filterVal === 'missing_tm_pb' && tmPbScore !== null) return false;
    if (filterVal === 'completed') {
      if (prelimAvg === null || gvhdScore === null || tmHdScore === null || tmPbScore === null) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400">Không có dữ liệu sinh viên phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;

    // Sơ khảo
    const prelimAvg = getPreliminaryAverage(sid, targetRound.id);
    const prelimDisplay = prelimAvg !== null
      ? `<span class="badge bg-amber-100 text-amber-900 font-bold font-mono text-xs" title="Full precision: ${prelimAvg}">${prelimAvg.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // GVHD
    const gvhd = targetRound.supervisorScores?.[sid];
    const gvhdDisplay = gvhd?.status === 'completed'
      ? `<span class="badge bg-emerald-100 text-emerald-900 font-bold font-mono text-xs">${Number(gvhd.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // TM HD
    const tmHd = targetRound.thesisScores?.[sid]?.hd;
    const tmHdDisplay = tmHd?.status === 'completed'
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${Number(tmHd.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // TM PB
    const tmPb = targetRound.thesisScores?.[sid]?.pb;
    const tmPbDisplay = tmPb?.status === 'completed'
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${Number(tmPb.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // TM FINAL
    const tmFinal = getThesisFinalScore(sid, targetRound.id);
    const tmFinalDisplay = tmFinal !== null
      ? `<strong class="font-mono text-xs text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded-lg" title="Full precision: ${tmFinal}">${tmFinal.toFixed(2)}</strong>`
      : '<span class="text-slate-300 text-[10px] italic">Chưa đủ điểm</span>';

    // BẢO VỆ CHÍNH THỨC & TỔNG KẾT (v2.1.0-beta.1)
    const defScore = getStudentDefenseScore(sid, targetRound.id);
    const defDisplay = defScore !== null
      ? `<span class="badge bg-purple-50 text-purple-900 font-bold font-mono text-xs" title="Full precision: ${defScore}">${defScore.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const finalInfo = getFinalScore(sid, targetRound.id);
    const finalDisplay = finalInfo.complete
      ? `<strong class="font-mono text-sm text-indigo-950 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-200">${finalInfo.displayScore}</strong>`
      : `<span class="text-amber-700 font-semibold text-xs" title="${(finalInfo.missing || []).join(', ')}">Chưa đủ</span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-center whitespace-nowrap">${prelimDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${gvhdDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmHdDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmPbDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmFinalDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${defDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${finalDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap space-x-1">
          <button type="button" onclick="openAdminStudentScoreDetail('${sid}')" class="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs shadow-xs" title="Xem chi tiết các điểm thành phần">
            Điểm
          </button>
          ${finalInfo.complete ? `
            <button type="button" onclick="openFinalScoreDetailModal('${sid}')" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg font-bold text-indigo-700 text-xs shadow-xs" title="Xem công thức & số thực">
              ∑
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
};

// --- 7. ADMIN STUDENT SCORE DETAIL MODAL ---

window.openAdminStudentScoreDetail = function(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;

  document.getElementById('admin-score-detail-title').textContent = `Chi tiết Điểm số: ${sName} (${studentId})`;
  document.getElementById('admin-score-detail-topic').textContent = `Đề tài: ${sObj?.topicTitle || '--'}`;

  // 1. SƠ KHẢO
  const prelimSummary = getPreliminarySummary(studentId, targetRound.id);
  const prelimAvgEl = document.getElementById('admin-score-detail-prelim-avg');
  if (prelimAvgEl) {
    prelimAvgEl.textContent = prelimSummary.average !== null
      ? `TB: ${prelimSummary.average.toFixed(2)} (${prelimSummary.average})`
      : 'TB: Chưa đủ điểm';
  }

  const prelimListEl = document.getElementById('admin-score-detail-prelim-list');
  const allPrelim = [...prelimSummary.scores, ...prelimSummary.excludedScores];
  if (allPrelim.length === 0) {
    prelimListEl.innerHTML = '<div class="text-slate-400 italic">Chưa có giảng viên nào chấm Sơ khảo cho sinh viên này.</div>';
  } else {
    prelimListEl.innerHTML = allPrelim.map(sc => {
      const isEx = sc.reason === 'official_supervisor';
      return `
        <div class="flex items-center justify-between p-2 bg-white rounded-xl border ${isEx ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-800">${sc.scorerName || sc.scorerEmail}</span>
            ${isEx ? '<span class="badge bg-amber-200 text-amber-900 font-bold text-[10px]">Không tính — GVHD</span>' : '<span class="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">Tính vào TB</span>'}
          </div>
          <div class="flex items-center gap-2">
            <span class="font-mono font-black text-sm text-slate-900">${sc.score}</span>
            <span class="text-[10px] text-slate-400 font-mono">${fmt24h(sc.completedAt || sc.updatedAt)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. ĐIỂM GVHD
  const gvhd = targetRound.supervisorScores?.[studentId];
  const gvhdBody = document.getElementById('admin-score-detail-gvhd-body');
  const gvhdActions = document.getElementById('admin-score-detail-gvhd-actions');

  if (gvhd?.status === 'completed') {
    gvhdBody.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <span class="text-slate-500 font-semibold">Người nhập điểm:</span>
          <strong class="text-slate-900 ml-1">${gvhd.submittedByName || gvhd.submittedByEmail}</strong>
          <p class="text-[11px] text-slate-400 mt-0.5">Hoàn tất lúc: ${fmt24h(gvhd.completedAt)}</p>
          ${gvhd.comment ? `<p class="text-slate-700 italic mt-1.5 p-2 bg-slate-50 rounded-lg">"${escapeHtml(gvhd.comment)}"</p>` : ''}
        </div>
        <div class="text-right">
          <span class="text-2xl font-mono font-black text-emerald-700">${Number(gvhd.score).toFixed(1)}</span>
        </div>
      </div>
    `;
    gvhdActions.innerHTML = `
      <button type="button" onclick="reopenSupervisorScore('${studentId}')" class="px-2.5 py-1 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 font-bold rounded-lg text-xs shadow-xs">
        🔄 Mở lại Điểm GVHD
      </button>
    `;
  } else {
    gvhdBody.innerHTML = '<div class="text-slate-400 italic">Chưa có điểm GVHD chính thức.</div>';
    gvhdActions.innerHTML = '';
  }

  // 3. THUYẾT MINH
  const tmHd = targetRound.thesisScores?.[studentId]?.hd;
  const tmPb = targetRound.thesisScores?.[studentId]?.pb;
  const tmFinal = getThesisFinalScore(studentId, targetRound.id);

  const tmFinalEl = document.getElementById('admin-score-detail-tm-final');
  if (tmFinalEl) {
    tmFinalEl.textContent = tmFinal !== null
      ? `TM FINAL: ${tmFinal.toFixed(2)} (${tmFinal})`
      : 'TM FINAL: Chưa đủ điểm';
  }

  document.getElementById('admin-score-detail-tm-hd-card').innerHTML = `
    <span class="font-bold text-slate-700 block mb-1">TM HD (GVHD Thuyết minh):</span>
    ${tmHd?.status === 'completed' ? `
      <div class="flex items-center justify-between">
        <span class="font-mono font-black text-lg text-blue-700">${Number(tmHd.score).toFixed(1)}</span>
        <span class="text-[10px] text-slate-400">${tmHd.submittedByName || 'GVHD'}</span>
      </div>
    ` : '<span class="text-slate-400 italic">Chưa chấm</span>'}
  `;

  document.getElementById('admin-score-detail-tm-pb-card').innerHTML = `
    <span class="font-bold text-slate-700 block mb-1">TM PB (GVPB Thuyết minh):</span>
    ${tmPb?.status === 'completed' ? `
      <div class="flex items-center justify-between">
        <span class="font-mono font-black text-lg text-blue-700">${Number(tmPb.score).toFixed(1)}</span>
        <span class="text-[10px] text-slate-400">${tmPb.reviewerName || 'GVPB'}</span>
      </div>
    ` : '<span class="text-slate-400 italic">Chưa chấm</span>'}
  `;

  document.getElementById('modal-admin-score-detail')?.classList.remove('hidden');
};

window.closeAdminStudentScoreDetail = function() {
  document.getElementById('modal-admin-score-detail')?.classList.add('hidden');
};

window.reopenSupervisorScore = async function(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const confirmed = await showConfirm(
    'Mở lại Điểm GVHD',
    'Bạn có chắc chắn muốn mở lại Điểm GVHD cho sinh viên này không? Giảng viên hướng dẫn sẽ có thể nhập và hoàn tất lại điểm.',
    { confirmText: 'Mở lại', danger: true }
  );
  if (!confirmed) return;

  if (targetRound.supervisorScores?.[studentId]) {
    targetRound.supervisorScores[studentId].status = 'reopened';
    targetRound.supervisorScores[studentId].updatedAt = new Date().toISOString();
  }

  await persistScoreItem(targetRound.id, `supervisorScores.${studentId}.status`, 'reopened', `sup_${studentId}`);
  openAdminStudentScoreDetail(studentId);
  renderAdminScoresTable();
  showToast('Đã mở lại Điểm GVHD thành công.', 'info');
};

// --- 8. ADMIN PRELIMINARY CONFIG & SUPERVISOR CONFIG ---

function renderAdminPreliminaryConfig() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const chk = document.getElementById('chk-admin-preliminary-enabled');
  if (chk) chk.checked = Boolean(targetRound.preliminaryConfig?.enabled);

  const container = document.getElementById('preliminary-scorers-checklist');
  if (!container) return;

  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  const selectedSet = new Set(targetRound.preliminaryConfig?.scorerIds || []);

  container.innerHTML = supervisors.map(sup => {
    const isChecked = selectedSet.has(sup.id) || (sup.email && selectedSet.has(sup.email.toLowerCase()));
    return `
      <label class="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
        <input type="checkbox" value="${sup.id}" data-email="${sup.email || ''}" class="chk-preliminary-scorer rounded text-tdtu-blue" ${isChecked ? 'checked' : ''} onchange="updatePreliminarySelectedCount()">
        <div class="truncate">
          <span class="font-bold text-slate-800 text-xs block truncate">${sup.name}</span>
          <span class="text-[10px] text-slate-400 block truncate">${sup.email || 'Khoa MTCN'}</span>
        </div>
      </label>
    `;
  }).join('');

  updatePreliminarySelectedCount();
}

window.updatePreliminarySelectedCount = function() {
  const checked = document.querySelectorAll('.chk-preliminary-scorer:checked');
  const countEl = document.getElementById('preliminary-selected-count');
  if (countEl) countEl.textContent = `Đã chọn: ${checked.length} GV`;
};

window.saveAdminPreliminaryConfig = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const enabled = document.getElementById('chk-admin-preliminary-enabled')?.checked === true;
  const checked = document.querySelectorAll('.chk-preliminary-scorer:checked');
  const scorerIds = Array.from(checked).map(cb => cb.value);

  targetRound.preliminaryConfig = {
    enabled,
    scorerIds,
    updatedAt: new Date().toISOString()
  };

  try {
    const roundRef = doc(db, 'graduationRounds', targetRound.id);
    await updateDoc(roundRef, {
      preliminaryConfig: targetRound.preliminaryConfig,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu cấu hình Sơ khảo thành công!', 'success');
  } catch (err) {
    showToast('Lỗi lưu cấu hình: ' + err.message, 'error');
  }
};

function renderAdminSupervisorScoreConfig() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;
  const chk = document.getElementById('chk-admin-supervisor-score-enabled');
  if (chk) chk.checked = Boolean(targetRound.supervisorScoreConfig?.enabled !== false);
}

window.saveAdminSupervisorScoreConfig = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const enabled = document.getElementById('chk-admin-supervisor-score-enabled')?.checked === true;
  targetRound.supervisorScoreConfig = {
    enabled,
    updatedAt: new Date().toISOString()
  };

  try {
    const roundRef = doc(db, 'graduationRounds', targetRound.id);
    await updateDoc(roundRef, {
      supervisorScoreConfig: targetRound.supervisorScoreConfig,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu cấu hình Điểm GVHD thành công!', 'success');
  } catch (err) {
    showToast('Lỗi lưu cấu hình: ' + err.message, 'error');
  }
};

// --- 9. ADMIN REVIEWER (GVPB) ASSIGNMENT MODULE ---

function renderAdminReviewerAssignmentTable() {
  const tbody = document.getElementById('admin-reviewer-assignment-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  const assignments = targetRound.reviewerAssignments || {};

  tbody.innerHTML = allStudents.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '--';
    const currentReviewerId = assignments[sid] || '';

    // Excluded supervisors: GVPB CANNOT be any officialSupervisor of this student!
    const excludedIds = new Set(getPreliminaryExcludedSupervisorIds(s));
    const supervisorsStr = formatStudentSupervisorsForDisplay(s);

    const optionsHtml = '<option value="">-- Chưa phân công GVPB --</option>' + supervisors.map(sup => {
      const isOfficial = excludedIds.has(sup.id) || (sup.email && excludedIds.has(sup.email.toLowerCase()));
      return `
        <option value="${sup.id}" ${currentReviewerId === sup.id ? 'selected' : ''} ${isOfficial ? 'disabled class="text-slate-300 italic"' : ''}>
          ${sup.name} ${isOfficial ? ' (Đang là GVHD của SV)' : ''}
        </option>
      `;
    }).join('');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 max-w-xs truncate" title="${topic}">${topic}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap">${supervisorsStr}</td>
        <td class="p-3">
          <select data-sid="${sid}" class="select-reviewer-assignment w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white ${currentReviewerId ? 'border-blue-300 bg-blue-50/50 text-blue-900' : ''}">
            ${optionsHtml}
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

window.saveAdminReviewerAssignments = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const selects = document.querySelectorAll('.select-reviewer-assignment');
  const updatedAssignments = { ...(targetRound.reviewerAssignments || {}) };

  selects.forEach(sel => {
    const sid = sel.getAttribute('data-sid');
    const val = sel.value;
    if (sid) {
      if (val) updatedAssignments[sid] = val;
      else delete updatedAssignments[sid];
    }
  });

  targetRound.reviewerAssignments = updatedAssignments;

  try {
    const roundRef = doc(db, 'graduationRounds', targetRound.id);
    await updateDoc(roundRef, {
      reviewerAssignments: updatedAssignments,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu danh sách phân công GVPB thành công!', 'success');
  } catch (err) {
    showToast('Lỗi lưu phân công: ' + err.message, 'error');
  }
};



// ============================================================================
// v2.0.0-beta.1: RUBRIC EVENT HANDLERS & OFFICIAL DEFENSE SCORE & CALIBRATION
// ============================================================================

window.onRubricComponentChange = function(critKey, val) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].components = state.councilLocalDrafts[sid].components || {};
  
  if (val === '' || val === null || val === undefined) {
    delete state.councilLocalDrafts[sid].components[critKey];
  } else {
    state.councilLocalDrafts[sid].components[critKey] = Number(val);
  }

  // Update live component sum display
  const inputs = document.querySelectorAll('input[data-crit-key]');
  let sum = 0;
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) sum += v;
  });

  const sumEl = document.getElementById('cws-rubric-comp-sum');
  if (sumEl) sumEl.textContent = sum.toFixed(2);

  const totalInput = document.getElementById('cws-score-input-numeric');
  const warnEl = document.getElementById('cws-rubric-mismatch-warning');
  if (totalInput) {
    const curTot = parseFloat(totalInput.value);
    if (!isNaN(curTot)) {
      const mismatch = Math.abs(sum - curTot) >= 0.000001;
      if (warnEl) warnEl.classList.toggle('hidden', !mismatch);
    }
  }
};

window.syncRubricSumToTotal = function() {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  const inputs = document.querySelectorAll('input[data-crit-key]');
  let sum = 0;
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) sum += v;
  });

  const totalInput = document.getElementById('cws-score-input-numeric');
  if (totalInput) {
    totalInput.value = sum.toFixed(2);
    onScoreInputChange(totalInput.value);
  }

  const warnEl = document.getElementById('cws-rubric-mismatch-warning');
  if (warnEl) warnEl.classList.add('hidden');
  showToast(`Đã cập nhật Điểm tổng: ${sum.toFixed(2)}`, 'info');
};

export function getOfficialDefenseScore(studentId, council, act, round) {
  if (!council || !act) return { score: null, isComplete: false, count: 0, mandatoryComplete: false };
  const slots = act.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};
  const activityId = act.id;
  const councilId = council.id;

  let mandatoryTotal = 0;
  let mandatoryCompleted = 0;
  const mandatoryScores = [];
  const includedGuestScores = [];
  const excludedGuestScores = [];

  for (const s of slots) {
    const assigned = membersBySlot[s.key];
    const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
    if (!scorerId) continue;
    const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
    const score = state.councilScores?.[scoreKey];
    const isCompleted = (score?.status === 'completed');

    if (s.type === 'mandatory') {
      mandatoryTotal++;
      if (isCompleted && typeof score.value === 'number') {
        mandatoryCompleted++;
        mandatoryScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: score.value });
      }
    } else if (s.type === 'guest') {
      if (isCompleted && typeof score.value === 'number') {
        const isIncluded = council.guestInclusion?.[studentId]?.[s.key] !== false;
        if (isIncluded) {
          includedGuestScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: score.value });
        } else {
          excludedGuestScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: score.value });
        }
      }
    }
  }

  const mandatoryComplete = (mandatoryTotal > 0 && mandatoryCompleted === mandatoryTotal);
  const allIncluded = [...mandatoryScores.map(s => s.value), ...includedGuestScores.map(s => s.value)];
  // Retain full IEEE 754 precision!
  const rawAverage = allIncluded.length > 0 ? (allIncluded.reduce((a, b) => a + b, 0) / allIncluded.length) : null;

  return {
    studentId,
    isComplete: mandatoryComplete,
    mandatoryTotal,
    mandatoryCompleted,
    mandatoryComplete,
    score: rawAverage,
    formattedScore: rawAverage !== null ? rawAverage.toFixed(2) : '--',
    mandatoryScores,
    includedGuestScores,
    excludedGuestScores,
    allScoresCount: allIncluded.length
  };
}

window.finalizeCouncilSession = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council || !act) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền chốt điểm Hội đồng!', 'error');
    return;
  }

  // Verification: all mandatory scorers must have completed scores for all students
  const reqSlots = getRequiredScorers(council, act);
  const assignments = (act.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  
  const missingStudents = [];
  for (const asgn of assignments) {
    const sId = asgn.studentId;
    let missingForStudent = false;
    for (const s of reqSlots) {
      const assignedMem = council.membersBySlot?.[s.key];
      const scorerId = assignedMem?.memberId || assignedMem?.memberEmail;
      if (scorerId) {
        const k = `${activityId}_${councilId}_${sId}_${scorerId}`;
        const sc = state.councilScores?.[k];
        if (sc?.status !== 'completed') {
          missingForStudent = true;
          break;
        }
      } else {
        missingForStudent = true;
        break;
      }
    }
    if (missingForStudent) {
      missingStudents.push(sId);
    }
  }

  if (missingStudents.length > 0) {
    showToast(`Không thể chốt điểm: Còn ${missingStudents.length} sinh viên chưa hoàn tất đủ các phiếu chấm bắt buộc!`, 'error');
    return;
  }

  const confirmed = await showConfirm(
    'Chốt điểm Hội đồng',
    `Xác nhận khóa và chốt điểm chính thức cho toàn bộ ${assignments.length} sinh viên của Hội đồng "${council.name}"?`,
    { confirmText: 'Khóa & Chốt điểm', danger: false }
  );
  if (!confirmed) return;

  council.finalDefenseScores = council.finalDefenseScores || {};
  for (const asgn of assignments) {
    const sId = asgn.studentId;
    const official = getOfficialDefenseScore(sId, council, act, targetRound);
    council.finalDefenseScores[sId] = {
      score: official.score,
      completedScoresCount: official.allScoresCount,
      finalizedAt: new Date().toISOString()
    };
  }

  council.status = 'finalized';
  council.finalizedAt = new Date().toISOString();
  council.finalizedBy = state.user?.email || 'admin';

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`✓ Đã chốt điểm Hội đồng "${council.name}" thành công! Điểm bảo vệ chính thức đã được ghi nhận.`, 'success');
};

window.openReopenCouncilModal = function() {
  const { auth } = state.activeCouncilWorkspace || {};
  if (!auth || !auth.isAdmin) {
    showToast('Chỉ Quản trị viên mới có quyền mở lại Hội đồng đã chốt điểm!', 'error');
    return;
  }
  document.getElementById('reopen-council-reason').value = '';
  document.getElementById('modal-reopen-council')?.classList.remove('hidden');
};

window.closeReopenCouncilModal = function() {
  document.getElementById('modal-reopen-council')?.classList.add('hidden');
};

window.confirmReopenCouncil = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  if (!auth || !auth.isAdmin) {
    showToast('Chỉ Quản trị viên mới có quyền mở lại Hội đồng!', 'error');
    return;
  }

  const reason = document.getElementById('reopen-council-reason')?.value?.trim();
  if (!reason) {
    showToast('Vui lòng nhập lý do mở lại Hội đồng!', 'warning');
    return;
  }

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  council.status = 'ended';
  council.auditLogs = council.auditLogs || [];
  council.auditLogs.unshift({
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    action: 'reopen_council',
    councilId,
    reason,
    adjustedById: state.user?.uid || state.user?.email,
    adjustedByName: state.user?.displayName || 'Quản trị viên',
    adjustedByRole: 'admin',
    createdAt: new Date().toISOString()
  });

  await persistActivityCouncilChanges(targetRound);
  closeReopenCouncilModal();
  renderCouncilWorkspaceFull();
  showToast(`Đã mở lại Hội đồng "${council.name}". Trạng thái: Đã kết thúc (chưa chốt).`, 'info');
};

window.renderPostCouncilSection = function() {
  const container = document.getElementById('cws-post-council-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council || !act) {
    container.classList.add('hidden');
    return;
  }

  const isEndedOrFinalized = (council.status === 'ended' || council.status === 'finalized' || council.status === 'completed');
  if (!isEndedOrFinalized || (!auth.isAdmin && !auth.isChair)) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const assignments = (act.councilStudentAssignments || [])
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const slots = act.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};

  const rowsHtml = assignments.map(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const official = getOfficialDefenseScore(sid, council, act, targetRound);

    const cellsHtml = slots.map(s => {
      const assigned = membersBySlot[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (!assigned) {
        return '<td class="p-2 text-center text-slate-300 font-mono text-[11px]">—</td>';
      }

      if (!score || score.status !== 'completed') {
        return '<td class="p-2 text-center text-amber-600 font-mono text-[11px]">Chưa xong</td>';
      }

      const isGuest = (s.type === 'guest');
      const isIncluded = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;

      return `
        <td class="p-2 text-center">
          <div class="flex flex-col items-center gap-0.5">
            <span class="font-mono font-bold text-xs ${isGuest && !isIncluded ? 'line-through text-slate-400' : 'text-slate-900'}">${score.value}</span>
            ${isGuest ? `
              <button type="button" onclick="toggleGuestInclusion('${sid}', '${s.key}', ${!isIncluded})" class="px-1.5 py-0.2 rounded text-[9px] font-black border transition-colors ${isIncluded ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}">
                ${isIncluded ? 'LẤY' : 'BỎ'}
              </button>
            ` : ''}
            <button type="button" onclick="openScoreCalibrationModal('${sid}', '${scorerId}', '${s.key}')" class="text-[10px] text-indigo-600 hover:underline font-bold mt-0.5" title="Hiệu chỉnh điểm">
              Hiệu chỉnh
            </button>
          </div>
        </td>
      `;
    }).join('');

    return `
      <tr class="hover:bg-amber-50/40 transition-colors">
        <td class="p-2 text-center font-mono font-bold text-slate-400">#${asgn.order || '--'}</td>
        <td class="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-2 font-bold text-slate-800 whitespace-nowrap">${sName}</td>
        ${cellsHtml}
        <td class="p-2 text-center font-mono font-black text-sm ${official.isComplete ? 'text-indigo-900 bg-indigo-50/50' : 'text-amber-700 bg-amber-50/50'}">
          ${official.formattedScore}
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h4 class="font-black text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
          <span>⚖️</span> Bảng Hiệu chỉnh & Tính điểm Bảo vệ Chính thức (Chủ tịch / Quản trị viên)
        </h4>
        <p class="text-[11px] text-amber-800 mt-0.5">Chủ tịch có quyền hiệu chỉnh điểm và quyết định LẤY / BỎ điểm Khách mời trước khi chốt điểm.</p>
      </div>
      <span class="badge bg-amber-200 text-amber-900 font-bold text-[10px]">${council.status === 'finalized' ? 'Đã chốt điểm' : 'Sẵn sàng chốt'}</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden shadow-xs border border-amber-200">
        <thead class="bg-amber-100/70 text-amber-950 border-b border-amber-200 font-bold">
          <tr>
            <th class="p-2 text-center">#</th>
            <th class="p-2">MSSV</th>
            <th class="p-2">Họ và tên</th>
            ${slots.map(s => `<th class="p-2 text-center whitespace-nowrap">${s.label || s.name} ${s.type === 'guest' ? '<span class="text-indigo-600 font-normal">(Khách)</span>' : ''}</th>`).join('')}
            <th class="p-2 text-center whitespace-nowrap bg-indigo-100/80 text-indigo-950">ĐIỂM CHÍNH THỨC</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
};

window.openScoreCalibrationModal = function(studentId, scorerId, slotKey) {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền hiệu chỉnh điểm!', 'error');
    return;
  }

  if (council.status === 'finalized' && !auth.isAdmin) {
    showToast('Hội đồng đã chốt điểm, chỉ Quản trị viên mới có thể điều chỉnh!', 'warning');
    return;
  }

  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;
  const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
  const score = state.councilScores?.[scoreKey];
  const assigned = council.membersBySlot?.[slotKey];

  document.getElementById('calib-student-id').value = studentId;
  document.getElementById('calib-scorer-id').value = scorerId;
  document.getElementById('calib-slot-key').value = slotKey;
  document.getElementById('calib-student-meta').textContent = `Sinh viên: ${sName} (${studentId})`;
  document.getElementById('calib-scorer-info').textContent = `${assigned?.memberName || scorerId} (${assigned?.role || slotKey})`;
  document.getElementById('calib-current-val').textContent = (score?.value !== undefined && score.value !== null) ? score.value : '--';
  document.getElementById('calib-new-val').value = (score?.value !== undefined && score.value !== null) ? score.value : '';
  document.getElementById('calib-reason').value = '';

  document.getElementById('modal-score-calibration')?.classList.remove('hidden');
};

window.closeScoreCalibrationModal = function() {
  document.getElementById('modal-score-calibration')?.classList.add('hidden');
};

window.saveScoreCalibration = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền hiệu chỉnh điểm!', 'error');
    return;
  }

  if (council.status === 'finalized' && !auth.isAdmin) {
    showToast('Hội đồng đã chốt điểm, chỉ Quản trị viên mới có thể điều chỉnh!', 'warning');
    return;
  }

  const studentId = document.getElementById('calib-student-id')?.value;
  const scorerId = document.getElementById('calib-scorer-id')?.value;
  const slotKey = document.getElementById('calib-slot-key')?.value;
  const newValStr = document.getElementById('calib-new-val')?.value;
  const reason = document.getElementById('calib-reason')?.value?.trim();

  if (newValStr === '' || newValStr === null || isNaN(Number(newValStr))) {
    showToast('Vui lòng nhập điểm mới hợp lệ (0 – 10)!', 'warning');
    return;
  }
  const newVal = Number(newValStr);
  if (newVal < 0 || newVal > 10) {
    showToast('Điểm hiệu chỉnh phải từ 0 đến 10!', 'warning');
    return;
  }

  if (!reason) {
    showToast('Vui lòng nhập lý do hiệu chỉnh điểm bắt buộc!', 'warning');
    return;
  }

  const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
  const existing = state.councilScores?.[scoreKey] || {};
  const oldVal = existing.value !== undefined ? existing.value : null;

  const assigned = council.membersBySlot?.[slotKey];
  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;

  // Update score record
  const updatedScore = {
    ...existing,
    activityId,
    councilId,
    studentId,
    scorerId,
    slotKey,
    value: newVal,
    status: 'completed',
    adjusted: true,
    adjustments: [
      ...(existing.adjustments || []),
      {
        originalValue: oldVal,
        newValue: newVal,
        adjustedById: state.user?.uid || state.user?.email,
        adjustedByName: state.user?.displayName || (auth.isAdmin ? 'Quản trị viên' : 'Chủ tịch HĐ'),
        reason,
        timestamp: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  };

  state.councilScores[scoreKey] = updatedScore;

  // Append to council audit logs
  council.auditLogs = council.auditLogs || [];
  council.auditLogs.unshift({
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    roundId,
    activityId,
    councilId,
    studentId,
    studentName: sName,
    scorerId,
    scorerName: assigned?.memberName || scorerId,
    slotKey,
    field: 'defense_score',
    originalValue: oldVal,
    newValue: newVal,
    reason,
    adjustedById: state.user?.uid || state.user?.email,
    adjustedByName: state.user?.displayName || (auth.isAdmin ? 'Quản trị viên' : 'Chủ tịch HĐ'),
    adjustedByRole: auth.isAdmin ? 'admin' : 'chair',
    createdAt: new Date().toISOString()
  });

  // Persist to Firestore
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    if (state.isAdmin) {
      await updateDoc(roundRef, {
        [`councilScores.${scoreKey}`]: updatedScore,
        activities: targetRound.activities,
        updatedAt: serverTimestamp()
      });
    } else {
      await persistActivityCouncilChanges(targetRound);
    }
  } catch (err) {
    console.warn('Persist score calibration notice:', err);
  }

  closeScoreCalibrationModal();
  renderCouncilWorkspaceFull();
  showToast(`✓ Đã hiệu chỉnh điểm cho ${sName} thành công và ghi nhận vào Audit Log!`, 'success');
};

window.toggleGuestInclusion = async function(studentId, slotKey, isIncluded) {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền chọn tính điểm Khách mời!', 'error');
    return;
  }

  if (council.status === 'finalized' && !auth.isAdmin) {
    showToast('Hội đồng đã chốt điểm, không thể thay đổi khách mời!', 'warning');
    return;
  }

  council.guestInclusion = council.guestInclusion || {};
  council.guestInclusion[studentId] = council.guestInclusion[studentId] || {};
  council.guestInclusion[studentId][slotKey] = Boolean(isIncluded);

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`Đã cập nhật tính điểm khách mời: ${isIncluded ? 'LẤY ĐIỂM' : 'KHÔNG LẤY'}.`, 'info');
};

window.renderAuditLogsSection = function() {
  const container = document.getElementById('cws-audit-logs-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council || (!auth.isAdmin && !auth.isChair)) {
    container.classList.add('hidden');
    return;
  }

  const logs = council.auditLogs || [];
  if (logs.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
        <span>📋</span> Nhật ký Kiểm toán (Audit Log) của Hội đồng
      </h4>
      <span class="text-[10px] text-slate-500 font-mono font-bold">${logs.length} bản ghi</span>
    </div>
    <div class="space-y-1.5 max-h-48 overflow-y-auto mt-2">
      ${logs.map(log => `
        <div class="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-start justify-between gap-2">
          <div>
            <div class="font-bold text-slate-900">
              ${log.action === 'reopen_council' ? '🔓 Mở lại Hội đồng' : `Hiệu chỉnh điểm: ${log.studentName || log.studentId} (${log.originalValue} ➔ ${log.newValue})`}
            </div>
            <p class="text-[11px] text-slate-600 mt-0.5">Lý do: <span class="italic font-semibold text-slate-800">"${escapeHtml(log.reason || '')}"</span></p>
            <span class="text-[10px] text-slate-400">Bởi: ${log.adjustedByName || log.adjustedById} (${log.adjustedByRole})</span>
          </div>
          <span class="text-[10px] text-slate-400 font-mono whitespace-nowrap">${fmt24h(log.createdAt)}</span>
        </div>
      `).join('')}
    </div>
  `;
};

// Section 37: Guest Passcode Blocker Notice & Placeholders
window.openGuestPasscodeModal = function() {
  console.warn('BLOCKER: Secure Guest Passcode requires trusted backend');
  document.getElementById('modal-guest-passcode-entry')?.classList.remove('hidden');
};

window.closeGuestPasscodeModal = function() {
  document.getElementById('modal-guest-passcode-entry')?.classList.add('hidden');
};



// ============================================================================
// IFA+ GRADUATION BETA v2.1.0-beta.1: FINAL SCORE + RANKING + TITLES + EXCEL
// ============================================================================

// 1. DEFENSE SCORE RESOLVER HELPER (Single Source of Truth)
export function getStudentDefenseScore(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) return null;

  const activities = targetRound.activities || [];
  for (const act of activities) {
    if (!act.councilEnabled) continue;
    const councils = act.councils || [];
    for (const c of councils) {
      const asgns = act.councilStudentAssignments || [];
      const hasStudent = asgns.some(a => a.councilId === c.id && a.studentId === studentId);
      if (hasStudent) {
        // If council already has finalDefenseScores cached
        if (c.finalDefenseScores?.[studentId]?.score !== undefined) {
          return c.finalDefenseScores[studentId].score;
        }
        // Otherwise compute via getOfficialDefenseScore
        const official = getOfficialDefenseScore(studentId, c, act, targetRound);
        if (official && official.score !== null) {
          return official.score; // Full precision IEEE 754 float
        }
      }
    }
  }
  return null;
}

// 2. CONFIGURABLE FINAL SCORE CALCULATION ENGINE (NO INTERMEDIATE ROUNDING)
export function getFinalScore(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) {
    return { complete: false, missing: ['Không tìm thấy đợt tốt nghiệp'], rawScore: null, displayScore: '--', components: {} };
  }

  // Use frozen snapshot if round is finalized
  const cfg = (targetRound.finalScoreConfig?.isFinalized && targetRound.finalScoreConfigSnapshot)
    ? targetRound.finalScoreConfigSnapshot
    : (targetRound.finalScoreConfig || {
        enabled: false,
        supervisorWeight: 20,
        thesisWeight: 20,
        defenseWeight: 60,
        runnerUpCount: 2
      });

  const wSup = Number(cfg.supervisorWeight || 0);
  const wThe = Number(cfg.thesisWeight || 0);
  const wDef = Number(cfg.defenseWeight || 0);

  const missing = [];
  let gvhdRaw = null;
  let tmRaw = null;
  let defRaw = null;

  // A. Supervisor Score
  if (wSup > 0) {
    const sc = targetRound.supervisorScores?.[studentId];
    if (sc && sc.status === 'completed' && typeof sc.score === 'number') {
      gvhdRaw = Number(sc.score);
    } else {
      missing.push('Điểm GVHD');
    }
  }

  // B. Thesis Final Score: (TM HD + TM PB) / 2
  if (wThe > 0) {
    const theScore = getThesisFinalScore(studentId, targetRound.id);
    if (theScore !== null && typeof theScore === 'number') {
      tmRaw = Number(theScore);
    } else {
      missing.push('Điểm Thuyết minh');
    }
  }

  // C. Official Defense Score
  if (wDef > 0) {
    const dScore = getStudentDefenseScore(studentId, targetRound.id);
    if (dScore !== null && typeof dScore === 'number') {
      defRaw = Number(dScore);
    } else {
      missing.push('Điểm Bảo vệ');
    }
  }

  const components = {
    gvhd: gvhdRaw !== null ? { raw: gvhdRaw, display: gvhdRaw.toFixed(1) } : null,
    tm: tmRaw !== null ? { raw: tmRaw, display: tmRaw.toFixed(2) } : null,
    defense: defRaw !== null ? { raw: defRaw, display: defRaw.toFixed(2) } : null
  };

  if (missing.length > 0) {
    return {
      studentId,
      complete: false,
      missing,
      rawScore: null,
      displayScore: '--',
      components
    };
  }

  // FULL IEEE 754 PRECISION: NO intermediate rounding!
  const rawScore = (gvhdRaw * (wSup / 100)) + (tmRaw * (wThe / 100)) + (defRaw * (wDef / 100));
  const displayScore = rawScore.toFixed(2);

  return {
    studentId,
    complete: true,
    missing: [],
    rawScore, // Full precision IEEE 754 float
    displayScore,
    components
  };
}

// 3. ADMIN FINAL SCORE CONFIG CONTROLS & VALIDATION
window.validateFinalScoreWeights = function() {
  const wSup = parseFloat(document.getElementById('cfg-weight-supervisor')?.value) || 0;
  const wThe = parseFloat(document.getElementById('cfg-weight-thesis')?.value) || 0;
  const wDef = parseFloat(document.getElementById('cfg-weight-defense')?.value) || 0;
  const total = Math.round((wSup + wThe + wDef) * 100) / 100;

  const totalEl = document.getElementById('cfg-weights-total-display');
  const msgEl = document.getElementById('cfg-weights-msg');
  const statusBox = document.getElementById('cfg-weights-status-box');
  const chkEnable = document.getElementById('chk-admin-final-score-enabled');

  if (totalEl) totalEl.textContent = `${total}%`;

  const isValid = (Math.abs(total - 100) < 0.000001);

  if (statusBox) {
    if (isValid) {
      statusBox.className = 'p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-wrap items-center justify-between gap-3 text-xs';
      if (msgEl) msgEl.innerHTML = '<span class="text-emerald-700 font-bold flex items-center gap-1"><span>✓</span> Hợp lệ (Tổng trọng số đúng 100%)</span>';
    } else {
      statusBox.className = 'p-4 rounded-xl border border-rose-300 bg-rose-50/80 flex flex-wrap items-center justify-between gap-3 text-xs';
      if (msgEl) msgEl.innerHTML = `<span class="text-rose-700 font-bold flex items-center gap-1"><span>⚠️</span> Không hợp lệ (Hiện tại: ${total}% — Phải đúng bằng 100%)</span>`;
      if (chkEnable && chkEnable.checked) {
        chkEnable.checked = false;
        showToast('Không thể kích hoạt: Tổng trọng số phải đúng bằng 100%!', 'warning');
      }
    }
  }
  return isValid;
};

window.loadAdminFinalScoreConfig = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const cfg = targetRound.finalScoreConfig || {
    enabled: false,
    supervisorWeight: 20,
    thesisWeight: 20,
    defenseWeight: 60,
    runnerUpCount: 2,
    tieThukhoaRule: 'co_title',
    tieAkhoaRule: 'co_title'
  };

  const chkEnable = document.getElementById('chk-admin-final-score-enabled');
  if (chkEnable) chkEnable.checked = Boolean(cfg.enabled);

  const inpSup = document.getElementById('cfg-weight-supervisor');
  if (inpSup) inpSup.value = cfg.supervisorWeight ?? 20;

  const inpThe = document.getElementById('cfg-weight-thesis');
  if (inpThe) inpThe.value = cfg.thesisWeight ?? 20;

  const inpDef = document.getElementById('cfg-weight-defense');
  if (inpDef) inpDef.value = cfg.defenseWeight ?? 60;

  const inpRunner = document.getElementById('cfg-runner-up-count');
  if (inpRunner) inpRunner.value = cfg.runnerUpCount ?? 2;

  const rTie = document.querySelector(`input[name="cfg_tie_rule"][value="${cfg.tieThukhoaRule || 'co_title'}"]`);
  if (rTie) rTie.checked = true;

  const chkPubScore = document.getElementById('chk-publish-final-score');
  if (chkPubScore) chkPubScore.checked = Boolean(targetRound.publishFinalScoreToStudents);

  const chkPubRank = document.getElementById('chk-publish-ranking');
  if (chkPubRank) chkPubRank.checked = Boolean(targetRound.publishRankingToStudents);

  validateFinalScoreWeights();
};

window.saveAdminFinalScoreConfig = async function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const isEnabled = document.getElementById('chk-admin-final-score-enabled')?.checked === true;
  const wSup = parseFloat(document.getElementById('cfg-weight-supervisor')?.value) || 0;
  const wThe = parseFloat(document.getElementById('cfg-weight-thesis')?.value) || 0;
  const wDef = parseFloat(document.getElementById('cfg-weight-defense')?.value) || 0;
  const runnerUpCount = parseInt(document.getElementById('cfg-runner-up-count')?.value, 10) || 2;
  const tieRule = document.querySelector('input[name="cfg_tie_rule"]:checked')?.value || 'co_title';
  const publishFinalScore = document.getElementById('chk-publish-final-score')?.checked === true;
  const publishRanking = document.getElementById('chk-publish-ranking')?.checked === true;

  const total = Math.round((wSup + wThe + wDef) * 100) / 100;
  if (isEnabled && Math.abs(total - 100) >= 0.000001) {
    showToast(`Không thể kích hoạt: Tổng trọng số các thành phần phải đúng bằng 100% (Hiện tại: ${total}%)!`, 'error');
    return;
  }

  const finalScoreConfig = {
    ...(targetRound.finalScoreConfig || {}),
    enabled: isEnabled,
    supervisorWeight: wSup,
    thesisWeight: wThe,
    defenseWeight: wDef,
    runnerUpCount: Math.max(0, runnerUpCount),
    tieThukhoaRule: tieRule,
    tieAkhoaRule: tieRule,
    updatedAt: new Date().toISOString()
  };

  targetRound.finalScoreConfig = finalScoreConfig;
  targetRound.publishFinalScoreToStudents = publishFinalScore;
  targetRound.publishRankingToStudents = publishRanking;

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      finalScoreConfig,
      publishFinalScoreToStudents: publishFinalScore,
      publishRankingToStudents: publishRanking,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu Cấu hình Điểm Tổng kết thành công!', 'success');
  } catch (e) {
    console.warn('Persist finalScoreConfig notice:', e);
    showToast('✓ Đã cập nhật cấu hình Điểm Tổng kết!', 'success');
  }

  renderAdminScoresTable();
};

// 4. ROUND RANKING ENGINE (FULL RAW PRECISION & TRUE TIE RESOLUTION)
export function computeRoundRanking(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;
  if (!targetRound) return { rankedStudents: [], incompleteStudents: [], hasTrueTie: false, tieGroups: {} };

  // Use snapshot if finalized
  if (targetRound.finalScoreConfig?.isFinalized && Array.isArray(targetRound.rankingSnapshot)) {
    return {
      rankedStudents: targetRound.rankingSnapshot,
      incompleteStudents: [],
      hasTrueTie: false,
      tieGroups: {},
      isFinalized: true,
      calculatedAt: targetRound.finalScoreConfig.finalizedAt
    };
  }

  const registrations = state.adminReviewData?.registrations || [];
  const eligibleStudents = targetRound.eligibleStudents || [];

  // Deduplicate all student IDs in round
  const studentMap = new Map();
  eligibleStudents.forEach(s => {
    const sid = s.mssv || s.studentId;
    if (sid) {
      const facName = (window.getFacultyStudent ? window.getFacultyStudent(sid)?.name : '') || sid;
      studentMap.set(sid, { studentId: sid, fullName: s.fullName || s.studentName || facName });
    }
  });
  registrations.forEach(r => {
    const sid = r.studentId || r.mssv;
    if (sid) studentMap.set(sid, { studentId: sid, fullName: r.studentName || r.fullName || sid });
  });

  const allStudents = Array.from(studentMap.values());
  const completedList = [];
  const incompleteList = [];

  allStudents.forEach(st => {
    const fScore = getFinalScore(st.studentId, targetRound.id);
    if (fScore.complete) {
      completedList.push({
        studentId: st.studentId,
        fullName: st.fullName,
        rawScore: fScore.rawScore, // Full IEEE 754 precision
        displayScore: fScore.displayScore,
        components: fScore.components
      });
    } else {
      incompleteList.push({
        studentId: st.studentId,
        fullName: st.fullName,
        missing: fScore.missing,
        components: fScore.components
      });
    }
  });

  // SORT STRICTLY BY RAW SCORE DESCENDING (NEVER SORT BY DISPLAY ROUNDED!)
  completedList.sort((a, b) => b.rawScore - a.rawScore);

  // Group True Ties (epsilon < 1e-9)
  const tieGroups = {};
  let tieGroupIdCounter = 1;
  for (let i = 0; i < completedList.length - 1; i++) {
    const a = completedList[i];
    const b = completedList[i + 1];
    if (Math.abs(a.rawScore - b.rawScore) < 1e-9) {
      let gId = a.tieGroup;
      if (!gId) {
        gId = 'tie_' + (tieGroupIdCounter++);
        a.tieGroup = gId;
        tieGroups[gId] = [a];
      }
      b.tieGroup = gId;
      if (!tieGroups[gId].includes(b)) tieGroups[gId].push(b);
    }
  }

  // Apply ranking overrides if Admin decided manual order
  const overrides = targetRound.finalScoreConfig?.rankingOverrides || {};
  Object.keys(overrides).forEach(gId => {
    const orderedSids = overrides[gId];
    if (Array.isArray(orderedSids) && tieGroups[gId]) {
      const groupStudents = [...tieGroups[gId]];
      groupStudents.sort((x, y) => orderedSids.indexOf(x.studentId) - orderedSids.indexOf(y.studentId));
      tieGroups[gId] = groupStudents;
    }
  });

  // Assign Ranks and Titles
  const runnerUpCount = targetRound.finalScoreConfig?.runnerUpCount ?? 2;
  const tieRule = targetRound.finalScoreConfig?.tieThukhoaRule || 'co_title';
  const rankedStudents = [];

  let currentRank = 1;
  let i = 0;
  while (i < completedList.length) {
    const currentStudent = completedList[i];
    const gId = currentStudent.tieGroup;

    if (gId && tieRule === 'co_title') {
      const tiedGroup = tieGroups[gId];
      const count = tiedGroup.length;
      
      // Determine Title
      let title = '';
      if (currentRank === 1) {
        title = 'Đồng Thủ khoa';
      } else if (currentRank <= 1 + runnerUpCount) {
        title = 'Đồng Á khoa';
      }

      tiedGroup.forEach(st => {
        rankedStudents.push({
          ...st,
          rank: currentRank,
          title,
          isTie: true
        });
      });

      i += count;
      currentRank += count;
    } else {
      let title = '';
      if (currentRank === 1) {
        title = 'Thủ khoa';
      } else if (currentRank <= 1 + runnerUpCount) {
        title = 'Á khoa';
      }

      rankedStudents.push({
        ...currentStudent,
        rank: currentRank,
        title,
        isTie: Boolean(gId)
      });

      i++;
      currentRank++;
    }
  }

  return {
    rankedStudents,
    incompleteStudents,
    hasTrueTie: Object.keys(tieGroups).length > 0,
    tieGroups,
    isFinalized: Boolean(targetRound.finalScoreConfig?.isFinalized),
    calculatedAt: new Date().toISOString()
  };
}

// 5. RANKING TAB RENDER & ACTIONS
window.loadAdminRankingTab = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  state._currentRoundRanking = computeRoundRanking(roundId);
  renderRankingTables();
};

window.executeCalculateRanking = function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  if (targetRound.finalScoreConfig?.isFinalized) {
    showToast('Đợt này đã chốt kết quả. Vui lòng bấm "Mở lại kết quả Đợt" nếu cần tính toán lại!', 'warning');
    return;
  }

  state._currentRoundRanking = computeRoundRanking(roundId);
  state._rankingCalculatedAt = new Date().toISOString();
  
  // Hide stale warning
  document.getElementById('ranking-stale-warning')?.classList.add('hidden');

  renderRankingTables();
  showToast('✓ Đã tính xong xếp hạng toàn đợt theo Điểm Tổng kết!', 'success');
};

window.filterRankingTop = function(topCount) {
  state._rankingTopFilter = topCount;
  const buttons = document.querySelectorAll('.ranking-top-btn');
  buttons.forEach(btn => {
    const bTop = btn.dataset.top;
    if (String(bTop) === String(topCount)) {
      btn.className = 'ranking-top-btn active px-2.5 py-1 rounded-lg border font-bold bg-indigo-600 text-white border-indigo-600';
    } else {
      btn.className = 'ranking-top-btn px-2.5 py-1 rounded-lg border font-bold text-slate-600 hover:bg-white transition-colors';
    }
  });
  renderRankingTables();
};

window.renderRankingTables = function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const rankingData = state._currentRoundRanking || computeRoundRanking(roundId);

  // Status badge & timestamp
  const statusBadge = document.getElementById('ranking-status-badge');
  const timeEl = document.getElementById('ranking-calc-time');
  const finalizeBtn = document.getElementById('btn-finalize-round-results');
  const reopenBtn = document.getElementById('btn-reopen-round-results');

  const isFinalized = Boolean(targetRound?.finalScoreConfig?.isFinalized);
  if (statusBadge) {
    if (isFinalized) {
      statusBadge.className = 'badge bg-slate-800 text-white font-black text-xs';
      statusBadge.textContent = '🔒 ĐÃ CHỐT KẾT QUẢ';
    } else if (rankingData.calculatedAt) {
      statusBadge.className = 'badge bg-emerald-100 text-emerald-800 font-bold text-xs';
      statusBadge.textContent = '● Đã tính xếp hạng';
    } else {
      statusBadge.className = 'badge bg-slate-100 text-slate-600 font-bold text-xs';
      statusBadge.textContent = 'Chưa tính';
    }
  }

  if (timeEl && rankingData.calculatedAt) {
    timeEl.textContent = `Cập nhật: ${fmt24h(rankingData.calculatedAt)}`;
  }

  if (finalizeBtn) finalizeBtn.classList.toggle('hidden', isFinalized);
  if (reopenBtn) reopenBtn.classList.toggle('hidden', !isFinalized);

  // Search & Filter
  const q = String(document.getElementById('ranking-search-input')?.value || '').toLowerCase().trim();
  const topLimit = state._rankingTopFilter || 'all';

  let list = rankingData.rankedStudents || [];
  if (q) {
    list = list.filter(st => st.studentId.toLowerCase().includes(q) || st.fullName.toLowerCase().includes(q));
  }

  if (topLimit !== 'all') {
    const limitNum = parseInt(topLimit, 10);
    list = list.slice(0, limitNum);
  }

  const tbody = document.getElementById('ranking-ranked-tbody');
  const countBadge = document.getElementById('ranking-count-badge');
  if (countBadge) countBadge.textContent = rankingData.rankedStudents.length;

  if (tbody) {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-slate-400 text-xs">Chưa có dữ liệu xếp hạng. Vui lòng bấm "⚡ Tính Xếp hạng".</td></tr>';
    } else {
      tbody.innerHTML = list.map(st => {
        let titleBadge = '';
        if (st.title.includes('Thủ khoa')) {
          titleBadge = '<span class="badge bg-amber-400 text-slate-950 font-black text-xs shadow-xs">🎖️ ' + st.title + '</span>';
        } else if (st.title.includes('Á khoa')) {
          titleBadge = '<span class="badge bg-slate-200 text-slate-800 font-bold text-xs">🥈 ' + st.title + '</span>';
        }

        let rankPill = `<span class="font-mono font-bold text-xs text-slate-700">#${st.rank}</span>`;
        if (st.rank === 1) rankPill = '<span class="px-2 py-0.5 bg-amber-100 text-amber-950 font-black rounded-lg font-mono text-xs border border-amber-300">#1</span>';
        else if (st.rank === 2) rankPill = '<span class="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded-lg font-mono text-xs border border-slate-300">#2</span>';
        else if (st.rank === 3) rankPill = '<span class="px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-lg font-mono text-xs border border-amber-200">#3</span>';

        return `
          <tr class="hover:bg-indigo-50/30 transition-colors">
            <td class="p-3 text-center">${rankPill}</td>
            <td class="p-3 font-mono font-bold text-slate-900">${st.studentId}</td>
            <td class="p-3 font-bold text-slate-800 whitespace-nowrap">${st.fullName}</td>
            <td class="p-3 text-center font-mono font-bold text-xs text-emerald-800">${st.components?.gvhd?.display || '--'}</td>
            <td class="p-3 text-center font-mono font-bold text-xs text-blue-800">${st.components?.tm?.display || '--'}</td>
            <td class="p-3 text-center font-mono font-bold text-xs text-purple-800">${st.components?.defense?.display || '--'}</td>
            <td class="p-3 text-center font-mono font-black text-sm text-indigo-950 bg-indigo-50/60">${st.displayScore}</td>
            <td class="p-3 text-center">
              <button type="button" onclick="openFinalScoreDetailModal('${st.studentId}')" class="text-xs text-indigo-600 hover:underline font-bold" title="Xem chi tiết số thực float">
                Chi tiết
              </button>
            </td>
            <td class="p-3 text-center">${titleBadge}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Incomplete Table
  const incTbody = document.getElementById('ranking-incomplete-tbody');
  const incBadge = document.getElementById('ranking-incomplete-count-badge');
  const incList = rankingData.incompleteStudents || [];
  if (incBadge) incBadge.textContent = incList.length;

  if (incTbody) {
    if (incList.length === 0) {
      incTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400 text-xs">Tất cả sinh viên đã có đủ điểm thành phần!</td></tr>';
    } else {
      incTbody.innerHTML = incList.map((st, idx) => `
        <tr class="hover:bg-amber-50/40 transition-colors">
          <td class="p-3 text-center font-mono font-bold text-slate-400">#${idx + 1}</td>
          <td class="p-3 font-mono font-bold text-slate-900">${st.studentId}</td>
          <td class="p-3 font-bold text-slate-800 whitespace-nowrap">${st.fullName}</td>
          <td class="p-3 text-xs text-slate-600">
            GVHD: ${st.components?.gvhd?.display || '--'} | TM: ${st.components?.tm?.display || '--'} | BV: ${st.components?.defense?.display || '--'}
          </td>
          <td class="p-3">
            <span class="badge bg-rose-100 text-rose-800 font-bold text-[11px]">${st.missing.join(', ')}</span>
          </td>
        </tr>
      `).join('');
    }
  }
};

window.finalizeRoundResults = async function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const rankingData = state._currentRoundRanking || computeRoundRanking(roundId);
  if (!rankingData || rankingData.rankedStudents.length === 0) {
    showToast('Chưa có dữ liệu xếp hạng để chốt kết quả. Vui lòng bấm "⚡ Tính Xếp hạng" trước!', 'warning');
    return;
  }

  const confirmed = await showConfirm(
    'Khóa & Chốt Kết quả Đợt Tốt nghiệp',
    `Xác nhận chốt kết quả và đóng băng (freeze) bảng xếp hạng cho toàn bộ ${rankingData.rankedStudents.length} sinh viên hoàn tất trong Đợt "${targetRound.title}"? Sau khi chốt, thứ hạng sẽ không thay đổi trừ khi Admin chủ động Mở lại kết quả.`,
    { confirmText: 'Khóa & Chốt kết quả', danger: false }
  );
  if (!confirmed) return;

  targetRound.finalScoreConfig = targetRound.finalScoreConfig || {};
  targetRound.finalScoreConfig.isFinalized = true;
  targetRound.finalScoreConfig.finalizedAt = new Date().toISOString();
  targetRound.finalScoreConfigSnapshot = JSON.parse(JSON.stringify(targetRound.finalScoreConfig));
  targetRound.rankingSnapshot = rankingData.rankedStudents;

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      finalScoreConfig: targetRound.finalScoreConfig,
      finalScoreConfigSnapshot: targetRound.finalScoreConfigSnapshot,
      rankingSnapshot: targetRound.rankingSnapshot,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã chốt và đóng băng kết quả Đợt tốt nghiệp thành công!', 'success');
  } catch (e) {
    console.warn('Persist finalizeRoundResults notice:', e);
    showToast('✓ Đã chốt kết quả Đợt tốt nghiệp!', 'success');
  }

  renderRankingTables();
};

window.openReopenRoundModal = function() {
  document.getElementById('reopen-round-reason').value = '';
  document.getElementById('modal-reopen-round')?.classList.remove('hidden');
};

window.closeReopenRoundModal = function() {
  document.getElementById('modal-reopen-round')?.classList.add('hidden');
};

window.confirmReopenRound = async function() {
  const reason = document.getElementById('reopen-round-reason')?.value?.trim();
  if (!reason) {
    showToast('Vui lòng nhập lý do mở lại kết quả đợt bắt buộc!', 'warning');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  targetRound.finalScoreConfig = targetRound.finalScoreConfig || {};
  targetRound.finalScoreConfig.isFinalized = false;

  targetRound.auditLogs = targetRound.auditLogs || [];
  targetRound.auditLogs.unshift({
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    action: 'reopen_round_results',
    roundId,
    reason,
    adjustedById: state.user?.uid || state.user?.email,
    adjustedByName: state.user?.displayName || 'Quản trị viên',
    adjustedByRole: 'admin',
    createdAt: new Date().toISOString()
  });

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      finalScoreConfig: targetRound.finalScoreConfig,
      auditLogs: targetRound.auditLogs,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã mở lại kết quả Đợt. Bảng xếp hạng có thể tính toán lại.', 'info');
  } catch (e) {
    console.warn('Persist reopenRound notice:', e);
    showToast('Đã mở lại kết quả Đợt.', 'info');
  }

  closeReopenRoundModal();
  renderRankingTables();
};

// 6. FORMULA DETAIL MODAL
window.openFinalScoreDetailModal = function(studentId) {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId)
    || (targetRound.eligibleStudents || []).find(s => (s.mssv === studentId || s.studentId === studentId))
    || { studentId };

  const sName = reg.fullName || reg.studentName || studentId;
  const cfg = targetRound.finalScoreConfig || { supervisorWeight: 20, thesisWeight: 20, defenseWeight: 60 };
  const fScore = getFinalScore(studentId, roundId);

  document.getElementById('fs-detail-student-meta').textContent = `Sinh viên: ${sName} (${studentId})`;
  document.getElementById('fs-detail-w-gvhd').textContent = cfg.supervisorWeight ?? 20;
  document.getElementById('fs-detail-w-tm').textContent = cfg.thesisWeight ?? 20;
  document.getElementById('fs-detail-w-def').textContent = cfg.defenseWeight ?? 60;

  const gvhdVal = fScore.components?.gvhd;
  const tmVal = fScore.components?.tm;
  const defVal = fScore.components?.defense;

  document.getElementById('fs-detail-gvhd-val').textContent = gvhdVal?.display || '--';
  document.getElementById('fs-detail-gvhd-raw').textContent = gvhdVal ? `Raw: ${gvhdVal.raw}` : '';

  document.getElementById('fs-detail-tm-val').textContent = tmVal?.display || '--';
  document.getElementById('fs-detail-tm-raw').textContent = tmVal ? `Raw: ${tmVal.raw}` : '';

  document.getElementById('fs-detail-def-val').textContent = defVal?.display || '--';
  document.getElementById('fs-detail-def-raw').textContent = defVal ? `Raw: ${defVal.raw}` : '';

  document.getElementById('fs-detail-formula-text').textContent =
    `Điểm = (GVHD × ${cfg.supervisorWeight}%) + (TM × ${cfg.thesisWeight}%) + (Bảo vệ × ${cfg.defenseWeight}%)`;

  document.getElementById('fs-detail-display-score').textContent = fScore.displayScore || '--';
  document.getElementById('fs-detail-raw-score').textContent = fScore.rawScore !== null ? `Raw: ${fScore.rawScore}` : '';

  // Reset raw toggle
  state._rawPrecisionVisible = false;
  toggleRawPrecisionInDetailModal(false);

  document.getElementById('modal-final-score-detail')?.classList.remove('hidden');
};

window.toggleRawPrecisionInDetailModal = function(forceVal = null) {
  state._rawPrecisionVisible = (forceVal !== null) ? forceVal : !state._rawPrecisionVisible;
  const isVis = state._rawPrecisionVisible;

  document.getElementById('fs-detail-gvhd-raw')?.classList.toggle('hidden', !isVis);
  document.getElementById('fs-detail-tm-raw')?.classList.toggle('hidden', !isVis);
  document.getElementById('fs-detail-def-raw')?.classList.toggle('hidden', !isVis);
  document.getElementById('fs-detail-raw-score')?.classList.toggle('hidden', !isVis);

  const btn = document.getElementById('btn-toggle-raw-precision');
  if (btn) {
    btn.textContent = isVis ? '✕ Ẩn điểm chi tiết' : '🔍 Hiện điểm chi tiết (Full Raw)';
  }
};

window.closeFinalScoreDetailModal = function() {
  document.getElementById('modal-final-score-detail')?.classList.add('hidden');
};

// 7. EXCEL EXPORT ENGINE (SheetJS / XLSX Integration with Security)

function sanitizeExcelCell(val) {
  if (typeof val === 'string') {
    // Formula Injection Protection
    if (/^[=+@-]/.test(val)) {
      return "'" + val;
    }
  }
  return val;
}

function sanitizeSheetName(name) {
  return String(name || 'Sheet').replace(/[\\/*?[\]:]/g, '_').substring(0, 31);
}

window.loadAdminExportTab = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  // Populate Activity select
  const acts = (targetRound.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils) && a.councils.length > 0);
  const actSel = document.getElementById('export-activity-select');
  const councilActSel = document.getElementById('export-council-activity-select');

  const optionsHtml = acts.length > 0
    ? acts.map(a => `<option value="${a.id}">${a.title} (${a.councils.length} Hội đồng)</option>`).join('')
    : '<option value="">-- Chưa có Mốc nào có Hội đồng --</option>';

  if (actSel) actSel.innerHTML = optionsHtml;
  if (councilActSel) {
    councilActSel.innerHTML = optionsHtml;
    if (acts.length > 0) onExportCouncilActivityChange(acts[0].id);
  }
};

window.onExportCouncilActivityChange = function(actId) {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  const councilSel = document.getElementById('export-single-council-select');
  if (!councilSel) return;

  const councils = act?.councils || [];
  if (councils.length === 0) {
    councilSel.innerHTML = '<option value="">-- Chưa có Hội đồng --</option>';
    return;
  }
  councilSel.innerHTML = councils.map(c => `<option value="${c.id}">${c.name} (${c.room || 'Chưa xếp phòng'})</option>`).join('');
};

window.exportRoundSummaryToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  // 1. TONG_KET SHEET
  const ranking = computeRoundRanking(roundId);
  const tongKetData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD', 'Điểm GVHD', 'TM HD', 'TM PB', 'TM Final', 'Điểm Bảo vệ', 'Điểm Tổng kết', 'Hạng', 'Danh hiệu']
  ];

  let stt = 1;
  ranking.rankedStudents.forEach(st => {
    tongKetData.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))),
      st.components?.gvhd?.raw ?? '',
      targetRound.thesisScores?.[st.studentId]?.hd?.score ?? '',
      targetRound.thesisScores?.[st.studentId]?.pb?.score ?? '',
      st.components?.tm?.raw ?? '',
      st.components?.defense?.raw ?? '',
      st.rawScore ?? '',
      st.rank,
      sanitizeExcelCell(st.title || '')
    ]);
  });

  ranking.incompleteStudents.forEach(st => {
    tongKetData.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))),
      st.components?.gvhd?.raw ?? '',
      targetRound.thesisScores?.[st.studentId]?.hd?.score ?? '',
      targetRound.thesisScores?.[st.studentId]?.pb?.score ?? '',
      st.components?.tm?.raw ?? '',
      st.components?.defense?.raw ?? '',
      'Chưa đủ',
      '--',
      '--'
    ]);
  });

  const wsTongKet = XLSX.utils.aoa_to_sheet(tongKetData);
  XLSX.utils.book_append_sheet(wb, wsTongKet, 'TONG_KET');

  // 2. XEP_HANG SHEET
  const xepHangData = [
    ['Hạng', 'MSSV', 'Họ và tên', 'Điểm hiển thị', 'Điểm chi tiết (Raw)', 'Danh hiệu', 'Ghi chú đồng điểm']
  ];
  ranking.rankedStudents.forEach(st => {
    xepHangData.push([
      st.rank,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      st.displayScore,
      st.rawScore,
      sanitizeExcelCell(st.title || ''),
      st.isTie ? 'Đồng điểm' : ''
    ]);
  });
  const wsXepHang = XLSX.utils.aoa_to_sheet(xepHangData);
  XLSX.utils.book_append_sheet(wb, wsXepHang, 'XEP_HANG');

  // 3. SO_KHAO SHEET
  const soKhaoData = [
    ['STT', 'MSSV', 'Họ và tên', 'Điểm Sơ khảo TB', 'Số lượt chấm hợp lệ', 'Ghi chú']
  ];
  let skStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const sk = getPreliminarySummary(st.studentId, roundId);
    soKhaoData.push([
      skStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sk.average !== null ? sk.average : '',
      sk.count,
      sk.excludedScores?.length > 0 ? `Đã loại ${sk.excludedScores.length} điểm GVHD` : ''
    ]);
  });
  const wsSoKhao = XLSX.utils.aoa_to_sheet(soKhaoData);
  XLSX.utils.book_append_sheet(wb, wsSoKhao, 'SO_KHAO');

  // 4. GVHD SHEET
  const gvhdData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD chính', 'GVHD hỗ trợ', 'Điểm GVHD', 'Người nhập điểm']
  ];
  let gvStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const sc = targetRound.supervisorScores?.[st.studentId];
    const sObj = findStudentInRound(st.studentId);
    const officials = getOfficialSupervisors(sObj) || [];
    const primary = officials.find(o => o.role === 'primary')?.supervisorName || officials[0]?.supervisorName || '';
    const support = officials.filter(o => o.role === 'support').map(o => o.supervisorName).join(', ');
    gvhdData.push([
      gvStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(primary),
      sanitizeExcelCell(support),
      (sc && sc.status === 'completed') ? sc.score : '',
      sanitizeExcelCell(sc?.scorerName || '')
    ]);
  });
  const wsGvhd = XLSX.utils.aoa_to_sheet(gvhdData);
  XLSX.utils.book_append_sheet(wb, wsGvhd, 'GVHD');

  // 5. TM SHEET
  const tmData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD', 'GVPB', 'TM HD', 'TM PB', 'TM Final']
  ];
  let tmStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const tm = targetRound.thesisScores?.[st.studentId];
    tmData.push([
      tmStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(tm?.hd?.scorerName || ''),
      sanitizeExcelCell(tm?.pb?.scorerName || ''),
      (tm?.hd?.status === 'completed') ? tm.hd.score : '',
      (tm?.pb?.status === 'completed') ? tm.pb.score : '',
      getThesisFinalScore(st.studentId, roundId) ?? ''
    ]);
  });
  const wsTm = XLSX.utils.aoa_to_sheet(tmData);
  XLSX.utils.book_append_sheet(wb, wsTm, 'TM');

  // 6. BAO_VE SHEET
  const bvData = [
    ['STT', 'MSSV', 'Họ và tên', 'Hội đồng', 'CT', 'UV', 'TK', 'Điểm Bảo vệ chính thức']
  ];
  let bvStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const dScore = getStudentDefenseScore(st.studentId, roundId);
    bvData.push([
      bvStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      '--',
      '',
      '',
      '',
      dScore !== null ? dScore : ''
    ]);
  });
  const wsBv = XLSX.utils.aoa_to_sheet(bvData);
  XLSX.utils.book_append_sheet(wb, wsBv, 'BAO_VE');

  // 7. AUDIT SHEET
  const logs = targetRound.auditLogs || [];
  const auditData = [
    ['Thời gian', 'Hành động', 'Mã Đợt / Hội đồng', 'Sinh viên', 'Người chấm', 'Điểm cũ', 'Điểm mới', 'Người thực hiện', 'Lý do']
  ];
  logs.forEach(l => {
    auditData.push([
      fmt24h(l.createdAt),
      sanitizeExcelCell(l.action || 'calibration'),
      sanitizeExcelCell(l.councilId || l.roundId || ''),
      sanitizeExcelCell(l.studentName || l.studentId || ''),
      sanitizeExcelCell(l.scorerName || ''),
      l.originalValue ?? '',
      l.newValue ?? '',
      sanitizeExcelCell(l.adjustedByName || l.adjustedById || ''),
      sanitizeExcelCell(l.reason || '')
    ]);
  });
  const wsAudit = XLSX.utils.aoa_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'AUDIT');

  const safeRoundSlug = (targetRound.slug || targetRound.id || 'Round').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Tong-ket_${safeRoundSlug}_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công file: ${filename}`, 'success');
};

window.exportActivityCouncilsToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const actId = document.getElementById('export-activity-select')?.value;
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  if (!act || !act.councils || act.councils.length === 0) {
    showToast('Vui lòng chọn mốc kế hoạch có Hội đồng hợp lệ!', 'warning');
    return;
  }

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  // SAME COLUMN STRUCTURE ACROSS ALL COUNCILS IN ACTIVITY
  const slots = act.councilStructure?.slots || [];
  const headerRow = ['STT', 'MSSV', 'Họ và tên'];
  slots.forEach(s => {
    headerRow.push(`${s.label || s.name}${s.type === 'guest' ? ' (Khách)' : ''}`);
  });
  headerRow.push('Điểm chính thức');

  act.councils.forEach(council => {
    const cSheetName = sanitizeSheetName(council.name || council.id);
    const asgns = (act.councilStudentAssignments || [])
      .filter(a => a.councilId === council.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const sheetRows = [headerRow];
    let stt = 1;

    asgns.forEach(asgn => {
      const sid = asgn.studentId;
      const sObj = findStudentInRound(sid);
      const sName = sObj?.fullName || sObj?.studentName || sid;
      const official = getOfficialDefenseScore(sid, council, act, targetRound);

      const row = [stt++, sanitizeExcelCell(sid), sanitizeExcelCell(sName)];

      slots.forEach(s => {
        const assigned = council.membersBySlot?.[s.key];
        const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
        const scoreKey = scorerId ? `${act.id}_${council.id}_${sid}_${scorerId}` : null;
        const score = scoreKey ? state.councilScores?.[scoreKey] : null;

        if (!assigned) {
          row.push('Chưa phân công');
        } else if (!score || score.status !== 'completed') {
          row.push('Chưa xong');
        } else {
          const isGuest = (s.type === 'guest');
          const isInc = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;
          if (mode === 'all' && isGuest) {
            row.push(`${score.value} (${isInc ? 'LẤY' : 'BỎ'})`);
          } else {
            row.push(score.value);
          }
        }
      });

      row.push(official.isComplete && official.score !== null ? official.score : '');
      sheetRows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, cSheetName);
  });

  const actSlug = (act.slug || act.id || 'Activity').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${actSlug}_Toan-bo-Hoi-dong_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công: ${filename}`, 'success');
};

window.exportSingleCouncilToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const actId = document.getElementById('export-council-activity-select')?.value;
  const councilId = document.getElementById('export-single-council-select')?.value;
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!act || !council) {
    showToast('Vui lòng chọn Mốc và Hội đồng hợp lệ!', 'warning');
    return;
  }

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  const slots = act.councilStructure?.slots || [];
  const headerRow = ['STT', 'MSSV', 'Họ và tên'];
  slots.forEach(s => {
    headerRow.push(`${s.label || s.name}${s.type === 'guest' ? ' (Khách)' : ''}`);
  });
  headerRow.push('Điểm chính thức');

  const asgns = (act.councilStudentAssignments || [])
    .filter(a => a.councilId === council.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const sheetRows = [headerRow];
  let stt = 1;

  asgns.forEach(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const official = getOfficialDefenseScore(sid, council, act, targetRound);

    const row = [stt++, sanitizeExcelCell(sid), sanitizeExcelCell(sName)];

    slots.forEach(s => {
      const assigned = council.membersBySlot?.[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${act.id}_${council.id}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (!assigned) {
        row.push('Chưa phân công');
      } else if (!score || score.status !== 'completed') {
        row.push('Chưa xong');
      } else {
        const isGuest = (s.type === 'guest');
        const isInc = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;
        if (mode === 'all' && isGuest) {
          row.push(`${score.value} (${isInc ? 'LẤY' : 'BỎ'})`);
        } else {
          row.push(score.value);
        }
      }
    });

    row.push(official.isComplete && official.score !== null ? official.score : '');
    sheetRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  const cSheetName = sanitizeSheetName(council.name || 'Hoi_Dong');
  XLSX.utils.book_append_sheet(wb, ws, cSheetName);

  const actSlug = (act.slug || act.id || 'Bao-ve').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cSlug = (council.slug || council.name || 'HD').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${actSlug}_${cSlug}_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công: ${filename}`, 'success');
};

window.exportAuditLogsToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const wb = XLSX.utils.book_new();
  const logs = targetRound.auditLogs || [];

  const auditData = [
    ['Thời gian', 'Hành động', 'Mã Đợt / Hội đồng', 'Sinh viên', 'Người chấm', 'Điểm cũ', 'Điểm mới', 'Người thực hiện', 'Vai trò', 'Lý do']
  ];

  logs.forEach(l => {
    auditData.push([
      fmt24h(l.createdAt),
      sanitizeExcelCell(l.action || 'calibration'),
      sanitizeExcelCell(l.councilId || l.roundId || ''),
      sanitizeExcelCell(l.studentName || l.studentId || ''),
      sanitizeExcelCell(l.scorerName || ''),
      l.originalValue ?? '',
      l.newValue ?? '',
      sanitizeExcelCell(l.adjustedByName || l.adjustedById || ''),
      sanitizeExcelCell(l.adjustedByRole || ''),
      sanitizeExcelCell(l.reason || '')
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, ws, 'AUDIT_LOGS');

  const filename = `Audit_Logs_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất nhật ký kiểm toán: ${filename}`, 'success');
};

function fmtToday() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// 8. STUDENT FINAL SCORE & RANKING PORTAL CARD
window.renderStudentFinalScoreCard = function(userMssv, round) {
  const card = document.getElementById('student-final-score-card');
  if (!card) return;

  if (!round || !round.publishFinalScoreToStudents || !userMssv) {
    card.classList.add('hidden');
    return;
  }

  const fScore = getFinalScore(userMssv, round.id);
  if (!fScore.complete) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');

  // Fill scores
  const gvhdEl = document.getElementById('st-card-gvhd-score');
  if (gvhdEl) gvhdEl.textContent = fScore.components?.gvhd?.display || '--';

  const tmEl = document.getElementById('st-card-tm-score');
  if (tmEl) tmEl.textContent = fScore.components?.tm?.display || '--';

  const defEl = document.getElementById('st-card-defense-score');
  if (defEl) defEl.textContent = fScore.components?.defense?.display || '--';

  const finalEl = document.getElementById('st-card-final-score');
  if (finalEl) finalEl.textContent = fScore.displayScore || '--';

  // Ranking & Titles if published
  const rankWrap = document.getElementById('st-card-ranking-wrap');
  const rankDisplay = document.getElementById('st-card-rank-display');
  const titleDisplay = document.getElementById('st-card-title-display');
  const titleBadge = document.getElementById('student-final-score-title-badge');

  if (round.publishRankingToStudents) {
    const ranking = computeRoundRanking(round.id);
    const myRankItem = (ranking.rankedStudents || []).find(st => st.studentId === userMssv);

    if (myRankItem && rankWrap) {
      rankWrap.classList.remove('hidden');
      if (rankDisplay) rankDisplay.textContent = `Hạng ${myRankItem.rank}`;
      if (titleDisplay) {
        titleDisplay.textContent = myRankItem.title ? `🎖️ ${myRankItem.title}` : '';
      }
      if (titleBadge && myRankItem.title) {
        titleBadge.classList.remove('hidden');
        titleBadge.innerHTML = `<span class="badge bg-amber-400 text-slate-950 font-black text-sm shadow-md">🎖️ ${myRankItem.title}</span>`;
      }
    }
  } else {
    if (rankWrap) rankWrap.classList.add('hidden');
    if (titleBadge) titleBadge.classList.add('hidden');
  }
};



// ============================================================================
// IFA+ GRADUATION BETA v2.2.0-beta.1:
// STUDENT SUBMISSION / FILE UPLOAD + GOOGLE DRIVE READY ARCHITECTURE
// ============================================================================

// 1. FILENAME RULE ENGINE & NORMALIZATION (NO AI)
window.normalizeVietnameseNoDiacritics = function(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

window.formatPersonName = function(str) {
  if (!str) return '';
  const noDiacritics = String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D');
  const words = noDiacritics
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

window.generateExpectedFilename = function({ template, student, activity, round, fileTypeCategory, extension, mode }) {
  const tpl = template || '{MSSV}_{HO_TEN}_{LOAI}';
  const mssv = (student?.studentId || student?.mssv || '12100314').trim().toUpperCase();
  const hoTen = formatPersonName(student?.studentName || student?.name || 'Nguyen Van A');
  const hoiDong = (student?.councilCode || student?.councilId || 'HD1').trim().toUpperCase();
  const stt = String(student?.presentationOrder || student?.stt || 1).padStart(2, '0');
  const loai = normalizeVietnameseNoDiacritics(fileTypeCategory || activity?.submissionConfig?.fileTypeCategory || 'THUYET_MINH');
  const actName = normalizeVietnameseNoDiacritics(activity?.title || 'ACTIVITY');
  const rName = normalizeVietnameseNoDiacritics(round?.title || round?.code || 'ROUND');

  let base = tpl
    .replace(/\{MSSV\}/gi, mssv)
    .replace(/\{HO_TEN\}/gi, hoTen)
    .replace(/\{HOI_DONG\}/gi, hoiDong)
    .replace(/\{STT\}/gi, stt)
    .replace(/\{LOAI\}/gi, loai)
    .replace(/\{ACTIVITY\}/gi, actName)
    .replace(/\{ROUND\}/gi, rName);

  base = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D')
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  const ext = extension ? ('.' + String(extension).toLowerCase().replace(/^\./, '')) : '';
  return base + ext;
};

window.validateFilename = function({ filename, template, student, activity, round, fileTypeCategory, mode, acceptedExtensions }) {
  if (!filename) {
    return { valid: false, error: 'Chưa có tệp nào được chọn' };
  }
  const lastDot = filename.lastIndexOf('.');
  const ext = lastDot >= 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
  const actualBase = lastDot >= 0 ? filename.substring(0, lastDot) : filename;

  // Extension check
  const allowed = Array.isArray(acceptedExtensions) && acceptedExtensions.length > 0
    ? acceptedExtensions.map(e => String(e).toLowerCase().replace(/^\./, ''))
    : ['pdf'];
  if (!allowed.includes(ext)) {
    return {
      valid: false,
      error: `Định dạng file ".${ext}" không hợp lệ. Chỉ chấp nhận: ${allowed.join(', ')}`,
      expectedExtension: allowed.join(', '),
      actualExtension: ext
    };
  }

  const expectedBase = generateExpectedFilename({
    template,
    student,
    activity,
    round,
    fileTypeCategory,
    extension: ''
  });

  const ruleMode = mode || activity?.submissionConfig?.filenameMode || 'exact';
  let valid = false;
  if (ruleMode === 'exact') {
    valid = actualBase.toUpperCase() === expectedBase.toUpperCase();
  } else {
    valid = actualBase.toUpperCase().startsWith(expectedBase.toUpperCase());
  }

  const expectedFilename = expectedBase + (ext ? '.' + ext : (allowed[0] ? '.' + allowed[0] : ''));

  // Always consider it valid for auto-rename, unless it failed the extension check
  return {
    valid: true,
    expectedFilename,
    actualFilename: filename
  };
};

window.updateFilenamePreviewInAdmin = function() {
  const tpl = document.getElementById('sub-filename-template')?.value || '{MSSV}_{HO_TEN}_{LOAI}';
  const loai = document.getElementById('sub-loai-val')?.value || 'THUYET_MINH';
  const mode = document.querySelector('input[name="sub_filename_mode"]:checked')?.value || 'exact';
  const previewEl = document.getElementById('sub-filename-preview');
  if (!previewEl) return;

  const mockStudent = { studentId: '12100314', studentName: 'Nguyễn Văn A', councilCode: 'HD1', presentationOrder: 1 };
  const mockActivity = { title: 'Duyệt 1' };
  const mockRound = { title: 'Đợt 1' };

  const expected = generateExpectedFilename({
    template: tpl,
    student: mockStudent,
    activity: mockActivity,
    round: mockRound,
    fileTypeCategory: loai,
    extension: 'pdf',
    mode
  });

  previewEl.textContent = expected + (mode === 'prefix' ? '  (hoặc bắt đầu bằng mẫu này)' : '');
};

// 2. ACTIVITY FORM HELPERS FOR SUBMISSION CONFIG
window.toggleActivitySubmissionConfig = function(enabled) {
  const panel = document.getElementById('activity-submission-config-panel');
  if (panel) {
    if (enabled) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }
};

window.toggleSubCustomDeadline = function(isCustom) {
  const wrap = document.getElementById('sub-custom-deadline-wrap');
  if (wrap) {
    if (isCustom) wrap.classList.remove('hidden');
    else wrap.classList.add('hidden');
  }
};

window.resetActivitySubmissionForm = function() {
  ['pdf', 'zip', 'jpg', 'png', 'docx', 'xlsx', 'pptx'].forEach(ext => {
    const el = document.getElementById('sub-ext-' + ext);
    if (el) el.checked = (ext === 'pdf');
  });
  if (document.getElementById('sub-ext-custom')) document.getElementById('sub-ext-custom').value = '';
  if (document.getElementById('sub-max-files')) document.getElementById('sub-max-files').value = '1';
  if (document.getElementById('sub-max-size')) document.getElementById('sub-max-size').value = '100';
  if (document.getElementById('sub-max-attempts')) document.getElementById('sub-max-attempts').value = '3';
  
  const endRadio = document.querySelector('input[name="sub_deadline_mode"][value="activity_end"]');
  if (endRadio) endRadio.checked = true;
  toggleSubCustomDeadline(false);
  if (document.getElementById('sub-deadline-date')) document.getElementById('sub-deadline-date').value = '';
  if (document.getElementById('sub-deadline-time')) document.getElementById('sub-deadline-time').value = '';
  if (document.getElementById('sub-allow-late')) document.getElementById('sub-allow-late').checked = false;

  if (document.getElementById('sub-filename-template')) document.getElementById('sub-filename-template').value = '{MSSV}_{HO_TEN}_{LOAI}';
  if (document.getElementById('sub-loai-val')) document.getElementById('sub-loai-val').value = 'THUYET_MINH';
  const exactRadio = document.querySelector('input[name="sub_filename_mode"][value="exact"]');
  if (exactRadio) exactRadio.checked = true;

  if (document.getElementById('sub-vis-supervisor')) document.getElementById('sub-vis-supervisor').checked = true;
  if (document.getElementById('sub-vis-reviewer')) document.getElementById('sub-vis-reviewer').checked = true;
  if (document.getElementById('sub-vis-council')) document.getElementById('sub-vis-council').checked = true;

  if (document.getElementById('sub-storage-provider')) document.getElementById('sub-storage-provider').value = 'google_drive';
  if (document.getElementById('sub-drive-folder-id')) document.getElementById('sub-drive-folder-id').value = '';

  updateFilenamePreviewInAdmin();
};

window.populateActivitySubmissionForm = function(cfg) {
  if (!cfg) {
    resetActivitySubmissionForm();
    return;
  }
  const accepted = (cfg.acceptedExtensions || ['pdf']).map(e => e.toLowerCase());
  ['pdf', 'zip', 'jpg', 'png', 'docx', 'xlsx', 'pptx'].forEach(ext => {
    const el = document.getElementById('sub-ext-' + ext);
    if (el) el.checked = accepted.includes(ext);
  });
  if (document.getElementById('sub-ext-custom')) document.getElementById('sub-ext-custom').value = cfg.customExtensions || '';
  if (document.getElementById('sub-max-files')) document.getElementById('sub-max-files').value = cfg.maxFiles ?? 1;
  if (document.getElementById('sub-max-size')) document.getElementById('sub-max-size').value = cfg.maxFileSizeMB ?? 100;
  if (document.getElementById('sub-max-attempts')) document.getElementById('sub-max-attempts').value = cfg.maxAttempts ?? 3;

  const isCustomDeadline = cfg.deadlineMode === 'custom' && Boolean(cfg.deadlineAt);
  const dModeRadio = document.querySelector(`input[name="sub_deadline_mode"][value="${isCustomDeadline ? 'custom' : 'activity_end'}"]`);
  if (dModeRadio) dModeRadio.checked = true;
  toggleSubCustomDeadline(isCustomDeadline);

  if (isCustomDeadline && cfg.deadlineAt) {
    const parts = isoToVietnameseDateTime(cfg.deadlineAt);
    if (document.getElementById('sub-deadline-date')) document.getElementById('sub-deadline-date').value = parts.date;
    if (document.getElementById('sub-deadline-time')) document.getElementById('sub-deadline-time').value = parts.time;
  } else {
    if (document.getElementById('sub-deadline-date')) document.getElementById('sub-deadline-date').value = '';
    if (document.getElementById('sub-deadline-time')) document.getElementById('sub-deadline-time').value = '';
  }

  if (document.getElementById('sub-allow-late')) document.getElementById('sub-allow-late').checked = Boolean(cfg.allowLateSubmission);

  if (document.getElementById('sub-filename-template')) document.getElementById('sub-filename-template').value = cfg.filenameTemplate || '{MSSV}_{HO_TEN}_{LOAI}';
  if (document.getElementById('sub-loai-val')) document.getElementById('sub-loai-val').value = cfg.fileTypeCategory || 'THUYET_MINH';
  const fModeRadio = document.querySelector(`input[name="sub_filename_mode"][value="${cfg.filenameMode || 'exact'}"]`);
  if (fModeRadio) fModeRadio.checked = true;

  if (document.getElementById('sub-vis-supervisor')) document.getElementById('sub-vis-supervisor').checked = cfg.visibility?.supervisor !== false;
  if (document.getElementById('sub-vis-reviewer')) document.getElementById('sub-vis-reviewer').checked = cfg.visibility?.reviewer !== false;
  if (document.getElementById('sub-vis-council')) document.getElementById('sub-vis-council').checked = cfg.visibility?.council !== false;

  const subDriveInput = document.getElementById('sub-drive-folder-url');
  if (subDriveInput) {
    subDriveInput.value = cfg.driveFolderId ? `https://drive.google.com/drive/folders/${cfg.driveFolderId}` : '';
    const statusEl = document.getElementById('activity-drive-folder-status');
    if (statusEl) {
      if (cfg.driveFolderId) {
        statusEl.textContent = `✅ Đã lưu (Folder ID: ${cfg.driveFolderId})`;
        statusEl.classList.remove('hidden', 'text-red-600');
        statusEl.classList.add('text-green-600');
      } else {
        statusEl.classList.add('hidden');
      }
    }
  }

  updateFilenamePreviewInAdmin();
};

window.readActivitySubmissionForm = function() {
  const accepted = [];
  ['pdf', 'zip', 'jpg', 'png', 'docx', 'xlsx', 'pptx'].forEach(ext => {
    const el = document.getElementById('sub-ext-' + ext);
    if (el && el.checked) accepted.push(ext);
  });
  const customStr = (document.getElementById('sub-ext-custom')?.value || '').trim();
  if (customStr) {
    customStr.split(',').forEach(part => {
      const clean = part.trim().toLowerCase().replace(/^\./, '');
      if (clean && !accepted.includes(clean)) accepted.push(clean);
    });
  }
  if (accepted.length === 0) accepted.push('pdf');

  const maxFiles = parseInt(document.getElementById('sub-max-files')?.value, 10) || 1;
  const maxFileSizeMB = parseInt(document.getElementById('sub-max-size')?.value, 10) || 100;
  const maxAttempts = parseInt(document.getElementById('sub-max-attempts')?.value, 10) || 3;

  const deadlineMode = document.querySelector('input[name="sub_deadline_mode"]:checked')?.value || 'activity_end';
  let deadlineAt = null;
  if (deadlineMode === 'custom') {
    const dDate = document.getElementById('sub-deadline-date')?.value || '';
    const dTime = document.getElementById('sub-deadline-time')?.value || '';
    deadlineAt = parseVietnameseDateTimeToIso(dDate, dTime);
  }

  const allowLateSubmission = document.getElementById('sub-allow-late')?.checked === true;
  const filenameTemplate = (document.getElementById('sub-filename-template')?.value || '').trim() || '{MSSV}_{HO_TEN}_{LOAI}';
  const fileTypeCategory = (document.getElementById('sub-loai-val')?.value || '').trim() || 'THUYET_MINH';
  const filenameMode = document.querySelector('input[name="sub_filename_mode"]:checked')?.value || 'exact';

  const visSupervisor = document.getElementById('sub-vis-supervisor')?.checked !== false;
  const visReviewer = document.getElementById('sub-vis-reviewer')?.checked !== false;
  const visCouncil = document.getElementById('sub-vis-council')?.checked !== false;

  const storageProvider = 'google_drive';
  const driveUrl = document.getElementById('sub-drive-folder-url')?.value.trim();
  const driveFolderId = driveUrl ? window.extractDriveFolderId(driveUrl) : null;

  return {
    enabled: true,
    acceptedExtensions: accepted,
    customExtensions: customStr,
    maxFiles,
    maxFileSizeMB,
    maxAttempts,
    deadlineMode,
    deadlineAt,
    allowLateSubmission,
    filenameTemplate,
    filenameMode,
    fileTypeCategory,
    visibility: {
      admin: true,
      supervisor: visSupervisor,
      reviewer: visReviewer,
      council: visCouncil
    },
    storageProvider,
    driveFolderId
  };
};

// 3. EFFECTIVE DEADLINE, ATTEMPTS & RULES
window.getEffectiveSubmissionRules = function(studentId, activity, round) {
  const cfg = activity?.submissionConfig || {};
  const override = round?.submissionOverrides?.[studentId]?.[activity?.id] || null;

  // Base deadline
  let baseDeadline = null;
  if (cfg.deadlineMode === 'custom' && cfg.deadlineAt) {
    baseDeadline = new Date(cfg.deadlineAt);
  } else if (activity?.endAt) {
    baseDeadline = new Date(activity.endAt);
  }

  // Effective deadline
  let effectiveDeadline = baseDeadline;
  let isExtended = false;
  if (override?.allowUntil) {
    effectiveDeadline = new Date(override.allowUntil);
    isExtended = true;
  }

  // Attempts
  const extraAttempts = (override && typeof override.extraAttempts === 'number') ? override.extraAttempts : 0;
  const baseMaxAttempts = cfg.maxAttempts ?? 3;
  const totalAllowedAttempts = baseMaxAttempts + extraAttempts;

  // Submissions record
  const subRecord = round?.activitySubmissions?.[activity?.id]?.[studentId] || null;
  const attemptsList = Array.isArray(subRecord?.attempts)
    ? subRecord.attempts
    : (subRecord?.currentSubmission ? [subRecord.currentSubmission] : []);
  const completedAttempts = attemptsList.filter(a => a.status !== 'withdrawn').length;
  const remainingAttempts = Math.max(0, totalAllowedAttempts - completedAttempts);

  // Time status
  const now = new Date();
  const startAt = activity?.startAt ? new Date(activity.startAt) : null;
  const isNotStarted = startAt ? (now < startAt) : false;
  const isPastDeadline = effectiveDeadline ? (now > effectiveDeadline) : false;
  const isNearDeadline = effectiveDeadline && !isPastDeadline && ((effectiveDeadline - now) <= 24 * 3600 * 1000);

  const allowLate = Boolean(cfg.allowLateSubmission);
  const canSubmit = !isNotStarted && (remainingAttempts > 0) && (!isPastDeadline || allowLate);
  const isLate = isPastDeadline;

  return {
    baseDeadline,
    effectiveDeadline,
    isExtended,
    extraAttempts,
    baseMaxAttempts,
    totalAllowedAttempts,
    completedAttempts,
    remainingAttempts,
    isNotStarted,
    isPastDeadline,
    isNearDeadline,
    isLate,
    allowLate,
    canSubmit,
    currentSubmission: subRecord?.currentSubmission || null,
    attemptsHistory: Array.isArray(subRecord?.attempts) ? subRecord.attempts : []
  };
};

// 4. STORAGE PROVIDER ABSTRACTION & DRIVE READINESS
window.uploadProvider = {
  async upload({ file, student, activity, round, attempt, onProgress, abortSignal }) {
    const providerType = activity?.submissionConfig?.storageProvider || 'google_drive';
    if (window.__DEV_MOCK_UPLOADER === true) {
      return await MockUploader.upload({ file, student, activity, round, attempt, onProgress, abortSignal });
    }
    if (providerType === 'google_drive') {
      return await GoogleDriveTrustedUploader.upload({ file, student, activity, round, attempt, onProgress, abortSignal });
    }
    return {
      success: false,
      status: 'notConfigured',
      error: 'Chưa cấu hình dịch vụ lưu trữ (Storage Provider).'
    };
  }
};

window.GoogleDriveTrustedUploader = {
  async upload({ file, student, activity, round, attempt, onProgress, abortSignal }) {
    if (state.impersonation) {
      assertNotImpersonatingForWrite('Tải lên Google Drive');
      return {
        success: false,
        error: '[CHẾ ĐỘ CHỈ ĐỌC] Không thể tải tệp lên trong chế độ đóng vai.'
      };
    }
    const endpoint = window.IFA_CONFIG?.driveUploadEndpoint;
    if (!endpoint) {
      return {
        success: false,
        status: 'backendRequired',
        error: 'Google Drive chưa được kết nối an toàn. Cần cấu hình dịch vụ tải tệp phía máy chủ (Trusted Backend Service).'
      };
    }
    try {
      const idToken = state.user ? await state.user.getIdToken() : null;
      if (!idToken) {
        return { success: false, error: 'Chưa đăng nhập. Vui lòng tải lại trang và đăng nhập lại.' };
      }

      const sessionRes = await fetch(endpoint + '/api/graduation/upload-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + idToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityId: activity.id,
          roundId: round.id,
          studentId: student.studentId || student.mssv,
          folderId: activity?.submissionConfig?.driveFolderId || activity?.driveFolderId || round?.driveRootFolderId || '1M37ovlEHS3ufftFPZHGj1mQWec7r8Tj7',
          file: {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size
          }
        }),
        signal: abortSignal
      });

      const sessionData = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok) {
        return { success: false, error: sessionData.error || `Lỗi máy chủ (${sessionRes.status}).` };
      }

      const sessionUri = sessionData.sessionUri;
      if (!sessionUri) {
        return { success: false, error: 'Không thể tạo phiên tải lên (Session URI rỗng).' };
      }

      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sessionUri, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            xhr.abort();
            resolve({ success: false, error: 'Đã hủy tải lên.' });
          });
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201 || xhr.status === 308) {
            let resObj = {};
            try { resObj = JSON.parse(xhr.responseText); } catch (e) {}
            resolve({
              success: true,
              status: 'submitted',
              providerFileId: resObj.id || 'drive_file_unknown',
              providerUrl: resObj.id ? `https://drive.google.com/file/d/${resObj.id}/view` : null,
              storageProvider: 'google_drive'
            });
          } else {
            resolve({ success: false, error: `Lỗi lưu trữ Drive (${xhr.status}).` });
          }
        };

        xhr.onerror = (e) => {
          console.error('[GoogleDriveTrustedUploader] XHR error:', e, xhr.status, xhr.statusText);
          resolve({ success: false, error: 'Lỗi mạng khi tải lên Drive.' });
        };
        xhr.send(file);
      });
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, error: 'Đã hủy tải lên.' };
      console.error('[GoogleDriveTrustedUploader] error:', err);
      return { success: false, error: 'Lỗi hệ thống trong quá trình tải lên.' };
    }
  }
};

window.MockUploader = {
  async upload({ file, student, activity, round, attempt, onProgress, abortSignal }) {
    // Only used in DEV/TEST environment when window.__DEV_MOCK_UPLOADER === true
    if (typeof onProgress === 'function') {
      onProgress(30);
      await new Promise(r => setTimeout(r, 20));
      onProgress(75);
      await new Promise(r => setTimeout(r, 20));
      onProgress(100);
    }
    return {
      success: true,
      status: 'submitted',
      providerFileId: 'mock_drive_file_' + Date.now(),
      providerUrl: 'https://drive.google.com/file/d/mock_' + Date.now() + '/view',
      storageProvider: 'google_drive_mock'
    };
  }
};

// 5. CLIENT-SIDE VALIDATION BEFORE UPLOAD
window.validateFileSubmission = function(files, student, activity, round) {
  const cfg = activity?.submissionConfig || {};
  const rules = getEffectiveSubmissionRules(student?.studentId || student?.mssv, activity, round);

  const errors = [];
  if (!files || files.length === 0) {
    errors.push('Vui lòng chọn ít nhất 1 file để nộp!');
    return { valid: false, errors };
  }

  // Max files
  const maxFiles = cfg.maxFiles || 1;
  if (files.length > maxFiles) {
    errors.push(`Số lượng file vượt quá mức cho phép (Tối đa: ${maxFiles} file, hiện chọn: ${files.length} file).`);
  }

  // Attempts check
  if (rules.remainingAttempts <= 0) {
    errors.push(`Bạn đã sử dụng hết ${rules.totalAllowedAttempts} lần nộp cho mốc này.`);
  }

  // Deadline check
  if (rules.isPastDeadline && !rules.allowLate) {
    errors.push('Đã hết hạn nộp bài và mốc này không cho phép nộp trễ.');
  }

  const maxBytes = (cfg.maxFileSizeMB || 100) * 1024 * 1024;
  let expectedFilename = '';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // Size check
    if (file.size > maxBytes) {
      errors.push(`File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) vượt quá dung lượng tối đa ${cfg.maxFileSizeMB || 100} MB.`);
    }

    // Filename check
    const fnCheck = validateFilename({
      filename: file.name,
      template: cfg.filenameTemplate,
      student,
      activity,
      round,
      fileTypeCategory: cfg.fileTypeCategory,
      mode: cfg.filenameMode,
      acceptedExtensions: cfg.acceptedExtensions
    });

    if (!fnCheck.valid) {
      errors.push(fnCheck.error);
    }
    if (!expectedFilename && fnCheck.expectedFilename) {
      expectedFilename = fnCheck.expectedFilename;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    isLate: rules.isLate,
    rules,
    expectedFilename
  };
};

// 6. STUDENT SUBMISSION PANEL RENDERING IN TIMELINE CARD
window.renderStudentSubmissionPanel = function(act, round) {
  const userMssv = state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const targetStudent =
    (round?.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.adminReviewData?.registrations || []).find(r => r.studentId === userMssv) || {
      studentId: userMssv,
      studentName: state.user?.displayName || (userMssv ? userMssv : 'Sinh viên')
    };

  const cfg = act.submissionConfig || {};
  const rules = getEffectiveSubmissionRules(userMssv, act, round);

  // Status Badge
  let statusBadge = '';
  if (rules.currentSubmission && rules.currentSubmission.status === 'submitted') {
    statusBadge = rules.currentSubmission.isLate
      ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">● Nộp trễ</span>'
      : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã nộp bài</span>';
  } else if (rules.isNotStarted) {
    statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">○ Chưa mở nhận bài</span>';
  } else if (rules.isPastDeadline) {
    statusBadge = rules.allowLate
      ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">● Đang nhận nộp trễ</span>'
      : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">✕ Đã hết hạn</span>';
  } else if (rules.isNearDeadline) {
    statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-400 animate-pulse">⚠️ Sắp hết hạn</span>';
  } else {
    statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">● Đang nhận bài</span>';
  }

  const deadlineStr = rules.effectiveDeadline ? fmtIsoToVietnameseDateTime(rules.effectiveDeadline.toISOString()) : 'Không giới hạn';
  const expectedFn = generateExpectedFilename({
    template: cfg.filenameTemplate,
    student: targetStudent,
    activity: act,
    round,
    fileTypeCategory: cfg.fileTypeCategory,
    extension: (cfg.acceptedExtensions || ['pdf'])[0] || 'pdf',
    mode: cfg.filenameMode
  });

  const acceptAttr = (cfg.acceptedExtensions || ['pdf']).map(e => '.' + e.replace(/^\./, '')).join(',');
  const isMultiple = (cfg.maxFiles || 1) > 1;

  // History html
  let historyHtml = '';
  if (rules.attemptsHistory.length > 0) {
    historyHtml = `
      <div class="mt-3 pt-3 border-t border-emerald-200/70 space-y-1.5">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-bold text-slate-700">Lịch sử các lần nộp bài:</span>
          <span class="text-slate-500 font-mono text-[10px]">${rules.completedAttempts}/${rules.totalAllowedAttempts} lần</span>
        </div>
        <div class="space-y-1.5">
          ${rules.attemptsHistory.map((att, idx) => {
            const isLatest = idx === rules.attemptsHistory.length - 1;
            const timeFormatted = att.submittedAt ? fmtIsoToVietnameseDateTime(att.submittedAt) : '--';
            const fName = att.files?.[0]?.validatedName || att.files?.[0]?.originalName || 'file';
            const fSize = att.files?.[0]?.size ? (att.files[0].size / (1024 * 1024)).toFixed(1) + ' MB' : '';
            return `
              <div class="p-2 bg-white rounded-lg border ${isLatest ? 'border-emerald-300 shadow-xs' : 'border-slate-200 opacity-80'} flex items-center justify-between text-xs">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold ${isLatest ? 'text-emerald-900' : 'text-slate-700'}">Lần ${att.attempt || (idx + 1)}</span>
                    ${isLatest ? '<span class="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">Bản hiện tại</span>' : ''}
                    ${att.isLate ? '<span class="text-[9px] bg-rose-100 text-rose-800 font-bold px-1 rounded">Nộp trễ</span>' : '<span class="text-[9px] bg-slate-100 text-slate-600 px-1 rounded">Đúng hạn</span>'}
                    ${att.status === 'withdrawn' ? '<span class="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">Đã rút</span>' : ''}
                  </div>
                  <span class="text-[11px] text-slate-600 font-mono block truncate max-w-xs mt-0.5">${fName} (${fSize})</span>
                  <span class="text-[10px] text-slate-400 font-mono block">Biên nhận: ${att.receiptId || '--'} • ${timeFormatted}</span>
                </div>
                ${isLatest && att.status !== 'withdrawn' ? `
                  <button type="button" onclick="withdrawStudentSubmission('${act.id}', ${att.attempt || 1}, '${round.id}')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold transition-colors">
                    Rút bài
                  </button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div id="sub-panel-${act.id}" class="mt-3 p-3.5 bg-emerald-50/70 border border-emerald-200 text-slate-800 rounded-2xl text-xs space-y-3 shadow-xs">
      <div class="flex items-center justify-between gap-2 border-b border-emerald-200/70 pb-2">
        <div class="flex items-center gap-2">
          <span class="text-lg">📥</span>
          <div>
            <span class="font-black text-emerald-950 text-xs sm:text-sm block">Nộp bài trực tuyến</span>
            <span class="text-[10px] text-emerald-800 font-mono">Hạn nộp: ${deadlineStr}</span>
          </div>
        </div>
        ${statusBadge}
      </div>

      <!-- Constraints notice -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-slate-200/80">
        <div>
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Định dạng</span>
          <span class="font-bold text-slate-800">${(cfg.acceptedExtensions || ['pdf']).map(e => e.toUpperCase()).join(', ')}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Dung lượng tối đa</span>
          <span class="font-bold text-slate-800">≤ ${cfg.maxFileSizeMB || 100} MB</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Số file</span>
          <span class="font-bold text-slate-800">${cfg.maxFiles || 1} file</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Lượt nộp còn lại</span>
          <span class="font-bold font-mono ${rules.remainingAttempts > 0 ? 'text-emerald-700' : 'text-rose-600'}">${rules.remainingAttempts} / ${rules.totalAllowedAttempts}</span>
        </div>
      </div>

      <!-- Override notice if applicable -->
      ${rules.isExtended ? `
        <div class="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
          <span>⭐</span>
          <span>Bạn được gia hạn nộp bài riêng đến: <strong>${fmtIsoToVietnameseDateTime(rules.effectiveDeadline.toISOString())}</strong></span>
        </div>
      ` : ''}
      ${rules.extraAttempts > 0 ? `
        <div class="p-2 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 font-semibold flex items-center gap-1.5">
          <span>⭐</span>
          <span>Bạn được cấp thêm <strong>${rules.extraAttempts}</strong> lần nộp bài.</span>
        </div>
      ` : ''}

      <!-- Expected Filename Rule -->
      <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
        <span class="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Tên file yêu cầu:</span>
        <div class="font-mono text-xs font-bold text-emerald-900 bg-white p-1.5 rounded border border-slate-200 select-all">
          ${expectedFn}
        </div>
        <span class="text-[10px] text-slate-400 block italic">Quy tắc: ${cfg.filenameMode === 'prefix' ? 'Bắt đầu đúng mẫu trên (tiền tố)' : 'Khớp chính xác tên trên'} • Không dấu, viết hoa</span>
      </div>

      <!-- Upload Section -->
      ${rules.canSubmit ? `
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <input type="file" id="sub-input-file-${act.id}" accept="${acceptAttr}" ${isMultiple ? 'multiple' : ''} onchange="onStudentFileSelected('${act.id}')" class="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer">
          </div>
          <div id="sub-selected-file-info-${act.id}" class="hidden p-2 bg-white rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700">
            <!-- Populated on file select -->
          </div>

          <!-- Upload Progress -->
          <div id="sub-progress-wrap-${act.id}" class="hidden space-y-1">
            <div class="flex items-center justify-between text-[11px] font-semibold">
              <span id="sub-progress-text-${act.id}" class="text-emerald-800">Đang tải: 0%</span>
              <button type="button" onclick="cancelStudentUpload('${act.id}')" class="text-rose-600 hover:underline font-bold text-[10px]">Hủy tải</button>
            </div>
            <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div id="sub-progress-bar-${act.id}" class="bg-emerald-600 h-2 transition-all duration-200" style="width: 0%"></div>
            </div>
          </div>

          <!-- Error notice box -->
          <div id="sub-error-box-${act.id}" class="hidden p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[11px] space-y-1">
          </div>

          <div class="flex items-center gap-2 pt-1">
            <button type="button" onclick="checkStudentFileSubmission('${act.id}')" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 transition-colors">
              🔍 Kiểm tra file
            </button>
            <button type="button" id="btn-submit-file-${act.id}" onclick="submitStudentFiles('${act.id}')" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors">
              📤 Nộp bài (Lần ${rules.completedAttempts + 1}/${rules.totalAllowedAttempts})
            </button>
          </div>
        </div>
      ` : `
        <div class="p-3 bg-slate-100 border border-slate-200 rounded-xl text-center text-slate-600 font-semibold text-xs">
          ${rules.remainingAttempts <= 0
            ? 'Bạn đã hết số lần nộp bài cho mốc này.'
            : (rules.isPastDeadline ? 'Mốc này đã kết thúc hạn nộp bài.' : 'Mốc kế hoạch chưa mở nhận bài.')}
        </div>
      `}

      ${historyHtml}
    </div>
  `;
};

window.onStudentFileSelected = function(actId) {
  const fileInput = document.getElementById('sub-input-file-' + actId);
  const infoEl = document.getElementById('sub-selected-file-info-' + actId);
  const errBox = document.getElementById('sub-error-box-' + actId);
  if (errBox) errBox.classList.add('hidden');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (infoEl) infoEl.classList.add('hidden');
    return;
  }

  const files = Array.from(fileInput.files);
  const infoText = files.map(f => `• ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`).join('<br>');
  if (infoEl) {
    infoEl.innerHTML = infoText;
    infoEl.classList.remove('hidden');
  }
};

window.checkStudentFileSubmission = function(actId) {
  const round = (state.rounds || []).find(r => r.id === state.selectedRoundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  const fileInput = document.getElementById('sub-input-file-' + actId);
  const errBox = document.getElementById('sub-error-box-' + actId);

  if (!round || !act) return;
  const files = fileInput?.files ? Array.from(fileInput.files) : [];
  const userMssv = state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const targetStudent =
    (round?.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.adminReviewData?.registrations || []).find(r => r.studentId === userMssv) || {
      studentId: userMssv,
      studentName: state.user?.displayName || (userMssv ? userMssv : 'Sinh viên')
    };

  const valRes = validateFileSubmission(files, targetStudent, act, round);
  if (!valRes.valid) {
    if (errBox) {
      errBox.innerHTML = `<strong>⚠️ Kiểm tra phát hiện lỗi:</strong><br>` + valRes.errors.map(e => `• ${e}`).join('<br>');
      errBox.classList.remove('hidden');
    }
    showToast('Tệp nộp chưa đúng yêu cầu. Vui lòng kiểm tra lại!', 'warning');
  } else {
    if (errBox) errBox.classList.add('hidden');
    showToast(`✅ File hợp lệ! Tên file chuẩn: ${valRes.expectedFilename}`, 'success');
  }
};

window.cancelStudentUpload = function(actId) {
  if (window._currentUploadAbort) {
    window._currentUploadAbort.abort();
    window._currentUploadAbort = null;
  }
  const progWrap = document.getElementById('sub-progress-wrap-' + actId);
  if (progWrap) progWrap.classList.add('hidden');
  showToast('Đã hủy quá trình tải tệp.', 'info');
};

window.submitStudentFiles = async function(actId) {
  if (!checkImpersonationWriteGuard('Nộp tệp tin bài làm mốc kế hoạch')) return;

  const round = (state.rounds || []).find(r => r.id === state.selectedRoundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  const fileInput = document.getElementById('sub-input-file-' + actId);
  const errBox = document.getElementById('sub-error-box-' + actId);
  const submitBtn = document.getElementById('btn-submit-file-' + actId);
  const progWrap = document.getElementById('sub-progress-wrap-' + actId);
  const progText = document.getElementById('sub-progress-text-' + actId);
  const progBar = document.getElementById('sub-progress-bar-' + actId);

  if (!round || !act) return;
  const files = fileInput?.files ? Array.from(fileInput.files) : [];
  const userMssv = state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const targetStudent =
    (round?.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.adminReviewData?.registrations || []).find(r => r.studentId === userMssv) || {
      studentId: userMssv,
      studentName: state.user?.displayName || (userMssv ? userMssv : 'Sinh viên')
    };

  // Client-side Validation
  const valRes = validateFileSubmission(files, targetStudent, act, round);
  if (!valRes.valid) {
    if (errBox) {
      errBox.innerHTML = `<strong>⚠️ Lỗi nộp bài:</strong><br>` + valRes.errors.map(e => `• ${e}`).join('<br>');
      errBox.classList.remove('hidden');
    }
    showToast('Tệp nộp không hợp lệ, không thể nộp bài!', 'error');
    return;
  }

  if (errBox) errBox.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Đang xử lý...</span>';
  }
  if (progWrap) progWrap.classList.remove('hidden');

  const abortController = new AbortController();
  window._currentUploadAbort = abortController;

  try {
    let file = files[0];
    if (valRes.expectedFilename) {
      file = new File([file], valRes.expectedFilename, { type: file.type });
    }
    const attemptNum = valRes.rules.completedAttempts + 1;

    // Call storage provider abstraction
    const uploadRes = await uploadProvider.upload({
      file,
      student: targetStudent,
      activity: act,
      round,
      attempt: attemptNum,
      onProgress: (pct) => {
        if (progText) progText.textContent = `Đang tải: ${pct}%`;
        if (progBar) progBar.style.width = `${pct}%`;
      },
      abortSignal: abortController.signal
    });

    if (!uploadRes.success) {
      // HONEST ERROR REPORTING: Never fake success
      if (errBox) {
        errBox.innerHTML = `<strong>⚠️ ${uploadRes.status === 'backendRequired' ? 'Bảo mật Google Drive:' : 'Lỗi tải lên:'}</strong><br>${uploadRes.error}`;
        errBox.classList.remove('hidden');
      }
      showToast(uploadRes.error || 'Tải tệp không thành công', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = `📤 Nộp bài (Lần ${attemptNum}/${valRes.rules.totalAllowedAttempts})`;
      }
      if (progWrap) progWrap.classList.add('hidden');
      return;
    }

    // Atomic metadata creation after transport success
    const receiptId = 'REC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const submissionMetadata = {
      studentId: userMssv,
      studentName: targetStudent.studentName,
      activityId: act.id,
      activityTitle: act.title,
      roundId: round.id,
      attempt: attemptNum,
      receiptId,
      files: [
        {
          originalName: file.name,
          validatedName: valRes.expectedFilename,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          storageProvider: uploadRes.storageProvider || 'google_drive',
          providerFileId: uploadRes.providerFileId || null,
          providerUrl: uploadRes.providerUrl || null
        }
      ],
      submittedAt: new Date().toISOString(),
      isLate: valRes.isLate,
      status: 'submitted',
      submittedBy: state.user?.email || userMssv
    };

    if (!round.activitySubmissions) round.activitySubmissions = {};
    if (!round.activitySubmissions[act.id]) round.activitySubmissions[act.id] = {};
    const existingEntry = round.activitySubmissions[act.id][userMssv] || { attempts: [] };
    const newAttempts = [...(existingEntry.attempts || []), submissionMetadata];

    round.activitySubmissions[act.id][userMssv] = {
      currentSubmission: submissionMetadata,
      attempts: newAttempts
    };

    // Save metadata to Firestore round document
    try {
      const roundRef = doc(db, 'graduationRounds', round.id);
      await updateDoc(roundRef, {
        [`activitySubmissions.${act.id}.${userMssv}`]: {
          currentSubmission: submissionMetadata,
          attempts: newAttempts
        },
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Could not update Firestore activitySubmissions directly:', e);
    }

    showToast(`✅ Nộp bài thành công! Mã biên nhận: ${receiptId}`, 'success');
    loadStudentRoundActivities(round.id);
  } catch (err) {
    console.error('Submit error:', err);
    if (errBox) {
      errBox.innerHTML = `<strong>⚠️ Lỗi hệ thống:</strong><br>${err.message || 'Quá trình nộp bài bị gián đoạn'}`;
      errBox.classList.remove('hidden');
    }
    showToast('Lỗi khi nộp bài: ' + (err.message || 'Không xác định'), 'error');
  } finally {
    window._currentUploadAbort = null;
    if (submitBtn) {
      submitBtn.disabled = false;
    }
    if (progWrap) progWrap.classList.add('hidden');
  }
};

window.withdrawStudentSubmission = async function(actId, attemptNum, optRoundId) {
  if (!checkImpersonationWriteGuard('Rút bài nộp')) return;

  const round = (state.rounds || []).find(r => r.id === (optRoundId || state.selectedRoundId)) || state.rounds?.[0];
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) {
    showToast('Không tìm thấy thông tin hoạt động!', 'error');
    return;
  }

  const userMssv = state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const subEntry = round?.activitySubmissions?.[actId]?.[userMssv];
  if (!subEntry || !subEntry.currentSubmission) {
    showToast('Không tìm thấy bài nộp để rút!', 'warning');
    return;
  }

  const confirmed = await showConfirm(
    'Xác nhận rút bài nộp?',
    'Tệp trên Google Drive sẽ được tự động xóa để giải phóng dung lượng. Bài nộp này sẽ chuyển sang trạng thái "Đã rút" và bạn có thể nộp lại nếu còn lượt.',
    { confirmText: 'Rút bài nộp', cancelText: 'Hủy', danger: true }
  );
  if (!confirmed) return;

  try {
    showToast('Đang xử lý rút bài và xóa tệp Drive...', 'info');

    const withdrawnSubmission = {
      ...subEntry.currentSubmission,
      status: 'withdrawn',
      withdrawnAt: new Date().toISOString()
    };

    const updatedAttempts = (subEntry.attempts || []).map(att => {
      if (att.receiptId === withdrawnSubmission.receiptId || (!att.receiptId && att.attempt === attemptNum)) {
        return { ...att, status: 'withdrawn', withdrawnAt: new Date().toISOString() };
      }
      return att;
    });

    // Call backend to delete file from Google Drive
    const endpoint = window.IFA_CONFIG?.driveUploadEndpoint;
    const idToken = state.user ? await state.user.getIdToken() : null;
    const filesToDelete = (subEntry.currentSubmission.files || []).filter(f => f.providerFileId && f.storageProvider === 'google_drive');

    if (endpoint && idToken && filesToDelete.length > 0) {
      for (const f of filesToDelete) {
        try {
          const delRes = await fetch(endpoint + '/api/graduation/delete-file', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + idToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileId: f.providerFileId })
          });
          console.log('[withdraw] Delete Drive file response status:', delRes.status);
        } catch (errDel) {
          console.warn('[withdraw] Error deleting file from Drive:', errDel);
        }
      }
    }

    if (!round.activitySubmissions) round.activitySubmissions = {};
    if (!round.activitySubmissions[actId]) round.activitySubmissions[actId] = {};
    round.activitySubmissions[actId][userMssv] = {
      currentSubmission: withdrawnSubmission,
      attempts: updatedAttempts
    };

    try {
      const roundRef = doc(db, 'graduationRounds', round.id);
      await updateDoc(roundRef, {
        [`activitySubmissions.${actId}.${userMssv}`]: {
          currentSubmission: withdrawnSubmission,
          attempts: updatedAttempts
        },
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('[withdraw] Could not update Firestore directly:', e);
    }

    showToast('Đã rút bài nộp và xóa tệp thành công!', 'success');
    loadStudentRoundActivities(round.id);
  } catch (err) {
    console.error('Withdraw error:', err);
    showToast('Lỗi khi rút bài: ' + (err.message || String(err)), 'error');
  }
};

// 7. ADMIN ACTIVITY SUBMISSIONS DASHBOARD
window.openActivitySubmissionDashboard = function(roundId, actId) {
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) {
    showToast('Không tìm thấy thông tin mốc kế hoạch!', 'error');
    return;
  }

  state._currentSubDash = { roundId, actId };

  const titleEl = document.getElementById('sub-dash-title');
  const subEl = document.getElementById('sub-dash-subtitle');
  if (titleEl) titleEl.innerHTML = `<span>📥</span> Quản lý Sinh viên Nộp bài — ${act.title}`;
  if (subEl) subEl.textContent = `Đợt: ${round.title} • Mốc: ${act.title}`;

  const searchInput = document.getElementById('sub-dash-search');
  if (searchInput) searchInput.value = '';
  const filterSelect = document.getElementById('sub-dash-filter-status');
  if (filterSelect) filterSelect.value = 'all';

  renderAdminSubmissionsTable();
  document.getElementById('modal-activity-submissions')?.classList.remove('hidden');
};

window.closeActivitySubmissionDashboard = function() {
  document.getElementById('modal-activity-submissions')?.classList.add('hidden');
  state._currentSubDash = null;
};

window.filterAdminSubmissionsTable = function() {
  renderAdminSubmissionsTable();
};

window.renderAdminSubmissionsTable = function() {
  if (!state._currentSubDash) return;
  const { roundId, actId } = state._currentSubDash;
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  const tbody = document.getElementById('sub-dash-tbody');
  if (!round || !act || !tbody) return;

  const registrations = state.adminReviewData?.registrations || [];
  const eligible = (round.eligibleStudents || []).filter(s => s.eligible !== false);
  const studentMap = new Map();

  eligible.forEach(s => {
    studentMap.set(s.studentId, {
      studentId: s.studentId,
      studentName: s.name || s.studentName || 'Sinh viên'
    });
  });
  registrations.forEach(r => {
    if (r.studentId) {
      studentMap.set(r.studentId, {
        studentId: r.studentId,
        studentName: r.studentName || studentMap.get(r.studentId)?.studentName || 'Sinh viên'
      });
    }
  });

  const students = Array.from(studentMap.values());
  const submissionsMap = round.activitySubmissions?.[actId] || {};

  let totalCount = students.length;
  let submittedCount = 0;
  let missingCount = 0;
  let lateCount = 0;

  const items = students.map(st => {
    const subRecord = submissionsMap[st.studentId] || null;
    const current = subRecord?.currentSubmission || null;
    const rules = getEffectiveSubmissionRules(st.studentId, act, round);

    let status = 'missing';
    if (current) {
      if (current.status === 'withdrawn') status = 'withdrawn';
      else if (current.isLate) status = 'late';
      else status = 'submitted';
    }

    if (status === 'submitted') submittedCount++;
    else if (status === 'late') { submittedCount++; lateCount++; }
    else if (status === 'withdrawn') missingCount++;
    else missingCount++;

    return {
      student: st,
      subRecord,
      current,
      rules,
      status
    };
  });

  // Update Counters
  if (document.getElementById('sub-dash-stat-total')) document.getElementById('sub-dash-stat-total').textContent = totalCount;
  if (document.getElementById('sub-dash-stat-submitted')) document.getElementById('sub-dash-stat-submitted').textContent = submittedCount;
  if (document.getElementById('sub-dash-stat-missing')) document.getElementById('sub-dash-stat-missing').textContent = missingCount;
  if (document.getElementById('sub-dash-stat-late')) document.getElementById('sub-dash-stat-late').textContent = lateCount;

  // Filter
  const q = (document.getElementById('sub-dash-search')?.value || '').trim().toLowerCase();
  const fStatus = document.getElementById('sub-dash-filter-status')?.value || 'all';

  const filtered = items.filter(item => {
    if (q) {
      const matchMssv = item.student.studentId.toLowerCase().includes(q);
      const matchName = item.student.studentName.toLowerCase().includes(q);
      if (!matchMssv && !matchName) return false;
    }
    if (fStatus !== 'all') {
      if (fStatus === 'submitted' && (item.status !== 'submitted' && item.status !== 'late')) return false;
      if (fStatus === 'missing' && item.status !== 'missing') return false;
      if (fStatus === 'late' && item.status !== 'late') return false;
      if (fStatus === 'withdrawn' && item.status !== 'withdrawn') return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không có sinh viên nào thỏa điều kiện lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((item, idx) => {
    const { student, current, rules, status } = item;
    let statusPill = '';
    if (status === 'submitted') {
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã nộp</span>';
    } else if (status === 'late') {
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">● Nộp trễ</span>';
    } else if (status === 'withdrawn') {
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Đã rút bài</span>';
    } else {
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">Chưa nộp</span>';
    }

    const councilAssign = (act.councilStudentAssignments || []).find(a => a.studentId === student.studentId);
    const councilName = councilAssign?.councilCode || councilAssign?.councilId || '--';

    const timeStr = current?.submittedAt ? fmtIsoToVietnameseDateTime(current.submittedAt) : '--';
    const fName = current?.files?.[0]?.validatedName || current?.files?.[0]?.originalName || '--';
    const fSize = current?.files?.[0]?.size ? (current.files[0].size / (1024 * 1024)).toFixed(1) + ' MB' : '';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-2.5 text-center font-mono font-bold text-slate-400">#${idx + 1}</td>
        <td class="p-2.5">
          <span class="font-bold text-slate-900 block">${student.studentName}</span>
          <span class="font-mono text-slate-500 text-[11px] block">${student.studentId}</span>
        </td>
        <td class="p-2.5 text-center font-bold text-indigo-700">${councilName}</td>
        <td class="p-2.5 text-center whitespace-nowrap">${statusPill}</td>
        <td class="p-2.5 text-center font-mono font-bold text-slate-700">${rules.completedAttempts}/${rules.totalAllowedAttempts}</td>
        <td class="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">${timeStr}</td>
        <td class="p-2.5 max-w-xs">
          ${current ? `
            <div class="truncate text-[11px] font-mono text-slate-800" title="${fName}">${fName}</div>
            <div class="text-[10px] text-slate-400 font-mono">${fSize} ${current.receiptId ? '• ' + current.receiptId : ''}</div>
          ` : '<span class="text-slate-300">--</span>'}
        </td>
        <td class="p-2.5 text-right whitespace-nowrap space-x-1">
          ${current?.files?.[0]?.providerUrl ? `
            <a href="${current.files[0].providerUrl}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded text-[11px] transition-colors inline-block">
              👁️ Xem file
            </a>
          ` : ''}
          ${rules.attemptsHistory.length > 0 ? `
            <button type="button" onclick="openSubmissionHistoryModal('${student.studentId}', '${act.id}', '${round.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition-colors">
              📜 Lịch sử (${rules.attemptsHistory.length})
            </button>
          ` : ''}
          <button type="button" onclick="openSubmissionOverrideModal('${student.studentId}', '${act.id}', '${round.id}')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded text-[11px] transition-colors">
            ⭐ Gia hạn/Lượt
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

// 8. DEADLINE & ATTEMPTS OVERRIDE MODAL
window.openSubmissionOverrideModal = function(studentId, actId, roundId) {
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) return;

  state._currentOverride = { studentId, actId, roundId };

  const stNameEl = document.getElementById('sub-override-student-name');
  const actNameEl = document.getElementById('sub-override-activity-name');
  if (stNameEl) stNameEl.textContent = `Sinh viên: ${studentId}`;
  if (actNameEl) actNameEl.textContent = `Mốc Kế hoạch: ${act.title}`;

  const existingOvr = round?.submissionOverrides?.[studentId]?.[actId];
  if (existingOvr?.allowUntil) {
    const parts = isoToVietnameseDateTime(existingOvr.allowUntil);
    if (document.getElementById('sub-override-date')) document.getElementById('sub-override-date').value = parts.date;
    if (document.getElementById('sub-override-time')) document.getElementById('sub-override-time').value = parts.time;
  } else {
    if (document.getElementById('sub-override-date')) document.getElementById('sub-override-date').value = '';
    if (document.getElementById('sub-override-time')) document.getElementById('sub-override-time').value = '';
  }

  if (document.getElementById('sub-override-extra-attempts')) {
    document.getElementById('sub-override-extra-attempts').value = existingOvr?.extraAttempts ?? 0;
  }
  if (document.getElementById('sub-override-reason')) {
    document.getElementById('sub-override-reason').value = existingOvr?.reason || '';
  }

  document.getElementById('modal-submission-override')?.classList.remove('hidden');
};

window.closeSubmissionOverrideModal = function() {
  document.getElementById('modal-submission-override')?.classList.add('hidden');
  state._currentOverride = null;
};

window.saveSubmissionOverride = async function() {
  if (!state._currentOverride) return;
  const { studentId, actId, roundId } = state._currentOverride;
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) return;

  const oDate = document.getElementById('sub-override-date')?.value || '';
  const oTime = document.getElementById('sub-override-time')?.value || '';
  const allowUntil = (oDate && oTime) ? parseVietnameseDateTimeToIso(oDate, oTime) : null;
  const extraAttempts = parseInt(document.getElementById('sub-override-extra-attempts')?.value, 10) || 0;
  const reason = (document.getElementById('sub-override-reason')?.value || '').trim();

  if (!reason) {
    showToast('Vui lòng nhập lý do gia hạn / cấp thêm lượt nộp bài (* Bắt buộc)!', 'warning');
    return;
  }

  const overrideData = {
    allowUntil,
    extraAttempts,
    reason,
    createdAt: new Date().toISOString(),
    createdBy: state.user?.email || 'admin'
  };

  if (!round.submissionOverrides) round.submissionOverrides = {};
  if (!round.submissionOverrides[studentId]) round.submissionOverrides[studentId] = {};
  round.submissionOverrides[studentId][actId] = overrideData;

  // Save to Firestore
  try {
    const roundRef = doc(db, 'graduationRounds', round.id);
    await updateDoc(roundRef, {
      [`submissionOverrides.${studentId}.${actId}`]: overrideData,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Could not update Firestore submissionOverrides:', e);
  }

  // Audit log
  if (typeof recordRoundAuditLog === 'function') {
    await recordRoundAuditLog(round.id, {
      type: 'admin_override',
      action: 'Gia hạn / cấp lượt nộp bài',
      target: `MSSV: ${studentId}, Mốc: ${act.title}`,
      detail: `Gia hạn đến: ${allowUntil || 'Không'}, Cấp thêm: ${extraAttempts} lần. Lý do: ${reason}`,
      by: state.user?.email || 'admin'
    });
  }

  showToast('Đã lưu quyết định gia hạn thành công!', 'success');
  closeSubmissionOverrideModal();
  renderAdminSubmissionsTable();
};

// 9. SUBMISSION HISTORY MODAL
window.openSubmissionHistoryModal = function(studentId, actId, roundId) {
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) return;

  const stInfo = document.getElementById('sub-hist-student-info');
  const actInfo = document.getElementById('sub-hist-activity-info');
  const listEl = document.getElementById('sub-hist-list');

  if (stInfo) stInfo.textContent = `Sinh viên: ${studentId}`;
  if (actInfo) actInfo.textContent = `Mốc Kế hoạch: ${act.title}`;

  const subRecord = round.activitySubmissions?.[actId]?.[studentId];
  const history = Array.isArray(subRecord?.attempts) ? subRecord.attempts : [];

  if (!listEl) return;
  if (history.length === 0) {
    listEl.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Chưa có lịch sử nộp bài nào.</div>';
  } else {
    listEl.innerHTML = history.map((att, idx) => {
      const isLatest = idx === history.length - 1;
      const fName = att.files?.[0]?.validatedName || att.files?.[0]?.originalName || 'file';
      const fSize = att.files?.[0]?.size ? (att.files[0].size / (1024 * 1024)).toFixed(2) + ' MB' : '';
      const timeStr = att.submittedAt ? fmtIsoToVietnameseDateTime(att.submittedAt) : '--';
      return `
        <div class="p-3 bg-white rounded-xl border ${isLatest ? 'border-emerald-300 ring-1 ring-emerald-200 shadow-xs' : 'border-slate-200'} text-xs space-y-1">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-black text-sm text-slate-900">Lần nộp ${att.attempt || (idx + 1)}</span>
              ${isLatest ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Bản hiện tại</span>' : ''}
              ${att.isLate ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Nộp trễ</span>' : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Đúng hạn</span>'}
              ${att.status === 'withdrawn' ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Đã rút bài</span>' : ''}
            </div>
            <span class="font-mono text-[11px] text-slate-500">${timeStr}</span>
          </div>
          <div class="font-mono text-[11px] text-slate-800 bg-slate-50 p-2 rounded border border-slate-100 select-all">
            📁 ${fName} (${fSize})
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
            <span>Mã biên nhận: ${att.receiptId || '--'}</span>
            <span>Nộp bởi: ${att.submittedBy || '--'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('modal-submission-history')?.classList.remove('hidden');
};

window.closeSubmissionHistoryModal = function() {
  document.getElementById('modal-submission-history')?.classList.add('hidden');
};

// 10. EXCEL EXPORT OF ACTIVITY SUBMISSIONS
window.exportCurrentActivitySubmissionsToExcel = function() {
  if (!state._currentSubDash) return;
  const { roundId, actId } = state._currentSubDash;
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) {
    showToast('Không tìm thấy dữ liệu để xuất Excel!', 'error');
    return;
  }

  const registrations = state.adminReviewData?.registrations || [];
  const eligible = (round.eligibleStudents || []).filter(s => s.eligible !== false);
  const studentMap = new Map();
  eligible.forEach(s => studentMap.set(s.studentId, { studentId: s.studentId, studentName: s.name || s.studentName || 'Sinh viên' }));
  registrations.forEach(r => { if (r.studentId) studentMap.set(r.studentId, { studentId: r.studentId, studentName: r.studentName || studentMap.get(r.studentId)?.studentName || 'Sinh viên' }); });

  const submissionsMap = round.activitySubmissions?.[actId] || {};
  const rows = [
    [
      'STT',
      'MSSV',
      'Họ và Tên',
      'Hội đồng',
      'Mốc Kế hoạch',
      'Lần nộp',
      'Thời gian nộp',
      'Trạng thái',
      'Trễ hạn',
      'Tên file',
      'Dung lượng (MB)',
      'Mã biên nhận'
    ]
  ];

  let stt = 1;
  studentMap.forEach(st => {
    const subRecord = submissionsMap[st.studentId] || null;
    const current = subRecord?.currentSubmission || null;
    const rules = getEffectiveSubmissionRules(st.studentId, act, round);
    const councilAssign = (act.councilStudentAssignments || []).find(a => a.studentId === st.studentId);
    const councilName = councilAssign?.councilCode || councilAssign?.councilId || '';

    const timeStr = current?.submittedAt ? fmtIsoToVietnameseDateTime(current.submittedAt) : '';
    const fName = current?.files?.[0]?.validatedName || current?.files?.[0]?.originalName || '';
    const fSizeMB = current?.files?.[0]?.size ? (current.files[0].size / (1024 * 1024)).toFixed(2) : '';

    let statusText = 'Chưa nộp';
    if (current) {
      if (current.status === 'withdrawn') statusText = 'Đã rút bài';
      else if (current.isLate) statusText = 'Nộp trễ';
      else statusText = 'Đã nộp';
    }

    rows.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.studentName),
      sanitizeExcelCell(councilName),
      sanitizeExcelCell(act.title),
      `${rules.completedAttempts}/${rules.totalAllowedAttempts}`,
      sanitizeExcelCell(timeStr),
      sanitizeExcelCell(statusText),
      current ? (current.isLate ? 'Nộp trễ' : 'Đúng hạn') : '',
      sanitizeExcelCell(fName),
      fSizeMB ? parseFloat(fSizeMB) : '',
      sanitizeExcelCell(current?.receiptId || '')
    ]);
  });

  if (typeof window.XLSX === 'undefined') {
    showToast('Thư viện Excel chưa được tải!', 'error');
    return;
  }

  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(rows);
  const sheetName = sanitizeSheetName('NOP_BAI_' + (act.slug || act.id));
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const cleanActTitle = slugify(act.title);
  const dateStr = new Date().toISOString().slice(0, 10).split('-').reverse().join('-');
  const fileName = `Submissions_${cleanActTitle}_${dateStr}.xlsx`;

  window.XLSX.writeFile(wb, fileName);
  showToast('Đã xuất danh sách nộp bài sang Excel thành công!', 'success');
};

// 11. ROLE-BASED ACCESS CONTROL HELPER
window.canAccessStudentSubmission = function(userEmail, userRole, studentId, activity, round) {
  if (!activity || !activity.submissionConfig) return false;
  if (userRole === 'admin' || state.isAdmin) return true;
  if (userRole === 'student') {
    const studentUser = state.userStudentId || (userEmail ? userEmail.split('@')[0] : '');
    return String(studentId).toLowerCase() === String(studentUser).toLowerCase();
  }
  const vis = activity.submissionConfig.visibility || { supervisor: true, reviewer: true, council: true };
  if (vis.supervisor) {
    const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId);
    if (reg && typeof getOfficialSupervisors === 'function') {
      const isSupervised = getOfficialSupervisors(reg).some(s => (s.supervisorEmail || s.email) === userEmail);
      if (isSupervised) return true;
    }
  }
  if (vis.reviewer) {
    const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId);
    if (reg && reg.reviewerEmail === userEmail) return true;
  }
  if (vis.council && Array.isArray(activity.councils)) {
    const councilOfStudent = (activity.councilStudentAssignments || []).find(a => a.studentId === studentId);
    if (councilOfStudent) {
      const council = activity.councils.find(c => c.id === councilOfStudent.councilId);
      if (council && Array.isArray(council.members) && council.members.some(m => m.email === userEmail)) {
        return true;
      }
    }
  }
  return false;
};



// ============================================================================
// IFA+ GRADUATION BETA v2.3.1-beta.1:
// PHASE B MIGRATION — SUBCOLLECTION NEW-WRITE + DUAL-READ + TRANSACTIONS
// ============================================================================

// Helper to sanitize keys for document IDs
window.sanitizeFirestoreKey = function(key) {
  if (!key) return 'unknown';
  return String(key).replace(/[\/\\]/g, '_').replace(/\s+/g, '_');
};

// 1. COUNCIL SCORES SUBCOLLECTION HELPERS (NEW-WRITE + DUAL-READ)
window.buildDeterministicCouncilScoreId = function(activityId, councilId, studentId, scorerId) {
  const act = sanitizeFirestoreKey(activityId);
  const cId = sanitizeFirestoreKey(councilId);
  const stId = sanitizeFirestoreKey(studentId);
  const scId = sanitizeFirestoreKey(scorerId);
  return `${act}_${cId}_${stId}_${scId}`;
};

window.saveCouncilScoreRecord = async function(roundId, scoreData) {
  if (!checkImpersonationWriteGuard('Lưu điểm đánh giá hội đồng')) return { success: false, error: 'Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm.' };
  if (!roundId || !scoreData) return { success: false, error: 'Thiếu thông tin roundId hoặc scoreData' };

  const actId = scoreData.activityId;
  const cId = scoreData.councilId;
  const stId = scoreData.studentId;
  const scId = scoreData.scorerId || (scoreData.scorerEmail ? scoreData.scorerEmail.split('@')[0] : 'scorer');
  const scoreId = buildDeterministicCouncilScoreId(actId, cId, stId, scId);

  // Clean document payload
  const docPayload = {
    roundId,
    activityId: actId,
    councilId: cId,
    studentId: stId,
    studentName: scoreData.studentName || '',
    scorerId: scId,
    scorerEmail: scoreData.scorerEmail || '',
    scorerName: scoreData.scorerName || '',
    role: scoreData.role || 'member',
    mode: scoreData.scoreMode || 'defense_rubric',
    score: scoreData.score ?? null,
    total: scoreData.score ?? null,
    rubricScores: scoreData.rubricScores || {},
    components: scoreData.components || {},
    feedback: scoreData.feedback || '',
    status: scoreData.status || 'draft',
    isGuest: Boolean(scoreData.isGuest),
    isOfficialScorer: scoreData.isOfficialScorer !== false,
    calibration: scoreData.calibration || null,
    updatedAt: new Date().toISOString()
  };

  // 1. New Write: Save to subcollection /graduationRounds/{roundId}/councilScores/{scoreId}
  let subcolSuccess = false;
  try {
    const scoreRef = doc(db, 'graduationRounds', roundId, 'councilScores', scoreId);
    await setDoc(scoreRef, docPayload, { merge: true });
    subcolSuccess = true;
  } catch (err) {
    console.warn('Notice: Subcollection councilScores write pending rules approval:', err.message);
  }

  // 2. Phase B Activated: New writes go strictly to subcollection /graduationRounds/{roundId}/councilScores/{scoreId}.
  // We do NOT write into the parent round document to prevent document size bloat.
  const legacyKey = `${actId}_${cId}_${stId}_${scId}`;

  // Update local memory
  if (!state.councilScores) state.councilScores = {};
  state.councilScores[legacyKey] = docPayload;

  return { success: true, scoreId, docPayload, subcolSuccess };
};

window.getCouncilScoreRecord = async function({ roundId, activityId, councilId, studentId, scorerId, fallbackRound }) {
  const act = sanitizeFirestoreKey(activityId);
  const cId = sanitizeFirestoreKey(councilId);
  const st = sanitizeFirestoreKey(studentId);
  const sc = sanitizeFirestoreKey(scorerId);
  const scoreId = `${act}_${cId}_${st}_${sc}`;
  const legacyKey = scoreId;

  // 1. Primary: Try reading from Subcollection
  try {
    const scoreRef = doc(db, 'graduationRounds', roundId, 'councilScores', scoreId);
    const snap = await getDoc(scoreRef);
    if (snap && snap.exists()) {
      return snap.data();
    }
  } catch (e) {}

  // 2. Fallback: Read from in-memory state or fallbackRound.councilScores
  if (state.councilScores?.[legacyKey]) {
    return state.councilScores[legacyKey];
  }
  if (fallbackRound?.councilScores?.[legacyKey]) {
    return fallbackRound.councilScores[legacyKey];
  }

  return null;
};

// 2. SUBMISSIONS SUBCOLLECTION HELPERS (ATOMIC ATTEMPT + DUAL-READ)
window.saveSubmissionAttemptRecord = async function(roundId, activityId, studentId, submissionData) {
  if (!roundId || !activityId || !studentId || !submissionData) {
    return { success: false, error: 'Thiếu thông tin nộp bài' };
  }

  // Atomic attempt resolution: query existing docs or fallback to memory
  let existingAttemptsCount = 0;
  try {
    const subColRef = collection(db, 'graduationRounds', roundId, 'submissions');
    const q = query(subColRef, where('activityId', '==', activityId), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      existingAttemptsCount = snap.size;
    }
  } catch (e) {}

  if (existingAttemptsCount === 0) {
    const memAttempts = submissionData.existingAttempts || [];
    existingAttemptsCount = memAttempts.length;
  }

  const attemptNum = existingAttemptsCount + 1;
  const receiptId = submissionData.receiptId || ('REC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase());
  const submissionId = `${sanitizeFirestoreKey(activityId)}_${sanitizeFirestoreKey(studentId)}_att${attemptNum}_${Date.now()}`;

  const docPayload = {
    roundId,
    activityId,
    activityTitle: submissionData.activityTitle || '',
    studentId,
    studentName: submissionData.studentName || '',
    studentEmail: submissionData.studentEmail || (studentId + '@student.tdtu.edu.vn'),
    attempt: attemptNum,
    attemptNumber: attemptNum,
    receiptId,
    files: submissionData.files || [],
    submittedAt: submissionData.submittedAt || new Date().toISOString(),
    isLate: Boolean(submissionData.isLate),
    status: submissionData.status || 'submitted',
    submittedBy: submissionData.submittedBy || studentId
  };

  // 1. New Write: Save to subcollection /graduationRounds/{roundId}/submissions/{submissionId}
  let subcolSuccess = false;
  try {
    const subDocRef = doc(db, 'graduationRounds', roundId, 'submissions', submissionId);
    await setDoc(subDocRef, docPayload);
    subcolSuccess = true;
  } catch (err) {
    console.warn('Notice: Subcollection submissions write pending rules approval:', err.message);
  }

  // 2. Legacy Fallback Write (best-effort into round document)
  const round = (state.rounds || []).find(r => r.id === roundId);
  if (round) {
    if (!round.activitySubmissions) round.activitySubmissions = {};
    if (!round.activitySubmissions[activityId]) round.activitySubmissions[activityId] = {};
    const existingEntry = round.activitySubmissions[activityId][studentId] || { attempts: [] };
    const newAttempts = [...(existingEntry.attempts || []), docPayload];
    round.activitySubmissions[activityId][studentId] = {
      currentSubmission: docPayload,
      attempts: newAttempts
    };

    // Phase B Activated: Submissions are written strictly to subcollection.
    // Parent round doc is kept clean without appending submission payload arrays.
  }

  return { success: true, submissionId, attemptNumber: attemptNum, receiptId, docPayload, subcolSuccess };
};

window.getStudentSubmissionsRecord = async function(roundId, activityId, studentId, fallbackRound) {
  // 1. Primary: Query Subcollection
  try {
    const subColRef = collection(db, 'graduationRounds', roundId, 'submissions');
    const q = query(
      subColRef,
      where('activityId', '==', activityId),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      const attempts = snap.docs.map(d => d.data()).sort((a, b) => (a.attemptNumber || a.attempt || 0) - (b.attemptNumber || b.attempt || 0));
      const current = attempts[attempts.length - 1] || null;
      return { currentSubmission: current, attempts };
    }
  } catch (e) {}

  // 2. Fallback: Legacy nested map in round
  const targetRound = fallbackRound || (state.rounds || []).find(r => r.id === roundId);
  const legacyRecord = targetRound?.activitySubmissions?.[activityId]?.[studentId];
  if (legacyRecord) {
    const attempts = legacyRecord.attempts || [];
    const currentSubmission = legacyRecord.currentSubmission || attempts[attempts.length - 1] || null;
    return { currentSubmission, attempts };
  }

  return { currentSubmission: null, attempts: [] };
};

// 3. AUDIT LOGS SUBCOLLECTION HELPERS (APPEND-ONLY + DUAL-READ)
window.appendAuditLogRecord = async function(roundId, auditData) {
  if (!roundId || !auditData) return;

  const logId = auditData.id || ('log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  const docPayload = {
    id: logId,
    roundId,
    type: auditData.type || 'info',
    action: auditData.action || 'Hành động',
    target: auditData.target || '',
    detail: auditData.detail || '',
    by: auditData.by || state.user?.email || 'system',
    timestamp: auditData.timestamp || new Date().toISOString()
  };

  // 1. New Write: Save to subcollection /graduationRounds/{roundId}/auditLogs/{logId}
  try {
    const logRef = doc(db, 'graduationRounds', roundId, 'auditLogs', logId);
    await setDoc(logRef, docPayload);
  } catch (err) {
    console.warn('Notice: Subcollection auditLogs write pending rules approval:', err.message);
  }

  // 2. In-memory append to round
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (targetRound) {
    targetRound.auditLogs = targetRound.auditLogs || [];
    targetRound.auditLogs.unshift(docPayload);
  }
};

window.getRoundAuditLogs = async function(roundId, fallbackRound) {
  const targetRound = fallbackRound || (state.rounds || []).find(r => r.id === roundId);
  const legacyLogs = Array.isArray(targetRound?.auditLogs) ? targetRound.auditLogs : [];

  try {
    const logColRef = collection(db, 'graduationRounds', roundId, 'auditLogs');
    const snap = await getDocs(logColRef);
    if (snap && !snap.empty) {
      const subLogs = snap.docs.map(d => d.data());
      // Union and deduplicate by ID
      const map = new Map();
      subLogs.forEach(l => map.set(l.id, l));
      legacyLogs.forEach(l => {
        if (!map.has(l.id)) map.set(l.id, l);
      });
      return Array.from(map.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
  } catch (e) {}

  return legacyLogs;
};

// 4. FIRST-COMPLETED-WINS TRANSACTIONS (GVHD & TM HD)
window.submitSupervisorScoreTransaction = async function({ roundId, studentId, supervisorId, supervisorEmail, supervisorName, score, feedback, isCompleted }) {
  if (!checkImpersonationWriteGuard('Ghi nhận điểm GVHD')) throw new Error('Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm');
  const roundRef = doc(db, 'graduationRounds', roundId);
  const now = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const roundSnap = await transaction.get(roundRef);
    if (!roundSnap.exists()) {
      throw new Error('Đợt tốt nghiệp không tồn tại.');
    }

    const roundData = roundSnap.data();
    const existing = roundData.supervisorScores?.[studentId];

    // ATOMIC CHECK: First completed wins
    if (isCompleted && existing?.status === 'completed' && existing.submittedBySupervisorId !== supervisorId && !state.isAdmin) {
      throw new Error(`Điểm GVHD đã được hoàn tất trước bởi ${existing.submittedByName || 'giảng viên khác'}.`);
    }

    const newRecord = {
      roundId,
      studentId,
      score: isNaN(score) ? null : score,
      comment: feedback || '',
      submittedBySupervisorId: supervisorId,
      submittedByName: supervisorName,
      submittedByEmail: supervisorEmail,
      decidedBy: supervisorEmail,
      supervisorEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };

    transaction.update(roundRef, {
      [`supervisorScores.${studentId}`]: newRecord,
      updatedAt: serverTimestamp()
    });

    return newRecord;
  });
};

window.submitThesisScoreHDTransaction = async function({ roundId, studentId, supervisorId, supervisorEmail, supervisorName, score, feedback, isCompleted }) {
  if (!checkImpersonationWriteGuard('Ghi nhận điểm Đồ án HD')) throw new Error('Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm');
  const roundRef = doc(db, 'graduationRounds', roundId);
  const now = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const roundSnap = await transaction.get(roundRef);
    if (!roundSnap.exists()) {
      throw new Error('Đợt tốt nghiệp không tồn tại.');
    }

    const roundData = roundSnap.data();
    const existing = roundData.thesisScores?.[studentId]?.hd;

    // ATOMIC CHECK: First completed wins
    if (isCompleted && existing?.status === 'completed' && existing.submittedBySupervisorId !== supervisorId && !state.isAdmin) {
      throw new Error(`Điểm TM HD đã được hoàn tất trước bởi ${existing.submittedByName || 'giảng viên khác'}.`);
    }

    const newRecord = {
      roundId,
      studentId,
      score: isNaN(score) ? null : score,
      comment: feedback || '',
      submittedBySupervisorId: supervisorId,
      submittedByName: supervisorName,
      submittedByEmail: supervisorEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };

    transaction.update(roundRef, {
      [`thesisScores.${studentId}.hd`]: newRecord,
      updatedAt: serverTimestamp()
    });

    return newRecord;
  });
};



// ============================================================================
// PHASE 1: IFAA-STYLE ROUNDS MANAGEMENT & CARD VIEW
// ============================================================================

state.adminRoundsFilter = 'all';
state.adminRoundsSearch = '';

window.filterAdminRounds = function(filterKey) {
  state.adminRoundsFilter = filterKey;
  document.querySelectorAll('#admin-rounds-filter-pills .round-filter-btn').forEach(btn => {
    if (btn.dataset.filter === filterKey) {
      btn.className = 'round-filter-btn px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-900 text-white shadow-xs transition-all';
    } else {
      btn.className = 'round-filter-btn px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all';
    }
  });
  renderAdminRoundsCards();
};

window.searchAdminRounds = function(query) {
  state.adminRoundsSearch = (query || '').trim().toLowerCase();
  renderAdminRoundsCards();
};

function getRoundStatusCategory(r) {
  if (r.deleted) return 'deleted';
  if (r.hidden || r.status === 'hidden') return 'hidden';
  
  const now = Date.now();
  const openTime = r.openAtDate ? new Date(r.openAtDate).getTime() : null;
  const closeTime = r.closeAtDate ? new Date(r.closeAtDate).getTime() : null;
  
  if (r.status === 'closed' || (closeTime && now > closeTime)) {
    return 'ended';
  }
  if (r.status === 'upcoming' || (openTime && now < openTime)) {
    return 'upcoming';
  }
  return 'running';
}

window.renderAdminRoundsCards = function() {
  const container = document.getElementById('admin-rounds-cards');
  if (!container) return;

  const totalBadge = document.getElementById('admin-rounds-total-badge');
  const allNonDeleted = (state.rounds || []).filter(r => !r.deleted);
  if (totalBadge) totalBadge.textContent = `${allNonDeleted.length} đợt`;

  const filter = state.adminRoundsFilter || 'all';
  const searchQuery = state.adminRoundsSearch || '';

  let filtered = allNonDeleted.filter(r => {
    const cat = getRoundStatusCategory(r);
    if (filter === 'hidden') return cat === 'hidden';
    if (cat === 'hidden') return false;
    if (filter === 'upcoming') return cat === 'upcoming';
    if (filter === 'running') return cat === 'running';
    if (filter === 'ended') return cat === 'ended';
    return true;
  });

  if (searchQuery) {
    filtered = filtered.filter(r => {
      const title = (r.title || '').toLowerCase();
      const code = (r.shortCode || r.slug || r.roundName || r.id || '').toLowerCase();
      const year = (r.academicYear || '').toLowerCase();
      return title.includes(searchQuery) || code.includes(searchQuery) || year.includes(searchQuery);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card-surface p-10 text-center space-y-3 bg-white border border-dashed border-slate-300 rounded-2xl w-full">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl font-bold">
          📁
        </div>
        <p class="text-base font-bold text-slate-800">Không có đợt tốt nghiệp nào ở mục này</p>
        <p class="text-sm text-slate-500">Bạn có thể chuyển bộ lọc hoặc bấm "Tạo đợt tốt nghiệp" để thêm mới.</p>
        <div class="pt-1">
          <button onclick="openCreateRoundModal()" class="px-4 py-2 bg-tdtu-blue hover:bg-tdtu-dark text-white rounded-xl text-sm font-semibold shadow-xs transition-all">
            + Tạo đợt tốt nghiệp
          </button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(r => {
    const cat = getRoundStatusCategory(r);
    const shortCode = r.shortCode || r.slug || r.roundName || r.id;
    const timeRangeStr = fmtDateRange24h(r.openAtDate, r.closeAtDate);
    const isCurrentActive = Boolean(r.isActive);

    let statusBadgeHtml = '';
    if (cat === 'running') {
      statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>Đang diễn ra</span>';
    } else if (cat === 'upcoming') {
      statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Sắp mở</span>';
    } else if (cat === 'ended') {
      statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">Đã kết thúc</span>';
    } else if (cat === 'hidden') {
      statusBadgeHtml = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Đã ẩn</span>';
    }

    const activeBadgeHtml = isCurrentActive 
      ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white shadow-2xs">★ Đợt hiện hành</span>'
      : '';

    // Metrics
    const eligibleCount = typeof r.eligibleCount === 'number' ? r.eligibleCount : (r.eligibleStudentsCount || 0);
    const supCount = typeof r.supervisorCount === 'number' ? r.supervisorCount : (r.supervisorsCount || 0);
    const regCount = typeof r.registrationsCount === 'number' ? r.registrationsCount : 0;
    const actCount = typeof r.activitiesCount === 'number' ? r.activitiesCount : (r.activities ? r.activities.length : 0);

    let phaseInfo = '';
    if (r.reviewStatus === 'completed') {
      phaseInfo = 'Đã chốt phân công GVHD';
    } else if (r.currentRank) {
      phaseInfo = `Đang xét NV${r.currentRank}`;
    } else if (cat === 'running') {
      phaseInfo = 'Đang nhận đăng ký';
    } else if (cat === 'upcoming') {
      phaseInfo = 'Chưa mở cổng';
    } else {
      phaseInfo = 'Đã đóng đợt';
    }

    const isClosed = cat === 'ended';
    const isHidden = cat === 'hidden';

    // Highlight current active round with distinct soft light blue background
    const cardBgClass = isCurrentActive 
      ? 'bg-blue-50/70 border-blue-300 hover:border-blue-400 ring-1 ring-blue-200/80 shadow-xs' 
      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs';

    return `
      <article class="card-surface p-4 sm:p-5 ${cardBgClass} rounded-2xl hover:shadow-md transition-all space-y-3.5 w-full">
        
        <!-- TOP SECTION: BADGES & SHORTCODE (LEFT) + 4 METRICS BADGES (RIGHT) -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-slate-200/60 pb-3">
          
          <!-- Badges Left -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 border border-slate-300/60">
              ${r.academicYear || 'Đồ án TN'}
            </span>
            ${statusBadgeHtml}
            ${activeBadgeHtml}
            <button type="button" onclick="copyRoundLink('${r.id}', '${shortCode}')" title="Sao chép liên kết đợt ?x=${shortCode}" class="px-2 py-0.5 rounded text-slate-500 hover:text-blue-600 hover:bg-white transition-colors text-xs flex items-center gap-1 font-mono border border-slate-300/60 bg-white/80 shadow-2xs">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              <span>${shortCode}</span>
            </button>
          </div>

          <!-- Metrics Right (Moved up to top of card, renamed "SV") -->
          <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
              SV: <strong class="text-slate-900 text-sm font-bold">${eligibleCount}</strong>
            </span>
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
              GVHD: <strong class="text-indigo-700 text-sm font-bold">${supCount}</strong>
            </span>
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
              Đăng ký: <strong class="text-emerald-700 text-sm font-bold">${regCount}</strong>
            </span>
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
              Kế hoạch: <strong class="text-blue-700 text-sm font-bold">${actCount}</strong>
            </span>
          </div>

        </div>

        <!-- MIDDLE SECTION: ROUND TITLE & TIME/STATUS INFO -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div>
            <h3 class="text-xl sm:text-[22px] font-bold text-slate-900 leading-snug hover:text-tdtu-blue transition-colors">
              ${r.title}
            </h3>
          </div>
          
          <div class="flex items-center gap-3 text-xs sm:text-sm text-slate-600 flex-wrap shrink-0">
            <span class="flex items-center gap-1.5">
              <span>📅</span>
              <span class="font-mono text-xs sm:text-sm text-slate-800 font-semibold">${timeRangeStr}</span>
            </span>
            <span class="text-slate-300">•</span>
            <span class="flex items-center gap-1.5">
              <span>📌</span>
              <span class="text-xs sm:text-sm font-bold text-slate-800">${phaseInfo}</span>
            </span>
          </div>
        </div>

        <!-- BOTTOM ACTIONS ROW: 6 MAIN ACTIONS (LEFT) + SECONDARY ACTIONS (RIGHT) -->
        <div class="pt-3 border-t border-slate-200/60 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5">
          
          <!-- 6 Main Action Buttons (Primary Workflow) -->
          <div class="grid grid-cols-2 sm:grid-cols-3 xl:flex xl:flex-wrap items-center gap-1.5 sm:gap-2">
            <button type="button" onclick="navigateToRoundAction('${r.id}', 'timeline')" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-xl font-semibold text-xs sm:text-[13px] text-slate-800 flex items-center justify-center gap-1.5 transition-all shadow-2xs group">
              <span class="text-blue-600 group-hover:scale-110 transition-transform">📅</span>
              <span>Kế hoạch</span>
            </button>
            
            <button type="button" onclick="navigateToRoundAction('${r.id}', 'eligible-students')" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl font-semibold text-xs sm:text-[13px] text-slate-800 flex items-center justify-center gap-1.5 transition-all shadow-2xs group">
              <span class="text-indigo-600 group-hover:scale-110 transition-transform">🎓</span>
              <span>SV tốt nghiệp</span>
            </button>

            <button type="button" onclick="navigateToRoundAction('${r.id}', 'registrations')" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-400 rounded-xl font-semibold text-xs sm:text-[13px] text-slate-800 flex items-center justify-center gap-1.5 transition-all shadow-2xs group">
              <span class="text-emerald-600 group-hover:scale-110 transition-transform">📝</span>
              <span>Đăng ký</span>
            </button>

            <button type="button" onclick="navigateToRoundAction('${r.id}', 'review')" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-400 rounded-xl font-semibold text-xs sm:text-[13px] text-slate-800 flex items-center justify-center gap-1.5 transition-all shadow-2xs group">
              <span class="text-amber-600 group-hover:scale-110 transition-transform">🎯</span>
              <span>Xét nguyện vọng</span>
            </button>

            <button type="button" onclick="navigateToRoundAction('${r.id}', 'preview-student')" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-purple-400 rounded-xl font-semibold text-xs sm:text-[13px] text-slate-800 flex items-center justify-center gap-1.5 transition-all shadow-2xs group">
              <span class="text-purple-600 group-hover:scale-110 transition-transform">👥</span>
              <span>Phân công</span>
            </button>

            <button type="button" onclick="navigateToRoundAction('${r.id}', 'scoring-dashboard')" class="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-rose-400 rounded-xl font-semibold text-xs sm:text-[13px] text-slate-800 flex items-center justify-center gap-1.5 transition-all shadow-2xs group">
              <span class="text-rose-600 group-hover:scale-110 transition-transform">📊</span>
              <span>Quản lý điểm</span>
            </button>
          </div>

          <!-- Secondary Actions (Right aligned) -->
          <div class="flex items-center justify-end gap-1 text-xs sm:text-[13px] text-slate-600 flex-wrap pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-200/50">
            <button type="button" onclick="editRoundModal('${r.id}')" class="px-2.5 py-1.5 rounded-lg hover:bg-white/80 text-slate-700 font-semibold transition-colors">
              ✏️ Sửa
            </button>
            <button type="button" onclick="duplicateRoundModal('${r.id}')" class="px-2.5 py-1.5 rounded-lg hover:bg-white/80 text-slate-700 font-semibold transition-colors">
              📋 Sao chép
            </button>
            <button type="button" onclick="toggleRoundCloseStatus('${r.id}')" class="px-2.5 py-1.5 rounded-lg hover:bg-white/80 text-slate-700 font-semibold transition-colors">
              ${isClosed ? '↺ Mở lại' : '⏹ Kết thúc'}
            </button>
            <button type="button" onclick="toggleRoundHiddenStatus('${r.id}')" class="px-2.5 py-1.5 rounded-lg hover:bg-white/80 text-slate-700 font-semibold transition-colors">
              ${isHidden ? '👁️ Hiện' : '🙈 Ẩn'}
            </button>
            ${!isCurrentActive ? `<button type="button" onclick="setActiveRound('${r.id}')" class="px-2.5 py-1.5 rounded-lg text-blue-700 hover:bg-blue-100/70 font-bold transition-colors">⭐ Đặt hiện hành</button>` : ''}
            <button type="button" onclick="softDeleteRound('${r.id}')" class="px-2.5 py-1.5 rounded-lg hover:bg-rose-100/70 text-rose-600 font-semibold transition-colors">
              🗑️ Xóa
            </button>
          </div>

        </div>

      </article>
    `;
  }).join('');
};

window.navigateToRoundAction = async function(roundId, actionKey) {
  if (!roundId) return;
  state.selectedRoundId = roundId;
  state.activeRound = (state.rounds || []).find(r => r.id === roundId) || null;

  // Sync selectors across all admin views
  const dropdownIds = [
    'select-active-round',
    'admin-timeline-round-select',
    'admin-round-student-select',
    'admin-round-reg-select',
    'admin-review-round-select',
    'admin-round-sup-select',
    'admin-scoring-round-select'
  ];
  dropdownIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = roundId;
  });

  window.switchAdminTab(actionKey);
};

window.updateRoundBreadcrumb = function(tabKey) {
  const roundSubTabs = ['timeline', 'eligible-students', 'registrations', 'review', 'preview-student', 'scoring-dashboard'];
  if (!roundSubTabs.includes(tabKey)) return;

  const bEl = document.getElementById(`round-breadcrumb-${tabKey}`);
  if (!bEl) return;

  const currentRound = (state.rounds || []).find(r => r.id === state.selectedRoundId);
  const roundTitle = currentRound ? (currentRound.title || 'Đợt tốt nghiệp') : 'Chưa chọn đợt';
  const roundYear = currentRound ? (currentRound.academicYear || '') : '';

  const tabLabels = {
    'timeline': 'Kế hoạch đợt',
    'eligible-students': 'Danh sách SV tốt nghiệp',
    'registrations': 'Danh sách đăng ký',
    'review': 'Xét nguyện vọng',
    'preview-student': 'Kết quả phân công',
    'scoring-dashboard': 'Quản lý điểm'
  };
  const currentLabel = tabLabels[tabKey] || tabKey;

  bEl.innerHTML = `
    <div class="flex items-center justify-between gap-3 bg-slate-100/90 hover:bg-slate-100 px-4 py-3 rounded-xl border border-slate-200/80 text-sm transition-colors">
      <div class="flex items-center gap-2 min-w-0">
        <button type="button" onclick="switchAdminTab('rounds')" class="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 shrink-0 transition-colors">
          <span>←</span>
          <span>Đợt tốt nghiệp</span>
        </button>
        <span class="text-slate-300 font-bold">/</span>
        <span class="font-bold text-slate-800 truncate" title="${roundTitle}">${roundTitle}</span>
        <span class="text-slate-300 font-bold">/</span>
        <span class="text-slate-500 font-semibold shrink-0">${currentLabel}</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${roundYear ? `<span class="text-xs font-bold px-2.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">${roundYear}</span>` : ''}
        <button type="button" onclick="switchAdminTab('rounds')" class="text-xs text-slate-500 hover:text-slate-900 font-medium underline">Đổi đợt</button>
      </div>
    </div>
  `;
};

window.duplicateRoundModal = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) {
    showToast('Không tìm thấy đợt tốt nghiệp cần sao chép!', 'error');
    return;
  }

  // Open create round modal
  window.openCreateRoundModal();

  // Populate from source
  document.getElementById('modal-round-title').textContent = 'Sao chép Đợt Đồ án Tốt nghiệp';
  document.getElementById('round-form-id').value = '';
  document.getElementById('round-form-title').value = `(Bản sao) ${r.title || ''}`;
  document.getElementById('round-form-year').value = r.academicYear || '';
  document.getElementById('round-form-name').value = `${(r.shortCode || r.slug || 'round')}-copy`;
  document.getElementById('round-form-status').value = 'draft';
  document.getElementById('round-form-pref-count').value = r.preferenceCount || '3';
  document.getElementById('round-form-selection-mode').value = r.selectionMode || 'cards';
  if (document.getElementById('round-form-allow-edit')) {
    document.getElementById('round-form-allow-edit').checked = r.allowStudentEdit !== false;
  }
  if (document.getElementById('round-form-allow-topic-edit')) {
    document.getElementById('round-form-allow-topic-edit').checked = r.allowTopicEdit !== false;
  }
  if (document.getElementById('round-form-allow-pref-edit')) {
    document.getElementById('round-form-allow-pref-edit').checked = r.allowPreferenceEdit !== false;
  }

  showToast('Đã điền thông tin từ đợt gốc. Vui lòng kiểm tra và lưu đợt mới.', 'info');
};

window.toggleRoundCloseStatus = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;
  const isClosed = (r.status === 'closed') || (r.closeAtDate && Date.now() > new Date(r.closeAtDate).getTime());
  const newStatus = isClosed ? 'open' : 'closed';
  const actionText = isClosed ? 'Mở lại' : 'Kết thúc';

  const ok = await showConfirm(`Xác nhận ${actionText.toLowerCase()} đợt "${r.title}"?`);
  if (!ok) return;

  try {
    showLoading(`Đang ${actionText.toLowerCase()} đợt...`);
    const payload = {
      status: newStatus,
      updatedAt: serverTimestamp()
    };
    if (isClosed) {
      const now = new Date();
      const in30d = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
      payload.closeAt = in30d;
      payload.status = 'open';
    }
    await updateDoc(doc(db, 'graduationRounds', roundId), payload);
    r.status = payload.status;
    if (payload.closeAt) r.closeAtDate = payload.closeAt;
    showToast(`Đã ${actionText.toLowerCase()} đợt thành công!`, 'success');
    renderAdminRoundsCards();
  } catch (err) {
    console.error('toggleRoundCloseStatus error:', err);
    showToast('Lỗi cập nhật trạng thái: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
};

window.toggleRoundHiddenStatus = async function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;
  const isHidden = r.hidden || r.status === 'hidden';
  const newHidden = !isHidden;
  const actionText = newHidden ? 'Ẩn' : 'Bỏ ẩn (Hiện)';

  const ok = await showConfirm(`Xác nhận ${actionText.toLowerCase()} đợt "${r.title}"?`);
  if (!ok) return;

  try {
    showLoading(`Đang ${actionText.toLowerCase()} đợt...`);
    const payload = {
      hidden: newHidden,
      status: newHidden ? 'hidden' : 'open',
      updatedAt: serverTimestamp()
    };
    await updateDoc(doc(db, 'graduationRounds', roundId), payload);
    r.hidden = newHidden;
    r.status = payload.status;
    showToast(`Đã ${actionText.toLowerCase()} đợt thành công!`, 'success');
    renderAdminRoundsCards();
  } catch (err) {
    console.error('toggleRoundHiddenStatus error:', err);
    showToast('Lỗi cập nhật trạng thái ẩn: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
};


// ============================================================================
// PHASE 2: STUDENT PORTAL ENHANCEMENTS
// ============================================================================

window.startStudentRegistration = function() {
  const ctaCard = document.getElementById('registration-cta-card');
  const flowContainer = document.getElementById('registration-flow-container');
  if (ctaCard) ctaCard.classList.add('hidden');
  if (flowContainer) {
    flowContainer.classList.remove('hidden');
    flowContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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
};

window.updateStudentJourneyStepper = function() {
  const container = document.getElementById('journey-steps-list');
  if (!container) return;

  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const round = state.activeRound;
  const reg = state.myRegistration;
  const officialList = reg ? getOfficialSupervisors(reg) : [];
  const hasOfficialSup = officialList.length > 0 || Boolean(reg?.assignedSupervisorId || reg?.officialSupervisor);

  // 1. Đủ điều kiện
  let s1Status = 'upcoming';
  let s1Label = 'Chưa xét';
  if (state.isEligible === true) {
    s1Status = 'completed';
    s1Label = 'Đủ điều kiện';
  } else if (state.isEligible === 'pending') {
    s1Status = 'active';
    s1Label = 'Chờ xác nhận';
  } else if (state.isEligible === false && mssv) {
    s1Status = 'warning';
    s1Label = 'Không đủ ĐK';
  }

  // 2. Đăng ký
  let s2Status = 'upcoming';
  let s2Label = 'Chưa đăng ký';
  if (reg) {
    s2Status = 'completed';
    s2Label = 'Đã nộp đơn';
  } else if (round?.status === 'open' && state.isEligible !== false) {
    s2Status = 'active';
    s2Label = 'Đang nhận ĐK';
  }

  // 3. Xét nguyện vọng
  let s3Status = 'upcoming';
  let s3Label = 'Chưa tới';
  const isReviewing = round?.status === 'reviewing' || (round?.reviewStatus && round.reviewStatus.startsWith('round_')) || round?.reviewStatus === 'manual_assignment';
  const isReviewDone = round?.status === 'published' || round?.status === 'finalized' || round?.reviewStatus === 'completed' || hasOfficialSup;
  if (isReviewDone) {
    s3Status = 'completed';
    s3Label = 'Đã hoàn tất';
  } else if (isReviewing && reg) {
    s3Status = 'active';
    s3Label = 'Đang xét duyệt';
  }

  // 4. Phân công GVHD
  let s4Status = 'upcoming';
  let s4Label = 'Chưa tới';
  if (hasOfficialSup) {
    s4Status = 'completed';
    s4Label = 'Đã phân công';
  } else if (isReviewing || round?.status === 'finalized') {
    s4Status = 'active';
    s4Label = 'Đang phân công';
  }

  // 5. Nộp bài
  let s5Status = 'upcoming';
  let s5Label = 'Chưa tới';
  const activities = Array.isArray(round?.activities) ? round.activities : [];
  const submissionActs = activities.filter(a => a.submissionEnabled);
  if (hasOfficialSup && submissionActs.length > 0) {
    s5Status = 'active';
    s5Label = 'Đang thực hiện';
  }

  // 6. Bảo vệ
  let s6Status = 'upcoming';
  let s6Label = 'Chưa tới';
  const defenseAct = activities.find(a => a.type === 'defense' || (a.title && a.title.toLowerCase().includes('bảo vệ')));
  if (defenseAct && new Date() >= new Date(defenseAct.date || defenseAct.startDate || 0)) {
    s6Status = 'active';
    s6Label = 'Chuẩn bị / Đang BV';
  }

  // 7. Kết quả
  let s7Status = 'upcoming';
  let s7Label = 'Chưa tới';
  if (round?.publishFinalScoreToStudents || round?.resultsPublished) {
    s7Status = 'completed';
    s7Label = 'Đã công bố';
  } else if (s6Status === 'active') {
    s7Status = 'active';
    s7Label = 'Chờ công bố';
  }

  const steps = [
    { num: 1, title: '1. Đủ điều kiện', status: s1Status, label: s1Label },
    { num: 2, title: '2. Đăng ký', status: s2Status, label: s2Label },
    { num: 3, title: '3. Xét nguyện vọng', status: s3Status, label: s3Label },
    { num: 4, title: '4. Phân công GVHD', status: s4Status, label: s4Label },
    { num: 5, title: '5. Nộp bài', status: s5Status, label: s5Label },
    { num: 6, title: '6. Bảo vệ', status: s6Status, label: s6Label },
    { num: 7, title: '7. Kết quả', status: s7Status, label: s7Label }
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
      <div class="p-2.5 sm:p-3 rounded-xl border ${st.border} flex flex-col items-center text-center transition-all">
        <div class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] mb-1.5 ${st.circle}">
          ${st.icon || s.num}
        </div>
        <span class="font-bold text-[11px] text-slate-800 leading-tight mb-1 truncate w-full" title="${s.title}">${s.title}</span>
        <span class="text-[9px] px-1.5 py-0.5 rounded-full border ${st.badge} whitespace-nowrap">${s.label}</span>
      </div>
    `;
  }).join('');
};

window.updateStudentPersonalSidebar = function() {
  const sidebar = document.getElementById('student-status-sidebar');
  if (!sidebar) return;

  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  if (!mssv) {
    sidebar.innerHTML = `
      <div class="text-center py-6 text-slate-400 text-xs">
        Vui lòng đăng nhập bằng tài khoản @student.tdtu.edu.vn để xem thông tin cá nhân.
      </div>
    `;
    return;
  }

  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(mssv) : null;
  const fullName = studentObj?.fullName || studentObj?.name || state.user?.displayName || `Sinh viên ${mssv}`;
  const studentClass = studentObj?.className || studentObj?.studentClass || 'Chưa cập nhật';
  const major = studentObj?.major || 'Mỹ thuật Công nghiệp';

  if (!state.facultyStudentsLoaded && typeof loadFacultyDatasetFromIFAA === 'function') {
    loadFacultyDatasetFromIFAA().then(() => {
      const sb = document.getElementById('student-status-sidebar');
      if (sb) updateStudentPersonalSidebar();
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

  const avatarUrl = state.user?.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%2394a3b8"/><path fill="%2394a3b8" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';

  sidebar.innerHTML = `
    <!-- Header -->
    <div class="flex items-center gap-3 pb-3 border-b border-slate-100">
      <img src="${avatarUrl}" class="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0" alt="Avatar">
      <div class="min-w-0 flex-1">
        <h3 class="font-bold text-sm text-slate-900 truncate leading-snug">${fullName}</h3>
        <p class="text-xs text-slate-500 font-mono">MSSV: <span class="font-bold text-tdtu-blue">${mssv}</span></p>
      </div>
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
    </div>
  `;
};


// ============================================================================
// PHASE 3: SUPERVISOR PORTAL COMPLETE IMPLEMENTATION
// ============================================================================

state.supervisorStudentFilter = 'all';
state.supervisorAssignedStudents = [];

window.initSupervisorPortal = async function() {
  const deniedCard = document.getElementById('supervisor-access-denied');
  const workspaceContainer = document.getElementById('supervisor-workspace-container');

  // ACCESS RULE: Only supervisor, support supervisor, or admin can access
  const actor = getEffectiveActor();
  const emailLower = (actor.email || '').toLowerCase().trim();
  const isSupervisorCandidate = actor.isSupervisor || actor.isAdmin ||
    (state.roundSupervisors || []).some(s => (s.email || '').toLowerCase().trim() === emailLower) ||
    (state.supervisorsMaster || []).some(s => (s.email || '').toLowerCase().trim() === emailLower);

  if (!actor.email || !isSupervisorCandidate) {
    if (deniedCard) deniedCard.classList.remove('hidden');
    if (workspaceContainer) workspaceContainer.classList.add('hidden');
    return;
  }

  if (deniedCard) deniedCard.classList.add('hidden');
  if (workspaceContainer) workspaceContainer.classList.remove('hidden');

  // Populate round selector filtered to rounds supervisor participates in (or all for admin)
  renderSupervisorRoundsDropdown();

  // If no round selected yet, pick active round or first available
  const currentRoundId = state.selectedRoundId || state.activeRound?.id || (state.rounds && state.rounds[0]?.id);
  if (currentRoundId) {
    await loadSupervisorPortalData(currentRoundId);
  }
};

window.renderSupervisorRoundsDropdown = function() {
  const select = document.getElementById('supervisor-round-select');
  if (!select) return;

  const actor = getEffectiveActor();
  const emailLower = (actor.email || '').toLowerCase().trim();
  const validRounds = (state.rounds || []).filter(r => !r.deleted);

  let filteredRounds = validRounds;
  if (!actor.isAdmin) {
    // Only show rounds this supervisor is part of or active round
    filteredRounds = validRounds.filter(r => {
      if (r.isActive) return true;
      const inSupervisors = Array.isArray(r.supervisors) && r.supervisors.some(s => (s.email || '').toLowerCase().trim() === emailLower);
      const inAssigned = Array.isArray(r.registrations) && r.registrations.some(reg => {
        const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(reg) : [];
        return officials.some(s => (s.supervisorEmail || s.email || '').toLowerCase().trim() === emailLower);
      });
      return inSupervisors || inAssigned;
    });
    if (filteredRounds.length === 0 && validRounds.length > 0) {
      filteredRounds = [validRounds.find(r => r.isActive) || validRounds[0]];
    }
  }

  select.innerHTML = filteredRounds.map(r => `
    <option value="${r.id}" ${r.id === state.selectedRoundId ? 'selected' : ''}>
      ${r.title} (${r.academicYear || ''})${r.isActive ? ' ★ Hiện hành' : ''}
    </option>
  `).join('');

  if (filteredRounds.length === 0) {
    select.innerHTML = '<option value="">-- Chưa có đợt tốt nghiệp --</option>';
  }
};

window.onSupervisorRoundSelected = async function(roundId) {
  if (!roundId) return;
  state.selectedRoundId = roundId;
  state.activeRound = (state.rounds || []).find(r => r.id === roundId) || null;
  await loadSupervisorPortalData(roundId);
};

window.loadSupervisorPortalData = async function(roundId) {
  if (!roundId) return;

  const actor = getEffectiveActor();
  const emailLower = (actor.email || '').toLowerCase().trim();
  const round = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;
  if (!round) return;

  // 1. Locate current supervisor profile
  let currentSup = (state.roundSupervisors || []).find(s => (s.email || '').toLowerCase().trim() === emailLower);
  if (!currentSup) {
    currentSup = (state.supervisorsMaster || []).find(s => (s.email || '').toLowerCase().trim() === emailLower);
  }

  // Header and Hero Information
  const greetingEl = document.getElementById('supervisor-greeting-name');
  const roundInfoEl = document.getElementById('supervisor-round-info');
  const activeBadgeEl = document.getElementById('sup-active-round-badge');
  const reviewIndicator = document.getElementById('sup-round-review-indicator');

  const supDisplayName = currentSup?.name || actor.displayName || 'Thầy/Cô';
  if (greetingEl) greetingEl.textContent = `Kính chào Thầy/Cô ${supDisplayName}`;
  if (roundInfoEl) roundInfoEl.textContent = `Đợt: ${round.title} • Năm học ${round.academicYear || ''}`;
  if (activeBadgeEl) activeBadgeEl.textContent = round.roundName || round.title || 'Đợt ĐATN';

  const statusMap = {
    draft: 'Bản nháp',
    upcoming: 'Sắp mở đăng ký',
    open: 'Đang mở đăng ký',
    closed: 'Đã đóng đăng ký',
    reviewing: 'Đang xét nguyện vọng',
    finalized: 'Đã chốt phân công',
    published: 'Đã công bố'
  };
  if (reviewIndicator) {
    reviewIndicator.textContent = `Trạng thái: ${statusMap[round.status] || round.status || 'Đang thực hiện'}`;
  }

  // 2. Fetch all registrations for this round
  let allRegistrations = [];
  try {
    const regSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    allRegistrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[SupervisorPortal] Could not query registrations directly:', err);
    allRegistrations = round.registrations || [];
  }

  // 3. Fetch activities if not loaded
  let activities = Array.isArray(round.activities) ? round.activities : [];
  if (activities.length === 0) {
    try {
      const actSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'activities'));
      activities = actSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      round.activities = activities;
    } catch (e) {}
  }

  // 4. Identify Assigned Students for this supervisor
  const mySupId = currentSup?.id || currentSup?.supervisorId;
  const assigned = allRegistrations.filter(r => {
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(r) : [];
    if (officials.length === 0) {
      if (r.reviewStatus !== 'accepted' && r.reviewStatus !== 'manually_assigned') return false;
    }
    return officials.some(s => {
      if (mySupId && (s.supervisorId === mySupId || s.id === mySupId)) return true;
      if (s.email && s.email.toLowerCase().trim() === emailLower) return true;
      if (s.supervisorEmail && s.supervisorEmail.toLowerCase().trim() === emailLower) return true;
      return false;
    });
  });

  // Admin fallback: If admin without personal assignment, can see all assigned students in round
  let displayStudents = assigned;
  if (actor.isAdmin && assigned.length === 0) {
    displayStudents = allRegistrations.filter(r => {
      const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(r) : [];
      return officials.length > 0 || r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned';
    });
  }

  state.supervisorAssignedStudents = displayStudents;

  // 5. Compute Hero Stats
  const quota = currentSup?.quota || currentSup?.capacity || (actor.isAdmin ? displayStudents.length : 10);
  let primaryCount = 0;
  let supportCount = 0;
  let pendingCount = 0;

  displayStudents.forEach(st => {
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : [];
    const isPrimary = officials.some(s => {
      const isMe = (mySupId && (s.supervisorId === mySupId || s.id === mySupId)) ||
        (s.email && s.email.toLowerCase().trim() === emailLower) ||
        (s.supervisorEmail && s.supervisorEmail.toLowerCase().trim() === emailLower);
      return (isMe || actor.isAdmin) && s.role === 'primary';
    });
    if (isPrimary) primaryCount++;
    else supportCount++;

    // Check if score is pending
    const sc = round.supervisorScores?.[st.studentId || st.id];
    if (!sc || sc.status !== 'completed') {
      pendingCount++;
    }
  });

  document.getElementById('sup-stat-total-cap').textContent = quota;
  document.getElementById('sup-stat-primary-count').textContent = primaryCount;
  document.getElementById('sup-stat-support-count').textContent = supportCount;
  document.getElementById('sup-stat-pending-count').textContent = pendingCount;

  // Hero Next Milestone & Deadline
  const nextMilestoneEl = document.getElementById('sup-hero-next-milestone');
  const deadlineEl = document.getElementById('sup-hero-milestone-deadline');
  const now = new Date();
  const upcomingActs = activities
    .map(a => ({
      title: a.title,
      date: a.closeAtDate ? new Date(a.closeAtDate) : (a.endDate ? new Date(a.endDate) : (a.date ? new Date(a.date) : null))
    }))
    .filter(a => a.date && !isNaN(a.date.getTime()) && a.date >= now)
    .sort((a, b) => a.date - b.date);

  if (upcomingActs.length > 0) {
    if (nextMilestoneEl) nextMilestoneEl.textContent = `Mốc tiếp theo: ${upcomingActs[0].title}`;
    if (deadlineEl) deadlineEl.textContent = `Hạn: ${fmtIsoToVietnameseDateTime(upcomingActs[0].date.toISOString())}`;
  } else {
    if (nextMilestoneEl) nextMilestoneEl.textContent = 'Mốc tiếp theo: Các mốc kế hoạch đã hoàn tất';
    if (deadlineEl) deadlineEl.textContent = 'Đã hoàn tất timeline';
  }

  // Update tabs badges
  const assignedBadge = document.getElementById('sup-assigned-count-badge');
  if (assignedBadge) assignedBadge.textContent = displayStudents.length;

  // Also load legacy review data for candidates tab if needed
  await loadSupervisorReviewData(roundId);

  // Render assigned students list
  renderSupervisorAssignedStudents();
};

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
    const className = studentObj?.className || studentObj?.studentClass || st.className || '--';
    const major = studentObj?.major || st.major || 'Mỹ thuật Công nghiệp';
    const topicTitle = st.topicTitle || 'Chưa cập nhật tên đề tài';
    const projectType = st.projectType || 'Đồ án tốt nghiệp';

    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : [];
    const isPrimary = officials.some(s => {
      const isMe = (mySupId && (s.supervisorId === mySupId || s.id === mySupId)) ||
        (s.email && s.email.toLowerCase().trim() === emailLower) ||
        (s.supervisorEmail && s.supervisorEmail.toLowerCase().trim() === emailLower);
      return (isMe || state.isAdmin) && s.role === 'primary';
    });

    const roleBadge = isPrimary
      ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">GVHD chính</span>'
      : '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">GVHD hỗ trợ</span>';

    // Score status
    const sc = round?.supervisorScores?.[studentId];
    let scoreBadge = '';
    if (sc?.status === 'completed') {
      scoreBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-black bg-emerald-100 text-emerald-800 border border-emerald-300">Điểm GVHD: ${Number(sc.score).toFixed(1)}</span>`;
    } else if (sc?.status === 'draft') {
      scoreBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">● Lưu tạm: ${sc.score ?? '--'}</span>`;
    } else {
      scoreBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500">Chưa chấm</span>';
    }

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

    const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23cbd5e1"/><path fill="%23cbd5e1" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';

    return `
      <div class="card-surface p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 hover:border-tdtu-blue/40 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <!-- Left: Student Info & Role -->
        <div class="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <img src="${defaultAvatar}" class="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0" alt="Avatar">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              ${roleBadge}
              <span class="font-mono text-xs font-bold text-tdtu-blue bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">${studentId}</span>
              <span class="text-slate-400 text-xs hidden sm:inline">•</span>
              <span class="text-xs text-slate-500 font-medium truncate">Lớp: ${className}</span>
            </div>
            <h3 class="text-sm sm:text-base font-black text-slate-900 leading-snug truncate">${name}</h3>
            <p class="text-xs text-slate-600 mt-1 line-clamp-1">
              <strong class="text-slate-700">Đề tài:</strong> ${topicTitle}
            </p>
            <div class="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-500">
              <span>Loại hình: <b class="text-slate-700">${projectType}</b></span>
              <span>•</span>
              <span>${submissionStatusStr}</span>
            </div>
          </div>
        </div>

        <!-- Right: Status Badges & Action Buttons -->
        <div class="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
          <div class="mr-2">
            ${scoreBadge}
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button type="button" onclick="openSupervisorStudentDetailModal('${studentId}')" class="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer" title="Xem thông tin chi tiết">
              📋 Xem hồ sơ
            </button>
            <button type="button" onclick="openSupervisorStudentDetailModal('${studentId}', 'progress')" class="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer" title="Xem tiến độ và mốc kế hoạch">
              📅 Tiến độ
            </button>
            <button type="button" onclick="openSupervisorStudentDetailModal('${studentId}', 'comment')" class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all cursor-pointer" title="Nhận xét của GVHD">
              💬 Nhận xét
            </button>
            <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="px-3.5 py-1.5 bg-tdtu-blue hover:bg-tdtu-dark text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer" title="Nhập hoặc chỉnh sửa điểm GVHD">
              ✍️ Chấm điểm
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
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
};

window.openSupervisorStudentDetailModal = function(studentId, focusSection = null) {
  const modal = document.getElementById('supervisor-student-detail-modal');
  if (!modal) return;

  const round = state.activeRound;
  const st = (state.supervisorAssignedStudents || []).find(s => (s.studentId || s.id) === studentId) ||
    findStudentInRound(studentId);
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(studentId) : null;

  const fullName = st?.studentName || studentObj?.fullName || studentObj?.name || studentId;
  const className = studentObj?.className || studentObj?.studentClass || st?.className || '--';
  const major = studentObj?.major || st?.major || 'Mỹ thuật Công nghiệp';

  document.getElementById('dtl-mssv').textContent = studentId;
  document.getElementById('dtl-full-name').textContent = fullName;
  document.getElementById('dtl-class-major').textContent = `Lớp: ${className} • Ngành: ${major}`;
  document.getElementById('dtl-topic-title').textContent = st?.topicTitle || 'Chưa cập nhật tên đề tài';
  document.getElementById('dtl-project-type').textContent = `Loại hình: ${st?.projectType || '--'}`;

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
            <span class="text-[10px] ${s.role === 'primary' ? 'text-emerald-700 font-bold' : 'text-indigo-700'} uppercase">${s.role === 'primary' ? 'GVHD chính' : 'GVHD hỗ trợ'}</span>
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


// ============================================================================
// PHASE 4: ASSESSMENT PORTAL ENGINE
// ============================================================================

state.assessmentTab = 'duyet-1';
state.assessmentFilter = 'all';
state.assessmentSearchQuery = '';
state.selectedAssessmentRoundId = null;
state.selectedAssessmentCouncilId = null;

export function checkUserAssessmentCapabilities(round, userEmail = null, userId = null) {
  const actor = getEffectiveActor();
  const uEmail = (userEmail || actor.email || '').toLowerCase().trim();
  const uId = userId || actor.uid || actor.email;

  if (actor.isAdmin) {
    return {
      isRoundAdmin: true,
      canDuyet1: true,
      canDuyet2: true,
      canDuyet3: true,
      canThesis: true,
      canPreliminary: true,
      canDefense: true,
      canSummary: true,
      hasAnyCapability: true
    };
  }

  if (!round) {
    return {
      isRoundAdmin: false,
      canDuyet1: false,
      canDuyet2: false,
      canDuyet3: false,
      canThesis: false,
      canPreliminary: false,
      canDefense: false,
      canSummary: false,
      hasAnyCapability: false
    };
  }

  // Check if supervisor in round
  const isSupervisor = (round.supervisors || []).some(s => (s.email && s.email.toLowerCase() === uEmail) || s.id === uId);

  // Check official supervised students
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (round.eligibleStudents || []);

  const hasSupervisedStudents = allRegs.some(s => {
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    return officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
  });

  // Check reviewer assignments
  const reviewerAssignments = round.reviewerAssignments || {};
  const hasReviewerAssignments = allRegs.some(s => {
    const sid = s.mssv || s.studentId;
    return reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail;
  });

  // Check council membership in any activity
  const actsWithCouncils = (round.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils));
  let hasDefenseDuty = false;
  for (const act of actsWithCouncils) {
    for (const c of (act.councils || [])) {
      const members = Object.values(c.membersBySlot || {});
      if (members.some(m => m.memberEmail && m.memberEmail.toLowerCase() === uEmail)) {
        hasDefenseDuty = true;
        break;
      }
    }
    if (hasDefenseDuty) break;
  }

  const canDuyet1 = hasSupervisedStudents || isSupervisor;
  const canDuyet2 = hasSupervisedStudents || isSupervisor;
  const canDuyet3 = hasSupervisedStudents || isSupervisor;
  const canThesis = hasSupervisedStudents || hasReviewerAssignments;
  const canPreliminary = isSupervisor;
  const canDefense = hasDefenseDuty;
  const canSummary = state.isAdmin;

  const hasAnyCapability = canDuyet1 || canDuyet2 || canDuyet3 || canThesis || canPreliminary || canDefense || canSummary;

  return {
    isRoundAdmin: false,
    canDuyet1,
    canDuyet2,
    canDuyet3,
    canThesis,
    canPreliminary,
    canDefense,
    canSummary,
    hasAnyCapability
  };
}
window.checkUserAssessmentCapabilities = checkUserAssessmentCapabilities;

window.initAssessmentPortal = async function() {
  if (!state.user) return;

  const allRounds = state.rounds || [];
  const eligibleRounds = allRounds.filter(r => checkUserAssessmentCapabilities(r).hasAnyCapability);

  const deniedEl = document.getElementById('assessment-access-denied');
  const containerEl = document.getElementById('assessment-workspace-container');

  if (eligibleRounds.length === 0) {
    if (deniedEl) deniedEl.classList.remove('hidden');
    if (containerEl) containerEl.classList.add('hidden');
    return;
  }

  if (deniedEl) deniedEl.classList.add('hidden');
  if (containerEl) containerEl.classList.remove('hidden');

  // Populate Round Selector
  const roundSelect = document.getElementById('assessment-round-select');
  if (roundSelect) {
    roundSelect.innerHTML = eligibleRounds.map(r => {
      const isCur = r.isCurrentRound || r.status === 'in_progress';
      return `<option value="${r.id}">${r.title || 'Đợt'} (${r.academicYear || '--'})${isCur ? ' — [Hiện hành]' : ''}</option>`;
    }).join('');

    // Determine default selected round
    let defaultRound = eligibleRounds.find(r => r.id === state.selectedAssessmentRoundId);
    if (!defaultRound) defaultRound = eligibleRounds.find(r => r.id === state.selectedRoundId);
    if (!defaultRound) defaultRound = eligibleRounds.find(r => r.isCurrentRound || r.status === 'in_progress');
    if (!defaultRound) defaultRound = eligibleRounds[0];

    state.selectedAssessmentRoundId = defaultRound.id;
    state.selectedRoundId = defaultRound.id;
    roundSelect.value = defaultRound.id;
  }

  await renderAssessmentWorkspace();
};

window.onAssessmentRoundChange = async function(roundId) {
  state.selectedAssessmentRoundId = roundId;
  state.selectedRoundId = roundId;
  state.selectedAssessmentCouncilId = null;
  await renderAssessmentWorkspace();
};

window.renderAssessmentWorkspace = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  if (!targetRound) return;

  const caps = checkUserAssessmentCapabilities(targetRound);

  // 1. Tab visibility
  const tabConfig = [
    { key: 'duyet-1', visible: caps.canDuyet1 },
    { key: 'duyet-2', visible: caps.canDuyet2 },
    { key: 'duyet-3', visible: caps.canDuyet3 },
    { key: 'thesis', visible: caps.canThesis },
    { key: 'preliminary', visible: caps.canPreliminary },
    { key: 'defense', visible: caps.canDefense },
    { key: 'summary', visible: caps.canSummary }
  ];

  tabConfig.forEach(tab => {
    const btn = document.getElementById('atab-btn-' + tab.key);
    if (btn) {
      if (tab.visible) btn.classList.remove('hidden');
      else btn.classList.add('hidden');
    }
  });

  // Ensure current active tab is visible
  const activeTabConfig = tabConfig.find(t => t.key === state.assessmentTab);
  if (!activeTabConfig || !activeTabConfig.visible) {
    const firstVisible = tabConfig.find(t => t.visible);
    if (firstVisible) state.assessmentTab = firstVisible.key;
  }

  // Update role badge in top bar
  const roleBadge = document.getElementById('assessment-user-role-badge');
  if (roleBadge) {
    if (state.isAdmin) {
      roleBadge.textContent = 'Quản trị viên';
      roleBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200';
    } else if (caps.canDefense) {
      roleBadge.textContent = 'Thành viên Hội đồng';
      roleBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200';
    } else {
      roleBadge.textContent = 'Cán bộ Đánh giá';
      roleBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200';
    }
  }

  // Render Hero Card and Tab
  renderAssessmentHeroCard();
  switchAssessmentTab(state.assessmentTab);
};

window.renderAssessmentHeroCard = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  if (!targetRound) return;

  const titleEl = document.getElementById('assessment-hero-round-title');
  if (titleEl) {
    titleEl.textContent = `${targetRound.title || 'Đồ án tốt nghiệp'} — ${targetRound.academicYear || ''}`;
  }

  // Calculate nearest milestone deadline
  const now = new Date();
  let nearestDeadline = null;
  let nearestActTitle = '';
  (targetRound.activities || []).forEach(a => {
    const deadlineStr = a.deadline || a.endTime;
    if (deadlineStr) {
      const d = new Date(deadlineStr);
      if (d > now && (!nearestDeadline || d < nearestDeadline)) {
        nearestDeadline = d;
        nearestActTitle = a.title || 'Mốc tiếp theo';
      }
    }
  });

  const deadlineEl = document.getElementById('assessment-stat-deadline');
  if (deadlineEl) {
    if (nearestDeadline) {
      const daysLeft = Math.ceil((nearestDeadline - now) / (1000 * 60 * 60 * 24));
      deadlineEl.textContent = `${fmtIsoToVietnameseDateTime(nearestDeadline.toISOString())} (${daysLeft} ngày nữa — ${nearestActTitle})`;
    } else {
      deadlineEl.textContent = 'Đã qua các hạn chót';
    }
  }

  // Metrics computation for user
  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  let neededCount = 0;
  let scoredCount = 0;
  let draftCount = 0;

  // 1. Duyet 1, 2, 3
  const supervised = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    return officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
  });

  [1, 2, 3].forEach(phase => {
    supervised.forEach(s => {
      neededCount++;
      const sid = s.mssv || s.studentId;
      const sc = targetRound.progressReviews?.['duyet_' + phase]?.[sid];
      if (sc && sc.status && sc.status !== 'draft') scoredCount++;
      else if (sc && sc.status === 'draft') draftCount++;
    });
  });

  // 2. Thesis (Reviewer)
  const reviewerAssignments = targetRound.reviewerAssignments || {};
  const myReviewerStudents = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const sid = s.mssv || s.studentId;
    return reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail;
  });
  myReviewerStudents.forEach(s => {
    neededCount++;
    const sid = s.mssv || s.studentId;
    const sc = targetRound.thesisScores?.[sid]?.pb;
    if (sc && sc.status === 'completed') scoredCount++;
    else if (sc && sc.status === 'draft') draftCount++;
  });

  const unscoredCount = Math.max(0, neededCount - scoredCount - draftCount);

  const neededEl = document.getElementById('assessment-stat-needed');
  const scoredEl = document.getElementById('assessment-stat-scored');
  const unscoredEl = document.getElementById('assessment-stat-unscored');
  const draftEl = document.getElementById('assessment-stat-draft');

  if (neededEl) neededEl.textContent = neededCount;
  if (scoredEl) scoredEl.textContent = scoredCount;
  if (unscoredEl) unscoredEl.textContent = unscoredCount;
  if (draftEl) draftEl.textContent = draftCount;
};

window.switchAssessmentTab = function(tabKey) {
  state.assessmentTab = tabKey;

  // Update Tab Buttons UI
  const tabKeys = ['duyet-1', 'duyet-2', 'duyet-3', 'thesis', 'preliminary', 'defense', 'summary'];
  tabKeys.forEach(key => {
    const btn = document.getElementById('atab-btn-' + key);
    if (btn) {
      if (key === tabKey) {
        btn.classList.add('bg-purple-600', 'text-white', 'shadow-xs');
        btn.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        btn.classList.remove('bg-purple-600', 'text-white', 'shadow-xs');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    }

    const panel = document.getElementById('assessment-panel-' + key);
    if (panel) {
      if (key === tabKey) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });

  // Filter toolbar visibility
  const filterToolbar = document.getElementById('assessment-filter-toolbar');
  if (filterToolbar) {
    if (tabKey === 'summary') filterToolbar.classList.add('hidden');
    else filterToolbar.classList.remove('hidden');
  }

  renderCurrentAssessmentTab();
};

window.setAssessmentFilter = function(filterType) {
  state.assessmentFilter = filterType;
  const filterBtns = ['all', 'unscored', 'draft', 'completed'];
  filterBtns.forEach(f => {
    const btn = document.getElementById('afilter-btn-' + f);
    if (btn) {
      if (f === filterType) {
        btn.className = 'assessment-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-900 text-white shadow-xs';
      } else {
        btn.className = 'assessment-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
      }
    }
  });
  renderCurrentAssessmentTab();
};

window.onAssessmentSearch = function(query) {
  state.assessmentSearchQuery = String(query || '').toLowerCase().trim();
  renderCurrentAssessmentTab();
};

window.renderCurrentAssessmentTab = function() {
  switch (state.assessmentTab) {
    case 'duyet-1':
      renderAssessmentDuyetList(1);
      break;
    case 'duyet-2':
      renderAssessmentDuyetList(2);
      break;
    case 'duyet-3':
      renderAssessmentDuyetList(3);
      break;
    case 'thesis':
      renderAssessmentThesisList();
      break;
    case 'preliminary':
      renderAssessmentPreliminaryList();
      break;
    case 'defense':
      renderAssessmentDefenseList();
      break;
    case 'summary':
      renderAssessmentSummaryTable();
      break;
  }
};

// Helper: Filter Students by search and filter status
function filterStudentList(students, scoreResolver) {
  const q = state.assessmentSearchQuery;
  const f = state.assessmentFilter;

  return students.filter(s => {
    const sid = String(s.mssv || s.studentId || '').toLowerCase();
    const name = String(s.fullName || s.studentName || '').toLowerCase();
    const topic = String(s.topicTitle || '').toLowerCase();

    if (q && !sid.includes(q) && !name.includes(q) && !topic.includes(q)) return false;

    const scInfo = scoreResolver(s);
    if (f === 'unscored' && scInfo.status !== 'unscored') return false;
    if (f === 'draft' && scInfo.status !== 'draft') return false;
    if (f === 'completed' && scInfo.status !== 'completed') return false;

    return true;
  });
}

function updateFilterCountBadges(students, scoreResolver, badgeId = null) {
  let cntAll = students.length;
  let cntUnscored = 0;
  let cntDraft = 0;
  let cntCompleted = 0;

  students.forEach(s => {
    const scInfo = scoreResolver(s);
    if (scInfo.status === 'completed') cntCompleted++;
    else if (scInfo.status === 'draft') cntDraft++;
    else cntUnscored++;
  });

  const bAll = document.getElementById('afilter-cnt-all');
  const bUnscored = document.getElementById('afilter-cnt-unscored');
  const bDraft = document.getElementById('afilter-cnt-draft');
  const bCompleted = document.getElementById('afilter-cnt-completed');

  if (bAll) bAll.textContent = cntAll;
  if (bUnscored) bUnscored.textContent = cntUnscored;
  if (bDraft) bDraft.textContent = cntDraft;
  if (bCompleted) bCompleted.textContent = cntCompleted;

  if (badgeId) {
    const tabBadge = document.getElementById(badgeId);
    if (tabBadge) tabBadge.textContent = cntAll;
  }
}

// 1. DUYỆT 1, 2, 3
window.renderAssessmentDuyetList = function(phase) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-duyet-' + phase);
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const candidates = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    return officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
  });

  const scoreResolver = (s) => {
    const sid = s.mssv || s.studentId;
    const sc = targetRound.progressReviews?.['duyet_' + phase]?.[sid];
    if (sc && (sc.status === 'passed' || sc.status === 'failed' || sc.status === 'completed')) {
      return { status: 'completed', score: sc.score, isPassed: sc.score >= 5 };
    }
    if (sc && sc.status === 'draft') {
      return { status: 'draft', score: sc.score };
    }
    return { status: 'unscored', score: null };
  };

  updateFilterCountBadges(candidates, scoreResolver, 'atab-badge-duyet-' + phase);
  const filtered = filterStudentList(candidates, scoreResolver);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
      Không có sinh viên nào phù hợp với bộ lọc trong đợt Duyệt ${phase}.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const initial = (name || 'SV').charAt(0).toUpperCase();
    const supName = formatStudentSupervisorsForDisplay(s);
    const scInfo = scoreResolver(s);

    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa chấm</span>';
    let scoreDisplay = '--';
    if (scInfo.status === 'completed') {
      statusBadge = scInfo.isPassed
        ? '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đạt yêu cầu</span>'
        : '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Không đạt</span>';
      scoreDisplay = `<span class="text-sm font-black text-purple-900">${Number(scInfo.score).toFixed(1)}/10</span>`;
    } else if (scInfo.status === 'draft') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Bản nháp</span>';
      scoreDisplay = `<span class="text-sm font-bold text-amber-700">${scInfo.score != null ? Number(scInfo.score).toFixed(1) : '--'}</span>`;
    }

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Student Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${initial}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Supervisor info & Metadata (STRICTLY NO FILE VIEW/DOWNLOAD) -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Giảng viên Hướng dẫn</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Giai đoạn</span>
            <span class="font-bold text-purple-800">Duyệt tiến độ ${phase}</span>
          </div>
        </div>

        <!-- Right: Status & Score Action -->
        <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div class="text-right">
            <div>${scoreDisplay}</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <button type="button" onclick="openScoreEntryModal('duyet_${phase}', '${sid}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>✍️</span> <span>${scInfo.status === 'completed' ? 'Sửa điểm' : 'Chấm điểm'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// 2. THUYẾT MINH (HD & PB)
window.renderAssessmentThesisList = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-thesis');
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const reviewerAssignments = targetRound.reviewerAssignments || {};

  const candidates = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const sid = s.mssv || s.studentId;
    const isReviewer = (reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail);
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    const isSup = officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
    return isReviewer || isSup;
  });

  const scoreResolver = (s) => {
    const sid = s.mssv || s.studentId;
    const scObj = targetRound.thesisScores?.[sid] || {};
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    const isSup = officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
    const isReviewer = (reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail);

    let sc = null;
    if (isReviewer && !isSup) sc = scObj.pb;
    else if (isSup && !isReviewer) sc = scObj.hd;
    else sc = scObj.pb || scObj.hd;

    if (sc && sc.status === 'completed') return { status: 'completed', score: sc.score };
    if (sc && sc.status === 'draft') return { status: 'draft', score: sc.score };
    return { status: 'unscored', score: null };
  };

  updateFilterCountBadges(candidates, scoreResolver, 'atab-badge-thesis');
  const filtered = filterStudentList(candidates, scoreResolver);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
      Không có sinh viên nào phù hợp với bộ lọc Thuyết minh.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const initial = (name || 'SV').charAt(0).toUpperCase();
    const supName = formatStudentSupervisorsForDisplay(s);

    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    const isSup = state.isAdmin || officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
    const isReviewer = state.isAdmin || (reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail);

    const thesisObj = targetRound.thesisScores?.[sid] || {};
    const hdScore = thesisObj.hd?.score;
    const pbScore = thesisObj.pb?.score;

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${initial}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Scores overview -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">GVHD</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div class="flex items-center gap-3">
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Điểm TM HD</span>
              <span class="font-bold ${hdScore != null ? 'text-emerald-700 font-mono text-sm' : 'text-slate-400'}">${hdScore != null ? Number(hdScore).toFixed(1) : '--'}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Điểm TM PB</span>
              <span class="font-bold ${pbScore != null ? 'text-blue-700 font-mono text-sm' : 'text-slate-400'}">${pbScore != null ? Number(pbScore).toFixed(1) : '--'}</span>
            </div>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center justify-between md:justify-end gap-2 shrink-0">
          ${isSup ? `
            <button type="button" onclick="openScoreEntryModal('tm_hd', '${sid}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer">
              <span>✍️</span> <span>TM GVHD</span>
            </button>
          ` : ''}
          ${isReviewer ? `
            <button type="button" onclick="openScoreEntryModal('tm_pb', '${sid}')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer">
              <span>✍️</span> <span>TM Phản biện</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
};

// 3. SƠ KHẢO
window.renderAssessmentPreliminaryList = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-preliminary');
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const scoreResolver = (s) => {
    const sid = s.mssv || s.studentId;
    const key = `prelim_${sid}_${uId}`;
    const sc = targetRound.preliminaryScores?.[key];
    if (sc && sc.status === 'completed') return { status: 'completed', score: sc.score };
    if (sc && sc.status === 'draft') return { status: 'draft', score: sc.score };
    return { status: 'unscored', score: null };
  };

  updateFilterCountBadges(allRegs, scoreResolver, 'atab-badge-preliminary');
  const filtered = filterStudentList(allRegs, scoreResolver);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
      Không có sinh viên nào phù hợp với bộ lọc Sơ khảo.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const initial = (name || 'SV').charAt(0).toUpperCase();
    const supName = formatStudentSupervisorsForDisplay(s);
    const scInfo = scoreResolver(s);

    // Summary of preliminary average
    const prelimSummary = getPreliminarySummary(sid, targetRound.id);
    const avgStr = prelimSummary.average != null ? Number(prelimSummary.average).toFixed(1) : '--';

    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa chấm</span>';
    let myScoreText = '--';
    if (scInfo.status === 'completed') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Đã chấm</span>';
      myScoreText = `<span class="text-sm font-black text-purple-900">${Number(scInfo.score).toFixed(1)}/10</span>`;
    } else if (scInfo.status === 'draft') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Bản nháp</span>';
      myScoreText = `<span class="text-sm font-bold text-amber-700">${scInfo.score != null ? Number(scInfo.score).toFixed(1) : '--'}</span>`;
    }

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${initial}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Supervisor & Score stats -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">GVHD</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Điểm TB Sơ khảo (${prelimSummary.count} lượt)</span>
            <span class="font-bold text-indigo-700 text-sm font-mono">${avgStr}</span>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div class="text-right">
            <div>${myScoreText}</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <button type="button" onclick="openScoreEntryModal('preliminary', '${sid}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>✍️</span> <span>${scInfo.status === 'completed' ? 'Sửa điểm' : 'Chấm sơ khảo'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// 4. BẢO VỆ (HỘI ĐỒNG)
window.renderAssessmentDefenseList = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-defense');
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();

  // Find all activities with councils
  const actsWithCouncils = (targetRound.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils) && a.councils.length > 0);
  let availableCouncils = [];

  actsWithCouncils.forEach(act => {
    act.councils.forEach(c => {
      const members = Object.values(c.membersBySlot || {});
      const isMember = members.some(m => m.memberEmail && m.memberEmail.toLowerCase() === uEmail);
      if (actor.isAdmin || isMember) {
        availableCouncils.push({ act, council: c });
      }
    });
  });

  const councilSelect = document.getElementById('assessment-council-select');
  if (availableCouncils.length === 0) {
    if (councilSelect) councilSelect.innerHTML = '<option value="">-- Chưa được phân công Hội đồng nào --</option>';
    container.innerHTML = '<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">Thầy/Cô chưa có phân công trong Hội đồng bảo vệ nào của đợt này.</div>';
    return;
  }

  if (councilSelect) {
    councilSelect.innerHTML = availableCouncils.map(item => {
      return `<option value="${item.council.id}">${item.council.name} (${item.act.title})</option>`;
    }).join('');

    if (!state.selectedAssessmentCouncilId || !availableCouncils.some(item => item.council.id === state.selectedAssessmentCouncilId)) {
      state.selectedAssessmentCouncilId = availableCouncils[0].council.id;
    }
    councilSelect.value = state.selectedAssessmentCouncilId;
  }

  // Current council info
  const currentItem = availableCouncils.find(item => item.council.id === state.selectedAssessmentCouncilId) || availableCouncils[0];
  const act = currentItem.act;
  const council = currentItem.council;

  // Banner details
  const nameEl = document.getElementById('assessment-cinfo-name');
  const statusEl = document.getElementById('assessment-cinfo-status');
  const timeRoomEl = document.getElementById('assessment-cinfo-time-room');
  const chairEl = document.getElementById('assessment-cinfo-chair');
  const secEl = document.getElementById('assessment-cinfo-secretary');
  const memEl = document.getElementById('assessment-cinfo-members');

  if (nameEl) nameEl.textContent = council.name || 'Hội đồng Bảo vệ';
  if (statusEl) {
    const stMap = { preparing: 'Chuẩn bị', active: 'Đang diễn ra', ended: 'Kết thúc', finalized: 'Đã khóa' };
    statusEl.textContent = stMap[council.status] || 'Chuẩn bị';
  }
  if (timeRoomEl) {
    timeRoomEl.textContent = `📍 Phòng: ${council.room || 'Chưa cập nhật'} • 📅 Ngày: ${council.date || '--'} (${council.startTime || '--'} – ${council.endTime || '--'})`;
  }

  const membersBySlot = council.membersBySlot || {};
  if (chairEl) chairEl.textContent = membersBySlot['chair']?.memberName || '--';
  if (secEl) secEl.textContent = membersBySlot['secretary']?.memberName || '--';
  if (memEl) {
    const otherMembers = Object.entries(membersBySlot)
      .filter(([k]) => k !== 'chair' && k !== 'secretary')
      .map(([, v]) => v.memberName)
      .filter(Boolean);
    memEl.textContent = otherMembers.join(', ') || '--';
  }

  // Assigned students in this council
  const assignments = (act.councilStudentAssignments || []).filter(a => a.councilId === council.id);
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const studentsInCouncil = assignments.map(a => {
    const sObj = allRegs.find(s => (s.mssv || s.studentId) === a.studentId) || { studentId: a.studentId };
    return { ...sObj, ...a };
  });

  const tabBadge = document.getElementById('atab-badge-defense');
  if (tabBadge) tabBadge.textContent = studentsInCouncil.length;

  if (studentsInCouncil.length === 0) {
    container.innerHTML = '<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">Hội đồng này hiện chưa có sinh viên nào được phân công.</div>';
    return;
  }

  container.innerHTML = studentsInCouncil.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const supName = formatStudentSupervisorsForDisplay(s);
    const initial = (name || 'SV').charAt(0).toUpperCase();

    // Defense status from council engine
    const defenseScore = s.defenseScore != null ? Number(s.defenseScore).toFixed(1) : '--';
    const defenseStatus = s.presentationStatus || 'pending';
    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa báo cáo</span>';
    if (defenseStatus === 'presenting') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">Đang báo cáo</span>';
    } else if (defenseStatus === 'completed') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã hoàn tất</span>';
    }

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${idx + 1}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Supervisors & presentation order -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">GVHD</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Thứ tự báo cáo</span>
            <span class="font-bold text-slate-800">Lượt #${s.presentationOrder || (idx + 1)}</span>
          </div>
        </div>

        <!-- Right: Status & Workspace button -->
        <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div class="text-right">
            <div class="text-sm font-black text-purple-900">${defenseScore !== '--' ? defenseScore + '/10' : '--'}</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <button type="button" onclick="openCouncilWorkspace('${targetRound.id}', '${act.id}', '${council.id}', '${sid}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>🏛️</span> <span>Vào phòng chấm</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

window.onAssessmentCouncilChange = function(councilId) {
  state.selectedAssessmentCouncilId = councilId;
  renderAssessmentDefenseList();
};

window.launchAssessmentCouncilWorkspace = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  if (!targetRound) return;

  const councilId = state.selectedAssessmentCouncilId;
  if (!councilId) {
    showToast('Chưa chọn Hội đồng nào!', 'warning');
    return;
  }

  let actId = null;
  (targetRound.activities || []).forEach(a => {
    if (a.councilEnabled && (a.councils || []).some(c => c.id === councilId)) {
      actId = a.id;
    }
  });

  if (targetRound.id && actId && councilId) {
    openCouncilWorkspace(targetRound.id, actId, councilId);
  } else {
    showToast('Không tìm thấy dữ liệu Hội đồng!', 'error');
  }
};

// 5. TỔNG KẾT (ADMIN ONLY)
window.renderAssessmentSummaryTable = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const tbody = document.getElementById('assessment-summary-tbody');
  if (!targetRound || !tbody) return;

  const ranking = computeRoundRanking(targetRound.id);
  const allStudents = [...(ranking.rankedStudents || []), ...(ranking.incompleteStudents || [])];

  const tabBadge = document.getElementById('atab-badge-summary');
  if (tabBadge) tabBadge.textContent = allStudents.length;

  if (allStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="p-8 text-center text-slate-400">Chưa có dữ liệu tổng kết điểm cho đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = allStudents.map((st, idx) => {
    const isRanked = st.rank != null;
    const gvhdScore = st.components?.gvhd?.raw != null ? Number(st.components.gvhd.raw).toFixed(1) : '--';
    const tmHdScore = targetRound.thesisScores?.[st.studentId]?.hd?.score != null ? Number(targetRound.thesisScores[st.studentId].hd.score).toFixed(1) : '--';
    const tmPbScore = targetRound.thesisScores?.[st.studentId]?.pb?.score != null ? Number(targetRound.thesisScores[st.studentId].pb.score).toFixed(1) : '--';
    const tmScore = st.components?.tm?.raw != null ? Number(st.components.tm.raw).toFixed(1) : '--';
    const defenseScore = st.components?.defense?.raw != null ? Number(st.components.defense.raw).toFixed(1) : '--';
    const finalScore = isRanked && st.rawScore != null ? Number(st.rawScore).toFixed(2) : '--';
    const rankDisplay = isRanked ? `#${st.rank}` : '--';
    const titleDisplay = st.title || (isRanked ? 'Hoàn thành' : 'Chưa đủ điểm');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${rankDisplay}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${st.studentId}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${st.fullName}</td>
        <td class="p-3 text-slate-600 whitespace-nowrap">${formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))}</td>
        <td class="p-3 text-center font-mono text-slate-700">${gvhdScore}</td>
        <td class="p-3 text-center font-mono text-slate-700">${tmHdScore}</td>
        <td class="p-3 text-center font-mono text-slate-700">${tmPbScore}</td>
        <td class="p-3 text-center font-mono font-semibold text-blue-800">${tmScore}</td>
        <td class="p-3 text-center font-mono font-semibold text-purple-800">${defenseScore}</td>
        <td class="p-3 text-center font-mono font-black text-slate-900 bg-slate-50">${finalScore}</td>
        <td class="p-3 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isRanked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${titleDisplay}
          </span>
        </td>
      </tr>
    `;
  }).join('');
};
