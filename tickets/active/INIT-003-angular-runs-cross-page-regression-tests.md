# INIT-003 - Angular runs cross-page regression tests

## Title
- Verrouiller non-regressions UX sur launcher/run-status/screen-strategies

## Ticket type
- Type B: Implementation

## BMAD Stage
- PM

## Cross-Repo Coordination
- Cross-Repo Initiative: INIT-003
- Repo Owner: angular-front-financial
- Upstream Dependencies: INIT-003-angular-capability-driven-option-gating, INIT-003-angular-contract-aware-error-mapping-shared, INIT-003-spring-cutover-legacy-backtest-routing
- Contract Version: STRAT-CALC-DECOMMISSION-V1-2026-03-05

## Goal
- Consolider les tests cross-page pour securiser la transition vers le flux canonical et les nouveaux messages contract-aware.

## Context / Entry points
- Pages/components:
  - strategy-launcher
  - run-status
  - screen-strategies
- Services:
  - helpers erreurs/capabilities
- State (if any):
  - etats loading/error/result
- Routes:
  - launch -> status -> result
- API endpoints:
  - runs lifecycle endpoints
- Related docs:
  - ticket audit INIT-003 angular

## BMAD Handover In
- Ticket option gating complete.
- Ticket mapping erreurs partage complete.

## BMAD Handover Out
- Suite de tests couvrant success, `422`, `not_implemented_feature`, `409/425`.
- Evidence de non-regression front avant retrait final ta4j Spring.

## Context7 Decision
- Required: No
- Reason: tests relies on internal contracts only.

## Constraints & conventions
- Follow Angular style guide and existing project patterns.
- Use strict typing (DTOs, interfaces, explicit types).
- Use RxJS best practices (no nested subscribes, manage subscriptions).
- Keep naming consistent with the feature and file structure.
- Avoid breaking existing UI/UX and routing.

## Definition of Done
- [ ] Tests unit/components couvrent taxonomie d'erreurs complete.
- [ ] Parcours cross-page validates.
- [ ] Aucun echec TS/lint/build lie au scope.
- [ ] Validation commands pass.

## Implementation plan
1. Ajouter cas de tests manquants par page.
2. Factoriser fixtures backend responses.
3. Executer et stabiliser la suite.

## Tests
- Service tests:
  - mapping erreurs/capabilities
- Component tests:
  - launcher, run-status, screen-strategies
- E2E tests (if applicable):
  - scenario cross-page canonical

## Validation commands
- `ng test`
- `ng build`

## Reviewer Gate
- [ ] Scope matches ticket and DoD.
- [ ] Architecture constraints respected.
- [ ] Tests are meaningful and pass.
- [ ] No regression risk left unaddressed.

## Non-goals / Out of scope
- Nouvelles features produit.
- Modifications backend.

## Notes / pitfalls
- Tenir compte des erreurs de build preexistantes hors scope.
