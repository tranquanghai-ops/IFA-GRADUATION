
// --- Module Bridges ---
const loadAdminStats = () => window.loadAdminStats?.();
const selectRound = (id) => window.selectRound?.(id);
const loadRounds = () => window.loadRounds?.();
const switchAdminTab = (tab) => window.switchAdminTab?.(tab);
const initSupervisorPortal = () => window.initSupervisorPortal?.();
const initAssessmentPortal = () => window.initAssessmentPortal?.();
/**
 * IFA+ Graduation — Authentication & Roles Module
 */
const showLoading = window.showLoading;
const hideLoading = window.hideLoading;
// --- AUTH & ROLES ---
export function isSystemOwner(user = null) {
  const targetUser = user || state.realUser || state.user || auth?.currentUser;
  const email = (targetUser?.email || '').toLowerCase().trim();
  return email === 'tranquanghai@tdtu.edu.vn';
}
window.isSystemOwner = isSystemOwner;

export function findMatchingSupervisorProfile(rawEmail, supervisorList) {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email || !Array.isArray(supervisorList) || supervisorList.length === 0) return null;

  return supervisorList.find(s => {
    if (!s) return false;
    // Strict status check: must not be inactive, revoked, or disabled
    if (s.active === false || s.status === 'revoked' || s.status === 'disabled') return false;

    // 1. Primary email match (trimmed & lowercase)
    const primary = String(s.email || '').trim().toLowerCase();
    if (primary && primary === email) return true;

    // 2. Extra declared emails array match
    if (Array.isArray(s.emails) && s.emails.some(e => String(e || '').trim().toLowerCase() === email)) return true;

    // 3. Personal or institutional email match
    if (s.personalEmail && String(s.personalEmail).trim().toLowerCase() === email) return true;
    if (s.institutionalEmail && String(s.institutionalEmail).trim().toLowerCase() === email) return true;

    return false;
  }) || null;
}
window.findMatchingSupervisorProfile = findMatchingSupervisorProfile;

export function evaluateAccountDomainAndRole(rawEmail, supervisorList = null) {
  const email = (rawEmail || '').toLowerCase().trim();
  if (!email) {
    return {
      isValid: false,
      reason: 'empty',
      message: 'Không tìm thấy địa chỉ email trong tài khoản đăng nhập.'
    };
  }

  // 1. Owner / Root System Admin: tranquanghai@tdtu.edu.vn
  if (email === 'tranquanghai@tdtu.edu.vn') {
    return {
      isValid: true,
      accountType: 'staff',
      role: 'owner',
      isOwner: true,
      isAdmin: true,
      email
    };
  }

  // 2. Authorized Supervisor from Supervisor Master (including Visiting Lecturers with external email)
  const masterList = supervisorList || state.supervisorsMaster || [];
  const matchingSupervisor = findMatchingSupervisorProfile(email, masterList);
  if (matchingSupervisor) {
    return {
      isValid: true,
      accountType: 'supervisor',
      isSupervisor: true,
      isVisitingSupervisor: !email.endsWith('@tdtu.edu.vn'),
      supervisorProfile: matchingSupervisor,
      email
    };
  }

  // 3. Student domain: @student.tdtu.edu.vn
  if (email.endsWith('@student.tdtu.edu.vn')) {
    const studentMatch = email.match(/^([a-z0-9]+)@student\.tdtu\.edu\.vn$/i);
    if (!studentMatch || !studentMatch[1]) {
      return {
        isValid: false,
        isStudentDomain: true,
        reason: 'invalid_mssv',
        message: 'Email sinh viên không hợp lệ. Vui lòng sử dụng email có định dạng MSSV@student.tdtu.edu.vn.'
      };
    }
    const mssv = String(studentMatch[1]).trim().toUpperCase();
    return {
      isValid: true,
      accountType: 'student',
      email,
      mssv
    };
  }

  // 4. Staff / Faculty / Admin domain: @tdtu.edu.vn
  if (email.endsWith('@tdtu.edu.vn')) {
    return {
      isValid: true,
      accountType: 'staff',
      email,
      isOwner: false
    };
  }

  // 5. Unauthorized personal or external domains
  const isPersonal = email.includes('gmail.com') || email.includes('yahoo.com') || email.includes('outlook.com') || email.includes('hotmail.com');
  return {
    isValid: false,
    isPersonal,
    reason: isPersonal ? 'personal_email' : 'invalid_domain',
    message: isPersonal
      ? 'Email cá nhân không được phép sử dụng trong hệ thống hoặc chưa được cấp quyền Giảng viên hướng dẫn. Sinh viên vui lòng đăng nhập bằng MSSV@student.tdtu.edu.vn.'
      : 'Ứng dụng chỉ dành cho sinh viên và giảng viên được cấp quyền trong hệ thống IFA-Graduation.'
  };
}
window.evaluateAccountDomainAndRole = evaluateAccountDomainAndRole;

