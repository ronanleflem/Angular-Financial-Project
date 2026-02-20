import { formatRunStatusLabel, isTerminalStatus, normalizeRunStatus } from './run-status';

describe('run-status utils', () => {
  it('normalizes legacy backend statuses', () => {
    expect(normalizeRunStatus('PENDING')).toBe('queued');
    expect(normalizeRunStatus('RUNNING')).toBe('running');
    expect(normalizeRunStatus('DONE')).toBe('succeeded');
    expect(normalizeRunStatus('FAILED')).toBe('failed');
  });

  it('normalizes extended backend statuses', () => {
    expect(normalizeRunStatus('QUEUED')).toBe('queued');
    expect(normalizeRunStatus('SUCCEEDED')).toBe('succeeded');
    expect(normalizeRunStatus('COMPLETED')).toBe('succeeded');
    expect(normalizeRunStatus('CANCELED')).toBe('canceled');
    expect(normalizeRunStatus('ABORTED')).toBe('canceled');
  });

  it('detects terminal statuses', () => {
    expect(isTerminalStatus('succeeded')).toBeTrue();
    expect(isTerminalStatus('failed')).toBeTrue();
    expect(isTerminalStatus('canceled')).toBeTrue();
    expect(isTerminalStatus('running')).toBeFalse();
  });

  it('formats status labels', () => {
    expect(formatRunStatusLabel('queued')).toBe('QUEUED');
    expect(formatRunStatusLabel('unknown', 'WAITING')).toBe('WAITING');
  });
});
