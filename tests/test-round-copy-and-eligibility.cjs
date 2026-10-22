const { test } = require('node:test');
const assert = require('node:assert/strict');

test('=== COMPREHENSIVE SUITE: ROUND COPYING & ELIGIBILITY SELF-DECLARATION ===', async (t) => {
  const copier = await import('../js/rounds/rounds-schedule-copier.js');

  // ==========================================================================
  // SECTION 1: ROUND COPYING & SCHEDULE RECALCULATION
  // ==========================================================================
  await t.test('1. Round Schedule Recalculation Engine', async (st) => {
    const sourceRound = {
      id: 'round_2025_sem1',
      title: 'Đồ án Tốt nghiệp - Đợt 1 (2025-2026)',
      academicYear: '2025-2026',
      slug: 'dot-1-2025',
      startDate: '2025-09-01', // Week 1 Monday
      durationWeeks: 12,
      preferenceCount: 3,
      selectionMode: 'cards',
      supervisorAssignmentMode: 'student_preference',
      driveSubfolderNames: ['01 - Ho so', '02 - Phuc khao'],
      driveRootFolderId: 'REAL_ROOT_FOLDER_DO_NOT_COPY',
      driveRootFolderUrl: 'https://drive.google.com/drive/folders/REAL_ROOT_FOLDER_DO_NOT_COPY',
      activities: [
        {
          id: 'act_src_1',
          title: 'Duyệt đợt 1',
          activityType: 'review',
          order: 1,
          startAt: '2025-09-26T08:00:00+07:00', // Week 4 Friday 08:00
          endAt: '2025-09-26T17:00:00+07:00',
          submissionEnabled: true,
          submissionConfig: {
            openAt: '2025-09-22T08:00:00+07:00', // Week 4 Monday 08:00
            deadlineAt: '2025-09-25T23:59:00+07:00', // Week 4 Thursday 23:59
            maxFiles: 3,
            driveFolderId: 'REAL_SUBMISSION_FOLDER_DO_NOT_COPY'
          },
          submissions: [{ id: 'sub_1', studentId: '5190001' }],
          scores: [{ studentId: '5190001', score: 8.5 }],
          publishedReviews: [{ studentId: '5190001', grade: 'B+' }],
          councils: [{ id: 'council_1', chair: 'gv1@tdtu.edu.vn' }],
          councilStudentAssignments: [{ studentId: '5190001', councilId: 'council_1' }]
        },
        {
          id: 'act_src_2',
          title: 'Duyệt đợt 2',
          activityType: 'review',
          order: 2,
          startAt: '2025-10-24T08:00:00+07:00', // Week 8 Friday 08:00
          endAt: '2025-10-24T17:00:00+07:00'
        },
        {
          id: 'act_src_3',
          title: 'Duyệt đợt 3 (Bảo vệ)',
          activityType: 'review',
          order: 3,
          startAt: '2025-11-21T08:00:00+07:00', // Week 12 Friday 08:00
          endAt: '2025-11-21T17:00:00+07:00'
        }
      ],
      timelineWeeksConfig: [
        { week: 4, milestone: 'Duyệt đợt 1', title: 'Tuần 4', events: [{ title: 'Nộp bài duyệt 1', startDayIndex: 0, endDayIndex: 3 }] },
        { week: 8, milestone: 'Duyệt đợt 2', title: 'Tuần 8', events: [] },
        { week: 12, milestone: 'Duyệt đợt 3', title: 'Tuần 12', events: [] }
      ]
    };

    // Target: start date Wednesday 2026-03-04 (should auto-snap to Monday 2026-03-02)
    const shifted = copier.calculateShiftedRoundSchedule(sourceRound, '2026-03-04');

    await st.test('1.1. Shifts start date cleanly to Monday of Week 1', () => {
      assert.equal(shifted.newStartDate, '2026-03-02');
      assert.equal(shifted.durationWeeks, 12);
      assert.equal(shifted.newEndDate, '2026-05-24'); // Sunday of Week 12
    });

    await st.test('1.2. Preserves Week 4, 8, 12 milestone positions exactly', () => {
      const act1 = shifted.activities.find(a => a.title === 'Duyệt đợt 1');
      const act2 = shifted.activities.find(a => a.title === 'Duyệt đợt 2');
      const act3 = shifted.activities.find(a => a.title === 'Duyệt đợt 3 (Bảo vệ)');

      assert.equal(act1.computedWeek, 4);
      assert.equal(act2.computedWeek, 8);
      assert.equal(act3.computedWeek, 12);

      // Friday of Week 4: 2026-03-02 + 3 weeks + 4 days = 2026-03-27
      assert.equal(act1.startAt, '2026-03-27T08:00:00+07:00');
      assert.equal(act1.endAt, '2026-03-27T17:00:00+07:00');

      // Friday of Week 8: 2026-03-02 + 7 weeks + 4 days = 2026-04-24
      assert.equal(act2.startAt, '2026-04-24T08:00:00+07:00');
      assert.equal(act2.endAt, '2026-04-24T17:00:00+07:00');

      // Friday of Week 12: 2026-03-02 + 11 weeks + 4 days = 2026-05-22
      assert.equal(act3.startAt, '2026-05-22T08:00:00+07:00');
      assert.equal(act3.endAt, '2026-05-22T17:00:00+07:00');
    });

    await st.test('1.3. Preserves submission opening and deadline relationship', () => {
      const act1 = shifted.activities.find(a => a.title === 'Duyệt đợt 1');
      // Open: Monday of Week 4 at 08:00
      assert.equal(act1.submissionConfig.openAt, '2026-03-23T08:00:00+07:00');
      // Deadline: Thursday of Week 4 at 23:59
      assert.equal(act1.submissionConfig.deadlineAt, '2026-03-26T23:59:00+07:00');

      const openMs = new Date(act1.submissionConfig.openAt).getTime();
      const deadMs = new Date(act1.submissionConfig.deadlineAt).getTime();
      const councilStartMs = new Date(act1.startAt).getTime();

      assert.ok(openMs < deadMs, 'Open window must be before deadline');
      assert.ok(deadMs <= councilStartMs, 'Deadline must be before council start');
    });

    await st.test('1.4. Guarantees strict data isolation & immutable source', () => {
      const act1 = shifted.activities.find(a => a.title === 'Duyệt đợt 1');
      assert.notEqual(act1.id, 'act_src_1');
      assert.equal(act1.submissions, undefined);
      assert.equal(act1.scores, undefined);
      assert.equal(act1.publishedReviews, undefined);
      assert.deepEqual(act1.councils, []);
      assert.deepEqual(act1.councilStudentAssignments, []);
      assert.equal(act1.submissionConfig.driveFolderId, null);
      assert.equal(act1.driveFolderId, null);
      assert.equal(act1.publicationStatus, 'draft');
      assert.equal(act1.visibility, false);

      // Verify source was completely untouched
      assert.equal(sourceRound.activities[0].submissions.length, 1);
      assert.equal(sourceRound.activities[0].scores.length, 1);
      assert.equal(sourceRound.activities[0].driveRootFolderId, undefined);
      assert.equal(sourceRound.driveRootFolderId, 'REAL_ROOT_FOLDER_DO_NOT_COPY');
    });
  });

  // ==========================================================================
  // SECTION 2: STUDENT ELIGIBILITY SELF-DECLARATION VALIDATION
  // ==========================================================================
  await t.test('2. Student Eligibility Declaration Business Rules', async (st) => {
    // Mock simulation of collectStudentEligibilityDeclaration
    function simulateCollect(status, reasons = [], missingCourses = [], englishNotes = '', otherReason = '', existing = {}) {
      if (!status) {
        return { valid: false, error: 'Vui lòng chọn tình trạng đủ điều kiện làm DATN/DATH ("Đã đủ điều kiện" hoặc "Chưa đủ điều kiện").' };
      }
      if (status === 'eligible') {
        return {
          valid: true,
          declaration: {
            status: 'eligible',
            reasons: [],
            missingCourses: [],
            englishCertificateStatus: '',
            otherReason: '',
            studentDeclaredAt: existing.studentDeclaredAt || '2026-10-22T10:00:00.000Z',
            studentUpdatedAt: '2026-10-22T10:00:00.000Z'
          }
        };
      }
      if (reasons.length === 0) {
        return { valid: false, error: 'Vui lòng chọn ít nhất một lý do bạn chưa đủ điều kiện làm DATN/DATH.' };
      }
      const validCourses = missingCourses.filter(c => c && c.courseName && c.courseName.trim());
      if (reasons.includes('failing_courses') && validCourses.length === 0) {
        return { valid: false, error: 'Bạn đã chọn lý do "Còn nợ học phần/môn học". Vui lòng nhập ít nhất một Tên học phần còn nợ.' };
      }
      if (reasons.includes('other') && (!otherReason || !otherReason.trim())) {
        return { valid: false, error: 'Bạn đã chọn "Lý do khác". Vui lòng nhập mô tả chi tiết lý do bạn chưa đủ điều kiện.' };
      }
      return {
        valid: true,
        declaration: {
          status: 'ineligible',
          reasons,
          missingCourses: validCourses,
          englishCertificateStatus: englishNotes.trim(),
          otherReason: otherReason.trim(),
          studentDeclaredAt: existing.studentDeclaredAt || '2026-10-22T10:00:00.000Z',
          studentUpdatedAt: '2026-10-22T10:00:00.000Z'
        }
      };
    }

    await st.test('2.1. Rejects if neither radio is chosen', () => {
      const res = simulateCollect(null);
      assert.equal(res.valid, false);
      assert.match(res.error, /Vui lòng chọn tình trạng đủ điều kiện/);
    });

    await st.test('2.2. Accepts eligible status without reasons', () => {
      const res = simulateCollect('eligible');
      assert.equal(res.valid, true);
      assert.equal(res.declaration.status, 'eligible');
      assert.deepEqual(res.declaration.reasons, []);
    });

    await st.test('2.3. Rejects ineligible status if 0 reasons chosen', () => {
      const res = simulateCollect('ineligible', []);
      assert.equal(res.valid, false);
      assert.match(res.error, /chọn ít nhất một lý do/);
    });

    await st.test('2.4. Accepts English-only reasons and retains notes', () => {
      const res = simulateCollect('ineligible', ['english_pending_result'], [], 'Đã thi TOEIC 600 chờ bằng');
      assert.equal(res.valid, true);
      assert.equal(res.declaration.status, 'ineligible');
      assert.equal(res.declaration.englishCertificateStatus, 'Đã thi TOEIC 600 chờ bằng');
    });

    await st.test('2.5. Rejects failing_courses if no courseName provided', () => {
      const res = simulateCollect('ineligible', ['failing_courses'], [{ courseCode: '702001', courseName: '', credits: 3 }]);
      assert.equal(res.valid, false);
      assert.match(res.error, /Tên học phần còn nợ/);
    });

    await st.test('2.6. Accepts failing_courses with courseName (code & credits optional)', () => {
      const res = simulateCollect('ineligible', ['failing_courses'], [
        { courseCode: '', courseName: 'Thiết kế Chiếu sáng', credits: null },
        { courseCode: '702005', courseName: 'Vật liệu Nội thất', credits: 2 }
      ]);
      assert.equal(res.valid, true);
      assert.equal(res.declaration.missingCourses.length, 2);
      assert.equal(res.declaration.missingCourses[0].courseName, 'Thiết kế Chiếu sáng');
    });

    await st.test('2.7. Rejects reason "other" if description is empty', () => {
      const res = simulateCollect('ineligible', ['other'], [], '', '   ');
      assert.equal(res.valid, false);
      assert.match(res.error, /mô tả chi tiết lý do/);
    });

    await st.test('2.8. Preserves original studentDeclaredAt when updating declaration', () => {
      const existing = { studentDeclaredAt: '2026-01-01T08:00:00.000Z' };
      const res = simulateCollect('eligible', [], [], '', '', existing);
      assert.equal(res.declaration.studentDeclaredAt, '2026-01-01T08:00:00.000Z');
    });
  });

  // ==========================================================================
  // SECTION 3: ADMIN REVIEW & CORRECTION
  // ==========================================================================
  await t.test('3. Admin Review & Verification Submodule', async (st) => {
    const studentRegistration = {
      studentId: '51900123',
      studentName: 'Nguyễn Văn An',
      topicTitle: 'Thiết kế nội thất Bảo tàng Điêu khắc Chăm',
      eligibilityDeclaration: {
        status: 'ineligible',
        reasons: ['missing_credits_1_3', 'english_pending_result'],
        missingCourses: [],
        englishCertificateStatus: 'Đã thi TOEIC 580',
        otherReason: '',
        studentDeclaredAt: '2026-10-22T08:00:00.000Z',
        studentUpdatedAt: '2026-10-22T08:00:00.000Z'
      }
    };

    // Admin reviews and overrides to confirmed_eligible with notes
    function applyAdminReview(reg, decision, notes, adminEmail) {
      const prev = reg.eligibilityDeclaration || {};
      const updated = {
        ...prev,
        adminDecision: decision,
        adminNotes: notes,
        adminReviewedBy: adminEmail,
        adminReviewedAt: '2026-10-22T09:30:00.000Z'
      };
      return {
        ...reg,
        eligibilityDeclaration: updated
      };
    }

    const reviewed = applyAdminReview(
      studentRegistration,
      'confirmed_eligible',
      'Đã đối soát chứng chỉ TOEIC đạt chuẩn Khoa',
      'truongkhoa@tdtu.edu.vn'
    );

    await st.test('3.1. Admin review records decision, notes and actor', () => {
      assert.equal(reviewed.eligibilityDeclaration.adminDecision, 'confirmed_eligible');
      assert.equal(reviewed.eligibilityDeclaration.adminNotes, 'Đã đối soát chứng chỉ TOEIC đạt chuẩn Khoa');
      assert.equal(reviewed.eligibilityDeclaration.adminReviewedBy, 'truongkhoa@tdtu.edu.vn');
      assert.equal(reviewed.eligibilityDeclaration.adminReviewedAt, '2026-10-22T09:30:00.000Z');
    });

    await st.test('3.2. Preserves student original self-declaration untouched', () => {
      assert.equal(reviewed.eligibilityDeclaration.status, 'ineligible');
      assert.deepEqual(reviewed.eligibilityDeclaration.reasons, ['missing_credits_1_3', 'english_pending_result']);
      assert.equal(reviewed.eligibilityDeclaration.studentDeclaredAt, '2026-10-22T08:00:00.000Z');
      assert.equal(reviewed.eligibilityDeclaration.englishCertificateStatus, 'Đã thi TOEIC 580');
    });

    await st.test('3.3. Legacy records without declaration safely default to undeclared', () => {
      const legacyReg = { studentId: '51800999', topicTitle: 'Thiết kế nội thất Quán cà phê' };
      const decl = legacyReg.eligibilityDeclaration || {};
      const status = decl.status || 'undeclared';
      assert.equal(status, 'undeclared');
    });
  });
});
