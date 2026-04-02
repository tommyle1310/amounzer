# Test Cases: Chứng Từ → Sổ Sách → Báo Cáo Tài Chính

Tài liệu hướng dẫn các kịch bản test thủ công cho luồng từ tạo phiếu thu/chi đến xem báo cáo tài chính.

---

## Điều Kiện Chung (Setup)

Trước khi test bất kỳ case nào dưới đây, cần có sẵn:

```bash
# 1. Đăng nhập
POST /api/auth/login
Body: { "email": "accountant@company.com", "password": "password123" }
# Lưu accessToken

# 2. Lấy companyId
GET /api/companies
# Lưu companyId → dùng trong header X-Company-Id

# 3. Lấy fiscalYearId có status = OPEN
GET /api/fiscal-years?status=OPEN
# Lưu fiscalYearId

# 4. Lấy accountId của các tài khoản thường dùng
GET /api/chart-of-accounts/search?q=111   → accountId_111 (Tiền mặt)
GET /api/chart-of-accounts/search?q=112   → accountId_112 (TGNH)
GET /api/chart-of-accounts/search?q=131   → accountId_131 (Phải thu KH)
GET /api/chart-of-accounts/search?q=331   → accountId_331 (Phải trả NCC)
GET /api/chart-of-accounts/search?q=511   → accountId_511 (Doanh thu)
GET /api/chart-of-accounts/search?q=642   → accountId_642 (CPQL)
```

**Headers bắt buộc cho mọi request:**
```
Authorization: Bearer {accessToken}
X-Company-Id: {companyId}
Content-Type: application/json
```

---

## NHÓM 1: Vòng Đời Chứng Từ (Status Lifecycle)

### TC-01 — Tạo phiếu DRAFT, sau đó Ghi sổ (POSTED)

**Mục tiêu:** Kiểm tra luồng cơ bản nhất.

**Bước 1: Tạo phiếu nháp**
```http
POST /api/vouchers
Body:
{
  "voucherType": "PC",
  "date": "2026-04-02",
  "counterpartyName": "Công ty Văn phòng phẩm A",
  "description": "Chi tiền mua văn phòng phẩm",
  "totalAmount": 1000000,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_642}", "description": "Mua giấy in, bút", "debitAmount": 1000000, "creditAmount": 0 },
    { "accountId": "{accountId_111}", "description": "Xuất quỹ tiền mặt", "debitAmount": 0, "creditAmount": 1000000 }
  ]
}
```

**Kiểm tra sau Bước 1:**
- Response có `status: "DRAFT"` ✓
- Response có `voucherNumber` dạng `PC-2026-00001` ✓
- Response có `amountInWords: "Một triệu đồng chẵn"` (tự động sinh) ✓
- Response có `journalEntry` với `status: "DRAFT"` ✓
- Lấy `id` của voucher → `voucherId`

**Bước 2: Ghi sổ**
```http
POST /api/vouchers/{voucherId}/post
```

**Kiểm tra sau Bước 2:**
- Response có `status: "POSTED"` ✓
- Response có `postedAt` là timestamp hiện tại ✓
- `journalEntry.status` = `"POSTED"` ✓

**Bước 3: Xác minh sổ sách**
```http
GET /api/accounting-books/general-journal?startDate=2026-04-01&endDate=2026-04-30
```
→ Xuất hiện bút toán với `voucherNumber = PC-2026-00001` ✓

```http
GET /api/accounting-books/cash-book?startDate=2026-04-01&endDate=2026-04-30
```
→ Xuất hiện dòng PC-2026-00001, cột Chi = 1.000.000 ✓

---

### TC-02 — Xóa phiếu DRAFT (không cần bút toán đảo)

**Mục tiêu:** Phiếu DRAFT có thể xóa, không ảnh hưởng sổ sách.

**Bước 1:** Tạo phiếu PC giống TC-01. Lấy `voucherId`.

**Bước 2: Kiểm tra sổ sách TRƯỚC khi xóa**
```http
GET /api/accounting-books/cash-book?startDate=2026-04-01&endDate=2026-04-30
```
→ **Không** xuất hiện bút toán này (vì chưa POST) ✓

> Phiếu DRAFT không ảnh hưởng gì đến sổ sách và báo cáo tài chính.

---

