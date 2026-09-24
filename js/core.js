/**
 * IFA+ Graduation — Core Module
 * Services, State, Formatters, Audit Guards & UI Primitives
 */


import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { 
  getStorage, 
  ref as storageRef, 
  getBytes as storageGetBytes,
  uploadBytes,
  getDownloadURL,
  deleteObject
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



// Expose Firebase SDK primitives globally for module interoperability
window.initializeApp = initializeApp;
window.getApps = getApps;
window.getApp = getApp;
window.getStorage = getStorage;
window.storageRef = storageRef;
window.storageGetBytes = storageGetBytes;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;
window.deleteObject = deleteObject;
window.getAuth = getAuth;
window.onAuthStateChanged = onAuthStateChanged;
window.signInWithPopup = signInWithPopup;
window.GoogleAuthProvider = GoogleAuthProvider;
window.signOut = signOut;
window.getFirestore = getFirestore;
window.collection = collection;
window.doc = doc;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.serverTimestamp = serverTimestamp;
window.onSnapshot = onSnapshot;
window.rawAddDoc = rawAddDoc;
window.rawSetDoc = rawSetDoc;
window.rawUpdateDoc = rawUpdateDoc;
window.rawDeleteDoc = rawDeleteDoc;
window.rawWriteBatch = rawWriteBatch;
window.rawRunTransaction = rawRunTransaction;



function getCurrentPortal() {
  try {
    const path = (window.location.pathname || '').toLowerCase();
    if (path.includes('/admin') || path.endsWith('/admin') || path.endsWith('/admin/')) {
      return 'admin';
    }
    if (path.includes('/supervisor') || path.endsWith('/supervisor') || path.endsWith('/supervisor/') ||
        path.includes('/gvhd') || path.endsWith('/gvhd') || path.endsWith('/gvhd/')) {
      if (path.includes('/gvhd') || path.endsWith('/gvhd') || path.endsWith('/gvhd/')) {
        try {
          window.history.replaceState(null, '', '/supervisor/');
        } catch (e) {}
      }
      return 'supervisor';
    }
    if (path.includes('/assessment') || path.endsWith('/assessment') || path.endsWith('/assessment/') ||
        path.includes('/mark') || path.endsWith('/mark') || path.endsWith('/mark/')) {
      if (path.includes('/mark') || path.endsWith('/mark') || path.endsWith('/mark/')) {
        try {
          window.history.replaceState(null, '', '/assessment/');
        } catch (e) {}
      }
      return 'assessment';
    }
    if (path === '/' || path.endsWith('/') || path.includes('/student')) {
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
  const colors = {
    success: 'border-emerald-500 text-emerald-700 bg-emerald-50',
    error: 'border-rose-500 text-rose-700 bg-rose-50',
    warning: 'border-amber-500 text-amber-700 bg-amber-50',
    info: 'border-blue-500 text-blue-700 bg-blue-50'
  };
  const labels = { success: 'Thành công', error: 'Có lỗi xảy ra', warning: 'Cần chú ý', info: 'Thông báo' };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-start gap-3 rounded-xl border border-l-4 bg-white px-4 py-3 shadow-xl text-xs transform transition-all duration-200 translate-y-2 opacity-0 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-current/10 font-black" data-icon></span>
    <span class="min-w-0 flex-1"><strong class="block font-black" data-title></strong><span class="mt-0.5 block break-words leading-snug text-slate-700" data-message></span></span>
    <button type="button" class="ml-1 text-slate-400 hover:text-slate-700 font-bold" aria-label="Đóng thông báo">✕</button>
  `;
  toast.querySelector('[data-icon]').textContent = icons[type] || icons.info;
  toast.querySelector('[data-title]').textContent = labels[type] || labels.info;
  toast.querySelector('[data-message]').textContent = String(message);

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
      resolve(false);
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

window.showInputDialog = function(title, message, { defaultValue = '', placeholder = '', confirmText = 'Xác nhận', required = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="app-input-title" class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div class="border-b border-slate-100 bg-slate-50 px-5 py-4"><h3 id="app-input-title" class="text-base font-black text-slate-900"></h3><p class="mt-1 text-xs leading-relaxed text-slate-600"></p></div>
      <div class="p-5"><input type="text" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"></div>
      <div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3"><button type="button" data-cancel class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Hủy</button><button type="button" data-confirm class="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"></button></div>
    </div>`;
    overlay.querySelector('h3').textContent = title;
    overlay.querySelector('p').textContent = message;
    const input = overlay.querySelector('input');
    input.value = defaultValue;
    input.placeholder = placeholder;
    const confirmButton = overlay.querySelector('[data-confirm]');
    confirmButton.textContent = confirmText;
    const close = value => { document.removeEventListener('keydown', onKeyDown); overlay.remove(); resolve(value); };
    const onKeyDown = event => {
      if (event.key === 'Escape') close(null);
      if (event.key === 'Enter' && document.activeElement === input) confirmButton.click();
    };
    confirmButton.onclick = () => {
      const value = input.value.trim();
      if (required && !value) { input.focus(); input.classList.add('border-rose-500'); return; }
      close(value);
    };
    overlay.querySelector('[data-cancel]').onclick = () => close(null);
    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  });
};

// Modal overlays are siblings in the document, but can open from another modal.
// Give each newly opened overlay the next layer so every nested workflow remains usable.
let modalLayerCounter = 1000;
const visibleModalLayers = new WeakSet();
function updateModalLayer(element) {
  if (!(element instanceof HTMLElement) || !element.matches('.fixed[id^="modal-"], .fixed[id$="-modal"], .fixed[id$="-dialog"]')) return;
  if (element.classList.contains('hidden')) {
    visibleModalLayers.delete(element);
    return;
  }
  if (visibleModalLayers.has(element)) return;
  element.style.zIndex = String(++modalLayerCounter);
  visibleModalLayers.add(element);
}
function watchModalLayers() {
  document.querySelectorAll('.fixed[id^="modal-"], .fixed[id$="-modal"], .fixed[id$="-dialog"]').forEach(updateModalLayer);
  new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') updateModalLayer(mutation.target);
      else for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        updateModalLayer(node);
        node.querySelectorAll('.fixed[id^="modal-"], .fixed[id$="-modal"], .fixed[id$="-dialog"]').forEach(updateModalLayer);
      }
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchModalLayers, { once: true });
else watchModalLayers();

