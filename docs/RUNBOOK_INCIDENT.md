## Runbook Incident (Frontend Only)

Scope: incidents visible from the Angular app. Backend diagnostics are out of scope for this document.

### Symptoms
- Submit fails with 4xx/5xx spikes.
- Run status page stuck in loading or polling never stops.
- Result never appears for terminal runs.
- Cancel action unresponsive or inconsistent.

### Quick Checks
1. Open browser devtools -> Network tab:
   - Verify `/api/runs` endpoints are called.
   - Check status codes (422/409/5xx) and response payloads.
2. Check browser console logs:
   - Look for `[StrategyLauncher]` and `[RunStatus]` errors.
3. Verify current `catalog_version` and payload canonical in the UI payload screen.

### Diagnostics Commands (Frontend)
- Reproduce with a minimal payload (use "Payload local/expert" screen).
- Capture failing request and response:
  - Endpoint, method, status, response body.
- Save a HAR file for the failing session (devtools -> export HAR).

### Mitigation Actions
- If 422 spikes: validate mapping against latest canonical contract.
- If 409 on cancel: refresh status and ensure UI stops polling.
- If result failures: allow UI to show error state and avoid blocking the user.

### Rollback Procedure (Frontend)
- Revert to last known good Angular release (tagged build).
- Communicate release timestamp and git commit hash.
- Validate `/api/runs` flow on staging with a minimal payload.

### Post-Incident Notes
- Update alert thresholds if false positives occurred.
- Add missing frontend tests for the failure path.
