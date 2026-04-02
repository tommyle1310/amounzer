## ADDED Requirements

### Requirement: Year-End Closing Workflow
The system SHALL provide a structured year-end closing workflow that performs closing entries (kết chuyển), computes net profit/loss, and locks the fiscal year.

#### Scenario: Initiate year-end closing
- **WHEN** a user initiates year-end closing for a fiscal year
- **THEN** the system validates that all journal entries for the year are posted
- **AND** displays a pre-closing checklist (all periods balanced, no pending drafts, depreciation run, VAT reconciled)

#### Scenario: Generate closing entries (kết chuyển)
- **WHEN** the user confirms the closing process
- **THEN** the system auto-generates closing journal entries:
  - Close all revenue accounts (TK 511, 515, 711) to TK 911 (Xác định kết quả kinh doanh)
  - Close all expense accounts (TK 632, 635, 641, 642, 811) to TK 911
  - Transfer net profit/loss from TK 911 to TK 421 (Lợi nhuận chưa phân phối)
- **AND** all closing entries are posted automatically

#### Scenario: Compute retained earnings
- **WHEN** closing entries are posted
- **THEN** the system computes net profit/loss for the year
- **AND** the amount is reflected in TK 421 (Retained Earnings)

### Requirement: Fiscal Period Locking
The system SHALL support locking fiscal periods to prevent any further posting after a period is closed.

#### Scenario: Lock a fiscal period
- **WHEN** an admin locks a fiscal period (e.g., January 2026)
- **THEN** no new journal entries can be posted with dates within that period
- **AND** existing posted entries remain immutable

#### Scenario: Lock entire fiscal year
- **WHEN** year-end closing is completed
- **THEN** all 12 monthly periods of the fiscal year are locked
- **AND** the fiscal year status changes to CLOSED

#### Scenario: Unlock a period (admin override)
- **WHEN** an admin with sufficient privileges unlocks a previously locked period
- **THEN** the period is reopened for posting
- **AND** the unlock action is recorded in the audit trail

### Requirement: Opening Balance Carry-Forward
The system SHALL carry forward closing balances from the previous fiscal year as opening balances for the new fiscal year.

#### Scenario: Auto-carry forward balances
- **WHEN** a new fiscal year is opened after year-end closing of the previous year
- **THEN** the system carries forward all balance sheet account (assets, liabilities, equity) closing balances as opening balances for the new year
- **AND** income statement accounts (revenue, expenses) start at zero

#### Scenario: Verify opening balances
- **WHEN** a user views the trial balance for the first day of the new fiscal year
- **THEN** the opening balances match the closing balances of the prior year for all balance sheet accounts
