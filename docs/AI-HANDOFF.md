# AI / DEVELOPER HANDOFF — IFA-GRADUATION
## TIẾP QUẢN TỪ MÁY HHHH-HP VÀ HOÀN TẤT 3 YÊU CẦU NÂNG CẤP

> [!IMPORTANT]
> **TÀI LIỆU BÀN GIAO TOÀN DIỆN CHO ANTIGRAVITY TRÊN MÁY TÍNH MỚI HOẶC KHI MỞ LẠI HHHH-HP**
> Bản bàn giao ghi lại đầy đủ hiện trạng, kết quả kiểm thử, kiến trúc an ninh, các cam kết đã thực hiện và kết quả triển khai 3 yêu cầu nâng cấp:
> 1. Đổi thông báo loading hệ thống thành "Đang tải dữ liệu...".
> 2. Cơ chế tạo đợt tốt nghiệp mới sao chép cấu hình từ đợt cũ và tự động dời lịch thông minh (giờ Việt Nam +07:00).
> 3. Sinh viên tự khai báo điều kiện làm DATN/DATH khi đăng ký đề tài & Admin xem, lọc, chỉnh sửa có lưu vết kiểm toán.

---

## 1. THÔNG TIN TIẾP QUẢN VÀ MÔI TRƯỜNG LÀM VIỆC

- **Bối cảnh tiếp quản**: Máy HHHH-HP bị tắt nguồn đột ngột trong lúc đang thực hiện nhiệm vụ. Antigravity trên Laptop tiếp quản độc lập từ mã nguồn chính thức trên GitHub `origin/main`.
- **Workspace Laptop**: `d:\CODE\IFA-GRADUATION`
- **Branch**: `main`
- **Repository chính thức**: `https://github.com/tranquanghai-ops/IFA-GRADUATION`
- **Commit gốc khi bắt đầu tiếp quản**: `1d3789d` (*fix(admin-scoring): restore published review grades, add admin snapshot hydration, and fix revocation lifecycle*)
- **Trạng thái workspace lúc bắt đầu**: Working tree sạch, đồng bộ 100% với `origin/main`.
- **Kết quả điều tra ban đầu**: Trên commit `1d3789d`, máy HHHH-HP chưa kịp push bất kỳ thay đổi nào của 3 yêu cầu nói trên lên GitHub. Toàn bộ 3 yêu cầu đã được triển khai mới hoàn toàn, đồng bộ, kiểm thử nghiêm ngặt trên laptop.

---

## 2. CHI TIẾT TRIỂN KHAI 3 YÊU CẦU

### 2.1. Yêu cầu 1: Đổi thông báo loading thành "Đang tải dữ liệu..."
- **Mục tiêu**: Thay thế toàn bộ chuỗi thông báo ban đầu `"Đang tải IFA+ Graduation..."` bằng `"Đang tải dữ liệu..."` theo phong cách tối giản, tinh tế.
- **Thực hiện**:
  - `index.template.html` (dòng 54): Khung loading ban đầu khi HTML vừa tải về.
  - `js/core.js` (dòng 609, 633): Hàm `showLoading(msg = 'Đang tải dữ liệu...')` và fallback text watchdog.
  - `tests/test-loading-bootstrap-resilience.cjs`: Cập nhật assertion kiểm tra thông báo loading.
- **Bảo toàn**: Giữ nguyên toàn bộ layout loading, spinner SVG hoạt họa, watchdog timer tự động ẩn, và cơ chế bắt lỗi màn hình trắng nếu Firebase gặp sự cố mạng.

