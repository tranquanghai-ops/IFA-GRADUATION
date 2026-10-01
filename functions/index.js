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
const {
  getDocument,
  setDocument,
  updateDocumentFields,
  createDocumentWithPrecondition,
  getServerToken,
  getGraduationDriveConfig,
  saveGraduationDriveConfig,
} = require('./firestore.js');
const { validateFile, validateActivity, ValidationError, getEffectiveMaxBytes } = require('./validation.js');
const {
  isDriveConfigured,
  createUploadSession,
  getAccessToken,
  loadDriveConfig,
  runDriveDiagnostic,
  deleteDriveFile,
  trashDriveFile,
  getDriveFileMetadata,
  verifyAndCompleteUpload,
  validateRootDriveFolder,
  getOrCreateDriveChildFolder,
} = require('./drive.js');
const { assertOwned, fileId: parseFileId } = require('./policy.js');
const { getSecret } = require('./secrets.js');
const crypto = require('crypto');

function extractFolderId(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

// CORS: allow ifa-graduation (production), tknt-tdtu (legacy compatibility), and local development origins
const ALLOWED_ORIGINS = new Set([
  'https://ifa-graduation.web.app',
  'https://ifa-graduation.firebaseapp.com',
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

/**
 * Resolves target Google Drive folder on the server.
 * Hierarchy:
 * ROOT DATN (from graduationSystemConfig/drive on ifa-graduation)
 *   └── Đợt DATN (roundDoc.title / roundDoc.name)
 *         └── Mốc / Activity (activityDoc.title / activityDoc.name)
 *               └── MSSV - Họ tên (studentId - studentName)
 *                     └── file
 * FAIL-CLOSED: Rejects with DRIVE_ROOT_NOT_CONFIGURED if no root is configured.
 * Never falls back to TSNN or hardcoded/secret folders.
 */
async function resolveTargetDriveFolder({ roundDoc, activityDoc, studentId, serverToken }) {
  const roundId = roundDoc.id || roundDoc._id;
  const systemDriveConfig = await getGraduationDriveConfig(serverToken);
  const configuredRootFolderId = (systemDriveConfig?.graduationRootFolderId || '').trim();
  const rootFolderId = configuredRootFolderId || roundDoc.driveRootFolderId || roundDoc.driveFolderId;

  if (!rootFolderId) {
    const err = new Error('DRIVE_ROOT_NOT_CONFIGURED: Root Google Drive folder has not been configured in Admin Settings. Please contact system administrator.');
    err.code = 'DRIVE_ROOT_NOT_CONFIGURED';
    throw err;
  }

  // If activity already has a specifically configured driveFolderId, respect it
  if (activityDoc.submissionConfig?.driveFolderId || activityDoc.driveFolderId) {
    return activityDoc.submissionConfig?.driveFolderId || activityDoc.driveFolderId;
  }

  let parentFolderId = rootFolderId;

  // 1. Round folder
  if (configuredRootFolderId) {
    const roundTitle = (roundDoc.title || roundDoc.name || `Dot_${roundId}`).trim();
    const roundFolder = await getOrCreateDriveChildFolder({
      parentFolderId: configuredRootFolderId,
      folderName: roundTitle,
      folderType: 'round_structure',
      roundId,
    });
    parentFolderId = roundFolder.folderId;
  }

  // 2. Activity folder
  const activityTitle = (activityDoc.title || activityDoc.name || `Moc_${activityDoc.id || activityDoc._id}`).trim();
  const actFolder = await getOrCreateDriveChildFolder({
    parentFolderId,
    folderName: activityTitle,
    folderType: 'activity_structure',
    roundId,
  });
  parentFolderId = actFolder.folderId;

  // 3. Student folder
  let studentName = '';
  try {
    const elStudent = await getDocument(`graduationRounds/${encodeURIComponent(roundId)}/eligibleStudents/${encodeURIComponent(studentId)}`, serverToken);
    studentName = elStudent?.fullName || elStudent?.name || '';
  } catch {}
  const studentFolderName = studentName ? `${studentId} - ${studentName}` : `${studentId}`;
  const studentFolder = await getOrCreateDriveChildFolder({
    parentFolderId,
    folderName: studentFolderName,
    folderType: 'student_structure',
    roundId,
  });

  return studentFolder.folderId;
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

    // 2. Read round config from ifa-graduation Firestore
    const roundDoc = await getDocument('graduationRounds/' + roundId, rawToken);
    if (!roundDoc) {
      return res.status(404).json({ error: 'Không tìm thấy đợt xét tốt nghiệp' });
    }

    const activityDoc = (roundDoc.activities || []).find(a => a.id === activityId);
    if (!activityDoc) {
      return res.status(404).json({ error: 'Không tìm thấy hoạt động' });
    }

    // 3. Validate file metadata with effective limit (business limit bounded by 2 GiB ceiling)
    const businessLimitBytes = (activityDoc.submissionConfig?.maxFileSizeMB || 100) * 1024 * 1024;
    const effectiveLimit = getEffectiveMaxBytes(businessLimitBytes);
    validateFile(fileMeta, effectiveLimit);

    // 4. Read current attempt count for this student (exclude withdrawn submissions)
    const studentSubmissions = roundDoc.activitySubmissions?.[activityId]?.[studentId];
    const attempts = Array.isArray(studentSubmissions?.attempts)
      ? studentSubmissions.attempts
      : (studentSubmissions?.currentSubmission ? [studentSubmissions.currentSubmission] : []);
    const currentAttemptCount = attempts.filter(a => a.status !== 'withdrawn').length;

    // 5. Validate activity rules (deadline, attemptLimit, submissionEnabled)
    validateActivity(activityDoc, currentAttemptCount);

    // 6. Resolve target Drive folder ID exclusively on server (ignore client body.folderId)
    // Server derives ROOT DATN -> Đợt DATN -> Mốc -> Sinh viên folder.
    let targetFolderId;
    try {
      const serverToken = await getServerToken();
      targetFolderId = await resolveTargetDriveFolder({
        roundDoc,
        activityDoc,
        studentId,
        serverToken,
      });
    } catch (folderErr) {
      if (folderErr.code === 'DRIVE_ROOT_NOT_CONFIGURED' || folderErr.message.includes('DRIVE_ROOT_NOT_CONFIGURED')) {
        return res.status(400).json({
          error: folderErr.message,
          code: 'DRIVE_ROOT_NOT_CONFIGURED',
        });
      }
      throw folderErr;
    }

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

    // 8. Create resumable Drive upload session with appProperties
    const uploadId = body.uploadId || crypto.randomUUID();
    const sessionUri = await createUploadSession({
      filename: fileMeta.name,
      mimeType: fileMeta.type || 'application/octet-stream',
      fileSize: fileMeta.size,
      studentId,
      activityId,
      roundId,
      uploadedBy: uid,
      uploadId,
      folderId: targetFolderId,
      origin: req.headers.origin || 'https://ifa-graduation.web.app',
    });

    // 9. Return session URI to frontend
    return res.status(200).json({
      ok: true,
      sessionUri,
      studentId,
      activityId,
      roundId,
      uploadId,
    });

  } catch (err) {
    if (err && err.isValidationError) {
      return res.status(422).json({ error: err.message });
    }
    console.error('[upload-session] Unexpected error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
}

// ── POST /api/graduation/complete ─────────────────────────────────────────────

async function completeUploadHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireStudentAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.headersSent) return;

  let { studentId } = req.auth;
  const { uid, isAdmin } = req.auth;
  const rawToken = req.headers['authorization'].slice(7).trim();

  try {
    const body = req.body || {};
    const { fileId, activityId, roundId, uploadId } = body;

    if (isAdmin && body.studentId) {
      studentId = body.studentId;
    }

    if (!fileId || typeof fileId !== 'string') {
      return res.status(400).json({ error: 'MISSING_FILE_ID' });
    }
    if (!activityId || typeof activityId !== 'string') {
      return res.status(400).json({ error: 'MISSING_ACTIVITY_ID' });
    }
    if (!roundId || typeof roundId !== 'string') {
      return res.status(400).json({ error: 'MISSING_ROUND_ID' });
    }
    if (!uploadId || typeof uploadId !== 'string') {
      return res.status(400).json({ error: 'MISSING_UPLOAD_ID' });
    }

    // 1. Fetch round and activity config from ifa-graduation Firestore
    const roundDoc = await getDocument('graduationRounds/' + encodeURIComponent(roundId), rawToken);
    if (!roundDoc) {
      return res.status(404).json({ error: 'ROUND_NOT_FOUND' });
    }

    const activityDoc = (roundDoc.activities || []).find(a => a.id === activityId);
    if (!activityDoc) {
      return res.status(404).json({ error: 'ACTIVITY_NOT_FOUND' });
    }

    // 2. Derive target folder ID strictly on server
    const serverToken = await getServerToken();
    let targetFolderId;
    try {
      targetFolderId = await resolveTargetDriveFolder({
        roundDoc,
        activityDoc,
        studentId,
        serverToken,
      });
    } catch (folderErr) {
      if (folderErr.code === 'DRIVE_ROOT_NOT_CONFIGURED' || folderErr.message.includes('DRIVE_ROOT_NOT_CONFIGURED')) {
        return res.status(400).json({
          error: folderErr.message,
          code: 'DRIVE_ROOT_NOT_CONFIGURED',
        });
      }
      throw folderErr;
    }

    if (!targetFolderId) {
      return res.status(400).json({ error: 'TARGET_FOLDER_NOT_CONFIGURED' });
    }

    // 3. Compute effective business limit
    const maxMb = activityDoc.submissionConfig?.maxFileSizeMB || 100;
    const effectiveBusinessLimit = getEffectiveMaxBytes(maxMb * 1024 * 1024, 100);

    // 4. Always perform live verification against Google Drive API first.
    // Never trust pre-existing metadata or client assertions without fresh Drive verification.
    const verified = await verifyAndCompleteUpload({
      fileId,
      studentId,
      activityId,
      roundId,
      uploadId,
      targetFolderId,
      effectiveBusinessLimit,
    });

    // 5. Server token already acquired for Firestore operations

    // 6. Check existing metadata using serverToken to prevent 403 when document does not exist yet
    const existingDoc = await getDocument('driveFiles/' + encodeURIComponent(fileId), serverToken);
    if (existingDoc && existingDoc.status === 'verified') {
      const matchStudent = existingDoc.studentId?.toUpperCase() === studentId.toUpperCase();
      const matchRound = existingDoc.roundId === roundId;
      const matchActivity = existingDoc.activityId === activityId;
      const matchUpload = existingDoc.uploadId === uploadId;

      if (!matchStudent || !matchRound || !matchActivity || !matchUpload) {
        return res.status(409).json({
          error: 'FILE_ALREADY_VERIFIED_UNDER_DIFFERENT_CONTEXT',
          message: 'Tệp đã được xác nhận với thông tin ngữ cảnh khác.',
        });
      }

      // Verified fresh on Drive and matched existing context -> idempotent response
      return res.status(200).json({
        ok: true,
        file: {
          ...existingDoc,
          size: verified.size,
          lastVerifiedAt: new Date().toISOString(),
        },
        idempotent: true,
      });
    }

    // 7. Atomic creation with precondition (currentDocument.exists = false) to prevent race conditions
    const persistentRecord = {
      fileId: verified.fileId,
      fileName: verified.fileName,
      mimeType: verified.mimeType,
      size: verified.size,
      viewUrl: verified.viewUrl,
      downloadUrl: verified.downloadUrl,
      studentId: verified.studentId,
      activityId: verified.activityId,
      roundId: verified.roundId,
      uploadedBy: uid,
      uploadId: verified.uploadId,
      targetFolderId: verified.targetFolderId,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      createdAt: verified.createdTime,
    };

    try {
      await createDocumentWithPrecondition(
        'driveFiles/' + encodeURIComponent(fileId),
        persistentRecord,
        serverToken,
        { exists: false }
      );
    } catch (storeErr) {
      // Concurrent race condition: another parallel request completed and created the document first
      if (storeErr.statusCode === 409 || storeErr.code === 'ALREADY_EXISTS') {
        console.log('[complete] Concurrent creation race detected for fileId:', fileId, '- resolving atomically');
        const concurrentDoc = await getDocument('driveFiles/' + encodeURIComponent(fileId), serverToken);
        if (concurrentDoc && concurrentDoc.status === 'verified') {
          const matchStudent = concurrentDoc.studentId?.toUpperCase() === studentId.toUpperCase();
          const matchRound = concurrentDoc.roundId === roundId;
          const matchActivity = concurrentDoc.activityId === activityId;
          const matchUpload = concurrentDoc.uploadId === uploadId;

          if (matchStudent && matchRound && matchActivity && matchUpload) {
            return res.status(200).json({
              ok: true,
              file: concurrentDoc,
              idempotent: true,
              raceResolved: true,
            });
          }
        }
        return res.status(409).json({
          error: 'FILE_ALREADY_VERIFIED_UNDER_DIFFERENT_CONTEXT',
          message: 'Xung đột khi ghi nhận tệp đồng thời.',
        });
      }

      console.error('[complete] Failed to persist driveFiles record:', storeErr.message);
      return res.status(500).json({
        error: 'FIRESTORE_PERSISTENCE_FAILED',
        message: 'Không thể lưu trữ trạng thái tệp trên hệ thống.',
      });
    }

    return res.status(200).json({
      ok: true,
      file: persistentRecord,
    });
  } catch (err) {
    console.error('[complete] Verification error:', err.message);
    const safeError = [
      'FILE_NOT_FOUND',
      'FILE_SIZE_MISMATCH',
      'FILE_SIZE_EXCEEDS_LIMIT',
      'FILE_MIME_MISMATCH',
      'CONTEXT_MISMATCH',
      'FILE_NOT_OWNED',
      'INVALID_PARENT_FOLDER',
      'MISSING_FILE_ID',
      'MISSING_STUDENT_ID',
      'MISSING_ACTIVITY_ID',
      'MISSING_ROUND_ID',
      'MISSING_UPLOAD_ID',
      'MISSING_TARGET_FOLDER_ID',
      'ROUND_NOT_FOUND',
      'ACTIVITY_NOT_FOUND',
      'TARGET_FOLDER_NOT_CONFIGURED',
      'FIRESTORE_PERSISTENCE_FAILED',
    ].includes(err.message)
      ? err.message
      : 'Không thể xác nhận tệp tải lên.';
    return res.status(400).json({ error: safeError });
  }
}

// ── POST /api/graduation/cleanup (and legacy /api/graduation/delete-file) ──────

async function cleanupHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireStudentAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.writableEnded) return;

  const { fileId, roundId, activityId } = req.body || {};
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'MISSING_FILE_ID' });
  }
  if (!roundId || typeof roundId !== 'string') {
    return res.status(400).json({ error: 'MISSING_ROUND_ID' });
  }
  if (!activityId || typeof activityId !== 'string') {
    return res.status(400).json({ error: 'MISSING_ACTIVITY_ID' });
  }

  let { studentId } = req.auth;
  const { isAdmin } = req.auth;
  const rawToken = req.headers['authorization'].slice(7).trim();

  if (isAdmin && req.body?.studentId) {
    studentId = req.body.studentId;
  }
  if (!studentId || typeof studentId !== 'string') {
    return res.status(400).json({ error: 'MISSING_STUDENT_ID' });
  }

  try {
    // 1. Business Reference Integrity Check:
    // Load target round and activity from ifa-graduation Firestore
    const roundDoc = await getDocument('graduationRounds/' + encodeURIComponent(roundId), rawToken);
    if (!roundDoc) {
      return res.status(404).json({ error: 'ROUND_NOT_FOUND', message: 'Không tìm thấy đợt tốt nghiệp tương ứng.' });
    }

    const activityDoc = (roundDoc.activities || []).find(a => a.id === activityId);
    if (!activityDoc) {
      return res.status(404).json({ error: 'ACTIVITY_NOT_FOUND', message: 'Không tìm thấy hoạt động tương ứng.' });
    }

    // Verify whether this file is referenced in any active submission or attempt across the round
    let hasWithdrawnReference = false;
    if (roundDoc.activitySubmissions) {
      for (const [actKey, studentMap] of Object.entries(roundDoc.activitySubmissions)) {
        if (!studentMap || typeof studentMap !== 'object') continue;

        for (const [stKey, subEntry] of Object.entries(studentMap)) {
          if (!subEntry || typeof subEntry !== 'object') continue;

          // A file may be trashed only after the matching submission is withdrawn.
          if (subEntry.currentSubmission) {
            const hasFile = (subEntry.currentSubmission.files || []).some(
              f => (f.providerFileId === fileId || f.fileId === fileId)
            );
            if (hasFile && subEntry.currentSubmission.status !== 'withdrawn') {
              return res.status(409).json({
                error: 'FILE_STILL_REFERENCED',
                message: 'Không thể xóa tệp đang được sử dụng trong bài nộp chính thức chưa rút.',
              });
            }
            if (hasFile && subEntry.currentSubmission.status === 'withdrawn' && stKey.toUpperCase() === studentId.toUpperCase() && actKey === activityId) {
              hasWithdrawnReference = true;
            }
          }

          // Check attempt history: if any attempt is not withdrawn and references fileId -> DENY TRASH
          if (Array.isArray(subEntry.attempts)) {
            for (const att of subEntry.attempts) {
              if (att) {
                const hasFile = (att.files || []).some(
                  f => (f.providerFileId === fileId || f.fileId === fileId)
                );
                if (hasFile && att.status !== 'withdrawn') {
                  return res.status(409).json({
                    error: 'FILE_STILL_REFERENCED',
                    message: 'Không thể xóa tệp đang được lưu trong lịch sử bài nộp chưa rút.',
                  });
                }
                if (hasFile && att.status === 'withdrawn' && stKey.toUpperCase() === studentId.toUpperCase() && actKey === activityId) {
                  hasWithdrawnReference = true;
                }
              }
            }
          }
        }
      }
    }
    if (!hasWithdrawnReference) {
      return res.status(409).json({ error: 'WITHDRAWN_REFERENCE_REQUIRED' });
    }

    // 2. Fetch Drive metadata and assert ownership and context
    const meta = await getDriveFileMetadata(fileId);
    if (!meta) {
      return res.status(200).json({ ok: true, trashed: true, notFound: true });
    }

    // Must belong to ifa-graduation and match the student's identity.
    assertOwned(meta, studentId, true, true);

    // Validate context against appProperties on Drive
    const appProps = meta.appProperties || {};
    if (appProps.roundId !== roundId) {
      return res.status(403).json({ error: 'CONTEXT_MISMATCH', message: 'Tệp không thuộc đợt tốt nghiệp được chỉ định.' });
    }
    if (appProps.activityId !== activityId) {
      return res.status(403).json({ error: 'CONTEXT_MISMATCH', message: 'Tệp không thuộc hoạt động được chỉ định.' });
    }
    if (!appProps.studentId || appProps.studentId.toUpperCase() !== studentId.toUpperCase()) {
      return res.status(403).json({ error: 'CONTEXT_MISMATCH', message: 'Tệp không thuộc sinh viên được chỉ định.' });
    }

    // A Drive file is not eligible for cleanup until the trusted backend has
    // persisted the same verified context. Obtain server credentials before
    // changing Drive state so an IAM failure cannot produce a partial cleanup.
    const serverToken = await getServerToken();
    const fileRecord = await getDocument('driveFiles/' + encodeURIComponent(fileId), serverToken);
    if (!fileRecord || fileRecord.status !== 'verified') {
      return res.status(409).json({ error: 'VERIFIED_FILE_RECORD_REQUIRED' });
    }
    if (fileRecord.studentId?.toUpperCase() !== studentId.toUpperCase()
      || fileRecord.roundId !== roundId
      || fileRecord.activityId !== activityId
      || fileRecord.fileId !== fileId) {
      return res.status(409).json({ error: 'FILE_RECORD_CONTEXT_MISMATCH' });
    }

    // 3. Move file to Drive Trash safely (non-permanent)
    const trashed = await trashDriveFile(fileId);
    if (!trashed) {
      return res.status(502).json({ error: 'DRIVE_TRASH_FAILED' });
    }

    // 4. Record the partial failure accurately if Firestore is unavailable.
    try {
      await updateDocumentFields(
        'driveFiles/' + encodeURIComponent(fileId),
        { status: 'trashed', trashedAt: new Date().toISOString() },
        serverToken,
        ['status', 'trashedAt']
      );
    } catch (e) {
      console.error('[cleanup] Drive file trashed, Firestore metadata update failed:', e.message);
      return res.status(502).json({ error: 'FIRESTORE_CLEANUP_STATUS_FAILED', trashed: true });
    }

    return res.status(200).json({ ok: true, trashed });
  } catch (err) {
    console.error('[cleanup] Error:', err.message);
    const code = err.message === 'FILE_NOT_OWNED' ? 403 : 500;
    return res.status(code).json({
      error: err.message === 'FILE_NOT_OWNED' ? 'FILE_NOT_OWNED' : 'CLEANUP_FAILED',
      message: err.message === 'FILE_NOT_OWNED' ? 'Không có quyền thao tác trên tệp này.' : 'Không thể đưa tệp vào Thùng rác.',
    });
  }
}

