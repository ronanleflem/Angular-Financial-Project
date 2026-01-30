import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { StressTestsService } from '../../services/stress-tests.service';
import { StressTestRunSummary, StressTestsViewModel } from '../../models/stress-tests.models';
import { MonteCarloPanelComponent } from './components/monte-carlo-panel/monte-carlo-panel.component';
import { ScenariosPanelComponent } from './components/scenarios-panel/scenarios-panel.component';

interface StressTestsState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: StressTestsViewModel;
  error?: string;
}

@Component({
  selector: 'app-stress-tests-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MonteCarloPanelComponent,
    ScenariosPanelComponent,
  ],
  templateUrl: './stress-tests.page.html',
  styleUrls: ['./stress-tests.page.scss'],
  host: {
    class: 'stress-tests-page',
  },
})
export class StressTestsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(StressTestsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<StressTestsState>({ status: 'idle' });
  readonly runs = signal<StressTestRunSummary[]>([]);
  readonly runsLoading = signal(false);
  readonly runsError = signal<string | null>(null);
  runId = '';

  ngOnInit(): void {
    this.loadRuns();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const runId = params.get('runId');
      if (!runId) {
        this.runId = '';
        this.state.set({ status: 'idle' });
        return;
      }
      this.runId = runId;
      this.load(runId);
    });
  }

  reload(): void {
    if (!this.runId) {
      return;
    }
    this.load(this.runId);
  }

  onRunSelected(runId: string): void {
    if (!runId || runId === this.runId) {
      return;
    }
    this.router.navigate(['/stress-tests', runId]);
  }

  private loadRuns(): void {
    this.runsLoading.set(true);
    this.runsError.set(null);
    this.service
      .getRuns()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: runs => {
          this.runs.set(Array.isArray(runs) ? runs : []);
          this.runsLoading.set(false);
        },
        error: err => {
          console.error('Failed to load stress test runs', err);
          this.runs.set([]);
          this.runsLoading.set(false);
          this.runsError.set('Impossible de charger la liste des runs.');
        },
      });
  }

  private load(runId: string): void {
    this.state.set({ status: 'loading' });
    this.service
      .getStressTests(runId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => this.state.set({ status: 'success', data }),
        error: err => {
          console.error('Failed to load stress tests', err);
          this.state.set({
            status: 'error',
            error: 'Impossible de charger les stress tests pour ce run.',
          });
        },
      });
  }

  get metaEntries(): Array<{ label: string; value: string }> {
    const meta = this.state().data?.meta;
    if (!meta) {
      return [];
    }
    const entries: Array<{ label: string; value: string }> = [];
    if (meta.strategyId) {
      entries.push({ label: 'Strategy', value: meta.strategyId });
    }
    if (meta.assetClass) {
      entries.push({ label: 'Asset', value: meta.assetClass });
    }
    if (meta.symbol) {
      entries.push({ label: 'Symbol', value: meta.symbol });
    }
    if (meta.timeframe) {
      entries.push({ label: 'Timeframe', value: meta.timeframe });
    }
    if (meta.mode) {
      entries.push({ label: 'Mode', value: meta.mode });
    }
    return entries;
  }
}
