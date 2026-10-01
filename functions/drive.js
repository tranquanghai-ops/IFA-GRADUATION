/**
 * drive.js — Google Drive OAuth + resumable upload session creator
 *
 * Uses the owner's refresh token (stored in Secret Manager) to obtain
 * a short-lived access token, then creates a resumable upload session
 * and returns ONLY the session URI (never the token itself).
 *
 * Scope: drive.file (minimal — only files created by this app)
 */

'use strict';

const https = require('https');
const { getSecret } = require('./secrets.js');
const { MAX_BYTES, assertOwned } = require('./policy.js');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';

// OAuth2 client credentials (read from Secret Manager at runtime)
// Secret names in ifa-activities project:
//   graduation-drive-client-id
//   graduation-drive-client-secret
//   graduation-drive-owner-token   (refresh token)

let _cachedConfig = null;
let _configLoadTime = 0;
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Loads Drive OAuth config from Secret Manager (cached).
 * @returns {{ clientId, clientSecret, refreshToken }|null}
 */
async function loadDriveConfig() {
  const now = Date.now();
  if (_cachedConfig && (now - _configLoadTime) < CONFIG_CACHE_TTL_MS) {
    return _cachedConfig;
  }

  const [s1, s2, s3] = await Promise.all([
    getSecret('graduation-drive-client-id'),
    getSecret('graduation-drive-client-secret'),
    getSecret('graduation-drive-owner-token'),
  ]);

  if (!s1 || !s2 || !s3) {
    _cachedConfig = null;
    _configLoadTime = now;
    return null;
  }

  // Auto-detect swapped secrets:
  // - Client ID ends with .apps.googleusercontent.com
  // - Refresh token starts with 1//
  // - Client Secret starts with GOCSPX- or is the remaining string
  const values = [s1, s2, s3];
  let clientId = values.find(v => v.includes('.apps.googleusercontent.com'));
  let refreshToken = values.find(v => v.startsWith('1//'));
  let clientSecret = values.find(v => v.startsWith('GOCSPX-')) || values.find(v => v !== clientId && v !== refreshToken);

  if (!clientId) clientId = s1;
  if (!clientSecret) clientSecret = s2;
  if (!refreshToken) refreshToken = s3;

  _cachedConfig = { clientId, clientSecret, refreshToken };
  _configLoadTime = now;
  return _cachedConfig;
}

/**
 * Returns whether Drive is configured (OAuth secrets present).
 */
async function isDriveConfigured() {
  const config = await loadDriveConfig();
  return config !== null;
}

/**
 * Exchanges refresh token for a short-lived access token.
 */
async function getAccessToken(config) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  }).toString();

  const result = await httpsPost(TOKEN_ENDPOINT, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  }, body, true);

  if (!result || !result.access_token) {
    console.error('[getAccessToken] OAuth failure response:', JSON.stringify(result));
    const detail = result ? (result.error_description || result.error || JSON.stringify(result)) : 'Empty response';
    throw new Error('Failed to refresh Drive access token: ' + detail);
  }

  return result.access_token;
}

/**
 * Creates a resumable upload session for a file in the designated Drive folder.
 * @param {{ filename: string, mimeType: string, studentId: string, activityId: string, roundId?: string, folderId: string, fileSize?: number, uploadedBy?: string, uploadId?: string, origin?: string }} meta
 * @returns {string} resumable session URI (safe to return to frontend)
 */
