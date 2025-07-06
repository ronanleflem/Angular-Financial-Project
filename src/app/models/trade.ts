export interface Trade {
  id?: number;
  tradeType?: string;
  entryTimestamp: string;
  exitTimestamp: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  strategyName?: string;
  result?: string;
}
