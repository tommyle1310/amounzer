# Design: Vietnamese Accounting Web Application MVP

## Context
Greenfield build của ứng dụng web kế toán tổng quát cho doanh nghiệp Việt Nam. Phải tuân thủ đầy đủ TT 200/2014, TT 133/2016, VAS, hỗ trợ double-entry, sinh sổ sách và báo cáo pháp lý. Ứng dụng hoàn toàn generic, không gắn với bất kỳ ngành nghề cụ thể nào.

**Stakeholders:** Kế toán trưởng, chủ doanh nghiệp SME, bất kỳ tổ chức nào cần kế toán chuẩn VN.
**Constraints:** 100% compliance pháp lý kế toán Việt Nam 2026, report < 2s, multi-tenant isolation mạnh.

## Goals / Non-Goals

### Goals
- Double-entry bookkeeping engine với chart of accounts Việt Nam (TT200 & TT133)
- Sinh đầy đủ sổ sách kế toán theo mẫu Bộ Tài chính (Output 1)
- Báo cáo tài chính VAS (B01, B02, B03, Thuyết minh) + Dynamic Report Builder (Output 2)
- Multi-tenant isolation (PostgreSQL RLS) + RBAC + Audit trail
- Custom Fields trên mọi entity — nền tảng để scale và tùy biến không giới hạn
- Dynamic Report Builder — user tự tạo báo cáo từ JSON config, lưu/chia sẻ template
- UX tối ưu cho kế toán (keyboard shortcut, batch operations, quick entry)
- Export PDF (mẫu Bộ Tài chính) + Excel cho mọi sổ sách và báo cáo
- HTKK XML export cho kê khai thuế GTGT

### Non-Goals
- Module ngành nghề cụ thể (chung cư, bán lẻ, sản xuất…) — giữ hoàn toàn generic
- Mobile native app (responsive web only)
- Real-time collaboration / đồng thời nhiều user edit cùng entry
- Tích hợp trực tiếp ERP / ngân hàng (API-first cho phép tích hợp sau)
- E-invoice (hóa đơn điện tử) — có thể thêm module riêng sau

## Architecture Decisions

### Decision 1: Monorepo with Next.js 15 + NestJS
- **What:** Single monorepo chứa Next.js 15 frontend (App Router) + NestJS backend
- **Why:** Shared TypeScript types, deployment đơn giản cho MVP, separation of concerns rõ ràng
- **Structure:**
  ```
  apps/
    web/          # Next.js 15 (App Router, RSC)
    api/          # NestJS (REST API)
  packages/
    shared/       # Shared types, constants, Zod schemas
    db/           # Prisma schema, migrations, seed data
  ```
- **Alternatives:** Separate repos (quá nặng cho MVP), monolithic Next.js API routes (NestJS tốt hơn cho business logic phức tạp)

### Decision 2: PostgreSQL + Prisma ORM + Raw SQL for Reports
- **What:** Prisma cho CRUD; raw SQL + materialized views cho báo cáo
- **Why:** Prisma type-safe + migration; báo cáo cần CTE, window functions, materialized views để đạt < 2s
- **Materialized views:**
  - Views: `mv_trial_balance`, `mv_account_balances`, `mv_aging_snapshot`
  - Refresh mechanism: Application-level trigger via NestJS EventEmitter2 — sau mỗi journal post thành công, emit event `journal.posted` → listener gọi `REFRESH MATERIALIZED VIEW CONCURRENTLY` (không lock read queries)
  - Dùng `CONCURRENTLY` yêu cầu `UNIQUE INDEX` trên mỗi materialized view
  - UI hiển thị "last refreshed" timestamp để user biết data freshness
- **Alternatives:** Drizzle ORM (migration tooling chưa mature bằng)

### Decision 3: Tenant Isolation via PostgreSQL RLS
- **What:** RLS policies trên tất cả tenant-scoped tables, `companyId` trên mọi bảng
- **Why:** Data isolation mạnh mà không cần database riêng; đơn giản hơn schema-per-tenant
- **Implementation:** NestJS middleware set `app.current_company_id` session variable; RLS tự filter
- **Alternatives:** Schema-per-tenant (migration phức tạp), application-level filtering (không đủ an toàn cho dữ liệu tài chính)

