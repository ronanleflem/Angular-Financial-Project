export type RunType = 'dca' | 'backtest' | 'market_stats' | 'seasonality' | 'stress_tests';

export type Timeframe = '15m' | '1h' | '4h' | '1d' | string;
export type IsoDateString = string;

export interface FilterConfig {
  id: string;
  params: Record<string, number | string | boolean>;
}

export interface FilterRule {
  id: string;
  mode: 'soft' | 'hard';
  weight: number;
}

export interface FilterRulesConfig {
  minScore: number;
  minScorePct: number;
}

export interface UniverseItem {
  symbol: string;
  assetClass: string;
  exchange?: string;
  broker?: string;
}

export interface DataBlockBase {
  symbol: string;
  timeframe: Timeframe;
}

export interface PeriodBlock {
  startDate: IsoDateString;
  endDate: IsoDateString;
}

export type DcaStrategyType = 'dca_equity' | 'dca_etf' | 'crypto_grid';

export interface DcaStrategyCore {
  type: DcaStrategyType;
  grid: string[];
  params: DcaEquityParams | DcaEtfParams | CryptoGridParams;
}

export interface DcaEquityParams {
  kind: 'dca_equity';
  drawdownReference: string;
  executionMode: string;
  tpSl?: string;
  requireCrossing: boolean;
}

export interface DcaEtfParams {
  kind: 'dca_etf';
  activationLimit: number;
  resetOnNewHigh: boolean;
  rearmOnReboundPct: number;
  forceCloseEnd: boolean;
}

export interface CryptoGridParams {
  kind: 'crypto_grid';
  tpSl?: string;
}

export interface DcaDataBlock extends DataBlockBase, PeriodBlock {
  frequency?: 'weekly' | 'biweekly' | 'monthly' | string;
  amount?: number;
  feePct?: number;
  broker?: string;
  reinvestDividends?: boolean;
  universe?: UniverseItem[];
}

export interface BacktestDataBlock extends DataBlockBase, PeriodBlock {
  strategyName: string;
}

export interface BacktestSignalBlock {
  type: string;
  fast?: number;
  slow?: number;
  requireCrossing?: boolean;
}

export interface BacktestTpSlBlock {
  atrWindow?: number;
  atrK?: number;
  rMult?: number;
  slippageBps?: number;
  feeBps?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  trailingStop?: boolean;
  dynamicSl?: {
    enabled: boolean;
    mode?: string;
    atrMult?: number;
  };
  jitter?: {
    enabled: boolean;
    dist?: string;
    tpBps?: number;
    slBps?: number;
    seed?: number;
  };
}

export interface BacktestFiltersBlock {
  filters: FilterConfig[];
  rules: FilterRule[];
  rulesConfig: FilterRulesConfig;
}

export interface BacktestScreeningBlock {
  enabled: boolean;
  window?: PeriodBlock;
  maxBars?: number;
  maxTrades?: number;
  maxSeconds?: number;
}

export interface MarketStatsDataBlock extends DataBlockBase {
  lookback: number;
  statsPack: string;
  session?: string;
  includeWeekends?: boolean;
}

export interface MarketStatsBlock {
  event: {
    id: string;
    params: Record<string, number | string | boolean>;
  };
  condition: {
    id: string;
    params: Record<string, number | string | boolean>;
  };
  target: {
    id: string;
    params: Record<string, number | string | boolean>;
  };
  validation: {
    trainMonths: number;
    testMonths: number;
    folds: number;
    embargoDays: number;
  };
  persistence: {
    enabled: boolean;
    specId?: string;
    datasetId?: string;
  };
  artifacts: {
    outDir?: string;
  };
}

export interface SeasonalityDataBlock extends DataBlockBase {
  window: string;
  startYear: number;
  endYear: number;
  filter?: string;
  normalize?: boolean;
}

export interface SeasonalityProfileBlock {
  id: string;
  measure: string;
  retHorizon: number;
  minSamplesBin: number;
  params: Record<string, number | string | boolean>;
}

export interface SeasonalitySignalBlock {
  method: string;
  threshold?: number;
  topk?: number;
  dims: string[];
  combine: string;
}

