## Alerting (Frontend Only)

Scope: alerts based on frontend telemetry (RUM). Backend alerts are out of scope.

### Proposed Alerts (Initial Thresholds)
1. FE 5xx spike (from browser)
- Metric: `fe_http_error_rate` where `status_class = 5xx`
- Trigger: > 2% for 10 minutes AND > 50 requests
- Severity: High

2. FE latency explosion (p99)
- Metric: `fe_http_latency_ms` p99 for `/api/runs` endpoints
- Trigger: p99 > 4000 ms for 10 minutes
- Severity: Medium

3. FE timeouts abnormal
- Metric: `fe_timeout_count`
- Trigger: > 10 timeouts in 10 minutes for any `/api/runs` endpoint
- Severity: Medium

4. Submit success rate drop
- Metric: `fe_runs_submit_success_rate`
- Trigger: success rate < 90% for 15 minutes AND > 20 submits
- Severity: High

5. Result fetch success rate drop
- Metric: `fe_runs_result_success_rate`
- Trigger: success rate < 90% for 15 minutes AND > 20 results
- Severity: Medium

6. Cancel success rate drop
- Metric: `fe_runs_cancel_success_rate`
- Trigger: success rate < 90% for 15 minutes AND > 10 cancels
- Severity: Low

### Notes
- Thresholds are initial, adjust after 1-2 weeks of baseline data.
- Use separate filters for `network_error` to avoid counting user offline.
