import { RunRequestInput } from '../models/run-request-input.model';
import { PresetTheme } from '../services/presets.service';

export function mergePresetFormValue(
  theme: PresetTheme,
  formValue: Record<string, unknown> | null | undefined,
  payload: RunRequestInput | null | undefined
): Record<string, unknown> {
  const base = buildFormValueFromPayload(theme, payload);
  const form = formValue ?? {};
  return { ...base, ...form };
}

function buildFormValueFromPayload(
  theme: PresetTheme,
  payload: RunRequestInput | null | undefined
): Record<string, unknown> {
  if (!payload) {
    return {};
  }
  if (!runTypeMatchesTheme(payload.runType, theme)) {
    return {};
  }

  switch (theme) {
    case 'dca':
      return mapDcaPayload(payload);
    case 'backtests':
      return mapBacktestPayload(payload);
    case 'market-stats':
      return mapMarketStatsPayload(payload);
    case 'seasonality':
      return mapSeasonalityPayload(payload);
    case 'stress-tests':
      return mapStressTestsPayload(payload);
    default:
      return {};
  }
}

function runTypeMatchesTheme(runType: string, theme: PresetTheme): boolean {
  return (
    (runType === 'dca' && theme === 'dca') ||
    (runType === 'backtest' && theme === 'backtests') ||
    (runType === 'market_stats' && theme === 'market-stats') ||
    (runType === 'seasonality' && theme === 'seasonality') ||
    (runType === 'stress_tests' && theme === 'stress-tests')
  );
}

function mapDcaPayload(payload: RunRequestInput): Record<string, unknown> {
  if (payload.runType !== 'dca') {
    return {};
  }
  const filters = payload.filters?.filters?.map(item => item.id) ?? [];
  const rules = payload.filters?.rules?.map(item => item.id) ?? [];
  const params = payload.strategy.params as any;
  return {
    symbol: payload.data.symbol,
    timeframe: payload.data.timeframe,
    frequency: payload.data.frequency,
    amount: payload.data.amount,
    startDate: payload.data.startDate,
    endDate: payload.data.endDate,
    feePct: payload.data.feePct,
    broker: payload.data.broker,
    reinvestDividends: payload.data.reinvestDividends,
    strategyType: payload.strategy.type,
    gridPresets: inferDcaGridPresets(params.grid),
    drawdownReference: params.drawdownReference,
    executionMode: params.executionMode,
    tpSlPreset: inferDcaTpSlPreset(params.tpSl),
    requireCrossing: params.requireCrossing,
    activationLimit: params.activationLimit,
    resetOnNewHigh: params.resetOnNewHigh,
    rearmOnReboundPct: params.rearmOnReboundPct,
    forceCloseEnd: params.forceCloseEnd,
    universe: payload.data.universe?.map(item => item.symbol) ?? [],
    filters,
    filterRules: rules,
    filterRuleMinScore: payload.filters?.rulesConfig?.minScore,
    filterRuleMinScorePct: payload.filters?.rulesConfig?.minScorePct,
    initialCapital: payload.performance?.initialCapital,
    capitalPerUnit: payload.performance?.capitalPerUnit,
    maxCapitalPerTrade: payload.performance?.maxCapitalPerTrade,
    mcEnabled: payload.performance?.stressTests?.enabled,
    mcPaths: payload.performance?.stressTests?.nSims,
    mcSeed: payload.performance?.stressTests?.seed
  };
}

