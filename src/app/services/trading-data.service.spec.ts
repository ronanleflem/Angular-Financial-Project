import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TradingDataService } from './trading-data.service';

describe('TradingDataService', () => {
  let service: TradingDataService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(TradingDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should request IBKR status', () => {
    let response: { connected: boolean } | undefined;

    service.ibkrStatus().subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/status`);
    expect(req.request.method).toBe('GET');
    req.flush({ connected: true });

    expect(response).toEqual({ connected: true });
  });

  it('should default IBKR status on error', () => {
    let response: { connected: boolean } | undefined;

    service.ibkrStatus().subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/status`);
    req.error(new ProgressEvent('Network error'));

    expect(response).toEqual({ connected: false });
  });

  it('should request IBKR connect wait', () => {
    let response: any;

    service.ibkrConnectWait('localhost', 7000, 2, 5000).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/connect/wait`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('host')).toBe('localhost');
    expect(req.request.params.get('port')).toBe('7000');
    expect(req.request.params.get('clientId')).toBe('2');
    expect(req.request.params.get('timeoutMs')).toBe('5000');
    req.flush({ ok: true });

    expect(response).toEqual({ ok: true });
  });

  it('should return error payload when IBKR connect wait fails', () => {
    let response: any;

    service.ibkrConnectWait().subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/connect/wait`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(response?.status).toBe(500);
  });

  it('should start live bars with default params', () => {
    let response: { reqId: number } | undefined;

    service.ibkrStartLiveBars({ pair: 'EURUSD' }).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/start`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('pair')).toBe('EURUSD');
    expect(req.request.params.get('duration')).toBe('1 D');
    expect(req.request.params.get('barSize')).toBe('1 min');
    expect(req.request.params.get('what')).toBe('MIDPOINT');
    expect(req.request.params.get('rth')).toBe('0');
    expect(req.request.params.get('formatDate')).toBe('2');
    req.flush({ reqId: 12 });

    expect(response).toEqual({ reqId: 12 });
  });

  it('should surface errors when starting live bars fails', () => {
    let error: any;

    service.ibkrStartLiveBars({ pair: 'EURUSD' }).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/start`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should stop live bars', () => {
    let response: { stopped: boolean } | undefined;

    service.ibkrStopLiveBars(99).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/stop/99`);
    expect(req.request.method).toBe('POST');
    req.flush({ stopped: true });

    expect(response).toEqual({ stopped: true });
  });

  it('should surface errors when stopping live bars fails', () => {
    let error: any;

    service.ibkrStopLiveBars(99).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/stop/99`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should map recent live bars', () => {
    let response: any;

    service.ibkrRecentLiveBars(7).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/7`);
    expect(req.request.method).toBe('GET');
    req.flush([
      { time: 1000, open: '1', high: '2', low: '0.5', close: '1.5', volume: '10' },
      { tsMillis: 2000, open: 2, high: 3, low: 1, close: 2.5, volume: null },
    ]);

    expect(response).toEqual([
      { time: 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: 2000, open: 2, high: 3, low: 1, close: 2.5, volume: undefined },
    ]);
  });

  it('should surface errors when loading recent live bars fails', () => {
    let error: any;

    service.ibkrRecentLiveBars(7).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/7`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should map the last live bar', () => {
    let response: any;

    service.ibkrGetLastLiveBar(11).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/11/last`);
    expect(req.request.method).toBe('GET');
    req.flush({ ts: 3000, open: '3', high: '4', low: '2', close: '3.5', volume: '15' });

    expect(response).toEqual({ time: 3000, open: 3, high: 4, low: 2, close: 3.5, volume: 15 });
  });

  it('should surface errors when loading last live bar fails', () => {
    let error: any;

    service.ibkrGetLastLiveBar(11).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/11/last`);
    req.error(new ProgressEvent('Server error'), { status: 404, statusText: 'Not Found' });

    expect(error?.status).toBe(404);
  });

  it('should stream bootstrap then updates', fakeAsync(() => {
    const stop$ = new Subject<void>();
    const emissions: any[] = [];

    service
      .streamIbkrBars({ pair: 'EURUSD', pollMs: 100 }, stop$)
      .pipe(take(2))
      .subscribe(value => emissions.push(value));

    const startReq = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/start`);
    expect(startReq.request.method).toBe('POST');
    expect(startReq.request.params.get('pair')).toBe('EURUSD');
    startReq.flush({ reqId: 77 });

    tick(250);

    const bootstrapReq = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/77`);
    bootstrapReq.flush([{ time: 1000, open: 1, high: 2, low: 0.5, close: 1.5 }]);

    expect(emissions.length).toBe(1);
    expect(emissions[0].mode).toBe('bootstrap');
    expect(emissions[0].bars.length).toBe(1);

    tick(100);

    const updateReq = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/77/last`);
    updateReq.flush({ time: 1100, open: 2, high: 3, low: 1, close: 2.5 });
    tick();

    expect(emissions.length).toBe(2);
    expect(emissions[1].mode).toBe('update');

    stop$.next();
    stop$.complete();
  }));

  it('should surface errors when stream bootstrap fails to start', fakeAsync(() => {
    const stop$ = new Subject<void>();
    let error: any;

    service.streamIbkrBars({ pair: 'EURUSD' }, stop$).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/ibkr/live/bars/start`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });
    tick();

    expect(error?.status).toBe(500);
  }));

  it('should expose hist bar transformations', () => {
    const epochMs = service.toEpochMs(1000);
    const point = service.toFinancialPoint({ time: 1000, open: 1, high: 2, low: 0.5, close: 1.5 });

    expect(epochMs).toBe(1000 * 1000);
    expect(point).toEqual({
      x: new Date(1000 * 1000),
      o: 1,
      h: 2,
      l: 0.5,
      c: 1.5,
    });
  });

  it('should request candles for a trade', () => {
    let response: any;

    service.getCandlesForTrade(10, '1h', 'ES', 'NQ', 5, 10).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(
      `${apiUrl}/api/finance/charts/from-trade?tradeId=10&timeframe=1h&symbol=ES&comparedSymbol=NQ&beforeCandles=5&afterCandles=10`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ candles: [], comparedCandles: [], trade: {} });

    expect(response).toEqual({ candles: [], comparedCandles: [], trade: {} });
  });

  it('should surface errors when requesting candles for a trade fails', () => {
    let error: any;

    service.getCandlesForTrade(10, '1h', 'ES', 'NQ').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(
      `${apiUrl}/api/finance/charts/from-trade?tradeId=10&timeframe=1h&symbol=ES&comparedSymbol=NQ&beforeCandles=50&afterCandles=50`
    );
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should request trades by strategy name', () => {
    let response: any;

    service.getTradesByStrategyName('MyStrategy', 'run-1').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/get-trades-strategy?strategyName=MyStrategy&runId=run-1`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }]);

    expect(response).toEqual([{ id: 1 }]);
  });

  it('should surface errors when requesting trades by strategy name fails', () => {
    let error: any;

    service.getTradesByStrategyName('MyStrategy', 'run-1').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/get-trades-strategy?strategyName=MyStrategy&runId=run-1`);
    req.error(new ProgressEvent('Server error'), { status: 404, statusText: 'Not Found' });

    expect(error?.status).toBe(404);
  });

  it('should request symbols', () => {
    let response: any;

    service.getSymbols().subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/api/finance/symbols`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: '1', symbol: 'ES', name: 'S&P', market: 'CME' }]);

    expect(response).toEqual([{ id: '1', symbol: 'ES', name: 'S&P', market: 'CME' }]);
  });

  it('should surface errors when requesting symbols fails', () => {
    let error: any;

    service.getSymbols().subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/api/finance/symbols`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should request historical candles', () => {
    let response: any;

    service.getHistoricalCandles('ES', '1h').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/api/finance/charts/candles?symbol=ES&timeframe=1h`);
    expect(req.request.method).toBe('GET');
    req.flush({ candles: [] });

    expect(response).toEqual({ candles: [] });
  });

  it('should surface errors when requesting historical candles fails', () => {
    let error: any;

    service.getHistoricalCandles('ES', '1h').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/api/finance/charts/candles?symbol=ES&timeframe=1h`);
    req.error(new ProgressEvent('Server error'), { status: 404, statusText: 'Not Found' });

    expect(error?.status).toBe(404);
  });

  it('should request CME historical candles with encoded dates', () => {
    let response: any;

    service.getHistoricalCandlesCME('ES', '1h', '2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(
      `${apiUrl}/rollover-volume/unified-candles?symbol=ES&timeframe=1h&startDate=2024-01-01T00%3A00%3A00Z&endDate=2024-01-02T00%3A00%3A00Z`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ candles: ['cme'] });

    expect(response).toEqual({ candles: ['cme'] });
  });

  it('should surface errors when requesting CME historical candles fails', () => {
    let error: any;

    service.getHistoricalCandlesCME('ES', '1h', '2024-01-01', '2024-01-02').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(
      `${apiUrl}/rollover-volume/unified-candles?symbol=ES&timeframe=1h&startDate=2024-01-01&endDate=2024-01-02`
    );
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should request CME timeframe historical candles with encoded dates', () => {
    let response: any;

    service
      .getHistoricalCandlesTimeframeCME('ES', '1h', '2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z')
      .subscribe(value => {
        response = value;
      });

    const req = httpMock.expectOne(
      `${apiUrl}/api/finance/charts/candles/date-time?symbol=ES&timeframe=1h&startDate=2024-01-01T00%3A00%3A00Z&endDate=2024-01-02T00%3A00%3A00Z`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ candles: ['cme-timeframe'] });

    expect(response).toEqual({ candles: ['cme-timeframe'] });
  });

  it('should surface errors when requesting CME timeframe candles fails', () => {
    let error: any;

    service.getHistoricalCandlesTimeframeCME('ES', '1h', '2024-01-01', '2024-01-02').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(
      `${apiUrl}/api/finance/charts/candles/date-time?symbol=ES&timeframe=1h&startDate=2024-01-01&endDate=2024-01-02`
    );
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should request all calculated strategies', () => {
    let response: any;

    service.getAllCalculatedStrategies().subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/all-strategies`);
    expect(req.request.method).toBe('GET');
    req.flush(['strategy-a']);

    expect(response).toEqual(['strategy-a']);
  });

  it('should surface errors when requesting all calculated strategies fails', () => {
    let error: any;

    service.getAllCalculatedStrategies().subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/all-strategies`);
    req.error(new ProgressEvent('Server error'), { status: 503, statusText: 'Service Unavailable' });

    expect(error?.status).toBe(503);
  });

  it('should list strategies', () => {
    let response: any;

    service.listStrategies().subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/all-name-strategies`);
    expect(req.request.method).toBe('GET');
    req.flush(['strat-1', 'strat-2']);

    expect(response).toEqual(['strat-1', 'strat-2']);
  });

  it('should surface errors when listing strategies fails', () => {
    let error: any;

    service.listStrategies().subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/all-name-strategies`);
    req.error(new ProgressEvent('Server error'), { status: 404, statusText: 'Not Found' });

    expect(error?.status).toBe(404);
  });

  it('should request live candle', () => {
    let response: any;

    service.getLiveCandle('ES', '1h').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/api/live-candle?symbol=ES&timeframe=1h`);
    expect(req.request.method).toBe('GET');
    req.flush({ candle: {} });

    expect(response).toEqual({ candle: {} });
  });

  it('should surface errors when requesting live candle fails', () => {
    let error: any;

    service.getLiveCandle('ES', '1h').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/api/live-candle?symbol=ES&timeframe=1h`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should request calculation strategy with compared symbol', () => {
    let response: any;

    service
      .getCalculationStrategy('strat', 'ES', 'NQ', '1h', '2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z', 200)
      .subscribe(value => {
        response = value;
      });

    const req = httpMock.expectOne(
      `${apiUrl}/run-strategy-by-name?strategyName=strat&symbol=ES&timeframe=1h&period=200&comparedSymbol=NQ&startDate=2024-01-01T00%3A00%3A00Z&endDate=2024-01-02T00%3A00%3A00Z`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ result: [] });

    expect(response).toEqual({ result: [] });
  });

  it('should request calculation strategy without compared symbol', () => {
    let response: any;

    service
      .getCalculationStrategy('strat', 'ES', '', '1h', '2024-01-01', '2024-01-02')
      .subscribe(value => {
        response = value;
      });

    const req = httpMock.expectOne(
      `${apiUrl}/run-strategy-by-name?strategyName=strat&symbol=ES&timeframe=1h&period=1000&startDate=2024-01-01&endDate=2024-01-02`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ result: ['default'] });

    expect(response).toEqual({ result: ['default'] });
  });

  it('should surface errors when requesting calculation strategy fails', () => {
    let error: any;

    service.getCalculationStrategy('strat', 'ES', '', '1h', '2024-01-01', '2024-01-02').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(
      `${apiUrl}/run-strategy-by-name?strategyName=strat&symbol=ES&timeframe=1h&period=1000&startDate=2024-01-01&endDate=2024-01-02`
    );
    req.error(new ProgressEvent('Server error'), { status: 400, statusText: 'Bad Request' });

    expect(error?.status).toBe(400);
  });

  it('should request backtest results', () => {
    let response: any;

    service.getBacktestResults('strat').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/backtest?strategy=strat`);
    expect(req.request.method).toBe('GET');
    req.flush({ results: [] });

    expect(response).toEqual({ results: [] });
  });

  it('should surface errors when requesting backtest results fails', () => {
    let error: any;

    service.getBacktestResults('strat').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/backtest?strategy=strat`);
    req.error(new ProgressEvent('Server error'), { status: 502, statusText: 'Bad Gateway' });

    expect(error?.status).toBe(502);
  });

  it('should request statistics with timeframes', () => {
    let response: any;

    service.getStatistics('ES', ['1h', '4h']).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${apiUrl}/filter/bullish-bearish-stats/multi-timeframes`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('ES');
    expect(req.request.params.get('timeframes')).toBe('1h,4h');
    req.flush({ stats: [] });

    expect(response).toEqual({ stats: [] });
  });

  it('should surface errors when requesting statistics fails', () => {
    let error: any;

    service.getStatistics('ES', ['1h', '4h']).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${apiUrl}/filter/bullish-bearish-stats/multi-timeframes`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should request historical statistics', () => {
    let response: any;

    service.getHistoricalStatistics('ES', ['1h', '4h'], '2024-01-01', '2024-01-02').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne('/api/statistics/historical');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('ES');
    expect(req.request.params.get('timeframes')).toBe('1h,4h');
    expect(req.request.params.get('startDate')).toBe('2024-01-01');
    expect(req.request.params.get('endDate')).toBe('2024-01-02');
    req.flush({ stats: ['history'] });

    expect(response).toEqual({ stats: ['history'] });
  });

  it('should surface errors when requesting historical statistics fails', () => {
    let error: any;

    service.getHistoricalStatistics('ES', ['1h'], '2024-01-01', '2024-01-02').subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne('/api/statistics/historical');
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });
});
