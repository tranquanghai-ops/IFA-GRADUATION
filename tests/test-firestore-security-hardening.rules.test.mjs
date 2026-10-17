import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const roundId = 'round-security-2026';
const activityId = 'act_duyet_1';
const councilId = 'hd_cntt_01';

// 10 IDENTITIES AS SPECIFIED IN TASK SPECIFICATION:
// 1. Sinh viên A đã công bố
const studentA = '11900382';
const studentAEmail = `${studentA}@student.tdtu.edu.vn`;

// 2. Sinh viên B chưa công bố
const studentB = '11900395';
const studentBEmail = `${studentB}@student.tdtu.edu.vn`;

// 3. Sinh viên ngoài đợt
const studentOther = '99999999';
const studentOtherEmail = `${studentOther}@student.tdtu.edu.vn`;

// 4. GVHD của sinh viên A
const supervisorAssigned = 'gvhd_assigned_a@tdtu.edu.vn';

// 5. GVHD không được phân công
const supervisorUnassigned = 'gvhd_unassigned@tdtu.edu.vn';

// 6. Ủy viên Hội đồng 1 (Chấm SV A)
const member1Email = 'member1_cntt@tdtu.edu.vn';

// 7. Ủy viên Hội đồng 2 (Chấm SV A)
const member2Email = 'member2_cntt@tdtu.edu.vn';

// 8. Admin
const adminEmail = 'admin_exam@tdtu.edu.vn';

// 9. Owner
const ownerEmail = 'tranquanghai@tdtu.edu.vn';

// 10. Người dùng đăng nhập không có vai trò
const generalUserEmail = 'outsider_guest@gmail.com';

