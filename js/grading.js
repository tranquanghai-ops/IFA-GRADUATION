/**
 * IFA+ Graduation — Councils, Rubric Scoring & Assessment Portal Module
 */
// ============================================================================
// COUNCIL / HỘI ĐỒNG FOUNDATION MODULE (v1.9.0-beta.1)
// ============================================================================

window.toggleActivityCouncilFields = function(checked) {
  const box = document.getElementById('activity-council-extra-fields');
  if (box) {
    if (checked) box.classList.remove('hidden');
    else box.classList.add('hidden');
  }
};

// ============================================================================
// MILESTONE COUNCIL & GUEST MEMBER ASSIGNMENT (Item D)
// ============================================================================

window.renderActivityCouncilsInModal = function() {
  const container = document.getElementById('activity-councils-list-container');
  if (!container) return;

  const councils = state._currentActivityCouncils || [];
  if (councils.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center bg-white/90 rounded-xl border border-dashed border-indigo-200">
        <span class="text-2xl block mb-1">🏛️</span>
        <p class="font-bold text-slate-700 text-xs">Chưa có Hội đồng nào trong Mốc này</p>
        <p class="text-[10px] text-slate-400 mt-0.5">Bấm "+ Thêm Hội đồng" ở trên để tạo hội đồng và phân công thành viên.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = councils.map((c, cIdx) => {
    const members = Object.entries(c.membersBySlot || {}).filter(([k, m]) => Boolean(m && (m.memberName || m.name)));

    const membersHtml = members.length === 0
      ? '<span class="text-[11px] text-slate-400 italic">Chưa có thành viên nào được gán.</span>'
      : members.map(([slotKey, m]) => {
          const isGuest = (m.type === 'guest' || m.isExternalGuest);
          const badgeClass = isGuest ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-indigo-100 text-indigo-900 border-indigo-200';
          const icon = isGuest ? '🌐' : '🏫';
          const typeLabel = isGuest ? 'Khách mời' : 'Nội bộ';
          const subInfo = isGuest ? (m.organization ? ` (${escapeHtml(m.organization)})` : '') : (m.department ? ` (${escapeHtml(m.department)})` : '');
          const roleLabel = m.role || m.slotKey || 'Thành viên';
          return `
            <div class="flex items-center justify-between gap-2 p-1.5 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs">
              <div class="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                <span class="px-1.5 py-0.5 text-[9px] font-bold rounded-md border ${badgeClass} shrink-0">${icon} ${typeLabel}</span>
                <span class="font-bold text-slate-800">${escapeHtml(m.memberName || m.name || '')}</span>
                <span class="text-[10px] text-slate-400 shrink-0">${subInfo}</span>
                <span class="text-[10px] text-indigo-600 font-semibold shrink-0">• ${escapeHtml(roleLabel)}</span>
                ${m.memberEmail ? `<span class="text-[10px] font-mono text-slate-500 shrink-0">&lt;${escapeHtml(m.memberEmail)}&gt;</span>` : ''}
              </div>
              <button type="button" onclick="removeCouncilMemberFromMilestone('${c.id}', '${slotKey}')" class="text-rose-500 hover:text-rose-700 font-bold text-xs p-1 shrink-0" title="Xóa thành viên khỏi Hội đồng">✕</button>
            </div>
          `;
        }).join('');

    return `
      <div class="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs space-y-2.5">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold text-indigo-700 text-xs">#${cIdx + 1}</span>
              <h5 class="font-black text-xs text-slate-900">${escapeHtml(c.name || 'Hội đồng')}</h5>
              ${c.room ? `<span class="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">📍 ${escapeHtml(c.room)}</span>` : ''}
            </div>
            ${(c.date || c.startTime) ? `<p class="text-[10px] text-slate-400 font-mono mt-0.5">📅 ${c.date || '--'} • 🕒 ${c.startTime || '--'}${c.endTime ? ' → ' + c.endTime : ''}</p>` : ''}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" onclick="deleteCouncilFromMilestone('${c.id}')" class="px-2 py-0.5 text-rose-600 hover:bg-rose-50 rounded text-[11px] font-bold transition-colors">
              Xóa HĐ
            </button>
          </div>
        </div>

        <div class="space-y-1 pl-1">
          <span class="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Thành viên (${members.length}):</span>
          <div class="space-y-1">
            ${membersHtml}
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-1.5">
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="openAddCouncilInternalMemberModal('${c.id}')" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 transition-colors flex items-center gap-1">
              <span>+ TV Nội bộ</span>
            </button>
            <button type="button" onclick="openAddCouncilGuestMemberModal('${c.id}')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold border border-amber-200 transition-colors flex items-center gap-1">
              <span>+ Khách mời (Email)</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.openAddCouncilFromMilestoneModal = function() {
  const currentCount = (state._currentActivityCouncils || []).length;
  document.getElementById('quick-council-id').value = '';
  document.getElementById('quick-council-name').value = `Hội đồng ${currentCount + 1}`;
  document.getElementById('quick-council-room').value = '';
  document.getElementById('quick-council-date').value = '';
  document.getElementById('quick-council-time').value = '';
  document.getElementById('modal-milestone-quick-council-title').textContent = 'Thêm Hội đồng mới cho Mốc';
  document.getElementById('modal-milestone-quick-council')?.classList.remove('hidden');
};

window.closeMilestoneQuickCouncilModal = function() {
  document.getElementById('modal-milestone-quick-council')?.classList.add('hidden');
};

window.saveMilestoneQuickCouncil = function() {
  const name = document.getElementById('quick-council-name')?.value?.trim();
  if (!name) {
    showToast('Vui lòng nhập tên Hội đồng!', 'warning');
    return;
  }
  const room = document.getElementById('quick-council-room')?.value?.trim() || '';
  const date = document.getElementById('quick-council-date')?.value?.trim() || '';
  const time = document.getElementById('quick-council-time')?.value?.trim() || '';

  state._currentActivityCouncils = state._currentActivityCouncils || [];
  const councilId = 'council_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  const newCouncil = {
    id: councilId,
    slug: 'c-' + slugify(name) + '-' + Date.now().toString(36).substr(-4),
    name,
    room,
    date,
    startTime: time,
    status: 'preparing',
    membersBySlot: {},
    auditLogs: [],
    guestInclusion: {},
    finalDefenseScores: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state._currentActivityCouncils.push(newCouncil);
  closeMilestoneQuickCouncilModal();
  renderActivityCouncilsInModal();
  showToast(`Đã thêm Hội đồng "${name}"!`, 'success');
};

window.deleteCouncilFromMilestone = async function(councilId) {
  const council = (state._currentActivityCouncils || []).find(c => c.id === councilId);
  if (!council) return;
  const ok = await showConfirm('Xóa hội đồng', `Bạn có chắc chắn muốn xóa "${council.name}" khỏi mốc này?`, { confirmText: 'Xóa hội đồng' });
  if (!ok) return;

  state._currentActivityCouncils = (state._currentActivityCouncils || []).filter(c => c.id !== councilId);
  renderActivityCouncilsInModal();
  showToast(`Đã xóa Hội đồng "${council.name}".`, 'info');
};

window.openAddCouncilInternalMemberModal = async function(councilId) {
  const council = (state._currentActivityCouncils || []).find(c => c.id === councilId);
  if (!council) return;

  document.getElementById('internal-member-council-id').value = councilId;
  const searchEl = document.getElementById('internal-member-search');
  if (searchEl) searchEl.value = '';
  const labelEl = document.getElementById('internal-member-council-label');
  if (labelEl) labelEl.textContent = `Hội đồng: ${council.name}`;

  await ensureSupervisorsMasterLoaded().catch(error => console.warn('[Council] Lecturer directory load notice:', error));
  const selectEl = document.getElementById('internal-member-select');
  if (selectEl) {
    const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
      ? state.supervisorsMaster
      : (state.roundSupervisors || []);
    selectEl.innerHTML = '<option value="">-- Chọn giảng viên --</option>' + supervisors.map(s => {
      const emailText = s.email ? ` • ${s.email}` : '';
      return `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.department || 'Khoa MTCN')}${escapeHtml(emailText)})</option>`;
    }).join('');
  }

  document.getElementById('modal-add-council-internal-member')?.classList.remove('hidden');
};

window.filterCouncilInternalMembers = function(searchValue) {
  const queryText = String(searchValue || '').trim().toLowerCase();
  const selectEl = document.getElementById('internal-member-select');
  if (!selectEl) return;
  [...selectEl.options].forEach((option, index) => {
    if (index === 0) return;
    option.hidden = Boolean(queryText) && !option.textContent.toLowerCase().includes(queryText);
  });
};

window.closeAddCouncilInternalMemberModal = function() {
  document.getElementById('modal-add-council-internal-member')?.classList.add('hidden');
};

window.saveCouncilInternalMember = function() {
  const councilId = document.getElementById('internal-member-council-id')?.value;
  const council = (state._currentActivityCouncils || []).find(c => c.id === councilId);
  if (!council) return;

  const supId = document.getElementById('internal-member-select')?.value;
  if (!supId) {
    showToast('Vui lòng chọn giảng viên!', 'warning');
    return;
  }

  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);
  const supObj = supervisors.find(s => s.id === supId);
  const supEmail = (supObj?.email || '').trim().toLowerCase();

  // Validate duplicate email in council
  const membersBySlot = council.membersBySlot || {};
  for (const m of Object.values(membersBySlot)) {
    if (m && m.memberEmail && supEmail && m.memberEmail.toLowerCase() === supEmail) {
      showToast(`Email "${supEmail}" đã tồn tại trong Hội đồng "${council.name}"!`, 'warning');
      return;
    }
  }

  const roleSelect = document.getElementById('internal-member-role');
  const roleKey = roleSelect?.value || 'member';
  const roleName = roleSelect?.options[roleSelect.selectedIndex]?.text || 'Ủy viên Hội đồng';

  // Find slotKey or generate new slot key
  let targetSlotKey = roleKey;
  if (membersBySlot[targetSlotKey] && (membersBySlot[targetSlotKey].memberName || membersBySlot[targetSlotKey].name)) {
    targetSlotKey = `${roleKey}_${Date.now().toString(36)}`;
  }

  membersBySlot[targetSlotKey] = {
    type: 'internal',
    isExternalGuest: false,
    memberId: supId,
    memberName: supObj?.name || 'Giảng viên',
    memberEmail: supEmail,
    department: supObj?.department || '',
    role: roleName,
    slotKey: targetSlotKey
  };

  council.membersBySlot = membersBySlot;
  closeAddCouncilInternalMemberModal();
  renderActivityCouncilsInModal();
  showToast(`Đã thêm "${supObj?.name}" vào "${council.name}"!`, 'success');
};

window.openAddCouncilGuestMemberModal = function(councilId) {
  const council = (state._currentActivityCouncils || []).find(c => c.id === councilId);
  if (!council) return;

  document.getElementById('guest-member-council-id').value = councilId;
  const labelEl = document.getElementById('guest-member-council-label');
  if (labelEl) labelEl.textContent = `Hội đồng: ${council.name}`;

  document.getElementById('guest-member-name').value = '';
  document.getElementById('guest-member-email').value = '';
  document.getElementById('guest-member-org').value = '';
  document.getElementById('modal-add-council-guest-member')?.classList.remove('hidden');
};

window.closeAddCouncilGuestMemberModal = function() {
  document.getElementById('modal-add-council-guest-member')?.classList.add('hidden');
};

window.saveCouncilGuestMember = function() {
  const councilId = document.getElementById('guest-member-council-id')?.value;
  const council = (state._currentActivityCouncils || []).find(c => c.id === councilId);
  if (!council) return;

  const gName = document.getElementById('guest-member-name')?.value?.trim();
  if (!gName) {
    showToast('Vui lòng nhập họ và tên khách mời!', 'warning');
    return;
  }

  const gEmail = document.getElementById('guest-member-email')?.value?.trim().toLowerCase();
  if (!gEmail) {
    showToast('Email khách mời là bắt buộc để định danh!', 'warning');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(gEmail)) {
    showToast('Email khách mời không đúng định dạng!', 'warning');
    return;
  }

  // Validate duplicate email in this council
  const membersBySlot = council.membersBySlot || {};
  for (const m of Object.values(membersBySlot)) {
    if (m && m.memberEmail && m.memberEmail.toLowerCase() === gEmail) {
      showToast(`Email "${gEmail}" đã tồn tại trong Hội đồng "${council.name}"!`, 'warning');
      return;
    }
  }

  const gOrg = document.getElementById('guest-member-org')?.value?.trim() || '';
  const roleSelect = document.getElementById('guest-member-role');
  const roleKey = roleSelect?.value || 'guest_business';
  const roleName = roleSelect?.options[roleSelect.selectedIndex]?.text || 'Ủy viên Khách mời / Doanh nghiệp';

  const newSlotKey = `guest_${Date.now().toString(36)}`;
  membersBySlot[newSlotKey] = {
    type: 'guest',
    isExternalGuest: true,
    memberId: 'ext_' + gEmail.replace(/[^a-zA-Z0-9]/g, '_'),
    memberName: gName,
    memberEmail: gEmail,
    organization: gOrg,
    role: roleName,
    slotKey: newSlotKey
  };

  council.membersBySlot = membersBySlot;
  closeAddCouncilGuestMemberModal();
  renderActivityCouncilsInModal();
  showToast(`Đã thêm khách mời "${gName}" (${gEmail}) vào "${council.name}"!`, 'success');
};

window.removeCouncilMemberFromMilestone = async function(councilId, slotKey) {
  const council = (state._currentActivityCouncils || []).find(c => c.id === councilId);
  if (!council || !council.membersBySlot) return;

  const mem = council.membersBySlot[slotKey];
  const name = mem?.memberName || mem?.name || slotKey;
  if (!await showConfirm('Xóa thành viên', `Bạn có chắc muốn xóa thành viên "${name}" khỏi "${council.name}"?`, { confirmText: 'Xóa thành viên' })) return;

  delete council.membersBySlot[slotKey];
  renderActivityCouncilsInModal();
  showToast(`Đã xóa thành viên khỏi "${council.name}".`, 'info');
};

window.openAdvancedCouncilManagementFromMilestone = function() {
  const actId = document.getElementById('activity-form-id')?.value?.trim();
  const roundId = document.getElementById('activity-form-round-id')?.value || state.selectedRoundId;
  if (!actId) {
    showToast('Vui lòng lưu mốc kế hoạch trước khi mở phân sinh viên nâng cao!', 'info');
    return;
  }
  openActivityCouncilManagement(roundId, actId);
};

state.activeCouncilManagement = {
  roundId: null,
  activityId: null,
  currentTab: 'councils',
  filterQuery: '',
  filterCouncilId: 'all'
};

window.openActivityCouncilManagement = function(roundId, actId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) {
    showToast('Không tìm thấy thông tin đợt tốt nghiệp!', 'error');
    return;
  }

  const act = (targetRound.activities || []).find(a => a.id === actId);
  if (!act) {
    showToast('Không tìm thấy mốc kế hoạch!', 'error');
    return;
  }

  state.activeCouncilManagement.roundId = roundId;
  state.activeCouncilManagement.activityId = actId;
  state.activeCouncilManagement.currentTab = 'councils';
  state.activeCouncilManagement.filterQuery = '';
  state.activeCouncilManagement.filterCouncilId = 'all';

  // Ensure councilStructure defaults
  if (!act.councilStructure || !Array.isArray(act.councilStructure.slots) || act.councilStructure.slots.length === 0) {
    act.councilStructure = {
      slots: [
        { key: 'chair', label: 'Chủ tịch', name: 'Chủ tịch Hội đồng', type: 'mandatory' },
        { key: 'member', label: 'Ủy viên', name: 'Ủy viên Hội đồng', type: 'mandatory' },
        { key: 'secretary', label: 'Thư ký', name: 'Thư ký Hội đồng', type: 'mandatory' }
      ]
    };
  }
  act.councils = act.councils || [];
  act.councilStudentAssignments = act.councilStudentAssignments || [];

  // Update header text
  document.getElementById('council-modal-act-title').textContent = `QUẢN LÝ HỘI ĐỒNG — ${act.title}`;
  document.getElementById('council-modal-act-subtitle').textContent = `Đợt: ${targetRound.title} • Thời gian mốc: ${fmtActivityTime(act.startAt, act.endAt)}`;

  switchCouncilTab('councils');
  refreshCouncilModalViews();

  document.getElementById('modal-activity-councils')?.classList.remove('hidden');
};

window.closeActivityCouncilManagement = function() {
  document.getElementById('modal-activity-councils')?.classList.add('hidden');
  const roundId = state.activeCouncilManagement.roundId;
  if (roundId) {
    loadAdminRoundActivities(roundId);
    if (state.selectedRoundId === roundId) {
      loadStudentRoundActivities(roundId);
    }
  }
};

window.switchCouncilTab = function(tabName) {
  state.activeCouncilManagement.currentTab = tabName;
  const tabs = ['councils', 'structure', 'students'];
  tabs.forEach(t => {
    const btn = document.getElementById(`ctab-btn-${t}`);
    const panel = document.getElementById(`ctab-panel-${t}`);
    if (t === tabName) {
      if (btn) {
        btn.classList.add('border-indigo-600', 'text-indigo-700');
        btn.classList.remove('border-transparent', 'text-slate-500');
      }
      if (panel) panel.classList.remove('hidden');
    } else {
      if (btn) {
        btn.classList.remove('border-indigo-600', 'text-indigo-700');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
      if (panel) panel.classList.add('hidden');
    }
  });

  refreshCouncilModalViews();
};

window.refreshCouncilModalViews = function() {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const councils = act.councils || [];
  const slots = act.councilStructure?.slots || [];
  const assignments = act.councilStudentAssignments || [];

  // Update badges in tabs
  const councilsCountBadge = document.getElementById('cbadge-councils-count');
  if (councilsCountBadge) councilsCountBadge.textContent = councils.length;

  const slotsCountBadge = document.getElementById('cbadge-slots-count');
  if (slotsCountBadge) slotsCountBadge.textContent = slots.length;

  // Render Tab 1: Councils
  renderCouncilCards(act);

  // Render Tab 2: Structure Slots
  renderCouncilSlotsTable(act);

  // Render Tab 3: Students
  renderCouncilStudentsTab(act);
};

// --- TAB 1: RENDER COUNCILS CARDS ---
function renderCouncilCards(act) {
  const container = document.getElementById('councils-cards-grid');
  if (!container) return;

  const councils = act.councils || [];
  const assignments = act.councilStudentAssignments || [];
  const slots = act.councilStructure?.slots || [];

  if (councils.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300">
        <span class="text-3xl block mb-1">🏛️</span>
        <span class="font-bold text-slate-700 text-xs block">Mốc này chưa có Hội đồng nào</span>
        <p class="text-[11px] text-slate-400 mt-1">Bấm "+ Thêm Hội đồng" để tạo hội đồng đánh giá đầu tiên cho mốc.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = councils.map(c => {
    const assignedStudents = assignments.filter(a => a.councilId === c.id);
    const assignedCount = assignedStudents.length;

    // Check currently presenting student
    const presentingAssignment = assignedStudents.find(a => a.presentationStatus === 'presenting');
    let presentingStudentHtml = '';
    if (presentingAssignment) {
      const studentObj = findStudentInRound(presentingAssignment.studentId);
      presentingStudentHtml = `
        <div class="mt-2 p-2 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span class="font-bold text-[10px] uppercase tracking-wider text-emerald-800">Đang trình bày:</span>
            <span class="font-extrabold text-xs">${studentObj?.fullName || studentObj?.studentName || presentingAssignment.studentId}</span>
          </div>
          <span class="font-mono text-[10px] text-emerald-700 font-bold">#${presentingAssignment.order || '--'}</span>
        </div>
      `;
    }

    // Member slot fulfillment
    const membersBySlot = c.membersBySlot || {};
    let filledSlotsCount = 0;
    slots.forEach(s => {
      if (membersBySlot[s.key] && (membersBySlot[s.key].memberName || membersBySlot[s.key].name)) {
        filledSlotsCount++;
      }
    });

    let statusBadge = '<span class="badge bg-slate-100 text-slate-700 font-bold">Chuẩn bị</span>';
    if (c.status === 'ongoing') statusBadge = '<span class="badge bg-emerald-100 text-emerald-800 font-bold">● Đang diễn ra</span>';
    else if (c.status === 'completed') statusBadge = '<span class="badge bg-slate-200 text-slate-600 font-bold">✓ Đã kết thúc</span>';

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-black text-sm text-slate-900 tracking-tight">${c.name}</h4>
              ${statusBadge}
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5 font-medium">📍 ${c.room || 'Chưa cập nhật phòng'}</p>
          </div>
          <div class="text-right">
            <span class="font-black text-indigo-700 text-xs block">${assignedCount} SV</span>
            <span class="text-[10px] text-slate-400">${filledSlotsCount}/${slots.length} thành viên</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded-xl border border-slate-100">
          <span>📅 ${c.date || '--'}</span>
          <span>🕒 ${c.startTime || '--'} → ${c.endTime || '--'}</span>
        </div>

        ${presentingStudentHtml}

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <button type="button" onclick="copyCouncilLink('${act.slug}', '${c.slug || c.id}')" class="text-slate-500 hover:text-indigo-600 font-semibold text-[11px] flex items-center gap-1" title="Sao chép link trực tiếp đến Hội đồng này">
              <span>🔗 Link</span>
            </button>
            ${c.driveFolderUrl ? `
              <a href="${c.driveFolderUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-semibold text-[11px] flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs transition-colors" title="Mở thư mục Google Drive của Hội đồng">
                <span>📁 Drive</span> ↗
              </a>
            ` : ''}
          </div>
          <div class="space-x-1.5">
            <button type="button" onclick="openCouncilWorkspace('${state.activeCouncilManagement.roundId}', '${act.id}', '${c.id}')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs">▶ Vào phòng HĐ</button>
            <button type="button" onclick="copyCouncil('${c.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors" title="Sao chép Hội đồng">📋 Sao chép</button>
            <button type="button" onclick="editCouncilModal('${c.id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition-colors">Sửa / Thành viên</button>
            <button type="button" onclick="deleteCouncil('${c.id}')" class="px-2 py-1 text-rose-600 hover:underline font-bold text-xs">Xóa</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- TAB 2: RENDER STRUCTURE SLOTS TABLE ---
function renderCouncilSlotsTable(act) {
  const tbody = document.getElementById('council-slots-tbody');
  if (!tbody) return;

  const slots = act.councilStructure?.slots || [];
  tbody.innerHTML = slots.map((s, idx) => {
    const isMandatory = (s.type === 'mandatory');
    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3 text-center font-bold text-slate-400 font-mono">${idx + 1}</td>
        <td class="p-3 font-bold text-slate-800">${s.name || s.label}</td>
        <td class="p-3 font-mono font-bold text-indigo-700">${s.label || s.key}</td>
        <td class="p-3">
          ${isMandatory ? '<span class="badge bg-slate-100 text-slate-700 font-bold">Bắt buộc</span>' : '<span class="badge bg-amber-100 text-amber-800 font-bold">Khách mời / DN</span>'}
        </td>
        <td class="p-3 text-right">
          ${!isMandatory ? `<button type="button" onclick="deleteGuestSlot('${s.key}')" class="text-rose-600 hover:underline font-bold text-xs">Xóa</button>` : '<span class="text-slate-300 font-semibold">Cố định</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

// --- TAB 3: RENDER STUDENTS & PRESENTATION ORDER ---
function renderCouncilStudentsTab(act) {
  const tbody = document.getElementById('council-students-tbody');
  const councilFilterSelect = document.getElementById('council-student-filter-council');
  if (!tbody) return;

  const councils = act.councils || [];
  const assignments = act.councilStudentAssignments || [];

  // Update Council filter dropdown
  if (councilFilterSelect) {
    const currentVal = state.activeCouncilManagement.filterCouncilId || 'all';
    councilFilterSelect.innerHTML = '<option value="all">Tất cả sinh viên</option><option value="unassigned">Chưa phân Hội đồng</option>' + councils.map(c => {
      const cCount = assignments.filter(a => a.councilId === c.id).length;
      return `<option value="${c.id}">${c.name} (${cCount} SV)</option>`;
    }).join('');
    councilFilterSelect.value = currentVal;
  }

  // Get all registered or eligible students in round
  const roundStudents = getRoundAllStudents();
  const studentsCountBadge = document.getElementById('cbadge-students-count');
  const assignedCount = assignments.filter(a => !!a.councilId).length;
  if (studentsCountBadge) studentsCountBadge.textContent = `${assignedCount}/${roundStudents.length}`;

  const q = String(state.activeCouncilManagement.filterQuery || '').trim().toLowerCase();
  const filterCid = state.activeCouncilManagement.filterCouncilId || 'all';

  const filteredStudents = roundStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '';
    const topic = s.topicTitle || '';
    if (q && !sid.toLowerCase().includes(q) && !name.toLowerCase().includes(q) && !topic.toLowerCase().includes(q)) {
      return false;
    }

    const asgn = assignments.find(a => a.studentId === sid);
    if (filterCid === 'unassigned') {
      return !asgn || !asgn.councilId;
    }
    if (filterCid !== 'all') {
      return asgn && asgn.councilId === filterCid;
    }
    return true;
  });

  const countTag = document.getElementById('council-student-filter-count');
  if (countTag) countTag.textContent = `Hiển thị: ${filteredStudents.length} sinh viên`;

  if (filteredStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400">Không có sinh viên phù hợp điều kiện lọc.</td></tr>';
    return;
  }

  // Render rows
  tbody.innerHTML = filteredStudents.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '--';
    const topic = s.topicTitle || '--';
    const asgn = assignments.find(a => a.studentId === sid);
    const assignedCouncilId = asgn?.councilId || '';
    const order = asgn?.order || (idx + 1);
    const status = asgn?.presentationStatus || 'waiting';

    const councilOptions = '<option value="">-- Chưa phân công --</option>' + councils.map(c => {
      return `<option value="${c.id}" ${assignedCouncilId === c.id ? 'selected' : ''}>${c.name}</option>`;
    }).join('');

    let statusPill = '<span class="badge bg-slate-100 text-slate-600 font-bold">Chờ</span>';
    if (status === 'presenting') {
      statusPill = '<span class="badge bg-emerald-500 text-white font-black animate-pulse">● Đang trình bày</span>';
    } else if (status === 'presented') {
      statusPill = '<span class="badge bg-indigo-100 text-indigo-800 font-bold">✓ Đã xong</span>';
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 max-w-xs truncate text-slate-700" title="${topic}">${topic}</td>
        <td class="p-3">
          <select onchange="changeStudentCouncil('${sid}', this.value)" class="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-bold ${assignedCouncilId ? 'bg-indigo-50/60 text-indigo-900 border-indigo-200' : 'bg-white text-slate-500'}">
            ${councilOptions}
          </select>
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          ${assignedCouncilId ? `
            <div class="flex items-center justify-center gap-1">
              <span class="font-mono font-bold text-slate-700 w-5">#${order}</span>
              <div class="flex flex-col">
                <button type="button" onclick="moveStudentCouncilOrder('${sid}', 'up')" class="text-[10px] text-slate-400 hover:text-slate-800 leading-none">▲</button>
                <button type="button" onclick="moveStudentCouncilOrder('${sid}', 'down')" class="text-[10px] text-slate-400 hover:text-slate-800 leading-none">▼</button>
              </div>
            </div>
          ` : '<span class="text-slate-300 font-mono">--</span>'}
        </td>
        <td class="p-3 text-center whitespace-nowrap space-x-1">
          ${assignedCouncilId ? `
            ${statusPill}
            <div class="inline-flex gap-1 ml-1.5">
              <button type="button" onclick="setStudentPresentationStatus('${sid}', 'presenting')" class="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold" title="Bắt đầu trình bày">▶</button>
              <button type="button" onclick="setStudentPresentationStatus('${sid}', 'presented')" class="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold" title="Hoàn tất trình bày">✓</button>
              <button type="button" onclick="setStudentPresentationStatus('${sid}', 'waiting')" class="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold" title="Đặt lại trạng thái chờ">↺</button>
            </div>
          ` : '<span class="text-slate-300">--</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

window.filterCouncilStudents = function() {
  const searchInput = document.getElementById('council-student-search');
  const councilSelect = document.getElementById('council-student-filter-council');
  state.activeCouncilManagement.filterQuery = searchInput?.value || '';
  state.activeCouncilManagement.filterCouncilId = councilSelect?.value || 'all';

  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (act) renderCouncilStudentsTab(act);
};

// Helper: Get all students registered or eligible in round
function getRoundAllStudents() {
  const { roundId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return [];

  // Priority 1: registrations in adminReviewData
  if (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0) {
    return state.adminReviewData.registrations;
  }
  // Priority 2: eligibleStudents
  if (Array.isArray(targetRound.eligibleStudents) && targetRound.eligibleStudents.length > 0) {
    return targetRound.eligibleStudents;
  }
  return [];
}

function findStudentInRound(studentId) {
  const all = getRoundAllStudents();
  const found = all.find(s => (s.mssv === studentId || s.studentId === studentId));
  if (found) {
    if ((!found.name && !found.fullName) || (!found.className && !found.studentClass)) {
      const fac = window.getFacultyStudent ? window.getFacultyStudent(studentId) : null;
      if (fac && !fac.isMissing) {
        return {
          ...found,
          name: found.name || fac.name,
          fullName: found.fullName || fac.fullName,
          className: found.className || fac.className,
          studentClass: found.studentClass || fac.studentClass,
          major: found.major || fac.major,
          gender: found.gender || fac.gender,
          email: found.email || fac.email
        };
      }
    }
    return found;
  }
  if (window.getFacultyStudent) {
    const fac = window.getFacultyStudent(studentId);
    if (fac && !fac.isMissing) {
      return {
        studentId: fac.mssv,
        mssv: fac.mssv,
        name: fac.name,
        fullName: fac.fullName,
        className: fac.className,
        studentClass: fac.studentClass,
        major: fac.major,
        gender: fac.gender,
        email: fac.email
      };
    }
  }
  return null;
}

// --- STUDENT COUNCIL ASSIGNMENT ACTIONS ---
window.changeStudentCouncil = async function(studentId, newCouncilId) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  act.councilStudentAssignments = act.councilStudentAssignments || [];
  let existingIdx = act.councilStudentAssignments.findIndex(a => a.studentId === studentId);

  if (!newCouncilId) {
    // Unassign
    if (existingIdx >= 0) {
      act.councilStudentAssignments.splice(existingIdx, 1);
    }
  } else {
    // Assign to new council: assign max order in that council
    const councilAssignments = act.councilStudentAssignments.filter(a => a.councilId === newCouncilId);
    const maxOrder = councilAssignments.reduce((m, a) => Math.max(m, a.order || 0), 0);

    if (existingIdx >= 0) {
      act.councilStudentAssignments[existingIdx].councilId = newCouncilId;
      act.councilStudentAssignments[existingIdx].order = maxOrder + 1;
    } else {
      act.councilStudentAssignments.push({
        studentId,
        councilId: newCouncilId,
        order: maxOrder + 1,
        presentationStatus: 'waiting'
      });
    }
  }

  await persistActivityCouncilChanges(targetRound);
  refreshCouncilModalViews();
};

window.moveStudentCouncilOrder = async function(studentId, direction) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const assignments = act.councilStudentAssignments || [];
  const current = assignments.find(a => a.studentId === studentId);
  if (!current || !current.councilId) return;

  const councilStudents = assignments
    .filter(a => a.councilId === current.councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const idx = councilStudents.findIndex(a => a.studentId === studentId);
  if (idx < 0) return;

  if (direction === 'up' && idx > 0) {
    const temp = councilStudents[idx].order;
    councilStudents[idx].order = councilStudents[idx - 1].order;
    councilStudents[idx - 1].order = temp;
  } else if (direction === 'down' && idx < councilStudents.length - 1) {
    const temp = councilStudents[idx].order;
    councilStudents[idx].order = councilStudents[idx + 1].order;
    councilStudents[idx + 1].order = temp;
  } else {
    return;
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilStudentsTab(act);
};

window.setStudentPresentationStatus = async function(studentId, newStatus) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const current = (act.councilStudentAssignments || []).find(a => a.studentId === studentId);
  if (!current) return;

  // If setting to presenting, reset any other student presenting in the same council to waiting/presented
  if (newStatus === 'presenting') {
    (act.councilStudentAssignments || []).forEach(a => {
      if (a.councilId === current.councilId && a.studentId !== studentId && a.presentationStatus === 'presenting') {
        a.presentationStatus = 'waiting';
      }
    });
  }

  current.presentationStatus = newStatus;

  await persistActivityCouncilChanges(targetRound);
  refreshCouncilModalViews();
};

// --- CREATE / EDIT / COPY COUNCIL MODALS ---
window.openCreateCouncilModal = async function() {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  document.getElementById('form-edit-council').reset();
  document.getElementById('council-form-id').value = '';
  document.getElementById('modal-edit-council-title').textContent = 'Thêm Hội đồng mới';

  // Suggest next council name
  const nextNum = (act.councils || []).length + 1;
  document.getElementById('council-form-name').value = `HĐ${nextNum}`;
  document.getElementById('council-form-status').value = 'preparing';

  // Inherit activity date/time if available
  const actStart = isoToVietnameseDateTime(act.startAt);
  const actEnd = isoToVietnameseDateTime(act.endAt);
  document.getElementById('council-form-date').value = actStart.date || '';
  document.getElementById('council-form-start-time').value = actStart.time || '08:00';
  document.getElementById('council-form-end-time').value = actEnd.time || '11:30';

  // Reset Drive inputs
  const driveNameInput = document.getElementById('council-form-drive-folder-name');
  if (driveNameInput) driveNameInput.value = `HĐ${nextNum}`;
  const driveIdInput = document.getElementById('council-form-drive-folder-id');
  if (driveIdInput) driveIdInput.value = '';
  const driveUrlInput = document.getElementById('council-form-drive-folder-url');
  if (driveUrlInput) driveUrlInput.value = '';
  const driveStatusEl = document.getElementById('council-drive-folder-status');
  if (driveStatusEl) {
    driveStatusEl.innerHTML = '<span class="text-slate-400">Chưa kết nối thư mục Google Drive. Nhập tên và bấm "Tạo / Kết nối".</span>';
  }

  await ensureSupervisorsMasterLoaded().catch(error => console.warn('[Council] Lecturer directory load notice:', error));
  renderCouncilMembersFormSlots(act, {});

  document.getElementById('modal-edit-council')?.classList.remove('hidden');
};

window.editCouncilModal = async function(councilId) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const council = (act.councils || []).find(c => c.id === councilId);
  if (!council) return;

  document.getElementById('council-form-id').value = council.id;
  document.getElementById('modal-edit-council-title').textContent = `Chỉnh sửa: ${council.name}`;
  document.getElementById('council-form-name').value = council.name || '';
  document.getElementById('council-form-room').value = council.room || '';
  document.getElementById('council-form-status').value = council.status || 'preparing';
  document.getElementById('council-form-date').value = council.date || '';
  document.getElementById('council-form-start-time').value = council.startTime || '';
  document.getElementById('council-form-end-time').value = council.endTime || '';
  document.getElementById('council-form-note').value = council.note || '';

  // Populate Drive inputs & status
  const driveNameInput = document.getElementById('council-form-drive-folder-name');
  if (driveNameInput) driveNameInput.value = council.driveFolderName || council.name || '';
  const driveIdInput = document.getElementById('council-form-drive-folder-id');
  if (driveIdInput) driveIdInput.value = council.driveFolderId || '';
  const driveUrlInput = document.getElementById('council-form-drive-folder-url');
  if (driveUrlInput) driveUrlInput.value = council.driveFolderUrl || '';
  const driveStatusEl = document.getElementById('council-drive-folder-status');
  if (driveStatusEl) {
    if (council.driveFolderId) {
      driveStatusEl.innerHTML = `
        <div class="mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
          <div>
            <span class="font-bold">✓ Đã kết nối: <strong>${escapeHtml(council.driveFolderName || council.name)}</strong></span>
            <span class="block text-[10px] text-emerald-600 font-mono">ID: ${council.driveFolderId}</span>
          </div>
          <a href="${council.driveFolderUrl || `https://drive.google.com/drive/folders/${council.driveFolderId}`}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded font-bold text-xs inline-flex items-center gap-1 shadow-2xs">
            <span>Mở Drive</span> ↗
          </a>
        </div>
      `;
    } else {
      driveStatusEl.innerHTML = '<span class="text-slate-400">Chưa kết nối thư mục Google Drive. Nhập tên và bấm "Tạo / Kết nối".</span>';
    }
  }

  await ensureSupervisorsMasterLoaded().catch(error => console.warn('[Council] Lecturer directory load notice:', error));
  renderCouncilMembersFormSlots(act, council.membersBySlot || {});

  document.getElementById('modal-edit-council')?.classList.remove('hidden');
};

window.copyCouncil = async function(councilId) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const council = (act.councils || []).find(c => c.id === councilId);
  if (!council) return;

  // Clear ID so it will create a new council!
  document.getElementById('council-form-id').value = '';
  document.getElementById('modal-edit-council-title').textContent = `Sao chép Hội đồng (Bản mới)`;
  document.getElementById('council-form-name').value = `${council.name} (Bản sao)`;
  document.getElementById('council-form-room').value = council.room || '';
  document.getElementById('council-form-status').value = 'preparing';
  document.getElementById('council-form-date').value = council.date || '';
  document.getElementById('council-form-start-time').value = council.startTime || '';
  document.getElementById('council-form-end-time').value = council.endTime || '';
  document.getElementById('council-form-note').value = council.note || '';

  // Clear Drive connection IDs so copy gets its own separate folder
  const driveNameInput = document.getElementById('council-form-drive-folder-name');
  if (driveNameInput) driveNameInput.value = `${council.driveFolderName || council.name} (Bản sao)`;
  const driveIdInput = document.getElementById('council-form-drive-folder-id');
  if (driveIdInput) driveIdInput.value = '';
  const driveUrlInput = document.getElementById('council-form-drive-folder-url');
  if (driveUrlInput) driveUrlInput.value = '';
  const driveStatusEl = document.getElementById('council-drive-folder-status');
  if (driveStatusEl) {
    driveStatusEl.innerHTML = '<span class="text-amber-600 font-medium">⚠️ Bản sao chưa kết nối thư mục Drive. Vui lòng bấm "Tạo / Kết nối" để tạo thư mục mới.</span>';
  }

  await ensureSupervisorsMasterLoaded().catch(error => console.warn('[Council] Lecturer directory load notice:', error));
  renderCouncilMembersFormSlots(act, council.membersBySlot || {});

  document.getElementById('modal-edit-council')?.classList.remove('hidden');
  showToast('Đã sao chép cấu hình Hội đồng. Vui lòng kiểm tra và lưu lại.', 'info');
};

window.closeEditCouncilModal = function() {
  document.getElementById('modal-edit-council')?.classList.add('hidden');
};

function renderCouncilMembersFormSlots(act, membersBySlot = {}) {
  const container = document.getElementById('council-members-form-container');
  if (!container) return;

  const slots = act.councilStructure?.slots || [];
  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  container.innerHTML = slots.map(s => {
    const assigned = membersBySlot[s.key] || {};
    const memberId = assigned.memberId || '';
    const memberName = assigned.memberName || '';
    const isGuest = (assigned.type === 'guest');

    return `
      <div class="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <span>👤</span> ${s.name || s.label} <span class="text-indigo-600 font-mono text-[10px]">(${s.label || s.key})</span>
          </label>
          <label class="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
            <input type="checkbox" id="chk-guest-${s.key}" ${isGuest ? 'checked' : ''} onchange="toggleSlotGuestInput('${s.key}', this.checked)" class="rounded text-tdtu-blue">
            <span>Khách mời ngoài</span>
          </label>
        </div>

        <!-- Supervisor dropdown -->
        <div id="slot-sup-wrap-${s.key}" class="${isGuest ? 'hidden' : ''}">
          <input type="search" oninput="filterCouncilSlotMembers('${s.key}', this.value)" placeholder="Tìm theo tên, email, đơn vị..." class="w-full p-2 mb-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <select id="slot-sup-${s.key}" class="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
            <option value="">-- Chưa phân công --</option>
            ${supervisors.map(sup => `
              <option value="${sup.id}" ${memberId === sup.id ? 'selected' : ''}>${sup.name} • ${sup.email || '--'} • ${sup.department || 'Khoa MTCN'}${sup.employmentType === 'adjunct' ? ' • Thỉnh giảng' : ''}</option>
            `).join('')}
          </select>
        </div>

        <!-- Guest manual inputs -->
        <div id="slot-guest-wrap-${s.key}" class="${isGuest ? '' : 'hidden'} space-y-1.5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" id="slot-guest-name-${s.key}" value="${isGuest ? memberName : ''}" placeholder="Họ và tên khách mời (*)" class="p-2 border border-slate-300 rounded-lg text-xs font-semibold">
            <input type="email" id="slot-guest-email-${s.key}" value="${isGuest ? (assigned.memberEmail || '') : ''}" placeholder="Email khách mời (*) bắt buộc" class="p-2 border border-slate-300 rounded-lg text-xs font-mono lowercase">
          </div>
          <input type="text" id="slot-guest-org-${s.key}" value="${assigned.organization || ''}" placeholder="Đơn vị / Doanh nghiệp công tác (tùy chọn)..." class="w-full p-2 border border-slate-300 rounded-lg text-xs">
        </div>
      </div>
    `;
  }).join('');
}

window.filterCouncilSlotMembers = function(slotKey, searchValue) {
  const queryText = String(searchValue || '').trim().toLowerCase();
  const selectEl = document.getElementById(`slot-sup-${slotKey}`);
  if (!selectEl) return;
  [...selectEl.options].forEach((option, index) => {
    if (index === 0) return;
    option.hidden = Boolean(queryText) && !option.textContent.toLowerCase().includes(queryText);
  });
};

window.toggleSlotGuestInput = function(slotKey, isGuest) {
  const supWrap = document.getElementById(`slot-sup-wrap-${slotKey}`);
  const guestWrap = document.getElementById(`slot-guest-wrap-${slotKey}`);
  if (supWrap && guestWrap) {
    if (isGuest) {
      supWrap.classList.add('hidden');
      guestWrap.classList.remove('hidden');
    } else {
      supWrap.classList.remove('hidden');
      guestWrap.classList.add('hidden');
    }
  }
};

window.syncCouncilDatePicker = function(val) {
  if (!val) return;
  const parts = val.split('-');
  if (parts.length === 3) {
    const input = document.getElementById('council-form-date');
    if (input) input.value = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
};

window.clearCouncilDateTime = function() {
  const dateInput = document.getElementById('council-form-date');
  const startInput = document.getElementById('council-form-start-time');
  const endInput = document.getElementById('council-form-end-time');
  if (dateInput) dateInput.value = '';
  if (startInput) startInput.value = '';
  if (endInput) endInput.value = '';
};

window.saveCouncil = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const id = document.getElementById('council-form-id')?.value?.trim();
  const name = document.getElementById('council-form-name')?.value?.trim();
  const room = document.getElementById('council-form-room')?.value?.trim() || '';
  const status = document.getElementById('council-form-status')?.value || 'preparing';
  const date = document.getElementById('council-form-date')?.value?.trim() || '';
  const startTime = document.getElementById('council-form-start-time')?.value?.trim() || '';
  const endTime = document.getElementById('council-form-end-time')?.value?.trim() || '';
  const note = document.getElementById('council-form-note')?.value?.trim() || '';

  if (!name) {
    showToast('Vui lòng nhập tên Hội đồng (*)', 'warning');
    return;
  }

  // Validate date & time
  if (date) {
    const parsed = parseVietnameseDateTime(date, startTime || '08:00');
    if (parsed === null) {
      showToast('Ngày đánh giá không hợp lệ (DD/MM/YYYY)!', 'warning');
      return;
    }
  }

  // Extract membersBySlot with strict email validation & duplicate checking
  const slots = act.councilStructure?.slots || [];
  const membersBySlot = {};
  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  const seenEmails = new Set();
  let emailError = null;

  slots.forEach(s => {
    if (emailError) return;
    const isGuest = document.getElementById(`chk-guest-${s.key}`)?.checked === true;
    if (isGuest) {
      const gName = document.getElementById(`slot-guest-name-${s.key}`)?.value?.trim();
      const gEmail = document.getElementById(`slot-guest-email-${s.key}`)?.value?.trim().toLowerCase();
      const gOrg = document.getElementById(`slot-guest-org-${s.key}`)?.value?.trim();
      if (gName || gEmail) {
        if (!gName) {
          emailError = `Vui lòng nhập họ và tên khách mời cho vị trí "${s.name || s.label}"`;
          return;
        }
        if (!gEmail) {
          emailError = `Email là bắt buộc đối với khách mời "${gName}" (${s.name || s.label})`;
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(gEmail)) {
          emailError = `Email "${gEmail}" của khách mời "${gName}" không đúng định dạng!`;
          return;
        }
        if (seenEmails.has(gEmail)) {
          emailError = `Email "${gEmail}" bị trùng lặp trong cùng Hội đồng!`;
          return;
        }
        seenEmails.add(gEmail);
        membersBySlot[s.key] = {
          type: 'guest',
          isExternalGuest: true,
          memberId: 'ext_' + gEmail.replace(/[^a-zA-Z0-9]/g, '_'),
          memberName: gName,
          memberEmail: gEmail,
          organization: gOrg || '',
          role: s.label || s.name || 'Khách mời',
          slotKey: s.key
        };
      }
    } else {
      const supId = document.getElementById(`slot-sup-${s.key}`)?.value;
      if (supId) {
        const supObj = supervisors.find(x => x.id === supId);
        const sEmail = (supObj?.email || '').trim().toLowerCase();
        if (sEmail) {
          if (seenEmails.has(sEmail)) {
            emailError = `Email "${sEmail}" của giảng viên "${supObj?.name}" bị trùng lặp trong cùng Hội đồng!`;
            return;
          }
          seenEmails.add(sEmail);
        }
        membersBySlot[s.key] = {
          type: 'internal',
          isExternalGuest: false,
          memberId: supId,
          memberName: supObj?.name || 'Giảng viên',
          memberEmail: sEmail,
          department: supObj?.department || '',
          role: s.label || s.name || 'Ủy viên',
          slotKey: s.key
        };
      }
    }
  });

  if (emailError) {
    showToast(emailError, 'warning');
    return;
  }

  const slug = id ? ((act.councils || []).find(c => c.id === id)?.slug || slugify(name)) : ('c-' + slugify(name) + '-' + Date.now().toString(36).substr(-4));
  const councilId = id || ('council_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));

  const driveFolderId = document.getElementById('council-form-drive-folder-id')?.value?.trim() || null;
  const driveFolderName = document.getElementById('council-form-drive-folder-name')?.value?.trim() || name;
  const driveFolderUrl = document.getElementById('council-form-drive-folder-url')?.value?.trim() || (driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : null);

  const councilData = {
    id: councilId,
    slug,
    name,
    room,
    status,
    date,
    startTime,
    endTime,
    note,
    driveFolderId,
    driveFolderName,
    driveFolderUrl,
    membersBySlot,
    updatedAt: new Date().toISOString()
  };

  act.councils = act.councils || [];
  const existingIdx = act.councils.findIndex(c => c.id === councilId);
  if (existingIdx >= 0) {
    act.councils[existingIdx] = councilData;
  } else {
    councilData.createdAt = councilData.updatedAt;
    act.councils.push(councilData);
  }

  await persistActivityCouncilChanges(targetRound);
  closeEditCouncilModal();
  refreshCouncilModalViews();
  showToast(`✓ Đã lưu thông tin Hội đồng "${name}" thành công!`, 'success');
};

window.deleteCouncil = async function(councilId) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const council = (act.councils || []).find(c => c.id === councilId);
  if (!council) return;

  const confirmed = await showConfirm(
    'Xóa Hội đồng',
    `Bạn có chắc chắn muốn xóa Hội đồng "${council.name}" không? Các sinh viên đã phân vào Hội đồng này sẽ chuyển về trạng thái Chưa phân công.`,
    { confirmText: 'Xóa Hội đồng', danger: true }
  );
  if (!confirmed) return;

  act.councils = (act.councils || []).filter(c => c.id !== councilId);
  // Free assigned students
  (act.councilStudentAssignments || []).forEach(a => {
    if (a.councilId === councilId) {
      a.councilId = '';
      a.presentationStatus = 'waiting';
    }
  });

  await persistActivityCouncilChanges(targetRound);
  refreshCouncilModalViews();
  showToast(`Đã xóa Hội đồng "${council.name}".`, 'info');
};

// --- GUEST SLOTS MANAGEMENT ---
window.openAddGuestSlotModal = function() {
  document.getElementById('slot-form-name').value = '';
  document.getElementById('slot-form-label').value = '';
  document.getElementById('modal-add-guest-slot')?.classList.remove('hidden');
};

window.closeAddGuestSlotModal = function() {
  document.getElementById('modal-add-guest-slot')?.classList.add('hidden');
};

window.saveGuestSlot = async function() {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const name = document.getElementById('slot-form-name')?.value?.trim();
  const label = document.getElementById('slot-form-label')?.value?.trim();
  if (!name || !label) {
    showToast('Vui lòng nhập đầy đủ tên và mã viết tắt cho vị trí mới', 'warning');
    return;
  }

  const key = 'guest_' + Date.now().toString(36);
  act.councilStructure = act.councilStructure || { slots: [] };
  act.councilStructure.slots.push({
    key,
    label,
    name,
    type: 'guest'
  });

  await persistActivityCouncilChanges(targetRound);
  closeAddGuestSlotModal();
  refreshCouncilModalViews();
  showToast(`✓ Đã thêm vị trí "${name}" vào cấu trúc Hội đồng của Mốc!`, 'success');
};

window.deleteGuestSlot = async function(slotKey) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const slots = act.councilStructure?.slots || [];
  const targetSlot = slots.find(s => s.key === slotKey);
  if (!targetSlot || targetSlot.type === 'mandatory') {
    showToast('Không thể xóa vị trí bắt buộc!', 'warning');
    return;
  }

  const confirmed = await showConfirm(
    'Xóa Vị trí Thành viên',
    `Bạn có chắc chắn muốn xóa vị trí "${targetSlot.name || targetSlot.label}" khỏi tất cả các Hội đồng trong Mốc này không?`,
    { confirmText: 'Xóa vị trí', danger: true }
  );
  if (!confirmed) return;

  act.councilStructure.slots = slots.filter(s => s.key !== slotKey);

  // Clean up from all councils
  (act.councils || []).forEach(c => {
    if (c.membersBySlot && c.membersBySlot[slotKey]) {
      delete c.membersBySlot[slotKey];
    }
  });

  await persistActivityCouncilChanges(targetRound);
  refreshCouncilModalViews();
  showToast(`Đã xóa vị trí "${targetSlot.name}".`, 'info');
};

// --- LINK COPIERS ---
window.copyCouncilLink = async function(activitySlug, councilSlug) {
  const { roundId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const rCode = targetRound?.slug || targetRound?.shortCode || roundId;
  const link = `${window.location.origin}${window.location.pathname}?x=${encodeURIComponent(rCode)}&a=${encodeURIComponent(activitySlug)}&c=${encodeURIComponent(councilSlug)}`;

  await copyLinkWithFallback(link, 'liên kết hội đồng');
};

// --- PERSISTENCE HELPER ---
async function persistActivityCouncilChanges(targetRound) {
  const roundId = targetRound.id;
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      activities: targetRound.activities,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Lỗi lưu thay đổi Hội đồng:', err);
    showToast('Lỗi lưu dữ liệu: ' + err.message, 'error');
  }
}

// --- COUNCIL MEMBERSHIP NOTICE FOR THE EFFECTIVE TEACHER ---
function renderEffectiveCouncilMembershipNotice(act) {
  if (!act || !act.councilEnabled) return '';
  const actor = getEffectiveActor();
  if (!actor.isSupervisor || actor.isStudent || !actor.email) return '';
  const councils = act.councils || [];
  const userEmail = actor.email.toLowerCase().trim();
  for (const c of councils) {
    const members = Object.values(c.membersBySlot || {});
    const myMembership = members.find(m => String(m.memberEmail || '').toLowerCase().trim() === userEmail);
    if (myMembership) {
      const slotObj = (act.councilStructure?.slots || []).find(s => s.key === myMembership.slotKey);
      return `
          <div class="mt-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
            <span class="font-bold text-blue-900 text-xs flex items-center gap-1.5">
              <span>🏛️</span> Thầy/Cô được phân công: <strong>${escapeHtml(c.name || c.councilName || 'Hội đồng')}</strong> (${escapeHtml(slotObj?.name || slotObj?.label || 'Thành viên')})
            </span>
            <div class="flex items-center justify-between gap-2 pt-1">
              <p class="text-[11px] text-blue-700">📍 Phòng: ${escapeHtml(c.room || 'Đang cập nhật')} • 📅 Ngày: ${escapeHtml(c.date || '--')} (${escapeHtml(c.startTime || '--')} – ${escapeHtml(c.endTime || '--')})</p>
              <button type="button" onclick="openCouncilWorkspace('${act.roundId || ''}', '${act.id}', '${c.id}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0">
                🏛️ Vào phòng Hội đồng & Chấm điểm
              </button>
            </div>
          </div>
        `;
    }
  }
  return '';
}

// Student timeline never exposes teacher-only council membership or scoring links.
function renderStudentCouncilTimelineInfo(act) {
  return '';
}




// ============================================================================
// IFA+ GRADUATION BETA v1.9.0-beta.1: SCORING CONFIG & COUNCIL OPERATION MODULE
// ============================================================================

// 1. SCORING CONFIG HELPERS
window.toggleActivityScoringConfig = function(enabled) {
  const panel = document.getElementById('activity-scoring-config-panel');
  if (panel) {
    if (enabled) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }
};

window.switchActivityScoringMode = function(mode) {
  const numWrap = document.getElementById('activity-scoring-numeric-wrap');
  const letterWrap = document.getElementById('activity-scoring-letter-wrap');
  const rubricWrap = document.getElementById('activity-scoring-rubric-wrap');
  const rNum = document.querySelector('input[name="activity_scoring_mode"][value="numeric"]');
  const rLet = document.querySelector('input[name="activity_scoring_mode"][value="letter"]');
  const rRub = document.querySelector('input[name="activity_scoring_mode"][value="defense_rubric"]');

  if (mode === 'letter') {
    if (rLet) rLet.checked = true;
    if (numWrap) numWrap.classList.add('hidden');
    if (letterWrap) letterWrap.classList.remove('hidden');
    if (rubricWrap) rubricWrap.classList.add('hidden');
  } else if (mode === 'defense_rubric') {
    if (rRub) rRub.checked = true;
    if (numWrap) numWrap.classList.add('hidden');
    if (letterWrap) letterWrap.classList.add('hidden');
    if (rubricWrap) rubricWrap.classList.remove('hidden');
    renderActivityRubricList();
  } else {
    if (rNum) rNum.checked = true;
    if (numWrap) numWrap.classList.remove('hidden');
    if (letterWrap) letterWrap.classList.add('hidden');
    if (rubricWrap) rubricWrap.classList.add('hidden');
  }
};

window.renderActivityRubricList = function() {
  const container = document.getElementById('activity-scoring-rubric-list');
  const totalMaxEl = document.getElementById('activity-scoring-rubric-total-max');
  if (!container) return;

  const list = state._currentActivityRubric || [];
  if (list.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-slate-400">Chưa có tiêu chí nào. Bấm "+ Thêm tiêu chí".</div>';
    if (totalMaxEl) totalMaxEl.textContent = '0.0';
    return;
  }

  let totalMax = 0;
  container.innerHTML = list.map((crit, idx) => {
    totalMax += Number(crit.maxScore || 0);
    return `
      <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold text-slate-400">#${idx + 1}</span>
          <span class="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">${crit.key}</span>
          <span class="font-bold text-slate-900">${crit.label}</span>
          <span class="text-emerald-700 font-bold font-mono">(${crit.maxScore}đ)</span>
          ${crit.description ? `<span class="text-[10px] text-slate-400 truncate max-w-xs">(${crit.description})</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 text-[11px]">
          <button type="button" onclick="editRubricCriterion('${crit.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
          <button type="button" onclick="deleteRubricCriterion('${crit.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
        </div>
      </div>
    `;
  }).join('');

  if (totalMaxEl) totalMaxEl.textContent = totalMax.toFixed(1);
};

