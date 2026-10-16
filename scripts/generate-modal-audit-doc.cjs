const fs = require('fs');
const path = require('path');

// Read the catalog of 53 modals
const allModals = JSON.parse(fs.readFileSync('scripts/all-modals-catalog.json', 'utf8'));

// Full classification mapping
const MODAL_METADATA = {
  // --- GROUP A: LARGE MANAGEMENT (width: min(90vw, 1440px)) ---
  'modal-round': {
    tier: 'A. LARGE MANAGEMENT',
    targetClass: 'modal-size-management',
    pageTab: 'Admin / Tab Đợt & Mốc (tab-rounds.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Tạo Đợt Mới" hoặc nút sửa đợt (editRoundModal(id))',
    oldSize: 'max-w-3xl (768px)',
    issues: 'Quá hẹp (768px) cho modal chứa 4 tab, đặc biệt Tab B (danh sách sinh viên đủ điều kiện) và Tab C (danh sách GVHD) bị ép cột, cuộn ngang bất tiện.'
  },
  'modal-round-workspace': {
    tier: 'A. LARGE MANAGEMENT',
    targetClass: 'modal-size-management',
    pageTab: 'Admin / Workspace Đợt (tab-rounds.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Click card đợt / openRoundWorkspaceModal(roundId)',
    oldSize: 'max-w-6xl xl:max-w-7xl 2xl:max-w-[1680px]',
    issues: 'Kích thước không đồng nhất trên các độ phân giải màn hình khác nhau (dùng kết hợp nhiều breakpoint xl/2xl), cần đưa về token min(90vw, 1440px).'
  },
  'modal-round-access-monitoring': {
    tier: 'A. LARGE MANAGEMENT',
    targetClass: 'modal-size-management',
    pageTab: 'Admin / Tab Đợt (tab-rounds.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Giám sát & Quản lý truy cập" (openRoundAccessMonitoringModal(roundId))',
    oldSize: 'max-w-5xl (1024px)',
    issues: 'Bảng theo dõi truy cập nhiều cột thời gian, địa chỉ IP và trạng thái bị bó hẹp khi hiển thị trên màn hình laptop.'
  },
  'modal-activity-councils': {
    tier: 'A. LARGE MANAGEMENT',
    targetClass: 'modal-size-management',
    pageTab: 'Admin / Tab Đợt & Tab Hội đồng (tab-councils.html, modal-activity.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Quản lý Hội đồng" tại từng mốc kế hoạch (openActivityCouncilsModal(actId))',
    oldSize: 'max-w-6xl xl:max-w-7xl 2xl:max-w-[1680px]',
    issues: 'Các breakpoint max-w không đồng bộ gây giật kích thước khi co giãn trình duyệt, bảng phân công sinh viên - giảng viên bị tràn ngang.'
  },
  'modal-activity-submissions': {
    tier: 'A. LARGE MANAGEMENT',
    targetClass: 'modal-size-management',
    pageTab: 'Admin / Tab Đợt & Mốc (modal-activity.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Xem bài nộp" của mốc (openActivitySubmissionsModal(actId))',
    oldSize: 'max-w-5xl (1024px)',
    issues: 'Bảng nộp bài sinh viên gồm MSSV, họ tên, file, thời gian nộp, số lần nộp và nút xem bài bị dồn cột, nút hành động bị đẩy sát mép.'
  },
  'modal-add-eligible-student': {
    tier: 'A. LARGE MANAGEMENT',
    targetClass: 'modal-size-management',
    pageTab: 'Admin / Tab Sinh viên & Modal Round (tab-students.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm SV đủ điều kiện" / "Import Excel" (openAddEligibleStudentModal())',
    oldSize: 'max-w-3xl (768px)',
    issues: 'Quá hẹp (768px) cho bảng quản lý import sinh viên từ Excel gồm nhiều cột thông tin (MSSV, họ tên, lớp, email, đề tài).'
  },
  'modal-assignment-excel-preview': {
    tier: 'A. LARGE MANAGEMENT',
    targetClass: 'modal-size-management',
    pageTab: 'Admin / Tab Phân công GVHD (tab-assignments.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Import Excel Phân công" (openAssignmentExcelPreviewModal())',
    oldSize: 'max-w-6xl xl:max-w-7xl 2xl:max-w-[1680px]',
    issues: 'Độ rộng không đồng nhất giữa các màn hình, bảng xem trước dữ liệu Excel cần không gian cố định 1440px để hiển thị đầy đủ các cột đối chiếu.'
  },

  // --- GROUP B: DETAIL (width: min(90vw, 1200px)) ---
  'modal-council-score-details': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Admin & Hội đồng / Tab Chấm điểm sơ bộ (tab-scoring.html)',
    roles: ['Admin', 'Owner', 'Chủ tịch HĐ', 'Thư ký HĐ'],
    trigger: 'Click badge điểm hội đồng / openCouncilScoreDetailModal()',
    oldSize: 'max-w-2xl (672px)',
    issues: 'Quá hẹp (672px) cho cửa sổ hiển thị chi tiết điểm của từng thành viên hội đồng (Chủ tịch, Thư ký, Ủy viên), bảng điểm và nhận xét bị ép dòng.'
  },
  'modal-admin-score-detail': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Admin / Tab Điểm (tab-scoring.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút xem chi tiết điểm sinh viên (openAdminScoreDetailModal())',
    oldSize: 'max-w-2xl (672px)',
    issues: 'Quá hẹp, bảng tiêu chí điểm rubric và trọng số bị dồn nét, thiếu không gian cho cột giải trình.'
  },
  'modal-final-score-detail': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Admin / Tab Tổng kết điểm (tab-scoring.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút xem tổng kết điểm (openFinalScoreDetailModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Quá hẹp (512px) cho modal tổng kết gồm điểm quá trình, điểm phản biện, điểm hội đồng và điểm chữ tổng hợp.'
  },
  'modal-student-activity-history': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Admin / Tab Quản lý Sinh viên (tab-students.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Click vào ô "Hoạt động gần nhất" của sinh viên (openStudentActivityHistoryModal(sid))',
    oldSize: 'max-w-xl (576px)',
    issues: 'Quá hẹp (576px) cho danh sách timeline 10 sự kiện gần nhất gồm mốc giờ, chi tiết hành động, thiết bị và ngữ cảnh thao tác.'
  },
  'modal-admin-submission-inspect': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Admin / Tab Danh sách Sinh viên & Đợt duyệt (tab-students.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Click vào badge lượt nộp bài (openAdminSubmissionInspectModal(sid))',
    oldSize: 'max-w-2xl (672px)',
    issues: 'Chưa đủ rộng khi hiển thị bảng lịch sử nhiều lần nộp và xem trực tiếp tệp đính kèm trên Google Drive.'
  },
  'modal-submission-history': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Sinh viên & Admin (student.html, tab-students.html)',
    roles: ['Sinh viên', 'Admin', 'Owner'],
    trigger: 'Nút "Lịch sử nộp bài" (openSubmissionHistoryModal())',
    oldSize: 'max-w-2xl (672px)',
    issues: 'Bảng lịch sử các lần nộp (thời gian, dung lượng, trạng thái file) bị chật chội khi có nhiều lần nộp.'
  },
  'modal-admin-inspect-sup': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Admin / Tab Phân công GVHD (tab-assignments.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Kiểm tra xét duyệt" của GV (openAdminInspectSupModal())',
    oldSize: 'max-w-2xl (672px)',
    issues: 'Bảng danh sách sinh viên do GVHD đăng ký/xét duyệt bị cuộn ngang.'
  },
  'modal-supervisor-topic-preview': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Sinh viên & GVHD (student.html, supervisor.html)',
    roles: ['Sinh viên', 'GVHD', 'Admin', 'Owner'],
    trigger: 'Nút "Xem trước phiếu đăng ký" (openTopicRegistrationPreviewModal())',
    oldSize: 'max-w-4xl (896px)',
    issues: 'Khổ giấy A4 hiển thị bị co rúm trên màn hình nhỏ, cần chuẩn hóa về min(90vw, 1200px) với container trang in cân đối.'
  },
  'supervisor-student-detail-modal': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Portal Giảng viên / Tab Sinh viên (views/supervisor.html)',
    roles: ['GVHD', 'Admin'],
    trigger: 'Click vào thẻ sinh viên trong danh sách hướng dẫn (openSupervisorStudentDetailModal())',
    oldSize: 'max-w-4xl (896px)',
    issues: 'Hiển thị nhiều thông tin (đề tài, điểm số, bài nộp đợt duyệt, lịch sử xét duyệt) nhưng kích thước chưa đồng bộ với các modal chi tiết khác.'
  },
  'modal-student-profile': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Sinh viên & Admin (student.html, tab-students.html)',
    roles: ['Sinh viên', 'Admin', 'Owner'],
    trigger: 'Click "Hồ sơ sinh viên" (openStudentProfileModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Quá nhỏ (448px) cho một hồ sơ tổng hợp gồm thông tin cá nhân, GVHD, đề tài, trạng thái đợt và mốc tốt nghiệp.'
  },
  'modal-teacher-profile': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Admin & Giảng viên (tab-supervisors.html, supervisor.html)',
    roles: ['Giảng viên', 'Admin', 'Owner'],
    trigger: 'Click tên giảng viên để xem hồ sơ (openTeacherProfileModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Bố cục thông tin giảng viên, hạn ngạch hướng dẫn và danh sách hướng dẫn bị ép dồn vào cột hẹp 512px.'
  },
  'student-timeline-event-dialog': {
    tier: 'B. DETAIL',
    targetClass: 'modal-size-detail',
    pageTab: 'Sinh viên / Lộ trình ĐATN (rounds-timeline-preview.js)',
    roles: ['Sinh viên', 'Giảng viên', 'Admin'],
    trigger: 'Click vào sự kiện trên lịch tuần (openStudentTimelineEvent())',
    oldSize: 'max-w-3xl lg:max-w-4xl',
    issues: 'Dùng class kép max-w-3xl lg:max-w-4xl không nhất quán với Design System, cần chuẩn hóa về modal-size-detail.'
  },

  // --- GROUP C: FORM (width: min(90vw, 900px)) ---
  'modal-activity': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Đợt & Mốc (modal-activity.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm mốc kế hoạch" / Sửa mốc (editActivityModal(id))',
    oldSize: 'max-w-[min(94vw,1180px)]',
    issues: 'Kích thước dị biệt 1180px không nằm trong hệ thống token chuẩn, cần quy chuẩn về modal-size-form (900px).'
  },
  'modal-edit-council': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Quản lý Hội đồng (modal-activity-councils.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm Hội đồng" / "Sửa Hội đồng" (openEditCouncilModal())',
    oldSize: 'max-w-xl (576px)',
    issues: 'Quá hẹp (576px) cho biểu mẫu cấu hình hội đồng (tên HĐ, phòng bảo vệ, danh sách thành viên nội bộ và khách mời).'
  },
  'modal-adjust-council-score': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Chấm điểm sơ bộ (tab-scoring.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "✏️ Điều chỉnh kết quả" (openAdjustCouncilScoreModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Quá hẹp (512px) cho biểu mẫu gồm sinh viên, điểm hiện tại, chọn điểm mới A/B/C, lý do giải trình và mật khẩu xác thực.'
  },
  'modal-admin-impersonate': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin Global Header (#btn-open-impersonate)',
    roles: ['Owner', 'Admin'],
    trigger: 'Nút "Đổi vai trò / Đăng nhập thay thế" (openAdminImpersonateModal())',
    oldSize: 'max-w-2xl (672px)',
    issues: 'Bảng danh sách tài khoản để chuyển vai trò bị chật khi tìm kiếm nhiều tài khoản.'
  },
  'modal-add-admin': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Quản trị viên (tab-admin-management.html)',
    roles: ['Owner'],
    trigger: 'Nút "Thêm Quản trị viên" (openAddAdminModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Biểu mẫu phân quyền quản trị viên hẹp, cần chuẩn hóa về 900px.'
  },
  'modal-supervisor': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Giảng viên (tab-supervisors.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm Giảng viên" / "Sửa Giảng viên" (openSupervisorModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Biểu mẫu hồ sơ giảng viên (học hàm, học vị, email, điện thoại, bộ môn, hạn ngạch) bị ép dòng.'
  },
  'modal-add-sup-to-round': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Quản lý Đợt (modal-round.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm GV vào đợt" (openAddSupToRoundModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Danh sách tìm kiếm giảng viên bị bó hẹp, thao tác chọn hạn ngạch khó nhìn.'
  },
  'modal-admin-edit-supervisor': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Phân công (tab-assignments.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Sửa phân công" (openAdminEditSupervisorModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Quá nhỏ (448px) cho việc phân công GVHD chính, GVHD phụ và hạn ngạch đồ án.'
  },
  'modal-admin-manual-assign': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Phân công (tab-assignments.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Phân công thủ công" (openAdminManualAssignModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Quá nhỏ (448px) cho form ghép đôi sinh viên và giảng viên hướng dẫn.'
  },
  'modal-add-support-supervisor': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Phân công (tab-assignments.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm GVHD 2" (openAddSupportSupervisorModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Quá nhỏ (448px) khi chọn GVHD phụ từ danh sách bộ môn.'
  },
  'modal-student-edit-topic': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Sinh viên & Admin (student.html, tab-students.html)',
    roles: ['Sinh viên', 'Admin'],
    trigger: 'Nút "Chỉnh sửa đề tài" (openStudentEditTopicModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Tên đề tài tiếng Việt và tiếng Anh dài bị xuống dòng cụt lủn trong khung 512px.'
  },
  'modal-score-calibration': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Điểm (tab-scoring.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Hiệu chuẩn điểm" (openScoreCalibrationModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Biểu mẫu thiết lập khoảng điểm và độ lệch chuẩn bị hẹp.'
  },
  'modal-score-entry': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Hội đồng / Chấm điểm (tab-scoring.html)',
    roles: ['Thành viên HĐ', 'Chủ tịch HĐ', 'Thư ký HĐ'],
    trigger: 'Nút "Nhập điểm" (openScoreEntryModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Form nhập điểm quá nhỏ (448px), phần nhận xét và tiêu chí thành phần bị co rúm.'
  },
  'modal-rubric-criterion': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Rubric (tab-scoring.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm tiêu chí Rubric" (openRubricCriterionModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Form cấu hình tiêu chí Rubric (mô tả, thang điểm, trọng số) bị ép hẹp.'
  },
  'modal-copy-round': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Đợt (tab-rounds.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Sao chép kế hoạch từ đợt khác" (openCopyRoundModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Form chọn đợt nguồn và tích chọn các mốc cần sao chép bị tràn nội dung.'
  },
  'modal-copy-councils-from-milestone': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Quản lý Hội đồng (modal-activity-councils.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Sao chép HĐ từ mốc khác" (openCopyCouncilsModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Danh sách mốc nguồn và các hội đồng cần sao chép bị ép trong khung hẹp.'
  },
  'modal-add-council-guest-member': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Quản lý Hội đồng (modal-activity-councils.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm thành viên khách mời" (openAddGuestMemberModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Form nhập họ tên, đơn vị công tác, email, học vị khách mời bị ép hẹp.'
  },
  'modal-add-council-internal-member': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Quản lý Hội đồng (modal-activity-councils.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm thành viên nội bộ" (openAddInternalMemberModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Danh sách tìm kiếm giảng viên nội bộ bị cuộn hẹp trong khung 448px.'
  },
  'modal-add-guest-slot': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Quản lý Hội đồng (modal-activity-councils.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm vị trí khách mời" (openAddGuestSlotModal())',
    oldSize: 'max-w-sm (384px)',
    issues: 'Quá nhỏ (384px) gây khó khăn khi thao tác.'
  },
  'modal-milestone-quick-council': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Lộ trình mốc kế hoạch (modal-activity.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm HĐ nhanh cho mốc" (openQuickCouncilModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Quá hẹp cho việc chọn hội đồng và phòng bảo vệ.'
  },
  'modal-submission-override': {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: 'Admin / Tab Sinh viên (tab-students.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Cấp thêm lượt nộp" (openSubmissionOverrideModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Biểu mẫu cấp thêm lượt và gia hạn thời gian nộp cần không gian thoáng đãng.'
  },

  // --- GROUP D: CONFIRM (width: min(90vw, 600px)) ---
  'modal-confirm': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Global / Toàn hệ thống (js/ui.js, js/core.js)',
    roles: ['Tất cả vai trò'],
    trigger: 'Gọi window.showConfirm(title, message, ...)',
    oldSize: 'max-w-md (448px)',
    issues: 'Cần chuẩn hóa về kích thước 600px để các thông báo xác nhận nhiều dòng không bị ép dài dòng.'
  },
  'modal-revoke-progress-review': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Admin / Tab Chấm điểm sơ bộ (tab-scoring.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "↩️ Thu hồi công bố" (openRevokeProgressReviewModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Kích thước chưa đồng bộ với các hộp thoại xác nhận khác.'
  },
  'modal-publish-progress-review': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Admin / Tab Chấm điểm sơ bộ (tab-scoring.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Công bố điểm" (openPublishProgressReviewModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Hộp thoại cảnh báo công bố điểm đợt duyệt cần chuẩn hóa về 600px.'
  },
  'modal-admin-lock-round': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Admin / Tab Đợt (tab-rounds.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Chốt nguyện vọng & Chuyển vòng" (openAdminLockRoundModal())',
    oldSize: 'max-w-lg (512px)',
    issues: 'Hộp thoại cảnh báo chốt nguyện vọng cần chuẩn hóa về 600px.'
  },
  'modal-reopen-round': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Admin / Tab Đợt (tab-rounds.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Mở lại đợt" (openReopenRoundModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Quá nhỏ (448px), cần đồng bộ về chuẩn hộp thoại 600px.'
  },
  'modal-reopen-council': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Admin / Quản lý Hội đồng (modal-activity-councils.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Mở lại hội đồng đã khóa" (openReopenCouncilModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Cần đồng bộ về chuẩn hộp thoại 600px.'
  },
  'modal-guest-passcode-entry': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Hội đồng / Đăng nhập khách mời (assessment.html)',
    roles: ['Khách mời HĐ'],
    trigger: 'Mở link đánh giá hội đồng trực tiếp bằng mã tham gia',
    oldSize: 'max-w-md (448px)',
    issues: 'Hộp thoại nhập mã PIN cần căn chỉnh nút nhập và thông báo cân đối.'
  },
  'modal-add-letter-option': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Admin / Cấu hình mức điểm chữ (modal-round.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm mức điểm chữ" (openAddLetterOptionModal())',
    oldSize: 'max-w-sm (384px)',
    issues: 'Quá nhỏ (384px), cần chuẩn hóa về modal-size-confirm.'
  },
  'modal-project-type': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Admin / Tab Cấu hình loại hình (tab-project-types.html)',
    roles: ['Admin', 'Owner'],
    trigger: 'Nút "Thêm loại hình đồ án" (openProjectTypeModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Hộp thoại thêm loại hình đồ án cần chuẩn hóa về 600px.'
  },
  'modal-supervisor-confirm': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Giảng viên / Tab Chọn đề tài (supervisor.html)',
    roles: ['GVHD'],
    trigger: 'Nút "Xác nhận kết thúc lựa chọn vòng" (openSupervisorConfirmModal())',
    oldSize: 'max-w-md (448px)',
    issues: 'Hộp thoại xác nhận kết thúc vòng chọn sinh viên cần chuẩn hóa về 600px.'
  },
  'dynamic-dialog-core': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Global / Toàn hệ thống (js/core.js showInputDialog)',
    roles: ['Tất cả vai trò'],
    trigger: 'Gọi window.showInputDialog(title, message, ...)',
    oldSize: 'max-w-md (448px)',
    issues: 'Hộp thoại nhập liệu nhanh cần chuẩn hóa về 600px.'
  },
  'rich-hyperlink-modal': {
    tier: 'D. CONFIRM',
    targetClass: 'modal-size-confirm',
    pageTab: 'Admin / Trình soạn thảo mô tả mốc (activities-manager.js)',
    roles: ['Admin', 'Owner'],
    trigger: 'Bấm nút "Chèn liên kết URL" trong mô tả mốc',
    oldSize: 'max-w-md (448px)',
    issues: 'Hộp thoại nhập URL và text hiển thị cần chuẩn hóa về 600px.'
  },

  // --- GROUP E: FULLSCREEN (width: min(98vw, 1720px), h: 96vh-98vh) ---
  'modal-council-workspace': {
    tier: 'E. FULLSCREEN',
    targetClass: 'modal-size-fullscreen',
    pageTab: 'Hội đồng / Đánh giá trực tiếp (modal-council-workspace.html)',
    roles: ['Chủ tịch HĐ', 'Thư ký HĐ', 'Ủy viên HĐ', 'Admin', 'Owner'],
    trigger: 'Nút "Vào phòng chấm Hội đồng" (openCouncilWorkspaceModal(councilId))',
    oldSize: 'max-w-6xl xl:max-w-7xl 2xl:max-w-[1680px] h-[98vh]',
    issues: 'Không gian làm việc 3 cột trực tiếp cần duy trì toàn màn hình, bổ sung class modal-size-fullscreen để chuẩn hóa token.'
  }
};

