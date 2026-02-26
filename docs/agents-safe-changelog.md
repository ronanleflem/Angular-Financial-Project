# Agents-Safe Catalog Alignment

Ce document recense ce qui a été **masqué / désactivé / filtré** côté UI parce que **non présent** dans `public/parameter_catalog.json` (miroir docs: `docs/parameter_catalog.json`).
Objectif : garder une trace des idées “hors‑catalog” pour une implémentation future.

## 1) Filtres (Backtest + DCA)
**Source UI actuelle :** `src/app/pages/strategy-launcher/strategy-launcher.page.ts`  
**Vérification :** `filters_expanded.items` dans `public/parameter_catalog.json`

### Filtres UI non présents dans le catalog
- `volatility_guard`
- `trend_regime`
- `liquidity_spread`

**Effet côté UI :**
- Options désactivées dans `filters[]`.
- En sortie payload, ces filtres sont supprimés si sélectionnés.

## 2) Market Stats — Events / Conditions / Targets
**Source UI actuelle :** `marketEventOptions`, `marketConditionOptions`, `marketTargetOptions`  
**Vérification :** enums `stats.events`, `stats.conditions`, `stats.targets`

### Events UI non présents dans le catalog
- `vol_spike`
- `gap_open`
- `breakout`

### Conditions UI non présentes dans le catalog
- `trend_regime`
- `liquidity_gate`
- `volatility_band`

### Targets UI non présents dans le catalog
- `mean_reversion`
- `momentum_follow`
- `range_extension`

**Effet côté UI :**
- Les listes `eventId / conditionId / targetId` sont remplacées par les enums du catalog.
- Si aucun match, on affiche les ids du catalog sans params (fallback).

## 3) Enums durcis (signal / strategy / stress)
**Source UI actuelle :** listes `signalTypes`, `dcaStrategyTypes`, `stressSourceOptions`, `stressMethodOptions`, `stressScenarioTypes`  
**Vérification :** enums du catalog

### Signal types (Backtest)
- UI avait : `ema_cross`, `ema_rsi`, `breakout_channel`
- Catalog : `ema_cross`
- **Supprimés / masqués :** `ema_rsi`, `breakout_channel`

### Strategy types (DCA)
- UI avait : `dca_equity`, `dca_etf`, `crypto_grid`  
- Catalog : mêmes -> **pas de suppression**

### Stress Tests (Monte Carlo)
- `source` limité à `monte_carlo.source`
- `method` limité à `monte_carlo.method`
- `scenario.type` limité à `scenario.types`
- **Tous les autres types potentiels hors catalog sont masqués**

## 4) Tooltips
**Source UI actuelle :** `parameter_catalog.json`

Les tooltips montrent :
- Pour les enums : la liste des valeurs supportées par le catalog.
- Pour les filtres : `summary` + `params` si l’entrée existe.
Si l’id n’existe pas, le tooltip affiche `Non supporte par le catalog`.

---
Si tu veux ré‑introduire des éléments hors‑catalog, on peut soit :
- étendre `public/parameter_catalog.json` puis synchroniser le miroir docs, soit
- créer un mode “custom / experimental” qui ne bloque pas.
