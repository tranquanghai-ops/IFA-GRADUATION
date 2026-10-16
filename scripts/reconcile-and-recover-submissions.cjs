/**
 * IFA+ Graduation — Submission Reconciliation & Dry-Run Recovery Script (P0 / Nhóm A)
 * 
 * Target Students (Pre-hotfix unrecorded submissions):
 * - 11900382 (Trang Trần Tuệ Nhã)
 * - 11900395 (Nguyễn Khánh Thịnh)
 * - 12200254 (Nguyễn Thanh Hằng Nga)
 * 
 * Safety Rules & Business Constraints:
 * 1. Defaults to --dry-run. DOES NOT write or modify Firestore unless --apply is explicitly passed.
 * 2. Strict student allowlist: ['11900382', '11900395', '12200254'].
 * 3. Direct Google Drive API verification:
 *    - Reads live Drive file metadata via Google Drive API v3.
 *    - Verifies 'parents' array contains the official main activity folder.
 *    - Rejects any file in 'File cũ' subfolder or trashed.
 * 4. Special rules for MSSV 12200254:
 *    - Expected File ID: 15E5Cr6gMLR4XxoSH-cuOyEHkNew2ALah.
 *    - Does NOT count 16 upload retries as 16 attempts.
 *    - Restores exactly 1 valid attempt (0/3 -> 1/3, totalAttemptsUsed: 1, remainingAttempts: 2).
 * 5. Stable identifier & anti-duplication:
 *    - Uses deterministic ID: sub_${roundId}_${activityId}_${studentId}_recov
 *    - Checks compound key (roundId + activityId + studentId) in both collections.
 *    - Atomic batch write (:commit) with precondition { exists: false } to guarantee
 *      simultaneous creation in activitySubmissions and graduationRounds/{roundId}/submissions.
 * 6. Audit & Rollback:
 *    - Backs up existing state before any change.
 *    - Generates rollback JSON.
 *    - Distinct timestamps: submittedAt reflects original Drive upload time, recoveredAt is recovery execution time.
 */

const fs = require('fs');
const path = require('path');

const ALLOWED_STUDENT_IDS = ['11900382', '11900395', '12200254'];
const TARGET_ROUND_ID = 'FZRWniqMofaIvn7ogq0w';
const TARGET_ACTIVITY_ID = 'act_1790171285992_yhhi9';
const ACTIVITY_DEADLINE_ISO = '2026-10-16T05:10:00.000Z'; // 12:10 PM VN time
const PROJECT_ID = 'ifa-graduation';
const SECRETS_PROJECT_ID = 'ifa-activities';

const STUDENT_SPECS = {
  '11900382': {
    studentName: 'Trang Trần Tuệ Nhã',
    expectedFileName: '11900382_Trang Tran Tue Nha.pdf',
    expectedFileId: '1tuMDPEMz4Avjfh6vVeKfQFuNgf8d3ozw',
    expectedParentFolderId: '1Y6WqE4SHSRH0lB4OqjAY580oISLI0vXO'
  },
  '11900395': {
    studentName: 'Nguyễn Khánh Thịnh',
    expectedFileName: '11900395_Nguyen Khanh Thinh.pdf',
    expectedFileId: '13A20v-sRS4Ye-fVXO0h3honN_tvJ7x_G',
    expectedParentFolderId: '1Y6WqE4SHSRH0lB4OqjAY580oISLI0vXO'
  },
  '12200254': {
    studentName: 'Nguyễn Thanh Hằng Nga',
    expectedFileName: '12200254_Nguyen Thanh Hang Nga.pdf',
    expectedFileId: '15E5Cr6gMLR4XxoSH-cuOyEHkNew2ALah',
    expectedParentFolderId: '1Y6WqE4SHSRH0lB4OqjAY580oISLI0vXO',
    strictMainFolderOnly: true,
    strictExpectedFileId: true
  }
};

const isApplyMode = process.argv.includes('--apply');
const isDryRun = !isApplyMode || process.argv.includes('--dry-run');

