## ADDED Requirements

### Requirement: Bad Debt Provision Tracking
The system SHALL track bad debt provisions (dự phòng nợ khó đòi) as required by Vietnamese accounting standards, linked to relevant receivable accounts.

#### Scenario: Create a bad debt provision
- **WHEN** a user creates a bad debt provision for a specific customer receivable
- **THEN** the system records the provision amount, reason, and related receivable
- **AND** generates a journal entry debiting TK 642 (Management Expense) and crediting TK 229 (Provision for Bad Debts)

#### Scenario: Reverse a bad debt provision
- **WHEN** a previously provisioned receivable is collected
- **THEN** the user reverses the provision
- **AND** a reversal journal entry is generated crediting TK 642 and debiting TK 229

#### Scenario: Write off bad debt
- **WHEN** a receivable is confirmed uncollectible and written off
- **THEN** the system generates entries to write off the receivable from TK 131 against the provision in TK 229
- **AND** tracks the written-off amount in off-balance-sheet account TK 004

### Requirement: Bad Debt Provision Report
The system SHALL generate reports on bad debt provisions showing current provisions, movements, and aging of at-risk receivables.

#### Scenario: Generate bad debt provision report
- **WHEN** a user generates the bad debt provision report for a period
- **THEN** the report shows opening provisions, additions, reversals, write-offs, and closing provisions
- **AND** lists each customer with provisioned amounts and aging status
