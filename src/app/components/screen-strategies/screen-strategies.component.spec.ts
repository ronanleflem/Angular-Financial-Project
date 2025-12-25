import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { TradingDataService } from '../../services/trading-data.service';
import { ScreenStrategiesComponent } from './screen-strategies.component';

describe('ScreenStrategiesComponent', () => {
  let component: ScreenStrategiesComponent;
  let fixture: ComponentFixture<ScreenStrategiesComponent>;
  let tradingDataServiceSpy: jasmine.SpyObj<TradingDataService>;

  beforeEach(async () => {
    tradingDataServiceSpy = jasmine.createSpyObj('TradingDataService', ['getAllCalculatedStrategies']);
    tradingDataServiceSpy.getAllCalculatedStrategies.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ScreenStrategiesComponent, RouterTestingModule],
      providers: [{ provide: TradingDataService, useValue: tradingDataServiceSpy }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScreenStrategiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('navigates to strategy detail with route params when clicking go', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    component.strategies = [
      {
        name: 'Breakout 1',
        runId: 'run-123',
        symbol: 'EUR/USD'
      }
    ];

    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/strategy-detail', 'Breakout 1', 'run-123', 'EUR/USD', 'none'],
      { state: { strategy: component.strategies[0] } }
    );
  });
});
