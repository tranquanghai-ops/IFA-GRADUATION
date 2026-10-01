/**
 * firestore.js — Cross-project Firestore REST access for ifa-graduation
 *
 * Business-data reads use the verified user's ID token. Integrity metadata
 * in driveFiles uses the Cloud Function's service account token.
 */

'use strict';

const https = require('https');
const { GoogleAuth } = require('google-auth-library');

const FIRESTORE_PROJECT = 'ifa-graduation';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/' + FIRESTORE_PROJECT + '/databases/(default)/documents';

/**
 * Cross-Project IAM Requirement:
 * The deployed graduationApi in ifa-activities currently runs as
 * 633545868576-compute@developer.gserviceaccount.com (read-only audit 2026-10-01).
 * Target Firestore is located in project "ifa-graduation".
 * To read/write driveFiles metadata without granting client-side write permissions,
 * the service account of ifa-activities MUST be granted `roles/datastore.user` (Cloud Datastore User)
 * on project "ifa-graduation".
 */
let _googleAuth = null;
let _testFirestoreDriver = null;

function setTestFirestoreDriver(driver) {
  _testFirestoreDriver = driver;
}

async function getServerToken() {
  if (_testFirestoreDriver?.getServerToken) return _testFirestoreDriver.getServerToken();
  try {
    if (!_googleAuth) {
      _googleAuth = new GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/datastore',
          'https://www.googleapis.com/auth/cloud-platform',
        ],
      });
    }
    const client = await _googleAuth.getClient();
    const tokenRes = await client.getAccessToken();
    if (!tokenRes.token) throw new Error('Empty service account access token');
    return tokenRes.token;
  } catch (err) {
    // When running in local environments or tests without GCP service account credentials
    throw new Error('TRUSTED_SERVER_AUTH_FAILED: ' + err.message);
  }
}

/**
 * Reads a Firestore document via REST API using the user's ID token.
 * @param {string} docPath — e.g. "graduation/settings" or "users/abc123"
 * @param {string} idToken — verified Firebase ID token (audience ifa-graduation)
 * @returns {object|null} — deserialized Firestore document fields, or null if not found
 */
async function getDocument(docPath, idToken) {
  if (_testFirestoreDriver && _testFirestoreDriver.getDocument) {
    return _testFirestoreDriver.getDocument(docPath, idToken);
  }
  const url = FIRESTORE_BASE + '/' + docPath;
  const raw = await httpsGet(url, { Authorization: 'Bearer ' + idToken });
  if (!raw || raw.error) {
    if (raw && raw.error && raw.error.code === 404) return null;
    if (raw && raw.error) throw new Error('Firestore error: ' + JSON.stringify(raw.error));
    return null;
  }
  const resObj = deserializeFields(raw.fields || {});
  if (raw.updateTime && typeof resObj === 'object') {
    Object.defineProperty(resObj, '_updateTime', {
      value: raw.updateTime,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }
  return resObj;
}

/**
 * Runs a Firestore query using the user's ID token.
 * @param {string} collectionPath — e.g. "graduation/settings/rounds"
 * @param {object} structuredQuery — Firestore StructuredQuery body
 * @param {string} idToken
 * @returns {object[]} — array of deserialized documents
 */
async function runQuery(collectionPath, structuredQuery, idToken) {
  const url = FIRESTORE_BASE + '/' + collectionPath + ':runQuery';
  const raw = await httpsPost(url, { Authorization: 'Bearer ' + idToken }, structuredQuery);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => r.document)
    .map(r => ({ id: r.document.name.split('/').pop(), ...deserializeFields(r.document.fields || {}) }));
}

// ── Firestore value deserializer ──────────────────────────────────────────────

function deserializeValue(val) {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue !== undefined) return new Date(val.timestampValue);
  if (val.mapValue) return deserializeFields(val.mapValue.fields || {});
  if (val.arrayValue) return (val.arrayValue.values || []).map(deserializeValue);
  return null;
}

function deserializeFields(fields) {
  const result = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = deserializeValue(val);
  }
  return result;
}

function serializeValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isSafeInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(serializeValue) } };
  }
  if (typeof val === 'object') {
    return { mapValue: { fields: serializeFields(val) } };
  }
  return { stringValue: String(val) };
}

function serializeFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      fields[key] = serializeValue(val);
    }
  }
  return fields;
}

/**
 * Creates or completely replaces a Firestore document via REST API.
 * Uses PATCH without updateMask (replaces entire document fields).
 * @param {string} docPath
 * @param {object} data
 * @param {string} idToken
 */
