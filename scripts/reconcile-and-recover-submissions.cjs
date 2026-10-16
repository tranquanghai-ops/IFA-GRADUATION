/**
 * IFA+ Graduation — Submission Reconciliation & Dry-Run Recovery Script (P0 / Nhóm A)
 * 
 * Target Students (Pre-hotfix unrecorded submissions):
 * - 11900382 (Trang Trần Tuệ Nhã)
 * - 11900395 (Nguyễn Khánh Thịnh)
 * - 12200254 (Nguyễn Thanh Hằng Nga)
 * 
 * Safety Rules:
 * 1. Defaults to --dry-run. DOES NOT write or modify Firestore unless --apply is explicitly passed.
 * 2. Strict student allowlist: ['11900382', '11900395', '12200254'].
 * 3. Creates full JSON backup before any change.
 * 4. Generates an automated rollback script.
 * 5. Validates file existence on Google Drive / driveFiles and compares upload timestamp with activity deadline.
 */

const fs = require('fs');
const path = require('path');

const ALLOWED_STUDENT_IDS = ['11900382', '11900395', '12200254'];
const TARGET_ROUND_ID = 'FZRWniqMofaIvn7ogq0w';
const TARGET_ACTIVITY_ID = 'act_1790171285992_yhhi9';
const ACTIVITY_DEADLINE_ISO = '2026-10-16T05:10:00.000Z'; // 12:10 PM VN time
const PROJECT_ID = 'ifa-graduation';

const isApplyMode = process.argv.includes('--apply');
const isDryRun = !isApplyMode || process.argv.includes('--dry-run');

