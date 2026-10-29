import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ID = 'tknt-tdtu-test';
let env;

const roundPreferenceId = 'round_preference_test';
const roundDirectId = 'round_direct_test';
const student1Mssv = '12000111';
const student1Email = `${student1Mssv}@student.tdtu.edu.vn`;
const student2Mssv = '12000222';
const student2Email = `${student2Mssv}@student.tdtu.edu.vn`;
const adminEmail = 'admin@tdtu.edu.vn';

function actor(email, roles = {}) {
  return {
    email,
    email_verified: true,
    ...roles
  };
}

before(async () => {
  const rulesPath = path.resolve('firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  env = await initializeTestEnvironment({
    projectId: 'mandatory-three-preferences-rules-test',
    firestore: { rules }
  });
});

beforeEach(async () => {
  await env.clearFirestore();

  // Setup initial rounds and eligible students with admin privileges
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Round with student preference mode (open)
    await setDoc(doc(db, `graduationRounds/${roundPreferenceId}`), {
      status: 'open',
      supervisorAssignmentMode: 'student_preference',
      preferenceCount: 3,
      allowRegistrationBeforeEligibility: true
    });

    // Seed eligible student
    await setDoc(doc(db, `graduationRounds/${roundPreferenceId}/eligibleStudents/${student1Mssv}`), {
      studentId: student1Mssv,
      name: 'Sinh viên 1',
      email: student1Email,
      eligible: true
    });

    // 2. Round with direct assignment mode (open)
    await setDoc(doc(db, `graduationRounds/${roundDirectId}`), {
      status: 'open',
      supervisorAssignmentMode: 'direct_assignment',
      allowRegistrationBeforeEligibility: true
    });

    await setDoc(doc(db, `graduationRounds/${roundDirectId}/eligibleStudents/${student2Mssv}`), {
      studentId: student2Mssv,
      name: 'Sinh viên 2',
      email: student2Email,
      eligible: true
    });

    // System admin
    await setDoc(doc(db, `admins/${adminEmail}`), {
      email: adminEmail,
      active: true
    });
  });
});

after(async () => {
  if (env) {
    await env.cleanup();
  }
});

