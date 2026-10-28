/**
 * IFA+ Graduation — Admin Registrations Table & Eligibility Status Sync
 */

/**
 * Shared Topic Approval Resolution
 * Deterministically resolves topic approval status across all Admin panels.
 */
window.resolveStudentTopicApproval = function(reg, published = null, draft = null) {
  const topic = String(
    reg?.topicTitle || reg?.topic || published?.topicTitle || draft?.topicTitle || ''
  ).trim();

  if (!reg && !topic) {
    return {
      status: 'unregistered',
      label: 'Chưa đăng ký',
      badgeHtml: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-300 shrink-0">Chưa đăng ký</span>'
    };
  }

  const approvedVersions = (typeof window.getApprovedTopicVersions === 'function')
    ? (window.getApprovedTopicVersions(reg) || window.getApprovedTopicVersions(published) || [])
    : [];
  const hasApprovedVersion = approvedVersions.length > 0;
  const latestApproved = hasApprovedVersion ? approvedVersions[approvedVersions.length - 1] : null;

  const pendingProposal = (typeof window.getTopicPendingProposal === 'function')
    ? window.getTopicPendingProposal(reg || published)
    : null;

  const explicitStatus = reg?.topicApprovalStatus || reg?.approvalStatus || published?.topicApprovalStatus || draft?.topicApprovalStatus || '';

  if (explicitStatus === 'rejected') {
    return {
      status: 'rejected',
      label: 'Không duyệt (Yêu cầu sửa)',
      badgeHtml: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">✕ Không duyệt (Yêu cầu sửa)</span>'
    };
  }

  if (hasApprovedVersion && pendingProposal) {
    return {
      status: 'approved_with_pending_proposal',
      label: `Đã duyệt (Lần ${latestApproved.version}) · Chờ duyệt Lần ${pendingProposal.version}`,
      badgeHtml: `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">✓ Đã duyệt (Lần ${latestApproved.version})</span> <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">⏳ Chờ duyệt Lần ${pendingProposal.version}</span>`
    };
  }

  if (explicitStatus === 'approved' || hasApprovedVersion) {
    return {
      status: 'approved',
      label: 'Đã duyệt',
      badgeHtml: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">✓ Đã duyệt</span>'
    };
  }

  if (topic) {
    return {
      status: 'pending',
      label: 'Chờ duyệt',
      badgeHtml: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">⏳ Chờ duyệt</span>'
    };
  }

  return {
    status: 'unregistered',
    label: 'Chưa đăng ký',
    badgeHtml: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-300 shrink-0">Chưa đăng ký</span>'
  };
};

// State for sorting supervisor preferences in Admin registrations table
if (typeof state !== 'undefined' && !state.regSortState) {
  state.regSortState = { column: null, direction: 'asc' };
}

window.toggleRegistrationsSort = function(column) {
  if (typeof state === 'undefined') return;
  if (!state.regSortState) {
    state.regSortState = { column: null, direction: 'asc' };
  }
  if (state.regSortState.column === column) {
    state.regSortState.direction = state.regSortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.regSortState.column = column;
    state.regSortState.direction = 'asc';
  }
  filterAdminRegistrationsTable();
};

function sortRegistrationsList(list, sortState) {
  if (!sortState || !sortState.column) return list;
  const rankMap = { nv1: 1, nv2: 2, nv3: 3 };
  const targetRank = rankMap[sortState.column];
  if (!targetRank) return list;

  const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });
  const isAsc = sortState.direction === 'asc';

  return [...list].sort((a, b) => {
    const aPref = (a.preferences || []).find(p => Number(p.rank) === targetRank);
    const bPref = (b.preferences || []).find(p => Number(p.rank) === targetRank);
    const aSup = String(aPref ? (typeof resolveSupervisorName === 'function' ? resolveSupervisorName(aPref.supervisorId || aPref.id || aPref.email, aPref.supervisorName) : (window.resolveSupervisorName ? window.resolveSupervisorName(aPref.supervisorId || aPref.id || aPref.email, aPref.supervisorName) : aPref.supervisorName)) : '').trim();
    const bSup = String(bPref ? (typeof resolveSupervisorName === 'function' ? resolveSupervisorName(bPref.supervisorId || bPref.id || bPref.email, bPref.supervisorName) : (window.resolveSupervisorName ? window.resolveSupervisorName(bPref.supervisorId || bPref.id || bPref.email, bPref.supervisorName) : bPref.supervisorName)) : '').trim();
    const aHas = Boolean(aSup);
    const bHas = Boolean(bSup);

    // Those without supervisor in this preference slot always go to the bottom
    if (!aHas && !bHas) {
      return String(a.studentId || a.mssv || '').localeCompare(String(b.studentId || b.mssv || ''));
    }
    if (!aHas) return 1;
    if (!bHas) return -1;

    // Both have supervisor: compare Vietnamese names
    const comp = collator.compare(aSup, bSup);
    if (comp !== 0) {
      return isAsc ? comp : -comp;
    }

    // Secondary sort: MSSV ascending
    return String(a.studentId || a.mssv || '').localeCompare(String(b.studentId || b.mssv || ''));
  });
}

