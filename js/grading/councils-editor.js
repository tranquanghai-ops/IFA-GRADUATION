/**
 * IFA+ Graduation — Council CRUD, Slots & Guest Member Configuration
 */
let councilFormSlots = [];
function setCouncilFormSlots(council, act) {
  const existingSlots = Array.isArray(council?.memberSlots) ? council.memberSlots : (act.councilStructure?.slots || []);
  councilFormSlots = existingSlots.map(slot => {
    const mem = council?.membersBySlot?.[slot.key];
    const isChair = slot.key === 'chair' || slot.key.startsWith('chair');
    const isSec = slot.key === 'secretary' || slot.key.startsWith('secretary');
    const canScore = (mem?.canScore !== undefined)
      ? Boolean(mem.canScore)
      : (slot.canScore !== undefined ? Boolean(slot.canScore) : true);
    const canOperate = (mem?.canOperate !== undefined)
      ? Boolean(mem.canOperate)
      : (slot.canOperate !== undefined ? Boolean(slot.canOperate) : (isChair || isSec));
    const roleName = mem?.role || slot.name || slot.label || (isChair ? 'Chủ tịch Hội đồng' : (isSec ? 'Thư ký Hội đồng' : 'Ủy viên'));
    return {
      ...slot,
      name: roleName,
      label: roleName,
      canScore,
      canOperate
    };
  });

  Object.entries(council?.membersBySlot || {}).forEach(([key, member]) => {
    if (!councilFormSlots.some(slot => slot.key === key)) {
      const isChair = key === 'chair' || key.startsWith('chair');
      const isSec = key === 'secretary' || key.startsWith('secretary');
      councilFormSlots.push({
        key,
        label: member.role || 'Thành viên',
        name: member.role || 'Thành viên Hội đồng',
        type: member.type === 'guest' ? 'guest' : 'mandatory',
        removable: true,
        canScore: member.canScore !== undefined ? Boolean(member.canScore) : true,
        canOperate: member.canOperate !== undefined ? Boolean(member.canOperate) : (isChair || isSec)
      });
    }
  });
}
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

  const hideSupCheckbox = document.getElementById('council-form-hide-supervisor');
  if (hideSupCheckbox) {
    hideSupCheckbox.checked = Boolean(act.hideSupervisorInCouncil);
  }

  await ensureSupervisorsMasterLoaded().catch(error => console.warn('[Council] Lecturer directory load notice:', error));
  setCouncilFormSlots(null, act);
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

  const hideSupCheckbox = document.getElementById('council-form-hide-supervisor');
  if (hideSupCheckbox) {
    hideSupCheckbox.checked = Boolean(council.hideSupervisorInCouncil !== undefined ? council.hideSupervisorInCouncil : act.hideSupervisorInCouncil);
  }

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
  setCouncilFormSlots(council, act);
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
  setCouncilFormSlots(council, act);
  renderCouncilMembersFormSlots(act, council.membersBySlot || {});

  document.getElementById('modal-edit-council')?.classList.remove('hidden');
  showToast('Đã sao chép cấu hình Hội đồng. Vui lòng kiểm tra và lưu lại.', 'info');
};

window.closeEditCouncilModal = function() {
  document.getElementById('modal-edit-council')?.classList.add('hidden');
  const roundId = state.activeCouncilManagement?.roundId || state.selectedRoundId;
  if (roundId) {
    if (typeof window.filterAdminRoundCouncils === 'function') {
      window.filterAdminRoundCouncils(roundId);
    }
    if (typeof window.refreshCouncilModalViews === 'function') {
      window.refreshCouncilModalViews();
    }
  }
};

export function isCouncilTimeOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return true;
  const toMinutes = (t) => {
    const parts = String(t).split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };
  const sA = toMinutes(startA);
  const eA = toMinutes(endA);
  const sB = toMinutes(startB);
  const eB = toMinutes(endB);
  return Math.max(sA, sB) < Math.min(eA, eB);
}

