# AI / DEVELOPER HANDOFF — IFA-GRADUATION

> [!IMPORTANT]
> **TÀI LIỆU BÀN GIAO TOÀN DIỆN CHO ANTIGRAVITY TRÊN MÁY TÍNH MỚI**
> Bản bàn giao ghi lại đầy đủ hiện trạng, kết quả kiểm thử, kiến trúc an ninh, các cam kết đã thực hiện và kết quả hotfix tổng hợp 5 nhóm công việc (A, B, C, D, E).

---

## 1. TÊN CÁC TASK ĐÃ THỰC HIỆN
- **Task 1**: Phân loại Đạt/Không đạt theo ngưỡng B-/C+, Modal xem chi tiết điểm Hội đồng cho Admin/Owner và Cơ chế công bố điểm Duyệt tiến độ.
- **Task 2**: Kiểm tra an toàn bảo mật dữ liệu trước khi công bố điểm (Security Audit, Least Privilege RBAC & Firestore Emulator verification).
- **Task 3 (HOTFIX TỔNG HỢP)**:
  - **P0 / Nhóm A**: Đối soát bài nộp thực tế (11900382, 11900395, 12200254), kịch bản đối soát dry-run, sao lưu và rollback an toàn.
  - **P4 / Nhóm B**: Hoàn thiện thao tác xem file trực tiếp Google Drive tab mới & xem chi tiết bài nộp qua badge lượt nộp, hỗ trợ 0/N, 1/N, 2/N, 3/N.
  - **P3 / Nhóm C**: Đổi tên cột "Hoạt động gần nhất", modal hiển thị tối đa 10 hoạt động thực tế có kiểm chứng (đăng nhập, nộp bài, đề tài, duyệt), cam kết không fake data.
  - **P1 / Nhóm D**: Sửa triệt để nhận diện phiếu chấm Hội đồng (Cô Nguyễn Thị Thúy Hà - Điểm B), mở rộng tra cứu đa thuộc tính subcollection & cache.
  - **P2 / Nhóm E**: Cơ chế Thu hồi công bố (E1) và Điều chỉnh kết quả có audit log bất biến (E2), đảm bảo toàn vẹn dữ liệu.

---

## 2. MỤC TIÊU VÀ KẾT QUẢ TỪNG NHÓM NGHIỆP VỤ

### 2.1. Nhóm A (P0): Đối soát bài nộp thực tế Drive & Firestore
1. **Hiện trạng điều tra**:
   - Mốc Duyệt 1: `act_1790171285992_yhhi9` trong đợt `FZRWniqMofaIvn7ogq0w`. Hạn nộp chính thức: `2026-10-16T05:10:00.000Z` (12:10 PM VN).
   - Cả 3 sinh viên đều đã tải file PDF lên Google Drive thành công trước thời hạn:
     - `11900382` (Trang Trần Tuệ Nhã): File `1tuMDPEMz4Avjfh6vVeKfQFuNgf8d3ozw` (`11900382_Trang Tran Tue Nha.pdf`, 43.82 MB, tải lúc 10:26 VN).
     - `11900395` (Nguyễn Khánh Thịnh): File `13A20v-sRS4Ye-fVXO0h3honN_tvJ7x_G` (`11900395_Nguyen Khanh Thinh.pdf`, 13.49 MB, tải lúc 09:36 VN).
     - `12200254` (Nguyễn Thanh Hằng Nga): File `15E5Cr6gMLR4XxoSH-cuOyEHkNew2ALah` (`12200254_Nguyen Thanh Hang Nga.pdf`, 31.98 MB, tải lúc 09:56 VN).
   - **Nguyên nhân gốc**: Do mã nguồn `submitActivityHandler` cũ của backend trước khi hotfix truy cập thuộc tính `driveDoc.name` khi client chỉ gửi `driveDoc.fileName`, gây ra exception trước transaction ghi `activitySubmissions`.
2. **Kịch bản khôi phục an toàn**:
   - Tạo script `scripts/reconcile-and-recover-submissions.cjs`.
   - **Mặc định chạy `--dry-run`**, chỉ mô phỏng kiểm tra dữ liệu, **KHÔNG ghi bất kỳ thay đổi nào lên Production Firestore**.
   - Chỉ ghi dữ liệu khi có cờ tường minh `--apply` sau khi được Quản trị viên phê duyệt.
   - Báo cáo đối soát chi tiết được lưu tại `backups/audit-reconciliation-report-*.json`.

