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

function resolveOfficialStudentFullName(mssv, reg = null, studentObj = null) {
  const cleanId = String(mssv || '').trim().toUpperCase();
  const isInvalid = (name) => {
    if (!name) return true;
    const s = String(name).trim();
    if (!s || s === '--') return true;
    const upper = s.toUpperCase();
    if (upper === cleanId) return true;
    if (upper === `SINH VIÊN ${cleanId}` || upper.startsWith(`SINH VIÊN ${cleanId}`)) return true;
    if (cleanId && upper === `SINH VIÊN ${cleanId.replace(/\s+/g, '')}`) return true;
    return false;
  };

  // 1. Direct registration studentName
  const regName = reg?.studentName || reg?.fullName || reg?.name;
  if (!isInvalid(regName)) return String(regName).trim();

  // 2. Active impersonation target
  if (state.impersonation?.target?.type === 'student' && (!cleanId || String(state.impersonation.target.mssv || state.impersonation.target.id).trim().toUpperCase() === cleanId)) {
    const impName = state.impersonation.target.name || state.impersonation.target.fullName;
    if (!isInvalid(impName)) return String(impName).trim();
  }

  // 3. Central resolveStudentName if available
  if (typeof window.resolveStudentName === 'function') {
    const resolved = window.resolveStudentName(cleanId, regName || '');
    if (!isInvalid(resolved)) return String(resolved).trim();
  }

  // 4. Student self profile
  const profName = state.studentSelfProfile?.fullName || state.studentSelfProfile?.name;
  if (!isInvalid(profName)) return String(profName).trim();

  // 5. Faculty student master (only if not missing / placeholder)
  const fac = studentObj || (typeof window.getFacultyStudentByMssv === 'function' ? window.getFacultyStudentByMssv(cleanId) : null) || (typeof window.getFacultyStudent === 'function' ? window.getFacultyStudent(cleanId) : null);
  if (fac && !fac.isMissing && !fac.notFoundInMaster) {
    const fn = fac.fullName || fac.name;
    if (!isInvalid(fn)) return String(fn).trim();
  }

  // 6. User display name
  const disp = state.user?.displayName;
  if (!isInvalid(disp)) return String(disp).trim();

  // 7. Fallback
  return regName || profName || (cleanId ? `Sinh viên ${cleanId}` : 'Sinh viên');
}
window.resolveOfficialStudentFullName = resolveOfficialStudentFullName;

function resolveOfficialSupervisorName(st, fallback = 'Giảng viên Hướng dẫn') {
  if (!st && state.myRegistration) st = state.myRegistration;
  if (!st) return fallback;

  const isInvalid = (val) => {
    if (!val) return true;
    const s = String(val).trim().toLowerCase();
    return s === '' || s === '--' || s === 'giảng viên hướng dẫn' || s === 'giang vien huong dan';
  };

  // 1. Check officialSupervisors
  const officials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(st) : (Array.isArray(st.officialSupervisors) ? st.officialSupervisors : []);
  const primary = officials.find(s => s.role === 'primary') || officials[0];
  if (primary?.supervisorName && !isInvalid(primary.supervisorName)) {
    return primary.supervisorName.trim();
  }

  // 2. Direct properties on registration or assignment
  const directName = st.acceptedSupervisorName || st.supervisorName || st.finalSupervisorName;
  if (directName && !isInvalid(directName)) {
    return String(directName).trim();
  }

  // 3. Official assignment in state
  const myAss = state.myOfficialAssignment;
  const sid = st.studentId || st.mssv || st.id;
  if (myAss && (myAss.studentId === sid || myAss.mssv === sid)) {
    const assOfficials = (typeof getOfficialSupervisors === 'function') ? getOfficialSupervisors(myAss) : [];
    const assPrimary = assOfficials.find(s => s.role === 'primary') || assOfficials[0];
    if (assPrimary?.supervisorName && !isInvalid(assPrimary.supervisorName)) {
      return assPrimary.supervisorName.trim();
    }
    if (myAss.acceptedSupervisorName && !isInvalid(myAss.acceptedSupervisorName)) return myAss.acceptedSupervisorName.trim();
    if (myAss.supervisorName && !isInvalid(myAss.supervisorName)) return myAss.supervisorName.trim();
  }

  // 4. If current actor is a supervisor
  const actor = (typeof getEffectiveActor === 'function') ? getEffectiveActor() : null;
  const isSupervisorRole = Boolean(
    state.currentRole === 'supervisor' ||
    state.role === 'supervisor' ||
    actor?.type === 'supervisor'
  );
  if (isSupervisorRole && (actor?.displayName || state.user?.displayName)) {
    const d = (actor?.displayName || state.user?.displayName).trim();
    if (!isInvalid(d)) return d;
  }

  // 5. Look in supervisors master / roundSupervisors by id or email
  const supId = st.supervisorId || primary?.supervisorId;
  if (supId && Array.isArray(state.roundSupervisors)) {
    const found = state.roundSupervisors.find(s => s.id === supId || s.supervisorId === supId);
    if (found?.name && !isInvalid(found.name)) return found.name.trim();
    if (found?.supervisorName && !isInvalid(found.supervisorName)) return found.supervisorName.trim();
  }

  return directName && String(directName).trim() ? String(directName).trim() : fallback;
}
window.resolveOfficialSupervisorName = resolveOfficialSupervisorName;

