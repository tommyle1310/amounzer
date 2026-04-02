# Change: Build Vietnamese Accounting Web Application (Standalone MVP)

## Why
Xây dựng một phần mềm kế toán tổng quát (Web Kế Toán Việt Nam) chuẩn pháp lý, hỗ trợ double-entry bookkeeping, sinh đầy đủ sổ sách kế toán (Output 1) và báo cáo chi tiết (Output 2), dễ scale với custom fields và dynamic reporting. Ứng dụng hoàn toàn generic — không gắn với bất kỳ ngành nghề cụ thể nào.

## What Changes (Greenfield)
- Multi-tenant architecture với tenant isolation nghiêm ngặt (PostgreSQL RLS)
- Vietnamese Chart of Accounts (TT200 & TT133) với sub-account hierarchy
- Double-entry engine + immutable journal entries + correction workflow
- Voucher management (Phiếu thu/chi, chuyển khoản ngân hàng, bút toán điều chỉnh)
- Accounts Receivable & Payable với full lifecycle (Customer/Vendor sub-ledgers)
- Inventory & Stock management (weighted average, FIFO valuation)
- Fixed Assets & Depreciation (straight-line, declining balance)
- Payroll & Salary Processing (BHXH/BHYT/BHTN, PIT)
- VAT & Tax management (input/output tracking, HTKK XML export)
- Bad Debt Provision (dự phòng nợ khó đòi)
- Toàn bộ sổ sách kế toán theo Bộ Tài chính (Output 1)
- Báo cáo tài chính VAS: B01-DN, B02-DN, B03-DN, Thuyết minh BCTC (Output 2A)
- Dynamic Report Builder + KPI Dashboard + Management Reports (Output 2B)
- Custom Fields system trên mọi entity — nền tảng để mở rộng linh hoạt
- Year-end Closing workflow (kết chuyển, khóa kỳ, carry-forward)
- Import/Export: Excel/CSV import, PDF/Excel export theo mẫu Bộ Tài chính, HTKK XML
- Authentication & RBAC (Admin, Accountant, Manager, Viewer) + optional 2FA
- Immutable Audit Trail cho mọi thao tác tài chính

## Tech Stack
- **Monorepo:** Next.js 15 (App Router) + NestJS + PostgreSQL + Prisma + TypeScript + Docker
- **Frontend:** shadcn/ui + Tailwind + TanStack Query + React Hook Form + Zod + Recharts
- **Infrastructure:** Redis (report caching), Puppeteer (PDF export), ExcelJS (Excel export)

## Capability Map

| # | Capability | Scope |
|---|-----------|-------|
| 1 | auth-rbac | Authentication, RBAC, 2FA, user management |
| 2 | multi-tenant-foundation | Company, FiscalYear, tenant isolation, i18n |
| 3 | chart-of-accounts | LedgerAccount hierarchy, VN chart seeding (TT200/TT133) |
| 4 | double-entry-engine | JournalEntry, posting, validation, corrections, transactions |
| 5 | audit-trail | Immutable audit logging, query interface |
| 6 | custom-fields | User-defined fields on all entities, JSONB + GIN index |
| 7 | voucher-management | Voucher types (PT/PC/bank), entry forms, batch posting |
| 8 | accounts-receivable-payable | Customer, Vendor, AR/AP lifecycle, aging, reconciliation |
| 9 | inventory-management | InventoryItem, movements, valuation (weighted avg/FIFO) |
| 10 | fixed-assets-depreciation | FixedAsset, DepreciationSchedule, disposal |
| 11 | payroll-processing | PayrollRecord, SalarySlip, insurance/PIT deductions |
| 12 | vat-tax-management | VAT input/output, HTKK XML, reconciliation |
| 13 | bad-debt-provision | Provision, reversal, write-off tracking |
| 14 | accounting-books | All sổ sách kế toán per MoF templates (Output 1) |
| 15 | financial-reports | B01-DN, B02-DN, B03-DN, BCTC notes (Output 2A) |
| 16 | dynamic-reporting | Report builder, management reports, KPI dashboard (Output 2B) |
| 17 | data-import-export | Excel/CSV import, PDF/Excel export, HTKK XML |
| 18 | year-end-closing | Closing entries (kết chuyển), period locking, balance carry-forward |

## Sequencing & Dependencies
```
Phase 0 (Setup):      Monorepo, Docker, CI/CD
Phase 1 (Foundation): auth-rbac → multi-tenant-foundation → chart-of-accounts → double-entry-engine → audit-trail → custom-fields
Phase 2 (Core Ops):   voucher-management → AR/AP → inventory → fixed-assets → payroll → VAT → bad-debt
Phase 3 (Output):     accounting-books → financial-reports → dynamic-reporting → data-import-export → year-end-closing
Phase 4 (Polish):     Integration testing, performance testing, Dockerize, deployment docs
```

## Extensibility Design
Hệ thống được thiết kế để scale dễ dàng:
- **Custom Fields:** Thêm cột tùy chỉnh trên bất kỳ entity nào (JSONB + GIN index), dùng được trong form và report
- **Dynamic Report Builder:** JSON-based config, user tự tạo/lưu/chia sẻ report template
- **API-first:** Toàn bộ chức năng có REST API, dễ tích hợp với hệ thống bên ngoài
- **Module architecture:** NestJS modules tách biệt, dễ thêm module mới mà không ảnh hưởng core

## Acceptance Criteria
1. Tạo công ty → nhập chứng từ → tất cả sổ sách (Output 1) cân đối đúng
2. Sinh B01, B02, B03 đúng chuẩn VAS
3. Dynamic Report Builder hoạt động (ví dụ: doanh thu theo khách hàng theo tháng)
4. Custom fields hoạt động trên form và báo cáo
5. Year-end closing chạy thành công và khóa kỳ
