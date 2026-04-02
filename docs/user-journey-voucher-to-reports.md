# User Journey: Phiếu Thu/Chi → Sổ Sách → Báo Cáo Tài Chính

Tài liệu mô tả luồng hoạt động từ việc nhập liệu phiếu thu/chi đến tự động cập nhật sổ sách và báo cáo tài chính theo chuẩn Việt Nam.

---

## Tổng Quan Luồng Dữ Liệu

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1. NHẬP LIỆU   │───▸│  2. SỔ SÁCH     │───▸│  3. BÁO CÁO     │
│  Phiếu thu/chi  │    │  Tự động cập    │    │  Tự động tính   │
│  (Voucher)      │    │  (Ledgers)      │    │  (Reports)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                      │                      │
        │                      │                      │
   ┌────▼─────┐          ┌─────▼─────┐         ┌─────▼─────┐
   │ Bút toán │          │ Số dư TK  │         │ BCTC      │
   │ Nợ/Có    │          │ cập nhật  │         │ theo VAS  │
   └──────────┘          └───────────┘         └───────────┘
```

---

## Bước 1: Nhập Liệu Chứng Từ (Voucher Entry)

### 1.0 Điều Kiện Tiên Quyết

Trước khi tạo phiếu thu/chi, đảm bảo:

1. **Đã đăng nhập:**
   - Có `accessToken` trong localStorage hoặc cookie
   - Header mọi request phải có: `Authorization: Bearer {accessToken}`

2. **Đã chọn công ty:**
   - Có `companyId` được set (từ context hoặc localStorage)
   - Header mọi request phải có: `X-Company-Id: {companyId}`

3. **Có năm tài chính đang mở:**
   - Gọi API để lấy fiscal year với `status = OPEN`
   - Lưu `fiscalYearId` để truyền khi tạo voucher

4. **Có hệ thống tài khoản:**
   - Chart of accounts đã được tạo hoặc seed
   - Gọi `/api/chart-of-accounts` để verify có tài khoản

### 1.1 Các Loại Phiếu

| Mã | Tên tiếng Việt | Tên tiếng Anh | Tài khoản mặc định |
|----|----------------|---------------|-------------------|
| PT | Phiếu thu | Cash Receipt | Nợ TK 111 (Tiền mặt) |
| PC | Phiếu chi | Cash Payment | Có TK 111 (Tiền mặt) |
| BDN | Giấy báo Nợ NH | Bank Debit Note | Nợ TK 112 (TGNH) |
| BCN | Giấy báo Có NH | Bank Credit Note | Có TK 112 (TGNH) |
| BT | Chuyển khoản / Ủy nhiệm chi | Bank Transfer | Có TK 112.x → Nợ TK 112.y |

**Lưu ý:** Phiếu kế toán (Journal Voucher) không phải loại phiếu trong hệ thống này. Để ghi bút toán điều chỉnh, sử dụng module Journal Entry riêng.

### 1.2 Khi Nào Cần Điền Thông Tin Pháp Lý?

Theo Thông tư 200/2014/TT-BTC và Thông tư 133/2016/TT-BTC, các trường thông tin pháp lý được khuyến khích hoặc bắt buộc trong các tình huống sau:

**Bắt buộc phải điền:**
- ✅ **Họ tên người nộp/nhận tiền:** Khi giao dịch với cá nhân (không phải công ty)
- ✅ **CMND/CCCD:** Khi giao dịch tiền mặt từ 20 triệu đồng trở lên (theo Luật PCRLTT)
- ✅ **Số tiền bằng chữ:** Khuyến khích cho mọi chứng từ (hệ thống tự động tạo)
- ✅ **Số tiền nguyên tệ + Tỷ giá:** Khi giao dịch bằng ngoại tệ

**Nên điền để đầy đủ:**
- 📝 **Địa chỉ:** Giúp xác định rõ nguồn gốc giao dịch
- 📝 **Chứng từ gốc kèm theo:** Liệt kê hóa đơn, hợp đồng đính kèm
- 📝 **Quyển số:** Nếu doanh nghiệp quản lý chứng từ theo quyển

**Trong thực tế:**
- Form có collapsible section "Thông tin pháp lý" - có thể thu gọn nếu không cần
- Các trường này không bắt buộc nhập (except khi có quy định đặc biệt)
- Hệ thống tự động tạo "Số tiền bằng chữ" từ totalAmount
- Auto-fill "Họ tên" từ counterpartyName để tiện lợi

### 1.3 Ví Dụ: Phiếu Chi Mua Văn Phòng Phẩm

**Nghiệp vụ:** Công ty chi tiền mặt 1.000.000đ mua văn phòng phẩm.

**Nhập liệu trên form:**

```
┌──────────────────────────────────────────────────────────────┐
│ TẠO PHIẾU CHI MỚI                                            │
├──────────────────────────────────────────────────────────────┤
│ THÔNG TIN CHỨNG TỪ:                                          │
│ Loại chứng từ: [PC - Phiếu chi ▼]                            │
│ Ngày chứng từ: [02/04/2026]                                  │
│ Đối tượng:     [Công ty Văn phòng phẩm A]                    │
│ Nội dung:      [Chi tiền mua văn phòng phẩm]                 │
├──────────────────────────────────────────────────────────────┤
│ THÔNG TIN PHÁP LÝ (TT200/TT133) - Optional [▼ Mở rộng]      │
│ Họ tên người nhận tiền:  [Nguyễn Văn A]                      │
│ Địa chỉ:                 [123 Đường ABC, Q1, TPHCM]          │
│ CMND/CCCD:               [079123456789]                      │
│ Số tiền bằng chữ:        [Một triệu đồng chẵn] (tự động)    │
│ Loại tiền:               [VND ▼]                             │
│ Quyển số:                [ ]                                 │
│ Kèm theo chứng từ gốc:   [2] hóa đơn                         │
│ Chứng từ gốc:            [Hóa đơn GTGT số 001234]            │
├──────────────────────────────────────────────────────────────┤
│ BÚT TOÁN:                                                    │
│ ┌────┬────────────┬──────────────────┬─────────┬───────┐   │
│ │ #  │ Tài khoản  │ Diễn giải        │ Nợ (đ)  │ Có    │   │
│ ├────┼────────────┼──────────────────┼─────────┼───────┤   │
│ │ 1  │ 642 - CPQL │ Mua giấy in, bút │1.000.000│       │   │
│ │ 2  │ 111 - TM   │ Xuất quỹ tiền mặt│         │1.000.000│ │
│ ├────┴────────────┴──────────────────┼─────────┼───────┤   │
│ │                           Tổng cộng│1.000.000│1.000.000│ │
│ │                          Chênh lệch│   Cân   │       │   │
│ └─────────────────────────────────────┴─────────┴───────┘   │
│                              [Hủy] [Lưu nháp] [Ghi sổ]      │
└──────────────────────────────────────────────────────────────┘
```

**Giải thích các trường thông tin pháp lý:**

Theo Thông tư 200/2014/TT-BTC (TT200) và Thông tư 133/2016/TT-BTC (TT133), chứng từ kế toán cần một số thông tin bổ sung:

| Trường | Bắt buộc? | Ghi chú |
|--------|-----------|---------|
| **Họ tên người nộp/nhận tiền** | Khuyến khích | Bắt buộc khi giao dịch với cá nhân. Tự động lấy từ "Đối tượng" |
| **Địa chỉ** | Không | Địa chỉ của người giao dịch |
| **CMND/CCCD** | Không | Bắt buộc cho giao dịch lớn (>20 triệu theo quy định chống rửa tiền) |
| **Số tiền bằng chữ** | Khuyến khích | Tự động generate từ totalAmount. Có thể nhập thủ công để override |
| **Loại tiền** | Mặc định VND | Chọn ngoại tệ nếu giao dịch bằng USD, EUR, etc. |
| **Số tiền nguyên tệ** | Khi dùng ngoại tệ | Số tiền gốc bằng ngoại tệ |
| **Tỷ giá** | Khi dùng ngoại tệ | Tỷ giá quy đổi sang VND |
| **Quyển số** | Không | Số quyển (book number) nếu doanh nghiệp quản lý theo quyển |
| **Kèm theo ... chứng từ gốc** | Không | Số lượng chứng từ đính kèm |
| **Chứng từ gốc** | Không | Mô tả chứng từ đính kèm (hóa đơn, hợp đồng, ...) |

**Lưu ý khi implement:**
- Tài khoản dropdown phải gọi API `/api/chart-of-accounts/search?q={query}` để autocomplete
- Khi submit, truyền `accountId` (UUID), không phải mã tài khoản
- Số tiền bằng chữ tự động generate nếu không nhập (sử dụng `numberToVietnameseWords`)
- Phải có ít nhất 2 dòng bút toán và tổng Nợ phải bằng tổng Có
- Phần "Thông tin pháp lý" có thể thu gọn (collapsible), không bắt buộc phải điền tất cả
- Nếu counterpartyName có giá trị, tự động copy vào partyFullName để tiện lợi

### 1.4 Quy Trình Trạng Thái Chứng Từ

```
  ┌─────────┐  Lưu nháp   ┌─────────┐  Ghi sổ   ┌─────────┐
  │   MỚI   │ ──────────▸ │  NHÁP   │ ────────▸ │ ĐÃ GHI  │
  │         │             │ (DRAFT) │           │(POSTED) │
  └─────────┘             └────┬────┘           └────┬────┘
                               │                     │
                               │ Xóa (nếu cần)       │ Hủy bỏ
                               ▼                     ▼
                          ┌──────────┐          ┌─────────┐
                          │ Có thể   │          │ VOIDED  │
                          │ xóa khỏi │          │(Bút toán│
                          │ hệ thống │          │đảo ngược)│
                          └──────────┘          └─────────┘
