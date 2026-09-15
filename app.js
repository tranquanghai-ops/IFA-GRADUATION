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
  let config = {
    apiKey: "AIzaSyA7HDp4XThUSN2XO3m0GoBGnYf-nFjvM_M",
    authDomain: "tknt-tdtu.firebaseapp.com",
    projectId: "tknt-tdtu",
    storageBucket: "tknt-tdtu.firebasestorage.app",
    messagingSenderId: "52631763904"
  };
  try {
    const res = await fetch('/__/firebase/init.json');
    if (res.ok) config = await res.json();
  } catch (e) {
    console.warn('[IFA-Graduation] Fallback firebase config used.');
  }
  app = getApps().length > 0 ? getApp() : initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}



// --- AUTH & ROLES ---
export async function setupAuthListener() {
  showLoading('Đang khởi tạo IFA+ Graduation...');

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

  // 3. SUPERVISOR Check
  let isSupervisor = false;

  // Chỉ truy vấn Firestore nếu chưa xác định được là Owner hoặc Student
  if (!isAdmin && !isStudent) {
    try {
      await Promise.race([
        Promise.all([
          getDoc(doc(db, 'admins', email)).then(d => { if (d.exists()) isAdmin = true; }).catch(() => {}),
          getDocs(query(collection(db, 'supervisorMaster'), where('email', '==', email), where('active', '==', true)))
            .then(snap => { if (!snap.empty) isSupervisor = true; }).catch(() => {})
        ]),
        new Promise(r => setTimeout(r, 2000))
      ]);
    } catch (e) {
      console.warn('[IFA-Graduation] Admins/Supervisor lookup timeout notice:', e);
    }
  } else if (isAdmin) {
    // Nếu là Admin, kiểm tra ngầm supervisor mà không chặn
    getDocs(query(collection(db, 'supervisorMaster'), where('email', '==', email), where('active', '==', true)))
      .then(snap => {
        if (!snap.empty) {
          state.isSupervisor = true;
          updateAuthUI();
        }
      }).catch(() => {});
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
  } else if (targetView === 'student' && state.selectedRoundId) {
    checkStudentEligibilityAndRegistration(state.selectedRoundId);
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

    // Pick active round
    const urlParams = new URLSearchParams(window.location.search);
    const roundQuery = urlParams.get('e') || urlParams.get('round');
    
    if (roundQuery && state.rounds.some(r => r.id === roundQuery)) {
      state.selectedRoundId = roundQuery;
    } else {
      const openRound = state.rounds.find(r => r.status === 'open' || r.status === 'reviewing') || state.rounds[0];
      state.selectedRoundId = openRound ? openRound.id : null;
    }

    if (state.selectedRoundId) {
      await selectRound(state.selectedRoundId);
    }
  } catch (e) {
    console.error('Error loading rounds:', e);
  }
}

