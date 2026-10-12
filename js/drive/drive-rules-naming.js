/**
 * IFA+ Graduation — Drive Filename Templates & Submission Rules
 */
import { parseVietnameseDateTimeToIso } from './submission-deadline-date.js';
function normalizeVietnameseNoDiacritics(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
window.normalizeVietnameseNoDiacritics = normalizeVietnameseNoDiacritics;

function formatPersonName(str) {
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
}
window.formatPersonName = formatPersonName;

function generateExpectedFilename({ template, student, activity, round, fileTypeCategory, extension, mode }) {
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
}
window.generateExpectedFilename = generateExpectedFilename;

function validateFilename({ filename, template, student, activity, round, fileTypeCategory, mode, acceptedExtensions }) {
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
}
window.validateFilename = validateFilename;

function updateFilenamePreviewInAdmin() {
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
}
window.updateFilenamePreviewInAdmin = updateFilenamePreviewInAdmin;

// 2. ACTIVITY FORM HELPERS FOR SUBMISSION CONFIG
window.toggleActivitySubmissionConfig = function(enabled) {
  const panel = document.getElementById('activity-submission-config-panel');
  if (panel) {
    if (enabled) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  }
};

window.syncActivitySubmissionPickerToDateInput = function(target, isoDate) {
  if (!isoDate) return;
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const vnDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    const input = document.getElementById(target === 'open' ? 'sub-open-date' : 'sub-deadline-date');
    if (input) input.value = vnDate;
    const timeInput = document.getElementById(target === 'open' ? 'sub-open-time' : 'sub-deadline-time');
    if (timeInput && !timeInput.value.trim()) {
      timeInput.value = target === 'open' ? '08:00' : '23:59';
    }
  }
};

window.openActivitySubmissionDatePicker = function(target) {
  const pickerId = target === 'open' ? 'sub-open-date-picker' : 'sub-deadline-date-picker';
  const textInputId = target === 'open' ? 'sub-open-date' : 'sub-deadline-date';
  const picker = document.getElementById(pickerId);
  const textInput = document.getElementById(textInputId);
  if (!picker) return;

  const typed = String(textInput?.value || '').trim();
  const match = typed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) picker.value = `${match[3]}-${match[2]}-${match[1]}`;

  try {
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
      return;
    }
  } catch (error) {
    // Older browsers fallback
  }
  picker.focus({ preventScroll: true });
  picker.click();
};

window.clearActivitySubmissionDateTime = function(target) {
  const dateInput = document.getElementById(target === 'open' ? 'sub-open-date' : 'sub-deadline-date');
  const timeInput = document.getElementById(target === 'open' ? 'sub-open-time' : 'sub-deadline-time');
  if (dateInput) {
    dateInput.value = '';
    dateInput.classList.remove('border-rose-500', 'bg-rose-50');
  }
  if (timeInput) {
    timeInput.value = '';
    timeInput.classList.remove('border-rose-500', 'bg-rose-50');
  }
};

function toggleSubOpenMode(mode) {
  const isCustom = mode === 'custom';
  const isImmediate = mode === 'immediate';
  const isActivityStart = mode === 'activity_start';

  const customWrap = document.getElementById('sub-custom-open-wrap');
  if (customWrap) customWrap.classList.toggle('hidden', !isCustom);

  const immNote = document.getElementById('sub-open-immediate-note');
  if (immNote) immNote.classList.toggle('hidden', !isImmediate);

  const actNote = document.getElementById('sub-open-activity-start-note');
  if (actNote) actNote.classList.toggle('hidden', !isActivityStart);
}
window.toggleSubOpenMode = toggleSubOpenMode;

function toggleSubDeadlineMode(mode) {
  const isCustom = mode === 'custom';
  const customWrap = document.getElementById('sub-custom-deadline-wrap');
  if (customWrap) customWrap.classList.toggle('hidden', !isCustom);

  const endNote = document.getElementById('sub-deadline-activity-end-note');
  if (endNote) endNote.classList.toggle('hidden', isCustom);
}
window.toggleSubDeadlineMode = toggleSubDeadlineMode;