function getApprovedTopicVersions(reg) {
  if (!reg) return [];
  const history = Array.isArray(reg.topicTitleHistory) ? reg.topicTitleHistory : [];
  const map = new Map();

  history.forEach(item => {
    if (item && item.status === 'approved') {
      const v = Number(item.version || 1);
      map.set(v, {
        version: v,
        title: item.title || reg.topicTitle || '',
        topicDescription: item.topicDescription || reg.topicDescription || '',
        reviewedAt: item.reviewedAt || reg.topicReviewedAt || null,
        reviewedBy: item.reviewedBy || reg.topicReviewedBy || '',
        status: 'approved'
      });
    }
  });

  const isCurrentApproved = (reg.topicApprovalStatus === 'approved' || reg.approvalStatus === 'approved');
  const currentVersion = Number(reg.topicTitleVersion || 1);
  if (isCurrentApproved && !map.has(currentVersion)) {
    map.set(currentVersion, {
      version: currentVersion,
      title: reg.topicTitle || '',
      topicDescription: reg.topicDescription || '',
      reviewedAt: reg.topicReviewedAt || null,
      reviewedBy: reg.topicReviewedBy || '',
      status: 'approved'
    });
  }

  return Array.from(map.values()).sort((a, b) => a.version - b.version);
}
window.getApprovedTopicVersions = getApprovedTopicVersions;

function getRegistrationStudentIdentity() {
  const mssv = state.isPreviewMode ? state.previewMssv : (state.studentMssv || state.impersonation?.target?.mssv || state.myRegistration?.studentId || state.myRegistration?.mssv);
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(mssv) : null;
  const reg = state.myRegistration || {};
  const isFacReal = Boolean(studentObj && !studentObj.isMissing && !studentObj.notFoundInMaster);
  return {
    mssv,
    fullName: resolveOfficialStudentFullName(mssv, reg, studentObj),
    major: reg.major || (isFacReal ? studentObj.major : '') || state.studentSelfProfile?.major || 'Thiết kế nội thất',
    email: reg.personalEmail || reg.email || (state.impersonation?.target?.email) || (isFacReal ? studentObj.email : '') || state.user?.email || `${mssv}@student.tdtu.edu.vn`
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

let _timesFontLoadedPromise = null;
async function ensureTimesFontLoaded() {
  if (typeof window === 'undefined') return false;
  if (window.pdfMake?.fonts?.Times && window.pdfMake?.vfs?.['times-regular.ttf']) {
    return true;
  }
  if (!_timesFontLoadedPromise) {
    _timesFontLoadedPromise = (async () => {
      try {
        if (!window.pdfMake) {
          console.warn('[PDF] pdfMake is not loaded yet');
          return false;
        }

        const toBase64 = (buf) => {
          const bytes = new Uint8Array(buf);
          let binary = '';
          const len = bytes.byteLength;
          const chunkSize = 0x8000;
          for (let i = 0; i < len; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
          }
          return btoa(binary);
        };

        const fetchFont = async (localPath, fallbackCdnUrl) => {
          try {
            const res = await fetch(localPath);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              return toBase64(buf);
            }
          } catch (e) {
            // fallback
          }
          if (fallbackCdnUrl) {
            const res = await fetch(fallbackCdnUrl);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              return toBase64(buf);
            }
          }
          throw new Error(`Failed to load font from ${localPath} or CDN`);
        };

        const [regB64, boldB64, italB64, boldItalB64] = await Promise.all([
          fetchFont('/fonts/times-regular.ttf', 'https://fonts.gstatic.com/s/tinos/v26/buE4poGnedXvwgX8.ttf'),
          fetchFont('/fonts/times-bold.ttf', 'https://fonts.gstatic.com/s/tinos/v26/buE1poGnedXvwj1AW0Fp.ttf'),
          fetchFont('/fonts/times-italic.ttf', 'https://fonts.gstatic.com/s/tinos/v26/buE2poGnedXvwjX-fmE.ttf'),
          fetchFont('/fonts/times-bolditalic.ttf', 'https://fonts.gstatic.com/s/tinos/v26/buEzpoGnedXvwjX-Rt1s0Co.ttf')
        ]);

        window.pdfMake.vfs = window.pdfMake.vfs || {};
        window.pdfMake.vfs['times-regular.ttf'] = regB64;
        window.pdfMake.vfs['times-bold.ttf'] = boldB64;
        window.pdfMake.vfs['times-italic.ttf'] = italB64;
        window.pdfMake.vfs['times-bolditalic.ttf'] = boldItalB64;

        window.pdfMake.fonts = window.pdfMake.fonts || {};
        window.pdfMake.fonts.Times = {
          normal: 'times-regular.ttf',
          bold: 'times-bold.ttf',
          italics: 'times-italic.ttf',
          bolditalics: 'times-bolditalic.ttf'
        };
        return true;
      } catch (err) {
        console.warn('[PDF] Unable to embed Times font into pdfMake, falling back to default:', err);
        return false;
      }
    })();
  }
  return await _timesFontLoadedPromise;
}
window.ensureTimesFontLoaded = ensureTimesFontLoaded;