function inferDcaGridPresets(grid: unknown): string[] {
  if (!Array.isArray(grid) || grid.length === 0) {
    return ['grid_balanced'];
  }
  const levels = grid
    .map(item => Number((item as any)?.dd))
    .filter(value => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (levels.includes(-3) || levels.includes(-6)) {
    return ['grid_conservative'];
  }
  if (levels.includes(-4) || levels.includes(-8)) {
    return ['grid_aggressive'];
  }
  return ['grid_balanced'];
}

function inferDcaTpSlPreset(tpSl: unknown): string {
  if (!tpSl || typeof tpSl !== 'object') {
    return 'none';
  }
  if ((tpSl as any).enabled === false) {
    return 'none';
  }
  const firstRule = Array.isArray((tpSl as any).rules) ? (tpSl as any).rules[0] : undefined;
  const tpPct = Number((firstRule as any)?.tpPct ?? 0);
  if (tpPct >= 20) {
    return 'tp_3_sl_1.5';
  }
  return 'tp_2_sl_1';
}

function mapBacktestPayload(payload: RunRequestInput): Record<string, unknown> {
  if (payload.runType !== 'backtest') {
    return {};
  }
  const filters = payload.filters?.filters?.map(item => item.id) ?? [];
  const rules = payload.filters?.rules?.map(item => item.id) ?? [];
  const strategy = payload.strategy as any;
  const params = strategy.params ?? {};
  const tpSl = strategy.tpSl ?? params.tpSl ?? {};
  const screening = strategy.screening ?? params.screening ?? {};
  return {
    strategy: payload.strategy.name,
    symbol: payload.data.symbol,
    timeframe: payload.data.timeframe,
    startDate: payload.data.startDate,
    endDate: payload.data.endDate,
    capital: payload.performance?.initialCapital,
    riskPct: payload.performance?.riskPct,
    riskFreeRate: payload.performance?.riskFreeRatePct,
    stopLoss: (tpSl as any).stopLossPct,
    takeProfit: (tpSl as any).takeProfitPct,
    trailingStop: (tpSl as any).trailingStop,
    atrWindow: (tpSl as any).atrWindow,
    atrK: (tpSl as any).atrK,
    rMult: (tpSl as any).rMult,
    slippageBps: (tpSl as any).slippageBps,
    feeBps: (tpSl as any).feeBps,
    dynamicSlEnabled: (tpSl as any).dynamicSl?.enabled,
    dynamicSlMode: (tpSl as any).dynamicSl?.mode,
    dynamicSlAtrMult: (tpSl as any).dynamicSl?.atrMult,
    tpslJitterEnabled: (tpSl as any).jitter?.enabled,
    tpslJitterDist: (tpSl as any).jitter?.dist,
    tpslJitterTpBps: (tpSl as any).jitter?.tpBps,
    tpslJitterSlBps: (tpSl as any).jitter?.slBps,
    tpslJitterSeed: (tpSl as any).jitter?.seed,
    signalType: payload.signal.type,
    fast: payload.signal.fast,
    slow: payload.signal.slow,
    requireCrossing: payload.signal.requireCrossing,
    filters,
    filterRules: rules,
    filterRuleMinScore: payload.filters?.rulesConfig?.minScore,
    filterRuleMinScorePct: payload.filters?.rulesConfig?.minScorePct,
    screeningEnabled: (screening as any).enabled,
    screenWindowStart: (screening as any).window?.startDate,
    screenWindowEnd: (screening as any).window?.endDate,
    screenMaxBars: (screening as any).maxBars,
    screenMaxTrades: (screening as any).maxTrades,
    screenMaxSeconds: (screening as any).maxSeconds,
    mcEnabled: payload.performance?.stressTests?.enabled,
    mcPaths: payload.performance?.stressTests?.nSims,
    mcSeed: payload.performance?.stressTests?.seed
  };
}

function mapMarketStatsPayload(payload: RunRequestInput): Record<string, unknown> {
  if (payload.runType !== 'market_stats') {
    return {};
  }
  const legacyStats = payload.stats as {
    persistence?: { enabled?: boolean; specId?: string; datasetId?: string };
    artifacts?: { outDir?: string };
  };
  const persistence = payload.persistence ?? legacyStats.persistence;
  const output = payload.output ?? legacyStats.artifacts;
  const result: Record<string, unknown> = {
    symbol: payload.data.symbol,
    timeframe: payload.data.timeframe,
    lookback: payload.data.lookback,
    statsPack: payload.data.statsPack,
    session: payload.data.session,
    includeWeekends: payload.data.includeWeekends,
    eventId: payload.stats.event.id,
    conditionId: payload.stats.condition.id,
    targetId: payload.stats.target.id,
    validationTrainMonths: payload.stats.validation.trainMonths,
    validationTestMonths: payload.stats.validation.testMonths,
    validationFolds: payload.stats.validation.folds,
    validationEmbargoDays: payload.stats.validation.embargoDays,
    persistenceEnabled: persistence?.enabled,
    persistenceSpecId: persistence?.specId,
    persistenceDatasetId: persistence?.datasetId,
    artifactsOutDir: output?.outDir
  };
  assignParams(result, `event_${payload.stats.event.id}_`, payload.stats.event.params);
  assignParams(result, `condition_${payload.stats.condition.id}_`, payload.stats.condition.params);
  assignParams(result, `target_${payload.stats.target.id}_`, payload.stats.target.params);
  return result;
}

function mapSeasonalityPayload(payload: RunRequestInput): Record<string, unknown> {
  if (payload.runType !== 'seasonality') {
    return {};
  }
  const legacySeasonality = payload.seasonality as {
    validation?: { trainMonths?: number; testMonths?: number; folds?: number; embargoDays?: number };
    persistence?: { enabled?: boolean; specId?: string; datasetId?: string };
    artifacts?: { outDir?: string };
  };
  const persistence = payload.persistence ?? legacySeasonality.persistence;
  const output = payload.output ?? legacySeasonality.artifacts;
  const profileId = payload.seasonality.profile.id;
  const result: Record<string, unknown> = {
    symbol: payload.data.symbol,
    timeframe: payload.data.timeframe,
    window: payload.data.window,
    startYear: payload.data.startYear,
    endYear: payload.data.endYear,
    profileId,
    profileMeasure: payload.seasonality.profile.measure,
    profileRetHorizon: payload.seasonality.profile.retHorizon,
    profileMinSamples: payload.seasonality.profile.minSamplesBin,
    signalMethod: payload.seasonality.signal.method,
    signalThreshold: payload.seasonality.signal.threshold,
    signalTopk: payload.seasonality.signal.topk,
    signalDims: payload.seasonality.signal.dims,
    signalCombine: payload.seasonality.signal.combine,
    optunaMaxTrials: payload.seasonality.compute.maxTrials,
    optunaSearchSpace: payload.seasonality.compute.searchSpace,
    executionRiskModel: payload.seasonality.execution.riskModel,
    executionTpSl: payload.seasonality.execution.tpSl,
    validationTrainMonths: legacySeasonality.validation?.trainMonths,
    validationTestMonths: legacySeasonality.validation?.testMonths,
    validationFolds: legacySeasonality.validation?.folds,
    validationEmbargoDays: legacySeasonality.validation?.embargoDays,
    persistenceEnabled: persistence?.enabled,
    persistenceSpecId: persistence?.specId,
    persistenceDatasetId: persistence?.datasetId,
    artifactsOutDir: output?.outDir
  };
  assignParams(result, `profile_${profileId}_`, payload.seasonality.profile.params);
  return result;
}

function mapStressTestsPayload(payload: RunRequestInput): Record<string, unknown> {
  if (payload.runType !== 'stress_tests') {
    return {};
  }
  const stress = payload.performance.stressTests;
  const result: Record<string, unknown> = {
    strategy: (payload as any).strategy?.name,
    symbol: payload.data.symbol,
    timeframe: payload.data.timeframe,
    startDate: (payload.data as any).startDate,
    endDate: (payload.data as any).endDate,
    capital: payload.performance.initialCapital,
    source: stress.source,
    nSims: stress.nSims,
    seed: stress.seed,
    method: stress.method,
    blockSize: stress.blockSize,
    overlapping: stress.overlapping,
    timeDistMode: stress.timeDistribution?.mode,
    timeDistSeed: stress.timeDistribution?.seed,
    paramDriftMode: stress.paramDrift?.mode,
    paramDriftDist: stress.paramDrift?.dist,
    paramDriftMu: stress.paramDrift?.mu,
    paramDriftSigma: stress.paramDrift?.sigma,
    paramDriftLow: stress.paramDrift?.low,
    paramDriftHigh: stress.paramDrift?.high,
    paramDriftMin: stress.paramDrift?.min,
    paramDriftMax: stress.paramDrift?.max,
    paramDriftSeed: stress.paramDrift?.seed,
    sizingDist: stress.sizing?.dist,
    sizingMu: stress.sizing?.mu,
    sizingSigma: stress.sizing?.sigma,
    sizingLow: stress.sizing?.low,
    sizingHigh: stress.sizing?.high,
    sizingMin: stress.sizing?.min,
    sizingMax: stress.sizing?.max,
    outputMode: stress.output?.mode,
    outputMaxCurves: stress.output?.maxCurves,
    outputCurveStride: stress.output?.curveStride,
    aggregation: stress.multiAsset?.aggregation,
    weights: stress.multiAsset?.weights ? stress.multiAsset?.weights.join(',') : undefined,
    timestampAlignment: stress.multiAsset?.timestampAlignment,
    includeStressAdvanced: Boolean(
      stress.source !== undefined ||
      stress.overlapping !== undefined ||
      stress.timeDistribution !== undefined ||
      stress.paramDrift !== undefined ||
      stress.sizing !== undefined ||
      stress.output !== undefined ||
      (Array.isArray(stress.scenarios) && stress.scenarios.length > 0) ||
      stress.multiAsset !== undefined
    )
  };

  if (Array.isArray(stress.scenarios)) {
    stress.scenarios.slice(0, 3).forEach((scenario, index) => {
      const slot = index + 1;
      result[`scenario${slot}Type`] = scenario.type;
      result[`scenario${slot}ShockPct`] = scenario.shockPct;
      result[`scenario${slot}VolMultiplier`] = scenario.volMultiplier;
      result[`scenario${slot}DrawdownPct`] = scenario.drawdownPct;
      result[`scenario${slot}Window`] = scenario.window;
      result[`scenario${slot}Index`] = scenario.index;
    });
  }

  return result;
}

function assignParams(
  target: Record<string, unknown>,
  prefix: string,
  params: Record<string, number | string | boolean> | undefined
): void {
  if (!params) {
    return;
  }
  Object.entries(params).forEach(([key, value]) => {
    target[`${prefix}${key}`] = value;
  });
}
