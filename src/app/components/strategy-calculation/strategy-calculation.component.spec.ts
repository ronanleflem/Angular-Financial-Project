import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { StrategyCalculationComponent } from './strategy-calculation.component';
import { TradingDataService } from '../../services/trading-data.service';

describe('StrategyCalculationComponent', () => {
  let component: StrategyCalculationComponent;
  let fixture: ComponentFixture<StrategyCalculationComponent>;
  let tradingServiceSpy: jasmine.SpyObj<TradingDataService>;

  beforeEach(async () => {
    tradingServiceSpy = jasmine.createSpyObj('TradingDataService', [
      'listStrategies',
      'getCalculationStrategy'
    ]);
    tradingServiceSpy.listStrategies.and.returnValue(of(['Strat-A', 'Strat-B']));

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, StrategyCalculationComponent],
      providers: [{ provide: TradingDataService, useValue: tradingServiceSpy }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StrategyCalculationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty form state', () => {
    expect(component.selectedStrategy).toBe('');
    expect(component.selectedSymbol).toBe('');
    expect(component.selectedComparedSymbol).toBe('');
    expect(component.selectedTimeframe).toBe('');
    expect(component.startDate).toBe('');
    expect(component.endDate).toBe('');
    expect(component.result).toBeNull();
  });

  it('should submit and call the service with expected payload', () => {
    const response = { total: 42, trades: 5 };
    tradingServiceSpy.getCalculationStrategy.and.returnValue(of(response));

    component.selectedStrategy = 'Strat-A';
    component.selectedSymbol = 'ES';
    component.selectedComparedSymbol = 'NQ';
    component.selectedTimeframe = '1h';
    component.startDate = '2024-01-01T10:00';
    component.endDate = '2024-01-02T10:00';

    component.calculateStrategy();

    expect(tradingServiceSpy.getCalculationStrategy).toHaveBeenCalledWith(
      'Strat-A',
      'ES',
      'NQ',
      '1h',
      '2024-01-01T10:00',
      '2024-01-02T10:00'
    );
    expect(component.result).toEqual(response);

    fixture.detectChanges();
    const pre = fixture.debugElement.query(By.css('pre')).nativeElement as HTMLElement;
    expect(pre.textContent).toContain('"total": 42');
    expect(pre.textContent).toContain('"trades": 5');
  });

  it('should handle service errors when calculation fails', () => {
    const error = new Error('Service failure');
    tradingServiceSpy.getCalculationStrategy.and.returnValue(throwError(() => error));
    const consoleSpy = spyOn(console, 'error');

    component.selectedStrategy = 'Strat-A';
    component.selectedSymbol = 'ES';
    component.selectedComparedSymbol = 'NQ';
    component.selectedTimeframe = '1h';
    component.startDate = '2024-01-01T10:00';
    component.endDate = '2024-01-02T10:00';

    component.calculateStrategy();

    expect(consoleSpy).toHaveBeenCalledWith('Erreur lors du calcul de stratégie :', error);
    expect(component.result).toBeNull();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('pre'))).toBeNull();
  });
});
