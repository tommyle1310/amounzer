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
