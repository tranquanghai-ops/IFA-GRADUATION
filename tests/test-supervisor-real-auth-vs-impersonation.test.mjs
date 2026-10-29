import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Setup browser mocks for Node test runner
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

const { resolveSupervisorIdentity } = await import('../js/supervisors/supervisors-master.js');

describe('--- RESOLVE SUPERVISOR IDENTITY & EQUIVALENCE TESTS ---', () => {
  const masterCatalog = [
    {
      id: 'SZ5gSix1l0BZs0NLkkjU',
      name: 'ThS. KTS. Phan Bảo Cường',
      email: 'phanbaocuong@tdtu.edu.vn',
      defaultQuota: 10,
      active: true,
      employmentType: 'internal'
    },
    {
      id: 'VMiij78ssdGs9sPd6WTG',
      name: 'ThS. KTS. Nguyễn Tăng Quang',
      email: 'tquangarc@gmail.com',
      personalEmail: 'tquangarc@gmail.com',
      defaultQuota: 5,
      active: true,
      employmentType: 'adjunct'
    },
    {
      id: 'rsyOJ7pZB6joEwZrBp3d',
      name: 'ThS. Nguyễn Minh Hiếu',
      email: 'tg_nguyenminhhieu1@tdtu.edu.vn',
      emails: ['tg_nguyenminhhieu1@tdtu.edu.vn', 'hieunguyen.3012nt@gmail.com'],
      defaultQuota: 10,
      active: true,
      employmentType: 'internal'
    },
    {
      id: 'revoked_id',
      name: 'GV Bị Thu Hồi',
      email: 'revoked@tdtu.edu.vn',
      active: false,
      status: 'revoked'
    }
  ];

  const roundSupervisors = [
    {
      id: 'SZ5gSix1l0BZs0NLkkjU',
      supervisorId: 'SZ5gSix1l0BZs0NLkkjU',
      email: 'phanbaocuong@tdtu.edu.vn',
      name: 'ThS. KTS. Phan Bảo Cường',
      maxQuota: 10, // Note: Production stores maxQuota without capacity field!
      active: true
    },
    {
      id: 'VMiij78ssdGs9sPd6WTG',
      supervisorId: 'VMiij78ssdGs9sPd6WTG',
      email: 'tquangarc@gmail.com',
      name: 'ThS. KTS. Nguyễn Tăng Quang',
      capacity: 5,
      active: true
    }
  ];

  test('Trường hợp 1: GVHD Phan Bảo Cường đăng nhập bằng tài khoản Google thật', () => {
    const actorReal = {
      uid: 'google_oauth_uid_pbc_12345',
      email: 'phanbaocuong@tdtu.edu.vn',
      displayName: 'Phan Bảo Cường',
      impersonating: false
    };

    const identity = resolveSupervisorIdentity(actorReal, roundSupervisors, masterCatalog);
    assert.ok(identity, 'Identity must be resolved');
    assert.equal(identity.id, 'SZ5gSix1l0BZs0NLkkjU');
    assert.equal(identity.supervisorId, 'SZ5gSix1l0BZs0NLkkjU');
    assert.equal(identity.email, 'phanbaocuong@tdtu.edu.vn');
    assert.equal(identity.name, 'ThS. KTS. Phan Bảo Cường');
    assert.equal(identity.capacity, 10, 'Quota must be resolved to 10 from maxQuota/master');
    assert.equal(identity.activeInRound, true);
    assert.equal(identity.isVisitingSupervisor, false);

    // Check preference matching
    assert.ok(identity.matchesPreference({ supervisorId: 'SZ5gSix1l0BZs0NLkkjU' }));
    assert.ok(identity.matchesPreference({ supervisorEmail: 'phanbaocuong@tdtu.edu.vn' }));
    assert.ok(!identity.matchesPreference({ supervisorId: 'other_id' }));
  });

  test('Trường hợp 2: Owner đóng vai GVHD Phan Bảo Cường', () => {
    const actorImpersonate = {
      uid: 'SZ5gSix1l0BZs0NLkkjU',
      email: 'phanbaocuong@tdtu.edu.vn',
      displayName: 'ThS. KTS. Phan Bảo Cường',
      impersonating: true
    };

    const identity = resolveSupervisorIdentity(actorImpersonate, roundSupervisors, masterCatalog);
    assert.ok(identity, 'Identity must be resolved');
    assert.equal(identity.id, 'SZ5gSix1l0BZs0NLkkjU');
    assert.equal(identity.supervisorId, 'SZ5gSix1l0BZs0NLkkjU');
    assert.equal(identity.email, 'phanbaocuong@tdtu.edu.vn');
    assert.equal(identity.name, 'ThS. KTS. Phan Bảo Cường');
    assert.equal(identity.capacity, 10);
    assert.equal(identity.activeInRound, true);
  });

  test('Trường hợp 3: Đối chiếu tương đương tuyệt đối giữa Tài khoản thật và Owner đóng vai', () => {
    const actorReal = {
      uid: 'google_random_uid_9999',
      email: 'PHANBAOCUONG@tdtu.edu.vn ', // test whitespace & uppercase tolerance
      impersonating: false
    };
    const actorImpersonate = {
      uid: 'SZ5gSix1l0BZs0NLkkjU',
      email: 'phanbaocuong@tdtu.edu.vn',
      impersonating: true
    };

    const idReal = resolveSupervisorIdentity(actorReal, roundSupervisors, masterCatalog);
    const idImp = resolveSupervisorIdentity(actorImpersonate, roundSupervisors, masterCatalog);

    assert.equal(idReal.id, idImp.id);
    assert.equal(idReal.supervisorId, idImp.supervisorId);
    assert.equal(idReal.capacity, idImp.capacity);
    assert.equal(idReal.name, idImp.name);
    assert.equal(idReal.activeInRound, idImp.activeInRound);
  });

  test('Trường hợp 4: GVHD thỉnh giảng email ngoài TDTU (tquangarc@gmail.com)', () => {
    const actorVisiting = {
      uid: 'google_uid_visiting_777',
      email: 'tquangarc@gmail.com',
      impersonating: false
    };

    const identity = resolveSupervisorIdentity(actorVisiting, roundSupervisors, masterCatalog);
    assert.ok(identity);
    assert.equal(identity.id, 'VMiij78ssdGs9sPd6WTG');
    assert.equal(identity.isVisitingSupervisor, true);
    assert.equal(identity.capacity, 5);
  });

  test('Trường hợp 5: GVHD sử dụng email phụ trong mảng emails (hieunguyen.3012nt@gmail.com)', () => {
    const actorAlt = {
      uid: 'google_uid_alt_333',
      email: 'hieunguyen.3012nt@gmail.com',
      impersonating: false
    };

    const identity = resolveSupervisorIdentity(actorAlt, roundSupervisors, masterCatalog);
    assert.ok(identity);
    assert.equal(identity.id, 'rsyOJ7pZB6joEwZrBp3d');
    assert.equal(identity.name, 'ThS. Nguyễn Minh Hiếu');
    assert.equal(identity.activeInRound, false, 'Not in this round roster');
  });

  test('Trường hợp 6: Tài khoản người ngoài chưa khai báo (stranger@gmail.com) -> Từ chối', () => {
    const actorStranger = {
      uid: 'stranger_uid',
      email: 'stranger@gmail.com',
      impersonating: false
    };

    const identity = resolveSupervisorIdentity(actorStranger, roundSupervisors, masterCatalog);
    assert.equal(identity, null, 'Must reject unlisted stranger');
  });

  test('Trường hợp 7: Tài khoản thật cố tình giả mạo uid của GVHD khác nhưng email không khớp -> Bị chặn', () => {
    const actorHijack = {
      uid: 'SZ5gSix1l0BZs0NLkkjU', // attempts to forge PBC's ID
      email: 'imposter@student.tdtu.edu.vn',
      impersonating: false // real login, not owner impersonation
    };

    const identity = resolveSupervisorIdentity(actorHijack, roundSupervisors, masterCatalog);
    assert.equal(identity, null, 'Must reject identity hijacking on real login');
  });

  test('Trường hợp 8: GVHD bị thu hồi (status: revoked / active: false) -> Bị chặn', () => {
    const actorRevoked = {
      uid: 'revoked_uid',
      email: 'revoked@tdtu.edu.vn',
      impersonating: false
    };

    const identity = resolveSupervisorIdentity(actorRevoked, roundSupervisors, masterCatalog);
    assert.equal(identity, null, 'Must reject revoked supervisor');
  });
});
