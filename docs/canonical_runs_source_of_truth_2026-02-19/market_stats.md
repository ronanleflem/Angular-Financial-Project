# Market Stats - Source Of Truth (2026-02-19)

## spec_type
- `market_stats`

## Required
- `catalog_version`
- `data.symbol`
- `data.timeframe`
- `stats.event.id`
- `stats.condition.id`
- `stats.target.id`

## Optional
- `data.lookback`
- `data.stats_pack`
- `data.session`
- `data.include_weekends`
- `stats.event.params`
- `stats.condition.params`
- `stats.target.params`
- `stats.validation`
- `request_id`
- `output` (top-level)
- `persistence` (top-level)
- `filters`
- `performance`

## Regles importantes
- `stats.persistence` et `stats.artifacts` sont hors contrat (422).
- Utiliser `persistence` et `output` au top-level.

## Test d'acceptation Angular
- Envoi market_stats sans champs imbriques invalides sous `stats`.
- Pas de `422 extra_forbidden` pour persistence/artifacts.
