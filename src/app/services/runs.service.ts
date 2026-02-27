import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RunRequestInput } from '../models/run-request-input.model';
import {
  buildCanonicalRunPayload,
  CanonicalRunRequestOptions,
} from './run-request-adapter';
import { map } from 'rxjs';

export type RunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED'
  | 'PENDING'
  | 'DONE'
  | string;

export interface RunResponseBase {
  runId: string;
  requestId?: string;
  status?: RunStatus;
  reused?: boolean;
  updatedAt?: string;
  message?: string;
  [key: string]: unknown;
}

export interface RunSubmitResponse extends RunResponseBase {}

export interface RunStatusResponse extends RunResponseBase {
  status: RunStatus;
}

export interface RunResultResponse extends RunResponseBase {
  result?: unknown;
}

export interface RunCancelResponse extends RunResponseBase {}
export interface RunCapabilitiesResponse {
  [key: string]: unknown;
}

export interface StressSourceFilters {
  specType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}

export interface StressSourceRun {
  runId: string;
  specType: string;
  symbol?: string;
  timeframe?: string;
  createdAt?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class RunsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly runsUrl = `${this.apiUrl}/api/runs`;

  submitRun(payload: RunRequestInput, options: CanonicalRunRequestOptions = {}) {
    const canonical = buildCanonicalRunPayload(payload, payload.runType, options);
    return this.http
      .post<RunResponseRaw>(this.runsUrl, canonical)
      .pipe(map(response => normalizeRunResponse(response)));
  }

  getRunStatus(runId: string) {
    return this.http
      .get<RunResponseRaw>(`${this.runsUrl}/${runId}`)
      .pipe(map(response => normalizeRunStatusResponse(response, runId)));
  }

  getRunResult(runId: string) {
    return this.http
      .get<RunResponseRaw>(`${this.runsUrl}/${runId}/result`)
      .pipe(map(response => normalizeRunResponse(response, runId) as RunResultResponse));
  }

  cancelRun(runId: string) {
    return this.http
      .post<RunResponseRaw>(`${this.runsUrl}/${runId}/cancel`, {})
      .pipe(map(response => normalizeRunResponse(response, runId) as RunCancelResponse));
  }

  getRunCapabilities(specType: string) {
    return this.http
      .get<RunCapabilitiesResponse>(`${this.runsUrl}/capabilities`, {
        params: { spec_type: specType }
      });
  }

  getStressSources(filters: StressSourceFilters = {}) {
    const params: Record<string, string> = {};
    if (filters.specType) {
      params['spec_type'] = String(filters.specType).trim();
    }
    if (filters.dateFrom) {
      params['date_from'] = String(filters.dateFrom).trim();
    }
    if (filters.dateTo) {
      params['date_to'] = String(filters.dateTo).trim();
    }
    if (filters.search) {
      params['q'] = String(filters.search).trim();
    }
    if (filters.limit !== undefined) {
      params['limit'] = String(filters.limit);
    }
    return this.http
      .get<StressSourceRaw[] | { items?: StressSourceRaw[] }>(`${this.runsUrl}/stress/sources`, { params })
      .pipe(map(response => normalizeStressSources(response)));
  }
}

interface RunResponseRaw {
  run_id?: string;
  runId?: string;
  request_id?: string;
  requestId?: string;
  status?: RunStatus;
  reused?: boolean;
  updated_at?: string;
  updatedAt?: string;
  message?: string;
  result?: unknown;
  [key: string]: unknown;
}

interface StressSourceRaw {
  run_id?: string;
  runId?: string;
  spec_type?: string;
  specType?: string;
  symbol?: string;
  timeframe?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  status?: string;
  data?: {
    symbol?: string;
    timeframe?: string;
  };
}

function normalizeRunStatusResponse(response: RunResponseRaw | null | undefined, fallbackRunId?: string): RunStatusResponse {
  const normalized = normalizeRunResponse(response, fallbackRunId);
  return {
    ...normalized,
    status: (response?.status ?? normalized.status ?? 'PENDING') as RunStatus
  };
}

function normalizeRunResponse(response: RunResponseRaw | null | undefined, fallbackRunId?: string): RunResponseBase {
  const runId =
    response?.run_id ??
    response?.runId ??
    response?.request_id ??
    response?.requestId ??
    fallbackRunId ??
    '';
  const requestId =
    response?.requestId ??
    response?.request_id ??
    response?.runId ??
    response?.run_id ??
    (runId || undefined);

  return {
    ...response,
    runId,
    requestId,
    status: response?.status ?? undefined,
    reused: response?.reused ?? undefined,
    updatedAt: response?.updatedAt ?? response?.updated_at ?? undefined,
    message: response?.message ?? undefined
  };
}

function normalizeStressSources(
  response: StressSourceRaw[] | { items?: StressSourceRaw[] } | null | undefined
): StressSourceRun[] {
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(response?.items)
      ? response.items
      : [];
  return rows
    .map(row => {
      const runId = String(row?.run_id ?? row?.runId ?? '').trim();
      if (!runId) {
        return null;
      }
      return {
        runId,
        specType: String(row?.spec_type ?? row?.specType ?? '').trim(),
        symbol: String(row?.symbol ?? row?.data?.symbol ?? '').trim() || undefined,
        timeframe: String(row?.timeframe ?? row?.data?.timeframe ?? '').trim() || undefined,
        createdAt: String(row?.created_at ?? row?.createdAt ?? row?.updated_at ?? row?.updatedAt ?? '').trim() || undefined,
        status: row?.status ? String(row.status) : undefined
      } as StressSourceRun;
    })
    .filter((row): row is StressSourceRun => Boolean(row));
}
