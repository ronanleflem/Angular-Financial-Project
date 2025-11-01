export type LiveSignalSide = 'LONG' | 'SHORT';

export interface LiveSignalPayload {
  exitTsUtc?: string;
  exitPrice?: number;
  [key: string]: unknown;
}

export interface LiveSignal {
  strategyId: string;
  symbol: string;
  timeframe: string;
  tsOpenUtc: string;
  side: LiveSignalSide;
  entryPrice: number;
  sl?: number;
  tp?: number;
  expectedRr?: number;
  payload?: LiveSignalPayload;
}

export interface OhlcvBar {
  tsUtc: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}
