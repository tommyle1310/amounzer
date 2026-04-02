## ADDED Requirements

### Requirement: General Journal (Sổ Nhật ký chung)
The system SHALL generate the General Journal listing all posted journal entries in chronological order with entry number, date, description, account codes, debit amounts, and credit amounts.

#### Scenario: View General Journal for a period
- **WHEN** a user views the Sổ Nhật ký chung for a fiscal period
- **THEN** all posted journal entries within the period are displayed in date order
- **AND** each entry shows entry number, posting date, description, and individual debit/credit lines with account codes and amounts

#### Scenario: Filter General Journal by date range
- **WHEN** a user filters the General Journal by a custom date range
- **THEN** only entries within the specified range are displayed with correct totals

### Requirement: General Ledger (Sổ Cái)
The system SHALL generate the General Ledger showing all transactions per account with opening balance, debits, credits, and closing balance, including contra account references.

#### Scenario: View General Ledger for an account
- **WHEN** a user views the Sổ Cái for TK 111 (Cash) for a fiscal period
- **THEN** the report shows opening balance, each transaction with date, description, contra account (tài khoản đối ứng), debit amount, credit amount, and running balance
- **AND** the closing balance equals opening + debits − credits (for debit-normal accounts)

#### Scenario: General Ledger detail with contra accounts
- **WHEN** a journal entry debits TK 111 and credits TK 511
- **THEN** the General Ledger for TK 111 shows the contra account as TK 511
- **AND** the General Ledger for TK 511 shows the contra account as TK 111

### Requirement: Cash Book (Sổ quỹ tiền mặt - TK 111)
The system SHALL generate the Cash Book showing all cash transactions with running balance, following Ministry of Finance format per TT200/TT133.

#### Scenario: Cash Book header fields (TT200/TT133 compliance)
- **WHEN** a user views or exports the Sổ quỹ tiền mặt
- **THEN** the report header includes:
  - **Tài khoản** (Account code) — e.g., "1111 - Tiền mặt VNĐ", "1112 - Tiền mặt ngoại tệ"
  - **Loại quỹ** (Fund type) — VNĐ, USD, EUR, or other currency
  - **Đơn vị tính** (Currency unit) — e.g., "VNĐ", "USD"
  - **Năm** (Fiscal year) — e.g., "2026"
  - Company name and address

#### Scenario: Cash Book body with separate voucher references
- **WHEN** a user views the Sổ quỹ tiền mặt for a period
- **THEN** each row shows:
  - **Ngày tháng ghi sổ** (Recording date) — date entered into ledger
  - **Ngày tháng chứng từ** (Document date) — date on the original voucher
  - **Số hiệu chứng từ Thu** (Receipt voucher number) — PT number (e.g., PT-00001), blank for payments
  - **Số hiệu chứng từ Chi** (Payment voucher number) — PC number (e.g., PC-00001), blank for receipts
  - **Diễn giải** (Description) — transaction description
  - **Tài khoản đối ứng** (Contra account) — the other side of the entry
  - **Thu (Nợ)** (Debit/Receipt) — cash receipt amount
  - **Chi (Có)** (Credit/Payment) — cash payment amount
  - **Tồn (Số dư)** (Running balance)

#### Scenario: View cash book for a period
- **WHEN** a user views the Sổ quỹ tiền mặt for a month
- **THEN** the report shows opening cash balance, each cash receipt and payment with separate PT/PC voucher references, description, amount, and running balance
- **AND** the closing balance matches the current TK 111 balance

#### Scenario: Cash Book footer and signatures
- **WHEN** a user exports the Sổ quỹ tiền mặt to PDF
- **THEN** the report footer includes:
  - **Tổng cộng** (Totals) for receipts and payments
  - **Ghi chú** (Notes) section — optional remarks
  - Signature blocks: **Người ghi sổ** (Bookkeeper), **Kế toán trưởng** (Chief Accountant), **Giám đốc** (Director)

#### Scenario: Multi-currency Cash Book
- **WHEN** user views Sổ quỹ tiền mặt for TK 1112 (foreign currency cash)
- **THEN** amounts are shown in original currency with exchange rate column
- **AND** VND equivalent shown where applicable

### Requirement: Bank Book (Sổ tiền gửi ngân hàng - TK 112)
The system SHALL generate the Bank Book showing all bank transactions with running balance per bank account, following Ministry of Finance format.

#### Scenario: Bank Book header fields
- **WHEN** a user views or exports the Sổ tiền gửi ngân hàng
- **THEN** the report header includes:
  - **Tài khoản** (Account code) — e.g., "1121 - Tiền gửi VNĐ - Vietcombank"
  - **Loại tiền** (Currency type) — VNĐ, USD, etc.
  - **Đơn vị tính** (Currency unit)
  - **Năm** (Fiscal year)
  - **Ngân hàng** (Bank name and account number)

#### Scenario: Bank Book body with voucher references
- **WHEN** a user views the Sổ tiền gửi ngân hàng for a period
- **THEN** each row shows:
  - **Ngày ghi sổ** (Recording date)
  - **Ngày chứng từ** (Document date)
  - **Số chứng từ** (Document number) — bank debit note or credit note number
  - **Diễn giải** (Description)
  - **Tài khoản đối ứng** (Contra account)
  - **Ghi nợ** (Debit) — deposits
  - **Ghi có** (Credit) — withdrawals
  - **Số dư** (Running balance)

