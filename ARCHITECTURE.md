# KIẾN TRÚC HỆ THỐNG IFA+ GRADUATION (ARCHITECTURE.MD)

> **Hệ thống Quản lý Đồ án Tốt nghiệp (ĐATN)** — Khoa Mỹ thuật Công nghiệp, Trường Đại học Tôn Đức Thắng (TDTU).

---

## 1. TỔNG QUAN VÀ SƠ ĐỒ CẤU TRÚC THƯ MỤC

Dự án được xây dựng theo mô hình **Single Page Application (SPA)** module hóa cao cấp bằng **ES Modules** và kiến trúc **Modular HTML Partials** (biên dịch hoặc nạp partials độc lập).

```
IFA-GRADUATION/
├── app.js                          # Điểm vào chính của JavaScript (Orchestrator Entry Point)
├── index.template.html             # Khung HTML gốc chứa các điểm neo PARTIAL
├── index.html                      # File HTML hoàn chỉnh sinh ra từ các partials
├── styles.css                      # Tailwind base & các quy tắc typography in ấn A4
├── package.json                    # Cấu hình scripts (build, test, emulators)
├── firestore.rules                 # Phân quyền bảo mật Firestore
│
├── views/                          # CÁC CỔNG GIAO DIỆN CHÍNH (4 Portals)
│   ├── student.html                # 🎓 Cổng Sinh viên (#view-student, Hero/Journey Cards, Stepper)
│   ├── supervisor.html             # 👨‍🏫 Cổng Giảng viên HD (#view-supervisor, Duyệt nguyện vọng)
│   ├── assessment.html             # 📝 Cổng Giảng viên Chấm thi (#view-assessment, Phiếu chấm)
│   ├── admin.html                  # ⚙️ Cổng Quản trị Viên Master Layout
│   └── admin/                      # 🗂️ Các Tab Quản trị Viên tách nhỏ
│       ├── tab-overview.html       # 📊 Tab Tổng quan thống kê & chỉ số
│       ├── tab-assignments.html    # 🎯 Tab Điều phối & Phân công GVHD
│       ├── tab-rounds.html         # 🗓️ Tab Quản lý Danh sách Đợt
│       ├── tab-timeline.html       # 📅 Tab Kế hoạch & Mốc tiến độ đợt
│       ├── tab-supervisors.html    # 👨‍🏫 Tab Danh mục GVHD & GVHD đợt
│       ├── tab-students.html       # 👥 Tab Danh sách SV khoa & SV đủ ĐK
│       ├── tab-project-types.html  # 🏷️ Tab Danh mục Loại đề tài
│       ├── tab-registrations.html  # 📋 Tab Đăng ký đề tài & Phiếu A4
│       ├── tab-scoring.html        # 💯 Tab Quản lý Điểm & Hội đồng
│       └── tab-settings.html       # ⚙️ Tab Cài đặt hệ thống & Thùng rác
│
├── templates/                      # THÀNH PHẦN MODAL VÀ DIALOGS THEO NHÓM
│   └── modals/
│       ├── rounds/                 # Modals Đợt tốt nghiệp & Mốc tiến độ
│       │   ├── modal-round.html                    # Modal Cấu hình đợt 4 Tabs (A, B, C, D)
│       │   ├── modal-round-workspace.html          # Modal Popup Workspace cho thẻ đợt
│       │   ├── modal-activity.html                 # Modal Tạo/Sửa Hoạt động & Mốc tiến độ
│       │   ├── modal-copy-round.html               # Modal Sao chép cấu hình đợt
│       │   ├── modal-admin-lock-round.html         # Modal Khóa/Đóng đợt
│       │   └── modal-reopen-round.html             # Modal Mở lại đợt đã đóng
│       │
│       ├── students/               # Modals Sinh viên & Hồ sơ
│       │   ├── modal-add-eligible-student.html     # Modal Thêm/Import SV đủ điều kiện
│       │   ├── modal-student-profile.html          # Modal Xem nhanh hồ sơ sinh viên
│       │   ├── modal-student-edit-topic.html       # Modal Sửa tên đề tài SV
│       │   └── modal-add-letter-option.html        # Modal Tùy chọn biểu mẫu
│       │
│       ├── supervisors/            # Modals Giảng viên Hướng dẫn & Phân công
│       │   ├── modal-supervisor.html               # Modal Thêm/Sửa GVHD danh mục
│       │   ├── modal-add-sup-to-round.html         # Modal Chọn GVHD tham gia đợt
│       │   ├── modal-supervisor-confirm.html       # Modal Xác nhận duyệt nguyện vọng
│       │   ├── modal-admin-inspect-sup.html        # Modal Soi chi tiết định mức GVHD
│       │   ├── modal-admin-edit-supervisor.html    # Modal Sửa thông tin GVHD
│       │   ├── modal-admin-manual-assign.html      # Modal Phân công thủ công GVHD
│       │   ├── modal-assignment-excel-preview.html # Modal Xem trước import Excel phân công
│       │   └── modal-add-support-supervisor.html   # Modal Thêm GVHD đồng hướng dẫn (GVHD 2)
│       │
│       ├── grading/                # Modals Hội đồng, Tiêu chí Rubric & Nhập điểm
│       │   ├── modal-activity-councils.html        # Modal Quản lý Hội đồng theo Mốc
│       │   ├── modal-edit-council.html             # Modal Tạo/Sửa Hội đồng & Thành viên
│       │   ├── modal-add-guest-slot.html           # Modal Thêm slot khách mời hội đồng
│       │   ├── modal-milestone-quick-council.html  # Modal Tạo nhanh hội đồng
│       │   ├── modal-add-council-internal-member.html # Modal Gán GV nội bộ vào HĐ
│       │   ├── modal-add-council-guest-member.html    # Modal Gán chuyên gia khách mời
│       │   ├── modal-council-workspace.html        # Modal Không gian làm việc Hội đồng
│       │   ├── modal-admin-score-detail.html       # Modal Chi tiết điểm sinh viên (Admin)
│       │   ├── modal-score-entry.html              # Modal Nhập điểm (Sơ khảo, GVHD, TM)
│       │   ├── modal-rubric-criterion.html         # Modal Tạo/Sửa tiêu chí Rubric
│       │   ├── modal-score-calibration.html        # Modal Hiệu chỉnh điểm & Phúc khảo
│       │   ├── modal-reopen-council.html           # Modal Mở lại phiên chấm Hội đồng
│       │   ├── modal-guest-passcode-entry.html     # Modal Đăng nhập Mã chấm thi Khách
│       │   └── modal-final-score-detail.html       # Modal Bảng điểm tổng kết & Xếp loại
│       │
│       └── shared/                 # Modals Dùng chung & Kiểm thử
│           ├── modal-project-type.html             # Modal Quản lý Danh mục Loại đề tài
│           ├── modal-teacher-profile.html          # Modal Xem hồ sơ giảng viên (Shared SV/GVHD/Admin)
│           ├── modal-topic-preview.html            # Modal Xem phiếu đăng ký đề tài A4 (Shared SV/GVHD)
│           ├── modal-confirm.html                  # Modal Xác nhận cảnh báo hành động nguy hiểm
│           ├── modal-activity-submissions.html     # Modal Danh sách nộp bài theo mốc
│           ├── modal-submission-override.html      # Modal Ghi đè/Nộp bù bài cho sinh viên
│           ├── modal-submission-history.html       # Modal Lịch sử các phiên bản nộp bài
│           └── modal-admin-impersonate.html        # Modal Đóng vai Exact Act-As Test Mode
│
├── js/                             # CÁC MODULE JAVASCRIPT THEO NGHIỆP VỤ (< 1.000 dòng/file)
│   ├── core.js                     # Khởi tạo Firebase, State toàn cục, Toast & Utilities
│   ├── ui.js                       # Logic UI dùng chung, Theme, Format tiền tệ / ngày tháng
│   ├── auth.js                     # Phân quyền, Router Cổng (Switch View), Session Listener
│   ├── impersonation.js            # Chế độ đóng vai "Exact Act-As" Master Bridge
│   │   ├── impersonation-session.js   # Vòng đời phiên đóng vai & điều hướng
│   │   ├── impersonation-settings.js  # Cấu hình hệ thống & realtime sync
│   │   └── impersonation-modal.js    # Modal chọn nhân vật & tìm kiếm
│   ├── drive.js                    # Tự động hóa Google Drive API Master Bridge
│   │   ├── drive-provisioning.js      # Bridge tạo thư mục & upload
│   │   │   ├── drive-provisioning-folders.js # Tạo cây thư mục Drive đợt
│   │   │   ├── drive-rules-naming.js         # Mẫu tên file & quy tắc nộp
│   │   │   └── drive-upload-panel.js         # Bộ nạp & bảng nộp bài SV
│   │   └── drive-files.js             # Quản lý file & link download
│   ├── planning.js                 # Kế hoạch 12 tuần, Mốc tiến độ Master Bridge
│   │   ├── activities-manager.js      # Quản lý CRUD mốc kế hoạch & modal
│   │   ├── submissions.js             # Quản lý nộp bài & override hạn nộp
│   │   └── timeline-roadmap.js        # Thẻ lộ trình tuần & hoạt động
│   │
│   ├── rounds/                     # Subsystem Quản lý Đợt Tốt Nghiệp
│   │   ├── rounds-dashboard.js     # Master Bridge Dashboard
│   │   │   ├── rounds-loader.js           # Nạp đợt, Header & Đếm ngược
│   │   │   ├── rounds-timeline-preview.js # Lịch tuần & Preview sự kiện
│   │   │   └── rounds-cards.js            # Thẻ đợt Admin & Workspace modal
│   │   ├── rounds-config.js        # Master Bridge Cấu hình đợt
│   │   │   ├── rounds-modal-timeline.js   # Soạn thảo tiến độ tuần đợt
│   │   │   └── rounds-modal-form.js       # Form tạo/sửa đợt Tabs A-D
│   │   └── project-types.js        # CRUD Loại đề tài (Nội thất nhà ở, Thương mại...)
│   │
│   ├── students/                   # Subsystem Quản lý Sinh viên & Đăng ký
│   │   ├── students-master.js      # IFAA Student Master read-only resolver & cache
│   │   ├── student-eligibility.js  # Master Bridge SV đủ ĐK
│   │   │   ├── student-eligibility-modal.js   # Chọn ứng viên vào đợt
│   │   │   ├── student-eligibility-admin.js   # Bảng SV đủ ĐK & import Excel
│   │   │   └── student-registrations-admin.js # Bảng đăng ký Admin
│   │   ├── registration.js         # Quy trình nộp nguyện vọng, Stepper 3 bước
│   │   └── student-portal.js       # Master Bridge Cổng SV
│   │       ├── student-journey.js      # Stepper hành trình & thẻ tuần
│   │       ├── student-topic-pdf.js    # Phiếu đăng ký đề tài & in PDF
│   │       └── student-sidebar.js      # Sidebar cá nhân & hồ sơ
│   │
│   ├── supervisors/                # Subsystem Giảng viên Hướng dẫn & Phân công
│   │   ├── supervisors-master.js   # Danh mục GVHD, Quản lý ảnh chân dung
│   │   ├── supervisor-quotas.js    # Cấu hình Tab C, Tính toán hạn mức & chỉ tiêu động
│   │   ├── assignments.js          # Master Bridge Phân công
│   │   │   ├── assignments-matching.js # Duyệt nguyện vọng NV1-NV3
│   │   │   ├── assignments-admin.js    # Phân công thủ công Admin & GVHD 2
│   │   │   └── assignments-excel.js    # Import/Export Excel phân công
│   │   └── supervisor-portal.js    # Master Bridge Cổng GVHD
│   │       ├── supervisor-portal-core.js     # Khởi tạo cổng & chọn đợt
│   │       ├── supervisor-portal-students.js # Danh sách SV & modal chi tiết
│   │       └── supervisor-portal-topics.js   # Duyệt đề tài SV & xem trước
│   │
│   └── grading/                    # Subsystem Hội đồng & Chấm thi ĐATN
│       ├── councils.js             # Master Bridge Hội đồng
│       │   ├── councils-milestone.js   # Tạo nhanh HĐ từ mốc
│       │   ├── councils-workspace.js   # Workspace HĐ & chia phòng
│       │   └── councils-editor.js      # CRUD Hội đồng & slot khách
│       ├── rubrics.js              # Master Bridge Rubric
│       │   ├── rubrics-config.js       # Cấu hình tiêu chí Rubric
│       │   ├── rubrics-workspace.js    # Không gian chấm trực tiếp
│       │   └── rubrics-scoring.js      # Bảng điểm & giám sát Admin
│       ├── preliminary-scores.js   # Master Bridge Điểm Sơ khảo / GVHD / TM
│       │   ├── preliminary-entry.js     # Nhập điểm GVHD / TM / PB
│       │   ├── preliminary-dashboard.js # Bảng điểm sơ khảo Admin
│       │   └── preliminary-config.js    # Cấu hình tiêu chí & phân công PB
│       ├── defense-scores.js       # Phiếu chấm bảo vệ trực tiếp, Hiệu chỉnh điểm
│       ├── final-scores.js         # Master Bridge Điểm tổng kết
│       │   ├── final-scores-ranking.js      # Trọng số, Xếp hạng & Kết quả SV
│       │   ├── final-scores-export.js       # Xuất Excel tổng kết & HĐ
│       │   └── final-scores-transactions.js # Transaction ghi điểm an toàn
│       └── assessment-portal.js    # Cổng Giảng viên Chấm thi (#view-assessment)
│
└── scripts/                        # SCRIPTS BIÊN DỊCH VÀ KIỂM TRA
    ├── build-html.cjs              # Trình biên dịch index.template.html -> index.html
    └── ...                         # Scripts hỗ trợ testing và kiểm thử
```

