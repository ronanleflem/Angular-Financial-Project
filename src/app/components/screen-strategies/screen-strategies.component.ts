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
    runId?: string,
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
    averageTP?: number,
    averageSL?: number,
    comparedSymbol?: string
    totalNetReturn?: number,
    netWinCount?: number,
    netLossCount?: number,
    averageNetTrade?: number
  }[] = [];
  isLoading: boolean = false;

  constructor(private router: Router, private tradingService: TradingDataService
    // private strategyService: StrategyService (à injecter pour le backend)
  ) { }

  goToDetails(strategy: any) {
    console.log('GO vers', strategy);
    this.router.navigate(
      ['/strategy-detail', strategy.name, strategy.runId, strategy.symbol, strategy.comparedSymbol],
      { state: { strategy } }
    );
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
        console.log(formattedBackends);
        const mapped = formattedBackends.map(s => {
          console.log(s.startStrategy);
          console.log(new Date(s.startStrategy));
          console.log((s.StartStrategie ? new Date(s.StartStrategie) : undefined));

          const start = s.startStrategy
            ? new Date(s.startStrategy)
            : (s.StartStrategie ? new Date(s.StartStrategie) : undefined);
          const end = s.endStrategy
            ? new Date(s.endStrategy)
            : (s.EndStrategie ? new Date(s.EndStrategie) : undefined);
          return {
            runId: s.runId,
            name: s.name,
            winRate: (s.winCount * s.lossCount / 100) * 100,
            winningTrades: s.winCount,
            losingTrades: s.lossCount,
            totalReturn: s.totalReturn,
            maxDrawdown: s.maxDrawdown,
            averageTrade: s.averageTrade,
            averageSL: s.averageSL,
            averageTP: s.averageTP,
            tradeCount: s.lossCount + s.winCount,
            symbol: s.symbol,
            comparedSymbol: s.comparedSymbol,
            startDate: start,
            endDate: end,
            averageRR: s.rrMoyen,
            totalNetReturn: s.totalNetReturn,
            netWinCount:  s.netWinCount,
            netLossCount:  s.netLossCount,
            averageNetTrade:  s.averageNetTrade
          };
        });

        this.strategies = [...mockData, ...mapped];
        this.isLoading = false;
        console.log(this.strategies);
      },
      error: (err) => {
        console.error('Erreur stratégie', err);
        this.strategies = [...mockData];
        this.isLoading = false;
      }
    });
  }
}

