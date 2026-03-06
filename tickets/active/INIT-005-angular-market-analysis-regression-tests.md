# INIT-005 - Angular market analysis regression tests

## Goal
- Verrouiller la non-regression de `/market-analysis` apres migration vers les endpoints Spring `market-analysis`.

## Scope
- Specs composant:
  - `src/app/components/market-analysis/market-analysis.page.spec.ts`
- Specs services:
  - services catalogue/detail/result market-analysis
- Cas couverts:
  - succes, `loading`, `empty`, `422`, `404`, `409`, `5xx/status=0`

## Dependencies
- Catalogue runs integre.
- Detail/result integres.
- Signalisation contract-aware finalisee.

## Done
- [ ] Tests service pour liste/detail/result et DTO mapping.
- [ ] Tests composant pour `loading`, `empty`, `error`, `ready`.
- [ ] Cas d'erreur verifies: `422`, `404`, `409`, `5xx/status=0`.
- [ ] Plus de tests bases sur fallback mock par defaut.
- [ ] `ng test` et `ng build` passent.

## Plan
1. Mettre a jour les fixtures HTTP selon le contrat Spring.
2. Ajouter les cas manquants sur pagination, selection run et resultat non pret.
3. Stabiliser les tests asynchrones.
4. Verifier qu'aucune regression front n'est introduite sur `/market-analysis`.

## Validation
- `ng test`
- `ng build`

## Out of scope
- Nouvelles metriques metier.
- Refactor hors market-analysis.
