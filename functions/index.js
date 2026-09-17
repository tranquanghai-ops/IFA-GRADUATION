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
const { requireStudentAuth, requireAdminAuth, getStorageBucket } = require('./auth.js');
const { getDocument } = require('./firestore.js');
const { validateFile, validateActivity, ValidationError } = require('./validation.js');
const { isDriveConfigured, createUploadSession, getAccessToken, loadDriveConfig, runDriveDiagnostic, deleteDriveFile } = require('./drive.js');
const { getSecret } = require('./secrets.js');
const crypto = require('crypto');

function extractFolderId(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

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

  // Detailed diagnostic mode
  if (req.query.diag === '1') {
    const diagReport = await runDriveDiagnostic(req.query.folderId);
    return res.status(200).json(diagReport);
  }

  const config = await loadDriveConfig();
  let tokenTest = null;
  if (config) {
    try {
      const token = await getAccessToken(config);
      tokenTest = { ok: true };
    } catch (e) {
      tokenTest = { ok: false, error: e.message };
    }
  }

  return res.status(200).json({
    ok: true,
    driveConfigured: !!config,
    tokenTest,
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

  let { studentId } = req.auth;
  const { idToken: _unused, uid, isAdmin } = req.auth;
  const rawToken = req.headers['authorization'].slice(7).trim();

  try {
    const body = req.body || {};
    const { activityId, roundId, file: fileMeta } = body;
    
    // Admins can upload on behalf of a student, so they provide the studentId in the body
    if (isAdmin && body.studentId) {
      studentId = body.studentId;
    }

    if (!studentId) {
      return res.status(400).json({ error: 'Thiếu studentId' });
    }

    if (!activityId || typeof activityId !== 'string') {
      return res.status(400).json({ error: 'Thiếu activityId' });
    }
    if (!roundId || typeof roundId !== 'string') {
      return res.status(400).json({ error: 'Thiếu roundId' });
    }

    // 2. Validate file metadata
    validateFile(fileMeta);

    // 3. Read round config from tknt-tdtu Firestore
    const roundDoc = await getDocument('graduationRounds/' + roundId, rawToken);
    if (!roundDoc) {
      return res.status(404).json({ error: 'Không tìm thấy đợt xét tốt nghiệp' });
    }

    const activityDoc = (roundDoc.activities || []).find(a => a.id === activityId);
    if (!activityDoc) {
      return res.status(404).json({ error: 'Không tìm thấy hoạt động' });
    }

    // 4. Read current attempt count for this student (exclude withdrawn submissions)
    const studentSubmissions = roundDoc.activitySubmissions?.[activityId]?.[studentId];
    const attempts = Array.isArray(studentSubmissions?.attempts)
      ? studentSubmissions.attempts
      : (studentSubmissions?.currentSubmission ? [studentSubmissions.currentSubmission] : []);
    const currentAttemptCount = attempts.filter(a => a.status !== 'withdrawn').length;

    // 5. Validate activity rules (deadline, attemptLimit, submissionEnabled)
    validateActivity(activityDoc, currentAttemptCount);

    // 6. Resolve target Drive folder ID
    let rawFolder =
      body.folderId ||
      activityDoc.submissionConfig?.driveFolderId ||
      activityDoc.driveFolderId ||
      roundDoc.driveRootFolderId ||
      roundDoc.driveFolderId;

    if (!rawFolder) {
      rawFolder = await getSecret('graduation-drive-folder-id');
    }
    if (!rawFolder) {
      rawFolder = '1M37ovlEHS3ufftFPZHGj1mQWec7r8Tj7';
    }

    const targetFolderId = extractFolderId(rawFolder);
    if (!targetFolderId) {
      return res.status(400).json({ error: 'Chưa cấu hình thư mục nhận bài. Vui lòng liên hệ ban tổ chức.' });
    }

    // 7. Check Drive is configured
    const driveReady = await isDriveConfigured();
    if (!driveReady) {
      return res.status(503).json({
        error: 'Hệ thống nhận hồ sơ chưa sẵn sàng. Vui lòng liên hệ ban tổ chức.',
        code: 'DRIVE_NOT_CONFIGURED',
      });
    }

    // 8. Create resumable Drive upload session
    const sessionUri = await createUploadSession({
      filename: fileMeta.name,
      mimeType: fileMeta.type || 'application/octet-stream',
      fileSize: fileMeta.size,
      studentId,
      activityId,
      folderId: targetFolderId,
      origin: req.headers.origin || 'https://tknt-tdtu.web.app',
    });

    // 9. Return session URI to frontend (this URI is safe — it is scoped per-file)
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

// ── POST /api/graduation/delete-file ──────────────────────────────────────────

async function deleteFileHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireStudentAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.writableEnded) return;

  const { fileId } = req.body || {};
  if (!fileId) {
    return res.status(400).json({ error: 'Missing fileId' });
  }

  try {
    const deleted = await deleteDriveFile(fileId);
    return res.status(200).json({ ok: true, deleted });
  } catch (err) {
    console.error('[delete-file] Error:', err);
    return res.status(500).json({ error: 'Không thể xóa tệp trên Google Drive.' });
  }
}

// ── POST /api/graduation/supervisor-portrait ─────────────────────────────────

async function uploadSupervisorPortraitHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireAdminAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.headersSent) return;

  try {
    const { supervisorId, mimeType, imageBase64 } = req.body || {};

    if (!supervisorId || typeof supervisorId !== 'string') {
      return res.status(400).json({ error: 'Thiếu supervisorId hợp lệ' });
    }

    const cleanSupId = supervisorId.trim();
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanSupId) || cleanSupId.includes('..')) {
      return res.status(400).json({ error: 'supervisorId chứa ký tự không hợp lệ' });
    }

    const validMimes = ['image/webp', 'image/jpeg', 'image/jpg'];
    if (!mimeType || !validMimes.includes(mimeType.toLowerCase())) {
      return res.status(400).json({ error: 'Chỉ hỗ trợ định dạng image/webp hoặc image/jpeg' });
    }
    const normMime = (mimeType.toLowerCase() === 'image/jpg') ? 'image/jpeg' : mimeType.toLowerCase();
    const ext = normMime === 'image/webp' ? 'webp' : 'jpg';

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Thiếu dữ liệu ảnh' });
    }

    const rawBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');

    const MAX_PORTRAIT_SIZE = 3 * 1024 * 1024; // 3MB
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Dữ liệu ảnh rỗng' });
    }
    if (buffer.length > MAX_PORTRAIT_SIZE) {
      return res.status(400).json({ error: 'Dung lượng ảnh vượt quá 3MB' });
    }

    const bucket = getStorageBucket();
    const targetPath = `graduation/supervisors/${cleanSupId}/portrait.${ext}`;
    const altExt = ext === 'webp' ? 'jpg' : 'webp';
    const altPath = `graduation/supervisors/${cleanSupId}/portrait.${altExt}`;

    // Clean up previous image with alternate extension if any
    bucket.file(altPath).delete({ ignoreNotFound: true }).catch(() => {});

    const downloadToken = crypto.randomUUID();
    const file = bucket.file(targetPath);

    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: normMime,
        cacheControl: 'public, max-age=31536000',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const photoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(targetPath)}?alt=media&token=${downloadToken}`;

    return res.status(200).json({
      ok: true,
      photoUrl,
      photoPath: targetPath,
      size: buffer.length,
      contentType: normMime,
    });
  } catch (err) {
    console.error('[supervisor-portrait] Error:', err);
    return res.status(500).json({ error: 'Lỗi lưu trữ ảnh GVHD: ' + err.message });
  }
}

// ── POST /api/graduation/delete-supervisor-portrait ──────────────────────────

async function deleteSupervisorPortraitHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireAdminAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.headersSent) return;

  try {
    const { supervisorId } = req.body || {};
    if (!supervisorId || typeof supervisorId !== 'string') {
      return res.status(400).json({ error: 'Thiếu supervisorId' });
    }

    const cleanSupId = supervisorId.trim();
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanSupId) || cleanSupId.includes('..')) {
      return res.status(400).json({ error: 'supervisorId chứa ký tự không hợp lệ' });
    }

    const bucket = getStorageBucket();
    await Promise.all([
      bucket.file(`graduation/supervisors/${cleanSupId}/portrait.webp`).delete({ ignoreNotFound: true }),
      bucket.file(`graduation/supervisors/${cleanSupId}/portrait.jpg`).delete({ ignoreNotFound: true }),
    ]);

    return res.status(200).json({ ok: true, deleted: true });
  } catch (err) {
    console.error('[delete-supervisor-portrait] Error:', err);
    return res.status(500).json({ error: 'Lỗi xóa ảnh GVHD: ' + err.message });
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

    if (urlPath === '/api/graduation/delete-file') {
      return await deleteFileHandler(req, res);
    }

    if (urlPath === '/api/graduation/supervisor-portrait') {
      return await uploadSupervisorPortraitHandler(req, res);
    }

    if (urlPath === '/api/graduation/delete-supervisor-portrait') {
      return await deleteSupervisorPortraitHandler(req, res);
    }

    setCORSHeaders(req, res);
    return res.status(404).json({ error: 'Not found' });
  }
);
