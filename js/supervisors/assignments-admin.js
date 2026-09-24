
// --- Module Bridges ---
const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : []);
const normalizeOfficialAssignment = (a, r) => (typeof window !== 'undefined' && window.normalizeOfficialAssignment ? window.normalizeOfficialAssignment(a, r) : (a || r));
const isDirectSupervisorAssignment = (rnd) => (typeof window !== 'undefined' && window.isDirectSupervisorAssignment ? window.isDirectSupervisorAssignment(rnd) : false);
/**
 * IFA+ Graduation — Admin Manual Assignments & Support Supervisor Submodule
 */
// --- PHASE 2A: ADMIN REVIEW MANAGEMENT MODULE ---
// =========================================================================

window.loadAdminReviewData = async function(roundId) {
  if (!roundId) return;

  try {
    if (typeof ensureFacultyDatasetLoaded === 'function' && (!state.facultyStudents || state.facultyStudents.length === 0)) {
      await ensureFacultyDatasetLoaded().catch(e => console.warn('[ReviewData] Faculty dataset load notice:', e));
    }
    // 1. Fetch Round doc
    const roundDoc = await getDoc(doc(db, 'graduationRounds', roundId));
    if (roundDoc.exists()) {
      const data = roundDoc.data();
      const cachedRound = (state.rounds || []).find(item => item.id === roundId);
      if (cachedRound) Object.assign(cachedRound, data);
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

    // 6. Fetch assignments independently from registrations.
    const assignmentSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'officialAssignments'));
    const officialAssignments = assignmentSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Admin-only working copy. Student/GVHD never read this collection.
    const draftSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'assignmentDrafts'));
    const assignmentDrafts = draftSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    state.adminReviewData = {
      supervisors,
      registrations,
      decisions,
      eligible,
      officialAssignments,
      assignmentDrafts
    };

    await refreshRoundCardMetrics(roundId);
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();
    renderAdminManualAssignmentTable();
    renderAdminAssignedSupervisorsTable();
  } catch (e) {
    console.error('Error loading admin review data:', e);
  }
};

