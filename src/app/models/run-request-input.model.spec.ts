import { RunRequestInput, validateRunRequest } from './run-request-input.model';

describe('validateRunRequest stress_tests', () => {
  it('requires data.baseRunId for stress_tests', () => {
    const input = {
      runType: 'stress_tests',
      data: { baseRunId: '' },
      performance: {
        stressTests: { enabled: true, nSims: 1000 }
      }
    } as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors).toContain(jasmine.objectContaining({ path: 'data.baseRunId', message: 'required' }));
  });

  it('does not require symbol/timeframe/date fields for stress_tests', () => {
    const input = {
      runType: 'stress_tests',
      data: { baseRunId: 'run-123' },
      performance: {
        stressTests: { enabled: true, nSims: 1000 }
      }
    } as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors.find(error => error.path === 'data.symbol')).toBeUndefined();
    expect(errors.find(error => error.path === 'data.timeframe')).toBeUndefined();
    expect(errors.find(error => error.path === 'data.startDate')).toBeUndefined();
    expect(errors.find(error => error.path === 'data.endDate')).toBeUndefined();
  });

  it('requires scenarios[].name when scenarios are provided', () => {
    const input = {
      runType: 'stress_tests',
      data: { baseRunId: 'run-123' },
      performance: {
        stressTests: {
          enabled: true,
          nSims: 1000,
          scenarios: [
            { name: '', type: 'shock', shockPct: 10 } as any
          ]
        }
      }
    } as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors).toContain(
      jasmine.objectContaining({
        path: 'performance.stressTests.scenarios[0].name',
        message: 'name is required'
      })
    );
  });
});

describe('validateRunRequest optimize specs', () => {
  it('validates optimize_dca objective/search_space/max_trials', () => {
    const input = {
      runType: 'optimize_dca',
      optimization: {
        baseSpec: {
          runType: 'dca',
          data: { symbol: 'BTC', timeframe: '1h', startDate: '2024-01-01', endDate: '2024-12-31' },
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
        objective: { metric: '', direction: 'bad' as any },
        budget: { maxTrials: 0 },
        searchSpace: { param: { low: 1, high: 2 } }
      }
    } as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors).toContain(jasmine.objectContaining({ path: 'optimization.objective.metric', message: 'required' }));
    expect(errors).toContain(
      jasmine.objectContaining({ path: 'optimization.objective.direction', message: 'must be one of: max, min, maximize, minimize' })
    );
    expect(errors).toContain(
      jasmine.objectContaining({ path: 'optimization.budget.maxTrials', message: 'must be an integer >= 1' })
    );
  });

  it('accepts optimization direction aliases and low/high search space', () => {
    const input = {
      runType: 'optimize_dca',
      optimization: {
        baseSpec: {
          runType: 'dca',
          data: { symbol: 'BTC', timeframe: '1h', startDate: '2024-01-01', endDate: '2024-12-31' },
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
        objective: { metric: 'sharpe', direction: 'maximize' as any },
        budget: { maxTrials: 10 },
        searchSpace: { 'signal.fast': { low: 5, high: 30 } }
      }
    } as unknown as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors.find(error => error.path === 'optimization.objective.direction')).toBeUndefined();
    expect(errors.find(error => error.path === 'optimization.searchSpace')).toBeUndefined();
  });

  it('rejects unsupported search space shapes', () => {
    const input = {
      runType: 'optimize_backtest',
      optimization: {
        baseSpec: {
          runType: 'backtest',
          data: { symbol: 'BTC', timeframe: '1h', startDate: '2024-01-01', endDate: '2024-12-31' },
          signal: { type: 'ema_cross', fast: 12, slow: 26 }
        },
        objective: { metric: 'sharpe', direction: 'max' },
        budget: { maxTrials: 10 },
        searchSpace: { invalid: [] as unknown[] }
      }
    } as unknown as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors).toContain(jasmine.objectContaining({ path: 'optimization.searchSpace', message: 'contains unsupported entries' }));
  });

  it('requires baseSpec type to match optimize_backtest', () => {
    const input = {
      runType: 'optimize_backtest',
      optimization: {
        baseSpec: {
          runType: 'dca',
          data: { symbol: 'BTC', timeframe: '1h', startDate: '2024-01-01', endDate: '2024-12-31' },
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
        objective: { metric: 'sharpe', direction: 'max' },
        budget: { maxTrials: 20 },
        searchSpace: { signal: { min: 1, max: 2 } }
      }
    } as unknown as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors).toContain(jasmine.objectContaining({ path: 'optimization.baseSpec.runType', message: 'must be backtest' }));
  });
});
