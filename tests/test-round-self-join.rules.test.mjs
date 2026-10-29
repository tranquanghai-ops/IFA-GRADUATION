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

  await t.test('1. Sinh viên hợp lệ có thể tự ghi danh với trạng thái Chưa khai báo (undeclared)', async () => {
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
      eligible: false,
      eligibilityDeclaration: {
        status: 'undeclared'
      }
    };
    await assertSucceeds(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`), payload));
  });

  await t.test('2. Sinh viên KHÔNG THỂ tự khai mình đã được duyệt đủ điều kiện (eligible == true)', async () => {
    const db = env.authenticatedContext('student2_uid', actor(student2Email)).firestore();
    const payload = {
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
      eligible: true // CỐ TÌNH TỰ NHẬN ĐỦ ĐIỀU KIỆN
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student2Mssv}`), payload));
  });

  await t.test('3. Sinh viên KHÔNG THỂ tự khai status == "eligible" hoặc "pending" trong eligibilityDeclaration', async () => {
    const db = env.authenticatedContext('student2_uid', actor(student2Email)).firestore();
    
    // Thử status: eligible
    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student2Mssv}`), {
      studentId: student2Mssv,
      email: student2Email,
      roundId: roundOpenId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: {
        status: 'eligible'
      }
    }));

    // Thử status: pending (không thuộc schema tự tham gia)
    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student2Mssv}`), {
      studentId: student2Mssv,
      email: student2Email,
      roundId: roundOpenId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: {
        status: 'pending'
      }
    }));
  });

  await t.test('4. Sinh viên KHÔNG THỂ tự chèn kết quả thẩm định adminReview hoặc điểm', async () => {
    const db = env.authenticatedContext('student2_uid', actor(student2Email)).firestore();
    
    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student2Mssv}`), {
      studentId: student2Mssv,
      email: student2Email,
      roundId: roundOpenId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: { status: 'undeclared' },
      adminReview: { status: 'eligible' } // MẠO DANH QUYỀN KHOA
    }));

    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student2Mssv}`), {
      studentId: student2Mssv,
      email: student2Email,
      roundId: roundOpenId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: { status: 'undeclared' },
      scores: { total: 10 } // MẠO DANH ĐIỂM
    }));
  });

  await t.test('5. Sinh viên KHÔNG THỂ mạo danh để ghi danh cho MSSV khác', async () => {
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
      eligible: false,
      eligibilityDeclaration: { status: 'undeclared' }
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student2Mssv}`), payload));
  });

  await t.test('6. Sinh viên KHÔNG THỂ ghi danh khi đợt khóa link (allowSelfJoin == false)', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    const payload = {
      studentId: student1Mssv,
      email: student1Email,
      roundId: roundDisabledId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: { status: 'undeclared' }
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundDisabledId}/eligibleStudents/${student1Mssv}`), payload));
  });

  await t.test('7. Sinh viên KHÔNG THỂ ghi danh vào đợt đã kết thúc hoặc lưu trữ', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    const pClosed = {
      studentId: student1Mssv,
      email: student1Email,
      roundId: roundClosedId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: { status: 'undeclared' }
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundClosedId}/eligibleStudents/${student1Mssv}`), pClosed));

    const pHidden = {
      studentId: student1Mssv,
      email: student1Email,
      roundId: roundHiddenId,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: { status: 'undeclared' }
    };
    await assertFails(setDoc(doc(db, `graduationRounds/${roundHiddenId}/eligibleStudents/${student1Mssv}`), pHidden));
  });

  await t.test('8. Sinh viên KHÔNG THỂ cập nhật (update) hoặc xóa (delete) bản ghi eligibleStudents', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    await assertFails(updateDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`), {
      eligible: true
    }));
    await assertFails(deleteDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`)));
  });

  await t.test('9. Sinh viên tự tham gia có thể đăng ký đề tài vào registrations/{studentId}', async () => {
    const db = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    const regPayload = {
      studentId: student1Mssv,
      email: student1Email,
      topicTitle: 'Nghiên cứu thiết kế không gian công cộng',
      projectType: 'Chuyên luận',
      status: 'submitted',
      preferences: [
        { rank: 1, supervisorId: 'sup_1', supervisorName: 'GVHD 1' },
        { rank: 2, supervisorId: 'sup_2', supervisorName: 'GVHD 2' },
        { rank: 3, supervisorId: 'sup_3', supervisorName: 'GVHD 3' }
      ],
      eligibilityDeclaration: {
        status: 'eligible',
        reasons: [],
        missingCourses: []
      }
    };
    await assertSucceeds(setDoc(doc(db, `graduationRounds/${roundOpenId}/registrations/${student1Mssv}`), regPayload));
  });

  await t.test('10. Sinh viên từ Excel đã có trong danh sách: bảo toàn và chống sửa đè', async () => {
    // Admin nhập sinh viên từ Excel
    const adminDb = env.authenticatedContext('admin_uid', actor(adminEmail)).firestore();
    const excelMssv = '12000888';
    const excelEmail = `${excelMssv}@student.tdtu.edu.vn`;
    await assertSucceeds(setDoc(doc(adminDb, `graduationRounds/${roundOpenId}/eligibleStudents/${excelMssv}`), {
      studentId: excelMssv,
      name: 'Sinh viên từ Excel',
      email: excelEmail,
      eligible: true,
      source: 'excel_import'
    }));

    // Sinh viên khác không thể ghi đè hoặc sửa bản ghi này
    const studentDb = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    await assertFails(setDoc(doc(studentDb, `graduationRounds/${roundOpenId}/eligibleStudents/${excelMssv}`), {
      studentId: excelMssv,
      email: excelEmail,
      name: 'Tên Sửa Đè',
      eligible: false
    }));
  });

  await t.test('11. Hai Admin thêm cùng GVHD: khóa document cố định supervisors/{supId}, không tạo trùng', async () => {
    const adminDb = env.authenticatedContext('admin_uid', actor(adminEmail)).firestore();
    const supId = 'sup_nguyen_van_c';

    // Admin 1 thêm GVHD với quota mặc định 5
    await assertSucceeds(setDoc(doc(adminDb, `graduationRounds/${roundOpenId}/supervisors/${supId}`), {
      supervisorId: supId,
      name: 'TS. Nguyễn Văn C',
      capacity: 5,
      activeInRound: true
    }));

    // Admin điều chỉnh hạn ngạch lên 8
    await assertSucceeds(updateDoc(doc(adminDb, `graduationRounds/${roundOpenId}/supervisors/${supId}`), {
      capacity: 8
    }));

    // Admin 2 ghi đồng thời cùng khóa supId: Document duy nhất supId, không tạo bản ghi thứ hai
    await assertSucceeds(setDoc(doc(adminDb, `graduationRounds/${roundOpenId}/supervisors/${supId}`), {
      supervisorId: supId,
      name: 'TS. Nguyễn Văn C',
      activeInRound: true
    }, { merge: true }));

    // Đọc lại document: chỉ tồn tại duy nhất 1 document với supId
    const snap = await getDoc(doc(adminDb, `graduationRounds/${roundOpenId}/supervisors/${supId}`));
    assert.equal(snap.exists(), true);
    assert.equal(snap.data().supervisorId, supId);
    assert.equal(snap.data().capacity, 8); // Hạn ngạch 8 không bị ghi đè!

    // Sinh viên không được phép sửa hoặc xóa GVHD trong đợt
    const studentDb = env.authenticatedContext('student1_uid', actor(student1Email)).firestore();
    await assertFails(updateDoc(doc(studentDb, `graduationRounds/${roundOpenId}/supervisors/${supId}`), {
      capacity: 20
    }));
    await assertFails(deleteDoc(doc(studentDb, `graduationRounds/${roundOpenId}/supervisors/${supId}`)));
  });

  await t.test('12. Người dùng chưa đăng nhập KHÔNG THỂ ghi hoặc đọc eligibleStudents', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`)));
    await assertFails(setDoc(doc(db, `graduationRounds/${roundOpenId}/eligibleStudents/${student1Mssv}`), {
      studentId: student1Mssv,
      eligible: false
    }));
  });
});
