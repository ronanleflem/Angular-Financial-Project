import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import {
  MonteCarloViewModel,
  MonteCarloSummary,
  PercentileBand,
  PercentileMetric,
  RawStressTestRecord,
  RawStressTestsResponse,
  ScenarioSummaryItem,
  ScenarioViewModel,
  ScenariosViewModel,
  StressTestRunSummary,
  StressTestsMeta,
  StressTestsSummaryResponse,
  StressTestsViewModel,
} from '../models/stress-tests.models';

@Injectable({ providedIn: 'root' })
export class StressTestsService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getStressTests(runId: string): Observable<StressTestsViewModel> {
    return this.http
      .get<StressTestsSummaryResponse>(`${this.apiUrl}/api/stress-tests/summary`, {
        params: { runId },
      })
      .pipe(
        tap(summary => this.logSummaryDiagnostics(summary, runId)),
        map(summary => (isSummaryValid(summary) ? mapSummaryToView(summary, runId) : null)),
        switchMap(summaryView => (summaryView ? of(summaryView) : this.fetchRaw(runId))),
        catchError(() => this.fetchRaw(runId))
      );
  }

  getRuns(): Observable<StressTestRunSummary[]> {
    return this.http.get<StressTestRunSummary[]>(`${this.apiUrl}/api/stress-tests/runs`);
  }

  private fetchRaw(runId: string): Observable<StressTestsViewModel> {
    return this.http
      .get<RawStressTestsResponse>(`${this.apiUrl}/api/stress-tests`, {
        params: { runId },
      })
      .pipe(map(raw => mapRawToView(raw, runId)));
  }

  private logSummaryDiagnostics(summary: StressTestsSummaryResponse | null | undefined, runId: string): void {
    if (!summary) {
      console.info('[StressTests] summary empty', { runId });
      return;
    }
    const legacy = summary as StressTestsSummaryResponse & { monte_carlo?: MonteCarloSummary };
    const monteCarlo = summary.monteCarlo ?? legacy.monte_carlo;
    const scenarios = summary.scenarios;
    const curves = monteCarlo?.curves;
    const equitySample = curves && !Array.isArray(curves) ? curves.equitySample : undefined;
    const equityCurves = curves && !Array.isArray(curves) ? curves.equityCurves : undefined;
    const percentileBand = curves && !Array.isArray(curves) ? curves.percentileBand : undefined;

    const sampleCurvesStats = summarizeCurveSet(equitySample, 12);
    const equityCurvesStats = summarizeCurveSet(equityCurves, 12);
    const bandPoints =
      percentileBand?.p50?.length ?? percentileBand?.p10?.length ?? percentileBand?.p90?.length ?? 0;

    const metricsByDistributionCount = monteCarlo?.metricsByDistribution
      ? Object.keys(monteCarlo.metricsByDistribution).length
      : 0;
    const scenarioItemsCount = scenarios?.items?.length ?? 0;
    const scenarioCurvesStats = summarizeScenarioCurves(scenarios?.items ?? [], 12);

    const sizeEstimate = estimateSize(summary, 20000);
    const approxMb = Math.round((sizeEstimate.bytes / (1024 * 1024)) * 100) / 100;

    console.info('[StressTests] summary diagnostics', {
      runId,
      sizeEstimate: {
        bytes: sizeEstimate.bytes,
        approxMb,
        nodes: sizeEstimate.nodes,
        truncated: sizeEstimate.truncated,
      },
      monteCarlo: {
        metricsByDistributionCount,
        equitySample: sampleCurvesStats,
        equityCurves: equityCurvesStats,
        bandPoints,
        warnings: monteCarlo?.warnings?.length ?? 0,
      },
      scenarios: {
        items: scenarioItemsCount,
        curveStats: scenarioCurvesStats,
        warnings: scenarios?.warnings?.length ?? 0,
      },
      hasLegacyMonteCarlo: Boolean(legacy.monte_carlo),
    });

    if (sizeEstimate.bytes > 2_000_000 || sizeEstimate.truncated) {
      console.warn('[StressTests] summary payload looks large', {
        runId,
        approxMb,
        nodes: sizeEstimate.nodes,
        truncated: sizeEstimate.truncated,
      });
    }

    const maxCurvePoints =
      Math.max(sampleCurvesStats.maxPoints, equityCurvesStats.maxPoints, scenarioCurvesStats.maxPoints) || 0;
    const totalCurveCount = sampleCurvesStats.count + equityCurvesStats.count + scenarioCurvesStats.itemsWithCurve;
    if (maxCurvePoints > 5000 || totalCurveCount > 120) {
      console.warn('[StressTests] curve payload may be heavy', {
        runId,
        maxCurvePoints,
        totalCurveCount,
        equitySample: sampleCurvesStats,
        equityCurves: equityCurvesStats,
        scenarios: scenarioCurvesStats,
      });
    }
  }
}

