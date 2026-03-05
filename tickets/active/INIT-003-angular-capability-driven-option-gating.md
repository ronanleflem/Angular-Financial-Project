# INIT-003 - Angular capability-driven option gating

## Title
- Piloter les options UI par capabilities backend

## Ticket type
- Type B: Implementation

## BMAD Stage
- PM

## Cross-Repo Coordination
- Cross-Repo Initiative: INIT-003
- Repo Owner: angular-front-financial
- Upstream Dependencies: INIT-003-spring-cutover-legacy-backtest-routing, INIT-003-python-backtest-signal-parity-expansion, INIT-003-python-dca-grid-preset-parity
- Contract Version: STRAT-CALC-DECOMMISSION-V1-2026-03-05

## Goal
- Afficher/masquer les options strategy/filtres selon les capabilities backend pour eviter l'exposition de parcours non supportes.

## Context / Entry points
- Pages/components:
  - strategy-launcher
- Services:
  - service lecture capabilities runs
- State (if any):
  - modeles de formulaire strategy/filtres
- Routes:
  - parcours launch backtest/dca
- API endpoints:
  - endpoints capabilities/runs backend
- Related docs:
  - ticket audit INIT-003 angular

## BMAD Handover In
- Cutover backend canonical valide.
- Capabilities Python mises a jour sur gaps prioritaires.

## BMAD Handover Out
- UI conditionnee par capabilities backend.
- Reduction des soumissions menant a `not_implemented_feature`.

## Context7 Decision
- Required: No
- Reason: comportement base sur contrats internes deja disponibles.

## Constraints & conventions
- Follow Angular style guide and existing project patterns.
- Use strict typing (DTOs, interfaces, explicit types).
- Use RxJS best practices (no nested subscribes, manage subscriptions).
- Keep naming consistent with the feature and file structure.
- Avoid breaking existing UI/UX and routing.

## Definition of Done
- [ ] Options non supportees masquees/desactivees selon capabilities.
- [ ] Fallback explicite en cas d'indisponibilite capabilities.
- [ ] Tests component/service ajoutes.
- [ ] Validation commands pass.

## Implementation plan
1. Integrer capabilities au chargement ecran.
2. Mapper capabilities -> etats UI (visible/disabled/hint).
3. Ajouter tests non-regression.

## Tests
- Service tests:
  - parse/mapping capabilities
- Component tests:
  - strategy launcher option gating
- E2E tests (if applicable):
  - scenario de soumission avec options supportees/non supportees

## Validation commands
- `ng test`
- `ng build`

## Reviewer Gate
- [ ] Scope matches ticket and DoD.
- [ ] Architecture constraints respected.
- [ ] Tests are meaningful and pass.
- [ ] No regression risk left unaddressed.

## Non-goals / Out of scope
- Changement de contrat API.
- Refonte visuelle complete du launcher.

## Notes / pitfalls
- Eviter heuristiques locales de support si capabilities absentes ou stale.
