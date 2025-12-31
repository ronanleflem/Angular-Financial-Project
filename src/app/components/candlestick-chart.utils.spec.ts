import { mapCandlesToOhlc } from './candlestick-chart.utils';

describe('candlestick-chart utils', () => {
  describe('mapCandlesToOhlc', () => {
    it('handles null/undefined dates without throwing and maps safely', () => {
      const candles = [
        {
          date: undefined as unknown as string,
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5
        },
        {
          date: null as unknown as string,
          open: 2,
          high: 3,
          low: 1.5,
          close: 2.5
        },
        {
          date: '2024-01-01T00:00:00Z',
          open: 3,
          high: 4,
          low: 2.5,
          close: 3.5
        }
      ];

      const result = mapCandlesToOhlc(candles);

      expect(result.length).toBe(2);
      expect(result[0].x).toBe(0);
      expect(result[1].x).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    });

    it('preserves timestamp order from the input array', () => {
      const candles = [
        {
          date: '2024-01-02T00:00:00Z',
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5
        },
        {
          date: '2024-01-01T00:00:00Z',
          open: 2,
          high: 3,
          low: 1.5,
          close: 2.5
        }
      ];

      const result = mapCandlesToOhlc(candles);

      expect(result.map((point) => point.x)).toEqual([
        new Date('2024-01-02T00:00:00Z').getTime(),
        new Date('2024-01-01T00:00:00Z').getTime()
      ]);
    });

    it('ignores invalid dates while handling volume data gracefully', () => {
      const candles = [
        {
          date: 'invalid-date',
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
          volume: 1000
        } as unknown as { date: string; open: number; high: number; low: number; close: number },
        {
          date: '2024-01-03T00:00:00Z',
          open: 2,
          high: 3,
          low: 1.5,
          close: 2.5,
          volume: 2000
        } as unknown as { date: string; open: number; high: number; low: number; close: number }
      ];

      const result = mapCandlesToOhlc(candles);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual({
        x: new Date('2024-01-03T00:00:00Z').getTime(),
        o: 2,
        h: 3,
        l: 1.5,
        c: 2.5
      });
    });
  });
});
