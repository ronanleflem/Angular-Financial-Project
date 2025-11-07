import { Candle, FilterCard, FilterSeriesPoint, SeasonalityBar, SeasonalityProfile, StatsSummaryRow } from '../models/market-analysis.models';

type SymbolKey = 'EURUSD' | 'GBPUSD' | 'BTCUSD' | 'ETHUSD' | 'AAPL' | 'MSFT' | 'SPY' | 'EEM';

type Timeframe = '15m' | '1h' | '4h' | '1d';

interface SymbolConfig {
  basePrice: number;
  volatility: number;
  timeframe: Timeframe;
}

const SYMBOL_CONFIG: Record<SymbolKey, SymbolConfig> = {
  EURUSD: { basePrice: 1.08, volatility: 0.002, timeframe: '1h' },
  GBPUSD: { basePrice: 1.26, volatility: 0.0025, timeframe: '1h' },
  BTCUSD: { basePrice: 46000, volatility: 420, timeframe: '1h' },
  ETHUSD: { basePrice: 3200, volatility: 38, timeframe: '1h' },
  AAPL: { basePrice: 185, volatility: 3.4, timeframe: '1d' },
  MSFT: { basePrice: 415, volatility: 4.1, timeframe: '1d' },
  SPY: { basePrice: 510, volatility: 2.1, timeframe: '1d' },
  EEM: { basePrice: 41, volatility: 0.6, timeframe: '1d' }
};

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getIntervalMs(timeframe: Timeframe): number {
  const minutesMap: Record<Timeframe, number> = {
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 24 * 60
  };
  return minutesMap[timeframe] * 60 * 1000;
}

