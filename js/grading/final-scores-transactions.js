/**
 * IFA+ Graduation — Council Scores & Supervisor Score Transactions
 */
window.sanitizeFirestoreKey = function(key) {
  if (!key) return 'unknown';
  return String(key).replace(/[\/\\]/g, '_').replace(/\s+/g, '_');
};

// 1. COUNCIL SCORES SUBCOLLECTION HELPERS (NEW-WRITE + DUAL-READ)
window.buildDeterministicCouncilScoreId = function(activityId, councilId, studentId, scorerId) {
  const act = sanitizeFirestoreKey(activityId);
  const cId = sanitizeFirestoreKey(councilId);
  const stId = sanitizeFirestoreKey(studentId);
  const scId = sanitizeFirestoreKey(scorerId);
  return `${act}_${cId}_${stId}_${scId}`;
};

window.saveCouncilScoreRecord = async function(roundId, scoreData) {
  if (!checkImpersonationWriteGuard('Lưu điểm đánh giá hội đồng')) return { success: false, error: 'Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm.' };
  if (!roundId || !scoreData) return { success: false, error: 'Thiếu thông tin roundId hoặc scoreData' };

  const actId = scoreData.activityId;
  const cId = scoreData.councilId;
  const stId = scoreData.studentId;
  const scId = scoreData.scorerId || (scoreData.scorerEmail ? scoreData.scorerEmail.split('@')[0] : 'scorer');
  const scoreId = buildDeterministicCouncilScoreId(actId, cId, stId, scId);

  // Clean document payload
  const docPayload = {
    roundId,
    activityId: actId,
    councilId: cId,
    studentId: stId,
    studentName: scoreData.studentName || '',
    scorerId: scId,
    scorerEmail: scoreData.scorerEmail || '',
    scorerName: scoreData.scorerName || '',
    role: scoreData.role || 'member',
    mode: scoreData.scoreMode || 'defense_rubric',
    score: scoreData.score ?? null,
    total: scoreData.score ?? null,
    rubricScores: scoreData.rubricScores || {},
    components: scoreData.components || {},
    feedback: scoreData.feedback || '',
    status: scoreData.status || 'draft',
    isGuest: Boolean(scoreData.isGuest),
    isOfficialScorer: scoreData.isOfficialScorer !== false,
    calibration: scoreData.calibration || null,
    updatedAt: new Date().toISOString()
  };

  // 1. New Write: Save to subcollection /graduationRounds/{roundId}/councilScores/{scoreId}
  let subcolSuccess = false;
  try {
    const scoreRef = doc(db, 'graduationRounds', roundId, 'councilScores', scoreId);
    await setDoc(scoreRef, docPayload, { merge: true });
    subcolSuccess = true;
  } catch (err) {
    console.warn('Notice: Subcollection councilScores write pending rules approval:', err.message);
  }

  // 2. Phase B Activated: New writes go strictly to subcollection /graduationRounds/{roundId}/councilScores/{scoreId}.
  // We do NOT write into the parent round document to prevent document size bloat.
  const legacyKey = `${actId}_${cId}_${stId}_${scId}`;

  // Update local memory
  if (!state.councilScores) state.councilScores = {};
  state.councilScores[legacyKey] = docPayload;

  return { success: true, scoreId, docPayload, subcolSuccess };
};

window.getCouncilScoreRecord = async function({ roundId, activityId, councilId, studentId, scorerId, fallbackRound }) {
  const act = sanitizeFirestoreKey(activityId);
  const cId = sanitizeFirestoreKey(councilId);
  const st = sanitizeFirestoreKey(studentId);
  const sc = sanitizeFirestoreKey(scorerId);
  const scoreId = `${act}_${cId}_${st}_${sc}`;
  const legacyKey = scoreId;

  // 1. Primary: Try reading from Subcollection
  try {
    const scoreRef = doc(db, 'graduationRounds', roundId, 'councilScores', scoreId);
    const snap = await getDoc(scoreRef);
    if (snap && snap.exists()) {
      return snap.data();
    }
  } catch (e) {}

  // 2. Fallback: Read from in-memory state or fallbackRound.councilScores
  if (state.councilScores?.[legacyKey]) {
    return state.councilScores[legacyKey];
  }
  if (fallbackRound?.councilScores?.[legacyKey]) {
    return fallbackRound.councilScores[legacyKey];
  }

  return null;
};


