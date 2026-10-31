/**
 * IFA+ Graduation — Admin Supervisor Preference Statistics & Detailed Review Popup
 * Provides comprehensive statistics on NV1, NV2, NV3 counts, quota utilization,
 * and an interactive modal listing all applicants per preference rank.
 */
import {
  state,
  filterRoundSupervisorsList,
  extractSupervisorEmailAliases,
  cleanSupervisorDisplayName,
  getSupervisorMasterRecord,
  resolveSupervisorProfile,
  resolveSupervisorName,
  resolveSupervisorDepartment
} from '../core.js';

const escapeHtml = (unsafe) => (typeof window !== 'undefined' && window.escapeHtml ? window.escapeHtml(unsafe) : String(unsafe ?? ''));

// --- Module Level State ---
const statsState = {
  roundId: null,
  isCollapsed: false,
  searchQuery: '',
  quotaFilter: 'all',
  sortBy: 'nv1_desc',
  supervisors: [],
  // Modal Popup State
  activeModalSupId: null,
  activeModalRank: 1,
  modalSearchQuery: '',
  modalStatusFilter: 'all'
};

/**
 * Resets the statistics state when switching rounds or closing.
 */
export function resetSupervisorPreferencesStats(roundId = null) {
  statsState.roundId = roundId;
  statsState.supervisors = [];
  statsState.activeModalSupId = null;
  statsState.activeModalRank = 1;
  statsState.modalSearchQuery = '';
  statsState.modalStatusFilter = 'all';

  const container = document.getElementById('admin-supervisor-preferences-stats-container');
  if (container) {
    container.classList.add('hidden');
  }
  const tbody = document.getElementById('sup-stats-table-tbody');
  if (tbody) {
    tbody.innerHTML = '';
  }
  closeSupervisorPreferenceStudentsModal();
}
window.resetSupervisorPreferencesStats = resetSupervisorPreferencesStats;

/**
 * Main renderer: aggregates NV1, NV2, NV3 and quota metrics for all participating supervisors.
 */
