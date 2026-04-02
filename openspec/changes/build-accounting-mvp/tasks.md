# Tasks: Build Vietnamese Accounting Web Application MVP

> Ordered by dependency. Each phase builds on the previous. Tasks within a phase can be parallelized where noted.
> Numbering: `Phase.Module.Task` â€” e.g., `1.3.2` = Phase 1, Module 3 (Chart of Accounts), Task 2.

---

## Phase 0: Project Setup

- [x] 0.1 Initialize monorepo (pnpm workspaces) with `apps/web`, `apps/api`, `packages/shared`, `packages/db`
- [x] 0.2 Configure TypeScript strict mode across all packages with shared tsconfig
- [x] 0.3 Set up Docker Compose for PostgreSQL + Redis (development environment)
- [x] 0.4 Configure NestJS app (`apps/api`) with base modules, config, logging, and health check
- [x] 0.5 Configure Next.js 15 app (`apps/web`) with App Router, Tailwind, shadcn/ui
- [x] 0.6 Set up Prisma in `packages/db` with PostgreSQL connection and base configuration
- [x] 0.7 Configure ESLint + Prettier across the monorepo
- [ ] 0.8 Set up CI pipeline (lint, type-check, test)
- [x] 0.9 Implement Vietnamese localization utilities: VND currency formatting (no decimals, dot thousand separator), Vietnamese date formatting (dd/MM/yyyy), number display conventions

**Validation:** `pnpm build` succeeds; Docker Compose starts PostgreSQL + Redis; health check responds; VND formatting outputs `1.000.000` for 1000000.

---

## Phase 1: Foundation

### 1.1 Authentication & RBAC (auth-rbac)
- [x] 1.1.1 Design Prisma schema: User, Role, Permission, Session, Company-User mapping
- [x] 1.1.2 Implement JWT auth module (login, register, token refresh, rotation)
- [x] 1.1.3 Implement RBAC middleware (Admin, Accountant, Manager, Viewer)
- [x] 1.1.4 Implement 2FA (TOTP) enrollment and verification
- [x] 1.1.5 Implement user management API (CRUD, invite, deactivate)
- [x] 1.1.6 Implement rate limiting (5 attempts / 15 min lockout)
- [x] 1.1.7 Build login page, 2FA setup, user management UI
- [ ] 1.1.8 Write integration tests for auth flows

**Validation:** Login, 2FA, role enforcement, lockout all work correctly.

### 1.2 Multi-Tenant Foundation (multi-tenant-foundation) â€” depends on 1.1
- [x] 1.2.1 Design Prisma schema: Company, FiscalYear, FiscalPeriod
- [x] 1.2.2 Implement PostgreSQL RLS policies for tenant isolation
- [x] 1.2.3 Implement NestJS tenant context middleware (`app.current_company_id`)
- [x] 1.2.4 Implement Company CRUD API (create with chart seeding trigger)
- [x] 1.2.5 Implement FiscalYear/FiscalPeriod management API
- [x] 1.2.6 Build company switcher, company settings UI
- [x] 1.2.7 Implement i18n framework (Vietnamese primary, English secondary) with locale-aware currency/date/number formatting
- [ ] 1.2.8 Write integration tests verifying RLS isolation

**Validation:** Two companies created; cross-tenant query returns zero rows; fiscal year selectable; VN/EN locale switching works.

### 1.3 Chart of Accounts (chart-of-accounts) â€” depends on 1.2
- [x] 1.3.1 Design Prisma schema: LedgerAccount (hierarchical tree, TK 111â€“999)
- [x] 1.3.2 Create seed data for TT200 and TT133 chart of accounts
- [x] 1.3.3 Implement LedgerAccount CRUD API (create, update, deactivate, tree query)
- [x] 1.3.4 Implement account search/filter API (code prefix, name, type, status)
- [x] 1.3.5 Build Chart of Accounts management page (tree view, CRUD, search)
- [ ] 1.3.6 Write tests: hierarchy, deactivation rules, deletion prevention

