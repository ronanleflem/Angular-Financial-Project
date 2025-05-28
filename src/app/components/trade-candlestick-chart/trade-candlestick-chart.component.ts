import { Component, Input, OnChanges } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import 'chartjs-chart-financial';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import { TradingDataService } from '../../services/trading-data.service';

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
  }

  ngOnChanges(): void {
    if (this.tradeId) {
      this.loadData();
    }
  }

  loadData(): void {
    this.tradingService.getCandlesForTrade(this.tradeId, this.timeframe).subscribe(response => {
      const { candles, trade } = response;

      const data = candles.map((c: any) => ({
        x: new Date(c.date).getTime(),
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close
      }));
      console.log(candles);
      console.log(trade);
      setTimeout(() => this.renderChart(data, trade), 0);
    });
  }

  renderChart(data: any[], trade: any): void {
    const canvas = document.getElementById('tradeCandlestickChart') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx!, {
      type: 'candlestick',
      data: {
        datasets: [{
          label: `Trade #${this.tradeId}`,
          data,
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: { unit: 'minute' }
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
                xMin: new Date(trade.entryDate).getTime(),
                xMax: new Date(trade.exitDate).getTime(),
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
