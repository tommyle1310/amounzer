## ADDED Requirements

### Requirement: Dynamic Report Builder
The system SHALL provide a drag-and-drop report builder allowing users to create custom reports by selecting dimensions (group by), measures (aggregations), filters, and time ranges from available data sources.

#### Scenario: Create a custom revenue report
- **WHEN** a user creates a dynamic report with dimensions [Customer, Month], measure [Sum of Revenue], and filter [Fiscal Year = 2026, Quarter = Q2]
- **THEN** the system generates a report showing total revenue by customer by month for Q2 2026

#### Scenario: Save and share report template
- **WHEN** a user saves a dynamic report configuration as a template with a name and description
- **THEN** the template is saved as a DynamicReportTemplate (JSON config)
- **AND** other users within the same company can access and run the saved template

#### Scenario: Report builder data sources
- **WHEN** a user opens the report builder
- **THEN** available dimensions include: Account, Customer, Vendor, Department, Project, Date/Period, Custom Fields
- **AND** available measures include: Debit Amount, Credit Amount, Balance, Count, and user-defined calculations

### Requirement: Management Reports - Income/Expense by Category
The system SHALL generate income and expense reports broken down by account category with monthly/quarterly/yearly granularity.

#### Scenario: Monthly income-expense report
- **WHEN** a user generates the Báo cáo thu-chi theo khoản mục for a year
- **THEN** the report shows income and expense totals per category per month with yearly totals
- **AND** supports drill-down from category to individual transactions

### Requirement: Detailed Aging Report
The system SHALL generate detailed aging reports for both AR and AP with configurable aging buckets (Current → 30 → 60 → 90 → 180 → 360+ days).

#### Scenario: Detailed AR aging report
- **WHEN** a user generates the aging công nợ chi tiết report
- **THEN** each outstanding receivable is listed with customer name, invoice date, due date, amount, and aging bucket
- **AND** summary totals per customer and per bucket are provided

### Requirement: Revenue Analysis Reports
The system SHALL generate revenue analysis reports by customer, product/service, and department.

#### Scenario: Revenue by customer report
- **WHEN** a user generates revenue by customer for a period
- **THEN** the report shows total revenue per customer, sorted by amount descending
- **AND** includes percentage of total revenue and comparison with prior period

### Requirement: Cost Analysis Reports
The system SHALL generate cost/expense analysis reports by department and cost category.

#### Scenario: Cost by department report
- **WHEN** a user generates expenses by department for a period
- **THEN** the report shows total expenses per department per expense account
- **AND** includes budget vs actual comparison if budgets are configured

### Requirement: Detailed Cash Flow Report
The system SHALL generate detailed cash flow reports showing all cash movements categorized by type.

#### Scenario: Detailed cash flow report
- **WHEN** a user generates the Báo cáo dòng tiền chi tiết for a period
- **THEN** the report shows every cash receipt and payment with source, category, and amount
- **AND** subtotals by category (operating, investing, financing)

### Requirement: Budget vs Actual Report
The system SHALL generate budget-to-actual comparison reports showing variance analysis.

#### Scenario: Budget vs actual comparison
- **WHEN** a user generates the Báo cáo so sánh ngân sách - thực tế for a period
- **THEN** the report shows budgeted amount, actual amount, variance (amount and percentage) per account/category
- **AND** highlights unfavorable variances exceeding a configurable threshold

### Requirement: Trend Analysis Report
The system SHALL generate trend analysis reports comparing data across 12 months or up to 5 years.

#### Scenario: 12-month trend analysis
- **WHEN** a user generates a 12-month trend report for revenue
- **THEN** the report shows monthly revenue amounts for the trailing 12 months
- **AND** includes a line chart visualization

#### Scenario: 5-year trend analysis
- **WHEN** a user generates a 5-year trend report for profit
- **THEN** the report shows annual profit amounts for the last 5 fiscal years with growth rate calculations

### Requirement: Collection Performance Report
The system SHALL generate a collection performance report (Báo cáo hiệu suất thu tiền) showing how effectively receivables are being collected.

#### Scenario: Generate collection performance report
- **WHEN** a user generates the collection performance report for a period
- **THEN** the report shows total invoiced, total collected, collection rate percentage, average days to collect, and aging distribution

### Requirement: KPI Dashboard
The system SHALL provide a dashboard with key performance indicators including revenue, profit, AR/AP balances, cash flow, and trend charts.

#### Scenario: View KPI dashboard
- **WHEN** a user opens the dashboard
- **THEN** the system displays KPI cards for: total revenue (MTD/YTD), net profit, total receivables, total payables, cash balance, and cash flow
- **AND** includes trend charts (Recharts or equivalent) showing monthly progression

#### Scenario: Dashboard real-time refresh
- **WHEN** new journal entries are posted
- **THEN** the dashboard KPIs update to reflect the latest data (within the cache refresh cycle)

### Requirement: Report Drill-Down
The system SHALL support drill-down from summary reports to underlying transaction details.

#### Scenario: Drill down from summary to detail
- **WHEN** a user clicks on a revenue total in a summary report
- **THEN** the system navigates to a detailed view showing all individual journal entries that compose that total

### Requirement: Report Visualization
The system SHALL include chart visualizations (bar, line, pie, area) in management reports using a charting library (Recharts or equivalent).

#### Scenario: Chart in income-expense report
- **WHEN** a user views the monthly income-expense report
- **THEN** a bar chart comparing income vs expenses per month is displayed alongside the data table

### Requirement: Report Performance
The system SHALL generate all reports within 2 seconds for datasets up to 100,000 journal entries, using caching and materialized views.

#### Scenario: Large dataset report performance
- **WHEN** a company has 100,000 posted journal entries and a user generates the General Ledger
- **THEN** the report renders within 2 seconds
- **AND** the system uses cached/materialized data refreshed after journal posting
