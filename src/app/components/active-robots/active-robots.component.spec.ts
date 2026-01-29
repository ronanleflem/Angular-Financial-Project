import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { ActiveRobotsComponent } from './active-robots.component';
import { LiveSignalsService } from '../../services/live-signals.service';
import { LiveSignal } from '../../models/live-signal.model';
import { MarketDataService } from '../../services/market-data.service';

describe('ActiveRobotsComponent', () => {
  let component: ActiveRobotsComponent;
  let fixture: ComponentFixture<ActiveRobotsComponent>;
  let liveSignalsService: jasmine.SpyObj<LiveSignalsService>;
  let marketDataService: jasmine.SpyObj<MarketDataService>;
  let selectedSubject: BehaviorSubject<LiveSignal | null>;
  let signalsSubject: BehaviorSubject<LiveSignal[]>;

  beforeEach(async () => {
    selectedSubject = new BehaviorSubject<LiveSignal | null>(null);
    signalsSubject = new BehaviorSubject<LiveSignal[]>([]);
    liveSignalsService = jasmine.createSpyObj<LiveSignalsService>('LiveSignalsService', ['connect', 'disconnect'], {
      selected$: selectedSubject,
      signals$: signalsSubject
    });
    marketDataService = jasmine.createSpyObj<MarketDataService>('MarketDataService', ['getWindow']);
    marketDataService.getWindow.and.returnValue(of({ bars: [] }));

    const queryParamMapSubject = new BehaviorSubject(convertToParamMap({ broker: 'ibkr' }));

    await TestBed.configureTestingModule({
      imports: [ActiveRobotsComponent],
      providers: [
        { provide: LiveSignalsService, useValue: liveSignalsService },
        { provide: MarketDataService, useValue: marketDataService },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMapSubject.asObservable() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ActiveRobotsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('filters markets and robots by broker and timeframe', () => {
    component.brokerControl.setValue('IBKR');
    component.timeframeControl.setValue('15m');

    expect(component.filteredMarkets.length).toBeGreaterThan(0);
    component.filteredMarkets.forEach(market => {
      expect(market.broker).toBe('IBKR');
      expect(market.timeframe).toBe('15m');
    });

    expect(component.filteredRobots.length).toBeGreaterThan(0);
    component.filteredRobots.forEach(robot => {
      expect(robot.broker).toBe('IBKR');
      expect(robot.timeframes).toContain('15m');
    });
  });

  it('toggles robot active state', () => {
    const robot = component.robots[0];
    const initialState = robot.active;

    component.toggleRobot(robot);

    expect(robot.active).toBe(!initialState);
  });

  it('updates selected signal from LiveSignalsService', () => {
    const signal: LiveSignal = {
      strategyId: 'signal-1',
      symbol: 'EURUSD',
      timeframe: '15m',
      side: 'LONG',
      entryPrice: 1.1,
      tsOpenUtc: new Date().toISOString()
    };

    selectedSubject.next(signal);

    expect(component.selectedSignal).toBe(signal);
  });

  it('disconnects from live signals on destroy', () => {
    component.ngOnDestroy();

    expect(liveSignalsService.disconnect).toHaveBeenCalled();
  });
});
