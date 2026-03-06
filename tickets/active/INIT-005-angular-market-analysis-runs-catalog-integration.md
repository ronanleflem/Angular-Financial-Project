# INIT-005 - Angular market analysis runs catalog integration

## Goal
- Connecter `/market-analysis` au catalogue de runs Spring (`/api/market-analysis/runs`).
- Permettre la consultation filtree des runs `market_stats` et `seasonality`.

## Scope
- Page/composant:
  - `src/app/components/market-analysis/market-analysis.page.*`
- Services:
  - service de lecture du catalogue runs (`market-stats.service.ts` ou service dedie)
- API:
  - `GET /api/market-analysis/runs`
- Etats UI:
  - liste, filtres, pagination, `loading`, `error`, `empty`

## Dependencies
- Endpoint Spring `/api/market-analysis/runs` disponible.
- Contrat pagination stable: `items`, `page`, `size`, `total_elements`, `total_pages`, `sort`.
- Ticket suivant depend de celui-ci:
  - `INIT-005-angular-market-analysis-run-detail-and-result-rendering`

## Done
- [ ] Appel `GET /api/market-analysis/runs` integre avec DTOs stricts.
- [ ] Filtres UI relies aux query params backend: `spec_type`, `status`, `symbol`, `timeframe`, `from`, `to`, `page`, `size`, `sort`.
- [ ] Pagination fonctionnelle.
- [ ] Etats `loading/error/empty` geres sans fallback mock silencieux.
- [ ] Tests service/component ajoutes ou mis a jour.
- [ ] `ng test` et `ng build` passent.

## Plan
1. Ajouter DTOs `MarketAnalysisRunItem` et `MarketAnalysisRunsPage`.
2. Integrer le service de lecture avec mapping query params.
3. Rendre la liste et les filtres dans `/market-analysis`.
4. Ajouter les tests de base sur liste/pagination/erreurs.

## Validation
- `ng test`
- `ng build`

## Out of scope
- Detail d'un run.
- Rendu des donnees resultat.
- Lancement ou annulation de run.