```

**Lưu ý:** 
- Phiếu ở trạng thái DRAFT có thể chỉnh sửa hoặc xóa
- Phiếu ở trạng thái POSTED không thể sửa, chỉ có thể hủy bỏ (VOID) để tạo bút toán đảo
- Phiếu VOIDED vẫn giữ lại lịch sử để audit

### 1.5 Đánh Số Tự Động

- Format voucher number: `{MÃ LOẠI}-{NĂM}-{SỐ THỨ TỰ}`
- Ví dụ: `PC-2026-00001`, `PT-2026-00001`, `BDN-2026-00001`
- Mỗi loại phiếu có dãy số riêng (counter riêng cho PT, PC, BDN, BCN, BT)
- Số thứ tự tự động tăng, padding 5 chữ số (00001, 00002, ...)
- Reset về 1 vào đầu năm tài chính mới (configurable)

**Lưu ý:** Số phiếu được generate tự động khi tạo voucher, không cần truyền trong request.

### 1.6 Hỗ Trợ Ngoại Tệ

Hệ thống hỗ trợ ghi nhận giao dịch bằng ngoại tệ (USD, EUR, JPY, CNY):

**Cách hoạt động:**
1. Chọn loại tiền khác VND trong dropdown
2. Nhập số tiền nguyên tệ (ví dụ: 1000 USD)
3. Nhập tỷ giá quy đổi (ví dụ: 24,000 VND/USD)
4. Hệ thống tự động tính số tiền VND = originalAmount × exchangeRate

**Ví dụ:** Chi 1000 USD mua thiết bị, tỷ giá 24,000 VND/USD

```json
{
  "voucherType": "PC",
  "description": "Mua thiết bị từ Mỹ",
  "currency": "USD",
  "originalAmount": 1000,
  "exchangeRate": 24000,
  "totalAmount": 24000000,  // = 1000 × 24,000
  "lines": [
    { "accountId": "211", "debitAmount": 24000000, "creditAmount": 0 },
    { "accountId": "111", "debitAmount": 0, "creditAmount": 24000000 }
  ]
}
```

**Lưu ý:**
- Bút toán vẫn ghi bằng VND (sau khi quy đổi)
- Hệ thống lưu cả originalAmount và exchangeRate để tra cứu
- Số tiền bằng chữ tự động dùng nguyên tệ nếu có (ví dụ: "One thousand US Dollar")

---

## Bước 2: Tự Động Cập Nhật Sổ Sách (Auto Ledger Posting)

Khi chứng từ được **Ghi sổ (POST)**, hệ thống tự động:

### 2.1 Tạo Bút Toán Nhật Ký (Journal Entry)

Khi ghi sổ voucher, hệ thống tự động tạo journal entry:

**Request body khi tạo voucher:**
```json
{
  "voucherType": "PC",
  "date": "2026-04-02",
  "counterpartyName": "Công ty Văn phòng phẩm A",
  "description": "Chi tiền mua văn phòng phẩm",
  "totalAmount": 1000000,
  
  // Thông tin pháp lý (TT200/TT133) - Optional
  "partyFullName": "Nguyễn Văn A",
  "partyAddress": "123 Đường ABC, Q1, TPHCM",
  "partyIdNumber": "079123456789",
  "amountInWords": "Một triệu đồng chẵn",
  "voucherBookNo": "01",
  "attachmentCount": 2,
  "originalDocRefs": "Hóa đơn GTGT số 001234",
  
  // Foreign currency (nếu có)
  "currency": "VND",
  // "originalAmount": 1000,      // Số tiền ngoại tệ (nếu currency != VND)
  // "exchangeRate": 24000,        // Tỷ giá (nếu currency != VND)
  
  "fiscalYearId": "fiscal_year_uuid",
  "lines": [
    {
      "accountId": "account_642_uuid",
      "description": "Mua giấy in, bút",
      "debitAmount": 1000000,
      "creditAmount": 0
    },
    {
      "accountId": "account_111_uuid",
      "description": "Xuất quỹ tiền mặt",
      "debitAmount": 0,
      "creditAmount": 1000000
    }
  ]
}
```

**Journal Entry được tạo tự động khi POST voucher:**
```json
{
  "journalEntry": {
    "entryNumber": "JE-2026-000123",
    "postingDate": "2026-04-02",
    "description": "Chi tiền mua văn phòng phẩm - PC-2026-00001",
    "status": "POSTED",
    "totalDebit": 1000000,
    "totalCredit": 1000000,
    "lines": [
      {
        "accountId": "account_642_uuid",
        "debitAmount": 1000000,
        "creditAmount": 0,
        "lineOrder": 1
      },
      {
        "accountId": "account_111_uuid",
        "debitAmount": 0,
        "creditAmount": 1000000,
        "lineOrder": 2
      }
    ]
  }
}
```

### 2.2 Cập Nhật Các Sổ Sách

| Sổ sách | Tên tiếng Việt | Tự động cập nhật |
|---------|----------------|------------------|
| **Sổ Nhật ký chung** | General Journal | ✅ Thêm bút toán mới |
| **Sổ Cái TK 111** | General Ledger - Cash | ✅ Ghi Có 1.000.000đ |
| **Sổ Cái TK 642** | General Ledger - Admin Expenses | ✅ Ghi Nợ 1.000.000đ |
| **Sổ Quỹ Tiền mặt** | Cash Book | ✅ Ghi phiếu chi mới |
| **Số dư TK** | Account Balances | ✅ Tính lại số dư |

### 2.3 Ví Dụ: Sổ Cái TK 111 Sau Khi Ghi Sổ

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SỔ CÁI TÀI KHOẢN 111 - TIỀN MẶT                                         │
│ Từ 01/04/2026 đến 30/04/2026                                            │
├──────────┬──────────────┬────────────┬───────────┬──────────┬───────────┤
│ Ngày     │ Chứng từ     │ Diễn giải  │ TK đối ứng│ Nợ       │ Có        │
├──────────┼──────────────┼────────────┼───────────┼──────────┼───────────┤
│          │              │ Số dư đầu kỳ│          │          │50.000.000 │
├──────────┼──────────────┼────────────┼───────────┼──────────┼───────────┤
│02/04/2026│ PC-2026-00001│Mua VPP     │ 642       │          │ 1.000.000 │
│03/04/2026│ PT-2026-00005│Thu tiền KH │ 131       │5.000.000 │           │
│05/04/2026│ PC-2026-00002│Thanh toán NCC│ 331     │          │ 3.000.000 │
├──────────┴──────────────┴────────────┴───────────┼──────────┼───────────┤
│                                     Cộng phát sinh│5.000.000 │ 4.000.000 │
│                                       Số dư cuối kỳ│         │51.000.000 │
└──────────────────────────────────────────────────┴──────────┴───────────┘
```