async function copyLinkWithFallback(link, label) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard không khả dụng');
    await navigator.clipboard.writeText(link);
    showToast(`Đã sao chép ${label}.`, 'success');
  } catch (_) {
    await showInputDialog('Sao chép liên kết', 'Chọn và sao chép liên kết bên dưới:', { defaultValue: link, confirmText: 'Đóng' });
  }
}

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


// Central Write Guard & Audit Logger for Exact Act-As Test Mode
export async function logImpersonationAudit(actionName, details = {}) {
  try {
    if (!state.impersonation) return;
    const realUser = getRealUser();
    const actor = getEffectiveActor();
    const roundId = details.roundId || actor.roundId || state.selectedRoundId || '';

    const auditPayload = {
      realAdminUid: realUser?.uid || '',
      realAdminEmail: realUser?.email || '',
      effectiveActorRole: actor.targetType || actor.roleLabel || '',
      effectiveActorId: actor.uid || '',
      effectiveActorEmail: actor.email || '',
      effectiveActorMssv: actor.studentMssv || '',
      roundId: roundId,
      action: actionName,
      targetPath: details.targetPath || '',
      timestamp: serverTimestamp(),
      performedViaImpersonation: true
    };

    // Asynchronously log to auditLogs collection
    await rawAddDoc(collection(db, 'auditLogs'), auditPayload).catch(e => {
      console.warn('[Impersonation Audit] Failed to save audit log:', e);
    });
  } catch (err) {
    console.warn('[Impersonation Audit] Error creating audit log:', err);
  }
}
window.logImpersonationAudit = logImpersonationAudit;

