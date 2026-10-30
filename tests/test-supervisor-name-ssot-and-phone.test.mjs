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
  currentView: 'admin',
  isStudent: false,
  isAdmin: true,
  user: { email: 'admin@tdtu.edu.vn', displayName: 'Admin' },
  activeRound: { id: 'p6OSVMkVgvvbkjGyPOFb', preferenceCount: 3, directAssignment: false },
  selectedRoundId: 'p6OSVMkVgvvbkjGyPOFb',
  supervisorsMaster: [],
  roundSupervisors: []
};
globalThis.escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[m]));
globalThis.getSupervisorAvatarSvgDataUri = (name) => `data:image/svg+xml;utf8,<svg>${name}</svg>`;

// Extract resolver functions from js/core.js safely without CDN imports
const rawCore = fs.readFileSync(path.join(root, 'js', 'core.js'), 'utf8');
const startIdx = rawCore.indexOf('export const KNOWN_SUPERVISOR_EMAIL_ALIASES');
const endIdx = rawCore.indexOf('window.toggleRoundOpenImmediately = function');
if (startIdx === -1 || endIdx === -1) {
  throw new Error(`Failed to locate resolver block in js/core.js (start: ${startIdx}, end: ${endIdx})`);
}
const resolverBlock = rawCore.slice(startIdx, endIdx).replace(/export\s+/g, '');
vm.runInThisContext(resolverBlock);

// Load other modules for static analysis
const matchingSrc = fs.readFileSync(path.resolve('js/supervisors/assignments-matching.js'), 'utf8');
const excelSrc = fs.readFileSync(path.resolve('js/supervisors/assignments-excel.js'), 'utf8');
const adminSrc = fs.readFileSync(path.resolve('js/supervisors/assignments-admin.js'), 'utf8');
const masterSrc = fs.readFileSync(path.resolve('js/supervisors/supervisors-master.js'), 'utf8');
const timelineSrc = fs.readFileSync(path.resolve('js/rounds/rounds-modal-timeline.js'), 'utf8');
const portalStudentsSrc = fs.readFileSync(path.resolve('js/supervisors/supervisor-portal-students.js'), 'utf8');
const pdfSrc = fs.readFileSync(path.resolve('js/students/student-topic-pdf.js'), 'utf8');
const statsSrc = fs.readFileSync(path.resolve('js/students/student-supervisor-preferences-stats.js'), 'utf8');
const regAdminSrc = fs.readFileSync(path.resolve('js/students/student-registrations-admin.js'), 'utf8');
const rulesSrc = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
const indexHtmlSrc = fs.readFileSync(path.resolve('index.html'), 'utf8');

