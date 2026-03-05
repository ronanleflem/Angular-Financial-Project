# INIT-003 - Audit Angular des impacts de decommission ta4j vers Python

## Title
- Cartographier les dependances UI aux capacites calculatoires legacy Java

## Ticket type
- Type B: Implementation

## BMAD Stage
- Review-ready

## Cross-Repo Coordination
- Cross-Repo Initiative: INIT-003
- Repo Owner: angular-front-financial
- Upstream Dependencies: INIT-003-spring-decommission-ta4j-computation-to-python, INIT-003-python-decommission-ta4j-computation-to-python
- Contract Version: STRAT-CALC-DECOMMISSION-V1-2026-03-05

## Goal
- Identifier precisement quelles options/parametres strategy launcher dependent encore d'hypotheses ta4j/Java, puis proposer un plan de nettoyage UI aligne sur les capacites backend reelles.

## Context / Entry points
- Pages/components:
  - Strategy launcher (formulaires de strategies, filtres, options avancees)
- Services:
  - Services Angular de construction payload et interpretation des erreurs backend
- State (if any):
  - Modeles/form states des parametres strategies/filtres
- Routes:
  - Routes vers ecrans de lancement/analyse strategy
- API endpoints:
  - Endpoints Spring de lancement/suivi runs utilises par Angular
- Related docs:
  - docs/GENERATE_TICKET_FROM_JIRA.md
  - tickets/_templates/TICKET_TEMPLATE.md
  - tickets/_templates/AUDIT_PROMPT.md
  - C:\Users\ronan\Desktop\Cross-repo-coordination\Cross-repo-coordination\initiatives\INIT-003-decommission-ta4j-computation-to-python.md

## BMAD Handover In
- INIT-003 + CP-003 valides en PM.
- Decision cross-repo: Python devient source de verite calculatoire.
- Inventaire initial des dependances Spring/Python (resultats Architect attendus).

## BMAD Handover Out
- Matrice UI: option/controle -> capacite backend (supporte, deprecie, a masquer, not implemented).
- Liste des impacts front avec priorite et risque de regression.
- Proposition de tickets Dev Angular de decommission progressive.

## Architecture decisions (Phase Architect)
1. Source de verite UX/message
   - Contrat backend canonique Python (`/runs`) = autorite unique pour la semantique d'erreur.
   - UI doit distinguer strictement:
     - erreur contrat (`HTTP 422`, `errors[]`) = erreur de saisie/structure
     - echec runtime (`status=FAILED`, `error.code=not_implemented_feature`) = accepte mais non cable runtime
2. Politique message utilisateur
   - `422`: afficher message de validation au niveau controle + panneau global pour champs non mappes.
   - `FAILED/not_implemented_feature`: afficher `Not implemented yet` et exposer `error.details[]` (champs non cables).
   - `409/425` sur resultat: afficher `Result not available yet` (non bloquant).
3. Politique de normalisation message
   - Ne normaliser vers `Not implemented yet` que sur `error.code=not_implemented_feature` (ou message backend explicitement equivalent).
   - Ne pas ecraser les autres erreurs metier (`unsupported`, `required`, etc.).
4. Politique UI legacy/ta4j
   - Les options legacy non alignees canonical restent visibles seulement si necessaire pour migration, avec signal explicite `Not implemented yet`/`legacy-only`.
   - Aucun envoi de champs hors contrat canonical (`extra=forbid`).

## Evidence (code local)
- Strategy launcher:
  - parsing/mapping 422 deja en place via `parseBackendValidationErrors` + `mapBackendFieldToControlName`.
  - normalisation `Not implemented yet` deja ciblee sur `not_implemented_feature`.
  - refs: `src/app/pages/strategy-launcher/strategy-launcher.page.ts` (zones ~3919-4124).
- Run status:
  - gestion statut terminal et runtime error detail deja presente.
  - refs: `src/app/pages/run-status/run-status.page.ts` (zones ~199-303), `run-status.page.html` (runtime panel).
- Screen strategies:
  - message erreur actuellement generique (`Erreur lors du chargement des strategies.`), sans distinction contrat/runtime.
  - refs: `src/app/components/screen-strategies/screen-strategies.component.ts`, `.spec.ts`.

## Matrice Architect UX/message (UI -> contrat backend -> capacite Python)
| Zone UI | Signal backend attendu | Capacite Python | Decision UX/message |
| --- | --- | --- | --- |
| Strategy launcher form controls | `HTTP 422` + `errors[].field/code/message` | Contrat strict (`extra_forbidden`, `required`, etc.) | Inline errors par controle + panneau global unmapped |
| Strategy launcher unsupported runtime | `status=FAILED` + `error.code=not_implemented_feature` + `details[]` | Accepte mais non cable runtime | Message `Not implemented yet` + liste champs details |
| Run status result polling | `409` ou `425` sur `/result` | Resultat non disponible temporairement | Message info `Result not available yet` |
| Run status terminal fail | `FAILED` + runtime error | Echec metier | Message terminal derive du backend; conserver code/details visibles |
| Screen strategies listing | erreur reseau/HTTP non qualifiee | N/A (endpoint listing) | Introduire convention message contract-aware (422 vs indisponibilite vs vide) en ticket Dev dedie |

## Gaps / impacts UX priorises
- P0
  - Verrouiller convention unique de message sur tout le parcours `/runs`: `422` vs `FAILED/not_implemented_feature` vs `409/425`.
  - Eviter toute confusion utilisateur entre "invalide" et "non implemente runtime".