### 2.4 Ví Dụ: Sổ Quỹ Tiền Mặt

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SỔ QUỸ TIỀN MẶT - THÁNG 04/2026                                             │
├──────────┬──────────────┬──────────────────┬──────────┬──────────┬──────────┤
│ Ngày     │ Số chứng từ  │ Diễn giải        │ Thu      │ Chi      │ Tồn quỹ  │
├──────────┼──────────────┼──────────────────┼──────────┼──────────┼──────────┤
│01/04/2026│              │ Tồn đầu kỳ       │          │          │50.000.000│
│02/04/2026│ PC-2026-00001│ Mua VPP          │          │1.000.000 │49.000.000│
│03/04/2026│ PT-2026-00005│ Thu tiền KH Công │5.000.000 │          │54.000.000│
│          │              │ ty ABC           │          │          │          │
│05/04/2026│ PC-2026-00002│ Thanh toán NCC   │          │3.000.000 │51.000.000│
├──────────┴──────────────┴──────────────────┼──────────┼──────────┼──────────┤
│                              Cộng phát sinh │5.000.000 │4.000.000 │          │
│                                Tồn cuối kỳ  │          │          │51.000.000│
└─────────────────────────────────────────────┴──────────┴──────────┴──────────┘
```

---

## Bước 3: Tự Động Tính Báo Cáo Tài Chính

Báo cáo tài chính được tính **real-time** dựa trên số dư các tài khoản.

### 3.1 Bảng Cân Đối Kế Toán (B01-DN)

Dựa trên số dư cuối kỳ của các tài khoản:

```
                    BẢNG CÂN ĐỐI KẾ TOÁN
                    Mẫu số B01-DN
                    Ngày 30/04/2026