function renderAdminReviewDashboard() {
  const round = state.activeRound;
  if (!round) return;

  const directAssignment = isDirectSupervisorAssignment(round);

  const currentRound = round.currentReviewRound || 0;
  const reviewStatus = round.reviewStatus || 'not_started';
  const preferenceCount = round.preferenceCount || 3;

  const statusPill = document.getElementById('admin-review-status-pill');
  const titleEl = document.getElementById('admin-review-current-title');
  const descEl = document.getElementById('admin-review-current-desc');
  const actionsWrap = document.getElementById('admin-review-actions-wrap');
  const isPublished = round.status === 'published' || reviewStatus === 'completed';
  const editingUnlocked = isPublished && round.assignmentEditingUnlocked === true;

  // Compute Stats
  const assignmentRows = getAdminAssignmentRows();
  const totalReg = state.adminReviewData.registrations.length;
  const acceptedCount = assignmentRows.filter(row => row.isAssigned).length;
  const unassignedCount = assignmentRows.filter(row => !row.isAssigned).length;
  const totalQuota = state.adminReviewData.supervisors.reduce((sum, s) => sum + (s.capacity || 10), 0);
  const fillRate = totalQuota > 0 ? Math.round((acceptedCount / totalQuota) * 100) : 0;

  document.getElementById('adm-stat-total-reg').textContent = totalReg;
  document.getElementById('adm-stat-accepted').textContent = acceptedCount;
  document.getElementById('adm-stat-unassigned').textContent = unassignedCount;
  document.getElementById('adm-stat-total-quota').textContent = totalQuota;
  document.getElementById('adm-stat-fill-rate').textContent = `${fillRate}%`;
  const unassignedCountTag = document.getElementById('adm-unassigned-count-tag');
  if (unassignedCountTag) unassignedCountTag.textContent = `${unassignedCount} SV`;

  const reviewSupervisorsSection = document.getElementById('admin-review-supervisors-section');
  const preferencesHeader = document.getElementById('admin-manual-preferences-header');
  const workflowKicker = document.getElementById('admin-review-workflow-kicker');
  const manualSectionTitle = document.querySelector('#admin-manual-assignment-section h3 span:first-child');
  const manualSectionDescription = document.querySelector('#admin-manual-assignment-section p');
  if (reviewSupervisorsSection) reviewSupervisorsSection.classList.toggle('hidden', directAssignment);
  if (preferencesHeader) preferencesHeader.classList.toggle('hidden', directAssignment);
  if (workflowKicker) workflowKicker.textContent = directAssignment ? 'BẢNG ĐIỀU KHIỂN PHÂN CÔNG GVHD' : 'BẢNG ĐIỀU KHIỂN QUY TRÌNH XÉT DUYỆT';
  if (manualSectionTitle) manualSectionTitle.textContent = directAssignment ? '🛠️ Phân công GVHD trực tiếp' : '🛠️ Phân công Thủ công (Sinh viên chưa có GVHD)';
  if (manualSectionDescription) manualSectionDescription.textContent = directAssignment
    ? 'Phân công trực tiếp cho sinh viên đã đăng ký. Chỉ tiêu GVHD vẫn được áp dụng.'
    : 'Dành cho sinh viên chưa trúng tuyển sau các vòng nguyện vọng, hoặc điều phối bổ sung.';

  if (isPublished) {
    const hasDraftChanges = (state.adminReviewData?.assignmentDrafts || []).length > 0;
    statusPill.className = hasDraftChanges
      ? 'badge bg-amber-200 text-amber-900 font-black'
      : 'badge bg-emerald-500 text-white font-black';
    statusPill.textContent = hasDraftChanges ? 'Có thay đổi chưa công bố' : 'Đã hoàn tất & Công bố';
    titleEl.textContent = hasDraftChanges ? 'Đang cập nhật phân công sau công bố' : 'Đã Hoàn tất & Công bố Kết quả ĐATN';
    descEl.textContent = hasDraftChanges
      ? 'Bạn vẫn có thể đổi hoặc bổ sung GVHD. Sinh viên sẽ thấy thay đổi sau khi bấm Công bố lại.'
      : 'Kết quả đã công bố; bạn vẫn có thể đổi GVHD hoặc bổ sung GVHD cho sinh viên chưa được phân công.';
    actionsWrap.innerHTML = `
      <button onclick="publishAdminResults()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>📢 ${hasDraftChanges ? 'Lưu & Công bố lại kết quả' : 'Công bố lại khi có thay đổi'}</span>
      </button>
    `;
    return;
  }

  if (directAssignment) {
    statusPill.className = 'badge bg-indigo-200 text-indigo-900 font-black';
    statusPill.textContent = 'Phân công trực tiếp';
    titleEl.textContent = 'Giai đoạn: Khoa phân công GVHD trực tiếp';
    descEl.textContent = `Có ${unassignedCount} sinh viên chưa có GVHD. Phân công trực tiếp theo chỉ tiêu, sau đó công bố kết quả theo quy trình hiện có.`;
    actionsWrap.innerHTML = `
      <button onclick="publishAdminResults()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>📢 HOÀN TẤT & CÔNG BỐ KẾT QUẢ CHÍNH THỨC</span>
      </button>
    `;
    return;
  }

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
      <button type="button" onclick="openAdminLockRoundModal()" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>🔒 CHỐT NGUYỆN VỌNG ${currentRound} & CHUYỂN VÒNG →</span>
      </button>
      ${currentRound <= 2 ? `<button type="button" onclick="openAdminLockRoundModal(true)" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"><span>📢 CHỐT & CÔNG BỐ SAU VÒNG ${currentRound}</span></button>` : ''}
    `;
  } else if (reviewStatus === 'manual_assignment') {
    const endedAfterRound = Number(round.reviewEndedAfterRound || 0);
    const endedEarly = endedAfterRound >= 1 && endedAfterRound <= 2;
    statusPill.className = 'badge bg-indigo-200 text-indigo-900 font-black';
    statusPill.textContent = endedEarly ? `Đã chốt sau NV${endedAfterRound}` : 'Phân công thủ công';
    titleEl.textContent = endedEarly
      ? `Đã chốt sau Nguyện vọng ${endedAfterRound} — Sẵn sàng công bố`
      : 'Giai đoạn: Phân công GVHD Thủ công';
    descEl.textContent = endedEarly
      ? `Không cần xét các nguyện vọng còn lại. Còn ${unassignedCount} sinh viên chưa có GVHD; bạn có thể phân công bổ sung hoặc công bố ngay kết quả hiện tại.`
      : `Tất cả ${preferenceCount} vòng nguyện vọng đã kết thúc. Còn ${unassignedCount} sinh viên chưa có GVHD. Hãy phân công sinh viên vào các GVHD còn chỉ tiêu trước khi Công bố kết quả.`;

    actionsWrap.innerHTML = `
      <button onclick="publishAdminResults()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2">
        <span>📢 HOÀN TẤT & CÔNG BỐ KẾT QUẢ CHÍNH THỨC</span>
      </button>
    `;
  }
}

window.unlockSupervisorAssignmentEditing = async function() {
  const roundId = state.selectedRoundId;
  if (!roundId) return;
  const confirmed = await showConfirm(
    'Mở khóa chỉnh sửa phân công',
    'Kết quả phân công đã được công bố. Bạn có muốn mở khóa để chỉnh sửa phân công GVHD?',
    { confirmText: 'Mở khóa chỉnh sửa', danger: false }
  );
  if (!confirmed) return;

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      assignmentEditingUnlocked: true,
      assignmentPublicationState: 'editing',
      assignmentEditingUnlockedAt: serverTimestamp(),
      assignmentEditingUnlockedBy: state.user?.email || 'admin',
      updatedAt: serverTimestamp()
    });
    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment_publication',
      action: 'Mở khóa chỉnh sửa phân công GVHD',
      target: roundId,
      detail: 'Mở bản nháp chỉnh sửa; bản đã công bố tiếp tục hiển thị cho sinh viên và giảng viên',
      by: state.user?.email || 'admin'
    });
    showToast('Đã mở khóa chỉnh sửa. Bản công bố hiện tại vẫn được giữ nguyên.', 'success');
    await loadAdminReviewData(roundId);
  } catch (error) {
    showToast('Không thể mở khóa chỉnh sửa: ' + error.message, 'error');
  }
};

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
  const directAssignment = isDirectSupervisorAssignment();
  const unassigned = getAdminAssignmentRows().filter(row => !row.isAssigned);

  if (unassigned.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${directAssignment ? 6 : 7}" class="p-6 text-center text-emerald-700 font-bold bg-emerald-50/50">🎉 Tất cả sinh viên đã được phân công Giảng viên hướng dẫn!</td></tr>`;
    return;
  }

  tbody.innerHTML = unassigned.map(row => {
    const r = row.registration || {};
    const studentId = row.studentId;
    const studentDisplayName = resolveStudentName(studentId, r.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);
    const prefsText = (r.preferences || []).map(p => `NV${p.rank}: ${p.supervisorName}`).join(' • ') || '--';

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-mono font-bold text-slate-900">${studentId}</td>
        <td class="p-3.5 font-semibold text-slate-800">${escapeHtml(studentDisplayName)}</td>
        <td class="p-3.5 max-w-xs font-medium text-slate-900" title="${r.topicTitle || 'Chưa đăng ký đề tài'}">${r.topicTitle || '<span class="text-slate-400 italic">Chưa đăng ký đề tài</span>'}</td>
        <td class="p-3.5 text-slate-600">${r.projectType || '--'}</td>
        ${directAssignment ? '' : `<td class="p-3.5 text-[11px] text-slate-500 max-w-xs truncate" title="${prefsText}">${prefsText}</td>`}
        <td class="p-3.5 font-bold text-amber-700 text-xs">Chưa phân công</td>
        <td class="p-3.5 text-right">
          <button onclick="openAdminManualAssignModal('${studentId}')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm">
            Phân công GVHD
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.startAdminReviewRound1 = async function() {
  const roundId = state.selectedRoundId;
  if (!roundId) return;

  if (!(await showConfirm('Bắt đầu Xét duyệt', 'Bắt đầu quy trình xét duyệt Nguyện vọng 1? Giảng viên hướng dẫn sẽ có thể đăng nhập và chọn sinh viên.', { confirmText: 'Bắt đầu ngay', danger: false }))) return;

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      currentReviewRound: 1,
      reviewStatus: 'round_1',
      status: 'reviewing',
      updatedAt: serverTimestamp()
    });

    showToast('▶️ Đã bắt đầu xét duyệt Nguyện vọng 1 thành công!', 'success');
    await loadAdminReviewData(roundId);
  } catch (e) {
    showToast('Lỗi bắt đầu xét duyệt: ' + e.message, 'error');
  }
};

