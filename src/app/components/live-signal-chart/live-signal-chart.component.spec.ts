import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef, SimpleChange } from '@angular/core';
import { Observable, of } from 'rxjs';
import { LiveSignalChartComponent } from './live-signal-chart.component';
import { MarketDataService } from '../../services/market-data.service';
import { LiveSignal } from '../../models/live-signal.model';

class MockMarketDataService {
  getWindow = jasmine.createSpy('getWindow');
}

describe('LiveSignalChartComponent', () => {
  let component: LiveSignalChartComponent;
  let fixture: ComponentFixture<LiveSignalChartComponent>;
  let marketDataService: MockMarketDataService;
  let seriesApi: { setData: jasmine.Spy; setMarkers: jasmine.Spy };
  let chartApi: {
    addCandlestickSeries: jasmine.Spy;
    remove: jasmine.Spy;
    timeScale: jasmine.Spy;
  };

  const buildSignal = (): LiveSignal => ({
    strategyId: 'strat-1',
    symbol: 'EURUSD',
    timeframe: '1h',
    tsOpenUtc: '2024-01-01T00:00:00Z',
    side: 'LONG',
    entryPrice: 1.2345,
    payload: {
      exitTsUtc: '2024-01-01T01:00:00Z'
    }
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveSignalChartComponent],
      providers: [{ provide: MarketDataService, useClass: MockMarketDataService }]
    }).compileComponents();

    seriesApi = {
      setData: jasmine.createSpy('setData'),
      setMarkers: jasmine.createSpy('setMarkers')
    };

    chartApi = {
      addCandlestickSeries: jasmine.createSpy('addCandlestickSeries').and.returnValue(seriesApi),
      remove: jasmine.createSpy('remove'),
      timeScale: jasmine.createSpy('timeScale').and.returnValue({
        fitContent: jasmine.createSpy('fitContent')
      })
    };

    spyOn(LiveSignalChartComponent.prototype as any, 'createChartInstance').and.returnValue(chartApi as never);

    fixture = TestBed.createComponent(LiveSignalChartComponent);
    component = fixture.componentInstance;
    marketDataService = TestBed.inject(MarketDataService) as unknown as MockMarketDataService;
  });

  it('initializes the chart on ngAfterViewInit', () => {
    marketDataService.getWindow.and.returnValue(of({ bars: [] }));
    component.signal = buildSignal();

    fixture.detectChanges();

    expect((LiveSignalChartComponent.prototype as any).createChartInstance).toHaveBeenCalled();
    expect(chartApi.addCandlestickSeries).toHaveBeenCalled();
  });

  it('updates when signal input changes', () => {
    marketDataService.getWindow.and.returnValue(
      of({
        bars: [
          {
            tsUtc: '2024-01-01T00:00:00Z',
            open: 1,
            high: 2,
            low: 0.5,
            close: 1.5
          }
        ]
      })
    );

    fixture.detectChanges();

    const nextSignal = buildSignal();
    component.signal = nextSignal;
    component.ngOnChanges({
      signal: new SimpleChange(null, nextSignal, false)
    });

    expect(marketDataService.getWindow).toHaveBeenCalled();
    expect(seriesApi.setData).toHaveBeenCalled();
    expect(seriesApi.setMarkers).toHaveBeenCalled();
  });

  it('cleans up subscriptions and chart on destroy', () => {
    let unsubscribed = false;
    marketDataService.getWindow.and.returnValue(
      new Observable(() => () => {
        unsubscribed = true;
      })
    );
    component.signal = buildSignal();
    const container = document.createElement('div');
    container.style.width = '640px';
    container.style.height = '320px';
    component.chartContainer = new ElementRef(container);
    component.ngAfterViewInit();

    component.ngOnDestroy();

    expect(unsubscribed).toBeTrue();
    expect(chartApi.remove).toHaveBeenCalled();
  });
});