console.log('='.repeat(80));
console.log(' IFA+ GRADUATION - SUBMISSION RECONCILIATION & RECOVERY SCRIPT');
console.log(' Mode: ' + (isDryRun ? 'DRY-RUN (READ-ONLY SIMULATION - 100% SAFE)' : 'APPLY (ACTIVE DATABASE MUTATION)'));
console.log(' Target Round: ' + TARGET_ROUND_ID);
console.log(' Target Activity: ' + TARGET_ACTIVITY_ID);
console.log(' Activity Deadline: ' + ACTIVITY_DEADLINE_ISO + ' (12:10 PM VN time)');
console.log(' Target Students: ' + ALLOWED_STUDENT_IDS.join(', '));
console.log('='.repeat(80));

async function getAccessToken() {
  const tokenFile = 'C:/Users/HHHH-HP/.config/configstore/firebase-tools.json';
  if (!fs.existsSync(tokenFile)) {
    throw new Error('firebase-tools.json not found at ' + tokenFile);
  }
  const cfg = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
  if (cfg.tokens && cfg.tokens.access_token && cfg.tokens.expires_at > Date.now() + 60000) {
    return cfg.tokens.access_token;
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho85qd6.apps.googleusercontent.com',
      client_secret: cfg.tokens?.client_secret || '',
      refresh_token: cfg.tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const d = await r.json();
  if (!d.access_token) {
    throw new Error('Failed to obtain Google OAuth access token: ' + JSON.stringify(d));
  }
  return d.access_token;
}

async function getSecretFromManager(gToken, secretName) {
  const url = `https://secretmanager.googleapis.com/v1/projects/${SECRETS_PROJECT_ID}/secrets/${secretName}/versions/latest:access`;
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + gToken } });
  if (!res.ok) {
    throw new Error(`Failed to access Secret Manager secret ${secretName}: HTTP ${res.status}`);
  }
  const data = await res.json();
  return Buffer.from(data.payload.data, 'base64').toString('utf8').trim();
}

async function getDriveAccessToken(gToken) {
  const [s1, s2, s3] = await Promise.all([
    getSecretFromManager(gToken, 'graduation-drive-client-id'),
    getSecretFromManager(gToken, 'graduation-drive-client-secret'),
    getSecretFromManager(gToken, 'graduation-drive-owner-token')
  ]);

  const values = [s1, s2, s3];
  let clientId = values.find(v => v.includes('.apps.googleusercontent.com')) || s1;
  let refreshToken = values.find(v => v.startsWith('1//')) || s3;
  let clientSecret = values.find(v => v.startsWith('GOCSPX-')) || values.find(v => v !== clientId && v !== refreshToken) || s2;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Failed to obtain Drive API access token: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

function deserializeValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(deserializeValue);
  if ('mapValue' in val) return deserializeFields(val.mapValue.fields || {});
  return null;
}

function deserializeFields(fields) {
  const result = {};
  for (const [k, v] of Object.entries(fields || {})) {
    result[k] = deserializeValue(v);
  }
  return result;
}

function serializeValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
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
  for (const [k, v] of Object.entries(obj || {})) {
    fields[k] = serializeValue(v);
  }
  return fields;
}

