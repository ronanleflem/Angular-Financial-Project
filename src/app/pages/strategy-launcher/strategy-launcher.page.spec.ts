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
    capabilitiesStatus: { status: number; statusText: string } | null = null
  ) {
    const catalogReq = httpMock.expectOne('/parameter_catalog.json');
    catalogReq.flush({ meta: { version: 'v1' } });
    const capabilitiesReq = httpMock.expectOne(
      `${environment.apiUrl}/api/runs/capabilities?spec_type=dca`
    );
    if (capabilitiesStatus) {
      capabilitiesReq.flush((capabilities ?? {}) as any, capabilitiesStatus);
      return;
    }
    capabilitiesReq.flush(capabilities as any);
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
    expect(text).toMatch(/Filter rules[\s\S]*Not implemented yet/);
    expect(text).toMatch(/Screening \/ pruning[\s\S]*Not implemented yet/);
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
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toMatch(/Inclure options avancees stress tests[\s\S]*Not implemented yet/);
    expect(component.stressForm.get('includeStressAdvanced')?.value).toBeFalse();

    const payload = component.buildRunRequest();
    expect(payload.runType).toBe('stress_tests');
    expect((payload as any).data.startDate).toBeTruthy();
    expect((payload as any).data.endDate).toBeTruthy();
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
    expect((payload as any).performance.stressTests.scenarios).toBeUndefined();
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

  it('builds dca payload with canonical universe for one selected symbol', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'data.universe', 'strategy.params.grid']
      }
    });

    component.selectRun('dca');
    component.dcaForm.patchValue({
      includeDcaUniverse: true,
      universe: ['BTCUSD']
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.data.symbol).toBe('BTCUSD');
    expect(payload.data.universe).toEqual([
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
    expect(payload.data.universe).toEqual([
      jasmine.objectContaining({ symbol: 'BTCUSD' }),
      jasmine.objectContaining({ symbol: 'AAPL' })
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
        supported: ['data.symbol', 'data.universe', 'strategy.params.grid']
      }
    });

    component.selectRun('dca');
    component.dcaForm.patchValue({
      includeDcaUniverse: true,
      universe: ['BTCUSD', 'AAPL']
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.data.symbol).toBe('BTCUSD');
    expect(payload.data.universe).toEqual([
      jasmine.objectContaining({ symbol: 'BTCUSD' }),
      jasmine.objectContaining({ symbol: 'AAPL' })
    ]);
  });

  it('marks dca form invalid when universe is enabled and no symbol is selected', () => {
    fixture.detectChanges();
    flushInitRequests({
      fields: {
        supported: ['data.symbol', 'data.universe']
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
    expect(payload.data.universe).toBeUndefined();
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

    component.selectRun('dca');
    component.dcaForm.patchValue({
      strategyType: 'crypto_grid',
      filterRules: ['adx'],
      dca_filter_adx_window: 14,
      dca_filter_adx_threshold: 25
    } as any);

    const payload = component.buildRunRequest() as any;
    expect(payload.filters.rules).toEqual([
      jasmine.objectContaining({
        id: 'adx',
        params: {
          window: 14,
          threshold: 25
        }
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
    expect(payload.data.symbol).toBe('BTCUSDT');
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
    expect(payload.data.universe).toEqual([
      jasmine.objectContaining({ symbol: 'BTCUSDT' }),
      jasmine.objectContaining({ symbol: 'ETHUSD' })
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
});
