import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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