function updateRegistrationsSortHeaders() {
  const cols = ['nv1', 'nv2', 'nv3'];
  const curCol = (typeof state !== 'undefined' && state.regSortState?.column) || null;
  const curDir = (typeof state !== 'undefined' && state.regSortState?.direction) || 'asc';

  cols.forEach(col => {
    const th = document.getElementById(`th-sort-${col}`);
    const icon = document.getElementById(`sort-icon-${col}`);
    if (!th || !icon) return;

    if (curCol === col) {
      th.classList.add('bg-blue-100/70', 'text-blue-900');
      icon.textContent = curDir === 'asc' ? '↑ A-Z' : '↓ Z-A';
      icon.className = 'text-blue-700 font-extrabold text-[11px] bg-blue-200/60 px-1.5 py-0.5 rounded';
    } else {
      th.classList.remove('bg-blue-100/70', 'text-blue-900');
      icon.textContent = '↕';
      icon.className = 'text-slate-400 group-hover:text-slate-600 text-xs font-mono';
    }
  });
}
window.loadAdminRegistrations = async function(roundId) {
  try {
    const [regSnap, elSnap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', roundId, 'registrations')),
      getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents')),
      (typeof ensureSupervisorsMasterLoaded === 'function' ? ensureSupervisorsMasterLoaded() : Promise.resolve())
    ]);
    if (typeof window.loadUserActivities === 'function') {
      await window.loadUserActivities().catch(() => {});
    }
    const regs = regSnap.docs.map(d => ({ id: d.id, ...d.data(), isRegistered: true, registrationStatus: 'registered' }));
    const regMssvSet = new Set(regs.map(r => String(r.studentId || r.mssv || r.id).trim().toUpperCase()));

    const unregs = elSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(el => {
        const sid = String(el.studentId || el.mssv || el.id).trim().toUpperCase();
        return sid && !regMssvSet.has(sid);
      })
      .map(el => {
        const sid = String(el.studentId || el.mssv || el.id).trim();
        return {
          id: sid,
          studentId: sid,
          studentName: resolveStudentName(sid, el.fullName || el.name || el.studentName || ''),
          email: el.email || `${sid.toLowerCase()}@student.tdtu.edu.vn`,
          topicTitle: '',
          projectType: '',
          preferences: [],
          isRegistered: false,
          registrationStatus: 'unregistered',
          eligibilityStatus: el.eligible !== false ? 'eligible' : 'not_eligible',
          reviewStatus: 'unregistered',
          submittedAt: null
        };
      });

    const combined = [...regs, ...unregs];
    state.currentAdminRegistrations = combined;
    filterAdminRegistrationsTable();
  } catch (e) {
    console.error('Error loading registrations:', e);
  }
};

window.filterAdminRegistrationsTable = function() {
  const typeFilter = document.getElementById('admin-reg-filter-type')?.value || 'all';
  const statusFilter = document.getElementById('admin-reg-filter-status')?.value || 'all';
  const list = state.currentAdminRegistrations || [];

  let filtered = list;

  // Filter by registration status
  if (typeFilter === 'registered') {
    filtered = filtered.filter(r => r.isRegistered);
  } else if (typeFilter === 'unregistered') {
    filtered = filtered.filter(r => !r.isRegistered);
  }

  // Filter by eligibility & self-declaration
  if (statusFilter === 'decl_eligible') {
    filtered = filtered.filter(r => (r.adminReview?.status === 'eligible') || (!r.adminReview && r.eligibilityDeclaration?.status === 'eligible'));
  } else if (statusFilter === 'decl_ineligible') {
    filtered = filtered.filter(r => (r.adminReview?.status === 'ineligible' || r.adminReview?.status === 'pending_documents') || (!r.adminReview && r.eligibilityDeclaration?.status === 'ineligible'));
  } else if (statusFilter === 'decl_undeclared') {
    filtered = filtered.filter(r => !r.adminReview && (!r.eligibilityDeclaration?.status || r.eligibilityDeclaration?.status === 'undeclared'));
  } else if (statusFilter === 'eligible') {
    filtered = filtered.filter(r => r.eligibilityStatus === 'eligible' || (!r.eligibilityStatus && r.status === 'submitted'));
  } else if (statusFilter === 'pending') {
    filtered = filtered.filter(r => r.eligibilityStatus === 'pending');
  } else if (statusFilter === 'not_eligible') {
    filtered = filtered.filter(r => r.eligibilityStatus === 'not_eligible');
  }

  const sorted = sortRegistrationsList(filtered, state.regSortState);
  updateRegistrationsSortHeaders();
  state.lastFilteredRegistrations = sorted;
  renderAdminRegistrationsTable(sorted);
};

