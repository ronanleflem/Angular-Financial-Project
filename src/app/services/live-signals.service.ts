import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { LiveSignal } from '../models/live-signal.model';

const MAX_SIGNAL_BUFFER = 200;

@Injectable({
  providedIn: 'root'
})
export class LiveSignalsService {
  private readonly baseUrl = environment.apiBaseUrl ?? environment.apiUrl ?? '';

  private readonly signalsSubject = new BehaviorSubject<LiveSignal[]>([]);
  readonly signals$ = this.signalsSubject;

  private readonly selectedSubject = new BehaviorSubject<LiveSignal | null>(null);
  readonly selected$ = this.selectedSubject.asObservable();

  private eventSource?: EventSource;

  constructor(private readonly zone: NgZone) {}

  connect(path = '/live/stream'): void {
    if (this.eventSource) {
      return;
    }

    const url = this.normalizeUrl(path);

    this.zone.runOutsideAngular(() => {
      this.eventSource = new EventSource(url);

      this.eventSource.onmessage = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as LiveSignal;
          this.zone.run(() => this.pushSignal(payload));
        } catch (error) {
          console.error('Failed to parse live signal event', error);
        }
      };

      this.eventSource.onerror = (error: Event) => {
        console.error('Live signal stream error', error);
      };
    });
  }

  disconnect(): void {
    this.closeStream();
    this.signalsSubject.next([]);
    this.selectedSubject.next(null);
  }

  select(signal: LiveSignal | null): void {
    this.selectedSubject.next(signal);
  }

  private pushSignal(signal: LiveSignal): void {
    const buffer = [...this.signalsSubject.value, signal];
    if (buffer.length > MAX_SIGNAL_BUFFER) {
      buffer.splice(0, buffer.length - MAX_SIGNAL_BUFFER);
    }
    this.signalsSubject.next(buffer);

    if (!this.selectedSubject.value) {
      this.selectedSubject.next(signal);
    }
  }

  private closeStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }

  private normalizeUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    if (this.baseUrl) {
      return `${this.baseUrl}${path}`;
    }
    return path;
  }
}
