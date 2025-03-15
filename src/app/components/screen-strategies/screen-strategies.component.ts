import { Component, OnInit } from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DatePipe, NgForOf, NgIf} from '@angular/common';
import {Router} from '@angular/router';

@Component({
  selector: 'app-screen-strategies',
  templateUrl: './screen-strategies.component.html',
  imports: [
    FormsModule,
    NgForOf,
    NgIf,
    DatePipe
  ],
  styleUrls: ['./screen-strategies.component.css']
})
export class ScreenStrategiesComponent implements OnInit {

  symbols: string[] = []; // À remplir via une API si besoin
  selectedSymbol: string = '';
  strategies: any[] = [];
  isLoading: boolean = false;

  constructor(private router: Router
    // private strategyService: StrategyService (à injecter pour le backend)
  ) { }

  goToDetails(strategy: any) {
    console.log('GO vers', strategy);
    this.router.navigate(['/strategy-detail', strategy.name]);
  }

  ngOnInit(): void {
    this.loadSymbols();
  }

  loadSymbols() {
    // Ex: this.symbolService.getSymbols().subscribe()
    this.symbols = ['EUR/USD', 'NAS100', 'BTC/USD']; // temporaire
  }

  loadStrategies() {
    if (!this.selectedSymbol) return;

    this.isLoading = true;

    // Appelle le backend ici
    // Ex: this.strategyService.getStrategiesBySymbol(this.selectedSymbol).subscribe(...)
    setTimeout(() => { // Simule un backend
      this.strategies = [
        {
          name: 'Breakout 1',
          symbol: this.selectedSymbol,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-01'),
          winningTrades: 15,
          losingTrades: 5,
          winRate: 75,
          averageRR: 2.5,
          tradeCount: 20
        },
        {
          name: 'Reversal Zone',
          symbol: this.selectedSymbol,
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-03-15'),
          winningTrades: 10,
          losingTrades: 10,
          winRate: 50,
          averageRR: 1.8,
          tradeCount: 20
        }
      ];

      this.isLoading = false;
    }, 1000);
  }
}

