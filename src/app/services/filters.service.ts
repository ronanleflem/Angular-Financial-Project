import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiResult, FilterCard } from '../models/market-analysis.models';
import { getMockBenford, getMockFilters } from '../mocks/market-mocks';

@Injectable({ providedIn: 'root' })
export class FiltersService {
  constructor(private readonly http: HttpClient) {}

  // SOURCE: JAVA
  getMultiTFStats(symbol: string, timeframesCsv: string): Observable<ApiResult<FilterCard[]>> {
    const params = new HttpParams().set('symbol', symbol).set('timeframes', timeframesCsv);

    return this.http
      .get<FilterCard[]>(`${environment.apiUrl}/filter/bullish-bearish-stats/multi-timeframes`, { params })
      .pipe(
        map(data => ({ data, isMock: false } satisfies ApiResult<FilterCard[]>)),
        catchError(error => {
          console.warn('Multi timeframe stats unavailable, using mock filters.', error);
          return of({ data: getMockFilters(), isMock: true });
        })
      );
  }

  // SOURCE: JAVA
  getBenford(symbol: string, timeframe: string, maxCandle?: number): Observable<ApiResult<FilterCard>> {
    let params = new HttpParams().set('symbol', symbol).set('timeframe', timeframe);
    if (maxCandle) {
      params = params.set('maxCandle', maxCandle.toString());
    }

    return this.http
      .get<FilterCard>(`${environment.apiUrl}/filter/benford/anomaly`, { params })
      .pipe(
        map(data => ({ data, isMock: false } satisfies ApiResult<FilterCard>)),
        catchError(error => {
          console.warn('Benford filter unavailable, using mock filters.', error);
          return of({ data: getMockBenford(), isMock: true });
        })
      );
  }

  // SOURCE: JAVA
  getGenericFilter<T extends object>(path: string, params: Record<string, string | number>): Observable<ApiResult<T>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      httpParams = httpParams.set(key, String(value));
    });

    return this.http
      .get<T>(`${environment.apiUrl}/filter/${path}`, { params: httpParams })
      .pipe(
        map(data => ({ data, isMock: false } satisfies ApiResult<T>)),
        catchError(error => {
          console.warn(`Filter ${path} unavailable, using mock dataset.`, error);
          const fallback = getMockFilters(card => card.id.includes(path));
          const payload = fallback.length ? fallback : getMockFilters();
          return of({ data: payload as unknown as T, isMock: true });
        })
      );
  }
}