async function createUploadSession(meta) {
  const config = await loadDriveConfig();
  if (!config) throw new Error('Drive not configured');
  
  if (!meta.folderId) throw new Error('Missing target folderId');

  const accessToken = await getAccessToken(config);

  // Sanitize filename to prevent path traversal
  const safeFilename = meta.filename.replace(/[\/\\?%*:|"<>]/g, '_');

  const appProperties = {
    app: 'ifa-graduation',
    studentId: meta.studentId || '',
    activityId: meta.activityId || '',
    ...(meta.roundId ? { roundId: meta.roundId } : {}),
    ...(meta.uploadedBy ? { uploadedBy: meta.uploadedBy } : { uploadedBy: meta.studentId || '' }),
    expectedSize: String(meta.fileSize || 0),
    expectedMime: meta.mimeType || 'application/octet-stream',
    ...(meta.uploadId ? { uploadId: meta.uploadId } : {}),
  };

  const fileMetadata = {
    name: safeFilename,
    parents: [meta.folderId],
    appProperties,
    properties: {
      studentId: meta.studentId,
      activityId: meta.activityId,
      uploadedVia: 'ifa-graduation-api',
    },
  };

  const metaStr = JSON.stringify(fileMetadata);
  const urlObj = new URL(DRIVE_UPLOAD_ENDPOINT);

  const sessionUri = await new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(metaStr),
        'X-Upload-Content-Type': meta.mimeType || 'application/octet-stream',
        ...(meta.fileSize ? { 'X-Upload-Content-Length': meta.fileSize } : {}),
        'Origin': meta.origin || 'https://ifa-graduation.web.app',
      },
    };

    const req = https.request(options, res => {
      if (res.statusCode !== 200) {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => reject(new Error('Drive session creation failed: HTTP ' + res.statusCode + ' ' + body)));
        return;
      }
      const location = res.headers['location'];
      if (!location) {
        reject(new Error('Drive session URI missing from response headers'));
      } else {
        resolve(location);
      }
      // Drain body
      res.resume();
    });

    req.on('error', reject);
    req.write(metaStr);
    req.end();
  });

  return sessionUri;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function httpsPost(url, headers, body, parseJson = true) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers,
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (parseJson) {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Diagnostic helper ─────────────────────────────────────────────────────────

async function runDriveDiagnostic(folderId) {
  const config = await loadDriveConfig();
  if (!config) return { error: 'Drive not configured' };

  let accessToken;
  try {
    accessToken = await getAccessToken(config);
  } catch (err) {
    return {
      CURRENT_SCOPE: DRIVE_SCOPE,
      OAUTH_REFRESH: 'FAIL: ' + err.message,
    };
  }

  // If no folderId supplied, try reading secret
  if (!folderId) {
    folderId = await getSecret('graduation-drive-folder-id');
  }

  const report = {
    CURRENT_SCOPE: DRIVE_SCOPE,
    OAUTH_REFRESH: 'PASS',
    folderId: folderId || 'NOT_CONFIGURED',
    FOLDER_GET: null,
    ROOT_CREATE: null,
    FOLDER_CREATE: null,
    EXACT_GOOGLE_ERROR: null,
    LIKELY_ROOT_CAUSE: null,
  };

  // 1. files.get on folderId
  if (folderId) {
    try {
      const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,capabilities`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const getData = await getRes.json();
      report.FOLDER_GET = { status: getRes.status, data: getData };
      if (!getRes.ok) {
        report.EXACT_GOOGLE_ERROR = getData?.error?.message || JSON.stringify(getData);
      }
    } catch (e) {
      report.FOLDER_GET = { error: e.message };
    }
  }

  // 2. files.create with parent [folderId]
  if (folderId) {
    try {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'graduation-auth-test.txt',
          parents: [folderId],
        }),
      });
      const createData = await createRes.json();
      report.FOLDER_CREATE = { status: createRes.status, data: createData };
      if (!createRes.ok) {
        report.EXACT_GOOGLE_ERROR = createData?.error?.message || JSON.stringify(createData);
      } else if (createData.id) {
        // delete test file
        await fetch(`https://www.googleapis.com/drive/v3/files/${createData.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => {});
      }
    } catch (e) {
      report.FOLDER_CREATE = { error: e.message };
    }
  }

  // 3. files.create WITHOUT parent (in My Drive root)
  try {
    const rootRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'graduation-auth-test-root.txt',
      }),
    });
    const rootData = await rootRes.json();
    report.ROOT_CREATE = { status: rootRes.status, data: rootData };
    if (rootRes.ok && rootData.id) {
      // delete test file
      await fetch(`https://www.googleapis.com/drive/v3/files/${rootData.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => {});
    }
  } catch (e) {
    report.ROOT_CREATE = { error: e.message };
  }

  // Interpretation
  const rootOk = report.ROOT_CREATE?.status === 200;
  const folderOk = report.FOLDER_CREATE?.status === 200;
  const folderGetOk = report.FOLDER_GET?.status === 200;

  if (rootOk && !folderOk) {
    report.LIKELY_ROOT_CAUSE = 'Root create succeeds + folder create fails => drive.file folder authorization issue (drive.file scope cannot access folder created outside the app without explicit grant).';
  } else if (!rootOk && !folderOk) {
    report.LIKELY_ROOT_CAUSE = 'Both fail => Token, scope, or Drive API enablement issue.';
  } else if (rootOk && folderOk) {
    report.LIKELY_ROOT_CAUSE = 'Both succeed => Drive credentials and folder authorization are fully functional. Any upload error is in resumable upload logic or file validation.';
  }

  return report;
}

let _testDriveDriver = null;

function setTestDriveDriver(driver) {
  _testDriveDriver = driver;
}

/**
 * Fetches Google Drive file metadata with security properties.
 * @param {string} fileId
 * @returns {Promise<object|null>}
 */
async function getDriveFileMetadata(fileId) {
  if (_testDriveDriver && typeof _testDriveDriver.getDriveFileMetadata === 'function') {
    return _testDriveDriver.getDriveFileMetadata(fileId);
  }
  if (!fileId || typeof fileId !== 'string' || !/^[\w-]{10,200}$/.test(fileId)) {
    throw new Error('INVALID_FILE_ID');
  }
  const config = await loadDriveConfig();
  if (!config) throw new Error('Drive not configured');
  const accessToken = await getAccessToken(config);

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,size,trashed,appProperties,webViewLink,parents,createdTime`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    if (res.status === 404) return null;
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Drive metadata fetch failed: HTTP ${res.status} ${errData?.error?.message || ''}`);
  }
  return await res.json();
}

/**
 * Safely moves a file to Google Drive Trash (non-permanent deletion).
 * @param {string} fileId
 * @returns {Promise<boolean>}
 */
async function trashDriveFile(fileId) {
  if (_testDriveDriver && typeof _testDriveDriver.trashDriveFile === 'function') {
    return _testDriveDriver.trashDriveFile(fileId);
  }
  if (!fileId) return false;
  const config = await loadDriveConfig();
  if (!config) throw new Error('Drive not configured');
  const accessToken = await getAccessToken(config);

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });

  if (res.status === 200 || res.status === 204 || res.status === 404) {
    return true;
  }
  const errData = await res.json().catch(() => ({}));
  console.error('[trashDriveFile] Failed:', res.status, errData);
  return false;
}

/**
 * Verifies that a completed upload satisfies ownership, size, MIME type, folder policy, and full context.
 * FAIL-CLOSED: Rejects if any context parameter is missing or mismatched.
 * SECURITY: Never automatically trashes files on verification failure to prevent malicious self-deletion exploits.
 * @param {{ fileId: string, studentId: string, activityId: string, roundId: string, uploadId: string, targetFolderId: string, effectiveBusinessLimit: number }} params
 * @returns {Promise<object>} verified metadata
 */
async function verifyAndCompleteUpload({
  fileId,
  studentId,
  activityId,
  roundId,
  uploadId,
  targetFolderId,
  effectiveBusinessLimit,
}) {
  if (!fileId || typeof fileId !== 'string') {
    throw new Error('MISSING_FILE_ID');
  }
  if (!studentId || typeof studentId !== 'string') {
    throw new Error('MISSING_STUDENT_ID');
  }
  if (!activityId || typeof activityId !== 'string') {
    throw new Error('MISSING_ACTIVITY_ID');
  }
  if (!roundId || typeof roundId !== 'string') {
    throw new Error('MISSING_ROUND_ID');
  }
  if (!uploadId || typeof uploadId !== 'string') {
    throw new Error('MISSING_UPLOAD_ID');
  }
  if (!targetFolderId || typeof targetFolderId !== 'string') {
    throw new Error('MISSING_TARGET_FOLDER_ID');
  }
  if (!effectiveBusinessLimit || typeof effectiveBusinessLimit !== 'number' || effectiveBusinessLimit <= 0) {
    throw new Error('MISSING_OR_INVALID_BUSINESS_LIMIT');
  }

  const meta = await getDriveFileMetadata(fileId);
  if (!meta) {
    throw new Error('FILE_NOT_FOUND');
  }

  // Assert ownership: must belong to ifa-graduation and match studentId
  const p = assertOwned(meta, studentId, true, false);

  // Strict context matching
  if (p.roundId !== roundId || p.activityId !== activityId || p.uploadId !== uploadId) {
    throw new Error('CONTEXT_MISMATCH');
  }

  const fileSize = Number(meta.size);
  const expectedSize = Number(p.expectedSize);

  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize !== expectedSize) {
    throw new Error('FILE_SIZE_MISMATCH');
  }

  if (fileSize > MAX_BYTES || fileSize > effectiveBusinessLimit) {
    throw new Error('FILE_SIZE_EXCEEDS_LIMIT');
  }

  if (meta.mimeType !== p.expectedMime) {
    throw new Error('FILE_MIME_MISMATCH');
  }

  if (!Array.isArray(meta.parents) || !meta.parents.includes(targetFolderId)) {
    throw new Error('INVALID_PARENT_FOLDER');
  }

  return {
    fileId: meta.id,
    fileName: meta.name,
    mimeType: meta.mimeType,
    size: fileSize,
    viewUrl: meta.webViewLink || `https://drive.google.com/file/d/${meta.id}/view`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${meta.id}`,
    studentId: p.studentId,
    activityId: p.activityId,
    roundId: p.roundId,
    uploadedBy: p.uploadedBy,
    uploadId: p.uploadId,
    targetFolderId,
    createdTime: meta.createdTime || new Date().toISOString(),
  };
}

