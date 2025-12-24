import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {FormsModule} from '@angular/forms';
import {JsonPipe, NgForOf, NgIf} from '@angular/common';
import {TradingDataService} from '../../services/trading-data.service';

@Component({
  selector: 'app-strategy-calculation',
  templateUrl: './strategy-calculation.component.html',
  imports: [
    FormsModule,
    JsonPipe,
    NgForOf,
    NgIf
  ],
  standalone: true,
  styleUrls: ['./strategy-calculation.component.css']
})
export class StrategyCalculationComponent implements OnInit {
  strategies: string[] = [];
  symbols: string[] = ['ES', 'NQ', 'YM', 'EURUSD', 'BTCUSDT', 'APTUSDT']; // Exemples de symboles
  comparedSymbols: string[] = ['ES', 'NQ', 'YM', 'EURUSD', 'BTCUSDT', 'APTUSDT']; // Exemples de symboles
  timeframes: string[] = ['1min', '5min', '15min', '1h'];
  selectedStrategy: string = '';
  selectedSymbol: string = '';
  selectedComparedSymbol: string = '';
  selectedTimeframe: string = '';
  startDate: string = '';
  endDate: string = '';

  result: any = null;

  constructor(private http: HttpClient, private tradingService: TradingDataService) {}

  ngOnInit(): void {
    this.tradingService.listStrategies().subscribe({
      next: (names) => {
        this.strategies = names;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des stratégies :', err);
      }
    });
  }

  calculateStrategy() {
    if (!this.selectedStrategy || !this.selectedSymbol || !this.selectedTimeframe || !this.startDate || !this.endDate || !this.selectedComparedSymbol) {
      alert('Tous les champs sont requis pour lancer le calcul !');
      return;
    }
    this.tradingService
      .getCalculationStrategy(
        this.selectedStrategy,
        this.selectedSymbol,
        this.selectedComparedSymbol,
        this.selectedTimeframe,
        this.startDate,
        this.endDate
      )
      .subscribe({
        next: (response) => {
          console.log('Résultat de la stratégie', response);
          this.result = response;
        },
        error: (error) => {
          console.error('Erreur lors du calcul de stratégie :', error);
          this.result = null;
        }
      });
  }
}
