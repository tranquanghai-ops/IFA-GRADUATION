# ĐỀ XUẤT NÂNG CẤP FIRESTORE SECURITY RULES
## IFA+ GRADUATION BETA — v2.3.1 (PHASE B MIGRATION)

> **Mã tài liệu**: `RULES-PROP-v2.3.1-01`  
> **Trạng thái**: **PROPOSAL ONLY — CHƯA ĐƯỢC DEPLOY LÊN FIREBASE**  
> **File quy tắc tham chiếu**: `firestore.graduation.proposed.rules`  
> **Ngày lập đề xuất**: 16/09/2026.  

---

### 1. BỐI CẢNH & NGUYÊN TẮC THIẾT KẾ

#### A. Vấn đề Hiện tại
Trong tệp quy tắc `firestore.rules` hiện hành:
- Tài nguyên `/graduationRounds/{roundId}` chỉ cho phép `admin()` thực hiện quyền ghi (`allow create, update, delete: if admin();`).
- Toàn bộ các mảng dữ liệu nghiệp vụ quan trọng gồm Điểm Hội đồng (`councilScores`), Lịch sử nộp bài của sinh viên (`activitySubmissions`), và Nhật ký kiểm toán (`auditLogs`) đang bị lưu dồn vào trong một document duy nhất.
- Khi người dùng không phải Admin (thành viên hội đồng là giảng viên, sinh viên nộp bài) gửi yêu cầu ghi trực tiếp, Firestore Rules sẽ trả về lỗi `permission-denied`. Frontend hiện tại phải dựa vào cờ quyền Admin hoặc bắt lỗi âm thầm (`try-catch`).
- Nếu mở quyền ghi trên toàn bộ document `graduationRounds/{roundId}` cho `staff()` hoặc `student()`, bất kỳ ai cũng có thể sửa đổi cấu hình toàn đợt, gây rủi ro bảo mật nghiêm trọng.

#### B. Nguyên tắc Thiết kế An toàn (Least Privilege)
1. **Không mở quyền diện rộng (No Wildcard Access)**: Tuyệt đối không sử dụng `allow write: if staff();` hay `allow write: if signedIn();` cho toàn bộ collection.
2. **Xác thực Chủ thể Chấm điểm (Scorer Ownership)**: Thành viên hội đồng chỉ được quyền tạo và sửa đúng phiếu điểm mà trường `scorerEmail` trùng khớp với email xác thực từ token đăng nhập (`request.auth.token.email`).
3. **Xác thực Sinh viên Nộp bài (Student Submission Ownership)**: Sinh viên chỉ được nộp bài cho chính mã số sinh viên của mình (`studentId == email.prefix`).
4. **Bảo toàn Tính Bất biến của Nhật ký (Immutable Audit Log)**: Nhật ký kiểm toán là `append-only`, tuyệt đối cấm mọi hành vi cập nhật hoặc xóa bỏ (`allow update, delete: if false;`).

---

### 2. CHI TIẾT CÁC QUY TẮC ĐỀ XUẤT CHO TỪNG SUBCOLLECTION

#### A. Subcollection `/graduationRounds/{roundId}/councilScores/{scoreId}`
- **Mục đích**: Tách từng phiếu chấm của từng ủy viên hội đồng đối với từng sinh viên thành một document độc lập.
- **Quy tắc đề xuất**:
```javascript
match /councilScores/{scoreId} {
  // Đọc: Admin hoặc Giảng viên thuộc trường
  allow read: if admin() || staff();

  // Tạo mới: Admin hoặc Giảng viên chính chủ chấm điểm
  allow create: if admin()
    || (staff() 
        && request.resource.data.scorerEmail == email()
        && request.resource.data.studentId is string
        && request.resource.data.activityId is string);

  // Cập nhật: 
  // 1. Admin có toàn quyền
  // 2. Giảng viên chấm điểm chính chủ cập nhật điểm của mình (không đổi scorerEmail)
  // 3. Chủ tịch Hội đồng cập nhật trường hiệu chỉnh (calibration) kèm thời gian
  allow update: if admin()
    || (staff() 
        && resource.data.scorerEmail == email() 
        && request.resource.data.scorerEmail == email())
    || (staff() 
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['calibration', 'updatedAt']));

  // Xóa: Chỉ Admin
  allow delete: if admin();
}
```

#### B. Subcollection `/graduationRounds/{roundId}/submissions/{submissionId}`
- **Mục đích**: Lưu trữ từng lần nộp bài (attempt) của sinh viên dưới dạng một document độc lập.
- **Quy tắc đề xuất**:
```javascript
match /submissions/{submissionId} {
  // Đọc: Admin, Giảng viên, hoặc chính Sinh viên nộp bài
  allow read: if admin()
    || (student() && resource.data.studentId == email().replace('@student.tdtu.edu.vn', ''))
    || staff();

  // Tạo mới: Admin hoặc chính Sinh viên nộp bài cho bản thân
  allow create: if admin()
    || (student()
        && request.resource.data.studentId == email().replace('@student.tdtu.edu.vn', '')
        && request.resource.data.submittedBy == email()
        && request.resource.data.status in ['submitted', 'uploading', 'draft']
        && request.resource.data.files is list);

  // Cập nhật: Admin hoặc Sinh viên chính chủ rút bài nộp (chỉ đổi status sang withdrawn)
  allow update: if admin()
    || (student()
        && resource.data.studentId == email().replace('@student.tdtu.edu.vn', '')
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'withdrawnAt', 'updatedAt'])
        && request.resource.data.status == 'withdrawn');

  // Xóa: Chỉ Admin
  allow delete: if admin();
}
```

#### C. Subcollection `/graduationRounds/{roundId}/auditLogs/{logId}`
- **Mục đích**: Ghi nhận chuỗi sự kiện kiểm toán không thể bị giả mạo hay xóa bỏ.
- **Quy tắc đề xuất**:
```javascript
match /auditLogs/{logId} {
  // Đọc: Admin hoặc Giảng viên
  allow read: if admin() || staff();

  // Tạo mới: Bất kỳ người dùng hợp lệ nào ghi nhận hành động của chính mình
  allow create: if signedIn()
    && request.resource.data.by == email()
    && request.resource.data.action is string;

  // BẤT BIẾN: Tuyệt đối không cho phép sửa hoặc xóa
  allow update: if false;
  allow delete: if false;
}
```

---

### 3. ĐÁNH GIÁ TÍNH TƯƠNG THÍCH & KẾ HOẠCH PHÊ DUYỆT

- **Ảnh hưởng đến Production Hiện tại**: 
  Vì bộ quy tắc này **CHƯA ĐƯỢC DEPLOY**, phiên bản `v2.2.0-beta.1` trên production tiếp tục vận hành bình thường theo `firestore.rules` gốc.
- **Lộ trình Phê duyệt & Triển khai**:
  1. Quản trị viên hệ thống (Owner Firebase) rà soát nội dung trong file `firestore.graduation.proposed.rules`.
  2. Chạy thử nghiệm trên Firebase Emulator Suite (Local Testing).
  3. Deploy thủ công qua Firebase CLI: `firebase deploy --only firestore:rules` khi toàn bộ hệ thống sẵn sàng chuyển sang Phase D (Switch Source of Truth).

---
*Tài liệu được lập bởi Antigravity Pair-Programming Agent theo tiêu chuẩn SAFE DEVELOPMENT MODE.*