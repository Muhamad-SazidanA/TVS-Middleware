# USC-Middleware End-to-End (E2E) Test Infrastructure Specification

## 1. Test Philosophy & Architecture

The USC-Middleware E2E Test Suite is designed to provide **opaque-box, requirement-driven, deterministic verification** of the entire customs document processing, data transformation, and matching lifecycle for **PT. UNITED STEEL CENTER INDONESIA (USC)**.

### Core Principles
1. **Opaque-Box Verification**: Tests interact strictly with system boundaries, API contracts, domain functions, and pipeline interfaces. Internal implementation details are treated as opaque, ensuring tests validate behavior and requirements specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`.
2. **Deterministic & Self-Contained**: Every test manages its own fixtures, inputs, and states. Tests do not depend on external Nanonets network connectivity or mutable global state; all OCR payloads, document contents, and transformation pipelines are deterministically reproducible.
3. **Progressive Testability & Zero-Facade Integrity**: Tests enforce genuine business logic validation. Facade assertions, dummy mocks that always return true, and hardcoded pass conditions are strictly prohibited.
4. **Coverage Across All 7 USC Documents**: Full lifecycle coverage for:
   - **PIB** (Pemberitahuan Impor Barang - Indonesian Customs Import Declaration)
   - **CI** (Commercial Invoice)
   - **PL** (Packing List)
   - **BL** (Bill of Lading / Sea Waybill)
   - **Form AK** (Certificate of Origin - ASEAN-Korea FTA)
   - **WL** (Weight List)
   - **MTC / MS** (Mill Test Certificate / Mill Sheet)

---

## 2. 4-Tier Test Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│               Tier 4: Real-World Application Scenarios          │
│   Full 7-Document Steel Batches (POSCO Korea, Multi-Item, etc.) │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│            Tier 3: Cross-Feature & Integration Pairs            │
│   Document Pairings (PIB+CI, PIB+PL, PIB+BL, PIB+AK, etc.)      │
│   Data Actions _action Field Interaction with Matching Engine   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│            Tier 2: Boundary, Robustness & Corner Cases          │
│   Empty Fields, Negative Weights, Unnormalized HS, Malformed    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│               Tier 1: Feature Coverage (Core Units)             │
│   7 USC Documents Extraction, 9 Data Action Types, Scoping     │
│   Canonical Matching Parity & Item Discrepancy Evaluation       │
└─────────────────────────────────────────────────────────────────┘
```

### Tier 1: Feature Coverage (Isolated Happy Path)
- **Minimum Requirement**: $\ge 5$ tests per feature.
- **Scope**:
  - Feature 1: PIB Document Ingestion & Field Extraction ($\ge 5$ tests).
  - Feature 2: Commercial Invoice (CI) Ingestion & Extraction ($\ge 5$ tests).
  - Feature 3: Packing List (PL) Ingestion & Extraction ($\ge 5$ tests).
  - Feature 4: Bill of Lading (BL) Ingestion & Extraction ($\ge 5$ tests).
  - Feature 5: Form AK (Certificate of Origin) Ingestion & Extraction ($\ge 5$ tests).
  - Feature 6: Weight List (WL) Ingestion & Extraction ($\ge 5$ tests).
  - Feature 7: Mill Test Certificate (MTC/MS) Ingestion & Extraction ($\ge 5$ tests).
  - Feature 8: Data Actions Rule Execution (all 9 transformation actions: remove characters, number format, replace text, trim whitespace, case transform, date normalize, prefix/suffix, validation rules, value mapping) ($\ge 9$ tests).
  - Feature 9: Data Actions Document Scoping & Target Field Scoping ($\ge 5$ tests).
  - Feature 10: Canonical Matching Engine Status & Line-Item Matching ($\ge 5$ tests).

### Tier 2: Boundary & Corner Cases
- **Scope**:
  - Missing and null header/item fields.
  - Zero, negative, and extreme numeric weights/amounts.
  - Multi-currency parsing and formatting artifacts (USD, IDR, commas, dots).
  - Malformed JSON OCR payloads and missing prediction blocks.
  - Unnormalized HS codes (6-digit, 8-digit, 10-digit with/without dot separators).
  - Special characters in invoice numbers and reference IDs (`/`, `-`, `#`, spaces).
  - Whitespace irregularities (leading/trailing/newlines/multiple spaces).

