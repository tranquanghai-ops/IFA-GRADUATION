/**
 * IFA+ Graduation — Drive Upload Providers & Student Submission Panel
 */
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
    const endpoint = window.IFA_CONFIG?.driveUploadEndpoint;
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
          folderId: activity?.submissionConfig?.driveFolderId || activity?.driveFolderId || round?.driveRootFolderId || '1M37ovlEHS3ufftFPZHGj1mQWec7r8Tj7',
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

      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sessionUri, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            xhr.abort();
            resolve({ success: false, error: 'Đã hủy tải lên.' });
          });
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201 || xhr.status === 308) {
            let resObj = {};
            try { resObj = JSON.parse(xhr.responseText); } catch (e) {}
            resolve({
              success: true,
              status: 'submitted',
              providerFileId: resObj.id || 'drive_file_unknown',
              providerUrl: resObj.id ? `https://drive.google.com/file/d/${resObj.id}/view` : null,
              storageProvider: 'google_drive'
            });
          } else {
            resolve({ success: false, error: `Lỗi lưu trữ Drive (${xhr.status}).` });
          }
        };

        xhr.onerror = (e) => {
          console.error('[GoogleDriveTrustedUploader] XHR error:', e, xhr.status, xhr.statusText);
          resolve({ success: false, error: 'Lỗi mạng khi tải lên Drive.' });
        };
        xhr.send(file);
      });
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, error: 'Đã hủy tải lên.' };
      console.error('[GoogleDriveTrustedUploader] error:', err);
      return { success: false, error: 'Lỗi hệ thống trong quá trình tải lên.' };
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
window.renderStudentSubmissionPanel = function(act, round) {
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
              <div class="p-2 bg-white rounded-lg border ${isLatest ? 'border-emerald-300 shadow-xs' : 'border-slate-200 opacity-80'} flex items-center justify-between text-xs">
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
                ${isLatest && att.status !== 'withdrawn' ? `
                  <button type="button" onclick="withdrawStudentSubmission('${act.id}', ${att.attempt || 1}, '${round.id}')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold transition-colors">
                    Rút bài
                  </button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div id="sub-panel-${act.id}" class="mt-3 p-3.5 bg-emerald-50/70 border border-emerald-200 text-slate-800 rounded-2xl text-xs space-y-3 shadow-xs">
      <div class="flex items-center justify-between gap-2 border-b border-emerald-200/70 pb-2">
        <div class="flex items-center gap-2">
          <span class="text-lg">📥</span>
          <div>
            <span class="font-black text-emerald-950 text-xs sm:text-sm block">Nộp bài trực tuyến</span>
            <span class="text-[10px] text-emerald-800 font-mono">Hạn nộp: ${deadlineStr}</span>
          </div>
        </div>
        ${statusBadge}
      </div>

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
          <span class="text-[10px] text-slate-400 block uppercase font-bold">Lượt nộp còn lại</span>
          <span class="font-bold font-mono ${rules.remainingAttempts > 0 ? 'text-emerald-700' : 'text-rose-600'}">${rules.remainingAttempts} / ${rules.totalAllowedAttempts}</span>
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

      <!-- Expected filename display intentionally hidden: system auto-normalizes the uploaded
           file name to the configured template, students can upload with any file name. -->

      <!-- Upload Section -->
      ${rules.canSubmit ? `
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <input type="file" id="sub-input-file-${act.id}" accept="${acceptAttr}" ${isMultiple ? 'multiple' : ''} onchange="onStudentFileSelected('${act.id}')" class="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer">
          </div>
          <div id="sub-selected-file-info-${act.id}" class="hidden p-2 bg-white rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700">
            <!-- Populated on file select -->
          </div>

          <!-- Upload Progress -->
          <div id="sub-progress-wrap-${act.id}" class="hidden space-y-1">
            <div class="flex items-center justify-between text-[11px] font-semibold">
              <span id="sub-progress-text-${act.id}" class="text-emerald-800">Đang tải: 0%</span>
              <button type="button" onclick="cancelStudentUpload('${act.id}')" class="text-rose-600 hover:underline font-bold text-[10px]">Hủy tải</button>
            </div>
            <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div id="sub-progress-bar-${act.id}" class="bg-emerald-600 h-2 transition-all duration-200" style="width: 0%"></div>
            </div>
          </div>

          <!-- Error notice box -->
          <div id="sub-error-box-${act.id}" class="hidden p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[11px] space-y-1">
          </div>

          <div class="flex items-center gap-2 pt-1">
            <button type="button" onclick="checkStudentFileSubmission('${act.id}')" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 transition-colors">
              🔍 Kiểm tra file
            </button>
            <button type="button" id="btn-submit-file-${act.id}" onclick="submitStudentFiles('${act.id}')" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors">
              📤 Nộp bài (Lần ${rules.completedAttempts + 1}/${rules.totalAllowedAttempts})
            </button>
          </div>
        </div>
      ` : `
        <div class="p-3 bg-slate-100 border border-slate-200 rounded-xl text-center text-slate-600 font-semibold text-xs">
          ${rules.remainingAttempts <= 0
            ? 'Bạn đã hết số lần nộp bài cho mốc này.'
            : (rules.isPastDeadline ? 'Mốc này đã kết thúc hạn nộp bài.' : 'Mốc kế hoạch chưa mở nhận bài.')}
        </div>
      `}

      ${historyHtml}
    </div>
  `;
};

window.onStudentFileSelected = function(actId) {
  const fileInput = document.getElementById('sub-input-file-' + actId);
  const infoEl = document.getElementById('sub-selected-file-info-' + actId);
  const errBox = document.getElementById('sub-error-box-' + actId);
  if (errBox) errBox.classList.add('hidden');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    if (infoEl) infoEl.classList.add('hidden');
    return;
  }

  const files = Array.from(fileInput.files);
  const infoText = files.map(f => `• ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`).join('<br>');
  if (infoEl) {
    infoEl.innerHTML = infoText;
    infoEl.classList.remove('hidden');
  }
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof ensureRoundDriveFolders !== 'undefined') window.ensureRoundDriveFolders = ensureRoundDriveFolders;
  if (typeof parseDriveFolderId !== 'undefined') window.parseDriveFolderId = parseDriveFolderId;
  if (typeof getDriveFolderUrl !== 'undefined') window.getDriveFolderUrl = getDriveFolderUrl;
}