window.printOfficialTopicRegistrationPaper = function(targetStudentId = null) {
  const paper = document.getElementById('topic-preview-paper');
  if (!paper) {
    if (typeof window.downloadOfficialTopicRegistrationPdf === 'function') {
      window.downloadOfficialTopicRegistrationPdf(targetStudentId);
    }
    return;
  }

  // Clone paper and strip all edit wraps, textareas, notes, and supervisor approval status before printing
  const paperClone = paper.cloneNode(true);
  const elementsToRemove = paperClone.querySelectorAll(
    '#topic-preview-doc-title-edit-wrap, #topic-preview-doc-desc-edit-wrap, #topic-preview-doc-sup-status, .hidden, .no-print, textarea, button'
  );
  elementsToRemove.forEach(el => el.remove());

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
            font-family: 'Times New Roman', 'Tinos', Times, serif !important;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            font-size: 12pt;
            line-height: 1.4;
          }
          table {
            border-collapse: collapse;
          }
          td.has-value {
            border-bottom: 0 !important;
          }
          .hidden, .no-print, #topic-preview-doc-title-edit-wrap, #topic-preview-doc-desc-edit-wrap, #topic-preview-doc-sup-status, textarea {
            display: none !important;
            visibility: hidden !important;
          }
        </style>
      </head>
      <body>
        ${paperClone.outerHTML}
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
      if (printFrame && printFrame.parentNode) {
        printFrame.remove();
      }
    }, 2000);
  }, 250);
};

