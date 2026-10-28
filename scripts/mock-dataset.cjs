/**
 * IFA+ Graduation — Deterministic Mock Dataset Generator
 * 
 * Generates:
 * - 2 Graduation Rounds
 * - 12 Mock Supervisors with diverse quotas (0, 5, 10)
 * - 60 Mock Students with targeted preference combinations
 * 
 * NO Real Student or Supervisor PII. Strictly isolated.
 */

function generateMockSupervisors() {
  return [
    {
      id: 'mock_gvhd_01',
      supervisorId: 'mock_gvhd_01',
      name: 'TS. Hoàng Văn An (Giả lập 01)',
      academicTitle: 'TS',
      degree: 'Tiến sĩ',
      department: 'Thiết kế Đồ họa',
      email: 'mock.gvhd01@tdtu.edu.vn',
      capacity: 10,
      defaultQuota: 10,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_02',
      supervisorId: 'mock_gvhd_02',
      name: 'ThS. Đặng Thị Bình (Giả lập 02)',
      academicTitle: 'ThS',
      degree: 'Thạc sĩ',
      department: 'Thiết kế Đồ họa',
      email: 'mock.gvhd02@tdtu.edu.vn',
      capacity: 10,
      defaultQuota: 10,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_03',
      supervisorId: 'mock_gvhd_03',
      name: 'TS. Lê Quang Châu (Giả lập 03)',
      academicTitle: 'TS',
      degree: 'Tiến sĩ',
      department: 'Thiết kế Nội thất',
      email: 'mock.gvhd03@tdtu.edu.vn',
      capacity: 10,
      defaultQuota: 10,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_04',
      supervisorId: 'mock_gvhd_04',
      name: 'PGS. TS. Vũ Đình Dũng (Giả lập 04)',
      academicTitle: 'PGS. TS',
      degree: 'Phó Giáo sư, Tiến sĩ',
      department: 'Thiết kế Nội thất',
      email: 'mock.gvhd04@tdtu.edu.vn',
      capacity: 10,
      defaultQuota: 10,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_05',
      supervisorId: 'mock_gvhd_05',
      name: 'ThS. Phạm Thu Giang (Giả lập 05)',
      academicTitle: 'ThS',
      degree: 'Thạc sĩ',
      department: 'Thiết kế Thời trang',
      email: 'mock.gvhd05@tdtu.edu.vn',
      capacity: 5,
      defaultQuota: 5,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_06',
      supervisorId: 'mock_gvhd_06',
      name: 'TS. Ngô Bảo Hưng (Giả lập 06)',
      academicTitle: 'TS',
      degree: 'Tiến sĩ',
      department: 'Thiết kế Thời trang',
      email: 'mock.gvhd06@tdtu.edu.vn',
      capacity: 5,
      defaultQuota: 5,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_07',
      supervisorId: 'mock_gvhd_07',
      name: 'ThS. Mai Anh Khôi (Giả lập 07)',
      academicTitle: 'ThS',
      degree: 'Thạc sĩ',
      department: 'Thiết kế Công nghiệp',
      email: 'mock.gvhd07@tdtu.edu.vn',
      capacity: 5,
      defaultQuota: 5,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_08',
      supervisorId: 'mock_gvhd_08',
      name: 'TS. Bùi Minh Long (Giả lập 08)',
      academicTitle: 'TS',
      degree: 'Tiến sĩ',
      department: 'Thiết kế Công nghiệp',
      email: 'mock.gvhd08@tdtu.edu.vn',
      capacity: 5,
      defaultQuota: 5,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_09',
      supervisorId: 'mock_gvhd_09',
      name: 'ThS. Trương Ngọc Nam (Giả lập 09)',
      academicTitle: 'ThS',
      degree: 'Thạc sĩ',
      department: 'Thiết kế Đồ họa',
      email: 'mock.gvhd09@tdtu.edu.vn',
      capacity: 5,
      defaultQuota: 5,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_10',
      supervisorId: 'mock_gvhd_10',
      name: 'TS. Đỗ Phương Oanh (Giả lập 10)',
      academicTitle: 'TS',
      degree: 'Tiến sĩ',
      department: 'Thiết kế Nội thất',
      email: 'mock.gvhd10@tdtu.edu.vn',
      capacity: 5,
      defaultQuota: 5,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_11',
      supervisorId: 'mock_gvhd_11',
      name: 'ThS. Phan Hữu Phát (Giả lập 11 - Quota 0)',
      academicTitle: 'ThS',
      degree: 'Thạc sĩ',
      department: 'Thiết kế Thời trang',
      email: 'mock.gvhd11@tdtu.edu.vn',
      capacity: 0,
      defaultQuota: 0,
      acceptedCount: 0,
      activeInRound: true
    },
    {
      id: 'mock_gvhd_12',
      supervisorId: 'mock_gvhd_12',
      name: 'TS. Võ Quốc Quân (Giả lập 12 - Quota 0)',
      academicTitle: 'TS',
      degree: 'Tiến sĩ',
      department: 'Thiết kế Công nghiệp',
      email: 'mock.gvhd12@tdtu.edu.vn',
      capacity: 0,
      defaultQuota: 0,
      acceptedCount: 0,
      activeInRound: true
    }
  ];
}

