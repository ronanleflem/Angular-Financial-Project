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
import { catchError, forkJoin, of, throwError } from 'rxjs';

import {
  Candle,
  FilterCard,
  FilterSeriesPoint,
  HeatmapCell,
  KpiSummary,
  MarketAnalysisRowRecord,
  MarketAnalysisRunDetail,
  MarketAnalysisRunItem,
  MarketAnalysisResultMetaCard,
  MarketAnalysisRunResult,
  MarketAnalysisRunsPage,
  MarketAnalysisSpecType,
  MarketAnalysisSeasonalityRunSummary,
  SeasonalityProfile,
  StatsSummaryRow
} from '../../models/market-analysis.models';
import { FiltersService } from '../../services/filters.service';
import { MarketAnalysisRunsService } from '../../services/market-analysis-runs.service';
import { MarketStatsService } from '../../services/market-stats.service';
import {
  describeMarketAnalysisResultContractState,
  formatMarketAnalysisResultSource,
  mapMarketAnalysisHttpError
} from '../../utils/market-analysis-errors';

Chart.register(CategoryScale, LinearScale, BarController, BarElement, Tooltip, Legend, PointElement, ScatterController);

type HeatmapPoint = { x: number; y: number; value: number };

type FilterAggregate = {
  cards: FilterCard[];
  isMock: boolean;
};

type DataSectionState = 'ready' | 'empty' | 'error';

const PREFERRED_MARKET_STATS_COLUMNS = [
  'event',
  'condition',
  'target',
  'n',
  'p_hat',
  'p_mean',
  'p_map',
  'ci_low',
  'ci_high',
  'hdi_low',
  'hdi_high',
  'hdi_50_low',
  'hdi_50_high',
  'hdi_90_low',
  'hdi_90_high',
  'hdi_95_low',
  'hdi_95_high',
  'lift',
  'lift_freq',
  'lift_bayes',
  'p_value',
  'q_value',
  'significant',
  'insufficient'
] as const;

