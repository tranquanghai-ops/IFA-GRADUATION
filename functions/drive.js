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
//   graduation-drive-folder-id     (target Drive folder)

let _cachedConfig = null;
let _configLoadTime = 0;
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Loads Drive OAuth config from Secret Manager (cached).
 * @returns {{ clientId, clientSecret, refreshToken, folderId }|null}
 */
async function loadDriveConfig() {
  const now = Date.now();
  if (_cachedConfig && (now - _configLoadTime) < CONFIG_CACHE_TTL_MS) {
    return _cachedConfig;
  }

  const [clientId, clientSecret, refreshToken, folderId] = await Promise.all([
    getSecret('graduation-drive-client-id'),
    getSecret('graduation-drive-client-secret'),
    getSecret('graduation-drive-owner-token'),
    getSecret('graduation-drive-folder-id'),
  ]);

  if (!clientId || !clientSecret || !refreshToken) {
    _cachedConfig = null;
    _configLoadTime = now;
    return null;
  }

  _cachedConfig = { clientId, clientSecret, refreshToken, folderId };
  _configLoadTime = now;
  return _cachedConfig;
}

/**
 * Returns whether Drive is configured (all secrets present).
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
  }, body, false);

  if (!result || !result.access_token) {
    throw new Error('Failed to refresh Drive access token');
  }

  return result.access_token;
}

/**
 * Creates a resumable upload session for a file in the designated Drive folder.
 * @param {{ filename: string, mimeType: string, studentId: string, activityId: string }} meta
 * @returns {string} resumable session URI (safe to return to frontend)
 */
async function createUploadSession(meta) {
  const config = await loadDriveConfig();
  if (!config) throw new Error('Drive not configured');

  const accessToken = await getAccessToken(config);

  // Sanitize filename to prevent path traversal
  const safeFilename = meta.filename.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
  const timestampedName = meta.studentId + '_' + meta.activityId + '_' + safeFilename;

  const fileMetadata = {
    name: timestampedName,
    ...(config.folderId ? { parents: [config.folderId] } : {}),
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

module.exports = { isDriveConfigured, createUploadSession };
