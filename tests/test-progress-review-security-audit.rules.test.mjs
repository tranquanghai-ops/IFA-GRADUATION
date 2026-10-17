import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const roundId = 'audit-round-2026';
const activityId = 'duyet_1';
const councilId = 'hd_kientruc_01';
const student1 = '11900335';
const student2 = '11900382';
const studentOther = '99999999';

const ownerEmail = 'tranquanghai@tdtu.edu.vn';
const adminEmail = 'admin_exam@tdtu.edu.vn';
const chairEmail = 'chair_kts@tdtu.edu.vn';
const memberEmail = 'member_kts@tdtu.edu.vn';
const supervisorAssigned = 'gvhd_assigned@tdtu.edu.vn';
const supervisorUnassigned = 'gvhd_unassigned@tdtu.edu.vn';
const student1Email = `${student1}@student.tdtu.edu.vn`;
const student2Email = `${student2}@student.tdtu.edu.vn`;
const studentOtherEmail = `${studentOther}@student.tdtu.edu.vn`;

const actor = email => ({ email, email_verified: true });

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'progress-review-security-audit',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    // 1. Setup Admins
    await setDoc(doc(db, `admins/${adminEmail}`), { email: adminEmail, active: true });

    // 2. Setup Round Document with Sensitive Deliberation Data
    await setDoc(doc(db, `graduationRounds/${roundId}`), {
      id: roundId,
      name: 'Đợt ĐATN Kiểm thử An ninh',
      status: 'open',
      activities: [
        {
          id: activityId,
          title: 'Duyệt đồ án tốt nghiệp đợt 1',
          councilEnabled: true,
          councils: [
            {
              id: councilId,
              name: 'Hội đồng Kiến trúc 01',
              status: 'finalized',
              chairEmail: chairEmail,
              finalDefenseScores: {
                [student1]: {
                  score: 6.00,
                  letterGrade: 'C',
                  letterLabel: 'Trung bình',
                  formattedScore: '6.00',
                  finalizedAt: '2026-10-15T10:00:00Z'
                },
                [student2]: {
                  score: 7.33,
                  letterGrade: 'B',
                  letterLabel: 'Khá',
                  formattedScore: '7.33',
                  finalizedAt: '2026-10-15T10:00:00Z'
                }
              }
            }
          ]
        }
      ],
      progressReviews: {
        duyet_1: {
          [student1]: {
            roundId,
            studentId: student1,
            phase: '1',
            score: 6.00,
            letterGrade: 'C',
            status: 'failed',
            councilId,
            finalizedAt: '2026-10-15T10:00:00Z'
          },
          [student2]: {
            roundId,
            studentId: student2,
            phase: '1',
            score: 7.33,
            letterGrade: 'B',
            status: 'passed',
            councilId,
            finalizedAt: '2026-10-15T10:00:00Z'
          }
        }
      },
      councilScores: {
        [`${activityId}_${councilId}_${student1}_member1`]: {
          studentId: student1,
          scorerId: 'member1',
          scorerEmail: memberEmail,
          score: 6.0,
          numericValue: 6.0,
          letterGrade: 'C',
          comment: 'Nhận xét bảo mật nội bộ của thành viên 1 về SV 1'
        }
      }
    });

    // 3. Setup Official Assignment for supervisor
    await setDoc(doc(db, `graduationRounds/${roundId}/officialAssignments/${student1}`), {
      studentId: student1,
      assignmentStatus: 'published',
      supervisors: [{ email: supervisorAssigned, name: 'GVHD Assigned' }],
      supervisorIds: [supervisorAssigned],
      supervisorEmails: [supervisorAssigned]
    });

    // 4. Setup Council Memberships
    await setDoc(doc(db, `graduationRounds/${roundId}/councilMemberships/${activityId}_${councilId}_${chairEmail}`), {
      activityId, councilId, memberEmail: chairEmail, role: 'chair', active: true
    });
    await setDoc(doc(db, `graduationRounds/${roundId}/councilMemberships/${activityId}_${councilId}_${memberEmail}`), {
      activityId, councilId, memberEmail: memberEmail, role: 'member', active: true
    });

    // 5. Setup Subcollection reviewDecisions
    await setDoc(doc(db, `graduationRounds/${roundId}/reviewDecisions/${activityId}_${councilId}_${student1}_${memberEmail}`), {
      activityId,
      councilId,
      studentId: student1,
      scorerId: memberEmail,
      scorerEmail: memberEmail,
      decidedBy: memberEmail,
      mode: 'letter',
      value: 'C',
      selectedLetterCode: 'C',
      numericValue: 6.0,
      comment: 'Phiếu chấm riêng của thành viên hội đồng',
      status: 'completed'
    });
  });
});

