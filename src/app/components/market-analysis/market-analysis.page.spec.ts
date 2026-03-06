import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import {
  ApiResult,
  Candle,
  FilterCard,
  KpiSummary,
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
      'getRuns'
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
      symbol: 'EURUSD',
      timeframe: '1h',
      page: 0,
      size: 10,
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

  it('should notify when candles, seasonality, and stats are mock', () => {
    const notifySpy = spyOn<any>(MarketAnalysisPage.prototype, 'notifyMock').and.callThrough();

    marketStatsSpy.getCandles.and.returnValue(of(buildApiResult(mockCandles, true)));
    marketStatsSpy.getSeasonality.and.returnValue(of(buildApiResult(mockSeasonality, true)));
    marketStatsSpy.getStatsSummary.and.returnValue(of(buildApiResult(mockStats, true)));
    marketStatsSpy.computeKpisFromCandles.and.returnValue(mockKpis);
    marketAnalysisRunsSpy.getRuns.and.returnValue(of(mockRunsPage));
    filtersSpy.getMultiTFStats.and.returnValue(of(buildApiResult([createCard('multi')])));
    filtersSpy.getBenford.and.returnValue(of(buildApiResult(createCard('benford'))));
    filtersSpy.getGenericFilter.and.returnValue(of(buildApiResult([createCard('liquidity')])));

    createComponent();

    expect(notifySpy).toHaveBeenCalledWith('Bougies (candles)');
    expect(notifySpy).toHaveBeenCalledWith('Saisonnalité');
    expect(notifySpy).toHaveBeenCalledWith('Patterns & Probabilités');
  });

  it('should load the runs catalog and expose pagination state', () => {
    stubDefaultResponses();

    createComponent();

    expect(component.runsPage()).toEqual(mockRunsPage);
    expect(component.runRangeLabel()).toBe('1-1 / 1');
    expect(component.canGoToPreviousRunsPage()).toBeFalse();
    expect(component.canGoToNextRunsPage()).toBeFalse();
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
      symbol: 'EURUSD',
      timeframe: '1h',
      page: 1,
      size: 10,
      sort: 'created_at,desc'
    });
    expect(component.runsPage().page).toBe(1);
  });
});
