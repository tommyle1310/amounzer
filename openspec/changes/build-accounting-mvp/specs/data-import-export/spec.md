## ADDED Requirements

### Requirement: Excel/CSV Import
The system SHALL support bulk import of journal entries, vouchers, customers, vendors, inventory items, and fixed assets from Excel (.xlsx) and CSV files using configurable templates.

#### Scenario: Import journal entries from Excel
- **WHEN** a user uploads an Excel file matching the journal entry import template
- **THEN** the system parses the file, validates each row (date, accounts, amounts, balance check), and creates DRAFT journal entries
- **AND** displays a preview with validation results before confirming import

#### Scenario: Import with validation errors
- **WHEN** an import file contains rows with invalid data (unknown account codes, unbalanced entries)
- **THEN** the system highlights errors per row with clear messages
- **AND** allows the user to import valid rows only or cancel the entire import

#### Scenario: Download import template
- **WHEN** a user requests an import template for a specific entity type
- **THEN** the system provides an Excel template with correct column headers, data types, and example data

### Requirement: Excel Export
The system SHALL export all accounting books, reports, and entity lists to Excel (.xlsx) format with proper formatting.

#### Scenario: Export accounting book to Excel
- **WHEN** a user exports any accounting book (Sổ Cái, Sổ Nhật ký chung, etc.) to Excel
- **THEN** the system generates an .xlsx file with column headers, data rows, subtotals, and grand totals
- **AND** number columns use proper number formatting (VND with no decimals)

#### Scenario: Export filtered data
- **WHEN** a user applies filters to a data view and exports to Excel
- **THEN** only the filtered data is exported with filter criteria noted in the file header

### Requirement: PDF Export with Ministry of Finance Templates
The system SHALL export accounting books and financial reports to PDF following official Ministry of Finance (MoF) templates.

#### Scenario: Export sổ sách to MoF-compliant PDF
- **WHEN** a user exports an accounting book to PDF
- **THEN** the PDF follows the official MoF template layout including company header, report title in Vietnamese, column structure, and footer with signature lines

#### Scenario: Export financial report to PDF
- **WHEN** a user exports B01-DN, B02-DN, or B03-DN to PDF
- **THEN** the PDF matches the official form layout specified by Bộ Tài chính
- **AND** includes preparer and approver signature areas

### Requirement: HTKK XML Export
The system SHALL export VAT declarations in HTKK-compatible XML format for submission to tax authorities.

#### Scenario: Export VAT declaration XML
- **WHEN** a user exports the VAT declaration for a tax period
- **THEN** the system generates an XML file compatible with the HTKK tax declaration software
- **AND** includes all required elements per the current HTKK schema version

### Requirement: Flexible Import Templates
The system SHALL allow admins to configure import field mappings to accommodate different Excel layouts from external systems.

#### Scenario: Configure custom import mapping
- **WHEN** an admin configures a custom import mapping that maps column A to "Date", column B to "Account Code", etc.
- **THEN** future imports using this mapping correctly parse files with non-standard column arrangements
