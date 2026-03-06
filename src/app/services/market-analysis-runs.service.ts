import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import {
  MarketAnalysisRowRecord,
  MarketAnalysisRunDetail,
  MarketAnalysisRunItem,
  MarketAnalysisRunResult,
  MarketAnalysisRunsPage,
  MarketAnalysisRunsQuery,
  MarketAnalysisSeasonalityRunSummary,
  MarketAnalysisSpecType
} from '../models/market-analysis.models';

@Injectable({ providedIn: 'root' })
export class MarketAnalysisRunsService {
  private readonly baseUrl = `${environment.apiUrl}/api/market-analysis/runs`;

  constructor(private readonly http: HttpClient) {}

  getRuns(query: MarketAnalysisRunsQuery): Observable<MarketAnalysisRunsPage> {
    let params = new HttpParams();

    if (query.specType) {
      params = params.set('spec_type', query.specType);
    }
    if (query.status) {
      params = params.set('status', query.status);
    }
    if (query.symbol) {
      params = params.set('symbol', query.symbol);
    }
    if (query.timeframe) {
      params = params.set('timeframe', query.timeframe);
    }
    if (query.from) {
      params = params.set('from', query.from);
    }
    if (query.to) {
      params = params.set('to', query.to);
    }
    if (query.page !== undefined) {
      params = params.set('page', String(query.page));
    }
    if (query.size !== undefined) {
      params = params.set('size', String(query.size));
    }
    if (query.sort) {
      params = params.set('sort', query.sort);
    }

    return this.http
      .get<RawMarketAnalysisRunsPage>(this.baseUrl, { params })
      .pipe(map(payload => normalizeRunsPage(payload)));
  }

  getRunDetail(runId: string): Observable<MarketAnalysisRunDetail> {
    return this.http
      .get<RawMarketAnalysisRunDetail>(`${this.baseUrl}/${runId}`)
      .pipe(map(payload => normalizeRunDetail(payload)));
  }

  getRunResult(runId: string): Observable<MarketAnalysisRunResult> {
    return this.http
      .get<RawMarketAnalysisRunResult>(`${this.baseUrl}/${runId}/result`)
      .pipe(map(payload => normalizeRunResult(payload)));
  }
}

type RawMarketAnalysisRunItem = {
  run_id: string;
  request_id: string;
  spec_type: MarketAnalysisSpecType;
  status: string;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  updated_at?: string | null;
  error_message?: string | null;
  attempts?: number | null;
  max_attempts?: number | null;
  cancel_requested?: boolean | null;
  persistence_enabled?: boolean | null;
  spec_id?: string | null;
  dataset_id?: string | null;
};

type RawMarketAnalysisRunsPage = {
  items?: RawMarketAnalysisRunItem[] | null;
  page?: number | null;
  size?: number | null;
  total_elements?: number | null;
  total_pages?: number | null;
  sort?: string | null;
};

type RawMarketAnalysisRunDetail = RawMarketAnalysisRunItem & {
  payload_json?: Record<string, unknown> | null;
  progress_json?: Record<string, unknown> | null;
  result_json_available?: boolean | null;
};

type RawMarketAnalysisRunResult = {
  run_id: string;
  spec_type: MarketAnalysisSpecType;
  source?: string | null;
  meta?: {
    spec_id?: string | null;
    dataset_id?: string | null;
    out_dir?: string | null;
    window?: string | null;
    start?: string | null;
    end?: string | null;
    status?: string | null;
  } | null;
  data?: {
    market_stats_rows?: MarketAnalysisRowRecord[] | null;
    seasonality_profiles?: MarketAnalysisRowRecord[] | null;
    seasonality_run_summary?: MarketAnalysisSeasonalityRunSummary | null;
    raw_result_json?: Record<string, unknown> | null;
  } | null;
};

function normalizeRunsPage(payload: RawMarketAnalysisRunsPage): MarketAnalysisRunsPage {
  return {
    items: Array.isArray(payload.items) ? payload.items.map(item => normalizeRunItem(item)) : [],
    page: payload.page ?? 0,
    size: payload.size ?? 0,
    totalElements: payload.total_elements ?? 0,
    totalPages: payload.total_pages ?? 0,
    sort: payload.sort ?? null
  };
}

function normalizeRunItem(item: RawMarketAnalysisRunItem): MarketAnalysisRunItem {
  return {
    runId: item.run_id,
    requestId: item.request_id,
    specType: item.spec_type,
    status: item.status,
    createdAt: item.created_at ?? null,
    startedAt: item.started_at ?? null,
    finishedAt: item.finished_at ?? null,
    updatedAt: item.updated_at ?? null,
    errorMessage: item.error_message ?? null,
    attempts: item.attempts ?? 0,
    maxAttempts: item.max_attempts ?? 0,
    cancelRequested: item.cancel_requested ?? false,
    persistenceEnabled: item.persistence_enabled ?? false,
    specId: item.spec_id ?? null,
    datasetId: item.dataset_id ?? null
  };
}

function normalizeRunDetail(item: RawMarketAnalysisRunDetail): MarketAnalysisRunDetail {
  return {
    ...normalizeRunItem(item),
    payloadJson: item.payload_json ?? null,
    progressJson: item.progress_json ?? null,
    resultJsonAvailable: item.result_json_available ?? false
  };
}

function normalizeRunResult(payload: RawMarketAnalysisRunResult): MarketAnalysisRunResult {
  return {
    runId: payload.run_id,
    specType: payload.spec_type,
    source: payload.source ?? 'result_json',
    meta: {
      specId: payload.meta?.spec_id ?? null,
      datasetId: payload.meta?.dataset_id ?? null,
      outDir: payload.meta?.out_dir ?? null,
      window: payload.meta?.window ?? null,
      start: payload.meta?.start ?? null,
      end: payload.meta?.end ?? null,
      status: payload.meta?.status ?? null
    },
    data: {
      marketStatsRows: Array.isArray(payload.data?.market_stats_rows) ? payload.data.market_stats_rows : [],
      seasonalityProfiles: Array.isArray(payload.data?.seasonality_profiles) ? payload.data.seasonality_profiles : [],
      seasonalityRunSummary: payload.data?.seasonality_run_summary ?? null,
      rawResultJson: payload.data?.raw_result_json ?? null
    }
  };
}