function renderAdminRegistrationsTable(list) {
  const tbody = document.getElementById('admin-registrations-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="p-6 text-center text-slate-400 font-medium">Không có sinh viên nào phù hợp bộ lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const getSupName = rank => {
      const p = (r.preferences || []).find(pref => Number(pref.rank) === rank);
      if (!p) return '--';
      const resolved = (typeof resolveSupervisorName === 'function')
        ? resolveSupervisorName(p.supervisorId || p.id || p.email, p.supervisorName || '--')
        : (window.resolveSupervisorName ? window.resolveSupervisorName(p.supervisorId || p.id || p.email, p.supervisorName || '--') : (p.supervisorName || '--'));
      return resolved || '--';
    };
    const subDate = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)) : null;

    const isReg = Boolean(r.isRegistered);
    const regBadge = isReg
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">✓ Đã đăng ký</span>'
      : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">⏳ Chưa đăng ký</span>';

    // Topic approval status
    const topicApproval = window.resolveStudentTopicApproval(r);

    // Self-declaration & Admin verification status
    const decl = r.eligibilityDeclaration || {};
    const adminRev = r.adminReview || null;

    let elBadge = '';
    if (adminRev && adminRev.status) {
      if (adminRev.status === 'eligible') {
        elBadge = `
          <button type="button" onclick="openAdminReviewEligibilityModal('${r.studentId}')" class="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity p-1 rounded hover:bg-slate-100 cursor-pointer text-center mx-auto" title="Khoa đã duyệt: Đủ điều kiện">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-400 shadow-2xs">✓ Đủ ĐK (Khoa)</span>
          </button>
        `;
      } else if (adminRev.status === 'ineligible') {
        const rc = Array.isArray(adminRev.reasons) ? adminRev.reasons.length : 0;
        elBadge = `
          <button type="button" onclick="openAdminReviewEligibilityModal('${r.studentId}')" class="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity p-1 rounded hover:bg-slate-100 cursor-pointer text-center mx-auto" title="Khoa kết luận: Chưa đủ điều kiện (${rc} lý do)">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-400 shadow-2xs">⚠️ Chưa đủ ĐK (Khoa)</span>
          </button>
        `;
      } else if (adminRev.status === 'pending_documents') {
        elBadge = `
          <button type="button" onclick="openAdminReviewEligibilityModal('${r.studentId}')" class="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity p-1 rounded hover:bg-slate-100 cursor-pointer text-center mx-auto" title="Khoa yêu cầu: Cần bổ sung hồ sơ">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-400 shadow-2xs">⏳ Cần bổ sung (Khoa)</span>
          </button>
        `;
      }
    } else if (decl && decl.status) {
      if (decl.status === 'eligible') {
        elBadge = `
          <button type="button" onclick="openAdminReviewEligibilityModal('${r.studentId}')" class="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity p-1 rounded hover:bg-slate-100 cursor-pointer text-center mx-auto" title="Sinh viên tự khai: Đã đủ điều kiện (Chờ Khoa đối soát)">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">✓ Đủ ĐK (SV khai)</span>
          </button>
        `;
      } else if (decl.status === 'ineligible') {
        const rc = Array.isArray(decl.reasons) ? decl.reasons.length : 0;
        elBadge = `
          <button type="button" onclick="openAdminReviewEligibilityModal('${r.studentId}')" class="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity p-1 rounded hover:bg-slate-100 cursor-pointer text-center mx-auto" title="Sinh viên tự khai: Chưa đủ điều kiện (${rc} lý do)">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs">⚠️ Chưa đủ ĐK (SV khai)</span>
          </button>
        `;
      }
    }

    if (!elBadge) {
      elBadge = `
        <button type="button" onclick="openAdminReviewEligibilityModal('${r.studentId}')" class="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity p-1 rounded hover:bg-slate-100 cursor-pointer text-center mx-auto" title="Sinh viên chưa thực hiện khai báo">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300">Chưa khai báo</span>
        </button>
      `;
    }

    let reviewBadge = '<span class="text-slate-400 font-medium text-xs">Chưa nộp</span>';
    if (isReg) {
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') {
        reviewBadge = '<span class="text-emerald-700 font-bold text-xs">✓ Đã tiếp nhận</span>';
      } else if (r.reviewStatus === 'rejected') {
        reviewBadge = '<span class="text-rose-600 font-bold text-xs">Chuyển NV sau</span>';
      } else if (topicApproval.status === 'rejected') {
        reviewBadge = '<span class="text-rose-600 font-bold text-xs">✕ Không duyệt</span>';
      } else if (topicApproval.status === 'approved' || topicApproval.status === 'approved_with_pending_proposal') {
        reviewBadge = '<span class="text-emerald-700 font-bold text-xs">✓ Đã duyệt</span>';
      } else {
        reviewBadge = '<span class="text-slate-600 font-semibold text-xs">Chờ duyệt</span>';
      }
    }

    const activityBadge = typeof window.renderUserActivityBadge === 'function'
      ? window.renderUserActivityBadge(r.studentId)
      : '<span class="text-slate-400 text-xs">--</span>';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5 font-mono font-bold text-slate-900">${escapeHtml(r.studentId)}</td>
        <td class="p-3.5 font-semibold text-slate-800">${escapeHtml(r.studentName || '--')}</td>
        <td class="p-3.5 text-center whitespace-nowrap">${regBadge}</td>
        <td class="p-3.5 max-w-[260px]">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold truncate max-w-[180px] ${isReg ? 'text-blue-900' : 'text-slate-400 italic'}" title="${escapeHtml(r.topicTitle || '')}">${escapeHtml(r.topicTitle || (isReg ? '--' : '(Chưa đăng ký đề tài)'))}</span>
            ${isReg && r.topicTitle ? topicApproval.badgeHtml : ''}
          </div>
        </td>
        <td class="p-3.5 text-slate-600">${escapeHtml(r.projectType || '--')}</td>
        <td class="p-3.5 font-bold text-slate-700">${escapeHtml(getSupName(1))}</td>
        <td class="p-3.5 text-slate-600">${escapeHtml(getSupName(2))}</td>
        <td class="p-3.5 text-slate-600">${escapeHtml(getSupName(3))}</td>
        <td class="p-3.5 text-center">${elBadge}</td>
        <td class="p-3.5 whitespace-nowrap">${reviewBadge}</td>
        <td class="p-3.5 whitespace-nowrap">
          <button type="button" onclick="openStudentActivityHistoryModal('${r.studentId}')" class="text-left group hover:opacity-80 transition-all cursor-pointer p-0 bg-transparent border-0 inline-block" title="Bấm để xem lịch sử 10 thao tác gần nhất">
            ${activityBadge}
          </button>
        </td>
        <td class="p-3.5 text-[11px] text-slate-400 whitespace-nowrap">${subDate ? subDate.toLocaleString('vi-VN') : '--'}</td>
      </tr>
    `;
  }).join('');
}

window.exportRegistrationsCSV = function() {
  const roundId = document.getElementById('admin-round-reg-select')?.value;
  if (!roundId) return;

  const list = state.lastFilteredRegistrations || state.currentAdminRegistrations || [];
  if (list.length === 0) {
    showToast('Không có dữ liệu đăng ký để xuất.', 'warning');
    return;
  }

  const headers = ['MSSV', 'Họ và tên', 'Trạng thái ĐK', 'Email', 'Tên đề tài', 'Loại hình đồ án', 'Nguyện vọng 1', 'Nguyện vọng 2', 'Nguyện vọng 3', 'Điều kiện', 'Trạng thái xét', 'Thời gian nộp'];
  const rows = list.map(r => {
    const getSup = rank => (r.preferences || []).find(p => p.rank === rank)?.supervisorName || '';
    const dt = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)).toLocaleString('vi-VN') : '';
    let elText = 'Đủ điều kiện';
    if (r.eligibilityStatus === 'pending') elText = 'Chờ xét';
    else if (r.eligibilityStatus === 'not_eligible') elText = 'Không đủ điều kiện';

    const topicApproval = window.resolveStudentTopicApproval(r);
    let reviewText = 'Chưa nộp';
    if (r.isRegistered) {
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') {
        reviewText = 'Đã tiếp nhận';
      } else if (r.reviewStatus === 'rejected') {
        reviewText = 'Chuyển NV sau';
      } else if (topicApproval.status === 'rejected') {
        reviewText = 'Không duyệt';
      } else if (topicApproval.status === 'approved' || topicApproval.status === 'approved_with_pending_proposal') {
        reviewText = 'Đã duyệt';
      } else {
        reviewText = 'Chờ duyệt';
      }
    }

    return [
      r.studentId || '',
      r.studentName || '',
      r.isRegistered ? 'Đã đăng ký' : 'Chưa đăng ký',
      r.email || '',
      `"${(r.topicTitle || '').replace(/"/g, '""')}"`,
      `"${(r.projectType || '').replace(/"/g, '""')}"`,
      `"${getSup(1)}"`,
      `"${getSup(2)}"`,
      `"${getSup(3)}"`,
      `"${elText}"`,
      `"${reviewText}"`,
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
// --- CENTRAL STUDENT RESOLVER FOR REGISTRATIONS & REVIEWS ---
// =========================================================================
window.resolveStudentName = function(sid, fallbackName = '') {
  if (!sid) return fallbackName || '--';
  const cleanId = String(sid).trim().toUpperCase();
  const raw = String(fallbackName || '').trim();
  if (raw && raw.toUpperCase() !== cleanId && !raw.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
    return raw;
  }

  // 1. Check eligibleStudents in review data or state
  const eligibleList = state.adminReviewData?.eligible || state.eligibleStudents || [];
  const el = eligibleList.find(e => {
    const eid = String(e.studentId || e.mssv || e.id || '').trim().toUpperCase();
    return eid === cleanId;
  });
  if (el) {
    const elName = String(el.fullName || el.name || el.studentName || '').trim();
    if (elName && elName.toUpperCase() !== cleanId && !elName.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
      return elName;
    }
  }

  // 2. Check IFAA central master lookup
  if (typeof window.getFacultyStudentByMssv === 'function') {
    const fac = window.getFacultyStudentByMssv(cleanId);
    if (fac) {
      const facName = String(fac.fullName || fac.name || '').trim();
      if (facName && facName.toUpperCase() !== cleanId && !facName.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
        return facName;
      }
    }
  }

  // 3. Check in-memory facultyStudents array
  if (Array.isArray(state.facultyStudents) && state.facultyStudents.length > 0) {
    const inFac = state.facultyStudents.find(s => {
      const sId = String(s.mssv || s.studentId || s.studentCode || '').trim().toUpperCase();
      return sId === cleanId;
    });
    if (inFac) {
      const fn = String(inFac.fullName || inFac.name || inFac.hoTen || '').trim();
      if (fn && fn.toUpperCase() !== cleanId && !fn.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
        return fn;
      }
    }
  }

  return raw || cleanId;
};


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

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof removeVietnameseTones !== 'undefined') window.removeVietnameseTones = removeVietnameseTones;
  if (typeof renderRoundModalEligibleTable !== 'undefined') window.renderRoundModalEligibleTable = renderRoundModalEligibleTable;
  if (typeof renderAddEligibleCandidateResults !== 'undefined') window.renderAddEligibleCandidateResults = renderAddEligibleCandidateResults;
  if (typeof updateAddEligibleSelectionUI !== 'undefined') window.updateAddEligibleSelectionUI = updateAddEligibleSelectionUI;
  if (typeof renderAdminEligibleStudentsTable !== 'undefined') window.renderAdminEligibleStudentsTable = renderAdminEligibleStudentsTable;
  if (typeof parseAndValidateExcel !== 'undefined') window.parseAndValidateExcel = parseAndValidateExcel;
  if (typeof renderAdminRegistrationsTable !== 'undefined') window.renderAdminRegistrationsTable = renderAdminRegistrationsTable;
  if (typeof cleanHeader !== 'undefined') window.cleanHeader = cleanHeader;
  if (typeof findKey !== 'undefined') window.findKey = findKey;
  if (typeof getStudentStatus !== 'undefined') window.getStudentStatus = getStudentStatus;
  if (typeof getSupName !== 'undefined') window.getSupName = getSupName;
  if (typeof getSup !== 'undefined') window.getSup = getSup;
}


