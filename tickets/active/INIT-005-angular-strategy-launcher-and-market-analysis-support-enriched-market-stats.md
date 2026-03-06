# INIT-005-ANGULAR-X - Strategy launcher and market-analysis support for enriched market_stats

## Title
- Permettre au front Angular de profiter de l'enrichissement `market_stats` sans ambiguite utilisateur

## Ticket type
- Type B: Implementation

## BMAD Stage
- Architect -> Dev

## Goal
- Exposer correctement l'enrichissement `market_stats` dans `strategy-launcher`.
- Afficher les metriques enrichies `market_stats` dans `market-analysis`.

## Context / Entry points
- `src/app/pages/strategy-launcher/strategy-launcher.page.ts`
- `src/app/pages/strategy-launcher/strategy-launcher.page.html`
- `src/app/utils/preset-form-fallback.ts`
- `src/app/utils/backend-validation.ts`
- `src/app/components/market-analysis/market-analysis.page.ts`
- `src/app/components/market-analysis/market-analysis.page.html`

## Problem statement
- `strategy-launcher` est aujourd'hui structurellement mono:
  - `eventId`
  - `conditionId`
  - `targetId`
- Cela ne permet pas a l'utilisateur de profiter d'un enrichment de type `stats_pack` ou multi-events.
- `market-analysis` sait afficher `market_stats_rows[]` mais sur un schema encore minimal.

## Scope
### Phase 1 recommandee
- Support `stats_pack` et affichage des metriques enrichies.
- Pas de full refonte multi-events dans ce ticket.

### Phase 2 future
- UX full multi-events/multi-targets si Python expose vraiment `stats.events[]`.

## Proposed changes
1. strategy-launcher
- Integrer le support du nouveau contrat `market_stats` retenu:
  - si `stats_pack`: champ/selector explicite + aide utilisateur sur ce que le pack calcule
  - capabilities-driven gating pour masquer ce qui n'est pas supporte
- Ajuster:
  - build payload
  - preset fallback/import
  - mapping des erreurs backend
- Si `stats_pack` coexiste avec `event/condition/target`, definir les regles UX de priorite/exclusivite.

2. market-analysis
- Enrichir le tableau `market_stats_rows[]` pour afficher les nouvelles colonnes utiles:
  - `lift_freq`, `lift_bayes`
  - `p_value`, `q_value`, `significant`
  - `p_mean`, `p_map`, `hdi_*`
  - `insufficient` le cas echeant
- Garder un rendu tolerant si certaines colonnes sont absentes.

3. Tests
- Tests payload launcher
- Tests mapping erreurs backend
- Tests rendering market-analysis avec schema enrichi
- Tests fallback quand capabilities indisponibles

## Acceptance criteria
- L'utilisateur peut declencher un `market_stats` enrichi depuis `strategy-launcher` selon le contrat backend reel.
- Le front n'expose pas d'options non supportees quand capabilities sont disponibles.
- `market-analysis` affiche les nouvelles colonnes `market_stats` sans regression sur les anciennes lignes.
- Les presets et la relecture formulaire ne cassent pas.
- Les tests passent.

## Non-goals
- Refondre tout le launcher.
- Full builder visuel multi-events dans ce ticket si Python ne livre que `stats_pack`.
- Changement des APIs backend.

## Validation
- `ng test`
- `ng build`