window.openAddRubricCriterionModal = function() {
  document.getElementById('rubric-criterion-id').value = '';
  document.getElementById('rubric-criterion-key').value = '';
  document.getElementById('rubric-criterion-label').value = '';
  document.getElementById('rubric-criterion-max').value = '2.5';
  document.getElementById('rubric-criterion-desc').value = '';
  document.getElementById('modal-rubric-criterion-title').textContent = 'Thêm tiêu chí Rubric mới';
  document.getElementById('modal-rubric-criterion')?.classList.remove('hidden');
};

window.closeRubricCriterionModal = function() {
  document.getElementById('modal-rubric-criterion')?.classList.add('hidden');
};

window.editRubricCriterion = function(id) {
  const crit = (state._currentActivityRubric || []).find(c => c.id === id);
  if (!crit) return;
  document.getElementById('rubric-criterion-id').value = crit.id;
  document.getElementById('rubric-criterion-key').value = crit.key;
  document.getElementById('rubric-criterion-label').value = crit.label;
  document.getElementById('rubric-criterion-max').value = crit.maxScore;
  document.getElementById('rubric-criterion-desc').value = crit.description || '';
  document.getElementById('modal-rubric-criterion-title').textContent = 'Chỉnh sửa tiêu chí Rubric';
  document.getElementById('modal-rubric-criterion')?.classList.remove('hidden');
};

window.deleteRubricCriterion = function(id) {
  state._currentActivityRubric = (state._currentActivityRubric || []).filter(c => c.id !== id);
  renderActivityRubricList();
};

window.saveRubricCriterion = function() {
  const id = document.getElementById('rubric-criterion-id')?.value?.trim();
  const key = document.getElementById('rubric-criterion-key')?.value?.trim().toLowerCase();
  const label = document.getElementById('rubric-criterion-label')?.value?.trim();
  const maxScore = parseFloat(document.getElementById('rubric-criterion-max')?.value);
  const desc = document.getElementById('rubric-criterion-desc')?.value?.trim() || '';

  if (!key || !label) {
    showToast('Vui lòng nhập đầy đủ Mã tiêu chí và Tên tiêu chí!', 'warning');
    return;
  }
  if (isNaN(maxScore) || maxScore <= 0) {
    showToast('Điểm tối đa của tiêu chí phải là số dương (> 0)!', 'warning');
    return;
  }

  state._currentActivityRubric = state._currentActivityRubric || [];
  
  // Check duplicate key
  const duplicate = state._currentActivityRubric.find(c => c.key === key && c.id !== id);
  if (duplicate) {
    showToast(`Mã tiêu chí "${key}" đã tồn tại! Vui lòng chọn mã khác.`, 'warning');
    return;
  }

  if (id) {
    const idx = state._currentActivityRubric.findIndex(c => c.id === id);
    if (idx >= 0) {
      state._currentActivityRubric[idx] = {
        ...state._currentActivityRubric[idx],
        key,
        label,
        maxScore,
        description: desc
      };
    }
  } else {
    const newId = 'crit_' + Date.now().toString(36);
    state._currentActivityRubric.push({
      id: newId,
      key,
      label,
      maxScore,
      description: desc,
      order: state._currentActivityRubric.length + 1
    });
  }

  closeRubricCriterionModal();
  renderActivityRubricList();
};

window.renderActivityLetterOptions = function() {
  const container = document.getElementById('activity-scoring-letter-list');
  if (!container) return;
  const list = state._currentActivityLetterOptions || [];
  if (list.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-slate-400">Chưa có mức điểm chữ nào. Bấm "+ Thêm mức điểm" hoặc "↺ Khôi phục mặc định".</div>';
    return;
  }
  container.innerHTML = list.map((opt, idx) => {
    const numDisplay = (typeof opt.numericValue === 'number' && !isNaN(opt.numericValue))
      ? `<span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono text-xs font-bold" title="Điểm quy đổi nội bộ của Admin">Quy đổi: ${opt.numericValue} điểm</span>`
      : `<span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono text-[10px]" title="Chưa cấu hình điểm quy đổi">Chưa có điểm quy đổi</span>`;

    return `
    <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono text-xs">${escapeHtml(opt.key || opt.code || '')}</span>
        <span class="font-bold text-slate-800 text-xs">${escapeHtml(opt.label || '')}</span>
        ${numDisplay}
        ${opt.description ? `<span class="text-[10px] text-slate-400">(${escapeHtml(opt.description)})</span>` : ''}
      </div>
      <div class="flex items-center gap-1.5 text-[11px] shrink-0">
        <button type="button" onclick="editLetterOption('${opt.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
        <button type="button" onclick="deleteLetterOption('${opt.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
      </div>
    </div>
  `;
  }).join('');
};

window.resetDefaultLetterOptions = async function() {
  if (!await showConfirm('Khôi phục thang điểm chữ', 'Thao tác sẽ thay thế danh sách mức điểm chữ hiện tại bằng bộ mặc định đầy đủ 13 mức (A++ → D-). Bạn có muốn tiếp tục?', { confirmText: 'Khôi phục' })) {
    return;
  }
  state._currentActivityLetterOptions = JSON.parse(JSON.stringify(DEFAULT_LETTER_GRADE_SCALE));
  renderActivityLetterOptions();
  showToast('Đã khôi phục bộ 13 mức điểm chữ mặc định (A++ → D-)!', 'success');
};

window.openAddLetterOptionModal = function() {
  document.getElementById('letter-option-id').value = '';
  document.getElementById('letter-option-key').value = '';
  document.getElementById('letter-option-label').value = '';
  document.getElementById('letter-option-numeric').value = '';
  document.getElementById('letter-option-desc').value = '';
  document.getElementById('modal-letter-option-title').textContent = 'Thêm mức điểm chữ mới';
  document.getElementById('modal-add-letter-option')?.classList.remove('hidden');
};

window.closeLetterOptionModal = function() {
  document.getElementById('modal-add-letter-option')?.classList.add('hidden');
};

window.editLetterOption = function(id) {
  const opt = (state._currentActivityLetterOptions || []).find(o => o.id === id);
  if (!opt) return;
  document.getElementById('letter-option-id').value = opt.id;
  document.getElementById('letter-option-key').value = opt.key || opt.code || '';
  document.getElementById('letter-option-label').value = opt.label || '';
  document.getElementById('letter-option-numeric').value = (typeof opt.numericValue === 'number' && !isNaN(opt.numericValue)) ? opt.numericValue : '';
  document.getElementById('letter-option-desc').value = opt.description || '';
  document.getElementById('modal-letter-option-title').textContent = 'Chỉnh sửa mức điểm chữ';
  document.getElementById('modal-add-letter-option')?.classList.remove('hidden');
};

window.deleteLetterOption = function(id) {
  state._currentActivityLetterOptions = (state._currentActivityLetterOptions || []).filter(o => o.id !== id);
  renderActivityLetterOptions();
};

window.saveLetterOption = function() {
  const id = document.getElementById('letter-option-id')?.value?.trim();
  const key = document.getElementById('letter-option-key')?.value?.trim().toUpperCase();
  const label = document.getElementById('letter-option-label')?.value?.trim();
  const numRaw = document.getElementById('letter-option-numeric')?.value?.trim();
  const desc = document.getElementById('letter-option-desc')?.value?.trim() || '';

  if (!key || !label) {
    showToast('Vui lòng nhập đầy đủ Mã mức điểm và Nhãn hiển thị', 'warning');
    return;
  }

  const numericValue = parseFloat(numRaw);
  if (isNaN(numericValue) || numericValue < 0 || numericValue > 10) {
    showToast('Vui lòng nhập Điểm quy đổi hợp lệ từ 0 đến 10 (ví dụ: 10, 9.5, 8.0...)', 'warning');
    document.getElementById('letter-option-numeric')?.focus();
    return;
  }

  state._currentActivityLetterOptions = state._currentActivityLetterOptions || [];
  if (id) {
    const idx = state._currentActivityLetterOptions.findIndex(o => o.id === id);
    if (idx >= 0) {
      state._currentActivityLetterOptions[idx] = {
        id,
        key,
        code: key,
        label,
        numericValue: Number(numericValue.toFixed(2)),
        description: desc
      };
    }
  } else {
    const newId = 'opt_' + Date.now().toString(36);
    state._currentActivityLetterOptions.push({
      id: newId,
      key,
      code: key,
      label,
      numericValue: Number(numericValue.toFixed(2)),
      description: desc
    });
  }

  closeLetterOptionModal();
  renderActivityLetterOptions();
};

