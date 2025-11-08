import { Routes } from '@angular/router';
import { HistoricalDataComponent } from './components/historical-data/historical-data.component';
import { StatisticDataComponent } from './components/statistic-data/statistic-data.component';
import { StrategyCalculationComponent } from './components/strategy-calculation/strategy-calculation.component';
import {ScreenStrategiesComponent} from './components/screen-strategies/screen-strategies.component';
import {StrategyDetailComponent} from './components/strategy-detail/strategy-detail.component';
import {LiveDataComponent} from './components/live-data/live-data.component'; // 🆕
import {ActiveRobotsComponent} from './components/active-robots/active-robots.component';
import { MarketAnalysisPage } from './components/market-analysis/market-analysis.page';

export const routes: Routes = [
  { path: 'historical-data', component: HistoricalDataComponent },
  { path: 'statistics', component: StatisticDataComponent },
  { path: 'strategy-calculation', component: StrategyCalculationComponent },
  { path: 'screen-strategies', component: ScreenStrategiesComponent },
  { path: 'strategy-detail/:name/:runId/:symbol/:comparedSymbol', component: StrategyDetailComponent },
  { path: 'live-data', component: LiveDataComponent },
  { path: 'active-robots', component: ActiveRobotsComponent },
  { path: 'market-analysis', component: MarketAnalysisPage },
  {
    path: 'data-availability',
    loadComponent: () => import('./pages/data-availability/data-availability.page').then(m => m.DataAvailabilityPageComponent)
  },
  {
    path: '_lab/signals',
    loadChildren: () => import('./labs/signals/signals.routes').then(m => m.SIGNALS_ROUTES)
  }
  //{ path: '', redirectTo: '/historical-data', pathMatch: 'full' } // Redirection par défaut
];
