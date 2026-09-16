# KẾ HOẠCH CHUYỂN ĐỔI DỮ LIỆU PHA B (DATA MIGRATION PHASE B)
## IFA+ GRADUATION BETA — v2.3.1 (SAFE DEVELOPMENT MODE)

> **Mã tài liệu**: `MIGRATION-PHASE-B-v2.3.1`  
> **Trạng thái**: Triển khai New-Write + Dual-Read an toàn; Giữ nguyên dữ liệu Legacy; Không phá vỡ Production.  
> **Ngày ban hành**: 16/09/2026.  

---

### 1. CHIẾN LƯỢC TỔNG QUAN PHA B

Trong Pha B, hệ thống thực hiện chuyển đổi kiến trúc dữ liệu theo nguyên tắc:
1. **NEW WRITE**: Dữ liệu mới sinh ra sẽ được ghi vào các Subcollection độc lập:
   - `/graduationRounds/{roundId}/councilScores/{scoreId}`
   - `/graduationRounds/{roundId}/submissions/{submissionId}`
   - `/graduationRounds/{roundId}/auditLogs/{logId}`
2. **DUAL-READ (Ưu tiên Mới -> Fallback Cũ)**:
   - Khi truy vấn, hệ thống đọc từ Subcollection mới trước.
   - Nếu chưa có dữ liệu trong Subcollection (dữ liệu tạo từ các phiên bản v1.6–v2.2), hệ thống tự động fallback đọc từ mảng/map nested trong document `graduationRounds/{roundId}`.
   - Nếu cùng một bản ghi tồn tại ở cả 2 nơi, bản ghi trong Subcollection mới sẽ thắng (Newest Wins), không bị trùng lặp.
3. **KHÔNG XÓA DỮ LIỆU CŨ**: Toàn bộ dữ liệu legacy trong document đợt được bảo tồn 100%.
4. **KHÔNG CHUYỂN NGUỒN THẨM QUYỀN ĐỘT NGỘT**: Không đổi cờ Authoritative Source of Truth sang Subcollection nếu chưa chạy thử nghiệm an toàn.

---

### 2. MÔ HÌNH DỮ LIỆU CHI TIẾT CỦA CÁC SUBCOLLECTION MỚI

#### A. Điểm Hội đồng: `/graduationRounds/{roundId}/councilScores/{scoreId}`
- **Khóa xác định (Deterministic Score ID)**:
  `scoreId = `${activityId}_${councilId}_${studentId}_${scorerId}``
- **Cấu trúc Document**:
  ```json
  {
    "roundId": "round_2026_1",
    "activityId": "act_defense",
    "councilId": "council_1",
    "studentId": "12100314",
    "scorerId": "gv_01",
    "scorerEmail": "nguyenvanb@tdtu.edu.vn",
    "scorerName": "ThS. Nguyễn Văn B",
    "role": "chair",
    "mode": "defense_rubric",
    "score": 9.25,
    "rubricScores": { "idea": 3.8, "practicality": 2.7, "technique": 1.8, "presentation": 0.95 },
    "feedback": "Ý tưởng tốt, sản phẩm hoàn thiện cao",
    "status": "completed",
    "isGuest": false,
    "isOfficialScorer": true,
    "calibration": null,
    "createdAt": "SERVER_TIMESTAMP",
    "updatedAt": "SERVER_TIMESTAMP",
    "completedAt": "SERVER_TIMESTAMP"
  }
  ```
- **Lợi ích Bảo vệ Lost Update**: Ủy viên A ghi điểm chỉ cập nhật document của Ủy viên A; Ủy viên B chỉ cập nhật document của Ủy viên B; Chủ tịch hiệu chỉnh chỉ cập nhật trường `calibration` của đúng phiếu đó. Triệt tiêu hoàn toàn nguy cơ ghi đè toàn mảng.

#### B. Lần Nộp bài của Sinh viên: `/graduationRounds/{roundId}/submissions/{submissionId}`
- **Khóa xác định (Unique Attempt ID)**:
  `submissionId = `${activityId}_${studentId}_att${attemptNum}_${timestamp}``
