import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, NgForOf, NgIf, PercentPipe } from '@angular/common';
import { Router } from '@angular/router';
import { TradingDataService } from '../../services/trading-data.service';
import { parseBackendValidationErrors, parseRunRuntimeError } from '../../utils/backend-validation';

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
  private static readonly GENERIC_LOAD_ERROR = 'Erreur lors du chargement des strategies.';
  private static readonly BACKEND_CONTRACT_ERROR = 'Contrat backend invalide (422).';
  private static readonly BACKEND_UNAVAILABLE_ERROR = 'Backend indisponible. Reessayez plus tard.';
  private static readonly NOT_IMPLEMENTED_YET = 'Not implemented yet';

  symbols: string[] = [];
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
  errorMessage: string | null = null;

  constructor(private router: Router, private tradingService: TradingDataService) {}

  goToDetails(strategy: any) {
    const safeComparedSymbol = strategy?.comparedSymbol ?? 'none';
    this.router.navigate(
      ['/strategy-detail', strategy.name, strategy.runId, strategy.symbol, safeComparedSymbol],
      { state: { strategy } }
    );
  }

  ngOnInit(): void {
    this.loadSymbols();
  }

  loadSymbols() {
    this.symbols = ['EUR/USD', 'NAS100', 'BTC/USD'];
  }

  loadStrategies() {
    if (!this.selectedSymbol) return;

    this.isLoading = true;
    this.errorMessage = null;

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
        const mapped = formattedBackends.map(s => {
          const start = s.startStrategy
            ? new Date(s.startStrategy)
            : (s.StartStrategie ? new Date(s.StartStrategie) : undefined);
          const end = s.endStrategy
            ? new Date(s.endStrategy)
            : (s.EndStrategie ? new Date(s.EndStrategie) : undefined);
          const winCount = s.winCount;
          const lossCount = s.lossCount;
          const totalTrades = (winCount ?? 0) + (lossCount ?? 0);
          const winRate = typeof s.winRate === 'number'
            ? s.winRate
            : (totalTrades > 0 && typeof winCount === 'number'
              ? (winCount / totalTrades) * 100
              : undefined);

          return {
            runId: s.runId,
            name: s.name,
            winRate,
            winningTrades: s.winCount,
            losingTrades: s.lossCount,
            totalReturn: s.totalReturn,
            maxDrawdown: s.maxDrawdown,
            averageTrade: s.averageTrade,
            averageSL: s.averageSL,
            averageTP: s.averageTP,
            tradeCount: totalTrades || undefined,
            symbol: s.symbol,
            timeframe: s.timeframe,
            comparedSymbol: s.comparedSymbol,
            startDate: start,
            endDate: end,
            averageRR: s.rrMoyen,
            totalNetReturn: s.totalNetReturn,
            netWinCount: s.netWinCount,
            netLossCount: s.netLossCount,
            averageNetTrade: s.averageNetTrade
          };
        });

        this.strategies = [...mockData, ...mapped];
        this.isLoading = false;
        this.errorMessage = null;
      },
      error: (err) => {
        this.strategies = [...mockData];
        this.isLoading = false;
        this.errorMessage = this.mapLoadErrorMessage(err);
      }
    });
  }

  private mapLoadErrorMessage(error: unknown): string {
    const validationErrors = parseBackendValidationErrors(error);
    if (validationErrors.length > 0) {
      const firstMessage = validationErrors[0].message?.trim();
      return firstMessage || ScreenStrategiesComponent.BACKEND_CONTRACT_ERROR;
    }

    const runtimeError = parseRunRuntimeError((error as { error?: unknown } | null)?.error ?? error);
    const runtimeCode = String(runtimeError?.code ?? '').trim().toLowerCase();
    if (runtimeCode === 'not_implemented_feature') {
      return runtimeError?.message?.trim() || ScreenStrategiesComponent.NOT_IMPLEMENTED_YET;
    }

    const status = (error as { status?: number } | null)?.status;
    if (status === 0 || (typeof status === 'number' && status >= 500)) {
      return ScreenStrategiesComponent.BACKEND_UNAVAILABLE_ERROR;
    }

    return ScreenStrategiesComponent.GENERIC_LOAD_ERROR;
  }
}