function renderRoundsDropdowns() {
  const selectActive = document.getElementById('select-active-round');
  const selectAdminSup = document.getElementById('admin-round-sup-select');
  const selectAdminStudent = document.getElementById('admin-round-student-select');
  const selectAdminReg = document.getElementById('admin-round-reg-select');
  const selectAdminReview = document.getElementById('admin-review-round-select');

  const optionsHtml = state.rounds.map(r => `<option value="${r.id}">${r.title} (${r.academicYear})</option>`).join('');

  if (selectActive) {
    selectActive.innerHTML = optionsHtml;
    if (state.rounds.length > 1) {
      document.getElementById('multi-round-selector-wrap')?.classList.remove('hidden');
    }
  }
  if (selectAdminSup) selectAdminSup.innerHTML = optionsHtml;
  if (selectAdminStudent) selectAdminStudent.innerHTML = optionsHtml;
  if (selectAdminReg) selectAdminReg.innerHTML = optionsHtml;
  if (selectAdminReview) selectAdminReview.innerHTML = optionsHtml;
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

  if (reg.reviewStatus === 'accepted' || reg.reviewStatus === 'manually_assigned' || reg.acceptedSupervisorId) {
    const sup = state.roundSupervisors.find(s => s.id === reg.acceptedSupervisorId || s.supervisorId === reg.acceptedSupervisorId)
      || state.supervisorsMaster.find(s => s.id === reg.acceptedSupervisorId);

    const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23cbd5e1"/><path fill="%23cbd5e1" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';

    container.innerHTML = `
      <div class="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 flex flex-col sm:flex-row items-center gap-5">
        <img src="${sup?.photoUrl || defaultAvatar}" class="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400 shadow-md">
        <div class="text-center sm:text-left flex-1">
          <span class="badge bg-emerald-500 text-white font-extrabold text-[11px] mb-1">
            ${reg.acceptedRank === 'manual' ? 'Phân công theo quyết định Khoa' : 'Trúng tuyển Nguyện vọng ' + (reg.acceptedRank || 1)}
          </span>
          <h3 class="text-xl font-black text-white mt-1">${reg.acceptedSupervisorName || sup?.name || 'Giảng viên Hướng dẫn'}</h3>
          <p class="text-xs text-blue-200 mt-0.5">${sup?.department || 'Khoa Mỹ thuật Công nghiệp'}</p>
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs">
            ${sup?.email ? '<span class="bg-white/10 px-2.5 py-1 rounded-lg">✉️ ' + sup.email + '</span>' : ''}
            ${sup?.phone ? '<span class="bg-white/10 px-2.5 py-1 rounded-lg">📞 ' + sup.phone + '</span>' : ''}
          </div>
        </div>
      </div>

      <div class="bg-black/30 p-4 rounded-xl border border-white/10 text-xs space-y-1">
        <span class="text-blue-300 font-bold block uppercase">Đề tài Đồ án Tốt nghiệp chính thức:</span>
        <p class="text-white font-bold text-sm leading-relaxed">${reg.topicTitle}</p>
        <p class="text-blue-200 text-[11px] mt-1">Loại hình: ${reg.projectType}</p>
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
    alert(`Bạn chỉ được chọn tối đa ${maxPref} nguyện vọng.`);
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
  const topic = (document.getElementById('input-topic-title')?.value || '').trim();
  const projectType = document.getElementById('select-project-type')?.value || '';

  if (!topic) {
    alert('Vui lòng nhập tên đề tài dự kiến.');
    document.getElementById('input-topic-title')?.focus();
    return;
  }
  if (!projectType) {
    alert('Vui lòng chọn loại hình đồ án.');
    document.getElementById('select-project-type')?.focus();
    return;
  }

  goToStep(2);
};

window.validateAndGoToStep3 = function() {
  const maxPref = state.activeRound?.preferenceCount || 3;
  if (state.selectedPreferences.length < maxPref) {
    alert(`Vui lòng chọn đủ ${maxPref} nguyện vọng trước khi tiếp tục.`);
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
    alert('Không xác định được phiên làm việc hoặc MSSV.');
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
    
    alert('🎉 ĐĂNG KÝ NGUYỆN VỌNG THÀNH CÔNG!');
    await checkStudentEligibilityAndRegistration(roundId);
  } catch (err) {
    console.error('Lỗi khi nộp đăng ký:', err);
    alert('Lỗi đăng ký: ' + err.message);
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
      alert(`Thầy/Cô đã đạt giới hạn chỉ tiêu (${totalCap} SV). Vui lòng bỏ chọn sinh viên khác trước khi chọn thêm.`);
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
    alert('Lỗi lưu quyết định: ' + err.message);
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
    alert(`✓ Thầy/Cô đã hoàn tất lựa chọn Vòng ${currentRound} thành công!`);
    await loadSupervisorReviewData(roundId);
  } catch (err) {
    alert('Lỗi cập nhật trạng thái hoàn thành: ' + err.message);
  }
};

window.reopenSupervisorRound = async function() {
  const roundId = state.selectedRoundId;
  const currentRound = state.activeRound?.currentReviewRound || 1;
  const isLocked = Boolean(state.activeRound?.reviewLocks && state.activeRound?.reviewLocks['round_' + currentRound]);

  if (isLocked) {
    alert('Vòng này đã được Quản trị viên chốt. Không thể mở lại để chỉnh sửa.');
    return;
  }

  const emailLower = (state.user?.email || '').toLowerCase();
  const currentSup = state.roundSupervisors.find(s => (s.email || '').toLowerCase() === emailLower);
  if (!roundId || !currentSup) return;

  if (!confirm(`Mở lại Vòng ${currentRound} để chỉnh sửa danh sách lựa chọn?`)) return;

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
    alert('Lỗi mở lại vòng: ' + err.message);
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
    b.classList.remove('bg-slate-800', 'text-white', 'text-amber-400');
    b.classList.add('text-slate-400');
  });
  const activeBtn = document.getElementById('atab-btn-' + tabKey);
  if (activeBtn) {
    activeBtn.classList.add('bg-slate-800', 'text-white');
    activeBtn.classList.remove('text-slate-400'); if (tabKey === 'review') activeBtn.classList.add('text-amber-400');
  }

  ['overview', 'review', 'rounds', 'supervisors-master', 'round-supervisors', 'eligible-students', 'project-types', 'registrations', 'preview-student'].forEach(t => {
    const p = document.getElementById('atab-panel-' + t);
    if (p) {
      if (t === tabKey) p.classList.remove('hidden');
      else p.classList.add('hidden');
    }
  });

  if (tabKey === 'overview') loadAdminStats();
  else if (tabKey === 'review') { if (state.selectedRoundId) loadAdminReviewData(state.selectedRoundId); }
  else if (tabKey === 'rounds') renderAdminRoundsTable();
  else if (tabKey === 'supervisors-master') loadAdminSupervisorsMaster();
  else if (tabKey === 'round-supervisors' && state.selectedRoundId) loadAdminRoundSupervisors(state.selectedRoundId);
  else if (tabKey === 'eligible-students' && state.selectedRoundId) loadAdminEligibleStudents(state.selectedRoundId);
  else if (tabKey === 'registrations' && state.selectedRoundId) loadAdminRegistrations(state.selectedRoundId);
  else if (tabKey === 'preview-student') preparePreviewStudentDropdown();
};

// --- ADMIN: ROUNDS CRUD ---
function renderAdminRoundsTable() {
  const tbody = document.getElementById('admin-rounds-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.rounds.map(r => {
    const fmt = d => d ? new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-bold text-slate-900">${r.title}</td>
        <td class="p-3.5 text-slate-600">${r.academicYear}</td>
        <td class="p-3.5"><span class="badge badge-${r.status}">${r.status}</span></td>
        <td class="p-3.5 text-[11px] text-slate-500">${fmt(r.openAtDate)} → ${fmt(r.closeAtDate)}</td>
        <td class="p-3.5 font-bold">${r.preferenceCount || 3} NV</td>
        <td class="p-3.5">${r.selectionMode === 'wizard' ? 'Wizard' : 'Cards'}</td>
        <td class="p-3.5 text-right space-x-2">
          <button onclick="editRoundModal('${r.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.openCreateRoundModal = function() {
  document.getElementById('form-round').reset();
  document.getElementById('round-form-id').value = '';
  document.getElementById('modal-round-title').textContent = 'Tạo Đợt Đồ án Tốt nghiệp Mới';
  document.getElementById('modal-round').classList.remove('hidden');
};

window.editRoundModal = function(roundId) {
  const r = state.rounds.find(x => x.id === roundId);
  if (!r) return;

  document.getElementById('round-form-id').value = r.id;
  document.getElementById('round-form-title').value = r.title || '';
  document.getElementById('round-form-year').value = r.academicYear || '';
  document.getElementById('round-form-name').value = r.roundName || '';
  document.getElementById('round-form-status').value = r.status || 'draft';
  document.getElementById('round-form-pref-count').value = r.preferenceCount || '3';
  document.getElementById('round-form-selection-mode').value = r.selectionMode || 'cards';
  document.getElementById('round-form-allow-edit').checked = r.allowStudentEdit !== false;
  document.getElementById('round-form-allow-topic-edit').checked = r.allowTopicEdit !== false;
  document.getElementById('round-form-allow-pref-edit').checked = r.allowPreferenceEdit !== false;

  const toInputDatetime = d => {
    if (!d) return '';
    const date = new Date(d);
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  document.getElementById('round-form-open-at').value = toInputDatetime(r.openAtDate);
  document.getElementById('round-form-close-at').value = toInputDatetime(r.closeAtDate);

  document.getElementById('modal-round-title').textContent = 'Chỉnh sửa Đợt Đồ án Tốt nghiệp';
  document.getElementById('modal-round').classList.remove('hidden');
};

window.closeRoundModal = function() {
  document.getElementById('modal-round').classList.add('hidden');
};

window.saveRound = async function(e) {
  e.preventDefault();
  const id = document.getElementById('round-form-id').value;
  const title = document.getElementById('round-form-title').value.trim();
  const academicYear = document.getElementById('round-form-year').value.trim();
  const roundName = document.getElementById('round-form-name').value.trim();
  const openAtVal = document.getElementById('round-form-open-at').value;
  const closeAtVal = document.getElementById('round-form-close-at').value;
  const preferenceCount = parseInt(document.getElementById('round-form-pref-count').value, 10) || 3;
  const selectionMode = document.getElementById('round-form-selection-mode').value;
  const status = document.getElementById('round-form-status').value;
  const allowStudentEdit = document.getElementById('round-form-allow-edit').checked;
  const allowTopicEdit = document.getElementById('round-form-allow-topic-edit').checked;
  const allowPreferenceEdit = document.getElementById('round-form-allow-pref-edit').checked;

  const payload = {
    title,
    academicYear,
    roundName,
    openAt: new Date(openAtVal),
    closeAt: new Date(closeAtVal),
    preferenceCount,
    selectionMode,
    status,
    allowStudentEdit,
    allowTopicEdit,
    allowPreferenceEdit,
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'graduationRounds', id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      payload.createdBy = state.user?.email || '';
      await setDoc(doc(collection(db, 'graduationRounds')), payload);
    }
    closeRoundModal();
    await loadRounds();
  } catch (err) {
    alert('Lỗi lưu đợt: ' + err.message);
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

  tbody.innerHTML = state.supervisorsMaster.map(s => `
    <tr class="hover:bg-slate-50">
      <td class="p-3.5"><img src="${s.photoUrl || defaultAvatar}" class="w-8 h-8 rounded-full object-cover border"></td>
      <td class="p-3.5 font-bold text-slate-900">${s.name}</td>
      <td class="p-3.5 text-slate-600">${s.email || '--'} ${s.phone ? '• ' + s.phone : ''}</td>
      <td class="p-3.5">${s.department || '--'}</td>
      <td class="p-3.5 max-w-[200px] truncate" title="${s.expertise || ''}">${s.expertise || '--'}</td>
      <td class="p-3.5 text-[11px] text-slate-400">
        ${s.showPhoto !== false ? '📷' : '🚫'} ${s.showEmail !== false ? '✉️' : '🚫'} ${s.showPhone ? '📞' : '🚫'}
      </td>
      <td class="p-3.5">
        <span class="badge ${s.active !== false ? 'badge-open' : 'badge-closed'}">${s.active !== false ? 'Active' : 'Ngừng'}</span>
      </td>
      <td class="p-3.5 text-right space-x-2">
        <button onclick="editSupervisorMasterModal('${s.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
      </td>
    </tr>
  `).join('');
}

window.openCreateSupervisorModal = function() {
  document.getElementById('form-supervisor').reset();
  document.getElementById('sup-form-id').value = '';
  document.getElementById('modal-supervisor-title').textContent = 'Thêm GVHD vào Kho Master';
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
  document.getElementById('sup-form-dept').value = s.department || '';
  document.getElementById('sup-form-expertise').value = s.expertise || '';
  document.getElementById('sup-form-bio').value = s.bio || '';
  document.getElementById('sup-form-active').checked = s.active !== false;
  document.getElementById('sup-form-show-email').checked = s.showEmail !== false;
  document.getElementById('sup-form-show-phone').checked = Boolean(s.showPhone);
  document.getElementById('sup-form-show-photo').checked = s.showPhoto !== false;

  document.getElementById('modal-supervisor-title').textContent = 'Chỉnh sửa Giảng viên Hướng dẫn';
  document.getElementById('modal-supervisor').classList.remove('hidden');
};

window.closeSupervisorModal = function() {
  document.getElementById('modal-supervisor').classList.add('hidden');
};

window.saveSupervisorMaster = async function(e) {
  e.preventDefault();
  const id = document.getElementById('sup-form-id').value;
  const name = document.getElementById('sup-form-name').value.trim();
  const email = document.getElementById('sup-form-email').value.trim().toLowerCase();
  const phone = document.getElementById('sup-form-phone').value.trim();
  const photoUrl = document.getElementById('sup-form-photo').value.trim();
  const department = document.getElementById('sup-form-dept').value.trim();
  const expertise = document.getElementById('sup-form-expertise').value.trim();
  const bio = document.getElementById('sup-form-bio').value.trim();
  const active = document.getElementById('sup-form-active').checked;
  const showEmail = document.getElementById('sup-form-show-email').checked;
  const showPhone = document.getElementById('sup-form-show-phone').checked;
  const showPhoto = document.getElementById('sup-form-show-photo').checked;

  const payload = {
    name, email, phone, photoUrl, department, expertise, bio,
    active, showEmail, showPhone, showPhoto,
    updatedAt: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'supervisorMaster', id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await setDoc(doc(collection(db, 'supervisorMaster')), payload);
    }
    closeSupervisorModal();
    await loadAdminSupervisorsMaster();
  } catch (err) {
    alert('Lỗi lưu GVHD: ' + err.message);
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
    alert('Đã cập nhật chỉ tiêu GVHD trong đợt thành công!');
  } catch (e) {
    alert('Lỗi cập nhật: ' + e.message);
  }
};

window.removeRoundSupervisor = async function(roundId, supId) {
  if (!confirm('Bạn có chắc muốn bỏ GVHD này khỏi đợt?')) return;
  try {
    await deleteDoc(doc(db, 'graduationRounds', roundId, 'supervisors', supId));
    loadAdminRoundSupervisors(roundId);
  } catch (e) {
    alert('Lỗi xóa: ' + e.message);
  }
};

window.openAddSupervisorsToRoundModal = async function() {
  await loadAdminSupervisorsMaster();
  const listEl = document.getElementById('sup-master-picker-list');
  
  listEl.innerHTML = state.supervisorsMaster.filter(s => s.active !== false).map(s => `
    <label class="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
      <input type="checkbox" value="${s.id}" class="sup-picker-chk w-4 h-4 rounded text-blue-600">
      <div>
        <span class="font-bold text-slate-800 block">${s.name}</span>
        <span class="text-[11px] text-slate-400">${s.department || ''} • ${s.expertise || ''}</span>
      </div>
    </label>
  `).join('');

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
    alert('Vui lòng chọn ít nhất 1 giảng viên.');
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
    alert('Lỗi thêm GVHD: ' + e.message);
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
  if (!confirm(`Xóa sinh viên ${studentId} khỏi danh sách đủ điều kiện?`)) return;
  try {
    await deleteDoc(doc(db, 'graduationRounds', roundId, 'eligibleStudents', studentId));
    loadAdminEligibleStudents(roundId);
  } catch (e) {
    alert('Lỗi xóa: ' + e.message);
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
    alert('File Excel rỗng hoặc thiếu tiêu đề cột.');
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
    alert('Không có sinh viên nào cần import theo tùy chọn đã chọn.');
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

    alert(`Đã import thành công ${itemsToImport.length} sinh viên đủ điều kiện!`);
    cancelExcelImport();
    loadAdminEligibleStudents(roundId);
  } catch (err) {
    alert('Lỗi import Firestore: ' + err.message);
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
        <button onclick="toggleProjectTypeActive('${p.id}', ${p.active !== false})" class="text-slate-600 hover:underline font-bold">${p.active !== false ? 'Ẩn' : 'Bật'}</button>
      </td>
    </tr>
  `).join('');
}

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
  const name = document.getElementById('pt-form-name').value.trim();
  const order = parseInt(document.getElementById('pt-form-order').value, 10) || 1;
  const active = document.getElementById('pt-form-active').checked;

  try {
    await setDoc(doc(collection(db, 'graduationProjectTypes')), {
      name, order, active, createdAt: serverTimestamp()
    });
    closeProjectTypeModal();
    await loadProjectTypes();
  } catch (err) {
    alert('Lỗi lưu loại hình: ' + err.message);
  }
};

