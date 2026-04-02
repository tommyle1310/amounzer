## ADDED Requirements

### Requirement: VAT Record Management
The system SHALL track VAT (GTGT) records for both input VAT (VAT đầu vào - TK 133) and output VAT (VAT đầu ra - TK 3331), supporting standard VAT rates applicable in Vietnam.

#### Scenario: Record input VAT on purchase
- **WHEN** a user records a purchase with VAT
- **THEN** the system creates a VAT record with invoice number, vendor, taxable amount, VAT rate, and VAT amount
- **AND** the journal entry debits TK 133 (Input VAT) for the VAT amount

#### Scenario: Record output VAT on sale
- **WHEN** a user records a sale with VAT
- **THEN** the system creates a VAT record with invoice number, customer, taxable amount, VAT rate, and VAT amount
- **AND** the journal entry credits TK 3331 (Output VAT) for the VAT amount

#### Scenario: Multiple VAT rates
- **WHEN** a transaction includes items with different VAT rates (0%, 5%, 8%, 10%)
- **THEN** the system tracks each VAT rate separately in the VAT records

### Requirement: VAT Input/Output Ledger
The system SHALL generate VAT input and output ledgers (Sổ VAT đầu vào / đầu ra) as required by Vietnamese tax law.

#### Scenario: Generate VAT input ledger
- **WHEN** a user views the VAT input ledger for a period
- **THEN** the report lists all purchase invoices with vendor name, tax code, invoice number, date, taxable amount, VAT rate, and VAT amount
- **AND** totals are shown by VAT rate and overall

#### Scenario: Generate VAT output ledger
- **WHEN** a user views the VAT output ledger for a period
- **THEN** the report lists all sales invoices with customer name, tax code, invoice number, date, taxable amount, VAT rate, and VAT amount

### Requirement: VAT Declaration and HTKK Export
The system SHALL compute VAT payable/refundable for each period and export the declaration in HTKK-compatible XML format.

#### Scenario: Calculate VAT payable
- **WHEN** a user runs the VAT calculation for a monthly/quarterly period
- **THEN** the system computes: Output VAT − Input VAT = VAT payable (or refundable if negative)
- **AND** displays the computation breakdown

#### Scenario: Export HTKK XML
- **WHEN** a user exports the VAT declaration
- **THEN** the system generates an XML file compatible with the HTKK tax declaration software
- **AND** the file includes all required fields per the current HTKK schema

### Requirement: VAT Reconciliation
The system SHALL allow reconciliation of VAT records with journal entries to ensure consistency.

#### Scenario: VAT reconciliation check
- **WHEN** a user runs VAT reconciliation for a period
- **THEN** the system compares total Input VAT in VAT records with the TK 133 ledger balance
- **AND** compares total Output VAT in VAT records with the TK 3331 ledger balance
- **AND** highlights any discrepancies
