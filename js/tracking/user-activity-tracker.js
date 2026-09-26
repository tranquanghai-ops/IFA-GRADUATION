/**
 * IFA+ Graduation — User Login & Activity Tracking Module
 * Tracks last login and last action for Students, Supervisors, Council Members, and Admins.
 */

// Helper to format timestamps to readable Vietnamese datetime
export function formatActivityDateTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Relative time format in Vietnamese
export function formatActivityTimeAgo(ts) {
  if (!ts) return 'Chưa từng đăng nhập';
  const date = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  if (isNaN(date.getTime())) return 'Chưa từng đăng nhập';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay === 1) {
    const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `Hôm qua ${timeStr}`;
  }
  if (diffDay < 7) return `${diffDay} ngày trước`;
  
  return formatActivityDateTime(date);
}

/**
 * Record user login when onAuthStateChanged triggers
 */
export async function recordUserLogin(user) {
  if (!user || !user.email) return;
  // If in impersonation mode, do not overwrite the real user's login document with the target's identity
  if (state.impersonation) return;

  const email = String(user.email).trim().toLowerCase();
  const isStudent = email.endsWith('@student.tdtu.edu.vn');
  const studentMssv = isStudent ? email.split('@')[0].toUpperCase() : '';

  try {
    const docRef = doc(db, 'userActivities', email);
    const payload = {
      email,
      uid: user.uid || '',
      displayName: user.displayName || user.email || '',
      photoURL: user.photoURL || '',
      role: isStudent ? 'student' : (state.isAdmin ? 'admin' : (state.isSupervisor ? 'supervisor' : 'staff')),
      studentMssv,
      lastLoginAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      lastAction: 'Đăng nhập hệ thống',
      lastActionAt: serverTimestamp(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      updatedAt: serverTimestamp()
    };

    await setDoc(docRef, payload, { merge: true });

    // Also update in-memory cache
    if (!state.userActivitiesMap) state.userActivitiesMap = new Map();
    state.userActivitiesMap.set(email, {
      ...payload,
      lastLoginAt: new Date(),
      lastActiveAt: new Date(),
      lastActionAt: new Date()
    });
    if (studentMssv) {
      state.userActivitiesMap.set(studentMssv, state.userActivitiesMap.get(email));
    }
  } catch (err) {
    console.warn('[UserTracker] Notice recording login:', err.message);
  }
}
window.recordUserLogin = recordUserLogin;

let lastTrackedTimestamp = 0;
/**
 * Track user action (e.g. topic registration, rubric grading, submission)
 */
export async function trackUserActivity(actionName, details = {}) {
  const currentUser = state.realUser || (typeof auth !== 'undefined' && auth.currentUser);
  if (!currentUser || !currentUser.email) return;

  const email = String(currentUser.email).trim().toLowerCase();
  const isStudent = email.endsWith('@student.tdtu.edu.vn');
  const studentMssv = isStudent ? email.split('@')[0].toUpperCase() : '';

  // Simple debounce: avoid sending multiple writes within 2 seconds for identical action
  const now = Date.now();
  if (now - lastTrackedTimestamp < 1500) return;
  lastTrackedTimestamp = now;

  try {
    const docRef = doc(db, 'userActivities', email);
    const payload = {
      email,
      lastActiveAt: serverTimestamp(),
      lastAction: actionName,
      lastActionAt: serverTimestamp(),
      lastActionDetails: details.context || details.roundTitle || details.actTitle || '',
      updatedAt: serverTimestamp()
    };

    await setDoc(docRef, payload, { merge: true });

    if (state.userActivitiesMap) {
      const existing = state.userActivitiesMap.get(email) || {};
      const updated = {
        ...existing,
        email,
        studentMssv: studentMssv || existing.studentMssv || '',
        lastActiveAt: new Date(),
        lastAction: actionName,
        lastActionAt: new Date(),
        lastActionDetails: payload.lastActionDetails
      };
      state.userActivitiesMap.set(email, updated);
      if (studentMssv) state.userActivitiesMap.set(studentMssv, updated);
    }
  } catch (err) {
    console.warn('[UserTracker] Notice tracking action:', err.message);
  }
}
window.trackUserActivity = trackUserActivity;

/**
 * Load all user activity records into cache
 */
export async function loadUserActivities(forceReload = false) {
  if (state.userActivitiesMap && !forceReload) {
    return state.userActivitiesMap;
  }

  const map = new Map();
  try {
    const snap = await getDocs(collection(db, 'userActivities'));
    snap.docs.forEach(d => {
      const data = d.data();
      const email = String(data.email || d.id).trim().toLowerCase();
      map.set(email, data);
      if (data.studentMssv) {
        map.set(String(data.studentMssv).trim().toUpperCase(), data);
      }
      // Also map student email prefix
      if (email.endsWith('@student.tdtu.edu.vn')) {
        const mssv = email.split('@')[0].toUpperCase();
        map.set(mssv, data);
      }
    });
    state.userActivitiesMap = map;
  } catch (err) {
    console.warn('[UserTracker] Notice loading user activities:', err.message);
    state.userActivitiesMap = map;
  }
  return map;
}
window.loadUserActivities = loadUserActivities;

/**
 * Look up activity info for a student, supervisor, or council member
 */
export function getUserActivityInfo(identifier) {
  if (!identifier) {
    return { hasLoggedIn: false, statusText: 'Chưa từng đăng nhập', timeAgo: 'Chưa từng đăng nhập', lastAction: '' };
  }

  const clean = String(identifier).trim();
  const lower = clean.toLowerCase();
  const upper = clean.toUpperCase();

  const map = state.userActivitiesMap || new Map();
  let data = map.get(lower) || map.get(upper);

  // If not found and identifier is email with student format
  if (!data && lower.endsWith('@student.tdtu.edu.vn')) {
    const mssv = lower.split('@')[0].toUpperCase();
    data = map.get(mssv);
  } else if (!data && !lower.includes('@')) {
    // If identifier is MSSV
    const studentEmail = `${lower}@student.tdtu.edu.vn`;
    data = map.get(studentEmail);
  }

  if (!data || (!data.lastLoginAt && !data.lastActiveAt)) {
    return {
      hasLoggedIn: false,
      statusText: 'Chưa từng đăng nhập',
      timeAgo: 'Chưa từng đăng nhập',
      formattedDate: '--',
      lastAction: '',
      lastActionDetails: '',
      raw: null
    };
  }

  const activeTs = data.lastActiveAt || data.lastLoginAt;
  return {
    hasLoggedIn: true,
    statusText: 'Đã đăng nhập',
    lastLoginAt: data.lastLoginAt,
    lastActiveAt: data.lastActiveAt,
    timeAgo: formatActivityTimeAgo(activeTs),
    formattedDate: formatActivityDateTime(activeTs),
    lastAction: data.lastAction || 'Đăng nhập hệ thống',
    lastActionDetails: data.lastActionDetails || '',
    displayName: data.displayName || '',
    role: data.role || '',
    raw: data
  };
}
window.getUserActivityInfo = getUserActivityInfo;

/**
 * Render visual badge for table row or card
 */
export function renderUserActivityBadge(identifier, { compact = false, showAction = true } = {}) {
  const info = getUserActivityInfo(identifier);

  if (!info.hasLoggedIn) {
    if (compact) {
      return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Người dùng chưa từng đăng nhập">
        <span class="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
        <span>Chưa đăng nhập</span>
      </span>`;
    }
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Người dùng chưa từng đăng nhập vào hệ thống">
      <span class="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
      <span>Chưa từng đăng nhập</span>
    </span>`;
  }

  if (compact) {
    return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200" title="${info.formattedDate}${info.lastAction ? ' • ' + info.lastAction : ''}">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
      <span>${info.timeAgo}</span>
    </span>`;
  }

  return `
    <div class="inline-flex flex-col text-left align-middle leading-tight">
      <span class="inline-flex items-center gap-1 font-bold text-emerald-800 text-[11px]" title="${info.formattedDate}">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
        <span>${info.timeAgo}</span>
      </span>
      ${showAction && info.lastAction ? `
        <span class="text-[10px] text-slate-500 font-medium truncate max-w-[170px] mt-0.5" title="${info.lastAction}${info.lastActionDetails ? ' (' + info.lastActionDetails + ')' : ''}">
          ${escapeHtml(info.lastAction)}
        </span>
      ` : ''}
    </div>
  `;
}
window.renderUserActivityBadge = renderUserActivityBadge;

/**
 * Open Full Monitoring Modal for a Round
 */
export async function openRoundAccessMonitoringModal(roundId) {
  const targetRoundId = roundId || state.selectedRoundId || state.activeRound?.id;
  if (!targetRoundId) {
    showToast('Vui lòng chọn đợt tốt nghiệp cần giám sát.', 'warning');
    return;
  }

  const round = (state.rounds || []).find(r => r.id === targetRoundId) || state.activeRound;
  showLoading('Đang tổng hợp dữ liệu đăng nhập & hoạt động của đợt...');

  try {
    await loadUserActivities(true);

    // Fetch round students, round supervisors, and council members
    const [elSnap, regSnap, officialSnap, supSnap, actSnap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', targetRoundId, 'eligibleStudents')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'graduationRounds', targetRoundId, 'registrations')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'graduationRounds', targetRoundId, 'officialAssignments')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'graduationRounds', targetRoundId, 'supervisors')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'graduationRounds', targetRoundId, 'activities')).catch(() => ({ docs: [] }))
    ]);

    // 1. Gather all unique students in this round
    const studentMap = new Map();
    elSnap.docs.forEach(d => {
      const sid = String(d.id || d.data().studentId || d.data().mssv || '').trim().toUpperCase();
      if (sid) studentMap.set(sid, { mssv: sid, ...d.data() });
    });
    regSnap.docs.forEach(d => {
      const sid = String(d.id || d.data().studentId || d.data().mssv || '').trim().toUpperCase();
      if (sid && !studentMap.has(sid)) studentMap.set(sid, { mssv: sid, ...d.data() });
    });
    officialSnap.docs.forEach(d => {
      const sid = String(d.id || d.data().studentId || '').trim().toUpperCase();
      if (sid && !studentMap.has(sid)) studentMap.set(sid, { mssv: sid, ...d.data() });
    });

    const studentsList = Array.from(studentMap.values()).map(st => {
      const mssv = st.mssv;
      const master = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(mssv) : null;
      const fullName = (master && !master.notFoundInMaster && master.fullName) ? master.fullName : (st.fullName || st.name || st.studentName || mssv);
      const email = st.email || (master && master.email) || `${mssv.toLowerCase()}@student.tdtu.edu.vn`;
      const className = (master && master.className) || st.className || st.studentClass || '--';
      const actInfo = getUserActivityInfo(email) || getUserActivityInfo(mssv);
      return {
        roleType: 'student',
        roleLabel: 'Sinh viên',
        id: mssv,
        name: fullName,
        email,
        subInfo: `MSSV: ${mssv} • Lớp: ${className}`,
        actInfo
      };
    });

    // 2. Gather all round supervisors
    const supMap = new Map();
    supSnap.docs.forEach(d => {
      const id = d.id;
      const data = d.data();
      const master = (state.supervisorsMaster || []).find(s => s.id === id || s.email === data.email);
      const name = master?.name || data.name || 'GVHD';
      const email = master?.email || data.email || '';
      const dept = master?.department || data.department || 'Khoa MTCN';
      supMap.set(id, {
        roleType: 'supervisor',
        roleLabel: 'GVHD',
        id,
        name,
        email,
        subInfo: `${dept} • Quota: ${data.capacity ?? master?.defaultQuota ?? 10}`,
        actInfo: getUserActivityInfo(email)
      });
    });

    // 3. Gather council members from activities
    const councilMemberMap = new Map();
    actSnap.docs.forEach(d => {
      const act = d.data();
      const councils = act.councils || [];
      councils.forEach(c => {
        const slots = c.membersBySlot || {};
        Object.keys(slots).forEach(slotKey => {
          const m = slots[slotKey];
          if (!m || (!m.memberEmail && !m.memberName)) return;
          const email = String(m.memberEmail || '').trim().toLowerCase();
          const name = m.memberName || m.name || 'Thành viên HĐ';
          const org = m.organization || 'Khoa MTCN';
          const key = email || name;
          if (!councilMemberMap.has(key)) {
            councilMemberMap.set(key, {
              roleType: 'council',
              roleLabel: 'Hội đồng',
              id: m.memberId || key,
              name,
              email,
              subInfo: `HĐ: ${c.name} • ${m.roleTitle || slotKey} (${org})`,
              actInfo: getUserActivityInfo(email)
            });
          }
        });
      });
    });

    const supervisorsList = Array.from(supMap.values());
    const councilMembersList = Array.from(councilMemberMap.values());
    const allActors = [...studentsList, ...supervisorsList, ...councilMembersList];

    state.currentRoundMonitoringData = {
      roundId: targetRoundId,
      roundTitle: round?.title || 'Đợt tốt nghiệp',
      allActors,
      studentsList,
      supervisorsList,
      councilMembersList
    };

    renderRoundAccessMonitoringModal();
    document.getElementById('modal-round-access-monitoring')?.classList.remove('hidden');
  } catch (err) {
    showToast('Lỗi tải dữ liệu giám sát: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}
window.openRoundAccessMonitoringModal = openRoundAccessMonitoringModal;

/**
 * Filter & Render Access Monitoring Modal
 */
export function renderRoundAccessMonitoringModal() {
  const modal = document.getElementById('modal-round-access-monitoring');
  if (!modal || !state.currentRoundMonitoringData) return;

  const { roundTitle, allActors } = state.currentRoundMonitoringData;

  const titleEl = document.getElementById('monitoring-modal-round-title');
  if (titleEl) titleEl.textContent = roundTitle;

  // Compute metrics
  const totalSV = allActors.filter(a => a.roleType === 'student');
  const loggedInSV = totalSV.filter(a => a.actInfo.hasLoggedIn);

  const totalGV = allActors.filter(a => a.roleType === 'supervisor');
  const loggedInGV = totalGV.filter(a => a.actInfo.hasLoggedIn);

  const totalHD = allActors.filter(a => a.roleType === 'council');
  const loggedInHD = totalHD.filter(a => a.actInfo.hasLoggedIn);

  // Update Stat Cards
  const svStat = document.getElementById('mon-stat-sv');
  if (svStat) svStat.innerHTML = `<span class="text-emerald-600 font-bold">${loggedInSV.length}</span> / ${totalSV.length} <span class="text-[10px] text-rose-500 font-semibold">(${totalSV.length - loggedInSV.length} chưa vào)</span>`;

  const gvStat = document.getElementById('mon-stat-gv');
  if (gvStat) gvStat.innerHTML = `<span class="text-emerald-600 font-bold">${loggedInGV.length}</span> / ${totalGV.length} <span class="text-[10px] text-rose-500 font-semibold">(${totalGV.length - loggedInGV.length} chưa vào)</span>`;

  const hdStat = document.getElementById('mon-stat-hd');
  if (hdStat) hdStat.innerHTML = `<span class="text-emerald-600 font-bold">${loggedInHD.length}</span> / ${totalHD.length} <span class="text-[10px] text-rose-500 font-semibold">(${totalHD.length - loggedInHD.length} chưa vào)</span>`;

  filterRoundAccessMonitoringTable();
}
window.renderRoundAccessMonitoringModal = renderRoundAccessMonitoringModal;

export function filterRoundAccessMonitoringTable() {
  const tbody = document.getElementById('monitoring-table-tbody');
  if (!tbody || !state.currentRoundMonitoringData) return;

  const { allActors } = state.currentRoundMonitoringData;
  const roleFilter = document.getElementById('mon-filter-role')?.value || 'all';
  const statusFilter = document.getElementById('mon-filter-status')?.value || 'all';
  const searchQuery = (document.getElementById('mon-search-input')?.value || '').toLowerCase().trim();

  let filtered = allActors.filter(a => {
    // Role filter
    if (roleFilter !== 'all' && a.roleType !== roleFilter) return false;

    // Status filter
    if (statusFilter === 'logged_in' && !a.actInfo.hasLoggedIn) return false;
    if (statusFilter === 'never_logged_in' && a.actInfo.hasLoggedIn) return false;

    // Search query
    if (searchQuery) {
      const matchName = String(a.name || '').toLowerCase().includes(searchQuery);
      const matchEmail = String(a.email || '').toLowerCase().includes(searchQuery);
      const matchSub = String(a.subInfo || '').toLowerCase().includes(searchQuery);
      const matchAction = String(a.actInfo.lastAction || '').toLowerCase().includes(searchQuery);
      if (!matchName && !matchEmail && !matchSub && !matchAction) return false;
    }

    return true;
  });

  const countBadge = document.getElementById('mon-filtered-count');
  if (countBadge) countBadge.textContent = `${filtered.length} tài khoản`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400 font-medium">
          Không tìm thấy người dùng nào phù hợp với bộ lọc hiện tại.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((a, idx) => {
    let roleBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">🎓 Sinh viên</span>';
    if (a.roleType === 'supervisor') {
      roleBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">👨‍🏫 GVHD</span>';
    } else if (a.roleType === 'council') {
      roleBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">🏛️ Hội đồng</span>';
    }

    const info = a.actInfo;
    const loginHtml = info.hasLoggedIn
      ? `
        <div>
          <span class="inline-flex items-center gap-1 font-bold text-emerald-800 text-xs">
            <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>${info.timeAgo}</span>
          </span>
          <span class="text-[10px] text-slate-400 block font-mono mt-0.5">${info.formattedDate}</span>
        </div>
      `
      : `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
          <span>Chưa từng đăng nhập</span>
        </span>
      `;

    const actionHtml = info.hasLoggedIn && info.lastAction
      ? `
        <div>
          <span class="font-bold text-slate-800 text-xs">${escapeHtml(info.lastAction)}</span>
          ${info.lastActionDetails ? `<span class="text-[10px] text-slate-500 block truncate max-w-[220px]">${escapeHtml(info.lastActionDetails)}</span>` : ''}
        </div>
      `
      : `<span class="text-slate-400 italic text-xs">--</span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-bold text-slate-400 font-mono text-[11px]">${idx + 1}</td>
        <td class="p-3 whitespace-nowrap">${roleBadge}</td>
        <td class="p-3">
          <span class="font-bold text-slate-900 block text-xs">${escapeHtml(a.name)}</span>
          <span class="text-[11px] text-slate-500 block">${escapeHtml(a.subInfo)}</span>
        </td>
        <td class="p-3 font-mono text-[11px] text-slate-600">${escapeHtml(a.email || '--')}</td>
        <td class="p-3 whitespace-nowrap">${loginHtml}</td>
        <td class="p-3">${actionHtml}</td>
      </tr>
    `;
  }).join('');
}
window.filterRoundAccessMonitoringTable = filterRoundAccessMonitoringTable;

export function closeRoundAccessMonitoringModal() {
  document.getElementById('modal-round-access-monitoring')?.classList.add('hidden');
}
window.closeRoundAccessMonitoringModal = closeRoundAccessMonitoringModal;

export function exportRoundAccessMonitoringCSV() {
  const data = state.currentRoundMonitoringData;
  if (!data || !data.allActors || data.allActors.length === 0) {
    showToast('Không có dữ liệu để xuất.', 'warning');
    return;
  }

  const headers = ['STT', 'Vai trò', 'Họ và tên', 'Thông tin bổ sung', 'Email', 'Trạng thái đăng nhập', 'Thời gian đăng nhập / Hoạt động cuối', 'Thao tác cuối cùng', 'Chi tiết thao tác'];
  const rows = data.allActors.map((a, idx) => {
    const info = a.actInfo;
    return [
      idx + 1,
      a.roleLabel,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${(a.subInfo || '').replace(/"/g, '""')}"`,
      a.email || '',
      info.hasLoggedIn ? 'Đã đăng nhập' : 'Chưa từng đăng nhập',
      info.hasLoggedIn ? info.formattedDate : '--',
      `"${(info.lastAction || '').replace(/"/g, '""')}"`,
      `"${(info.lastActionDetails || '').replace(/"/g, '""')}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Bao_cao_dang_nhap_${(data.roundTitle || 'dot').replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('✓ Đã xuất file báo cáo đăng nhập & hoạt động thành công!', 'success');
}
window.exportRoundAccessMonitoringCSV = exportRoundAccessMonitoringCSV;