export function getConflictingCouncilMembersForSlot(act, editingCouncilId, targetDate, targetStartTime, targetEndTime) {
  const busyMembers = new Map(); // key (supId or email) -> { councilName, date, time }
  if (!act || !Array.isArray(act.councils)) return busyMembers;

  const curDate = (targetDate || '').trim();
  const curStart = (targetStartTime || '').trim();
  const curEnd = (targetEndTime || '').trim();

  act.councils.forEach(otherC => {
    if (otherC.id && editingCouncilId && otherC.id === editingCouncilId) return;

    const otherDate = (otherC.date || '').trim();
    // If both have explicit dates and they do not match, no schedule overlap
    if (curDate && otherDate && curDate !== otherDate) return;

    const otherStart = (otherC.startTime || '').trim();
    const otherEnd = (otherC.endTime || '').trim();

    const overlap = isCouncilTimeOverlap(curStart, curEnd, otherStart, otherEnd);
    if (!overlap) return;

    // Council overlaps schedule! Mark all its members as busy
    const membersBySlot = otherC.membersBySlot || {};
    Object.values(membersBySlot).forEach(m => {
      if (!m) return;
      const memId = String(m.memberId || m.id || '').trim();
      const memEmail = String(m.memberEmail || m.email || '').toLowerCase().trim();
      const info = {
        councilName: otherC.name || 'HĐ khác',
        date: otherDate || curDate || '--',
        time: `${otherStart || '--'} - ${otherEnd || '--'}`
      };
      if (memId) busyMembers.set(memId, info);
      if (memEmail) busyMembers.set(memEmail, info);
    });
  });

  return busyMembers;
}

export function generateCouncilShortCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
window.generateCouncilShortCode = generateCouncilShortCode;

function getCurrentCouncilFormMembers(act) {
  const slots = councilFormSlots;
  const currentMembers = {};
  slots.forEach(s => {
    const isGuest = document.getElementById(`chk-guest-${s.key}`)?.checked === true;
    const canScore = document.getElementById(`chk-score-${s.key}`)
      ? document.getElementById(`chk-score-${s.key}`).checked
      : (s.canScore !== false);
    const canOperate = document.getElementById(`chk-operate-${s.key}`)
      ? document.getElementById(`chk-operate-${s.key}`).checked
      : Boolean(s.canOperate);
    const customRoleName = document.getElementById(`slot-role-name-${s.key}`)?.value?.trim()
      || s.name
      || s.label
      || (s.key === 'chair' ? 'Chủ tịch' : (s.key === 'secretary' ? 'Thư ký' : 'Ủy viên'));

    s.name = customRoleName;
    s.label = customRoleName;
    s.canScore = canScore;
    s.canOperate = canOperate;

    if (isGuest) {
      currentMembers[s.key] = {
        type: 'guest',
        isExternalGuest: true,
        memberName: document.getElementById(`slot-guest-name-${s.key}`)?.value?.trim() || '',
        memberEmail: document.getElementById(`slot-guest-email-${s.key}`)?.value?.trim().toLowerCase() || '',
        organization: document.getElementById(`slot-guest-org-${s.key}`)?.value?.trim() || '',
        role: customRoleName,
        slotKey: s.key,
        canScore,
        canOperate
      };
    } else {
      const supId = document.getElementById(`slot-sup-${s.key}`)?.value || '';
      currentMembers[s.key] = {
        type: 'internal',
        isExternalGuest: false,
        memberId: supId,
        role: customRoleName,
        slotKey: s.key,
        canScore,
        canOperate
      };
    }
  });
  return currentMembers;
}
window.getCurrentCouncilFormMembers = getCurrentCouncilFormMembers;

