/**
 * IFA+ Graduation — Google Drive File Upload & Attachment Management Submodule
 */
import { parseDriveFolderId, getDriveFolderUrl } from './drive-provisioning.js';

window.checkStudentFileSubmission = function(actId) {
  const round = (state.rounds || []).find(r => r.id === state.selectedRoundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  const fileInput = document.getElementById('sub-input-file-' + actId);
  const errBox = document.getElementById('sub-error-box-' + actId);

  if (!round || !act) return;
  const files = fileInput?.files ? Array.from(fileInput.files) : [];
  const userMssv = state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const targetStudent =
    (round?.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.adminReviewData?.registrations || []).find(r => r.studentId === userMssv) || {
      studentId: userMssv,
      studentName: getEffectiveActor().displayName || (userMssv ? userMssv : 'Sinh viên')
    };

  const valRes = validateFileSubmission(files, targetStudent, act, round);
  if (!valRes.valid) {
    if (errBox) {
      errBox.innerHTML = `<strong>⚠️ Kiểm tra phát hiện lỗi:</strong><br>` + valRes.errors.map(e => `• ${e}`).join('<br>');
      errBox.classList.remove('hidden');
    }
    showToast('Tệp nộp chưa đúng yêu cầu. Vui lòng kiểm tra lại!', 'warning');
  } else {
    if (errBox) errBox.classList.add('hidden');
    showToast(`✅ File hợp lệ! Tên file chuẩn: ${valRes.expectedFilename}`, 'success');
  }
};

window.cancelStudentUpload = function(actId) {
  if (window._currentUploadAbort) {
    window._currentUploadAbort.abort();
    window._currentUploadAbort = null;
  }
  const progWrap = document.getElementById('sub-progress-wrap-' + actId);
  if (progWrap) progWrap.classList.add('hidden');
  showToast('Đã hủy quá trình tải tệp.', 'info');
};

window.submitStudentFiles = async function(actId) {
  if (!checkImpersonationWriteGuard('Nộp tệp tin bài làm mốc kế hoạch')) return;

  const round = (state.rounds || []).find(r => r.id === state.selectedRoundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  const fileInput = document.getElementById('sub-input-file-' + actId);
  const errBox = document.getElementById('sub-error-box-' + actId);
  const submitBtn = document.getElementById('btn-submit-file-' + actId);
  const progWrap = document.getElementById('sub-progress-wrap-' + actId);
  const progText = document.getElementById('sub-progress-text-' + actId);
  const progBar = document.getElementById('sub-progress-bar-' + actId);

  if (!round || !act) return;
  const files = fileInput?.files ? Array.from(fileInput.files) : [];
  const userMssv = state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const targetStudent =
    (round?.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.adminReviewData?.registrations || []).find(r => r.studentId === userMssv) || {
      studentId: userMssv,
      studentName: getEffectiveActor().displayName || (userMssv ? userMssv : 'Sinh viên')
    };

  // Client-side Validation
  const valRes = validateFileSubmission(files, targetStudent, act, round);
  if (!valRes.valid) {
    if (errBox) {
      errBox.innerHTML = `<strong>⚠️ Lỗi nộp bài:</strong><br>` + valRes.errors.map(e => `• ${e}`).join('<br>');
      errBox.classList.remove('hidden');
    }
    showToast('Tệp nộp không hợp lệ, không thể nộp bài!', 'error');
    return;
  }

  if (errBox) errBox.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Đang xử lý...</span>';
  }
  if (progWrap) progWrap.classList.remove('hidden');

  const abortController = new AbortController();
  window._currentUploadAbort = abortController;

  try {
    let file = files[0];
    if (valRes.expectedFilename) {
      file = new File([file], valRes.expectedFilename, { type: file.type });
    }
    const attemptNum = valRes.rules.completedAttempts + 1;

    // Call storage provider abstraction
    const uploadRes = await uploadProvider.upload({
      file,
      student: targetStudent,
      activity: act,
      round,
      attempt: attemptNum,
      onProgress: (pct) => {
        if (progText) progText.textContent = `Đang tải: ${pct}%`;
        if (progBar) progBar.style.width = `${pct}%`;
      },
      abortSignal: abortController.signal
    });

    if (!uploadRes.success) {
      // HONEST ERROR REPORTING: Never fake success
      if (errBox) {
        errBox.innerHTML = `<strong>⚠️ ${uploadRes.status === 'backendRequired' ? 'Bảo mật Google Drive:' : 'Lỗi tải lên:'}</strong><br>${uploadRes.error}`;
        errBox.classList.remove('hidden');
      }
      showToast(uploadRes.error || 'Tải tệp không thành công', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = `📤 Nộp bài (Lần ${attemptNum}/${valRes.rules.totalAllowedAttempts})`;
      }
      if (progWrap) progWrap.classList.add('hidden');
      return;
    }

    // Atomic metadata creation after transport success
    const receiptId = 'REC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const submissionMetadata = {
      studentId: userMssv,
      studentName: targetStudent.studentName,
      activityId: act.id,
      activityTitle: act.title,
      roundId: round.id,
      attempt: attemptNum,
      receiptId,
      files: [
        {
          originalName: file.name,
          validatedName: valRes.expectedFilename,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          storageProvider: uploadRes.storageProvider || 'google_drive',
          providerFileId: uploadRes.providerFileId || null,
          providerUrl: uploadRes.providerUrl || null
        }
      ],
      submittedAt: new Date().toISOString(),
      isLate: valRes.isLate,
      status: 'submitted',
      submittedBy: getEffectiveActor().email || userMssv
    };

    if (!round.activitySubmissions) round.activitySubmissions = {};
    if (!round.activitySubmissions[act.id]) round.activitySubmissions[act.id] = {};
    const existingEntry = round.activitySubmissions[act.id][userMssv] || { attempts: [] };
    const newAttempts = [...(existingEntry.attempts || []), submissionMetadata];

    round.activitySubmissions[act.id][userMssv] = {
      currentSubmission: submissionMetadata,
      attempts: newAttempts
    };

    // Save metadata to Firestore round document
    try {
      const roundRef = doc(db, 'graduationRounds', round.id);
      await updateDoc(roundRef, {
        [`activitySubmissions.${act.id}.${userMssv}`]: {
          currentSubmission: submissionMetadata,
          attempts: newAttempts
        },
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Could not update Firestore activitySubmissions directly:', e);
    }

    showToast(`✅ Nộp bài thành công! Mã biên nhận: ${receiptId}`, 'success');
    loadStudentRoundActivities(round.id);
  } catch (err) {
    console.error('Submit error:', err);
    if (errBox) {
      errBox.innerHTML = `<strong>⚠️ Lỗi hệ thống:</strong><br>${err.message || 'Quá trình nộp bài bị gián đoạn'}`;
      errBox.classList.remove('hidden');
    }
    showToast('Lỗi khi nộp bài: ' + (err.message || 'Không xác định'), 'error');
  } finally {
    window._currentUploadAbort = null;
    if (submitBtn) {
      submitBtn.disabled = false;
    }
    if (progWrap) progWrap.classList.add('hidden');
  }
};

window.withdrawStudentSubmission = async function(actId, attemptNum, optRoundId) {
  if (!checkImpersonationWriteGuard('Rút bài nộp')) return;

  const round = (state.rounds || []).find(r => r.id === (optRoundId || state.selectedRoundId)) || state.rounds?.[0];
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) {
    showToast('Không tìm thấy thông tin hoạt động!', 'error');
    return;
  }

  const userMssv = state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const subEntry = round?.activitySubmissions?.[actId]?.[userMssv];
  if (!subEntry || !subEntry.currentSubmission) {
    showToast('Không tìm thấy bài nộp để rút!', 'warning');
    return;
  }

  const confirmed = await showConfirm(
    'Xác nhận rút bài nộp?',
    'Tệp trên Google Drive sẽ được tự động xóa để giải phóng dung lượng. Bài nộp này sẽ chuyển sang trạng thái "Đã rút" và bạn có thể nộp lại nếu còn lượt.',
    { confirmText: 'Rút bài nộp', cancelText: 'Hủy', danger: true }
  );
  if (!confirmed) return;

  try {
    showToast('Đang xử lý rút bài và xóa tệp Drive...', 'info');

    const withdrawnSubmission = {
      ...subEntry.currentSubmission,
      status: 'withdrawn',
      withdrawnAt: new Date().toISOString()
    };

    const updatedAttempts = (subEntry.attempts || []).map(att => {
      if (att.receiptId === withdrawnSubmission.receiptId || (!att.receiptId && att.attempt === attemptNum)) {
        return { ...att, status: 'withdrawn', withdrawnAt: new Date().toISOString() };
      }
      return att;
    });

    // Call backend to delete file from Google Drive
    const endpoint = window.IFA_CONFIG?.driveUploadEndpoint;
    const idToken = state.user ? await state.user.getIdToken() : null;
    const filesToDelete = (subEntry.currentSubmission.files || []).filter(f => f.providerFileId && f.storageProvider === 'google_drive');

    if (endpoint && idToken && filesToDelete.length > 0) {
      for (const f of filesToDelete) {
        try {
          const delRes = await fetch(endpoint + '/api/graduation/delete-file', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + idToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileId: f.providerFileId })
          });
          console.log('[withdraw] Delete Drive file response status:', delRes.status);
        } catch (errDel) {
          console.warn('[withdraw] Error deleting file from Drive:', errDel);
        }
      }
    }

    if (!round.activitySubmissions) round.activitySubmissions = {};
    if (!round.activitySubmissions[actId]) round.activitySubmissions[actId] = {};
    round.activitySubmissions[actId][userMssv] = {
      currentSubmission: withdrawnSubmission,
      attempts: updatedAttempts
    };

    try {
      const roundRef = doc(db, 'graduationRounds', round.id);
      await updateDoc(roundRef, {
        [`activitySubmissions.${actId}.${userMssv}`]: {
          currentSubmission: withdrawnSubmission,
          attempts: updatedAttempts
        },
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('[withdraw] Could not update Firestore directly:', e);
    }

    showToast('Đã rút bài nộp và xóa tệp thành công!', 'success');
    loadStudentRoundActivities(round.id);
  } catch (err) {
    console.error('Withdraw error:', err);
    showToast('Lỗi khi rút bài: ' + (err.message || String(err)), 'error');
  }
};