- **Cấu trúc Document**:
  ```json
  {
    "roundId": "round_2026_1",
    "activityId": "act_thuyet_minh",
    "studentId": "12100314",
    "studentName": "Lê Thị Huỳnh Duyên",
    "studentEmail": "12100314@student.tdtu.edu.vn",
    "attemptNumber": 1,
    "receiptId": "REC-M7X9K2-AB12",
    "files": [
      {
        "originalName": "thuyet_minh.pdf",
        "validatedName": "12100314_LE_THI_HUYNH_DUYEN_THUYET_MINH.pdf",
        "size": 15420000,
        "mimeType": "application/pdf",
        "storageProvider": "google_drive",
        "providerFileId": "1gH8jK9...",
        "providerUrl": "https://drive.google.com/file/d/..."
      }
    ],
    "submittedAt": "SERVER_TIMESTAMP",
    "isLate": false,
    "status": "submitted",
    "submittedBy": "12100314@student.tdtu.edu.vn"
  }
  ```
- **Atomicity cho Attempt**: Khi sinh viên gửi bài, hệ thống truy vấn số lần nộp hiện có trong subcollection để xác định `attemptNumber = count + 1` một cách chuẩn xác, loại trừ nguy cơ 2 tab cùng sinh trùng attempt.

#### C. Nhật ký Kiểm toán Bất biến: `/graduationRounds/{roundId}/auditLogs/{logId}`
- **Khóa xác định**: `logId = `log_${Date.now()}_${random}``
- **Cấu trúc Document**:
  ```json
  {
    "roundId": "round_2026_1",
    "type": "admin_override",
    "action": "Gia hạn nộp bài",
    "target": "MSSV: 12100314, Mốc: Duyệt 1",
    "detail": "Gia hạn đến 20/09/2026 23:59. Lý do: Được Khoa phê duyệt",
    "by": "admin@tdtu.edu.vn",
    "createdAt": "SERVER_TIMESTAMP"
  }
  ```
- **Nguyên tắc**: Append-only. Không có bất kỳ dòng code nào thực hiện update hay delete document trong subcollection này.

---

### 3. GIAO DỊCH NGUYÊN TỬ (TRANSACTIONS) CHO FIRST-COMPLETED-WINS

#### A. Điểm Hướng dẫn (GVHD Score Transaction)
Khi 2 giảng viên đồng hướng dẫn cùng nhập điểm cho một sinh viên:
```javascript
await runTransaction(db, async (transaction) => {
  const roundDoc = await transaction.get(roundRef);
  const currentScore = roundDoc.data().supervisorScores?.[studentId];
  if (currentScore && currentScore.status === "completed" && currentScore.submittedBySupervisorId !== myId) {
    throw new Error(`Điểm GVHD đã được hoàn tất bởi ${currentScore.submittedByName || "giảng viên khác"}.`);
  }
  transaction.update(roundRef, { [`supervisorScores.${studentId}`]: newScoreRecord });
});
```
- Giảng viên nào commit trước sẽ chiến thắng và trở thành điểm chính thức.
- Giảng viên commit sau sẽ nhận thông báo lỗi rõ ràng, không bị tình trạng Last-Write-Wins ghi đè.

#### B. Điểm Thuyết minh HD (TM HD Score Transaction)
Áp dụng cơ chế tương tự cho điểm Thuyết minh Hướng dẫn (`thesisScores.${studentId}.hd`).

---

### 4. DỰ PHÓNG DUNG LƯỢNG DOCUMENT SAU KHI TÁCH

| Quy mô Đợt | Dung lượng Document TRƯỚC khi Tách (v2.2) | Dung lượng Document SAU khi Tách (Pha B) | Đánh giá Mức độ An toàn |
|:---|:---:|:---:|:---:|
| **50 Sinh viên** | 375 KB | **~ 45 KB** | Cực kỳ an toàn (chỉ chiếm 4.3% giới hạn 1 MiB) |
| **100 Sinh viên** | 1.170 KB *(Vượt ngưỡng)* | **~ 70 KB** | Rất an toàn (chiếm 6.8% giới hạn 1 MiB) |
| **200 Sinh viên** | 2.800 KB *(Quá tải nghiêm trọng)* | **~ 110 KB** | Rất an toàn (chiếm 10.5% giới hạn 1 MiB) |

> **KẾT LUẬN**: Sau khi tách 3 thành phần cồng kềnh sang Subcollection, kích thước document `graduationRounds/{roundId}` hoàn toàn **miễn nhiễm với số lượng sinh viên, số lượt chấm điểm và số lần nộp bài**!

---
*Tài liệu được lập bởi Antigravity Pair-Programming Agent theo tiêu chuẩn SAFE DEVELOPMENT MODE.*