import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TradeCandlestickChartComponent } from './trade-candlestick-chart.component';

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
});
