/**
 * IFA+ Graduation — Final Scores & Councils Excel Export
 */
function sanitizeExcelCell(val) {
  if (typeof val === 'string') {
    // Formula Injection Protection
    if (/^[=+@-]/.test(val)) {
      return "'" + val;
    }
  }
  return val;
}

function sanitizeSheetName(name) {
  return String(name || 'Sheet').replace(/[\\/*?[\]:]/g, '_').substring(0, 31);
}

window.loadAdminExportTab = function(roundId) {
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  // Populate Activity select
  const acts = (targetRound.activities || []).filter(a => a.councilEnabled && Array.isArray(a.councils) && a.councils.length > 0);
  const actSel = document.getElementById('export-activity-select');
  const councilActSel = document.getElementById('export-council-activity-select');

  const optionsHtml = acts.length > 0
    ? acts.map(a => `<option value="${a.id}">${a.title} (${a.councils.length} Hội đồng)</option>`).join('')
    : '<option value="">-- Chưa có Mốc nào có Hội đồng --</option>';

  if (actSel) actSel.innerHTML = optionsHtml;
  if (councilActSel) {
    councilActSel.innerHTML = optionsHtml;
    if (acts.length > 0) onExportCouncilActivityChange(acts[0].id);
  }
};

window.onExportCouncilActivityChange = function(actId) {
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  const councilSel = document.getElementById('export-single-council-select');
  if (!councilSel) return;

  const councils = act?.councils || [];
  if (councils.length === 0) {
    councilSel.innerHTML = '<option value="">-- Chưa có Hội đồng --</option>';
    return;
  }
  councilSel.innerHTML = councils.map(c => `<option value="${c.id}">${c.name} (${c.room || 'Chưa xếp phòng'})</option>`).join('');
};

window.exportRoundSummaryToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  // 1. TONG_KET SHEET
  const ranking = computeRoundRanking(roundId);
  const tongKetData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD', 'Điểm GVHD', 'TM HD', 'TM PB', 'TM Final', 'Điểm Bảo vệ', 'Điểm Tổng kết', 'Hạng', 'Danh hiệu']
  ];

  let stt = 1;
  ranking.rankedStudents.forEach(st => {
    tongKetData.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))),
      st.components?.gvhd?.raw ?? '',
      targetRound.thesisScores?.[st.studentId]?.hd?.score ?? '',
      targetRound.thesisScores?.[st.studentId]?.pb?.score ?? '',
      st.components?.tm?.raw ?? '',
      st.components?.defense?.raw ?? '',
      st.rawScore ?? '',
      st.rank,
      sanitizeExcelCell(st.title || '')
    ]);
  });

  ranking.incompleteStudents.forEach(st => {
    tongKetData.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(formatStudentSupervisorsForDisplay(findStudentInRound(st.studentId))),
      st.components?.gvhd?.raw ?? '',
      targetRound.thesisScores?.[st.studentId]?.hd?.score ?? '',
      targetRound.thesisScores?.[st.studentId]?.pb?.score ?? '',
      st.components?.tm?.raw ?? '',
      st.components?.defense?.raw ?? '',
      'Chưa đủ',
      '--',
      '--'
    ]);
  });

  const wsTongKet = XLSX.utils.aoa_to_sheet(tongKetData);
  XLSX.utils.book_append_sheet(wb, wsTongKet, 'TONG_KET');

  // 2. XEP_HANG SHEET
  const xepHangData = [
    ['Hạng', 'MSSV', 'Họ và tên', 'Điểm hiển thị', 'Điểm chi tiết (Raw)', 'Danh hiệu', 'Ghi chú đồng điểm']
  ];
  ranking.rankedStudents.forEach(st => {
    xepHangData.push([
      st.rank,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      st.displayScore,
      st.rawScore,
      sanitizeExcelCell(st.title || ''),
      st.isTie ? 'Đồng điểm' : ''
    ]);
  });
  const wsXepHang = XLSX.utils.aoa_to_sheet(xepHangData);
  XLSX.utils.book_append_sheet(wb, wsXepHang, 'XEP_HANG');

  // 3. SO_KHAO SHEET
  const soKhaoData = [
    ['STT', 'MSSV', 'Họ và tên', 'Điểm Sơ khảo TB', 'Số lượt chấm hợp lệ', 'Ghi chú']
  ];
  let skStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const sk = getPreliminarySummary(st.studentId, roundId);
    soKhaoData.push([
      skStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sk.average !== null ? sk.average : '',
      sk.count,
      sk.excludedScores?.length > 0 ? `Đã loại ${sk.excludedScores.length} điểm GVHD` : ''
    ]);
  });
  const wsSoKhao = XLSX.utils.aoa_to_sheet(soKhaoData);
  XLSX.utils.book_append_sheet(wb, wsSoKhao, 'SO_KHAO');

  // 4. GVHD SHEET
  const gvhdData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD chính', 'GVHD 2', 'Điểm GVHD', 'Người nhập điểm']
  ];
  let gvStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const sc = targetRound.supervisorScores?.[st.studentId];
    const sObj = findStudentInRound(st.studentId);
    const officials = getOfficialSupervisors(sObj) || [];
    const primary = officials.find(o => o.role === 'primary')?.supervisorName || officials[0]?.supervisorName || '';
    const support = officials.filter(o => o.role === 'support').map(o => o.supervisorName).join(', ');
    gvhdData.push([
      gvStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(primary),
      sanitizeExcelCell(support),
      (sc && sc.status === 'completed') ? sc.score : '',
      sanitizeExcelCell(sc?.scorerName || '')
    ]);
  });
  const wsGvhd = XLSX.utils.aoa_to_sheet(gvhdData);
  XLSX.utils.book_append_sheet(wb, wsGvhd, 'GVHD');

  // 5. TM SHEET
  const tmData = [
    ['STT', 'MSSV', 'Họ và tên', 'GVHD', 'GVPB', 'TM HD', 'TM PB', 'TM Final']
  ];
  let tmStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const tm = targetRound.thesisScores?.[st.studentId];
    tmData.push([
      tmStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      sanitizeExcelCell(tm?.hd?.scorerName || ''),
      sanitizeExcelCell(tm?.pb?.scorerName || ''),
      (tm?.hd?.status === 'completed') ? tm.hd.score : '',
      (tm?.pb?.status === 'completed') ? tm.pb.score : '',
      getThesisFinalScore(st.studentId, roundId) ?? ''
    ]);
  });
  const wsTm = XLSX.utils.aoa_to_sheet(tmData);
  XLSX.utils.book_append_sheet(wb, wsTm, 'TM');

  // 6. BAO_VE SHEET
  const bvData = [
    ['STT', 'MSSV', 'Họ và tên', 'Hội đồng', 'CT', 'UV', 'TK', 'Điểm Bảo vệ chính thức']
  ];
  let bvStt = 1;
  ranking.rankedStudents.concat(ranking.incompleteStudents).forEach(st => {
    const dScore = getStudentDefenseScore(st.studentId, roundId);
    bvData.push([
      bvStt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.fullName),
      '--',
      '',
      '',
      '',
      dScore !== null ? dScore : ''
    ]);
  });
  const wsBv = XLSX.utils.aoa_to_sheet(bvData);
  XLSX.utils.book_append_sheet(wb, wsBv, 'BAO_VE');

  // 7. AUDIT SHEET
  const logs = targetRound.auditLogs || [];
  const auditData = [
    ['Thời gian', 'Hành động', 'Mã Đợt / Hội đồng', 'Sinh viên', 'Người chấm', 'Điểm cũ', 'Điểm mới', 'Người thực hiện', 'Lý do']
  ];
  logs.forEach(l => {
    auditData.push([
      fmt24h(l.createdAt),
      sanitizeExcelCell(l.action || 'calibration'),
      sanitizeExcelCell(l.councilId || l.roundId || ''),
      sanitizeExcelCell(l.studentName || l.studentId || ''),
      sanitizeExcelCell(l.scorerName || ''),
      l.originalValue ?? '',
      l.newValue ?? '',
      sanitizeExcelCell(l.adjustedByName || l.adjustedById || ''),
      sanitizeExcelCell(l.reason || '')
    ]);
  });
  const wsAudit = XLSX.utils.aoa_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'AUDIT');

  const safeRoundSlug = (targetRound.slug || targetRound.id || 'Round').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Tong-ket_${safeRoundSlug}_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công file: ${filename}`, 'success');
};

window.exportActivityCouncilsToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const actId = document.getElementById('export-activity-select')?.value;
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  if (!act || !act.councils || act.councils.length === 0) {
    showToast('Vui lòng chọn mốc kế hoạch có Hội đồng hợp lệ!', 'warning');
    return;
  }

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  // SAME COLUMN STRUCTURE ACROSS ALL COUNCILS IN ACTIVITY
  const slots = act.councilStructure?.slots || [];
  const headerRow = ['STT', 'MSSV', 'Họ và tên'];
  slots.forEach(s => {
    headerRow.push(`${s.label || s.name}${s.type === 'guest' ? ' (Khách)' : ''}`);
  });
  headerRow.push('Điểm chính thức');

  act.councils.forEach(council => {
    const cSheetName = sanitizeSheetName(council.name || council.id);
    const asgns = (act.councilStudentAssignments || [])
      .filter(a => a.councilId === council.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const sheetRows = [headerRow];
    let stt = 1;

    asgns.forEach(asgn => {
      const sid = asgn.studentId;
      const sObj = findStudentInRound(sid);
      const sName = sObj?.fullName || sObj?.studentName || sid;
      const official = getOfficialDefenseScore(sid, council, act, targetRound);

      const row = [stt++, sanitizeExcelCell(sid), sanitizeExcelCell(sName)];

      slots.forEach(s => {
        const assigned = council.membersBySlot?.[s.key];
        const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
        const scoreKey = scorerId ? `${act.id}_${council.id}_${sid}_${scorerId}` : null;
        const score = scoreKey ? state.councilScores?.[scoreKey] : null;

        if (!assigned) {
          row.push('Chưa phân công');
        } else if (!score || score.status !== 'completed') {
          row.push('Chưa xong');
        } else {
          const isGuest = (s.type === 'guest');
          const isInc = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;
          if (mode === 'all' && isGuest) {
            row.push(`${score.value} (${isInc ? 'LẤY' : 'BỎ'})`);
          } else {
            row.push(score.value);
          }
        }
      });

      row.push(official.isComplete && official.score !== null ? official.score : '');
      sheetRows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, cSheetName);
  });

  const actSlug = (act.slug || act.id || 'Activity').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${actSlug}_Toan-bo-Hoi-dong_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công: ${filename}`, 'success');
};

window.exportSingleCouncilToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const actId = document.getElementById('export-council-activity-select')?.value;
  const councilId = document.getElementById('export-single-council-select')?.value;
  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  const act = (targetRound?.activities || []).find(a => a.id === actId);
  const council = (act?.councils || []).find(c => c.id === councilId);

  if (!act || !council) {
    showToast('Vui lòng chọn Mốc và Hội đồng hợp lệ!', 'warning');
    return;
  }

  const mode = document.querySelector('input[name="export_scores_mode"]:checked')?.value || 'selected';
  const wb = XLSX.utils.book_new();

  const slots = act.councilStructure?.slots || [];
  const headerRow = ['STT', 'MSSV', 'Họ và tên'];
  slots.forEach(s => {
    headerRow.push(`${s.label || s.name}${s.type === 'guest' ? ' (Khách)' : ''}`);
  });
  headerRow.push('Điểm chính thức');

  const asgns = (act.councilStudentAssignments || [])
    .filter(a => a.councilId === council.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const sheetRows = [headerRow];
  let stt = 1;

  asgns.forEach(asgn => {
    const sid = asgn.studentId;
    const sObj = findStudentInRound(sid);
    const sName = sObj?.fullName || sObj?.studentName || sid;
    const official = getOfficialDefenseScore(sid, council, act, targetRound);

    const row = [stt++, sanitizeExcelCell(sid), sanitizeExcelCell(sName)];

    slots.forEach(s => {
      const assigned = council.membersBySlot?.[s.key];
      const scorerId = assigned?.memberId || assigned?.memberEmail || assigned?.memberName;
      const scoreKey = scorerId ? `${act.id}_${council.id}_${sid}_${scorerId}` : null;
      const score = scoreKey ? state.councilScores?.[scoreKey] : null;

      if (!assigned) {
        row.push('Chưa phân công');
      } else if (!score || score.status !== 'completed') {
        row.push('Chưa xong');
      } else {
        const isGuest = (s.type === 'guest');
        const isInc = isGuest ? (council.guestInclusion?.[sid]?.[s.key] !== false) : true;
        if (mode === 'all' && isGuest) {
          row.push(`${score.value} (${isInc ? 'LẤY' : 'BỎ'})`);
        } else {
          row.push(score.value);
        }
      }
    });

    row.push(official.isComplete && official.score !== null ? official.score : '');
    sheetRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  const cSheetName = sanitizeSheetName(council.name || 'Hoi_Dong');
  XLSX.utils.book_append_sheet(wb, ws, cSheetName);

  const actSlug = (act.slug || act.id || 'Bao-ve').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cSlug = (council.slug || council.name || 'HD').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${actSlug}_${cSlug}_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất thành công: ${filename}`, 'success');
};

window.exportAuditLogsToExcel = function() {
  if (typeof XLSX === 'undefined') {
    showToast('Lỗi: Thư viện SheetJS chưa sẵn sàng!', 'error');
    return;
  }

  const roundId = document.getElementById('admin-scoring-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId);
  if (!targetRound) return;

  const wb = XLSX.utils.book_new();
  const logs = targetRound.auditLogs || [];

  const auditData = [
    ['Thời gian', 'Hành động', 'Mã Đợt / Hội đồng', 'Sinh viên', 'Người chấm', 'Điểm cũ', 'Điểm mới', 'Người thực hiện', 'Vai trò', 'Lý do']
  ];

  logs.forEach(l => {
    auditData.push([
      fmt24h(l.createdAt),
      sanitizeExcelCell(l.action || 'calibration'),
      sanitizeExcelCell(l.councilId || l.roundId || ''),
      sanitizeExcelCell(l.studentName || l.studentId || ''),
      sanitizeExcelCell(l.scorerName || ''),
      l.originalValue ?? '',
      l.newValue ?? '',
      sanitizeExcelCell(l.adjustedByName || l.adjustedById || ''),
      sanitizeExcelCell(l.adjustedByRole || ''),
      sanitizeExcelCell(l.reason || '')
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(auditData);
  XLSX.utils.book_append_sheet(wb, ws, 'AUDIT_LOGS');

  const filename = `Audit_Logs_${fmtToday()}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`✓ Đã xuất nhật ký kiểm toán: ${filename}`, 'success');
};

function fmtToday() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
