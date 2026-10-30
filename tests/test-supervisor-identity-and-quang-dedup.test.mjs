import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// Setup minimal Window & Global environment
globalThis.window = globalThis;
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.state = {
  supervisorsMaster: [],
  roundSupervisors: [],
  adminReviewData: { supervisors: [] }
};

// Load resolver and deduplication functions from js/core.js
const rawCore = fs.readFileSync(path.join(root, 'js', 'core.js'), 'utf8');
const startIdx = rawCore.indexOf('export const KNOWN_SUPERVISOR_EMAIL_ALIASES');
const endIdx = rawCore.indexOf('window.toggleRoundOpenImmediately = function');
if (startIdx === -1 || endIdx === -1) {
  throw new Error(`Failed to locate resolver block in js/core.js (start: ${startIdx}, end: ${endIdx})`);
}
const resolverBlock = rawCore.slice(startIdx, endIdx).replace(/export\s+/g, '');
vm.runInThisContext(resolverBlock);

test('=== SUITE 1: THẦY NGUYỄN TĂNG QUANG DEDUPLICATION & QUOTA UNIFICATION ===', async (t) => {
  const QUANG_CANONICAL_ID = 'VMiij78ssdGs9sPd6WTG';
  const QUANG_TDTU_EMAIL = 'nguyentangquang@tdtu.edu.vn';
  const QUANG_EXTERNAL_EMAIL = 'tquangarc@gmail.com';
  const QUANG_PHOTO = 'https://firebasestorage.googleapis.com/v0/b/ifa-activities.firebasestorage.app/o/graduation%2Fsupervisors%2Ftquangarc_gmail.com%2Fportrait.webp?alt=media&token=ca594bc1';

  await t.test('1.1: filterAndDeduplicateMasterSupervisors unifies dual-record (chỉ tiêu 10 vs 5) into single profile for Thầy Quang', () => {
    const rawDocs = [
      {
        id: QUANG_CANONICAL_ID,
        supervisorId: QUANG_CANONICAL_ID,
        name: 'ThS. Nguyễn Tăng Quang',
        email: QUANG_TDTU_EMAIL,
        photoUrl: QUANG_PHOTO,
        dept: 'Bộ môn TKNT',
        defaultQuota: 10 // Stale/fallback internal quota
      },
      {
        id: QUANG_EXTERNAL_EMAIL,
        supervisorId: QUANG_CANONICAL_ID,
        isAuthIndex: true,
        name: 'ThS. KTS Nguyễn Tăng Quang',
        email: QUANG_EXTERNAL_EMAIL,
        employmentType: 'adjunct',
        defaultQuota: 5
      }
    ];

    const clean = filterAndDeduplicateMasterSupervisors(rawDocs);
    assert.equal(clean.length, 1, 'Must have exactly 1 record for Thầy Nguyễn Tăng Quang in Master');
    assert.equal(clean[0].id, QUANG_CANONICAL_ID, 'Must retain canonical master ID');
    assert.equal(clean[0].defaultQuota, 5, 'Quota must be unified to 5 (adjunct visiting quota)');
    assert.equal(clean[0].employmentType, 'adjunct', 'Must reflect adjunct employment type');
    assert.equal(clean[0].personalEmail, QUANG_EXTERNAL_EMAIL, 'Must retain personal login email');
  });

  await t.test('1.2: filterRoundSupervisorsList eliminates duplicate round entry (chỉ tiêu 10 vs 5) for Thầy Quang', () => {
    const roundRaw = [
      {
        id: QUANG_CANONICAL_ID,
        supervisorId: QUANG_CANONICAL_ID,
        name: 'ThS. Nguyễn Tăng Quang',
        email: QUANG_TDTU_EMAIL,
        capacity: 10, // Stale 10 quota
        activeInRound: true
      },
      {
        id: QUANG_EXTERNAL_EMAIL,
        supervisorId: QUANG_CANONICAL_ID,
        isAuthIndex: true,
        name: 'ThS. KTS Nguyễn Tăng Quang',
        email: QUANG_EXTERNAL_EMAIL,
        capacity: 5, // Correct 5 quota
        activeInRound: true
      }
    ];

    const cleanRound = filterRoundSupervisorsList(roundRaw);
    assert.equal(cleanRound.length, 1, 'Round roster must have exactly 1 row for Thầy Quang');
    assert.equal(cleanRound[0].id, QUANG_CANONICAL_ID, 'Must retain canonical ID');
    assert.equal(cleanRound[0].capacity, 5, 'Round capacity must be unified to 5, eliminating duplicate 10');
  });

  await t.test('1.3: Round deduplication succeeds even when auth-index supervisorId is missing, using email aliases', () => {
    state.supervisorsMaster = [
      {
        id: QUANG_CANONICAL_ID,
        name: 'ThS. KTS. Nguyễn Tăng Quang',
        email: QUANG_TDTU_EMAIL,
        personalEmail: QUANG_EXTERNAL_EMAIL,
        employmentType: 'adjunct',
        defaultQuota: 5
      }
    ];

    const roundRaw = [
      {
        id: QUANG_CANONICAL_ID,
        name: 'ThS. Nguyễn Tăng Quang',
        email: QUANG_TDTU_EMAIL,
        capacity: 10
      },
      {
        id: QUANG_EXTERNAL_EMAIL,
        // supervisorId is omitted/undefined in legacy index doc
        email: QUANG_EXTERNAL_EMAIL,
        capacity: 5
      }
    ];

    const cleanRound = filterRoundSupervisorsList(roundRaw);
    assert.equal(cleanRound.length, 1, 'Must merge via Master email aliases to single record');
    assert.equal(cleanRound[0].id, QUANG_CANONICAL_ID);
    assert.equal(cleanRound[0].capacity, 5);
  });

  await t.test('1.4: getSupervisorMasterRecord resolves Thầy Quang by either TDTU email or Gmail login', () => {
    state.supervisorsMaster = [
      {
        id: QUANG_CANONICAL_ID,
        name: 'ThS. KTS. Nguyễn Tăng Quang',
        email: QUANG_TDTU_EMAIL,
        personalEmail: QUANG_EXTERNAL_EMAIL,
        employmentType: 'adjunct',
        defaultQuota: 5
      }
    ];

    const byTdtu = getSupervisorMasterRecord(QUANG_TDTU_EMAIL);
    assert.ok(byTdtu);
    assert.equal(byTdtu.id, QUANG_CANONICAL_ID);

    const byGmail = getSupervisorMasterRecord(QUANG_EXTERNAL_EMAIL);
    assert.ok(byGmail);
    assert.equal(byGmail.id, QUANG_CANONICAL_ID);

    const byRefObj = getSupervisorMasterRecord({ supervisorEmail: QUANG_EXTERNAL_EMAIL });
    assert.ok(byRefObj);
    assert.equal(byRefObj.id, QUANG_CANONICAL_ID);
  });
});

