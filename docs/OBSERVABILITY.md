## Observability (Angular Only)

Scope: frontend only. This spec describes what the Angular app should emit and how it should be visualized. Backend metrics/logs are out of scope here.

### Goals
- Detect run lifecycle failures early (submit/status/result/cancel).
- Provide per-endpoint latency/error rates as seen from the browser.
- Correlate user sessions and requests across the UI.

### Metrics to Emit (Frontend RUM)
- `fe_http_latency_ms` (histogram): p50/p95/p99 by `route`, `endpoint`, `method`, `status_class`.
- `fe_http_error_rate` (counter): 4xx/5xx by `endpoint`, `method`, `status`.
- `fe_timeout_count` (counter): timeout/abort count by `endpoint`.
- `fe_runs_submit_success_rate` (counter): success vs failure for `POST /api/runs`.
- `fe_runs_result_success_rate` (counter): success vs failure for `GET /api/runs/{id}/result`.
- `fe_runs_cancel_success_rate` (counter): success vs failure for `POST /api/runs/{id}/cancel`.
- `fe_run_terminal_status_count` (counter): `succeeded|failed|canceled|unknown`.
- `fe_ui_error_banner_count` (counter): errors shown to users (submit + polling + result).

### Required Tags / Dimensions
- `endpoint`: canonical endpoint (e.g., `/api/runs`, `/api/runs/:id`).
- `method`: HTTP verb.
- `status`: HTTP status code or `network_error`.
- `status_class`: `2xx|4xx|5xx|network`.
- `route`: Angular route path (e.g., `/strategy-launcher`, `/runs/:id`).
- `run_id` (if known), `request_id` (if known).
- `correlation_id` (if present in request/response).

### Logging (Frontend)
Structured logs to the browser console + optional log sink:
- Fields: `timestamp`, `level`, `route`, `endpoint`, `method`, `status`, `run_id`, `request_id`, `correlation_id`, `message`, `error`.
- Emit logs for:
  - Submit failures (422/409/5xx).
  - Polling failures.
  - Result fetch failures.
  - Cancel failures.

### Implementation Notes (Angular)
- Add a single `HttpInterceptor` that:
  - Starts a timer per request.
  - Captures status or network errors.
  - Emits metrics/logs with tags above.
  - Optionally sets `X-Correlation-Id` if absent (UUID per request or per session).
- Keep PII out of logs/metrics.

### Dashboard (Frontend View)
Panels:
- Overall error rate (4xx/5xx) by endpoint.
- Latency p95/p99 by endpoint.
- `POST /api/runs` success rate (last 1h/24h).
- `GET /api/runs/{id}/result` success rate.
- `POST /api/runs/{id}/cancel` success rate.
- Run terminal status distribution.

### Gaps / Out of Scope
- Backend metrics/logs are not covered here.
- Cross-service correlation requires backend propagation of `X-Correlation-Id`.
