# INIT-003 - Angular shared contract-aware error mapping

## Title
- Mutualiser le mapping d'erreurs backend sur les pages runs

## Ticket type
- Type B: Implementation

## BMAD Stage
- PM

## Cross-Repo Coordination
- Cross-Repo Initiative: INIT-003
- Repo Owner: angular-front-financial
- Upstream Dependencies: INIT-003-spring-cutover-legacy-backtest-routing, INIT-003-python-backtest-signal-parity-expansion
- Contract Version: STRAT-CALC-DECOMMISSION-V1-2026-03-05

## Goal
- Centraliser une table de mapping contract-aware (`422`, `FAILED/not_implemented_feature`, `409/425`) reutilisable par launcher, run-status et screen-strategies.

## Context / Entry points
- Pages/components:
  - strategy-launcher
  - run-status
  - screen-strategies
- Services:
  - utilitaires backend-validation/messages
- State (if any):
  - etats erreurs et messages utilisateur
- Routes:
  - parcours runs
- API endpoints:
  - runs submit/status/result
- Related docs:
  - ticket audit INIT-003 angular

## BMAD Handover In
- Contrat backend canonical stable.
- Taxonomie d'erreurs backend validee cross-repo.

## BMAD Handover Out
- Helper partage de mapping erreurs.
- Pages consommateurs alignees sur une semantique unique.

## Context7 Decision
- Required: No
- Reason: implementation locale sans dep externe incertaine.

## Constraints & conventions
- Follow Angular style guide and existing project patterns.
- Use strict typing (DTOs, interfaces, explicit types).
- Use RxJS best practices (no nested subscribes, manage subscriptions).
- Keep naming consistent with the feature and file structure.
- Avoid breaking existing UI/UX and routing.

## Definition of Done
- [ ] Helper partage cree et adopte sur pages cibles.
- [ ] Distinction explicite `422` vs `not_implemented_feature` vs `409/425`.
- [ ] Tests utilitaires/components mis a jour.
- [ ] Validation commands pass.

## Implementation plan
1. Creer helper/adapter de mapping d'erreurs.
2. Integrer helper dans pages cibles.
3. Ajouter tests et verifier non-regression.

## Tests
- Service tests:
  - backend-validation/mapping helper
- Component tests:
  - launcher, run-status, screen-strategies
- E2E tests (if applicable):
  - parcours erreur contract/runtimes

## Validation commands
- `ng test`
- `ng build`

## Reviewer Gate
- [ ] Scope matches ticket and DoD.
- [ ] Architecture constraints respected.
- [ ] Tests are meaningful and pass.
- [ ] No regression risk left unaddressed.

## Non-goals / Out of scope
- Changement contrat backend.
- Refonte de design UI.

## Notes / pitfalls
- Ne pas ecraser les erreurs metier non concernees par la taxonomie INIT-003.
