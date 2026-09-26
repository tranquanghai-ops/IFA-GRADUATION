/**
 * IFA+ Graduation — Activity Council Workspace & Student Allocations
 */
const escapeHtml = (str) => (typeof window !== 'undefined' && window.escapeHtml ? window.escapeHtml(str) : String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));

window.openActivityCouncilManagement = async function(roundId, actId) {
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
  document.getElementById('council-modal-act-subtitle').textContent = `Đợt: ${targetRound.title || targetRound.roundName} • Thời gian mốc: ${fmtActivityTime(act.startAt, act.endAt)}`;

  document.getElementById('modal-activity-councils')?.classList.remove('hidden');
  switchCouncilTab('councils');
  refreshCouncilModalViews();

  // Asynchronously load round students if not cached
  await loadCouncilRoundStudents(roundId);
  refreshCouncilModalViews();
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

    const membersSummaryList = slots.map(s => {
      const assigned = membersBySlot[s.key];
      if (!assigned || (!assigned.memberName && !assigned.name)) return '';
      const name = assigned.memberName || assigned.name;
      const email = assigned.memberEmail || assigned.email || assigned.memberId || '';
      const badge = typeof window.renderUserActivityBadge === 'function'
        ? window.renderUserActivityBadge(email, { compact: true })
        : '';
      return `
        <div class="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
          <span class="text-slate-700 font-semibold truncate"><b class="text-indigo-900 font-bold">${escapeHtml(s.label || s.key)}:</b> ${escapeHtml(name)}</span>
          <span class="shrink-0 ml-1.5">${badge}</span>
        </div>
      `;
    }).filter(Boolean).join('');

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

        ${membersSummaryList ? `
          <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Thành viên HĐ & Truy cập:</span>
            ${membersSummaryList}
          </div>
        ` : ''}

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

  if (roundStudents.length === 0 && state.councilStudentsLoading) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500">⏳ Đang tải danh sách sinh viên đợt tốt nghiệp...</td></tr>';
    return;
  }

  if (filteredStudents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không có sinh viên phù hợp điều kiện lọc.</td></tr>';
    return;
  }

  // Render rows
  tbody.innerHTML = filteredStudents.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '--';
    const className = s.className || s.studentClass || '';
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

    const activityBadge = typeof window.renderUserActivityBadge === 'function'
      ? window.renderUserActivityBadge(sid)
      : '<span class="text-slate-400 text-xs">--</span>';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
        <td class="p-3 font-mono font-bold text-slate-900">${sid}</td>
        <td class="p-3">
          <div class="font-semibold text-slate-800 whitespace-nowrap">${escapeHtml(name)}</div>
          ${className && className !== '--' ? `<div class="text-[10px] text-slate-400 font-normal">Lớp: ${escapeHtml(className)}</div>` : ''}
        </td>
        <td class="p-3 max-w-xs truncate text-slate-700" title="${escapeHtml(topic)}">${escapeHtml(topic)}</td>
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
        <td class="p-3 whitespace-nowrap">${activityBadge}</td>
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