export function genCandles(symbol: SymbolKey, timeframe: Timeframe, count: number): Candle[] {
  const config = SYMBOL_CONFIG[symbol];
  const rng = mulberry32(hashSeed(symbol + timeframe + count));
  const interval = getIntervalMs(timeframe);
  const now = Date.now();
  const candles: Candle[] = [];
  let lastClose = config.basePrice * (0.98 + rng() * 0.04);

  for (let i = count - 1; i >= 0; i -= 1) {
    const timestamp = new Date(now - i * interval).toISOString();
    const direction = rng() - 0.48;
    const drift = direction * config.volatility;
    const open = lastClose;
    let close = open + drift;
    close = Math.max(close, open * 0.96);
    close = Math.min(close, open * 1.04);
    const high = Math.max(open, close) + Math.abs(rng() * config.volatility * 0.7);
    const low = Math.min(open, close) - Math.abs(rng() * config.volatility * 0.7);
    const volume = Math.round(500 + rng() * 500);

    candles.push({ timestamp, open: round(open), high: round(high), low: round(low), close: round(close), volume });
    lastClose = close;
  }

  return candles;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function buildSeasonality(symbol: SymbolKey, timeframe: Timeframe): SeasonalityProfile {
  const rng = mulberry32(hashSeed(`${symbol}-${timeframe}-seasonality`));

  const byMonth: SeasonalityBar[] = Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}`.padStart(2, '0'),
    value: round(40 + rng() * 60)
  }));

  const dowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byDow: SeasonalityBar[] = dowLabels.map(label => ({
    label,
    value: round(30 + rng() * 70)
  }));

  const byHour = buildHeatmap(rng);

  return { byMonth, byDow, byHour };
}

function buildHeatmap(rng: () => number): Array<{ dow: number; hour: number; value: number }> {
  const cells: Array<{ dow: number; hour: number; value: number }> = [];
  for (let dow = 0; dow < 7; dow += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const base = 20 + dow * 5;
      const modifier = Math.sin((hour / 24) * Math.PI * 2) * 10;
      const noise = rng() * 8;
      cells.push({ dow, hour, value: Math.round(base + modifier + noise) });
    }
  }
  return cells;
}

const BASE_STATS_SUMMARY: StatsSummaryRow[] = [
  { event: 'k_consecutive=2', target: 'up_next', n: 1200, pHat: 0.56, ciLow: 0.53, ciHigh: 0.59, lift: 0.03 },
  { event: 'k_consecutive=3', target: 'up_next', n: 840, pHat: 0.61, ciLow: 0.57, ciHigh: 0.64, lift: 0.08 },
  { event: 'inside_bar', target: 'break_up', n: 640, pHat: 0.42, ciLow: 0.38, ciHigh: 0.46, lift: -0.05 },
  { event: 'vol_squeeze', target: 'range_expand', n: 950, pHat: 0.68, ciLow: 0.64, ciHigh: 0.71, lift: 0.12, qValue: 0.07 }
];

const BASE_FILTERS: FilterCard[] = [
  {
    id: 'benford',
    title: 'Benford score',
    source: 'JAVA',
    category: 'Structure',
    score: 0.68,
    series: buildSeries('benford')
  },
  {
    id: 'compression',
    title: 'Compression Range',
    source: 'JAVA',
    category: 'Volatilité',
    ratio: 0.22,
    metrics: { percentile: 12 }
  },
  {
    id: 'liquidity-zones',
    title: 'Liquidity Zones',
    source: 'JAVA',
    category: 'Liquidity',
    metrics: { imbalanceScore: 0.44, clusters: 5 }
  },
  {
    id: 'seasonal-shift',
    title: 'Seasonal Shift',
    source: 'PY',
    category: 'Seasonality',
    description: 'Deviation between current trend and historical seasonality.',
    metrics: { magnitude: 0.18 }
  }
];

function buildSeries(key: string): FilterSeriesPoint[] {
  const rng = mulberry32(hashSeed(`series-${key}`));
  const series: FilterSeriesPoint[] = [];
  let t = Date.now() - 24 * 3600 * 1000 * 30;
  for (let i = 0; i < 30; i += 1) {
    series.push({ t, v: Math.round((0.55 + rng() * 0.15) * 100) / 100 });
    t += 24 * 3600 * 1000;
  }
  return series;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const MOCK_CANDLES: Record<SymbolKey, Candle[]> = {
  EURUSD: genCandles('EURUSD', '1h', 400),
  GBPUSD: genCandles('GBPUSD', '1h', 400),
  BTCUSD: genCandles('BTCUSD', '1h', 400),
  ETHUSD: genCandles('ETHUSD', '1h', 400),
  AAPL: genCandles('AAPL', '1d', 260),
  MSFT: genCandles('MSFT', '1d', 260),
  SPY: genCandles('SPY', '1d', 260),
  EEM: genCandles('EEM', '1d', 260)
};

export const MOCK_SEASONALITY: Record<SymbolKey, SeasonalityProfile> = {
  EURUSD: buildSeasonality('EURUSD', '1h'),
  GBPUSD: buildSeasonality('GBPUSD', '1h'),
  BTCUSD: buildSeasonality('BTCUSD', '1h'),
  ETHUSD: buildSeasonality('ETHUSD', '1h'),
  AAPL: buildSeasonality('AAPL', '1d'),
  MSFT: buildSeasonality('MSFT', '1d'),
  SPY: buildSeasonality('SPY', '1d'),
  EEM: buildSeasonality('EEM', '1d')
};

export const MOCK_STATS_SUMMARY: StatsSummaryRow[] = BASE_STATS_SUMMARY;

export const MOCK_FILTERS: FilterCard[] = BASE_FILTERS;

export function getMockCandles(symbol: string): Candle[] {
  const key = (symbol.toUpperCase() as SymbolKey) || 'EURUSD';
  return clone(MOCK_CANDLES[key] ?? MOCK_CANDLES.EURUSD);
}

export function getMockSeasonality(symbol: string): SeasonalityProfile {
  const key = (symbol.toUpperCase() as SymbolKey) || 'EURUSD';
  return clone(MOCK_SEASONALITY[key] ?? MOCK_SEASONALITY.EURUSD);
}

export function getMockStatsSummary(): StatsSummaryRow[] {
  return clone(MOCK_STATS_SUMMARY);
}

export function getMockFilters(predicate?: (card: FilterCard) => boolean): FilterCard[] {
  const data = predicate ? BASE_FILTERS.filter(predicate) : BASE_FILTERS;
  return clone(data);
}

export function getMockBenford(): FilterCard {
  const benford = BASE_FILTERS.find(card => card.id === 'benford');
  return clone(benford ?? BASE_FILTERS[0]);
}