window.toggleProjectTypeActive = async function(id, currentActive) {
  try {
    await updateDoc(doc(db, 'graduationProjectTypes', id), { active: !currentActive });
    await loadProjectTypes();
  } catch (e) {
    alert('Lỗi cập nhật: ' + e.message);
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
      alert('Không có dữ liệu đăng ký để xuất.');
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

  if (!confirm('Bắt đầu quy trình xét duyệt Nguyện vọng 1? Giảng viên hướng dẫn sẽ có thể đăng nhập và chọn sinh viên.')) return;

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      currentReviewRound: 1,
      reviewStatus: 'round_1',
      status: 'reviewing',
      updatedAt: serverTimestamp()
    });

    alert('▶️ Đã bắt đầu xét duyệt Nguyện vọng 1 thành công!');
    await loadAdminReviewData(roundId);
  } catch (e) {
    alert('Lỗi bắt đầu xét duyệt: ' + e.message);
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
    alert(`🔒 ĐÃ CHỐT THÀNH CÔNG NGUYỆN VỌNG ${currentRound}!\nChuyển sang: ${nextStatus === 'manual_assignment' ? 'Phân công thủ công' : 'Xét Nguyện vọng ' + nextRound}`);
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi khi chốt vòng:', err);
    alert('Lỗi chốt vòng: ' + err.message);
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
    alert('Giảng viên này đã hết chỉ tiêu. Hãy chọn giảng viên khác hoặc tích vào ô "Quyền High Admin: Cho phép phân công vượt chỉ tiêu".');
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
    alert(`✓ Đã phân công sinh viên ${studentId} cho Thầy/Cô ${sup?.name} thành công!`);
    await loadAdminReviewData(roundId);
  } catch (err) {
    alert('Lỗi phân công: ' + err.message);
  }
};

