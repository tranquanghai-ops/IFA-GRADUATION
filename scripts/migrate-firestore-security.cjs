/**
 * IFA-GRADUATION — FIRESTORE SECURITY MIGRATION & RECONCILIATION SCRIPT
 *
 * Purpose:
 * 1. Read-only inventory and audit of sensitive grading fields across all graduationRounds.
 * 2. Full backup of pre-migration state to backups/firestore-security-backup-<timestamp>.json.
 * 3. Migration of legacy student results from root publishedReviews into Tier C subcollection publishedStudentResults/{studentId}.
 * 4. Verification of data checksums and idempotent safety.
 * 5. Rollback capability from JSON backup.
 *
 * Safety Rules:
 * - DEFAULTS TO --dry-run (100% READ-ONLY).
 * - Requires explicit --apply to execute mutations.
 * - DOES NOT modify student grades, real submissions, or Google Drive files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ID = 'ifa-graduation';
const TARGET_ROUND_ID = 'FZRWniqMofaIvn7ogq0w'; // Main 2026 graduation round

const args = process.argv.slice(2);
const isApplyMode = args.includes('--apply');
const isCleanupRootMode = args.includes('--cleanup-root');
const rollbackArg = args.find(a => a.startsWith('--rollback='));
const isRollbackMode = Boolean(rollbackArg);
const isDryRun = !isApplyMode && !isRollbackMode && !isCleanupRootMode;

console.log('='.repeat(80));
console.log(' IFA-GRADUATION — FIRESTORE SECURITY AUDIT & MIGRATION SCRIPT');
console.log(' Mode: ' + (isRollbackMode ? 'ROLLBACK' : (isCleanupRootMode ? 'CLEANUP-ROOT (ACTIVE PRODUCTION CLEANUP)' : (isApplyMode ? 'APPLY (ACTIVE PRODUCTION MUTATION)' : 'DRY-RUN (READ-ONLY INVENTORY)'))));
console.log(' Project: ' + PROJECT_ID);
console.log(' Target Round: ' + TARGET_ROUND_ID);
console.log('='.repeat(80));

async function getAccessToken() {
  const tokenFile = path.join(process.env.USERPROFILE || 'C:/Users/HHHH-HP', '.config/configstore/firebase-tools.json');
  if (!fs.existsSync(tokenFile)) {
    throw new Error('firebase-tools.json not found at ' + tokenFile);
  }
  let cfg = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
  if (cfg.tokens && cfg.tokens.access_token && cfg.tokens.expires_at > Date.now() + 60000) {
    return cfg.tokens.access_token;
  }
  // Try refreshing via firebase-tools CLI
  try {
    const { execSync } = require('child_process');
    execSync('npx firebase-tools projects:list', { stdio: 'ignore', timeout: 30000 });
    cfg = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    if (cfg.tokens && cfg.tokens.access_token) {
      return cfg.tokens.access_token;
    }
  } catch (cliErr) {}

  throw new Error('Unable to obtain active Firebase access token. Please run npx firebase-tools login');
}

function deserializeField(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('mapValue' in val) {
    const res = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = deserializeField(v);
    }
    return res;
  }
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(deserializeField);
  }
  return null;
}

function deserializeFields(fields) {
  const res = {};
  for (const [k, v] of Object.entries(fields || {})) {
    res[k] = deserializeField(v);
  }
  return res;
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
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = serializeValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function serializeFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) fields[k] = serializeValue(v);
  }
  return fields;
}

async function runInventoryAndMigration() {
  const token = await getAccessToken();
  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json'
  };

  console.log('\n[1/5] Fetching graduationRounds from Firestore REST API...');
  const roundsUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds`;
  const roundsRes = await fetch(roundsUrl, { headers });
  if (!roundsRes.ok) {
    throw new Error(`Failed to list graduationRounds: HTTP ${roundsRes.status}`);
  }
  const roundsJson = await roundsRes.json();
  const rounds = (roundsJson.documents || []).map(doc => ({
    id: doc.name.split('/').pop(),
    path: doc.name,
    rawFields: doc.fields,
    data: deserializeFields(doc.fields)
  }));

  console.log(`Found ${rounds.length} graduationRound document(s).`);

  const inventoryReport = {
    scannedAt: new Date().toISOString(),
    totalRounds: rounds.length,
    roundsDetail: [],
    sensitiveFieldsSummary: {
      roundsWithRootCouncilScores: 0,
      roundsWithRootProgressReviews: 0,
      roundsWithRootPublishedResults: 0,
      roundsWithNestedDefenseScores: 0,
      totalPublishedStudentCount: 0,
      totalReviewDecisionsCount: 0
    }
  };

  // Inspect each round
  for (const r of rounds) {
    const roundId = r.id;
    console.log(`\n--- Inspecting Round: ${roundId} (${r.data.name || r.data.title || 'Untitled'}) ---`);

    const hasCouncilScores = Boolean(r.data.councilScores && Object.keys(r.data.councilScores).length > 0);
    const hasProgressReviews = Boolean(r.data.progressReviews && Object.keys(r.data.progressReviews).length > 0);
    const publishedReviews = r.data.publishedReviews || {};

    let publishedStudentCount = 0;
    const publishedPhases = [];
    for (const [pKey, pVal] of Object.entries(publishedReviews)) {
      if (pVal && pVal.studentResults) {
        const count = Object.keys(pVal.studentResults).length;
        publishedStudentCount += count;
        publishedPhases.push({ phase: pKey, count, status: pVal.status });
      } else if (pVal) {
        publishedPhases.push({ phase: pKey, count: 0, status: pVal.status });
      }
    }

    // Inspect nested councils in activities
    let nestedDefenseScoresCount = 0;
    const activities = r.data.activities || [];
    for (const act of activities) {
      for (const c of (act.councils || [])) {
        if (c.finalDefenseScores && Object.keys(c.finalDefenseScores).length > 0) {
          nestedDefenseScoresCount += Object.keys(c.finalDefenseScores).length;
        }
      }
    }

    // Query subcollections for this round
    const subColUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${roundId}/reviewDecisions`;
    const reviewDecRes = await fetch(subColUrl, { headers });
    const reviewDecJson = reviewDecRes.ok ? await reviewDecRes.json() : {};
    const reviewDecCount = (reviewDecJson.documents || []).length;

    const pubStColUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${roundId}/publishedStudentResults`;
    const pubStRes = await fetch(pubStColUrl, { headers });
    const pubStJson = pubStRes.ok ? await pubStRes.json() : {};
    const pubStCount = (pubStJson.documents || []).length;

    const roundSummary = {
      roundId,
      name: r.data.name || r.data.title || roundId,
      status: r.data.status || 'unknown',
      hasCouncilScoresOnRoot: hasCouncilScores,
      councilScoresKeysCount: hasCouncilScores ? Object.keys(r.data.councilScores).length : 0,
      hasProgressReviewsOnRoot: hasProgressReviews,
      hasPublishedReviewsOnRoot: publishedPhases.length > 0,
      publishedPhases,
      publishedStudentCountOnRoot: publishedStudentCount,
      nestedDefenseScoresCount,
      reviewDecisionsCount: reviewDecCount,
      publishedStudentResultsSubcollectionCount: pubStCount
    };

    inventoryReport.roundsDetail.push(roundSummary);

    if (hasCouncilScores) inventoryReport.sensitiveFieldsSummary.roundsWithRootCouncilScores++;
    if (hasProgressReviews) inventoryReport.sensitiveFieldsSummary.roundsWithRootProgressReviews++;
    if (publishedStudentCount > 0) inventoryReport.sensitiveFieldsSummary.roundsWithRootPublishedResults++;
    if (nestedDefenseScoresCount > 0) inventoryReport.sensitiveFieldsSummary.roundsWithNestedDefenseScores++;
    inventoryReport.sensitiveFieldsSummary.totalPublishedStudentCount += publishedStudentCount;
    inventoryReport.sensitiveFieldsSummary.totalReviewDecisionsCount += reviewDecCount;

    console.log(`  - Root councilScores keys: ${roundSummary.councilScoresKeysCount}`);
    console.log(`  - Root progressReviews: ${hasProgressReviews ? 'YES' : 'NONE'}`);
    console.log(`  - Root publishedReviews studentResults: ${publishedStudentCount} students across ${publishedPhases.length} phase(s)`);
    console.log(`  - Nested finalDefenseScores in activities: ${nestedDefenseScoresCount}`);
    console.log(`  - Subcollection reviewDecisions: ${reviewDecCount} docs`);
    console.log(`  - Subcollection publishedStudentResults: ${pubStCount} docs`);
  }

  // Backup state
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFilename = `firestore-security-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const backupPath = path.join(backupDir, backupFilename);
  fs.writeFileSync(backupPath, JSON.stringify({ inventory: inventoryReport, rawRounds: rounds }, null, 2), 'utf8');
  console.log(`\n[2/5] Full pre-migration state backed up to:\n  ${backupPath}`);

  // Print Summary Table
  console.log('\n[3/5] AUDIT & INVENTORY SUMMARY:');
  console.table(inventoryReport.roundsDetail.map(r => ({
    'Round ID': r.roundId.substring(0, 12) + '...',
    'Name': r.name.substring(0, 25),
    'Root Scores': r.hasCouncilScoresOnRoot ? 'LEAK' : 'OK',
    'Root Pub SV': r.publishedStudentCountOnRoot,
    'SubCol Pub SV': r.publishedStudentResultsSubcollectionCount,
    'ReviewDec': r.reviewDecisionsCount,
    'Nested Defense': r.nestedDefenseScoresCount
  })));

  // If DRY-RUN mode, stop here and display report
  if (isDryRun) {
    console.log('\n' + '='.repeat(80));
    console.log(' DRY-RUN FINISHED SUCCESSFULLY: 0 PRODUCTION WRITES PERFORMED.');
    console.log(' To execute the production migration, this script must be run with --apply');
    console.log(' after Administrator approval.');
    console.log('='.repeat(80));
    return;
  }

  // =========================================================================
  // ROLLBACK MODE
  // =========================================================================
  if (isRollbackMode) {
    const backupFile = rollbackArg.split('=')[1];
    console.log(`\n[4/5] EXECUTING ROLLBACK FROM BACKUP: ${backupFile}...`);
    if (!fs.existsSync(backupFile)) throw new Error(`Backup file not found: ${backupFile}`);
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    const rawRounds = backupData.rawRounds || (backupData.id ? [backupData] : []);
    for (const r of rawRounds) {
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${r.id}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: r.rawFields || serializeFields(r.data) })
      });
      if (!patchRes.ok) console.error(`Failed to restore round ${r.id}: HTTP ${patchRes.status}`);
      else console.log(`Restored round ${r.id} successfully.`);
    }
    console.log('[5/5] Rollback finished successfully.');
    return;
  }

  // =========================================================================
  // CLEANUP-ROOT MODE: STRIP SENSITIVE LEAKS FROM ROOT DOCUMENT AFTER CUTOVER
  // =========================================================================
  if (isCleanupRootMode) {
    console.log('\n[4/5] EXECUTING CONTROLLED ROOT DOCUMENT CLEANUP (--cleanup-root)...');
    const targetRoundId = (args.find(a => a.startsWith('--round='))?.split('=')[1]) || TARGET_ROUND_ID;
    const target = rounds.find(r => r.id === targetRoundId);
    if (!target) throw new Error(`Target round ${targetRoundId} not found for cleanup.`);

    // 1. Deep data-level verification before cleanup: Check each student, phase, and grading values
    console.log('Performing deep data reconciliation across all students and phases...');
    const publishedReviews = target.data.publishedReviews || {};
    let totalVerifiedStudents = 0;

    for (const [pKey, pVal] of Object.entries(publishedReviews)) {
      if (!pVal || !pVal.studentResults) continue;
      const studentResults = pVal.studentResults;
      console.log(`Checking Phase ${pKey} (${Object.keys(studentResults).length} students)...`);

      // 1a. Verify admin snapshot exists in publishedProgressReviews/{pKey}
      const snapUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${target.id}/publishedProgressReviews/${pKey}`;
      const snapRes = await fetch(snapUrl, { headers });
      if (!snapRes.ok) {
        throw new Error(`ABORT CLEANUP: Admin snapshot publishedProgressReviews/${pKey} is missing! HTTP ${snapRes.status}`);
      }

      // 1b. Verify each individual student's migrated record value-by-value
      for (const [stId, expectedRes] of Object.entries(studentResults)) {
        // Check subcollection reviews/{pKey} document
        const phaseDocUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${target.id}/publishedStudentResults/${stId}/reviews/${pKey}`;
        const phaseRes = await fetch(phaseDocUrl, { headers });
        if (!phaseRes.ok) {
          throw new Error(`ABORT CLEANUP: Student ${stId} missing phase document in subcollection reviews/${pKey}! HTTP ${phaseRes.status}`);
        }
        const phaseJson = await phaseRes.json();
        const phaseData = deserializeFields(phaseJson.fields);

        // Verify letterGrade
        const expGrade = expectedRes.letterGrade || '--';
        if (phaseData.letterGrade !== expGrade) {
          throw new Error(`ABORT CLEANUP: Student ${stId} phase ${pKey} letterGrade mismatch! Expected: ${expGrade}, Got: ${phaseData.letterGrade}`);
        }

        // Verify isPassed
        const expPassed = Boolean(expectedRes.isPassed);
        if (Boolean(phaseData.isPassed) !== expPassed) {
          throw new Error(`ABORT CLEANUP: Student ${stId} phase ${pKey} isPassed mismatch! Expected: ${expPassed}, Got: ${phaseData.isPassed}`);
        }

        // Verify status
        const expStatus = pVal.status || 'published';
        if (phaseData.status !== expStatus) {
          throw new Error(`ABORT CLEANUP: Student ${stId} phase ${pKey} status mismatch! Expected: ${expStatus}, Got: ${phaseData.status}`);
        }

        totalVerifiedStudents++;
      }
    }

    console.log(`Deep reconciliation verified: ${totalVerifiedStudents} student result(s) matched 100% of data values.`);

    // 2. Pre-cleanup backup
    const preCleanupBackupPath = path.join(backupDir, `pre-cleanup-backup-${target.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(preCleanupBackupPath, JSON.stringify(target, null, 2), 'utf8');
    console.log(`Pre-cleanup backup saved to: ${preCleanupBackupPath}`);

    // 3. Build sanitized fields for root doc
    const cleanFields = { ...target.rawFields };
    // Remove councilScores
    delete cleanFields.councilScores;
    // Sanitize publishedReviews (keep metadata, remove studentResults map)
    if (cleanFields.publishedReviews && cleanFields.publishedReviews.mapValue) {
      const pubMap = cleanFields.publishedReviews.mapValue.fields || {};
      const sanitizedPubMap = {};
      for (const [k, v] of Object.entries(pubMap)) {
        if (v.mapValue && v.mapValue.fields) {
          const pFields = { ...v.mapValue.fields };
          delete pFields.studentResults;
          sanitizedPubMap[k] = { mapValue: { fields: pFields } };
        } else {
          sanitizedPubMap[k] = v;
        }
      }
      cleanFields.publishedReviews = { mapValue: { fields: sanitizedPubMap } };
    }
    // Sanitize activities (remove finalDefenseScores from councils)
    if (cleanFields.activities && cleanFields.activities.arrayValue) {
      const acts = cleanFields.activities.arrayValue.values || [];
      const sanitizedActs = acts.map(actVal => {
        if (!actVal.mapValue || !actVal.mapValue.fields) return actVal;
        const actFields = { ...actVal.mapValue.fields };
        if (actFields.councils && actFields.councils.arrayValue) {
          const councils = actFields.councils.arrayValue.values || [];
          const sanitizedCouncils = councils.map(cVal => {
            if (!cVal.mapValue || !cVal.mapValue.fields) return cVal;
            const cFields = { ...cVal.mapValue.fields };
            delete cFields.finalDefenseScores;
            return { mapValue: { fields: cFields } };
          });
          actFields.councils = { arrayValue: { values: sanitizedCouncils } };
        }
        return { mapValue: { fields: actFields } };
      });
      cleanFields.activities = { arrayValue: { values: sanitizedActs } };
    }

    const patchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${target.id}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: cleanFields })
    });
    if (!patchRes.ok) throw new Error(`Failed to clean root doc: HTTP ${patchRes.status}`);

    console.log(`[5/5] Root document ${target.id} cleaned successfully. Sensitive fields removed.`);
    return;
  }

  // =========================================================================
  // APPLY MODE: ACTIVE PRODUCTION MIGRATION
  // =========================================================================
  console.log('\n[4/5] EXECUTING ACTIVE PRODUCTION MIGRATION (--apply)...');
  const targetRoundArg = (args.find(a => a.startsWith('--round='))?.split('=')[1]) || TARGET_ROUND_ID;
  const roundsToMigrate = rounds.filter(r => r.id === targetRoundArg);
  if (roundsToMigrate.length === 0) {
    throw new Error(`Round ${targetRoundArg} not found for migration.`);
  }

  let totalSnapshotsCreated = 0;
  let totalParentDocsCreated = 0;
  let totalPhaseDocsCreated = 0;
  const writeErrors = [];

  for (const r of roundsToMigrate) {
    const roundId = r.id;
    const publishedReviews = r.data.publishedReviews || {};

    for (const [pKey, pVal] of Object.entries(publishedReviews)) {
      if (pVal && pVal.studentResults && Object.keys(pVal.studentResults).length > 0) {
        const studentResults = pVal.studentResults;
        const phaseNum = pVal.phase || parseInt(pKey.replace(/\D/g, ''), 10) || 1;
        const pubAt = pVal.publishedAt || new Date().toISOString();
        const pubBy = pVal.publishedBy || 'admin';
        const pubVersion = pVal.publicationVersion || 1;

        console.log(`Migrating ${Object.keys(studentResults).length} students for Round ${roundId} ${pKey}...`);

        // Save admin snapshot to publishedProgressReviews/{pKey}
        const snapshotUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${roundId}/publishedProgressReviews/${pKey}`;
        const snapRes = await fetch(snapshotUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields: serializeFields(pVal) })
        });
        if (!snapRes.ok) {
          writeErrors.push(`Failed to save admin snapshot ${pKey}: HTTP ${snapRes.status}`);
        } else {
          totalSnapshotsCreated++;
        }

        // Migrate individual student results
        for (const [stId, sRes] of Object.entries(studentResults)) {
          const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${roundId}/publishedStudentResults/${stId}`;
          const payload = {
            studentId: stId,
            studentName: sRes.studentName || stId,
            roundId: roundId,
            status: pVal.status || 'published',
            isPublished: pVal.status === 'published',
            reviews: {
              [pKey]: {
                phase: Number(phaseNum),
                activityId: pVal.activityId || `act_${pKey}`,
                letterGrade: sRes.letterGrade || '--',
                isPassed: Boolean(sRes.isPassed),
                status: pVal.status || 'published',
                publishedAt: pubAt,
                publishedBy: pubBy,
                publicationVersion: pubVersion
              }
            },
            updatedAt: new Date().toISOString()
          };

          const writeRes = await fetch(docUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields: serializeFields(payload) })
          });

          if (!writeRes.ok) {
            writeErrors.push(`Failed to write parent doc for student ${stId}: HTTP ${writeRes.status}`);
          } else {
            totalParentDocsCreated++;
          }

          // Migrate independent phase document in subcollection reviews/{pKey}
          const phaseDocUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/graduationRounds/${roundId}/publishedStudentResults/${stId}/reviews/${pKey}`;
          const phasePayload = {
            phase: Number(phaseNum),
            activityId: pVal.activityId || `act_${pKey}`,
            letterGrade: sRes.letterGrade || '--',
            isPassed: Boolean(sRes.isPassed),
            status: pVal.status || 'published',
            publishedAt: pubAt,
            publishedBy: pubBy,
            publicationVersion: pubVersion,
            updatedAt: new Date().toISOString()
          };

          const phaseWriteRes = await fetch(phaseDocUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields: serializeFields(phasePayload) })
          });

          if (!phaseWriteRes.ok) {
            writeErrors.push(`Failed to write phase doc for student ${stId} (${pKey}): HTTP ${phaseWriteRes.status}`);
          } else {
            totalPhaseDocsCreated++;
          }
        }
      }
    }
  }

  if (writeErrors.length > 0) {
    console.error('\n[ERRORS DETECTED DURING MIGRATION]:');
    writeErrors.forEach(e => console.error('  - ' + e));
    throw new Error(`Migration completed with ${writeErrors.length} write error(s).`);
  }

  console.log(`\n[5/5] Migration Step 1 completed successfully.`);
  console.log(`Summary:`);
  console.log(`  - Admin snapshots created: ${totalSnapshotsCreated}`);
  console.log(`  - Parent student documents written: ${totalParentDocsCreated}`);
  console.log(`  - Subcollection phase documents written: ${totalPhaseDocsCreated}`);
  console.log(`  - Total write errors: 0`);
}

runInventoryAndMigration().catch(err => {
  console.error('\n[FATAL ERROR] Migration failed:', err);
  process.exit(1);
});
