// ============================================================================
// TAB C: SUPERVISORS HELPERS
// ============================================================================
function renderRoundModalSupervisorsList(filter = '') {
  const container = document.getElementById('round-supervisors-picker-list');
  if (!container) return;

  const allSups = (state.supervisorsMaster && state.supervisorsMaster.length > 0)
    ? state.supervisorsMaster.filter(s => s.active !== false)
    : [];

  const q = String(filter || '').trim().toLowerCase();
  const filtered = allSups.filter(s =>
    !q ||
    (s.name && s.name.toLowerCase().includes(q)) ||
    (s.department && s.department.toLowerCase().includes(q)) ||
    (s.email && s.email.toLowerCase().includes(q))
  );

  if (filtered.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-slate-400">Không tìm thấy giảng viên phù hợp.</div>';
    return;
  }

  container.innerHTML = filtered.map(s => {
    const supId = s.id;
    const isSelected = state.roundModalSupervisors.has(supId);
    const roundData = isSelected ? state.roundModalSupervisors.get(supId) : null;
    const { employmentType, maxCap, defaultQuota } = getSupervisorDefaultAndMaxQuota(s);
    const quota = isSelected ? (roundData?.maxQuota ?? defaultQuota) : defaultQuota;

    const typeBadge = (employmentType === 'adjunct')
      ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Thỉnh giảng (tối đa 5)</span>'
      : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Cơ hữu (tối đa 10)</span>';

    const escapedName = escapeHtml(s.name || '');
    const avatarSrc = (s.photoUrl && s.photoUrl.trim()) ? s.photoUrl : getSupervisorAvatarSvgDataUri(s.name || 'GV');

    return `
      <div class="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
        <label class="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleRoundModalSupervisor('${supId}', this.checked)" class="rounded text-tdtu-blue w-4 h-4">
          <img src="${avatarSrc}" data-name="${escapedName}" onerror="this.onerror=null; this.src=getSupervisorAvatarSvgDataUri(this.dataset.name || 'GV');" class="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" alt="${escapedName}">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-slate-800 text-xs block truncate">${escapedName}</span>
              ${typeBadge}
            </div>
            <span class="text-[11px] text-slate-500 block truncate">${escapeHtml(s.department || 'Thiết kế nội thất')} • ${escapeHtml(s.email || '')}</span>
          </div>
        </label>
        <div class="flex items-center gap-1.5 ml-3 shrink-0">
          <span class="text-[11px] text-slate-500 font-semibold">Chỉ tiêu:</span>
          <input type="number" min="1" max="${maxCap}" value="${quota}" ${!isSelected ? 'disabled' : ''} onchange="updateRoundModalSupervisorQuota('${supId}', this.value)" class="w-14 p-1 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center bg-white disabled:opacity-40 disabled:bg-slate-100">
        </div>
      </div>
    `;
  }).join('');
}

window.filterRoundModalSupervisors = function(val) {
  renderRoundModalSupervisorsList(val);
};

window.toggleRoundModalSupervisor = function(supId, isChecked) {
  if (!supId || supId === 'undefined') return;
  const allSups = state.supervisorsMaster || [];
  const s = allSups.find(x => x.id === supId);
  if (!s) return;

  if (isChecked) {
    const { employmentType, maxCap, defaultQuota } = getSupervisorDefaultAndMaxQuota(s);
    const existing = state.roundModalSupervisors.get(supId);
    const quota = (existing && typeof existing.maxQuota === 'number')
      ? Math.min(maxCap, Math.max(1, existing.maxQuota))
      : defaultQuota;

    state.roundModalSupervisors.set(supId, {
      id: supId,
      supervisorId: supId,
      name: s.name || '',
      email: s.email || '',
      department: s.department || 'Thiết kế nội thất',
      photoUrl: s.photoUrl || '',
      employmentType: employmentType,
      maxQuota: quota,
      currentCount: existing?.currentCount || 0,
      active: true
    });
  } else {
    state.roundModalSupervisors.delete(supId);
  }

  renderRoundModalSupervisorsList(document.getElementById('round-sup-search-input')?.value || '');
  updateRoundModalBadges();
};

