/**
 * IFA+ Graduation — Student Official Topic Form & PDF Generator
 */

async function loadStudentSelfProfile(mssv) {
  if (!mssv) return null;
  try {
    const snap = await getDoc(doc(db, 'graduationStudentProfiles', mssv));
    state.studentSelfProfile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn('[StudentProfile] Unable to load self profile:', err.message);
    state.studentSelfProfile = null;
  }
  return state.studentSelfProfile;
}

function getRegistrationStudentIdentity() {
  const mssv = state.isPreviewMode ? state.previewMssv : state.studentMssv;
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(mssv) : null;
  return {
    mssv,
    fullName: studentObj?.fullName || studentObj?.name || state.myRegistration?.studentName || state.user?.displayName || `Sinh viên ${mssv}`,
    major: studentObj?.major || state.myRegistration?.major || 'Thiết kế nội thất',
    email: state.myRegistration?.email || (state.impersonation?.target?.email) || state.user?.email || `${mssv}@student.tdtu.edu.vn`
  };
}

function populateRegistrationStudentForm() {
  const identity = getRegistrationStudentIdentity();
  const reg = state.myRegistration || {};
  const profile = state.studentSelfProfile || {};
  const values = {
    'registration-student-name': identity.fullName,
    'registration-student-id': identity.mssv,
    'registration-student-major': identity.major,
    'registration-personal-email': reg.personalEmail || profile.personalEmail || '',
    'registration-current-class': reg.currentClass || profile.currentClass || '',
    'registration-student-phone': reg.studentPhone || profile.phone || '',
    'registration-student-permanent-address': reg.studentPermanentAddress || profile.permanentAddress || '',
    'registration-student-temporary-address': reg.studentTemporaryAddress || reg.studentAddress || profile.temporaryAddress || profile.address || '',
    'registration-course-name': reg.courseName || 'Đồ án tốt nghiệp',
    'registration-course-code': reg.courseCode || '',
    'registration-course-group': reg.courseGroup || '',
    'input-topic-description': reg.topicDescription || ''
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  const counter = document.getElementById('topic-description-char-count');
  if (counter) counter.textContent = String(values['input-topic-description'].length);
}

function collectOfficialFormFields() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  return {
    currentClass: val('registration-current-class'),
    personalEmail: val('registration-personal-email'),
    studentPhone: val('registration-student-phone'),
    studentPermanentAddress: val('registration-student-permanent-address'),
    studentTemporaryAddress: val('registration-student-temporary-address'),
    studentAddress: val('registration-student-temporary-address'),
    courseName: val('registration-course-name'),
    courseCode: val('registration-course-code'),
    courseGroup: val('registration-course-group'),
    topicDescription: val('input-topic-description')
  };
}

function validateOfficialFormFields(fields) {
  const labels = {
    currentClass: 'lớp', personalEmail: 'email cá nhân', studentPhone: 'số điện thoại',
    studentPermanentAddress: 'địa chỉ thường trú', studentTemporaryAddress: 'địa chỉ tạm trú',
    courseName: 'môn học', courseCode: 'mã môn học', courseGroup: 'nhóm', topicDescription: 'mô tả định hướng thiết kế'
  };
  const missing = Object.entries(labels).find(([key]) => !String(fields[key] || '').trim());
  if (missing) {
    showToast(`Vui lòng nhập ${missing[1]} để hoàn thiện phiếu đăng ký chính thức.`, 'warning');
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.personalEmail)) {
    showToast('Email cá nhân chưa đúng định dạng.', 'warning');
    return false;
  }
  return true;
}

export function getCleanRegistrationAddress(st, studentObj = null) {
  const isInvalid = (val) => {
    if (!val) return true;
    const s = String(val).trim().toLowerCase();
    return s === '' || s === 'không có' || s === 'khong co' || s === 'không' || s === 'khong' || 
           s === 'k' || s === 'ko' || s === 'none' || s === '-' || s === '--' || s === 'n/a';
  };

  const temp = st?.studentTemporaryAddress || st?.temporaryAddress || '';
  const perm = st?.studentPermanentAddress || st?.permanentAddress || '';
  const gen = st?.studentAddress || st?.address || studentObj?.address || '';

  if (!isInvalid(temp)) return temp.trim();
  if (!isInvalid(perm)) return perm.trim();
  if (!isInvalid(gen)) return gen.trim();
  return temp || perm || gen || '--';
}
window.getCleanRegistrationAddress = getCleanRegistrationAddress;