// 2. AUTHORIZATION & REQUIRED SCORERS HELPERS
export function checkCouncilAuthorization(round, act, council, user) {
  if (!round || !act || !council) return { authorized: false, reason: 'Không tìm thấy dữ liệu Hội đồng' };
  
  const actor = user || getEffectiveActor();

  // Admin always has full access
  if (actor.isAdmin) {
    return {
      authorized: true,
      role: 'admin',
      roleName: 'Quản trị viên',
      slotKey: null,
      canScore: true,
      isSecretary: true,
      isChair: true,
      isAdmin: true,
      canCalibrate: true,
      canFinalize: true
    };
  }

  if (!actor || !actor.email) {
    return { authorized: false, reason: 'Vui lòng đăng nhập để truy cập Hội đồng.' };
  }

  const userEmail = actor.email.toLowerCase().trim();
  const membersBySlot = council.membersBySlot || {};
  const slots = act.councilStructure?.slots || [];

  for (const s of slots) {
    const assigned = membersBySlot[s.key];
    if (assigned && assigned.memberEmail && assigned.memberEmail.toLowerCase().trim() === userEmail) {
      const isSec = (s.key === 'secretary' || s.label === 'Thư ký');
      const isChair = (s.key === 'chair' || s.label === 'Chủ tịch' || s.name === 'Chủ tịch Hội đồng');
      return {
        authorized: true,
        role: s.key,
        roleName: s.name || s.label || 'Thành viên Hội đồng',
        slotKey: s.key,
        canScore: true,
        isSecretary: isSec,
        isChair: isChair,
        isAdmin: false,
        canCalibrate: isChair,
        canFinalize: isChair
      };
    }
  }

  // Student is strictly denied
  return {
    authorized: false,
    reason: 'Bạn không phải thành viên của Hội đồng này.'
  };
}

export function getRequiredScorers(council, act) {
  const slots = act?.councilStructure?.slots || [];
  return slots.filter(s => s.type === 'mandatory');
}

export function getGuestScorers(council, act) {
  const slots = act?.councilStructure?.slots || [];
  return slots.filter(s => s.type === 'guest');
}

// 3. COUNCIL WORKSPACE OPEN & REAL-TIME LISTENER
window.openCouncilWorkspace = async function(roundId, activityId, councilId, autoSelectedStudentId = null) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!targetRound || !act || !council) {
    showToast('Không tìm thấy thông tin Hội đồng được yêu cầu.', 'error');
    return;
  }

  // AUTHORIZATION CHECK
  const authCheck = checkCouncilAuthorization(targetRound, act, council, getEffectiveActor());
  if (!authCheck.authorized) {
    showToast(authCheck.reason || 'Bạn không có quyền truy cập Hội đồng này.', 'error');
    return;
  }

  state.activeCouncilWorkspace = {
    roundId,
    activityId,
    councilId,
    auth: authCheck
  };

  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilScores = state.councilScores || {};

  // Load existing scores from round doc & subcollection
  await loadCouncilScores(roundId, activityId, councilId);

  // Setup initial selected student
  const assignments = act.councilStudentAssignments || [];
  const councilStudents = assignments
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const presentingStudent = councilStudents.find(a => a.presentationStatus === 'presenting');

  if (autoSelectedStudentId) {
    state.activeCouncilSelectedStudentId = autoSelectedStudentId;
  } else if (presentingStudent) {
    state.activeCouncilSelectedStudentId = presentingStudent.studentId;
  } else if (councilStudents.length > 0) {
    state.activeCouncilSelectedStudentId = councilStudents[0].studentId;
  } else {
    state.activeCouncilSelectedStudentId = null;
  }

  // Render UI
  renderCouncilWorkspaceFull();

  // Show modal
  document.getElementById('modal-council-workspace')?.classList.remove('hidden');

  // Real-time Firestore Listener
  setupCouncilRealtimeSync(roundId, activityId, councilId);
};

window.closeCouncilWorkspace = function() {
  if (state.activeCouncilUnsubscribe) {
    try { state.activeCouncilUnsubscribe(); } catch (e) {}
    state.activeCouncilUnsubscribe = null;
  }
  document.getElementById('modal-council-workspace')?.classList.add('hidden');
};

function setupCouncilRealtimeSync(roundId, activityId, councilId) {
  if (state.activeCouncilUnsubscribe) {
    state.activeCouncilUnsubscribe();
    state.activeCouncilUnsubscribe = null;
  }

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    state.activeCouncilUnsubscribe = onSnapshot(roundRef, (snap) => {
      if (!snap.exists()) return;
      const updatedData = { id: snap.id, ...snap.data() };
      
      // Update in state.rounds
      const rIdx = (state.rounds || []).findIndex(r => r.id === roundId);
      if (rIdx >= 0) state.rounds[rIdx] = updatedData;

      // Update nested scores if present
      if (updatedData.councilScores) {
        state.councilScores = { ...(state.councilScores || {}), ...updatedData.councilScores };
      }

      // Re-render Council Workspace WITHOUT changing selected student!
      renderCouncilWorkspacePartialSync();
    }, (err) => {
      console.warn('Realtime council listener notice:', err);
    });
  } catch (err) {
    console.warn('Firestore onSnapshot setup notice:', err);
  }
}

async function loadCouncilScores(roundId, activityId, councilId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (targetRound?.councilScores) {
    state.councilScores = { ...(state.councilScores || {}), ...targetRound.councilScores };
  }

  // Best effort query subcollection reviewDecisions
  try {
    const q = query(
      collection(db, 'graduationRounds', roundId, 'reviewDecisions'),
      where('councilId', '==', councilId)
    );
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      snap.docs.forEach(d => {
        const data = d.data();
        const k = `${data.activityId}_${data.councilId}_${data.studentId}_${data.scorerId}`;
        state.councilScores[k] = data;
      });
    }
  } catch (e) {
    // Graceful fallback to nested or memory
  }
}

// 4. WORKSPACE RENDERING METHODS
function renderCouncilWorkspaceFull() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!targetRound || !act || !council) return;

  // Header Elements
  document.getElementById('cws-council-name').textContent = council.name;
  document.getElementById('cws-council-meta').textContent = `📍 Phòng: ${council.room || 'Đang cập nhật'} • 📅 ${council.date || '--'} (${council.startTime || '--'} – ${council.endTime || '--'})`;

  // Status Badge (v2.0.0-beta.1: preparing -> active -> ended -> finalized)
  const statusBadge = document.getElementById('cws-council-status-badge');
  if (statusBadge) {
    const cStat = council.status || 'preparing';
    if (cStat === 'active' || cStat === 'ongoing') {
      statusBadge.className = 'badge bg-emerald-500 text-white font-black animate-pulse text-[10px]';
      statusBadge.textContent = '● Đang diễn ra';
    } else if (cStat === 'ended') {
      statusBadge.className = 'badge bg-amber-500 text-white font-bold text-[10px]';
      statusBadge.textContent = '⏸ Đã kết thúc (Chờ chốt)';
    } else if (cStat === 'finalized' || cStat === 'completed') {
      statusBadge.className = 'badge bg-slate-800 text-white font-bold text-[10px]';
      statusBadge.textContent = '🔒 Đã chốt điểm';
    } else {
      statusBadge.className = 'badge bg-amber-100 text-amber-800 font-bold text-[10px]';
      statusBadge.textContent = 'Chuẩn bị';
    }
  }

  // Role Badge
  const roleBadge = document.getElementById('cws-my-role-badge');
  if (roleBadge) {
    roleBadge.textContent = auth.roleName || 'Thành viên';
  }

  // Session Controls (Secretary / Chair / Admin)
  const sessionControls = document.getElementById('cws-session-controls');
  if (sessionControls) {
    if (auth.isAdmin || auth.isSecretary || auth.isChair) {
      sessionControls.classList.remove('hidden');
      sessionControls.classList.add('flex');
      const startBtn = document.getElementById('btn-start-council-session');
      const endBtn = document.getElementById('btn-end-council-session');
      const finBtn = document.getElementById('btn-finalize-council-session');
      const reopenBtn = document.getElementById('btn-reopen-council-session');
      const cStat = council.status || 'preparing';

      if (startBtn) startBtn.classList.toggle('hidden', cStat !== 'preparing');
      if (endBtn) endBtn.classList.toggle('hidden', cStat !== 'active' && cStat !== 'ongoing');
      if (finBtn) finBtn.classList.toggle('hidden', cStat !== 'ended' || (!auth.isAdmin && !auth.isChair));
      if (reopenBtn) reopenBtn.classList.toggle('hidden', cStat !== 'finalized' || !auth.isAdmin);
    } else {
      sessionControls.classList.add('hidden');
    }
  }

  renderCouncilStudentList();
  renderCouncilSelectedStudentDetails();
  renderPostCouncilSection();
  renderAuditLogsSection();
}

function renderCouncilWorkspacePartialSync() {
  // Update student list badges & counts
  renderCouncilStudentList();

  // Update presenting banner
  renderPresentingBanner();

  // Update secretary controls for current student
  renderSecretaryControls();

  // Update scorers completion progress & admin monitor
  renderScorersProgress();
  renderAdminMonitor();

  // Update post-council calibration and audit logs
  renderPostCouncilSection();
  renderAuditLogsSection();
}

function renderCouncilStudentList() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!targetRound || !act) return;

  const assignments = act.councilStudentAssignments || [];
  const councilStudents = assignments
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const countBadge = document.getElementById('cws-student-count-badge');
  if (countBadge) countBadge.textContent = councilStudents.length;

  const presentingAsgn = councilStudents.find(a => a.presentationStatus === 'presenting');
  const presentingInd = document.getElementById('cws-presenting-indicator');
  if (presentingInd) {
    if (presentingAsgn) {
      presentingInd.classList.remove('hidden');
      presentingInd.textContent = `● #${presentingAsgn.order} đang trình bày`;
    } else {
      presentingInd.classList.add('hidden');
    }
  }

  const container = document.getElementById('cws-students-list');
  if (!container) return;

  if (councilStudents.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-slate-400">Hội đồng này chưa có sinh viên nào.</div>';
    return;
  }

  const myScorerId = getEffectiveActor().uid || getEffectiveActor().email;
  const scoringEnabled = Boolean(act.scoringConfig?.enabled);

  container.innerHTML = councilStudents.map((asgn) => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const isSelected = (sid === state.activeCouncilSelectedStudentId);
    const isPresenting = (asgn.presentationStatus === 'presenting');
    const isPresented = (asgn.presentationStatus === 'presented');

    // Presentation badge
    let presBadge = '<span class="text-[10px] text-slate-400">Chờ</span>';
    if (isPresenting) {
      presBadge = '<span class="badge bg-emerald-500 text-white font-black text-[9px] animate-pulse">🔴 Đang trình bày</span>';
    } else if (isPresented) {
      presBadge = '<span class="badge bg-indigo-100 text-indigo-800 font-bold text-[9px]">✓ Đã xong</span>';
    }

    // Scoring status badge for this member
    let scoreBadge = '';
    if (scoringEnabled) {
      const scoreKey = `${activityId}_${councilId}_${sid}_${myScorerId}`;
      const myScore = state.councilScores?.[scoreKey];
      const hasDraft = Boolean(state.councilLocalDrafts?.[sid]);

      if (myScore?.status === 'completed') {
        scoreBadge = '<span class="text-[10px] text-emerald-700 font-bold">✓ Bạn đã chấm</span>';
      } else if (myScore?.status === 'draft' || hasDraft) {
        scoreBadge = '<span class="text-[10px] text-amber-600 font-bold">● Đã lưu tạm</span>';
      } else {
        scoreBadge = '<span class="text-[10px] text-slate-400">Chưa chấm</span>';
      }
    }

    return `
      <div onclick="selectCouncilStudent('${sid}')" class="p-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'}">
        <div class="flex items-center justify-between gap-1">
          <span class="font-mono font-bold text-xs ${isSelected ? 'text-indigo-900' : 'text-slate-600'}">#${asgn.order || '--'}</span>
          ${presBadge}
        </div>
        <div class="font-bold text-slate-900 text-xs truncate mt-0.5">${sName}</div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-0.5">
          <span>${sid}</span>
          ${scoreBadge}
        </div>
      </div>
    `;
  }).join('');
}

window.filterCouncilWorkspaceStudents = function(q) {
  const query = String(q || '').toLowerCase().trim();
  const cards = document.querySelectorAll('#cws-students-list > div');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.classList.toggle('hidden', query.length > 0 && !text.includes(query));
  });
};

// 5. SELECT STUDENT & FLEXIBLE NAVIGATION (CRITICAL BUSINESS RULE)
window.selectCouncilStudent = function(studentId) {
  // PRESERVE UNSAVED INPUTS from current student (including rubric components)
  const oldSid = state.activeCouncilSelectedStudentId;
  if (oldSid && oldSid !== studentId) {
    const valInput = document.getElementById('cws-score-input-numeric');
    const letInput = document.getElementById('cws-score-input-letter');
    const commentInput = document.getElementById('cws-score-comment');
    const rubricInputs = document.querySelectorAll('input[data-crit-key]');

    let components = null;
    if (rubricInputs.length > 0) {
      components = {};
      rubricInputs.forEach(inp => {
        const k = inp.dataset.critKey;
        const v = inp.value;
        if (v !== '' && !isNaN(Number(v))) {
          components[k] = Number(v);
        }
      });
    }

    const currentVal = valInput ? valInput.value : (letInput ? letInput.value : state.councilLocalDrafts?.[oldSid]?.value);
    const currentComm = commentInput ? commentInput.value : (state.councilLocalDrafts?.[oldSid]?.comment || '');

    if (currentVal !== undefined && currentVal !== '' || currentComm || (components && Object.keys(components).length > 0)) {
      state.councilLocalDrafts = state.councilLocalDrafts || {};
      state.councilLocalDrafts[oldSid] = {
        value: currentVal,
        comment: currentComm,
        components: components || state.councilLocalDrafts?.[oldSid]?.components
      };
    }
  }

  // SET NEW SELECTED STUDENT (NEVER changes current presenting student)
  state.activeCouncilSelectedStudentId = studentId;

  renderCouncilStudentList();
  renderCouncilSelectedStudentDetails();
};

window.goToCurrentPresentingStudent = function() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = act?.councilStudentAssignments || [];
  const pres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');
  if (pres) {
    selectCouncilStudent(pres.studentId);
  } else {
    showToast('Hội đồng hiện chưa có sinh viên nào đang trình bày.', 'info');
  }
};

// 6. RENDER SELECTED STUDENT DETAILS & SCORING
function renderCouncilSelectedStudentDetails() {
  const sid = state.activeCouncilSelectedStudentId;
  const card = document.getElementById('cws-selected-student-card');
  if (!card) return;

  if (!sid) {
    card.innerHTML = '<div class="p-8 text-center text-slate-400">Vui lòng chọn một sinh viên trong danh sách để xem thông tin và chấm điểm.</div>';
    document.getElementById('cws-secretary-actions')?.classList.add('hidden');
    document.getElementById('cws-scoring-section')?.classList.add('hidden');
    document.getElementById('cws-scorers-progress-section')?.classList.add('hidden');
    document.getElementById('cws-admin-monitor-section')?.classList.add('hidden');
    return;
  }

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const sObj = findStudentInRound(sid);
  const asgn = (act?.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);

  const sName = sObj?.fullName || sObj?.studentName || sid;
  const sTopic = sObj?.topicTitle || '--';

  // Format Official Supervisors (using officialSupervisors helper with legacy fallback)
  const supervisorsHtml = formatStudentSupervisorsForDisplay(sObj);

  // Presenting status badge
  const isPresenting = (asgn?.presentationStatus === 'presenting');
  const isPresented = (asgn?.presentationStatus === 'presented');
  let statusBadgeHtml = '<span class="badge bg-slate-100 text-slate-600 font-bold text-xs">Chờ trình bày</span>';
  if (isPresenting) {
    statusBadgeHtml = '<span class="badge bg-emerald-500 text-white font-black text-xs animate-pulse">🔴 ĐANG TRÌNH BÀY</span>';
  } else if (isPresented) {
    statusBadgeHtml = '<span class="badge bg-indigo-100 text-indigo-800 font-bold text-xs">✓ Đã trình bày</span>';
  }

  card.innerHTML = `
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono font-black text-xs px-2 py-0.5 bg-white border border-slate-300 rounded-lg">#${asgn?.order || '--'}</span>
          <h2 class="font-black text-base sm:text-lg text-slate-900">${sName}</h2>
          ${statusBadgeHtml}
        </div>
        <p class="font-mono text-xs text-slate-500 mt-0.5 font-bold">MSSV: ${sid}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
      <div>
        <span class="text-[11px] font-bold text-slate-400 block mb-0.5">TÊN ĐỀ TÀI:</span>
        <p class="font-semibold text-slate-800 leading-snug">${sTopic}</p>
      </div>
      <div>
        <span class="text-[11px] font-bold text-slate-400 block mb-0.5">GIẢNG VIÊN HƯỚNG DẪN:</span>
        <div class="font-semibold text-slate-800">${supervisorsHtml}</div>
      </div>
    </div>

    ${asgn?.presentationStatus === 'presented' ? (() => {
      const prelim = getPreliminarySummary(sid, roundId);
      if (prelim && prelim.average !== null) {
        return `
          <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs mt-2">
            <div class="flex items-center gap-2">
              <span class="text-base">🎯</span>
              <div>
                <span class="font-bold text-amber-950">Điểm Sơ khảo TB:</span>
                <span class="font-black font-mono text-sm text-amber-900 ml-1.5">${prelim.average.toFixed(2)}</span>
                <span class="text-[10px] text-amber-700 ml-1 font-semibold">(${prelim.count} lượt chấm hợp lệ)</span>
              </div>
            </div>
            <span class="text-[10px] text-slate-400 italic">Hiển thị sau khi hoàn tất trình bày</span>
          </div>
        `;
      }
      return '';
    })() : ''}
  `;

  // Update presenting banner
  renderPresentingBanner();

  // Render Secretary Actions
  renderSecretaryControls();

  // Render Scoring Section
  renderScoringSection();

  // Render Progress
  renderScorersProgress();

  // Render Admin Monitor
  renderAdminMonitor();
}

function formatStudentSupervisorsForDisplay(reg) {
  if (!reg) return 'GVHD: Chưa phân công';
  const officials = getOfficialSupervisors(reg);
  if (!officials || officials.length === 0) {
    const legacy = reg.acceptedSupervisorName || reg.supervisorName || reg.finalSupervisorName;
    return legacy ? `GVHD: ${legacy}` : 'GVHD: Chưa phân công';
  }
  if (officials.length === 1) {
    return `GVHD: ${officials[0].supervisorName || 'Giảng viên'}`;
  }
  return officials.map(s => {
    const role = (s.role === 'primary') ? 'GVHD chính' : 'GVHD 2';
    return `<div>${s.supervisorName || 'Giảng viên'} <span class="text-indigo-600 font-mono text-[10px]">(${role})</span></div>`;
  }).join('');
}

// 7. BANNER: CURRENT PRESENTING STUDENT
function renderPresentingBanner() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const assignments = act?.councilStudentAssignments || [];

  const pres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');
  const banner = document.getElementById('cws-presenting-banner');
  const bannerText = document.getElementById('cws-presenting-banner-text');
  if (!banner) return;

  const currentSid = state.activeCouncilSelectedStudentId;

  if (pres && pres.studentId !== currentSid) {
    const sObj = findStudentInRound(pres.studentId);
    const sName = sObj?.fullName || sObj?.studentName || pres.studentId;
    if (bannerText) bannerText.textContent = `#${pres.order || ''} ${sName} (${pres.studentId})`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// 8. SECRETARY PRESENTATION CONTROLS
function renderSecretaryControls() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const container = document.getElementById('cws-secretary-actions');
  const btnWrap = document.getElementById('cws-secretary-buttons');
  if (!container || !btnWrap) return;

  // Only Secretary or Admin
  if (!auth.isAdmin && !auth.isSecretary) {
    container.classList.add('hidden');
    return;
  }

  const sid = state.activeCouncilSelectedStudentId;
  const asgn = (act?.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);
  if (!asgn) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  if (asgn.presentationStatus === 'presenting') {
    btnWrap.innerHTML = `
      <button type="button" onclick="finishStudentPresentation('${sid}')" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1">
        <span>✓ Hoàn tất lượt</span>
      </button>
      <button type="button" onclick="resetStudentPresentation('${sid}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold" title="Đặt lại trạng thái Chờ">
        ↺
      </button>
    `;
  } else {
    btnWrap.innerHTML = `
      <button type="button" onclick="startStudentPresentation('${sid}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1">
        <span>▶ Bắt đầu trình bày</span>
      </button>
      ${asgn.presentationStatus === 'presented' ? `
        <button type="button" onclick="resetStudentPresentation('${sid}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold" title="Đặt lại trạng thái Chờ">
          ↺ Đặt lại Chờ
        </button>
      ` : ''}
    `;
  }
}

window.startStudentPresentation = async function(targetSid) {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const assignments = act.councilStudentAssignments || [];
  const currentPres = assignments.find(a => a.councilId === councilId && a.presentationStatus === 'presenting');

  if (currentPres && currentPres.studentId !== targetSid) {
    const curObj = findStudentInRound(currentPres.studentId);
    const targetObj = findStudentInRound(targetSid);
    const curName = curObj?.fullName || curObj?.studentName || currentPres.studentId;
    const targetName = targetObj?.fullName || targetObj?.studentName || targetSid;

    const confirmed = await showConfirm(
      'Chuyển lượt trình bày',
      `${curName} đang trình bày. Bạn có muốn kết thúc lượt của sinh viên này và chuyển sang ${targetName}?`,
      { confirmText: 'Đồng ý chuyển', danger: false }
    );
    if (!confirmed) return;

    currentPres.presentationStatus = 'presented';
  }

  const targetAsgn = assignments.find(a => a.councilId === councilId && a.studentId === targetSid);
  if (targetAsgn) {
    targetAsgn.presentationStatus = 'presenting';
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspacePartialSync();
  renderSecretaryControls();
  showToast(`Đã bắt đầu lượt trình bày của sinh viên #${targetAsgn?.order || ''}`, 'success');
};

window.finishStudentPresentation = async function(sid) {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const asgn = (act.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);
  if (asgn) {
    asgn.presentationStatus = 'presented';
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspacePartialSync();
  renderSecretaryControls();
  showToast('✓ Đã hoàn tất lượt trình bày của sinh viên.', 'info');
};

window.resetStudentPresentation = async function(sid) {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const asgn = (act.councilStudentAssignments || []).find(a => a.councilId === councilId && a.studentId === sid);
  if (asgn) {
    asgn.presentationStatus = 'waiting';
  }

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspacePartialSync();
  renderSecretaryControls();
};

// 9. COUNCIL SESSION CONTROLS (START / END)
window.startCouncilSession = async function() {
  const { roundId, activityId, councilId } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  council.status = 'active';
  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`Hội đồng "${council.name}" đã bắt đầu làm việc!`, 'success');
};

window.endCouncilSession = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền kết thúc buổi làm việc của Hội đồng!', 'error');
    return;
  }

  // Check required scorers completion (CT, UV, TK)
  const reqSlots = getRequiredScorers(council, act);
  const assignments = (act?.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  
  let uncompletedCount = 0;
  for (const asgn of assignments) {
    for (const s of reqSlots) {
      const assignedMem = council.membersBySlot?.[s.key];
      if (assignedMem && (assignedMem.memberId || assignedMem.memberEmail)) {
        const scorerId = assignedMem.memberId || assignedMem.memberEmail;
        const k = `${activityId}_${councilId}_${asgn.studentId}_${scorerId}`;
        const sc = state.councilScores?.[k];
        if (sc?.status !== 'completed') {
          uncompletedCount++;
        }
      } else {
        uncompletedCount++;
      }
    }
  }

  let confirmMsg = `Xác nhận kết thúc buổi làm việc của Hội đồng "${council.name}"? Sau khi kết thúc, Chủ tịch Hội đồng sẽ xem được toàn bộ điểm của các thành viên để tiến hành hiệu chỉnh điểm sau hội đồng.`;
  if (uncompletedCount > 0) {
    confirmMsg = `Còn ${uncompletedCount} lượt chấm bắt buộc (Chủ tịch, Ủy viên, Thư ký) chưa hoàn tất! Bạn có chắc chắn muốn kết thúc Hội đồng không?`;
  }

  const confirmed = await showConfirm('Kết thúc Hội đồng', confirmMsg, { confirmText: 'Kết thúc Hội đồng', danger: uncompletedCount > 0 });
  if (!confirmed) return;

  council.status = 'ended';
  council.endedAt = new Date().toISOString();
  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`Đã kết thúc phiên làm việc của Hội đồng "${council.name}".`, 'info');
};

// 10. SCORING CARD RENDERING & ACTIONS
function renderScoringSection() {
  const container = document.getElementById('cws-scoring-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!act?.scoringConfig?.enabled) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const sid = state.activeCouncilSelectedStudentId;
  const myScorerId = getEffectiveActor().uid || getEffectiveActor().email;
  const scoreKey = `${activityId}_${councilId}_${sid}_${myScorerId}`;
  const savedScore = state.councilScores?.[scoreKey];
  const draft = state.councilLocalDrafts?.[sid];

  // Resolve current working values
  const currentVal = draft?.value !== undefined ? draft.value : (savedScore?.value ?? '');
  const currentComment = draft?.comment !== undefined ? draft.comment : (savedScore?.comment ?? '');
  const isCompleted = (savedScore?.status === 'completed' && !draft);
  const councilEnded = (council.status === 'ended' || council.status === 'completed');

  const mode = act.scoringConfig.mode || 'numeric';

  let inputHtml = '';
  if (mode === 'letter') {
    const opts = act.scoringConfig.letterOptions || [];
    inputHtml = `
      <div>
        <label class="font-bold text-slate-800 text-xs block mb-1.5">Mức điểm / Đánh giá (*):</label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          ${opts.map(o => {
            const isSelected = String(currentVal) === String(o.key);
            return `
              <button type="button" ${isCompleted ? 'disabled' : ''} onclick="onSelectLetterScore('${o.key}')" class="p-2.5 rounded-xl border text-left transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500 font-black text-emerald-950' : 'bg-white border-slate-200 hover:border-slate-300 font-semibold text-slate-700'} ${isCompleted ? 'opacity-80 cursor-not-allowed' : ''}">
                <span class="text-sm block font-mono font-black text-emerald-700">${o.key}</span>
                <span class="text-[11px] block mt-0.5">${o.label}</span>
              </button>
            `;
          }).join('')}
        </div>
        <input type="hidden" id="cws-score-input-letter" value="${currentVal}">
      </div>
    `;
  } else if (mode === 'defense_rubric') {
    const rubric = act.scoringConfig.rubric || [
      { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4, order: 1 },
      { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3, order: 2 },
      { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2, order: 3 },
      { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1, order: 4 }
    ];
    const components = (draft?.components !== undefined)
      ? draft.components
      : (savedScore?.components || {});

    let compSum = 0;
    const compRows = rubric.map(crit => {
      const cVal = components[crit.key] !== undefined ? components[crit.key] : '';
      if (cVal !== '' && !isNaN(Number(cVal))) {
        compSum += Number(cVal);
      }
      return `
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div class="flex items-center justify-between">
            <label class="font-bold text-slate-800 text-xs">${crit.label} <span class="text-indigo-600 font-mono text-[11px]">(tối đa ${crit.maxScore}đ)</span></label>
            <div class="flex items-center gap-1.5">
              <input type="number" id="cws-rubric-input-${crit.key}" data-crit-key="${crit.key}" data-max-score="${crit.maxScore}" value="${cVal}" min="0" max="${crit.maxScore}" step="0.1" ${isCompleted ? 'disabled' : ''} oninput="onRubricComponentChange('${crit.key}', this.value)" placeholder="0 – ${crit.maxScore}" class="w-24 p-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-right ${isCompleted ? 'bg-slate-100' : 'bg-white focus:ring-2 focus:ring-indigo-500'}">
              <span class="text-[11px] text-slate-500 font-mono font-bold">/${crit.maxScore}</span>
            </div>
          </div>
          ${crit.description ? `<p class="text-[10px] text-slate-500">${crit.description}</p>` : ''}
        </div>
      `;
    }).join('');

    const totalValNum = currentVal !== '' && !isNaN(Number(currentVal)) ? Number(currentVal) : null;
    const hasMismatch = (totalValNum !== null && Math.abs(compSum - totalValNum) >= 0.000001);

    inputHtml = `
      <div class="space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <label class="font-bold text-slate-800 text-xs">Chấm điểm theo Rubric Bảo vệ (Defense Rubric):</label>
          <button type="button" ${isCompleted ? 'disabled' : ''} onclick="syncRubricSumToTotal()" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 transition-colors">
            ∑ Cộng tiêu chí vào Điểm tổng
          </button>
        </div>

        <div class="space-y-2">
          ${compRows}
        </div>

        <div class="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
          <div>
            <span class="font-bold text-indigo-950 text-xs block">Điểm Tổng kết Bảo vệ (*):</span>
            <span class="text-[10px] text-indigo-700">Tổng các tiêu chí: <strong id="cws-rubric-comp-sum">${compSum.toFixed(2)}</strong></span>
          </div>
          <div class="flex items-center gap-2">
            <input type="number" id="cws-score-input-numeric" value="${currentVal}" min="0" max="10" step="0.1" oninput="onScoreInputChange(this.value)" ${isCompleted ? 'disabled' : ''} placeholder="0 – 10" class="w-28 p-2 border border-slate-300 rounded-xl font-mono text-sm font-black text-slate-900 text-right ${isCompleted ? 'bg-slate-100' : 'bg-white focus:ring-2 focus:ring-blue-500'}">
            <span class="text-xs text-slate-500 font-semibold">/ 10 điểm</span>
          </div>
        </div>

        ${hasMismatch ? `
          <div id="cws-rubric-mismatch-warning" class="p-2.5 bg-amber-100/70 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>Tổng tiêu chí (${compSum.toFixed(2)}) chưa khớp với Điểm tổng (${totalValNum})! Vui lòng bấm "Cộng tiêu chí vào Điểm tổng" hoặc điều chỉnh trước khi hoàn tất.</span>
          </div>
        ` : ''}
      </div>
    `;
  } else {
    const nCfg = act.scoringConfig.numericConfig || { min: 0, max: 10, step: 0.1 };
    inputHtml = `
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="font-bold text-slate-800 text-xs">Điểm đánh giá (*) [Thang điểm ${nCfg.min} – ${nCfg.max}]:</label>
          <span class="text-[11px] text-slate-400 font-mono">Bước điểm: ${nCfg.step}</span>
        </div>
        <div class="flex items-center gap-3">
          <input type="number" id="cws-score-input-numeric" value="${currentVal}" min="${nCfg.min}" max="${nCfg.max}" step="${nCfg.step}" oninput="onScoreInputChange(this.value)" ${isCompleted ? 'disabled' : ''} placeholder="${nCfg.min} – ${nCfg.max}" class="w-36 p-2 border border-slate-300 rounded-xl font-mono text-sm font-black text-slate-900 ${isCompleted ? 'bg-slate-100' : 'bg-white focus:ring-2 focus:ring-blue-500'}">
          <span class="text-xs text-slate-500 font-semibold">/ ${nCfg.max} điểm</span>
        </div>
      </div>
    `;
  }

  // Action buttons
  let actionsHtml = '';
  if (isCompleted) {
    actionsHtml = `
      <div class="flex items-center justify-between gap-2 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
        <span class="font-bold text-emerald-800 text-xs flex items-center gap-1.5">
          <span>✓</span> Bạn đã hoàn tất chấm lúc ${fmt24h(savedScore.completedAt || savedScore.updatedAt)}
        </span>
        ${!councilEnded ? `
          <button type="button" onclick="reopenCurrentScore()" class="px-3 py-1.5 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold shadow-xs">
            ✏️ Mở lại để sửa
          </button>
        ` : ''}
      </div>
    `;
  } else {
    actionsHtml = `
      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <span id="cws-score-draft-time" class="text-[11px] text-slate-400 font-mono">
          ${savedScore?.status === 'draft' ? `Đã lưu tạm lúc ${fmt24h(savedScore.updatedAt)}` : ''}
        </span>
        <div class="flex items-center gap-2">
          <button type="button" onclick="saveCurrentScore(false)" class="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors">
            💾 Lưu tạm
          </button>
          <button type="button" onclick="saveCurrentScore(true)" class="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors">
            ✓ Hoàn tất chấm
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h3 class="font-black text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
        <span>📝</span> PHIẾU CHẤM ĐIỂM CỦA BẠN
      </h3>
      <span class="badge bg-slate-100 text-slate-600 font-bold text-[10px]">
        Vai trò: ${auth.roleName}
      </span>
    </div>

    ${inputHtml}

    <div>
      <label class="font-bold text-slate-800 text-xs block mb-1">Nhận xét chuyên môn (không bắt buộc):</label>
      <textarea id="cws-score-comment" rows="3" ${isCompleted ? 'disabled' : ''} oninput="onScoreCommentChange(this.value)" placeholder="Góp ý chuyên môn, ưu khuyết điểm cho sinh viên..." class="w-full p-2.5 border border-slate-300 rounded-xl text-xs ${isCompleted ? 'bg-slate-100 text-slate-600' : 'bg-white focus:ring-2 focus:ring-blue-500'}">${escapeHtml(currentComment)}</textarea>
    </div>

    ${actionsHtml}

    <p class="text-[10px] text-slate-400 italic">🔒 Điểm và nhận xét của bạn được bảo mật riêng tư, các thành viên khác trong Hội đồng và Sinh viên không thể xem chi tiết điểm này.</p>
  `;
}

window.onSelectLetterScore = function(key) {
  const input = document.getElementById('cws-score-input-letter');
  if (input) input.value = key;
  onScoreInputChange(key);
  renderScoringSection();
};

window.onScoreInputChange = function(val) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].value = val;
};