┌──────────────────────────────────────┬───────────────┬───────────────┐
│ CHỈ TIÊU                             │ Cuối kỳ       │ Đầu năm       │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ A. TÀI SẢN NGẮN HẠN                  │ 151.000.000   │ 150.000.000   │
│   I. Tiền và các khoản tương đương   │  51.000.000   │  50.000.000   │
│      - TK 111: Tiền mặt             │  51.000.000 ◀─┼── Từ sổ cái   │
│      - TK 112: Tiền gửi ngân hàng   │           0   │               │
│   II. Các khoản phải thu             │ 100.000.000   │ 100.000.000   │
│      - TK 131: Phải thu khách hàng  │ 100.000.000   │               │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ B. TÀI SẢN DÀI HẠN                   │ 200.000.000   │ 200.000.000   │
│   - TK 211: Tài sản cố định         │ 200.000.000   │               │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ TỔNG TÀI SẢN                         │ 351.000.000   │ 350.000.000   │
├══════════════════════════════════════╪═══════════════╪═══════════════┤
│ C. NỢ PHẢI TRẢ                       │  50.000.000   │  50.000.000   │
│   - TK 331: Phải trả người bán      │  50.000.000   │               │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ D. VỐN CHỦ SỞ HỮU                    │ 301.000.000   │ 300.000.000   │
│   - TK 411: Vốn góp                 │ 300.000.000   │               │
│   - TK 421: Lợi nhuận chưa phân phối│   1.000.000 ◀─┼── Từ BCKQKD   │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ TỔNG NGUỒN VỐN                       │ 351.000.000   │ 350.000.000   │
└──────────────────────────────────────┴───────────────┴───────────────┘
```

### 3.2 Báo Cáo Kết Quả Kinh Doanh (B02-DN)

Dựa trên số phát sinh của các tài khoản doanh thu/chi phí:

```
                BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH
                Mẫu số B02-DN
                Quý I/2026

┌──────────────────────────────────────┬───────────────┬───────────────┐
│ CHỈ TIÊU                             │ Quý này       │ Lũy kế        │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ 1. Doanh thu bán hàng (TK 511)       │  50.000.000   │  50.000.000   │
│ 2. Các khoản giảm trừ DT (TK 521)    │           0   │           0   │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ 3. Doanh thu thuần (1-2)             │  50.000.000   │  50.000.000   │
│ 4. Giá vốn hàng bán (TK 632)         │  30.000.000   │  30.000.000   │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ 5. Lợi nhuận gộp (3-4)               │  20.000.000   │  20.000.000   │
│ 6. Chi phí bán hàng (TK 641)         │   5.000.000   │   5.000.000   │
│ 7. Chi phí QLDN (TK 642)             │  10.000.000 ◀─┼── Bao gồm     │
│    (gồm 1.000.000đ mua VPP)          │               │   bút toán    │
│                                      │               │   PC-2026-001 │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ 8. Lợi nhuận từ HĐKD (5-6-7)         │   5.000.000   │   5.000.000   │
│ 9. Thu nhập khác (TK 711)            │   1.000.000   │   1.000.000   │
│ 10. Chi phí khác (TK 811)            │           0   │           0   │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ 11. Lợi nhuận trước thuế             │   6.000.000   │   6.000.000   │
│ 12. Chi phí thuế TNDN (20%)          │   1.200.000   │   1.200.000   │
├──────────────────────────────────────┼───────────────┼───────────────┤
│ 13. Lợi nhuận sau thuế               │   4.800.000   │   4.800.000   │
└──────────────────────────────────────┴───────────────┴───────────────┘
```

### 3.3 Báo Cáo Lưu Chuyển Tiền Tệ (B03-DN)

```
              BÁO CÁO LƯU CHUYỂN TIỀN TỆ (Phương pháp trực tiếp)
              Mẫu số B03-DN - Quý I/2026

