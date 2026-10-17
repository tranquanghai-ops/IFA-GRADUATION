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

---

## 6. PHASE SECURITY HARDENING: KHẮC PHỤC RÒ RỈ ĐIỂM FIRESTORE & 3-TIER ARCHITECTURE
*Thời điểm thực hiện: 2026-10-17*

### 6.1. Mục tiêu & Kiến trúc 3 tầng (3-Tier Data Architecture)
Khắc phục lỗ hổng rò rỉ điểm số và biên bản đánh giá nội bộ của từng ủy viên hội đồng trên document gốc `graduationRounds/{roundId}`:
1. **Tier A (Public Round Metadata)**:
   - Collection: `graduationRounds/{roundId}`.
   - Nội dung: Chỉ lưu metadata đợt, mốc thời gian, trạng thái công bố (`duyet_1: { published: true, publishedAt, ... }`).
   - Loại bỏ hoàn toàn `councilScores` (điểm của từng ủy viên) và `studentResults` (kết quả chi tiết của toàn bộ sinh viên).
   - Quyền: Đọc cho mọi người dùng đã đăng nhập; Ghi chỉ dành cho Admin/Owner.
2. **Tier B (Private Internal Deliberation & Scoring Storage)**:
   - Collection: `graduationRounds/{roundId}/reviewDecisions/{decisionKey}`.
   - Nội dung: Phiếu chấm chi tiết của từng ủy viên, nhận xét, căn cứ hội đồng.
   - Quyền: Sinh viên và người ngoài KHÔNG thể đọc/ghi; Chỉ ủy viên thuộc hội đồng mới đọc được phiếu của hội đồng mình; Khóa ghi khi hội đồng đã `finalized` hoặc `ended`.
3. **Tier C (Published Student Results with Least-Privilege RBAC)**:
   - Collection: `publishedStudentResults/{studentId}` (hoặc subcollection theo round).
   - Snapshot quản trị: `publishedProgressReviews/{phaseKey}` (chỉ Admin/Owner đọc/ghi).
   - Quyền `publishedStudentResults/{studentId}`:
     - `allow get`: Admin/Owner, hoặc chính sinh viên đó (`email` khớp `studentId` và `status != 'revoked'`), hoặc GVHD được phân công chính thức (`officialAssignments` / `supervisorAssignments` và `status != 'revoked'`).
     - `allow list`: Chỉ Admin/Owner (chặn sinh viên/GVHD query vét toàn bộ kết quả của khoa).
     - `allow write`: Chỉ Admin/Owner.

### 6.2. Các file đã triển khai & cập nhật
1. `firestore.rules`:
   - Bổ sung helper `isAssignedSupervisor(stId)` đối chiếu `officialAssignments` và `supervisorAssignments`.
   - Bổ sung helper `isResultPublished(data)` kiểm tra trạng thái công bố và chặn đọc khi `status == 'revoked'`.
   - Hardening rule cho `/publishedStudentResults/{studentId}`, `/publishedProgressReviews/{phaseKey}`, và `/reviewDecisions/{decisionId}`.
2. `js/grading/preliminary-dashboard.js`:
   - `confirmPublishProgressReview`: Tách bạch rõ rệt: ghi root metadata sạch không chứa điểm từng người; ghi snapshot quản trị; ghi kết quả riêng lẻ từng sinh viên vào `publishedStudentResults/{stId}` với `{ merge: true }` (bảo toàn Duyệt 1 khi công bố Duyệt 2).
   - `confirmRevokeProgressReview`: Đưa `status: 'revoked'`, `isPublished: false` vào `publishedStudentResults/{stId}`, cắt ngay quyền đọc cấp Firestore Rules; xóa `studentResults` khỏi root doc.
   - `confirmAdjustCouncilScore`: Ghi quyết định điều chỉnh vào `reviewDecisions`, ghi audit log bất biến, không đẩy điểm vào root doc.
   - `window.getStudentPublishedReviewResult`: Đọc từ `publishedStudentResults/{studentId}` kèm bộ nhớ đệm cache và fallback an toàn.
3. `js/grading/rubrics-scoring.js` & `js/grading/preliminary-entry.js`: Loại bỏ các thao tác ghi trùng lặp `councilScores` và `progressReviews` lên root doc `roundRef`.
4. `js/grading/councils-editor.js`: Hàm `persistActivityCouncilChanges` tự động làm sạch `activities` (loại bỏ `finalDefenseScores`) trước khi lưu root doc.
5. `js/students/student-journey.js`, `js/rounds/rounds-timeline-preview.js`, `js/supervisors/supervisor-portal-students.js`: Đồng bộ đọc kết quả duyệt qua `getStudentPublishedReviewResult`.
6. `scripts/migrate-firestore-security.cjs` *(Mới)*: Script di chuyển dữ liệu bảo mật (mặc định `--dry-run`, có backup JSON tự động, hỗ trợ `--apply` và `--rollback`).
7. `tests/test-firestore-security-hardening.rules.test.mjs` *(Mới)*: Bộ test 12 ca kiểm thử Firestore Rules với 10 danh tính người dùng.
8. `tests/test-post-migration-business.cjs` *(Mới)*: 7 ca kiểm thử toàn diện quy trình nghiệp vụ sau di chuyển.
9. `docs/FIRESTORE-SECURITY-MIGRATION.md` *(Mới)*: Tài liệu phân tích lỗ hổng, kiến trúc 3 tầng, ma trận RBAC và kế hoạch rollback.