function isSummaryValid(summary: StressTestsSummaryResponse | null | undefined): summary is StressTestsSummaryResponse {
  if (!summary) {
    return false;
  }
  const legacy = summary as StressTestsSummaryResponse & { monte_carlo?: MonteCarloSummary };
  return Boolean(summary.monteCarlo || summary.scenarios || legacy.monte_carlo);
}

function mapSummaryToView(summary: StressTestsSummaryResponse, runId: string): StressTestsViewModel {
  const legacy = summary as StressTestsSummaryResponse & { monte_carlo?: MonteCarloSummary };
  const meta = normalizeMeta(summary.meta, runId);
  const monteCarloPayload = summary.monteCarlo ?? legacy.monte_carlo;
  const monteCarlo = monteCarloPayload ? mapMonteCarloSummary(monteCarloPayload, meta) : undefined;
  const scenarios = summary.scenarios ? mapScenariosSummary(summary.scenarios) : undefined;

  return {
    meta,
    monteCarlo,
    scenarios,
    source: 'summary',
  };
}

function mapRawToView(raw: RawStressTestsResponse, runId: string): StressTestsViewModel {
  const records = normalizeRawRecords(raw);
  const monteCarloRecord = findRecord(records, ['monte', 'montecarlo', 'monte_carlo']);
  const scenariosRecord = findRecord(records, ['scenario', 'scenarios']);

  const meta: StressTestsMeta = { runId };
  const monteCarlo = monteCarloRecord ? mapRawMonteCarlo(monteCarloRecord, meta) : undefined;
  const scenarios = scenariosRecord ? mapRawScenarios(scenariosRecord) : undefined;

  return {
    meta,
    monteCarlo,
    scenarios,
    source: 'raw',
  };
}

function normalizeMeta(meta: StressTestsMeta | undefined, runId: string): StressTestsMeta {
  return {
    runId,
    ...(meta ?? {}),
  };
}

function mapMonteCarloSummary(summary: MonteCarloSummary, meta: StressTestsMeta): MonteCarloViewModel {
  const metricsByDistribution = summary.metricsByDistribution ?? {};
  const curves = extractEquityCurves(summary);
  let warnings = summary.warnings ?? [];
  const percentileBand = extractPercentileBand(summary);
  const mode = extractMode(meta, summary.parameters);
  let curveSamples = sampleCurves(curves, 50);
  const curveStats = computeCurveStats(curveSamples);
  if (curveSamples.length && isCurvePayloadHeavy(curveStats)) {
    curveSamples = [];
    warnings = [
      ...warnings,
      `Courbes échantillonnées désactivées (payload trop volumineux: ${curveStats.count} courbes, max ${curveStats.maxPoints} points).`,
    ];
  }

  return {
    parameters: summary.parameters ?? {},
    metricsByDistribution,
    curveSamples,
    percentileBand,
    warnings,
    kpis: buildKpis(metricsByDistribution, summary.metrics ?? {}),
    mode: mode ?? (curves.length && !percentileBand ? 'light' : undefined),
  };
}

function mapScenariosSummary(summary: { items?: ScenarioViewModel[]; warnings?: string[] }): ScenariosViewModel {
  const sanitized = sanitizeScenarioItems(summary.items ?? []);
  return {
    items: sanitized.items,
    warnings: [...(summary.warnings ?? []), ...sanitized.warnings],
  };
}