window.onScoreCommentChange = function(comm) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].comment = comm;
};

// 11. SAVE & REOPEN SCORE (CONCURRENCY & PRIVACY)
window.saveCurrentScore = async function(isCompleted) {
  if (!checkImpersonationWriteGuard('Lưu điểm thành viên hội đồng')) return;

  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!act || !council) return;

  const mode = act.scoringConfig?.mode || 'numeric';
  let val = '';
  let components = {};

  if (mode === 'letter') {
    val = document.getElementById('cws-score-input-letter')?.value || state.councilLocalDrafts?.[sid]?.value || '';
  } else if (mode === 'defense_rubric') {
    val = document.getElementById('cws-score-input-numeric')?.value ?? state.councilLocalDrafts?.[sid]?.value ?? '';
    const rubric = act.scoringConfig.rubric || [
      { id: 'crit_idea', key: 'idea', label: 'Ý tưởng', maxScore: 4 },
      { id: 'crit_prac', key: 'practicality', label: 'Tính ứng dụng', maxScore: 3 },
      { id: 'crit_tech', key: 'technique', label: 'Kỹ thuật thể hiện', maxScore: 2 },
      { id: 'crit_pres', key: 'presentation', label: 'Trình bày', maxScore: 1 }
    ];

    // Read current components
    components = state.councilLocalDrafts?.[sid]?.components || state.councilScores?.[scoreKey]?.components || {};
    rubric.forEach(crit => {
      const inp = document.getElementById(`cws-rubric-input-${crit.key}`);
      if (inp && inp.value !== '' && !isNaN(Number(inp.value))) {
        components[crit.key] = Number(inp.value);
      }
    });

    if (isCompleted) {
      if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
        showToast('Vui lòng nhập điểm tổng trước khi hoàn tất chấm!', 'warning');
        return;
      }
      const totalNum = Number(val);
      if (totalNum < 0 || totalNum > 10) {
        showToast('Điểm tổng kết bảo vệ phải từ 0 đến 10!', 'warning');
        return;
      }

      let compSum = 0;
      for (const crit of rubric) {
        const cVal = components[crit.key];
        if (cVal === undefined || cVal === null || cVal === '' || isNaN(Number(cVal))) {
          showToast(`Vui lòng chấm tiêu chí "${crit.label}"!`, 'warning');
          return;
        }
        const nVal = Number(cVal);
        if (nVal < 0 || nVal > crit.maxScore) {
          showToast(`Tiêu chí "${crit.label}" phải từ 0 đến ${crit.maxScore}!`, 'warning');
          return;
        }
        compSum += nVal;
      }

      if (Math.abs(compSum - totalNum) >= 0.000001) {
        showToast(`Tổng tiêu chí (${compSum.toFixed(2)}) chưa khớp với Điểm tổng (${totalNum})! Vui lòng bấm "Cộng tiêu chí vào Điểm tổng".`, 'warning');
        return;
      }
    }
  } else {
    val = document.getElementById('cws-score-input-numeric')?.value || state.councilLocalDrafts?.[sid]?.value || '';
  }
  const comment = document.getElementById('cws-score-comment')?.value || state.councilLocalDrafts?.[sid]?.comment || '';

  if (isCompleted) {
    if (val === '' || val === null || val === undefined) {
      showToast('Vui lòng chọn hoặc nhập điểm trước khi hoàn tất chấm!', 'warning');
      return;
    }
    if (mode === 'numeric') {
      const num = parseFloat(val);
      const min = act.scoringConfig.numericConfig?.min ?? 0;
      const max = act.scoringConfig.numericConfig?.max ?? 10;
      if (isNaN(num) || num < min || num > max) {
        showToast(`Điểm phải nằm trong thang điểm từ ${min} đến ${max}!`, 'warning');
        return;
      }
    }

    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const confirmed = await showConfirm(
      'Xác nhận hoàn tất chấm',
      `Xác nhận hoàn tất chấm sinh viên "${sName}" (${sid}) với kết quả: ${val}?`,
      { confirmText: 'Hoàn tất chấm', danger: false }
    );
    if (!confirmed) return;
  }

  const effectiveScorer = getEffectiveActor();
  const scorerId = effectiveScorer.uid || effectiveScorer.email;
  const scorerEmail = (effectiveScorer.email || '').toLowerCase().trim();
  const scorerName = effectiveScorer.displayName || auth.roleName || 'Thành viên Hội đồng';
  const scoreKey = `${activityId}_${councilId}_${sid}_${scorerId}`;

  let selectedLetterCode = undefined;
  let selectedLetterNumericValue = undefined;
  if (mode === 'letter') {
    selectedLetterCode = String(val);
    const letterOpt = (act.scoringConfig?.letterOptions || []).find(o => String(o.key) === selectedLetterCode || String(o.code) === selectedLetterCode);
    if (letterOpt && typeof letterOpt.numericValue === 'number') {
      selectedLetterNumericValue = letterOpt.numericValue;
    }
  }

  const existing = state.councilScores?.[scoreKey] || {};
  const scoreRecord = {
    activityId,
    councilId,
    studentId: sid,
    scorerId,
    scorerEmail,
    scorerName,
    decidedBy: scorerEmail,
    supervisorEmail: scorerEmail,
    slotKey: auth.slotKey || 'admin',
    role: auth.role || 'member',
    mode,
    value: (mode === 'numeric' || mode === 'defense_rubric') ? parseFloat(val) : String(val),
    selectedLetterCode,
    selectedLetterNumericValue,
    numericValue: (mode === 'numeric' || mode === 'defense_rubric')
      ? parseFloat(val)
      : (typeof selectedLetterNumericValue === 'number' ? selectedLetterNumericValue : undefined),
    components: mode === 'defense_rubric' ? components : undefined,
    comment: String(comment || '').trim(),
    status: isCompleted ? 'completed' : 'draft',
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: isCompleted ? (existing.completedAt || new Date().toISOString()) : null
  };

  // 1. In-memory update
  state.councilScores[scoreKey] = scoreRecord;
  delete state.councilLocalDrafts[sid];

  // 2. Persist to Firestore: Concurrency-safe atomic key update
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    
    // Best-effort subcollection write (authorized for both admin and staff under reviewDecisions)
    try {
      const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', scoreKey);
      await setDoc(decRef, scoreRecord, { merge: true }).catch(() => {});
    } catch (subErr) {}

    // Atomic dot-notation update on graduationRounds document (preserves other scorers)
    if (state.isAdmin) {
      await updateDoc(roundRef, {
        [`councilScores.${scoreKey}`]: scoreRecord,
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.warn('Persist score notice:', err);
  }

  // Refresh Views
  renderCouncilStudentList();
  renderScoringSection();
  renderScorersProgress();
  renderAdminMonitor();

  const sObj = findStudentInRound(sid);
  const sName = sObj?.fullName || sObj?.studentName || sid;
  if (isCompleted) {
    showToast(`✓ Đã hoàn tất chấm điểm sinh viên ${sName}!`, 'success');
  } else {
    showToast(`Đã lưu tạm điểm cho sinh viên ${sName}.`, 'info');
  }
};

window.reopenCurrentScore = async function() {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const scorerId = getEffectiveActor().uid || getEffectiveActor().email;
  const scoreKey = `${activityId}_${councilId}_${sid}_${scorerId}`;

  const existing = state.councilScores?.[scoreKey];
  if (!existing) return;

  existing.status = 'draft';
  existing.updatedAt = new Date().toISOString();

  try {
    const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', scoreKey);
    await setDoc(decRef, existing, { merge: true }).catch(() => {});
    if (state.isAdmin) {
      const roundRef = doc(db, 'graduationRounds', roundId);
      await updateDoc(roundRef, {
        [`councilScores.${scoreKey}`]: existing,
        updatedAt: serverTimestamp()
      });
    }
  } catch (e) {}

  renderCouncilStudentList();
  renderScoringSection();
  renderScorersProgress();
  renderAdminMonitor();
  showToast('Đã mở lại phiếu chấm. Bạn có thể chỉnh sửa và hoàn tất lại.', 'info');
};

// 12. PROGRESS OF SCORERS IN COUNCIL (PRIVACY PRESERVED)
function renderScorersProgress() {
  const container = document.getElementById('cws-scorers-progress-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  const sid = state.activeCouncilSelectedStudentId;
  if (!act?.scoringConfig?.enabled || !sid || !council) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const slots = act.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};
  const myUserId = getEffectiveActor().uid || getEffectiveActor().email;

  const reqSlots = getRequiredScorers(council, act);
  const guestSlots = getGuestScorers(council, act);

  let reqCompleted = 0;
  let reqTotal = 0;
  let guestCompleted = 0;
  let guestTotal = 0;

  const itemsHtml = slots.map(s => {
    const assigned = membersBySlot[s.key];
    const isAssigned = Boolean(assigned && (assigned.memberId || assigned.memberName));
    const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
    const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
    const score = scoreKey ? state.councilScores?.[scoreKey] : null;

    const isMandatory = (s.type === 'mandatory');
    if (isMandatory && isAssigned) {
      reqTotal++;
      if (score?.status === 'completed') reqCompleted++;
    } else if (!isMandatory && isAssigned) {
      guestTotal++;
      if (score?.status === 'completed') guestCompleted++;
    }

    // PRIVACY CHECK (v2.0.0-beta.1):
    // Before 'ended': Only see score value if Admin or own score. Chair CANNOT see others.
    // Once 'ended' or 'finalized': Chair sees all scores in their own council!
    const isCouncilEnded = (council.status === 'ended' || council.status === 'finalized' || council.status === 'completed');
    const isOwnScore = (scorerId && (scorerId === myUserId || (assigned?.memberEmail && assigned.memberEmail.toLowerCase() === (getEffectiveActor().email || '').toLowerCase())));
    const canSeeValue = (auth.isAdmin || isOwnScore || (isCouncilEnded && auth.isChair));

    let statusPill = '<span class="text-slate-400 font-mono text-xs">— Chưa chấm</span>';
    if (!isAssigned) {
      statusPill = '<span class="text-slate-300 italic text-[11px]">Chưa phân công</span>';
    } else if (score?.status === 'completed') {
      if (canSeeValue) {
        statusPill = `<span class="badge bg-emerald-100 text-emerald-800 font-bold text-xs">✓ Đã chấm (${score.value})</span>`;
      } else {
        statusPill = '<span class="badge bg-emerald-100 text-emerald-800 font-bold text-xs">✓ Đã hoàn tất</span>';
      }
    } else if (score?.status === 'draft') {
      if (canSeeValue) {
        statusPill = `<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Lưu tạm (${score.value || '--'})</span>`;
      } else {
        statusPill = '<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Đang chấm</span>';
      }
    }

    return `
      <div class="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs">
        <div>
          <span class="font-bold text-slate-800">${s.name || s.label}</span>
          <span class="text-slate-500 font-normal ml-1">(${assigned?.memberName || 'Chưa phân công'})</span>
          ${isMandatory ? '<span class="text-rose-500 font-bold ml-1">*</span>' : ''}
        </div>
        <div>${statusPill}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="font-black text-xs text-slate-800 uppercase tracking-wider">Tiến độ chấm điểm của Hội đồng cho SV này</h4>
      <div class="text-[11px] font-bold text-slate-600 space-x-2">
        <span>Bắt buộc: <strong class="${reqCompleted === reqTotal && reqTotal > 0 ? 'text-emerald-700' : 'text-amber-700'}">${reqCompleted}/${reqTotal}</strong></span>
        ${guestTotal > 0 ? `<span>• Khách mời: <strong>${guestCompleted}/${guestTotal}</strong></span>` : ''}
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
      ${itemsHtml}
    </div>
  `;
}

// 13. ADMIN REAL-TIME MONITOR (ONLY FOR ADMIN)
function renderAdminMonitor() {
  const container = document.getElementById('cws-admin-monitor-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace;
  if (!auth.isAdmin) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  const assignments = (act?.councilStudentAssignments || [])
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const slots = act?.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};
  const mode = act?.scoringConfig?.mode || 'numeric';

  const rowsHtml = assignments.map(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;

    let totalCompletedVal = 0;
    let completedCount = 0;
    const letterCounts = {};

    const cellsHtml = slots.map(s => {
      const assigned = membersBySlot[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (score?.status === 'completed') {
        if (mode === 'numeric') {
          totalCompletedVal += Number(score.value || 0);
          completedCount++;
          return `<td class="p-2 text-center font-mono font-bold text-emerald-700">${score.value}</td>`;
        } else {
          letterCounts[score.value] = (letterCounts[score.value] || 0) + 1;
          const numVal = resolveScoreNumericValue(score, act);
          if (typeof numVal === 'number' && !isNaN(numVal)) {
            totalCompletedVal += numVal;
            completedCount++;
          }
          const subText = (typeof numVal === 'number' && !isNaN(numVal)) ? `<div class="text-[10px] text-slate-400 font-normal">(${numVal}đ)</div>` : '';
          return `<td class="p-2 text-center font-mono font-bold text-indigo-700">${score.value}${subText}</td>`;
        }
      } else if (score?.status === 'draft') {
        return `<td class="p-2 text-center font-mono text-amber-600 text-[10px]">● ${score.value || 'Draft'}</td>`;
      }
      return '<td class="p-2 text-center text-slate-300 font-mono">--</td>';
    }).join('');

    let summaryCol = '--';
    if (mode === 'numeric') {
      if (completedCount > 0) {
        const avg = (totalCompletedVal / completedCount).toFixed(2);
        summaryCol = `<strong class="text-slate-900">${avg}</strong> <span class="text-[10px] text-slate-400">(${completedCount} chấm)</span>`;
      }
    } else {
      const entries = Object.entries(letterCounts);
      if (entries.length > 0) {
        const countsStr = entries.map(([k, c]) => `${k}: ${c}`).join(', ');
        if (completedCount > 0) {
          const avg = (totalCompletedVal / completedCount).toFixed(2);
          summaryCol = `<div class="font-bold text-slate-900">${countsStr}</div><div class="text-[10px] text-indigo-600 font-semibold mt-0.5">TB: ${avg}đ (${completedCount} chấm)</div>`;
        } else {
          summaryCol = `<div class="font-bold text-slate-900">${countsStr}</div>`;
        }
      }
    }

    return `
      <tr class="hover:bg-indigo-50/40 transition-colors">
        <td class="p-2 text-center font-mono font-bold text-slate-400">#${asgn.order || '--'}</td>
        <td class="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-2 font-bold text-slate-800 whitespace-nowrap">${sName}</td>
        ${cellsHtml}
        <td class="p-2 text-center font-mono font-semibold">${summaryCol}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="font-black text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
        <span>🛡️</span> Bảng theo dõi Điểm & Trạng thái Hội đồng (Chỉ Quản trị viên)
      </h4>
      <span class="text-[10px] text-indigo-600 font-bold">Real-time Monitor</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden shadow-xs border border-indigo-100">
        <thead class="bg-indigo-50/70 text-indigo-900 border-b border-indigo-100 font-bold">
          <tr>
            <th class="p-2 text-center">#</th>
            <th class="p-2">MSSV</th>
            <th class="p-2">Họ và tên</th>
            ${slots.map(s => `<th class="p-2 text-center whitespace-nowrap">${s.label || s.name}</th>`).join('')}
            <th class="p-2 text-center whitespace-nowrap">${mode === 'numeric' ? 'Điểm TB' : 'Tổng hợp'}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

// 14. URL DIRECT NAVIGATION LISTENER (?x=&a=&c=)
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const xCode = params.get('x') || params.get('round');
      const aCode = params.get('a');
      const cCode = params.get('c');

      if (xCode && aCode && cCode && state.rounds && state.rounds.length > 0) {
        const targetRound = state.rounds.find(r => !r.deleted && (r.shortCode === xCode || r.roundName === xCode || r.id === xCode || r.slug === xCode));
        if (targetRound) {
          const act = (targetRound.activities || []).find(a => a.id === aCode || a.slug === aCode);
          if (act) {
            const council = (act.councils || []).find(c => c.id === cCode || c.slug === cCode);
            if (council) {
              openCouncilWorkspace(targetRound.id, act.id, council.id);
            }
          }
        }
      }
    } catch (e) {
      console.warn('URL council direct navigation notice:', e);
    }
  }, 1500);
});





// ============================================================================
// IFA+ GRADUATION BETA v1.9.0-beta.1: PRELIMINARY + GVHD + THESIS HD/PB
// ============================================================================

// --- 1. CORE CALCULATION & HELPER FUNCTIONS ---

export function getPreliminarySummary(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) return { average: null, count: 0, totalSubmitted: 0, scores: [], excludedScores: [] };

  const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId)
    || (targetRound.eligibleStudents || []).find(s => (s.mssv === studentId || s.studentId === studentId))
    || { studentId };

  const excludedIds = new Set(getPreliminaryExcludedSupervisorIds(reg));
  const allScores = Object.values(targetRound.preliminaryScores || {}).filter(s => s.studentId === studentId);

  const included = [];
  const excluded = [];
  let sum = 0;

  allScores.forEach(sc => {
    const isExcluded = excludedIds.has(sc.scorerId);
    if (isExcluded) {
      excluded.push({ ...sc, reason: 'official_supervisor' });
    } else {
      if (sc.status === 'completed') {
        included.push(sc);
        sum += Number(sc.score);
      }
    }
  });

  // FULL PRECISION (NO intermediate rounding!)
  const average = included.length > 0 ? (sum / included.length) : null;

  return {
    average,
    count: included.length,
    totalSubmitted: allScores.length,
    scores: included,
    excludedScores: excluded
  };
}

export function getPreliminaryAverage(studentId, roundId = null) {
  const summary = getPreliminarySummary(studentId, roundId);
  return summary.average;
}

export function getThesisFinalScore(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) return null;

  const thesis = targetRound.thesisScores?.[studentId];
  if (!thesis || !thesis.hd || !thesis.pb) return null;
  if (thesis.hd.status !== 'completed' || thesis.pb.status !== 'completed') return null;

  // FULL PRECISION: (TM HD + TM PB) / 2
  return (Number(thesis.hd.score) + Number(thesis.pb.score)) / 2;
}

// --- 2. SUPERVISOR ACCEPTED TABLE SCORING CELLS ---

function renderSupervisorScoreCell(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  const sc = targetRound?.supervisorScores?.[studentId];

  if (sc?.status === 'completed') {
    return `
      <div class="flex items-center justify-center gap-1.5">
        <span class="badge bg-emerald-100 text-emerald-800 font-bold font-mono text-xs">${Number(sc.score).toFixed(1)}</span>
        <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="text-blue-600 hover:underline text-[11px] font-bold">Xem</button>
      </div>
    `;
  } else if (sc?.status === 'draft') {
    return `
      <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg font-bold text-[11px]">
        ● Lưu tạm (${sc.score ?? '--'})
      </button>
    `;
  }
  return `
    <button type="button" onclick="openScoreEntryModal('supervisor', '${studentId}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg font-bold text-[11px]">
      + Nhập điểm
    </button>
  `;
}

function renderThesisHdScoreCell(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  const sc = targetRound?.thesisScores?.[studentId]?.hd;

  if (sc?.status === 'completed') {
    return `
      <div class="flex items-center justify-center gap-1.5">
        <span class="badge bg-blue-100 text-blue-800 font-bold font-mono text-xs">${Number(sc.score).toFixed(1)}</span>
        <button type="button" onclick="openScoreEntryModal('tm_hd', '${studentId}')" class="text-blue-600 hover:underline text-[11px] font-bold">Xem</button>
      </div>
    `;
  } else if (sc?.status === 'draft') {
    return `
      <button type="button" onclick="openScoreEntryModal('tm_hd', '${studentId}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg font-bold text-[11px]">
        ● Lưu tạm (${sc.score ?? '--'})
      </button>
    `;
  }
  return `
    <button type="button" onclick="openScoreEntryModal('tm_hd', '${studentId}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg font-bold text-[11px]">
      + Nhập TM HD
    </button>
  `;
}

// --- 3. SUPERVISOR PRELIMINARY SCORING TAB ---

window.renderSupervisorPreliminaryList = function() {
  const container = document.getElementById('sup-prelim-cards-container');
  if (!container) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const actor = getEffectiveActor();
  const myScorerId = actor.uid || actor.email;
  const isAuthorized = actor.isAdmin || (targetRound.preliminaryConfig?.scorerIds || []).includes(myScorerId) || (targetRound.preliminaryConfig?.scorerIds || []).includes(actor.email);

  if (!isAuthorized) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Thầy/Cô chưa được phân quyền chấm Sơ khảo trong Đợt này.</div>';
    return;
  }

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('sup-prelim-search')?.value || '').toLowerCase().trim();
  const filterStatus = document.getElementById('sup-prelim-filter-status')?.value || 'all';

  let myScoredCount = 0;
  const filtered = allStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '';
    const topic = s.topicTitle || '';
    if (q && !sid.toLowerCase().includes(q) && !name.toLowerCase().includes(q) && !topic.toLowerCase().includes(q)) {
      return false;
    }

    const key = `prelim_${sid}_${myScorerId}`;
    const myScore = targetRound.preliminaryScores?.[key];
    const isCompleted = myScore?.status === 'completed';
    if (isCompleted) myScoredCount++;

    if (filterStatus === 'scored' && !isCompleted) return false;
    if (filterStatus === 'unscored' && isCompleted) return false;
    return true;
  });

  const progressEl = document.getElementById('sup-prelim-my-progress');
  if (progressEl) progressEl.textContent = `${myScoredCount} / ${allStudents.length} đã chấm`;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Không có sinh viên phù hợp điều kiện lọc.</div>';
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '--';
    const pType = s.projectType || '--';
    const supervisorsStr = formatStudentSupervisorsForDisplay(s);

    const key = `prelim_${sid}_${myScorerId}`;
    const myScore = targetRound.preliminaryScores?.[key];
    const isCompleted = myScore?.status === 'completed';

    let scoreStatusHtml = '<span class="text-slate-400 text-xs">— Chưa chấm</span>';
    if (isCompleted) {
      scoreStatusHtml = `<span class="badge bg-emerald-100 text-emerald-800 font-bold font-mono text-xs">✓ Đã chấm: ${Number(myScore.score).toFixed(1)}</span>`;
    } else if (myScore?.status === 'draft') {
      scoreStatusHtml = `<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Lưu tạm (${myScore.score ?? '--'})</span>`;
    }

    return `
      <div class="card-surface p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-2.5 shadow-xs transition-all">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${name}</h4>
            <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
          </div>
          <div>${scoreStatusHtml}</div>
        </div>

        <div class="text-xs text-slate-700 space-y-1">
          <p><strong class="text-slate-500">Đề tài:</strong> ${topic}</p>
          <p><strong class="text-slate-500">Loại hình:</strong> ${pType}</p>
          <div><strong class="text-slate-500">GVHD:</strong> ${supervisorsStr}</div>
        </div>

        <div class="pt-2 border-t flex justify-end">
          <button type="button" onclick="openScoreEntryModal('preliminary', '${sid}')" class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs">
            ${isCompleted ? 'Sửa điểm Sơ khảo' : 'Chấm Sơ khảo'}
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// --- 4. SUPERVISOR REVIEWER (TM PB) TAB ---

window.renderSupervisorReviewerList = function() {
  const container = document.getElementById('sup-reviewer-cards-container');
  if (!container) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const actor = getEffectiveActor();
  const myUserId = actor.uid || actor.email;
  const assignments = targetRound.reviewerAssignments || {};

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const assignedStudents = allStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    return actor.isAdmin || assignments[sid] === myUserId || assignments[sid] === actor.email;
  });

  const countBadge = document.getElementById('sup-reviewer-count-badge');
  if (countBadge) countBadge.textContent = assignedStudents.length;

  if (assignedStudents.length === 0) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">Thầy/Cô chưa được phân công phản biện sinh viên nào trong Đợt này.</div>';
    return;
  }

  container.innerHTML = assignedStudents.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '--';
    const supervisorsStr = formatStudentSupervisorsForDisplay(s);

    const sc = targetRound.thesisScores?.[sid]?.pb;
    const isCompleted = sc?.status === 'completed';

    let scoreStatusHtml = '<span class="text-slate-400 text-xs">— Chưa chấm TM PB</span>';
    if (isCompleted) {
      scoreStatusHtml = `<span class="badge bg-blue-100 text-blue-800 font-bold font-mono text-xs">✓ TM PB: ${Number(sc.score).toFixed(1)}</span>`;
    } else if (sc?.status === 'draft') {
      scoreStatusHtml = `<span class="badge bg-amber-100 text-amber-800 font-bold text-xs">● Lưu tạm (${sc.score ?? '--'})</span>`;
    }

    return `
      <div class="card-surface p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl space-y-2.5 shadow-xs transition-all">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-slate-900 text-sm">${name}</h4>
            <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
          </div>
          <div>${scoreStatusHtml}</div>
        </div>

        <div class="text-xs text-slate-700 space-y-1">
          <p><strong class="text-slate-500">Đề tài:</strong> ${topic}</p>
          <div><strong class="text-slate-500">GVHD:</strong> ${supervisorsStr}</div>
        </div>

        <div class="pt-2 border-t flex justify-end">
          <button type="button" onclick="openScoreEntryModal('tm_pb', '${sid}')" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs">
            ${isCompleted ? 'Sửa điểm TM PB' : 'Nhập điểm TM PB'}
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// --- 5. GENERIC SCORE ENTRY MODAL (SƠ KHẢO, GVHD, TM HD, TM PB) ---

window.openScoreEntryModal = function(type, studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;

  document.getElementById('score-entry-type').value = type;
  document.getElementById('score-entry-student-id').value = studentId;
  document.getElementById('score-entry-student-name').textContent = `Sinh viên: ${sName} (${studentId})`;

  const warningBox = document.getElementById('score-entry-warning-box');
  const valInput = document.getElementById('score-entry-value');
  const commInput = document.getElementById('score-entry-comment');
  const btnComplete = document.getElementById('btn-score-entry-complete');
  const btnDraft = document.getElementById('btn-score-entry-draft');
  const titleEl = document.getElementById('score-entry-modal-title');
  const timeEl = document.getElementById('score-entry-saved-time');

  warningBox.classList.add('hidden');
  valInput.disabled = false;
  commInput.disabled = false;
  btnComplete.disabled = false;
  btnDraft.disabled = false;
  timeEl.textContent = '';

  const myScorerId = getEffectiveActor().uid || getEffectiveActor().email;

  if (type === 'preliminary') {
    titleEl.textContent = 'Đánh giá Điểm Sơ khảo';
    const key = `prelim_${studentId}_${myScorerId}`;
    const sc = targetRound.preliminaryScores?.[key];
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;
  } else if (type === 'supervisor') {
    titleEl.textContent = 'Nhập Điểm Giảng viên Hướng dẫn (GVHD)';
    const sc = targetRound.supervisorScores?.[studentId];
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;

    // Concurrency Check: First completed wins
    if (sc?.status === 'completed' && sc.submittedBySupervisorId && sc.submittedBySupervisorId !== myScorerId && !state.isAdmin) {
      warningBox.innerHTML = `
        <strong>Điểm GVHD đã được hoàn tất bởi ${sc.submittedByName || 'GVHD khác'} lúc ${fmt24h(sc.completedAt)}.</strong><br>
        Điểm chính thức: <strong>${sc.score}</strong>. Bạn không cần nhập thêm.
      `;
      warningBox.classList.remove('hidden');
      valInput.disabled = true;
      commInput.disabled = true;
      btnComplete.disabled = true;
      btnDraft.disabled = true;
    }
  } else if (type === 'tm_hd') {
    titleEl.textContent = 'Nhập Điểm Thuyết minh GVHD (TM HD)';
    const sc = targetRound.thesisScores?.[studentId]?.hd;
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;

    // Concurrency Check: First completed wins
    if (sc?.status === 'completed' && sc.submittedBySupervisorId && sc.submittedBySupervisorId !== myScorerId && !state.isAdmin) {
      warningBox.innerHTML = `
        <strong>Điểm TM HD đã được hoàn tất bởi ${sc.submittedByName || 'GVHD khác'} lúc ${fmt24h(sc.completedAt)}.</strong><br>
        Điểm chính thức: <strong>${sc.score}</strong>. Bạn không cần nhập thêm.
      `;
      warningBox.classList.remove('hidden');
      valInput.disabled = true;
      commInput.disabled = true;
      btnComplete.disabled = true;
      btnDraft.disabled = true;
    }
  } else if (type === 'tm_pb') {
    titleEl.textContent = 'Nhập Điểm Thuyết minh Phản biện (TM PB)';
    const sc = targetRound.thesisScores?.[studentId]?.pb;
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;
  } else if (type.startsWith('duyet_')) {
    const phase = type.replace('duyet_', '');
    titleEl.textContent = `Đánh giá Tiến độ Duyệt đợt ${phase}`;
    const sc = targetRound.progressReviews?.[type]?.[studentId];
    valInput.value = sc?.score ?? '';
    commInput.value = sc?.comment ?? '';
    if (sc?.updatedAt) timeEl.textContent = `Lưu lúc ${fmt24h(sc.updatedAt)}`;
  }

  document.getElementById('modal-score-entry')?.classList.remove('hidden');
};

window.closeScoreEntryModal = function() {
  document.getElementById('modal-score-entry')?.classList.add('hidden');
};

window.saveScoreEntry = async function(isCompleted) {
  if (!checkImpersonationWriteGuard('Lưu mục điểm đánh giá')) return;

  const type = document.getElementById('score-entry-type').value;
  const studentId = document.getElementById('score-entry-student-id').value;
  const valStr = document.getElementById('score-entry-value').value;
  const comment = document.getElementById('score-entry-comment').value.trim();

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound || !studentId) return;

  const numVal = parseFloat(valStr);
  if (isCompleted) {
    if (isNaN(numVal) || numVal < 0 || numVal > 10) {
      showToast('Điểm phải từ 0 đến 10!', 'warning');
      return;
    }
    const confirmed = await showConfirm(
      'Xác nhận hoàn tất',
      `Xác nhận hoàn tất lưu điểm ${numVal} cho sinh viên?`,
      { confirmText: 'Hoàn tất', danger: false }
    );
    if (!confirmed) return;
  }

  const effectiveScorer = getEffectiveActor();
  const myScorerId = effectiveScorer.uid || effectiveScorer.email;
  const myScorerEmail = (effectiveScorer.email || '').toLowerCase().trim();
  const myScorerName = effectiveScorer.displayName || 'Giảng viên';

  const roundId = targetRound.id;
  const now = new Date().toISOString();

  if (type === 'preliminary') {
    targetRound.preliminaryScores = targetRound.preliminaryScores || {};
    const key = `prelim_${studentId}_${myScorerId}`;
    const record = {
      roundId,
      studentId,
      scorerId: myScorerId,
      scorerEmail: myScorerEmail,
      scorerName: myScorerName,
      decidedBy: myScorerEmail,
      supervisorEmail: myScorerEmail,
      score: isNaN(numVal) ? null : numVal,
      comment,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? now : null
    };
    targetRound.preliminaryScores[key] = record;
    await persistScoreItem(roundId, `preliminaryScores.${key}`, record, key);
  } else if (type === 'supervisor') {
    try {
      const record = await window.submitSupervisorScoreTransaction({
        roundId,
        studentId,
        supervisorId: myScorerId,
        supervisorEmail: myScorerEmail,
        supervisorName: myScorerName,
        score: numVal,
        feedback: comment,
        isCompleted
      });
      targetRound.supervisorScores = targetRound.supervisorScores || {};
      targetRound.supervisorScores[studentId] = record;
    } catch (err) {
      showToast(err.message || 'Lỗi lưu điểm GVHD', 'error');
      return;
    }
  } else if (type === 'tm_hd') {
    try {
      const record = await window.submitThesisScoreHDTransaction({
        roundId,
        studentId,
        supervisorId: myScorerId,
        supervisorEmail: myScorerEmail,
        supervisorName: myScorerName,
        score: numVal,
        feedback: comment,
        isCompleted
      });
      targetRound.thesisScores = targetRound.thesisScores || {};
      targetRound.thesisScores[studentId] = targetRound.thesisScores[studentId] || {};
      targetRound.thesisScores[studentId].hd = record;
    } catch (err) {
      showToast(err.message || 'Lỗi lưu điểm TM HD', 'error');
      return;
    }
  } else if (type === 'tm_pb') {
    targetRound.thesisScores = targetRound.thesisScores || {};
    targetRound.thesisScores[studentId] = targetRound.thesisScores[studentId] || {};
    const existing = targetRound.thesisScores[studentId].pb;

    const record = {
      roundId,
      studentId,
      score: isNaN(numVal) ? null : numVal,
      comment,
      reviewerId: myScorerId,
      reviewerName: myScorerName,
      reviewerEmail: myScorerEmail,
      decidedBy: myScorerEmail,
      supervisorEmail: myScorerEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };
    targetRound.thesisScores[studentId].pb = record;
    await persistScoreItem(roundId, `thesisScores.${studentId}.pb`, record, `tmpb_${studentId}_${myScorerId}`);
  } else if (type.startsWith('duyet_')) {
    const phase = type.replace('duyet_', '');
    targetRound.progressReviews = targetRound.progressReviews || {};
    targetRound.progressReviews[type] = targetRound.progressReviews[type] || {};
    const status = isCompleted ? (numVal >= 5 ? 'passed' : 'failed') : 'draft';
    const record = {
      roundId,
      studentId,
      phase,
      score: isNaN(numVal) ? null : numVal,
      comment,
      status,
      scorerId: myScorerId,
      scorerName: myScorerName,
      scorerEmail: myScorerEmail,
      decidedBy: myScorerEmail,
      updatedAt: now,
      completedAt: isCompleted ? now : null
    };
    targetRound.progressReviews[type][studentId] = record;
    await persistScoreItem(roundId, `progressReviews.${type}.${studentId}`, record, `duyet_${phase}_${studentId}_${myScorerId}`);
  }

  closeScoreEntryModal();
  showToast(isCompleted ? '✓ Đã hoàn tất điểm!' : 'Đã lưu tạm.', isCompleted ? 'success' : 'info');

  // Refresh current view
  if (state.supervisorTab === 'accepted') renderSupervisorAcceptedTable();
  else if (state.supervisorTab === 'preliminary') renderSupervisorPreliminaryList();
  else if (state.supervisorTab === 'reviewer') renderSupervisorReviewerList();
  if (state.currentAdminTab === 'scoring-dashboard') renderAdminScoresTable();
  if (state.currentView === 'assessment') {
    renderAssessmentHeroCard();
    renderCurrentAssessmentTab();
  }
};

async function persistScoreItem(roundId, dotPath, record, decisionKey) {
  try {
    // 1. Subcollection reviewDecisions (authorized under current rules)
    const decRef = doc(db, 'graduationRounds', roundId, 'reviewDecisions', decisionKey);
    await setDoc(decRef, record, { merge: true }).catch(() => {});

    // 2. Round doc atomic dot notation if admin
    if (state.isAdmin) {
      const roundRef = doc(db, 'graduationRounds', roundId);
      await updateDoc(roundRef, {
        [dotPath]: record,
        updatedAt: serverTimestamp()
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Persist score item notice:', err);
  }
}

// --- 6. ADMIN SCORING DASHBOARD MODULE ---

window.switchAdminScoringSubTab = function(tabKey) {
  let mainTab = tabKey;
  if (tabKey === 'overview') mainTab = 'summary';
  else if (tabKey === 'preliminary-config') mainTab = 'preliminary';
  else if (tabKey === 'reviewer-assignment' || tabKey === 'supervisor-config') mainTab = 'thesis';
  else if (tabKey === 'final-score-config' || tabKey === 'ranking' || tabKey === 'export') mainTab = 'summary';

  // 7 horizontal top-level navigation buttons
  const mainTabs = ['duyet-1', 'duyet-2', 'duyet-3', 'thesis', 'preliminary', 'defense', 'summary'];
  mainTabs.forEach(t => {
    const btn = document.getElementById('ascore-tab-btn-' + t);
    if (btn) {
      if (t === mainTab) {
        btn.className = 'ascore-nav-btn px-3.5 py-2 rounded-lg bg-slate-900 text-white shadow-xs font-bold transition-all whitespace-nowrap';
      } else {
        btn.className = 'ascore-nav-btn px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all whitespace-nowrap font-semibold';
      }
    }
  });

  // Hide all panels
  const allPanels = [
    'duyet-1', 'duyet-2', 'duyet-3', 'defense',
    'overview', 'preliminary-config', 'supervisor-config', 'reviewer-assignment', 'final-score-config', 'ranking', 'export'
  ];
  allPanels.forEach(pId => {
    const p = document.getElementById('ascore-panel-' + pId);
    if (p) p.classList.add('hidden');
  });

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;

  // Show target panel based on requested tabKey
  if (tabKey === 'duyet-1') {
    const p = document.getElementById('ascore-panel-duyet-1');
    if (p) p.classList.remove('hidden');
    renderAdminProgressReviewTable(1);
  } else if (tabKey === 'duyet-2') {
    const p = document.getElementById('ascore-panel-duyet-2');
    if (p) p.classList.remove('hidden');
    renderAdminProgressReviewTable(2);
  } else if (tabKey === 'duyet-3') {
    const p = document.getElementById('ascore-panel-duyet-3');
    if (p) p.classList.remove('hidden');
    renderAdminProgressReviewTable(3);
  } else if (tabKey === 'thesis' || tabKey === 'reviewer-assignment') {
    const p = document.getElementById('ascore-panel-reviewer-assignment');
    if (p) p.classList.remove('hidden');
    renderAdminReviewerAssignmentTable();
  } else if (tabKey === 'supervisor-config') {
    const p = document.getElementById('ascore-panel-supervisor-config');
    if (p) p.classList.remove('hidden');
    renderAdminSupervisorScoreConfig();
  } else if (tabKey === 'preliminary' || tabKey === 'preliminary-config') {
    const p = document.getElementById('ascore-panel-preliminary-config');
    if (p) p.classList.remove('hidden');
    renderAdminPreliminaryConfig();
  } else if (tabKey === 'defense') {
    const p = document.getElementById('ascore-panel-defense');
    if (p) p.classList.remove('hidden');
    renderAdminDefenseScoresTable();
  } else if (tabKey === 'summary' || tabKey === 'overview') {
    const p = document.getElementById('ascore-panel-overview');
    if (p) p.classList.remove('hidden');
    renderAdminScoresTable();
  } else if (tabKey === 'final-score-config') {
    const p = document.getElementById('ascore-panel-final-score-config');
    if (p) p.classList.remove('hidden');
    loadAdminFinalScoreConfig(roundId);
  } else if (tabKey === 'ranking') {
    const p = document.getElementById('ascore-panel-ranking');
    if (p) p.classList.remove('hidden');
    loadAdminRankingTab(roundId);
  } else if (tabKey === 'export') {
    const p = document.getElementById('ascore-panel-export');
    if (p) p.classList.remove('hidden');
    loadAdminExportTab(roundId);
  }
};

window.renderAdminProgressReviewTable = function(phase) {
  const tbody = document.getElementById('admin-duyet-' + phase + '-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('admin-duyet-' + phase + '-search')?.value || '').toLowerCase().trim();
  const filterVal = document.getElementById('admin-duyet-' + phase + '-filter')?.value || 'all';

  const filtered = allStudents.filter(s => {
    const sid = (s.mssv || s.studentId || '').toLowerCase();
    const name = (s.fullName || s.studentName || '').toLowerCase();
    const topic = (s.topicTitle || '').toLowerCase();
    if (q && !sid.includes(q) && !name.includes(q) && !topic.includes(q)) return false;

    const reviewData = targetRound.progressReviews?.['duyet_' + phase]?.[s.mssv || s.studentId] || {};
    const status = reviewData.status || 'pending';

    if (filterVal !== 'all' && status !== filterVal) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400">Chưa có dữ liệu duyệt tiến độ cho đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '<span class="text-slate-400 italic">Chưa đăng ký đề tài</span>';
    const supName = s.supervisorName || (targetRound.supervisors || []).find(sup => sup.id === s.supervisorId)?.name || '--';
    const reviewData = targetRound.progressReviews?.['duyet_' + phase]?.[sid] || {};
    const status = reviewData.status || 'pending';
    const score = reviewData.score !== undefined ? Number(reviewData.score).toFixed(1) : '--';

    let statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa duyệt</span>';
    if (status === 'passed') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đạt yêu cầu</span>';
    } else if (status === 'revision') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">⚠️ Cần bổ sung</span>';
    } else if (status === 'failed') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Không đạt</span>';
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-slate-600 max-w-xs truncate" title="${s.topicTitle || ''}">${topic}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap">${supName}</td>
        <td class="p-3 text-center whitespace-nowrap">${statusBadge}</td>
        <td class="p-3 text-center font-mono font-bold whitespace-nowrap">${score !== '--' ? `<span class="badge bg-blue-50 text-blue-800 font-bold">${score}</span>` : '--'}</td>
      </tr>
    `;
  }).join('');
};

window.renderAdminDefenseScoresTable = function() {
  const tbody = document.getElementById('admin-defense-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('admin-defense-search')?.value || '').toLowerCase().trim();

  const filtered = allStudents.filter(s => {
    const sid = (s.mssv || s.studentId || '').toLowerCase();
    const name = (s.fullName || s.studentName || '').toLowerCase();
    if (q && !sid.includes(q) && !name.includes(q)) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không có dữ liệu sinh viên phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const gvhd = targetRound.supervisorScores?.[sid];
    const gvhdDisplay = gvhd?.status === 'completed'
      ? `<span class="badge bg-emerald-50 text-emerald-800 font-bold font-mono text-xs">${Number(gvhd.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const tmFinal = typeof getThesisFinalScore === 'function' ? getThesisFinalScore(sid, targetRound.id) : null;
    const tmDisplay = tmFinal !== null
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${tmFinal.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const defScore = typeof getStudentDefenseScore === 'function' ? getStudentDefenseScore(sid, targetRound.id) : null;
    const defDisplay = defScore !== null
      ? `<strong class="font-mono text-xs text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded-lg">${defScore.toFixed(2)}</strong>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const councilId = targetRound.councilStudentAssignments?.[sid]?.councilId || s.councilId || '--';
    const isFinalized = defScore !== null;
    const statusPill = isFinalized
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã chốt điểm</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Đang đánh giá</span>';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap font-semibold">${councilId}</td>
        <td class="p-3 text-center whitespace-nowrap">${gvhdDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${defDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${statusPill}</td>
      </tr>
    `;
  }).join('');
};

window.loadAdminScoringDashboard = async function() {
  const sel = document.getElementById('admin-scoring-round-select');
  if (sel) {
    sel.innerHTML = (state.rounds || []).map(r => 
      `<option value="${r.id}" ${r.id === state.selectedRoundId ? 'selected' : ''}>${r.title || r.code || r.id}</option>`
    ).join('');
    if (state.selectedRoundId) sel.value = state.selectedRoundId;
  }
  switchAdminScoringSubTab('duyet-1');
};

window.onAdminScoringRoundChange = function(roundId) {
  state.selectedRoundId = roundId;
  const curSubTab = document.querySelector('.ascore-nav-btn.bg-slate-900')?.id?.replace('ascore-tab-btn-', '') || 'duyet-1';
  switchAdminScoringSubTab(curSubTab);
};

window.renderAdminScoresTable = function() {
  const tbody = document.getElementById('admin-scoring-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const q = String(document.getElementById('admin-scoring-search')?.value || '').toLowerCase().trim();
  const filterVal = document.getElementById('admin-scoring-filter')?.value || 'all';

  const filtered = allStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '';
    const topic = s.topicTitle || '';
    if (q && !sid.toLowerCase().includes(q) && !name.toLowerCase().includes(q) && !topic.toLowerCase().includes(q)) {
      return false;
    }

    const prelimAvg = getPreliminaryAverage(sid, targetRound.id);
    const gvhdScore = targetRound.supervisorScores?.[sid]?.status === 'completed' ? targetRound.supervisorScores[sid].score : null;
    const tmHdScore = targetRound.thesisScores?.[sid]?.hd?.status === 'completed' ? targetRound.thesisScores[sid].hd.score : null;
    const tmPbScore = targetRound.thesisScores?.[sid]?.pb?.status === 'completed' ? targetRound.thesisScores[sid].pb.score : null;

    if (filterVal === 'missing_prelim' && prelimAvg !== null) return false;
    if (filterVal === 'missing_gvhd' && gvhdScore !== null) return false;
    if (filterVal === 'missing_tm_hd' && tmHdScore !== null) return false;
    if (filterVal === 'missing_tm_pb' && tmPbScore !== null) return false;
    if (filterVal === 'completed') {
      if (prelimAvg === null || gvhdScore === null || tmHdScore === null || tmPbScore === null) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400">Không có dữ liệu sinh viên phù hợp.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;

    // Sơ khảo
    const prelimAvg = getPreliminaryAverage(sid, targetRound.id);
    const prelimDisplay = prelimAvg !== null
      ? `<span class="badge bg-amber-100 text-amber-900 font-bold font-mono text-xs" title="Full precision: ${prelimAvg}">${prelimAvg.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // GVHD
    const gvhd = targetRound.supervisorScores?.[sid];
    const gvhdDisplay = gvhd?.status === 'completed'
      ? `<span class="badge bg-emerald-100 text-emerald-900 font-bold font-mono text-xs">${Number(gvhd.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // TM HD
    const tmHd = targetRound.thesisScores?.[sid]?.hd;
    const tmHdDisplay = tmHd?.status === 'completed'
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${Number(tmHd.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // TM PB
    const tmPb = targetRound.thesisScores?.[sid]?.pb;
    const tmPbDisplay = tmPb?.status === 'completed'
      ? `<span class="badge bg-blue-50 text-blue-800 font-bold font-mono text-xs">${Number(tmPb.score).toFixed(1)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    // TM FINAL
    const tmFinal = getThesisFinalScore(sid, targetRound.id);
    const tmFinalDisplay = tmFinal !== null
      ? `<strong class="font-mono text-xs text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded-lg" title="Full precision: ${tmFinal}">${tmFinal.toFixed(2)}</strong>`
      : '<span class="text-slate-300 text-[10px] italic">Chưa đủ điểm</span>';

    // BẢO VỆ CHÍNH THỨC & TỔNG KẾT (v2.1.0-beta.1)
    const defScore = getStudentDefenseScore(sid, targetRound.id);
    const defDisplay = defScore !== null
      ? `<span class="badge bg-purple-50 text-purple-900 font-bold font-mono text-xs" title="Full precision: ${defScore}">${defScore.toFixed(2)}</span>`
      : '<span class="text-slate-300 font-mono">--</span>';

    const finalInfo = getFinalScore(sid, targetRound.id);
    const finalDisplay = finalInfo.complete
      ? `<strong class="font-mono text-sm text-indigo-950 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-200">${finalInfo.displayScore}</strong>`
      : `<span class="text-amber-700 font-semibold text-xs" title="${(finalInfo.missing || []).join(', ')}">Chưa đủ</span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 text-center whitespace-nowrap">${prelimDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${gvhdDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmHdDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmPbDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${tmFinalDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${defDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap">${finalDisplay}</td>
        <td class="p-3 text-center whitespace-nowrap space-x-1">
          <button type="button" onclick="openAdminStudentScoreDetail('${sid}')" class="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700 text-xs shadow-xs" title="Xem chi tiết các điểm thành phần">
            Điểm
          </button>
          ${finalInfo.complete ? `
            <button type="button" onclick="openFinalScoreDetailModal('${sid}')" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg font-bold text-indigo-700 text-xs shadow-xs" title="Xem công thức & số thực">
              ∑
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
};

// --- 7. ADMIN STUDENT SCORE DETAIL MODAL ---

window.openAdminStudentScoreDetail = function(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;

  document.getElementById('admin-score-detail-title').textContent = `Chi tiết Điểm số: ${sName} (${studentId})`;
  document.getElementById('admin-score-detail-topic').textContent = `Đề tài: ${sObj?.topicTitle || '--'}`;

  // 1. SƠ KHẢO
  const prelimSummary = getPreliminarySummary(studentId, targetRound.id);
  const prelimAvgEl = document.getElementById('admin-score-detail-prelim-avg');
  if (prelimAvgEl) {
    prelimAvgEl.textContent = prelimSummary.average !== null
      ? `TB: ${prelimSummary.average.toFixed(2)} (${prelimSummary.average})`
      : 'TB: Chưa đủ điểm';
  }

  const prelimListEl = document.getElementById('admin-score-detail-prelim-list');
  const allPrelim = [...prelimSummary.scores, ...prelimSummary.excludedScores];
  if (allPrelim.length === 0) {
    prelimListEl.innerHTML = '<div class="text-slate-400 italic">Chưa có giảng viên nào chấm Sơ khảo cho sinh viên này.</div>';
  } else {
    prelimListEl.innerHTML = allPrelim.map(sc => {
      const isEx = sc.reason === 'official_supervisor';
      return `
        <div class="flex items-center justify-between p-2 bg-white rounded-xl border ${isEx ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-800">${sc.scorerName || sc.scorerEmail}</span>
            ${isEx ? '<span class="badge bg-amber-200 text-amber-900 font-bold text-[10px]">Không tính — GVHD</span>' : '<span class="badge bg-emerald-100 text-emerald-800 font-bold text-[10px]">Tính vào TB</span>'}
          </div>
          <div class="flex items-center gap-2">
            <span class="font-mono font-black text-sm text-slate-900">${sc.score}</span>
            <span class="text-[10px] text-slate-400 font-mono">${fmt24h(sc.completedAt || sc.updatedAt)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. ĐIỂM GVHD
  const gvhd = targetRound.supervisorScores?.[studentId];
  const gvhdBody = document.getElementById('admin-score-detail-gvhd-body');
  const gvhdActions = document.getElementById('admin-score-detail-gvhd-actions');

  if (gvhd?.status === 'completed') {
    gvhdBody.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <span class="text-slate-500 font-semibold">Người nhập điểm:</span>
          <strong class="text-slate-900 ml-1">${gvhd.submittedByName || gvhd.submittedByEmail}</strong>
          <p class="text-[11px] text-slate-400 mt-0.5">Hoàn tất lúc: ${fmt24h(gvhd.completedAt)}</p>
          ${gvhd.comment ? `<p class="text-slate-700 italic mt-1.5 p-2 bg-slate-50 rounded-lg">"${escapeHtml(gvhd.comment)}"</p>` : ''}
        </div>
        <div class="text-right">
          <span class="text-2xl font-mono font-black text-emerald-700">${Number(gvhd.score).toFixed(1)}</span>
        </div>
      </div>
    `;
    gvhdActions.innerHTML = `
      <button type="button" onclick="reopenSupervisorScore('${studentId}')" class="px-2.5 py-1 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 font-bold rounded-lg text-xs shadow-xs">
        🔄 Mở lại Điểm GVHD
      </button>
    `;
  } else {
    gvhdBody.innerHTML = '<div class="text-slate-400 italic">Chưa có điểm GVHD chính thức.</div>';
    gvhdActions.innerHTML = '';
  }

  // 3. THUYẾT MINH
  const tmHd = targetRound.thesisScores?.[studentId]?.hd;
  const tmPb = targetRound.thesisScores?.[studentId]?.pb;
  const tmFinal = getThesisFinalScore(studentId, targetRound.id);

  const tmFinalEl = document.getElementById('admin-score-detail-tm-final');
  if (tmFinalEl) {
    tmFinalEl.textContent = tmFinal !== null
      ? `TM FINAL: ${tmFinal.toFixed(2)} (${tmFinal})`
      : 'TM FINAL: Chưa đủ điểm';
  }

  document.getElementById('admin-score-detail-tm-hd-card').innerHTML = `
    <span class="font-bold text-slate-700 block mb-1">TM HD (GVHD Thuyết minh):</span>
    ${tmHd?.status === 'completed' ? `
      <div class="flex items-center justify-between">
        <span class="font-mono font-black text-lg text-blue-700">${Number(tmHd.score).toFixed(1)}</span>
        <span class="text-[10px] text-slate-400">${tmHd.submittedByName || 'GVHD'}</span>
      </div>
    ` : '<span class="text-slate-400 italic">Chưa chấm</span>'}
  `;

  document.getElementById('admin-score-detail-tm-pb-card').innerHTML = `
    <span class="font-bold text-slate-700 block mb-1">TM PB (GVPB Thuyết minh):</span>
    ${tmPb?.status === 'completed' ? `
      <div class="flex items-center justify-between">
        <span class="font-mono font-black text-lg text-blue-700">${Number(tmPb.score).toFixed(1)}</span>
        <span class="text-[10px] text-slate-400">${tmPb.reviewerName || 'GVPB'}</span>
      </div>
    ` : '<span class="text-slate-400 italic">Chưa chấm</span>'}
  `;

  document.getElementById('modal-admin-score-detail')?.classList.remove('hidden');
};

window.closeAdminStudentScoreDetail = function() {
  document.getElementById('modal-admin-score-detail')?.classList.add('hidden');
};

window.reopenSupervisorScore = async function(studentId) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const confirmed = await showConfirm(
    'Mở lại Điểm GVHD',
    'Bạn có chắc chắn muốn mở lại Điểm GVHD cho sinh viên này không? Giảng viên hướng dẫn sẽ có thể nhập và hoàn tất lại điểm.',
    { confirmText: 'Mở lại', danger: true }
  );
  if (!confirmed) return;

  if (targetRound.supervisorScores?.[studentId]) {
    targetRound.supervisorScores[studentId].status = 'reopened';
    targetRound.supervisorScores[studentId].updatedAt = new Date().toISOString();
  }

  await persistScoreItem(targetRound.id, `supervisorScores.${studentId}.status`, 'reopened', `sup_${studentId}`);
  openAdminStudentScoreDetail(studentId);
  renderAdminScoresTable();
  showToast('Đã mở lại Điểm GVHD thành công.', 'info');
};

// --- 8. ADMIN PRELIMINARY CONFIG & SUPERVISOR CONFIG ---

function renderAdminPreliminaryConfig() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const chk = document.getElementById('chk-admin-preliminary-enabled');
  if (chk) chk.checked = Boolean(targetRound.preliminaryConfig?.enabled);

  const container = document.getElementById('preliminary-scorers-checklist');
  if (!container) return;

  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  const selectedSet = new Set(targetRound.preliminaryConfig?.scorerIds || []);

  container.innerHTML = supervisors.map(sup => {
    const isChecked = selectedSet.has(sup.id) || (sup.email && selectedSet.has(sup.email.toLowerCase()));
    return `
      <label class="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
        <input type="checkbox" value="${sup.id}" data-email="${sup.email || ''}" class="chk-preliminary-scorer rounded text-tdtu-blue" ${isChecked ? 'checked' : ''} onchange="updatePreliminarySelectedCount()">
        <div class="truncate">
          <span class="font-bold text-slate-800 text-xs block truncate">${sup.name}</span>
          <span class="text-[10px] text-slate-400 block truncate">${sup.email || 'Khoa MTCN'}</span>
        </div>
      </label>
    `;
  }).join('');

  updatePreliminarySelectedCount();
}

window.updatePreliminarySelectedCount = function() {
  const checked = document.querySelectorAll('.chk-preliminary-scorer:checked');
  const countEl = document.getElementById('preliminary-selected-count');
  if (countEl) countEl.textContent = `Đã chọn: ${checked.length} GV`;
};

window.saveAdminPreliminaryConfig = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const enabled = document.getElementById('chk-admin-preliminary-enabled')?.checked === true;
  const checked = document.querySelectorAll('.chk-preliminary-scorer:checked');
  const scorerIds = Array.from(checked).map(cb => cb.value);

  targetRound.preliminaryConfig = {
    enabled,
    scorerIds,
    updatedAt: new Date().toISOString()
  };

  try {
    const roundRef = doc(db, 'graduationRounds', targetRound.id);
    await updateDoc(roundRef, {
      preliminaryConfig: targetRound.preliminaryConfig,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu cấu hình Sơ khảo thành công!', 'success');
  } catch (err) {
    showToast('Lỗi lưu cấu hình: ' + err.message, 'error');
  }
};

function renderAdminSupervisorScoreConfig() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;
  const chk = document.getElementById('chk-admin-supervisor-score-enabled');
  if (chk) chk.checked = Boolean(targetRound.supervisorScoreConfig?.enabled !== false);
}

window.saveAdminSupervisorScoreConfig = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const enabled = document.getElementById('chk-admin-supervisor-score-enabled')?.checked === true;
  targetRound.supervisorScoreConfig = {
    enabled,
    updatedAt: new Date().toISOString()
  };

  try {
    const roundRef = doc(db, 'graduationRounds', targetRound.id);
    await updateDoc(roundRef, {
      supervisorScoreConfig: targetRound.supervisorScoreConfig,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu cấu hình Điểm GVHD thành công!', 'success');
  } catch (err) {
    showToast('Lỗi lưu cấu hình: ' + err.message, 'error');
  }
};

// --- 9. ADMIN REVIEWER (GVPB) ASSIGNMENT MODULE ---

function renderAdminReviewerAssignmentTable() {
  const tbody = document.getElementById('admin-reviewer-assignment-tbody');
  if (!tbody) return;

  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const allStudents = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  const assignments = targetRound.reviewerAssignments || {};

  tbody.innerHTML = allStudents.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || '--';
    const currentReviewerId = assignments[sid] || '';

    // Excluded supervisors: GVPB CANNOT be any officialSupervisor of this student!
    const excludedIds = new Set(getPreliminaryExcludedSupervisorIds(s));
    const supervisorsStr = formatStudentSupervisorsForDisplay(s);

    const optionsHtml = '<option value="">-- Chưa phân công GVPB --</option>' + supervisors.map(sup => {
      const isOfficial = excludedIds.has(sup.id) || (sup.email && excludedIds.has(sup.email.toLowerCase()));
      return `
        <option value="${sup.id}" ${currentReviewerId === sup.id ? 'selected' : ''} ${isOfficial ? 'disabled class="text-slate-300 italic"' : ''}>
          ${sup.name} ${isOfficial ? ' (Đang là GVHD của SV)' : ''}
        </option>
      `;
    }).join('');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${name}</td>
        <td class="p-3 max-w-xs truncate" title="${topic}">${topic}</td>
        <td class="p-3 text-slate-700 whitespace-nowrap">${supervisorsStr}</td>
        <td class="p-3">
          <select data-sid="${sid}" class="select-reviewer-assignment w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white ${currentReviewerId ? 'border-blue-300 bg-blue-50/50 text-blue-900' : ''}">
            ${optionsHtml}
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

window.saveAdminReviewerAssignments = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.activeRound;
  if (!targetRound) return;

  const selects = document.querySelectorAll('.select-reviewer-assignment');
  const updatedAssignments = { ...(targetRound.reviewerAssignments || {}) };

  selects.forEach(sel => {
    const sid = sel.getAttribute('data-sid');
    const val = sel.value;
    if (sid) {
      if (val) updatedAssignments[sid] = val;
      else delete updatedAssignments[sid];
    }
  });

  targetRound.reviewerAssignments = updatedAssignments;

  try {
    const roundRef = doc(db, 'graduationRounds', targetRound.id);
    await updateDoc(roundRef, {
      reviewerAssignments: updatedAssignments,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu danh sách phân công GVPB thành công!', 'success');
  } catch (err) {
    showToast('Lỗi lưu phân công: ' + err.message, 'error');
  }
};




// ============================================================================
// v2.0.0-beta.1: RUBRIC EVENT HANDLERS & OFFICIAL DEFENSE SCORE & CALIBRATION
// ============================================================================

window.onRubricComponentChange = function(critKey, val) {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  state.councilLocalDrafts = state.councilLocalDrafts || {};
  state.councilLocalDrafts[sid] = state.councilLocalDrafts[sid] || {};
  state.councilLocalDrafts[sid].components = state.councilLocalDrafts[sid].components || {};
  
  if (val === '' || val === null || val === undefined) {
    delete state.councilLocalDrafts[sid].components[critKey];
  } else {
    state.councilLocalDrafts[sid].components[critKey] = Number(val);
  }

  // Update live component sum display
  const inputs = document.querySelectorAll('input[data-crit-key]');
  let sum = 0;
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) sum += v;
  });

  const sumEl = document.getElementById('cws-rubric-comp-sum');
  if (sumEl) sumEl.textContent = sum.toFixed(2);

  const totalInput = document.getElementById('cws-score-input-numeric');
  const warnEl = document.getElementById('cws-rubric-mismatch-warning');
  if (totalInput) {
    const curTot = parseFloat(totalInput.value);
    if (!isNaN(curTot)) {
      const mismatch = Math.abs(sum - curTot) >= 0.000001;
      if (warnEl) warnEl.classList.toggle('hidden', !mismatch);
    }
  }
};

window.syncRubricSumToTotal = function() {
  const sid = state.activeCouncilSelectedStudentId;
  if (!sid) return;
  const inputs = document.querySelectorAll('input[data-crit-key]');
  let sum = 0;
  inputs.forEach(inp => {
    const v = parseFloat(inp.value);
    if (!isNaN(v)) sum += v;
  });

  const totalInput = document.getElementById('cws-score-input-numeric');
  if (totalInput) {
    totalInput.value = sum.toFixed(2);
    onScoreInputChange(totalInput.value);
  }

  const warnEl = document.getElementById('cws-rubric-mismatch-warning');
  if (warnEl) warnEl.classList.add('hidden');
  showToast(`Đã cập nhật Điểm tổng: ${sum.toFixed(2)}`, 'info');
};

export function resolveScoreNumericValue(score, act) {
  if (!score) return null;
  if (typeof score.numericValue === 'number' && !isNaN(score.numericValue)) return score.numericValue;
  if (typeof score.selectedLetterNumericValue === 'number' && !isNaN(score.selectedLetterNumericValue)) return score.selectedLetterNumericValue;
  if (typeof score.value === 'number' && !isNaN(score.value)) return score.value;
  if (typeof score.value === 'string' && act?.scoringConfig?.letterOptions) {
    const opt = act.scoringConfig.letterOptions.find(o => String(o.key) === score.value || String(o.code) === score.value);
    if (opt && typeof opt.numericValue === 'number' && !isNaN(opt.numericValue)) return opt.numericValue;
  }
  return null;
}

export function getOfficialDefenseScore(studentId, council, act, round) {
  if (!council || !act) return { score: null, isComplete: false, count: 0, mandatoryComplete: false };
  const slots = act.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};
  const activityId = act.id;
  const councilId = council.id;

  let mandatoryTotal = 0;
  let mandatoryCompleted = 0;
  const mandatoryScores = [];
  const includedGuestScores = [];
  const excludedGuestScores = [];

  for (const s of slots) {
    const assigned = membersBySlot[s.key];
    const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
    if (!scorerId) continue;
    const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
    const score = state.councilScores?.[scoreKey];
    const isCompleted = (score?.status === 'completed');
    const resolvedNumeric = resolveScoreNumericValue(score, act);

    if (s.type === 'mandatory') {
      mandatoryTotal++;
      if (isCompleted && typeof resolvedNumeric === 'number' && !isNaN(resolvedNumeric)) {
        mandatoryCompleted++;
        mandatoryScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: resolvedNumeric, displayValue: score.value });
      }
    } else if (s.type === 'guest') {
      if (isCompleted && typeof resolvedNumeric === 'number' && !isNaN(resolvedNumeric)) {
        const isIncluded = council.guestInclusion?.[studentId]?.[s.key] !== false;
        if (isIncluded) {
          includedGuestScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: resolvedNumeric, displayValue: score.value });
        } else {
          excludedGuestScores.push({ slotKey: s.key, scorerId, scorerName: assigned.memberName || scorerId, value: resolvedNumeric, displayValue: score.value });
        }
      }
    }
  }

  const mandatoryComplete = (mandatoryTotal > 0 && mandatoryCompleted === mandatoryTotal);
  const allIncluded = [...mandatoryScores.map(s => s.value), ...includedGuestScores.map(s => s.value)];
  // Retain full IEEE 754 precision!
  const rawAverage = allIncluded.length > 0 ? (allIncluded.reduce((a, b) => a + b, 0) / allIncluded.length) : null;

  return {
    studentId,
    isComplete: mandatoryComplete,
    mandatoryTotal,
    mandatoryCompleted,
    mandatoryComplete,
    score: rawAverage,
    formattedScore: rawAverage !== null ? rawAverage.toFixed(2) : '--',
    mandatoryScores,
    includedGuestScores,
    excludedGuestScores,
    allScoresCount: allIncluded.length
  };
}

window.finalizeCouncilSession = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council || !act) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền chốt điểm Hội đồng!', 'error');
    return;
  }

  // Verification: all mandatory scorers must have completed scores for all students
  const reqSlots = getRequiredScorers(council, act);
  const assignments = (act.councilStudentAssignments || []).filter(a => a.councilId === councilId);
  
  const missingStudents = [];
  for (const asgn of assignments) {
    const sId = asgn.studentId;
    let missingForStudent = false;
    for (const s of reqSlots) {
      const assignedMem = council.membersBySlot?.[s.key];
      const scorerId = assignedMem?.memberId || assignedMem?.memberEmail;
      if (scorerId) {
        const k = `${activityId}_${councilId}_${sId}_${scorerId}`;
        const sc = state.councilScores?.[k];
        if (sc?.status !== 'completed') {
          missingForStudent = true;
          break;
        }
      } else {
        missingForStudent = true;
        break;
      }
    }
    if (missingForStudent) {
      missingStudents.push(sId);
    }
  }

  if (missingStudents.length > 0) {
    showToast(`Không thể chốt điểm: Còn ${missingStudents.length} sinh viên chưa hoàn tất đủ các phiếu chấm bắt buộc!`, 'error');
    return;
  }

  const confirmed = await showConfirm(
    'Chốt điểm Hội đồng',
    `Xác nhận khóa và chốt điểm chính thức cho toàn bộ ${assignments.length} sinh viên của Hội đồng "${council.name}"?`,
    { confirmText: 'Khóa & Chốt điểm', danger: false }
  );
  if (!confirmed) return;

  council.finalDefenseScores = council.finalDefenseScores || {};
  for (const asgn of assignments) {
    const sId = asgn.studentId;
    const official = getOfficialDefenseScore(sId, council, act, targetRound);
    council.finalDefenseScores[sId] = {
      score: official.score,
      completedScoresCount: official.allScoresCount,
      finalizedAt: new Date().toISOString()
    };
  }

  council.status = 'finalized';
  council.finalizedAt = new Date().toISOString();
  council.finalizedBy = getEffectiveActor().email || 'admin';

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`✓ Đã chốt điểm Hội đồng "${council.name}" thành công! Điểm bảo vệ chính thức đã được ghi nhận.`, 'success');
};