### Decision 4: Immutable Journal Entries + Correction Workflow
- **What:** Posted entries immutable (`POSTED`). Sửa qua reversal + new entry
- **Why:** Luật kế toán VN yêu cầu; chống thay đổi dữ liệu hồi tố
- **States:** `DRAFT` → `POSTED` (immutable) → chỉ sửa qua `REVERSAL` + new `POSTED`
- **Alternatives:** Soft-edit + version history (vi phạm nguyên tắc immutability kế toán)

### Decision 5: Custom Fields via JSONB + Metadata Table
- **What:** `customFieldValues JSONB` column trên extensible entities; `CustomFieldDefinition` table lưu schema
- **Why:** Flexible, queryable (JSONB operators), không cần DDL changes khi thêm field
- **Indexing:** GIN index trên JSONB columns cho report filtering
- **Scalability:** Đây là nền tảng chính để hệ thống dễ scale — user có thể mở rộng data model mà không cần code changes
- **Alternatives:** EAV (query chậm), dynamic DDL (migration phức tạp trong multi-tenant)

### Decision 6: Hybrid Report Engine
- **What:** Fixed reports dùng materialized views + pre-built SQL; dynamic reports dùng query builder (JSON config → parameterized SQL)
- **Why:** Fixed reports cần đúng format Bộ Tài chính; dynamic reports cần flexibility
- **Redis caching strategy:**
  - Cache key: `report:{companyId}:{reportType}:{params_hash}` — `params_hash` = SHA256 của sorted query params (period, filters, etc.)
  - TTL: 1 giờ (auto-expire)
  - Invalidation: Khi event `journal.posted` emit → xóa tất cả keys matching `report:{companyId}:*` (wildcard scan hoặc dùng Redis key tags)
  - Connection: ioredis client, configured via `REDIS_URL` env
  - Fallback: Nếu Redis unavailable → bypass cache, query trực tiếp (degraded performance, không lỗi)
- **Performance:** < 2s cho mọi report trên 100k+ journal entries
- **Extensibility:** Dynamic Report Builder cho phép user tạo báo cáo tùy ý mà không cần developer, lưu/chia sẻ template trong team
- **Alternatives:** External BI tool (mất in-app integration)

### Decision 7: Server-side Export Pipeline
- **What:** PDF generation via Puppeteer/Playwright (mẫu Bộ Tài chính); Excel via ExcelJS
- **Why:** MoF PDF templates cần formatting chính xác; server-side đảm bảo consistency
- **Alternatives:** Client-side PDF (template fidelity kém), LaTeX (overkill cho tabular reports)

### Decision 8: Frontend Architecture
- **What:** Next.js 15 App Router + RSC cho data-heavy pages; shadcn/ui + Tailwind; TanStack Query; React Hook Form + Zod
- **Why:** RSC giảm client bundle cho report/book pages; shadcn/ui accessible + customizable; TanStack Query quản lý cache tốt
- **Keyboard optimization:** Global hotkeys cho voucher entry, Tab navigation trong journal grids
- **Alternatives:** Remix (ít ecosystem hơn), MUI (nặng, khó custom cho VN templates)

### Decision 9: 3-Layer Document Architecture (TT200/TT133 Compliance)
- **What:** Tách biệt rõ ràng 3 layer: **Chứng từ gốc (Source Documents)** → **Bút toán (Journal Entries)** → **Sổ sách (Ledgers/Books)**
- **Why:** 
  - Chuẩn kế toán VN (TT200/TT133) yêu cầu chứng từ gốc phải có đầy đủ thông tin pháp lý (quyển số, số phiếu, người giao dịch, số tiền bằng chữ, chữ ký)
  - UI nhập liệu nội bộ cần UX tối ưu cho speed
  - In/xuất chứng từ cần đúng format Bộ Tài chính để có giá trị pháp lý