---

## 2. QUY TẮC PHÁT TRIỂN & TRA CỨU NHANH KHI CẦN SỬA CHỨC NĂNG

Khi nhận được yêu cầu bảo trì hoặc nâng cấp một chức năng cụ thể, **chỉ cần mở đúng module JS và template HTML tương ứng**, không cần rà soát toàn bộ dự án:

| Nghiệp vụ cần chỉnh sửa | Module JavaScript cần mở | Template HTML tương ứng |
| :--- | :--- | :--- |
| **Đăng ký nguyện vọng / Nộp đề tài SV** | `js/students/registration.js` | `views/student.html` |
| **Giao diện Hero Card / Tiến độ ĐATN SV** | `js/students/student-portal.js` | `views/student.html` |
| **In phiếu đăng ký đề tài PDF** | `js/students/registration.js` | `styles.css` (in ấn A4) |
| **Danh bạ sinh viên từ IFAA** | `js/students/students-master.js` | `views/admin.html` (Tab SV) |
| **Import danh sách SV đủ điều kiện đợt** | `js/students/student-eligibility.js` | `templates/modals/students/modal-add-eligible-student.html` |
| **Duyệt đề tài / Phản hồi của GVHD** | `js/supervisors/supervisor-portal.js` | `views/supervisor.html` |
| **Phân công GVHD chính / GVHD 2** | `js/supervisors/assignments.js` | `templates/modals/supervisors/modal-admin-manual-assign.html` |
| **Danh mục GVHD & Ảnh chân dung** | `js/supervisors/supervisors-master.js` | `templates/modals/supervisors/modal-supervisor.html` |
| **Cấu hình Đợt tốt nghiệp (Tabs A, B, C, D)**| `js/rounds/rounds-config.js` | `templates/modals/rounds/modal-round.html` |
| **Thẻ đợt Dashboard & Danh mục Đợt** | `js/rounds/rounds-dashboard.js` | `views/admin.html` (Tab Đợt) |
| **Danh mục Loại đề tài** | `js/rounds/project-types.js` | `templates/modals/shared/modal-project-type.html` |
| **Hội đồng & Phân công phòng chấm** | `js/grading/councils.js` | `templates/modals/grading/modal-activity-councils.html` |
| **Cấu hình Tiêu chí Rubric & Trọng số**| `js/grading/rubrics.js` | `templates/modals/grading/modal-rubric-criterion.html` |
| **Nhập điểm Sơ khảo / Điểm GVHD / Điểm TM**| `js/grading/preliminary-scores.js` | `templates/modals/grading/modal-score-entry.html` |
| **Chấm điểm tại Hội đồng bảo vệ** | `js/grading/defense-scores.js` | `templates/modals/grading/modal-council-workspace.html` |
| **Bảng điểm tổng kết, Xếp hạng, Excel**| `js/grading/final-scores.js` | `templates/modals/grading/modal-final-score-detail.html` |
| **Cổng Giảng viên Chấm thi (Assessment)** | `js/grading/assessment-portal.js` | `views/assessment.html` |
| **Cây thư mục Google Drive & Nộp bài**| `js/drive.js` | `templates/modals/shared/modal-activity-submissions.html` |
| **Kế hoạch 12 tuần & Mốc tiến độ** | `js/planning.js` | `templates/modals/rounds/modal-activity.html` |
| **Chế độ đóng vai Exact Act-As Test** | `js/impersonation.js` | `templates/modals/shared/modal-admin-impersonate.html` |

