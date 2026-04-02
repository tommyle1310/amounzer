## ADDED Requirements

### Requirement: Vietnamese Chart of Accounts
The system SHALL provide a hierarchical chart of accounts based on Vietnamese accounting standards (TT 200/2014/TT-BTC and TT 133/2016/TT-BTC) with accounts numbered from TK 111 to TK 999.

#### Scenario: Seed default chart of accounts
- **WHEN** a new company is created
- **THEN** the system seeds the standard Vietnamese chart of accounts based on the selected standard (TT200 or TT133)
- **AND** all top-level accounts (111, 112, 131, 152, 211, etc.) are created with correct Vietnamese names and classifications

#### Scenario: Account hierarchy with sub-accounts
- **WHEN** a user views the chart of accounts
- **THEN** accounts are displayed in a tree structure showing parent-child relationships
- **AND** sub-accounts (e.g., 1111 - Tiền Việt Nam, 1112 - Ngoại tệ under 111 - Tiền mặt) are nested under their parent

### Requirement: Account CRUD Operations
The system SHALL allow creating, reading, updating, and deactivating ledger accounts within the company's chart of accounts.

#### Scenario: Create a sub-account
- **WHEN** a user creates a new sub-account under an existing parent (e.g., 11111 under 1111)
- **THEN** the account is created with the specified code, name, and type (Asset, Liability, Equity, Revenue, Expense)
- **AND** the account inherits the parent's classification

#### Scenario: Deactivate an account
- **WHEN** a user deactivates a ledger account that has no transactions in the current fiscal year
- **THEN** the account is marked as inactive and no longer appears in dropdown selections
- **AND** historical data referencing the account remains intact

#### Scenario: Prevent deletion of accounts with transactions
- **WHEN** a user attempts to delete an account that has posted journal entries
- **THEN** the system rejects the deletion and displays an error message
- **AND** suggests deactivation instead

### Requirement: Account Classification
The system SHALL classify accounts into standard Vietnamese accounting categories: Assets (Loại 1-2), Liabilities (Loại 3), Equity (Loại 4), Revenue (Loại 5-7), and Expenses (Loại 6-8).

#### Scenario: Account type determines balance sheet placement
- **WHEN** a report queries account balances
- **THEN** each account's classification (debit-normal or credit-normal) is used to correctly compute and display balances

#### Scenario: Off-balance-sheet accounts
- **WHEN** the chart includes off-balance-sheet accounts (TK 001-009)
- **THEN** these accounts are tracked separately and excluded from the main balance sheet

### Requirement: Account Search and Filtering
The system SHALL provide fast search and filtering of the chart of accounts by code, name, type, and status.

#### Scenario: Search by account code prefix
- **WHEN** a user types "131" in the account search
- **THEN** the system returns TK 131 and all its sub-accounts (1311, 1312, etc.)

#### Scenario: Filter by account type
- **WHEN** a user filters by "Asset" type
- **THEN** only accounts classified as assets (Loại 1-2) are displayed
