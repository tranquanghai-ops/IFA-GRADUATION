/**
 * IFA+ Graduation — Admin Registrations Table & Eligibility Status Sync
 */
window.loadAdminRegistrations = async function(roundId) {
  try {
    const [regSnap, elSnap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', roundId, 'registrations')),
      getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'))
    ]);
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

  // Filter by eligibility
  if (statusFilter === 'eligible') {
    filtered = filtered.filter(r => r.eligibilityStatus === 'eligible' || (!r.eligibilityStatus && r.status === 'submitted'));
  } else if (statusFilter === 'pending') {
    filtered = filtered.filter(r => r.eligibilityStatus === 'pending');
  } else if (statusFilter === 'not_eligible') {
    filtered = filtered.filter(r => r.eligibilityStatus === 'not_eligible');
  }

  renderAdminRegistrationsTable(filtered);
};

function renderAdminRegistrationsTable(list) {
  const tbody = document.getElementById('admin-registrations-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="p-6 text-center text-slate-400 font-medium">Không có sinh viên nào phù hợp bộ lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const getSupName = rank => (r.preferences || []).find(p => p.rank === rank)?.supervisorName || '--';
    const subDate = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)) : null;

    const isReg = Boolean(r.isRegistered);
    const regBadge = isReg
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">✓ Đã đăng ký</span>'
      : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">⏳ Chưa đăng ký</span>';

    let elBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Đủ ĐK</span>';
    if (r.eligibilityStatus === 'pending') {
      elBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Chờ nạp danh sách đủ điều kiện chính thức">Chờ xét</span>';
    } else if (r.eligibilityStatus === 'not_eligible') {
      elBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300" title="Không có trong danh sách đủ điều kiện">Không đủ ĐK</span>';
    }

    let reviewBadge = '<span class="text-slate-400 font-medium text-xs">Chưa nộp</span>';
    if (isReg) {
      if (r.reviewStatus === 'accepted' || r.reviewStatus === 'manually_assigned') {
        reviewBadge = '<span class="text-emerald-700 font-bold text-xs">✓ Đã tiếp nhận</span>';
      } else if (r.reviewStatus === 'rejected') {
        reviewBadge = '<span class="text-rose-600 font-bold text-xs">Chuyển NV sau</span>';
      } else {
        reviewBadge = '<span class="text-slate-600 font-semibold text-xs">Chờ duyệt</span>';
      }
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5 font-mono font-bold text-slate-900">${escapeHtml(r.studentId)}</td>
        <td class="p-3.5 font-semibold text-slate-800">${escapeHtml(r.studentName || '--')}</td>
        <td class="p-3.5 text-center whitespace-nowrap">${regBadge}</td>
        <td class="p-3.5 max-w-[220px] truncate font-bold ${isReg ? 'text-blue-900' : 'text-slate-400 italic'}" title="${escapeHtml(r.topicTitle || '')}">${escapeHtml(r.topicTitle || (isReg ? '--' : '(Chưa đăng ký đề tài)'))}</td>
        <td class="p-3.5 text-slate-600">${escapeHtml(r.projectType || '--')}</td>
        <td class="p-3.5 font-bold text-slate-700">${escapeHtml(getSupName(1))}</td>
        <td class="p-3.5 text-slate-600">${escapeHtml(getSupName(2))}</td>
        <td class="p-3.5 text-slate-600">${escapeHtml(getSupName(3))}</td>
        <td class="p-3.5 text-center">${elBadge}</td>
        <td class="p-3.5 whitespace-nowrap">${reviewBadge}</td>
        <td class="p-3.5 text-[11px] text-slate-400 whitespace-nowrap">${subDate ? subDate.toLocaleString('vi-VN') : '--'}</td>
      </tr>
    `;
  }).join('');
}

window.exportRegistrationsCSV = function() {
  const roundId = document.getElementById('admin-round-reg-select')?.value;
  if (!roundId) return;

  const list = state.currentAdminRegistrations || [];
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
      `"${r.reviewStatus || 'Chờ duyệt'}"`,
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
