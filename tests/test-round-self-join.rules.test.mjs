import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const roundOpenId = 'round-self-join-open';
const roundClosedId = 'round-self-join-closed';
const roundDisabledId = 'round-self-join-disabled';
const roundHiddenId = 'round-self-join-hidden';

const student1Mssv = '11900335';
const student1Email = `${student1Mssv}@student.tdtu.edu.vn`;

const student2Mssv = '12200254';
const student2Email = `${student2Mssv}@student.tdtu.edu.vn`;

const adminEmail = 'admin_self_join@tdtu.edu.vn';
const outsiderEmail = 'guest@gmail.com';

const actor = email => ({ email, email_verified: true });

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'round-self-join-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    // 1. Setup Admin
    await setDoc(doc(db, `admins/${adminEmail}`), { email: adminEmail, active: true });

    // 2. Setup Open Round (allowSelfJoin: true, active, open)
    await setDoc(doc(db, `graduationRounds/${roundOpenId}`), {
      title: 'Đợt Tốt nghiệp 2027 (Mở self-join)',
      status: 'open',
      allowSelfJoin: true,
      isClosed: false,
      isHidden: false
    });

    // 3. Setup Disabled Link Round (allowSelfJoin: false)
    await setDoc(doc(db, `graduationRounds/${roundDisabledId}`), {
      title: 'Đợt Tốt nghiệp (Khóa self-join)',
      status: 'open',
      allowSelfJoin: false,
      isClosed: false,
      isHidden: false
    });

    // 4. Setup Closed Round (isClosed: true)
    await setDoc(doc(db, `graduationRounds/${roundClosedId}`), {
      title: 'Đợt Tốt nghiệp (Đã kết thúc)',
      status: 'closed',
      allowSelfJoin: true,
      isClosed: true,
      isHidden: false
    });

    // 5. Setup Hidden Round (isHidden: true)
    await setDoc(doc(db, `graduationRounds/${roundHiddenId}`), {
      title: 'Đợt Tốt nghiệp (Lưu trữ)',
      status: 'open',
      allowSelfJoin: true,
      isClosed: false,
      isHidden: true
    });
  });
});

after(async () => {
  if (env) await env.cleanup();
});

test('--- FIRESTORE RULES: SELF-JOIN ELIGIBLE STUDENTS ---', async (t) => {

  await t.test('1. Sinh viên hợp lệ có thể tự ghi danh vào đợt mở allowSelfJoin == true', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      mssv: student1Mssv,
      name: 'Nguyễn Văn A',
      fullName: 'Nguyễn Văn A',
      email: student1Email,
      className: '19050101',
      studentClass: '19050101',
      major: 'Thiết kế Nội thất',
      roundId: roundOpenId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: true
    };
    await assertSucceeds(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`), payload));
  });

  await t.test('2. Sinh viên KHÔNG THỂ mạo danh để ghi danh cho MSSV khác', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    const payload = {
      studentId: student2Mssv, // Mạo danh student 2
      mssv: student2Mssv,
      name: 'Sinh viên Khác',
      fullName: 'Sinh viên Khác',
      email: student2Email,
      className: '22050101',
      studentClass: '22050101',
      major: 'Thiết kế Nội thất',
      roundId: roundOpenId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: true
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student2Mssv}`), payload));
  });

  await t.test('3. Sinh viên KHÔNG THỂ ghi danh khi đợt khóa link (allowSelfJoin == false)', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      mssv: student1Mssv,
      name: 'Nguyễn Văn A',
      fullName: 'Nguyễn Văn A',
      email: student1Email,
      className: '19050101',
      studentClass: '19050101',
      major: 'Thiết kế Nội thất',
      roundId: roundDisabledId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: true
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundDisabledId}/eligibleStudents/${student1Mssv}`), payload));
  });

  await t.test('4. Sinh viên KHÔNG THỂ ghi danh vào đợt đã kết thúc (isClosed == true)', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      mssv: student1Mssv,
      name: 'Nguyễn Văn A',
      fullName: 'Nguyễn Văn A',
      email: student1Email,
      className: '19050101',
      studentClass: '19050101',
      major: 'Thiết kế Nội thất',
      roundId: roundClosedId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: true
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundClosedId}/eligibleStudents/${student1Mssv}`), payload));
  });

  await t.test('5. Sinh viên KHÔNG THỂ ghi danh vào đợt đã lưu trữ (isHidden == true)', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      mssv: student1Mssv,
      name: 'Nguyễn Văn A',
      fullName: 'Nguyễn Văn A',
      email: student1Email,
      className: '19050101',
      studentClass: '19050101',
      major: 'Thiết kế Nội thất',
      roundId: roundHiddenId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: true
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundHiddenId}/eligibleStudents/${student1Mssv}`), payload));
  });

  await t.test('6. Sinh viên KHÔNG THỂ chèn thêm các trường ngoài whitelist (vd điểm số, đề tài)', async () => {
    const db = env.authenticatedContext('student2_uid', actor(student2Email)).firestore();
    const payloadWithIllegalField = {
      studentId: student2Mssv,
      mssv: student2Mssv,
      name: 'Trần Thị B',
      fullName: 'Trần Thị B',
      email: student2Email,
      className: '22050101',
      studentClass: '22050101',
      major: 'Thiết kế Nội thất',
      roundId: roundOpenId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: true,
      hackedScores: 10, // TRƯỜNG BẤT HỢP PHÁP
      topicApproved: true // TRƯỜNG BẤT HỢP PHÁP
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student2Mssv}`), payloadWithIllegalField));
  });

  await t.test('7. Sinh viên KHÔNG THỂ cập nhật (update) bản ghi eligibleStudents đã tồn tại', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    await assertFails(updateDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`), {
      name: 'Tên Đã Bị Sửa'
    }));
  });

  await t.test('8. Sinh viên KHÔNG THỂ xóa (delete) bản ghi eligibleStudents', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    await assertFails(deleteDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`)));
  });

  await t.test('9. Admin có toàn quyền tạo, sửa, xóa bản ghi eligibleStudents', async () => {
    const db = env.authenticatedContext('admin_uid', actor(adminEmail)).firestore();
    const payload = {
      studentId: 'admin_added_mssv',
      mssv: 'admin_added_mssv',
      name: 'SV Do Admin Thêm',
      eligible: true
    };
    await assertSucceeds(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/admin_added_mssv`), payload));
    await assertSucceeds(updateDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/admin_added_mssv`), {
      name: 'SV Đã Cập Nhật'
    }));
    await assertSucceeds(deleteDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/admin_added_mssv`)));
  });

  await t.test('10. Người dùng chưa đăng nhập KHÔNG THỂ ghi hoặc đọc eligibleStudents', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`)));
    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`), {
      studentId: student1Mssv,
      eligible: true
    }));
  });
});