async function createOrReplaceDocument(docPath, data, idToken) {
  if (_testFirestoreDriver && _testFirestoreDriver.createOrReplaceDocument) {
    return _testFirestoreDriver.createOrReplaceDocument(docPath, data, idToken);
  }
  if (_testFirestoreDriver && _testFirestoreDriver.setDocument) {
    return _testFirestoreDriver.setDocument(docPath, data, idToken);
  }
  const url = FIRESTORE_BASE + '/' + docPath;
  const fields = serializeFields(data);
  const raw = await httpsPatch(url, { Authorization: 'Bearer ' + idToken }, { fields });
  if (!raw || raw.error) {
    throw new Error('Firestore write error: ' + JSON.stringify(raw ? raw.error : 'Empty response'));
  }
  return deserializeFields(raw.fields || {});
}

/**
 * Safely updates only the specified fields of an existing Firestore document without wiping other fields.
 * Strictly appends updateMask.fieldPaths to query string.
 * @param {string} docPath
 * @param {object} partialData — Key-value pairs to update
 * @param {string} idToken
 * @param {string[]} [customMaskPaths] — Optional explicit field paths to update; defaults to Object.keys(partialData)
 */
async function updateDocumentFields(docPath, partialData, idToken, customMaskPaths, precondition) {
  if (_testFirestoreDriver && _testFirestoreDriver.updateDocumentFields) {
    return _testFirestoreDriver.updateDocumentFields(docPath, partialData, idToken, customMaskPaths, precondition);
  }
  const maskPaths = Array.isArray(customMaskPaths) && customMaskPaths.length > 0
    ? customMaskPaths
    : Object.keys(partialData);

  if (maskPaths.length === 0) {
    throw new Error('updateDocumentFields requires at least one field path in updateMask');
  }

  const queryParts = maskPaths
    .map(p => 'updateMask.fieldPaths=' + encodeURIComponent(p));

  if (precondition && precondition.exists !== undefined) {
    queryParts.push('currentDocument.exists=' + (precondition.exists ? 'true' : 'false'));
  } else if (precondition && precondition.updateTime) {
    queryParts.push('currentDocument.updateTime=' + encodeURIComponent(precondition.updateTime));
  }

  const url = FIRESTORE_BASE + '/' + docPath + '?' + queryParts.join('&');
  const fields = serializeFields(partialData);
  const raw = await httpsPatch(url, { Authorization: 'Bearer ' + idToken }, { fields });
  if (!raw || raw.error) {
    throw new Error('Firestore patch error: ' + JSON.stringify(raw ? raw.error : 'Empty response'));
  }
  return deserializeFields(raw.fields || {});
}

/**
 * Creates or updates a Firestore document with strict server-side precondition (e.g. { exists: false }).
 * Essential for atomic creation and preventing race conditions / concurrent complete requests.
 * @param {string} docPath
 * @param {object} data
 * @param {string} token — Server Bearer token
 * @param {object} [precondition] — e.g. { exists: false }
 */
async function createDocumentWithPrecondition(docPath, data, token, precondition = { exists: false }) {
  if (_testFirestoreDriver && _testFirestoreDriver.createDocumentWithPrecondition) {
    return _testFirestoreDriver.createDocumentWithPrecondition(docPath, data, token, precondition);
  }
  let query = '';
  if (precondition && precondition.exists !== undefined) {
    query = '?currentDocument.exists=' + (precondition.exists ? 'true' : 'false');
  } else if (precondition && precondition.updateTime) {
    query = '?currentDocument.updateTime=' + encodeURIComponent(precondition.updateTime);
  }
  const url = FIRESTORE_BASE + '/' + docPath + query;
  const fields = serializeFields(data);
  const raw = await httpsPatch(url, { Authorization: 'Bearer ' + token }, { fields });
  if (!raw || raw.error) {
    throw new Error('Firestore write error: ' + JSON.stringify(raw ? raw.error : 'Empty response'));
  }
  return deserializeFields(raw.fields || {});
}

// Backward-compatible alias
const setDocument = createOrReplaceDocument;

