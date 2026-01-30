import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../environments/environment';
import { StressTestsService } from './stress-tests.service';
import { StressTestsSummaryResponse } from '../models/stress-tests.models';

describe('StressTestsService', () => {
  let service: StressTestsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(StressTestsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('uses the summary endpoint when available', () => {
    const summary: StressTestsSummaryResponse = {
      meta: { runId: 'run-1', symbol: 'ES' },
      monteCarlo: {
        parameters: { nSimulations: 100 },
        metricsByDistribution: {
          finalCapital: { p10: 9000, p50: 10000, p90: 11500 }
        },
        curves: {
          equitySample: [[10000, 10100, 10200]],
          percentileBand: { p10: [9000, 9100], p50: [10000, 10100], p90: [11000, 11200] }
        },
        warnings: []
      },
      scenarios: {
        items: [{ name: 'crash', type: 'crash', settings: { shockPct: -0.2 }, metrics: { loss: -0.1 }, curve: [1, 0.8] }],
        warnings: []
      }
    };

    let response: any;
    service.getStressTests('run-1').subscribe(data => {
      response = data;
    });

    const summaryReq = httpMock.expectOne(`${environment.apiUrl}/api/stress-tests/summary?runId=run-1`);
    expect(summaryReq.request.method).toBe('GET');
    summaryReq.flush(summary);

    httpMock.expectNone(`${environment.apiUrl}/api/stress-tests?runId=run-1`);

    expect(response?.source).toBe('summary');
    expect(response?.meta?.runId).toBe('run-1');
    expect(response?.monteCarlo?.curveSamples?.length).toBe(1);
    expect(response?.scenarios?.items?.length).toBe(1);
  });

  it('falls back to the raw endpoint when summary fails', () => {
    let response: any;
    service.getStressTests('run-2').subscribe(data => {
      response = data;
    });

    const summaryReq = httpMock.expectOne(`${environment.apiUrl}/api/stress-tests/summary?runId=run-2`);
    summaryReq.error(new ProgressEvent('Not found'), { status: 404, statusText: 'Not Found' });

    const rawReq = httpMock.expectOne(`${environment.apiUrl}/api/stress-tests?runId=run-2`);
    expect(rawReq.request.method).toBe('GET');
    rawReq.flush([
      {
        mode: 'monte_carlo',
        distributions: { maxDrawdown: { p10: -0.2, p50: -0.1, p90: -0.05 } },
        equity_curves: [[10000, 9900, 10100]],
        warnings: []
      },
      {
        mode: 'scenarios',
        metrics: {
          crash_mid: { loss: -0.15, duration: 5 }
        },
        parameters: {
          scenarios: [{ name: 'crash_mid', type: 'crash', settings: { shockPct: -0.15 } }]
        },
        curves: {
          crash_mid: [1, 0.85, 0.9]
        }
      }
    ]);

    expect(response?.source).toBe('raw');
    expect(response?.monteCarlo?.curveSamples?.length).toBe(1);
    expect(response?.scenarios?.items?.length).toBe(1);
    expect(response?.scenarios?.items?.[0].name).toBe('crash_mid');
  });
});
