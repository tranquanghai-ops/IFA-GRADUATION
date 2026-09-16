# AUTHORIZATION INDEX ARCHITECTURE (v2.3.3)
**Module:** AUTHORIZATION INDEX DOCS + FIRESTORE RULES ENFORCEMENT  
**Version:** v2.3.3  
**Status:** PROPOSED & EMULATOR VERIFIED (Production Untouched)

---

## 1. MỤC ĐÍCH & NGUYÊN TẮC THIẾT KẾ

Trong phiên bản v2.3.2, Firestore Rules chỉ kiểm tra được vai trò tổng quát (`staff()`) và tính chính chủ cơ bản (`scorerEmail == email()`), nhưng **chưa thể chứng minh người chấm có thực sự được phân công vào Hội đồng đó hay không**, hoặc có phải là GVHD/GVPB chính thức của sinh viên hay không. Nguyên nhân là do dữ liệu phân công nằm lồng ghép (nested) trong document cha `graduationRounds/{roundId}`, vượt quá khả năng tra cứu của ngôn ngữ Firestore CEL.

Để giải quyết triệt để lỗ hổng này mà **không sao chép dữ liệu nghiệp vụ** và **không phá vỡ Single Source of Truth**, phiên bản v2.3.3 giới thiệu **Mô hình Tài liệu Chỉ mục Phân quyền (Authorization Index Docs)**.

### Nguyên tắc cốt lõi:
1. **Lightweight & Projection-Only:** Không lưu điểm số, không lưu bí mật, không phải là nơi lưu trữ nghiệp vụ chính. Chỉ là hình chiếu (projection) tối thiểu phục vụ kiểm tra quyền trong Rules.
2. **Deterministic Document IDs:** Mọi ID tài liệu đều được tính toán theo công thức tiền định, cho phép Rules thực hiện tra cứu trực tiếp qua `get()` hoặc `exists()` với độ phức tạp $O(1)$.
3. **Admin-Controlled Writes:** Toàn bộ các subcollection chỉ mục đều quy định `allow write: if admin();`. Người dùng thông thường (Staff/Student) tuyệt đối không được tự thêm quyền cho mình.
4. **Low Lookup Cost:** Giữ tổng số lần gọi `get()` / `exists()` trên mỗi request đọc/ghi luôn $le 5$, sâu dưới ngưỡng giới hạn 10 calls của Firestore.

---

## 2. DANH MỤC 7 SUBCOLLECTION CHỈ MỤC PHÂN QUYỀN

### 2.1 `/graduationRounds/{roundId}/councilMemberships/{membershipId}`
- **Mục đích:** Xác minh một Giảng viên có phải là thành viên/Chủ tịch chính thức của Hội đồng hay không.
- **Quy tắc ID:** `{activityId}_{councilId}_{memberEmail}` (ví dụ: `act_def_hd1_gv_chair1@tdtu.edu.vn`)
- **Schema:**
  ```json
  {
    "roundId": "round_01",
    "activityId": "act_def",
    "councilId": "hd1",
    "memberEmail": "gv_chair1@tdtu.edu.vn",
    "memberId": "gv_chair1",
    "role": "chair", // "chair" | "member" | "secretary" | "guestAuthenticated"
    "slotKey": "chair_slot",
    "active": true,
    "createdAt": "2026-09-16T08:00:00.000Z",
    "updatedAt": "2026-09-16T08:00:00.000Z"
  }
  ```

### 2.2 `/graduationRounds/{roundId}/councilStudentAssignments/{assignmentId}`
- **Mục đích:** Xác minh một Sinh viên thuộc về Hội đồng nào trong một hoạt động cụ thể. Chống gian lận chấm điểm chéo hội đồng.
- **Quy tắc ID:** `{activityId}_{studentId}` (ví dụ: `act_def_12100314`)
- **Schema:**
  ```json
  {
    "roundId": "round_01",
    "activityId": "act_def",
    "councilId": "hd1",
    "studentId": "12100314",
    "active": true,
    "updatedAt": "2026-09-16T08:00:00.000Z"
  }
  ```

### 2.3 `/graduationRounds/{roundId}/councilAccess/{councilAccessId}`
- **Mục đích:** Cung cấp trạng thái vòng đời của Hội đồng để Rules kiểm soát quyền chấm điểm và quyền hiệu chỉnh (Calibration) của Chủ tịch.
- **Quy tắc ID:** `{activityId}_{councilId}` (ví dụ: `act_def_hd1`)
- **Schema:**
  ```json
  {
    "roundId": "round_01",
    "activityId": "act_def",
    "councilId": "hd1",
    "status": "active", // "preparing" | "active" | "ended" | "finalized"
    "updatedAt": "2026-09-16T08:00:00.000Z"
  }
  ```

