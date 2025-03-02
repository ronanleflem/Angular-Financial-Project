import { Routes } from '@angular/router';
import { HistoricalDataComponent } from './components/historical-data/historical-data.component';
import { StatisticDataComponent } from './components/statistic-data/statistic-data.component';

export const routes: Routes = [
  { path: 'historical-data', component: HistoricalDataComponent },
  { path: 'statistics', component: StatisticDataComponent }
  //{ path: '', redirectTo: '/historical-data', pathMatch: 'full' } // Redirection par défaut
];