test('=== SUITE 2: ABSOLUTE INDEPENDENCE & PRESERVATION OF TS. KTS NGUYỄN MINH HIẾU VS THS. NGUYỄN MINH HIẾU ===', async (t) => {
  const HIEU_THAY_ID = 'oWS52UHJbLDk2rkzQyPR';
  const HIEU_THAY_EMAIL = 'nguyenminhhieu@tdtu.edu.vn';
  const HIEU_CO_ID = 'rsyOJ7pZB6joEwZrBp3d';
  const HIEU_CO_EMAIL = 'nguyenminhhieu.nt@tdtu.edu.vn';

  const rawMaster = [
    {
      id: HIEU_THAY_ID,
      supervisorId: HIEU_THAY_ID,
      name: 'TS. KTS Nguyễn Minh Hiếu',
      gender: 'Nam',
      email: HIEU_THAY_EMAIL,
      department: 'Khoa Kiến trúc',
      defaultQuota: 10,
      active: true
    },
    {
      id: HIEU_CO_ID,
      supervisorId: HIEU_CO_ID,
      name: 'ThS. Nguyễn Minh Hiếu',
      gender: 'Nữ',
      email: HIEU_CO_EMAIL,
      department: 'Mỹ thuật công nghiệp',
      defaultQuota: 10,
      active: true
    }
  ];

  await t.test('2.1: filterAndDeduplicateMasterSupervisors NEVER merges Thầy Hiếu and Cô Hiếu (Both preserved)', () => {
    const clean = filterAndDeduplicateMasterSupervisors(rawMaster);
    assert.equal(clean.length, 2, 'Must contain BOTH distinct lecturers');

    const thay = clean.find(s => s.id === HIEU_THAY_ID);
    assert.ok(thay, 'Thầy TS. KTS Nguyễn Minh Hiếu must exist');
    assert.equal(thay.name, 'TS. KTS Nguyễn Minh Hiếu');
    assert.equal(thay.email, HIEU_THAY_EMAIL);
    assert.equal(thay.gender, 'Nam');

    const co = clean.find(s => s.id === HIEU_CO_ID);
    assert.ok(co, 'Cô ThS. Nguyễn Minh Hiếu must exist');
    assert.equal(co.name, 'ThS. Nguyễn Minh Hiếu');
    assert.equal(co.email, HIEU_CO_EMAIL);
    assert.equal(co.gender, 'Nữ');
  });

  await t.test('2.2: filterRoundSupervisorsList preserves both lecturers in round roster', () => {
    state.supervisorsMaster = rawMaster;

    const roundRaw = [
      {
        id: HIEU_THAY_ID,
        supervisorId: HIEU_THAY_ID,
        name: 'TS. KTS Nguyễn Minh Hiếu',
        email: HIEU_THAY_EMAIL,
        capacity: 10
      },
      {
        id: HIEU_CO_ID,
        supervisorId: HIEU_CO_ID,
        name: 'ThS. Nguyễn Minh Hiếu',
        email: HIEU_CO_EMAIL,
        capacity: 8
      }
    ];

    const cleanRound = filterRoundSupervisorsList(roundRaw);
    assert.equal(cleanRound.length, 2, 'Both lecturers must be preserved in round roster');

    const rThay = cleanRound.find(s => s.id === HIEU_THAY_ID);
    assert.equal(rThay.capacity, 10);
    assert.equal(rThay.email, HIEU_THAY_EMAIL);

    const rCo = cleanRound.find(s => s.id === HIEU_CO_ID);
    assert.equal(rCo.capacity, 8);
    assert.equal(rCo.email, HIEU_CO_EMAIL);
  });

  await t.test('2.3: Name and profile resolution strictly isolates the two lecturers by ID and email', () => {
    state.supervisorsMaster = rawMaster;

    // Resolve by ID
    assert.equal(resolveSupervisorName(HIEU_THAY_ID), 'TS. KTS Nguyễn Minh Hiếu');
    assert.equal(resolveSupervisorName(HIEU_CO_ID), 'ThS. Nguyễn Minh Hiếu');

    // Resolve by email
    assert.equal(resolveSupervisorName({ email: HIEU_THAY_EMAIL }), 'TS. KTS Nguyễn Minh Hiếu');
    assert.equal(resolveSupervisorName({ email: HIEU_CO_EMAIL }), 'ThS. Nguyễn Minh Hiếu');

    // Resolve profile
    const profThay = resolveSupervisorProfile(HIEU_THAY_ID);
    assert.equal(profThay.department, 'Khoa Kiến trúc');
    assert.equal(profThay.gender, 'Nam');

    const profCo = resolveSupervisorProfile(HIEU_CO_ID);
    assert.equal(profCo.department, 'Mỹ thuật công nghiệp');
    assert.equal(profCo.gender, 'Nữ');
  });

  await t.test('2.4: Email auth-index docs for each lecturer are filtered without affecting the other', () => {
    const rawWithIndexes = [
      ...rawMaster,
      {
        id: HIEU_THAY_EMAIL,
        supervisorId: HIEU_THAY_ID,
        isAuthIndex: true,
        email: HIEU_THAY_EMAIL
      },
      {
        id: HIEU_CO_EMAIL,
        supervisorId: HIEU_CO_ID,
        isAuthIndex: true,
        email: HIEU_CO_EMAIL
      }
    ];

    const clean = filterAndDeduplicateMasterSupervisors(rawWithIndexes);
    assert.equal(clean.length, 2, 'Exactly 2 real profiles returned, email indexes filtered out');
    assert.ok(clean.some(s => s.id === HIEU_THAY_ID));
    assert.ok(clean.some(s => s.id === HIEU_CO_ID));
    assert.ok(!clean.some(s => s.id === HIEU_THAY_EMAIL));
    assert.ok(!clean.some(s => s.id === HIEU_CO_EMAIL));
  });
});

