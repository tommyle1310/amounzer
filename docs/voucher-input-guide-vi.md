# Hướng dẫn nhập Chứng từ - Nhật Ký Chung (General Journal Entry Guide)

## 📚 Giải thích cơ bản về Kế toán

### Nguyên tắc Ghi sổ kép (Double-Entry Bookkeeping)
Mỗi giao dịch kế toán đều phải có:
- **Nợ (Debit)**: Bên trái trong sổ kế toán
- **Có (Credit)**: Bên phải trong sổ kế toán
- **Quy tắc vàng**: Tổng Nợ = Tổng Có (phải CÂN BẰNG)

### Các loại Tài khoản phổ biến

| Mã TK | Tên | Loại | Tăng bên |
|-------|-----|------|----------|
| 111 | Tiền mặt | Tài sản | Nợ |
| 112 | Tiền gửi ngân hàng | Tài sản | Nợ |
| 131 | Phải thu khách hàng | Tài sản | Nợ |
| 133 | Thuế GTGT được khấu trừ | Tài sản | Nợ |
| 156 | Hàng hóa | Tài sản | Nợ |
| 331 | Phải trả người bán | Nợ phải trả | Có |
| 333 | Thuế phải nộp | Nợ phải trả | Có |
| 3338 | Thuế môn bài phải nộp | Nợ phải trả | Có |
| 334 | Phải trả người lao động | Nợ phải trả | Có |
| 511 | Doanh thu bán hàng | Doanh thu | Có |
| 642 | Chi phí quản lý doanh nghiệp | Chi phí | Nợ |

### Quy tắc ghi Nợ/Có

| Loại tài khoản | Tăng | Giảm |
|----------------|------|------|
| Tài sản (1xx) | Nợ | Có |
| Nợ phải trả (3xx) | Có | Nợ |
| Vốn chủ sở hữu (4xx) | Có | Nợ |
| Doanh thu (5xx, 7xx) | Có | Nợ |
| Chi phí (6xx, 8xx) | Nợ | Có |

---

## 🎯 Cách nhập dữ liệu từ Nhật Ký Chung vào hệ thống

### Bước 1: Xác định loại chứng từ

Từ hình ảnh Nhật Ký Chung, mỗi dòng là một bút toán. Bạn cần chọn loại chứng từ phù hợp:

| Loại | Code | Khi nào dùng |
|------|------|--------------|
| Phiếu thu | PT | Thu tiền mặt (TK 111 bên Nợ) |
| Phiếu chi | PC | Chi tiền mặt (TK 111 bên Có) |
| Giấy báo nợ | BDN | Ngân hàng báo trừ tiền (TK 112 bên Có) |
| Giấy báo có | BCN | Ngân hàng báo nhận tiền (TK 112 bên Nợ) |
| Chứng từ ghi sổ | CTGS | Các bút toán khác không liên quan tiền |

### Bước 2: Đọc hiểu cột trong Nhật Ký Chung

```
| Hóa đơn |         |               |            |                          | Tiểu khoản |        |           |
|  Số     |  Ngày   | Khách hàng    | Mã số thuế | Nội dung                 |  Nợ  |  Có  | Số tiền   |
|---------|---------|---------------|------------|--------------------------|------|------|-----------|
|         | 01/01/25| Kho bạc...    |            | Nộp thuế môn bài 2025    | 3338 | 111  | 2,000,000 |
```

- **Số hóa đơn**: Số chứng từ gốc (để tham chiếu)
- **Ngày**: Ngày phát sinh giao dịch
- **Khách hàng**: Đối tượng giao dịch
- **Mã số thuế**: MST của đối tượng
- **Nội dung**: Diễn giải
- **Nợ/Có**: Tài khoản ghi Nợ và ghi Có
- **Số tiền**: Giá trị giao dịch

---

## 📝 Ví dụ nhập các giao dịch từ hình ảnh

### Ví dụ 1: Nộp thuế môn bài - *Dòng 1 trong hình*
```
Ngày: 01/01/2025
Nội dung: Nộp thuế môn bài năm 2025
Nợ TK 3338: 2,000,000
Có TK 111: 2,000,000
```

**Cách nhập vào hệ thống:**
1. Vào trang `/vouchers/new`
2. Chọn loại chứng từ: **PC (Phiếu chi)** (vì chi tiền mặt - TK 111 bên Có)
3. Ngày: `01/01/2025`
4. Đối tượng: `Kho bạc nhà nước Tân Bình`
5. Nội dung: `Nộp thuế môn bài năm 2025`
6. Bút toán:
   - Dòng 1: Tài khoản `3338` | Nợ: `2,000,000` | Có: `0`
   - Dòng 2: Tài khoản `111` | Nợ: `0` | Có: `2,000,000`

---

### Ví dụ 2: Mua văn phòng phẩm - *Dòng 2*
```
Ngày: 02/01/2025
Khách hàng: Nhà sách Sao Mai
Nội dung: Mua văn phòng phẩm
Nợ TK 642: 1,100,000
Có TK 111: 1,100,000
```

