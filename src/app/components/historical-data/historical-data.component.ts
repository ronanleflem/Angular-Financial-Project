import { Component, AfterViewInit } from '@angular/core';
import { NgChartsModule } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { Chart, registerables} from 'chart.js';
import { TradingDataService } from '../../services/trading-data.service';
import 'chartjs-chart-financial'; // ✅ Importe le plugin pour les chandeliers
import 'chartjs-adapter-date-fns'; // ✅ Pour gérer les dates correctement
import zoomPlugin from 'chartjs-plugin-zoom';
import {CandlestickController, CandlestickElement, OhlcController} from 'chartjs-chart-financial';
import {FormsModule} from '@angular/forms';
//import annotationPlugin from 'chartjs-plugin-annotation';
import { AnnotationOptions, LineAnnotationOptions, LabelPosition } from 'chartjs-plugin-annotation';

@Component({
  selector: 'app-historical-data',
  standalone: true,
  imports: [CommonModule, NgChartsModule, FormsModule],
  templateUrl: './historical-data.component.html',
  styleUrl: './historical-data.component.css'
})
export class HistoricalDataComponent implements AfterViewInit {
  chart: any;
  candles: any[] = [];
  trades = [
    {
      entryDate: new Date('2023-05-06T10:00:00'), // Date d'entrée
      entryPrice: 1, // Prix d'entrée
      stopLoss: 0.9, // Stop Loss
      takeProfit: 1.2, // Take Profit
      exitDate: new Date('2025-09-25T10:30:00'), // Date de sortie
      result: 'win', // "win" ou "loss"
      exitPrice: 1.2
    },
    {
      entryDate: new Date('2024-09-08T12:15:00'),
      entryPrice: 1.0870,
      stopLoss: 1.0845,
      takeProfit: 1.0895,
      exitDate: new Date('2024-09-08T12:45:00'),
      result: 'loss',
      exitPrice: 1.0845
    }
  ];

  // Liste des symboles et timeframes disponibles
  symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'NASDAQ', 'SP500'];
  timeframes = ['1min', '5min', '15min', '1h', '4h', '1d'];

  // Symbol et timeframe sélectionnés
  selectedSymbol = 'EURUSD';
  selectedTimeframe = '15min';

  constructor(private tradingService: TradingDataService) {
    Chart.register(...registerables, CandlestickElement, OhlcController, CandlestickController, zoomPlugin);
  }

  ngAfterViewInit() {
    this.tradingService.getHistoricalCandles('EURUSD', '5min').subscribe(data => {
      console.log('Données reçues :', data); // ✅ Vérifie que les données arrivent bien
      console.log(Chart.getChart('candlestickChart')); // ✅ Devrait afficher `undefined` (normal)
      console.log(Chart.registry.controllers);
      this.candles = data;
      setTimeout(() => this.createChart(), 0); // ✅ Attendre que le DOM soit prêt
    });
  }

  loadData() {
    this.tradingService.getHistoricalCandles(this.selectedSymbol, this.selectedTimeframe).subscribe(data => {
      this.candles = data;
      setTimeout(() => this.createChart(), 0); // ✅ Attendre que le DOM soit prêt
    });
  }
  getAnnotations(): Record<string, LineAnnotationOptions> {
    return this.trades
      .flatMap((trade, index) => [
        {
          type: 'box',
          xMin: trade.entryDate.getTime(), // Convert Date en timestamp
          xMax: trade.exitDate.getTime(),  // Convert Date en timestamp
          yMin: trade.entryPrice,
          yMax: trade.exitPrice,
          borderColor: 'red',
          borderWidth: 2,
          label: {
            content: `Trade ${index + 1}`,
            enabled: true,
            position: 'end' as const, // Correction ici
            color: '#000',
            backgroundColor: 'red'
          }
        }
      ])
      .reduce((acc, annotation, idx) => {
        acc[`annotation_${idx}`] = annotation;
        return acc;
      }, {} as Record<string, LineAnnotationOptions>);
  }

  createChart() {
    const canvas = document.getElementById('candlestickChart') as HTMLCanvasElement;
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

    console.log("Creation du graphique...");
    this.chart = new Chart(ctx, {
      type: 'candlestick',
      data: {
        datasets: [
          {
            label: 'EUR/USD - 15min',
            data: this.candles.map(c => ({
              x: new Date(c.date),
              o: c.open,
              h: c.high,
              l: c.low,
              c: c.close
            })),
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
              unit: 'minute',
            },
            ticks: {
              maxRotation: 0,
              minRotation: 0,
            }
          },
          y: {
            beginAtZero: false
          }
        },
        plugins: {
          zoom: {
            limits: {
              x: {min: 'original', max: 'original'},
              y: {min: 'original', max: 'original'}
            },
            pan: {
              enabled: true,
              mode: 'x',
            },
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
            }
          },
          annotation: {
            annotations: this.getAnnotations()
          }
        }
      }
    });
  }
}


