import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, concat, interval } from 'rxjs';
import { map, shareReplay, switchMap, takeUntil } from 'rxjs/operators';
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
    return this.http.get<{ connected: boolean }>(`${this.apiUrl}/ibkr/status`);
  }

  ibkrConnectWait(host = '127.0.0.1', port = 7497, clientId = 1, timeoutMs = 3000): Observable<any> {
    const params = new HttpParams()
      .set('host', host)
      .set('port', port)
      .set('clientId', clientId)
      .set('timeoutMs', timeoutMs);
    return this.http.post(`${this.apiUrl}/ibkr/connect/wait`, null, { params });
  }

  // --- Start/Stop bars ---
  ibkrStartLiveBars(opts: {
    pair: string; duration?: string; barSize?: string; what?: string; rth?: number; formatDate?: number;
  }): Observable<{ reqId: number }> {
    const params = new HttpParams()
      .set('pair', opts.pair)
      .set('duration', opts.duration ?? '1 D')
      .set('barSize', opts.barSize ?? '1 min')
      .set('what', opts.what ?? 'MIDPOINT')
      .set('rth', String(opts.rth ?? 0))
      .set('formatDate', String(opts.formatDate ?? 2));
    return this.http.post<{ reqId: number }>(`${this.apiUrl}/ibkr/live/bars/start`, null, { params });
  }

  ibkrStopLiveBars(reqId: number): Observable<{ stopped: boolean }> {
    return this.http.post<{ stopped: boolean }>(`${this.apiUrl}/ibkr/live/bars/stop/${reqId}`, null);
  }

  // --- Bootstrap & updates ---
  ibkrRecentLiveBars(reqId: number): Observable<HistBar[]> {
    return this.http.get<HistBar[]>(`${this.apiUrl}/ibkr/live/bars/${reqId}`);
  }

  ibkrGetLastLiveBar(reqId: number): Observable<HistBar> {
    return this.http.get<HistBar>(`${this.apiUrl}/ibkr/live/bars/${reqId}/last`);
  }

  streamIbkrBars(params: {
    pair: string; duration?: string; barSize?: string; pollMs?: number;
  }, stop$: Subject<void>): Observable<
    | { reqId: number; mode: 'bootstrap'; bars: HistBar[] }
    | { reqId: number; mode: 'update'; bar: HistBar }
  > {
    const pollMs = params.pollMs ?? 1000;

    return this.ibkrStartLiveBars({
      pair: params.pair,
      duration: params.duration,
      barSize: params.barSize
    }).pipe(
      switchMap(({ reqId }) => {
        const bootstrap$ = this.ibkrRecentLiveBars(reqId).pipe(
          map(list => ({
            reqId,
            mode: 'bootstrap' as const,
            bars: [...list].sort((a, b) => histToEpochMs(a.time) - histToEpochMs(b.time))
          })),
          takeUntil(stop$)
        );

        const updates$ = interval(pollMs).pipe(
          takeUntil(stop$),
          switchMap(() => this.ibkrGetLastLiveBar(reqId)),
          map(bar => ({ reqId, mode: 'update' as const, bar }))
        );

        return concat(bootstrap$, updates$).pipe(
          takeUntil(stop$),
          shareReplay({ bufferSize: 1, refCount: true })
        );
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
