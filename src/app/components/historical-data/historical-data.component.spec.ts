import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { HistoricalDataComponent } from './historical-data.component';
import { TradingDataService } from '../../services/trading-data.service';

describe('HistoricalDataComponent', () => {
  let component: HistoricalDataComponent;
  let fixture: ComponentFixture<HistoricalDataComponent>;

  let tradingService: jasmine.SpyObj<TradingDataService>;

  beforeEach(async () => {
    tradingService = jasmine.createSpyObj('TradingDataService', [
      'getSymbols',
      'getHistoricalCandlesTimeframeCME'
    ]);
    tradingService.getSymbols.and.returnValue(of([{ id: '1', symbol: 'EURUSD', name: 'Euro', market: 'FX' }]));
    tradingService.getHistoricalCandlesTimeframeCME.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [HistoricalDataComponent],
      providers: [{ provide: TradingDataService, useValue: tradingService }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoricalDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a fallback message when symbol loading fails', () => {
    tradingService.getSymbols.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' }))
    );
    const consoleSpy = spyOn(console, 'error');

    fixture = TestBed.createComponent(HistoricalDataComponent);
    component = fixture.componentInstance;
    expect(() => fixture.detectChanges()).not.toThrow();

    fixture.detectChanges();
    const errorMessage = fixture.nativeElement.querySelector('.error-message');
    expect(consoleSpy).toHaveBeenCalled();
    expect(errorMessage?.textContent).toContain('Impossible de charger les symboles');
  });

  it('shows a fallback message when historical data loading fails', () => {
    tradingService.getSymbols.and.returnValue(of([{ id: '1', symbol: 'EURUSD', name: 'Euro', market: 'FX' }]));
    tradingService.getHistoricalCandlesTimeframeCME.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' }))
    );
    const consoleSpy = spyOn(console, 'error');

    fixture = TestBed.createComponent(HistoricalDataComponent);
    component = fixture.componentInstance;
    expect(() => fixture.detectChanges()).not.toThrow();

    fixture.detectChanges();
    const errorMessage = fixture.nativeElement.querySelector('.error-message');
    expect(consoleSpy).toHaveBeenCalled();
    expect(errorMessage?.textContent).toContain('Impossible de charger les données historiques');
    expect(component.isLoading).toBeFalse();
  });
});
