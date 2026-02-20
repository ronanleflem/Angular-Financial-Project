import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { RunRequestInput } from '../models/run-request-input.model';
import { RunsService } from './runs.service';

describe('RunsService', () => {
  let service: RunsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });

    service = TestBed.inject(RunsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('submits canonical payload with catalog version', () => {
    const payload: RunRequestInput = {
      runType: 'backtest',
      data: {
        symbol: 'EURUSD',
        timeframe: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      },
      strategy: { name: 'Mean Reversion' },
      signal: { type: 'ema_cross', fast: 12, slow: 26 }
    };

    service.submitRun(payload, { catalogVersion: 'v2' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.spec_type).toBe('backtest');
    expect(req.request.body.catalog_version).toBe('v2');
    expect(req.request.body.data.start_date).toBe('2024-01-01');
    req.flush({ run_id: 'run-1', status: 'PENDING' });
  });

  it('normalizes run id from response', () => {
    let response: any;

    service.submitRun({ runType: 'market_stats', data: { symbol: 'BTCUSD', timeframe: '1h', lookback: 200, statsPack: 'Volatility' }, stats: {
      event: { id: 'vol_spike', params: {} },
      condition: { id: 'trend_regime', params: {} },
      target: { id: 'mean_reversion', params: {} },
      validation: { trainMonths: 12, testMonths: 6, folds: 3, embargoDays: 2 }
    }, persistence: { enabled: false }, output: { outDir: 'artifacts/market-stats' } }).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    expect(req.request.body.persistence).toEqual({ enabled: false });
    expect(req.request.body.output).toEqual({ out_dir: 'artifacts/market-stats' });
    req.flush({ request_id: 'req-123', status: 'PENDING' });

    expect(response.runId).toBe('req-123');
    expect(response.requestId).toBe('req-123');
  });

  it('requests run status and normalizes fields', () => {
    let response: any;

    service.getRunStatus('req-1').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs/req-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ run_id: 'run-9', status: 'RUNNING', updated_at: '2024-01-01T00:00:00Z' });

    expect(response.runId).toBe('run-9');
    expect(response.updatedAt).toBe('2024-01-01T00:00:00Z');
  });

  it('submits seasonality canonical payload without unsupported nested fields', () => {
    service.submitRun({
      runType: 'seasonality',
      data: { symbol: 'SPY', timeframe: '1d', window: 'Monthly', startYear: 2015, endYear: 2024 },
      seasonality: {
        profile: { id: 'by_session', bySession: true, measure: 'return', retHorizon: 5, minSamplesBin: 100, params: {} },
        signal: { method: 'threshold', threshold: 0.01, dims: ['session'], combine: 'and' },
        compute: { maxTrials: 50, searchSpace: 'default' },
        execution: { riskModel: 'fixed_fraction', tpSl: 'tp_2_sl_1' }
      },
      persistence: { enabled: false, specId: 'spec_001', datasetId: 'dataset_main' },
      output: { outDir: 'artifacts/seasonality' }
    }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.data.filter).toBeUndefined();
    expect(req.request.body.data.normalize).toBeUndefined();
    expect(req.request.body.seasonality.validation).toBeUndefined();
    expect(req.request.body.seasonality.persistence).toBeUndefined();
    expect(req.request.body.seasonality.artifacts).toBeUndefined();
    expect(req.request.body.seasonality.profile.by_session).toBeTrue();
    expect(req.request.body.seasonality.signal.dims).toEqual(['session']);
    expect(req.request.body.persistence).toEqual({
      enabled: false,
      spec_id: 'spec_001',
      dataset_id: 'dataset_main'
    });
    expect(req.request.body.output).toEqual({ out_dir: 'artifacts/seasonality' });
    req.flush({ request_id: 'req-seasonality', status: 'PENDING' });
  });

  it('requests run result and normalizes fields', () => {
    let response: any;

    service.getRunResult('run-5').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-5/result`);
    expect(req.request.method).toBe('GET');
    req.flush({ run_id: 'run-5', result: { ok: true } });

    expect(response.runId).toBe('run-5');
    expect(response.result).toEqual({ ok: true });
  });

  it('loads run capabilities for a spec type', () => {
    let response: any;
    service.getRunCapabilities('dca').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=dca`);
    expect(req.request.method).toBe('GET');
    req.flush({ strategy: { grid_presets: ['grid_balanced'] } });

    expect(response.strategy.grid_presets).toEqual(['grid_balanced']);
  });

  it('submits stress_tests canonical payload with only supported fields', () => {
    service.submitRun({
      runType: 'stress_tests',
      data: {
        symbol: 'SPY',
        timeframe: '1d',
        startDate: '2018-01-01',
        endDate: '2024-12-31'
      },
      performance: {
        initialCapital: 50000,
        stressTests: {
          enabled: true,
          method: 'block_bootstrap',
          nSims: 2000,
          seed: 42,
          blockSize: 20
        }
      }
    }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.data).toEqual({
      symbol: 'SPY',
      timeframe: '1d',
      start_date: '2018-01-01',
      end_date: '2024-12-31'
    });
    expect(req.request.body.performance.initial_capital).toBe(50000);
    expect(req.request.body.performance.stress_tests).toEqual({
      enabled: true,
      method: 'block_bootstrap',
      n_sims: 2000,
      seed: 42,
      block_size: 20
    });
    req.flush({ request_id: 'req-stress', status: 'PENDING' });
  });

  it('submits dca canonical payload with top-level universe field', () => {
    service.submitRun({
      runType: 'dca',
      data: {
        symbol: 'BTCUSD',
        timeframe: '1h',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        universe: [{ symbol: 'BTCUSD', assetClass: 'Crypto' }]
      },
      strategy: {
        type: 'dca_equity',
        params: {
          kind: 'dca_equity',
          assetClass: 'CRYPTO',
          drawdownReference: 'ATH',
          executionMode: 'bar_close',
          tpSl: {
            enabled: true,
            mode: 'rule_based',
            tp: { type: 'percent', value: 2 },
            sl: { type: 'percent', value: 1 },
            breakEven: { enabled: true, triggerPct: 1 }
          },
          grid: [{ dd: -5, weight: 1 }],
          requireCrossing: true
        }
      }
    }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.data.universe).toBeUndefined();
    expect(req.request.body.universe).toEqual([{ symbol: 'BTCUSD', asset_class: 'Crypto' }]);
    req.flush({ request_id: 'req-dca', status: 'QUEUED' });
  });

  it('cancels run and normalizes fields', () => {
    let response: any;

    service.cancelRun('run-7').subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-7/cancel`);
    expect(req.request.method).toBe('POST');
    req.flush({ run_id: 'run-7', status: 'CANCELED' });

    expect(response.runId).toBe('run-7');
    expect(response.status).toBe('CANCELED');
  });

  it('surfaces 422 errors from submit', done => {
    service.submitRun({
      runType: 'dca',
      data: { symbol: 'BTCUSD', timeframe: '1h', frequency: 'weekly', amount: 100, startDate: '2024-01-01', endDate: '2024-01-31' },
      strategy: {
        type: 'dca_equity',
        params: {
          kind: 'dca_equity',
          assetClass: 'CRYPTO',
          drawdownReference: 'ATH',
          executionMode: 'bar_close',
          tpSl: {
            enabled: true,
            mode: 'rule_based',
            tp: { type: 'percent', value: 2 },
            sl: { type: 'percent', value: 1 },
            breakEven: { enabled: true, triggerPct: 1 }
          },
          grid: [{ dd: -5, weight: 1 }],
          requireCrossing: true
        }
      }
    })
      .subscribe({
        next: () => done.fail('expected error'),
        error: err => {
          expect(err.status).toBe(422);
          done();
        }
      });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    req.flush({ errors: [{ field: 'data.symbol', code: 'required', message: 'Required' }] }, { status: 422, statusText: 'Unprocessable' });
  });

  it('surfaces 409 errors from cancel', done => {
    service.cancelRun('run-9').subscribe({
      next: () => done.fail('expected error'),
      error: err => {
        expect(err.status).toBe(409);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-9/cancel`);
    req.flush({ message: 'Already terminal' }, { status: 409, statusText: 'Conflict' });
  });
});
