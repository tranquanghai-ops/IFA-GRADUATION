// --- ADMIN: SUPERVISORS MASTER CRUD ---
async function loadAdminSupervisorsMaster() {
  try {
    const snap = await getDocs(query(collection(db, 'supervisorMaster'), orderBy('name', 'asc')));
    state.supervisorsMaster = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminSupervisorsMasterTable();
  } catch (e) {
    console.error('Error loading master supervisors:', e);
  }
}

export function getSupervisorInitials(name) {
  if (!name || typeof name !== 'string') return 'GV';
  const clean = name.replace(/^(TS\.|ThS\.|PGS\.TS\.|GS\.TS\.|ThS|TS|PGS|GS|Thầy|Cô|GV|GVHD|Ths|Ts)\s+/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'GV';
  const lastWord = parts[parts.length - 1];
  return lastWord.charAt(0).toUpperCase();
}

const AVATAR_PALETTES = [
  { bg1: '#3b82f6', bg2: '#1d4ed8' },
  { bg1: '#10b981', bg2: '#047857' },
  { bg1: '#8b5cf6', bg2: '#6d28d9' },
  { bg1: '#f59e0b', bg2: '#b45309' },
  { bg1: '#ec4899', bg2: '#be185d' },
  { bg1: '#06b6d4', bg2: '#0e7490' },
  { bg1: '#6366f1', bg2: '#4338ca' },
  { bg1: '#14b8a6', bg2: '#0f766e' }
];

export function getSupervisorAvatarSvgDataUri(name) {
  const initial = getSupervisorInitials(name);
  let hash = 0;
  const str = String(name || '');
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  const colorIndex = Math.abs(hash) % AVATAR_PALETTES.length;
  const color = AVATAR_PALETTES[colorIndex];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="g_${colorIndex}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color.bg1}"/>
        <stop offset="100%" stop-color="${color.bg2}"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="22" fill="url(#g_${colorIndex})"/>
    <text x="50" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initial}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

window.getSupervisorInitials = getSupervisorInitials;
window.getSupervisorAvatarSvgDataUri = getSupervisorAvatarSvgDataUri;

function renderAdminSupervisorsMasterTable() {
  const tbody = document.getElementById('admin-supervisors-master-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.supervisorsMaster.map(s => {
    const isAdjunct = (s.employmentType === 'adjunct');
    const typeBadge = isAdjunct
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Thỉnh giảng</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Cơ hữu</span>';
    const quotaVal = s.defaultQuota || (isAdjunct ? 5 : 10);
    const escapedName = escapeHtml(s.name || '');
    const avatarSrc = (s.photoUrl && s.photoUrl.trim()) ? s.photoUrl : getSupervisorAvatarSvgDataUri(s.name);

    return `
    <tr class="hover:bg-slate-50">
      <td class="p-3.5">
        <img src="${avatarSrc}" onerror="this.onerror=null; this.src=getSupervisorAvatarSvgDataUri('${escapedName}');" class="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm" alt="${escapedName}">
      </td>
      <td class="p-3.5 font-bold text-slate-900">${s.name}</td>
      <td class="p-3.5 text-slate-600">${s.gender || 'Nam'}</td>
      <td class="p-3.5 text-slate-600">${s.email || '--'} ${s.phone ? '• ' + s.phone : ''}</td>
      <td class="p-3.5 font-semibold text-slate-800">${s.department || 'Thiết kế nội thất'}</td>
      <td class="p-3.5 text-center whitespace-nowrap">${typeBadge}</td>
      <td class="p-3.5 max-w-[200px] truncate text-slate-600" title="${s.expertise || ''}">${s.expertise || '--'}</td>
      <td class="p-3.5 text-center whitespace-nowrap">
        <span class="inline-block px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg font-mono text-[11px] font-bold text-slate-700">${quotaVal} SV</span>
      </td>
      <td class="p-3.5">
        <span class="badge ${s.active !== false ? 'badge-open' : 'badge-closed'}">${s.active !== false ? 'Active' : 'Ngừng'}</span>
      </td>
      <td class="p-3.5 text-right space-x-2">
        <button onclick="editSupervisorMasterModal('${s.id}')" class="text-blue-600 hover:underline font-bold">Sửa</button>
        <button onclick="deleteSupervisorMaster('${s.id}')" class="text-rose-600 hover:underline font-bold">Xóa</button>
      </td>
    </tr>
  `;
  }).join('');
}


// ============================================================================
// GVHD PHOTO PROCESSING: RESIZE (MAX 1600PX), HIGH-QUALITY (WEBP 0.92/JPEG 0.90)
// ============================================================================
state.pendingSupervisorPhotoBlob = null;
state.pendingRemoveSupervisorPhoto = false;

function formatSupervisorFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function blobToBase64DataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Client-side image processor: max long edge 1600px, WebP (quality 0.92) or JPEG fallback (0.90)
export async function processSupervisorPhotoFile(file) {
  if (!file) throw new Error('Không tìm thấy tệp ảnh');
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Dung lượng ảnh vượt quá giới hạn cho phép (Tối đa 10MB)');
  }
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!validTypes.includes((file.type || '').toLowerCase())) {
    throw new Error('Định dạng ảnh không được hỗ trợ. Vui lòng chọn JPG, PNG hoặc WebP.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lỗi đọc tệp ảnh'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không thể phân tích dữ liệu ảnh'));
      img.onload = () => {
        try {
          const originalWidth = img.naturalWidth || img.width;
          const originalHeight = img.naturalHeight || img.height;
          const maxDim = 1600;
          let targetWidth = originalWidth;
          let targetHeight = originalHeight;

          // Scale proportionally keeping original aspect ratio (never upscale)
          if (originalWidth > maxDim || originalHeight > maxDim) {
            if (originalWidth >= originalHeight) {
              targetWidth = maxDim;
              targetHeight = Math.round((originalHeight * maxDim) / originalWidth);
            } else {
              targetHeight = maxDim;
              targetWidth = Math.round((originalWidth * maxDim) / originalHeight);
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh canvas'));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw full image keeping aspect ratio (no auto-crop)
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Attempt WebP first (quality 0.92)
          canvas.toBlob((webpBlob) => {
            if (webpBlob && webpBlob.type === 'image/webp') {
              blobToBase64DataUrl(webpBlob).then(base64 => {
                resolve({
                  blob: webpBlob,
                  base64,
                  mimeType: 'image/webp',
                  extension: 'webp',
                  formatLabel: 'WebP 92%',
                  width: targetWidth,
                  height: targetHeight,
                  originalWidth,
                  originalHeight,
                  size: webpBlob.size,
                  originalSize: file.size,
                  previewUrl: URL.createObjectURL(webpBlob)
                });
              }).catch(reject);
            } else {
              // Fallback to JPEG (quality 0.90)
              canvas.toBlob((jpegBlob) => {
                if (jpegBlob) {
                  blobToBase64DataUrl(jpegBlob).then(base64 => {
                    resolve({
                      blob: jpegBlob,
                      base64,
                      mimeType: 'image/jpeg',
                      extension: 'jpg',
                      formatLabel: 'JPEG 90%',
                      width: targetWidth,
                      height: targetHeight,
                      originalWidth,
                      originalHeight,
                      size: jpegBlob.size,
                      originalSize: file.size,
                      previewUrl: URL.createObjectURL(jpegBlob)
                    });
                  }).catch(reject);
                } else {
                  reject(new Error('Không thể nén ảnh'));
                }
              }, 'image/jpeg', 0.90);
            }
          }, 'image/webp', 0.92);
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Convert legacy base64 data URL to compressed blob for lazy migration
export async function dataUrlToCompressedBlob(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const originalWidth = img.naturalWidth || img.width;
        const originalHeight = img.naturalHeight || img.height;
        const maxDim = 1600;
        let targetWidth = originalWidth;
        let targetHeight = originalHeight;
        if (originalWidth > maxDim || originalHeight > maxDim) {
          if (originalWidth >= originalHeight) {
            targetWidth = maxDim;
            targetHeight = Math.round((originalHeight * maxDim) / originalWidth);
          } else {
            targetHeight = maxDim;
            targetWidth = Math.round((originalWidth * maxDim) / originalHeight);
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        canvas.toBlob((blob) => {
          if (blob && blob.type === 'image/webp') {
            blobToBase64DataUrl(blob).then(base64 => {
              resolve({ blob, base64, mimeType: 'image/webp', extension: 'webp', size: blob.size });
            }).catch(() => resolve(null));
          } else {
            canvas.toBlob((jBlob) => {
              if (jBlob) {
                blobToBase64DataUrl(jBlob).then(base64 => {
                  resolve({ blob, base64, mimeType: 'image/jpeg', extension: 'jpg', size: jBlob.size });
                }).catch(() => resolve(null));
              } else {
                resolve(null);
              }
            }, 'image/jpeg', 0.90);
          }
        }, 'image/webp', 0.92);
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

window.previewSupervisorPhoto = async function(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const previewEl = document.getElementById('sup-photo-preview');
  const infoEl = document.getElementById('sup-photo-info');
  const removeBtn = document.getElementById('sup-btn-remove-photo');

  try {
    if (infoEl) {
      infoEl.textContent = '⏳ Đang tối ưu và nén ảnh chất lượng cao...';
      infoEl.className = 'text-[11px] text-blue-600 font-semibold mt-1';
    }
    const processed = await processSupervisorPhotoFile(file);
    state.pendingSupervisorPhotoBlob = processed;
    state.pendingRemoveSupervisorPhoto = false;

    if (previewEl) previewEl.src = processed.previewUrl;
    if (removeBtn) removeBtn.classList.remove('hidden');

    const origFmt = formatSupervisorFileSize(processed.originalSize);
    const newFmt = formatSupervisorFileSize(processed.size);
    if (infoEl) {
      infoEl.textContent = `Gốc: ${processed.originalWidth}x${processed.originalHeight} (${origFmt}) | Sau xử lý: ${processed.width}x${processed.height} (${newFmt}, ${processed.formatLabel})`;
      infoEl.className = 'text-[11px] text-emerald-600 font-semibold mt-1';
    }
    showToast(`✓ Đã tối ưu ảnh (${newFmt}). Ảnh sẽ được tải lên Storage khi bấm Lưu.`, 'success');
  } catch (err) {
    console.error('Lỗi xử lý ảnh GVHD:', err);
    if (infoEl) {
      infoEl.textContent = '❌ ' + err.message;
      infoEl.className = 'text-[11px] text-rose-600 font-semibold mt-1';
    }
    showToast(err.message, 'error');
    input.value = '';
    state.pendingSupervisorPhotoBlob = null;
  }
};

window.removeSupervisorPhoto = function() {
  state.pendingSupervisorPhotoBlob = null;
  state.pendingRemoveSupervisorPhoto = true;
  const photoInput = document.getElementById('sup-form-photo');
  const pathInput = document.getElementById('sup-form-photo-path');
  const fileInput = document.getElementById('sup-form-file');
  const previewEl = document.getElementById('sup-photo-preview');
  const infoEl = document.getElementById('sup-photo-info');
  const removeBtn = document.getElementById('sup-btn-remove-photo');

  if (photoInput) photoInput.value = '';
  if (pathInput) pathInput.value = '';
  if (fileInput) fileInput.value = '';
  if (previewEl) {
    const name = document.getElementById('sup-form-name')?.value || 'GV';
    previewEl.onerror = null;
    previewEl.src = getSupervisorAvatarSvgDataUri(name);
  }
  if (infoEl) {
    infoEl.textContent = 'Đã chọn xóa ảnh (Bấm Lưu GVHD để hoàn tất)';
    infoEl.className = 'text-[11px] text-amber-600 font-semibold mt-1';
  }
  if (removeBtn) removeBtn.classList.add('hidden');
};

window.handleEmploymentTypeChange = function(type, isEdit = false) {
  const quotaInput = document.getElementById('sup-form-default-quota');
  if (!quotaInput) return;
  const isAdjunct = (type === 'adjunct');
  const maxCap = isAdjunct ? 5 : 10;
  quotaInput.max = maxCap;

  if (!isEdit) {
    // When creating new supervisor, set standard default
    quotaInput.value = isAdjunct ? 5 : 10;
  } else {
    // When editing, if current value exceeds new max, cap it
    const current = parseInt(quotaInput.value, 10) || 5;
    if (current > maxCap) {
      quotaInput.value = maxCap;
    }
  }
};

window.openCreateSupervisorModal = function() {
  document.getElementById('form-supervisor').reset();
  document.getElementById('sup-form-id').value = '';
  document.getElementById('sup-form-photo').value = '';
  if (document.getElementById('sup-form-photo-path')) {
    document.getElementById('sup-form-photo-path').value = '';
  }
  const prevEl = document.getElementById('sup-photo-preview');
  if (prevEl) {
    prevEl.onerror = null;
    prevEl.src = getSupervisorAvatarSvgDataUri('GV');
  }
  
  const removeBtn = document.getElementById('sup-btn-remove-photo');
  if (removeBtn) removeBtn.classList.add('hidden');
  const infoEl = document.getElementById('sup-photo-info');
  if (infoEl) {
    infoEl.textContent = 'Hỗ trợ JPG, PNG, WebP (tối đa 10MB, tự động tối ưu chất lượng cao WebP/JPEG)';
    infoEl.className = 'text-[11px] text-slate-500 mt-1';
  }
  state.pendingSupervisorPhotoBlob = null;
  state.pendingRemoveSupervisorPhoto = false;

  if (document.getElementById('sup-form-dept-select')) {
    document.getElementById('sup-form-dept-select').value = 'Thiết kế nội thất';
  }
  if (document.getElementById('sup-form-dept-custom')) {
    document.getElementById('sup-form-dept-custom').classList.add('hidden');
    document.getElementById('sup-form-dept-custom').value = '';
  }
  if (document.getElementById('sup-form-dept')) {
    document.getElementById('sup-form-dept').value = 'Thiết kế nội thất';
  }
  if (document.getElementById('sup-form-gender')) {
    document.getElementById('sup-form-gender').value = 'Nam';
  }
  
  // Default to internal (Cơ hữu) with defaultQuota = 10
  if (document.getElementById('sup-form-employment-type')) {
    document.getElementById('sup-form-employment-type').value = 'internal';
  }
  if (document.getElementById('sup-form-default-quota')) {
    document.getElementById('sup-form-default-quota').max = 10;
    document.getElementById('sup-form-default-quota').value = '10';
  }
  
  document.getElementById('modal-supervisor-title').textContent = 'Thêm Giảng viên Hướng dẫn';
  document.getElementById('modal-supervisor').classList.remove('hidden');
};

window.editSupervisorMasterModal = function(supId) {
  const s = state.supervisorsMaster.find(x => x.id === supId);
  if (!s) return;

  document.getElementById('sup-form-id').value = s.id;
  document.getElementById('sup-form-name').value = s.name || '';
  document.getElementById('sup-form-email').value = s.email || '';
  document.getElementById('sup-form-phone').value = s.phone || '';
  document.getElementById('sup-form-photo').value = s.photoUrl || '';
  if (document.getElementById('sup-form-photo-path')) {
    document.getElementById('sup-form-photo-path').value = s.photoPath || '';
  }
  const prevElEdit = document.getElementById('sup-photo-preview');
  if (prevElEdit) {
    prevElEdit.onerror = function() {
      this.onerror = null;
      this.src = getSupervisorAvatarSvgDataUri(s.name || 'GV');
    };
    prevElEdit.src = (s.photoUrl && s.photoUrl.trim()) ? s.photoUrl : getSupervisorAvatarSvgDataUri(s.name || 'GV');
  }
  
  const removeBtn = document.getElementById('sup-btn-remove-photo');
  if (removeBtn) {
    if (s.photoUrl) removeBtn.classList.remove('hidden');
    else removeBtn.classList.add('hidden');
  }

  const infoEl = document.getElementById('sup-photo-info');
  if (infoEl) {
    if (s.photoUrl && s.photoUrl.startsWith('data:image')) {
      infoEl.textContent = '⚠️ Ảnh đang lưu định dạng cũ (base64). Hệ thống sẽ tự động nén & chuyển lên Storage khi bấm Lưu.';
      infoEl.className = 'text-[11px] text-amber-600 font-semibold mt-1';
    } else if (s.photoUrl) {
      infoEl.textContent = '✓ Ảnh đã được lưu trữ trên Firebase Storage.';
      infoEl.className = 'text-[11px] text-emerald-600 font-semibold mt-1';
    } else {
      infoEl.textContent = 'Hỗ trợ JPG, PNG, WebP (tối đa 10MB, tự động tối ưu chất lượng cao WebP/JPEG)';
      infoEl.className = 'text-[11px] text-slate-500 mt-1';
    }
  }
  state.pendingSupervisorPhotoBlob = null;
  state.pendingRemoveSupervisorPhoto = false;

  if (document.getElementById('sup-form-gender')) {
    document.getElementById('sup-form-gender').value = s.gender || 'Nam';
  }

  const dept = s.department || 'Thiết kế nội thất';
  const deptSelect = document.getElementById('sup-form-dept-select');
  const deptCustom = document.getElementById('sup-form-dept-custom');
  const deptHidden = document.getElementById('sup-form-dept');
  
  const standardDepts = ['Thiết kế nội thất', 'Thiết kế đồ họa', 'Thiết kế thời trang', 'Thiết kế công nghiệp', 'Nghệ thuật số'];
  if (standardDepts.includes(dept)) {
    if (deptSelect) deptSelect.value = dept;
    if (deptCustom) { deptCustom.classList.add('hidden'); deptCustom.value = ''; }
    if (deptHidden) deptHidden.value = dept;
  } else {
    if (deptSelect) deptSelect.value = '__other__';
    if (deptCustom) { deptCustom.classList.remove('hidden'); deptCustom.value = dept; }
    if (deptHidden) deptHidden.value = dept;
  }

  document.getElementById('sup-form-expertise').value = s.expertise || '';
  document.getElementById('sup-form-bio').value = s.bio || '';
  document.getElementById('sup-form-active').checked = s.active !== false;

  // Employment type & quota logic (preserving existing quota if within max cap)
  const empType = s.employmentType || 'internal';
  if (document.getElementById('sup-form-employment-type')) {
    document.getElementById('sup-form-employment-type').value = empType;
  }
  const maxCap = (empType === 'adjunct' ? 5 : 10);
  const existingQuota = Number(s.defaultQuota);
  const finalQuota = (!isNaN(existingQuota) && existingQuota >= 1) ? Math.min(maxCap, existingQuota) : (empType === 'adjunct' ? 5 : 10);

  if (document.getElementById('sup-form-default-quota')) {
    document.getElementById('sup-form-default-quota').max = maxCap;
    document.getElementById('sup-form-default-quota').value = finalQuota;
  }

  document.getElementById('modal-supervisor-title').textContent = 'Chỉnh sửa Giảng viên Hướng dẫn';
  document.getElementById('modal-supervisor').classList.remove('hidden');
};

window.deleteSupervisorMaster = async function(supId) {
  const sup = state.supervisorsMaster.find(s => s.id === supId);
  if (!sup) return;

  // Check if used in any rounds
  const inRound = state.roundSupervisors.some(rs => rs.supervisorId === supId || rs.id === supId);
  let msg = `Xóa giảng viên "${sup.name}" (${sup.email}) khỏi Danh sách GVHD?`;
  if (inRound) {
    msg = `⚠️ CẢNH BÁO: Giảng viên "${sup.name}" đang được phân công trong đợt tốt nghiệp hiện tại!\n\nBạn có chắc chắn muốn xóa khỏi Danh sách GVHD không?`;
  }

  const confirmed = await showConfirm('Xóa Giảng viên Hướng dẫn', msg, { confirmText: 'Xóa vĩnh viễn', danger: true });
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'supervisorMaster', supId));
    if (sup.photoPath && storage) {
      deleteObject(storageRef(storage, sup.photoPath)).catch(console.warn);
    }
    state.supervisorsMaster = state.supervisorsMaster.filter(s => s.id !== supId);
    renderAdminSupervisorsMasterTable();
    showToast(`Đã xóa giảng viên "${sup.name}" thành công.`, 'success');
  } catch (err) {
    console.error('Lỗi xóa GVHD:', err);
    showToast('Lỗi xóa GVHD: ' + err.message, 'error');
  }
};

window.closeSupervisorModal = function() {
  document.getElementById('modal-supervisor').classList.add('hidden');
  state.pendingSupervisorPhotoBlob = null;
  state.pendingRemoveSupervisorPhoto = false;
};

window.saveSupervisorMaster = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const id = document.getElementById('sup-form-id')?.value;
  const name = document.getElementById('sup-form-name')?.value.trim();
  const email = document.getElementById('sup-form-email')?.value.trim().toLowerCase();
  const phone = document.getElementById('sup-form-phone')?.value.trim();
  const gender = document.getElementById('sup-form-gender')?.value || 'Nam';

  let department = 'Thiết kế nội thất';
  const deptSelect = document.getElementById('sup-form-dept-select')?.value;
  if (deptSelect === '__other__') {
    department = document.getElementById('sup-form-dept-custom')?.value.trim() || 'Khác';
  } else if (deptSelect) {
    department = deptSelect;
  }

  const expertise = document.getElementById('sup-form-expertise')?.value.trim();
  const bio = document.getElementById('sup-form-bio')?.value.trim();
  const active = document.getElementById('sup-form-active')?.checked !== false;

  const employmentType = document.getElementById('sup-form-employment-type')?.value || 'internal';
  const maxCap = (employmentType === 'adjunct' ? 5 : 10);
  const defaultQuotaRaw = parseInt(document.getElementById('sup-form-default-quota')?.value, 10);
  const defaultQuota = (Number.isInteger(defaultQuotaRaw) && defaultQuotaRaw >= 1) ? Math.min(maxCap, defaultQuotaRaw) : maxCap;

  if (!name || !email || !email.includes('@')) {
    showToast('Vui lòng điền Họ tên và Email hợp lệ', 'error');
    return;
  }

  const submitBtn = document.querySelector('#form-supervisor button[type="submit"]');
  const origText = submitBtn ? submitBtn.innerHTML : 'Lưu GVHD';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Đang lưu...</span>';
  }

  // ----------------------------------------------------------------------------
  // PHOTO HANDLING: IFAA FIREBASE STORAGE VIA GRADUATION API & BASE64 BLOCK
  // ----------------------------------------------------------------------------
  let finalPhotoUrl = document.getElementById('sup-form-photo')?.value.trim() || '';
  let finalPhotoPath = document.getElementById('sup-form-photo-path')?.value.trim() || '';
  const cleanId = id || email.replace(/[^a-z0-9_.-]/g, '_');
  const apiBase = window.IFA_CONFIG?.graduationApiEndpoint || window.IFA_CONFIG?.driveUploadEndpoint || 'https://asia-southeast1-ifa-activities.cloudfunctions.net/graduationApi';

  if (state.pendingRemoveSupervisorPhoto) {
    if (submitBtn) submitBtn.innerHTML = '<span>⏳ Đang xóa ảnh trên Storage...</span>';
    try {
      const idToken = state.user ? await state.user.getIdToken() : null;
      if (idToken && (id || cleanId)) {
        await fetch(apiBase + '/api/graduation/delete-supervisor-portrait', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + idToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ supervisorId: id || cleanId })
        }).catch(err => console.warn('[Storage] Delete portrait warning:', err));
      }
    } catch (delErr) {
      console.warn('[Storage] Delete portrait exception:', delErr);
    }
    finalPhotoUrl = '';
    finalPhotoPath = '';
  } else if (state.pendingSupervisorPhotoBlob) {
    if (submitBtn) submitBtn.innerHTML = '<span>⏳ Đang tải ảnh lên Storage (IFA)...</span>';
    try {
      const idToken = state.user ? await state.user.getIdToken() : null;
      if (!idToken) {
        throw new Error('Chưa đăng nhập hoặc phiên làm việc đã hết hạn. Vui lòng tải lại trang.');
      }

      const uploadRes = await fetch(apiBase + '/api/graduation/supervisor-portrait', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + idToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supervisorId: id || cleanId,
          mimeType: state.pendingSupervisorPhotoBlob.mimeType,
          imageBase64: state.pendingSupervisorPhotoBlob.base64
        })
      });

      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData.ok) {
        throw new Error(uploadData.error || `Lỗi tải ảnh lên Storage (HTTP ${uploadRes.status})`);
      }

      finalPhotoUrl = uploadData.photoUrl;
      finalPhotoPath = uploadData.photoPath;
    } catch (uploadErr) {
      console.error('Lỗi upload Storage:', uploadErr);
      showToast('Lỗi tải ảnh lên Storage: ' + uploadErr.message + '. Dữ liệu GVHD cũ được giữ nguyên.', 'error', 6000);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
      return; // Stop flow on upload failure to preserve existing data
    }
  } else if (finalPhotoUrl.startsWith('data:image')) {
    // Lazy migration of legacy base64
    if (submitBtn) submitBtn.innerHTML = '<span>⏳ Đang tối ưu & chuyển ảnh sang Storage...</span>';
    const migrated = await dataUrlToCompressedBlob(finalPhotoUrl);
    if (migrated) {
      try {
        const idToken = state.user ? await state.user.getIdToken() : null;
        if (!idToken) throw new Error('Chưa đăng nhập');

        const uploadRes = await fetch(apiBase + '/api/graduation/supervisor-portrait', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + idToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            supervisorId: id || cleanId,
            mimeType: migrated.mimeType,
            imageBase64: migrated.base64
          })
        });

        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadData.ok) {
          throw new Error(uploadData.error || `HTTP ${uploadRes.status}`);
        }
        finalPhotoUrl = uploadData.photoUrl;
        finalPhotoPath = uploadData.photoPath;
      } catch (migErr) {
        console.warn('Lỗi lazy migrate base64 photo:', migErr);
        showToast('Lỗi chuyển đổi ảnh sang Storage: ' + migErr.message + '. Dữ liệu GVHD cũ được giữ nguyên.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }
        return;
      }
    }
  }

  // BASE64 BLOCK: NEVER allow base64 string to be saved to Firestore
  if (finalPhotoUrl && finalPhotoUrl.startsWith('data:')) {
    showToast('Lỗi: Ảnh chưa được tải lên Firebase Storage. Không thể lưu chuỗi base64 vào cơ sở dữ liệu.', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
    }
    return;
  }

  const payload = {
    name,
    email,
    phone,
    photoUrl: finalPhotoUrl,
    photoPath: finalPhotoPath,
    gender,
    department,
    expertise,
    bio,
    employmentType,
    defaultQuota,
    active,
    updatedAt: serverTimestamp()
  };

  try {
    let savedId = id;
    if (id) {
      await updateDoc(doc(db, 'supervisorMaster', id), payload);
    } else {
      payload.createdAt = serverTimestamp();
      const docRef = await addDoc(collection(db, 'supervisorMaster'), payload);
      savedId = docRef.id;
    }

    state.pendingSupervisorPhotoBlob = null;
    state.pendingRemoveSupervisorPhoto = false;

    const supObj = { id: savedId, ...payload };
    const existingIdx = state.supervisorsMaster.findIndex(s => s.id === savedId);
    if (existingIdx >= 0) {
      state.supervisorsMaster[existingIdx] = { ...state.supervisorsMaster[existingIdx], ...supObj };
    } else {
      state.supervisorsMaster.unshift(supObj);
    }

    renderAdminSupervisorsMasterTable();
    closeSupervisorModal();
    showToast('✓ Lưu Giảng viên Hướng dẫn thành công!', 'success');

    // Background sync
    loadAdminSupervisorsMaster().catch(console.error);
  } catch (err) {
    console.error('Lỗi lưu GVHD:', err);
    showToast('Lỗi lưu GVHD: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
    }
  }
};


