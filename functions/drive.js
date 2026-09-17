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
 * @param {{ filename: string, mimeType: string, studentId: string, activityId: string, folderId: string }} meta
 * @returns {string} resumable session URI (safe to return to frontend)
 */
async function createUploadSession(meta) {
  const config = await loadDriveConfig();
  if (!config) throw new Error('Drive not configured');
  
  if (!meta.folderId) throw new Error('Missing target folderId');

  const accessToken = await getAccessToken(config);

  // Sanitize filename to prevent path traversal
  const safeFilename = meta.filename.replace(/[\/\\?%*:|"<>]/g, '_');

  const fileMetadata = {
    name: safeFilename,
    parents: [meta.folderId],
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
        'Origin': meta.origin || 'https://tknt-tdtu.web.app',
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

/**
 * Deletes a file from Google Drive by its file ID.
 * @param {string} fileId
 * @returns {Promise<boolean>}
 */
async function deleteDriveFile(fileId) {
  if (!fileId) return false;
  const config = await loadDriveConfig();
  if (!config) throw new Error('Drive not configured');
  const accessToken = await getAccessToken(config);

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 204 || res.status === 200 || res.status === 404) {
    return true;
  }
  const errData = await res.json().catch(() => ({}));
  console.error('[deleteDriveFile] Failed:', res.status, errData);
  return false;
}

module.exports = { isDriveConfigured, createUploadSession, getAccessToken, loadDriveConfig, runDriveDiagnostic, deleteDriveFile };