export interface SeasonalityComputeBlock {
  maxTrials: number;
  searchSpace?: string;
}

export interface SeasonalityExecutionBlock {
  riskModel: string;
  tpSl?: string;
}

export interface SeasonalityValidationBlock {
  trainMonths: number;
  testMonths: number;
  folds: number;
  embargoDays: number;
}

export interface SeasonalityPersistenceBlock {
  enabled: boolean;
  specId?: string;
  datasetId?: string;
}

export interface SeasonalityArtifactsBlock {
  outDir?: string;
}

export interface SeasonalityBlock {
  profile: SeasonalityProfileBlock;
  signal: SeasonalitySignalBlock;
  compute: SeasonalityComputeBlock;
  execution: SeasonalityExecutionBlock;
  validation: SeasonalityValidationBlock;
  persistence: SeasonalityPersistenceBlock;
  artifacts: SeasonalityArtifactsBlock;
}

export interface MonteCarloStressTests {
  enabled: boolean;
  source?: 'equity' | 'returns' | 'trades' | string;
  nSims: number;
  seed?: number;
  method?: string;
  blockSize?: number;
  overlapping?: boolean;
  timeDistribution?: {
    mode?: string;
    seed?: number;
  };
  paramDrift?: {
    mode?: string;
    dist?: string;
    mu?: number;
    sigma?: number;
    low?: number;
    high?: number;
    min?: number;
    max?: number;
    seed?: number;
  };
  sizing?: {
    dist?: string;
    low?: number;
    high?: number;
    mu?: number;
    sigma?: number;
    min?: number;
    max?: number;
  };
  output?: {
    mode?: string;
    maxCurves?: number;
    curveStride?: number;
  };
  scenarios?: Array<{
    type: string;
    shockPct?: number;
    volMultiplier?: number;
    drawdownPct?: number;
    window?: number;
    index?: string;
  }>;
  multiAsset?: {
    aggregation?: string;
    weights?: number[];
    timestampAlignment?: string;
  };
}

export interface PerformanceBlock {
  initialCapital?: number;
  capitalPerUnit?: number;
  maxCapitalPerTrade?: number;
  riskPct?: number;
  riskFreeRatePct?: number;
  stressTests?: MonteCarloStressTests;
}

export type RunRequestInput =
  | {
      runType: 'dca';
      data: DcaDataBlock;
      strategy: DcaStrategyCore;
      filters?: BacktestFiltersBlock;
      performance?: PerformanceBlock;
    }
  | {
      runType: 'backtest';
      data: BacktestDataBlock;
      strategy: { name: string; tpSl?: BacktestTpSlBlock; screening?: BacktestScreeningBlock };
      signal: BacktestSignalBlock;
      filters?: BacktestFiltersBlock;
      performance?: PerformanceBlock;
    }
  | {
      runType: 'market_stats';
      data: MarketStatsDataBlock;
      stats: MarketStatsBlock;
    }
  | {
      runType: 'seasonality';
      data: SeasonalityDataBlock;
      seasonality: SeasonalityBlock;
      performance?: PerformanceBlock;
    }
  | {
      runType: 'stress_tests';
      data: DataBlockBase;
      performance: PerformanceBlock & { stressTests: MonteCarloStressTests };
    };

export interface ValidationError {
  path: string;
  message: string;
}

