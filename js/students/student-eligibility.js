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
window.handleRoundEligibleUpload = async function(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      showToast('File Excel rỗng.', 'error');
      return;
    }

    const keys = Object.keys(rawRows[0]);
    const cleanHeader = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const findKey = (...aliases) => keys.find(k => aliases.includes(cleanHeader(k)));

    const mssvKey = findKey('masv', 'maso', 'mssv', 'masinhvien', 'studentid');
    const fullNameKey = findKey('hoten', 'hovaten', 'fullname', 'name');
    const familyKey = findKey('holot', 'hodem', 'ho', 'familyname');
    const givenKey = findKey('ten', 'firstname');
    const genderKey = findKey('gioitinh', 'phai', 'gender');
    const majorKey = findKey('nganh', 'nganhhoc', 'chuyennganh', 'major');
    const classKey = findKey('lop', 'lophoc', 'lopquanly', 'class');
    const emailKey = findKey('email', 'thudientu', 'mail');
    const phoneKey = findKey('sodienthoai', 'dienthoai', 'sdt', 'phone');

    if (!mssvKey) {
      showToast('File cần có cột MSSV (Mã SV / Mã số).', 'error');
      return;
    }

    // Ensure Faculty dataset is loaded to resolve names if file only has MSSV
    if (typeof ensureFacultyDatasetLoaded === 'function') {
      await ensureFacultyDatasetLoaded().catch(() => []);
    }

    let addedCount = 0;
    const existingMssv = new Set(
      (state.roundModalEligibleStudents || []).map(s => String(s.studentId || s.mssv || '').trim().toUpperCase())
    );

    rawRows.forEach(row => {
      const rawMssv = String(row[mssvKey] || '').trim().toUpperCase();
      if (!rawMssv || rawMssv.length < 5 || existingMssv.has(rawMssv)) return;

      let fileFullName = '';
      if (fullNameKey && String(row[fullNameKey] || '').trim()) {
        fileFullName = String(row[fullNameKey]).trim();
      } else {
        const fam = familyKey ? String(row[familyKey] || '').trim() : '';
        const giv = givenKey ? String(row[givenKey] || '').trim() : '';
        fileFullName = [fam, giv].filter(Boolean).join(' ');
      }
      fileFullName = fileFullName.replace(/\s+/g, ' ');

      // Strictly prevent using MSSV as full name
      const validFileFullName = (fileFullName && fileFullName !== rawMssv) ? fileFullName : '';

      // Look up student from Faculty Master
      const master = window.getFacultyStudent ? window.getFacultyStudent(rawMssv) : null;
      const isFoundInMaster = master && !master.notFoundInMaster;

      const finalName = validFileFullName || (isFoundInMaster ? (master.fullName || master.name || '') : '');
      const finalGender = (genderKey && String(row[genderKey] || '').trim()) || (isFoundInMaster ? (master.gender || '') : '');
      const finalMajor = (majorKey && String(row[majorKey] || '').trim()) || (isFoundInMaster ? (master.major || '') : '');
      const rawClass = (classKey && String(row[classKey] || '').trim());
      const finalClass = rawClass || (isFoundInMaster ? (master.className || master.studentClass || '') : '');
      let rawEmail = emailKey ? String(row[emailKey] || '').trim().toLowerCase() : '';
      if (!rawEmail || rawEmail.includes('undefined')) {
        rawEmail = (isFoundInMaster && master.email) ? master.email : `${rawMssv.toLowerCase()}@student.tdtu.edu.vn`;
      }
      const finalPhone = (phoneKey && String(row[phoneKey] || '').trim()) || (isFoundInMaster ? (master.phone || '') : '');

      state.roundModalEligibleStudents.push({
        studentId: rawMssv,
        mssv: rawMssv,
        name: finalName,
        fullName: finalName,
        gender: finalGender,
        major: finalMajor,
        className: finalClass,
        studentClass: finalClass,
        email: rawEmail,
        phone: finalPhone,
        eligible: true
      });

      existingMssv.add(rawMssv);
      addedCount++;
    });

    renderRoundModalEligibleTable();
    updateRoundModalBadges();
    showToast(`✓ Đã thêm ${addedCount} sinh viên đủ điều kiện vào đợt!`, 'success');
  } catch (err) {
    showToast('Lỗi đọc file: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
};


// --- ADMIN: ELIGIBLE STUDENTS (EXCEL PARSING & BATCH IMPORT) ---
window.loadAdminEligibleStudents = async function(roundId) {
  try {
    if (typeof loadFacultyDatasetFromIFAA === 'function' && !state.facultyStudentsLoaded) {
      loadFacultyDatasetFromIFAA().then(() => {
        if (state.eligibleStudentDetails?.roundId === roundId) renderAdminEligibleStudentsTable();
      }).catch(err => console.warn('[EligibleStudents] Faculty dataset load notice:', err));
    }
    const [eligibleSnap, registrationSnap, assignmentSnap, draftSnap] = await Promise.all([
      getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents')),
      getDocs(collection(db, 'graduationRounds', roundId, 'registrations')),
      getDocs(collection(db, 'graduationRounds', roundId, 'officialAssignments')),
      getDocs(collection(db, 'graduationRounds', roundId, 'assignmentDrafts'))
    ]);
    if (document.getElementById('admin-round-student-select')?.value !== roundId) return;
    state.eligibleStudents = eligibleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.eligibleStudentDetails = {
      roundId,
      registrations: new Map(registrationSnap.docs.map(d => [d.id.toUpperCase(), d.data()])),
      assignments: new Map(assignmentSnap.docs.map(d => [d.id.toUpperCase(), d.data()])),
      drafts: new Map(draftSnap.docs.map(d => [d.id.toUpperCase(), d.data()]))
    };
    renderAdminEligibleStudentsTable();
  } catch (e) {
    console.error('Error loading eligible students:', e);
  }
};

function renderAdminEligibleStudentsTable() {
  const tbody = document.getElementById('admin-eligible-students-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('search-eligible-input')?.value || '').toLowerCase().trim();
  const roundId = state.eligibleStudentDetails?.roundId;
  const round = (state.rounds || []).find(item => item.id === roundId);
  const directAssignment = isDirectSupervisorAssignment(round);
  const details = state.eligibleStudentDetails;

  // Merge each eligible record with Faculty Student Master
  const mergedList = (state.eligibleStudents || []).map(s => {
    const rawMssv = s.studentId || s.mssv || s.id || '';
    const mssv = String(rawMssv).trim().replace(/\s+/g, '').toUpperCase();
    const master = (typeof window.getFacultyStudentByMssv === 'function') ? window.getFacultyStudentByMssv(mssv) : null;
    const isFoundInMaster = Boolean(master && !master.notFoundInMaster && master.name);

    let displayName = '';
    let displayEmail = '';
    let displayClass = '';
    let displayMajor = '';
    let isMissingInfo = false;

    if (isFoundInMaster) {
      displayName = master.fullName || master.name;
      displayEmail = master.email || `${mssv.toLowerCase()}@student.tdtu.edu.vn`;
      displayClass = master.className || master.studentClass || 'Chưa có thông tin';
      displayMajor = master.major || 'Thiết kế Nội thất';
    } else {
      // Fallback to snapshot in eligible record
      const rawName = String(s.name || s.fullName || s.studentName || '').trim();
      if (rawName && rawName !== mssv && !rawName.startsWith('Sinh viên ' + mssv)) {
        displayName = rawName;
      } else {
        displayName = '<span class="text-slate-400 italic">Chưa có thông tin</span>';
        isMissingInfo = true;
      }
      displayEmail = s.email || (mssv ? `${mssv.toLowerCase()}@student.tdtu.edu.vn` : '<span class="text-slate-400 italic">Chưa có thông tin</span>');
      displayClass = s.className || s.studentClass || s.class || '<span class="text-slate-400 italic">Chưa có thông tin</span>';
      displayMajor = s.major || 'Thiết kế Nội thất';
    }

    return {
      ...s,
      mssv,
      studentId: mssv,
      resolvedName: displayName,
      resolvedEmail: displayEmail,
      resolvedClass: displayClass,
      resolvedMajor: displayMajor,
      isFoundInMaster,
      isMissingInfo
    };
  });

  const getStudentStatus = student => {
    const registration = details?.registrations.get(student.studentId) || null;
    const published = details?.assignments.get(student.studentId) || null;
    const draft = details?.drafts.get(student.studentId) || null;
    const effective = normalizeOfficialAssignment(
      published?.assignmentStatus === 'published' ? published : (draft || published), registration
    );
    const supervisors = getOfficialSupervisors(effective);
    const names = supervisors.map(item => item.supervisorName || item.name || '').filter(Boolean);
    if (!names.length) {
      const fallback = effective?.acceptedSupervisorName || effective?.assignedSupervisorName || effective?.supervisorName || registration?.acceptedSupervisorName;
      if (fallback) names.push(fallback);
    }
    const topic = String(registration?.topicTitle || registration?.topic || '').trim();
    const preferences = !directAssignment && !names.length && Array.isArray(registration?.preferences)
      ? registration.preferences.slice().sort((a, b) => Number(a.rank) - Number(b.rank))
        .map(pref => `NV${pref.rank}: ${pref.supervisorName || pref.name || ''}`).filter(item => !item.endsWith(': '))
      : [];
    return { topic, names, preferences };
  };

  const filtered = mergedList.filter(s => {
    if (!searchTerm) return true;
    const nameText = typeof s.resolvedName === 'string' ? s.resolvedName.replace(/<[^>]*>/g, '').toLowerCase() : '';
    const status = getStudentStatus(s);
    return (s.studentId || '').toLowerCase().includes(searchTerm) ||
      nameText.includes(searchTerm) ||
      status.topic.toLowerCase().includes(searchTerm) ||
      status.names.join(' ').toLowerCase().includes(searchTerm) ||
      status.preferences.join(' ').toLowerCase().includes(searchTerm) ||
      (s.resolvedClass || '').toLowerCase().includes(searchTerm);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400 font-medium">Chưa có dữ liệu sinh viên trong đợt này. Tải file Excel lên để nhập danh sách.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const status = getStudentStatus(s);
    const supervisorLine = status.names.length
      ? `<div class="mt-1 text-[11px] text-emerald-700"><b>GVHD:</b> ${escapeHtml(status.names.join(' · '))}</div>`
      : (status.preferences.length
        ? `<div class="mt-1 text-[11px] text-slate-600">${status.preferences.map(escapeHtml).join(' · ')}</div>`
        : (directAssignment ? '<div class="mt-1 text-[11px] text-slate-500">GVHD: Chưa phân công</div>' : ''));
    return `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-3 font-mono font-bold text-slate-900">${escapeHtml(s.studentId)}</td>
      <td class="p-3">
        <div class="font-bold text-slate-800">${s.isMissingInfo ? s.resolvedName : escapeHtml(s.resolvedName)}</div>
        ${!s.isFoundInMaster && !s.isMissingInfo ? '<span class="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-500">Từ file nhập</span>' : ''}
      </td>
      <td class="p-3 min-w-[260px]"><div class="font-bold ${status.topic ? 'text-blue-900' : 'text-slate-500 italic'}">${status.topic ? escapeHtml(status.topic) : 'Sinh viên chưa đăng ký đề tài'}</div>${supervisorLine}</td>
      <td class="p-3 font-mono text-slate-700">${String(s.resolvedClass).includes('<span') ? s.resolvedClass : escapeHtml(s.resolvedClass)}</td>
      <td class="p-3 text-slate-700">${escapeHtml(s.resolvedMajor)}</td>
      <td class="p-3"><span class="badge badge-open">Đủ ĐK</span></td>
      <td class="p-3 text-right">
        <button type="button" onclick="deleteEligibleStudent('${s.studentId}')" class="text-rose-600 hover:underline font-bold text-xs cursor-pointer">Xóa</button>
      </td>
    </tr>
  `;
  }).join('');
}

window.filterEligibleTable = function() {
  renderAdminEligibleStudentsTable();
};

window.deleteEligibleStudent = async function(studentId) {
  const roundId = document.getElementById('admin-round-student-select')?.value || state.selectedRoundId;
  if (!roundId) return;
  const normalizedId = String(studentId || '').trim().toUpperCase();
  if (!(await showConfirm('Xóa sinh viên', `Xóa sinh viên ${normalizedId} và toàn bộ thông tin đăng ký, đề tài, phân công khỏi đợt này?`, { confirmText: 'Xóa toàn bộ', danger: true }))) return;
  try {
    const deleteTasks = [
      deleteDoc(doc(db, 'graduationRounds', roundId, 'eligibleStudents', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'registrations', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'officialAssignments', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'assignmentDrafts', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'reviewDecisions', normalizedId)),
      deleteDoc(doc(db, 'graduationRounds', roundId, 'councilScores', normalizedId)),
      deleteDoc(doc(db, 'graduationStudentProfiles', normalizedId))
    ];

    try {
      const subSnap = await getDocs(query(collection(db, 'graduationRounds', roundId, 'submissions'), where('studentId', '==', normalizedId)));
      subSnap.forEach(d => {
        deleteTasks.push(deleteDoc(d.ref));
      });
    } catch (subErr) {}

    await Promise.allSettled(deleteTasks);

    showToast(`✓ Đã xóa sinh viên ${normalizedId} và toàn bộ dữ liệu đã nhập khỏi đợt.`, 'success');
    await loadAdminEligibleStudents(roundId);
    await refreshRoundCardMetrics(roundId);
    if (typeof loadSupervisorPortalData === 'function' && (state.selectedRoundId === roundId || state.activeRound?.id === roundId)) {
      loadSupervisorPortalData(roundId);
    }
  } catch (e) {
    showToast('Lỗi xóa: ' + e.message, 'error');
  }
};

// Add one supplementary student without requiring an Excel import.  The
// authoritative profile is always resolved from the Faculty Student Master,
// so a manually-added row has the same data shape as an imported student.
window.addEligibleStudentByMssv = async function() {
  const input = document.getElementById('quick-add-eligible-mssv');
  const rawMssv = String(input?.value || '').trim().replace(/\s+/g, '').toUpperCase();
  const roundId = document.getElementById('admin-round-student-select')?.value;

  if (!roundId) {
    showToast('Vui lòng chọn đợt tốt nghiệp trước khi thêm sinh viên.', 'warning');
    return;
  }
  if (!rawMssv) {
    showToast('Nhập MSSV sinh viên cần bổ sung.', 'warning');
    input?.focus();
    return;
  }
  if (!/^[A-Z0-9_-]+$/.test(rawMssv)) {
    showToast('MSSV chỉ gồm chữ cái, chữ số, dấu gạch nối hoặc gạch dưới.', 'warning');
    return;
  }

  try {
    if (typeof ensureFacultyDatasetLoaded === 'function') {
      await ensureFacultyDatasetLoaded();
    } else if (typeof loadFacultyDatasetFromIFAA === 'function' && !state.facultyStudentsLoaded) {
      await loadFacultyDatasetFromIFAA();
    }

    const master = typeof window.getFacultyStudentByMssv === 'function'
      ? window.getFacultyStudentByMssv(rawMssv)
      : (state.facultyStudents || []).find(s => String(s.mssv || s.studentId || '').trim().toUpperCase() === rawMssv);
    if (!master || master.notFoundInMaster || !(master.fullName || master.name)) {
      showToast(`Không tìm thấy MSSV ${rawMssv} trong dữ liệu sinh viên Khoa.`, 'error');
      return;
    }

    const studentRef = doc(db, 'graduationRounds', roundId, 'eligibleStudents', rawMssv);
    const existing = await getDoc(studentRef);
    if (existing.exists()) {
      showToast(`Sinh viên ${rawMssv} đã có trong đợt này.`, 'warning');
      return;
    }

    // A student removed from the round configuration may still have records
    // created before that removal.  Never silently reuse those records when
    // the student is added again: the operator explicitly chooses whether to
    // clear the old topic and supervisor assignment for this round.
    const [oldRegistration, oldOfficialAssignment, oldDraftAssignment] = await Promise.all([
      getDoc(doc(db, 'graduationRounds', roundId, 'registrations', rawMssv)),
      getDoc(doc(db, 'graduationRounds', roundId, 'officialAssignments', rawMssv)),
      getDoc(doc(db, 'graduationRounds', roundId, 'assignmentDrafts', rawMssv))
    ]);
    if (oldRegistration.exists() || oldOfficialAssignment.exists() || oldDraftAssignment.exists()) {
      const shouldReset = await showConfirm(
        'Dữ liệu cũ của sinh viên',
        `MSSV ${rawMssv} vẫn còn thông tin đăng ký hoặc phân công từ lần trước. Xóa dữ liệu cũ để thêm lại sinh viên với trạng thái mới?`,
        { confirmText: 'Xóa dữ liệu cũ & thêm lại', danger: true }
      );
      if (!shouldReset) return;
      const cleanupResults = await Promise.allSettled([
        deleteDoc(doc(db, 'graduationRounds', roundId, 'registrations', rawMssv)),
        deleteDoc(doc(db, 'graduationRounds', roundId, 'officialAssignments', rawMssv)),
        deleteDoc(doc(db, 'graduationRounds', roundId, 'assignmentDrafts', rawMssv)),
        deleteDoc(doc(db, 'graduationRounds', roundId, 'reviewDecisions', rawMssv))
      ]);
      if (cleanupResults.some(result => result.status === 'rejected')) {
        throw new Error('Không thể xóa đầy đủ dữ liệu cũ của sinh viên.');
      }
    }

    const fullName = master.fullName || master.name;
    const className = master.className || master.studentClass || '';
    await setDoc(studentRef, {
      studentId: rawMssv,
      mssv: rawMssv,
      name: fullName,
      fullName,
      email: master.email || `${rawMssv.toLowerCase()}@student.tdtu.edu.vn`,
      className,
      studentClass: className,
      major: master.major || 'Thiết kế Nội thất',
      eligible: true,
      source: 'manual_supplement',
      createdAt: serverTimestamp()
    });

    if (input) input.value = '';
    showToast(`Đã thêm ${fullName} (${rawMssv}) vào đợt.`, 'success');
    await loadAdminEligibleStudents(roundId);
    await refreshRoundCardMetrics(roundId);
  } catch (e) {
    console.error('Quick add eligible student failed:', e);
    showToast('Không thể thêm sinh viên: ' + e.message, 'error');
  }
};

window.handleExcelFileUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('excel-filename').textContent = file.name;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      parseAndValidateExcel(rawRows);
    } catch (err) {
      showToast('Không đọc được file Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
};

function parseAndValidateExcel(rows) {
  if (!rows || rows.length < 2) {
    showToast('File Excel rỗng hoặc thiếu tiêu đề cột.', 'warning');
    return;
  }

  // Find header indices
  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  let mssvIdx = header.findIndex(h => h.includes('mssv') || h.includes('mã số') || h.includes('student'));
  let nameIdx = header.findIndex(h => h.includes('họ') || h.includes('tên') || h.includes('name'));
  let emailIdx = header.findIndex(h => h.includes('email') || h.includes('thư điện tử'));
  let classIdx = header.findIndex(h => h.includes('lớp') || h.includes('class'));
  let majorIdx = header.findIndex(h => h.includes('ngành') || h.includes('major'));

  if (mssvIdx === -1) mssvIdx = 0;
  if (nameIdx === -1) nameIdx = 1;

  const existingMssvSet = new Set(state.eligibleStudents.map(s => s.studentId));
  const seenInFile = new Set();
  const staging = [];

  let validCount = 0;
  let invalidCount = 0;
  let dupCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const rawMssv = String(r[mssvIdx] || '').trim().toUpperCase();
    const rawName = String(r[nameIdx] || '').trim();
    let rawEmail = emailIdx !== -1 ? String(r[emailIdx] || '').trim().toLowerCase() : '';
    const rawClass = classIdx !== -1 ? String(r[classIdx] || '').trim() : '';
    const rawMajor = majorIdx !== -1 ? String(r[majorIdx] || '').trim() : 'Thiết kế Nội thất';

    if (!rawMssv) {
      invalidCount++;
      continue;
    }

    if (!rawEmail) {
      rawEmail = `${rawMssv.toLowerCase()}@student.tdtu.edu.vn`;
    }

    const isDupInFile = seenInFile.has(rawMssv);
    const isDupInDb = existingMssvSet.has(rawMssv);

    if (isDupInFile || isDupInDb) {
      dupCount++;
    } else {
      validCount++;
    }
    seenInFile.add(rawMssv);

    staging.push({
      studentId: rawMssv,
      name: rawName,
      email: rawEmail,
      className: rawClass,
      major: rawMajor,
      isDup: isDupInFile || isDupInDb,
      isValid: Boolean(rawMssv)
    });
  }

  state.excelStaging = staging;

  document.getElementById('excel-stat-valid').textContent = validCount;
  document.getElementById('excel-stat-invalid').textContent = invalidCount;
  document.getElementById('excel-stat-duplicate').textContent = dupCount;

  // Render preview snippet
  const tbody = document.getElementById('excel-preview-tbody');
  tbody.innerHTML = staging.slice(0, 15).map(s => `
    <tr class="hover:bg-slate-50">
      <td class="p-2 font-mono font-bold text-slate-800">${s.studentId}</td>
      <td class="p-2 font-medium">${s.name}</td>
      <td class="p-2 text-slate-500 text-[11px]">${s.email}</td>
      <td class="p-2">${s.className}</td>
      <td class="p-2">${s.major}</td>
      <td class="p-2">
        ${s.isDup ? '<span class="text-amber-600 font-bold">Trùng</span>' : '<span class="text-emerald-600 font-bold">Hợp lệ</span>'}
      </td>
    </tr>
  `).join('');

  document.getElementById('excel-preview-card').classList.remove('hidden');
}

window.cancelExcelImport = function() {
  state.excelStaging = [];
  document.getElementById('excel-preview-card').classList.add('hidden');
  document.getElementById('excel-file-input').value = '';
};

window.confirmExcelImport = async function() {
  const roundId = document.getElementById('admin-round-student-select').value;
  if (!roundId || state.excelStaging.length === 0) return;

  const mode = document.querySelector('input[name="excel-import-mode"]:checked')?.value || 'append';
  const existingSet = new Set(state.eligibleStudents.map(s => s.studentId));

  const itemsToImport = state.excelStaging.filter(s => {
    if (!s.isValid) return false;
    if (mode === 'skip' && existingSet.has(s.studentId)) return false;
    return true;
  });

  if (itemsToImport.length === 0) {
    showToast('Không có sinh viên nào cần import theo tùy chọn đã chọn.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-confirm-excel-import');
  btn.disabled = true;
  btn.textContent = '⏳ Đang lưu vào Firestore...';

  try {
    // Process in batches of 400
    const chunkSize = 400;
    for (let i = 0; i < itemsToImport.length; i += chunkSize) {
      const chunk = itemsToImport.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach(s => {
        const ref = doc(db, 'graduationRounds', roundId, 'eligibleStudents', s.studentId);
        batch.set(ref, {
          studentId: s.studentId,
          name: s.name,
          email: s.email,
          className: s.className || '',
          major: s.major || 'Thiết kế Nội thất',
          eligible: true,
          createdAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
    }

    showToast(`Đã import thành công ${itemsToImport.length} sinh viên đủ điều kiện!`, 'info');
    cancelExcelImport();
    await loadAdminEligibleStudents(roundId);
    await refreshRoundCardMetrics(roundId);
  } catch (err) {
    showToast('Lỗi import Firestore: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Xác nhận Nhập vào Firestore';
  }
};


// --- ADMIN: REGISTRATIONS LIST & CSV EXPORT ---
window.loadAdminRegistrations = async function(roundId) {
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.currentAdminRegistrations = list;
    filterAdminRegistrationsTable();
  } catch (e) {
    console.error('Error loading registrations:', e);
  }
};

window.filterAdminRegistrationsTable = function() {
  const filter = document.getElementById('admin-reg-filter-status')?.value || 'all';
  const list = state.currentAdminRegistrations || [];
  let filtered = list;
  if (filter === 'eligible') {
    filtered = list.filter(r => r.eligibilityStatus === 'eligible' || (!r.eligibilityStatus && r.status === 'submitted'));
  } else if (filter === 'pending') {
    filtered = list.filter(r => r.eligibilityStatus === 'pending');
  } else if (filter === 'not_eligible') {
    filtered = list.filter(r => r.eligibilityStatus === 'not_eligible');
  }
  renderAdminRegistrationsTable(filtered);
};

function renderAdminRegistrationsTable(list) {
  const tbody = document.getElementById('admin-registrations-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="p-6 text-center text-slate-400">Không có nguyện vọng đăng ký nào phù hợp bộ lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const getSupName = rank => (r.preferences || []).find(p => p.rank === rank)?.supervisorName || '--';
    const subDate = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)) : null;

    let elBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Đủ ĐK</span>';
    if (r.eligibilityStatus === 'pending') {
      elBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Chờ nạp danh sách đủ điều kiện chính thức">Chờ xét</span>';
    } else if (r.eligibilityStatus === 'not_eligible') {
      elBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300" title="Không có trong danh sách đủ điều kiện">Không đủ ĐK</span>';
    }

    let reviewBadge = '<span class="text-slate-500 font-semibold text-xs">Chờ duyệt</span>';
    if (r.reviewStatus === 'accepted') {
      reviewBadge = '<span class="text-emerald-700 font-bold text-xs">✓ Đã tiếp nhận</span>';
    } else if (r.reviewStatus === 'rejected') {
      reviewBadge = '<span class="text-rose-600 font-bold text-xs">Chuyển NV sau</span>';
    }

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-mono font-bold text-slate-900">${r.studentId}</td>
        <td class="p-3.5 font-semibold text-slate-800">${r.studentName || '--'}</td>
        <td class="p-3.5 max-w-[200px] truncate font-bold text-blue-900" title="${r.topicTitle}">${r.topicTitle || '--'}</td>
        <td class="p-3.5 text-slate-600">${r.projectType || '--'}</td>
        <td class="p-3.5 font-bold text-slate-700">${getSupName(1)}</td>
        <td class="p-3.5 text-slate-600">${getSupName(2)}</td>
        <td class="p-3.5 text-slate-600">${getSupName(3)}</td>
        <td class="p-3.5 text-center">${elBadge}</td>
        <td class="p-3.5">${reviewBadge}</td>
        <td class="p-3.5 text-[11px] text-slate-400">${subDate ? subDate.toLocaleString('vi-VN') : '--'}</td>
      </tr>
    `;
  }).join('');
}

window.exportRegistrationsCSV = function() {
  const roundId = document.getElementById('admin-round-reg-select')?.value;
  if (!roundId) return;

  getDocs(collection(db, 'graduationRounds', roundId, 'registrations')).then(snap => {
    const list = snap.docs.map(d => d.data());
    if (list.length === 0) {
      showToast('Không có dữ liệu đăng ký để xuất.', 'warning');
      return;
    }

    const headers = ['MSSV', 'Họ và tên', 'Email', 'Tên đề tài', 'Loại hình đồ án', 'Nguyện vọng 1', 'Nguyện vọng 2', 'Nguyện vọng 3', 'Điều kiện', 'Trạng thái xét', 'Thời gian nộp'];
    const rows = list.map(r => {
      const getSup = rank => (r.preferences || []).find(p => p.rank === rank)?.supervisorName || '';
      const dt = r.submittedAt ? (r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt)).toLocaleString('vi-VN') : '';
      let elText = 'Đủ điều kiện';
      if (r.eligibilityStatus === 'pending') elText = 'Chờ xét';
      else if (r.eligibilityStatus === 'not_eligible') elText = 'Không đủ điều kiện';

      return [
        r.studentId || '',
        r.studentName || '',
        r.email || '',
        `"${(r.topicTitle || '').replace(/"/g, '""')}"`,
        `"${(r.projectType || '').replace(/"/g, '""')}"`,
        `"${getSup(1)}"`,
        `"${getSup(2)}"`,
        `"${getSup(3)}"`,
        `"${elText}"`,
        `"${r.reviewStatus || 'Chờ duyệt'}"`,
        dt
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DS_DangKy_DATN_${roundId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
};

window.applyOfficialEligibilityToRegistrations = async function() {
  const roundId = document.getElementById('admin-round-reg-select')?.value;
  if (!roundId) {
    showToast('Vui lòng chọn đợt tốt nghiệp cần áp dụng.', 'warning');
    return;
  }
  const round = state.rounds?.find(r => r.id === roundId) || state.activeRound;

  const btn = document.getElementById('btn-apply-official-eligibility');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Đang đối soát...</span>';
  }

  try {
    // 1. Fetch official eligible students subcollection
    const elSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'eligibleStudents'));
    if (elSnap.empty) {
      showToast('⚠️ Đợt này chưa có danh sách sinh viên đủ điều kiện chính thức. Vui lòng nạp danh sách SV tại Cấu hình Đợt trước.', 'warning', 6000);
      return;
    }
    const eligibleMap = new Set(elSnap.docs.filter(d => d.data().eligible !== false).map(d => d.id));

    // 2. Fetch all registrations of the round
    const regSnap = await getDocs(collection(db, 'graduationRounds', roundId, 'registrations'));
    if (regSnap.empty) {
      showToast('Đợt này chưa có sinh viên nào nộp đăng ký.', 'info');
      return;
    }

    let eligibleCount = 0;
    let notEligibleCount = 0;
    let unchangedCount = 0;

    // Process in batches of 450
    const docs = regSnap.docs;
    for (let offset = 0; offset < docs.length; offset += 450) {
      const batch = writeBatch(db);
      const chunk = docs.slice(offset, offset + 450);
      let batchOps = 0;

      chunk.forEach(docSnap => {
        const reg = docSnap.data();
        const studentId = docSnap.id;
        const isEligible = eligibleMap.has(studentId);
        const newStatus = isEligible ? 'eligible' : 'not_eligible';

        if (reg.eligibilityStatus !== newStatus) {
          batch.update(docSnap.ref, {
            eligibilityStatus: newStatus,
            eligibilityVerifiedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          batchOps++;
          if (isEligible) eligibleCount++;
          else notEligibleCount++;
        } else {
          unchangedCount++;
        }
      });

      if (batchOps > 0) {
        await batch.commit();
      }
    }

    // 3. Mark round as eligibilityFinalized: true
    await updateDoc(doc(db, 'graduationRounds', roundId), {
      eligibilityFinalized: true,
      updatedAt: serverTimestamp()
    }).catch(console.warn);

    if (round) {
      round.eligibilityFinalized = true;
    }

    showToast(`✓ Đã áp dụng DS đủ điều kiện thành công: ${eligibleCount} Đủ ĐK, ${notEligibleCount} Không đủ ĐK (Không xóa bất kỳ nguyện vọng nào)!`, 'success', 6000);
    await loadAdminRegistrations(roundId);
  } catch (err) {
    console.error('Lỗi khi áp dụng danh sách đủ điều kiện:', err);
    showToast('Lỗi khi áp dụng danh sách đủ điều kiện: ' + err.message, 'error', 5000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>⚖️ Áp dụng DS đủ điều kiện</span>';
    }
  }
};



// =========================================================================
// --- CENTRAL STUDENT RESOLVER FOR REGISTRATIONS & REVIEWS ---
// =========================================================================
window.resolveStudentName = function(sid, fallbackName = '') {
  if (!sid) return fallbackName || '--';
  const cleanId = String(sid).trim().toUpperCase();
  const raw = String(fallbackName || '').trim();
  if (raw && raw.toUpperCase() !== cleanId && !raw.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
    return raw;
  }

  // 1. Check eligibleStudents in review data or state
  const eligibleList = state.adminReviewData?.eligible || state.eligibleStudents || [];
  const el = eligibleList.find(e => {
    const eid = String(e.studentId || e.mssv || e.id || '').trim().toUpperCase();
    return eid === cleanId;
  });
  if (el) {
    const elName = String(el.fullName || el.name || el.studentName || '').trim();
    if (elName && elName.toUpperCase() !== cleanId && !elName.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
      return elName;
    }
  }

  // 2. Check IFAA central master lookup
  if (typeof window.getFacultyStudentByMssv === 'function') {
    const fac = window.getFacultyStudentByMssv(cleanId);
    if (fac) {
      const facName = String(fac.fullName || fac.name || '').trim();
      if (facName && facName.toUpperCase() !== cleanId && !facName.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
        return facName;
      }
    }
  }

  // 3. Check in-memory facultyStudents array
  if (Array.isArray(state.facultyStudents) && state.facultyStudents.length > 0) {
    const inFac = state.facultyStudents.find(s => {
      const sId = String(s.mssv || s.studentId || s.studentCode || '').trim().toUpperCase();
      return sId === cleanId;
    });
    if (inFac) {
      const fn = String(inFac.fullName || inFac.name || inFac.hoTen || '').trim();
      if (fn && fn.toUpperCase() !== cleanId && !fn.toUpperCase().startsWith('SINH VIÊN ' + cleanId)) {
        return fn;
      }
    }
  }

  return raw || cleanId;
};


// ============================================================================
// ADMIN: DANH SÁCH SINH VIÊN KHOA (MASTER DATASET - IFAA MECHANISM)
// ============================================================================

// Standard Majors
const FACULTY_MAJORS = [
  'Thiết kế nội thất',
  'Thiết kế đồ họa',
  'Thiết kế thời trang',
  'Thiết kế công nghiệp',
  'Nghệ thuật số'
];

// ============================================================================

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof removeVietnameseTones !== 'undefined') window.removeVietnameseTones = removeVietnameseTones;
  if (typeof renderRoundModalEligibleTable !== 'undefined') window.renderRoundModalEligibleTable = renderRoundModalEligibleTable;
  if (typeof renderAddEligibleCandidateResults !== 'undefined') window.renderAddEligibleCandidateResults = renderAddEligibleCandidateResults;
  if (typeof updateAddEligibleSelectionUI !== 'undefined') window.updateAddEligibleSelectionUI = updateAddEligibleSelectionUI;
  if (typeof renderAdminEligibleStudentsTable !== 'undefined') window.renderAdminEligibleStudentsTable = renderAdminEligibleStudentsTable;
  if (typeof parseAndValidateExcel !== 'undefined') window.parseAndValidateExcel = parseAndValidateExcel;
  if (typeof renderAdminRegistrationsTable !== 'undefined') window.renderAdminRegistrationsTable = renderAdminRegistrationsTable;
  if (typeof cleanHeader !== 'undefined') window.cleanHeader = cleanHeader;
  if (typeof findKey !== 'undefined') window.findKey = findKey;
  if (typeof getStudentStatus !== 'undefined') window.getStudentStatus = getStudentStatus;
  if (typeof getSupName !== 'undefined') window.getSupName = getSupName;
  if (typeof getSup !== 'undefined') window.getSup = getSup;
}
