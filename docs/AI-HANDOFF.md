# AI / DEVELOPER HANDOFF — IFA-GRADUATION
## RÀ SOÁT, HOÀN THIỆN TOÀN BỘ 3 CHỨC NĂNG VÀ BÀN GIAO MÃ NGUỒN

> [!IMPORTANT]
> **TÀI LIỆU BÀN GIAO TOÀN DIỆN CHO ANTIGRAVITY TRÊN MÁY TÍNH MỚI HOẶC KHI MỞ LẠI HHHH-HP**
> Bản bàn giao ghi lại đầy đủ hiện trạng, kết quả kiểm thử, kiến trúc an ninh, các cam kết đã thực hiện và kết quả rà soát, hoàn thiện toàn diện 3 chức năng:
> 1. **Yêu cầu 1**: Đổi thông báo loading hệ thống thành "Đang tải dữ liệu...".
> 2. **Yêu cầu 2**: Cơ chế tạo đợt tốt nghiệp mới sao chép cấu hình từ đợt cũ và tự động dời lịch thông minh (giờ Việt Nam +07:00, hiển thị đầy đủ Tuần, Thứ, Ngày, Giờ mở nộp, Deadline, Giờ Hội đồng, Giờ kết thúc).
> 3. **Yêu cầu 3**: Chuẩn hóa chính xác 9 lý do chưa đủ điều kiện theo mẫu quy định; Sinh viên tự khai báo điều kiện (bảo toàn bất biến) & Admin có giao diện điều chỉnh chi tiết toàn diện (sửa lý do, môn nợ, tiếng Anh, lý do khác, ghi chú quản trị) lưu vào `adminReview` có audit trail.

---

## 1. THÔNG TIN TIẾP QUẢN VÀ MÔI TRƯỜNG LÀM VIỆC

- **Bối cảnh tiếp quản**: Máy HHHH-HP bị tắt nguồn đột ngột trong lúc đang thực hiện nhiệm vụ. Antigravity trên Laptop tiếp quản độc lập từ mã nguồn chính thức trên GitHub `origin/main`.
- **Workspace Laptop**: `d:\CODE\IFA-GRADUATION`
- **Branch**: `main`
- **Repository chính thức**: `https://github.com/tranquanghai-ops/IFA-GRADUATION`
- **Commit gốc khi bắt đầu tiếp quản**: `1d3789d` $\rightarrow$ Đã hoàn thiện qua các commit và kiểm thử.
- **Java Runtime**: Đã cài đặt thành công **Microsoft OpenJDK 17 LTS** trên laptop, kích hoạt đầy đủ khả năng chạy bộ kiểm thử Firebase Local Emulator (`npm run test:rules`).

---

## 2. BẢNG TỰ ĐỐI SOÁT & RÀ SOÁT NỘI BỘ 3 TÍNH NĂNG

