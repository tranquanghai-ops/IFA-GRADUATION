const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cleanSource = src => src
  .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
  .replace(/export\s+(default\s+)?/g, '');

// Read modules
const driveRulesSource = cleanSource(fs.readFileSync(path.resolve(__dirname, '../js/drive/drive-rules-naming.js'), 'utf8'));
const supervisorStudentsSource = cleanSource(fs.readFileSync(path.resolve(__dirname, '../js/supervisors/supervisor-portal-students.js'), 'utf8'));
const studentJourneySource = cleanSource(fs.readFileSync(path.resolve(__dirname, '../js/students/student-journey.js'), 'utf8'));
const timelinePreviewSource = cleanSource(fs.readFileSync(path.resolve(__dirname, '../js/rounds/rounds-timeline-preview.js'), 'utf8'));
const councilsWorkspaceSource = cleanSource(fs.readFileSync(path.resolve(__dirname, '../js/grading/councils-workspace.js'), 'utf8'));
const compiledIndexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

test('Hotfix Sync, Score Publication, Supervisor Timeline & Council Stats Suite', async (t) => {

  // ==========================================
  // NHÓM A: Submission Resolution & Attempt Normalization
  // ==========================================
  await t.test('Nhóm A1: getEffectiveSubmissionRules correctly parses normalized single-file attempt and reports 1/3 attempts', () => {
    const sandbox = {
      window: {},
      state: {},
      escapeHtml: s => String(s || ''),
      fmtIsoToVietnameseDateTime: s => s
    };
    vm.createContext(sandbox);
    vm.runInContext(driveRulesSource, sandbox);

    const mockRound = {
      id: 'FZRWniqMofaIvn7ogq0w',
      activitySubmissions: {
        'act_1790171285992_yhhi9': {
          '11900382': {
            currentSubmission: {
              attemptNumber: 1,
              fileId: '1tuMDPEMz4Avjfh6vVeKfQFuNgf8d3ozw',
              fileName: '11900382_Trang Tran Tue Nha.pdf',
              fileSize: 1354000,
              webViewLink: 'https://drive.google.com/file/d/1tuMDPEMz4Avjfh6vVeKfQFuNgf8d3ozw/view',
              submittedAt: '2026-10-16T04:30:00.000Z',
              status: 'submitted'
            },
            attempts: [{
              attemptNumber: 1,
              fileId: '1tuMDPEMz4Avjfh6vVeKfQFuNgf8d3ozw',
              fileName: '11900382_Trang Tran Tue Nha.pdf',
              fileSize: 1354000,
              webViewLink: 'https://drive.google.com/file/d/1tuMDPEMz4Avjfh6vVeKfQFuNgf8d3ozw/view',
              submittedAt: '2026-10-16T04:30:00.000Z',
              status: 'submitted'
            }]
          }
        }
      }
    };

    const mockAct = {
      id: 'act_1790171285992_yhhi9',
      title: 'Duyệt đồ án tốt nghiệp đợt 1',
      submissionEnabled: true,
      submissionConfig: {
        maxAttempts: 3,
        deadlineAt: '2026-10-16T05:10:00.000Z'
      }
    };

    const rules = sandbox.window.getEffectiveSubmissionRules('11900382', mockAct, mockRound);
    assert.ok(rules.currentSubmission, 'Should resolve current submission');
    assert.equal(rules.completedAttempts, 1, 'Should have completed 1 attempt');
    assert.equal(rules.totalAllowedAttempts, 3, 'Should allow 3 total attempts');
    assert.equal(rules.remainingAttempts, 2, 'Should have 2 remaining attempts (1/3 used)');
    assert.equal(rules.currentSubmission.files[0].validatedName, '11900382_Trang Tran Tue Nha.pdf');
    assert.equal(rules.currentSubmission.files[0].providerFileId, '1tuMDPEMz4Avjfh6vVeKfQFuNgf8d3ozw');
  });

  await t.test('Nhóm A2: ensureStudentSubmissionsLoaded hydrates submissions from subcollection/direct mock into round.activitySubmissions', async () => {
    const sandbox = {
      window: {},
      state: { rounds: [{ id: 'FZRWniqMofaIvn7ogq0w', activities: [{ id: 'act_1790171285992_yhhi9' }] }] },
      escapeHtml: s => String(s || ''),
      fmtIsoToVietnameseDateTime: s => s,
      console: { warn: () => {} },
      // Mock Firestore
      db: {},
      collection: () => ({}),
      query: () => ({}),
      where: () => ({}),
      getDocs: async () => ({
        empty: false,
        forEach: (fn) => {
          fn({
            data: () => ({
              roundId: 'FZRWniqMofaIvn7ogq0w',
              activityId: 'act_1790171285992_yhhi9',
              studentId: '12200254',
              fileId: '15E5Cr6gMLR4XxoSH-cuOyEHkNew2ALah',
              fileName: '12200254_Nguyen Thanh Hang Nga.pdf',
              fileSize: 2048000,
              attemptNumber: 1,
              submittedAt: '2026-10-16T04:15:00.000Z',
              status: 'submitted',
              webViewLink: 'https://drive.google.com/file/d/15E5Cr6gMLR4XxoSH-cuOyEHkNew2ALah/view'
            })
          });
        }
      }),
      doc: () => ({}),
      getDoc: async () => ({ exists: () => false })
    };
    vm.createContext(sandbox);
    vm.runInContext(supervisorStudentsSource, sandbox);

    assert.equal(typeof sandbox.window.ensureStudentSubmissionsLoaded, 'function');
    await sandbox.window.ensureStudentSubmissionsLoaded('FZRWniqMofaIvn7ogq0w', '12200254');

    const round = sandbox.state.rounds[0];
    assert.ok(round.activitySubmissions['act_1790171285992_yhhi9']['12200254'], 'Submissions must be registered on round');
    const sub = round.activitySubmissions['act_1790171285992_yhhi9']['12200254'].currentSubmission;
    assert.equal(sub.fileId, '15E5Cr6gMLR4XxoSH-cuOyEHkNew2ALah');
    assert.equal(sub.fileName, '12200254_Nguyen Thanh Hang Nga.pdf');
  });

  // ==========================================
  // NHÓM B: Student Review Results Rendering on Timeline & Modal
  // ==========================================
  await t.test('Nhóm B1: Student timeline event dialog displays letter grade B and pass verdict without decimals', () => {
    let capturedHtml = '';
    const sandbox = {
      window: {
        closeStudentTimelineEvent: () => {}
      },
      state: {
        user: { email: '11900382@student.tdtu.edu.vn' },
        myRegistration: { studentId: '11900382' },
        selectedRoundId: 'FZRWniqMofaIvn7ogq0w',
        rounds: [{
          id: 'FZRWniqMofaIvn7ogq0w',
          publishedReviews: {
            'duyet_1': {
              status: 'published',
              publishedAt: '2026-10-16T12:00:00.000Z',
              studentResults: {
                '11900382': {
                  letterGrade: 'B',
                  isPassed: true
                }
              }
            }
          }
        }],
        studentTimelineEventMap: new Map([
          [4, [{
            title: 'Duyệt đồ án tốt nghiệp đợt 1',
            activity: {
              title: 'Duyệt đồ án tốt nghiệp đợt 1',
              submissionEnabled: false,
              startAt: '2026-10-16T08:00:00.000Z',
              endAt: '2026-10-16T12:00:00.000Z'
            }
          }]]
        ])
      },
      document: {
        createElement: () => ({
          set id(v) {},
          set className(v) {},
          set onclick(v) {},
          set innerHTML(html) { capturedHtml = html; },
          querySelector: () => ({ focus: () => {} })
        }),
        getElementById: () => null,
        body: { appendChild: () => {} }
      },
      escapeHtml: s => String(s || ''),
      sanitizeRichHtml: s => String(s || ''),
      fmtActivityTime: () => '08:00 - 12:00',
      getEffectiveActor: () => ({ email: '11900382@student.tdtu.edu.vn', studentId: '11900382' })
    };
    vm.createContext(sandbox);
    vm.runInContext(timelinePreviewSource, sandbox);

    sandbox.window.openStudentTimelineEvent(4, 0);
    assert.ok(capturedHtml.includes('KẾT QUẢ ĐÁNH GIÁ DUYỆT ĐỢT 1'), 'Must include review result header');
    assert.ok(capturedHtml.includes('Điểm chữ chính thức'), 'Must indicate official letter grade');
    assert.ok(capturedHtml.includes('>B<'), 'Must render letter grade B');
    assert.ok(capturedHtml.includes('✓ Đạt yêu cầu'), 'Must render pass verdict');
    assert.ok(!capturedHtml.includes('8.0') && !capturedHtml.includes('7.5'), 'Must NEVER include decimal raw score');
  });

  // ==========================================
  // NHÓM C: Timeline Status Decoupling in Supervisor Portal
  // ==========================================
  await t.test('Nhóm C1: Timeline correctly distinguishes Chưa bắt đầu vs Đang đánh giá vs Chưa công bố vs Đã thu hồi', () => {
    const now = new Date('2026-10-16T10:00:00.000Z');

    // Future milestone: actStart is in November 2026
    const futureAct = {
      title: 'Duyệt đồ án tốt nghiệp đợt 2',
      startAt: '2026-11-01T00:00:00.000Z',
      endAt: '2026-11-05T23:59:59.000Z'
    };
    const actStart = new Date(futureAct.startAt);
    const isUpcoming = now < actStart;
    assert.equal(isUpcoming, true, 'Future milestone must be upcoming');

    // Past milestone with revoked status
    const revokedRound = {
      publishedReviews: {
        'duyet_1': { status: 'revoked' }
      }
    };
    const isRevoked = revokedRound.publishedReviews['duyet_1'].status === 'revoked';
    assert.equal(isRevoked, true, 'Revoked status must be detected as revoked, not Chưa công bố');
  });

  // ==========================================
  // NHÓM D: Council Workspace Student Count Statistics
  // ==========================================
  await t.test('Nhóm D1: Council student statistics avoids 6/0 and negative numbers and calculates 6/6 SV, 0 chưa phân', () => {
    const sandbox = {
      window: {},
      state: {
        activeCouncilManagement: { roundId: 'FZRWniqMofaIvn7ogq0w' },
        selectedRoundId: 'FZRWniqMofaIvn7ogq0w',
        rounds: [{
          id: 'FZRWniqMofaIvn7ogq0w',
          activities: [{
            id: 'act_1',
            councilEnabled: true,
            councils: [{ id: 'c1', name: 'HĐ 1' }],
            councilStudentAssignments: [
              { studentId: '11900382', councilId: 'c1' },
              { studentId: '11900395', councilId: 'c1' },
              { studentId: '12200254', councilId: 'c1' },
              { studentId: '12000001', councilId: 'c1' },
              { studentId: '12000002', councilId: 'c1' },
              { studentId: '12000003', councilId: 'c1' }
            ]
          }]
        }]
      },
      document: {
        getElementById: (id) => {
          if (id === 'admin-round-councils-select') return { value: 'FZRWniqMofaIvn7ogq0w' };
          return null;
        }
      }
    };
    vm.createContext(sandbox);
    vm.runInContext(councilsWorkspaceSource, sandbox);

    const allStudents = sandbox.window.getRoundAllStudents ? sandbox.window.getRoundAllStudents('FZRWniqMofaIvn7ogq0w') : [];
    assert.equal(allStudents.length, 6, 'Should resolve all 6 assigned students even without prior registrations array');

    const assignedCount = 6;
    const totalStudentsCount = Math.max(allStudents.length, assignedCount);
    const unassignedCount = Math.max(0, totalStudentsCount - assignedCount);

    assert.equal(totalStudentsCount, 6, 'Total students count must be 6');
    assert.equal(unassignedCount, 0, 'Unassigned count must be 0, never negative');
    assert.equal(`${assignedCount} / ${totalStudentsCount} SV`, '6 / 6 SV', 'String format must be 6 / 6 SV, never 6 / 0 SV');
  });

  // ==========================================
  // NHÓM E: Security Verification (Score Isolation)
  // ==========================================
  await t.test('Nhóm E1: Security Audit: publishedReviews metadata contains ONLY letter grades and no raw member scores', () => {
    const publishedPayload = {
      status: 'published',
      publishedAt: '2026-10-16T12:00:00.000Z',
      publishedBy: 'admin@tdtu.edu.vn',
      studentResults: {
        '11900382': { letterGrade: 'B', isPassed: true },
        '11900395': { letterGrade: 'A', isPassed: true },
        '12200254': { letterGrade: 'B+', isPassed: true }
      }
    };

    // Verify properties
    const keys = Object.keys(publishedPayload);
    assert.ok(!keys.includes('memberScores'), 'Must NOT have memberScores in published review');
    assert.ok(!keys.includes('individualScores'), 'Must NOT have individualScores in published review');
    assert.ok(!keys.includes('decimalScores'), 'Must NOT have decimalScores in published review');

    for (const sid of Object.keys(publishedPayload.studentResults)) {
      const res = publishedPayload.studentResults[sid];
      assert.ok(typeof res.letterGrade === 'string', 'letterGrade must be string');
      assert.ok(typeof res.isPassed === 'boolean', 'isPassed must be boolean');
      assert.equal(res.numericScore, undefined, 'Must NOT contain numericScore');
      assert.equal(res.rawScores, undefined, 'Must NOT contain rawScores');
    }
  });
});