**Validation:** TT200/TT133 chart seeded; tree view works; account with transactions cannot be deleted.

### 1.4 Double-Entry Engine (double-entry-engine) â€” depends on 1.3
- [x] 1.4.1 Design Prisma schema: JournalEntry, JournalEntryLine, AccountingTransaction
- [x] 1.4.2 Implement journal entry CRUD with debit = credit validation
- [x] 1.4.3 Implement journal entry lifecycle (DRAFT â†’ POSTED, immutable after post)
- [x] 1.4.4 Implement correcting/adjustment entry workflow (reversal + new entry)
- [x] 1.4.5 Implement auto-numbering per fiscal year (JE-2026-00001)
- [x] 1.4.6 Implement posting date validation against fiscal period lock status
- [x] 1.4.7 Implement AccountingTransaction linkage (source document references)
- [x] 1.4.8 Create materialized views for account balances and trial balance; implement application-level refresh triggered after each successful journal post via NestJS event (EventEmitter2) â€” `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- [x] 1.4.9 Build journal entry list and form UI (keyboard-optimized)
- [ ] 1.4.10 Write comprehensive tests: balance, immutability, corrections, period lock, materialized view refresh after post

**Validation:** 50 entries posted; debit = credit enforced; posted entries immutable; trial balance balances; materialized views current after posting.

### 1.5 Audit Trail (audit-trail) â€” can parallel with 1.4
- [x] 1.5.1 Design Prisma schema: AuditLog (immutable, append-only)
- [x] 1.5.2 Implement audit log service with NestJS interceptor (auto-logs mutations)
- [x] 1.5.3 Implement audit trail query API (filter by user, entity, action, date)
- [x] 1.5.4 Build audit trail search UI (admin-only)
- [ ] 1.5.5 Write tests: immutability (reject update/delete on audit records)

**Validation:** All mutations produce audit entries; audit entries cannot be modified or deleted.

### 1.6 Custom Fields (custom-fields) â€” can parallel with 1.4
- [x] 1.6.1 Design Prisma schema: CustomFieldDefinition + JSONB `customFieldValues`
- [x] 1.6.2 Implement CustomField CRUD API (create, update, deactivate, reorder)
- [x] 1.6.3 Implement dynamic form field renderer (text, number, date, select, checkbox, multi-select)
- [x] 1.6.4 Add GIN indexes on JSONB `customFieldValues` columns
- [ ] 1.6.5 Write tests: custom field CRUD, JSONB querying, form rendering

**Validation:** Custom field created â†’ appears on form â†’ value saved â†’ queryable via JSONB.

---

## Phase 2: Core Operations

### 2.1 Voucher Management (voucher-management) â€” depends on Phase 1
- [x] 2.1.1 Design Prisma schema: Voucher (types: PT, PC, bank debit/credit, transfer)
- [x] 2.1.2 Implement voucher CRUD API with auto journal entry generation
- [x] 2.1.3 Implement voucher posting (DRAFT â†’ POSTED) and batch posting
- [x] 2.1.4 Implement voucher voiding (reversal journal entry)
- [x] 2.1.5 Implement auto-numbering per voucher type per fiscal year
- [x] 2.1.6 Build voucher entry forms (keyboard shortcuts, account type-ahead)
- [x] 2.1.7 Build voucher listing page (filter by type, date, status, counterparty)
- [ ] 2.1.8 Write tests: voucher lifecycle, batch post, voiding

**Validation:** PT/PC created; posting generates correct journal entries; batch post works; void creates reversal.

### 2.2 Accounts Receivable & Payable (accounts-receivable-payable) â€” depends on Phase 1, can parallel with 2.1
- [x] 2.2.1 Design Prisma schema: Customer, Vendor with sub-ledger linking (TK 131, 331)
- [x] 2.2.2 Implement Customer/Vendor CRUD API
- [x] 2.2.3 Implement AR lifecycle (invoice â†’ payment â†’ reconciliation, partial payments)
- [x] 2.2.4 Implement AP lifecycle (bill â†’ payment â†’ reconciliation)
- [x] 2.2.5 Implement aging report computation (Current, 30, 60, 90, 180, 360+)
- [x] 2.2.6 Implement reconciliation statement generation
- [x] 2.2.7 Build Customer/Vendor management pages and AR/AP dashboards
- [ ] 2.2.8 Write tests: AR/AP lifecycle, aging, reconciliation

**Validation:** Invoice increases TK 131; payment decreases; partial payment tracked; aging buckets correct.

### 2.3 Inventory Management (inventory-management) â€” depends on Phase 1, can parallel with 2.1â€“2.2
- [x] 2.3.1 Design Prisma schema: InventoryItem, InventoryMovement, Warehouse
- [x] 2.3.2 Implement inventory CRUD with valuation method config
- [x] 2.3.3 Implement movement API (receipt, issue, transfer) with auto journal entries
- [x] 2.3.4 Implement valuation calculation (weighted average, FIFO)
- [x] 2.3.5 Build inventory management pages (items, movements, stock levels)
- [ ] 2.3.6 Write tests: movements, valuation methods, journal entry generation

**Validation:** Receipt debits TK 152; issue credits with correct costing; weighted average recalculated.

### 2.4 Fixed Assets & Depreciation (fixed-assets-depreciation) â€” depends on Phase 1, can parallel with 2.1â€“2.3
- [x] 2.4.1 Design Prisma schema: FixedAsset, DepreciationSchedule
- [x] 2.4.2 Implement fixed asset register API (create, view, dispose)
- [x] 2.4.3 Implement depreciation engine (straight-line, declining balance)
- [x] 2.4.4 Implement monthly depreciation run with auto journal entries (TK 627/641/642 â†’ TK 214)
- [x] 2.4.5 Implement asset disposal with gain/loss computation
- [x] 2.4.6 Build fixed asset management pages (register, schedule, disposal)
- [ ] 2.4.7 Write tests: depreciation calculation, auto-posting, disposal

**Validation:** Monthly depreciation creates correct entries; disposal computes gain/loss; fully depreciated stops.

### 2.5 Payroll Processing (payroll-processing) â€” depends on Phase 1, can parallel with 2.1â€“2.4
- [x] 2.5.1 Design Prisma schema: Employee, PayrollRecord, SalarySlip
- [x] 2.5.2 Implement payroll management API (create period, compute salaries)
- [x] 2.5.3 Implement salary computation (gross, BHXH/BHYT/BHTN, PIT, net)
- [x] 2.5.4 Implement payroll journal entries (TK 622/627/641/642 â†’ TK 334, TK 338, TK 3335)
- [x] 2.5.5 Build payroll pages (list, salary slips, computation detail)
- [ ] 2.5.6 Write tests: salary computation, deductions, journal entries

**Validation:** Payroll computed with correct deductions; journal entries hit correct accounts.

### 2.6 VAT & Tax Management (vat-tax-management) â€” depends on Phase 1, can parallel with 2.1â€“2.5
- [x] 2.6.1 Design Prisma schema: VatRecord (input/output, rates, invoice refs)
- [x] 2.6.2 Implement VAT CRUD API with journal linking (TK 133, TK 3331)
- [x] 2.6.3 Implement VAT computation (output âˆ’ input = payable/refundable)
- [x] 2.6.4 Implement HTKK XML export
- [x] 2.6.5 Implement VAT reconciliation (VAT records vs ledger balances)
- [x] 2.6.6 Build VAT pages (input/output ledgers, declaration, reconciliation)
- [ ] 2.6.7 Write tests: VAT computation, reconciliation, XML export

**Validation:** VAT computed correctly; HTKK XML valid; reconciliation catches discrepancies.

### 2.7 Bad Debt Provision (bad-debt-provision) â€” depends on 2.2
- [x] 2.7.1 Design Prisma schema: BadDebtProvision
- [x] 2.7.2 Implement provision API (create, reverse, write-off)
- [x] 2.7.3 Implement provision journal entries (TK 642 â†” TK 229, write-off to TK 004)
- [x] 2.7.4 Build bad debt provision page and report
- [ ] 2.7.5 Write tests: provision lifecycle, journal entries

**Validation:** Provision creates correct entries; reversal works; write-off tracked in TK 004.

---

## Phase 3: Output

### 3.1 Accounting Books (accounting-books) â€” depends on Phase 1 + Phase 2
- [x] 3.1.1 Implement Sá»• Nháº­t kÃ½ chung (General Journal) query and API
- [x] 3.1.2 Implement Sá»• CÃ¡i (General Ledger) with contra account references
- [x] 3.1.3 Implement Sá»• quá»¹ tiá»n máº·t (Cash Book - TK 111)
- [x] 3.1.4 Implement Sá»• tiá»n gá»­i ngÃ¢n hÃ ng (Bank Book - TK 112)
- [x] 3.1.5 Implement Sá»• chi tiáº¿t pháº£i thu khÃ¡ch hÃ ng (TK 131)
- [x] 3.1.6 Implement Sá»• chi tiáº¿t pháº£i tráº£ nhÃ  cung cáº¥p (TK 331)
- [x] 3.1.7 Implement Sá»• chi tiáº¿t váº­t tÆ° hÃ ng tá»“n kho (TK 152)
- [x] 3.1.8 Implement Sá»• theo dÃµi TSCÄ & kháº¥u hao (TK 211, 214)
- [x] 3.1.9 Implement Sá»• lÆ°Æ¡ng vÃ  cÃ¡c khoáº£n pháº£i tráº£ (TK 334)
- [x] 3.1.10 Implement Sá»• theo dÃµi táº¡m á»©ng (TK 141)
- [x] 3.1.11 Implement Sá»• VAT Ä‘áº§u vÃ o / Ä‘áº§u ra (TK 133 / 333)
- [x] 3.1.12 Implement Sá»• nháº­t kÃ½ mua bÃ¡n
- [x] 3.1.13 Implement Sá»• chi tiáº¿t doanh thu theo khoáº£n má»¥c
- [x] 3.1.14 Implement Sá»• tá»•ng há»£p nguá»“n vá»‘n
- [x] 3.1.15 Build unified "Sá»• sÃ¡ch káº¿ toÃ¡n" page with tabs/navigation
- [x] 3.1.16 Add filtering (period, account, counterparty) across all books
- [ ] 3.1.17 Write tests: each book cross-references posted journal entries correctly

**Validation:** All accounting books render correctly; balances match; filters work.

### 3.2 Financial Reports (financial-reports) â€” depends on Phase 1 + Phase 2, can parallel with 3.1
- [x] 3.2.1 Implement B01-DN (Báº£ng cÃ¢n Ä‘á»‘i káº¿ toÃ¡n) computation and API
- [x] 3.2.2 Implement B02-DN (BÃ¡o cÃ¡o káº¿t quáº£ kinh doanh) computation and API
- [x] 3.2.3 Implement B03-DN (BÃ¡o cÃ¡o lÆ°u chuyá»ƒn tiá»n tá»‡) â€” direct and indirect methods
- [x] 3.2.4 Implement Thuyáº¿t minh BCTC generation
- [x] 3.2.5 Implement BÃ¡o cÃ¡o kháº¥u hao TSCÄ
- [x] 3.2.6 Implement annual financial report package (combined PDF)
- [x] 3.2.7 Build financial reports page with period selection
- [ ] 3.2.8 Write tests: B01 balances; B02 profit correct; B03 ties to cash balance

**Validation:** B01 assets = liabilities + equity; B02 computes profit; B03 ending cash = TK 111+112.

### 3.3 Dynamic Reporting Engine (dynamic-reporting) â€” depends on Phase 1 + Phase 2, can parallel with 3.1â€“3.2
- [x] 3.3.1 Design DynamicReportTemplate schema (JSON config)
- [x] 3.3.2 Implement dynamic query builder (JSON config â†’ parameterized SQL)
- [x] 3.3.3 Implement management report APIs (thu-chi, revenue by customer, cost by department)
- [x] 3.3.4 Implement aging report API (configurable buckets)
- [x] 3.3.5 Implement budget vs actual comparison API
- [x] 3.3.6 Implement trend analysis API (12-month and 5-year)
- [x] 3.3.7 Implement collection performance report API
- [x] 3.3.8 Implement detailed cash flow report API
- [x] 3.3.9 Build Dynamic Report Builder UI (dimensions, measures, filters, save/share)
- [x] 3.3.10 Build KPI Dashboard with trend charts (Recharts)
- [x] 3.3.11 Implement drill-down navigation from summary to detail
- [x] 3.3.12 Implement Redis caching layer for report data: cache computed results with key `report:{companyId}:{reportType}:{params_hash}`, TTL 1 hour, invalidate all company report keys on journal posting via NestJS EventEmitter2 event `journal.posted`
- [ ] 3.3.13 Write tests: query builder, caching, cache invalidation on post, report accuracy

**Validation:** Custom report created via builder; KPI dashboard correct; drill-down works; report < 2s; cache invalidated after posting.

### 3.4 Data Import/Export (data-import-export) â€” depends on Phase 1 + Phase 2, can parallel with 3.1â€“3.3
- [x] 3.4.1 Implement Excel/CSV import pipeline (parse, validate, preview, confirm)
- [x] 3.4.2 Create import templates for all entity types
- [x] 3.4.3 Implement Excel export service (ExcelJS) for all books and reports â€” with VND formatting, Vietnamese column headers
- [x] 3.4.4 Implement PDF export service (Puppeteer/Playwright) with MoF templates â€” Vietnamese date/currency formatting
- [x] 3.4.5 Implement HTKK XML export service
- [x] 3.4.6 Implement configurable import field mapping (admin UI)
- [x] 3.4.7 Build import wizard UI (upload, preview, errors, confirm)
- [x] 3.4.8 Add export buttons across all book and report pages
- [ ] 3.4.9 Write tests: import validation, export format correctness, VND formatting in exports

**Validation:** Import creates valid drafts; errors caught; PDF matches MoF template; Excel data correct with VND formatting.

### 3.5 Year-End Closing (year-end-closing) â€” depends on Phase 1 + Phase 2
- [x] 3.5.1 Implement pre-closing checklist validation
- [x] 3.5.2 Implement auto-generation of closing entries (káº¿t chuyá»ƒn: revenue/expense â†’ TK 911 â†’ TK 421)
- [x] 3.5.3 Implement fiscal year locking (lock all periods, set year CLOSED)
- [x] 3.5.4 Implement period-level locking/unlocking with audit trail
- [x] 3.5.5 Implement opening balance carry-forward (balance sheet â†’ new year)
- [x] 3.5.6 Build year-end closing wizard UI (checklist, preview, confirm, lock)
- [ ] 3.5.7 Write tests: closing entries balance; locked periods reject posting; opening balances match

**Validation:** TK 911 clears to zero; TK 421 reflects profit/loss; all periods locked; new year balances match.

---

## Phase 4: Integration Testing & Polish

- [ ] 4.1 Acceptance test: create company â†’ enter 50 entries â†’ verify all accounting books
- [ ] 4.2 Acceptance test: verify B01, B02, B03 compliance with VAS
- [ ] 4.3 Acceptance test: create custom report (revenue by customer by month Q2)
- [ ] 4.4 Acceptance test: year-end closing end-to-end
- [ ] 4.5 Acceptance test: custom field â†’ form â†’ report filter/group
- [ ] 4.6 Performance test: 100k journal entries â†’ report < 2s (verify materialized view refresh + Redis cache hit rate)
- [ ] 4.7 Security test: RLS isolation, RBAC enforcement, auth edge cases
- [ ] 4.8 Localization test: all exports/UI display correct VND formatting, Vietnamese dates, number conventions
- [x] 4.9 Dockerize application (multi-stage build)
- [x] 4.10 Write deployment documentation

**Validation:** All 5 acceptance criteria pass; performance targets met; security verified; VN locale correct throughout.
