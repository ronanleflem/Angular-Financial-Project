# Ticket Template

## Title
- Harmoniser le visuel de la page Stress Tests avec le design existant

## Goal
- Aligner la présentation des Stress Tests (typographies, cartes, espacements, couleurs, états) sur les pages déjà stylées du projet pour une cohérence UI/UX mesurable dans l’interface.

## Context / Entry points
- Pages/components:
  - src/app/pages/stress-tests/stress-tests.page.html
  - src/app/pages/stress-tests/stress-tests.page.scss
  - src/app/pages/stress-tests/components/monte-carlo-panel/monte-carlo-panel.component.html
  - src/app/pages/stress-tests/components/monte-carlo-panel/monte-carlo-panel.component.scss
  - src/app/pages/stress-tests/components/scenarios-panel/scenarios-panel.component.html
  - src/app/pages/stress-tests/components/scenarios-panel/scenarios-panel.component.scss
  - src/app/pages/stress-tests/components/percentile-table/percentile-table.component.scss
  - src/app/pages/stress-tests/components/equity-curve-chart/equity-curve-chart.component.scss
- Services:
  - src/app/services/stress-tests.service.ts (pas de changement attendu)
- State (if any):
  - StressTestsPageComponent (signals state, runs, runId)
- Routes:
  - /stress-tests
  - /stress-tests/:runId
- API endpoints:
  - GET /api/stress-tests/summary
  - GET /api/stress-tests
  - GET /api/stress-tests/runs
- Related docs:
  - src/app/pages/data-availability/data-availability.page.scss (référence visuelle)
  - src/app/components/market-analysis/market-analysis.page.scss (référence visuelle)

## Constraints & conventions
- Follow Angular style guide and existing project patterns.
- Use strict typing (DTOs, interfaces, explicit types).
- Use RxJS best practices (no nested subscribes, manage subscriptions).
- Keep naming consistent with the feature and file structure.
- Avoid breaking existing UI/UX and routing.
- Ne pas modifier la logique métier, le mapping de données ou les appels API.
- Prioriser les patterns visuels déjà utilisés (cards, headers, chips, tables) dans les écrans existants.

## Definition of Done
- [ ] Le header, les cartes et les sections Stress Tests sont visuellement cohérents avec les pages de référence.
- [ ] Les états vide/chargement/erreur utilisent un style aligné (couleurs, marges, typographie).
- [ ] Les boutons, selecteurs et chips respectent les mêmes rayons, ombres et contrastes.
- [ ] La mise en page reste responsive (>= 320px) sans casser les charts.
- [ ] Aucune régression fonctionnelle (sélection de run, reload, affichage des données).
- [ ] Tests unitaires ajustés si la structure DOM évolue.
- [ ] Build et tests passent.

## Implementation plan
1. Comparer l’UI Stress Tests avec les pages de référence (Data Availability / Market Analysis) et lister les écarts (header, background, cards, typographie, états).
2. Harmoniser stress-tests.page.scss (fond, espacements, header, actions, états) en réutilisant la palette et les patterns existants.
3. Aligner les styles des panels Monte Carlo et Scénarios (cards, titres, badges, warnings) sur les cards des autres écrans.
4. Ajuster si nécessaire percentile-table et equity-curve-chart pour cohérence des marges/typos (CSS uniquement).
5. Vérifier les breakpoints et l’accessibilité visuelle (contrastes, lisibilité).
6. Mettre à jour les tests de composant si la structure HTML est modifiée.

## Tests
- Service tests:
  - Aucun changement attendu.
- Component tests:
  - src/app/pages/stress-tests/stress-tests.page.spec.ts si la structure du template évolue.
- E2E tests (if applicable):
  - (Optionnel) smoke test visuel via Playwright si déjà en place.

## Validation commands
- ng test
- ng build
- (Optional) npx playwright test

## Non-goals / Out of scope
- Pas de nouvelles fonctionnalités (filtres, export, nouveaux KPI).
- Pas de changements sur les API ou la structure des données.
- Pas de refonte globale du design system.

## Notes / pitfalls
- Ambiguïté à lever : préciser l’écran de référence exact pour “ce qui existe déjà” (Data Availability, Market Analysis, autre).
- Attention aux styles locaux déjà présents dans stress-tests.page.scss (ne pas dégrader la lisibilité).
- Éviter l’usage excessif de ::ng-deep sauf nécessité avérée.
