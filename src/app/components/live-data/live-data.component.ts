import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  Subject,
  Subscription,
  combineLatest,
  interval,
  of
} from 'rxjs';
import {
  catchError,
  finalize,
  startWith,
  switchMap,
  takeUntil
} from 'rxjs/operators';
import { MarketDataService } from '../../services/market-data.service';
import { HistBar, TradeView } from '../../models/trading.models';
import { PortfolioSnapshot } from '../../models/portfolio.model';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import {
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement
} from 'chartjs-chart-financial';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Router } from '@angular/router';

Chart.register(
  ...registerables,
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement,
  zoomPlugin
);

const ALLOWED_BAR_SIZES: string[] = [
  '1 sec',
  '5 secs',
  '10 secs',
  '15 secs',
  '30 secs',
  '1 min',
  '2 mins',
  '3 mins',
  '5 mins',
  '10 mins',
  '15 mins',
  '20 mins',
  '30 mins',
  '1 hour',
  '2 hours',
  '3 hours',
  '4 hours',
  '8 hours',
  '1 day',
  '1W',
  '1M'
];

type ControlFormGroup = FormGroup<{
  broker: FormControl<string>;
  pair: FormControl<string>;
  barSize: FormControl<string>;
  duration: FormControl<string>;
  what: FormControl<string>;
  rth: FormControl<boolean>;
}>;

interface ControlPanelState {
  form: ControlFormGroup;
  reqId: number | null;
  bars: HistBar[];
  starting: boolean;
  stopping: boolean;
  barsPollingSub?: Subscription;
}

const PANEL_COUNT = 2;

type SummaryBrokerOption = {
  value: string;
  label: string;
};

interface PortfolioSummary {
  totalPortfolio: number;
  liquidity: number;
  positionsValue: number;
  positionsCount: number;
}

