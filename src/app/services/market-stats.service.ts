import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ApiResult,
  Candle,
  KpiSummary,
  SeasonalityProfile,
  StatsSummaryRow
} from '../models/market-analysis.models';
import {
  getMockCandles,
  getMockSeasonality,
  getMockStatsSummary
} from '../mocks/market-mocks';

@Injectable({ providedIn: 'root' })
export class MarketStatsService {
  constructor(private readonly http: HttpClient) {}

  // SOURCE: JAVA
  getCandles(symbol: string, timeframe: string, start?: string, end?: string): Observable<ApiResult<Candle[]>> {
    let params = new HttpParams().set('symbol', symbol).set('timeframe', timeframe);
    if (start) {
      params = params.set('startDate', start);
    }
    if (end) {
      params = params.set('endDate', end);
    }

    return this.http
      .get<Candle[]>(`${environment.apiUrl}/api/finance/charts/candles`, { params })
      .pipe(
        map(data => ({ data, isMock: false } satisfies ApiResult<Candle[]>)),
        catchError(error => {
          console.warn('Candles endpoint unavailable, using mock dataset.', error);
          return of({ data: getMockCandles(symbol), isMock: true });
        })
      );
  }

  // SOURCE: PY
  getSeasonality(symbol: string, timeframe: string): Observable<ApiResult<SeasonalityProfile>> {
    const params = new HttpParams().set('symbol', symbol).set('timeframe', timeframe);

    return this.http
      .get<SeasonalityProfile>(`${environment.pyApiUrl}/seasonality/profiles`, { params })
      .pipe(
        map(data => ({ data, isMock: false } satisfies ApiResult<SeasonalityProfile>)),
        catchError(error => {
          console.warn('Seasonality endpoint unavailable, using mock dataset.', error);
          return of({ data: getMockSeasonality(symbol), isMock: true });
        })
      );
  }

  // SOURCE: PY
  getStatsSummary(query: {
    symbol: string;
    timeframe: string;
    event?: string;
    target?: string;
  }): Observable<ApiResult<StatsSummaryRow[]>> {
    let params = new HttpParams().set('symbol', query.symbol).set('timeframe', query.timeframe);
    if (query.event) {
      params = params.set('event', query.event);
    }
    if (query.target) {
      params = params.set('target', query.target);
    }

    return this.http
      .get<RawStatsSummaryRow[]>(`${environment.pyApiUrl}/stats/summary`, { params })
      .pipe(
        map(data => ({
          data: data.map(row => normalizeStatsSummaryRow(row)),
          isMock: false
        }) satisfies ApiResult<StatsSummaryRow[]>),
        catchError(error => {
          console.warn('Stats summary endpoint unavailable, using mock dataset.', error);
          return of({ data: getMockStatsSummary(), isMock: true });
        })
      );
  }

  computeKpisFromCandles(candles: Candle[]): KpiSummary {
    if (!candles.length) {
      return { atrPercent: 0, averageRange: 0, skewness: 0, kurtosis: 0, maxDrawdown: 0 };
    }

    const trueRanges: number[] = [];
    const ranges: number[] = [];
    const closes: number[] = candles.map(candle => candle.close);

    let previousClose = candles[0].close;
    for (const candle of candles) {
      const highLowRange = candle.high - candle.low;
      ranges.push(highLowRange);
      const trueRange = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previousClose),
        Math.abs(candle.low - previousClose)
      );
      trueRanges.push(trueRange);
      previousClose = candle.close;
    }

    const averageClose = closes.reduce((acc, value) => acc + value, 0) / closes.length;
    const avgRange = ranges.reduce((acc, value) => acc + value, 0) / ranges.length;
    const atr = trueRanges.reduce((acc, value) => acc + value, 0) / trueRanges.length;

    const mean = averageClose;
    const centered = closes.map(value => value - mean);
    const variance = centered.reduce((acc, value) => acc + value * value, 0) / centered.length;
    const stdDev = Math.sqrt(variance || 1);

    const skewness = centered.reduce((acc, value) => acc + Math.pow(value, 3), 0) / centered.length / Math.pow(stdDev, 3);
    const kurtosis =
      centered.reduce((acc, value) => acc + Math.pow(value, 4), 0) / centered.length / Math.pow(stdDev, 4) - 3;

    let peak = closes[0];
    let maxDd = 0;
    for (const close of closes) {
      peak = Math.max(peak, close);
      const drawdown = (close - peak) / peak;
      maxDd = Math.min(maxDd, drawdown);
    }

    return {
      atrPercent: Number(((atr / averageClose) * 100).toFixed(2)),
      averageRange: Number(avgRange.toFixed(4)),
      skewness: Number(skewness.toFixed(3)),
      kurtosis: Number(kurtosis.toFixed(3)),
      maxDrawdown: Number((maxDd * 100).toFixed(2))
    };
  }
}

function normalizeStatsSummaryRow(row: RawStatsSummaryRow): StatsSummaryRow {
  return {
    event: row.event,
    target: row.target,
    n: row.n,
    pHat:
      typeof row.pHat === 'number'
        ? row.pHat
        : typeof row.p_hat === 'number'
          ? row.p_hat
          : 0,
    ciLow:
      typeof row.ciLow === 'number'
        ? row.ciLow
        : typeof row.ci_low === 'number'
          ? row.ci_low
          : 0,
    ciHigh:
      typeof row.ciHigh === 'number'
        ? row.ciHigh
        : typeof row.ci_high === 'number'
          ? row.ci_high
          : 0,
    lift: row.lift,
    qValue:
      typeof row.qValue === 'number'
        ? row.qValue
        : typeof row.q_value === 'number'
          ? row.q_value
          : undefined
  };
}

type RawStatsSummaryRow = {
  event: string;
  target: string;
  n: number;
  // camelCase possibles
  pHat?: number;
  ciLow?: number;
  ciHigh?: number;
  lift?: number;
  qValue?: number;
  // snake_case possibles (backend Python)
  p_hat?: number;
  ci_low?: number;
  ci_high?: number;
  q_value?: number;
};
