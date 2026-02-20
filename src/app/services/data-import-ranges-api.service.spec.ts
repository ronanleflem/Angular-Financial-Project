import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { DataImportRangesApiService } from './data-import-ranges-api.service';

describe('DataImportRangesApiService', () => {
  let service: DataImportRangesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(DataImportRangesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('builds URL with query params', () => {
    service
      .getRanges({ symbol: 'BTCUSDT', insertedType: 'CRYPTO', timeframe: '1h', limit: 200 })
      .subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/api/data-import/ranges?symbol=BTCUSDT&insertedType=CRYPTO&timeframe=1h&limit=200`
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('maps response array to normalized ISO dates', () => {
    let response: any[] = [];
    service.getRanges().subscribe(value => (response = value));

    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'crypto',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-10T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T10:00:00Z'
      }
    ]);

    expect(response).toEqual([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-10T00:00:00.000Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T10:00:00.000Z'
      }
    ]);
  });
});
