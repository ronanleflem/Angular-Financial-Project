import { Component } from '@angular/core';
import { TradingDataService } from '../../services/trading-data.service';
import {FormsModule} from '@angular/forms';
import {NgForOf, NgIf} from '@angular/common';

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
  statistics: any = null;
  isLoading = false;
  statisticsKeys: string[] = [];

  constructor(private tradingService: TradingDataService) {}

  loadStatistics() {
    if (!this.selectedTimeframes.length) {
      alert('Sélectionne au moins un timeframe !');
      return;
    }

    this.isLoading = true;
    this.tradingService.getStatistics(this.selectedSymbol, this.selectedTimeframes).subscribe(
      data => {
        this.statistics = data;
        this.statisticsKeys = Object.keys(data); // Liste des clés triées
        this.isLoading = false;
      },
      error => {
        console.error('Erreur lors de la récupération des stats', error);
        this.isLoading = false;
      }
    );
  }

}