/**
 * Deletes a file by sending it to Google Drive Trash.
 * Backward-compatible wrapper for trashDriveFile.
 * @param {string} fileId
 * @returns {Promise<boolean>}
 */
async function deleteDriveFile(fileId) {
  return await trashDriveFile(fileId);
}

/**
 * Helper to check if string points to a Google Doc, Sheet, Slide, or single Drive file.
 * @param {string} str
 * @returns {boolean}
 */
function isGoogleDriveDocOrFileUrl(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (/docs\.google\.com\/(document|spreadsheets|presentation)/i.test(s)) return true;
  if (/\/file\/d\//i.test(s)) return true;
  return false;
}

/**
 * Extracts a Google Drive Folder ID from a URL or raw ID string.
 * Strictly returns null if URL points to a document or single file.
 * @param {string} str
 * @returns {string|null}
 */
function extractDriveFolderId(str) {
  if (!str || typeof str !== 'string') return null;
  if (isGoogleDriveDocOrFileUrl(str)) return null;
  const match = str.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

/**
 * Validates that a Google Drive root folder exists, is not trashed,
 * is indeed a folder, and the service account has permission to create subfolders.
 * Uses non-destructive metadata check first, then falls back to a safe write probe
 * if metadata is restricted under drive.file scope.
 * @param {string} folderIdOrUrl
 * @returns {Promise<{ ok: boolean, folderId: string, folderName: string, folderUrl: string, canAddChildren: boolean, checkMethod: string }>}
 */
async function validateRootDriveFolder(folderIdOrUrl) {
  if (!folderIdOrUrl || typeof folderIdOrUrl !== 'string' || !folderIdOrUrl.trim()) {
    throw new Error('Đường dẫn hoặc Folder ID Google Drive không được để trống.');
  }
  const trimmed = folderIdOrUrl.trim();

  // Strict check: reject Docs, Sheets, Slides, or individual Drive files
  if (/docs\.google\.com\/(document|spreadsheets|presentation)/i.test(trimmed)) {
    throw new Error('Đường dẫn trỏ đến tệp Google Docs/Sheets/Slides, không phải là thư mục Google Drive.');
  }
  if (/\/file\/d\//i.test(trimmed)) {
    throw new Error('Đường dẫn trỏ đến một tệp Google Drive, không phải là thư mục Google Drive.');
  }

  const folderId = extractDriveFolderId(trimmed);
  if (!folderId) {
    throw new Error('Đường dẫn hoặc Folder ID Google Drive không hợp lệ (cần ít nhất 25 ký tự).');
  }

  if (_testDriveDriver && typeof _testDriveDriver.validateRootDriveFolder === 'function') {
    return _testDriveDriver.validateRootDriveFolder(trimmed, folderId);
  }

  const config = await loadDriveConfig();
  if (!config) {
    throw new Error('Hệ thống chưa cấu hình kết nối Google Drive (thiếu Secrets).');
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(config);
  } catch (err) {
    throw new Error('Không thể xác thực Google Drive. Vui lòng kiểm tra kết nối hệ thống.');
  }

  // 1. Non-destructive metadata check with supportsAllDrives=true
  let metaData = null;
  let metaOk = false;
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,name,mimeType,capabilities,trashed,webViewLink`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (res.ok) {
      metaData = await res.json().catch(() => ({}));
      metaOk = true;
    }
  } catch (e) {
    console.warn('[validateRootDriveFolder] metadata fetch warning:', e.message);
  }

  if (metaOk && metaData) {
    if (metaData.trashed) {
      throw new Error('Thư mục này hiện đang nằm trong Thùng rác của Google Drive.');
    }
    if (metaData.mimeType && metaData.mimeType !== 'application/vnd.google-apps.folder') {
      throw new Error('Đối tượng được liên kết không phải là một Thư mục Google Drive.');
    }

    const canAddChildren = metaData.capabilities?.canAddChildren || metaData.capabilities?.canEdit;
    if (canAddChildren) {
      return {
        ok: true,
        folderId: metaData.id,
        folderName: metaData.name || 'Google Drive Folder',
        folderUrl: metaData.webViewLink || `https://drive.google.com/drive/folders/${metaData.id}`,
        canAddChildren: true,
        checkMethod: 'metadata',
      };
    }
  }

  // 2. Fallback Safe Write Probe
  // When files.get returns 404 under drive.file scope on external shared folders,
  // or capabilities are incomplete, test actual child creation capability.
  const probeName = `.probe_test_ifa_${Date.now()}`;
  let probeRes;
  try {
    probeRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: probeName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId],
        properties: { probe: 'true' },
      }),
    });
  } catch (netErr) {
    throw new Error('Không thể kết nối đến Google Drive: ' + netErr.message);
  }

  const probeData = await probeRes.json().catch(() => ({}));

  if (!probeRes.ok) {
    if (probeRes.status === 404) {
      throw new Error('Không tìm thấy thư mục hoặc tài khoản hệ thống chưa được cấp quyền.');
    }
    if (probeRes.status === 403) {
      throw new Error('Tài khoản hệ thống có thể nhìn thấy thư mục nhưng không có quyền tạo thư mục con.');
    }
    const errMsg = probeData?.error?.message || `HTTP ${probeRes.status}`;
    throw new Error(`Google Drive phản hồi lỗi: ${errMsg}`);
  }

  // Probe succeeded -> immediately delete temporary probe folder
  if (probeData?.id) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${probeData.id}?supportsAllDrives=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(delErr => console.warn('[validateRootDriveFolder] Probe cleanup warning:', delErr.message));
  }

  return {
    ok: true,
    folderId: folderId,
    folderName: metaData?.name || 'Google Drive Folder',
    folderUrl: metaData?.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
    canAddChildren: true,
    checkMethod: 'write_probe',
  };
}

