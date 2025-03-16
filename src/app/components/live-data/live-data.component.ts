import { Component, OnDestroy, AfterViewInit } from '@angular/core';
import { NgChartsModule } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { TradingDataService } from '../../services/trading-data.service';
import 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import { CandlestickController, CandlestickElement, OhlcController } from 'chartjs-chart-financial';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-live-data',
  standalone: true,
  imports: [CommonModule, NgChartsModule, FormsModule],
  templateUrl: './live-data.component.html',
  styleUrl: './live-data.component.css'
})
export class LiveDataComponent implements AfterViewInit, OnDestroy {

  chart: any;
  candles: any[] = [];

  symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'NASDAQ', 'SP500'];
  timeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

  selectedSymbol = 'EURUSD';
  selectedTimeframe = 'M1';

  isStreaming = false;
  liveInterval: any; // Pour le polling ou mock de données en live

  constructor(private tradingService: TradingDataService) {
    Chart.register(...registerables, CandlestickElement, OhlcController, CandlestickController, zoomPlugin);
  }

  ngAfterViewInit() {
    this.initChart();
  }

  ngOnDestroy() {
    this.stopLive();
  }

  initChart() {
    const canvas = document.getElementById('liveCandlestickChart') as HTMLCanvasElement;
    if (!canvas) {
      console.error('Canvas not found!');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context!');
      return;
    }

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(ctx, {
      type: 'candlestick',
      data: {
        datasets: [
          {
            label: `${this.selectedSymbol} - ${this.selectedTimeframe}`,
            data: [],
            borderColor: 'black',
            backgroundColor: 'rgba(0, 128, 0, 0.5)',
            barThickness: 1,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'minute'
            }
          },
          y: {
            beginAtZero: false
          }
        },
        plugins: {
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

  startLive() {
    if (this.isStreaming) {
      console.warn('Stream déjà en cours');
      return;
    }

    this.isStreaming = true;
    this.candles = [];

    this.initChart();

    // 🔴 Ex: On fait un polling toutes les secondes
    this.liveInterval = setInterval(() => {
      this.fetchLiveCandle();
    }, 1000); // Chaque seconde, ou remplace par un websocket dans le futur
  }

  stopLive() {
    if (this.liveInterval) {
      clearInterval(this.liveInterval);
      this.liveInterval = null;
    }
    this.isStreaming = false;
  }

  fetchLiveCandle() {
    // Appelle ton service pour récupérer la dernière bougie en live
    this.tradingService.getLiveCandle(this.selectedSymbol, this.selectedTimeframe)
      .subscribe(latestCandle => {

        // ➡️ Si déjà une candle pour ce timestamp, on la met à jour
        const lastCandle = this.candles[this.candles.length - 1];

        if (lastCandle && new Date(latestCandle.date).getTime() === new Date(lastCandle.date).getTime()) {
          this.candles[this.candles.length - 1] = latestCandle;
        } else {
          this.candles.push(latestCandle);
        }

        this.updateChart();
      });
  }

  updateChart() {
    if (!this.chart) return;

    this.chart.data.datasets[0].data = this.candles.map(c => ({
      x: new Date(c.date).getTime(),
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close
    }));

    this.chart.update();
  }
}