### 2.2. Nhóm B (P4): Thao tác xem file & Lịch sử nộp bài
- Nút "👁️ Xem bài" tại bảng quản lý các đợt duyệt gọi `openLatestOfficialSubmissionFile()`, mở trực tiếp file PDF chính thức mới nhất trên Google Drive trong tab mới (`target="_blank"`, `noopener,noreferrer`).
- Badge "Đã nộp / Tối đa" (0/3, 1/3, 2/3, 3/3) được thiết kế thành nút tương tác gọi `openAdminSubmissionInspectModal()`, cho phép xem chi tiết bài nộp và lịch sử các lần nộp.
- Hỗ trợ đầy đủ trạng thái 0/N sạch sẽ (badge xám "○ Chưa nộp").

### 2.3. Nhóm C (P3): Theo dõi 10 hoạt động gần nhất của sinh viên
- Đổi tên cột tại `views/admin/tab-students.html` thành `Hoạt động gần nhất`.
- Click vào ô hoạt động mở modal `modal-student-activity-history`.
- Tự động tập hợp và sắp xếp theo thời gian tối đa 10 sự kiện thực tế có chứng cứ:
  1. Đăng nhập hệ thống (Google Workspace, thời gian thực tế từ `userActivities`).
  2. Nộp bài các mốc (từ `driveFiles` và `activitySubmissions`).
  3. Đăng ký đề tài & đề xuất sửa đổi đề tài qua các phiên bản (từ `registrations` và `topicTitleHistory`).
  4. Đánh giá / phản hồi của Hội đồng.
- Cam kết: **Tuyệt đối không sử dụng dữ liệu giả lập (placeholder/fake).**

### 2.4. Nhóm D (P1): Sửa nhận diện phiếu chấm Hội đồng (Cô Nguyễn Thị Thúy Hà)
1. **Hiện trạng điều tra**:
   - Dữ liệu thực tế xác nhận Cô Nguyễn Thị Thúy Hà (`nguyenthithuyha1@tdtu.edu.vn`, `scorerId: DwkFZcqfKrKaYMzQSEcd`) **ĐÃ CHẤM ĐIỂM** cho sinh viên Trang Trần Tuệ Nhã (11900382) với điểm chữ `B` (7.50) lúc `2026-10-16T08:14:55.721Z`.
   - Điểm tổng kết của Hội đồng 1 đã tính đúng: `(7.5 + 7.5 + 7.0) / 3 = 7.33` $\rightarrow$ Điểm B.
   - Nguyên nhân hiển thị `-- Chưa chấm` trong modal: Điểm của cô Hà được lưu trong subcollection `graduationRounds/{roundId}/reviewDecisions/{decisionKey}`, nhưng modal cũ chỉ đọc trong root doc cache `state.councilScores` / `roundDoc.councilScores`.
2. **Giải pháp đã thực hiện**:
   - Mở rộng logic tra cứu trong `defense-scores.js` và `preliminary-dashboard.js` với bộ khóa đa thuộc tính: `scorerId`, `memberEmail`, `memberId`, `councilRubricScores`, và cơ chế fallback bất đồng bộ đọc từ `reviewDecisions`.

### 2.5. Nhóm E (P2): Thu hồi công bố & Điều chỉnh kết quả có Audit Log
1. **E1 - Thu hồi công bố**:
   - Toolbar Duyệt đợt 1, 2, 3 hiển thị nút `↩️ Thu hồi công bố` khi đợt đã công bố.
   - Bấm nút mở modal `modal-revoke-progress-review`: yêu cầu nhập lý do bắt buộc (tối thiểu 10 ký tự) và tích chọn xác nhận.
   - Khi xác nhận: cập nhật `published: false`, ghi `auditLogs`, và giao diện Sinh viên / GVHD lập tức quay về trạng thái "Chưa công bố".
