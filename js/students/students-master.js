// IFAA FACULTY STUDENT MASTER — READ-ONLY INTEGRATION (v2.3.4)
// Single Source of Truth: ifa-activities (IFAA)
// Graduation is STRICT CONSUMER ONLY. 0 Writes to IFAA.
// ============================================================================

export const IFAA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDoz3iLOjU1JpHkgTDQHPyh29vUYOCcJhU",
  authDomain: "ifa-activities.firebaseapp.com",
  projectId: "ifa-activities",
  storageBucket: "ifa-activities.firebasestorage.app",
  messagingSenderId: "633545868576",
  appId: "1:633545868576:web:c1509233a2b5046b320345"
};

// Download tokens are rotated by IFAA when the dataset is rebuilt. Never pin one in the app.
export const DEFAULT_IFAA_DATASET_URL = '';
export const BACKUP_IFAA_DATASET_URL = '';

let ifaaAppInstance = null;
let ifaaFirestoreInstance = null;
let ifaaStorageInstance = null;
let ifaaAuthInstance = null;

export function getIFAAFirebase() {
  try {
    if (!ifaaAppInstance) {
      const existing = getApps().find(a => a.name === 'ifaa-readonly');
      ifaaAppInstance = existing || initializeApp(IFAA_FIREBASE_CONFIG, 'ifaa-readonly');
    }
    if (!ifaaFirestoreInstance && ifaaAppInstance) {
      ifaaFirestoreInstance = getFirestore(ifaaAppInstance);
    }
    if (!ifaaStorageInstance && ifaaAppInstance) {
      ifaaStorageInstance = getStorage(ifaaAppInstance);
    }
    if (!ifaaAuthInstance && ifaaAppInstance) {
      ifaaAuthInstance = getAuth(ifaaAppInstance);
    }
    return { app: ifaaAppInstance, db: ifaaFirestoreInstance, storage: ifaaStorageInstance, auth: ifaaAuthInstance };
  } catch (err) {
    console.warn('[IFAA ReadOnly] Không thể khởi tạo secondary app:', err);
    return { app: null, db: null, storage: null, auth: null };
  }
}

async function waitForIFAAAuth(authInstance) {
  if (!authInstance) return null;
  if (typeof authInstance.authStateReady === 'function') await authInstance.authStateReady();
  return authInstance.currentUser;
}

async function connectIFAAForAdmin() {
  const { auth: ifaaAuth } = getIFAAFirebase();
  if (!ifaaAuth) throw new Error('Không thể khởi tạo kết nối IFA+ Activities.');
  // This is called directly from the admin's refresh click so the popup retains user activation.
  if (!ifaaAuth.currentUser) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: auth?.currentUser?.email || '' });
    await signInWithPopup(ifaaAuth, provider);
  }
  if (ifaaAuth.currentUser?.email?.toLowerCase() !== auth?.currentUser?.email?.toLowerCase()) {
    await signOut(ifaaAuth);
    throw new Error('Hãy đăng nhập IFA+ Activities bằng đúng tài khoản đang dùng tại Graduation.');
  }
}

// IndexedDB Cache for Faculty Dataset
const FACULTY_CACHE_DB = 'graduation-faculty-dataset';
const FACULTY_CACHE_STORE = 'datasets';
const FACULTY_CACHE_KEY = 'faculty-students';

