# Backtest - Source Of Truth (2026-02-19)

## spec_type
- `backtest`

## Required
- `catalog_version`
- `data.symbol`
- `data.timeframe`
- `data.start_date`
- `data.end_date`
- `signal.type`

## Optional
- `signal.fast`
- `signal.slow`
- `signal.require_crossing`
- `strategy.name`
- `strategy.params` (object)
- `request_id`
- `output`
- `persistence`
- `filters`
- `performance`
- `data.dataset_path|path|mysql|symbols`

## Regles importantes
- Forme canonique TP/SL et screening:
  - `strategy.params.tp_sl`
  - `strategy.params.screening`
- Anti-patterns (422):
  - `data.strategy_name`
  - `strategy.tp_sl`
  - `strategy.screening`

## Runtime actuel
- Le payload peut etre accepte (200) puis finir en:
  - `FAILED`
  - `error.code = not_implemented_feature`
  - `error.details[]` indiquant les champs non cables.

## Test d'acceptation Angular
- Mapping backend errors 422 sur champs formulaire backtest.
- Affichage UX "Not implemented yet" sur `FAILED/not_implemented_feature`.
