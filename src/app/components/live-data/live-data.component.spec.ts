import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { LiveDataComponent } from './live-data.component';
import { MarketDataService } from '../../services/market-data.service';
import { HistBar, StartBarsResponse, TradeView } from '../../models/trading.models';

describe('LiveDataComponent', () => {
  let component: LiveDataComponent;
  let fixture: ComponentFixture<LiveDataComponent>;
  let marketDataService: jasmine.SpyObj<MarketDataService>;
  let chartStubPrimary: { data: { datasets: Array<{ data: unknown[] }> }; update: jasmine.Spy; destroy: jasmine.Spy };
  let chartStubSecondary: { data: { datasets: Array<{ data: unknown[] }> }; update: jasmine.Spy; destroy: jasmine.Spy };

  beforeEach(async () => {
    marketDataService = jasmine.createSpyObj('MarketDataService', [
      'connectWait',
      'setMarketDataType',
      'startLiveBars',
      'getLiveBars',
      'getLastLiveBar',
      'stopLiveBars',
      'listTrades',
      'getPortfolioSnapshots'
    ]);

    marketDataService.connectWait.and.returnValue(of({ connected: true }));
    marketDataService.setMarketDataType.and.returnValue(of({ ok: true, marketDataType: 3 }));
    marketDataService.startLiveBars.and.returnValue(
      of({
        reqId: 1,
        pair: 'EURUSD',
        duration: '1 D',
        barSize: '1 min',
        what: 'MIDPOINT',
        rth: 0,
        formatDate: 2
      } satisfies StartBarsResponse)
    );
    marketDataService.getLiveBars.and.returnValue(of([]));
    marketDataService.getLastLiveBar.and.returnValue(of(null));
    marketDataService.stopLiveBars.and.returnValue(of({ reqId: 1, stopped: true }));
    marketDataService.listTrades.and.returnValue(of([] as TradeView[]));
    marketDataService.getPortfolioSnapshots.and.returnValue(of([]));

    spyOn<any>(LiveDataComponent.prototype, 'initializeCharts').and.stub();

    await TestBed.configureTestingModule({
      imports: [LiveDataComponent],
      providers: [{ provide: MarketDataService, useValue: marketDataService }]
    }).compileComponents();

    fixture = TestBed.createComponent(LiveDataComponent);
    component = fixture.componentInstance;
    chartStubPrimary = {
      data: { datasets: [{ data: [] }] },
      update: jasmine.createSpy('update'),
      destroy: jasmine.createSpy('destroy')
    };
    chartStubSecondary = {
      data: { datasets: [{ data: [] }] },
      update: jasmine.createSpy('update'),
      destroy: jasmine.createSpy('destroy')
    };
    (component as any).charts = [chartStubPrimary, chartStubSecondary];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start live bars from the UI and update the dataset', fakeAsync(() => {
    const connectButton = getButtonByLabel('Connect & Wait');
    connectButton.click();
    fixture.detectChanges();

    const bars: HistBar[] = [
      { tsMillis: 1000, open: 1, high: 2, low: 0.5, close: 1.5 },
      { tsMillis: 2000, open: 1.5, high: 2.5, low: 1, close: 2 }
    ] as HistBar[];
    marketDataService.getLiveBars.and.returnValue(of(bars));

    const startButton = getButtonByLabel('Start Live Bars');
    startButton.click();
    tick();
    fixture.detectChanges();

    const panel = component.panels[0];
    expect(panel.reqId).toBe(1);
    expect(panel.bars.length).toBe(2);
    expect(chartStubPrimary.data.datasets[0].data.length).toBe(2);
    expect(chartStubPrimary.update).toHaveBeenCalled();
  }));

  it('should stop live bars and prevent further updates', fakeAsync(() => {
    const connectButton = getButtonByLabel('Connect & Wait');
    connectButton.click();
    fixture.detectChanges();

    const bars: HistBar[] = [
      { tsMillis: 1000, open: 1, high: 2, low: 0.5, close: 1.5 }
    ] as HistBar[];
    marketDataService.getLiveBars.and.returnValue(of(bars));

    const startButton = getButtonByLabel('Start Live Bars');
    startButton.click();
    tick();
    fixture.detectChanges();

    const initialCalls = marketDataService.getLiveBars.calls.count();

    const stopButton = getButtonByLabel('Stop Live Bars');
    stopButton.click();
    tick();
    fixture.detectChanges();

    tick(4000);
    fixture.detectChanges();

    const panel = component.panels[0];
    expect(panel.reqId).toBeNull();
    expect(panel.bars.length).toBe(0);
    expect(marketDataService.getLiveBars.calls.count()).toBe(initialCalls);
  }));

  function getButtonByLabel(label: string): HTMLButtonElement {
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const match = buttons.find(button => button.nativeElement.textContent?.trim() === label);
    if (!match) {
      throw new Error(`Button with label "${label}" not found.`);
    }
    return match.nativeElement as HTMLButtonElement;
  }
});