const PREFERRED_SEASONALITY_COLUMNS = [
  'spec_id',
  'profile',
  'bucket',
  'label',
  'period',
  'session',
  'month',
  'day_of_week',
  'hour',
  'n',
  'count',
  'observations',
  'avg_return',
  'mean',
  'median',
  'hit_rate',
  'win_rate',
  'p_value',
  'q_value',
  'score',
  'lift',
  'metrics'
] as const;

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
  private readonly marketAnalysisRunsService = inject(MarketAnalysisRunsService);
  private readonly filtersService = inject(FiltersService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly analysisForm = this.fb.group({
    symbol: ['EURUSD', [Validators.required]],
    venue: ['FX'],
    timeframe: ['1h', [Validators.required]],
    range: [400, [Validators.min(50), Validators.max(1000)]],
    timeframesCsv: ['15m,1h,4h'],
    runSpecType: ['market_stats'],
    runSymbol: [''],
    runTimeframe: [''],
    runStatus: [''],
    runsPageSize: [10, [Validators.min(5), Validators.max(100)]]
  });

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly lastRefreshAt = signal<Date | null>(null);
  readonly runsLoading = signal(false);
  readonly runsError = signal<string | null>(null);
  readonly runsPage = signal<MarketAnalysisRunsPage>({
    items: [],
    page: 0,
    size: 10,
    totalElements: 0,
    totalPages: 0,
    sort: 'created_at,desc'
  });
  readonly runsUpdatedAt = signal<Date | null>(null);
  readonly selectedRunId = signal<string | null>(null);
  readonly selectedRunLoading = signal(false);
  readonly selectedRunError = signal<string | null>(null);
  readonly selectedRunResultInfo = signal<string | null>(null);
  readonly selectedRunDetail = signal<MarketAnalysisRunDetail | null>(null);
  readonly selectedRunResult = signal<MarketAnalysisRunResult | null>(null);
  readonly selectedRunSpecType = computed<MarketAnalysisSpecType | null>(
    () => this.selectedRunResult()?.specType ?? this.selectedRunDetail()?.specType ?? null
  );
  readonly selectedRunHasMarketStatsView = computed(() => this.selectedRunSpecType() === 'market_stats');
  readonly selectedRunHasSeasonalityView = computed(() => this.selectedRunSpecType() === 'seasonality');
  readonly selectedRunDrivenKpisVisible = computed(() => !this.selectedRunResult());
  readonly selectedRunPatternsRows = computed(() => this.selectedRunResult()?.data.marketStatsRows ?? []);
  readonly selectedRunSeasonalityRows = computed(() => this.selectedRunResult()?.data.seasonalityProfiles ?? []);

  readonly candles = signal<Candle[]>([]);
  readonly candlesMock = signal(false);

  readonly kpis = signal<KpiSummary | null>(null);
  readonly seasonality = signal<SeasonalityProfile | null>(null);
  readonly seasonalityMock = signal(false);

  readonly statsSummary = signal<StatsSummaryRow[]>([]);
  readonly statsMock = signal(false);

  readonly filters = signal<FilterAggregate>({ cards: [], isMock: false });
  readonly sectionStates = computed(() => ({
    candles: this.resolveState(this.candles().length, this.candlesMock()),
    seasonality: this.resolveState(this.seasonalityPointsCount(), this.seasonalityMock()),
    stats: this.resolveState(this.statsSummary().length, this.statsMock()),
    filters: this.resolveState(this.filters().cards.length, this.filters().isMock)
  }));
  readonly backendBadges = [
    { id: 'candles', label: 'Candles', source: 'SPRING' },
    { id: 'seasonality', label: 'Seasonality', source: 'PYTHON' },
    { id: 'stats', label: 'Stats summary', source: 'PYTHON' },
    { id: 'filters', label: 'Filters', source: 'SPRING' }
  ] as const;
  readonly filterSparklines = computed(() => {
    const map = new Map<string, string>();
    for (const card of this.filters().cards) {
      if (card.series?.length) {
        map.set(card.id, buildSparklinePath(card.series));
      }
    }
    return map;
  });
  readonly runRangeLabel = computed(() => {
    const page = this.runsPage();
    if (!page.items.length) {
      return 'Aucun run';
    }

    const start = page.page * page.size + 1;
    const end = start + page.items.length - 1;
    return `${start}-${end} / ${page.totalElements}`;
  });
  readonly canGoToPreviousRunsPage = computed(() => this.runsPage().page > 0);
  readonly canGoToNextRunsPage = computed(() => {
    const page = this.runsPage();
    if (!page.totalPages) {
      return false;
    }
    return page.page + 1 < page.totalPages;
  });
  readonly selectedRunMetaEntries = computed(() => toKeyValueEntries(this.selectedRunDetail()?.payloadJson));
  readonly selectedRunProgressEntries = computed(() => toKeyValueEntries(this.selectedRunDetail()?.progressJson));
  readonly selectedRunMarketStatsColumns = computed(() => orderMarketStatsColumns(this.selectedRunPatternsRows()));
  readonly selectedRunSeasonalityColumns = computed(() => orderSeasonalityColumns(this.selectedRunSeasonalityRows()));
  readonly selectedSeasonalitySummaryEntries = computed(() =>
    toKeyValueEntries(this.selectedRunResult()?.data.seasonalityRunSummary ?? null)
  );
  readonly selectedRawResultEntries = computed(() => toKeyValueEntries(this.selectedRunResult()?.data.rawResultJson ?? null));
  readonly selectedRunResultSourceLabel = computed(() =>
    formatMarketAnalysisResultSource(this.selectedRunResult()?.source)
  );
  readonly selectedRunActiveTabIndex = computed(() => {
    if (this.selectedRunHasSeasonalityView()) {
      return 0;
    }
    if (this.selectedRunHasMarketStatsView()) {
      return 1;
    }
    return 0;
  });
  readonly selectedRunHasStructuredRows = computed(() =>
    this.selectedRunPatternsRows().length > 0 || this.selectedRunSeasonalityRows().length > 0
  );
  readonly selectedRunHasResultMeta = computed(() => {
    const meta = this.selectedRunResult()?.meta;
    if (!meta) {
      return false;
    }
    return Boolean(
      String(meta.specId ?? '').trim() ||
      String(meta.datasetId ?? '').trim() ||
      String(meta.window ?? '').trim() ||
      String(meta.start ?? '').trim() ||
      String(meta.end ?? '').trim()
    );
  });
  readonly selectedRunResultMetaCards = computed<MarketAnalysisResultMetaCard[]>(() => {
    const result = this.selectedRunResult();
    if (!result) {
      return [];
    }

    const cards: MarketAnalysisResultMetaCard[] = [
      { label: 'Source', value: String(result.source ?? 'inconnue') }
    ];
    const specId = String(result.meta.specId ?? '').trim();
    const datasetId = String(result.meta.datasetId ?? '').trim();
    const window = String(result.meta.window ?? '').trim();
    const start = String(result.meta.start ?? '').trim();
    const end = String(result.meta.end ?? '').trim();

    if (specId) {
      cards.push({ label: 'Spec ID', value: specId });
    }
    if (datasetId) {
      cards.push({ label: 'Dataset ID', value: datasetId });
    }
    if (window) {
      cards.push({ label: 'Window', value: window });
    } else if (result.specType === 'market_stats') {
      cards.push({ label: 'Window', value: 'Non disponible', note: 'non disponible pour ce type de run' });
    }
    if (start || end) {
      cards.push({ label: 'Range', value: `${start || '?'} -> ${end || '?'}` });
    }

    return cards;
  });
  readonly selectedRunResultMetaNote = computed(() =>
    describeMarketAnalysisResultContractState({
      source: this.selectedRunResult()?.source,
      hasStructuredRows: this.selectedRunHasStructuredRows(),
      hasRawResult: this.selectedRawResultEntries().length > 0,
      hasMeta: this.selectedRunHasResultMeta()
    })
  );
  readonly filtersPanelTitle = computed(() =>
    this.selectedRunResult() ? 'Filtres hors run selectionne' : 'Filtres actifs'
  );

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

    this.refreshData();
  }

  refreshData(): void {
    this.loadAnalysis();
    this.loadRunsPage(0);
  }

  refreshRuns(): void {
    this.loadRunsPage(0);
  }

  selectRun(runId: string): void {
    if (!runId) {
      return;
    }

    this.selectedRunId.set(runId);
    this.selectedRunLoading.set(true);
    this.selectedRunError.set(null);
    this.selectedRunResultInfo.set(null);

    forkJoin({
      detail: this.marketAnalysisRunsService.getRunDetail(runId),
      result: this.marketAnalysisRunsService.getRunResult(runId).pipe(
        catchError(error => {
          const mappedError = mapMarketAnalysisHttpError(error, 'run-result');
          if (mappedError.kind === 'result_pending') {
            this.selectedRunResultInfo.set(mappedError.message);
            return of(null);
          }
          return throwError(() => error);
        })
      )
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.selectedRunDetail.set(response.detail);
          this.selectedRunResult.set(response.result);
          if (!response.result && !this.selectedRunResultInfo()) {
            this.selectedRunResultInfo.set('Aucun resultat disponible.');
          }
          this.selectedRunLoading.set(false);
        },
        error: error => {
          const mappedError = mapMarketAnalysisHttpError(error, 'run-detail');
          console.error('Market analysis selected run loading failed', error);
          this.selectedRunLoading.set(false);
          this.selectedRunError.set(mappedError.message);
          this.selectedRunDetail.set(null);
          this.selectedRunResult.set(null);
        }
      });
  }

  loadPreviousRunsPage(): void {
    if (!this.canGoToPreviousRunsPage()) {
      return;
    }
    this.loadRunsPage(this.runsPage().page - 1);
  }

  loadNextRunsPage(): void {
    if (!this.canGoToNextRunsPage()) {
      return;
    }
    this.loadRunsPage(this.runsPage().page + 1);
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

    this.loadError.set(null);
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

          this.loading.set(false);
          this.lastRefreshAt.set(new Date());
        },
        error: error => {
          console.error('Market analysis loading failed', error);
          this.loading.set(false);
          this.loadError.set('Donnees indisponibles temporairement. Reessayez.');
          this.snackBar.open('Analyse indisponible pour le moment.', 'Fermer', {
            duration: 4000
          });
        }
      });
  }

  loadRunsPage(pageIndex: number): void {
    const { runSymbol, runTimeframe, runSpecType, runStatus, runsPageSize } = this.analysisForm.getRawValue();

    this.runsLoading.set(true);
    this.runsError.set(null);

    this.marketAnalysisRunsService
      .getRuns({
        specType: isRunSpecType(runSpecType) ? runSpecType : '',
        status: runStatus ?? '',
        symbol: runSymbol ?? '',
        timeframe: runTimeframe ?? '',
        page: Math.max(0, pageIndex),
        size: runsPageSize ?? 10,
        sort: 'created_at,desc'
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.runsPage.set(page);
          this.runsUpdatedAt.set(new Date());
          this.runsLoading.set(false);

          const currentSelectedRunId = this.selectedRunId();
          const nextSelectedRunId =
            currentSelectedRunId && page.items.some(run => run.runId === currentSelectedRunId)
              ? currentSelectedRunId
              : page.items[0]?.runId ?? null;

          if (nextSelectedRunId && nextSelectedRunId !== currentSelectedRunId) {
            this.selectRun(nextSelectedRunId);
          }
        },
        error: error => {
          const mappedError = mapMarketAnalysisHttpError(error, 'runs');
          console.error('Market analysis runs loading failed', error);
          this.runsLoading.set(false);
          this.runsError.set(mappedError.message);
          this.runsPage.set({
            items: [],
            page: Math.max(0, pageIndex),
            size: runsPageSize ?? 10,
            totalElements: 0,
            totalPages: 0,
            sort: 'created_at,desc'
          });
        }
      });
  }

  trackFilter(_index: number, card: FilterCard): string {
    return card.id;
  }

  trackRun(_index: number, run: MarketAnalysisRunItem): string {
    return run.runId;
  }

  trackStat(_index: number, row: StatsSummaryRow): string {
    return `${row.event}-${row.target}`;
  }

  runStatusClass(status: string): string {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'succeeded') {
      return 'run-state-success';
    }
    if (normalized === 'failed' || normalized === 'canceled') {
      return 'run-state-error';
    }
    if (normalized === 'running' || normalized === 'queued') {
      return 'run-state-active';
    }
    return 'run-state-neutral';
  }

  formatRunSpecType(specType: string): string {
    return specType === 'market_stats' ? 'Market stats' : specType === 'seasonality' ? 'Seasonality' : specType;
  }

  isSelectedRun(runId: string): boolean {
    return this.selectedRunId() === runId;
  }

  getRowValue(row: MarketAnalysisRowRecord, key: string): string {
    return formatDisplayValue(row[key]);
  }

  getSeasonalityRowValue(row: MarketAnalysisRowRecord, key: string): string {
    return formatSeasonalityDisplayValue(row[key], key);
  }

  isSeasonalityMetricsValue(row: MarketAnalysisRowRecord, key: string): boolean {
    return key === 'metrics' && isRecordValue(row[key]);
  }

  getSeasonalityMetricsSummary(row: MarketAnalysisRowRecord, key: string): string {
    return summarizeSeasonalityMetrics(row[key]);
  }

  getSeasonalityMetricsEntries(row: MarketAnalysisRowRecord, key: string): KeyValueEntry[] {
    return toSeasonalityKeyValueEntries(asRecordValue(row[key]));
  }

  getSeasonalityMetricGroups(row: MarketAnalysisRowRecord, key: string): SeasonalityMetricGroup[] {
    return groupSeasonalityMetrics(this.getSeasonalityMetricsEntries(row, key));
  }

  seasonalityMetricGroupClass(group: SeasonalityMetricGroup): string {
    return `seasonality-metrics-group--${group.id}`;
  }

  seasonalityMetricGroupStyle(group: SeasonalityMetricGroup): string {
    switch (group.id) {
      case 'p':
        return 'background:#eff6ff;';
      case 'ret':
        return 'background:#f0fdf4;';
      case 'amp':
        return 'background:#fff7ed;';
      default:
        return 'background:#f8fafc;';
    }
  }

  marketStatsColumnLabel(column: string): string {
    switch (column) {
      case 'p_hat':
        return 'p_hat';
      case 'p_value':
        return 'p_value';
      case 'q_value':
        return 'q_value';
      default:
        return humanizeColumnName(column);
    }
  }

  seasonalityColumnLabel(column: string): string {
    switch (column) {
      case 'spec_id':
        return 'Spec Id';
      case 'avg_return':
        return 'Avg Return';
      case 'p_value':
        return 'p_value';
      case 'q_value':
        return 'q_value';
      default:
        return humanizeColumnName(column);
    }
  }

  seasonalityMetricLabel(key: string): string {
    return humanizeColumnName(key);
  }

  getMarketStatsRowValue(row: MarketAnalysisRowRecord, key: string): string {
    return formatMarketStatsDisplayValue(row[key], key);
  }

  trackEntry(_index: number, entry: KeyValueEntry): string {
    return entry.key;
  }


  sectionStateClass(state: DataSectionState): string {
    switch (state) {
      case 'ready':
        return 'state-ready';
      case 'empty':
        return 'state-empty';
      default:
        return 'state-error';
    }
  }

  sectionStateLabel(state: DataSectionState): string {
    switch (state) {
      case 'ready':
        return 'Ready';
      case 'empty':
        return 'Empty';
      default:
        return 'Error';
    }
  }

  private seasonalityPointsCount(): number {
    const profile = this.seasonality();
    if (!profile) {
      return 0;
    }
    return profile.byMonth.length + profile.byDow.length + profile.byHour.length;
  }

  private resolveState(itemCount: number, isMock: boolean): DataSectionState {
    if (this.loadError()) {
      return 'error';
    }
    if (itemCount === 0) {
      return 'empty';
    }
    return 'ready';
  }
  private notifyMock(section: string): void {
    this.snackBar.open(`${section} alimenté avec les données mock.`, 'OK', {
      duration: 2500
    });
  }
}