---

## 3. KHỞI TẠO VÀ CƠ CHẾ CHIA SẺ TRẠNG THÁI

1. **Khởi tạo (App Bootstrap):**
   - File `app.js` đóng vai trò là Orchestrator nạp tuần tự 10 hệ thống con qua ES Modules.
   - Khi `DOMContentLoaded`, `js/core.js` khởi tạo kết nối Firebase (`db`, `auth`), nạp `state` ban đầu và kích hoạt `auth.js` để lắng nghe trạng thái đăng nhập `onAuthStateChanged`.
2. **Quản lý Trạng thái (Centralized State):**
   - Toàn bộ biến trạng thái chung được quản lý tập trung trong đối tượng `state` duy nhất định nghĩa tại `js/core.js`.
   - Các module cập nhật và đọc trực tiếp từ `state` (ví dụ `state.currentRound`, `state.myRegistration`, `state.supervisorsMaster`, `state.actAsUser`...).
3. **Cầu nối Toàn cục (`window.*` Bridge):**
   - Các hàm xử lý sự kiện được gọi trực tiếp từ HTML thông qua `onclick="..."` hoặc `onchange="..."` được gắn minh bạch lên `window.*` trong từng module chuyên trách.
   - Khi chỉnh sửa hoặc bổ sung hàm mới cho giao diện, cần khai báo `window.tenHam = ...` trong module tương ứng.

---

## 4. QUY TRÌNH BUILD VÀ DEPLOY

1. **Biên dịch HTML Partials:**
   ```bash
   npm run build
   ```
   Script `scripts/build-html.cjs` sẽ quét `index.template.html` và ghép toàn bộ 4 `views/*.html` cùng 39 `templates/modals/**/*.html` thành file `index.html` hoàn chỉnh sẵn sàng phục vụ.
2. **Chạy Kiểm thử Tự động:**
   ```bash
   npm test
   ```
3. **Triển khai Firebase:**
   Mã nguồn được đồng bộ sang thư mục `build/graduation/` của cổng tổng và triển khai qua:
   ```bash
   firebase deploy --only hosting
   ```
