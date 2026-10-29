import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

const adminEmail = 'admin_rules@tdtu.edu.vn';
const visitingEmail = 'quang.nguyen@gmail.com';
const visitingOutlook = 'expert.consultant@outlook.com';
const strangerEmail = 'stranger@gmail.com';
const studentMssv = '11900335';
const studentEmail = `${studentMssv}@student.tdtu.edu.vn`;

const roundAssignedId = 'round-4-2027-test';
const roundUnassignedId = 'round-12-2026-test';

const actor = email => ({ email, email_verified: true });

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'visiting-supervisor-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    // 1. Admin setup
    await setDoc(doc(db, `admins/${adminEmail}`), { email: adminEmail, active: true });

    // 2. Visiting Supervisor in supervisorMaster
    await setDoc(doc(db, `supervisorMaster/${visitingEmail}`), {
      name: 'ThS. Nguyễn Tăng Quang',
      email: visitingEmail,
      personalEmail: visitingEmail,
      active: true,
      status: 'active',
      employmentType: 'adjunct',
      defaultQuota: 5
    });

    await setDoc(doc(db, `supervisorMaster/${visitingOutlook}`), {
      name: 'Chuyên gia Outlook',
      email: visitingOutlook,
      active: true,
      employmentType: 'adjunct'
    });

    // 3. Setup Rounds
    await setDoc(doc(db, `graduationRounds/${roundAssignedId}`), {
      title: 'Đợt 4/2027',
      status: 'open',
      allowSelfJoin: true,
      isClosed: false,
      isHidden: false
    });

    await setDoc(doc(db, `graduationRounds/${roundUnassignedId}`), {
      title: 'Đợt 12/2026',
      status: 'open',
      allowSelfJoin: true,
      isClosed: false,
      isHidden: false
    });

    // 4. Add visiting supervisor to roundAssignedId supervisors subcollection
    await setDoc(doc(db, `graduationRounds/${roundAssignedId}/supervisors/${visitingEmail}`), {
      supervisorId: visitingEmail,
      name: 'ThS. Nguyễn Tăng Quang',
      email: visitingEmail,
      active: true
    });

    // 5. Add student to roundAssignedId
    await setDoc(doc(db, `graduationRounds/${roundAssignedId}/eligibleStudents/${studentMssv}`), {
      studentId: studentMssv,
      mssv: studentMssv,
      fullName: 'Nguyễn Văn Sinh Viên',
      email: studentEmail,
      eligible: true
    });

    // 6. Student profile (private contact info)
    await setDoc(doc(db, `graduationStudentProfiles/${studentMssv}`), {
      studentId: studentMssv,
      email: studentEmail,
      phone: '0901234567',
      address: '123 Nguyễn Hữu Thọ, Q7'
    });
  });
});

after(async () => {
  if (env) await env.cleanup();
});

test('--- FIRESTORE RULES: VISITING SUPERVISOR RBAC & SECURITY ---', async (t) => {

  await t.test('1. Visiting supervisor reads their own profile in supervisorMaster -> SUCCEEDS', async () => {
    const db = env.authenticatedContext('visiting_uid', actor(visitingEmail)).firestore();
    await assertSucceeds(getDoc(doc(db, `supervisorMaster/${visitingEmail}`)));
  });

  await t.test('2. Unauthorized stranger CANNOT list supervisorMaster -> FAILS', async () => {
    const db = env.authenticatedContext('stranger_uid', actor(strangerEmail)).firestore();
    await assertFails(getDocs(collection(db, 'supervisorMaster')));
  });

  await t.test('3. Visiting supervisor reads eligibleStudents in assigned round (4/2027) -> SUCCEEDS', async () => {
    const db = env.authenticatedContext('visiting_uid', actor(visitingEmail)).firestore();
    await assertSucceeds(getDoc(doc(db, `graduationRounds/${roundAssignedId}/eligibleStudents/${studentMssv}`)));
    await assertSucceeds(getDocs(collection(db, `graduationRounds/${roundAssignedId}/eligibleStudents`)));
  });

  await t.test('4. Visiting supervisor CANNOT list eligibleStudents in unassigned round (12/2026) -> FAILS', async () => {
    const db = env.authenticatedContext('visiting_uid', actor(visitingEmail)).firestore();
    await assertFails(getDocs(collection(db, `graduationRounds/${roundUnassignedId}/eligibleStudents`)));
  });

  await t.test('5. Visiting supervisor creates reviewDecisions for NV review in assigned round -> SUCCEEDS', async () => {
    const db = env.authenticatedContext('visiting_uid', actor(visitingEmail)).firestore();
    const decisionPayload = {
      roundId: roundAssignedId,
      studentId: studentMssv,
      supervisorEmail: visitingEmail,
      decidedBy: visitingEmail,
      roundNumber: 1,
      decision: 'accepted',
      createdAt: new Date().toISOString()
    };
    await assertSucceeds(setDoc(doc(db, `graduationRounds/${roundAssignedId}/reviewDecisions/${studentMssv}_r1`), decisionPayload));
  });

  await t.test('6. Visiting supervisor CANNOT forge reviewDecisions under someone else email -> FAILS', async () => {
    const db = env.authenticatedContext('visiting_uid', actor(visitingEmail)).firestore();
    const forgedPayload = {
      roundId: roundAssignedId,
      studentId: studentMssv,
      supervisorEmail: 'another.teacher@tdtu.edu.vn',
      decidedBy: 'another.teacher@tdtu.edu.vn',
      roundNumber: 1,
      decision: 'accepted'
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundAssignedId}/reviewDecisions/${studentMssv}_forged`), forgedPayload));
  });

  await t.test('7. Unauthorized stranger CANNOT create reviewDecisions -> FAILS', async () => {
    const db = env.authenticatedContext('stranger_uid', actor(strangerEmail)).firestore();
    const strangerPayload = {
      roundId: roundAssignedId,
      studentId: studentMssv,
      supervisorEmail: strangerEmail,
      decidedBy: strangerEmail,
      decision: 'accepted'
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundAssignedId}/reviewDecisions/${studentMssv}_stranger`), strangerPayload));
  });

  await t.test('8. Stranger with personal Gmail CANNOT self-join eligibleStudents as student -> FAILS', async () => {
    const db = env.authenticatedContext('stranger_uid', actor(strangerEmail)).firestore();
    const fakeJoinPayload = {
      studentId: '99999999',
      name: 'Fake Student',
      email: strangerEmail,
      eligible: false
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundAssignedId}/eligibleStudents/99999999`), fakeJoinPayload));
  });

  await t.test('9. Visiting supervisor CANNOT read graduationStudentProfiles (student private contact details) -> FAILS', async () => {
    const db = env.authenticatedContext('visiting_uid', actor(visitingEmail)).firestore();
    await assertFails(getDoc(doc(db, `graduationStudentProfiles/${studentMssv}`)));
  });

  await t.test('10. Student CAN read their own graduationStudentProfile -> SUCCEEDS', async () => {
    const db = env.authenticatedContext('student_uid', actor(studentEmail)).firestore();
    await assertSucceeds(getDoc(doc(db, `graduationStudentProfiles/${studentMssv}`)));
  });
});
