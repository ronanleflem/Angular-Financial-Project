export type RunTheme = 'dca' | 'backtests' | 'market-stats' | 'seasonality' | 'stress-tests';

export interface BackendValidationError {
  field: string;
  code?: string;
  message?: string;
}

export interface BackendMappingContext {
  marketEventId?: string;
  marketConditionId?: string;
  marketTargetId?: string;
  seasonalityProfileId?: string;
}

export interface RuntimeRunErrorDetail {
  field?: string;
  code?: string;
  message?: string;
  reason?: string;
}

export interface RuntimeRunError {
  code?: string;
  message?: string;
  details: RuntimeRunErrorDetail[];
}

export function parseBackendValidationErrors(error: unknown): BackendValidationError[] {
  const status = (error as { status?: number } | null)?.status;
  if (status !== 422) {
    return [];
  }
  const payload = (error as { error?: unknown } | null)?.error ?? error;
  const errors = (payload as { errors?: unknown } | null)?.errors;
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors
    .map(entry => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const field = String((entry as { field?: unknown }).field ?? '');
      if (!field) {
        return null;
      }
      const code = (entry as { code?: unknown }).code;
      const message = (entry as { message?: unknown }).message;
      return {
        field,
        code: code !== undefined ? String(code) : undefined,
        message: message !== undefined ? String(message) : undefined
      } as BackendValidationError;
    })
    .filter((entry): entry is BackendValidationError => Boolean(entry));
}

export function parseRunRuntimeError(payload: unknown): RuntimeRunError | null {
  const candidate = extractRuntimeErrorCandidate(payload);
  if (!candidate) {
    return null;
  }

  const code = candidate['code'] !== undefined ? String(candidate['code']) : undefined;
  const message = candidate['message'] !== undefined ? String(candidate['message']) : undefined;
  const detailsRaw = candidate['details'];
  const details = Array.isArray(detailsRaw)
    ? detailsRaw
      .map(item => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const entry = item as Record<string, unknown>;
        const field = entry['field'] !== undefined ? String(entry['field']) : undefined;
        const detailCode = entry['code'] !== undefined ? String(entry['code']) : undefined;
        const detailMessage = entry['message'] !== undefined ? String(entry['message']) : undefined;
        const detailReason = entry['reason'] !== undefined ? String(entry['reason']) : undefined;
        if (!field && !detailCode && !detailMessage && !detailReason) {
          return null;
        }
        return {
          field,
          code: detailCode,
          message: detailMessage,
          reason: detailReason
        } as RuntimeRunErrorDetail;
      })
      .filter((item): item is RuntimeRunErrorDetail => Boolean(item))
    : [];

  if (!code && !message && details.length === 0) {
    return null;
  }

  return {
    code,
    message,
    details
  };
}

export function mapBackendFieldToControlName(
  field: string,
  runTheme: RunTheme,
  context: BackendMappingContext = {}
): string | null {
  if (!field) {
    return null;
  }
  const segments = normalizeFieldSegments(field);
  if (!segments.length) {
    return null;
  }

  switch (segments[0]) {
    case 'data':
      return mapDataField(segments.slice(1), runTheme);
    case 'strategy':
      return mapStrategyField(segments.slice(1), runTheme);
    case 'signal':
      return runTheme === 'backtests' ? mapSignalField(segments.slice(1)) : null;
    case 'screening':
      return runTheme === 'backtests' ? mapScreeningField(segments.slice(1)) : null;
    case 'filters':
      return mapFiltersField(segments.slice(1), runTheme);
    case 'performance':
      return mapPerformanceField(segments.slice(1), runTheme);
    case 'stats':
      return runTheme === 'market-stats' ? mapStatsField(segments.slice(1), context) : null;
    case 'persistence':
      return runTheme === 'market-stats' || runTheme === 'seasonality'
        ? mapStatsPersistenceField(segments.slice(1))
        : null;
    case 'output':
      return runTheme === 'market-stats' || runTheme === 'seasonality'
        ? mapStatsOutputField(segments.slice(1))
        : null;
    case 'seasonality':
      return runTheme === 'seasonality' ? mapSeasonalityField(segments.slice(1), context) : null;
    default:
      return null;
  }
}

