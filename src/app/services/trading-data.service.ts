import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TradingDataService {
  private apiUrl = 'http://localhost:8090'; // Adapte l'URL selon ton API

  constructor(private http: HttpClient) {}

  getHistoricalCandles(symbol: string, timeframe: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/finance/charts/candles?symbol=${symbol}&timeframe=${timeframe}`);
  }
  // http://localhost:8092/rollover-volume/unified-candles?startDate=2010-06-10T00:00:00&endDate=2010-06-15T00:00:00
  getHistoricalCandlesCME(symbol: string, timeframe: string): Observable<any> {
    return this.http.get(`http://localhost:8094/rollover-volume/unified-candles?startDate=2025-02-01T00:00:00&endDate=2025-02-20T00:00:00`);
  }

  getBacktestResults(strategy: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/backtest?strategy=${strategy}`);
  }

  getStatistics(symbol: string, timeframes: string[]): Observable<any> {
    return this.http.get(`${this.apiUrl}/filter/bullish-bearish-stats`, {
      params: {
        symbol: symbol,
        timeframe: timeframes.join(',') // Envoie les timeframes sous forme de string séparée par ","
      }
    });
  }
}
