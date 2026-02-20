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

### Story Detail - ANG-2 (lifecycle `/runs` + erreurs metier)

#### Regles UI
- Statuts explicitement geres: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`.
- Si `GET /runs/{id}/result` retourne un statut non terminal: afficher `Result not available yet` (non bloquant).
- Si `FAILED` + `error.code=not_implemented_feature`: afficher le message metier et les champs non cables issus de `details[].reason=accepted_but_not_wired`.
- Cancel:
  - `200`: message info `Cancel accepte.`
  - `409 already_finished`: message info non bloquant + refresh statut.
- Conserver et afficher `run_id` et `request_id` dans la page statut.

#### Couverture tests UI
- Transition `QUEUED -> RUNNING -> SUCCEEDED`.
- `FAILED + not_implemented_feature + details`.
- `result not available yet`.
- cancel `200` et `409`.

---

## TICKET D - DCA TP/SL explicite (objet) + compat legacy

### Summary
Remplacer `strategy.params.tp_sl` preset string opaque par un objet explicite TP/SL separe, tout en conservant la lecture legacy des anciens payloads.

### Scope
- Model front DCA:
  - `tp_sl.enabled`
  - `tp_sl.mode` (`rule_based`)
  - `tp_sl.tp.{type,value}`
  - `tp_sl.sl.{type,value}`
  - `tp_sl.break_even.{enabled,trigger_pct}`
- Builder canonical:
  - emettre `strategy.params.tp_sl` objet (jamais string en creation run UI)
- Compat legacy:
  - accepter un ancien `tp_sl: "tp_2_sl_1"` en lecture preset/run et le convertir dans le form.
- Validation UI:
  - `tp.value > 0`
  - `sl.value > 0`
  - `mode` valide
  - structure obligatoire quand `enabled=true`

### Acceptance Criteria
- Un run DCA cree depuis UI envoie un `strategy.params.tp_sl` objet.
- Les erreurs de saisie TP/SL sont bloquees cote formulaire.
- Les anciens runs avec `tp_sl` string sont lisibles et convertis.
- Tests front passants: builder + validation form + mapping legacy->objet.

---

## TICKET E - Builder canonical unique `/runs`

### Summary
Centraliser la construction du payload canonical dans un seul adapter: `buildCanonicalRunPayload(uiModel, specType)`.

### Scope
- Migrer les points d'entree POST `/runs` et preview canonical vers ce builder unique.
- Pour `dca`:
  - convertir `strategy.grid` legacy preset -> `strategy.params.grid`
  - convertir `strategy.params.tp_sl`/`tpSl` string legacy -> objet explicite
  - supprimer `data.universe` du canonical
  - forcer `catalog_version`
  - garantir `data.symbol` obligatoire

### Acceptance Criteria
- Tout POST `/runs` passe par le builder unique.
- Aucun payload canonical DCA avec `universe`.
- Tests unitaires couvrent conversions DCA et erreurs (`data.symbol` manquant).

---

## TICKET F - ANG-4 Capabilities `/runs/capabilities`

### Summary
Piloter l'UI DCA depuis les capacites runtime Python pour eviter les hardcodes fragiles.

### Scope
- Appel `GET /runs/capabilities?spec_type=dca` au chargement du strategy-launcher.
- Si capacites presentes:
  - desactiver les options grid non supportees runtime.
  - nettoyer la selection courante si une option n'est plus supportee.
  - afficher une aide utilisateur explicite.
- Si endpoint indisponible:
  - fallback sur mode statique actuel (aucune option masquee).
  - afficher une information de fallback non bloquante.

### Acceptance Criteria
- L'UI n'expose plus d'options runtime non supportees quand capabilities sont dispo.
- Le flux reste fonctionnel en fallback.
- Tests UI couvrent mode capabilities actif + fallback.

---

## TICKET G - Capabilities enrichies + migration legacy -> canonical

### Summary
Exploiter `legacy_dca.fields.*` renvoyes par capabilities pour clarifier en UI ce qui est canonical vs legacy-only, sans casser le run launcher canonical.

### Scope
- Lire `legacy_dca.fields.not_in_canonical`:
  - affichage badge/indication `legacy-only` en UI DCA.
- Lire `legacy_dca.fields.supported`:
  - affichage guidance pour plan de migration progressive.
- Continuer de construire/envoyer un payload canonical via builder unique `/runs`.
- Fallback statique conserve si endpoint capabilities indisponible.

### Acceptance Criteria
- UI distingue clairement canonical vs legacy-only.
- Aucun champ legacy-only envoye dans payload canonical final.
- Fallback statique fonctionnel.

---

## DCA Capabilities (Snapshot Lisible)

Source: `GET /api/runs/capabilities?spec_type=dca`  
Statut observe: `200`  
Version: `catalog_version=2026-02-02`

### Canonical /runs

Champs supportes (principaux):
- `data.symbol`
- `data.timeframe`
- `data.start_date`
- `data.end_date`
- `strategy.type`
- `strategy.params.grid`
- `strategy.params.execution_mode`
- `strategy.params.drawdown_reference`
- `strategy.params.tp_sl`
- `filters.filters`
- `filters.rules`
- `filters.rules_config`
- `performance.initial_capital`

Acceptes mais non cables runtime:
- `performance.stress_tests`
- `output`
- `persistence`

### Presets runtime

Supportes:
- `strategy.grid`: `grid_balanced`
- `strategy.params.tp_sl`: `tp_X_sl_Y`

Non supportes:
- `strategy.grid`: `grid_conservative`, `grid_aggressive`

### Legacy DCA (hors canonical strict)

`legacy_dca.fields.supported` expose les champs de l'ancien flux (CLI/spec legacy), utiles pour plan de migration.

`legacy_dca.fields.not_in_canonical` (extraits):
- `strategy.strategy_id`
- `data.source`
- `data.start`
- `data.end`
- `universe`
- `filter_rules`
- `filter_rules_config`
- `screening`
- `optimization.screening`
- `optimization.cache_features`
- `performance.capital_per_unit`
- `output.path`
- `output.format`

Interpretation UI:
- Afficher ces champs comme `legacy-only`.
- Ne jamais les envoyer dans le payload canonical `/runs`.
- Les conserver comme guidance de roadmap migration.

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
