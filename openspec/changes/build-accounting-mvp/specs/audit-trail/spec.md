## ADDED Requirements

### Requirement: Immutable Audit Log
The system SHALL maintain an immutable, append-only audit log recording all data mutations with user, timestamp, action type, entity, and before/after values.

#### Scenario: Log journal entry creation
- **WHEN** a user creates a journal entry
- **THEN** the audit log records the action (CREATE), user ID, timestamp, entity type (JournalEntry), entity ID, and the full entry data

#### Scenario: Log journal entry posting
- **WHEN** a user posts a journal entry
- **THEN** the audit log records the action (POST), user ID, timestamp, and the status change from DRAFT to POSTED

#### Scenario: Log voucher modification
- **WHEN** a user modifies a DRAFT voucher
- **THEN** the audit log records the action (UPDATE), user ID, timestamp, and both the before and after state of the changed fields

#### Scenario: Audit log immutability
- **WHEN** any user (including Admin) attempts to modify or delete an audit log entry
- **THEN** the system rejects the action
- **AND** audit log records can only be created, never updated or deleted

### Requirement: Audit Trail Query Interface
The system SHALL provide a searchable audit trail interface with filtering by user, entity type, action type, date range, and entity ID.

#### Scenario: Search audit trail by user
- **WHEN** an Admin searches the audit trail for actions by a specific user
- **THEN** all audit entries for that user are returned in reverse chronological order

#### Scenario: Search audit trail by entity
- **WHEN** a user views the audit trail for a specific journal entry
- **THEN** all audit entries related to that journal entry (creation, editing, posting) are displayed in chronological order

#### Scenario: Filter audit trail by date range
- **WHEN** an Admin filters the audit trail for a specific date range
- **THEN** only audit entries within the date range are returned

### Requirement: Audit Trail on Financial Operations
The system SHALL ensure all financial operations (journal posting, voucher creation, year-end closing, period locking/unlocking) are logged with sufficient detail for regulatory compliance.

#### Scenario: Year-end closing audit trail
- **WHEN** year-end closing is executed
- **THEN** the audit log records who initiated it, when, which closing entries were generated, and the fiscal year locked

#### Scenario: Period unlock audit trail
- **WHEN** an Admin unlocks a fiscal period
- **THEN** the audit log records the unlock action with the Admin's ID, timestamp, period affected, and reason (if provided)