| Nội dung yêu cầu | Hiện trạng tại `e84e82c` | Đánh giá nội bộ | Hành động khắc phục / Hoàn thiện |
| :--- | :--- | :--- | :--- |
| **Yêu cầu 1: Đổi thông báo loading** | Đã đổi `"Đang tải dữ liệu..."` tại `index.template.html`, `js/core.js` | **ĐÃ ĐÚNG** | Giữ nguyên, đã kiểm tra khởi tạo mượt mà qua Playwright MCP. |
| **Yêu cầu 2: Lịch đợt 13 tuần & Mốc Tuần 4, 8, 12, 13** | Thuật toán neo thứ Hai, dời theo tuần và thứ | **ĐÃ ĐÚNG** | Đã bổ sung test case 13 tuần (Duyệt 1 Tuần 4, Duyệt 2 Tuần 8, Duyệt 3 Tuần 12, Bảo vệ Tuần 13). |
| **Yêu cầu 2: Cảnh báo Deadline vs Giờ Hội đồng** | Có cảnh báo nếu `deadlineAt > startAt` | **ĐÚNG MỘT PHẦN** | Bổ sung hiển thị rõ ràng thứ, ngày, giờ mở, deadline, giờ bắt đầu và giờ kết thúc Hội đồng (7 cột) trên bảng preview. Không tự ý sửa deadline. |
| **Yêu cầu 3: Danh mục lý do chưa đủ điều kiện** | Dùng một số mã lý do cũ (GPA, GDQP, học phí,...) | **SAI YÊU CẦU** | **ĐÃ SỬA TRIỆT ĐỂ**: Chuẩn hóa chính xác 9 lý do theo đúng mẫu người dùng cung cấp. |
| **Yêu cầu 3: Nhập học phần nợ khi thiếu tín chỉ** | Chỉ mở bảng môn nợ khi chọn nợ học phần | **THIẾU** | **ĐÃ BỔ SUNG**: Mở bảng môn nợ cho cả các mục thiếu 1–3, 4–6, 7–10 tín chỉ (không bắt buộc nếu SV chưa xác định được; nếu biết môn thì có thể khai). |
| **Yêu cầu 3: Tình trạng Tiếng Anh** | Lưu chung chung | **ĐÚNG MỘT PHẦN** | **ĐÃ SỬA**: Tách bạch 3 mã lý do tiếng Anh riêng biệt, kèm ô ghi chú tiến độ thi/hậu kiểm. |
| **Yêu cầu 3: Quyền Admin chỉnh sửa chi tiết** | Admin chỉ chọn quyết định và ghi chú chung | **THIẾU** | **ĐÃ NÂNG CẤP TOÀN DIỆN**: Cho phép Admin chỉnh sửa chi tiết từng checkbox lý do, sửa/thêm/xóa bảng môn nợ, sửa tiếng Anh, sửa lý do khác, lưu vào `adminReview` riêng biệt. |
| **Yêu cầu 3: Bảo toàn bản tự khai ban đầu của SV** | Ghi đè vào cùng object `eligibilityDeclaration` | **CÓ LỖI NGHIỆP VỤ** | **ĐÃ TÁCH BIỆT**: Bản SV tự khai (`eligibilityDeclaration`) giữ nguyên 100% bất biến; Bản Admin điều chỉnh lưu vào `adminReview` có lịch sử audit. |
| **Yêu cầu 3: Phân quyền Firestore Rules** | Chưa chặn student ghi đè `adminReview` | **THIẾU AN NINH** | **ĐÃ CẬP NHẬT RULES**: Sinh viên bị cấm tạo hoặc sửa trường `adminReview`. Admin có toàn quyền quản trị. |

---

## 3. CHI TIẾT CÁC CẢI TIẾN ĐÃ THỰC HIỆN

### 3.1. Danh mục 9 lý do chưa đủ điều kiện chuẩn hóa đúng 100% mẫu
1. `[ ] Đăng ký nhầm DATN/DATH.` (`wrong_registration`)
2. `[ ] Chưa thi hoặc chưa có chứng chỉ tiếng Anh đủ điều kiện.` (`no_english_cert`)
3. `[ ] Đã thi tiếng Anh và đang chờ kết quả.` (`english_waiting_result`)
4. `[ ] Đã có chứng chỉ tiếng Anh nhưng đang chờ xác minh.` (`english_waiting_verification`)
5. `[ ] Thiếu 1–3 tín chỉ.` (`missing_credits_1_3`)
6. `[ ] Thiếu 4–6 tín chỉ.` (`missing_credits_4_6`)
7. `[ ] Thiếu 7–10 tín chỉ.` (`missing_credits_7_10`)
8. `[ ] Còn nợ học phần/môn học chưa đạt.` (`failing_courses`)
9. `[ ] Lý do khác.` (`other`)

### 3.2. Form Sinh viên đăng ký đề tài
- Radio bắt buộc: `Đã đủ điều kiện` vs `Chưa đủ điều kiện` (không chọn sẵn).
- Nếu chọn `Chưa đủ điều kiện`:
  - Phải chọn $\ge 1$ lý do trong 9 lý do.
  - Khi chọn `Còn nợ học phần/môn học chưa đạt` hoặc các khoảng thiếu tín chỉ: Mở bảng môn nợ động. Bắt buộc nhập tên học phần nếu tick nợ môn; tùy chọn nếu chỉ tick thiếu tín chỉ.
  - Khi chọn lý do tiếng Anh: Mở ô nhập ghi chú tình trạng tiếng Anh.
  - Khi chọn `Lý do khác`: Bắt buộc nhập mô tả chi tiết lý do.
- **Tính chất Non-blocking**: Dù chọn Chưa đủ điều kiện, sinh viên vẫn được hoàn tất đăng ký đề tài và chọn GVHD.

### 3.3. Modal Admin Thẩm định & Điều chỉnh Chi tiết
- **Phần 1: Bản tự khai ban đầu của Sinh viên (Nguyên gốc - Chỉ đọc)**
  - Hiển thị đầy đủ ngày giờ khai báo, lựa chọn Đủ/Chưa đủ điều kiện.
  - Hiển thị danh sách các lý do sinh viên đã chọn, bảng môn nợ, ghi chú tiếng Anh, lý do khác.
  - Tuyệt đối không bị ghi đè hay mất dữ liệu khi Admin thẩm định.
