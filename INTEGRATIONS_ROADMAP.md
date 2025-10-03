# Integrations & Roadmap

## Intégrations actuelles (HTTP)
| Méthode | Endpoint (relatif à `environment.apiUrl`) | Payload / Query | Usage |
| --- | --- | --- | --- |
| GET | `/api/finance/charts/from-trade` | `tradeId`, `timeframe`, `symbol`, `comparedSymbol`, `beforeCandles`, `afterCandles` | Charger les bougies d'un trade et d'un symbole comparé. |
| GET | `/get-trades-strategy` | `strategyName`, `runId` | Récupérer les trades d'une stratégie. |
| GET | `/api/finance/charts/candles` | `symbol`, `timeframe` | Bougies historiques simples. |
| GET | `/rollover-volume/unified-candles` | `symbol`, `timeframe`, `startDate`, `endDate` | Bougies CME selon plage donnée. |
| GET | `/api/finance/charts/candles/date-time` | `symbol`, `timeframe`, `startDate`, `endDate` | Bougies filtrées par dates pour chargement historique. |
| GET | `/all-strategies` | — | Listing complet des stratégies calculées. |
| GET | `/all-name-strategies` | — | Liste des noms de stratégies disponibles. |
| GET | `/api/live-candle` | `symbol`, `timeframe` | Bougie live la plus récente. |
| GET | `/run-strategy-by-name` | `strategyName`, `symbol`, `timeframe`, `period`, `comparedSymbol?`, `startDate`, `endDate` | Lancer un calcul de stratégie. |
| GET | `/backtest` | `strategy` | Résultats de backtest (non exposé dans l'UI actuelle). |
| GET | `/filter/bullish-bearish-stats/multi-timeframes` | `symbol`, `timeframes` | Statistiques multi-timeframes pour l'analyse bullish/bearish. |
| GET | `/filter/...` variantes | Selon `selectedAnalysis` : `benford/anomaly`, `institutional-biais`, `contradictory-signals`, `cycles`, `entropy`, `fractal-analysis`, `market-manipulation`, `donchian-channels`, `liquidity`, `lower-timeframe-confluence` avec paramètres `timeframe`, `maxCandle`/`numberLastestCandles`/`period`. | Charger les différents rapports statistiques. |
| GET | `/api/statistics/historical` *(appel relatif, hôte non défini)* | `symbol`, `timeframes`, `startDate`, `endDate` | Historique de statistiques (non finalisé). |

## Sécurité & Authentification
- Aucun `AuthGuard`, interceptor JWT/CSRF ou mécanisme de rafraîchissement détecté.
- Les appels HttpClient utilisent directement l'URL définie dans `environment.apiUrl` (`http://localhost:8090`).
- Aucune persistance de token ni stockage sécurisé actuellement (auth `unknown`).

## Roadmap d'intégration (suggestions)
1. Ajouter une authentification (JWT ou OAuth2) avec interceptor pour enrichir les requêtes.
2. Supporter WebSocket/SSE pour le flux `/api/live-candle` afin de réduire le polling.
3. Implémenter des endpoints POST pour lancer des backtests paramétrés et suivre leur progression.
4. Introduire une API d'agrégation des statistiques (heatmaps, saisonnalité) pour enrichir `/statistics`.
5. Mettre en place des endpoints de pagination/filtrage pour `/all-strategies` et `/get-trades-strategy` (serveur).
6. Ajouter des services pour récupérer des métadonnées de symboles (ex: description, fuseau horaire).
7. Centraliser la configuration des plugins Chart.js via un endpoint `/ui-config` pour faciliter les mises à jour.
8. Intégrer un service d'alerting (webhooks ou email) déclenché par des signaux du backend.
9. Documenter les schémas de données (DTO) côté backend et générer des types TypeScript partagés.
10. Sécuriser les appels sensibles via rate limiting côté API et gestion d'erreurs côté client.