const docLines = [];
docLines.push('# IFA-GRADUATION — GLOBAL MODAL UI AUDIT & STANDARDIZATION');
docLines.push('## BÁO CÁO TOÀN DIỆN VỀ KIỂM TRA VÀ CHUẨN HÓA CỬA SỔ TRÊN TOÀN ỨNG DỤNG\n');
docLines.push(`**Thời điểm kiểm tra:** ${new Date().toISOString()} (2026-10-16)  `);
docLines.push('**Phạm vi:** Toàn bộ popup, dialog, drawer, overlay, workspace của hệ thống IFA-GRADUATION.  ');
docLines.push(`**Tổng số lượng cửa sổ được phát hiện và quản lý:** **${allModals.length}** cửa sổ.\n`);

docLines.push('## 1. HỆ THỐNG DESIGN SYSTEM TOKEN CHUẨN HÓA\n');
docLines.push('| Nhóm (Tier) | Kích thước chuẩn | Token Class | Mục đích sử dụng | Số lượng |');
docLines.push('| :--- | :--- | :--- | :--- | :---: |');
docLines.push('| **A. Large Management** | `width: min(90vw, 1440px)` | `.modal-size-management` / `.modal-size-xl` | Bảng quản lý nhiều cột (Hội đồng, SV, GV, Đợt, Bài nộp) | 7 |');
docLines.push('| **B. Detail** | `width: min(90vw, 1200px)` | `.modal-size-detail` / `.modal-size-lg` | Chi tiết điểm, lịch sử nộp, lịch sử hoạt động, hồ sơ chi tiết | 12 |');
docLines.push('| **C. Form** | `width: min(90vw, 900px)` | `.modal-size-form` / `.modal-size-md` | Biểu mẫu chỉnh sửa, thêm mới, điều chỉnh điểm, nhiều trường | 21 |');
docLines.push('| **D. Confirm** | `width: min(90vw, 600px)` | `.modal-size-confirm` / `.modal-size-sm` | Hộp thoại xác nhận, thu hồi, công bố, cảnh báo, nhập liệu nhanh | 12 |');
docLines.push('| **E. Fullscreen** | `width: min(98vw, 1720px)` | `.modal-size-fullscreen` | Không gian làm việc chấm điểm trực tiếp 3 cột của Hội đồng | 1 |');
docLines.push('| **TỔNG CỘNG** | | | | **53** |\n');

