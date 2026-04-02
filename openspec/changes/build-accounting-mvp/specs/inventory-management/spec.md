## ADDED Requirements

### Requirement: Inventory Item Management
The system SHALL manage inventory items with item codes, descriptions, units of measure, and valuation method, tracked under TK 152 (Raw Materials) and related inventory accounts.

#### Scenario: Create an inventory item
- **WHEN** a user creates an inventory item with code, name, unit, and valuation method (weighted average, FIFO, or specific identification)
- **THEN** the item is saved and linked to the appropriate inventory account (TK 152, 153, 155, 156)

#### Scenario: View item stock levels
- **WHEN** a user views an inventory item's detail page
- **THEN** the current stock quantity and valuation amount are displayed
- **AND** recent movements are listed

### Requirement: Inventory Movements
The system SHALL track all inventory movements (receipts, issues, transfers) with automatic journal entry generation.

#### Scenario: Record inventory receipt
- **WHEN** a user records an inventory receipt (goods received from vendor)
- **THEN** the system creates an inventory movement record increasing stock quantity
- **AND** a journal entry is generated debiting TK 152 and crediting TK 331 (or relevant account)

#### Scenario: Record inventory issue
- **WHEN** a user records an inventory issue (goods sent to production or sold)
- **THEN** the system creates an inventory movement record decreasing stock quantity
- **AND** the cost of goods is calculated based on the item's valuation method
- **AND** a journal entry is generated crediting TK 152 and debiting the appropriate cost account (TK 621, 632)

#### Scenario: Inventory transfer between warehouses
- **WHEN** a user records a transfer between warehouses
- **THEN** stock decreases at the source warehouse and increases at the destination
- **AND** no journal entry is generated if both link to the same account

### Requirement: Inventory Valuation
The system SHALL support weighted average, FIFO, and specific identification valuation methods per item.

#### Scenario: Weighted average costing
- **WHEN** an item uses weighted average valuation and a new receipt arrives at a different unit cost
- **THEN** the system recalculates the weighted average unit cost
- **AND** subsequent issues use the updated average cost

#### Scenario: Inventory sub-ledger report
- **WHEN** a user generates the Sổ chi tiết vật tư hàng tồn kho (TK 152)
- **THEN** the report shows all movements per item with quantities, unit costs, and total values
- **AND** opening and closing balances are displayed
