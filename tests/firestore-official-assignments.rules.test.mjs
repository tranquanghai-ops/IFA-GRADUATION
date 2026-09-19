import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const projectId = 'tknt-tdtu-test';
const roundId = 'DATH-T12-2026';
const studentId = '52200001';
const otherStudentId = '52200002';
const adminEmail = 'admin@tdtu.edu.vn';
const supervisorEmail = 'gvhd@tdtu.edu.vn';
const otherSupervisorEmail = 'other@tdtu.edu.vn';
let env;

const assignmentPath = id => `graduationRounds/${roundId}/officialAssignments/${id}`;
const draftPath = id => `graduationRounds/${roundId}/assignmentDrafts/${id}`;
const auth = email => ({ email, email_verified: true });

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `admins/${adminEmail}`), { role: 'admin' });
    await setDoc(doc(db, `graduationRounds/${roundId}`), {
      status: 'open',
      supervisorAssignmentMode: 'direct_assignment'
    });
    await setDoc(doc(db, `graduationRounds/${roundId}/eligibleStudents/${studentId}`), { eligible: true, studentId });
    await setDoc(doc(db, `graduationRounds/${roundId}/eligibleStudents/${otherStudentId}`), { eligible: true, studentId: otherStudentId });
    await setDoc(doc(db, draftPath(studentId)), {
      studentId,
      studentName: 'Sinh viên Một',
      studentEmail: `${studentId}@student.tdtu.edu.vn`,
      assignmentStatus: 'draft',
      supervisors: [{ supervisorId: 'gvhd-1', supervisorName: 'GVHD Một', supervisorEmail, role: 'primary' }],
      supervisorIds: ['gvhd-1'],
      supervisorEmails: [supervisorEmail]
    });
    await setDoc(doc(db, `graduationRounds/${roundId}/registrations/${studentId}`), {
      studentId,
      email: `${studentId}@student.tdtu.edu.vn`,
      status: 'submitted',
      topicTitle: 'Thiết kế nội thất thử nghiệm',
      projectType: 'Đồ án',
      preferences: []
    });
  });
});

after(async () => {
  await env?.cleanup();
});

