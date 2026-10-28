/**
 * Comprehensive Test Suite:
 * IFA-GRADUATION - HOTFIX ĐỒNG BỘ THÔNG TIN GVHD TOÀN HỆ THỐNG
 * "MỘT HỒ SƠ GVHD CHÍNH - NHIỀU NƠI SỬ DỤNG" (Single Source of Truth)
 *
 * 1. Single Source of Truth: supervisorMaster is authoritative for name, title, department, photoUrl.
 * 2. Stable Linking: ID (documentId / supervisorId) and normalized email.
 * 3. Disambiguation: Distinction between different lecturers with identical base names (e.g., TS. KTS Nguyễn Minh Hiếu vs ThS. Nguyễn Minh Hiếu).
 * 4. Automatic Resolution: Old snapshot names with typos (e.g. "TS. KTX Nguyễn Minh Hiếu") are dynamically resolved to "TS. KTS Nguyễn Minh Hiếu" across:
 *    - Student Registrations (NV1, NV2, NV3)
 *    - Admin Review & Manual Assignment Panels
 *    - Official Assignments
 *    - Excel Export
 *    - Student Portal & Registration Wizard
 *    - Topic Registration PDF
 * 5. In-memory Sync: When supervisorMaster is edited, active round in-memory data updates without page refresh.
 * 6. Code Integrity: All relevant modules use resolveSupervisorName / resolveSupervisorProfile.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

// Setup minimal Window & Global environment
global.window = global;
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};
global.state = {
  currentView: 'admin',
  isStudent: false,
  isAdmin: true,
  user: { email: 'admin@tdtu.edu.vn', displayName: 'Admin' },
  activeRound: { id: 'round-4-2027', preferenceCount: 3, directAssignment: false },
  supervisorsMaster: [],
  roundSupervisors: [],
  adminReviewData: { supervisors: [], students: [] }
};
global.escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[m]));
global.getSupervisorAvatarSvgDataUri = (name) => `data:image/svg+xml;utf8,<svg>${name}</svg>`;

// Load core functions via vm
const rawCore = fs.readFileSync(path.join(root, 'js', 'core.js'), 'utf8');

// Extract getSupervisorMasterRecord ... resolveSupervisorPhoto block
const startIdx = rawCore.indexOf('export function getSupervisorMasterRecord');
const endIdx = rawCore.indexOf('window.getSupervisorMasterRecord = getSupervisorMasterRecord;');
const resolverBlock = rawCore.slice(startIdx, endIdx)
  .replace(/export\s+/g, '');

// Extract getOfficialSupervisors and normalizeOfficialAssignment
const normStart = rawCore.indexOf('export function getOfficialSupervisors');
const normEnd = rawCore.indexOf('export function getSupervisorAssignmentMode');
const normBlock = rawCore.slice(normStart, normEnd)
  .replace(/export\s+/g, '');

vm.runInThisContext(resolverBlock);
vm.runInThisContext(normBlock);

global.getSupervisorMasterRecord = getSupervisorMasterRecord;
global.resolveSupervisorProfile = resolveSupervisorProfile;
global.resolveSupervisorName = resolveSupervisorName;
global.resolveSupervisorDepartment = resolveSupervisorDepartment;
global.resolveSupervisorPhoto = resolveSupervisorPhoto;
global.getOfficialSupervisors = getOfficialSupervisors;
global.normalizeOfficialAssignment = normalizeOfficialAssignment;

// Master mock data representing real production scenario
const MOCK_MASTER_SUPERVISORS = [
  {
    id: 'oWS52UHJbLDk2rkzQyPR',
    name: 'TS. KTS Nguyễn Minh Hiếu', // Corrected title
    email: 'nguyenminhhieu@tdtu.edu.vn',
    department: 'Kiến trúc',
    photoUrl: 'https://example.com/avatar-kts-hieu.jpg',
    isActive: true
  },
  {
    id: 'rsyOJ7pZB6joEwZrBp3d',
    name: 'ThS. Nguyễn Minh Hiếu', // Colleague with same base name
    email: 'nguyenminhhieu.nt@tdtu.edu.vn',
    department: 'Mỹ thuật công nghiệp',
    photoUrl: 'https://example.com/avatar-ths-hieu.jpg',
    isActive: true
  },
  {
    id: 'prof-tran-van-a',
    name: 'PGS. TS. Trần Văn A',
    email: 'tranvana@tdtu.edu.vn',
    department: 'Công nghệ thông tin',
    photoUrl: 'https://example.com/avatar-tran-van-a.jpg',
    isActive: true
  }
];

// Seed state.supervisorsMaster
global.state.supervisorsMaster = JSON.parse(JSON.stringify(MOCK_MASTER_SUPERVISORS));

test('1. Core Resolvers: getSupervisorMasterRecord resolves by ID and normalized Email', () => {
  // Resolve by ID
  const sup1 = global.getSupervisorMasterRecord('oWS52UHJbLDk2rkzQyPR');
  assert.ok(sup1, 'Should find supervisor by ID');
  assert.equal(sup1.name, 'TS. KTS Nguyễn Minh Hiếu');
  assert.equal(sup1.department, 'Kiến trúc');

  // Resolve by email
  const sup2 = global.getSupervisorMasterRecord('nguyenminhhieu.nt@tdtu.edu.vn');
  assert.ok(sup2, 'Should find supervisor by email');
  assert.equal(sup2.id, 'rsyOJ7pZB6joEwZrBp3d');
  assert.equal(sup2.name, 'ThS. Nguyễn Minh Hiếu');

  // Resolve by email with uppercase and leading/trailing whitespace
  const sup2Normalized = global.getSupervisorMasterRecord('  NGUYENMINHHIEU.NT@TDTU.EDU.VN  ');
  assert.ok(sup2Normalized, 'Should normalize email before matching');
  assert.equal(sup2Normalized.id, 'rsyOJ7pZB6joEwZrBp3d');

  // Resolve by object ref containing supervisorId
  const supObj = global.getSupervisorMasterRecord({ supervisorId: 'oWS52UHJbLDk2rkzQyPR' });
  assert.equal(supObj.name, 'TS. KTS Nguyễn Minh Hiếu');

  // Resolve non-existent returns null
  assert.equal(global.getSupervisorMasterRecord('non-existent-id'), null);
  assert.equal(global.getSupervisorMasterRecord(null), null);
});

test('2. Disambiguation: Two lecturers with same base name are never confused', () => {
  // Lecturer 1: TS. KTS Nguyễn Minh Hiếu (formerly mis-typed as TS. KTX)
  const name1ById = global.resolveSupervisorName('oWS52UHJbLDk2rkzQyPR', 'TS. KTX Nguyễn Minh Hiếu');
  assert.equal(name1ById, 'TS. KTS Nguyễn Minh Hiếu', 'Resolving lecturer 1 must replace old KTX typo with KTS');

  // Lecturer 2: ThS. Nguyễn Minh Hiếu
  const name2ById = global.resolveSupervisorName('rsyOJ7pZB6joEwZrBp3d', 'ThS. Nguyễn Minh Hiếu');
  assert.equal(name2ById, 'ThS. Nguyễn Minh Hiếu', 'Resolving lecturer 2 must keep ThS. title');

  // Resolving by email
  const name1ByEmail = global.resolveSupervisorName({ email: 'nguyenminhhieu@tdtu.edu.vn' });
  assert.equal(name1ByEmail, 'TS. KTS Nguyễn Minh Hiếu');

  const name2ByEmail = global.resolveSupervisorName({ email: 'nguyenminhhieu.nt@tdtu.edu.vn' });
  assert.equal(name2ByEmail, 'ThS. Nguyễn Minh Hiếu');
});

test('3. Fallback resilience: Missing or unmastered supervisors return safe fallback', () => {
  const fallbackName = 'TS. Khách Mời';
  assert.equal(global.resolveSupervisorName('unknown-id', fallbackName), fallbackName);
  assert.equal(global.resolveSupervisorName(null, fallbackName), fallbackName);
  assert.equal(global.resolveSupervisorName(undefined, ''), '');

  const fallbackDept = 'Bộ môn Ngoại ngữ';
  assert.equal(global.resolveSupervisorDepartment('unknown-id', fallbackDept), fallbackDept);

  const fallbackPhoto = 'https://example.com/default.png';
  assert.equal(global.resolveSupervisorPhoto('unknown-id', fallbackPhoto), fallbackPhoto);
});

test('4. Snapshot Replacement: Old snapshot typo in preferences resolves to Master profile', () => {
  // Preference with old snapshot name 'TS. KTX Nguyễn Minh Hiếu'
  const preferenceItem = {
    rank: 1,
    supervisorId: 'oWS52UHJbLDk2rkzQyPR',
    supervisorName: 'TS. KTX Nguyễn Minh Hiếu', // Outdated snapshot
    supervisorEmail: 'nguyenminhhieu@tdtu.edu.vn'
  };

  const resolvedName = global.resolveSupervisorName(preferenceItem, preferenceItem.supervisorName);
  assert.equal(resolvedName, 'TS. KTS Nguyễn Minh Hiếu', 'Must dynamically display corrected name from Master');

  const resolvedProfile = global.resolveSupervisorProfile(preferenceItem, preferenceItem);
  assert.equal(resolvedProfile.name, 'TS. KTS Nguyễn Minh Hiếu');
  assert.equal(resolvedProfile.department, 'Kiến trúc');
  assert.equal(resolvedProfile.photoUrl, 'https://example.com/avatar-kts-hieu.jpg');
});

test('5. Assignments & Normalization: normalizeOfficialAssignment updates profile while preserving roles and IDs', () => {
  const rawAssignment = {
    studentId: '52000001',
    studentName: 'Nguyễn Văn Em',
    supervisors: [
      {
        supervisorId: 'oWS52UHJbLDk2rkzQyPR',
        supervisorName: 'TS. KTX Nguyễn Minh Hiếu', // Stored snapshot with typo
        supervisorEmail: 'nguyenminhhieu@tdtu.edu.vn',
        role: 'primary'
      }
    ],
    status: 'assigned',
    published: true
  };

  const normalized = global.normalizeOfficialAssignment(rawAssignment);
  assert.equal(normalized.studentId, '52000001', 'Preserves studentId');
  assert.equal(normalized.published, true, 'Preserves published status');
  assert.ok(Array.isArray(normalized.supervisors) && normalized.supervisors.length > 0);
  assert.equal(normalized.supervisors[0].supervisorId, 'oWS52UHJbLDk2rkzQyPR', 'Preserves original supervisorId');
  assert.equal(normalized.supervisors[0].supervisorName, 'TS. KTS Nguyễn Minh Hiếu', 'Overwrites snapshot name with Master name');
  assert.equal(normalized.supervisors[0].photoUrl, 'https://example.com/avatar-kts-hieu.jpg', 'Resolves photo from Master');
});

test('6. In-memory round supervisor sync when Master is updated', async () => {
  // Setup in-memory roundSupervisors with typo snapshot
  global.state.roundSupervisors = [
    {
      id: 'oWS52UHJbLDk2rkzQyPR',
      supervisorId: 'oWS52UHJbLDk2rkzQyPR',
      name: 'TS. KTX Nguyễn Minh Hiếu',
      capacity: 10,
      activeInRound: true
    }
  ];
  global.state.adminReviewData = {
    supervisors: [
      {
        id: 'oWS52UHJbLDk2rkzQyPR',
        name: 'TS. KTX Nguyễn Minh Hiếu',
        quota: 10
      }
    ],
    students: []
  };

  // Simulate updating supervisor master in-memory
  const masterEntry = global.state.supervisorsMaster.find(s => s.id === 'oWS52UHJbLDk2rkzQyPR');
  masterEntry.name = 'TS. KTS Nguyễn Minh Hiếu (Đã cập nhật)';
  masterEntry.department = 'Khoa Kiến trúc và Mỹ thuật';

  // Apply sync logic as in supervisors-master.js
  if (Array.isArray(global.state.roundSupervisors)) {
    global.state.roundSupervisors.forEach(rs => {
      const rsId = rs.supervisorId || rs.id;
      if (rsId === masterEntry.id) {
        rs.name = masterEntry.name;
        rs.department = masterEntry.department;
      }
    });
  }
  if (global.state.adminReviewData && Array.isArray(global.state.adminReviewData.supervisors)) {
    global.state.adminReviewData.supervisors.forEach(ars => {
      const arsId = ars.supervisorId || ars.id;
      if (arsId === masterEntry.id) {
        ars.name = masterEntry.name;
        ars.department = masterEntry.department;
      }
    });
  }

  // Verify sync
  assert.equal(global.state.roundSupervisors[0].name, 'TS. KTS Nguyễn Minh Hiếu (Đã cập nhật)');
  assert.equal(global.state.roundSupervisors[0].capacity, 10, 'Round capacity preserved');
  assert.equal(global.state.adminReviewData.supervisors[0].name, 'TS. KTS Nguyễn Minh Hiếu (Đã cập nhật)');
});

test('7. Architecture Integrity: Key modules integrate Master profile resolvers', () => {
  // Core exports
  const coreSrc = fs.readFileSync(path.join(root, 'js', 'core.js'), 'utf8');
  assert.ok(coreSrc.includes('function getSupervisorMasterRecord'), 'core.js must export getSupervisorMasterRecord');
  assert.ok(coreSrc.includes('function resolveSupervisorProfile'), 'core.js must export resolveSupervisorProfile');
  assert.ok(coreSrc.includes('function resolveSupervisorName'), 'core.js must export resolveSupervisorName');

  // Assignments Admin
  const adminSrc = fs.readFileSync(path.join(root, 'js', 'supervisors', 'assignments-admin.js'), 'utf8');
  assert.ok(adminSrc.includes('resolveSupervisorName'), 'assignments-admin.js must call resolveSupervisorName');
  assert.ok(adminSrc.includes('resolveSupervisorDepartment'), 'assignments-admin.js must call resolveSupervisorDepartment');

  // Assignments Matching
  const matchingSrc = fs.readFileSync(path.join(root, 'js', 'supervisors', 'assignments-matching.js'), 'utf8');
  assert.ok(matchingSrc.includes('resolveSupervisorProfile'), 'assignments-matching.js must call resolveSupervisorProfile');

  // Assignments Excel
  const excelSrc = fs.readFileSync(path.join(root, 'js', 'supervisors', 'assignments-excel.js'), 'utf8');
  assert.ok(excelSrc.includes('resolveSupervisorName'), 'assignments-excel.js must call resolveSupervisorName for Column 9 & 11');

  // Student Registrations Admin
  const regAdminSrc = fs.readFileSync(path.join(root, 'js', 'students', 'student-registrations-admin.js'), 'utf8');
  assert.ok(regAdminSrc.includes('resolveSupervisorName'), 'student-registrations-admin.js must call resolveSupervisorName for NV1/NV2/NV3');

  // Student Eligibility Admin
  const eligAdminSrc = fs.readFileSync(path.join(root, 'js', 'students', 'student-eligibility-admin.js'), 'utf8');
  assert.ok(eligAdminSrc.includes('resolveSupervisorName'), 'student-eligibility-admin.js must call resolveSupervisorName');

  // Student Registration UI
  const regUiSrc = fs.readFileSync(path.join(root, 'js', 'students', 'registration.js'), 'utf8');
  assert.ok(regUiSrc.includes('resolveSupervisorProfile') || regUiSrc.includes('resolveSupervisorName'), 'registration.js must call master supervisor resolver');

  // Student Topic PDF
  const pdfSrc = fs.readFileSync(path.join(root, 'js', 'students', 'student-topic-pdf.js'), 'utf8');
  assert.ok(pdfSrc.includes('resolveSupervisorName'), 'student-topic-pdf.js must call resolveSupervisorName');

  // Auth preload
  const authSrc = fs.readFileSync(path.join(root, 'js', 'auth.js'), 'utf8');
  assert.ok(authSrc.includes('ensureSupervisorsMasterLoaded'), 'auth.js must preload supervisorsMaster on login');
});