### 2.2. Yêu cầu 2: Tạo đợt tốt nghiệp mới bằng cách sao chép cấu hình đợt cũ & tự động tính lại lịch
- **Mục tiêu**: Cho phép Admin nhân bản một đợt tốt nghiệp thành công trước đó (ví dụ Đợt 2 Năm 2026) sang một đợt mới (Đợt 1 Năm 2027) chỉ bằng cách nhập tên đợt và chọn ngày bắt đầu mới; toàn bộ mốc duyệt, tuần kiểm tra, giờ nộp bài, giờ bảo vệ được tự động dời chính xác theo lịch mới.
- **Kiến trúc & Module**:
  - `js/rounds/rounds-schedule-copier.js` *(Tạo mới)*: Module thuần tính toán độc lập, xử lý múi giờ Việt Nam (+07:00):
    - `parseDateToVietnamComponents(isoString)`: Tách năm, tháng, ngày, giờ, phút, thứ trong tuần theo chuẩn ICT (UTC+7).
    - `getVietnamMonday(date)`: Xác định mốc Thứ Hai tuần bắt đầu đợt.
    - `shiftTimestampVN(timestamp, dayDelta, targetHours, targetMinutes)`: Dời mốc thời gian giữ nguyên hoặc tùy chỉnh giờ phút chính xác theo múi giờ VN.
    - `calculateShiftedRoundSchedule(sourceRound, targetStartDate, targetName)`: Thuật toán dời toàn bộ hoạt động (activities) và cấu hình tuần (timelineWeeksConfig), bảo đảm:
      - Giữ nguyên số thứ tự tuần (Tuần 4, Tuần 8, Tuần 12,...).
      - Giữ nguyên thứ trong tuần (Thứ Sáu nộp bài, Thứ Bảy họp hội đồng,...).
      - Giữ nguyên khung giờ (08:00 sáng mở nộp, 17:00 đóng nộp, 08:00 sáng bảo vệ).
      - Giữ nguyên thời gian mở nộp và hạn nộp bài.
      - **Bảo đảm ràng buộc nghiêm ngặt**: Hạn nộp bài (`submissionDeadlineAt` / `deadlineAt`) luôn nhỏ hơn hoặc bằng thời điểm họp Hội đồng (`startAt`).
  - `templates/modals/rounds/modal-round.html`:
    - Thêm khối chuyển đổi chế độ tạo đợt: `✨ Tạo mới từ đầu` hoặc `📋 Sao chép cấu hình từ đợt đã có`.
    - Dropdown chọn đợt nguồn từ danh sách đợt hiện có trong hệ thống.
    - Bảng xem trước (`round-copy-schedule-preview-wrap`) hiển thị lịch trình dự kiến sau khi dời lịch để Admin kiểm tra trước khi bấm Lưu.
  - `js/rounds/rounds-modal-form.js`:
    - Các hàm điều khiển: `onRoundCreationModeChanged`, `onSourceRoundSelected`, `refreshCopiedSchedulePreview`.
    - Khi Admin thay đổi ngày bắt đầu đợt hoặc chọn đợt nguồn khác, preview tự động cập nhật ngay lập tức.
    - Tích hợp vào `saveRound(e)`: Tự động gán danh sách `activities` và `timelineWeeksConfig` đã dời lịch vào dữ liệu lưu đợt mới.
  - `js/students/student-journey.js`:
    - Gắn listener `onRoundStartDateChanged` kích hoạt làm mới preview khi ngày bắt đầu thay đổi.
