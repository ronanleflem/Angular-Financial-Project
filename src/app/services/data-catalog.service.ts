import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  Candle,
  CoverageInfo,
  DataSeries,
  SaveRangeRequest,
  SaveResult,
  SymbolRef,
} from '../models/data-catalog.models';
import { DEFAULT_SYMBOLS, MOCK_SAVE_OK, MOCK_SERIES, getMockCandles } from '../mocks/data-catalog.mocks';

@Injectable({ providedIn: 'root' })
export class DataCatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly mockedProbes = new Set<string>();

  listSymbols(): Observable<SymbolRef[]> {
    return this.http.get<SymbolRef[]>(`${this.apiUrl}/api/finance/symbols`).pipe(
      tap(list => console.log('[DataCatalogService] listSymbols', list?.length ?? 0)),
      map(list => (Array.isArray(list) ? list : [])),
      catchError(err => {
        console.warn('[DataCatalogService] fallback symbols', err);
        return of(DEFAULT_SYMBOLS);
      })
    );
  }

  probeSeries(symbol: string, timeframe: string): Observable<Candle[]> {
    const key = this.buildProbeKey(symbol, timeframe);
    const params = new HttpParams().set('symbol', symbol).set('timeframe', timeframe);
    return this.http
      .get<Candle[]>(`${this.apiUrl}/api/finance/charts/candles`, { params })
      .pipe(
        map(response => (Array.isArray(response) ? response : [])),
        tap(() => this.mockedProbes.delete(key)),
        catchError(err => {
          console.warn('[DataCatalogService] probeSeries fallback', symbol, timeframe, err);
          this.mockedProbes.add(key);
          const fallback = getMockCandles(symbol, timeframe);
          return of(fallback);
        })
      );
  }

  computeCoverage(candles: Candle[], timeframe: string): CoverageInfo {
    if (!Array.isArray(candles) || candles.length === 0) {
      return {
        start: '',
        end: '',
        count: 0,
        expected: 0,
        coveragePct: 0,
      };
    }

    const sorted = [...candles].sort((a, b) => a.t - b.t);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const frameMs = this.timeframeToMs(timeframe);

    const spanMs = Math.max(0, last.t - first.t);
    const expected = frameMs > 0 ? Math.floor(spanMs / frameMs) + 1 : sorted.length;
    const count = sorted.length;
    const coveragePct = expected > 0 ? Math.min(100, (count / expected) * 100) : 0;

    let missing = 0;
    if (frameMs > 0 && count > 1) {
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].t - sorted[i - 1].t;
        if (gap > frameMs * 1.5) {
          missing += Math.max(0, Math.round(gap / frameMs) - 1);
        }
      }
    }
    const gapsPct = expected > 0 && missing > 0 ? Math.min(100, (missing / expected) * 100) : undefined;

    return {
      start: new Date(first.t).toISOString(),
      end: new Date(last.t).toISOString(),
      count,
      expected,
      coveragePct: Number(coveragePct.toFixed(2)),
      gapsPct: gapsPct != null ? Number(gapsPct.toFixed(2)) : undefined,
    };
  }

  listSeriesAvailability(query: {
    broker?: string;
    marketType?: string;
    symbol?: string;
    timeframe?: string;
  }): Observable<DataSeries[]> {
    let params = new HttpParams();
    if (query.symbol) params = params.set('symbol', query.symbol);
    if (query.timeframe) params = params.set('timeframe', query.timeframe);
    if (query.broker) params = params.set('broker', query.broker);
    if (query.marketType) params = params.set('marketType', query.marketType);

    return this.http
      .get<DataSeries[]>(`${this.apiUrl}/api/finance/charts/availability`, { params })
      .pipe(
        map(series => this.normalizeSeries(series ?? [])),
        catchError(err => {
          console.warn('[DataCatalogService] availability endpoint unavailable, probing candles', err);
          return this.buildSeriesFromProbes(query).pipe(
            catchError(innerErr => {
              console.warn('[DataCatalogService] probe fallback failed, using mock series', innerErr);
              return of(MOCK_SERIES);
            })
          );
        })
      );
  }

  saveRange(req: SaveRangeRequest): Observable<SaveResult> {
    const broker = (req.broker ?? '').toLowerCase();

    if (broker.includes('binance')) {
      const params = new HttpParams()
        .set('symbol', req.symbol)
        .set('interval', req.timeframe)
        .set('startDate', req.start)
        .set('endDate', req.end);
      return this.http.get(`${this.apiUrl}/binance/historical-range`, { params }).pipe(
        map(() => ({ ok: true, mock: false, message: 'Binance range requested' } as SaveResult)),
        catchError(err => {
          console.warn('[DataCatalogService] binance range fallback', err);
          return of({ ...MOCK_SAVE_OK });
        })
      );
    }

    if (req.source === 'CSV') {
      const body = {
        symbol: req.symbol,
        timeframe: req.timeframe,
        startDate: req.start,
        endDate: req.end,
        timezone: req.timezone,
        venue: req.venue,
        conflictPolicy: req.conflictPolicy,
        rollover: req.rollover,
      };
      const endpoint = broker.includes('databento') || broker.includes('cme')
        ? `${this.apiUrl}/api/finance/charts/load-csv/cme`
        : `${this.apiUrl}/api/finance/charts/load-csv/tradingview`;
      return this.http.post(endpoint, body).pipe(
        map(() => ({ ok: true, mock: false, message: 'CSV ingestion submitted' } as SaveResult)),
        catchError(err => {
          console.warn('[DataCatalogService] csv ingestion fallback', err);
          return of({ ...MOCK_SAVE_OK });
        })
      );
    }

    if (broker.includes('ibkr') || broker.includes('mexc')) {
      console.warn('[DataCatalogService] broker not yet supported, returning mock');
      return of({ ...MOCK_SAVE_OK });
    }

    console.warn('[DataCatalogService] generic save fallback');
    return of({ ...MOCK_SAVE_OK });
  }

  private buildSeriesFromProbes(query: {
    broker?: string;
    marketType?: string;
    symbol?: string;
    timeframe?: string;
  }): Observable<DataSeries[]> {
    const symbols = query.symbol
      ? [query.symbol]
      : DEFAULT_SYMBOLS.map(s => s.ticker);
    const timeframes = query.timeframe ? [query.timeframe] : ['1h', '4h', '1d'];
    const combos = symbols.flatMap(symbol => timeframes.map(timeframe => ({ symbol, timeframe })));

    if (combos.length === 0) {
      return of(MOCK_SERIES);
    }

    const requests = combos.map(({ symbol, timeframe }) =>
      this.probeSeries(symbol, timeframe).pipe(
        map(candles => {
          if (!candles.length) {
            return undefined;
          }
          const coverage = this.computeCoverage(candles, timeframe);
          const key = this.buildProbeKey(symbol, timeframe);
          const mock = this.mockedProbes.has(key);
          return {
            symbol,
            broker: query.broker ?? (mock ? 'Mock Broker' : 'Unknown'),
            timeframe,
            start: coverage.start,
            end: coverage.end,
            count: coverage.count,
            coveragePct: coverage.coveragePct,
            gapsPct: coverage.gapsPct,
            sessions: '-',
            tz: 'UTC',
            updatedAt: new Date().toISOString(),
            source: mock ? 'Mock' : 'API',
          } as DataSeries;
        })
      )
    );

    return forkJoin(requests).pipe(
      map(list => list.filter((item): item is DataSeries => !!item)),
      map(list => (list.length > 0 ? list : MOCK_SERIES))
    );
  }

  private normalizeSeries(series: DataSeries[]): DataSeries[] {
    return series.map(item => {
      const normalized: DataSeries = {
        symbol: item.symbol,
        broker: item.broker,
        timeframe: item.timeframe,
        start: this.ensureIsoString(item.start),
        end: this.ensureIsoString(item.end),
        count: item.count ?? 0,
        coveragePct: item.coveragePct ?? 0,
        gapsPct: item.gapsPct ?? undefined,
        sessions: item.sessions ?? '-',
        tz: item.tz ?? 'UTC',
        updatedAt: item.updatedAt ? this.ensureIsoString(item.updatedAt) : new Date().toISOString(),
        datasetId: item.datasetId,
        venue: item.venue,
        source: item.source ?? 'API',
      };

      if ((!normalized.coveragePct || normalized.coveragePct <= 0) && normalized.start && normalized.end) {
        const expected = this.estimateExpected(normalized.start, normalized.end, normalized.timeframe);
        normalized.coveragePct = expected > 0 ? Number(((normalized.count / expected) * 100).toFixed(2)) : 0;
      } else {
        normalized.coveragePct = Number(normalized.coveragePct.toFixed(2));
      }

      if (normalized.gapsPct != null) {
        normalized.gapsPct = Number(normalized.gapsPct.toFixed(2));
      }

      return normalized;
    });
  }

  private estimateExpected(start: string, end: string, timeframe: string): number {
    const frameMs = this.timeframeToMs(timeframe);
    if (!frameMs) {
      return 0;
    }
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return 0;
    }
    return Math.floor((endMs - startMs) / frameMs) + 1;
  }

  private ensureIsoString(value?: string): string {
    if (!value) {
      return '';
    }
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) {
      return value;
    }
    return new Date(ms).toISOString();
  }

  private timeframeToMs(timeframe: string): number {
    const match = timeframe?.match(/^(\d+)([smhdw])$/i);
    if (!match) {
      if (timeframe?.toLowerCase() === '1min') {
        return 60 * 1000;
      }
      return 0;
    }
    const value = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'w':
        return value * 7 * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  private buildProbeKey(symbol: string, timeframe: string): string {
    return `${symbol}__${timeframe}`;
  }
}

