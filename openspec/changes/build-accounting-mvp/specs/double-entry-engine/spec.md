## ADDED Requirements

### Requirement: Double-Entry Journal Entry
The system SHALL enforce double-entry bookkeeping where every journal entry MUST have total debits equal to total credits.

#### Scenario: Create a balanced journal entry
- **WHEN** a user creates a journal entry with debit lines totaling 10,000,000 VND and credit lines totaling 10,000,000 VND
- **THEN** the journal entry is saved successfully in DRAFT status

#### Scenario: Reject unbalanced journal entry
- **WHEN** a user attempts to save a journal entry where total debits do not equal total credits
- **THEN** the system rejects the save and displays a validation error showing the imbalance amount

#### Scenario: Multi-line journal entry
- **WHEN** a user creates a journal entry with multiple debit lines and multiple credit lines
- **THEN** the system validates that the sum of all debit amounts equals the sum of all credit amounts

### Requirement: Journal Entry Lifecycle
The system SHALL manage journal entries through a defined lifecycle: DRAFT → POSTED, with POSTED entries being immutable.

#### Scenario: Post a draft journal entry
- **WHEN** a user posts a DRAFT journal entry
- **THEN** the entry status changes to POSTED
- **AND** the entry becomes immutable (no edits or deletions allowed)
- **AND** account balances are updated in real-time

#### Scenario: Prevent editing posted entries
- **WHEN** a user attempts to edit a POSTED journal entry
- **THEN** the system rejects the edit and suggests creating a correcting entry instead

#### Scenario: Delete a draft journal entry
- **WHEN** a user deletes a DRAFT journal entry
- **THEN** the entry is removed from the system
- **AND** no account balances are affected

### Requirement: Correcting and Adjustment Entries
The system SHALL support correcting entries for posted journal entries by creating reversal entries followed by new corrected entries.

#### Scenario: Create a correcting entry
- **WHEN** a user initiates correction of a POSTED journal entry
- **THEN** the system creates a REVERSAL entry (swapping debits and credits of the original)
- **AND** creates a new DRAFT entry pre-filled with the original data for editing
- **AND** the original entry is linked to both the reversal and correction

#### Scenario: Adjustment entry at period end
- **WHEN** a user creates an adjustment entry for accruals or deferrals
- **THEN** the entry is tagged as type ADJUSTMENT
- **AND** it appears in period-end adjustment reports

### Requirement: Accounting Transaction Linkage
The system SHALL link journal entries to their source documents (vouchers, invoices, payroll records, depreciation schedules) via an AccountingTransaction record.

#### Scenario: Journal entry linked to voucher
- **WHEN** a voucher is posted and generates a journal entry
- **THEN** an AccountingTransaction record links the journal entry to the source voucher
- **AND** users can navigate from the journal entry to the source document and vice versa

#### Scenario: Auto-generated journal entries
- **WHEN** a module (payroll, depreciation, inventory) generates journal entries automatically
- **THEN** each entry is linked to its source record via AccountingTransaction
- **AND** the entry description includes the source module and reference number

### Requirement: Journal Entry Numbering
The system SHALL auto-generate sequential journal entry numbers per fiscal year per company.

#### Scenario: Auto-number on creation
- **WHEN** a new journal entry is created
- **THEN** the system assigns the next sequential number in the format configured for the company (e.g., JE-2026-00001)

#### Scenario: Number continuity across fiscal years
- **WHEN** a new fiscal year starts
- **THEN** the journal entry numbering resets to 1 for the new fiscal year

### Requirement: Posting Date Validation
The system SHALL validate that journal entry posting dates fall within an open (unlocked) fiscal period.

#### Scenario: Post to open period
- **WHEN** a user posts a journal entry with a date in an open fiscal period
- **THEN** the entry is posted successfully

#### Scenario: Reject posting to locked period
- **WHEN** a user attempts to post a journal entry with a date in a locked fiscal period
- **THEN** the system rejects the posting with an error indicating the period is locked
