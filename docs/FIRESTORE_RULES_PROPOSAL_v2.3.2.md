# FIRESTORE RULES HARDENING & EMULATOR VALIDATION REPORT (v2.3.2)
**Module:** FIRESTORE RULES HARDENING + EMULATOR VALIDATION  
**Version:** v2.3.2  
**Target Proposal:** `firestore.graduation.proposed.rules`  
**Production Rules Status:** UNCHANGED (`firestore.rules` untouched, 0 rules deployed)  
**Verification Tool:** Firebase Local Emulator Suite (Firestore Emulator v1.22.0, standard edition)  
**Emulator Execution Result:** 32 PASSED, 0 FAILED (100% PASS)

---

## 1. MÔ HÌNH BẢO MẬT (SECURITY MODEL)

Phiên bản v2.3.2 siết chặt toàn bộ quyền truy cập Firestore Security Rules theo nguyên tắc **Least Privilege** (Đặc quyền tối thiểu), loại bỏ hoàn toàn các quyền "Wildcard" mở rộng cho Staff trong đề xuất v2.3.1.

### 1.1 Nguyên tắc cốt lõi:
1. **No Staff Wildcard Read:** Tuyệt đối không cho phép bất kỳ Giảng viên nào đọc toàn bộ điểm chấm của mọi hội đồng hoặc toàn bộ bài nộp của mọi sinh viên.
2. **Strict Identity Enforcement:** Mọi thao tác tạo/cập nhật tài liệu phải đối chiếu định danh người gọi (`request.auth.token.email`) với các trường định danh trong tài liệu.
3. **Immutable Identity Fields:** Các trường `scorerEmail`, `scorerId`, `studentId`, `activityId`, `councilId`, `roundId` là bất biến sau khi tạo. Không một người dùng nào (kể cả Admin) được thay đổi các trường định danh này khi cập nhật.
4. **Append-Only / Non-Destructive Subcollections:**
   - `auditLogs`: `allow update: if false;`, `allow delete: if false;`.
   - `councilScores`: `allow delete: if false;` (vô hiệu hóa/thu hồi qua cờ `status: 'voided'` thay vì xóa vật lý).
   - `submissions`: `allow delete: if false;` (bảo toàn lịch sử nộp bài vĩnh viễn).
5. **Role Whitelisting for Audit Creation:** Không cho phép client gửi audit log với nội dung tùy ý. Client chỉ được tạo các hành động nằm trong whitelist hợp lệ theo vai trò.

---

## 2. MA TRẬN PHÂN QUYỀN TRUY CẬP (ACCESS MATRIX)

| Thực thể / Subcollection | Thao tác | Admin | Scorer chính chủ | Thành viên HĐ khác | Chủ tịch HĐ (Chair) | Sinh viên chính chủ | Sinh viên khác | Anonymous |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **councilScores** | Read | ALLOW | ALLOW | DENY | DENY* | DENY | DENY | DENY |
| | Create | ALLOW | ALLOW (khớp ID) | DENY | DENY (nếu không khớp) | DENY | DENY | DENY |
| | Update | ALLOW (giữ ID) | ALLOW (giữ ID) | DENY | DENY** | DENY | DENY | DENY |
| | Delete | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **submissions** | Read | ALLOW | DENY*** | DENY*** | DENY*** | ALLOW (own MSSV) | DENY | DENY |
| | Create | ALLOW | DENY | DENY | DENY | ALLOW (own MSSV) | DENY | DENY |
| | Update (Withdraw) | ALLOW | DENY | DENY | DENY | ALLOW (status only) | DENY | DENY |
| | Delete | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| **auditLogs** | Read | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY |
| | Create | ALLOW | ALLOW (whitelist) | ALLOW (whitelist) | ALLOW (whitelist) | ALLOW (whitelist) | ALLOW (whitelist) | DENY |
| | Update | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |
| | Delete | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** |

- (*) *Chair Read:* Trong cấu trúc hiện tại, phân công Chủ tịch HĐ nằm lồng ghép (nested) trong round document. Firestore Rules không hỗ trợ dynamic key indexing (`map[key]`), do đó Rules chặn toàn bộ Staff đọc điểm của nhau. Chair chỉ xem điểm tổng hợp qua Admin workflow hoặc cần Authorization Index Docs.
- (**) *Chair Calibration:* Bị chặn tại Rules để chống nguy cơ Chủ tịch Hội đồng A sửa điểm của Hội đồng B. Calibration hiện tại yêu cầu Admin workflow.
- (***) *Staff Submission Access:* Chặn wildcard read đối với Staff. Quyền xem bài của GVHD/GVPB/HĐ cần Authorization Index Docs hoặc Trusted Backend.