export function assertWriteAllowedForEffectiveActor(actionName = 'Thao tác', context = {}) {
  if (!state.impersonation) {
    return true; // Normal direct user / admin operation
  }

  // If in Act-As mode, verify system setting and real user authorization
  if (!state.allowImpersonation) {
    const msg = `[CHẾ ĐỘ ĐÓNG VAI] Tính năng đóng vai đang bị tắt trong Cài đặt hệ thống. Thao tác (${actionName}) bị chặn.`;
    if (typeof showToast === 'function') showToast(msg, 'warning', 6000);
    const err = new Error(msg);
    err.code = 'permission-denied-impersonation-disabled';
    throw err;
  }

  if (!state.realIsAdmin) {
    const msg = `[CHẾ ĐỘ ĐÓNG VAI] Chỉ Quản trị viên mới được phép thực hiện thao tác trong chế độ đóng vai.`;
    if (typeof showToast === 'function') showToast(msg, 'error', 6000);
    const err = new Error(msg);
    err.code = 'permission-denied-impersonation-unauthorized';
    throw err;
  }

  // Audit log write operation
  logImpersonationAudit(actionName, context);
  return true;
}
window.assertWriteAllowedForEffectiveActor = assertWriteAllowedForEffectiveActor;
window.assertNotImpersonatingForWrite = assertWriteAllowedForEffectiveActor; // Backward compatibility alias

export async function setDoc(docRef, data, options) {
  assertWriteAllowedForEffectiveActor('setDoc', { targetPath: docRef?.path });
  return await rawSetDoc(docRef, data, options);
}

export async function updateDoc(docRef, ...args) {
  assertWriteAllowedForEffectiveActor('updateDoc', { targetPath: docRef?.path });
  return await rawUpdateDoc(docRef, ...args);
}

export async function addDoc(colRef, data) {
  assertWriteAllowedForEffectiveActor('addDoc', { targetPath: colRef?.path });
  return await rawAddDoc(colRef, data);
}

export async function deleteDoc(docRef) {
  assertWriteAllowedForEffectiveActor('deleteDoc', { targetPath: docRef?.path });
  return await rawDeleteDoc(docRef);
}

export function writeBatch(firestore) {
  assertWriteAllowedForEffectiveActor('writeBatch');
  const batch = rawWriteBatch(firestore);
  const origCommit = batch.commit.bind(batch);
  batch.commit = async function() {
    assertWriteAllowedForEffectiveActor('writeBatch.commit');
    return await origCommit();
  };
  return batch;
}

export async function runTransaction(firestore, updateFunction) {
  assertWriteAllowedForEffectiveActor('runTransaction');
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

window.copyRoundLink = async function(roundId, shortCode) {
  const r = (state.rounds || []).find(x => x.id === roundId);
  const code = r?.slug || r?.shortCode || shortCode || roundId;
  const link = `${window.location.origin}${window.location.pathname}?x=${encodeURIComponent(code)}`;
  await copyLinkWithFallback(link, 'liên kết đợt tốt nghiệp');
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
  roundsLoaded: false,
  selectedRoundId: null,
  activeRound: null,
  projectTypes: DEFAULT_PROJECT_TYPES.map((name, idx) => ({ id: 'default_' + (idx + 1), name, order: idx + 1, active: true })),
  supervisorsMaster: [],
  facultyStudents: [],
  facultyStudentsMap: new Map(),
  roundSupervisors: [],
  eligibleStudents: [],
  eligibleStudentDetails: null,
  myRegistration: null,
  myOfficialAssignment: null,
  studentSelfProfile: null,
  
  // Registration Flow State
  currentStep: 1,
  wizardRank: 1,
  selectedPreferences: [], // [{ rank: 1, supervisorId, supervisorName, photoUrl, department }]
  
  // Preview Mode
  isPreviewMode: false,
  previewMssv: '',
  
  // Excel Staging
  assignmentImportPreview: [],
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
    eligible: [],
    officialAssignments: [],
    assignmentDrafts: []
  },
  inspectingSupervisorId: null,
  manualAssignStudentId: null
};