// ── Admin Eligibility Review & Correction Submodule ─────────────────────────
window.onAdminReviewDecisionChanged = function(decision) {
  const detailsWrap = document.getElementById('admin-edit-details-wrap');
  if (!detailsWrap) return;
  // If confirmed_eligible, Admin can still view/tweak details or collapse it if desired.
  // We keep it visible so Admin has full control to check or clear reasons.
};

window.onAdminIneligibleReasonToggled = function() {
  const checked = Array.from(document.querySelectorAll('input[name="admin-ineligible-reason"]:checked')).map(cb => cb.value);
  const coursesWrap = document.getElementById('admin-missing-courses-wrap');
  const engWrap = document.getElementById('admin-english-notes-wrap');
  const otherWrap = document.getElementById('admin-other-reason-wrap');

  if (coursesWrap) {
    const showCourses = checked.includes('failing_courses') ||
      checked.includes('missing_credits_1_3') ||
      checked.includes('missing_credits_4_6') ||
      checked.includes('missing_credits_7_10');
    coursesWrap.classList.toggle('hidden', !showCourses);
    if (showCourses && checked.includes('failing_courses')) {
      const tbody = document.getElementById('admin-missing-courses-tbody');
      if (tbody && tbody.children.length === 0) {
        window.addAdminMissingCourseRow();
      }
    }
  }

  if (engWrap) {
    const showEng = checked.some(r => r === 'no_english_cert' || r === 'english_waiting_result' || r === 'english_waiting_verification' || r.startsWith('english_'));
    engWrap.classList.toggle('hidden', !showEng);
  }

  if (otherWrap) {
    otherWrap.classList.toggle('hidden', !checked.includes('other'));
  }
};

