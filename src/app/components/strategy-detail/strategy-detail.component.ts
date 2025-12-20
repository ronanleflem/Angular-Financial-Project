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
    const runId = this.route.snapshot.paramMap.get('runId');
    this.symbol = this.route.snapshot.paramMap.get('symbol') || '';
    const comparedParam = this.route.snapshot.paramMap.get('comparedSymbol');
    this.comparedSymbol = comparedParam && comparedParam !== 'none' ? comparedParam : '';

    const navState = this.router.getCurrentNavigation()?.extras.state || history.state;
    const stateStrategy = navState?.['strategy'];

    if (stateStrategy) {
      this.strategy = stateStrategy;
    } else if (strategyName && runId) {
      this.tradingDataService.getAllCalculatedStrategies().subscribe({
        next: (backendData: any) => {
          const formattedBackends = Array.isArray(backendData) ? backendData : [backendData];
          const match = formattedBackends.find(s => s.name === strategyName);
          if (match) {
            const start = match.startStrategy
              ? new Date(match.startStrategy * 1000)
              : (match.StartStrategie ? new Date(match.StartStrategie) : undefined);
            const end = match.endStrategy
              ? new Date(match.endStrategy * 1000)
              : (match.EndStrategie ? new Date(match.EndStrategie) : undefined);
            this.strategy = {
              runId: match.runId,
              name: match.name,
              winRate: (match.winRate * match.lossRate / 100) * 100,
              winningTrades: match.winRate,
              losingTrades: match.lossRate,
              totalReturn: match.totalReturn,
              maxDrawdown: match.maxDrawdown,
              averageTrade: match.averageTrade,
              averageSL: match.averageSL,
              averageTP: match.averageTP,
              tradeCount: match.lossRate + match.winRate,
              symbol: match.symbol,
              comparedSymbol: match.comparedSymbol,
              startDate: start,
              endDate: end,
              averageRR: match.RRmoyen
            };
          } else {
            this.strategy = { name: strategyName, symbol: this.symbol, comparedSymbol: this.comparedSymbol };
          }
        },
        error: () => {
          this.strategy = { name: strategyName, symbol: this.symbol, comparedSymbol: this.comparedSymbol };
        }
      });
    } else {
      this.strategy = { name: strategyName, symbol: this.symbol, comparedSymbol: this.comparedSymbol };
    }
    this.tradingDataService.getTradesByStrategyName(strategyName!,runId!).subscribe({
      next: (trades: any[] | null | undefined) => {
        console.log("Avant le map",trades);
        const formattedTrades = Array.isArray(trades) ? trades.map(t => ({
          id: t.id,
          tradeType: t.tradeType,
          assetClass: t.assetClass,
          entryTimestamp: t.entryTimestamp ? new Date(t.entryTimestamp) : null,
          exitTimestamp: t.exitTimestamp ? new Date(t.exitTimestamp) : null,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          stopLoss: t.stopLoss,
          takeProfit: t.takeProfit,
          profitOrLoss: t.profitOrLoss,
          pnlPct: t.pnlPct,
          maxDrawdownPct: t.maxDrawdownPct,
          quantity: t.quantity,
          cycleId: t.cycleId,
          confidenceScore: t.confidenceScore,
          symbol: t.symbol,
          intermediateEntries: t.intermediateEntries,
          rr: t.takeProfit && t.stopLoss
            ? (Math.abs(t.takeProfit - t.entryPrice) / Math.abs(t.entryPrice - t.stopLoss)).toFixed(2)
            : null,
          duration: this.getDurationInMinutes(t.entryTimestamp, t.exitTimestamp),
          comment: `Trade auto charge de ${t.strategyName}`
        })) : [];

        this.trades = formattedTrades ? formattedTrades : this.getMockTrades();

        console.log(this.trades);
      },
      error: (error: unknown) => {
        console.log(strategyName+" "+runId);
        console.error('Erreur lors du chargement des trades :', error);
        this.trades = this.getMockTrades(); // fallback : mock uniquement
      }
    });

  }
  getMockTrades(): any[] {
    return [
      {
        id: 1,
        tradeType: 'Long',
        assetClass: 'FX',
        entryTimestamp: new Date('2024-01-05 09:30'),
        exitTimestamp: new Date('2024-01-05 11:30'),
        entryPrice: 1.1000,
        exitPrice: 1.1050,
        stopLoss: 1.0980,
        takeProfit: 1.1050,
        profitOrLoss: 0.0050,
        pnlPct: 0.45,
        maxDrawdownPct: 0.1,
        quantity: 1,
        cycleId: 1,
        confidenceScore: 0.72,
        symbol: 'EURUSD',
        rr: 2.5,
        duration: 120,
        comment: 'Breakout valide apres la KillZone NY'
      },
      {
        id: 2,
        tradeType: 'Short',
        assetClass: 'FX',
        entryTimestamp: new Date('2024-01-10 14:00'),
        exitTimestamp: new Date('2024-01-10 14:45'),
        entryPrice: 1.1100,
        exitPrice: 1.1080,
        stopLoss: 1.1120,
        takeProfit: 1.1080,
        profitOrLoss: 0.0020,
        pnlPct: 0.18,
        maxDrawdownPct: 0.05,
        quantity: 1,
        cycleId: 2,
        confidenceScore: 0.61,
        symbol: 'EURUSD',
        rr: 1.0,
        duration: 45,
        comment: 'Reversal sur zone de desequilibre'
      },
      {
        id: 3,
        tradeType: 'Long',
        assetClass: 'FX',
        entryTimestamp: new Date('2024-01-15 08:00'),
        exitTimestamp: new Date('2024-01-15 09:00'),
        entryPrice: 1.0950,
        exitPrice: 1.0920,
        stopLoss: 1.0920,
        takeProfit: 1.1000,
        profitOrLoss: -0.0030,
        pnlPct: -0.27,
        maxDrawdownPct: 0.2,
        quantity: 1,
        cycleId: 3,
        confidenceScore: 0.4,
        symbol: 'EURUSD',
        rr: -1.5,
        duration: 60,
        comment: 'Erreur de lecture de structure'
      }
    ];
  }
  getDurationInMinutes(start: string | Date | null | undefined, end: string | Date | null | undefined): number {
    if (!start || !end) return 0;
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
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

