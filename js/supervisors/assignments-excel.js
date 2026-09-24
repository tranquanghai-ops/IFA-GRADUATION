/**
 * IFA+ Graduation — Supervisor Assignment Excel Import/Export Submodule
 */
// ============================================================================
// ADMIN OFFICIAL & SUPPORT SUPERVISORS MANAGEMENT TABLE (v1.6.0-beta.3)
// ============================================================================
window.exportSupervisorAssignmentsExcel = function() {
  if (typeof window.XLSX === 'undefined') {
    showToast('Thư viện Excel chưa được tải.', 'error');
    return;
  }
  const rows = getAdminAssignmentRows();
  if (rows.length === 0) {
    showToast('Đợt chưa có sinh viên đủ điều kiện để xuất.', 'warning');
    return;
  }

  const data = [[
    'STT', 'MSSV', 'Họ và tên', 'Ngành', 'Lớp', 'Tên đề tài', 'Trạng thái đăng ký',
    'Email GVHD 1', 'Tên GVHD 1', 'Email GVHD 2', 'Tên GVHD 2'
  ]];
  rows.forEach((row, index) => {
    const master = typeof window.getFacultyStudentByMssv === 'function' ? window.getFacultyStudentByMssv(row.studentId) : null;
    const officials = getOfficialSupervisors(row.effective);
    const primary = officials.find(item => item.role === 'primary') || officials[0] || {};
    const support = officials.find(item => item.role === 'support') || {};
    data.push([
      index + 1,
      sanitizeExcelCell(row.studentId),
      sanitizeExcelCell(master?.fullName || master?.name || resolveStudentName(row.studentId, row.effective?.studentName)),
      sanitizeExcelCell(master?.major || row.eligibleStudent?.major || ''),
      sanitizeExcelCell(master?.className || master?.studentClass || ''),
      sanitizeExcelCell(row.registration?.topicTitle || 'Chưa đăng ký đề tài'),
      row.isRegistered ? 'Đã đăng ký' : 'Chưa đăng ký',
      sanitizeExcelCell(primary.supervisorEmail || ''),
      sanitizeExcelCell(primary.supervisorName || ''),
      sanitizeExcelCell(support.supervisorEmail || ''),
      sanitizeExcelCell(support.supervisorName || '')
    ]);
  });

  const workbook = window.XLSX.utils.book_new();
  const worksheet = window.XLSX.utils.aoa_to_sheet(data);
  worksheet['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 24 }, { wch: 14 }, { wch: 45 }, { wch: 20 }, { wch: 30 }, { wch: 28 }, { wch: 30 }, { wch: 28 }];
  window.XLSX.utils.book_append_sheet(workbook, worksheet, 'PHAN_CONG_GVHD');
  const roundCode = state.activeRound?.shortCode || state.activeRound?.slug || state.selectedRoundId || 'ROUND';
  window.XLSX.writeFile(workbook, `PHAN_CONG_GVHD_${roundCode}.xlsx`);
  showToast(`Đã xuất ${rows.length} sinh viên ra Excel.`, 'success');
};

function normalizeAssignmentImportHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getAssignmentImportCell(row, aliases) {
  const aliasSet = new Set(aliases.map(normalizeAssignmentImportHeader));
  const key = Object.keys(row).find(item => aliasSet.has(normalizeAssignmentImportHeader(item)));
  return key ? row[key] : '';
}

window.handleSupervisorAssignmentExcel = function(event) {
  if (!ensureAssignmentEditingAllowed()) {
    event.target.value = '';
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = loadEvent => {
    try {
      const workbook = window.XLSX.read(new Uint8Array(loadEvent.target.result), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = window.XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      buildSupervisorAssignmentImportPreview(rawRows);
    } catch (error) {
      showToast('Không đọc được file Excel: ' + error.message, 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
};

function buildSupervisorAssignmentImportPreview(rawRows) {
  const allRows = getAdminAssignmentRows();
  const rowsByStudent = new Map(allRows.map(row => [row.studentId, row]));
  const supervisors = state.adminReviewData?.supervisors || [];
  const supervisorByEmail = new Map(supervisors.filter(s => s.email).map(s => [String(s.email).trim().toLowerCase(), s]));
  const seenStudents = new Map();

  const preview = rawRows.map((raw, index) => {
    const studentId = String(getAssignmentImportCell(raw, ['MSSV', 'Ma sinh vien', 'Student ID']) || '').trim().replace(/\s+/g, '').toUpperCase();
    const primaryEmail = String(getAssignmentImportCell(raw, ['Email GVHD 1', 'GVHD 1 Email', 'Primary Supervisor Email']) || '').trim().toLowerCase();
    const supportEmail = String(getAssignmentImportCell(raw, ['Email GVHD 2', 'GVHD 2 Email', 'Support Supervisor Email']) || '').trim().toLowerCase();
    const row = rowsByStudent.get(studentId);
    const errors = [];
    if (!studentId) errors.push('Thiếu MSSV');
    if (studentId && !row) errors.push('MSSV không thuộc Round');
    if (studentId) {
      if (seenStudents.has(studentId)) {
        errors.push(`MSSV trùng với dòng ${seenStudents.get(studentId)}`);
      } else {
        seenStudents.set(studentId, index + 2);
      }
    }

    const current = row ? getOfficialSupervisors(row.effective) : [];
    const currentPrimary = current.find(item => item.role === 'primary') || current[0] || null;
    const currentSupport = current.find(item => item.role === 'support') || null;
    const primary = primaryEmail ? supervisorByEmail.get(primaryEmail) : null;
    const support = supportEmail ? supervisorByEmail.get(supportEmail) : null;
    if (primaryEmail && !primary) errors.push(`Email GVHD 1 không thuộc danh sách GVHD của Round: ${primaryEmail}`);
    if (supportEmail && !support) errors.push(`Email GVHD 2 không thuộc danh sách GVHD của Round: ${supportEmail}`);
    if (primaryEmail && supportEmail && primaryEmail === supportEmail) errors.push('GVHD 1 và GVHD 2 trùng nhau');

    const nextPrimary = primary || currentPrimary;
    const nextSupport = support || currentSupport;
    if (nextPrimary && nextSupport && nextPrimary.id === nextSupport.id) errors.push('GVHD 1 và GVHD 2 trùng nhau');
    const nextSupervisors = [
      ...(nextPrimary ? [{
        supervisorId: nextPrimary.id || nextPrimary.supervisorId,
        supervisorName: nextPrimary.name || nextPrimary.supervisorName,
        supervisorEmail: String(nextPrimary.email || nextPrimary.supervisorEmail || '').trim().toLowerCase(),
        role: 'primary', source: 'excel_import', addedAt: new Date().toISOString()
      }] : []),
      ...(nextSupport ? [{
        supervisorId: nextSupport.id || nextSupport.supervisorId,
        supervisorName: nextSupport.name || nextSupport.supervisorName,
        supervisorEmail: String(nextSupport.email || nextSupport.supervisorEmail || '').trim().toLowerCase(),
        role: 'support', source: 'excel_import', addedAt: new Date().toISOString()
      }] : [])
    ];
    const currentIds = current.map(item => `${item.role}:${item.supervisorId}`).sort().join('|');
    const nextIds = nextSupervisors.map(item => `${item.role}:${item.supervisorId}`).sort().join('|');
    const changed = currentIds !== nextIds;
    const status = !changed ? 'unchanged' : (current.length === 0 ? 'new' : 'changed');
    return { line: index + 2, studentId, row, primaryEmail, supportEmail, supervisors: nextSupervisors, errors, status };
  });

  // Duplicate MSSV: mark every occurrence, not only the later row.
  const duplicateIds = new Set(preview.filter((item, index) => item.studentId && preview.some((other, otherIndex) => otherIndex !== index && other.studentId === item.studentId)).map(item => item.studentId));
  preview.forEach(item => {
    if (duplicateIds.has(item.studentId) && !item.errors.some(error => error.startsWith('MSSV trùng'))) item.errors.push('MSSV xuất hiện nhiều dòng trong file');
  });

  // Simulate final state and validate quota before any write.
  const previewByStudent = new Map(preview.filter(item => item.row && item.errors.length === 0).map(item => [item.studentId, item]));
  const studentsBySupervisor = new Map();
  allRows.forEach(row => {
    const planned = previewByStudent.get(row.studentId)?.supervisors || getOfficialSupervisors(row.effective);
    new Set(planned.map(item => item.supervisorId).filter(Boolean)).forEach(supervisorId => {
      if (!studentsBySupervisor.has(supervisorId)) studentsBySupervisor.set(supervisorId, new Set());
      studentsBySupervisor.get(supervisorId).add(row.studentId);
    });
  });
  preview.forEach(item => {
    if (!item.row || item.errors.length > 0 || item.status === 'unchanged') return;
    item.supervisors.forEach(assigned => {
      const sup = supervisors.find(s => s.id === assigned.supervisorId);
      const master = (state.supervisorsMaster || []).find(s => s.id === assigned.supervisorId);
      const { maxCap } = getSupervisorDefaultAndMaxQuota(master || sup);
      const configured = typeof sup?.capacity === 'number' ? sup.capacity : (sup?.maxQuota || maxCap);
      const cap = Math.min(configured, maxCap);
      const used = studentsBySupervisor.get(assigned.supervisorId)?.size || 0;
      if (used > cap) item.errors.push(`${assigned.supervisorName} vượt quota ${used}/${cap}`);
    });
  });

  state.assignmentImportPreview = preview;
  renderSupervisorAssignmentImportPreview();
}

function renderSupervisorAssignmentImportPreview() {
  const preview = state.assignmentImportPreview || [];
  const valid = preview.filter(item => item.errors.length === 0);
  const errorCount = preview.length - valid.length;
  const counts = {
    total: preview.length,
    valid: valid.length,
    errors: errorCount,
    new: valid.filter(item => item.status === 'new').length,
    changed: valid.filter(item => item.status === 'changed').length,
    unchanged: valid.filter(item => item.status === 'unchanged').length
  };
  const summary = document.getElementById('assignment-import-summary');
  if (summary) summary.innerHTML = [
    ['Tổng dòng', counts.total, 'slate'], ['Hợp lệ', counts.valid, 'emerald'], ['Lỗi', counts.errors, 'rose'],
    ['Phân công mới', counts.new, 'blue'], ['Thay đổi', counts.changed, 'amber'], ['Không đổi', counts.unchanged, 'slate']
  ].map(([label, value, color]) => `<div class="p-2 rounded-xl bg-${color}-50 border border-${color}-200"><span class="block text-[10px] text-${color}-600">${label}</span><strong class="text-lg text-${color}-900">${value}</strong></div>`).join('');

  const tbody = document.getElementById('assignment-import-preview-tbody');
  if (tbody) tbody.innerHTML = preview.map(item => {
    const master = item.studentId && typeof window.getFacultyStudentByMssv === 'function' ? window.getFacultyStudentByMssv(item.studentId) : null;
    const primary = item.supervisors.find(s => s.role === 'primary');
    const support = item.supervisors.find(s => s.role === 'support');
    const statusText = item.errors.length > 0 ? item.errors.join('; ') : ({ new: 'Phân công mới', changed: 'Thay đổi', unchanged: 'Không thay đổi' }[item.status]);
    return `<tr class="${item.errors.length ? 'bg-rose-50' : ''}"><td class="p-2 font-mono">${item.line}</td><td class="p-2 font-mono font-bold">${escapeHtml(item.studentId)}</td><td class="p-2">${escapeHtml(master?.fullName || master?.name || item.row?.effective?.studentName || '--')}</td><td class="p-2">${escapeHtml(primary?.supervisorName || '--')}</td><td class="p-2">${escapeHtml(support?.supervisorName || '--')}</td><td class="p-2 ${item.errors.length ? 'text-rose-700' : 'text-emerald-700'} font-semibold">${escapeHtml(statusText)}</td></tr>`;
  }).join('');
  const confirmButton = document.getElementById('btn-confirm-assignment-import');
  if (confirmButton) confirmButton.disabled = errorCount > 0 || (counts.new + counts.changed) === 0;
  document.getElementById('modal-assignment-excel-preview')?.classList.remove('hidden');
}

window.closeSupervisorAssignmentExcelPreview = function() {
  document.getElementById('modal-assignment-excel-preview')?.classList.add('hidden');
  state.assignmentImportPreview = [];
};

window.confirmSupervisorAssignmentExcelImport = async function() {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const changed = (state.assignmentImportPreview || []).filter(item => item.errors.length === 0 && item.status !== 'unchanged');
  if (!roundId || changed.length === 0) return;
  try {
    for (let offset = 0; offset < changed.length; offset += 400) {
      const batch = writeBatch(db);
      changed.slice(offset, offset + 400).forEach(item => {
        batch.set(
          doc(db, 'graduationRounds', roundId, 'assignmentDrafts', item.studentId),
          buildAssignmentDraftPayload(item.row, item.supervisors, 'excel_import'),
          { merge: true }
        );
      });
      await batch.commit();
    }
    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment', action: 'Import Excel phân công GVHD', target: roundId,
      detail: `Lưu ${changed.length} thay đổi vào bản nháp; chưa công bố`, by: state.user?.email || 'admin'
    });
    closeSupervisorAssignmentExcelPreview();
    showToast(`Đã lưu ${changed.length} phân công vào bản nháp.`, 'success');
    await loadAdminReviewData(roundId);
  } catch (error) {
    showToast('Lỗi lưu phân công từ Excel: ' + error.message, 'error');
  }
};

window.filterAdminAssignedTable = function(filterVal) {
  renderAdminAssignedSupervisorsTable(filterVal);
};

window.renderAdminAssignedSupervisorsTable = function(filterVal = '') {
  const tbody = document.getElementById('admin-assigned-supervisors-tbody');
  const countTag = document.getElementById('adm-accepted-count-tag');
  const statusMsgEl = document.getElementById('adm-assignment-status-msg');
  if (!tbody) return;

  const allRows = getAdminAssignmentRows();
  const assignedRows = allRows.filter(row => row.isAssigned);
  const registeredUnassigned = allRows.filter(row => row.isRegistered && !row.isAssigned);
  const unregistered = allRows.filter(row => !row.isRegistered && !row.isAssigned);

  if (countTag) countTag.textContent = `${assignedRows.length}/${allRows.length} SV`;
  if (statusMsgEl) {
    let msg = '';
    if (registeredUnassigned.length > 0) {
      msg = `⚠️ Còn ${registeredUnassigned.length} sinh viên đã đăng ký chưa được phân công GVHD.`;
    } else if (unregistered.length > 0) {
      msg = `✓ Tất cả sinh viên đã đăng ký đã được phân công. Còn ${unregistered.length} sinh viên chưa đăng ký.`;
    } else if (allRows.length > 0 && assignedRows.length >= allRows.length) {
      msg = '✓ Tất cả sinh viên đã được phân công GVHD.';
    } else {
      msg = 'Chưa có dữ liệu sinh viên.';
    }
    statusMsgEl.textContent = msg;
  }

  const q = String(filterVal || '').trim().toLowerCase();
  const filtered = allRows.filter(row => {
    if (!q) return true;
    const reg = row.effective;
    const supNames = getOfficialSupervisors(reg).map(s => s.supervisorName || '').join(' ').toLowerCase();
    const name = resolveStudentName(row.studentId, reg.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);
    return row.studentId.toLowerCase().includes(q) ||
      (reg.studentName || '').toLowerCase().includes(q) ||
      name.toLowerCase().includes(q) ||
      (reg.topicTitle || '').toLowerCase().includes(q) ||
      supNames.includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-slate-400">
          ${allRows.length === 0 ? 'Chưa có sinh viên đủ điều kiện hoặc đăng ký trong đợt này.' : 'Không tìm thấy sinh viên phù hợp từ khóa tìm kiếm.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((row, idx) => {
    const mssv = row.studentId;
    const reg = row.effective;
    const isRegistered = row.isRegistered;
    const isAssigned = row.isAssigned;
    const studentDisplayName = resolveStudentName(mssv, reg.studentName || row.eligibleStudent?.fullName || row.eligibleStudent?.name);

    let regStatusHtml = '';
    if (isRegistered) {
      regStatusHtml = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">Đã đăng ký</span>';
    } else {
      regStatusHtml = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Chưa đăng ký</span>';
    }

    const officials = isAssigned ? getOfficialSupervisors(reg) : [];
    const primary = officials.find(s => s.role === 'primary') || officials[0];
    const supports = officials.filter(s => s.role === 'support');

    const editingLocked = isAssignmentEditingLocked();
    const primaryHtml = (isAssigned && primary) ? `
      <button type="button" ${editingLocked ? 'disabled' : `onclick="openAdminEditSupervisorModal('${mssv}')"`} class="text-left ${editingLocked ? 'cursor-default' : 'hover:bg-blue-50 cursor-pointer'} p-1.5 -m-1.5 rounded-lg transition-colors" title="${editingLocked ? 'Mở khóa chỉnh sửa để thay đổi GVHD 1' : 'Bấm để đổi GVHD 1'}">
        <span class="font-bold text-slate-900 text-xs block">${escapeHtml(primary.supervisorName || 'GVHD 1')}</span>
        <span class="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">GVHD 1</span>
        ${row.draft ? '<span class="block text-[9px] font-bold text-amber-700 mt-1">Chưa công bố</span>' : ''}
      </button>
    ` : `<button type="button" ${editingLocked ? 'disabled' : `onclick="openAdminManualAssignModal('${mssv}')"`} class="font-bold text-[11px] ${editingLocked ? 'text-slate-400 cursor-default' : 'text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer'}">Chưa phân công</button>`;

    const supportsHtml = (isAssigned && supports.length > 0) ? `
      <div class="space-y-1.5">
        ${supports.map(sup => `
          <div class="flex items-center justify-between gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <button type="button" ${editingLocked ? 'disabled' : `onclick="openAdminEditSupervisorModal('${mssv}')"`} class="font-bold text-slate-800 text-xs block ${editingLocked ? 'cursor-default' : 'hover:text-indigo-700 hover:underline'}">${escapeHtml(sup.supervisorName)}</button>
              <span class="text-[9px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-bold border border-indigo-200">GVHD 2</span>
            </div>
            <button type="button" ${editingLocked ? 'disabled' : `onclick="removeSupportSupervisor('${mssv}', '${sup.supervisorId}', '${escapeHtml(sup.supervisorName)}', '${escapeHtml(studentDisplayName)}')"`} class="px-2 py-0.5 text-rose-600 hover:bg-rose-50 rounded text-[10px] font-bold border border-rose-200 transition-colors disabled:opacity-40" title="Gỡ GVHD 2 khỏi sinh viên này">
              Gỡ
            </button>
          </div>
        `).join('')}
      </div>
    ` : (isAssigned
      ? `<button type="button" ${editingLocked ? 'disabled' : `onclick="openAddSupportSupervisorModal('${mssv}')"`} class="font-bold text-[11px] ${editingLocked ? 'text-slate-400 cursor-default' : 'text-indigo-700 hover:underline cursor-pointer'}" title="Bấm để chọn GVHD 2">Chưa có</button>`
      : `<button type="button" ${editingLocked ? 'disabled' : `onclick="openAdminEditSupervisorModal('${mssv}')"`} class="font-bold text-[11px] ${editingLocked ? 'text-slate-400 cursor-default' : 'text-indigo-700 hover:underline cursor-pointer'}" title="Bấm để chọn GVHD chính và GVHD 2">Chưa có</button>`);

    const masterStudent = typeof window.getFacultyStudentByMssv === 'function' ? window.getFacultyStudentByMssv(mssv) : null;
    const major = masterStudent?.major || row.eligibleStudent?.major || 'Thiết kế Nội thất';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5 text-slate-400 font-bold">${idx + 1}</td>
        <td class="p-3.5 font-mono font-bold text-slate-900">${mssv}</td>
        <td class="p-3.5 font-semibold text-slate-800 whitespace-nowrap">${escapeHtml(studentDisplayName)}</td>
        <td class="p-3.5 max-w-xs">
          <span class="font-medium text-slate-900 block truncate" title="${escapeHtml(reg?.topicTitle || 'Chưa đăng ký đề tài')}">${escapeHtml(reg?.topicTitle || 'Chưa đăng ký đề tài')}</span>
          <span class="text-[11px] text-slate-500">${escapeHtml(major)}${reg?.projectType ? ` • ${escapeHtml(reg.projectType)}` : ''}</span>
        </td>
        <td class="p-3.5 whitespace-nowrap">${regStatusHtml}</td>
        <td class="p-3.5 whitespace-nowrap">${primaryHtml}</td>
        <td class="p-3.5 min-w-[180px]">${supportsHtml}</td>
      </tr>
    `;
  }).join('');
};

window.openAddSupportSupervisorModal = function(studentId) {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  const reg = row?.effective;
  if (!row || !reg || !row.isAssigned) {
    showToast('Không tìm thấy thông tin sinh viên!', 'error');
    return;
  }

  document.getElementById('support-target-student-id').value = studentId;
  const studentInfoEl = document.getElementById('add-support-student-info');
  const studentDisplayName = resolveStudentName(reg.studentId, reg.studentName);
  if (studentInfoEl) studentInfoEl.textContent = `Sinh viên: ${studentDisplayName} (MSSV: ${studentId})`;

  const officials = getOfficialSupervisors(reg);
  const primary = officials.find(s => s.role === 'primary') || officials[0];
  const supports = officials.filter(s => s.role === 'support');

  const summaryEl = document.getElementById('support-current-supervisors-summary');
  if (summaryEl) {
    let htmlStr = `• GVHD chính: <strong>${primary?.supervisorName || 'Chưa xác định'}</strong>`;
    if (supports.length > 0) {
      htmlStr += `<br>• GVHD 2: ${supports.map(s => s.supervisorName).join(', ')}`;
    }
    summaryEl.innerHTML = htmlStr;
  }

  // Populate Supervisors dropdown with duplicate protection & quota check
  const select = document.getElementById('select-support-supervisor');
  const supervisors = state.adminReviewData?.supervisors || [];
  const assignedSupsSet = new Set(officials.map(s => s.supervisorId));

  select.innerHTML = '<option value="">-- Chọn GVHD 2 --</option>' + supervisors.map(s => {
    const isAlreadyAssigned = assignedSupsSet.has(s.id);
    const supMaster = (state.supervisorsMaster || []).find(x => x.id === s.id);
    const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || s);
    const configuredCap = typeof s.capacity === 'number' ? s.capacity : (s.maxQuota || maxCap);
    const cap = Math.min(configuredCap, maxCap);
    const totalAssigned = getSupervisorAssignmentCount(s.id, studentId);
    const remaining = cap - totalAssigned;
    const isFull = (remaining <= 0);
    const isAdjunct = (employmentType === 'adjunct');

    let label = `${s.name} (${isAdjunct ? 'Thỉnh giảng' : 'Cơ hữu'} • ${totalAssigned}/${cap} SV)`;
    if (isAlreadyAssigned) {
      label += ' — Đã là GVHD của SV';
    } else if (isFull) {
      label += ' — Đã đủ Quota';
    }

    const disabledAttr = (isAlreadyAssigned || isFull) ? 'disabled' : '';
    return `<option value="${s.id}" data-remaining="${remaining}" data-cap="${cap}" data-assigned="${totalAssigned}" ${disabledAttr}>${label}</option>`;
  }).join('');

  document.getElementById('support-supervisor-quota-hint').textContent = '';
  document.getElementById('btn-confirm-add-support').disabled = true;

  document.getElementById('modal-add-support-supervisor')?.classList.remove('hidden');
};

window.closeAddSupportSupervisorModal = function() {
  document.getElementById('modal-add-support-supervisor')?.classList.add('hidden');
};

window.onSelectSupportSupervisorChange = function(supId) {
  const submitBtn = document.getElementById('btn-confirm-add-support');
  const hint = document.getElementById('support-supervisor-quota-hint');
  if (!supId) {
    if (submitBtn) submitBtn.disabled = true;
    if (hint) hint.textContent = '';
    return;
  }

  const select = document.getElementById('select-support-supervisor');
  const opt = select.options[select.selectedIndex];
  const remaining = parseInt(opt.getAttribute('data-remaining') || '0', 10);
  const cap = parseInt(opt.getAttribute('data-cap') || '10', 10);
  const assigned = parseInt(opt.getAttribute('data-assigned') || '0', 10);

  if (remaining <= 0) {
    if (submitBtn) submitBtn.disabled = true;
    if (hint) hint.innerHTML = '<span class="text-rose-600 font-bold">⚠️ Giảng viên này đã đủ chỉ tiêu (hết quota) trong đợt!</span>';
  } else {
    if (submitBtn) submitBtn.disabled = false;
    if (hint) hint.innerHTML = `<span class="text-emerald-700 font-bold">✓ Chỉ tiêu khả dụng: còn ${remaining} chỗ (Đang hướng dẫn ${assigned}/${cap} SV).</span>`;
  }
};

window.executeAddSupportSupervisor = async function() {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  const studentId = document.getElementById('support-target-student-id')?.value;
  const supervisorId = document.getElementById('select-support-supervisor')?.value;

  if (!roundId || !studentId || !supervisorId) return;

  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  const reg = row?.effective;
  const sup = (state.adminReviewData?.supervisors || []).find(s => s.id === supervisorId);

  if (!row || !reg || !sup) {
    showToast('Không tìm thấy thông tin sinh viên hoặc giảng viên!', 'error');
    return;
  }

  // Quota validation
  const supMaster = (state.supervisorsMaster || []).find(x => x.id === sup.id);
  const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster || sup);
  const configuredCap = typeof sup.capacity === 'number' ? sup.capacity : (sup.maxQuota || maxCap);
  const cap = Math.min(configuredCap, maxCap);
  const currentAssigned = getSupervisorAssignmentCount(sup.id, studentId);
  if (currentAssigned >= cap) {
    const typeLabel = employmentType === 'adjunct' ? 'Thỉnh giảng tối đa 5 SV' : 'Cơ hữu tối đa 10 SV';
    showToast(`Giảng viên ${sup.name} đã đủ chỉ tiêu (${currentAssigned}/${cap} SV - ${typeLabel}) theo quy định của Trường!`, 'warning');
    return;
  }

  // Duplicate protection
  const officials = getOfficialSupervisors(reg);
  if (officials.some(s => s.supervisorId === supervisorId)) {
    showToast(`Thầy/Cô ${sup.name} đã là GVHD của sinh viên này!`, 'warning');
    return;
  }

  const submitBtn = document.getElementById('btn-confirm-add-support');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Đang lưu...';
  }

  try {
    const updatedOfficials = [...officials, {
      supervisorId: sup.id,
      supervisorName: sup.name,
      supervisorEmail: (sup.email || '').toLowerCase().trim(),
      source: 'admin_added',
      role: 'support',
      addedAt: new Date().toISOString()
    }];

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'graduationRounds', roundId, 'assignmentDrafts', studentId),
      buildAssignmentDraftPayload(row, updatedOfficials, 'admin_added_support'),
      { merge: true }
    );
    await batch.commit();

    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment',
      action: 'Thêm GVHD 2',
      target: studentId,
      detail: `Thêm ${sup.name || supervisorId} làm GVHD 2; trạng thái draft`,
      by: state.user?.email || 'admin'
    });

    closeAddSupportSupervisorModal();
    renderAdminAssignedSupervisorsTable();
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();

    const sName = resolveStudentName(studentId, reg.studentName);
    showToast(`✓ Đã thêm Thầy/Cô ${sup.name} làm GVHD 2 cho sinh viên ${sName}!`, 'success');
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi thêm GVHD 2:', err);
    showToast('Lỗi: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Thêm GVHD 2';
    }
  }
};

window.removeSupportSupervisor = async function(studentId, supervisorId, supervisorName, studentName) {
  if (!ensureAssignmentEditingAllowed()) return;
  const roundId = state.selectedRoundId;
  if (!roundId || !studentId || !supervisorId) return;

  const confirmed = await showConfirm(
    'Gỡ GVHD 2',
    `Bạn có chắc chắn muốn gỡ Thầy/Cô "${supervisorName}" khỏi vai trò GVHD 2 của sinh viên "${studentName}" không?`,
    { confirmText: 'Gỡ GVHD 2', danger: true }
  );
  if (!confirmed) return;

  const row = getAdminAssignmentRows().find(item => item.studentId === String(studentId || '').trim().toUpperCase());
  if (!row || !row.isAssigned) return;

  try {
    const officials = getOfficialSupervisors(row.effective);
    const updatedOfficials = officials.filter(s => !(s.role === 'support' && s.supervisorId === supervisorId));

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'graduationRounds', roundId, 'assignmentDrafts', studentId),
      buildAssignmentDraftPayload(row, updatedOfficials, 'admin_removed_support'),
      { merge: true }
    );
    await batch.commit();

    await window.appendAuditLogRecord?.(roundId, {
      type: 'assignment',
      action: 'Gỡ GVHD 2',
      target: studentId,
      detail: `Gỡ ${supervisorName || supervisorId} khỏi vai trò GVHD 2; trạng thái draft`,
      by: state.user?.email || 'admin'
    });

    renderAdminAssignedSupervisorsTable();
    renderAdminReviewDashboard();
    renderAdminReviewSupervisorsTable();

    showToast(`Đã gỡ GVHD 2 khỏi sinh viên ${studentName}.`, 'info');
    await loadAdminReviewData(roundId);
  } catch (err) {
    console.error('Lỗi gỡ GVHD 2:', err);
    showToast('Lỗi gỡ GVHD 2: ' + err.message, 'error');
  }
};


// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof previewAssignmentExcel !== 'undefined') window.previewAssignmentExcel = previewAssignmentExcel;
  if (typeof applyAssignmentExcelBatch !== 'undefined') window.applyAssignmentExcelBatch = applyAssignmentExcelBatch;
  if (typeof exportAssignmentExcel !== 'undefined') window.exportAssignmentExcel = exportAssignmentExcel;
}
