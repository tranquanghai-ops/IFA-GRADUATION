
// --- Module Bridges ---
const getOfficialSupervisors = (reg) => (typeof window !== 'undefined' && window.getOfficialSupervisors ? window.getOfficialSupervisors(reg) : []);
const normalizeOfficialAssignment = (a, r) => (typeof window !== 'undefined' && window.normalizeOfficialAssignment ? window.normalizeOfficialAssignment(a, r) : (a || r));
const isDirectSupervisorAssignment = (rnd) => (typeof window !== 'undefined' && window.isDirectSupervisorAssignment ? window.isDirectSupervisorAssignment(rnd) : false);
/**
 * IFA+ Graduation — Admin Eligible Students Management & Excel Import
 */
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
    if (typeof window.loadUserActivities === 'function') {
      await window.loadUserActivities().catch(() => {});
    }
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
    tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400 font-medium">Chưa có dữ liệu sinh viên trong đợt này. Tải file Excel lên để nhập danh sách.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const status = getStudentStatus(s);
    const supervisorLine = status.names.length
      ? `<div class="mt-1 text-[11px] text-emerald-700"><b>GVHD:</b> ${escapeHtml(status.names.join(' · '))}</div>`
      : (status.preferences.length
        ? `<div class="mt-1 text-[11px] text-slate-600">${status.preferences.map(escapeHtml).join(' · ')}</div>`
        : (directAssignment ? '<div class="mt-1 text-[11px] text-slate-500">GVHD: Chưa phân công</div>' : ''));
    
    const activityBadge = typeof window.renderUserActivityBadge === 'function'
      ? window.renderUserActivityBadge(s.studentId)
      : '<span class="text-slate-400 text-xs">--</span>';

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
      <td class="p-3 whitespace-nowrap">${activityBadge}</td>
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