window.updateRoundModalSupervisorQuota = function(supId, val) {
  if (!supId || supId === 'undefined') return;
  const allSups = state.supervisorsMaster || [];
  const s = allSups.find(x => x.id === supId);
  const { maxCap } = getSupervisorDefaultAndMaxQuota(s);
  const parsed = parseInt(val, 10);
  const q = isNaN(parsed) ? maxCap : Math.max(1, Math.min(maxCap, parsed));

  if (state.roundModalSupervisors.has(supId)) {
    const item = state.roundModalSupervisors.get(supId);
    item.maxQuota = q;
    state.roundModalSupervisors.set(supId, item);
  }
};

window.selectAllRoundModalSupervisors = function(select) {
  const allSups = (state.supervisorsMaster || []).filter(s => s.active !== false);

  if (select) {
    allSups.forEach(s => {
      const supId = s.id;
      if (!supId || supId === 'undefined') return;
      if (!state.roundModalSupervisors.has(supId)) {
        const { employmentType, maxCap, defaultQuota } = getSupervisorDefaultAndMaxQuota(s);
        state.roundModalSupervisors.set(supId, {
          id: supId,
          supervisorId: supId,
          name: s.name || '',
          email: s.email || '',
          department: s.department || 'Thiết kế nội thất',
          photoUrl: s.photoUrl || '',
          employmentType: employmentType,
          maxQuota: defaultQuota,
          currentCount: 0,
          active: true
        });
      }
    });
  } else {
    state.roundModalSupervisors.clear();
  }

  renderRoundModalSupervisorsList(document.getElementById('round-sup-search-input')?.value || '');
  updateRoundModalBadges();
};


// --- 6 SAMPLE INTERIOR DESIGN SUPERVISORS (SAFE STATIC IDs & NO LOCAL NETWORK PNA PROMPTS) ---
export const SAMPLE_SUPERVISORS = [
  {
    id: "sup_hoangleduy",
    supervisorId: "sup_hoangleduy",
    name: "ThS. NCS. Hoàng Lê Duy",
    email: "hoangleduy@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Quyền Trưởng Khoa - Trưởng ngành Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_ngovanduc",
    supervisorId: "sup_ngovanduc",
    name: "NTK Ngô Văn Đức",
    email: "ngovanduc@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên ngành Nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_tomailinh",
    supervisorId: "sup_tomailinh",
    name: "NTK Tô Mai Lĩnh",
    email: "tomailinh@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên ngành Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_hongocle",
    supervisorId: "sup_hongocle",
    name: "ThS. Hồ Ngọc Lệ",
    email: "hongocle@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên ngành Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_nguyenminhhieu",
    supervisorId: "sup_nguyenminhhieu",
    name: "TS. Nguyễn Minh Hiếu",
    email: "nguyenminhhieu@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên ngành Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  },
  {
    id: "sup_truongthithuydiem",
    supervisorId: "sup_truongthithuydiem",
    name: "ThS. Trương Thị Thuý Diễm",
    email: "truongthithuydiem@tdtu.edu.vn",
    department: "Thiết kế nội thất",
    photoUrl: "",
    expertise: "Giảng viên bộ môn Thiết kế nội thất",
    phone: "",
    bio: "",
    active: true,
    showPhoto: true,
    showEmail: true,
    showPhone: false,
    defaultQuota: 5
  }
];

window.seedSampleSupervisors = async function(force = false) {
  if (!state.isAdmin) return;
  const existingEmails = new Set(state.supervisorsMaster.map(s => s.email?.toLowerCase()));
  const toAdd = SAMPLE_SUPERVISORS.filter(s => !existingEmails.has(s.email.toLowerCase()));
  if (toAdd.length === 0) {
    if (force) showToast('Tất cả 6 GVHD mẫu Thiết kế nội thất đã tồn tại trong danh sách!', 'warning');
    return;
  }
  try {
    for (const sup of toAdd) {
      const payload = {
        ...sup,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'supervisorMaster'), payload);
      state.supervisorsMaster.push({ id: docRef.id, ...payload });
    }
    renderAdminSupervisorsMasterTable();
    if (force) showToast('Đã thêm thành công ' + toAdd.length + ' Giảng viên Hướng dẫn mẫu!', 'success');
  } catch (err) {
    console.error('Lỗi nạp GVHD mẫu:', err);
    if (force) showToast('Lỗi nạp GVHD mẫu: ' + err.message, 'error');
  }
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof renderRoundModalSupervisorsList !== 'undefined') window.renderRoundModalSupervisorsList = renderRoundModalSupervisorsList;
}
