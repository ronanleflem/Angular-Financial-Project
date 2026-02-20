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
- `strategy.params` (object)
- `strategy.params.grid` (array d'objets `{dd, weight}` pour `dca_equity`)
- `strategy.params.execution_mode` (`bar_close` ou `intracandle` pour `dca_equity`)
- `strategy.params.drawdown_reference` (`ATH`, `1M`, `3M`, `6M`, `1Y` pour `dca_equity`)

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
    "params": {
      "kind": "dca_equity",
      "execution_mode": "bar_close",
      "drawdown_reference": "ATH",
      "grid": [{ "dd": -5.0, "weight": 1.0 }],
      "tp_sl": {
        "enabled": true,
        "mode": "rule_based",
        "tp": { "type": "percent", "value": 2.0 },
        "sl": { "type": "percent", "value": 1.0 },
        "break_even": { "enabled": true, "trigger_pct": 1.0 }
      },
      "require_crossing": true
    }
  }
}
```

## Notes integration
- Ne pas envoyer `strategy.grid` (preset string array) vers `/runs`: convertir en `strategy.params.grid`.
- Ne pas envoyer `strategy.params.tp_sl` en string preset: convertir en objet complet.
- Eviter les champs top-level hors contrat (`screening`, etc.) sinon `422 extra_forbidden`.

## Test d'acceptation Angular
- Le payload DCA genere par `run-request-adapter` passe en 200 sur `/runs`.
- Aucun champ camelCase non converti ne reste dans le JSON canonique.
