import { Component, Input, OnChanges } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import 'chartjs-chart-financial';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import { TradingDataService } from '../../services/trading-data.service';
import {
  CandlestickController,
  CandlestickElement
} from 'chartjs-chart-financial';

@Component({
  selector: 'app-trade-candlestick-chart',
  templateUrl: './trade-candlestick-chart.component.html',
  styleUrls: ['./trade-candlestick-chart.component.css'],
  standalone: true,
  imports: [],
})
export class TradeCandlestickChartComponent implements OnChanges {
  @Input() tradeId!: number;
  @Input() timeframe: string = '5min';

  chart: Chart | undefined;

  constructor(private tradingService: TradingDataService) {
    Chart.register(...registerables, zoomPlugin, annotationPlugin);
    Chart.register(CandlestickController, CandlestickElement);
  }

  ngOnChanges(): void {
    if (this.tradeId) {
      this.loadData();
    }
  }

  loadData(): void {
    this.tradingService.getCandlesForTrade(this.tradeId, this.timeframe).subscribe(response => {
      const { candles, trade } = response;

      // 🛡️ Validation des données
      const data = candles
        .filter((c: any) => !isNaN(new Date(c.date).getTime()))
        .map((c: any) => ({
          x: new Date(c.date).getTime(),
          o: c.open,
          h: c.high,
          l: c.low,
          c: c.close
        }));

      console.log('[Candles]', candles);
      console.log('[Trade]', trade);

      // 🛡️ Vérifie que trade.entryDate et exitDate sont valides
      const entryTime = new Date(trade.entryTimestamp).getTime();
      const exitTime = new Date(trade.exitTimestamp).getTime();
      console.log(trade.entryTimestamp);
      console.log(trade.exitTimestamp);
      console.log(new Date(trade.entryTimestamp).getTime());
      console.log(new Date(trade.exitTimestamp).getTime());

      if (isNaN(entryTime) || isNaN(exitTime)) {
        console.error('Dates du trade invalides :', trade);
        return;
      }

      setTimeout(() => this.renderChart(data, trade), 0);
    });
  }

  renderChart(data: any[], trade: any): void {
    const canvas = document.getElementById('tradeCandlestickChart') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!data?.length || !trade || !canvas || !ctx) {
      console.warn('Graphique non généré : données manquantes ou invalides');
      return;
    }
    if (this.chart) {
      this.chart.destroy();
    }

    const entryTime = new Date(trade.entryTimestamp).getTime();
    const exitTime = new Date(trade.exitTimestamp).getTime();

    console.log(new Date(trade.entryTimestamp).getTime())
    console.log(new Date(trade.exitTimestamp).getTime())

    const durationMs = new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const timeUnit = durationMs < oneDay ? 'minute' : durationMs < oneDay * 7 ? 'hour' : 'day';

    this.chart = new Chart(ctx, {
      type: 'candlestick',
      data: {
        datasets: [{
          label: `Trade #${this.tradeId}`,
          data,
        }]
      },
      options: {
        responsive: true,
        parsing: false, // Important pour les chartjs-financial
        scales: {
          x: {
            type: 'time',
            time: {
              unit: timeUnit,
              //tooltipFormat: 'yyyy-MM-dd HH:mm',
              //displayFormats: {
              //minute: 'HH:mm',
              //hour: 'HH:mm',
              //day: 'MMM dd'
              //}
            },
            ticks: {
              autoSkip: true,
              maxTicksLimit: 20
            }
          },
          y: {
            beginAtZero: false
          }
        },
        plugins: {
          annotation: {
            annotations: {
              tradeBox: {
                type: 'box',
                xMin: entryTime,
                xMax: exitTime,
                yMin: trade.stopLoss,
                yMax: trade.takeProfit,
                backgroundColor: trade.result === 'win' ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)',
                borderColor: trade.result === 'win' ? 'green' : 'red',
                borderWidth: 2,
                label: {
                  content: 'Trade',
                  //enabled: true,
                  position: 'start'
                }
              }
            }
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x'
            },
            zoom: {
              wheel: {
                enabled: true
              },
              mode: 'x'
            }
          }
        }
      }
    });
  }
}