window.state = state;

let app, auth, db, storage;
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
    apiKey: "AIzaSyBwpZyNyskZ1OJ6tDvh249aeH70MLtO1iI",
    authDomain: "ifa-graduation.firebaseapp.com",
    projectId: "ifa-graduation",
    storageBucket: "ifa-graduation.firebasestorage.app",
    messagingSenderId: "38525030677",
    appId: "1:38525030677:web:2180f20ae9c0cadf63991c",
    measurementId: "G-HJEH0T842C"
  };
  app = getApps().length > 0 ? getApp() : initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  try {
    storage = getStorage(app);
  } catch (e) {
    console.warn('Firebase Storage initialization notice:', e);
  }
}





// Expose core utilities to global window
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.fmt24h = fmt24h;
window.fmtDateRange24h = fmtDateRange24h;
window.DEFAULT_PROJECT_TYPES = DEFAULT_PROJECT_TYPES;
window.initFirebase = initFirebase;
window.unsubscribeSettings = null;

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'auth', { get: () => auth, set: (v) => { auth = v; }, configurable: true });
  Object.defineProperty(window, 'db', { get: () => db, set: (v) => { db = v; }, configurable: true });
  Object.defineProperty(window, 'app', { get: () => app, set: (v) => { app = v; }, configurable: true });
  Object.defineProperty(window, 'storage', { get: () => storage, set: (v) => { storage = v; }, configurable: true });
}

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getCurrentPortal !== 'undefined') window.getCurrentPortal = getCurrentPortal;
  if (typeof updateModalLayer !== 'undefined') window.updateModalLayer = updateModalLayer;
  if (typeof watchModalLayers !== 'undefined') window.watchModalLayers = watchModalLayers;
  if (typeof copyLinkWithFallback !== 'undefined') window.copyLinkWithFallback = copyLinkWithFallback;
  if (typeof getSupervisorId !== 'undefined') window.getSupervisorId = getSupervisorId;
  if (typeof logImpersonationAudit !== 'undefined') window.logImpersonationAudit = logImpersonationAudit;
  if (typeof assertWriteAllowedForEffectiveActor !== 'undefined') window.assertWriteAllowedForEffectiveActor = assertWriteAllowedForEffectiveActor;
  if (typeof setDoc !== 'undefined') window.setDoc = setDoc;
  if (typeof updateDoc !== 'undefined') window.updateDoc = updateDoc;
  if (typeof addDoc !== 'undefined') window.addDoc = addDoc;
  if (typeof deleteDoc !== 'undefined') window.deleteDoc = deleteDoc;
  if (typeof writeBatch !== 'undefined') window.writeBatch = writeBatch;
  if (typeof runTransaction !== 'undefined') window.runTransaction = runTransaction;
  if (typeof showLoading !== 'undefined') window.showLoading = showLoading;
  if (typeof hideLoading !== 'undefined') window.hideLoading = hideLoading;
  if (typeof initFirebase !== 'undefined') window.initFirebase = initFirebase;
  if (typeof removeToast !== 'undefined') window.removeToast = removeToast;
  if (typeof cleanup !== 'undefined') window.cleanup = cleanup;
  if (typeof close !== 'undefined') window.close = close;
  if (typeof onKeyDown !== 'undefined') window.onKeyDown = onKeyDown;
  if (typeof pad !== 'undefined') window.pad = pad;
  if (typeof fmt24h !== 'undefined') window.fmt24h = fmt24h;
  if (typeof fmtDateRange24h !== 'undefined') window.fmtDateRange24h = fmtDateRange24h;
}