### 6.3. Kết quả kiểm thử tự động
- **`npm test`**: **188 / 188 unit tests PASS (100%)**.
- **`npm run test:rules`**: **42 / 42 rules tests PASS trên Firestore Emulator (100%)** (gồm 12 tests hardening mới + 30 tests kế thừa).
- **`node tests/test-post-migration-business.cjs`**: **7 / 7 business tests PASS (100%)**.
- **`scripts/migrate-firestore-security.cjs --dry-run`**: Thực thi thành công, tạo bản sao lưu tại `backups/firestore-security-backup-2026-10-17T01-58-14-470Z.json`, 0 write operations thực tế.

### 6.4. Cam kết bảo đảm an toàn
- Tuyệt đối KHÔNG deploy Firestore Rules lên Production khi chưa có phê duyệt.
- Tuyệt đối KHÔNG deploy Cloud Functions lên Production.
- Tuyệt đối KHÔNG chạy `--apply` trên dữ liệu thật của Production.
- Tuyệt đối KHÔNG deploy Hosting có phiên bản phá vỡ tương thích dữ liệu hiện hành.

---

## 7. SIMPLIFIED SECURITY CUTOVER & STUDENT RESULT UI ENHANCEMENT
*Thời điểm thực hiện: 2026-10-17*

### 7.1. Chuẩn hóa & Nâng cấp Giao diện Điểm Sinh viên (Student Portal UI)
1. **Gộp điểm trực tiếp vào thẻ Duyệt đồ án**:
   - Vị trí: Nằm ngay bên trong thẻ mốc tương ứng (Tuần 4 - Duyệt đợt 1, Tuần 8 - Duyệt đợt 2, Tuần 12 - Duyệt đợt 3) thuộc phần *"Lộ trình Đồ án Tốt nghiệp & Tiến độ thực hiện"*.
   - Loại bỏ hoàn toàn các thẻ đánh giá Hội đồng dư thừa bên ngoài.
2. **Quy cách hiển thị chuẩn**:
   - Nhãn mô tả: `Đánh giá Hội đồng` (`text-[10px] uppercase font-bold`).
   - Trạng thái kết luận: `✓ Đạt yêu cầu` (xanh lá `emerald`) hoặc `✕ Không đạt yêu cầu` (đỏ `rose`) rõ ràng.
   - Điểm chữ nổi bật: `B`, `B+`, `C+`... hiển thị với cỡ chữ lớn (`font-mono font-black text-xl sm:text-2xl`) trong khung điểm riêng biệt.
   - Nội dung mô tả chuẩn xác: *"Đánh giá Hội đồng: Đạt yêu cầu – B"* (hoặc *"Không đạt yêu cầu – C+"*).
   - Quy tắc ẩn an toàn: Khi mốc chưa tới, chưa công bố, hoặc đã bị thu hồi: ẩn hoàn toàn khối điểm (`reviewResultHtml = ''`), không chiếm diện tích và không để lộ thông tin đánh giá.
3. **Đồng bộ Dialog chi tiết mốc (`rounds-timeline-preview.js`)**:
   - Cập nhật dialog chi tiết khi sinh viên click vào mốc với bố cục Đánh giá Hội đồng tương thích, điểm chữ cỡ lớn và kết luận Đạt/Không đạt.

### 7.2. Xử lý Thu hồi Độc lập Từng Đợt Duyệt (Multi-Phase Revoke)
- Sửa đổi `confirmRevokeProgressReview` trong `preliminary-dashboard.js`:
  - Khi thu hồi Duyệt 1, nếu Duyệt 2 vẫn đang ở trạng thái công bố, document cấp root `publishedStudentResults/{studentId}` giữ nguyên `status: 'published'` để sinh viên/GVHD tiếp tục xem được Duyệt 2 hợp lệ. Chỉ khi toàn bộ các đợt bị thu hồi mới chuyển root status thành `'revoked'`.
  - Tự động nạp danh sách sinh viên cần thu hồi từ snapshot quản trị `publishedProgressReviews/duyet_${phase}` nếu trường `studentResults` trên root document đã được dọn dẹp.

### 7.3. Bộ Công cụ Cutover Đơn giản & An toàn (`migrate-firestore-security.cjs`)
Hoàn thiện script với 4 chế độ hoạt động:
1. `--dry-run` (Mặc định): Kiểm kê toàn bộ dữ liệu, tự động xuất file backup JSON dạng snapshot, 0 write operations.
2. `--apply`: Di chuyển kết quả từng sinh viên sang `publishedStudentResults/{studentId}` và lưu snapshot toàn đợt vào `publishedProgressReviews/{pKey}`.
3. `--cleanup-root`: Kiểm tra đối soát 100% dữ liệu đã có trong subcollections trước khi xóa các trường rò rỉ (`councilScores`, `studentResults`, `finalDefenseScores`) khỏi root document. Tự động tạo bản backup `pre-cleanup-backup` trước khi sửa.
4. `--rollback=<backup-file>`: Khôi phục tức thì toàn bộ cấu trúc gốc từ file JSON sao lưu.