### TC-03 — Hủy phiếu đã ghi sổ (VOID → bút toán đảo ngược)

**Mục tiêu:** Hủy phiếu POSTED tạo bút toán ngược để triệt tiêu tác động.

**Bước 1:** Thực hiện TC-01 đầy đủ (tạo + ghi sổ PC 1.000.000đ). Lấy `voucherId`.

**Bước 2: Ghi nhớ số dư trước khi void**
```http
GET /api/accounting-books/general-ledger?accountId={accountId_111}&startDate=2026-04-01&endDate=2026-04-30
```
→ Ghi lại số dư cuối kỳ TK 111.

**Bước 3: Hủy phiếu**
```http
POST /api/vouchers/{voucherId}/void
```

**Kiểm tra sau Bước 3:**
- Response có `status: "VOIDED"` ✓
- Response có `reversalJournalEntry` ✓
- `reversalJournalEntry.lines` có bút toán đảo: Nợ TK 111, Có TK 642 (ngược với gốc) ✓

**Bước 4: Kiểm tra sổ sách sau VOID**
```http
GET /api/accounting-books/general-ledger?accountId={accountId_111}&startDate=2026-04-01&endDate=2026-04-30
```
→ Số dư TK 111 quay về giá trị trước khi ghi sổ ✓
→ Sổ nhật ký có 2 dòng: bút toán gốc + bút toán đảo ngược ✓

---

### TC-04 — Thử void phiếu DRAFT (lỗi mong đợi)

**Mục tiêu:** Hệ thống từ chối void phiếu chưa ghi sổ.

**Bước 1:** Tạo phiếu PC → trạng thái DRAFT. Lấy `voucherId`.

**Bước 2: Thử void**
```http
POST /api/vouchers/{voucherId}/void
```

**Kết quả mong đợi:** HTTP 400
```json
{ "message": "Chỉ có thể hủy chứng từ đã ghi sổ" }
```

---

### TC-05 — Ghi sổ lần hai phiếu đã POSTED (lỗi mong đợi)

**Bước 1:** Thực hiện TC-01 đầy đủ. Lấy `voucherId`.

**Bước 2: Ghi sổ lại**
```http
POST /api/vouchers/{voucherId}/post
```

**Kết quả mong đợi:** HTTP 400
```json
{ "message": "Chỉ có thể ghi sổ chứng từ nháp" }
```

---

## NHÓM 2: Năm Năm Loại Phiếu (5 Voucher Types)

### TC-06 — PT (Phiếu Thu) — Thu tiền mặt từ khách hàng

**Nghiệp vụ:** Thu tiền mặt 5.000.000đ từ khách hàng Công ty ABC trả nợ.

```http
POST /api/vouchers
Body:
{
  "voucherType": "PT",
  "date": "2026-04-03",
  "counterpartyName": "Công ty ABC",
  "description": "Thu tiền khách hàng Công ty ABC trả nợ tháng 3",
  "totalAmount": 5000000,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_111}", "description": "Thu tiền mặt vào quỹ", "debitAmount": 5000000, "creditAmount": 0 },
    { "accountId": "{accountId_131}", "description": "Ghi giảm phải thu KH", "debitAmount": 0, "creditAmount": 5000000 }
  ]
}
```

**Sau khi POST:**
```http
POST /api/vouchers/{voucherId}/post
```

**Kiểm tra:**
```http
GET /api/accounting-books/cash-book?startDate=2026-04-01&endDate=2026-04-30
```
→ Dòng PT-2026-xxxxx, cột Thu = 5.000.000 ✓

```http
GET /api/accounting-books/general-ledger?accountId={accountId_111}&startDate=2026-04-01&endDate=2026-04-30
```
→ TK 111: Nợ phát sinh = 5.000.000 ✓

---

### TC-07 — BDN (Giấy Báo Nợ NH) — Tiền từ ngân hàng báo có

**Nghiệp vụ:** Ngân hàng báo Có 20.000.000đ (khách hàng chuyển khoản vào).

```http
POST /api/vouchers
Body:
{
  "voucherType": "BDN",
  "date": "2026-04-05",
  "counterpartyName": "Ngân hàng VietcomBank",
  "description": "Nhận tiền chuyển khoản từ KH Công ty XYZ",
  "totalAmount": 20000000,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_112}", "description": "Tiền vào TGNH", "debitAmount": 20000000, "creditAmount": 0 },
    { "accountId": "{accountId_131}", "description": "Ghi giảm phải thu", "debitAmount": 0, "creditAmount": 20000000 }
  ]
}
```