**Cách nhập:**
1. Loại chứng từ: **PC (Phiếu chi)**
2. Ngày: `02/01/2025`
3. Đối tượng: `Nhà sách Sao Mai` (có thể tạo mới nếu chưa có)
4. Nội dung: `Mua văn phòng phẩm`
5. Bút toán:
   - TK `642` | Nợ: `1,100,000`
   - TK `111` | Có: `1,100,000`

---

### Ví dụ 3: Mua hàng hóa có VAT - *Dòng 11 & 11*
Thường giao dịch mua hàng có 2 bút toán đi kèm:

**Bút toán 1: Ghi nhận hàng mua**
```
Ngày: 04/01/2025
Số HĐ: 11
Khách hàng: Cty TNHH TM DV Điện Cơ Ngọc Sam (MST: 0316751806)
Nội dung: Đây led
Nợ TK 156: 5,400,000
Có TK 111: 5,400,000
```

**Bút toán 2: Ghi nhận thuế GTGT được khấu trừ**
```
Ngày: 04/01/2025
Số HĐ: 11
Khách hàng: Cty TNHH TM DV Điện Cơ Ngọc Sam (MST: 0316751806)
Nội dung: Thuế GTGT được khấu trừ - Hóa đơn 11
Nợ TK 133: 540,000
Có TK 111: 540,000
```

**Cách nhập (kết hợp trong 1 chứng từ):**
1. Loại chứng từ: **PC (Phiếu chi)**
2. Ngày: `04/01/2025`
3. Đối tượng: Tìm/tạo `Cty TNHH TM DV Điện Cơ Ngọc Sam`
4. Nội dung: `Mua đây led - HĐ số 11`
5. Mở rộng **"Thông tin pháp lý"** > nhập **Tham chiếu chứng từ gốc**: `HĐ 11`
6. Bút toán:
   - TK `156` | Nợ: `5,400,000`
   - TK `133` | Nợ: `540,000`
   - TK `111` | Có: `5,940,000`

---

### Ví dụ 4: Doanh thu bán hàng - *Dòng có TK 131/511*
```
Ngày: 06/01/2025
Số HĐ: 1
Khách hàng: Cty TNHH Fabtek Việt Nam (MST: 3700754199)
Nội dung: Doanh thu bán hàng - Hóa đơn điện tử số 01
Nợ TK 131: 61,000,800
Có TK 511: 61,000,800
```

**Cách nhập:**
1. Loại chứng từ: **CTGS (Chứng từ ghi sổ)** - vì không liên quan tiền mặt
2. Hoặc dùng trang `/vouchers/ctgs` riêng
3. Đối tượng: Loại `Khách hàng` > tìm `Cty TNHH Fabtek Việt Nam`
4. Nội dung: `Doanh thu bán hàng - HĐĐT số 01`
5. Bút toán:
   - TK `131` | Nợ: `61,000,800`
   - TK `511` | Có: `61,000,800`

**Ghi nhận thuế GTGT phải nộp (cùng giao dịch):**
```
Nợ TK 131: 4,880,064
Có TK 333: 4,880,064
```

---

### Ví dụ 5: Mua hàng chưa thanh toán (ghi nợ nhà cung cấp)
```
Ngày: 06/01/2025
Số HĐ: 25
Khách hàng: Cty TNHH SX TM Thành Danh (MST: 3900491003)
Nội dung: Ron ống cửa kẽm nhỏ
Nợ TK 156: 9,350,000
Có TK 331: 9,350,000
```

**Cách nhập:**
1. Loại chứng từ: **CTGS** (không liên quan tiền)
2. Đối tượng: Loại `Nhà cung cấp` > `Cty TNHH SX TM Thành Danh`
3. Nội dung: `Mua ron ống cửa kẽm nhỏ - HĐ 25`
4. Bút toán:
   - TK `156` | Nợ: `9,350,000`
   - TK `331` | Có: `9,350,000`

---

### Ví dụ 6: Thu tiền bán hàng - *TK 111/131*
```
Ngày: 13/01/2025
Khách hàng: Cty TNHH Fabtek Việt Nam
Nội dung: Thu tiền bán hàng bằng tiền mặt
Nợ TK 111: 500,000
Có TK 131: 500,000
```

**Cách nhập:**
1. Loại chứng từ: **PT (Phiếu thu)** - thu tiền mặt
2. Đối tượng: `Cty TNHH Fabtek Việt Nam`
3. Nội dung: `Thu tiền bán hàng`
4. Bút toán:
   - TK `111` | Nợ: `500,000`
   - TK `131` | Có: `500,000`

---

### Ví dụ 7: Trả tiền mua hàng - *TK 331/111*
```
Ngày: 07/01/2025
Khách hàng: Cty TNHH SX TM Thành Danh
Nội dung: Trả tiền mua hàng cho Cty Thành Danh
Nợ TK 331: 3,000,000
Có TK 111: 3,000,000
```