window.publishAdminResults = async function() {
  const roundId = state.selectedRoundId;
  if (!roundId) return;

  const unassignedCount = (state.adminReviewData.registrations || []).filter(r => r.reviewStatus !== 'accepted' && r.reviewStatus !== 'manually_assigned').length;

  if (unassignedCount > 0) {
    if (!confirm(`Vẫn còn ${unassignedCount} sinh viên chưa được phân công GVHD. Bạn có chắc chắn muốn hoàn tất và CÔNG BỐ KẾT QUẢ CHÍNH THỨC không?`)) return;
  } else {
    if (!confirm('Xác nhận HOÀN TẤT & CÔNG BỐ KẾT QUẢ CHÍNH THỨC cho sinh viên và giảng viên?')) return;
  }

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      reviewStatus: 'completed',
      status: 'published',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    alert('🎉 ĐÃ CÔNG BỐ KẾT QUẢ ĐỒ ÁN TỐT NGHIỆP CHÍNH THỨC THÀNH CÔNG!');
    await loadAdminReviewData(roundId);
  } catch (err) {
    alert('Lỗi công bố kết quả: ' + err.message);
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

  let contactHtml = '';
  if (sup.showEmail !== false && sup.email) {
    contactHtml += `<div class="flex items-center gap-1.5 text-slate-600"><span>✉️ Email:</span> <a href="mailto:${sup.email}" class="text-blue-600 hover:underline">${sup.email}</a></div>`;
  }
  if (sup.showPhone && sup.phone) {
    contactHtml += `<div class="flex items-center gap-1.5 text-slate-600"><span>📞 SĐT:</span> <a href="tel:${sup.phone}" class="text-blue-600 hover:underline">${sup.phone}</a></div>`;
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
