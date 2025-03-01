import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TradingDataService {
  private apiUrl = 'http://localhost:8090/api/finance/charts'; // Adapte l'URL selon ton API

  constructor(private http: HttpClient) {}

  getHistoricalCandles(symbol: string, timeframe: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/candles?symbol=${symbol}&timeframe=${timeframe}`);
  }

  getBacktestResults(strategy: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/backtest?strategy=${strategy}`);
  }

  getStatistics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/statistics`);
  }
}
