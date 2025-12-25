import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { TradeCandlestickChartComponent } from './trade-candlestick-chart.component';
import { TradingDataService } from '../../services/trading-data.service';

class MockTradingDataService {
  getCandlesForTrade = jasmine.createSpy('getCandlesForTrade');
}

describe('TradeCandlestickChartComponent', () => {
  let component: TradeCandlestickChartComponent;
  let fixture: ComponentFixture<TradeCandlestickChartComponent>;
  let tradingDataService: MockTradingDataService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TradeCandlestickChartComponent],
      providers: [{ provide: TradingDataService, useClass: MockTradingDataService }]
    }).compileComponents();

    fixture = TestBed.createComponent(TradeCandlestickChartComponent);
    component = fixture.componentInstance;
    tradingDataService = TestBed.inject(TradingDataService) as unknown as MockTradingDataService;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('mocks TradingDataService and renders distinct datasets for primary and compared', fakeAsync(() => {
    const candles = [
      { date: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5 },
      { date: '2024-01-01T01:00:00Z', open: 1.1, high: 2.1, low: 0.6, close: 1.6 }
    ];
    const comparedCandles = [
      { date: '2024-01-01T00:00:00Z', open: 10, high: 20, low: 5, close: 15 },
      { date: '2024-01-01T02:00:00Z', open: 11, high: 21, low: 6, close: 16 }
    ];
    const trade = {
      entryTimestamp: '2024-01-01T00:00:00Z',
      exitTimestamp: '2024-01-01T02:00:00Z',
      entryDate: '2024-01-01T00:00:00Z',
      exitDate: '2024-01-01T02:00:00Z',
      stopLoss: 1.1,
      takeProfit: 1.4,
      result: 'win'
    };

    tradingDataService.getCandlesForTrade.and.returnValue(
      of({ candles, comparedCandles, trade })
    );

    component.tradeId = 42;
    component.timeframe = '1h';
    component.symbol = 'EURUSD';
    component.comparedSymbol = 'GBPUSD';

    const renderSpy = spyOn(component, 'renderChart');

    component.loadData();
    tick();

    expect(tradingDataService.getCandlesForTrade).toHaveBeenCalledWith(
      42,
      '1h',
      'EURUSD',
      'GBPUSD',
      50,
      50
    );
    expect(renderSpy.calls.count()).toBe(2);

    const primaryArgs = renderSpy.calls.argsFor(0);
    const comparedArgs = renderSpy.calls.argsFor(1);

    expect(primaryArgs[0]).not.toBe(comparedArgs[0]);
    expect(primaryArgs[4]).toBe('Trade #42');
    expect(comparedArgs[4]).toBe('GBPUSD');
    expect(comparedArgs[0].map((point: { x: number }) => point.x)).toEqual([
      new Date('2024-01-01T00:00:00Z').getTime()
    ]);
  }));

  it('enables annotations for entry/exit on the primary chart only', fakeAsync(() => {
    tradingDataService.getCandlesForTrade.and.returnValue(
      of({
        candles: [
          { date: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5 }
        ],
        comparedCandles: [
          { date: '2024-01-01T00:00:00Z', open: 10, high: 20, low: 5, close: 15 }
        ],
        trade: {
          entryTimestamp: '2024-01-01T00:00:00Z',
          exitTimestamp: '2024-01-01T02:00:00Z',
          entryDate: '2024-01-01T00:00:00Z',
          exitDate: '2024-01-01T02:00:00Z',
          stopLoss: 1.1,
          takeProfit: 1.4,
          result: 'win'
        }
      })
    );

    component.tradeId = 1;
    component.timeframe = '1h';
    component.symbol = 'EURUSD';
    component.comparedSymbol = 'GBPUSD';

    const renderSpy = spyOn(component, 'renderChart');

    component.loadData();
    tick();

    const primaryArgs = renderSpy.calls.argsFor(0);
    const comparedArgs = renderSpy.calls.argsFor(1);

    expect(primaryArgs[3]).toBeTrue();
    expect(comparedArgs[3]).toBeFalse();
  }));
});
