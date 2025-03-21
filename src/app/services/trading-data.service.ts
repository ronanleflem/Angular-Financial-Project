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
  getHistoricalCandlesCME(symbol: string, timeframe: string, startDate: string, endDate: string): Observable<any> {
    const encodedStartDate = encodeURIComponent(startDate);
    const encodedEndDate = encodeURIComponent(endDate);

    const url = `${this.apiUrl}/rollover-volume/unified-candles?symbol=${symbol}&timeframe=${timeframe}&startDate=${encodedStartDate}&endDate=${encodedEndDate}`;

    return this.http.get(url);
  }

  getLiveCandle(symbol: string, timeframe: string) {
    // Remplace par ton vrai endpoint en live si t'en as un !
    const url = `${this.apiUrl}/api/live-candle?symbol=${symbol}&timeframe=${timeframe}`;
    return this.http.get<any>(url);
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