// --- OFFICIAL SUPERVISORS & ASSIGNMENT DOMAIN HELPERS ---
export function getOfficialSupervisors(reg) {
  if (!reg) return [];
  if (Array.isArray(reg.officialSupervisors) && reg.officialSupervisors.length > 0) {
    return reg.officialSupervisors;
  }
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

export function normalizeOfficialAssignment(assignment, registration = null) {
  if (!assignment && !registration) return null;
  const source = assignment || {};
  const legacy = registration || {};
  const supervisors = Array.isArray(source.supervisors) && source.supervisors.length > 0
    ? source.supervisors
    : getOfficialSupervisors(legacy);
  const primary = supervisors.find(s => s.role === 'primary') || supervisors[0] || null;
  return {
    ...legacy,
    ...source,
    studentId: source.studentId || legacy.studentId || source.id || legacy.id || '',
    studentName: source.studentName || legacy.studentName || '',
    email: source.studentEmail || source.email || legacy.email || '',
    topicTitle: legacy.topicTitle || source.topicTitle || '',
    projectType: legacy.projectType || source.projectType || '',
    officialSupervisors: supervisors,
    acceptedSupervisorId: source.acceptedSupervisorId || primary?.supervisorId || legacy.acceptedSupervisorId || '',
    acceptedSupervisorName: source.acceptedSupervisorName || primary?.supervisorName || legacy.acceptedSupervisorName || '',
    acceptedRank: source.acceptedRank || legacy.acceptedRank || 'manual',
    reviewStatus: supervisors.length > 0 ? 'manually_assigned' : (legacy.reviewStatus || 'unassigned'),
    assignmentStatus: source.assignmentStatus || (legacy.reviewStatus === 'accepted' || legacy.reviewStatus === 'manually_assigned' ? 'published' : '')
  };
}

export function getSupervisorAssignmentMode(round = state?.activeRound) {
  return round?.supervisorAssignmentMode === 'direct_assignment'
    ? 'direct_assignment'
    : 'student_preference';
}

export function isDirectSupervisorAssignment(round = state?.activeRound) {
  return getSupervisorAssignmentMode(round) === 'direct_assignment';
}

export function shouldSkipStudentSupervisorPreference(round = state?.activeRound) {
  return isDirectSupervisorAssignment(round)
    || state.myOfficialAssignment?.assignmentStatus === 'published';
}

if (typeof window !== 'undefined') {
  window.getOfficialSupervisors = getOfficialSupervisors;
  window.normalizeOfficialAssignment = normalizeOfficialAssignment;
  window.getSupervisorAssignmentMode = getSupervisorAssignmentMode;
  window.isDirectSupervisorAssignment = isDirectSupervisorAssignment;
  window.shouldSkipStudentSupervisorPreference = shouldSkipStudentSupervisorPreference;
}

// --- TIMELINE EVENT & COLOR DOMAIN HELPERS ---
export const ROUND_WEEK_EVENT_COLORS = [
  ['#dc2626', 'Đỏ'], ['#ea580c', 'Cam'], ['#d97706', 'Hổ phách'], ['#ca8a04', 'Vàng'],
  ['#65a30d', 'Xanh lá nhạt'], ['#16a34a', 'Xanh lá'], ['#0f766e', 'Xanh ngọc'], ['#0891b2', 'Xanh cyan'],
  ['#2563eb', 'Xanh dương'], ['#4f46e5', 'Chàm'], ['#7e22ce', 'Tím'], ['#db2777', 'Hồng']
];

export function normalizeRoundWeekEventColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#2563eb';
}

export function getRoundWeekEventRange(event = {}) {
  const fallback = Math.max(0, Math.min(6, Number(event.dayIndex) || 0));
  let startDayIndex = Number.isInteger(Number(event.startDayIndex))
    ? Math.max(0, Math.min(6, Number(event.startDayIndex)))
    : fallback;
  let endDayIndex = Number.isInteger(Number(event.endDayIndex))
    ? Math.max(0, Math.min(6, Number(event.endDayIndex)))
    : startDayIndex;
  if (endDayIndex < startDayIndex) [startDayIndex, endDayIndex] = [endDayIndex, startDayIndex];
  return { startDayIndex, endDayIndex };
}

