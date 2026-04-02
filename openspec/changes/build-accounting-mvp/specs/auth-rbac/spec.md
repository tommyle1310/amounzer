## ADDED Requirements

### Requirement: User Authentication
The system SHALL provide secure user authentication using JWT tokens with refresh token rotation.

#### Scenario: User login with email and password
- **WHEN** a user submits valid email and password credentials
- **THEN** the system authenticates the user and returns a JWT access token and refresh token
- **AND** the access token expires in a configurable period (default 15 minutes)

#### Scenario: Invalid credentials
- **WHEN** a user submits invalid credentials
- **THEN** the system returns a generic "Invalid email or password" error
- **AND** does not reveal whether the email exists

#### Scenario: Token refresh
- **WHEN** a user's access token expires and they have a valid refresh token
- **THEN** the system issues a new access token and rotates the refresh token
- **AND** the old refresh token is invalidated

### Requirement: Two-Factor Authentication (2FA)
The system SHALL support optional TOTP-based two-factor authentication for enhanced security.

#### Scenario: Enable 2FA
- **WHEN** a user enables 2FA in their security settings
- **THEN** the system generates a TOTP secret, displays a QR code for authenticator app setup, and requires verification of a valid code before activation

#### Scenario: Login with 2FA enabled
- **WHEN** a user with 2FA enabled provides valid credentials
- **THEN** the system prompts for a TOTP code before issuing tokens

### Requirement: Role-Based Access Control
The system SHALL enforce role-based access control with predefined roles: Admin, Accountant, Manager, and Viewer.

#### Scenario: Admin full access
- **WHEN** a user with Admin role accesses the system
- **THEN** they have full access to all features including company settings, user management, year-end closing, and all data entry/reports

#### Scenario: Accountant data entry access
- **WHEN** a user with Accountant role accesses the system
- **THEN** they can create/edit/post vouchers, journal entries, manage AR/AP, inventory, payroll
- **AND** they cannot modify company settings, manage users, or perform year-end closing

#### Scenario: Manager read and approve access
- **WHEN** a user with Manager role accesses the system
- **THEN** they can view all data, run all reports, and approve batch operations
- **AND** they cannot directly create or edit transactions

#### Scenario: Viewer read-only access
- **WHEN** a user with Viewer role accesses the system
- **THEN** they can only view data and run reports
- **AND** they cannot create, edit, or post any transactions

### Requirement: User Management
The system SHALL allow Admins to create, edit, deactivate, and assign roles to users within their company.

#### Scenario: Create a new user
- **WHEN** an Admin creates a new user with email, name, and role
- **THEN** the user is created and receives an invitation email to set their password

#### Scenario: Deactivate a user
- **WHEN** an Admin deactivates a user
- **THEN** the user can no longer log in
- **AND** all existing sessions are invalidated
- **AND** the user's historical actions in the audit trail are preserved

### Requirement: Multi-Company User Access
The system SHALL support users having access to multiple companies with potentially different roles per company.

#### Scenario: User with access to multiple companies
- **WHEN** a user who belongs to Company A (as Accountant) and Company B (as Viewer) logs in
- **THEN** they see a company selector
- **AND** switching companies loads data for the selected company with the appropriate role permissions

### Requirement: Session Security
The system SHALL enforce session security with configurable timeout, concurrent session limits, and secure cookie handling.

#### Scenario: Session timeout
- **WHEN** a user is inactive for longer than the configured session timeout
- **THEN** the session expires and the user is redirected to the login page

#### Scenario: Rate limiting on login
- **WHEN** more than 5 failed login attempts occur for an account within 15 minutes
- **THEN** the account is temporarily locked for 15 minutes
- **AND** the lockout event is recorded in the audit trail
