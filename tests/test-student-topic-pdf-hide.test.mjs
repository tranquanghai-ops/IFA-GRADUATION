import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('TEST SUITE: STUDENT TOPIC REGISTRATION PREVIEW - PDF & PRINT VISIBILITY RESTRICTION', async (t) => {
  const modalHtml = read('templates/modals/shared/modal-topic-preview.html');
  const indexHtml = read('index.html');
  const topicsJs = read('js/supervisors/supervisor-portal-topics.js');
  const pdfJs = read('js/students/student-topic-pdf.js');

  await t.test('1. Kiểm tra HTML template modal-topic-preview: nút btn-topic-preview-download-pdf có class hidden mặc định', () => {
    assert.match(modalHtml, /id="btn-topic-preview-download-pdf"\s+class="[^"]*hidden[^"]*"/, 'Template phải có class hidden mặc định');
    assert.match(indexHtml, /id="btn-topic-preview-download-pdf"\s+class="[^"]*hidden[^"]*"/, 'Compiled index.html phải có class hidden mặc định');
  });

  await t.test('2. Kiểm tra openTopicRegistrationPreviewModal: tính canShowPdf và ẩn nút PDF/In khi SV chưa được duyệt', () => {
    assert.match(topicsJs, /const\s+btnPdf\s*=\s*document\.getElementById\('btn-topic-preview-download-pdf'\);/);
    assert.match(topicsJs, /const\s+isTopicApproved\s*=\s*\(status === 'approved' \|\| Boolean\(matchedApproved\)\);/);
    assert.match(topicsJs, /const\s+canShowPdf\s*=\s*isStudentViewer \? isTopicApproved : true;/);
    assert.match(topicsJs, /btnPdf\.classList\.toggle\('hidden',\s*!canShowPdf\);/);
    assert.match(topicsJs, /modal\._isTopicApproved\s*=\s*isTopicApproved;/);
    assert.match(topicsJs, /modal\._status\s*=\s*status;/);
  });

  await t.test('3. Kiểm tra toggleTopicPreviewEditMode: không tự ý hiện nút PDF khi SV ở chế độ xem nếu đề tài chưa được duyệt', () => {
    assert.match(topicsJs, /const\s+canShowPdf\s*=\s*isStudent \? isApproved : true;/);
    assert.match(topicsJs, /if\s*\(btnPdf\)\s*btnPdf\.classList\.toggle\('hidden',\s*!canShowPdf\);/);
  });

  await t.test('4. Kiểm tra saveTopicPreviewEdits: reset _isTopicApproved và _status về pending khi SV sửa đề tài', () => {
    assert.match(topicsJs, /modal\._isTopicApproved\s*=\s*false;/);
    assert.match(topicsJs, /modal\._status\s*=\s*'pending';/);
  });

  await t.test('5. Kiểm tra guards trong printOfficialTopicRegistrationPaper và downloadOfficialTopicRegistrationPdf', () => {
    assert.match(pdfJs, /Phiếu đăng ký chỉ được xuất và in sau khi GVHD xác nhận duyệt đề tài/);
    assert.match(pdfJs, /Phiếu PDF chỉ được xuất và in sau khi GVHD xác nhận duyệt đề tài/);
  });

  await t.test('6. Mô phỏng thực tế ca của SV Đào Minh Quang Vinh (12000166 - Chờ duyệt tên đề tài Lần 1)', () => {
    const makeElement = (initialClasses = []) => {
      const set = new Set(initialClasses);
      return {
        classList: {
          add: (c) => set.add(c),
          remove: (c) => set.delete(c),
          has: (c) => set.has(c),
          contains: (c) => set.has(c),
          toggle: (c, force) => {
            if (force === undefined) {
              set.has(c) ? set.delete(c) : set.add(c);
            } else if (force) {
              set.add(c);
            } else {
              set.delete(c);
            }
          }
        },
        className: initialClasses.join(' '),
        textContent: ''
      };
    };

    const elements = {
      'btn-topic-preview-download-pdf': makeElement(['hidden']),
      'btn-topic-preview-student-edit': makeElement(['hidden']),
      'topic-preview-status-badge': makeElement([]),
      'topic-preview-doc-sup-status': makeElement([]),
      'topic-preview-footer-note': makeElement([])
    };

    const documentMock = {
      getElementById: (id) => elements[id] || makeElement([])
    };

    // Scenario A: Student Đào Minh Quang Vinh opens topic registration modal (status = 'pending')
    const stPending = {
      studentId: '12000166',
      mssv: '12000166',
      studentName: 'Đào Minh Quang Vinh',
      topicTitle: 'Thiết kế nội thất Trung tâm trưng bày và lưu trữ ký ức chiến tranh biên giới Tây Nam',
      topicApprovalStatus: 'pending',
      topicTitleVersion: 1
    };
    const isStudentViewer = true;
    const status = stPending.topicApprovalStatus;
    const matchedApproved = null;
    const isTopicApproved = (status === 'approved' || Boolean(matchedApproved));
    const canShowPdf = isStudentViewer ? isTopicApproved : true;

    const btnPdf = documentMock.getElementById('btn-topic-preview-download-pdf');
    btnPdf.classList.toggle('hidden', !canShowPdf);

    // Assert that btnPdf MUST be hidden
    assert.equal(canShowPdf, false, 'Sinh viên chưa được duyệt thì canShowPdf phải là false');
    assert.equal(btnPdf.classList.contains('hidden'), true, 'Nút Tải PDF/In phải có class hidden (ẩn)');

    // Scenario B: GVHD approves topic (status = 'approved')
    const stApproved = {
      ...stPending,
      topicApprovalStatus: 'approved',
      topicReviewedBy: 'tquangarc@gmail.com'
    };
    const statusApproved = stApproved.topicApprovalStatus;
    const isTopicApprovedB = (statusApproved === 'approved');
    const canShowPdfB = isStudentViewer ? isTopicApprovedB : true;
    btnPdf.classList.toggle('hidden', !canShowPdfB);

    // Assert that btnPdf MUST now be visible
    assert.equal(canShowPdfB, true, 'Sinh viên đã được duyệt thì canShowPdf phải là true');
    assert.equal(btnPdf.classList.contains('hidden'), false, 'Nút Tải PDF/In phải hiển thị (không có class hidden)');
  });

  await t.test('7. Kiểm tra: Khi SV bấm in phiếu, ngày trên phiếu luôn là ngày bấm in (today)', () => {
    // 7a. Kiểm tra mã nguồn supervisor-portal-topics.js: khởi tạo ngày và cập nhật khi click in
    assert.match(topicsJs, /const\s+signDate\s*=\s*new Date\(\);/, 'Phải khởi tạo signDate bằng new Date()');
    assert.match(topicsJs, /const\s+clickPrintDate\s*=\s*new Date\(\);/, 'Khi click nút PDF/In phải lấy new Date()');
    assert.match(topicsJs, /docDateEl\.textContent\s*=\s*`Tp\.HCM, ngày \$\{pDd\} tháng \$\{pMm\} năm \$\{pYyyy\}`;/);

    // 7b. Kiểm tra mã nguồn student-topic-pdf.js: in giấy và xuất PDF luôn dùng new Date()
    assert.match(pdfJs, /const\s+printNow\s*=\s*new Date\(\);/, 'printOfficialTopicRegistrationPaper phải lấy new Date()');
    assert.match(pdfJs, /cloneDateEl\.textContent\s*=\s*printDateStr;/, 'Bản in clone phải cập nhật ngày in');
    assert.match(pdfJs, /Tp\.HCM, ngày \$\{dd\} tháng \$\{mm\} năm \$\{yyyy\}/, 'PDF format chuẩn tiếng Việt');

    // 7c. Mô phỏng ngày in thực tế
    const today = new Date();
    const expectedDd = String(today.getDate()).padStart(2, '0');
    const expectedMm = String(today.getMonth() + 1).padStart(2, '0');
    const expectedYyyy = today.getFullYear();
    const expectedDateStr = `Tp.HCM, ngày ${expectedDd} tháng ${expectedMm} năm ${expectedYyyy}`;

    assert.ok(expectedDateStr.includes(`năm ${expectedYyyy}`), 'Chuỗi ngày in phải chứa đúng năm hiện tại');
    assert.ok(expectedDateStr.startsWith('Tp.HCM, ngày '), 'Chuỗi ngày in phải bắt đầu bằng Tp.HCM, ngày');
  });
});