test('MANDATORY 3 SUPERVISOR PREFERENCES FIRESTORE RULES SUITE', async (t) => {

  await t.test('1. Sinh viên gửi 0 nguyện vọng trong đợt student_preference -> BỊ CHẶN (DENIED)', async () => {
    const studentDb = env.authenticatedContext('st1', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: []
    };
    await assertFails(setDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), payload));
  });

  await t.test('2. Sinh viên gửi 1 nguyện vọng -> BỊ CHẶN (DENIED)', async () => {
    const studentDb = env.authenticatedContext('st1', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_a', supervisorName: 'GVHD A' }
      ]
    };
    await assertFails(setDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), payload));
  });

  await t.test('3. Sinh viên gửi 2 nguyện vọng -> BỊ CHẶN (DENIED)', async () => {
    const studentDb = env.authenticatedContext('st1', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_a', supervisorName: 'GVHD A' },
        { rank: 2, supervisorId: 'sup_b', supervisorName: 'GVHD B' }
      ]
    };
    await assertFails(setDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), payload));
  });

  await t.test('4. Sinh viên gửi 3 nguyện vọng nhưng trùng supervisorId (NV1 trùng NV2) -> BỊ CHẶN (DENIED)', async () => {
    const studentDb = env.authenticatedContext('st1', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_a', supervisorName: 'GVHD A' },
        { rank: 2, supervisorId: 'sup_a', supervisorName: 'GVHD A' },
        { rank: 3, supervisorId: 'sup_c', supervisorName: 'GVHD C' }
      ]
    };
    await assertFails(setDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), payload));
  });

  await t.test('5. Sinh viên gửi 3 nguyện vọng nhưng trùng supervisorId (NV1 trùng NV3) -> BỊ CHẶN (DENIED)', async () => {
    const studentDb = env.authenticatedContext('st1', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_a', supervisorName: 'GVHD A' },
        { rank: 2, supervisorId: 'sup_b', supervisorName: 'GVHD B' },
        { rank: 3, supervisorId: 'sup_a', supervisorName: 'GVHD A' }
      ]
    };
    await assertFails(setDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), payload));
  });

  await t.test('6. Sinh viên gửi 3 nguyện vọng nhưng supervisorId rỗng -> BỊ CHẶN (DENIED)', async () => {
    const studentDb = env.authenticatedContext('st1', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_a', supervisorName: 'GVHD A' },
        { rank: 2, supervisorId: '', supervisorName: 'GVHD B' },
        { rank: 3, supervisorId: 'sup_c', supervisorName: 'GVHD C' }
      ]
    };
    await assertFails(setDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), payload));
  });

  await t.test('7. Sinh viên gửi ĐÚNG 3 nguyện vọng GVHD khác nhau hợp lệ -> THÀNH CÔNG (PASS)', async () => {
    const studentDb = env.authenticatedContext('st1', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_a', supervisorName: 'GVHD A' },
        { rank: 2, supervisorId: 'sup_b', supervisorName: 'GVHD B' },
        { rank: 3, supervisorId: 'sup_c', supervisorName: 'GVHD C' }
      ]
    };
    await assertSucceeds(setDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), payload));
  });

  await t.test('8. Sinh viên cập nhật registration với 3 nguyện vọng hợp lệ -> THÀNH CÔNG (PASS)', async () => {
    const studentDb = env.authenticatedContext('st1', actor(student1Email)).firestore();
    const initialPayload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_a', supervisorName: 'GVHD A' },
        { rank: 2, supervisorId: 'sup_b', supervisorName: 'GVHD B' },
        { rank: 3, supervisorId: 'sup_c', supervisorName: 'GVHD C' }
      ]
    };
    await assertSucceeds(setDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), initialPayload));

    const updatePayload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_c', supervisorName: 'GVHD C' },
        { rank: 2, supervisorId: 'sup_b', supervisorName: 'GVHD B' },
        { rank: 3, supervisorId: 'sup_d', supervisorName: 'GVHD D' }
      ]
    };
    await assertSucceeds(updateDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), updatePayload));
  });

  await t.test('9. Sinh viên cập nhật giảm bớt còn 2 nguyện vọng -> BỊ CHẶN (DENIED)', async () => {
    const studentDb = env.authenticatedContext('st1', actor(student1Email)).firestore();
    const initialPayload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_a', supervisorName: 'GVHD A' },
        { rank: 2, supervisorId: 'sup_b', supervisorName: 'GVHD B' },
        { rank: 3, supervisorId: 'sup_c', supervisorName: 'GVHD C' }
      ]
    };
    await assertSucceeds(setDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), initialPayload));

    const badUpdatePayload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Thiết kế nội thất Trung tâm Triển lãm',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_c', supervisorName: 'GVHD C' },
        { rank: 2, supervisorId: 'sup_b', supervisorName: 'GVHD B' }
      ]
    };
    await assertFails(updateDoc(doc(studentDb, `graduationRounds/${roundPreferenceId}/registrations/${student1Mssv}`), badUpdatePayload));
  });

  await t.test('10. Đợt phân công trực tiếp (direct_assignment): sinh viên nộp preferences: [] -> THÀNH CÔNG (PASS)', async () => {
    const studentDb = env.authenticatedContext('st2', actor(student2Email)).firestore();
    const payload = {
      studentId: student2Mssv,
      email: student2Email,
      topicTitle: 'Thiết kế nội thất Văn phòng Sáng tạo',
      projectType: 'Đồ án',
      status: 'submitted',
      preferences: []
    };
    await assertSucceeds(setDoc(doc(studentDb, `graduationRounds/${roundDirectId}/registrations/${student2Mssv}`), payload));
  });

  await t.test('11. Admin có thể can thiệp tạo/sửa hồ sơ đăng ký bất kể số lượng nguyện vọng -> THÀNH CÔNG (PASS)', async () => {
    const adminDb = env.authenticatedContext('admin_uid', actor(adminEmail, { admin: true })).firestore();
    const adminPayload = {
      studentId: '12000999',
      email: '12000999@student.tdtu.edu.vn',
      topicTitle: 'Thiết kế nội thất Đồ án Đặc biệt do Admin tạo',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_special', supervisorName: 'GVHD Đặc Biệt' }
      ]
    };
    await assertSucceeds(setDoc(doc(adminDb, `graduationRounds/${roundPreferenceId}/registrations/12000999`), adminPayload));
  });
});
