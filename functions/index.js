/**
 * index.js — Cloud Function entry point for IFA+ Graduation Upload API
 *
 * Platform: Firebase Functions v6 (2nd gen), Node 22
 * Project:  ifa-activities
 * Region:   asia-southeast1
 *
 * Endpoints:
 *   GET  /api/graduation/health          — public, checks drive config
 *   POST /api/graduation/upload-session  — requires student auth
 */

'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { requireStudentAuth } = require('./auth.js');
const { getDocument } = require('./firestore.js');
const { validateFile, validateActivity, ValidationError } = require('./validation.js');
const { isDriveConfigured, createUploadSession } = require('./drive.js');

// CORS: only allow from production and local development origins
const ALLOWED_ORIGINS = new Set([
  'https://tknt-tdtu.web.app',
  'https://tknt-tdtu.firebaseapp.com',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:5000',
]);

function setCORSHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

function handleOptions(req, res) {
  setCORSHeaders(req, res);
  res.status(204).send('');
}

// ── GET /api/graduation/health ────────────────────────────────────────────────

async function healthHandler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const driveConfigured = await isDriveConfigured();
  return res.status(200).json({
    ok: true,
    driveConfigured,
    version: '2.4.0-beta.1',
    region: 'asia-southeast1',
  });
}

// ── POST /api/graduation/upload-session ───────────────────────────────────────

async function uploadSessionHandler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Authenticate — requires @student.tdtu.edu.vn token
  await new Promise((resolve, reject) => {
    requireStudentAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {}); // response already sent by middleware on failure

  // If middleware already responded (401/403), bail out
  if (res.headersSent) return;

  const { studentId, idToken: _unused, uid } = req.auth;
  const rawToken = req.headers['authorization'].slice(7).trim();

  try {
    const body = req.body || {};
    const { activityId, file: fileMeta } = body;

    if (!activityId || typeof activityId !== 'string') {
      return res.status(400).json({ error: 'Thiếu activityId' });
    }

    // 2. Validate file metadata
    validateFile(fileMeta);

    // 3. Read activity config from tknt-tdtu Firestore (using user's own token)
    const activityDoc = await getDocument('graduation/config/activities/' + activityId, rawToken);

    // 4. Read current attempt count for this student
    const attemptDoc = await getDocument(
      'graduation/config/activities/' + activityId + '/submissions/' + studentId,
      rawToken
    );
    const currentAttemptCount = attemptDoc ? (attemptDoc.attemptCount || 0) : 0;

    // 5. Validate activity rules (deadline, attemptLimit, submissionEnabled)
    validateActivity(activityDoc, currentAttemptCount);

    // 6. Check Drive is configured
    const driveReady = await isDriveConfigured();
    if (!driveReady) {
      return res.status(503).json({
        error: 'Hệ thống nhận hồ sơ chưa sẵn sàng. Vui lòng liên hệ ban tổ chức.',
        code: 'DRIVE_NOT_CONFIGURED',
      });
    }

    // 7. Create resumable Drive upload session
    const sessionUri = await createUploadSession({
      filename: fileMeta.name,
      mimeType: fileMeta.type || 'application/octet-stream',
      fileSize: fileMeta.size,
      studentId,
      activityId,
    });

    // 8. Return session URI to frontend (this URI is safe — it is scoped per-file)
    return res.status(200).json({
      ok: true,
      sessionUri,
      studentId,
      activityId,
    });

  } catch (err) {
    if (err && err.isValidationError) {
      return res.status(422).json({ error: err.message });
    }
    console.error('[upload-session] Unexpected error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
}

// ── Route dispatcher ─────────────────────────────────────────────────────────

exports.graduationApi = onRequest(
  {
    region: 'asia-southeast1',
    memory: '256MiB',
    timeoutSeconds: 60,
    minInstances: 0,
    maxInstances: 10,
    cors: false, // We handle CORS manually for precise origin control
  },
  async (req, res) => {
    const urlPath = req.path || '/';

    if (urlPath === '/api/graduation/health' || urlPath === '/') {
      return await healthHandler(req, res);
    }

    if (urlPath === '/api/graduation/upload-session') {
      return await uploadSessionHandler(req, res);
    }

    setCORSHeaders(req, res);
    return res.status(404).json({ error: 'Not found' });
  }
);
