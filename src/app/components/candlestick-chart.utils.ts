export interface CandleLike {
  date: string | number | Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface OhlcPoint {
  x: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface TradeLike {
  stopLoss: number;
  takeProfit: number;
  result: string;
}

const isValidTimestamp = (value: string | number | Date): value is string | number => {
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp);
};

export const mapCandlesToOhlc = (candles: CandleLike[] = []): OhlcPoint[] => {
  return candles
    .filter((candle) => isValidTimestamp(candle.date))
    .map((candle) => ({
      x: new Date(candle.date).getTime(),
      o: candle.open,
      h: candle.high,
      l: candle.low,
      c: candle.close
    }));
};

export const alignComparedOhlc = (primary: OhlcPoint[], compared: OhlcPoint[]): OhlcPoint[] => {
  const primaryTimestamps = new Set(primary.map((point) => point.x));
  return compared.filter((point) => primaryTimestamps.has(point.x));
};

export const buildOhlcDataset = (data: OhlcPoint[], label: string) => ({
  label,
  data
});

export const buildTradeAnnotation = (trade: TradeLike, entryTime: number, exitTime: number) => ({
  tradeBox: {
    type: 'box' as const,
    xMin: entryTime,
    xMax: exitTime,
    yMin: trade.stopLoss,
    yMax: trade.takeProfit,
    backgroundColor: trade.result === 'win' ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)',
    borderColor: trade.result === 'win' ? 'green' : 'red',
    borderWidth: 2,
    label: {
      content: 'Trade',
      position: 'start' as const
    }
  }
});
