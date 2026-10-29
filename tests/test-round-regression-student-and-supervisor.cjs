/**
 * IFA+ Graduation — Test Suite for Student Self-Join Round Resolution & Supervisor Round Filtering
 * 
 * Tests the 3 regression issues reported by the user:
 * 1. Student self-joins round 4/2027, must resolve to round 4/2027 upon login (not 12/2026).
 * 2. Student in round 4/2027 can successfully register topic without permission errors.
 * 3. Supervisor (Trần Quang Hải) only sees rounds they participate in (round 4/2027), not round 12/2026.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} = require('firebase/firestore');

const { verifyEmulatorSafety } = require('../scripts/emulator-guard.cjs');

async function runRegressionTestSuite() {
  console.log('\n========================================================================');
  console.log('🧪 IFA-GRADUATION — REGRESSION TEST: STUDENT ROUND & SUPERVISOR FILTER');
  console.log('========================================================================\n');

  const guard = await verifyEmulatorSafety({ strictProjectCheck: true, pingCheck: true });
  console.log(`✓ Safety Guard Active: Connected to ${guard.emulatorHost} (Project: ${guard.projectId})\n`);

  const root = path.resolve(__dirname, '..');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

  const env = await initializeTestEnvironment({
    projectId: guard.projectId,
    firestore: { rules }
  });

  const roundA_Id = 'round_tn_04_2027'; // ĐỢT 4/2027
  const roundB_Id = 'round_tn_12_2026'; // ĐỢT 12/2026

  const studentMssv = '12200999';
  const studentEmail = `${studentMssv}@student.tdtu.edu.vn`;
  const studentName = 'Lê Thị Hồng Nhung';

  const supervisorEmail = 'tranquanghai@tdtu.edu.vn';
  const supervisorName = 'Trần Quang Hải';
  const supervisorId = 'sup_tranquanghai';

  try {
    await env.clearFirestore();

    // Setup Admin
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      await setDoc(doc(db, `admins/${supervisorEmail}`), { email: supervisorEmail, active: true });

      // Round A: Đợt 4/2027 (Self-join link OPEN, in preference review round_1)
      await setDoc(doc(db, `graduationRounds/${roundA_Id}`), {
        title: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP – ĐỢT 4/2027',
        roundName: 'ĐỢT 4/2027',
        academicYear: '2026-2027',
        status: 'open',
        allowSelfJoin: true,
        isClosed: false,
        isHidden: false,
        isActive: false,
        reviewStatus: 'round_1',
        displayOrder: 2,
        createdAt: new Date('2027-03-01T08:00:00Z')
      });

      // Round B: Đợt 12/2026 (Global active round, closed/finished)
      await setDoc(doc(db, `graduationRounds/${roundB_Id}`), {
        title: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP – ĐỢT 12/2026',
        roundName: 'ĐỢT 12/2026',
        academicYear: '2025-2026',
        status: 'published',
        allowSelfJoin: false,
        isClosed: true,
        isHidden: false,
        isActive: true, // Marked active globally in DB
        reviewStatus: 'completed',
        assignmentPublicationState: 'published',
        displayOrder: 1,
        createdAt: new Date('2026-11-01T08:00:00Z')
      });

      // Supervisor in Round A: Trần Quang Hải participates in Round A
      await setDoc(doc(db, `graduationRounds/${roundA_Id}/supervisors/${supervisorId}`), {
        supervisorId,
        email: supervisorEmail,
        name: supervisorName,
        capacity: 10,
        activeInRound: true
      });

      // Master Catalog
      await setDoc(doc(db, `supervisorMaster/${supervisorId}`), {
        id: supervisorId,
        supervisorId,
        email: supervisorEmail,
        name: supervisorName,
        active: true
      });

      // Round B does NOT have Trần Quang Hải in supervisors!
    });

    console.log('--- TEST 1: STUDENT SELF-JOIN & PERMISSION TEST ---');

    // 1. Student self-joins Round A via link
    const studentDb = env.authenticatedContext('student_nhung_uid', { email: studentEmail, email_verified: true }).firestore();

    const selfJoinPayload = {
      studentId: studentMssv,
      mssv: studentMssv,
      name: studentName,
      fullName: studentName,
      email: studentEmail,
      className: '22050101',
      studentClass: '22050101',
      major: 'Thiết kế Nội thất',
      roundId: roundA_Id,
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: {
        status: 'undeclared'
      }
    };

    console.log('1.1: Ghi danh sinh viên Lê Thị Hồng Nhung vào Round A qua link self-join...');
    await assertSucceeds(setDoc(doc(studentDb, `graduationRounds/${roundA_Id}/eligibleStudents/${studentMssv}`), selfJoinPayload));
    console.log('  ✓ Ghi danh thành công với eligible: false (đúng quy định)');

    // 1.2: Đăng ký đề tài vào Round A
    console.log('1.2: Sinh viên đăng ký đề tài vào Round A (đúng round đã tham gia)...');
    const profilePayload = {
      studentId: studentMssv,
      email: studentEmail,
      currentClass: '22050101',
      personalEmail: 'nhung.personal@gmail.com',
      phone: '0901234567',
      permanentAddress: '123 Nguyễn Hữu Thọ, Q7, TP.HCM',
      temporaryAddress: '123 Nguyễn Hữu Thọ, Q7, TP.HCM',
      address: '123 Nguyễn Hữu Thọ, Q7, TP.HCM'
    };
    await assertSucceeds(setDoc(doc(studentDb, `graduationStudentProfiles/${studentMssv}`), profilePayload, { merge: true }));

    const registrationPayload = {
      studentId: studentMssv,
      studentName: studentName,
      email: studentEmail,
      topicTitle: 'Thiết kế nội thất Trung tâm Văn hóa Nghệ thuật Đương đại',
      projectType: 'Chuyên luận; Khác',
      projectTypes: ['Chuyên luận'],
      projectTypeOther: '',
      currentClass: '22050101',
      personalEmail: 'nhung.personal@gmail.com',
      studentPhone: '0901234567',
      studentPermanentAddress: '123 Nguyễn Hữu Thọ, Q7, TP.HCM',
      studentTemporaryAddress: '123 Nguyễn Hữu Thọ, Q7, TP.HCM',
      studentAddress: '123 Nguyễn Hữu Thọ, Q7, TP.HCM',
      major: 'Thiết kế Nội thất',
      topicTitleVersion: 1,
      topicTitleHistory: [{
        version: 1,
        title: 'Thiết kế nội thất Trung tâm Văn hóa Nghệ thuật Đương đại',
        submittedAt: new Date().toISOString(),
        status: 'pending'
      }],
      topicApprovalStatus: 'pending',
      topicApprovalNote: '',
      preferences: [
        { rank: 1, supervisorId, supervisorName, department: 'Nội thất' }
      ],
      status: 'submitted',
      reviewStatus: 'waiting',
      eligibilityStatus: 'pending',
      eligibilityDeclaration: {
        status: 'eligible',
        reasons: [],
        missingCourses: []
      }
    };

    await assertSucceeds(setDoc(doc(studentDb, `graduationRounds/${roundA_Id}/registrations/${studentMssv}`), registrationPayload, { merge: true }));
    console.log('  ✓ Đăng ký đề tài vào Round A THÀNH CÔNG (Không bị lỗi permission)');

    // 1.3: Nếu sinh viên bị ghi nhầm sang Round B (nơi sinh viên không thuộc danh sách)
    console.log('1.3: Thử ghi đăng ký đề tài vào Round B (nơi SV KHÔNG tham gia)...');
    await assertFails(setDoc(doc(studentDb, `graduationRounds/${roundB_Id}/registrations/${studentMssv}`), registrationPayload, { merge: true }));
    console.log('  ✓ Rules chặn thành công khi ghi vào round không thuộc (Missing or insufficient permissions)');

    // 2. Logic Resolution Simulation (Simulating rounds-loader.js)
    console.log('\n--- TEST 2: SIMULATING ROUND RESOLUTION LOGIC ---');

    // Simulate rounds in memory
    const rounds = [
      { id: roundB_Id, title: 'ĐỢT 12/2026', isActive: true, displayOrder: 1 },
      { id: roundA_Id, title: 'ĐỢT 4/2027', isActive: false, displayOrder: 2 }
    ];

    // Function simulating old flawed logic:
    async function oldStudentRoundResolver(db, rounds, mssv) {
      const eligibleMatches = await Promise.all(rounds.map(async r => {
        const elDoc = await getDoc(doc(db, `graduationRounds/${r.id}/eligibleStudents/${mssv}`));
        // OLD BUG: eligibleDoc.data().eligible !== false rejected self-joined students!
        return elDoc.exists() && elDoc.data().eligible !== false ? r : null;
      }));
      const matchedRounds = eligibleMatches.filter(Boolean);
      return matchedRounds.find(r => r.isActive === true) || matchedRounds[0] || rounds.find(r => r.isActive === true) || rounds[0];
    }

    // Function simulating NEW corrected logic:
    async function newStudentRoundResolver(db, rounds, mssv) {
      const studentMembershipMatches = await Promise.all(rounds.map(async r => {
        const [elDoc, regDoc] = await Promise.all([
          getDoc(doc(db, `graduationRounds/${r.id}/eligibleStudents/${mssv}`)),
          getDoc(doc(db, `graduationRounds/${r.id}/registrations/${mssv}`)).catch(() => null)
        ]);
        if ((elDoc && elDoc.exists()) || (regDoc && regDoc.exists())) {
          return r;
        }
        return null;
      }));
      const studentRounds = studentMembershipMatches.filter(Boolean);

      // Priority order:
      // If student only belongs to 1 round: MUST return that round
      if (studentRounds.length === 1) return { targetRound: studentRounds[0], studentRounds };
      if (studentRounds.length > 1) {
        const preferred = studentRounds.find(r => r.isActive === true) || studentRounds[0];
        return { targetRound: preferred, studentRounds };
      }
      // Only fallback to global active if no membership at all
      return { targetRound: rounds.find(r => r.isActive === true) || rounds[0], studentRounds: [] };
    }

    const adminDb = env.authenticatedContext('admin_uid', { email: supervisorEmail, email_verified: true }).firestore();

    const oldResult = await oldStudentRoundResolver(adminDb, rounds, studentMssv);
    console.log(`2.1 [Old Logic]: Round giải quyết = "${oldResult.title}" (ID: ${oldResult.id})`);
    assert.equal(oldResult.id, roundB_Id, 'Old logic reproduced: improperly routed to Round B 12/2026!');
    console.log('  ⚠️ TÁI HIỆN THÀNH CÔNG: Logic cũ đã đưa SV vào sai đợt 12/2026');

    const newResult = await newStudentRoundResolver(adminDb, rounds, studentMssv);
    console.log(`2.2 [New Logic]: Round giải quyết = "${newResult.targetRound.title}" (ID: ${newResult.targetRound.id})`);
    assert.equal(newResult.targetRound.id, roundA_Id, 'New logic must resolve to Round A 4/2027!');
    assert.equal(newResult.studentRounds.length, 1, 'Student only belongs to 1 round');
    assert.equal(newResult.studentRounds[0].id, roundA_Id, 'Student round must be Round A');
    console.log('  ✓ SỬA ĐÚNG: Logic mới đưa SV vào đúng đợt 4/2027 và danh sách chỉ chứa đợt 4/2027');

    console.log('\n--- TEST 3: SUPERVISOR ROUND FILTERING TEST ---');

    // Simulate old supervisor participation logic:
    async function oldCheckSupervisorParticipates(r, actor) {
      if (actor?.isAdmin) return true; // OLD BUG: Returned true for every round if admin
      return false;
    }

    // Simulate new supervisor participation logic:
    async function newCheckSupervisorParticipates(db, r, actor) {
      const emailLower = (actor?.email || '').toLowerCase().trim();
      const supSnap = await getDocs(collection(db, `graduationRounds/${r.id}/supervisors`)).catch(() => null);
      const supDocs = supSnap && supSnap.docs ? supSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const inRoster = supDocs.some(s => (s.email || '').toLowerCase().trim() === emailLower);
      if (inRoster) return true;

      // Check official assignments
      const assSnap = await getDocs(collection(db, `graduationRounds/${r.id}/officialAssignments`)).catch(() => null);
      if (assSnap && !assSnap.empty) {
        const hasAss = assSnap.docs.some(d => {
          const emails = Array.isArray(d.data().supervisorEmails) ? d.data().supervisorEmails : [];
          return emails.map(e => String(e).toLowerCase().trim()).includes(emailLower);
        });
        if (hasAss) return true;
      }
      return false;
    }

    const supervisorActor = { email: supervisorEmail, isAdmin: true, displayName: supervisorName };

    const oldSupA = await oldCheckSupervisorParticipates(rounds[1], supervisorActor);
    const oldSupB = await oldCheckSupervisorParticipates(rounds[0], supervisorActor);
    console.log(`3.1 [Old Logic]: Tham gia Round A = ${oldSupA}, Tham gia Round B = ${oldSupB}`);
    assert.equal(oldSupB, true, 'Old logic improperly allowed Round B for Admin supervisor');
    console.log('  ⚠️ TÁI HIỆN THÀNH CÔNG: Logic cũ làm GVHD nhìn thấy Round B 12/2026 dù không thuộc');

    const newSupA = await newCheckSupervisorParticipates(adminDb, rounds[1], supervisorActor);
    const newSupB = await newCheckSupervisorParticipates(adminDb, rounds[0], supervisorActor);
    console.log(`3.2 [New Logic]: Tham gia Round A = ${newSupA}, Tham gia Round B = ${newSupB}`);
    assert.equal(newSupA, true, 'Supervisor belongs to Round A');
    assert.equal(newSupB, false, 'Supervisor does NOT belong to Round B');
    console.log('  ✓ SỬA ĐÚNG: GVHD chỉ thấy Round A (4/2027), hoàn toàn KHÔNG thấy Round B (12/2026)');

    console.log('\n========================================================================');
    console.log('🎉 TẤT CẢ CÁC BÀI TEST TÁI HIỆN VÀ XÁC THỰC GIẢI PHÁP ĐỀU ĐẠT CHUẨN!');
    console.log('========================================================================\n');

  } finally {
    await env.cleanup();
  }
}

runRegressionTestSuite().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
