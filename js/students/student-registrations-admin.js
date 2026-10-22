/**
 * IFA+ Graduation — Admin Registrations Table & Eligibility Status Sync
 */
window.loadAdminRegistrations = async function(roundId) {
  try {
    const [regSnap, elSnap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', roundId, 'registrations')),
      getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'))
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
    filtered = filtered.filter(r => r.eligibilityDeclaration?.status === 'eligible');
  } else if (statusFilter === 'decl_ineligible') {
    filtered = filtered.filter(r => r.eligibilityDeclaration?.status === 'ineligible');
  } else if (statusFilter === 'decl_undeclared') {
    filtered = filtered.filter(r => !r.eligibilityDeclaration?.status || r.eligibilityDeclaration?.status === 'undeclared');
  } else if (statusFilter === 'eligible') {
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
    tbody.innerHTML = '<tr><td colspan="12" class="p-6 text-center text-slate-400 font-medium">Không có sinh viên nào phù hợp bộ lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const getSupName = rank => (r.preferences || []).find(p => p.rank === rank)?.supervisorName || '--';
    const subDate = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)) : null;

    const isReg = Boolean(r.isRegistered);
    const regBadge = isReg
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">✓ Đã đăng ký</span>'
      : '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">⏳ Chưa đăng ký</span>';

    // Self-declaration & Admin verification status
    const decl = r.eligibilityDeclaration || {};
    let selfDeclBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300">Chưa khai báo</span>';
    if (decl.status === 'eligible') {
      selfDeclBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">✓ Đủ điều kiện</span>';
    } else if (decl.status === 'ineligible') {
      const reasonCount = Array.isArray(decl.reasons) ? decl.reasons.length : 0;
      selfDeclBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs" title="${reasonCount} lý do chưa đủ ĐK">⚠️ Chưa đủ ĐK (${reasonCount})</span>`;
    }

    let adminDecisionBadge = '';
    if (decl.adminDecision === 'confirmed_eligible') {
      adminDecisionBadge = '<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-900 border border-blue-300 ml-1">Khoa: Đạt</span>';
    } else if (decl.adminDecision === 'confirmed_ineligible') {
      adminDecisionBadge = '<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-900 border border-rose-300 ml-1">Khoa: Chưa đạt</span>';
    }

    let elBadge = `
      <button type="button" onclick="openAdminReviewEligibilityModal('${r.studentId}')" class="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity p-1 rounded hover:bg-slate-100 cursor-pointer text-center mx-auto" title="Bấm để xem chi tiết tự khai và xác nhận của Khoa">
        ${selfDeclBadge}
        ${adminDecisionBadge}
      </button>
    `;

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

    const activityBadge = typeof window.renderUserActivityBadge === 'function'
      ? window.renderUserActivityBadge(r.studentId)
      : '<span class="text-slate-400 text-xs">--</span>';

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


// ── Admin Eligibility Review & Correction Submodule ─────────────────────────
window.openAdminReviewEligibilityModal = function(studentId) {
  const list = state.currentAdminRegistrations || [];
  const r = list.find(item => item.studentId === studentId);
  if (!r) {
    showToast('Không tìm thấy thông tin đăng ký của sinh viên ' + studentId, 'error');
    return;
  }

  const decl = r.eligibilityDeclaration || {};
  document.getElementById('admin-modal-el-student-id').value = r.studentId;
  document.getElementById('admin-modal-el-mssv').textContent = r.studentId;
  document.getElementById('admin-modal-el-name').textContent = r.studentName || '--';
  document.getElementById('admin-modal-el-topic').textContent = r.topicTitle || '(Chưa đăng ký đề tài)';

  // Declaration badge
  const badgeEl = document.getElementById('admin-modal-el-decl-badge');
  if (badgeEl) {
    if (!decl.status || decl.status === 'undeclared') {
      badgeEl.innerHTML = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">Chưa khai báo</span>';
    } else if (decl.status === 'eligible') {
      badgeEl.innerHTML = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã đủ điều kiện</span>';
    } else if (decl.status === 'ineligible') {
      badgeEl.innerHTML = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">⚠️ Chưa đủ điều kiện</span>';
    }
  }

  // Timestamps
  const formatTime = (ts) => {
    if (!ts) return '--';
    const d = new Date(ts.toDate ? ts.toDate() : ts);
    return isNaN(d.getTime()) ? '--' : d.toLocaleString('vi-VN');
  };

  document.getElementById('admin-modal-el-decl-time').textContent = formatTime(decl.studentDeclaredAt);
  document.getElementById('admin-modal-el-decl-updated').textContent = formatTime(decl.studentUpdatedAt);

  // Reasons list
  const reasonsWrap = document.getElementById('admin-modal-el-reasons-wrap');
  const reasonsList = document.getElementById('admin-modal-el-reasons-list');
  const reasonNames = {
    wrong_registration: 'Đăng ký nhầm DATN/DATH / sai đối tượng môn học',
    english_not_taken: 'Chưa thi / chưa có chứng chỉ Tiếng Anh đạt yêu cầu',
    english_pending_result: 'Đã thi Tiếng Anh và đang chờ kết quả',
    english_pending_verification: 'Đã nộp chứng chỉ Tiếng Anh nhưng trường chưa hậu kiểm/cập nhật',
    missing_credits_1_3: 'Thiếu từ 1 đến 3 tín chỉ',
    missing_credits_4_6: 'Thiếu từ 4 đến 6 tín chỉ',
    missing_credits_7_10: 'Thiếu từ 7 đến 10 tín chỉ',
    failing_courses: 'Còn nợ học phần / môn học chưa đạt',
    other: 'Lý do khác'
  };

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

  // Admin decision & notes
  const decision = decl.adminDecision || 'keep_student';
  const radio = document.querySelector(`input[name="admin-review-decision"][value="${decision}"]`);
  if (radio) radio.checked = true;
  document.getElementById('admin-modal-el-notes').value = decl.adminNotes || '';

  // Audit info
  const auditWrap = document.getElementById('admin-modal-el-audit-wrap');
  if (decl.adminReviewedBy) {
    document.getElementById('admin-modal-el-audit-by').textContent = decl.adminReviewedBy;
    document.getElementById('admin-modal-el-audit-at').textContent = formatTime(decl.adminReviewedAt);
    auditWrap.classList.remove('hidden');
  } else {
    auditWrap.classList.add('hidden');
  }

  document.getElementById('modal-admin-review-eligibility').classList.remove('hidden');
};

window.closeAdminReviewEligibilityModal = function() {
  document.getElementById('modal-admin-review-eligibility')?.classList.add('hidden');
};

window.saveAdminEligibilityReview = async function() {
  const studentId = document.getElementById('admin-modal-el-student-id')?.value;
  const roundId = document.getElementById('admin-round-reg-select')?.value || state.selectedRoundId;
  const decision = document.querySelector('input[name="admin-review-decision"]:checked')?.value || 'keep_student';
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
    const prevDecl = (r && r.eligibilityDeclaration) ? { ...r.eligibilityDeclaration } : {};

    const updatedDecl = {
      ...prevDecl,
      adminDecision: decision,
      adminNotes: notes,
      adminReviewedBy: state.user?.email || 'admin',
      adminReviewedAt: new Date().toISOString()
    };

    const regRef = doc(db, 'graduationRounds', roundId, 'registrations', studentId);
    await updateDoc(regRef, {
      eligibilityDeclaration: updatedDecl,
      updatedAt: serverTimestamp()
    });

    if (r) {
      r.eligibilityDeclaration = updatedDecl;
    }

    // Refresh table
    if (typeof filterAdminRegistrationsTable === 'function') {
      filterAdminRegistrationsTable();
    }

    closeAdminReviewEligibilityModal();
    showToast(`✓ Đã lưu quyết định thẩm định điều kiện cho sinh viên ${studentId} thành công.`, 'success');
  } catch (err) {
    console.error('Lỗi lưu thẩm định điều kiện:', err);
    showToast('Lỗi lưu thẩm định: ' + (err?.message || err), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>💾 Lưu Xác nhận Thẩm định</span>';
    }
  }
};
