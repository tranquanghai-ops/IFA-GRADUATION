/**
 * IFA+ Graduation — Student Eligibility Round Modal & Candidate Selection
 */
// ============================================================================
// TAB B: ELIGIBLE STUDENTS HELPERS
// ============================================================================

// Helper to remove Vietnamese tones for flexible search
function removeVietnameseTones(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function renderRoundModalEligibleTable() {
  const tbody = document.getElementById('round-eligible-students-tbody');
  if (!tbody) return;

  const list = state.roundModalEligibleStudents || [];
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400 font-medium">Chưa có sinh viên nào trong đợt này.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((s, idx) => {
    const mssv = String(s.studentId || s.mssv || '').trim().toUpperCase();
    const master = window.getFacultyStudent ? window.getFacultyStudent(mssv) : null;
    const isFoundInMaster = master && !master.notFoundInMaster;

    let displayName = '';
    let displayMajor = s.major || '--';
    let displayClass = s.className || s.studentClass || '--';
    let showNotFoundBadge = false;

    if (isFoundInMaster) {
      displayName = master.fullName || master.name || s.name || s.fullName || '';
      displayMajor = master.major || s.major || '--';
      displayClass = master.className || master.studentClass || s.className || s.studentClass || '--';
    } else {
      const rawName = String(s.name || s.fullName || '').trim();
      // Ensure we NEVER display MSSV or 'Sinh viên MSSV' in Họ và tên column
      if (rawName && rawName !== mssv && !rawName.startsWith('Sinh viên ' + mssv)) {
        displayName = rawName;
      } else {
        displayName = '<span class="text-slate-400 italic">Chưa có thông tin</span>';
      }
      showNotFoundBadge = true;
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
        <td class="p-2.5 text-center text-slate-400 font-mono">${idx + 1}</td>
        <td class="p-2.5 font-mono font-bold text-slate-900">${mssv}</td>
        <td class="p-2.5">
          <div class="font-bold text-slate-800">${displayName}</div>
          ${showNotFoundBadge ? '<div class="mt-0.5"><span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Không tìm thấy trong SV Khoa</span></div>' : ''}
        </td>
        <td class="p-2.5 text-slate-600">${displayMajor}</td>
        <td class="p-2.5 font-mono text-slate-600">${displayClass}</td>
        <td class="p-2.5 text-right">
          <button type="button" onclick="removeRoundModalEligibleStudent('${mssv}')" class="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded font-bold text-xs transition-colors">Xóa</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.removeRoundModalEligibleStudent = function(studentId) {
  const cleanId = String(studentId || '').trim().toUpperCase();
  state.roundModalEligibleStudents = (state.roundModalEligibleStudents || []).filter(
    s => String(s.studentId || s.mssv || '').trim().toUpperCase() !== cleanId
  );
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
};

window.clearRoundModalEligibleStudents = function() {
  if (!state.roundModalEligibleStudents || state.roundModalEligibleStudents.length === 0) return;
  state.roundModalEligibleStudents = [];
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
  showToast('Đã xóa toàn bộ sinh viên khỏi đợt (bấm [Lưu Đợt] để lưu thay đổi).', 'info');
};

// ----------------------------------------------------------------------------
// QUICK SEARCH & ADD HELPERS
// ----------------------------------------------------------------------------
window.clearRoundQuickSearch = function() {
  const input = document.getElementById('round-add-student-input');
  const box = document.getElementById('round-student-suggestions');
  const clearBtn = document.getElementById('round-add-student-clear-btn');
  if (input) input.value = '';
  if (box) box.classList.add('hidden');
  if (clearBtn) clearBtn.classList.add('hidden');
};

document.addEventListener('click', (e) => {
  const box = document.getElementById('round-student-suggestions');
  const input = document.getElementById('round-add-student-input');
  if (box && !box.classList.contains('hidden')) {
    if (!box.contains(e.target) && e.target !== input) {
      box.classList.add('hidden');
    }
  }
});

window.suggestFacultyStudentsForRound = async function(query) {
  const box = document.getElementById('round-student-suggestions');
  const clearBtn = document.getElementById('round-add-student-clear-btn');
  if (!box) return;

  const rawQ = String(query || '').trim();
  if (clearBtn) {
    if (rawQ) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  if (rawQ.length < 2) {
    box.classList.add('hidden');
    return;
  }

  let rows = state.facultyStudents;
  if (!rows || rows.length === 0) {
    rows = await ensureFacultyDatasetLoaded().catch(() => []);
  }

  const qLower = rawQ.toLowerCase();
  const qNorm = removeVietnameseTones(rawQ);

  const matches = (rows || []).filter(s => {
    const mssvMatch = s.mssv && s.mssv.toLowerCase().includes(qLower);
    const nameMatch = removeVietnameseTones(s.fullName || s.name).includes(qNorm);
    const classMatch = removeVietnameseTones(s.className || s.studentClass).includes(qNorm);
    return mssvMatch || nameMatch || classMatch;
  }).slice(0, 10);

  if (matches.length === 0) {
    box.innerHTML = '<div class="p-3 text-center text-slate-400 font-medium">Không tìm thấy sinh viên phù hợp trong SV Khoa</div>';
    box.classList.remove('hidden');
    return;
  }

  const currentSet = new Set(
    (state.roundModalEligibleStudents || []).map(x => String(x.studentId || x.mssv || '').trim().toUpperCase())
  );

  box.innerHTML = matches.map(s => {
    const cleanMssv = String(s.mssv || '').trim().toUpperCase();
    const isAdded = currentSet.has(cleanMssv);
    return `
      <div class="p-2.5 hover:bg-indigo-50 flex items-center justify-between transition-colors">
        <div class="min-w-0 pr-2">
          <div class="flex items-center gap-2">
            <span class="font-bold font-mono text-slate-900 text-xs">${cleanMssv}</span>
            <span class="font-semibold text-slate-800 text-xs truncate">${s.fullName || s.name}</span>
          </div>
          <span class="text-[11px] text-slate-500 block truncate">${s.major || 'Chưa có ngành'} • ${s.className || s.studentClass || 'Chưa có lớp'}</span>
        </div>
        <div class="shrink-0">
          ${isAdded
            ? '<span class="px-2 py-1 bg-slate-100 text-slate-400 font-bold text-[11px] rounded">Đã có trong đợt</span>'
            : `<button type="button" onclick="addFacultyStudentToRound('${cleanMssv}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded font-bold text-xs transition-colors">+ Thêm</button>`
          }
        </div>
      </div>
    `;
  }).join('');
  box.classList.remove('hidden');
};

window.addFacultyStudentToRound = function(mssv) {
  const cleanMssv = String(mssv || '').trim().toUpperCase();
  if (!cleanMssv) return;

  clearRoundQuickSearch();

  const currentList = state.roundModalEligibleStudents || [];
  if (currentList.some(s => String(s.studentId || s.mssv || '').trim().toUpperCase() === cleanMssv)) {
    showToast(`Sinh viên ${cleanMssv} đã có trong danh sách đợt!`, 'warning');
    return;
  }

  const s = (state.facultyStudents || []).find(x => String(x.mssv || '').trim().toUpperCase() === cleanMssv) ||
            (window.getFacultyStudent ? window.getFacultyStudent(cleanMssv) : null);

  if (!s || s.notFoundInMaster) {
    showToast(`Không tìm thấy sinh viên ${cleanMssv} trong SV Khoa!`, 'error');
    return;
  }

  const fullName = s.fullName || s.name || '';
  const className = s.className || s.studentClass || '';

  currentList.push({
    studentId: cleanMssv,
    mssv: cleanMssv,
    name: fullName,
    fullName: fullName,
    gender: s.gender || '',
    major: s.major || '',
    className: className,
    studentClass: className,
    email: s.email || `${cleanMssv.toLowerCase()}@student.tdtu.edu.vn`,
    phone: s.phone || '',
    eligible: true
  });

  state.roundModalEligibleStudents = currentList;
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
  showToast(`✓ Đã thêm sinh viên ${cleanMssv} (${fullName}) vào đợt!`, 'success');
};

// ----------------------------------------------------------------------------
// MODAL: + THÊM SINH VIÊN (MULTI-SELECT FROM FACULTY STUDENT MASTER)
// ----------------------------------------------------------------------------
state.selectedEligibleCandidates = new Set();
state.currentCandidateMatches = [];

window.openAddEligibleStudentModal = async function() {
  state.selectedEligibleCandidates = new Set();
  state.currentCandidateMatches = [];

  const input = document.getElementById('add-eligible-student-search-input');
  if (input) input.value = '';

  const clearBtn = document.getElementById('add-eligible-clear-btn');
  if (clearBtn) clearBtn.classList.add('hidden');

  const selectAll = document.getElementById('select-all-eligible-candidates');
  if (selectAll) selectAll.checked = false;

  const modal = document.getElementById('modal-add-eligible-student');
  if (modal) modal.classList.remove('hidden');

  updateAddEligibleSelectionUI();

  // Load faculty dataset if not loaded
  let rows = state.facultyStudents;
  if (!rows || rows.length === 0) {
    if (typeof ensureFacultyDatasetLoaded === 'function') {
      rows = await ensureFacultyDatasetLoaded().catch(() => []);
    }
  }

  renderAddEligibleCandidateResults('');
};

window.closeAddEligibleStudentModal = function() {
  const modal = document.getElementById('modal-add-eligible-student');
  if (modal) modal.classList.add('hidden');
  state.selectedEligibleCandidates.clear();
  state.currentCandidateMatches = [];
};

window.clearAddEligibleSearch = function() {
  const input = document.getElementById('add-eligible-student-search-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('add-eligible-clear-btn');
  if (clearBtn) clearBtn.classList.add('hidden');
  renderAddEligibleCandidateResults('');
};

window.onAddEligibleStudentSearchInput = function(query) {
  const rawQ = String(query || '').trim();
  const clearBtn = document.getElementById('add-eligible-clear-btn');
  if (clearBtn) {
    if (rawQ) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  renderAddEligibleCandidateResults(rawQ);
};

function renderAddEligibleCandidateResults(query = '') {
  const tbody = document.getElementById('add-eligible-students-tbody');
  const countLabel = document.getElementById('add-eligible-search-count');
  if (!tbody) return;

  const rawQ = String(query || '').trim();
  const qLower = rawQ.toLowerCase();
  const qNorm = removeVietnameseTones(rawQ);

  const allRows = state.facultyStudents || [];
  let matches = [];

  if (!rawQ) {
    matches = allRows.slice(0, 40);
  } else {
    matches = allRows.filter(s => {
      const mssvMatch = s.mssv && s.mssv.toLowerCase().includes(qLower);
      const nameMatch = removeVietnameseTones(s.fullName || s.name).includes(qNorm);
      const classMatch = removeVietnameseTones(s.className || s.studentClass).includes(qNorm);
      const majorMatch = removeVietnameseTones(s.major).includes(qNorm);
      return mssvMatch || nameMatch || classMatch || majorMatch;
    }).slice(0, 60);
  }

  state.currentCandidateMatches = matches;

  if (countLabel) {
    countLabel.textContent = rawQ
      ? `Tìm thấy ${matches.length} sinh viên phù hợp`
      : `Hiển thị ${matches.length} sinh viên (Gõ để tìm kiếm...)`;
  }

  if (matches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-400 font-medium">Không tìm thấy sinh viên nào phù hợp trong SV Khoa.</td></tr>';
    updateAddEligibleSelectionUI();
    return;
  }

  const currentSet = new Set(
    (state.roundModalEligibleStudents || []).map(x => String(x.studentId || x.mssv || '').trim().toUpperCase())
  );

  tbody.innerHTML = matches.map(s => {
    const cleanMssv = String(s.mssv || '').trim().toUpperCase();
    const isAlreadyInRound = currentSet.has(cleanMssv);
    const isChecked = state.selectedEligibleCandidates.has(cleanMssv);

    return `
      <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${isAlreadyInRound ? 'bg-slate-50/60 opacity-60' : ''}">
        <td class="p-2.5 text-center">
          ${isAlreadyInRound
            ? '<input type="checkbox" disabled class="rounded text-slate-300 cursor-not-allowed">'
            : `<input type="checkbox" ${isChecked ? 'checked' : ''} onchange="onCandidateCheckboxChange('${cleanMssv}', this.checked)" class="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer">`
          }
        </td>
        <td class="p-2.5 font-mono font-bold text-slate-900">${cleanMssv}</td>
        <td class="p-2.5 font-bold text-slate-800">${s.fullName || s.name}</td>
        <td class="p-2.5 text-slate-600">${s.major || '--'}</td>
        <td class="p-2.5 font-mono text-slate-600">${s.className || s.studentClass || '--'}</td>
        <td class="p-2.5 text-center">
          ${isAlreadyInRound
            ? '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">Đã có trong đợt</span>'
            : isChecked
              ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Đang chọn</span>'
              : '<span class="px-2 py-0.5 rounded text-[11px] text-slate-400">Chưa thêm</span>'
          }
        </td>
      </tr>
    `;
  }).join('');

  updateAddEligibleSelectionUI();
}

window.onCandidateCheckboxChange = function(mssv, isChecked) {
  const cleanMssv = String(mssv || '').trim().toUpperCase();
  if (isChecked) {
    state.selectedEligibleCandidates.add(cleanMssv);
  } else {
    state.selectedEligibleCandidates.delete(cleanMssv);
  }
  updateAddEligibleSelectionUI();
};

window.toggleSelectAllEligibleCandidates = function(isChecked) {
  const currentSet = new Set(
    (state.roundModalEligibleStudents || []).map(x => String(x.studentId || x.mssv || '').trim().toUpperCase())
  );

  (state.currentCandidateMatches || []).forEach(s => {
    const cleanMssv = String(s.mssv || '').trim().toUpperCase();
    if (!currentSet.has(cleanMssv)) {
      if (isChecked) {
        state.selectedEligibleCandidates.add(cleanMssv);
      } else {
        state.selectedEligibleCandidates.delete(cleanMssv);
      }
    }
  });

  // Re-render table checkboxes to reflect change
  const query = document.getElementById('add-eligible-student-search-input')?.value || '';
  renderAddEligibleCandidateResults(query);
};

function updateAddEligibleSelectionUI() {
  const selectedCount = state.selectedEligibleCandidates.size;
  const selectedCountEl = document.getElementById('add-eligible-selected-count');
  const confirmBtn = document.getElementById('btn-confirm-add-eligible-students');
  const selectAll = document.getElementById('select-all-eligible-candidates');

  if (selectedCountEl) {
    selectedCountEl.textContent = `Đã chọn: ${selectedCount} SV`;
  }

  if (confirmBtn) {
    confirmBtn.disabled = selectedCount === 0;
    confirmBtn.textContent = `Thêm ${selectedCount} sinh viên đã chọn vào đợt`;
  }

  // Check if all selectable matches are checked
  if (selectAll && state.currentCandidateMatches && state.currentCandidateMatches.length > 0) {
    const currentSet = new Set(
      (state.roundModalEligibleStudents || []).map(x => String(x.studentId || x.mssv || '').trim().toUpperCase())
    );
    const selectable = state.currentCandidateMatches.filter(s => !currentSet.has(String(s.mssv || '').trim().toUpperCase()));
    if (selectable.length > 0 && selectable.every(s => state.selectedEligibleCandidates.has(String(s.mssv || '').trim().toUpperCase()))) {
      selectAll.checked = true;
    } else {
      selectAll.checked = false;
    }
  }
}

window.addSelectedEligibleCandidatesToRound = function() {
  if (state.selectedEligibleCandidates.size === 0) return;

  const currentList = state.roundModalEligibleStudents || [];
  const currentMssvSet = new Set(
    currentList.map(s => String(s.studentId || s.mssv || '').trim().toUpperCase())
  );

  let addedCount = 0;
  for (const mssv of state.selectedEligibleCandidates) {
    const cleanMssv = String(mssv || '').trim().toUpperCase();
    if (!currentMssvSet.has(cleanMssv)) {
      const s = (state.facultyStudents || []).find(x => String(x.mssv || '').trim().toUpperCase() === cleanMssv) ||
                (window.getFacultyStudent ? window.getFacultyStudent(cleanMssv) : null);
      if (s && !s.notFoundInMaster) {
        const fullName = s.fullName || s.name || '';
        const className = s.className || s.studentClass || '';
        currentList.push({
          studentId: cleanMssv,
          mssv: cleanMssv,
          name: fullName,
          fullName: fullName,
          gender: s.gender || '',
          major: s.major || '',
          className: className,
          studentClass: className,
          email: s.email || `${cleanMssv.toLowerCase()}@student.tdtu.edu.vn`,
          phone: s.phone || '',
          eligible: true
        });
        currentMssvSet.add(cleanMssv);
        addedCount++;
      }
    }
  }

  state.roundModalEligibleStudents = currentList;
  closeAddEligibleStudentModal();
  renderRoundModalEligibleTable();
  updateRoundModalBadges();
  showToast(`✓ Đã thêm thành công ${addedCount} sinh viên vào đợt!`, 'success');
};

// ----------------------------------------------------------------------------
// EXCEL IMPORT FOR ROUND ELIGIBLE STUDENTS
// ----------------------------------------------------------------------------