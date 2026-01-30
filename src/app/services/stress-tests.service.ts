import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import {
  MonteCarloViewModel,
  MonteCarloSummary,
  PercentileBand,
  PercentileMetric,
  RawStressTestRecord,
  RawStressTestsResponse,
  ScenarioViewModel,
  ScenariosViewModel,
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
        map(summary => (isSummaryValid(summary) ? mapSummaryToView(summary, runId) : null)),
        switchMap(summaryView => (summaryView ? of(summaryView) : this.fetchRaw(runId))),
        catchError(() => this.fetchRaw(runId))
      );
  }

  private fetchRaw(runId: string): Observable<StressTestsViewModel> {
    return this.http
      .get<RawStressTestsResponse>(`${this.apiUrl}/api/stress-tests`, {
        params: { runId },
      })
      .pipe(map(raw => mapRawToView(raw, runId)));
  }
}

function isSummaryValid(summary: StressTestsSummaryResponse | null | undefined): summary is StressTestsSummaryResponse {
  if (!summary) {
    return false;
  }
  return Boolean(summary.monteCarlo || summary.scenarios);
}

function mapSummaryToView(summary: StressTestsSummaryResponse, runId: string): StressTestsViewModel {
  const meta = normalizeMeta(summary.meta, runId);
  const monteCarlo = summary.monteCarlo
    ? mapMonteCarloSummary(summary.monteCarlo, meta)
    : undefined;
  const scenarios = summary.scenarios
    ? mapScenariosSummary(summary.scenarios)
    : undefined;

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
  const percentileBand = extractPercentileBand(summary);
  const mode = extractMode(meta, summary.parameters);

  return {
    parameters: summary.parameters ?? {},
    metricsByDistribution,
    curveSamples: sampleCurves(curves, 50),
    percentileBand,
    warnings: summary.warnings ?? [],
    kpis: buildKpis(metricsByDistribution, summary.metrics ?? {}),
    mode: mode ?? (curves.length && !percentileBand ? 'light' : undefined),
  };
}

function mapScenariosSummary(summary: { items?: ScenarioViewModel[]; warnings?: string[] }): ScenariosViewModel {
  return {
    items: summary.items ?? [],
    warnings: summary.warnings ?? [],
  };
}

function mapRawMonteCarlo(record: RawStressTestRecord, meta: StressTestsMeta): MonteCarloViewModel {
  const metricsByDistribution = record.distributions ?? {};
  const curves = extractEquityCurves(record);
  const percentileBand = extractPercentileBand(record);
  const mode = extractMode(meta, record.parameters);

  return {
    parameters: record.parameters ?? {},
    metricsByDistribution,
    curveSamples: sampleCurves(curves, 50),
    percentileBand,
    warnings: record.warnings ?? [],
    kpis: buildKpis(metricsByDistribution, record.metrics ?? {}),
    mode: mode ?? (curves.length && !percentileBand ? 'light' : undefined),
  };
}

function mapRawScenarios(record: RawStressTestRecord): ScenariosViewModel {
  return {
    items: extractScenarioItems(record),
    warnings: record.warnings ?? [],
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
    return raw;
  }
  if (raw.records && Array.isArray(raw.records)) {
    return raw.records;
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
  return records;
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

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(item => typeof item === 'number');
}

function isNumberArrayArray(value: unknown): value is number[][] {
  return Array.isArray(value) && value.every(isNumberArray);
}
