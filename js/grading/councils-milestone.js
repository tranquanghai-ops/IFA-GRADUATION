/**
 * IFA+ Graduation — Milestone Quick Council Management
 */
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
