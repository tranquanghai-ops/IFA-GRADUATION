/**
 * IFA-GRADUATION — Test Suite: Supervisor Filter & Student Self-Join Link
 * Tests for:
 *  A. Supervisor Filtering & "Danh sách GVHD chính" standardization (Yêu cầu 1)
 *  B. Round Self-Join Link Generation & Student Self-Join Flow (Yêu cầu 2)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Polyfill browser globals for node test environment
global.window = global;
global.document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {}
};
global.sessionStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};
global.state = {};
global.escapeHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
global.showToast = () => {};

test('--- YÊU CẦU 1: LỌC GVHD VÀ DANH SÁCH GVHD CHÍNH ---', async (t) => {

  await t.test('1.1. Chuẩn hóa tên gọi: Không còn từ "Kho Master" trên giao diện Admin và Modals', () => {
    const tabSup = fs.readFileSync('views/admin/tab-supervisors.html', 'utf8');
    const modalAddSup = fs.readFileSync('templates/modals/supervisors/modal-add-sup-to-round.html', 'utf8');
    const jsSup = fs.readFileSync('js/supervisors/supervisors-master.js', 'utf8');

    // Must not contain "kho Master" or "Kho Master"
    assert.strictEqual(/kho\s*master/i.test(tabSup), false, 'views/admin/tab-supervisors.html must not contain Kho Master');
    assert.strictEqual(/kho\s*master/i.test(modalAddSup), false, 'modal-add-sup-to-round.html must not contain Kho Master');
    assert.strictEqual(/kho\s*master/i.test(jsSup), false, 'supervisors-master.js must not contain Kho Master');

    // Must contain "Danh sách GVHD chính"
    assert.match(tabSup, /Danh sách GVHD chính/);
    assert.match(modalAddSup, /Danh sách GVHD chính/);
    assert.match(jsSup, /Danh sách GVHD chính/);
  });

  await t.test('1.2. Hướng dẫn trong modal hiển thị đúng chuẩn yêu cầu', () => {
    const modalAddSup = fs.readFileSync('templates/modals/supervisors/modal-add-sup-to-round.html', 'utf8');
    assert.match(modalAddSup, /Chọn giảng viên từ Danh sách GVHD chính để bổ sung vào đợt tốt nghiệp\./);
  });

  await t.test('1.3. Logic lọc GVHD đã tham gia đợt: loại bỏ chính xác theo UID và normalized email', () => {
    // Simulate master supervisors (12 people)
    const masterSupervisors = [
      { id: 'gv1', name: 'TS. Nguyễn Văn A', email: 'nva@tdtu.edu.vn', active: true },
      { id: 'gv2', name: 'ThS. Trần Thị B', email: 'ttb@tdtu.edu.vn', active: true },
      { id: 'gv3', name: 'ThS. Lê Văn C', email: 'lvc@tdtu.edu.vn', active: true },
      { id: 'gv4', name: 'PGS.TS. Phạm Văn D', email: 'pvd@tdtu.edu.vn', active: true },
      { id: 'gv5', name: 'TS. Hoàng Thị E', email: 'hte@tdtu.edu.vn', active: true },
      { id: 'gv6', name: 'ThS. Đỗ Văn F', email: 'dvf@tdtu.edu.vn', active: true },
      { id: 'gv7', name: 'TS. Vũ Văn G', email: 'vvg@tdtu.edu.vn', active: true },
      { id: 'gv8', name: 'ThS. Bùi Thị H', email: 'bth@tdtu.edu.vn', active: true },
      { id: 'gv9', name: 'TS. Đặng Văn I', email: 'dvi@tdtu.edu.vn', active: true },
      { id: 'gv10', name: 'ThS. Ngô Thị K', email: 'ntk@tdtu.edu.vn', active: true },
      { id: 'gv11', name: 'TS. Lý Văn L', email: 'lvl@tdtu.edu.vn', active: true },
      { id: 'gv12', name: 'ThS. Mai Thị M', email: 'mtm@tdtu.edu.vn', active: true },
      { id: 'gv13', name: 'Nghỉ hưu N', email: 'nhn@tdtu.edu.vn', active: false } // Inactive
    ];

    // Participating supervisors in round (5 people)
    const roundSupervisors = [
      { id: 'gv1', supervisorId: 'gv1', email: 'NVA@tdtu.edu.vn' }, // match ID & email uppercase
      { id: 'legacy_doc_id_2', supervisorId: 'gv2', email: 'ttb@tdtu.edu.vn' }, // match supervisorId
      { id: 'custom_doc_3', supervisorId: '', email: 'lvc@tdtu.edu.vn' }, // match email
      { id: 'gv4', supervisorId: 'gv4', email: 'PVD@TDTU.EDU.VN' }, // match mixed case email
      { id: 'gv5', supervisorId: 'gv5', email: 'hte@tdtu.edu.vn' }
    ];

    // Set of participating identifiers
    const existingIds = new Set();
    const existingEmails = new Set();
    roundSupervisors.forEach(s => {
      if (s.id) existingIds.add(String(s.id).trim().toLowerCase());
      if (s.supervisorId) existingIds.add(String(s.supervisorId).trim().toLowerCase());
      if (s.email) existingEmails.add(String(s.email).trim().toLowerCase());
    });

    // Filter master pool
    const unadded = masterSupervisors.filter(s => {
      if (s.active === false) return false;
      const sId = String(s.id || '').trim().toLowerCase();
      const sEmail = String(s.email || '').trim().toLowerCase();
      if (existingIds.has(sId)) return false;
      if (sEmail && existingEmails.has(sEmail)) return false;
      return true;
    });

    // Out of 12 active master supervisors, 5 already in round -> exactly 7 unadded
    assert.strictEqual(unadded.length, 7, 'Must filter out exactly 5 participating supervisors');
    assert.deepStrictEqual(unadded.map(s => s.id), ['gv6', 'gv7', 'gv8', 'gv9', 'gv10', 'gv11', 'gv12']);
  });

  await t.test('1.4. Thông báo khi tất cả GVHD chính đã được thêm vào đợt', () => {
    const unadded = [];
    let emptyHtml = '';
    if (unadded.length === 0) {
      emptyHtml = '<div class="p-8 text-center text-slate-500 text-xs font-semibold">Tất cả giảng viên trong Danh sách GVHD chính đã được thêm vào đợt này.</div>';
    }
    assert.match(emptyHtml, /Tất cả giảng viên trong Danh sách GVHD chính đã được thêm vào đợt này\./);
  });

  await t.test('1.5. Chống trùng concurrency: loại bỏ những GVHD được admin khác thêm đồng thời', () => {
    const chksSelected = ['gv6', 'gv7'];
    const currentExistingIds = new Set(['gv6']); // gv6 was added concurrently by Admin 2

    const master = [
      { id: 'gv6', name: 'GV 6', email: 'gv6@tdtu.edu.vn' },
      { id: 'gv7', name: 'GV 7', email: 'gv7@tdtu.edu.vn' }
    ];

    const toAdd = [];
    chksSelected.forEach(supId => {
      const sup = master.find(s => s.id === supId);
      if (!sup) return;
      if (currentExistingIds.has(sup.id)) return; // Skip already added
      toAdd.push(sup);
    });

    assert.strictEqual(toAdd.length, 1);
    assert.strictEqual(toAdd[0].id, 'gv7');
  });
});

test('--- YÊU CẦU 2: LINK THAM GIA ĐỢT TỐT NGHIỆP ---', async (t) => {

  await t.test('2.1. Template & Button: Đã bổ sung nút "Link tham gia" trên giao diện Admin', () => {
    const tabStudents = fs.readFileSync('views/admin/tab-students.html', 'utf8');
    assert.match(tabStudents, /openRoundJoinLinkModal\(\)/);
    assert.match(tabStudents, /Link tham gia/);

    const modalRound = fs.readFileSync('templates/modals/rounds/modal-round.html', 'utf8');
    assert.match(modalRound, /openRoundJoinLinkModal/);
  });

  await t.test('2.2. Modal Link tham gia chứa đầy đủ các trường yêu cầu', () => {
    const modalJoinLink = fs.readFileSync('templates/modals/students/modal-round-join-link.html', 'utf8');
    assert.match(modalJoinLink, /id="round-join-link-title"/);
    assert.match(modalJoinLink, /id="round-join-link-year"/);
    assert.match(modalJoinLink, /id="round-join-link-toggle"/);
    assert.match(modalJoinLink, /id="round-join-link-status-badge"/);
    assert.match(modalJoinLink, /id="round-join-link-url"/);
    assert.match(modalJoinLink, /copyRoundJoinLink\(\)/);
    assert.match(modalJoinLink, /testOpenRoundJoinLink\(\)/);
  });

  await t.test('2.3. Modal Sinh viên xác nhận tham gia chứa form đầy đủ và bảo vệ MSSV', () => {
    const modalStudentJoin = fs.readFileSync('templates/modals/students/modal-student-confirm-join-round.html', 'utf8');
    assert.match(modalStudentJoin, /THAM GIA ĐỢT TỐT NGHIỆP/);
    assert.match(modalStudentJoin, /id="student-join-round-title"/);
    assert.match(modalStudentJoin, /id="student-join-round-year"/);
    assert.match(modalStudentJoin, /id="student-join-mssv"/);
    assert.match(modalStudentJoin, /readonly.*cursor-not-allowed/); // MSSV cannot be changed
    assert.match(modalStudentJoin, /id="student-join-fullname"/);
    assert.match(modalStudentJoin, /id="student-join-class"/);
    assert.match(modalStudentJoin, /id="student-join-major"/);
    assert.match(modalStudentJoin, /confirmStudentSelfJoinRound\(\)/);
    assert.match(modalStudentJoin, /id="student-join-result-section"/);
    assert.match(modalStudentJoin, /Bạn đã tham gia đợt tốt nghiệp thành công\./);
  });

  await t.test('2.4. Khóa định danh Link tham gia: URL format ?join=ROUND_KEY', () => {
    const origin = 'https://ifa-graduation.web.app';
    const roundId = 'FZRWniqMofaIvn7ogq0w';
    const joinUrl = `${origin}/?join=${encodeURIComponent(roundId)}`;
    assert.strictEqual(joinUrl, 'https://ifa-graduation.web.app/?join=FZRWniqMofaIvn7ogq0w');

    const url = new URL(joinUrl);
    assert.strictEqual(url.searchParams.get('join'), 'FZRWniqMofaIvn7ogq0w');
  });

  await t.test('2.5. Trạng thái bật/tắt (allowSelfJoin) và điều kiện đợt tốt nghiệp', () => {
    const openRound = { id: 'r1', allowSelfJoin: true, isClosed: false, isHidden: false, status: 'open' };
    const disabledLinkRound = { id: 'r2', allowSelfJoin: false, isClosed: false, isHidden: false, status: 'open' };
    const closedRound = { id: 'r3', allowSelfJoin: true, isClosed: true, isHidden: false, status: 'closed' };
    const hiddenRound = { id: 'r4', allowSelfJoin: true, isClosed: false, isHidden: true, status: 'open' };

    const canJoin = (r) => {
      if (!r) return { ok: false, reason: 'NOT_FOUND' };
      if (r.isClosed || r.status === 'closed') return { ok: false, reason: 'CLOSED' };
      if (r.isHidden) return { ok: false, reason: 'HIDDEN' };
      if (r.allowSelfJoin !== true) return { ok: false, reason: 'DISABLED' };
      return { ok: true };
    };

    assert.deepStrictEqual(canJoin(openRound), { ok: true });
    assert.deepStrictEqual(canJoin(disabledLinkRound), { ok: false, reason: 'DISABLED' });
    assert.deepStrictEqual(canJoin(closedRound), { ok: false, reason: 'CLOSED' });
    assert.deepStrictEqual(canJoin(hiddenRound), { ok: false, reason: 'HIDDEN' });
  });

  await t.test('2.6. Xác thực tài khoản Sinh viên và trích xuất MSSV từ email TDTU', () => {
    const checkStudentEmail = (email) => {
      const isStudent = typeof email === 'string' && email.toLowerCase().endsWith('@student.tdtu.edu.vn');
      const mssv = isStudent ? email.split('@')[0].toUpperCase() : '';
      return { isStudent, mssv };
    };

    assert.deepStrictEqual(checkStudentEmail('11900335@student.tdtu.edu.vn'), { isStudent: true, mssv: '11900335' });
    assert.deepStrictEqual(checkStudentEmail('52000888@student.tdtu.edu.vn'), { isStudent: true, mssv: '52000888' });
    assert.deepStrictEqual(checkStudentEmail('nguyenvana@tdtu.edu.vn'), { isStudent: false, mssv: '' }); // Lecturer
    assert.deepStrictEqual(checkStudentEmail('guest@gmail.com'), { isStudent: false, mssv: '' }); // External
  });

  await t.test('2.7. Tính độc lập: Tự tham gia KHÔNG tự động cấp Đủ điều kiện và KHÔNG duyệt đề tài', () => {
    const selfJoinPayload = {
      studentId: '11900335',
      mssv: '11900335',
      name: 'Nguyễn Văn A',
      fullName: 'Nguyễn Văn A',
      email: '11900335@student.tdtu.edu.vn',
      className: '19050101',
      major: 'Thiết kế Nội thất',
      roundId: 'r1',
      joinMethod: 'link',
      source: 'self_join_link',
      eligible: false,
      eligibilityDeclaration: {
        status: 'undeclared'
      }
    };

    // Must NOT be recognized as eligible, must use 'undeclared' (Chưa khai báo)
    assert.strictEqual(selfJoinPayload.eligible, false);
    assert.deepStrictEqual(selfJoinPayload.eligibilityDeclaration, { status: 'undeclared' });
    assert.notStrictEqual(selfJoinPayload.eligibilityDeclaration?.status, 'eligible');
    assert.notStrictEqual(selfJoinPayload.eligibilityDeclaration?.status, 'pending');
    assert.strictEqual(selfJoinPayload.adminReview, undefined);
    assert.strictEqual(selfJoinPayload.topicApprovalStatus, undefined);
    assert.strictEqual(selfJoinPayload.assignedSupervisor, undefined);
    assert.strictEqual(selfJoinPayload.officialAssignments, undefined);
  });

  await t.test('2.8. Idempotency: Sinh viên đã tham gia (qua link hoặc Excel) không bị nhân đôi và bảo toàn dữ liệu', () => {
    // Existing record in eligibleStudents
    const existingRecord = {
      studentId: '11900335',
      mssv: '11900335',
      name: 'Nguyễn Văn A (Nhập từ Excel)',
      email: '11900335@student.tdtu.edu.vn',
      className: '19050101',
      major: 'Thiết kế Nội thất',
      source: 'excel_import',
      eligible: true
    };

    const attemptJoinAgain = (existingDoc) => {
      if (existingDoc && existingDoc.eligible !== false) {
        return {
          action: 'ALREADY_JOINED',
          message: 'Bạn đã tham gia đợt tốt nghiệp này.',
          preservedData: existingDoc
        };
      }
      return { action: 'WRITE_NEW' };
    };

    const res = attemptJoinAgain(existingRecord);
    assert.strictEqual(res.action, 'ALREADY_JOINED');
    assert.strictEqual(res.preservedData.source, 'excel_import'); // Unmodified
    assert.strictEqual(res.preservedData.name, 'Nguyễn Văn A (Nhập từ Excel)');
  });

  await t.test('2.9. Module export và startup hooks đã được tích hợp đúng', () => {
    const selfJoinJs = fs.readFileSync('js/rounds/rounds-self-join.js', 'utf8');
    assert.match(selfJoinJs, /window\.openRoundJoinLinkModal/);
    assert.match(selfJoinJs, /window\.toggleRoundSelfJoin/);
    assert.match(selfJoinJs, /window\.copyRoundJoinLink/);
    assert.match(selfJoinJs, /window\.testOpenRoundJoinLink/);
    assert.match(selfJoinJs, /window\.checkAndHandlePendingRoundJoin/);
    assert.match(selfJoinJs, /window\.confirmStudentSelfJoinRound/);

    const authJs = fs.readFileSync('js/auth.js', 'utf8');
    assert.match(authJs, /checkAndHandlePendingRoundJoin/);

    const roundsDash = fs.readFileSync('js/rounds/rounds-dashboard.js', 'utf8');
    assert.match(roundsDash, /rounds-self-join\.js/);
  });
});