function mapRawMonteCarlo(record: RawStressTestRecord, meta: StressTestsMeta): MonteCarloViewModel {
  const metricsByDistribution = record.distributions ?? {};
  const curves = extractEquityCurves(record);
  let warnings = record.warnings ?? [];
  const percentileBand = extractPercentileBand(record);
  const mode = extractMode(meta, record.parameters);
  let curveSamples = sampleCurves(curves, 50);
  const curveStats = computeCurveStats(curveSamples);
  if (curveSamples.length && isCurvePayloadHeavy(curveStats)) {
    curveSamples = [];
    warnings = [
      ...warnings,
      `Courbes échantillonnées désactivées (payload trop volumineux: ${curveStats.count} courbes, max ${curveStats.maxPoints} points).`,
    ];
  }

  return {
    parameters: record.parameters ?? {},
    metricsByDistribution,
    curveSamples,
    percentileBand,
    warnings,
    kpis: buildKpis(metricsByDistribution, record.metrics ?? {}),
    mode: mode ?? (curves.length && !percentileBand ? 'light' : undefined),
  };
}

function mapRawScenarios(record: RawStressTestRecord): ScenariosViewModel {
  const sanitized = sanitizeScenarioItems(extractScenarioItems(record));
  return {
    items: sanitized.items,
    warnings: [...(record.warnings ?? []), ...sanitized.warnings],
  };
}

function extractMode(meta: StressTestsMeta, parameters?: Record<string, unknown>): string | undefined {
  const candidate =
    meta.mode ||
    (typeof parameters?.['mode'] === 'string' ? (parameters['mode'] as string) : undefined) ||
    (typeof parameters?.['variant'] === 'string' ? (parameters['variant'] as string) : undefined) ||
    (typeof parameters?.['payloadMode'] === 'string' ? (parameters['payloadMode'] as string) : undefined);
  return candidate ? candidate : undefined;
}

function extractPercentileBand(record: RawStressTestRecord): PercentileBand | undefined {
  if (!record.curves || Array.isArray(record.curves)) {
    return undefined;
  }
  const candidate = (record.curves as { percentileBand?: unknown }).percentileBand;
  if (!candidate || Array.isArray(candidate) || typeof candidate !== 'object') {
    return undefined;
  }
  const band = candidate as PercentileBand;
  if (band.p10 || band.p50 || band.p90 || band.p5 || band.p95) {
    return band;
  }
  return undefined;
}

function extractEquityCurves(record: RawStressTestRecord): number[][] {
  if (isNumberArrayArray(record.curves)) {
    return record.curves;
  }
  if (record.curves && !Array.isArray(record.curves)) {
    const curves = record.curves as { equitySample?: unknown; equityCurves?: unknown };
    if (isNumberArrayArray(curves.equitySample)) {
      return curves.equitySample;
    }
    if (isNumberArrayArray(curves.equityCurves)) {
      return curves.equityCurves;
    }
  }
  if (isNumberArrayArray(record.equity_curves)) {
    return record.equity_curves;
  }
  return [];
}

function sampleCurves(curves: number[][], max: number): number[][] {
  if (curves.length <= max) {
    return curves;
  }
  const step = Math.ceil(curves.length / max);
  return curves.filter((_, idx) => idx % step === 0).slice(0, max);
}

function buildKpis(metricsByDistribution: Record<string, PercentileMetric>, metrics: Record<string, unknown>) {
  return {
    ruinProbability: pickNumber(metrics, ['ruinProbability', 'ruin_probability', 'probabilityOfRuin', 'probability_of_ruin']),
    medianReturn: pickMedian(metricsByDistribution, metrics, ['return', 'totalReturn', 'netReturn', 'pnl', 'profit', 'roi']),
    medianMaxDrawdown: pickMedian(metricsByDistribution, metrics, ['maxDrawdown', 'max_drawdown', 'drawdown']),
  };
}

function pickNumber(metrics: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === 'number') {
      return value;
    }
  }
  return undefined;
}

function pickMedian(
  metricsByDistribution: Record<string, PercentileMetric>,
  metrics: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const metric = findMetric(metricsByDistribution, key);
    if (metric) {
      const median = metric.p50 ?? metric.median;
      if (typeof median === 'number') {
        return median;
      }
    }
    const fallback = metrics[key];
    if (typeof fallback === 'number') {
      return fallback;
    }
  }
  return undefined;
}