**Sau khi POST, kiểm tra:**
```http
GET /api/accounting-books/bank-book?startDate=2026-04-01&endDate=2026-04-30
```
→ Dòng BDN-2026-xxxxx, cột Thu = 20.000.000 ✓

---

### TC-08 — BCN (Giấy Báo Có NH) — Ngân hàng trừ tiền

**Nghiệp vụ:** Ngân hàng báo Nợ 3.000.000đ (phí dịch vụ + trả NCC qua CK).

```http
POST /api/vouchers
Body:
{
  "voucherType": "BCN",
  "date": "2026-04-07",
  "counterpartyName": "Ngân hàng VietcomBank",
  "description": "Thanh toán tiền điện tháng 3 qua chuyển khoản",
  "totalAmount": 3000000,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_331}", "description": "Ghi giảm phải trả NCC điện lực", "debitAmount": 3000000, "creditAmount": 0 },
    { "accountId": "{accountId_112}", "description": "Xuất TGNH", "debitAmount": 0, "creditAmount": 3000000 }
  ]
}
```

---

### TC-09 — BT (Chuyển Khoản) — Chuyển tiền giữa 2 tài khoản NH

**Nghiệp vụ:** Chuyển 50.000.000đ từ TK VCB sang TK Techcombank.

```http
GET /api/chart-of-accounts/search?q=112.1   → accountId_112_vcb
GET /api/chart-of-accounts/search?q=112.2   → accountId_112_tcb
```

```http
POST /api/vouchers
Body:
{
  "voucherType": "BT",
  "date": "2026-04-10",
  "counterpartyName": "Nội bộ",
  "description": "Chuyển tiền từ TK VCB sang TK Techcombank",
  "totalAmount": 50000000,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_112_tcb}", "description": "Nhận vào TK Techcombank", "debitAmount": 50000000, "creditAmount": 0 },
    { "accountId": "{accountId_112_vcb}", "description": "Xuất từ TK VCB", "debitAmount": 0, "creditAmount": 50000000 }
  ]
}
```

---

## NHÓM 3: Bút Toán Nhiều Dòng (Multi-line)

### TC-10 — Phiếu chi có nhiều dòng tài khoản chi phí

**Nghiệp vụ:** Chi 5.000.000đ cho nhiều khoản: 2.000.000đ chi phí văn phòng, 1.500.000đ chi phí điện thoại, 1.500.000đ chi phí vận chuyển.

```http
POST /api/vouchers
Body:
{
  "voucherType": "PC",
  "date": "2026-04-08",
  "counterpartyName": "Nhiều đối tượng",
  "description": "Chi phí văn phòng tháng 4/2026",
  "totalAmount": 5000000,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_642}", "description": "Văn phòng phẩm, giấy tờ", "debitAmount": 2000000, "creditAmount": 0 },
    { "accountId": "{accountId_cp_dt}", "description": "Cước viễn thông tháng 4", "debitAmount": 1500000, "creditAmount": 0 },
    { "accountId": "{accountId_cp_vc}", "description": "Vận chuyển hàng hoá", "debitAmount": 1500000, "creditAmount": 0 },
    { "accountId": "{accountId_111}", "description": "Xuất quỹ tiền mặt", "debitAmount": 0, "creditAmount": 5000000 }
  ]
}
```

**Kiểm tra cân đối:** Tổng Nợ = 2.000.000 + 1.500.000 + 1.500.000 = **5.000.000** = Tổng Có ✓

**Sau khi POST, kiểm tra sổ cái từng TK:**
```http
GET /api/accounting-books/general-ledger?accountId={accountId_642}&startDate=2026-04-01&endDate=2026-04-30
```
→ Xuất hiện 1 dòng phát sinh Nợ = 2.000.000 ✓

---

### TC-11 — Bút toán không cân (lỗi mong đợi)

**Mục tiêu:** Hệ thống từ chối bút toán mà tổng Nợ ≠ tổng Có.

