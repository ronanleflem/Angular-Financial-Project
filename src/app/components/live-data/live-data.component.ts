import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren
} from '@angular/core';
import { tap } from 'rxjs/operators';
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
type LiveStreamEvent =
  | { mode: 'bootstrap'; reqId: number; bars: any[] }
  | { mode: 'update';   reqId: number; bar: any };
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
  private log(panel: LiveChartPanel, msg: string, extra?: any) {
    const tag = `[LiveData p#${panel.id}]`;
    if (extra !== undefined) {
      console.log(`${tag} ${msg}`, extra);
    } else {
      console.log(`${tag} ${msg}`);
    }
  }
  start(panel: LiveChartPanel): void {
    if (panel.isRunning) return;
    this.log(panel, 'START clicked');
    panel.isRunning = true;
    panel.stop$ = new Subject<void>();
    const stop$ = panel.stop$; // ref non nulle

    panel.reqId = undefined;
    this.resetDataset(panel);
    this.log(panel, 'Dataset reset; checking IBKR status');

    panel.connectSub?.unsubscribe();
    panel.connectSub = this.data.ibkrStatus().pipe(
      tap(s => this.log(panel, `ibkrStatus: connected=${s?.connected}`)),
      switchMap(status => (status?.connected ? of(status) : this.data.ibkrConnectWait().pipe(
        tap(() => this.log(panel, 'ibkrConnectWait done'))
      )))
    ).subscribe({
      next: () => {
        this.log(panel, `Provider=${panel.provider}, Pair=${panel.pair}, TF=${panel.barSize}`);
        if (panel.provider !== 'ibkr') {
          console.warn(`Provider "${panel.provider}" not supported yet.`);
          this.log(panel, `Provider "${panel.provider}" not supported → stop`);
          this.stop(panel);
          return;
        }

        const selectedPair = panel.pair.trim();
        if (!selectedPair) {
          console.warn('Please provide a market symbol before starting the live stream.');
          this.log(panel, 'No market symbol provided → stop');
          this.stop(panel);
          return;
        }

        this.log(panel, 'Calling streamIbkrBars()...');
        panel.sub = this.data
          .streamIbkrBars(
            { pair: selectedPair, duration: panel.duration, barSize: panel.barSize, pollMs: panel.pollMs },
            stop$
          ).pipe(
            tap(ev => this.log(panel, `stream event: ${ev.mode}`, ev))
          )
          .subscribe({
            next: (event: LiveStreamEvent) => {
              if (!panel.reqId){
                panel.reqId = event.reqId;
                this.log(panel, `reqId set: ${panel.reqId}`);
              }

              if (event.mode === 'bootstrap' && (event as any).bars?.length) {
                const bars = (event as any).bars as any[];
                this.log(panel, `bootstrap received: ${bars.length} bars`);
                const intervalMs = this.getIntervalMs(panel.barSize);
                const dataset = this.ensureDataset(panel);

                dataset.data = bars
                  .map(b => {
                    const ts = this.data.toEpochMs(b.time);
                    const bucket = this.floorToBucket(ts, intervalMs);
                    const p = this.data.toFinancialPoint(b); // { x, o,h,l,c }
                    return { x: new Date(bucket), o: p.o, h: p.h, l: p.l, c: p.c }; // <-- x
                  })
                  .sort((a: any, b: any) => new Date(a.x).getTime() - new Date(b.x).getTime()) // <-- x
                  .reduce((acc: any[], cur: any) => {
                    const last = acc.at(-1);
                    if (last && new Date(last.x).getTime() === new Date(cur.x).getTime()) { // <-- x
                      last.h = Math.max(last.h, cur.h);
                      last.l = Math.min(last.l, cur.l);
                      last.c = cur.c;
                      return acc;
                    }
                    acc.push(cur);
                    return acc;
                  }, []);

                this.updateDatasetMeta(panel);
                panel.chart?.update('none');
              }
              else if (event.mode === 'update' && (event as any).bar) {
                this.log(panel, 'update received → upsertLast()');
                this.upsertLast(panel, (event as any).bar);  // <-- ajoute la bougie live
              }
            },
            error: (err) => {
              this.log(panel, 'Live stream error', err);
              console.error('Live stream error', err);
              this.stop(panel);
            }
          });
      },
      error: (err) => {
        this.log(panel, 'IBKR connect/status failed', err);
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
        datasets: [{
          label: this.buildDatasetLabel(panel),
          data: [],
          // Empêche tout débordement hors chartArea
          clip: 0,
          // Contraint la largeur des chandeliers (casting car les d.ts de Chart n’ont pas ces props)
          barThickness: 1 as any,
          maxBarThickness: 10 as any,
          borderWidth: 1 as any
        } as any] // ← casting pour calmer TS sur les props spécifiques au plugin
      },
      options: {
        responsive: true,
        resizeDelay: 100,
        normalized: true,
        parsing: false,
        animation: false,
        maintainAspectRatio: false,
        layout: { padding: { right: 0 } },
        scales: {
          x: {
            type: 'time',
            time: { unit: barSizeMeta?.timeUnit ?? 'minute' },
            offset: true,         // espace aux extrémités pour éviter de coller le bord droit
            bounds: 'ticks',
            ticks: { maxRotation: 0, autoSkip: true }
          },
          y: { beginAtZero: false }
        },
        plugins: {
          legend: { display: true },
          zoom: {
            pan: { enabled: true, mode: 'x' },
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
          }
        }
        // ❌ supprime entièrement "elements: { candlestick: ... }"
        // // devicePixelRatio: 1, // (optionnel, seulement si artefacts persistants)
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

  private upsertLast(
    panel: LiveChartPanel,
    bar: { time: number | string; open: number; high: number; low: number; close: number }
  ): void {
    const dataset = this.ensureDataset(panel);
    const intervalMs = this.getIntervalMs(panel.barSize);

    const nextPoint = this.data.toFinancialPoint(bar);       // { x, o,h,l,c }
    const nextTs = this.data.toEpochMs(bar.time);
    const nextBucket = this.floorToBucket(nextTs, intervalMs);

    const last = dataset.data.at(-1);
    const lastTs = last ? new Date(last.x).getTime() : undefined;   // <-- x
    const lastBucket = lastTs != null ? this.floorToBucket(lastTs, intervalMs) : undefined;

    if (last && lastBucket === nextBucket) {
      last.h = Math.max(last.h, nextPoint.h);
      last.l = Math.min(last.l, nextPoint.l);
      last.c = nextPoint.c;
    } else {
      // ignore out-of-order
      if (lastBucket != null && nextBucket < lastBucket) return;

      dataset.data.push({
        x: new Date(nextBucket), o: nextPoint.o, h: nextPoint.h, l: nextPoint.l, c: nextPoint.c
      });
      this.log(panel, `dataset size=${(dataset.data as any[]).length}`);
      if (dataset.data.length > 500) dataset.data.shift();
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

  /** Convertit "1 min" | "5 mins" | "15 mins" | "1 hour" | "4 hours" | "1 day" => intervalle en ms */
  private getIntervalMs(barSize: string): number {
    const v = barSize.toLowerCase().trim();
    if (v.startsWith('1 min')) return 60_000;
    if (v.startsWith('5 min')) return 5 * 60_000;
    if (v.startsWith('15 min')) return 15 * 60_000;
    if (v.startsWith('1 hour')) return 60 * 60_000;
    if (v.startsWith('4 hours')) return 4 * 60 * 60_000;
    if (v.startsWith('1 day')) return 24 * 60 * 60_000;
    // défaut: 1 min
    return 60_000;
  }

  /** Arrondi "floor" du timestamp au début du bucket de l'intervalle */
  private floorToBucket(tsMs: number, intervalMs: number): number {
    return Math.floor(tsMs / intervalMs) * intervalMs;
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
