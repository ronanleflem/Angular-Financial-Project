import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TradeCandlestickChartComponent } from './trade-candlestick-chart.component';
import {
  alignComparedOhlc,
  buildOhlcDataset,
  buildTradeAnnotation,
  mapCandlesToOhlc
} from '../candlestick-chart.utils';

describe('TradeCandlestickChartComponent', () => {
  let component: TradeCandlestickChartComponent;
  let fixture: ComponentFixture<TradeCandlestickChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TradeCandlestickChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TradeCandlestickChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('maps candles to OHLC points', () => {
    const candles = [
      { date: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5 },
      { date: 'invalid-date', open: 10, high: 20, low: 5, close: 15 }
    ];

    const result = mapCandlesToOhlc(candles);

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      x: new Date('2024-01-01T00:00:00Z').getTime(),
      o: 1,
      h: 2,
      l: 0.5,
      c: 1.5
    });
  });

  it('builds trade annotations with entry and exit bounds', () => {
    const trade = { stopLoss: 1.1, takeProfit: 1.4, result: 'win' };
    const entryTime = 1700000000000;
    const exitTime = 1700003600000;

    const annotations = buildTradeAnnotation(trade, entryTime, exitTime);

    expect(annotations.tradeBox.xMin).toBe(entryTime);
    expect(annotations.tradeBox.xMax).toBe(exitTime);
    expect(annotations.tradeBox.yMin).toBe(trade.stopLoss);
    expect(annotations.tradeBox.yMax).toBe(trade.takeProfit);
  });

  it('aligns compared dataset and keeps it distinct', () => {
    const primary = mapCandlesToOhlc([
      { date: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5 },
      { date: '2024-01-01T01:00:00Z', open: 1.1, high: 2.1, low: 0.6, close: 1.6 }
    ]);
    const compared = mapCandlesToOhlc([
      { date: '2024-01-01T00:00:00Z', open: 10, high: 20, low: 5, close: 15 },
      { date: '2024-01-01T02:00:00Z', open: 11, high: 21, low: 6, close: 16 }
    ]);

    const aligned = alignComparedOhlc(primary, compared);
    const dataset = buildOhlcDataset(aligned, 'COMPARED');

    expect(aligned.map((point) => point.x)).toEqual([primary[0].x]);
    expect(dataset.label).toBe('COMPARED');
    expect(dataset.data).toBe(aligned);
  });
});