```http
POST /api/vouchers
Body:
{
  "voucherType": "PC",
  "date": "2026-04-09",
  "description": "Test bút toán không cân",
  "totalAmount": 1000000,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_642}", "debitAmount": 1000000, "creditAmount": 0 },
    { "accountId": "{accountId_111}", "debitAmount": 0, "creditAmount": 800000 }
  ]
}
```

**Kết quả mong đợi:** HTTP 400
```json
{ "message": "Tổng Nợ không bằng tổng Có" }
```

---

## NHÓM 4: Ngoại Tệ (Foreign Currency)

### TC-12 — Phiếu chi ngoại tệ (USD)

**Nghiệp vụ:** Chi 1.000 USD mua phần mềm, tỷ giá 25.000 VND/USD.

```http
POST /api/vouchers
Body:
{
  "voucherType": "PC",
  "date": "2026-04-12",
  "counterpartyName": "Adobe Inc.",
  "description": "Mua bản quyền phần mềm Adobe CC",
  "totalAmount": 25000000,
  "currency": "USD",
  "originalAmount": 1000,
  "exchangeRate": 25000,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_chi_phi_pm}", "description": "CP phần mềm Adobe", "debitAmount": 25000000, "creditAmount": 0 },
    { "accountId": "{accountId_111}", "description": "Xuất quỹ tiền mặt (USD)", "debitAmount": 0, "creditAmount": 25000000 }
  ]
}
```

**Kiểm tra response:**
- `currency`: `"USD"` ✓
- `originalAmount`: `1000` ✓
- `exchangeRate`: `25000` ✓
- `totalAmount`: `25000000` (= 1000 × 25000) ✓
- `amountInWords`: tự sinh theo nguyên tệ ✓

---

### TC-13 — Phiếu thu ngoại tệ (EUR)

**Nghiệp vụ:** Thu 500 EUR từ khách hàng nước ngoài, tỷ giá 27.500 VND/EUR.

```http
POST /api/vouchers
Body:
{
  "voucherType": "PT",
  "date": "2026-04-15",
  "counterpartyName": "European Partner GmbH",
  "description": "Thu tiền dịch vụ tư vấn tháng 4",
  "totalAmount": 13750000,
  "currency": "EUR",
  "originalAmount": 500,
  "exchangeRate": 27500,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_112}", "description": "Thu vào TGNH ngoại tệ", "debitAmount": 13750000, "creditAmount": 0 },
    { "accountId": "{accountId_511}", "description": "Doanh thu dịch vụ tư vấn", "debitAmount": 0, "creditAmount": 13750000 }
  ]
}
```

---

## NHÓM 5: Thông Tin Pháp Lý (TT200/TT133)

### TC-14 — Phiếu chi có đầy đủ thông tin pháp lý

**Mục tiêu:** Kiểm tra tất cả các trường TT200/TT133 được lưu đúng.

```http
POST /api/vouchers
Body:
{
  "voucherType": "PC",
  "date": "2026-04-16",
  "counterpartyName": "Nguyễn Văn Bình",
  "counterpartyType": "INDIVIDUAL",
  "description": "Thanh toán tiền thuê mặt bằng tháng 4",
  "totalAmount": 30000000,

  "partyFullName": "Nguyễn Văn Bình",
  "partyAddress": "45 Nguyễn Huệ, Q1, TP.HCM",
  "partyIdNumber": "079123456789",
  "amountInWords": "Ba mươi triệu đồng chẵn",
  "voucherBookNo": "01",
  "attachmentCount": 1,
  "originalDocRefs": "Hợp đồng thuê mặt bằng số HĐ-2026-001",

  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_chi_phi_mb}", "description": "CP thuê mặt bằng T4/2026", "debitAmount": 30000000, "creditAmount": 0 },
    { "accountId": "{accountId_111}", "description": "Xuất quỹ tiền mặt", "debitAmount": 0, "creditAmount": 30000000 }
  ]
}
```

**Kiểm tra response:** Tất cả trường pháp lý được trả về đúng giá trị đã nhập ✓

**Lưu ý:** Vi phạm quy định chống rửa tiền là giao dịch tiền mặt ≥ 20 triệu nên cần `partyIdNumber`. Hệ thống vẫn chấp nhận nếu không điền, nhưng kế toán nên tuân thủ.

---

### TC-15 — Tự động sinh số tiền bằng chữ

**Mục tiêu:** Không truyền `amountInWords` → hệ thống tự sinh.

