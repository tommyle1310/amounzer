# ACCOUNTING APP SPECIFICATION - Web Kế Toán Việt Nam (Standalone & Scalable)

**Phiên bản:** 1.0  
**Ngày:** 01/04/2026  
**Mục tiêu:** Xây dựng một ứng dụng web kế toán tổng quát, tuân thủ đầy đủ chuẩn kế toán Việt Nam (TT 200/2014/TT-BTC, TT 133/2016/TT-BTC, VAS), hỗ trợ double-entry bookkeeping, sinh đầy đủ sổ sách kế toán (Output 1) và báo cáo cực kỳ chi tiết (Output 2). Ứng dụng phải dễ scale, dễ tùy biến (custom fields, custom columns, dynamic reports).

**Phạm vi:** Dành cho doanh nghiệp vừa và nhỏ, công ty quản lý tài sản, chung cư, văn phòng… (không hard-code bất kỳ domain cụ thể nào).

## 1. Tổng quan kiến trúc

- **Multi-tenant**: Hỗ trợ nhiều công ty/doanh nghiệp riêng biệt (Company/Tenant isolation).
- **Scalable & Extensible**: Hỗ trợ custom fields trên hầu hết entity, dynamic report builder, dễ thêm module mới.
- **Core Engine**: Double-entry bookkeeping với hệ thống tài khoản VN linh hoạt.
- **Tech Stack gợi ý** (có thể thay đổi): Next.js 15 + NestJS + PostgreSQL + Prisma + TypeScript + Docker.
- **Ngôn ngữ**: Tiếng Việt chính + hỗ trợ tiếng Anh.

## 2. Data Model & Foundation (Core)

Hệ thống phải có các model chính sau:

- Company (Tenant)
- FiscalYear (hỗ trợ năm tài chính linh hoạt)
- LedgerAccount (hệ thống tài khoản VN - TK 111 đến TK 999, hỗ trợ sub-accounts)
- JournalEntry (bút toán kép, immutable sau khi post)
- AccountingTransaction (liên kết source document)
- Voucher (Phiếu thu PT, Phiếu chi PC, Giấy báo nợ, Giấy báo có…)
- Vendor / Customer
- FixedAsset + DepreciationSchedule
- InventoryItem + InventoryMovement
- PayrollRecord + SalarySlip
- VatRecord (VAT đầu vào/đầu ra)
- BadDebtProvision
- CustomField (cho phép user thêm cột tùy chỉnh trên bất kỳ entity nào)
- DynamicReportTemplate (JSON config cho báo cáo động)

**Yêu cầu quan trọng:**
- Tất cả transaction phải tuân thủ **double-entry** (debit = credit).
- Hỗ trợ **adjustment/correcting entries** (bút toán điều chỉnh sau khi post).
- Fiscal period locking (khóa kỳ sau khi quyết toán).

## 3. Input - Chức năng nhập liệu

- Voucher entry (Phiếu thu/chi, chuyển khoản ngân hàng)
- Journal Entry manual (bút toán tay)
- Import Excel/CSV hàng loạt
- Auto-posting từ các module (Billing, Payroll, Inventory, Fixed Asset…)
- Hỗ trợ custom fields do user tự thêm

## 4. Output 1 - Sổ sách kế toán (Bắt buộc sinh tự động)

Hệ thống phải có trang “Sổ sách kế toán” hiển thị đầy đủ các sổ sau (filter theo kỳ, tài khoản, đối tượng…):

- Sổ Nhật ký chung (General Journal)
- Sổ Cái (General Ledger) + Sổ Cái chi tiết (có cột đối ứng)
- Sổ quỹ tiền mặt (TK 111)
- Sổ tiền gửi ngân hàng (TK 112)
- Sổ chi tiết phải thu khách hàng (TK 131)
- Sổ chi tiết phải trả nhà cung cấp (TK 331)
- Sổ chi tiết vật tư hàng tồn kho (TK 152)
- Sổ theo dõi TSCĐ & khấu hao (TK 211, 214)
- Sổ lương và các khoản phải trả người lao động (TK 334)
- Sổ theo dõi tạm ứng (TK 141)
- Sổ VAT đầu vào / đầu ra (TK 133 / 333)
- Sổ quỹ chi tiết theo từng quỹ (nếu có nhiều quỹ)
- Sổ nhật ký mua bán
- Sổ chi tiết doanh thu theo khoản mục
- Sổ tổng hợp nguồn vốn
- Báo cáo quyết toán quỹ (nếu áp dụng)

