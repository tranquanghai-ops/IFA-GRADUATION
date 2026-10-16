/**
 * IFA+ Graduation — Drive Upload Providers & Student Submission Panel
 */
import { uploadFileToDriveResumable } from './upload-protocol.js';

window.uploadProvider = {
  async upload({ file, student, activity, round, attempt, onProgress, abortSignal }) {
    const providerType = activity?.submissionConfig?.storageProvider || 'google_drive';
    if (window.__DEV_MOCK_UPLOADER === true) {
      return await MockUploader.upload({ file, student, activity, round, attempt, onProgress, abortSignal });
    }
    if (providerType === 'google_drive') {
      return await GoogleDriveTrustedUploader.upload({ file, student, activity, round, attempt, onProgress, abortSignal });
    }
    return {
      success: false,
      status: 'notConfigured',
      error: 'Chưa cấu hình dịch vụ lưu trữ (Storage Provider).'
    };
  }
};

window.GoogleDriveTrustedUploader = {
  async upload({ file, student, activity, round, attempt, onProgress, abortSignal }) {
    if (state.impersonation) {
      assertNotImpersonatingForWrite('Tải lên Google Drive');
      return {
        success: false,
        error: '[CHẾ ĐỘ CHỈ ĐỌC] Không thể tải tệp lên trong chế độ đóng vai.'
      };
    }
    const endpoint = (typeof getGraduationApiBase === 'function')
      ? getGraduationApiBase()
      : (window.IFA_CONFIG?.graduationApiEndpoint || window.IFA_CONFIG?.driveUploadEndpoint || 'https://asia-southeast1-ifa-activities.cloudfunctions.net/graduationApi');
    if (!endpoint) {
      return {
        success: false,
        status: 'backendRequired',
        error: 'Google Drive chưa được kết nối an toàn. Cần cấu hình dịch vụ tải tệp phía máy chủ (Trusted Backend Service).'
      };
    }
    try {
      const idToken = state.user ? await state.user.getIdToken() : null;
      if (!idToken) {
        return { success: false, error: 'Chưa đăng nhập. Vui lòng tải lại trang và đăng nhập lại.' };
      }

      const uploadId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : ('up-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));

      // 1. Create upload session (server-derived folder, no client folder IDOR)
      const sessionRes = await fetch(endpoint + '/api/graduation/upload-session', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + idToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activityId: activity.id,
          roundId: round.id,
          studentId: student.studentId || student.mssv,
          uploadId,
          file: {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size
          }
        }),
        signal: abortSignal
      });

      const sessionData = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok) {
        return { success: false, error: sessionData.error || `Lỗi máy chủ (${sessionRes.status}).` };
      }

      const sessionUri = sessionData.sessionUri;
      if (!sessionUri) {
        return { success: false, error: 'Không thể tạo phiên tải lên (Session URI rỗng).' };
      }

      // 2. Resumable Chunked Upload Engine (32 MiB chunks, 256 KiB alignment, auto resume/retry)
      const uploaderFn = (typeof uploadFileToDriveResumable === 'function')
        ? uploadFileToDriveResumable
        : window.DriveUploadProtocol?.uploadFileToDriveResumable;

      if (!uploaderFn) {
        throw new Error('Upload protocol engine chưa được nạp.');
      }

      const driveResult = await uploaderFn(sessionUri, file, {
        signal: abortSignal,
        onProgress: (state) => {
          if (typeof onProgress === 'function') {
            onProgress(state.percent, state.message);
          }
        },
      });

      if (!driveResult?.fileId) {
        return { success: false, error: 'Không nhận được mã tệp Google Drive sau khi tải lên.' };
      }

      // 3. Complete & Verify upload integrity on backend
      const performComplete = async () => {
        const freshToken = state.user ? await state.user.getIdToken() : idToken;
        const completeRes = await fetch(endpoint + '/api/graduation/complete', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + freshToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileId: driveResult.fileId,
            activityId: activity.id,
            roundId: round.id,
            uploadId,
          }),
          signal: abortSignal,
        });

        const completeData = await completeRes.json().catch(() => ({}));
        if (!completeRes.ok) {
          throw new Error(completeData.error || `Xác nhận tệp Drive thất bại (HTTP ${completeRes.status}).`);
        }
        return completeData.file || {};
      };

      try {
        const verified = await performComplete();
        return {
          success: true,
          status: 'submitted',
          providerFileId: verified.fileId || driveResult.fileId,
          providerUrl: verified.viewUrl || `https://drive.google.com/file/d/${driveResult.fileId}/view`,
          downloadUrl: verified.downloadUrl || null,
          storageProvider: 'google_drive',
        };
      } catch (completeErr) {
        return {
          success: false,
          canRetryComplete: true,
          driveFileId: driveResult.fileId,
          uploadId,
          retryComplete: async () => {
            const verifiedRetry = await performComplete();
            return {
              success: true,
              status: 'submitted',
              providerFileId: verifiedRetry.fileId || driveResult.fileId,
              providerUrl: verifiedRetry.viewUrl || `https://drive.google.com/file/d/${driveResult.fileId}/view`,
              downloadUrl: verifiedRetry.downloadUrl || null,
              storageProvider: 'google_drive',
            };
          },
          error: completeErr.message || 'Xác nhận tệp Drive thất bại sau khi tải lên.',
        };
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'UPLOAD_CANCELLED') {
        return { success: false, error: 'Đã hủy tải lên.' };
      }
      console.error('[GoogleDriveTrustedUploader] error:', err);
      return { success: false, error: err.message || 'Lỗi hệ thống trong quá trình tải lên.' };
    }
  }
};