function mapStatsPersistenceField(segments: string[]): string | null {
  const subKey = segments[0];
  switch (subKey) {
    case 'enabled':
      return 'persistenceEnabled';
    case 'spec_id':
      return 'persistenceSpecId';
    case 'dataset_id':
      return 'persistenceDatasetId';
    default:
      return null;
  }
}

function mapStatsOutputField(segments: string[]): string | null {
  if (segments[0] === 'out_dir') {
    return 'artifactsOutDir';
  }
  return null;
}

function mapDataField(segments: string[], runTheme: RunTheme): string | null {
  const key = segments[0];
  switch (key) {
    case 'symbol':
    case 'timeframe':
      return key;
    case 'frequency':
      return runTheme === 'dca' ? 'frequency' : null;
    case 'amount':
      return runTheme === 'dca' ? 'amount' : null;
    case 'start_date':
      return runTheme === 'dca' || runTheme === 'backtests' || runTheme === 'stress-tests' ? 'startDate' : null;
    case 'end_date':
      return runTheme === 'dca' || runTheme === 'backtests' || runTheme === 'stress-tests' ? 'endDate' : null;
    case 'strategy_name':
      return runTheme === 'backtests' ? 'strategy' : null;
    case 'lookback':
      return runTheme === 'market-stats' ? 'lookback' : null;
    case 'stats_pack':
      return runTheme === 'market-stats' ? 'statsPack' : null;
    case 'session':
      return runTheme === 'market-stats' ? 'session' : null;
    case 'include_weekends':
      return runTheme === 'market-stats' ? 'includeWeekends' : null;
    case 'window':
      return runTheme === 'seasonality' ? 'window' : null;
    case 'start_year':
      return runTheme === 'seasonality' ? 'startYear' : null;
    case 'end_year':
      return runTheme === 'seasonality' ? 'endYear' : null;
    default:
      return null;
  }
}

function mapStrategyField(segments: string[], runTheme: RunTheme): string | null {
  const key = segments[0];
  if (runTheme === 'dca') {
    if (key === 'type') {
      return 'strategyType';
    }
    if (key === 'grid') {
      return 'gridPresets';
    }
    if (key === 'params') {
      return mapDcaParamsField(segments.slice(1));
    }
    return null;
  }

  if (runTheme !== 'backtests') {
    return null;
  }

  if (key === 'name') {
    return 'strategy';
  }
  if (key === 'params' && segments[1] === 'tp_sl') {
    return mapTpSlField(segments.slice(2));
  }
  if (key === 'tp_sl') {
    return mapTpSlField(segments.slice(1));
  }
  if (key === 'screening') {
    return mapScreeningField(segments.slice(1));
  }
  return null;
}

function mapSignalField(segments: string[]): string | null {
  const key = segments[0];
  switch (key) {
    case 'type':
      return 'signalType';
    case 'fast':
      return 'fast';
    case 'slow':
      return 'slow';
    case 'require_crossing':
      return 'requireCrossing';
    default:
      return null;
  }
}

function mapDcaParamsField(segments: string[]): string | null {
  const key = segments[0];
  switch (key) {
    case 'drawdown_reference':
      return 'drawdownReference';
    case 'execution_mode':
      return 'executionMode';
    case 'tp_sl':
      return mapDcaTpSlField(segments.slice(1));
    case 'require_crossing':
      return 'requireCrossing';
    case 'activation_limit':
      return 'activationLimit';
    case 'reset_on_new_high':
      return 'resetOnNewHigh';
    case 'rearm_on_rebound_pct':
      return 'rearmOnReboundPct';
    case 'force_close_end':
      return 'forceCloseEnd';
    default:
      return null;
  }
}

