import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LiveSignal } from '../../models/live-signal.model';
import { LiveSignalsService } from '../../services/live-signals.service';

@Component({
  selector: 'app-live-signals-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-signals-table.component.html',
  styleUrls: ['./live-signals-table.component.scss']
})
export class LiveSignalsTableComponent implements OnInit, OnDestroy {
  @Output() select = new EventEmitter<LiveSignal>();

  signals: LiveSignal[] = [];
  selectedSignal: LiveSignal | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly liveSignalsService: LiveSignalsService) {}

  ngOnInit(): void {
    this.liveSignalsService.signals$
      .pipe(takeUntil(this.destroy$))
      .subscribe(signals => {
        this.signals = [...signals].reverse();
      });

    this.liveSignalsService.selected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(signal => {
        this.selectedSignal = signal;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSelect(signal: LiveSignal): void {
    this.liveSignalsService.select(signal);
    this.select.emit(signal);
  }

  trackBySignal(_: number, signal: LiveSignal): string {
    return `${signal.strategyId}-${signal.symbol}-${signal.timeframe}-${signal.tsOpenUtc}`;
  }
}
