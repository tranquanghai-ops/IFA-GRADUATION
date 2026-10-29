import { test } from 'node:test';
import assert from 'node:assert/strict';

// Setup minimal browser mocks for Node test runner
globalThis.window = globalThis;
globalThis.document = {
  readyState: 'complete',
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null
};
globalThis.state = { supervisorsMaster: [] };
globalThis.showLoading = () => {};
globalThis.hideLoading = () => {};
globalThis.showToast = () => {};
globalThis.escapeHtml = (s) => s;
globalThis.auth = null;

const { findMatchingSupervisorProfile, evaluateAccountDomainAndRole } = await import('../js/auth.js');

test('--- IFA-GRADUATION AUTH & VISITING SUPERVISOR UNIT TESTS ---', async (t) => {
  const mockSupervisorMaster = [
    {
      id: 'sup_tdtu_01',
      name: 'TS. Lê Văn TDTU',
      email: 'gv1@tdtu.edu.vn',
      active: true,
      employmentType: 'internal'
    },
    {
      id: 'sup_visiting_01',
      name: 'ThS. Nguyễn Tăng Quang',
      email: 'quang.nguyen@gmail.com',
      personalEmail: 'quang.nguyen@gmail.com',
      active: true,
      status: 'active',
      employmentType: 'adjunct',
      defaultQuota: 5
    },
    {
      id: 'sup_visiting_02',
      name: 'Chuyên gia Trần Văn B',
      email: 'thinhgiang@outlook.com',
      institutionalEmail: 'thinhgiang@outlook.com',
      active: true,
      employmentType: 'adjunct',
      defaultQuota: 5
    },
    {
      id: 'sup_visiting_inactive',
      name: 'GV Cũ Ngừng Công Tác',
      email: 'inactive.gv@gmail.com',
      active: false,
      status: 'disabled',
      employmentType: 'adjunct'
    },
    {
      id: 'sup_visiting_revoked',
      name: 'GV Bị Thu Hồi Quyền',
      email: 'revoked.gv@gmail.com',
      active: true,
      status: 'revoked',
      employmentType: 'adjunct'
    }
  ];

  await t.test('Trường hợp A: GVHD TDTU hợp lệ (@tdtu.edu.vn)', () => {
    const res = evaluateAccountDomainAndRole('gv1@tdtu.edu.vn', mockSupervisorMaster);
    assert.equal(res.isValid, true);
    assert.equal(res.accountType, 'supervisor');
    assert.equal(res.isSupervisor, true);
    assert.equal(res.isVisitingSupervisor, false);
    assert.equal(res.supervisorProfile?.id, 'sup_tdtu_01');
  });

  await t.test('Trường hợp B: GVHD thỉnh giảng Gmail khai báo trong supervisorMaster (quang.nguyen@gmail.com)', () => {
    // Normal case with lowercase
    const res = evaluateAccountDomainAndRole('quang.nguyen@gmail.com', mockSupervisorMaster);
    assert.equal(res.isValid, true);
    assert.equal(res.accountType, 'supervisor');
    assert.equal(res.isSupervisor, true);
    assert.equal(res.isVisitingSupervisor, true);
    assert.equal(res.supervisorProfile?.name, 'ThS. Nguyễn Tăng Quang');

    // Case insensitive & leading/trailing whitespace
    const resWhitespace = evaluateAccountDomainAndRole('  Quang.Nguyen@Gmail.COM  ', mockSupervisorMaster);
    assert.equal(resWhitespace.isValid, true);
    assert.equal(resWhitespace.isSupervisor, true);
    assert.equal(resWhitespace.isVisitingSupervisor, true);
  });

  await t.test('Trường hợp C: GVHD thỉnh giảng email Outlook khai báo trong supervisorMaster (thinhgiang@outlook.com)', () => {
    const res = evaluateAccountDomainAndRole('thinhgiang@outlook.com', mockSupervisorMaster);
    assert.equal(res.isValid, true);
    assert.equal(res.accountType, 'supervisor');
    assert.equal(res.isSupervisor, true);
    assert.equal(res.isVisitingSupervisor, true);
    assert.equal(res.supervisorProfile?.id, 'sup_visiting_02');
  });

  await t.test('Trường hợp D: Gmail cá nhân của người ngoài CHƯA ĐƯỢC KHAI BÁO (stranger@gmail.com)', () => {
    const res = evaluateAccountDomainAndRole('stranger@gmail.com', mockSupervisorMaster);
    assert.equal(res.isValid, false);
    assert.equal(res.reason, 'personal_email');
    assert.match(res.message, /Email cá nhân không được phép sử dụng/);
  });

  await t.test('Trường hợp E: Gmail cá nhân cố tình dùng MSSV (11900335@gmail.com) KHÔNG ĐƯỢC nhận vai trò sinh viên', () => {
    const res = evaluateAccountDomainAndRole('11900335@gmail.com', mockSupervisorMaster);
    assert.equal(res.isValid, false);
    assert.notEqual(res.accountType, 'student');
    assert.equal(res.reason, 'personal_email');
  });

  await t.test('Trường hợp F: Typo / Homoglyph attack (quang.nguyen1@gmail.com / quang_nguyen@gmail.com)', () => {
    const res1 = evaluateAccountDomainAndRole('quang.nguyen1@gmail.com', mockSupervisorMaster);
    assert.equal(res1.isValid, false);
    assert.equal(res1.reason, 'personal_email');

    const res2 = evaluateAccountDomainAndRole('quang_nguyen@gmail.com', mockSupervisorMaster);
    assert.equal(res2.isValid, false);
    assert.equal(res2.reason, 'personal_email');
  });

  await t.test('Trường hợp G: GVHD thỉnh giảng bị đổi active: false hoặc status: revoked/disabled', () => {
    const resInactive = evaluateAccountDomainAndRole('inactive.gv@gmail.com', mockSupervisorMaster);
    assert.equal(resInactive.isValid, false);
    assert.equal(resInactive.reason, 'personal_email');

    const resRevoked = evaluateAccountDomainAndRole('revoked.gv@gmail.com', mockSupervisorMaster);
    assert.equal(resRevoked.isValid, false);
    assert.equal(resRevoked.reason, 'personal_email');
  });

  await t.test('Trường hợp J: Sinh viên TDTU chính quy (MSSV@student.tdtu.edu.vn)', () => {
    const res = evaluateAccountDomainAndRole('11900335@student.tdtu.edu.vn', mockSupervisorMaster);
    assert.equal(res.isValid, true);
    assert.equal(res.accountType, 'student');
    assert.equal(res.mssv, '11900335');
  });

  await t.test('Trường hợp Owner / Root Admin (tranquanghai@tdtu.edu.vn)', () => {
    const res = evaluateAccountDomainAndRole('tranquanghai@tdtu.edu.vn', mockSupervisorMaster);
    assert.equal(res.isValid, true);
    assert.equal(res.isOwner, true);
    assert.equal(res.isAdmin, true);
  });
});
