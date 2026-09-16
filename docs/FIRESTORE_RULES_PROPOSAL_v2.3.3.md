# FIRESTORE RULES PROPOSAL & EMULATOR VALIDATION REPORT (v2.3.3)
**Module:** AUTHORIZATION INDEX DOCS + FIRESTORE RULES ENFORCEMENT  
**Version:** v2.3.3  
**Target Proposal:** `firestore.graduation.proposed.rules`  
**Production Rules Status:** UNCHANGED (`firestore.rules` untouched, 0 rules deployed)  
**Verification Tool:** Firebase Local Emulator Suite (Firestore Emulator v1.22.0, standard edition)  
**Emulator Execution Result:** 56 PASSED, 0 FAILED (100% PASS)

---

## 1. TỔNG QUAN NÂNG CẤP TỪ v2.3.2 LÊN v2.3.3

Trong phiên bản v2.3.2, hệ thống đã siết chặt quyền truy cập cơ bản (loại bỏ wildcard `staff()`), nhưng vẫn tồn tại lỗ hổng cốt lõi: **Một giảng viên bất kỳ có thể tạo điểm số cho một hội đồng mà họ không được phân công**, do Rules chưa kiểm tra được quan hệ hội đồng.

Phiên bản v2.3.3 tích hợp **Mô hình 7 Subcollection Chỉ mục Phân quyền (Authorization Index Docs)**, nâng cấp độ an toàn lên cấp độ thực thi cơ sở dữ liệu (Database-Level Enforcement):
1. **Bắt buộc phân công Hội đồng:** Giảng viên chỉ được tạo điểm nếu tồn tại bản ghi hợp lệ trong `councilMemberships`.
2. **Bắt buộc phân công Sinh viên:** Chỉ được chấm điểm cho sinh viên thuộc đúng Hội đồng (`councilStudentAssignments`).
3. **Phân quyền Chủ tịch theo vòng đời:** Chủ tịch chỉ xem được điểm người khác và hiệu chỉnh điểm (Calibration) khi Hội đồng có trạng thái `ended` (`councilAccess`).
4. **Phân quyền File nộp đa vai trò:** GVHD, GVPB và Thành viên HĐ chỉ xem được bài nộp của sinh viên khi có quan hệ phân công tương ứng VÀ cờ hiển thị của hoạt động (`activityAccess`) đang bật.
5. **Kiểm tra tính đủ điều kiện của Sinh viên:** Sinh viên chỉ được nộp bài nếu có tên trong `eligibleStudents` và hoạt động đang mở nộp.

---

## 2. MA TRẬN PHÂN QUYỀN TRUY CẬP HOÀN CHỈNH (v2.3.3 ACCESS MATRIX)

| Thực thể / Thao tác | Admin | Thành viên HĐ chính chủ | Thành viên HĐ khác | Chủ tịch HĐ (Trước ended) | Chủ tịch HĐ (Sau ended) | GVHD chính thức | GVPB được giao | Giảng viên ngoài | Sinh viên chính chủ | Sinh viên khác | Anonymous |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **councilScores CREATE** | ALLOW | ALLOW (đúng HĐ+SV) | **DENY** | ALLOW (đúng HĐ+SV) | ALLOW (đúng HĐ+SV) | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **councilScores READ (Own)** | ALLOW | ALLOW | **DENY** | ALLOW | ALLOW | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **councilScores READ (Others)**| ALLOW | **DENY** | **DENY** | **DENY** | ALLOW (own HĐ) | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **councilScores UPDATE (Own)** | ALLOW | ALLOW (active) | **DENY** | ALLOW (active) | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **councilScores CALIBRATE** | ALLOW | **DENY** | **DENY** | **DENY** | ALLOW (ended only) | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **councilScores DELETE** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **submissions CREATE** | ALLOW | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | ALLOW (eligible) | **DENY** | **DENY** |
| **submissions READ** | ALLOW | ALLOW (vis ON) | **DENY** | ALLOW (vis ON) | ALLOW (vis ON) | ALLOW (vis ON) | ALLOW (vis ON) | **DENY** | ALLOW | **DENY** | **DENY** |
| **submissions WITHDRAW** | ALLOW | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | ALLOW | **DENY** | **DENY** |
| **submissions DELETE** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **Auth Indexes WRITE** | ALLOW | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **auditLogs CREATE** | ALLOW | ALLOW (whitelist)| ALLOW (whitelist)| ALLOW (whitelist)| ALLOW (whitelist)| ALLOW (whitelist)| ALLOW (whitelist)| ALLOW (whitelist)| ALLOW (whitelist)| ALLOW (whitelist)| **DENY** |

