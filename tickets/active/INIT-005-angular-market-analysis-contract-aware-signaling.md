# INIT-005 - Angular market analysis contract-aware signaling

## Goal
- Aligner les messages et etats UI de `/market-analysis` sur le contrat Spring.
- Supprimer l'ambiguite entre validation, absence de resultat, run introuvable et indisponibilite service.

## Scope
- Page/composant:
  - `src/app/components/market-analysis/market-analysis.page.*`
- Utils/services:
  - mapping erreurs HTTP -> signalisation UI
  - reutilisation possible de `src/app/utils/backend-validation.ts`
- API concernee:
  - `/api/market-analysis/runs*`
- Etats UI:
  - `ready`, `empty`, `error`, messages detail, retry

## Dependencies
- Catalogue runs integre.
- Detail/result integres.
- Contrat erreurs backend confirme:
  - `422`: `{ errors: [{ field, code, message }] }`
  - `404`: run introuvable
  - `409`: resultat pas pret
  - `5xx/status=0`: indisponibilite service

## Done
- [ ] `422` -> message validation exploitable avec details champ.
- [ ] `404` -> message run introuvable.
- [ ] `409` -> message informatif "resultat pas pret".
- [ ] `5xx/status=0` -> message indisponibilite + retry.
- [ ] Suppression des messages et badges bases sur fallback mock en production.
- [ ] Tests unitaires de mapping erreurs et affichage ajoutes.
- [ ] `ng test` et `ng build` passent.

## Plan
1. Ajouter un helper unique de mapping erreur -> message UI.
2. Brancher ce helper dans la page market-analysis.
3. Remplacer la signalisation basee sur `isMock`.
4. Ajouter les tests sur `422`, `404`, `409`, `5xx`.

## Validation
- `ng test`
- `ng build`

## Out of scope
- Refonte visuelle globale.
- Runtime `/runs` et message `Not implemented yet`.
