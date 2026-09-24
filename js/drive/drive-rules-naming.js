/**
 * IFA+ Graduation — Drive Filename Templates & Submission Rules
 */
window.normalizeVietnameseNoDiacritics = function(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

window.formatPersonName = function(str) {
  if (!str) return '';
  const noDiacritics = String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D');
  const words = noDiacritics
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

window.generateExpectedFilename = function({ template, student, activity, round, fileTypeCategory, extension, mode }) {
  const tpl = template || '{HOI_DONG}_{MSSV}_{HO_TEN}';
  const mssv = (student?.studentId || student?.mssv || '12100314').trim().toUpperCase();
  const hoTen = formatPersonName(student?.studentName || student?.name || 'Nguyen Van A');
  const rawHoiDong = student?.councilCode || student?.councilId || student?.assignedCouncilName || 'HD1';
  const hoiDong = normalizeVietnameseNoDiacritics(rawHoiDong).replace(/\s+/g, '').toUpperCase() || 'HD1';
  const stt = String(student?.presentationOrder || student?.stt || 1).padStart(2, '0');
  const loai = normalizeVietnameseNoDiacritics(fileTypeCategory || activity?.submissionConfig?.fileTypeCategory || 'THUYET_MINH');
  const actName = normalizeVietnameseNoDiacritics(activity?.title || 'ACTIVITY');
  const rName = normalizeVietnameseNoDiacritics(round?.title || round?.code || 'ROUND');

  let base = tpl
    .replace(/\{MSSV\}/gi, mssv)
    .replace(/\{HO_TEN\}/gi, hoTen)
    .replace(/\{HOI_DONG\}/gi, hoiDong)
    .replace(/\{STT\}/gi, stt)
    .replace(/\{LOAI\}/gi, loai)
    .replace(/\{ACTIVITY\}/gi, actName)
    .replace(/\{ROUND\}/gi, rName);

  base = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D')
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  const ext = extension ? ('.' + String(extension).toLowerCase().replace(/^\./, '')) : '';
  return base + ext;
};

window.validateFilename = function({ filename, template, student, activity, round, fileTypeCategory, mode, acceptedExtensions }) {
  if (!filename) {
    return { valid: false, error: 'Chưa có tệp nào được chọn' };
  }

  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';

  // Extension check
  const allowed = Array.isArray(acceptedExtensions) && acceptedExtensions.length > 0
    ? acceptedExtensions.map(e => String(e).toLowerCase().replace(/^\./, ''))
    : ['pdf'];
  if (!allowed.includes(ext)) {
    return {
      valid: false,
      error: `Định dạng .${ext || 'không đuôi'} không được chấp nhận. Định dạng hợp lệ: ${allowed.map(e => '.' + e).join(', ')}`
    };
  }

  const expectedFilename = generateExpectedFilename({
    template,
    student,
    activity,
    round,
    fileTypeCategory,
    extension: ext,
    mode
  });

  // Filename template is no longer enforced on the original file name: the upload
  // flow renames the file to expectedFilename automatically. Students may upload
  // with any name; validation only checks the extension here.
  return {
    valid: true,
    expectedFilename,
    actualFilename: filename
  };
};

window.updateFilenamePreviewInAdmin = function() {
  const tpl = document.getElementById('sub-filename-template')?.value || '{HOI_DONG}_{MSSV}_{HO_TEN}';
  const loai = document.getElementById('sub-loai-val')?.value || 'THUYET_MINH';
  const mode = document.querySelector('input[name="sub_filename_mode"]:checked')?.value || 'exact';
  const previewEl = document.getElementById('sub-filename-preview');
  if (!previewEl) return;

  const mockStudent = { studentId: '12100314', studentName: 'Nguyễn Văn A', councilCode: 'HD1', presentationOrder: 1 };
  const mockActivity = { title: 'Duyệt 1' };
  const mockRound = { title: 'Đợt 1' };

  const expected = generateExpectedFilename({
    template: tpl,
    student: mockStudent,
    activity: mockActivity,
    round: mockRound,
    fileTypeCategory: loai,
    extension: 'pdf',
    mode
  });

  previewEl.textContent = expected + (mode === 'prefix' ? '  (hoặc bắt đầu bằng mẫu này)' : '');
};

// 2. ACTIVITY FORM HELPERS FOR SUBMISSION CONFIG
window.toggleActivitySubmissionConfig = function(enabled) {
  const panel = document.getElementById('activity-submission-config-panel');
  if (panel) {
    if (enabled) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }
};

window.toggleSubCustomDeadline = function(isCustom) {
  const wrap = document.getElementById('sub-custom-deadline-wrap');
  if (wrap) {
    if (isCustom) wrap.classList.remove('hidden');
    else wrap.classList.add('hidden');
  }
};

window.resetActivitySubmissionForm = function() {
  ['pdf', 'zip', 'rar', '7z', 'jpg', 'png', 'docx', 'xlsx', 'pptx'].forEach(ext => {
    const el = document.getElementById('sub-ext-' + ext);
    if (el) el.checked = (ext === 'pdf');
  });
  if (document.getElementById('sub-ext-custom')) document.getElementById('sub-ext-custom').value = '';
  if (document.getElementById('sub-max-files')) document.getElementById('sub-max-files').value = '1';
  if (document.getElementById('sub-max-size')) document.getElementById('sub-max-size').value = '100';
  if (document.getElementById('sub-max-attempts')) document.getElementById('sub-max-attempts').value = '3';
  
  const endRadio = document.querySelector('input[name="sub_deadline_mode"][value="activity_end"]');
  if (endRadio) endRadio.checked = true;
  toggleSubCustomDeadline(false);
  if (document.getElementById('sub-deadline-date')) document.getElementById('sub-deadline-date').value = '';
  if (document.getElementById('sub-deadline-time')) document.getElementById('sub-deadline-time').value = '';
  if (document.getElementById('sub-allow-late')) document.getElementById('sub-allow-late').checked = false;

  if (document.getElementById('sub-filename-template')) document.getElementById('sub-filename-template').value = '{HOI_DONG}_{MSSV}_{HO_TEN}';
  if (document.getElementById('sub-loai-val')) document.getElementById('sub-loai-val').value = 'THUYET_MINH';
  const exactRadio = document.querySelector('input[name="sub_filename_mode"][value="exact"]');
  if (exactRadio) exactRadio.checked = true;

  if (document.getElementById('sub-vis-supervisor')) document.getElementById('sub-vis-supervisor').checked = true;
  if (document.getElementById('sub-vis-reviewer')) document.getElementById('sub-vis-reviewer').checked = true;
  if (document.getElementById('sub-vis-council')) document.getElementById('sub-vis-council').checked = true;

  if (document.getElementById('sub-storage-provider')) document.getElementById('sub-storage-provider').value = 'google_drive';
  if (document.getElementById('sub-drive-folder-id')) document.getElementById('sub-drive-folder-id').value = '';

  const nameInput = document.getElementById('activity-form-drive-folder-name');
  if (nameInput) nameInput.value = '';
  const idInput = document.getElementById('activity-form-drive-folder-id');
  if (idInput) idInput.value = '';
  const subDriveInput = document.getElementById('sub-drive-folder-url');
  if (subDriveInput) subDriveInput.value = '';
  const statusEl = document.getElementById('activity-drive-folder-status');
  if (statusEl) {
    statusEl.innerHTML = '';
    statusEl.classList.add('hidden');
  }

  updateFilenamePreviewInAdmin();
};

window.populateActivitySubmissionForm = function(cfg) {
  if (!cfg) {
    resetActivitySubmissionForm();
    return;
  }
  const accepted = (cfg.acceptedExtensions || ['pdf']).map(e => e.toLowerCase());
  ['pdf', 'zip', 'rar', '7z', 'jpg', 'png', 'docx', 'xlsx', 'pptx'].forEach(ext => {
    const el = document.getElementById('sub-ext-' + ext);
    if (el) el.checked = accepted.includes(ext);
  });
  if (document.getElementById('sub-ext-custom')) document.getElementById('sub-ext-custom').value = cfg.customExtensions || '';
  if (document.getElementById('sub-max-files')) document.getElementById('sub-max-files').value = cfg.maxFiles ?? 1;
  if (document.getElementById('sub-max-size')) document.getElementById('sub-max-size').value = cfg.maxFileSizeMB ?? 100;
  if (document.getElementById('sub-max-attempts')) document.getElementById('sub-max-attempts').value = cfg.maxAttempts ?? 3;

  const isCustomDeadline = cfg.deadlineMode === 'custom' && Boolean(cfg.deadlineAt);
  const dModeRadio = document.querySelector(`input[name="sub_deadline_mode"][value="${isCustomDeadline ? 'custom' : 'activity_end'}"]`);
  if (dModeRadio) dModeRadio.checked = true;
  toggleSubCustomDeadline(isCustomDeadline);

  if (isCustomDeadline && cfg.deadlineAt) {
    const parts = isoToVietnameseDateTime(cfg.deadlineAt);
    if (document.getElementById('sub-deadline-date')) document.getElementById('sub-deadline-date').value = parts.date;
    if (document.getElementById('sub-deadline-time')) document.getElementById('sub-deadline-time').value = parts.time;
  } else {
    if (document.getElementById('sub-deadline-date')) document.getElementById('sub-deadline-date').value = '';
    if (document.getElementById('sub-deadline-time')) document.getElementById('sub-deadline-time').value = '';
  }

  if (document.getElementById('sub-allow-late')) document.getElementById('sub-allow-late').checked = Boolean(cfg.allowLateSubmission);

  if (document.getElementById('sub-filename-template')) document.getElementById('sub-filename-template').value = cfg.filenameTemplate || '{HOI_DONG}_{MSSV}_{HO_TEN}';
  if (document.getElementById('sub-loai-val')) document.getElementById('sub-loai-val').value = cfg.fileTypeCategory || 'THUYET_MINH';
  const fModeRadio = document.querySelector(`input[name="sub_filename_mode"][value="${cfg.filenameMode || 'exact'}"]`);
  if (fModeRadio) fModeRadio.checked = true;

  if (document.getElementById('sub-vis-supervisor')) document.getElementById('sub-vis-supervisor').checked = cfg.visibility?.supervisor !== false;
  if (document.getElementById('sub-vis-reviewer')) document.getElementById('sub-vis-reviewer').checked = cfg.visibility?.reviewer !== false;
  if (document.getElementById('sub-vis-council')) document.getElementById('sub-vis-council').checked = cfg.visibility?.council !== false;

  const nameInputEl = document.getElementById('activity-form-drive-folder-name');
  if (nameInputEl) nameInputEl.value = cfg.driveFolderName || '';
  const idInputEl = document.getElementById('activity-form-drive-folder-id');
  if (idInputEl) idInputEl.value = cfg.driveFolderId || '';

  const subDriveInputEl = document.getElementById('sub-drive-folder-url');
  if (subDriveInputEl) {
    const fId = cfg.driveFolderId;
    const fUrl = cfg.driveFolderUrl || (fId ? `https://drive.google.com/drive/folders/${fId}` : '');
    subDriveInputEl.value = fUrl;
    const statusEl = document.getElementById('activity-drive-folder-status');
    if (statusEl) {
      if (fId) {
        statusEl.innerHTML = `
          <div class="mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
            <div>
              <span class="font-bold">✓ Thư mục bài nộp: <strong>${escapeHtml(cfg.driveFolderName || 'Google Drive')}</strong></span>
              <span class="block text-[10px] text-emerald-600 font-mono">ID: ${fId}</span>
            </div>
            <a href="${fUrl}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded font-bold text-xs inline-flex items-center gap-1 shadow-2xs">
              <span>Mở Drive</span> ↗
            </a>
          </div>
        `;
        statusEl.classList.remove('hidden');
      } else {
        statusEl.innerHTML = '';
        statusEl.classList.add('hidden');
      }
    }
  }

  updateFilenamePreviewInAdmin();
};

window.readActivitySubmissionForm = function() {
  const accepted = [];
  ['pdf', 'zip', 'rar', '7z', 'jpg', 'png', 'docx', 'xlsx', 'pptx'].forEach(ext => {
    const el = document.getElementById('sub-ext-' + ext);
    if (el && el.checked) accepted.push(ext);
  });
  const customStr = (document.getElementById('sub-ext-custom')?.value || '').trim();
  if (customStr) {
    customStr.split(',').forEach(part => {
      const clean = part.trim().toLowerCase().replace(/^\./, '');
      if (clean && !accepted.includes(clean)) accepted.push(clean);
    });
  }
  if (accepted.length === 0) accepted.push('pdf');

  const maxFiles = parseInt(document.getElementById('sub-max-files')?.value, 10) || 1;
  const maxFileSizeMB = parseInt(document.getElementById('sub-max-size')?.value, 10) || 100;
  const maxAttempts = parseInt(document.getElementById('sub-max-attempts')?.value, 10) || 3;

  const deadlineMode = document.querySelector('input[name="sub_deadline_mode"]:checked')?.value || 'activity_end';
  let deadlineAt = null;
  if (deadlineMode === 'custom') {
    const dDate = document.getElementById('sub-deadline-date')?.value || '';
    const dTime = document.getElementById('sub-deadline-time')?.value || '';
    deadlineAt = parseVietnameseDateTimeToIso(dDate, dTime);
  }

  const allowLateSubmission = document.getElementById('sub-allow-late')?.checked === true;
  const filenameTemplate = (document.getElementById('sub-filename-template')?.value || '').trim() || '{HOI_DONG}_{MSSV}_{HO_TEN}';
  const fileTypeCategory = (document.getElementById('sub-loai-val')?.value || '').trim() || 'THUYET_MINH';
  const filenameMode = document.querySelector('input[name="sub_filename_mode"]:checked')?.value || 'exact';

  const visSupervisor = document.getElementById('sub-vis-supervisor')?.checked !== false;
  const visReviewer = document.getElementById('sub-vis-reviewer')?.checked !== false;
  const visCouncil = document.getElementById('sub-vis-council')?.checked !== false;

  const storageProvider = 'google_drive';
  const driveUrl = document.getElementById('sub-drive-folder-url')?.value.trim();
  const hiddenFolderId = document.getElementById('activity-form-drive-folder-id')?.value?.trim();
  const driveFolderName = document.getElementById('activity-form-drive-folder-name')?.value?.trim() || null;
  const driveFolderId = (driveUrl ? window.extractDriveFolderId(driveUrl) : null) || hiddenFolderId || null;
  const driveFolderUrl = driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : (driveUrl || null);

  return {
    enabled: true,
    acceptedExtensions: accepted,
    customExtensions: customStr,
    maxFiles,
    maxFileSizeMB,
    maxAttempts,
    deadlineMode,
    deadlineAt,
    allowLateSubmission,
    filenameTemplate,
    filenameMode,
    fileTypeCategory,
    visibility: {
      admin: true,
      supervisor: visSupervisor,
      reviewer: visReviewer,
      council: visCouncil
    },
    storageProvider,
    driveFolderId,
    driveFolderName,
    driveFolderUrl
  };
};

// 3. EFFECTIVE DEADLINE, ATTEMPTS & RULES
window.getEffectiveSubmissionRules = function(studentId, activity, round) {
  const cfg = activity?.submissionConfig || {};
  const override = round?.submissionOverrides?.[studentId]?.[activity?.id] || null;

  // Base deadline
  let baseDeadline = null;
  if (cfg.deadlineMode === 'custom' && cfg.deadlineAt) {
    baseDeadline = new Date(cfg.deadlineAt);
  } else if (activity?.endAt) {
    baseDeadline = new Date(activity.endAt);
  }

  // Effective deadline
  let effectiveDeadline = baseDeadline;
  let isExtended = false;
  if (override?.allowUntil) {
    effectiveDeadline = new Date(override.allowUntil);
    isExtended = true;
  }

  // Attempts
  const extraAttempts = (override && typeof override.extraAttempts === 'number') ? override.extraAttempts : 0;
  const baseMaxAttempts = cfg.maxAttempts ?? 3;
  const totalAllowedAttempts = baseMaxAttempts + extraAttempts;

  // Submissions record
  const subRecord = round?.activitySubmissions?.[activity?.id]?.[studentId] || null;
  const attemptsList = Array.isArray(subRecord?.attempts)
    ? subRecord.attempts
    : (subRecord?.currentSubmission ? [subRecord.currentSubmission] : []);
  const completedAttempts = attemptsList.filter(a => a.status !== 'withdrawn').length;
  const remainingAttempts = Math.max(0, totalAllowedAttempts - completedAttempts);

  // Time status
  const now = new Date();
  const startAt = activity?.startAt ? new Date(activity.startAt) : null;
  const isNotStarted = startAt ? (now < startAt) : false;
  const isPastDeadline = effectiveDeadline ? (now > effectiveDeadline) : false;
  const isNearDeadline = effectiveDeadline && !isPastDeadline && ((effectiveDeadline - now) <= 24 * 3600 * 1000);

  const allowLate = Boolean(cfg.allowLateSubmission);
  const canSubmit = !isNotStarted && (remainingAttempts > 0) && (!isPastDeadline || allowLate);
  const isLate = isPastDeadline;

  return {
    baseDeadline,
    effectiveDeadline,
    isExtended,
    extraAttempts,
    baseMaxAttempts,
    totalAllowedAttempts,
    completedAttempts,
    remainingAttempts,
    isNotStarted,
    isPastDeadline,
    isNearDeadline,
    isLate,
    allowLate,
    canSubmit,
    currentSubmission: subRecord?.currentSubmission || null,
    attemptsHistory: Array.isArray(subRecord?.attempts) ? subRecord.attempts : []
  };
};

// 4. STORAGE PROVIDER ABSTRACTION & DRIVE READINESS