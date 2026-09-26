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
  const roundId = state.activeCouncilManagement?.roundId || state.selectedRoundId;
  if (roundId) {
    if (typeof loadAdminRoundActivities === 'function') {
      loadAdminRoundActivities(roundId).catch(() => {});
    }
    if (typeof filterAdminRoundCouncils === 'function') {
      filterAdminRoundCouncils(roundId);
    }
    if (typeof window.filterAdminRoundCouncils === 'function') {
      window.filterAdminRoundCouncils(roundId);
    }
    if (state.selectedRoundId === roundId && typeof loadStudentRoundActivities === 'function') {
      loadStudentRoundActivities(roundId).catch(() => {});
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
        <div class="mt-2 p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
          <div class="flex items-center gap-2 truncate min-w-0">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
            <span class="font-black text-[10px] uppercase tracking-wider text-emerald-800 shrink-0">Đang trình bày:</span>
            <span class="font-extrabold text-xs text-emerald-950 truncate">${escapeHtml(studentObj?.fullName || studentObj?.studentName || presentingAssignment.studentId)}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="font-mono text-[11px] text-emerald-800 font-black bg-emerald-100/80 px-1.5 py-0.5 rounded">#${presentingAssignment.order || '--'}</span>
            <button type="button" onclick="stopCouncilPresentation('${c.id}')" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px] shadow-xs flex items-center gap-1 transition" title="Kết thúc lượt trình bày">
              <span>⏹ Dừng trình bày</span>
            </button>
          </div>
        </div>
      `;
    }

    // Member slot fulfillment
    const membersBySlot = c.membersBySlot || {};
    const effectiveSlots = (slots && slots.length > 0)
      ? [...slots]
      : [
          { key: 'chair', label: 'Chủ tịch', name: 'Chủ tịch Hội đồng' },
          { key: 'member', label: 'Ủy viên', name: 'Ủy viên Hội đồng' },
          { key: 'secretary', label: 'Thư ký', name: 'Thư ký Hội đồng' }
        ];
    const knownKeys = new Set(effectiveSlots.map(s => s.key));
    Object.keys(membersBySlot).forEach(k => {
      if (!knownKeys.has(k)) {
        effectiveSlots.push({ key: k, label: membersBySlot[k]?.role || k, name: membersBySlot[k]?.role || k });
      }
    });

    let filledSlotsCount = 0;
    effectiveSlots.forEach(s => {
      if (membersBySlot[s.key] && (membersBySlot[s.key].memberName || membersBySlot[s.key].name)) {
        filledSlotsCount++;
      }
    });

    const membersSummaryList = effectiveSlots.map(s => {
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

// --- TAB 3: RENDER STUDENTS & PRESENTATION ORDER (SUB-TABS PER COUNCIL) ---

window.switchCouncilStudentSubTab = function(subTabKey) {
  state.activeCouncilManagement.studentSubTab = subTabKey;
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (act) renderCouncilStudentsTab(act);
};

export function shuffleStudentsAvoidingConsecutiveSupervisors(studentList) {
  if (!studentList || studentList.length <= 1) return [...(studentList || [])];

  const getSupKey = (s) => {
    const fac = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(s.mssv || s.studentId) : null;
    const supName = s.supervisorName || s.acceptedSupervisorName || fac?.supervisorName || (typeof formatStudentSupervisorsForDisplay === 'function' ? formatStudentSupervisorsForDisplay(s) : '');
    return String(supName || 'unknown').toLowerCase().trim();
  };

  const groups = new Map();
  studentList.forEach(s => {
    const key = getSupKey(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  });

  // Randomize within each group first
  groups.forEach((list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  });

  let bestResult = null;
  let minAdjacentDuplicates = Infinity;

  // Run multiple randomized trials to find a 0-conflict (or minimum conflict) permutation
  for (let trial = 0; trial < 100; trial++) {
    const remainingGroups = new Map();
    groups.forEach((list, k) => {
      remainingGroups.set(k, [...list]);
    });

    const result = [];
    let lastKey = null;

    while (result.length < studentList.length) {
      const eligibleKeys = [];
      let maxLen = 0;
      remainingGroups.forEach((list, k) => {
        if (list.length > 0) {
          if (k !== lastKey) {
            eligibleKeys.push(k);
          }
          if (list.length > maxLen) maxLen = list.length;
        }
      });

      let chosenKey = null;
      if (eligibleKeys.length > 0) {
        const topEligible = eligibleKeys.filter(k => remainingGroups.get(k).length >= maxLen - 1);
        chosenKey = topEligible[Math.floor(Math.random() * topEligible.length)];
      } else {
        const anyRemaining = [];
        remainingGroups.forEach((list, k) => {
          if (list.length > 0) anyRemaining.push(k);
        });
        if (anyRemaining.length === 0) break;
        chosenKey = anyRemaining[Math.floor(Math.random() * anyRemaining.length)];
      }

      const pickedStudent = remainingGroups.get(chosenKey).pop();
      result.push(pickedStudent);
      lastKey = chosenKey;
    }

    let dupCount = 0;
    for (let i = 0; i < result.length - 1; i++) {
      if (getSupKey(result[i]) === getSupKey(result[i + 1])) {
        dupCount++;
      }
    }

    if (dupCount === 0) {
      return result;
    }

    if (dupCount < minAdjacentDuplicates) {
      minAdjacentDuplicates = dupCount;
      bestResult = result;
    }
  }

  return bestResult || studentList;
}

window.randomizeCouncilPresentationOrder = async function(councilId) {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const council = (act.councils || []).find(c => c.id === councilId);
  if (!council) return;

  const assignments = act.councilStudentAssignments || [];
  const councilAssignments = assignments.filter(a => a.councilId === councilId);
  if (councilAssignments.length === 0) {
    showToast('Hội đồng này chưa có sinh viên nào để phân thứ tự.', 'warning');
    return;
  }

  // Map each assignment to student object with supervisor info
  const studentObjects = councilAssignments.map(asgn => {
    const sObj = findStudentInRound(asgn.studentId) || { studentId: asgn.studentId, mssv: asgn.studentId };
    return {
      ...sObj,
      _assignment: asgn
    };
  });

  const shuffled = shuffleStudentsAvoidingConsecutiveSupervisors(studentObjects);

  // Assign order 1..N
  shuffled.forEach((s, idx) => {
    s._assignment.order = idx + 1;
  });

  await persistActivityCouncilChanges(targetRound);
  renderCouncilStudentsTab(act);
  showToast(`✓ Đã tạo lượt thuyết trình ngẫu nhiên mới cho ${council.name} (đã tránh trùng GVHD liên tiếp)!`, 'success');
};

window.autoDistributeUnassignedStudents = async function() {
  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!act) return;

  const councils = act.councils || [];
  if (councils.length === 0) {
    showToast('Vui lòng tạo ít nhất 1 Hội đồng trước khi phân bổ sinh viên.', 'warning');
    return;
  }

  const roundStudents = getRoundAllStudents();
  const assignments = act.councilStudentAssignments || [];
  const assignedSids = new Set(assignments.filter(a => !!a.councilId).map(a => a.studentId));
  const unassignedStudents = roundStudents.filter(s => !assignedSids.has(s.mssv || s.studentId));

  if (unassignedStudents.length === 0) {
    showToast('Tất cả sinh viên đã được phân công vào Hội đồng.', 'info');
    return;
  }

  // Shuffle unassigned avoiding consecutive supervisors
  const shuffled = shuffleStudentsAvoidingConsecutiveSupervisors(unassignedStudents);

  // Distribute round-robin into councils
  let cIndex = 0;
  shuffled.forEach(s => {
    const sid = s.mssv || s.studentId;
    const targetCouncil = councils[cIndex % councils.length];
    cIndex++;

    const councilAssignments = assignments.filter(a => a.councilId === targetCouncil.id);
    const maxOrder = councilAssignments.reduce((m, a) => Math.max(m, a.order || 0), 0);

    const existingIdx = assignments.findIndex(a => a.studentId === sid);
    if (existingIdx >= 0) {
      assignments[existingIdx].councilId = targetCouncil.id;
      assignments[existingIdx].order = maxOrder + 1;
      assignments[existingIdx].presentationStatus = 'waiting';
    } else {
      assignments.push({
        studentId: sid,
        councilId: targetCouncil.id,
        order: maxOrder + 1,
        presentationStatus: 'waiting'
      });
    }
  });

  act.councilStudentAssignments = assignments;
  await persistActivityCouncilChanges(targetRound);

  // Switch to first council subtab
  state.activeCouncilManagement.studentSubTab = councils[0].id;
  refreshCouncilModalViews();
  showToast(`✓ Đã tự động phân bổ ${shuffled.length} sinh viên đều vào ${councils.length} Hội đồng!`, 'success');
};

function renderCouncilStudentsTab(act) {
  const tbody = document.getElementById('council-students-tbody');
  const subtabsContainer = document.getElementById('council-student-subtabs');
  const toolbarContainer = document.getElementById('council-student-subtab-toolbar');
  if (!tbody) return;

  const councils = act.councils || [];
  const assignments = act.councilStudentAssignments || [];
  const roundStudents = getRoundAllStudents();

  const assignedStudentIds = new Set(assignments.filter(a => !!a.councilId).map(a => a.studentId));
  const unassignedCount = roundStudents.filter(s => !assignedStudentIds.has(s.mssv || s.studentId)).length;
  const assignedCount = assignedStudentIds.size;

  const studentsCountBadge = document.getElementById('cbadge-students-count');
  if (studentsCountBadge) studentsCountBadge.textContent = `${assignedCount}/${roundStudents.length}`;

  // Determine current active subtab
  let activeSubTab = state.activeCouncilManagement.studentSubTab;
  const validSubTabs = ['unassigned', 'all', ...councils.map(c => c.id)];
  if (!activeSubTab || !validSubTabs.includes(activeSubTab)) {
    activeSubTab = (unassignedCount > 0) ? 'unassigned' : (councils[0]?.id || 'all');
    state.activeCouncilManagement.studentSubTab = activeSubTab;
  }

  // 1. Render Sub-Tabs Bar
  if (subtabsContainer) {
    const unassignedPill = `
      <button type="button" onclick="switchCouncilStudentSubTab('unassigned')" class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${activeSubTab === 'unassigned' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}">
        <span>📁 Chưa phân công</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeSubTab === 'unassigned' ? 'bg-amber-800 text-amber-100' : 'bg-amber-50 text-amber-800 border border-amber-200'}">${unassignedCount}</span>
      </button>
    `;

    const councilPills = councils.map(c => {
      const cCount = assignments.filter(a => a.councilId === c.id).length;
      const isActive = (activeSubTab === c.id);
      return `
        <button type="button" onclick="switchCouncilStudentSubTab('${c.id}')" class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${isActive ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}">
          <span>🏛️ ${escapeHtml(c.name)}</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-indigo-50 text-indigo-800 border border-indigo-200'}">${cCount}</span>
        </button>
      `;
    }).join('');

    const allPill = `
      <button type="button" onclick="switchCouncilStudentSubTab('all')" class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${activeSubTab === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
        <span>👥 Tất cả</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeSubTab === 'all' ? 'bg-slate-900 text-slate-200' : 'bg-slate-100 text-slate-600'}">${roundStudents.length}</span>
      </button>
    `;

    subtabsContainer.innerHTML = unassignedPill + councilPills + allPill;
  }

  // 2. Render Subtab Toolbar & Council Info
  if (toolbarContainer) {
    if (activeSubTab === 'unassigned') {
      toolbarContainer.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div>
            <span class="font-bold text-slate-800 text-xs">Danh sách sinh viên chưa phân công Hội đồng (${unassignedCount} SV)</span>
            <p class="text-[11px] text-slate-400 mt-0.5">Chọn Hội đồng ở cột "Hội đồng đánh giá" để chuyển sinh viên vào Hội đồng tương ứng.</p>
          </div>
          ${councils.length > 0 && unassignedCount > 0 ? `
            <button type="button" onclick="autoDistributeUnassignedStudents()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 shrink-0">
              <span>⚡ Tự động chia đều vào các Hội đồng</span>
            </button>
          ` : ''}
        </div>
      `;
    } else if (activeSubTab === 'all') {
      toolbarContainer.innerHTML = `
        <div class="flex items-center justify-between w-full">
          <div>
            <span class="font-bold text-slate-800 text-xs">Tổng hợp danh sách tất cả sinh viên (${roundStudents.length} SV)</span>
            <p class="text-[11px] text-slate-400 mt-0.5">Đã phân công: <strong class="text-indigo-700 font-bold">${assignedCount}</strong> / ${roundStudents.length} sinh viên • Chưa phân: <strong class="text-amber-700 font-bold">${unassignedCount}</strong></p>
          </div>
        </div>
      `;
    } else {
      const activeCouncil = councils.find(c => c.id === activeSubTab);
      const cAssignments = assignments.filter(a => a.councilId === activeSubTab);
      toolbarContainer.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-black text-sm text-slate-900 tracking-tight">${escapeHtml(activeCouncil?.name || 'Hội đồng')}</span>
              <span class="text-xs text-slate-500 font-medium">📍 ${escapeHtml(activeCouncil?.room || 'Chưa cập nhật phòng')} • 🕒 ${activeCouncil?.date || '--'} (${activeCouncil?.startTime || '--'} - ${activeCouncil?.endTime || '--'})</span>
              <span class="badge bg-indigo-50 text-indigo-800 font-bold border border-indigo-200 text-[11px]">${cAssignments.length} SV báo cáo</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" onclick="randomizeCouncilPresentationOrder('${activeSubTab}')" class="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5" title="Xếp ngẫu nhiên thứ tự báo cáo sao cho sinh viên cùng GVHD không thuyết trình sát nhau (có thể bấm nhiều lần)">
              <span>🎲 Trộn ngẫu nhiên thứ tự</span>
              <span class="text-[10px] opacity-80">(Tránh trùng GVHD)</span>
            </button>
          </div>
        </div>
      `;
    }
  }

  // 3. Filter and Sort Students
  const q = String(state.activeCouncilManagement.filterQuery || '').trim().toLowerCase();

  const filteredStudents = roundStudents.filter(s => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '';
    const topic = s.topicTitle || '';
    const supName = (typeof formatStudentSupervisorsForDisplay === 'function') ? formatStudentSupervisorsForDisplay(s) : (s.supervisorName || '');
    if (q && !sid.toLowerCase().includes(q) && !name.toLowerCase().includes(q) && !topic.toLowerCase().includes(q) && !supName.toLowerCase().includes(q)) {
      return false;
    }

    const asgn = assignments.find(a => a.studentId === sid);
    if (activeSubTab === 'unassigned') {
      return !asgn || !asgn.councilId;
    }
    if (activeSubTab !== 'all') {
      return asgn && asgn.councilId === activeSubTab;
    }
    return true;
  });

  // Sort students:
  // If in council subtab: sort by assignment.order ascending (1, 2, 3...)
  // If unassigned or all: sort assigned first, then by order, then by MSSV
  filteredStudents.sort((a, b) => {
    const sidA = a.mssv || a.studentId;
    const sidB = b.mssv || b.studentId;
    const asgnA = assignments.find(x => x.studentId === sidA);
    const asgnB = assignments.find(x => x.studentId === sidB);
    const hasCA = asgnA?.councilId ? 1 : 2;
    const hasCB = asgnB?.councilId ? 1 : 2;
    if (hasCA !== hasCB) return hasCA - hasCB;
    if (asgnA?.councilId && asgnB?.councilId) {
      if (asgnA.councilId !== asgnB.councilId) {
        return String(asgnA.councilId).localeCompare(String(asgnB.councilId));
      }
      const orderA = asgnA.order != null ? asgnA.order : 999;
      const orderB = asgnB.order != null ? asgnB.order : 999;
      if (orderA !== orderB) return orderA - orderB;
    }
    return String(sidA || '').localeCompare(String(sidB || ''));
  });

  if (roundStudents.length === 0 && state.councilStudentsLoading) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-500">⏳ Đang tải danh sách sinh viên đợt tốt nghiệp...</td></tr>';
    return;
  }

  if (filteredStudents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">${activeSubTab === 'unassigned' ? '✓ Tất cả sinh viên đã được phân công vào Hội đồng!' : 'Không có sinh viên nào trong danh sách này.'}</td></tr>`;
    return;
  }

  // 4. Render Table Rows
  tbody.innerHTML = filteredStudents.map((s, idx) => {
    const sid = s.mssv || s.studentId;
    const name = s.fullName || s.studentName || '--';
    const className = s.className || s.studentClass || '';
    const topic = s.topicTitle || '--';
    const asgn = assignments.find(a => a.studentId === sid);
    const assignedCouncilId = asgn?.councilId || '';
    const order = asgn?.order || (idx + 1);
    const status = asgn?.presentationStatus || 'waiting';
    const supName = (typeof formatStudentSupervisorsForDisplay === 'function')
      ? formatStudentSupervisorsForDisplay(s)
      : (s.supervisorName || '--');

    const councilOptions = '<option value="">-- Chưa phân công --</option>' + councils.map(c => {
      return `<option value="${c.id}" ${assignedCouncilId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
    }).join('');

    let statusPill = '<span class="badge bg-slate-100 text-slate-600 font-bold">Chờ</span>';
    if (status === 'presenting') {
      statusPill = '<span class="badge bg-emerald-500 text-white font-black animate-pulse">● Đang trình bày</span>';
    } else if (status === 'presented') {
      statusPill = '<span class="badge bg-indigo-100 text-indigo-800 font-bold">✓ Đã xong</span>';
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 text-center whitespace-nowrap">
          ${assignedCouncilId ? `
            <div class="flex items-center justify-center gap-1 font-mono">
              <span class="font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-xs min-w-[28px]">#${order}</span>
              <div class="flex flex-col">
                <button type="button" onclick="moveStudentCouncilOrder('${sid}', 'up')" class="text-[10px] text-slate-400 hover:text-indigo-600 font-bold leading-none p-0.5" title="Di chuyển lên">▲</button>
                <button type="button" onclick="moveStudentCouncilOrder('${sid}', 'down')" class="text-[10px] text-slate-400 hover:text-indigo-600 font-bold leading-none p-0.5" title="Di chuyển xuống">▼</button>
              </div>
            </div>
          ` : `<span class="font-mono text-slate-400 font-bold text-xs">${idx + 1}</span>`}
        </td>
        <td class="p-3 font-mono font-bold text-slate-900 text-center whitespace-nowrap">${sid}</td>
        <td class="p-3">
          <div class="font-bold text-slate-800 whitespace-nowrap">${escapeHtml(name)}</div>
          ${className && className !== '--' ? `<div class="text-[10px] text-slate-400 font-normal">Lớp: ${escapeHtml(className)}</div>` : ''}
        </td>
        <td class="p-3 text-slate-700 text-xs min-w-[140px] whitespace-normal break-words">${escapeHtml(supName)}</td>
        <td class="p-3 max-w-xs truncate text-slate-700 min-w-[160px]" title="${escapeHtml(topic)}">${escapeHtml(topic)}</td>
        <td class="p-3">
          <select onchange="changeStudentCouncil('${sid}', this.value)" class="w-full min-w-[140px] p-2 border border-slate-300 rounded-xl text-xs font-bold ${assignedCouncilId ? 'bg-indigo-50/70 text-indigo-950 border-indigo-300' : 'bg-slate-50 text-slate-600'} focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            ${councilOptions}
          </select>
        </td>
        <td class="p-3 text-center whitespace-nowrap space-x-1">
          ${assignedCouncilId ? `
            <div class="inline-flex items-center gap-1.5">
              ${statusPill}
              ${status === 'presenting' ? `
                <button type="button" onclick="setStudentPresentationStatus('${sid}', 'waiting')" class="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold shadow-2xs flex items-center gap-0.5 transition" title="Dừng lượt trình bày">
                  <span>⏹ Dừng</span>
                </button>
              ` : `
                <div class="inline-flex gap-0.5 ml-1">
                  <button type="button" onclick="setStudentPresentationStatus('${sid}', 'presenting')" class="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold transition" title="Bắt đầu trình bày">▶</button>
                  <button type="button" onclick="setStudentPresentationStatus('${sid}', 'presented')" class="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold transition" title="Hoàn tất trình bày">✓</button>
                  <button type="button" onclick="setStudentPresentationStatus('${sid}', 'waiting')" class="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold transition" title="Đặt lại trạng thái chờ">↺</button>
                </div>
              `}
            </div>
          ` : '<span class="text-slate-300">--</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

window.filterCouncilStudents = function() {
  const searchInput = document.getElementById('council-student-search');
  state.activeCouncilManagement.filterQuery = searchInput?.value || '';

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
if (typeof window !== 'undefined') {
  window.findStudentInRound = findStudentInRound;
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

  // Normalize sequential order 1..N
  councilStudents.forEach((a, i) => { a.order = i + 1; });

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

window.stopCouncilPresentation = async function(councilId) {
  const roundId = state.activeCouncilManagement.roundId || state.selectedRoundId || state.activeRound?.id;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const actId = state.activeCouncilManagement.activityId;
  let act = actId ? (targetRound.activities || []).find(a => a.id === actId) : null;
  if (!act) {
    act = (targetRound.activities || []).find(a => (a.councils || []).some(c => c.id === councilId));
  }
  if (!act) return;

  let stopped = false;
  (act.councilStudentAssignments || []).forEach(a => {
    if (a.councilId === councilId && a.presentationStatus === 'presenting') {
      a.presentationStatus = 'waiting';
      stopped = true;
    }
  });

  if (stopped) {
    await persistActivityCouncilChanges(targetRound);
    refreshCouncilModalViews();
    if (typeof filterAdminRoundCouncils === 'function') {
      filterAdminRoundCouncils(roundId);
    }
    showToast('✓ Đã dừng lượt trình bày của sinh viên trong Hội đồng.', 'success');
  }
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

// ============================================================================
// COPY COUNCILS & STUDENTS FROM ANOTHER MILESTONE
// ============================================================================

window.openCopyCouncilsFromMilestoneModal = function() {
  const { roundId, activityId } = state.activeCouncilManagement;
  const currentRound = (state.rounds || []).find(r => r.id === roundId);
  if (!currentRound) return;

  const select = document.getElementById('copy-councils-source-select');
  const preview = document.getElementById('copy-councils-source-preview');
  if (!select) return;

  const candidateActs = [];
  (state.rounds || []).forEach(r => {
    (r.activities || []).forEach(a => {
      // Don't list the exact same activity as source
      if (r.id === roundId && a.id === activityId) return;
      if (a.councils && a.councils.length > 0) {
        candidateActs.push({
          roundId: r.id,
          roundTitle: r.title || r.name || 'Đợt không tên',
          activityId: a.id,
          actTitle: a.title,
          actOrder: a.order,
          councilsCount: a.councils.length,
          studentsCount: (a.councilStudentAssignments || []).filter(asgn => !!asgn.councilId).length,
          slotsCount: (a.councilStructure?.slots || []).length
        });
      }
    });
  });

  if (candidateActs.length === 0) {
    showToast('Không tìm thấy Mốc kế hoạch nào khác có Hội đồng để sao chép.', 'info');
    return;
  }

  select.innerHTML = candidateActs.map(c => `
    <option value="${c.roundId}:::${c.activityId}" data-info="${c.councilsCount} Hội đồng, ${c.studentsCount} SV phân công, ${c.slotsCount} vị trí">
      [${escapeHtml(c.roundTitle)}] Mốc #${c.actOrder || '--'}: ${escapeHtml(c.actTitle)} (${c.councilsCount} HĐ, ${c.studentsCount} SV)
    </option>
  `).join('');

  const updatePreview = () => {
    const opt = select.options[select.selectedIndex];
    if (opt && preview) {
      preview.textContent = `Nguồn: ${opt.getAttribute('data-info')}`;
    }
  };

  select.onchange = updatePreview;
  updatePreview();

  document.getElementById('modal-copy-councils-from-milestone')?.classList.remove('hidden');
};

window.closeCopyCouncilsFromMilestoneModal = function() {
  document.getElementById('modal-copy-councils-from-milestone')?.classList.add('hidden');
};

window.confirmCopyCouncilsFromMilestone = async function() {
  const select = document.getElementById('copy-councils-source-select');
  if (!select || !select.value) {
    showToast('Vui lòng chọn mốc nguồn cần sao chép.', 'warning');
    return;
  }

  const [srcRoundId, srcActId] = select.value.split(':::');
  const srcRound = (state.rounds || []).find(r => r.id === srcRoundId);
  const srcAct = (srcRound?.activities || []).find(a => a.id === srcActId);

  if (!srcAct) {
    showToast('Không tìm thấy thông tin mốc nguồn.', 'error');
    return;
  }

  const { roundId, activityId } = state.activeCouncilManagement;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const targetAct = (targetRound?.activities || []).find(a => a.id === activityId);
  if (!targetAct) return;

  const copyStructure = document.getElementById('copy-opt-structure')?.checked ?? true;
  const copyCouncils = document.getElementById('copy-opt-councils')?.checked ?? true;
  const copyStudents = document.getElementById('copy-opt-students')?.checked ?? true;
  const mode = document.querySelector('input[name="copy-councils-mode"]:checked')?.value || 'replace';

  if (!copyStructure && !copyCouncils && !copyStudents) {
    showToast('Vui lòng chọn ít nhất một nội dung cần sao chép.', 'warning');
    return;
  }

  // 1. Structure
  if (copyStructure && srcAct.councilStructure) {
    targetAct.councilStructure = JSON.parse(JSON.stringify(srcAct.councilStructure));
  }

  // 2. Councils & Student assignments
  const councilIdMap = new Map(); // srcId -> newId

  if (copyCouncils) {
    const clonedCouncils = (srcAct.councils || []).map(c => {
      const newId = (mode === 'replace') ? (c.id || ('council_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4))) : ('council_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
      councilIdMap.set(c.id, newId);
      return {
        ...JSON.parse(JSON.stringify(c)),
        id: newId,
        status: 'draft'
      };
    });

    if (mode === 'replace') {
      targetAct.councils = clonedCouncils;
    } else {
      targetAct.councils = targetAct.councils || [];
      targetAct.councils.push(...clonedCouncils);
    }
  }

  // 3. Student assignments
  if (copyStudents && srcAct.councilStudentAssignments) {
    const targetStudents = getRoundAllStudents();
    const targetStudentIds = new Set(targetStudents.map(s => s.mssv || s.studentId));

    const clonedAssignments = (srcAct.councilStudentAssignments || [])
      .filter(asgn => asgn.councilId && (targetStudentIds.size === 0 || targetStudentIds.has(asgn.studentId)))
      .map(asgn => {
        const mappedCouncilId = councilIdMap.get(asgn.councilId) || asgn.councilId;
        return {
          studentId: asgn.studentId,
          councilId: mappedCouncilId,
          order: asgn.order || 1,
          presentationStatus: 'waiting'
        };
      });

    if (mode === 'replace') {
      targetAct.councilStudentAssignments = clonedAssignments;
    } else {
      targetAct.councilStudentAssignments = targetAct.councilStudentAssignments || [];
      const copiedSids = new Set(clonedAssignments.map(a => a.studentId));
      targetAct.councilStudentAssignments = targetAct.councilStudentAssignments.filter(a => !copiedSids.has(a.studentId));
      targetAct.councilStudentAssignments.push(...clonedAssignments);
    }
  }

  targetAct.councilEnabled = true;

  await persistActivityCouncilChanges(targetRound);
  closeCopyCouncilsFromMilestoneModal();
  refreshCouncilModalViews();
  if (typeof filterAdminRoundCouncils === 'function') {
    filterAdminRoundCouncils(roundId);
  }

  showToast(`✓ Đã sao chép thành công từ "${srcAct.title}" sang mốc hiện tại!`, 'success');
};

// ============================================================================
// ADMIN ROUND COUNCILS DASHBOARD (UNIFIED COUNCIL WORKSPACE FOR ROUND)
// ============================================================================

window.loadAdminRoundCouncils = async function(roundId) {
  const targetRoundId = roundId || state.selectedRoundId || state.activeRound?.id;
  if (!targetRoundId) return;

  const targetRound = (state.rounds || []).find(r => r.id === targetRoundId);
  if (!targetRound) return;

  // Sync dropdown
  const selectEl = document.getElementById('admin-round-councils-select');
  if (selectEl) {
    selectEl.innerHTML = (state.rounds || []).map(r => `
      <option value="${r.id}" ${r.id === targetRoundId ? 'selected' : ''}>${escapeHtml(r.title || r.name)}</option>
    `).join('');
  }

  // Load activities, round students, and user activities
  if (typeof loadAdminRoundActivities === 'function') {
    await loadAdminRoundActivities(targetRoundId).catch(() => {});
  }
  await loadCouncilRoundStudents(targetRoundId).catch(() => []);
  if (typeof window.loadUserActivities === 'function') {
    await window.loadUserActivities().catch(() => {});
  }

  // Populate milestone filter dropdown
  const milestoneSelect = document.getElementById('admin-councils-filter-milestone');
  const activities = (targetRound.activities || []).filter(a => a.councilEnabled || (a.councils && a.councils.length > 0));
  if (milestoneSelect) {
    milestoneSelect.innerHTML = '<option value="all">Tất cả mốc có Hội đồng</option>' + activities.map(a => `
      <option value="${a.id}">Mốc #${a.order || '--'}: ${escapeHtml(a.title)} (${(a.councils || []).length} HĐ)</option>
    `).join('');
  }

  filterAdminRoundCouncils(targetRoundId);
};

window.filterAdminRoundCouncils = function(roundId = null) {
  const targetRoundId = roundId || document.getElementById('admin-round-councils-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === targetRoundId);
  const container = document.getElementById('admin-round-councils-container');
  if (!container || !targetRound) return;

  const milestoneFilter = document.getElementById('admin-councils-filter-milestone')?.value || 'all';
  const searchQuery = (document.getElementById('admin-councils-search')?.value || '').toLowerCase().trim();

  const activities = (targetRound.activities || []).filter(a => a.councilEnabled || (a.councils && a.councils.length > 0));
  const roundStudents = getRoundAllStudents();

  // Metrics computation
  let totalCouncils = 0;
  const allCouncilMembers = new Map();
  const assignedStudentSet = new Set();

  activities.forEach(act => {
    const councils = act.councils || [];
    totalCouncils += councils.length;
    (act.councilStudentAssignments || []).forEach(asgn => {
      if (asgn.councilId) assignedStudentSet.add(asgn.studentId);
    });
    councils.forEach(c => {
      const slots = c.membersBySlot || {};
      Object.keys(slots).forEach(slotKey => {
        const m = slots[slotKey];
        if (!m || (!m.memberEmail && !m.memberName)) return;
        const key = (m.memberEmail || m.memberName).toLowerCase().trim();
        allCouncilMembers.set(key, m);
      });
    });
  });

  // Render Stats
  const statTotalEl = document.getElementById('adm-councils-stat-total');
  const statMilestonesEl = document.getElementById('adm-councils-stat-milestones');
  const statStudentsEl = document.getElementById('adm-councils-stat-students');
  const statUnassignedEl = document.getElementById('adm-councils-stat-unassigned');
  const statMembersEl = document.getElementById('adm-councils-stat-members');
  const statActiveMembersEl = document.getElementById('adm-councils-stat-active-members');

  if (statTotalEl) statTotalEl.textContent = totalCouncils;
  if (statMilestonesEl) statMilestonesEl.textContent = `Trên ${activities.length} mốc kế hoạch có Hội đồng`;
  if (statStudentsEl) statStudentsEl.textContent = `${assignedStudentSet.size} / ${roundStudents.length} SV`;
  if (statUnassignedEl) statUnassignedEl.textContent = `${roundStudents.length - assignedStudentSet.size} sinh viên chưa phân HĐ`;
  if (statMembersEl) statMembersEl.textContent = `${allCouncilMembers.size} thành viên`;

  let activeCount = 0;
  allCouncilMembers.forEach((m, email) => {
    const info = (typeof window.getUserActivityInfo === 'function') ? window.getUserActivityInfo(email) : null;
    if (info?.hasLoggedIn) activeCount++;
  });
  if (statActiveMembersEl) statActiveMembersEl.textContent = `${activeCount} / ${allCouncilMembers.size} đã đăng nhập hệ thống`;

  // Filter activities and councils
  let filteredActivities = activities;
  if (milestoneFilter !== 'all') {
    filteredActivities = activities.filter(a => a.id === milestoneFilter);
  }

  if (filteredActivities.length === 0) {
    container.innerHTML = `
      <div class="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
        <span class="text-4xl block">🏛️</span>
        <h3 class="font-bold text-slate-700 text-sm">Đợt này chưa có mốc kế hoạch nào kích hoạt Hội đồng</h3>
        <p class="text-xs text-slate-400 max-w-md mx-auto">Vào tab "Kế hoạch đợt", chọn mốc cần đánh giá và bật tùy chọn "Kích hoạt Hội đồng chấm điểm" để thiết lập hội đồng.</p>
        <button type="button" onclick="openRoundWorkspaceModal('${targetRoundId}', 'timeline')" class="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs border border-indigo-200 transition-colors">
          📅 Mở Kế hoạch đợt
        </button>
      </div>
    `;
    return;
  }

  let totalVisibleCouncils = 0;
  const milestoneBlocksHtml = filteredActivities.map(act => {
    let councils = act.councils || [];
    const assignments = act.councilStudentAssignments || [];
    const slots = (act.councilStructure?.slots && act.councilStructure.slots.length > 0)
      ? act.councilStructure.slots
      : [
          { key: 'chair', label: 'Chủ tịch', name: 'Chủ tịch Hội đồng' },
          { key: 'member', label: 'Ủy viên', name: 'Ủy viên Hội đồng' },
          { key: 'secretary', label: 'Thư ký', name: 'Thư ký Hội đồng' }
        ];

    if (searchQuery) {
      councils = councils.filter(c => {
        const matchName = String(c.name || '').toLowerCase().includes(searchQuery);
        const matchRoom = String(c.room || '').toLowerCase().includes(searchQuery);
        const matchMembers = Object.values(c.membersBySlot || {}).some(m => String(m.memberName || m.name || '').toLowerCase().includes(searchQuery) || String(m.memberEmail || '').toLowerCase().includes(searchQuery));
        const matchStudents = assignments.filter(a => a.councilId === c.id).some(a => {
          const st = roundStudents.find(s => s.mssv === a.studentId || s.studentId === a.studentId);
          return String(a.studentId).toLowerCase().includes(searchQuery) || String(st?.fullName || st?.name || '').toLowerCase().includes(searchQuery);
        });
        return matchName || matchRoom || matchMembers || matchStudents;
      });
    }

    totalVisibleCouncils += councils.length;

    const councilCardsHtml = councils.length === 0 ? `
      <div class="col-span-full p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <span class="text-xs text-slate-400 font-semibold">Chưa có Hội đồng nào trong mốc này hoặc không khớp tìm kiếm.</span>
      </div>
    ` : councils.map(c => {
      const assignedStudents = assignments.filter(a => a.councilId === c.id);
      const membersBySlot = c.membersBySlot || {};

      let statusBadge = '<span class="badge bg-slate-100 text-slate-700 font-bold">Chuẩn bị</span>';
      if (c.status === 'ongoing') statusBadge = '<span class="badge bg-emerald-100 text-emerald-800 font-bold">● Đang diễn ra</span>';
      else if (c.status === 'completed') statusBadge = '<span class="badge bg-slate-200 text-slate-600 font-bold">✓ Đã kết thúc</span>';

      const effectiveSlots = [...slots];
      const knownKeys = new Set(effectiveSlots.map(s => s.key));
      Object.keys(membersBySlot).forEach(k => {
        if (!knownKeys.has(k)) {
          effectiveSlots.push({ key: k, label: membersBySlot[k]?.role || k, name: membersBySlot[k]?.role || k });
        }
      });

      const membersListHtml = effectiveSlots.map(s => {
        const assigned = membersBySlot[s.key];
        if (!assigned || (!assigned.memberName && !assigned.name)) return '';
        const name = assigned.memberName || assigned.name;
        const email = assigned.memberEmail || assigned.email || assigned.memberId || '';
        const badge = typeof window.renderUserActivityBadge === 'function'
          ? window.renderUserActivityBadge(email, { compact: true })
          : '';
        return `
          <div class="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
            <span class="text-slate-700 font-medium truncate"><b class="text-indigo-950 font-bold">${escapeHtml(s.label || s.key)}:</b> ${escapeHtml(name)}</span>
            <span class="shrink-0 ml-1.5">${badge}</span>
          </div>
        `;
      }).filter(Boolean).join('');

      return `
        <div class="bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-200 shadow-xs transition-all space-y-3 flex flex-col justify-between">
          <div class="space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="font-black text-sm text-slate-900 tracking-tight">${escapeHtml(c.name)}</h4>
                  ${statusBadge}
                </div>
                <p class="text-[11px] text-slate-500 mt-0.5 font-medium">📍 ${escapeHtml(c.room || 'Chưa cập nhật phòng')}</p>
              </div>
              <div class="text-right shrink-0">
                <span class="font-black text-indigo-700 text-xs block">${assignedStudents.length} SV báo cáo</span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span>📅 ${c.date || '--'}</span>
              <span>🕒 ${c.startTime || '--'} → ${c.endTime || '--'}</span>
            </div>

            ${membersListHtml ? `
              <div class="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Thành viên Hội đồng:</span>
                ${membersListHtml}
              </div>
            ` : '<div class="p-2 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl">Chưa phân công thành viên</div>'}
          </div>

          <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="copyCouncilLink('${act.slug}', '${c.slug || c.id}')" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold" title="Sao chép link trực tiếp đến Hội đồng này">🔗</button>
              ${c.driveFolderUrl ? `
                <a href="${c.driveFolderUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition-colors flex items-center gap-1" title="Mở Drive Hội đồng">
                  <span>📁 Drive</span>
                </a>
              ` : ''}
            </div>

            <div class="flex items-center gap-1.5 flex-wrap">
              <button type="button" onclick="openCouncilWorkspace('${targetRoundId}', '${act.id}', '${c.id}')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs">▶ Vào phòng HĐ</button>
              <button type="button" onclick="openActivityCouncilManagement('${targetRoundId}', '${act.id}')" class="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-bold border border-violet-200 transition-colors" title="Phân sinh viên và thứ tự">👥 Phân SV</button>
              <button type="button" onclick="openEditCouncilModalForAct('${targetRoundId}', '${act.id}', '${c.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors">Sửa HĐ</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card-surface p-5 space-y-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-black text-sm text-slate-900">Mốc #${act.order || '--'}: ${escapeHtml(act.title)}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-300">${(act.councils || []).length} Hội đồng</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5 font-medium">🗓️ ${fmtActivityTime(act.startAt, act.endAt)} • 📍 ${act.location || 'Địa điểm khoa'}</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" onclick="openActivityCouncilManagement('${targetRoundId}', '${act.id}')" class="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs">
              <span>⚖️ Quản lý & Phân SV mốc này</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${councilCardsHtml}
        </div>
      </div>
    `;
  }).join('');

  const countBadge = document.getElementById('adm-councils-filtered-count');
  if (countBadge) countBadge.textContent = `${totalVisibleCouncils} Hội đồng`;

  container.innerHTML = milestoneBlocksHtml;
};

window.openEditCouncilModalForAct = async function(roundId, activityId, councilId) {
  state.activeCouncilManagement = {
    roundId,
    activityId,
    filterQuery: '',
    filterCouncilId: 'all'
  };
  await loadCouncilRoundStudents(roundId);
  editCouncilModal(councilId);
};

window.openCreateCouncilForRound = function() {
  const roundId = document.getElementById('admin-round-councils-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const activities = (targetRound?.activities || []).filter(a => a.councilEnabled || (a.councils && a.councils.length > 0));

  if (!activities.length) {
    showToast('Đợt này chưa có mốc kế hoạch nào kích hoạt Hội đồng. Hãy bật Hội đồng ở mốc kế hoạch trước.', 'warning');
    return;
  }

  // Open first council-enabled activity's council management
  openActivityCouncilManagement(roundId, activities[0].id);
};

window.exportAdminRoundCouncilsExcel = function() {
  const roundId = document.getElementById('admin-round-councils-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const activities = (targetRound.activities || []).filter(a => a.councilEnabled || (a.councils && a.councils.length > 0));
  const roundStudents = getRoundAllStudents();

  const headers = ['Mốc kế hoạch', 'Tên Hội đồng', 'Phòng', 'Ngày', 'Giờ', 'Chức danh / Slot', 'Họ và tên thành viên', 'Email thành viên', 'Đơn vị', 'MSSV SV Báo cáo', 'Họ tên SV', 'Tên đề tài', 'Thứ tự báo cáo'];
  const rows = [];

  activities.forEach(act => {
    const councils = act.councils || [];
    const assignments = act.councilStudentAssignments || [];
    const slots = act.councilStructure?.slots || [];

    councils.forEach(c => {
      const assignedStudents = assignments.filter(a => a.councilId === c.id).sort((a, b) => (a.order || 0) - (b.order || 0));
      const membersBySlot = c.membersBySlot || {};

      // If has assigned students
      if (assignedStudents.length > 0) {
        assignedStudents.forEach(asgn => {
          const st = roundStudents.find(s => s.mssv === asgn.studentId || s.studentId === asgn.studentId);
          rows.push([
            `"${act.title}"`,
            `"${c.name}"`,
            `"${c.room || ''}"`,
            c.date || '',
            `${c.startTime || ''} - ${c.endTime || ''}`,
            '--',
            '--',
            '--',
            '--',
            asgn.studentId,
            `"${st?.fullName || st?.name || ''}"`,
            `"${(st?.topicTitle || '').replace(/"/g, '""')}"`,
            asgn.order || ''
          ]);
        });
      } else {
        // Just council info
        rows.push([
          `"${act.title}"`,
          `"${c.name}"`,
          `"${c.room || ''}"`,
          c.date || '',
          `${c.startTime || ''} - ${c.endTime || ''}`,
          '--',
          '--',
          '--',
          '--',
          '--',
          '--',
          '--',
          '--'
        ]);
      }
    });
  });

  if (rows.length === 0) {
    showToast('Chưa có dữ liệu Hội đồng để xuất.', 'warning');
    return;
  }

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Danh_sach_Hoi_dong_${(targetRound.title || 'dot').replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('✓ Đã xuất danh sách Hội đồng thành công!', 'success');
};