export function clearStudentSessionAndState() {
  state.realUser = null;
  state.user = null;
  state.actualRole = null;
  state.currentView = null;
  state.role = 'student';
  state.isAdmin = false;
  state.isSupervisor = false;
  state.isStudent = false;
  state.studentMssv = '';
  state.userStudentId = '';
  state.myRegistration = null;
  state.myOfficialAssignment = null;
  state.studentRounds = [];
  state.studentSelfProfile = null;
  state.isRegisteringTopic = false;
  try {
    sessionStorage.removeItem('ifa_student_mssv');
    sessionStorage.removeItem('ifa_student_email');
    sessionStorage.removeItem('student_selected_round_id');
    localStorage.removeItem('student_selected_round_id');
  } catch (e) {}
}
window.clearStudentSessionAndState = clearStudentSessionAndState;

export async function setupAuthListener() {
  showLoading('Đang khởi tạo IFA+ Graduation...');

  // Fallback an toàn: Loading overlay tự động tắt sau tối đa 60 giây nếu có sự cố
  const safetyTimer = setTimeout(() => {
    hideLoading();
  }, 60000);

  onAuthStateChanged(auth, async user => {
    state.realUser = user;
    state.user = user;

    if (user) {
      // Phân giải quyền người dùng theo thứ tự phân cấp nghiêm ngặt (Strict Identity & Role Hierarchy):
      // 1. Owner / Admin
      // 2. GVHD được cấp quyền (kể cả email ngoài TDTU)
      // 3. Sinh viên có email TDTU hợp lệ
      // 4. Từ chối các tài khoản còn lại (KHÔNG signOut vội vã trước khi đối soát)
      showLoading('Đang xác định vai trò người dùng...');
      try {
        await Promise.race([
          resolveActualRoles(user),
          new Promise(r => setTimeout(r, 4000))
        ]);
      } catch (e) {
        console.warn('[IFA-Graduation] Role resolution notice:', e);
      }

      // Kiểm tra bảo vệ: Nếu tài khoản không được cấp quyền trong hệ thống
      if (state.actualRole === 'unauthorized' || (!state.isAdmin && !state.isSupervisor && !state.isStudent)) {
        const rawEmail = (user.email || '').toLowerCase().trim();
        const isPersonal = rawEmail.includes('gmail.com') || rawEmail.includes('yahoo.com') || rawEmail.includes('outlook.com') || rawEmail.includes('hotmail.com');
        const isTdtuStaff = rawEmail.endsWith('@tdtu.edu.vn');

        let rejectTitle = 'Từ chối truy cập';
        let rejectMessage = '';

        if (isTdtuStaff) {
          rejectTitle = 'Tài khoản chưa được phân quyền';
          rejectMessage = 'Tài khoản Google TDTU này chưa được gán quyền Quản trị viên hoặc Giảng viên hướng dẫn trong hệ thống IFA-Graduation. Vui lòng liên hệ Quản trị viên Khoa.';
        } else if (isPersonal) {
          rejectTitle = 'Email chưa được cấp quyền';
          rejectMessage = 'Email cá nhân này chưa được cấp quyền Giảng viên hướng dẫn trong hệ thống. Sinh viên vui lòng đăng nhập bằng MSSV@student.tdtu.edu.vn.';
        } else {
          rejectTitle = 'Tài khoản không hợp lệ';
          rejectMessage = 'Ứng dụng chỉ dành cho sinh viên và giảng viên được cấp quyền trong hệ thống IFA-Graduation.';
        }

        console.warn('[IFA-Graduation Auth] Account rejected:', rawEmail, rejectTitle);
        showToast(rejectMessage, 'error', 10000);

        const loginSec = document.getElementById('login-required-section');
        if (loginSec) {
          loginSec.classList.remove('hidden');
          let authErrCard = document.getElementById('login-auth-error-card');
          if (!authErrCard) {
            authErrCard = document.createElement('div');
            authErrCard.id = 'login-auth-error-card';
            const container = loginSec.querySelector('.card-surface') || loginSec;
            container.prepend(authErrCard);
          }
          authErrCard.className = 'p-4 mb-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs text-left space-y-1.5 shadow-sm';
          authErrCard.innerHTML = `
            <div class="flex items-start gap-2.5">
              <span class="text-rose-600 text-base">⚠️</span>
              <div class="flex-1">
                <strong class="font-bold text-rose-950 block">${rejectTitle}: ${window.escapeHtml ? window.escapeHtml(user.email) : user.email}</strong>
                <p class="text-rose-800 leading-relaxed">${rejectMessage}</p>
              </div>
            </div>
          `;
        }

        // Hide all internal views immediately
        document.getElementById('view-student')?.classList.add('hidden');
        document.getElementById('view-supervisor')?.classList.add('hidden');
        document.getElementById('view-admin')?.classList.add('hidden');
        document.getElementById('view-assessment')?.classList.add('hidden');

        // Close any open registration flow or modal
        const flowContainer = document.getElementById('registration-flow-container');
        if (flowContainer) flowContainer.classList.add('hidden');
        state.isRegisteringTopic = false;

        // Clear all session and state
        clearStudentSessionAndState();

        // Proactively sign out of Firebase Auth
        try {
          await signOut(auth);
        } catch (soErr) {
          console.warn('[Auth] Signout notice:', soErr);
        }

        clearTimeout(safetyTimer);
        hideLoading();
        return;
      }

      // Valid account: remove any previous login error card
      const prevErrCard = document.getElementById('login-auth-error-card');
      if (prevErrCard) prevErrCard.remove();

      document.getElementById('login-required-section')?.classList.add('hidden');

      state.realIsAdmin = Boolean(state.isAdmin);
      state.realIsOwner = isSystemOwner(user);
      state.isOwner = state.realIsOwner;

      try {
        // 1.1 Tải thiết lập hệ thống và kích hoạt Realtime Listener (chỉ dành riêng cho Owner)
        if (state.realIsOwner) {
          setupSystemSettingsRealtimeListener();
          try {
            await loadSystemSettingsDoc();
          } catch (e) {}
        }

        // 1.2 Khôi phục phiên đóng vai (chỉ dành riêng cho Owner)
        if (state.allowImpersonation && state.realIsOwner) {
          loadImpersonationSession();
        } else {
          try { sessionStorage.removeItem('ifa_graduation_impersonation'); } catch (e) {}
          state.impersonation = null;
        }

        // 1.3 Ghi nhận đăng nhập & Theo dõi hoạt động
        if (typeof window.recordUserLogin === 'function') {
          window.recordUserLogin(user).catch(() => {});
        }
        if (state.realIsAdmin && typeof window.loadUserActivities === 'function') {
          window.loadUserActivities().catch(() => {});
        }

        updateAuthUI();

        // 2. Kích hoạt ngay view ban đầu để UI hiển thị tức thì
        const detectedPortal = getCurrentPortal();
        let initView = state.currentView;
        if (!initView) {
          if (detectedPortal === 'admin' && (state.isAdmin || state.impersonation)) {
            initView = 'admin';
          } else if (detectedPortal === 'assessment') {
            initView = 'assessment';
          } else if ((state.isSupervisor || state.isAdmin) && !state.impersonation) {
            // Chủ sở hữu, admin, quản trị viên, GVHD khi vào trang chủ (/) đều mặc định hiển thị Cổng GVHD vì vẫn phải HDTN
            initView = 'supervisor';
          } else {
            initView = state.actualRole || 'student';
          }
        }
        await switchView(initView);
        if (initView === 'admin' && !state.impersonation && state.isAdmin) {
          if (typeof switchAdminTab === 'function') switchAdminTab('rounds');
          else if (window.switchAdminTab) window.switchAdminTab('rounds');
        }

        // 3. Tải dữ liệu đợt và loại hình đồ án với timeout bảo vệ
        showLoading('Đang tải dữ liệu đợt tốt nghiệp...');
        try {
          await Promise.race([
            loadInitialData(),
            new Promise(r => setTimeout(r, 10000))
          ]);
        } catch (loadErr) {
          console.warn('[IFA-Graduation] Initial data loading notice:', loadErr);
        }

        // Tái đồng bộ view sau khi đã có dữ liệu đợt
        await switchView(state.currentView || initView);

        // Tự động kiểm tra và chuyển thẳng vào phòng chấm Hội đồng nếu có liên kết ?hd=
        setTimeout(() => {
          checkAndHandlePendingCouncilDirectLink();
          if (typeof window.checkAndHandlePendingRoundJoin === 'function') {
            window.checkAndHandlePendingRoundJoin();
          }
        }, 300);

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
      councilDirectOpenKey = '';
      clearTimeout(safetyTimer);
      if (unsubscribeSettings) {
        try { unsubscribeSettings(); } catch (e) {}
        unsubscribeSettings = null;
      }
      state.realUser = null;
      state.realIsAdmin = false;
      state.realIsOwner = false;
      state.isOwner = false;
      state.impersonation = null;
      try { sessionStorage.removeItem('ifa_graduation_impersonation'); } catch (e) {}
      const gBanner = document.getElementById('global-impersonation-banner');
      if (gBanner) gBanner.classList.add('hidden');
      await resolveActualRoles(null);
      updateAuthUI();

      // Check URL for ?hd= or ?c= to display council login banner
      const urlParams = new URLSearchParams(window.location.search);
      const hdParam = urlParams.get('hd') || urlParams.get('c') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pendingCouncilCode') : null);
      const promptCard = document.getElementById('login-council-prompt-card');
      const standardInst = document.getElementById('login-standard-instruction');
      const councilInst = document.getElementById('login-council-instruction');
      if (hdParam) {
        const codeEl = document.getElementById('login-council-prompt-code');
        if (codeEl) codeEl.textContent = String(hdParam).trim();
        sessionStorage.setItem('pendingCouncilCode', hdParam);
        sessionStorage.setItem('councilDirectMode', 'true');
        sessionStorage.setItem('directCouncilCode', hdParam);
        state.isCouncilDirectMode = true;
        if (standardInst) standardInst.classList.add('hidden');
        if (councilInst) councilInst.classList.remove('hidden');
        if (promptCard) promptCard.classList.remove('hidden');
      } else {
        if (standardInst) standardInst.classList.remove('hidden');
        if (councilInst) councilInst.classList.add('hidden');
        if (promptCard) promptCard.classList.add('hidden');
      }

      const joinParam = urlParams.get('join') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pendingJoinRound') : null);
      if (joinParam && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('pendingJoinRound', joinParam);
        if (typeof window.checkAndHandlePendingRoundJoin === 'function') {
          window.checkAndHandlePendingRoundJoin();
        }
      }

      document.body.classList.remove('council-standalone-active');
      document.getElementById('login-required-section').classList.remove('hidden');
      document.getElementById('view-student').classList.add('hidden');
      document.getElementById('view-supervisor').classList.add('hidden');
      document.getElementById('view-admin').classList.add('hidden');
      document.getElementById('view-assessment')?.classList.add('hidden');
      hideLoading();
    }
  });
}

let councilDirectOpenKey = '';
export function checkAndHandlePendingCouncilDirectLink() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hdCode = urlParams.get('hd') || urlParams.get('c') || sessionStorage.getItem('pendingCouncilCode') || sessionStorage.getItem('directCouncilCode');
    if (!hdCode) return;

    const cleanCode = String(hdCode).trim().toLowerCase();
    let foundRound = null, foundAct = null, foundCouncil = null;

    for (const r of (state.rounds || [])) {
      if (r.deleted) continue;
      for (const a of (r.activities || [])) {
        for (const c of (a.councils || [])) {
          if (
            (c.shortCode && c.shortCode.toLowerCase() === cleanCode) ||
            (c.code && c.code.toLowerCase() === cleanCode) ||
            (c.id && c.id.toLowerCase() === cleanCode) ||
            (c.slug && c.slug.toLowerCase() === cleanCode)
          ) {
            foundRound = r;
            foundAct = a;
            foundCouncil = c;
            break;
          }
        }
        if (foundCouncil) break;
      }
      if (foundCouncil) break;
    }

    if (foundCouncil && foundRound && foundAct) {
      const openKey = `${foundRound.id}_${foundAct.id}_${foundCouncil.id}`;
      if (councilDirectOpenKey === openKey) return;
      councilDirectOpenKey = openKey;
      state.isCouncilDirectMode = true;
      sessionStorage.setItem('councilDirectMode', 'true');
      sessionStorage.setItem('directCouncilCode', cleanCode);
      sessionStorage.removeItem('pendingCouncilCode');
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname + `?hd=${foundCouncil.shortCode || foundCouncil.code || cleanCode}`);
      }
      setTimeout(async () => {
        if (typeof window.openCouncilWorkspace === 'function') {
          try {
            const opened = await window.openCouncilWorkspace(foundRound.id, foundAct.id, foundCouncil.id);
            if (opened) showToast(`🏛️ Đã vào phòng chấm Hội đồng: ${foundCouncil.name}`, 'success');
          } catch (err) {
            councilDirectOpenKey = '';
            console.error('Council direct entry failed:', err);
            showToast('Không mở được phòng chấm Hội đồng. Vui lòng thử lại.', 'error');
          }
        }
      }, 350);
    }
  } catch (err) {
    console.warn('[IFA-Graduation] Pending council direct link notice:', err);
  }
}
window.checkAndHandlePendingCouncilDirectLink = checkAndHandlePendingCouncilDirectLink;

