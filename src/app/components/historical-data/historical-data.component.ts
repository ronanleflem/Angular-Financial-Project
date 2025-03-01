import { Component, OnInit } from '@angular/core';
import { TradingDataService } from '../../services/trading-data.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-historical-data',
  imports: [CommonModule],
  templateUrl: './historical-data.component.html',
  styleUrl: './historical-data.component.css'
})
export class HistoricalDataComponent implements OnInit {
  candles: any[] = [];

  constructor(private tradingService: TradingDataService) {}

  ngOnInit() {
    this.tradingService.getHistoricalCandles('EURUSD', '15min').subscribe(data => {
      console.log('Données reçues :', data);
      this.candles = data;
    });
  }
}


