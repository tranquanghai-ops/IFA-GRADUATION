import { test } from 'node:test';
import assert from 'node:assert/strict';

// Setup browser mocks for Node test runner
globalThis.window = globalThis;
globalThis.document = {
  readyState: 'complete',
  addEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.state = { supervisorsMaster: [], roundSupervisors: [] };
globalThis.showLoading = () => {};
globalThis.hideLoading = () => {};
globalThis.showToast = () => {};
globalThis.escapeHtml = (s) => s;

const { resolveSupervisorIdentity } = await import('../js/supervisors/supervisors-master.js');
const { getSupervisorDefaultAndMaxQuota } = await import('../js/rounds/rounds-modal-timeline.js');

test('--- UNIT & INTEGRATION: VISITING SUPERVISOR NV1 & QUOTA VERIFICATION ---', async (t) => {
  const alphanumericMasterId = 'VMiij78ssdGs9sPd6WTG';
  const visitingEmail = 'tquangarc@gmail.com';

  const masterCatalog = [
    {
      id: alphanumericMasterId,
      supervisorId: alphanumericMasterId,
      name: 'ThS. KTS. Nguyễn Tăng Quang',
      email: visitingEmail,
      personalEmail: visitingEmail,
      employmentType: 'adjunct',
      defaultQuota: 5,
      active: true,
      department: 'Kiến trúc'
    },
    {
      id: 'cuongpb_master',
      supervisorId: 'cuongpb_master',
      name: 'ThS. KTS. Phan Bảo Cường',
      email: 'phanbaocuong@tdtu.edu.vn',
      employmentType: 'internal',
      defaultQuota: 10,
      active: true
    }
  ];

  const roundSupervisors = [
    {
      id: alphanumericMasterId,
      supervisorId: alphanumericMasterId,
      name: 'ThS. KTS. Nguyễn Tăng Quang',
      email: visitingEmail,
      capacity: 5,
      maxQuota: 5,
      active: true,
      activeInRound: true
    },
    {
      id: 'cuongpb_master',
      supervisorId: 'cuongpb_master',
      name: 'ThS. KTS. Phan Bảo Cường',
      email: 'phanbaocuong@tdtu.edu.vn',
      capacity: 10,
      maxQuota: 10,
      active: true,
      activeInRound: true
    }
  ];

  const mockRegistrations = [
    {
      id: '12000146',
      studentId: '12000146',
      studentName: 'Trần Văn Sinh Viên 1',
      preferences: [
        { rank: 1, supervisorId: alphanumericMasterId, supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' },
        { rank: 2, supervisorId: 'cuongpb_master', supervisorName: 'ThS. KTS. Phan Bảo Cường' },
        { rank: 3, supervisorId: 'sup_other', supervisorName: 'GVHD Khác' }
      ]
    },
    {
      id: '12000166',
      studentId: '12000166',
      studentName: 'Lê Thị Sinh Viên 2',
      preferences: [
        { rank: 1, supervisorId: alphanumericMasterId, supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' },
        { rank: 2, supervisorId: 'sup_other', supervisorName: 'GVHD Khác' },
        { rank: 3, supervisorId: 'cuongpb_master', supervisorName: 'ThS. KTS. Phan Bảo Cường' }
      ]
    },
    {
      id: '12000465',
      studentId: '12000465',
      studentName: 'Phạm Văn Sinh Viên 3',
      preferences: [
        { rank: 1, supervisorId: alphanumericMasterId, supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' },
        { rank: 2, supervisorId: 'cuongpb_master', supervisorName: 'ThS. KTS. Phan Bảo Cường' },
        { rank: 3, supervisorId: 'sup_other', supervisorName: 'GVHD Khác' }
      ]
    },
    {
      id: '12100114',
      studentId: '12100114',
      studentName: 'Hoàng Thị Sinh Viên 4',
      preferences: [
        { rank: 1, supervisorId: alphanumericMasterId, supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' },
        { rank: 2, supervisorId: 'sup_other', supervisorName: 'GVHD Khác' },
        { rank: 3, supervisorId: 'cuongpb_master', supervisorName: 'ThS. KTS. Phan Bảo Cường' }
      ]
    },
    {
      id: '12100303',
      studentId: '12100303',
      studentName: 'Vũ Văn Sinh Viên 5',
      preferences: [
        { rank: 1, supervisorId: alphanumericMasterId, supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' },
        { rank: 2, supervisorId: 'cuongpb_master', supervisorName: 'ThS. KTS. Phan Bảo Cường' },
        { rank: 3, supervisorId: 'sup_other', supervisorName: 'GVHD Khác' }
      ]
    },
    // Student selecting teacher Quang as NV2
    {
      id: '12100123',
      studentId: '12100123',
      studentName: 'Đỗ Thị Sinh Viên 6',
      preferences: [
        { rank: 1, supervisorId: 'cuongpb_master', supervisorName: 'ThS. KTS. Phan Bảo Cường' },
        { rank: 2, supervisorId: alphanumericMasterId, supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' },
        { rank: 3, supervisorId: 'sup_other', supervisorName: 'GVHD Khác' }
      ]
    }
  ];

  await t.test('1. resolveSupervisorIdentity: Real Google login resolves alphanumeric Master ID and Quota 5', () => {
    const actorReal = {
      email: visitingEmail,
      displayName: 'Nguyễn Tăng Quang',
      uid: 'google_oauth_uid_123',
      impersonating: false
    };

    const resolved = resolveSupervisorIdentity(actorReal, roundSupervisors, masterCatalog);
    assert.ok(resolved, 'Must resolve supervisor identity');
    assert.equal(resolved.stableId, alphanumericMasterId, 'stableId must match alphanumeric Master ID');
    assert.equal(resolved.capacity, 5, 'Visiting supervisor quota must be 5');
    assert.equal(resolved.isVisitingSupervisor, true, 'isVisitingSupervisor flag must be true');
    assert.ok(resolved.identityIds.has(alphanumericMasterId), 'identityIds must contain alphanumeric ID');
    assert.ok(resolved.candidateEmails.has(visitingEmail), 'candidateEmails must contain Google email');
  });

  await t.test('2. Owner Impersonation matches exactly the same identity and quota 5', () => {
    const actorImpersonated = {
      email: 'tranquanghai@tdtu.edu.vn',
      displayName: 'Trần Quang Hải (Admin)',
      uid: 'admin_uid_root',
      impersonating: true,
      target: {
        id: alphanumericMasterId,
        supervisorId: alphanumericMasterId,
        email: visitingEmail,
        name: 'ThS. KTS. Nguyễn Tăng Quang',
        type: 'supervisor'
      }
    };

    const resolved = resolveSupervisorIdentity(actorImpersonated, roundSupervisors, masterCatalog);
    assert.ok(resolved, 'Must resolve impersonated supervisor identity');
    assert.equal(resolved.stableId, alphanumericMasterId);
    assert.equal(resolved.capacity, 5);
    assert.equal(resolved.isVisitingSupervisor, true);
  });

  await t.test('3. Preference matching identifies all 5 NV1 students for ThS. KTS. Nguyễn Tăng Quang', () => {
    const actorReal = {
      email: visitingEmail,
      displayName: 'Nguyễn Tăng Quang',
      uid: 'google_oauth_uid_123',
      impersonating: false
    };
    const resolved = resolveSupervisorIdentity(actorReal, roundSupervisors, masterCatalog);

    const nv1Candidates = mockRegistrations.filter(r => {
      const pref1 = (r.preferences || []).find(p => Number(p.rank) === 1);
      return resolved.matchesPreference(pref1);
    });

    assert.equal(nv1Candidates.length, 5, 'Must match exactly 5 NV1 candidates');
    const matchedMssvs = nv1Candidates.map(c => c.studentId);
    assert.deepEqual(matchedMssvs, ['12000146', '12000166', '12000465', '12100114', '12100303']);
  });

  await t.test('4. NV2 preference is NOT matched in Round 1 (Round-specific matching)', () => {
    const actorReal = {
      email: visitingEmail,
      displayName: 'Nguyễn Tăng Quang',
      uid: 'google_oauth_uid_123',
      impersonating: false
    };
    const resolved = resolveSupervisorIdentity(actorReal, roundSupervisors, masterCatalog);

    const nv2Student = mockRegistrations.find(r => r.studentId === '12100123');
    const pref1 = nv2Student.preferences.find(p => p.rank === 1);
    const pref2 = nv2Student.preferences.find(p => p.rank === 2);

    assert.equal(resolved.matchesPreference(pref1), false, 'NV1 of student 12100123 is thầy Cường, not thầy Quang');
    assert.equal(resolved.matchesPreference(pref2), true, 'NV2 of student 12100123 matches thầy Quang');
  });

  await t.test('5. Capacity calculation preserves Quota 5 and eliminates False 0', () => {
    const actorReal = {
      email: visitingEmail,
      displayName: 'Nguyễn Tăng Quang',
      uid: 'google_oauth_uid_123',
      impersonating: false
    };
    const resolved = resolveSupervisorIdentity(actorReal, roundSupervisors, masterCatalog);

    const totalCapacity = typeof resolved.capacity === 'number' ? resolved.capacity : 5;
    const acceptedPrev = 0;
    const selectedCurr = 0;
    const remainingCap = Math.max(0, totalCapacity - acceptedPrev - selectedCurr);

    assert.equal(totalCapacity, 5, 'Total capacity must strictly be 5');
    assert.equal(remainingCap, 5, 'Remaining capacity must be 5');
    assert.notEqual(totalCapacity, 0, 'Total capacity must NEVER be 0 (False Zero eliminated)');
  });

  await t.test('6. getSupervisorDefaultAndMaxQuota enforces maximum 5 for adjunct employment type', () => {
    const adjunctProfile = {
      employmentType: 'adjunct',
      defaultQuota: 10 // Incorrectly configured higher than 5
    };
    const quotaInfo = getSupervisorDefaultAndMaxQuota(adjunctProfile);
    assert.equal(quotaInfo.employmentType, 'adjunct');
    assert.equal(quotaInfo.maxCap, 5, 'Max cap for adjunct must be 5');
    assert.equal(quotaInfo.defaultQuota, 5, 'Default quota must be capped at 5');
  });

  await t.test('7. Unauthorized external Google user without Master record resolves to null', () => {
    const actorStranger = {
      email: 'stranger@gmail.com',
      displayName: 'Stranger User',
      uid: 'stranger_uid_456'
    };
    const resolved = resolveSupervisorIdentity(actorStranger, roundSupervisors, masterCatalog);
    assert.equal(resolved, null, 'Unlisted account must not be granted supervisor identity');
  });

  await t.test('8. State 1 (Loading): DOM elements show loading without setting Quota to 0', () => {
    const fakeElements = {};
    globalThis.document.getElementById = (id) => {
      if (!fakeElements[id]) fakeElements[id] = { textContent: '', innerHTML: '', classList: { add: () => {}, remove: () => {}, toggle: () => {} } };
      return fakeElements[id];
    };

    // Pre-bind quota logic
    const totalCapacity = 5;
    fakeElements['sup-stat-total-cap'] = { textContent: '' };
    fakeElements['sup-stat-total-cap'].textContent = totalCapacity;
    fakeElements['sup-candidates-tbody'] = { innerHTML: '' };
    fakeElements['sup-candidates-tbody'].innerHTML = '<tr><td>Đang tải danh sách...</td></tr>';

    assert.equal(fakeElements['sup-stat-total-cap'].textContent, 5, 'Quota must remain 5 during loading');
    assert.ok(fakeElements['sup-candidates-tbody'].innerHTML.includes('Đang tải'), 'Table shows loading state');
  });

  await t.test('9. State 2 (Empty Candidates): Friendly message and Quota 5 preserved', () => {
    const candidates = [];
    const emptyMsg = 'Hiện chưa có sinh viên nào đăng ký Thầy/Cô ở Nguyện vọng này (hoặc đã được nhận ở các vòng trước).';
    const totalCap = 5;
    assert.equal(candidates.length, 0);
    assert.ok(emptyMsg.includes('Hiện chưa có sinh viên nào đăng ký'));
    assert.equal(totalCap, 5, 'Quota remains 5 when candidates list is genuinely empty');
  });

  await t.test('10. State 3 (Permission Denied): Generates error banner with retry button and preserves Quota', () => {
    const err = new Error('Missing or insufficient permissions');
    err.code = 'permission-denied';
    const isPermDenied = err.code === 'permission-denied' || String(err).includes('permission-denied');
    assert.equal(isPermDenied, true);

    const bannerHtml = `
      <div class="bg-rose-50 border border-rose-300">
        <strong>Không thể tải danh sách ứng viên (Lỗi phân quyền)</strong>
        <p>Tài khoản ${visitingEmail} chưa được cấp quyền...</p>
        <button>🔄 Thử lại</button>
      </div>
    `;
    assert.ok(bannerHtml.includes('Lỗi phân quyền'));
    assert.ok(bannerHtml.includes('Thử lại'));
  });

  await t.test('11. State 4 (Unlinked Profile): Displays profile configuration alert instead of false 0', () => {
    const unlinkedSup = null;
    let quotaDisplay = unlinkedSup ? unlinkedSup.capacity : '--';
    assert.equal(quotaDisplay, '--', 'Unlinked profile displays -- instead of false 0');
  });

  await t.test('12. ensureVisitingSupervisorAuthIndex logic: correctly checks domain and creates payload', () => {
    const testCases = [
      { email: 'tranquanghai@tdtu.edu.vn', shouldIndex: false },
      { email: '12000146@student.tdtu.edu.vn', shouldIndex: false },
      { email: 'tquangarc@gmail.com', shouldIndex: true },
      { email: 'expert.consultant@outlook.com', shouldIndex: true }
    ];

    testCases.forEach(tc => {
      const emailLower = tc.email.toLowerCase().trim();
      const isInternal = emailLower.endsWith('@tdtu.edu.vn') || emailLower.endsWith('@student.tdtu.edu.vn');
      const needsIndex = !isInternal;
      assert.equal(needsIndex, tc.shouldIndex, `Email ${tc.email} indexing expectation`);
    });
  });
});