function mapDcaTpSlField(segments: string[]): string | null {
  const key = segments[0];
  switch (key) {
    case 'enabled':
      return 'tpSlEnabled';
    case 'mode':
      return 'tpSlMode';
    case 'tp':
      return segments[1] === 'value' ? 'tpValue' : null;
    case 'sl':
      return segments[1] === 'value' ? 'slValue' : null;
    case 'break_even':
      if (segments[1] === 'enabled') {
        return 'breakEvenEnabled';
      }
      if (segments[1] === 'trigger_pct') {
        return 'breakEvenTriggerPct';
      }
      return null;
    default:
      return null;
  }
}

function mapTpSlField(segments: string[]): string | null {
  const key = segments[0];
  switch (key) {
    case 'atr_window':
      return 'atrWindow';
    case 'atr_k':
      return 'atrK';
    case 'r_mult':
      return 'rMult';
    case 'slippage_bps':
      return 'slippageBps';
    case 'fee_bps':
      return 'feeBps';
    case 'stop_loss_pct':
      return 'stopLoss';
    case 'take_profit_pct':
      return 'takeProfit';
    case 'trailing_stop':
      return 'trailingStop';
    case 'dynamic_sl':
      return mapDynamicSlField(segments.slice(1));
    case 'jitter':
      return mapJitterField(segments.slice(1));
    default:
      return null;
  }
}

function mapDynamicSlField(segments: string[]): string | null {
  const key = segments[0];
  switch (key) {
    case 'enabled':
      return 'dynamicSlEnabled';
    case 'mode':
      return 'dynamicSlMode';
    case 'atr_mult':
      return 'dynamicSlAtrMult';
    default:
      return null;
  }
}

function mapJitterField(segments: string[]): string | null {
  const key = segments[0];
  switch (key) {
    case 'enabled':
      return 'tpslJitterEnabled';
    case 'dist':
      return 'tpslJitterDist';
    case 'tp_bps':
      return 'tpslJitterTpBps';
    case 'sl_bps':
      return 'tpslJitterSlBps';
    case 'seed':
      return 'tpslJitterSeed';
    default:
      return null;
  }
}

function mapScreeningField(segments: string[]): string | null {
  const key = segments[0];
  if (key === 'enabled') {
    return 'screeningEnabled';
  }
  if (key === 'window' && segments.length >= 2) {
    return segments[1] === 'start_date' ? 'screenWindowStart' : segments[1] === 'end_date' ? 'screenWindowEnd' : null;
  }
  switch (key) {
    case 'max_bars':
      return 'screenMaxBars';
    case 'max_trades':
      return 'screenMaxTrades';
    case 'max_seconds':
      return 'screenMaxSeconds';
    default:
      return null;
  }
}

function mapFiltersField(segments: string[], runTheme: RunTheme): string | null {
  const prefix = runTheme === 'dca' ? 'dca_' : '';
  const key = segments[0];

  if (key === 'filters') {
    if (segments.length === 1) {
      return 'filters';
    }
    const paramsIndex = segments.indexOf('params');
    if (paramsIndex > 0) {
      const filterId = segments[paramsIndex - 1];
      const paramKey = segments[paramsIndex + 1];
      if (filterId && paramKey && !isNumeric(filterId)) {
        return `${prefix}filter_${filterId}_${paramKey}`;
      }
    }
    return 'filters';
  }

  if (key === 'rules') {
    return 'filterRules';
  }

  if (key === 'rules_config') {
    const subKey = segments[1];
    if (subKey === 'min_score') {
      return 'filterRuleMinScore';
    }
    if (subKey === 'min_score_pct') {
      return 'filterRuleMinScorePct';
    }
  }

  return null;
}

function mapPerformanceField(segments: string[], runTheme: RunTheme): string | null {
  const key = segments[0];
  switch (key) {
    case 'initial_capital':
      return runTheme === 'backtests' || runTheme === 'stress-tests' ? 'capital' : 'initialCapital';
    case 'capital_per_unit':
      return 'capitalPerUnit';
    case 'max_capital_per_trade':
      return 'maxCapitalPerTrade';
    case 'risk_pct':
      return 'riskPct';
    case 'risk_free_rate_pct':
      return 'riskFreeRate';
    case 'stress_tests':
      return mapStressTestsField(segments.slice(1), runTheme);
    default:
      return null;
  }
}

