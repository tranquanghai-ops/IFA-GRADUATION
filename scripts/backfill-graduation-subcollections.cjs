/**
 * IFA+ GRADUATION DATA MIGRATION — BACKFILL TOOL (PHASE C PREPARATION)
 * Default Mode: DRY_RUN = true
 * DO NOT RUN AGAINST PRODUCTION WITHOUT EXPLICIT APPROVAL AND BACKUP!
 */

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default TRUE

console.log('===============================================================');
console.log(' IFA+ GRADUATION SUBCOLLECTIONS BACKFILL TOOL');
console.log(` Mode: ${DRY_RUN ? 'DRY-RUN (NO CHANGES WILL BE WRITTEN)' : 'LIVE-EXECUTION'}`);
console.log('===============================================================');

function planBackfill(roundDoc) {
  const roundId = roundDoc.id || 'sample_round';
  const stats = {
    councilScores: { wouldCreate: 0, wouldSkip: 0, conflicts: 0, items: [] },
    submissions: { wouldCreate: 0, wouldSkip: 0, conflicts: 0, items: [] },
    auditLogs: { wouldCreate: 0, wouldSkip: 0, conflicts: 0, items: [] }
  };

  // 1. Plan councilScores migration
  const legacyScores = roundDoc.councilScores || {};
  Object.keys(legacyScores).forEach(scoreKey => {
    const score = legacyScores[scoreKey];
    if (!score) {
      stats.councilScores.wouldSkip++;
      return;
    }
    const actId = score.activityId || 'act';
    const cId = score.councilId || 'c';
    const stId = score.studentId || 'st';
    const scId = score.scorerId || (score.scorerEmail ? score.scorerEmail.split('@')[0] : 'sc');
    const docId = `${actId}_${cId}_${stId}_${scId}`;

    stats.councilScores.wouldCreate++;
    stats.councilScores.items.push({
      targetPath: `/graduationRounds/${roundId}/councilScores/${docId}`,
      sourceKey: scoreKey,
      score: score.score,
      scorerEmail: score.scorerEmail
    });
  });

  // 2. Plan submissions migration
  const legacySubmissions = roundDoc.activitySubmissions || {};
  Object.keys(legacySubmissions).forEach(actId => {
    const actMap = legacySubmissions[actId] || {};
    Object.keys(actMap).forEach(studentId => {
      const studentEntry = actMap[studentId] || {};
      const attempts = Array.isArray(studentEntry.attempts) ? studentEntry.attempts : (studentEntry.currentSubmission ? [studentEntry.currentSubmission] : []);
      attempts.forEach((att, idx) => {
        const attNum = att.attempt || (idx + 1);
        const docId = `${actId}_${studentId}_att${attNum}`;
        stats.submissions.wouldCreate++;
        stats.submissions.items.push({
          targetPath: `/graduationRounds/${roundId}/submissions/${docId}`,
          studentId,
          activityId: actId,
          attempt: attNum,
          receiptId: att.receiptId
        });
      });
    });
  });

  // 3. Plan auditLogs migration
  const legacyAudit = Array.isArray(roundDoc.auditLogs) ? roundDoc.auditLogs : [];
  legacyAudit.forEach((log, idx) => {
    const docId = log.id || `log_${idx}_${Date.now()}`;
    stats.auditLogs.wouldCreate++;
    stats.auditLogs.items.push({
      targetPath: `/graduationRounds/${roundId}/auditLogs/${docId}`,
      action: log.action,
      by: log.by,
      timestamp: log.timestamp
    });
  });

  return stats;
}

// Self-test with sample mock round data
const sampleRound = {
  id: 'TN_09_2026',
  councilScores: {
    'act1_council1_12100314_gv01': {
      activityId: 'act1',
      councilId: 'council1',
      studentId: '12100314',
      scorerId: 'gv01',
      scorerEmail: 'gv01@tdtu.edu.vn',
      score: 9.5
    }
  },
  activitySubmissions: {
    'act_tm': {
      '12100314': {
        attempts: [
          { attempt: 1, receiptId: 'REC-001' },
          { attempt: 2, receiptId: 'REC-002' }
        ]
      }
    }
  },
  auditLogs: [
    { id: 'log_01', action: 'Chốt kết quả đợt', by: 'admin@tdtu.edu.vn', timestamp: '2026-09-16T10:00:00Z' }
  ]
};

const plan = planBackfill(sampleRound);

console.log('\n--- BACKFILL PLAN SUMMARY (DRY-RUN) ---');
console.log(`• Council Scores : Would create ${plan.councilScores.wouldCreate} docs (Skip: ${plan.councilScores.wouldSkip}, Conflicts: ${plan.councilScores.conflicts})`);
console.log(`• Submissions    : Would create ${plan.submissions.wouldCreate} docs (Skip: ${plan.submissions.wouldSkip}, Conflicts: ${plan.submissions.conflicts})`);
console.log(`• Audit Logs     : Would create ${plan.auditLogs.wouldCreate} docs (Skip: ${plan.auditLogs.wouldSkip}, Conflicts: ${plan.auditLogs.conflicts})`);
console.log('---------------------------------------------------------------');
console.log('STATUS: Dry-run completed. Zero mutations applied.\n');

module.exports = { planBackfill };