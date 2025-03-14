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
import annotationPlugin from 'chartjs-plugin-annotation';
import { AnnotationOptions, LineAnnotationOptions, LabelPosition } from 'chartjs-plugin-annotation';
import { format } from 'date-fns';

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
      entryDate: new Date('2024-02-08T14:15:00'),
      entryPrice: 1.0850,
      stopLoss: 1.0800,
      takeProfit: 1.0895,
      exitDate: new Date('2024-02-08T15:45:00'),
      result: 'win', // "win" ou "loss"
      exitPrice: 1.0895,
    },
    {
      entryDate: new Date('2024-02-08T12:15:00'),
      entryPrice: 1.0870,
      stopLoss: 1.0845,
      takeProfit: 1.0895,
      exitDate: new Date('2024-02-08T12:45:00'),
      result: 'loss',
      exitPrice: 1.0845
    }
  ];


  // Liste des symboles et timeframes disponibles
  symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'NASDAQ', 'SP500'];
  //timeframes = ['1min', '5min', '15min','30min', '1h', '4h', 'daily'];
  timeframes = ['M1', 'M5', 'M15','M30', 'H1', 'H4', 'D1'];

  startDate: string = '';
  endDate: string = '';

  // Symbol et timeframe sélectionnés
  selectedSymbol = 'EURUSD';
  selectedTimeframe = 'M15';

  isForex = true;

  constructor(private tradingService: TradingDataService) {
    Chart.register(...registerables, CandlestickElement, OhlcController, CandlestickController, zoomPlugin, annotationPlugin);
  }

  ngAfterViewInit() {
    this.tradingService.getHistoricalCandlesCME('EURUSD', 'M5', this.startDate, this.endDate).subscribe(data => {
      console.log('Données reçues :', data); // ✅ Vérifie que les données arrivent bien
      console.log(Chart.getChart('candlestickChart')); // ✅ Devrait afficher `undefined` (normal)
      console.log(Chart.registry.controllers);
      this.candles = data;
      console.log("Données utilisées :", this.candles.map(c => new Date(c.date).toISOString()));
      setTimeout(() => this.createChart(), 0); // ✅ Attendre que le DOM soit prêt
      const annotations = this.getAnnotations();
      console.log("Annotations générées :", annotations);

      this.chart.update();
    });
  }

  loadData() {
    this.tradingService.getHistoricalCandlesCME(this.selectedSymbol, this.selectedTimeframe, this.startDate, this.endDate).subscribe(data => {
      console.log('Données reçues loadData :', data);
      this.candles = data;
      //console.log("Données utilisées :", this.candles.map(c => new Date(c.date).toUTCString()));
      //console.log("Données utilisées :", this.candles.map(c => new Date(c.date).toISOString()));

      /*
      this.candles = this.candles.filter(c => {
        const date = new Date(c.date);
        const day = date.getUTCDay();
        return day !== 0 && day !== 6; // ✅ Exclut samedi et dimanche
      });*/
      console.log('Données filtrées loadData :', this.candles);
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
          yMin: trade.stopLoss,
          yMax: trade.takeProfit,
          backgroundColor: trade.result === 'win' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
          borderColor: trade.result === 'win' ? 'green' : 'red',
          borderWidth: 2,
          label: {
            content: `Trade ${index + 1}`,
            enabled: true,
            position: 'end' as const, // Correction ici
            color: '#FFF',
            backgroundColor: trade.result === 'win' ? 'green' : 'red'
          }
        },
        // 📌 Ligne noire horizontale pour l'entrée du trade
        {
          type: 'box', // Utilisation d'une box très fine pour simuler une ligne
          xMin: trade.entryDate.getTime(),
          xMax: trade.exitDate.getTime(),
          yMin: trade.entryPrice, // Très petite hauteur pour simuler une ligne
          yMax: trade.entryPrice, // Garde un trait visible
          borderColor: trade.result === 'win' ? 'green' : 'red',
          borderWidth: 1,
          backgroundColor: trade.result === 'win' ? 'green' : 'red' // Simule une ligne noire
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
              x: new Date(c.date).getTime(),
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
              unit: 'day',
              parser: (value: unknown) => {
                if (typeof value === 'string' || typeof value === 'number') {
                  return new Date(value).getTime();
                }
                console.log("Valeur invalide :", value);
                return NaN; // Retourner une valeur invalide si le type est inconnu
              },
            },
            afterBuildTicks: (scale) => {
              console.log("Ticks générés :", scale.ticks);
            },
            ticks: {
              maxRotation: 0,
              minRotation: 0,
              source: 'data',
              callback: (value: number | string, index: number, values: any[]) => {
                console.log("Tick callback exécuté pour:", value);
                const date = new Date(value);
                /*
                const day = date.getUTCDay();
                if (this.isForex && (day === 0 || day === 6)) {
                  console.log("Tick callback weekend ", value);
                  return ''; // Cache les week-ends si Forex
                }*/
                return format(date, 'yyyy-MM-dd HH:mm'); // Utilisation de date-fns
              }
            }
          },
          y: {
            beginAtZero: false,
            ticks: {
              callback: (value: any) => {
                return value.toFixed(2); // Formater les valeurs de l'axe Y
              }
            }
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
            //annotations: this.getAnnotations()
          }
        }
      }
    });
  }
}


