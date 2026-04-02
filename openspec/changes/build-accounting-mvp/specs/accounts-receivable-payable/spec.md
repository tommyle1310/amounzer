## ADDED Requirements

### Requirement: Customer Management
The system SHALL manage customer records with contact details, tax information, and receivable tracking linked to sub-ledger account TK 131.

#### Scenario: Create a customer
- **WHEN** a user creates a customer with name, tax code (MST), address, and contact info
- **THEN** the customer is saved and automatically linked to sub-ledger tracking under TK 131

#### Scenario: View customer receivable balance
- **WHEN** a user views a customer's detail page
- **THEN** the current outstanding receivable balance is displayed
- **AND** a list of unpaid invoices/transactions is shown with aging information

### Requirement: Vendor Management
The system SHALL manage vendor records with contact details, tax information, and payable tracking linked to sub-ledger account TK 331.

#### Scenario: Create a vendor
- **WHEN** a user creates a vendor with name, tax code (MST), address, and bank account details
- **THEN** the vendor is saved and automatically linked to sub-ledger tracking under TK 331

#### Scenario: View vendor payable balance
- **WHEN** a user views a vendor's detail page
- **THEN** the current outstanding payable balance is displayed
- **AND** a list of unpaid bills/transactions is shown with aging information

### Requirement: Accounts Receivable Lifecycle
The system SHALL track the full AR lifecycle: invoice creation → payment receipt → reconciliation, with customer sub-ledger entries under TK 131.

#### Scenario: Record a customer invoice
- **WHEN** a user records a sales invoice for a customer
- **THEN** a journal entry is created debiting TK 131 (customer sub-ledger) and crediting the revenue account
- **AND** the customer's outstanding balance increases

#### Scenario: Record customer payment
- **WHEN** a user records a payment received from a customer
- **THEN** a journal entry credits TK 131 (customer sub-ledger) and debits TK 111 or TK 112
- **AND** the payment is matched against outstanding invoices
- **AND** the customer's outstanding balance decreases

#### Scenario: Partial payment
- **WHEN** a customer pays less than the full invoice amount
- **THEN** the partial payment is applied to the invoice
- **AND** the remaining balance is tracked as still outstanding

### Requirement: Accounts Payable Lifecycle
The system SHALL track the full AP lifecycle: bill entry → payment → reconciliation, with vendor sub-ledger entries under TK 331.

#### Scenario: Record a vendor bill
- **WHEN** a user records a purchase bill from a vendor
- **THEN** a journal entry is created crediting TK 331 (vendor sub-ledger) and debiting the expense/asset account
- **AND** the vendor's outstanding payable balance increases

#### Scenario: Record vendor payment
- **WHEN** a user records a payment made to a vendor
- **THEN** a journal entry debits TK 331 (vendor sub-ledger) and credits TK 111 or TK 112
- **AND** the payment is matched against outstanding bills

### Requirement: Aging Report for AR/AP
The system SHALL generate aging reports for both receivables and payables with configurable aging buckets.

#### Scenario: AR aging report
- **WHEN** a user generates an accounts receivable aging report
- **THEN** the report displays each customer's outstanding balance grouped by aging buckets (Current, 1-30 days, 31-60 days, 61-90 days, 91-180 days, 181-360 days, 360+ days)
- **AND** totals are shown per bucket and overall

#### Scenario: AP aging report
- **WHEN** a user generates an accounts payable aging report
- **THEN** the report displays each vendor's outstanding balance grouped by aging buckets

### Requirement: Reconciliation Statement
The system SHALL generate reconciliation statements for AR/AP to compare balances between the company and its customers/vendors.

#### Scenario: Generate customer reconciliation statement
- **WHEN** a user generates a reconciliation statement for a specific customer
- **THEN** the statement shows all transactions between the company and the customer within the selected period
- **AND** includes opening balance, transactions, and closing balance