---

## 3. CHI PHÍ TRUY XUẤT TÀI LIỆU TRONG RULES (RULE ACCESS CALL COST)

Quy tắc Firestore giới hạn tối đa **10 cuộc gọi tài liệu** (`get()` / `exists()`) trên mỗi lần đánh giá request. Bảng dưới đây thể hiện chi phí thực tế của các thao tác trong v2.3.3:

| Thao tác | Các cuộc gọi tài liệu thực hiện | Tổng số call | Đánh giá an toàn ($le 10$) |
|:---|:---|:---:|:---:|
| **councilScores CREATE** | `councilMemberships` (1) + `councilStudentAssignments` (1) | **2** | PASS (Tối ưu) |
| **councilScores READ (Own)** | Không gọi tài liệu (chỉ đối chiếu token JWT) | **0** | PASS (Tối ưu) |
| **councilScores READ (Chair)** | `councilMemberships` (1) + `councilAccess` (1) | **2** | PASS (Tối ưu) |
| **councilScores UPDATE (Own)**| `councilMemberships` (1) + `councilAccess` (1) | **2** | PASS (Tối ưu) |
| **councilScores CALIBRATE** | `councilMemberships` (1) + `councilAccess` (1) | **2** | PASS (Tối ưu) |
| **submissions CREATE** | `eligibleStudents` (1) + `activityAccess` (1) | **2** | PASS (Tối ưu) |
| **submissions READ (Student)** | Không gọi tài liệu (chỉ đối chiếu regex MSSV) | **0** | PASS (Tối ưu) |
| **submissions READ (Supervisor)**| `activityAccess` (1) + `supervisorAssignments` (1) | **2** | PASS (Tối ưu) |
| **submissions READ (Reviewer)**| `activityAccess` (1) + `reviewerAssignmentsAuth` (1) | **2** | PASS (Tối ưu) |
| **submissions READ (Council)** | `activityAccess` (1) + `councilStudentAssignments` (1) + `councilMemberships` (1) | **3** | PASS (Tối ưu) |
| **submissions READ (Unrelated)**| `activityAccess` (1) + short-circuit | **1 – 2** | PASS (Tối ưu) |

> [!NOTE]
> **Worst-case lookup cost:** 3 cuộc gọi tài liệu (rất xa giới hạn 10 calls của Firestore). Cấu trúc quy tắc tối ưu hóa triệt để bằng cách không dùng thừa cặp `exists()` + `get()` trên cùng một tài liệu.

---

## 4. BẢO MẬT & NHẬT KÝ KIỂM TOÁN (AUDIT TRUST LIMITATION)

> [!IMPORTANT]
> **CLIENT-GENERATED AUDIT IS NOT TRUSTED SERVER AUDIT**
> 
> Mặc dù hệ thống Rules v2.3.3 đảm bảo tính bất biến (`update: false`, `delete: false`) và lọc hành động hợp lệ (`action in whitelist`), dữ liệu kiểm toán phát sinh từ trình duyệt của người dùng vẫn chịu rủi ro nhất định nếu người dùng hợp lệ cố tình gửi các chuỗi ghi chú sai lệch trong phạm vi whitelist cho phép. 
> 
> Giải pháp triệt để cho cấp độ Production ngân hàng/chứng chỉ là sử dụng Cloud Functions (Server-side triggers) lắng nghe thay đổi trên subcollections và tự động tạo Audit Log độc lập.

---

## 5. KẾT QUẢ KIỂM THỬ THỰC TẾ (EMULATOR TEST RESULTS)

