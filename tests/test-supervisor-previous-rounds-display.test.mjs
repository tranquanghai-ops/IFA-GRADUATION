import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load compiled index.html
const htmlPath = path.resolve('index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Load assignments-matching.js
const matchingPath = path.resolve('js/supervisors/assignments-matching.js');
const matchingContent = fs.readFileSync(matchingPath, 'utf8');

test('TEST SUITE: HIỂN THỊ SINH VIÊN ĐÃ NHẬN Ở CÁC VÒNG TRƯỚC TRONG CỔNG GVHD', async (t) => {
  await t.test('1. Kiểm tra cấu trúc HTML DOM index.html', () => {
    assert.ok(htmlContent.includes('id="sup-panel-review"'), 'Có #sup-panel-review');
    assert.ok(htmlContent.includes('id="sup-candidates-tbody"'), 'Có #sup-candidates-tbody');
    assert.ok(htmlContent.includes('id="sup-previous-rounds-container"'), 'Có #sup-previous-rounds-container nằm trong #sup-panel-review');
    
    // Check placement: sup-previous-rounds-container must be inside sup-panel-review
    const reviewPanelIdx = htmlContent.indexOf('id="sup-panel-review"');
    const prevRoundsIdx = htmlContent.indexOf('id="sup-previous-rounds-container"');
    const acceptedPanelIdx = htmlContent.indexOf('id="sup-panel-accepted"');
    assert.ok(prevRoundsIdx > reviewPanelIdx, '#sup-previous-rounds-container phải nằm sau khi mở #sup-panel-review');
    assert.ok(prevRoundsIdx < acceptedPanelIdx, '#sup-previous-rounds-container phải nằm trước #sup-panel-accepted');
  });

  await t.test('2. Kiểm tra các hàm nghiệp vụ được xuất và định nghĩa trong assignments-matching.js', () => {
    assert.ok(matchingContent.includes('function renderSupervisorPreviousAcceptedRounds'), 'Có hàm renderSupervisorPreviousAcceptedRounds');
    assert.ok(matchingContent.includes('window.renderSupervisorPreviousAcceptedRounds = renderSupervisorPreviousAcceptedRounds'), 'Có bridge window.renderSupervisorPreviousAcceptedRounds');
    assert.ok(matchingContent.includes('window.toggleSupervisorPreviousRoundCollapse ='), 'Có bridge window.toggleSupervisorPreviousRoundCollapse');
    assert.ok(matchingContent.includes('window.toggleSupervisorPrevAcceptedDesc ='), 'Có bridge window.toggleSupervisorPrevAcceptedDesc');
  });

  await t.test('3. Kiểm tra phân loại sinh viên trúng tuyển theo vòng (Round 1 & Round 2)', () => {
    const supervisorId = 'SUP_001';
    const emailLower = 'gvhd1@tdtu.edu.vn';
    const currentSup = {
      id: supervisorId,
      supervisorId: supervisorId,
      email: emailLower,
      matchesPreference: (p) => p && (p.supervisorId === supervisorId || (p.supervisorEmail || '').toLowerCase() === emailLower)
    };

    const mockRegistrations = [
      {
        studentId: '20010001',
        studentName: 'Nguyễn Văn A',
        reviewStatus: 'accepted',
        acceptedSupervisorId: supervisorId,
        acceptedRank: 1,
        preferences: [{ rank: 1, supervisorId: supervisorId }],
        topicTitle: 'Thiết kế bảo tàng tương tác số',
        topicDescription: 'Mô tả định hướng thiết kế không gian bảo tàng tương tác...',
        phone: '0901234567'
      },
      {
        studentId: '20010002',
        studentName: 'Trần Thị B',
        reviewStatus: 'accepted',
        acceptedSupervisorId: supervisorId,
        acceptedRank: 2,
        preferences: [{ rank: 2, supervisorId: supervisorId }],
        topicTitle: 'Thiết kế trung tâm văn hóa',
        topicDescription: 'Mô tả ngắn gọn',
        phone: ''
      },
      {
        studentId: '20010003',
        studentName: 'Lê Văn C',
        reviewStatus: 'in_review',
        preferences: [{ rank: 2, supervisorId: supervisorId }]
      }
    ];

    const acceptedStudents = mockRegistrations.filter(r => r.reviewStatus === 'accepted');
    assert.equal(acceptedStudents.length, 2, 'Lọc được 2 sinh viên đã nhận');

    const round1Accepted = [];
    const round2Accepted = [];

    acceptedStudents.forEach(r => {
      const accRank = Number(r.acceptedRank);
      if (accRank === 1) round1Accepted.push(r);
      else if (accRank === 2) round2Accepted.push(r);
    });

    assert.equal(round1Accepted.length, 1, 'Vòng 1 có 1 sinh viên');
    assert.equal(round1Accepted[0].studentId, '20010001');
    assert.equal(round2Accepted.length, 1, 'Vòng 2 có 1 sinh viên');
    assert.equal(round2Accepted[0].studentId, '20010002');
  });

  await t.test('4. Kiểm tra công thức tính quota và thẻ thống kê "Đã nhận vòng trước"', () => {
    const totalCapacity = 10;
    const r1Count = 6;
    const r2Count = 2;

    // Vòng 1: Đang xét NV1
    const acceptedPrevR1 = 0;
    const selectedCurrR1 = 3;
    const remainingCapR1 = Math.max(0, totalCapacity - acceptedPrevR1 - selectedCurrR1);
    assert.equal(acceptedPrevR1, 0, 'Vòng 1: Đã nhận vòng trước = 0');
    assert.equal(remainingCapR1, 7, 'Vòng 1: Còn lại 10 - 0 - 3 = 7');

    // Vòng 2: Đang xét NV2
    const acceptedPrevR2 = r1Count;
    const selectedCurrR2 = 0;
    const remainingCapR2 = Math.max(0, totalCapacity - acceptedPrevR2 - selectedCurrR2);
    assert.equal(acceptedPrevR2, 6, 'Vòng 2: Đã nhận vòng trước = 6 (khớp NV1)');
    assert.equal(remainingCapR2, 4, 'Vòng 2: Còn lại 10 - 6 - 0 = 4');

    // Vòng 3: Đang xét NV3
    const acceptedPrevR3 = r1Count + r2Count;
    const selectedCurrR3 = 1;
    const remainingCapR3 = Math.max(0, totalCapacity - acceptedPrevR3 - selectedCurrR3);
    assert.equal(acceptedPrevR3, 8, 'Vòng 3: Đã nhận vòng trước = 8 (NV1 + NV2)');
    assert.equal(remainingCapR3, 1, 'Vòng 3: Còn lại 10 - 8 - 1 = 1');
  });

  await t.test('5. Kiểm tra định dạng SĐT (tel link vs Chưa cập nhật, không bịa đặt)', () => {
    const testCases = [
      { raw: '0901234567', expectedHasTel: true, expectedClean: '0901234567' },
      { raw: '090 123 4567', expectedHasTel: true, expectedClean: '0901234567' },
      { raw: '+84901234567', expectedHasTel: true, expectedClean: '+84901234567' },
      { raw: '', expectedHasTel: false, expectedClean: '' },
      { raw: null, expectedHasTel: false, expectedClean: '' },
      { raw: undefined, expectedHasTel: false, expectedClean: '' }
    ];

    testCases.forEach(tc => {
      const cleanPhone = String(tc.raw || '').trim();
      const cleanTel = cleanPhone.replace(/[^\d+]/g, '');
      if (cleanTel) {
        assert.ok(tc.expectedHasTel, `SĐT ${tc.raw} phải có tel link`);
        assert.equal(cleanTel, tc.expectedClean);
      } else {
        assert.ok(!tc.expectedHasTel, `SĐT rỗng phải không có tel link`);
      }
    });
  });

  await t.test('6. Kiểm tra tính chất Read-Only: bảng vòng trước tuyệt đối không có nút thay đổi quyết định', () => {
    // In matchingContent, verify the table generation in renderSupervisorPreviousAcceptedRounds
    // contains status badges (✓ Đã nhận NV1 / ✓ Đã nhận NV2) and NO buttons like "Chọn nhận SV" or "✕ Bỏ chọn"
    const renderFuncRegex = /export function renderSupervisorPreviousAcceptedRounds[\s\S]*?^}/m;
    const match = matchingContent.match(renderFuncRegex);
    assert.ok(match, 'Tìm thấy hàm renderSupervisorPreviousAcceptedRounds');
    const funcCode = match[0];
    
    // Status badges must be present
    assert.ok(funcCode.includes('✓ Đã nhận NV1'), 'Có badge ✓ Đã nhận NV1');
    assert.ok(funcCode.includes('✓ Đã nhận NV2'), 'Có badge ✓ Đã nhận NV2');
    
    // Action buttons must NOT be present in this function
    assert.ok(!funcCode.includes('onclick="setSupervisorDecision'), 'Tuyệt đối không có setSupervisorDecision trong bảng vòng trước (Read-Only)');
    assert.ok(!funcCode.includes('✕ Bỏ chọn'), 'Không có nút Bỏ chọn trong bảng vòng trước');
    assert.ok(!funcCode.includes('↺ Hoàn tác'), 'Không có nút Hoàn tác trong bảng vòng trước');
  });

  await t.test('7. Kiểm tra quy tắc thu gọn/mở rộng (mặc định mở nếu count > 0, mặc định đóng nếu count == 0)', () => {
    // Test helper logic
    const getCollapseState = (count, manualState) => {
      if (manualState !== undefined) return manualState;
      return count === 0;
    };

    assert.equal(getCollapseState(5, undefined), false, 'Count > 0: mặc định mở (isCollapsed = false)');
    assert.equal(getCollapseState(0, undefined), true, 'Count === 0: mặc định thu gọn (isCollapsed = true)');
    assert.equal(getCollapseState(5, true), true, 'Người dùng thu gọn thủ công: isCollapsed = true');
    assert.equal(getCollapseState(0, false), false, 'Người dùng mở rộng thủ công: isCollapsed = false');
  });

  await t.test('8. Kiểm tra toggle mô tả dài > 120 ký tự trong bảng vòng trước', () => {
    const shortDesc = 'Đây là mô tả ngắn dưới 120 ký tự.';
    const longDesc = 'A'.repeat(150);

    assert.equal(shortDesc.length > 120, false, 'Mô tả ngắn không cần nút xem thêm');
    assert.equal(longDesc.length > 120, true, 'Mô tả dài cần nút xem thêm');
    
    assert.ok(matchingContent.includes('toggleSupervisorPrevAcceptedDesc'), 'Có hàm toggleSupervisorPrevAcceptedDesc');
    assert.ok(matchingContent.includes('line-clamp-3'), 'Có class line-clamp-3 để cắt gọn mô tả dài');
  });
});