function findMetric(metricsByDistribution: Record<string, PercentileMetric>, key: string): PercentileMetric | undefined {
  const normalizedKey = normalizeKey(key);
  const direct = metricsByDistribution[key];
  if (direct) {
    return direct;
  }
  return Object.entries(metricsByDistribution).find(([metricKey]) => normalizeKey(metricKey) === normalizedKey)?.[1];
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeRawRecords(raw: RawStressTestsResponse): RawStressTestRecord[] {
  if (Array.isArray(raw)) {
    return raw.map(record => attachMode(record));
  }
  if (raw.records && Array.isArray(raw.records)) {
    return raw.records.map(record => attachMode(record));
  }
  const records: RawStressTestRecord[] = [];
  if (raw.monteCarlo) {
    records.push({ ...raw.monteCarlo, mode: raw.monteCarlo.mode ?? 'monte_carlo' });
  }
  if (raw.monte_carlo) {
    records.push({ ...raw.monte_carlo, mode: raw.monte_carlo.mode ?? 'monte_carlo' });
  }
  if (raw.scenarios) {
    records.push({ ...raw.scenarios, mode: raw.scenarios.mode ?? 'scenarios' });
  }
  return records.map(record => attachMode(record));
}

function findRecord(records: RawStressTestRecord[], modes: string[]): RawStressTestRecord | undefined {
  const normalized = modes.map(mode => normalizeKey(mode));
  return records.find(record => {
    const recordMode = typeof record.mode === 'string' ? normalizeKey(record.mode) : '';
    return normalized.some(mode => recordMode.includes(mode));
  });
}

function extractScenarioItems(record: RawStressTestRecord): ScenarioViewModel[] {
  if (Array.isArray(record.items)) {
    return record.items.map(item => ({
      name: item.name,
      type: item.type,
      settings: item.settings,
      metrics: item.metrics,
      curve: item.curve,
      warnings: item.warnings,
    }));
  }

  const scenarioDefs = extractScenarioDefinitions(record.parameters);
  const metricsByScenario = extractScenarioMetrics(record.metrics);
  const curvesByScenario = extractScenarioCurves(record);

  const names = new Set<string>([
    ...scenarioDefs.map(def => def.name),
    ...Object.keys(metricsByScenario),
    ...Object.keys(curvesByScenario),
  ]);

  const fallbackName = names.size === 0 && record.metrics ? 'global' : undefined;
  if (fallbackName) {
    names.add(fallbackName);
    metricsByScenario[fallbackName] = record.metrics as Record<string, unknown>;
  }

  return Array.from(names).map(name => {
    const def = scenarioDefs.find(item => item.name === name);
    return {
      name,
      type: def?.type,
      settings: def?.settings,
      metrics: metricsByScenario[name],
      curve: curvesByScenario[name],
    } as ScenarioViewModel;
  });
}

function extractScenarioDefinitions(parameters?: Record<string, unknown>): Array<{ name: string; type?: string; settings?: Record<string, unknown> }> {
  const raw = parameters?.['scenarios'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(entry => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const candidate = entry as Record<string, unknown>;
      const name = typeof candidate['name'] === 'string' ? candidate['name'] : undefined;
      if (!name) {
        return null;
      }
      const type = typeof candidate['type'] === 'string' ? candidate['type'] : undefined;
      const settings = typeof candidate['settings'] === 'object' ? (candidate['settings'] as Record<string, unknown>) : undefined;
      return { name, type, settings };
    })
    .filter(Boolean) as Array<{ name: string; type?: string; settings?: Record<string, unknown> }>;
}

function extractScenarioMetrics(metrics: Record<string, unknown> | undefined): Record<string, Record<string, unknown>> {
  if (!metrics || typeof metrics !== 'object') {
    return {};
  }
  const entries = Object.entries(metrics).filter(([, value]) => typeof value === 'object' && value !== null && !Array.isArray(value));
  return entries.reduce((acc, [key, value]) => {
    acc[key] = value as Record<string, unknown>;
    return acc;
  }, {} as Record<string, Record<string, unknown>>);
}

function extractScenarioCurves(record: RawStressTestRecord): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  const curves = record.curves;
  if (curves && !Array.isArray(curves)) {
    Object.entries(curves).forEach(([key, value]) => {
      if (isNumberArray(value)) {
        map[key] = value;
      }
    });
  }
  const rawCurves = record.equity_curves;
  if (rawCurves && !Array.isArray(rawCurves)) {
    Object.entries(rawCurves).forEach(([key, value]) => {
      if (isNumberArray(value)) {
        map[key] = value;
      }
    });
  }
  return map;
}

