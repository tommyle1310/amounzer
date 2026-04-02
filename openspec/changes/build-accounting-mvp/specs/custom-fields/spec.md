## ADDED Requirements

### Requirement: Custom Field Definition
The system SHALL allow users to define custom fields on any extensible entity (Voucher, Customer, Vendor, FixedAsset, InventoryItem, JournalEntry, PayrollRecord) with configurable field types.

#### Scenario: Create a custom text field on Voucher
- **WHEN** an admin creates a custom field with name "Project Code", type "text", and applies it to the Voucher entity
- **THEN** the custom field appears on all new and existing voucher forms
- **AND** the field value is stored in the entity's JSONB customFieldValues column

#### Scenario: Create a custom select field
- **WHEN** an admin creates a custom field with name "Department", type "select", options ["Sales", "Finance", "Operations"], and applies it to Customer
- **THEN** the field appears as a dropdown on customer forms
- **AND** only the predefined options can be selected

#### Scenario: Supported field types
- **WHEN** an admin creates a custom field
- **THEN** the available types are: text, number, date, select (single), checkbox, and multi-select

### Requirement: Custom Field on Forms
The system SHALL render custom fields in entity forms with appropriate input controls and validation.

#### Scenario: Custom field validation
- **WHEN** a custom number field has min/max validation configured
- **THEN** the form validates the entered value against the constraints
- **AND** displays a validation error if out of range

#### Scenario: Custom field in edit form
- **WHEN** a user edits an existing entity that has custom field values
- **THEN** the custom fields are pre-populated with their saved values

### Requirement: Custom Field in Reports
The system SHALL make custom fields available as dimensions and filters in the dynamic report builder and in accounting book exports.

#### Scenario: Filter report by custom field
- **WHEN** a user creates a dynamic report and adds a filter on custom field "Project Code" = "PRJ-001"
- **THEN** only transactions where the custom field matches are included in the report

#### Scenario: Group by custom field
- **WHEN** a user creates a dynamic report grouped by custom field "Department"
- **THEN** the report aggregates data by the distinct custom field values

### Requirement: Custom Field Management
The system SHALL provide an admin interface to list, edit, reorder, and deactivate custom fields.

#### Scenario: Deactivate a custom field
- **WHEN** an admin deactivates a custom field
- **THEN** the field no longer appears on forms for new entries
- **AND** existing data with that field value is preserved and remains accessible in reports

#### Scenario: Reorder custom fields
- **WHEN** an admin reorders custom fields for an entity
- **THEN** the fields appear in the new order on the entity's forms