function mapStressTestsField(segments: string[], runTheme: RunTheme): string | null {
  if (!segments.length) {
    return null;
  }
  if (runTheme !== 'stress-tests') {
    const key = segments[0];
    if (key === 'n_sims') {
      return 'mcPaths';
    }
    if (key === 'seed') {
      return 'mcSeed';
    }
    return null;
  }

  const key = segments[0];
  switch (key) {
    case 'source':
      return 'source';
    case 'n_sims':
      return 'nSims';
    case 'seed':
      return 'seed';
    case 'method':
      return 'method';
    case 'block_size':
      return 'blockSize';
    case 'overlapping':
      return 'overlapping';
    case 'time_distribution':
      return mapNestedField(segments.slice(1), { mode: 'timeDistMode', seed: 'timeDistSeed' });
    case 'param_drift':
      return mapNestedField(segments.slice(1), {
        mode: 'paramDriftMode',
        dist: 'paramDriftDist',
        mu: 'paramDriftMu',
        sigma: 'paramDriftSigma',
        low: 'paramDriftLow',
        high: 'paramDriftHigh',
        min: 'paramDriftMin',
        max: 'paramDriftMax',
        seed: 'paramDriftSeed'
      });
    case 'sizing':
      return mapNestedField(segments.slice(1), {
        dist: 'sizingDist',
        mu: 'sizingMu',
        sigma: 'sizingSigma',
        low: 'sizingLow',
        high: 'sizingHigh',
        min: 'sizingMin',
        max: 'sizingMax'
      });
    case 'output':
      return mapNestedField(segments.slice(1), {
        mode: 'outputMode',
        max_curves: 'outputMaxCurves',
        curve_stride: 'outputCurveStride'
      });
    case 'scenarios':
      return mapScenarioField(segments.slice(1));
    case 'multi_asset':
      return mapNestedField(segments.slice(1), {
        aggregation: 'aggregation',
        weights: 'weights',
        timestamp_alignment: 'timestampAlignment'
      });
    default:
      return null;
  }
}

function mapScenarioField(segments: string[]): string | null {
  const index = segments[0];
  if (!isNumeric(index)) {
    return null;
  }
  const slot = Number(index) + 1;
  const key = segments[1];
  if (!key) {
    return null;
  }
  switch (key) {
    case 'type':
      return `scenario${slot}Type`;
    case 'shock_pct':
      return `scenario${slot}ShockPct`;
    case 'vol_multiplier':
      return `scenario${slot}VolMultiplier`;
    case 'drawdown_pct':
      return `scenario${slot}DrawdownPct`;
    case 'window':
      return `scenario${slot}Window`;
    case 'index':
      return `scenario${slot}Index`;
    default:
      return null;
  }
}

function mapStatsField(segments: string[], context: BackendMappingContext): string | null {
  const key = segments[0];
  if (key === 'event') {
    if (segments[1] === 'id') {
      return 'eventId';
    }
    if (segments[1] === 'params' && segments[2]) {
      const eventId = context.marketEventId ?? '';
      return eventId ? `event_${eventId}_${segments[2]}` : null;
    }
  }
  if (key === 'condition') {
    if (segments[1] === 'id') {
      return 'conditionId';
    }
    if (segments[1] === 'params' && segments[2]) {
      const conditionId = context.marketConditionId ?? '';
      return conditionId ? `condition_${conditionId}_${segments[2]}` : null;
    }
  }
  if (key === 'target') {
    if (segments[1] === 'id') {
      return 'targetId';
    }
    if (segments[1] === 'params' && segments[2]) {
      const targetId = context.marketTargetId ?? '';
      return targetId ? `target_${targetId}_${segments[2]}` : null;
    }
  }
  if (key === 'validation') {
    const subKey = segments[1];
    switch (subKey) {
      case 'train_months':
        return 'validationTrainMonths';
      case 'test_months':
        return 'validationTestMonths';
      case 'folds':
        return 'validationFolds';
      case 'embargo_days':
        return 'validationEmbargoDays';
      default:
        return null;
    }
  }
  if (key === 'persistence') {
    const subKey = segments[1];
    switch (subKey) {
      case 'enabled':
        return 'persistenceEnabled';
      case 'spec_id':
        return 'persistenceSpecId';
      case 'dataset_id':
        return 'persistenceDatasetId';
      default:
        return null;
    }
  }
  if (key === 'artifacts' && segments[1] === 'out_dir') {
    return 'artifactsOutDir';
  }
  return null;
}

