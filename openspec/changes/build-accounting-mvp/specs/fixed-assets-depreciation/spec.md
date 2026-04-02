## ADDED Requirements

### Requirement: Fixed Asset Register
The system SHALL maintain a fixed asset register tracking all assets under TK 211 (Tangible Fixed Assets) with acquisition details, useful life, and depreciation method.

#### Scenario: Register a new fixed asset
- **WHEN** a user registers a new fixed asset with name, category, acquisition date, acquisition cost, useful life, and depreciation method (straight-line, declining balance)
- **THEN** the asset is saved in the register
- **AND** a journal entry is generated debiting TK 211 and crediting the source account (TK 111, 112, 331)

#### Scenario: View asset details
- **WHEN** a user views a fixed asset's detail page
- **THEN** the system displays acquisition cost, accumulated depreciation, net book value, remaining useful life, and depreciation schedule

### Requirement: Depreciation Schedule
The system SHALL automatically calculate and generate monthly depreciation schedules for each fixed asset based on its depreciation method and useful life.

#### Scenario: Straight-line depreciation calculation
- **WHEN** a fixed asset has straight-line depreciation with acquisition cost 120,000,000 VND and useful life 10 years
- **THEN** the system calculates monthly depreciation of 1,000,000 VND
- **AND** generates a depreciation schedule showing monthly entries for the asset's useful life

#### Scenario: Auto-post monthly depreciation
- **WHEN** the monthly depreciation run is executed
- **THEN** the system generates journal entries for each asset debiting TK 627/641/642 (depreciation expense) and crediting TK 214 (accumulated depreciation)
- **AND** entries are linked to the depreciation schedule

### Requirement: Asset Disposal
The system SHALL support asset disposal (sale or write-off) with automatic computation of gain/loss.

#### Scenario: Dispose of a fixed asset
- **WHEN** a user records the disposal of a fixed asset
- **THEN** the system calculates the gain or loss (disposal proceeds minus net book value)
- **AND** generates journal entries to remove the asset cost from TK 211, remove accumulated depreciation from TK 214, and record gain/loss

#### Scenario: Asset fully depreciated
- **WHEN** an asset reaches the end of its useful life
- **THEN** the net book value is zero and no further depreciation is calculated
- **AND** the asset remains in the register until disposed

### Requirement: Fixed Asset Reports
The system SHALL generate fixed asset tracking reports showing asset register, depreciation schedules, and summary by category.

#### Scenario: Generate TSCĐ tracking report
- **WHEN** a user generates the Sổ theo dõi TSCĐ & khấu hao (TK 211, 214)
- **THEN** the report lists all assets with acquisition cost, accumulated depreciation, net book value, and depreciation for the period
- **AND** totals are shown per asset category and overall