### Tier 3: Cross-Feature Combinations
- **Scope**:
  - Pairwise document matching against PIB reference:
    * PIB + Commercial Invoice: Invoice number parity, FOB/CIF valuation, currency consistency.
    * PIB + Packing List: Gross weight, net weight, coil count parity.
    * PIB + Bill of Lading: B/L number, container number, vessel, port of loading/discharge.
    * PIB + Form AK: Reference number, exporter name, HS code correspondence.
    * PIB + Weight List: Individual coil weights, total net weight consistency.
    * PIB + Mill Test Certificate: Material grade (SPHC/SS400), heat number, producer identity.
  - Data Action `_action` Prioritization:
    * Matching engine verifies `[fieldName]_action` is prioritized over raw `[fieldName]`.
    * Unmatched raw values that succeed once transformed by Data Actions.
    * Line-item table row `_action` transformations driving exact item matching.

### Tier 4: Real-World Application Scenarios
- **Scope**:
  - Full end-to-end batches for PT. UNITED STEEL CENTER INDONESIA.
  - **Scenario 1 (Golden Batch)**: Perfect 7-document steel shipment from POSCO Korea (SPHC Hot-Rolled Steel Coils). All documents match seamlessly.
  - **Scenario 2 (Multi-Item Steel Batch)**: Multiple coil line items with distinct specifications, dimensions, unit prices, and HS codes matching across all 7 documents.
  - **Scenario 3 (Discrepancy Detection & Reporting)**: Real-world discrepancy scenario (weight mismatch or invoice number typo) verifying exact discrepancy reporting without false auto-matches.
  - **Scenario 4 (Data Action Resolution Batch)**: Real-world OCR noisy batch where raw extracted values contain prefix/suffix noise, resolved via configured Data Actions to achieve verified `MATCHING` status.

---

## 3. Directory Layout

```
tests/
└── e2e/
    ├── fixtures/
    │   ├── usc_sample_pib.json
    │   ├── usc_sample_ci.json
    │   ├── usc_sample_pl.json
    │   ├── usc_sample_bl.json
    │   ├── usc_sample_ak.json
    │   ├── usc_sample_wl.json
    │   └── usc_sample_ms.json
    ├── helpers/
    │   ├── testHelpers.ts
    │   └── mockBatches.ts
    ├── tier1-features/
    │   ├── tier1_documents.test.ts
    │   ├── tier1_data_actions.test.ts
    │   └── tier1_matching.test.ts
    ├── tier2-boundary/
    │   └── tier2_boundary.test.ts
    ├── tier3-combinations/
    │   └── tier3_combinations.test.ts
    └── tier4-scenarios/
        └── tier4_scenarios.test.ts
```

---

## 4. Test Execution & CLI Commands

The test runner utilizes Node.js native test runner via `tsx` (ensuring native TypeScript execution with `tsconfig.json` path alias support):

### Run All E2E Tests:
```bash
npx tsx --test tests/e2e/**/*.test.ts
```

### Run by Specific Tier:
- **Tier 1**: `npx tsx --test tests/e2e/tier1-features/*.test.ts`
- **Tier 2**: `npx tsx --test tests/e2e/tier2-boundary/*.test.ts`
- **Tier 3**: `npx tsx --test tests/e2e/tier3-combinations/*.test.ts`
- **Tier 4**: `npx tsx --test tests/e2e/tier4-scenarios/*.test.ts`

---

## 5. Coverage & Verification Targets

| Metric | Target | Status |
|---|---|---|
| Total E2E Tests | $\ge 70$ tests | Complete & Verifiable |
| Document Types Covered | 7 of 7 USC documents (PIB, CI, PL, BL, AK, WL, MS) | 100% |
| Data Action Operations | 9 of 9 transformation actions | 100% |
| False Auto-Match Checks | Strict parity verification across all 6 supporting docs | 100% |
| Steel Batch Simulation | Realistic PT. United Steel Center Indonesia shipments | 100% |
