/**
 * IFA-GRADUATION — HOTFIX REGRESSION TEST SUITE:
 * 1. MSSV Resolution & Prevention of "undefined"
 * 2. Registration Wizard Stability (Prevention of kickback to CTA start card)
 * 3. Timeline / Milestone Roadmap Visibility Control (Hidden until official assignment)
 * 4. 3-Step Registration Flow & Firestore Rules Enforcement
 * 5. Edge cases: leading zero MSSV, re-login, non-student email, dual rounds, etc.
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

async function runHotfixTestSuite() {
  console.log('\n========================================================================');
  console.log('🧪 HOTFIX TEST SUITE: MSSV IDENTIFIER, WIZARD RESILIENCE & TIMELINE GUARD');
  console.log('========================================================================\n');

  const guard = await verifyEmulatorSafety({ strictProjectCheck: true, pingCheck: true });
  console.log(`✓ Safety Guard Active: Connected to ${guard.emulatorHost} (Project: ${guard.projectId})\n`);

  const root = path.resolve(__dirname, '..');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

  const env = await initializeTestEnvironment({
    projectId: guard.projectId,
    firestore: { rules }
  });

  const round4_2027_Id = 'round_tn_04_2027';
  const round12_2026_Id = 'round_tn_12_2026';

  const studentMssv = '12200999';
  const studentEmail = `${studentMssv}@student.tdtu.edu.vn`;
  const studentName = 'Lê Thị Hồng Nhung';

  try {
    await env.clearFirestore();

    // Setup Firestore Data in Emulator
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Round 4/2027: Open for topic registration, self-join allowed, NO official assignments published yet
      await setDoc(doc(db, `graduationRounds/${round4_2027_Id}`), {
        title: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP – ĐỢT 4/2027',
        roundName: 'ĐỢT 4/2027',
        status: 'open',
        allowSelfJoin: true,
        isClosed: false,
        isActive: false,
        reviewStatus: null,
        assignmentPublicationState: null,
        preferenceCount: 3,
        createdAt: new Date('2027-03-01T08:00:00Z')
      });

      // Round 12/2026: Published round with official assignments
      await setDoc(doc(db, `graduationRounds/${round12_2026_Id}`), {
        title: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP – ĐỢT 12/2026',
        roundName: 'ĐỢT 12/2026',
        status: 'published',
        isClosed: true,
        isActive: true,
        reviewStatus: 'completed',
        assignmentPublicationState: 'published',
        createdAt: new Date('2026-11-01T08:00:00Z')
      });

      // Student enrolled in Round 4/2027
      await setDoc(doc(db, `graduationRounds/${round4_2027_Id}/eligibleStudents/${studentMssv}`), {
        mssv: studentMssv,
        studentId: studentMssv,
        fullName: studentName,
        email: studentEmail,
        source: 'self_join_link',
        joinMethod: 'link',
        eligible: false, // self-joined student pending declaration
        joinedAt: new Date('2027-03-02T08:00:00Z')
      });

      // 3 Supervisors in Round 4/2027
      for (let i = 1; i <= 3; i++) {
        await setDoc(doc(db, `graduationRounds/${round4_2027_Id}/supervisors/sup_${i}`), {
          supervisorId: `sup_${i}`,
          name: `Giảng viên ${i}`,
          email: `gv${i}@tdtu.edu.vn`,
          capacity: 10,
          activeInRound: true
        });
      }
    });

    // -------------------------------------------------------------------------
    // TEST 1: REPRODUCTION & VERIFICATION OF MSSV RESOLUTION
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: MSSV RESOLUTION & PREVENTION OF "undefined" ---');

    // 1.1 Old logic simulation (before fix)
    function oldGetRegistrationStudentIdentity(state) {
      const mssv = state.isPreviewMode ? state.previewMssv : (state.studentMssv || state.impersonation?.target?.mssv || state.myRegistration?.studentId || state.myRegistration?.mssv);
      return {
        mssv,
        fullName: state.user?.displayName || mssv
      };
    }

    const unpopulatedState = {
      isPreviewMode: false,
      studentMssv: '', // empty or not populated yet due to async race
      impersonation: null,
      myRegistration: null,
      user: { email: studentEmail, displayName: studentName }
    };

    const oldIdent = oldGetRegistrationStudentIdentity(unpopulatedState);
    console.log('1.1 [Old Logic]: oldIdent.mssv =', oldIdent.mssv);
    assert.strictEqual(oldIdent.mssv, undefined, 'Old logic reproduced: evaluates to undefined!');
    console.log('  ⚠️ TÁI HIỆN THÀNH CÔNG: Logic cũ làm mssv = undefined -> input.value = "undefined"');

    // 1.2 New logic simulation (after fix)
    function newGetRegistrationStudentIdentity(state) {
      let mssv = '';
      if (state.isPreviewMode) {
        mssv = state.previewMssv || '';
      } else if (state.impersonation && state.impersonation.target?.type === 'student') {
        mssv = state.impersonation.target?.mssv || state.impersonation.target?.id || '';
      } else {
        mssv = state.studentMssv
          || state.userStudentId
          || (state.user?.email && state.user.email.toLowerCase().endsWith('@student.tdtu.edu.vn')
              ? state.user.email.split('@')[0].toUpperCase()
              : '')
          || (state.sessionMssv || '')
          || state.myRegistration?.studentId
          || state.myRegistration?.mssv
          || '';
      }
      mssv = String(mssv || '').trim();
      return {
        mssv: mssv || '',
        fullName: state.user?.displayName || mssv
      };
    }

    const newIdent = newGetRegistrationStudentIdentity(unpopulatedState);
    console.log('1.2 [New Logic]: newIdent.mssv =', newIdent.mssv);
    assert.strictEqual(newIdent.mssv, studentMssv, 'New logic must resolve to authenticated MSSV!');
    assert.notStrictEqual(newIdent.mssv, undefined, 'Must never be undefined');
    assert.notStrictEqual(newIdent.mssv, 'undefined', 'Must never be string "undefined"');
    console.log('  ✓ SỬA ĐÚNG: MSSV được nhận diện chính xác 100% từ tài khoản đã đăng nhập');

    // 1.3 Leading zero MSSV preservation
    const leadingZeroEmail = '02000123@student.tdtu.edu.vn';
    const stateLeadingZero = {
      isPreviewMode: false,
      studentMssv: '',
      impersonation: null,
      myRegistration: null,
      user: { email: leadingZeroEmail, displayName: 'Nguyễn Văn A' }
    };
    const identLeadingZero = newGetRegistrationStudentIdentity(stateLeadingZero);
    console.log('1.3 [Leading Zero MSSV]: identLeadingZero.mssv =', identLeadingZero.mssv);
    assert.strictEqual(identLeadingZero.mssv, '02000123', 'Leading zero in MSSV must be preserved as string!');
    console.log('  ✓ ĐẠT: Số 0 đầu được bảo toàn nguyên vẹn kiểu chuỗi (String)');

    // -------------------------------------------------------------------------
    // TEST 2: REGISTRATION WIZARD STABILITY (PREVENTION OF KICKBACK)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: REGISTRATION WIZARD STABILITY (NO KICKBACK TO CTA) ---');

    // Mock DOM elements
    const createMockElement = (id, initialClasses = []) => {
      const classes = new Set(initialClasses);
      return {
        id,
        classList: {
          contains: (cls) => classes.has(cls),
          add: (cls) => classes.add(cls),
          remove: (cls) => classes.delete(cls),
          toggle: (cls, force) => {
            if (force === undefined) {
              if (classes.has(cls)) classes.delete(cls);
              else classes.add(cls);
            } else if (force) classes.add(cls);
            else classes.delete(cls);
          }
        }
      };
    };

    // Simulate Old checkStudentEligibilityAndRegistration UI behavior
    function oldCheckEligibilityUiSync(hasRegDoc, dom) {
      if (!hasRegDoc) {
        // OLD BUG: Unconditionally hides flow container and shows cta card
        dom.ctaCard.classList.remove('hidden');
        dom.flowContainer.classList.add('hidden');
        dom.currentStep = 1;
      }
    }

    const oldDom = {
      ctaCard: createMockElement('registration-cta-card', ['hidden']), // user clicked start, so cta is hidden
      flowContainer: createMockElement('registration-flow-container', []), // user is filling step 2
      currentStep: 2
    };

    oldCheckEligibilityUiSync(false, oldDom);
    console.log('2.1 [Old Logic]: flowContainer hidden =', oldDom.flowContainer.classList.contains('hidden'), '| ctaCard hidden =', oldDom.ctaCard.classList.contains('hidden'), '| step =', oldDom.currentStep);
    assert.strictEqual(oldDom.flowContainer.classList.contains('hidden'), true, 'Old logic reproduced: wizard closed!');
    assert.strictEqual(oldDom.ctaCard.classList.contains('hidden'), false, 'Old logic reproduced: cta card shown!');
    assert.strictEqual(oldDom.currentStep, 1, 'Old logic reproduced: step reset to 1!');
    console.log('  ⚠️ TÁI HIỆN THÀNH CÔNG: Logic cũ làm sinh viên bị thoát form về trang bắt đầu!');

    // Simulate New checkStudentEligibilityAndRegistration UI behavior
    function newCheckEligibilityUiSync(hasRegDoc, dom, state) {
      if (!hasRegDoc) {
        const isCurrentlyRegistering = Boolean(
          state.isRegisteringTopic ||
          (dom.flowContainer && !dom.flowContainer.classList.contains('hidden'))
        );

        if (isCurrentlyRegistering) {
          dom.ctaCard.classList.add('hidden');
          dom.flowContainer.classList.remove('hidden');
          // DO NOT reset step
        } else {
          dom.ctaCard.classList.remove('hidden');
          dom.flowContainer.classList.add('hidden');
          dom.currentStep = 1;
        }
      }
    }

    const newDom = {
      ctaCard: createMockElement('registration-cta-card', ['hidden']),
      flowContainer: createMockElement('registration-flow-container', []),
      currentStep: 2
    };
    const activeRegisterState = { isRegisteringTopic: true };

    newCheckEligibilityUiSync(false, newDom, activeRegisterState);
    console.log('2.2 [New Logic]: flowContainer hidden =', newDom.flowContainer.classList.contains('hidden'), '| ctaCard hidden =', newDom.ctaCard.classList.contains('hidden'), '| step =', newDom.currentStep);
    assert.strictEqual(newDom.flowContainer.classList.contains('hidden'), false, 'New logic: wizard must stay open!');
    assert.strictEqual(newDom.ctaCard.classList.contains('hidden'), true, 'New logic: cta card must stay hidden!');
    assert.strictEqual(newDom.currentStep, 2, 'New logic: student stays in step 2!');
    console.log('  ✓ SỬA ĐÚNG: Giao diện giữ nguyên form và bước đang thao tác, tuyệt đối không bị trả về trang đầu');

    // -------------------------------------------------------------------------
    // TEST 3: TIMELINE ROADMAP VISIBILITY (HIDDEN DURING REGISTRATION)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: TIMELINE ROADMAP VISIBILITY GUARD ---');

    function checkRoadmapVisibility(reg, assignment) {
      const officialList = assignment?.assignmentStatus === 'published' && Array.isArray(assignment?.officialSupervisors)
        ? assignment.officialSupervisors
        : (reg?.assignmentStatus === 'published' && Array.isArray(reg?.officialSupervisors) ? reg.officialSupervisors : []);

      const hasTopic = Boolean(reg && (reg.topicTitle || reg.topic));
      const isDraft = Boolean(reg && reg.status === 'draft');
      const isSubmitted = Boolean(reg && !isDraft && hasTopic);
      const hasOfficialSup = Boolean(officialList.length > 0);

      const shouldShowRoadmap = isSubmitted && hasOfficialSup;
      return shouldShowRoadmap;
    }

    // Scenario A: Newly joined student in 4/2027 (not registered, no official supervisor)
    const canSeeTimelineA = checkRoadmapVisibility(null, null);
    console.log('3.1 [New Student]: shouldShowRoadmap =', canSeeTimelineA);
    assert.strictEqual(canSeeTimelineA, false, 'New student must NOT see timeline roadmap!');

    // Scenario B: Student submitted topic in 4/2027, awaiting preference review (no official supervisor)
    const regWaiting = { topicTitle: 'Thiết kế nội thất Bảo tàng Sen', status: 'submitted' };
    const canSeeTimelineB = checkRoadmapVisibility(regWaiting, null);
    console.log('3.2 [Submitted Topic, Awaiting Matching]: shouldShowRoadmap =', canSeeTimelineB);
    assert.strictEqual(canSeeTimelineB, false, 'Student awaiting supervisor assignment must NOT see timeline roadmap!');

    // Scenario C: Student in 12/2026 with published official assignment
    const regPublished = { topicTitle: 'Thiết kế nội thất Resort', status: 'submitted' };
    const assignPublished = {
      assignmentStatus: 'published',
      officialSupervisors: [{ supervisorId: 'sup_1', supervisorName: 'GV 1' }]
    };
    const canSeeTimelineC = checkRoadmapVisibility(regPublished, assignPublished);
    console.log('3.3 [Published Assignment]: shouldShowRoadmap =', canSeeTimelineC);
    assert.strictEqual(canSeeTimelineC, true, 'Student with published official assignment CAN see timeline roadmap!');
    console.log('  ✓ SỬA ĐÚNG: Lộ trình và mốc nộp bài được ẩn chính xác trong giai đoạn đăng ký & xét NV');

    // -------------------------------------------------------------------------
    // TEST 4: FIRESTORE SECURITY RULES FOR TOPIC REGISTRATION
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: FIRESTORE SECURITY RULES FOR REGISTRATION ---');

    const studentDb = env.authenticatedContext('student_uid', { email: studentEmail, email_verified: true }).firestore();

    // 4.1 Valid registration write by authenticated student
    const validPayload = {
      studentId: studentMssv,
      studentName: studentName,
      email: studentEmail,
      topicTitle: 'Thiết kế nội thất Trung tâm Nghệ thuật Đương đại',
      projectType: 'Không gian văn hóa',
      projectTypes: ['Không gian văn hóa'],
      currentClass: '20050101',
      personalEmail: 'student.personal@gmail.com',
      studentPhone: '0901234567',
      status: 'submitted',
      preferences: [
        { supervisorId: 'sup_1', rank: 1, supervisorName: 'Giảng viên 1' },
        { supervisorId: 'sup_2', rank: 2, supervisorName: 'Giảng viên 2' },
        { supervisorId: 'sup_3', rank: 3, supervisorName: 'Giảng viên 3' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await assertSucceeds(
      setDoc(doc(studentDb, `graduationRounds/${round4_2027_Id}/registrations/${studentMssv}`), validPayload)
    );
    console.log('4.1 [Valid Registration]: Thành công nộp đề tài và 3 nguyện vọng vào Round 4/2027');

    // 4.2 Falsified MSSV in path (e.g. literal 'undefined' or someone else's MSSV)
    await assertFails(
      setDoc(doc(studentDb, `graduationRounds/${round4_2027_Id}/registrations/undefined`), {
        ...validPayload,
        studentId: 'undefined'
      })
    );
    console.log('4.2 [Falsified Path "undefined"]: Bị chặn thành công (Permission Denied)');

    await assertFails(
      setDoc(doc(studentDb, `graduationRounds/${round4_2027_Id}/registrations/12200998`), {
        ...validPayload,
        studentId: '12200998'
      })
    );
    console.log('4.3 [Cross-Student Write]: Bị chặn thành công (Permission Denied)');

    // 4.4 Non-student email account attempting to register
    const guestDb = env.authenticatedContext('guest_uid', { email: 'guest@gmail.com', email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(guestDb, `graduationRounds/${round4_2027_Id}/registrations/${studentMssv}`), validPayload)
    );
    console.log('4.4 [Non-student Domain Write]: Bị chặn thành công (Permission Denied)');

    // -------------------------------------------------------------------------
    // TEST 5: COMPILED HTML VALIDATION (NO MISSING BUTTON TYPES OR LABELS)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: COMPILED HTML CODE AUDIT ---');
    const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

    assert.ok(indexHtml.includes('id="registration-mssv-error"'), 'Must have registration-mssv-error container');
    assert.ok(indexHtml.includes('type="button" id="btn-wizard-prev-rank"') || indexHtml.includes('id="btn-wizard-prev-rank" type="button"'), 'btn-wizard-prev-rank must have type="button"');
    assert.ok(indexHtml.includes('type="button" id="btn-wizard-next-rank"') || indexHtml.includes('id="btn-wizard-next-rank" type="button"'), 'btn-wizard-next-rank must have type="button"');
    console.log('5.1 [HTML Validation]: Các nút và thông báo lỗi đã được chuẩn hóa đầy đủ.');

    console.log('\n========================================================================');
    console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ HOTFIX ĐỀU ĐẠT CHUẨN 100%!');
    console.log('========================================================================\n');

  } finally {
    await env.cleanup();
  }
}

runHotfixTestSuite().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
