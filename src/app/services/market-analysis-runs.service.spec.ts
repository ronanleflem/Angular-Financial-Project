import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { MarketAnalysisRunsService } from './market-analysis-runs.service';

describe('MarketAnalysisRunsService', () => {
  let service: MarketAnalysisRunsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });

    service = TestBed.inject(MarketAnalysisRunsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests the runs catalog with all supported query params', () => {
    let response: any;

    service
      .getRuns({
        specType: 'market_stats',
        status: 'SUCCEEDED',
        symbol: 'EURUSD',
        timeframe: '1h',
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-06T00:00:00Z',
        page: 2,
        size: 25,
        sort: 'created_at,desc'
      })
      .subscribe(value => {
        response = value;
      });

    const req = httpMock.expectOne(request => request.url === `${environment.apiUrl}/api/market-analysis/runs`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('spec_type')).toBe('market_stats');
    expect(req.request.params.get('status')).toBe('SUCCEEDED');
    expect(req.request.params.get('symbol')).toBe('EURUSD');
    expect(req.request.params.get('timeframe')).toBe('1h');
    expect(req.request.params.get('from')).toBe('2026-03-01T00:00:00Z');
    expect(req.request.params.get('to')).toBe('2026-03-06T00:00:00Z');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('25');
    expect(req.request.params.get('sort')).toBe('created_at,desc');

    req.flush({
      items: [
        {
          run_id: 'run-1',
          request_id: 'req-1',
          spec_type: 'market_stats',
          status: 'SUCCEEDED',
          created_at: '2026-03-05T10:00:00Z',
          started_at: '2026-03-05T10:01:00Z',
          finished_at: '2026-03-05T10:02:00Z',
          updated_at: '2026-03-05T10:02:00Z',
          error_message: null,
          attempts: 1,
          max_attempts: 3,
          cancel_requested: false,
          persistence_enabled: true,
          spec_id: 'spec-1',
          dataset_id: 'dataset-1'
        }
      ],
      page: 2,
      size: 25,
      total_elements: 51,
      total_pages: 3,
      sort: 'created_at,desc'
    });

    expect(response).toEqual({
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
      page: 2,
      size: 25,
      totalElements: 51,
      totalPages: 3,
      sort: 'created_at,desc'
    });
  });

  it('normalizes missing values to safe defaults', () => {
    let response: any;

    service.getRuns({ symbol: 'BTCUSD' }).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(request => request.url === `${environment.apiUrl}/api/market-analysis/runs`);
    expect(req.request.params.get('symbol')).toBe('BTCUSD');
    req.flush({
      items: [
        {
          run_id: 'run-2',
          request_id: 'req-2',
          spec_type: 'seasonality',
          status: 'QUEUED'
        }
      ]
    });

    expect(response).toEqual({
      items: [
        {
          runId: 'run-2',
          requestId: 'req-2',
          specType: 'seasonality',
          status: 'QUEUED',
          createdAt: null,
          startedAt: null,
          finishedAt: null,
          updatedAt: null,
          errorMessage: null,
          attempts: 0,
          maxAttempts: 0,
          cancelRequested: false,
          persistenceEnabled: false,
          specId: null,
          datasetId: null
        }
      ],
      page: 0,
      size: 0,
      totalElements: 0,
      totalPages: 0,
      sort: null
    });
  });

  it('loads and normalizes run detail', () => {
    let response: any;

    service.getRunDetail('run-1').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/market-analysis/runs/run-1`);
    expect(req.request.method).toBe('GET');
    req.flush({
      run_id: 'run-1',
      request_id: 'req-1',
      spec_type: 'market_stats',
      status: 'SUCCEEDED',
      created_at: '2026-03-05T10:00:00Z',
      started_at: '2026-03-05T10:01:00Z',
      finished_at: '2026-03-05T10:02:00Z',
      updated_at: '2026-03-05T10:02:00Z',
      error_message: null,
      attempts: 1,
      max_attempts: 3,
      cancel_requested: false,
      persistence_enabled: true,
      spec_id: 'spec-1',
      dataset_id: 'dataset-1',
      payload_json: { symbol: 'EURUSD' },
      progress_json: { progress: 100 },
      result_json_available: true
    });

    expect(response).toEqual({
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
    });
  });

  it('loads and normalizes run result', () => {
    let response: any;

    service.getRunResult('run-1').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/market-analysis/runs/run-1/result`);
    expect(req.request.method).toBe('GET');
    req.flush({
      run_id: 'run-1',
      spec_type: 'seasonality',
      source: 'persisted_tables',
      meta: {
        spec_id: 'spec-2',
        dataset_id: 'dataset-2',
        out_dir: '/tmp/out',
        window: '3y',
        start: '2023-01-01',
        end: '2025-12-31',
        status: 'SUCCEEDED'
      },
      data: {
        market_stats_rows: [{ event: 'breakout', n: 10 }],
        seasonality_profiles: [{ profile: 'dow', score: 0.7 }],
        seasonality_run_summary: { trades: 42 },
        raw_result_json: { source: 'json' }
      }
    });

    expect(response).toEqual({
      runId: 'run-1',
      specType: 'seasonality',
      source: 'persisted_tables',
      meta: {
        specId: 'spec-2',
        datasetId: 'dataset-2',
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
    });
  });
});