window.MockUploader = {
  async upload({ file, student, activity, round, attempt, onProgress, abortSignal }) {
    // Only used in DEV/TEST environment when window.__DEV_MOCK_UPLOADER === true
    if (typeof onProgress === 'function') {
      onProgress(30);
      await new Promise(r => setTimeout(r, 20));
      onProgress(75);
      await new Promise(r => setTimeout(r, 20));
      onProgress(100);
    }
    return {
      success: true,
      status: 'submitted',
      providerFileId: 'mock_drive_file_' + Date.now(),
      providerUrl: 'https://drive.google.com/file/d/mock_' + Date.now() + '/view',
      storageProvider: 'google_drive_mock'
    };
  }
};

// 5. CLIENT-SIDE VALIDATION BEFORE UPLOAD
window.validateFileSubmission = function(files, student, activity, round) {
  const cfg = activity?.submissionConfig || {};
  const rules = getEffectiveSubmissionRules(student?.studentId || student?.mssv, activity, round);

  const errors = [];
  if (!files || files.length === 0) {
    errors.push('Vui lòng chọn ít nhất 1 file để nộp!');
    return { valid: false, errors };
  }

  // Max files
  const maxFiles = cfg.maxFiles || 1;
  if (files.length > maxFiles) {
    errors.push(`Số lượng file vượt quá mức cho phép (Tối đa: ${maxFiles} file, hiện chọn: ${files.length} file).`);
  }

  // Attempts check
  if (rules.remainingAttempts <= 0) {
    errors.push(`Bạn đã sử dụng hết ${rules.totalAllowedAttempts} lần nộp cho mốc này.`);
  }

  // Deadline check
  if (rules.isPastDeadline && !rules.allowLate) {
    errors.push('Đã hết hạn nộp bài và mốc này không cho phép nộp trễ.');
  }

  const maxBytes = (cfg.maxFileSizeMB || 100) * 1024 * 1024;
  const maxMb = cfg.maxFileSizeMB || 100;
  const maxLabel = maxMb >= 1024 ? (maxMb / 1024).toFixed(1).replace(/\.0$/, '') + ' GB' : maxMb + ' MB';
  let expectedFilename = '';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // Size check
    if (file.size > maxBytes) {
      errors.push(`File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) vượt quá dung lượng tối đa ${maxLabel}.`);
    }

    // Filename check
    const fnCheck = validateFilename({
      filename: file.name,
      template: cfg.filenameTemplate,
      student,
      activity,
      round,
      fileTypeCategory: cfg.fileTypeCategory,
      mode: cfg.filenameMode,
      acceptedExtensions: cfg.acceptedExtensions
    });

    if (!fnCheck.valid) {
      errors.push(fnCheck.error);
    }
    if (!expectedFilename && fnCheck.expectedFilename) {
      expectedFilename = fnCheck.expectedFilename;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    isLate: rules.isLate,
    rules,
    expectedFilename
  };
};