@Component({
  standalone: true,
  selector: 'app-live-data',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './live-data.component.html',
  styleUrls: ['./live-data.component.scss']
})
export class LiveDataComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('chartCanvas') chartCanvasRefs!: QueryList<ElementRef<HTMLCanvasElement>>;

  readonly brokerOptions = ['IBKR', 'MEXC'];
  readonly barSizeOptions = ALLOWED_BAR_SIZES;
  readonly durationOptions = ['1 D', '1 W', '1 M'];
  readonly whatOptions = ['MIDPOINT', 'BID_ASK'];

  readonly panels: ControlPanelState[];

  readonly summaryBrokerControl: FormControl<string>;
  readonly summaryBrokerOptions: SummaryBrokerOption[];

  connecting = false;
  settingMarketDataType = false;
  snackbarVisible = false;
  snackbarMessage = '';

  trades: TradeView[] = [];
  summaryMetrics: PortfolioSummary = {
    totalPortfolio: 0,
    liquidity: 0,
    positionsValue: 0,
    positionsCount: 0
  };

  private readonly destroy$ = new Subject<void>();
  private charts: Chart<'candlestick'>[] = [];
  private snackbarTimeoutHandle?: ReturnType<typeof setTimeout>;
  private readonly brokerConnectionStatus: Record<string, boolean> = {};
  private portfolioSnapshots: Record<string, PortfolioSnapshot> = {};
  private portfolioSnapshotLoading = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly marketData: MarketDataService,
    private readonly router: Router
  ) {
    this.summaryBrokerControl = this.fb.control('ALL');
    this.summaryBrokerOptions = [
      { value: 'ALL', label: 'Tous les brokers' },
      ...this.brokerOptions.map(broker => ({ value: broker, label: broker }))
    ];

    this.panels = Array.from({ length: PANEL_COUNT }, () => ({
      form: this.createControlForm(),
      reqId: null,
      bars: [],
      starting: false,
      stopping: false
    }));

    this.brokerOptions.forEach(broker => {
      this.brokerConnectionStatus[broker] = false;
    });
  }

  openActiveRobots(): void {
    const broker = this.summaryBrokerControl.value;
    const queryParams = broker && broker !== 'ALL' ? { broker } : undefined;
    this.router.navigate(['/active-robots'], { queryParams });
  }

  ngOnInit(): void {
    this.startTradesPolling();
    this.summaryBrokerControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updatePortfolioSummary();
        this.refreshPortfolioSnapshots();
      });
    this.updatePortfolioSummary();
  }

  ngAfterViewInit(): void {
    this.initializeCharts();
    this.chartCanvasRefs.changes.pipe(takeUntil(this.destroy$)).subscribe(() => this.initializeCharts());
  }

  connectAndWait(requestedBroker?: string | null): void {
    const broker = this.normalizeBroker(requestedBroker);
    if (broker !== 'IBKR') {
      this.updateBrokerConnection(broker, true);
      this.showSnackbar(`${broker} connecté`);
      return;
    }

    this.connecting = true;
    this.marketData
      .connectWait()
      .pipe(
        finalize(() => {
          this.connecting = false;
        })
      )
      .subscribe({
        next: response => {
          const connected = !!response?.connected;
          this.updateBrokerConnection(broker, connected);
          this.showSnackbar(
            connected
              ? `${broker} connecté`
              : `Connexion à ${broker} échouée`
          );
        },
        error: err => {
          this.updateBrokerConnection(broker, false);
          this.handleError(`Impossible de se connecter à ${broker}`, err);
        }
      });
  }

  setMarketDataTypeDelayed(requestedBroker?: string | null): void {
    const broker = this.normalizeBroker(requestedBroker);
    if (!this.isBrokerConnected(broker)) {
      this.showSnackbar(`Connectez ${broker} avant de définir le type de données.`);
      return;
    }

    if (broker !== 'IBKR') {
      this.showSnackbar(`La configuration différée n'est pas requise pour ${broker}.`);
      return;
    }

    this.settingMarketDataType = true;
    this.marketData
      .setMarketDataType(3)
      .pipe(
        finalize(() => {
          this.settingMarketDataType = false;
        })
      )
      .subscribe({
        next: () => this.showSnackbar('Market data type set to 3 (Delayed)'),
        error: err => this.handleError('Failed to set market data type', err)
      });
  }

  startLiveBars(panelIndex: number): void {
    const panel = this.panels[panelIndex];
    const broker = panel.form.controls.broker.value;

    if (!this.isBrokerConnected(broker)) {
      this.showSnackbar('Connectez le broker sélectionné avant de démarrer les flux.');
      return;
    }

    if (broker !== 'IBKR') {
      this.showSnackbar(`Les flux en direct ne sont pas disponibles pour ${broker} dans cette version.`);
      return;
    }

    if (panel.form.invalid) {
      panel.form.markAllAsTouched();
      this.showSnackbar('Please fill the required fields.');
      return;
    }

    const { pair, duration, barSize, what, rth } = panel.form.getRawValue();

    this.stopActiveStreamSilently(panelIndex);
    panel.starting = true;
    panel.bars = [];
    this.updateCharts();

    this.marketData
      .startLiveBars(pair, duration, barSize, what, rth ? 1 : 0)
      .pipe(
        finalize(() => {
          panel.starting = false;
        })
      )
      .subscribe({
        next: response => {
          panel.reqId = response.reqId;
          this.showSnackbar(`Live bars started (reqId ${response.reqId})`);
          this.startBarsPolling(panelIndex, response.reqId);
        },
        error: err => this.handleError('Failed to start live bars', err)
      });
  }

  stopLiveBars(panelIndex: number): void {
    const panel = this.panels[panelIndex];
    if (panel.reqId == null) {
      return;
    }

    const currentReqId = panel.reqId;
    panel.stopping = true;
    this.stopBarsPolling(panelIndex);

    this.marketData
      .stopLiveBars(currentReqId)
      .pipe(
        finalize(() => {
          panel.stopping = false;
          panel.reqId = null;
          panel.bars = [];
          this.updateCharts();
        })
      )
      .subscribe({
        next: () => {
          this.showSnackbar(`Live bars stopped (reqId ${currentReqId})`);
        },
        error: err => this.handleError('Failed to stop live bars', err)
      });
  }

  trackTradeBy(index: number, trade: TradeView): string {
    return `${trade.broker}-${trade.account}-${trade.symbol}-${index}`;
  }

  displayValue(value: string | number | null | undefined): string | number {
    return value === null || value === undefined || value === '' ? '—' : value;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.panels.forEach((_, index) => {
      this.stopActiveStreamSilently(index);
      this.stopBarsPolling(index);
    });
    this.destroyCharts();
    if (this.snackbarTimeoutHandle) {
      clearTimeout(this.snackbarTimeoutHandle);
    }
  }

  private startTradesPolling(): void {
    const primaryBrokerControl = this.panels[0].form.controls.broker;

    combineLatest([
      primaryBrokerControl.valueChanges.pipe(startWith(primaryBrokerControl.value)),
      interval(5000).pipe(startWith(0))
    ])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([broker]) => {
          if (!this.isBrokerConnected(broker) || broker !== 'IBKR') {
            return of<TradeView[]>([]);
          }
          return this.marketData.listTrades(broker).pipe(
            catchError(err => {
              this.handleError('Failed to load open trades', err);
              return of<TradeView[]>([]);
            })
          );
        })
      )
      .subscribe(trades => {
        this.trades = trades;
        this.updatePortfolioSummary();
        if (Object.keys(this.portfolioSnapshots).length === 0) {
          this.refreshPortfolioSnapshots();
        }
      });
  }

  private startBarsPolling(panelIndex: number, reqId: number): void {
    const panel = this.panels[panelIndex];
    this.stopBarsPolling(panelIndex);
    panel.barsPollingSub = interval(2000)
      .pipe(
        startWith(0),
        takeUntil(this.destroy$),
        switchMap(() =>
          this.marketData.getLiveBars(reqId).pipe(
            catchError(err => {
              this.handleError('Failed to fetch live bars', err);
              return of<HistBar[]>([]);
            })
          )
        )
      )
      .subscribe(bars => {
        if (panel.reqId !== reqId) {
          return;
        }

        panel.bars = [...bars]
          .filter(bar => !!bar && typeof bar.tsMillis === 'number')
          .sort((a, b) => a.tsMillis - b.tsMillis)
          .slice(-500);
        this.updateCharts();
      });
  }

  private stopBarsPolling(panelIndex: number): void {
    const panel = this.panels[panelIndex];
    panel.barsPollingSub?.unsubscribe();
    panel.barsPollingSub = undefined;
  }

  private initializeCharts(): void {
    this.destroyCharts();
    this.chartCanvasRefs.forEach((ref, index) => {
      const ctx = ref.nativeElement.getContext('2d');
      if (!ctx) {
        return;
      }
      const chart = new Chart(ctx, this.buildChartConfig(index));
      this.charts.push(chart);
    });
    this.updateCharts();
  }

  private buildChartConfig(index: number): ChartConfiguration<'candlestick'> {
    return {
      type: 'candlestick',
      data: {
        datasets: [
          {
            label: index === 0 ? 'Live Bars' : 'Live Bars (zoomed)',
            data: [],
            borderWidth: 1 as any,
            barThickness: 4 as any,
            maxBarThickness: 12 as any
          } as any
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'minute'
            },
            ticks: {
              source: 'auto'
            }
          },
          y: {
            beginAtZero: false
          }
        },
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              mode: 'xy',
              modifierKey: 'shift'
            },
            zoom: {
              wheel: {
                enabled: true
              },
              pinch: {
                enabled: true
              },
              drag: {
                enabled: true
              },
              mode: 'xy'
            }
          }
        }
      }
    };
  }

  private updateCharts(): void {
    if (!this.charts.length) {
      return;
    }

    this.charts.forEach((chart, index) => {
      const panel = this.panels[index];
      const dataset = panel.bars.map(bar => ({
        x: new Date(bar.tsMillis),
        o: bar.open,
        h: bar.high,
        l: bar.low,
        c: bar.close
      }));

      const [firstDataset] = chart.data.datasets;
      if (firstDataset) {
        firstDataset.data = dataset as any;
      }
      chart.update('none');
    });
  }

  private destroyCharts(): void {
    this.charts.forEach(chart => {
      if (chart && typeof (chart as { destroy?: () => void }).destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts = [];
  }

  private stopActiveStreamSilently(panelIndex: number): void {
    const panel = this.panels[panelIndex];
    if (panel.reqId == null) {
      return;
    }
    const activeReqId = panel.reqId;
    panel.reqId = null;
    panel.bars = [];
    this.stopBarsPolling(panelIndex);
    this.marketData
      .stopLiveBars(activeReqId)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.showSnackbar(message);
  }

  private updatePortfolioSummary(): void {
    this.updatePortfolioSummaryFromSnapshots();
  }

  isBrokerConnected(broker: string | null | undefined): boolean {
    if (!broker || !this.brokerOptions.includes(broker)) {
      return false;
    }
    return !!this.brokerConnectionStatus[broker];
  }

  private showSnackbar(message: string): void {
    this.snackbarMessage = message;
    this.snackbarVisible = true;
    if (this.snackbarTimeoutHandle) {
      clearTimeout(this.snackbarTimeoutHandle);
    }
    this.snackbarTimeoutHandle = setTimeout(() => {
      this.snackbarVisible = false;
      this.snackbarMessage = '';
    }, 3000);
  }

  private createControlForm(): ControlFormGroup {
    return this.fb.group({
      broker: ['IBKR', Validators.required],
      pair: ['EURUSD', Validators.required],
      barSize: ['1 min', Validators.required],
      duration: ['1 D', Validators.required],
      what: ['MIDPOINT', Validators.required],
      rth: [false]
    });
  }

  private normalizeBroker(broker: string | null | undefined): string {
    if (broker && this.brokerOptions.includes(broker)) {
      return broker;
    }
    return this.brokerOptions[0];
  }

  private updateBrokerConnection(broker: string, connected: boolean): void {
    this.brokerConnectionStatus[broker] = connected;
    if (!connected) {
      this.trades = [];
      delete this.portfolioSnapshots[broker];
    }
    this.updatePortfolioSummary();
    if (connected) {
      this.refreshPortfolioSnapshots();
    }
  }

  private getConnectedBrokers(): string[] {
    return this.brokerOptions.filter(broker => this.isBrokerConnected(broker));
  }

  private refreshPortfolioSnapshots(): void {
    const connectedBrokers = this.getConnectedBrokers();

    if (connectedBrokers.length === 0 || this.portfolioSnapshotLoading) {
      if (connectedBrokers.length === 0) {
        this.portfolioSnapshots = {};
        this.resetSummaryMetrics();
      }
      return;
    }

    this.portfolioSnapshotLoading = true;
    this.marketData
      .getPortfolioSnapshots()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.portfolioSnapshotLoading = false;
        }),
        catchError(err => {
          console.error('Failed to load portfolio snapshots', err);
          return of<PortfolioSnapshot[]>([]);
        })
      )
      .subscribe(response => {
        const snapshotsArray = Array.isArray(response) ? response : response ? [response] : [];
        const snapshotMap: Record<string, PortfolioSnapshot> = {};

        snapshotsArray.forEach(snapshot => {
          if (snapshot && snapshot.broker && connectedBrokers.includes(snapshot.broker)) {
            snapshotMap[snapshot.broker] = snapshot;
          }
        });

        this.portfolioSnapshots = snapshotMap;
        this.updatePortfolioSummaryFromSnapshots();
      });
  }

  private updatePortfolioSummaryFromSnapshots(): void {
    const selection = this.summaryBrokerControl.value ?? 'ALL';
    const connectedBrokers = this.getConnectedBrokers();

    if (connectedBrokers.length === 0) {
      this.resetSummaryMetrics();
      return;
    }

    const relevantBrokers =
      selection === 'ALL'
        ? connectedBrokers
        : connectedBrokers.includes(selection)
          ? [selection]
          : [];

    if (relevantBrokers.length === 0) {
      this.resetSummaryMetrics();
      return;
    }

    const snapshots = relevantBrokers
      .map(broker => this.portfolioSnapshots[broker])
      .filter((snapshot): snapshot is PortfolioSnapshot => !!snapshot);

    if (snapshots.length === 0) {
      this.resetSummaryMetrics();
      return;
    }

    const totalPortfolio = snapshots.reduce(
      (total, snapshot) => total + (snapshot.totalMarketValue ?? 0),
      0
    );

    const liquidity = snapshots.reduce(
      (total, snapshot) => total + (snapshot.availableLiquidity ?? 0),
      0
    );

    const positionsValue = snapshots.reduce((total, snapshot) => {
      const brokerPositionsValue = snapshot.positions.reduce(
        (positionTotal, position) => positionTotal + (position.marketValue ?? 0),
        0
      );
      return total + brokerPositionsValue;
    }, 0);

    const positionsCount = snapshots.reduce(
      (total, snapshot) => total + snapshot.positions.length,
      0
    );

    this.summaryMetrics = {
      totalPortfolio,
      liquidity,
      positionsValue,
      positionsCount
    };
  }

  private resetSummaryMetrics(): void {
    this.summaryMetrics = {
      totalPortfolio: 0,
      liquidity: 0,
      positionsValue: 0,
      positionsCount: 0
    };
  }
}
