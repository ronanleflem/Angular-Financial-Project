import { Routes } from '@angular/router';
import { HistoricalDataComponent } from './components/historical-data/historical-data.component';

export const routes: Routes = [
  { path: 'historical-data', component: HistoricalDataComponent }
  //{ path: '', redirectTo: '/historical-data', pathMatch: 'full' } // Redirection par défaut
];