window.openAdminLockRoundModal = function(publishEarly = false) {
  const currentRound = state.activeRound?.currentReviewRound || 1;
  if (publishEarly && (currentRound < 1 || currentRound > 2)) {
    showToast('Chỉ có thể chốt và công bố sớm sau vòng 1 hoặc vòng 2.', 'warning');
    return;
  }
  const supervisors = state.adminReviewData?.supervisors || [];
  const pendingSups = supervisors.filter(s => {
    return !(s.roundProgress && s.roundProgress['round_' + currentRound]?.status === 'completed');
  });

  const preferenceCount = state.activeRound?.preferenceCount || 3;
  const titleEl = document.getElementById('modal-admin-lock-round-title');
  const detailEl = document.getElementById('modal-admin-lock-round-detail');
  const confirmBtn = document.getElementById('btn-confirm-admin-lock-round');
  if (titleEl) titleEl.textContent = publishEarly
    ? `Chốt Nguyện vọng ${currentRound} & Công bố kết quả`
    : `Khóa & Chốt Nguyện vọng ${currentRound}`;
  if (detailEl) detailEl.textContent = publishEarly
    ? `Sau khi chốt, hệ thống sẽ đưa bạn đến bước công bố kết quả. Nguyện vọng còn lại sẽ không tiếp tục xét.`
    : `Sinh viên chưa được chọn sẽ chuyển sang ${currentRound < preferenceCount ? `Nguyện vọng ${currentRound + 1}` : 'phân công thủ công'}.`;
  if (confirmBtn) {
    confirmBtn.dataset.publishEarly = publishEarly ? 'true' : 'false';
    confirmBtn.textContent = publishEarly ? '📢 Chốt & sang bước công bố' : '🔒 Xác nhận Chốt Vòng';
  }
  
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
  const supervisors = state.adminReviewData?.supervisors || [];
  const registrations = state.adminReviewData?.registrations || [];
  const decisions = state.adminReviewData?.decisions || [];
  const confirmBtn = document.getElementById('btn-confirm-admin-lock-round');
  const publishEarly = confirmBtn?.dataset.publishEarly === 'true';

  if (!roundId) return;
  if (publishEarly && (currentRound < 1 || currentRound > 2)) {
    showToast('Chỉ có thể công bố sớm sau vòng 1 hoặc vòng 2.', 'warning');
    return;
  }

  const btn = confirmBtn || document.querySelector('#modal-admin-lock-round button.bg-rose-600');
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
    const nextStatus = publishEarly
      ? 'manual_assignment'
      : (nextRound <= preferenceCount ? `round_${nextRound}` : 'manual_assignment');

    const roundUpdate = {
      currentReviewRound: publishEarly ? currentRound : nextRound,
      reviewStatus: nextStatus,
      updatedAt: serverTimestamp()
    };
    if (publishEarly) roundUpdate.reviewEndedAfterRound = currentRound;
    roundUpdate[lockKey] = {
      lockedAt: serverTimestamp(),
      lockedBy: state.user?.email || 'admin'
    };

    batch.update(roundRef, roundUpdate);

    await batch.commit();

    closeAdminLockRoundModal();
    if (publishEarly) {
      showToast(`🔒 Đã chốt Nguyện vọng ${currentRound}. Xác nhận công bố kết quả ở bước tiếp theo.`, 'success');
      await loadAdminReviewData(roundId);
      await publishAdminResults();
      return;
    }
    showToast(`🔒 ĐÃ CHỐT THÀNH CÔNG NGUYỆN VỌNG ${currentRound}!\nChuyển sang: ${nextStatus === 'manual_assignment' ? 'Phân công thủ công' : 'Xét Nguyện vọng ' + nextRound}`, 'info');
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi khi chốt vòng:', err);
    showToast('Lỗi chốt vòng: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = publishEarly ? '📢 Chốt & sang bước công bố' : '🔒 Xác nhận Chốt Vòng';
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
      const cStudentName = resolveStudentName(c.studentId, c.studentName);

      return `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-mono font-bold text-slate-900">${c.studentId}</td>
          <td class="p-3 font-semibold text-slate-800">${escapeHtml(cStudentName)}</td>
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
  if (!ensureAssignmentEditingAllowed()) return;
  state.manualAssignStudentId = studentId;
  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  if (!row) return;
  const reg = row.registration || {};

  const directAssignment = isDirectSupervisorAssignment();
  const modalTitle = document.querySelector('#modal-admin-manual-assign h3');
  if (modalTitle) modalTitle.textContent = directAssignment ? 'Phân công GVHD trực tiếp' : 'Phân công GVHD Thủ công';

  const studentDisplayName = resolveStudentName(row.studentId, reg.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);
  document.getElementById('manual-assign-student-info').textContent = `${row.studentId} — ${studentDisplayName}`;
  document.getElementById('manual-assign-topic-info').textContent = reg.topicTitle
    ? `Đề tài: ${reg.topicTitle} (${reg.projectType || '--'})`
    : 'Đề tài: Chưa đăng ký đề tài';

  const select = document.getElementById('select-manual-supervisor');
  select.innerHTML = state.adminReviewData.supervisors.map(s => {
    const supMaster = (state.supervisorsMaster || []).find(x => x.id === s.id);
    const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || s);
    const configuredCap = typeof s.capacity === 'number' ? s.capacity : (s.maxQuota || maxCap);
    const allowedCap = Math.min(configuredCap, maxCap);

    const acceptedCount = getSupervisorAssignmentCount(s.id, row.studentId);
    const remaining = allowedCap - acceptedCount;
    const typeLabel = employmentType === 'adjunct' ? 'Thỉnh giảng' : 'Cơ hữu';

    if (remaining <= 0) {
      return `<option value="${s.id}" disabled class="text-slate-400 bg-slate-100">${s.name} (${typeLabel} • ĐÃ ĐỦ CHỈ TIÊU: ${acceptedCount}/${allowedCap})</option>`;
    }
    return `<option value="${s.id}">${s.name} (${typeLabel} • Còn ${remaining} chỗ • ${acceptedCount}/${allowedCap})</option>`;
  }).join('');

  document.getElementById('modal-admin-manual-assign').classList.remove('hidden');
};

window.closeAdminManualAssignModal = function() {
  document.getElementById('modal-admin-manual-assign').classList.add('hidden');
};

window.saveAdminManualAssign = async function() {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const studentId = state.manualAssignStudentId;
  const supervisorId = document.getElementById('select-manual-supervisor')?.value;

  if (!roundId || !studentId || !supervisorId) return;

  const sup = state.adminReviewData.supervisors.find(s => s.id === supervisorId);
  if (!sup) {
    showToast('Vui lòng chọn Giảng viên hướng dẫn.', 'warning');
    return;
  }

  const supMaster = (state.supervisorsMaster || []).find(x => x.id === sup.id);
  const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || sup);
  const configuredCap = typeof sup.capacity === 'number' ? sup.capacity : (sup.maxQuota || maxCap);
  const allowedCap = Math.min(configuredCap, maxCap);

  const acceptedCount = getSupervisorAssignmentCount(sup.id, studentId);
  const remaining = allowedCap - acceptedCount;

  if (remaining <= 0) {
    const typeText = employmentType === 'adjunct' ? 'Thỉnh giảng (tối đa 5 SV)' : 'Cơ hữu (tối đa 10 SV)';
    showToast(`Thầy/Cô ${sup.name} đã đủ chỉ tiêu phân công (${acceptedCount}/${allowedCap} SV - ${typeText}). Theo quy định của Nhà trường, không được phép phân công vượt quá chỉ tiêu.`, 'error', 6000);
    return;
  }

  try {
    const batch = writeBatch(db);

    const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
    if (!row) throw new Error('Không tìm thấy sinh viên trong danh sách đủ điều kiện hoặc đăng ký.');
    const existingAssignment = row.draft || row.assignment || {};
    const existingSupervisors = getOfficialSupervisors(normalizeOfficialAssignment(existingAssignment, row.registration));
    const supportSupervisors = existingSupervisors.filter(item => item.role === 'support' && item.supervisorId !== supervisorId);
    const supervisors = [{
      supervisorId: sup.id,
      supervisorName: sup.name || 'GVHD',
      supervisorEmail: (sup.email || '').toLowerCase().trim(),
      role: 'primary',
      source: 'manually_assigned',
      addedAt: new Date().toISOString()
    }, ...supportSupervisors];
    const studentDisplayName = resolveStudentName(studentId, row.registration?.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);
    const studentEmail = row.registration?.email || row.eligibleStudent?.email || `${studentId.toLowerCase()}@student.tdtu.edu.vn`;
    const assignmentPayload = buildAssignmentDraftPayload(row, supervisors, 'admin_assigned');

    // Source of truth: assignment exists independently from registration.
    const assignmentRef = doc(db, 'graduationRounds', roundId, 'assignmentDrafts', studentId);
    batch.set(assignmentRef, {
      ...assignmentPayload,
      studentName: studentDisplayName,
      studentEmail,
      createdAt: existingAssignment.createdAt || serverTimestamp(),
      createdBy: existingAssignment.createdBy || state.user?.email || 'admin'
    }, { merge: true });

    await batch.commit();

    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment',
      action: 'Phân công GVHD',
      target: studentId,
      detail: `Phân công ${sup.name || supervisorId} làm GVHD chính; trạng thái draft`,
      by: state.user?.email || 'admin'
    });

    closeAdminManualAssignModal();
    showToast(`✓ Đã phân công sinh viên ${studentDisplayName} (${studentId}) cho Thầy/Cô ${sup?.name} thành công!`, 'info');
    await loadAdminReviewData(roundId);
  } catch (err) {
    showToast('Lỗi phân công: ' + err.message, 'error');
  }
};

window.publishAdminResults = async function() {
  const roundId = state.selectedRoundId;
  if (!roundId) return;

  const assignmentRows = getAdminAssignmentRows();
  const unassignedCount = assignmentRows.filter(row => !row.isAssigned).length;
  const alreadyPublished = state.activeRound?.status === 'published' || state.activeRound?.reviewStatus === 'completed';
  const changedRows = assignmentRows.filter(row => Boolean(row.draft));

  if (alreadyPublished && changedRows.length === 0) {
    showToast('Không có thay đổi phân công mới để công bố lại.', 'info');
    return;
  }

  if (unassignedCount > 0) {
    if (!(await showConfirm('Công bố Kết quả Chính thức', `Vẫn còn ${unassignedCount} sinh viên chưa được phân công GVHD. Bạn có chắc chắn muốn hoàn tất và CÔNG BỐ KẾT QUẢ CHÍNH THỨC không?`, { confirmText: 'Công bố kết quả', danger: true }))) return;
  } else {
    if (!(await showConfirm('Công bố Kết quả Chính thức', 'Xác nhận HOÀN TẤT & CÔNG BỐ KẾT QUẢ CHÍNH THỨC cho sinh viên và giảng viên?', { confirmText: 'Xác nhận công bố', danger: false }))) return;
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'graduationRounds', roundId), {
      reviewStatus: 'completed',
      status: 'published',
      assignmentEditingUnlocked: false,
      assignmentPublicationState: 'published',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Publish every assigned student through the existing round-level publish action.
    // Legacy registration assignments are projected into the independent source here.
    const rowsToPublish = alreadyPublished ? changedRows : assignmentRows.filter(row => row.isAssigned);
    rowsToPublish.filter(row => row.isAssigned).forEach(row => {
      const effective = row.effective;
      const supervisors = getOfficialSupervisors(effective);
      const publishedPayload = buildOfficialAssignmentPayload(row, supervisors, 'published');
      const primary = publishedPayload.supervisors.find(item => item.role === 'primary') || publishedPayload.supervisors[0];
      batch.set(doc(db, 'graduationRounds', roundId, 'officialAssignments', row.studentId), {
        ...publishedPayload,
        source: row.assignment?.source || effective.source || 'legacy_migration',
        publishedAt: serverTimestamp(),
        publishedBy: state.user?.email || 'admin'
      }, { merge: true });
      if (row.draft) {
        batch.delete(doc(db, 'graduationRounds', roundId, 'assignmentDrafts', row.studentId));
      }
      if (row.registration) {
        batch.update(doc(db, 'graduationRounds', roundId, 'registrations', row.studentId), {
          reviewStatus: 'manually_assigned',
          officialSupervisors: publishedPayload.supervisors,
          acceptedSupervisorId: primary?.supervisorId || effective.acceptedSupervisorId || '',
          acceptedSupervisorName: primary?.supervisorName || effective.acceptedSupervisorName || '',
          acceptedRank: effective.acceptedRank || 'manual',
          acceptedAt: serverTimestamp(),
          acceptedBy: state.user?.email || 'admin',
          updatedAt: serverTimestamp()
        });
      }
    });

    await batch.commit();
    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment_publication',
      action: alreadyPublished ? 'Công bố lại phân công GVHD' : 'Công bố phân công GVHD',
      target: roundId,
      detail: `${alreadyPublished ? 'Công bố lại' : 'Công bố'} ${rowsToPublish.filter(row => row.isAssigned).length} phân công chính thức`,
      by: state.user?.email || 'admin'
    });

    showToast('🎉 ĐÃ CÔNG BỐ KẾT QUẢ ĐỒ ÁN TỐT NGHIỆP CHÍNH THỨC THÀNH CÔNG!', 'success');
    await loadAdminReviewData(roundId);
  } catch (err) {
    showToast('Lỗi công bố kết quả: ' + err.message, 'error');
  }
};


// --- UNIFIED TEACHER / SUPERVISOR PROFILE & BIO MODAL ---
window.openTeacherProfileModal = function(supId = null) {
  const modal = document.getElementById('modal-teacher-profile');
  if (!modal) return;

  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const isSelf = !supId || (actor?.email && (supId === actor.email || supId === actor.id));
  const isSupervisorSelf = isSelf && (state.currentRole === 'supervisor');

  let sup = null;
  if (supId) {
    sup = (state.roundSupervisors || []).find(s => s.id === supId || s.email === supId) ||
          (state.supervisorsMaster || []).find(s => s.id === supId || s.email === supId);
  }
  
  if (!sup && isSelf) {
    sup = {
      name: actor?.displayName || state.supervisorName || actor?.email || 'Giảng viên',
      email: actor?.email || state.supervisorEmail || '',
      department: 'Khoa Mỹ thuật Công nghiệp',
      degree: 'Thạc sĩ',
      expertise: state.supervisorExpertise || 'Đồ án Tốt nghiệp & Nghiên cứu ứng dụng',
      bio: state.supervisorBio || 'Thông tin giảng viên hướng dẫn.',
      photoUrl: actor?.photoURL || ''
    };
  }

  if (!sup) {
    showToast('Không tìm thấy thông tin giảng viên.', 'warning');
    return;
  }

  const nameEl = document.getElementById('teacher-profile-name');
  if (nameEl) nameEl.textContent = sup.name || sup.displayName || '--';

  const deptEl = document.getElementById('teacher-profile-dept');
  if (deptEl) deptEl.textContent = sup.department || 'Khoa Mỹ thuật Công nghiệp • TDTU';

  const degreeBadge = document.getElementById('teacher-profile-degree-badge');
  if (degreeBadge) degreeBadge.textContent = sup.degree || 'Giảng viên';

  const expEl = document.getElementById('teacher-profile-expertise');
  if (expEl) expEl.textContent = sup.bio || sup.expertise || 'Chưa có thông tin giới thiệu.';

  const emailEl = document.getElementById('teacher-profile-email');
  if (emailEl) {
    emailEl.textContent = sup.email || '--';
    emailEl.href = sup.email ? 'mailto:' + sup.email : '#';
  }

  const phoneWrap = document.getElementById('teacher-profile-phone-wrap');
  const phoneEl = document.getElementById('teacher-profile-phone');
  if (phoneWrap && phoneEl) {
    if (sup.phone) {
      phoneWrap.classList.remove('hidden');
      phoneEl.textContent = sup.phone;
      phoneEl.href = 'tel:' + sup.phone;
    } else {
      phoneWrap.classList.add('hidden');
    }
  }

  const quotaWrap = document.getElementById('teacher-profile-quota-wrap');
  const quotaEl = document.getElementById('teacher-profile-quota');
  if (quotaWrap && quotaEl) {
    if (sup.quota !== undefined && (state.isAdmin || state.currentRole === 'supervisor')) {
      quotaWrap.classList.remove('hidden');
      quotaEl.textContent = `${sup.currentAssigned || 0} / ${sup.quota} sinh viên`;
    } else {
      quotaWrap.classList.add('hidden');
    }
  }

  const photoEl = document.getElementById('teacher-profile-photo');
  if (photoEl) {
    const fallback = (typeof getSupervisorAvatarSvgDataUri === 'function') ? getSupervisorAvatarSvgDataUri(sup.name || 'GV') : '';
    photoEl.src = sup.photoUrl || fallback;
    photoEl.onerror = function() {
      this.onerror = null;
      this.src = fallback;
    };
  }

  const logoutBtn = document.getElementById('btn-teacher-profile-logout');
  if (logoutBtn) {
    logoutBtn.classList.toggle('hidden', !isSupervisorSelf);
  }

  const adminEditBtn = document.getElementById('btn-teacher-profile-admin-edit');
  if (adminEditBtn) {
    adminEditBtn.classList.toggle('hidden', !state.isAdmin);
    if (state.isAdmin && sup.id) {
      adminEditBtn.onclick = () => {
        closeTeacherProfileModal();
        if (typeof openAdminEditSupervisorModal === 'function') {
          openAdminEditSupervisorModal(sup.id);
        }
      };
    }
  }

  modal.classList.remove('hidden');
};

window.closeTeacherProfileModal = function() {
  const modal = document.getElementById('modal-teacher-profile');
  if (modal) modal.classList.add('hidden');
};

window.openBioModal = function(supId) {
  window.openTeacherProfileModal(supId);
};

window.closeBioModal = function() {
  window.closeTeacherProfileModal();
};




// --- ADMIN: EDIT / REASSIGN OFFICIAL SUPERVISOR (works even after publish) ---
function computeSupervisorQuotaInfo(supId, excludeStudentId = null) {
  const sup = (state.adminReviewData?.supervisors || []).find(s => s.id === supId);
  if (!sup) return null;
  const supMaster = (state.supervisorsMaster || []).find(x => x.id === sup.id);
  const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || sup);
  const configuredCap = typeof sup.capacity === 'number' ? sup.capacity : (sup.maxQuota || maxCap);
  const allowedCap = Math.min(configuredCap, maxCap);
  const used = getSupervisorAssignmentCount(supId, excludeStudentId || '');
  return { sup, employmentType, allowedCap, used, remaining: allowedCap - used };
}

function buildEditSupervisorOptions(selectEl, currentSupervisorId, allowEmpty = false) {
  const supervisors = state.adminReviewData?.supervisors || [];
  const currentReg = state.editSupStudentId ? getAdminAssignmentRows().find(row => row.studentId === state.editSupStudentId)?.effective : null;
  selectEl.innerHTML = (allowEmpty ? '<option value="">-- Không có GVHD 2 --</option>' : '') + supervisors.map(s => {
    const info = computeSupervisorQuotaInfo(s.id, state.editSupStudentId);
    if (!info) return '';
    const isSelf = currentReg ? isOfficialSupervisor(currentReg, s.id) : (s.id === currentSupervisorId);
    const typeLabel = info.employmentType === 'adjunct' ? 'Thỉnh giảng' : 'Cơ hữu';
    if (info.remaining <= 0 && !isSelf) {
      return `<option value="${s.id}" disabled class="text-slate-400 bg-slate-100">${s.name} (${typeLabel} • ĐÃ ĐỦ CHỈ TIÊU: ${info.used}/${info.allowedCap})</option>`;
    }
    return `<option value="${s.id}">${s.name} (${typeLabel} • Còn ${info.remaining} chỗ • ${info.used}/${info.allowedCap})</option>`;
  }).join('');
}

window.openAdminEditSupervisorModal = function(studentId) {
  if (!ensureAssignmentEditingAllowed()) return;
  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  const reg = row?.effective;
  if (!row || !reg) {
    showToast('Không tìm thấy thông tin sinh viên này.', 'warning');
    return;
  }

  state.editSupStudentId = studentId;
  const officials = getOfficialSupervisors(reg);
  const primary = officials.find(s => s.role === 'primary') || officials[0];
  const secondary = officials.find(s => s.role === 'support');

  document.getElementById('edit-sup-student-info').textContent = `${reg.studentId} — ${resolveStudentName(reg.studentId, reg.studentName)}`;
  document.getElementById('edit-sup-topic-info').textContent = `Đề tài: ${reg.topicTitle || '--'}${reg.projectType ? ' (' + reg.projectType + ')' : ''}`;
  document.getElementById('edit-sup-round-info').textContent = `Đợt tốt nghiệp: ${state.activeRound?.title || state.activeRound?.name || state.selectedRoundId || '--'}`;
  document.getElementById('edit-sup-current-primary').textContent = primary?.supervisorName || 'Chưa phân công';
  document.getElementById('edit-sup-current-secondary').textContent = secondary?.supervisorName || 'Chưa có';

  buildEditSupervisorOptions(document.getElementById('select-edit-primary-supervisor'), primary?.supervisorId || '');
  buildEditSupervisorOptions(document.getElementById('select-edit-secondary-supervisor'), secondary?.supervisorId || '', true);
  document.getElementById('select-edit-primary-supervisor').value = primary?.supervisorId || '';
  document.getElementById('select-edit-secondary-supervisor').value = secondary?.supervisorId || '';

  // Warn if scoring data exists for this student (must not be moved/deleted).
  const round = (state.rounds || []).find(r => r.id === state.selectedRoundId);
  const hasScoring = Boolean(round?.supervisorScores?.[studentId]);
  document.getElementById('edit-sup-scoring-warning').classList.toggle('hidden', !hasScoring);

  document.getElementById('edit-sup-hint').textContent = 'GVHD chính và GVHD 2 không được là cùng một người. Preference NV1/NV2/NV3 của sinh viên được giữ nguyên.';
  document.getElementById('modal-admin-edit-supervisor').classList.remove('hidden');
};

window.closeAdminEditSupervisorModal = function() {
  document.getElementById('modal-admin-edit-supervisor').classList.add('hidden');
  state.editSupStudentId = null;
};

window.saveAdminEditSupervisor = async function() {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const studentId = state.editSupStudentId;
  if (!roundId || !studentId) return;

  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  const reg = row?.effective;
  if (!row || !reg) return;

  const newPrimaryId = document.getElementById('select-edit-primary-supervisor')?.value || '';
  const newSecondaryId = document.getElementById('select-edit-secondary-supervisor')?.value || '';

  if (!newPrimaryId) {
    showToast('Vui lòng chọn GVHD chính.', 'warning');
    return;
  }
  if (newSecondaryId && newSecondaryId === newPrimaryId) {
    showToast('GVHD chính và GVHD 2 không được là cùng một người.', 'warning');
    return;
  }

  const officials = getOfficialSupervisors(reg);
  const oldPrimary = officials.find(s => s.role === 'primary') || officials[0];
  const oldSecondary = officials.find(s => s.role === 'support');

  if (newPrimaryId === (oldPrimary?.supervisorId || '') && newSecondaryId === (oldSecondary?.supervisorId || '')) {
    showToast('Phân công không thay đổi.', 'info');
    return;
  }

  // Quota validation (excluding the student being edited to avoid double-count)
  const newPrimaryInfo = computeSupervisorQuotaInfo(newPrimaryId, studentId);
  if (!newPrimaryInfo) {
    showToast('Không tìm thấy thông tin GVHD chính mới.', 'warning');
    return;
  }
  if (newPrimaryId !== oldPrimary?.supervisorId && newPrimaryInfo.remaining <= 0) {
    const typeText = newPrimaryInfo.employmentType === 'adjunct' ? 'Thỉnh giảng (tối đa 5 SV)' : 'Cơ hữu (tối đa 10 SV)';
    showToast(`Thầy/Cô ${newPrimaryInfo.sup.name} đã đủ chỉ tiêu (${newPrimaryInfo.used}/${newPrimaryInfo.allowedCap} SV - ${typeText}). Không thể phân công vượt chỉ tiêu.`, 'error', 6000);
    return;
  }
  if (newSecondaryId && newSecondaryId !== oldSecondary?.supervisorId) {
    const newSecondaryInfo = computeSupervisorQuotaInfo(newSecondaryId, studentId);
    if (!newSecondaryInfo || newSecondaryInfo.remaining <= 0) {
      const typeText = newSecondaryInfo?.employmentType === 'adjunct' ? 'Thỉnh giảng (tối đa 5 SV)' : 'Cơ hữu (tối đa 10 SV)';
      showToast(`GVHD 2: Thầy/Cô ${newSecondaryInfo?.sup.name || '--'} đã đủ chỉ tiêu (${newSecondaryInfo?.used || '?'}/${newSecondaryInfo?.allowedCap || '?'} SV - ${typeText}).`, 'error', 6000);
      return;
    }
  }

  const newPrimary = newPrimaryInfo.sup;
  const newSecondary = newSecondaryId ? (state.adminReviewData?.supervisors || []).find(s => s.id === newSecondaryId) : null;
  const otherSupports = officials.filter(s => s.role === 'support' && s.supervisorId !== (oldSecondary?.supervisorId || '') && s.supervisorId !== newSecondaryId);

  const nowIso = new Date().toISOString();
  const updatedOfficials = [
    {
      supervisorId: newPrimary.id,
      supervisorName: newPrimary.name,
      supervisorEmail: (newPrimary.email || '').toLowerCase().trim(),
      source: newPrimaryId === oldPrimary?.supervisorId ? (oldPrimary.source || 'preference') : 'admin_edited',
      role: 'primary',
      addedAt: newPrimaryId === oldPrimary?.supervisorId ? (oldPrimary.addedAt || nowIso) : nowIso
    },
    ...(newSecondary ? [{
      supervisorId: newSecondary.id,
      supervisorName: newSecondary.name,
      supervisorEmail: (newSecondary.email || '').toLowerCase().trim(),
      source: newSecondaryId === oldSecondary?.supervisorId ? (oldSecondary.source || 'admin_added') : 'admin_added',
      role: 'support',
      addedAt: nowIso
    }] : []),
    ...otherSupports
  ];

  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'graduationRounds', roundId, 'assignmentDrafts', studentId),
      buildAssignmentDraftPayload(row, updatedOfficials, 'admin_edited'),
      { merge: true }
    );

    await batch.commit();

    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment',
      action: 'Cập nhật phân công GVHD',
      target: studentId,
      detail: `GVHD chính: ${oldPrimary?.supervisorName || oldPrimary?.supervisorId || '--'} → ${newPrimary.name}; GVHD 2: ${oldSecondary?.supervisorName || oldSecondary?.supervisorId || '--'} → ${newSecondary?.name || '--'}; trạng thái draft`,
      by: state.user?.email || 'admin'
    });

    // Update local cache so UI stays consistent without a refetch round-trip
    closeAdminEditSupervisorModal();
    renderAdminAssignedSupervisorsTable();
    renderAdminManualAssignmentTable();
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();

    showToast(`✓ Đã cập nhật phân công GVHD cho sinh viên ${resolveStudentName(studentId, reg.studentName)}: GVHD chính ${newPrimary.name}${newSecondary ? `, GVHD 2 ${newSecondary.name}` : ''}.`, 'success');
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi chỉnh sửa phân công GVHD:', err);
    showToast('Lỗi lưu phân công: ' + err.message, 'error');
  }
};




// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof renderAdminReviewManagement !== 'undefined') window.renderAdminReviewManagement = renderAdminReviewManagement;
  if (typeof openAdminAssignModal !== 'undefined') window.openAdminAssignModal = openAdminAssignModal;
  if (typeof saveAdminManualAssignment !== 'undefined') window.saveAdminManualAssignment = saveAdminManualAssignment;
  if (typeof openAdminEditSupervisorAssignmentModal !== 'undefined') window.openAdminEditSupervisorAssignmentModal = openAdminEditSupervisorAssignmentModal;
  if (typeof saveAdminReassignedSupervisor !== 'undefined') window.saveAdminReassignedSupervisor = saveAdminReassignedSupervisor;
  if (typeof openAddSupportSupervisorModal !== 'undefined') window.openAddSupportSupervisorModal = openAddSupportSupervisorModal;
  if (typeof saveSupportSupervisor !== 'undefined') window.saveSupportSupervisor = saveSupportSupervisor;
  if (typeof publishRoundAssignments !== 'undefined') window.publishRoundAssignments = publishRoundAssignments;
}
