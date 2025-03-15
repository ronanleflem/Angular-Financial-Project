import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {DatePipe, NgIf} from '@angular/common';

@Component({
  selector: 'app-strategy-detail',
  templateUrl: './strategy-detail.component.html',
  imports: [
    DatePipe,
    NgIf
  ],
  styleUrls: ['./strategy-detail.component.css']
})
export class StrategyDetailComponent implements OnInit {

  strategy: any;
  trades: any[] = [];
  currentTradeIndex: number = 0;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadStrategy();
  }

  loadStrategy() {
    const strategyId = this.route.snapshot.paramMap.get('id');

    // Ici, tu charges via le service backend. Pour l'instant, mock data :
    this.strategy = {
      id: strategyId,
      name: 'Breakout 1',
      symbol: 'EUR/USD',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-01'),
      winRate: 75,
      averageRR: 2.5,
      tradeCount: 3
    };

    // Trades mock
    this.trades = [
      {
        id: 1,
        type: 'Long',
        entryDate: new Date('2024-01-05 09:30'),
        entryPrice: 1.1000,
        exitPrice: 1.1050,
        result: '+50 pips',
        rr: 2.5,
        duration: 120,
        comment: 'Breakout validé après la KillZone NY'
      },
      {
        id: 2,
        type: 'Short',
        entryDate: new Date('2024-01-10 14:00'),
        entryPrice: 1.1100,
        exitPrice: 1.1080,
        result: '+20 pips',
        rr: 1.0,
        duration: 45,
        comment: 'Reversal sur zone de déséquilibre'
      },
      {
        id: 3,
        type: 'Long',
        entryDate: new Date('2024-01-15 08:00'),
        entryPrice: 1.0950,
        exitPrice: 1.0920,
        result: '-30 pips',
        rr: -1.5,
        duration: 60,
        comment: 'Erreur de lecture de structure'
      }
    ];
  }

  get currentTrade() {
    return this.trades[this.currentTradeIndex];
  }

  nextTrade() {
    if (this.currentTradeIndex < this.trades.length - 1) {
      this.currentTradeIndex++;
    }
  }
}

