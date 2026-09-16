const http = require('http');
const assert = require('assert');

console.log('=== RUNNING FIRESTORE RULES EMULATOR TEST MATRIX (v2.3.2) ===');
console.log('Host:', process.env.FIRESTORE_EMULATOR_HOST);

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

function createMockJwt(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    user_id: user.uid || user.email,
    sub: user.uid || user.email,
    email: user.email,
    email_verified: true
  })).toString('base64url');
  return header + '.' + payload + '.';
}

function makeRequest(method, docPath, data, user, queryParams = '') {
  return new Promise((resolve, reject) => {
    const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const [hostname, port] = host.split(':');
    let url = '/v1/projects/demo-no-project/databases/(default)/documents/' + docPath + (queryParams ? '?' + queryParams : '');

    let postData = '';
    const headers = {
      'Content-Type': 'application/json'
    };

    if (user) {
      headers['Authorization'] = 'Bearer ' + createMockJwt(user);
    }

    if (data) {
      postData = JSON.stringify(toFirestoreFields(data));
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname,
      port: Number(port) || 8080,
      path: url,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const adminUser = { email: 'tranquanghai@tdtu.edu.vn' };
const scorerUser = { email: 'gv_scorer@tdtu.edu.vn' };
const otherStaffUser = { email: 'gv_other@tdtu.edu.vn' };
const studentA = { email: '12100314@student.tdtu.edu.vn' };
const studentB = { email: '12100999@student.tdtu.edu.vn' };

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function check(name, expectedStatus, reqFn) {
    try {
      const res = await reqFn();
      if (expectedStatus === 'ALLOW') {
        assert(res.status >= 200 && res.status < 300, 'Expected ALLOW (2xx), got ' + res.status + ': ' + res.body);
      } else if (expectedStatus === 'DENY') {
        assert(res.status === 403, 'Expected DENY (403), got ' + res.status + ': ' + res.body);
      }
      console.log('  ✓ PASS: ' + name);
      passed++;
    } catch (err) {
      console.error('  ✗ FAIL: ' + name);
      console.error(err.message);
      failed++;
    }
  }

  // 1. ADMIN TESTS
  console.log('\n--- 1. ADMIN TESTS ---');
  await check('Admin creates round document: ALLOW', 'ALLOW', () => 
    makeRequest('PATCH', 'graduationRounds/round_01', {
      title: 'Đợt 1 - 2026',
      status: 'open',
      createdAt: new Date().toISOString()
    }, adminUser)
  );

  await check('Admin creates councilScore: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/act1_c1_st1_admin', {
      roundId: 'round_01',
      activityId: 'act1',
      councilId: 'c1',
      studentId: 'st1',
      scorerId: 'admin',
      scorerEmail: 'tranquanghai@tdtu.edu.vn',
      scoreId: 'act1_c1_st1_admin',
      score: 9.5
    }, adminUser)
  );

  await check('Admin reads all councilScores: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/act1_c1_st1_admin', null, adminUser)
  );

  await check('Admin creates submission: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/submissions/sub_admin_01', {
      roundId: 'round_01',
      activityId: 'act1',
      studentId: '12100314',
      submissionId: 'sub_admin_01',
      submittedBy: 'tranquanghai@tdtu.edu.vn',
      status: 'submitted',
      files: ['report.pdf'],
      attemptNumber: 1
    }, adminUser)
  );

  await check('Admin reads all submissions: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/sub_admin_01', null, adminUser)
  );

  await check('Admin appends audit log: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/auditLogs/log_admin_01', {
      roundId: 'round_01',
      action: 'Cấu hình đợt',
      by: 'tranquanghai@tdtu.edu.vn'
    }, adminUser)
  );

  // 2. COUNCIL MEMBER TESTS
  console.log('\n--- 2. COUNCIL MEMBER TESTS ---');
  const validScoreDocId = 'act1_c1_st1_gv_scorer';
  await check('Member creates own score: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + validScoreDocId, {
      roundId: 'round_01',
      activityId: 'act1',
      councilId: 'c1',
      studentId: 'st1',
      scorerId: 'gv_scorer',
      scorerEmail: 'gv_scorer@tdtu.edu.vn',
      scoreId: validScoreDocId,
      score: 8.5
    }, scorerUser)
  );

  await check('Member creates score with spoofed scorerEmail: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/act1_c1_st1_spoofed', {
      roundId: 'round_01',
      activityId: 'act1',
      councilId: 'c1',
      studentId: 'st1',
      scorerId: 'spoofed',
      scorerEmail: 'someone_else@tdtu.edu.vn',
      scoreId: 'act1_c1_st1_spoofed',
      score: 8.5
    }, scorerUser)
  );

  await check('Member reads own score: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + validScoreDocId, null, scorerUser)
  );

  await check('Other staff reads member score (No Staff Wildcard): DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + validScoreDocId, null, otherStaffUser)
  );

  await check('Student reads internal council score: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + validScoreDocId, null, studentA)
  );

  await check('Member updates own score preserving identity: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + validScoreDocId, {
      roundId: 'round_01',
      activityId: 'act1',
      councilId: 'c1',
      studentId: 'st1',
      scorerId: 'gv_scorer',
      scorerEmail: 'gv_scorer@tdtu.edu.vn',
      scoreId: validScoreDocId,
      score: 9.0
    }, scorerUser)
  );

  await check('Delete council score: DENY', 'DENY', () =>
    makeRequest('DELETE', 'graduationRounds/round_01/councilScores/' + validScoreDocId, null, scorerUser)
  );

  // 3. CHAIR / CALIBRATION TESTS
  console.log('\n--- 3. CHAIR & CALIBRATION TESTS ---');
  await check('Chair tries to read member score before ended (Staff Wildcard blocked): DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + validScoreDocId, null, { email: 'gv_chair@tdtu.edu.vn' })
  );

  await check('Chair tries to calibrate/update other member score directly without Admin: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + validScoreDocId, {
      roundId: 'round_01',
      activityId: 'act1',
      councilId: 'c1',
      studentId: 'st1',
      scorerId: 'gv_scorer',
      scorerEmail: 'gv_scorer@tdtu.edu.vn',
      scoreId: validScoreDocId,
      score: 7.5
    }, { email: 'gv_chair@tdtu.edu.vn' })
  );

  // 4. STUDENT SUBMISSION TESTS
  console.log('\n--- 4. STUDENT SUBMISSION TESTS ---');
  const subDocId = 'sub_act1_12100314_att1';
  await check('Student A creates own submission: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/submissions/' + subDocId, {
      roundId: 'round_01',
      activityId: 'act1',
      studentId: '12100314',
      submissionId: subDocId,
      submittedBy: '12100314@student.tdtu.edu.vn',
      status: 'submitted',
      files: ['thesis.pdf'],
      attemptNumber: 1
    }, studentA)
  );

  await check('Student A creates submission for Student B: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/submissions/sub_act1_12100999_att1', {
      roundId: 'round_01',
      activityId: 'act1',
      studentId: '12100999',
      submissionId: 'sub_act1_12100999_att1',
      submittedBy: '12100314@student.tdtu.edu.vn',
      status: 'submitted',
      files: ['thesis.pdf'],
      attemptNumber: 1
    }, studentA)
  );

  await check('Student A reads own submission: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subDocId, null, studentA)
  );

  await check('Student B reads Student A submission: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subDocId, null, studentB)
  );

  await check('Staff wildcard reads student submission: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subDocId, null, otherStaffUser)
  );

  await check('Student A attempts to delete submission: DENY', 'DENY', () =>
    makeRequest('DELETE', 'graduationRounds/round_01/submissions/' + subDocId, null, studentA)
  );

  // 5. AUDIT TESTS
  console.log('\n--- 5. AUDIT LOG TESTS ---');
  await check('Anonymous creates audit: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/auditLogs/log_anon', {
      roundId: 'round_01',
      action: 'Nộp bài',
      by: 'anonymous'
    }, null)
  );

  await check('Student attempts arbitrary admin action: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/auditLogs/log_bad_student', {
      roundId: 'round_01',
      action: 'Xóa đợt tốt nghiệp',
      by: '12100314@student.tdtu.edu.vn'
    }, studentA)
  );

  await check('Student creates valid submission audit: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/auditLogs/log_valid_student', {
      roundId: 'round_01',
      action: 'Nộp bài',
      by: '12100314@student.tdtu.edu.vn'
    }, studentA)
  );

  await check('Staff attempts arbitrary admin action: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/auditLogs/log_bad_staff', {
      roundId: 'round_01',
      action: 'Thay đổi cấu hình hệ thống',
      by: 'gv_scorer@tdtu.edu.vn'
    }, scorerUser)
  );

  await check('Staff creates valid scoring audit: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/auditLogs/log_valid_staff', {
      roundId: 'round_01',
      action: 'Chấm điểm',
      by: 'gv_scorer@tdtu.edu.vn'
    }, scorerUser)
  );

  await check('Delete audit log: DENY', 'DENY', () =>
    makeRequest('DELETE', 'graduationRounds/round_01/auditLogs/log_valid_staff', null, adminUser)
  );

  await check('Student reads audit log: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/auditLogs/log_valid_staff', null, studentA)
  );

  await check('Staff reads audit log: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/auditLogs/log_valid_staff', null, scorerUser)
  );

  // 6. MALICIOUS IDENTITY TAMPER TESTS
  console.log('\n--- 6. MALICIOUS IDENTITY TAMPER TESTS ---');
  await check('Malicious change scorerEmail in score update: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + validScoreDocId, {
      roundId: 'round_01',
      activityId: 'act1',
      councilId: 'c1',
      studentId: 'st1',
      scorerId: 'gv_scorer',
      scorerEmail: 'hacked@tdtu.edu.vn',
      scoreId: validScoreDocId,
      score: 10.0
    }, scorerUser)
  );

  await check('Malicious change studentId in score update: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + validScoreDocId, {
      roundId: 'round_01',
      activityId: 'act1',
      councilId: 'c1',
      studentId: 'st_victim',
      scorerId: 'gv_scorer',
      scorerEmail: 'gv_scorer@tdtu.edu.vn',
      scoreId: validScoreDocId,
      score: 10.0
    }, scorerUser)
  );

  await check('Malicious change councilId in score update: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + validScoreDocId, {
      roundId: 'round_01',
      activityId: 'act1',
      councilId: 'c999',
      studentId: 'st1',
      scorerId: 'gv_scorer',
      scorerEmail: 'gv_scorer@tdtu.edu.vn',
      scoreId: validScoreDocId,
      score: 10.0
    }, scorerUser)
  );

  console.log('\n=== SUMMARY: ' + passed + ' PASSED, ' + failed + ' FAILED ===\n');
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
