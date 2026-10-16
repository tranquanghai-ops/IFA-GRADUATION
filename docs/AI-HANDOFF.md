# AI / DEVELOPER HANDOFF — IFA-GRADUATION

> [!IMPORTANT]
> **TÀI LIỆU BÀN GIAO TOÀN DIỆN CHO ANTIGRAVITY TRÊN MÁY TÍNH MỚI**
> Bản bàn giao ghi lại đầy đủ hiện trạng, kết quả kiểm thử, kiến trúc an ninh, các cam kết đã thực hiện và các bước tiếp theo cần triển khai.

---

## 1. TÊN TASK ĐANG THỰC HIỆN
- **Task 1**: Phân loại Đạt/Không đạt theo ngưỡng B-/C+, Modal xem chi tiết điểm Hội đồng cho Admin/Owner và Cơ chế công bố điểm Duyệt tiến độ.
- **Task 2**: Kiểm tra an toàn bảo mật dữ liệu trước khi công bố điểm (Security Audit, Least Privilege RBAC & Firestore Emulator verification).

---

## 2. MỤC TIÊU NGHIỆP VỤ
1. **Quy tắc phân loại mới cho các mốc Duyệt tiến độ (Duyệt đợt 1, 2, 3)**:
   - Từ **B-** trở lên: **ĐẠT YÊU CẦU** (`passed`, badge xanh `✓ Đạt yêu cầu`). Nhóm điểm: `A+, A, A-, B+, B, B-` (hoặc số $\ge 7.0$).
   - Từ **C+** trở xuống: **KHÔNG ĐẠT YÊU CẦU** (`failed`, badge đỏ `✕ Không đạt yêu cầu`). Nhóm điểm: `C+, C, C-, D+, D, D-, F` (hoặc số $< 7.0$).
   - Chưa chấm / Chưa chốt: `pending`, badge xám `Chưa duyệt`, điểm `--`.
2. **Xem chi tiết điểm Hội đồng (Admin / Owner)**:
   - Click trực tiếp vào badge điểm chữ trên bảng Quản lý Đánh giá & Điểm số để mở modal xem phiếu chấm từng thành viên Hội đồng, vai trò, điểm chữ, điểm quy đổi và kết luận.
   - Chỉ Admin và Owner mới có quyền mở modal này.
3. **Cơ chế & Nút Công bố điểm (Publish Scores)**:
   - Trang bị nút `📢 Công bố điểm` tại tab Duyệt đợt 1, 2, 3. Sau khi công bố, chuyển thành `✓ Đã công bố điểm [ngày giờ]`.
   - Sinh viên và GVHD chỉ nhìn thấy điểm chữ và kết luận Đạt/Không đạt SAU KHI công bố. Trước khi công bố hiển thị `Chưa công bố` / `Đang đánh giá`.
4. **An toàn dữ liệu & Kiểm soát công bố từng phần**:
   - Ngăn chặn rò rỉ điểm số thập phân nội bộ và phiếu chấm thành viên qua Firestore SDK.
   - Bắt buộc xác nhận checkbox khi công bố từng phần nếu còn sinh viên chưa chốt điểm.
   - Ghi nhật ký kiểm toán (Audit Log) bất biến mỗi lần công bố.

---

## 3. NHỮNG YÊU CẦU ĐÃ HOÀN THÀNH
- [x] **Logic phân loại chuẩn hóa**: Cài đặt `isProgressReviewPassed` áp dụng ngưỡng B- / C+ trong `js/grading/preliminary-dashboard.js` và `js/grading/assessment-portal.js`. Đã kiểm chứng với 6 sinh viên Duyệt đợt 1 thực tế trên Production.
- [x] **Modal chi tiết điểm Hội đồng**: Tạo template `templates/modals/grading/modal-council-score-details.html`, tích hợp logic mở modal, bảo vệ RBAC chỉ cho Admin/Owner.
- [x] **Modal xác nhận công bố điểm**: Tạo template `templates/modals/grading/modal-publish-progress-review.html`, tích hợp thanh công cụ công bố `admin-duyet-X-publish-zone`.
- [x] **Kiểm soát công bố từng phần (Partial Publishing)**: Bổ sung cảnh báo cam và checkbox `#chk-confirm-partial-publish` khi `pendingCount > 0`. Nút công bố bị khóa cho đến khi Admin xác nhận.
- [x] **Dữ liệu công bố tối giản & Audit Log**: `publishedReviews` chỉ lưu `letterGrade`, `isPassed`, `status`. Tự động ghi bản ghi kiểm toán vào `graduationRounds/{roundId}/auditLogs`.
- [x] **Dual-write subcollection độc lập**: Tự động chuẩn bị ghi kết quả công bố riêng cho từng sinh viên tại `graduationRounds/{roundId}/publishedStudentResults/{studentId}`.
- [x] **Cập nhật giao diện Sinh viên & GVHD**: Ẩn điểm trước khi công bố; hiển thị đúng điểm chữ sau khi công bố trong `rounds-timeline-preview.js` và `supervisor-portal-students.js`.
- [x] **Kiểm thử tự động 100% PASS**:
  - `npm test`: 172/172 tests PASS.
  - `npm run test:rules`: 30/30 tests PASS trên Firestore Emulator (bao gồm cả test an ninh mới).
  - `npm run build`: Compile index.html sạch sẽ với 61 partials.
  - `git diff --check`: 0 lỗi cú pháp hoặc khoảng trắng.