// --- ADMIN: ROUND SUPERVISORS ---
window.loadAdminRoundSupervisors = async function(roundId) {
  try {
    const snap = await getDocs(collection(db, 'graduationRounds', roundId, 'supervisors'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminRoundSupervisorsTable(roundId, list);
  } catch (e) {
    console.error('Error loading admin round supervisors:', e);
  }
};

function renderAdminRoundSupervisorsTable(roundId, list) {
  const tbody = document.getElementById('admin-round-supervisors-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Chưa có GVHD nào trong đợt này. Bấm "+ Thêm GVHD từ kho Master" để thêm.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(s => {
    const supMaster = (state.supervisorsMaster || []).find(x => x.id === s.id);
    const { employmentType, maxCap, defaultQuota } = getSupervisorDefaultAndMaxQuota(supMaster || s);
    const curCap = typeof s.capacity === 'number' ? s.capacity : defaultQuota;
    const typeBadge = employmentType === 'adjunct'
      ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 ml-1">Thỉnh giảng (tối đa 5)</span>'
      : '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 ml-1">Cơ hữu (tối đa 10)</span>';

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5">
          <span class="font-bold text-slate-900 block">${escapeHtml(s.name)}</span>
          ${typeBadge}
        </td>
        <td class="p-3.5 text-slate-600">${escapeHtml(s.department || '--')}</td>
        <td class="p-3.5">
          <input type="number" id="cap-input-${s.id}" value="${curCap}" min="1" max="${maxCap}" class="w-20 p-1 border rounded-lg font-bold text-center">
        </td>
        <td class="p-3.5">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" id="active-round-chk-${s.id}" ${s.activeInRound !== false ? 'checked' : ''} class="rounded text-blue-600">
            <span class="text-xs font-semibold">${s.activeInRound !== false ? 'Hoạt động' : 'Tạm ẩn'}</span>
          </label>
        </td>
        <td class="p-3.5 text-right space-x-2">
          <button onclick="saveRoundSupervisorRow('${roundId}', '${s.id}')" class="text-emerald-600 font-bold hover:underline">Lưu</button>
          <button onclick="removeRoundSupervisor('${roundId}', '${s.id}')" class="text-rose-600 font-bold hover:underline">Bỏ khỏi đợt</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.saveRoundSupervisorRow = async function(roundId, supId) {
  const supMaster = (state.supervisorsMaster || []).find(x => x.id === supId);
  const { employmentType, maxCap } = getSupervisorDefaultAndMaxQuota(supMaster);
  const rawCap = parseInt(document.getElementById('cap-input-' + supId)?.value, 10);

  if (isNaN(rawCap) || rawCap < 1) {
    showToast('Chỉ tiêu phải lớn hơn hoặc bằng 1.', 'warning');
    return;
  }

  if (rawCap > maxCap) {
    const typeLabel = employmentType === 'adjunct' ? 'Thỉnh giảng (tối đa 5)' : 'Cơ hữu (tối đa 10)';
    showToast(`Chỉ tiêu vượt quá quy định của Trường (${typeLabel}). Đã tự động điều chỉnh về mức tối đa: ${maxCap}.`, 'warning', 4500);
  }

  const capacity = Math.min(maxCap, Math.max(1, rawCap));
  const activeInRound = document.getElementById('active-round-chk-' + supId)?.checked !== false;

  try {
    await updateDoc(doc(db, 'graduationRounds', roundId, 'supervisors', supId), {
      capacity, activeInRound, updatedAt: serverTimestamp()
    });
    const capInput = document.getElementById('cap-input-' + supId);
    if (capInput) capInput.value = capacity;
    showToast(`Đã cập nhật chỉ tiêu: ${capacity} SV (Tối đa Trường: ${maxCap})!`, 'success');
    await refreshRoundCardMetrics(roundId);
  } catch (e) {
    showToast('Lỗi cập nhật: ' + e.message, 'error');
  }
};

window.removeRoundSupervisor = async function(roundId, supId) {
  if (!(await showConfirm('Bỏ GVHD khỏi đợt', 'Bạn có chắc chắn muốn gỡ GVHD này khỏi đợt tốt nghiệp?', { confirmText: 'Gỡ khỏi đợt', danger: true }))) return;
  try {
    await deleteDoc(doc(db, 'graduationRounds', roundId, 'supervisors', supId));
    await loadAdminRoundSupervisors(roundId);
    await refreshRoundCardMetrics(roundId);
  } catch (e) {
    showToast('Lỗi xóa: ' + e.message, 'error');
  }
};

window.updateSupPickerCount = function() {
  const count = document.querySelectorAll('.sup-picker-chk:checked').length;
  const countEl = document.getElementById('sup-master-picker-selected-count');
  if (countEl) countEl.textContent = count;
};

window.toggleSelectAllSupPicker = function() {
  const chks = document.querySelectorAll('.sup-picker-chk');
  const anyUnchecked = Array.from(chks).some(c => !c.checked);
  chks.forEach(c => c.checked = anyUnchecked);
  updateSupPickerCount();
};

window.openAddSupervisorsToRoundModal = async function() {
  await loadAdminSupervisorsMaster();
  const listEl = document.getElementById('sup-master-picker-list');
  const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23cbd5e1'/%3E%3Cpath fill='%23cbd5e1' d='M12 14c-6 0-8 4-8 4v2h16v-2s-2-4-8-4z'/%3E%3C/svg%3E";
  
  const activeSups = state.supervisorsMaster.filter(s => s.active !== false);
  const totalBadge = document.getElementById('sup-picker-total-badge');
  if (totalBadge) totalBadge.textContent = `${activeSups.length} GVHD khả dụng`;

  listEl.innerHTML = activeSups.map(s => `
    <label class="flex items-center gap-3.5 p-3 hover:bg-slate-50 cursor-pointer rounded-xl transition-colors">
      <input type="checkbox" value="${s.id}" onchange="updateSupPickerCount()" class="sup-picker-chk w-4 h-4 rounded text-blue-600">
      <img src="${s.photoUrl || defaultAvatar}" class="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-sm shrink-0">
      <div class="flex-1 min-w-0">
        <span class="font-bold text-slate-800 text-xs block truncate">${s.name}</span>
        <span class="text-[11px] text-slate-500 block truncate">${s.department || 'Thiết kế nội thất'} • ${s.expertise || 'Đang cập nhật'}</span>
      </div>
    </label>
  `).join('');

  updateSupPickerCount();
  document.getElementById('modal-add-sup-to-round').classList.remove('hidden');
};

window.closeAddSupToRoundModal = function() {
  document.getElementById('modal-add-sup-to-round').classList.add('hidden');
};

window.saveSelectedSupervisorsToRound = async function() {
  const roundId = document.getElementById('admin-round-sup-select').value;
  if (!roundId) return;

  const chks = Array.from(document.querySelectorAll('.sup-picker-chk:checked'));
  if (chks.length === 0) {
    showToast('Vui lòng chọn ít nhất 1 giảng viên.', 'warning');
    return;
  }

  const batch = writeBatch(db);
  chks.forEach(chk => {
    const supId = chk.value;
    const sup = state.supervisorsMaster.find(s => s.id === supId);
    if (!sup) return;

    const ref = doc(db, 'graduationRounds', roundId, 'supervisors', supId);
    batch.set(ref, {
      supervisorId: supId,
      name: sup.name,
      email: sup.email || '',
      phone: sup.phone || '',
      photoUrl: sup.photoUrl || '',
      department: sup.department || '',
      expertise: sup.expertise || '',
      bio: sup.bio || '',
      showEmail: sup.showEmail !== false,
      showPhone: Boolean(sup.showPhone),
      showPhoto: sup.showPhoto !== false,
      capacity: getSupervisorDefaultAndMaxQuota(sup).defaultQuota,
      activeInRound: true,
      sortOrder: 1,
      createdAt: serverTimestamp()
    });
  });

  try {
    await batch.commit();
    closeAddSupToRoundModal();
    await loadAdminRoundSupervisors(roundId);
    await refreshRoundCardMetrics(roundId);
  } catch (e) {
    showToast('Lỗi thêm GVHD: ' + e.message, 'error');
  }
};


// =========================================================================

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof loadAdminSupervisorsMaster !== 'undefined') window.loadAdminSupervisorsMaster = loadAdminSupervisorsMaster;
  if (typeof getSupervisorInitials !== 'undefined') window.getSupervisorInitials = getSupervisorInitials;
  if (typeof getSupervisorAvatarSvgDataUri !== 'undefined') window.getSupervisorAvatarSvgDataUri = getSupervisorAvatarSvgDataUri;
  if (typeof renderAdminSupervisorsMasterTable !== 'undefined') window.renderAdminSupervisorsMasterTable = renderAdminSupervisorsMasterTable;
  if (typeof formatSupervisorFileSize !== 'undefined') window.formatSupervisorFileSize = formatSupervisorFileSize;
  if (typeof blobToBase64DataUrl !== 'undefined') window.blobToBase64DataUrl = blobToBase64DataUrl;
  if (typeof processSupervisorPhotoFile !== 'undefined') window.processSupervisorPhotoFile = processSupervisorPhotoFile;
  if (typeof dataUrlToCompressedBlob !== 'undefined') window.dataUrlToCompressedBlob = dataUrlToCompressedBlob;
  if (typeof renderAdminRoundSupervisorsTable !== 'undefined') window.renderAdminRoundSupervisorsTable = renderAdminRoundSupervisorsTable;
}

if (typeof window !== "undefined" && typeof loadRoundSupervisors !== "undefined") { window.loadRoundSupervisors = loadRoundSupervisors; }
