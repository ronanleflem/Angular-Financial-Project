# Stress Tests - Source Of Truth (2026-02-19)

## spec_type
- `stress_tests`

## Required
- `catalog_version`
- `data.symbol`
- `data.timeframe`
- `data.start_date`
- `data.end_date`

## Optional
- `strategy` (object)
- `request_id`
- `output`
- `persistence`
- `filters`
- `performance.initial_capital`
- `performance.stress_tests.enabled`
- `performance.stress_tests.method`
- `performance.stress_tests.n_sims`
- `performance.stress_tests.seed`
- `performance.stress_tests.block_size`

## Regles importantes
- `performance.stress_tests` est limite au set ci-dessus.
- Options avancees hors contrat actuel (422):
  - `source`, `overlapping`, `time_distribution`, `param_drift`, `sizing`, `output` (interne stress), `scenarios`, `multi_asset`.

## Payload minimal valide (shape)
```json
{
  "spec_type": "stress_tests",
  "catalog_version": "2026-02-02",
  "data": {
    "symbol": "SPY",
    "timeframe": "1d",
    "start_date": "2018-01-01",
    "end_date": "2024-12-31"
  },
  "performance": {
    "initial_capital": 50000,
    "stress_tests": {
      "enabled": true,
      "method": "block_bootstrap",
      "n_sims": 2000,
      "seed": 42,
      "block_size": 20
    }
  }
}
```