### 2.4 `/graduationRounds/{roundId}/supervisorAssignments/{studentId}`
- **Mục đích:** Xác định danh sách email các GVHD (chính + hỗ trợ) được quyền xem bài nộp và chấm điểm GVHD/TM HD.
- **Quy tắc ID:** `{studentId}` (ví dụ: `12100314`)
- **Schema:**
  ```json
  {
    "studentId": "12100314",
    "supervisorEmails": ["gv_hd1@tdtu.edu.vn", "gv_hd2@tdtu.edu.vn"],
    "updatedAt": "2026-09-16T08:00:00.000Z"
  }
  ```

### 2.5 `/graduationRounds/{roundId}/reviewerAssignmentsAuth/{studentId}`
- **Mục đích:** Xác định GVPB được phân công cho sinh viên để mở quyền xem bài nộp và chấm điểm TM PB.
- **Quy tắc ID:** `{studentId}` (ví dụ: `12100314`)
- **Schema:**
  ```json
  {
    "studentId": "12100314",
    "reviewerEmail": "gv_pb@tdtu.edu.vn",
    "active": true,
    "updatedAt": "2026-09-16T08:00:00.000Z"
  }
  ```

### 2.6 `/graduationRounds/{roundId}/preliminaryScorers/{scorerEmail}`
- **Mục đích:** Danh sách giảng viên được phân công chấm sơ khảo trong đợt tốt nghiệp.
- **Quy tắc ID:** `{scorerEmail}` (ví dụ: `gv_sk@tdtu.edu.vn`)
- **Schema:**
  ```json
  {
    "email": "gv_sk@tdtu.edu.vn",
    "active": true,
    "updatedAt": "2026-09-16T08:00:00.000Z"
  }
  ```

### 2.7 `/graduationRounds/{roundId}/activityAccess/{activityId}`
- **Mục đích:** Cung cấp cờ cấu hình bật/tắt nộp bài và phân quyền hiển thị file nộp cho các vai trò (GVHD, GVPB, Hội đồng).
- **Quy tắc ID:** `{activityId}` (ví dụ: `act_sub_open`)
- **Schema:**
  ```json
  {
    "activityId": "act_sub_open",
    "submissionEnabled": true,
    "supervisorCanView": true,
    "reviewerCanView": true,
    "councilCanView": true,
    "scoringEnabled": true,
    "updatedAt": "2026-09-16T08:00:00.000Z"
  }
  ```

---

## 3. CHIẾN LƯỢC ĐỒNG BỘ (INDEX SYNC STRATEGY) & PHÒNG CHỐNG DUAL-WRITE RISK

### 3.1 Rủi ro phân mảnh (Stale Index Risk):
Khi dữ liệu phân công nghiệp vụ trong `graduationRounds/{roundId}` thay đổi (Admin thêm/xóa thành viên hội đồng, chuyển sinh viên, đổi GVHD/GVPB), nếu thao tác ghi dữ liệu nghiệp vụ thành công nhưng ghi chỉ mục thất bại (hoặc ngược lại), hệ thống sẽ rơi vào trạng thái lệch pha (Desynchronization):
- Giảng viên đã bị xóa khỏi hội đồng trên giao diện nhưng Rules vẫn cho phép chấm điểm (nếu chỉ mục chưa xóa).
- Giảng viên đã được thêm trên giao diện nhưng Rules chặn không cho chấm (nếu chỉ mục chưa tạo).

### 3.2 Giải pháp khắc phục: Atomic `writeBatch()`
Để đảm bảo tính nhất quán tuyệt đối trong ứng dụng Single Page App (Client-side Firestore SDK):
Mọi thao tác thay đổi phân công từ phía Admin **phải thực hiện trong cùng một `writeBatch`**:
```javascript
const batch = writeBatch(db);

// 1. Cập nhật cấu trúc nghiệp vụ (round document)
batch.update(roundRef, {
  [`activities.${actId}.councils.${cId}.members`]: updatedMembers,
  updatedAt: serverTimestamp()
});

// 2. Cập nhật Authorization Index tương ứng trong cùng batch
const memberIndexRef = doc(db, 'graduationRounds', roundId, 'councilMemberships', membershipId);
batch.set(memberIndexRef, {
  roundId, activityId: actId, councilId: cId,
  memberEmail: newMemberEmail, role: 'member', active: true,
  updatedAt: new Date().toISOString()
});

await batch.commit();
```

### 3.3 Công cụ Tái đồng bộ Định kỳ (Rebuild Tool):
Đã xây dựng script kiểm toán và tái tạo chỉ mục:
`scripts/rebuild-graduation-auth-indexes.cjs`
- Mặc định chạy ở chế độ an toàn `DRY_RUN=true`.
- Quét toàn bộ cây phân công nghiệp vụ hiện hữu và báo cáo số lượng tài liệu cần tạo/cập nhật/vô hiệu hóa.
- Sẵn sàng kích hoạt tái tạo khi có sự phê duyệt từ Quản trị viên.
