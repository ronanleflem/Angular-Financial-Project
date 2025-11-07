import { Candle, DataSeries, SaveResult, SymbolRef } from '../models/data-catalog.models';

export const DEFAULT_SYMBOLS: SymbolRef[] = [
  { ticker: 'EURUSD', name: 'Euro / US Dollar', market: 'FX' },
  { ticker: 'GBPUSD', name: 'British Pound / US Dollar', market: 'FX' },
  { ticker: 'BTCUSD', name: 'Bitcoin / US Dollar', market: 'Crypto' },
  { ticker: 'ETHUSD', name: 'Ethereum / US Dollar', market: 'Crypto' },
  { ticker: 'AAPL', name: 'Apple Inc.', market: 'Equity' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', market: 'Equity' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', market: 'ETF' },
  { ticker: 'EEM', name: 'iShares MSCI Emerging Markets ETF', market: 'ETF' }
];

const BASE_PRICES: Record<string, number> = {
  EURUSD: 1.08,
  GBPUSD: 1.26,
  BTCUSD: 42000,
  ETHUSD: 2300,
  AAPL: 180,
  MSFT: 380,
  SPY: 520,
  EEM: 41
};

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function parseInterval(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([mhdw])$/i);
  if (!match) {
    return 60 * 60 * 1000;
  }
  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

function createMockCandles(symbol: string, timeframe: string, days = 60): Candle[] {
  const basePrice = BASE_PRICES[symbol] ?? 100;
  const rng = seededRandom(symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + timeframe.length);
  const intervalMs = parseInterval(timeframe);

  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;
  const bars: Candle[] = [];
  let price = basePrice;

  const steps = Math.max(10, Math.floor((now - startTime) / intervalMs));

  for (let i = 0; i < steps; i++) {
    const t = startTime + i * intervalMs;
    const volatility = symbol === 'BTCUSD' || symbol === 'ETHUSD' ? 0.06 : 0.01;
    const drift = (rng() - 0.5) * volatility * price;
    const open = price;
    const close = Math.max(0.0001, price + drift);
    const high = Math.max(open, close) + Math.abs(drift) * 0.5;
    const low = Math.min(open, close) - Math.abs(drift) * 0.5;
    const volume = 1000 + rng() * 5000;
    bars.push({ t, o: open, h: high, l: low, c: close, v: volume });
    price = close;
  }

  return bars;
}

export const MOCK_CANDLES: Record<string, Record<string, Candle[]>> = DEFAULT_SYMBOLS.reduce((acc, symbol) => {
  acc[symbol.ticker] = {
    '1h': createMockCandles(symbol.ticker, '1h'),
    '1d': createMockCandles(symbol.ticker, '1d'),
  };
  return acc;
}, {} as Record<string, Record<string, Candle[]>>);

export const MOCK_SERIES: DataSeries[] = [
  {
    symbol: 'EURUSD',
    broker: 'IBKR',
    timeframe: '1h',
    start: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    count: 2400,
    coveragePct: 92,
    gapsPct: 3,
    sessions: '24/7',
    tz: 'UTC',
    updatedAt: new Date().toISOString(),
    source: 'Mock'
  },
  {
    symbol: 'GBPUSD',
    broker: 'IBKR',
    timeframe: '1d',
    start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    count: 360,
    coveragePct: 98,
    sessions: 'RTH',
    tz: 'UTC',
    updatedAt: new Date().toISOString(),
    source: 'Mock'
  },
  {
    symbol: 'BTCUSD',
    broker: 'Binance',
    timeframe: '1h',
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    count: 2100,
    coveragePct: 96,
    gapsPct: 1,
    sessions: '24/7',
    tz: 'UTC',
    updatedAt: new Date().toISOString(),
    source: 'Mock'
  },
  {
    symbol: 'ETHUSD',
    broker: 'Binance',
    timeframe: '1d',
    start: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    count: 400,
    coveragePct: 88,
    gapsPct: 6,
    sessions: '24/7',
    tz: 'UTC',
    updatedAt: new Date().toISOString(),
    source: 'Mock'
  },
  {
    symbol: 'AAPL',
    broker: 'Databento CSV',
    timeframe: '1d',
    start: new Date(Date.now() - 720 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    count: 700,
    coveragePct: 94,
    sessions: 'RTH',
    tz: 'America/New_York',
    updatedAt: new Date().toISOString(),
    source: 'Mock'
  },
  {
    symbol: 'MSFT',
    broker: 'Databento CSV',
    timeframe: '1h',
    start: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    count: 900,
    coveragePct: 85,
    gapsPct: 10,
    sessions: 'RTH',
    tz: 'America/New_York',
    updatedAt: new Date().toISOString(),
    source: 'Mock'
  },
  {
    symbol: 'SPY',
    broker: 'IBKR',
    timeframe: '1d',
    start: new Date(Date.now() - 800 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    count: 780,
    coveragePct: 97,
    sessions: 'RTH',
    tz: 'America/New_York',
    updatedAt: new Date().toISOString(),
    source: 'Mock'
  },
  {
    symbol: 'EEM',
    broker: 'MEXC',
    timeframe: '4h',
    start: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
    count: 900,
    coveragePct: 82,
    gapsPct: 12,
    sessions: 'Globex',
    tz: 'UTC',
    updatedAt: new Date().toISOString(),
    source: 'Mock'
  }
];

export const MOCK_SAVE_OK: SaveResult = { ok: true, mock: true, message: 'Saved (mock)' };

export function getMockCandles(symbol: string, timeframe: string): Candle[] {
  const existing = MOCK_CANDLES[symbol]?.[timeframe];
  if (existing) {
    return existing;
  }
  const generated = createMockCandles(symbol, timeframe, 30);
  if (!MOCK_CANDLES[symbol]) {
    MOCK_CANDLES[symbol] = {} as Record<string, Candle[]>;
  }
  MOCK_CANDLES[symbol][timeframe] = generated;
  return generated;
}

