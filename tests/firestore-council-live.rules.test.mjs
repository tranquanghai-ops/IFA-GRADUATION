import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const roundId = 'council-live-test-round';
const activityId = 'defense';
const councilId = 'hd1';
const path = `graduationRounds/${roundId}/councilLive/${activityId}_${councilId}`;
const secretary = 'secretary@tdtu.edu.vn';
const chair = 'chair@tdtu.edu.vn';
const member = 'member@tdtu.edu.vn';
const guest = 'guest@example.com';
const otherGuest = 'other-guest@example.com';
const outsider = 'other@tdtu.edu.vn';
const actor = email => ({ email, email_verified: true });
const payload = email => ({
  activityId, councilId, status: 'active',
  presentationStatuses: { s1: 'presenting', s2: 'waiting' },
  liveTimer: { isRunning: true, remainingSeconds: 900 },
  timerSettings: { durationSeconds: 900, shortAddSeconds: 30, longAddSeconds: 60, soundChoice: 1 },
  updatedAt: Date.now(), updatedBy: email
});
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'council-live-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `graduationRounds/${roundId}`), { status: 'open' });
    for (const [email, role] of [[secretary, 'secretary'], [chair, 'chair'], [member, 'member'], [guest, 'guest']]) {
      await setDoc(doc(db, `graduationRounds/${roundId}/councilMemberships/${activityId}_${councilId}_${email}`), {
        activityId, councilId, memberEmail: email, role, active: true
      });
    }
  });
});

after(async () => { await env?.cleanup(); });

test('secretary may start and update a presentation but ordinary members may not', async () => {
  const secretaryDb = env.authenticatedContext(secretary, actor(secretary)).firestore();
  const memberDb = env.authenticatedContext(member, actor(member)).firestore();
  const outsiderDb = env.authenticatedContext(outsider, actor(outsider)).firestore();
  await assertSucceeds(setDoc(doc(secretaryDb, path), payload(secretary)));
  await assertSucceeds(updateDoc(doc(secretaryDb, path), { 'presentationStatuses.s1': 'presented', updatedBy: secretary }));
  await assertFails(updateDoc(doc(memberDb, path), { 'presentationStatuses.s1': 'waiting', updatedBy: member }));
  await assertFails(updateDoc(doc(outsiderDb, path), { 'presentationStatuses.s1': 'waiting', updatedBy: outsider }));
  const snap = await assertSucceeds(getDoc(doc(memberDb, path)));
  assert.equal(snap.data().presentationStatuses.s1, 'presented');
});

test('assigned external guest sees live presentation and timer changes without write access', async () => {
  const chairDb = env.authenticatedContext(chair, actor(chair)).firestore();
  const guestDb = env.authenticatedContext(guest, actor(guest)).firestore();
  const otherGuestDb = env.authenticatedContext(otherGuest, actor(otherGuest)).firestore();
  await assertSucceeds(setDoc(doc(chairDb, path), payload(chair)));
  let snap = await assertSucceeds(getDoc(doc(guestDb, path)));
  assert.equal(snap.data().presentationStatuses.s1, 'presenting');
  assert.equal(snap.data().liveTimer.isRunning, true);
  await assertSucceeds(updateDoc(doc(chairDb, path), {
    presentationStatuses: { s1: 'presented', s2: 'presenting' },
    liveTimer: { isRunning: true, startedAt: Date.now(), remainingSeconds: 600, studentId: 's2' },
    updatedBy: chair
  }));
  snap = await assertSucceeds(getDoc(doc(guestDb, path)));
  assert.equal(snap.data().presentationStatuses.s2, 'presenting');
  assert.equal(snap.data().liveTimer.studentId, 's2');
  await assertFails(updateDoc(doc(guestDb, path), { 'presentationStatuses.s2': 'presented', updatedBy: guest }));
  await assertFails(getDoc(doc(otherGuestDb, path)));
});

test('only chair may end the council', async () => {
  const secretaryDb = env.authenticatedContext(secretary, actor(secretary)).firestore();
  const chairDb = env.authenticatedContext(chair, actor(chair)).firestore();
  await assertFails(updateDoc(doc(secretaryDb, path), { status: 'ended', updatedBy: secretary }));
  await assertSucceeds(updateDoc(doc(chairDb, path), { status: 'ended', updatedBy: chair }));
});