Tạo phiếu như TC-01 nhưng **bỏ trường** `amountInWords`.

**Kiểm tra response:**
- `amountInWords`: `"Một triệu đồng chẵn"` (tự sinh) ✓

**Test với số phức tạp hơn:** `totalAmount: 15750000`
- Kỳ vọng: `"Mười lăm triệu bảy trăm năm mươi nghìn đồng chẵn"` ✓

---

## NHÓM 6: Ngày Ghi Sổ Khác Ngày Chứng Từ

### TC-16 — RecordingDate khác Date

**Mục tiêu:** Chứng từ ngày 28/3 nhưng kế toán nhập vào ngày 02/4, ngày ghi sổ phải là 02/4.

```http
POST /api/vouchers
Body:
{
  "voucherType": "PC",
  "date": "2026-03-28",
  "recordingDate": "2026-04-02",
  "counterpartyName": "NCC ABC",
  "description": "Chi trả NCC cuối tháng 3 (nhập muộn)",
  "totalAmount": 2000000,
  "fiscalYearId": "{fiscalYearId}",
  "lines": [
    { "accountId": "{accountId_642}", "debitAmount": 2000000, "creditAmount": 0 },
    { "accountId": "{accountId_111}", "debitAmount": 0, "creditAmount": 2000000 }
  ]
}
```

**Kiểm tra:**
- `voucher.date`: `"2026-03-28"` (ngày chứng từ gốc) ✓
- `journalEntry.documentDate`: `"2026-03-28"` ✓
- `journalEntry.postingDate`: `"2026-04-02"` (ngày ghi sổ) ✓

Truy vấn sổ cái theo tháng 4 → **có** bút toán này (vì postingDate 02/04) ✓
Truy vấn sổ cái theo tháng 3 → **không có** (vì postingDate không nằm trong tháng 3) ✓

---

## NHÓM 7: Kiểm Soát Tồn Quỹ

### TC-17 — Ghi sổ PC khi tồn quỹ đủ (success)

**Điều kiện:** Tồn quỹ TK 111 hiện tại = X đồng.

Tạo + ghi sổ PC với `totalAmount = X - 1` (nhỏ hơn tồn quỹ 1 đồng).

**Kết quả mong đợi:** HTTP 200, ghi sổ thành công ✓

---

### TC-18 — Ghi sổ PC khi tồn quỹ không đủ (lỗi mong đợi)

**Điều kiện:** Tồn quỹ TK 111 hiện tại = X đồng.

```http
POST /api/vouchers
Body: { PC với totalAmount = X + 1 (lớn hơn tồn quỹ) }

POST /api/vouchers/{voucherId}/post
```

**Kết quả mong đợi:** HTTP 400
```json
{
  "message": "Không đủ tồn quỹ tiền mặt. Tồn quỹ hiện tại: X ₫, cần chi: (X+1) ₫"
}
```

> **Lưu ý:** Kiểm tra tồn quỹ chỉ áp dụng cho loại phiếu `PC`. Phiếu `BCN` (ngân hàng) không bị kiểm tra này.

---

## NHÓM 8: Ghi Sổ Hàng Loạt (Batch Post)

### TC-19 — Batch post nhiều phiếu cùng lúc

**Bước 1:** Tạo 3 phiếu DRAFT (PT, PC, PT). Lấy 3 `voucherId`.

**Bước 2:**
```http
POST /api/vouchers/batch-post
Body: { "ids": ["{voucherId1}", "{voucherId2}", "{voucherId3}"] }
```

**Kiểm tra response:**
```json
{
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "results": [
    { "id": "{voucherId1}", "success": true },
    { "id": "{voucherId2}", "success": true },
    { "id": "{voucherId3}", "success": true }
  ]
}
```

---

### TC-20 — Batch post khi một số phiếu lỗi (partial success)

**Bước 1:** Tạo 2 phiếu DRAFT. Ghi sổ phiếu 1 trước (thành POSTED).

**Bước 2:**
```http
POST /api/vouchers/batch-post
Body: { "ids": ["{voucherPostedId}", "{voucherDraftId}"] }
```

**Kiểm tra response:**
```json
{
  "total": 2,
  "succeeded": 1,
  "failed": 1,
  "results": [
    { "id": "{voucherPostedId}", "success": false, "error": "Chỉ có thể ghi sổ chứng từ nháp" },
    { "id": "{voucherDraftId}", "success": true }
  ]
}
```

