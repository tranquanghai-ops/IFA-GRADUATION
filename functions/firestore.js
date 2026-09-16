/**
 * firestore.js — Cross-project Firestore REST reads for tknt-tdtu
 *
 * Uses the verified user's own Firebase ID token (Option A).
 * No service account needed — user must have read permission in Firestore rules.
 */

'use strict';

const https = require('https');

const TKNT_PROJECT = 'tknt-tdtu';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/' + TKNT_PROJECT + '/databases/(default)/documents';

/**
 * Reads a Firestore document via REST API using the user's ID token.
 * @param {string} docPath — e.g. "graduation/settings" or "users/abc123"
 * @param {string} idToken — verified Firebase ID token (audience tknt-tdtu)
 * @returns {object|null} — deserialized Firestore document fields, or null if not found
 */
async function getDocument(docPath, idToken) {
  const url = FIRESTORE_BASE + '/' + docPath;
  const raw = await httpsGet(url, { Authorization: 'Bearer ' + idToken });
  if (!raw || raw.error) {
    if (raw && raw.error && raw.error.code === 404) return null;
    if (raw && raw.error) throw new Error('Firestore error: ' + JSON.stringify(raw.error));
    return null;
  }
  return deserializeFields(raw.fields || {});
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

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
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
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

module.exports = { getDocument, runQuery };