export async function handleLogout() {
  try {
    sessionStorage.removeItem('pendingCouncilCode');
    sessionStorage.removeItem('councilDirectMode');
    sessionStorage.removeItem('directCouncilCode');
    sessionStorage.removeItem('pendingJoinRound');
    sessionStorage.removeItem('ifa_graduation_impersonation');
    state.isCouncilDirectMode = false;
    state.impersonation = null;
    document.body.classList.remove('council-standalone-active');
    clearStudentSessionAndState();
    await signOut(auth);
  } catch (e) {
    console.warn('Signout notice:', e);
  }
  window.location.href = window.location.origin;
}
window.handleLogout = handleLogout;

export async function resolveActualRoles(user) {
  if (!user) {
    clearStudentSessionAndState();
    return;
  }

  const rawEmail = (user.email || '').trim().toLowerCase();
  if (!rawEmail) {
    state.actualRole = 'unauthorized';
    clearStudentSessionAndState();
    return;
  }

  // BẬC 1: OWNER / ROOT SYSTEM ADMIN & ADMINS
  let isOwner = isSystemOwner(user);
  let isAdmin = isOwner;
  if (!isAdmin && window.__tdtu_user && (window.__tdtu_user.isAdmin || window.__tdtu_user.role === 'admin')) {
    isAdmin = true;
  }
  if (!isAdmin) {
    try {
      const adminDoc = await getDoc(doc(db, 'admins', rawEmail)).catch(() => null);
      if (adminDoc && adminDoc.exists()) {
        isAdmin = true;
      }
    } catch (e) {}
  }

  // BẬC 2: GIẢNG VIÊN HƯỚNG DẪN ĐƯỢC CẤP QUYỀN (BAO GỒM GV CƠ HỮU TDTU & GV THỈNH GIẢNG EMAIL NGOÀI TDTU)
  let isSupervisor = false;
  let supervisorProfile = null;

  // 2.1 Kiểm tra trước trong bộ nhớ state.supervisorsMaster (nếu đã tải)
  if (Array.isArray(state.supervisorsMaster) && state.supervisorsMaster.length > 0) {
    supervisorProfile = findMatchingSupervisorProfile(rawEmail, state.supervisorsMaster);
    if (supervisorProfile) isSupervisor = true;
  }

  // 2.2 Nếu chưa thấy trong memory, truy vấn trực tiếp Firestore supervisorMaster
  if (!isSupervisor) {
    try {
      // Truy vấn chính xác theo email được phân quyền trong supervisorMaster
      const q = query(collection(db, 'supervisorMaster'), where('email', '==', rawEmail));
      const snap = await getDocs(q).catch(() => null);
      if (snap && !snap.empty) {
        const found = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(s => s.active !== false && s.status !== 'revoked' && s.status !== 'disabled');
        if (found) {
          isSupervisor = true;
          supervisorProfile = found;
          if (!state.supervisorsMaster) state.supervisorsMaster = [];
          if (!state.supervisorsMaster.some(s => s.id === found.id)) {
            state.supervisorsMaster.push(found);
          }
        }
      }
    } catch (e) {
      console.warn('[IFA-Graduation Auth] Supervisor direct query notice:', e);
    }
  }

  // 2.3 Fallback an toàn: Nếu email là @tdtu.edu.vn, tải toàn bộ danh mục supervisorMaster để đối soát
  if (!isSupervisor && rawEmail.endsWith('@tdtu.edu.vn')) {
    try {
      const fullSnap = await getDocs(collection(db, 'supervisorMaster')).catch(() => null);
      if (fullSnap && !fullSnap.empty) {
        state.supervisorsMaster = fullSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        supervisorProfile = findMatchingSupervisorProfile(rawEmail, state.supervisorsMaster);
        if (supervisorProfile) isSupervisor = true;
      }
    } catch (e) {}
  }

  // BẬC 3: SINH VIÊN (BẮT BUỘC EMAIL @student.tdtu.edu.vn VÀ CÓ MSSV HỢP LỆ)
  let isStudent = false;
  let studentMssv = '';
  if (!isAdmin && !isSupervisor && rawEmail.endsWith('@student.tdtu.edu.vn')) {
    const studentMatch = rawEmail.match(/^([a-z0-9]+)@student\.tdtu\.edu\.vn$/i);
    if (studentMatch && studentMatch[1]) {
      isStudent = true;
      studentMssv = String(studentMatch[1]).trim().toUpperCase();
    }
  }

  // BẬC 4: THIẾT LẬP TRẠNG THÁI VÀ PHÂN QUYỀN
  state.isAdmin = isAdmin;
  state.isSupervisor = isSupervisor;
  state.isStudent = isStudent;
  state.studentMssv = studentMssv;
  state.userStudentId = studentMssv;
  state.supervisorProfile = supervisorProfile;

  if (isStudent) {
    state.actualRole = 'student';
    state.currentView = 'student';
    state.role = 'student';
    try {
      sessionStorage.setItem('ifa_student_mssv', studentMssv);
      sessionStorage.setItem('ifa_student_email', rawEmail);
    } catch (e) {}
    return;
  } else {
    try {
      sessionStorage.removeItem('ifa_student_mssv');
      sessionStorage.removeItem('ifa_student_email');
    } catch (e) {}
  }

  if (isAdmin) {
    state.actualRole = 'admin';
  } else if (isSupervisor) {
    state.actualRole = 'supervisor';
  } else {
    state.actualRole = 'unauthorized';
  }

  // Determine currentView: URL param override if permitted
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  const detectedPortal = (typeof getCurrentPortal === 'function') ? getCurrentPortal() : 'student';

  if (viewParam === 'admin' && isAdmin) {
    state.currentView = 'admin';
  } else if (viewParam === 'supervisor' && (isSupervisor || isAdmin)) {
    state.currentView = 'supervisor';
  } else if (detectedPortal === 'admin' && (isAdmin || state.impersonation)) {
    state.currentView = 'admin';
  } else if (detectedPortal === 'assessment') {
    state.currentView = 'assessment';
  } else if ((isAdmin || isSupervisor) && !state.impersonation) {
    state.currentView = 'supervisor';
  } else {
    state.currentView = null;
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
    const effectiveEmail = isImp ? (target.email || '') : (state.user.email || '');
    const userEmail = document.getElementById('user-email');
    if (userEmail) userEmail.textContent = effectiveEmail;
    document.getElementById('user-avatar').src = (isImp && (target.photoURL || target.photoUrl)) || state.user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%2364748b"/><path fill="%2364748b" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';
    
    // Display ACTUAL ROLE badge
    const roleBadge = document.getElementById('user-role-badge');
    const viewingBadge = document.getElementById('user-viewing-badge');
    
    let roleName = 'Sinh viên';
    let badgeClass = 'ifa-role-badge ifa-role-student';

    if (isImp) {
      roleName = `Đóng vai: ${target.roleLabel || target.type || 'Người dùng'}`;
      badgeClass = 'ifa-role-badge ifa-role-impersonating';
    } else if (state.actualRole === 'admin') {
      roleName = 'Quản trị viên';
      badgeClass = 'ifa-role-badge ifa-role-admin';
    } else if (state.actualRole === 'supervisor') {
      roleName = 'Giảng viên';
      badgeClass = 'ifa-role-badge ifa-role-supervisor';
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

    // Header Impersonate button visibility (chỉ dành riêng cho Owner)
    const btnOpenImp = document.getElementById('btn-open-impersonate');
    if (btnOpenImp) {
      if (state.realIsOwner && state.allowImpersonation && !isImp) {
        btnOpenImp.classList.remove('hidden');
        btnOpenImp.classList.add('flex');
      } else {
        btnOpenImp.classList.add('hidden');
        btnOpenImp.classList.remove('flex');
      }
    }

    // Khu vực điều hướng dành riêng cho Owner trong thanh bên Admin Portal
    const ownerNavSection = document.getElementById('admin-nav-owner-section');
    if (ownerNavSection) {
      if (state.realIsOwner) {
        ownerNavSection.classList.remove('hidden');
      } else {
        ownerNavSection.classList.add('hidden');
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
      if (btnGotoStudent) { btnGotoStudent.classList.add('hidden'); btnGotoStudent.classList.remove('flex'); }
      if (btnGotoAdmin) {
        if (state.isAdmin) { btnGotoAdmin.classList.remove('hidden'); btnGotoAdmin.classList.add('flex'); }
        else { btnGotoAdmin.classList.add('hidden'); }
      }
      if (btnGotoAssessment) {
        btnGotoAssessment.classList.add('hidden');
        btnGotoAssessment.classList.remove('flex');
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

    // Automatically hide legacy portal nav row
    const portalNavEl = document.querySelector('.ifa-portal-nav');
    if (portalNavEl) {
      portalNavEl.style.display = 'none';
    }

    // Header is always kept visible across all views (student, supervisor, admin, assessment)
    const headerEl = document.querySelector('header');
    if (headerEl) {
      headerEl.classList.remove('hidden');
    }

  } else {
    userInfoBar.classList.add('hidden');
    userInfoBar.classList.remove('flex');
    btnHeaderLogin.classList.remove('hidden');

    const portalNavEl = document.querySelector('.ifa-portal-nav');
    if (portalNavEl) portalNavEl.style.display = 'none';

    const headerEl = document.querySelector('header');
    if (headerEl) {
      headerEl.classList.remove('hidden');
    }
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

  const headerEl = document.querySelector('header');
  if (headerEl) {
    headerEl.classList.remove('hidden');
  }

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
      if (typeof loadAdminStats === 'function') loadAdminStats();
      else if (window.loadAdminStats) window.loadAdminStats();
    }
  } else if (targetView === 'supervisor') {
    if (typeof initSupervisorPortal === 'function') initSupervisorPortal();
    else if (window.initSupervisorPortal) window.initSupervisorPortal();
  } else if (targetView === 'assessment') {
    if (typeof initAssessmentPortal === 'function') initAssessmentPortal();
    else if (window.initAssessmentPortal) window.initAssessmentPortal();
  } else if (targetView === 'student') {
    const emptyCard = document.getElementById('student-empty-round');
    const targetRound = state.activeRound || (state.rounds || []).find(r => r.id === (state.impersonation?.target?.roundId || state.selectedRoundId)) || (state.rounds || [])[0];

    // In simulation mode (or when testing with an active round), keep student workspace fully open
    if (state.impersonation && targetRound) {
      if (emptyCard) emptyCard.classList.add('hidden');
      const rId = targetRound.id || state.selectedRoundId;
      if (rId) {
        if (typeof selectRound === 'function') await selectRound(rId);
        else if (window.selectRound) await window.selectRound(rId);
      }
      return;
    }

    if (!targetRound) {
      // Only show empty state if rounds have actually loaded from Firestore
      if (state.roundsLoaded) {
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
      }
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
        if (typeof renderStudentTimelineWeeks === 'function') {
          setTimeout(() => renderStudentTimelineWeeks(), 50);
        }
        updateStudentPersonalSidebar();
      }
    }
  }
};



// --- DATA INITIALIZATION ---

async function loadInitialData() {
  await Promise.allSettled([
    loadProjectTypes(),
    loadRounds(),
    (typeof ensureSupervisorsMasterLoaded === 'function' ? ensureSupervisorsMasterLoaded() : (window.ensureSupervisorsMasterLoaded ? window.ensureSupervisorsMasterLoaded() : Promise.resolve()))
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
  const container = document.getElementById('project-types-checkbox-list');
  if (!container) return;
  const rawTypes = (state.projectTypes && state.projectTypes.length > 0)
    ? state.projectTypes.filter(p => p.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0))
    : DEFAULT_PROJECT_TYPES.map((name, i) => ({ name, order: i + 1 }));

  // De-duplicate by normalized name (preserving stable order)
  const seen = new Set();
  const activeTypes = [];
  for (const item of rawTypes) {
    const key = (item.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    activeTypes.push(item);
  }

  // Split into 2 columns: column 1 (e.g. 1-6) and column 2 (e.g. 7-11)
  const mid = Math.ceil(activeTypes.length / 2);
  const col1 = activeTypes.slice(0, mid);
  const col2 = activeTypes.slice(mid);

  const renderItem = (p) => `
    <label class="flex items-start gap-2.5 p-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 cursor-pointer transition-colors shadow-2xs">
      <input type="checkbox" class="project-type-checkbox mt-0.5 h-4 w-4 accent-blue-600 cursor-pointer" value="${escapeHtml(p.name)}" onchange="handleProjectTypeSelection(this)">
      <span class="text-xs font-semibold text-slate-700 leading-snug">${escapeHtml(p.name)}</span>
    </label>
  `;

  container.className = "grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl";
  container.innerHTML = `
    <div class="flex flex-col gap-2">
      ${col1.map(renderItem).join('')}
    </div>
    <div class="flex flex-col gap-2">
      ${col2.map(renderItem).join('')}
    </div>
  `;

  setSelectedProjectTypes(parseStoredProjectTypes(document.getElementById('select-project-type')?.value || ''));
}

function parseStoredProjectTypes(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean).slice(0, 3);
  return String(value || '').split(/\s*[;|]\s*/).map(v => v.trim()).filter(Boolean).slice(0, 3);
}

function getSelectedProjectTypes() {
  return Array.from(document.querySelectorAll('.project-type-checkbox:checked')).map(el => el.value).slice(0, 3);
}

function syncProjectTypesHiddenInput() {
  const hidden = document.getElementById('select-project-type');
  if (hidden) hidden.value = getSelectedProjectTypes().join('; ');
  const hasOther = getSelectedProjectTypes().includes('Khác');
  document.getElementById('project-type-other-wrap')?.classList.toggle('hidden', !hasOther);
  if (!hasOther) {
    const other = document.getElementById('input-project-type-other');
    if (other) other.value = '';
  }
}

function setSelectedProjectTypes(values, otherValue = '') {
  const selected = new Set(parseStoredProjectTypes(values));
  document.querySelectorAll('.project-type-checkbox').forEach(el => { el.checked = selected.has(el.value); });
  const other = document.getElementById('input-project-type-other');
  if (other) other.value = otherValue || '';
  syncProjectTypesHiddenInput();
}

window.handleProjectTypeSelection = function(changed) {
  const allChecked = Array.from(document.querySelectorAll('.project-type-checkbox:checked'));
  if (allChecked.length > 3) {
    changed.checked = false;
    showToast('Mỗi đề tài được chọn tối đa 3 loại hình.', 'warning');
  }
  const checked = getSelectedProjectTypes();
  if (checked.length >= 3) {
    document.querySelectorAll('.project-type-checkbox:not(:checked)').forEach(el => { el.disabled = true; });
  } else {
    document.querySelectorAll('.project-type-checkbox').forEach(el => { el.disabled = false; });
  }
  syncProjectTypesHiddenInput();
  const error = document.getElementById('project-types-error');
  if (error) error.classList.add('hidden');
};

window.renderProjectTypesDropdown = renderProjectTypesDropdown;
// Initial populate of dropdown
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderProjectTypesDropdown);
} else {
  renderProjectTypesDropdown();
}


// --- ROUNDS MANAGEMENT ---

// --- AUTH BUTTONS BINDING ---
document.getElementById('btn-login-main')?.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    showToast('Đăng nhập Google thất bại: ' + err.message, 'error');
  }
});

