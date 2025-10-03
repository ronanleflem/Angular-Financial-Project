# Feature Catalog

## Pages & vues principales
| Route | Description | Composants clés | Données affichées |
| --- | --- | --- | --- |
| `/historical-data` | Tableau de bord pour charger et visualiser des chandeliers historiques avec annotations de trades. | `HistoricalDataComponent` | Bougies OHLC filtrées par symbole/timeframe, zones d'entrée/sortie mockées, options zoom/pan. |
| `/live-data` | Suivi en direct des bougies avec démarrage/arrêt du flux. | `LiveDataComponent` | Bougies live rafraîchies via polling, statut du stream. |
| `/statistics` | Console d'analyses statistiques multi-timeframes. | `StatisticDataComponent` | Résultats JSON transformés en tableau + bar chart pour statistiques bullish/bearish, entropie, cycles, etc. |
| `/strategy-calculation` | Formulaire pour lancer le calcul d'une stratégie paramétrée. | `StrategyCalculationComponent` | Résultat JSON d'exécution de stratégie, listes déroulantes de symboles/timeframes. |
| `/screen-strategies` | Listing de stratégies calculées avec métriques et navigation détail. | `ScreenStrategiesComponent` | Table (mock + API) avec runId, winrate, drawdown, moyennes RR/TP/SL, comparaisons de symboles. |
| `/strategy-detail/:name/:runId/:symbol/:comparedSymbol` | Vue détaillée d'une stratégie avec navigation trade par trade. | `StrategyDetailComponent`, `TradeCandlestickChartComponent` | Résumé stratégie, table de métriques, graphique candlestick du trade sélectionné + symbole comparé, liste des trades. |
| `/_lab/signals` | Laboratoire démontrant Angular Signals (counter, todo). | `SignalsHomePage`, `CounterCard`, `TodoCard` | Compteur persistant, liste de todos filtrable (données locales). |

## Graphiques & visualisations
| Composant | Librairie | Source de données | Options avancées |
| --- | --- | --- | --- |
| HistoricalDataComponent | Chart.js 4 (`chartjs-chart-financial`, `chartjs-plugin-zoom`, `chartjs-plugin-annotation`) via `ng2-charts` | `TradingDataService.getHistoricalCandlesTimeframeCME` (bougies OHLC) | Zoom et pan sur l'axe X, annotations de trades via boxes colorées, formatage temporel `date-fns`. |
| LiveDataComponent | Chart.js 4 financial + zoom | `TradingDataService.getLiveCandle` (polling) | Mise à jour incrémentale du dataset, zoom/pan horizontal. |
| StatisticDataComponent | Chart.js bar | Endpoints `filter/*` (statistiques) | Multiple datasets par timeframe, rafraîchissement à chaque chargement. |
| TradeCandlestickChartComponent | Chart.js 4 financial + zoom + annotation | `TradingDataService.getCandlesForTrade` (bougies principales & comparées) | Annotations box pour la période de trade, double graphique (trade vs symbole comparé), parsing désactivé pour performance. |

## UX & Performance
- Standalone components et `bootstrapApplication` pour réduire la configuration `NgModule`.
- `provideZoneChangeDetection({ eventCoalescing: true })` dans `app.config.ts` pour limiter la fréquence des changements de zone.
- Lazy-loading du laboratoire `_lab/signals` via `loadChildren`.
- Plugins Chart.js activent zoom/pan pour l'exploration utilisateur.
- Persistance locale du compteur Signals via `effect` + `localStorage` (UX démo).
- Aucune stratégie de change detection personnalisée détectée (comportement par défaut).
- Pas de virtual scroll identifié.
