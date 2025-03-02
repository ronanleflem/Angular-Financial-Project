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

    if (this.chart) this.chart.destroy(); // ✅ Évite les doublons
    console.log("Creation du graphique...");
    this.chart = new Chart(ctx, {
      type: 'candlestick', // ✅ Utilise le type chandeliers
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
            barThickness: 1, // Ajuste la largeur de la bougie
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'minute', // Chaque unité sur l'axe des X est une minute
            },
            ticks: {
              maxRotation: 0, // Limite la rotation des ticks sur l'axe X
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
              x: { min: 'original', max: 'original' }, // Empêche de sortir des limites de base
              y: { min: 'original', max: 'original' }
            },
            pan: {
              enabled: true, // Activation du déplacement
              mode: 'x', // Déplacement uniquement horizontal
            },
            zoom: {
              wheel: {
                enabled: true, // Zoom avec la molette de la souris
              },
              pinch: {
                enabled: true // Zoom avec les doigts sur mobile
              },
              mode: 'x', // Zoom horizontal uniquement
            }
          }
        }
      }
    });
  }
}


