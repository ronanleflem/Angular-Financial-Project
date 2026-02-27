import { RunRequestInput, RunType } from '../models/run-request-input.model';

export interface CanonicalRunRequest {
  spec_type: RunType;
  catalog_version: string;
  request_id?: string;
  [key: string]: unknown;
}

export interface CanonicalRunRequestOptions {
  catalogVersion?: string;
  requestId?: string;
}

const DEFAULT_CATALOG_VERSION = '2026-02-02';

export function buildCanonicalRunPayload(
  uiModel: RunRequestInput,
  specType: RunType = uiModel.runType,
  options: CanonicalRunRequestOptions = {}
): CanonicalRunRequest {
  if (uiModel.runType === 'optimize_dca' || uiModel.runType === 'optimize_backtest') {
    return buildCanonicalOptimizationPayload(uiModel, specType, options);
  }

  const model = uiModel as any;
  const runType = String(model?.runType ?? '');
  const symbolValue = String(model?.data?.symbol ?? '').trim();
  const symbolsValue = Array.isArray(model?.data?.symbols)
    ? (model.data.symbols as unknown[])
      .map(item => String(item ?? '').trim())
      .filter(Boolean)
    : [];
  const hasUniverseEntries = (
    (Array.isArray((uiModel as any)?.universe) && ((uiModel as any)?.universe as unknown[]).length > 0) ||
    (Array.isArray((uiModel as any)?.data?.universe) && ((uiModel as any)?.data?.universe as unknown[]).length > 0)
  );
  if (
    runType !== 'stress_tests' &&
    runType !== 'optimize_dca' &&
    runType !== 'optimize_backtest' &&
    !symbolValue &&
    symbolsValue.length === 0 &&
    !hasUniverseEntries
  ) {
    throw new Error('canonical_builder_error:data.symbol is required');
  }
  if (uiModel.runType !== specType) {
    throw new Error('canonical_builder_error:spec_type mismatch');
  }

  const catalogVersion = options.catalogVersion?.trim() || DEFAULT_CATALOG_VERSION;
  const requestId = options.requestId?.trim();
  const normalizedInput = normalizeCanonicalInput(uiModel);
  const payload = toSnakeCaseValue(normalizedInput) as Record<string, unknown>;

  const canonical: CanonicalRunRequest = {
    spec_type: specType,
    catalog_version: catalogVersion
  };

  if (requestId) {
    canonical.request_id = requestId;
  }

  return { ...canonical, ...payload };
}

export function mapRunRequestToCanonical(
  input: RunRequestInput,
  options: CanonicalRunRequestOptions = {}
): CanonicalRunRequest {
  return buildCanonicalRunPayload(input, input.runType, options);
}

function normalizeCanonicalInput(input: RunRequestInput): Record<string, unknown> {
  const { runType, ...rest } = input as RunRequestInput & Record<string, unknown>;
  if (runType === 'backtest') {
    const strategy = ((rest['strategy'] ?? {}) as Record<string, unknown>);
    if (!strategy || typeof strategy !== 'object') {
      return rest;
    }
    const { name, ...strategyWithoutName } = strategy as Record<string, unknown>;
    void name;
    return {
      ...rest,
      strategy: Object.keys(strategyWithoutName).length > 0 ? strategyWithoutName : undefined
    };
  }

  if (runType !== 'dca') {
    return rest;
  }

  const strategy = ((rest['strategy'] ?? {}) as Record<string, unknown>);
  const data = (rest['data'] ?? {}) as unknown as Record<string, unknown>;
  const params = ((strategy['params'] ?? {}) as Record<string, unknown>);
  const normalizedParams: Record<string, unknown> = { ...params };
  const existingTopLevelUniverse = Array.isArray((rest as any)['universe'])
    ? ((rest as any)['universe'] as unknown[])
    : [];
  const dataUniverse = Array.isArray(data['universe']) ? (data['universe'] as unknown[]) : [];
  const universeEntries = existingTopLevelUniverse.length > 0 ? existingTopLevelUniverse : dataUniverse;
  const { universe, ...dataWithoutUniverse } = data as Record<string, unknown>;
  void universe;
  const dataWithCompatSymbol = { ...dataWithoutUniverse };
  if ((!dataWithCompatSymbol['symbol'] || !String(dataWithCompatSymbol['symbol']).trim()) && universeEntries.length > 0) {
    const first = universeEntries[0] as Record<string, unknown> | undefined;
    const firstSymbol = String(first?.['symbol'] ?? '').trim();
    if (firstSymbol) {
      dataWithCompatSymbol['symbol'] = firstSymbol;
    }
  }
  if (universeEntries.length > 0) {
    delete dataWithCompatSymbol['symbol'];
  }

  // Backward compatibility: strategy.grid preset string list -> strategy.params.grid.
  if ((!Array.isArray(normalizedParams['grid']) || normalizedParams['grid'].length === 0) && Array.isArray(strategy['grid'])) {
    normalizedParams['grid'] = convertGridPresetsToCanonical(strategy['grid'] as unknown[]);
  }

  // Backward compatibility: tp_sl preset string -> explicit object.
  if (typeof normalizedParams['tpSl'] === 'string') {
    normalizedParams['tpSl'] = convertLegacyDcaTpSlPreset(normalizedParams['tpSl'] as string);
  }
  if (typeof normalizedParams['tp_sl'] === 'string') {
    normalizedParams['tp_sl'] = convertLegacyDcaTpSlPreset(normalizedParams['tp_sl'] as string);
  }

  return {
    ...rest,
    data: dataWithCompatSymbol,
    universe: universeEntries.length > 0 ? universeEntries : undefined,
    strategy: {
      ...strategy,
      params: normalizedParams
    }
  };
}

