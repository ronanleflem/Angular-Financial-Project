import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'historical-data',
    loadComponent: () => import('./components/historical-data/historical-data.component').then(m => m.HistoricalDataComponent),
  },
  {
    path: 'statistics',
    loadComponent: () => import('./components/statistic-data/statistic-data.component').then(m => m.StatisticDataComponent),
  },
  {
    path: 'strategy-calculation',
    loadComponent: () => import('./components/strategy-calculation/strategy-calculation.component').then(m => m.StrategyCalculationComponent),
  },
  {
    path: 'strategy-launcher',
    loadComponent: () => import('./pages/strategy-launcher/strategy-launcher.page').then(m => m.StrategyLauncherPageComponent),
  },
  {
    path: 'runs/:requestId',
    loadComponent: () => import('./pages/run-status/run-status.page').then(m => m.RunStatusPageComponent),
  },
  {
    path: 'screen-strategies',
    loadComponent: () => import('./components/screen-strategies/screen-strategies.component').then(m => m.ScreenStrategiesComponent),
  },
  {
    path: 'strategy-detail/:name/:runId/:symbol/:comparedSymbol',
    loadComponent: () => import('./components/strategy-detail/strategy-detail.component').then(m => m.StrategyDetailComponent),
  },
  {
    path: 'live-data',
    loadComponent: () => import('./components/live-data/live-data.component').then(m => m.LiveDataComponent),
  },
  {
    path: 'active-robots',
    loadComponent: () => import('./components/active-robots/active-robots.component').then(m => m.ActiveRobotsComponent),
  },
  {
    path: 'market-analysis',
    loadComponent: () => import('./components/market-analysis/market-analysis.page').then(m => m.MarketAnalysisPage),
  },
  {
    path: 'data-availability',
    loadComponent: () => import('./pages/data-availability/data-availability.page').then(m => m.DataAvailabilityPageComponent),
  },
  {
    path: 'stress-tests',
    loadComponent: () => import('./pages/stress-tests/stress-tests.page').then(m => m.StressTestsPageComponent),
  },
  {
    path: 'stress-tests/:runId',
    loadComponent: () => import('./pages/stress-tests/stress-tests.page').then(m => m.StressTestsPageComponent),
  },
  {
    path: '_lab/signals',
    loadChildren: () => import('./labs/signals/signals.routes').then(m => m.SIGNALS_ROUTES),
  },
  //{ path: '', redirectTo: '/historical-data', pathMatch: 'full' } // Redirection par defaut
];