export function renderAdminSupervisorPreferencesStats(roundId, data = {}) {
  const container = document.getElementById('admin-supervisor-preferences-stats-container');
  if (!container) return;

  statsState.roundId = roundId;
  const round = (state.rounds || []).find(r => r.id === roundId) || state.activeRound || {};
  const directAssignment = (typeof window.isDirectSupervisorAssignment === 'function')
    ? window.isDirectSupervisorAssignment(round)
    : (round.supervisorAssignmentMode === 'direct_assignment');

  // Input data sources
  const rawSupervisors = data.supervisors || [];
  const filteredSupervisors = (typeof filterRoundSupervisorsList === 'function')
    ? filterRoundSupervisorsList(rawSupervisors)
    : (typeof window.filterRoundSupervisorsList === 'function' ? window.filterRoundSupervisorsList(rawSupervisors) : rawSupervisors);
  const roundSupervisors = Array.isArray(filteredSupervisors) ? filteredSupervisors : [];
  const registrationsMap = data.registrations instanceof Map ? data.registrations : new Map(Object.entries(data.registrations || {}));
  const assignmentsMap = data.assignments instanceof Map ? data.assignments : new Map(Object.entries(data.assignments || {}));
  const draftsMap = data.drafts instanceof Map ? data.drafts : new Map(Object.entries(data.drafts || {}));
  const decisions = data.decisions || [];

  // Check if round has preference matching or if registrations contain preferences
  const registrationsList = Array.from(registrationsMap.values());
  const hasAnyPreferences = registrationsList.some(r => Array.isArray(r.preferences) && r.preferences.length > 0);

  // If this round uses direct faculty assignment with ZERO preferences, keep hidden or minimal
  if (directAssignment && !hasAnyPreferences && roundSupervisors.length === 0) {
    container.classList.add('hidden');
    return;
  }

  // 1. Build initial supervisor map from round supervisors with robust SSOT deduplication
  const supMap = new Map();
  const aliasToCanonicalMap = new Map();

  roundSupervisors.forEach(s => {
    if (!s || typeof s !== 'object') return;
    if (s.isAuthIndex === true) return; // Explicit auth-index doc is never a separate supervisor row

    const master = (typeof resolveSupervisorProfile === 'function')
      ? resolveSupervisorProfile(s.supervisorId || s.id || s.email, s)
      : (typeof window.resolveSupervisorProfile === 'function' ? window.resolveSupervisorProfile(s.supervisorId || s.id || s.email, s) : s);

    // Determine canonical stable ID: prefer non-email master ID, else non-email supervisorId, else s.id
    let canonicalId = '';
    if (master && master.id && !master.id.includes('@')) {
      canonicalId = String(master.id).trim();
    } else if (s.supervisorId && !s.supervisorId.includes('@')) {
      canonicalId = String(s.supervisorId).trim();
    } else if (s.id && !s.id.includes('@')) {
      canonicalId = String(s.id).trim();
    } else {
      canonicalId = String(master?.id || s.supervisorId || s.id || '').trim();
    }
    if (!canonicalId) return;

    // Collect all associated IDs
    const docIds = [canonicalId, s.id, s.supervisorId, master?.id].filter(Boolean).map(x => String(x).trim());

    // Collect all associated email aliases
    const emails = new Set();
    if (typeof extractSupervisorEmailAliases === 'function') {
      extractSupervisorEmailAliases(s).forEach(e => emails.add(e));
      if (master && typeof extractSupervisorEmailAliases === 'function') extractSupervisorEmailAliases(master).forEach(e => emails.add(e));
    }
    if (s.email) emails.add(String(s.email).toLowerCase().trim());
    if (master?.email) emails.add(String(master.email).toLowerCase().trim());
    if (s.personalEmail) emails.add(String(s.personalEmail).toLowerCase().trim());
    if (s.institutionalEmail) emails.add(String(s.institutionalEmail).toLowerCase().trim());

    const isAdjunct = (master?.employmentType === 'adjunct' || s.employmentType === 'adjunct' || s.capacity === 5 || master?.capacity === 5);
    const capacity = isAdjunct ? 5 : (typeof s.capacity === 'number' ? s.capacity : (typeof master?.capacity === 'number' ? master.capacity : 10));

    if (supMap.has(canonicalId)) {
      // Unify with existing entry: add aliases, preserve adjunct quota 5
      const existing = supMap.get(canonicalId);
      docIds.forEach(id => {
        existing.identityIds.add(id);
        aliasToCanonicalMap.set(id, canonicalId);
      });
      emails.forEach(e => {
        existing.candidateEmails.add(e);
        aliasToCanonicalMap.set(e, canonicalId);
      });
      if (isAdjunct || s.capacity === 5) {
        existing.capacity = 5;
        existing.remainingQuota = Math.max(0, 5 - existing.acceptedCount);
        existing.employmentType = 'adjunct';
      }
      return;
    }

    const cleanName = (typeof resolveSupervisorName === 'function')
      ? resolveSupervisorName(canonicalId, master?.name || s.name)
      : (typeof window.resolveSupervisorName === 'function' ? window.resolveSupervisorName(canonicalId, master?.name || s.name) : (master?.name || s.name || canonicalId));

    const cleanDept = (typeof resolveSupervisorDepartment === 'function')
      ? resolveSupervisorDepartment(canonicalId, master?.department || s.department)
      : (typeof window.resolveSupervisorDepartment === 'function' ? window.resolveSupervisorDepartment(canonicalId, master?.department || s.department) : (master?.department || s.department || '--'));

    const identityIds = new Set(docIds);
    const candidateEmails = new Set(emails);

    docIds.forEach(id => aliasToCanonicalMap.set(id, canonicalId));
    emails.forEach(e => aliasToCanonicalMap.set(e, canonicalId));

    supMap.set(canonicalId, {
      supervisorId: canonicalId,
      rawSupervisor: s,
      masterProfile: master,
      displayName: cleanName,
      department: cleanDept,
      email: (master?.email || s.email || '').toLowerCase().trim(),
      employmentType: isAdjunct ? 'adjunct' : (master?.employmentType || s.employmentType || 'regular'),
      capacity,
      acceptedCount: 0,
      remainingQuota: capacity,
      nv1Count: 0,
      nv2Count: 0,
      nv3Count: 0,
      totalCount: 0,
      studentsByRank: { 1: [], 2: [], 3: [] },
      studentIdSets: { 1: new Set(), 2: new Set(), 3: new Set() },
      identityIds,
      candidateEmails
    });
  });

  // Target supervisor resolver that bridges stable IDs, email aliases, and Master records
  function resolveTargetSupervisor(refId, refEmail) {
    if (refId) {
      const sId = String(refId).trim();
      const canonicalKey = aliasToCanonicalMap.get(sId);
      if (canonicalKey && supMap.has(canonicalKey)) return supMap.get(canonicalKey);
      if (supMap.has(sId)) return supMap.get(sId);
      if (typeof getSupervisorMasterRecord === 'function') {
        const m = getSupervisorMasterRecord(sId);
        if (m && supMap.has(m.id)) return supMap.get(m.id);
      }
      for (const sup of supMap.values()) {
        if (sup.identityIds && sup.identityIds.has(sId)) return sup;
        if (sup.supervisorId === sId || sup.rawSupervisor?.id === sId) return sup;
      }
    }
    if (refEmail) {
      const sEmail = String(refEmail).toLowerCase().trim();
      const canonicalKey = aliasToCanonicalMap.get(sEmail);
      if (canonicalKey && supMap.has(canonicalKey)) return supMap.get(canonicalKey);
      for (const sup of supMap.values()) {
        if (sup.candidateEmails && sup.candidateEmails.has(sEmail)) return sup;
        if (sup.email && sup.email === sEmail) return sup;
      }
      if (typeof getSupervisorMasterRecord === 'function') {
        const m = getSupervisorMasterRecord(refEmail);
        if (m && supMap.has(m.id)) return supMap.get(m.id);
      }
    }
    return null;
  }

  // 2. Count registered preferences across valid student submissions
  registrationsList.forEach(reg => {
    // Exclude drafts, cancelled, or records without student ID
    if (reg.draft === true || reg.status === 'cancelled' || reg.deleted === true) return;
    const mssv = String(reg.studentId || reg.mssv || reg.id || '').trim().toUpperCase();
    if (!mssv) return;

    const prefs = Array.isArray(reg.preferences) ? reg.preferences : [];
    prefs.forEach(p => {
      const rank = Number(p.rank);
      if (rank !== 1 && rank !== 2 && rank !== 3) return;

      const pSupId = String(p.supervisorId || p.id || '').trim();
      const pEmail = (p.supervisorEmail || p.email || '').toLowerCase().trim();

      const targetSup = resolveTargetSupervisor(pSupId, pEmail);

      // If matched, record preference
      if (targetSup) {
        if (!targetSup.studentIdSets[rank].has(mssv)) {
          targetSup.studentIdSets[rank].add(mssv);
          if (rank === 1) targetSup.nv1Count++;
          else if (rank === 2) targetSup.nv2Count++;
          else if (rank === 3) targetSup.nv3Count++;
          targetSup.totalCount++;

          const studentDetail = buildStudentPreferenceItem({
            mssv,
            rank,
            registration: reg,
            supervisor: targetSup,
            decisions,
            assignments: assignmentsMap,
            drafts: draftsMap,
            round,
            resolveTargetSupervisor
          });
          targetSup.studentsByRank[rank].push(studentDetail);
        }
      }
    });
  });

  // 3. Compute accurate acceptedCount and remainingQuota
  supMap.forEach(sup => {
    const assignedStudents = new Set();

    // A. From officialAssignments & drafts
    for (const [sid, a] of assignmentsMap.entries()) {
      const sups = a.supervisors || [];
      const hasThisSup = sups.some(x => {
        const matched = resolveTargetSupervisor(x.supervisorId || x.id, x.email || x.supervisorEmail);
        return matched && matched.supervisorId === sup.supervisorId;
      }) || (a.acceptedSupervisorId && resolveTargetSupervisor(a.acceptedSupervisorId, null)?.supervisorId === sup.supervisorId);

      if (hasThisSup) {
        assignedStudents.add(sid);
      }
    }
    for (const [sid, d] of draftsMap.entries()) {
      const sups = d.supervisors || [];
      const hasThisSup = sups.some(x => {
        const matched = resolveTargetSupervisor(x.supervisorId || x.id, x.email || x.supervisorEmail);
        return matched && matched.supervisorId === sup.supervisorId;
      }) || (d.acceptedSupervisorId && resolveTargetSupervisor(d.acceptedSupervisorId, null)?.supervisorId === sup.supervisorId);

      if (hasThisSup) {
        assignedStudents.add(sid);
      }
    }

    // B. From accepted reviewStatus in registrations
    registrationsList.forEach(r => {
      const sid = String(r.studentId || r.mssv || r.id || '').trim().toUpperCase();
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') {
        const matched = resolveTargetSupervisor(r.acceptedSupervisorId, null);
        if (matched && matched.supervisorId === sup.supervisorId) {
          assignedStudents.add(sid);
        }
      }
    });

    sup.acceptedCount = assignedStudents.size;
    sup.remainingQuota = Math.max(0, sup.capacity - sup.acceptedCount);
  });

  statsState.supervisors = Array.from(supMap.values());

  // Show container
  container.classList.remove('hidden');

  // Update Mini KPI badges & Summary
  updateSupervisorStatsKPIs();

  // Render the table
  renderSupervisorStatsTable();
}
window.renderAdminSupervisorPreferencesStats = renderAdminSupervisorPreferencesStats;