const actor = email => ({ email, email_verified: true });

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'firestore-security-hardening-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });

  // Setup database fixtures with security rules disabled
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    // 1. Admin & Owner
    await setDoc(doc(db, `admins/${adminEmail}`), { email: adminEmail, active: true });

    // 2. Round Metadata (Tier A - Public Info Only, No Sensitive Deliberation Data)
    await setDoc(doc(db, `graduationRounds/${roundId}`), {
      id: roundId,
      name: 'Đợt Đồ án Tốt nghiệp CNTT 2026',
      status: 'open',
      academicYear: '2025-2026',
      activities: [
        {
          id: activityId,
          title: 'Duyệt đồ án tốt nghiệp đợt 1',
          councilEnabled: true,
          councils: [
            {
              id: councilId,
              name: 'Hội đồng CNTT 01',
              status: 'active'
            }
          ]
        }
      ],
      publishedReviews: {
        duyet_1: {
          status: 'published',
          isPublished: true,
          phase: 1,
          activityId: activityId,
          publishedAt: '2026-10-16T10:00:00.000Z',
          publicationVersion: 1
          // NOTICE: NO studentResults map on root document!
        }
      }
    });

    // 3. Official Supervisor Assignment for Student A
    await setDoc(doc(db, `graduationRounds/${roundId}/officialAssignments/${studentA}`), {
      studentId: studentA,
      assignmentStatus: 'published',
      supervisors: [{ email: supervisorAssigned, name: 'GVHD Nguyễn Văn A' }],
      supervisorIds: [supervisorAssigned],
      supervisorEmails: [supervisorAssigned]
    });

    // 4. Council Memberships
    await setDoc(doc(db, `graduationRounds/${roundId}/councilMemberships/${activityId}_${councilId}_${member1Email}`), {
      activityId, councilId, memberEmail: member1Email, role: 'chair', active: true
    });
    await setDoc(doc(db, `graduationRounds/${roundId}/councilMemberships/${activityId}_${councilId}_${member2Email}`), {
      activityId, councilId, memberEmail: member2Email, role: 'member', active: true
    });

    // 5. Council Student Assignments
    await setDoc(doc(db, `graduationRounds/${roundId}/councilStudentAssignments/${activityId}_${studentA}`), {
      activityId, councilId, studentId: studentA, active: true
    });

    // 6. Council Access Status
    await setDoc(doc(db, `graduationRounds/${roundId}/councilAccess/${activityId}_${councilId}`), {
      status: 'active'
    });

    // 7. Private Grading (Tier B): Member 1 and Member 2 scoring sheets
    await setDoc(doc(db, `graduationRounds/${roundId}/reviewDecisions/${activityId}_${councilId}_${studentA}_${member1Email}`), {
      activityId,
      councilId,
      studentId: studentA,
      scorerId: member1Email,
      scorerEmail: member1Email,
      decidedBy: member1Email,
      mode: 'letter',
      value: 'B',
      selectedLetterCode: 'B',
      numericValue: 7.5,
      comment: 'Bảo mật: Nhận xét nội bộ thành viên 1 về SV A',
      status: 'completed'
    });
    await setDoc(doc(db, `graduationRounds/${roundId}/reviewDecisions/${activityId}_${councilId}_${studentA}_${member2Email}`), {
      activityId,
      councilId,
      studentId: studentA,
      scorerId: member2Email,
      scorerEmail: member2Email,
      decidedBy: member2Email,
      mode: 'letter',
      value: 'B',
      selectedLetterCode: 'B',
      numericValue: 7.5,
      comment: 'Bảo mật: Nhận xét nội bộ thành viên 2 về SV A',
      status: 'completed'
    });

    // 8. Published Student Results (Tier C):
    // Student A is PUBLISHED
    await setDoc(doc(db, `graduationRounds/${roundId}/publishedStudentResults/${studentA}`), {
      studentId: studentA,
      studentName: 'Trang Trần Tuệ Nhã',
      roundId,
      status: 'published',
      isPublished: true,
      reviews: {
        duyet_1: {
          phase: 1,
          activityId,
          letterGrade: 'B',
          isPassed: true,
          status: 'published',
          publishedAt: '2026-10-16T10:00:00.000Z',
          publicationVersion: 1
        }
      }
    });

    // Student B is UNPUBLISHED / DRAFT
    await setDoc(doc(db, `graduationRounds/${roundId}/publishedStudentResults/${studentB}`), {
      studentId: studentB,
      studentName: 'Nguyễn Khánh Thịnh',
      roundId,
      status: 'draft',
      isPublished: false,
      reviews: {
        duyet_1: {
          phase: 1,
          activityId,
          letterGrade: 'C',
          isPassed: false,
          status: 'draft'
        }
      }
    });

    // 9. Subcollection reviews/{phaseKey} fixtures (Isolated per-phase documents)
    await setDoc(doc(db, `graduationRounds/${roundId}/publishedStudentResults/${studentA}/reviews/duyet_1`), {
      phase: 1,
      activityId,
      letterGrade: 'B',
      isPassed: true,
      status: 'published',
      publishedAt: '2026-10-16T10:00:00.000Z',
      publicationVersion: 1
    });
    await setDoc(doc(db, `graduationRounds/${roundId}/publishedStudentResults/${studentA}/reviews/duyet_2`), {
      phase: 2,
      activityId: 'act_duyet_2',
      letterGrade: 'A',
      isPassed: true,
      status: 'published',
      publishedAt: '2026-10-16T12:00:00.000Z',
      publicationVersion: 1
    });
    await setDoc(doc(db, `graduationRounds/${roundId}/publishedStudentResults/${studentB}/reviews/duyet_1`), {
      phase: 1,
      activityId,
      letterGrade: 'C',
      isPassed: false,
      status: 'draft'
    });
  });
});

after(async () => {
  await env?.cleanup();
});

// =========================================================================
// TEST SUITE 1: TẦNG A — ROUND METADATA READ ACCESS
// =========================================================================
test('1. Round metadata (Tier A) is readable by all signed-in users', async () => {
  const identities = [
    studentAEmail, studentBEmail, studentOtherEmail,
    supervisorAssigned, supervisorUnassigned,
    member1Email, member2Email, adminEmail, ownerEmail, generalUserEmail
  ];

  for (const email of identities) {
    const userDb = env.authenticatedContext(email, actor(email)).firestore();
    const snap = await assertSucceeds(getDoc(doc(userDb, `graduationRounds/${roundId}`)));
    assert.equal(snap.exists(), true);
    // Verified: No sensitive member deliberation data exists on root doc!
    assert.equal(snap.data().councilScores, undefined);
    assert.equal(snap.data().progressReviews, undefined);
    assert.equal(snap.data().publishedReviews?.duyet_1?.studentResults, undefined);
  }
});