- **Implementation:**
  ```
  Layer 1: Chứng từ (Voucher)
  ├── Phiếu thu (PT) - Mẫu 01-TT
  ├── Phiếu chi (PC) - Mẫu 02-TT
  ├── Giấy báo nợ / Giấy báo có ngân hàng
  └── Chứng từ gốc: đầy đủ legal fields (người nộp/nhận, địa chỉ, số tiền bằng chữ, chữ ký)
  
  Layer 2: Bút toán (Journal Entry)
  ├── JournalEntry + JournalEntryLine[]
  ├── Nợ / Có accounts & amounts only
  └── Linked to source voucher via AccountingTransaction
  
  Layer 3: Sổ sách (Ledgers/Books)
  ├── Sổ quỹ tiền mặt (Cash Book)
  ├── Sổ Cái (General Ledger)
  └── Derived from journal entries, reference voucher numbers (PT/PC, not JE)
  ```
- **UI Pattern:**
  - Entry form = optimized for speed (internal)
  - Preview/Export = full legal format with all required fields and signatures
  - Mapping: "Đối tượng" → "Người nộp/nhận tiền", "Nội dung" → "Lý do", Amount → "Số tiền" + auto "Số tiền bằng chữ"
- **Alternatives:** Single-layer (gộp chứng từ + bút toán) — không đủ compliance cho in chứng từ pháp lý

## Data Model Overview

### Core Entity Relationships
```
Company (tenant root)
├── FiscalYear → FiscalPeriod (monthly)
├── LedgerAccount (tree: parent → children, TK 111–999)
├── JournalEntry → JournalEntryLine[] (debit/credit lines)
│   └── links to: Voucher, source documents
├── Voucher (PT, PC, bank debit/credit notes)
├── Customer / Vendor
│   └── AR/AP sub-ledger via JournalEntryLine
├── InventoryItem → InventoryMovement
├── FixedAsset → DepreciationSchedule
├── PayrollRecord → SalarySlip
├── VatRecord (input/output)
├── BadDebtProvision
├── CustomFieldDefinition → applied via JSONB on entities
└── DynamicReportTemplate (JSON config)
```

### Key Indexes & Performance
- Composite: `(companyId, accountId, postingDate)` on JournalEntryLine
- Composite: `(companyId, fiscalYearId, status)` on JournalEntry
- GIN index on `customFieldValues` JSONB columns
- Materialized views: trial balance, account balances, aging snapshots
- Partitioning: JournalEntryLine by fiscal year cho large datasets

## Security & Compliance
- **Authentication:** JWT + refresh token rotation, optional 2FA (TOTP)
- **Authorization:** RBAC — Admin, Accountant, Manager, Viewer
- **Tenant isolation:** PostgreSQL RLS trên tất cả tenant-scoped tables
- **API security:** Rate limiting, input validation (Zod), CORS
- **Audit:** Mọi mutation logged với userId, timestamp, before/after values (immutable)
- **Data protection:** Encryption at rest (PostgreSQL), TLS in transit

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Materialized view refresh latency | Stale report data after posting | `REFRESH MATERIALIZED VIEW CONCURRENTLY` via `journal.posted` event; hiển thị "last refreshed" timestamp; UNIQUE INDEX trên mỗi view |
| JSONB custom fields query performance | Slow dynamic reports với many custom fields | GIN indexes; giới hạn số field per entity; denormalize hot fields |
| PDF template fidelity vs MoF standards | Non-compliant exports | Test against official MoF sample PDFs; cho phép template customization |
| VN chart of accounts mapping phức tạp | Incorrect account classification | Seed từ official TT200/TT133 chart; validate bằng automated tests |
| Multi-tenant RLS bypass risk | Data leak between tenants | Integration tests verifying RLS; security audit tất cả raw SQL queries |

## Resolved Design Decisions
1. **TT200 & TT133:** MVP hỗ trợ cả hai — user chọn khi tạo company. Chart of accounts seed data riêng cho mỗi standard.
2. **HTKK XML:** Target phiên bản HTKK mới nhất tại thời điểm build (2026). Schema version configurable.
3. **Dynamic report sharing:** Có — saved templates có thể chia sẻ trong cùng tenant (company-scoped).
4. **Target scale MVP:** 100 companies, 100k journal entries/company, report < 2s.