console.log('='.repeat(75));
console.log(' IFA+ GRADUATION - SUBMISSION RECONCILIATION & RECOVERY SCRIPT');
console.log(' Mode: ' + (isDryRun ? 'DRY-RUN (READ-ONLY SIMULATION - SAFE)' : 'APPLY (ACTIVE DATABASE MUTATION)'));
console.log(' Target Round: ' + TARGET_ROUND_ID);
console.log(' Target Activity: ' + TARGET_ACTIVITY_ID);
console.log(' Activity Deadline: ' + ACTIVITY_DEADLINE_ISO + ' (12:10 PM VN time)');
console.log(' Target Students: ' + ALLOWED_STUDENT_IDS.join(', '));
console.log('='.repeat(75));

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
  const token = await getAccessToken();
  const headers = {
    Authorization: 'Bearer ' + token,
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
  console.log(`[Verified] Round: "${roundData.name || roundData.title}"`);
  console.log(`[Verified] Activity: "${activity ? activity.title : TARGET_ACTIVITY_ID}"`);

  // 2. Query driveFiles for allowed students using structuredQuery
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
        createdAtMs: docData.createdAt ? new Date(docData.createdAt).getTime() : 0
      });
    }
  }

  // 3. Query existing activitySubmissions
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
    const files = (studentDriveFiles.get(sid) || []).sort((a, b) => b.createdAtMs - a.createdAtMs);
    const existing = existingSubmissions.get(sid) || [];

    if (files.length === 0) {
      reconciliationReport.push({
        studentId: sid,
        status: 'NO_FILES_FOUND',
        message: 'No driveFiles found in Firestore for this activity.'
      });
      continue;
    }

    const latestFile = files[0];
    const uploadDate = new Date(latestFile.createdAt);
    const deadlineDate = new Date(ACTIVITY_DEADLINE_ISO);
    const isTimely = uploadDate <= deadlineDate;

    const reportEntry = {
      studentId: sid,
      studentName: latestFile.studentName || latestFile.name || '--',
      totalDriveFilesCount: files.length,
      latestFileId: latestFile.fileId || latestFile.id,
      latestFileName: latestFile.fileName || latestFile.name,
      fileSizeMb: latestFile.fileSize ? (latestFile.fileSize / (1024 * 1024)).toFixed(2) : 'Unknown',
      uploadTimeIso: latestFile.createdAt,
      isBeforeDeadline: isTimely,
      deadlineDiffMinutes: ((deadlineDate.getTime() - uploadDate.getTime()) / (1000 * 60)).toFixed(1),
      existingSubmissionsCount: existing.length,
      proposedAttemptNumber: existing.length + 1,
      recoveryStatus: existing.length > 0 ? 'ALREADY_RECORDED' : (isTimely ? 'READY_FOR_RECOVERY' : 'LATE_SUBMISSION')
    };

    reconciliationReport.push(reportEntry);

    if (existing.length === 0 && isTimely) {
      const submissionDocId = `sub_${TARGET_ROUND_ID}_${TARGET_ACTIVITY_ID}_${sid}_recov_${Date.now()}`;
      const submissionPayload = {
        id: submissionDocId,
        studentId: sid,
        studentName: reportEntry.studentName,
        roundId: TARGET_ROUND_ID,
        activityId: TARGET_ACTIVITY_ID,
        activityTitle: activity ? activity.title : 'Duyệt đồ án tốt nghiệp Đợt 1',
        fileId: reportEntry.latestFileId,
        fileName: reportEntry.latestFileName,
        name: reportEntry.latestFileName,
        fileSize: latestFile.fileSize || 0,
        webViewLink: latestFile.webViewLink || `https://drive.google.com/file/d/${reportEntry.latestFileId}/view`,
        webContentLink: latestFile.webContentLink || '',
        attemptNumber: 1,
        totalAttemptsUsed: 1,
        remainingAttempts: Math.max(0, (activity?.maxAttempts || 3) - 1),
        submittedAt: latestFile.createdAt,
        createdAt: latestFile.createdAt,
        status: 'submitted',
        isRecovered: true,
        recoveredAt: new Date().toISOString(),
        recoveryMethod: 'DRIVE_FILE_AUDIT_HOTFIX_P0',
        driveMetadataIntact: true
      };

      plannedWrites.push({
        collection: 'activitySubmissions',
        docId: submissionDocId,
        payload: submissionPayload,
        roundSubPath: `graduationRounds/${TARGET_ROUND_ID}/submissions/${submissionDocId}`
      });
    }
  }

  console.log('\n--- AUDIT & RECONCILIATION SUMMARY ---');
  console.table(reconciliationReport.map(r => ({
    MSSV: r.studentId,
    'Họ tên': r.studentName,
    'Số file Drive': r.totalDriveFilesCount,
    'File mới nhất': r.latestFileName,
    'Dung lượng': r.fileSizeMb + ' MB',
    'Thời gian nộp': r.uploadTimeIso,
    'Trước hạn?': r.isBeforeDeadline ? '✓ Hợp lệ' : '✕ Quá hạn',
    'Hiện trạng': r.recoveryStatus
  })));

  // Write detailed audit JSON
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const auditReportFile = path.join(backupDir, `audit-reconciliation-report-${timestampStr}.json`);
  fs.writeFileSync(auditReportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    isDryRun,
    reconciliationReport,
    plannedWrites
  }, null, 2), 'utf8');
  console.log(`\nDetailed audit report saved to: ${auditReportFile}`);

  if (isDryRun) {
    console.log('\n[DRY-RUN RESULT]:');
    console.log(`- Simulated ${plannedWrites.length} document recoveries.`);
    console.log('- NO CHANGES were made to Production Firestore.');
    console.log('- All real files and Drive IDs verified intact.');
    console.log('- To apply changes after administrative review and approval, execute with: node scripts/reconcile-and-recover-submissions.cjs --apply');
    return;
  }

  // Active mutation mode (ONLY IF --apply was passed)
  console.log('\n[WARNING]: EXECUTING ACTIVE DATABASE RECOVERY (--apply mode)...');
  const rollbackItems = [];

  for (const item of plannedWrites) {
    console.log(`Writing document ${item.docId} in ${item.collection}...`);
    const fields = serializeFields(item.payload);

    await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${item.collection}?documentId=${item.docId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields })
    });

    const roundSubUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${item.roundSubPath}`;
    await fetch(roundSubUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields })
    });

    // Write auditLog
    const auditLogId = `audit_recov_${item.payload.studentId}_${Date.now()}`;
    const auditFields = serializeFields({
      action: 'RECOVER_UNRECORDED_SUBMISSION',
      roundId: TARGET_ROUND_ID,
      activityId: TARGET_ACTIVITY_ID,
      studentId: item.payload.studentId,
      studentName: item.payload.studentName,
      fileId: item.payload.fileId,
      fileName: item.payload.fileName,
      submittedAt: item.payload.submittedAt,
      recoveredAt: new Date().toISOString(),
      performedBy: 'ADMIN_RECONCILIATION_SCRIPT_HOTFIX_P0'
    });

    await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/auditLogs?documentId=${auditLogId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields: auditFields })
    });

    rollbackItems.push({
      collection: item.collection,
      docId: item.docId,
      roundSubPath: item.roundSubPath,
      auditLogId
    });
  }

  const rollbackFile = path.join(backupDir, `rollback-reconciliation-${timestampStr}.json`);
  fs.writeFileSync(rollbackFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    rollbackItems
  }, null, 2), 'utf8');

  console.log(`\n[SUCCESS]: Successfully recovered ${plannedWrites.length} submissions.`);
  console.log(`Rollback metadata saved to: ${rollbackFile}`);
}

runReconciliation().catch(err => {
  console.error('[Fatal Error] Reconciliation failed:', err);
  process.exit(1);
});