document.getElementById('btn-header-login')?.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    showToast('Đăng nhập Google thất bại: ' + err.message, 'error');
  }
});

document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

document.getElementById('input-topic-title')?.addEventListener('input', e => {
  const len = e.target.value.length;
  document.getElementById('topic-char-count').textContent = `${len}/250`;
});

// Start application
if (typeof initFirebase === 'function') {
  initFirebase().then(() => {
    setupAuthListener();
  });
}

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof isSystemOwner !== 'undefined') window.isSystemOwner = isSystemOwner;
  if (typeof evaluateAccountDomainAndRole !== 'undefined') window.evaluateAccountDomainAndRole = evaluateAccountDomainAndRole;
  if (typeof clearStudentSessionAndState !== 'undefined') window.clearStudentSessionAndState = clearStudentSessionAndState;
  if (typeof setupAuthListener !== 'undefined') window.setupAuthListener = setupAuthListener;
  if (typeof resolveActualRoles !== 'undefined') window.resolveActualRoles = resolveActualRoles;
  if (typeof updateAuthUI !== 'undefined') window.updateAuthUI = updateAuthUI;
  if (typeof loadInitialData !== 'undefined') window.loadInitialData = loadInitialData;
  if (typeof loadProjectTypes !== 'undefined') window.loadProjectTypes = loadProjectTypes;
  if (typeof bootstrapProjectTypesIfNeeded !== 'undefined') window.bootstrapProjectTypesIfNeeded = bootstrapProjectTypesIfNeeded;
  if (typeof renderProjectTypesDropdown !== 'undefined') window.renderProjectTypesDropdown = renderProjectTypesDropdown;
  if (typeof parseStoredProjectTypes !== 'undefined') window.parseStoredProjectTypes = parseStoredProjectTypes;
  if (typeof getSelectedProjectTypes !== 'undefined') window.getSelectedProjectTypes = getSelectedProjectTypes;
  if (typeof syncProjectTypesHiddenInput !== 'undefined') window.syncProjectTypesHiddenInput = syncProjectTypesHiddenInput;
  if (typeof setSelectedProjectTypes !== 'undefined') window.setSelectedProjectTypes = setSelectedProjectTypes;
}