#### Scenario: View bank book for a specific bank account
- **WHEN** a user views the Sổ tiền gửi ngân hàng for a specific bank sub-account (e.g., TK 1121 - Vietcombank)
- **THEN** the report shows opening balance, each transaction with date, reference, description, amount, and running balance

### Requirement: Customer Receivable Detail Ledger (Sổ chi tiết phải thu - TK 131)
The system SHALL generate detailed receivable ledgers per customer showing all transactions affecting TK 131.

#### Scenario: View receivable detail for a customer
- **WHEN** a user views the Sổ chi tiết phải thu khách hàng for a specific customer
- **THEN** the report shows opening balance, each invoice and payment with date, reference, debit, credit, and running balance

### Requirement: Vendor Payable Detail Ledger (Sổ chi tiết phải trả - TK 331)
The system SHALL generate detailed payable ledgers per vendor showing all transactions affecting TK 331.

#### Scenario: View payable detail for a vendor
- **WHEN** a user views the Sổ chi tiết phải trả nhà cung cấp for a specific vendor
- **THEN** the report shows opening balance, each bill and payment with date, reference, debit, credit, and running balance

### Requirement: Inventory Detail Ledger (Sổ chi tiết vật tư hàng tồn kho - TK 152)
The system SHALL generate detailed inventory ledgers per item showing all movements with quantities and values.

#### Scenario: View inventory detail for an item
- **WHEN** a user views the Sổ chi tiết vật tư hàng tồn kho for a specific item
- **THEN** the report shows opening quantity/value, each receipt and issue with date, reference, quantity, unit cost, total value, and running balance

### Requirement: Fixed Asset and Depreciation Ledger (Sổ theo dõi TSCĐ - TK 211, 214)
The system SHALL generate fixed asset tracking ledgers showing all assets, their depreciation schedules, and accumulated depreciation.

#### Scenario: View fixed asset tracking ledger
- **WHEN** a user views the Sổ theo dõi TSCĐ & khấu hao
- **THEN** the report lists all assets with acquisition date, cost, useful life, depreciation method, accumulated depreciation, and net book value

### Requirement: Payroll Ledger (Sổ lương - TK 334)
The system SHALL generate the payroll ledger showing salary transactions per employee.

#### Scenario: View payroll ledger
- **WHEN** a user views the Sổ lương và các khoản phải trả người lao động
- **THEN** the report shows each employee with opening balance, salary accruals, payments, and closing balance for the period

### Requirement: Advance Tracking Ledger (Sổ theo dõi tạm ứng - TK 141)
The system SHALL generate advance tracking ledgers showing employee advances and settlements.

#### Scenario: View advance tracking ledger
- **WHEN** a user views the Sổ theo dõi tạm ứng per employee
- **THEN** the report shows opening advance balance, new advances, settlements, and closing balance

### Requirement: VAT Ledgers (Sổ VAT đầu vào / đầu ra - TK 133 / 333)
The system SHALL generate VAT input and output ledgers per fiscal period.

#### Scenario: View VAT input ledger
- **WHEN** a user views the Sổ VAT đầu vào for a period
- **THEN** the report lists all purchase invoices with vendor, invoice details, taxable amount, VAT rate, and VAT amount

### Requirement: Purchase and Sales Journals (Sổ nhật ký mua bán)
The system SHALL generate purchase and sales journals listing all purchase and sales transactions.

#### Scenario: View purchase journal
- **WHEN** a user views the Sổ nhật ký mua for a period
- **THEN** the report lists all purchase transactions with date, vendor, invoice reference, amount, and VAT

#### Scenario: View sales journal
- **WHEN** a user views the Sổ nhật ký bán for a period
- **THEN** the report lists all sales transactions with date, customer, invoice reference, amount, and VAT

### Requirement: Revenue Detail by Category (Sổ chi tiết doanh thu theo khoản mục)
The system SHALL generate revenue detail ledgers broken down by revenue category/account.

#### Scenario: View revenue detail by category
- **WHEN** a user views the Sổ chi tiết doanh thu theo khoản mục for a period
- **THEN** the report shows revenue amounts per revenue account (TK 511, 515, 711) with transaction details

### Requirement: Equity Summary Ledger (Sổ tổng hợp nguồn vốn)
The system SHALL generate an equity summary showing all equity accounts and their movements.

#### Scenario: View equity summary
- **WHEN** a user views the Sổ tổng hợp nguồn vốn for a fiscal year
- **THEN** the report shows opening equity, changes (profit/loss, capital contributions, dividends), and closing equity per equity account (TK 411, 421, etc.)

### Requirement: Accounting Book Export
The system SHALL export all accounting books to PDF (following Ministry of Finance templates) and Excel formats.

#### Scenario: Export a book to PDF
- **WHEN** a user exports the Sổ Nhật ký chung to PDF
- **THEN** the system generates a PDF file formatted according to the official Ministry of Finance template
- **AND** includes company header, report title, period, and all data rows with proper formatting

#### Scenario: Export a book to Excel
- **WHEN** a user exports any accounting book to Excel
- **THEN** the system generates an .xlsx file with proper column headers, data formatting, and summary rows

### Requirement: Accounting Book Audit Trail
The system SHALL display audit trail information on each accounting book entry showing who created, modified, or posted each transaction.

#### Scenario: View audit trail on journal entry
- **WHEN** a user clicks on a journal entry in any accounting book
- **THEN** the system shows who created the entry, when it was created, who posted it, and when it was posted
