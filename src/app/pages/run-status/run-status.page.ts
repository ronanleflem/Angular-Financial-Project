import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RunsService, RunResultResponse, RunStatusResponse } from '../../services/runs.service';
import { catchError, of, switchMap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { UiRunStatus, formatRunStatusLabel, isTerminalStatus, normalizeRunStatus } from '../../utils/run-status';
import { RuntimeRunError, parseRunRuntimeError } from '../../utils/backend-validation';

const NOT_IMPLEMENTED_YET_MESSAGE = 'Not implemented yet';

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
  readonly uiStatus = signal<UiRunStatus>('unknown');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);
  readonly polling = signal(false);
  readonly result = signal<RunResultResponse | null>(null);
  readonly resultLoading = signal(false);
  readonly resultError = signal<string | null>(null);
  readonly resultInfo = signal<string | null>(null);
  readonly terminalMessage = signal<string | null>(null);
  readonly runtimeError = signal<RuntimeRunError | null>(null);
  readonly canceling = signal(false);
  private resultForRequestId: string | null = null;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.requestId = params.get('requestId') ?? '';
      if (!this.requestId) {
        this.stopPolling();
        this.status.set(null);
        this.uiStatus.set('unknown');
        this.resetResultState();
        this.infoMessage.set(null);
        this.errorMessage.set('requestId manquant.');
        return;
      }
      this.infoMessage.set(null);
      this.resetResultState();
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
        this.applyStatus(response);
        this.loading.set(false);
        this.errorMessage.set(null);
        if (this.checkTerminalAndLoadResult()) {
          this.stopPolling();
        }
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
        this.applyStatus(response);
        this.loading.set(false);
        this.errorMessage.set(null);

        if (this.checkTerminalAndLoadResult()) {
          this.stopPolling();
        }
      });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    this.polling.set(false);
  }

  cancelRun(): void {
    if (!this.requestId || this.canceling() || isTerminalStatus(this.uiStatus())) {
      return;
    }
    this.canceling.set(true);
    this.runsService
      .cancelRun(this.requestId)
      .pipe(
        catchError(err => {
          if (err?.status === 409) {
            this.infoMessage.set('Cancel non bloquant: run deja termine (already_finished).');
            this.errorMessage.set(null);
            this.refreshStatus();
            return of(null);
          }
          const status = err?.status ? `HTTP ${err.status}` : 'HTTP error';
          const message = err?.message ?? 'Erreur inconnue';
          this.errorMessage.set(`[${status}] ${message}`);
          console.error('[RunStatus] Cancel failed', { requestId: this.requestId, error: err });
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.canceling.set(false);
        if (!response) {
          return;
        }
        this.infoMessage.set('Cancel accepte.');
        this.applyStatus(response as RunStatusResponse);
        if (this.checkTerminalAndLoadResult()) {
          this.stopPolling();
        }
      });
  }

  canCancel(): boolean {
    return Boolean(this.requestId) && !isTerminalStatus(this.uiStatus());
  }

  formatStatusLabel(): string {
    return formatRunStatusLabel(this.uiStatus(), this.status()?.status ?? null);
  }

  statusSubtitle(): string {
    if (this.loading() && !this.status()) {
      return 'Soumission en cours';
    }
    return `Statut: ${this.formatStatusLabel()}`;
  }

  private applyStatus(response: RunStatusResponse): void {
    this.status.set(response);
    const uiStatus = normalizeRunStatus(response.status);
    this.uiStatus.set(uiStatus);
    this.updateRuntimeError(parseRunRuntimeError(response));
    this.terminalMessage.set(this.terminalStatusMessage(uiStatus, response));
  }

  private checkTerminalAndLoadResult(): boolean {
    const status = this.uiStatus();
    if (!isTerminalStatus(status)) {
      return false;
    }
    this.loadResult(this.requestId);
    return true;
  }

  private loadResult(requestId: string): void {
    if (!requestId || this.resultLoading() || this.resultForRequestId === requestId) {
      return;
    }
    this.resultLoading.set(true);
    this.resultError.set(null);
    this.runsService
      .getRunResult(requestId)
      .pipe(
        catchError(err => {
          if (err?.status === 409 || err?.status === 425) {
            this.resultInfo.set('Result not available yet');
            this.resultError.set(null);
            return of(null);
          }
          const status = err?.status ? `HTTP ${err.status}` : 'HTTP error';
          const message = err?.message ?? 'Erreur inconnue';
          this.resultError.set(`[${status}] ${message}`);
          console.error('[RunStatus] Result fetch failed', { requestId, error: err });
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.resultLoading.set(false);
        if (!response) {
          return;
        }
        if (response.status && !isTerminalStatus(normalizeRunStatus(response.status))) {
          this.result.set(null);
          this.resultError.set(null);
          this.resultInfo.set('Result not available yet');
          this.resultForRequestId = requestId;
          return;
        }
        this.result.set(response);
        this.resultInfo.set(null);
        this.updateRuntimeError(parseRunRuntimeError(response));
        this.resultForRequestId = requestId;
      });
  }

  private resetResultState(): void {
    this.result.set(null);
    this.resultError.set(null);
    this.resultInfo.set(null);
    this.resultLoading.set(false);
    this.resultForRequestId = null;
    this.terminalMessage.set(null);
    this.runtimeError.set(null);
  }

  private terminalStatusMessage(status: UiRunStatus, response?: RunStatusResponse | null): string | null {
    if (!isTerminalStatus(status)) {
      return null;
    }
    const runtimeError = this.runtimeError();
    const runtimeCode = String(runtimeError?.code ?? '').trim().toLowerCase();
    if (status === 'failed' && runtimeCode === 'not_implemented_feature') {
      return runtimeError?.message?.trim() || NOT_IMPLEMENTED_YET_MESSAGE;
    }
    if (response?.message) {
      return response.message;
    }
    switch (status) {
      case 'succeeded':
        return 'Run termine avec succes.';
      case 'failed':
        return 'Run echoue.';
      case 'canceled':
        return 'Run annule.';
      default:
        return null;
    }
  }

  notImplementedFields(): string[] {
    const runtime = this.runtimeError();
    const runtimeCode = String(runtime?.code ?? '').trim().toLowerCase();
    if (runtimeCode !== 'not_implemented_feature') {
      return [];
    }
    const wiredFields = runtime?.details
      .filter(detail => String(detail.reason ?? '').trim().toLowerCase() === 'accepted_but_not_wired')
      .map(detail => detail.field?.trim())
      .filter((field): field is string => Boolean(field)) ?? [];
    const fallbackFields = runtime?.details
      .map(detail => detail.field?.trim())
      .filter((field): field is string => Boolean(field)) ?? [];
    const fields = wiredFields.length > 0 ? wiredFields : fallbackFields;
    return Array.from(new Set(fields));
  }

  runtimeDetailLines(): string[] {
    const runtime = this.runtimeError();
    if (!runtime?.details?.length) {
      return [];
    }
    return runtime.details
      .map(detail => {
        const field = detail.field?.trim();
        const message = detail.message?.trim();
        const code = detail.code?.trim();
        const reason = detail.reason?.trim();
        if (field && message) {
          return `${field} - ${message}`;
        }
        if (field && reason) {
          return `${field} - ${reason}`;
        }
        if (field && code) {
          return `${field} - ${code}`;
        }
        if (field) {
          return field;
        }
        return message || code || '';
      })
      .filter(Boolean);
  }

  private updateRuntimeError(next: RuntimeRunError | null): void {
    if (!next) {
      return;
    }
    const current = this.runtimeError();
    if (!current) {
      this.runtimeError.set(next);
      return;
    }
    const currentScore = this.runtimeErrorScore(current);
    const nextScore = this.runtimeErrorScore(next);
    if (nextScore >= currentScore) {
      this.runtimeError.set(next);
    }
  }

  private runtimeErrorScore(error: RuntimeRunError): number {
    const detailsScore = error.details.length * 10;
    const messageScore = error.message ? 1 : 0;
    return detailsScore + messageScore;
  }
}