const deleteFileHandler = cleanupHandler;

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

// ── POST /api/graduation/admin/verify-drive-folder ──────────────────────────
// (Alias: /api/graduation/drive/validate-root-folder)

async function validateRootFolderHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireAdminAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.headersSent) return;

  const { folderUrlOrId, url, folderId, rootDriveFolderUrl } = req.body || {};
  const target = folderUrlOrId || url || folderId || rootDriveFolderUrl;

  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Thiếu thông tin URL hoặc Folder ID của thư mục gốc' });
  }

  try {
    const result = await validateRootDriveFolder(target);
    return res.status(200).json({
      ok: true,
      folderId: result.folderId,
      folderName: result.folderName,
      folderUrl: result.folderUrl,
      canAddChildren: result.canAddChildren,
      checkMethod: result.checkMethod,
    });
  } catch (err) {
    console.error('[verify-drive-folder] Error:', err.message);
    return res.status(400).json({ error: err.message });
  }
}

// ── POST /api/graduation/admin/save-drive-config ────────────────────────────

async function saveDriveConfigHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireAdminAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.headersSent) return;

  const { folderUrl, folderId, folderName } = req.body || {};
  if (!folderId || typeof folderId !== 'string') {
    return res.status(400).json({ error: 'Thiếu folderId' });
  }

  try {
    const serverToken = await getServerToken();
    const saved = await saveGraduationDriveConfig({
      graduationRootFolderUrl: folderUrl || `https://drive.google.com/drive/folders/${folderId}`,
      graduationRootFolderId: folderId,
      graduationRootFolderName: folderName || 'Google Drive DATN',
      updatedAt: new Date().toISOString(),
      updatedBy: req.auth?.email || 'admin',
    }, serverToken);

    return res.status(200).json({ ok: true, config: saved });
  } catch (err) {
    console.error('[save-drive-config] Error:', err.message);
    return res.status(500).json({ error: 'Không thể lưu cấu hình Drive: ' + err.message });
  }
}

