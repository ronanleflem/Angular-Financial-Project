# Source Of Truth - Canonical Runs (2026-02-19)

Date de reference: 2026-02-19
Source backend: `src/quant_engine/api/run_request_input.py` (repo Python)

Objectif:
- Donner une base exploitable pour implementation Angular sans deviner le contrat backend.
- Reduire les `422 extra_forbidden` et clarifier les echec runtime (`FAILED`).

Fichiers:
- `dca.md`
- `backtest.md`
- `market_stats.md`
- `seasonality.md`
- `stress_tests.md`
- `JIRA_TICKETS_CANONICAL_ALIGNMENT_2026-02-19.md`

Regles globales:
- Contrat strict (`extra=forbid`): toute cle non declaree => HTTP 422 (`extra_forbidden`).
- Champs communs top-level acceptes: `catalog_version`, `request_id`, `output`, `persistence`, `filters`, `performance`.
- `200` sur `POST /runs` signifie "payload accepte" (pas forcement execution metier complete).
- `FAILED` + `error.code=not_implemented_feature` signifie "champ accepte mais non cable runtime".

Definition of Ready (Angular):
- Le payload canonique genere par front ne contient aucune cle hors contrat.
- Les erreurs `422` sont mappables vers controles UI.
- Les erreurs `FAILED/not_implemented_feature` sont affichees en message utilisateur + details.