/**
 * Searches for an existing child folder by exact name inside parentFolderId.
 * If found, reuses it. If not found, creates a new child folder.
 * @param {{ parentFolderId: string, folderName: string, folderType?: string }} param0
 * @returns {Promise<{ ok: boolean, folderId: string, folderName: string, folderUrl: string, reused: boolean, warning?: string }>}
 */
async function getOrCreateDriveChildFolder({ parentFolderId, folderName, folderType }) {
  const cleanParentId = extractDriveFolderId(parentFolderId);
  if (!cleanParentId) {
    throw new Error('Thiếu hoặc không hợp lệ parentFolderId (Thư mục gốc)');
  }

  if (!folderName || typeof folderName !== 'string' || !folderName.trim()) {
    throw new Error('Tên thư mục con không được để trống');
  }

  // Sanitize folder name
  const safeName = folderName.trim().replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ');
  if (!safeName) {
    throw new Error('Tên thư mục con không hợp lệ');
  }

  if (_testDriveDriver && typeof _testDriveDriver.getOrCreateDriveChildFolder === 'function') {
    return _testDriveDriver.getOrCreateDriveChildFolder({ parentFolderId: cleanParentId, folderName: safeName, folderType });
  }

  const config = await loadDriveConfig();
  if (!config) throw new Error('Hệ thống chưa cấu hình kết nối Google Drive (thiếu Secrets).');

  const accessToken = await getAccessToken(config);

  // 1. Search for existing child folder with exact name (including Shared Drives)
  const escapedName = safeName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${cleanParentId}' in parents and name = '${escapedName}'`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,webViewLink)&pageSize=10`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const searchData = await searchRes.json().catch(() => ({}));

  if (!searchRes.ok) {
    const errMsg = searchData?.error?.message || `Lỗi tìm kiếm Drive API (HTTP ${searchRes.status})`;
    throw new Error(`Google Drive phản hồi lỗi: ${errMsg}`);
  }

  const files = searchData.files || [];
  if (files.length > 0) {
    const existing = files[0];
    return {
      ok: true,
      folderId: existing.id,
      folderName: existing.name,
      folderUrl: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
      reused: true,
      warning: files.length > 1 ? `Tìm thấy ${files.length} thư mục cùng tên "${safeName}". Đã liên kết với thư mục đầu tiên.` : null,
    };
  }

  // 2. Not found -> create new folder inside parentFolderId (supports Shared Drives)
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [cleanParentId],
      properties: {
        createdVia: 'ifa-graduation-api',
        folderType: folderType || 'subfolder',
      },
    }),
  });

  const createData = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    const errMsg = createData?.error?.message || `Lỗi tạo thư mục (HTTP ${createRes.status})`;
    throw new Error(`Không thể tạo thư mục trên Google Drive: ${errMsg}`);
  }

  return {
    ok: true,
    folderId: createData.id,
    folderName: createData.name,
    folderUrl: createData.webViewLink || `https://drive.google.com/drive/folders/${createData.id}`,
    reused: false,
  };
}

module.exports = {
  isDriveConfigured,
  createUploadSession,
  getAccessToken,
  loadDriveConfig,
  runDriveDiagnostic,
  deleteDriveFile,
  trashDriveFile,
  getDriveFileMetadata,
  verifyAndCompleteUpload,
  extractDriveFolderId,
  isGoogleDriveDocOrFileUrl,
  validateRootDriveFolder,
  getOrCreateDriveChildFolder,
  setTestDriveDriver,
  _setTestDriveDriver: setTestDriveDriver,
};
