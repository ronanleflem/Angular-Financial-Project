import { Component, Input, OnChanges } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import 'chartjs-chart-financial';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import { TradingDataService } from '../../services/trading-data.service';
import {
  CandlestickController,
  CandlestickElement
} from 'chartjs-chart-financial';
import {
  alignComparedOhlc,
  buildOhlcDataset,
  buildTradeAnnotation,
  mapCandlesToOhlc,
  OhlcPoint
} from '../candlestick-chart.utils';

@Component({
  selector: 'app-trade-candlestick-chart',
  templateUrl: './trade-candlestick-chart.component.html',
  styleUrls: ['./trade-candlestick-chart.component.css'],
  standalone: true,
  imports: [],
})
export class TradeCandlestickChartComponent implements OnChanges {
  @Input() tradeId!: number;
  @Input() timeframe: string = '';
  @Input() symbol: string = '';
  @Input() comparedSymbol: string = '';

  chart: Chart | undefined;
  comparedChart: Chart | undefined;

  constructor(private tradingService: TradingDataService) {
    Chart.register(...registerables, zoomPlugin, annotationPlugin);
    Chart.register(CandlestickController, CandlestickElement);
  }

  ngOnChanges(): void {
    if (this.tradeId) {
      this.loadData();
    }
  }

  loadData(): void {
    this.tradingService.getCandlesForTrade(this.tradeId, this.timeframe, this.symbol, this.comparedSymbol, 50, 50).subscribe(response => {
      const { candles, trade, comparedCandles } = response as any;

      // 🛡️ Validation des données
      const data = mapCandlesToOhlc(candles);
      const comparedData = mapCandlesToOhlc(comparedCandles || []);
      const alignedComparedData = alignComparedOhlc(data, comparedData);

      console.log('[Candles]', candles);
      console.log('[Trade]', trade);

      // 🛡️ Vérifie que trade.entryDate et exitDate sont valides
      const entryTime = new Date(trade.entryTimestamp).getTime();
      const exitTime = new Date(trade.exitTimestamp).getTime();
      console.log(trade.entryTimestamp);
      console.log(trade.exitTimestamp);
      console.log(new Date(trade.entryTimestamp).getTime());
      console.log(new Date(trade.exitTimestamp).getTime());

      if (isNaN(entryTime) || isNaN(exitTime)) {
        console.error('Dates du trade invalides :', trade);
        return;
      }

      setTimeout(() => {
        this.renderChart(data, trade, 'tradeCandlestickChart', true, `Trade #${this.tradeId}`);
        if (alignedComparedData.length) {
          this.renderChart(alignedComparedData, trade, 'comparedCandlestickChart', false, this.comparedSymbol);
        }
      }, 0);
    });
  }

