import { Routes } from '@angular/router';
import { HistoricalDataComponent } from './components/historical-data/historical-data.component';
import { StatisticDataComponent } from './components/statistic-data/statistic-data.component';
import { StrategyCalculationComponent } from './components/strategy-calculation/strategy-calculation.component';
import {ScreenStrategiesComponent} from './components/screen-strategies/screen-strategies.component';
import {StrategyDetailComponent} from './components/strategy-detail/strategy-detail.component'; // 🆕

export const routes: Routes = [
  { path: 'historical-data', component: HistoricalDataComponent },
  { path: 'statistics', component: StatisticDataComponent },
  { path: 'strategy-calculation', component: StrategyCalculationComponent },
  { path: 'screen-strategies', component: ScreenStrategiesComponent },
  { path: 'strategy-detail/:name', component: StrategyDetailComponent }
  //{ path: '', redirectTo: '/historical-data', pathMatch: 'full' } // Redirection par défaut
];
