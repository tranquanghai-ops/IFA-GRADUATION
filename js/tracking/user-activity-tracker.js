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

/**
 * Open Student Activity History Modal (Nhóm C / P3)
 * Displays up to 10 most recent real historical events:
 * - Login & authentication sessions
 * - Submission & upload actions across activities
 * - Topic registration & proposal updates
 * - Review and grading notices
 */
export async function openStudentActivityHistoryModal(studentId) {
  if (!studentId) return;
  const sid = String(studentId).trim().toUpperCase();

  const modal = document.getElementById('modal-student-activity-history');
  if (!modal) return;

  const master = (typeof window.getFacultyStudentByMssv === 'function') ? window.getFacultyStudentByMssv(sid) : null;
  const eligibleItem = (state.eligibleStudents || []).find(s => String(s.studentId || s.mssv || s.id).trim().toUpperCase() === sid);
  const fullName = master?.fullName || master?.name || eligibleItem?.name || eligibleItem?.fullName || sid;
  const className = master?.className || eligibleItem?.className || eligibleItem?.studentClass || '--';
  const major = master?.major || eligibleItem?.major || 'Thiết kế Nội thất';
  const email = master?.email || eligibleItem?.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`;

  const subtitleEl = document.getElementById('student-activity-history-subtitle');
  const nameEl = document.getElementById('student-activity-info-name');
  const mssvEl = document.getElementById('student-activity-info-mssv');
  const classMajorEl = document.getElementById('student-activity-info-class-major');
  const loginPillEl = document.getElementById('student-activity-info-login-pill');
  const timelineEl = document.getElementById('student-activity-history-timeline');
  const countBadgeEl = document.getElementById('student-activity-history-count-badge');

  if (subtitleEl) subtitleEl.textContent = `MSSV: ${sid} • Lớp: ${className}`;
  if (nameEl) nameEl.textContent = fullName;
  if (mssvEl) mssvEl.textContent = sid;
  if (classMajorEl) classMajorEl.textContent = `Lớp: ${className} • Ngành: ${major}`;

  if (loginPillEl) {
    loginPillEl.innerHTML = renderUserActivityBadge(sid, { compact: true });
  }

  if (timelineEl) {
    timelineEl.innerHTML = `
      <div class="p-8 text-center text-slate-400 font-medium text-xs flex flex-col items-center justify-center gap-2">
        <span class="animate-spin text-lg">⏳</span>
        <span>Đang tổng hợp lịch sử hoạt động thực tế...</span>
      </div>
    `;
  }

  modal.classList.remove('hidden');

  try {
    const events = [];

    // 1. User login & active session from userActivities
    const actInfo = getUserActivityInfo(sid) || getUserActivityInfo(email);
    if (actInfo.hasLoggedIn && actInfo.raw) {
      const raw = actInfo.raw;
      if (raw.lastLoginAt) {
        events.push({
          type: 'login',
          title: 'Đăng nhập hệ thống',
          details: 'Phiên làm việc xác thực qua Google Workspace TDTU',
          timestamp: raw.lastLoginAt,
          icon: '🔑',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        });
      }
      if (raw.lastActionAt && raw.lastAction && String(raw.lastAction) !== 'Đăng nhập hệ thống') {
        events.push({
          type: 'action',
          title: raw.lastAction,
          details: raw.lastActionDetails || 'Thao tác nghiệp vụ trên hệ thống',
          timestamp: raw.lastActionAt,
          icon: '⚡',
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        });
      }
    }

    // 2. Registrations & Topic Proposals
    const targetRoundId = state.selectedRoundId || state.activeRound?.id;
    if (targetRoundId) {
      const reg = state.eligibleStudentDetails?.registrations?.get(sid);
      if (reg) {
        if (reg.registeredAt || reg.createdAt) {
          events.push({
            type: 'topic_registration',
            title: 'Đăng ký đề tài tốt nghiệp',
            details: `Đề tài: "${reg.topicTitle || 'Chưa đặt tên'}"${reg.acceptedSupervisorName ? ' • GVHD: ' + reg.acceptedSupervisorName : ''}`,
            timestamp: reg.registeredAt || reg.createdAt,
            icon: '📝',
            badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
          });
        }
        if (Array.isArray(reg.topicTitleHistory)) {
          reg.topicTitleHistory.forEach(v => {
            const vStatus = v.status === 'approved' ? '✓ Đã duyệt' : (v.status === 'rejected' ? '✕ Yêu cầu sửa' : '⏳ Chờ duyệt');
            events.push({
              type: 'topic_proposal',
              title: `Đề xuất đổi tên đề tài (Lần ${v.version || 1})`,
              details: `"${v.topicTitle}" • Trạng thái: ${vStatus}${v.reviewNote ? ' (Ghi chú: ' + v.reviewNote + ')' : ''}`,
              timestamp: v.proposedAt || v.submittedAt || v.createdAt || reg.updatedAt,
              icon: '💡',
              badgeClass: v.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            });
          });
        }
      }
    }

    // 3. Submissions & Drive Files
    const dbObj = (typeof window !== 'undefined') ? (window.db || (typeof db !== 'undefined' ? db : null)) : null;
    const getDocsFn = (typeof window !== 'undefined') ? (window.getDocs || (typeof getDocs !== 'undefined' ? getDocs : null)) : null;
    const queryFn = (typeof window !== 'undefined') ? (window.query || (typeof query !== 'undefined' ? query : null)) : null;
    const colFn = (typeof window !== 'undefined') ? (window.collection || (typeof collection !== 'undefined' ? collection : null)) : null;
    const whereFn = (typeof window !== 'undefined') ? (window.where || (typeof where !== 'undefined' ? where : null)) : null;

    if (dbObj && getDocsFn && queryFn && colFn && whereFn) {
      try {
        const driveSnap = await getDocsFn(queryFn(colFn(dbObj, 'driveFiles'), whereFn('studentId', '==', sid)));
        driveSnap.docs.forEach(d => {
          const df = d.data();
          const fName = df.fileName || df.name || 'Tài liệu nộp bài';
          const sizeMb = df.fileSize ? ` (${(df.fileSize / (1024 * 1024)).toFixed(2)} MB)` : '';
          events.push({
            type: 'submission',
            title: `Nộp bài mốc: ${df.activityTitle || df.activityId || 'Duyệt đồ án'}`,
            details: `File: "${fName}"${sizeMb}${df.attemptNumber ? ' • Lần nộp ' + df.attemptNumber : ''}`,
            timestamp: df.createdAt || df.uploadedAt,
            icon: '📤',
            badgeClass: 'bg-purple-50 text-purple-700 border-purple-200'
          });
        });
      } catch (err) {
        console.warn('[UserTracker] Notice fetching driveFiles for history:', err.message);
      }
    }

    // Normalize timestamps and sort descending
    const toMs = ts => {
      if (!ts) return 0;
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts.toDate === 'function') return ts.toDate().getTime();
      if (ts instanceof Date) return ts.getTime();
      const parsed = new Date(ts).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };

    events.sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp));

    // Dedup identical titles within 5 seconds
    const deduped = [];
    events.forEach(e => {
      const ms = toMs(e.timestamp);
      const isDuplicate = deduped.some(prev => prev.title === e.title && Math.abs(toMs(prev.timestamp) - ms) < 5000);
      if (!isDuplicate) deduped.push(e);
    });

    const top10 = deduped.slice(0, 10);

    if (countBadgeEl) {
      countBadgeEl.textContent = `${top10.length} hoạt động gần nhất`;
    }

    if (!timelineEl) return;

    if (top10.length === 0) {
      timelineEl.innerHTML = `
        <div class="p-8 text-center text-slate-400 font-medium text-xs">
          Chưa ghi nhận hoạt động nào của sinh viên này trong hệ thống.
        </div>
      `;
      return;
    }

    timelineEl.innerHTML = top10.map((item, idx) => {
      const dateStr = formatActivityDateTime(item.timestamp);
      const timeAgo = formatActivityTimeAgo(item.timestamp);
      const escape = (typeof escapeHtml === 'function') ? escapeHtml : (str => String(str || '').replace(/[&<>"']/g, ''));

      return `
        <div class="p-3 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-all shadow-2xs flex items-start gap-3 text-xs">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${item.badgeClass} text-sm">
            ${item.icon || '📌'}
          </div>
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-slate-900 truncate">${escape(item.title)}</span>
              <span class="text-[10px] text-slate-400 font-medium whitespace-nowrap shrink-0">${timeAgo}</span>
            </div>
            <p class="text-[11px] text-slate-600 leading-relaxed">${escape(item.details)}</p>
            <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 pt-0.5">
              <span>🕒</span> <span>${dateStr}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('[UserTracker] Error loading student activity history:', err);
    if (timelineEl) {
      timelineEl.innerHTML = `
        <div class="p-8 text-center text-rose-500 font-medium text-xs">
          Lỗi khi tải lịch sử hoạt động: ${err.message}
        </div>
      `;
    }
  }
}

export function closeStudentActivityHistoryModal() {
  const modal = document.getElementById('modal-student-activity-history');
  if (modal) modal.classList.add('hidden');
}

window.openStudentActivityHistoryModal = openStudentActivityHistoryModal;
window.closeStudentActivityHistoryModal = closeStudentActivityHistoryModal;
