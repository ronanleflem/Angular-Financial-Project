import { Component, OnInit } from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DatePipe, DecimalPipe, NgForOf, NgIf, PercentPipe} from '@angular/common';
import {Router} from '@angular/router';
import {TradingDataService} from '../../services/trading-data.service';
import {Chart} from 'chart.js';

@Component({
  selector: 'app-screen-strategies',
  templateUrl: './screen-strategies.component.html',
  imports: [
    FormsModule,
    NgForOf,
    NgIf,
    DatePipe,
    DecimalPipe,
    PercentPipe
  ],
  styleUrls: ['./screen-strategies.component.css']
})
export class ScreenStrategiesComponent implements OnInit {

  symbols: string[] = []; // À remplir via une API si besoin
  selectedSymbol: string = '';
  strategies: {
    name: string,
    symbol?: string,
    startDate?: Date,
    endDate?: Date,
    winningTrades?: number,
    losingTrades?: number,
    winRate?: number,
    lossRate?: number,
    totalReturn?: number,
    maxDrawdown?: number,
    averageRR?: number,
    averageTrade?: number,
    tradeCount?: number
  }[] = [];
  isLoading: boolean = false;

  constructor(private router: Router, private tradingService: TradingDataService
    // private strategyService: StrategyService (à injecter pour le backend)
  ) { }

  goToDetails(strategy: any) {
    console.log('GO vers', strategy);
    this.router.navigate(['/strategy-detail', strategy.name]);
  }

  ngOnInit(): void {
    this.loadSymbols();
  }

  loadSymbols() {
    // Ex: this.symbolService.getSymbols().subscribe()
    this.symbols = ['EUR/USD', 'NAS100', 'BTC/USD']; // temporaire
  }

  loadStrategies() {
    if (!this.selectedSymbol) return;

    this.isLoading = true;

    const mockData = [
      {
        name: 'Breakout 1',
        symbol: this.selectedSymbol,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-01'),
        winningTrades: 15,
        losingTrades: 5,
        winRate: 75,
        averageRR: 2.5,
        tradeCount: 20
      },
      {
        name: 'Reversal Zone',
        symbol: this.selectedSymbol,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-03-15'),
        winningTrades: 10,
        losingTrades: 10,
        winRate: 50,
        averageRR: 1.8,
        tradeCount: 20
      }
    ];

    this.tradingService.getAllCalculatedStrategies().subscribe({
      next: (backendData: any[]) => {
        const formattedBackends = Array.isArray(backendData) ? backendData : [backendData];

        const mapped = formattedBackends.map(s => ({
          name: s.name,
          winRate: s.winRate,
          lossRate: s.lossRate,
          totalReturn: s.totalReturn,
          maxDrawdown: s.maxDrawdown,
          averageTrade: s.averageTrade
        }));

        this.strategies = [...mockData, ...mapped];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erreur stratégie', err);
        this.strategies = [...mockData];
        this.isLoading = false;
      }
    });
  }
}

