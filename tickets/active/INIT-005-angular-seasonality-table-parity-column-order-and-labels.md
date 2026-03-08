# INIT-005 - Angular seasonality table parity: ordered columns and readable labels

## Goal
- Aligner la lisibilite du tableau `Seasonality profiles` avec `Market stats rows`.
- Stabiliser l'ordre des colonnes et appliquer des labels lisibles et coherents.

## Scope
- Page/composant:
  - `src/app/components/market-analysis/market-analysis.page.ts`
  - `src/app/components/market-analysis/market-analysis.page.html`
- Fonctions utilitaires locales au composant:
  - ordonnancement des colonnes seasonality
  - mapping des labels de colonnes

## Context
- `market_stats` dispose deja d'un ordre de colonnes prefere (`PREFERRED_MARKET_STATS_COLUMNS`) et d'un rendu dedie.
- `seasonality` utilise actuellement `collectRowKeys(...)` (ordre non metier, peu stable).

## Definition of Done
- [ ] Un ordre de colonnes seasonality explicite est introduit (priorite metier puis fallback alphabetique).
- [ ] Les entetes seasonality sont humanises/coherents (ex: `spec_id` -> `Spec Id`).
- [ ] Le rendu existant des onglets `Saisonnalite (run)` / `Patterns & Probabilites (run)` n'est pas degrade.
- [ ] Tests composants mis a jour pour valider l'ordre et les labels seasonality.

## Implementation plan
1. Introduire une constante `PREFERRED_SEASONALITY_COLUMNS`.
2. Ajouter un helper d'ordre seasonality similaire au pattern market stats.
3. Ajouter un helper de label seasonality reutilisable dans le template.
4. Mettre a jour les specs du composant.

## Validation
- `ng test --watch=false`
- `ng build`

## Out of scope
- Formatting avance des valeurs (JSON metrics, numeriques, dates).
- Refonte visuelle CSS globale.
