# IFA+ GRADUATION — KIẾN TRÚC TÍCH HỢP HỒ SƠ SINH VIÊN KHOA TỪ IFAA (READ-ONLY)
**Phiên bản:** v2.3.4  
**Chế độ:** SAFE DEVELOPMENT MODE  
**Trạng thái:** Read-Only Consumer Integration  
**Mục tiêu:** Sử dụng IFA+ Activities (IFAA) làm Single Source of Truth duy nhất cho toàn bộ danh mục sinh viên khoa MTCN; Graduation chỉ đọc (read-only consumer) và giải quyết thông tin động.

---

## 1. NGUỒN DỮ LIỆU SINH VIÊN (IFAA SINGLE SOURCE OF TRUTH)

Dựa trên kết quả rà soát trực tiếp mã nguồn và cấu trúc lưu trữ của IFA+ Activities:

| Thuộc tính | Chi tiết cấu hình |
| :--- | :--- |
| **Hệ thống nguồn** | **IFA+ Activities (IFAA)** |
| **Firebase Project** | `ifa-activities` (`projectId: "ifa-activities"`, `storageBucket: "ifa-activities.firebasestorage.app"`) |
| **Định dạng dữ liệu** | Gzipped JSON (`application/gzip`), giải nén thành payload `{ schemaVersion: 1, version: number, students: [...] }` |
| **Vị trí Storage** | `datasets/faculty-students.json.gz` |
| **Vị trí Metadata** | Firestore document: `facultyStudentMeta/current` (chứa `datasetVersion`, `datasetPath`, `datasetUrl`, `recordCount`, `updatedAt`) |
| **Khóa chính (PK)** | `mssv` (Chuỗi chữ hoa, ví dụ: `12100314`, `52000888`) |
| **Các trường dữ liệu** | `mssv`, `name` / `fullName`, `email`, `gender`, `major`, `studentClass` / `className`, `admissionYear`, `course`, `phone` |
| **Quy trình cập nhật** | Quản trị viên Khoa upload danh sách Excel tại trang Admin IFAA (`admin/admin.mjs` -> `publishFacultyDataset()`), hệ thống IFAA tự động nén gzip, đẩy lên Storage và cập nhật `facultyStudentMeta/current`. |

> [!IMPORTANT]
> **Quy tắc bất biến (Zero-Write Guarantee):**  
> Mọi thao tác thêm sinh viên, sửa tên, đổi lớp, cập nhật ngành, xóa hoặc ẩn sinh viên **hoàn toàn thuộc thẩm quyền của IFA+ Activities**. Graduation tuyệt đối **KHÔNG ghi ngược sang IFAA** và **KHÔNG tạo danh mục master thứ hai**.

---

## 2. KIẾN TRÚC READ-ONLY TRONG GRADUATION

### 2.1. Kết nối Cross-Project qua Secondary Firebase App
Graduation khởi tạo một Firebase App thứ hai với định danh `'ifaa-readonly'` trỏ về project `ifa-activities`:
```javascript
export const IFAA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDoz3iLOjU1JpHkgTDQHPyh29vUYOCcJhU",
  authDomain: "ifa-activities.firebaseapp.com",
  projectId: "ifa-activities",
  storageBucket: "ifa-activities.firebasestorage.app",
  messagingSenderId: "633545868576",
  appId: "1:633545868576:web:c1509233a2b5046b320345"
};
```
Secondary App này chỉ khởi tạo Firestore và Storage Client ở chế độ **Read-Only**:
- Không cấp quyền write
- Không chứa service account credentials
- Tuân thủ Storage Rules và Firestore Rules của `ifa-activities`

### 2.2. Chiến lược Tải và Bộ nhớ đệm (IndexedDB Caching)
Quy trình nạp dữ liệu diễn ra theo 4 lớp tối ưu:

1. **In-Memory Map (`state.facultyStudentsMap`)**: Tra cứu tức thời theo `mssv` với độ phức tạp O(1).
2. **IndexedDB (`graduation-faculty-dataset` -> `datasets`)**: Lưu trữ toàn bộ danh mục sau khi giải nén, giúp nạp ứng dụng trong vòng dưới 50ms mà không tiêu tốn băng thông Storage.
3. **ETag / Version Checking**: So sánh `metadata.datasetVersion` từ Firestore `facultyStudentMeta/current` với version lưu trong cache. Chỉ tải lại file nén khi phiên bản trên IFAA thực sự thay đổi.
4. **DecompressionStream Native**: Giải nén trực tiếp luồng nhị phân Gzip trong trình duyệt mà không cần thư viện bên thứ ba.

---

## 3. CENTRAL STUDENT RESOLVER API

Hệ thống cung cấp bộ API chuẩn toàn cục để mọi module trong Graduation truy xuất thông tin sinh viên:

### `window.getFacultyStudent(studentId)`
- **Đầu vào:** `studentId` hoặc `mssv` (chuỗi hoặc số, tự động chuẩn hóa uppercase).
- **Đầu ra:** Đối tượng hồ sơ sinh viên đầy đủ:
  ```javascript
  {
    mssv: "52000888",
    studentId: "52000888",
    name: "Nguyễn Văn A",
    fullName: "Nguyễn Văn A",
    email: "52000888@student.tdtu.edu.vn",
    gender: "Nam",
    major: "Thiết kế nội thất",
    className: "20050201",
    studentClass: "20050201",
    admissionYear: "2020",
    course: "K24"
  }
  ```
- **Cam kết an toàn (Non-Crashing Fallback):** Nếu sinh viên không có trong Master hoặc dữ liệu chưa nạp xong, hàm trả về đối tượng dự phòng an toàn:
  ```javascript
  {
    mssv: cleanId,
    studentId: cleanId,
    name: "Sinh viên " + cleanId,
    fullName: "Sinh viên " + cleanId,
    isMissing: true,
    notFoundInMaster: true
  }
  ```
  Hàm **tuyệt đối không ném ngoại lệ (never throws)** và **không trả về `undefined`** gây crash giao diện.

### `window.getFacultyStudents(filterFn)`
- Lọc danh sách sinh viên theo hàm điều kiện tùy biến.

### `window.searchFacultyStudents(query, options)`
- Tìm kiếm tức thì theo từ khóa (MSSV, Họ tên, Email, Lớp) kết hợp bộ lọc (Ngành, Lớp, Giới tính).

### `window.syncFacultyDatasetFromIFAA()`
- Thao tác cưỡng bức đồng bộ (force refresh) tải lại phiên bản mới nhất từ IFAA khi Quản trị viên muốn cập nhật ngay lập tức.

---

## 4. TỐI ƯU HÓA MÔ HÌNH DỮ LIỆU ĐỢT (ELIGIBLE STUDENTS MINIMALISM)

### 4.1. Không trùng lặp dữ liệu (Zero Profile Duplication)
- Tài liệu sinh viên đủ điều kiện trong đợt (`/graduationRounds/{roundId}/eligibleStudents/{studentId}`) chỉ cần lưu khóa chính:
  ```json
  {
    "studentId": "52000888",
    "eligible": true,
    "importedAt": "2026-09-16T..."
  }
  ```
- Các trường Họ tên, Lớp, Ngành, Email được **phân giải động tại thời điểm hiển thị (Dynamic Resolution)** thông qua Central Student Resolver.

### 4.2. Tích hợp xuyên suốt các module
- **Hội đồng & Phân công (Councils)**: `findStudentInRound(studentId)` tự động bổ sung Họ tên và Lớp từ IFAA master nếu tài liệu đợt thiếu thông tin.
- **Tính điểm & Bảng xếp hạng (Scoring & Ranking)**: `computeRoundRanking(roundId)` tự động điền Họ tên chuẩn xác khi xuất danh sách xếp hạng.
- **Nộp bài (Submissions)**: `createSubmissionWithAttempt` tự động bổ sung `studentName` chuẩn xác vào receipt và subcollection.
- **Báo cáo & Xuất Excel (Export)**: Các báo cáo tổng kết đợt, hội đồng và sinh viên đều lấy thông tin mới nhất từ IFAA Master.

---

## 5. KHÓA CHẶT CÁC THAO TÁC GHI CŨ (LEGACY MUTATION LOCKDOWN)

Giao diện Quản trị viên tại tab "Sinh viên Toàn khoa" đã được chuyển đổi hoàn toàn:
1. **Banner Thông báo Chế độ Chỉ đọc**: Nêu rõ nguồn dữ liệu duy nhất là IFA+ Activities (`ifa-activities`).
2. **Vô hiệu hóa Form Thêm/Sửa**: Form nhập liệu trực tiếp được gỡ bỏ; các hàm `saveSingleFacultyStudent`, `editFacultyStudentInline`, `deleteFacultyStudent`, `clearAllFacultyStudents`, `handleFacultyStudentsUpload` bị chặn hoàn toàn, hiển thị Toast cảnh báo giải thích chế độ Read-Only và thực hiện **0 ghi vào cơ sở dữ liệu**.
3. **Bảng dữ liệu Master**: Hiển thị nhãn `IFAA Master` cho từng dòng sinh viên, hỗ trợ tìm kiếm, phân trang và nút "Xuất Excel".

---

## 6. ĐÁNH GIÁ AN TOÀN & BẢO MẬT (SECURITY & RULES IMPACT)

- **Graduation Firestore Rules:** Giữ nguyên 100%, không cần thay đổi. Các rule kiểm tra quyền truy cập của sinh viên đã luôn dựa trên `studentId` / `request.auth.uid`.
- **Không thay đổi Auth / Billing / Cloud Functions:** Hoàn toàn chạy client-side thông qua chuẩn modular SDK của Firebase.
- **Zero-Write Guarantee:** Graduation không có bất kỳ cơ chế ghi nào vào bucket hoặc Firestore của `ifa-activities`.
