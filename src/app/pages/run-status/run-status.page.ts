import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RunsService, RunStatusResponse } from '../../services/runs.service';
import { catchError, of, switchMap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-run-status-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  templateUrl: './run-status.page.html',
  styleUrls: ['./run-status.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'run-status-page'
  }
})
export class RunStatusPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly runsService = inject(RunsService);
  private readonly destroyRef = inject(DestroyRef);

  private pollSub?: Subscription;
  requestId = '';
  readonly status = signal<RunStatusResponse | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly polling = signal(false);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.requestId = params.get('requestId') ?? '';
      if (!this.requestId) {
        this.stopPolling();
        this.status.set(null);
        this.errorMessage.set('requestId manquant.');
        return;
      }
      this.startPolling(this.requestId);
    });
  }

  goBack(): void {
    this.router.navigate(['/strategy-launcher']);
  }

  refreshStatus(): void {
    if (!this.requestId) {
      return;
    }
    this.loading.set(true);
    this.runsService
      .getRunStatus(this.requestId)
      .pipe(
        catchError(err => {
          const status = err?.status ? `HTTP ${err.status}` : 'HTTP error';
          const message = err?.message ?? 'Erreur inconnue';
          this.errorMessage.set(`[${status}] ${message}`);
          console.error('[RunStatus] Refresh failed', { requestId: this.requestId, error: err });
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        if (!response) {
          this.loading.set(false);
          return;
        }
        this.status.set(response);
        this.loading.set(false);
        this.errorMessage.set(null);
      });
  }

  private startPolling(requestId: string): void {
    this.stopPolling();
    this.loading.set(true);
    this.errorMessage.set(null);
    this.polling.set(true);

    this.pollSub = timer(0, 5000)
      .pipe(
        switchMap(() =>
          this.runsService.getRunStatus(requestId).pipe(
            catchError(err => {
              const status = err?.status ? `HTTP ${err.status}` : 'HTTP error';
              const message = err?.message ?? 'Erreur inconnue';
              this.errorMessage.set(`[${status}] ${message}`);
              console.error('[RunStatus] Poll failed', { requestId, error: err });
              return of(null);
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        if (!response) {
          this.loading.set(false);
          return;
        }
        this.status.set(response);
        this.loading.set(false);
        this.errorMessage.set(null);

        if (response.status === 'DONE' || response.status === 'FAILED') {
          this.stopPolling();
        }
      });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    this.polling.set(false);
  }
}
