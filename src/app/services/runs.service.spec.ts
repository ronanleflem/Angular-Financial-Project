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
        endDate: '2024-01-31',
        strategyName: 'Mean Reversion'
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
      validation: { trainMonths: 12, testMonths: 6, folds: 3, embargoDays: 2 },
      persistence: { enabled: false },
      artifacts: {}
    } }).subscribe(value => {
      response = value;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
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
    service.submitRun({ runType: 'dca', data: { symbol: 'BTCUSD', timeframe: '1h', frequency: 'weekly', amount: 100, startDate: '2024-01-01', endDate: '2024-01-31' }, strategy: { type: 'dca_equity', grid: ['grid'], params: { kind: 'dca_equity', drawdownReference: 'rolling_high', executionMode: 'limit', requireCrossing: true } } })
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
