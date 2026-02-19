## Title
- Strategy Launcher Backtest: afficher et gerer les options Python non implementees

## Ticket type
- Type B: Implementation

## BMAD Stage
- Done

## Cross-Repo Coordination
- Cross-Repo Initiative: INIT-002
- Repo Owner: angular-front-financial
- Upstream Dependencies:
  - `C:\Users\ronan\Desktop\Projet Finance\spring\Financial-Project\tickets\active\INIT-002-spring-strategy-launcher-backtest-not-implemented.md`
  - `C:\Users\ronan\Desktop\Quant-Engine-Python\Quant-Python-Engine\tickets\active\INIT-002-python-strategy-launcher-backtest-not-implemented.md`
- Contract Version: catalog_version=2026-02-02

## Goal
- Dans la page `strategy-launcher`, conserver les options backtest existantes mais marquer explicitement `Not implemented yet` celles non supportees cote Python, afin d'eviter l'ambiguite utilisateur sans regression sur les options deja fonctionnelles.

## Context / Entry points
- Pages/components:
  - `src/app/**/strategy-launcher*` (page + sous-composants backtest a confirmer en phase Architect)
- Services:
  - service Angular qui construit/envoie le payload backtest vers Spring
- State (if any):
  - state formulaire strategy-launcher
- Routes:
  - route strategy-launcher
- API endpoints:
  - endpoint backtest expose par Spring (path exact a confirmer)
- Related docs:
  - `docs/GENERATE_TICKET_FROM_JIRA.md`
  - `tickets/_templates/TICKET_TEMPLATE.md`
  - `tickets/_templates/AUDIT_PROMPT.md`

## BMAD Handover In
- INIT/CP disponibles:
  - `C:\Users\ronan\Desktop\Cross-repo-coordination\Cross-repo-coordination\initiatives\INIT-002-strategy-launcher-backtest-not-implemented.md`
  - `C:\Users\ronan\Desktop\Cross-repo-coordination\Cross-repo-coordination\context-packs\CP-002-strategy-launcher-backtest-not-implemented.md`
- Payload de reference fourni (JIRA) avec `spec_type=backtest` et `catalog_version=2026-02-02`.
- Matrice supporte/non supporte provenant du ticket Python.
- Decisions contractuelles Spring/Python disponibles:
  - Spring: `POST /api/runs` = source de verite transport canonical (pass-through), 422 structure pour champs non supportes.
  - Python: distinction `NON_SUPPORTE_CONTRAT` (422) vs `NON_SUPPORTE_RUNTIME` (run `FAILED` + `error.code=not_implemented_feature`).

## BMAD Handover Out
- Liste explicite UI des champs `Not implemented yet`.
- Comportement de soumission clarifie pour champs non supportes.
- Tests Angular de non-regression sur payload supporte.
- Notes de dependance mises a jour pour reviewer gate.

## Architecture decisions (Phase Architect)
1. Source de verite contrat / support
   - Angular ne decide pas localement ce qui est "implante" cote backtest canonical.
   - La classification supporte/non supporte vient du backend cross-repo:
     - Spring propage les erreurs 422 structurees (`field`, `code`, `message`) de Python.
     - Python qualifie `NON_SUPPORTE_CONTRAT` vs `NON_SUPPORTE_RUNTIME`.
2. Politique UX "Not implemented yet"
   - Un champ backtest doit afficher explicitement `Not implemented yet` quand il est non supporte par contrat backend.
   - Le pattern DCA deja present (`mat-hint`/badge `.not-implemented`) est la reference UX a reutiliser dans la section backtest.
   - Les champs supportes conservent le comportement actuel.
3. Politique de soumission payload
   - Angular continue d'emettre le payload canonical complet pour les champs backtest actuellement exposes par le formulaire.
   - Aucun "drop silencieux" de champ non supporte hors regle existante de filtrage catalogue (`filters` non catalogues deja exclus).
   - Les retours backend sont la source d'autorite pour informer l'utilisateur des champs non implementes.
