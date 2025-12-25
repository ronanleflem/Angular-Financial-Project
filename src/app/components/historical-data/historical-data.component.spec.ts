import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { HistoricalDataComponent } from './historical-data.component';
import { TradingDataService } from '../../services/trading-data.service';
import { mapCandlesToOhlc } from '../candlestick-chart.utils';

describe('HistoricalDataComponent', () => {
  let component: HistoricalDataComponent;
  let fixture: ComponentFixture<HistoricalDataComponent>;
  let tradingServiceSpy: jasmine.SpyObj<TradingDataService>;

  beforeEach(async () => {
    tradingServiceSpy = jasmine.createSpyObj<TradingDataService>('TradingDataService', [
      'getSymbols',
      'getHistoricalCandlesTimeframeCME'
    ]);

    await TestBed.configureTestingModule({
      imports: [HistoricalDataComponent, HttpClientTestingModule],
      providers: [{ provide: TradingDataService, useValue: tradingServiceSpy }]
    })
    .compileComponents();
  });

  it('should create', () => {
    tradingServiceSpy.getSymbols.and.returnValue(of([]));
    tradingServiceSpy.getHistoricalCandlesTimeframeCME.and.returnValue(of([]));

    fixture = TestBed.createComponent(HistoricalDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should request candles with updated filters and refresh chart dataset', fakeAsync(() => {
    const initialCandles = [
      { date: '2024-02-08T10:00:00Z', open: 1.1, high: 1.2, low: 1.0, close: 1.15 }
    ];
    const updatedCandles = [
      { date: '2024-02-08T12:00:00Z', open: 1.2, high: 1.25, low: 1.15, close: 1.22 },
      { date: '2024-02-08T13:00:00Z', open: 1.22, high: 1.3, low: 1.2, close: 1.28 }
    ];

    tradingServiceSpy.getSymbols.and.returnValue(of([
      { id: '1', symbol: 'EURUSD', name: 'Euro Dollar', market: 'FX' },
      { id: '2', symbol: 'GBPUSD', name: 'Pound Dollar', market: 'FX' }
    ]));
    tradingServiceSpy.getHistoricalCandlesTimeframeCME.and.returnValues(
      of(initialCandles),
      of(updatedCandles)
    );

    fixture = TestBed.createComponent(HistoricalDataComponent);
    component = fixture.componentInstance;

    spyOn(component, 'createChart').and.callFake(() => {
      component.chart = {
        data: {
          datasets: [{ data: mapCandlesToOhlc(component.candles) }]
        }
      };
    });

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(tradingServiceSpy.getHistoricalCandlesTimeframeCME).toHaveBeenCalledWith('EURUSD', 'M15', '', '');

    const symbolSelect: HTMLSelectElement = fixture.nativeElement.querySelector('#symbol');
    symbolSelect.value = 'GBPUSD';
    symbolSelect.dispatchEvent(new Event('change'));

    const timeframeSelect: HTMLSelectElement = fixture.nativeElement.querySelector('#timeframe');
    timeframeSelect.value = '1min';
    timeframeSelect.dispatchEvent(new Event('change'));

    fixture.detectChanges();

    const loadButton: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    loadButton.click();
    tick();

    expect(tradingServiceSpy.getHistoricalCandlesTimeframeCME).toHaveBeenCalledWith('GBPUSD', '1min', '', '');

    const dataset = component.chart.data.datasets[0].data;
    expect(dataset.length).toBe(2);
    expect(dataset[0]).toEqual(jasmine.objectContaining({
      o: updatedCandles[0].open,
      h: updatedCandles[0].high,
      l: updatedCandles[0].low,
      c: updatedCandles[0].close
    }));
  }));
});
