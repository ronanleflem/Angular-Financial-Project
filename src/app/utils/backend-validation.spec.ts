import {
  BackendMappingContext,
  mapBackendFieldToControlName,
  parseBackendValidationErrors,
  parseRunRuntimeError
} from './backend-validation';

describe('backend-validation', () => {
  it('parses 422 backend validation payloads', () => {
    const error = {
      status: 422,
      error: {
        errors: [{ field: 'data.symbol', code: 'required', message: 'Symbole requis' }]
      }
    };
    expect(parseBackendValidationErrors(error)).toEqual([
      { field: 'data.symbol', code: 'required', message: 'Symbole requis' }
    ]);
  });

  it('ignores non-422 payloads', () => {
    const error = { status: 400, error: { errors: [{ field: 'data.symbol' }] } };
    expect(parseBackendValidationErrors(error)).toEqual([]);
  });

  it('parses runtime run errors from status payloads', () => {
    const runtime = parseRunRuntimeError({
      status: 'FAILED',
      error: {
        code: 'not_implemented_feature',
        message: 'Feature not implemented',
        details: [
          { field: 'signal.type', message: 'not wired' }
        ]
      }
    });
    expect(runtime).toEqual({
      code: 'not_implemented_feature',
      message: 'Feature not implemented',
      details: [{ field: 'signal.type', message: 'not wired', code: undefined, reason: undefined }]
    });
  });

  it('maps dca fields to control names', () => {
    expect(mapBackendFieldToControlName('data.start_date', 'dca', {})).toBe('startDate');
    expect(mapBackendFieldToControlName('strategy.params.asset_class', 'dca', {})).toBe('assetClass');
    expect(mapBackendFieldToControlName('strategy.params.drawdown_reference', 'dca', {})).toBe('drawdownReference');
    expect(mapBackendFieldToControlName('strategy.params.tp_sl.tp.value', 'dca', {})).toBe('tpValue');
    expect(mapBackendFieldToControlName('strategy.params.tp_sl.sl.value', 'dca', {})).toBe('slValue');
    expect(mapBackendFieldToControlName('strategy.params.tp_sl.break_even.trigger_pct', 'dca', {})).toBe('breakEvenTriggerPct');
  });

  it('maps backtest fields to control names', () => {
    expect(mapBackendFieldToControlName('strategy.tp_sl.stop_loss_pct', 'backtests', {})).toBe('stopLoss');
    expect(mapBackendFieldToControlName('signal.require_crossing', 'backtests', {})).toBe('requireCrossing');
    expect(mapBackendFieldToControlName('strategy.params.tp_sl.jitter.seed', 'backtests', {})).toBe('tpslJitterSeed');
    expect(mapBackendFieldToControlName('screening.max_seconds', 'backtests', {})).toBe('screenMaxSeconds');
    expect(mapBackendFieldToControlName('data.path', 'backtests', {})).toBe('csvPath');
    expect(mapBackendFieldToControlName('data.mysql_env', 'backtests', {})).toBe('mysqlEnv');
    expect(mapBackendFieldToControlName('data.mysql.host', 'backtests', {})).toBe('mysqlHost');
  });

  it('maps market stats params using context', () => {
    const ctx: BackendMappingContext = { marketEventId: 'vol_spike' };
    expect(mapBackendFieldToControlName('stats.event.params.window', 'market-stats', ctx)).toBe(
      'event_vol_spike_window'
    );
  });

  it('maps data.asset_class and data.currency to market-stats controls', () => {
    expect(mapBackendFieldToControlName('data.asset_class', 'market-stats', {})).toBe('assetClass');
    expect(mapBackendFieldToControlName('data.currency', 'market-stats', {})).toBe('currency');
    expect(mapBackendFieldToControlName('data.symbols', 'market-stats', {})).toBe('symbols');
    expect(mapBackendFieldToControlName('data.stats_pack', 'market-stats', {})).toBe('statsPack');
  });

  it('maps market stats top-level persistence and output fields', () => {
    expect(mapBackendFieldToControlName('persistence.enabled', 'market-stats', {})).toBe('persistenceEnabled');
    expect(mapBackendFieldToControlName('output.out_dir', 'market-stats', {})).toBe('artifactsOutDir');
  });

  it('maps seasonality params using context', () => {
    const ctx: BackendMappingContext = { seasonalityProfileId: 'by_hour' };
    expect(mapBackendFieldToControlName('seasonality.profile.params.bin_size', 'seasonality', ctx)).toBe(
      'profile_by_hour_bin_size'
    );
    expect(mapBackendFieldToControlName('data.asset_class', 'seasonality', {})).toBe('assetClass');
    expect(mapBackendFieldToControlName('data.currency', 'seasonality', {})).toBe('currency');
    expect(mapBackendFieldToControlName('data.symbols', 'seasonality', {})).toBe('symbols');
    expect(mapBackendFieldToControlName('persistence.enabled', 'seasonality', {})).toBe('persistenceEnabled');
    expect(mapBackendFieldToControlName('output.out_dir', 'seasonality', {})).toBe('artifactsOutDir');
  });

  it('maps stress test scenarios to slot controls', () => {
    expect(mapBackendFieldToControlName('data.base_run_id', 'stress-tests', {})).toBe('baseRunId');
    expect(mapBackendFieldToControlName('data.start_date', 'stress-tests', {})).toBe('startDate');
    expect(mapBackendFieldToControlName('data.end_date', 'stress-tests', {})).toBe('endDate');
    expect(
      mapBackendFieldToControlName('performance.stress_tests.scenarios.1.name', 'stress-tests', {})
    ).toBe('scenario2Name');
    expect(
      mapBackendFieldToControlName('performance.stress_tests.scenarios.1.shock_pct', 'stress-tests', {})
    ).toBe('scenario2ShockPct');
  });
});
