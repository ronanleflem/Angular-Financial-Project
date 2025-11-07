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