---

## NHÓM 9: Tìm Kiếm và Lọc Chứng Từ

### TC-21 — Lọc theo loại phiếu

```http
GET /api/vouchers?voucherType=PT
```
→ Chỉ có phiếu thu (PT) trong kết quả ✓

```http
GET /api/vouchers?voucherType=PC
```
→ Chỉ có phiếu chi (PC) ✓

---

### TC-22 — Lọc theo trạng thái

```http
GET /api/vouchers?status=DRAFT
GET /api/vouchers?status=POSTED
GET /api/vouchers?status=VOIDED
```

---

### TC-23 — Lọc theo khoảng ngày

```http
GET /api/vouchers?startDate=2026-04-01&endDate=2026-04-15
```
→ Chỉ phiếu có date trong khoảng [01/04–15/04] ✓

---

### TC-24 — Tìm theo tên đối tượng (counterpartyName)

```http
GET /api/vouchers?counterpartyName=Công ty ABC
```
→ Tìm không phân biệt hoa thường, tìm theo substring ✓

---

### TC-25 — Phân trang

```http
GET /api/vouchers?page=1&limit=5
GET /api/vouchers?page=2&limit=5
```

**Kiểm tra response:**
```json
{
  "data": [...],
  "meta": { "total": 25, "page": 2, "limit": 5, "totalPages": 5 }
}
```

---

## NHÓM 10: Sổ Sách Kế Toán (Accounting Books)

### TC-26 — Sổ nhật ký chung (General Journal)

Thực hiện TC-01 và TC-06. Sau khi ghi sổ cả hai:

```http
GET /api/accounting-books/general-journal?startDate=2026-04-01&endDate=2026-04-30
```

**Kiểm tra:**
- Có đủ 2 bút toán: PC-2026-xxxxx và PT-2026-xxxxx ✓
- Mỗi bút toán có đủ dòng Nợ/Có ✓
- Tổng Nợ = Tổng Có trong toàn bộ kỳ ✓

---

### TC-27 — Sổ cái tài khoản (General Ledger)

Sau khi thực hiện TC-01 (PC 1.000.000) và TC-06 (PT 5.000.000):

```http
GET /api/accounting-books/general-ledger?accountId={accountId_111}&startDate=2026-04-01&endDate=2026-04-30
```

**Kiểm tra:**
- `openingBalance`: số dư đầu kỳ ✓
- Dòng PC: Có = 1.000.000 ✓
- Dòng PT: Nợ = 5.000.000 ✓
- `totalDebit`: 5.000.000 ✓
- `totalCredit`: 1.000.000 ✓
- `closingBalance`: openingBalance + 5.000.000 − 1.000.000 ✓

---

### TC-28 — Sổ quỹ tiền mặt (Cash Book)

```http
GET /api/accounting-books/cash-book?startDate=2026-04-01&endDate=2026-04-30
```

**Kiểm tra:**
- Cột `Thu` tổng hợp phiếu PT ✓
- Cột `Chi` tổng hợp phiếu PC ✓
- Cột `Tồn quỹ` tăng/giảm đúng theo từng dòng ✓
- Phiếu VOIDED **không** tính vào tồn quỹ (bị triệt tiêu bởi bút toán đảo) ✓

---

### TC-29 — Sổ tiền gửi ngân hàng (Bank Book)

Sau khi thực hiện TC-07 (BDN 20.000.000) và TC-08 (BCN 3.000.000):

```http
GET /api/accounting-books/bank-book?startDate=2026-04-01&endDate=2026-04-30
```

**Kiểm tra:**
- BDN: Thu = 20.000.000 ✓
- BCN: Chi = 3.000.000 ✓
- Số dư ngân hàng thay đổi đúng ✓

---

### TC-30 — Sổ cái công nợ khách hàng (Customer Ledger)

**Điều kiện:** Có `customerId` trong hệ thống.

```http
GET /api/accounting-books/customer-ledger?customerId={customerId}&startDate=2026-04-01&endDate=2026-04-30
```

**Kiểm tra:** Các phiếu thu có gắn `customerId` xuất hiện, giảm dư nợ tương ứng ✓

---

## NHÓM 11: Báo Cáo Tài Chính (Financial Reports)

