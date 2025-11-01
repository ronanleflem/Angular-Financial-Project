import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, merge } from 'rxjs';
import { startWith, takeUntil } from 'rxjs/operators';
import { LiveSignal } from '../../models/live-signal.model';
import { LiveSignalChartComponent } from '../live-signal-chart/live-signal-chart.component';
import { LiveSignalsTableComponent } from '../live-signals-table/live-signals-table.component';
import { LiveSignalsService } from '../../services/live-signals.service';

type BrokerOption = {
  value: string;
  label: string;
};

type TimeframeOption = {
  value: string;
  label: string;
};

interface MarketListening {
  broker: string;
  market: string;
  timeframe: string;
  startedAt: string;
  robotsListening: number;
}

interface RobotStatus {
  broker: string;
  strategyName: string;
  market: string;
  timeframes: string[];
  startedAt: string;
  active: boolean;
}

@Component({
  selector: 'app-active-robots',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LiveSignalChartComponent, LiveSignalsTableComponent],
  templateUrl: './active-robots.component.html',
  styleUrls: ['./active-robots.component.scss']
})
export class ActiveRobotsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  readonly markets: MarketListening[] = [
    { broker: 'IBKR', market: 'EURUSD', timeframe: '15m', startedAt: this.hoursAgo(26), robotsListening: 3 },
    { broker: 'IBKR', market: 'GBPUSD', timeframe: '1h', startedAt: this.hoursAgo(78), robotsListening: 2 },
    { broker: 'IBKR', market: 'AAPL', timeframe: '5m', startedAt: this.hoursAgo(12), robotsListening: 4 },
    { broker: 'MEXC', market: 'BTCUSDT', timeframe: '1h', startedAt: this.hoursAgo(130), robotsListening: 6 },
    { broker: 'MEXC', market: 'ETHUSDT', timeframe: '30m', startedAt: this.hoursAgo(55), robotsListening: 5 },
    { broker: 'BINANCE', market: 'SOLUSDT', timeframe: '15m', startedAt: this.hoursAgo(98), robotsListening: 4 },
    { broker: 'BINANCE', market: 'BNBUSDT', timeframe: '4h', startedAt: this.hoursAgo(240), robotsListening: 1 }
  ];

  readonly robots: RobotStatus[] = [
    { broker: 'IBKR', strategyName: 'Mean Reversion FX', market: 'EURUSD', timeframes: ['5m', '15m'], startedAt: this.hoursAgo(26), active: true },
    { broker: 'IBKR', strategyName: 'London Breakout', market: 'GBPUSD', timeframes: ['1h'], startedAt: this.hoursAgo(78), active: false },
    { broker: 'IBKR', strategyName: 'Momentum Tech', market: 'AAPL', timeframes: ['5m', '15m'], startedAt: this.hoursAgo(12), active: true },
    { broker: 'MEXC', strategyName: 'Crypto Swing', market: 'BTCUSDT', timeframes: ['1h', '4h'], startedAt: this.hoursAgo(130), active: true },
    { broker: 'MEXC', strategyName: 'DeFi Scalper', market: 'ETHUSDT', timeframes: ['15m', '30m'], startedAt: this.hoursAgo(55), active: false },
    { broker: 'BINANCE', strategyName: 'Layer-1 Tracker', market: 'SOLUSDT', timeframes: ['15m'], startedAt: this.hoursAgo(98), active: true },
    { broker: 'BINANCE', strategyName: 'BNB Range', market: 'BNBUSDT', timeframes: ['4h'], startedAt: this.hoursAgo(240), active: false }
  ];

  readonly brokerOptions: BrokerOption[];
  readonly timeframeOptions: TimeframeOption[];

  readonly brokerControl = new FormControl('ALL', { nonNullable: true });
  readonly timeframeControl = new FormControl('ALL', { nonNullable: true });

  filteredMarkets: MarketListening[] = [];
  filteredRobots: RobotStatus[] = [];
  selectedSignal: LiveSignal | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly liveSignalsService: LiveSignalsService
  ) {
    const brokers = Array.from(new Set([...this.markets, ...this.robots].map(item => item.broker))).sort();
    this.brokerOptions = [
      { value: 'ALL', label: 'Tous les brokers' },
      ...brokers.map(broker => ({ value: broker, label: broker }))
    ];

    const timeframes = Array.from(new Set(this.markets.map(market => market.timeframe))).sort((a, b) => a.localeCompare(b));
    this.timeframeOptions = [
      { value: 'ALL', label: 'Toutes les timeframes' },
      ...timeframes.map(tf => ({ value: tf, label: tf }))
    ];
  }

  ngOnInit(): void {
    this.liveSignalsService.connect();
    this.liveSignalsService.selected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(signal => {
        this.selectedSignal = signal;
      });

    merge(
      this.brokerControl.valueChanges,
      this.timeframeControl.valueChanges
    )
      .pipe(startWith(null), takeUntil(this.destroy$))
      .subscribe(() => this.applyFilters());

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const brokerParam = params.get('broker');
        if (!brokerParam) {
          return;
        }

        const normalized = brokerParam.toUpperCase();
        const target = this.brokerOptions.find(option => option.value === normalized);
        this.brokerControl.setValue(target ? target.value : 'ALL');
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.liveSignalsService.disconnect();
  }

  toggleRobot(robot: RobotStatus): void {
    robot.active = !robot.active;
  }

  onSelectSignal(signal: LiveSignal): void {
    this.selectedSignal = signal;
  }

  formatDurationSince(startedAt: string): string {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const diffMs = Math.max(now - start, 0);

    const diffMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(diffMinutes / (60 * 24));
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
    const minutes = diffMinutes % 60;

    const parts: string[] = [];
    if (days > 0) {
      parts.push(`${days} j`);
    }
    if (hours > 0) {
      parts.push(`${hours} h`);
    }
    if (minutes > 0 || parts.length === 0) {
      parts.push(`${minutes} min`);
    }

    return parts.join(' ');
  }

  getRobotStateLabel(robot: RobotStatus): string {
    return robot.active ? 'Actif' : 'Inactif';
  }

  private applyFilters(): void {
    const brokerFilter = this.brokerControl.value;
    const timeframeFilter = this.timeframeControl.value;

    this.filteredMarkets = this.markets.filter(market => {
      const brokerMatches = brokerFilter === 'ALL' || market.broker === brokerFilter;
      const timeframeMatches = timeframeFilter === 'ALL' || market.timeframe === timeframeFilter;
      return brokerMatches && timeframeMatches;
    });

    this.filteredRobots = this.robots.filter(robot => {
      const brokerMatches = brokerFilter === 'ALL' || robot.broker === brokerFilter;
      const timeframeMatches = timeframeFilter === 'ALL' || robot.timeframes.includes(timeframeFilter);
      return brokerMatches && timeframeMatches;
    });
  }

  private hoursAgo(hours: number): string {
    const date = new Date(Date.now() - hours * 60 * 60 * 1000);
    return date.toISOString();
  }
}
