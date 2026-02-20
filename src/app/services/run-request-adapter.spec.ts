import { RunRequestInput } from '../models/run-request-input.model';
import { buildCanonicalRunPayload } from './run-request-adapter';

describe('run-request-adapter', () => {
  it('builds canonical dca payload and strips universe', () => {
    const payload: RunRequestInput = {
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
    expect(canonical.data.symbol).toBe('BTCUSD');
    expect(canonical.data.universe).toBeUndefined();
    expect(canonical.strategy.params.grid).toEqual([{ dd: -5, weight: 1 }]);
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
          drawdownReference: 'ATH',
          executionMode: 'bar_close',
          grid: [{ dd: -5, weight: 1 }],
          requireCrossing: true
        }
      }
    } as RunRequestInput;

    expect(() => buildCanonicalRunPayload(payload, 'dca')).toThrowError(/data\.symbol is required/);
  });
});
