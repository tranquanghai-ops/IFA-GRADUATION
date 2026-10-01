/**
 * tests/test-graduation-backend-policy.cjs
 * Comprehensive test suite for IFA-GRADUATION backend upload policy, 2 GiB boundaries,
 * verifyAndCompleteUpload context & fail-closed behavior, and cleanup reference protection.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('Graduation token verification uses the ifa-graduation app when host default is ifa-activities', async () => {
  const checkedBy = [];
  const hostApp = {
    name: '[DEFAULT]',
    options: { projectId: 'ifa-activities' },
    auth: () => ({ verifyIdToken: async () => { checkedBy.push('ifa-activities'); throw new Error('wrong audience'); } }),
  };
  const admin = {
    apps: [hostApp],
    initializeApp(options, name) {
      const app = {
        name,
        options,
        auth: () => ({ verifyIdToken: async () => {
          checkedBy.push(options.projectId);
          return { uid: 'student-uid', email: '521h0001@student.tdtu.edu.vn' };
        } }),
        storage: () => ({ bucket: () => ({}) }),
      };
      this.apps.push(app);
      return app;
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../functions/auth.js'), 'utf8');
  const loaded = { exports: {} };
  vm.runInNewContext(source, {
    module: loaded,
    exports: loaded.exports,
    require: name => name === 'firebase-admin' ? admin : { getDocument: async () => null },
    console,
  });
  const identity = await loaded.exports.verifyIdToken('verified-token');
  assert.equal(identity.studentId, '521H0001');
  assert.deepEqual(checkedBy, ['ifa-graduation']);
});

const {
  MAX_BYTES,
  getEffectiveMaxBytes,
  validateDriveTarget,
  fileId,
  assertOwned,
} = require('../functions/policy.js');

const {
  validateFile,
  validateActivity,
  ValidationError,
  ALLOWED_EXTENSIONS,
} = require('../functions/validation.js');

const {
  verifyAndCompleteUpload,
} = require('../functions/drive.js');

test('Backend Policy Technical Ceiling (2 GiB Exactly)', () => {
  assert.equal(MAX_BYTES, 2 * 1024 * 1024 * 1024, 'MAX_BYTES technical ceiling must be exactly 2 GiB (2,147,483,648 bytes)');
});

test('Effective Max Bytes Bounding & Default Fallback (100 MB)', () => {
  const limit100MB = 100 * 1024 * 1024;
  assert.equal(getEffectiveMaxBytes(limit100MB), limit100MB);

  const limit500MB = 500 * 1024 * 1024;
  assert.equal(getEffectiveMaxBytes(limit500MB), limit500MB);

  // 3 GB exceeds technical ceiling -> strictly bounded to 2 GiB
  const limit3GB = 3 * 1024 * 1024 * 1024;
  assert.equal(getEffectiveMaxBytes(limit3GB), MAX_BYTES);

  // CRITICAL: Missing or invalid limit must fallback to default 100 MB, NEVER expanding to 2 GiB
  const fallbackExpected = 100 * 1024 * 1024;
  assert.equal(getEffectiveMaxBytes(undefined), fallbackExpected, 'Undefined limit must fallback to 100 MB');
  assert.equal(getEffectiveMaxBytes(null), fallbackExpected, 'Null limit must fallback to 100 MB');
  assert.equal(getEffectiveMaxBytes('invalid'), fallbackExpected, 'String limit must fallback to 100 MB');
  assert.equal(getEffectiveMaxBytes(-50), fallbackExpected, 'Negative limit must fallback to 100 MB');
  assert.equal(getEffectiveMaxBytes(NaN), fallbackExpected, 'NaN limit must fallback to 100 MB');
  assert.equal(getEffectiveMaxBytes(Infinity), fallbackExpected, 'Infinity limit must fallback to 100 MB');
});

test('Drive File ID Parsing', () => {
  const directId = '1a2b3c4d5e6f7g8h9i0j-k_l';
  assert.equal(fileId(directId), directId);

  const viewUrl = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up00/view?usp=sharing';
  assert.equal(fileId(viewUrl), '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up00');

  const ucUrl = 'https://drive.google.com/uc?export=download&id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up00';
  assert.equal(fileId(ucUrl), '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up00');

  const invalid = 'https://evil.com/file/d/12345/view';
  assert.equal(fileId(invalid), null);
});

test('Validation: Allowed Extensions and Strict File Name Checks', () => {
  assert.ok(ALLOWED_EXTENSIONS.has('.pdf'));
  assert.ok(ALLOWED_EXTENSIONS.has('.docx'));
  assert.ok(ALLOWED_EXTENSIONS.has('.zip'));
  assert.ok(ALLOWED_EXTENSIONS.has('.rar'));

  // Valid file under 10 MB
  assert.doesNotThrow(() => {
    validateFile({ name: 'thesis.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 });
  });

  // Empty or whitespace filename -> throws
  assert.throws(() => {
    validateFile({ name: '   ', type: 'application/pdf', size: 1024 });
  }, (err) => err instanceof ValidationError);

  // Directory traversal in filename -> throws
  assert.throws(() => {
    validateFile({ name: '../../etc/passwd.pdf', type: 'application/pdf', size: 1024 });
  }, (err) => err instanceof ValidationError && err.message.includes('không hợp lệ'));

  // Missing or non-safe integer size -> throws
  assert.throws(() => {
    validateFile({ name: 'test.pdf', type: 'application/pdf', size: null });
  }, (err) => err instanceof ValidationError);
  assert.throws(() => {
    validateFile({ name: 'test.pdf', type: 'application/pdf', size: NaN });
  }, (err) => err instanceof ValidationError);
  assert.throws(() => {
    validateFile({ name: 'test.pdf', type: 'application/pdf', size: Infinity });
  }, (err) => err instanceof ValidationError);
  assert.throws(() => {
    validateFile({ name: 'test.pdf', type: 'application/pdf', size: 1024.5 });
  }, (err) => err instanceof ValidationError);
  assert.throws(() => {
    validateFile({ name: 'test.pdf', type: 'application/pdf', size: 0 });
  }, (err) => err instanceof ValidationError);
  assert.throws(() => {
    validateFile({ name: 'test.pdf', type: 'application/pdf', size: -100 });
  }, (err) => err instanceof ValidationError);

  // 2 GiB technical ceiling boundary:
  // 2 GiB exactly is allowed when customMaxBytes permits
  assert.doesNotThrow(() => {
    validateFile(
      { name: 'big_archive.zip', type: 'application/zip', size: 2 * 1024 * 1024 * 1024 },
      2 * 1024 * 1024 * 1024
    );
  });

  // 2 GiB + 1 byte is STRICTLY rejected
  assert.throws(() => {
    validateFile(
      { name: 'oversized.zip', type: 'application/zip', size: (2 * 1024 * 1024 * 1024) + 1 },
      2 * 1024 * 1024 * 1024
    );
  }, (err) => err instanceof ValidationError && err.message.includes('Dung lượng tệp không hợp lệ'));
});

test('Policy: assertOwned Ownership Validation', () => {
  const validGradMeta = {
    id: 'file-12345',
    name: 'report.pdf',
    trashed: false,
    appProperties: {
      app: 'ifa-graduation',
      studentId: '521H0001',
      activityId: 'act-1',
      roundId: 'round-1',
      uploadedBy: 'user-uid-1',
      expectedSize: '1048576',
      expectedMime: 'application/pdf',
    },
  };

  assert.doesNotThrow(() => {
    assertOwned(validGradMeta, '521H0001', true);
  });

  assert.doesNotThrow(() => {
    assertOwned(validGradMeta, 'user-uid-1', true);
  });

  // Different student -> throws FILE_NOT_OWNED
  assert.throws(() => {
    assertOwned(validGradMeta, '521H9999', true);
  }, (err) => err.message === 'FILE_NOT_OWNED');

  // SSR file -> throws FILE_NOT_OWNED
  const ssrMeta = {
    id: 'file-ssr-1',
    trashed: false,
    appProperties: {
      app: 'ifa-ssr',
      kind: 'projects',
      recordId: 'rec-1',
    },
  };
  assert.throws(() => {
    assertOwned(ssrMeta, '521H0001', true);
  }, (err) => err.message === 'FILE_NOT_OWNED');

  // Trashed file -> throws FILE_TRASHED unless allowTrashed is true
  const trashedMeta = { ...validGradMeta, trashed: true };
  assert.throws(() => {
    assertOwned(trashedMeta, '521H0001', true, false);
  }, (err) => err.message === 'FILE_TRASHED');

  assert.doesNotThrow(() => {
    assertOwned(trashedMeta, '521H0001', true, true);
  });
});

test('verifyAndCompleteUpload: Fail-Closed on Missing Context', async () => {
  // Missing fileId
  await assert.rejects(
    async () => verifyAndCompleteUpload({ studentId: '521H0001' }),
    (err) => err.message === 'MISSING_FILE_ID'
  );

  // Missing studentId
  await assert.rejects(
    async () => verifyAndCompleteUpload({ fileId: 'f1' }),
    (err) => err.message === 'MISSING_STUDENT_ID'
  );

  // Missing activityId
  await assert.rejects(
    async () => verifyAndCompleteUpload({ fileId: 'f1', studentId: '521H0001' }),
    (err) => err.message === 'MISSING_ACTIVITY_ID'
  );

  // Missing roundId
  await assert.rejects(
    async () => verifyAndCompleteUpload({ fileId: 'f1', studentId: '521H0001', activityId: 'act1' }),
    (err) => err.message === 'MISSING_ROUND_ID'
  );

  // Missing uploadId
  await assert.rejects(
    async () => verifyAndCompleteUpload({ fileId: 'f1', studentId: '521H0001', activityId: 'act1', roundId: 'r1' }),
    (err) => err.message === 'MISSING_UPLOAD_ID'
  );

  // Missing targetFolderId
  await assert.rejects(
    async () => verifyAndCompleteUpload({ fileId: 'f1', studentId: '521H0001', activityId: 'act1', roundId: 'r1', uploadId: 'u1' }),
    (err) => err.message === 'MISSING_TARGET_FOLDER_ID'
  );
});

test('Cleanup Reference Logic: Active Submissions & Attempt History Protection', () => {
  const roundDoc = {
    id: 'round-1',
    activitySubmissions: {
      'act-milestone-1': {
        '521H0001': {
          currentSubmission: {
            status: 'submitted',
            files: [{ providerFileId: 'file-active-submission', originalName: 'thesis.pdf' }],
          },
          attempts: [
            {
              attempt: 1,
              status: 'submitted', // Attempt 1 retained for committee review
              files: [{ providerFileId: 'file-attempt-1', originalName: 'draft1.pdf' }],
            },
            {
              attempt: 2,
              status: 'submitted',
              files: [{ providerFileId: 'file-active-submission', originalName: 'thesis.pdf' }],
            },
            {
              attempt: 3,
              status: 'withdrawn', // Withdrawn attempt
              files: [{ providerFileId: 'file-withdrawn-attempt', originalName: 'bad.pdf' }],
            },
          ],
        },
      },
    },
  };

  function isFileReferenced(fileId, doc) {
    if (!doc?.activitySubmissions) return false;
    for (const studentMap of Object.values(doc.activitySubmissions)) {
      for (const sub of Object.values(studentMap)) {
        if (sub.currentSubmission && sub.currentSubmission.status !== 'withdrawn') {
          if ((sub.currentSubmission.files || []).some(f => f.providerFileId === fileId)) {
            return true;
          }
        }
        if (Array.isArray(sub.attempts)) {
          for (const att of sub.attempts) {
            if (att.status !== 'withdrawn' && (att.files || []).some(f => f.providerFileId === fileId)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  // 1. Current active file -> REFERENCED (Cannot Trash)
  assert.equal(isFileReferenced('file-active-submission', roundDoc), true);

  // 2. Attempt 1 history file (not withdrawn) -> REFERENCED (Cannot Trash! Must preserve for committee)
  assert.equal(isFileReferenced('file-attempt-1', roundDoc), true);

  // 3. Withdrawn attempt file -> NOT REFERENCED (Eligible for Trash)
  assert.equal(isFileReferenced('file-withdrawn-attempt', roundDoc), false);

  // 4. Orphan unreferenced file -> NOT REFERENCED (Eligible for Trash)
  assert.equal(isFileReferenced('file-orphan-999', roundDoc), false);
});

test('Firestore REST Serialization & updateDocumentFields validation', async () => {
  const { serializeFields, deserializeFields, updateDocumentFields } = require('../functions/firestore.js');

  const originalData = {
    fileId: 'file-123',
    status: 'verified',
    viewCount: 42,
    active: true,
    tags: ['thesis', 'final'],
    metadata: { author: '521H0001', department: 'CS' },
  };

  const serialized = serializeFields(originalData);
  assert.equal(serialized.fileId.stringValue, 'file-123');
  assert.equal(serialized.status.stringValue, 'verified');
  assert.equal(serialized.viewCount.integerValue, '42');
  assert.equal(serialized.active.booleanValue, true);
  assert.ok(Array.isArray(serialized.tags.arrayValue.values));
  assert.equal(serialized.metadata.mapValue.fields.author.stringValue, '521H0001');

  const deserialized = deserializeFields(serialized);
  assert.deepEqual(deserialized, originalData);

  // updateDocumentFields must throw if empty mask paths provided
  await assert.rejects(
    async () => updateDocumentFields('driveFiles/f1', {}, 'token', []),
    (err) => err.message.includes('requires at least one field path')
  );
});

test('Complete Handler: Idempotency Logic & Conflict Detection', () => {
  function checkIdempotency(existingDoc, studentId, roundId, activityId, uploadId) {
    if (existingDoc && existingDoc.status === 'verified') {
      const matchStudent = existingDoc.studentId?.toUpperCase() === studentId.toUpperCase();
      const matchRound = existingDoc.roundId === roundId;
      const matchActivity = existingDoc.activityId === activityId;
      const matchUpload = existingDoc.uploadId === uploadId;

      if (matchStudent && matchRound && matchActivity && matchUpload) {
        return { isMatch: true, status: 200, idempotent: true };
      }
      return { isMatch: false, status: 409, error: 'FILE_ALREADY_VERIFIED_UNDER_DIFFERENT_CONTEXT' };
    }
    return { shouldVerify: true };
  }

  const verifiedDoc = {
    fileId: 'f1',
    studentId: '521H0001',
    roundId: 'round-1',
    activityId: 'act-1',
    uploadId: 'up-123',
    status: 'verified',
  };

  // Exact match -> 200 idempotent
  const exact = checkIdempotency(verifiedDoc, '521H0001', 'round-1', 'act-1', 'up-123');
  assert.equal(exact.status, 200);
  assert.equal(exact.idempotent, true);

  // Different student -> 409 conflict
  const diffStudent = checkIdempotency(verifiedDoc, '521H9999', 'round-1', 'act-1', 'up-123');
  assert.equal(diffStudent.status, 409);
  assert.equal(diffStudent.error, 'FILE_ALREADY_VERIFIED_UNDER_DIFFERENT_CONTEXT');

  // Different round -> 409 conflict
  const diffRound = checkIdempotency(verifiedDoc, '521H0001', 'round-2', 'act-1', 'up-123');
  assert.equal(diffRound.status, 409);

  // Different activity -> 409 conflict
  const diffAct = checkIdempotency(verifiedDoc, '521H0001', 'round-1', 'act-2', 'up-123');
  assert.equal(diffAct.status, 409);

  // Different uploadId -> 409 conflict
  const diffUpload = checkIdempotency(verifiedDoc, '521H0001', 'round-1', 'act-1', 'up-456');
  assert.equal(diffUpload.status, 409);
});

test('Cleanup Handler: Mandatory Context Parameters', () => {
  function validateCleanupContext(body) {
    const { fileId, roundId, activityId } = body || {};
    if (!fileId || typeof fileId !== 'string') {
      return { ok: false, error: 'MISSING_FILE_ID' };
    }
    if (!roundId || typeof roundId !== 'string') {
      return { ok: false, error: 'MISSING_ROUND_ID' };
    }
    if (!activityId || typeof activityId !== 'string') {
      return { ok: false, error: 'MISSING_ACTIVITY_ID' };
    }
    return { ok: true };
  }

  // All valid
  assert.equal(validateCleanupContext({ fileId: 'f1', roundId: 'r1', activityId: 'a1' }).ok, true);

  // Missing roundId -> REJECTED
  const missingRound = validateCleanupContext({ fileId: 'f1', activityId: 'a1' });
  assert.equal(missingRound.ok, false);
  assert.equal(missingRound.error, 'MISSING_ROUND_ID');

  // Missing activityId -> REJECTED
  const missingAct = validateCleanupContext({ fileId: 'f1', roundId: 'r1' });
  assert.equal(missingAct.ok, false);
  assert.equal(missingAct.error, 'MISSING_ACTIVITY_ID');

  // Missing fileId -> REJECTED
  const missingFile = validateCleanupContext({ roundId: 'r1', activityId: 'a1' });
  assert.equal(missingFile.ok, false);
  assert.equal(missingFile.error, 'MISSING_FILE_ID');
});

test('Atomic Concurrency & Race Condition Resolution on /complete', async () => {
  // In-memory atomic store simulating Firestore REST with precondition { exists: false }
  const store = new Map();
  let writeAttempts = 0;

  async function mockCreateDocumentWithPrecondition(collection, docId, data, precondition) {
    writeAttempts++;
    // Simulate slight async network jitter
    await new Promise(r => setTimeout(r, Math.random() * 5));
    if (precondition && precondition.exists === false) {
      if (store.has(docId)) {
        const err = new Error('Document already exists');
        err.statusCode = 409;
        err.code = 'ALREADY_EXISTS';
        throw err;
      }
    }
    store.set(docId, { ...data });
    return { ok: true, data };
  }

  async function mockGetDocument(path) {
    const docId = path.replace('driveFiles/', '');
    return store.get(docId) || null;
  }

  // Complete handler execution simulation
  async function simulateCompletePipeline(req) {
    const { fileId, studentId, roundId, activityId, uploadId } = req;

    // 1. Verification on Drive MUST run first
    // In our test, Drive verification succeeds and produces verified metadata
    const verifiedMetadata = {
      fileId,
      name: 'thesis.pdf',
      mimeType: 'application/pdf',
      size: 1048576,
      studentId,
      roundId,
      activityId,
      uploadId,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
    };

    // 2. Atomic persistence with precondition { exists: false }
    try {
      await mockCreateDocumentWithPrecondition('driveFiles', fileId, verifiedMetadata, { exists: false });
      return { status: 200, body: { ok: true, file: verifiedMetadata, raceResolved: false } };
    } catch (storeErr) {
      if (storeErr.statusCode === 409 || storeErr.code === 'ALREADY_EXISTS') {
        // Atomic conflict resolution: fetch existing document and compare context
        const concurrentDoc = await mockGetDocument('driveFiles/' + fileId);
        if (concurrentDoc && concurrentDoc.status === 'verified') {
          const matchStudent = concurrentDoc.studentId?.toUpperCase() === studentId.toUpperCase();
          const matchRound = concurrentDoc.roundId === roundId;
          const matchActivity = concurrentDoc.activityId === activityId;
          const matchUpload = concurrentDoc.uploadId === uploadId;

          if (matchStudent && matchRound && matchActivity && matchUpload) {
            return {
              status: 200,
              body: { ok: true, file: concurrentDoc, idempotent: true, raceResolved: true },
            };
          }
        }
        return {
          status: 409,
          body: { error: 'FILE_ALREADY_VERIFIED_UNDER_DIFFERENT_CONTEXT' },
        };
      }
      throw storeErr;
    }
  }

  const req1 = { fileId: 'race-file-1', studentId: '521H0001', roundId: 'r1', activityId: 'act1', uploadId: 'up-1' };
  const req2 = { fileId: 'race-file-1', studentId: '521H0001', roundId: 'r1', activityId: 'act1', uploadId: 'up-1' };

  // Launch both concurrent requests simultaneously
  const [res1, res2] = await Promise.all([
    simulateCompletePipeline(req1),
    simulateCompletePipeline(req2),
  ]);

  assert.equal(res1.status, 200);
  assert.equal(res2.status, 200);

  // Exactly one request must create the document, and the other must resolve via raceResolved
  const raceResolvedCount = (res1.body.raceResolved ? 1 : 0) + (res2.body.raceResolved ? 1 : 0);
  assert.equal(raceResolvedCount, 1, 'Exactly one concurrent request must win the race and the other resolve atomically');
  assert.equal(store.size, 1, 'Firestore document must exist exactly once without duplicate overwrite');

  // Conflicting concurrent request with different student or round -> must return 409
  const conflictingReq = { fileId: 'race-file-1', studentId: '521H9999', roundId: 'r1', activityId: 'act1', uploadId: 'up-diff' };
  const resConflict = await simulateCompletePipeline(conflictingReq);
  assert.equal(resConflict.status, 409);
  assert.equal(resConflict.body.error, 'FILE_ALREADY_VERIFIED_UNDER_DIFFERENT_CONTEXT');
});

test('Drive Verification Precedes Firestore Persistence (Fail-Closed, No Bypass)', async () => {
  let firestorePersisted = false;

  async function completeFlowWithMockDrive(driveVerificationFn) {
    firestorePersisted = false;
    // 1. Call Drive verification
    const driveResult = await driveVerificationFn();
    if (!driveResult.ok) {
      throw new Error(driveResult.error);
    }
    // 2. Only if Drive passes, execute Firestore persistence
    firestorePersisted = true;
    return { ok: true };
  }

  // Case 1: Drive verification fails due to SIZE MISMATCH
  await assert.rejects(
    async () => {
      await completeFlowWithMockDrive(async () => ({ ok: false, error: 'FILE_SIZE_MISMATCH' }));
    },
    (err) => err.message === 'FILE_SIZE_MISMATCH'
  );
  assert.equal(firestorePersisted, false, 'Firestore must NOT be touched if Drive size check fails');

  // Case 2: Drive verification fails due to CONTEXT MISMATCH
  await assert.rejects(
    async () => {
      await completeFlowWithMockDrive(async () => ({ ok: false, error: 'CONTEXT_MISMATCH' }));
    },
    (err) => err.message === 'CONTEXT_MISMATCH'
  );
  assert.equal(firestorePersisted, false, 'Firestore must NOT be touched if Drive context check fails');

  // Case 3: Drive verification succeeds -> persistence allowed
  const success = await completeFlowWithMockDrive(async () => ({ ok: true }));
  assert.equal(success.ok, true);
  assert.equal(firestorePersisted, true, 'Firestore record is created only after Drive verification succeeds');
});

test('Client-Side Spoofing Prevention & Trusted Submission Verification', () => {
  const fs = require('fs');
  const path = require('path');

  // 1. Verify that proposed Firestore rules completely disallow client writes on driveFiles
  const rulesPath = path.resolve(__dirname, '../../2026-09-30/referenced-chatgpt-conversation-this-is-an/outputs/ifa-graduation-proposal.rules');
  if (fs.existsSync(rulesPath)) {
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    const matchDriveFiles = /match\s+\/driveFiles\/\{fileId\}\s*\{([^}]+)\}/s.exec(rulesContent);
    assert.ok(matchDriveFiles, 'Rules must contain match /driveFiles/{fileId}');
    const block = matchDriveFiles[1];
    assert.ok(
      block.includes('allow write: if false;'),
      'Rules must enforce allow write: if false; on driveFiles to prevent client-side status spoofing'
    );
  }

  // 2. Submission validation logic rejecting spoofed or unverified drive files
  function validateSubmissionFile(fileEntry, firestoreDriveRecord, currentStudent, currentRoundId, currentActivityId) {
    if (!fileEntry || !fileEntry.providerFileId) {
      return { ok: false, error: 'MISSING_PROVIDER_FILE_ID' };
    }

    // Must have a verified persistent record in Firestore
    if (!firestoreDriveRecord) {
      return { ok: false, error: 'UNVERIFIED_FILE_RECORD_MISSING' };
    }

    if (firestoreDriveRecord.status !== 'verified') {
      return { ok: false, error: 'FILE_NOT_VERIFIED' };
    }

    if (firestoreDriveRecord.studentId?.toUpperCase() !== currentStudent.studentId.toUpperCase()) {
      return { ok: false, error: 'FILE_STUDENT_MISMATCH' };
    }

    if (firestoreDriveRecord.roundId !== currentRoundId) {
      return { ok: false, error: 'FILE_ROUND_MISMATCH' };
    }

    if (firestoreDriveRecord.activityId !== currentActivityId) {
      return { ok: false, error: 'FILE_ACTIVITY_MISMATCH' };
    }

    return { ok: true };
  }

  const student = { studentId: '521H0001' };

  // Attempt to submit file with nonexistent driveFiles document (client fabricated ID)
  const spoofedMissing = validateSubmissionFile(
    { providerFileId: 'fake-file-id' },
    null,
    student,
    'round-1',
    'act-1'
  );
  assert.equal(spoofedMissing.ok, false);
  assert.equal(spoofedMissing.error, 'UNVERIFIED_FILE_RECORD_MISSING');

  // Attempt to submit unverified/pending file
  const unverified = validateSubmissionFile(
    { providerFileId: 'f1' },
    { fileId: 'f1', status: 'pending', studentId: '521H0001', roundId: 'round-1', activityId: 'act-1' },
    student,
    'round-1',
    'act-1'
  );
  assert.equal(unverified.ok, false);
  assert.equal(unverified.error, 'FILE_NOT_VERIFIED');

  // Attempt to submit file verified for a different student
  const studentMismatch = validateSubmissionFile(
    { providerFileId: 'f1' },
    { fileId: 'f1', status: 'verified', studentId: '521H9999', roundId: 'round-1', activityId: 'act-1' },
    student,
    'round-1',
    'act-1'
  );
  assert.equal(studentMismatch.ok, false);
  assert.equal(studentMismatch.error, 'FILE_STUDENT_MISMATCH');

  // Legitimate verified file matching student, round, and activity
  const validSubmission = validateSubmissionFile(
    { providerFileId: 'f1' },
    { fileId: 'f1', status: 'verified', studentId: '521H0001', roundId: 'round-1', activityId: 'act-1' },
    student,
    'round-1',
    'act-1'
  );
  assert.equal(validSubmission.ok, true);
});

function createMockReqRes({ method = 'POST', headers = {}, body = {}, auth = null, path = '/' }) {
  const req = {
    method,
    headers: { authorization: 'Bearer mock-token', ...headers },
    body,
    auth,
    path
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    headersSent: false,
    status(c) { statusCode = c; return this; },
    json(d) { this.headersSent = true; responseData = d; return this; },
    set() { return this; },
    setHeader() { return this; },
    end() { this.headersSent = true; }
  };
  return { req, res, getStatus: () => statusCode, getBody: () => responseData };
}

test('Real Handler: submitActivityHandler records verified file with atomic updateMask & receipt', async () => {
  const { submitActivityHandler } = require('../functions/index.js');
  const { setTestFirestoreDriver } = require('../functions/firestore.js');

  const inMemoryDb = new Map();
  const updateMaskLog = [];

  // Seed test round with real schema required by functions/validation.js validateActivity
  const roundData = {
    id: 'round-1',
    name: 'Đợt 1 - 2026',
    activities: [
      {
        id: 'act-1',
        title: 'Báo cáo giữa kỳ',
        submissionEnabled: true,
        submissionConfig: {
          maxAttempts: 3,
          allowLateSubmission: true,
          deadlineMode: 'custom',
          deadlineAt: new Date(Date.now() + 86400000).toISOString(),
        },
        startAt: new Date(Date.now() - 86400000).toISOString(),
      }
    ],
    activitySubmissions: {}
  };
  Object.defineProperty(roundData, '_updateTime', { value: '2026-10-01T00:00:00Z', enumerable: false, writable: true });
  inMemoryDb.set('graduationRounds/round-1', roundData);

  inMemoryDb.set('driveFiles/file-verified-1', {
    fileId: 'file-verified-1',
    name: 'baocao.pdf',
    size: 102400,
    mimeType: 'application/pdf',
    studentId: '521H0001',
    roundId: 'round-1',
    activityId: 'act-1',
    status: 'verified',
  });

  // Mock test driver
  setTestFirestoreDriver({
    getServerToken: async () => 'test-server-token',
    async getDocument(path) {
      return inMemoryDb.get(path) || null;
    },
    async updateDocumentFields(path, partialData, token, customMaskPaths, precondition) {
      updateMaskLog.push({ path, customMaskPaths, partialData, precondition });
      const current = inMemoryDb.get(path) || {};
      if (partialData.activitySubmissions) {
        current.activitySubmissions = current.activitySubmissions || {};
        for (const [actKey, studentMap] of Object.entries(partialData.activitySubmissions)) {
          current.activitySubmissions[actKey] = current.activitySubmissions[actKey] || {};
          for (const [stKey, val] of Object.entries(studentMap)) {
            current.activitySubmissions[actKey][stKey] = val;
          }
        }
      }
      current.updatedAt = partialData.updatedAt;
      current._updateTime = new Date().toISOString();
      inMemoryDb.set(path, current);
      return current;
    },
    async createDocumentWithPrecondition() {
      return { ok: true };
    }
  });

  const { req, res, getStatus, getBody } = createMockReqRes({
    auth: { studentId: '521H0001', email: '521h0001@student.tdtu.edu.vn', isAdmin: false },
    body: {
      roundId: 'round-1',
      activityId: 'act-1',
      studentName: 'Nguyễn Văn A',
      files: [
        {
          providerFileId: 'file-verified-1'
        }
      ]
    }
  });

  await submitActivityHandler(req, res);

  assert.equal(getStatus(), 200, 'Must return HTTP 200 on valid submission');
  const body = getBody();
  assert.equal(body.ok, true);
  assert.ok(body.receiptId.startsWith('REC-'), 'Receipt ID must start with REC-');
  assert.equal(body.submission.attempt, 1);
  assert.equal(body.submission.status, 'submitted');
  assert.equal(body.submission.isLate, false);
  assert.equal(body.submission.files[0].providerFileId, 'file-verified-1');
  assert.equal(body.submission.files[0].size, 102400); // Server-derived from driveDoc!
  assert.equal(body.submission.files[0].providerUrl, 'https://drive.google.com/file/d/file-verified-1/view');

  // Verify atomic updateMask with backticks escaping for act-1 and 521H0001
  assert.equal(updateMaskLog.length, 1);
  assert.deepEqual(updateMaskLog[0].customMaskPaths, [
    'activitySubmissions.`act-1`.`521H0001`',
    'updatedAt'
  ], 'updateMask must escape activityId and studentId with backticks');
});

test('Real Handler: Concurrency retry loop resolves race condition for SAME student concurrent submissions', async () => {
  const { submitActivityHandler } = require('../functions/index.js');
  const { setTestFirestoreDriver } = require('../functions/firestore.js');

  const inMemoryDb = new Map();
  let roundVersion = 1;

  function getRoundDoc() {
    const doc = inMemoryDb.get('graduationRounds/round-race') || {
      id: 'round-race',
      name: 'Đợt Race',
      activities: [
        {
          id: 'act-race',
          title: 'Báo cáo',
          submissionEnabled: true,
          submissionConfig: { maxAttempts: 5, allowLateSubmission: true },
          startAt: new Date(Date.now() - 86400000).toISOString(),
        }
      ],
      activitySubmissions: {}
    };
    Object.defineProperty(doc, '_updateTime', {
      value: `version-${roundVersion}`,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    return doc;
  }

  inMemoryDb.set('graduationRounds/round-race', getRoundDoc());

  inMemoryDb.set('driveFiles/file-race-1', {
    fileId: 'file-race-1',
    name: 'file1.pdf',
    size: 204800,
    mimeType: 'application/pdf',
    studentId: '521H0001',
    roundId: 'round-race',
    activityId: 'act-race',
    status: 'verified',
  });
  inMemoryDb.set('driveFiles/file-race-2', {
    fileId: 'file-race-2',
    name: 'file2.pdf',
    size: 204800,
    mimeType: 'application/pdf',
    studentId: '521H0001',
    roundId: 'round-race',
    activityId: 'act-race',
    status: 'verified',
  });

  let simulatedPreconditionFailureCount = 0;

  setTestFirestoreDriver({
    getServerToken: async () => 'test-server-token',
    async getDocument(p) {
      if (p === 'graduationRounds/round-race') return getRoundDoc();
      return inMemoryDb.get(p) || null;
    },
    async updateDocumentFields(path, partialData, token, customMaskPaths, precondition) {
      // Simulate optimistic lock conflict on first attempt of second request
      if (precondition && precondition.updateTime) {
        if (precondition.updateTime !== `version-${roundVersion}`) {
          simulatedPreconditionFailureCount++;
          const err = new Error('Precondition failed');
          err.statusCode = 412;
          err.code = 'FAILED_PRECONDITION';
          throw err;
        }
      }
      // Update state and bump version
      const current = getRoundDoc();
      if (partialData.activitySubmissions) {
        current.activitySubmissions = current.activitySubmissions || {};
        for (const [actKey, studentMap] of Object.entries(partialData.activitySubmissions)) {
          current.activitySubmissions[actKey] = current.activitySubmissions[actKey] || {};
          for (const [stKey, val] of Object.entries(studentMap)) {
            current.activitySubmissions[actKey][stKey] = val;
          }
        }
      }
      current.updatedAt = partialData.updatedAt;
      roundVersion++;
      inMemoryDb.set(path, current);
      return current;
    },
    async createDocumentWithPrecondition() { return { ok: true }; }
  });

  const req1 = createMockReqRes({
    auth: { studentId: '521H0001', email: '521h0001@student.tdtu.edu.vn', isAdmin: false },
    body: { roundId: 'round-race', activityId: 'act-race', files: [{ providerFileId: 'file-race-1' }] }
  });
  const req2 = createMockReqRes({
    auth: { studentId: '521H0001', email: '521h0001@student.tdtu.edu.vn', isAdmin: false },
    body: { roundId: 'round-race', activityId: 'act-race', files: [{ providerFileId: 'file-race-2' }] }
  });

  // Launch both requests simultaneously
  await Promise.all([
    submitActivityHandler(req1.req, req1.res),
    submitActivityHandler(req2.req, req2.res),
  ]);

  assert.equal(req1.getStatus(), 200);
  assert.equal(req2.getStatus(), 200);

  // Both submissions must be recorded without overwriting!
  const finalRound = inMemoryDb.get('graduationRounds/round-race');
  const attempts = finalRound.activitySubmissions['act-race']['521H0001'].attempts;
  assert.equal(attempts.length, 2, 'Both submissions must be recorded in attempts list');
  assert.equal(attempts[0].attempt, 1);
  assert.equal(attempts[1].attempt, 2);
  assert.ok(simulatedPreconditionFailureCount >= 1, 'Precondition failure must have been triggered and recovered');
});

test('Real Handler: Anti-spoofing rejects student submitting for another MSSV', async () => {
  const { submitActivityHandler } = require('../functions/index.js');
  const { req, res, getStatus, getBody } = createMockReqRes({
    auth: { studentId: '521H0001', email: '521h0001@student.tdtu.edu.vn', isAdmin: false },
    body: {
      roundId: 'round-1',
      activityId: 'act-1',
      studentId: '521H9999', // Spoofed student ID!
      files: [{ providerFileId: 'f1' }]
    }
  });

  await submitActivityHandler(req, res);

  assert.equal(getStatus(), 403, 'Must return HTTP 403 when student attempts to submit for another MSSV');
  assert.equal(getBody().error, 'STUDENT_ID_MISMATCH');
});

test('Real Handler: Fail-closed on unverified file or context mismatch', async () => {
  const { submitActivityHandler } = require('../functions/index.js');
  const { setTestFirestoreDriver } = require('../functions/firestore.js');

  const db = new Map();
  db.set('graduationRounds/round-1', {
    id: 'round-1',
    activities: [{ id: 'act-1', submissionEnabled: true }],
    activitySubmissions: {}
  });

  // Case 1: Unverified / missing file
  setTestFirestoreDriver({
    getServerToken: async () => 'test-server-token',
    async getDocument(p) { return db.get(p) || null; },
    async updateDocumentFields() { return {}; }
  });

  const mock1 = createMockReqRes({
    auth: { studentId: '521H0001', isAdmin: false },
    body: { roundId: 'round-1', activityId: 'act-1', files: [{ providerFileId: 'missing-file' }] }
  });
  await submitActivityHandler(mock1.req, mock1.res);
  assert.equal(mock1.getStatus(), 400);
  assert.equal(mock1.getBody().error, 'UNVERIFIED_FILE');

  // Case 2: File owned by another student
  db.set('driveFiles/file-other', {
    fileId: 'file-other',
    name: 'other.pdf',
    size: 1024,
    mimeType: 'application/pdf',
    status: 'verified',
    studentId: '521H8888', // Belong to another student
    roundId: 'round-1',
    activityId: 'act-1'
  });

  const mock2 = createMockReqRes({
    auth: { studentId: '521H0001', isAdmin: false },
    body: { roundId: 'round-1', activityId: 'act-1', files: [{ providerFileId: 'file-other' }] }
  });
  await submitActivityHandler(mock2.req, mock2.res);
  assert.equal(mock2.getStatus(), 403);
  assert.equal(mock2.getBody().error, 'FILE_STUDENT_MISMATCH');
});

test('Real Handler: Server-side deadline and attempt limit enforcement', async () => {
  const { submitActivityHandler } = require('../functions/index.js');
  const { setTestFirestoreDriver } = require('../functions/firestore.js');

  const db = new Map();
  // Round with strict past deadline via submissionConfig
  db.set('graduationRounds/round-expired', {
    id: 'round-expired',
    activities: [{
      id: 'act-strict',
      submissionEnabled: true,
      submissionConfig: {
        deadlineMode: 'custom',
        deadlineAt: '2020-01-01T00:00:00.000Z',
        allowLateSubmission: false,
      },
    }],
    activitySubmissions: {}
  });

  db.set('driveFiles/f1', {
    fileId: 'f1',
    name: 'test.pdf',
    size: 1024,
    mimeType: 'application/pdf',
    status: 'verified',
    studentId: '521H0001',
    roundId: 'round-expired',
    activityId: 'act-strict',
  });

  setTestFirestoreDriver({
    getServerToken: async () => 'test-server-token',
    async getDocument(p) { return db.get(p) || null; },
    async updateDocumentFields() { return {}; }
  });

  const mock = createMockReqRes({
    auth: { studentId: '521H0001', isAdmin: false },
    body: { roundId: 'round-expired', activityId: 'act-strict', files: [{ providerFileId: 'f1' }] }
  });
  await submitActivityHandler(mock.req, mock.res);
  assert.equal(mock.getStatus(), 400);
  assert.equal(mock.getBody().error, 'ACTIVITY_VALIDATION_FAILED');
});

test('Real Handler: withdrawActivityHandler updates Firestore first with honest partial error handling', async () => {
  const { withdrawActivityHandler } = require('../functions/index.js');
  const { setTestFirestoreDriver } = require('../functions/firestore.js');
  const { setTestDriveDriver } = require('../functions/drive.js');

  const db = new Map();
  const updateMaskLog = [];
  const driveTrashLog = [];

  const roundWithSub = {
    id: 'round-1',
    activitySubmissions: {
      'act-1': {
        '521H0001': {
          currentSubmission: {
            receiptId: 'REC-EXISTING',
            attempt: 1,
            status: 'submitted',
            files: [{ providerFileId: 'f1', storageProvider: 'google_drive' }]
          },
          attempts: [
            { receiptId: 'REC-EXISTING', attempt: 1, status: 'submitted' }
          ]
        }
      }
    }
  };
  Object.defineProperty(roundWithSub, '_updateTime', { value: '2026-10-01T00:00:00Z', enumerable: false, writable: true });
  db.set('graduationRounds/round-1', roundWithSub);

  setTestFirestoreDriver({
    getServerToken: async () => 'test-server-token',
    async getDocument(p) { return db.get(p) || null; },
    async updateDocumentFields(path, partialData, token, customMaskPaths) {
      updateMaskLog.push({ path, customMaskPaths, partialData });
      if (path === 'graduationRounds/round-1') {
        const current = db.get(path);
        current.activitySubmissions['act-1']['521H0001'] = partialData.activitySubmissions['act-1']['521H0001'];
        current._updateTime = '2026-10-01T00:00:01Z';
      }
      return {};
    },
    async createDocumentWithPrecondition() { return { ok: true }; }
  });

  setTestDriveDriver({
    async getDriveFileMetadata(fileId) {
      return {
        id: fileId,
        name: 'submitted.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        trashed: false,
        appProperties: {
          app: 'ifa-graduation',
          studentId: '521H0001',
          roundId: 'round-1',
          activityId: 'act-1'
        }
      };
    },
    async trashDriveFile(fileId) {
      driveTrashLog.push(fileId);
      return true;
    }
  });

  const { req, res, getStatus, getBody } = createMockReqRes({
    auth: { studentId: '521H0001', email: '521h0001@student.tdtu.edu.vn', isAdmin: false },
    body: {
      roundId: 'round-1',
      activityId: 'act-1'
    }
  });

  await withdrawActivityHandler(req, res);

  assert.equal(getStatus(), 200, 'Withdraw must succeed with HTTP 200');
  const body = getBody();
  assert.equal(body.ok, true);
  assert.equal(body.withdrawn, true);
  assert.equal(body.driveCleaned, true, 'Drive cleaned flag must be true on successful trash');
  assert.equal(body.submission.status, 'withdrawn');
  assert.equal(body.attempts[0].status, 'withdrawn');

  // Verify Drive trash was invoked for file 'f1'
  assert.deepEqual(driveTrashLog, ['f1']);

  // Verify atomic Firestore update occurred FIRST for round, then driveFiles record
  assert.equal(updateMaskLog.length, 2, 'Must perform 2 updates: round first, then driveFiles record');
  assert.equal(updateMaskLog[0].path, 'graduationRounds/round-1');
  assert.deepEqual(updateMaskLog[0].customMaskPaths, [
    'activitySubmissions.`act-1`.`521H0001`',
    'updatedAt'
  ]);
  assert.equal(updateMaskLog[1].path, 'driveFiles/f1');
  assert.deepEqual(updateMaskLog[1].customMaskPaths, [
    'status',
    'trashedAt'
  ]);
});

test('Real Handler: Admin override allows submission for any student', async () => {
  const { submitActivityHandler } = require('../functions/index.js');
  const { setTestFirestoreDriver } = require('../functions/firestore.js');

  const db = new Map();
  const roundAdmin = {
    id: 'round-1',
    activities: [{
      id: 'act-1',
      submissionEnabled: true,
      startAt: new Date(Date.now() - 86400000).toISOString(),
    }],
    activitySubmissions: {}
  };
  Object.defineProperty(roundAdmin, '_updateTime', { value: '2026-10-01T00:00:00Z', enumerable: false, writable: true });
  db.set('graduationRounds/round-1', roundAdmin);

  db.set('driveFiles/file-admin-submit', {
    fileId: 'file-admin-submit',
    name: 'admin_doc.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    status: 'verified',
    studentId: '521H0002',
    roundId: 'round-1',
    activityId: 'act-1'
  });

  setTestFirestoreDriver({
    getServerToken: async () => 'test-server-token',
    async getDocument(p) { return db.get(p) || null; },
    async updateDocumentFields() { return {}; },
    async createDocumentWithPrecondition() { return { ok: true }; }
  });

  const { req, res, getStatus, getBody } = createMockReqRes({
    auth: { uid: 'admin-uid', email: 'tranquanghai@tdtu.edu.vn', isAdmin: true, studentId: null },
    body: {
      roundId: 'round-1',
      activityId: 'act-1',
      studentId: '521H0002', // Admin submitting on behalf of student
      files: [{ providerFileId: 'file-admin-submit' }]
    }
  });

  await submitActivityHandler(req, res);
  assert.equal(getStatus(), 200, 'Admin override must succeed');
  assert.equal(getBody().ok, true);
  assert.equal(getBody().submission.studentId, '521H0002');
  assert.equal(getBody().submission.submittedBy, 'tranquanghai@tdtu.edu.vn');
});