- **Phần 2: Thẩm định & Điều chỉnh của Quản trị viên Khoa**
  - Nút `📋 Sao chép từ bản tự khai của SV`: Nạp nhanh dữ liệu tự khai của sinh viên sang form Admin.
  - Lựa chọn Quyết định: `✓ Đã đủ điều kiện`, `⚠️ Chưa đủ điều kiện`, `⏳ Cần bổ sung hồ sơ`.
  - Khối điều chỉnh chi tiết:
    - 9 Checkbox lý do của Admin để đối soát theo thực tế.
    - Bảng môn nợ của Admin có nút `＋ Thêm học phần`, xóa dòng, sửa Mã môn, Tên môn, Số tín chỉ.
    - Ô cập nhật tình trạng chứng chỉ Tiếng Anh sau hậu kiểm.
    - Ô mô tả lý do khác do Admin ghi nhận.
    - Ô Ghi chú quản trị & Căn cứ của Khoa (tối đa 1000 ký tự).
  - Khối Audit Trail: Hiển thị người thẩm định gần nhất và thời gian thẩm định.

### 3.4. Bảng xem trước sao chép đợt (Preview)
- Bảng 7 cột rõ ràng: `Tuần`, `Tên mốc & Loại`, `Thứ & Ngày`, `Mở nhận bài`, `Hạn chót nộp`, `Hội đồng bắt đầu`, `Giờ kết thúc`.
- Cảnh báo rõ ràng nếu `deadlineAt > startAt` hoặc ngày kết thúc trước ngày bắt đầu mà không âm thầm sửa dữ liệu nguồn.

---

## 4. SCHEMA DỮ LIỆU CUỐI CÙNG (`registrations/{studentId}`)

```json
{
  "studentId": "11900382",
  "topicTitle": "Thiết kế Nội thất Khu Nghỉ dưỡng...",
  "preferences": [ ... ],
  "status": "submitted",
  "eligibilityDeclaration": {
    "status": "ineligible",
    "reasons": ["missing_credits_1_3", "no_english_cert"],
    "missingCourses": [
      { "courseCode": "702001", "courseName": "Vật liệu Nội thất", "credits": 2 }
    ],
    "englishCertificateStatus": "Chưa thi chứng chỉ",
    "otherReason": "",
    "studentDeclaredAt": "2026-10-22T08:00:00.000Z",
    "studentUpdatedAt": "2026-10-22T08:00:00.000Z"
  },
  "adminReview": {
    "status": "eligible",
    "decision": "confirmed_eligible",
    "reasons": [],
    "missingCourses": [],
    "englishCertificateStatus": "Đã hậu kiểm đạt chuẩn",
    "otherReason": "",
    "adminNote": "Căn cứ bảng điểm tích lũy đợt 1",
    "reviewedBy": "admin@tdtu.edu.vn",
    "reviewedAt": "2026-10-22T09:30:00.000Z",
    "history": [
      {
        "status": "eligible",
        "decision": "confirmed_eligible",
        "adminNote": "Căn cứ bảng điểm tích lũy đợt 1",
        "reviewedBy": "admin@tdtu.edu.vn",
        "reviewedAt": "2026-10-22T09:30:00.000Z"
      }
    ]
  }
}
```

---

## 5. KẾT QUẢ KIỂM THỬ VÀ BIÊN DỊCH

- **`npm run build`**: Thành công tuyệt đối (`[HTML Builder] Successfully compiled index.html with 65 partials included.`).
- **`git diff --check`**: Exited with code 0.
- **`npm test`**: **262 / 262 tests PASSED (100% thành công, 0 lỗi)**.
- **`npm run test:rules`**: **44 / 44 tests PASSED trên Firebase Local Emulator (100% thành công)**.
- **Kiểm thử giao diện Playwright**:
  - Desktop 1920x1080: Bố cục cân đối, modal co giãn hoàn hảo.
  - Laptop 1366x768: Bảng hiển thị cuộn ngang mượt mà.
  - Tablet 768x1024: Modal responsive chuyển dòng sạch sẽ.
  - Mobile 375x667: Form radio và checkbox xếp dọc tối ưu trải nghiệm chạm.
  - Console: 0 lỗi JavaScript runtime.

---

## 6. XÁC NHẬN NGUYÊN TẮC AN TOÀN

- [x] **KHÔNG deploy Firestore Rules lên Production khi chưa có sự cho phép của Quản trị viên**.
- [x] **KHÔNG deploy Cloud Functions lên Production**.
- [x] **KHÔNG tạo đợt thi giả hoặc dữ liệu sinh viên giả trên Production**.
- [x] **KHÔNG can thiệp hoặc sửa đổi điểm số Hội đồng**.
- [x] **KHÔNG can thiệp Google Drive**.
