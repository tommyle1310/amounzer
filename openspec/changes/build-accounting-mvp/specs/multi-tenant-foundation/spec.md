## ADDED Requirements

### Requirement: Company (Tenant) Management
The system SHALL provide multi-tenant company management where each company operates as an isolated tenant with its own data, chart of accounts, fiscal years, and configurations.

#### Scenario: Create a new company
- **WHEN** an admin creates a new company with name, tax code, address, and legal representative
- **THEN** a new tenant is created with a unique companyId
- **AND** the default Vietnamese chart of accounts is seeded for the company
- **AND** all data for this company is isolated from other tenants via PostgreSQL RLS

#### Scenario: Switch between companies
- **WHEN** a user with access to multiple companies selects a different company
- **THEN** all data displayed and queries executed are scoped to the selected company
- **AND** no data from other companies is accessible

#### Scenario: Tenant data isolation
- **WHEN** any database query is executed
- **THEN** PostgreSQL Row-Level Security policies ensure only data belonging to the current tenant's companyId is returned
- **AND** no cross-tenant data leakage is possible even via raw SQL queries from the application

### Requirement: Fiscal Year Management
The system SHALL support flexible fiscal year management with configurable start/end dates and automatic monthly period generation.

#### Scenario: Create a fiscal year
- **WHEN** an admin creates a fiscal year with start date and end date for a company
- **THEN** the fiscal year is created and 12 monthly fiscal periods are auto-generated
- **AND** the fiscal year is linked to the company

#### Scenario: Flexible fiscal year dates
- **WHEN** a company uses a non-calendar fiscal year (e.g., April to March)
- **THEN** the system allows setting any start/end date combination spanning up to 15 months
- **AND** fiscal periods are generated accordingly

#### Scenario: Active fiscal year selection
- **WHEN** a user selects an active fiscal year
- **THEN** all journal entries, vouchers, and reports default to the selected fiscal year's date range

### Requirement: Internationalization Support
The system SHALL support Vietnamese as the primary language with English as a secondary language.

#### Scenario: Default Vietnamese interface
- **WHEN** a user accesses the application without language preference
- **THEN** the interface displays in Vietnamese

#### Scenario: Switch to English
- **WHEN** a user selects English from language settings
- **THEN** all labels, menus, and system messages display in English
- **AND** accounting terminology uses standard English equivalents

### Requirement: Company Configuration
The system SHALL allow per-company configuration of accounting standards, currency, and operational settings.

#### Scenario: Configure accounting standard
- **WHEN** an admin configures the company to use TT200 or TT133
- **THEN** the chart of accounts template and report formats adapt to the selected standard

#### Scenario: Configure base currency
- **WHEN** an admin sets VND as the base currency
- **THEN** all monetary amounts default to VND formatting (no decimals, thousand separators with dots)