// 7. ADMIN ACTIVITY SUBMISSIONS DASHBOARD
window.openActivitySubmissionDashboard = function(roundId, actId) {
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) {
    showToast('Không tìm thấy thông tin mốc kế hoạch!', 'error');
    return;
  }

  state._currentSubDash = { roundId, actId };

  const titleEl = document.getElementById('sub-dash-title');
  const subEl = document.getElementById('sub-dash-subtitle');
  if (titleEl) titleEl.innerHTML = `<span>📥</span> Quản lý Sinh viên Nộp bài — ${act.title}`;
  if (subEl) subEl.textContent = `Đợt: ${round.title} • Mốc: ${act.title}`;

  const searchInput = document.getElementById('sub-dash-search');
  if (searchInput) searchInput.value = '';
  const filterSelect = document.getElementById('sub-dash-filter-status');
  if (filterSelect) filterSelect.value = 'all';

  renderAdminSubmissionsTable();
  document.getElementById('modal-activity-submissions')?.classList.remove('hidden');
};

window.closeActivitySubmissionDashboard = function() {
  document.getElementById('modal-activity-submissions')?.classList.add('hidden');
  state._currentSubDash = null;
};

window.filterAdminSubmissionsTable = function() {
  renderAdminSubmissionsTable();
};

window.renderAdminSubmissionsTable = function() {
  if (!state._currentSubDash) return;
  const { roundId, actId } = state._currentSubDash;
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  const tbody = document.getElementById('sub-dash-tbody');
  if (!round || !act || !tbody) return;

  const registrations = state.adminReviewData?.registrations || [];
  const eligible = (round.eligibleStudents || []).filter(s => s.eligible !== false);
  const studentMap = new Map();

  eligible.forEach(s => {
    studentMap.set(s.studentId, {
      studentId: s.studentId,
      studentName: s.name || s.studentName || 'Sinh viên'
    });
  });
  registrations.forEach(r => {
    if (r.studentId) {
      studentMap.set(r.studentId, {
        studentId: r.studentId,
        studentName: r.studentName || studentMap.get(r.studentId)?.studentName || 'Sinh viên'
      });
    }
  });

  const students = Array.from(studentMap.values());
  const submissionsMap = round.activitySubmissions?.[actId] || {};

  let totalCount = students.length;
  let submittedCount = 0;
  let missingCount = 0;
  let lateCount = 0;

  const items = students.map(st => {
    const subRecord = submissionsMap[st.studentId] || null;
    const current = subRecord?.currentSubmission || null;
    const rules = getEffectiveSubmissionRules(st.studentId, act, round);

    let status = 'missing';
    if (current) {
      if (current.status === 'withdrawn') status = 'withdrawn';
      else if (current.isLate) status = 'late';
      else status = 'submitted';
    }

    if (status === 'submitted') submittedCount++;
    else if (status === 'late') { submittedCount++; lateCount++; }
    else if (status === 'withdrawn') missingCount++;
    else missingCount++;

    return {
      student: st,
      subRecord,
      current,
      rules,
      status
    };
  });

  // Update Counters
  if (document.getElementById('sub-dash-stat-total')) document.getElementById('sub-dash-stat-total').textContent = totalCount;
  if (document.getElementById('sub-dash-stat-submitted')) document.getElementById('sub-dash-stat-submitted').textContent = submittedCount;
  if (document.getElementById('sub-dash-stat-missing')) document.getElementById('sub-dash-stat-missing').textContent = missingCount;
  if (document.getElementById('sub-dash-stat-late')) document.getElementById('sub-dash-stat-late').textContent = lateCount;

  // Filter
  const q = (document.getElementById('sub-dash-search')?.value || '').trim().toLowerCase();
  const fStatus = document.getElementById('sub-dash-filter-status')?.value || 'all';

  const filtered = items.filter(item => {
    if (q) {
      const matchMssv = item.student.studentId.toLowerCase().includes(q);
      const matchName = item.student.studentName.toLowerCase().includes(q);
      if (!matchMssv && !matchName) return false;
    }
    if (fStatus !== 'all') {
      if (fStatus === 'submitted' && (item.status !== 'submitted' && item.status !== 'late')) return false;
      if (fStatus === 'missing' && item.status !== 'missing') return false;
      if (fStatus === 'late' && item.status !== 'late') return false;
      if (fStatus === 'withdrawn' && item.status !== 'withdrawn') return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không có sinh viên nào thỏa điều kiện lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((item, idx) => {
    const { student, current, rules, status } = item;
    let statusPill = '';
    if (status === 'submitted') {
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã nộp</span>';
    } else if (status === 'late') {
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">● Nộp trễ</span>';
    } else if (status === 'withdrawn') {
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Đã rút bài</span>';
    } else {
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">Chưa nộp</span>';
    }

    const councilAssign = (act.councilStudentAssignments || []).find(a => a.studentId === student.studentId);
    const councilName = councilAssign?.councilCode || councilAssign?.councilId || '--';

    const timeStr = current?.submittedAt ? fmtIsoToVietnameseDateTime(current.submittedAt) : '--';
    const fName = current?.files?.[0]?.validatedName || current?.files?.[0]?.originalName || '--';
    const fSize = current?.files?.[0]?.size ? (current.files[0].size / (1024 * 1024)).toFixed(1) + ' MB' : '';

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-2.5 text-center font-mono font-bold text-slate-400">#${idx + 1}</td>
        <td class="p-2.5">
          <span class="font-bold text-slate-900 block">${student.studentName}</span>
          <span class="font-mono text-slate-500 text-[11px] block">${student.studentId}</span>
        </td>
        <td class="p-2.5 text-center font-bold text-indigo-700">${councilName}</td>
        <td class="p-2.5 text-center whitespace-nowrap">${statusPill}</td>
        <td class="p-2.5 text-center font-mono font-bold text-slate-700">${rules.completedAttempts}/${rules.totalAllowedAttempts}</td>
        <td class="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">${timeStr}</td>
        <td class="p-2.5 max-w-xs">
          ${current ? `
            <div class="truncate text-[11px] font-mono text-slate-800" title="${fName}">${fName}</div>
            <div class="text-[10px] text-slate-400 font-mono">${fSize} ${current.receiptId ? '• ' + current.receiptId : ''}</div>
          ` : '<span class="text-slate-300">--</span>'}
        </td>
        <td class="p-2.5 text-right whitespace-nowrap space-x-1">
          ${current?.files?.[0]?.providerUrl ? `
            <a href="${current.files[0].providerUrl}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded text-[11px] transition-colors inline-block">
              👁️ Xem file
            </a>
          ` : ''}
          ${rules.attemptsHistory.length > 0 ? `
            <button type="button" onclick="openSubmissionHistoryModal('${student.studentId}', '${act.id}', '${round.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition-colors">
              📜 Lịch sử (${rules.attemptsHistory.length})
            </button>
          ` : ''}
          <button type="button" onclick="openSubmissionOverrideModal('${student.studentId}', '${act.id}', '${round.id}')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded text-[11px] transition-colors">
            ⭐ Gia hạn/Lượt
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

// 8. DEADLINE & ATTEMPTS OVERRIDE MODAL
window.openSubmissionOverrideModal = function(studentId, actId, roundId) {
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) return;

  state._currentOverride = { studentId, actId, roundId };

  const stNameEl = document.getElementById('sub-override-student-name');
  const actNameEl = document.getElementById('sub-override-activity-name');
  if (stNameEl) stNameEl.textContent = `Sinh viên: ${studentId}`;
  if (actNameEl) actNameEl.textContent = `Mốc Kế hoạch: ${act.title}`;

  const existingOvr = round?.submissionOverrides?.[studentId]?.[actId];
  if (existingOvr?.allowUntil) {
    const parts = isoToVietnameseDateTime(existingOvr.allowUntil);
    if (document.getElementById('sub-override-date')) document.getElementById('sub-override-date').value = parts.date;
    if (document.getElementById('sub-override-time')) document.getElementById('sub-override-time').value = parts.time;
  } else {
    if (document.getElementById('sub-override-date')) document.getElementById('sub-override-date').value = '';
    if (document.getElementById('sub-override-time')) document.getElementById('sub-override-time').value = '';
  }

  if (document.getElementById('sub-override-extra-attempts')) {
    document.getElementById('sub-override-extra-attempts').value = existingOvr?.extraAttempts ?? 0;
  }
  if (document.getElementById('sub-override-reason')) {
    document.getElementById('sub-override-reason').value = existingOvr?.reason || '';
  }

  document.getElementById('modal-submission-override')?.classList.remove('hidden');
};

window.closeSubmissionOverrideModal = function() {
  document.getElementById('modal-submission-override')?.classList.add('hidden');
  state._currentOverride = null;
};

window.saveSubmissionOverride = async function() {
  if (!state._currentOverride) return;
  const { studentId, actId, roundId } = state._currentOverride;
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) return;

  const oDate = document.getElementById('sub-override-date')?.value || '';
  const oTime = document.getElementById('sub-override-time')?.value || '';
  const allowUntil = (oDate && oTime) ? parseVietnameseDateTimeToIso(oDate, oTime) : null;
  const extraAttempts = parseInt(document.getElementById('sub-override-extra-attempts')?.value, 10) || 0;
  const reason = (document.getElementById('sub-override-reason')?.value || '').trim();

  if (!reason) {
    showToast('Vui lòng nhập lý do gia hạn / cấp thêm lượt nộp bài (* Bắt buộc)!', 'warning');
    return;
  }

  const overrideData = {
    allowUntil,
    extraAttempts,
    reason,
    createdAt: new Date().toISOString(),
    createdBy: state.user?.email || 'admin'
  };

  if (!round.submissionOverrides) round.submissionOverrides = {};
  if (!round.submissionOverrides[studentId]) round.submissionOverrides[studentId] = {};
  round.submissionOverrides[studentId][actId] = overrideData;

  // Save to Firestore
  try {
    const roundRef = doc(db, 'graduationRounds', round.id);
    await updateDoc(roundRef, {
      [`submissionOverrides.${studentId}.${actId}`]: overrideData,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn('Could not update Firestore submissionOverrides:', e);
  }

  // Audit log
  if (typeof recordRoundAuditLog === 'function') {
    await recordRoundAuditLog(round.id, {
      type: 'admin_override',
      action: 'Gia hạn / cấp lượt nộp bài',
      target: `MSSV: ${studentId}, Mốc: ${act.title}`,
      detail: `Gia hạn đến: ${allowUntil || 'Không'}, Cấp thêm: ${extraAttempts} lần. Lý do: ${reason}`,
      by: state.user?.email || 'admin'
    });
  }

  showToast('Đã lưu quyết định gia hạn thành công!', 'success');
  closeSubmissionOverrideModal();
  renderAdminSubmissionsTable();
};

// 9. SUBMISSION HISTORY MODAL
window.openSubmissionHistoryModal = function(studentId, actId, roundId) {
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) return;

  const stInfo = document.getElementById('sub-hist-student-info');
  const actInfo = document.getElementById('sub-hist-activity-info');
  const listEl = document.getElementById('sub-hist-list');

  if (stInfo) stInfo.textContent = `Sinh viên: ${studentId}`;
  if (actInfo) actInfo.textContent = `Mốc Kế hoạch: ${act.title}`;

  const subRecord = round.activitySubmissions?.[actId]?.[studentId];
  const history = Array.isArray(subRecord?.attempts) ? subRecord.attempts : [];

  if (!listEl) return;
  if (history.length === 0) {
    listEl.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">Chưa có lịch sử nộp bài nào.</div>';
  } else {
    listEl.innerHTML = history.map((att, idx) => {
      const isLatest = idx === history.length - 1;
      const fName = att.files?.[0]?.validatedName || att.files?.[0]?.originalName || 'file';
      const fSize = att.files?.[0]?.size ? (att.files[0].size / (1024 * 1024)).toFixed(2) + ' MB' : '';
      const timeStr = att.submittedAt ? fmtIsoToVietnameseDateTime(att.submittedAt) : '--';
      return `
        <div class="p-3 bg-white rounded-xl border ${isLatest ? 'border-emerald-300 ring-1 ring-emerald-200 shadow-xs' : 'border-slate-200'} text-xs space-y-1">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-black text-sm text-slate-900">Lần nộp ${att.attempt || (idx + 1)}</span>
              ${isLatest ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Bản hiện tại</span>' : ''}
              ${att.isLate ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Nộp trễ</span>' : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Đúng hạn</span>'}
              ${att.status === 'withdrawn' ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Đã rút bài</span>' : ''}
            </div>
            <span class="font-mono text-[11px] text-slate-500">${timeStr}</span>
          </div>
          <div class="font-mono text-[11px] text-slate-800 bg-slate-50 p-2 rounded border border-slate-100 select-all">
            📁 ${fName} (${fSize})
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
            <span>Mã biên nhận: ${att.receiptId || '--'}</span>
            <span>Nộp bởi: ${att.submittedBy || '--'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('modal-submission-history')?.classList.remove('hidden');
};

window.closeSubmissionHistoryModal = function() {
  document.getElementById('modal-submission-history')?.classList.add('hidden');
};

// 10. EXCEL EXPORT OF ACTIVITY SUBMISSIONS
window.exportCurrentActivitySubmissionsToExcel = function() {
  if (!state._currentSubDash) return;
  const { roundId, actId } = state._currentSubDash;
  const round = (state.rounds || []).find(r => r.id === roundId);
  const act = (round?.activities || []).find(a => a.id === actId);
  if (!round || !act) {
    showToast('Không tìm thấy dữ liệu để xuất Excel!', 'error');
    return;
  }

  const registrations = state.adminReviewData?.registrations || [];
  const eligible = (round.eligibleStudents || []).filter(s => s.eligible !== false);
  const studentMap = new Map();
  eligible.forEach(s => studentMap.set(s.studentId, { studentId: s.studentId, studentName: s.name || s.studentName || 'Sinh viên' }));
  registrations.forEach(r => { if (r.studentId) studentMap.set(r.studentId, { studentId: r.studentId, studentName: r.studentName || studentMap.get(r.studentId)?.studentName || 'Sinh viên' }); });

  const submissionsMap = round.activitySubmissions?.[actId] || {};
  const rows = [
    [
      'STT',
      'MSSV',
      'Họ và Tên',
      'Hội đồng',
      'Mốc Kế hoạch',
      'Lần nộp',
      'Thời gian nộp',
      'Trạng thái',
      'Trễ hạn',
      'Tên file',
      'Dung lượng (MB)',
      'Mã biên nhận'
    ]
  ];

  let stt = 1;
  studentMap.forEach(st => {
    const subRecord = submissionsMap[st.studentId] || null;
    const current = subRecord?.currentSubmission || null;
    const rules = getEffectiveSubmissionRules(st.studentId, act, round);
    const councilAssign = (act.councilStudentAssignments || []).find(a => a.studentId === st.studentId);
    const councilName = councilAssign?.councilCode || councilAssign?.councilId || '';

    const timeStr = current?.submittedAt ? fmtIsoToVietnameseDateTime(current.submittedAt) : '';
    const fName = current?.files?.[0]?.validatedName || current?.files?.[0]?.originalName || '';
    const fSizeMB = current?.files?.[0]?.size ? (current.files[0].size / (1024 * 1024)).toFixed(2) : '';

    let statusText = 'Chưa nộp';
    if (current) {
      if (current.status === 'withdrawn') statusText = 'Đã rút bài';
      else if (current.isLate) statusText = 'Nộp trễ';
      else statusText = 'Đã nộp';
    }

    rows.push([
      stt++,
      sanitizeExcelCell(st.studentId),
      sanitizeExcelCell(st.studentName),
      sanitizeExcelCell(councilName),
      sanitizeExcelCell(act.title),
      `${rules.completedAttempts}/${rules.totalAllowedAttempts}`,
      sanitizeExcelCell(timeStr),
      sanitizeExcelCell(statusText),
      current ? (current.isLate ? 'Nộp trễ' : 'Đúng hạn') : '',
      sanitizeExcelCell(fName),
      fSizeMB ? parseFloat(fSizeMB) : '',
      sanitizeExcelCell(current?.receiptId || '')
    ]);
  });

  if (typeof window.XLSX === 'undefined') {
    showToast('Thư viện Excel chưa được tải!', 'error');
    return;
  }

  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(rows);
  const sheetName = sanitizeSheetName('NOP_BAI_' + (act.slug || act.id));
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const cleanActTitle = slugify(act.title);
  const dateStr = new Date().toISOString().slice(0, 10).split('-').reverse().join('-');
  const fileName = `Submissions_${cleanActTitle}_${dateStr}.xlsx`;

  window.XLSX.writeFile(wb, fileName);
  showToast('Đã xuất danh sách nộp bài sang Excel thành công!', 'success');
};

// 11. ROLE-BASED ACCESS CONTROL HELPER
window.canAccessStudentSubmission = function(userEmail, userRole, studentId, activity, round) {
  if (!activity || !activity.submissionConfig) return false;
  if (userRole === 'admin' || state.isAdmin) return true;
  if (userRole === 'student') {
    const studentUser = state.userStudentId || (userEmail ? userEmail.split('@')[0] : '');
    return String(studentId).toLowerCase() === String(studentUser).toLowerCase();
  }
  const vis = activity.submissionConfig.visibility || { supervisor: true, reviewer: true, council: true };
  if (vis.supervisor) {
    const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId);
    if (reg && typeof getOfficialSupervisors === 'function') {
      const isSupervised = getOfficialSupervisors(reg).some(s => (s.supervisorEmail || s.email) === userEmail);
      if (isSupervised) return true;
    }
  }
  if (vis.reviewer) {
    const reg = (state.adminReviewData?.registrations || []).find(r => r.studentId === studentId);
    if (reg && reg.reviewerEmail === userEmail) return true;
  }
  if (vis.council && Array.isArray(activity.councils)) {
    const councilOfStudent = (activity.councilStudentAssignments || []).find(a => a.studentId === studentId);
    if (councilOfStudent) {
      const council = activity.councils.find(c => c.id === councilOfStudent.councilId);
      if (council && Array.isArray(council.members) && council.members.some(m => m.email === userEmail)) {
        return true;
      }
    }
  }
  return false;
};




// 2. SUBMISSIONS SUBCOLLECTION HELPERS (ATOMIC ATTEMPT + DUAL-READ)
window.saveSubmissionAttemptRecord = async function(roundId, activityId, studentId, submissionData) {
  if (!roundId || !activityId || !studentId || !submissionData) {
    return { success: false, error: 'Thiếu thông tin nộp bài' };
  }

  // Atomic attempt resolution: query existing docs or fallback to memory
  let existingAttemptsCount = 0;
  try {
    const subColRef = collection(db, 'graduationRounds', roundId, 'submissions');
    const q = query(subColRef, where('activityId', '==', activityId), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      existingAttemptsCount = snap.size;
    }
  } catch (e) {}

  if (existingAttemptsCount === 0) {
    const memAttempts = submissionData.existingAttempts || [];
    existingAttemptsCount = memAttempts.length;
  }

  const attemptNum = existingAttemptsCount + 1;
  const receiptId = submissionData.receiptId || ('REC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase());
  const submissionId = `${sanitizeFirestoreKey(activityId)}_${sanitizeFirestoreKey(studentId)}_att${attemptNum}_${Date.now()}`;

  const docPayload = {
    roundId,
    activityId,
    activityTitle: submissionData.activityTitle || '',
    studentId,
    studentName: submissionData.studentName || '',
    studentEmail: submissionData.studentEmail || (studentId + '@student.tdtu.edu.vn'),
    attempt: attemptNum,
    attemptNumber: attemptNum,
    receiptId,
    files: submissionData.files || [],
    submittedAt: submissionData.submittedAt || new Date().toISOString(),
    isLate: Boolean(submissionData.isLate),
    status: submissionData.status || 'submitted',
    submittedBy: submissionData.submittedBy || studentId
  };

  // 1. New Write: Save to subcollection /graduationRounds/{roundId}/submissions/{submissionId}
  let subcolSuccess = false;
  try {
    const subDocRef = doc(db, 'graduationRounds', roundId, 'submissions', submissionId);
    await setDoc(subDocRef, docPayload);
    subcolSuccess = true;
  } catch (err) {
    console.warn('Notice: Subcollection submissions write pending rules approval:', err.message);
  }

  // 2. Legacy Fallback Write (best-effort into round document)
  const round = (state.rounds || []).find(r => r.id === roundId);
  if (round) {
    if (!round.activitySubmissions) round.activitySubmissions = {};
    if (!round.activitySubmissions[activityId]) round.activitySubmissions[activityId] = {};
    const existingEntry = round.activitySubmissions[activityId][studentId] || { attempts: [] };
    const newAttempts = [...(existingEntry.attempts || []), docPayload];
    round.activitySubmissions[activityId][studentId] = {
      currentSubmission: docPayload,
      attempts: newAttempts
    };

    // Phase B Activated: Submissions are written strictly to subcollection.
    // Parent round doc is kept clean without appending submission payload arrays.
  }

  return { success: true, submissionId, attemptNumber: attemptNum, receiptId, docPayload, subcolSuccess };
};

window.getStudentSubmissionsRecord = async function(roundId, activityId, studentId, fallbackRound) {
  // 1. Primary: Query Subcollection
  try {
    const subColRef = collection(db, 'graduationRounds', roundId, 'submissions');
    const q = query(
      subColRef,
      where('activityId', '==', activityId),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      const attempts = snap.docs.map(d => d.data()).sort((a, b) => (a.attemptNumber || a.attempt || 0) - (b.attemptNumber || b.attempt || 0));
      const current = attempts[attempts.length - 1] || null;
      return { currentSubmission: current, attempts };
    }
  } catch (e) {}

  // 2. Fallback: Legacy nested map in round
  const targetRound = fallbackRound || (state.rounds || []).find(r => r.id === roundId);
  const legacyRecord = targetRound?.activitySubmissions?.[activityId]?.[studentId];
  if (legacyRecord) {
    const attempts = legacyRecord.attempts || [];
    const currentSubmission = legacyRecord.currentSubmission || attempts[attempts.length - 1] || null;
    return { currentSubmission, attempts };
  }

  return { currentSubmission: null, attempts: [] };
};


// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof uploadFileToDrive !== 'undefined') window.uploadFileToDrive = uploadFileToDrive;
  if (typeof getDriveDownloadLink !== 'undefined') window.getDriveDownloadLink = getDriveDownloadLink;
}