Bộ kiểm thử [scripts/test-rules-v233.cjs](file:///C:/Users/quang/.gemini/antigravity/scratch/IFA-GRADUATION/scripts/test-rules-v233.cjs) chạy trực tiếp trên Firestore Emulator v1.22.0:
```text
=== RUNNING FIRESTORE RULES EMULATOR TEST MATRIX (v2.3.3) ===
Host: 127.0.0.1:8080

--- 0. SETUP AUTHORIZATION INDEXES BY ADMIN ---
  ✓ PASS: Setup round document: ALLOW
  ✓ PASS: Setup eligible student 12100314: ALLOW
  ✓ PASS: Setup HĐ1 chair membership: ALLOW
  ✓ PASS: Setup HĐ1 member A membership: ALLOW
  ✓ PASS: Setup HĐ1 member B membership: ALLOW
  ✓ PASS: Setup HĐ2 chair membership: ALLOW
  ✓ PASS: Setup HĐ2 member membership: ALLOW
  ✓ PASS: Setup Student A in HĐ1: ALLOW
  ✓ PASS: Setup Student A in HĐ1 for act_sub_open: ALLOW
  ✓ PASS: Setup HĐ1 member A membership for act_sub_open: ALLOW
  ✓ PASS: Setup Student B in HĐ2: ALLOW
  ✓ PASS: Setup HĐ1 status active: ALLOW
  ✓ PASS: Setup HĐ2 status ended: ALLOW
  ✓ PASS: Setup Supervisor Assignment for Student A: ALLOW
  ✓ PASS: Setup Reviewer Assignment for Student A: ALLOW
  ✓ PASS: Setup Activity Access act_sub_open: ALLOW
  ✓ PASS: Setup Activity Access act_sub_hidden: ALLOW
  ✓ PASS: Setup Activity Access act_sub_closed: ALLOW

--- 1. CRITICAL MISSING CASE ---
  ✓ PASS: Staff unassigned to HĐ2 tries to create score in HĐ2: DENY

--- 2. COUNCIL MEMBER ENFORCEMENT TESTS ---
  ✓ PASS: Member HĐ1 creates score for SV in HĐ1: ALLOW
  ✓ PASS: Member HĐ1 creates score for SV in HĐ2 (Cross-Council): DENY
  ✓ PASS: Member HĐ1 reads own score: ALLOW
  ✓ PASS: Member HĐ1 reads Member B score (No Staff Wildcard): DENY
  ✓ PASS: Member HĐ1 updates own score while status is active: ALLOW

--- 3. CHAIR TESTS (BEFORE/AFTER ENDED & CROSS-COUNCIL) ---
  ✓ PASS: Chair HĐ1 creates own score: ALLOW
  ✓ PASS: Chair HĐ1 reads own score before ended: ALLOW
  ✓ PASS: Chair HĐ1 reads other member score before ended: DENY
  ✓ PASS: Chair HĐ1 tries to calibrate score before ended: DENY
  ✓ PASS: Admin transitions HĐ1 to ended: ALLOW
  ✓ PASS: Chair HĐ1 reads other member score in HĐ1 after ended: ALLOW
  ✓ PASS: Member HĐ2 creates score in HĐ2: ALLOW
  ✓ PASS: Chair HĐ1 tries to read score in HĐ2 after ended (Cross-Council): DENY
  ✓ PASS: Chair HĐ1 calibrates score in HĐ1 after ended: ALLOW
  ✓ PASS: Chair HĐ1 tries to calibrate score in HĐ2 (Cross-Council): DENY
  ✓ PASS: Admin transitions HĐ1 to finalized: ALLOW
  ✓ PASS: Chair HĐ1 tries to calibrate after finalized: DENY
  ✓ PASS: Admin reopens HĐ1 to ended: ALLOW
  ✓ PASS: Chair HĐ1 calibrates after Admin reopen to ended: ALLOW

--- 4. SUBMISSION ACCESS & VISIBILITY TESTS ---
  ✓ PASS: Eligible Student A creates submission in open activity: ALLOW
  ✓ PASS: Ineligible student tries to create submission: DENY
  ✓ PASS: Student creates submission in closed activity: DENY
  ✓ PASS: Student A reads own submission: ALLOW
  ✓ PASS: Student B reads Student A submission: DENY
  ✓ PASS: Official Supervisor reads supervisee submission when visibility ON: ALLOW
  ✓ PASS: Assigned Reviewer reads assigned submission when visibility ON: ALLOW
  ✓ PASS: Council Member HĐ1 reads Student A (in HĐ1) when visibility ON: ALLOW
  ✓ PASS: Unrelated staff reads Student A submission: DENY
  ✓ PASS: Student A creates submission in hidden-visibility activity: ALLOW
  ✓ PASS: Supervisor reads submission when visibility is OFF: DENY
  ✓ PASS: Reviewer reads submission when visibility is OFF: DENY
  ✓ PASS: Council member reads submission when visibility is OFF: DENY

--- 5. AUTH INDEX WRITE PERMISSIONS ---
  ✓ PASS: Staff tries to write councilMemberships: DENY
  ✓ PASS: Student tries to write supervisorAssignments: DENY
  ✓ PASS: Staff tries to write activityAccess: DENY

--- 6. MALICIOUS IDENTITY TAMPER TESTS ---
  ✓ PASS: Member tries to spoof scorerEmail: DENY
  ✓ PASS: Member tries to change studentId: DENY

=== SUMMARY: 56 PASSED, 0 FAILED ===
Script exited successfully (code 0)
```