window.printOfficialTopicRegistrationPaper = function(targetStudentId = null) {
  const paper = document.getElementById('topic-preview-paper');
  if (!paper) {
    if (typeof window.downloadOfficialTopicRegistrationPdf === 'function') {
      window.downloadOfficialTopicRegistrationPdf(targetStudentId);
    }
    return;
  }

  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);

  const doc = printFrame.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Phieu-dang-ky-de-tai</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          * {
            box-sizing: border-box;
            font-family: 'Times New Roman', Times, serif !important;
            color: #000 !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
            font-size: 13pt;
            line-height: 1.4;
          }
          table {
            border-collapse: collapse;
          }
          td.has-value {
            border-bottom: 0 !important;
          }
        </style>
      </head>
      <body>
        ${paper.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  const innerPaper = doc.getElementById('topic-preview-paper');
  if (innerPaper) {
    innerPaper.style.boxShadow = 'none';
    innerPaper.style.border = 'none';
    innerPaper.style.padding = '0';
    innerPaper.style.margin = '0';
    innerPaper.style.width = '100%';
    innerPaper.style.minWidth = '100%';
    innerPaper.style.minHeight = 'auto';
  }

  setTimeout(() => {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    } catch (e) {
      console.warn('Iframe print notice:', e);
      window.print();
    }
    setTimeout(() => {
      printFrame.remove();
    }, 2000);
  }, 250);
};