function openFacultyCache() {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null);
    try {
      const req = indexedDB.open(FACULTY_CACHE_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(FACULTY_CACHE_STORE)) {
          req.result.createObjectStore(FACULTY_CACHE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getFacultyCache() {
  try {
    const database = await openFacultyCache();
    if (!database) return null;
    return await new Promise((resolve) => {
      const tx = database.transaction(FACULTY_CACHE_STORE, 'readonly');
      const req = tx.objectStore(FACULTY_CACHE_STORE).get(FACULTY_CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => database.close();
    });
  } catch {
    return null;
  }
}

async function setFacultyCache(data) {
  try {
    const database = await openFacultyCache();
    if (!database) return;
    await new Promise((resolve) => {
      const tx = database.transaction(FACULTY_CACHE_STORE, 'readwrite');
      tx.objectStore(FACULTY_CACHE_STORE).put(data, FACULTY_CACHE_KEY);
      tx.oncomplete = () => {
        database.close();
        resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function gunzipData(bytes) {
  if (!('DecompressionStream' in window)) {
    throw new Error('Trình duyệt chưa hỗ trợ DecompressionStream(gzip).');
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  } catch (err) {
    console.error('Lỗi giải nén gzip:', err);
    throw err;
  }
}

// Module State
state.facultyDatasetMeta = null;
state.facultyStudentsLoaded = false;
state.facultyFilteredStudents = [];
state.facultyCurrentPage = 1;
state.facultyPageSize = 15;
if (!state.facultyStudentsMap) {
  state.facultyStudentsMap = new Map();
}

function updateFacultyStatusUI(text, stateType = 'info') {
  const textEl = document.getElementById('faculty-dataset-status-text');
  const dotEl = document.getElementById('faculty-dataset-status-dot');
  if (textEl) textEl.textContent = text;
  if (dotEl) {
    dotEl.className = 'w-2 h-2 rounded-full ' + (
      stateType === 'success' ? 'bg-emerald-500' :
      stateType === 'warning' ? 'bg-amber-500' :
      stateType === 'error' ? 'bg-rose-500' :
      'bg-slate-400'
    );
  }
}

export function normalizeFacultyStudent(item) {
  if (!item) return null;
  const rawId = item.mssv || item.studentId || item.studentCode || item.student_id || item.code || item.id;
  if (!rawId) return null;
  const mssv = String(rawId).trim().replace(/\s+/g, '').toUpperCase();
  if (!mssv) return null;

  const rawName = item.fullName || item.name || item.hoTen || item.studentName || item.student_name || item.hoten || '';
  const fullName = String(rawName).trim().replace(/\s+/g, ' ');
  const rawClass = item.className || item.class || item.studentClass || item.lop || item.student_class || '';
  const studentClass = String(rawClass).trim();
  const rawMajor = item.major || item.majorName || item.nganh || item.major_name || item.chuyenNganh || '';
  const major = String(rawMajor).trim();
  const rawEmail = item.email || (mssv ? `${mssv.toLowerCase()}@student.tdtu.edu.vn` : '');
  const email = String(rawEmail).trim().toLowerCase();

  return {
    mssv,
    studentId: mssv,
    name: fullName,
    fullName,
    email,
    gender: String(item.gender || item.gioiTinh || '').trim(),
    major: major || 'Thiết kế Nội thất',
    majorName: major || 'Thiết kế Nội thất',
    className: studentClass,
    class: studentClass,
    studentClass,
    admissionYear: item.admissionYear || item.khoa || '',
    course: item.course || '',
    phone: item.phone || item.soDienThoai || ''
  };
}
window.normalizeFacultyStudent = normalizeFacultyStudent;

function normalizeFacultyRows(value) {
  const rows = Array.isArray(value) ? value : (value?.students || value?.data || []);
  if (!Array.isArray(rows)) return [];
  const results = [];
  for (const item of rows) {
    const norm = normalizeFacultyStudent(item);
    if (norm) results.push(norm);
  }
  return results;
}

// ============================================================================
// CENTRAL STUDENT RESOLVER API (READ-ONLY)
// ============================================================================

window.getFacultyStudentByMssv = function(mssv) {
  if (!mssv) return null;
  const cleanId = String(mssv).trim().replace(/\s+/g, '').toUpperCase();
  if (!cleanId) return null;

  // 1. In-memory Map lookup (O(1))
  if (state.facultyStudentsMap && state.facultyStudentsMap.has(cleanId)) {
    return state.facultyStudentsMap.get(cleanId);
  }

  // 2. In-memory array fallback
  if (Array.isArray(state.facultyStudents) && state.facultyStudents.length > 0) {
    const inList = state.facultyStudents.find(s => {
      const sId = String(s.mssv || s.studentId || s.studentCode || '').trim().replace(/\s+/g, '').toUpperCase();
      return sId === cleanId;
    });
    if (inList) {
      const norm = normalizeFacultyStudent(inList);
      if (state.facultyStudentsMap) state.facultyStudentsMap.set(cleanId, norm);
      return norm;
    }
  }

  return null;
};

window.getFacultyStudent = function(studentId) {
  if (!studentId) return null;
  const cleanId = String(studentId).trim().replace(/\s+/g, '').toUpperCase();

  const found = window.getFacultyStudentByMssv(cleanId);
  if (found) return found;

  // Graceful fallback for missing student in master (never crash)
  return {
    mssv: cleanId,
    studentId: cleanId,
    name: `Sinh viên ${cleanId}`,
    fullName: `Sinh viên ${cleanId}`,
    gender: '',
    major: '',
    className: '',
    studentClass: '',
    email: `${cleanId.toLowerCase()}@student.tdtu.edu.vn`,
    phone: '',
    isMissing: true,
    notFoundInMaster: true
  };
};

window.getFacultyStudents = function(filterFn) {
  const list = state.facultyStudents || [];
  return typeof filterFn === 'function' ? list.filter(filterFn) : list;
};

window.searchFacultyStudents = async function(query, options = {}) {
  await ensureFacultyDatasetLoaded();
  const q = String(query || '').trim().toLowerCase();
  let results = state.facultyStudents || [];

  if (q) {
    results = results.filter(s =>
      (s.mssv && s.mssv.toLowerCase().includes(q)) ||
      (s.fullName && s.fullName.toLowerCase().includes(q)) ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.className && s.className.toLowerCase().includes(q)) ||
      (s.studentClass && s.studentClass.toLowerCase().includes(q))
    );
  }

  if (options.major) {
    results = results.filter(s => (s.major || '').toLowerCase() === String(options.major).toLowerCase());
  }

  if (options.className || options.studentClass) {
    const cls = options.className || options.studentClass;
    results = results.filter(s => (s.className || s.studentClass || '') === cls);
  }

  if (options.gender) {
    results = results.filter(s => (s.gender || '').toLowerCase() === String(options.gender).toLowerCase());
  }

  return results;
};

// Main Loader: Fetches from IFAA Secondary App / Storage + IndexedDB Cache
export async function loadFacultyDatasetFromIFAA({ force = false } = {}) {
  // 1. In-memory cached
  if (!force && state.facultyStudentsLoaded && state.facultyStudents && state.facultyStudents.length > 0) {
    return state.facultyStudents;
  }

  // 2. Local IndexedDB Cache
  const cached = await getFacultyCache();

  // 3. Read authoritative IFAA metadata when authenticated; the primary mirror may be stale.
  let meta = null;
  try {
    const { db: ifaaDb, auth: ifaaAuth } = getIFAAFirebase();
    if (ifaaDb && await waitForIFAAAuth(ifaaAuth)) {
      const snap = await getDoc(doc(ifaaDb, 'facultyStudentMeta', 'current'));
      if (snap.exists()) meta = snap.data();
    }
  } catch (err) { console.warn('[IFAA ReadOnly] Không đọc được metadata IFAA:', err); }

  if (!meta) {
    try {
      const primarySnap = await getDoc(doc(db, 'facultyStudentMeta', 'current'));
      if (primarySnap.exists()) meta = primarySnap.data();
    } catch (err) { console.warn('[IFAA ReadOnly] Không đọc được metadata dự phòng:', err); }
  }
  state.facultyDatasetMeta = meta;

  const currentVersion = Number(meta?.datasetVersion || meta?.version || 0);

  // 4. Cache validation check: if cached version matches metadata version, use cache
  if (!force && cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
    if (!currentVersion || Number(cached.version) === currentVersion) {
      state.facultyStudents = cached.rows;
      state.facultyStudentsMap = new Map(cached.rows.map(s => [s.mssv, s]));
      state.facultyStudentsLoaded = true;
      populateFacultyClassFilter(cached.rows);
      updateFacultyStatusUI(`Dữ liệu IFAA: ${cached.rows.length.toLocaleString('vi-VN')} SV (từ Cache)`, 'success');
      return cached.rows;
    }
  }

  // 5. Download Gzipped JSON from IFAA Storage / URL
  updateFacultyStatusUI('Đang tải dữ liệu từ IFA+ Activities...', 'info');
  let bytes = null;

  // Use the current URL published by IFAA; old static download tokens are invalid.
  const candidateUrls = [];
  if (meta?.datasetUrl && typeof meta.datasetUrl === 'string') {
    candidateUrls.push(meta.datasetUrl);
  }

  for (const rawUrl of candidateUrls) {
    if (bytes) break;
    try {
      let fetchUrl = rawUrl;
      if (force) {
        const sep = fetchUrl.includes('?') ? '&' : '?';
        fetchUrl = `${fetchUrl}${sep}v=${Date.now()}`;
      }
      const res = await fetch(fetchUrl, { cache: 'no-store' });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        if (buffer && buffer.byteLength > 0) {
          bytes = new Uint8Array(buffer);
          break;
        }
      }
    } catch (e) {
      console.warn('[IFAA ReadOnly] Lỗi tải từ URL:', rawUrl, e.message);
    }
  }

  // Method B: Download via Firebase Storage SDK (read-only fallback)
  if (!bytes) {
    try {
      const { storage: ifaaStorage } = getIFAAFirebase();
      if (ifaaStorage) {
        const path = meta?.datasetPath || 'datasets/faculty-students.json.gz';
        bytes = await storageGetBytes(storageRef(ifaaStorage, path), 15 * 1024 * 1024);
      }
    } catch (e) {
      console.warn('[IFAA ReadOnly] Lỗi tải từ Storage getBytes:', e.message);
    }
  }

  // An IFAA faculty admin can still read the source collection if its compressed
  // export has not been published yet. This remains read-only on IFAA.
  let firestoreRows = null;
  if (!bytes) {
    try {
      const { db: ifaaDb, auth: ifaaAuth } = getIFAAFirebase();
      if (ifaaDb && await waitForIFAAAuth(ifaaAuth)) {
        const snap = await getDocs(collection(ifaaDb, 'facultyStudents'));
        firestoreRows = snap.docs.map(item => ({ ...item.data(), mssv: item.id }));
      }
    } catch (error) {
      console.warn('[IFAA ReadOnly] Không đọc được danh sách gốc:', error);
    }
  }

  // 6. Decompress & Parse, or use the authorized source collection.
  if ((bytes && bytes.length > 0) || firestoreRows) {
    try {
      const parsed = bytes ? JSON.parse(await gunzipData(bytes)) : firestoreRows;
      const rows = normalizeFacultyRows(parsed);
      rows.sort((a, b) => String(a.mssv).localeCompare(String(b.mssv)));

      if (rows.length > 0) {
        state.lastFacultyLoadWasFallback = false;
        state.facultyStudents = rows;
        state.facultyStudentsMap = new Map(rows.map(s => [s.mssv, s]));
        state.facultyStudentsLoaded = true;

        // Save to IndexedDB with metadata
        const metaPayload = {
          version: currentVersion || Date.now(),
          rows: rows,
          cachedAt: Date.now(),
          count: rows.length,
          sourceUpdatedAt: meta?.datasetUpdatedAt || meta?.updatedAt || new Date().toISOString(),
          generation: String(meta?.datasetVersion || currentVersion || Date.now()),
          isLive: true
        };
        await setFacultyCache(metaPayload);
        state.studentDatasetMeta = metaPayload;

        // Sync metadata to tknt-tdtu if admin
        if (state.realIsAdmin && db && bytes) {
          setDoc(doc(db, 'facultyStudentMeta', 'current'), {
            count: rows.length,
            datasetVersion: currentVersion || Date.now(),
            datasetPath: 'datasets/faculty-students.json.gz',
            datasetUrl: meta?.datasetUrl || '',
            datasetEncoding: 'gzip',
            datasetBytes: bytes.byteLength,
            datasetUpdatedAt: meta?.datasetUpdatedAt || serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        }

        populateFacultyClassFilter(rows);
        updateFacultyStatusUI(`Dữ liệu IFAA: ${rows.length.toLocaleString('vi-VN')} SV (Đã làm mới)`, 'success');
        const metaInfoEl = document.getElementById('faculty-dataset-meta-info');
        if (metaInfoEl) {
          metaInfoEl.textContent = `· Nguồn: IFAA · ${rows.length.toLocaleString('vi-VN')} SV · Đồng bộ mới nhất`;
        }
        return rows;
      }
    } catch (err) {
      console.error('[IFAA ReadOnly] Lỗi giải nén / phân tích dữ liệu IFAA:', err);
    }
  }

  // 7. Fallback to cached rows if available
  if (cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
    state.lastFacultyLoadWasFallback = true;
    state.facultyStudents = cached.rows;
    state.facultyStudentsMap = new Map(cached.rows.map(s => [s.mssv, s]));
    state.facultyStudentsLoaded = true;
    state.studentDatasetMeta = cached;
    populateFacultyClassFilter(cached.rows);
    updateFacultyStatusUI(`Dữ liệu IFAA: ${cached.rows.length.toLocaleString('vi-VN')} SV (Bản lưu offline)`, 'warning');
    if (force) {
      showToast(`⚠️ Không thể tải dữ liệu mới từ IFAA. Đang dùng bản lưu gần nhất: ${cached.rows.length.toLocaleString('vi-VN')} sinh viên.`, 'warning', 6000);
    }
    return cached.rows;
  }

  // 8. Error handling when both live download and cache failed
  state.lastFacultyLoadWasFallback = false;
  state.facultyStudents = [];
  state.facultyStudentsMap = new Map();
  state.facultyStudentsLoaded = true;
  updateFacultyStatusUI('Chưa thể kết nối nguồn dữ liệu IFAA', 'warning');
  if (force) {
    throw new Error('Không thể tải dữ liệu sinh viên từ IFAA. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.');
  }
  return [];
}

window.ensureFacultyDatasetLoaded = async function(force = false) {
  return await loadFacultyDatasetFromIFAA({ force });
};

window.syncFacultyDatasetFromIFAA = async function() {
  try {
    if (state.realIsAdmin) await connectIFAAForAdmin();
    showToast('🔄 Đang làm mới danh mục sinh viên từ IFA+ Activities...', 'info');
    updateFacultyStatusUI('Đang làm mới từ IFAA...', 'info');
    state.lastFacultyLoadWasFallback = false;
    const rows = await loadFacultyDatasetFromIFAA({ force: true });
    if (!rows || rows.length === 0) {
      showToast('⚠️ Không tìm thấy sinh viên nào từ IFAA.', 'warning');
      updateFacultyStatusUI('Dữ liệu IFAA trống', 'warning');
      return;
    }
    applyFacultyFiltersAndRender(1);
    const totalCountEl = document.getElementById('faculty-students-total-count');
    if (totalCountEl) totalCountEl.textContent = rows.length.toLocaleString('vi-VN');

    if (!state.lastFacultyLoadWasFallback) {
      showToast(`✓ Đã tải ${rows.length.toLocaleString('vi-VN')} sinh viên mới nhất từ IFAA.`, 'success', 5000);
    }
  } catch (err) {
    showToast('Lỗi đồng bộ dữ liệu: ' + err.message, 'error', 5000);
  }
};

window.openFacultyStudentsTab = async function() {
  const totalCountEl = document.getElementById('faculty-students-total-count');
  const filteredCountEl = document.getElementById('faculty-students-filtered-count');
  const metaInfoEl = document.getElementById('faculty-dataset-meta-info');

  if (state.facultyStudentsLoaded && state.facultyStudents && state.facultyStudents.length > 0) {
    if (totalCountEl) totalCountEl.textContent = state.facultyStudents.length.toLocaleString('vi-VN');
    updateFacultyStatusUI(`Dữ liệu IFAA: ${state.facultyStudents.length} SV (sẵn sàng)`, 'success');
    return;
  }

  updateFacultyStatusUI('Đang kiểm tra dữ liệu từ IFA+ Activities...', 'info');

  try {
    const rows = await ensureFacultyDatasetLoaded(false);
    if (rows && rows.length > 0) {
      if (totalCountEl) totalCountEl.textContent = rows.length.toLocaleString('vi-VN');
      if (filteredCountEl) filteredCountEl.textContent = '0';
      if (metaInfoEl) {
        metaInfoEl.textContent = `· Nguồn: IFAA · ${rows.length} SV`;
      }
      applyFacultyFiltersAndRender(1);
    } else {
      if (totalCountEl) totalCountEl.textContent = '0';
      updateFacultyStatusUI('Chưa có dữ liệu sinh viên từ IFAA', 'warning');
    }
  } catch (err) {
    console.error('Lỗi nạp danh sách SV khoa:', err);
    updateFacultyStatusUI('Lỗi tải dữ liệu: ' + err.message, 'error');
  }
};

function populateFacultyClassFilter(rows) {
  const classSelect = document.getElementById('faculty-class-filter');
  if (!classSelect || !Array.isArray(rows)) return;
  const curVal = classSelect.value;
  const classes = [...new Set(rows.map(s => s.className || s.studentClass).filter(Boolean))].sort();
  classSelect.innerHTML = '<option value="">-- Tất cả lớp --</option>' +
    classes.map(c => `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`).join('');
}

window.loadAndRenderFacultyStudents = async function() {
  const tbody = document.getElementById('faculty-students-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500">⏳ Đang tải danh sách sinh viên từ IFAA...</td></tr>';
  }

  try {
    await ensureFacultyDatasetLoaded();
    applyFacultyFiltersAndRender(1);
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-rose-500">Lỗi: ${err.message}</td></tr>`;
    }
  }
};

function applyFacultyFiltersAndRender(targetPage = 1) {
  const search = (document.getElementById('faculty-search-input')?.value || '').trim().toLowerCase();
  const genderFilter = document.getElementById('faculty-gender-filter')?.value || '';
  const majorFilter = document.getElementById('faculty-major-filter')?.value || '';
  const classFilter = document.getElementById('faculty-class-filter')?.value || '';

  let list = state.facultyStudents || [];

  if (search) {
    list = list.filter(s =>
      (s.mssv && s.mssv.toLowerCase().includes(search)) ||
      (s.fullName && s.fullName.toLowerCase().includes(search)) ||
      (s.name && s.name.toLowerCase().includes(search)) ||
      (s.email && s.email.toLowerCase().includes(search)) ||
      (s.phone && s.phone.includes(search))
    );
  }

  if (genderFilter) {
    list = list.filter(s => (s.gender || '').toLowerCase() === genderFilter.toLowerCase());
  }

  if (majorFilter) {
    list = list.filter(s => (s.major || '').toLowerCase() === majorFilter.toLowerCase());
  }

  if (classFilter) {
    list = list.filter(s => (s.className || s.studentClass || '') === classFilter);
  }

  state.facultyFilteredStudents = list;
  state.facultyCurrentPage = targetPage;

  renderFacultyStudentsCurrentPage();
}

function renderFacultyStudentsCurrentPage() {
  const tbody = document.getElementById('faculty-students-tbody');
  if (!tbody) return;

  const totalEl = document.getElementById('faculty-students-total-count');
  const filtEl = document.getElementById('faculty-students-filtered-count');
  const pageInfo = document.getElementById('faculty-page-info');
  const prevBtn = document.getElementById('faculty-btn-prev');
  const nextBtn = document.getElementById('faculty-btn-next');

  const total = (state.facultyStudents || []).length;
  const filtered = state.facultyFilteredStudents || [];
  const pageSize = state.facultyPageSize || 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  let page = state.facultyCurrentPage || 1;
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  state.facultyCurrentPage = page;

  if (totalEl) totalEl.textContent = total.toLocaleString('vi-VN');
  if (filtEl) filtEl.textContent = filtered.length.toLocaleString('vi-VN');
  if (pageInfo) pageInfo.textContent = `Trang ${page} / ${totalPages} (${filtered.length} kết quả)`;
  if (prevBtn) prevBtn.disabled = (page <= 1);
  if (nextBtn) nextBtn.disabled = (page >= totalPages);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">Không tìm thấy sinh viên nào phù hợp với bộ lọc.</td></tr>';
    return;
  }

  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pageRows = filtered.slice(startIdx, endIdx);

  tbody.innerHTML = pageRows.map(s => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-3 font-mono font-bold text-slate-900">${s.mssv}</td>
      <td class="p-3 font-bold text-slate-800">${s.fullName || s.name || '--'}</td>
      <td class="p-3 text-slate-600">${s.gender || '--'}</td>
      <td class="p-3 text-slate-700 font-medium">${s.major || '--'}</td>
      <td class="p-3 font-mono text-slate-600">${s.className || s.studentClass || '--'}</td>
      <td class="p-3 text-slate-500 font-mono text-[11px]">${s.email || '--'}</td>
      <td class="p-3 text-slate-500 font-mono text-[11px]">${s.course || s.admissionYear || s.phone || '--'}</td>
      <td class="p-3 text-right">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          IFAA Master
        </span>
      </td>
    </tr>
  `).join('');
}

window.changeFacultyPageSize = function(size) {
  state.facultyPageSize = parseInt(size, 10) || 15;
  applyFacultyFiltersAndRender(1);
};

window.prevFacultyStudentPage = function() {
  if (state.facultyCurrentPage > 1) {
    state.facultyCurrentPage--;
    renderFacultyStudentsCurrentPage();
  }
};

window.nextFacultyStudentPage = function() {
  const pageSize = state.facultyPageSize || 15;
  const totalPages = Math.ceil((state.facultyFilteredStudents || []).length / pageSize);
  if (state.facultyCurrentPage < totalPages) {
    state.facultyCurrentPage++;
    renderFacultyStudentsCurrentPage();
  }
};

window.resetFacultyStudentFilters = function() {
  const sInput = document.getElementById('faculty-search-input');
  const gSelect = document.getElementById('faculty-gender-filter');
  const mSelect = document.getElementById('faculty-major-filter');
  const cSelect = document.getElementById('faculty-class-filter');
  if (sInput) sInput.value = '';
  if (gSelect) gSelect.value = '';
  if (mSelect) mSelect.value = '';
  if (cSelect) cSelect.value = '';

  if (state.facultyStudentsLoaded) {
    applyFacultyFiltersAndRender(1);
  }
};

// ============================================================================
// STRICT READ-ONLY LOCKDOWN: LEGACY MUTATION FUNCTIONS INTERCEPTED
// Zero writes to IFAA. Zero writes to Graduation facultyStudents.
// ============================================================================

window.saveSingleFacultyStudent = async function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  showToast('⚠️ Chế độ Read-Only: Dữ liệu sinh viên toàn khoa được quản lý tập trung tại IFA+ Activities. Vui lòng thêm/sửa tại hệ thống IFAA.', 'warning');
  return false;
};

window.editFacultyStudentInline = function(mssv) {
  showToast(`ℹ️ Chế độ Read-Only: Hồ sơ sinh viên ${mssv} được quản lý tại IFA+ Activities (ifa-activities).`, 'info');
  return false;
};

window.deleteFacultyStudent = async function(mssv) {
  showToast('⚠️ Chế độ Read-Only: Danh sách sinh viên được đồng bộ từ IFA+ Activities. Không thể xóa sinh viên tại Graduation.', 'warning');
  return false;
};

window.clearAllFacultyStudents = async function() {
  showToast('⚠️ Chế độ Read-Only: Danh mục sinh viên được quản lý tại IFA+ Activities. Thao tác xóa bị vô hiệu hóa.', 'warning');
  return false;
};

window.handleFacultyStudentsUpload = async function(event) {
  if (event?.target) event.target.value = '';
  showToast('⚠️ Chế độ Read-Only: Vui lòng tải lên danh sách sinh viên toàn khoa tại trang Quản trị IFA+ Activities để cập nhật master dataset.', 'warning');
  return false;
};

window.rebuildFacultyDataset = async function() {
  return await window.syncFacultyDatasetFromIFAA();
};

window.downloadFacultyStudentsTemplate = function() {
  showToast('ℹ️ Quản lý danh mục sinh viên toàn khoa được thực hiện tại IFA+ Activities.', 'info');
  return false;
};

// Export to Excel (Read-Only Utility)
window.exportFacultyStudentsExcel = async function() {
  try {
    let rows = state.facultyStudents;
    if (!state.facultyStudentsLoaded || !rows || rows.length === 0) {
      showToast('Đang tải dữ liệu từ IFAA để xuất Excel...', 'info');
      rows = await ensureFacultyDatasetLoaded();
    }

    if (!rows || rows.length === 0) {
      showToast('Không có dữ liệu sinh viên để xuất.', 'warning');
      return;
    }

    const exportRows = rows.map((s, idx) => ({
      'STT': idx + 1,
      'MSSV': s.mssv,
      'Họ và tên': s.fullName || s.name || '',
      'Giới tính': s.gender || '',
      'Ngành': s.major || '',
      'Lớp': s.className || s.studentClass || '',
      'Email': s.email || '',
      'Khóa / Tuyển sinh': s.course || s.admissionYear || '',
      'Số điện thoại': s.phone || '',
      'Nguồn dữ liệu': 'IFAA Master'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachSVKhoa_IFAA');
    XLSX.writeFile(wb, `DANH_SACH_SINH_VIEN_IFAA_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`✓ Đã xuất Excel ${exportRows.length} sinh viên từ IFAA Master!`, 'success');
  } catch (err) {
    showToast('Lỗi xuất Excel: ' + err.message, 'error');
  }
};




// ============================================================================

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getIFAAFirebase !== 'undefined') window.getIFAAFirebase = getIFAAFirebase;
  if (typeof openFacultyCache !== 'undefined') window.openFacultyCache = openFacultyCache;
  if (typeof getFacultyCache !== 'undefined') window.getFacultyCache = getFacultyCache;
  if (typeof setFacultyCache !== 'undefined') window.setFacultyCache = setFacultyCache;
  if (typeof gunzipData !== 'undefined') window.gunzipData = gunzipData;
  if (typeof updateFacultyStatusUI !== 'undefined') window.updateFacultyStatusUI = updateFacultyStatusUI;
  if (typeof normalizeFacultyStudent !== 'undefined') window.normalizeFacultyStudent = normalizeFacultyStudent;
  if (typeof normalizeFacultyRows !== 'undefined') window.normalizeFacultyRows = normalizeFacultyRows;
  if (typeof loadFacultyDatasetFromIFAA !== 'undefined') window.loadFacultyDatasetFromIFAA = loadFacultyDatasetFromIFAA;
  if (typeof populateFacultyClassFilter !== 'undefined') window.populateFacultyClassFilter = populateFacultyClassFilter;
  if (typeof applyFacultyFiltersAndRender !== 'undefined') window.applyFacultyFiltersAndRender = applyFacultyFiltersAndRender;
  if (typeof renderFacultyStudentsCurrentPage !== 'undefined') window.renderFacultyStudentsCurrentPage = renderFacultyStudentsCurrentPage;
}