function mapSeasonalityField(segments: string[], context: BackendMappingContext): string | null {
  const key = segments[0];
  if (key === 'profile') {
    const subKey = segments[1];
    switch (subKey) {
      case 'id':
        return 'profileId';
      case 'measure':
        return 'profileMeasure';
      case 'ret_horizon':
        return 'profileRetHorizon';
      case 'min_samples_bin':
        return 'profileMinSamples';
      case 'params':
        if (segments[2]) {
          const profileId = context.seasonalityProfileId ?? '';
          return profileId ? `profile_${profileId}_${segments[2]}` : null;
        }
        return null;
      default:
        return null;
    }
  }
  if (key === 'signal') {
    const subKey = segments[1];
    switch (subKey) {
      case 'method':
        return 'signalMethod';
      case 'threshold':
        return 'signalThreshold';
      case 'topk':
        return 'signalTopk';
      case 'dims':
        return 'signalDims';
      case 'combine':
        return 'signalCombine';
      default:
        return null;
    }
  }
  if (key === 'compute') {
    const subKey = segments[1];
    switch (subKey) {
      case 'max_trials':
        return 'optunaMaxTrials';
      case 'search_space':
        return 'optunaSearchSpace';
      default:
        return null;
    }
  }
  if (key === 'execution') {
    const subKey = segments[1];
    switch (subKey) {
      case 'risk_model':
        return 'executionRiskModel';
      case 'tp_sl':
        return 'executionTpSl';
      default:
        return null;
    }
  }
  if (key === 'validation') {
    const subKey = segments[1];
    switch (subKey) {
      case 'train_months':
        return 'validationTrainMonths';
      case 'test_months':
        return 'validationTestMonths';
      case 'folds':
        return 'validationFolds';
      case 'embargo_days':
        return 'validationEmbargoDays';
      default:
        return null;
    }
  }
  if (key === 'persistence') {
    const subKey = segments[1];
    switch (subKey) {
      case 'enabled':
        return 'persistenceEnabled';
      case 'spec_id':
        return 'persistenceSpecId';
      case 'dataset_id':
        return 'persistenceDatasetId';
      default:
        return null;
    }
  }
  if (key === 'artifacts' && segments[1] === 'out_dir') {
    return 'artifactsOutDir';
  }
  return null;
}

function mapNestedField(segments: string[], mapping: Record<string, string>): string | null {
  const key = segments[0];
  return key ? mapping[key] ?? null : null;
}

function normalizeFieldSegments(field: string): string[] {
  const cleaned = field.replace(/\[(\d+)\]/g, '.$1');
  return cleaned
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(segment => toSnakeCaseKey(segment));
}

function extractRuntimeErrorCandidate(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const obj = payload as Record<string, unknown>;

  const direct = obj['error'];
  if (direct && typeof direct === 'object') {
    return direct as Record<string, unknown>;
  }

  const result = obj['result'];
  if (result && typeof result === 'object') {
    const nested = (result as Record<string, unknown>)['error'];
    if (nested && typeof nested === 'object') {
      return nested as Record<string, unknown>;
    }
  }

  if (
    obj['code'] !== undefined ||
    obj['message'] !== undefined ||
    Array.isArray(obj['details'])
  ) {
    return obj;
  }

  return null;
}

function toSnakeCaseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();
}

function isNumeric(value: string): boolean {
  return /^[0-9]+$/.test(value);
}