2. **E2 - Điều chỉnh kết quả Hội đồng**:
   - Nút `✏️ Điều chỉnh kết quả` trong footer modal chi tiết điểm Hội đồng (`modal-council-score-details`).
   - Guard RBAC: Chỉ Admin và Owner mới có quyền.
   - Guard Công bố: Nếu đợt đang ở trạng thái "Đã công bố", hệ thống **chặn chỉnh sửa** và yêu cầu phải "Thu hồi công bố" trước để đảm bảo tính minh bạch.
   - Form điều chỉnh yêu cầu: Chọn điểm chữ mới (A, A-, B+, B, B-, C+, C, F), nhập Căn cứ/Biên bản họp, nhập Lý do điều chỉnh (tối thiểu 10 ký tự).
   - Tự động quy đổi điểm số và tính lại kết luận Đạt/Không đạt ($\ge B-$ là Đạt, $\le C+$ là Không đạt).
   - Ghi bản ghi kiểm toán bất biến vào `auditLogs` (`action: 'ADJUST_COUNCIL_SCORE'`).
3. **E3 - Bảo mật Firestore Rules**:
   - Đã kiểm tra thành công 30/30 tests trên Firestore Emulator (`npm run test:rules`).
   - Bảo toàn nguyên tắc: **Tuyệt đối không tự ý deploy Firestore Rules hoặc Cloud Functions lên Production khi chưa có phê duyệt.**

---

## 3. CÁC FILE ĐÃ SỬA VÀ TẠO MỚI
1. `templates/modals/grading/modal-revoke-progress-review.html` *(Mới)*: Modal thu hồi công bố kết quả.
2. `templates/modals/grading/modal-adjust-council-score.html` *(Mới)*: Modal điều chỉnh kết quả đánh giá Hội đồng.
3. `templates/modals/students/modal-student-activity-history.html` *(Mới)*: Modal lịch sử 10 hoạt động gần nhất của sinh viên.
4. `templates/modals/grading/modal-council-score-details.html`: Bổ sung nút `✏️ Điều chỉnh kết quả` trong footer.
5. `scripts/reconcile-and-recover-submissions.cjs` *(Mới)*: Script đối soát bài nộp thực tế (mặc định `--dry-run`).
6. `tests/test-hotfix-comprehensive-audit.cjs` *(Mới)*: 16 automated tests kiểm thử toàn diện 5 nhóm A, B, C, D, E.
7. `index.template.html` & `index.html`: Tích hợp 3 modal mới vào khung ứng dụng.
8. `views/admin/tab-students.html`: Đổi tên tiêu đề cột thành "Hoạt động gần nhất".
9. `views/admin/tab-scoring.html`: Tích hợp vùng hiển thị thu hồi công bố.
10. `js/grading/defense-scores.js`: Sửa nhận diện phiếu chấm Hội đồng đa thuộc tính.
11. `js/grading/preliminary-dashboard.js`: Toàn bộ logic thu hồi công bố, điều chỉnh điểm, RBAC guard và audit log.
12. `js/students/student-review-submissions.js`: Mở bài trực tiếp Google Drive tab mới, click badge xem modal chi tiết.
13. `js/students/student-eligibility-admin.js`: Gắn sự kiện click mở modal lịch sử hoạt động sinh viên.
14. `js/tracking/user-activity-tracker.js`: Logic tổng hợp 10 hoạt động thực tế có kiểm chứng.
15. `package.json`: Cập nhật lệnh `npm test`.
16. `docs/AI-HANDOFF.md` *(Cập nhật)*: Bản bàn giao hiện tại.

---

## 4. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG
- **`npm test`**: **188 / 188 tests PASS (100%)**.
- **`npm run test:rules`**: **30 / 30 tests PASS trên Firestore Emulator**.
- **`node scripts/build-html.cjs`**: Biên dịch thành công `index.html` với 64 partials.
- **`git diff --check`**: 0 lỗi cú pháp hoặc khoảng trắng.
- **`node scripts/reconcile-and-recover-submissions.cjs`**: Chạy thành công ở chế độ `--dry-run`, xác thực 3 sinh viên hợp lệ, ghi báo cáo vào `backups/`.

---

## 5. CAM KẾT VÀ TRẠNG THÁI TRIỂN KHAI
- [x] Đã kiểm thử đầy đủ frontend và tích hợp trên máy tính mới.
- [x] Đã bảo toàn tuyệt đối dữ liệu sinh viên thật, điểm thật trên Production (chưa chạy `--apply` khi chưa được duyệt).
- [x] Đã bảo toàn Firestore Rules và Cloud Functions (không tự deploy lên Production).
- [ ] Sẵn sàng triển khai Firebase Hosting (`ifa-graduation`) cho phần frontend an toàn đã qua kiểm thử.
