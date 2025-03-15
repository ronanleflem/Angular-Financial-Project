import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {FormsModule} from '@angular/forms';
import {JsonPipe, NgForOf, NgIf} from '@angular/common';

@Component({
  selector: 'app-strategy-calculation',
  templateUrl: './strategy-calculation.component.html',
  imports: [
    FormsModule,
    JsonPipe,
    NgForOf,
    NgIf
  ],
  styleUrls: ['./strategy-calculation.component.css']
})
export class StrategyCalculationComponent {
  strategies: string[] = ['Stratégie 1', 'Stratégie 2', 'Stratégie 3']; // Tu peux les charger dynamiquement si besoin
  symbols: string[] = ['ES', 'NQ', 'YM']; // Exemples de symboles
  selectedStrategy: string = '';
  selectedSymbol: string = '';
  startDate: string = '';
  endDate: string = '';

  result: any = null;

  constructor(private http: HttpClient) {}

  calculateStrategy() {
    if (!this.selectedStrategy || !this.selectedSymbol || !this.startDate || !this.endDate) {
      alert('Tous les champs sont requis pour lancer le calcul !');
      return;
    }

    const encodedStartDate = encodeURIComponent(this.startDate);
    const encodedEndDate = encodeURIComponent(this.endDate);

    const url = `http://localhost:8094/strategies/calculate?strategy=${this.selectedStrategy}&symbol=${this.selectedSymbol}&startDate=${encodedStartDate}&endDate=${encodedEndDate}`;

    this.http.get(url).subscribe({
      next: (response) => {
        console.log('Résultat de la stratégie', response);
        this.result = response;
      },
      error: (error) => {
        console.error('Erreur lors du calcul de stratégie :', error);
      }
    });
  }
}
