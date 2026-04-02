## ADDED Requirements

### Requirement: Balance Sheet (Bảng cân đối kế toán - Mẫu B01-DN)
The system SHALL generate the Balance Sheet per Vietnamese standard B01-DN format, showing assets, liabilities, and equity with comparative prior period figures.

#### Scenario: Generate balance sheet
- **WHEN** a user generates the Bảng cân đối kế toán for a fiscal year end
- **THEN** the report is formatted per Mẫu B01-DN with all line items mapped to the correct ledger accounts
- **AND** includes current period and prior period comparative columns
- **AND** total assets equal total liabilities plus equity

#### Scenario: Interim balance sheet
- **WHEN** a user generates a balance sheet for an interim date (e.g., end of Q2)
- **THEN** the system computes account balances as of that date
- **AND** formats the report identically to the year-end version

### Requirement: Income Statement (Báo cáo kết quả kinh doanh - Mẫu B02-DN)
The system SHALL generate the Income Statement per Vietnamese standard B02-DN format, showing revenues, cost of goods sold, operating expenses, and net profit/loss.

#### Scenario: Generate income statement
- **WHEN** a user generates the Báo cáo kết quả kinh doanh for a fiscal period
- **THEN** the report shows revenue (TK 511), cost of goods sold (TK 632), gross profit, selling expenses (TK 641), admin expenses (TK 642), financial income/expenses (TK 515/635), other income/expenses (TK 711/811), and net profit before and after tax
- **AND** is formatted per Mẫu B02-DN

#### Scenario: Monthly income statement
- **WHEN** a user generates the income statement for a single month
- **THEN** the report shows only transactions within that month with year-to-date comparative column

### Requirement: Cash Flow Statement (Báo cáo lưu chuyển tiền tệ - Mẫu B03-DN)
The system SHALL generate the Cash Flow Statement per Vietnamese standard B03-DN using the direct method (with option for indirect method).

#### Scenario: Generate cash flow statement (direct method)
- **WHEN** a user generates the Báo cáo lưu chuyển tiền tệ using the direct method
- **THEN** the report categorizes cash flows into Operating, Investing, and Financing activities
- **AND** shows the net change in cash and cash equivalents
- **AND** the closing cash balance matches TK 111 + TK 112 balances

#### Scenario: Generate cash flow statement (indirect method)
- **WHEN** a user selects the indirect method
- **THEN** the operating activities section starts with net profit and adjusts for non-cash items, working capital changes, etc.

### Requirement: Financial Statement Notes (Thuyết minh BCTC)
The system SHALL generate notes to the financial statements with required disclosures per VAS.

#### Scenario: Generate financial statement notes
- **WHEN** a user generates the Thuyết minh BCTC
- **THEN** the system produces structured notes including accounting policies, significant estimates, detailed breakdowns of balance sheet and income statement items, related party transactions, and contingencies

### Requirement: Annual Financial Report Package
The system SHALL produce a complete annual financial report package combining B01-DN, B02-DN, B03-DN, and Thuyết minh BCTC.

#### Scenario: Export complete annual financial report
- **WHEN** a user exports the annual financial report package
- **THEN** the system generates a single PDF containing the balance sheet, income statement, cash flow statement, and notes
- **AND** all reports use consistent formatting and cross-reference correctly

### Requirement: Depreciation Summary Report
The system SHALL generate a depreciation summary report (Báo cáo khấu hao TSCĐ) showing all fixed assets and their depreciation for the period.

#### Scenario: Generate depreciation report
- **WHEN** a user generates the Báo cáo khấu hao TSCĐ for a period
- **THEN** the report lists each asset with original cost, beginning accumulated depreciation, depreciation for the period, and ending accumulated depreciation
- **AND** shows totals by asset category

### Requirement: Financial Report Export
The system SHALL export all financial reports to PDF (VAS-compliant format) and Excel.

#### Scenario: Export B01-DN to PDF
- **WHEN** a user exports the Bảng cân đối kế toán to PDF
- **THEN** the PDF follows the official Mẫu B01-DN layout with company header, signatures area, and all required line items

#### Scenario: Export financial report to Excel
- **WHEN** a user exports any financial report to Excel
- **THEN** the system generates a formatted .xlsx file with all data and formulas intact
