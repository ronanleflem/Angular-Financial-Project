import { TestBed } from '@angular/core/testing';
import { skip, take } from 'rxjs/operators';
import { LiveSignalsService } from './live-signals.service';
import { LiveSignal } from '../models/live-signal.model';

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = jasmine.createSpy('close');

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  emitMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  emitError(error: Event): void {
    this.onerror?.(error);
  }
}

describe('LiveSignalsService', () => {
  let service: LiveSignalsService;
  let originalEventSource: typeof EventSource | undefined;

  beforeEach(() => {
    originalEventSource = (globalThis as { EventSource?: typeof EventSource }).EventSource;
    (globalThis as { EventSource?: typeof EventSource }).EventSource = MockEventSource as unknown as typeof EventSource;

    MockEventSource.instances = [];
    TestBed.configureTestingModule({});
    service = TestBed.inject(LiveSignalsService);
  });

  afterEach(() => {
    (globalThis as { EventSource?: typeof EventSource }).EventSource = originalEventSource;
  });

  it('should create EventSource and parse JSON payloads', () => {
    service.connect('/live/stream');

    expect(MockEventSource.instances.length).toBe(1);
    const instance = MockEventSource.instances[0];
    expect(instance.url).toContain('/live/stream');

    const signal = createSignal('signal-1');
    instance.emitMessage(JSON.stringify(signal));

    const signalsSubject = service.signals$;
    expect(signalsSubject.value).toEqual([signal]);
  });

  it('should keep a maximum buffer of 200 signals', () => {
    service.connect();
    const instance = MockEventSource.instances[0];

    for (let index = 0; index < 205; index += 1) {
      instance.emitMessage(JSON.stringify(createSignal(`signal-${index}`)));
    }

    const signalsSubject = service.signals$;
    expect(signalsSubject.value.length).toBe(200);
    expect(signalsSubject.value[0].strategyId).toBe('signal-5');
    expect(signalsSubject.value[199].strategyId).toBe('signal-204');
  });

  it('should update selected$ on select', () => {
    const signal = createSignal('signal-selected');
    let selected: LiveSignal | null = null;

    service.selected$.pipe(skip(1), take(1)).subscribe(value => {
      selected = value;
    });

    service.select(signal);

    if (!selected) {
      fail('Expected selected signal to be set');
      return;
    }

    expect(selected).toEqual(signal);
  });

  it('should close the stream and reset on disconnect', () => {
    service.connect();
    const instance = MockEventSource.instances[0];
    instance.emitMessage(JSON.stringify(createSignal('signal-1')));
    service.select(createSignal('signal-selected'));

    service.disconnect();

    expect(instance.close).toHaveBeenCalled();
    expect(service.signals$.value).toEqual([]);

    let selected: LiveSignal | null = null;
    service.selected$.pipe(take(1)).subscribe(value => {
      selected = value;
    });
    expect(selected).toBeNull();
  });

  it('should log parsing errors for invalid JSON', () => {
    const consoleSpy = spyOn(console, 'error');

    service.connect();
    const instance = MockEventSource.instances[0];
    instance.emitMessage('not-json');

    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse live signal event', jasmine.any(SyntaxError));
  });

  it('should log errors from the stream', () => {
    const consoleSpy = spyOn(console, 'error');

    service.connect();
    const instance = MockEventSource.instances[0];
    const error = new Event('error');
    instance.emitError(error);

    expect(consoleSpy).toHaveBeenCalledWith('Live signal stream error', error);
  });
});

function createSignal(strategyId: string): LiveSignal {
  return {
    strategyId,
    symbol: 'EURUSD',
    timeframe: '1m',
    tsOpenUtc: new Date().toISOString(),
    side: 'LONG',
    entryPrice: 1.2345,
  };
}
