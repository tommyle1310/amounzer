## ADDED Requirements

### Requirement: Voucher Types
The system SHALL support standard Vietnamese accounting voucher types: Phiếu thu (PT - Cash Receipt), Phiếu chi (PC - Cash Payment), Giấy báo nợ (Bank Debit Note), Giấy báo có (Bank Credit Note), and bank transfer vouchers.

#### Scenario: Create a cash receipt voucher (Phiếu thu)
- **WHEN** a user creates a Phiếu thu with payer, amount, reason, and accounting entries
- **THEN** the voucher is saved with type PT and a unique sequential voucher number
- **AND** the linked journal entry debits TK 111 (Cash) and credits the appropriate account

#### Scenario: Create a cash payment voucher (Phiếu chi)
- **WHEN** a user creates a Phiếu chi with payee, amount, reason, and accounting entries
- **THEN** the voucher is saved with type PC and a unique sequential voucher number
- **AND** the linked journal entry credits TK 111 (Cash) and debits the appropriate expense/asset account

#### Scenario: Create a bank transfer voucher
- **WHEN** a user records a bank transfer between accounts
- **THEN** the voucher creates a journal entry debiting the destination bank account (TK 112.x) and crediting the source bank account (TK 112.y)

### Requirement: Legal Document Fields (TT200/TT133 Compliance)
The system SHALL capture all mandatory fields required for legally compliant Phiếu thu/Phiếu chi per Vietnamese Circular TT200/2014 and TT133/2016.

#### Scenario: Administrative information on voucher
- **WHEN** a user creates a PT or PC voucher
- **THEN** the voucher record includes:
  - `voucherBookNo` (Quyển số) — optional book/volume number
  - `voucherNo` (Số phiếu) — unique sequential number per type per fiscal year (e.g., PT-00001)
  - `companyName` (Đơn vị) — auto-filled from Company settings
  - `companyAddress` (Địa chỉ đơn vị) — auto-filled from Company settings

#### Scenario: Transaction party information
- **WHEN** a user enters counterparty details on PT/PC
- **THEN** the voucher captures:
  - `partyFullName` (Họ tên người nộp tiền / nhận tiền) — required field, not just entity reference
  - `partyAddress` (Địa chỉ) — optional but required for legal documents
  - `partyIdNumber` (CMND/CCCD/Hộ chiếu) — optional, for cash transactions over threshold

#### Scenario: Amount and supporting document fields
- **WHEN** a user enters amount on PT/PC
- **THEN** the voucher captures:
  - `amount` (Số tiền) — numeric value
  - `amountInWords` (Số tiền bằng chữ) — auto-generated Vietnamese text from numeric amount
  - `attachmentCount` (Kèm theo ... chứng từ gốc) — number of attached original documents
  - `originalDocumentRefs` (Chứng từ gốc) — references to source documents (invoice, contract, etc.)

#### Scenario: Auto-generate amount in words
- **WHEN** user enters amount 12,500,000 VND
- **THEN** system auto-generates `amountInWords` = "Mười hai triệu năm trăm nghìn đồng chẵn"
- **AND** user can manually override if needed

### Requirement: Foreign Currency Support on Vouchers
The system SHALL support multi-currency transactions on vouchers with exchange rate tracking.

#### Scenario: Foreign currency voucher
- **WHEN** a user creates a PT/PC in foreign currency (e.g., USD)
- **THEN** the voucher captures:
  - `currency` (Loại tiền) — currency code (VND, USD, EUR, etc.)
  - `originalAmount` (Số tiền nguyên tệ) — amount in original currency
  - `exchangeRate` (Tỷ giá) — exchange rate to VND
  - `convertedAmount` (Số tiền quy đổi VND) — calculated: originalAmount × exchangeRate
  - `amountInWords` generated for converted VND amount

#### Scenario: Default to VND
- **WHEN** user creates a standard VND voucher
- **THEN** currency defaults to VND, exchangeRate = 1, and no conversion fields shown in UI

### Requirement: Signature Placeholders for Printed Vouchers
The system SHALL include signature placeholders for all required parties when exporting/printing legal vouchers.

#### Scenario: PT/PC signature requirements
- **WHEN** a user exports/prints a Phiếu thu or Phiếu chi
- **THEN** the printed document includes signature blocks for:
  - **Người lập phiếu** (Preparer) — voucher creator
  - **Kế toán trưởng** (Chief Accountant) — mandatory approval
  - **Thủ trưởng đơn vị / Giám đốc** (Director) — executive approval
  - **Người nộp tiền / Người nhận tiền** (Payer/Payee) — transaction party
  - **Thủ quỹ** (Cashier) — cash handler
- **AND** signature blocks show name and date fields

### Requirement: 3-Layer Document Architecture
The system SHALL maintain clear separation between Source Documents (Chứng từ), Journal Entries (Bút toán), and Ledgers/Books (Sổ sách).