┌──────────────────────────────────────────────────┬───────────────┐
│ CHỈ TIÊU                                         │ Số tiền       │
├──────────────────────────────────────────────────┼───────────────┤
│ I. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG KINH DOANH       │               │
│   1. Tiền thu từ bán hàng, cung cấp dịch vụ      │  45.000.000   │
│   2. Tiền chi trả cho người cung cấp hàng hóa    │ (25.000.000)  │
│   3. Tiền chi trả cho người lao động             │ (10.000.000)  │
│   4. Tiền chi nộp thuế TNDN                      │  (1.000.000)  │
│   5. Tiền chi khác cho hoạt động KD              │  (1.000.000)◀─┼── PC-2026-001
├──────────────────────────────────────────────────┼───────────────┤
│   Lưu chuyển thuần từ HĐKD                       │   8.000.000   │
├──────────────────────────────────────────────────┼───────────────┤
│ II. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG ĐẦU TƯ          │           0   │
├──────────────────────────────────────────────────┼───────────────┤
│ III. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG TÀI CHÍNH      │           0   │
├──────────────────────────────────────────────────┼───────────────┤
│ Lưu chuyển tiền thuần trong kỳ                   │   8.000.000   │
│ Tiền và tương đương tiền đầu kỳ                  │  43.000.000   │
│ Tiền và tương đương tiền cuối kỳ                 │  51.000.000 ◀─┼── = TK111+TK112
└──────────────────────────────────────────────────┴───────────────┘
```

---

## Tóm Tắt: Dữ Liệu Chảy Tự Động

```
  ┌──────────────┐
  │ NHẬP PHIẾU   │          DATABASE TABLES
  │ THU/CHI      │    ┌─────────────────────────┐
  │              │───▸│ vouchers                │
  └──────────────┘    │ - id, voucherType       │
         │            │ - voucherNumber         │
         │            │ - date, counterparty    │
         │            │ - status: DRAFT/POSTED  │
         │            │ - totalAmount           │
         │            │ - currency, exchange    │
         │            │ - lines (trong body req)│
         │            └───────────┬─────────────┘
         │                        │
         │ [GHI SỔ]               │ on POST
         │                        ▼
         │            ┌─────────────────────────┐
         └───────────▸│ journal_entries         │
                      │ - entryNumber           │
                      │ - postingDate           │
                      │ - status: POSTED        │
                      │ - totalDebit/Credit     │
                      └───────────┬─────────────┘
                                  │
                      ┌───────────┼───────────┐
                      ▼           ▼           ▼
              ┌───────────┐ ┌───────────┐ ┌───────────┐
              │journal_   │ │journal_   │ │journal_   │
              │entry_     │ │entry_     │ │entry_     │
              │lines      │ │lines      │ │lines      │
              │TK 111     │ │TK 642     │ │TK xxx     │
              │Credit 1M  │ │Debit 1M   │ │...        │
              └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
                    │             │             │
                    └─────────────┼─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │ Query động để tính        │
                    │ số dư tài khoản           │
                    │ (không có bảng pre-calc)  │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                          ┌───────────────┐
                          │ BÁO CÁO TC    │
                          │ (Query real-  │
                          │  time từ      │
                          │  journal_     │
                          │  entry_lines) │
                          │               │
                          │ • B01-DN ✓    │
                          │ • B02-DN ✓    │
                          │ • B03-DN ✓    │
                          └───────────────┘
```

**Lưu ý quan trọng:**
- Dòng bút toán (lines) được truyền trong request body khi tạo voucher
- Khi POST voucher, hệ thống tự động tạo journal_entry và journal_entry_lines
- Không có bảng account_balances - số dư được tính động từ journal_entry_lines
- Báo cáo tài chính query trực tiếp từ journal_entry_lines và tính toán real-time

---

## API Endpoints

### Vouchers
```
POST   /api/vouchers                  # Tạo phiếu mới (DRAFT)
GET    /api/vouchers                  # Danh sách phiếu
       ?voucherType=PT                # Lọc theo loại
       &status=POSTED                 # Lọc theo trạng thái
       &startDate=2026-04-01          # Lọc từ ngày
       &endDate=2026-04-30            # Lọc đến ngày
       &counterpartyName=ABC          # Tìm theo tên đối tượng
       &page=1&limit=20               # Phân trang

GET    /api/vouchers/:id              # Chi tiết phiếu
POST   /api/vouchers/:id/post         # Ghi sổ (DRAFT → POSTED)
POST   /api/vouchers/batch-post       # Ghi sổ nhiều phiếu cùng lúc
       Body: { ids: ["id1", "id2"] }
POST   /api/vouchers/:id/void         # Hủy phiếu (tạo bút toán đảo)
```

### Accounting Books (Sổ sách)
```
GET /api/accounting-books/general-journal    # Sổ nhật ký chung
    ?startDate=2026-04-01&endDate=2026-04-30
    
GET /api/accounting-books/general-ledger     # Sổ cái
    ?accountId={accountId}&startDate=2026-04-01&endDate=2026-04-30
    
GET /api/accounting-books/cash-book          # Sổ quỹ tiền mặt (TK 111)
    ?startDate=2026-04-01&endDate=2026-04-30
    
GET /api/accounting-books/bank-book          # Sổ tiền gửi NH (TK 112)
    ?startDate=2026-04-01&endDate=2026-04-30
    &subAccountId={accountId}                # Optional: lọc theo tiểu khoản

GET /api/accounting-books/customer-ledger    # Sổ công nợ khách hàng
    ?customerId={id}&startDate=2026-04-01&endDate=2026-04-30
    
GET /api/accounting-books/vendor-ledger      # Sổ công nợ nhà cung cấp
    ?vendorId={id}&startDate=2026-04-01&endDate=2026-04-30
```

### Financial Reports (Báo cáo)
```
GET /api/financial-reports/balance-sheet     # B01-DN (Bảng Cân Đối Kế Toán)
    ?asOfDate=2026-04-30
    &comparePriorPeriod=true                 # So sánh với kỳ trước
    
GET /api/financial-reports/income-statement  # B02-DN (Báo Cáo Kết Quả KD)
    ?startDate=2026-04-01&endDate=2026-04-30
    &comparePriorPeriod=true
    
GET /api/financial-reports/cash-flow         # B03-DN (Báo Cáo Lưu Chuyển Tiền)
    ?startDate=2026-04-01&endDate=2026-04-30
    &method=direct                           # hoặc 'indirect'

GET /api/financial-reports/notes             # Thuyết minh BCTC
    ?fiscalYearId={id}
    
GET /api/financial-reports/depreciation      # Báo cáo khấu hao TSCĐ
    ?startDate=2026-04-01&endDate=2026-04-30
    
GET /api/financial-reports/annual-package    # Bộ BCTC năm đầy đủ
    ?fiscalYearId={id}
    
GET /api/financial-reports/aging             # Báo cáo tuổi nợ
    ?asOfDate=2026-04-30&type=receivable     # hoặc 'payable'
```

### Chart of Accounts (Hệ thống TK)
```
GET    /api/chart-of-accounts         # Danh sách tài khoản
       ?accountType=ASSET              # Lọc theo loại
       &isActive=true                  # Chỉ tài khoản đang hoạt động
       &level=1                        # Lọc theo cấp