### TC-31 — Bảng Cân Đối Kế Toán (B01-DN)

Sau khi thực hiện một số giao dịch (TC-01, TC-06, TC-07):

```http
GET /api/financial-reports/balance-sheet?asOfDate=2026-04-30
```

**Kiểm tra:**
- `assets.current.cash`: phản ánh tổng dư TK 111 + 112 ✓
- Tổng Tài sản = Tổng Nguồn vốn (cân đối) ✓

```http
GET /api/financial-reports/balance-sheet?asOfDate=2026-04-30&comparePriorPeriod=true
```

**Kiểm tra thêm:**
- Có cột `currentPeriod` và `priorPeriod` để so sánh ✓

---

### TC-32 — Báo Cáo Kết Quả Kinh Doanh (B02-DN)

Sau khi ghi sổ phiếu thu có TK 511 (Doanh thu) và phiếu chi có TK 642 (CPQL):

```http
GET /api/financial-reports/income-statement?startDate=2026-04-01&endDate=2026-04-30
```

**Kiểm tra:**
- `revenue` (TK 511): phản ánh đúng doanh thu ✓
- `adminExpenses` (TK 642): phản ánh chi phí QLDN ✓
- `netProfit`: doanh thu − chi phí = đúng ✓

---

### TC-33 — Báo Cáo Lưu Chuyển Tiền Tệ (B03-DN)

```http
GET /api/financial-reports/cash-flow?startDate=2026-04-01&endDate=2026-04-30&method=direct
```

**Kiểm tra:**
- `operatingActivities.cashInflows`: tổng tiền thu từ KH ✓
- `operatingActivities.cashOutflows`: tổng tiền chi ✓
- `closingCash`: bằng TK 111 + TK 112 cuối kỳ ✓

---

### TC-34 — Báo cáo tài chính với khoảng rỗng (không có giao dịch)

```http
GET /api/financial-reports/income-statement?startDate=2025-01-01&endDate=2025-01-31
```

**Kết quả mong đợi:** HTTP 200, tất cả giá trị = 0 (không lỗi) ✓

---

## NHÓM 12: Năm Tài Chính (Fiscal Year)

### TC-35 — Tạo phiếu với năm tài chính đã đóng (lỗi mong đợi)

**Điều kiện:** Có `closedFiscalYearId` là năm tài chính đã CLOSED.

```http
POST /api/vouchers
Body:
{
  "voucherType": "PC",
  "date": "2025-12-31",
  "description": "Test năm đóng",
  "totalAmount": 100000,
  "fiscalYearId": "{closedFiscalYearId}",
  "lines": [...]
}
```

**Kết quả mong đợi:** HTTP 400
```json
{ "message": "Năm tài chính đã đóng" }
```

---

### TC-36 — Tạo phiếu với fiscalYearId không tồn tại (lỗi mong đợi)

```http
POST /api/vouchers
Body: { ..., "fiscalYearId": "00000000-0000-0000-0000-000000000000" }
```

**Kết quả mong đợi:** HTTP 404
```json
{ "message": "Năm tài chính không tồn tại" }
```

---

## NHÓM 13: Đánh Số Tự Động (Auto Numbering)

### TC-37 — Số phiếu tăng dần theo từng loại

Tạo liên tiếp 3 phiếu PC:

```
PC-2026-00001
PC-2026-00002
PC-2026-00003
```

Tạo 2 phiếu PT → số PT không bị ảnh hưởng bởi PC:

```
PT-2026-00001
PT-2026-00002
```

**Kiểm tra:** Mỗi loại phiếu có dãy số riêng độc lập ✓

---

### TC-38 — Số phiếu không được phép trùng trong cùng công ty

Tạo nhiều phiếu cùng loại, cùng ngày → mỗi phiếu phải có `voucherNumber` duy nhất.

**Kiểm tra:** Không có 2 phiếu nào trùng voucherNumber ✓

---

## NHÓM 14: Quyền Hạn (Roles)

### TC-39 — VIEWER không được tạo phiếu

Đăng nhập bằng tài khoản có role `VIEWER`.

```http
POST /api/vouchers
Body: { ... }
```

**Kết quả mong đợi:** HTTP 403 Forbidden ✓

---

### TC-40 — VIEWER được xem báo cáo và sổ sách

