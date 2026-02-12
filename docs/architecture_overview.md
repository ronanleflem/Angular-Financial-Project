## Architecture Overview (Frontend Only)

Scope: Angular app only. Backend architecture is out of scope for this document.

### Current Core Flows
1. Strategy Launcher
- Builds UI payload.
- Maps to canonical payload.
- Submits via `RunsService` to `/api/runs`.
- Displays canonical vs UI payload.

2. Run Status
- Polls `/api/runs/{id}` until terminal.
- Fetches `/api/runs/{id}/result` for terminal states.
- Supports cancel via `/api/runs/{id}/cancel`.

### Key Frontend Modules
- `RunsService`: canonical payload submit + status/result/cancel.
- `StrategyLauncherPage`: UI forms + payload preview + backend error mapping.
- `RunStatusPage`: polling + normalized status + cancel + result display.

### Observability (Frontend)
See `docs/OBSERVABILITY.md` for proposed metrics/logs.

### Cleanup Targets
See `docs/CLEANUP.md` for legacy candidates and deprecation plan.
