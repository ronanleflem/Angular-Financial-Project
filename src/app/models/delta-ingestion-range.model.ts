export type DeltaInsertedType = 'CRYPTO' | 'ETF' | 'FOREX' | 'STOCK';

export interface DeltaIngestionRange {
  symbol: string;
  insertedType: DeltaInsertedType;
  startDate: string;
  endDate: string;
  timeframe: string;
  insertedAt: string;
}

export interface DeltaIngestionRangeFilters {
  symbol?: string;
  insertedType?: DeltaInsertedType;
  timeframe?: string;
  limit?: number;
}