window.quickAddCouncilMemberSlot = function(kind = 'internal') {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const currentMembers = getCurrentCouncilFormMembers(act);

  const memberSlots = councilFormSlots.filter(s => s.key.startsWith('member') || (s.label && s.label.includes('Ủy viên')));
  const nextNumber = memberSlots.length + 1;
  const newKey = `member_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;
  const defaultTitle = kind === 'guest' ? `Khách mời (${nextNumber})` : `Ủy viên Hội đồng (${nextNumber})`;

  councilFormSlots.push({
    key: newKey,
    label: defaultTitle,
    name: defaultTitle,
    type: kind === 'guest' ? 'guest' : 'mandatory',
    removable: true,
    canScore: true,
    canOperate: false
  });

  renderCouncilMembersFormSlots(act, currentMembers);
  showToast(`Đã thêm vị trí ${kind === 'guest' ? 'khách mời' : 'thành viên'}. Bạn có thể chỉnh sửa vai trò và quyền hạn tương ứng.`, 'success');

  const container = document.getElementById('council-members-form-container');
  if (container) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
      const roleInput = document.getElementById(`slot-role-name-${newKey}`);
      if (roleInput) roleInput.focus();
    }, 60);
  }
};

window.quickRemoveCouncilMemberSlot = function(slotKey) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const currentMembers = getCurrentCouncilFormMembers(act);
  delete currentMembers[slotKey];

  councilFormSlots = councilFormSlots.filter(s => s.key !== slotKey);
  renderCouncilMembersFormSlots(act, currentMembers);
  showToast('Đã xóa vị trí thành viên.', 'info');
};

function renderCouncilMembersFormSlots(act, membersBySlot = {}) {
  const container = document.getElementById('council-members-form-container');
  if (!container) return;

  const editingCouncilId = document.getElementById('council-form-id')?.value?.trim();
  const councilDate = document.getElementById('council-form-date')?.value?.trim() || '';
  const councilStartTime = document.getElementById('council-form-start-time')?.value?.trim() || '';
  const councilEndTime = document.getElementById('council-form-end-time')?.value?.trim() || '';

  const busyMembers = getConflictingCouncilMembersForSlot(act, editingCouncilId, councilDate, councilStartTime, councilEndTime);
  const conflictWarning = document.getElementById('council-conflict-warning');
  if (conflictWarning) {
    if (busyMembers.size > 0) {
      conflictWarning.textContent = `⚠️ Đã ẩn ${busyMembers.size} GV bận ở HĐ khác cùng giờ`;
      conflictWarning.classList.remove('hidden');
    } else {
      conflictWarning.classList.add('hidden');
    }
  }

  const slots = councilFormSlots;
  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  container.innerHTML = slots.map(s => {
    const assigned = membersBySlot[s.key] || {};
    const memberId = assigned.memberId || '';
    const memberName = assigned.memberName || '';
    const isGuest = (assigned.type === 'guest') || (!assigned.type && s.type === 'guest');
    const isRemovable = Boolean(s.removable || s.type === 'optional' || s.type === 'guest' || s.key.startsWith('member_'));

    const isChair = s.key === 'chair' || s.key.startsWith('chair');
    const isSec = s.key === 'secretary' || s.key.startsWith('secretary');

    const canScore = (assigned.canScore !== undefined)
      ? Boolean(assigned.canScore)
      : (s.canScore !== undefined ? Boolean(s.canScore) : true);

    const canOperate = (assigned.canOperate !== undefined)
      ? Boolean(assigned.canOperate)
      : (s.canOperate !== undefined ? Boolean(s.canOperate) : (isChair || isSec));

    const roleTitle = assigned.role || s.name || s.label || (isChair ? 'Chủ tịch Hội đồng' : (isSec ? 'Thư ký Hội đồng' : 'Ủy viên'));

    // Filter supervisors who are not busy in overlapping councils (or already assigned in this specific slot)
    const availableSupervisors = supervisors.filter(sup => {
      if (memberId && sup.id === memberId) return true;
      const isBusy = busyMembers.has(sup.id) || (sup.email && busyMembers.has(sup.email.toLowerCase().trim()));
      return !isBusy;
    });

    return `
      <div class="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs" id="slot-container-${s.key}">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <span class="text-sm shrink-0">👤</span>
            <input type="text" id="slot-role-name-${s.key}" value="${escapeHtml(roleTitle)}"
              placeholder="Tên vai trò..."
              title="Nhấp để sửa tên vai trò (VD: Thư ký biên bản, SV hỗ trợ bấm máy, Người phản biện...)"
              class="font-bold text-slate-800 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2 py-1 w-full max-w-[220px] sm:max-w-[240px] focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all">
            <span class="text-[10px] text-slate-400 font-mono shrink-0">(${s.key})</span>
          </div>

          <div class="flex items-center gap-2 flex-wrap text-[11px]">
            <!-- Checkbox Chấm điểm -->
            <label class="flex items-center gap-1 cursor-pointer font-medium select-none text-slate-700 hover:text-indigo-700 transition-colors" title="Cho phép thành viên này chấm điểm đánh giá sinh viên">
              <input type="checkbox" id="chk-score-${s.key}" ${canScore ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5">
              <span class="text-[11px] ${canScore ? 'font-bold text-indigo-900' : 'text-slate-500'}">Chấm điểm</span>
            </label>

            <!-- Checkbox Bấm giờ / Bắt đầu -->
            <label class="flex items-center gap-1 cursor-pointer font-medium select-none text-slate-700 hover:text-emerald-700 transition-colors" title="Cho phép bấm giờ, bắt đầu lượt, chuyển sinh viên trình bày">
              <input type="checkbox" id="chk-operate-${s.key}" ${canOperate ? 'checked' : ''} class="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5">
              <span class="text-[11px] ${canOperate ? 'font-bold text-emerald-900' : 'text-slate-500'}">Bấm giờ & Bắt đầu</span>
            </label>

            <!-- Checkbox Khách mời -->
            <label class="flex items-center gap-1 text-slate-500 cursor-pointer select-none text-[11px]" title="Chuyển sang hình thức khách mời ngoài">
              <input type="checkbox" id="chk-guest-${s.key}" ${isGuest ? 'checked' : ''} onchange="toggleSlotGuestInput('${s.key}', this.checked)" class="rounded text-tdtu-blue w-3.5 h-3.5">
              <span>Khách ngoài</span>
            </label>

            ${isRemovable ? `
              <button type="button" onclick="quickRemoveCouncilMemberSlot('${s.key}')" class="text-rose-500 hover:text-rose-700 active:scale-95 font-bold text-xs p-1 rounded-md hover:bg-rose-50 transition-all cursor-pointer" title="Xóa vị trí này">✕</button>
            ` : ''}
          </div>
        </div>

        <!-- Supervisor dropdown -->
        <div id="slot-sup-wrap-${s.key}" class="${isGuest ? 'hidden' : ''}">
          <input type="search" oninput="filterCouncilSlotMembers('${s.key}', this.value)" placeholder="Tìm theo tên, email, đơn vị..." class="w-full p-2 mb-1.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <select id="slot-sup-${s.key}" class="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white">
            <option value="">-- Chưa phân công --</option>
            ${availableSupervisors.map(sup => `
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

window.onCouncilDateTimeInputsChange = function() {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const currentMembers = getCurrentCouncilFormMembers(act);
  renderCouncilMembersFormSlots(act, currentMembers);
};

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
  onCouncilDateTimeInputsChange();
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

  // Check schedule conflicts with other councils
  const busyMembers = getConflictingCouncilMembersForSlot(act, id, date, startTime, endTime);

  // Extract membersBySlot with strict email validation & duplicate checking
  const slots = councilFormSlots;
  const membersBySlot = {};
  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  const seenEmails = new Set();
  let emailError = null;

  slots.forEach(s => {
    if (emailError) return;
    const isGuest = document.getElementById(`chk-guest-${s.key}`)?.checked === true;
    const canScore = document.getElementById(`chk-score-${s.key}`)
      ? document.getElementById(`chk-score-${s.key}`).checked
      : (s.canScore !== false);
    const canOperate = document.getElementById(`chk-operate-${s.key}`)
      ? document.getElementById(`chk-operate-${s.key}`).checked
      : Boolean(s.canOperate);
    const roleTitle = document.getElementById(`slot-role-name-${s.key}`)?.value?.trim()
      || s.name
      || s.label
      || (s.key === 'chair' ? 'Chủ tịch' : (s.key === 'secretary' ? 'Thư ký' : 'Ủy viên'));

    s.name = roleTitle;
    s.label = roleTitle;
    s.canScore = canScore;
    s.canOperate = canOperate;

    if (isGuest) {
      const gName = document.getElementById(`slot-guest-name-${s.key}`)?.value?.trim();
      const gEmail = document.getElementById(`slot-guest-email-${s.key}`)?.value?.trim().toLowerCase();
      const gOrg = document.getElementById(`slot-guest-org-${s.key}`)?.value?.trim();
      if (gName || gEmail) {
        if (!gName) {
          emailError = `Vui lòng nhập họ và tên khách mời cho vị trí "${roleTitle}"`;
          return;
        }
        if (!gEmail) {
          emailError = `Email là bắt buộc đối với khách mời "${gName}" (${roleTitle})`;
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
        if (busyMembers.has(gEmail)) {
          const conflict = busyMembers.get(gEmail);
          emailError = `Khách mời "${gName}" (${gEmail}) đã trùng lịch với "${conflict.councilName}" (${conflict.date} ${conflict.time})!`;
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
          role: roleTitle,
          slotKey: s.key,
          canScore,
          canOperate
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
          if (busyMembers.has(supId) || busyMembers.has(sEmail)) {
            const conflict = busyMembers.get(supId) || busyMembers.get(sEmail);
            emailError = `Giảng viên "${supObj?.name}" đã trùng lịch với "${conflict.councilName}" (${conflict.date} ${conflict.time})!`;
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
          role: roleTitle,
          slotKey: s.key,
          canScore,
          canOperate
        };
      }
    }
  });

  if (emailError) {
    showToast(emailError, 'warning');
    return;
  }

  const existingCouncil = (act.councils || []).find(c => c.id === id);
  const slug = id ? (existingCouncil?.slug || slugify(name)) : ('c-' + slugify(name) + '-' + Date.now().toString(36).substr(-4));
  const councilId = id || ('council_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
  const shortCode = existingCouncil?.shortCode || existingCouncil?.code || generateCouncilShortCode();

  const driveFolderId = document.getElementById('council-form-drive-folder-id')?.value?.trim() || null;
  const driveFolderName = document.getElementById('council-form-drive-folder-name')?.value?.trim() || name;
  const driveFolderUrl = document.getElementById('council-form-drive-folder-url')?.value?.trim() || (driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : null);

  const hideSupervisorInCouncil = document.getElementById('council-form-hide-supervisor')?.checked === true;

  const councilData = {
    id: councilId,
    shortCode,
    slug,
    name,
    room,
    status,
    date,
    startTime,
    endTime,
    note,
    hideSupervisorInCouncil,
    driveFolderId,
    driveFolderName,
    driveFolderUrl,
    membersBySlot,
    memberSlots: slots.map(slot => ({ ...slot })),
    updatedAt: new Date().toISOString()
  };

  act.councils = act.councils || [];
  const existingIdx = act.councils.findIndex(c => c.id === councilId);
  if (existingIdx >= 0) {
    act.councils[existingIdx] = { ...act.councils[existingIdx], ...councilData };
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
    type: 'guest',
    removable: true
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
window.copyCouncilLink = async function(activitySlug, councilSlug, councilId = null) {
  let targetCouncil = null;
  let targetRound = null;
  let targetAct = null;

  // Search across loaded rounds
  for (const r of (state.rounds || [])) {
    if (r.deleted) continue;
    for (const a of (r.activities || [])) {
      const c = (a.councils || []).find(x => 
        (councilId && x.id === councilId) ||
        (councilSlug && (x.slug === councilSlug || x.id === councilSlug || x.shortCode === councilSlug)) ||
        (activitySlug && (a.slug === activitySlug || a.id === activitySlug) && (x.slug === councilSlug || x.id === councilSlug))
      );
      if (c) {
        targetCouncil = c;
        targetRound = r;
        targetAct = a;
        break;
      }
    }
    if (targetCouncil) break;
  }

  if (!targetCouncil) {
    const { roundId, activityId } = state.activeCouncilManagement || {};
    targetRound = (state.rounds || []).find(r => r.id === roundId);
    targetAct = (targetRound?.activities || []).find(a => a.id === activityId || a.slug === activitySlug);
    targetCouncil = (targetAct?.councils || []).find(c => c.slug === councilSlug || c.id === councilSlug || (councilId && c.id === councilId));
  }

  if (targetCouncil && !targetCouncil.shortCode) {
    targetCouncil.shortCode = generateCouncilShortCode();
    if (targetRound) {
      persistActivityCouncilChanges(targetRound).catch(() => {});
    }
  }

  const hdCode = targetCouncil?.shortCode || targetCouncil?.code || councilSlug;
  const link = `${window.location.origin}/?hd=${encodeURIComponent(hdCode)}`;

  await copyLinkWithFallback(link, `link Hội đồng (${targetCouncil?.name || 'HĐ'})`);
};

// --- PERSISTENCE HELPER ---
async function persistActivityCouncilChanges(targetRound) {
  if (!targetRound) return;
  const roundId = targetRound.id;
  try {
    const roundRef = doc(db, 'graduationRounds', roundId);
    const payload = {
      activities: targetRound.activities,
      updatedAt: serverTimestamp()
    };
    if (targetRound.progressReviews) {
      payload.progressReviews = targetRound.progressReviews;
    }
    await updateDoc(roundRef, payload);
    // Keep authorization indexes aligned with every council/member/student edit.
    // The live presentation rules consult these small documents, not the large
    // round document. Removed members must be revoked, not merely omitted.
    const activityId = state.activeCouncilManagement?.activityId;
    const activity = (targetRound.activities || []).find(item => item.id === activityId);
    if (activity) {
      const expectedMembers = new Map();
      for (const council of (activity.councils || [])) {
        for (const [slotKey, member] of Object.entries(council.membersBySlot || {})) {
          const memberEmail = String(member?.memberEmail || member?.email || '').toLowerCase().trim();
          if (!memberEmail) continue;
          const id = `${activity.id}_${council.id}_${memberEmail}`;
          const isChair = slotKey === 'chair' || slotKey.startsWith('chair');
          const isSec = slotKey === 'secretary' || slotKey.startsWith('secretary');
          const canOperate = member.canOperate !== undefined ? Boolean(member.canOperate) : (isChair || isSec);
          const canScore = member.canScore !== undefined ? Boolean(member.canScore) : true;
          let role = slotKey;
          if (canOperate && !isChair && !isSec) {
            role = 'secretary_minutes';
          }
          expectedMembers.set(id, {
            roundId,
            activityId: activity.id,
            councilId: council.id,
            memberEmail,
            role,
            roleTitle: member.role || '',
            canOperate,
            canScore,
            active: true,
            updatedAt: new Date().toISOString()
          });
        }
        const chairEmail = String(council.chairEmail || '').toLowerCase().trim();
        if (chairEmail && !expectedMembers.has(`${activity.id}_${council.id}_${chairEmail}`)) {
          const id = `${activity.id}_${council.id}_${chairEmail}`;
          expectedMembers.set(id, { roundId, activityId: activity.id, councilId: council.id, memberEmail: chairEmail, role: 'chair', active: true, updatedAt: new Date().toISOString() });
        }
      }
      const membershipCollection = collection(db, 'graduationRounds', roundId, 'councilMemberships');
      const currentMembers = await getDocs(query(membershipCollection, where('activityId', '==', activity.id)));
      await Promise.all(currentMembers.docs.filter(snapshot => !expectedMembers.has(snapshot.id)).map(snapshot => deleteDoc(snapshot.ref)));
      await Promise.all([...expectedMembers].map(([id, data]) => setDoc(doc(membershipCollection, id), data)));

      const expectedStudents = new Map();
      if (typeof window.loadCouncilRoundStudents === 'function') {
        await window.loadCouncilRoundStudents(roundId).catch(() => {});
      }
      for (const assignment of (activity.councilStudentAssignments || [])) {
        if (!assignment.councilId || !assignment.studentId) continue;
        const id = `${activity.id}_${assignment.studentId}`;
        const profile = typeof window.getStudentFullProfile === 'function'
          ? window.getStudentFullProfile(assignment.studentId, activity, null, targetRound)
          : (state.councilStudentsByRound?.[roundId] || []).find(s => s.studentId === assignment.studentId) || {};
        expectedStudents.set(id, {
          roundId,
          activityId: activity.id,
          councilId: assignment.councilId,
          studentId: String(assignment.studentId),
          fullName: profile.fullName || profile.studentName || '',
          topicTitle: profile.topicTitle || '',
          supervisorName: profile.acceptedSupervisorName || profile.supervisorName || '',
          officialSupervisors: (profile.officialSupervisors || []).map(s => ({
            supervisorName: s.supervisorName || '', role: s.role || ''
          })),
          active: true,
          updatedAt: new Date().toISOString()
        });
      }
      const assignmentCollection = collection(db, 'graduationRounds', roundId, 'councilStudentAssignments');
      const currentStudents = await getDocs(query(assignmentCollection, where('activityId', '==', activity.id)));
      await Promise.all(currentStudents.docs.filter(snapshot => !expectedStudents.has(snapshot.id)).map(snapshot => deleteDoc(snapshot.ref)));
      await Promise.all([...expectedStudents].map(([id, data]) => setDoc(doc(assignmentCollection, id), data)));
    }
  } catch (err) {
    console.error('Lỗi lưu thay đổi Hội đồng:', err);
    showToast('Lỗi lưu dữ liệu: ' + err.message, 'error');
  }

  // Synchronize all UI views immediately!
  try {
    if (typeof refreshCouncilModalViews === 'function') {
      refreshCouncilModalViews();
    }
    if (typeof filterAdminRoundCouncils === 'function') {
      filterAdminRoundCouncils(roundId);
    }
    if (typeof window.filterAdminRoundCouncils === 'function') {
      window.filterAdminRoundCouncils(roundId);
    }
    if (typeof renderAdminRoundActivitiesList === 'function') {
      renderAdminRoundActivitiesList(targetRound);
    }
    if (typeof window.renderAdminRoundActivitiesList === 'function') {
      window.renderAdminRoundActivitiesList(targetRound);
    }
    if (typeof renderSupervisorTimelineActivities === 'function') {
      renderSupervisorTimelineActivities(targetRound);
    }
    if (typeof window.renderSupervisorTimelineActivities === 'function') {
      window.renderSupervisorTimelineActivities(targetRound);
    }
    if (state.selectedRoundId === roundId && typeof window.loadStudentRoundActivities === 'function') {
      window.loadStudentRoundActivities(roundId).catch(() => {});
    }
  } catch (syncErr) {
    console.warn('[Council] UI sync warning:', syncErr);
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
      const slotObj = (c.memberSlots || act.councilStructure?.slots || []).find(s => s.key === myMembership.slotKey);
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