GET    /api/chart-of-accounts/tree    # Cây tài khoản phân cấp

GET    /api/chart-of-accounts/search  # Tìm kiếm tài khoản
       ?q=111                          # Tìm theo mã hoặc tên

GET    /api/chart-of-accounts/:id     # Chi tiết tài khoản

POST   /api/chart-of-accounts         # Tạo tài khoản mới (ADMIN/ACCOUNTANT)
PATCH  /api/chart-of-accounts/:id     # Cập nhật tài khoản
DELETE /api/chart-of-accounts/:id     # Xóa tài khoản (nếu chưa sử dụng)
```

---

## Ví Dụ Hoàn Chỉnh: Luồng API Calls

### Bước 1: Đăng nhập và lấy thông tin công ty

```bash
# 1. Đăng nhập
POST /api/auth/login
Body: {
  "email": "accountant@company.com",
  "password": "password123"
}

Response: {
  "accessToken": "eyJhbGc...",
  "user": { "id": "user_uuid", "name": "Accountant" }
}

# 2. Lấy danh sách công ty của user
GET /api/companies
Headers: { "Authorization": "Bearer eyJhbGc..." }

Response: [
  { "id": "company_uuid", "name": "Công ty ABC", ... }
]

# 3. Set companyId vào context (localStorage hoặc state)
# Mọi request sau này cần header: X-Company-Id: company_uuid
```

### Bước 2: Lấy năm tài chính và tài khoản

```bash
# 1. Lấy năm tài chính đang mở
GET /api/fiscal-years?status=OPEN
Headers: {
  "Authorization": "Bearer {token}",
  "X-Company-Id": "company_uuid"
}

Response: [
  {
    "id": "fiscal_year_uuid",
    "name": "2026",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "status": "OPEN"
  }
]

# 2. Tìm tài khoản 642 (Chi phí QLDN)
GET /api/chart-of-accounts/search?q=642
Response: [
  {
    "id": "account_642_uuid",
    "code": "642",
    "name": "Chi phí quản lý doanh nghiệp",
    "accountType": "EXPENSE"
  }
]

# 3. Tìm tài khoản 111 (Tiền mặt)
GET /api/chart-of-accounts/search?q=111
Response: [
  {
    "id": "account_111_uuid",
    "code": "111",
    "name": "Tiền mặt",
    "accountType": "ASSET"
  }
]
```

### Bước 3: Tạo và ghi sổ phiếu chi

```bash
# 1. Tạo phiếu chi (DRAFT)
POST /api/vouchers
Headers: {
  "Authorization": "Bearer {token}",
  "X-Company-Id": "company_uuid"
}
Body: {
  "voucherType": "PC",
  "date": "2026-04-02",
  "counterpartyName": "Công ty Văn phòng phẩm A",
  "partyFullName": "Nguyễn Văn A",
  "partyAddress": "123 Đường ABC, Q1, TPHCM",
  "partyIdNumber": "079123456789",
  "description": "Chi tiền mua văn phòng phẩm",
  "totalAmount": 1000000,
  "amountInWords": "Một triệu đồng chẵn",
  "attachmentCount": 2,
  "originalDocRefs": "Hóa đơn GTGT số 001234",
  "currency": "VND",
  "fiscalYearId": "fiscal_year_uuid",
  "lines": [
    {
      "accountId": "account_642_uuid",
      "description": "Mua giấy in, bút",
      "debitAmount": 1000000,
      "creditAmount": 0
    },
    {
      "accountId": "account_111_uuid",
      "description": "Xuất quỹ tiền mặt",
      "debitAmount": 0,
      "creditAmount": 1000000
    }
  ]
}

Response: {
  "id": "voucher_uuid",
  "voucherNumber": "PC-2026-00001",
  "status": "DRAFT",
  ...
}

# 2. Ghi sổ phiếu (DRAFT → POSTED)
POST /api/vouchers/voucher_uuid/post
Headers: { same as above }

Response: {
  "id": "voucher_uuid",
  "status": "POSTED",
  "journalEntryId": "journal_entry_uuid",
  "postedAt": "2026-04-02T10:30:00Z"
}
```

### Bước 4: Xem sổ sách và báo cáo

```bash
# 1. Xem sổ quỹ tiền mặt
GET /api/accounting-books/cash-book?startDate=2026-04-01&endDate=2026-04-30

Response: {
  "entries": [
    {
      "date": "2026-04-02",
      "voucherNumber": "PC-2026-00001",
      "description": "Chi tiền mua văn phòng phẩm",
      "receipt": 0,
      "payment": 1000000,
      "balance": 49000000
    }
  ],
  "openingBalance": 50000000,
  "closingBalance": 49000000
}

# 2. Xem sổ cái TK 111
GET /api/accounting-books/general-ledger?accountId=account_111_uuid&startDate=2026-04-01&endDate=2026-04-30

# 3. Xem báo cáo Cân Đối Kế Toán
GET /api/financial-reports/balance-sheet?asOfDate=2026-04-30

