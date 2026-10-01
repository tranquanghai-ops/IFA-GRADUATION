# Quy Trình Triển Khai (Deployment) — IFA Graduation (DATN)

## 1. Yêu Cầu Tiên Quyết (Prerequisites)

- Node.js LTS (18+ / 20+).
- Firebase CLI (`firebase-tools`) phiên bản mới nhất.
- Tài khoản GCP / Firebase được cấp quyền:
  - `ifa-graduation`: Hosting, Firestore Rules
  - `ifa-activities`: Cloud Functions (`graduationApi`)

---

## 2. Phân Định Ranh Giới Dự Án (Deployment Boundaries)

| Thành phần | Project Target | Lệnh triển khai | Cảnh báo tối quan trọng |
| :--- | :--- | :--- | :--- |
| **Hosting** | `ifa-graduation` | `npx firebase-tools deploy --only hosting --project ifa-graduation` | Luôn chỉ deploy hosting |
| **Firestore Rules** | `ifa-graduation` | `npx firebase-tools deploy --only firestore:rules --project ifa-graduation` | Chỉ chạy khi có phê duyệt rules |
| **Cloud Functions** | `ifa-activities` | Quản lý tại repo backend shared | **TUYỆT ĐỐI KHÔNG** deploy functions vào `ifa-graduation` |

> [!WARNING]
> 1. **KHÔNG deploy nhầm vào tknt-tdtu**:
>    Dự án `tknt-tdtu` là snapshot lưu trữ cũ. Tuyệt đối không dùng lệnh `firebase use tknt-tdtu` hay deploy vào project này.
> 2. **KHÔNG deploy functions vào ifa-graduation**:
>    Backend `graduationApi` chạy trên `ifa-activities`. Repo này chỉ chứa frontend và cấu hình rules.

---

## 3. Secret Manager & Cross-Project IAM

- **Project chứa Secrets**: `ifa-activities`
  - `graduation-drive-client-id`
  - `graduation-drive-client-secret`
  - `graduation-drive-owner-token`
- **IAM Cần Thiết**:
  - Service account `633545868576-compute@developer.gserviceaccount.com` phải có role `roles/datastore.user` trên project `ifa-graduation`.

---

## 4. Các Bước Triển Khai Hosting

```powershell
# 1. Kiểm tra mã nguồn và git
git status
git diff --check

# 2. Triển khai Hosting lên ifa-graduation
npx firebase-tools deploy --only hosting --project ifa-graduation
```

---

## 5. Kiểm Thử Khói Sau Triển Khai (Post-Deploy Smoke Tests)

1. Mở trang chủ: `https://ifa-graduation.web.app`
   - Kiểm tra màn hình đăng nhập Google TDTU.
   - Mở Console (F12) đảm bảo không có exception hay lỗi tài nguyên 404.
2. Kiểm tra Cổng Quản trị:
   - Đăng nhập bằng tài khoản Quản trị / Trưởng ngành.
   - Kiểm tra tab Cài đặt: Xác nhận cấu hình Root Google Drive hiển thị đúng trạng thái.
3. Kiểm tra Nộp bài ĐATN:
   - Thử nghiệm sinh viên tải lên tệp dung lượng lớn (> 50 MB) vào mốc nộp bài đang mở.
   - Xác nhận tiến trình chunking 32 MiB hoạt động ổn định và bài nộp hiển thị trong danh sách.
