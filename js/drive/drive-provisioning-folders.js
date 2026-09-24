/**
 * IFA+ Graduation — Google Drive Folders Provisioning & Connection
 */
/**
 * IFA+ Graduation — Google Drive Provisioning & Folder Structure Submodule
 */
/**
 * IFA+ Graduation — Google Drive & Student Submissions Module
 */
window.extractDriveFolderId = function(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
};

export function parseDriveFolderId(url) {
  return window.extractDriveFolderId(url);
}

export function getDriveFolderUrl(folderId) {
  if (!folderId) return '';
  return `https://drive.google.com/drive/folders/${folderId}`;
}

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