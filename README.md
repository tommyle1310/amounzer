# Amounzer - Vietnamese Accounting Application (Phần Mềm Kế Toán Việt Nam)

**Version:** 0.1.0 (MVP)  
**Last Updated:** April 2026  

A comprehensive Vietnamese accounting software built to comply with Vietnamese Accounting Standards (TT200/2014/TT-BTC, TT133/2016/TT-BTC, VAS). Designed for small to medium businesses with full double-entry bookkeeping, multi-tenant support, and extensive reporting capabilities.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Core Features Overview](#core-features-overview)
4. [Detailed Feature Documentation](#detailed-feature-documentation)
   - [Authentication & Authorization](#1-authentication--authorization)
   - [Multi-Tenant Foundation](#2-multi-tenant-foundation)
   - [Chart of Accounts (Hệ Thống Tài Khoản)](#3-chart-of-accounts-hệ-thống-tài-khoản)
   - [Double-Entry Engine (Bút Toán Kép)](#4-double-entry-engine-bút-toán-kép)
   - [Voucher Management (Quản Lý Chứng Từ)](#5-voucher-management-quản-lý-chứng-từ)
   - [Accounting Books (Sổ Sách Kế Toán)](#6-accounting-books-sổ-sách-kế-toán)
   - [Financial Reports (Báo Cáo Tài Chính)](#7-financial-reports-báo-cáo-tài-chính)
   - [Customer & Vendor Management (AR/AP)](#8-customer--vendor-management-arap)
   - [Inventory Management (Hàng Tồn Kho)](#9-inventory-management-hàng-tồn-kho)
   - [Fixed Assets & Depreciation (TSCĐ & Khấu Hao)](#10-fixed-assets--depreciation-tscđ--khấu-hao)
   - [Payroll Processing (Xử Lý Lương)](#11-payroll-processing-xử-lý-lương)
   - [VAT/Tax Management (Quản Lý Thuế GTGT)](#12-vattax-management-quản-lý-thuế-gtgt)
   - [Bad Debt Provisions (Dự Phòng Nợ Xấu)](#13-bad-debt-provisions-dự-phòng-nợ-xấu)
   - [Custom Fields (Trường Tùy Chỉnh)](#14-custom-fields-trường-tùy-chỉnh)
   - [Audit Trail (Nhật Ký Hoạt Động)](#15-audit-trail-nhật-ký-hoạt-động)
   - [Year-End Closing (Khóa Sổ Cuối Năm)](#16-year-end-closing-khóa-sổ-cuối-năm)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Getting Started](#getting-started)
8. [Future Roadmap](#future-roadmap)

---

## Tech Stack

### Backend (NestJS API)
| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | v11+ | Backend framework |
| **Prisma** | v6.19+ | ORM & database migrations |
| **PostgreSQL** | - | Primary database |
| **Redis (ioredis)** | v5.6+ | Caching & session management |
| **JWT** | v11+ | Authentication |
| **Passport** | v0.7+ | Auth strategies |
| **otplib + QRCode** | - | Two-Factor Authentication |
| **ExcelJS** | v4.4+ | Excel export |
| **bcrypt** | v5.1+ | Password hashing |
| **Zod** | v3.24+ | Validation |
| **Event Emitter** | v3+ | Event-driven architecture |

### Frontend (Next.js Web)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | v15.3+ | React framework (App Router) |
| **React** | v19+ | UI library |
| **TypeScript** | v5.8+ | Type safety |
| **TanStack Query** | v5.62+ | Data fetching & caching |
| **TanStack Table** | v8.20+ | Advanced data tables |
| **Radix UI** | - | Accessible primitives |
| **Tailwind CSS** | v3.4+ | Styling |
| **React Hook Form** | v7.54+ | Form management |
| **Recharts** | v2.15+ | Charts & visualizations |
| **Lucide React** | - | Icons |
| **Zod** | v3.24+ | Client-side validation |

### Shared Package
| Module | Purpose |
|--------|---------|
| **@amounzer/shared** | Shared types, constants, formatting utilities |
| **@amounzer/db** | Prisma schema & migrations |

### DevOps
- **pnpm** workspaces (monorepo)
- **Docker Compose** for PostgreSQL + Redis
- **ESLint** + **Prettier** for code quality
- **Node.js** v20+

---

## Project Structure

```
amounzer/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/        # Feature modules
│   │   │   │   ├── accounting-books/
│   │   │   │   ├── audit/
│   │   │   │   ├── auth/
│   │   │   │   ├── bad-debt/
│   │   │   │   ├── chart-of-accounts/
│   │   │   │   ├── company/
│   │   │   │   ├── custom-field/
│   │   │   │   ├── customer/
│   │   │   │   ├── dynamic-report/
│   │   │   │   ├── financial-reports/
│   │   │   │   ├── fixed-asset/
│   │   │   │   ├── health/
│   │   │   │   ├── import-export/
│   │   │   │   ├── inventory/
│   │   │   │   ├── journal-entry/
│   │   │   │   ├── payroll/
│   │   │   │   ├── vat/
│   │   │   │   ├── vendor/
│   │   │   │   ├── voucher/
│   │   │   │   └── year-end-closing/
│   │   │   ├── prisma/         # Prisma service
│   │   │   └── redis/          # Redis service
│   │   └── test/
│   │
│   └── web/                    # Next.js Frontend
│       └── src/
│           ├── app/
│           │   ├── (dashboard)/  # Protected routes
│           │   │   ├── accounts/
│           │   │   ├── admin/
│           │   │   ├── ar-ap/
│           │   │   ├── bad-debt/
│           │   │   ├── books/      # Accounting books
│           │   │   ├── customers/
│           │   │   ├── dashboard/
│           │   │   ├── fixed-assets/
│           │   │   ├── inventory/
│           │   │   ├── journal-entries/
│           │   │   ├── payroll/
│           │   │   ├── reports/
│           │   │   ├── settings/
│           │   │   ├── vat/
│           │   │   ├── vendors/
│           │   │   ├── vouchers/
│           │   │   └── year-end/
│           │   ├── login/
│           │   ├── register/
│           │   └── setup/
│           ├── components/
│           └── lib/
│
├── packages/
│   ├── db/                     # Prisma schema & migrations
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   └── shared/                 # Shared utilities
│       └── src/
│           ├── constants.ts
│           ├── formatting.ts
│           └── schemas.ts
│
├── docs/                       # Documentation
├── openspec/                   # Feature specifications
└── agents/                     # AI agent instructions
```

---

## Core Features Overview

| Feature Area | Status | Description |
|--------------|--------|-------------|
| ✅ **Authentication** | Complete | JWT + 2FA + Refresh tokens + Account lockout |
| ✅ **Multi-Tenant** | Complete | Company isolation, user-company roles |
| ✅ **Chart of Accounts** | Complete | Vietnamese standard accounts (TT200/TT133) |
| ✅ **Double-Entry Engine** | Complete | Journal entries with full validation |
| ✅ **Voucher Management** | Complete | PT/PC/BDN/BCN/BT with TT200 compliance |
| ✅ **Accounting Books** | Complete | 14 types of ledgers & journals |
| ✅ **Financial Reports** | Complete | B01-DN, B02-DN, B03-DN with caching |
| ✅ **AR/AP (Công Nợ)** | Complete | Customer & Vendor ledgers |
| ✅ **Inventory** | Complete | Weighted avg/FIFO, movements |
| ✅ **Fixed Assets** | Complete | Depreciation schedules & disposal |
| ✅ **Payroll** | Complete | Vietnamese insurance rates |
| ✅ **VAT Management** | Complete | Input/Output tracking & calculation |
| ✅ **Bad Debt** | Complete | Provisions, reversals, write-offs |
| ✅ **Custom Fields** | Complete | Add fields to any entity |
| ✅ **Audit Trail** | Complete | Full action logging |
| ✅ **Year-End Closing** | Complete | Pre-close checklist + auto journal |

---

## Detailed Feature Documentation

### 1. Authentication & Authorization

**Backend Module:** `apps/api/src/modules/auth/`

#### Features Implemented:
- **User Registration** with bcrypt password hashing (cost factor 12)
- **Login** with email/password + failed login tracking
- **Account Lockout** after 5 failed attempts (15-minute lockout)
- **Two-Factor Authentication (2FA):**
  - TOTP-based using `otplib`
  - QR code generation for authenticator apps
  - Enable/confirm/verify flows
- **JWT Token Management:**
  - Access tokens with configurable expiration
  - Refresh tokens stored in database
  - Token rotation on refresh
- **Session Management:**
  - Refresh token stored in `sessions` table
  - Automatic cleanup on logout

#### Role-Based Access Control (RBAC):
```typescript
enum Role {
  ADMIN       // Full access
  ACCOUNTANT  // Create/post vouchers, entries
  MANAGER     // Read access + limited write
  VIEWER      // Read-only access
}
```

#### Endpoints:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create new user |
| POST | `/auth/login` | Authenticate user |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/2fa/enable` | Generate 2FA secret + QR |
| POST | `/auth/2fa/confirm` | Activate 2FA |
| POST | `/auth/2fa/verify` | Verify 2FA code |

---

### 2. Multi-Tenant Foundation

**Backend Module:** `apps/api/src/modules/company/`

#### Features Implemented:
- **Company (Tenant) Model** with Vietnamese compliance fields:
  - Name, Tax Code, Address, Legal Representative
  - Accounting Standard selection (TT200 or TT133)
  - Base currency (default: VND)
  - Locale (default: Vietnamese)

- **Fiscal Year Management:**
  - Flexible fiscal year start/end dates
  - Auto-generation of 12 monthly fiscal periods
  - Period locking support
  - OPEN/CLOSED status

- **User-Company Association:**
  - Users can belong to multiple companies
  - Role assignment per company
  - Active/inactive status per association

#### Data Model:
```
Company
├── id, name, taxCode, address
├── legalRepresentative, phone
├── accountingStandard (TT200/TT133)
├── baseCurrency (VND), locale (vi)
└── FiscalYears[]
    ├── name, startDate, endDate
    ├── status (OPEN/CLOSED)
    └── FiscalPeriods[]
        ├── periodNumber (1-12)
        ├── startDate, endDate
        └── status (OPEN/LOCKED)
```

#### Company Isolation:
- All API requests require `x-company-id` header
- All database queries filtered by `companyId`
- JWT middleware extracts and validates company access

---

### 3. Chart of Accounts (Hệ Thống Tài Khoản)

**Backend Module:** `apps/api/src/modules/chart-of-accounts/`

#### Features Implemented:
- **Vietnamese Standard Account Structure:**
  - Class 1xx: Current Assets (Tài sản ngắn hạn)
  - Class 2xx: Non-Current Assets (Tài sản dài hạn)
  - Class 3xx: Liabilities (Nợ phải trả)
  - Class 4xx: Equity (Vốn chủ sở hữu)
  - Class 5xx: Revenue (Doanh thu)
  - Class 6xx: Expenses (Chi phí)
  - Class 7xx: Other Income (Thu nhập khác)
  - Class 8xx: Other Expenses (Chi phí khác)
  - Class 9xx: Income Summary (Xác định KQKD)

- **Account Types:**
  ```typescript
  enum AccountType {
    ASSET
    LIABILITY
    EQUITY
    REVENUE
    EXPENSE
    OFF_BALANCE_SHEET
  }
  ```

- **Normal Balance:**
  ```typescript
  enum NormalBalance {
    DEBIT   // Assets, Expenses
    CREDIT  // Liabilities, Equity, Revenue
  }
  ```

- **Hierarchical Structure:**
  - Parent-child relationships via `parentId`
  - Level tracking (1, 2, 3...)
  - Tree view API endpoint

- **System Accounts:**
  - `isSystem` flag for protected accounts
  - Cannot modify/delete system accounts with posted transactions

#### Key Accounts Used:
| Code | Name (Vietnamese) | Normal Balance |
|------|-------------------|----------------|
| 111 | Tiền mặt (Cash) | DEBIT |
| 112 | Tiền gửi ngân hàng (Bank) | DEBIT |
| 131 | Phải thu khách hàng (AR) | DEBIT |
| 133 | Thuế GTGT đầu vào | DEBIT |
| 141 | Tạm ứng | DEBIT |
| 152 | Nguyên vật liệu | DEBIT |
| 211 | Tài sản cố định | DEBIT |
| 214 | Hao mòn TSCĐ | CREDIT |
| 331 | Phải trả nhà cung cấp (AP) | CREDIT |
| 333 | Thuế & phải nộp nhà nước | CREDIT |
| 334 | Phải trả người lao động | CREDIT |
| 421 | Lợi nhuận chưa phân phối | CREDIT |
| 511 | Doanh thu | CREDIT |
| 632 | Giá vốn hàng bán | DEBIT |
| 641 | Chi phí bán hàng | DEBIT |
| 642 | Chi phí quản lý | DEBIT |
| 911 | Xác định KQKD | N/A |

---

### 4. Double-Entry Engine (Bút Toán Kép)

**Backend Module:** `apps/api/src/modules/journal-entry/`

#### Features Implemented:
- **Journal Entry Creation:**
  - Multiple debit/credit lines per entry
  - **Strict validation:** Total Debit = Total Credit
  - Non-zero amount validation
  - Automatic entry number generation (`JE-YYYYMMDD-XXXXX`)

- **Two-Date System (TT200/TT133 Compliance):**
  - `postingDate` (Ngày ghi sổ): When recorded in books
  - `documentDate` (Ngày chứng từ): Original document date

- **Entry Types:**
  ```typescript
  enum JournalEntryType {
    STANDARD    // Regular entries
    ADJUSTMENT  // Correcting entries
    CLOSING     // Year-end closing
    REVERSAL    // Reversing entries
    OPENING     // Opening balance entries
  }
  ```

- **Status Management:**
  ```typescript
  enum JournalEntryStatus {
    DRAFT    // Editable, not in reports
    POSTED   // Final, appears in books
    REVERSAL // Links to reversed entry
  }
  ```

- **Journal Entry Lines:**
  - Account reference
  - Debit/Credit amounts (Decimal 18,0 for VND)
  - Optional links to: Customer, Vendor, Employee, Inventory Item
  - Line ordering

- **Reversal System:**
  - Create reversal entry from posted entry
  - Auto-swaps debit/credit amounts
  - Links via `reversalOfId`

- **AccountingTransaction Link:**
  - Tracks source of journal entry (voucher, payroll, depreciation, etc.)
  - Enables drill-down from books to source documents

#### Validation Rules:
1. Fiscal year must exist and be OPEN
2. Total debits must equal total credits
3. At least one line required
4. Amounts cannot be zero
5. Period must not be LOCKED

---

### 5. Voucher Management (Quản Lý Chứng Từ)

**Backend Module:** `apps/api/src/modules/voucher/`  
**Frontend Pages:** `apps/web/src/app/(dashboard)/vouchers/`

This is a **core module** with extensive TT200/TT133 compliance features.

#### Voucher Types (Loại Chứng Từ):
| Code | Vietnamese | English | Purpose |
|------|------------|---------|---------|
| **PT** | Phiếu thu | Cash Receipt | Cash received from customer |
| **PC** | Phiếu chi | Cash Payment | Cash paid to vendor/expense |
| **BDN** | Giấy báo nợ | Bank Debit Note | Bank withdrawal notification |
| **BCN** | Giấy báo có | Bank Credit Note | Bank deposit notification |
| **BT** | Chuyển khoản | Bank Transfer | Interbank transfer |

#### Voucher Fields (TT200/TT133 Legal Compliance):

**Header Information:**
| Field | Description |
|-------|-------------|
| `voucherNumber` | Auto-generated: `{type}-{year}-{sequence}` e.g., `PT-2026-00001` |
| `voucherBookNo` | Optional book/volume number (Quyển số) |
| `date` | Voucher date (Ngày chứng từ) |
| `recordingDate` | Recording date (Ngày ghi sổ) - may differ |
| `status` | DRAFT → POSTED → VOIDED |

**Transaction Party (Thông Tin Đối Tượng):**
| Field | Description |
|-------|-------------|
| `counterpartyName` | Customer/Vendor name from master data |
| `counterpartyId` | Link to Customer or Vendor |
| `counterpartyType` | 'customer' or 'vendor' |
| `partyFullName` | Full name of person (Họ tên người nộp/nhận tiền) |
| `partyAddress` | Person's address (Địa chỉ) |
| `partyIdNumber` | ID card number (CMND/CCCD/Hộ chiếu) |

**Amount Information:**
| Field | Description |
|-------|-------------|
| `totalAmount` | Total in base currency (VND) |
| `amountInWords` | Auto-generated Vietnamese words (Số tiền bằng chữ) |
| `currency` | Currency code (default: VND) |
| `originalAmount` | Foreign currency amount |
| `exchangeRate` | Exchange rate to VND |

**Supporting Documents:**
| Field | Description |
|-------|-------------|
| `attachmentCount` | Number of attached originals (Kèm theo ... chứng từ gốc) |
| `originalDocRefs` | Original document references |

#### Voucher Actions:

**Create Voucher:**
1. Validate fiscal year exists and is OPEN
2. Generate voucher number
3. Auto-generate amount in Vietnamese words
4. Create linked DRAFT journal entry
5. Create AccountingTransaction link
6. Log to audit trail

**Post Voucher (Ghi Sổ):**
1. Validate status is DRAFT
2. **For PC (Cash Payment):** Check sufficient cash balance
   - Queries posted TK111 balance
   - Prevents negative cash book
3. Post linked journal entry
4. Update voucher status to POSTED
5. Log to audit trail

**Batch Post (Ghi Sổ Hàng Loạt):**
- Post multiple DRAFT vouchers at once
- Returns success/failure for each
- Continues on individual failures

**Void Voucher (Hủy Chứng Từ):**
1. Validate status is POSTED
2. Create reversal journal entry
3. Update voucher status to VOIDED
4. Log to audit trail

#### Amount to Vietnamese Words:
```typescript
// Example: 12,500,000 VND
numberToVietnameseWords(12500000, 'đồng')
// → "Mười hai triệu năm trăm nghìn đồng chẵn"
```

Handles:
- Units: đơn vị, mười, trăm
- Scales: nghìn, triệu, tỷ
- Special cases: lẻ, mốt, lăm
- Negative numbers

#### Voucher List Page Features:
- Filter by: Type, Status, Date Range, Counterparty
- Columns: Number, Type, Date, Counterparty, Description, Amount, Status
- Actions: View details, Post, Void, Batch post

#### New Voucher Form Features:
- Voucher type selector
- Date picker with fiscal year validation
- Counterparty search (searches both Customers and Vendors)
- **Expandable Legal Fields Section:**
  - Party full name
  - Party address
  - Party ID number
  - Book/volume number
  - Original document refs
  - Attachment count
- **Foreign Currency Section:**
  - Currency selector (VND, USD, EUR, JPY, CNY)
  - Original amount
  - Exchange rate
- **Journal Entry Lines:**
  - Account search with autocomplete
  - Debit/Credit amounts
  - Line descriptions
  - Running balance validation
- Auto-balance indicator (Debit = Credit)

---

### 6. Accounting Books (Sổ Sách Kế Toán)

**Backend Module:** `apps/api/src/modules/accounting-books/`  
**Frontend Pages:** `apps/web/src/app/(dashboard)/books/`

This is a **core module** implementing 14 types of Vietnamese accounting ledgers.

#### Book Types Registry:
```typescript
const BOOK_TYPES = [
  { key: 'general-journal', label: 'Nhật ký chung' },
  { key: 'general-ledger', label: 'Sổ Cái' },
  { key: 'cash', label: 'Sổ quỹ tiền mặt' },
  { key: 'bank', label: 'Sổ tiền gửi NH' },
  { key: 'ar-detail', label: 'Sổ chi tiết phải thu' },
  { key: 'ap-detail', label: 'Sổ chi tiết phải trả' },
  { key: 'inventory', label: 'Sổ kho' },
  { key: 'fixed-asset', label: 'Sổ TSCĐ' },
  { key: 'payroll', label: 'Sổ lương' },
  { key: 'advance', label: 'Sổ tạm ứng' },
  { key: 'vat-input', label: 'Sổ VAT đầu vào' },
  { key: 'vat-output', label: 'Sổ VAT đầu ra' },
  { key: 'purchase-journal', label: 'NK Mua' },
  { key: 'sales-journal', label: 'NK Bán' },
];
```

#### 1. General Journal (Sổ Nhật Ký Chung)

**Endpoint:** `GET /accounting-books/general-journal`

**Purpose:** Shows all posted journal entries in chronological order.

**Columns:**
| Column | Description |
|--------|-------------|
| STT | Sequential number |
| Ngày ghi sổ | Posting date |
| Ngày CT | Document date |
| Số CT | Entry number |
| Diễn giải | Description |
| ✓SC | Posted to General Ledger indicator |
| Số hiệu TK | Account code |
| Nợ (₫) | Debit amount |
| Có (₫) | Credit amount |

**Features:**
- Flattened view (one row per journal line)
- Entry grouping visual separator
- Balance validation indicator
- Period totals

#### 2. General Ledger (Sổ Cái)

**Endpoint:** `GET /accounting-books/general-ledger?accountId={id}`

**Purpose:** Shows all transactions for a specific account.

**Columns:**
| Column | Description |
|--------|-------------|
| STT NKC | General Journal row number |
| Ngày ghi sổ | Posting date |
| Ngày CT | Document date |
| Số CT | Entry number |
| Diễn giải | Description |
| TK đối ứng | Contra accounts |
| Nợ (₫) | Debit amount |
| Có (₫) | Credit amount |
| Số dư | Running balance |

**Special Features:**
- Account selector (dropdown)
- Opening balance row (Số dư đầu kỳ)
- Running balance calculation per line
- Contra account display (shows opposite side accounts)
- STT NKC linking back to General Journal

#### 3. Cash Book (Sổ Quỹ Tiền Mặt)

**Endpoint:** `GET /accounting-books/cash-book`

**Purpose:** TK111 (Tiền mặt) ledger with PT/PC voucher details.

**Columns:**
| Column | Description |
|--------|-------------|
| Ngày ghi sổ | Recording date |
| Ngày CT | Document date |
| Số PT | Receipt voucher number (if applicable) |
| Số PC | Payment voucher number (if applicable) |
| Diễn giải | Description |
| Đối tượng | Counterparty |
| TK đối ứng | Contra account |
| Thu (₫) | Receipt/Debit amount |
| Chi (₫) | Payment/Credit amount |
| Tồn quỹ (₫) | Running cash balance |

**Special Features:**
- **Negative Balance Warning:** Red indicator if balance goes below zero
- Opening/Closing balance rows
- Sub-account support (1111 VND, 1112 Foreign Currency)
- TT200 compliant header with company info
- Signature footer block

#### 4. Bank Book (Sổ Tiền Gửi Ngân Hàng)

**Endpoint:** `GET /accounting-books/bank-book`

**Purpose:** TK112 (Tiền gửi ngân hàng) ledger.

**Similar to Cash Book** with:
- BDN/BCN voucher numbers instead of PT/PC
- Sub-account selection for different bank accounts
- Multi-currency support

#### 5. Customer Ledger (Sổ Chi Tiết Phải Thu)

**Endpoint:** `GET /accounting-books/customer-ledger?customerId={id}`

**Purpose:** TK131 (Phải thu khách hàng) by customer.

**Shows:**
- All transactions for specific customer
- Running AR balance
- Invoice references
- Payment applications

#### 6. Vendor Ledger (Sổ Chi Tiết Phải Trả)

**Endpoint:** `GET /accounting-books/vendor-ledger?vendorId={id}`

**Purpose:** TK331 (Phải trả nhà cung cấp) by vendor.

**Shows:**
- All transactions for specific vendor
- Running AP balance
- Purchase invoice references
- Payment applications

#### 7. Inventory Ledger (Sổ Kho)

**Endpoint:** `GET /accounting-books/inventory-ledger?itemId={id}`

**Purpose:** TK152/153/155/156 by inventory item.

**Shows:**
- Inventory movements (Receipt, Issue, Transfer, Adjustment)
- Quantity and value per movement
- Running inventory balance
- Warehouse location

#### 8. Fixed Asset Ledger (Sổ TSCĐ)

**Endpoint:** `GET /accounting-books/fixed-asset-ledger`

**Purpose:** TK211/214 for fixed assets and depreciation.

**Shows:**
- Asset list with acquisition details
- Depreciation schedules
- Accumulated depreciation
- Net book value

#### 9. Payroll Ledger (Sổ Lương)

**Endpoint:** `GET /accounting-books/payroll-ledger`

**Purpose:** TK334 (Phải trả người lao động).

**Shows:**
- Employee salary entries
- Insurance deductions
- Tax withholdings
- Net pay

#### 10. Advance Ledger (Sổ Tạm Ứng)

**Endpoint:** `GET /accounting-books/advance-ledger`

**Purpose:** TK141 (Tạm ứng) for employee advances.

**Shows:**
- Advances issued
- Settlements received
- Outstanding balances by employee

#### 11-12. VAT Input/Output Ledgers

**Endpoints:** 
- `GET /accounting-books/vat-input-ledger` (TK133)
- `GET /accounting-books/vat-output-ledger` (TK333)

**Shows:**
- VAT invoices (input/output)
- Invoice details (number, date, counterparty, tax code)
- Taxable amount
- VAT rate and amount
- Link to journal entries

#### 13-14. Purchase/Sales Journals

**Endpoints:**
- `GET /accounting-books/purchase-journal`
- `GET /accounting-books/sales-journal`

**Purpose:** Special journals for purchase and sales transactions.

**Purchase Journal Shows:**
- Entries with TK331 credits (payables increase)
- Vendor details
- Purchase amounts

**Sales Journal Shows:**
- Entries with TK131 debits (receivables increase)
- Customer details
- Sales amounts

#### Common Features Across All Books:

**Response Structure:**
```typescript
interface BookResult {
  data: unknown[];                // Ledger lines
  openingBalance: {
    debit: Decimal;
    credit: Decimal;
    balance: Decimal;
  };
  closingBalance: {
    debit: Decimal;
    credit: Decimal;
    balance: Decimal;
  };
  totals: {
    totalDebit: Decimal;
    totalCredit: Decimal;
  };
  header?: CashBookHeader;        // For cash/bank books
}
```

**TT200/TT133 Compliant Headers:**
```typescript
interface CashBookHeader {
  companyName: string;
  companyAddress: string;
  accountCode: string;
  accountName: string;
  fundType: string;
  currencyUnit: string;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
}
```

**UI Features:**
- Date range filter (defaults to current fiscal year)
- Tabbed interface for all book types
- Resizable columns (drag to adjust)
- Export to Excel button
- Export to PDF button
- Pagination support
- Vietnamese number formatting

---

### 7. Financial Reports (Báo Cáo Tài Chính)

**Backend Module:** `apps/api/src/modules/financial-reports/`  
**Frontend Pages:** `apps/web/src/app/(dashboard)/reports/`

#### Implemented Reports:

##### B01-DN: Balance Sheet (Bảng Cân Đối Kế Toán)

**Endpoint:** `GET /financial-reports/balance-sheet?asOfDate={date}&comparePriorPeriod={bool}`

**Structure:**
```
TÀI SẢN (Assets)
├── A. Tài sản ngắn hạn (Current Assets - TK 1xx)
│   ├── Cash (TK 111)
│   ├── Bank deposits (TK 112)
│   ├── Accounts receivable (TK 131)
│   ├── Inventory (TK 152, 153, 155, 156)
│   └── Prepaid expenses (TK 142)
│
├── B. Tài sản dài hạn (Non-Current Assets - TK 2xx)
│   ├── Fixed assets (TK 211)
│   ├── Accumulated depreciation (TK 214)
│   └── Construction in progress (TK 241)
│
NGUỒN VỐN (Liabilities & Equity)
├── C. Nợ phải trả (Liabilities - TK 3xx)
│   ├── Accounts payable (TK 331)
│   ├── Taxes payable (TK 333)
│   └── Payroll payable (TK 334)
│
└── D. Vốn chủ sở hữu (Equity - TK 4xx)
    ├── Contributed capital (TK 411)
    └── Retained earnings (TK 421)
```

**Features:**
- Prior period comparison column
- Auto-balance check (Total Assets = Total Liabilities + Equity)
- Account-level breakdown with subtotals

##### B02-DN: Income Statement (Báo Cáo Kết Quả Kinh Doanh)

**Endpoint:** `GET /financial-reports/income-statement?startDate={}&endDate={}&comparePriorPeriod={bool}`

**Structure:**
```
1. Doanh thu bán hàng (Revenue - TK 511)
2. (-) Giá vốn hàng bán (COGS - TK 632)
3. = Lợi nhuận gộp (Gross Profit)
4. (+) Thu nhập tài chính (Financial Income - TK 515)
5. (-) Chi phí tài chính (Financial Expense - TK 635)
6. (-) Chi phí bán hàng (Selling Expense - TK 641)
7. (-) Chi phí quản lý (Admin Expense - TK 642)
8. = Lợi nhuận từ HĐKD (Operating Profit)
9. (+) Thu nhập khác (Other Income - TK 711)
10. (-) Chi phí khác (Other Expense - TK 811)
11. = Lợi nhuận trước thuế (Profit Before Tax)
12. (-) Thuế TNDN (Corporate Income Tax - TK 821)
13. = Lợi nhuận sau thuế (Net Profit)
```

**Features:**
- Period-to-period comparison
- Automatic calculation of all profit levels

##### B03-DN: Cash Flow Statement (Báo Cáo Lưu Chuyển Tiền Tệ)

**Endpoint:** `GET /financial-reports/cash-flow?startDate={}&endDate={}&method={direct|indirect}`

**Structure (Direct Method):**
```
I. Lưu chuyển tiền từ HĐKD (Operating Activities)
   - Cash receipts from customers
   - Cash paid to suppliers
   - Cash paid to employees
   - Interest paid
   - Taxes paid
   
II. Lưu chuyển tiền từ HĐĐT (Investing Activities)
   - Purchase of fixed assets
   - Proceeds from disposal
   
III. Lưu chuyển tiền từ HĐTC (Financing Activities)
   - Proceeds from borrowings
   - Repayment of borrowings
   - Dividends paid

IV. Tăng/giảm tiền thuần (Net Change in Cash)
V. Tiền đầu kỳ (Opening Cash Balance)
VI. Tiền cuối kỳ (Closing Cash Balance)
```

**Features:**
- Direct method (default)
- Indirect method support
- Opening/closing cash reconciliation

##### Other Reports:

**Depreciation Report:**
```
GET /financial-reports/depreciation?startDate={}&endDate={}
```

**Annual Report Package:**
```
GET /financial-reports/annual-package?fiscalYearId={}
```

#### Caching:
- Redis caching with 1-hour TTL
- Cache key includes: company ID, report type, parameters hash
- Automatic cache invalidation on data changes

#### Report UI Features:
- Year selector
- Report card grid with descriptions
- Modal popup for report viewing
- Print-friendly formatting
- Prior period comparison toggle
- Export to Excel/PDF

---

### 8. Customer & Vendor Management (AR/AP)

**Customer Module:** `apps/api/src/modules/customer/`  
**Vendor Module:** `apps/api/src/modules/vendor/`

#### Customer Fields:
| Field | Description |
|-------|-------------|
| code | Unique customer code (e.g., KH001) |
| name | Customer name |
| taxCode | Tax identification number |
| address | Full address |
| phone | Contact phone |
| email | Contact email |
| contactPerson | Main contact name |
| bankAccount | Bank account number |
| bankName | Bank name |
| customFieldValues | JSON for custom fields |

#### Vendor Fields:
Same structure as Customer with code prefix (e.g., NCC001).

#### Outstanding Balance Calculation:
```typescript
// Customer: TK131 balance
const arBalance = debitSum - creditSum;

// Vendor: TK331 balance
const apBalance = creditSum - debitSum;
```

#### Features:
- Search by name, code, tax code
- Active/inactive status
- Outstanding balance display on detail view
- Transaction history from journal lines
- Custom field support

---

### 9. Inventory Management (Hàng Tồn Kho)

**Backend Module:** `apps/api/src/modules/inventory/`

#### Inventory Item Fields:
| Field | Description |
|-------|-------------|
| code | Unique item code |
| name | Item name |
| unit | Unit of measure |
| accountCode | GL account (152, 153, 155, 156) |
| valuationMethod | WEIGHTED_AVERAGE, FIFO, SPECIFIC |
| currentQty | Current quantity on hand |
| currentValue | Current inventory value |
| avgUnitCost | Weighted average cost |

#### Warehouse Model:
| Field | Description |
|-------|-------------|
| code | Warehouse code |
| name | Warehouse name |
| address | Location address |

#### Movement Types:
```typescript
enum MovementType {
  RECEIPT         // Goods received
  ISSUE           // Goods issued
  TRANSFER_IN     // Transfer in from another warehouse
  TRANSFER_OUT    // Transfer out to another warehouse
  ADJUSTMENT      // Inventory adjustment
}
```

#### Movement Fields:
| Field | Description |
|-------|-------------|
| inventoryItemId | Item reference |
| warehouseId | Warehouse reference |
| movementType | Type of movement |
| date | Movement date |
| quantity | Quantity moved (Decimal 18,4) |
| unitCost | Cost per unit (Decimal 18,4) |
| totalCost | Total cost (Decimal 18,0) |
| reference | Reference document number |
| journalEntryId | Link to GL entry |

#### Valuation Methods:
- **Weighted Average:** Running average cost calculation
- **FIFO:** First-In-First-Out costing
- **Specific Identification:** Track specific lot costs

---

### 10. Fixed Assets & Depreciation (TSCĐ & Khấu Hao)

**Backend Module:** `apps/api/src/modules/fixed-asset/`

#### Fixed Asset Fields:
| Field | Description |
|-------|-------------|
| code | Asset code (e.g., TS001) |
| name | Asset name/description |
| category | Asset category |
| acquisitionDate | Purchase date |
| acquisitionCost | Original cost (Decimal 18,0) |
| usefulLifeMonths | Expected useful life |
| depreciationMethod | STRAIGHT_LINE or DECLINING_BALANCE |
| residualValue | Salvage value |
| accumulatedDepr | Total depreciation to date |
| netBookValue | Current NBV |
| monthlyDeprAmount | Monthly depreciation amount |
| departmentAccount | Expense account (627, 641, 642) |
| status | ACTIVE, FULLY_DEPRECIATED, DISPOSED |

#### Depreciation Methods:

**Straight-Line:**
```
Monthly Depreciation = (Cost - Residual) / Useful Life Months
```

**Declining Balance:**
```
Annual Rate = 2 / Useful Life Years
Monthly Depreciation = NBV × (Annual Rate / 12)
```

#### Depreciation Schedule:
| Field | Description |
|-------|-------------|
| periodDate | Month of depreciation |
| amount | Monthly depreciation amount |
| accumulated | Running accumulated depreciation |
| netBookValue | NBV after this period |
| journalEntryId | Link to posted entry |
| isPosted | Whether posted to GL |

#### Asset Acquisition Journal Entry:
```
Dr. TK 211 (Fixed Assets)     xxx,xxx
    Cr. TK 111/112/331 (Cash/Bank/Payable)     xxx,xxx
```

#### Asset Disposal Journal Entries:
```
// Remove accumulated depreciation
Dr. TK 214 (Accumulated Depreciation)     xxx
    Cr. TK 211 (Fixed Assets)             xxx

// Remove remaining NBV
Dr. TK 811 (Other Expense) or TK 111/131 (Proceeds)
    Cr. TK 211 (Fixed Assets)

// Record gain/loss
[Calculated based on proceeds vs NBV]
```

---

### 11. Payroll Processing (Xử Lý Lương)

**Backend Module:** `apps/api/src/modules/payroll/`

#### Employee Fields:
| Field | Description |
|-------|-------------|
| code | Employee code |
| name | Full name |
| department | Department |
| position | Job title |
| baseSalary | Monthly base salary |
| socialInsuranceSalary | Salary for insurance calculation |
| bankAccount | Bank account for payment |
| bankName | Bank name |
| taxCode | Personal tax code |

#### Vietnamese Insurance Rates:
```typescript
// Employee Contribution
const EMPLOYEE_RATES = {
  BHXH: 0.08,   // Social Insurance 8%
  BHYT: 0.015,  // Health Insurance 1.5%
  BHTN: 0.01,   // Unemployment Insurance 1%
};

// Employer Contribution
const EMPLOYER_RATES = {
  BHXH: 0.175,  // Social Insurance 17.5%
  BHYT: 0.03,   // Health Insurance 3%
  BHTN: 0.01,   // Unemployment Insurance 1%
};
```

#### Payroll Record:
| Field | Description |
|-------|-------------|
| periodMonth | Month (1-12) |
| periodYear | Year |
| name | Payroll name |
| status | DRAFT, COMPUTED, POSTED |
| totalGross | Total gross salary |
| totalNet | Total net salary |
| totalDeductions | Total deductions |
| totalPit | Total personal income tax |
| journalEntryId | Link to posted entry |

#### Salary Slip (Per Employee):
| Field | Description |
|-------|-------------|
| baseSalary | Monthly base |
| allowances | Additional allowances |
| overtime | Overtime pay |
| grossSalary | Total gross |
| bhxh | Social insurance deduction |
| bhyt | Health insurance deduction |
| bhtn | Unemployment insurance deduction |
| personalIncomeTax | PIT deduction |
| otherDeductions | Other deductions |
| netSalary | Take-home pay |

#### Payroll Flow:
1. **Create Payroll:** Initialize for period
2. **Compute:** Calculate all salary slips with deductions
3. **Review:** Check calculations
4. **Post:** Create journal entry:
   ```
   Dr. TK 622/627/641/642 (Salary Expense)     xxx
       Cr. TK 334 (Payroll Payable)                xxx
   Dr. TK 334 (Payroll Payable)
       Cr. TK 338 (Insurance Payable)              xxx
       Cr. TK 333 (Tax Payable)                    xxx
   ```

---

### 12. VAT/Tax Management (Quản Lý Thuế GTGT)

**Backend Module:** `apps/api/src/modules/vat/`

#### VAT Record Fields:
| Field | Description |
|-------|-------------|
| direction | INPUT (purchases) or OUTPUT (sales) |
| invoiceNumber | Tax invoice number |
| invoiceDate | Invoice date |
| customerId / vendorId | Counterparty link |
| taxableAmount | Pre-tax amount |
| vatRate | Tax rate (0%, 5%, 8%, 10%) |
| vatAmount | Calculated VAT |
| journalEntryId | Link to GL entry |

#### VAT Rates (TT219):
```typescript
const VAT_RATES = [0, 5, 8, 10];
```

#### VAT Calculation:
```typescript
// Compute period VAT
const vatResult = {
  totalOutputVat: sumOf(OUTPUT records),
  totalInputVat: sumOf(INPUT records),
  netVat: outputVat - inputVat,
};

// If positive: VAT payable
// If negative: VAT refundable/carryforward
```

#### VAT Accounts:
| Code | Description |
|------|-------------|
| TK 133 | VAT Input (deductible) |
| TK 333.1 | VAT Output (payable) |

---

### 13. Bad Debt Provisions (Dự Phòng Nợ Xấu)

**Backend Module:** `apps/api/src/modules/bad-debt/`

#### Bad Debt Provision Fields:
| Field | Description |
|-------|-------------|
| customerId | Customer with doubtful receivable |
| amount | Provision amount |
| reason | Reason for provision |
| status | PROVISIONED, REVERSED, WRITTEN_OFF |
| provisionDate | Date of initial provision |
| reversalDate | Date if reversed |
| writeOffDate | Date if written off |
| journalEntryId | Provision entry |
| reversalEntryId | Reversal entry |
| writeOffEntryId | Write-off entry |

#### Bad Debt Flow:

**1. Create Provision:**
```
Dr. TK 642 (Admin Expense - Bad Debt)     xxx
    Cr. TK 139 (Allowance for Doubtful Accts)    xxx
```

**2. Reverse Provision (if collected):**
```
Dr. TK 139 (Allowance)     xxx
    Cr. TK 642 (Expense Recovery)    xxx
```

**3. Write Off:**
```
Dr. TK 139 (Allowance)     xxx
    Cr. TK 131 (Accounts Receivable)    xxx
```

---

### 14. Custom Fields (Trường Tùy Chỉnh)

**Backend Module:** `apps/api/src/modules/custom-field/`

#### Custom Field Definition:
| Field | Description |
|-------|-------------|
| entityType | Target entity (voucher, customer, vendor, etc.) |
| fieldName | Internal field name |
| fieldLabel | Display label |
| fieldType | TEXT, NUMBER, DATE, SELECT, CHECKBOX, MULTI_SELECT |
| options | JSON array for SELECT types |
| validation | JSON validation rules |
| sortOrder | Display order |

#### Supported Entity Types:
- `voucher`
- `customer`
- `vendor`
- `fixedAsset`
- `inventoryItem`
- `journalEntry`
- `payrollRecord`

#### Field Types:
```typescript
enum CustomFieldType {
  TEXT          // Free text input
  NUMBER        // Numeric input
  DATE          // Date picker
  SELECT        // Single select dropdown
  CHECKBOX      // Boolean toggle
  MULTI_SELECT  // Multiple selection
}
```

#### Validation Options:
```typescript
interface CustomFieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;  // Regex pattern
}
```

---

### 15. Audit Trail (Nhật Ký Hoạt Động)

**Backend Module:** `apps/api/src/modules/audit/`

#### Audit Log Fields:
| Field | Description |
|-------|-------------|
| companyId | Company context |
| userId | User who performed action |
| action | CREATE, UPDATE, DELETE, POST, VOID, LOCK, UNLOCK, CLOSE |
| entityType | Type of entity modified |
| entityId | ID of entity |
| beforeData | JSON snapshot before change |
| afterData | JSON snapshot after change |
| metadata | Additional context |
| ipAddress | Client IP |
| createdAt | Timestamp |

#### Tracked Actions:
- **CREATE:** New entity created
- **UPDATE:** Entity modified
- **DELETE:** Entity removed
- **POST:** Journal entry/voucher posted
- **VOID:** Voucher voided
- **LOCK:** Period locked
- **UNLOCK:** Period unlocked
- **CLOSE:** Fiscal year closed

#### Query Filters:
- By user
- By entity type
- By entity ID
- By action type
- By date range

---

### 16. Year-End Closing (Khóa Sổ Cuối Năm)

**Backend Module:** `apps/api/src/modules/year-end-closing/`

#### Pre-Closing Checklist:
The system validates the following before allowing year-end close:

| Check | Description |
|-------|-------------|
| Năm tài chính chưa đóng | Fiscal year not already closed |
| Không có bút toán nháp | No DRAFT journal entries remaining |
| Tất cả bút toán cân bằng | All entries have debit = credit |
| Khấu hao đã chạy đầy đủ | All depreciation schedules posted |
| Thuế GTGT đã đối chiếu | VAT reconciled |

#### Closing Process:

**Step 1: Close Revenue Accounts to TK 911**
```
// For each revenue account (511, 515, 711)
Dr. TK 511/515/711 (Revenue)     xxx
    Cr. TK 911 (Income Summary)        xxx
```

**Step 2: Close Expense Accounts to TK 911**
```
// For each expense account (632, 635, 641, 642, 811, 821)
Dr. TK 911 (Income Summary)     xxx
    Cr. TK 632/635/641/642/811/821 (Expenses)    xxx
```

**Step 3: Close TK 911 to Retained Earnings**
```
// If Net Profit (TK 911 credit balance)
Dr. TK 911 (Income Summary)     xxx
    Cr. TK 421 (Retained Earnings)     xxx

// If Net Loss (TK 911 debit balance)
Dr. TK 421 (Retained Earnings)     xxx
    Cr. TK 911 (Income Summary)        xxx
```

**Step 4: Update Fiscal Year Status**
- Set fiscal year status to CLOSED
- Lock all fiscal periods

---

## Database Schema

### Core Tables Summary

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `sessions` | JWT refresh tokens |
| `companies` | Tenant companies |
| `company_users` | User-company role assignments |
| `fiscal_years` | Accounting periods |
| `fiscal_periods` | Monthly periods within fiscal year |
| `ledger_accounts` | Chart of accounts |
| `journal_entries` | Journal entry headers |
| `journal_entry_lines` | Journal entry detail lines |
| `accounting_transactions` | Source document links |
| `vouchers` | Cash receipts/payments |
| `customers` | Customer master |
| `vendors` | Vendor master |
| `inventory_items` | Inventory master |
| `warehouses` | Warehouse master |
| `inventory_movements` | Stock movements |
| `fixed_assets` | Fixed asset register |
| `depreciation_schedules` | Depreciation records |
| `employees` | Employee master |
| `payroll_records` | Payroll headers |
| `salary_slips` | Individual salary details |
| `vat_records` | VAT invoices |
| `bad_debt_provisions` | Bad debt allowances |
| `custom_field_definitions` | Custom field configuration |
| `dynamic_report_templates` | Saved report configs |
| `audit_logs` | Audit trail |

### Key Relationships

```
Company (1) ──────── (N) CompanyUser (N) ──────── (1) User
    │
    ├── (N) FiscalYear ──── (N) FiscalPeriod
    │
    ├── (N) LedgerAccount (self-referencing hierarchy)
    │
    ├── (N) JournalEntry ──── (N) JournalEntryLine ──── (1) LedgerAccount
    │                                    │
    │                                    ├── (0..1) Customer
    │                                    ├── (0..1) Vendor
    │                                    ├── (0..1) Employee
    │                                    └── (0..1) InventoryItem
    │
    ├── (N) Voucher ──── (0..1) JournalEntry
    │
    ├── (N) Customer
    ├── (N) Vendor
    ├── (N) InventoryItem ──── (N) InventoryMovement
    ├── (N) Warehouse
    ├── (N) FixedAsset ──── (N) DepreciationSchedule
    ├── (N) Employee ──── (N) SalarySlip
    ├── (N) PayrollRecord
    ├── (N) VatRecord
    ├── (N) BadDebtProvision
    ├── (N) CustomFieldDefinition
    ├── (N) DynamicReportTemplate
    └── (N) AuditLog
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh tokens |
| POST | `/auth/2fa/enable` | Enable 2FA |
| POST | `/auth/2fa/confirm` | Confirm 2FA |
| POST | `/auth/2fa/verify` | Verify 2FA code |

### Companies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/companies` | List user's companies |
| POST | `/companies` | Create company |
| GET | `/companies/:id` | Get company details |
| PATCH | `/companies/:id` | Update company |
| POST | `/companies/:id/fiscal-years` | Create fiscal year |

### Chart of Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chart-of-accounts` | List accounts |
| GET | `/chart-of-accounts/tree` | Get account tree |
| GET | `/chart-of-accounts/search` | Search accounts |
| POST | `/chart-of-accounts` | Create account |
| PATCH | `/chart-of-accounts/:id` | Update account |
| DELETE | `/chart-of-accounts/:id` | Deactivate account |

### Journal Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/journal-entries` | List entries |
| GET | `/journal-entries/:id` | Get entry details |
| POST | `/journal-entries` | Create entry |
| POST | `/journal-entries/:id/post` | Post entry |
| POST | `/journal-entries/:id/reversal` | Create reversal |

### Vouchers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vouchers` | List vouchers |
| GET | `/vouchers/:id` | Get voucher details |
| POST | `/vouchers` | Create voucher |
| POST | `/vouchers/:id/post` | Post voucher |
| POST | `/vouchers/:id/void` | Void voucher |
| POST | `/vouchers/batch-post` | Batch post vouchers |

### Accounting Books
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/accounting-books/general-journal` | General Journal |
| GET | `/accounting-books/general-ledger` | General Ledger |
| GET | `/accounting-books/cash-book` | Cash Book |
| GET | `/accounting-books/bank-book` | Bank Book |
| GET | `/accounting-books/customer-ledger` | Customer Ledger |
| GET | `/accounting-books/vendor-ledger` | Vendor Ledger |
| GET | `/accounting-books/inventory-ledger` | Inventory Ledger |
| GET | `/accounting-books/fixed-asset-ledger` | Fixed Asset Ledger |
| GET | `/accounting-books/payroll-ledger` | Payroll Ledger |
| GET | `/accounting-books/advance-ledger` | Advance Ledger |
| GET | `/accounting-books/vat-input-ledger` | VAT Input Ledger |
| GET | `/accounting-books/vat-output-ledger` | VAT Output Ledger |
| GET | `/accounting-books/purchase-journal` | Purchase Journal |
| GET | `/accounting-books/sales-journal` | Sales Journal |

### Financial Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/financial-reports/balance-sheet` | Balance Sheet (B01-DN) |
| GET | `/financial-reports/income-statement` | Income Statement (B02-DN) |
| GET | `/financial-reports/cash-flow` | Cash Flow (B03-DN) |
| GET | `/financial-reports/depreciation` | Depreciation Report |
| GET | `/financial-reports/annual-package` | Annual Report Package |

### Customers / Vendors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers` | List customers |
| POST | `/customers` | Create customer |
| GET | `/customers/:id` | Get customer with balance |
| PATCH | `/customers/:id` | Update customer |
| GET | `/vendors` | List vendors |
| POST | `/vendors` | Create vendor |
| GET | `/vendors/:id` | Get vendor with balance |
| PATCH | `/vendors/:id` | Update vendor |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/items` | List items |
| POST | `/inventory/items` | Create item |
| GET | `/inventory/items/:id` | Get item with movements |
| PATCH | `/inventory/items/:id` | Update item |
| GET | `/inventory/warehouses` | List warehouses |
| POST | `/inventory/warehouses` | Create warehouse |
| POST | `/inventory/movements` | Create movement |

### Fixed Assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fixed-assets` | List assets |
| POST | `/fixed-assets` | Create asset |
| GET | `/fixed-assets/:id` | Get asset details |
| POST | `/fixed-assets/:id/depreciate` | Run depreciation |
| POST | `/fixed-assets/:id/dispose` | Dispose asset |

### Payroll
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payroll/employees` | List employees |
| POST | `/payroll/employees` | Create employee |
| GET | `/payroll` | List payroll records |
| POST | `/payroll` | Create payroll |
| POST | `/payroll/:id/compute` | Compute salaries |
| POST | `/payroll/:id/post` | Post to GL |

### VAT
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vat` | List VAT records |
| POST | `/vat` | Create VAT record |
| GET | `/vat/compute` | Compute period VAT |

### Bad Debt
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bad-debt` | List provisions |
| POST | `/bad-debt` | Create provision |
| POST | `/bad-debt/:id/reverse` | Reverse provision |
| POST | `/bad-debt/:id/write-off` | Write off debt |

### Year-End Closing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/year-end-closing/checklist` | Get pre-close checklist |
| POST | `/year-end-closing/execute` | Execute closing |

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/audit` | Query audit logs |

---

## Getting Started

### Prerequisites
- Node.js v20+
- pnpm
- PostgreSQL
- Redis

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd amounzer

# Install dependencies
pnpm install

# Setup environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Configure database URL in apps/api/.env
DATABASE_URL="postgresql://user:password@localhost:5432/amounzer"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"

# Run database migrations
pnpm db:migrate

# Seed initial data (optional)
pnpm db:seed

# Start development servers
pnpm dev
```

### Access Points
- **Frontend:** http://localhost:1311
- **Backend API:** http://localhost:1310/api
- **Prisma Studio:** `pnpm db:studio`

---

## Future Roadmap

### Planned Features:
- [ ] Multi-currency with exchange rate history
- [ ] Budget management module
- [ ] Consolidation for group companies
- [ ] Advanced aging reports
- [ ] HTKK XML export for tax filing
- [ ] E-invoice integration
- [ ] Dashboard KPIs with charts
- [ ] Dynamic Report Builder UI
- [ ] Reconciliation tools
- [ ] Approval workflows
- [ ] Document attachments
- [ ] API rate limiting
- [ ] Comprehensive test suite

---

## License

Private / Internal Use

---

## Contact

For questions or feedback about this project, please open an issue or contact the development team.
