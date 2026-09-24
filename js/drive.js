/**
 * IFA+ Graduation — Google Drive & Student Submissions Module
 */
window.extractDriveFolderId = function(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

function normalizeRoundDriveFolderNames(value) {
  const rawNames = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  const seen = new Set();
  return rawNames
    .map(name => String(name || '').trim().replace(/\s+/g, ' ').slice(0, 120))
    .filter(name => {
      if (!name) return false;
      const key = name.toLocaleLowerCase('vi');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

window.updateRoundDriveFolderPreview = function() {
  const input = document.getElementById('round-drive-subfolder-names');
  const preview = document.getElementById('round-drive-subfolder-preview');
  const count = document.getElementById('round-drive-subfolder-count');
  const names = normalizeRoundDriveFolderNames(input?.value || '');
  if (count) count.textContent = `${names.length} thư mục`;
  if (preview) {
    preview.innerHTML = names.length
      ? names.map(name => `<span class="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded-lg text-[10px] font-semibold text-blue-900"><span>📁</span>${escapeHtml(name)}</span>`).join('')
      : '<span class="text-[10px] text-blue-600 italic">Chưa thiết lập thư mục con.</span>';
  }
  return names;
};

async function provisionRoundDriveFolders({ roundId, parentFolderId, folderNames }) {
  const names = normalizeRoundDriveFolderNames(folderNames);
  if (!roundId || !parentFolderId || names.length === 0) return [];

  const idToken = state.user ? await state.user.getIdToken() : null;
  if (!idToken) throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại để tạo thư mục Drive.');

  const results = [];
  for (const folderName of names) {
    const res = await fetch(getGraduationApiBase() + '/api/graduation/drive/get-or-create-folder', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + idToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parentFolderId, folderName, folderType: 'round_structure', roundId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(`Không thể tạo thư mục "${folderName}": ${data.error || `HTTP ${res.status}`}`);
    }
    results.push({
      name: data.folderName || folderName,
      folderId: data.folderId,
      folderUrl: data.folderUrl || `https://drive.google.com/drive/folders/${data.folderId}`,
      reused: data.reused === true,
    });
  }
  return results;
}

function getGraduationApiBase() {
  return window.IFA_CONFIG?.graduationApiEndpoint || window.IFA_CONFIG?.driveUploadEndpoint || 'https://asia-southeast1-ifa-activities.cloudfunctions.net/graduationApi';
}

window.testDriveFolderUrl = async function(type) {
  const inputId = type === 'round' ? 'round-drive-folder-url' : 'sub-drive-folder-url';
  const statusId = type === 'round' ? 'round-drive-folder-status' : 'activity-drive-folder-status';
  const btnId = type === 'round' ? 'btn-validate-round-drive' : null;
  
  const url = document.getElementById(inputId)?.value?.trim();
  const statusEl = document.getElementById(statusId);
  if (!statusEl) return;
  statusEl.classList.remove('hidden', 'text-green-600', 'text-red-600', 'text-amber-600');
  
  if (!url) {
    statusEl.textContent = 'Vui lòng nhập URL hoặc Folder ID của thư mục';
    statusEl.classList.add('text-red-600');
    return;
  }
  
  const folderId = window.extractDriveFolderId(url);
  if (!folderId) {
    statusEl.textContent = '❌ Không tìm thấy Folder ID hợp lệ (tối thiểu 25 ký tự) trong URL';
    statusEl.classList.add('text-red-600');
    return;
  }

  // If testing round root folder, call backend API to verify permission & Editor capability
  if (type === 'round') {
    const btn = btnId ? document.getElementById(btnId) : null;
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Đang kiểm tra...</span>';
    }
    statusEl.innerHTML = '<span class="text-blue-600">⏳ Đang kết nối kiểm tra quyền trên Google Drive...</span>';

    try {
      const idToken = state.user ? await state.user.getIdToken() : null;
      if (!idToken) {
        throw new Error('Phiên đăng nhập hết hạn hoặc chưa xác thực Admin. Vui lòng đăng nhập lại.');
      }

      const res = await fetch(getGraduationApiBase() + '/api/graduation/drive/validate-root-folder', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + idToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url, folderId: folderId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      statusEl.innerHTML = `
        <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold flex items-center gap-1.5">🟢 Đã xác thực quyền tạo thư mục con</span>
            <a href="${data.folderUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-bold text-xs inline-flex items-center gap-1">
              <span>Mở Drive</span> ↗
            </a>
          </div>
          <p class="text-xs text-emerald-700">Tên thư mục: <strong>${escapeHtml(data.folderName)}</strong></p>
          <p class="text-[10px] text-emerald-600 font-mono">ID: ${data.folderId}</p>
        </div>
      `;
      // Store validated info on form dataset
      const driveInputEl = document.getElementById('round-drive-folder-url');
      if (driveInputEl) {
        driveInputEl.dataset.isValidated = 'true';
        driveInputEl.dataset.validatedFolderId = data.folderId;
        driveInputEl.dataset.validatedFolderName = data.folderName;
        driveInputEl.dataset.validatedFolderUrl = data.folderUrl;
      }
      showToast(`✓ Đã xác thực quyền tạo thư mục con "${data.folderName}"!`, 'success');
    } catch (err) {
      statusEl.innerHTML = `
        <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1">
          <p class="font-bold flex items-center gap-1.5">🔴 Không thể xác thực quyền:</p>
          <p class="text-xs leading-relaxed">${escapeHtml(err.message)}</p>
        </div>
      `;
      const driveInputEl = document.getElementById('round-drive-folder-url');
      if (driveInputEl) {
        driveInputEl.dataset.isValidated = 'false';
      }
      showToast('Lỗi kiểm tra quyền thư mục Google Drive: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
    return;
  }

  // Activity type: quick regex validation with link
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  statusEl.innerHTML = `
    <span class="text-emerald-600">✓ Hợp lệ (Folder ID: ${folderId})</span>
    <a href="${folderUrl}" target="_blank" rel="noopener noreferrer" class="ml-2 text-blue-600 hover:underline text-xs">Mở ↗</a>
  `;
};

window.onRoundDriveUrlChange = function() {
  const driveInput = document.getElementById('round-drive-folder-url');
  if (!driveInput) return;
  const curVal = (driveInput.value || '').trim();
  const validUrl = (driveInput.dataset.validatedFolderUrl || '').trim();
  const validId = (driveInput.dataset.validatedFolderId || '').trim();
  const curId = window.extractDriveFolderId ? window.extractDriveFolderId(curVal) : null;

  if (curVal && (!validId || (curId !== validId && curVal !== validUrl))) {
    driveInput.dataset.isValidated = 'false';
    const statusEl = document.getElementById('round-drive-folder-status');
    if (statusEl) {
      statusEl.classList.remove('hidden');
      statusEl.innerHTML = `
        <div class="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-800">
          <div>
            <span class="font-bold">🟡 Đã cấu hình thư mục Drive — Chưa kiểm tra quyền</span>
            <span class="block text-[11px] text-amber-700 mt-0.5">Vui lòng bấm <strong>[Kiểm tra quyền Drive]</strong> để xác thực quyền tạo thư mục con.</span>
          </div>
        </div>
      `;
    }
  } else if (!curVal) {
    driveInput.dataset.isValidated = 'false';
    delete driveInput.dataset.validatedFolderId;
    delete driveInput.dataset.validatedFolderName;
    delete driveInput.dataset.validatedFolderUrl;
    const statusEl = document.getElementById('round-drive-folder-status');
    if (statusEl) {
      statusEl.innerHTML = '';
      statusEl.classList.add('hidden');
    }
  }
};

window.connectCouncilDriveFolder = async function() {
  const { roundId } = state.activeCouncilManagement || {};
  const targetRound = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;

  if (!targetRound) {
    showToast('Không tìm thấy thông tin Đợt tốt nghiệp!', 'error');
    return;
  }

  const rootFolderId = targetRound.driveRootFolderId || targetRound.rootDriveFolderId;
  if (!rootFolderId) {
    showToast('Đợt tốt nghiệp chưa cấu hình Thư mục Drive gốc! Vui lòng cấu hình Thư mục gốc trong Thông tin đợt trước.', 'warning');
    return;
  }

  const nameInput = document.getElementById('council-form-drive-folder-name');
  const fallbackName = document.getElementById('council-form-name')?.value?.trim();
  let folderName = (nameInput?.value || '').trim() || fallbackName;

  if (!folderName) {
    showToast('Vui lòng nhập Tên Hội đồng hoặc Tên thư mục con (*)', 'warning');
    nameInput?.focus();
    return;
  }

  if (nameInput) nameInput.value = folderName;

  const btn = document.getElementById('btn-connect-council-drive');
  const statusEl = document.getElementById('council-drive-folder-status');
  const origBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Đang xử lý...</span>';
  }
  if (statusEl) {
    statusEl.innerHTML = '<span class="text-blue-600">⏳ Đang tìm kiếm hoặc tạo thư mục trên Google Drive...</span>';
  }

  try {
    const idToken = state.user ? await state.user.getIdToken() : null;
    if (!idToken) throw new Error('Chưa xác thực Admin hoặc phiên làm việc hết hạn.');

    const res = await fetch(getGraduationApiBase() + '/api/graduation/drive/get-or-create-folder', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + idToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parentFolderId: rootFolderId,
        folderName: folderName,
        folderType: 'council',
        roundId: targetRound.id,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const idInput = document.getElementById('council-form-drive-folder-id');
    const urlInput = document.getElementById('council-form-drive-folder-url');
    if (idInput) idInput.value = data.folderId;
    if (urlInput) urlInput.value = data.folderUrl;

    const actionText = data.reused ? 'Đã kết nối với thư mục sẵn có' : 'Đã tạo mới thư mục con';
    if (statusEl) {
      statusEl.innerHTML = `
        <div class="mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
          <div>
            <span class="font-bold">✓ ${actionText}: <strong>${escapeHtml(data.folderName)}</strong></span>
            <span class="block text-[10px] text-emerald-600 font-mono">ID: ${data.folderId}</span>
          </div>
          <a href="${data.folderUrl}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded font-bold text-xs inline-flex items-center gap-1 shadow-2xs">
            <span>Mở Drive</span> ↗
          </a>
        </div>
      `;
    }

    showToast(`✓ ${actionText} "${data.folderName}" trên Google Drive!`, 'success');
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-rose-600 font-semibold">✗ Lỗi: ${escapeHtml(err.message)}</span>`;
    }
    showToast('Lỗi tạo/kết nối thư mục Drive: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnText;
    }
  }
};

window.connectActivityDriveFolder = async function() {
  const roundId = document.getElementById('admin-timeline-round-select')?.value || state.selectedRoundId;
  const targetRound = (state.rounds || []).find(r => r.id === roundId) || state.activeRound;

  if (!targetRound) {
    showToast('Không tìm thấy thông tin Đợt tốt nghiệp!', 'error');
    return;
  }

  const rootFolderId = targetRound.driveRootFolderId || targetRound.rootDriveFolderId;
  if (!rootFolderId) {
    showToast('Đợt tốt nghiệp chưa cấu hình Thư mục Drive gốc! Vui lòng cấu hình Thư mục gốc trong Thông tin đợt trước.', 'warning');
    return;
  }

  const nameInput = document.getElementById('activity-form-drive-folder-name');
  const fallbackName = document.getElementById('activity-form-title')?.value?.trim();
  let folderName = (nameInput?.value || '').trim() || fallbackName;

  if (!folderName) {
    showToast('Vui lòng nhập Tên mốc kế hoạch hoặc Tên thư mục con (*)', 'warning');
    nameInput?.focus();
    return;
  }

  if (nameInput) nameInput.value = folderName;

  const btn = document.getElementById('btn-connect-activity-drive');
  const statusEl = document.getElementById('activity-drive-folder-status');
  const origBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Đang xử lý...</span>';
  }
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = '<span class="text-blue-600">⏳ Đang tìm kiếm hoặc tạo thư mục trên Google Drive...</span>';
  }

  try {
    const idToken = state.user ? await state.user.getIdToken() : null;
    if (!idToken) throw new Error('Chưa xác thực Admin hoặc phiên làm việc hết hạn.');

    const res = await fetch(getGraduationApiBase() + '/api/graduation/drive/get-or-create-folder', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + idToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parentFolderId: rootFolderId,
        folderName: folderName,
        folderType: 'milestone',
        roundId: targetRound.id,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const idInput = document.getElementById('activity-form-drive-folder-id');
    const urlInput = document.getElementById('sub-drive-folder-url');
    if (idInput) idInput.value = data.folderId;
    if (urlInput) urlInput.value = data.folderUrl;

    const actionText = data.reused ? 'Đã kết nối với thư mục sẵn có' : 'Đã tạo mới thư mục con';
    if (statusEl) {
      statusEl.innerHTML = `
        <div class="mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
          <div>
            <span class="font-bold">✓ ${actionText}: <strong>${escapeHtml(data.folderName)}</strong></span>
            <span class="block text-[10px] text-emerald-600 font-mono">ID: ${data.folderId}</span>
          </div>
          <a href="${data.folderUrl}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded font-bold text-xs inline-flex items-center gap-1 shadow-2xs">
            <span>Mở Drive</span> ↗
          </a>
        </div>
      `;
    }

    showToast(`✓ ${actionText} "${data.folderName}" trên Google Drive!`, 'success');
  } catch (err) {
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-rose-600 font-semibold">✗ Lỗi: ${escapeHtml(err.message)}</span>`;
    }
    showToast('Lỗi tạo/kết nối thư mục Drive: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnText;
    }
  }
};


// ============================================================================
// IFA+ GRADUATION BETA v2.2.0-beta.1:
// STUDENT SUBMISSION / FILE UPLOAD + GOOGLE DRIVE READY ARCHITECTURE
// ============================================================================

// 1. FILENAME RULE ENGINE & NORMALIZATION (NO AI)
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
  let expectedFilename = '';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // Size check
    if (file.size > maxBytes) {
      errors.push(`File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) vượt quá dung lượng tối đa ${cfg.maxFileSizeMB || 100} MB.`);
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
          <span class="font-bold text-slate-800">≤ ${cfg.maxFileSizeMB || 100} MB</span>
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

// Global window bridges for cross-module accessibility
window.normalizeRoundDriveFolderNames = normalizeRoundDriveFolderNames;
window.provisionRoundDriveFolders = provisionRoundDriveFolders;
window.getGraduationApiBase = getGraduationApiBase;