- [x] **Triển khai an toàn frontend**: Deploy Firebase Hosting (`--only hosting`) lên project `ifa-graduation`. Xác nhận trực tiếp qua Playwright MCP trên Production.

---

## 4. NHỮNG YÊU CẦU CHƯA HOÀN THÀNH (ĐANG CHỜ PHÊ DUYỆT)
- [ ] **Deploy Firestore Security Rules**: Bản vá cho subcollection `publishedStudentResults/{studentId}` và khóa chỉnh sửa `reviewDecisions` khi hội đồng đã chốt điểm đã được viết và kiểm thử trên Emulator, nhưng **TUYỆT ĐỐI CHƯA DEPLOY** lên Production theo yêu cầu của Thầy.
- [ ] **Thao tác Công bố điểm thật trên Production**: Chưa bấm nút công bố điểm thật, chờ Thầy nghiệm thu giao diện và phê duyệt chính thức.
- [ ] **Data Sanitization trên Production**: Xóa các trường điểm nội bộ thập phân (`finalDefenseScores`, `progressReviews`) còn lưu trong document gốc `graduationRounds/{roundId}` sau khi áp dụng rules mới.

---

## 5. CÁC FILE ĐÃ SỬA VÀ TẠO MỚI
1. `templates/modals/grading/modal-council-score-details.html` *(Mới)*: Template modal xem chi tiết điểm Hội đồng.
2. `templates/modals/grading/modal-publish-progress-review.html` *(Mới)*: Template modal công bố điểm có kiểm soát công bố từng phần.
3. `index.template.html` & `index.html`: Include 2 modal mới vào bộ khung ứng dụng.
4. `views/admin/tab-scoring.html`: Vùng chứa nút công bố và cập nhật nhãn bộ lọc trạng thái.
5. `js/grading/preliminary-dashboard.js`: Toàn bộ logic phân loại, RBAC modal, toolbar, dual-write và audit log.
6. `js/grading/assessment-portal.js`: Đồng bộ logic `isProgressReviewPassed` cho bảng chấm điểm.
7. `js/supervisors/supervisor-portal-students.js`: Hiển thị kết quả công bố cho GVHD.
8. `js/rounds/rounds-timeline-preview.js`: Hiển thị kết quả công bố cho Sinh viên.
9. `package.json`: Tích hợp test suite mới vào `npm test` và `test:rules`.
10. `tests/test-council-progress-review-sync.cjs`: Đồng bộ test suite hội đồng với ngưỡng mới.
11. `tests/test-progress-review-publication-and-grading.cjs` *(Mới)*: 23 unit tests kiểm thử phân loại và công bố.
12. `tests/test-progress-review-security-audit.rules.test.mjs` *(Mới)*: Bộ test Firestore Emulator kiểm tra 8 danh tính và rủi ro an ninh.
13. `docs/AI-HANDOFF.md` *(Cập nhật)*: Tài liệu bàn giao hiện tại.

---

## 6. NHỮNG QUYẾT ĐỊNH KỸ THUẬT QUAN TRỌNG
1. **Firestore không thể che từng field trong document**:
   - `graduationRounds/{roundId}` có `allow read: if signedIn();`. Do đó, nếu lưu điểm thập phân hoặc phiếu chấm nội bộ trực tiếp trong document này, bất kỳ người dùng đăng nhập nào cũng đọc trộm được qua Console.
   - Giải pháp kiến trúc: Dữ liệu công bố phải được lưu riêng theo từng sinh viên tại subcollection `publishedStudentResults/{studentId}` với rule chỉ cho chính sinh viên đó và GVHD phụ trách đọc.
2. **Snapshot bất biến**:
   - Khi công bố, kết quả `studentResults` là một bản chụp (snapshot) tĩnh cố định `letterGrade` và `isPassed`, không bao giờ tính toán lại hay phụ thuộc vào điểm nháp.
3. **Phân quyền công bố từng phần**:
   - Khi có nhiều tiểu ban hội đồng và một số tiểu ban chưa chốt điểm, Admin được quyền công bố từng phần cho các tiểu ban đã xong, nhưng hệ thống bắt buộc Admin phải tích chọn xác nhận rõ ràng để tránh hiểu lầm.

---

## 7. KẾT QUẢ KIỂM THỬ
- **Unit & Integration Tests (`npm test`)**: 172/172 PASS (0 fail).
- **Rules Tests on Emulator (`npm run test:rules`)**: 30/30 PASS (0 fail).
- **Syntax Check (`node -c`)**: 0 lỗi trên tất cả các file JS.
- **Git Check (`git diff --check`)**: 0 trailing whitespace.
- **Production DOM Check (Playwright MCP)**: Đã kiểm tra trực tiếp trên `https://ifa-graduation.web.app/` xác nhận modal, toolbar và hàm xử lý đều tải thành công.