// ── POST /api/graduation/drive/get-or-create-folder ─────────────────────────

async function getOrCreateFolderHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireAdminAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.headersSent) return;

  const { parentFolderId, folderName, folderType, roundId } = req.body || {};

  if (!parentFolderId || typeof parentFolderId !== 'string') {
    return res.status(400).json({ error: 'Thiếu parentFolderId (Thư mục gốc của Đợt tốt nghiệp)' });
  }
  if (!folderName || typeof folderName !== 'string') {
    return res.status(400).json({ error: 'Thiếu folderName (Tên thư mục con cần tạo hoặc kết nối)' });
  }

  try {
    const result = await getOrCreateDriveChildFolder({
      parentFolderId,
      folderName,
      folderType,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[get-or-create-folder] Error:', err.message);
    return res.status(400).json({ error: err.message });
  }
}

// Helper for formatting Firestore field paths with backticks for special characters
function formatFirestoreFieldPath(...segments) {
  return segments.map(seg => {
    const s = String(seg);
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) {
      return s;
    }
    const escaped = s.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    return `\`${escaped}\``;
  }).join('.');
}

// ── POST /api/graduation/submit-activity ─────────────────────────────────────

async function submitActivityHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireStudentAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.headersSent) return;

  // (1) Strictly require trusted serverToken - fail closed without client token fallback
  let serverToken;
  try {
    serverToken = await getServerToken();
  } catch (errAuth) {
    return res.status(503).json({
      error: 'TRUSTED_SERVER_AUTH_REQUIRED',
      message: 'Máy chủ chưa được cấp quyền xác thực nội bộ Firestore: ' + errAuth.message,
    });
  }

  try {
    const { roundId, activityId, studentId: requestedStudentId, studentName, files } = req.body || {};

    if (!roundId || typeof roundId !== 'string') {
      return res.status(400).json({ error: 'MISSING_ROUND_ID', message: 'Thiếu thông tin roundId.' });
    }
    if (!activityId || typeof activityId !== 'string') {
      return res.status(400).json({ error: 'MISSING_ACTIVITY_ID', message: 'Thiếu thông tin activityId.' });
    }
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'MISSING_FILES', message: 'Danh sách tệp nộp không được rỗng.' });
    }

    // Determine effective studentId
    let effectiveStudentId = req.auth.studentId;
    if (req.auth.isAdmin && requestedStudentId) {
      effectiveStudentId = requestedStudentId.trim();
    } else if (requestedStudentId && req.auth.studentId && requestedStudentId.toUpperCase() !== req.auth.studentId.toUpperCase()) {
      return res.status(403).json({
        error: 'STUDENT_ID_MISMATCH',
        message: 'Bạn chỉ có quyền nộp bài cho chính tài khoản sinh viên của mình.'
      });
    }

    if (!effectiveStudentId) {
      return res.status(400).json({ error: 'MISSING_STUDENT_ID', message: 'Không thể xác định mã số sinh viên.' });
    }

    // (5) Verify files against driveFiles collection with strict equality and server-derived metadata
    const verifiedFiles = [];
    for (const f of files) {
      const fId = f.providerFileId || f.fileId;
      if (!fId || typeof fId !== 'string') {
        return res.status(400).json({ error: 'INVALID_FILE_ID', message: 'Tệp nộp thiếu providerFileId hợp lệ.' });
      }

      const driveDoc = await getDocument('driveFiles/' + encodeURIComponent(fId), serverToken);
      if (!driveDoc) {
        return res.status(400).json({
          error: 'UNVERIFIED_FILE',
          message: `Tệp ${fId} chưa được xác thực trên hệ thống.`
        });
      }

      if (driveDoc.status !== 'verified') {
        return res.status(400).json({
          error: 'FILE_NOT_VERIFIED',
          message: `Tệp ${fId} có trạng thái chưa hoàn tất xác thực (${driveDoc.status}).`
        });
      }

      // Mandatory equality check on context
      if (!driveDoc.studentId || driveDoc.studentId.toUpperCase() !== effectiveStudentId.toUpperCase()) {
        return res.status(403).json({
          error: 'FILE_STUDENT_MISMATCH',
          message: `Tệp ${fId} không thuộc quyền sở hữu của sinh viên này.`
        });
      }
      if (!driveDoc.roundId || driveDoc.roundId !== roundId) {
        return res.status(400).json({
          error: 'FILE_ROUND_MISMATCH',
          message: `Tệp ${fId} không thuộc đợt tốt nghiệp này.`
        });
      }
      if (!driveDoc.activityId || driveDoc.activityId !== activityId) {
        return res.status(400).json({
          error: 'FILE_ACTIVITY_MISMATCH',
          message: `Tệp ${fId} không thuộc hoạt động nộp bài này.`
        });
      }

      const fileName = driveDoc.name || 'document';
      const fileSize = driveDoc.size;
      const fileMime = driveDoc.mimeType || 'application/octet-stream';

      // Validate file size and extension from server-verified driveDoc
      try {
        validateFile({ name: fileName, size: fileSize, type: fileMime });
      } catch (valFileErr) {
        return res.status(400).json({
          error: 'FILE_VALIDATION_FAILED',
          message: valFileErr.message,
        });
      }

      verifiedFiles.push({
        originalName: fileName,
        validatedName: fileName,
        size: fileSize,
        mimeType: fileMime,
        storageProvider: 'google_drive',
        providerFileId: fId,
        providerUrl: `https://drive.google.com/file/d/${fId}/view`,
      });
    }

    // (2) Format Firestore updateMask with escaped backticks for activityId and studentId
    const studentSubPath = formatFirestoreFieldPath('activitySubmissions', activityId, effectiveStudentId);
    const updatedAtPath = formatFirestoreFieldPath('updatedAt');

    // (3) Optimistic Concurrency Control retry loop with currentDocument.updateTime
    const MAX_RETRIES = 3;
    let attemptSucceeded = false;
    let retryCount = 0;
    let finalSubmission = null;
    let finalAttempts = null;

    while (retryCount < MAX_RETRIES && !attemptSucceeded) {
      // 1. Fetch round doc
      const roundDoc = await getDocument('graduationRounds/' + encodeURIComponent(roundId), serverToken);
      if (!roundDoc) {
        return res.status(404).json({ error: 'ROUND_NOT_FOUND', message: 'Không tìm thấy đợt tốt nghiệp.' });
      }

      const activity = (roundDoc.activities || []).find(a => a.id === activityId);
      if (!activity) {
        return res.status(404).json({ error: 'ACTIVITY_NOT_FOUND', message: 'Không tìm thấy hoạt động nộp bài.' });
      }

      // (4) Server validation using real validateActivity from functions/validation.js
      const existingEntry = roundDoc.activitySubmissions?.[activityId]?.[effectiveStudentId] || { attempts: [] };
      const completedAttempts = (existingEntry.attempts || []).filter(a => a && a.status === 'submitted').length;

      if (!req.auth.isAdmin) {
        try {
          validateActivity(activity, completedAttempts);
        } catch (actErr) {
          return res.status(400).json({
            error: 'ACTIVITY_VALIDATION_FAILED',
            message: actErr.message,
          });
        }
      }

      // Check deadline & determine isLate
      const now = new Date();
      let isLate = false;
      const deadlineStr = activity.submissionConfig?.deadlineMode === 'custom' && activity.submissionConfig?.deadlineAt
        ? activity.submissionConfig.deadlineAt
        : (activity.endAt || activity.submissionDeadline);
      if (deadlineStr) {
        const deadline = new Date(deadlineStr);
        if (!isNaN(deadline.getTime()) && now > deadline) {
          isLate = true;
        }
      }

      const attemptNum = (existingEntry.attempts || []).length + 1;
      const receiptId = 'REC-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

      const submissionMetadata = {
        studentId: effectiveStudentId,
        studentName: studentName || effectiveStudentId,
        activityId,
        activityTitle: activity.title || activity.name || '',
        roundId,
        attempt: attemptNum,
        receiptId,
        files: verifiedFiles,
        submittedAt: now.toISOString(),
        isLate,
        status: 'submitted',
        submittedBy: req.auth.email || effectiveStudentId,
      };

      const newAttempts = [...(existingEntry.attempts || []), submissionMetadata];

      // Prepare partial update
      const partialUpdate = {
        activitySubmissions: {
          [activityId]: {
            [effectiveStudentId]: {
              currentSubmission: submissionMetadata,
              attempts: newAttempts,
            },
          },
        },
        updatedAt: now.toISOString(),
      };

      if (!roundDoc._updateTime) throw new Error('ROUND_VERSION_REQUIRED');
      const precondition = { updateTime: roundDoc._updateTime };

      try {
        await updateDocumentFields(
          'graduationRounds/' + encodeURIComponent(roundId),
          partialUpdate,
          serverToken,
          [studentSubPath, updatedAtPath],
          precondition
        );
        attemptSucceeded = true;
        finalSubmission = submissionMetadata;
        finalAttempts = newAttempts;
      } catch (writeErr) {
        if (
          writeErr.statusCode === 412 ||
          writeErr.statusCode === 409 ||
          writeErr.message.includes('FAILED_PRECONDITION') ||
          writeErr.message.includes('ALREADY_EXISTS')
        ) {
          retryCount++;
          console.warn(`[submit-activity] Concurrent write detected for ${effectiveStudentId} (attempt ${retryCount}/${MAX_RETRIES}), retrying...`);
          await new Promise(r => setTimeout(r, 60 * retryCount));
          continue;
        }
        throw writeErr;
      }
    }

    if (!attemptSucceeded) {
      return res.status(409).json({
        error: 'CONCURRENT_SUBMISSION_CONFLICT',
        message: 'Xung đột khi ghi nhận bài nộp đồng thời. Vui lòng thử lại.',
      });
    }

    // The submission is already committed. Report audit failure as a partial
    // success so the client does not retry and create an extra attempt.
    const auditId = `log_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    let auditLogged = true;
    try {
      await createDocumentWithPrecondition(
      `graduationRounds/${encodeURIComponent(roundId)}/auditLogs`,
      auditId,
      {
        action: 'STUDENT_SUBMIT_ACTIVITY',
        actorEmail: req.auth.email || effectiveStudentId,
        studentId: effectiveStudentId,
        roundId,
        activityId,
        attempt: finalSubmission.attempt,
        receiptId: finalSubmission.receiptId,
        fileCount: verifiedFiles.length,
        timestamp: new Date().toISOString(),
      },
        serverToken
      );
    } catch (auditErr) {
      auditLogged = false;
      console.error('[submit-activity] Submission committed without audit log:', auditErr.message);
    }

    return res.status(200).json({
      ok: true,
      submission: finalSubmission,
      attempts: finalAttempts,
      receiptId: finalSubmission.receiptId,
      auditLogged,
      auditWarning: auditLogged ? null : 'Bài đã được lưu nhưng nhật ký kiểm toán chưa ghi được.',
    });
  } catch (err) {
    console.error('[submit-activity] Error:', err);
    return res.status(500).json({
      error: 'SUBMISSION_FAILED',
      message: 'Không thể ghi nhận bài nộp: ' + err.message,
    });
  }
}

// ── POST /api/graduation/withdraw-activity ───────────────────────────────────

async function withdrawActivityHandler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await new Promise((resolve, reject) => {
    requireStudentAuth(req, res, err => {
      if (err) reject(err); else resolve();
    });
  }).catch(() => {});

  if (res.headersSent) return;

  // (1) Strictly require trusted serverToken - fail closed without client token fallback
  let serverToken;
  try {
    serverToken = await getServerToken();
  } catch (errAuth) {
    return res.status(503).json({
      error: 'TRUSTED_SERVER_AUTH_REQUIRED',
      message: 'Máy chủ chưa được cấp quyền xác thực nội bộ Firestore: ' + errAuth.message,
    });
  }

  try {
    const { roundId, activityId, studentId: requestedStudentId, attemptNum } = req.body || {};

    if (!roundId || typeof roundId !== 'string') {
      return res.status(400).json({ error: 'MISSING_ROUND_ID', message: 'Thiếu thông tin roundId.' });
    }
    if (!activityId || typeof activityId !== 'string') {
      return res.status(400).json({ error: 'MISSING_ACTIVITY_ID', message: 'Thiếu thông tin activityId.' });
    }

    let effectiveStudentId = req.auth.studentId;
    if (req.auth.isAdmin && requestedStudentId) {
      effectiveStudentId = requestedStudentId.trim();
    } else if (requestedStudentId && req.auth.studentId && requestedStudentId.toUpperCase() !== req.auth.studentId.toUpperCase()) {
      return res.status(403).json({
        error: 'STUDENT_ID_MISMATCH',
        message: 'Bạn chỉ có quyền rút bài của chính tài khoản sinh viên của mình.'
      });
    }

    if (!effectiveStudentId) {
      return res.status(400).json({ error: 'MISSING_STUDENT_ID', message: 'Không thể xác định mã số sinh viên.' });
    }

    // (2) Format Firestore updateMask with escaped backticks
    const studentSubPath = formatFirestoreFieldPath('activitySubmissions', activityId, effectiveStudentId);
    const updatedAtPath = formatFirestoreFieldPath('updatedAt');

    // (3) Optimistic Concurrency Control retry loop
    const MAX_RETRIES = 3;
    let attemptSucceeded = false;
    let retryCount = 0;
    let finalWithdrawnSub = null;
    let finalAttempts = null;

    while (retryCount < MAX_RETRIES && !attemptSucceeded) {
      const roundDoc = await getDocument('graduationRounds/' + encodeURIComponent(roundId), serverToken);
      if (!roundDoc) {
        return res.status(404).json({ error: 'ROUND_NOT_FOUND', message: 'Không tìm thấy đợt tốt nghiệp.' });
      }

      const subEntry = roundDoc.activitySubmissions?.[activityId]?.[effectiveStudentId];
      if (!subEntry || !subEntry.currentSubmission) {
        return res.status(404).json({ error: 'SUBMISSION_NOT_FOUND', message: 'Không tìm thấy bài nộp để rút.' });
      }

      if (subEntry.currentSubmission.status === 'withdrawn') {
        return res.status(400).json({ error: 'ALREADY_WITHDRAWN', message: 'Bài nộp này đã được rút trước đó.' });
      }

      const now = new Date();
      const withdrawnSubmission = {
        ...subEntry.currentSubmission,
        status: 'withdrawn',
        withdrawnAt: now.toISOString(),
        withdrawnBy: req.auth.email || effectiveStudentId,
      };

      const targetAttempt = attemptNum || subEntry.currentSubmission.attempt;
      const updatedAttempts = (subEntry.attempts || []).map(att => {
        if (att.receiptId === withdrawnSubmission.receiptId || (!att.receiptId && att.attempt === targetAttempt)) {
          return {
            ...att,
            status: 'withdrawn',
            withdrawnAt: now.toISOString(),
            withdrawnBy: req.auth.email || effectiveStudentId,
          };
        }
        return att;
      });

      const partialUpdate = {
        activitySubmissions: {
          [activityId]: {
            [effectiveStudentId]: {
              currentSubmission: withdrawnSubmission,
              attempts: updatedAttempts,
            },
          },
        },
        updatedAt: now.toISOString(),
      };

      if (!roundDoc._updateTime) throw new Error('ROUND_VERSION_REQUIRED');
      const precondition = { updateTime: roundDoc._updateTime };

      try {
        await updateDocumentFields(
          'graduationRounds/' + encodeURIComponent(roundId),
          partialUpdate,
          serverToken,
          [studentSubPath, updatedAtPath],
          precondition
        );
        attemptSucceeded = true;
        finalWithdrawnSub = withdrawnSubmission;
        finalAttempts = updatedAttempts;
      } catch (writeErr) {
        if (
          writeErr.statusCode === 412 ||
          writeErr.statusCode === 409 ||
          writeErr.message.includes('FAILED_PRECONDITION')
        ) {
          retryCount++;
          console.warn(`[withdraw-activity] Concurrent write detected (attempt ${retryCount}/${MAX_RETRIES}), retrying...`);
          await new Promise(r => setTimeout(r, 60 * retryCount));
          continue;
        }
        throw writeErr;
      }
    }

    if (!attemptSucceeded) {
      return res.status(409).json({
        error: 'CONCURRENT_WITHDRAW_CONFLICT',
        message: 'Xung đột khi rút bài nộp đồng thời. Vui lòng thử lại.',
      });
    }

    // Read the committed round again before cleanup. This includes the newly
    // withdrawn attempt and any other submissions written concurrently.
    let cleanupRoundDoc = null;
    try {
      cleanupRoundDoc = await getDocument('graduationRounds/' + encodeURIComponent(roundId), serverToken);
    } catch (readErr) {
      console.error('[withdraw] Cannot recheck references before Drive cleanup:', readErr.message);
    }

    // (6) Cleanup Drive files with strict ownership and reference checks.
    const filesToDelete = (finalWithdrawnSub.files || []).filter(
      f => (f.providerFileId || f.fileId) && f.storageProvider === 'google_drive'
    );

    let allDriveCleaned = true;
    let driveErrorMsg = null;

    for (const f of filesToDelete) {
      const fId = f.providerFileId || f.fileId;
      try {
        // Strict guard: verify file is not still referenced in any other non-withdrawn submission in roundDoc
        let hasActiveReference = !cleanupRoundDoc;
        if (cleanupRoundDoc?.activitySubmissions) {
          for (const [actKey, studentMap] of Object.entries(cleanupRoundDoc.activitySubmissions)) {
            if (!studentMap || typeof studentMap !== 'object') continue;
            for (const [stKey, sEntry] of Object.entries(studentMap)) {
              if (!sEntry || typeof sEntry !== 'object') continue;
              if (sEntry.currentSubmission && sEntry.currentSubmission.status !== 'withdrawn') {
                if ((sEntry.currentSubmission.files || []).some(file => file.providerFileId === fId || file.fileId === fId)) {
                  hasActiveReference = true;
                }
              }
              if (Array.isArray(sEntry.attempts)) {
                for (const att of sEntry.attempts) {
                  if (att && att.status !== 'withdrawn') {
                    if ((att.files || []).some(file => file.providerFileId === fId || file.fileId === fId)) {
                      hasActiveReference = true;
                    }
                  }
                }
              }
            }
          }
        }

        if (hasActiveReference) {
          console.warn(`[withdraw] File ${fId} is still referenced elsewhere; skipping Drive trash.`);
          allDriveCleaned = false;
          driveErrorMsg = 'Tệp vẫn đang được tham chiếu trong bài nộp khác.';
          continue;
        }

        // Strict guard: assertOwned and context check on Drive metadata
        const meta = await getDriveFileMetadata(fId);
        if (meta) {
          assertOwned(meta, effectiveStudentId, true, true);
          const appProps = meta.appProperties || {};
          if (appProps.roundId !== roundId || appProps.activityId !== activityId) {
            console.warn(`[withdraw] Context mismatch for file ${fId}; skipping Drive trash.`);
            allDriveCleaned = false;
            driveErrorMsg = 'Ngữ cảnh tệp Drive không khớp.';
            continue;
          }
        }

        const trashed = await trashDriveFile(fId);
        if (trashed) {
          await updateDocumentFields(
            'driveFiles/' + encodeURIComponent(fId),
            { status: 'trashed', trashedAt: new Date().toISOString() },
            serverToken,
            ['status', 'trashedAt']
          );
        } else {
          allDriveCleaned = false;
          driveErrorMsg = 'Google Drive API không thể đưa tệp vào Thùng rác';
        }
      } catch (errTrash) {
        allDriveCleaned = false;
        driveErrorMsg = errTrash.message;
        console.warn('[withdraw] Error trashing file:', fId, errTrash.message);
      }
    }

    // Withdrawal is already committed; do not report a false total failure.
    const auditId = `log_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    let auditLogged = true;
    try {
      await createDocumentWithPrecondition(
      `graduationRounds/${encodeURIComponent(roundId)}/auditLogs`,
      auditId,
      {
        action: 'STUDENT_WITHDRAW_ACTIVITY',
        actorEmail: req.auth.email || effectiveStudentId,
        studentId: effectiveStudentId,
        roundId,
        activityId,
        receiptId: finalWithdrawnSub.receiptId,
        driveCleaned: allDriveCleaned,
        timestamp: new Date().toISOString(),
      },
        serverToken
      );
    } catch (auditErr) {
      auditLogged = false;
      console.error('[withdraw-activity] Withdrawal committed without audit log:', auditErr.message);
    }

    return res.status(200).json({
      ok: true,
      withdrawn: true,
      submission: finalWithdrawnSub,
      attempts: finalAttempts,
      driveCleaned: allDriveCleaned,
      driveWarning: allDriveCleaned ? null : (driveErrorMsg || 'Một số tệp Google Drive chưa được dọn dẹp.'),
      auditLogged,
      auditWarning: auditLogged ? null : 'Bài đã rút nhưng nhật ký kiểm toán chưa ghi được.',
    });
  } catch (err) {
    console.error('[withdraw-activity] Error:', err);
    return res.status(500).json({
      error: 'WITHDRAW_FAILED',
      message: 'Không thể rút bài nộp: ' + err.message,
    });
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

    if (urlPath === '/api/graduation/complete') {
      return await completeUploadHandler(req, res);
    }

    if (urlPath === '/api/graduation/cleanup' || urlPath === '/api/graduation/delete-file') {
      return await cleanupHandler(req, res);
    }

    if (urlPath === '/api/graduation/submit-activity') {
      return await submitActivityHandler(req, res);
    }

    if (urlPath === '/api/graduation/withdraw-activity') {
      return await withdrawActivityHandler(req, res);
    }

    if (urlPath === '/api/graduation/supervisor-portrait') {
      return await uploadSupervisorPortraitHandler(req, res);
    }

    if (urlPath === '/api/graduation/delete-supervisor-portrait') {
      return await deleteSupervisorPortraitHandler(req, res);
    }

    if (
      urlPath === '/api/graduation/admin/verify-drive-folder' ||
      urlPath === '/api/graduation/drive/validate-root-folder'
    ) {
      return await validateRootFolderHandler(req, res);
    }

    if (urlPath === '/api/graduation/admin/save-drive-config') {
      return await saveDriveConfigHandler(req, res);
    }

    if (urlPath === '/api/graduation/drive/get-or-create-folder') {
      return await getOrCreateFolderHandler(req, res);
    }

    setCORSHeaders(req, res);
    return res.status(404).json({ error: 'Not found' });
  }
);

// Test exports for internal integration tests
exports.submitActivityHandler = submitActivityHandler;
exports.withdrawActivityHandler = withdrawActivityHandler;
exports.resolveTargetDriveFolder = resolveTargetDriveFolder;
exports.validateRootFolderHandler = validateRootFolderHandler;
exports.saveDriveConfigHandler = saveDriveConfigHandler;