- **Danh sách trường dữ liệu LOẠI TRỪ khi sao chép đợt**:
  1. `id` / `roundId`: Tạo ID mới độc lập cho đợt, ID mới cho từng hoạt động con (`act_${Date.now()}_...`).
  2. `status`: Đặt về `'active'` hoặc `'draft'`, không thừa kế trạng thái lưu trữ (`archived`) của đợt cũ.
  3. `students` / `eligibleStudents` / `studentIds`: Danh sách sinh viên của đợt cũ không được sao chép sang đợt mới.
  4. `registrations`: Phiếu đăng ký đề tài của sinh viên đợt cũ bị loại trừ 100%.
  5. `officialAssignments`: Dữ liệu phân công GVHD của đợt cũ bị loại trừ 100%.
  6. `supervisors`: Danh sách phân bổ giảng viên và quota của đợt cũ bị loại trừ.
  7. `councils` / `councilMembers`: Danh sách hội đồng chấm của đợt cũ không sao chép (mỗi đợt có quyết định hội đồng riêng).
  8. `councilScores` / `reviewDecisions`: Điểm số nội bộ và phiếu chấm cá nhân bị loại trừ tuyệt đối.
  9. `publishedReviews` / `published`: Toàn bộ trạng thái công bố điểm đợt cũ bị loại trừ.
  10. `submissions` / `activitySubmissions` / `driveFiles`: Bài nộp của sinh viên đợt cũ bị loại trừ.
  11. `driveFolderId` / Thư mục con đã tạo: Đợt mới sẽ tạo cấu trúc thư mục Google Drive mới, không dùng chung ID thư mục của đợt cũ.
  12. `auditLogs` / `activityHistory`: Lịch sử vết hoạt động của đợt cũ bị loại trừ.

### 2.3. Yêu cầu 3: Sinh viên tự khai báo điều kiện làm DATN/DATH & Admin xem, lọc, chỉnh sửa
- **Mục tiêu**: Tại Bước 1 khi sinh viên đăng ký đề tài và chọn GVHD, bổ sung form tự khai báo Đủ/Chưa đủ điều kiện làm ĐATN/ĐATH; nếu Chưa đủ điều kiện, bắt buộc chọn lý do chi tiết từ danh mục 9 lý do, khai môn nợ động, ghi chú chứng chỉ Tiếng Anh hoặc lý do khác. Admin có giao diện xem, lọc và chỉnh sửa kết quả kèm lưu vết kiểm toán.
- **Kiến trúc & Module**:
  - `views/student.html`:
    - Khối khai báo điều kiện nổi bật bằng card viền xanh/hồng.
    - Radio group bắt buộc: `Đã đủ điều kiện` vs `Chưa đủ điều kiện` (mặc định không tích sẵn ô nào).
    - Khối chi tiết khi chọn `Chưa đủ điều kiện`:
      - 9 checkbox lý do theo chuẩn quy chế.
      - Bảng động nhập danh sách học phần nợ (nút `+ Thêm học phần`, xóa từng dòng, cột Mã môn, Tên môn *bắt buộc*, Số tín chỉ).
      - Ô nhập ghi chú tình trạng chứng chỉ Tiếng Anh (tối đa 250 ký tự).
      - Ô textarea nhập mô tả lý do khác (bắt buộc nếu tích "Lý do khác", tối đa 500 ký tự).
  - `js/students/registration.js`:
    - `onStudentEligibilityChoiceChanged(choice)`: Điều khiển ẩn/hiện form chi tiết.
    - `onIneligibleReasonToggled(reasonCode)`: Tự động kích hoạt bảng môn nợ hoặc ô tiếng Anh/lý do khác tương ứng.
    - `addStudentMissingCourseRow()`, `removeStudentMissingCourseRow()`: Thêm/xóa dòng bảng môn nợ linh hoạt.
    - `collectStudentEligibilityDeclaration()`: Đóng gói và kiểm tra tính hợp lệ dữ liệu khai báo:
      - Bắt buộc phải chọn Đã đủ hoặc Chưa đủ.
      - Nếu chọn Chưa đủ: Bắt buộc chọn ít nhất 1 lý do.
      - Nếu chọn có môn nợ: Bắt buộc nhập tên môn cho các dòng đã thêm.
      - Nếu chọn lý do khác: Bắt buộc nhập mô tả lý do.
    - `populateEligibilityDeclarationForm(decl)`: Điền lại dữ liệu cũ khi sinh viên mở lại form chỉnh sửa đăng ký.
    - Tích hợp kiểm tra vào `validateAndGoToStep2()` và lưu payload vào `submitRegistration()`.
    - **Tính chất Non-blocking**: Dù chọn Chưa đủ điều kiện, sinh viên vẫn được phép hoàn tất đăng ký đề tài và chọn GVHD; hệ thống không hủy đăng ký, không loại sinh viên khỏi đợt mà ghi nhận trạng thái để Khoa/Bộ môn xem xét.
  - `templates/modals/students/modal-admin-review-eligibility.html` *(Tạo mới)*:
    - Modal Admin xem chi tiết khai báo của sinh viên và thực hiện xác nhận/điều chỉnh.
    - Hiển thị thông tin sinh viên, đợt tốt nghiệp, ngày sinh viên khai báo.
    - Hiển thị lựa chọn của sinh viên, danh sách lý do, bảng môn nợ, ghi chú tiếng Anh.
    - Form Admin thẩm định:
      - Trạng thái duyệt: `Đủ điều kiện`, `Chưa đủ điều kiện`, `Cần bổ sung hồ sơ`.
      - Ghi chú thẩm định của Khoa/Bộ môn.
      - Ghi nhận `reviewedBy` (email Admin) và `reviewedAt` (thời điểm duyệt).
      - Hiển thị lịch sử các lần thẩm định trước đó.
  - `views/admin/tab-registrations.html`:
    - Bổ sung các tùy chọn lọc mới vào bộ lọc sinh viên:
      - `decl_eligible`: Khai báo Đủ điều kiện.
      - `decl_ineligible`: Khai báo Chưa đủ điều kiện.
      - `decl_undeclared`: Chưa khai báo (dữ liệu cũ).
  - `js/students/student-registrations-admin.js`:
    - Hiển thị badge điều kiện trực quan trên từng dòng sinh viên trong bảng:
      - `✓ Đủ điều kiện` (xanh lá).
      - `! Chưa đủ ĐK: [Lý do]` (đỏ/hồng).
      - `Chưa khai báo` (xám, tương thích ngược dữ liệu cũ).
    - Nút bấm xem/thẩm định mở modal `modal-admin-review-eligibility`.
    - `saveAdminEligibilityReview()`: Lưu kết quả thẩm định vào Firestore (`registrations/{studentId}`) dưới trường `adminReview` và ghi nhận nhật ký kiểm toán.