function generateMockRounds() {
  return [
    {
      id: 'round_test_datn_2027',
      roundId: 'round_test_datn_2027',
      title: 'ĐỒ ÁN TỐT NGHIỆP - ĐỢT TEST 4/2027 (LOCAL EMULATOR)',
      roundName: 'Đợt Test 4/2027',
      academicYear: '2026-2027',
      currentReviewRound: 1,
      reviewStatus: 'round_1',
      status: 'reviewing',
      isActive: true,
      preferenceCount: 3,
      selectionMode: 'wizard',
      allowSelfJoin: true,
      createdAt: new Date('2026-10-01T08:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-28T08:00:00Z').toISOString()
    },
    {
      id: 'round_test_dath_2028',
      roundId: 'round_test_dath_2028',
      title: 'ĐỒ ÁN TỔNG HỢP - ĐỢT TEST 1/2028 (LOCAL EMULATOR)',
      roundName: 'Đợt Test 1/2028',
      academicYear: '2027-2028',
      currentReviewRound: 1,
      reviewStatus: 'round_1',
      status: 'draft',
      isActive: false,
      preferenceCount: 3,
      selectionMode: 'wizard',
      allowSelfJoin: true,
      createdAt: new Date('2026-10-01T08:00:00Z').toISOString(),
      updatedAt: new Date('2026-10-28T08:00:00Z').toISOString()
    }
  ];
}