describe('officialAssignments least privilege', () => {
  test('Admin được tạo và sửa assignment', async () => {
    const db = env.authenticatedContext(adminEmail, auth(adminEmail)).firestore();
    await assertSucceeds(setDoc(doc(db, draftPath(otherStudentId)), {
      studentId: otherStudentId,
      assignmentStatus: 'draft',
      supervisors: [],
      supervisorIds: [],
      supervisorEmails: []
    }));
    await assertSucceeds(updateDoc(doc(db, draftPath(studentId)), { source: 'admin_edited' }));
  });

  test('Student và GVHD không đọc được draft', async () => {
    const studentDb = env.authenticatedContext(`${studentId}@student.tdtu.edu.vn`, auth(`${studentId}@student.tdtu.edu.vn`)).firestore();
    const supervisorDb = env.authenticatedContext(supervisorEmail, auth(supervisorEmail)).firestore();
    await assertFails(getDoc(doc(studentDb, draftPath(studentId))));
    await assertFails(getDoc(doc(supervisorDb, draftPath(studentId))));
  });

  test('Student chỉ đọc published của chính mình', async () => {
    await publishAssignment();
    const ownDb = env.authenticatedContext(`${studentId}@student.tdtu.edu.vn`, auth(`${studentId}@student.tdtu.edu.vn`)).firestore();
    const otherDb = env.authenticatedContext(`${otherStudentId}@student.tdtu.edu.vn`, auth(`${otherStudentId}@student.tdtu.edu.vn`)).firestore();
    await assertSucceeds(getDoc(doc(ownDb, assignmentPath(studentId))));
    await assertFails(getDoc(doc(otherDb, assignmentPath(studentId))));
  });

  test('GVHD chỉ đọc và query published thuộc mình', async () => {
    await publishAssignment();
    const ownDb = env.authenticatedContext(supervisorEmail, auth(supervisorEmail)).firestore();
    const otherDb = env.authenticatedContext(otherSupervisorEmail, auth(otherSupervisorEmail)).firestore();
    await assertSucceeds(getDoc(doc(ownDb, assignmentPath(studentId))));
    await assertFails(getDoc(doc(otherDb, assignmentPath(studentId))));
    const ownQuery = query(
      collection(ownDb, `graduationRounds/${roundId}/officialAssignments`),
      where('assignmentStatus', '==', 'published'),
      where('supervisorEmails', 'array-contains', supervisorEmail)
    );
    const snap = await assertSucceeds(getDocs(ownQuery));
    assert.equal(snap.size, 1);
  });

  test('Student và GVHD không được ghi assignment', async () => {
    const studentDb = env.authenticatedContext(`${studentId}@student.tdtu.edu.vn`, auth(`${studentId}@student.tdtu.edu.vn`)).firestore();
    const supervisorDb = env.authenticatedContext(supervisorEmail, auth(supervisorEmail)).firestore();
    await assertFails(updateDoc(doc(studentDb, draftPath(studentId)), { source: 'student' }));
    await assertFails(updateDoc(doc(supervisorDb, draftPath(studentId)), { source: 'supervisor' }));
  });

  test('GVHD không được list eligibleStudents và tài khoản TDTU thường không phải Admin', async () => {
    const supervisorDb = env.authenticatedContext(supervisorEmail, auth(supervisorEmail)).firestore();
    await assertFails(getDocs(collection(supervisorDb, `graduationRounds/${roundId}/eligibleStudents`)));
    await assertFails(setDoc(doc(supervisorDb, draftPath(otherStudentId)), {
      studentId: otherStudentId,
      assignmentStatus: 'draft',
      supervisors: [],
      supervisorIds: [],
      supervisorEmails: []
    }));
  });

  test('Draft không bị chiếu vào registration legacy', async () => {
    const studentDb = env.authenticatedContext(`${studentId}@student.tdtu.edu.vn`, auth(`${studentId}@student.tdtu.edu.vn`)).firestore();
    const snap = await assertSucceeds(getDoc(doc(studentDb, `graduationRounds/${roundId}/registrations/${studentId}`)));
    assert.equal(snap.data().acceptedSupervisorId, undefined);
    assert.equal(snap.data().officialSupervisors, undefined);
  });

  test('Sinh viên direct_assignment được đăng ký không có nguyện vọng', async () => {
    const email = `${otherStudentId}@student.tdtu.edu.vn`;
    const db = env.authenticatedContext(email, auth(email)).firestore();
    await assertSucceeds(setDoc(doc(db, `graduationRounds/${roundId}/registrations/${otherStudentId}`), {
      studentId: otherStudentId,
      email,
      status: 'submitted',
      topicTitle: 'Thiết kế nội thất trung tâm thử nghiệm',
      projectType: 'Đồ án',
      preferences: []
    }));
  });

  test('Sinh viên student_preference chỉ được bỏ nguyện vọng khi assignment đã published', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, `graduationRounds/${roundId}`), {
        status: 'open',
        supervisorAssignmentMode: 'student_preference'
      }, { merge: true });
      await setDoc(doc(db, draftPath(otherStudentId)), {
        studentId: otherStudentId,
        assignmentStatus: 'draft',
        supervisors: [{ supervisorId: 'gvhd-1', supervisorName: 'GVHD Một', supervisorEmail, role: 'primary' }],
        supervisorIds: ['gvhd-1'],
        supervisorEmails: [supervisorEmail]
      });
    });

    const email = `${otherStudentId}@student.tdtu.edu.vn`;
    const db = env.authenticatedContext(email, auth(email)).firestore();
    const registrationRef = doc(db, `graduationRounds/${roundId}/registrations/${otherStudentId}`);
    const payload = {
      studentId: otherStudentId,
      email,
      status: 'submitted',
      topicTitle: 'Thiết kế nội thất trung tâm thử nghiệm',
      projectType: 'Đồ án',
      preferences: []
    };

    await assertFails(setDoc(registrationRef, payload));
    await env.withSecurityRulesDisabled(async context => {
      const adminDb = context.firestore();
      const draft = await getDoc(doc(adminDb, draftPath(otherStudentId)));
      await setDoc(doc(adminDb, assignmentPath(otherStudentId)), { ...draft.data(), assignmentStatus: 'published' });
    });
    await assertSucceeds(setDoc(registrationRef, payload));
  });
});

async function publishAssignment() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const draft = await getDoc(doc(db, draftPath(studentId)));
    await setDoc(doc(db, assignmentPath(studentId)), { ...draft.data(), assignmentStatus: 'published' });
  });
}