// =========================================================================
// TEST SUITE 2: TẦNG B — PRIVATE GRADING STORAGE LEAST-PRIVILEGE RBAC
// =========================================================================
test('2. Private member scoring sheets (Tier B) cannot be read by students or general users', async () => {
  const studentADb = env.authenticatedContext(studentAEmail, actor(studentAEmail)).firestore();
  const studentBDb = env.authenticatedContext(studentBEmail, actor(studentBEmail)).firestore();
  const generalDb = env.authenticatedContext(generalUserEmail, actor(generalUserEmail)).firestore();

  const decisionPath = `graduationRounds/${roundId}/reviewDecisions/${activityId}_${councilId}_${studentA}_${member1Email}`;

  // Students attempting to inspect member 1's scoring sheet must be DENIED
  await assertFails(getDoc(doc(studentADb, decisionPath)));
  await assertFails(getDoc(doc(studentBDb, decisionPath)));
  await assertFails(getDoc(doc(generalDb, decisionPath)));
});

test('3. Council members can read scoring sheets within their assigned council, while unassigned teachers cannot', async () => {
  const member1Db = env.authenticatedContext(member1Email, actor(member1Email)).firestore();
  const unassignedGvhdDb = env.authenticatedContext(supervisorUnassigned, actor(supervisorUnassigned)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actor(adminEmail)).firestore();

  const decisionPath = `graduationRounds/${roundId}/reviewDecisions/${activityId}_${councilId}_${studentA}_${member1Email}`;

  // Council member 1 can read
  const m1Snap = await assertSucceeds(getDoc(doc(member1Db, decisionPath)));
  assert.equal(m1Snap.data().value, 'B');

  // Admin can read
  const adminSnap = await assertSucceeds(getDoc(doc(adminDb, decisionPath)));
  assert.equal(adminSnap.data().value, 'B');

  // Teacher NOT in this council CANNOT read (Securing least privilege)
  await assertFails(getDoc(doc(unassignedGvhdDb, decisionPath)));
});

test('4. Council members cannot tamper with scores after council is finalized', async () => {
  const member1Db = env.authenticatedContext(member1Email, actor(member1Email)).firestore();
  const decisionPath = `graduationRounds/${roundId}/reviewDecisions/${activityId}_${councilId}_${studentA}_${member1Email}`;

  // Update while active: Succeeds
  await assertSucceeds(updateDoc(doc(member1Db, decisionPath), {
    numericValue: 7.5,
    updatedAt: new Date().toISOString()
  }));

  // Finalize council status in councilAccess
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), `graduationRounds/${roundId}/councilAccess/${activityId}_${councilId}`), {
      status: 'finalized'
    });
  });

  // Once finalized, member update MUST be blocked!
  await assertFails(updateDoc(doc(member1Db, decisionPath), {
    numericValue: 9.9
  }));

  // Restore council status to active
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), `graduationRounds/${roundId}/councilAccess/${activityId}_${councilId}`), {
      status: 'active'
    });
  });
});

test('5. Non-members and students cannot write or forge reviewDecisions', async () => {
  const studentADb = env.authenticatedContext(studentAEmail, actor(studentAEmail)).firestore();
  const fakeDecisionPath = `graduationRounds/${roundId}/reviewDecisions/${activityId}_${councilId}_${studentA}_fake`;

  await assertFails(setDoc(doc(studentADb, fakeDecisionPath), {
    value: 'A',
    score: 10
  }));
});