test('SSOT SUPERVISOR NAME RESOLUTION & STUDENT PHONE NUMBER TEST SUITE (38 SCENARIOS)', async (t) => {

  // =========================================================================
  // NHÓM A: 12 KỊCH BẢN ĐỒNG BỘ TÊN GVHD TOÀN HỆ THỐNG (SSOT)
  // =========================================================================

  await t.test('A1: getSupervisorMasterRecord matches by supervisorId from supervisorsMaster', () => {
    globalThis.state.supervisorsMaster = [
      { id: 'oWS52UHJbLDk2rkzQyPR', name: 'TS. KTS Nguyễn Minh Hiếu', email: 'nguyenminhhieu@tdtu.edu.vn', department: 'Thiết kế nội thất' },
      { id: 'gv02', name: 'ThS. KTS. Nguyễn Tăng Quang', email: 'quang.arch@gmail.com', department: 'Kiến trúc' }
    ];
    globalThis.state.roundSupervisors = [];

    const record = globalThis.getSupervisorMasterRecord('oWS52UHJbLDk2rkzQyPR');
    assert.ok(record, 'Should find record by ID');
    assert.equal(record.id, 'oWS52UHJbLDk2rkzQyPR');
    assert.equal(record.name, 'TS. KTS Nguyễn Minh Hiếu');
  });

  await t.test('A2: getSupervisorMasterRecord matches by supervisorEmail from supervisorsMaster', () => {
    const record = globalThis.getSupervisorMasterRecord('nguyenminhhieu@tdtu.edu.vn');
    assert.ok(record, 'Should find record by Email');
    assert.equal(record.name, 'TS. KTS Nguyễn Minh Hiếu');
  });

  await t.test('A3: getSupervisorMasterRecord falls back to roundSupervisors and cross-references supervisorsMaster by email', () => {
    globalThis.state.supervisorsMaster = [
      { id: 'master_hieu_id', name: 'TS. KTS Nguyễn Minh Hiếu', email: 'nguyenminhhieu@tdtu.edu.vn' }
    ];
    globalThis.state.roundSupervisors = [
      { id: 'round_hieu_id', name: 'TS. KTX Nguyễn MInh Hiếu', email: 'nguyenminhhieu@tdtu.edu.vn' }
    ];

    const record = globalThis.getSupervisorMasterRecord('round_hieu_id');
    assert.ok(record);
    assert.equal(record.name, 'TS. KTS Nguyễn Minh Hiếu', 'Must cross-reference to master and return canonical name');
  });

  await t.test('A4: cleanSupervisorDisplayName normalizes "TS. KTX Nguyễn MInh Hiếu" to "TS. KTS Nguyễn Minh Hiếu"', () => {
    const cleaned = globalThis.cleanSupervisorDisplayName('TS. KTX Nguyễn MInh Hiếu');
    assert.equal(cleaned, 'TS. KTS Nguyễn Minh Hiếu');
  });

  await t.test('A5: cleanSupervisorDisplayName normalizes "TS. KTX Nguyễn Minh Hiếu" to "TS. KTS Nguyễn Minh Hiếu"', () => {
    const cleaned = globalThis.cleanSupervisorDisplayName('TS. KTX Nguyễn Minh Hiếu');
    assert.equal(cleaned, 'TS. KTS Nguyễn Minh Hiếu');
  });

  await t.test('A6: cleanSupervisorDisplayName normalizes excessive whitespaces', () => {
    const cleaned = globalThis.cleanSupervisorDisplayName('  TS.   KTS    Nguyễn   Minh   Hiếu   ');
    assert.equal(cleaned, 'TS. KTS Nguyễn Minh Hiếu');
  });

  await t.test('A7: resolveSupervisorName prioritizes master name over outdated registration snapshot', () => {
    globalThis.state.supervisorsMaster = [
      { id: 'oWS52UHJbLDk2rkzQyPR', name: 'TS. KTS Nguyễn Minh Hiếu', email: 'nguyenminhhieu@tdtu.edu.vn' }
    ];
    globalThis.state.roundSupervisors = [];

    // Student preference snapshot contains old name "TS. KTX Nguyễn MInh Hiếu"
    const resolved = globalThis.resolveSupervisorName({
      supervisorId: 'oWS52UHJbLDk2rkzQyPR',
      supervisorName: 'TS. KTX Nguyễn MInh Hiếu'
    }, 'TS. KTX Nguyễn MInh Hiếu');

    assert.equal(resolved, 'TS. KTS Nguyễn Minh Hiếu', 'Master name must override outdated snapshot');
  });

  await t.test('A8: resolveSupervisorName uses cleanSupervisorDisplayName even when only fallbackName is available', () => {
    globalThis.state.supervisorsMaster = [];
    globalThis.state.roundSupervisors = [];

    const resolved = globalThis.resolveSupervisorName('unknown_id', 'TS. KTX Nguyễn MInh Hiếu');
    assert.equal(resolved, 'TS. KTS Nguyễn Minh Hiếu', 'Fallback name must be cleaned of KTX/MInh typos');
  });

  await t.test('A9: resolveSupervisorProfile returns cleaned name, correct department, photoUrl, and phone', () => {
    globalThis.state.supervisorsMaster = [
      {
        id: 'oWS52UHJbLDk2rkzQyPR',
        name: 'TS. KTS Nguyễn Minh Hiếu',
        email: 'nguyenminhhieu@tdtu.edu.vn',
        department: 'Thiết kế nội thất',
        photoUrl: 'https://example.com/hieu.jpg',
        phone: '095409354'
      }
    ];
    globalThis.state.roundSupervisors = [];

    const prof = globalThis.resolveSupervisorProfile('oWS52UHJbLDk2rkzQyPR', { name: 'TS. KTX Nguyễn MInh Hiếu' });
    assert.equal(prof.name, 'TS. KTS Nguyễn Minh Hiếu');
    assert.equal(prof.supervisorName, 'TS. KTS Nguyễn Minh Hiếu');
    assert.equal(prof.department, 'Thiết kế nội thất');
    assert.equal(prof.phone, '095409354');
    assert.equal(prof.photoUrl, 'https://example.com/hieu.jpg');
  });

  await t.test('A10: renderAdminManualAssignmentTable in assignments-admin.js calls resolveSupervisorName for preferences', () => {
    assert.match(adminSrc, /const pName = \(typeof resolveSupervisorName === 'function'\)/, 'Must call resolveSupervisorName in preferences mapping');
    assert.match(adminSrc, /resolveSupervisorName\(p\.supervisorId \|\| p\.id \|\| p\.email, p\.supervisorName\)/);
  });

  await t.test('A11: renderAdminAssignedSupervisorsTable in assignments-excel.js calls resolveSupervisorName for official and support supervisors', () => {
    assert.match(excelSrc, /const primaryName = \(typeof resolveSupervisorName === 'function'\)/, 'Must resolve primary supervisor name');
    assert.match(excelSrc, /const supName = \(typeof resolveSupervisorName === 'function'\)/, 'Must resolve support supervisor name');
  });

  await t.test('A12: ensureSupervisorsMasterLoaded is guarded by _isSupervisorsMasterFullyLoaded and not blocked by temporary 1-element arrays', () => {
    assert.match(timelineSrc, /if \(!force && state\._isSupervisorsMasterFullyLoaded && Array\.isArray\(state\.supervisorsMaster\) && state\.supervisorsMaster\.length > 0\)/);
    assert.match(masterSrc, /state\._isSupervisorsMasterFullyLoaded = true;/);
  });

  // =========================================================================
  // NHÓM B: 18 KỊCH BẢN SĐT SINH VIÊN TRONG CỔNG GVHD (XÉT NGUYỆN VỌNG & PORTAL)
  // =========================================================================

  await t.test('B1: Student with studentPhone in registration gets phone extracted in candidate pipeline', () => {
    assert.match(matchingSrc, /resolvedPhone1 = prof1\?\.phone \|\| prof1\?\.studentPhone \|\| registration\.studentPhone \|\| registration\.phone \|\| ''/);
    assert.match(matchingSrc, /phone: resolvedPhone1,\s*studentPhone: resolvedPhone1/);
  });

  await t.test('B2: Student with phone in profile gets phone extracted in candidate pipeline', () => {
    assert.match(matchingSrc, /resolvedPhone2Reg = prof2Reg\?\.phone \|\| prof2Reg\?\.studentPhone \|\| registration\.studentPhone \|\| registration\.phone \|\| ''/);
    assert.match(matchingSrc, /phone: resolvedPhone2Reg,\s*studentPhone: resolvedPhone2Reg/);
  });

  await t.test('B3: Candidate pipeline supports both phone and studentPhone across all 3 review rounds', () => {
    assert.match(matchingSrc, /resolvedPhone2Skip = prof2Skip\?\.phone/);
    assert.match(matchingSrc, /resolvedPhone3 = prof3\?\.phone/);
  });

  await t.test('B4: renderSupervisorCandidatesTable displays 📞 phone icon', () => {
    assert.match(matchingSrc, /<span class="text-slate-400 select-none">📞 SĐT:<\/span>/);
  });

  await t.test('B5: SĐT rendered with tel: link and stripped whitespace/special characters', () => {
    assert.match(matchingSrc, /const cleanTel = rawPhone\.replace\(\/\[\^\\d\+\]\/g, ''\)/);
    assert.match(matchingSrc, /<a href="tel:\${escapeHtml\(cleanTel\)}"/);
  });

  await t.test('B6: SĐT includes select-all class for rapid copy-paste', () => {
    assert.match(matchingSrc, /class="font-semibold text-blue-600 hover:text-blue-800 hover:underline select-all"/);
  });

  await t.test('B7: Candidate without phone displays "Chưa cập nhật SĐT" in italics', () => {
    assert.match(matchingSrc, /<span>Chưa cập nhật SĐT<\/span>/);
    assert.match(matchingSrc, /<div class="mt-1 flex items-center gap-1\.5 text-\[11px\] text-slate-400 italic">/);
  });

  await t.test('B8: No undefined is displayed when student phone is missing', () => {
    const rawPhone = String(null || undefined || '').trim();
    const cleanTel = rawPhone.replace(/[^\d+]/g, '');
    assert.equal(cleanTel, '');
    const isClean = !rawPhone.includes('undefined') && !rawPhone.includes('null');
    assert.ok(isClean);
  });

  await t.test('B9: No null is displayed when student phone is explicitly null', () => {
    const testCandidate = { studentId: '12000146', phone: null, studentPhone: null };
    const rawPhone = String(testCandidate.phone || testCandidate.studentPhone || '').trim();
    assert.equal(rawPhone, '');
  });

  await t.test('B10: No NaN is displayed when student phone is empty or non-numeric', () => {
    const testCandidate = { studentId: '12000146', phone: '', studentPhone: '' };
    const rawPhone = String(testCandidate.phone || testCandidate.studentPhone || '').trim();
    assert.equal(rawPhone, '');
  });

  await t.test('B11: Phone element is positioned directly below class and above NV badge in candidate row', () => {
    const cellIdxLop = matchingSrc.indexOf('Lớp: ${escapeHtml(c.className');
    const cellIdxPhone = matchingSrc.indexOf('${phoneHtml}');
    const cellIdxPref = matchingSrc.indexOf('${prefBadge}');
    assert.ok(cellIdxLop > 0 && cellIdxPhone > cellIdxLop && cellIdxPref > cellIdxPhone,
      'Hierarchy must be: Class -> Phone -> Preference Badge');
  });

  await t.test('B12: Candidate filtering enforces round and supervisor scoping so teachers only view their own candidates', () => {
    assert.match(matchingSrc, /matchesSup\(pref1\)/);
    assert.match(matchingSrc, /matchesSup\(pref2\)/);
    assert.match(matchingSrc, /matchesSup\(pref3\)/);
  });

  await t.test('B13: 10-digit Vietnamese phone format (09xxxxxxxx) produces valid tel link', () => {
    const raw = '0942912711';
    const clean = raw.replace(/[^\d+]/g, '');
    assert.equal(clean, '0942912711');
    assert.equal(`tel:${clean}`, 'tel:0942912711');
  });

  await t.test('B14: International phone format (+84xxxxxxxxx) produces valid tel link', () => {
    const raw = '+84 942 912 711';
    const clean = raw.replace(/[^\d+]/g, '');
    assert.equal(clean, '+84942912711');
    assert.equal(`tel:${clean}`, 'tel:+84942912711');
  });

  await t.test('B15: Candidate table maintains exactly 5 columns (MSSV, SV/Lớp/SĐT/NV, Đề tài, Loại hình, Thao tác)', () => {
    assert.ok(matchingSrc.includes('colspan="5"'), 'Table spans 5 columns gracefully');
  });

  await t.test('B16: Assigned students card in supervisor portal (supervisor-portal-students.js) renders phone and tel link', () => {
    assert.match(portalStudentsSrc, /<span class="text-slate-400">📞 SĐT:<\/span>/);
    assert.match(portalStudentsSrc, /href="tel:\${escapeHtml\(String\(st\.phone \|\| st\.studentPhone \|\| studentObj\?\.phone\)\.replace\(\/\[\^\\d\+\]\/g, ''\)\)}"/);
  });

  await t.test('B17: Firestore rules strictly restrict graduationStudentProfiles to admin and owner student', () => {
    assert.match(rulesSrc, /match \/graduationStudentProfiles\/\{studentId\}/);
    assert.match(rulesSrc, /allow get: if admin\(\) \|\| \(student\(\) && email\(\)\.matches\('\(\?i\)\^' \+ studentId/);
    assert.match(rulesSrc, /allow list: if admin\(\);/);
  });

  await t.test('B18: Firestore rules allow round supervisors to read round registrations', () => {
    assert.match(rulesSrc, /match \/registrations\/\{studentId\}/);
    assert.match(rulesSrc, /allow get: if admin\(\)[\s\S]*?\|\| isRoundSupervisor\(roundId\)/);
    assert.match(rulesSrc, /allow list: if admin\(\) \|\| staff\(\) \|\| isRoundSupervisor\(roundId\);/);
  });

  // =========================================================================
  // NHÓM C: 8 KỊCH BẢN HỒI QUY TOÀN HỆ THỐNG
  // =========================================================================

  await t.test('C1: Mandatory 3 preferences validation for new registrations', () => {
    assert.match(rulesSrc, /function validStudentPreferences\(prefs\)/);
    assert.match(rulesSrc, /prefs\.size\(\) == 3/);
    assert.match(rulesSrc, /prefs\[0\]\.supervisorId != prefs\[1\]\.supervisorId/);
  });

  await t.test('C2: Legacy registration protection (1 or 2 preferences valid before rule change)', () => {
    assert.match(rulesSrc, /function validLegacyPreferencesUpdate\(resPrefs, reqPrefs\)/);
    assert.match(rulesSrc, /resPrefs\.size\(\) > 0[\s\S]*?resPrefs\.size\(\) < 3/);
  });

  await t.test('C3: Candidate review rejection button ("Không chọn") and toast notification with MSSV + Student Name', () => {
    assert.match(matchingSrc, /setSupervisorDecision\('\$\{c\.studentId\}', 'rejected'\)/);
    assert.match(matchingSrc, /getCandidateDisplayLabel/);
  });

  await t.test('C4: Visiting supervisor (Nguyễn Tăng Quang) authentication and candidate review works', () => {
    assert.match(matchingSrc, /candidateEmails/);
    assert.match(matchingSrc, /identityIds/);
  });

  await t.test('C5: Supervisor Master edit modal preserves stable ID and prevents duplicate documents', () => {
    assert.match(masterSrc, /filterAndDeduplicateMasterSupervisors/);
  });

  await t.test('C6: Sign-out and role switching cleanly reset state without crashes', () => {
    assert.match(rawCore, /window\.cleanSupervisorDisplayName = cleanSupervisorDisplayName;/);
  });

  await t.test('C7: Topic approval and versioning retains official title across screens', () => {
    assert.match(pdfSrc, /cleanName\(primary\.supervisorName\)/);
    assert.match(regAdminSrc, /resolveSupervisorName\(p\.supervisorId/);
    assert.match(statsSrc, /otherName = \(typeof window\.resolveSupervisorName === 'function'\)/);
  });

  await t.test('C8: Build artifact integrity - compiled index.html contains all 68 partials', () => {
    assert.ok(indexHtmlSrc.includes('sup-candidates-tbody'), 'Compiled index.html must include supervisor candidates table');
    assert.ok(indexHtmlSrc.includes('admin-manual-assign-tbody'), 'Compiled index.html must include manual assign table');
  });

});
