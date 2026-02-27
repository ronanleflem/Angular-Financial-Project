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
  currency?: string;
  exchange?: string;
  broker?: string;
}

export interface DataBlockBase {
  symbol?: string;
  symbols?: string[];
  assetClass?: string;
  currency?: string;
  timeframe: Timeframe;
}

export interface PeriodBlock {
  startDate: IsoDateString;
  endDate: IsoDateString;
}

export type DcaStrategyType = 'dca_equity' | 'dca_etf' | 'crypto_grid';
export type DcaExecutionMode = 'bar_close' | 'intracandle';
export type DcaDrawdownReference = 'ATH' | '1M' | '3M' | '6M' | '1Y';

export interface DcaGridLevel {
  dd: number;
  weight: number;
}

export interface DcaTpSlLeg {
  type: 'percent' | string;
  value: number;
}

export interface DcaBreakEvenBlock {
  enabled: boolean;
  triggerPct?: number;
}

export interface DcaTpSlBlock {
  enabled: boolean;
  mode: 'rule_based' | string;
  tp: DcaTpSlLeg;
  sl: DcaTpSlLeg;
  breakEven?: DcaBreakEvenBlock;
}

export interface DcaStrategyCore {
  type: DcaStrategyType;
  params: DcaEquityParams | DcaEtfParams | CryptoGridParams;
}

export interface DcaEquityParams {
  kind: 'dca_equity';
  assetClass: string;
  drawdownReference: DcaDrawdownReference | string;
  executionMode: DcaExecutionMode | string;
  tpSl?: DcaTpSlBlock | string;
  grid: DcaGridLevel[];
  requireCrossing: boolean;
}

export interface DcaEtfParams {
  kind: 'dca_etf';
  assetClass: string;
  activationLimit: number;
  resetOnNewHigh: boolean;
  rearmOnReboundPct: number;
  forceCloseEnd: boolean;
}

export interface CryptoGridParams {
  kind: 'crypto_grid';
  grid: DcaGridLevel[];
  assetClass: string;
  tpSl?: DcaTpSlBlock | string;
}

export interface DcaDataBlock extends DataBlockBase, PeriodBlock {
  frequency?: 'weekly' | 'biweekly' | 'monthly' | string;
  amount?: number;
  feePct?: number;
  broker?: string;
  reinvestDividends?: boolean;
}

export interface BacktestMySqlDataSpec {
  host?: string;
  port?: number;
  database?: string;
  table?: string;
  user?: string;
  password?: string;
}

