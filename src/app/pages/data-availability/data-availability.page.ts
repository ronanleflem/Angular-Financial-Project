import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule, MatDrawer } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, map, startWith } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { DataCatalogService } from '../../services/data-catalog.service';
import { DataSeries, SaveRangeRequest, SaveResult, SymbolRef, Candle } from '../../models/data-catalog.models';
import { SymbolService } from '../../services/symbol.service';
import { DEFAULT_SYMBOLS } from '../../mocks/data-catalog.mocks';

interface HistogramBucket {
  day: string;
  coverage: number;
}

interface GapDetail {
  start: string;
  end: string;
  missing: number;
}

@Component({
  selector: 'app-data-availability-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatCardModule,
    MatStepperModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
  templateUrl: './data-availability.page.html',
  styleUrls: ['./data-availability.page.scss'],
})
export class DataAvailabilityPageComponent implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dataCatalog = inject(DataCatalogService);
  private readonly symbolService = inject(SymbolService);

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatDrawer) drawer?: MatDrawer;

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    broker: [''],
    marketType: [''],
    symbol: [''],
    timeframe: [''],
    start: [null as Date | null],
    end: [null as Date | null],
    columns: [['start', 'end', 'count', 'coveragePct', 'gapsPct', 'sessions', 'tz', 'updatedAt', 'source'] as string[]],
  });

  readonly stepOne = this.fb.nonNullable.group({
    broker: ['', Validators.required],
    marketType: [''],
    venue: [''],
    source: ['API' as SaveRangeRequest['source'], Validators.required],
  });

  readonly stepTwo = this.fb.group({
    symbol: ['', Validators.required],
    timeframe: ['', Validators.required],
    start: [null as Date | null, Validators.required],
    end: [null as Date | null, Validators.required],
    timezone: ['UTC'],
    conflictPolicy: ['merge'],
    rollover: ['date'],
  });

  readonly scanAfterSave = new FormControl(true, { nonNullable: true });

  readonly dataSource = new MatTableDataSource<DataSeries>([]);
  readonly allColumns = [
    { key: 'symbol', label: 'Symbole', locked: true },
    { key: 'broker', label: 'Broker/Source', locked: true },
    { key: 'venue', label: 'Venue', locked: false },
    { key: 'timeframe', label: 'Timeframe', locked: true },
    { key: 'start', label: 'Date début', locked: false },
    { key: 'end', label: 'Date fin', locked: false },
    { key: 'count', label: 'Nb bougies', locked: false },
    { key: 'coveragePct', label: 'Couverture %', locked: false },
    { key: 'gapsPct', label: 'Gaps %', locked: false },
    { key: 'sessions', label: 'Sessions', locked: false },
    { key: 'tz', label: 'Timezone', locked: false },
    { key: 'updatedAt', label: 'Dernière MAJ', locked: false },
    { key: 'source', label: 'Source', locked: false },
    { key: 'actions', label: 'Actions', locked: true },
  ] as const;

  readonly lockedColumns = new Set(this.allColumns.filter(c => c.locked).map(c => c.key));
  readonly visibleColumns = signal<Set<string>>(
    new Set(this.allColumns.map(c => c.key))
  );
  readonly columnLabels = this.allColumns.reduce<Record<string, string>>((acc, col) => {
    acc[col.key] = col.label;
    return acc;
  }, {});

  readonly timeframePresets = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];
  readonly brokers = ['Binance', 'MEXC', 'IBKR', 'Databento CSV', 'CSV TradingView', 'Autre'];
  readonly marketTypes = ['FX', 'Crypto', 'Equity', 'ETF', 'Futures'];

  symbols: SymbolRef[] = [];
  filteredSymbols$!: Observable<SymbolRef[]>;
  filteredStepSymbols$!: Observable<SymbolRef[]>;

  private seriesCache: DataSeries[] = [];
  loading = signal(false);
  detailsLoading = signal(false);
  savingRange = signal(false);

  selectedSeries?: DataSeries;
  detailCoverage?: { coverage: number; gaps?: number };
  detailHistogram: HistogramBucket[] = [];
  topGaps: GapDetail[] = [];

  ngOnInit(): void {
    this.symbolService
      .getAll()
      .pipe(takeUntilDestroyed())
      .subscribe(list => {
        this.symbols = list.length ? list : DEFAULT_SYMBOLS;
        this.setupAutocomplete();
      });

    this.filtersForm.controls.columns.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(selection => {
        const locked = new Set(this.lockedColumns);
        const merged = new Set<string>([...locked, ...selection]);
        this.visibleColumns.set(merged);
      });

    this.filtersForm.controls.search.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe(() => this.applyFilters());

    this.filtersForm.controls.start.valueChanges
      .pipe(debounceTime(100), takeUntilDestroyed())
      .subscribe(() => this.applyFilters());

    this.filtersForm.controls.end.valueChanges
      .pipe(debounceTime(100), takeUntilDestroyed())
      .subscribe(() => this.applyFilters());

    const fetchTriggers = [
      this.filtersForm.controls.broker.valueChanges,
      this.filtersForm.controls.marketType.valueChanges,
      this.filtersForm.controls.symbol.valueChanges,
      this.filtersForm.controls.timeframe.valueChanges,
    ];

    fetchTriggers.forEach(stream =>
      stream.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.refresh())
    );

    this.dataSource.filterPredicate = (data, filter) => {
      const normalized = filter.trim().toLowerCase();
      if (!normalized) {
        return true;
      }
      const haystack = [
        data.symbol,
        data.broker,
        data.timeframe,
        data.venue ?? '',
        data.sessions ?? '',
        data.tz ?? '',
        data.source,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    };

    this.refresh();
  }

  ngAfterViewInit(): void {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  get displayedColumns(): string[] {
    return this.allColumns
      .map(col => col.key)
      .filter(key => this.visibleColumns().has(key));
  }

  refresh(): void {
    const { broker, marketType, symbol, timeframe } = this.filtersForm.getRawValue();
    this.loading.set(true);
    this.dataCatalog
      .listSeriesAvailability({ broker: broker || undefined, marketType: marketType || undefined, symbol: symbol || undefined, timeframe: timeframe || undefined })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: series => {
          this.seriesCache = series;
          this.applyFilters();
          this.loading.set(false);
        },
        error: err => {
          console.error('Failed to load series availability', err);
          this.seriesCache = [];
          this.applyFilters();
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    let filtered = [...this.seriesCache];
    const { start, end, search } = this.filtersForm.getRawValue();

    if (start instanceof Date) {
      const startMs = start.getTime();
      filtered = filtered.filter(item => new Date(item.start).getTime() >= startMs);
    }

    if (end instanceof Date) {
      const endMs = end.getTime();
      filtered = filtered.filter(item => new Date(item.end).getTime() <= endMs);
    }

    this.dataSource.data = filtered;
    const searchValue = (search ?? '').toLowerCase();
    this.dataSource.filter = searchValue;

    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  openDetails(row: DataSeries): void {
    this.selectedSeries = row;
    this.detailHistogram = [];
    this.topGaps = [];
    this.detailCoverage = undefined;
    this.detailsLoading.set(true);
    this.drawer?.open();

    this.dataCatalog
      .probeSeries(row.symbol, row.timeframe)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: candles => {
          const coverage = this.dataCatalog.computeCoverage(candles, row.timeframe);
          this.detailCoverage = { coverage: coverage.coveragePct, gaps: coverage.gapsPct };
          this.detailHistogram = this.buildHistogram(candles);
          this.topGaps = this.extractTopGaps(candles, row.timeframe);
          this.detailsLoading.set(false);
        },
        error: err => {
          console.error('Failed to probe series', err);
          this.detailHistogram = [];
          this.detailsLoading.set(false);
        },
      });
  }

  closeDetails(): void {
    this.drawer?.close();
    this.selectedSeries = undefined;
    this.detailHistogram = [];
    this.topGaps = [];
  }

  scanGaps(series: DataSeries): void {
    this.dataCatalog
      .probeSeries(series.symbol, series.timeframe)
      .pipe(takeUntilDestroyed())
      .subscribe(candles => {
        const coverage = this.dataCatalog.computeCoverage(candles, series.timeframe);
        const updated: DataSeries = {
          ...series,
          start: coverage.start,
          end: coverage.end,
          count: coverage.count,
          coveragePct: coverage.coveragePct,
          gapsPct: coverage.gapsPct,
          updatedAt: new Date().toISOString(),
          source: series.source ?? 'API',
        };
        this.upsertSeries(updated);
        this.snackBar.open('Analyse des gaps terminée', 'Fermer', { duration: 3000 });
      });
  }

  exportCsv(): void {
    const columns = this.displayedColumns.filter(col => col !== 'actions');
    const header = columns.map(col => this.columnLabels[col] ?? col);
    const rows = this.dataSource.data.map(series =>
      columns
        .map(column => this.formatCell(series, column))
        .map(value => `"${value.replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data-availability.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  showHelp(): void {
    this.snackBar.open('Renseignez les filtres pour rafraîchir la table et utilisez le formulaire pour ingérer de nouvelles plages.', 'OK', {
      duration: 5000,
    });
  }

  onSaveRange(scanAfter: boolean): void {
    if (this.stepOne.invalid || this.stepTwo.invalid) {
      this.stepOne.markAllAsTouched();
      this.stepTwo.markAllAsTouched();
      return;
    }
    const stepOneValue = this.stepOne.getRawValue();
    const stepTwoValue = this.stepTwo.getRawValue();

    const payload: SaveRangeRequest = {
      broker: stepOneValue.broker,
      source: stepOneValue.source,
      symbol: stepTwoValue.symbol!,
      timeframe: stepTwoValue.timeframe!,
      start: this.toIsoString(stepTwoValue.start),
      end: this.toIsoString(stepTwoValue.end),
      venue: stepOneValue.venue || undefined,
      timezone: stepTwoValue.timezone || undefined,
      conflictPolicy: (stepTwoValue.conflictPolicy || undefined) as SaveRangeRequest['conflictPolicy'],
      rollover: (stepTwoValue.rollover || undefined) as SaveRangeRequest['rollover'],
    };

    this.savingRange.set(true);
    this.dataCatalog
      .saveRange(payload)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: result => this.handleSaveResult(result, payload, scanAfter),
        error: err => {
          console.error('Save range failed', err);
          this.handleSaveResult({ ok: true, mock: true, message: 'Saved (mock fallback)' }, payload, scanAfter);
        },
        complete: () => this.savingRange.set(false),
      });
  }

  resetForm(): void {
    this.stepOne.reset({ broker: '', marketType: '', venue: '', source: 'API' });
    this.stepTwo.reset({ symbol: '', timeframe: '', start: null, end: null, timezone: 'UTC', conflictPolicy: 'merge', rollover: 'date' });
    this.scanAfterSave.setValue(true);
  }

  private handleSaveResult(result: SaveResult, payload: SaveRangeRequest, scanAfter: boolean): void {
    this.savingRange.set(false);
    const message = result.mock ? result.message ?? 'Sauvegarde simulée' : result.message ?? 'Sauvegarde déclenchée';
    this.snackBar.open(message, 'Fermer', { duration: 4000 });

    if (!result.ok) {
      return;
    }

    const newSeries: DataSeries = {
      symbol: payload.symbol,
      broker: payload.broker,
      timeframe: payload.timeframe,
      start: payload.start,
      end: payload.end,
      count: 0,
      coveragePct: 0,
      sessions: '-',
      tz: payload.timezone ?? 'UTC',
      updatedAt: new Date().toISOString(),
      source: result.mock ? 'Mock' : payload.source,
    };

    this.upsertSeries(newSeries);

    if (scanAfter) {
      this.scanGaps(newSeries);
    }
  }

  private upsertSeries(series: DataSeries): void {
    const existingIndex = this.seriesCache.findIndex(item => item.symbol === series.symbol && item.timeframe === series.timeframe && item.broker === series.broker);
    if (existingIndex >= 0) {
      this.seriesCache.splice(existingIndex, 1, { ...this.seriesCache[existingIndex], ...series });
    } else {
      this.seriesCache = [series, ...this.seriesCache];
    }
    this.applyFilters();
  }

  private setupAutocomplete(): void {
    this.filteredSymbols$ = this.filtersForm.controls.symbol.valueChanges.pipe(
      startWith(this.filtersForm.controls.symbol.value ?? ''),
      map(value => this.filterSymbols(value || ''))
    );

    this.filteredStepSymbols$ = this.stepTwo.controls.symbol.valueChanges.pipe(
      startWith(this.stepTwo.controls.symbol.value ?? ''),
      map(value => this.filterSymbols((value as string) || ''))
    );
  }

  private filterSymbols(value: string): SymbolRef[] {
    const search = value.toLowerCase();
    return this.symbols.filter(symbol =>
      symbol.ticker.toLowerCase().includes(search) || (symbol.name ?? '').toLowerCase().includes(search)
    );
  }

  getBrokerClass(broker: string): string {
    const lower = (broker ?? '').toLowerCase();
    if (lower.includes('binance')) {
      return 'broker-binance';
    }
    if (lower.includes('mexc')) {
      return 'broker-mexc';
    }
    if (lower.includes('ibkr')) {
      return 'broker-ibkr';
    }
    if (lower.includes('csv') || lower.includes('databento')) {
      return 'broker-csv';
    }
    return 'broker-generic';
  }

  private buildHistogram(candles: Candle[]): HistogramBucket[] {
    if (!candles.length) {
      return [];
    }
    const buckets = new Map<string, number>();
    candles.forEach(candle => {
      const day = new Date(candle.t).toISOString().slice(0, 10);
      buckets.set(day, (buckets.get(day) ?? 0) + 1);
    });
    const entries = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const recent = entries.slice(-30);
    const max = Math.max(...recent.map(([, count]) => count), 1);
    return recent.map(([day, count]) => ({ day, coverage: Math.round((count / max) * 100) }));
  }

  private extractTopGaps(candles: Candle[], timeframe: string): GapDetail[] {
    if (candles.length < 2) {
      return [];
    }
    const sorted = [...candles].sort((a, b) => a.t - b.t);
    const frameMs = this.timeframeToMs(timeframe) || 0;
    const gaps: GapDetail[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const current = sorted[i];
      const diff = current.t - prev.t;
      if (frameMs > 0 && diff > frameMs * 1.5) {
        const missing = Math.round(diff / frameMs) - 1;
        gaps.push({ start: new Date(prev.t).toISOString(), end: new Date(current.t).toISOString(), missing });
      }
    }
    return gaps.sort((a, b) => b.missing - a.missing).slice(0, 5);
  }

  private timeframeToMs(timeframe: string): number {
    const match = timeframe?.match(/^(\d+)([smhdw])$/i);
    if (!match) {
      return 0;
    }
    const value = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'w':
        return value * 7 * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  private toIsoString(value: Date | null): string {
    if (!value) {
      return new Date().toISOString();
    }
    return new Date(value).toISOString();
  }

  private formatCell(series: DataSeries, column: string): string {
    switch (column) {
      case 'coveragePct':
      case 'gapsPct':
        return series[column] != null ? `${Number(series[column]).toFixed(2)}%` : '';
      case 'start':
      case 'end':
      case 'updatedAt':
        return series[column] ? new Date(series[column]).toISOString() : '';
      default: {
        const record = series as unknown as Record<string, unknown>;
        return String(record[column] ?? '');
      }
    }
  }
}

