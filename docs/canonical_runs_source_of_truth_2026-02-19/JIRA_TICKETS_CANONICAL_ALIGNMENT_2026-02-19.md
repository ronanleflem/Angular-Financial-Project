# Jira Tickets - Canonical Alignment (2026-02-19)

## TICKET A - Angular Canonical Payload Alignment

### Summary
Aligner les payloads `/runs` Angular sur le contrat canonique Python strict pour `dca`, `backtest`, `market_stats`, `seasonality`, `stress_tests`.

### Scope
- Mettre a jour modeles front et builders payload.
- Retirer champs legacy/hors contrat.
- Garantir placement top-level correct de `persistence` et `output`.

### In Scope Files
- `src/app/models/run-request-input.model.ts`
- `src/app/pages/strategy-launcher/strategy-launcher.page.ts`
- `src/app/services/run-request-adapter.ts`

### Acceptance Criteria
- Aucun `422 extra_forbidden` sur payloads de reference.
- JSON canonique exporte par l'UI est conforme aux docs `*.md` de ce dossier.
- Tests unitaires mapping payload mis a jour.

### Story Detail - ANG-1 (DCA runtime Python)

#### Objectif
Garantir que le payload DCA construit par Angular est compatible runtime Python `/runs` (pas uniquement valide a l'entree).

#### Regles de mapping Angular -> Python
- Interdire `strategy.grid` en sortie.
- Convertir preset UI `grid_balanced|grid_conservative|grid_aggressive` vers `strategy.params.grid` (`[{dd, weight}]`).
- Convertir preset UI `tp_2_sl_1|tp_3_sl_1.5|none` vers objet `strategy.params.tp_sl`.
- Autoriser `strategy.params.execution_mode` uniquement: `bar_close`, `intracandle`.
- Autoriser `strategy.params.drawdown_reference` uniquement: `ATH`, `1M`, `3M`, `6M`, `1Y`.
- Conserver les filtres dans le bloc canonical `filters`.
- Ne jamais emettre de champ top-level hors contrat (`screening`, etc.).

#### Exemple payload final "safe"
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
      "execution_mode": "bar_close",
      "drawdown_reference": "ATH",
      "grid": [{ "dd": -5.0, "weight": 1.0 }],
      "tp_sl": {
        "enabled": true,
        "mode": "per_grid_max_dd",
        "rules": [{ "max_dd_reached": -20.0, "tp_pct": 15.0, "be_pct": 7.0 }],
        "sl_dd": -70.0
      },
      "require_crossing": true
    }
  }
}
```

---

## TICKET B - Angular Run Errors UX (422 vs FAILED)

### Summary
Ameliorer la gestion UI des erreurs backend runs: distinction claire entre erreurs contrat 422 et echec runtime `FAILED/not_implemented_feature`.

### Scope
- Mapping robuste des erreurs 422 vers controles formulaire.
- Affichage d'un panneau terminal detaille pour `FAILED` avec `error.details[]`.
- Message UX standard: `Not implemented yet` pour `not_implemented_feature`.

### In Scope Files
- `src/app/pages/strategy-launcher/strategy-launcher.page.ts`
- `src/app/pages/run-status/run-status.page.ts`
- `src/app/pages/run-status/run-status.page.html`
- `src/app/utils/backend-validation.ts`

### Acceptance Criteria
- Un run `FAILED/not_implemented_feature` montre les champs non cables.
- Un 422 montre les champs invalides lies aux controles.
- Tests unitaires + composants couvrent les 2 cas.

---

## TICKET C - Seasonality Contract Cleanup + Session Clarity

### Summary
Nettoyer le payload seasonality Angular selon contrat canonique et rendre explicite le comportement des sessions UTC pour l'utilisateur.

### Scope
- Ne plus envoyer `data.filter`, `data.normalize`, `seasonality.validation`, `seasonality.persistence`, `seasonality.artifacts`.
- Conserver `persistence` et `output` au top-level.
- Ajouter aide UI session UTC (buckets).

### In Scope Files
- `src/app/pages/strategy-launcher/strategy-launcher.page.ts`
- `src/app/pages/strategy-launcher/strategy-launcher.page.html`
- `src/app/models/run-request-input.model.ts`

### Acceptance Criteria
- Payload seasonality de reference accepte en 200 sur `/runs`.
- Le texte d'aide session UTC est visible dans l'UI seasonality.
- Tests payload seasonality mis a jour.