after(async () => {
  await env?.cleanup();
});

test('Audit Question 1, 2, 3: Pre-publication read leaks in current graduationRounds/{roundId}', async () => {
  // Current rule: allow read: if signedIn();
  const unauthDb = env.unauthenticatedContext().firestore();
  const student1Db = env.authenticatedContext(student1Email, actor(student1Email)).firestore();
  const studentOtherDb = env.authenticatedContext(studentOtherEmail, actor(studentOtherEmail)).firestore();
  const supervisorDb = env.authenticatedContext(supervisorAssigned, actor(supervisorAssigned)).firestore();
  const outsiderDb = env.authenticatedContext(supervisorUnassigned, actor(supervisorUnassigned)).firestore();

  // Unauthenticated user is properly rejected
  await assertFails(getDoc(doc(unauthDb, `graduationRounds/${roundId}`)));

  // BUT: All signed-in users can currently read the entire graduationRounds document!
  const s1Snap = await assertSucceeds(getDoc(doc(student1Db, `graduationRounds/${roundId}`)));
  const sOtherSnap = await assertSucceeds(getDoc(doc(studentOtherDb, `graduationRounds/${roundId}`)));
  const gvhdSnap = await assertSucceeds(getDoc(doc(supervisorDb, `graduationRounds/${roundId}`)));
  const outsiderSnap = await assertSucceeds(getDoc(doc(outsiderDb, `graduationRounds/${roundId}`)));

  // VERIFICATION OF LEAKS:
  // 1. Student reads raw numeric scores (6.00, 7.33)
  assert.equal(s1Snap.data().progressReviews.duyet_1[student1].score, 6.00);
  assert.equal(s1Snap.data().activities[0].councils[0].finalDefenseScores[student1].score, 6.00);

  // 2. Student 1 reads Student 2's score before publication!
  assert.equal(s1Snap.data().progressReviews.duyet_1[student2].score, 7.33);

  // 3. Completely unrelated student reads Student 1 & 2's confidential council scores!
  assert.equal(sOtherSnap.data().progressReviews.duyet_1[student1].score, 6.00);
  assert.equal(sOtherSnap.data().progressReviews.duyet_1[student2].score, 7.33);

  // 4. Unassigned supervisor reads Student 1 & 2's confidential council scores!
  assert.equal(outsiderSnap.data().progressReviews.duyet_1[student1].score, 6.00);

  // 5. If councilScores map is on round document, member's private comment & individual score leaks!
  assert.equal(s1Snap.data().councilScores[`${activityId}_${councilId}_${student1}_member1`].comment,
    'Nhận xét bảo mật nội bộ của thành viên 1 về SV 1');
});

