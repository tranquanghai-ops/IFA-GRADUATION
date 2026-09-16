const http = require('http');
const assert = require('assert');

console.log('=== RUNNING FIRESTORE RULES EMULATOR TEST MATRIX (v2.3.3) ===');
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

// User personas
const adminUser = { email: 'tranquanghai@tdtu.edu.vn' };
const memberHD1 = { email: 'gv_mem1@tdtu.edu.vn' };
const memberHD1_B = { email: 'gv_mem1_b@tdtu.edu.vn' };
const chairHD1 = { email: 'gv_chair1@tdtu.edu.vn' };
const staffUnassigned = { email: 'gv_unassigned@tdtu.edu.vn' };
const chairHD2 = { email: 'gv_chair2@tdtu.edu.vn' };
const memberHD2 = { email: 'gv_mem2@tdtu.edu.vn' };
const supervisorUser = { email: 'gv_hd@tdtu.edu.vn' };
const reviewerUser = { email: 'gv_pb@tdtu.edu.vn' };
const studentA = { email: '12100314@student.tdtu.edu.vn' };
const studentB = { email: '12100999@student.tdtu.edu.vn' };
const studentIneligible = { email: '12100000@student.tdtu.edu.vn' };

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

  console.log('\n--- 0. SETUP AUTHORIZATION INDEXES BY ADMIN ---');
  // Setup round
  await check('Setup round document: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01', { title: 'Đợt 1 2026', status: 'open' }, adminUser)
  );

  // Setup eligible student
  await check('Setup eligible student 12100314: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/eligibleStudents/12100314', { eligible: true }, adminUser)
  );

  // Setup council memberships
  // HĐ1: Chair, Member A, Member B
  await check('Setup HĐ1 chair membership: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilMemberships/act_def_hd1_gv_chair1@tdtu.edu.vn', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', memberEmail: 'gv_chair1@tdtu.edu.vn', role: 'chair', active: true
    }, adminUser)
  );
  await check('Setup HĐ1 member A membership: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilMemberships/act_def_hd1_gv_mem1@tdtu.edu.vn', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', memberEmail: 'gv_mem1@tdtu.edu.vn', role: 'member', active: true
    }, adminUser)
  );
  await check('Setup HĐ1 member B membership: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilMemberships/act_def_hd1_gv_mem1_b@tdtu.edu.vn', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', memberEmail: 'gv_mem1_b@tdtu.edu.vn', role: 'member', active: true
    }, adminUser)
  );
  // HĐ2: Chair 2, Member 2
  await check('Setup HĐ2 chair membership: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilMemberships/act_def_hd2_gv_chair2@tdtu.edu.vn', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd2', memberEmail: 'gv_chair2@tdtu.edu.vn', role: 'chair', active: true
    }, adminUser)
  );
  await check('Setup HĐ2 member membership: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilMemberships/act_def_hd2_gv_mem2@tdtu.edu.vn', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd2', memberEmail: 'gv_mem2@tdtu.edu.vn', role: 'member', active: true
    }, adminUser)
  );

  // Student Council Assignments: Student A in HĐ1, Student B in HĐ2
  await check('Setup Student A in HĐ1: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilStudentAssignments/act_def_12100314', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100314', active: true
    }, adminUser)
  );
  await check('Setup Student A in HĐ1 for act_sub_open: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilStudentAssignments/act_sub_open_12100314', {
      roundId: 'round_01', activityId: 'act_sub_open', councilId: 'hd1', studentId: '12100314', active: true
    }, adminUser)
  );
  await check('Setup HĐ1 member A membership for act_sub_open: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilMemberships/act_sub_open_hd1_gv_mem1@tdtu.edu.vn', {
      roundId: 'round_01', activityId: 'act_sub_open', councilId: 'hd1', memberEmail: 'gv_mem1@tdtu.edu.vn', role: 'member', active: true
    }, adminUser)
  );
  await check('Setup Student B in HĐ2: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilStudentAssignments/act_def_12100999', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd2', studentId: '12100999', active: true
    }, adminUser)
  );

  // Council Access / Status: HĐ1 active initially, HĐ2 active
  await check('Setup HĐ1 status active: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilAccess/act_def_hd1', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', status: 'active'
    }, adminUser)
  );
  await check('Setup HĐ2 status ended: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilAccess/act_def_hd2', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd2', status: 'ended'
    }, adminUser)
  );

  // Supervisor & Reviewer Assignments for Student A
  await check('Setup Supervisor Assignment for Student A: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/supervisorAssignments/12100314', {
      studentId: '12100314', supervisorEmails: ['gv_hd@tdtu.edu.vn']
    }, adminUser)
  );
  await check('Setup Reviewer Assignment for Student A: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/reviewerAssignmentsAuth/12100314', {
      studentId: '12100314', reviewerEmail: 'gv_pb@tdtu.edu.vn', active: true
    }, adminUser)
  );

  // Activity Access: act_sub_open has submission enabled & file view true
  await check('Setup Activity Access act_sub_open: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/activityAccess/act_sub_open', {
      activityId: 'act_sub_open', submissionEnabled: true, supervisorCanView: true, reviewerCanView: true, councilCanView: true
    }, adminUser)
  );
  // act_sub_hidden has file view false
  await check('Setup Activity Access act_sub_hidden: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/activityAccess/act_sub_hidden', {
      activityId: 'act_sub_hidden', submissionEnabled: true, supervisorCanView: false, reviewerCanView: false, councilCanView: false
    }, adminUser)
  );
  // act_sub_closed has submission disabled
  await check('Setup Activity Access act_sub_closed: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/activityAccess/act_sub_closed', {
      activityId: 'act_sub_closed', submissionEnabled: false
    }, adminUser)
  );

  // 1. CRITICAL MISSING CASE (Section 32)
  console.log('\n--- 1. CRITICAL MISSING CASE ---');
  await check('Staff unassigned to HĐ2 tries to create score in HĐ2: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/act_def_hd2_12100999_gv_unassigned', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd2', studentId: '12100999',
      scorerId: 'gv_unassigned', scorerEmail: 'gv_unassigned@tdtu.edu.vn',
      scoreId: 'act_def_hd2_12100999_gv_unassigned', score: 8.0
    }, staffUnassigned)
  );

  // 2. COUNCIL MEMBER TESTS (Section 33)
  console.log('\n--- 2. COUNCIL MEMBER ENFORCEMENT TESTS ---');
  const scoreHD1_Mem1 = 'act_def_hd1_12100314_gv_mem1';
  await check('Member HĐ1 creates score for SV in HĐ1: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100314',
      scorerId: 'gv_mem1', scorerEmail: 'gv_mem1@tdtu.edu.vn',
      scoreId: scoreHD1_Mem1, score: 8.5
    }, memberHD1)
  );

  await check('Member HĐ1 creates score for SV in HĐ2 (Cross-Council): DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/act_def_hd1_12100999_gv_mem1', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100999',
      scorerId: 'gv_mem1', scorerEmail: 'gv_mem1@tdtu.edu.vn',
      scoreId: 'act_def_hd1_12100999_gv_mem1', score: 8.5
    }, memberHD1)
  );

  await check('Member HĐ1 reads own score: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, null, memberHD1)
  );

  await check('Member HĐ1 reads Member B score (No Staff Wildcard): DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, null, memberHD1_B)
  );

  await check('Member HĐ1 updates own score while status is active: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100314',
      scorerId: 'gv_mem1', scorerEmail: 'gv_mem1@tdtu.edu.vn',
      scoreId: scoreHD1_Mem1, score: 9.0
    }, memberHD1)
  );

  // 3. CHAIR TESTS (Section 34)
  console.log('\n--- 3. CHAIR TESTS (BEFORE/AFTER ENDED & CROSS-COUNCIL) ---');
  // Before ended: Chair HĐ1 reads own score -> ALLOW, reads Member score -> DENY, calibrate -> DENY
  const chairScoreId = 'act_def_hd1_12100314_gv_chair1';
  await check('Chair HĐ1 creates own score: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + chairScoreId, {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100314',
      scorerId: 'gv_chair1', scorerEmail: 'gv_chair1@tdtu.edu.vn',
      scoreId: chairScoreId, score: 9.0
    }, chairHD1)
  );

  await check('Chair HĐ1 reads own score before ended: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + chairScoreId, null, chairHD1)
  );

  await check('Chair HĐ1 reads other member score before ended: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, null, chairHD1)
  );

  await check('Chair HĐ1 tries to calibrate score before ended: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100314',
      scorerId: 'gv_mem1', scorerEmail: 'gv_mem1@tdtu.edu.vn',
      scoreId: scoreHD1_Mem1, score: 7.0
    }, chairHD1)
  );

  // Transition HĐ1 to ended!
  await check('Admin transitions HĐ1 to ended: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilAccess/act_def_hd1', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', status: 'ended'
    }, adminUser)
  );

  // After ended:
  await check('Chair HĐ1 reads other member score in HĐ1 after ended: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, null, chairHD1)
  );

  // Setup score in HĐ2 by member HD2
  const scoreHD2 = 'act_def_hd2_12100999_gv_mem2';
  await check('Member HĐ2 creates score in HĐ2: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + scoreHD2, {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd2', studentId: '12100999',
      scorerId: 'gv_mem2', scorerEmail: 'gv_mem2@tdtu.edu.vn',
      scoreId: scoreHD2, score: 8.0
    }, memberHD2)
  );

  await check('Chair HĐ1 tries to read score in HĐ2 after ended (Cross-Council): DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/councilScores/' + scoreHD2, null, chairHD1)
  );

  await check('Chair HĐ1 calibrates score in HĐ1 after ended: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100314',
      scorerId: 'gv_mem1', scorerEmail: 'gv_mem1@tdtu.edu.vn',
      scoreId: scoreHD1_Mem1, score: 8.0
    }, chairHD1)
  );

  await check('Chair HĐ1 tries to calibrate score in HĐ2 (Cross-Council): DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + scoreHD2, {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd2', studentId: '12100999',
      scorerId: 'gv_mem2', scorerEmail: 'gv_mem2@tdtu.edu.vn',
      scoreId: scoreHD2, score: 7.0
    }, chairHD1)
  );

  // Transition HĐ1 to finalized
  await check('Admin transitions HĐ1 to finalized: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilAccess/act_def_hd1', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', status: 'finalized'
    }, adminUser)
  );

  await check('Chair HĐ1 tries to calibrate after finalized: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100314',
      scorerId: 'gv_mem1', scorerEmail: 'gv_mem1@tdtu.edu.vn',
      scoreId: scoreHD1_Mem1, score: 8.5
    }, chairHD1)
  );

  // Admin reopens HĐ1 to ended
  await check('Admin reopens HĐ1 to ended: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilAccess/act_def_hd1', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', status: 'ended'
    }, adminUser)
  );

  await check('Chair HĐ1 calibrates after Admin reopen to ended: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/' + scoreHD1_Mem1, {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100314',
      scorerId: 'gv_mem1', scorerEmail: 'gv_mem1@tdtu.edu.vn',
      scoreId: scoreHD1_Mem1, score: 8.5
    }, chairHD1)
  );

  // 4. SUBMISSION ACCESS & VISIBILITY TESTS (Section 35)
  console.log('\n--- 4. SUBMISSION ACCESS & VISIBILITY TESTS ---');
  const subDocId = 'sub_act_sub_open_12100314_att1';
  await check('Eligible Student A creates submission in open activity: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/submissions/' + subDocId, {
      roundId: 'round_01', activityId: 'act_sub_open', studentId: '12100314',
      submissionId: subDocId, submittedBy: '12100314@student.tdtu.edu.vn',
      status: 'submitted', files: ['thesis.pdf'], attemptNumber: 1
    }, studentA)
  );

  await check('Ineligible student tries to create submission: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/submissions/sub_bad', {
      roundId: 'round_01', activityId: 'act_sub_open', studentId: '12100000',
      submissionId: 'sub_bad', submittedBy: '12100000@student.tdtu.edu.vn',
      status: 'submitted', files: ['bad.pdf'], attemptNumber: 1
    }, studentIneligible)
  );

  await check('Student creates submission in closed activity: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/submissions/sub_closed', {
      roundId: 'round_01', activityId: 'act_sub_closed', studentId: '12100314',
      submissionId: 'sub_closed', submittedBy: '12100314@student.tdtu.edu.vn',
      status: 'submitted', files: ['closed.pdf'], attemptNumber: 1
    }, studentA)
  );

  await check('Student A reads own submission: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subDocId, null, studentA)
  );

  await check('Student B reads Student A submission: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subDocId, null, studentB)
  );

  await check('Official Supervisor reads supervisee submission when visibility ON: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subDocId, null, supervisorUser)
  );

  await check('Assigned Reviewer reads assigned submission when visibility ON: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subDocId, null, reviewerUser)
  );

  await check('Council Member HĐ1 reads Student A (in HĐ1) when visibility ON: ALLOW', 'ALLOW', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subDocId, null, memberHD1)
  );

  await check('Unrelated staff reads Student A submission: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subDocId, null, staffUnassigned)
  );

  // Setup hidden submission
  const subHiddenId = 'sub_act_sub_hidden_12100314_att1';
  await check('Student A creates submission in hidden-visibility activity: ALLOW', 'ALLOW', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/submissions/' + subHiddenId, {
      roundId: 'round_01', activityId: 'act_sub_hidden', studentId: '12100314',
      submissionId: subHiddenId, submittedBy: '12100314@student.tdtu.edu.vn',
      status: 'submitted', files: ['hidden.pdf'], attemptNumber: 1
    }, studentA)
  );

  await check('Supervisor reads submission when visibility is OFF: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subHiddenId, null, supervisorUser)
  );

  await check('Reviewer reads submission when visibility is OFF: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subHiddenId, null, reviewerUser)
  );

  await check('Council member reads submission when visibility is OFF: DENY', 'DENY', () =>
    makeRequest('GET', 'graduationRounds/round_01/submissions/' + subHiddenId, null, memberHD1)
  );

  // 5. AUTH INDEX WRITE PERMISSIONS (Section 36)
  console.log('\n--- 5. AUTH INDEX WRITE PERMISSIONS ---');
  await check('Staff tries to write councilMemberships: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilMemberships/act_def_hd1_hacker@tdtu.edu.vn', {
      memberEmail: 'hacker@tdtu.edu.vn'
    }, memberHD1)
  );
  await check('Student tries to write supervisorAssignments: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/supervisorAssignments/12100314', {
      supervisorEmails: ['fake_gv@tdtu.edu.vn']
    }, studentA)
  );
  await check('Staff tries to write activityAccess: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/activityAccess/act_sub_open', {
      submissionEnabled: false
    }, memberHD1)
  );

  // 6. MALICIOUS IDENTITY TAMPER TESTS (Section 37)
  console.log('\n--- 6. MALICIOUS IDENTITY TAMPER TESTS ---');
  await check('Member tries to spoof scorerEmail: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/act_def_hd1_12100314_gv_mem1', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100314',
      scorerId: 'gv_mem1', scorerEmail: 'other_gv@tdtu.edu.vn',
      scoreId: 'act_def_hd1_12100314_gv_mem1', score: 9.0
    }, memberHD1)
  );

  await check('Member tries to change studentId: DENY', 'DENY', () =>
    makeRequest('PATCH', 'graduationRounds/round_01/councilScores/act_def_hd1_12100314_gv_mem1', {
      roundId: 'round_01', activityId: 'act_def', councilId: 'hd1', studentId: '12100999',
      scorerId: 'gv_mem1', scorerEmail: 'gv_mem1@tdtu.edu.vn',
      scoreId: 'act_def_hd1_12100314_gv_mem1', score: 9.0
    }, memberHD1)
  );

  console.log('\n=== SUMMARY: ' + passed + ' PASSED, ' + failed + ' FAILED ===\n');
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
