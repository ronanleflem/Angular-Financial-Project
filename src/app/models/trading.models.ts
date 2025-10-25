export interface HistBar {
  tsMillis: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StartBarsResponse {
  reqId: number;
  pair: string;
  duration: string;
  barSize: string;
  what: string;
  rth: number;
  formatDate: number;
}

export interface TradeView {
  broker: string;
  account: string;
  symbol: string;
  description: string;
  secType: string | null;
  currency: string | null;
  exchange: string | null;
  conid: number | null;
  position: number;
  avgCost: number;
  marketPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  realizedPnL: number | null;
  asOfMillis: number;
}