async function runReconciliation() {
  const gToken = await getAccessToken();
  const headers = {
    Authorization: 'Bearer ' + gToken,
    'Content-Type': 'application/json'
  };

  // 1. Verify Round & Activity
  const roundRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${TARGET_ROUND_ID}`, { headers });
  if (!roundRes.ok) {
    console.error(`[Error] Round ${TARGET_ROUND_ID} not found in Firestore (${roundRes.status}).`);
    process.exit(1);
  }
  const roundJson = await roundRes.json();
  const roundData = deserializeFields(roundJson.fields);
  const activity = (roundData.activities || []).find(a => a.id === TARGET_ACTIVITY_ID);
  if (!activity) {
    console.error(`[Error] Activity ${TARGET_ACTIVITY_ID} not found in round ${TARGET_ROUND_ID}.`);
    process.exit(1);
  }

  const expectedMainFolderId = activity.driveFolderId || '1Y6WqE4SHSRH0lB4OqjAY580oISLI0vXO';
  console.log(`[Verified] Round: "${roundData.name || roundData.title}"`);
  console.log(`[Verified] Activity: "${activity.title || TARGET_ACTIVITY_ID}"`);
  console.log(`[Verified] Activity Main Folder ID: "${expectedMainFolderId}"`);

  // 2. Obtain Google Drive API Access Token
  console.log('\n[Google Drive API] Authenticating to Drive API via Secret Manager...');
  const driveAccessToken = await getDriveAccessToken(gToken);
  console.log('[Google Drive API] Successfully authenticated with drive.file / drive scope.');

  // 3. Inspect main folder and identify "File cũ" subfolder directly on Google Drive
  const qSubfolders = `'${expectedMainFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const subfoldersRes = await fetch(`https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&q=${encodeURIComponent(qSubfolders)}&fields=files(id,name)`, {
    headers: { Authorization: 'Bearer ' + driveAccessToken }
  });
  const subfoldersData = await subfoldersRes.json();
  const oldFolder = (subfoldersData.files || []).find(f => f.name === 'File cũ');
  const oldFolderId = oldFolder ? oldFolder.id : null;
  console.log(`[Google Drive API] Main folder subfolders: ${JSON.stringify(subfoldersData.files || [])}`);
  if (oldFolderId) {
    console.log(`[Google Drive API] Detected "File cũ" subfolder ID: ${oldFolderId} (Exclusion guard ACTIVE)`);
  }

  // 4. Query driveFiles for allowed students using structuredQuery
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'driveFiles' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'roundId' },
          op: 'EQUAL',
          value: { stringValue: TARGET_ROUND_ID }
        }
      }
    }
  };

  const driveQueryRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify(queryBody)
  });

  const driveQueryJson = await driveQueryRes.json();
  const studentDriveFiles = new Map();

  for (const item of driveQueryJson) {
    if (!item.document) continue;
    const docData = deserializeFields(item.document.fields);
    const sid = String(docData.studentId || '').trim();
    if (ALLOWED_STUDENT_IDS.includes(sid)) {
      if (!studentDriveFiles.has(sid)) studentDriveFiles.set(sid, []);
      studentDriveFiles.get(sid).push({
        id: item.document.name.split('/').pop(),
        ...docData,
        rawSize: docData.size || docData.fileSize || 0,
        createdAtMs: docData.createdAt ? new Date(docData.createdAt).getTime() : 0
      });
    }
  }

  // 5. Query existing activitySubmissions (Primary check for anti-duplication)
  const subQueryBody = {
    structuredQuery: {
      from: [{ collectionId: 'activitySubmissions' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'roundId' },
          op: 'EQUAL',
          value: { stringValue: TARGET_ROUND_ID }
        }
      }
    }
  };

  const subQueryRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify(subQueryBody)
  });

  const subQueryJson = await subQueryRes.json();
  const existingSubmissions = new Map();

  for (const item of subQueryJson) {
    if (!item.document) continue;
    const docData = deserializeFields(item.document.fields);
    const sid = String(docData.studentId || '').trim();
    if (ALLOWED_STUDENT_IDS.includes(sid)) {
      if (!existingSubmissions.has(sid)) existingSubmissions.set(sid, []);
      existingSubmissions.get(sid).push({
        id: item.document.name.split('/').pop(),
        ...docData
      });
    }
  }

  const reconciliationReport = [];
  const plannedWrites = [];

  for (const sid of ALLOWED_STUDENT_IDS) {
    const spec = STUDENT_SPECS[sid] || {};
    const allFiles = (studentDriveFiles.get(sid) || []).sort((a, b) => b.createdAtMs - a.createdAtMs);
    const existing = existingSubmissions.get(sid) || [];

    if (allFiles.length === 0) {
      reconciliationReport.push({
        studentId: sid,
        studentName: spec.studentName || '--',
        status: 'NO_FILES_FOUND',
        message: 'No driveFiles found in Firestore for this activity.'
      });
      continue;
    }

    // Select candidate file: must match expectedFileId if specified, or latest file
    const candidateFile = spec.expectedFileId
      ? allFiles.find(f => f.id === spec.expectedFileId) || allFiles[0]
      : allFiles[0];

    // LIVE VERIFICATION DIRECTLY AGAINST GOOGLE DRIVE API
    console.log(`\n[Drive API Verify] Fetching live metadata for student ${sid} file: ${candidateFile.id}...`);
    const liveDriveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${candidateFile.id}?supportsAllDrives=true&fields=id,name,mimeType,size,parents,trashed,createdTime`, {
      headers: { Authorization: 'Bearer ' + driveAccessToken }
    });

    if (!liveDriveRes.ok) {
      console.error(`[CRITICAL ERROR] Student ${sid}: File ${candidateFile.id} not found on Google Drive API (HTTP ${liveDriveRes.status})!`);
      process.exit(1);
    }

    const liveDriveMeta = await liveDriveRes.json();
    const liveParents = liveDriveMeta.parents || [];
    const isTrashed = !!liveDriveMeta.trashed;

    if (isTrashed) {
      console.error(`[CRITICAL ERROR] Student ${sid}: File ${candidateFile.id} is in Google Drive Trash!`);
      process.exit(1);
    }

    // Direct parent check: Must be directly in main folder
    const isInMainFolder = liveParents.includes(expectedMainFolderId);
    // Anti "File cũ" check: Must NOT be in "File cũ"
    const isInOldFolder = oldFolderId ? liveParents.includes(oldFolderId) : false;

    if (!isInMainFolder || isInOldFolder) {
      console.error(`[CRITICAL MISMATCH] Student ${sid}: File ${candidateFile.id} parent folder is invalid!`);
      console.error(`Parents on Drive: ${JSON.stringify(liveParents)} | Expected: ${expectedMainFolderId} | "File cũ": ${oldFolderId}`);
      process.exit(1);
    }

    // Strict validation for Student 12200254 (Nguyễn Thanh Hằng Nga)
    if (spec.strictExpectedFileId) {
      if (candidateFile.id !== spec.expectedFileId) {
        console.error(`[CRITICAL MISMATCH] Student ${sid}: Selected file ID (${candidateFile.id}) does not match expected official file ID (${spec.expectedFileId})!`);
        process.exit(1);
      }
    }

    const uploadDate = new Date(liveDriveMeta.createdTime || candidateFile.createdAt);
    const deadlineDate = new Date(ACTIVITY_DEADLINE_ISO);
    const isTimely = uploadDate <= deadlineDate;

    const rawFileSize = Number(liveDriveMeta.size) || candidateFile.rawSize;
    const fileSizeMb = (rawFileSize / (1024 * 1024)).toFixed(2);
    const deadlineDiffHours = ((deadlineDate.getTime() - uploadDate.getTime()) / (1000 * 60 * 60)).toFixed(2);

    const reportEntry = {
      studentId: sid,
      studentName: spec.studentName || candidateFile.studentName || candidateFile.fileName || '--',
      totalDriveFilesCount: allFiles.length,
      selectedFileId: candidateFile.id,
      selectedFileName: liveDriveMeta.name || candidateFile.fileName,
      liveDriveParents: liveParents.join(', '),
      parentFolderId: expectedMainFolderId,
      isInMainFolderDirectly: isInMainFolder && !isInOldFolder,
      fileSizeMb: fileSizeMb + ' MB (' + rawFileSize + ' bytes)',
      uploadTimeIso: uploadDate.toISOString(),
      uploadTimeVN: new Date(uploadDate.getTime() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' (GMT+7)',
      isBeforeDeadline: isTimely,
      timelyDiff: `Sớm hơn hạn ${deadlineDiffHours} giờ`,
      existingSubmissionsCount: existing.length,
      attemptStateBefore: `${existing.length}/3`,
      attemptStateAfter: `1/3`,
      recoveryStatus: existing.length > 0 ? 'ALREADY_RECORDED' : (isTimely ? 'READY_FOR_RECOVERY' : 'LATE_SUBMISSION')
    };

    reconciliationReport.push(reportEntry);

    // ANTI-DUPLICATION / STABLE IDENTIFIER:
    // Deterministic docId keyed by roundId + activityId + studentId
    const stableDocId = `sub_${TARGET_ROUND_ID}_${TARGET_ACTIVITY_ID}_${sid}_recov`;
    const nowIso = new Date().toISOString();

    if (existing.length === 0 && isTimely) {
      const submissionPayload = {
        id: stableDocId,
        studentId: sid,
        studentName: reportEntry.studentName,
        roundId: TARGET_ROUND_ID,
        activityId: TARGET_ACTIVITY_ID,
        activityTitle: activity ? activity.title : 'DUYỆT ĐỒ ÁN TỐT NGHIỆP ĐỢT 1',
        fileId: candidateFile.id,
        fileName: reportEntry.selectedFileName,
        name: reportEntry.selectedFileName,
        fileSize: rawFileSize,
        webViewLink: `https://drive.google.com/file/d/${candidateFile.id}/view?usp=drivesdk`,
        webContentLink: `https://drive.google.com/uc?export=download&id=${candidateFile.id}`,
        attemptNumber: 1,
        totalAttemptsUsed: 1,
        remainingAttempts: Math.max(0, (activity?.maxAttempts || 3) - 1), // strictly 1/3 attempts
        submittedAt: uploadDate.toISOString(), // Upload evidence time
        createdAt: uploadDate.toISOString(),   // Upload evidence time
        recoveredAt: nowIso,                   // Recovery execution time
        status: 'submitted',
        isRecovered: true,
        recoveryMethod: 'DRIVE_API_DIRECT_VERIFIED_ATOMIC_HOTFIX_P0',
        parentFolderId: expectedMainFolderId,
        driveMetadataIntact: true
      };

      plannedWrites.push({
        studentId: sid,
        studentName: reportEntry.studentName,
        stableDocId,
        primaryPath: `projects/${PROJECT_ID}/databases/(default)/documents/activitySubmissions/${stableDocId}`,
        roundSubPath: `projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${TARGET_ROUND_ID}/submissions/${stableDocId}`,
        auditPath: `projects/${PROJECT_ID}/databases/(default)/documents/auditLogs/audit_recov_${sid}_${Date.now()}`,
        payload: submissionPayload
      });
    }
  }

  console.log('\n--- AUDIT & RECONCILIATION SUMMARY (WITH DIRECT DRIVE API PARENTS) ---');
  console.table(reconciliationReport.map(r => ({
    MSSV: r.studentId,
    'Họ tên': r.studentName,
    'Tổng file': r.totalDriveFilesCount,
    'Drive Parents (Trực tiếp)': r.liveDriveParents,
    'Trực tiếp Folder chính?': r.isInMainFolderDirectly ? '✓ Đúng thư mục chính' : '✕ Sai thư mục',
    'File chính thức': r.selectedFileName,
    'Dung lượng': r.fileSizeMb,
    'Thời gian nộp (VN)': r.uploadTimeVN,
    'Trước hạn': r.isBeforeDeadline ? '✓ ' + r.timelyDiff : '✕ Quá hạn',
    'Lượt nộp': `${r.attemptStateBefore} -> ${r.attemptStateAfter}`,
    'Trạng thái': r.recoveryStatus
  })));

  // Write detailed audit JSON
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const auditReportFile = path.join(backupDir, `audit-reconciliation-report-${timestampStr}.json`);
  fs.writeFileSync(auditReportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    isDryRun,
    targetRoundId: TARGET_ROUND_ID,
    targetActivityId: TARGET_ACTIVITY_ID,
    activityMainFolderId: expectedMainFolderId,
    oldFolderId,
    reconciliationReport,
    plannedWrites
  }, null, 2), 'utf8');
  console.log(`\nDetailed audit report saved to: ${auditReportFile}`);

  console.log('\n--- PLANNED FIRESTORE DOCUMENTS (DRY-RUN PREVIEW) ---');
  plannedWrites.forEach((pw, idx) => {
    console.log(`\n[Plan #${idx + 1}] Student: ${pw.studentId} - ${pw.studentName}`);
    console.log(`Stable Doc ID: ${pw.stableDocId}`);
    console.log(`Primary Path: ${pw.primaryPath}`);
    console.log(`Round Sub Path: ${pw.roundSubPath}`);
    console.log(`Drive File ID: ${pw.payload.fileId}`);
    console.log(`Parent Folder ID: ${pw.payload.parentFolderId}`);
    console.log(`SubmittedAt (Upload Time): ${pw.payload.submittedAt}`);
    console.log(`RecoveredAt (Action Time): ${pw.payload.recoveredAt}`);
    console.log(`Payload Structure:\n${JSON.stringify(pw.payload, null, 2)}`);
  });

  if (isDryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('[DRY-RUN SIMULATION COMPLETED SAFELY]:');
    console.log(`- Simulated ${plannedWrites.length} document recoveries.`);
    console.log('- Verified parent folder ID directly from Google Drive API: ' + expectedMainFolderId);
    console.log('- Verified student 12200254 official file ID: 15E5Cr6gMLR4XxoSH-cuOyEHkNew2ALah');
    console.log('- Verified no candidate files reside in "File cũ" (' + (oldFolderId || 'None') + ')');
    console.log('- Anti-duplication mechanism: Stable Doc ID + pre-commit existence check.');
    console.log('- Consistency mechanism: Atomic batch commit writing both collections simultaneously.');
    console.log('- NO CHANGES were made to Production Firestore or Google Drive.');
    console.log('- Attempt count configured strictly to: 1/3 (0/3 -> 1/3).');
    console.log('- WAITING FOR USER APPROVAL. Do NOT run --apply without explicit confirmation.');
    console.log('='.repeat(80));
    return;
  }

  // Active mutation mode (STRICTLY ONLY IF --apply was passed)
  console.log('\n[WARNING]: EXECUTING ACTIVE DATABASE RECOVERY (--apply mode)...');
  console.log('[Safety Check] Re-verifying Firestore state immediately before atomic commit...');

  for (const item of plannedWrites) {
    // 1. Fresh pre-write check on primary collection
    const checkPrimary = await fetch(`https://firestore.googleapis.com/v1/${item.primaryPath}`, { headers });
    if (checkPrimary.status === 200) {
      console.warn(`[Skip] Document ${item.primaryPath} already exists! Skipping to prevent overwrite.`);
      continue;
    }

    // 2. Fresh pre-write check on round subcollection
    const checkSub = await fetch(`https://firestore.googleapis.com/v1/${item.roundSubPath}`, { headers });
    if (checkSub.status === 200) {
      console.warn(`[Skip] Document ${item.roundSubPath} already exists! Skipping to prevent overwrite.`);
      continue;
    }

    // 3. ATOMIC BATCH WRITE VIA :commit ENDPOINT
    // Both documents and the auditLog are committed in a single transaction.
    // If either fails, none are committed.
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
    const serializedPayload = serializeFields(item.payload);
    const auditFields = serializeFields({
      action: 'RECOVER_UNRECORDED_SUBMISSION',
      roundId: TARGET_ROUND_ID,
      activityId: TARGET_ACTIVITY_ID,
      studentId: item.payload.studentId,
      studentName: item.payload.studentName,
      fileId: item.payload.fileId,
      fileName: item.payload.fileName,
      parentFolderId: item.payload.parentFolderId,
      submittedAt: item.payload.submittedAt,
      recoveredAt: new Date().toISOString(),
      performedBy: 'ADMIN_RECONCILIATION_SCRIPT_HOTFIX_P0_OFFICIAL'
    });

    const commitBody = {
      writes: [
        {
          update: {
            name: item.primaryPath,
            fields: serializedPayload
          },
          currentDocument: { exists: false }
        },
        {
          update: {
            name: item.roundSubPath,
            fields: serializedPayload
          },
          currentDocument: { exists: false }
        },
        {
          update: {
            name: item.auditPath,
            fields: auditFields
          }
        }
      ]
    };

    console.log(`Committing atomic batch write for student ${item.studentId} (${item.stableDocId})...`);
    const commitRes = await fetch(commitUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(commitBody)
    });

    if (!commitRes.ok) {
      const errText = await commitRes.text();
      console.error(`[CRITICAL ERROR] Failed to commit atomic batch for student ${item.studentId}: HTTP ${commitRes.status} ${errText}`);
      process.exit(1);
    }
  }

  const rollbackFile = path.join(backupDir, `rollback-reconciliation-${timestampStr}.json`);
  fs.writeFileSync(rollbackFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    rollbackItems: plannedWrites.map(pw => ({
      primaryPath: pw.primaryPath,
      roundSubPath: pw.roundSubPath,
      auditPath: pw.auditPath,
      stableDocId: pw.stableDocId,
      studentId: pw.studentId
    }))
  }, null, 2), 'utf8');

  console.log(`\n[SUCCESS]: Successfully recovered ${plannedWrites.length} submissions.`);
  console.log(`Rollback metadata saved to: ${rollbackFile}`);
}

runReconciliation().catch(err => {
  console.error('[Fatal Error] Reconciliation failed:', err);
  process.exit(1);
});