// 6. STUDENT SUBMISSION PANEL RENDERING IN TIMELINE CARD
window.refreshStudentMilestoneCountdowns = function() {
  document.querySelectorAll('[data-student-countdown-at]').forEach(node => {
    const atStr = node.dataset.studentCountdownAt;
    if (!atStr) return;
    const target = new Date(atStr);
    if (!Number.isFinite(target.getTime())) return;
    const remaining = target.getTime() - Date.now();
    if (remaining <= 0) {
      if (node.dataset.studentCountdownEndAt) {
        const endTarget = new Date(node.dataset.studentCountdownEndAt);
        if (Number.isFinite(endTarget.getTime()) && Date.now() <= endTarget.getTime()) {
          node.textContent = 'Đang diễn ra';
          return;
        }
      }
      node.textContent = node.dataset.studentCountdownDone || 'Đã đến hạn';
      return;
    }
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    node.textContent = `Còn ${days} ngày ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  });
};

function ensureStudentMilestoneCountdownClock() {
  if (window._studentMilestoneCountdownClock) return;
  window._studentMilestoneCountdownClock = window.setInterval(refreshStudentMilestoneCountdowns, 1000);
}
window.ensureStudentMilestoneCountdownClock = ensureStudentMilestoneCountdownClock;

window.renderStudentSubmissionPanel = function(act, round) {
  ensureStudentMilestoneCountdownClock();
  const userMssv = state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const targetStudent =
    (round?.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.adminReviewData?.registrations || []).find(r => r.studentId === userMssv) || {
      studentId: userMssv,
      studentName: getEffectiveActor().displayName || (userMssv ? userMssv : 'Sinh viên')
    };

  const cfg = act.submissionConfig || {};
  const rules = getEffectiveSubmissionRules(userMssv, act, round);

  // Status Badge
  let statusBadge = '';
  if (rules.currentSubmission && rules.currentSubmission.status === 'submitted') {
    statusBadge = rules.currentSubmission.isLate
      ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">● Nộp trễ</span>'
      : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Đã nộp bài</span>';
  } else if (rules.isNotStarted) {
    statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">○ Chưa mở nhận bài</span>';
  } else if (rules.isPastDeadline) {
    statusBadge = rules.allowLate
      ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">● Đang nhận nộp trễ</span>'
      : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">✕ Đã hết hạn</span>';
  } else if (rules.isNearDeadline) {
    statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-400 animate-pulse">⚠️ Sắp hết hạn</span>';
  } else {
    statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">● Đang nhận bài</span>';
  }

  const deadlineStr = rules.effectiveDeadline ? fmtIsoToVietnameseDateTime(rules.effectiveDeadline.toISOString()) : 'Không giới hạn';
  const deadlineCountdown = rules.effectiveDeadline && Number.isFinite(rules.effectiveDeadline.getTime())
    ? `<div class="p-3.5 sm:p-4 rounded-2xl border-2 border-rose-300 bg-rose-50/90 shadow-sm" aria-live="off">
         <div class="flex flex-wrap items-center justify-between gap-3">
           <div class="flex items-center gap-2.5 sm:gap-3 text-slate-900">
             <span class="text-2xl sm:text-3xl select-none leading-none">⏳</span>
             <div>
               <span class="text-[11px] sm:text-xs font-black uppercase tracking-wider text-rose-700 block">Thời gian còn lại đến hạn chót</span>
               <span class="text-xs sm:text-sm font-bold text-slate-700">Kết thúc nhận bài:</span>
             </div>
           </div>
           <div class="text-right ml-auto sm:ml-0">
             <strong data-student-countdown-at="${escapeHtml(rules.effectiveDeadline.toISOString())}" data-student-countdown-done="Đã hết hạn" class="text-rose-600 font-black font-mono text-base sm:text-xl lg:text-2xl tracking-tight block">Đang tính…</strong>
           </div>
         </div>
       </div>` : '';

  const acceptAttr = (cfg.acceptedExtensions || ['pdf']).map(e => '.' + e.replace(/^\./, '')).join(',');
  const isMultiple = (cfg.maxFiles || 1) > 1;

  // History html
  let historyHtml = '';
  if (rules.attemptsHistory.length > 0) {
    historyHtml = `
      <div class="mt-3 pt-3 border-t border-emerald-200/70 space-y-1.5">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-bold text-slate-700">Lịch sử các lần nộp bài:</span>
          <span class="text-slate-500 font-mono text-[10px]">${rules.completedAttempts}/${rules.totalAllowedAttempts} lần</span>
        </div>
        <div class="space-y-1.5">
          ${rules.attemptsHistory.map((att, idx) => {
            const isLatest = idx === rules.attemptsHistory.length - 1;
            const timeFormatted = att.submittedAt ? fmtIsoToVietnameseDateTime(att.submittedAt) : '--';
            const fName = att.files?.[0]?.validatedName || att.files?.[0]?.originalName || 'file';
            const fSize = att.files?.[0]?.size ? (att.files[0].size / (1024 * 1024)).toFixed(1) + ' MB' : '';
            return `
              <div class="p-2.5 bg-white rounded-xl border ${isLatest ? 'border-emerald-300 shadow-xs' : 'border-slate-200 opacity-90'} flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold ${isLatest ? 'text-emerald-900' : 'text-slate-700'}">Lần ${att.attempt || (idx + 1)}</span>
                    ${isLatest ? '<span class="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">Bản hiện tại</span>' : ''}
                    ${att.isLate ? '<span class="text-[9px] bg-rose-100 text-rose-800 font-bold px-1 rounded">Nộp trễ</span>' : '<span class="text-[9px] bg-slate-100 text-slate-600 px-1 rounded">Đúng hạn</span>'}
                    ${att.status === 'withdrawn' ? '<span class="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">Đã rút</span>' : ''}
                  </div>
                  <span class="text-[11px] text-slate-600 font-mono block truncate max-w-xs mt-0.5">${fName} (${fSize})</span>
                  <span class="text-[10px] text-slate-400 font-mono block">Biên nhận: ${att.receiptId || '--'} • ${timeFormatted}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  ${isLatest && att.status !== 'withdrawn' ? `
                    <button type="button" onclick="withdrawStudentSubmission('${act.id}', ${att.attempt || 1}, '${round.id}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer">
                      Rút bài
                    </button>
                  ` : ''}
                  ${state.isAdmin && att.status !== 'withdrawn' ? `
                    <button type="button" onclick="adminDeleteStudentSubmission('${userMssv}', '${act.id}', '${round.id}', ${att.attempt || (idx + 1)})" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer" title="Admin xóa bài nộp sai để sinh viên nộp lại">
                      🗑️ Xóa bài (Admin)
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div id="sub-panel-${act.id}" class="mt-3 p-3.5 bg-emerald-50/70 border border-emerald-200 text-slate-800 rounded-2xl text-xs space-y-3 shadow-xs">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/70 pb-3">
        <div class="flex items-center gap-2.5">
          <span class="text-2xl sm:text-3xl select-none leading-none">📥</span>
          <div>
            <span class="font-black text-emerald-950 text-sm sm:text-base tracking-tight block">Nộp bài trực tuyến</span>
            <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span class="text-xs sm:text-sm text-emerald-900 font-bold">Hạn nộp:</span>
              <span class="text-xs sm:text-sm font-black font-mono px-2.5 py-0.5 rounded-lg bg-emerald-100/90 text-emerald-950 border border-emerald-300 shadow-2xs">${deadlineStr}</span>
            </div>
          </div>
        </div>
        <div class="shrink-0">
          ${statusBadge}
        </div>
      </div>

      ${deadlineCountdown}

      <!-- Constraints notice -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-slate-200/80">
        <div>
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Định dạng</span>
          <span class="font-bold text-slate-800">${(cfg.acceptedExtensions || ['pdf']).map(e => e.toUpperCase()).join(', ')}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Dung lượng tối đa</span>
          <span class="font-bold text-slate-800">≤ ${(cfg.maxFileSizeMB || 100) >= 1024 ? ((cfg.maxFileSizeMB || 100) / 1024).toFixed(1).replace(/\.0$/, '') + ' GB' : (cfg.maxFileSizeMB || 100) + ' MB'}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Số file</span>
          <span class="font-bold text-slate-800">${cfg.maxFiles || 1} file</span>
        </div>
        <div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-slate-400 block uppercase font-bold">Số lần đã nộp / Tối đa</span>
            ${state.isAdmin ? `
              <button type="button" onclick="openSubmissionOverrideModal('${userMssv}', '${act.id}', '${round.id}')" title="Cấp thêm lượt cho sinh viên" class="text-[10px] px-1.5 py-0.2 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded cursor-pointer transition-colors">
                + Thêm lượt
              </button>
            ` : ''}
          </div>
          <span class="font-bold font-mono text-xs sm:text-sm ${rules.remainingAttempts > 0 ? 'text-emerald-700' : 'text-rose-600'}">
            ${rules.completedAttempts}/${rules.totalAllowedAttempts} lần${rules.remainingAttempts <= 0 ? ' – Hết lượt nộp' : ''}
          </span>
        </div>
      </div>

      <!-- Override notice if applicable -->
      ${rules.isExtended ? `
        <div class="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
          <span>⭐</span>
          <span>Bạn được gia hạn nộp bài riêng đến: <strong>${fmtIsoToVietnameseDateTime(rules.effectiveDeadline.toISOString())}</strong></span>
        </div>
      ` : ''}
      ${rules.extraAttempts > 0 ? `
        <div class="p-2 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 font-semibold flex items-center gap-1.5">
          <span>⭐</span>
          <span>Bạn được cấp thêm <strong>${rules.extraAttempts}</strong> lần nộp bài.</span>
        </div>
      ` : ''}

      <!-- Official Submission View Card (Ưu tiên 5) -->
      ${(rules.currentSubmission && rules.currentSubmission.status === 'submitted') ? (() => {
        const currentFile = rules.currentSubmission.files?.[0] || {};
        const viewUrl = currentFile.providerUrl || currentFile.viewUrl || (currentFile.providerFileId ? `https://drive.google.com/file/d/${currentFile.providerFileId}/view` : '');
        const downloadUrl = currentFile.downloadUrl || (currentFile.providerFileId ? `https://drive.google.com/uc?id=${currentFile.providerFileId}&export=download` : '');
        const fSizeStr = currentFile.size ? (currentFile.size >= 1024 * 1024 ? (currentFile.size / (1024 * 1024)).toFixed(2) + ' MB' : (currentFile.size / 1024).toFixed(1) + ' KB') : '';
        const timeStr = rules.currentSubmission.submittedAt ? fmtIsoToVietnameseDateTime(rules.currentSubmission.submittedAt) : '--';
        return `
        <div class="p-3.5 bg-white border-2 border-emerald-300 rounded-2xl text-xs space-y-2.5 shadow-xs">
          <div class="flex items-center justify-between border-b border-emerald-100 pb-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-base select-none">📌</span>
              <span class="font-black text-emerald-950 uppercase tracking-wide text-xs">BÀI ĐÃ NỘP GẦN NHẤT</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                Lần ${rules.currentSubmission.attempt || rules.completedAttempts}/${rules.totalAllowedAttempts}
              </span>
              ${rules.currentSubmission.isLate
                ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">Nộp trễ</span>'
                : '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">Đúng hạn</span>'}
            </div>
            <span class="text-[10px] font-mono text-slate-400">Biên nhận: ${rules.currentSubmission.receiptId || '--'}</span>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-xl select-none leading-none">📄</span>
                <span class="font-bold text-slate-900 truncate text-xs sm:text-sm font-mono block" title="${escapeHtml(currentFile.validatedName || currentFile.originalName || 'file')}">
                  ${escapeHtml(currentFile.validatedName || currentFile.originalName || 'Tài liệu đã nộp')}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pl-7">
                ${fSizeStr ? `<span><b>Dung lượng:</b> ${fSizeStr}</span>` : ''}
                <span><b>Thời gian nộp:</b> ${timeStr}</span>
              </div>
            </div>

            <div class="shrink-0 flex items-center gap-2 pl-7 sm:pl-0">
              ${viewUrl ? `
                <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" id="btn-view-submission-${act.id}" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-xs text-xs transition-all cursor-pointer" title="Mở xem file trên Google Drive">
                  👁️ Xem bài đã nộp
                </a>
              ` : ''}
              ${downloadUrl ? `
                <a href="${downloadUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl border border-slate-300 text-xs transition-all cursor-pointer" title="Tải file về máy">
                  📥 Tải về
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      })() : ''}

      <!-- Upload Section -->
      <div class="space-y-2">
        <div class="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <!-- Left: File Selector + Selected File Display -->
            <div class="flex items-center gap-2.5 flex-1 min-w-0">
              <input type="file" id="sub-input-file-${act.id}" accept="${acceptAttr}" ${isMultiple ? 'multiple' : ''} onchange="onStudentFileSelected('${act.id}')" ${!rules.canSubmit ? 'disabled' : ''} class="hidden">
              <label for="sub-input-file-${act.id}" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all select-none ${rules.canSubmit ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-2xs cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}">
                <span>📎</span>
                <span>Chọn file</span>
              </label>
              <div id="sub-selected-file-info-${act.id}" class="flex-1 min-w-0 text-xs text-slate-700">
                <span id="sub-no-file-text-${act.id}" class="text-slate-400 italic text-[11px] block truncate">Chưa có tệp nào được chọn...</span>
              </div>
            </div>

            <!-- Right: Submit Button -->
            <div class="shrink-0 sm:ml-auto flex items-center gap-2">
              ${rules.remainingAttempts <= 0 ? `
                <button type="button" id="btn-submit-file-${act.id}" disabled class="w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-500 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-300">
                  🚫 Đã hết lượt nộp
                </button>
              ` : (rules.isNotStarted ? `
                <button type="button" id="btn-submit-file-${act.id}" disabled class="w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-500 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-300">
                  ⏳ Chưa mở nhận bài
                </button>
              ` : (rules.isPastDeadline && !rules.allowLate ? `
                <button type="button" id="btn-submit-file-${act.id}" disabled class="w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-500 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-300">
                  ⏰ Đã hết hạn nộp bài
                </button>
              ` : (!act.submissionEnabled ? `
                <button type="button" id="btn-submit-file-${act.id}" disabled class="w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-500 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-300">
                  🔒 Mốc đã khóa nhận bài
                </button>
              ` : `
                <button type="button" id="btn-submit-file-${act.id}" onclick="submitStudentFiles('${act.id}')" class="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-xs text-xs transition-colors cursor-pointer">
                  📤 Nộp bài (Lần ${rules.completedAttempts + 1}/${rules.totalAllowedAttempts})
                </button>
              `)))}
            </div>
          </div>

          <!-- Upload Progress -->
          <div id="sub-progress-wrap-${act.id}" class="hidden mt-2.5 pt-2 border-t border-slate-100 space-y-1">
            <div class="flex items-center justify-between text-[11px] font-semibold">
              <span id="sub-progress-text-${act.id}" class="text-emerald-800">Đang tải: 0%</span>
              <button type="button" onclick="cancelStudentUpload('${act.id}')" class="text-rose-600 hover:underline font-bold text-[10px]">Hủy tải</button>
            </div>
            <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div id="sub-progress-bar-${act.id}" class="bg-emerald-600 h-2 transition-all duration-200" style="width: 0%"></div>
            </div>
          </div>

          <!-- Error notice box -->
          <div id="sub-error-box-${act.id}" class="hidden mt-2.5 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[11px] space-y-1">
          </div>
        </div>
      </div>

      ${historyHtml}
    </div>
  `;
};

window.onStudentFileSelected = function(actId) {
  const round = (state.rounds || []).find(r => r.id === state.selectedRoundId) || state.rounds?.[0];
  const act = (round?.activities || []).find(a => a.id === actId);
  const fileInput = document.getElementById('sub-input-file-' + actId);
  const infoEl = document.getElementById('sub-selected-file-info-' + actId);
  const errBox = document.getElementById('sub-error-box-' + actId);
  const submitBtn = document.getElementById('btn-submit-file-' + actId);

  if (errBox) errBox.classList.add('hidden');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (infoEl) {
      infoEl.innerHTML = `<span id="sub-no-file-text-${actId}" class="text-slate-400 italic text-[11px] block truncate">Chưa có tệp nào được chọn...</span>`;
    }
    return;
  }

  const files = Array.from(fileInput.files);
  const userMssv = state.userStudentId || (state.user?.email ? state.user.email.split('@')[0] : '');
  const targetStudent =
    (round?.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.eligibleStudents || []).find(s => (s.studentId || s.mssv) === userMssv) ||
    (state.adminReviewData?.registrations || []).find(r => r.studentId === userMssv) || {
      studentId: userMssv,
      studentName: getEffectiveActor().displayName || (userMssv ? userMssv : 'Sinh viên')
    };

  // Immediate automatic client validation (Ưu tiên 4 - Tự kiểm tra không cần bấm nút)
  const valRes = typeof validateFileSubmission === 'function'
    ? validateFileSubmission(files, targetStudent, act, round)
    : { valid: true, errors: [] };

  if (!valRes.valid) {
    if (errBox) {
      errBox.innerHTML = `<strong>⚠️ Tệp không hợp lệ:</strong><br>${valRes.errors.map(e => '• ' + e).join('<br>')}`;
      errBox.classList.remove('hidden');
    }
    if (infoEl) {
      const f = files[0];
      const mb = (f.size / (1024 * 1024)).toFixed(2);
      infoEl.innerHTML = `
        <div class="flex items-center gap-1.5 min-w-0" title="${escapeHtml(f.name)} (${mb} MB)">
          <span class="font-bold text-rose-700 truncate">${escapeHtml(f.name)}</span>
          <span class="text-slate-500 font-mono text-[11px] shrink-0">(${mb} MB)</span>
          <span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800 shrink-0">⚠️ Không hợp lệ</span>
        </div>
      `;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.className = 'w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-500 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-300';
    }
    return;
  }

  // Valid file selected
  if (infoEl) {
    const f = files[0];
    const mb = (f.size / (1024 * 1024)).toFixed(2);
    const renameNote = valRes.expectedFilename && valRes.expectedFilename !== f.name
      ? `<span class="text-emerald-700 text-[10px] block truncate mt-0.5" title="${escapeHtml(valRes.expectedFilename)}">↳ Chuẩn hóa: ${escapeHtml(valRes.expectedFilename)}</span>`
      : '';
    infoEl.innerHTML = `
      <div class="flex items-center gap-1.5 min-w-0" title="${escapeHtml(f.name)} (${mb} MB)">
        <span class="font-bold text-slate-800 truncate">${escapeHtml(f.name)}</span>
        <span class="text-slate-500 font-mono text-[11px] shrink-0">(${mb} MB)</span>
        <span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 shrink-0">✓ Hợp lệ</span>
      </div>
      ${renameNote}
    `;
  }

  if (submitBtn) {
    const rules = valRes.rules || getEffectiveSubmissionRules(userMssv, act, round);
    if (rules.remainingAttempts > 0 && rules.canSubmit) {
      submitBtn.disabled = false;
      submitBtn.className = 'w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-xs text-xs transition-colors cursor-pointer';
      submitBtn.textContent = `📤 Nộp bài (Lần ${rules.completedAttempts + 1}/${rules.totalAllowedAttempts})`;
    } else {
      submitBtn.disabled = true;
      submitBtn.className = 'w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-500 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-300';
      submitBtn.textContent = '🚫 Đã hết lượt nộp';
    }
  }
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof ensureRoundDriveFolders !== 'undefined') window.ensureRoundDriveFolders = ensureRoundDriveFolders;
  if (typeof parseDriveFolderId !== 'undefined') window.parseDriveFolderId = parseDriveFolderId;
  if (typeof getDriveFolderUrl !== 'undefined') window.getDriveFolderUrl = getDriveFolderUrl;
}
