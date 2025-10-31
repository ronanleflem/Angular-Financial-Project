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

  connected = false;
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
  private readonly brokerLiquidity: Record<string, number> = {
    IBKR: 150_000,
    MEXC: 60_000
  };

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly marketData: MarketDataService
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
  }

  ngOnInit(): void {
    this.startTradesPolling();
    this.summaryBrokerControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updatePortfolioSummary());
    this.updatePortfolioSummary();
  }

  ngAfterViewInit(): void {
    this.initializeCharts();
    this.chartCanvasRefs.changes.pipe(takeUntil(this.destroy$)).subscribe(() => this.initializeCharts());
  }

  connectAndWait(): void {
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
          this.connected = !!response?.connected;
          this.showSnackbar(this.connected ? 'Connected to IBKR' : 'Connection failed');
        },
        error: err => {
          this.connected = false;
          this.handleError('Unable to connect to IBKR', err);
        }
      });
  }

  setMarketDataTypeDelayed(): void {
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
    if (!this.connected) {
      this.showSnackbar('Connect to the broker before starting live bars.');
      return;
    }

    const panel = this.panels[panelIndex];

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
        switchMap(([broker]) =>
          this.marketData.listTrades(broker).pipe(
            catchError(err => {
              this.handleError('Failed to load open trades', err);
              return of<TradeView[]>([]);
            })
          )
        )
      )
      .subscribe(trades => {
        this.trades = trades;
        this.updatePortfolioSummary();
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
    this.charts.forEach(chart => chart.destroy());
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
    const selection = this.summaryBrokerControl.value ?? 'ALL';

    const relevantBrokers =
      selection === 'ALL'
        ? this.brokerOptions
        : this.brokerOptions.includes(selection)
          ? [selection]
          : [];

    const relevantTrades =
      selection === 'ALL'
        ? this.trades
        : this.trades.filter(trade => trade.broker === selection);

    const liquidity = relevantBrokers.reduce(
      (total, broker) => total + (this.brokerLiquidity[broker] ?? 0),
      0
    );

    const positionsValue = relevantTrades.reduce((total, trade) => {
      if (typeof trade.marketValue === 'number') {
        return total + trade.marketValue;
      }
      return total + trade.position * trade.avgCost;
    }, 0);

    const positionsCount = relevantTrades.filter(trade => trade.position !== 0).length;

    this.summaryMetrics = {
      totalPortfolio: positionsValue + liquidity,
      liquidity,
      positionsValue,
      positionsCount
    };
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
}
