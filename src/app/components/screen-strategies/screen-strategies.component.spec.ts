import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

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

  it('renders the strategies table after loading strategies', () => {
    tradingDataServiceSpy.getAllCalculatedStrategies.and.returnValue(of([
      {
        runId: 'run-456',
        name: 'Backend Strategy',
        symbol: 'EUR/USD',
        winCount: 4,
        lossCount: 1
      }
    ]));

    component.selectedSymbol = 'EUR/USD';
    component.loadStrategies();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('table.strategy-table tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('filters strategies by the selected symbol', () => {
    component.selectedSymbol = 'NAS100';
    component.loadStrategies();
    fixture.detectChanges();

    const symbolCells = Array.from(
      fixture.nativeElement.querySelectorAll('table.strategy-table tbody tr td:nth-child(3)') as NodeListOf<HTMLElement>
    ).map(cell => cell.textContent?.trim());

    expect(symbolCells.length).toBeGreaterThan(0);
    expect(symbolCells.every(symbol => symbol === 'NAS100')).toBeTrue();
  });

  it('shows an error message when the service fails', () => {
    tradingDataServiceSpy.getAllCalculatedStrategies.and.returnValue(
      throwError(() => new Error('Service error'))
    );

    component.selectedSymbol = 'EUR/USD';
    component.loadStrategies();
    fixture.detectChanges();

    const errorMessage = fixture.nativeElement.querySelector('.error-message');
    expect(errorMessage?.textContent).toContain('Erreur lors du chargement des stratégies.');
  });
});
