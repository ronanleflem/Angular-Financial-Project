import { Component } from '@angular/core';
import { TradingDataService } from '../../services/trading-data.service';
import { FormsModule } from '@angular/forms';
import { NgForOf, NgIf } from '@angular/common';

@Component({
  selector: 'app-statistic-data',
  templateUrl: './statistic-data.component.html',
  imports: [
    FormsModule,
    NgForOf,
    NgIf
  ],
  styleUrls: ['./statistic-data.component.css']
})
export class StatisticDataComponent {
  symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'NASDAQ', 'SP500'];
  timeframes = ['1min', '5min', '15min', '1h', '4h', '1d'];

  selectedSymbol = 'EURUSD';
  selectedTimeframes: string[] = [];

  // Mode : live ou historique
  isLiveMode = true;

  // Plage de dates pour l'historique
  startDate: string = '';
  endDate: string = '';

  statistics: any = null;
  statisticsKeys: string[] = [];
  isLoading = false;

  constructor(private tradingService: TradingDataService) {}

  loadStatistics() {
    if (!this.selectedTimeframes.length) {
      alert('Sélectionne au moins un timeframe !');
      return;
    }

    if (!this.isLiveMode && (!this.startDate || !this.endDate)) {
      alert('Sélectionne une plage de dates valide !');
      return;
    }

    this.isLoading = true;
    this.statistics = null;

    if (this.isLiveMode) {
      // Appel Live Stats
      this.tradingService.getStatistics(this.selectedSymbol, this.selectedTimeframes)
        .subscribe(
          data => {
            this.statistics = data;
            this.statisticsKeys = Object.keys(data);
            this.isLoading = false;
          },
          error => {
            console.error('Erreur lors de la récupération des stats live', error);
            this.isLoading = false;
          }
        );
    } else {
      // Appel Stats Historiques
      this.tradingService.getHistoricalStatistics(this.selectedSymbol, this.selectedTimeframes, this.startDate, this.endDate)
        .subscribe(
          data => {
            this.statistics = data;
            this.statisticsKeys = Object.keys(data);
            this.isLoading = false;
          },
          error => {
            console.error('Erreur lors de la récupération des stats historiques', error);
            this.isLoading = false;
          }
        );
    }
  }
}