function toggleSubCustomDeadline(isCustom) {
  toggleSubDeadlineMode(isCustom ? 'custom' : 'activity_end');
}
window.toggleSubCustomDeadline = toggleSubCustomDeadline;

function toggleSubCustomOpen(isCustom) {
  toggleSubOpenMode(isCustom ? 'custom' : 'activity_start');
}
window.toggleSubCustomOpen = toggleSubCustomOpen;

window.resetActivitySubmissionForm = function() {
  ['pdf', 'zip', 'rar', '7z', 'jpg', 'png', 'docx', 'xlsx', 'pptx'].forEach(ext => {
    const el = document.getElementById('sub-ext-' + ext);
    if (el) el.checked = (ext === 'pdf');
  });
  if (document.getElementById('sub-ext-custom')) document.getElementById('sub-ext-custom').value = '';
  if (document.getElementById('sub-max-files')) document.getElementById('sub-max-files').value = '1';
  if (document.getElementById('sub-max-size')) document.getElementById('sub-max-size').value = '100';
  if (document.getElementById('sub-max-attempts')) document.getElementById('sub-max-attempts').value = '3';
  const openRadio = document.querySelector('input[name="sub_open_mode"][value="immediate"]');
  if (openRadio) openRadio.checked = true;
  toggleSubOpenMode('immediate');
  if (document.getElementById('sub-open-date')) document.getElementById('sub-open-date').value = '';
  if (document.getElementById('sub-open-time')) document.getElementById('sub-open-time').value = '';
  
  const endRadio = document.querySelector('input[name="sub_deadline_mode"][value="custom"]');
  if (endRadio) endRadio.checked = true;
  toggleSubDeadlineMode('custom');
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
  let openMode = 'immediate';
  if (cfg.openMode === 'immediate') {
    openMode = 'immediate';
  } else if (cfg.openMode === 'custom' || Boolean(cfg.openAt)) {
    openMode = 'custom';
  } else if (cfg.openMode === 'activity_start') {
    openMode = 'activity_start';
  }
  const openModeRadio = document.querySelector(`input[name="sub_open_mode"][value="${openMode}"]`);
  if (openModeRadio) openModeRadio.checked = true;
  toggleSubOpenMode(openMode);

  const toVnDateTime = (typeof isoToVietnameseDateTime === 'function')
    ? isoToVietnameseDateTime
    : (isoStr => {
        if (typeof window !== 'undefined' && typeof window.isoToVietnameseDateTime === 'function') {
          return window.isoToVietnameseDateTime(isoStr);
        }
        if (!isoStr) return { date: '', time: '' };
        try {
          const d = new Date(isoStr);
          if (isNaN(d.getTime())) return { date: '', time: '' };
          const date = String(d.getDate()).padStart(2, '0') + '/' +
                       String(d.getMonth() + 1).padStart(2, '0') + '/' +
                       d.getFullYear();
          const time = String(d.getHours()).padStart(2, '0') + ':' +
                       String(d.getMinutes()).padStart(2, '0');
          return { date, time };
        } catch (e) {
          return { date: '', time: '' };
        }
      });

  if (cfg.openAt) {
    const openParts = toVnDateTime(cfg.openAt);
    if (document.getElementById('sub-open-date')) document.getElementById('sub-open-date').value = openParts.date;
    if (document.getElementById('sub-open-time')) document.getElementById('sub-open-time').value = openParts.time;
  } else {
    if (document.getElementById('sub-open-date')) document.getElementById('sub-open-date').value = '';
    if (document.getElementById('sub-open-time')) document.getElementById('sub-open-time').value = '';
  }

  let deadlineMode = 'custom';
  if (cfg.deadlineMode === 'activity_end') {
    deadlineMode = 'activity_end';
  } else if (cfg.deadlineMode === 'custom' || Boolean(cfg.deadlineAt)) {
    deadlineMode = 'custom';
  }
  const dModeRadio = document.querySelector(`input[name="sub_deadline_mode"][value="${deadlineMode}"]`);
  if (dModeRadio) dModeRadio.checked = true;
  toggleSubDeadlineMode(deadlineMode);

  if (cfg.deadlineAt) {
    const parts = toVnDateTime(cfg.deadlineAt);
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

  // Bắt đầu nhận bài (Khu vực 2: Thời gian tiếp nhận bài nộp)
  const openMode = document.querySelector('input[name="sub_open_mode"]:checked')?.value || 'immediate';
  let openAt = null;
  if (openMode === 'custom') {
    const openDateStr = (document.getElementById('sub-open-date')?.value || '').trim();
    const openTimeStr = (document.getElementById('sub-open-time')?.value || '').trim();
    if (openDateStr) {
      openAt = parseVietnameseDateTimeToIso(openDateStr, openTimeStr || '00:00');
    }
    if (!openAt) throw new Error('Giờ bắt đầu nhận bài không hợp lệ. Vui lòng nhập ngày DD/MM/YYYY và giờ HH:mm.');
  }

  // Hạn chót nhận bài (Khu vực 2: Thời gian tiếp nhận bài nộp)
  const deadlineMode = document.querySelector('input[name="sub_deadline_mode"]:checked')?.value || 'custom';
  let deadlineAt = null;
  if (deadlineMode === 'custom') {
    const deadlineDateStr = (document.getElementById('sub-deadline-date')?.value || '').trim();
    const deadlineTimeStr = (document.getElementById('sub-deadline-time')?.value || '').trim();
    if (deadlineDateStr) {
      deadlineAt = parseVietnameseDateTimeToIso(deadlineDateStr, deadlineTimeStr || '23:59');
    }
    if (!deadlineAt) throw new Error('Hạn chót nhận bài không hợp lệ. Vui lòng nhập ngày DD/MM/YYYY và giờ HH:mm.');
  }

  // Quy tắc kiểm tra thời gian nhận bài: submissionStart < submissionDeadline (nếu có đủ hai thời điểm riêng)
  // Tuyệt đối KHÔNG ràng buộc sai hoặc so sánh với thời gian diễn ra hoạt động (activityStart, activityEnd).
  if (openMode === 'custom' && deadlineMode === 'custom' && openAt && deadlineAt && new Date(openAt) >= new Date(deadlineAt)) {
    throw new Error('Thời gian bắt đầu nhận bài phải trước hạn chót nhận bài.');
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
    openMode,
    openAt,
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

  // Base deadline: ưu tiên cfg.deadlineAt, không mặc định phụ thuộc activity.endAt trừ khi là bản ghi cũ
  let baseDeadline = null;
  if (cfg.deadlineAt) {
    baseDeadline = new Date(cfg.deadlineAt);
  } else if (cfg.deadlineMode === 'custom' && cfg.deadlineAt) {
    baseDeadline = new Date(cfg.deadlineAt);
  } else if (!activity?.submissionConfig && activity?.endAt) {
    baseDeadline = new Date(activity.endAt);
  } else if (cfg.deadlineMode === 'activity_end' && activity?.endAt) {
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

  // Time status: startAt lấy từ cfg.openAt độc lập, không mặc định lấy thời gian hoạt động trừ khi bản ghi cũ
  const now = new Date();
  let startAt = null;
  if (cfg.openMode === 'immediate') {
    startAt = null; // Bắt đầu nhận bài ngay từ lúc này
  } else if (cfg.openAt) {
    startAt = new Date(cfg.openAt);
  } else if (cfg.openMode === 'custom' && cfg.openAt) {
    startAt = new Date(cfg.openAt);
  } else if (cfg.openMode === 'activity_start' && activity?.startAt) {
    startAt = new Date(activity.startAt);
  } else if (!activity?.submissionConfig && activity?.startAt) {
    startAt = new Date(activity.startAt);
  }
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
    startAt,
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
