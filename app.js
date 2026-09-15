/**
 * IFA+ Graduation — App Logic & Firestore Integration
 * Khoa Mỹ thuật Công nghiệp — Đại học Tôn Đức Thắng
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
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

// --- STATE MANAGEMENT ---
export const state = {
  user: null,
  role: 'student', // 'admin' | 'supervisor' | 'student'
  isAdmin: false,
  isSupervisor: false,
  isStudent: false,
  studentMssv: '',
  isEligible: false,
  
  // Active Data
  rounds: [],
  selectedRoundId: null,
  activeRound: null,
  projectTypes: [],
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
  excelStaging: []
};

let app, auth, db;
let countdownInterval = null;

// --- INITIALIZATION ---
async function initFirebase() {
  let config = {
    authDomain: "tknt-tdtu.firebaseapp.com",
    projectId: "tknt-tdtu"
  };
  try {
    const res = await fetch('/__/firebase/init.json');
    if (res.ok) config = await res.json();
  } catch (e) {
    console.warn('[IFA-Graduation] Fallback firebase config used.');
  }
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}

// --- AUTH & ROLES ---
export async function setupAuthListener() {
  onAuthStateChanged(auth, async user => {
    state.user = user;
    updateAuthUI();

    if (user) {
      document.getElementById('login-required-section').classList.add('hidden');
      await determineUserRoles();
      await loadInitialData();
    } else {
      document.getElementById('login-required-section').classList.remove('hidden');
      document.getElementById('view-student').classList.add('hidden');
      document.getElementById('view-supervisor').classList.add('hidden');
      document.getElementById('view-admin').classList.add('hidden');
    }
  });
}

async function determineUserRoles() {
  const email = state.user?.email || '';
  const emailLower = email.toLowerCase();
  
  // 1. Check Student
  if (emailLower.endsWith('@student.tdtu.edu.vn')) {
    state.isStudent = true;
    state.studentMssv = emailLower.split('@')[0].toUpperCase();
  } else {
    state.isStudent = false;
    state.studentMssv = '';
  }

  // 2. Check Admin
  let adminFound = false;
  if (emailLower === 'tranquanghai@tdtu.edu.vn') {
    adminFound = true;
  } else {
    try {
      const adminDoc = await getDoc(doc(db, 'admins', emailLower));
      if (adminDoc.exists()) adminFound = true;
    } catch (e) {}
  }
  state.isAdmin = adminFound;

  // 3. Check Supervisor
  let supFound = false;
  try {
    const qSup = query(collection(db, 'supervisorMaster'), where('email', '==', emailLower), where('active', '==', true));
    const supSnap = await getDocs(qSup);
    if (!supSnap.empty) supFound = true;
  } catch (e) {}
  state.isSupervisor = supFound;

  // Set default active view
  if (state.isAdmin) {
    state.role = 'admin';
    document.getElementById('nav-btn-admin').classList.remove('hidden');
    document.getElementById('nav-btn-admin').classList.add('flex');
    document.getElementById('m-nav-admin').classList.remove('hidden');
  }
  if (state.isSupervisor) {
    document.getElementById('nav-btn-supervisor').classList.remove('hidden');
    document.getElementById('nav-btn-supervisor').classList.add('flex');
    document.getElementById('m-nav-supervisor').classList.remove('hidden');
    if (!state.isAdmin) state.role = 'supervisor';
  }
  if (state.isStudent && !state.isAdmin && !state.isSupervisor) {
    state.role = 'student';
  }

  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  if (viewParam === 'admin' && state.isAdmin) state.role = 'admin';
  else if (viewParam === 'supervisor' && state.isSupervisor) state.role = 'supervisor';
  else if (viewParam === 'student') state.role = 'student';

  switchView(state.role);
}

function updateAuthUI() {
  const userInfoBar = document.getElementById('user-info-bar');
  const btnHeaderLogin = document.getElementById('btn-header-login');
  
  if (state.user) {
    userInfoBar.classList.remove('hidden');
    userInfoBar.classList.add('flex');
    btnHeaderLogin.classList.add('hidden');

    document.getElementById('user-display-name').textContent = state.user.displayName || state.user.email;
    document.getElementById('user-avatar').src = state.user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23fff"/><path fill="%23fff" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';
    
    let roleText = 'Sinh viên';
    if (state.isAdmin) roleText = 'Quản trị viên';
    else if (state.isSupervisor) roleText = 'Giảng viên';
    document.getElementById('user-role-badge').textContent = roleText;
  } else {
    userInfoBar.classList.add('hidden');
    userInfoBar.classList.remove('flex');
    btnHeaderLogin.classList.remove('hidden');
  }
}

// --- VIEW SWITCHER ---
window.switchView = function(targetView) {
  state.role = targetView;

  // Update Nav buttons styling
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
  }
};

// --- DATA INITIALIZATION ---
async function loadInitialData() {
  await loadProjectTypes();
  await loadRounds();
}

// --- PROJECT TYPES ---
const DEFAULT_PROJECT_TYPES = [
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

async function loadProjectTypes() {
  try {
    const snap = await getDocs(query(collection(db, 'graduationProjectTypes'), orderBy('order', 'asc')));
    if (snap.empty && state.isAdmin) {
      // Auto seed default project types for admin
      const batch = writeBatch(db);
      DEFAULT_PROJECT_TYPES.forEach((name, index) => {
        const ref = doc(collection(db, 'graduationProjectTypes'));
        batch.set(ref, { name, order: index + 1, active: true });
      });
      await batch.commit();
      return loadProjectTypes();
    }
    state.projectTypes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProjectTypesDropdown();
    renderAdminProjectTypesTable();
  } catch (e) {
    console.error('Error loading project types:', e);
  }
}

function renderProjectTypesDropdown() {
  const select = document.getElementById('select-project-type');
  if (!select) return;
  select.innerHTML = '<option value="">-- Chọn loại hình đồ án --</option>' +
    state.projectTypes
      .filter(p => p.active !== false)
      .map(p => `<option value="${p.name}">${p.name}</option>`)
      .join('');
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
      const openRound = state.rounds.find(r => r.status === 'open') || state.rounds[0];
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
    renderSupervisorView(roundId);
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
      valEl.textContent = 'ĐÃ HẾT HẠN';
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
  
  // Reset state
  state.isEligible = false;
  state.myRegistration = null;

  const nonEligibleAlert = document.getElementById('non-eligible-alert');
  const alreadyRegCard = document.getElementById('already-registered-card');
  const flowContainer = document.getElementById('registration-flow-container');

  if (!mssv) {
    nonEligibleAlert.classList.add('hidden');
    alreadyRegCard.classList.add('hidden');
    flowContainer.classList.add('hidden');
    return;
  }

  // 1. Check eligibleStudents
  try {
    const elDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'eligibleStudents', mssv));
    if (elDoc.exists() && elDoc.data().eligible !== false) {
      state.isEligible = true;
      nonEligibleAlert.classList.add('hidden');
    } else {
      state.isEligible = false;
      nonEligibleAlert.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Error checking eligibility:', e);
  }

  // 2. Check registrations
  try {
    const regDoc = await getDoc(doc(db, 'graduationRounds', roundId, 'registrations', mssv));
    if (regDoc.exists()) {
      state.myRegistration = { id: regDoc.id, ...regDoc.data() };
      renderAlreadyRegisteredCard();
      alreadyRegCard.classList.remove('hidden');
      flowContainer.classList.add('hidden');
    } else {
      alreadyRegCard.classList.add('hidden');
      if (state.isEligible || state.isPreviewMode) {
        flowContainer.classList.remove('hidden');
        resetRegistrationForm();
      } else {
        flowContainer.classList.add('hidden');
      }
    }
  } catch (e) {
    console.error('Error checking registration:', e);
  }
}

function renderAlreadyRegisteredCard() {
  const reg = state.myRegistration;
  if (!reg) return;

  document.getElementById('reg-card-topic').textContent = reg.topicTitle || 'Chưa đặt tên đề tài';
  document.getElementById('reg-card-type').textContent = reg.projectType || '--';
  
  const submitDate = reg.submittedAt ? (reg.submittedAt.toDate ? reg.submittedAt.toDate() : new Date(reg.submittedAt)) : null;
  document.getElementById('reg-card-time').textContent = submitDate ? `Thời gian nộp: ${submitDate.toLocaleString('vi-VN')}` : '';

  const listEl = document.getElementById('reg-card-preferences-list');
  listEl.innerHTML = (reg.preferences || []).map(p => `
    <div class="flex items-center justify-between p-2.5 bg-white border border-emerald-100 rounded-xl">
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">NV${p.rank}</span>
        <span class="font-bold text-slate-800">${p.supervisorName || p.supervisorId}</span>
      </div>
      <span class="text-[11px] text-slate-400">${p.department || ''}</span>
    </div>
  `).join('');

  // Check if round allows edit
  const round = state.activeRound;
  const now = new Date().getTime();
  const closeTime = round?.closeAtDate ? round.closeAtDate.getTime() : 0;
  const allowEdit = round?.allowStudentEdit && round?.status === 'open' && now <= closeTime;

  const btnEdit = document.getElementById('btn-edit-existing-reg');
  if (allowEdit || state.isAdmin) {
    btnEdit.classList.remove('hidden');
  } else {
    btnEdit.classList.add('hidden');
  }
}

window.enableEditRegistration = function() {
  if (!state.myRegistration) return;
  document.getElementById('already-registered-card').classList.add('hidden');
  document.getElementById('registration-flow-container').classList.remove('hidden');

  // Pre-fill form
  document.getElementById('input-topic-title').value = state.myRegistration.topicTitle || '';
  document.getElementById('select-project-type').value = state.myRegistration.projectType || '';
  state.selectedPreferences = [...(state.myRegistration.preferences || [])];
  
  goToStep(1);
};

function resetRegistrationForm() {
  document.getElementById('input-topic-title').value = '';
  document.getElementById('select-project-type').value = '';
  state.selectedPreferences = [];
  state.currentStep = 1;
  state.wizardRank = 1;
  goToStep(1);
}

// --- ROUND SUPERVISORS ---
async function loadRoundSupervisors(roundId) {
  try {
    const snap = await getDocs(query(collection(db, 'graduationRounds', roundId, 'supervisors'), where('activeInRound', '==', true)));
    state.roundSupervisors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSupervisorsGrid();
  } catch (e) {
    console.error('Error loading round supervisors:', e);
  }
}

function renderSupervisorsGrid() {
  const grid = document.getElementById('supervisors-grid');
  if (!grid) return;

  const maxPref = state.activeRound?.preferenceCount || 3;
  const mode = state.activeRound?.selectionMode || 'cards';

  // Wizard mode sub-header
  const wizardSub = document.getElementById('wizard-sub-stepper');
  if (mode === 'wizard') {
    wizardSub.classList.remove('hidden');
    document.getElementById('wizard-current-rank-label').textContent = `ĐANG CHỌN: NGUYỆN VỌNG ${state.wizardRank} / ${maxPref}`;
  } else {
    wizardSub.classList.add('hidden');
  }

  // Filter and render cards
  const searchTerm = (document.getElementById('search-supervisor-input')?.value || '').toLowerCase();
  const deptFilter = document.getElementById('filter-dept-select')?.value || 'all';

  const filtered = state.roundSupervisors.filter(s => {
    const matchName = (s.name || '').toLowerCase().includes(searchTerm);
    const matchExp = (s.expertise || '').toLowerCase().includes(searchTerm);
    const matchDept = (s.department || '').toLowerCase().includes(searchTerm);
    const matchDeptFilter = (deptFilter === 'all' || s.department === deptFilter);
    return (matchName || matchExp || matchDept) && matchDeptFilter;
  });

  // Populate department filter options if needed
  const deptSelect = document.getElementById('filter-dept-select');
  if (deptSelect && deptSelect.options.length <= 1) {
    const depts = [...new Set(state.roundSupervisors.map(s => s.department).filter(Boolean))];
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      deptSelect.appendChild(opt);
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-xs font-semibold">Không tìm thấy giảng viên nào phù hợp.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(sup => {
    const existingIndex = state.selectedPreferences.findIndex(p => p.supervisorId === sup.id);
    const isSelected = existingIndex !== -1;
    const assignedRank = isSelected ? state.selectedPreferences[existingIndex].rank : null;

    let actionBtnHtml = '';
    let cardOverlayClass = '';

    if (mode === 'cards') {
      if (isSelected) {
        actionBtnHtml = `
          <button type="button" onclick="removePreference('${sup.id}')" class="w-full py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center justify-center gap-1">
            <span>✕ Bỏ chọn (NV${assignedRank})</span>
          </button>
        `;
      } else {
        const nextRank = state.selectedPreferences.length + 1;
        const isFull = state.selectedPreferences.length >= maxPref;
        actionBtnHtml = `
          <button type="button" onclick="addPreference('${sup.id}', '${encodeURIComponent(sup.name)}')" ${isFull ? 'disabled' : ''} class="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5">
            <span>+ Chọn NV${nextRank <= maxPref ? nextRank : maxPref}</span>
          </button>
        `;
      }
    } else {
      // Wizard Mode
      const isChosenInOtherRank = isSelected && assignedRank !== state.wizardRank;
      const isChosenInCurrentRank = isSelected && assignedRank === state.wizardRank;

      if (isChosenInOtherRank) {
        cardOverlayClass = 'opacity-50 grayscale pointer-events-none';
        actionBtnHtml = `
          <div class="py-2 text-center text-[11px] font-bold text-slate-500 bg-slate-100 rounded-xl">
            Đã chọn ở NV${assignedRank}
          </div>
        `;
      } else if (isChosenInCurrentRank) {
        actionBtnHtml = `
          <button type="button" onclick="removePreference('${sup.id}')" class="w-full py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1">
            <span>✓ Đã chọn NV${state.wizardRank} (Bấm để hủy)</span>
          </button>
        `;
      } else {
        actionBtnHtml = `
          <button type="button" onclick="selectWizardPreference('${sup.id}', '${encodeURIComponent(sup.name)}')" class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5">
            <span>Chọn cho NV${state.wizardRank}</span>
          </button>
        `;
      }
    }

    const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%23cbd5e1"/><path fill="%23cbd5e1" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';
    const photoUrl = (sup.showPhoto !== false && sup.photoUrl) ? sup.photoUrl : defaultAvatar;

    return `
      <div class="card-surface p-4 flex flex-col justify-between card-hover ${cardOverlayClass} ${isSelected ? 'ring-2 ring-blue-600/60 bg-blue-50/20' : ''}">
        <div>
          <div class="flex items-start gap-3 mb-3">
            <img src="${photoUrl}" alt="${sup.name}" class="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0">
            <div class="min-w-0 flex-1">
              <h4 class="font-extrabold text-sm text-slate-900 leading-snug truncate" title="${sup.name}">${sup.name}</h4>
              <p class="text-[11px] font-medium text-slate-500 truncate mt-0.5">${sup.department || 'Bộ môn TKNT'}</p>
              ${sup.capacity ? `<span class="inline-block mt-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Chỉ tiêu: ${sup.capacity} SV</span>` : ''}
            </div>
          </div>

          <div class="text-[11px] text-slate-600 space-y-1 mb-3">
            <p class="line-clamp-2" title="${sup.expertise || ''}"><strong class="text-slate-700">Chuyên môn:</strong> ${sup.expertise || 'Đồ án nội thất'}</p>
            ${sup.bio ? `<button type="button" onclick="openBioModal('${sup.id}')" class="text-blue-600 hover:underline font-semibold block text-[10px] mt-0.5">Xem giới thiệu chi tiết →</button>` : ''}
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100">
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }).join('');

  renderPreferencesTray();
}

window.filterSupervisors = function() {
  renderSupervisorsGrid();
};

// --- PREFERENCES SELECTION LOGIC ---
window.addPreference = function(supervisorId, encName) {
  const name = decodeURIComponent(encName);
  const maxPref = state.activeRound?.preferenceCount || 3;

  if (state.selectedPreferences.length >= maxPref) return;
  if (state.selectedPreferences.some(p => p.supervisorId === supervisorId)) return;

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
  // Re-rank 1..N
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

  // Remove if rank already had someone
  state.selectedPreferences = state.selectedPreferences.filter(p => p.rank !== currentRank);

  state.selectedPreferences.push({
    rank: currentRank,
    supervisorId,
    supervisorName: name,
    department: sup?.department || '',
    photoUrl: sup?.photoUrl || ''
  });

  state.selectedPreferences.sort((a, b) => a.rank - b.rank);

  // Auto advance to next rank if not finished
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
    alert(`Vui lòng chọn đủ ${maxPref} nguyện vọng GVHD trước khi tiếp tục.`);
    return;
  }
  goToStep(3);
};

function renderConfirmationPanel() {
  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const name = state.user?.displayName || 'Sinh viên TDTU';
  const email = state.user?.email || `${mssv}@student.tdtu.edu.vn`;
  const topic = (document.getElementById('input-topic-title')?.value || '').trim();
  const projectType = document.getElementById('select-project-type')?.value || '';

  document.getElementById('confirm-student-name').textContent = name;
  document.getElementById('confirm-student-mssv').textContent = mssv;
  document.getElementById('confirm-student-email').textContent = email;
  document.getElementById('confirm-topic-title').textContent = topic;
  document.getElementById('confirm-project-type').textContent = projectType;

  const listEl = document.getElementById('confirm-preferences-list');
  listEl.innerHTML = state.selectedPreferences.map(p => `
    <div class="flex items-center justify-between p-2.5 bg-white border rounded-xl">
      <div class="flex items-center gap-2.5">
        <span class="w-6 h-6 rounded-full bg-tdtu-blue text-white font-extrabold text-xs flex items-center justify-center">NV${p.rank}</span>
        <span class="font-bold text-slate-800">${p.supervisorName}</span>
      </div>
      <span class="text-[11px] text-slate-400">${p.department || ''}</span>
    </div>
  `).join('');
}

// --- SUBMIT REGISTRATION ---
window.submitFinalRegistration = async function() {
  if (state.isPreviewMode) {
    alert('[CHẾ ĐỘ XEM THỬ] Mô phỏng đăng ký thành công! (Dữ liệu không ghi thật vào hệ thống).');
    exitPreviewMode();
    return;
  }

  const chk = document.getElementById('confirm-agreement-chk');
  if (!chk || !chk.checked) {
    alert('Vui lòng tích chọn cam kết thông tin đăng ký.');
    return;
  }

  const roundId = state.selectedRoundId;
  const mssv = state.studentMssv;
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
      status: 'submitted'
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

// --- SUPERVISOR VIEW SHELL ---
function renderSupervisorView(roundId) {
  const email = (state.user?.email || '').toLowerCase();
  const supInRound = state.roundSupervisors.find(s => s.email?.toLowerCase() === email);

  document.getElementById('supervisor-greeting-name').textContent = `Kính chào Thầy/Cô ${supInRound?.name || state.user?.displayName || ''}`;
  document.getElementById('supervisor-round-info').textContent = `Đợt tốt nghiệp: ${state.activeRound?.title || ''} (${state.activeRound?.academicYear || ''})`;
  document.getElementById('supervisor-assigned-capacity').textContent = `${supInRound?.capacity || 0} SV`;
}

// --- ADMIN STATS & TABLES ---
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
    b.classList.remove('bg-slate-800', 'text-white');
    b.classList.add('text-slate-400');
  });
  const activeBtn = document.getElementById('atab-btn-' + tabKey);
  if (activeBtn) {
    activeBtn.classList.add('bg-slate-800', 'text-white');
    activeBtn.classList.remove('text-slate-400');
  }

  ['overview', 'rounds', 'supervisors-master', 'round-supervisors', 'eligible-students', 'project-types', 'registrations', 'preview-student'].forEach(t => {
    const p = document.getElementById('atab-panel-' + t);
    if (p) {
      if (t === tabKey) p.classList.remove('hidden');
      else p.classList.add('hidden');
    }
  });

  if (tabKey === 'supervisors-master') loadAdminSupervisorsMaster();
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

// Topic character count listener
document.getElementById('input-topic-title')?.addEventListener('input', e => {
  const len = e.target.value.length;
  document.getElementById('topic-char-count').textContent = `${len}/250`;
});

// Start application
initFirebase().then(() => {
  setupAuthListener();
});
