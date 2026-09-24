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

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof renderCouncilCards !== 'undefined') window.renderCouncilCards = renderCouncilCards;
  if (typeof renderCouncilSlotsTable !== 'undefined') window.renderCouncilSlotsTable = renderCouncilSlotsTable;
  if (typeof renderCouncilStudentsTab !== 'undefined') window.renderCouncilStudentsTab = renderCouncilStudentsTab;
  if (typeof getRoundAllStudents !== 'undefined') window.getRoundAllStudents = getRoundAllStudents;
  if (typeof findStudentInRound !== 'undefined') window.findStudentInRound = findStudentInRound;
  if (typeof renderCouncilMembersFormSlots !== 'undefined') window.renderCouncilMembersFormSlots = renderCouncilMembersFormSlots;
  if (typeof persistActivityCouncilChanges !== 'undefined') window.persistActivityCouncilChanges = persistActivityCouncilChanges;
  if (typeof renderEffectiveCouncilMembershipNotice !== 'undefined') window.renderEffectiveCouncilMembershipNotice = renderEffectiveCouncilMembershipNotice;
  if (typeof renderStudentCouncilTimelineInfo !== 'undefined') window.renderStudentCouncilTimelineInfo = renderStudentCouncilTimelineInfo;
}