function attachMode(record: RawStressTestRecord): RawStressTestRecord {
  if (typeof record.mode === 'string' && record.mode.length) {
    return record;
  }
  const inferred = inferRecordMode(record);
  if (!inferred) {
    return record;
  }
  return { ...record, mode: inferred };
}

function inferRecordMode(record: RawStressTestRecord): string | undefined {
  const hasScenarioItems = Array.isArray(record.items) && record.items.length > 0;
  const hasScenarioParams = Array.isArray(record.parameters?.['scenarios']);
  const hasScenarioMetrics = hasScenarioMetricsObject(record.metrics);
  const hasScenarioCurves = hasScenarioCurveMap(record.curves) || hasScenarioCurveMap(record.equity_curves);

  const hasMonteCarloCurves = hasMonteCarloCurveSet(record.curves) || hasMonteCarloCurveSet(record.equity_curves);
  const hasDistributions = Boolean(record.distributions && Object.keys(record.distributions).length);

  if (hasScenarioItems || hasScenarioParams) {
    return 'scenarios';
  }
  if (hasDistributions || hasMonteCarloCurves) {
    return 'monte_carlo';
  }
  if (hasScenarioMetrics || hasScenarioCurves) {
    return 'scenarios';
  }
  return undefined;
}

function hasScenarioMetricsObject(metrics: Record<string, unknown> | undefined): boolean {
  if (!metrics || typeof metrics !== 'object') {
    return false;
  }
  return Object.values(metrics).some(value => typeof value === 'object' && value !== null && !Array.isArray(value));
}

function hasScenarioCurveMap(curves: unknown): boolean {
  if (!curves || Array.isArray(curves) || typeof curves !== 'object') {
    return false;
  }
  const record = curves as Record<string, unknown>;
  if ('equitySample' in record || 'equityCurves' in record || 'percentileBand' in record) {
    return false;
  }
  return Object.values(record).some(isNumberArray);
}

function hasMonteCarloCurveSet(curves: unknown): boolean {
  if (!curves) {
    return false;
  }
  if (isNumberArrayArray(curves)) {
    return true;
  }
  if (curves && !Array.isArray(curves) && typeof curves === 'object') {
    const record = curves as { equitySample?: unknown; equityCurves?: unknown; percentileBand?: unknown };
    return (
      isNumberArrayArray(record.equitySample) ||
      isNumberArrayArray(record.equityCurves) ||
      isPercentileBand(record.percentileBand)
    );
  }
  return false;
}

function isPercentileBand(value: unknown): value is PercentileBand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const band = value as PercentileBand;
  return Boolean(band.p5 || band.p10 || band.p50 || band.p90 || band.p95);
}

function estimateSize(value: unknown, maxNodes: number): { bytes: number; nodes: number; truncated: boolean } {
  const stack: unknown[] = [value];
  let bytes = 0;
  let nodes = 0;
  let truncated = false;

  while (stack.length) {
    const current = stack.pop();
    nodes += 1;
    if (nodes > maxNodes) {
      truncated = true;
      break;
    }
    if (current === null || current === undefined) {
      continue;
    }
    if (typeof current === 'string') {
      bytes += current.length * 2;
      continue;
    }
    if (typeof current === 'number') {
      bytes += 8;
      continue;
    }
    if (typeof current === 'boolean') {
      bytes += 4;
      continue;
    }
    if (Array.isArray(current)) {
      bytes += 8;
      for (let i = 0; i < current.length; i += 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current === 'object') {
      const record = current as Record<string, unknown>;
      for (const key in record) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) {
          continue;
        }
        bytes += key.length * 2;
        stack.push(record[key]);
      }
    }
  }

  return { bytes, nodes, truncated };
}