window.downloadOfficialTopicRegistrationPdf = async function(targetStudentId = null, targetVersion = null) {
  let reg = null;
  let identity = null;

  const modal = document.getElementById('modal-supervisor-topic-preview');
  if (modal && modal._currentRegistration) {
    if (!targetStudentId || (modal._currentRegistration.studentId === targetStudentId || modal._currentRegistration.mssv === targetStudentId)) {
      reg = modal._currentRegistration;
    }
  }

  if (targetStudentId && typeof targetStudentId === 'string') {
    if (!reg) {
      reg = (state.supervisorAssignedStudents || []).find(st => (st.studentId || st.id) === targetStudentId) ||
        (typeof findStudentInRound === 'function' ? findStudentInRound(targetStudentId) : null) ||
        (state.myRegistration && (state.myRegistration.studentId === targetStudentId || state.myRegistration.mssv === targetStudentId) ? state.myRegistration : null);
    }
    const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(targetStudentId) : null;
    const isFacReal = Boolean(studentObj && !studentObj.isMissing && !studentObj.notFoundInMaster);
    let resolvedName = resolveOfficialStudentFullName(targetStudentId, reg, studentObj);
    if ((!resolvedName || resolvedName.startsWith('Sinh viên')) && modal) {
      const modalStudentName = document.getElementById('topic-preview-doc-sign-student')?.textContent?.trim() ||
        document.getElementById('topic-preview-doc-name')?.textContent?.trim();
      if (modalStudentName && modalStudentName !== '--') resolvedName = modalStudentName;
    }
    identity = {
      mssv: targetStudentId,
      fullName: resolvedName,
      major: reg?.major || (isFacReal ? studentObj.major : '') || 'Thiết kế nội thất',
      email: reg?.personalEmail || reg?.email || (isFacReal ? studentObj.email : '') || `${targetStudentId}@student.tdtu.edu.vn`
    };
  } else {
    if (!reg) reg = state.myRegistration;
    identity = getRegistrationStudentIdentity();
    if ((!identity.fullName || identity.fullName.startsWith('Sinh viên')) && modal) {
      const modalStudentName = document.getElementById('topic-preview-doc-sign-student')?.textContent?.trim() ||
        document.getElementById('topic-preview-doc-name')?.textContent?.trim();
      if (modalStudentName && modalStudentName !== '--') identity.fullName = modalStudentName;
    }
  }

  if (!targetVersion && modal && modal._viewingVersion) {
    targetVersion = modal._viewingVersion;
  }

  if (!reg) {
    showToast('Không tìm thấy thông tin đăng ký.', 'warning');
    return;
  }
  if (!targetStudentId && reg.topicApprovalStatus !== 'approved' && !targetVersion) {
    showToast('Phiếu PDF chỉ được tải sau khi GVHD xác nhận tên đề tài.', 'warning');
    return;
  }
  if (!window.pdfMake) {
    showToast('Bộ tạo PDF chưa tải xong. Vui lòng thử lại sau vài giây.', 'warning');
    return;
  }

  // Ensure Times New Roman / Tinos TTF fonts are loaded into pdfMake
  const fontReady = await ensureTimesFontLoaded();
  const pdfFont = (fontReady && window.pdfMake?.fonts?.Times) ? 'Times' : 'Roboto';

  identity = identity || getRegistrationStudentIdentity();
  const studentObj = (typeof window.getFacultyStudent === 'function') ? window.getFacultyStudent(identity.mssv) : null;
  const round = state.activeRound || {};
  const approvedDate = reg.topicReviewedAt?.toDate ? reg.topicReviewedAt.toDate() : new Date();
  const dd = String(approvedDate.getDate()).padStart(2, '0');
  const mm = String(approvedDate.getMonth() + 1).padStart(2, '0');
  const yyyy = approvedDate.getFullYear();
  const roundLabel = round.title || round.roundName || 'ĐỒ ÁN TỐT NGHIỆP';

  const approvedList = getApprovedTopicVersions(reg);
  let activeVersion = Number(reg.topicTitleVersion || 1);
  let activeTitle = reg.topicTitle || '';
  let activeDesc = String(reg.topicDescription || '').trim();
  const isDirectlyApproved = Boolean(
    reg.topicApprovalStatus === 'approved' ||
    reg.approvalStatus === 'approved'
  );

  if (targetVersion) {
    const matched = approvedList.find(item => Number(item.version) === Number(targetVersion));
    if (matched) {
      activeVersion = Number(matched.version);
      activeTitle = matched.title || activeTitle;
      activeDesc = String(matched.topicDescription || activeDesc).trim();
    }
  } else if (!isDirectlyApproved && approvedList.length > 0) {
    const latest = approvedList[approvedList.length - 1];
    if (latest) {
      activeVersion = Number(latest.version);
      activeTitle = latest.title || activeTitle;
      activeDesc = String(latest.topicDescription || activeDesc).trim();
    }
  }

  let supervisorName = resolveOfficialSupervisorName(reg);
  if ((!supervisorName || supervisorName === 'Giảng viên Hướng dẫn') && modal) {
    const modalSupName = document.getElementById('topic-preview-doc-sup-name')?.textContent?.trim();
    if (modalSupName && modalSupName !== '--') supervisorName = modalSupName;
  }
  const normalizedRoundLabel = roundLabel.toUpperCase().replace(/\s+/g, ' ').trim();
  const roundHeadingMatch = normalizedRoundLabel.match(/^(.*?)(?:\s*-\s*)?(ĐỢT\s+.+)$/);
  const programHeading = roundHeadingMatch?.[1] || 'ĐỒ ÁN TỐT NGHIỆP/ĐỒ ÁN TỔNG HỢP';
  const roundHeading = roundHeadingMatch?.[2] || (round.roundName ? (String(round.roundName).toUpperCase().startsWith('ĐỢT') ? round.roundName.toUpperCase() : `ĐỢT ${round.roundName.toUpperCase()}`) : '');
  const descriptionText = activeDesc || '';
  const studentClass = reg.currentClass || reg.studentClass || reg.className || studentObj?.className || studentObj?.studentClass || '--';
  const studentAddress = getCleanRegistrationAddress(reg, studentObj);

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [54, 38, 54, 38],
    defaultStyle: { font: pdfFont, fontSize: 12, lineHeight: 1.25 },
    content: [
      {
        columns: [
          {
            width: '48%',
            stack: [
              { text: 'TRƯỜNG ĐẠI HỌC TÔN ĐỨC THẮNG', fontSize: 10, alignment: 'center' },
              { text: 'KHOA MỸ THUẬT CÔNG NGHIỆP', fontSize: 10, bold: true, alignment: 'center', margin: [0, 2, 0, 3] },
              {
                table: {
                  widths: ['*', 120, '*'],
                  body: [
                    [
                      { text: '', border: [false, false, false, false] },
                      { text: '', border: [false, true, false, false] },
                      { text: '', border: [false, false, false, false] }
                    ]
                  ]
                },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 0,
                  paddingRight: () => 0,
                  paddingTop: () => 0,
                  paddingBottom: () => 0
                }
              }
            ]
          },
          {
            width: '52%',
            stack: [
              { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', fontSize: 10, bold: true, alignment: 'center' },
              { text: 'Độc lập - Tự do - Hạnh phúc', fontSize: 10, bold: true, alignment: 'center', margin: [0, 2, 0, 3] },
              {
                table: {
                  widths: ['*', 130, '*'],
                  body: [
                    [
                      { text: '', border: [false, false, false, false] },
                      { text: '', border: [false, true, false, false] },
                      { text: '', border: [false, false, false, false] }
                    ]
                  ]
                },
                layout: {
                  defaultBorder: false,
                  paddingLeft: () => 0,
                  paddingRight: () => 0,
                  paddingTop: () => 0,
                  paddingBottom: () => 0
                }
              }
            ]
          }
        ],
        margin: [0, 0, 0, 18]
      },
      { text: 'PHIẾU ĐĂNG KÝ ĐỀ TÀI CHÍNH THỨC', bold: true, fontSize: 14, alignment: 'center' },
      { text: programHeading, bold: true, fontSize: 13, alignment: 'center', margin: [0, 3, 0, 0] },
      ...(roundHeading
        ? [{ text: roundHeading, bold: true, fontSize: 13, alignment: 'center', margin: [0, 2, 0, 16] }]
        : [{ text: '', margin: [0, 0, 0, 16] }]),

      // Thông tin sinh viên (inline, không bold nhãn & giá trị)
      {
        columns: [
          {
            width: '60%',
            text: [
              { text: 'HỌ VÀ TÊN : ', bold: false, fontSize: 12 },
              { text: identity.fullName || '', bold: false, fontSize: 12 }
            ]
          },
          {
            width: '40%',
            text: [
              { text: 'MSSV: ', bold: false, fontSize: 12 },
              { text: identity.mssv || '', bold: false, fontSize: 12 }
            ]
          }
        ],
        margin: [0, 0, 0, 7]
      },
      {
        columns: [
          {
            width: '46%',
            text: [
              { text: 'LỚP : ', bold: false, fontSize: 12 },
              { text: studentClass, bold: false, fontSize: 12 }
            ]
          },
          {
            width: '54%',
            text: [
              { text: 'NGÀNH: ', bold: false, fontSize: 12 },
              { text: reg.major || identity.major || 'Thiết kế nội thất', bold: false, fontSize: 12 }
            ]
          }
        ],
        margin: [0, 0, 0, 7]
      },
      {
        text: [
          { text: 'EMAIL: ', bold: false, fontSize: 12 },
          { text: reg.personalEmail || identity.email || '', bold: false, fontSize: 12 }
        ],
        margin: [0, 0, 0, 7]
      },
      {
        text: [
          { text: 'ĐIỆN THOẠI: ', bold: false, fontSize: 12 },
          { text: reg.studentPhone || '', bold: false, fontSize: 12 }
        ],
        margin: [0, 0, 0, 7]
      },
      {
        text: [
          { text: 'ĐỊA CHỈ : ', bold: false, fontSize: 12 },
          { text: studentAddress, bold: false, fontSize: 12 }
        ],
        margin: [0, 0, 0, 7]
      },
      {
        columns: [
          {
            width: '46%',
            text: [
              { text: 'MÔN HỌC: ', bold: false, fontSize: 12 },
              { text: reg.courseName || reg.projectType || 'Đồ án tốt nghiệp', bold: false, fontSize: 12 }
            ]
          },
          {
            width: '34%',
            text: [
              { text: 'MÃ MÔN HỌC: ', bold: false, fontSize: 12 },
              { text: reg.courseCode || '', bold: false, fontSize: 12 }
            ]
          },
          {
            width: '20%',
            text: [
              { text: 'NHÓM: ', bold: false, fontSize: 12 },
              { text: reg.courseGroup || '1', bold: false, fontSize: 12 }
            ]
          }
        ],
        margin: [0, 0, 0, 12]
      },
      {
        text: `Đăng ký đề tài chính thức lần thứ : ${activeVersion}`,
        italics: true,
        fontSize: 12,
        alignment: 'center',
        margin: [0, 0, 0, 12]
      },
      {
        text: [
          { text: 'TÊN ĐỀ TÀI : ', bold: true, fontSize: 12 },
          { text: activeTitle || '', bold: false, fontSize: 12 }
        ],
        lineHeight: 1.35,
        margin: [0, 0, 0, 12]
      },
      {
        text: 'MÔ TẢ CHI TIẾT ĐỊNH HƯỚNG THIẾT KẾ CỦA ĐỀ TÀI :',
        bold: true,
        alignment: 'center',
        fontSize: 12,
        margin: [0, 0, 0, 8]
      },
      {
        text: descriptionText,
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
        table: {
          widths: ['50%', '50%'],
          body: [
            [
              {
                stack: [
                  { text: 'Ý KIẾN CỦA GIẢNG VIÊN HƯỚNG DẪN', bold: true, fontSize: 12, alignment: 'center' }
                ]
              },
              {
                stack: [
                  { text: `Tp.HCM, ngày ${dd} tháng ${mm} năm ${yyyy}`, italics: true, fontSize: 11, alignment: 'center' },
                  { text: 'NGƯỜI ĐĂNG KÝ', bold: true, fontSize: 12, alignment: 'center', margin: [0, 2, 0, 0] },
                  { text: '(ký và ghi rõ họ tên)', italics: true, fontSize: 10, alignment: 'center', margin: [0, 1, 0, 0] }
                ]
              }
            ],
            [
              { text: '', margin: [0, 0, 0, 75] },
              { text: '', margin: [0, 0, 0, 75] }
            ],
            [
              { text: supervisorName || '', bold: false, fontSize: 12, alignment: 'center' },
              { text: identity.fullName || '', bold: false, fontSize: 12, alignment: 'center' }
            ]
          ]
        },
        layout: 'noBorders'
      }
    ],
    styles: {}
  };

  const safeId = String(identity.mssv || 'sinh-vien').replace(/[^0-9A-Za-z_-]/g, '');
  window.pdfMake.createPdf(docDefinition).download(`Phieu-dang-ky-de-tai-${safeId}-lan-${activeVersion}.pdf`);
};

export {
  loadStudentSelfProfile,
  getRegistrationStudentIdentity,
  resolveOfficialStudentFullName,
  resolveOfficialSupervisorName,
  getApprovedTopicVersions,
  populateRegistrationStudentForm,
  collectOfficialFormFields,
  validateOfficialFormFields,
  ensureTimesFontLoaded
};

if (typeof window !== 'undefined') {
  window.loadStudentSelfProfile = loadStudentSelfProfile;
  window.getRegistrationStudentIdentity = getRegistrationStudentIdentity;
  window.resolveOfficialStudentFullName = resolveOfficialStudentFullName;
  window.resolveOfficialSupervisorName = resolveOfficialSupervisorName;
  window.getApprovedTopicVersions = getApprovedTopicVersions;
  window.populateRegistrationStudentForm = populateRegistrationStudentForm;
  window.collectOfficialFormFields = collectOfficialFormFields;
  window.validateOfficialFormFields = validateOfficialFormFields;
  window.ensureTimesFontLoaded = ensureTimesFontLoaded;
}
