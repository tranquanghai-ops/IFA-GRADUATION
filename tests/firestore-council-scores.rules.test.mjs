import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = 'tknt-tdtu-test';
const roundId = 'test-council-round';
const chairEmail = 'tranquanghai@tdtu.edu.vn';
const memberEmail = 'member@tdtu.edu.vn';
const guestEmail = 'guest@gmail.com';
const scorePath = `graduationRounds/${roundId}/reviewDecisions/act_1_council_1_12345678_member1`;
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

test('External council guest cannot save a score under current rules', async () => {
  const guestDb = env.authenticatedContext(guestEmail, auth(guestEmail)).firestore();
  await assertFails(setDoc(doc(guestDb, scorePath), score(guestEmail)));
});
