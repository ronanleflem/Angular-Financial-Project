# INIT-005 - Angular market analysis: deduplicate run-result sections and tab consistency

## Goal
- Supprimer la redondance d'affichage entre la carte `Resultat run` et les onglets dedies (`Saisonnalite (run)`, `Patterns & Probabilites (run)`).
- Clarifier la navigation et eviter la confusion utilisateur (meme dataset affiche deux fois avec presentations differentes).

## Scope
- Page/composant:
  - `src/app/components/market-analysis/market-analysis.page.html`
  - `src/app/components/market-analysis/market-analysis.page.ts`
- Logique d'affichage conditionnel des sections run-result.

## Problem statement
- La section `Resultat run` affiche deja `Market stats rows` et `Seasonality profiles`.
- Les memes donnees reapparaissent dans les onglets run, ce qui cree une perception de doublon et de divergence de rendu.

## Definition of Done
- [ ] Une seule source de verite visuelle par type de donnees run (pas de duplication concurrente).
- [ ] Les onglets restent le point d'entree principal pour les tableaux run.
- [ ] Les sections meta utiles (`Source`, `Spec ID`, `Dataset ID`, etc.) restent visibles.
- [ ] Les etats vides/indisponibles par specType restent explicites.
- [ ] Tests composants mis a jour (presence/absence des sections selon specType et data).

## Implementation plan
1. Cartographier les sections run qui se recouvrent.
2. Definir la regle de priorite d'affichage (meta globale + tables dans onglets).
3. Simplifier le template et les `*ngIf` pour supprimer les doublons.
4. Ajuster les specs de rendu.

## Validation
- `ng test --watch=false`
- `ng build`

## Out of scope
- Refonte complete de la page market-analysis.
- Changement de wording fonctionnel non lie aux doublons.
