import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {JsonPipe, NgForOf, NgIf} from '@angular/common';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistic-data.component.html',
  imports: [
    NgIf,
    JsonPipe,
    NgForOf,
    FormsModule
  ],
  styleUrls: ['./statistic-data.component.css']
})
export class StatisticDataComponent {

  isLiveMode = true;
  selectedAnalysis = 'bullish-bearish-multi';
  selectedSymbol = '';
  selectedTimeframes: string[] = [];
  startDate: string = '';
  endDate: string = '';
  maxCandles: number = 1000;

  isLoading = false;
  statistics: any;
  rawResponse: any;
  statisticFields: string[] = [];

  timeframes = ['1min', '5min', '15min', '30min', '1h', '4h', 'daily'];
  symbols = ['EURUSD', 'NASDAQ', 'BTCUSD']; // exemple à remplir depuis API ou autre source

  analyses = [
    { label: 'Bullish/Bearish Multi Timeframes', value: 'bullish-bearish-multi' },
    { label: 'Bullish/Bearish All Timeframes', value: 'bullish-bearish-all' },
    { label: 'Bullish/Bearish All Timeframes Limit', value: 'bullish-bearish-all-limit' },
    { label: 'Benford Anomaly', value: 'benford-anomaly' },
    { label: 'Institutional Bias', value: 'institutional-bias' },
    { label: 'Contradictory Signals', value: 'contradictory-signals' },
    { label: 'Market Cycles', value: 'market-cycles' },
    { label: 'Market Entropy', value: 'market-entropy' },
    { label: 'Fractal Analysis', value: 'fractal-analysis' },
    { label: 'Market Manipulation', value: 'market-manipulation' },
    { value: "donchian-channels", label: "Donchian Channels" },
    { value: "liquidity", label: "Liquidity (CMF)" },
    { value: "lower-timeframe-confluence", label: "Lower Timeframe Confluence" }
  ];

  constructor(private http: HttpClient) { }

  toggleTimeframe(tf: string): void {
    const index = this.selectedTimeframes.indexOf(tf);
    if (index >= 0) {
      this.selectedTimeframes.splice(index, 1);
    } else {
      this.selectedTimeframes.push(tf);
    }
  }

  requiresMaxCandles(analysis: string): boolean {
    return [
      'benford-anomaly',
      'institutional-bias',
      'contradictory-signals',
      'market-cycles',
      'market-entropy',
      'fractal-analysis',
      'market-manipulation'
    ].includes(analysis);
  }

  loadStatistics(): void {
    this.isLoading = true;
    this.statistics = null;
    this.rawResponse = null;

    const baseUrl = 'http://localhost:8090/filter'; // à adapter
    let url = '';
    let params = new HttpParams().set('symbol', this.selectedSymbol);

    // Dynamique selon le choix
    switch (this.selectedAnalysis) {
      case 'bullish-bearish-multi':
        url = `${baseUrl}/bullish-bearish-stats/multi-timeframes`;
        params = params.set('timeframes', this.selectedTimeframes.join(','));
        break;

      case 'bullish-bearish-all':
        url = `${baseUrl}/bullish-bearish-stats/all`;
        break;

      case 'bullish-bearish-all-limit':
        url = `${baseUrl}/bullish-bearish-stats/all/limit`;
        params = params.set('numberLastestCandles', this.maxCandles);
        break;

      case 'benford-anomaly':
        url = `${baseUrl}/benford/anomaly`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('numberLastestCandles', this.maxCandles);
        break;

      case 'institutional-bias':
        url = `${baseUrl}/institutional-biais`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('maxCandle', this.maxCandles);
        break;

      case 'contradictory-signals':
        url = `${baseUrl}/contradictory-signals`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('maxCandle', this.maxCandles);
        break;

      case 'market-cycles':
        url = `${baseUrl}/cycles`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('maxCandle', this.maxCandles);
        break;

      case 'market-entropy':
        url = `${baseUrl}/entropy`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('maxCandle', this.maxCandles);
        break;

      case 'fractal-analysis':
        url = `${baseUrl}/fractal-analysis`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('maxCandle', this.maxCandles);
        break;

      case 'market-manipulation':
        url = `${baseUrl}/market-manipulation`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('maxCandle', this.maxCandles);
        break;

      case 'donchian-channels':
        url = `${baseUrl}/donchian-channels`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('period', '20'); // Tu peux changer la valeur par défaut si besoin
        break;

      case 'liquidity':
        url = `${baseUrl}/liquidity`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('period', '100'); // Période par défaut que tu utilises côté backend
        break;

      case 'lower-timeframe-confluence':
        url = `${baseUrl}/lower-timeframe-confluence`;
        params = params
          .set('timeframe', this.selectedTimeframes[0])
          .set('period', '200'); // J'ai mis 50 comme tu avais dans l'exemple
        break;


      default:
        this.isLoading = false;
        console.warn('Analyse inconnue !');
        return;
    }

    this.http.get(url, { params }).subscribe({
      next: (data) => {
        this.rawResponse = data;
        this.statistics = this.transformStatistics(data);
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  private transformStatistics(data: any): any {
    // Adapter la logique selon le retour attendu
    if (!data) return {};

    if (this.selectedAnalysis.includes('bullish-bearish')) {
      this.statisticFields = Object.keys(data[this.selectedTimeframes[0]] || {});
      return data;
    }

    // Cas où c'est un objet simple
    this.statisticFields = Object.keys(data);
    return {
      [this.selectedTimeframes[0] || 'global']: data
    };
  }
}
