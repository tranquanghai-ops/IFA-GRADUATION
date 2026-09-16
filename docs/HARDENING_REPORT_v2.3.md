# BÁO CÁO TOÀN DIỆN: RÀ SOÁT KIẾN TRÚC DỮ LIỆU, BẢO MẬT & CONCURRENCY
## IFA+ GRADUATION BETA — v2.3.0 (SAFE DEVELOPMENT MODE)

> **Mã báo cáo**: HARDENING-v2.3-SEC-ARCH-01  
> **Phiên bản hệ thống được rà soát**: v2.2.0-beta.1 (chuẩn bị cho v2.3.0-beta.1)  
> **Chế độ**: SAFE DEVELOPMENT MODE — Tuyệt đối không tự ý deploy Firestore Rules, Storage Rules, Cloud Functions hay thay đổi hạ tầng dùng chung.  
> **Thời điểm rà soát**: 16/09/2026.  

---

### MỤC LỤC
1. [Tổng quan & Mục tiêu Rà soát](#1-tổng-quan--mục-tiêu-rà-soát)
2. [Data Model Inventory (Kiểm kê Danh mục Dữ liệu Toàn hệ thống)](#2-data-model-inventory)
3. [Document Size Risk (Nguy cơ Vượt giới hạn 1 MiB của Firestore Document)](#3-document-size-risk)
4. [Phân loại Dữ liệu Nested theo Nguy cơ (High-Risk Nested Data Classification)](#4-phân-loại-dữ-liệu-nested-theo-nguy-cơ)
5. [Dual-Source Activity & Nợ Kỹ thuật (Technical Debt)](#5-dual-source-activity--nợ-kỹ-thuật)
6. [Score Storage & Single Source of Truth Review](#6-score-storage--single-source-of-truth-review)
7. [Concurrency & Lost Update Review](#7-concurrency--lost-update-review)
8. [First-Completed-Wins & Atomic Check Review](#8-first-completed-wins--atomic-check-review)
9. [Submission Concurrency & Versioning Review](#9-submission-concurrency--versioning-review)
10. [Ma trận Phân quyền: App Guard vs. Firestore Rules Enforcement](#10-ma-trận-phân-quyền-app-guard-vs-firestore-rules)
11. [Direct Link, Role Capabilities & Privacy Review](#11-direct-link-role-capabilities--privacy-review)
12. [Audit Log Integrity & Immutability](#12-audit-log-integrity--immutability)
13. [Kiến trúc An toàn Google Drive & Quét Mã Độc/Lộ Token](#13-kiến-trúc-an-toàn-google-drive--quét-mã-độclộ-token)
14. [Đánh giá Hiệu năng & Rung chuyển Dữ liệu 1.800+ Giảng viên](#14-đánh-giá-hiệu-năng--rung-chuyển-dữ-liệu-1800-giảng-viên)
15. [Kiến trúc Mục tiêu Đề xuất (Target Data Architecture)](#15-kiến-trúc-mục-tiêu-đề-xuất)
16. [Kế hoạch Chuyển đổi An toàn (Migration Plan theo 5 Pha)](#16-kế-hoạch-chuyển-đổi-an-toàn-migration-plan)
17. [Phân cấp Mức độ Nghiêm trọng & Ưu tiên Khắc phục](#17-phân-cấp-mức-độ-nghiêm-trọng--ưu-tiên-khắc-phục)

---

### 1. TỔNG QUAN & MỤC TIÊU RÀ SOÁT

Hệ thống IFA+ Graduation Beta đã trải qua các phiên bản phát triển nhanh (v1.6.0 đến v2.2.0) xây dựng đầy đủ toàn bộ chức năng từ Đăng ký, Duyệt GVHD, Timeline Kế hoạch, Quản lý Hội đồng, Chấm Sơ khảo, Chấm Điểm GVHD, Chấm Thuyết minh, Chấm Điểm Bảo vệ Rubric, Hiệu chỉnh Điểm, Điểm Tổng kết, Bảng Xếp hạng Đợt, Xuất Excel, và Nộp bài theo Mốc kèm Kiến trúc Google Drive.

Mục tiêu của đợt SAFE DEVELOPMENT REVIEW (v2.3.0) là:
- Đánh giá trung thực, không né tránh mọi rủi ro kỹ thuật, giới hạn tải và điểm nghẽn bảo mật.
- Kiểm tra tính bền vững của mô hình dữ liệu khi bước vào quy mô thực tế (100–200 sinh viên, nhiều hội đồng).
- Rà soát sự chênh lệch giữa kiểm tra phía giao diện người dùng (App Guard) và rào chắn thực thi tại cơ sở dữ liệu (Firestore Rules).
- Lập kế hoạch lộ trình chuyển đổi (Migration Plan) an toàn mà không phá vỡ hoạt động production hiện tại.

---

### 2. DATA MODEL INVENTORY

Dưới đây là bảng kiểm kê chi tiết toàn bộ các thực thể dữ liệu trong hệ thống:

| STT | Thực thể Dữ liệu | Vị trí Lưu trữ Hiện tại | Cấu trúc Lưu trữ | Key Format | Quyền Đọc | Quyền Ghi | Nguy cơ Lớn nhất |
|:---:|:---|:---|:---|:---|:---|:---|:---|
| 1 | **graduationRounds** | Document cấp cao: `/graduationRounds/{roundId}` | Document chính | `roundId` (string) | All Signed-in | Admin | Bị phình to vượt quá 1 MiB |
| 2 | **activities** | Nested trong `roundDoc.activities` (đồng thời sync sang subcollection `/activities/{actId}`) | Array of Objects | `actId` (e.g. `act_172...`) | All Signed-in | Admin | Ghi đè toàn mảng (Array overwrite) khi nhiều admin sửa cùng lúc |
| 3 | **councils & structure** | Nested bên trong từng activity trong `roundDoc.activities` | Array of Objects | `councilId` (e.g. `council_1`) | All Signed-in | Admin | Mất dữ liệu khi lưu Activity nếu không merge cẩn thận |
| 4 | **councilStudentAssignments** | Nested trong `activity.councilStudentAssignments` | Array of Objects | `{ studentId, councilId, presentationOrder }` | All Signed-in | Admin | Xung đột thứ tự trình bày khi phân công đồng thời |
| 5 | **councilScores** | Nested map trong `roundDoc.councilScores` | Key-value Map | `{actId}_{studentId}_{scorerEmail}` | All Signed-in | Admin / Staff (UI guard) | Map tăng theo cấp số nhân ($S \times M \times A$), gây cạn kiệt 1 MiB |
| 6 | **reviewDecisions** | Subcollection: `/graduationRounds/{roundId}/reviewDecisions/{decisionId}` | Separate Docs | `{supervisorEmail}_{studentId}_{phase}` | Admin / Staff | Admin / Staff (GV chính chủ) | Không có nguy cơ kích thước; an toàn cao |
| 7 | **preliminaryScores** | Nested map trong `roundDoc.preliminaryScores` | Map | `studentId` -> `scorerEmail` | All Signed-in | Admin / Staff (Scorer) | Phình to kích thước document round |
| 8 | **supervisorScores** | Nested map trong `roundDoc.supervisorScores` | Map | `studentId` -> `{ score, feedback }` | All Signed-in | Admin / GVHD | Race condition giữa 2 GVHD đồng hướng dẫn |
| 9 | **thesisScores** | Nested map trong `roundDoc.thesisScores` | Map | `studentId` -> `{ scoreHD, scorePB }` | All Signed-in | Admin / GVHD / GVPB | GVPB có thể ghi đè nhầm nếu dùng full object thay vì dot-notation |
| 10 | **reviewerAssignments** | Nested array trong `roundDoc.reviewerAssignments` | Array of Objects | `[ { studentId, reviewerEmail } ]` | All Signed-in | Admin | Mất cập nhật nếu phân công từ nhiều tab |
| 11 | **finalScoreConfig** | Nested object trong `roundDoc.finalScoreConfig` | Object | `{ supervisorWeight, thesisWeight, defenseWeight }` | All Signed-in | Admin | Nhẹ, an toàn khi nested |
| 12 | **rankingSnapshot** | Nested object trong `roundDoc.rankingSnapshot` | Object chứa mảng xếp hạng | `{ finalizedAt, rankedStudents: [...] }` | All Signed-in | Admin | Khi đợt 200 SV, snapshot này chiếm khoảng 25–40 KB |
| 13 | **auditLogs** | Nested array trong `roundDoc.auditLogs` | Array of Objects | `[ { id, timestamp, type, action, by } ]` | All Signed-in | Admin | Mảng chỉ tăng (append), chắc chắn sẽ chạm trần nếu vận hành lâu |
| 14 | **activitySubmissions** | Nested map trong `roundDoc.activitySubmissions` | Nested Map & Arrays | `{actId}.{studentId}.attempts` | All Signed-in | Student / Admin | Sinh viên 2 tab nộp đồng thời gây mất attempt |
| 15 | **submissionOverrides** | Nested map trong `roundDoc.submissionOverrides` | Map | `{studentId}.{actId}` | All Signed-in | Admin | Nhẹ, ít nguy cơ kích thước |
| 16 | **eligibleStudents** | Subcollection: `/graduationRounds/{roundId}/eligibleStudents/{studentId}` | Separate Docs | `studentId` (MSSV) | Admin / Student chính chủ | Admin | An toàn cao, tách riêng biệt |
| 17 | **registrations** | Subcollection: `/graduationRounds/{roundId}/registrations/{studentId}` | Separate Docs | `studentId` (MSSV) | Admin / GVHD / Student chính chủ | Student / Admin | Rất an toàn, có rule kiểm tra điều kiện |
| 18 | **supervisors** | Subcollection: `/graduationRounds/{roundId}/supervisors/{supervisorId}` | Separate Docs | `supervisorId` (email) | All Signed-in | Admin / GVHD | An toàn, quản lý quota đợt |

---

### 3. DOCUMENT SIZE RISK

Firestore áp dụng giới hạn cứng không thể vượt qua: **1.048.576 bytes (1 MiB) cho mỗi Document**.

#### Kịch bản tính toán chi tiết:
1. **Đợt Nhỏ (50 Sinh viên, 5 Mốc Kế hoạch, 2 Hội đồng/Mốc, 3 Giảng viên chấm/Hội đồng)**:
   - Dữ liệu cơ bản & Activities: ~35 KB
   - Hội đồng & Phân công SV: ~15 KB
   - Điểm Hội đồng (`councilScores`): 3 mốc chấm x 50 SV x 3 GV = 450 records x 400 B ≈ 180 KB.
   - Điểm Sơ khảo, GVHD, Thuyết minh: ~50 KB.
   - Bài nộp (`activitySubmissions`): 2 mốc nộp x 50 SV x 2 lần nộp = 200 records x 350 B ≈ 70 KB.
   - Audit logs (100 sự kiện): ~25 KB.
   - **Tổng dung lượng**: ≈ 375 KB (~36% giới hạn). Trạng thái: **AN TOÀN**.

2. **Đợt Trung bình (100 Sinh viên, 8 Mốc Kế hoạch, 4 Hội đồng/Mốc, 4 Giảng viên chấm/Hội đồng)**:
   - Dữ liệu cơ bản & Activities: ~60 KB
   - Điểm Hội đồng: 4 mốc chấm x 100 SV x 4 GV = 1.600 records x 450 B ≈ 720 KB.
   - Điểm Sơ khảo, GVHD, Thuyết minh: ~100 KB.
   - Bài nộp: 3 mốc nộp x 100 SV x 2 lần nộp = 600 records x 350 B ≈ 210 KB.
   - Audit logs + Ranking snapshot: ~80 KB.
   - **Tổng dung lượng**: ≈ 1.170 KB > 1.024 KB (114% giới hạn).
   - ⚠️ **KẾT QUẢ: LỖI CRITICAL RESOURCE_EXHAUSTED / Document exceeds maximum size of 1 MiB. FIRESTORE TỪ CHỐI GHI DỮ LIỆU!**

3. **Đợt Lớn (200 Sinh viên, 10 Mốc Kế hoạch, 6 Hội đồng, 5 Giảng viên chấm)**:
   - `councilScores` đạt ≈ 1.8 MB.
   - `activitySubmissions` đạt ≈ 600 KB.
   - Tổng document vượt quá 2.8 MB (270% giới hạn cho phép).

> **KẾT LUẬN**: Mô hình nhúng toàn bộ điểm số (`councilScores`), lịch sử bài nộp (`activitySubmissions`) và nhật ký kiểm toán (`auditLogs`) vào một document duy nhất `graduationRounds/{roundId}` **chỉ chịu tải được dưới 70 sinh viên**. Bắt buộc phải chuyển đổi sang subcollections trước khi vận hành đợt thực tế!

---

### 4. PHÂN LOẠI DỮ LIỆU NESTED THEO NGUY CƠ

#### Nhóm 1: MUST MOVE BEFORE PRODUCTION (Bắt buộc chuyển sang Subcollection)
1. **`councilScores`**: Tăng theo O(Activities x Students x Scorers). Phải chuyển sang:
   `/graduationRounds/{roundId}/councilScores/{scoreKey}`
2. **`activitySubmissions`**: Tăng theo O(Activities x Students x Attempts). Phải chuyển sang:
   `/graduationRounds/{roundId}/submissions/{submissionId}`
3. **`auditLogs`**: Danh sách append-only không có điểm dừng. Phải chuyển sang:
   `/graduationRounds/{roundId}/auditLogs/{logId}`

#### Nhóm 2: SHOULD MOVE LATER (Nên chuyển khi mở rộng)
1. **`activities`**: Chuyển quyền ghi đơn nhất sang subcollection `/graduationRounds/{roundId}/activities/{actId}` thay vì lưu mảng trong document gốc.
2. **`rankingSnapshot` & `finalScoreConfigSnapshot`**: Chuyển sang document con `/graduationRounds/{roundId}/snapshots/ranking`.
3. **`thesisScores` & `supervisorScores`**: Có thể gom thành document theo sinh viên `/graduationRounds/{roundId}/studentScores/{studentId}`.

#### Nhóm 3: SAFE TO KEEP NESTED (An toàn khi giữ nested)
1. Thông tin cấu hình: `finalScoreConfig`, `preliminaryConfig`, `supervisorScoreConfig`.
2. Trạng thái và mốc thời gian: `openAt`, `closeAt`, `status`, `publishFinalScoreToStudents`, `publishRankingToStudents`.
3. Cấu hình tích hợp Drive: `driveRootFolderId`.

---

### 5. DUAL-SOURCE ACTIVITY & NỢ KỸ THUẬT

- **Tình trạng thực tế**:
  - Khi tạo/sửa mốc trong `saveActivityForm`, hệ thống ghi vào mảng `targetRound.activities` trong `roundDoc` (Primary), đồng thời gửi thêm một lệnh ghi không đồng bộ sang subcollection `/activities/{actId}` với lệnh bọc lỗi `.catch(() => {})`.
  - Khi hiển thị (`loadAdminRoundActivities`, `loadStudentRoundActivities`), hàm đọc `targetRound.activities`. Chỉ khi mảng rỗng mới query từ subcollection `/activities`.
- **CURRENT SOURCE**: `graduationRounds/{roundId}.activities` (Mảng nested trong document đợt).
- **FALLBACK**: Subcollection `/graduationRounds/{roundId}/activities`.
- **RỦI RO TỒN ĐỌNG**:
  - Khi lệnh ghi subcollection bị lỗi âm thầm (`catch`), subcollection bị tụt hậu so với document chính.
  - Sửa đổi mảng `activities` đòi hỏi ghi lại toàn bộ mảng. Nếu 2 quản trị viên cùng cấu hình 2 mốc khác nhau tại cùng một thời điểm, người ghi sau sẽ đè mất dữ liệu của người ghi trước (Lost Update trên cấp độ mảng).

---

### 6. SCORE STORAGE & SINGLE SOURCE OF TRUTH REVIEW

| Thành phần Điểm | Nơi tính toán / Lưu trữ | Nguồn Thẩm quyền Đơn nhất (Single Source of Truth) | Rủi ro Không đồng bộ |
|:---|:---|:---|:---|
| **Sơ khảo** | `round.preliminaryScores[studentId][scorerEmail]` | Map `preliminaryScores` | Thấp, cấu trúc phân nhánh rõ theo scorer |
| **Điểm GVHD** | `round.supervisorScores[studentId]` | `round.supervisorScores[studentId].score` | Nếu sửa điểm ngoài dashboard, cần lưu vết |
| **Thuyết minh HD & PB** | `round.thesisScores[studentId]` | `getThesisFinalScore()` tính trung bình cộng `(scoreHD + scorePB) / 2` | Ổn định, không tạo 2 nguồn cạnh tranh |
| **Điểm Hội đồng Bảo vệ** | `round.councilScores[scoreKey]` | `getOfficialDefenseScore()` tính từ các phiếu thành viên chính thức kèm hiệu chỉnh | Rất cao nếu dot-notation bị đè bởi lệnh update cả mảng activity |
| **Điểm Tổng kết** | Tính toán động (`getFinalScore()`) | Không lưu điểm tổng kết tĩnh, tính runtime theo công thức trọng số | **Rất tốt**: Tránh triệt để stale data do công thức thay đổi |

---

### 7. CONCURRENCY & LOST UPDATE REVIEW

| Thao tác | Cơ chế Ghi Hiện tại | Phân loại Rủi ro | Giải pháp Khuyến nghị |
|:---|:---|:---:|:---|
| Thành viên A & B chấm 2 sinh viên khác nhau | Dot-notation `councilScores.act_stA_memA` | **SAFE** | Firestore map dot-notation độc lập |
| Thành viên A và Chủ tịch cùng sửa điểm 1 sinh viên | Dot-notation vào cùng 1 key `councilScores.act_st_memA` | **MERGE-RISK** | Cần cơ chế kiểm tra `updatedAt` hoặc trạng thái `locked` |
| Sửa Hội đồng trong khi thành viên chấm bài | Line 11272 ghi cả `councilScores` và `activities` | **MERGE-RISK** | Tách hẳn `councilScores` ra khỏi cập nhật mảng `activities` |
| 2 GVHD cùng xác nhận điểm GVHD (First-completed) | Client kiểm tra `if (!score) updateDoc()` | **TRANSACTION-REQUIRED** | Bắt buộc dùng `runTransaction` để khóa lạc quan |
| 2 Tab sinh viên cùng ấn nộp bài | Client tính `attempt = length + 1` rồi ghi | **TRANSACTION-REQUIRED** | Cần ID attempt do server sinh hoặc Transaction |
| Admin chốt kết quả đợt (Finalize) | Ghi toàn bộ snapshot `finalScoreConfigSnapshot` | **SAFE** | Thao tác đơn quyền (chỉ Admin thực hiện) |

---

### 8. FIRST-COMPLETED-WINS & ATOMIC CHECK REVIEW

Quy tắc nghiệp vụ: *"Giảng viên nào hoàn tất nhập điểm hướng dẫn trước thì lấy điểm của người đó làm điểm chính thức"*.
- **Hiện trạng code**:
  Ứng dụng đọc trạng thái trên client: check-then-act.
- **RỦI RO**: Hoàn toàn không atomic. Nếu 2 giảng viên cùng mở phiếu chấm và bấm hoàn tất cách nhau vài mili-giây, cả hai yêu cầu đều vượt qua kiểm tra client. Phiếu nào đến server sau cùng sẽ ghi đè và trở thành điểm chính thức (Last-completed-wins thay vì First-completed-wins).
- **GIẢI PHÁP**: Cần áp dụng Firestore `runTransaction()` trong các đợt phát triển tiếp theo khi có backend/rules hỗ trợ.

---

### 9. SUBMISSION CONCURRENCY & VERSIONING REVIEW

- **Hiện trạng code**: `attemptNum = valRes.rules.completedAttempts + 1;`
- **RỦI RO**: Nếu sinh viên mở 2 tab trình duyệt cùng lúc và bấm nộp đồng thời, cả 2 tab đều xác định lượt nộp là Attempt 2, gây ghi đè lần nộp.
- **GIẢI PHÁP**: Lưu từng attempt thành document độc lập trong subcollection `/submissions/{submissionId}` với ID duy nhất do hệ thống sinh.

---

### 10. MA TRẬN PHÂN QUYỀN: APP GUARD VS. FIRESTORE RULES

| Nghiệp vụ / Tài nguyên | App Guard (Frontend) | Firestore Rules Hiện tại | Đánh giá Mức độ Bảo mật Thực tế | Lỗ hổng Cần Khắc phục trong Rules Mới |
|:---|:---:|:---:|:---|:---|
| Tạo / Sửa Đợt Tốt nghiệp | Bắt buộc Admin | `allow write: if admin();` | **RẤT TỐT (Enforced)** | Không có |
| Đăng ký Đề tài của SV | Bắt buộc đúng MSSV & Đủ điều kiện | `allow create/update: if student() && studentId == email.prefix` | **RẤT TỐT (Enforced)** | Đã kiểm tra trong `eligibleStudents` |
| Phân công GVHD | Bắt buộc Admin | `allow write: if admin();` | **RẤT TỐT (Enforced)** | Không có |
| Duyệt Nguyện vọng (Review Phase) | Bắt buộc GVHD chính chủ | `allow write: if admin() || (staff() && email == supervisorEmail)` | **RẤT TỐT (Enforced)** | Collection `reviewDecisions` bảo vệ chặt |
| Nhập Điểm Hội đồng (Council Score) | Check vai trò thành viên HĐ trong app | **CHƯA CÓ RULE RIÊNG** (Bị chặn nếu không phải Admin, hoặc không được bảo vệ nếu mở Round doc) | ⚠️ **THIẾU SÓT**: Non-admin staff hiện không thể ghi trực tiếp vào `roundDoc` nếu Rules chỉ cho `admin()` ghi | Cần mở subcollection `councilScores/{id}` cho phép thành viên ghi điểm của chính mình |
| Chấm Sơ khảo | Check danh sách Scorer trong config | **CHƯA CÓ RULE RIÊNG** | ⚠️ **PHỤ THUỘC CLIENT**: Không có ràng buộc ở cấp Database | Cần rule kiểm tra email nằm trong `preliminaryConfig.scorers` |
| Nhập Điểm Thuyết minh PB | Check đúng GVPB được phân công | **CHƯA CÓ RULE RIÊNG** | ⚠️ **PHỤ THUỘC CLIENT**: GVPB ghi vào `roundDoc` | Cần rule cho phép GVPB ghi vào bản ghi điểm thuyết minh của SV mình phụ trách |
| Nộp bài Sinh viên (Submission) | Validate tên file, hạn nộp, số lần | **CHƯA CÓ RULE CHO SUBMISSIONS** | ⚠️ **PHỤ THUỘC CLIENT**: Sinh viên ghi vào `roundDoc` sẽ bị `permission-denied` bởi rule `graduationRounds` | Cần tạo subcollection `submissions` cho phép sinh viên tạo attempt chính chủ |
| Gia hạn Nộp bài (Override) | Bắt buộc Admin & Lý do | `allow write: if admin();` (trên round doc) | **TỐT** (Admin only) | Không có |
| Audit Logs | Tự động ghi nhận khi thao tác | Lưu trong mảng `roundDoc.auditLogs` | ⚠️ **KHÔNG BẤT BIẾN**: Bất kỳ ai có quyền sửa round doc đều có thể sửa audit logs | Cần tách sang collection append-only (`allow update, delete: if false;`) |

---

### 11. DIRECT LINK, ROLE CAPABILITIES & PRIVACY REVIEW

1. **Direct Link Navigation (`?x=...&a=...&c=...`)**:
   - Tuyệt đối không cấp quyền dựa vào tham số URL. Chỉ dùng để scroll/mở tab giao diện.
2. **Mô hình Đa vai trò (Multi-Role Capability)**:
   - Đánh giá quyền hạn theo ngữ cảnh thực tế của từng bản ghi (`isSupervised`, `isReviewer`, `isCouncilMember`), không phụ thuộc vào giá trị lựa chọn vai trò trên thanh điều hướng.
3. **Quyền riêng tư Thông tin Liên lạc (Contact Privacy)**:
   - Số điện thoại và email cá nhân của GVHD được bảo vệ, chỉ hiển thị sau khi công bố phân công chính thức.
4. **Quyền riêng tư Điểm số & Thứ hạng (Student Privacy)**:
   - Điểm tổng kết và danh hiệu Thủ khoa / Á khoa được che hoàn toàn khỏi giao diện sinh viên trước khi công bố.
5. **Quyền riêng tư của Chủ tịch Hội đồng (Chair Privacy)**:
   - Chủ tịch Hội đồng không xem được điểm chi tiết của các ủy viên khác khi phiên chấm bảo vệ đang diễn ra (chỉ xem được sau khi kết thúc phiên).

---

### 12. AUDIT LOG INTEGRITY & IMMUTABILITY

- **Hiện trạng**: `auditLogs` lưu trong mảng JSON của `graduationRounds/{roundId}`.
- **ĐÁNH GIÁ**: **CHƯA ĐẠT CHUẨN BẤT BIẾN (NOT TRULY IMMUTABLE)**. Có thể bị sửa hoặc xóa bởi bất kỳ ai có quyền ghi vào `roundDoc`.
- **GIẢI PHÁP**: Tách `auditLogs` sang subcollection riêng với rule:
  `allow create: if signedIn(); allow update, delete: if false;`

---

### 13. KIẾN TRÚC AN TOÀN GOOGLE DRIVE & QUÉT MÃ ĐỘC/LỘ TOKEN

1. **Quét Mã Độc & Secret Scanner**:
   - Access Tokens: **KHÔNG PHÁT HIỆN (0)**
   - Refresh Tokens: **KHÔNG PHÁT HIỆN (0)**
   - Client Secrets: **KHÔNG PHÁT HIỆN (0)**
   - Private Keys: **KHÔNG PHÁT HIỆN (0)**
   - GitHub PATs: **KHÔNG PHÁT HIỆN (0)**
   - Khóa duy nhất là Firebase Web API Key công khai chuẩn của client web.
2. **Đánh giá Cờ Môi trường Thử nghiệm (Mock Uploader)**:
   - `window.__DEV_MOCK_UPLOADER` tắt hoàn toàn trên Production.
   - Khi sinh viên nộp bài, hệ thống gọi `GoogleDriveTrustedUploader` và trả về thông báo trung thực:
     *Google Drive chưa được kết nối an toàn. Cần cấu hình dịch vụ tải tệp phía máy chủ (Trusted Backend Service).*
3. **Phòng vệ Formula Injection & XSS**:
   - `sanitizeExcelCell` bảo vệ 100% các ô chuỗi xuất ra bảng tính Excel.
   - `sanitizeRichHtml` loại bỏ script, iframe, onclick, javascript: trong mô tả kế hoạch.

---

### 14. ĐÁNH GIÁ HIỆU NĂNG & RUNG CHUYỂN DỮ LIỆU 1.800+ GIẢNG VIÊN

- Danh bạ Giảng viên Master toàn trường (>1.800 cán bộ) chỉ được tải khi Admin mở tab quản lý danh bạ chung, hỗ trợ phân trang và tìm kiếm client-side.
- Trong các đợt tốt nghiệp, hệ thống chỉ truy vấn danh sách 20–40 GV đăng ký tham gia đợt đó, không gây quá tải mạng hay tràn RAM.

---

### 15. KIẾN TRÚC MỤC TIÊU ĐỀ XUẤT (TARGET DATA ARCHITECTURE)

- `/graduationRounds/{roundId}` (Cấu hình cốt lõi & trạng thái đợt)
- `/graduationRounds/{roundId}/activities/{activityId}` (Mốc kế hoạch & Hội đồng)
- `/graduationRounds/{roundId}/councilScores/{scoreId}` (Bản ghi điểm hội đồng độc lập)
- `/graduationRounds/{roundId}/submissions/{submissionId}` (Từng lượt nộp bài của sinh viên)
- `/graduationRounds/{roundId}/auditLogs/{logId}` (Nhật ký bất biến append-only)
- `/graduationRounds/{roundId}/snapshots/ranking` (Bản chụp kết quả đợt đóng băng)

---

### 16. KẾ HOẠCH CHUYỂN ĐỔI AN TOÀN (MIGRATION PLAN THEO 5 PHA)

- **Pha A (v2.3.0 - Hiện tại)**: Giữ nguyên vẹn mô hình dữ liệu để không phá vỡ Production. Hoàn thiện tài liệu kiến trúc.
- **Pha B (Dual-Read / New-Write)**: Ghi đồng thời sang subcollection mới và giữ fallback ở document cũ.
- **Pha C (Data Backfill Tool)**: Chạy script di chuyển dữ liệu cũ sang subcollection mới.
- **Pha D (Switch Source of Truth)**: Đổi sang subcollection làm nguồn thẩm quyền duy nhất.
- **Pha E (Cleanup Legacy Data)**: Xóa các trường nested cồng kềnh trong document đợt cũ sau 1 học kỳ chạy ổn định.

---

### 17. PHÂN CẤP MỨC ĐỘ NGHIÊM TRỌNG & ƯU TIÊN KHẮC PHỤC

#### Phân loại theo Mức độ Nghiêm trọng:
1. **CRITICAL**:
   - `CRIT-01`: Nguy cơ tài liệu `graduationRounds/{roundId}` vượt ngưỡng 1 MiB khi quy mô đạt trên 70–100 sinh viên do nhúng toàn bộ `councilScores`, `submissions` và `auditLogs`.
   - `CRIT-02`: Thiếu Firestore Rules cho phép thành viên hội đồng (non-admin staff) ghi điểm vào subcollection một cách an toàn mà không cần cấp quyền Admin trên toàn bộ đợt.
2. **HIGH**:
   - `HIGH-01`: Thiếu atomic transaction cho quy tắc First-Completed-Wins (Điểm GVHD và Thuyết minh HD).
   - `HIGH-02`: Submission concurrency khi sinh viên mở nhiều tab nộp bài cùng lúc.
   - `HIGH-03`: `auditLogs` chưa có tính bất biến ở cấp độ cơ sở dữ liệu.
3. **MEDIUM**:
   - `MED-01`: Dual-source của `activities` (mảng trong round doc vs subcollection) tiềm ẩn nguy cơ lệch dữ liệu.
   - `MED-02`: Tải dữ liệu toàn bộ sinh viên trong một bảng tính có thể chậm khi quy mô đạt trên 500 sinh viên.
4. **LOW**:
   - `LOW-01`: Cần làm sạch các console log debug không cần thiết trước khi bàn giao chính thức.

#### Phân loại theo Thứ tự Ưu tiên:
- **MUST FIX BEFORE REAL DATA (Bắt buộc sửa trước khi vận hành dữ liệu thật)**:
  1. Tách `councilScores` và `activitySubmissions` sang subcollection để triệt tiêu nguy cơ chạm trần 1 MiB.
  2. Bổ sung bộ Firestore Rules tương ứng cho các subcollection này.
- **SHOULD FIX BEFORE FIRST OFFICIAL ROUND (Nên sửa trước đợt tốt nghiệp chính thức)**:
  1. Áp dụng `runTransaction` cho việc nhập điểm GVHD và số lần nộp bài của sinh viên.
  2. Tách `auditLogs` sang collection append-only.
- **CAN FIX LATER (Có thể hoàn thiện sau)**:
  1. Dọn dẹp hoàn toàn mảng `activities` cũ trong round doc (Pha E).
  2. Tích hợp Trusted Backend Service cho Google Drive Resumable Upload.

---
*Báo cáo được lập bởi Antigravity Pair-Programming Agent theo tiêu chuẩn SAFE DEVELOPMENT MODE.*