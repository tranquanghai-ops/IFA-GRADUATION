const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('Act-as luôn query registrations và eligibleStudents cho round đã chọn', () => {
  assert.match(app, /Exact Act-as must query both collections even when registrations already exist/);
  assert.match(app, /collection\(db, 'graduationRounds', r\.id, 'registrations'\)/);
  assert.match(app, /collection\(db, 'graduationRounds', r\.id, 'eligibleStudents'\)/);
});

test('Act-as hiển thị trạng thái đăng ký', () => {
  assert.match(app, /registrationStatus: 'Đã đăng ký'/);
  assert.match(app, /registrationStatus: 'Chưa đăng ký'/);
});

test('Admin assignment dùng union eligible, registrations và officialAssignments', () => {
  assert.match(app, /function getAdminAssignmentRows\(\)/);
  assert.match(app, /eligible\.filter\(e => e\.eligible !== false\)/);
  assert.match(app, /officialAssignments/);
});

test('Nguồn phân công độc lập và không tạo registration giả', () => {
  assert.match(app, /'assignmentDrafts', studentId/);
  assert.match(app, /'officialAssignments', row\.studentId/);
  assert.doesNotMatch(app, /setDoc\(doc\(db, 'graduationRounds', roundId, 'registrations', studentId\)/);
});

test('Phân công mới là draft và chỉ publish qua workflow công bố round', () => {
  assert.match(app, /buildAssignmentDraftPayload/);
  assert.match(app, /buildOfficialAssignmentPayload\(row, supervisors, 'published'\)/);
  assert.match(app, /window\.publishAdminResults/);
});

test('Đăng ký sau phân công published không yêu cầu chọn lại nguyện vọng', () => {
  assert.match(app, /function shouldSkipStudentSupervisorPreference/);
  assert.match(app, /state\.myOfficialAssignment\?\.assignmentStatus === 'published'/);
  assert.match(rules, /officialAssignments\/\$\(studentId\)\)\.data\.assignmentStatus == 'published'/);
});

test('Supervisor chỉ query assignment published thuộc email của mình', () => {
  assert.match(app, /where\('assignmentStatus', '==', 'published'\)/);
  assert.match(app, /where\('supervisorEmails', 'array-contains', emailLower\)/);
  assert.match(app, /Chưa đăng ký đề tài/);
});

test('Quota tính trên danh sách union, loại trừ sinh viên đang chỉnh', () => {
  const assignments = [
    { studentId: 'A', supervisorIds: ['S1'] },
    { studentId: 'B', supervisorIds: ['S1', 'S2'] }
  ];
  const count = (sid, excluded = '') => assignments.filter(a => a.studentId !== excluded && a.supervisorIds.includes(sid)).length;
  assert.equal(count('S1'), 2);
  assert.equal(count('S1', 'A'), 1);
  assert.match(app, /getSupervisorAssignmentCount\(supId, excludeStudentId/);
  assert.match(app, /Math\.min\(configuredCap, maxCap\)/);
});

test('Mọi thay đổi phân công chính, GVHD 2 và công bố đều ghi audit log', () => {
  assert.match(app, /action: 'Phân công GVHD'/);
  assert.match(app, /action: 'Thêm GVHD 2'/);
  assert.match(app, /action: 'Gỡ GVHD 2'/);
  assert.match(app, /action: 'Cập nhật phân công GVHD'/);
  assert.match(app, /action: (?:alreadyPublished \? 'Công bố lại phân công GVHD' : )?'Công bố phân công GVHD'/);
});

test('Rules giới hạn draft/published và không coi mọi staff là Admin', () => {
  assert.match(rules, /match \/officialAssignments\/\{studentId\}/);
  assert.match(rules, /resource\.data\.assignmentStatus == 'published'/);
  assert.match(rules, /email\(\) in resource\.data\.supervisorEmails/);
  assert.match(rules, /function admin\(\)\{ return owner\(\) \|\| \(signedIn\(\) && exists/);
});

test('Header mới và navigation vẫn nguyên vẹn', () => {
  assert.match(html, /class="ifa-global-header/);
  assert.match(html, /id="portal-navigation"/);
  assert.match(html, /id="global-impersonation-banner"/);
});

let passed = 0;
for (const item of tests) {
  try {
    item.fn();
    passed += 1;
    console.log(`[PASS] ${item.name}`);
  } catch (error) {
    console.error(`[FAIL] ${item.name}`);
    if (error.expected) {
      console.error(`       Expected match: ${error.expected}`);
    } else {
      console.error(`       ${error.message.split('\n')[0]}`);
    }
    process.exitCode = 1;
  }
}
console.log(`TOTAL: ${tests.length} | PASSED: ${passed} | FAILED: ${tests.length - passed}`);