---

## 8. CÁC LỖI HOẶC BLOCKER
- **Hiện không có lỗi code hay runtime blocker nào.**
- **Điểm cần lưu ý trước khi bấm công bố thật**:
  - Cần Thầy phê duyệt việc deploy bản vá Firestore Security Rules để đảm bảo dữ liệu điểm nội bộ không bị đọc trộm qua Firestore SDK trước khi công bố.

---

## 9. NHỮNG THAO TÁC ĐÃ THỰC HIỆN TRÊN PRODUCTION
- Đã deploy bản build frontend mới nhất lên Firebase Hosting (`https://ifa-graduation.web.app/`) qua lệnh `npx firebase deploy --only hosting --project ifa-graduation`.
- Đã kiểm tra đăng nhập và cấu trúc DOM thực tế qua Playwright.
- Dữ liệu hoàn toàn là READ-ONLY.

---

## 10. NHỮNG THAO TÁC TUYỆT ĐỐI CHƯA THỰC HIỆN
- **CHƯA** deploy `firestore.rules`.
- **CHƯA** deploy Cloud Functions.
- **CHƯA** bấm nút công bố điểm thật trên Production.
- **CHƯA** sửa hay xóa bất kỳ document dữ liệu nào của sinh viên.

---

## 11. COMMIT HASH & BRANCH BÀN GIAO
- **Branch:** `main`
- **Base Commit trước task:** `70808b2`
- **Commit Phase 1 (UI & Logic):** `3d2f0ad`
- **Commit Phase 2 (Security Audit & Partial Publish Gating):** `dfc2029`
- **Remote:** `https://github.com/tranquanghai-ops/IFA-GRADUATION.git`
- **Trạng thái GitHub:** Toàn bộ commit đã được push lên `origin/main`. Working tree hoàn toàn sạch.

---

## 12. BẢN VÁ FIRESTORE SECURITY RULES (ĐÃ KIỂM THỬ, CHỜ DUYỆT)
Khi Thầy duyệt deploy Firestore Rules, bổ sung đoạn sau vào [firestore.rules](file:///d:/CODE/IFA-GRADUATION/firestore.rules):

```javascript
// Phân quyền độc lập theo từng sinh viên cho kết quả công bố
match /publishedStudentResults/{studentId} {
  allow get: if admin()
    || (student() && email().matches('(?i)^' + studentId + '@student\\.tdtu\\.edu\\.vn$'))
    || (signedIn()
      && exists(/databases/$(database)/documents/graduationRounds/$(roundId)/officialAssignments/$(studentId))
      && get(/databases/$(database)/documents/graduationRounds/$(roundId)/officialAssignments/$(studentId)).data.assignmentStatus == 'published'
      && (email() in get(/databases/$(database)/documents/graduationRounds/$(roundId)/officialAssignments/$(studentId)).data.supervisorEmails
        || email().lower() in get(/databases/$(database)/documents/graduationRounds/$(roundId)/officialAssignments/$(studentId)).data.supervisorEmails));

  allow list: if admin() || staff();
  allow write: if admin();
}

match /publishedProgressReviews/{phaseId} {
  allow read: if admin() || staff();
  allow write: if admin();
}
```

---

## 13. CÁC BƯỚC TIẾP TỤC CHO ANTIGRAVITY TRÊN MÁY TÍNH MỚI
Khi mở workspace trên máy tính khác:
1. Chạy `git status` và `git pull origin main` để nhận các commit mới nhất (`dfc2029` và commit bàn giao tài liệu này).
2. Chạy `npm test` để xác nhận 172 tests PASS.
3. Đọc kỹ file `docs/AI-HANDOFF.md` này để nắm toàn bộ ngữ cảnh và hiện trạng.
4. Chờ lệnh từ Thầy:
   - Nếu Thầy duyệt deploy Rules: Nhờ agent chuyên trách `firestore-rules-author` hoặc chạy deploy `firebase deploy --only firestore:rules`.
   - Nếu Thầy yêu cầu nghiệm thu trên giao diện: Hướng dẫn Thầy đăng nhập tài khoản Admin/Owner để kiểm tra modal và nút công bố.
5. Tuyệt đối không tự ý deploy Rules hoặc can thiệp dữ liệu điểm thật khi chưa có chỉ thị rõ ràng.

---

## 14. CẢNH BÁO LIÊN QUAN ĐẾN DỮ LIỆU VÀ PHÂN QUYỀN
- Project Firebase Hosting / Firestore: **`ifa-graduation`** (Không nhầm với `ifa-activities` hay `tknt-tdtu`).
- Cloud Functions Drive: Thuộc project **`ifa-activities`**.
- Không bao giờ commit hay đưa file chứa service account, private key hoặc secrets lên GitHub.