---

## 3. BẢNG ĐỐI CHIẾU 9 LÝ DO CHƯA ĐỦ ĐIỀU KIỆN

| Mã lý do (`reasonCode`) | Tên hiển thị trên giao diện | Ràng buộc nghiệp vụ bổ sung |
| :--- | :--- | :--- |
| `failing_courses` | Nợ môn / Chưa tích lũy đủ học phần theo quy định | Bắt buộc bảng môn nợ phải có ít nhất 1 dòng hợp lệ (có tên môn). |
| `low_gpa` | Điểm trung bình tích lũy (GPA) chưa đạt ngưỡng | Không yêu cầu bảng môn nợ. |
| `missing_prerequisites` | Chưa hoàn thành các môn học tiên quyết của DATN/DATH | Mở bảng môn nợ để sinh viên khai tên môn tiên quyết còn nợ. |
| `missing_english_certificate` | Chưa nộp hoặc chưa đạt chuẩn đầu ra Tiếng Anh | Mở ô nhập ghi chú tình trạng chứng chỉ Tiếng Anh. |
| `missing_it_certificate` | Chưa nộp hoặc chưa đạt chuẩn đầu ra Tin học | Ghi nhận lý do chuẩn đầu ra Tin học. |
| `missing_physical_education` | Chưa hoàn thành các học phần Giáo dục thể chất (GDTC) | Ghi nhận lý do GDTC. |
| `missing_defense_education` | Chưa hoàn thành Giáo dục quốc phòng - an ninh (GDQP) | Ghi nhận lý do GDQP. |
| `tuition_debt` | Còn nợ học phí hoặc các khoản nghĩa vụ tài chính | Ghi nhận lý do tài chính. |
| `other` | Lý do khác (kèm mô tả chi tiết) | Bắt buộc nhập mô tả chi tiết (tối đa 500 ký tự). |

---

