import test from 'node:test';
import assert from 'node:assert/strict';

test('STUDENT MANDATORY 3 PREFERENCES - CLIENT VALIDATION & LOGIC SUITE', async (t) => {
  // Mock supervisors available in round
  const roundSupervisors = [
    { id: 'sup_1', name: 'ThS. KTS. Phan Bảo Cường', department: 'Thiết kế nội thất' },
    { id: 'sup_2', name: 'TS. KTS. Nguyễn Minh Hiếu', department: 'Thiết kế nội thất' },
    { id: 'sup_3', name: 'ThS. NCS. Hoàng Lê Duy', department: 'Thiết kế nội thất' },
    { id: 'sup_4', name: 'ThS. NCS. Trần Quang Hải', department: 'Thiết kế nội thất' },
    { id: 'sup_5', name: 'ThS. KTS. Nguyễn Tăng Quang', department: 'Thiết kế nội thất' }
  ];

  function validateStudentPreferences(selectedPreferences, roundSupervisorsList, isDirectAssignment = false, legacyCount = 0) {
    if (isDirectAssignment) {
      return { valid: true, error: null };
    }

    const count = (selectedPreferences || []).length;
    if (legacyCount > 0) {
      if (count < legacyCount) {
        return { valid: false, error: `Hồ sơ đã nộp của bạn có ${legacyCount} nguyện vọng. Không được giảm số nguyện vọng đã đăng ký.` };
      }
      if (count === 0) {
        return { valid: false, error: 'Vui lòng chọn ít nhất 1 nguyện vọng giảng viên hướng dẫn trước khi tiếp tục.' };
      }
    } else {
      if (count === 0) {
        return { valid: false, error: 'Vui lòng chọn đầy đủ 3 nguyện vọng giảng viên hướng dẫn trước khi tiếp tục.' };
      }
      if (count < 3) {
        return { valid: false, error: `Bạn hiện mới chọn ${count}/3 nguyện vọng. Bắt buộc phải chọn đủ 3 giảng viên hướng dẫn khác nhau trước khi tiếp tục.` };
      }
    }

    if (count > 3) {
      return { valid: false, error: 'Chỉ được chọn tối đa 3 nguyện vọng giảng viên hướng dẫn.' };
    }

    const supervisorIds = selectedPreferences.map(p => p.supervisorId).filter(Boolean);
    const uniqueIds = new Set(supervisorIds);
    if (uniqueIds.size !== count || supervisorIds.length !== count) {
      return { valid: false, error: 'Mỗi giảng viên hướng dẫn chỉ được chọn ở một nguyện vọng. Vui lòng chọn đúng các giảng viên khác nhau.' };
    }

    if (Array.isArray(roundSupervisorsList) && roundSupervisorsList.length > 0) {
      const roundSupIds = new Set(roundSupervisorsList.map(s => String(s.id || s.supervisorId || s.email || '').toLowerCase()));
      const invalidSup = selectedPreferences.find(p => {
        const id = String(p.supervisorId || '').toLowerCase();
        return !roundSupIds.has(id);
      });
      if (invalidSup) {
        return { valid: false, error: `Giảng viên "${invalidSup.supervisorName || invalidSup.supervisorId}" không thuộc danh sách hướng dẫn của đợt này.` };
      }
    }

    // Return normalized sorted preferences with ranks 1..count
    const normalized = [...selectedPreferences]
      .sort((a, b) => Number(a.rank) - Number(b.rank))
      .map((p, idx) => ({
        rank: idx + 1,
        supervisorId: p.supervisorId,
        supervisorName: p.supervisorName || '',
        department: p.department || ''
      }));

    return { valid: true, error: null, normalized };
  }

  await t.test('1. Chặn khi không chọn nguyện vọng nào (0/3)', () => {
    const res = validateStudentPreferences([], roundSupervisors);
    assert.equal(res.valid, false);
    assert.match(res.error, /đầy đủ 3 nguyện vọng/);
  });

  await t.test('2. Chặn khi chỉ chọn 1 nguyện vọng (1/3)', () => {
    const prefs = [{ rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' }];
    const res = validateStudentPreferences(prefs, roundSupervisors);
    assert.equal(res.valid, false);
    assert.match(res.error, /1\/3/);
  });

  await t.test('3. Chặn khi chỉ chọn 2 nguyện vọng (2/3)', () => {
    const prefs = [
      { rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 2, supervisorId: 'sup_2', supervisorName: 'Nguyễn Minh Hiếu' }
    ];
    const res = validateStudentPreferences(prefs, roundSupervisors);
    assert.equal(res.valid, false);
    assert.match(res.error, /2\/3/);
  });

  await t.test('4. Chặn khi chọn trùng giảng viên giữa các nguyện vọng (NV1 trùng NV2)', () => {
    const prefs = [
      { rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 2, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 3, supervisorId: 'sup_3', supervisorName: 'Hoàng Lê Duy' }
    ];
    const res = validateStudentPreferences(prefs, roundSupervisors);
    assert.equal(res.valid, false);
    assert.match(res.error, /chỉ được chọn ở một nguyện vọng/);
  });

  await t.test('5. Chặn khi chọn trùng giảng viên giữa các nguyện vọng (NV2 trùng NV3)', () => {
    const prefs = [
      { rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 2, supervisorId: 'sup_2', supervisorName: 'Nguyễn Minh Hiếu' },
      { rank: 3, supervisorId: 'sup_2', supervisorName: 'Nguyễn Minh Hiếu' }
    ];
    const res = validateStudentPreferences(prefs, roundSupervisors);
    assert.equal(res.valid, false);
    assert.match(res.error, /chỉ được chọn ở một nguyện vọng/);
  });

  await t.test('6. Chặn khi chọn giảng viên không thuộc đợt', () => {
    const prefs = [
      { rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 2, supervisorId: 'sup_2', supervisorName: 'Nguyễn Minh Hiếu' },
      { rank: 3, supervisorId: 'sup_unknown_99', supervisorName: 'Giảng viên Lạ' }
    ];
    const res = validateStudentPreferences(prefs, roundSupervisors);
    assert.equal(res.valid, false);
    assert.match(res.error, /không thuộc danh sách hướng dẫn/);
  });

  await t.test('7. Thành công khi chọn ĐỦ 3 nguyện vọng với 3 GVHD khác nhau thuộc đợt', () => {
    const prefs = [
      { rank: 3, supervisorId: 'sup_3', supervisorName: 'Hoàng Lê Duy' },
      { rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 2, supervisorId: 'sup_2', supervisorName: 'Nguyễn Minh Hiếu' }
    ];
    const res = validateStudentPreferences(prefs, roundSupervisors);
    assert.equal(res.valid, true);
    assert.equal(res.normalized.length, 3);
    assert.equal(res.normalized[0].rank, 1);
    assert.equal(res.normalized[0].supervisorId, 'sup_1');
    assert.equal(res.normalized[1].rank, 2);
    assert.equal(res.normalized[1].supervisorId, 'sup_2');
    assert.equal(res.normalized[2].rank, 3);
    assert.equal(res.normalized[2].supervisorId, 'sup_3');
  });

  await t.test('8. Đợt phân công trực tiếp (direct_assignment): cho phép preferences rỗng', () => {
    const res = validateStudentPreferences([], roundSupervisors, true);
    assert.equal(res.valid, true);
    assert.equal(res.error, null);
  });

  await t.test('9. Hồ sơ cũ có 1 NV: giữ nguyên 1 NV -> HỢP LỆ (PASS)', () => {
    const prefs = [{ rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' }];
    const res = validateStudentPreferences(prefs, roundSupervisors, false, 1);
    assert.equal(res.valid, true);
    assert.equal(res.normalized.length, 1);
    assert.equal(res.normalized[0].rank, 1);
    assert.equal(res.normalized[0].supervisorId, 'sup_1');
  });

  await t.test('10. Hồ sơ cũ có 2 NV: giữ nguyên 2 NV -> HỢP LỆ (PASS)', () => {
    const prefs = [
      { rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 2, supervisorId: 'sup_2', supervisorName: 'Nguyễn Minh Hiếu' }
    ];
    const res = validateStudentPreferences(prefs, roundSupervisors, false, 2);
    assert.equal(res.valid, true);
    assert.equal(res.normalized.length, 2);
    assert.equal(res.normalized[0].rank, 1);
    assert.equal(res.normalized[1].rank, 2);
  });

  await t.test('11. Hồ sơ cũ có 1 NV: nâng lên 2 NV (2 GVHD khác nhau) -> HỢP LỆ (PASS)', () => {
    const prefs = [
      { rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 2, supervisorId: 'sup_3', supervisorName: 'Hoàng Lê Duy' }
    ];
    const res = validateStudentPreferences(prefs, roundSupervisors, false, 1);
    assert.equal(res.valid, true);
    assert.equal(res.normalized.length, 2);
  });

  await t.test('12. Hồ sơ cũ có 1 NV hoặc 2 NV: nâng lên đủ 3 NV (3 GVHD khác nhau) -> HỢP LỆ (PASS)', () => {
    const prefs = [
      { rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 2, supervisorId: 'sup_2', supervisorName: 'Nguyễn Minh Hiếu' },
      { rank: 3, supervisorId: 'sup_3', supervisorName: 'Hoàng Lê Duy' }
    ];
    const res = validateStudentPreferences(prefs, roundSupervisors, false, 2);
    assert.equal(res.valid, true);
    assert.equal(res.normalized.length, 3);
  });

  await t.test('13. Hồ sơ cũ có 2 NV: cố tình giảm còn 1 NV -> BỊ CHẶN (DENIED)', () => {
    const prefs = [{ rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' }];
    const res = validateStudentPreferences(prefs, roundSupervisors, false, 2);
    assert.equal(res.valid, false);
    assert.match(res.error, /Không được giảm số nguyện vọng/);
  });

  await t.test('14. Hồ sơ cũ có 1 NV: cố tình xóa hết còn 0 NV -> BỊ CHẶN (DENIED)', () => {
    const res = validateStudentPreferences([], roundSupervisors, false, 1);
    assert.equal(res.valid, false);
    assert.match(res.error, /Không được giảm số nguyện vọng/);
  });

  await t.test('15. Hồ sơ cũ có 1 NV: nâng lên 2 NV nhưng trùng GVHD -> BỊ CHẶN (DENIED)', () => {
    const prefs = [
      { rank: 1, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' },
      { rank: 2, supervisorId: 'sup_1', supervisorName: 'Phan Bảo Cường' }
    ];
    const res = validateStudentPreferences(prefs, roundSupervisors, false, 1);
    assert.equal(res.valid, false);
    assert.match(res.error, /chỉ được chọn ở một nguyện vọng/);
  });
});
