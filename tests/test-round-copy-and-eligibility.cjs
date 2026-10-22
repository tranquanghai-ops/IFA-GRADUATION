const { test } = require('node:test');
const assert = require('node:assert/strict');

test('=== COMPREHENSIVE SUITE: ROUND COPYING & ELIGIBILITY SELF-DECLARATION ===', async (t) => {
  const copier = await import('../js/rounds/rounds-schedule-copier.js');

  // ==========================================================================
  // SECTION 1: ROUND COPYING & SCHEDULE RECALCULATION (13 WEEKS, WEEKS 4/8/12/13)
  // ==========================================================================
  await t.test('1. Round Schedule Recalculation Engine', async (st) => {
    // 13-week round setup: Duyệt 1 (Week 4), Duyệt 2 (Week 8), Duyệt 3 (Week 12), Bảo vệ (Week 13)
    const sourceRound13Weeks = {
      id: 'round_2025_sem1_13w',
      title: 'Đồ án Tốt nghiệp - Đợt 1 (2025-2026)',
      academicYear: '2025-2026',
      slug: 'dot-1-2025-13w',
      startDate: '2025-09-01', // Week 1 Monday
      durationWeeks: 13,
      preferenceCount: 3,
      selectionMode: 'cards',
      supervisorAssignmentMode: 'student_preference',
      driveSubfolderNames: ['01 - Ho so', '02 - Phuc khao', '03 - Hoi dong'],
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
            deadlineAt: '2025-09-26T07:30:00+07:00', // Week 4 Friday 07:30 (30 mins before council)
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
          endAt: '2025-10-24T17:00:00+07:00',
          submissionEnabled: true,
          submissionConfig: {
            openAt: '2025-10-20T08:00:00+07:00',
            deadlineAt: '2025-10-24T07:30:00+07:00'
          }
        },
        {
          id: 'act_src_3',
          title: 'Duyệt đợt 3',
          activityType: 'review',
          order: 3,
          startAt: '2025-11-21T08:00:00+07:00', // Week 12 Friday 08:00
          endAt: '2025-11-21T17:00:00+07:00',
          submissionEnabled: true,
          submissionConfig: {
            openAt: '2025-11-17T08:00:00+07:00',
            deadlineAt: '2025-11-21T07:30:00+07:00'
          }
        },
        {
          id: 'act_src_4',
          title: 'Bảo vệ tốt nghiệp chính thức',
          activityType: 'defense',
          order: 4,
          startAt: '2025-11-28T08:00:00+07:00', // Week 13 Friday 08:00
          endAt: '2025-11-28T17:00:00+07:00'
        }
      ],
      timelineWeeksConfig: [
        { week: 4, milestone: 'Duyệt đợt 1', title: 'Tuần 4', events: [{ title: 'Nộp bài duyệt 1', startDayIndex: 0, endDayIndex: 4 }] },
        { week: 8, milestone: 'Duyệt đợt 2', title: 'Tuần 8', events: [] },
        { week: 12, milestone: 'Duyệt đợt 3', title: 'Tuần 12', events: [] },
        { week: 13, milestone: 'Bảo vệ chính thức', title: 'Tuần 13', events: [] }
      ]
    };

    // Target: New start date Monday 2026-03-02
    const shifted = copier.calculateShiftedRoundSchedule(sourceRound13Weeks, '2026-03-02');

    await st.test('1.1. Shifts 13-week schedule cleanly preserving duration and end date', () => {
      assert.equal(shifted.newStartDate, '2026-03-02');
      assert.equal(shifted.durationWeeks, 13);
      assert.equal(shifted.newEndDate, '2026-05-31'); // Sunday of Week 13
    });

    await st.test('1.2. Preserves Week 4, 8, 12, 13 milestone positions and Friday weekdays', () => {
      const act1 = shifted.activities.find(a => a.title === 'Duyệt đợt 1');
      const act2 = shifted.activities.find(a => a.title === 'Duyệt đợt 2');
      const act3 = shifted.activities.find(a => a.title === 'Duyệt đợt 3');
      const act4 = shifted.activities.find(a => a.title === 'Bảo vệ tốt nghiệp chính thức');

      assert.equal(act1.computedWeek, 4);
      assert.equal(act1.weekdayName, 'Thứ Sáu');
      assert.equal(act1.startAt, '2026-03-27T08:00:00+07:00');

      assert.equal(act2.computedWeek, 8);
      assert.equal(act2.weekdayName, 'Thứ Sáu');
      assert.equal(act2.startAt, '2026-04-24T08:00:00+07:00');

      assert.equal(act3.computedWeek, 12);
      assert.equal(act3.weekdayName, 'Thứ Sáu');
      assert.equal(act3.startAt, '2026-05-22T08:00:00+07:00');

      assert.equal(act4.computedWeek, 13);
      assert.equal(act4.weekdayName, 'Thứ Sáu');
      assert.equal(act4.startAt, '2026-05-29T08:00:00+07:00');
    });

    await st.test('1.3. Preserves submission opening and 07:30 deadline (30 mins before council)', () => {
      const act1 = shifted.activities.find(a => a.title === 'Duyệt đợt 1');
      assert.equal(act1.submissionConfig.openAt, '2026-03-23T08:00:00+07:00');
      assert.equal(act1.submissionConfig.deadlineAt, '2026-03-27T07:30:00+07:00');
      assert.equal(act1.startAt, '2026-03-27T08:00:00+07:00');

      const deadMs = new Date(act1.submissionConfig.deadlineAt).getTime();
      const startMs = new Date(act1.startAt).getTime();
      assert.equal(startMs - deadMs, 30 * 60 * 1000, '30-minute window before council is preserved exactly');
    });

    await st.test('1.4. Validates and warns without silently modifying deadline if deadline > startAt', () => {
      const invalidSource = {
        startDate: '2025-09-01',
        activities: [
          {
            title: 'Mốc có deadline sau giờ Hội đồng',
            startAt: '2025-09-26T08:00:00+07:00',
            submissionEnabled: true,
            submissionConfig: {
              openAt: '2025-09-22T08:00:00+07:00',
              deadlineAt: '2025-09-26T10:00:00+07:00' // After 08:00!
            }
          }
        ]
      };
      const res = copier.calculateShiftedRoundSchedule(invalidSource, '2026-03-02');
      assert.ok(res.validationWarnings.length > 0, 'Must record warning');
      assert.match(res.validationWarnings[0], /trễ hơn thời điểm Hội đồng bắt đầu/);
      // Deadline was NOT silently mutated:
      assert.equal(res.activities[0].submissionConfig.deadlineAt, '2026-03-27T10:00:00+07:00');
    });

    await st.test('1.5. Strict isolation: all IDs regenerated and data purged', () => {
      const act1 = shifted.activities[0];
      assert.notEqual(act1.id, 'act_src_1');
      assert.equal(act1.submissions, undefined);
      assert.equal(act1.scores, undefined);
      assert.equal(act1.publishedReviews, undefined);
      assert.deepEqual(act1.councils, []);
      assert.equal(act1.submissionConfig.driveFolderId, null);
    });
  });

  // ==========================================================================
  // SECTION 2: 9 STANDARDIZED REASONS & STUDENT DECLARATION
  // ==========================================================================
  await t.test('2. 9 Standardized Ineligibility Reasons & Student Form Logic', async (st) => {
    const EXPECTED_9_REASONS = [
      'wrong_registration',
      'no_english_cert',
      'english_waiting_result',
      'english_waiting_verification',
      'missing_credits_1_3',
      'missing_credits_4_6',
      'missing_credits_7_10',
      'failing_courses',
      'other'
    ];

    function simulateStudentCollect(status, reasons = [], missingCourses = [], englishNotes = '', otherReason = '', existing = {}) {
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
        return { valid: false, error: 'Bạn đã chọn lý do "Còn nợ học phần/môn học chưa đạt". Vui lòng nhập ít nhất một Tên học phần còn nợ.' };
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

    await st.test('2.1. Exact 9 reasons are supported without missing or spurious reasons', () => {
      EXPECTED_9_REASONS.forEach(code => {
        let dummyCourses = code === 'failing_courses' ? [{ courseName: 'Toán' }] : [];
        let dummyOther = code === 'other' ? 'Lý do khác chi tiết' : '';
        const res = simulateStudentCollect('ineligible', [code], dummyCourses, '', dummyOther);
        assert.equal(res.valid, true, `Reason code ${code} must be accepted`);
        assert.deepEqual(res.declaration.reasons, [code]);
      });
    });

    await st.test('2.2. Missing credits (1-3, 4-6, 7-10) does NOT force entering courses if unknown', () => {
      const res = simulateStudentCollect('ineligible', ['missing_credits_1_3'], []);
      assert.equal(res.valid, true);
      assert.deepEqual(res.declaration.missingCourses, []);
    });

    await st.test('2.3. Missing credits accepts optional courses if known by student', () => {
      const res = simulateStudentCollect('ineligible', ['missing_credits_4_6'], [
        { courseCode: '702001', courseName: 'Cơ sở Kiến trúc', credits: 3 }
      ]);
      assert.equal(res.valid, true);
      assert.equal(res.declaration.missingCourses.length, 1);
      assert.equal(res.declaration.missingCourses[0].courseName, 'Cơ sở Kiến trúc');
    });

    await st.test('2.4. Failing courses strictly requires at least 1 courseName', () => {
      const res = simulateStudentCollect('ineligible', ['failing_courses'], []);
      assert.equal(res.valid, false);
      assert.match(res.error, /Còn nợ học phần\/môn học chưa đạt/);
    });

    await st.test('2.5. Retains distinct English reasons and notes', () => {
      const res = simulateStudentCollect('ineligible', ['english_waiting_verification'], [], 'Đã thi IELTS 6.0, đang chờ trường hậu kiểm');
      assert.equal(res.valid, true);
      assert.equal(res.declaration.reasons[0], 'english_waiting_verification');
      assert.equal(res.declaration.englishCertificateStatus, 'Đã thi IELTS 6.0, đang chờ trường hậu kiểm');
    });
  });

  // ==========================================================================
  // SECTION 3: ADMIN DETAILED EDITING & PRESERVING ORIGINAL DECLARATION
  // ==========================================================================
  await t.test('3. Admin Detailed Review, Correction & Immutability', async (st) => {
    const studentRegistration = {
      studentId: '51900123',
      studentName: 'Trần Minh Tâm',
      topicTitle: 'Không gian Văn hóa Nghệ thuật',
      eligibilityDeclaration: {
        status: 'ineligible',
        reasons: ['missing_credits_1_3', 'no_english_cert'],
        missingCourses: [],
        englishCertificateStatus: 'Chưa thi chứng chỉ',
        otherReason: '',
        studentDeclaredAt: '2026-10-22T08:00:00.000Z',
        studentUpdatedAt: '2026-10-22T08:00:00.000Z'
      }
    };

    // Simulate Admin review with complete override
    function simulateAdminReview(reg, adminDecision, adminReasons, adminCourses, adminEnglish, adminOther, adminNote, adminEmail) {
      let status = 'eligible';
      if (adminDecision === 'confirmed_ineligible') status = 'ineligible';
      else if (adminDecision === 'pending_documents') status = 'pending_documents';

      const prevAdmin = reg.adminReview || {};
      const newAdminReview = {
        status: status,
        decision: adminDecision,
        reasons: adminReasons,
        missingCourses: adminCourses,
        englishCertificateStatus: adminEnglish,
        otherReason: adminOther,
        adminNote: adminNote,
        reviewedBy: adminEmail,
        reviewedAt: '2026-10-22T09:30:00.000Z',
        history: [
          ...(Array.isArray(prevAdmin.history) ? prevAdmin.history : []),
          {
            status: status,
            decision: adminDecision,
            reasons: adminReasons,
            missingCourses: adminCourses,
            englishCertificateStatus: adminEnglish,
            otherReason: adminOther,
            adminNote: adminNote,
            reviewedBy: adminEmail,
            reviewedAt: '2026-10-22T09:30:00.000Z'
          }
        ]
      };

      return {
        ...reg,
        adminReview: newAdminReview
      };
    }

    const reviewed = simulateAdminReview(
      studentRegistration,
      'confirmed_ineligible',
      ['failing_courses', 'english_waiting_verification'],
      [{ courseCode: '702009', courseName: 'Xây dựng Cơ bản', credits: 3 }],
      'Sinh viên nộp phiếu điểm TOEIC 450, cần kiểm tra hậu kiểm',
      '',
      'Học bạ trường xác nhận còn nợ môn 702009',
      'giaovu@tdtu.edu.vn'
    );

    await st.test('3.1. Admin can independently modify reasons, courses, english status and notes', () => {
      assert.equal(reviewed.adminReview.status, 'ineligible');
      assert.deepEqual(reviewed.adminReview.reasons, ['failing_courses', 'english_waiting_verification']);
      assert.equal(reviewed.adminReview.missingCourses.length, 1);
      assert.equal(reviewed.adminReview.missingCourses[0].courseCode, '702009');
      assert.equal(reviewed.adminReview.englishCertificateStatus, 'Sinh viên nộp phiếu điểm TOEIC 450, cần kiểm tra hậu kiểm');
      assert.equal(reviewed.adminReview.adminNote, 'Học bạ trường xác nhận còn nợ môn 702009');
      assert.equal(reviewed.adminReview.reviewedBy, 'giaovu@tdtu.edu.vn');
    });

    await st.test('3.2. Preserves student original self-declaration 100% immutable', () => {
      assert.equal(reviewed.eligibilityDeclaration.status, 'ineligible');
      assert.deepEqual(reviewed.eligibilityDeclaration.reasons, ['missing_credits_1_3', 'no_english_cert']);
      assert.equal(reviewed.eligibilityDeclaration.englishCertificateStatus, 'Chưa thi chứng chỉ');
      assert.deepEqual(reviewed.eligibilityDeclaration.missingCourses, []);
      assert.equal(reviewed.eligibilityDeclaration.studentDeclaredAt, '2026-10-22T08:00:00.000Z');
    });

    await st.test('3.3. Preserves review history when Admin edits multiple times', () => {
      const secondReview = simulateAdminReview(
        reviewed,
        'confirmed_eligible',
        [],
        [],
        'Đã hậu kiểm đạt chuẩn',
        '',
        'Đã bổ sung chứng chỉ hợp lệ',
        'truongkhoa@tdtu.edu.vn'
      );
      assert.equal(secondReview.adminReview.status, 'eligible');
      assert.equal(secondReview.adminReview.history.length, 2);
      assert.equal(secondReview.adminReview.history[0].status, 'ineligible');
      assert.equal(secondReview.adminReview.history[1].status, 'eligible');
    });

    await st.test('3.4. Effective status resolution rules', () => {
      function getEffectiveStatus(reg) {
        if (reg.adminReview?.status) return { effective: reg.adminReview.status, source: 'admin' };
        if (reg.eligibilityDeclaration?.status && reg.eligibilityDeclaration.status !== 'undeclared') {
          return { effective: reg.eligibilityDeclaration.status, source: 'student' };
        }
        return { effective: 'undeclared', source: 'none' };
      }

      // Case 1: Student ineligible, Admin overrides to eligible -> Admin wins
      assert.deepEqual(getEffectiveStatus(reviewed), { effective: 'ineligible', source: 'admin' });

      // Case 2: Student eligible, no Admin review -> Student wins
      assert.deepEqual(getEffectiveStatus(studentRegistration), { effective: 'ineligible', source: 'student' });

      // Case 3: Legacy record without declaration or review -> undeclared
      assert.deepEqual(getEffectiveStatus({ studentId: '51700999' }), { effective: 'undeclared', source: 'none' });
    });
  });
});
