import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';

import {
  ApiResult,
  Candle,
  FilterCard,
  KpiSummary,
  MarketAnalysisRunDetail,
  MarketAnalysisRunResult,
  MarketAnalysisRunsPage,
  SeasonalityProfile,
  StatsSummaryRow
} from '../../models/market-analysis.models';
import { FiltersService } from '../../services/filters.service';
import { MarketAnalysisRunsService } from '../../services/market-analysis-runs.service';
import { MarketStatsService } from '../../services/market-stats.service';
import { MarketAnalysisPage } from './market-analysis.page';

describe('MarketAnalysisPage', () => {
  let fixture: ComponentFixture<MarketAnalysisPage>;
  let component: MarketAnalysisPage;
  let marketStatsSpy: jasmine.SpyObj<MarketStatsService>;
  let marketAnalysisRunsSpy: jasmine.SpyObj<MarketAnalysisRunsService>;
  let filtersSpy: jasmine.SpyObj<FiltersService>;
  let snackBarSpy: jasmine.SpyObj<MatSnackBar>;

  const mockCandles: Candle[] = [
    {
      timestamp: '2024-01-01T00:00:00Z',
      open: 1.1,
      high: 1.2,
      low: 1.05,
      close: 1.15,
      volume: 1200
    }
  ];

  const mockSeasonality: SeasonalityProfile = {
    byMonth: [],
    byDow: [],
    byHour: []
  };

  const mockStats: StatsSummaryRow[] = [
    {
      event: 'breakout',
      target: 'up',
      n: 10,
      pHat: 0.42,
      ciLow: 0.2,
      ciHigh: 0.6,
      lift: 1.1,
      qValue: 0.05
    }
  ];

  const mockKpis: KpiSummary = {
    atrPercent: 1,
    averageRange: 0.01,
    skewness: 0,
    kurtosis: 0,
    maxDrawdown: -0.1
  };

  const mockRunsPage: MarketAnalysisRunsPage = {
    items: [
      {
        runId: 'run-1',
        requestId: 'req-1',
        specType: 'market_stats',
        status: 'SUCCEEDED',
        createdAt: '2026-03-05T10:00:00Z',
        startedAt: '2026-03-05T10:01:00Z',
        finishedAt: '2026-03-05T10:02:00Z',
        updatedAt: '2026-03-05T10:02:00Z',
        errorMessage: null,
        attempts: 1,
        maxAttempts: 3,
        cancelRequested: false,
        persistenceEnabled: true,
        specId: 'spec-1',
        datasetId: 'dataset-1'
      }
    ],
    page: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
    sort: 'created_at,desc'
  };

  const mockRunDetail: MarketAnalysisRunDetail = {
    runId: 'run-1',
    requestId: 'req-1',
    specType: 'market_stats',
    status: 'SUCCEEDED',
    createdAt: '2026-03-05T10:00:00Z',
    startedAt: '2026-03-05T10:01:00Z',
    finishedAt: '2026-03-05T10:02:00Z',
    updatedAt: '2026-03-05T10:02:00Z',
    errorMessage: null,
    attempts: 1,
    maxAttempts: 3,
    cancelRequested: false,
    persistenceEnabled: true,
    specId: 'spec-1',
    datasetId: 'dataset-1',
    payloadJson: { symbol: 'EURUSD' },
    progressJson: { progress: 100 },
    resultJsonAvailable: true
  };

  const mockRunResult: MarketAnalysisRunResult = {
    runId: 'run-1',
    specType: 'market_stats',
    source: 'persisted_tables',
    meta: {
      specId: 'spec-1',
      datasetId: 'dataset-1',
      outDir: '/tmp/out',
      window: '3y',
      start: '2023-01-01',
      end: '2025-12-31',
      status: 'SUCCEEDED'
    },
    data: {
      marketStatsRows: [{ event: 'breakout', n: 10 }],
      seasonalityProfiles: [{ profile: 'dow', score: 0.7 }],
      seasonalityRunSummary: { trades: 42 },
      rawResultJson: { source: 'json' }
    }
  };

  const createCard = (id: string): FilterCard => ({
    id,
    title: id,
    source: 'JAVA',
    category: 'test'
  });

  const buildApiResult = <T>(data: T, isMock = false): ApiResult<T> => ({
    data,
    isMock
  });

  beforeEach(async () => {
    marketStatsSpy = jasmine.createSpyObj<MarketStatsService>('MarketStatsService', [
      'getCandles',
      'getSeasonality',
      'getStatsSummary',
      'computeKpisFromCandles'
    ]);
    marketAnalysisRunsSpy = jasmine.createSpyObj<MarketAnalysisRunsService>('MarketAnalysisRunsService', [
      'getRuns',
      'getRunDetail',
      'getRunResult'
    ]);
    filtersSpy = jasmine.createSpyObj<FiltersService>('FiltersService', [
      'getMultiTFStats',
      'getBenford',
      'getGenericFilter'
    ]);
    snackBarSpy = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);

    TestBed.configureTestingModule({
      imports: [MarketAnalysisPage],
      providers: [
        { provide: MarketStatsService, useValue: marketStatsSpy },
        { provide: MarketAnalysisRunsService, useValue: marketAnalysisRunsSpy },
        { provide: FiltersService, useValue: filtersSpy },
        { provide: MatSnackBar, useValue: snackBarSpy }
      ]
    });
    TestBed.overrideProvider(MatSnackBar, { useValue: snackBarSpy });
    await TestBed.compileComponents();
  });

  const stubDefaultResponses = () => {
    marketStatsSpy.getCandles.and.returnValue(of(buildApiResult(mockCandles)));
    marketStatsSpy.getSeasonality.and.returnValue(of(buildApiResult(mockSeasonality)));
    marketStatsSpy.getStatsSummary.and.returnValue(of(buildApiResult(mockStats)));
    marketStatsSpy.computeKpisFromCandles.and.returnValue(mockKpis);
    marketAnalysisRunsSpy.getRuns.and.returnValue(of(mockRunsPage));
    marketAnalysisRunsSpy.getRunDetail.and.returnValue(of(mockRunDetail));
    marketAnalysisRunsSpy.getRunResult.and.returnValue(of(mockRunResult));
    filtersSpy.getMultiTFStats.and.returnValue(of(buildApiResult([createCard('multi')])));
    filtersSpy.getBenford.and.returnValue(of(buildApiResult(createCard('benford'))));
    filtersSpy.getGenericFilter.and.returnValue(of(buildApiResult([createCard('liquidity')])));
  };

  const createComponent = () => {
    fixture = TestBed.createComponent(MarketAnalysisPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should trigger analysis and runs catalog calls on init', () => {
    stubDefaultResponses();

    createComponent();

    expect(marketStatsSpy.getCandles).toHaveBeenCalledWith('EURUSD', '1h', jasmine.any(String));
    expect(marketStatsSpy.getSeasonality).toHaveBeenCalledWith('EURUSD', '1h');
    expect(marketStatsSpy.getStatsSummary).toHaveBeenCalledWith({
      symbol: 'EURUSD',
      timeframe: '1h'
    });
    expect(filtersSpy.getMultiTFStats).toHaveBeenCalledWith('EURUSD', '15m,1h,4h');
    expect(filtersSpy.getBenford).toHaveBeenCalledWith('EURUSD', '1h');
    expect(filtersSpy.getGenericFilter).toHaveBeenCalledWith('liquidity', {
      symbol: 'EURUSD',
      timeframe: '1h'
    });
    expect(marketAnalysisRunsSpy.getRuns).toHaveBeenCalledWith({
      specType: 'market_stats',
      status: '',
      symbol: '',
      timeframe: '',
      page: 0,
      size: 10,
      sort: 'created_at,desc'
    });
    expect(marketAnalysisRunsSpy.getRunDetail).toHaveBeenCalledWith('run-1');
    expect(marketAnalysisRunsSpy.getRunResult).toHaveBeenCalledWith('run-1');
  });

  it('should allow free-form symbols for backend-driven analysis without constraining the runs catalog', () => {
    stubDefaultResponses();

    createComponent();

    marketStatsSpy.getCandles.calls.reset();
    marketStatsSpy.getSeasonality.calls.reset();
    marketStatsSpy.getStatsSummary.calls.reset();
    filtersSpy.getMultiTFStats.calls.reset();
    filtersSpy.getBenford.calls.reset();
    filtersSpy.getGenericFilter.calls.reset();
    marketAnalysisRunsSpy.getRuns.calls.reset();

    component.analysisForm.patchValue({ symbol: 'BTC', timeframe: '1h' });

    component.refreshData();

    expect(marketStatsSpy.getCandles).toHaveBeenCalledWith('BTC', '1h', jasmine.any(String));
    expect(marketStatsSpy.getSeasonality).toHaveBeenCalledWith('BTC', '1h');
    expect(marketStatsSpy.getStatsSummary).toHaveBeenCalledWith({
      symbol: 'BTC',
      timeframe: '1h'
    });
    expect(marketAnalysisRunsSpy.getRuns).toHaveBeenCalledWith({
      specType: 'market_stats',
      status: '',
      symbol: '',
      timeframe: '',
      page: 0,
      size: 10,
      sort: 'created_at,desc'
    });
  });

  it('should apply explicit runs catalog filters only when runSymbol and runTimeframe are set', () => {
    stubDefaultResponses();

    createComponent();

    marketAnalysisRunsSpy.getRuns.calls.reset();

    component.analysisForm.patchValue({
      runSpecType: 'market_stats',
      runStatus: 'SUCCEEDED',
      runSymbol: 'BTC',
      runTimeframe: '1D',
      runsPageSize: 25
    });

    component.refreshRuns();

    expect(marketAnalysisRunsSpy.getRuns).toHaveBeenCalledWith({
      specType: 'market_stats',
      status: 'SUCCEEDED',
      symbol: 'BTC',
      timeframe: '1D',
      page: 0,
      size: 25,
      sort: 'created_at,desc'
    });
  });

  it('should keep loading false and show snackbar on invalid form', () => {
    stubDefaultResponses();

    createComponent();

    marketStatsSpy.getCandles.calls.reset();
    marketStatsSpy.getSeasonality.calls.reset();
    marketStatsSpy.getStatsSummary.calls.reset();
    filtersSpy.getMultiTFStats.calls.reset();
    filtersSpy.getBenford.calls.reset();
    filtersSpy.getGenericFilter.calls.reset();
    marketAnalysisRunsSpy.getRuns.calls.reset();
    snackBarSpy.open.calls.reset();

    component.analysisForm.patchValue({ symbol: '', timeframe: '' });
    component.analysisForm.controls.symbol.setErrors({ required: true });
    component.analysisForm.controls.timeframe.setErrors({ required: true });
    component.analysisForm.setErrors({ invalid: true });

    component.loadAnalysis();

    expect(component.loading()).toBeFalse();
    expect(snackBarSpy.open).toHaveBeenCalledWith(
      'Veuillez renseigner un symbole et un timeframe valides.',
      'Fermer',
      { duration: 3000 }
    );
    expect(marketStatsSpy.getCandles).not.toHaveBeenCalled();
    expect(marketStatsSpy.getSeasonality).not.toHaveBeenCalled();
    expect(marketStatsSpy.getStatsSummary).not.toHaveBeenCalled();
    expect(filtersSpy.getMultiTFStats).not.toHaveBeenCalled();
    expect(filtersSpy.getBenford).not.toHaveBeenCalled();
    expect(filtersSpy.getGenericFilter).not.toHaveBeenCalled();
    expect(marketAnalysisRunsSpy.getRuns).not.toHaveBeenCalled();
  });

  it('should combine multi, benford, and liquidity filters', () => {
    marketStatsSpy.getCandles.and.returnValue(of(buildApiResult(mockCandles)));
    marketStatsSpy.getSeasonality.and.returnValue(of(buildApiResult(mockSeasonality)));
    marketStatsSpy.getStatsSummary.and.returnValue(of(buildApiResult(mockStats)));
    marketStatsSpy.computeKpisFromCandles.and.returnValue(mockKpis);
    marketAnalysisRunsSpy.getRuns.and.returnValue(of(mockRunsPage));
    marketAnalysisRunsSpy.getRunDetail.and.returnValue(of(mockRunDetail));
    marketAnalysisRunsSpy.getRunResult.and.returnValue(of(mockRunResult));

    const multiCards = [createCard('multi-1'), createCard('multi-2')];
    const benfordCard = createCard('benford');
    const liquidityCards = [createCard('liquidity-1')];

    filtersSpy.getMultiTFStats.and.returnValue(of(buildApiResult(multiCards)));
    filtersSpy.getBenford.and.returnValue(of(buildApiResult(benfordCard)));
    filtersSpy.getGenericFilter.and.returnValue(of(buildApiResult(liquidityCards, true)));

    createComponent();

    expect(component.filters().cards.map(card => card.id)).toEqual([
      'benford',
      'multi-1',
      'multi-2',
      'liquidity-1'
    ]);
    expect(component.filters().isMock).toBeTrue();
  });

  it('should stop surfacing mock notifications in the page flow', () => {
    marketStatsSpy.getCandles.and.returnValue(of(buildApiResult(mockCandles, true)));
    marketStatsSpy.getSeasonality.and.returnValue(of(buildApiResult(mockSeasonality, true)));
    marketStatsSpy.getStatsSummary.and.returnValue(of(buildApiResult(mockStats, true)));
    marketStatsSpy.computeKpisFromCandles.and.returnValue(mockKpis);
    marketAnalysisRunsSpy.getRuns.and.returnValue(of(mockRunsPage));
    marketAnalysisRunsSpy.getRunDetail.and.returnValue(of(mockRunDetail));
    marketAnalysisRunsSpy.getRunResult.and.returnValue(of(mockRunResult));
    filtersSpy.getMultiTFStats.and.returnValue(of(buildApiResult([createCard('multi')])));
    filtersSpy.getBenford.and.returnValue(of(buildApiResult(createCard('benford'))));
    filtersSpy.getGenericFilter.and.returnValue(of(buildApiResult([createCard('liquidity')])));

    createComponent();

    const mockOpenCalls = snackBarSpy.open.calls.allArgs().filter(args => String(args[0]).toLowerCase().includes('mock'));
    expect(mockOpenCalls.length).toBe(0);
    expect(component.sectionStateLabel('ready')).toBe('Ready');
    expect(component.sectionStateLabel('empty')).toBe('Empty');
  });

  it('should load the runs catalog and expose pagination state', () => {
    stubDefaultResponses();

    createComponent();

    expect(component.runsPage()).toEqual(mockRunsPage);
    expect(component.runRangeLabel()).toBe('1-1 / 1');
    expect(component.canGoToPreviousRunsPage()).toBeFalse();
    expect(component.canGoToNextRunsPage()).toBeFalse();
    expect(component.selectedRunDetail()).toEqual(mockRunDetail);
    expect(component.selectedRunResult()).toEqual(mockRunResult);
  });

  it('should render enriched market_stats rows with prioritized columns and formatted values', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunResult.and.returnValue(
      of({
        ...mockRunResult,
        data: {
          ...mockRunResult.data,
          marketStatsRows: [
            {
              event: 'breakout',
              target: 'continuation_n',
              n: 42,
              lift_freq: 1.2345,
              lift_bayes: 1.1111,
              p_value: 0.01234,
              q_value: 0.04567,
              significant: true,
              p_mean: 0.54321,
              p_map: 0.51234,
              hdi_low: 0.41,
              hdi_high: 0.62,
              insufficient: false
            }
          ]
        }
      })
    );

    createComponent();

    const root = fixture.nativeElement as HTMLElement;
    const marketStatsTable = root.querySelector('.result-section .stats-table') as HTMLTableElement;
    const headers = Array.from(
      marketStatsTable.querySelectorAll('thead th')
    ).map(cell => (cell as HTMLTableCellElement).textContent?.trim());
    const firstRow = Array.from(
      marketStatsTable.querySelectorAll('tbody tr:first-child td')
    ).map(cell => (cell as HTMLTableCellElement).textContent?.trim());

    expect(headers).toContain('Lift Freq');
    expect(headers).toContain('Lift Bayes');
    expect(headers).toContain('p_value');
    expect(headers).toContain('q_value');
    expect(headers).toContain('Significant');
    expect(headers).toContain('P Mean');
    expect(headers).toContain('P Map');
    expect(headers).toContain('Hdi Low');
    expect(headers).toContain('Hdi High');
    expect(headers.indexOf('Event')).toBeLessThan(headers.indexOf('Lift Freq'));
    expect(firstRow).toContain('1.2345');
    expect(firstRow).toContain('0.0123');
    expect(firstRow).toContain('Yes');
    expect(firstRow).toContain('No');
  });

  it('should keep backward-compatible market_stats rendering when only legacy columns are present', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunResult.and.returnValue(
      of({
        ...mockRunResult,
        data: {
          ...mockRunResult.data,
          marketStatsRows: [{ event: 'breakout', n: 10 }]
        }
      })
    );

    createComponent();

    expect(component.selectedRunMarketStatsColumns()).toEqual(['event', 'n']);
    const root = fixture.nativeElement as HTMLElement;
    const marketStatsTable = root.querySelector('.result-section .stats-table') as HTMLTableElement;
    const firstRow = Array.from(
      marketStatsTable.querySelectorAll('tbody tr:first-child td')
    ).map(cell => (cell as HTMLTableCellElement).textContent?.trim());
    expect(firstRow).toEqual(['breakout', '10']);
  });

  it('should request the next runs page with the current filters', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRuns.and.returnValues(
      of({
        ...mockRunsPage,
        page: 0,
        totalElements: 15,
        totalPages: 2
      }),
      of({
        ...mockRunsPage,
        page: 1,
        totalElements: 15,
        totalPages: 2
      })
    );

    createComponent();
    component.loadNextRunsPage();

    expect(marketAnalysisRunsSpy.getRuns.calls.mostRecent().args[0]).toEqual({
      specType: 'market_stats',
      status: '',
      symbol: '',
      timeframe: '',
      page: 1,
      size: 10,
      sort: 'created_at,desc'
    });
    expect(component.runsPage().page).toBe(1);
  });

  it('should expose a result info message when the selected run result is not ready', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunResult.and.returnValue(throwError(() => ({ status: 409 })));

    createComponent();

    expect(component.selectedRunDetail()).toEqual(mockRunDetail);
    expect(component.selectedRunResultInfo()).toBe('Resultat pas encore disponible pour ce run.');
  });

  it('maps 422 runs errors to a validation message', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRuns.and.returnValue(
      throwError(() => ({
        status: 422,
        error: {
          errors: [{ field: 'symbol', message: 'Symbol is required' }]
        }
      }))
    );

    createComponent();

    expect(component.runsError()).toBe('Filtres invalides pour le catalogue des runs. symbol: Symbol is required');
  });

  it('maps 404 detail errors to a run not found message', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRunDetail.and.returnValue(throwError(() => ({ status: 404 })));

    createComponent();

    expect(component.selectedRunError()).toBe('Run introuvable.');
  });

  it('maps 5xx runs errors to a service unavailable message', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRuns.and.returnValue(throwError(() => ({ status: 503 })));

    createComponent();

    expect(component.runsError()).toBe('Service indisponible temporairement. Reessayez.');
    expect(component.runsPage().items).toEqual([]);
  });

  it('maps status 0 runs errors to a service unavailable message', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRuns.and.returnValue(throwError(() => ({ status: 0 })));

    createComponent();

    expect(component.runsError()).toBe('Service indisponible temporairement. Reessayez.');
  });

  it('keeps the runs catalog in empty state when the backend returns no items', () => {
    stubDefaultResponses();
    marketAnalysisRunsSpy.getRuns.and.returnValue(
      of({
        items: [],
        page: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
        sort: 'created_at,desc'
      })
    );

    createComponent();

    expect(component.runsPage().items).toEqual([]);
    expect(component.runRangeLabel()).toBe('Aucun run');
    expect(component.selectedRunId()).toBeNull();
  });

  it('marks sections as empty when analysis datasets are valid but empty', () => {
    marketStatsSpy.getCandles.and.returnValue(of(buildApiResult([])));
    marketStatsSpy.getSeasonality.and.returnValue(of(buildApiResult({ byMonth: [], byDow: [], byHour: [] })));
    marketStatsSpy.getStatsSummary.and.returnValue(of(buildApiResult([])));
    marketStatsSpy.computeKpisFromCandles.and.returnValue({
      atrPercent: 0,
      averageRange: 0,
      skewness: 0,
      kurtosis: 0,
      maxDrawdown: 0
    });
    marketAnalysisRunsSpy.getRuns.and.returnValue(of(mockRunsPage));
    marketAnalysisRunsSpy.getRunDetail.and.returnValue(of(mockRunDetail));
    marketAnalysisRunsSpy.getRunResult.and.returnValue(of(mockRunResult));
    filtersSpy.getMultiTFStats.and.returnValue(of(buildApiResult([])));
    filtersSpy.getBenford.and.returnValue(of(buildApiResult(createCard('benford'))));
    filtersSpy.getGenericFilter.and.returnValue(of(buildApiResult([])));

    createComponent();

    expect(component.sectionStateLabel(component.sectionStates().candles)).toBe('Empty');
    expect(component.sectionStateLabel(component.sectionStates().seasonality)).toBe('Empty');
    expect(component.sectionStateLabel(component.sectionStates().stats)).toBe('Empty');
  });
});
