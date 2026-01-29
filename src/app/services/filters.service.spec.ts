import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../environments/environment';
import { FilterCard } from '../models/market-analysis.models';
import { getMockBenford, getMockFilters } from '../mocks/market-mocks';
import { FiltersService } from './filters.service';

describe('FiltersService', () => {
  let service: FiltersService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(FiltersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should request multi timeframe stats with symbol and timeframes params', () => {
    const payload: FilterCard[] = [{ id: 'compression', title: 'Compression', source: 'JAVA', category: 'Volatility' }];
    let response: { data: FilterCard[]; isMock: boolean } | undefined;

    service.getMultiTFStats('EURUSD', '1h,4h').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${apiUrl}/filter/bullish-bearish-stats/multi-timeframes`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('EURUSD');
    expect(req.request.params.get('timeframes')).toBe('1h,4h');
    req.flush(payload);

    expect(response).toEqual({ data: payload, isMock: false });
  });

  it('should fallback to mock filters when multi timeframe stats fails', () => {
    let response: { data: FilterCard[]; isMock: boolean } | undefined;

    service.getMultiTFStats('EURUSD', '1h').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${apiUrl}/filter/bullish-bearish-stats/multi-timeframes`);
    req.error(new ProgressEvent('Network error'));

    expect(response).toEqual({ data: getMockFilters(), isMock: true });
  });

  it('should request benford with maxCandle when provided', () => {
    const payload: FilterCard = { id: 'benford', title: 'Benford', source: 'JAVA', category: 'Structure' };
    let response: { data: FilterCard; isMock: boolean } | undefined;

    service.getBenford('EURUSD', '1h', 200).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${apiUrl}/filter/benford/anomaly`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('EURUSD');
    expect(req.request.params.get('timeframe')).toBe('1h');
    expect(req.request.params.get('maxCandle')).toBe('200');
    req.flush(payload);

    expect(response).toEqual({ data: payload, isMock: false });
  });

  it('should omit maxCandle when not provided and fallback on error', () => {
    let response: { data: FilterCard; isMock: boolean } | undefined;

    service.getBenford('EURUSD', '1h').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${apiUrl}/filter/benford/anomaly`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('EURUSD');
    expect(req.request.params.get('timeframe')).toBe('1h');
    expect(req.request.params.has('maxCandle')).toBe(false);
    req.error(new ProgressEvent('Server error'));

    expect(response).toEqual({ data: getMockBenford(), isMock: true });
  });

  it('should request generic filter with dynamic params', () => {
    let response: { data: { ok: boolean }; isMock: boolean } | undefined;

    service.getGenericFilter<{ ok: boolean }>('custom-filter', { symbol: 'EURUSD', maxCandle: 50 }).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${apiUrl}/filter/custom-filter`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('symbol')).toBe('EURUSD');
    expect(req.request.params.get('maxCandle')).toBe('50');
    req.flush({ ok: true });

    expect(response).toEqual({ data: { ok: true }, isMock: false });
  });

  it('should fallback to mock filters when generic filter fails', () => {
    let response: { data: FilterCard[]; isMock: boolean } | undefined;

    service.getGenericFilter<FilterCard[]>('benford', { symbol: 'EURUSD' }).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${apiUrl}/filter/benford`);
    req.error(new ProgressEvent('Server error'));

    expect(response).toEqual({ data: getMockFilters(card => card.id.includes('benford')), isMock: true });
  });
});