window.addAdminMissingCourseRow = function(code = '', name = '', credits = '') {
  const tbody = document.getElementById('admin-missing-courses-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'hover:bg-slate-50 transition-colors';
  tr.innerHTML = `
    <td class="p-1.5">
      <input type="text" maxlength="30" placeholder="Mã HP (nếu có)" value="${escapeHtml(code)}" class="admin-missing-course-code w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500">
    </td>
    <td class="p-1.5">
      <input type="text" maxlength="120" placeholder="Tên học phần *" value="${escapeHtml(name)}" class="admin-missing-course-name w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500" required>
    </td>
    <td class="p-1.5">
      <input type="number" min="1" max="15" placeholder="Số TC" value="${escapeHtml(credits)}" class="admin-missing-course-credits w-full p-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
    </td>
    <td class="p-1.5 text-center">
      <button type="button" onclick="window.removeAdminMissingCourseRow(this)" class="text-rose-500 hover:text-rose-700 font-bold p-1 text-sm cursor-pointer" title="Xóa môn này">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
};

window.removeAdminMissingCourseRow = function(btn) {
  const tr = btn?.closest('tr');
  if (tr) tr.remove();
};

window.copyStudentDeclarationToAdminForm = function() {
  const studentId = document.getElementById('admin-modal-el-student-id')?.value;
  const list = state.currentAdminRegistrations || [];
  const r = list.find(item => item.studentId === studentId);
  const decl = r?.eligibilityDeclaration || {};

  if (!decl || !decl.status || decl.status === 'undeclared') {
    showToast('Sinh viên này chưa có bản tự khai để sao chép.', 'info');
    return;
  }

  // Set decision radio
  const targetDecision = decl.status === 'eligible' ? 'confirmed_eligible' : 'confirmed_ineligible';
  const radio = document.querySelector(`input[name="admin-review-decision"][value="${targetDecision}"]`);
  if (radio) {
    radio.checked = true;
    window.onAdminReviewDecisionChanged(targetDecision);
  }

  // Set reasons
  const reasons = Array.isArray(decl.reasons) ? decl.reasons : [];
  const mapped = reasons.map(k => {
    if (k === 'english_not_taken') return 'no_english_cert';
    if (k === 'english_pending_result') return 'english_waiting_result';
    if (k === 'english_pending_verification') return 'english_waiting_verification';
    return k;
  });
  document.querySelectorAll('input[name="admin-ineligible-reason"]').forEach(cb => {
    cb.checked = mapped.includes(cb.value);
  });

  // Set courses
  const tbody = document.getElementById('admin-missing-courses-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (Array.isArray(decl.missingCourses) && decl.missingCourses.length > 0) {
      decl.missingCourses.forEach(c => {
        window.addAdminMissingCourseRow(c.courseCode || '', c.courseName || '', c.credits || '');
      });
    }
  }

  // Set English & other
  const engInput = document.getElementById('admin-modal-el-english-input');
  if (engInput) engInput.value = decl.englishCertificateStatus || '';

  const otherInput = document.getElementById('admin-modal-el-other-input');
  if (otherInput) otherInput.value = decl.otherReason || '';

  window.onAdminIneligibleReasonToggled();
  showToast('✓ Đã sao chép nội dung từ bản tự khai của sinh viên.', 'success');
};

window.openAdminReviewEligibilityModal = function(studentId) {
  const list = state.currentAdminRegistrations || [];
  const r = list.find(item => item.studentId === studentId);
  if (!r) {
    showToast('Không tìm thấy thông tin đăng ký của sinh viên ' + studentId, 'error');
    return;
  }

  const decl = r.eligibilityDeclaration || {};
  const adminRev = r.adminReview || null;

  document.getElementById('admin-modal-el-student-id').value = r.studentId;
  document.getElementById('admin-modal-el-mssv').textContent = r.studentId;
  document.getElementById('admin-modal-el-name').textContent = r.studentName || '--';
  document.getElementById('admin-modal-el-topic').textContent = r.topicTitle || '(Chưa đăng ký đề tài)';

  // 1. Render Section 1: Student Self-Declaration (Read-Only)
  const studentEmptyEl = document.getElementById('admin-modal-el-student-empty');
  const studentContentEl = document.getElementById('admin-modal-el-student-content');
  const badgeEl = document.getElementById('admin-modal-el-decl-badge');

  const reasonNames = {
    wrong_registration: 'Đăng ký nhầm DATN/DATH.',
    no_english_cert: 'Chưa thi hoặc chưa có chứng chỉ tiếng Anh đủ điều kiện.',
    english_waiting_result: 'Đã thi tiếng Anh và đang chờ kết quả.',
    english_waiting_verification: 'Đã có chứng chỉ tiếng Anh nhưng đang chờ xác minh.',
    missing_credits_1_3: 'Thiếu 1–3 tín chỉ.',
    missing_credits_4_6: 'Thiếu 4–6 tín chỉ.',
    missing_credits_7_10: 'Thiếu 7–10 tín chỉ.',
    failing_courses: 'Còn nợ học phần/môn học chưa đạt.',
    other: 'Lý do khác.',
    // Legacy mapping
    english_not_taken: 'Chưa thi hoặc chưa có chứng chỉ tiếng Anh đủ điều kiện.',
    english_pending_result: 'Đã thi tiếng Anh và đang chờ kết quả.',
    english_pending_verification: 'Đã có chứng chỉ tiếng Anh nhưng đang chờ xác minh.'
  };

  const formatTime = (ts) => {
    if (!ts) return '--';
    const d = new Date(ts.toDate ? ts.toDate() : ts);
    return isNaN(d.getTime()) ? '--' : d.toLocaleString('vi-VN');
  };

  if (!decl.status || decl.status === 'undeclared') {
    if (studentEmptyEl) studentEmptyEl.classList.remove('hidden');
    if (studentContentEl) studentContentEl.classList.add('hidden');
    if (badgeEl) badgeEl.innerHTML = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">Chưa khai báo</span>';
  } else {
    if (studentEmptyEl) studentEmptyEl.classList.add('hidden');
    if (studentContentEl) studentContentEl.classList.remove('hidden');
    if (badgeEl) {
      if (decl.status === 'eligible') {
        badgeEl.innerHTML = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã đủ điều kiện</span>';
      } else {
        badgeEl.innerHTML = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">⚠️ Chưa đủ điều kiện</span>';
      }
    }

    document.getElementById('admin-modal-el-decl-time').textContent = formatTime(decl.studentDeclaredAt);
    document.getElementById('admin-modal-el-decl-updated').textContent = formatTime(decl.studentUpdatedAt);

    // Reasons list
    const reasonsWrap = document.getElementById('admin-modal-el-reasons-wrap');
    const reasonsList = document.getElementById('admin-modal-el-reasons-list');
    if (decl.status === 'ineligible' && Array.isArray(decl.reasons) && decl.reasons.length > 0) {
      reasonsList.innerHTML = decl.reasons.map(key => `<li><b>${escapeHtml(reasonNames[key] || key)}</b></li>`).join('');
      reasonsWrap.classList.remove('hidden');
    } else {
      reasonsWrap.classList.add('hidden');
    }

    // Missing courses
    const coursesWrap = document.getElementById('admin-modal-el-courses-wrap');
    const coursesTbody = document.getElementById('admin-modal-el-courses-tbody');
    if (Array.isArray(decl.missingCourses) && decl.missingCourses.length > 0) {
      coursesTbody.innerHTML = decl.missingCourses.map(c => `
        <tr>
          <td class="p-2 font-mono font-bold text-slate-700">${escapeHtml(c.courseCode || '--')}</td>
          <td class="p-2 font-bold text-slate-900">${escapeHtml(c.courseName || '--')}</td>
          <td class="p-2 text-slate-700 font-semibold">${c.credits !== null && c.credits !== undefined ? c.credits : '--'}</td>
        </tr>
      `).join('');
      coursesWrap.classList.remove('hidden');
    } else {
      coursesWrap.classList.add('hidden');
    }

    // English notes
    const engWrap = document.getElementById('admin-modal-el-english-wrap');
    const engNote = document.getElementById('admin-modal-el-english-note');
    if (decl.englishCertificateStatus) {
      engNote.textContent = decl.englishCertificateStatus;
      engWrap.classList.remove('hidden');
    } else {
      engWrap.classList.add('hidden');
    }

    // Other reason
    const otherWrap = document.getElementById('admin-modal-el-other-wrap');
    const otherNote = document.getElementById('admin-modal-el-other-note');
    if (decl.otherReason) {
      otherNote.textContent = decl.otherReason;
      otherWrap.classList.remove('hidden');
    } else {
      otherWrap.classList.add('hidden');
    }
  }

  // 2. Render Section 2: Admin Review & Edit Form
  const adminTbody = document.getElementById('admin-missing-courses-tbody');
  if (adminTbody) adminTbody.innerHTML = '';

  if (adminRev) {
    // Populate from previous Admin Review
    const decisionVal = adminRev.decision || (adminRev.status === 'eligible' ? 'confirmed_eligible' : (adminRev.status === 'ineligible' ? 'confirmed_ineligible' : 'pending_documents'));
    const radio = document.querySelector(`input[name="admin-review-decision"][value="${decisionVal}"]`);
    if (radio) radio.checked = true;

    const reasons = Array.isArray(adminRev.reasons) ? adminRev.reasons : [];
    const mapped = reasons.map(k => {
      if (k === 'english_not_taken') return 'no_english_cert';
      if (k === 'english_pending_result') return 'english_waiting_result';
      if (k === 'english_pending_verification') return 'english_waiting_verification';
      return k;
    });
    document.querySelectorAll('input[name="admin-ineligible-reason"]').forEach(cb => {
      cb.checked = mapped.includes(cb.value);
    });

    if (Array.isArray(adminRev.missingCourses) && adminRev.missingCourses.length > 0) {
      adminRev.missingCourses.forEach(c => {
        window.addAdminMissingCourseRow(c.courseCode || '', c.courseName || '', c.credits || '');
      });
    }

    document.getElementById('admin-modal-el-english-input').value = adminRev.englishCertificateStatus || '';
    document.getElementById('admin-modal-el-other-input').value = adminRev.otherReason || '';
    document.getElementById('admin-modal-el-notes').value = adminRev.adminNote || '';

    // Audit info
    const auditWrap = document.getElementById('admin-modal-el-audit-wrap');
    if (adminRev.reviewedBy) {
      document.getElementById('admin-modal-el-audit-by').textContent = adminRev.reviewedBy;
      document.getElementById('admin-modal-el-audit-at').textContent = formatTime(adminRev.reviewedAt);
      auditWrap.classList.remove('hidden');
    } else {
      auditWrap.classList.add('hidden');
    }
  } else {
    // Initial draft: copy from student if available, else default to confirmed_eligible
    const initialDecision = decl.status === 'ineligible' ? 'confirmed_ineligible' : 'confirmed_eligible';
    const radio = document.querySelector(`input[name="admin-review-decision"][value="${initialDecision}"]`);
    if (radio) radio.checked = true;

    const reasons = Array.isArray(decl.reasons) ? decl.reasons : [];
    const mapped = reasons.map(k => {
      if (k === 'english_not_taken') return 'no_english_cert';
      if (k === 'english_pending_result') return 'english_waiting_result';
      if (k === 'english_pending_verification') return 'english_waiting_verification';
      return k;
    });
    document.querySelectorAll('input[name="admin-ineligible-reason"]').forEach(cb => {
      cb.checked = mapped.includes(cb.value);
    });

    if (Array.isArray(decl.missingCourses) && decl.missingCourses.length > 0) {
      decl.missingCourses.forEach(c => {
        window.addAdminMissingCourseRow(c.courseCode || '', c.courseName || '', c.credits || '');
      });
    }

    document.getElementById('admin-modal-el-english-input').value = decl.englishCertificateStatus || '';
    document.getElementById('admin-modal-el-other-input').value = decl.otherReason || '';
    document.getElementById('admin-modal-el-notes').value = '';

    const auditWrap = document.getElementById('admin-modal-el-audit-wrap');
    if (auditWrap) auditWrap.classList.add('hidden');
  }

  window.onAdminIneligibleReasonToggled();
  document.getElementById('modal-admin-review-eligibility').classList.remove('hidden');
};

window.closeAdminReviewEligibilityModal = function() {
  document.getElementById('modal-admin-review-eligibility')?.classList.add('hidden');
};

window.saveAdminEligibilityReview = async function() {
  const studentId = document.getElementById('admin-modal-el-student-id')?.value;
  const roundId = document.getElementById('admin-round-reg-select')?.value || state.selectedRoundId;
  const decision = document.querySelector('input[name="admin-review-decision"]:checked')?.value || 'confirmed_eligible';
  const notes = document.getElementById('admin-modal-el-notes')?.value?.trim() || '';

  if (!studentId || !roundId) {
    showToast('Lỗi xác định đợt hoặc sinh viên.', 'error');
    return;
  }

  const btn = document.getElementById('btn-save-admin-review-el');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Đang lưu...</span>';
  }

  try {
    const list = state.currentAdminRegistrations || [];
    const r = list.find(item => item.studentId === studentId);

    // Collect Admin form inputs
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="admin-ineligible-reason"]:checked'));
    const adminReasons = checkedBoxes.map(cb => cb.value);

    const rows = Array.from(document.querySelectorAll('#admin-missing-courses-tbody tr'));
    const adminMissingCourses = rows.map(tr => {
      const code = tr.querySelector('.admin-missing-course-code')?.value?.trim() || '';
      const name = tr.querySelector('.admin-missing-course-name')?.value?.trim() || '';
      const credits = tr.querySelector('.admin-missing-course-credits')?.value?.trim() || '';
      return { courseCode: code, courseName: name, credits: credits ? Number(credits) : null };
    }).filter(c => c.courseName);

    const adminEnglish = document.getElementById('admin-modal-el-english-input')?.value?.trim() || '';
    const adminOther = document.getElementById('admin-modal-el-other-input')?.value?.trim() || '';

    // Map decision to status
    let status = 'eligible';
    if (decision === 'confirmed_ineligible') status = 'ineligible';
    else if (decision === 'pending_documents') status = 'pending_documents';

    const prevAdmin = r?.adminReview || {};
    const newAdminReview = {
      status: status,
      decision: decision,
      reasons: adminReasons,
      missingCourses: adminMissingCourses,
      englishCertificateStatus: adminEnglish,
      otherReason: adminOther,
      adminNote: notes,
      reviewedBy: state.user?.email || 'admin',
      reviewedAt: new Date().toISOString(),
      history: [
        ...(Array.isArray(prevAdmin.history) ? prevAdmin.history : []),
        {
          status: status,
          decision: decision,
          reasons: adminReasons,
          missingCourses: adminMissingCourses,
          englishCertificateStatus: adminEnglish,
          otherReason: adminOther,
          adminNote: notes,
          reviewedBy: state.user?.email || 'admin',
          reviewedAt: new Date().toISOString()
        }
      ]
    };

    const regRef = doc(db, 'graduationRounds', roundId, 'registrations', studentId);
    await updateDoc(regRef, {
      adminReview: newAdminReview,
      updatedAt: serverTimestamp()
    });

    if (r) {
      r.adminReview = newAdminReview;
    }

    // Refresh table
    if (typeof filterAdminRegistrationsTable === 'function') {
      filterAdminRegistrationsTable();
    }

    closeAdminReviewEligibilityModal();
    showToast(`✓ Đã lưu quyết định thẩm định & điều chỉnh điều kiện cho sinh viên ${studentId} thành công.`, 'success');
  } catch (err) {
    console.error('Lỗi lưu thẩm định điều kiện:', err);
    showToast('Lỗi lưu thẩm định: ' + (err?.message || err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>💾 Lưu Thẩm định & Điều chỉnh</span>';
    }
  }
};