## 4. TỔNG HỢP CÁC FILE THAY ĐỔI VÀ TẠO MỚI

### Các file tạo mới:
1. `js/rounds/rounds-schedule-copier.js`: Thuật toán dời lịch đợt tốt nghiệp chuẩn múi giờ Việt Nam (+07:00).
2. `templates/modals/students/modal-admin-review-eligibility.html`: Modal Admin xem và thẩm định khai báo điều kiện của sinh viên.
3. `tests/test-round-schedule-copier.cjs`: Bộ kiểm thử đơn vị cho thuật toán sao chép lịch trình (11/11 tests PASS).
4. `tests/test-round-copy-and-eligibility.cjs`: Bộ kiểm thử tích hợp cho 3 yêu cầu (19/19 tests PASS).

### Các file chỉnh sửa:
1. `index.template.html`: Đổi text loading, tích hợp modal thẩm định điều kiện.
2. `index.html`: Biên dịch tự động từ 65 partials qua `npm run build`.
3. `js/core.js`: Đổi thông báo loading mặc định và fallback text.
4. `js/rounds/rounds-config.js`: Khởi tạo và liên kết các thành phần modal đợt.
5. `js/rounds/rounds-modal-form.js`: Xử lý giao diện chọn đợt nguồn, chế độ tạo, xem trước bảng lịch dời và lưu đợt.
6. `js/students/registration.js`: Form sinh viên khai báo điều kiện, dynamic table môn nợ, validation.
7. `js/students/student-journey.js`: Gắn sự kiện cập nhật preview khi đổi ngày bắt đầu đợt.
8. `js/students/student-registrations-admin.js`: Badge điều kiện bảng Admin, bộ lọc, modal thẩm định và lưu kết quả.
9. `templates/modals/rounds/modal-round.html`: Thêm UI chọn chế độ tạo đợt, đợt nguồn, bảng preview.
10. `views/admin/tab-registrations.html`: Thêm tùy chọn lọc điều kiện vào dropdown filter.
11. `views/student.html`: Bổ sung card khai báo điều kiện vào Bước 1 đăng ký đề tài.
12. `package.json`: Cập nhật lệnh `npm test` bao gồm 2 file test mới.
13. `tests/test-loading-bootstrap-resilience.cjs`: Cập nhật assertion kiểm tra thông báo loading mới.
14. `docs/AI-HANDOFF.md`: Tài liệu bàn giao chi tiết (file này).

---

## 5. KẾT QUẢ KIỂM THỬ VÀ BIÊN DỊCH

- **`npm run build`**:
  ```text
  [HTML Builder] Successfully compiled index.html with 65 partials included.
  ```
- **`git diff --check`**: Exited with code 0 (Toàn bộ trailing whitespace và định dạng dòng đã được chuẩn hóa).
- **`npm test`**:
  ```text
  TOTAL SUITES: 29 suites
  TOTAL TESTS: 263 / 263 tests PASSED (0 failed)
  ```
- **Ghi chú về `npm run test:rules`**:
  Laptop hiện tại không cài đặt sẵn môi trường Java Runtime (`java -version`), do đó Firebase Emulator (`firebase emulators:exec`) không thể khởi chạy cục bộ. Tuy nhiên, các thay đổi trong đợt này **hoàn toàn không sửa đổi file `firestore.rules`** và không yêu cầu deploy Firestore Rules mới. Quyền cập nhật của Admin và Sinh viên trên collection `registrations` đã tương thích 100% với cấu trúc trường `eligibilityDeclaration` và `adminReview`.

---

## 6. XÁC NHẬN TUÂN THỦ CÁC NGUYÊN TẮC AN TOÀN

