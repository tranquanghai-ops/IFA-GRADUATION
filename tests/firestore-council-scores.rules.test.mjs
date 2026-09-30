import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

const projectId = 'tknt-tdtu-test';
const roundId = 'test-council-round';
const chairEmail = 'tranquanghai@tdtu.edu.vn';
const memberEmail = 'member@tdtu.edu.vn';
const guestEmail = 'guest@gmail.com';
const scorePath = `graduationRounds/${roundId}/reviewDecisions/act_1_council_1_12345678_member1`;
const guestScorePath = `graduationRounds/${roundId}/reviewDecisions/act_1_council_1_12345678_${guestEmail}`;
const auth = email => ({ email, email_verified: true });
let env;

const score = email => ({
  activityId: 'act_1', councilId: 'council_1', studentId: '12345678',
  scorerId: 'member1', scorerEmail: email, scorerName: 'Thành viên',
  decidedBy: email, supervisorEmail: email, slotKey: 'chair', role: 'chair',
  mode: 'letter', value: 'B-', selectedLetterCode: 'B-',
  selectedLetterNumericValue: 6.5, numericValue: 6.5, comment: '',
  status: 'completed', createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
  completedAt: '2026-09-30T00:00:00.000Z'
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});
after(async () => { await env?.cleanup(); });

test('Chair and staff can save a letter score', async () => {
  const chairDb = env.authenticatedContext(chairEmail, auth(chairEmail)).firestore();
  const staffDb = env.authenticatedContext(memberEmail, auth(memberEmail)).firestore();
  await assertSucceeds(setDoc(doc(chairDb, scorePath), score(chairEmail)));
  await assertSucceeds(setDoc(doc(staffDb, scorePath), score(memberEmail), { merge: true }));
  const saved = await assertSucceeds(getDoc(doc(staffDb, scorePath)));
  assert.equal(saved.data().value, 'B-');
});

test('Assigned external guest can read profile and save only their own council score', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, `graduationRounds/${roundId}/councilMemberships/act_1_council_1_${guestEmail}`), {
      activityId: 'act_1', councilId: 'council_1', memberEmail: guestEmail, active: true, role: 'external'
    });
    await setDoc(doc(adminDb, `graduationRounds/${roundId}/councilStudentAssignments/act_1_12345678`), {
      activityId: 'act_1', councilId: 'council_1', studentId: '12345678', active: true,
      fullName: 'Sinh viên A', topicTitle: 'Đề tài A', supervisorName: 'GVHD A'
    });
    await setDoc(doc(adminDb, `graduationRounds/${roundId}/councilStudentAssignments/act_1_87654321`), {
      activityId: 'act_1', councilId: 'council_2', studentId: '87654321', active: true,
      fullName: 'Sinh viên B', topicTitle: 'Đề tài B', supervisorName: 'GVHD B'
    });
  });
  const guestDb = env.authenticatedContext(guestEmail, auth(guestEmail)).firestore();
  const profile = await assertSucceeds(getDoc(doc(guestDb, `graduationRounds/${roundId}/councilStudentAssignments/act_1_12345678`)));
  assert.equal(profile.data().topicTitle, 'Đề tài A');
  await assertFails(getDoc(doc(guestDb, `graduationRounds/${roundId}/councilStudentAssignments/act_1_87654321`)));
  await assertSucceeds(setDoc(doc(guestDb, guestScorePath), { ...score(guestEmail), scorerId: guestEmail }));
  await assertSucceeds(getDoc(doc(guestDb, guestScorePath)));
  const ownScores = await assertSucceeds(getDocs(query(
    collection(guestDb, `graduationRounds/${roundId}/reviewDecisions`),
    where('scorerEmail', '==', guestEmail)
  )));
  assert.equal(ownScores.size, 1);
  await assertFails(setDoc(doc(guestDb, scorePath), score(guestEmail)));
  await assertFails(setDoc(doc(guestDb, `graduationRounds/${roundId}/reviewDecisions/act_1_council_1_87654321_${guestEmail}`), {
    ...score(guestEmail), studentId: '87654321', scorerId: guestEmail
  }));
});

test('Unassigned external account cannot read council profile or save a score', async () => {
  const outsiderEmail = 'outsider@gmail.com';
  const outsiderDb = env.authenticatedContext(outsiderEmail, auth(outsiderEmail)).firestore();
  await assertFails(getDoc(doc(outsiderDb, `graduationRounds/${roundId}/councilStudentAssignments/act_1_12345678`)));
  await assertFails(setDoc(doc(outsiderDb, `graduationRounds/${roundId}/reviewDecisions/act_1_council_1_12345678_${outsiderEmail}`), {
    ...score(outsiderEmail), scorerId: outsiderEmail
  }));
});
