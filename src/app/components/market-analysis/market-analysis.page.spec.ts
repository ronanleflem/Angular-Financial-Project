import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MarketAnalysisPage } from './market-analysis.page';
import { FiltersService } from '../../services/filters.service';
import { MarketStatsService } from '../../services/market-stats.service';
import { ApiResult, Candle, FilterCard, KpiSummary, SeasonalityProfile, StatsSummaryRow } from '../../models/market-analysis.models';

describe('MarketAnalysisPage', () => {
  let fixture: ComponentFixture<MarketAnalysisPage>;
  let component: MarketAnalysisPage;
  let marketStatsSpy: jasmine.SpyObj<MarketStatsService>;
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
    filtersSpy = jasmine.createSpyObj<FiltersService>('FiltersService', [
      'getMultiTFStats',
      'getBenford',
      'getGenericFilter'
    ]);
    snackBarSpy = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [MarketAnalysisPage],
      providers: [
        { provide: MarketStatsService, useValue: marketStatsSpy },
        { provide: FiltersService, useValue: filtersSpy },
        { provide: MatSnackBar, useValue: snackBarSpy }
      ]
    }).compileComponents();
  });

  const createComponent = () => {
    fixture = TestBed.createComponent(MarketAnalysisPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should trigger all analysis calls when loadAnalysis runs', () => {
    marketStatsSpy.getCandles.and.returnValue(of(buildApiResult(mockCandles)));
    marketStatsSpy.getSeasonality.and.returnValue(of(buildApiResult(mockSeasonality)));
    marketStatsSpy.getStatsSummary.and.returnValue(of(buildApiResult(mockStats)));
    marketStatsSpy.computeKpisFromCandles.and.returnValue(mockKpis);

    filtersSpy.getMultiTFStats.and.returnValue(of(buildApiResult([createCard('multi')])));
    filtersSpy.getBenford.and.returnValue(of(buildApiResult(createCard('benford'))));
    filtersSpy.getGenericFilter.and.returnValue(of(buildApiResult([createCard('liquidity')])));

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
  });

  it('should keep loading false and show snackbar on invalid form', () => {
    marketStatsSpy.getCandles.and.returnValue(of(buildApiResult(mockCandles)));
    marketStatsSpy.getSeasonality.and.returnValue(of(buildApiResult(mockSeasonality)));
    marketStatsSpy.getStatsSummary.and.returnValue(of(buildApiResult(mockStats)));
    marketStatsSpy.computeKpisFromCandles.and.returnValue(mockKpis);

    filtersSpy.getMultiTFStats.and.returnValue(of(buildApiResult([createCard('multi')])));
    filtersSpy.getBenford.and.returnValue(of(buildApiResult(createCard('benford'))));
    filtersSpy.getGenericFilter.and.returnValue(of(buildApiResult([createCard('liquidity')])));

    createComponent();

    marketStatsSpy.getCandles.calls.reset();
    marketStatsSpy.getSeasonality.calls.reset();
    marketStatsSpy.getStatsSummary.calls.reset();
    filtersSpy.getMultiTFStats.calls.reset();
    filtersSpy.getBenford.calls.reset();
    filtersSpy.getGenericFilter.calls.reset();
    snackBarSpy.open.calls.reset();

    component.analysisForm.patchValue({ symbol: '', timeframe: '' });
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
  });

  it('should combine multi, benford, and liquidity filters', () => {
    marketStatsSpy.getCandles.and.returnValue(of(buildApiResult(mockCandles)));
    marketStatsSpy.getSeasonality.and.returnValue(of(buildApiResult(mockSeasonality)));
    marketStatsSpy.getStatsSummary.and.returnValue(of(buildApiResult(mockStats)));
    marketStatsSpy.computeKpisFromCandles.and.returnValue(mockKpis);

    const multiCards = [createCard('multi-1'), createCard('multi-2')];
    const benfordCard = createCard('benford');
    const liquidityCards = [createCard('liquidity-1')];

    filtersSpy.getMultiTFStats.and.returnValue(of(buildApiResult(multiCards)));
    filtersSpy.getBenford.and.returnValue(of(buildApiResult(benfordCard)));
    filtersSpy.getGenericFilter.and.returnValue(of(buildApiResult(liquidityCards, true)));

    createComponent();

    const filters = component.filters();

    expect(filters.cards.map(card => card.id)).toEqual([
      'benford',
      'multi-1',
      'multi-2',
      'liquidity-1'
    ]);
    expect(filters.isMock).toBeTrue();
  });

  it('should notify when candles, seasonality, and stats are mock', () => {
    const notifySpy = spyOn(MarketAnalysisPage.prototype as any, 'notifyMock').and.callThrough();

    marketStatsSpy.getCandles.and.returnValue(of(buildApiResult(mockCandles, true)));
    marketStatsSpy.getSeasonality.and.returnValue(of(buildApiResult(mockSeasonality, true)));
    marketStatsSpy.getStatsSummary.and.returnValue(of(buildApiResult(mockStats, true)));
    marketStatsSpy.computeKpisFromCandles.and.returnValue(mockKpis);

    filtersSpy.getMultiTFStats.and.returnValue(of(buildApiResult([createCard('multi')])));
    filtersSpy.getBenford.and.returnValue(of(buildApiResult(createCard('benford'))));
    filtersSpy.getGenericFilter.and.returnValue(of(buildApiResult([createCard('liquidity')])));

    createComponent();

    expect(notifySpy).toHaveBeenCalledWith('Bougies (candles)');
    expect(notifySpy).toHaveBeenCalledWith('Saisonnalité');
    expect(notifySpy).toHaveBeenCalledWith('Patterns & Probabilités');
  });
});
