const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// Load logic functions from student-topic-pdf.js
// We extract and run the pure functions in node context
const topicPdfSource = read('js/students/student-topic-pdf.js');

function evalTopicPdfModule() {
  const sandbox = { window: {} };
  const cleaned = topicPdfSource
    .replace(/^export\s+/gm, '')
    .replace(/^import\s+.*?;\s*$/gm, '');
  const fn = new Function('window', cleaned + '; return window;');
  return fn(sandbox.window);
}

const mod = evalTopicPdfModule();
const {
  getApprovedTopicVersions,
  getOfficialApprovedTopicTitle,
  getTopicPendingProposal
} = mod;

test('Topic Approval & Versioning Hotfix Suite', async (t) => {

  await t.test('1. Pure Logic: getApprovedTopicVersions extracts approved versions in order', () => {
    const reg = {
      topicTitle: 'Tên đề tài v2 đang chờ duyệt',
      topicTitleVersion: 2,
      topicApprovalStatus: 'pending',
      topicTitleHistory: [
        {
          version: 1,
          topicTitle: 'Tên đề tài v1 đã duyệt',
          topicDescription: 'Mô tả v1',
          status: 'approved',
          reviewedAt: '2026-09-01T08:00:00Z',
          reviewedBy: 'gvhd@tdtu.edu.vn',
          note: 'Đồng ý duyệt'
        },
        {
          version: 2,
          topicTitle: 'Tên đề tài v2 đang chờ duyệt',
          topicDescription: 'Mô tả v2',
          status: 'pending'
        }
      ]
    };

    const approvedList = getApprovedTopicVersions(reg);
    assert.equal(approvedList.length, 1);
    assert.equal(approvedList[0].version, 1);
    assert.equal(approvedList[0].topicTitle, 'Tên đề tài v1 đã duyệt');
    assert.equal(approvedList[0].reviewedBy, 'gvhd@tdtu.edu.vn');
  });

  await t.test('2. Pure Logic: getOfficialApprovedTopicTitle returns latest approved version, never unapproved proposal', () => {
    // Student with v1 approved, v2 pending proposal
    const regWithPendingV2 = {
      topicTitle: 'Đề tài v2 chưa duyệt',
      topicTitleVersion: 2,
      topicApprovalStatus: 'pending',
      topicTitleHistory: [
        {
          version: 1,
          topicTitle: 'Đề tài v1 chính thức',
          status: 'approved',
          reviewedAt: '2026-09-01T08:00:00Z'
        },
        {
          version: 2,
          topicTitle: 'Đề tài v2 chưa duyệt',
          status: 'pending'
        }
      ]
    };

    const officialTitle = getOfficialApprovedTopicTitle(regWithPendingV2);
    assert.equal(officialTitle, 'Đề tài v1 chính thức', 'Official title must be v1 while v2 is pending');
  });

  await t.test('3. Pure Logic: getOfficialApprovedTopicTitle updates to v2 when v2 is approved', () => {
    // When supervisor approves v2
    const regWithApprovedV2 = {
      topicTitle: 'Đề tài v2 đã duyệt',
      topicTitleVersion: 2,
      topicApprovalStatus: 'approved',
      topicTitleHistory: [
        {
          version: 1,
          topicTitle: 'Đề tài v1 ban đầu',
          status: 'approved',
          reviewedAt: '2026-09-01T08:00:00Z'
        },
        {
          version: 2,
          topicTitle: 'Đề tài v2 đã duyệt',
          status: 'approved',
          reviewedAt: '2026-09-15T10:00:00Z'
        }
      ]
    };

    const officialTitle = getOfficialApprovedTopicTitle(regWithApprovedV2);
    assert.equal(officialTitle, 'Đề tài v2 đã duyệt', 'Official title must transition to v2 upon approval');
  });

  await t.test('4. Pure Logic: getOfficialApprovedTopicTitle keeps v1 if v2 is rejected', () => {
    // When supervisor rejects v2
    const regWithRejectedV2 = {
      topicTitle: 'Đề tài v2 bị từ chối',
      topicTitleVersion: 2,
      topicApprovalStatus: 'rejected',
      topicApprovalNote: 'Tên đề tài không phù hợp nội dung',
      topicTitleHistory: [
        {
          version: 1,
          topicTitle: 'Đề tài v1 chuẩn',
          status: 'approved',
          reviewedAt: '2026-09-01T08:00:00Z'
        },
        {
          version: 2,
          topicTitle: 'Đề tài v2 bị từ chối',
          status: 'rejected',
          note: 'Tên đề tài không phù hợp nội dung',
          reviewedAt: '2026-09-10T14:00:00Z'
        }
      ]
    };

    const officialTitle = getOfficialApprovedTopicTitle(regWithRejectedV2);
    assert.equal(officialTitle, 'Đề tài v1 chuẩn', 'Official title must remain v1 when v2 is rejected');
  });

  await t.test('5. Pure Logic: getTopicPendingProposal detects pending proposal', () => {
    const reg = {
      topicTitle: 'Đề tài v2 mới',
      topicTitleVersion: 2,
      topicApprovalStatus: 'pending',
      topicTitleHistory: [
        { version: 1, topicTitle: 'Đề tài v1', status: 'approved' },
        { version: 2, topicTitle: 'Đề tài v2 mới', status: 'pending', topicDescription: 'Mô tả v2' }
      ]
    };

    const proposal = getTopicPendingProposal(reg);
    assert.ok(proposal);
    assert.equal(proposal.version, 2);
    assert.equal(proposal.topicTitle, 'Đề tài v2 mới');
  });

  await t.test('6. Pure Logic: backward compatibility when record lacks topicTitleHistory', () => {
    const legacyReg = {
      topicTitle: 'Đề tài khóa cũ chưa có history',
      topicApprovalStatus: 'approved'
    };

    const officialTitle = getOfficialApprovedTopicTitle(legacyReg);
    assert.equal(officialTitle, 'Đề tài khóa cũ chưa có history');

    const emptyReg = {};
    assert.equal(getOfficialApprovedTopicTitle(emptyReg, 'Mặc định'), 'Mặc định');
  });

  await t.test('7. Supervisor Portal Students: displays official topic title and pending proposal alert', () => {
    const source = read('js/supervisors/supervisor-portal-students.js');
    // Must call getOfficialApprovedTopicTitle
    assert.match(source, /getOfficialApprovedTopicTitle\(st/);
    // Must call getTopicPendingProposal
    assert.match(source, /getTopicPendingProposal\(st/);
    // Must render pending proposal warning alert
    assert.match(source, /Đề xuất đổi tên đề tài \(Lần/);
    assert.match(source, /Chờ GVHD duyệt/);
    // Must render button for latest approved registration sheet with version number
    assert.match(source, /Phiếu ĐK lần \$\{latestApprovedVer\}/);
    // Must render button to review pending proposal
    assert.match(source, /Duyệt đề tài \(Lần \$\{pendingProposal\.version\}\)/);
  });

  await t.test('8. Supervisor Portal Topics: openTopicRegistrationPreviewModal accepts targetVersion and supports getDoc fallback', () => {
    const source = read('js/supervisors/supervisor-portal-topics.js');
    // Function signature has targetVersion
    assert.match(source, /window\.openTopicRegistrationPreviewModal = function\(studentId = null, startInEditMode = false, targetVersion = null\)/);
    // Direct Firestore getDoc fallback
    assert.match(source, /doc\(db, 'graduationRounds', roundId, 'registrations', studentId\)/);
    assert.match(source, /getDoc\(regRef\)/);
    // Defaults viewingVersion to latestApproved.version when targetVersion is not provided
    assert.match(source, /const latestApproved = approvedVersions\.length > 0 \? approvedVersions\[approvedVersions\.length - 1\] : null;/);
    assert.match(source, /viewingVersion = Number\(latestApproved\.version\);/);
    // Renders version selector switcher dropdown
    assert.match(source, /topic-preview-version-dropdown/);
    assert.match(source, /openTopicRegistrationPreviewModal\('\$\{studentId\}', false, \$\{v\.version\}\)/);
  });

  await t.test('9. Rounds Loader: student hero banner displays official title and pending proposal notice', () => {
    const source = read('js/rounds/rounds-loader.js');
    assert.match(source, /getOfficialApprovedTopicTitle\(reg/);
    assert.match(source, /getTopicPendingProposal\(reg/);
    assert.match(source, /Đang đề xuất đổi tên đề tài/);
    assert.match(source, /Đang chờ GVHD phê duyệt/);
  });

  await t.test('10. Councils Workspace: official title enforced across getRoundAllStudents, search, table, and CSV export', () => {
    const source = read('js/grading/councils-workspace.js');
    // In getRoundAllStudents
    assert.match(source, /window\.getOfficialApprovedTopicTitle\(data, existing\.topicTitle \|\| ''\)/);
    // In filterStudentList
    assert.match(source, /window\.getOfficialApprovedTopicTitle\(s, s\.topicTitle \|\| ''\)/);
    // In exportCouncilStudentsCsv
    assert.match(source, /window\.getOfficialApprovedTopicTitle\(st, st\?\.topicTitle \|\| ''\)/);
  });

  await t.test('11. Assessment Portal: official title enforced in search, thesis, reviewer, prelim, and defense views', () => {
    const source = read('js/grading/assessment-portal.js');
    // Filter helper
    assert.match(source, /filterStudentList[\s\S]*?window\.getOfficialApprovedTopicTitle/);
    // Defense list
    assert.match(source, /renderAssessmentDefenseList[\s\S]*?window\.getOfficialApprovedTopicTitle/);
  });

  await t.test('12. Rubrics Workspace: getStudentFullProfile prioritizes getOfficialApprovedTopicTitle', () => {
    const source = read('js/grading/rubrics-workspace.js');
    assert.match(source, /getOfficialApprovedTopicTitle\(candidateSource, null\)/);
  });

  await t.test('13. Preliminary Dashboard: student map aggregation and table row rendering use getOfficialApprovedTopicTitle', () => {
    const source = read('js/grading/preliminary-dashboard.js');
    assert.match(source, /getOfficialApprovedTopicTitle\(r, r\.topicTitle \|\| ''\)/);
    assert.match(source, /getOfficialApprovedTopicTitle\(a, a\.topicTitle \|\| ''\)/);
    assert.match(source, /getOfficialApprovedTopicTitle\(s, s\.topicTitle \|\| ''\)/);
  });

  await t.test('14. Preliminary Entry: search and cards use getOfficialApprovedTopicTitle', () => {
    const source = read('js/grading/preliminary-entry.js');
    assert.match(source, /getOfficialApprovedTopicTitle\(s, s\.topicTitle \|\| ''\)/);
    assert.match(source, /getOfficialApprovedTopicTitle\(s, s\.topicTitle \|\| '--'\)/);
  });

  await t.test('15. Student Review Submissions: table and inspect modal use getOfficialApprovedTopicTitle', () => {
    const source = read('js/students/student-review-submissions.js');
    assert.match(source, /window\.getOfficialApprovedTopicTitle\(reg, ''\)/);
    assert.match(source, /inspect-sub-topic-title/);
  });

  await t.test('16. Student Eligibility Admin: official title resolved and pending proposal badge rendered', () => {
    const source = read('js/students/student-eligibility-admin.js');
    assert.match(source, /window\.getOfficialApprovedTopicTitle\(registration, ''\)/);
    assert.match(source, /getTopicPendingProposal\(registration \|\| published\)/);
    assert.match(source, /Chờ duyệt Lần/);
  });

  await t.test('17. Assignments Excel: export and search use getOfficialApprovedTopicTitle', () => {
    const source = read('js/supervisors/assignments-excel.js');
    assert.match(source, /window\.getOfficialApprovedTopicTitle\(row\.registration \|\| row\.effective, 'Chưa đăng ký đề tài'\)/);
    assert.match(source, /window\.getOfficialApprovedTopicTitle\(reg, reg\.topicTitle \|\| ''\)/);
  });

  await t.test('18. Assignments Admin: edit supervisor modal uses getOfficialApprovedTopicTitle', () => {
    const source = read('js/supervisors/assignments-admin.js');
    assert.match(source, /window\.getOfficialApprovedTopicTitle\(reg, reg\.topicTitle \|\| '--'\)/);
  });

  await t.test('19. Student Topic PDF: downloadOfficialTopicRegistrationPdf respects targetVersion and direct getDoc fallback', () => {
    const source = read('js/students/student-topic-pdf.js');
    assert.match(source, /downloadOfficialTopicRegistrationPdf = async function\([^)]*targetVersion/);
    assert.match(source, /getDoc\(doc\(db, 'graduationRounds', roundId, 'registrations', targetStudentId\)\)/);
  });

  await t.test('20. Complete Workflow State Transition Simulation', () => {
    // Step A: Student registers Version 1 -> pending
    let registration = {
      studentId: '11900335',
      topicTitle: 'Nghiên cứu thiết kế trung tâm trải nghiệm văn hóa',
      topicTitleVersion: 1,
      topicApprovalStatus: 'pending',
      topicTitleHistory: [
        {
          version: 1,
          topicTitle: 'Nghiên cứu thiết kế trung tâm trải nghiệm văn hóa',
          status: 'pending',
          createdAt: '2026-09-01T08:00:00Z'
        }
      ]
    };
    // No approved version yet
    assert.equal(getApprovedTopicVersions(registration).length, 0);
    assert.equal(getOfficialApprovedTopicTitle(registration), 'Nghiên cứu thiết kế trung tâm trải nghiệm văn hóa');

    // Step B: GVHD approves Version 1 -> official approved
    registration.topicApprovalStatus = 'approved';
    registration.topicReviewedAt = '2026-09-02T10:00:00Z';
    registration.topicReviewedBy = 'gvhd@tdtu.edu.vn';
    registration.topicTitleHistory[0].status = 'approved';
    registration.topicTitleHistory[0].reviewedAt = registration.topicReviewedAt;
    registration.topicTitleHistory[0].reviewedBy = registration.topicReviewedBy;

    assert.equal(getApprovedTopicVersions(registration).length, 1);
    assert.equal(getOfficialApprovedTopicTitle(registration), 'Nghiên cứu thiết kế trung tâm trải nghiệm văn hóa');
    assert.equal(getTopicPendingProposal(registration), null);

    // Step C: Student proposes Version 2 -> pending
    registration.topicTitle = 'Thiết kế không gian triển lãm nghệ thuật đương đại';
    registration.topicTitleVersion = 2;
    registration.topicApprovalStatus = 'pending';
    registration.topicTitleHistory.push({
      version: 2,
      topicTitle: 'Thiết kế không gian triển lãm nghệ thuật đương đại',
      status: 'pending',
      createdAt: '2026-09-10T14:00:00Z'
    });

    // CRITICAL HOTFIX VERIFICATION:
    // Official topic in Council, Assessment, Admin MUST REMAIN Version 1!
    assert.equal(
      getOfficialApprovedTopicTitle(registration),
      'Nghiên cứu thiết kế trung tâm trải nghiệm văn hóa',
      'Pending Version 2 must NOT replace approved Version 1'
    );
    // Proposal detector returns Version 2
    const pending = getTopicPendingProposal(registration);
    assert.ok(pending);
    assert.equal(pending.version, 2);
    assert.equal(pending.topicTitle, 'Thiết kế không gian triển lãm nghệ thuật đương đại');

    // Step D1: If GVHD rejects Version 2
    const rejectedClone = JSON.parse(JSON.stringify(registration));
    rejectedClone.topicApprovalStatus = 'rejected';
    rejectedClone.topicTitleHistory[1].status = 'rejected';
    rejectedClone.topicTitleHistory[1].note = 'Phạm vi đề tài quá rộng';
    assert.equal(
      getOfficialApprovedTopicTitle(rejectedClone),
      'Nghiên cứu thiết kế trung tâm trải nghiệm văn hóa',
      'Rejected Version 2 leaves Version 1 official'
    );

    // Step D2: If GVHD approves Version 2 -> Version 2 becomes official
    registration.topicApprovalStatus = 'approved';
    registration.topicReviewedAt = '2026-09-12T09:00:00Z';
    registration.topicTitleHistory[1].status = 'approved';
    registration.topicTitleHistory[1].reviewedAt = registration.topicReviewedAt;
    assert.equal(
      getOfficialApprovedTopicTitle(registration),
      'Thiết kế không gian triển lãm nghệ thuật đương đại',
      'Approved Version 2 becomes official'
    );
    // Version 1 is still preserved in history
    assert.equal(getApprovedTopicVersions(registration).length, 2);
    assert.equal(getApprovedTopicVersions(registration)[0].version, 1);
    assert.equal(getApprovedTopicVersions(registration)[1].version, 2);
  });
});
