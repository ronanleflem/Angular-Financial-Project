export interface HistBar {
  // IBKR avec formatDate=2 renvoie en général epoch (secondes). On gère ms/sec/ISO.
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export function toEpochMs(t: number | string): number {
  if (typeof t === 'number') {
    // Heuristique: si < 10^12 → secondes -> ms.
    return t < 1_000_000_000_000 ? t * 1000 : t;
  }
  // string ISO ou epoch string
  const n = Number(t);
  if (!Number.isNaN(n)) {
    return n < 1_000_000_000_000 ? n * 1000 : n;
  }
  const d = new Date(t).getTime();
  return Number.isNaN(d) ? Date.now() : d;
}

export function toFinancialPoint(b: HistBar) {
  const ts = toEpochMs(b.time);
  return { t: new Date(ts), o: b.open, h: b.high, l: b.low, c: b.close };
}