4. Politique de mapping erreurs backend -> UI
   - Reutiliser la chaine existante:
     - parsing 422 via `parseBackendValidationErrors`
     - mapping `field` -> `FormControl` via `mapBackendFieldToControlName`
     - affichage inline des erreurs backend sur controles
   - Etendre/normaliser les messages UX pour traduire les codes backend non supportes vers `Not implemented yet` sans masquer les autres erreurs metier.

## Matrice Architect Angular (scope UI)
| Section UI strategy-launcher | Champ(s) UI | Payload canonical emis | Statut backend cross-repo (catalog_version=2026-02-02) | Decision UX Architect |
| --- | --- | --- | --- | --- |
| Backtest (signal) | `signalType`, `fast`, `slow`, `requireCrossing` | `signal.*` | `NON_SUPPORTE_RUNTIME` (Python) | Afficher `Not implemented yet`; conserver lisibilite des controles |
| TP/SL > Dynamic SL | `dynamicSlEnabled`, `dynamicSlMode`, `dynamicSlAtrMult` | `strategy.tp_sl.dynamic_sl.*` | Mapping contract a confirmer cross-repo (Python reference actuelle: `strategy.params.tp_sl.*`) | Afficher `Not implemented yet` |
| TP/SL > Jitter | `tpslJitterEnabled`, `tpslJitterDist`, `tpslJitterTpBps`, `tpslJitterSlBps`, `tpslJitterSeed` | `strategy.tp_sl.jitter.*` | Mapping contract a confirmer cross-repo (Python reference actuelle: `strategy.params.tp_sl.*`) | Afficher `Not implemented yet` |
| Filter rules | `filterRules`, `rule_*`, `filterRuleMinScore`, `filterRuleMinScorePct` | `filters.rules[]`, `filters.rules_config.*` | `NON_SUPPORTE_RUNTIME` (Python) | Afficher `Not implemented yet` |
| Screening / pruning | `screeningEnabled`, `screenWindow*`, `screenMax*` | `strategy.screening.*` | `NON_SUPPORTE_CONTRAT` (422 attendu selon matrice Python/Spring) | Afficher `Not implemented yet` + message explicite |
| Filtres (catalog) | `filters` + params | `filters.filters[]` + params | Support variable selon catalog + runtime Python | Garder logique catalog existante; completer signalisation backend non supporte |

## Clarifications cross-repo requises avant Dev
- Confirmer le `field path` exact pour la famille screening en erreur backend canonical (`strategy.screening.*` attendu cote Angular).
- Confirmer le mapping de structure TP/SL entre Angular et contrat Python canonical:
  - payload Angular actuel: `strategy.tp_sl.*`
  - reference Python Architect: `strategy.params.tp_sl.*`
  - decider la forme canonique unique avant phase Dev.
- Stabiliser la convention de code backend pour non supporte runtime:
  - cible actuelle Python: `error.code=not_implemented_feature`.
  - fallback Angular: detection par `message` si code absent/instable.
- Verifier que Spring preserve integralement `field/code/message` en 422 sans remapping.

## Plan Dev cible (sans implementation ici)
1. Ajouter une table locale de correspondance "control -> non supporte" pour la section backtest, derivee de la matrice ci-dessus.
2. Appliquer le pattern visuel `Not implemented yet` dans `strategy-launcher.page.html` sur les groupes controles concernes.
3. Ajuster l'UX de soumission:
   - si backend renvoie non supporte, afficher feedback explicite "Not implemented yet" au niveau controle et resume.
   - conserver le comportement actuel pour erreurs de validation non liees.
4. Completer les tests Angular:
   - rendu de la signalisation `Not implemented yet` sur champs cibles.
   - mapping erreurs backend (`field/code/message`) vers controles backtest.
   - non-regression du payload canonical supporte.

## Validation plan (Architect gate)
- Unit/component:
  - couverture du rendu `Not implemented yet` dans la zone backtest.
  - couverture du mapping `mapBackendFieldToControlName` pour chemins backtest non supportes.
- Service/integration:
  - soumission `POST /api/runs` avec payload backtest canonical (`catalog_version=2026-02-02`).
  - simulation 422 backend non supporte -> affichage UI attendu.