// =========================================================================
// TEST SUITE 3: TẦNG C — PUBLISHED STUDENT RESULTS (LEAST-PRIVILEGE RBAC)
// =========================================================================
test('6. Student A can read own published results, but CANNOT read Student B results', async () => {
  const studentADb = env.authenticatedContext(studentAEmail, actor(studentAEmail)).firestore();

  // Student A reads own published record: SUCCESS
  const aSnap = await assertSucceeds(getDoc(doc(studentADb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}`)));
  assert.equal(aSnap.data().reviews.duyet_1.letterGrade, 'B');
  assert.equal(aSnap.data().reviews.duyet_1.isPassed, true);

  // Student A attempts to read Student B record: DENIED
  await assertFails(getDoc(doc(studentADb, `graduationRounds/${roundId}/publishedStudentResults/${studentB}`)));
});

test('7. Student B cannot read own results while status is draft / unpublished', async () => {
  const studentBDb = env.authenticatedContext(studentBEmail, actor(studentBEmail)).firestore();

  // Unpublished result is protected at rules level
  await assertFails(getDoc(doc(studentBDb, `graduationRounds/${roundId}/publishedStudentResults/${studentB}`)));
});

test('8. Student outside round cannot read published results of round students', async () => {
  const studentOtherDb = env.authenticatedContext(studentOtherEmail, actor(studentOtherEmail)).firestore();

  await assertFails(getDoc(doc(studentOtherDb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}`)));
  await assertFails(getDoc(doc(studentOtherDb, `graduationRounds/${roundId}/publishedStudentResults/${studentB}`)));
});

test('9. Officially assigned GVHD can read Student A results, while unassigned GVHD is DENIED', async () => {
  const assignedGvhdDb = env.authenticatedContext(supervisorAssigned, actor(supervisorAssigned)).firestore();
  const unassignedGvhdDb = env.authenticatedContext(supervisorUnassigned, actor(supervisorUnassigned)).firestore();

  // Assigned GVHD reads Student A: SUCCESS
  const gvSnap = await assertSucceeds(getDoc(doc(assignedGvhdDb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}`)));
  assert.equal(gvSnap.data().reviews.duyet_1.letterGrade, 'B');

  // Unassigned GVHD attempts to read Student A: DENIED
  await assertFails(getDoc(doc(unassignedGvhdDb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}`)));
});

test('10. Students and GVHD CANNOT list/query the entire publishedStudentResults collection', async () => {
  const studentADb = env.authenticatedContext(studentAEmail, actor(studentAEmail)).firestore();
  const assignedGvhdDb = env.authenticatedContext(supervisorAssigned, actor(supervisorAssigned)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actor(adminEmail)).firestore();

  const colRef = collection(studentADb, `graduationRounds/${roundId}/publishedStudentResults`);
  const gvColRef = collection(assignedGvhdDb, `graduationRounds/${roundId}/publishedStudentResults`);
  const adminColRef = collection(adminDb, `graduationRounds/${roundId}/publishedStudentResults`);

  // Student query collection: DENIED
  await assertFails(getDocs(colRef));

  // GVHD query collection: DENIED
  await assertFails(getDocs(gvColRef));

  // Admin query collection: SUCCEEDS
  const adminSnap = await assertSucceeds(getDocs(adminColRef));
  assert.equal(adminSnap.docs.length >= 2, true);
});