function generateMockStudents(supervisors) {
  const majors = [
    'Thiết kế Đồ họa',
    'Thiết kế Nội thất',
    'Thiết kế Thời trang',
    'Thiết kế Công nghiệp'
  ];
  const projectTypes = [
    'Bộ nhận diện thương hiệu',
    'Không gian nội thất cộng đồng',
    'Bộ sưu tập thời trang ứng dụng',
    'Sản phẩm công nghiệp thông minh'
  ];

  const supMap = {};
  supervisors.forEach(s => { supMap[s.id] = s; });

  const students = [];

  for (let i = 1; i <= 60; i++) {
    const numStr = String(i).padStart(2, '0');
    const studentId = `992000${numStr}`;
    const majorIdx = (i - 1) % majors.length;
    const major = majors[majorIdx];
    const projectType = projectTypes[majorIdx];
    const className = `2005030${(i % 3) + 1}`;

    // Deterministic preference assignments
    let p1Id, p2Id, p3Id;

    if (i <= 10) {
      // SV 01 -> 10: NV1: sup_01 (An), NV2: sup_02 (Bình), NV3: sup_03 (Châu)
      // Sup 01 will pick these 10 -> reaching full 10/10 capacity in Round 1
      p1Id = 'mock_gvhd_01';
      p2Id = 'mock_gvhd_02';
      p3Id = 'mock_gvhd_03';
    } else if (i <= 15) {
      // SV 11 -> 15: NV1: sup_01 (An) - will NOT be picked in R1 because sup_01 is FULL
      p1Id = 'mock_gvhd_01';
      if (i <= 13) {
        // SV 11-13: NV2: sup_05 (Giang, cap 5) -> normal advance to NV2
        p2Id = 'mock_gvhd_05';
        p3Id = 'mock_gvhd_06';
      } else if (i === 14) {
        // SV 14: NV2: sup_01 (full), NV3: sup_09 (Nam, cap 5)
        // Tests Rule 3.5: NV2 FULL -> Immediately skip NV2 straight to NV3!
        p2Id = 'mock_gvhd_01';
        p3Id = 'mock_gvhd_09';
      } else {
        // SV 15: NV2: sup_11 (quota 0/full), NV3: sup_12 (quota 0/full)
        // Tests Rule 3.6: Both NV2 & NV3 FULL -> Route straight to Khoa phân công!
        p2Id = 'mock_gvhd_11';
        p3Id = 'mock_gvhd_12';
      }
    } else if (i <= 25) {
      // SV 16 -> 25: NV1: sup_02 (Bình), NV2: sup_03 (Châu), NV3: sup_04 (Dũng)
      p1Id = 'mock_gvhd_02';
      p2Id = 'mock_gvhd_03';
      p3Id = 'mock_gvhd_04';
    } else if (i <= 35) {
      // SV 26 -> 35: NV1: sup_03 (Châu), NV2: sup_04 (Dũng), NV3: sup_05 (Giang)
      p1Id = 'mock_gvhd_03';
      p2Id = 'mock_gvhd_04';
      p3Id = 'mock_gvhd_05';
    } else if (i <= 45) {
      // SV 36 -> 45: NV1: sup_04 (Dũng), NV2: sup_06 (Hưng), NV3: sup_07 (Khôi)
      p1Id = 'mock_gvhd_04';
      p2Id = 'mock_gvhd_06';
      p3Id = 'mock_gvhd_07';
    } else if (i <= 55) {
      // SV 46 -> 55: NV1: sup_05 / sup_06 / sup_07 / sup_08
      const sId = ['mock_gvhd_05', 'mock_gvhd_06', 'mock_gvhd_07', 'mock_gvhd_08'][(i - 46) % 4];
      p1Id = sId;
      p2Id = 'mock_gvhd_09';
      p3Id = 'mock_gvhd_10';
    } else {
      // SV 56 -> 60: NV1: sup_07 / sup_08, NV2: sup_11 (quota 0), NV3: sup_12 (quota 0)
      p1Id = (i % 2 === 0) ? 'mock_gvhd_07' : 'mock_gvhd_08';
      p2Id = 'mock_gvhd_11';
      p3Id = 'mock_gvhd_12';
    }

    const preferences = [
      { rank: 1, supervisorId: p1Id, supervisorName: supMap[p1Id]?.name || '' },
      { rank: 2, supervisorId: p2Id, supervisorName: supMap[p2Id]?.name || '' },
      { rank: 3, supervisorId: p3Id, supervisorName: supMap[p3Id]?.name || '' }
    ];

    students.push({
      studentId,
      studentName: `Sinh viên Giả lập ${numStr}`,
      email: `${studentId.toLowerCase()}@student.tdtu.edu.vn`,
      className,
      major,
      topicTitle: `Nghiên cứu & Thiết kế đồ án tốt nghiệp số ${numStr} chuyên ngành ${major}`,
      topicDescription: `Đề xuất giải pháp thiết kế sáng tạo ứng dụng cho đề tài ${numStr}, hướng tới giá trị bản sắc và thực tiễn sản xuất.`,
      projectType,
      preferences,
      reviewStatus: 'pending',
      eligibilityStatus: 'eligible',
      joinMethod: i % 2 === 0 ? 'link' : 'excel',
      status: 'submitted',
      submittedAt: new Date(Date.now() - (60 - i) * 60000).toISOString()
    });
  }

  return students;
}

module.exports = {
  generateMockSupervisors,
  generateMockRounds,
  generateMockStudents
};
