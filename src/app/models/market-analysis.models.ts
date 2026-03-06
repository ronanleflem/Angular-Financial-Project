export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SeasonalityBar {
  label: string;
  value: number;
}

export interface HeatmapCell {
  dow: number;
  hour: number;
  value: number;
}

export interface SeasonalityProfile {
  byMonth: SeasonalityBar[];
  byDow: SeasonalityBar[];
  byHour: HeatmapCell[];
}

export interface StatsSummaryRow {
  event: string;
  target: string;
  n: number;
  pHat: number;
  ciLow: number;
  ciHigh: number;
  lift?: number;
  qValue?: number;
}

export interface KpiSummary {
  atrPercent: number;
  averageRange: number;
  skewness: number;
  kurtosis: number;
  maxDrawdown: number;
}

export type FilterSource = 'JAVA' | 'PY';

export interface FilterSeriesPoint {
  t: number;
  v: number;
}

export interface FilterCard {
  id: string;
  title: string;
  source: FilterSource;
  category: string;
  description?: string;
  score?: number;
  ratio?: number;
  metrics?: Record<string, number | string>;
  series?: FilterSeriesPoint[];
}

export interface ApiResult<T> {
  data: T;
  isMock: boolean;
}

export type MarketAnalysisSpecType = 'market_stats' | 'seasonality';

export interface MarketAnalysisRunItem {
  runId: string;
  requestId: string;
  specType: MarketAnalysisSpecType;
  status: string;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string | null;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  cancelRequested: boolean;
  persistenceEnabled: boolean;
  specId: string | null;
  datasetId: string | null;
}

export interface MarketAnalysisRunsPage {
  items: MarketAnalysisRunItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  sort: string | null;
}

export interface MarketAnalysisRunsQuery {
  specType?: MarketAnalysisSpecType | '';
  status?: string;
  symbol?: string;
  timeframe?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface MarketAnalysisRunDetail {
  runId: string;
  requestId: string;
  specType: MarketAnalysisSpecType;
  status: string;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string | null;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  cancelRequested: boolean;
  persistenceEnabled: boolean;
  specId: string | null;
  datasetId: string | null;
  payloadJson: Record<string, unknown> | null;
  progressJson: Record<string, unknown> | null;
  resultJsonAvailable: boolean;
}

export interface MarketAnalysisRunResultMeta {
  specId: string | null;
  datasetId: string | null;
  outDir: string | null;
  window: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
}

export interface MarketAnalysisSeasonalityRunSummary {
  [key: string]: unknown;
}

export interface MarketAnalysisRowRecord {
  [key: string]: unknown;
}

export interface MarketAnalysisRunResultData {
  marketStatsRows: MarketAnalysisRowRecord[];
  seasonalityProfiles: MarketAnalysisRowRecord[];
  seasonalityRunSummary: MarketAnalysisSeasonalityRunSummary | null;
  rawResultJson: Record<string, unknown> | null;
}

export interface MarketAnalysisRunResult {
  runId: string;
  specType: MarketAnalysisSpecType;
  source: 'result_json' | 'persisted_tables' | string;
  meta: MarketAnalysisRunResultMeta;
  data: MarketAnalysisRunResultData;
}
