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
│   └── admin.html                  # ⚙️ Cổng Quản trị Viên (#view-admin, 7 Tabs quản lý)
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
│       │   └── modal-add-letter-option.html        # Modal Tùy chọn biểu mẫu
│       │
│       ├── supervisors/            # Modals Giảng viên Hướng dẫn & Phân công
│       │   ├── modal-supervisor.html               # Modal Thêm/Sửa GVHD danh mục
│       │   ├── modal-add-sup-to-round.html         # Modal Chọn GVHD tham gia đợt
│       │   ├── modal-sup-bio.html                  # Modal Tiểu sử & Chân dung GVHD
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
│           ├── modal-teacher-profile.html          # Modal Xem hồ sơ giảng viên
│           ├── modal-confirm.html                  # Modal Xác nhận cảnh báo hành động nguy hiểm
│           ├── modal-activity-submissions.html     # Modal Danh sách nộp bài theo mốc
│           ├── modal-submission-override.html      # Modal Ghi đè/Nộp bù bài cho sinh viên
│           ├── modal-submission-history.html       # Modal Lịch sử các phiên bản nộp bài
│           └── modal-admin-impersonate.html        # Modal Đóng vai Exact Act-As Test Mode
│
├── js/                             # CÁC MODULE JAVASCRIPT THEO NGHIỆP VỤ
│   ├── core.js                     # Khởi tạo Firebase, State toàn cục, Toast & Utilities
│   ├── ui.js                       # Logic UI dùng chung, Theme, Format tiền tệ / ngày tháng
│   ├── auth.js                     # Phân quyền, Router Cổng (Switch View), Session Listener
│   ├── impersonation.js            # Chế độ đóng vai "Exact Act-As" cho kiểm thử thực tế
│   ├── drive.js                    # Tự động hóa Google Drive API, Folder Tree & Nộp bài
│   ├── planning.js                 # Kế hoạch 12 tuần, Mốc tiến độ, Ticker đếm ngược
│   │
│   ├── rounds/                     # Subsystem Quản lý Đợt Tốt Nghiệp
│   │   ├── rounds-dashboard.js     # Thẻ đợt Dashboard, Đặt đợt hiện hành, Soft-delete
│   │   ├── rounds-config.js        # Cấu hình đợt 4 Tabs A-D, Save/Validate đợt
│   │   └── project-types.js        # CRUD Loại đề tài (Nội thất nhà ở, Thương mại...)
│   │
│   ├── students/                   # Subsystem Quản lý Sinh viên & Đăng ký
│   │   ├── students-master.js      # IFAA Student Master read-only resolver & cache
│   │   ├── student-eligibility.js  # Danh sách SV đủ điều kiện đợt, Import/Export Excel
│   │   ├── registration.js         # Quy trình nộp nguyện vọng, Stepper 3 bước, In PDF
│   │   └── student-portal.js       # Giao diện Cổng SV, Hero Card, Journey Card 10 bước
│   │
│   ├── supervisors/                # Subsystem Giảng viên Hướng dẫn & Phân công
│   │   ├── supervisors-master.js   # Danh mục GVHD, Quản lý ảnh chân dung, Bio modal
│   │   ├── supervisor-quotas.js    # Cấu hình Tab C, Tính toán hạn mức & chỉ tiêu động
│   │   ├── assignments.js          # Ma trận phân công GVHD 1, GVHD 2, Draft & Publish
│   │   └── supervisor-portal.js    # Cổng GVHD (#view-supervisor), Duyệt đề tài SV
│   │
│   └── grading/                    # Subsystem Hội đồng & Chấm thi ĐATN
│       ├── councils.js             # Thành lập Hội đồng, Cơ cấu Slot, Phân công SV
│       ├── rubrics.js              # Cấu hình Tiêu chí Rubric, Trọng số & Biểu mẫu
│       ├── preliminary-scores.js   # Điểm Sơ khảo, Điểm GVHD, Điểm TM HD/PB, Dashboard
│       ├── defense-scores.js       # Phiếu chấm bảo vệ trực tiếp, Hiệu chỉnh điểm
│       ├── final-scores.js         # Công thức tính điểm tổng kết, Xếp hạng & Xuất Excel
│       └── assessment-portal.js    # Cổng Giảng viên Chấm thi (#view-assessment)
│
└── scripts/                        # SCRIPTS BIÊN DỊCH VÀ KIỂM TRA
    ├── build-html.cjs              # Trình biên dịch index.template.html -> index.html
    └── ...                         # Scripts hỗ trợ migration và testing
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
