## Cleanup (Frontend Only)

Scope: Angular app. Backend cleanup is out of scope.

### Legacy Candidates (Needs Validation)
These components/pages look like legacy/demo features and should be reviewed for removal or deprecation.
- `src/app/components/strategy-calculation` (legacy "run strategy" flow)
- `src/app/components/statistic-data` (legacy stats view)
- `src/app/components/live-data` (legacy live chart)
- `src/app/components/historical-data` (legacy historical view)
- `src/app/labs/signals` (lab/demo area)

### Proposed Deprecation Plan
- Mark as deprecated in UI copy and docs.
- Target removal date: 2026-06-30 (adjust after product review).
- Add route guards or nav warnings if still exposed.

### Safe Removals (None Yet)
- No code removed in this change set.

### TODO
- Confirm which pages are still used in production.
- Remove unused routes from `src/app/app.routes.ts`.
- Delete unused components and tests once confirmed.
