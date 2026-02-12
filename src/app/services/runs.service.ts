import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RunRequestInput } from '../models/run-request-input.model';
import {
  CanonicalRunRequestOptions,
  mapRunRequestToCanonical
} from './run-request-adapter';
import { map } from 'rxjs';

export type RunStatus = 'PENDING' | 'RUNNING' | 'FAILED' | 'DONE' | string;

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

@Injectable({ providedIn: 'root' })
export class RunsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly runsUrl = `${this.apiUrl}/api/runs`;

  submitRun(payload: RunRequestInput, options: CanonicalRunRequestOptions = {}) {
    const canonical = mapRunRequestToCanonical(payload, options);
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