function isRunSpecType(value: string | null): value is 'market_stats' | 'seasonality' {
  return value === 'market_stats' || value === 'seasonality';
}

type KeyValueEntry = {
  key: string;
  value: string;
};

type SeasonalityMetricGroup = {
  id: 'p' | 'ret' | 'amp' | 'other';
  label: 'P' | 'Ret' | 'Amp' | 'Other';
  entries: KeyValueEntry[];
};

function toKeyValueEntries(payload: Record<string, unknown> | MarketAnalysisSeasonalityRunSummary | null | undefined): KeyValueEntry[] {
  if (!payload) {
    return [];
  }

  return Object.entries(payload).map(([key, value]) => ({
    key,
    value: formatDisplayValue(value)
  }));
}

function toSeasonalityKeyValueEntries(payload: Record<string, unknown> | null | undefined): KeyValueEntry[] {
  if (!payload) {
    return [];
  }

  return Object.entries(payload).map(([key, value]) => ({
    key,
    value: formatSeasonalityDisplayValue(value, key)
  }));
}

function groupSeasonalityMetrics(entries: KeyValueEntry[]): SeasonalityMetricGroup[] {
  const groups: SeasonalityMetricGroup[] = [
    { id: 'p', label: 'P', entries: [] },
    { id: 'ret', label: 'Ret', entries: [] },
    { id: 'amp', label: 'Amp', entries: [] },
    { id: 'other', label: 'Other', entries: [] }
  ];

  for (const entry of entries) {
    const label = humanizeColumnName(entry.key).toLowerCase();
    if (label.startsWith('p ')) {
      groups[0].entries.push(entry);
    } else if (label.startsWith('ret ')) {
      groups[1].entries.push(entry);
    } else if (label.startsWith('amp ')) {
      groups[2].entries.push(entry);
    } else {
      groups[3].entries.push(entry);
    }
  }

  return groups;
}