---

## 3. GIỚI HẠN KIẾN TRÚC & QUAN HỆ CHƯA THỂ ENFORCE (SCHEMA LIMITATIONS)

### 3.1 Vì sao Firestore Rules không thể xác minh phân công lồng ghép (Nested Assignments)?
Tài liệu `graduationRounds/{roundId}` lưu trữ phân công theo cấu trúc:
```javascript
{
  activities: {
    [activityId]: {
      councils: {
        [councilId]: {
          chairEmail: "chair@tdtu.edu.vn",
          members: ["mem1@tdtu.edu.vn", "mem2@tdtu.edu.vn"],
          students: ["12100314", "12100999"]
        }
      }
    }
  },
  supervisorAssignments: {
    [studentId]: { supervisorEmail: "gvhd@tdtu.edu.vn" }
  },
  reviewerAssignments: {
    [studentId]: { reviewerEmail: "gvpb@tdtu.edu.vn" }
  }
}
```

Trong Firestore Security Rules ngôn ngữ Common Expression Language (CEL):
- **Không hỗ trợ Dynamic Map Indexing:** Biểu thức `get(...).data.activities[resource.data.activityId]` sẽ gây lỗi cú pháp/runtime vì Rules không cho phép dùng biến để truy xuất key của Map.
- **Không có vòng lặp hoặc hàm lọc mảng phức tạp:** Rules không thể duyệt qua các danh sách lồng nhau để kiểm tra xem một email có nằm trong `members` của `councilId` hay không.

### 3.2 Hậu quả an ninh nếu không có Authorization Index Docs:
- Nếu muốn cho Chair xem điểm cả hội đồng mà không có index doc, buộc phải viết `allow read: if staff();` $ightarrow$ **LỖ HỔNG: Giảng viên bất kỳ xem được điểm của mọi hội đồng.**
- Do đó, v2.3.2 tuân thủ triệt để: **Thà chặn ở Rules và ghi nhận giới hạn còn hơn mở wildcard không an toàn.**

---

## 4. ĐỀ XUẤT TÀI LIỆU CHỈ MỤC PHÂN QUYỀN TỐI THIỂU (AUTHORIZATION INDEX DOCS PROPOSAL)

Để Firestore Security Rules có thể tự động thực thi (DB-Enforce) các quan hệ phân quyền mà không phụ thuộc vào App Guard, cần bổ sung 3 subcollection chỉ mục sau (đề xuất kiến trúc cho phiên bản tương lai, KHÔNG tự động migrate lúc này):

### 4.1 `/graduationRounds/{roundId}/councilMemberships/{membershipId}`
- **ID quy ước:** `{councilId}_{memberEmail}`
- **Cấu trúc document:**
  ```json
  {
    "roundId": "round_01",
    "activityId": "act_defense",
    "councilId": "council_01",
    "email": "chair@tdtu.edu.vn",
    "role": "chair",
    "studentIds": ["12100314", "12100999"]
  }
  ```
- **Quy tắc Rules có thể áp dụng:**
  ```firestore
  function isCouncilChair(roundId, councilId) {
    return exists(/databases/$(database)/documents/graduationRounds/$(roundId)/councilMemberships/$(councilId + '_' + email()))
      && get(/databases/$(database)/documents/graduationRounds/$(roundId)/councilMemberships/$(councilId + '_' + email())).data.role == 'chair';
  }
  ```

### 4.2 `/graduationRounds/{roundId}/supervisorAssignments/{studentId}`
- **ID quy ước:** `{studentId}`
- **Cấu trúc document:**
  ```json
  {
    "studentId": "12100314",
    "supervisorEmails": ["gvhd1@tdtu.edu.vn"]
  }
  ```
- **Quy tắc Rules có thể áp dụng:**
  ```firestore
  function isSupervisor(roundId, studentId) {
    return exists(/databases/$(database)/documents/graduationRounds/$(roundId)/supervisorAssignments/$(studentId))
      && email() in get(/databases/$(database)/documents/graduationRounds/$(roundId)/supervisorAssignments/$(studentId)).data.supervisorEmails;
  }
  ```

### 4.3 `/graduationRounds/{roundId}/reviewerAssignments/{studentId}`
- **Tương tự supervisorAssignments**, cho phép GVPB đọc file nộp của đúng sinh viên được giao.

---

## 5. KẾT QUẢ KIỂM THỬ TRÊN FIREBASE LOCAL EMULATOR SUITE

