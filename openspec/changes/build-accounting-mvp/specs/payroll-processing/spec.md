## ADDED Requirements

### Requirement: Payroll Record Management
The system SHALL manage payroll records for each pay period, tracking gross salary, deductions (social insurance, health insurance, unemployment insurance, PIT), and net salary for each employee, linked to TK 334 (Phải trả người lao động).

#### Scenario: Create a payroll record for a pay period
- **WHEN** a user creates a payroll record for a monthly pay period
- **THEN** the system creates individual salary slips for each employee
- **AND** calculates gross salary, mandatory deductions (BHXH, BHYT, BHTN), personal income tax, and net pay

#### Scenario: View payroll summary
- **WHEN** a user views the payroll record for a period
- **THEN** the system displays a summary table with each employee's gross, deductions, PIT, and net pay
- **AND** shows totals for the entire payroll

### Requirement: Salary Slip Generation
The system SHALL generate individual salary slips per employee per pay period with detailed line items.

#### Scenario: Generate employee salary slip
- **WHEN** the payroll for a period is processed
- **THEN** each employee receives a salary slip showing basic salary, allowances, overtime, deductions, PIT, and net amount

#### Scenario: Export salary slips
- **WHEN** a user exports salary slips
- **THEN** the system generates PDF salary slips (individual or batch) suitable for distribution to employees

### Requirement: Payroll Journal Entry Generation
The system SHALL automatically generate journal entries from payroll records with correct account mappings.

#### Scenario: Post payroll journal entries
- **WHEN** a user posts a payroll record
- **THEN** the system generates journal entries:
  - Debit TK 622/627/641/642 (salary expense by department) for gross salary
  - Credit TK 334 (payable to employees) for net salary
  - Credit TK 338 (social/health/unemployment insurance payable) for deductions
  - Credit TK 3335 (PIT payable) for personal income tax

#### Scenario: Payroll sub-ledger report
- **WHEN** a user generates the Sổ lương và các khoản phải trả người lao động (TK 334)
- **THEN** the report shows all payroll transactions per employee with opening balance, debits, credits, and closing balance for the period
