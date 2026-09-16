
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

/** IFA+ Graduation Beta Studio v1.6.0-beta.3 **/

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
  addDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  writeBatch 
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';


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
  
  // Active Data
  rounds: [],
  selectedRoundId: null,
  activeRound: null,
  projectTypes: DEFAULT_PROJECT_TYPES.map((name, idx) => ({ id: 'default_' + (idx + 1), name, order: idx + 1, active: true })),
  supervisorsMaster: [],
  facultyStudents: [],
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
export async function setupAuthListener() {
  showLoading('Đang khởi tạo IFA+ Graduation Beta...');

  // Fallback an toàn: Loading overlay bắt buộc phải ẩn sau tối đa 6 giây
  const safetyTimer = setTimeout(() => {
    hideLoading();
  }, 6000);

  onAuthStateChanged(auth, async user => {
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
        updateAuthUI();

        // 2. Kích hoạt ngay view ban đầu để UI hiển thị tức thì
        const initView = state.currentView || state.actualRole || 'student';
        await switchView(initView);

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
      if (state.isAdmin) {
        setTimeout(() => {
          bootstrapProjectTypesIfNeeded().catch(() => {});
        }, 1200);
      }

    } else {
      clearTimeout(safetyTimer);
      await resolveActualRoles(null);
      updateAuthUI();
      document.getElementById('login-required-section').classList.remove('hidden');
      document.getElementById('view-student').classList.add('hidden');
      document.getElementById('view-supervisor').classList.add('hidden');
      document.getElementById('view-admin').classList.add('hidden');
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
  if (email === 'tranquanghai@tdtu.edu.vn') {
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

    document.getElementById('user-display-name').textContent = state.user.displayName || state.user.email;
    document.getElementById('user-avatar').src = state.user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23fff"/><path fill="%23fff" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';
    
    // Display ACTUAL ROLE badge
    const roleBadge = document.getElementById('user-role-badge');
    const viewingBadge = document.getElementById('user-viewing-badge');
    
    let roleName = 'Sinh viên';
    let badgeClass = 'text-[10px] bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded font-medium border border-blue-400/30';

    if (state.actualRole === 'admin') {
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

    // Subtext if viewing different view
    if (viewingBadge) {
      if (state.actualRole && state.currentView && state.actualRole !== state.currentView) {
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

    if (state.isAdmin) {
      if (adminDeskBtn) { adminDeskBtn.classList.remove('hidden'); adminDeskBtn.classList.add('flex'); }
      if (adminMobBtn) adminMobBtn.classList.remove('hidden');
      if (state.isSupervisor) {
        if (supDeskBtn) { supDeskBtn.classList.remove('hidden'); supDeskBtn.classList.add('flex'); }
        if (supMobBtn) supMobBtn.classList.remove('hidden');
      } else {
        if (supDeskBtn) { supDeskBtn.classList.add('hidden'); supDeskBtn.classList.remove('flex'); }
        if (supMobBtn) supMobBtn.classList.add('hidden');
      }
    } else if (state.isSupervisor) {
      if (adminDeskBtn) { adminDeskBtn.classList.add('hidden'); adminDeskBtn.classList.remove('flex'); }
      if (adminMobBtn) adminMobBtn.classList.add('hidden');
      if (supDeskBtn) { supDeskBtn.classList.remove('hidden'); supDeskBtn.classList.add('flex'); }
      if (supMobBtn) supMobBtn.classList.remove('hidden');
    } else {
      if (adminDeskBtn) { adminDeskBtn.classList.add('hidden'); adminDeskBtn.classList.remove('flex'); }
      if (adminMobBtn) adminMobBtn.classList.add('hidden');
      if (supDeskBtn) { supDeskBtn.classList.add('hidden'); supDeskBtn.classList.remove('flex'); }
      if (supMobBtn) supMobBtn.classList.add('hidden');
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

  ['student', 'supervisor', 'admin'].forEach(v => {
    const isCurrent = (v === targetView);
    const deskBtn = document.getElementById(navBtns[v][0]);
    const mobBtn = document.getElementById(navBtns[v][1]);

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

  if (targetView === 'admin' && state.isAdmin) {
    loadAdminStats();
  } else if (targetView === 'supervisor' && state.selectedRoundId) {
    loadSupervisorReviewData(state.selectedRoundId);
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
        if (regFlow) regFlow.classList.remove('hidden');
        if (state.selectedRoundId) checkStudentEligibilityAndRegistration(state.selectedRoundId);
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

  document.getElementById('round-title-display').textContent = round.title;
  document.getElementById('round-academic-year').textContent = `Năm học ${round.academicYear || ''}`;
  
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
  const reviewInProgressCard = document.getElementById('review-in-progress-card');
  const officialResultCard = document.getElementById('official-result-card');
  const flowContainer = document.getElementById('registration-flow-container');

  if (!mssv) {
    nonEligibleAlert.classList.add('hidden');
    alreadyRegCard.classList.add('hidden');
    reviewInProgressCard.classList.add('hidden');
    officialResultCard.classList.add('hidden');
    flowContainer.classList.remove('hidden');
    renderSupervisorsGrid();
    return;
  }

  try {
    const elDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'eligibleStudents', mssv));
    state.isEligible = elDoc.exists() && elDoc.data().eligible !== false;

    if (!state.isEligible) {
      nonEligibleAlert.classList.remove('hidden');
      alreadyRegCard.classList.add('hidden');
      reviewInProgressCard.classList.add('hidden');
      officialResultCard.classList.add('hidden');
      flowContainer.classList.add('hidden');
      return;
    } else {
      nonEligibleAlert.classList.add('hidden');
    }

    const regDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'registrations', mssv));
    if (regDoc.exists()) {
      state.myRegistration = regDoc.data();
      flowContainer.classList.add('hidden');

      const roundStatus = state.activeRound?.status;
      const reviewStatus = state.activeRound?.reviewStatus;

      // 1. If Published / Completed: Show Official Result Card
      if (roundStatus === 'published' || reviewStatus === 'completed') {
        alreadyRegCard.classList.add('hidden');
        reviewInProgressCard.classList.add('hidden');
        renderStudentOfficialResult(state.myRegistration);
        officialResultCard.classList.remove('hidden');
        return;
      }

      // 2. If Reviewing in Progress: Show Neutral Reviewing Card
      if (roundStatus === 'reviewing' || (reviewStatus && reviewStatus.startsWith('round_')) || reviewStatus === 'manual_assignment') {
        alreadyRegCard.classList.add('hidden');
        officialResultCard.classList.add('hidden');
        
        let roundName = 'VÒNG XÉT NGUYỆN VỌNG';
        if (reviewStatus === 'round_1') roundName = 'XÉT NGUYỆN VỌNG 1';
        else if (reviewStatus === 'round_2') roundName = 'XÉT NGUYỆN VỌNG 2';
        else if (reviewStatus === 'round_3') roundName = 'XÉT NGUYỆN VỌNG 3';
        else if (reviewStatus === 'manual_assignment') roundName = 'ĐIỀU PHỐI BỔ SUNG';
        
        document.getElementById('review-round-tag').textContent = roundName;
        reviewInProgressCard.classList.remove('hidden');
        return;
      }

      // 3. Normal Submitted State
      officialResultCard.classList.add('hidden');
      reviewInProgressCard.classList.add('hidden');
      renderStudentExistingRegistration(state.myRegistration);
      alreadyRegCard.classList.remove('hidden');

    } else {
      alreadyRegCard.classList.add('hidden');
      reviewInProgressCard.classList.add('hidden');
      officialResultCard.classList.add('hidden');
      flowContainer.classList.remove('hidden');
      goToStep(1);
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

  document.getElementById('already-registered-card').classList.add('hidden');
  document.getElementById('registration-flow-container').classList.remove('hidden');
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
      reviewStatus: 'waiting'
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

    // Filter Candidates who picked this supervisor at rank == currentReviewRound AND not accepted yet
    const candidates = allRegistrations.filter(r => {
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') return false;
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
  const panelReview = document.getElementById('sup-panel-review');
  const panelAccepted = document.getElementById('sup-panel-accepted');

  if (tabKey === 'review') {
    btnReview.className = 'px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 shadow-sm transition-all';
    btnAccepted.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all';
    panelReview.classList.remove('hidden');
    panelAccepted.classList.add('hidden');
  } else {
    btnReview.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all';
    btnAccepted.className = 'px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 shadow-sm transition-all';
    panelReview.classList.add('hidden');
    panelAccepted.classList.remove('hidden');
    renderSupervisorAcceptedTable();
  }
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
      <td class="p-3.5 text-slate-500">${s.email || '--'}</td>
      <td class="p-3.5 max-w-xs font-medium text-blue-900" title="${s.topicTitle}">${s.topicTitle}</td>
      <td class="p-3.5 text-slate-600">${s.projectType || '--'}</td>
      <td class="p-3.5">
        <span class="badge bg-emerald-100 text-emerald-800 font-bold">
          ${s.acceptedRank === 'manual' ? 'Phân công Khoa' : 'Nguyện vọng ' + s.acceptedRank}
        </span>
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

window.switchAdminTab = function(tabKey) {
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    b.classList.remove('bg-slate-900', 'text-white', 'shadow-sm', 'font-bold');
    b.classList.add('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-semibold');
    const dot = b.querySelector('span');
    if (dot) dot.classList.replace('bg-blue-400', 'bg-slate-400');
  });
  const activeBtn = document.getElementById('atab-btn-' + tabKey);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100', 'hover:text-slate-900', 'font-semibold');
    activeBtn.classList.add('bg-slate-900', 'text-white', 'shadow-sm', 'font-bold');
    const dot = activeBtn.querySelector('span');
    if (dot) dot.classList.replace('bg-slate-400', 'bg-blue-400');
  }

  ['overview', 'review', 'rounds', 'faculty-students', 'supervisors-master', 'round-supervisors', 'eligible-students', 'project-types', 'registrations', 'preview-student', 'trash', 'timeline'].forEach(t => {
    const p = document.getElementById('atab-panel-' + t);
    if (p) {
      if (t === tabKey) p.classList.remove('hidden');
      else p.classList.add('hidden');
    }
  });

  if (tabKey === 'overview') loadAdminStats();
  else if (tabKey === 'faculty-students') openFacultyStudentsTab();
  else if (tabKey === 'review') { if (state.selectedRoundId) loadAdminReviewData(state.selectedRoundId); }
  else if (tabKey === 'rounds') renderAdminRoundsTable();
  else if (tabKey === 'supervisors-master') loadAdminSupervisorsMaster();
  else if (tabKey === 'round-supervisors' && state.selectedRoundId) loadAdminRoundSupervisors(state.selectedRoundId);
  else if (tabKey === 'eligible-students' && state.selectedRoundId) loadAdminEligibleStudents(state.selectedRoundId);
  else if (tabKey === 'registrations' && state.selectedRoundId) loadAdminRegistrations(state.selectedRoundId);
  else if (tabKey === 'preview-student') preparePreviewStudentDropdown();
  else if (tabKey === 'trash') renderAdminTrashTable();
  else if (tabKey === 'timeline') {
    const roundId = state.selectedRoundId || (state.rounds && state.rounds[0] ? state.rounds[0].id : null);
    if (roundId) {
      const sel = document.getElementById('admin-timeline-round-select');
      if (sel) sel.value = roundId;
      loadAdminRoundActivities(roundId);
    }
  }
};


// --- ACTIVE ROUND TOGGLE ---
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
    const isIncomplete = (r.configStatus === 'incomplete') || (typeof r.eligibleCount === 'number' && r.eligibleCount === 0) || (typeof r.supervisorCount === 'number' && r.supervisorCount === 0);

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
          <span class="font-bold text-slate-900 block">${r.title}</span>
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
    if (elCount > 0 && supCount > 0) {
      alertBox.className = 'p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold leading-relaxed';
      alertBox.innerHTML = '✓ Đợt đã hoàn tất cấu hình đầy đủ. Sẵn sàng kích hoạt thành Đợt hiện hành khi cần.';
    } else {
      alertBox.className = 'p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold leading-relaxed';
      const missing = [];
      if (elCount === 0) missing.push('SV đủ điều kiện');
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

  const emailToggle = document.getElementById('round-form-show-email-after-publish');
  if (emailToggle) emailToggle.checked = (r.showEmailAfterPublish !== false);
  const phoneToggle = document.getElementById('round-form-show-phone-after-publish');
  if (phoneToggle) phoneToggle.checked = (r.showPhoneAfterPublish !== false);

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

  // Load Eligible Students for this round
  state.roundModalEligibleStudents = [];
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', r.id, 'eligibleStudents'));
    state.roundModalEligibleStudents = snap.docs.map(d => ({
      studentId: d.id,
      mssv: d.id,
      ...d.data()
    }));
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
function renderRoundModalEligibleTable() {
  const tbody = document.getElementById('round-eligible-students-tbody');
  if (!tbody) return;

  const list = state.roundModalEligibleStudents || [];
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">Chưa có sinh viên nào trong đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((s, idx) => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-2.5 text-center text-slate-400 font-mono">${idx + 1}</td>
      <td class="p-2.5 font-mono font-bold text-slate-900">${s.studentId || s.mssv}</td>
      <td class="p-2.5 font-bold text-slate-800">${s.name || s.fullName || '--'}</td>
      <td class="p-2.5 text-slate-600">${s.major || '--'}</td>
      <td class="p-2.5 font-mono text-slate-600">${s.className || s.studentClass || '--'}</td>
      <td class="p-2.5 text-right">
        <button type="button" onclick="removeRoundModalEligibleStudent('${s.studentId || s.mssv}')" class="text-rose-600 hover:text-rose-800 font-bold text-xs hover:underline">Xóa</button>
      </td>
    </tr>
  `).join('');
}

window.removeRoundModalEligibleStudent = function(studentId) {
  state.roundModalEligibleStudents = state.roundModalEligibleStudents.filter(s => (s.studentId || s.mssv) !== studentId);
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
};

window.clearRoundModalEligibleStudents = function() {
  if (state.roundModalEligibleStudents.length === 0) return;
  state.roundModalEligibleStudents = [];
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
  showToast('Đã xóa toàn bộ sinh viên khỏi đợt.', 'info');
};

window.suggestFacultyStudentsForRound = async function(query) {
  const box = document.getElementById('round-student-suggestions');
  if (!box) return;
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) {
    box.classList.add('hidden');
    return;
  }

  let rows = state.facultyStudents;
  if (!rows || rows.length === 0) {
    rows = await ensureFacultyDatasetLoaded().catch(() => []);
  }

  const matches = (rows || []).filter(s =>
    (s.mssv && s.mssv.toLowerCase().includes(q)) ||
    (s.fullName && s.fullName.toLowerCase().includes(q)) ||
    (s.name && s.name.toLowerCase().includes(q))
  ).slice(0, 8);

  if (matches.length === 0) {
    box.innerHTML = '<div class="p-3 text-center text-slate-400">Không tìm thấy sinh viên phù hợp trong SV Khoa</div>';
    box.classList.remove('hidden');
    return;
  }

  box.innerHTML = matches.map(s => {
    const isAdded = state.roundModalEligibleStudents.some(x => (x.studentId || x.mssv) === s.mssv);
    return `
      <div onclick="addFacultyStudentToRound('${s.mssv}')" class="p-2.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between transition-colors">
        <div>
          <span class="font-bold font-mono text-slate-900 mr-2">${s.mssv}</span>
          <span class="font-semibold text-slate-800">${s.fullName || s.name}</span>
          <span class="text-[11px] text-slate-500 block">${s.major || ''} • ${s.className || s.studentClass || ''}</span>
        </div>
        <div>
          ${isAdded ? '<span class="text-emerald-600 font-bold text-xs">✓ Đã thêm</span>' : '<span class="text-indigo-600 font-bold text-xs">+ Chọn</span>'}
        </div>
      </div>
    `;
  }).join('');
  box.classList.remove('hidden');
};

window.addFacultyStudentToRound = function(mssv) {
  const box = document.getElementById('round-student-suggestions');
  const input = document.getElementById('round-add-student-input');
  if (box) box.classList.add('hidden');
  if (input) input.value = '';

  if (state.roundModalEligibleStudents.some(s => (s.studentId || s.mssv) === mssv)) {
    showToast(`Sinh viên ${mssv} đã có trong danh sách đợt!`, 'warning');
    return;
  }

  const s = (state.facultyStudents || []).find(x => x.mssv === mssv);
  if (!s) return;

  state.roundModalEligibleStudents.push({
    studentId: s.mssv,
    mssv: s.mssv,
    name: s.fullName || s.name || '',
    fullName: s.fullName || s.name || '',
    gender: s.gender || '',
    major: s.major || '',
    className: s.className || s.studentClass || '',
    studentClass: s.className || s.studentClass || '',
    email: s.email || `${s.mssv.toLowerCase()}@student.tdtu.edu.vn`,
    phone: s.phone || '',
    eligible: true
  });

  renderRoundModalEligibleTable();
  updateRoundModalBadges();
  showToast(`✓ Đã thêm sinh viên ${mssv} vào đợt!`, 'success');
};

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

    let addedCount = 0;
    const existingMssv = new Set(state.roundModalEligibleStudents.map(s => s.studentId || s.mssv));

    rawRows.forEach(row => {
      const rawMssv = String(row[mssvKey] || '').trim().toUpperCase();
      if (!rawMssv || rawMssv.length < 5 || existingMssv.has(rawMssv)) return;

      let fullName = '';
      if (fullNameKey && String(row[fullNameKey] || '').trim()) {
        fullName = String(row[fullNameKey]).trim();
      } else {
        const fam = familyKey ? String(row[familyKey] || '').trim() : '';
        const giv = givenKey ? String(row[givenKey] || '').trim() : '';
        fullName = [fam, giv].filter(Boolean).join(' ');
      }
      fullName = fullName.replace(/\s+/g, ' ');

      const gender = genderKey ? String(row[genderKey] || '').trim() : '';
      const major = majorKey ? String(row[majorKey] || '').trim() : '';
      const className = classKey ? String(row[classKey] || '').trim() : '';
      let email = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : '';
      if (!email) email = `${rawMssv.toLowerCase()}@student.tdtu.edu.vn`;
      const phone = phoneKey ? String(row[phoneKey] || '').trim() : '';

      state.roundModalEligibleStudents.push({
        studentId: rawMssv,
        mssv: rawMssv,
        name: fullName || rawMssv,
        fullName: fullName || rawMssv,
        gender,
        major,
        className,
        studentClass: className,
        email,
        phone,
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

  const elCount = (state.roundModalEligibleStudents || []).length;
  const supCount = (state.roundModalSupervisors ? state.roundModalSupervisors.size : 0);
  const configStatus = (elCount > 0 && supCount > 0) ? 'ready' : 'incomplete';

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
    configStatus,
    eligibleCount: elCount,
    supervisorCount: supCount,
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

    // 1. Persist Eligible Students subcollection (strictly guarded against undefined)
    if (state.roundModalEligibleStudents && state.roundModalEligibleStudents.length > 0) {
      for (let offset = 0; offset < state.roundModalEligibleStudents.length; offset += 450) {
        const batch = writeBatch(db);
        const chunk = state.roundModalEligibleStudents.slice(offset, offset + 450);
        let validBatchCount = 0;
        chunk.forEach(s => {
          const mssv = String(s.studentId || s.mssv || s.id || '').trim();
          if (!mssv || mssv === 'undefined') return;
          const ref = doc(db, 'graduationRounds', savedId, 'eligibleStudents', mssv);
          batch.set(ref, {
            studentId: mssv,
            name: s.name || s.fullName || '',
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
    renderAdminRegistrationsTable(list);
  } catch (e) {
    console.error('Error loading registrations:', e);
  }
};

function renderAdminRegistrationsTable(list) {
  const tbody = document.getElementById('admin-registrations-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400">Chưa có sinh viên nào đăng ký trong đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const getSupName = rank => (r.preferences || []).find(p => p.rank === rank)?.supervisorName || '--';
    const subDate = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)) : null;

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-mono font-bold text-slate-900">${r.studentId}</td>
        <td class="p-3.5 font-semibold text-slate-800">${r.studentName || '--'}</td>
        <td class="p-3.5 max-w-[200px] truncate font-bold text-blue-900" title="${r.topicTitle}">${r.topicTitle || '--'}</td>
        <td class="p-3.5 text-slate-600">${r.projectType || '--'}</td>
        <td class="p-3.5 font-bold text-slate-700">${getSupName(1)}</td>
        <td class="p-3.5 text-slate-600">${getSupName(2)}</td>
        <td class="p-3.5 text-slate-600">${getSupName(3)}</td>
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

    const headers = ['MSSV', 'Họ và tên', 'Email', 'Tên đề tài', 'Loại hình đồ án', 'Nguyện vọng 1', 'Nguyện vọng 2', 'Nguyện vọng 3', 'Thời gian nộp'];
    const rows = list.map(r => {
      const getSup = rank => (r.preferences || []).find(p => p.rank === rank)?.supervisorName || '';
      const dt = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)).toLocaleString('vi-VN') : '';
      return [
        r.studentId || '',
        r.studentName || '',
        r.email || '',
        `"${(r.topicTitle || '').replace(/"/g, '""')}"`,
        `"${(r.projectType || '').replace(/"/g, '""')}"`,
        `"${getSup(1)}"`,
        `"${getSup(2)}"`,
        `"${getSup(3)}"`,
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

async function gzipData(text) {
  if (!('CompressionStream' in window)) return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function gunzipData(bytes) {
  if (!('DecompressionStream' in window)) return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  } catch {
    return null;
  }
}

// Module State
state.facultyDatasetMeta = null;
state.facultyStudentsLoaded = false;
state.facultyFilteredStudents = [];
state.facultyCurrentPage = 1;
state.facultyPageSize = 15;

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

// Tab Entry: zero documents rendered by default, loads metadata only
window.openFacultyStudentsTab = async function() {
  const totalCountEl = document.getElementById('faculty-students-total-count');
  const filteredCountEl = document.getElementById('faculty-students-filtered-count');
  const metaInfoEl = document.getElementById('faculty-dataset-meta-info');

  // If already loaded in memory, just update metadata counts
  if (state.facultyStudentsLoaded && state.facultyStudents && state.facultyStudents.length > 0) {
    if (totalCountEl) totalCountEl.textContent = state.facultyStudents.length.toLocaleString('vi-VN');
    updateFacultyStatusUI(`Dữ liệu nền: ${state.facultyStudents.length} SV (đã trong bộ nhớ)`, 'success');
    return;
  }

  updateFacultyStatusUI('Đang kiểm tra dữ liệu nền...', 'info');

  try {
    // 1. Check local IndexedDB cache first
    const cached = await getFacultyCache();
    if (cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
      const count = cached.rows.length;
      if (totalCountEl) totalCountEl.textContent = count.toLocaleString('vi-VN');
      if (filteredCountEl) filteredCountEl.textContent = '0';
      if (metaInfoEl) metaInfoEl.textContent = `· Cache: ${count} SV · Cập nhật: ${new Date(cached.cachedAt || Date.now()).toLocaleDateString('vi-VN')}`;
      updateFacultyStatusUI(`Dữ liệu nền: ${count} SV (sẵn sàng tải)`, 'success');
      populateFacultyClassFilter(cached.rows);
      return;
    }

    // 2. Read single metadata document from Firestore (only 1 read)
    let meta = null;
    try {
      const metaSnap = await getDoc(doc(db, 'facultyStudentMeta', 'current'));
      if (metaSnap.exists()) {
        meta = metaSnap.data();
        state.facultyDatasetMeta = meta;
      }
    } catch (err) {
      console.warn('Could not read facultyStudentMeta document:', err);
    }

    if (meta && meta.count) {
      const count = Number(meta.count);
      if (totalCountEl) totalCountEl.textContent = count.toLocaleString('vi-VN');
      if (filteredCountEl) filteredCountEl.textContent = '0';
      if (metaInfoEl) metaInfoEl.textContent = `· v${meta.datasetVersion || 1} · ${meta.datasetBytes ? (meta.datasetBytes/1024).toFixed(1) + ' KB' : ''}`;
      updateFacultyStatusUI(`Dữ liệu nền: ${count.toLocaleString('vi-VN')} SV (sẵn sàng tải)`, 'success');
    } else {
      if (totalCountEl) totalCountEl.textContent = '0';
      updateFacultyStatusUI('Chưa có dữ liệu nền (vui lòng upload Excel)', 'warning');
    }
  } catch (err) {
    console.error('Lỗi kiểm tra metadata SV khoa:', err);
    updateFacultyStatusUI('Dữ liệu nền sẵn sàng', 'info');
  }
};

// Helper: load raw dataset into client memory
async function ensureFacultyDatasetLoaded(force = false) {
  if (!force && state.facultyStudentsLoaded && state.facultyStudents && state.facultyStudents.length > 0) {
    return state.facultyStudents;
  }

  updateFacultyStatusUI('Đang nạp dữ liệu nền vào bộ nhớ...', 'info');

  // Check cache
  if (!force) {
    const cached = await getFacultyCache();
    if (cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
      state.facultyStudents = cached.rows;
      state.facultyStudentsLoaded = true;
      populateFacultyClassFilter(state.facultyStudents);
      updateFacultyStatusUI(`Đã tải: ${state.facultyStudents.length} SV (từ Cache)`, 'success');
      return state.facultyStudents;
    }
  }

  // Load from Firestore collection
  try {
    const snap = await getDocs(collection(db, 'facultyStudents'));
    const rows = snap.docs.map(d => {
      const data = d.data();
      return {
        mssv: d.id,
        fullName: data.fullName || data.name || '',
        name: data.fullName || data.name || '',
        gender: data.gender || '',
        major: data.major || '',
        className: data.className || data.studentClass || '',
        studentClass: data.className || data.studentClass || '',
        email: data.email || `${d.id.toLowerCase()}@student.tdtu.edu.vn`,
        phone: data.phone || ''
      };
    });

    // Sort by MSSV
    rows.sort((a, b) => String(a.mssv).localeCompare(String(b.mssv)));

    state.facultyStudents = rows;
    state.facultyStudentsLoaded = true;

    // Cache locally
    await setFacultyCache({
      version: Date.now(),
      rows: rows,
      cachedAt: Date.now()
    });

    populateFacultyClassFilter(rows);
    updateFacultyStatusUI(`Đã tải: ${rows.length} SV vào bộ nhớ`, 'success');
    return rows;
  } catch (err) {
    console.error('Lỗi tải dataset SV khoa:', err);
    updateFacultyStatusUI('Lỗi tải dữ liệu: ' + err.message, 'error');
    throw err;
  }
}

function populateFacultyClassFilter(rows) {
  const classSelect = document.getElementById('faculty-class-filter');
  if (!classSelect || !Array.isArray(rows)) return;
  const curVal = classSelect.value;
  const classes = [...new Set(rows.map(s => s.className || s.studentClass).filter(Boolean))].sort();
  classSelect.innerHTML = '<option value="">-- Tất cả lớp --</option>' +
    classes.map(c => `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`).join('');
}

// Client-side Search & Filter
window.searchFacultyStudents = async function() {
  await loadAndRenderFacultyStudents();
};

window.loadAndRenderFacultyStudents = async function() {
  const tbody = document.getElementById('faculty-students-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500">⏳ Đang tải và lọc danh sách sinh viên...</td></tr>';
  }

  try {
    const dataset = await ensureFacultyDatasetLoaded();
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
      <td class="p-3 text-slate-500 font-mono text-[11px]">${s.phone || '--'}</td>
      <td class="p-3 text-right">
        <button onclick="editFacultyStudentInline('${s.mssv}')" class="text-blue-600 hover:text-blue-800 hover:underline font-bold text-xs mr-2">Sửa</button>
        <button onclick="deleteFacultyStudent('${s.mssv}')" class="text-rose-600 hover:text-rose-800 hover:underline font-bold text-xs">Xóa</button>
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
// EXCEL IMPORTER: FORMAT A & FORMAT B WITH UNIFIED SCHEMA & DEDUPLICATION
// ============================================================================
window.handleFacultyStudentsUpload = async function(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      showToast('File Excel rỗng hoặc không có dữ liệu.', 'error');
      return;
    }

    // Flexible Header Matcher supporting Format A & Format B
    const keys = Object.keys(rawRows[0]);
    const cleanHeader = s => String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    const findKey = (...aliases) => keys.find(k => aliases.includes(cleanHeader(k)));

    // Recognized Aliases for Format A & Format B
    const mssvKey = findKey('masv', 'maso', 'mssv', 'masinhvien', 'studentid');
    const fullNameKey = findKey('hoten', 'hovaten', 'fullname', 'name');
    const familyKey = findKey('holot', 'hodem', 'ho', 'familyname');
    const givenKey = findKey('ten', 'firstname');
    const genderKey = findKey('gioitinh', 'phai', 'gender', 'sex');
    const majorKey = findKey('nganh', 'nganhhoc', 'chuyennganh', 'major');
    const classKey = findKey('lop', 'lophoc', 'lopquanly', 'class', 'classname');
    const emailKey = findKey('email', 'thudientu', 'mail');
    const phoneKey = findKey('sodienthoai', 'dienthoai', 'sdt', 'phone', 'telephone', 'mobile');

    if (!mssvKey || (!fullNameKey && !(familyKey && givenKey))) {
      showToast('File cần có cột MSSV (Mã SV / Mã số) và Họ tên (hoặc Họ lót + Tên).', 'error');
      return;
    }

    // Normalization & Deduplication by MSSV
    const uniqueMap = new Map();

    rawRows.forEach(row => {
      const rawMssv = String(row[mssvKey] || '').trim().toUpperCase();
      if (!rawMssv || rawMssv.length < 5) return;

      // Full Name resolution
      let fullName = '';
      if (fullNameKey && String(row[fullNameKey] || '').trim()) {
        fullName = String(row[fullNameKey]).trim();
      } else {
        const fam = familyKey ? String(row[familyKey] || '').trim() : '';
        const giv = givenKey ? String(row[givenKey] || '').trim() : '';
        fullName = [fam, giv].filter(Boolean).join(' ');
      }
      fullName = fullName.replace(/\s+/g, ' ');
      if (!fullName) return;

      const gender = genderKey ? String(row[genderKey] || '').trim() : '';
      const major = majorKey ? String(row[majorKey] || '').trim() : '';
      const className = classKey ? String(row[classKey] || '').trim() : '';
      let email = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : '';
      if (!email) {
        email = `${rawMssv.toLowerCase()}@student.tdtu.edu.vn`;
      }
      const phone = phoneKey ? String(row[phoneKey] || '').trim() : '';

      // Standard Schema
      const studentObj = {
        mssv: rawMssv,
        fullName: fullName,
        name: fullName,
        gender: gender,
        major: major,
        className: className,
        studentClass: className,
        email: email,
        phone: phone
      };

      // Deduplicate by MSSV: keep first or update missing
      if (!uniqueMap.has(rawMssv)) {
        uniqueMap.set(rawMssv, studentObj);
      } else {
        const existing = uniqueMap.get(rawMssv);
        uniqueMap.set(rawMssv, {
          ...existing,
          gender: existing.gender || gender,
          major: existing.major || major,
          className: existing.className || className,
          phone: existing.phone || phone
        });
      }
    });

    const records = Array.from(uniqueMap.values());
    if (records.length === 0) {
      showToast('Không tìm thấy dòng sinh viên hợp lệ trong file.', 'warning');
      return;
    }

    showToast(`Đang xử lý và lưu ${records.length} sinh viên...`, 'info');

    // Batch write to Firestore
    for (let offset = 0; offset < records.length; offset += 450) {
      const batch = writeBatch(db);
      const chunk = records.slice(offset, offset + 450);
      chunk.forEach(item => {
        const ref = doc(db, 'facultyStudents', item.mssv);
        batch.set(ref, {
          ...item,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();
    }

    // Update metadata document
    const metaPayload = {
      count: records.length,
      datasetVersion: Date.now(),
      datasetEncoding: 'gzip',
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'facultyStudentMeta', 'current'), metaPayload, { merge: true }).catch(console.warn);

    // Save in local state & IndexedDB cache
    state.facultyStudents = records;
    state.facultyStudentsLoaded = true;
    await setFacultyCache({
      version: metaPayload.datasetVersion,
      rows: records,
      cachedAt: Date.now()
    });

    populateFacultyClassFilter(records);
    applyFacultyFiltersAndRender(1);

    // Try gzip compression (IFAA mechanism)
    try {
      const payloadStr = JSON.stringify({ schemaVersion: 1, students: records });
      const compressed = await gzipData(payloadStr);
      if (compressed) {
        console.log(`[IFAA Dataset] Nén thành công: ${records.length} SV · ${(compressed.byteLength / 1024).toFixed(1)} KB`);
      }
    } catch (e) {
      console.warn('Lỗi nén dataset:', e);
    }

    showToast(`✓ Đã nhập thành công ${records.length} sinh viên khoa!`, 'success');
  } catch (err) {
    console.error('Lỗi nhập file SV khoa:', err);
    showToast('Lỗi đọc file: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
};

// Form Single Student Create / Update
window.saveSingleFacultyStudent = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const mssvInput = document.getElementById('faculty-form-mssv');
  const nameInput = document.getElementById('faculty-form-name');
  const genderInput = document.getElementById('faculty-form-gender');
  const majorInput = document.getElementById('faculty-form-major');
  const classInput = document.getElementById('faculty-form-class');
  const emailInput = document.getElementById('faculty-form-email');
  const phoneInput = document.getElementById('faculty-form-phone');

  const mssv = (mssvInput?.value || '').trim().toUpperCase();
  const fullName = (nameInput?.value || '').trim().replace(/\s+/g, ' ');
  const gender = genderInput?.value || '';
  const major = majorInput?.value || '';
  const className = (classInput?.value || '').trim();
  let email = (emailInput?.value || '').trim().toLowerCase();
  if (!email && mssv) {
    email = `${mssv.toLowerCase()}@student.tdtu.edu.vn`;
  }
  const phone = (phoneInput?.value || '').trim();

  if (!mssv || !fullName) {
    showToast('Vui lòng nhập MSSV và Họ tên sinh viên!', 'warning');
    return;
  }

  const studentObj = {
    mssv,
    fullName,
    name: fullName,
    gender,
    major,
    className,
    studentClass: className,
    email,
    phone,
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'facultyStudents', mssv), studentObj, { merge: true });

    // Update in-memory
    if (state.facultyStudentsLoaded && Array.isArray(state.facultyStudents)) {
      const idx = state.facultyStudents.findIndex(s => s.mssv === mssv);
      if (idx >= 0) {
        state.facultyStudents[idx] = { ...state.facultyStudents[idx], ...studentObj };
      } else {
        state.facultyStudents.unshift(studentObj);
      }
      await setFacultyCache({
        version: Date.now(),
        rows: state.facultyStudents,
        cachedAt: Date.now()
      });
      applyFacultyFiltersAndRender(state.facultyCurrentPage || 1);
    }

    // Reset form
    if (mssvInput) mssvInput.value = '';
    if (nameInput) nameInput.value = '';
    if (genderInput) genderInput.value = '';
    if (classInput) classInput.value = '';
    if (emailInput) emailInput.value = '';
    if (phoneInput) phoneInput.value = '';

    showToast(`✓ Đã lưu sinh viên ${mssv}!`, 'success');
  } catch (err) {
    showToast('Lỗi lưu sinh viên: ' + err.message, 'error');
  }
};

window.editFacultyStudentInline = function(mssv) {
  const s = (state.facultyStudents || []).find(x => x.mssv === mssv);
  if (!s) return;

  const mssvInput = document.getElementById('faculty-form-mssv');
  const nameInput = document.getElementById('faculty-form-name');
  const genderInput = document.getElementById('faculty-form-gender');
  const majorInput = document.getElementById('faculty-form-major');
  const classInput = document.getElementById('faculty-form-class');
  const emailInput = document.getElementById('faculty-form-email');
  const phoneInput = document.getElementById('faculty-form-phone');

  if (mssvInput) mssvInput.value = s.mssv;
  if (nameInput) nameInput.value = s.fullName || s.name || '';
  if (genderInput) genderInput.value = s.gender || '';
  if (majorInput) majorInput.value = s.major || 'Thiết kế nội thất';
  if (classInput) classInput.value = s.className || s.studentClass || '';
  if (emailInput) emailInput.value = s.email || '';
  if (phoneInput) phoneInput.value = s.phone || '';

  showToast(`Đã đưa sinh viên ${s.mssv} vào form để chỉnh sửa.`, 'info');
  mssvInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.deleteFacultyStudent = async function(mssv) {
  const confirmed = await showConfirm(
    'Xóa sinh viên khỏi Khoa',
    `Bạn có chắc chắn muốn xóa sinh viên MSSV ${mssv} khỏi danh sách sinh viên toàn khoa?`,
    { confirmText: 'Xóa sinh viên', danger: true }
  );
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'facultyStudents', mssv));
    if (state.facultyStudents) {
      state.facultyStudents = state.facultyStudents.filter(s => s.mssv !== mssv);
      await setFacultyCache({
        version: Date.now(),
        rows: state.facultyStudents,
        cachedAt: Date.now()
      });
      applyFacultyFiltersAndRender(state.facultyCurrentPage || 1);
    }
    showToast(`Đã xóa sinh viên ${mssv}.`, 'success');
  } catch (err) {
    showToast('Lỗi xóa sinh viên: ' + err.message, 'error');
  }
};

window.clearAllFacultyStudents = async function() {
  const count = (state.facultyStudents || []).length;
  if (count === 0) {
    showToast('Danh sách sinh viên khoa hiện đang trống hoặc chưa được tải.', 'info');
    return;
  }

  const confirmed = await showConfirm(
    'Xóa toàn bộ Danh sách SV Khoa?',
    `⚠️ CẢNH BÁO NGUY HIỂM:\n\nBạn sắp xóa toàn bộ ${count} sinh viên khỏi cơ sở dữ liệu sinh viên khoa! Hành động này không thể hoàn tác.`,
    { confirmText: 'Xóa toàn bộ', danger: true }
  );
  if (!confirmed) return;

  try {
    showToast('Đang xóa toàn bộ dữ liệu...', 'info');
    const toDelete = [...state.facultyStudents];
    for (let offset = 0; offset < toDelete.length; offset += 450) {
      const batch = writeBatch(db);
      toDelete.slice(offset, offset + 450).forEach(s => {
        batch.delete(doc(db, 'facultyStudents', s.mssv));
      });
      await batch.commit();
    }

    state.facultyStudents = [];
    state.facultyFilteredStudents = [];
    await setFacultyCache({ version: 0, rows: [], cachedAt: Date.now() });
    await setDoc(doc(db, 'facultyStudentMeta', 'current'), { count: 0, datasetVersion: 0, updatedAt: serverTimestamp() }, { merge: true }).catch(console.warn);

    applyFacultyFiltersAndRender(1);
    updateFacultyStatusUI('Dữ liệu nền trống (0 SV)', 'warning');
    showToast('Đã xóa toàn bộ sinh viên khoa.', 'success');
  } catch (err) {
    showToast('Lỗi xóa dữ liệu: ' + err.message, 'error');
  }
};

// Rebuild Compressed Dataset (IFAA Standard)
window.rebuildFacultyDataset = async function() {
  showToast('Đang tải danh sách để tạo lại dữ liệu nền...', 'info');
  updateFacultyStatusUI('Đang tạo lại dữ liệu nền...', 'info');

  try {
    const snap = await getDocs(collection(db, 'facultyStudents'));
    const rows = snap.docs.map(d => {
      const data = d.data();
      return {
        mssv: d.id,
        fullName: data.fullName || data.name || '',
        name: data.fullName || data.name || '',
        gender: data.gender || '',
        major: data.major || '',
        className: data.className || data.studentClass || '',
        studentClass: data.className || data.studentClass || '',
        email: data.email || `${d.id.toLowerCase()}@student.tdtu.edu.vn`,
        phone: data.phone || ''
      };
    });

    rows.sort((a, b) => String(a.mssv).localeCompare(String(b.mssv)));
    state.facultyStudents = rows;
    state.facultyStudentsLoaded = true;

    // Compress with Gzip
    const payloadStr = JSON.stringify({ schemaVersion: 1, version: Date.now(), students: rows });
    const compressed = await gzipData(payloadStr);

    // Save to Cache
    await setFacultyCache({
      version: Date.now(),
      rows: rows,
      cachedAt: Date.now()
    });

    // Update metadata document
    const metaPayload = {
      count: rows.length,
      datasetVersion: Date.now(),
      datasetEncoding: 'gzip',
      datasetBytes: compressed ? compressed.byteLength : 0,
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'facultyStudentMeta', 'current'), metaPayload, { merge: true }).catch(console.warn);

    populateFacultyClassFilter(rows);
    applyFacultyFiltersAndRender(1);

    const sizeStr = compressed ? ` · ${(compressed.byteLength / 1024).toFixed(1)} KB` : '';
    updateFacultyStatusUI(`Dữ liệu nền: ${rows.length} SV${sizeStr}`, 'success');
    showToast(`✓ Đã tạo lại dữ liệu nền (${rows.length} SV${sizeStr})!`, 'success');
  } catch (err) {
    console.error('Lỗi tạo lại dữ liệu nền:', err);
    showToast('Lỗi tạo lại dữ liệu nền: ' + err.message, 'error');
  }
};

// Export to Excel
window.exportFacultyStudentsExcel = async function() {
  try {
    let rows = state.facultyStudents;
    if (!state.facultyStudentsLoaded || !rows || rows.length === 0) {
      showToast('Đang tải dữ liệu để xuất Excel...', 'info');
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
      'Số điện thoại': s.phone || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachSVKhoa');
    XLSX.writeFile(wb, `DANH_SACH_SINH_VIEN_KHOA_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`✓ Đã xuất Excel ${exportRows.length} sinh viên khoa!`, 'success');
  } catch (err) {
    showToast('Lỗi xuất Excel: ' + err.message, 'error');
  }
};

window.downloadFacultyStudentsTemplate = function() {
  const sampleData = [
    { 'Mã SV': '52000888', 'Họ lót': 'Nguyễn Văn', 'Tên': 'An', 'Giới tính': 'Nam', 'Ngành': 'Thiết kế nội thất', 'Lớp': '20050201', 'Email': '52000888@student.tdtu.edu.vn', 'Số điện thoại': '0901234567' },
    { 'Mã số': '52000889', 'Họ Lót': 'Trần Thị', 'Tên': 'Bình', 'Lớp': '20050301', 'Giới tính': 'Nữ', 'Ngành': 'Thiết kế đồ họa', 'ĐTB Học Kỳ 1': '7.5', 'ĐRL HK1': '85', 'Xét điều kiện': 'Đạt' },
    { 'MSSV': '52000890', 'Họ và tên': 'Lê Hoàng Cường', 'Giới tính': 'Nam', 'Ngành': 'Thiết kế thời trang', 'Lớp': '20050401', 'Email': '52000890@student.tdtu.edu.vn', 'Số điện thoại': '0912345678' }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MauFormatAvsB');
  XLSX.writeFile(wb, 'MAU_DANH_SACH_SV_KHOA_2_FORMAT.xlsx');
  showToast('Đã tải xuống file mẫu (hỗ trợ cả Format A & B)!', 'success');
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

  tbody.innerHTML = normalized.map((act, idx) => {
    const typeMeta = ACTIVITY_TYPES[act.activityType] || ACTIVITY_TYPES.other;
    const status = getActivityStatus(act);
    const timeStr = fmtActivityTime(act.startAt, act.endAt);

    let statusBadge = '';
    if (status === 'ongoing') {
      statusBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">● Đang diễn ra</span>';
    } else if (status === 'upcoming') {
      statusBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">○ Sắp tới</span>';
    } else if (status === 'past') {
      statusBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">✓ Đã kết thúc</span>';
    } else {
      statusBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Kế hoạch</span>';
    }

    const visBadge = act.visibility !== false
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">👁️ Hiện</span>'
      : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">🔒 Ẩn</span>';

    const subBadge = act.submissionEnabled
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="Chức năng nộp bài (Beta)">📥 Có</span>'
      : '<span class="text-slate-300 font-bold">--</span>';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1">
            <span class="font-mono font-bold text-slate-400 text-xs w-5">#${idx + 1}</span>
            <div class="flex flex-col">
              <button type="button" onclick="moveActivity('${act.id}', 'up')" ${idx === 0 ? 'disabled' : ''} class="text-[10px] text-slate-400 hover:text-slate-800 disabled:opacity-20 leading-none">▲</button>
              <button type="button" onclick="moveActivity('${act.id}', 'down')" ${idx === normalized.length - 1 ? 'disabled' : ''} class="text-[10px] text-slate-400 hover:text-slate-800 disabled:opacity-20 leading-none">▼</button>
            </div>
          </div>
        </td>
        <td class="p-3">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeMeta.color}">
              <span>${typeMeta.icon}</span> ${typeMeta.label}
            </span>
          </div>
          <span class="font-bold text-slate-900 text-xs block">${act.title}</span>
          ${act.description ? `<p class="text-[11px] text-slate-500 mt-0.5 line-clamp-1 truncate max-w-xs" title="${escapeHtml(act.description)}">${escapeHtml(act.description)}</p>` : ''}
        </td>
        <td class="p-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
          ${timeStr}
        </td>
        <td class="p-3 text-slate-600 text-[11px] max-w-[140px] truncate" title="${act.location || ''}">
          ${act.location || '<span class="text-slate-300">--</span>'}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${statusBadge}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${visBadge}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${subBadge}
        </td>
        <td class="p-3 text-right whitespace-nowrap space-x-1">
          <button type="button" onclick="copyActivityLink('${targetRound.id}', '${act.slug}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors" title="Sao chép link mốc ?x=...&a=...">🔗 Link</button>
          <button type="button" onclick="copyActivityModal('${act.id}')" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition-colors" title="Sao chép tạo bản ghi mới">📋 Sao chép</button>
          <button type="button" onclick="toggleActivityVisibility('${act.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors" title="Ẩn/Hiện đối với sinh viên">${act.visibility !== false ? 'Ẩn' : 'Hiện'}</button>
          <button type="button" onclick="editActivityModal('${act.id}')" class="px-2 py-1 text-blue-600 hover:underline font-bold text-xs">Sửa</button>
          <button type="button" onclick="deleteActivity('${act.id}')" class="px-2 py-1 text-rose-600 hover:underline font-bold text-xs">Xóa</button>
        </td>
      </tr>
    `;
  }).join('');
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
  document.getElementById('activity-form-type').value = 'review';

  // Clear date/time
  clearActivityDateTime('start');
  clearActivityDateTime('end');

  // Clear rich editor
  const editor = document.getElementById('activity-editor');
  if (editor) editor.innerHTML = '';

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
  document.getElementById('activity-form-submission').checked = Boolean(act.submissionEnabled);

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

    for (const cb of checkedBoxes) {
      const actId = cb.value;
      const src = sourceActs.find(a => a.id === actId);
      if (!src) continue;

      // Unique new ID and Slug
      const newSlug = generateUniqueSlug(src.title, targetActs);
      const newId = 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const newAct = {
        id: newId,
        roundId: targetRoundId,
        title: src.title || '',
        activityType: src.activityType || 'other',
        location: src.location || '',
        startAt: src.startAt || '',
        endAt: src.endAt || '',
        description: src.description || '',
        descriptionHtml: src.descriptionHtml || src.description || '',
        visibility: src.visibility !== false,
        showAfterExpired: src.showAfterExpired !== false,
        submissionEnabled: Boolean(src.submissionEnabled),
        slug: newSlug,
        order: targetActs.length + 1,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      targetActs.push(newAct);
      copyCount++;
    }

    // Save to Firestore
    const roundRef = doc(db, 'graduationRounds', targetRoundId);
    await updateDoc(roundRef, {
      activities: targetActs,
      updatedAt: serverTimestamp()
    });

    targetRound.activities = targetActs;
    state.roundActivities = targetActs;

    closeCopyFromRoundModal();
    loadAdminRoundActivities(targetRoundId);
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

    // Best-effort sync to subcollection
    try {
      const actRef = doc(db, 'graduationRounds', roundId, 'activities', actId);
      await setDoc(actRef, activityData, { merge: true }).catch(() => {});
    } catch (subErr) {}

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

    try {
      await deleteDoc(doc(db, 'graduationRounds', roundId, 'activities', actId)).catch(() => {});
    } catch (e) {}

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

          ${act.submissionEnabled ? `
            <div class="mt-2.5 flex items-center gap-2 p-2.5 bg-emerald-50/80 border border-emerald-200 text-emerald-900 rounded-xl text-xs">
              <span class="text-base">📥</span>
              <div class="flex-1">
                <span class="font-bold block">Nộp bài — Chưa mở ở phiên bản Beta này</span>
                <span class="text-[11px] text-emerald-700 block">Chức năng nộp bài trực tuyến sẽ được mở trong các phiên bản cập nhật tiếp theo.</span>
              </div>
            </div>
          ` : ''}
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
