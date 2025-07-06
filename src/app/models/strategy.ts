export interface Strategy {
  runId?: string;
  name: string;
  symbol?: string;
  comparedSymbol?: string;
  startDate?: Date;
  endDate?: Date;
  winningTrades?: number;
  losingTrades?: number;
  winRate?: number;
  lossRate?: number;
  totalReturn?: number;
  maxDrawdown?: number;
  averageRR?: number;
  averageTrade?: number;
  tradeCount?: number;
  averageTP?: number;
  averageSL?: number;
  totalNetReturn?: number;
  netWinCount?: number;
  netLossCount?: number;
  averageNetTrade?: number;
}
