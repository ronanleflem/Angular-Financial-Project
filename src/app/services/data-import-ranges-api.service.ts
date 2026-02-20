import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import {
  DeltaIngestionRange,
  DeltaIngestionRangeFilters
} from '../models/delta-ingestion-range.model';

@Injectable({ providedIn: 'root' })
export class DataImportRangesApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getRanges(filters: DeltaIngestionRangeFilters = {}): Observable<DeltaIngestionRange[]> {
    let params = new HttpParams();
    if (filters.symbol?.trim()) {
      params = params.set('symbol', filters.symbol.trim());
    }
    if (filters.insertedType?.trim()) {
      params = params.set('insertedType', filters.insertedType.trim());
    }
    if (filters.timeframe?.trim()) {
      params = params.set('timeframe', filters.timeframe.trim());
    }
    if (filters.limit !== undefined && Number.isFinite(filters.limit) && filters.limit > 0) {
      params = params.set('limit', String(Math.trunc(filters.limit)));
    }

    return this.http
      .get<DeltaIngestionRange[]>(`${this.apiUrl}/api/data-import/ranges`, { params })
      .pipe(map(items => (Array.isArray(items) ? items.map(item => this.normalizeRange(item)) : [])));
  }

  private normalizeRange(item: DeltaIngestionRange): DeltaIngestionRange {
    return {
      symbol: String(item?.symbol ?? ''),
      insertedType: String(item?.insertedType ?? '').toUpperCase() as DeltaIngestionRange['insertedType'],
      timeframe: String(item?.timeframe ?? ''),
      startDate: this.toIso(item?.startDate),
      endDate: this.toIso(item?.endDate),
      insertedAt: this.toIso(item?.insertedAt)
    };
  }

  private toIso(value: string | undefined): string {
    if (!value) {
      return '';
    }
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? value : new Date(ms).toISOString();
  }
}
