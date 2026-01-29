import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { MarketDataService } from './market-data.service';

describe('MarketDataService', () => {
  let service: MarketDataService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiBaseUrl ?? environment.apiUrl ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(MarketDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should connect with explicit params', () => {
    let response: any;

    service.connectWait('localhost', 7000, 2, 5000).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${baseUrl}/ibkr/connect/wait`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('host')).toBe('localhost');
    expect(req.request.params.get('port')).toBe('7000');
    expect(req.request.params.get('clientId')).toBe('2');
    expect(req.request.params.get('timeoutMs')).toBe('5000');
    req.flush({ ok: true });

    expect(response).toEqual({ ok: true });
  });

  it('should propagate connect errors', () => {
    let error: any;

    service.connectWait().subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(request => request.url === `${baseUrl}/ibkr/connect/wait`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should start live bars with default params', () => {
    let response: any;

    service.startLiveBars().subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${baseUrl}/ibkr/live/bars/start`);
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

  it('should start live bars with custom params', () => {
    let response: any;

    service.startLiveBars('USDJPY', '2 D', '5 mins', 'TRADES', 1, 1).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${baseUrl}/ibkr/live/bars/start`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('pair')).toBe('USDJPY');
    expect(req.request.params.get('duration')).toBe('2 D');
    expect(req.request.params.get('barSize')).toBe('5 mins');
    expect(req.request.params.get('what')).toBe('TRADES');
    expect(req.request.params.get('rth')).toBe('1');
    expect(req.request.params.get('formatDate')).toBe('1');
    req.flush({ reqId: 99 });

    expect(response).toEqual({ reqId: 99 });
  });

  it('should propagate start live bars errors', () => {
    let error: any;

    service.startLiveBars().subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(request => request.url === `${baseUrl}/ibkr/live/bars/start`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should request live bars', () => {
    let response: any;

    service.getLiveBars(42).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${baseUrl}/ibkr/live/bars/42`);
    expect(req.request.method).toBe('GET');
    req.flush([{ time: 1000 }]);

    expect(response).toEqual([{ time: 1000 }]);
  });

  it('should propagate live bars errors', () => {
    let error: any;

    service.getLiveBars(42).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/ibkr/live/bars/42`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should request the last live bar', () => {
    let response: any;

    service.getLastLiveBar(10).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${baseUrl}/ibkr/live/bars/10/last`);
    expect(req.request.method).toBe('GET');
    req.flush({ time: 1000 });

    expect(response).toEqual({ time: 1000 });
  });

  it('should propagate last live bar errors', () => {
    let error: any;

    service.getLastLiveBar(10).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/ibkr/live/bars/10/last`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should stop live bars', () => {
    let response: any;

    service.stopLiveBars(7).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${baseUrl}/ibkr/live/bars/stop/7`);
    expect(req.request.method).toBe('POST');
    req.flush({ stopped: true });

    expect(response).toEqual({ stopped: true });
  });

  it('should propagate stop live bars errors', () => {
    let error: any;

    service.stopLiveBars(7).subscribe({
      next: () => fail('Expected error'),
      error: err => {
        error = err;
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/ibkr/live/bars/stop/7`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });

  it('should request window with required params', () => {
    let response: any;

    service
      .getWindow({
        symbol: 'ES',
        timeframe: '1h',
        endTsUtc: '2024-01-01T00:00:00Z',
        barsBack: 20,
      })
      .subscribe(value => {
        response = value;
      });

    const req = httpMock.expectOne(request => request.url === `${baseUrl}/marketdata/ohlcv/window`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('ES');
    expect(req.request.params.get('timeframe')).toBe('1h');
    expect(req.request.params.get('endTsUtc')).toBe('2024-01-01T00:00:00Z');
    expect(req.request.params.get('barsBack')).toBe('20');
    expect(req.request.params.has('exitTsUtc')).toBe(false);
    expect(req.request.params.has('maxForward')).toBe(false);
    req.flush({ bars: [] });

    expect(response).toEqual({ bars: [] });
  });

  it('should request window with optional params', () => {
    let response: any;

    service
      .getWindow({
        symbol: 'NQ',
        timeframe: '5m',
        endTsUtc: '2024-02-01T00:00:00Z',
        barsBack: 5,
        exitTsUtc: '2024-02-01T01:00:00Z',
        maxForward: 15,
      })
      .subscribe(value => {
        response = value;
      });

    const req = httpMock.expectOne(request => request.url === `${baseUrl}/marketdata/ohlcv/window`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('NQ');
    expect(req.request.params.get('timeframe')).toBe('5m');
    expect(req.request.params.get('endTsUtc')).toBe('2024-02-01T00:00:00Z');
    expect(req.request.params.get('barsBack')).toBe('5');
    expect(req.request.params.get('exitTsUtc')).toBe('2024-02-01T01:00:00Z');
    expect(req.request.params.get('maxForward')).toBe('15');
    req.flush({ bars: [{ ts: 1 }] });

    expect(response).toEqual({ bars: [{ ts: 1 }] });
  });

  it('should propagate window errors', () => {
    let error: any;

    service
      .getWindow({
        symbol: 'ES',
        timeframe: '1h',
        endTsUtc: '2024-01-01T00:00:00Z',
        barsBack: 20,
      })
      .subscribe({
        next: () => fail('Expected error'),
        error: err => {
          error = err;
        },
      });

    const req = httpMock.expectOne(request => request.url === `${baseUrl}/marketdata/ohlcv/window`);
    req.error(new ProgressEvent('Server error'), { status: 500, statusText: 'Server Error' });

    expect(error?.status).toBe(500);
  });
});