**Cách nhập:**
1. Loại chứng từ: **PC (Phiếu chi)**
2. Đối tượng: `Cty TNHH SX TM Thành Danh`
3. Nội dung: `Trả tiền mua hàng cho Cty Thành Danh`
4. Bút toán:
   - TK `331` | Nợ: `3,000,000`
   - TK `111` | Có: `3,000,000`

---

### Ví dụ 8: Trả tiền qua ngân hàng - *TK 331/112*
```
Ngày: 11/01/2025
Khách hàng: Cty TNHH Fabtek Việt Nam
Nội dung: Cty Fabtek trả tiền mua hàng
Nợ TK 112: 10,000,000
Có TK 131: 10,000,000
```

**Cách nhập:**
1. Loại chứng từ: **BCN (Giấy báo có)** - ngân hàng báo tiền vào
2. Đối tượng: `Cty TNHH Fabtek Việt Nam`
3. Nội dung: `Nhận tiền bán hàng từ Cty Fabtek`
4. Bút toán:
   - TK `112` | Nợ: `10,000,000`
   - TK `131` | Có: `10,000,000`

---

### Ví dụ 9: Rút tiền gửi ngân hàng về nhập quỹ
```
Ngày: 18/01/2025
Nội dung: Rút tiền gửi ngân hàng về nhập quỹ tiền mặt
Nợ TK 111: 15,000,000
Có TK 112: 15,000,000
```

**Cách nhập:**
1. Loại chứng từ: **PT (Phiếu thu)** hoặc **BDN (Giấy báo nợ)**
2. Nội dung: `Rút tiền gửi ngân hàng về nhập quỹ`
3. Bút toán:
   - TK `111` | Nợ: `15,000,000`
   - TK `112` | Có: `15,000,000`

---

### Ví dụ 10: Nộp BHXH
```
Ngày: 28/01/2025
Khách hàng: BHXH Tân Bình
Nội dung: Nộp BHXH tháng 1
Nợ TK 3383 (hoặc 338): 12,394,000
Có TK 111: 12,394,000
```

---

### Ví dụ 11: Trả lương
```
Ngày: 29/01/2025
Nội dung: Trả lương tháng 1
Nợ TK 334: 30,000,000
Có TK 111: 30,000,000
```

---

## 🔍 Bảng tóm tắt - Xác định loại chứng từ

| Tài khoản Nợ | Tài khoản Có | Loại chứng từ | Ý nghĩa |
|--------------|--------------|---------------|---------|
| xxx | **111** | **PC** | Chi tiền mặt |
| **111** | xxx | **PT** | Thu tiền mặt |
| xxx | **112** | **BDN** | Ngân hàng trừ tiền |
| **112** | xxx | **BCN** | Ngân hàng cộng tiền |
| 131, 156, 133... | 331, 511... | **CTGS** | Không liên quan tiền |

---

## ⚠️ Lưu ý quan trọng

1. **LUÔN kiểm tra cân bằng**: Tổng Nợ = Tổng Có
2. **Năm tài chính**: Đảm bảo đã tạo năm tài chính 2025 trong Settings
3. **Hệ thống tài khoản**: Kiểm tra các tài khoản (111, 112, 131, 133, 156, 331, 333, 334, 511, 642...) đã có trong Chart of Accounts
4. **Đối tượng**: Tạo trước khách hàng/nhà cung cấp trong danh mục để có thể chọn
5. **Số hóa đơn**: Có thể nhập vào phần "Thông tin pháp lý" > "Tham chiếu chứng từ gốc"

---

## 🎓 Thuật ngữ kế toán

| Tiếng Việt | English | Giải thích |
|------------|---------|------------|
| Bút toán | Journal Entry | Một giao dịch kế toán |
| Định khoản | Double-entry | Ghi Nợ/Có |
| Tiểu khoản | Sub-account | Tài khoản chi tiết |
| Phải thu | Accounts Receivable | Tiền khách hàng nợ mình |
| Phải trả | Accounts Payable | Tiền mình nợ nhà cung cấp |
| GTGT | VAT | Thuế giá trị gia tăng |
| Khấu trừ | Deductible | Thuế được khấu trừ |
| Ghi sổ | Post | Xác nhận và ghi vào sổ cái |

---

## 📋 Checklist trước khi nhập dữ liệu

- [ ] Tạo năm tài chính 2025 (Settings > Fiscal Years)
- [ ] Import/tạo danh mục tài khoản (Chart of Accounts)
- [ ] Tạo danh sách khách hàng (Customers)
- [ ] Tạo danh sách nhà cung cấp (Vendors)
- [ ] Hiểu rõ nguyên tắc Nợ/Có cho từng loại tài khoản

---

*Tài liệu này dựa trên Thông tư 200/2014/TT-BTC và Thông tư 133/2016/TT-BTC*