- P1
  - Aligner `screen-strategies` sur la meme taxonomie de messages (aujourd'hui message unique generique).
  - Harmoniser wording FR/EN (`Not implemented yet` conserve comme message contractuel, libelles annexes FR possibles).
- P2
  - Uniformiser les hints `legacy-only` pour champs ta4j restants dans les sections avancees.

## Plan de migration UI incremental + rollback
1. Etape 1 (safe): centraliser table de mapping des messages backend (422/runtime/result-not-ready) sans changer payload.
2. Etape 2: appliquer la table au launcher + run-status + screen-strategies (coherence cross-page).
3. Etape 3: activer durcissement progressif via feature flag UI (`contractAwareMessagesV1`), fallback sur comportement actuel si regression.
4. Etape 4: retirer messages legacy ambigus une fois telemetrie stable.

Rollback:
- feature flag OFF => retour instantane au comportement message actuel.
- pas de rollback backend requis (front-only UX layer).

## Tickets Dev proposes (post-Architect)
1. Angular Dev - Message contract-aware shared helper:
   - factoriser `422` vs `FAILED/not_implemented_feature` vs `409/425`.
2. Angular Dev - Screen strategies message alignment:
   - remplacer message generique unique par taxonomie backend-compatible.
3. Angular Dev - Regression tests UX/message:
   - launcher, run-status, screen-strategies (success + 422 + runtime failed + result pending).

## Context7 Decision
- Required: No
- Reason: l'audit s'appuie sur code local Angular et contrats internes deja definis.

## Constraints & conventions
- Follow Angular style guide and existing project patterns.
- Use strict typing (DTOs, interfaces, explicit types).
- Use RxJS best practices (no nested subscribes, manage subscriptions).
- Keep naming consistent with the feature and file structure.
- Avoid breaking existing UI/UX and routing.
- Respecter strictement le scope local Angular (pas de changement backend/API).

## Definition of Done
- [x] Inventaire complet des ecrans/services lies aux filtres/strategies legacy.
- [x] Matrice "champ UI -> contrat backend -> capacite Python" documentee.
- [x] Liste des ecarts et impacts UX priorisee (P0/P1/P2).
- [x] Plan de migration UI incremental avec rollback (feature flag ou equivalent) propose.
- [x] Ticket scope respected (no unrelated refactors).

## Implementation plan
1. Identifier tous les points Angular qui construisent/affichent des options strategy/filtres.
2. Verifier leur correspondance avec les contrats backend cibles et capacites Python reelles.
3. Produire backlog de tickets Angular de cleanup/deprecation avec ordre d'execution.

## Tests
- Service tests:
  - `src/app/utils/backend-validation.spec.ts` (non-regression mapping backend)
- Component tests:
  - `src/app/components/screen-strategies/screen-strategies.component.spec.ts`
- E2E tests (if applicable):
  - N/A (scope local component)

## Validation commands
- `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/components/screen-strategies/screen-strategies.component.spec.ts --include src/app/utils/backend-validation.spec.ts`
- `npx ng build`

## Reviewer Gate
- [x] Scope matches ticket and DoD.
- [x] Architecture constraints respected.
- [x] Tests are meaningful and pass.
- [x] No regression risk left unaddressed.

## Dev implementation (local scope)
- Cible implementee: `screen-strategies` uniquement (alignement UX/message avec contrat backend).
- Changements:
  - Mapping d'erreurs backend contract-aware dans `ScreenStrategiesComponent`:
    - `422` + `errors[]` -> message backend de validation (ou fallback `Contrat backend invalide (422).`)
    - `not_implemented_feature` runtime -> `Not implemented yet`
    - indisponibilite backend (`status=0` ou `>=500`) -> `Backend indisponible. Reessayez plus tard.`
    - fallback inconnu -> `Erreur lors du chargement des strategies.`
  - Pas de changement de payload, route, service backend ou contrat API.
  - Nettoyage local non-fonctionnel dans le composant (suppression logs/commentaires legacy).

## Files changed
- `src/app/components/screen-strategies/screen-strategies.component.ts`
- `src/app/components/screen-strategies/screen-strategies.component.spec.ts`

## Validation evidence (Dev)
- Commande:
  - `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/components/screen-strategies/screen-strategies.component.spec.ts --include src/app/utils/backend-validation.spec.ts`
- Resultat:
  - `TOTAL: 18 SUCCESS`

- Commande:
  - `npx ng build`
- Resultat:
  - `FAILED` sur budget SCSS preexistant hors scope ticket:
    - `src/app/pages/strategy-launcher/strategy-launcher.page.scss exceeded maximum budget (8.17 kB > 8.00 kB)`
  - Aucun echec de build lie aux fichiers modifies par INIT-003.

## Final Summary (Dev)
- Alignement UX/message local realise sur `screen-strategies` conformement a la taxonomie backend definie en Architect.
- Couverture de tests composant et utilitaire backend validee.
- Ticket pret pour revue fonctionnelle/technique (`Review-ready`).

## Non-goals / Out of scope
- Aucun changement de contrat API.
- Aucun redesign d'interface hors alignement UX/message.
- Aucun refactor large hors `screen-strategies`.

## Notes / pitfalls
- Change detection considerations: verifier les impacts de champs depreciees sur formulaires reactifs.
- Async/error handling: aligner les messages "not implemented" sur codes backend.
- Performance or RxJS leaks: pas de refactor RxJS tant que non requis par tickets Dev.

## Tickets de suivi proposes
1. Angular Dev - masquer/adapter les options non supportees selon capabilities backend.
2. Angular Dev - normaliser mapping erreurs backend -> messages UI utilisateur.
3. Angular Reviewer - verifier absence de regression sur parcours supportes.