// ── HTTP helpers with strict FAIL-CLOSED HTTP non-2xx error checking ───────────

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) {
          return resolve(null);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`Firestore GET failed with HTTP ${res.statusCode}: ${data}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Firestore GET invalid JSON response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
  });
}

function httpsPatch(url, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`Firestore PATCH failed with HTTP ${res.statusCode}: ${data}`);
          err.statusCode = res.statusCode;
          try {
            const parsed = JSON.parse(data);
            err.code = parsed?.error?.status || (res.statusCode === 409 ? 'ALREADY_EXISTS' : 'FIRESTORE_ERROR');
            err.errorDetails = parsed?.error;
          } catch (_) {
            err.code = res.statusCode === 409 ? 'ALREADY_EXISTS' : 'FIRESTORE_ERROR';
          }
          return reject(err);
        }
        try {
          const parsed = JSON.parse(data);
          if (!parsed) {
            return reject(new Error('Firestore PATCH returned empty/null parsed response'));
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Firestore PATCH invalid JSON response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`Firestore POST failed with HTTP ${res.statusCode}: ${data}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        try {
          const parsed = JSON.parse(data);
          if (!parsed) {
            return reject(new Error('Firestore POST returned empty/null parsed response'));
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Firestore POST invalid JSON response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Retrieves graduation Google Drive root configuration from Firestore.
 * Prioritizes graduationSystemConfig/drive, with fallback to settings/main.
 * @param {string} token - ID token or Server access token
 * @returns {Promise<{ graduationRootFolderUrl?: string, graduationRootFolderId?: string, graduationRootFolderName?: string, updatedAt?: string, updatedBy?: string }|null>}
 */
async function getGraduationDriveConfig(token) {
  if (_testFirestoreDriver && typeof _testFirestoreDriver.getGraduationDriveConfig === 'function') {
    return _testFirestoreDriver.getGraduationDriveConfig(token);
  }

  // 1. Primary path: graduationSystemConfig/drive
  try {
    const doc = await getDocument('graduationSystemConfig/drive', token);
    if (doc && (doc.graduationRootFolderId || doc.folderId)) {
      return {
        graduationRootFolderUrl: doc.graduationRootFolderUrl || doc.folderUrl || '',
        graduationRootFolderId: doc.graduationRootFolderId || doc.folderId || '',
        graduationRootFolderName: doc.graduationRootFolderName || doc.folderName || '',
        updatedAt: doc.updatedAt || '',
        updatedBy: doc.updatedBy || '',
      };
    }
  } catch (err) {
    // Continue to fallback
  }

  // 2. Fallback: settings/main
  try {
    const settings = await getDocument('settings/main', token);
    if (settings?.driveConfig?.graduationRootFolderId) {
      return settings.driveConfig;
    }
    if (settings?.graduationRootFolderId) {
      return {
        graduationRootFolderUrl: settings.graduationRootFolderUrl || '',
        graduationRootFolderId: settings.graduationRootFolderId || '',
        graduationRootFolderName: settings.graduationRootFolderName || '',
        updatedAt: settings.updatedAt || '',
        updatedBy: settings.updatedBy || '',
      };
    }
  } catch (err) {
    // Config not present
  }

  return null;
}

/**
 * Saves graduation Google Drive root configuration to Firestore.
 * Strictly writes to graduationSystemConfig/drive on ifa-graduation,
 * and synchronizes to settings/main.driveConfig.
 * @param {object} configData
 * @param {string} token - ID token or Server access token
 * @returns {Promise<object>}
 */
async function saveGraduationDriveConfig(configData, token) {
  if (_testFirestoreDriver && typeof _testFirestoreDriver.saveGraduationDriveConfig === 'function') {
    return _testFirestoreDriver.saveGraduationDriveConfig(configData, token);
  }

  const payload = {
    graduationRootFolderUrl: String(configData.graduationRootFolderUrl || configData.folderUrl || '').trim(),
    graduationRootFolderId: String(configData.graduationRootFolderId || configData.folderId || '').trim(),
    graduationRootFolderName: String(configData.graduationRootFolderName || configData.folderName || 'Google Drive DATN').trim(),
    updatedAt: configData.updatedAt || new Date().toISOString(),
    updatedBy: configData.updatedBy || 'admin',
  };

  // 1. Write to primary path: graduationSystemConfig/drive
  await setDocument('graduationSystemConfig/drive', payload, token);

  // 2. Best-effort sync to settings/main.driveConfig
  try {
    await updateDocumentFields('settings/main', { driveConfig: payload }, token, ['driveConfig']);
  } catch (e) {
    // Non-critical if settings/main doesn't allow field patch
  }

  return payload;
}

module.exports = {
  getDocument,
  setDocument,
  createOrReplaceDocument,
  createDocumentWithPrecondition,
  updateDocumentFields,
  runQuery,
  serializeFields,
  deserializeFields,
  getServerToken,
  getGraduationDriveConfig,
  saveGraduationDriveConfig,
  setTestFirestoreDriver,
};