test('Audit Question 4: Can students or supervisors forge or update publishedReviews on graduationRounds?', async () => {
  const student1Db = env.authenticatedContext(student1Email, actor(student1Email)).firestore();
  const supervisorDb = env.authenticatedContext(supervisorAssigned, actor(supervisorAssigned)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actor(adminEmail)).firestore();

  const fakePublication = {
    'publishedReviews.duyet_1': {
      published: true,
      publishedAt: new Date().toISOString(),
      publishedBy: student1Email,
      students: {
        [student1]: { letterGrade: 'A+', isPassed: true, status: 'passed' }
      }
    }
  };

  // Student CANNOT update graduationRounds
  await assertFails(updateDoc(doc(student1Db, `graduationRounds/${roundId}`), fakePublication));

  // Supervisor CANNOT update graduationRounds
  await assertFails(updateDoc(doc(supervisorDb, `graduationRounds/${roundId}`), fakePublication));

  // Only Admin/Owner can update graduationRounds
  await assertSucceeds(updateDoc(doc(adminDb, `graduationRounds/${roundId}`), fakePublication));
});

test('Audit Question 5: Can a council member tamper with finalized councilScores?', async () => {
  const memberDb = env.authenticatedContext(memberEmail, actor(memberEmail)).firestore();
  const chairDb = env.authenticatedContext(chairEmail, actor(chairEmail)).firestore();
  const adminDb = env.authenticatedContext(adminEmail, actor(adminEmail)).firestore();

  // In /councilScores/{scoreId}, when council status is 'finalized', staff update is blocked
  // (L455 requires status in ['preparing', 'active', 'open'])
  const scoreId = `${activityId}_${councilId}_${student1}_${memberEmail}`;

  // Create an initial councilScore via admin
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), `graduationRounds/${roundId}/councilScores/${scoreId}`), {
      roundId, activityId, councilId, studentId: student1, scorerId: memberEmail, scorerEmail: memberEmail,
      scoreId, score: 6.0
    });
    // Set councilAccess status to 'finalized'
    await setDoc(doc(ctx.firestore(), `graduationRounds/${roundId}/councilAccess/${activityId}_${councilId}`), {
      status: 'finalized'
    });
  });

  // Member CANNOT update because council is finalized
  await assertFails(updateDoc(doc(memberDb, `graduationRounds/${roundId}/councilScores/${scoreId}`), {
    score: 9.5
  }));

  // Chair CANNOT update when council is finalized (Chair update at L464 requires status == 'ended')
  await assertFails(updateDoc(doc(chairDb, `graduationRounds/${roundId}/councilScores/${scoreId}`), {
    score: 9.5
  }));

  // In reviewDecisions (subcollection):
  const decisionPath = `graduationRounds/${roundId}/reviewDecisions/${activityId}_${councilId}_${student1}_${memberEmail}`;
  // VERIFY FIX: When council is finalized, member update MUST be blocked!
  await assertFails(updateDoc(doc(memberDb, decisionPath), {
    value: 'A',
    selectedLetterCode: 'A',
    numericValue: 9.5
  }));
});

test('Audit Question 6, 7, 8: Post-publication access and RBAC', async () => {
  const adminDb = env.authenticatedContext(adminEmail, actor(adminEmail)).firestore();
  const ownerDb = env.authenticatedContext(ownerEmail, actor(ownerEmail)).firestore();
  const student1Db = env.authenticatedContext(student1Email, actor(student1Email)).firestore();
  const supervisorDb = env.authenticatedContext(supervisorAssigned, actor(supervisorAssigned)).firestore();

  // 8. Admin & Owner can read and inspect all details
  const adminSnap = await assertSucceeds(getDoc(doc(adminDb, `graduationRounds/${roundId}`)));
  const ownerSnap = await assertSucceeds(getDoc(doc(ownerDb, `graduationRounds/${roundId}`)));
  assert.equal(adminSnap.exists(), true);
  assert.equal(ownerSnap.exists(), true);

  // 6 & 7: Because the current rule is allow read: if signedIn(); on graduationRounds:
  // - Student 1 still reads Student 2's data and all council deliberation
  // - Supervisor still reads all students, not just assigned ones.
  // This demonstrates the necessity of isolating the published data into separate targeted collections/documents!
});