export function roundWeekEventOccursOnDay(event, day) {
  if (!event || !day) return false;
  if (event.activityId && event.startDate && event.endDate) {
    return day.key >= event.startDate && day.key <= event.endDate;
  }
  const { startDayIndex, endDayIndex } = getRoundWeekEventRange(event);
  return day.dayIndex >= startDayIndex && day.dayIndex <= endDayIndex;
}

export function distinguishOverlappingTimelineEvents(events = [], days = []) {
  if (!Array.isArray(events)) return [];
  const assigned = [];
  return events.map(event => {
    const occupied = new Set(assigned.filter(previous => (days || []).some(day =>
      roundWeekEventOccursOnDay(event, day) && roundWeekEventOccursOnDay(previous, day)
    )).map(previous => previous.displayColor));
    const preferred = normalizeRoundWeekEventColor(event.color);
    const displayColor = occupied.has(preferred)
      ? (ROUND_WEEK_EVENT_COLORS.find(([color]) => !occupied.has(color))?.[0] || preferred)
      : preferred;
    const colored = { ...event, displayColor };
    assigned.push(colored);
    return colored;
  });
}

if (typeof window !== 'undefined') {
  window.ROUND_WEEK_EVENT_COLORS = ROUND_WEEK_EVENT_COLORS;
  window.normalizeRoundWeekEventColor = normalizeRoundWeekEventColor;
  window.getRoundWeekEventRange = getRoundWeekEventRange;
  window.roundWeekEventOccursOnDay = roundWeekEventOccursOnDay;
  window.distinguishOverlappingTimelineEvents = distinguishOverlappingTimelineEvents;
}

export function getRoundTimelineDefaultTitle(weekNum) {
  const n = Number(weekNum);
  if (n === 13) return 'Nộp Sơ khảo';
  if (n === 14) return 'Bảo vệ Tốt nghiệp';
  if (n === 15) return 'Tổng kết & Kết quả';
  if (n > 15) return 'Mốc ' + n;
  return 'Tuần ' + n;
}

export function resolveRoundWeekTitle(weekNum, customTitle) {
  const n = Number(weekNum);
  const trimmed = String(customTitle || '').trim();
  if (trimmed && !/^Tuần\s+\d+$/i.test(trimmed)) {
    return trimmed;
  }
  if (n > 12) {
    if (!trimmed || /^Tuần\s+\d+$/i.test(trimmed)) {
      return getRoundTimelineDefaultTitle(n);
    }
  }
  return trimmed || ('Tuần ' + n);
}

if (typeof window !== 'undefined') {
  window.getRoundTimelineDefaultTitle = getRoundTimelineDefaultTitle;
  window.resolveRoundWeekTitle = resolveRoundWeekTitle;
}

// --- PLANNING & ACTIVITIES DOMAIN HELPERS ---
export const ACTIVITY_TYPES = {
  announcement: { label: 'Thông báo', icon: '📢', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  submission: { label: 'Nộp bài', icon: '📥', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  review: { label: 'Duyệt hội đồng', icon: '📋', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  preliminary: { label: 'Sơ khảo', icon: '🔍', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  thesis: { label: 'Chấm thuyết minh', icon: '📖', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  defense: { label: 'Bảo vệ', icon: '🎓', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  other: { label: 'Khác', icon: '📌', color: 'bg-slate-100 text-slate-700 border-slate-200' }
};

export function isActivityPublished(activity) {
  if (!activity) return false;
  if (activity.publicationStatus) return activity.publicationStatus === 'published';
  return activity.visibility !== false;
}

if (typeof window !== 'undefined') {
  window.ACTIVITY_TYPES = ACTIVITY_TYPES;
  window.isActivityPublished = isActivityPublished;
}