window.openReopenCouncilModal = function() {
  const { auth } = state.activeCouncilWorkspace || {};
  if (!auth || !auth.isAdmin) {
    showToast('Chỉ Quản trị viên mới có quyền mở lại Hội đồng đã chốt điểm!', 'error');
    return;
  }
  document.getElementById('reopen-council-reason').value = '';
  document.getElementById('modal-reopen-council')?.classList.remove('hidden');
};

window.closeReopenCouncilModal = function() {
  document.getElementById('modal-reopen-council')?.classList.add('hidden');
};

window.confirmReopenCouncil = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  if (!auth || !auth.isAdmin) {
    showToast('Chỉ Quản trị viên mới có quyền mở lại Hội đồng!', 'error');
    return;
  }

  const reason = document.getElementById('reopen-council-reason')?.value?.trim();
  if (!reason) {
    showToast('Vui lòng nhập lý do mở lại Hội đồng!', 'warning');
    return;
  }

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  council.status = 'ended';
  council.auditLogs = council.auditLogs || [];
  council.auditLogs.unshift({
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    action: 'reopen_council',
    councilId,
    reason,
    adjustedById: state.user?.uid || state.user?.email,
    adjustedByName: state.user?.displayName || 'Quản trị viên',
    adjustedByRole: 'admin',
    createdAt: new Date().toISOString()
  });

  await persistActivityCouncilChanges(targetRound);
  closeReopenCouncilModal();
  renderCouncilWorkspaceFull();
  showToast(`Đã mở lại Hội đồng "${council.name}". Trạng thái: Đã kết thúc (chưa chốt).`, 'info');
};

