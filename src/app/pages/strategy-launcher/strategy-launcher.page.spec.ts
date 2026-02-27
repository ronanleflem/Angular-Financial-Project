import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { environment } from '../../../environments/environment';
import { StrategyLauncherPageComponent } from './strategy-launcher.page';

describe('StrategyLauncherPageComponent', () => {
  let fixture: ComponentFixture<StrategyLauncherPageComponent>;
  let component: StrategyLauncherPageComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StrategyLauncherPageComponent, HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule]
    });

    fixture = TestBed.createComponent(StrategyLauncherPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushInitRequests(
    capabilities: unknown = {
      strategy: { grid_presets: ['grid_balanced', 'grid_conservative', 'grid_aggressive'] }
    },
    capabilitiesStatus: { status: number; statusText: string } | null = null,
    backtestCapabilities: unknown = {
      fields: {
        supported: [
          'data.symbol',
          'data.timeframe',
          'data.start_date',
          'data.end_date',
          'signal.type',
          'signal.fast',
          'signal.slow',
          'signal.require_crossing',
          'strategy.params.tp_sl',
          'filters'
        ],
        accepted_but_not_wired: ['strategy.name', 'performance', 'strategy.params.screening']
      }
    },
    backtestCapabilitiesStatus: { status: number; statusText: string } | null = null,
    marketStatsCapabilities: unknown = {},
    marketStatsCapabilitiesStatus: { status: number; statusText: string } | null = null,
    seasonalityCapabilities: unknown = {},
    seasonalityCapabilitiesStatus: { status: number; statusText: string } | null = null
  ) {
    const catalogReq = httpMock.expectOne('/parameter_catalog.json');
    catalogReq.flush({ meta: { version: 'v1' } });
    const capabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=dca`
    );
    if (capabilitiesStatus) {
      capabilitiesReq.flush((capabilities ?? {}) as any, capabilitiesStatus);
    } else {
      capabilitiesReq.flush(capabilities as any);
    }
    const backtestCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=backtest`
    );
    if (backtestCapabilitiesStatus) {
      backtestCapabilitiesReq.flush((backtestCapabilities ?? {}) as any, backtestCapabilitiesStatus);
    } else {
      backtestCapabilitiesReq.flush(backtestCapabilities as any);
    }
    const marketStatsCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=market_stats`
    );
    if (marketStatsCapabilitiesStatus) {
      marketStatsCapabilitiesReq.flush((marketStatsCapabilities ?? {}) as any, marketStatsCapabilitiesStatus);
    } else {
      marketStatsCapabilitiesReq.flush(marketStatsCapabilities as any);
    }
    const seasonalityCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=seasonality`
    );
    if (seasonalityCapabilitiesStatus) {
      seasonalityCapabilitiesReq.flush((seasonalityCapabilities ?? {}) as any, seasonalityCapabilitiesStatus);
      return;
    }
    seasonalityCapabilitiesReq.flush(seasonalityCapabilities as any);
  }

  it('maps backend 422 errors to form controls and global panel', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.submitRun();

    const submitReq = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    submitReq.flush(
      {
        errors: [
          { field: 'data.symbol', code: 'required', message: 'Symbole requis' },
          { field: 'unknown.path', code: 'invalid', message: 'Bad field' }
        ]
      },
      { status: 422, statusText: 'Unprocessable' }
    );

    const symbolErrors = component.dcaForm.get('symbol')?.errors;
    expect(symbolErrors?.['backend']?.message).toBe('Symbole requis');
    expect(component.previewErrors().length).toBe(1);
    expect(component.previewErrors()[0].field).toBe('unknown.path');
  });

  it('shows a global error on submit 409', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.submitRun();

    const submitReq = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    submitReq.flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });

    expect(component.previewErrors().length).toBe(1);
    expect(component.previewErrors()[0].message).toBe('soumission echouee');
  });

  it('shows Not implemented yet markers in backtest unsupported sections', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toMatch(/Backtest \(signal\)[\s\S]*Not implemented yet/);
    expect(text).toMatch(/Dynamic SL[\s\S]*Not implemented yet/);
    expect(text).toMatch(/TP\/SL jitter[\s\S]*Not implemented yet/);
    expect(text).toMatch(/Screening \/ pruning[\s\S]*Not implemented yet/);
  });

  it('builds minimal backtest payload in capabilities mode without non-wired fields', () => {
    fixture.detectChanges();
    flushInitRequests(
      { strategy: { grid_presets: ['grid_balanced'] } },
      null,
      {
        fields: {
          supported: [
            'data.symbol',
            'data.timeframe',
            'data.start_date',
            'data.end_date',
            'signal.type',
            'signal.fast',
            'signal.slow'
          ],
          accepted_but_not_wired: ['strategy.name', 'strategy.params.tp_sl', 'filters', 'performance']
        }
      }
    );

    component.selectRun('backtests');
    component.backtestForm.patchValue({
      includePerformance: true,
      strategy: 'Mean Reversion',
      signalType: 'ema_rsi'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('backtest');
    expect(payload.strategy).toEqual(
      jasmine.objectContaining({
        params: jasmine.objectContaining({
          assetClass: 'CRYPTO'
        })
      })
    );
    expect(payload.filters).toBeUndefined();
    expect(payload.performance).toBeUndefined();
    expect(payload.signal).toEqual(
      jasmine.objectContaining({
        type: 'ema_cross',
        fast: jasmine.any(Number),
        slow: jasmine.any(Number)
      })
    );
  });

  it('builds backtest payload in auto source mode without explicit source fields when implicit resolution is supported', () => {
    fixture.detectChanges();
    flushInitRequests(
      {},
      null,
      {
        fields: {
          supported: [
            'data.symbol',
            'data.timeframe',
            'data.start_date',
            'data.end_date',
            'signal.type',
            'signal.fast',
            'signal.slow'
          ],
          accepted_but_not_wired: []
        },
        data_source_resolution: {
          implicit_supported: true,
          supported_modes: ['auto', 'csv_path', 'mysql_config']
        }
      }
    );

    component.selectRun('backtests');
    component.backtestForm.patchValue({ sourceMode: 'auto' } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.strategy.params.assetClass).toBe('CRYPTO');
    expect(payload.data.assetClass).toBeUndefined();
    expect(payload.data.source).toBeUndefined();
    expect(payload.data.path).toBeUndefined();
    expect(payload.data.mysql).toBeUndefined();
    expect(payload.data.mysqlEnv).toBeUndefined();
  });

  it('builds backtest payload with explicit CSV source', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    component.backtestForm.patchValue({
      sourceMode: 'csv_path',
      csvPath: 'C:\\\\data\\\\backtest.csv'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.strategy.params.assetClass).toBe('CRYPTO');
    expect(payload.data.assetClass).toBeUndefined();
    expect(payload.data.currency).toBe('USDT');
    expect(payload.data.source).toBe('csv');
    expect(payload.data.path).toBe('C:\\\\data\\\\backtest.csv');
  });

  it('builds backtest payload with explicit MySQL source', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    component.backtestForm.patchValue({
      sourceMode: 'mysql_config',
      mysqlEnv: '',
      mysqlHost: '127.0.0.1',
      mysqlPort: 3307,
      mysqlDatabase: 'market_data',
      mysqlTable: 'ohlcv',
      mysqlUser: 'bt_user',
      mysqlPassword: 'secret'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.strategy.params.assetClass).toBe('CRYPTO');
    expect(payload.data.source).toBe('mysql');
    expect(payload.data.mysql).toEqual({
      host: '127.0.0.1',
      port: 3307,
      database: 'market_data',
      table: 'ohlcv',
      user: 'bt_user',
      password: 'secret'
    });
  });

  it('marks backtest form invalid in auto mode when backend requires explicit source', () => {
    fixture.detectChanges();
    flushInitRequests(
      {},
      null,
      {
        fields: {
          supported: [
            'data.symbol',
            'data.timeframe',
            'data.start_date',
            'data.end_date',
            'signal.type',
            'signal.fast',
            'signal.slow'
          ],
          accepted_but_not_wired: []
        },
        data_source_resolution: {
          implicit_supported: false,
          supported_modes: ['csv_path', 'mysql_config']
        }
      }
    );

    component.selectRun('backtests');
    component.backtestForm.patchValue({ sourceMode: 'auto' } as any);
    component.backtestForm.updateValueAndValidity();

    expect(component.backtestForm.errors?.['sourceRequired']).toBeTrue();
    expect(component.backtestForm.invalid).toBeTrue();
  });

  it('falls back to static mode when backtest capabilities endpoint is unavailable', () => {
    fixture.detectChanges();
    flushInitRequests(
      { strategy: { grid_presets: ['grid_balanced'] } },
      null,
      {},
      { status: 503, statusText: 'Service Unavailable' }
    );

    component.selectRun('backtests');
    component.backtestForm.patchValue({ includePerformance: true } as any);
    const payload = component.buildRunRequest() as any;

    expect(component.backtestCapabilitiesInfo()).toContain('mode statique');
    expect(payload.runType).toBe('backtest');
    expect(payload.filters).toBeDefined();
  });

  it('uses market_stats capabilities to mark accepted-but-not-wired fields', () => {
    fixture.detectChanges();
    flushInitRequests(
      {},
      null,
      {},
      null,
      {
        fields: {
          supported: ['data.symbol', 'data.timeframe', 'data.currency'],
          accepted_but_not_wired: ['data.currency']
        }
      }
    );

    expect(component.marketStatsCapabilitiesInfo()).toContain('capabilities market_stats actif');
    expect(component.isMarketStatsFieldSupported('data.symbol')).toBeTrue();
    expect(component.isMarketStatsFieldRuntimeWired('data.symbol')).toBeTrue();
    expect(component.isMarketStatsFieldSupported('data.currency')).toBeTrue();
    expect(component.isMarketStatsFieldRuntimeWired('data.currency')).toBeFalse();
  });

  it('enforces required dynamic market-stats params with min(1) for integer required fields', () => {
    fixture.detectChanges();
    const catalogReq = httpMock.expectOne('/parameter_catalog.json');
    catalogReq.flush({
      meta: { version: 'v1' },
      enums: {
        'stats.events': ['k_consecutive'],
        'stats.conditions': ['htf_trend'],
        'stats.targets': ['time_to_reversal']
      },
      stats_expanded: {
        events: {
          k_consecutive: {
            params: [
              { name: 'k', type: 'int', required: true },
              { name: 'direction', type: 'string', enum: ['up', 'down'], required: true }
            ]
          }
        },
        conditions: {
          htf_trend: {
            params: [
              { name: 'tf_multiplier', type: 'int', required: true },
              { name: 'ema_period', type: 'int', required: true }
            ]
          }
        },
        targets: {
          time_to_reversal: {
            params: [{ name: 'max_horizon', type: 'int', required: true }]
          }
        }
      }
    } as any);
    const dcaCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=dca`);
    dcaCapabilitiesReq.flush({} as any);
    const backtestCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=backtest`);
    backtestCapabilitiesReq.flush({} as any);
    const marketStatsCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=market_stats`);
    marketStatsCapabilitiesReq.flush({} as any);
    const seasonalityCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=seasonality`);
    seasonalityCapabilitiesReq.flush({} as any);

    component.selectRun('market-stats');
    component.marketStatsForm.patchValue({
      eventId: 'k_consecutive',
      conditionId: 'htf_trend',
      targetId: 'time_to_reversal',
      event_k_consecutive_k: 0,
      event_k_consecutive_direction: '',
      condition_htf_trend_tf_multiplier: 0,
      condition_htf_trend_ema_period: 0,
      target_time_to_reversal_max_horizon: 0
    } as any);
    component.marketStatsForm.updateValueAndValidity();

    expect(component.marketStatsForm.get('event_k_consecutive_k')?.invalid).toBeTrue();
    expect(component.marketStatsForm.get('event_k_consecutive_direction')?.invalid).toBeTrue();
    expect(component.marketStatsForm.get('condition_htf_trend_tf_multiplier')?.invalid).toBeTrue();
    expect(component.marketStatsForm.get('condition_htf_trend_ema_period')?.invalid).toBeTrue();
    expect(component.marketStatsForm.get('target_time_to_reversal_max_horizon')?.invalid).toBeTrue();
    expect(component.marketStatsForm.invalid).toBeTrue();
  });

  it('does not auto-send invalid/empty required market-stats params', () => {
    fixture.detectChanges();
    const catalogReq = httpMock.expectOne('/parameter_catalog.json');
    catalogReq.flush({
      meta: { version: 'v1' },
      enums: {
        'stats.events': ['k_consecutive'],
        'stats.conditions': ['htf_trend'],
        'stats.targets': ['continuation_n']
      },
      stats_expanded: {
        events: {
          k_consecutive: {
            params: [
              { name: 'k', type: 'int', required: true },
              { name: 'direction', type: 'string', enum: ['up', 'down'], required: true }
            ]
          }
        },
        conditions: {
          htf_trend: {
            params: [
              { name: 'tf_multiplier', type: 'int', required: true },
              { name: 'ema_period', type: 'int', required: true }
            ]
          }
        },
        targets: {
          continuation_n: {
            params: [
              { name: 'n', type: 'int', required: true },
              { name: 'direction', type: 'string', enum: ['up', 'down'], required: true }
            ]
          }
        }
      }
    } as any);
    const dcaCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=dca`);
    dcaCapabilitiesReq.flush({} as any);
    const backtestCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=backtest`);
    backtestCapabilitiesReq.flush({} as any);
    const marketStatsCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=market_stats`);
    marketStatsCapabilitiesReq.flush({} as any);
    const seasonalityCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=seasonality`);
    seasonalityCapabilitiesReq.flush({} as any);

    component.selectRun('market-stats');
    component.marketStatsForm.patchValue({
      eventId: 'k_consecutive',
      conditionId: 'htf_trend',
      targetId: 'continuation_n',
      event_k_consecutive_k: null,
      event_k_consecutive_direction: '',
      condition_htf_trend_tf_multiplier: 0,
      condition_htf_trend_ema_period: null,
      target_continuation_n_n: 0,
      target_continuation_n_direction: ''
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.stats.event.params).toEqual({});
    expect(payload.stats.condition.params).toEqual({});
    expect(payload.stats.target.params).toEqual({});
  });

  it('does not invalidate market-stats form with required params from non-selected ids', () => {
    fixture.detectChanges();
    const catalogReq = httpMock.expectOne('/parameter_catalog.json');
    catalogReq.flush({
      meta: { version: 'v1' },
      enums: {
        'stats.events': ['k_consecutive', 'shock_atr'],
        'stats.conditions': ['htf_trend', 'vol_tertile'],
        'stats.targets': ['continuation_n', 'time_to_reversal']
      },
      stats_expanded: {
        events: {
          k_consecutive: {
            params: [
              { name: 'k', type: 'int', required: true },
              { name: 'direction', type: 'string', enum: ['up', 'down'], required: true }
            ]
          },
          shock_atr: {
            params: [
              { name: 'mult', type: 'float', required: true },
              { name: 'window', type: 'int', required: true }
            ]
          }
        },
        conditions: {
          htf_trend: {
            params: [
              { name: 'tf_multiplier', type: 'int', required: true },
              { name: 'ema_period', type: 'int', required: true }
            ]
          },
          vol_tertile: {
            params: [{ name: 'window', type: 'int', required: true }]
          }
        },
        targets: {
          continuation_n: {
            params: [
              { name: 'n', type: 'int', required: true },
              { name: 'direction', type: 'string', enum: ['up', 'down'], required: true }
            ]
          },
          time_to_reversal: {
            params: [{ name: 'max_horizon', type: 'int', required: true }]
          }
        }
      }
    } as any);
    const dcaCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=dca`);
    dcaCapabilitiesReq.flush({} as any);
    const backtestCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=backtest`);
    backtestCapabilitiesReq.flush({} as any);
    const marketStatsCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=market_stats`);
    marketStatsCapabilitiesReq.flush({} as any);
    const seasonalityCapabilitiesReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/capabilities?spec_type=seasonality`);
    seasonalityCapabilitiesReq.flush({} as any);

    component.selectRun('market-stats');
    component.marketStatsForm.patchValue({
      eventId: 'k_consecutive',
      conditionId: 'htf_trend',
      targetId: 'continuation_n',
      event_k_consecutive_k: 3,
      event_k_consecutive_direction: 'up',
      condition_htf_trend_tf_multiplier: 2,
      condition_htf_trend_ema_period: 20,
      target_continuation_n_n: 2,
      target_continuation_n_direction: 'up',
      event_shock_atr_mult: null,
      event_shock_atr_window: null,
      condition_vol_tertile_window: null,
      target_time_to_reversal_max_horizon: null
    } as any);
    component.marketStatsForm.updateValueAndValidity();

    expect(component.marketStatsForm.get('event_shock_atr_mult')?.invalid).toBeFalse();
    expect(component.marketStatsForm.get('event_shock_atr_window')?.invalid).toBeFalse();
    expect(component.marketStatsForm.get('condition_vol_tertile_window')?.invalid).toBeFalse();
    expect(component.marketStatsForm.get('target_time_to_reversal_max_horizon')?.invalid).toBeFalse();
    expect(component.marketStatsForm.invalid).toBeFalse();
  });

  it('enables market-stats multi-symbol mode when data.symbols is supported', () => {
    fixture.detectChanges();
    flushInitRequests(
      {},
      null,
      {},
      null,
      {
        fields: {
          supported: ['data.symbols', 'data.timeframe', 'data.currency'],
          accepted_but_not_wired: []
        }
      }
    );

    expect(component.marketStatsUsesMultiSymbols()).toBeTrue();

    component.selectRun('market-stats');
    component.marketStatsForm.patchValue({
      useDeltaPreset: false,
      symbols: ['BTC', 'ETH'],
      symbol: 'AAPL'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.data.symbols).toEqual(['BTC', 'ETH']);
    expect(payload.data.symbol).toBeUndefined();
  });

  it('falls back to static mode when market_stats capabilities endpoint is unavailable', () => {
    fixture.detectChanges();
    flushInitRequests(
      {},
      null,
      {},
      null,
      {},
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(component.marketStatsCapabilitiesInfo()).toContain('mode statique');
    expect(component.isMarketStatsFieldSupported('data.currency')).toBeTrue();
    expect(component.isMarketStatsFieldRuntimeWired('data.currency')).toBeTrue();
  });

  it('uses seasonality capabilities to mark accepted-but-not-wired fields', () => {
    fixture.detectChanges();
    flushInitRequests(
      {},
      null,
      {},
      null,
      {},
      null,
      {
        fields: {
          supported: ['data.symbol', 'data.window', 'data.timeframe'],
          accepted_but_not_wired: ['data.window']
        }
      }
    );

    expect(component.seasonalityCapabilitiesInfo()).toContain('capabilities seasonality actif');
    expect(component.isSeasonalityFieldSupported('data.window')).toBeTrue();
    expect(component.isSeasonalityFieldRuntimeWired('data.window')).toBeFalse();
  });

  it('disables seasonality execution block and omits execution payload when runtime is not wired', () => {
    fixture.detectChanges();
    flushInitRequests(
      {},
      null,
      {},
      null,
      {},
      null,
      {
        fields: {
          supported: ['data.symbol', 'seasonality.execution'],
          accepted_but_not_wired: ['seasonality.execution']
        }
      }
    );

    component.selectRun('seasonality');
    fixture.detectChanges();

    expect(component.isSeasonalityExecutionRuntimeWired()).toBeFalse();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('accepted_but_not_wired runtime (Not implemented yet).');

    const payload = component.buildRunRequest() as any;
    expect(payload.seasonality.execution).toBeUndefined();
  });

  it('enables seasonality multi-symbol mode when data.symbols is supported', () => {
    fixture.detectChanges();
    flushInitRequests(
      {},
      null,
      {},
      null,
      {},
      null,
      {
        fields: {
          supported: ['data.symbols', 'data.timeframe', 'data.window'],
          accepted_but_not_wired: []
        }
      }
    );

    expect(component.seasonalityUsesMultiSymbols()).toBeTrue();

    component.selectRun('seasonality');
    component.seasonalityForm.patchValue({
      useDeltaPreset: false,
      symbols: ['BTC', 'ETH'],
      symbol: 'SPY'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.data.symbols).toEqual(['BTC', 'ETH']);
    expect(payload.data.symbol).toBeUndefined();
  });

  it('normalizes backend unsupported errors to Not implemented yet', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    component.submitRun();

    const submitReq = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    submitReq.flush(
      {
        errors: [
          {
            field: 'signal.type',
            code: 'not_implemented_feature',
            message: 'Feature not implemented for canonical backtest run'
          },
          {
            field: 'unknown.path',
            code: 'not_implemented_feature',
            message: 'accepted_but_not_wired'
          }
        ]
      },
      { status: 422, statusText: 'Unprocessable' }
    );

    const signalErrors = component.backtestForm.get('signalType')?.errors;
    expect(signalErrors?.['backend']?.message).toBe('Not implemented yet');
    expect(component.previewErrors()[0].message).toBe('Not implemented yet');
  });

  it('does not remap generic unsupported backend errors to Not implemented yet', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    component.submitRun();

    const submitReq = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    submitReq.flush(
      {
        errors: [
          {
            field: 'signal.type',
            code: 'unsupported_value',
            message: 'Unsupported signal type'
          }
        ]
      },
      { status: 422, statusText: 'Unprocessable' }
    );

    const signalErrors = component.backtestForm.get('signalType')?.errors;
    expect(signalErrors?.['backend']?.message).toBe('Unsupported signal type');
  });

  it('builds stress-tests payload with canonical fields and hides advanced by default', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('stress-tests');
    const stressCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=stress_tests`
    );
    stressCapabilitiesReq.flush({
      fields: {
        supported: ['data.base_run_id', 'performance.stress_tests.method', 'performance.stress_tests.n_sims'],
        accepted_but_not_wired: []
      }
    } as any);
    const stressSourcesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/stress/sources?limit=200`
    );
    stressSourcesReq.flush({
      items: [
        {
          run_id: 'run-base-1',
          spec_type: 'backtest',
          data: { symbol: 'EURUSD', timeframe: '1h' },
          created_at: '2025-01-10T00:00:00Z'
        }
      ]
    } as any);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Inclure options avancees stress tests');
    expect(component.stressForm.get('includeStressAdvanced')?.value).toBeFalse();
    expect(String(component.stressForm.get('baseRunId')?.value ?? '')).toBe('run-base-1');

    const payload = component.buildRunRequest();
    expect(payload.runType).toBe('stress_tests');
    expect((payload as any).data.baseRunId).toBe('run-base-1');
    expect((payload as any).data.symbol).toBeUndefined();
    expect((payload as any).data.timeframe).toBeUndefined();
    expect((payload as any).data.startDate).toBeUndefined();
    expect((payload as any).data.endDate).toBeUndefined();
    expect((payload as any).performance.stressTests).toEqual(
      jasmine.objectContaining({
        enabled: true,
        method: jasmine.any(String),
        nSims: jasmine.any(Number),
        seed: jasmine.any(Number),
        blockSize: jasmine.any(Number)
      })
    );
    expect((payload as any).performance.stressTests.source).toBeUndefined();
    expect((payload as any).performance.stressTests.overlapping).toBeUndefined();
    expect((payload as any).performance.stressTests.timeDistribution).toBeUndefined();
    expect((payload as any).performance.stressTests.scenarios).toEqual([]);
  });

  it('builds stress-tests payload with advanced fields when enabled', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('stress-tests');
    const stressCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=stress_tests`
    );
    stressCapabilitiesReq.flush({
      fields: {
        supported: [
          'data.base_run_id',
          'performance.stress_tests.source',
          'performance.stress_tests.n_sims',
          'performance.stress_tests.seed',
          'performance.stress_tests.method',
          'performance.stress_tests.block_size',
          'performance.stress_tests.overlapping',
          'performance.stress_tests.time_distribution.mode',
          'performance.stress_tests.time_distribution.seed',
          'performance.stress_tests.param_drift.mode',
          'performance.stress_tests.param_drift.dist',
          'performance.stress_tests.param_drift.mu',
          'performance.stress_tests.param_drift.sigma',
          'performance.stress_tests.param_drift.low',
          'performance.stress_tests.param_drift.high',
          'performance.stress_tests.param_drift.min',
          'performance.stress_tests.param_drift.max',
          'performance.stress_tests.param_drift.seed',
          'performance.stress_tests.sizing.dist',
          'performance.stress_tests.sizing.mu',
          'performance.stress_tests.sizing.sigma',
          'performance.stress_tests.sizing.low',
          'performance.stress_tests.sizing.high',
          'performance.stress_tests.sizing.min',
          'performance.stress_tests.sizing.max',
          'performance.stress_tests.output.mode',
          'performance.stress_tests.output.max_curves',
          'performance.stress_tests.output.curve_stride',
          'performance.stress_tests.scenarios',
          'performance.stress_tests.multi_asset.aggregation',
          'performance.stress_tests.multi_asset.weights',
          'performance.stress_tests.multi_asset.timestamp_alignment'
        ],
        accepted_but_not_wired: []
      }
    } as any);
    const stressSourcesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/stress/sources?limit=200`
    );
    stressSourcesReq.flush({
      items: [{ run_id: 'run-base-adv', spec_type: 'dca', data: { symbol: 'SPY', timeframe: '1d' } }]
    } as any);

    component.stressForm.patchValue({
      includeStressAdvanced: true,
      baseRunId: 'run-base-adv',
      source: 'returns',
      overlapping: true,
      timeDistMode: 'business',
      timeDistSeed: 17,
      paramDriftMode: 'stochastic',
      paramDriftDist: 'normal',
      paramDriftMu: 0.1,
      paramDriftSigma: 0.2,
      paramDriftLow: -0.5,
      paramDriftHigh: 0.5,
      paramDriftMin: -0.8,
      paramDriftMax: 0.8,
      paramDriftSeed: 21,
      sizingDist: 'lognormal',
      sizingMu: 0.2,
      sizingSigma: 0.6,
      sizingLow: 0.5,
      sizingHigh: 1.7,
      sizingMin: 0.2,
      sizingMax: 2.2,
      outputMode: 'full',
      outputMaxCurves: 30,
      outputCurveStride: 2,
      scenario1Type: 'shock',
      scenario1Name: 'Crash shock',
      scenario1ShockPct: 10,
      scenario1VolMultiplier: 1.5,
      scenario1DrawdownPct: 15,
      scenario1Window: 20,
      scenario1Index: '12',
      aggregation: 'weighted',
      weights: '0.6,0.4',
      timestampAlignment: 'asof'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('stress_tests');
    expect(payload.data.baseRunId).toBe('run-base-adv');
    expect(payload.performance.stressTests.source).toBe('returns');
    expect(payload.performance.stressTests.overlapping).toBeTrue();
    expect(payload.performance.stressTests.timeDistribution).toEqual({ mode: 'business', seed: 17 });
    expect(payload.performance.stressTests.paramDrift).toEqual(jasmine.objectContaining({ mode: 'stochastic', dist: 'normal', mu: 0.1 }));
    expect(payload.performance.stressTests.sizing).toEqual(jasmine.objectContaining({ dist: 'lognormal', mu: 0.2 }));
    expect(payload.performance.stressTests.output).toEqual({ mode: 'full', maxCurves: 30, curveStride: 2 });
    expect(payload.performance.stressTests.scenarios.length).toBeGreaterThan(0);
    expect(payload.performance.stressTests.scenarios[0].name).toBe('Crash shock');
    expect(payload.performance.stressTests.scenarios[0].index).toBe(12);
    expect(payload.performance.stressTests.multiAsset).toEqual({
      aggregation: 'weighted',
      weights: [0.6, 0.4],
      timestampAlignment: 'asof'
    });
  });

  it('loads stress source runs with filters and displays matching options', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('stress-tests');
    const stressCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=stress_tests`
    );
    stressCapabilitiesReq.flush({ fields: { supported: [], accepted_but_not_wired: [] } } as any);
    const initialStressSourcesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/stress/sources?limit=200`
    );
    initialStressSourcesReq.flush({ items: [] } as any);

    component.stressForm.patchValue({
      sourceSpecType: 'backtest',
      sourceSearch: 'eurusd',
      sourceStartDate: new Date('2025-01-01T00:00:00Z'),
      sourceEndDate: new Date('2025-01-31T00:00:00Z')
    } as any);
    component.loadStressSources();

    const stressSourcesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/stress/sources?spec_type=backtest&date_from=2025-01-01&date_to=2025-01-31&q=eurusd&limit=200`
    );
    stressSourcesReq.flush({
      items: [
        {
          run_id: 'run-base-2',
          spec_type: 'backtest',
          data: { symbol: 'EURUSD', timeframe: '4h' },
          created_at: '2025-01-15T10:00:00Z'
        }
      ]
    } as any);

    expect(component.stressSourceRunOptions().length).toBe(1);
    expect(component.stressSourceRunOptions()[0].runId).toBe('run-base-2');
    expect(String(component.stressForm.get('baseRunId')?.value ?? '')).toBe('run-base-2');
  });

  it('does not submit stress-tests when baseRunId is missing', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('stress-tests');
    const stressCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=stress_tests`
    );
    stressCapabilitiesReq.flush({ fields: { supported: [], accepted_but_not_wired: [] } } as any);
    const stressSourcesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/stress/sources?limit=200`
    );
    stressSourcesReq.flush({ items: [] } as any);

    component.stressForm.patchValue({ baseRunId: '' } as any);
    component.submitRun();

    httpMock.expectNone(`${environment.apiUrl}/api/runs`);
    expect(component.previewErrors().some(err => err.path === 'data.baseRunId')).toBeTrue();
  });

  it('accepts nSims below 100 for stress-tests (e.g. 25)', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('stress-tests');
    const stressCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=stress_tests`
    );
    stressCapabilitiesReq.flush({ fields: { supported: [], accepted_but_not_wired: [] } } as any);
    const stressSourcesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/stress/sources?limit=200`
    );
    stressSourcesReq.flush({ items: [{ run_id: 'run-base-25', spec_type: 'backtest' }] } as any);

    component.stressForm.patchValue({ baseRunId: 'run-base-25', nSims: 25 } as any);
    expect(component.stressForm.get('nSims')?.valid).toBeTrue();
    expect(component.stressForm.invalid).toBeFalse();
  });

  it('keeps dca payload canonical even if advanced toggle is enabled', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('dca');
    component.dcaForm.patchValue({ includeDcaAdvanced: true, frequency: 'weekly', amount: 1000 } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('dca');
    expect(payload.data.frequency).toBeUndefined();
    expect(payload.data.amount).toBeUndefined();
    expect(payload.data.feePct).toBeUndefined();
    expect(payload.data.broker).toBeUndefined();
    expect(payload.data.reinvestDividends).toBeUndefined();
  });

  it('maps dca grid preset to strategy.params.grid and never emits strategy.grid', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('dca');
    component.dcaForm.patchValue({ strategyType: 'dca_equity', gridPresets: ['grid_balanced'] } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.strategy.grid).toBeUndefined();
    expect(payload.data.assetClass).toBeUndefined();
    expect(payload.data.currency).toBe('USDT');
    expect(payload.strategy.params.assetClass).toBe('CRYPTO');
    expect(payload.strategy.params.grid).toEqual([
      { dd: -5, weight: 1 },
      { dd: -10, weight: 1 },
      { dd: -15, weight: 1 }
    ]);
  });

  it('maps dca tp/sl form to strategy.params.tpSl object (never string)', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('dca');
    component.dcaForm.patchValue({
      strategyType: 'dca_equity',
      tpSlEnabled: true,
      tpSlMode: 'rule_based',
      tpValue: 2,
      slValue: 1,
      breakEvenEnabled: true,
      breakEvenTriggerPct: 1
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(typeof payload.strategy.params.tpSl).toBe('object');
    expect(payload.strategy.params.tpSl).toEqual({
      enabled: true,
      mode: 'rule_based',
      tp: { type: 'percent', value: 2 },
      sl: { type: 'percent', value: 1 },
      breakEven: { enabled: true, triggerPct: 1 }
    });
  });

  it('emits strategy.params.grid for crypto_grid', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('dca');
    component.dcaForm.patchValue({
      strategyType: 'crypto_grid',
      gridPresets: ['grid_balanced'],
      cryptoTpSlPreset: 'tp_2_sl_1'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.strategy.type).toBe('crypto_grid');
    expect(payload.strategy.params.grid).toEqual([
      { dd: -5, weight: 1 },
      { dd: -10, weight: 1 },
      { dd: -15, weight: 1 }
    ]);
  });

  it('forces CRYPTO asset_class and keeps rules empty for crypto_grid when none selected', () => {
    fixture.detectChanges();
    flushInitRequests({
      filters: {
        supported_ids: {
          filters: ['volatility_guard'],
          rules: ['drawdown_guard']
        }
      }
    });

    component.selectRun('dca');
    component.dcaForm.patchValue({
      strategyType: 'crypto_grid',
      assetClass: 'ETF',
      filterRules: ['momentum_alignment'],
      gridPresets: ['grid_balanced']
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.strategy.params.assetClass).toBe('CRYPTO');
    expect(payload.filters.rules).toEqual([]);
  });

  it('does not auto-inject rule when filterRules selection is empty', () => {
    fixture.detectChanges();
    flushInitRequests({
      filters: {
        supported_ids: {
          filters: ['volatility_guard'],
          rules: ['adx']
        }
      }
    });

    component.selectRun('dca');
    component.dcaForm.patchValue({
      strategyType: 'crypto_grid',
      filterRules: []
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.filters.rules).toEqual([]);
  });

  it('rejects invalid dca execution/drawdown/tp-sl values in angular validation', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('dca');
    component.dcaForm.patchValue({
      assetClass: '',
      executionMode: 'limit',
      drawdownReference: 'rolling_high',
      tpSlEnabled: true,
      tpSlMode: 'invalid_mode',
      tpValue: 0,
      slValue: 0
    } as any);

    expect(component.dcaForm.get('assetClass')?.invalid).toBeTrue();
    expect(component.dcaForm.get('executionMode')?.invalid).toBeTrue();
    expect(component.dcaForm.get('drawdownReference')?.invalid).toBeTrue();
    expect(component.dcaForm.errors?.['tpSlModeInvalid']).toBeTrue();
    expect(component.dcaForm.errors?.['tpValueInvalid']).toBeTrue();
    expect(component.dcaForm.errors?.['slValueInvalid']).toBeTrue();
    expect(component.dcaForm.invalid).toBeTrue();
  });

  it('shows seasonality UTC session buckets help', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('seasonality');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Session UTC buckets');
    expect(text).toContain('Asia: 00:00-06:59');
    expect(text).toContain('Europe: 07:00-11:59');
    expect(text).toContain('EU_US_overlap: 12:00-15:59');
    expect(text).toContain('US: 16:00-20:59');
    expect(text).toContain('Other: 21:00-23:59');
  });

  it('disables unsupported dca grid options when capabilities are available', () => {
    fixture.detectChanges();
    flushInitRequests({
      presets: {
        supported: { strategy: { grid: ['grid_balanced'] } }
      },
      legacy_dca: {
        fields: {
          supported: ['data.frequency', 'data.amount'],
          not_in_canonical: ['data.universe']
        }
      }
    });

    component.selectRun('dca');
    fixture.detectChanges();

    expect(component.isDcaGridSupported('grid_balanced')).toBeTrue();
    expect(component.isDcaGridSupported('grid_conservative')).toBeFalse();
    expect(component.isDcaGridSupported('grid_aggressive')).toBeFalse();
    expect(component.dcaCapabilitiesInfo()).toContain('Mode capabilities actif');
    expect(component.dcaLegacyOnlyFields()).toEqual(['data.universe']);
    expect(component.dcaLegacySupportedFields()).toEqual(['data.frequency', 'data.amount']);
    expect(component.isLegacyOnlyDcaField('data.universe')).toBeTrue();
  });

  it('computes legacy-only fields from supported_in_legacy_runner minus canonical_passthrough_supported', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'strategy.params.grid'],
        accepted_but_not_wired: ['strategy.grid']
      },
      legacy_dca: {
        fields: {
          supported_in_legacy_runner: ['data.frequency', 'data.amount', 'data.universe'],
          canonical_passthrough_supported: ['data.frequency', 'data.amount']
        }
      }
    });

    component.selectRun('dca');
    fixture.detectChanges();

    expect(component.dcaCanonicalSupportedFields()).toEqual(['data.symbol', 'strategy.params.grid']);
    expect(component.dcaCanonicalAcceptedButNotWiredFields()).toEqual(['strategy.grid']);
    expect(component.dcaLegacySupportedFields()).toEqual(['data.frequency', 'data.amount', 'data.universe']);
    expect(component.dcaLegacyOnlyFields()).toEqual(['data.universe']);
    expect(component.isLegacyOnlyDcaField('data.universe')).toBeTrue();
    expect(component.isLegacyOnlyDcaField('data.frequency')).toBeFalse();
  });

  it('loads filters and rules options from capabilities filters.supported_ids', () => {
    fixture.detectChanges();
    flushInitRequests({
      filters: {
        supported_ids: {
          filters: ['volatility_guard', 'liquidity_spread'],
          rules: ['drawdown_guard']
        }
      }
    });

    expect(component.backtestFilterOptions.map(option => option.id)).toEqual([
      'volatility_guard',
      'liquidity_spread'
    ]);
    expect(component.backtestRuleOptions.map(option => option.id)).toEqual(['drawdown_guard']);
  });

  it('emits backtest rule params from catalog-backed capabilities options', () => {
    fixture.detectChanges();
    const catalogReq = httpMock.expectOne('/parameter_catalog.json');
    catalogReq.flush({
      meta: { version: 'v1' },
      filters_expanded: {
        items: {
          adx: {
            summary: 'ADX',
            params: [
              { name: 'window', type: 'int' },
              { name: 'threshold', type: 'float' }
            ]
          }
        }
      }
    } as any);
    const dcaCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=dca`
    );
    dcaCapabilitiesReq.flush({} as any);
    const backtestCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=backtest`
    );
    backtestCapabilitiesReq.flush({
      fields: {
        supported: [
          'data.symbol',
          'data.timeframe',
          'data.start_date',
          'data.end_date',
          'signal.type',
          'signal.fast',
          'signal.slow',
          'signal.require_crossing',
          'filters',
          'filters.rules'
        ],
        accepted_but_not_wired: []
      },
      filters: {
        supported_ids: {
          filters: ['volatility_guard'],
          rules: ['adx']
        }
      }
    } as any);
    const marketStatsCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=market_stats`
    );
    marketStatsCapabilitiesReq.flush({} as any);
    const seasonalityCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=seasonality`
    );
    seasonalityCapabilitiesReq.flush({} as any);

    component.selectRun('backtests');
    component.backtestForm.patchValue({
      filterRules: ['adx'],
      filter_adx_window: 14,
      filter_adx_threshold: 25
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.filters.filters).toEqual([
      jasmine.objectContaining({
        id: 'adx',
        params: {
          window: 14,
          threshold: 25
        }
      })
    ]);
    expect(payload.filters.rules).toEqual([
      jasmine.objectContaining({
        id: 'adx',
        mode: 'soft',
        weight: 0.5
      })
    ]);
  });

  it('does not emit backtest filter rules when filters.rules is not runtime wired', () => {
    fixture.detectChanges();
    flushInitRequests(
      {},
      null,
      {
        fields: {
          supported: [
            'data.symbol',
            'data.timeframe',
            'data.start_date',
            'data.end_date',
            'signal.type',
            'signal.fast',
            'signal.slow',
            'signal.require_crossing',
            'filters'
          ],
          accepted_but_not_wired: ['filters.rules']
        },
        filters: {
          supported_ids: {
            filters: ['volatility_guard'],
            rules: ['drawdown_guard']
          }
        }
      }
    );

    component.selectRun('backtests');
    component.backtestForm.patchValue({
      filterRules: ['drawdown_guard']
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.filters.rules).toEqual([]);
  });

  it('builds dca payload with canonical universe for one selected symbol', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'universe', 'strategy.params.grid']
      }
    });

    component.selectRun('dca');
    component.dcaForm.patchValue({
      includeDcaUniverse: true,
      universe: ['BTCUSD']
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.data.symbol).toBe('BTCUSD');
    expect(payload.universe).toEqual([
      jasmine.objectContaining({ symbol: 'BTCUSD' })
    ]);
  });

  it('builds dca payload with auto universe from manual symbols when more than one is selected', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'universe', 'strategy.params.grid']
      }
    });

    component.selectRun('dca');
    component.dcaForm.patchValue({
      includeDcaUniverse: false,
      symbols: ['BTCUSD', 'AAPL'],
      symbol: 'ETHUSD'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.data.symbol).toBe('BTCUSD');
    expect(payload.data.currency).toBe('USDT');
    expect(payload.universe).toEqual([
      jasmine.objectContaining({ symbol: 'BTCUSD', currency: 'USDT' }),
      jasmine.objectContaining({ symbol: 'AAPL', currency: 'USDT' })
    ]);
  });

  it('enables universe when capabilities expose top-level universe field', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'universe', 'strategy.params.grid']
      }
    });

    expect(component.canUseCanonicalUniverse()).toBeTrue();
    expect(component.dcaForm.get('includeDcaUniverse')?.disabled).toBeFalse();
  });

  it('builds dca payload with canonical universe for multiple selected symbols', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'universe', 'strategy.params.grid']
      }
    });

    component.selectRun('dca');
    component.dcaForm.patchValue({
      includeDcaUniverse: true,
      universe: ['BTCUSD', 'AAPL']
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.data.symbol).toBe('BTCUSD');
    expect(payload.universe).toEqual([
      jasmine.objectContaining({ symbol: 'BTCUSD' }),
      jasmine.objectContaining({ symbol: 'AAPL' })
    ]);
  });

  it('marks dca form invalid when universe is enabled and no symbol is selected', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'universe']
      }
    });

    component.selectRun('dca');
    component.dcaForm.patchValue({
      includeDcaUniverse: true,
      universe: []
    } as any);
    component.dcaForm.updateValueAndValidity();

    expect(component.dcaForm.errors?.['universeRequired']).toBeTrue();
    expect(component.dcaForm.invalid).toBeTrue();
  });

  it('falls back to data.symbol-only payload when backend capabilities do not support universe', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'strategy.params.grid']
      }
    });

    component.selectRun('dca');
    component.dcaForm.patchValue({
      includeDcaUniverse: true,
      universe: ['BTCUSD', 'AAPL'],
      symbol: 'ETHUSD'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(component.canUseCanonicalUniverse()).toBeFalse();
    expect(payload.data.symbol).toBe('ETHUSD');
    expect(payload.universe).toBeUndefined();
  });

  it('emits rules params from catalog-backed capabilities options', () => {
    fixture.detectChanges();

    const catalogReq = httpMock.expectOne('/parameter_catalog.json');
    catalogReq.flush({
      meta: { version: 'v1' },
      filters_expanded: {
        items: {
          adx: {
            summary: 'ADX',
            params: [
              { name: 'window', type: 'int' },
              { name: 'threshold', type: 'float' }
            ]
          }
        }
      }
    } as any);

    const capabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=dca`
    );
    capabilitiesReq.flush({
      filters: {
        supported_ids: {
          filters: ['volatility_guard'],
          rules: ['adx']
        }
      }
    } as any);
    const backtestCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=backtest`
    );
    backtestCapabilitiesReq.flush({} as any);
    const marketStatsCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=market_stats`
    );
    marketStatsCapabilitiesReq.flush({} as any);
    const seasonalityCapabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=seasonality`
    );
    seasonalityCapabilitiesReq.flush({} as any);

    component.selectRun('dca');
    component.dcaForm.patchValue({
      strategyType: 'crypto_grid',
      filterRules: ['adx'],
      dca_filter_adx_window: 14,
      dca_filter_adx_threshold: 25
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.filters.filters).toEqual([
      jasmine.objectContaining({
        id: 'adx',
        params: {
          window: 14,
          threshold: 25
        }
      })
    ]);
    expect(payload.filters.rules).toEqual([
      jasmine.objectContaining({
        id: 'adx',
        mode: 'soft',
        weight: 0.5
      })
    ]);
  });

  it('falls back to static options when capabilities endpoint is unavailable', () => {
    fixture.detectChanges();
    flushInitRequests({}, { status: 503, statusText: 'Service Unavailable' });

    component.selectRun('dca');
    fixture.detectChanges();

    expect(component.isDcaGridSupported('grid_balanced')).toBeTrue();
    expect(component.isDcaGridSupported('grid_conservative')).toBeTrue();
    expect(component.isDcaGridSupported('grid_aggressive')).toBeTrue();
    expect(component.dcaCapabilitiesInfo()).toContain('mode statique');
    expect(component.dcaLegacyOnlyFields()).toEqual([]);
    expect(component.dcaLegacySupportedFields()).toEqual([]);
  });

  it('loads delta ranges with loading and empty states', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.dcaForm.patchValue({
      useDeltaPreset: true,
      deltaQuerySymbol: 'BTCUSDT',
      deltaQueryInsertedType: 'CRYPTO',
      deltaQueryTimeframe: '1h'
    } as any);

    component.loadDeltaRanges();
    expect(component.deltaRangesLoading()).toBeTrue();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/api/data-import/ranges?symbol=BTCUSDT&insertedType=CRYPTO&timeframe=1h&limit=200`
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);

    expect(component.deltaRangesLoading()).toBeFalse();
    expect(component.deltaRangesError()).toBeNull();
    expect(component.deltaRanges()).toEqual([]);
  });

  it('handles delta ranges http error without crashing UI', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.dcaForm.patchValue({ useDeltaPreset: true } as any);
    component.loadDeltaRanges();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=CRYPTO&limit=200`);
    req.flush({}, { status: 500, statusText: 'Server Error' });

    expect(component.deltaRangesLoading()).toBeFalse();
    expect(component.deltaRanges()).toEqual([]);
    expect(component.deltaRangesError()).toContain('Impossible de charger');
  });

  it('sorts delta ranges by insertedAt descending', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.loadDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=CRYPTO&limit=200`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-05T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T09:00:00Z'
      },
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-06T00:00:00Z',
        endDate: '2024-01-10T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T10:00:00Z'
      }
    ]);

    expect(component.deltaRanges()[0].insertedAt).toBe('2026-02-20T10:00:00.000Z');
    expect(component.deltaRanges()[1].insertedAt).toBe('2026-02-20T09:00:00.000Z');
  });

  it('uses delta preset symbol/timeframe/period when enabled', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.dcaForm.patchValue({
      symbol: 'ETHUSD',
      timeframe: '4h',
      startDate: new Date('2023-01-01T00:00:00Z'),
      endDate: new Date('2023-02-01T00:00:00Z'),
      useDeltaPreset: true
    } as any);

    component.loadDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=CRYPTO&limit=200`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-05T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T09:00:00Z'
      },
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-06T00:00:00Z',
        endDate: '2024-01-10T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T10:00:00Z'
      }
    ]);

    component.dcaForm.patchValue({
      deltaPresetSymbol: 'BTCUSDT',
      deltaPresetSymbols: ['BTCUSDT'],
      deltaPresetTimeframe: '1h'
     } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.data.symbol).toBe('BTC');
    expect(payload.data.timeframe).toBe('1h');
    expect(payload.data.startDate).toBe('2024-01-01T00:00:00.000Z');
    expect(payload.data.endDate).toBe('2024-01-10T00:00:00.000Z');
  });

  it('builds dca payload with auto universe from delta preset symbols when more than one is selected', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'universe', 'strategy.params.grid']
      }
    });

    component.dcaForm.patchValue({
      useDeltaPreset: true
    } as any);

    component.loadDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=CRYPTO&limit=200`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-10T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T10:00:00Z'
      },
      {
        symbol: 'ETHUSD',
        insertedType: 'CRYPTO',
        startDate: '2024-01-03T00:00:00Z',
        endDate: '2024-01-12T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T09:00:00Z'
      }
    ]);

    component.dcaForm.patchValue({
      deltaPresetSymbols: ['BTCUSDT', 'ETHUSD'],
      deltaPresetTimeframe: '1h'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.universe).toEqual([
      jasmine.objectContaining({ symbol: 'BTC' }),
      jasmine.objectContaining({ symbol: 'ETH' })
    ]);
  });

  it('pre-fills period with min/max dates for selected delta symbol/timeframe', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.dcaForm.patchValue({ useDeltaPreset: true } as any);
    component.loadDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=CRYPTO&limit=200`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-03T00:00:00Z',
        endDate: '2024-01-08T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T09:00:00Z'
      },
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-10T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T10:00:00Z'
      }
    ]);

    expect(component.selectedDeltaPeriodLabel()).toBe('2024-01-01T00:00:00.000Z -> 2024-01-10T00:00:00.000Z');
    expect(new Date(component.dcaForm.get('startDate')?.value as Date).toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(new Date(component.dcaForm.get('endDate')?.value as Date).toISOString()).toBe('2024-01-10T00:00:00.000Z');
  });

  it('uses delta preset on backtest (single symbol)', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    component.backtestForm.patchValue({
      useDeltaPreset: true,
      deltaQueryInsertedType: 'CRYPTO'
    } as any);

    component.loadBacktestDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=CRYPTO&limit=200`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-02T00:00:00Z',
        endDate: '2024-01-20T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T10:00:00Z'
      }
    ]);

    component.backtestForm.patchValue({
      deltaPresetSymbol: 'BTCUSDT',
      deltaPresetTimeframe: '1h'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('backtest');
    expect(payload.data.symbol).toBe('BTC');
    expect(payload.data.timeframe).toBe('1h');
    expect(payload.data.startDate).toBe('2024-01-02T00:00:00.000Z');
    expect(payload.data.endDate).toBe('2024-01-20T00:00:00.000Z');
  });

  it('switches backtest assetClass from delta preset insertedType', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    component.backtestForm.patchValue({
      useDeltaPreset: true,
      assetClass: 'CRYPTO',
      deltaQueryInsertedType: 'FOREX'
    } as any);

    component.loadBacktestDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=FOREX&limit=200`);
    req.flush([
      {
        symbol: 'EURUSD',
        insertedType: 'FOREX',
        startDate: '2024-01-02T00:00:00Z',
        endDate: '2024-01-20T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T10:00:00Z'
      }
    ]);

    component.backtestForm.patchValue({
      deltaPresetSymbol: 'EURUSD',
      deltaPresetTimeframe: '1h'
    } as any);

    expect(String(component.backtestForm.get('assetClass')?.value ?? '')).toBe('FOREX');
    expect(component.backtestSelectedDeltaAssetClassLabel()).toBe('FOREX');
  });

  it('builds market-stats payload with data.assetClass and data.currency', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('market-stats');
    component.marketStatsForm.patchValue({
      useDeltaPreset: false,
      symbol: 'BTC',
      assetClass: 'CRYPTO',
      currency: 'USDT',
      timeframe: '4h'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('market_stats');
    expect(payload.data.assetClass).toBe('CRYPTO');
    expect(payload.data.currency).toBe('USDT');
    expect(payload.data.startDate).toBeTruthy();
    expect(payload.data.endDate).toBeTruthy();
  });

  it('uses delta preset on market-stats (multi symbol)', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('market-stats');
    component.marketStatsForm.patchValue({
      useDeltaPreset: true,
      deltaQueryInsertedType: 'CRYPTO'
    } as any);

    component.loadMarketStatsDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=CRYPTO&limit=200`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-02T00:00:00Z',
        endDate: '2024-01-20T00:00:00Z',
        timeframe: '4h',
        insertedAt: '2026-02-20T10:00:00Z'
      }
    ]);

    component.marketStatsForm.patchValue({
      deltaPresetSymbols: ['BTCUSDT'],
      deltaPresetTimeframe: '4h'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('market_stats');
    expect(payload.data.symbol).toBe('BTC');
    expect(payload.data.assetClass).toBe('CRYPTO');
    expect(payload.data.currency).toBe('USDT');
    expect(payload.data.timeframe).toBe('4h');
    expect(payload.data.startDate).toBe('2024-01-02T00:00:00.000Z');
    expect(payload.data.endDate).toBe('2024-01-20T00:00:00.000Z');
  });

  it('builds seasonality payload with data.assetClass and data.currency', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('seasonality');
    component.seasonalityForm.patchValue({
      useDeltaPreset: false,
      symbol: 'BTC',
      assetClass: 'CRYPTO',
      currency: 'USDT',
      timeframe: '1d'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('seasonality');
    expect(payload.data.assetClass).toBe('CRYPTO');
    expect(payload.data.currency).toBe('USDT');
    expect(payload.data.startDate).toBeTruthy();
    expect(payload.data.endDate).toBeTruthy();
  });

  it('normalizes seasonality assetClass value casing before payload serialization', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('seasonality');
    component.seasonalityForm.patchValue({
      useDeltaPreset: false,
      symbol: 'BTC',
      assetClass: 'Crypto',
      currency: 'USDT',
      timeframe: '1d'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('seasonality');
    expect(payload.data.assetClass).toBe('CRYPTO');
  });

  it('uses delta preset on seasonality (multi symbol) and maps period to years', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('seasonality');
    component.seasonalityForm.patchValue({
      useDeltaPreset: true,
      deltaQueryInsertedType: 'CRYPTO'
    } as any);

    component.loadSeasonalityDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=CRYPTO&limit=200`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2021-03-01T00:00:00Z',
        endDate: '2024-08-01T00:00:00Z',
        timeframe: '1d',
        insertedAt: '2026-02-20T10:00:00Z'
      }
    ]);

    component.seasonalityForm.patchValue({
      deltaPresetSymbols: ['BTCUSDT'],
      deltaPresetTimeframe: '1d'
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('seasonality');
    expect(payload.data.symbol).toBe('BTC');
    expect(payload.data.assetClass).toBe('CRYPTO');
    expect(payload.data.currency).toBe('USDT');
    expect(payload.data.timeframe).toBe('1d');
    expect(payload.data.startDate).toBe('2021-03-01T00:00:00.000Z');
    expect(payload.data.endDate).toBe('2024-08-01T00:00:00.000Z');
    expect(payload.data.startYear).toBe(2021);
    expect(payload.data.endYear).toBe(2024);
  });

  it('auto-syncs seasonality assetClass from delta preset after ranges load without manual reselection', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('seasonality');
    component.seasonalityForm.patchValue({
      useDeltaPreset: true,
      deltaQueryInsertedType: 'CRYPTO'
    } as any);

    component.loadSeasonalityDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?insertedType=CRYPTO&limit=200`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2022-01-01T00:00:00Z',
        endDate: '2024-12-31T00:00:00Z',
        timeframe: '1d',
        insertedAt: '2026-02-20T10:00:00Z'
      }
    ]);

    const payload = component.buildRunRequest() as any;
    expect(payload.runType).toBe('seasonality');
    expect(payload.data.assetClass).toBe('CRYPTO');
    expect(payload.data.currency).toBe('USDT');
  });

  it('marks dca form invalid when delta preset mixes multiple asset classes', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('dca');
    component.dcaForm.patchValue({
      useDeltaPreset: true,
      deltaQueryInsertedType: ''
    } as any);

    component.loadDeltaRanges();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/data-import/ranges?limit=200`);
    req.flush([
      {
        symbol: 'BTCUSDT',
        insertedType: 'CRYPTO',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-10T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T10:00:00Z'
      },
      {
        symbol: 'EURUSD',
        insertedType: 'FOREX',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-10T00:00:00Z',
        timeframe: '1h',
        insertedAt: '2026-02-20T09:00:00Z'
      }
    ]);

    component.dcaForm.patchValue({
      deltaPresetSymbols: ['BTCUSDT', 'EURUSD'],
      deltaPresetTimeframe: '1h'
    } as any);
    component.dcaForm.updateValueAndValidity();

    expect(component.dcaDeltaAssetClassConflict()).toBeTrue();
    expect(component.dcaForm.invalid).toBeTrue();
    expect(component.selectedDeltaAssetClassLabel()).toBe('CRYPTO, FOREX');
  });
});
