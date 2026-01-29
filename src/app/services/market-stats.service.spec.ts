import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { getMockCandles, getMockSeasonality, getMockStatsSummary } from '../mocks/market-mocks';
import { Candle } from '../models/market-analysis.models';
import { MarketStatsService } from './market-stats.service';

describe('MarketStatsService', () => {
  let service: MarketStatsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });

    service = TestBed.inject(MarketStatsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should request candles with params', () => {
    let response: any;
    const candles: Candle[] = [
      { timestamp: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5, volume: 120 }
    ];

    service.getCandles('EURUSD', '1h', '2024-01-01', '2024-01-31').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${environment.apiUrl}/api/finance/charts/candles`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('EURUSD');
    expect(req.request.params.get('timeframe')).toBe('1h');
    expect(req.request.params.get('startDate')).toBe('2024-01-01');
    expect(req.request.params.get('endDate')).toBe('2024-01-31');
    req.flush(candles);

    expect(response).toEqual({ data: candles, isMock: false });
  });

  it('should fallback to mock candles on error', () => {
    let response: any;

    service.getCandles('EURUSD', '1h').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${environment.apiUrl}/api/finance/charts/candles`);
    req.error(new ProgressEvent('Network error'));

    expect(response).toEqual({ data: getMockCandles('EURUSD'), isMock: true });
  });

  it('should request seasonality with params', () => {
    let response: any;
    const seasonality = getMockSeasonality('EURUSD');

    service.getSeasonality('EURUSD', '1h').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${environment.pyApiUrl}/seasonality/profiles`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('EURUSD');
    expect(req.request.params.get('timeframe')).toBe('1h');
    req.flush(seasonality);

    expect(response).toEqual({ data: seasonality, isMock: false });
  });

  it('should fallback to mock seasonality on error', () => {
    let response: any;

    service.getSeasonality('GBPUSD', '1h').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${environment.pyApiUrl}/seasonality/profiles`);
    req.error(new ProgressEvent('Network error'));

    expect(response).toEqual({ data: getMockSeasonality('GBPUSD'), isMock: true });
  });

  it('should request stats summary with params and normalize fields', () => {
    let response: any;
    const rawRows = [
      {
        event: 'inside_bar',
        target: 'break_up',
        n: 120,
        p_hat: 0.42,
        ci_low: 0.33,
        ci_high: 0.5,
        lift: -0.02,
        q_value: 0.12
      },
      {
        event: 'k_consecutive=3',
        target: 'up_next',
        n: 250,
        pHat: 0.6,
        ciLow: 0.55,
        ciHigh: 0.65,
        lift: 0.1
      }
    ];

    service
      .getStatsSummary({ symbol: 'EURUSD', timeframe: '1h', event: 'inside_bar', target: 'break_up' })
      .subscribe(value => {
        response = value;
      });

    const req = httpMock.expectOne(request => request.url === `${environment.pyApiUrl}/stats/summary`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('EURUSD');
    expect(req.request.params.get('timeframe')).toBe('1h');
    expect(req.request.params.get('event')).toBe('inside_bar');
    expect(req.request.params.get('target')).toBe('break_up');
    req.flush(rawRows);

    expect(response).toEqual({
      data: [
        {
          event: 'inside_bar',
          target: 'break_up',
          n: 120,
          pHat: 0.42,
          ciLow: 0.33,
          ciHigh: 0.5,
          lift: -0.02,
          qValue: 0.12
        },
        {
          event: 'k_consecutive=3',
          target: 'up_next',
          n: 250,
          pHat: 0.6,
          ciLow: 0.55,
          ciHigh: 0.65,
          lift: 0.1,
          qValue: undefined
        }
      ],
      isMock: false
    });
  });

  it('should fallback to mock stats summary on error', () => {
    let response: any;

    service.getStatsSummary({ symbol: 'EURUSD', timeframe: '1h' }).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${environment.pyApiUrl}/stats/summary`);
    req.error(new ProgressEvent('Network error'));

    expect(response).toEqual({ data: getMockStatsSummary(), isMock: true });
  });

  it('should compute KPIs from candles', () => {
    const candles: Candle[] = [
      { timestamp: 't1', open: 100, high: 110, low: 95, close: 105, volume: 1 },
      { timestamp: 't2', open: 105, high: 112, low: 100, close: 102, volume: 1 },
      { timestamp: 't3', open: 102, high: 108, low: 99, close: 107, volume: 1 },
      { timestamp: 't4', open: 107, high: 115, low: 104, close: 111, volume: 1 }
    ];

    expect(service.computeKpisFromCandles(candles)).toEqual({
      atrPercent: 11.06,
      averageRange: 11.75,
      skewness: 0.207,
      kurtosis: -1.166,
      maxDrawdown: -2.86
    });
  });
});
