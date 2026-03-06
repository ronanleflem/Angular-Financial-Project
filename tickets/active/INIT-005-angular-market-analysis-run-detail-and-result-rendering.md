# INIT-005 - Angular market analysis run detail and result rendering

## Goal
- Permettre l'ouverture d'un run depuis la liste.
- Afficher son detail et ses donnees resultat via les endpoints Spring `market-analysis`.

## Scope
- Page/composant:
  - `src/app/components/market-analysis/market-analysis.page.*`
- Services:
  - service detail/result market-analysis
- API:
  - `GET /api/market-analysis/runs/{runId}`
  - `GET /api/market-analysis/runs/{runId}/result`
- Etats UI:
  - `selectedRunId`, `runDetail`, `runResult`, `resultSource`

## Dependencies
- Catalogue runs deja integre.
- Contrat Spring detail/result stable:
  - `meta`: `spec_id`, `dataset_id`, `out_dir`, `window`, `start`, `end`, `status`
  - `data`: `market_stats_rows[]`, `seasonality_profiles[]`, `seasonality_run_summary`, `raw_result_json`
- Ticket suivant depend partiellement de celui-ci:
  - `INIT-005-angular-market-analysis-contract-aware-signaling`

## Done
- [ ] Detail run charge via endpoint `{runId}`.
- [ ] Resultat run charge via endpoint `{runId}/result`.
- [ ] Rendu conditionnel des sections:
  - `market_stats_rows[]`
  - `seasonality_profiles[]`
  - `seasonality_run_summary`
  - `raw_result_json` en fallback de lecture si non persiste
- [ ] Gestion `409 result not ready` avec etat informatif non bloquant.
- [ ] Tests service/component ajoutes.
- [ ] `ng test` et `ng build` passent.

## Plan
1. Ajouter DTOs detail/result alignes sur le contrat Spring.
2. Ajouter l'action UI pour ouvrir un run.
3. Charger puis afficher detail et resultat.
4. Ajouter les tests sur success, `404`, `409` et rendu conditionnel.

## Validation
- `ng test`
- `ng build`

## Out of scope
- Changement des endpoints backend.
- Ajout de nouveaux calculs metier.
- Refactor de la page `/runs/:requestId`.