  renderChart(data: any[], trade: any, canvasId: string, annotate: boolean, label: string): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!data?.length || !trade || !canvas || !ctx) {
      console.warn('Graphique non généré : données manquantes ou invalides');
      return;
    }
    if (canvasId === 'tradeCandlestickChart' && this.chart) {
      this.chart.destroy();
    }

    if (canvasId === 'comparedCandlestickChart' && this.comparedChart) {
      this.comparedChart.destroy();
    }

    const entryTime = new Date(trade.entryTimestamp).getTime();
    const exitTime = new Date(trade.exitTimestamp).getTime();

    console.log(new Date(trade.entryTimestamp).getTime())
    console.log(new Date(trade.exitTimestamp).getTime())

    const durationMs = new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const timeUnit = durationMs < oneDay ? 'minute' : durationMs < oneDay * 7 ? 'hour' : 'day';

    const dataset = buildOhlcDataset(data, label) as any;
    if (annotate) {
      const highlightMap = this.buildEntryHighlightMap(data, trade);
      this.applyEntryHighlighting(dataset, highlightMap);
    }

    const newChart = new Chart(ctx, {
      type: 'candlestick',
      data: {
        datasets: [dataset]
      },
      options: {
        responsive: true,
        parsing: false, // Important pour les chartjs-financial
        scales: {
          x: {
            type: 'time',
            time: {
              unit: timeUnit,
              //tooltipFormat: 'yyyy-MM-dd HH:mm',
              //displayFormats: {
              //minute: 'HH:mm',
              //hour: 'HH:mm',
              //day: 'MMM dd'
              //}
            },
            ticks: {
              autoSkip: true,
              maxTicksLimit: 20
            }
          },
          y: {
            beginAtZero: false
          }
        },
        plugins: {
          annotation: annotate ? {
            annotations: buildTradeAnnotation(trade, entryTime, exitTime)
          } : undefined,
          zoom: {
            pan: {
              enabled: true,
              mode: 'x'
            },
            zoom: {
              wheel: {
                enabled: true
              },
              mode: 'x'
            }
          }
        }
      }
    });

    if (canvasId === 'tradeCandlestickChart') {
      this.chart = newChart;
    } else {
      this.comparedChart = newChart;
    }
  }

  private buildEntryHighlightMap(data: OhlcPoint[], trade: any): Map<number, 'entry' | 'intermediate'> {
    const highlightMap = new Map<number, 'entry' | 'intermediate'>();
    if (!Array.isArray(data) || !trade) {
      return highlightMap;
    }

    const sortedData = [...data].sort((a, b) => a.x - b.x);
    const stepMs = this.getMinStepMs(sortedData);
    const toleranceMs = stepMs ? stepMs / 2 : 0;

    const entryTs = this.toTimestamp(trade.entryTimestamp ?? trade.entryDate ?? trade.tsUtc);
    const entryCandle = this.findClosestCandleTs(sortedData, entryTs, toleranceMs);
    if (entryCandle != null) {
      highlightMap.set(entryCandle, 'entry');
    }

    const intermediateTimes = this.extractIntermediateEntryTimestamps(trade.intermediateEntries);
    intermediateTimes.forEach((ts) => {
      const candleTs = this.findClosestCandleTs(sortedData, ts, toleranceMs);
      if (candleTs != null && highlightMap.get(candleTs) !== 'entry') {
        highlightMap.set(candleTs, 'intermediate');
      }
    });

    return highlightMap;
  }

  private extractIntermediateEntryTimestamps(entries: any): number[] {
    if (!Array.isArray(entries)) {
      return [];
    }

    return entries
      .map((entry) => this.toTimestamp(entry?.tsUtc ?? entry?.entryTimestamp ?? entry?.entryDate ?? entry?.timestamp ?? entry))
      .filter((value): value is number => Number.isFinite(value));
  }

  private toTimestamp(value: unknown): number | null {
    if (!value) {
      return null;
    }
    const ms = new Date(value as any).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  private getMinStepMs(data: OhlcPoint[]): number | null {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 1; i < data.length; i += 1) {
      const diff = data[i].x - data[i - 1].x;
      if (diff > 0 && diff < min) {
        min = diff;
      }
    }
    return Number.isFinite(min) ? min : null;
  }

  private findClosestCandleTs(data: OhlcPoint[], target: number | null, toleranceMs: number): number | null {
    if (target == null || !Number.isFinite(target) || data.length === 0) {
      return null;
    }

    const targetValue = target;
    let lo = 0;
    let hi = data.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const value = data[mid].x;
      if (value === targetValue) {
        return value;
      }
      if (value < targetValue) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    const upper = data[Math.min(lo, data.length - 1)];
    const lower = data[Math.max(lo - 1, 0)];
    const best = Math.abs(upper.x - targetValue) < Math.abs(lower.x - targetValue) ? upper : lower;

    if (toleranceMs > 0 && Math.abs(best.x - targetValue) > toleranceMs) {
      return null;
    }
    return best.x;
  }

  private applyEntryHighlighting(dataset: any, highlightMap: Map<number, 'entry' | 'intermediate'>): void {
    const entryColor = '#2563eb';
    const intermediateColor = '#ffeb3b';
    const upColor = '#16a34a';
    const downColor = '#dc2626';

    const resolveHighlight = (ctx: any) => {
      const kind = highlightMap.get(ctx?.raw?.x);
      if (kind === 'entry') {
        return entryColor;
      }
      if (kind === 'intermediate') {
        return intermediateColor;
      }
      return null;
    };

    const resolveBase = (ctx: any) => (ctx?.raw?.c >= ctx?.raw?.o ? upColor : downColor);

    dataset.upColor = upColor;
    dataset.downColor = downColor;
    dataset.borderUpColor = upColor;
    dataset.borderDownColor = downColor;
    dataset.wickUpColor = upColor;
    dataset.wickDownColor = downColor;

    dataset.color = (ctx: any) => resolveHighlight(ctx) ?? resolveBase(ctx);
    dataset.borderColor = (ctx: any) => resolveHighlight(ctx) ?? resolveBase(ctx);
    dataset.wickColor = (ctx: any) => resolveHighlight(ctx) ?? resolveBase(ctx);
  }
}
