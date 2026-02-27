import { RunRequestInput } from '../models/run-request-input.model';
import { buildCanonicalRunPayload } from './run-request-adapter';

describe('run-request-adapter', () => {
  it('strips strategy.name from canonical backtest payload', () => {
    const payload: RunRequestInput = {
      runType: 'backtest',
      data: {
        symbol: 'EURUSD',
        timeframe: '1h',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      },
      strategy: {
        name: 'Mean Reversion',
        params: {
          tpSl: {
            atrWindow: 14,
            atrK: 2
          }
        }
      },
      signal: {
        type: 'ema_cross',
        fast: 12,
        slow: 26
      }
    } as any;

    const canonical = buildCanonicalRunPayload(payload, 'backtest') as any;
    expect(canonical.strategy.name).toBeUndefined();
    expect(canonical.strategy.params.tp_sl).toEqual(
      jasmine.objectContaining({
        atr_window: 14,
        atr_k: 2
      })
    );
  });

  it('builds canonical dca payload and moves universe to top-level', () => {
    const payload: RunRequestInput = {
      runType: 'dca',
      data: {
        symbol: 'BTCUSD',
        timeframe: '1h',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      },
      universe: [{ symbol: 'BTCUSD', assetClass: 'Crypto' }],
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
    };

    const canonical = buildCanonicalRunPayload(payload, 'dca', { catalogVersion: '2026-02-02' }) as any;
    expect(canonical.spec_type).toBe('dca');
    expect(canonical.catalog_version).toBe('2026-02-02');
    expect(canonical.data.symbol).toBeUndefined();
    expect(canonical.data.universe).toBeUndefined();
    expect(canonical.universe).toEqual([{ symbol: 'BTCUSD', asset_class: 'Crypto' }]);
    expect(canonical.strategy.params.grid).toEqual([{ dd: -5, weight: 1 }]);
    expect(canonical.strategy.params.asset_class).toBe('CRYPTO');
    expect(canonical.strategy.params.tp_sl).toEqual({
      enabled: true,
      mode: 'rule_based',
      tp: { type: 'percent', value: 2 },
      sl: { type: 'percent', value: 1 },
      break_even: { enabled: true, trigger_pct: 1 }
    });
  });

  it('converts legacy dca grid preset and tp_sl preset string', () => {
    const legacyPayload = {
      runType: 'dca',
      data: {
        symbol: 'BTCUSD',
        timeframe: '1h',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      },
      strategy: {
        type: 'dca_equity',
        grid: ['grid_balanced'],
        params: {
          kind: 'dca_equity',
          assetClass: 'CRYPTO',
          drawdownReference: 'ATH',
          executionMode: 'bar_close',
          tpSl: 'tp_2_sl_1',
          requireCrossing: true
        }
      }
    } as unknown as RunRequestInput;

    const canonical = buildCanonicalRunPayload(legacyPayload, 'dca') as any;
    expect(canonical.strategy.params.grid).toEqual([
      { dd: -5, weight: 1 },
      { dd: -10, weight: 1 },
      { dd: -15, weight: 1 }
    ]);
    expect(canonical.strategy.params.tp_sl).toEqual({
      enabled: true,
      mode: 'rule_based',
      tp: { type: 'percent', value: 2 },
      sl: { type: 'percent', value: 1 },
      break_even: { enabled: true, trigger_pct: 1 }
    });
  });

  it('throws when data.symbol is missing', () => {
    const payload = {
      runType: 'dca',
      data: {
        symbol: '',
        timeframe: '1h',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      },
      strategy: {
        type: 'dca_equity',
        params: {
          kind: 'dca_equity',
          assetClass: 'CRYPTO',
          drawdownReference: 'ATH',
          executionMode: 'bar_close',
          grid: [{ dd: -5, weight: 1 }],
          requireCrossing: true
        }
      }
    } as RunRequestInput;

    expect(() => buildCanonicalRunPayload(payload, 'dca')).toThrowError(/data\.symbol is required/);
  });

  it('accepts dca payload without data.symbol when universe is provided', () => {
    const payload = {
      runType: 'dca',
      data: {
        symbol: '',
        timeframe: '1h',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      },
      universe: [
        { symbol: 'BTCUSDT', assetClass: 'CRYPTO' },
        { symbol: 'ETHUSD', assetClass: 'CRYPTO' }
      ],
      strategy: {
        type: 'dca_equity',
        params: {
          kind: 'dca_equity',
          assetClass: 'CRYPTO',
          drawdownReference: 'ATH',
          executionMode: 'bar_close',
          grid: [{ dd: -5, weight: 1 }],
          requireCrossing: true
        }
      }
    } as RunRequestInput;

    const canonical = buildCanonicalRunPayload(payload, 'dca') as any;
    expect(canonical.data.symbol).toBeUndefined();
    expect(canonical.data.universe).toBeUndefined();
    expect(canonical.universe).toEqual([
      { symbol: 'BTCUSDT', asset_class: 'CRYPTO' },
      { symbol: 'ETHUSD', asset_class: 'CRYPTO' }
    ]);
  });

  it('accepts market_stats payload with data.symbols only', () => {
    const payload = {
      runType: 'market_stats',
      data: {
        symbols: ['BTC', 'ETH'],
        timeframe: '4h',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        assetClass: 'CRYPTO',
        currency: 'USDT',
        lookback: 200,
        statsPack: 'Volatility'
      },
      stats: {
        event: { id: 'vol_spike', params: {} },
        condition: { id: 'trend_regime', params: {} },
        target: { id: 'mean_reversion', params: {} },
        validation: { trainMonths: 12, testMonths: 6, folds: 3, embargoDays: 2 }
      }
    } as unknown as RunRequestInput;

    const canonical = buildCanonicalRunPayload(payload, 'market_stats') as any;
    expect(canonical.data.symbol).toBeUndefined();
    expect(canonical.data.symbols).toEqual(['BTC', 'ETH']);
  });

  it('accepts stress_tests payload without data.symbol and maps base_run_id', () => {
    const payload = {
      runType: 'stress_tests',
      data: {
        baseRunId: 'run-abc'
      },
      performance: {
        stressTests: {
          enabled: true,
          nSims: 2000
        }
      }
    } as unknown as RunRequestInput;

    const canonical = buildCanonicalRunPayload(payload, 'stress_tests') as any;
    expect(canonical.data.base_run_id).toBe('run-abc');
    expect(canonical.data.symbol).toBeUndefined();
  });

  it('builds canonical optimize_dca payload with optimization.base_spec', () => {
    const payload = {
      runType: 'optimize_dca',
      optimization: {
        baseSpec: {
          runType: 'dca',
          data: {
            symbol: 'BTCUSD',
            timeframe: '1h',
            startDate: '2024-01-01',
            endDate: '2024-12-31'
          },
          strategy: {
            type: 'dca_equity',
            params: {
              kind: 'dca_equity',
              assetClass: 'CRYPTO',
              drawdownReference: 'ATH',
              executionMode: 'bar_close',
              grid: [{ dd: -5, weight: 1 }],
              requireCrossing: true
            }
          }
        },
        searchSpace: {
          'strategy.params.grid[0].dd': { type: 'float', min: -20, max: -2 }
        },
        objective: { metric: 'sharpe', direction: 'max' },
        budget: { maxTrials: 50 }
      }
    } as unknown as RunRequestInput;

    const canonical = buildCanonicalRunPayload(payload, 'optimize_dca', { catalogVersion: '2026-02-02' }) as any;
    expect(canonical.spec_type).toBe('optimize_dca');
    expect(canonical.optimization.base_spec.spec_type).toBe('dca');
    expect(canonical.optimization.base_spec.data.symbol).toBe('BTCUSD');
    expect(canonical.optimization.objective.direction).toBe('max');
    expect(canonical.optimization.search_space['strategy.params.grid[0].dd']).toEqual({
      type: 'float',
      min: -20,
      max: -2
    });
    expect(canonical.optimization.budget.max_trials).toBe(50);
  });

  it('builds canonical optimize_backtest payload with optimization.base_spec', () => {
    const payload = {
      runType: 'optimize_backtest',
      optimization: {
        baseSpec: {
          runType: 'backtest',
          data: {
            symbol: 'EURUSD',
            timeframe: '1h',
            startDate: '2024-01-01',
            endDate: '2024-02-01'
          },
          signal: {
            type: 'ema_cross',
            fast: 12,
            slow: 26
          }
        },
        searchSpace: {
          'signal.fast': { type: 'int', min: 5, max: 30 }
        },
        objective: { metric: 'sharpe', direction: 'min' },
        budget: { maxTrials: 25, timeoutSeconds: 120, seed: 7 }
      }
    } as unknown as RunRequestInput;

    const canonical = buildCanonicalRunPayload(payload, 'optimize_backtest') as any;
    expect(canonical.spec_type).toBe('optimize_backtest');
    expect(canonical.optimization.base_spec.spec_type).toBe('backtest');
    expect(canonical.optimization.base_spec.signal.fast).toBe(12);
    expect(canonical.optimization.objective.direction).toBe('min');
    expect(canonical.optimization.budget.max_trials).toBe(25);
    expect(canonical.optimization.budget.timeout_seconds).toBe(120);
    expect(canonical.optimization.budget.seed).toBe(7);
  });

  it('normalizes optimization aliases and search_space low/high + domain', () => {
    const payload = {
      runType: 'optimize_backtest',
      optimization: {
        baseSpec: {
          runType: 'backtest',
          data: {
            symbol: 'EURUSD',
            timeframe: '1h',
            startDate: '2024-01-01',
            endDate: '2024-02-01'
          },
          signal: {
            type: 'ema_cross',
            fast: 12,
            slow: 26
          }
        },
        searchSpace: {
          'signal.fast': { low: 5, high: 30, step: 1 },
          'signal.type': { domain: ['ema_cross', 'rsi'] }
        },
        objective: { metric: 'sharpe', direction: 'maximize' as any },
        budget: { maxTrials: 25 }
      }
    } as unknown as RunRequestInput;

    const canonical = buildCanonicalRunPayload(payload, 'optimize_backtest') as any;
    expect(canonical.optimization.objective.direction).toBe('max');
    expect(canonical.optimization.search_space['signal.fast']).toEqual({
      min: 5,
      max: 30,
      step: 1
    });
    expect(canonical.optimization.search_space['signal.type']).toEqual({
      values: ['ema_cross', 'rsi']
    });
  });

  it('rejects optimize payload with stringified search_space', () => {
    const payload = {
      runType: 'optimize_dca',
      optimization: {
        baseSpec: {
          runType: 'dca',
          data: {
            symbol: 'BTCUSD',
            timeframe: '1h',
            startDate: '2024-01-01',
            endDate: '2024-12-31'
          },
          strategy: {
            type: 'dca_equity',
            params: {
              kind: 'dca_equity',
              assetClass: 'CRYPTO',
              drawdownReference: 'ATH',
              executionMode: 'bar_close',
              grid: [{ dd: -5, weight: 1 }],
              requireCrossing: true
            }
          }
        },
        searchSpace: '{"signal.fast":{"min":5,"max":30}}' as any,
        objective: { metric: 'sharpe', direction: 'max' },
        budget: { maxTrials: 10 }
      }
    } as unknown as RunRequestInput;

    expect(() => buildCanonicalRunPayload(payload, 'optimize_dca')).toThrowError(/optimization\.search_space must be an object/);
  });

  it('rejects optimize payload with empty search_space arrays', () => {
    const payload = {
      runType: 'optimize_backtest',
      optimization: {
        baseSpec: {
          runType: 'backtest',
          data: {
            symbol: 'EURUSD',
            timeframe: '1h',
            startDate: '2024-01-01',
            endDate: '2024-02-01'
          },
          signal: {
            type: 'ema_cross',
            fast: 12,
            slow: 26
          }
        },
        searchSpace: {
          'signal.fast': []
        },
        objective: { metric: 'sharpe', direction: 'min' },
        budget: { maxTrials: 25 }
      }
    } as unknown as RunRequestInput;

    expect(() => buildCanonicalRunPayload(payload, 'optimize_backtest')).toThrowError(/array must not be empty/);
  });

  it('rejects legacy optimization spec_type', () => {
    const payload = {
      runType: 'optimize_dca',
      optimization: {
        baseSpec: {
          runType: 'dca',
          data: {
            symbol: 'BTCUSD',
            timeframe: '1h',
            startDate: '2024-01-01',
            endDate: '2024-12-31'
          },
          strategy: {
            type: 'dca_equity',
            params: {
              kind: 'dca_equity',
              assetClass: 'CRYPTO',
              drawdownReference: 'ATH',
              executionMode: 'bar_close',
              grid: [{ dd: -5, weight: 1 }],
              requireCrossing: true
            }
          }
        },
        searchSpace: { 'signal.fast': { min: 5, max: 30 } },
        objective: { metric: 'sharpe', direction: 'max' },
        budget: { maxTrials: 10 }
      }
    } as unknown as RunRequestInput;

    expect(() => buildCanonicalRunPayload(payload, 'optimization' as any)).toThrowError(/spec_type mismatch/);
  });
});
