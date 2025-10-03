# Architecture Map

## Modules
| Nom | Chemin | Rôle | Dépendances majeures |
| --- | --- | --- | --- |
| _(aucun module NgModule)_ | — | L'application s'appuie sur des composants standalone et `bootstrapApplication`. | — |

## Composants & Vues
| Nom | Chemin | Rôle bref | Dépendances majeures |
| --- | --- | --- | --- |
| AppComponent | src/app/app.component.ts | Shell racine affichant le router outlet et les liens principaux. | `@angular/router` (RouterOutlet, RouterLink) |
| HistoricalDataComponent | src/app/components/historical-data/historical-data.component.ts | Affiche des bougies historiques avec annotations et filtres de période. | TradingDataService, Chart.js (`chartjs-chart-financial`, zoom, annotation), ng2-charts, FormsModule |
| LiveDataComponent | src/app/components/live-data/live-data.component.ts | Stream de bougies en direct avec démarrage/arrêt et zoom. | TradingDataService, Chart.js financial + zoom, FormsModule |
| ScreenStrategiesComponent | src/app/components/screen-strategies/screen-strategies.component.ts | Liste des stratégies calculées avec métriques et navigation vers le détail. | TradingDataService, Angular router, Angular pipes (Date, Decimal, Percent) |
| StatisticDataComponent | src/app/components/statistic-data/statistic-data.component.ts | Charge des analyses statistiques (bullish/bearish, entropie…) et les visualise en bar chart. | HttpClient, Chart.js (via NgChartsModule), FormsModule |
| StrategyCalculationComponent | src/app/components/strategy-calculation/strategy-calculation.component.ts | Formulaire pour lancer des calculs de stratégie et afficher le JSON de résultat. | TradingDataService, HttpClient, FormsModule |
| StrategyDetailComponent | src/app/components/strategy-detail/strategy-detail.component.ts | Résumé d'une stratégie, navigation dans les trades, affichage graphique par trade. | TradingDataService, Router, TradeCandlestickChartComponent |
| TradeCandlestickChartComponent | src/app/components/trade-candlestick-chart/trade-candlestick-chart.component.ts | Graphiques candlestick principal/comparé pour un trade donné avec annotations. | TradingDataService, Chart.js financial, zoom, annotation |
| SignalsHomePage | src/app/labs/signals/ui/signals-home.page.ts | Page laboratoire démontrant les signaux Angular (counter & todo). | CounterCard, TodoCard |
| CounterCard | src/app/labs/signals/ui/widgets/counter.card.ts | Carte compteur utilisant les signaux pour un état persistant. | SignalsStore |
| TodoCard | src/app/labs/signals/ui/widgets/todo.card.ts | Carte todo avec filtres basée sur les signaux Angular. | SignalsStore, FormsModule |

## Services / Stores / Utilitaires
| Nom | Chemin | Rôle bref | Dépendances |
| --- | --- | --- | --- |
| TradingDataService | src/app/services/trading-data.service.ts | Accès HTTP aux données de trading (bougies, stratégies, statistiques, live). | HttpClient, `environment.apiUrl` |
| SignalsStore | src/app/labs/signals/state/signals.store.ts | Store Angular Signals pour la démo counter/todos avec persistance locale. | Angular signals API (`signal`, `computed`, `effect`), localStorage |

## Guards & Interceptors
Aucun guard (`*.guard.ts`) ni interceptor (`*.interceptor.ts`) détecté dans le projet.

## Routing
| Chemin | Composant/Module | Lazy ? | Guards |
| --- | --- | --- | --- |
| `historical-data` | HistoricalDataComponent | Non | — |
| `statistics` | StatisticDataComponent | Non | — |
| `strategy-calculation` | StrategyCalculationComponent | Non | — |
| `screen-strategies` | ScreenStrategiesComponent | Non | — |
| `strategy-detail/:name/:runId/:symbol/:comparedSymbol` | StrategyDetailComponent | Non | — |
| `live-data` | LiveDataComponent | Non | — |
| `_lab/signals` | `SIGNALS_ROUTES` (SignalsHomePage) | Oui (`loadChildren`) | — |

## State Management
| Store | Type | Sélecteurs / Computed | Effets |
| --- | --- | --- | --- |
| SignalsStore | Angular Signals store (`providedIn: 'root'`) | `count`, `countLabel`, `todos`, `filter`, `activeCount`, `completedCount`, `filteredTodos` | Persistance `effect` vers `localStorage`, effets internes de mise à jour |

## Modèles & DTO
Aucun fichier `*.model.ts` ou définition de DTO détecté — informations `unknown` à ce stade.
