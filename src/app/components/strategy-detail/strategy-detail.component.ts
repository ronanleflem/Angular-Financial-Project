import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {DatePipe, NgIf} from '@angular/common';
import { CommonModule } from '@angular/common';
import { TradingDataService } from '../../services/trading-data.service';
import {TradeCandlestickChartComponent} from '../trade-candlestick-chart/trade-candlestick-chart.component';

@Component({
  selector: 'app-strategy-detail',
  templateUrl: './strategy-detail.component.html',
  imports: [
    DatePipe,
    NgIf,
    CommonModule,
    TradeCandlestickChartComponent
  ],
  standalone: true,
  styleUrls: ['./strategy-detail.component.css']
})
export class StrategyDetailComponent implements OnInit {

  strategy: any;
  trades: any[] = [];
  currentTradeIndex: number = 0;
  comparedSymbol: string = '';
  symbol: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tradingDataService: TradingDataService
  ) {}

  ngOnInit(): void {
    this.loadStrategy();
  }



  loadStrategy() {
    const strategyName = this.route.snapshot.paramMap.get('name');
    this.symbol = this.route.snapshot.paramMap.get('symbol') || '';
    this.comparedSymbol = this.route.snapshot.paramMap.get('comparedSymbol') || '';

    const stateStrategy = this.router.getCurrentNavigation()?.extras.state?.['strategy'];

    // Les infos de stratégie peuvent provenir de l'écran de liste
    this.strategy = stateStrategy || {
      name: strategyName,
      symbol: this.symbol,
      comparedSymbol: this.comparedSymbol,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-01'),
      winRate: 75,
      averageRR: 0,
      tradeCount: 0
    };
    this.tradingDataService.getTradesByStrategyName(strategyName!).subscribe({
      next: (trades: any[] | null | undefined) => {
        console.log("Avant le map",trades);
        const formattedTrades = Array.isArray(trades) ? trades.map(t => ({
          id: t.id,
          type: t.tradeType, // ou t.type si c’est ta convention
          entryDate: new Date(t.entryTimestamp),
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          result: `${(t.exitPrice - t.entryPrice >= 0 ? '+' : '')}${((t.exitPrice - t.entryPrice) * 10000).toFixed(0)} pips`,
          rr: t.takeProfit && t.stopLoss
            ? (Math.abs(t.takeProfit - t.entryPrice) / Math.abs(t.entryPrice - t.stopLoss)).toFixed(2)
            : null,
          duration: this.getDurationInMinutes(t.entryTimestamp, t.exitTimestamp),
          comment: `Trade auto chargé de ${t.strategyName}`
        })) : [];

        this.trades = formattedTrades ? formattedTrades : this.getMockTrades();

        console.log(this.trades);
      },
      error: (error: unknown) => {
        console.error('Erreur lors du chargement des trades :', error);
        this.trades = this.getMockTrades(); // fallback : mock uniquement
      }
    });

  }
  getMockTrades(): any[] {
    return [
      {
        id: 1,
        type: 'Long',
        entryDate: new Date('2024-01-05 09:30'),
        entryPrice: 1.1000,
        exitPrice: 1.1050,
        result: '+50 pips',
        rr: 2.5,
        duration: 120,
        comment: 'Breakout validé après la KillZone NY'
      },
      {
        id: 2,
        type: 'Short',
        entryDate: new Date('2024-01-10 14:00'),
        entryPrice: 1.1100,
        exitPrice: 1.1080,
        result: '+20 pips',
        rr: 1.0,
        duration: 45,
        comment: 'Reversal sur zone de déséquilibre'
      },
      {
        id: 3,
        type: 'Long',
        entryDate: new Date('2024-01-15 08:00'),
        entryPrice: 1.0950,
        exitPrice: 1.0920,
        result: '-30 pips',
        rr: -1.5,
        duration: 60,
        comment: 'Erreur de lecture de structure'
      }
    ];
  }
  getDurationInMinutes(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.floor(diffMs / (1000 * 60));
  }
  get currentTrade() {
    return this.trades[this.currentTradeIndex];
  }

  nextTrade() {
    if (this.currentTradeIndex < this.trades.length - 1) {
      this.currentTradeIndex++;
    }
  }
}

