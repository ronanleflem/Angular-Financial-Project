import { mergePresetFormValue } from './preset-form-fallback';
import { RunRequestInput } from '../models/run-request-input.model';

describe('preset-form-fallback', () => {
  it('falls back to payload when formValue is empty', () => {
    const payload: RunRequestInput = {
      runType: 'dca',
      data: {
        symbol: 'BTCUSD',
        timeframe: '1h',
        frequency: 'weekly',
        amount: 200,
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      },
      strategy: {
        type: 'dca_equity',
        params: {
          kind: 'dca_equity',
          drawdownReference: 'ATH',
          executionMode: 'bar_close',
          tpSl: {
            enabled: true,
            mode: 'per_grid_max_dd',
            rules: [{ maxDdReached: -20, tpPct: 15, bePct: 7 }],
            slDd: -70
          },
          grid: [{ dd: -5, weight: 1 }],
          requireCrossing: true
        }
      }
    };
    const result = mergePresetFormValue('dca', {}, payload);
    expect(result['symbol']).toBe('BTCUSD');
    expect(result['strategyType']).toBe('dca_equity');
  });

  it('prefers formValue over payload', () => {
    const payload: RunRequestInput = {
      runType: 'market_stats',
      data: {
        symbol: 'BTCUSD',
        timeframe: '1h',
        lookback: 500,
        statsPack: 'Volatility'
      },
      stats: {
        event: { id: 'vol_spike', params: {} },
        condition: { id: 'trend_regime', params: {} },
        target: { id: 'mean_reversion', params: {} },
        validation: { trainMonths: 12, testMonths: 6, folds: 3, embargoDays: 2 }
      },
      persistence: { enabled: false },
      output: { outDir: 'artifacts/market-stats' }
    };
    const result = mergePresetFormValue('market-stats', { symbol: 'ETHUSD' }, payload);
    expect(result['symbol']).toBe('ETHUSD');
  });

  it('returns empty object on mismatched run type', () => {
    const payload: RunRequestInput = {
      runType: 'backtest',
      data: {
        symbol: 'SPY',
        timeframe: '1d',
        startDate: '2020-01-01',
        endDate: '2021-01-01'
      },
      strategy: { name: 'Test' },
      signal: { type: 'ema_cross' }
    };
    const result = mergePresetFormValue('dca', {}, payload);
    expect(Object.keys(result).length).toBe(0);
  });
});