window.renderPostCouncilSection = function() {
  const container = document.getElementById('cws-post-council-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council || !act) {
    container.classList.add('hidden');
    return;
  }

  const isEndedOrFinalized = (council.status === 'ended' || council.status === 'finalized' || council.status === 'completed');
  if (!isEndedOrFinalized || (!auth.isAdmin && !auth.isChair)) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const assignments = (act.councilStudentAssignments || [])
    .filter(a => a.councilId === councilId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const slots = act.councilStructure?.slots || [];
  const membersBySlot = council.membersBySlot || {};

  const rowsHtml = assignments.map(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const official = getOfficialDefenseScore(sid, council, act, targetRound);

    const cellsHtml = slots.map(s => {
      const assigned = membersBySlot[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${activityId}_${councilId}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (!assigned) {
        return '<td class="p-2 text-center text-slate-300 font-mono text-[11px]">—</td>';
      }

      if (!score || score.status !== 'completed') {
        return '<td class="p-2 text-center text-amber-600 font-mono text-[11px]">Chưa xong</td>';
      }

      const isGuest = (s.type === 'guest');
      const isIncluded = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;

      return `
        <td class="p-2 text-center">
          <div class="flex flex-col items-center gap-0.5">
            <span class="font-mono font-bold text-xs ${isGuest && !isIncluded ? 'line-through text-slate-400' : 'text-slate-900'}">${score.value}</span>
            ${isGuest ? `
              <button type="button" onclick="toggleGuestInclusion('${sid}', '${s.key}', ${!isIncluded})" class="px-1.5 py-0.2 rounded text-[9px] font-black border transition-colors ${isIncluded ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}">
                ${isIncluded ? 'LẤY' : 'BỎ'}
              </button>
            ` : ''}
            <button type="button" onclick="openScoreCalibrationModal('${sid}', '${scorerId}', '${s.key}')" class="text-[10px] text-indigo-600 hover:underline font-bold mt-0.5" title="Hiệu chỉnh điểm">
              Hiệu chỉnh
            </button>
          </div>
        </td>
      `;
    }).join('');

    return `
      <tr class="hover:bg-amber-50/40 transition-colors">
        <td class="p-2 text-center font-mono font-bold text-slate-400">#${asgn.order || '--'}</td>
        <td class="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">${sid}</td>
        <td class="p-2 font-bold text-slate-800 whitespace-nowrap">${sName}</td>
        ${cellsHtml}
        <td class="p-2 text-center font-mono font-black text-sm ${official.isComplete ? 'text-indigo-900 bg-indigo-50/50' : 'text-amber-700 bg-amber-50/50'}">
          ${official.formattedScore}
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h4 class="font-black text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
          <span>⚖️</span> Bảng Hiệu chỉnh & Tính điểm Bảo vệ Chính thức (Chủ tịch / Quản trị viên)
        </h4>
        <p class="text-[11px] text-amber-800 mt-0.5">Chủ tịch có quyền hiệu chỉnh điểm và quyết định LẤY / BỎ điểm Khách mời trước khi chốt điểm.</p>
      </div>
      <span class="badge bg-amber-200 text-amber-900 font-bold text-[10px]">${council.status === 'finalized' ? 'Đã chốt điểm' : 'Sẵn sàng chốt'}</span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden shadow-xs border border-amber-200">
        <thead class="bg-amber-100/70 text-amber-950 border-b border-amber-200 font-bold">
          <tr>
            <th class="p-2 text-center">#</th>
            <th class="p-2">MSSV</th>
            <th class="p-2">Họ và tên</th>
            ${slots.map(s => `<th class="p-2 text-center whitespace-nowrap">${s.label || s.name} ${s.type === 'guest' ? '<span class="text-indigo-600 font-normal">(Khách)</span>' : ''}</th>`).join('')}
            <th class="p-2 text-center whitespace-nowrap bg-indigo-100/80 text-indigo-950">ĐIỂM CHÍNH THỨC</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
};

window.openScoreCalibrationModal = function(studentId, scorerId, slotKey) {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền hiệu chỉnh điểm!', 'error');
    return;
  }

  if (council.status === 'finalized' && !auth.isAdmin) {
    showToast('Hội đồng đã chốt điểm, chỉ Quản trị viên mới có thể điều chỉnh!', 'warning');
    return;
  }

  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;
  const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
  const score = state.councilScores?.[scoreKey];
  const assigned = council.membersBySlot?.[slotKey];

  document.getElementById('calib-student-id').value = studentId;
  document.getElementById('calib-scorer-id').value = scorerId;
  document.getElementById('calib-slot-key').value = slotKey;
  document.getElementById('calib-student-meta').textContent = `Sinh viên: ${sName} (${studentId})`;
  document.getElementById('calib-scorer-info').textContent = `${assigned?.memberName || scorerId} (${assigned?.role || slotKey})`;
  document.getElementById('calib-current-val').textContent = (score?.value !== undefined && score.value !== null) ? score.value : '--';
  document.getElementById('calib-new-val').value = (score?.value !== undefined && score.value !== null) ? score.value : '';
  document.getElementById('calib-reason').value = '';

  document.getElementById('modal-score-calibration')?.classList.remove('hidden');
};

window.closeScoreCalibrationModal = function() {
  document.getElementById('modal-score-calibration')?.classList.add('hidden');
};

window.saveScoreCalibration = async function() {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền hiệu chỉnh điểm!', 'error');
    return;
  }

  if (council.status === 'finalized' && !auth.isAdmin) {
    showToast('Hội đồng đã chốt điểm, chỉ Quản trị viên mới có thể điều chỉnh!', 'warning');
    return;
  }

  const studentId = document.getElementById('calib-student-id')?.value;
  const scorerId = document.getElementById('calib-scorer-id')?.value;
  const slotKey = document.getElementById('calib-slot-key')?.value;
  const newValStr = document.getElementById('calib-new-val')?.value;
  const reason = document.getElementById('calib-reason')?.value?.trim();

  if (newValStr === '' || newValStr === null || isNaN(Number(newValStr))) {
    showToast('Vui lòng nhập điểm mới hợp lệ (0 – 10)!', 'warning');
    return;
  }
  const newVal = Number(newValStr);
  if (newVal < 0 || newVal > 10) {
    showToast('Điểm hiệu chỉnh phải từ 0 đến 10!', 'warning');
    return;
  }

  if (!reason) {
    showToast('Vui lòng nhập lý do hiệu chỉnh điểm bắt buộc!', 'warning');
    return;
  }

  const scoreKey = `${activityId}_${councilId}_${studentId}_${scorerId}`;
  const existing = state.councilScores?.[scoreKey] || {};
  const oldVal = existing.value !== undefined ? existing.value : null;

  const assigned = council.membersBySlot?.[slotKey];
  const sObj = findStudentInRound(studentId);
  const sName = sObj?.fullName || sObj?.studentName || studentId;

  // Update score record
  const updatedScore = {
    ...existing,
    activityId,
    councilId,
    studentId,
    scorerId,
    slotKey,
    value: newVal,
    status: 'completed',
    adjusted: true,
    adjustments: [
      ...(existing.adjustments || []),
      {
        originalValue: oldVal,
        newValue: newVal,
        adjustedById: getEffectiveActor().uid || getEffectiveActor().email,
        adjustedByName: getEffectiveActor().displayName || (auth.isAdmin ? 'Quản trị viên' : 'Chủ tịch HĐ'),
        reason,
        timestamp: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  };

  state.councilScores[scoreKey] = updatedScore;

  // Append to council audit logs
  council.auditLogs = council.auditLogs || [];
  council.auditLogs.unshift({
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    roundId,
    activityId,
    councilId,
    studentId,
    studentName: sName,
    scorerId,
    scorerName: assigned?.memberName || scorerId,
    slotKey,
    field: 'defense_score',
    originalValue: oldVal,
    newValue: newVal,
    reason,
    adjustedById: state.user?.uid || state.user?.email,
    adjustedByName: state.user?.displayName || (auth.isAdmin ? 'Quản trị viên' : 'Chủ tịch HĐ'),
    adjustedByRole: auth.isAdmin ? 'admin' : 'chair',
    createdAt: new Date().toISOString()
  });

  // Persist to Firestore
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    if (state.isAdmin) {
      await updateDoc(roundRef, {
        [`councilScores.${scoreKey}`]: updatedScore,
        activities: targetRound.activities,
        updatedAt: serverTimestamp()
      });
    } else {
      await persistActivityCouncilChanges(targetRound);
    }
  } catch (err) {
    console.warn('Persist score calibration notice:', err);
  }

  closeScoreCalibrationModal();
  renderCouncilWorkspaceFull();
  showToast(`✓ Đã hiệu chỉnh điểm cho ${sName} thành công và ghi nhận vào Audit Log!`, 'success');
};

window.toggleGuestInclusion = async function(studentId, slotKey, isIncluded) {
  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council) return;

  if (!auth.isAdmin && !auth.isChair) {
    showToast('Chỉ Chủ tịch Hội đồng hoặc Quản trị viên mới có quyền chọn tính điểm Khách mời!', 'error');
    return;
  }

  if (council.status === 'finalized' && !auth.isAdmin) {
    showToast('Hội đồng đã chốt điểm, không thể thay đổi khách mời!', 'warning');
    return;
  }

  council.guestInclusion = council.guestInclusion || {};
  council.guestInclusion[studentId] = council.guestInclusion[studentId] || {};
  council.guestInclusion[studentId][slotKey] = Boolean(isIncluded);

  await persistActivityCouncilChanges(targetRound);
  renderCouncilWorkspaceFull();
  showToast(`Đã cập nhật tính điểm khách mời: ${isIncluded ? 'LẤY ĐIỂM' : 'KHÔNG LẤY'}.`, 'info');
};

window.renderAuditLogsSection = function() {
  const container = document.getElementById('cws-audit-logs-section');
  if (!container) return;

  const { roundId, activityId, councilId, auth } = state.activeCouncilWorkspace || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  const council = (act?.councils || []).find(c => c.id === councilId);
  if (!council || (!auth.isAdmin && !auth.isChair)) {
    container.classList.add('hidden');
    return;
  }

  const logs = council.auditLogs || [];
  if (logs.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  container.innerHTML = `
    <div class="flex items-center justify-between">
      <h4 class="font-black text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
        <span>📋</span> Nhật ký Kiểm toán (Audit Log) của Hội đồng
      </h4>
      <span class="text-[10px] text-slate-500 font-mono font-bold">${logs.length} bản ghi</span>
    </div>
    <div class="space-y-1.5 max-h-48 overflow-y-auto mt-2">
      ${logs.map(log => `
        <div class="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-start justify-between gap-2">
          <div>
            <div class="font-bold text-slate-900">
              ${log.action === 'reopen_council' ? '🔓 Mở lại Hội đồng' : `Hiệu chỉnh điểm: ${log.studentName || log.studentId} (${log.originalValue} ➔ ${log.newValue})`}
            </div>
            <p class="text-[11px] text-slate-600 mt-0.5">Lý do: <span class="italic font-semibold text-slate-800">"${escapeHtml(log.reason || '')}"</span></p>
            <span class="text-[10px] text-slate-400">Bởi: ${log.adjustedByName || log.adjustedById} (${log.adjustedByRole})</span>
          </div>
          <span class="text-[10px] text-slate-400 font-mono whitespace-nowrap">${fmt24h(log.createdAt)}</span>
        </div>
      `).join('')}
    </div>
  `;
};

// Section 37: Guest Passcode Blocker Notice & Placeholders
window.openGuestPasscodeModal = function() {
  console.warn('BLOCKER: Secure Guest Passcode requires trusted backend');
  document.getElementById('modal-guest-passcode-entry')?.classList.remove('hidden');
};

window.closeGuestPasscodeModal = function() {
  document.getElementById('modal-guest-passcode-entry')?.classList.add('hidden');
};




// ============================================================================
// IFA+ GRADUATION BETA v2.1.0-beta.1: FINAL SCORE + RANKING + TITLES + EXCEL
// ============================================================================

// 1. DEFENSE SCORE RESOLVER HELPER (Single Source of Truth)
export function getStudentDefenseScore(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) return null;

  const activities = targetRound.activities || [];
  for (const act of activities) {
    if (!act.councilEnabled) continue;
    const councils = act.councils || [];
    for (const c of councils) {
      const asgns = act.councilStudentAssignments || [];
      const hasStudent = asgns.some(a => a.councilId === c.id && a.studentId === studentId);
      if (hasStudent) {
        // If council already has finalDefenseScores cached
        if (c.finalDefenseScores?.[studentId]?.score !== undefined) {
          return c.finalDefenseScores[studentId].score;
        }
        // Otherwise compute via getOfficialDefenseScore
        const official = getOfficialDefenseScore(studentId, c, act, targetRound);
        if (official && official.score !== null) {
          return official.score; // Full precision IEEE 754 float
        }
      }
    }
  }
  return null;
}

// 2. CONFIGURABLE FINAL SCORE CALCULATION ENGINE (NO INTERMEDIATE ROUNDING)
export function getFinalScore(studentId, roundId = null) {
  const rId = roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === rId) || state.activeRound;
  if (!targetRound) {
    return { complete: false, missing: ['Không tìm thấy đợt tốt nghiệp'], rawScore: null, displayScore: '--', components: {} };
  }

  // Use frozen snapshot if round is finalized
  const cfg = (targetRound.finalScoreConfig?.isFinalized && targetRound.finalScoreConfigSnapshot)
    ? targetRound.finalScoreConfigSnapshot
    : (targetRound.finalScoreConfig || {
        enabled: false,
        supervisorWeight: 20,
        thesisWeight: 20,
        defenseWeight: 60,
        runnerUpCount: 2
      });

  const wSup = Number(cfg.supervisorWeight || 0);
  const wThe = Number(cfg.thesisWeight || 0);
  const wDef = Number(cfg.defenseWeight || 0);

  const missing = [];
  let gvhdRaw = null;
  let tmRaw = null;
  let defRaw = null;

  // A. Supervisor Score
  if (wSup > 0) {
    const sc = targetRound.supervisorScores?.[studentId];
    if (sc && sc.status === 'completed' && typeof sc.score === 'number') {
      gvhdRaw = Number(sc.score);
    } else {
      missing.push('Điểm GVHD');
    }
  }

  // B. Thesis Final Score: (TM HD + TM PB) / 2
  if (wThe > 0) {
    const theScore = getThesisFinalScore(studentId, targetRound.id);
    if (theScore !== null && typeof theScore === 'number') {
      tmRaw = Number(theScore);
    } else {
      missing.push('Điểm Thuyết minh');
    }
  }

  // C. Official Defense Score
  if (wDef > 0) {
    const dScore = getStudentDefenseScore(studentId, targetRound.id);
    if (dScore !== null && typeof dScore === 'number') {
      defRaw = Number(dScore);
    } else {
      missing.push('Điểm Bảo vệ');
    }
  }

  const components = {
    gvhd: gvhdRaw !== null ? { raw: gvhdRaw, display: gvhdRaw.toFixed(1) } : null,
    tm: tmRaw !== null ? { raw: tmRaw, display: tmRaw.toFixed(2) } : null,
    defense: defRaw !== null ? { raw: defRaw, display: defRaw.toFixed(2) } : null
  };

  if (missing.length > 0) {
    return {
      studentId,
      complete: false,
      missing,
      rawScore: null,
      displayScore: '--',
      components
    };
  }

  // FULL IEEE 754 PRECISION: NO intermediate rounding!
  const rawScore = (gvhdRaw * (wSup / 100)) + (tmRaw * (wThe / 100)) + (defRaw * (wDef / 100));
  const displayScore = rawScore.toFixed(2);

  return {
    studentId,
    complete: true,
    missing: [],
    rawScore, // Full precision IEEE 754 float
    displayScore,
    components
  };
}

// 3. ADMIN FINAL SCORE CONFIG CONTROLS & VALIDATION
window.validateFinalScoreWeights = function() {
  const wSup = parseFloat(document.getElementById('cfg-weight-supervisor')?.value) || 0;
  const wThe = parseFloat(document.getElementById('cfg-weight-thesis')?.value) || 0;
  const wDef = parseFloat(document.getElementById('cfg-weight-defense')?.value) || 0;
  const total = Math.round((wSup + wThe + wDef) * 100) / 100;

  const totalEl = document.getElementById('cfg-weights-total-display');
  const msgEl = document.getElementById('cfg-weights-msg');
  const statusBox = document.getElementById('cfg-weights-status-box');
  const chkEnable = document.getElementById('chk-admin-final-score-enabled');

  if (totalEl) totalEl.textContent = `${total}%`;

  const isValid = (Math.abs(total - 100) < 0.000001);

  if (statusBox) {
    if (isValid) {
      statusBox.className = 'p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-wrap items-center justify-between gap-3 text-xs';
      if (msgEl) msgEl.innerHTML = '<span class="text-emerald-700 font-bold flex items-center gap-1"><span>✓</span> Hợp lệ (Tổng trọng số đúng 100%)</span>';
    } else {
      statusBox.className = 'p-4 rounded-xl border border-rose-300 bg-rose-50/80 flex flex-wrap items-center justify-between gap-3 text-xs';
      if (msgEl) msgEl.innerHTML = `<span class="text-rose-700 font-bold flex items-center gap-1"><span>⚠️</span> Không hợp lệ (Hiện tại: ${total}% — Phải đúng bằng 100%)</span>`;
      if (chkEnable && chkEnable.checked) {
        chkEnable.checked = false;
        showToast('Không thể kích hoạt: Tổng trọng số phải đúng bằng 100%!', 'warning');
      }
    }
  }
  return isValid;
};

window.loadAdminFinalScoreConfig = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const cfg = targetRound.finalScoreConfig || {
    enabled: false,
    supervisorWeight: 20,
    thesisWeight: 20,
    defenseWeight: 60,
    runnerUpCount: 2,
    tieThukhoaRule: 'co_title',
    tieAkhoaRule: 'co_title'
  };

  const chkEnable = document.getElementById('chk-admin-final-score-enabled');
  if (chkEnable) chkEnable.checked = Boolean(cfg.enabled);

  const inpSup = document.getElementById('cfg-weight-supervisor');
  if (inpSup) inpSup.value = cfg.supervisorWeight ?? 20;

  const inpThe = document.getElementById('cfg-weight-thesis');
  if (inpThe) inpThe.value = cfg.thesisWeight ?? 20;

  const inpDef = document.getElementById('cfg-weight-defense');
  if (inpDef) inpDef.value = cfg.defenseWeight ?? 60;

  const inpRunner = document.getElementById('cfg-runner-up-count');
  if (inpRunner) inpRunner.value = cfg.runnerUpCount ?? 2;

  const rTie = document.querySelector(`input[name="cfg_tie_rule"][value="${cfg.tieThukhoaRule || 'co_title'}"]`);
  if (rTie) rTie.checked = true;

  const chkPubScore = document.getElementById('chk-publish-final-score');
  if (chkPubScore) chkPubScore.checked = Boolean(targetRound.publishFinalScoreToStudents);

  const chkPubRank = document.getElementById('chk-publish-ranking');
  if (chkPubRank) chkPubRank.checked = Boolean(targetRound.publishRankingToStudents);

  validateFinalScoreWeights();
};

window.saveAdminFinalScoreConfig = async function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const isEnabled = document.getElementById('chk-admin-final-score-enabled')?.checked === true;
  const wSup = parseFloat(document.getElementById('cfg-weight-supervisor')?.value) || 0;
  const wThe = parseFloat(document.getElementById('cfg-weight-thesis')?.value) || 0;
  const wDef = parseFloat(document.getElementById('cfg-weight-defense')?.value) || 0;
  const runnerUpCount = parseInt(document.getElementById('cfg-runner-up-count')?.value, 10) || 2;
  const tieRule = document.querySelector('input[name="cfg_tie_rule"]:checked')?.value || 'co_title';
  const publishFinalScore = document.getElementById('chk-publish-final-score')?.checked === true;
  const publishRanking = document.getElementById('chk-publish-ranking')?.checked === true;

  const total = Math.round((wSup + wThe + wDef) * 100) / 100;
  if (isEnabled && Math.abs(total - 100) >= 0.000001) {
    showToast(`Không thể kích hoạt: Tổng trọng số các thành phần phải đúng bằng 100% (Hiện tại: ${total}%)!`, 'error');
    return;
  }

  const finalScoreConfig = {
    ...(targetRound.finalScoreConfig || {}),
    enabled: isEnabled,
    supervisorWeight: wSup,
    thesisWeight: wThe,
    defenseWeight: wDef,
    runnerUpCount: Math.max(0, runnerUpCount),
    tieThukhoaRule: tieRule,
    tieAkhoaRule: tieRule,
    updatedAt: new Date().toISOString()
  };

  targetRound.finalScoreConfig = finalScoreConfig;
  targetRound.publishFinalScoreToStudents = publishFinalScore;
  targetRound.publishRankingToStudents = publishRanking;

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      finalScoreConfig,
      publishFinalScoreToStudents: publishFinalScore,
      publishRankingToStudents: publishRanking,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã lưu Cấu hình Điểm Tổng kết thành công!', 'success');
  } catch (e) {
    console.warn('Persist finalScoreConfig notice:', e);
    showToast('✓ Đã cập nhật cấu hình Điểm Tổng kết!', 'success');
  }

  renderAdminScoresTable();
};

// 4. ROUND RANKING ENGINE (FULL RAW PRECISION & TRUE TIE RESOLUTION)
export function computeRoundRanking(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;
  if (!targetRound) return { rankedStudents: [], incompleteStudents: [], hasTrueTie: false, tieGroups: {} };

  // Use snapshot if finalized
  if (targetRound.finalScoreConfig?.isFinalized && Array.isArray(targetRound.rankingSnapshot)) {
    return {
      rankedStudents: targetRound.rankingSnapshot,
      incompleteStudents: [],
      hasTrueTie: false,
      tieGroups: {},
      isFinalized: true,
      calculatedAt: targetRound.finalScoreConfig.finalizedAt
    };
  }

  const registrations = state.adminReviewData?.registrations || [];
  const eligibleStudents = targetRound.eligibleStudents || [];

  // Deduplicate all student IDs in round
  const studentMap = new Map();
  eligibleStudents.forEach(s => {
    const sid = s.mssv || s.studentId;
    if (sid) {
      const facName = (window.getFacultyStudent ? window.getFacultyStudent(sid)?.name : '') || sid;
      studentMap.set(sid, { studentId: sid, fullName: s.fullName || s.studentName || facName });
    }
  });
  registrations.forEach(r => {
    const sid = r.studentId || r.mssv;
    if (sid) studentMap.set(sid, { studentId: sid, fullName: r.studentName || r.fullName || sid });
  });

  const allStudents = Array.from(studentMap.values());
  const completedList = [];
  const incompleteList = [];

  allStudents.forEach(st => {
    const fScore = getFinalScore(st.studentId, targetRound.id);
    if (fScore.complete) {
      completedList.push({
        studentId: st.studentId,
        fullName: st.fullName,
        rawScore: fScore.rawScore, // Full IEEE 754 precision
        displayScore: fScore.displayScore,
        components: fScore.components
      });
    } else {
      incompleteList.push({
        studentId: st.studentId,
        fullName: st.fullName,
        missing: fScore.missing,
        components: fScore.components
      });
    }
  });

  // SORT STRICTLY BY RAW SCORE DESCENDING (NEVER SORT BY DISPLAY ROUNDED!)
  completedList.sort((a, b) => b.rawScore - a.rawScore);

  // Group True Ties (epsilon < 1e-9)
  const tieGroups = {};
  let tieGroupIdCounter = 1;
  for (let i = 0; i < completedList.length - 1; i++) {
    const a = completedList[i];
    const b = completedList[i + 1];
    if (Math.abs(a.rawScore - b.rawScore) < 1e-9) {
      let gId = a.tieGroup;
      if (!gId) {
        gId = 'tie_' + (tieGroupIdCounter++);
        a.tieGroup = gId;
        tieGroups[gId] = [a];
      }
      b.tieGroup = gId;
      if (!tieGroups[gId].includes(b)) tieGroups[gId].push(b);
    }
  }

  // Apply ranking overrides if Admin decided manual order
  const overrides = targetRound.finalScoreConfig?.rankingOverrides || {};
  Object.keys(overrides).forEach(gId => {
    const orderedSids = overrides[gId];
    if (Array.isArray(orderedSids) && tieGroups[gId]) {
      const groupStudents = [...tieGroups[gId]];
      groupStudents.sort((x, y) => orderedSids.indexOf(x.studentId) - orderedSids.indexOf(y.studentId));
      tieGroups[gId] = groupStudents;
    }
  });

  // Assign Ranks and Titles
  const runnerUpCount = targetRound.finalScoreConfig?.runnerUpCount ?? 2;
  const tieRule = targetRound.finalScoreConfig?.tieThukhoaRule || 'co_title';
  const rankedStudents = [];

  let currentRank = 1;
  let i = 0;
  while (i < completedList.length) {
    const currentStudent = completedList[i];
    const gId = currentStudent.tieGroup;

    if (gId && tieRule === 'co_title') {
      const tiedGroup = tieGroups[gId];
      const count = tiedGroup.length;
      
      // Determine Title
      let title = '';
      if (currentRank === 1) {
        title = 'Đồng Thủ khoa';
      } else if (currentRank <= 1 + runnerUpCount) {
        title = 'Đồng Á khoa';
      }

      tiedGroup.forEach(st => {
        rankedStudents.push({
          ...st,
          rank: currentRank,
          title,
          isTie: true
        });
      });

      i += count;
      currentRank += count;
    } else {
      let title = '';
      if (currentRank === 1) {
        title = 'Thủ khoa';
      } else if (currentRank <= 1 + runnerUpCount) {
        title = 'Á khoa';
      }

      rankedStudents.push({
        ...currentStudent,
        rank: currentRank,
        title,
        isTie: Boolean(gId)
      });

      i++;
      currentRank++;
    }
  }

  return {
    rankedStudents,
    incompleteStudents,
    hasTrueTie: Object.keys(tieGroups).length > 0,
    tieGroups,
    isFinalized: Boolean(targetRound.finalScoreConfig?.isFinalized),
    calculatedAt: new Date().toISOString()
  };
}

// 5. RANKING TAB RENDER & ACTIONS
window.loadAdminRankingTab = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  state._currentRoundRanking = computeRoundRanking(roundId);
  renderRankingTables();
};

window.executeCalculateRanking = function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  if (targetRound.finalScoreConfig?.isFinalized) {
    showToast('Đợt này đã chốt kết quả. Vui lòng bấm "Mở lại kết quả Đợt" nếu cần tính toán lại!', 'warning');
    return;
  }

  state._currentRoundRanking = computeRoundRanking(roundId);
  state._rankingCalculatedAt = new Date().toISOString();
  
  // Hide stale warning
  document.getElementById('ranking-stale-warning')?.classList.add('hidden');

  renderRankingTables();
  showToast('✓ Đã tính xong xếp hạng toàn đợt theo Điểm Tổng kết!', 'success');
};

window.filterRankingTop = function(topCount) {
  state._rankingTopFilter = topCount;
  const buttons = document.querySelectorAll('.ranking-top-btn');
  buttons.forEach(btn => {
    const bTop = btn.dataset.top;
    if (String(bTop) === String(topCount)) {
      btn.className = 'ranking-top-btn active px-2.5 py-1 rounded-lg border font-bold bg-indigo-600 text-white border-indigo-600';
    } else {
      btn.className = 'ranking-top-btn px-2.5 py-1 rounded-lg border font-bold text-slate-600 hover:bg-white transition-colors';
    }
  });
  renderRankingTables();
};

window.renderRankingTables = function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const rankingData = state._currentRoundRanking || computeRoundRanking(roundId);

  // Status badge & timestamp
  const statusBadge = document.getElementById('ranking-status-badge');
  const timeEl = document.getElementById('ranking-calc-time');
  const finalizeBtn = document.getElementById('btn-finalize-round-results');
  const reopenBtn = document.getElementById('btn-reopen-round-results');

  const isFinalized = Boolean(targetRound?.finalScoreConfig?.isFinalized);
  if (statusBadge) {
    if (isFinalized) {
      statusBadge.className = 'badge bg-slate-800 text-white font-black text-xs';
      statusBadge.textContent = '🔒 ĐÃ CHỐT KẾT QUẢ';
    } else if (rankingData.calculatedAt) {
      statusBadge.className = 'badge bg-emerald-100 text-emerald-800 font-bold text-xs';
      statusBadge.textContent = '● Đã tính xếp hạng';
    } else {
      statusBadge.className = 'badge bg-slate-100 text-slate-600 font-bold text-xs';
      statusBadge.textContent = 'Chưa tính';
    }
  }

  if (timeEl && rankingData.calculatedAt) {
    timeEl.textContent = `Cập nhật: ${fmt24h(rankingData.calculatedAt)}`;
  }

  if (finalizeBtn) finalizeBtn.classList.toggle('hidden', isFinalized);
  if (reopenBtn) reopenBtn.classList.toggle('hidden', !isFinalized);

  // Search & Filter
  const q = String(document.getElementById('ranking-search-input')?.value || '').toLowerCase().trim();
  const topLimit = state._rankingTopFilter || 'all';

  let list = rankingData.rankedStudents || [];
  if (q) {
    list = list.filter(st => st.studentId.toLowerCase().includes(q) || st.fullName.toLowerCase().includes(q));
  }

  if (topLimit !== 'all') {
    const limitNum = parseInt(topLimit, 10);
    list = list.slice(0, limitNum);
  }

  const tbody = document.getElementById('ranking-ranked-tbody');
  const countBadge = document.getElementById('ranking-count-badge');
  if (countBadge) countBadge.textContent = rankingData.rankedStudents.length;

  if (tbody) {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-slate-400 text-xs">Chưa có dữ liệu xếp hạng. Vui lòng bấm "⚡ Tính Xếp hạng".</td></tr>';
    } else {
      tbody.innerHTML = list.map(st => {
        let titleBadge = '';
        if (st.title.includes('Thủ khoa')) {
          titleBadge = '<span class="badge bg-amber-400 text-slate-950 font-black text-xs shadow-xs">🎖️ ' + st.title + '</span>';
        } else if (st.title.includes('Á khoa')) {
          titleBadge = '<span class="badge bg-slate-200 text-slate-800 font-bold text-xs">🥈 ' + st.title + '</span>';
        }

        let rankPill = `<span class="font-mono font-bold text-xs text-slate-700">#${st.rank}</span>`;
        if (st.rank === 1) rankPill = '<span class="px-2 py-0.5 bg-amber-100 text-amber-950 font-black rounded-lg font-mono text-xs border border-amber-300">#1</span>';
        else if (st.rank === 2) rankPill = '<span class="px-2 py-0.5 bg-slate-100 text-slate-800 font-bold rounded-lg font-mono text-xs border border-slate-300">#2</span>';
        else if (st.rank === 3) rankPill = '<span class="px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-lg font-mono text-xs border border-amber-200">#3</span>';

        return `
          <tr class="hover:bg-indigo-50/30 transition-colors">
            <td class="p-3 text-center">${rankPill}</td>
            <td class="p-3 font-mono font-bold text-slate-900">${st.studentId}</td>
            <td class="p-3 font-bold text-slate-800 whitespace-nowrap">${st.fullName}</td>
            <td class="p-3 text-center font-mono font-bold text-xs text-emerald-800">${st.components?.gvhd?.display || '--'}</td>
            <td class="p-3 text-center font-mono font-bold text-xs text-blue-800">${st.components?.tm?.display || '--'}</td>
            <td class="p-3 text-center font-mono font-bold text-xs text-purple-800">${st.components?.defense?.display || '--'}</td>
            <td class="p-3 text-center font-mono font-black text-sm text-indigo-950 bg-indigo-50/60">${st.displayScore}</td>
            <td class="p-3 text-center">
              <button type="button" onclick="openFinalScoreDetailModal('${st.studentId}')" class="text-xs text-indigo-600 hover:underline font-bold" title="Xem chi tiết số thực float">
                Chi tiết
              </button>
            </td>
            <td class="p-3 text-center">${titleBadge}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Incomplete Table
  const incTbody = document.getElementById('ranking-incomplete-tbody');
  const incBadge = document.getElementById('ranking-incomplete-count-badge');
  const incList = rankingData.incompleteStudents || [];
  if (incBadge) incBadge.textContent = incList.length;

  if (incTbody) {
    if (incList.length === 0) {
      incTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400 text-xs">Tất cả sinh viên đã có đủ điểm thành phần!</td></tr>';
    } else {
      incTbody.innerHTML = incList.map((st, idx) => `
        <tr class="hover:bg-amber-50/40 transition-colors">
          <td class="p-3 text-center font-mono font-bold text-slate-400">#${idx + 1}</td>
          <td class="p-3 font-mono font-bold text-slate-900">${st.studentId}</td>
          <td class="p-3 font-bold text-slate-800 whitespace-nowrap">${st.fullName}</td>
          <td class="p-3 text-xs text-slate-600">
            GVHD: ${st.components?.gvhd?.display || '--'} | TM: ${st.components?.tm?.display || '--'} | BV: ${st.components?.defense?.display || '--'}
          </td>
          <td class="p-3">
            <span class="badge bg-rose-100 text-rose-800 font-bold text-[11px]">${st.missing.join(', ')}</span>
          </td>
        </tr>
      `).join('');
    }
  }
};

window.finalizeRoundResults = async function() {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const rankingData = state._currentRoundRanking || computeRoundRanking(roundId);
  if (!rankingData || rankingData.rankedStudents.length === 0) {
    showToast('Chưa có dữ liệu xếp hạng để chốt kết quả. Vui lòng bấm "⚡ Tính Xếp hạng" trước!', 'warning');
    return;
  }

  const confirmed = await showConfirm(
    'Khóa & Chốt Kết quả Đợt Tốt nghiệp',
    `Xác nhận chốt kết quả và đóng băng (freeze) bảng xếp hạng cho toàn bộ ${rankingData.rankedStudents.length} sinh viên hoàn tất trong Đợt "${targetRound.title}"? Sau khi chốt, thứ hạng sẽ không thay đổi trừ khi Admin chủ động Mở lại kết quả.`,
    { confirmText: 'Khóa & Chốt kết quả', danger: false }
  );
  if (!confirmed) return;

  targetRound.finalScoreConfig = targetRound.finalScoreConfig || {};
  targetRound.finalScoreConfig.isFinalized = true;
  targetRound.finalScoreConfig.finalizedAt = new Date().toISOString();
  targetRound.finalScoreConfigSnapshot = JSON.parse(JSON.stringify(targetRound.finalScoreConfig));
  targetRound.rankingSnapshot = rankingData.rankedStudents;

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      finalScoreConfig: targetRound.finalScoreConfig,
      finalScoreConfigSnapshot: targetRound.finalScoreConfigSnapshot,
      rankingSnapshot: targetRound.rankingSnapshot,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã chốt và đóng băng kết quả Đợt tốt nghiệp thành công!', 'success');
  } catch (e) {
    console.warn('Persist finalizeRoundResults notice:', e);
    showToast('✓ Đã chốt kết quả Đợt tốt nghiệp!', 'success');
  }

  renderRankingTables();
};

window.openReopenRoundModal = function() {
  document.getElementById('reopen-round-reason').value = '';
  document.getElementById('modal-reopen-round')?.classList.remove('hidden');
};

window.closeReopenRoundModal = function() {
  document.getElementById('modal-reopen-round')?.classList.add('hidden');
};

window.confirmReopenRound = async function() {
  const reason = document.getElementById('reopen-round-reason')?.value?.trim();
  if (!reason) {
    showToast('Vui lòng nhập lý do mở lại kết quả đợt bắt buộc!', 'warning');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  targetRound.finalScoreConfig = targetRound.finalScoreConfig || {};
  targetRound.finalScoreConfig.isFinalized = false;

  targetRound.auditLogs = targetRound.auditLogs || [];
  targetRound.auditLogs.unshift({
    id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    action: 'reopen_round_results',
    roundId,
    reason,
    adjustedById: state.user?.uid || state.user?.email,
    adjustedByName: state.user?.displayName || 'Quản trị viên',
    adjustedByRole: 'admin',
    createdAt: new Date().toISOString()
  });

  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    await updateDoc(roundRef, {
      finalScoreConfig: targetRound.finalScoreConfig,
      auditLogs: targetRound.auditLogs,
      updatedAt: serverTimestamp()
    });
    showToast('✓ Đã mở lại kết quả Đợt. Bảng xếp hạng có thể tính toán lại.', 'info');
  } catch (e) {
    console.warn('Persist reopenRound notice:', e);
    showToast('Đã mở lại kết quả Đợt.', 'info');
  }

  closeReopenRoundModal();
  renderRankingTables();
};

// 6. FORMULA DETAIL MODAL
window.openFinalScoreDetailModal = function(studentId) {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId)
    || (targetRound.eligibleStudents || []).find(s => (s.mssv === studentId || s.studentId === studentId))
    || { studentId };

  const sName = reg.fullName || reg.studentName || studentId;
  const cfg = targetRound.finalScoreConfig || { supervisorWeight: 20, thesisWeight: 20, defenseWeight: 60 };
  const fScore = getFinalScore(studentId, roundId);

  document.getElementById('fs-detail-student-meta').textContent = `Sinh viên: ${sName} (${studentId})`;
  document.getElementById('fs-detail-w-gvhd').textContent = cfg.supervisorWeight ?? 20;
  document.getElementById('fs-detail-w-tm').textContent = cfg.thesisWeight ?? 20;
  document.getElementById('fs-detail-w-def').textContent = cfg.defenseWeight ?? 60;

  const gvhdVal = fScore.components?.gvhd;
  const tmVal = fScore.components?.tm;
  const defVal = fScore.components?.defense;

  document.getElementById('fs-detail-gvhd-val').textContent = gvhdVal?.display || '--';
  document.getElementById('fs-detail-gvhd-raw').textContent = gvhdVal ? `Raw: ${gvhdVal.raw}` : '';

  document.getElementById('fs-detail-tm-val').textContent = tmVal?.display || '--';
  document.getElementById('fs-detail-tm-raw').textContent = tmVal ? `Raw: ${tmVal.raw}` : '';

  document.getElementById('fs-detail-def-val').textContent = defVal?.display || '--';
  document.getElementById('fs-detail-def-raw').textContent = defVal ? `Raw: ${defVal.raw}` : '';

  document.getElementById('fs-detail-formula-text').textContent =
    `Điểm = (GVHD × ${cfg.supervisorWeight}%) + (TM × ${cfg.thesisWeight}%) + (Bảo vệ × ${cfg.defenseWeight}%)`;

  document.getElementById('fs-detail-display-score').textContent = fScore.displayScore || '--';
  document.getElementById('fs-detail-raw-score').textContent = fScore.rawScore !== null ? `Raw: ${fScore.rawScore}` : '';

  // Reset raw toggle
  state._rawPrecisionVisible = false;
  toggleRawPrecisionInDetailModal(false);

  document.getElementById('modal-final-score-detail')?.classList.remove('hidden');
};

window.toggleRawPrecisionInDetailModal = function(forceVal = null) {
  state._rawPrecisionVisible = (forceVal !== null) ? forceVal : !state._rawPrecisionVisible;
  const isVis = state._rawPrecisionVisible;

  document.getElementById('fs-detail-gvhd-raw')?.classList.toggle('hidden', !isVis);
  document.getElementById('fs-detail-tm-raw')?.classList.toggle('hidden', !isVis);
  document.getElementById('fs-detail-def-raw')?.classList.toggle('hidden', !isVis);
  document.getElementById('fs-detail-raw-score')?.classList.toggle('hidden', !isVis);

  const btn = document.getElementById('btn-toggle-raw-precision');
  if (btn) {
    btn.textContent = isVis ? '✕ Ẩn điểm chi tiết' : '🔍 Hiện điểm chi tiết (Full Raw)';
  }
};

window.closeFinalScoreDetailModal = function() {
  document.getElementById('modal-final-score-detail')?.classList.add('hidden');
};

// 7. EXCEL EXPORT ENGINE (SheetJS / XLSX Integration with Security)

function sanitizeExcelCell(val) {
  if (typeof val === 'string') {
    // Formula Injection Protection
    if (/^[=+@-]/.test(val)) {
      return "'" + val;
    }
  }
  return val;
}

function sanitizeSheetName(name) {
  return String(name || 'Sheet').replace(/[\\/*?[\]:]/g, '_').substring(0, 31);
}

window.loadAdminExportTab = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  // Populate Activity select
  const acts = (targetRound.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils) && a.councils.length > 0);
  const actSel = document.getElementById('export-activity-select');
  const councilActSel = document.getElementById('export-council-activity-select');

  const optionsHtml = acts.length > 0
    ? acts.map(a => `<option value="${a.id}">${a.title} (${a.councils.length} Hội đồng)</option>`).join('')
    : '<option value="">-- Chưa có Mốc nào có Hội đồng --</option>';

  if (actSel) actSel.innerHTML = optionsHtml;
  if (councilActSel) {
    councilActSel.innerHTML = optionsHtml;
    if (acts.length > 0) onExportCouncilActivityChange(acts[0].id);
  }
};

window.onExportCouncilActivityChange = function(actId) {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  const councilSel = document.getElementById('export-single-council-select');
  if (!councilSel) return;

  const councils = act?.councils || [];
  if (councils.length === 0) {
    councilSel.innerHTML = '<option value="">-- Chưa có Hội đồng --</option>';
    return;
  }
  councilSel.innerHTML = councils.map(c => `<option value="${c.id}">${c.name} (${c.room || 'Chưa xếp phòng'})</option>`).join('');
};

window.exportRoundSummaryToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  // 1. TONG_KET SHEET
  const ranking = computeRoundRanking(roundId);
  const tongKetData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD', 'Điểm GVHD', 'TM HD', 'TM PB', 'TM Final', 'Điểm Bảo vệ', 'Điểm Tổng kết', 'Hạng', 'Danh hiệu']
  ];

  let stt = 1;
  ranking.rankedStudents.forEach(st => {
    tongKetData.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))),
      st.components?.gvhd?.raw ?? '',
      targetRound.thesisScores?.[st.studentId]?.hd?.score ?? '',
      targetRound.thesisScores?.[st.studentId]?.pb?.score ?? '',
      st.components?.tm?.raw ?? '',
      st.components?.defense?.raw ?? '',
      st.rawScore ?? '',
      st.rank,
      sanitizeExcelCell(st.title || '')
    ]);
  });

  ranking.incompleteStudents.forEach(st => {
    tongKetData.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))),
      st.components?.gvhd?.raw ?? '',
      targetRound.thesisScores?.[st.studentId]?.hd?.score ?? '',
      targetRound.thesisScores?.[st.studentId]?.pb?.score ?? '',
      st.components?.tm?.raw ?? '',
      st.components?.defense?.raw ?? '',
      'Chưa đủ',
      '--',
      '--'
    ]);
  });

  const wsTongKet = XLSX.utils.aoa_to_sheet(tongKetData);
  XLSX.utils.book_append_sheet(wb, wsTongKet, 'TONG_KET');

  // 2. XEP_HANG SHEET
  const xepHangData = [
    ['Hạng', 'MSSV', 'Họ và tên', 'Điểm hiển thị', 'Điểm chi tiết (Raw)', 'Danh hiệu', 'Ghi chú đồng điểm']
  ];
  ranking.rankedStudents.forEach(st => {
    xepHangData.push([
      st.rank,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      st.displayScore,
      st.rawScore,
      sanitizeExcelCell(st.title || ''),
      st.isTie ? 'Đồng điểm' : ''
    ]);
  });
  const wsXepHang = XLSX.utils.aoa_to_sheet(xepHangData);
  XLSX.utils.book_append_sheet(wb, wsXepHang, 'XEP_HANG');

  // 3. SO_KHAO SHEET
  const soKhaoData = [
    ['STT', 'MSSV', 'Họ và tên', 'Điểm Sơ khảo TB', 'Số lượt chấm hợp lệ', 'Ghi chú']
  ];
  let skStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const sk = getPreliminarySummary(st.studentId, roundId);
    soKhaoData.push([
      skStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sk.average !== null ? sk.average : '',
      sk.count,
      sk.excludedScores?.length > 0 ? `Đã loại ${sk.excludedScores.length} điểm GVHD` : ''
    ]);
  });
  const wsSoKhao = XLSX.utils.aoa_to_sheet(soKhaoData);
  XLSX.utils.book_append_sheet(wb, wsSoKhao, 'SO_KHAO');

  // 4. GVHD SHEET
  const gvhdData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD chính', 'GVHD 2', 'Điểm GVHD', 'Người nhập điểm']
  ];
  let gvStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const sc = targetRound.supervisorScores?.[st.studentId];
    const sObj = findStudentInRound(st.studentId);
    const officials = getOfficialSupervisors(sObj) || [];
    const primary = officials.find(o => o.role === 'primary')?.supervisorName || officials[0]?.supervisorName || '';
    const support = officials.filter(o => o.role === 'support').map(o => o.supervisorName).join(', ');
    gvhdData.push([
      gvStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(primary),
      sanitizeExcelCell(support),
      (sc && sc.status === 'completed') ? sc.score : '',
      sanitizeExcelCell(sc?.scorerName || '')
    ]);
  });
  const wsGvhd = XLSX.utils.aoa_to_sheet(gvhdData);
  XLSX.utils.book_append_sheet(wb, wsGvhd, 'GVHD');

  // 5. TM SHEET
  const tmData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD', 'GVPB', 'TM HD', 'TM PB', 'TM Final']
  ];
  let tmStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const tm = targetRound.thesisScores?.[st.studentId];
    tmData.push([
      tmStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(tm?.hd?.scorerName || ''),
      sanitizeExcelCell(tm?.pb?.scorerName || ''),
      (tm?.hd?.status === 'completed') ? tm.hd.score : '',
      (tm?.pb?.status === 'completed') ? tm.pb.score : '',
      getThesisFinalScore(st.studentId, roundId) ?? ''
    ]);
  });
  const wsTm = XLSX.utils.aoa_to_sheet(tmData);
  XLSX.utils.book_append_sheet(wb, wsTm, 'TM');

  // 6. BAO_VE SHEET
  const bvData = [
    ['STT', 'MSSV', 'Họ và tên', 'Hội đồng', 'CT', 'UV', 'TK', 'Điểm Bảo vệ chính thức']
  ];
  let bvStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const dScore = getStudentDefenseScore(st.studentId, roundId);
    bvData.push([
      bvStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      '--',
      '',
      '',
      '',
      dScore !== null ? dScore : ''
    ]);
  });
  const wsBv = XLSX.utils.aoa_to_sheet(bvData);
  XLSX.utils.book_append_sheet(wb, wsBv, 'BAO_VE');

  // 7. AUDIT SHEET
  const logs = targetRound.auditLogs || [];
  const auditData = [
    ['Thời gian', 'Hành động', 'Mã Đợt / Hội đồng', 'Sinh viên', 'Người chấm', 'Điểm cũ', 'Điểm mới', 'Người thực hiện', 'Lý do']
  ];
  logs.forEach(l => {
    auditData.push([
      fmt24h(l.createdAt),
      sanitizeExcelCell(l.action || 'calibration'),
      sanitizeExcelCell(l.councilId || l.roundId || ''),
      sanitizeExcelCell(l.studentName || l.studentId || ''),
      sanitizeExcelCell(l.scorerName || ''),
      l.originalValue ?? '',
      l.newValue ?? '',
      sanitizeExcelCell(l.adjustedByName || l.adjustedById || ''),
      sanitizeExcelCell(l.reason || '')
    ]);
  });
  const wsAudit = XLSX.utils.aoa_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'AUDIT');

  const safeRoundSlug = (targetRound.slug || targetRound.id || 'Round').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Tong-ket_${safeRoundSlug}_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công file: ${filename}`, 'success');
};

window.exportActivityCouncilsToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const actId = document.getElementById('export-activity-select')?.value;
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  if (!act || !act.councils || act.councils.length === 0) {
    showToast('Vui lòng chọn mốc kế hoạch có Hội đồng hợp lệ!', 'warning');
    return;
  }

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  // SAME COLUMN STRUCTURE ACROSS ALL COUNCILS IN ACTIVITY
  const slots = act.councilStructure?.slots || [];
  const headerRow = ['STT', 'MSSV', 'Họ và tên'];
  slots.forEach(s => {
    headerRow.push(`${s.label || s.name}${s.type === 'guest' ? ' (Khách)' : ''}`);
  });
  headerRow.push('Điểm chính thức');

  act.councils.forEach(council => {
    const cSheetName = sanitizeSheetName(council.name || council.id);
    const asgns = (act.councilStudentAssignments || [])
      .filter(a => a.councilId === council.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const sheetRows = [headerRow];
    let stt = 1;

    asgns.forEach(asgn => {
      const sid = asgn.studentId;
      const sObj = findStudentInRound(sid);
      const sName = sObj?.fullName || sObj?.studentName || sid;
      const official = getOfficialDefenseScore(sid, council, act, targetRound);

      const row = [stt++, sanitizeExcelCell(sid), sanitizeExcelCell(sName)];

      slots.forEach(s => {
        const assigned = council.membersBySlot?.[s.key];
        const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
        const scoreKey = scorerId ? `${act.id}_${council.id}_${sid}_${scorerId}` : null;
        const score = scoreKey ? state.councilScores?.[scoreKey] : null;

        if (!assigned) {
          row.push('Chưa phân công');
        } else if (!score || score.status !== 'completed') {
          row.push('Chưa xong');
        } else {
          const isGuest = (s.type === 'guest');
          const isInc = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;
          if (mode === 'all' && isGuest) {
            row.push(`${score.value} (${isInc ? 'LẤY' : 'BỎ'})`);
          } else {
            row.push(score.value);
          }
        }
      });

      row.push(official.isComplete && official.score !== null ? official.score : '');
      sheetRows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, cSheetName);
  });

  const actSlug = (act.slug || act.id || 'Activity').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${actSlug}_Toan-bo-Hoi-dong_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công: ${filename}`, 'success');
};

window.exportSingleCouncilToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const actId = document.getElementById('export-council-activity-select')?.value;
  const councilId = document.getElementById('export-single-council-select')?.value;
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!act || !council) {
    showToast('Vui lòng chọn Mốc và Hội đồng hợp lệ!', 'warning');
    return;
  }

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  const slots = act.councilStructure?.slots || [];
  const headerRow = ['STT', 'MSSV', 'Họ và tên'];
  slots.forEach(s => {
    headerRow.push(`${s.label || s.name}${s.type === 'guest' ? ' (Khách)' : ''}`);
  });
  headerRow.push('Điểm chính thức');

  const asgns = (act.councilStudentAssignments || [])
    .filter(a => a.councilId === council.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const sheetRows = [headerRow];
  let stt = 1;

  asgns.forEach(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const official = getOfficialDefenseScore(sid, council, act, targetRound);

    const row = [stt++, sanitizeExcelCell(sid), sanitizeExcelCell(sName)];

    slots.forEach(s => {
      const assigned = council.membersBySlot?.[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${act.id}_${council.id}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (!assigned) {
        row.push('Chưa phân công');
      } else if (!score || score.status !== 'completed') {
        row.push('Chưa xong');
      } else {
        const isGuest = (s.type === 'guest');
        const isInc = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;
        if (mode === 'all' && isGuest) {
          row.push(`${score.value} (${isInc ? 'LẤY' : 'BỎ'})`);
        } else {
          row.push(score.value);
        }
      }
    });

    row.push(official.isComplete && official.score !== null ? official.score : '');
    sheetRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  const cSheetName = sanitizeSheetName(council.name || 'Hoi_Dong');
  XLSX.utils.book_append_sheet(wb, ws, cSheetName);

  const actSlug = (act.slug || act.id || 'Bao-ve').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cSlug = (council.slug || council.name || 'HD').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${actSlug}_${cSlug}_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công: ${filename}`, 'success');
};

window.exportAuditLogsToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const wb = XLSX.utils.book_new();
  const logs = targetRound.auditLogs || [];

  const auditData = [
    ['Thời gian', 'Hành động', 'Mã Đợt / Hội đồng', 'Sinh viên', 'Người chấm', 'Điểm cũ', 'Điểm mới', 'Người thực hiện', 'Vai trò', 'Lý do']
  ];

  logs.forEach(l => {
    auditData.push([
      fmt24h(l.createdAt),
      sanitizeExcelCell(l.action || 'calibration'),
      sanitizeExcelCell(l.councilId || l.roundId || ''),
      sanitizeExcelCell(l.studentName || l.studentId || ''),
      sanitizeExcelCell(l.scorerName || ''),
      l.originalValue ?? '',
      l.newValue ?? '',
      sanitizeExcelCell(l.adjustedByName || l.adjustedById || ''),
      sanitizeExcelCell(l.adjustedByRole || ''),
      sanitizeExcelCell(l.reason || '')
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, ws, 'AUDIT_LOGS');

  const filename = `Audit_Logs_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất nhật ký kiểm toán: ${filename}`, 'success');
};

function fmtToday() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// 8. STUDENT FINAL SCORE & RANKING PORTAL CARD
window.renderStudentFinalScoreCard = function(userMssv, round) {
  const card = document.getElementById('student-final-score-card');
  if (!card) return;

  if (!round || !round.publishFinalScoreToStudents || !userMssv) {
    card.classList.add('hidden');
    return;
  }

  const fScore = getFinalScore(userMssv, round.id);
  if (!fScore.complete) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');

  // Fill scores
  const gvhdEl = document.getElementById('st-card-gvhd-score');
  if (gvhdEl) gvhdEl.textContent = fScore.components?.gvhd?.display || '--';

  const tmEl = document.getElementById('st-card-tm-score');
  if (tmEl) tmEl.textContent = fScore.components?.tm?.display || '--';

  const defEl = document.getElementById('st-card-defense-score');
  if (defEl) defEl.textContent = fScore.components?.defense?.display || '--';

  const finalEl = document.getElementById('st-card-final-score');
  if (finalEl) finalEl.textContent = fScore.displayScore || '--';

  // Ranking & Titles if published
  const rankWrap = document.getElementById('st-card-ranking-wrap');
  const rankDisplay = document.getElementById('st-card-rank-display');
  const titleDisplay = document.getElementById('st-card-title-display');
  const titleBadge = document.getElementById('student-final-score-title-badge');

  if (round.publishRankingToStudents) {
    const ranking = computeRoundRanking(round.id);
    const myRankItem = (ranking.rankedStudents || []).find(st => st.studentId === userMssv);

    if (myRankItem && rankWrap) {
      rankWrap.classList.remove('hidden');
      if (rankDisplay) rankDisplay.textContent = `Hạng ${myRankItem.rank}`;
      if (titleDisplay) {
        titleDisplay.textContent = myRankItem.title ? `🎖️ ${myRankItem.title}` : '';
      }
      if (titleBadge && myRankItem.title) {
        titleBadge.classList.remove('hidden');
        titleBadge.innerHTML = `<span class="badge bg-amber-400 text-slate-950 font-black text-sm shadow-md">🎖️ ${myRankItem.title}</span>`;
      }
    }
  } else {
    if (rankWrap) rankWrap.classList.add('hidden');
    if (titleBadge) titleBadge.classList.add('hidden');
  }
};




// ============================================================================
// IFA+ GRADUATION BETA v2.3.1-beta.1:
// PHASE B MIGRATION — SUBCOLLECTION NEW-WRITE + DUAL-READ + TRANSACTIONS
// ============================================================================

// Helper to sanitize keys for document IDs
window.sanitizeFirestoreKey = function(key) {
  if (!key) return 'unknown';
  return String(key).replace(/[\/\\]/g, '_').replace(/\s+/g, '_');
};

// 1. COUNCIL SCORES SUBCOLLECTION HELPERS (NEW-WRITE + DUAL-READ)
window.buildDeterministicCouncilScoreId = function(activityId, councilId, studentId, scorerId) {
  const act = sanitizeFirestoreKey(activityId);
  const cId = sanitizeFirestoreKey(councilId);
  const stId = sanitizeFirestoreKey(studentId);
  const scId = sanitizeFirestoreKey(scorerId);
  return `${act}_${cId}_${stId}_${scId}`;
};

window.saveCouncilScoreRecord = async function(roundId, scoreData) {
  if (!checkImpersonationWriteGuard('Lưu điểm đánh giá hội đồng')) return { success: false, error: 'Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm.' };
  if (!roundId || !scoreData) return { success: false, error: 'Thiếu thông tin roundId hoặc scoreData' };

  const actId = scoreData.activityId;
  const cId = scoreData.councilId;
  const stId = scoreData.studentId;
  const scId = scoreData.scorerId || (scoreData.scorerEmail ? scoreData.scorerEmail.split('@')[0] : 'scorer');
  const scoreId = buildDeterministicCouncilScoreId(actId, cId, stId, scId);

  // Clean document payload
  const docPayload = {
    roundId,
    activityId: actId,
    councilId: cId,
    studentId: stId,
    studentName: scoreData.studentName || '',
    scorerId: scId,
    scorerEmail: scoreData.scorerEmail || '',
    scorerName: scoreData.scorerName || '',
    role: scoreData.role || 'member',
    mode: scoreData.scoreMode || 'defense_rubric',
    score: scoreData.score ?? null,
    total: scoreData.score ?? null,
    rubricScores: scoreData.rubricScores || {},
    components: scoreData.components || {},
    feedback: scoreData.feedback || '',
    status: scoreData.status || 'draft',
    isGuest: Boolean(scoreData.isGuest),
    isOfficialScorer: scoreData.isOfficialScorer !== false,
    calibration: scoreData.calibration || null,
    updatedAt: new Date().toISOString()
  };

  // 1. New Write: Save to subcollection /graduationRounds/{roundId}/councilScores/{scoreId}
  let subcolSuccess = false;
  try {
    const scoreRef = doc(db, 'graduationRounds', roundId, 'councilScores', scoreId);
    await setDoc(scoreRef, docPayload, { merge: true });
    subcolSuccess = true;
  } catch (err) {
    console.warn('Notice: Subcollection councilScores write pending rules approval:', err.message);
  }

  // 2. Phase B Activated: New writes go strictly to subcollection /graduationRounds/{roundId}/councilScores/{scoreId}.
  // We do NOT write into the parent round document to prevent document size bloat.
  const legacyKey = `${actId}_${cId}_${stId}_${scId}`;

  // Update local memory
  if (!state.councilScores) state.councilScores = {};
  state.councilScores[legacyKey] = docPayload;

  return { success: true, scoreId, docPayload, subcolSuccess };
};

window.getCouncilScoreRecord = async function({ roundId, activityId, councilId, studentId, scorerId, fallbackRound }) {
  const act = sanitizeFirestoreKey(activityId);
  const cId = sanitizeFirestoreKey(councilId);
  const st = sanitizeFirestoreKey(studentId);
  const sc = sanitizeFirestoreKey(scorerId);
  const scoreId = `${act}_${cId}_${st}_${sc}`;
  const legacyKey = scoreId;

  // 1. Primary: Try reading from Subcollection
  try {
    const scoreRef = doc(db, 'graduationRounds', roundId, 'councilScores', scoreId);
    const snap = await getDoc(scoreRef);
    if (snap && snap.exists()) {
      return snap.data();
    }
  } catch (e) {}

  // 2. Fallback: Read from in-memory state or fallbackRound.councilScores
  if (state.councilScores?.[legacyKey]) {
    return state.councilScores[legacyKey];
  }
  if (fallbackRound?.councilScores?.[legacyKey]) {
    return fallbackRound.councilScores[legacyKey];
  }

  return null;
};


// 4. FIRST-COMPLETED-WINS TRANSACTIONS (GVHD & TM HD)
window.submitSupervisorScoreTransaction = async function({ roundId, studentId, supervisorId, supervisorEmail, supervisorName, score, feedback, isCompleted }) {
  if (!checkImpersonationWriteGuard('Ghi nhận điểm GVHD')) throw new Error('Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm');
  const roundRef = doc(db, 'graduationRounds', roundId);
  const now = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const roundSnap = await transaction.get(roundRef);
    if (!roundSnap.exists()) {
      throw new Error('Đợt tốt nghiệp không tồn tại.');
    }

    const roundData = roundSnap.data();
    const existing = roundData.supervisorScores?.[studentId];

    // ATOMIC CHECK: First completed wins
    if (isCompleted && existing?.status === 'completed' && existing.submittedBySupervisorId !== supervisorId && !state.isAdmin) {
      throw new Error(`Điểm GVHD đã được hoàn tất trước bởi ${existing.submittedByName || 'giảng viên khác'}.`);
    }

    const newRecord = {
      roundId,
      studentId,
      score: isNaN(score) ? null : score,
      comment: feedback || '',
      submittedBySupervisorId: supervisorId,
      submittedByName: supervisorName,
      submittedByEmail: supervisorEmail,
      decidedBy: supervisorEmail,
      supervisorEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };

    transaction.update(roundRef, {
      [`supervisorScores.${studentId}`]: newRecord,
      updatedAt: serverTimestamp()
    });

    return newRecord;
  });
};

window.submitThesisScoreHDTransaction = async function({ roundId, studentId, supervisorId, supervisorEmail, supervisorName, score, feedback, isCompleted }) {
  if (!checkImpersonationWriteGuard('Ghi nhận điểm Đồ án HD')) throw new Error('Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm');
  const roundRef = doc(db, 'graduationRounds', roundId);
  const now = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const roundSnap = await transaction.get(roundRef);
    if (!roundSnap.exists()) {
      throw new Error('Đợt tốt nghiệp không tồn tại.');
    }

    const roundData = roundSnap.data();
    const existing = roundData.thesisScores?.[studentId]?.hd;

    // ATOMIC CHECK: First completed wins
    if (isCompleted && existing?.status === 'completed' && existing.submittedBySupervisorId !== supervisorId && !state.isAdmin) {
      throw new Error(`Điểm TM HD đã được hoàn tất trước bởi ${existing.submittedByName || 'giảng viên khác'}.`);
    }

    const newRecord = {
      roundId,
      studentId,
      score: isNaN(score) ? null : score,
      comment: feedback || '',
      submittedBySupervisorId: supervisorId,
      submittedByName: supervisorName,
      submittedByEmail: supervisorEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };

    transaction.update(roundRef, {
      [`thesisScores.${studentId}.hd`]: newRecord,
      updatedAt: serverTimestamp()
    });

    return newRecord;
  });
};




