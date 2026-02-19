# DCA - Source Of Truth (2026-02-19)

## spec_type
- `dca`

## Required
- `catalog_version`
- `data.symbol`
- `data.timeframe`
- `data.start_date`
- `data.end_date`
- `strategy.type`
- `strategy.grid` (array)
- `strategy.params` (object)

## Optional
- `request_id`
- `output`
- `persistence`
- `filters`
- `performance`
- `data.dataset_path|path|mysql|symbols`

## Payload minimal valide (shape)
```json
{
  "spec_type": "dca",
  "catalog_version": "2026-02-02",
  "data": {
    "symbol": "BTCUSD",
    "timeframe": "1h",
    "start_date": "2022-12-31",
    "end_date": "2024-12-30"
  },
  "strategy": {
    "type": "dca_equity",
    "grid": ["grid_balanced"],
    "params": {"kind": "dca_equity"}
  }
}
```

## Notes integration
- `strategy.params` est libre au contrat, mais peut echouer runtime si non cable.
- Figer un mapping enum pour `strategy.params.tp_sl` cote Angular (ex: `tp_2_sl_1`) avant wiring complet Python.

## Test d'acceptation Angular
- Le payload DCA genere par `run-request-adapter` passe en 200 sur `/runs`.
- Aucun champ camelCase non converti ne reste dans le JSON canonique.