// Helper: Load round students (eligible + registrations + officialAssignments + IFAA master)
async function loadCouncilRoundStudents(roundId) {
  if (!roundId) return [];
  if (state.councilStudentsByRound?.[roundId] && state.councilStudentsByRound[roundId].length > 0) {
    return state.councilStudentsByRound[roundId];
  }

  state.councilStudentsLoading = true;
  try {
    if (typeof ensureFacultyDatasetLoaded === 'function' && (!state.facultyStudents || state.facultyStudents.length === 0)) {
      await ensureFacultyDatasetLoaded().catch(() => {});
    }

    const [regSnap, elSnap, assignSnap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', roundId, 'registrations')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'graduationRounds', roundId, 'officialAssignments')).catch(() => ({ docs: [] }))
    ]);

    const studentMap = new Map();

    // 1. From eligibleStudents
    elSnap.docs.forEach(d => {
      const data = d.data() || {};
      const mssv = String(d.id || data.studentId || data.mssv || '').trim().toUpperCase();
      if (!mssv) return;
      studentMap.set(mssv, {
        studentId: mssv,
        mssv: mssv,
        fullName: data.fullName || data.name || data.studentName || '',
        studentName: data.studentName || data.name || data.fullName || '',
        className: data.className || data.studentClass || '',
        major: data.major || '',
        topicTitle: data.topicTitle || data.topic || '',
        isEligible: true,
        ...data
      });
    });

    // 2. From officialAssignments
    assignSnap.docs.forEach(d => {
      const data = d.data() || {};
      const mssv = String(d.id || data.studentId || data.mssv || '').trim().toUpperCase();
      if (!mssv) return;
      const existing = studentMap.get(mssv) || { studentId: mssv, mssv: mssv };
      studentMap.set(mssv, {
        ...existing,
        ...data,
        studentId: mssv,
        mssv: mssv,
        topicTitle: data.topicTitle || existing.topicTitle || '',
        supervisorName: data.acceptedSupervisorName || data.supervisorName || existing.supervisorName || ''
      });
    });

    // 3. From registrations
    regSnap.docs.forEach(d => {
      const data = d.data() || {};
      const mssv = String(d.id || data.studentId || data.mssv || '').trim().toUpperCase();
      if (!mssv) return;
      const existing = studentMap.get(mssv) || { studentId: mssv, mssv: mssv };
      studentMap.set(mssv, {
        ...existing,
        ...data,
        studentId: mssv,
        mssv: mssv,
        fullName: data.studentName || data.fullName || existing.fullName || '',
        studentName: data.studentName || data.fullName || existing.studentName || '',
        className: data.currentClass || data.className || existing.className || '',
        topicTitle: data.topicTitle || existing.topicTitle || ''
      });
    });

    // 4. Enrich with Faculty master dataset (IFAA)
    const list = Array.from(studentMap.values()).map(s => {
      const fac = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(s.mssv) : null;
      return {
        ...s,
        fullName: s.fullName || s.studentName || fac?.fullName || fac?.name || s.mssv,
        studentName: s.studentName || s.fullName || fac?.name || fac?.fullName || s.mssv,
        className: s.className || fac?.className || fac?.studentClass || '--',
        major: s.major || fac?.major || 'Thiết kế nội thất',
        email: s.personalEmail || s.email || fac?.email || '',
        phone: s.studentPhone || s.phone || fac?.phone || '',
        topicTitle: s.topicTitle || 'Chưa đăng ký đề tài'
      };
    });

    // Sort by MSSV ascending
    list.sort((a, b) => (a.mssv || '').localeCompare(b.mssv || ''));

    state.councilStudentsByRound = state.councilStudentsByRound || {};
    state.councilStudentsByRound[roundId] = list;

    const targetRound = (state.rounds || []).find(r => r.id === roundId);
    if (targetRound) {
      targetRound.councilStudents = list;
    }

    return list;
  } catch (err) {
    console.error('[Councils] Failed to load round students:', err);
    return [];
  } finally {
    state.councilStudentsLoading = false;
  }
}

// Helper: Get all students registered or eligible in round
function getRoundAllStudents() {
  const { roundId } = state.activeCouncilManagement;
  if (!roundId) return [];

  // Priority 1: cached council students for this round
  if (state.councilStudentsByRound?.[roundId] && state.councilStudentsByRound[roundId].length > 0) {
    return state.councilStudentsByRound[roundId];
  }

  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (targetRound?.councilStudents && targetRound.councilStudents.length > 0) {
    return targetRound.councilStudents;
  }

  // Priority 2: registrations in adminReviewData
  if (state.adminReviewData?.registrations && state.adminReviewData.registrations.length > 0) {
    return state.adminReviewData.registrations;
  }

  // Priority 3: eligibleStudents in targetRound
  if (Array.isArray(targetRound?.eligibleStudents) && targetRound.eligibleStudents.length > 0) {
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