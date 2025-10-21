import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import { CandlestickController, CandlestickElement, OhlcController, OhlcElement } from 'chartjs-chart-financial';
import { TradingDataService } from '../../services/trading-data.service';

Chart.register(
  ...registerables,
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement,
  zoomPlugin
);

interface LiveChartPanel {
  id: number;
  provider: string;
  pair: string;
  duration: string;
  barSize: string;
  pollMs: number;
  chart?: Chart<'candlestick'>;
  stop$?: Subject<void>;
  sub?: Subscription;
  connectSub?: Subscription;
  reqId?: number;
  isRunning: boolean;
}

@Component({
  standalone: true,
  selector: 'app-live-data',
  imports: [CommonModule, FormsModule],
  templateUrl: './live-data.component.html',
  styleUrls: ['./live-data.component.css']
})
export class LiveDataComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('liveCanvas') liveCanvasRefs!: QueryList<ElementRef<HTMLCanvasElement>>;

  readonly barSizeOptions = [
    { value: '1 min', label: '1 minute', timeUnit: 'minute' as const },
    { value: '5 mins', label: '5 minutes', timeUnit: 'minute' as const },
    { value: '15 mins', label: '15 minutes', timeUnit: 'minute' as const },
    { value: '1 hour', label: '1 hour', timeUnit: 'hour' as const },
    { value: '4 hours', label: '4 hours', timeUnit: 'hour' as const },
    { value: '1 day', label: '1 day', timeUnit: 'day' as const }
  ];

  readonly dataProviders = [
    { value: 'ibkr', label: 'IBKR' }
  ];

  private canvasChangesSub?: Subscription;

  readonly panels: LiveChartPanel[] = [
    {
      id: 1,
      provider: this.dataProviders[0].value,
      pair: 'EURUSD',
      duration: '1 D',
      barSize: this.barSizeOptions[0].value,
      pollMs: 1000,
      isRunning: false
    },
    {
      id: 2,
      provider: this.dataProviders[0].value,
      pair: 'GBPUSD',
      duration: '1 D',
      barSize: this.barSizeOptions[2].value,
      pollMs: 1000,
      isRunning: false
    }
  ];

  constructor(private readonly data: TradingDataService) {}

  ngAfterViewInit(): void {
    this.initializeCharts();
    this.canvasChangesSub = this.liveCanvasRefs.changes.subscribe(() => this.initializeCharts());
  }

  ngOnDestroy(): void {
    this.canvasChangesSub?.unsubscribe();
    this.panels.forEach(panel => {
      this.stop(panel, { skipStopRequest: true });
      panel.chart?.destroy();
    });
  }

  start(panel: LiveChartPanel): void {
    if (panel.isRunning) {
      return;
    }

    panel.isRunning = true;
    panel.stop$ = new Subject<void>();
    panel.reqId = undefined;
    this.resetDataset(panel);

    panel.connectSub?.unsubscribe();
    panel.connectSub = this.data.ibkrStatus().pipe(
      switchMap(status => (status?.connected ? of(status) : this.data.ibkrConnectWait()))
    ).subscribe({
      next: () => {
        if (panel.provider !== 'ibkr') {
          console.warn(`Provider ${panel.provider} not supported yet.`);
          this.stop(panel);
          return;
        }

        const selectedPair = panel.pair.trim();
        if (!selectedPair) {
          console.warn('Please provide a market symbol before starting the live stream.');
          this.stop(panel);
          return;
        }

        panel.sub = this.data
          .streamIbkrBars(
            { pair: selectedPair, duration: panel.duration, barSize: panel.barSize, pollMs: panel.pollMs },
            panel.stop$
          )
          .subscribe({
            next: (event) => {
              if (!panel.reqId) {
                panel.reqId = event.reqId;
              }

              if (event.mode === 'bootstrap' && event.bars?.length) {
                const dataset = this.ensureDataset(panel);
                dataset.data = event.bars.map(bar => this.data.toFinancialPoint(bar));
                this.updateDatasetMeta(panel);
              } else if (event.mode === 'update' && event.bar) {
                this.upsertLast(panel, event.bar);
              }
            },
            error: (err) => {
              console.error('Live stream error', err);
              this.stop(panel);
            }
          });
      },
      error: (err) => {
        console.error('IBKR connect/status failed', err);
        this.stop(panel);
      }
    });
  }

  stop(panel: LiveChartPanel, options: { skipStopRequest?: boolean } = {}): void {
    if (panel.stop$ && !panel.stop$.closed) {
      panel.stop$.next();
      panel.stop$.complete();
    }

    panel.stop$ = undefined;

    panel.sub?.unsubscribe();
    panel.sub = undefined;

    panel.connectSub?.unsubscribe();
    panel.connectSub = undefined;

    const currentReqId = panel.reqId;
    panel.reqId = undefined;

    if (!options.skipStopRequest && currentReqId != null) {
      this.data.ibkrStopLiveBars(currentReqId).subscribe({
        error: (err) => {
          console.error('Error stopping IBKR stream', err);
        }
      });
    }

    panel.isRunning = false;
  }

  onPairChange(panel: LiveChartPanel): void {
    if (!panel.isRunning) {
      this.updateDatasetMeta(panel);
    }
  }

  onProviderChange(panel: LiveChartPanel): void {
    if (!panel.isRunning) {
      this.updateDatasetMeta(panel);
    }
  }

  onBarSizeChange(panel: LiveChartPanel): void {
    if (!panel.isRunning) {
      this.updateDatasetMeta(panel);
    }
    this.updateTimeScale(panel);
  }

  trackPanelById(_index: number, panel: LiveChartPanel): number {
    return panel.id;
  }

  private initializeCharts(): void {
    this.panels.forEach((panel, index) => {
      if (!panel.chart) {
        const canvas = this.liveCanvasRefs.get(index);
        if (canvas) {
          this.initChartForPanel(panel, canvas.nativeElement);
        }
      }
    });
  }

  private initChartForPanel(panel: LiveChartPanel, canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to acquire chart context');
    }

    panel.chart = new Chart(ctx, this.buildConfig(panel));
    this.updateTimeScale(panel);
  }

  private buildConfig(panel: LiveChartPanel): ChartConfiguration<'candlestick'> {
    const barSizeMeta = this.getSelectedBarSizeMeta(panel.barSize);
    return {
      type: 'candlestick',
      data: {
        datasets: [
          {
            label: this.buildDatasetLabel(panel),
            data: []
          }
        ]
      },
      options: {
        parsing: false,
        animation: false,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: { unit: barSizeMeta?.timeUnit ?? 'minute' }
          },
          y: {
            beginAtZero: false
          }
        },
        plugins: {
          legend: { display: true },
          zoom: {
            pan: { enabled: true, mode: 'x' },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x'
            }
          }
        }
      }
    };
  }

  private ensureDataset(panel: LiveChartPanel) {
    if (!panel.chart) {
      throw new Error('Chart not initialised for panel');
    }
    const dataset = panel.chart.data.datasets[0] as any;
    if (!Array.isArray(dataset.data)) {
      dataset.data = [];
    }
    return dataset;
  }

  private resetDataset(panel: LiveChartPanel): void {
    if (!panel.chart) {
      return;
    }
    const dataset = this.ensureDataset(panel);
    dataset.data = [];
    this.updateDatasetMeta(panel);
    this.updateTimeScale(panel);
  }

  private upsertLast(panel: LiveChartPanel, bar: { time: number | string; open: number; high: number; low: number; close: number }): void {
    const dataset = this.ensureDataset(panel);
    const nextPoint = this.data.toFinancialPoint(bar);
    const lastPoint = dataset.data.at(-1);

    const lastTimestamp = lastPoint ? new Date(lastPoint.t).getTime() : undefined;
    const nextTimestamp = this.data.toEpochMs(bar.time);

    if (lastPoint && lastTimestamp === nextTimestamp) {
      lastPoint.h = Math.max(lastPoint.h, nextPoint.h);
      lastPoint.l = Math.min(lastPoint.l, nextPoint.l);
      lastPoint.c = nextPoint.c;
    } else {
      dataset.data.push(nextPoint);
    }

    panel.chart?.update('none');
  }

  private updateDatasetMeta(panel: LiveChartPanel): void {
    if (!panel.chart) {
      return;
    }
    const dataset = this.ensureDataset(panel);
    dataset.label = this.buildDatasetLabel(panel);
    panel.chart.update('none');
  }

  private buildDatasetLabel(panel: LiveChartPanel): string {
    const barSizeLabel = this.getSelectedBarSizeMeta(panel.barSize)?.label ?? panel.barSize;
    const providerLabel = this.getProviderLabel(panel.provider);
    return `${panel.pair.trim() || '—'} · ${barSizeLabel}${providerLabel ? ` · ${providerLabel}` : ''}`;
  }

  private getProviderLabel(provider: string): string {
    return this.dataProviders.find(p => p.value === provider)?.label ?? '';
  }

  private getSelectedBarSizeMeta(barSize: string) {
    return this.barSizeOptions.find(option => option.value === barSize);
  }

  private updateTimeScale(panel: LiveChartPanel): void {
    if (!panel.chart?.options?.scales) {
      return;
    }
    const meta = this.getSelectedBarSizeMeta(panel.barSize);
    const timeUnit = meta?.timeUnit ?? 'minute';
    const xScale: any = panel.chart.options.scales['x'];
    if (xScale?.time) {
      xScale.time.unit = timeUnit;
      panel.chart.update('none');
    }
  }
}