function collectRowKeys(rows: MarketAnalysisRowRecord[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

function orderMarketStatsColumns(rows: MarketAnalysisRowRecord[]): string[] {
  const keys = collectRowKeys(rows);
  if (keys.length === 0) {
    return [];
  }
  const preferred = new Set<string>(PREFERRED_MARKET_STATS_COLUMNS);
  const ordered = PREFERRED_MARKET_STATS_COLUMNS.filter(key => keys.includes(key));
  const remaining = keys
    .filter(key => !preferred.has(key))
    .sort((left, right) => left.localeCompare(right));
  return [...ordered, ...remaining];
}

function orderSeasonalityColumns(rows: MarketAnalysisRowRecord[]): string[] {
  const keys = collectRowKeys(rows);
  if (keys.length === 0) {
    return [];
  }
  const preferred = new Set<string>(PREFERRED_SEASONALITY_COLUMNS);
  const ordered = PREFERRED_SEASONALITY_COLUMNS.filter(key => keys.includes(key));
  const remaining = keys
    .filter(key => !preferred.has(key))
    .sort((left, right) => left.localeCompare(right));
  return [...ordered, ...remaining];
}

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatSeasonalityDisplayValue(value: unknown, key: string): string {
  if (key === 'metrics' && isRecordValue(value)) {
    return summarizeSeasonalityMetrics(value);
  }
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(4).replace(/\.?0+$/, '');
  }
  if (typeof value === 'string') {
    return isDateLikeKey(key) && isIsoDateString(value) ? formatDateTimeDisplayValue(value) : value;
  }
  return formatDisplayValue(value);
}

function formatMarketStatsDisplayValue(value: unknown, key: string): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    if (key === 'n') {
      return String(value);
    }
    if (Number.isInteger(value) && Math.abs(value) >= 100) {
      return String(value);
    }
    return value.toFixed(4).replace(/\.?0+$/, '');
  }
  return formatDisplayValue(value);
}

function summarizeSeasonalityMetrics(value: unknown): string {
  const record = asRecordValue(value);
  if (!record) {
    return formatSeasonalityDisplayValue(value, 'metrics');
  }
  const entries = Object.entries(record);
  if (entries.length === 0) {
    return '-';
  }
  return entries
    .slice(0, 3)
    .map(([key, entryValue]) => `${humanizeColumnName(key)}: ${formatSeasonalityDisplayValue(entryValue, key)}`)
    .join(' | ');
}

function humanizeColumnName(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function asRecordValue(value: unknown): Record<string, unknown> | null {
  return isRecordValue(value) ? value : null;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDateLikeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes('date') || normalized.endsWith('_at') || normalized === 'start' || normalized === 'end';
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:[tT ][\d:.+-zZ]*)?$/.test(value) && !Number.isNaN(Date.parse(value));
}

function formatDateTimeDisplayValue(value: string): string {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const hasTime = /[tT ]\d{2}:\d{2}/.test(value);
  return hasTime ? `${year}-${month}-${day} ${hours}:${minutes} UTC` : `${year}-${month}-${day}`;
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