/**
 * Builds student record details for display in the popup modal.
 */
function buildStudentPreferenceItem({ mssv, rank, registration, supervisor, decisions, assignments, drafts, round, resolveTargetSupervisor }) {
  const master = (typeof window.getFacultyStudentByMssv === 'function')
    ? window.getFacultyStudentByMssv(mssv)
    : null;

  const profStats = (typeof window !== 'undefined' && typeof window.resolveStudentProfile === 'function')
    ? window.resolveStudentProfile(mssv, { master, registration })
    : null;
  const fullName = profStats?.fullName || master?.fullName || master?.name || registration.studentName || mssv;
  const className = profStats?.className || master?.className || master?.studentClass || registration.currentClass || registration.studentClass || registration.className || 'Chưa có dữ liệu lớp';
  const major = master?.major || registration.major || 'Thiết kế Nội thất';

  // Topic title
  const officialTopicTitle = (typeof window.getOfficialApprovedTopicTitle === 'function')
    ? window.getOfficialApprovedTopicTitle(registration)
    : (registration.topicTitleVi || registration.topicTitle || registration.topicName || '--');

  const projectType = registration.projectTypeName || registration.projectType || registration.projectTypeId || '--';
  const topicApprovalStatus = registration.topicApprovalStatus || 'pending';

  // Determine Detailed Matching / Assignment Status
  const currentReviewRound = Number(round?.currentReviewRound || 1);
  const supId = supervisor.supervisorId;
  const rawSupId = supervisor.rawSupervisor?.id;

  const matchesCurrentSupervisor = (checkId, checkEmail) => {
    if (!checkId && !checkEmail) return false;
    if (typeof resolveTargetSupervisor === 'function') {
      const target = resolveTargetSupervisor(checkId, checkEmail);
      if (target && target.supervisorId === supId) return true;
    }
    const cId = String(checkId || '').trim();
    if (cId) {
      if (cId === supId || cId === rawSupId) return true;
      if (supervisor.identityIds && supervisor.identityIds.has(cId)) return true;
    }
    const cEmail = String(checkEmail || '').toLowerCase().trim();
    if (cEmail) {
      if (supervisor.email === cEmail) return true;
      if (supervisor.candidateEmails && supervisor.candidateEmails.has(cEmail)) return true;
    }
    return false;
  };

  // Check official assignment
  const assignment = assignments?.get(mssv) || drafts?.get(mssv);
  const isAssignedToThis = assignment?.supervisors?.some(s => matchesCurrentSupervisor(s.supervisorId || s.id, s.email || s.supervisorEmail)) ||
    matchesCurrentSupervisor(assignment?.acceptedSupervisorId, null);

  // Check registration acceptance
  const isAcceptedByThis = (registration.reviewStatus === 'accepted' || registration.reviewStatus === 'manually_assigned') &&
    matchesCurrentSupervisor(registration.acceptedSupervisorId, null);

  const isAcceptedByOther = (registration.reviewStatus === 'accepted' || registration.reviewStatus === 'manually_assigned') &&
    registration.acceptedSupervisorId &&
    !matchesCurrentSupervisor(registration.acceptedSupervisorId, null);

  // Check explicit rejection decision
  const hasRejectedDecision = (decisions || []).some(d =>
    Number(d.round) === rank &&
    matchesCurrentSupervisor(d.supervisorId, d.supervisorEmail) &&
    d.studentId === mssv &&
    d.decision === 'rejected'
  );

  let statusKey = 'waiting';
  let statusBadgeHtml = '';

  if (isAssignedToThis) {
    statusKey = 'assigned';
    statusBadgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">Đã phân công chính thức</span>';
  } else if (isAcceptedByThis) {
    statusKey = 'accepted_this';
    const accRank = registration.acceptedRank ? ` (NV${registration.acceptedRank})` : '';
    statusBadgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ GVHD đã chọn${accRank}</span>`;
  } else if (isAcceptedByOther) {
    statusKey = 'accepted_other';
    const otherRank = registration.acceptedRank || '1';
    let otherName = (typeof window.resolveSupervisorName === 'function')
      ? window.resolveSupervisorName(registration.acceptedSupervisorId, registration.acceptedSupervisorName)
      : registration.acceptedSupervisorName;
    const nameLabel = otherName ? ` (${escapeHtml(otherName)})` : '';
    statusBadgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Được nhận ở NV${otherRank}${nameLabel}</span>`;
  } else if (hasRejectedDecision) {
    statusKey = 'rejected';
    statusBadgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">GVHD không chọn</span>';
  } else if (registration.reviewStatus === 'manual_assignment' || registration.skipNV2Reason === 'both_nv2_nv3_full' || registration.routedToFacultyAssignment === true) {
    statusKey = 'faculty_routed';
    statusBadgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">Khoa phân công</span>';
  } else if (rank < currentReviewRound) {
    statusKey = 'waiting';
    statusBadgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Chuyển sang NV${rank + 1}</span>`;
  } else if (rank === currentReviewRound) {
    statusKey = 'waiting';
    statusBadgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Đang xét NV${rank}</span>`;
  } else {
    statusKey = 'waiting';
    statusBadgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Đã đăng ký (chờ V${rank})</span>`;
  }

  return {
    mssv,
    fullName,
    className,
    major,
    officialTopicTitle,
    projectType,
    topicApprovalStatus,
    statusKey,
    statusBadgeHtml,
    rawRegistration: registration
  };
}

/**
 * Updates top summary and mini KPI chips.
 */
function updateSupervisorStatsKPIs() {
  const sups = statsState.supervisors;
  const totalSups = sups.length;
  let totalNv1 = 0, totalNv2 = 0, totalNv3 = 0;

  sups.forEach(s => {
    totalNv1 += s.nv1Count;
    totalNv2 += s.nv2Count;
    totalNv3 += s.nv3Count;
  });

  const summaryBadge = document.getElementById('sup-stats-summary-badge');
  if (summaryBadge) {
    summaryBadge.textContent = `${totalSups} GVHD`;
  }

  const nv1Chip = document.getElementById('sup-stats-mini-nv1');
  if (nv1Chip) nv1Chip.textContent = `NV1: ${totalNv1}`;

  const nv2Chip = document.getElementById('sup-stats-mini-nv2');
  if (nv2Chip) nv2Chip.textContent = `NV2: ${totalNv2}`;

  const nv3Chip = document.getElementById('sup-stats-mini-nv3');
  if (nv3Chip) nv3Chip.textContent = `NV3: ${totalNv3}`;
}

/**
 * Filters and sorts the supervisor statistics table.
 */
export function renderSupervisorStatsTable() {
  const tbody = document.getElementById('sup-stats-table-tbody');
  if (!tbody) return;

  const query = (statsState.searchQuery || '').toLowerCase().trim();
  const quotaFilter = statsState.quotaFilter || 'all';
  const sortBy = statsState.sortBy || 'nv1_desc';

  // 1. Filter
  let list = statsState.supervisors.filter(s => {
    if (query) {
      const matchName = s.displayName.toLowerCase().includes(query);
      const matchDept = s.department.toLowerCase().includes(query);
      if (!matchName && !matchDept) return false;
    }
    if (quotaFilter === 'available') {
      return s.remainingQuota > 0;
    }
    if (quotaFilter === 'full') {
      return s.remainingQuota === 0;
    }
    return true;
  });

  // 2. Sort
  list.sort((a, b) => {
    if (sortBy === 'nv1_desc') return b.nv1Count - a.nv1Count;
    if (sortBy === 'nv2_desc') return b.nv2Count - a.nv2Count;
    if (sortBy === 'nv3_desc') return b.nv3Count - a.nv3Count;
    if (sortBy === 'total_desc') return b.totalCount - a.totalCount;
    if (sortBy === 'name_asc') return a.displayName.localeCompare(b.displayName, 'vi');
    if (sortBy === 'name_desc') return b.displayName.localeCompare(a.displayName, 'vi');
    return b.nv1Count - a.nv1Count;
  });

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-6 text-center text-slate-400">
          Không tìm thấy giảng viên hướng dẫn phù hợp với bộ lọc.
        </td>
      </tr>
    `;
    return;
  }

  // 3. Render rows
  tbody.innerHTML = list.map((s, idx) => {
    const typeBadge = s.employmentType === 'adjunct'
      ? '<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Thỉnh giảng</span>'
      : '<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Cơ hữu</span>';

    const quotaClass = s.remainingQuota > 0 ? 'text-blue-700 font-extrabold' : 'text-slate-400 font-semibold';

    return `
      <tr class="hover:bg-blue-50/40 transition-colors">
        <td class="p-3 text-center font-mono text-slate-400">${idx + 1}</td>
        <td class="p-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-slate-900">${escapeHtml(s.displayName)}</span>
            ${typeBadge}
          </div>
          <div class="text-[11px] text-slate-500 mt-0.5">
            ${escapeHtml(s.department)}
          </div>
        </td>
        <td class="p-3 text-center">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span title="Chỉ tiêu">Chỉ tiêu: <strong class="text-slate-900">${s.capacity}</strong></span>
            <span class="text-slate-300">|</span>
            <span title="Đã chọn nhận">Nhận: <strong class="text-emerald-700">${s.acceptedCount}</strong></span>
            <span class="text-slate-300">|</span>
            <span title="Chỉ tiêu còn lại">Còn: <strong class="${quotaClass}">${s.remainingQuota}</strong></span>
          </div>
        </td>
        <td class="p-3 text-center">
          <button type="button" onclick="openSupervisorPreferenceStudentsModal('${s.supervisorId}', 1)" class="px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs" title="Bấm để xem danh sách SV chọn NV1">
            <span>NV1:</span>
            <strong class="font-black text-sm">${s.nv1Count}</strong>
          </button>
        </td>
        <td class="p-3 text-center">
          <button type="button" onclick="openSupervisorPreferenceStudentsModal('${s.supervisorId}', 2)" class="px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs" title="Bấm để xem danh sách SV chọn NV2">
            <span>NV2:</span>
            <strong class="font-black text-sm">${s.nv2Count}</strong>
          </button>
        </td>
        <td class="p-3 text-center">
          <button type="button" onclick="openSupervisorPreferenceStudentsModal('${s.supervisorId}', 3)" class="px-3 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs" title="Bấm để xem danh sách SV chọn NV3">
            <span>NV3:</span>
            <strong class="font-black text-sm">${s.nv3Count}</strong>
          </button>
        </td>
        <td class="p-3 text-center font-mono">
          <span class="px-2.5 py-1 rounded-xl text-xs font-black bg-slate-100 text-slate-800 border border-slate-200 inline-block">
            ${s.totalCount}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}
window.renderSupervisorStatsTable = renderSupervisorStatsTable;

/**
 * Collapse / Expand toggle.
 */
export function toggleSupervisorPreferencesStatsCollapse() {
  statsState.isCollapsed = !statsState.isCollapsed;
  const body = document.getElementById('sup-stats-collapsible-body');
  const icon = document.getElementById('sup-stats-toggle-icon');
  const text = document.getElementById('sup-stats-toggle-text');

  if (body) {
    body.classList.toggle('hidden', statsState.isCollapsed);
  }
  if (icon) {
    icon.textContent = statsState.isCollapsed ? '▶' : '▼';
  }
  if (text) {
    text.textContent = statsState.isCollapsed ? 'Mở rộng' : 'Thu gọn';
  }
}
window.toggleSupervisorPreferencesStatsCollapse = toggleSupervisorPreferencesStatsCollapse;

/**
 * Filter handler called from search input and quota filter dropdown.
 */
export function filterSupervisorStatsTable() {
  statsState.searchQuery = document.getElementById('sup-stats-search-input')?.value || '';
  statsState.quotaFilter = document.getElementById('sup-stats-filter-quota')?.value || 'all';
  renderSupervisorStatsTable();
}
window.filterSupervisorStatsTable = filterSupervisorStatsTable;

/**
 * Sort handler called from sort select dropdown.
 */
export function sortSupervisorStatsTable(sortBy) {
  statsState.sortBy = sortBy;
  renderSupervisorStatsTable();
}
window.sortSupervisorStatsTable = sortSupervisorStatsTable;

// ============================================================================
// POPUP MODAL HANDLERS
// ============================================================================

/**
 * Opens the supervisor preference students modal.
 */
export function openSupervisorPreferenceStudentsModal(supervisorId, rank = 1) {
  const sId = String(supervisorId || '').trim();
  const sup = statsState.supervisors.find(s =>
    s.supervisorId === sId ||
    (s.identityIds && s.identityIds.has(sId)) ||
    (s.candidateEmails && s.candidateEmails.has(sId.toLowerCase()))
  );
  if (!sup) {
    console.warn('[SupervisorPreferencesStats] Supervisor not found:', supervisorId);
    return;
  }

  statsState.activeModalSupId = supervisorId;
  statsState.activeModalRank = Number(rank) || 1;
  statsState.modalSearchQuery = '';
  statsState.modalStatusFilter = 'all';

  const modal = document.getElementById('modal-supervisor-preference-students');
  if (!modal) return;

  // Clear modal search & filter inputs
  const searchInput = document.getElementById('sup-pref-modal-search');
  if (searchInput) searchInput.value = '';
  const filterSelect = document.getElementById('sup-pref-modal-filter-status');
  if (filterSelect) filterSelect.value = 'all';

  renderSupervisorPreferenceModalContent();
  modal.classList.remove('hidden');
}
window.openSupervisorPreferenceStudentsModal = openSupervisorPreferenceStudentsModal;

/**
 * Closes the supervisor preference students modal.
 */
export function closeSupervisorPreferenceStudentsModal() {
  const modal = document.getElementById('modal-supervisor-preference-students');
  if (modal) {
    modal.classList.add('hidden');
  }
  statsState.activeModalSupId = null;
}
window.closeSupervisorPreferenceStudentsModal = closeSupervisorPreferenceStudentsModal;

/**
 * Switches between NV1, NV2, NV3 tabs inside the popup modal.
 */
export function switchSupervisorPreferenceModalRank(rank) {
  statsState.activeModalRank = Number(rank) || 1;
  renderSupervisorPreferenceModalContent();
}
window.switchSupervisorPreferenceModalRank = switchSupervisorPreferenceModalRank;

/**
 * Filters the students table inside the modal.
 */
export function filterSupervisorPreferenceModalStudents() {
  statsState.modalSearchQuery = document.getElementById('sup-pref-modal-search')?.value || '';
  statsState.modalStatusFilter = document.getElementById('sup-pref-modal-filter-status')?.value || 'all';
  renderSupervisorPreferenceModalContent();
}
window.filterSupervisorPreferenceModalStudents = filterSupervisorPreferenceModalStudents;

/**
 * Renders the modal title, tabs, and student list table.
 */
function renderSupervisorPreferenceModalContent() {
  const sup = statsState.supervisors.find(s => s.supervisorId === statsState.activeModalSupId);
  if (!sup) return;

  const rank = statsState.activeModalRank;
  const rankLabel = `Nguyện vọng ${rank}`;

  // 1. Header & Subtitle
  const titleEl = document.getElementById('sup-pref-modal-title');
  if (titleEl) {
    titleEl.textContent = sup.displayName;
  }

  const badgeEl = document.getElementById('sup-pref-modal-rank-badge');
  if (badgeEl) {
    badgeEl.textContent = rankLabel;
    badgeEl.className = rank === 1
      ? 'px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200'
      : (rank === 2
        ? 'px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300'
        : 'px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200');
  }

  // 2. Tab counts & Active styling
  [1, 2, 3].forEach(r => {
    const tabCount = document.getElementById(`sup-pref-tab-count-${r}`);
    if (tabCount) tabCount.textContent = sup[`nv${r}Count`] || 0;

    const tabBtn = document.getElementById(`sup-pref-tab-${r}`);
    if (tabBtn) {
      if (r === rank) {
        tabBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-white text-blue-700 shadow-2xs border border-blue-200';
      } else {
        tabBtn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900';
      }
    }
  });

  // 3. Filter Students list for current rank
  const rawList = sup.studentsByRank[rank] || [];
  const searchInputEl = document.getElementById('sup-pref-modal-search');
  const q = ((searchInputEl ? searchInputEl.value : statsState.modalSearchQuery) || '').toLowerCase().trim();
  const filterSelectEl = document.getElementById('sup-pref-modal-filter-status');
  const filterStatus = (filterSelectEl ? filterSelectEl.value : statsState.modalStatusFilter) || 'all';

  const filtered = rawList.filter(st => {
    if (q) {
      const matchMssv = st.mssv.toLowerCase().includes(q);
      const matchName = st.fullName.toLowerCase().includes(q);
      const matchTopic = st.officialTopicTitle.toLowerCase().includes(q);
      if (!matchMssv && !matchName && !matchTopic) return false;
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'waiting' && st.statusKey !== 'waiting') return false;
      if (filterStatus === 'accepted_this' && st.statusKey !== 'accepted_this') return false;
      if (filterStatus === 'accepted_other' && st.statusKey !== 'accepted_other') return false;
      if (filterStatus === 'assigned' && st.statusKey !== 'assigned') return false;
      if (filterStatus === 'rejected' && st.statusKey !== 'rejected') return false;
    }
    return true;
  });

  const subtitleEl = document.getElementById('sup-pref-modal-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `${rawList.length} sinh viên lựa chọn giảng viên ở ${rankLabel}`;
  }

  const footerCountEl = document.getElementById('sup-pref-modal-footer-count');
  if (footerCountEl) {
    footerCountEl.textContent = `Hiển thị: ${filtered.length} / ${rawList.length} sinh viên`;
  }

  const tbody = document.getElementById('sup-pref-modal-tbody');
  const emptyEl = document.getElementById('sup-pref-modal-empty');
  const emptyText = document.getElementById('sup-pref-modal-empty-text');

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (emptyText) {
      emptyText.textContent = rawList.length === 0
        ? `Chưa có sinh viên nào lựa chọn giảng viên ở ${rankLabel}.`
        : 'Không có sinh viên nào phù hợp với bộ lọc hiện tại.';
    }
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  tbody.innerHTML = filtered.map((st, idx) => {
    const topicApprovalBadge = st.topicApprovalStatus === 'approved'
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Đã duyệt</span>'
      : (st.topicApprovalStatus === 'rejected'
        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Không duyệt</span>'
        : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Chờ duyệt</span>');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-800">${escapeHtml(st.mssv)}</td>
        <td class="p-3 font-semibold text-slate-900">${escapeHtml(st.fullName)}</td>
        <td class="p-3 text-slate-600">${escapeHtml(st.className)}</td>
        <td class="p-3 max-w-xs">
          <div class="line-clamp-2 text-slate-800 leading-snug font-medium text-xs" title="${escapeHtml(st.officialTopicTitle)}">
            ${escapeHtml(st.officialTopicTitle)}
          </div>
        </td>
        <td class="p-3 text-slate-600">${escapeHtml(st.projectType)}</td>
        <td class="p-3 text-center">${topicApprovalBadge}</td>
        <td class="p-3 text-center">${st.statusBadgeHtml}</td>
        <td class="p-3 text-center">
          <button type="button" onclick="if(typeof openTopicRegistrationPreviewModal === 'function') openTopicRegistrationPreviewModal('${st.mssv}', false)" class="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer" title="Xem chi tiết phiếu đăng ký đề tài">
            <span>👁️</span>
            <span>Xem</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Window Escape Key Listener for Modal
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && statsState.activeModalSupId) {
      closeSupervisorPreferenceStudentsModal();
    }
  });
}