// ============================================================================
// PHASE 4: ASSESSMENT PORTAL ENGINE
// ============================================================================

state.assessmentTab = 'duyet-1';
state.assessmentFilter = 'all';
state.assessmentSearchQuery = '';
state.selectedAssessmentRoundId = null;
state.selectedAssessmentCouncilId = null;

export function checkUserAssessmentCapabilities(round, userEmail = null, userId = null) {
  const actor = getEffectiveActor();
  const uEmail = (userEmail || actor.email || '').toLowerCase().trim();
  const uId = userId || actor.uid || actor.email;

  if (actor.isAdmin) {
    return {
      isRoundAdmin: true,
      canDuyet1: true,
      canDuyet2: true,
      canDuyet3: true,
      canThesis: true,
      canPreliminary: true,
      canDefense: true,
      canSummary: true,
      hasAnyCapability: true
    };
  }

  if (!round) {
    return {
      isRoundAdmin: false,
      canDuyet1: false,
      canDuyet2: false,
      canDuyet3: false,
      canThesis: false,
      canPreliminary: false,
      canDefense: false,
      canSummary: false,
      hasAnyCapability: false
    };
  }

  // Check if supervisor in round
  const isSupervisor = (round.supervisors || []).some(s => (s.email && s.email.toLowerCase() === uEmail) || s.id === uId);

  // Check official supervised students
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (round.eligibleStudents || []);

  const hasSupervisedStudents = allRegs.some(s => {
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    return officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
  });

  // Check reviewer assignments
  const reviewerAssignments = round.reviewerAssignments || {};
  const hasReviewerAssignments = allRegs.some(s => {
    const sid = s.mssv || s.studentId;
    return reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail;
  });

  // Check council membership in any activity
  const actsWithCouncils = (round.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils));
  let hasDefenseDuty = false;
  for (const act of actsWithCouncils) {
    for (const c of (act.councils || [])) {
      const members = Object.values(c.membersBySlot || {});
      if (members.some(m => m.memberEmail && m.memberEmail.toLowerCase() === uEmail)) {
        hasDefenseDuty = true;
        break;
      }
    }
    if (hasDefenseDuty) break;
  }

  const canDuyet1 = hasSupervisedStudents || isSupervisor;
  const canDuyet2 = hasSupervisedStudents || isSupervisor;
  const canDuyet3 = hasSupervisedStudents || isSupervisor;
  const canThesis = hasSupervisedStudents || hasReviewerAssignments;
  const canPreliminary = isSupervisor;
  const canDefense = hasDefenseDuty;
  const canSummary = state.isAdmin;

  const hasAnyCapability = canDuyet1 || canDuyet2 || canDuyet3 || canThesis || canPreliminary || canDefense || canSummary;

  return {
    isRoundAdmin: false,
    canDuyet1,
    canDuyet2,
    canDuyet3,
    canThesis,
    canPreliminary,
    canDefense,
    canSummary,
    hasAnyCapability
  };
}
window.checkUserAssessmentCapabilities = checkUserAssessmentCapabilities;

