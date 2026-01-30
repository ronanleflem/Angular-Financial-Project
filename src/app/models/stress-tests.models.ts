export interface StressTestsMeta {
  strategyId?: string;
  runId?: string;
  assetClass?: string;
  symbol?: string;
  timeframe?: string;
  mode?: string;
}

export interface PercentileMetric {
  p5?: number;
  p10?: number;
  p50?: number;
  p90?: number;
  p95?: number;
  mean?: number;
  std?: number;
  median?: number;
}

export interface PercentileBand {
  p5?: number[];
  p10?: number[];
  p50?: number[];
  p90?: number[];
  p95?: number[];
}

export interface MonteCarloSummary {
  parameters?: Record<string, unknown>;
  metricsByDistribution?: Record<string, PercentileMetric>;
  metrics?: Record<string, unknown>;
  curves?: {
    equitySample?: number[][];
    percentileBand?: PercentileBand;
    equityCurves?: number[][];
  };
  equity_curves?: number[][];
  warnings?: string[];
}

export interface ScenarioSummaryItem {
  name: string;
  type?: string;
  settings?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  curve?: number[];
  warnings?: string[];
}

export interface ScenariosSummary {
  items?: ScenarioSummaryItem[];
  warnings?: string[];
}

export interface StressTestsSummaryResponse {
  meta?: StressTestsMeta;
  monteCarlo?: MonteCarloSummary;
  scenarios?: ScenariosSummary;
}

export interface RawStressTestRecord {
  mode?: string;
  metrics?: Record<string, unknown>;
  distributions?: Record<string, PercentileMetric>;
  parameters?: Record<string, unknown>;
  warnings?: string[];
  items?: ScenarioSummaryItem[];
  equity_curves?: number[][] | Record<string, number[]>;
  curves?: {
    equitySample?: number[][];
    percentileBand?: PercentileBand;
    equityCurves?: number[][];
  } | Record<string, number[]>;
}

export type RawStressTestsResponse =
  | RawStressTestRecord[]
  | {
      records?: RawStressTestRecord[];
      monte_carlo?: RawStressTestRecord;
      monteCarlo?: RawStressTestRecord;
      scenarios?: RawStressTestRecord;
    };

export interface MonteCarloKpis {
  ruinProbability?: number;
  medianReturn?: number;
  medianMaxDrawdown?: number;
}

export interface MonteCarloViewModel {
  parameters?: Record<string, unknown>;
  metricsByDistribution: Record<string, PercentileMetric>;
  curveSamples: number[][];
  percentileBand?: PercentileBand;
  warnings: string[];
  kpis: MonteCarloKpis;
  mode?: string;
}

export interface ScenarioViewModel {
  name: string;
  type?: string;
  settings?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  curve?: number[];
  warnings?: string[];
}

export interface ScenariosViewModel {
  items: ScenarioViewModel[];
  warnings: string[];
}

export interface StressTestsViewModel {
  meta?: StressTestsMeta;
  monteCarlo?: MonteCarloViewModel;
  scenarios?: ScenariosViewModel;
  source: 'summary' | 'raw';
}

export interface StressTestRunSummary {
  runId: string;
  createdAt?: string;
  strategyId?: string;
  symbol?: string;
  assetClass?: string;
  timeframe?: string;
  status?: string;
  hasSummary?: boolean;
  modes?: string[];
}