Bộ kiểm thử tự động gồm 32 bài kiểm tra độc lập đã được thực thi trên môi trường Firestore Emulator chính thức:

```text
=== RUNNING FIRESTORE RULES EMULATOR TEST MATRIX (v2.3.2) ===
Host: 127.0.0.1:8080

--- 1. ADMIN TESTS ---
  ✓ PASS: Admin creates round document: ALLOW
  ✓ PASS: Admin creates councilScore: ALLOW
  ✓ PASS: Admin reads all councilScores: ALLOW
  ✓ PASS: Admin creates submission: ALLOW
  ✓ PASS: Admin reads all submissions: ALLOW
  ✓ PASS: Admin appends audit log: ALLOW

--- 2. COUNCIL MEMBER TESTS ---
  ✓ PASS: Member creates own score: ALLOW
  ✓ PASS: Member creates score with spoofed scorerEmail: DENY
  ✓ PASS: Member reads own score: ALLOW
  ✓ PASS: Other staff reads member score (No Staff Wildcard): DENY
  ✓ PASS: Student reads internal council score: DENY
  ✓ PASS: Member updates own score preserving identity: ALLOW
  ✓ PASS: Delete council score: DENY

--- 3. CHAIR & CALIBRATION TESTS ---
  ✓ PASS: Chair tries to read member score before ended (Staff Wildcard blocked): DENY
  ✓ PASS: Chair tries to calibrate/update other member score directly without Admin: DENY

--- 4. STUDENT SUBMISSION TESTS ---
  ✓ PASS: Student A creates own submission: ALLOW
  ✓ PASS: Student A creates submission for Student B: DENY
  ✓ PASS: Student A reads own submission: ALLOW
  ✓ PASS: Student B reads Student A submission: DENY
  ✓ PASS: Staff wildcard reads student submission: DENY
  ✓ PASS: Student A attempts to delete submission: DENY

--- 5. AUDIT LOG TESTS ---
  ✓ PASS: Anonymous creates audit: DENY
  ✓ PASS: Student attempts arbitrary admin action: DENY
  ✓ PASS: Student creates valid submission audit: ALLOW
  ✓ PASS: Staff attempts arbitrary admin action: DENY
  ✓ PASS: Staff creates valid scoring audit: ALLOW
  ✓ PASS: Delete audit log: DENY
  ✓ PASS: Student reads audit log: DENY
  ✓ PASS: Staff reads audit log: DENY

--- 6. MALICIOUS IDENTITY TAMPER TESTS ---
  ✓ PASS: Malicious change scorerEmail in score update: DENY
  ✓ PASS: Malicious change studentId in score update: DENY
  ✓ PASS: Malicious change councilId in score update: DENY

=== SUMMARY: 32 PASSED, 0 FAILED ===
```

---

## 6. CHI PHÍ TRUY CẬP TÀI LIỆU TRONG RULES (RULE ACCESS COST)

- `councilScores` create/update/read: **0 document lookups** (chỉ đánh giá token JWT và request payload).
- `submissions` create/read/update: **0 document lookups** (regex so khớp studentId với email).
- `auditLogs` create: **0 document lookups** (kiểm tra token role và whitelist action).
- `admin()` evaluation: **0 lookups** cho Owner (`tranquanghai@tdtu.edu.vn`), **1 lookup** (`exists(/admins/{email})`) cho Admin thông thường.
- **Tổng kết:** Toàn bộ các rule đề xuất cho subcollection đều đạt mức chi phí tối ưu (0-1 lookup), nằm sâu dưới giới hạn 10 calls của Firestore.

---

## 7. BẢO MẬT & NHẬT KÝ KIỂM TOÁN TỪ PHÍA CLIENT (AUDIT DISCLAIMER)

> [!IMPORTANT]
> **CLIENT-GENERATED AUDIT = TAMPER-RESISTANT LIMITED, NOT TRUSTED SERVER AUDIT**
> 
> Mặc dù Firestore Security Rules trong v2.3.2 đã ràng buộc người tạo (`by == email()`) và chỉ cho phép các hành động nằm trong danh sách trắng (`whitelist action`), việc ghi nhật ký kiểm toán khởi tạo từ trình duyệt Web (Static Single Page App) không thể thay thế hoàn toàn Trusted Server Audit (Cloud Functions / Backend Service).
> 
> Các nhật ký kiểm toán cốt lõi đã được bảo vệ chống sửa đổi (`update: if false`) và chống xóa (`delete: if false`), đảm bảo tính toàn vẹn (Append-Only) khi đã được ghi vào hệ thống.
