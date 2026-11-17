# VibeDebt Topology & Refactor PR Report

Target: `C:\Users\tamil\Downloads\Vibe debut\fixtures\vibe-mart`  
Status: **Verified successfully**

## Debt before and after

| Metric | Before | After |
| --- | ---: | ---: |
| Duplicated logic clusters | 37 | 12 |
| Orphaned state | 6 | 0 |
| API path inconsistencies | 2 | 0 |
| Component source lines | 1812 | 1576 |

Clusters represent repeated AST expressions, including nested expressions; they are not independent defects.

## Extracted modules

- `src/domain/pricing.ts`
- `src/services/apiRoutes.ts`

## API boundary and compatibility

- Components use centralized /api/v1 routes; server normalizes legacy /api aliases.
- Public function names and the VibeMart facade retain backward-compatible behavior.
- Versioned and legacy routes are covered by frozen public API characterization tests.

## Verification

- Characterization capture/replay: **109 passing tests**.
- Post-refactor invariant and anchor gate: **122 passed, 0 failed**.
- TypeScript gate: **passed**.
- Rollback: **not needed**.
- Anchor suite: `C:\Users\tamil\Downloads\Vibe debut\.vibedebt\generated-anchor.test.ts`.


## Changed files

- `src/CheckoutModal.tsx`
- `src/OrderManagement.tsx`
- `src/ShopDashboard.tsx`
- `src/domain/pricing.ts`
- `src/mockApi.ts`
- `src/services/apiRoutes.ts`

## Business intent

- **calculatePricing** (heuristic): Intent inferred from name: calculate pricing. Observed AST operations: 6 conditional branches, decimal rounding with toFixed.
- **calculateStateTax** (heuristic): Intent inferred from name: calculate state tax. Observed AST operations: 3 conditional branches, text trimming, uppercase normalization, decimal rounding with toFixed.
- **calculateShippingCost** (heuristic): Intent inferred from name: calculate shipping cost. Observed AST operations: 1 conditional branches.
- **getNextOrderStatus** (heuristic): Intent inferred from name: get next order status. Observed AST operations: 2 conditional branches.
- **canRefundOrder** (heuristic): Intent inferred from name: can refund order. Observed AST operations: no conditional branches.