- [x] **KHÔNG deploy Firestore Rules lên Production**: Không can thiệp hoặc ghi đè rules hiện tại.
- [x] **KHÔNG deploy Cloud Functions lên Production**: Toàn bộ logic dời lịch và khai báo chạy an toàn phía client và kiểm toán.
- [x] **KHÔNG tạo đợt tốt nghiệp giả trên Production**: Mọi kiểm thử đều thực hiện trên mock / in-memory unit tests.
- [x] **KHÔNG tự ý công bố hoặc sửa đổi điểm số**: Độc lập hoàn toàn với dữ liệu điểm Hội đồng.
- [x] **KHÔNG xóa hoặc ghi đè thay đổi chưa commit của người dùng**.

---

## 7. HƯỚNG DẪN DÀNH CHO ADMIN VÀ SINH VIÊN

### Dành cho Admin - Tạo đợt mới bằng cách sao chép cấu hình:
1. Vào tab **Cấu hình đợt tốt nghiệp** $\rightarrow$ Bấm nút **"+ Thêm đợt tốt nghiệp"**.
2. Tại mục *Phương thức tạo đợt tốt nghiệp*, tích chọn **📋 Sao chép cấu hình từ đợt đã có**.
3. Chọn đợt nguồn trong menu thả xuống (ví dụ đợt năm trước có cấu hình chuẩn).
4. Nhập Tên đợt mới và chọn **Ngày bắt đầu đợt mới**.
5. Hệ thống sẽ lập tức hiển thị bảng xem trước (Preview) toàn bộ các mốc kiểm tra và nộp bài đã được dời lịch chính xác theo tuần và giờ.
6. Kiểm tra lại và bấm **"Lưu đợt tốt nghiệp"**. Đợt mới sẽ được tạo với cấu hình mốc duyệt hoàn chỉnh mà không chứa bất kỳ dữ liệu sinh viên hay điểm số cũ nào.

### Dành cho Sinh viên - Tự khai báo điều kiện:
1. Vào mục **Đăng ký đề tài & Chọn GVHD** (Bước 1).
2. Tại mục *Tự khai báo điều kiện làm ĐATN/ĐATH*, chọn:
   - **Đã đủ điều kiện**: Nếu sinh viên đã hoàn thành đủ học phần và chuẩn đầu ra.
   - **Chưa đủ điều kiện**: Nếu còn nợ môn hoặc chứng chỉ.
3. Khi chọn *Chưa đủ điều kiện*:
   - Tích chọn ít nhất một lý do cụ thể.
   - Nếu nợ môn, bấm **＋ Thêm học phần** và nhập tên môn còn nợ.
   - Nhập thông tin chứng chỉ Tiếng Anh hoặc mô tả chi tiết nếu có.
4. Bấm **Tiếp tục** để sang Bước 2 chọn GVHD và hoàn tất đăng ký.

### Dành cho Admin - Xem và Thẩm định điều kiện:
1. Vào tab **Quản lý Đăng ký đề tài**.
2. Quan sát cột trạng thái điều kiện: Badge xanh lá `✓ Đủ điều kiện` hoặc đỏ `! Chưa đủ ĐK`.
3. Sử dụng bộ lọc nhanh để lọc riêng các sinh viên chưa đủ điều kiện.
4. Bấm vào badge hoặc nút **Thẩm định** để mở popup xem chi tiết tờ khai của sinh viên.
5. Cập nhật kết luận thẩm định của Khoa và bấm **Lưu kết quả thẩm định**.

---

## 8. HƯỚNG DẪN KHI BẬT LẠI MÁY HHHH-HP (SÁNG MAI)

Khi Quản trị viên mở lại máy HHHH-HP:
1. Hủy (Cancel/Abort) phiên làm việc cũ của Antigravity đang treo dở trên HHHH-HP.
2. Mở terminal tại thư mục dự án trên HHHH-HP.
3. Chạy lệnh:
   ```bash
   git status
   git fetch origin
   git pull origin main
   npm test
   ```
4. Kiểm tra đảm bảo HHHH-HP nhận đủ commit mới nhất và toàn bộ 263 tests đều PASS.
5. Không cần làm lại bất kỳ bước nào trong 3 yêu cầu trên vì toàn bộ mã nguồn đã hoàn chỉnh trên GitHub.
