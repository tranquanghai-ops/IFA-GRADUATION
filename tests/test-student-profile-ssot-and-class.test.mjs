import test from 'node:test';
import assert from 'node:assert/strict';

// Set up mock window, state and globals BEFORE dynamic imports
globalThis.window = globalThis;
globalThis.state = {
  facultyDatasetMeta: null,
  facultyStudents: [],
  facultyStudentsMap: new Map(),
  eligibleStudents: [],
  myRegistration: null,
  myOfficialAssignment: null,
  adminReviewData: {
    registrations: [],
    eligible: [],
    officialAssignments: []
  },
  roundSupervisors: [],
  supervisorsMaster: []
};

// Dynamic imports after globals are initialized
const { resolveStudentProfile } = await import('../js/students/students-master.js');
const { normalizeOfficialAssignment } = await import('../js/supervisors/assignments-matching.js');

test('SSOT STUDENT PROFILE & CLASS RESOLUTION - 20 MANDATORY AUDIT TEST CASES', async (t) => {

  await t.test('1. SV có đầy đủ thông tin: trả về đầy đủ MSSV, họ tên, lớp, ngành, email', () => {
    const context = {
      master: {
        mssv: '12100325',
        fullName: 'Nguyễn Lê Minh Hiếu',
        className: '21010301',
        major: 'Thiết kế Nội thất',
        email: '12100325@student.tdtu.edu.vn'
      }
    };
    const prof = resolveStudentProfile('12100325', context);
    assert.equal(prof.studentId, '12100325');
    assert.equal(prof.studentName, 'Nguyễn Lê Minh Hiếu');
    assert.equal(prof.className, '21010301');
    assert.equal(prof.studentClass, '21010301');
    assert.equal(prof.currentClass, '21010301');
    assert.equal(prof.classDisplay, '21010301');
    assert.equal(prof.hasValidClass, true);
    assert.equal(prof.major, 'Thiết kế Nội thất');
    assert.equal(prof.email, '12100325@student.tdtu.edu.vn');
  });

  await t.test('2. SV có lớp trong hồ sơ chuẩn (Master) nhưng registration không có: lấy đúng lớp từ Master', () => {
    const context = {
      master: {
        mssv: '12100393',
        fullName: 'Lương Nguyễn Thảo Vy',
        className: '21010302'
      },
      registration: {
        studentId: '12100393',
        topicTitle: 'Thiết kế nội thất Học viện Âm nhạc'
        // no currentClass
      }
    };
    const prof = resolveStudentProfile('12100393', context);
    assert.equal(prof.className, '21010302');
    assert.equal(prof.currentClass, '21010302');
    assert.equal(prof.classDisplay, '21010302');
    assert.equal(prof.hasValidClass, true);
  });

  await t.test('3. SV có lớp trong registration (currentClass) nhưng hồ sơ chuẩn thiếu: lấy đúng lớp từ registration', () => {
    const context = {
      master: null,
      eligibleStudent: null,
      registration: {
        studentId: '12200219',
        studentName: 'Hoàng Thái Thảo My',
        currentClass: '22010301'
      }
    };
    const prof = resolveStudentProfile('12200219', context);
    assert.equal(prof.className, '22010301');
    assert.equal(prof.studentClass, '22010301');
    assert.equal(prof.currentClass, '22010301');
    assert.equal(prof.classDisplay, '22010301');
    assert.equal(prof.hasValidClass, true);
    assert.equal(prof.studentName, 'Hoàng Thái Thảo My');
  });

  await t.test('4. SV thiếu lớp hoàn toàn ở tất cả các nguồn: trả về classDisplay là "Chưa có dữ liệu lớp", không bịa đặt lớp', () => {
    const context = {
      master: null,
      eligibleStudent: { studentId: '12199999', name: 'Sinh viên Chưa có lớp' },
      registration: { studentId: '12199999', topicTitle: 'Đề tài mẫu' }
    };
    const prof = resolveStudentProfile('12199999', context);
    assert.equal(prof.className, '');
    assert.equal(prof.classDisplay, 'Chưa có dữ liệu lớp');
    assert.equal(prof.hasValidClass, false);
    // Ensure it did not fake class from MSSV or major
    assert.ok(!prof.classDisplay.includes('12199999'));
    assert.ok(!prof.classDisplay.includes('Thiết kế'));
  });

  await t.test('5. SV có hai trường lớp mâu thuẫn: ưu tiên nguồn chuẩn Master và ghi nhận classConflict', () => {
    const context = {
      master: {
        mssv: '12100325',
        fullName: 'Nguyễn Lê Minh Hiếu',
        className: '21010301'
      },
      registration: {
        studentId: '12100325',
        currentClass: '21010302' // contradictory
      }
    };
    const prof = resolveStudentProfile('12100325', context);
    assert.equal(prof.className, '21010301'); // Authoritative Master wins
    assert.notEqual(prof.classConflict, null);
    assert.equal(prof.classConflict.authoritative, '21010301');
    assert.equal(prof.classConflict.secondary, '21010302');
  });

  await t.test('6. SV có MSSV bắt đầu bằng 0 (VD: "09123456"): bảo toàn chuỗi và số 0 ở đầu', () => {
    const context = {
      master: {
        mssv: '09123456',
        fullName: 'Nguyễn Văn Zero',
        className: '09010301'
      }
    };
    const prof = resolveStudentProfile('09123456', context);
    assert.equal(typeof prof.studentId, 'string');
    assert.equal(prof.studentId, '09123456');
    assert.equal(prof.mssv, '09123456');
    assert.ok(prof.studentId.startsWith('0'));
  });

  await t.test('7. SV tự tham gia đợt (self-join): tạo đủ aliases className, studentClass, currentClass', () => {
    const selfJoinRecord = {
      studentId: '12100999',
      className: '21010303',
      studentClass: '21010303',
      currentClass: '21010303',
      joinMethod: 'link',
      source: 'self_join_link'
    };
    const prof = resolveStudentProfile('12100999', { eligibleStudent: selfJoinRecord });
    assert.equal(prof.className, '21010303');
    assert.equal(prof.studentClass, '21010303');
    assert.equal(prof.currentClass, '21010303');
    assert.equal(prof.hasValidClass, true);
  });

  await t.test('8. SV được nhập bằng Excel: tạo đủ aliases và trích xuất đúng lớp', () => {
    const excelRecord = {
      studentId: '12100325',
      name: 'Nguyễn Lê Minh Hiếu',
      className: '21010301',
      studentClass: '21010301',
      currentClass: '21010301',
      joinMethod: 'excel',
      source: 'excel_import'
    };
    const prof = resolveStudentProfile('12100325', { eligibleStudent: excelRecord });
    assert.equal(prof.className, '21010301');
    assert.equal(prof.classDisplay, '21010301');
  });

  await t.test('9. SV được Admin thêm thủ công: trích xuất đúng lớp từ Master sang eligibleStudents', () => {
    const manualRecord = {
      studentId: '12100303',
      name: 'Lê Duy Bảo',
      className: '21010301',
      studentClass: '21010301',
      currentClass: '21010301',
      joinMethod: 'manual',
      source: 'manual_supplement'
    };
    const prof = resolveStudentProfile('12100303', { eligibleStudent: manualRecord });
    assert.equal(prof.className, '21010301');
    assert.equal(prof.studentName, 'Lê Duy Bảo');
  });

  await t.test('10. SV có 1 NV theo quy định cũ: hồ sơ hợp lệ và hiển thị đúng lớp trong Cổng GVHD', () => {
    const legacy1NV = {
      studentId: '12100114',
      studentName: 'Nguyễn Đỗ Minh Anh',
      currentClass: '21010301',
      preferences: [{ rank: 1, supervisorId: 'sup_tquang', supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' }],
      reviewStatus: 'waiting'
    };
    const prof = resolveStudentProfile('12100114', { registration: legacy1NV });
    assert.equal(prof.className, '21010301');
    assert.equal(prof.currentClass, '21010301');
    assert.equal(prof.classDisplay, '21010301');
    assert.equal(prof.hasValidClass, true);
  });

  await t.test('11. SV có 2 NV theo quy định cũ: hồ sơ hợp lệ và hiển thị đúng lớp trong Cổng GVHD', () => {
    const legacy2NV = {
      studentId: '12200212',
      studentName: 'Đinh Hà Tường Vy',
      currentClass: '22010301',
      preferences: [
        { rank: 1, supervisorId: 'sup_mhieu', supervisorName: 'TS. KTS Nguyễn Minh Hiếu' },
        { rank: 2, supervisorId: 'sup_tquang', supervisorName: 'ThS. KTS. Nguyễn Tăng Quang' }
      ],
      reviewStatus: 'waiting'
    };
    const prof = resolveStudentProfile('12200212', { registration: legacy2NV });
    assert.equal(prof.className, '22010301');
    assert.equal(prof.classDisplay, '22010301');
  });

  await t.test('12. SV có đủ 3 NV: hiển thị đúng lớp trong Cổng GVHD', () => {
    const full3NV = {
      studentId: '12100325',
      studentName: 'Nguyễn Lê Minh Hiếu',
      currentClass: '21010301',
      preferences: [
        { rank: 1, supervisorId: 'sup_1' },
        { rank: 2, supervisorId: 'sup_2' },
        { rank: 3, supervisorId: 'sup_3' }
      ]
    };
    const prof = resolveStudentProfile('12100325', { registration: full3NV });
    assert.equal(prof.className, '21010301');
  });

  await t.test('13. GVHD đăng nhập bằng email TDTU: normalizeOfficialAssignment resolves lớp chính xác', () => {
    const assignment = {
      studentId: '12100325',
      studentName: 'Nguyễn Lê Minh Hiếu',
      assignmentStatus: 'published',
      supervisors: [{ role: 'primary', supervisorId: 'sup_pbcuong', supervisorEmail: 'phanbaocuong@tdtu.edu.vn' }]
    };
    const registration = {
      studentId: '12100325',
      currentClass: '21010301'
    };
    const normalized = normalizeOfficialAssignment(assignment, registration);
    assert.equal(normalized.className, '21010301');
    assert.equal(normalized.currentClass, '21010301');
    assert.equal(normalized.classDisplay, '21010301');
  });

  await t.test('14. GVHD thỉnh giảng đăng nhập email ngoài: normalizeOfficialAssignment resolves lớp chính xác', () => {
    const assignment = {
      studentId: '12100393',
      studentName: 'Lương Nguyễn Thảo Vy',
      assignmentStatus: 'published',
      supervisors: [{ role: 'primary', supervisorId: 'sup_tquang', supervisorEmail: 'tquangarc@gmail.com' }]
    };
    const registration = {
      studentId: '12100393',
      currentClass: '21010302'
    };
    const normalized = normalizeOfficialAssignment(assignment, registration);
    assert.equal(normalized.className, '21010302');
    assert.equal(normalized.currentClass, '21010302');
  });

  await t.test('15. Owner đóng vai GVHD: cùng nhận dữ liệu lớp tương đương 100% với tài khoản thật', () => {
    const reg = {
      studentId: '12200219',
      studentName: 'Hoàng Thái Thảo My',
      currentClass: '22010301'
    };
    const profReal = resolveStudentProfile('12200219', { registration: reg });
    const profImpersonated = resolveStudentProfile('12200219', { registration: reg });
    assert.deepEqual(profReal.className, profImpersonated.className);
    assert.deepEqual(profReal.classDisplay, profImpersonated.classDisplay);
  });

  await t.test('16. GVHD thay đổi học vị/họ tên: lớp sinh viên không bị ảnh hưởng', () => {
    const reg = {
      studentId: '12100325',
      currentClass: '21010301'
    };
    const prof = resolveStudentProfile('12100325', { registration: reg });
    assert.equal(prof.className, '21010301');
  });

  await t.test('17. SV thay đổi tên đề tài hợp lệ: lớp sinh viên vẫn được bảo toàn nguyên vẹn', () => {
    const regV1 = {
      studentId: '12100325',
      topicTitle: 'Thiết kế nội thất Trung tâm Trải nghiệm v1',
      topicTitleVersion: 1,
      currentClass: '21010301'
    };
    const regV2 = {
      studentId: '12100325',
      topicTitle: 'Thiết kế nội thất Trung tâm Trải nghiệm v2',
      topicTitleVersion: 2,
      currentClass: '21010301'
    };
    const p1 = resolveStudentProfile('12100325', { registration: regV1 });
    const p2 = resolveStudentProfile('12100325', { registration: regV2 });
    assert.equal(p1.className, '21010301');
    assert.equal(p2.className, '21010301');
  });

  await t.test('18. Dữ liệu snapshot cũ không ghi đè Master: Master luôn là nguồn chuẩn tối cao', () => {
    const context = {
      master: {
        mssv: '12100325',
        fullName: 'Nguyễn Lê Minh Hiếu (Master)',
        className: '21010301'
      },
      assignment: {
        studentId: '12100325',
        studentName: 'Minh Hieu Old Snapshot',
        className: '21010399' // outdated snapshot
      }
    };
    const prof = resolveStudentProfile('12100325', context);
    assert.equal(prof.studentName, 'Nguyễn Lê Minh Hiếu (Master)');
    assert.equal(prof.className, '21010301'); // Master overrides old assignment snapshot
  });

  await t.test('19. Một sinh viên xuất hiện ở nhiều màn hình: tất cả các màn hình trả về cùng một giá trị lớp', () => {
    const master = { mssv: '12100325', fullName: 'Nguyễn Lê Minh Hiếu', className: '21010301' };
    const reg = { studentId: '12100325', currentClass: '21010301' };
    const el = { studentId: '12100325', className: '21010301' };

    // Screen 1: Admin Danh sách SV
    const pAdmin = resolveStudentProfile('12100325', { master, registration: reg, eligibleStudent: el });
    // Screen 2: Cổng GVHD Xét duyệt NV
    const pSupReview = resolveStudentProfile('12100325', { registration: reg, eligibleStudent: el });
    // Screen 3: Cổng GVHD SV hướng dẫn
    const pSupAssigned = resolveStudentProfile('12100325', { assignment: reg, master });
    // Screen 4: Xuất Excel
    const pExcel = resolveStudentProfile('12100325', { master, registration: reg });

    assert.equal(pAdmin.className, '21010301');
    assert.equal(pSupReview.className, '21010301');
    assert.equal(pSupAssigned.className, '21010301');
    assert.equal(pExcel.className, '21010301');
  });

  await t.test('20. Chuyển đợt liên tục không trộn dữ liệu: mỗi đợt phân lập độc lập', () => {
    const round1Student = { studentId: '12100325', currentClass: '21010301' };
    const round2Student = { studentId: '12200212', currentClass: '22010301' };

    const pR1 = resolveStudentProfile('12100325', { registration: round1Student });
    const pR2 = resolveStudentProfile('12200212', { registration: round2Student });

    assert.equal(pR1.studentId, '12100325');
    assert.equal(pR1.className, '21010301');

    assert.equal(pR2.studentId, '12200212');
    assert.equal(pR2.className, '22010301');
  });

});
