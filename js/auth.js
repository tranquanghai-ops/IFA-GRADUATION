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
            new Promise(r => setTimeout(r, 10000))
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
    const effectiveEmail = isImp ? (target.email || '') : (state.user.email || '');
    const userEmail = document.getElementById('user-email');
    if (userEmail) userEmail.textContent = effectiveEmail;
    document.getElementById('user-avatar').src = (isImp && (target.photoURL || target.photoUrl)) || state.user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%2364748b"/><path fill="%2364748b" d="M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z"/></svg>';

    // Keep portal access controls in the dedicated navigation row below the header.
    const portalNavigation = document.getElementById('portal-navigation');
    ['btn-goto-admin', 'btn-goto-supervisor', 'btn-goto-student', 'btn-goto-assessment', 'btn-open-impersonate']
      .forEach(id => {
        const control = document.getElementById(id);
        if (portalNavigation && control && control.parentElement !== portalNavigation) portalNavigation.appendChild(control);
      });
    
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

    // Automatically hide portal nav row if empty or all items hidden
    const portalNavEl = document.querySelector('.ifa-portal-nav');
    if (portalNavEl) {
      const hasVisibleNav = Array.from(portalNavigation?.children || []).some(el => !el.classList.contains('hidden') && el.style.display !== 'none');
      portalNavEl.style.display = hasVisibleNav ? '' : 'none';
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
      loadAdminStats();
    }
  } else if (targetView === 'supervisor') {
    initSupervisorPortal();
  } else if (targetView === 'assessment') {
    initAssessmentPortal();
  } else if (targetView === 'student') {
    const emptyCard = document.getElementById('student-empty-round');
    const targetRound = state.activeRound || (state.rounds || []).find(r => r.id === (state.impersonation?.target?.roundId || state.selectedRoundId)) || (state.rounds || [])[0];

    // In simulation mode (or when testing with an active round), keep student workspace fully open
    if (state.impersonation && targetRound) {
      if (emptyCard) emptyCard.classList.add('hidden');
      const rId = targetRound.id || state.selectedRoundId;
      if (rId) {
        await selectRound(rId);
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
  const container = document.getElementById('project-types-checkbox-list');
  if (!container) return;
  const activeTypes = (state.projectTypes && state.projectTypes.length > 0)
    ? state.projectTypes.filter(p => p.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0))
    : DEFAULT_PROJECT_TYPES.map((name, i) => ({ name, order: i + 1 }));

  container.innerHTML = activeTypes.map(p => `
    <label class="flex items-start gap-2.5 p-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 cursor-pointer transition-colors">
      <input type="checkbox" class="project-type-checkbox mt-0.5 h-4 w-4 accent-blue-600" value="${escapeHtml(p.name)}" onchange="handleProjectTypeSelection(this)">
      <span class="text-xs font-semibold text-slate-700 leading-snug">${escapeHtml(p.name)}</span>
    </label>
  `).join('');
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


// Global window bridges for cross-module accessibility
window.setupAuthListener = setupAuthListener;
window.loadInitialData = loadInitialData;
window.loadProjectTypes = loadProjectTypes;
window.bootstrapProjectTypesIfNeeded = bootstrapProjectTypesIfNeeded;
window.parseStoredProjectTypes = parseStoredProjectTypes;
window.getSelectedProjectTypes = getSelectedProjectTypes;
window.syncProjectTypesHiddenInput = syncProjectTypesHiddenInput;
window.setSelectedProjectTypes = setSelectedProjectTypes;
