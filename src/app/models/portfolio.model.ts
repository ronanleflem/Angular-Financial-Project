export interface PortfolioSnapshot {
  broker: string;
  totalMarketValue: number;
  availableLiquidity: number;
  positions: PortfolioPosition[];
  asOf: number;
}

export interface PortfolioPosition {
  broker: string;
  account: string;
  symbol: string;
  description: string;
  securityType: string;
  currency: string;
  exchange: string;
  contractId: number | null;
  position: number;
  marketPrice: number;
  marketValue: number;
  averageCost: number;
  unrealizedPnL: number;
  realizedPnL: number;
  relativeValue: number;
}