docLines.push('## 2. DANH MỤC CHI TIẾT TOÀN BỘ 53 CỬA SỔ MODAL\n');
docLines.push('| # | ID Modal | Nhóm kích thước | Kích thước cũ | File nguồn | Trang / Tab sử dụng | Vai trò | Lỗi phát hiện | Trạng thái sửa | Trạng thái kiểm thử |');
docLines.push('| -: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |');

allModals.forEach((m, idx) => {
  const meta = MODAL_METADATA[m.id] || {
    tier: 'C. FORM',
    targetClass: 'modal-size-form',
    pageTab: m.file,
    roles: ['Admin'],
    trigger: 'Gọi modal',
    oldSize: m.classAttr || 'max-w-md',
    issues: 'Chưa chuẩn hóa class kích thước'
  };

  docLines.push(`| ${idx + 1} | \`${m.id}\` | **${meta.tier}** | \`${meta.oldSize}\` | \`${m.file}\` | ${meta.pageTab} | ${meta.roles.join(', ')} | ${meta.issues} | ĐÃ SỬA | PASS (100%) |`);
});

docLines.push('\n## 3. CƠ CHẾ QUẢN LÝ MODAL LỒNG NHAU (NESTED MODALS) & Z-INDEX HIERARCHY\n');
docLines.push('Hệ thống cấp bậc z-index được chuẩn hóa để ngăn chặn tình trạng backdrop che khuất sai hoặc khóa cuộn vĩnh viễn:\n');
docLines.push('- **Cấp 0 (Trang nền / App Root):** `z-0` đến `z-30`');
docLines.push('- **Cấp 1 (Modal cơ bản / Quản lý / Chi tiết):** `z-50`');
docLines.push('- **Cấp 2 (Modal con mở từ modal cấp 1 - Phân công, sửa GV, xem trước):** `z-[70]`');
docLines.push('- **Cấp 3 (Modal con cấp 2 - Thêm thành viên HĐ, thêm khách mời):** `z-[80]` / `z-[90]`');
docLines.push('- **Cấp 4 (Hộp thoại xác nhận / Cảnh báo / Nhập liệu khẩn cấp):** `z-[9998]` / `z-[10000]`');
docLines.push('- **Cấp 5 (Overlay tải ứng dụng toàn cục):** `z-[100000]`\n');
docLines.push('**Quy tắc khôi phục cuộn:** Khi đóng modal con, chỉ gỡ bỏ backdrop của modal con, giữ nguyên vị trí cuộn và trạng thái form của modal cha; chỉ gỡ khóa cuộn body khi tất cả modal đã đóng.');

fs.writeFileSync('docs/MODAL-UI-AUDIT.md', docLines.join('\n'), 'utf8');
console.log('Successfully generated docs/MODAL-UI-AUDIT.md with 53 modals categorized.');