export interface BacktestDataBlock extends DataBlockBase, PeriodBlock {
  source?: string;
  path?: string;
  mysqlEnv?: string;
  mysql?: BacktestMySqlDataSpec;
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

export interface BacktestStrategyParamsBlock {
  assetClass?: 'CRYPTO' | 'ETF' | 'EQUITY' | 'FOREX' | string;
  tpSl?: BacktestTpSlBlock;
  screening?: BacktestScreeningBlock;
}

export interface MarketStatsDataBlock extends DataBlockBase, PeriodBlock {
  assetClass?: 'CRYPTO' | 'ETF' | 'EQUITY' | 'FOREX' | string;
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
}

export interface MarketStatsPersistenceBlock {
  enabled: boolean;
  specId?: string;
  datasetId?: string;
}

export interface MarketStatsOutputBlock {
  outDir?: string;
}

export interface SeasonalityDataBlock extends DataBlockBase, PeriodBlock {
  assetClass?: 'CRYPTO' | 'ETF' | 'EQUITY' | 'FOREX' | string;
  window: string;
  startYear: number;
  endYear: number;
}

export interface SeasonalityProfileBlock {
  id: string;
  bySession?: boolean;
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
  execution?: SeasonalityExecutionBlock;
}

export interface StressTestsDataBlock {
  baseRunId: string;
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
    name: string;
    type: string;
    shockPct?: number;
    volMultiplier?: number;
    drawdownPct?: number;
    window?: number;
    index?: string | number;
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
      universe?: UniverseItem[];
      strategy: DcaStrategyCore;
      filters?: BacktestFiltersBlock;
      performance?: PerformanceBlock;
    }
  | {
      runType: 'backtest';
      data: BacktestDataBlock;
      strategy?: { name?: string; params?: BacktestStrategyParamsBlock };
      signal: BacktestSignalBlock;
      filters?: BacktestFiltersBlock;
      performance?: PerformanceBlock;
    }
  | {
      runType: 'market_stats';
      data: MarketStatsDataBlock;
      stats: MarketStatsBlock;
      persistence?: MarketStatsPersistenceBlock;
      output?: MarketStatsOutputBlock;
    }
  | {
      runType: 'seasonality';
      data: SeasonalityDataBlock;
      seasonality: SeasonalityBlock;
      persistence?: SeasonalityPersistenceBlock;
      output?: SeasonalityArtifactsBlock;
      performance?: PerformanceBlock;
    }
  | {
      runType: 'stress_tests';
      data: StressTestsDataBlock;
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
      validateDateOrder(errors, 'data.startDate', 'data.endDate', input.data.startDate, input.data.endDate);
      validateBacktestSignal(errors, input.signal);
      break;
    case 'market_stats':
      validateSymbolSelection(errors, input.data.symbol, input.data.symbols);
      validateRequired(errors, 'data.timeframe', input.data.timeframe);
      validateRequired(errors, 'data.startDate', input.data.startDate);
      validateRequired(errors, 'data.endDate', input.data.endDate);
      validateDateOrder(errors, 'data.startDate', 'data.endDate', input.data.startDate, input.data.endDate);
      validateRequired(errors, 'stats.event.id', input.stats.event.id);
      validateRequired(errors, 'stats.condition.id', input.stats.condition.id);
      validateRequired(errors, 'stats.target.id', input.stats.target.id);
      break;
    case 'seasonality':
      validateSymbolSelection(errors, input.data.symbol, input.data.symbols);
      validateRequired(errors, 'data.timeframe', input.data.timeframe);
      validateRequired(errors, 'data.startDate', input.data.startDate);
      validateRequired(errors, 'data.endDate', input.data.endDate);
      validateDateOrder(errors, 'data.startDate', 'data.endDate', input.data.startDate, input.data.endDate);
      validateRequired(errors, 'seasonality.profile.id', input.seasonality.profile.id);
      validateRequired(errors, 'seasonality.signal.method', input.seasonality.signal.method);
      if (!input.seasonality.signal.dims?.length) {
        errors.push({ path: 'seasonality.signal.dims', message: 'at least one dimension is required' });
      }
      break;
    case 'stress_tests':
      validateRequired(errors, 'data.baseRunId', input.data.baseRunId);
      if (!input.performance?.stressTests) {
        errors.push({ path: 'performance.stressTests', message: 'stressTests is required' });
      } else {
        if (input.performance.stressTests.nSims <= 0) {
          errors.push({ path: 'performance.stressTests.nSims', message: 'nSims must be > 0' });
        }
        if (Array.isArray(input.performance.stressTests.scenarios)) {
          input.performance.stressTests.scenarios.forEach((scenario, index) => {
            if (!String(scenario?.name ?? '').trim()) {
              errors.push({
                path: `performance.stressTests.scenarios[${index}].name`,
                message: 'name is required'
              });
            }
          });
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

function validateSymbolSelection(
  errors: ValidationError[],
  symbol: unknown,
  symbols: unknown
): void {
  const hasSymbol = !(symbol === null || symbol === undefined || symbol === '');
  const symbolList = Array.isArray(symbols)
    ? symbols.map(item => String(item ?? '').trim()).filter(Boolean)
    : [];
  if (!hasSymbol && symbolList.length === 0) {
    errors.push({ path: 'data.symbols', message: 'at least one symbol is required' });
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
  const paramsWithAssetClass = strategy.params as { assetClass?: string };
  if (!paramsWithAssetClass.assetClass) {
    errors.push({ path: 'strategy.params.assetClass', message: 'required' });
  } else if (!['CRYPTO', 'ETF', 'EQUITY', 'FOREX'].includes(paramsWithAssetClass.assetClass)) {
    errors.push({
      path: 'strategy.params.assetClass',
      message: 'must be one of: CRYPTO, ETF, EQUITY, FOREX'
    });
  }
  if (strategy.type === 'dca_equity') {
    const params = strategy.params as DcaEquityParams;
    if (!params.grid?.length) {
      errors.push({ path: 'strategy.params.grid', message: 'at least one grid level is required' });
    }
    if (!params.drawdownReference) {
      errors.push({ path: 'strategy.params.drawdownReference', message: 'required' });
    } else if (!['ATH', '1M', '3M', '6M', '1Y'].includes(params.drawdownReference)) {
      errors.push({
        path: 'strategy.params.drawdownReference',
        message: 'must be one of: ATH, 1M, 3M, 6M, 1Y'
      });
    }
    if (!params.executionMode) {
      errors.push({ path: 'strategy.params.executionMode', message: 'required' });
    } else if (!['bar_close', 'intracandle'].includes(params.executionMode)) {
      errors.push({ path: 'strategy.params.executionMode', message: 'must be one of: bar_close, intracandle' });
    }
    const tpSl = params.tpSl;
    if (tpSl && typeof tpSl === 'object') {
      if (!tpSl.mode || tpSl.mode !== 'rule_based') {
        errors.push({ path: 'strategy.params.tpSl.mode', message: 'must be rule_based' });
      }
      if (tpSl.enabled) {
        if (!tpSl.tp || tpSl.tp.value <= 0) {
          errors.push({ path: 'strategy.params.tpSl.tp.value', message: 'must be > 0' });
        }
        if (!tpSl.sl || tpSl.sl.value <= 0) {
          errors.push({ path: 'strategy.params.tpSl.sl.value', message: 'must be > 0' });
        }
      }
    }
  }
  if (strategy.type === 'crypto_grid') {
    const params = strategy.params as CryptoGridParams;
    if (!params.grid?.length) {
      errors.push({ path: 'strategy.params.grid', message: 'at least one grid level is required' });
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
