import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';

let env;

const roundId = 'round_12_2026_test';
const studentMssv = '11900375';
const studentEmail = `${studentMssv}@student.tdtu.edu.vn`;
const otherStudentMssv = '11900999';
const otherStudentEmail = `${otherStudentMssv}@student.tdtu.edu.vn`;
const supervisorEmail = 'supervisor@tdtu.edu.vn';
const adminEmail = 'admin@tdtu.edu.vn';

function actor(email) {
  return {
    email,
    email_verified: true
  };
}

before(async () => {
  const rulesPath = path.resolve('firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  env = await initializeTestEnvironment({
    projectId: 'student-topic-revision-rules-test',
    firestore: { rules }
  });
});

beforeEach(async () => {
  await env.clearFirestore();

  // Setup initial round (Đợt 12/2026) that is PUBLISHED and closeAt is in the past!
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Round 12/2026 with closeAt in the past
    await setDoc(doc(db, `graduationRounds/${roundId}`), {
      status: 'published',
      title: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP - ĐỢT 12/2026',
      openAt: new Date(Date.now() - 60 * 24 * 3600 * 1000), // 60 days ago
      closeAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) // 30 days ago (CLOSED!)
    });

    // 2. Official assignment of student 11900375 to supervisor
    await setDoc(doc(db, `graduationRounds/${roundId}/officialAssignments/${studentMssv}`), {
      studentId: studentMssv,
      studentEmail: studentEmail,
      assignmentStatus: 'published',
      supervisorEmails: [supervisorEmail]
    });

    // 3. Existing student registration (Version 1 was approved)
    await setDoc(doc(db, `graduationRounds/${roundId}/registrations/${studentMssv}`), {
      studentId: studentMssv,
      studentName: 'Nguyễn Thanh Ngân',
      email: studentEmail,
      status: 'submitted',
      topicTitle: 'Thiết kế nội thất Nhà Hàng Chay',
      topicDescription: 'Mô tả ban đầu của đề tài',
      topicTitleVersion: 1,
      topicApprovalStatus: 'approved',
      topicReviewedBy: supervisorEmail,
      topicReviewedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      topicTitleHistory: [
        {
          version: 1,
          title: 'Thiết kế nội thất Nhà Hàng Chay',
          topicDescription: 'Mô tả ban đầu của đề tài',
          status: 'approved',
          reviewedBy: supervisorEmail
        }
      ],
      preferences: [
        { rank: 1, supervisorId: 'sup_1' }
      ]
    });
  });
});

after(async () => {
  if (env) {
    await env.cleanup();
  }
});

test('--- FIRESTORE RULES: STUDENT TOPIC REVISION (ĐỔI TÊN ĐỀ TÀI KHI ĐÃ ĐÓNG CỔNG) ---', async (t) => {
  await t.test('1. Sinh viên CÓ THỂ cập nhật tên đề tài & mô tả mới (Version 2, pending) khi closeAt đã qua -> SUCCEEDS', async () => {
    const db = env.authenticatedContext(studentMssv, actor(studentEmail)).firestore();
    const regRef = doc(db, `graduationRounds/${roundId}/registrations/${studentMssv}`);

    const newHistory = [
      {
        version: 1,
        title: 'Thiết kế nội thất Nhà Hàng Chay',
        topicDescription: 'Mô tả ban đầu của đề tài',
        status: 'approved',
        reviewedBy: supervisorEmail
      },
      {
        version: 2,
        title: 'Thiết kế nội thất Nhà Hàng Hạ Bạt',
        topicDescription: 'Dự án Nhà hàng Hạ Bạt hướng tới bình thường hóa ẩm thực thuần chay...',
        status: 'pending',
        submittedAt: new Date().toISOString()
      }
    ];

    await assertSucceeds(
      updateDoc(regRef, {
        topicTitle: 'Thiết kế nội thất Nhà Hàng Hạ Bạt',
        topicDescription: 'Dự án Nhà hàng Hạ Bạt hướng tới bình thường hóa ẩm thực thuần chay...',
        topicTitleVersion: 2,
        topicTitleHistory: newHistory,
        topicApprovalStatus: 'pending',
        topicApprovalNote: '',
        submittedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: studentEmail
      })
    );
  });

  await t.test('2. Sinh viên KHÔNG THỂ tự đánh dấu đề tài là approved -> FAILS', async () => {
    const db = env.authenticatedContext(studentMssv, actor(studentEmail)).firestore();
    const regRef = doc(db, `graduationRounds/${roundId}/registrations/${studentMssv}`);

    await assertFails(
      updateDoc(regRef, {
        topicTitle: 'Thiết kế nội thất Nhà Hàng Tự Duyệt',
        topicDescription: 'Sinh viên gian lận tự duyệt đề tài',
        topicTitleVersion: 2,
        topicApprovalStatus: 'approved',
        updatedAt: new Date()
      })
    );
  });

  await t.test('3. Sinh viên khác KHÔNG THỂ sửa đề tài của sinh viên này -> FAILS', async () => {
    const db = env.authenticatedContext(otherStudentMssv, actor(otherStudentEmail)).firestore();
    const regRef = doc(db, `graduationRounds/${roundId}/registrations/${studentMssv}`);

    await assertFails(
      updateDoc(regRef, {
        topicTitle: 'Thiết kế nội thất sửa lén của bạn',
        topicDescription: 'Hacker sinh viên',
        topicApprovalStatus: 'pending',
        updatedAt: new Date()
      })
    );
  });

  await t.test('4. Sinh viên KHÔNG THỂ thay đổi studentId, email hoặc preferences trong khi đổi đề tài -> FAILS', async () => {
    const db = env.authenticatedContext(studentMssv, actor(studentEmail)).firestore();
    const regRef = doc(db, `graduationRounds/${roundId}/registrations/${studentMssv}`);

    await assertFails(
      updateDoc(regRef, {
        topicTitle: 'Thiết kế nội thất Nhà Hàng Hạ Bạt',
        studentId: '11900888',
        topicApprovalStatus: 'pending',
        updatedAt: new Date()
      })
    );
  });

  await t.test('5. GVHD CÓ THỂ duyệt đề tài mới (Version 2) của sinh viên -> SUCCEEDS', async () => {
    const db = env.authenticatedContext('supervisor_uid', actor(supervisorEmail)).firestore();
    const regRef = doc(db, `graduationRounds/${roundId}/registrations/${studentMssv}`);

    await assertSucceeds(
      updateDoc(regRef, {
        topicApprovalStatus: 'approved',
        topicApprovalNote: 'Đồng ý tên đề tài mới',
        topicReviewedAt: new Date(),
        topicReviewedBy: supervisorEmail,
        updatedAt: new Date()
      })
    );
  });
});