Mỗi sổ phải:
- Export PDF theo mẫu Bộ Tài chính
- Export Excel
- Có audit trail (ai tạo/sửa/post)

## 5. Output 2 - Báo cáo cực kỳ chi tiết

Hệ thống phải có hai loại báo cáo:

**A. Fixed Reports (chuẩn VAS & pháp lý):**
- Bảng cân đối kế toán (Mẫu B01-DN)
- Báo cáo kết quả kinh doanh (Mẫu B02-DN)
- Báo cáo lưu chuyển tiền tệ (Mẫu B03-DN)
- Báo cáo tài chính năm + Thuyết minh BCTC
- Báo cáo quyết toán thuế GTGT (HTKK XML export)
- Báo cáo khấu hao TSCĐ
- Báo cáo công nợ phải thu/phải trả (Aging Report)

**B. Management Reports & Dynamic Reports:**
- Dynamic Report Builder (user tự kéo thả filter, group by, measure): theo tài khoản, đối tượng, thời gian, department, project, custom field…
- Báo cáo thu-chi theo khoản mục (chi tiết tháng/quý/năm)
- Báo cáo aging công nợ chi tiết (current → 30 → 60 → 90 → 180 → 360+ days)
- Báo cáo đối chiếu công nợ (Reconciliation Statement)
- Báo cáo doanh thu theo khách hàng/sản phẩm/dịch vụ
- Báo cáo chi phí theo bộ phận/hạng mục
- Báo cáo dòng tiền chi tiết
- Báo cáo so sánh ngân sách - thực tế
- Báo cáo phân tích xu hướng 12 tháng / 5 năm
- Báo cáo nợ khó đòi & dự phòng
- Báo cáo hiệu suất thu tiền
- Dashboard KPI (doanh thu, lợi nhuận, công nợ, cash flow…)

Tất cả báo cáo:
- Hỗ trợ filter cực mạnh + drill-down
- Biểu đồ (Recharts hoặc tương đương)
- Export PDF + Excel
- Cache performance (< 2 giây cho báo cáo lớn)

## 6. Các Module Chính (Extensible)

- Chart of Accounts Management
- Journal & Voucher Entry
- Accounts Receivable & Payable (full lifecycle)
- Inventory & Stock Management
- Fixed Assets & Depreciation
- Payroll & Salary Processing
- VAT & Tax Management
- Dynamic Reporting Engine
- Year-end Closing Workflow (kết chuyển, khóa kỳ)
- Multi-company / Multi-fiscal-year support

## 7. Tính năng Scale & Extensibility

- **Custom Fields**: User có thể thêm cột tùy chỉnh (text, number, date, select, checkbox…) vào bất kỳ entity nào (Voucher, Customer, FixedAsset…).
- **Dynamic Report Builder**: Lưu và chia sẻ template báo cáo.
- **Role-based Access Control** (Admin, Accountant, Manager, Viewer…)
- **Audit Log** đầy đủ, immutable.
- **API First**: Tất cả chức năng có REST/GraphQL API sạch để dễ tích hợp sau này.
- **Import/Export**: Excel template linh hoạt.

## 8. Non-functional Requirements

- Performance: Báo cáo lớn < 2 giây (sử dụng cache + materialized views)
- Security: Row Level Security / Tenant isolation nghiêm ngặt, 2FA khuyến khích
- UX/UI: Hiện đại, mobile-friendly, tối ưu cho kế toán (keyboard shortcut, batch operation, quick entry)
- Compliance: 100% theo luật kế toán Việt Nam hiện hành năm 2026

## 9. Acceptance Criteria

- Tạo công ty test → nhập 50 bút toán → kiểm tra tất cả sổ sách (Output 1) phải khớp và cân đối.
- Tạo báo cáo B01, B02, B03 phải đúng chuẩn VAS.
- Dynamic Report Builder phải cho phép tạo báo cáo tùy biến (ví dụ: doanh thu theo khách hàng theo tháng của quý 2).
- Year-end closing phải chạy thành công và khóa kỳ cũ.
- Custom field phải hoạt động mượt trên form và báo cáo.

**Mục tiêu cuối cùng:** Xây dựng một phần mềm kế toán Việt Nam chuyên nghiệp, đủ sâu để Kế toán trưởng sử dụng hàng ngày, nhưng đủ linh hoạt để mở rộng cho nhiều ngành nghề và quy mô khác nhau.

**Kết thúc spec.**