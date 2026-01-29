import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  SeriesMarker,
  Time,
  UTCTimestamp,
  createChart
} from 'lightweight-charts';
import { Subscription } from 'rxjs';
import { MarketDataService } from '../../services/market-data.service';
import { LiveSignal, OhlcvBar } from '../../models/live-signal.model';

@Component({
  selector: 'app-live-signal-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-signal-chart.component.html',
  styleUrls: ['./live-signal-chart.component.scss']
})
export class LiveSignalChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() signal: LiveSignal | null = null;
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;

  loading = false;
  hasData = false;

  private chart?: IChartApi;
  private series?: ISeriesApi<'Candlestick'>;
  private windowSub?: Subscription;
  private viewInitialized = false;

  constructor(private readonly marketData: MarketDataService) {}

  ngAfterViewInit(): void {
    this.initializeChart();
    this.viewInitialized = true;
    if (this.signal) {
      this.loadSignal(this.signal);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewInitialized) {
      return;
    }

    if (changes['signal']) {
      const currentSignal: LiveSignal | null | undefined = changes['signal'].currentValue;
      if (currentSignal) {
        this.loadSignal(currentSignal);
      } else {
        this.resetSeries();
      }
    }
  }

  ngOnDestroy(): void {
    this.windowSub?.unsubscribe();
    this.chart?.remove();
  }

  private initializeChart(): void {
    if (this.chart) {
      return;
    }

    const container = this.chartContainer.nativeElement;
    const { clientWidth } = container;

    this.chart = this.createChartInstance(container, {
      width: clientWidth || undefined,
      height: container.clientHeight || 400,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#0f172a'
      },
      grid: {
        vertLines: { color: '#e2e8f0' },
        horzLines: { color: '#e2e8f0' }
      },
      crosshair: {
        mode: 0
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false
      }
    });

    this.series = this.chart.addCandlestickSeries({
      upColor: '#16a34a',
      borderUpColor: '#16a34a',
      wickUpColor: '#16a34a',
      downColor: '#dc2626',
      borderDownColor: '#dc2626',
      wickDownColor: '#dc2626'
    });
  }

  protected createChartInstance(container: HTMLDivElement, options: Parameters<typeof createChart>[1]): IChartApi {
    return createChart(container, options);
  }

  private loadSignal(signal: LiveSignal): void {
    if (!this.series) {
      return;
    }

    this.loading = true;
    this.hasData = false;
    this.windowSub?.unsubscribe();

    this.windowSub = this.marketData
      .getWindow({
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        endTsUtc: signal.tsOpenUtc,
        barsBack: 50,
        exitTsUtc: signal.payload?.exitTsUtc,
        maxForward: 120
      })
      .subscribe({
        next: response => {
          const seriesData = this.transformBars(response.bars);
          this.series!.setData(seriesData);
          this.series!.setMarkers(this.buildMarkers(signal));
          this.hasData = seriesData.length > 0;
          this.chart?.timeScale().fitContent();
        },
        error: error => {
          console.error('Failed to load signal window', error);
          this.resetSeries();
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
  }

  private transformBars(bars: OhlcvBar[]): CandlestickData[] {
    return bars.map(bar => ({
      time: (Date.parse(bar.tsUtc) / 1000) as UTCTimestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close
    }));
  }

  private buildMarkers(signal: LiveSignal): SeriesMarker<Time>[] {
    const markers: SeriesMarker<Time>[] = [];
    const entryTime = (Date.parse(signal.tsOpenUtc) / 1000) as UTCTimestamp;

    markers.push({
      time: entryTime,
      position: signal.side === 'LONG' ? 'belowBar' : 'aboveBar',
      shape: signal.side === 'LONG' ? 'arrowUp' : 'arrowDown',
      color: signal.side === 'LONG' ? '#16a34a' : '#dc2626',
      text: 'ENTRY'
    });

    const exitTsUtc = signal.payload?.exitTsUtc;
    if (exitTsUtc) {
      markers.push({
        time: (Date.parse(exitTsUtc) / 1000) as UTCTimestamp,
        position: 'aboveBar',
        shape: 'circle',
        color: '#eab308',
        text: 'EXIT'
      });
    }

    return markers;
  }

  private resetSeries(): void {
    this.windowSub?.unsubscribe();
    if (this.series) {
      this.series.setData([]);
      this.series.setMarkers([]);
    }
    this.hasData = false;
    this.loading = false;
  }
}
