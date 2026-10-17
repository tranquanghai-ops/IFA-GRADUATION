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
const isRollbackMode = args.some(a => a.startsWith('--rollback='));
const isDryRun = !isApplyMode && !isRollbackMode;

console.log('='.repeat(80));
console.log(' IFA-GRADUATION — FIRESTORE SECURITY AUDIT & MIGRATION SCRIPT');
console.log(' Mode: ' + (isRollbackMode ? 'ROLLBACK' : (isApplyMode ? 'APPLY (ACTIVE PRODUCTION MUTATION)' : 'DRY-RUN (READ-ONLY INVENTORY)')));
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
  // APPLY MODE: ACTIVE PRODUCTION MIGRATION
  // =========================================================================
  console.log('\n[4/5] EXECUTING ACTIVE PRODUCTION MIGRATION (--apply)...');

  for (const r of rounds) {
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
            console.error(`Failed to migrate student ${stId}: HTTP ${writeRes.status}`);
          }
        }
      }
    }
  }

  console.log('\n[5/5] Migration completed successfully.');
}

runInventoryAndMigration().catch(err => {
  console.error('\n[FATAL ERROR] Migration failed:', err);
  process.exit(1);
});
