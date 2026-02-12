export type UiRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'unknown';

const STATUS_MAP: Record<string, UiRunStatus> = {
  queued: 'queued',
  pending: 'queued',
  submitted: 'queued',
  running: 'running',
  in_progress: 'running',
  processing: 'running',
  done: 'succeeded',
  completed: 'succeeded',
  success: 'succeeded',
  succeeded: 'succeeded',
  ok: 'succeeded',
  failed: 'failed',
  error: 'failed',
  cancelled: 'canceled',
  canceled: 'canceled',
  aborted: 'canceled',
  stopped: 'canceled'
};

export function normalizeRunStatus(status: string | null | undefined): UiRunStatus {
  if (!status) {
    return 'unknown';
  }
  const normalized = STATUS_MAP[status.trim().toLowerCase()];
  return normalized ?? 'unknown';
}

export function isTerminalStatus(status: UiRunStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

export function formatRunStatusLabel(status: UiRunStatus, rawStatus?: string | null): string {
  if (status === 'unknown') {
    return rawStatus?.trim() ? rawStatus.trim() : 'UNKNOWN';
  }
  return status.toUpperCase();
}
