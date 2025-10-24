import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, concat, interval, of, race, timer } from 'rxjs';
import { tap, map, shareReplay, switchMap, takeUntil, catchError, filter, take  } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { HistBar, toEpochMs as histToEpochMs, toFinancialPoint as histToFinancialPoint } from '../models/hist-bar.model';

export interface SymbolDTO {
  id: string;
  symbol: string;
  name: string;
  market: string;
}

@Injectable({
  providedIn: 'root'
})
export class TradingDataService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // --- IBKR status / connect (optionnel mais utile) ---
  ibkrStatus(): Observable<{ connected: boolean }> {
    return this.http.get<{ connected: boolean }>(`${this.apiUrl}/ibkr/status`).pipe(
      tap(r => this.slog('GET /ibkr/status', r)),
      catchError(err => { this.slog('GET /ibkr/status ERROR', err); return of({ connected: false } as any); })
    );
  }

  ibkrConnectWait(host='127.0.0.1', port=7497, clientId=1, timeoutMs=3000): Observable<any> {
    const params = new HttpParams().set('host', host).set('port', port).set('clientId', clientId).set('timeoutMs', timeoutMs);
    return this.http.post(`${this.apiUrl}/ibkr/connect/wait`, null, { params }).pipe(
      tap(r => this.slog('POST /ibkr/connect/wait', r)),
      catchError(err => { this.slog('POST /ibkr/connect/wait ERROR', err); return of(err); })
    );
  }

  // --- Start/Stop bars ---
  ibkrStartLiveBars(opts: { pair: string; duration?: string; barSize?: string; what?: string; rth?: number; formatDate?: number; }): Observable<{ reqId: number }> {
    const params = new HttpParams()
      .set('pair', opts.pair)
      .set('duration', opts.duration ?? '1 D')
      .set('barSize', opts.barSize ?? '1 min')
      .set('what', opts.what ?? 'MIDPOINT')
      .set('rth', String(opts.rth ?? 0))
      .set('formatDate', String(opts.formatDate ?? 2));
    return this.http.post<{ reqId: number }>(`${this.apiUrl}/ibkr/live/bars/start`, null, { params }).pipe(
      tap(r => this.slog('POST /ibkr/live/bars/start', r)),
      catchError(err => { this.slog('POST /ibkr/live/bars/start ERROR', err); throw err; })
    );
  }

  ibkrStopLiveBars(reqId: number): Observable<{ stopped: boolean }> {
    return this.http.post<{ stopped: boolean }>(`${this.apiUrl}/ibkr/live/bars/stop/${reqId}`, null);
  }

  private slog(msg: string, extra?: any) {
    const tag = '[TradingDataService]';
    if (extra !== undefined) console.log(`${tag} ${msg}`, extra);
    else console.log(`${tag} ${msg}`);
  }

  // --- Bootstrap & updates ---
  ibkrRecentLiveBars(reqId: number): Observable<HistBar[]> {
    return this.http.get<any[]>(`${this.apiUrl}/ibkr/live/bars/${reqId}`).pipe(
      map(list => (Array.isArray(list) ? list : []).map(b => ({
        time: b.time ?? b.tsMillis ?? b.ts ?? b.timestamp,  // <-- mappe vers "time"
        open: +b.open, high: +b.high, low: +b.low, close: +b.close, volume: b.volume != null ? +b.volume : undefined
      } as HistBar))),
      tap(r => this.slog(`GET /ibkr/live/bars/${reqId} (bootstrap) len=${r.length} url=${this.apiUrl}/ibkr/live/bars/${reqId}`)),
      catchError(err => { this.slog(`GET /ibkr/live/bars/${reqId} ERROR`, err); throw err; })
    );
  }


  ibkrGetLastLiveBar(reqId: number): Observable<HistBar> {
    return this.http.get<any>(`${this.apiUrl}/ibkr/live/bars/${reqId}/last`).pipe(
      map(b => ({
        time: b.time ?? b.tsMillis ?? b.ts ?? b.timestamp,   // <-- mappe vers "time"
        open: +b.open, high: +b.high, low: +b.low, close: +b.close, volume: b.volume != null ? +b.volume : undefined
      } as HistBar)),
      tap(r => this.slog(`GET /ibkr/live/bars/${reqId}/last`, r)),
      catchError(err => { this.slog(`GET /ibkr/live/bars/${reqId}/last ERROR`, err); throw err; })
    );
  }

  streamIbkrBars(
    params: { pair: string; duration?: string; barSize?: string; pollMs?: number; },
    stop$: Subject<void>
  ) {
    const pollMs = params.pollMs ?? 1000;
    const BOOTSTRAP_RETRY_MS = 250;     // on réessaie toutes les 250ms
    const BOOTSTRAP_TIMEOUT_MS = 3000;  // max 3s pour obtenir au moins 1 bar

    this.slog(`streamIbkrBars: pair=${params.pair} duration=${params.duration ?? '1 D'} barSize=${params.barSize ?? '1 min'} pollMs=${pollMs}`);

    return this.ibkrStartLiveBars({
      pair: params.pair, duration: params.duration, barSize: params.barSize
    }).pipe(
      switchMap(({ reqId }) => {
        this.slog(`streamIbkrBars: got reqId=${reqId}`);

        // 1) Bootstrap résilient: on retry jusqu'à non-vide (ou timeout)
        const nonEmptyBootstrap$ = interval(BOOTSTRAP_RETRY_MS).pipe(
          switchMap(() => this.ibkrRecentLiveBars(reqId)),
          tap(list => this.slog(`bootstrap probe len=${Array.isArray(list) ? list.length : 'n/a'}`)),
          filter(arr => Array.isArray(arr) && arr.length > 0),
          take(1),
          map(bars => ({ mode: 'bootstrap', reqId, bars } as const)),
          tap(() => this.slog('emit bootstrap (non-empty)'))
        );

        const timeoutFallback$ = timer(BOOTSTRAP_TIMEOUT_MS).pipe(
          map(() => ({ mode: 'bootstrap', reqId, bars: [] as any[] } as const)),
          tap(() => this.slog('bootstrap timeout → emit empty'))
        );

        const bootstrap$ = race(nonEmptyBootstrap$, timeoutFallback$);

        // 2) Updates continus
        const updates$ = interval(pollMs).pipe(
          switchMap(() => this.ibkrGetLastLiveBar(reqId)),
          map(bar => ({ mode: 'update', reqId, bar } as const)),
          tap(() => this.slog('emit update')),
          takeUntil(stop$)
        );

        // Important: D’ABORD un bootstrap (non-vide si possible), PUIS les updates
        //return bootstrap$.pipe(switchMap(() => updates$));
        return concat(bootstrap$, updates$);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  toFinancialPoint = histToFinancialPoint;
  toEpochMs = histToEpochMs;

  getCandlesForTrade(tradeId: number, timeframe: string, symbol: string, comparedSymbol: string, beforeCandles: number = 50, afterCandles: number = 50) {
    console.log(symbol);
    console.log(timeframe);
    return this.http.get<{ candles: any[], comparedCandles: any[], trade: any }>(`${this.apiUrl}/api/finance/charts/from-trade?tradeId=${tradeId}&timeframe=${timeframe}&symbol=${symbol}&comparedSymbol=${comparedSymbol}&beforeCandles=${beforeCandles}&afterCandles=${afterCandles}`);
  }
  getTradesByStrategyName(strategyName: string, runId: string): Observable<any[]> {
    console.log("runId "+runId);
    console.log("Strategy Name "+strategyName);
    const url = `${this.apiUrl}/get-trades-strategy?strategyName=${strategyName}&runId=${runId}`;
    return this.http.get<any[]>(url);
  }
  getSymbols(): Observable<SymbolDTO[]> {
    return this.http.get<SymbolDTO[]>(`${this.apiUrl}/api/finance/symbols`);
  }
  getHistoricalCandles(symbol: string, timeframe: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/finance/charts/candles?symbol=${symbol}&timeframe=${timeframe}`);
  }
  // http://localhost:8092/rollover-volume/unified-candles?startDate=2010-06-10T00:00:00&endDate=2010-06-15T00:00:00
  getHistoricalCandlesCME(symbol: string, timeframe: string, startDate: string, endDate: string): Observable<any> {
    const encodedStartDate = encodeURIComponent(startDate);
    const encodedEndDate = encodeURIComponent(endDate);

    const url = `${this.apiUrl}/rollover-volume/unified-candles?symbol=${symbol}&timeframe=${timeframe}&startDate=${encodedStartDate}&endDate=${encodedEndDate}`;

    return this.http.get(url);
  }

  getHistoricalCandlesTimeframeCME(symbol: string, timeframe: string, startDate: string, endDate: string): Observable<any> {
    const encodedStartDate = encodeURIComponent(startDate);
    const encodedEndDate = encodeURIComponent(endDate);

    const url = `${this.apiUrl}/api/finance/charts/candles/date-time?symbol=${symbol}&timeframe=${timeframe}&startDate=${encodedStartDate}&endDate=${encodedEndDate}`;

    return this.http.get(url);
  }
  getAllCalculatedStrategies(){
    const url = `${this.apiUrl}/all-strategies`;
    return this.http.get<any>(url);
  }

  listStrategies(): Observable<string[]> {
    const url = `${this.apiUrl}/all-name-strategies`;
    return this.http.get<string[]>(url);
  }
  getLiveCandle(symbol: string, timeframe: string) {
    // Remplace par ton vrai endpoint en live si t'en as un !
    const url = `${this.apiUrl}/api/live-candle?symbol=${symbol}&timeframe=${timeframe}`;
    return this.http.get<any>(url);
  }
  getCalculationStrategy(strategyName: string,
                         symbol: string,
                         comparedSymbol: string,
                         timeframe: string,
                         startDate: string,
                         endDate: string,
                         period: number = 1000) {
    const encodedStartDate = encodeURIComponent(startDate);
    const encodedEndDate = encodeURIComponent(endDate);

    let url = `${this.apiUrl}/run-strategy-by-name?strategyName=${strategyName}&symbol=${symbol}&timeframe=${timeframe}&period=${period}`;

    if (comparedSymbol) {
      url += `&comparedSymbol=${comparedSymbol}`;
    }

    url += `&startDate=${encodedStartDate}&endDate=${encodedEndDate}`;

    return this.http.get(url);
  }

  getBacktestResults(strategy: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/backtest?strategy=${strategy}`);
  }

  getStatistics(symbol: string, timeframes: string[]): Observable<any> {
    return this.http.get(`${this.apiUrl}/filter/bullish-bearish-stats/multi-timeframes`, {
      params: {
        symbol: symbol,
        timeframes: timeframes.join(',') // Envoie les timeframes sous forme de string séparée par ","
      }
    });
  }

  getHistoricalStatistics(symbol: string, timeframes: string[], startDate: string, endDate: string) {
    return this.http.get(`/api/statistics/historical`, {
      params: {
        symbol,
        timeframes: timeframes.join(','),
        startDate,
        endDate
      }
    });
  }
}
