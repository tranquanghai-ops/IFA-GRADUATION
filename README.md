# IFA Graduation — Hệ Thống Quản Lý Đồ Án Tốt Nghiệp (ĐATN)
**Khoa Mỹ thuật Công nghiệp — Trường Đại học Tôn Đức Thắng (TDTU)**

## Purpose
Nền tảng số hóa toàn diện quy trình Đồ án Tốt nghiệp (ĐATN): Đăng ký nguyện vọng Giảng viên Hướng dẫn (GVHD), Phân bổ hạn ngạch giảng viên, Quản lý đợt và mốc tiến độ (Activities), Nộp bài thuyết minh & bản vẽ dung lượng lớn lên Google Drive (2 GiB resumable), Quản lý Hội đồng chấm thi, Chấm điểm Rubric đa tiêu chí và Xuất phiếu đánh giá chuẩn A4.

## Production
- **Hosting URL**: [https://ifa-graduation.web.app](https://ifa-graduation.web.app) / [https://ifa-graduation.firebaseapp.com](https://ifa-graduation.firebaseapp.com)
- **Firebase Project**: `ifa-graduation` *(Lưu ý: Không dùng dự án lưu trữ cũ `tknt-tdtu`)*
- **GitHub Repository**: [tranquanghai-ops/IFA-GRADUATION](https://github.com/tranquanghai-ops/IFA-GRADUATION)
- **Current Production Baseline Commit**: `06a084ce1a0fdc3eba14f3cb728a46ddb610bb96`

## Architecture Summary
- **Hosting**: Firebase Hosting trên `ifa-graduation`
- **Authentication**: Google Sign-In (`@tdtu.edu.vn`, `@student.tdtu.edu.vn`) trên `ifa-graduation`
- **Firestore**: Cloud Firestore trên `ifa-graduation`
- **Storage**: Google Drive do IFA quản lý (resumable upload direct-from-browser)
- **Functions**: `graduationApi` triển khai tại region `asia-southeast1` trên project **`ifa-activities`**
- **Google Drive**: Thư mục gốc do Admin tự dán link trong Cài đặt (`graduationSystemConfig/drive`), hỗ trợ nộp file đến 2 GiB (32 MiB chunks, 256 KiB alignment)
- **Secret Manager**: Đặt tại project **`ifa-activities`** (`graduation-drive-client-id`, `graduation-drive-client-secret`, `graduation-drive-owner-token`)

## Documentation Quick Links
- 📘 [Kiến trúc hệ thống chi tiết (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)
- 📂 [Chính sách lưu trữ tệp & Google Drive (docs/FILE-STORAGE.md)](docs/FILE-STORAGE.md)
- 🚀 [Hướng dẫn triển khai production (docs/DEPLOYMENT.md)](docs/DEPLOYMENT.md)
- 🤖 [Hướng dẫn bàn giao AI & Developer Handoff (docs/AI-HANDOFF.md)](docs/AI-HANDOFF.md)

---

## Local Development

### Cài đặt & Khởi chạy:
- Node.js LTS (18+ / 20+).
- Khởi động web server cục bộ:
  ```powershell
  # Chạy server phát triển
  npm start
  ```
- Mở trình duyệt tại `http://localhost:5000` hoặc cổng được chỉ định.

---

## Deployment
Chi tiết toàn bộ quy trình, phân định ranh giới dự án và kiểm thử khói xem tại:  
👉 **[Tài liệu hướng dẫn triển khai đầy đủ (docs/DEPLOYMENT.md)](docs/DEPLOYMENT.md)**

```powershell
# Triển khai Hosting lên ifa-graduation
npx firebase-tools deploy --only hosting --project ifa-graduation
```
> [!WARNING]
> Tuyệt đối **KHÔNG** deploy Cloud Functions vào project `ifa-graduation`. Backend `graduationApi` được triển khai trên project trung tâm **`ifa-activities`**.

---

## Architecture
Toàn bộ sơ đồ kiến trúc hệ thống, phân quyền cross-project IAM và cấu trúc collections xem tại:  
👉 **[Kiến trúc hệ thống chi tiết (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)**

---

## AI / Developer Handoff
Các kỹ sư phần mềm và AI assistants khi tiếp nhận dự án bắt buộc phải đọc:  
👉 **[Tài liệu bàn giao AI & Developer Handoff (docs/AI-HANDOFF.md)](docs/AI-HANDOFF.md)**

---
*© 2026 Khoa Mỹ thuật Công nghiệp — Trường Đại học Tôn Đức Thắng (TDTU).*