window.downloadOfficialTopicRegistrationPdf = function(targetStudentId = null) {
  let reg = null;
  let identity = null;

  if (targetStudentId && typeof targetStudentId === 'string') {
    reg = (state.supervisorAssignedStudents || []).find(st => (st.studentId || st.id) === targetStudentId) ||
      (typeof findStudentInRound === 'function' ? findStudentInRound(targetStudentId) : null);
    const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(targetStudentId) : null;
    identity = {
      mssv: targetStudentId,
      fullName: reg?.studentName || studentObj?.fullName || studentObj?.name || targetStudentId,
      major: reg?.major || studentObj?.major || 'Thiết kế nội thất',
      email: reg?.personalEmail || reg?.email || studentObj?.email || `${targetStudentId}@student.tdtu.edu.vn`
    };
  } else {
    reg = state.myRegistration;
    identity = getRegistrationStudentIdentity();
  }

  if (!reg) {
    showToast('Không tìm thấy thông tin đăng ký.', 'warning');
    return;
  }
  if (!targetStudentId && reg.topicApprovalStatus !== 'approved') {
    showToast('Phiếu PDF chỉ được tải sau khi GVHD xác nhận tên đề tài.', 'warning');
    return;
  }
  if (!window.pdfMake) {
    showToast('Bộ tạo PDF chưa tải xong. Vui lòng thử lại sau vài giây.', 'warning');
    return;
  }

  identity = identity || getRegistrationStudentIdentity();
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(identity.mssv) : null;
  const round = state.activeRound || {};
  const approvedDate = reg.topicReviewedAt?.toDate ? reg.topicReviewedAt.toDate() : new Date();
  const dd = String(approvedDate.getDate()).padStart(2, '0');
  const mm = String(approvedDate.getMonth() + 1).padStart(2, '0');
  const yyyy = approvedDate.getFullYear();
  const roundLabel = round.title || round.roundName || 'ĐỒ ÁN TỐT NGHIỆP';
  const version = Number(reg.topicTitleVersion || 1);
  const normalizedRoundLabel = roundLabel.toUpperCase().replace(/\s+/g, ' ').trim();
  const roundHeadingMatch = normalizedRoundLabel.match(/^(.*?)(?:\s*-\s*)?(ĐỢT\s+.+)$/);
  const programHeading = roundHeadingMatch?.[1] || 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP';
  const roundHeading = roundHeadingMatch?.[2] || (round.roundName ? `ĐỢT ${round.roundName}` : '');
  const descriptionText = String(reg.topicDescription || '').trim();
  const studentClass = reg.currentClass || reg.studentClass || reg.className || studentObj?.className || studentObj?.studentClass || '--';
  const studentAddress = getCleanRegistrationAddress(reg, studentObj);

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [54, 36, 54, 36],
    defaultStyle: { font: 'Roboto', fontSize: 12, lineHeight: 1.2 },
    content: [
      {
        columns: [
          {
            width: '46%',
            stack: [
              { text: 'TRƯỜNG ĐẠI HỌC TÔN ĐỨC THẮNG', fontSize: 10.5, alignment: 'center' },
              { text: 'KHOA MỸ THUẬT CÔNG NGHIỆP', fontSize: 10.5, bold: true, alignment: 'center', margin: [0, 2, 0, 4] },
              { canvas: [{ type: 'line', x1: 25, y1: 0, x2: 175, y2: 0, lineWidth: 0.8 }] }
            ]
          },
          {
            width: '54%',
            stack: [
              { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', fontSize: 10.5, bold: true, alignment: 'center' },
              { text: 'Độc lập -Tự do – Hạnh phúc', fontSize: 10.5, bold: true, alignment: 'center', margin: [0, 2, 0, 4] },
              { canvas: [{ type: 'line', x1: 45, y1: 0, x2: 175, y2: 0, lineWidth: 0.8 }] }
            ]
          }
        ],
        margin: [0, 0, 0, 20]
      },
      { text: 'PHIẾU ĐĂNG KÝ ĐỀ TÀI CHÍNH THỨC', bold: true, fontSize: 15, alignment: 'center' },
      { text: 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP', bold: true, fontSize: 13.5, alignment: 'center', margin: [0, 2, 0, 0] },
      ...(roundHeading
        ? [{ text: roundHeading, bold: true, italics: true, fontSize: 13.5, alignment: 'center', margin: [0, 2, 0, 18] }]
        : [{ text: '', margin: [0, 0, 0, 18] }]),

      // Thông tin sinh viên (inline, không bị cách xa, không bold giá trị)
      {
        columns: [
          {
            width: '62%',
            text: [
              { text: 'HỌ VÀ TÊN: ', bold: true },
              { text: identity.fullName || '', bold: false }
            ]
          },
          {
            width: '38%',
            text: [
              { text: 'MSSV: ', bold: true },
              { text: identity.mssv || '', bold: false }
            ]
          }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        columns: [
          {
            width: '46%',
            text: [
              { text: 'LỚP: ', bold: true },
              { text: studentClass, bold: false }
            ]
          },
          {
            width: '54%',
            text: [
              { text: 'NGÀNH: ', bold: true },
              { text: reg.major || identity.major || 'Thiết kế nội thất', bold: false }
            ]
          }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        text: [
          { text: 'EMAIL: ', bold: true },
          { text: reg.personalEmail || identity.email || '', bold: false }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        text: [
          { text: 'ĐIỆN THOẠI: ', bold: true },
          { text: reg.studentPhone || '', bold: false }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        text: [
          { text: 'ĐỊA CHỈ: ', bold: true },
          { text: studentAddress, bold: false }
        ],
        margin: [0, 0, 0, 8]
      },
      {
        columns: [
          {
            width: '45%',
            text: [
              { text: 'MÔN HỌC: ', bold: true },
              { text: reg.courseName || reg.projectType || 'Đồ án tốt nghiệp', bold: false }
            ]
          },
          {
            width: '35%',
            text: [
              { text: 'MÃ MÔN HỌC: ', bold: true },
              { text: reg.courseCode || '', bold: false }
            ]
          },
          {
            width: '20%',
            text: [
              { text: 'NHÓM: ', bold: true },
              { text: reg.courseGroup || '1', bold: false }
            ]
          }
        ],
        margin: [0, 0, 0, 14]
      },
      {
        text: `Đăng ký đề tài chính thức lần thứ : ${version}`,
        italics: true,
        fontSize: 12,
        alignment: 'center',
        margin: [0, 0, 0, 14]
      },
      {
        text: [
          { text: 'TÊN ĐỀ TÀI : ', bold: true },
          { text: reg.topicTitle || '', bold: false }
        ],
        lineHeight: 1.35,
        margin: [0, 0, 0, 14]
      },
      {
        text: 'MÔ TẢ CHI TIẾT ĐỊNH HƯỚNG THIẾT KẾ CỦA ĐỀ TÀI :',
        bold: true,
        alignment: 'center',
        fontSize: 12,
        margin: [0, 0, 0, 8]
      },
      {
        text: descriptionText || '',
        alignment: 'justify',
        fontSize: 12,
        lineHeight: 1.35,
        margin: [0, 0, 0, 14]
      },
      {
        text: 'Tôi xin cam đoan thực hiện đúng đề tài đã đăng ký.',
        bold: true,
        fontSize: 12,
        alignment: 'center',
        margin: [0, 4, 0, 18]
      },
      {
        columns: [
          {
            width: '56%',
            stack: [
              { text: 'Ý KIẾN CỦA GIẢNG VIÊN HƯỚNG DẪN', bold: true, fontSize: 12, alignment: 'center', margin: [0, 18, 0, 0] }
            ]
          },
          {
            width: '44%',
            stack: [
              { text: `Tp.HCM, ngày ${dd} tháng ${mm} năm ${yyyy}`, italics: true, fontSize: 12, alignment: 'center' },
              { text: 'NGƯỜI ĐĂNG KÝ', bold: true, fontSize: 12, alignment: 'center', margin: [0, 3, 0, 0] },
              { text: '(ký và ghi rõ họ tên)', italics: true, fontSize: 11, alignment: 'center', margin: [0, 1, 0, 40] },
              { text: identity.fullName, bold: false, fontSize: 12, alignment: 'center' }
            ]
          }
        ]
      }
    ],
    styles: {}
  };

  const safeId = String(identity.mssv || 'sinh-vien').replace(/[^0-9A-Za-z_-]/g, '');
  window.pdfMake.createPdf(docDefinition).download(`Phieu-dang-ky-de-tai-${safeId}-lan-${version}.pdf`);
};