function summarizeCurveSet(
  curves: number[][] | undefined,
  maxCurves: number
): { count: number; maxPoints: number; avgPointsSample: number; sampled: boolean } {
  if (!Array.isArray(curves)) {
    return { count: 0, maxPoints: 0, avgPointsSample: 0, sampled: false };
  }
  const count = curves.length;
  if (!count) {
    return { count: 0, maxPoints: 0, avgPointsSample: 0, sampled: false };
  }
  const sampleCount = Math.min(count, maxCurves);
  let maxPoints = 0;
  let totalPoints = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const points = Array.isArray(curves[i]) ? curves[i].length : 0;
    totalPoints += points;
    if (points > maxPoints) {
      maxPoints = points;
    }
  }
  const avgPointsSample = sampleCount ? Math.round((totalPoints / sampleCount) * 100) / 100 : 0;
  return { count, maxPoints, avgPointsSample, sampled: count > sampleCount };
}

function summarizeScenarioCurves(
  items: ScenarioSummaryItem[],
  maxItems: number
): { itemsWithCurve: number; maxPoints: number; avgPointsSample: number; sampled: boolean } {
  const totalItems = items.length;
  if (!totalItems) {
    return { itemsWithCurve: 0, maxPoints: 0, avgPointsSample: 0, sampled: false };
  }
  const sampleCount = Math.min(totalItems, maxItems);
  let itemsWithCurve = 0;
  let maxPoints = 0;
  let totalPoints = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const curve = items[i]?.curve;
    if (!Array.isArray(curve)) {
      continue;
    }
    itemsWithCurve += 1;
    const points = curve.length;
    totalPoints += points;
    if (points > maxPoints) {
      maxPoints = points;
    }
  }
  const avgPointsSample = itemsWithCurve ? Math.round((totalPoints / itemsWithCurve) * 100) / 100 : 0;
  return { itemsWithCurve, maxPoints, avgPointsSample, sampled: totalItems > sampleCount };
}

function computeCurveStats(curves: number[][]): { count: number; maxPoints: number; totalPoints: number } {
  if (!Array.isArray(curves) || !curves.length) {
    return { count: 0, maxPoints: 0, totalPoints: 0 };
  }
  let maxPoints = 0;
  let totalPoints = 0;
  for (const curve of curves) {
    const points = Array.isArray(curve) ? curve.length : 0;
    totalPoints += points;
    if (points > maxPoints) {
      maxPoints = points;
    }
  }
  return { count: curves.length, maxPoints, totalPoints };
}

function computeScenarioCurveStats(items: ScenarioViewModel[]): { curves: number; maxPoints: number; totalPoints: number } {
  let curves = 0;
  let maxPoints = 0;
  let totalPoints = 0;
  for (const item of items) {
    const curve = item.curve;
    if (!Array.isArray(curve)) {
      continue;
    }
    curves += 1;
    const points = curve.length;
    totalPoints += points;
    if (points > maxPoints) {
      maxPoints = points;
    }
  }
  return { curves, maxPoints, totalPoints };
}

function isCurvePayloadHeavy(stats: { count: number; maxPoints: number; totalPoints: number }): boolean {
  return stats.maxPoints > 1500 || stats.totalPoints > 100000;
}

function isScenarioCurvePayloadHeavy(stats: { curves: number; maxPoints: number; totalPoints: number }): boolean {
  return stats.maxPoints > 1250 || stats.totalPoints > 60000 || stats.curves > 20;
}

function sanitizeScenarioItems(items: ScenarioViewModel[]): { items: ScenarioViewModel[]; warnings: string[] } {
  const stats = computeScenarioCurveStats(items);
  if (!isScenarioCurvePayloadHeavy(stats)) {
    return { items, warnings: [] };
  }
  const sanitized = items.map(item => ({ ...item, curve: undefined }));
  return {
    items: sanitized,
    warnings: [
      `Courbes des scénarios désactivées (payload trop volumineux: ${stats.curves} courbes, max ${stats.maxPoints} points).`,
    ],
  };
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(item => typeof item === 'number');
}

function isNumberArrayArray(value: unknown): value is number[][] {
  return Array.isArray(value) && value.every(isNumberArray);
}