#### Scenario: Voucher as source document layer
- **WHEN** user creates a PT/PC voucher
- **THEN** the voucher stores all legal document data (administrative info, party info, amount in words, attachments)
- **AND** this data is separate from but linked to the generated journal entry

#### Scenario: Journal entry as accounting layer
- **WHEN** a voucher is posted
- **THEN** an immutable journal entry (JournalEntry + JournalEntryLine) is created
- **AND** the journal entry contains only accounting data (accounts, debit/credit amounts, posting date)
- **AND** the journal entry references the source voucher via AccountingTransaction

#### Scenario: Ledger as derived layer
- **WHEN** viewing Sổ quỹ (Cash Book) or Sổ Cái
- **THEN** data is derived from posted journal entries
- **AND** includes reference to original voucher number (PT/PC number, not JE number)

### Requirement: Legal Voucher PDF Export (Chứng từ chuẩn Bộ Tài chính)
The system SHALL generate PDF exports of PT/PC in the official Ministry of Finance format for legal compliance.

#### Scenario: Export Phiếu thu to PDF
- **WHEN** user clicks "Xuất PDF" on a posted Phiếu thu
- **THEN** system generates PDF following Mẫu 01-TT (TT200) or Mẫu 01-TT (TT133) with:
  - Header: Company name, address, MST (tax code)
  - Title: "PHIẾU THU" centered, with Quyển số and Số
  - Date: "Ngày ... tháng ... năm ..."
  - Party info: "Họ tên người nộp tiền:", "Địa chỉ:"
  - Content: "Lý do nộp:", "Số tiền: ... (Viết bằng chữ: ...)"
  - Attachments: "Kèm theo: ... chứng từ gốc"
  - Accounting entry summary: "Nợ TK: ..., Có TK: ..."
  - Signature blocks: All 5 required signatures aligned at bottom

#### Scenario: Export Phiếu chi to PDF
- **WHEN** user clicks "Xuất PDF" on a posted Phiếu chi
- **THEN** system generates PDF following Mẫu 02-TT format with same structure but titled "PHIẾU CHI"

#### Scenario: Batch export vouchers
- **WHEN** user selects multiple vouchers and clicks batch export
- **THEN** system generates a combined PDF or ZIP of individual PDFs

### Requirement: Voucher Entry Form
The system SHALL provide optimized voucher entry forms with keyboard shortcuts, auto-completion of account codes, and real-time balance validation.

#### Scenario: Keyboard-optimized entry
- **WHEN** a user uses Tab to navigate between fields in the voucher form
- **THEN** focus moves logically through date, voucher type, counterparty, account fields, amount, and description
- **AND** account code fields support type-ahead search by code or name

#### Scenario: Auto-suggest counterpart account
- **WHEN** a user selects a voucher type (e.g., Phiếu thu)
- **THEN** the system pre-fills the debit account (TK 111) and positions the cursor on the credit account field

#### Scenario: Real-time balance check
- **WHEN** a user enters debit and credit lines in the voucher
- **THEN** the system displays the running debit/credit totals and highlights any imbalance in real-time

### Requirement: Voucher Posting Workflow
The system SHALL support a posting workflow where vouchers transition from DRAFT to POSTED, generating immutable journal entries upon posting.

#### Scenario: Post a voucher
- **WHEN** a user posts a DRAFT voucher
- **THEN** the corresponding journal entry is created and posted
- **AND** the voucher status changes to POSTED and becomes immutable

#### Scenario: Batch post vouchers
- **WHEN** a user selects multiple DRAFT vouchers and initiates batch posting
- **THEN** all selected vouchers are validated and posted in sequence
- **AND** any voucher that fails validation is skipped with an error message, and the rest continue posting

#### Scenario: Void a posted voucher
- **WHEN** a user voids a POSTED voucher
- **THEN** a reversal journal entry is created
- **AND** the original voucher is marked as VOIDED with a reference to the reversal

### Requirement: Voucher Numbering
The system SHALL auto-generate sequential voucher numbers per voucher type per fiscal year.

#### Scenario: Auto-number by type
- **WHEN** a new Phiếu thu is created
- **THEN** the system assigns the next number in the PT series (e.g., PT-2026-00001)

#### Scenario: Separate series per type
- **WHEN** Phiếu thu and Phiếu chi are created in the same period
- **THEN** each maintains its own independent numbering sequence (PT-2026-00005, PC-2026-00012)

### Requirement: Voucher Search and Listing
The system SHALL provide a voucher listing page with filtering by type, date range, status, counterparty, and amount range.

#### Scenario: Filter vouchers by date range
- **WHEN** a user filters vouchers for January 2026
- **THEN** only vouchers with dates between 01/01/2026 and 31/01/2026 are displayed

#### Scenario: Search by counterparty
- **WHEN** a user searches for vouchers involving "Công ty ABC"
- **THEN** all vouchers where the counterparty matches are returned regardless of voucher type