Đăng nhập bằng tài khoản `VIEWER`:

```http
GET /api/vouchers
GET /api/accounting-books/cash-book?startDate=2026-04-01&endDate=2026-04-30
GET /api/financial-reports/balance-sheet?asOfDate=2026-04-30
```

**Kết quả mong đợi:** HTTP 200 cho tất cả ✓

---

### TC-41 — MANAGER được xem nhưng không được ghi sổ

Đăng nhập bằng tài khoản `MANAGER`:

```http
POST /api/vouchers/{voucherId}/post
```

**Kết quả mong đợi:** HTTP 403 Forbidden ✓

---

## NHÓM 15: Tính Nhất Quán Dữ Liệu (Data Consistency)

### TC-42 — Kiểm tra bút toán cân đối sau nhiều giao dịch

Thực hiện 5 giao dịch bất kỳ (PT, PC, BDN, BCN). Sau đó:

```http
GET /api/accounting-books/general-journal?startDate=2026-04-01&endDate=2026-04-30
```

**Kiểm tra:** `totalDebit === totalCredit` trong toàn bộ kỳ (Double-entry invariant) ✓

---

### TC-43 — Kiểm tra số dư bảng CĐKT cân bằng

```http
GET /api/financial-reports/balance-sheet?asOfDate=2026-04-30
```

**Kiểm tra:** `totalAssets === totalLiabilitiesAndEquity` ✓

---

### TC-44 — Phiếu VOIDED không ảnh hưởng báo cáo tài chính

**Bước 1:** Ghi nhớ số liệu báo cáo trước khi tạo phiếu.

**Bước 2:** Tạo + ghi sổ PC 10.000.000đ → báo cáo thay đổi.

**Bước 3:** Void phiếu vừa tạo.

**Bước 4:** Kiểm tra báo cáo → trở về giá trị ban đầu ✓

---

## Bảng Tổng Hợp Test Cases

| Nhóm | TC | Mô tả | Loại |
|------|----|-------|------|
| Vòng đời | TC-01 | DRAFT → POST | Happy path |
| Vòng đời | TC-02 | Xem DRAFT không ảnh hưởng sổ | Happy path |
| Vòng đời | TC-03 | VOID → bút toán đảo | Happy path |
| Vòng đời | TC-04 | Void DRAFT | Error case |
| Vòng đời | TC-05 | Post lần hai | Error case |
| 5 loại phiếu | TC-06 | PT Phiếu thu | Happy path |
| 5 loại phiếu | TC-07 | BDN Ngân hàng báo Nợ | Happy path |
| 5 loại phiếu | TC-08 | BCN Ngân hàng báo Có | Happy path |
| 5 loại phiếu | TC-09 | BT Chuyển khoản nội bộ | Happy path |
| Multi-line | TC-10 | PC nhiều dòng chi phí | Happy path |
| Multi-line | TC-11 | Bút toán không cân | Error case |
| Ngoại tệ | TC-12 | PC USD | Happy path |
| Ngoại tệ | TC-13 | PT EUR | Happy path |
| Pháp lý | TC-14 | Đầy đủ TT200/TT133 | Happy path |
| Pháp lý | TC-15 | Tự sinh số tiền bằng chữ | Happy path |
| Ngày ghi sổ | TC-16 | recordingDate khác date | Happy path |
| Tồn quỹ | TC-17 | PC khi quỹ đủ | Happy path |
| Tồn quỹ | TC-18 | PC khi quỹ không đủ | Error case |
| Batch | TC-19 | Batch post thành công | Happy path |
| Batch | TC-20 | Batch post partial | Edge case |
| Tìm kiếm | TC-21 – TC-25 | Filter và phân trang | Happy path |
| Sổ sách | TC-26 – TC-30 | General journal, ledger, cash, bank | Happy path |
| Báo cáo | TC-31 – TC-34 | B01, B02, B03, kỳ rỗng | Happy path |
| Fiscal Year | TC-35 – TC-36 | Năm đóng / không tồn tại | Error case |
| Đánh số | TC-37 – TC-38 | Auto-increment, unique | Happy path |
| Quyền hạn | TC-39 – TC-41 | VIEWER, MANAGER, ACCOUNTANT | Security |
| Nhất quán | TC-42 – TC-44 | Double-entry, CĐKT cân, VOID | Integrity |
