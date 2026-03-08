import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { catchError, forkJoin, of, throwError } from 'rxjs';

import {
  MarketAnalysisRowRecord,
  MarketAnalysisResultMetaCard,
  MarketAnalysisRunDetail,
  MarketAnalysisRunItem,
  MarketAnalysisRunResult,
  MarketAnalysisRunsPage,
  MarketAnalysisSeasonalityRunSummary,
  MarketAnalysisSpecType
} from '../../models/market-analysis.models';
import { MarketAnalysisRunsService } from '../../services/market-analysis-runs.service';
import {
  describeMarketAnalysisResultContractState,
  formatMarketAnalysisResultSource,
  mapMarketAnalysisHttpError
} from '../../utils/market-analysis-errors';

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

type KeyValueEntry = {
  key: string;
  value: string;
};

type SeasonalityMetricGroup = {
  id: 'p' | 'ret' | 'amp' | 'other';
  label: 'P' | 'Ret' | 'Amp' | 'Other';
  entries: KeyValueEntry[];
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
    MatProgressBarModule,
    MatDividerModule
  ],
  templateUrl: './market-analysis.page.html',
  styleUrls: ['./market-analysis.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarketAnalysisPage {
  private readonly marketAnalysisRunsService = inject(MarketAnalysisRunsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly analysisForm = this.fb.group({
    runSpecType: ['market_stats'],
    runSymbol: [''],
    runTimeframe: [''],
    runStatus: [''],
    runsPageSize: [10, [Validators.min(5), Validators.max(100)]]
  });

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
  readonly selectedRunPatternsRows = computed(() => this.selectedRunResult()?.data.marketStatsRows ?? []);
  readonly selectedRunSeasonalityRows = computed(() => this.selectedRunResult()?.data.seasonalityProfiles ?? []);
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
  readonly selectedRunResultSourceLabel = computed(() => formatMarketAnalysisResultSource(this.selectedRunResult()?.source));
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

  constructor() {
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

  trackRun(_index: number, run: MarketAnalysisRunItem): string {
    return run.runId;
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

  getSeasonalityMetricGroups(row: MarketAnalysisRowRecord, key: string): SeasonalityMetricGroup[] {
    return groupSeasonalityMetrics(toSeasonalityKeyValueEntries(asRecordValue(row[key])));
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
}

function isRunSpecType(value: string | null): value is 'market_stats' | 'seasonality' {
  return value === 'market_stats' || value === 'seasonality';
}

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
  const remaining = keys.filter(key => !preferred.has(key)).sort((left, right) => left.localeCompare(right));
  return [...ordered, ...remaining];
}

function orderSeasonalityColumns(rows: MarketAnalysisRowRecord[]): string[] {
  const keys = collectRowKeys(rows);
  if (keys.length === 0) {
    return [];
  }
  const preferred = new Set<string>(PREFERRED_SEASONALITY_COLUMNS);
  const ordered = PREFERRED_SEASONALITY_COLUMNS.filter(key => keys.includes(key));
  const remaining = keys.filter(key => !preferred.has(key)).sort((left, right) => left.localeCompare(right));
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