// =========================================================================
// TEST SUITE 4: REVOCATION OF PUBLICATION (THU HỒI CÔNG BỐ)
// =========================================================================
test('11. Revoking publication strictly blocks Student and GVHD read access at Rules level', async () => {
  const studentADb = env.authenticatedContext(studentAEmail, actor(studentAEmail)).firestore();
  const assignedGvhdDb = env.authenticatedContext(supervisorAssigned, actor(supervisorAssigned)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actor(adminEmail)).firestore();

  // Admin revokes publication for Student A
  const stDocRef = doc(adminDb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}`);
  await assertSucceeds(updateDoc(stDocRef, {
    status: 'revoked',
    isPublished: false,
    'reviews.duyet_1.status': 'revoked',
    'reviews.duyet_1.isPublished': false,
    revokedAt: new Date().toISOString(),
    revokeReason: 'Phát hiện sai sót trong biên bản đối soát'
  }));

  // Student A attempts to getDoc after revocation: MUST BE DENIED!
  await assertFails(getDoc(doc(studentADb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}`)));

  // Assigned GVHD attempts to getDoc after revocation: MUST BE DENIED!
  await assertFails(getDoc(doc(assignedGvhdDb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}`)));

  // Admin can still inspect revoked document for governance: SUCCEEDS
  const adminSnap = await assertSucceeds(getDoc(stDocRef));
  assert.equal(adminSnap.data().status, 'revoked');

  // Re-publication test: Admin re-publishes
  await assertSucceeds(updateDoc(stDocRef, {
    status: 'published',
    isPublished: true,
    'reviews.duyet_1.status': 'published',
    'reviews.duyet_1.isPublished': true,
    publishedAt: new Date().toISOString(),
    publicationVersion: 2
  }));

  // Student A can read again after re-publication
  const rePubSnap = await assertSucceeds(getDoc(doc(studentADb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}`)));
  assert.equal(rePubSnap.data().reviews.duyet_1.letterGrade, 'B');
});

// =========================================================================
// TEST SUITE 5: IMMUTABLE AUDIT LOGS & PERMISSION CHECKS
// =========================================================================
test('12. Audit logs are immutable (append-only) and cannot be modified or deleted', async () => {
  const adminDb = env.authenticatedContext(adminEmail, actor(adminEmail)).firestore();
  const studentADb = env.authenticatedContext(studentAEmail, actor(studentAEmail)).firestore();

  const logId = `audit_test_${Date.now()}`;
  const logRef = doc(adminDb, `auditLogs/${logId}`);

  // Admin can append audit log
  await assertSucceeds(setDoc(logRef, {
    action: 'ADJUST_COUNCIL_SCORE',
    actorEmail: adminEmail,
    roundId,
    timestamp: new Date().toISOString()
  }));

  // Modification attempt: MUST BE DENIED
  await assertFails(updateDoc(logRef, { action: 'TAMPERED_ACTION' }));

  // Deletion attempt: MUST BE DENIED
  await assertFails(deleteDoc(logRef));

  // Student cannot read or delete audit log
  await assertFails(getDoc(doc(studentADb, `auditLogs/${logId}`)));
  await assertFails(deleteDoc(doc(studentADb, `auditLogs/${logId}`)));
});