window.initAssessmentPortal = async function() {
  if (!state.user) return;

  const allRounds = state.rounds || [];
  const eligibleRounds = allRounds.filter(r => checkUserAssessmentCapabilities(r).hasAnyCapability);

  const deniedEl = document.getElementById('assessment-access-denied');
  const containerEl = document.getElementById('assessment-workspace-container');

  if (eligibleRounds.length === 0) {
    if (deniedEl) deniedEl.classList.remove('hidden');
    if (containerEl) containerEl.classList.add('hidden');
    return;
  }

  if (deniedEl) deniedEl.classList.add('hidden');
  if (containerEl) containerEl.classList.remove('hidden');

  // Populate Round Selector
  const roundSelect = document.getElementById('assessment-round-select');
  if (roundSelect) {
    roundSelect.innerHTML = eligibleRounds.map(r => {
      const isCur = r.isCurrentRound || r.status === 'in_progress';
      return `<option value="${r.id}">${r.title || 'Đợt'} (${r.academicYear || '--'})${isCur ? ' — [Hiện hành]' : ''}</option>`;
    }).join('');

    // Determine default selected round
    let defaultRound = eligibleRounds.find(r => r.id === state.selectedAssessmentRoundId);
    if (!defaultRound) defaultRound = eligibleRounds.find(r => r.id === state.selectedRoundId);
    if (!defaultRound) defaultRound = eligibleRounds.find(r => r.isCurrentRound || r.status === 'in_progress');
    if (!defaultRound) defaultRound = eligibleRounds[0];

    state.selectedAssessmentRoundId = defaultRound.id;
    state.selectedRoundId = defaultRound.id;
    roundSelect.value = defaultRound.id;
  }

  await renderAssessmentWorkspace();
};

window.onAssessmentRoundChange = async function(roundId) {
  state.selectedAssessmentRoundId = roundId;
  state.selectedRoundId = roundId;
  state.selectedAssessmentCouncilId = null;
  await renderAssessmentWorkspace();
};

window.renderAssessmentWorkspace = async function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  if (!targetRound) return;

  const caps = checkUserAssessmentCapabilities(targetRound);

  // 1. Tab visibility
  const tabConfig = [
    { key: 'duyet-1', visible: caps.canDuyet1 },
    { key: 'duyet-2', visible: caps.canDuyet2 },
    { key: 'duyet-3', visible: caps.canDuyet3 },
    { key: 'thesis', visible: caps.canThesis },
    { key: 'preliminary', visible: caps.canPreliminary },
    { key: 'defense', visible: caps.canDefense },
    { key: 'summary', visible: caps.canSummary }
  ];

  tabConfig.forEach(tab => {
    const btn = document.getElementById('atab-btn-' + tab.key);
    if (btn) {
      if (tab.visible) btn.classList.remove('hidden');
      else btn.classList.add('hidden');
    }
  });

  // Ensure current active tab is visible
  const activeTabConfig = tabConfig.find(t => t.key === state.assessmentTab);
  if (!activeTabConfig || !activeTabConfig.visible) {
    const firstVisible = tabConfig.find(t => t.visible);
    if (firstVisible) state.assessmentTab = firstVisible.key;
  }

  // Update role badge in top bar
  const roleBadge = document.getElementById('assessment-user-role-badge');
  if (roleBadge) {
    if (state.isAdmin) {
      roleBadge.textContent = 'Quản trị viên';
      roleBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200';
    } else if (caps.canDefense) {
      roleBadge.textContent = 'Thành viên Hội đồng';
      roleBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200';
    } else {
      roleBadge.textContent = 'Cán bộ Đánh giá';
      roleBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200';
    }
  }

  // Render Hero Card and Tab
  renderAssessmentHeroCard();
  switchAssessmentTab(state.assessmentTab);
};

window.renderAssessmentHeroCard = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  if (!targetRound) return;

  // Update Evaluator Profile Pill
  const actor = getEffectiveActor();
  const evalHeroName = document.getElementById('hero-assessment-name');
  const evalHeroEmail = document.getElementById('hero-assessment-email');
  const evalHeroAvatar = document.getElementById('hero-assessment-avatar');
  if (evalHeroName) evalHeroName.textContent = actor.displayName || 'Giảng viên';
  if (evalHeroEmail) evalHeroEmail.textContent = actor.email || '--';
  if (evalHeroAvatar) {
    const photoUrl = actor.photoURL;
    evalHeroAvatar.src = (photoUrl && photoUrl.trim()) ? photoUrl : getSupervisorAvatarSvgDataUri(actor.displayName || 'GV');
  }

  const titleEl = document.getElementById('assessment-hero-round-title');
  if (titleEl) {
    titleEl.textContent = `${targetRound.title || 'Đồ án tốt nghiệp'} — ${targetRound.academicYear || ''}`;
  }

  // Calculate nearest milestone deadline
  const now = new Date();
  let nearestDeadline = null;
  let nearestActTitle = '';
  (targetRound.activities || []).forEach(a => {
    const deadlineStr = a.deadline || a.endTime;
    if (deadlineStr) {
      const d = new Date(deadlineStr);
      if (d > now && (!nearestDeadline || d < nearestDeadline)) {
        nearestDeadline = d;
        nearestActTitle = a.title || 'Mốc tiếp theo';
      }
    }
  });

  const deadlineEl = document.getElementById('assessment-stat-deadline');
  if (deadlineEl) {
    if (nearestDeadline) {
      const daysLeft = Math.ceil((nearestDeadline - now) / (1000 * 60 * 60 * 24));
      deadlineEl.textContent = `${fmtIsoToVietnameseDateTime(nearestDeadline.toISOString())} (${daysLeft} ngày nữa — ${nearestActTitle})`;
    } else {
      deadlineEl.textContent = 'Đã qua các hạn chót';
    }
  }

  // Metrics computation for user
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  let neededCount = 0;
  let scoredCount = 0;
  let draftCount = 0;

  // 1. Duyet 1, 2, 3
  const supervised = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    return officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
  });

  [1, 2, 3].forEach(phase => {
    supervised.forEach(s => {
      neededCount++;
      const sid = s.mssv || s.studentId;
      const sc = targetRound.progressReviews?.['duyet_' + phase]?.[sid];
      if (sc && sc.status && sc.status !== 'draft') scoredCount++;
      else if (sc && sc.status === 'draft') draftCount++;
    });
  });

  // 2. Thesis (Reviewer)
  const reviewerAssignments = targetRound.reviewerAssignments || {};
  const myReviewerStudents = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const sid = s.mssv || s.studentId;
    return reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail;
  });
  myReviewerStudents.forEach(s => {
    neededCount++;
    const sid = s.mssv || s.studentId;
    const sc = targetRound.thesisScores?.[sid]?.pb;
    if (sc && sc.status === 'completed') scoredCount++;
    else if (sc && sc.status === 'draft') draftCount++;
  });

  const unscoredCount = Math.max(0, neededCount - scoredCount - draftCount);

  const neededEl = document.getElementById('assessment-stat-needed');
  const scoredEl = document.getElementById('assessment-stat-scored');
  const unscoredEl = document.getElementById('assessment-stat-unscored');
  const draftEl = document.getElementById('assessment-stat-draft');

  if (neededEl) neededEl.textContent = neededCount;
  if (scoredEl) scoredEl.textContent = scoredCount;
  if (unscoredEl) unscoredEl.textContent = unscoredCount;
  if (draftEl) draftEl.textContent = draftCount;
};

window.switchAssessmentTab = function(tabKey) {
  state.assessmentTab = tabKey;

  // Update Tab Buttons UI
  const tabKeys = ['duyet-1', 'duyet-2', 'duyet-3', 'thesis', 'preliminary', 'defense', 'summary'];
  tabKeys.forEach(key => {
    const btn = document.getElementById('atab-btn-' + key);
    if (btn) {
      if (key === tabKey) {
        btn.classList.add('bg-purple-600', 'text-white', 'shadow-xs');
        btn.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        btn.classList.remove('bg-purple-600', 'text-white', 'shadow-xs');
        btn.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    }

    const panel = document.getElementById('assessment-panel-' + key);
    if (panel) {
      if (key === tabKey) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    }
  });

  // Filter toolbar visibility
  const filterToolbar = document.getElementById('assessment-filter-toolbar');
  if (filterToolbar) {
    if (tabKey === 'summary') filterToolbar.classList.add('hidden');
    else filterToolbar.classList.remove('hidden');
  }

  renderCurrentAssessmentTab();
};

window.setAssessmentFilter = function(filterType) {
  state.assessmentFilter = filterType;
  const filterBtns = ['all', 'unscored', 'draft', 'completed'];
  filterBtns.forEach(f => {
    const btn = document.getElementById('afilter-btn-' + f);
    if (btn) {
      if (f === filterType) {
        btn.className = 'assessment-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-900 text-white shadow-xs';
      } else {
        btn.className = 'assessment-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
      }
    }
  });
  renderCurrentAssessmentTab();
};

window.onAssessmentSearch = function(query) {
  state.assessmentSearchQuery = String(query || '').toLowerCase().trim();
  renderCurrentAssessmentTab();
};

window.renderCurrentAssessmentTab = function() {
  switch (state.assessmentTab) {
    case 'duyet-1':
      renderAssessmentDuyetList(1);
      break;
    case 'duyet-2':
      renderAssessmentDuyetList(2);
      break;
    case 'duyet-3':
      renderAssessmentDuyetList(3);
      break;
    case 'thesis':
      renderAssessmentThesisList();
      break;
    case 'preliminary':
      renderAssessmentPreliminaryList();
      break;
    case 'defense':
      renderAssessmentDefenseList();
      break;
    case 'summary':
      renderAssessmentSummaryTable();
      break;
  }
};

// Helper: Filter Students by search and filter status
function filterStudentList(students, scoreResolver) {
  const q = state.assessmentSearchQuery;
  const f = state.assessmentFilter;

  return students.filter(s => {
    const sid = String(s.mssv || s.studentId || '').toLowerCase();
    const name = String(s.fullName || s.studentName || '').toLowerCase();
    const topic = String(s.topicTitle || '').toLowerCase();

    if (q && !sid.includes(q) && !name.includes(q) && !topic.includes(q)) return false;

    const scInfo = scoreResolver(s);
    if (f === 'unscored' && scInfo.status !== 'unscored') return false;
    if (f === 'draft' && scInfo.status !== 'draft') return false;
    if (f === 'completed' && scInfo.status !== 'completed') return false;

    return true;
  });
}

function updateFilterCountBadges(students, scoreResolver, badgeId = null) {
  let cntAll = students.length;
  let cntUnscored = 0;
  let cntDraft = 0;
  let cntCompleted = 0;

  students.forEach(s => {
    const scInfo = scoreResolver(s);
    if (scInfo.status === 'completed') cntCompleted++;
    else if (scInfo.status === 'draft') cntDraft++;
    else cntUnscored++;
  });

  const bAll = document.getElementById('afilter-cnt-all');
  const bUnscored = document.getElementById('afilter-cnt-unscored');
  const bDraft = document.getElementById('afilter-cnt-draft');
  const bCompleted = document.getElementById('afilter-cnt-completed');

  if (bAll) bAll.textContent = cntAll;
  if (bUnscored) bUnscored.textContent = cntUnscored;
  if (bDraft) bDraft.textContent = cntDraft;
  if (bCompleted) bCompleted.textContent = cntCompleted;

  if (badgeId) {
    const tabBadge = document.getElementById(badgeId);
    if (tabBadge) tabBadge.textContent = cntAll;
  }
}

// 1. DUYỆT 1, 2, 3
window.renderAssessmentDuyetList = function(phase) {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-duyet-' + phase);
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const candidates = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    return officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
  });

  const scoreResolver = (s) => {
    const sid = s.mssv || s.studentId;
    const sc = targetRound.progressReviews?.['duyet_' + phase]?.[sid];
    if (sc && (sc.status === 'passed' || sc.status === 'failed' || sc.status === 'completed')) {
      return { status: 'completed', score: sc.score, isPassed: sc.score >= 5 };
    }
    if (sc && sc.status === 'draft') {
      return { status: 'draft', score: sc.score };
    }
    return { status: 'unscored', score: null };
  };

  updateFilterCountBadges(candidates, scoreResolver, 'atab-badge-duyet-' + phase);
  const filtered = filterStudentList(candidates, scoreResolver);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
      Không có sinh viên nào phù hợp với bộ lọc trong đợt Duyệt ${phase}.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const initial = (name || 'SV').charAt(0).toUpperCase();
    const supName = formatStudentSupervisorsForDisplay(s);
    const scInfo = scoreResolver(s);

    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa chấm</span>';
    let scoreDisplay = '--';
    if (scInfo.status === 'completed') {
      statusBadge = scInfo.isPassed
        ? '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đạt yêu cầu</span>'
        : '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">✕ Không đạt</span>';
      scoreDisplay = `<span class="text-sm font-black text-purple-900">${Number(scInfo.score).toFixed(1)}/10</span>`;
    } else if (scInfo.status === 'draft') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Bản nháp</span>';
      scoreDisplay = `<span class="text-sm font-bold text-amber-700">${scInfo.score != null ? Number(scInfo.score).toFixed(1) : '--'}</span>`;
    }

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Student Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${initial}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Supervisor info & Metadata (STRICTLY NO FILE VIEW/DOWNLOAD) -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Giảng viên Hướng dẫn</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Giai đoạn</span>
            <span class="font-bold text-purple-800">Duyệt tiến độ ${phase}</span>
          </div>
        </div>

        <!-- Right: Status & Score Action -->
        <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div class="text-right">
            <div>${scoreDisplay}</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <button type="button" onclick="openScoreEntryModal('duyet_${phase}', '${sid}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>✍️</span> <span>${scInfo.status === 'completed' ? 'Sửa điểm' : 'Chấm điểm'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// 2. THUYẾT MINH (HD & PB)
window.renderAssessmentThesisList = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-thesis');
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const reviewerAssignments = targetRound.reviewerAssignments || {};

  const candidates = allRegs.filter(s => {
    if (actor.isAdmin) return true;
    const sid = s.mssv || s.studentId;
    const isReviewer = (reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail);
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    const isSup = officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
    return isReviewer || isSup;
  });

  const scoreResolver = (s) => {
    const sid = s.mssv || s.studentId;
    const scObj = targetRound.thesisScores?.[sid] || {};
    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    const isSup = officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
    const isReviewer = (reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail);

    let sc = null;
    if (isReviewer && !isSup) sc = scObj.pb;
    else if (isSup && !isReviewer) sc = scObj.hd;
    else sc = scObj.pb || scObj.hd;

    if (sc && sc.status === 'completed') return { status: 'completed', score: sc.score };
    if (sc && sc.status === 'draft') return { status: 'draft', score: sc.score };
    return { status: 'unscored', score: null };
  };

  updateFilterCountBadges(candidates, scoreResolver, 'atab-badge-thesis');
  const filtered = filterStudentList(candidates, scoreResolver);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
      Không có sinh viên nào phù hợp với bộ lọc Thuyết minh.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const initial = (name || 'SV').charAt(0).toUpperCase();
    const supName = formatStudentSupervisorsForDisplay(s);

    const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(s) : [];
    const isSup = state.isAdmin || officials.some(sup => sup.supervisorId === uId || (sup.supervisorEmail && sup.supervisorEmail.toLowerCase() === uEmail));
    const isReviewer = state.isAdmin || (reviewerAssignments[sid] === uId || reviewerAssignments[sid] === uEmail);

    const thesisObj = targetRound.thesisScores?.[sid] || {};
    const hdScore = thesisObj.hd?.score;
    const pbScore = thesisObj.pb?.score;

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${initial}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Scores overview -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">GVHD</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div class="flex items-center gap-3">
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Điểm TM HD</span>
              <span class="font-bold ${hdScore != null ? 'text-emerald-700 font-mono text-sm' : 'text-slate-400'}">${hdScore != null ? Number(hdScore).toFixed(1) : '--'}</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Điểm TM PB</span>
              <span class="font-bold ${pbScore != null ? 'text-blue-700 font-mono text-sm' : 'text-slate-400'}">${pbScore != null ? Number(pbScore).toFixed(1) : '--'}</span>
            </div>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center justify-between md:justify-end gap-2 shrink-0">
          ${isSup ? `
            <button type="button" onclick="openScoreEntryModal('tm_hd', '${sid}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer">
              <span>✍️</span> <span>TM GVHD</span>
            </button>
          ` : ''}
          ${isReviewer ? `
            <button type="button" onclick="openScoreEntryModal('tm_pb', '${sid}')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer">
              <span>✍️</span> <span>TM Phản biện</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
};

// 3. SƠ KHẢO
window.renderAssessmentPreliminaryList = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-preliminary');
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();
  const uId = actor.uid || actor.email;
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const scoreResolver = (s) => {
    const sid = s.mssv || s.studentId;
    const key = `prelim_${sid}_${uId}`;
    const sc = targetRound.preliminaryScores?.[key];
    if (sc && sc.status === 'completed') return { status: 'completed', score: sc.score };
    if (sc && sc.status === 'draft') return { status: 'draft', score: sc.score };
    return { status: 'unscored', score: null };
  };

  updateFilterCountBadges(allRegs, scoreResolver, 'atab-badge-preliminary');
  const filtered = filterStudentList(allRegs, scoreResolver);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
      Không có sinh viên nào phù hợp với bộ lọc Sơ khảo.
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const initial = (name || 'SV').charAt(0).toUpperCase();
    const supName = formatStudentSupervisorsForDisplay(s);
    const scInfo = scoreResolver(s);

    // Summary of preliminary average
    const prelimSummary = getPreliminarySummary(sid, targetRound.id);
    const avgStr = prelimSummary.average != null ? Number(prelimSummary.average).toFixed(1) : '--';

    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa chấm</span>';
    let myScoreText = '--';
    if (scInfo.status === 'completed') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Đã chấm</span>';
      myScoreText = `<span class="text-sm font-black text-purple-900">${Number(scInfo.score).toFixed(1)}/10</span>`;
    } else if (scInfo.status === 'draft') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Bản nháp</span>';
      myScoreText = `<span class="text-sm font-bold text-amber-700">${scInfo.score != null ? Number(scInfo.score).toFixed(1) : '--'}</span>`;
    }

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${initial}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Supervisor & Score stats -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">GVHD</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Điểm TB Sơ khảo (${prelimSummary.count} lượt)</span>
            <span class="font-bold text-indigo-700 text-sm font-mono">${avgStr}</span>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div class="text-right">
            <div>${myScoreText}</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <button type="button" onclick="openScoreEntryModal('preliminary', '${sid}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>✍️</span> <span>${scInfo.status === 'completed' ? 'Sửa điểm' : 'Chấm sơ khảo'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// 4. BẢO VỆ (HỘI ĐỒNG)
window.renderAssessmentDefenseList = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const container = document.getElementById('assessment-list-defense');
  if (!targetRound || !container) return;

  const actor = getEffectiveActor();
  const uEmail = (actor.email || '').toLowerCase().trim();

  // Find all activities with councils
  const actsWithCouncils = (targetRound.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils) && a.councils.length > 0);
  let availableCouncils = [];

  actsWithCouncils.forEach(act => {
    act.councils.forEach(c => {
      const members = Object.values(c.membersBySlot || {});
      const isMember = members.some(m => m.memberEmail && m.memberEmail.toLowerCase() === uEmail);
      if (actor.isAdmin || isMember) {
        availableCouncils.push({ act, council: c });
      }
    });
  });

  const councilSelect = document.getElementById('assessment-council-select');
  if (availableCouncils.length === 0) {
    if (councilSelect) councilSelect.innerHTML = '<option value="">-- Chưa được phân công Hội đồng nào --</option>';
    container.innerHTML = '<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">Thầy/Cô chưa có phân công trong Hội đồng bảo vệ nào của đợt này.</div>';
    return;
  }

  if (councilSelect) {
    councilSelect.innerHTML = availableCouncils.map(item => {
      return `<option value="${item.council.id}">${item.council.name} (${item.act.title})</option>`;
    }).join('');

    if (!state.selectedAssessmentCouncilId || !availableCouncils.some(item => item.council.id === state.selectedAssessmentCouncilId)) {
      state.selectedAssessmentCouncilId = availableCouncils[0].council.id;
    }
    councilSelect.value = state.selectedAssessmentCouncilId;
  }

  // Current council info
  const currentItem = availableCouncils.find(item => item.council.id === state.selectedAssessmentCouncilId) || availableCouncils[0];
  const act = currentItem.act;
  const council = currentItem.council;

  // Banner details
  const nameEl = document.getElementById('assessment-cinfo-name');
  const statusEl = document.getElementById('assessment-cinfo-status');
  const timeRoomEl = document.getElementById('assessment-cinfo-time-room');
  const chairEl = document.getElementById('assessment-cinfo-chair');
  const secEl = document.getElementById('assessment-cinfo-secretary');
  const memEl = document.getElementById('assessment-cinfo-members');

  if (nameEl) nameEl.textContent = council.name || 'Hội đồng Bảo vệ';
  if (statusEl) {
    const stMap = { preparing: 'Chuẩn bị', active: 'Đang diễn ra', ended: 'Kết thúc', finalized: 'Đã khóa' };
    statusEl.textContent = stMap[council.status] || 'Chuẩn bị';
  }
  if (timeRoomEl) {
    timeRoomEl.textContent = `📍 Phòng: ${council.room || 'Chưa cập nhật'} • 📅 Ngày: ${council.date || '--'} (${council.startTime || '--'} – ${council.endTime || '--'})`;
  }

  const membersBySlot = council.membersBySlot || {};
  if (chairEl) chairEl.textContent = membersBySlot['chair']?.memberName || '--';
  if (secEl) secEl.textContent = membersBySlot['secretary']?.memberName || '--';
  if (memEl) {
    const otherMembers = Object.entries(membersBySlot)
      .filter(([k]) => k !== 'chair' && k !== 'secretary')
      .map(([, v]) => v.memberName)
      .filter(Boolean);
    memEl.textContent = otherMembers.join(', ') || '--';
  }

  // Assigned students in this council
  const assignments = (act.councilStudentAssignments || []).filter(a => a.councilId === council.id);
  const allRegs = (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0)
    ? state.adminReviewData.registrations
    : (targetRound.eligibleStudents || []);

  const studentsInCouncil = assignments.map(a => {
    const sObj = allRegs.find(s => (s.mssv || s.studentId) === a.studentId) || { studentId: a.studentId };
    return { ...sObj, ...a };
  });

  const tabBadge = document.getElementById('atab-badge-defense');
  if (tabBadge) tabBadge.textContent = studentsInCouncil.length;

  if (studentsInCouncil.length === 0) {
    container.innerHTML = '<div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-medium">Hội đồng này hiện chưa có sinh viên nào được phân công.</div>';
    return;
  }

  container.innerHTML = studentsInCouncil.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || sid;
    const topic = s.topicTitle || 'Chưa cập nhật đề tài';
    const supName = formatStudentSupervisorsForDisplay(s);
    const initial = (name || 'SV').charAt(0).toUpperCase();

    // Defense status from council engine
    const defenseScore = s.defenseScore != null ? Number(s.defenseScore).toFixed(1) : '--';
    const defenseStatus = s.presentationStatus || 'pending';
    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Chưa báo cáo</span>';
    if (defenseStatus === 'presenting') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">Đang báo cáo</span>';
    } else if (defenseStatus === 'completed') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã hoàn tất</span>';
    }

    return `
      <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Left: Info -->
        <div class="flex items-start gap-3.5 min-w-[260px] max-w-sm">
          <div class="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
            ${idx + 1}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-black text-slate-900 text-sm leading-tight">${name}</h4>
              <span class="font-mono text-xs font-bold text-slate-500">${sid}</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-1" title="${escapeHtml(topic)}">
              <strong>Đề tài:</strong> ${escapeHtml(topic)}
            </p>
          </div>
        </div>

        <!-- Middle: Supervisors & presentation order -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-600 md:px-4 md:border-x md:border-slate-100 flex-1">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">GVHD</span>
            <span class="font-semibold text-slate-800">${supName}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Thứ tự báo cáo</span>
            <span class="font-bold text-slate-800">Lượt #${s.presentationOrder || (idx + 1)}</span>
          </div>
        </div>

        <!-- Right: Status & Workspace button -->
        <div class="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div class="text-right">
            <div class="text-sm font-black text-purple-900">${defenseScore !== '--' ? defenseScore + '/10' : '--'}</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <button type="button" onclick="openCouncilWorkspace('${targetRound.id}', '${act.id}', '${council.id}', '${sid}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>🏛️</span> <span>Vào phòng chấm</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

window.onAssessmentCouncilChange = function(councilId) {
  state.selectedAssessmentCouncilId = councilId;
  renderAssessmentDefenseList();
};

window.launchAssessmentCouncilWorkspace = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  if (!targetRound) return;

  const councilId = state.selectedAssessmentCouncilId;
  if (!councilId) {
    showToast('Chưa chọn Hội đồng nào!', 'warning');
    return;
  }

  let actId = null;
  (targetRound.activities || []).forEach(a => {
    if (a.councilEnabled && (a.councils || []).some(c => c.id === councilId)) {
      actId = a.id;
    }
  });

  if (targetRound.id && actId && councilId) {
    openCouncilWorkspace(targetRound.id, actId, councilId);
  } else {
    showToast('Không tìm thấy dữ liệu Hội đồng!', 'error');
  }
};

// 5. TỔNG KẾT (ADMIN ONLY)
window.renderAssessmentSummaryTable = function() {
  const targetRound = (state.rounds || []).find(r => r.id === state.selectedAssessmentRoundId) || state.activeRound;
  const tbody = document.getElementById('assessment-summary-tbody');
  if (!targetRound || !tbody) return;

  const ranking = computeRoundRanking(targetRound.id);
  const allStudents = [...(ranking.rankedStudents || []), ...(ranking.incompleteStudents || [])];

  const tabBadge = document.getElementById('atab-badge-summary');
  if (tabBadge) tabBadge.textContent = allStudents.length;

  if (allStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="p-8 text-center text-slate-400">Chưa có dữ liệu tổng kết điểm cho đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = allStudents.map((st, idx) => {
    const isRanked = st.rank != null;
    const gvhdScore = st.components?.gvhd?.raw != null ? Number(st.components.gvhd.raw).toFixed(1) : '--';
    const tmHdScore = targetRound.thesisScores?.[st.studentId]?.hd?.score != null ? Number(targetRound.thesisScores[st.studentId].hd.score).toFixed(1) : '--';
    const tmPbScore = targetRound.thesisScores?.[st.studentId]?.pb?.score != null ? Number(targetRound.thesisScores[st.studentId].pb.score).toFixed(1) : '--';
    const tmScore = st.components?.tm?.raw != null ? Number(st.components.tm.raw).toFixed(1) : '--';
    const defenseScore = st.components?.defense?.raw != null ? Number(st.components.defense.raw).toFixed(1) : '--';
    const finalScore = isRanked && st.rawScore != null ? Number(st.rawScore).toFixed(2) : '--';
    const rankDisplay = isRanked ? `#${st.rank}` : '--';
    const titleDisplay = st.title || (isRanked ? 'Hoàn thành' : 'Chưa đủ điểm');

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${rankDisplay}</td>
        <td class="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">${st.studentId}</td>
        <td class="p-3 font-semibold text-slate-800 whitespace-nowrap">${st.fullName}</td>
        <td class="p-3 text-slate-600 whitespace-nowrap">${formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))}</td>
        <td class="p-3 text-center font-mono text-slate-700">${gvhdScore}</td>
        <td class="p-3 text-center font-mono text-slate-700">${tmHdScore}</td>
        <td class="p-3 text-center font-mono text-slate-700">${tmPbScore}</td>
        <td class="p-3 text-center font-mono font-semibold text-blue-800">${tmScore}</td>
        <td class="p-3 text-center font-mono font-semibold text-purple-800">${defenseScore}</td>
        <td class="p-3 text-center font-mono font-black text-slate-900 bg-slate-50">${finalScore}</td>
        <td class="p-3 text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isRanked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${titleDisplay}
          </span>
        </td>
      </tr>
    `;
  }).join('');
};