- Non-regression:
  - options deja supportees ne changent pas de comportement UI/submit.

## Context7 Decision
- Required: No
- Reason: Le besoin se base sur le contrat fourni et les repos locaux, sans API/lib externe incertaine.

## Constraints & conventions
- Follow Angular style guide and existing project patterns.
- Use strict typing (DTOs, interfaces, explicit types).
- Use RxJS best practices (no nested subscribes, manage subscriptions).
- Keep naming consistent with the feature and file structure.
- Avoid breaking existing UI/UX and routing.
- Ne pas masquer une option non supportee sans signal explicite utilisateur (`Not implemented yet`).

## Definition of Done
- [x] Les options backtest non supportees Python sont identifiees et marquees `Not implemented yet` dans strategy-launcher.
- [x] Les options deja supportees continuent a fonctionner sans changement de comportement.
- [x] La construction du payload respecte le contrat valide (`catalog_version=2026-02-02`).
- [x] Tests composants/services mis a jour et verts.
- [x] Build Angular passe.

## Implementation plan
1. Cartographier les champs backtest utilises par l'UI vs matrice Python supporte/non supporte.
2. Ajouter la signalisation UI `Not implemented yet` sur les controles concernes (libelle, help text, etat disabled si necessaire).
3. Aligner le mapping payload pour eviter l'envoi ambigu des champs non supportes selon contrat Spring/Python.
4. Ajouter/mettre a jour tests composants et services (cas supporte, cas non supporte).

## Tests
- Service tests:
  - tests du builder payload strategy-launcher
- Component tests:
  - rendu de l'etat `Not implemented yet`
- E2E tests (if applicable):
  - scenario strategy-launcher avec options non supportees

## Validation commands
- `ng test`
- `ng build`
- (Optional) `npx playwright test`

## Reviewer Gate
- [x] Scope matches ticket and DoD.
- [x] Architecture constraints respected.
- [x] Tests are meaningful and pass.
- [x] No regression risk left unaddressed.

## Validation evidence (Dev)
- `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/utils/backend-validation.spec.ts --include src/app/pages/strategy-launcher/strategy-launcher.page.spec.ts` -> SUCCESS (11 tests, 0 failed).
- `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/pages/strategy-launcher/strategy-launcher.page.spec.ts` -> SUCCESS (5 tests, 0 failed).
- `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/pages/strategy-launcher/strategy-launcher.page.spec.ts --include src/app/services/runs.service.spec.ts --include src/app/utils/preset-form-fallback.spec.ts --include src/app/utils/backend-validation.spec.ts` -> SUCCESS (22 tests, 0 failed).
- `npx ng build` -> SUCCESS (build OK, warnings budget/CommonJS pre-existants).

## Final Summary
- UI backtest alignee avec signalisation explicite `Not implemented yet` sur sections non supportees.
- Mapping erreurs backend durci pour ne convertir en `Not implemented yet` que les cas `not_implemented_feature` (pas de masquage d'autres erreurs).
- Payload backtest canonical Angular aligne au contrat `/runs`:
  - suppression de `data.strategy_name`
  - deplacement `strategy.tp_sl` -> `strategy.params.tp_sl`
  - deplacement `strategy.screening` -> `strategy.params.screening`
- Types/modeles/tests associes mis a jour pour conserver la coherence et eviter regression.

## Residual Risks
- Aucun risque residuel bloquant identifie pour le scope de ce ticket.
- Risques non bloquants connus (hors scope ticket): warnings de budget SCSS et dependance CommonJS (`hammerjs`) au build.

## Non-goals / Out of scope
- Implementer les features backtest manquantes cote Python.
- Introduire un nouveau contrat API sans validation cross-repo.
- Refactor global de strategy-launcher hors zone backtest.

## Notes / pitfalls
- Eviter que `Not implemented yet` soit interprete comme erreur bloquante si le champ est optionnel.
- Conserver la coherence entre labels UI et semantique backend.
- Toute ambiguite contrat doit remonter vers Spring/Python avant dev final.
