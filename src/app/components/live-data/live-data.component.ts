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

Chart.register(
  ...registerables,
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement
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

@Component({
  standalone: true,
  selector: 'app-live-data',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './live-data.component.html',
  styleUrls: ['./live-data.component.scss']
})
export class LiveDataComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('chartCanvas') chartCanvasRefs!: QueryList<ElementRef<HTMLCanvasElement>>;

  readonly brokerOptions = ['IBKR'];
  readonly barSizeOptions = ALLOWED_BAR_SIZES;
  readonly durationOptions = ['1 D', '1 W', '1 M'];
  readonly whatOptions = ['MIDPOINT', 'BID_ASK'];

  readonly controlForm: FormGroup<{
    broker: FormControl<string>;
    pair: FormControl<string>;
    barSize: FormControl<string>;
    duration: FormControl<string>;
    what: FormControl<string>;
    rth: FormControl<boolean>;
  }>;

  connected = false;
  connecting = false;
  settingMarketDataType = false;
  starting = false;
  stopping = false;
  reqId: number | null = null;

  bars: HistBar[] = [];
  trades: TradeView[] = [];

  snackbarVisible = false;
  snackbarMessage = '';

  private readonly destroy$ = new Subject<void>();
  private barsPollingSub?: Subscription;
  private charts: Chart<'candlestick'>[] = [];
  private snackbarTimeoutHandle?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly marketData: MarketDataService
  ) {
    this.controlForm = this.fb.group({
      broker: ['IBKR', Validators.required],
      pair: ['EURUSD', Validators.required],
      barSize: ['1 min', Validators.required],
      duration: ['1 D', Validators.required],
      what: ['MIDPOINT', Validators.required],
      rth: [false]
    });
  }

  ngOnInit(): void {
    this.startTradesPolling();
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

  startLiveBars(): void {
    if (!this.connected) {
      this.showSnackbar('Connect to the broker before starting live bars.');
      return;
    }

    if (this.controlForm.invalid) {
      this.controlForm.markAllAsTouched();
      this.showSnackbar('Please fill the required fields.');
      return;
    }

    const { pair, duration, barSize, what, rth } = this.controlForm.getRawValue();

    this.stopActiveStreamSilently();
    this.starting = true;
    this.bars = [];
    this.updateCharts();

    this.marketData
      .startLiveBars(pair, duration, barSize, what, rth ? 1 : 0)
      .pipe(
        finalize(() => {
          this.starting = false;
        })
      )
      .subscribe({
        next: response => {
          this.reqId = response.reqId;
          this.showSnackbar(`Live bars started (reqId ${response.reqId})`);
          this.startBarsPolling(response.reqId);
        },
        error: err => this.handleError('Failed to start live bars', err)
      });
  }

  stopLiveBars(): void {
    if (this.reqId == null) {
      return;
    }

    const currentReqId = this.reqId;
    this.stopping = true;
    this.stopBarsPolling();

    this.marketData
      .stopLiveBars(currentReqId)
      .pipe(
        finalize(() => {
          this.stopping = false;
          this.reqId = null;
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
    this.stopActiveStreamSilently();
    this.stopBarsPolling();
    this.destroyCharts();
    if (this.snackbarTimeoutHandle) {
      clearTimeout(this.snackbarTimeoutHandle);
    }
  }

  private startTradesPolling(): void {
    combineLatest([
      this.controlForm.controls.broker.valueChanges.pipe(startWith(this.controlForm.controls.broker.value)),
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
      });
  }

  private startBarsPolling(reqId: number): void {
    this.stopBarsPolling();
    this.barsPollingSub = interval(2000)
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
        if (this.reqId !== reqId) {
          return;
        }

        this.bars = [...bars]
          .filter(bar => !!bar && typeof bar.tsMillis === 'number')
          .sort((a, b) => a.tsMillis - b.tsMillis)
          .slice(-500);
        this.updateCharts();
      });
  }

  private stopBarsPolling(): void {
    this.barsPollingSub?.unsubscribe();
    this.barsPollingSub = undefined;
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
        }
      }
    };
  }

  private updateCharts(): void {
    if (!this.charts.length) {
      return;
    }
    const dataset = this.bars.map(bar => ({
      x: new Date(bar.tsMillis),
      o: bar.open,
      h: bar.high,
      l: bar.low,
      c: bar.close
    }));

    this.charts.forEach(chart => {
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

  private stopActiveStreamSilently(): void {
    if (this.reqId == null) {
      return;
    }
    const activeReqId = this.reqId;
    this.reqId = null;
    this.stopBarsPolling();
    this.marketData
      .stopLiveBars(activeReqId)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private handleError(message: string, error: unknown): void {
    console.error(message, error);
    this.showSnackbar(message);
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
}
