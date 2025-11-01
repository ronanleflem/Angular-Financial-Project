import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HistBar, StartBarsResponse, TradeView } from '../models/trading.models';
import { OhlcvBar } from '../models/live-signal.model';

@Injectable({
  providedIn: 'root'
})
export class MarketDataService {
  private readonly baseUrl = environment.apiBaseUrl ?? environment.apiUrl ?? '';

  constructor(private readonly http: HttpClient) {}

  connectWait(
    host = '127.0.0.1',
    port = 7497,
    clientId = 1,
    timeoutMs = 4000
  ): Observable<any> {
    const params = new HttpParams()
      .set('host', host)
      .set('port', String(port))
      .set('clientId', String(clientId))
      .set('timeoutMs', String(timeoutMs));
    return this.http.post(`${this.baseUrl}/ibkr/connect/wait`, null, { params });
  }

  setMarketDataType(type = 3): Observable<any> {
    const params = new HttpParams().set('type', String(type));
    return this.http.post(`${this.baseUrl}/ibkr/market-data-type`, null, { params });
  }

  startLiveBars(
    pair = 'EURUSD',
    duration = '1 D',
    barSize = '1 min',
    what = 'MIDPOINT',
    rth = 0,
    formatDate = 2
  ): Observable<StartBarsResponse> {
    const params = new HttpParams()
      .set('pair', pair)
      .set('duration', duration)
      .set('barSize', barSize)
      .set('what', what)
      .set('rth', String(rth))
      .set('formatDate', String(formatDate));
    return this.http.post<StartBarsResponse>(`${this.baseUrl}/ibkr/live/bars/start`, null, { params });
  }

  getLiveBars(reqId: number): Observable<HistBar[]> {
    return this.http.get<HistBar[]>(`${this.baseUrl}/ibkr/live/bars/${reqId}`);
  }

  getLastLiveBar(reqId: number): Observable<HistBar | null> {
    return this.http.get<HistBar | null>(`${this.baseUrl}/ibkr/live/bars/${reqId}/last`);
  }

  stopLiveBars(reqId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/ibkr/live/bars/stop/${reqId}`, null);
  }

  listTrades(broker = 'IBKR'): Observable<TradeView[]> {
    const params = new HttpParams().set('broker', broker);
    return this.http.get<TradeView[]>(`${this.baseUrl}/trades`, { params });
  }

  getWindow(params: {
    symbol: string;
    timeframe: string;
    endTsUtc: string;
    barsBack: number;
    exitTsUtc?: string;
    maxForward?: number;
  }): Observable<{ bars: OhlcvBar[] }> {
    let httpParams = new HttpParams()
      .set('symbol', params.symbol)
      .set('timeframe', params.timeframe)
      .set('endTsUtc', params.endTsUtc)
      .set('barsBack', String(params.barsBack));

    if (params.exitTsUtc) {
      httpParams = httpParams.set('exitTsUtc', params.exitTsUtc);
    }

    if (params.maxForward !== undefined) {
      httpParams = httpParams.set('maxForward', String(params.maxForward));
    }

    return this.http.get<{ bars: OhlcvBar[] }>(`${this.baseUrl}/marketdata/ohlcv/window`, {
      params: httpParams
    });
  }
}