// =========================================================================
// TEST SUITE 6: INDEPENDENT MULTI-PHASE REVOCATION & SUBCOLLECTION ISOLATION
// =========================================================================
test('13. Multi-phase independent revocation: Revoking Phase 1 blocks reading Phase 1 via SDK, while Phase 2 remains readable', async () => {
  const studentADb = env.authenticatedContext(studentAEmail, actor(studentAEmail)).firestore();
  const assignedGvhdDb = env.authenticatedContext(supervisorAssigned, actor(supervisorAssigned)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actor(adminEmail)).firestore();

  const phase1Path = `graduationRounds/${roundId}/publishedStudentResults/${studentA}/reviews/duyet_1`;
  const phase2Path = `graduationRounds/${roundId}/publishedStudentResults/${studentA}/reviews/duyet_2`;

  // 1. Initial State: Both Phase 1 and Phase 2 are published and readable
  const p1SnapInitial = await assertSucceeds(getDoc(doc(studentADb, phase1Path)));
  assert.equal(p1SnapInitial.data().letterGrade, 'B');

  const p2SnapInitial = await assertSucceeds(getDoc(doc(studentADb, phase2Path)));
  assert.equal(p2SnapInitial.data().letterGrade, 'A');

  // 2. Admin revokes ONLY Phase 1 (Duyệt 1)
  await assertSucceeds(updateDoc(doc(adminDb, phase1Path), {
    status: 'revoked',
    isPublished: false,
    revokedAt: new Date().toISOString(),
    revokeReason: 'Thu hồi Duyệt 1 để phúc tra'
  }));

  // 3. Student A reading Phase 1 (duyet_1) MUST BE REJECTED by Firestore Rules
  await assertFails(getDoc(doc(studentADb, phase1Path)));

  // 4. Assigned GVHD reading Phase 1 MUST ALSO BE REJECTED
  await assertFails(getDoc(doc(assignedGvhdDb, phase1Path)));

  // 5. Phase 2 (duyet_2) is NOT lost and MUST REMAIN READABLE by Student A and GVHD!
  const p2SnapPostRevoke = await assertSucceeds(getDoc(doc(studentADb, phase2Path)));
  assert.equal(p2SnapPostRevoke.data().letterGrade, 'A');
  assert.equal(p2SnapPostRevoke.data().status, 'published');

  const gvP2Snap = await assertSucceeds(getDoc(doc(assignedGvhdDb, phase2Path)));
  assert.equal(gvP2Snap.data().letterGrade, 'A');

  // 6. Admin can still inspect revoked Phase 1 document for governance
  const adminP1Snap = await assertSucceeds(getDoc(doc(adminDb, phase1Path)));
  assert.equal(adminP1Snap.data().status, 'revoked');

  // 7. Re-publication: Admin re-publishes Phase 1
  await assertSucceeds(updateDoc(doc(adminDb, phase1Path), {
    status: 'published',
    isPublished: true,
    publishedAt: new Date().toISOString(),
    publicationVersion: 2
  }));

  // 8. Student A and GVHD can read Phase 1 again after re-publication
  const p1SnapRePub = await assertSucceeds(getDoc(doc(studentADb, phase1Path)));
  assert.equal(p1SnapRePub.data().letterGrade, 'B');
  assert.equal(p1SnapRePub.data().status, 'published');
});

test('14. Subcollection reviews/{phaseKey} strictly enforces least-privilege RBAC', async () => {
  const studentADb = env.authenticatedContext(studentAEmail, actor(studentAEmail)).firestore();
  const studentBDb = env.authenticatedContext(studentBEmail, actor(studentBEmail)).firestore();
  const studentOtherDb = env.authenticatedContext(studentOtherEmail, actor(studentOtherEmail)).firestore();
  const assignedGvhdDb = env.authenticatedContext(supervisorAssigned, actor(supervisorAssigned)).firestore();
  const unassignedGvhdDb = env.authenticatedContext(supervisorUnassigned, actor(supervisorUnassigned)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actor(adminEmail)).firestore();

  const studentAPhase2 = `graduationRounds/${roundId}/publishedStudentResults/${studentA}/reviews/duyet_2`;
  const studentBPhase1 = `graduationRounds/${roundId}/publishedStudentResults/${studentB}/reviews/duyet_1`;

  // 1. Student B CANNOT read Student A's review
  await assertFails(getDoc(doc(studentBDb, studentAPhase2)));

  // 2. Student outside round CANNOT read Student A's review
  await assertFails(getDoc(doc(studentOtherDb, studentAPhase2)));

  // 3. Unassigned teacher CANNOT read Student A's review
  await assertFails(getDoc(doc(unassignedGvhdDb, studentAPhase2)));

  // 4. Student B CANNOT read own review while in draft/unpublished status
  await assertFails(getDoc(doc(studentBDb, studentBPhase1)));

  // 5. Non-admin users CANNOT list the subcollection
  await assertFails(getDocs(collection(studentADb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}/reviews`)));
  await assertFails(getDocs(collection(assignedGvhdDb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}/reviews`)));

  // 6. Admin CAN list subcollection
  const adminColSnap = await assertSucceeds(getDocs(collection(adminDb, `graduationRounds/${roundId}/publishedStudentResults/${studentA}/reviews`)));
  assert.equal(adminColSnap.docs.length >= 2, true);

  // 7. Non-admin users CANNOT write, forge, or tamper with review docs
  await assertFails(setDoc(doc(studentADb, studentAPhase2), { letterGrade: 'A+' }));
  await assertFails(deleteDoc(doc(studentADb, studentAPhase2)));
});
