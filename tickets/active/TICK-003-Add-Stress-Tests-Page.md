# Ticket Template

## Title
- Ajouter la page stress-tests/:runId avec panels Monte Carlo et Scénarios

## Goal
- Permettre l’affichage complet des stress tests d’un run (Monte Carlo + Scénarios) avec KPIs, tableaux de percentiles et courbes, en consommant le payload front-ready quand disponible et un fallback vers le payload brut.

## Context / Entry points
- Pages/components: `StressTestsPageComponent` (new), `MonteCarloPanelComponent` (new), `ScenariosPanelComponent` (new), `EquityCurveChartComponent` (new), `PercentileTableComponent` (new)
- Services: `StressTestsService` (new)
- State (if any): état local + observables UI
- Routes: `/stress-tests/:runId`
- API endpoints: `GET /api/stress-tests/summary?runId=...`, `GET /api/stress-tests?runId=...`
- Related docs: à préciser (si docs d’architecture/projet existantes)

## Constraints & conventions
- Follow Angular style guide and existing project patterns.
- Use strict typing (DTOs, interfaces, explicit types).
- Use RxJS best practices (no nested subscribes, manage subscriptions).
- Keep naming consistent with the feature and file structure.
- Avoid breaking existing UI/UX and routing.
- Limiter l’affichage à 50 courbes max (échantillonnage si nécessaire).
- Lazy-render des charts (viewport/visibility ou composant différé) pour éviter surcharge.
- Supporter `light` / `light_strict` si le back renvoie uniquement `equity_curves` (fallback visuel/structure).
- Utiliser les percentiles p10/p50/p90 si dispo, sinon p5/p50/p95.

## Definition of Done
- [ ] La page `/stress-tests/:runId` est accessible et affiche Monte Carlo + Scénarios.
- [ ] Le front consomme le payload front-ready quand disponible, sinon mappe le payload brut.
- [ ] Les KPIs Monte Carlo affichent ruinProbability (si présent), median return, median max drawdown.
- [ ] Le graphique “bandes percentiles” est rendu (p10/p50/p90 ou p5/p50/p95).
- [ ] Les courbes sont limitées à 50 et rendu lazy activé.
- [ ] Les cartes scénarios (nom/type/params), tableau de métriques et courbe unique par scénario sont visibles.
- [ ] Loading, empty, et error states sont gérés.
- [ ] Tests service + composants principaux ajoutés/ajustés.
- [ ] No TypeScript errors; lint and build pass.
- [ ] Ticket scope respected (no unrelated refactors).

## Implementation plan
1. Ajouter la route `/stress-tests/:runId` et créer la page `StressTestsPageComponent`.
2. Définir les DTOs pour le payload front-ready et le payload brut + un modèle UI unifié.
3. Implémenter `StressTestsService` avec stratégie “front-ready puis fallback brut” (erreurs 404/structure incomplète).
4. Mapper le payload brut vers le modèle UI (Monte Carlo + Scénarios), y compris percentiles, KPIs et courbes.
5. Implémenter `MonteCarloPanelComponent` (KPIs, percentile band chart, liste d’échantillons, table percentiles).
6. Implémenter `ScenariosPanelComponent` (cards, table metrics, courbe unique).
7. Ajouter `EquityCurveChartComponent` et `PercentileTableComponent` avec lazy render et limite de courbes.
8. Gérer les états loading/empty/error et cas `light/light_strict`.

## Tests
- Service tests:
  - Doit appeler `/api/stress-tests/summary?runId=...` et utiliser la réponse si valide.
  - Doit fallback sur `/api/stress-tests?runId=...` si summary indisponible/invalide.
  - Doit mapper correctement vers le modèle UI.
- Component tests:
  - `StressTestsPageComponent`: loading/error/empty/data.
  - `MonteCarloPanelComponent`: KPIs + table percentiles.
  - `ScenariosPanelComponent`: cards + table + courbe unique.
- E2E tests (optional):
  - Navigation vers `/stress-tests/:runId` et rendu des deux sections.

## Validation commands
- `ng test`
- `ng build`
- (Optional) `npx playwright test`

## Non-goals / Out of scope
- Modification de l’API backend ou du contrat JSON.
- Refactor global de la charte UI.
- Ajout d’export / téléchargement de données.

## Notes / pitfalls
- Ambiguïtés à clarifier: liste des “3–5 métriques clés” pour la table percentiles, et structure exacte des `equity_curves` en mode `light/light_strict`.
- Les champs peuvent être absents (ruinProbability, percentiles), prévoir un affichage “N/A”.
- Risque perf: volumes de courbes ? appliquer limite 50 + lazy render.
- Préférer `async` pipe et éviter abonnements manuels pour limiter les fuites.
