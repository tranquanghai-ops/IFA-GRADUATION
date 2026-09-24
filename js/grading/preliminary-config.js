/**
 * IFA+ Graduation — Admin Preliminary Criteria & Reviewer Config
 */
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

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getPreliminarySummary !== 'undefined') window.getPreliminarySummary = getPreliminarySummary;
  if (typeof getPreliminaryAverage !== 'undefined') window.getPreliminaryAverage = getPreliminaryAverage;
  if (typeof getThesisFinalScore !== 'undefined') window.getThesisFinalScore = getThesisFinalScore;
  if (typeof renderSupervisorScoreCell !== 'undefined') window.renderSupervisorScoreCell = renderSupervisorScoreCell;
  if (typeof renderThesisHdScoreCell !== 'undefined') window.renderThesisHdScoreCell = renderThesisHdScoreCell;
  if (typeof persistScoreItem !== 'undefined') window.persistScoreItem = persistScoreItem;
  if (typeof renderAdminPreliminaryConfig !== 'undefined') window.renderAdminPreliminaryConfig = renderAdminPreliminaryConfig;
  if (typeof renderAdminSupervisorScoreConfig !== 'undefined') window.renderAdminSupervisorScoreConfig = renderAdminSupervisorScoreConfig;
  if (typeof renderAdminReviewerAssignmentTable !== 'undefined') window.renderAdminReviewerAssignmentTable = renderAdminReviewerAssignmentTable;
}
