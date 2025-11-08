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
export type DataImportJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';

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

export interface SymbolRef {
  id?: string;
  ticker: string;
  name?: string;
  market?: string;
}

export interface DataImportJobRequest {
  broker: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  sourceType: string;
  venue?: string;
  timezone?: string;
  conflictPolicy?: ConflictPolicy;
  rollover?: RolloverPolicy;
}

export interface DataImportJob {
  id: string;
  broker: string;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  sourceType: string;
  venue?: string;
  timezone?: string;
  conflictPolicy?: ConflictPolicy;
  rollover?: RolloverPolicy;
  status?: DataImportJobStatus;
  progress?: number;
  message?: string;
  createdAt?: string;
  updatedAt?: string;
}