export function validateRunRequest(input: RunRequestInput): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (input.runType) {
    case 'dca':
      validateRequired(errors, 'data.symbol', input.data.symbol);
      validateRequired(errors, 'data.timeframe', input.data.timeframe);
      if (input.data.frequency !== undefined) {
        validateRequired(errors, 'data.frequency', input.data.frequency);
      }
      validateRequired(errors, 'data.startDate', input.data.startDate);
      validateRequired(errors, 'data.endDate', input.data.endDate);
      if (input.data.amount !== undefined && input.data.amount <= 0) {
        errors.push({ path: 'data.amount', message: 'amount must be > 0' });
      }
      validateDateOrder(errors, 'data.startDate', 'data.endDate', input.data.startDate, input.data.endDate);
      validateDcaStrategy(errors, input.strategy);
      break;
    case 'backtest':
      validateRequired(errors, 'data.symbol', input.data.symbol);
      validateRequired(errors, 'data.timeframe', input.data.timeframe);
      validateRequired(errors, 'data.startDate', input.data.startDate);
      validateRequired(errors, 'data.endDate', input.data.endDate);
      validateRequired(errors, 'data.strategyName', input.data.strategyName);
      validateDateOrder(errors, 'data.startDate', 'data.endDate', input.data.startDate, input.data.endDate);
      validateBacktestSignal(errors, input.signal);
      break;
    case 'market_stats':
      validateRequired(errors, 'data.symbol', input.data.symbol);
      validateRequired(errors, 'data.timeframe', input.data.timeframe);
      validateRequired(errors, 'stats.event.id', input.stats.event.id);
      validateRequired(errors, 'stats.condition.id', input.stats.condition.id);
      validateRequired(errors, 'stats.target.id', input.stats.target.id);
      break;
    case 'seasonality':
      validateRequired(errors, 'data.symbol', input.data.symbol);
      validateRequired(errors, 'data.timeframe', input.data.timeframe);
      validateRequired(errors, 'seasonality.profile.id', input.seasonality.profile.id);
      validateRequired(errors, 'seasonality.signal.method', input.seasonality.signal.method);
      if (!input.seasonality.signal.dims?.length) {
        errors.push({ path: 'seasonality.signal.dims', message: 'at least one dimension is required' });
      }
      break;
    case 'stress_tests':
      validateRequired(errors, 'data.symbol', input.data.symbol);
      validateRequired(errors, 'data.timeframe', input.data.timeframe);
      if (!input.performance?.stressTests) {
        errors.push({ path: 'performance.stressTests', message: 'stressTests is required' });
      } else {
        if (input.performance.stressTests.nSims <= 0) {
          errors.push({ path: 'performance.stressTests.nSims', message: 'nSims must be > 0' });
        }
      }
      break;
    default:
      errors.push({ path: 'runType', message: 'unsupported runType' });
  }

  return errors;
}

function validateRequired(errors: ValidationError[], path: string, value: unknown): void {
  if (value === null || value === undefined || value === '') {
    errors.push({ path, message: 'required' });
  }
}

function validateDateOrder(
  errors: ValidationError[],
  startPath: string,
  endPath: string,
  start: string,
  end: string
): void {
  if (!start || !end) {
    return;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return;
  }
  if (startDate > endDate) {
    errors.push({ path: startPath, message: 'startDate must be <= endDate' });
    errors.push({ path: endPath, message: 'endDate must be >= startDate' });
  }
}

function validateDcaStrategy(errors: ValidationError[], strategy: DcaStrategyCore): void {
  validateRequired(errors, 'strategy.type', strategy.type);
  if (!strategy.grid?.length) {
    errors.push({ path: 'strategy.grid', message: 'at least one grid preset is required' });
  }
  if (strategy.type === 'dca_equity') {
    const params = strategy.params as DcaEquityParams;
    if (!params.drawdownReference) {
      errors.push({ path: 'strategy.params.drawdownReference', message: 'required' });
    }
    if (!params.executionMode) {
      errors.push({ path: 'strategy.params.executionMode', message: 'required' });
    }
  }
}

function validateBacktestSignal(errors: ValidationError[], signal: BacktestSignalBlock): void {
  validateRequired(errors, 'signal.type', signal.type);
  if (signal.type === 'ema_cross') {
    if (!signal.fast || signal.fast <= 0) {
      errors.push({ path: 'signal.fast', message: 'fast must be > 0 for ema_cross' });
    }
    if (!signal.slow || signal.slow <= 0) {
      errors.push({ path: 'signal.slow', message: 'slow must be > 0 for ema_cross' });
    }
    if (signal.fast && signal.slow && signal.fast >= signal.slow) {
      errors.push({ path: 'signal.fast', message: 'fast must be < slow for ema_cross' });
      errors.push({ path: 'signal.slow', message: 'slow must be > fast for ema_cross' });
    }
  }
}