function buildCanonicalOptimizationPayload(
  uiModel: Extract<RunRequestInput, { runType: 'optimize_dca' | 'optimize_backtest' }>,
  specType: RunType,
  options: CanonicalRunRequestOptions
): CanonicalRunRequest {
  if (uiModel.runType !== specType) {
    throw new Error('canonical_builder_error:spec_type mismatch');
  }
  const expectedBaseSpecType = uiModel.runType === 'optimize_dca' ? 'dca' : 'backtest';
  if (uiModel.optimization.baseSpec.runType !== expectedBaseSpecType) {
    throw new Error('canonical_builder_error:optimization.base_spec.spec_type mismatch');
  }
  const catalogVersion = options.catalogVersion?.trim() || DEFAULT_CATALOG_VERSION;
  const requestId = options.requestId?.trim();
  const canonicalBaseSpec = buildCanonicalBaseSpec(uiModel.optimization.baseSpec);
  const direction = normalizeOptimizationDirection(uiModel.optimization.objective.direction);
  const normalizedSearchSpace = normalizeOptimizationSearchSpace(uiModel.optimization.searchSpace);
  const canonicalOptimization = {
    base_spec: canonicalBaseSpec,
    search_space: toSnakeCaseValue(normalizedSearchSpace),
    objective: {
      metric: String(uiModel.optimization.objective.metric ?? '').trim(),
      direction
    },
    budget: {
      max_trials: Number(uiModel.optimization.budget.maxTrials),
      timeout_seconds:
        uiModel.optimization.budget.timeoutSeconds !== undefined
          ? Number(uiModel.optimization.budget.timeoutSeconds)
          : undefined,
      seed:
        uiModel.optimization.budget.seed !== undefined
          ? Number(uiModel.optimization.budget.seed)
          : undefined
    }
  };

  const canonical: CanonicalRunRequest = {
    spec_type: specType,
    catalog_version: catalogVersion,
    optimization: canonicalOptimization
  };
  if (requestId) {
    canonical.request_id = requestId;
  }
  return canonical;
}

function buildCanonicalBaseSpec(
  input: Extract<RunRequestInput, { runType: 'dca' | 'backtest' }>
): Record<string, unknown> {
  const normalizedInput = normalizeCanonicalInput(input);
  const payload = toSnakeCaseValue(normalizedInput) as Record<string, unknown>;
  return {
    spec_type: input.runType,
    ...payload
  };
}

function convertGridPresetsToCanonical(gridPresets: unknown[]): Array<{ dd: number; weight: number }> {
  const levels = gridPresets
    .flatMap(preset => gridPresetToLevels(String(preset)))
    .filter(level => Number.isFinite(level.dd) && Number.isFinite(level.weight));
  if (!levels.length) {
    return [{ dd: -5, weight: 1 }];
  }
  const seen = new Set<number>();
  return levels.filter(level => {
    if (seen.has(level.dd)) {
      return false;
    }
    seen.add(level.dd);
    return true;
  });
}

function gridPresetToLevels(preset: string): Array<{ dd: number; weight: number }> {
  switch (preset) {
    case 'grid_conservative':
      return [
        { dd: -3, weight: 0.8 },
        { dd: -6, weight: 1 },
        { dd: -10, weight: 1.2 }
      ];
    case 'grid_aggressive':
      return [
        { dd: -4, weight: 1.2 },
        { dd: -8, weight: 1 },
        { dd: -12, weight: 0.8 }
      ];
    case 'grid_balanced':
    default:
      return [
        { dd: -5, weight: 1 },
        { dd: -10, weight: 1 },
        { dd: -15, weight: 1 }
      ];
  }
}