# 4. Xem báo cáo Kết Quả Kinh Doanh
GET /api/financial-reports/income-statement?startDate=2026-04-01&endDate=2026-04-30
```

---

## Lỗi Thường Gặp

### 1. Lỗi 403 "Missing authentication or company"

**Nguyên nhân:** Token hoặc companyId chưa được truyền trong request.

**Giải pháp:**
- Đảm bảo đã đăng nhập
- Kiểm tra localStorage có `accessToken` và `companyId`
- Header phải có: `Authorization: Bearer {token}` và `X-Company-Id: {companyId}`
- Refresh trang sau khi đăng nhập

### 2. Lỗi "Cần ít nhất 1 dòng bút toán hợp lệ"

**Nguyên nhân:** 
- `accountId` chưa được set (user gõ mã TK nhưng không chọn từ dropdown)
- Truyền mã tài khoản (ví dụ: "111") thay vì UUID

**Giải pháp:**
- Phải click chọn tài khoản từ dropdown suggestions
- Gọi `/api/chart-of-accounts/search?q={query}` để lấy accountId (UUID)
- Truyền UUID vào request body, không phải mã tài khoản

### 3. Lỗi "Nợ Có không cân"

**Nguyên nhân:** Tổng debitAmount ≠ Tổng creditAmount.

**Giải pháp:** 
- Kiểm tra lại số tiền các dòng bút toán
- Mỗi dòng phải có hoặc debitAmount hoặc creditAmount (không phải cả hai)
- Sử dụng UI feedback để hiển thị chênh lệch real-time

### 4. Lỗi "Năm tài chính không tồn tại" hoặc "Năm tài chính đã đóng"

**Nguyên nhân:** `fiscalYearId` không hợp lệ hoặc năm tài chính đã đóng.

**Giải pháp:**
- Kiểm tra năm tài chính đang hoạt động (status = OPEN)
- Gọi API fiscal year để lấy năm tài chính hiện tại
- Không cho phép ghi sổ vào năm tài chính đã đóng

### 5. Lỗi "Không thể sửa phiếu đã ghi sổ"

**Nguyên nhân:** Cố gắng PATCH voucher ở trạng thái POSTED.

**Giải pháp:**
- Chỉ voucher DRAFT mới có thể chỉnh sửa
- Với voucher POSTED, sử dụng POST `/api/vouchers/:id/void` để hủy và tạo phiếu mới

### 6. Báo cáo trả về 0đ mặc dù sổ sách có data

**Nguyên nhân:** Một trong các lý do sau:
1. **Voucher chưa POST:** Chỉ voucher POSTED mới được tính vào báo cáo
2. **Date range không khớp:** Period trong reports page không khớp với ngày voucher
3. **Default period sai:** Reports page mặc định dùng năm trước, nhưng data ở năm hiện tại

**Giải pháp:**
1. **Kiểm tra status voucher:**
   - Vào trang Vouchers, xem badge màu xanh "Đã ghi sổ"
   - Nếu còn màu vàng "Nháp", cần click "Ghi sổ"

2. **Kiểm tra period trong reports:**
   - Ở góc phải reports page có input "Kỳ báo cáo"
   - Đảm bảo nhập đúng năm có data (ví dụ: 2026 nếu data ở 2026)
   - Default là năm hiện tại (current year)

3. **Verify trong database (nếu cần):**
   ```sql
   -- Check vouchers đã POST chưa
   SELECT voucher_number, status, date 
   FROM vouchers 
   WHERE company_id = 'your-company-id';
   
   -- Check journal entries
   SELECT entry_number, status, posting_date, total_debit
   FROM journal_entries
   WHERE company_id = 'your-company-id' AND status = 'POSTED';
   
   -- Check account balances có data không
   SELECT a.code, a.name, SUM(l.debit_amount) as debit, SUM(l.credit_amount) as credit
   FROM journal_entry_lines l
   JOIN ledger_accounts a ON l.account_id = a.id
   JOIN journal_entries j ON l.journal_entry_id = j.id
   WHERE j.company_id = 'your-company-id' AND j.status = 'POSTED'
   GROUP BY a.code, a.name;
   ```

**Expected flow:**
```
Tạo voucher (DRAFT) 
→ Ghi sổ (POST) 
→ Tạo journal_entry (POSTED)
→ Báo cáo query journal_entry_lines với status = POSTED
→ Hiển thị số liệu
```

---

## Audit Trail (Vết Kiểm Toán)

Mọi thao tác quan trọng đều được ghi lại trong `audit_logs`:

- **CREATE** - Tạo voucher, journal entry, account
- **UPDATE** - Sửa thông tin
- **DELETE** - Xóa entity
- **POST** - Ghi sổ voucher
- **VOID** - Hủy bỏ voucher
- **LOCK** - Khóa kỳ kế toán
- **UNLOCKHiển thị tổng số tiền và số tiền bằng chữ:**
    - [ ] "Tổng số tiền" - read-only input hiển thị formatVND(totalDebit)
    - [ ] "Số tiền bằng chữ" - read-only input hiển thị auto-translation
    - [ ] Tự động update cả 2 fields khi user thay đổi journal lines
  - [ ] **Collapsible section "Thông tin pháp lý"**
    - [ ] Click header để expand/collapse section
    - [ ] Icon chevron để chỉ trạng thái mở/đóng
    - [ ] Họ tên người nộp/nhận tiền (auto-fill từ counterparty)
    - [ ] Label động: "người nộp tiền" cho PT, "người nhận tiền" cho PC
    - [ ] Địa chỉ
    - [ ] CMND/CCCD
    - [ ] Override số tiền bằng chữ với checkbox "Chỉnh sửa" để manual mode
    - [ ] Disabled/read-only khi auto mode, editable khi manual mode
    - [ ] Dropdown loại tiền (VND, USD, EUR, JPY, CNY)
    - [ ] Conditional rendering: show foreign currency fields khi currency ≠ VND
    - [ ] Auto-calculate VND amount = originalAmount × exchangeRate
    - [ ] Display calculated VND in read-only input
    - [ ] Quyển số
    - [ ] Số chứng từ gốc kèm theo (number input)
    - [ ] Mô tả chứng từ gốc (text input)
  - [ ] Bảng nhập bút toán với autocomplete tài khoản
  - [ ] Tính tổng Nợ/Có real-time
  - [ ] Hiển thị chênh lệch và validate cân bằng
  - [ ] Button "Lưu nháp" và "Ghi sổ"
  - [ ] useEffect hooks để sync counterpartyName → partyFullName, totalDebit → amountInWords
  - [ ] Lưu accessToken vào localStorage hoặc httpOnly cookie
  - [ ] Interceptor để attach token vào mọi request
  - [ ] Refresh token mechanism (nếu có)
  - [ ] Logout và clear tokenvới màu: DRAFT (vàng), POSTED (xanh), VOIDED (đỏ)
  - [ ] Bulk operations: Select multiple + Batch Post

- [ ] **Voucher Detail Page**
  - [ ] Hiển thị đầy đủ thông tin voucher
  - [ ] Section riêng cho "Thông tin pháp lý" nếu có data:
    - [ ] partyFullName, partyAddress, partyIdNumber
    - [ ] amountInWords, voucherBookNo
    - [ ] currency, originalAmount, exchangeRate (nếu ≠ VND)
    - [ ] attachmentCount, originalDocRefs
  - [ ] Section bút toán (journal lines) với table
  - [ ] Conditional actions dựa vào status:
    - [ ] DRAFT: Show Edit + Post buttons
    - [ ] POSTED: Show Void button only
    - [ ] VOIDED: Show no actions

- [ ] **Company Selection**
  - [ ] Component để chọn công ty (nếu user có nhiều công ty)
  - [ ] Lưu companyId vào context/state
  - [ ] Attach X-Company-Id vào mọi API request

- [ ] **Fiscal Year**
  - [ ] Fetch và hiển thị năm tài chính hiện tại
  - [ ] Cảnh báo nếu năm tài chính đã đóng
  - [ ] Component chọn năm tài chính (cho báo cáo)

- [ ] **Chart of Accounts**
  - [ ] Autocomplete input cho tài khoản
  - [ ] Gọi `/api/chart-of-accounts/search?q={query}`
  - [ ] Hiển thị code + name (ví dụ: "111 - Tiền mặt")
  - [ ] Lưu accountId (UUID) khi user chọn

- [ ] **Voucher Form**
  - [ ] Dropdown chọn loại phiếu (PT, PC, BDN, BCN, BT)
  - [ ] Date picker cho ngày chứng từ
  - [ ] Input cho đối tượng (counterparty)
  - [ ] **Collapsible section "Thông tin pháp lý"**
    - [ ] Click header để expand/collapse section
    - [ ] Icon chevron để chỉ trạng thái mở/đóng
    - [ ] Họ tên người nộp/nhận tiền (auto-fill từ counterparty)
    - [ ] Label động: "người nộp tiền" cho PT, "người nhận tiền" cho PC
    - [ ] Địa chỉ
    - [ ] CMND/CCCD
    - [ ] Số tiền bằng chữ với checkbox "Nhập thủ công" để override auto-gen
    - [ ] Disabled/read-only khi auto mode, editable khi manual mode
    - [ ] Dropdown loại tiền (VND, USD, EUR, JPY, CNY)
    - [ ] Conditional rendering: show foreign currency fields khi currency ≠ VND
    - [ ] Auto-calculate VND amount = originalAmount × exchangeRate
    - [ ] Display calculated VND in read-only input
    - [ ] Quyển số
    - [ ] Số chứng từ gốc kèm theo (number input)
    - [ ] Mô tả chứng từ gốc (text input)
  - [ ] Bảng nhập bút toán với autocomplete tài khoản
  - [ ] Tính tổng Nợ/Có real-time
  - [ ] Hiển thị chênh lệch và validate cân bằng
  - [ ] Button "Lưu nháp" và "Ghi sổ"
  - [ ] Auto-generate số tiền bằng chữ khi totalAmount thay đổi
  - [ ] useEffect hooks để sync counterpartyName → partyFullName

- [ ] **Voucher List**
  - [ ] Table hiển thị danh sách voucher
  - [ ] Filter theo loại, trạng thái, ngày, đối tượng
  - [ ] Pagination
  - [ ] Action buttons: View, Edit (nếu DRAFT), Post, Void
  - [ ] Badge hiển thị status (DRAFT/POSTED/VOIDED)

- [ ] **Accounting Books**
  - [ ] Sổ nhật ký chung (General Journal)
  - [ ] Sổ cái (General Ledger) - có filter tài khoản
  - [ ] Sổ quỹ tiền mặt (Cash Book)
  - [ ] Sổ tiền gửi ngân hàng (Bank Book)
  - [ ] Date range picker cho mọi sổ sách

- [ ] **Financial Reports**
  - [ ] Bảng Cân Đối Kế Toán (B01-DN)
  - [ ] Báo Cáo Kết Quả Kinh Doanh (B02-DN)
  - [ ] Báo Cáo Lưu Chuyển Tiền Tệ (B03-DN)
  - [ ] Date range picker
  - [ ] Option so sánh với kỳ trước
  - [ ] Export PDF/Excel (nếu có API support)

- [ ] **Error Handling**
  - [ ] Toast notification cho success/error
  - [ ] Validation errors hiển thị trên form
  - [ ] 401 Unauthorized → redirect to login
  - [ ] 403 Forbidden → hiển thị "Không có quyền"
  - [ ] Network errors → retry mechanism

- [ ] **Loading States**
  - [ ] Skeleton loader cho tables
  - [ ] Spinner khi submit form
  - [ ] Disable buttons khi đang process

---

## Kết Luận

Hệ thống kế toán Amounzer hoạt động theo luồng:

1. **Nhập liệu** → Tạo phiếu thu/chi với bút toán Nợ/Có
2. **Ghi sổ** → Tự động tạo journal entry và cập nhật sổ cái  
3. **Báo cáo** → Query số dư tài khoản để tính BCTC real-time

**Điểm mạnh:**
- Không cần thao tác thủ công để đồng bộ sổ sách hay báo cáo
- Tất cả được cập nhật tự động khi ghi sổ chứng từ
- Audit trail đầy đủ cho mọi thao tác
- RESTful API rõ ràng, dễ tích hợp

**Lưu ý quan trọng:**
- Luôn truyền `Authorization` và `X-Company-Id` headers
- Sử dụng UUID cho accountId, không phải mã tài khoản
- Validate Nợ/Có cân bằng trước khi submit
- Voucher POSTED không thể sửa, chỉ có thể VOID