// 4. FIRST-COMPLETED-WINS TRANSACTIONS (GVHD & TM HD)
window.submitSupervisorScoreTransaction = async function({ roundId, studentId, supervisorId, supervisorEmail, supervisorName, score, feedback, isCompleted }) {
  if (!checkImpersonationWriteGuard('Ghi nhận điểm GVHD')) throw new Error('Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm');
  const roundRef = doc(db, 'graduationRounds', roundId);
  const now = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const roundSnap = await transaction.get(roundRef);
    if (!roundSnap.exists()) {
      throw new Error('Đợt tốt nghiệp không tồn tại.');
    }

    const roundData = roundSnap.data();
    const existing = roundData.supervisorScores?.[studentId];

    // ATOMIC CHECK: First completed wins
    if (isCompleted && existing?.status === 'completed' && existing.submittedBySupervisorId !== supervisorId && !state.isAdmin) {
      throw new Error(`Điểm GVHD đã được hoàn tất trước bởi ${existing.submittedByName || 'giảng viên khác'}.`);
    }

    const newRecord = {
      roundId,
      studentId,
      score: isNaN(score) ? null : score,
      comment: feedback || '',
      submittedBySupervisorId: supervisorId,
      submittedByName: supervisorName,
      submittedByEmail: supervisorEmail,
      decidedBy: supervisorEmail,
      supervisorEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };

    transaction.update(roundRef, {
      [`supervisorScores.${studentId}`]: newRecord,
      updatedAt: serverTimestamp()
    });

    return newRecord;
  });
};

window.submitThesisScoreHDTransaction = async function({ roundId, studentId, supervisorId, supervisorEmail, supervisorName, score, feedback, isCompleted }) {
  if (!checkImpersonationWriteGuard('Ghi nhận điểm Đồ án HD')) throw new Error('Chế độ đóng vai (Chỉ đọc) không cho phép ghi điểm');
  const roundRef = doc(db, 'graduationRounds', roundId);
  const now = new Date().toISOString();

  return await runTransaction(db, async (transaction) => {
    const roundSnap = await transaction.get(roundRef);
    if (!roundSnap.exists()) {
      throw new Error('Đợt tốt nghiệp không tồn tại.');
    }

    const roundData = roundSnap.data();
    const existing = roundData.thesisScores?.[studentId]?.hd;

    // ATOMIC CHECK: First completed wins
    if (isCompleted && existing?.status === 'completed' && existing.submittedBySupervisorId !== supervisorId && !state.isAdmin) {
      throw new Error(`Điểm TM HD đã được hoàn tất trước bởi ${existing.submittedByName || 'giảng viên khác'}.`);
    }

    const newRecord = {
      roundId,
      studentId,
      score: isNaN(score) ? null : score,
      comment: feedback || '',
      submittedBySupervisorId: supervisorId,
      submittedByName: supervisorName,
      submittedByEmail: supervisorEmail,
      status: isCompleted ? 'completed' : 'draft',
      updatedAt: now,
      completedAt: isCompleted ? (existing?.completedAt || now) : null
    };

    transaction.update(roundRef, {
      [`thesisScores.${studentId}.hd`]: newRecord,
      updatedAt: serverTimestamp()
    });

    return newRecord;
  });
};

// --- SUBMODULE WINDOW BRIDGE ---
if (typeof window !== 'undefined') {
  if (typeof getStudentDefenseScore !== 'undefined') window.getStudentDefenseScore = getStudentDefenseScore;
  if (typeof getFinalScore !== 'undefined') window.getFinalScore = getFinalScore;
  if (typeof computeRoundRanking !== 'undefined') window.computeRoundRanking = computeRoundRanking;
  if (typeof sanitizeExcelCell !== 'undefined') window.sanitizeExcelCell = sanitizeExcelCell;
  if (typeof sanitizeSheetName !== 'undefined') window.sanitizeSheetName = sanitizeSheetName;
  if (typeof fmtToday !== 'undefined') window.fmtToday = fmtToday;
}
