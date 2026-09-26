/**
 * IFA+ Graduation — Council CRUD, Slots & Guest Member Configuration
 */
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

  const slots = act.councilStructure?.slots || [];
  const supervisors = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster
    : (state.roundSupervisors || []);

  container.innerHTML = slots.map(s => {
    const assigned = membersBySlot[s.key] || {};
    const memberId = assigned.memberId || '';
    const memberName = assigned.memberName || '';
    const isGuest = (assigned.type === 'guest');

    // Filter supervisors who are not busy in overlapping councils (or already assigned in this specific slot)
    const availableSupervisors = supervisors.filter(sup => {
      if (memberId && sup.id === memberId) return true;
      const isBusy = busyMembers.has(sup.id) || (sup.email && busyMembers.has(sup.email.toLowerCase().trim()));
      return !isBusy;
    });

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

  const slots = act.councilStructure?.slots || [];
  const currentMembers = {};
  slots.forEach(s => {
    const isGuest = document.getElementById(`chk-guest-${s.key}`)?.checked === true;
    if (isGuest) {
      currentMembers[s.key] = {
        type: 'guest',
        memberName: document.getElementById(`slot-guest-name-${s.key}`)?.value?.trim() || '',
        memberEmail: document.getElementById(`slot-guest-email-${s.key}`)?.value?.trim().toLowerCase() || '',
        organization: document.getElementById(`slot-guest-org-${s.key}`)?.value?.trim() || ''
      };
    } else {
      const supId = document.getElementById(`slot-sup-${s.key}`)?.value || '';
      currentMembers[s.key] = {
        type: 'internal',
        memberId: supId
      };
    }
  });

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
  if (!targetRound) return;
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
