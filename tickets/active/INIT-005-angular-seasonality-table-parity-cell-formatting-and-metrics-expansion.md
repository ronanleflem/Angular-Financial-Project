# INIT-005 - Angular seasonality table parity: cell formatting and metrics expansion

## Goal
- Rendre les cellules seasonality lisibles, en particulier la colonne `metrics` actuellement affichee en JSON brut.
- Uniformiser le formatting (nombres, booleens, dates, champs complexes) avec les usages produit.

## Scope
- Page/composant:
  - `src/app/components/market-analysis/market-analysis.page.ts`
  - `src/app/components/market-analysis/market-analysis.page.html`
- Helpers:
  - formatter dedie seasonality
  - gestion du champ `metrics` (affichage compact + details)

## UX cible
- `metrics` n'est plus un bloc JSON brut difficile a lire.
- Valeurs numeriques arrondies intelligemment, booleens explicites, dates lisibles.
- Conservation d'un acces au detail brut quand necessaire (tooltip, details, popover, ou sous-section).

## Definition of Done
- [ ] `Seasonality profiles` utilise un formatter dedie (pas uniquement `formatDisplayValue`).
- [ ] Le champ `metrics` est rendu en mode lisible (compact et exploitable).
- [ ] Les valeurs null/undefined restent traitees proprement (`-`).
- [ ] Tests composants couvrent les principaux cas de formatting et `metrics`.

## Implementation plan
1. Ajouter `formatSeasonalityDisplayValue(value, key)`.
2. Introduire une strategie de rendu pour `metrics` (resume + detail).
3. Brancher le template seasonality sur le formatter dedie.
4. Ajouter/adapter les specs.

## Validation
- `ng test --watch=false`
- `ng build`

## Out of scope
- Changement des contrats API backend.
- Refactor global de tous les tableaux de l'application.
