export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export type SessionType = '24/7' | 'RTH' | 'Globex' | '-';
export type DataSourceType = 'API' | 'CSV' | 'Mock';
export type ConflictPolicy = 'merge' | 'overwrite' | 'skip';
export type RolloverPolicy = 'date' | 'volume';

export interface DataSeries {
  symbol: string;
  broker: string;
  venue?: string;
  timeframe: string;
  start: string;
  end: string;
  count: number;
  coveragePct: number;
  gapsPct?: number;
  sessions?: SessionType;
  tz?: string;
  updatedAt?: string;
  datasetId?: string;
  source: DataSourceType;
}

export interface CoverageInfo {
  start: string;
  end: string;
  count: number;
  expected: number;
  coveragePct: number;
  gapsPct?: number;
}

export interface SaveRangeRequest {
  broker: string;
  source: Extract<DataSourceType, 'API' | 'CSV'>;
  symbol: string;
  timeframe: string;
  start: string;
  end: string;
  venue?: string;
  timezone?: string;
  conflictPolicy?: ConflictPolicy;
  rollover?: RolloverPolicy;
}

export interface SaveResult {
  ok: boolean;
  mock?: boolean;
  message?: string;
}

export interface SymbolRef {
  id?: string;
  ticker: string;
  name?: string;
  market?: string;
}