function convertLegacyDcaTpSlPreset(preset: string): Record<string, unknown> {
  switch (preset) {
    case 'none':
      return {
        enabled: false,
        mode: 'rule_based',
        tp: { type: 'percent', value: 0 },
        sl: { type: 'percent', value: 0 },
        breakEven: { enabled: false, triggerPct: 0 }
      };
    case 'tp_3_sl_1.5':
      return {
        enabled: true,
        mode: 'rule_based',
        tp: { type: 'percent', value: 3 },
        sl: { type: 'percent', value: 1.5 },
        breakEven: { enabled: true, triggerPct: 1.5 }
      };
    case 'tp_2_sl_1':
    default:
      return {
        enabled: true,
        mode: 'rule_based',
        tp: { type: 'percent', value: 2 },
        sl: { type: 'percent', value: 1 },
        breakEven: { enabled: true, triggerPct: 1 }
      };
  }
}

function toSnakeCaseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => toSnakeCaseValue(entry));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isPlainObject(value)) {
    return toSnakeCaseObject(value);
  }
  return value;
}

function toSnakeCaseObject(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const snakeKey = toSnakeCaseKey(key);
    result[snakeKey] = toSnakeCaseValue(entry);
  });
  return result;
}

function toSnakeCaseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptimizationDirection(value: unknown): 'max' | 'min' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'max' || normalized === 'maximize') {
    return 'max';
  }
  if (normalized === 'min' || normalized === 'minimize') {
    return 'min';
  }
  throw new Error('canonical_builder_error:optimization.objective.direction must be max|min');
}

function normalizeOptimizationSearchSpace(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error('canonical_builder_error:optimization.search_space must be an object');
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new Error('canonical_builder_error:optimization.search_space must not be empty');
  }
  const normalized: Record<string, unknown> = {};
  entries.forEach(([key, entry]) => {
    normalized[key] = normalizeOptimizationSearchSpaceNode(entry, `optimization.search_space.${key}`);
  });
  return normalized;
}

function normalizeOptimizationSearchSpaceNode(value: unknown, path: string): unknown {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new Error(`canonical_builder_error:${path} array must not be empty`);
    }
    return value.map((entry, index) => (
      isPlainObject(entry)
        ? normalizeOptimizationSearchSpaceNode(entry, `${path}[${index}]`)
        : entry
    ));
  }
  if (!isPlainObject(value)) {
    throw new Error(`canonical_builder_error:${path} has unsupported shape`);
  }

  const keys = Object.keys(value);
  if (keys.length === 0) {
    throw new Error(`canonical_builder_error:${path} object must not be empty`);
  }

  const hasValues = Object.prototype.hasOwnProperty.call(value, 'values');
  const hasDomain = Object.prototype.hasOwnProperty.call(value, 'domain');
  const hasMin = Object.prototype.hasOwnProperty.call(value, 'min');
  const hasMax = Object.prototype.hasOwnProperty.call(value, 'max');
  const hasLow = Object.prototype.hasOwnProperty.call(value, 'low');
  const hasHigh = Object.prototype.hasOwnProperty.call(value, 'high');
  const looksLikeParamSpec = hasValues || hasDomain || hasMin || hasMax || hasLow || hasHigh;

  if (looksLikeParamSpec) {
    const passthrough: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (key === 'values' || key === 'domain' || key === 'min' || key === 'max' || key === 'low' || key === 'high') {
        return;
      }
      passthrough[key] = entry;
    });

    if (hasValues || hasDomain) {
      const rawValues = hasValues ? value['values'] : value['domain'];
      if (!Array.isArray(rawValues) || rawValues.length === 0) {
        throw new Error(`canonical_builder_error:${path} values/domain must be a non-empty array`);
      }
      return {
        ...passthrough,
        values: rawValues.map((entry, index) => (
          isPlainObject(entry)
            ? normalizeOptimizationSearchSpaceNode(entry, `${path}.values[${index}]`)
            : entry
        ))
      };
    }

    const minCandidate = hasLow ? value['low'] : value['min'];
    const maxCandidate = hasHigh ? value['high'] : value['max'];
    const min = Number(minCandidate);
    const max = Number(maxCandidate);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error(`canonical_builder_error:${path} min/max must be finite numbers`);
    }
    if (min > max) {
      throw new Error(`canonical_builder_error:${path} min must be <= max`);
    }

    const normalized: Record<string, unknown> = {
      ...passthrough,
      min,
      max
    };
    if (Object.prototype.hasOwnProperty.call(value, 'step')) {
      const step = Number(value['step']);
      if (!Number.isFinite(step) || step <= 0) {
        throw new Error(`canonical_builder_error:${path} step must be > 0`);
      }
      normalized['step'] = step;
    }
    return normalized;
  }

  const normalizedChildren: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, entry]) => {
    normalizedChildren[key] = normalizeOptimizationSearchSpaceNode(entry, `${path}.${key}`);
  });
  return normalizedChildren;
}
