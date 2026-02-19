# Seasonality - Source Of Truth (2026-02-19)

## spec_type
- `seasonality`

## Required
- `catalog_version`
- `data.symbol`
- `data.timeframe`
- `seasonality.profile` (object)
- `seasonality.signal` (object)

## Optional
- `data.window`
- `data.start_year`
- `data.end_year`
- `seasonality.compute`
- `seasonality.execution`
- `seasonality.risk`
- `seasonality.tp_sl|tpSl`
- `request_id`
- `output` (top-level)
- `persistence` (top-level)
- `filters`
- `performance`

## Regles importantes
- Hors contrat frequents (422):
  - `data.filter`
  - `data.normalize`
  - `seasonality.validation`
  - `seasonality.persistence`
  - `seasonality.artifacts`
- `session` est une dimension calculee backend (UTC buckets), pas un champ `data.session`.

## Clarification UX a afficher
- Buckets session UTC:
  - Asia: 00:00-06:59
  - Europe: 07:00-11:59
  - EU_US_overlap: 12:00-15:59
  - US: 16:00-20:59
  - Other: 21:00-23:59

## Test d'acceptation Angular
- Payload seasonality canonique sans champs legacy.
- Mention explicite session UTC visible pour utilisateur.