test('=== SUITE 3: ALL 11 PRODUCTION SUPERVISORS STABILITY & DEDUPLICATION ===', async (t) => {
  const realSample = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'real-supervisors-sample.json'), 'utf8'));
  assert.equal(realSample.length, 11, 'Production sample has 11 distinct supervisors');

  // Add auth indexes for multiple supervisors
  const rawData = [
    ...realSample,
    { id: 'nguyenminhhieu@tdtu.edu.vn', isAuthIndex: true, supervisorId: 'oWS52UHJbLDk2rkzQyPR', email: 'nguyenminhhieu@tdtu.edu.vn' },
    { id: 'nguyenminhhieu.nt@tdtu.edu.vn', isAuthIndex: true, supervisorId: 'rsyOJ7pZB6joEwZrBp3d', email: 'nguyenminhhieu.nt@tdtu.edu.vn' },
    { id: 'tquangarc@gmail.com', isAuthIndex: true, supervisorId: 'VMiij78ssdGs9sPd6WTG', email: 'tquangarc@gmail.com', defaultQuota: 5, employmentType: 'adjunct' }
  ];

  const clean = filterAndDeduplicateMasterSupervisors(rawData);
  assert.equal(clean.length, 11, 'Must return exactly 11 unique master supervisor profiles');

  // Verify both Hiếu are present
  assert.ok(clean.some(s => s.id === 'oWS52UHJbLDk2rkzQyPR' && s.email === 'nguyenminhhieu@tdtu.edu.vn'));
  assert.ok(clean.some(s => s.id === 'rsyOJ7pZB6joEwZrBp3d' && s.email === 'nguyenminhhieu.nt@tdtu.edu.vn'));

  // Verify Thầy Quang is present once with quota 5
  const quang = clean.find(s => s.id === 'VMiij78ssdGs9sPd6WTG');
  assert.ok(quang);
  assert.equal(quang.defaultQuota, 5);
  assert.equal(quang.employmentType, 'adjunct');
});
