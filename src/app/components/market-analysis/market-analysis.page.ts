import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  Legend,
  LinearScale,
  PointElement,
  ScatterController,
  Tooltip
} from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { forkJoin } from 'rxjs';

import {
  Candle,
  FilterCard,
  FilterSeriesPoint,
  HeatmapCell,
  KpiSummary,
  SeasonalityProfile,
  StatsSummaryRow
} from '../../models/market-analysis.models';
import { FiltersService } from '../../services/filters.service';
import { MarketStatsService } from '../../services/market-stats.service';

Chart.register(CategoryScale, LinearScale, BarController, BarElement, Tooltip, Legend, PointElement, ScatterController);

type HeatmapPoint = { x: number; y: number; value: number };

type FilterAggregate = {
  cards: FilterCard[];
  isMock: boolean;
};

@Component({
  selector: 'app-market-analysis-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatDividerModule,
    NgChartsModule
  ],
  templateUrl: './market-analysis.page.html',
  styleUrls: ['./market-analysis.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarketAnalysisPage {
  private readonly marketStatsService = inject(MarketStatsService);
  private readonly filtersService = inject(FiltersService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly analysisForm = this.fb.group({
    symbol: ['EURUSD', [Validators.required]],
    venue: ['FX'],
    timeframe: ['1h', [Validators.required]],
    range: [400, [Validators.min(50), Validators.max(1000)]],
    timeframesCsv: ['15m,1h,4h']
  });

  readonly loading = signal(false);

  readonly candles = signal<Candle[]>([]);
  readonly candlesMock = signal(false);

  readonly kpis = signal<KpiSummary | null>(null);
  readonly seasonality = signal<SeasonalityProfile | null>(null);
  readonly seasonalityMock = signal(false);

  readonly statsSummary = signal<StatsSummaryRow[]>([]);
  readonly statsMock = signal(false);

  readonly filters = signal<FilterAggregate>({ cards: [], isMock: false });
  readonly filterSparklines = computed(() => {
    const map = new Map<string, string>();
    for (const card of this.filters().cards) {
      if (card.series?.length) {
        map.set(card.id, buildSparklinePath(card.series));
      }
    }
    return map;
  });

  readonly monthChartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const profile = this.seasonality();
    return {
      type: 'bar',
      data: {
        labels: profile?.byMonth.map(bar => bar.label) ?? [],
        datasets: [
          {
            label: 'Performance (%)',
            data: profile?.byMonth.map(bar => bar.value) ?? [],
            backgroundColor: '#6366f1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    } satisfies ChartConfiguration<'bar'>;
  });

  readonly dowChartConfig = computed<ChartConfiguration<'bar'>>(() => {
    const profile = this.seasonality();
    return {
      type: 'bar',
      data: {
        labels: profile?.byDow.map(bar => bar.label) ?? [],
        datasets: [
          {
            label: 'Performance (%)',
            data: profile?.byDow.map(bar => bar.value) ?? [],
            backgroundColor: '#22d3ee'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    } satisfies ChartConfiguration<'bar'>;
  });

  readonly heatmapChartConfig = computed<ChartConfiguration<'scatter', HeatmapPoint[], number>>(() => {
    const profile = this.seasonality();
    const dataPoints: HeatmapPoint[] = profile?.byHour.map((cell: HeatmapCell) => ({
      x: cell.hour,
      y: cell.dow,
      value: cell.value
    })) ?? [];

    const dowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Hourly Heatmap',
            data: dataPoints,
            pointRadius: 18,
            pointHoverRadius: 18,
            pointBackgroundColor: ctx => {
              const raw = ctx.raw as HeatmapPoint | undefined;
              return heatmapColor(raw?.value ?? 0);
            },
            pointStyle: 'rectRounded',
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                const raw = context.raw as HeatmapPoint;
                return `D${raw.y + 1} H${raw.x}: ${raw.value.toFixed(0)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            suggestedMin: -0.5,
            suggestedMax: 23.5,
            ticks: {
              callback: value => `${value}h`
            }
          },
          y: {
            beginAtZero: true,
            suggestedMin: -0.5,
            suggestedMax: 6.5,
            ticks: {
              callback: value => dowLabels[Number(value)] ?? ''
            }
          }
        }
      }
    } satisfies ChartConfiguration<'scatter', HeatmapPoint[], number>;
  });

  constructor() {
    effect(() => {
      if (!this.loading()) {
        this.kpis.set(this.marketStatsService.computeKpisFromCandles(this.candles()));
      }
    });

    this.loadAnalysis();
  }

  loadAnalysis(): void {
    if (this.analysisForm.invalid) {
      this.snackBar.open('Veuillez renseigner un symbole et un timeframe valides.', 'Fermer', {
        duration: 3000
      });
      return;
    }

    const { symbol, timeframe, timeframesCsv, range } = this.analysisForm.getRawValue();
    const parsedSymbol = symbol ?? 'EURUSD';
    const parsedTimeframe = timeframe ?? '1h';
    const parsedMulti = timeframesCsv ?? '15m,1h,4h';
    const startIso = computeStartDate(range ?? 0, parsedTimeframe);

    this.loading.set(true);

    forkJoin({
      candles: this.marketStatsService.getCandles(parsedSymbol, parsedTimeframe, startIso),
      seasonality: this.marketStatsService.getSeasonality(parsedSymbol, parsedTimeframe),
      stats: this.marketStatsService.getStatsSummary({ symbol: parsedSymbol, timeframe: parsedTimeframe }),
      multi: this.filtersService.getMultiTFStats(parsedSymbol, parsedMulti),
      benford: this.filtersService.getBenford(parsedSymbol, parsedTimeframe),
      liquidity: this.filtersService.getGenericFilter<FilterCard[]>(
        'liquidity',
        { symbol: parsedSymbol, timeframe: parsedTimeframe }
      )
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.candles.set(result.candles.data);
          this.candlesMock.set(result.candles.isMock);
          this.seasonality.set(result.seasonality.data);
          this.seasonalityMock.set(result.seasonality.isMock);
          this.statsSummary.set(result.stats.data);
          this.statsMock.set(result.stats.isMock);

          const multiCards = Array.isArray(result.multi.data)
            ? result.multi.data
            : result.multi.data
              ? [result.multi.data as FilterCard]
              : [];

          const liquidityCards = Array.isArray(result.liquidity.data)
            ? result.liquidity.data
            : result.liquidity.data
              ? [result.liquidity.data as unknown as FilterCard]
              : [];

          const combinedFilters = [
            result.benford.data,
            ...multiCards,
            ...liquidityCards
          ].filter(
            (card): card is FilterCard =>
              !!card && typeof card.id === 'string' && card.id.length > 0
          );

          this.filters.set({
            cards: combinedFilters,
            isMock:
              result.multi.isMock ||
              result.benford.isMock ||
              result.liquidity.isMock
          });

          this.filters.set({
            cards: combinedFilters,
            isMock:
              result.multi.isMock ||
              result.benford.isMock ||
              result.liquidity.isMock
          });

          this.loading.set(false);

          if (result.candles.isMock) {
            this.notifyMock('Bougies (candles)');
          }
          if (result.seasonality.isMock) {
            this.notifyMock('Saisonnalité');
          }
          if (result.stats.isMock) {
            this.notifyMock('Patterns & Probabilités');
          }
          if (this.filters().isMock) {
            this.notifyMock('Filtres');
          }
        },
        error: error => {
          console.error('Market analysis loading failed', error);
          this.loading.set(false);
          this.snackBar.open('Analyse indisponible pour le moment. Mocks chargés.', 'Fermer', {
            duration: 4000
          });
        }
      });
  }

  trackFilter(_index: number, card: FilterCard): string {
    return card.id;
  }

  trackStat(_index: number, row: StatsSummaryRow): string {
    return `${row.event}-${row.target}`;
  }

  private notifyMock(section: string): void {
    this.snackBar.open(`${section} alimenté avec les données mock.`, 'OK', {
      duration: 2500
    });
  }
}

function heatmapColor(value: number): string {
  const min = 0;
  const max = 100;
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const hue = (1 - ratio) * 220;
  return `hsl(${hue}, 85%, 55%)`;
}

function buildSparklinePath(series: FilterSeriesPoint[]): string {
  if (!series.length) {
    return '';
  }

  const values = series.map(point => point.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const lastIndex = series.length - 1 || 1;

  return series
    .map((point, index) => {
      const x = (index / lastIndex) * 100;
      const y = 100 - ((point.v - min) / range) * 100;
      const command = index === 0 ? 'M' : 'L';
      return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function computeStartDate(range: number, timeframe: string): string | undefined {
  if (!range || range <= 0) {
    return undefined;
  }
  const interval = timeframeToMs(timeframe);
  if (!interval) {
    return undefined;
  }

  const start = new Date(Date.now() - range * interval);
  return start.toISOString();
}

function timeframeToMs(timeframe: string): number | undefined {
  switch (timeframe) {
    case '15m':
      return 15 * 60 * 1000;
    case '1h':
      return 60 * 60 * 1000;
    case '4h':
      return 4 * 60 * 60 * 1000;
    case '1d':
      return 24 * 60 * 60 * 1000;
    default:
      return undefined;
  }
}
