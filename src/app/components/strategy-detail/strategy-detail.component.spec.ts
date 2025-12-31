import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { TradingDataService } from '../../services/trading-data.service';
import { StrategyDetailComponent } from './strategy-detail.component';

describe('StrategyDetailComponent', () => {
  let component: StrategyDetailComponent;
  let fixture: ComponentFixture<StrategyDetailComponent>;
  let tradingDataServiceSpy: jasmine.SpyObj<TradingDataService>;

  beforeEach(async () => {
    tradingDataServiceSpy = jasmine.createSpyObj('TradingDataService', [
      'getAllCalculatedStrategies',
      'getTradesByStrategyName'
    ]);
    tradingDataServiceSpy.getAllCalculatedStrategies.and.returnValue(of([
      {
        runId: 'run-123',
        name: 'Breakout 1',
        symbol: 'EUR/USD',
        comparedSymbol: 'GBP/USD'
      }
    ]));
    tradingDataServiceSpy.getTradesByStrategyName.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [StrategyDetailComponent, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => {
                  const params: Record<string, string> = {
                    name: 'Breakout 1',
                    runId: 'run-123',
                    symbol: 'EUR/USD',
                    comparedSymbol: 'GBP/USD'
                  };
                  return params[key] ?? null;
                }
              }
            }
          }
        },
        { provide: TradingDataService, useValue: tradingDataServiceSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StrategyDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads strategy data from route params', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'getCurrentNavigation').and.returnValue(null as never);

    component.loadStrategy();

    expect(tradingDataServiceSpy.getAllCalculatedStrategies).toHaveBeenCalled();
    expect(tradingDataServiceSpy.getTradesByStrategyName).toHaveBeenCalledWith('Breakout 1', 'run-123');
    expect(component.symbol).toBe('EUR/USD');
    expect(component.comparedSymbol).toBe('GBP/USD');
    expect(component.strategy).toEqual(
      jasmine.objectContaining({
        name: 'Breakout 1',
        runId: 'run-123',
        symbol: 'EUR/USD',
        comparedSymbol: 'GBP/USD'
      })
    );
  });

  it('uses fallback strategy data when no strategy is found', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'getCurrentNavigation').and.returnValue(null as never);
    tradingDataServiceSpy.getAllCalculatedStrategies.and.returnValue(of([]));

    component.loadStrategy();

    expect(component.strategy).toEqual({
      name: 'Breakout 1',
      symbol: 'EUR/USD',
      comparedSymbol: 'GBP/USD'
    });
    expect(component.trades.length).toBe(0);
  });

  it('falls back to mock trades when trades loading fails', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'getCurrentNavigation').and.returnValue(null as never);
    tradingDataServiceSpy.getTradesByStrategyName.and.returnValue(
      throwError(() => new Error('Service failure'))
    );
    const mockTradesSpy = spyOn(component, 'getMockTrades').and.callThrough();

    component.loadStrategy();

    expect(mockTradesSpy).toHaveBeenCalled();
    expect(component.trades.length).toBe(3);
    expect(component.trades[0].id).toBe(1);
  });
});
