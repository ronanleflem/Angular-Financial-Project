import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { LiveDataComponent } from './live-data.component';
import { MarketDataService } from '../../services/market-data.service';
import { StartBarsResponse, TradeView } from '../../models/trading.models';

class MarketDataServiceStub {
  connectWait = jasmine.createSpy('connectWait').and.returnValue(of({ connected: true }));
  setMarketDataType = jasmine.createSpy('setMarketDataType').and.returnValue(of({ ok: true, marketDataType: 3 }));
  startLiveBars = jasmine.createSpy('startLiveBars').and.callFake(() =>
    of({ reqId: 1, pair: 'EURUSD', duration: '1 D', barSize: '1 min', what: 'MIDPOINT', rth: 0, formatDate: 2 } satisfies StartBarsResponse)
  );
  getLiveBars = jasmine.createSpy('getLiveBars').and.returnValue(of([]));
  getLastLiveBar = jasmine.createSpy('getLastLiveBar').and.returnValue(of(null));
  stopLiveBars = jasmine.createSpy('stopLiveBars').and.returnValue(of({ reqId: 1, stopped: true }));
  listTrades = jasmine.createSpy('listTrades').and.returnValue(of([] as TradeView[]));
}

describe('LiveDataComponent', () => {
  let component: LiveDataComponent;
  let fixture: ComponentFixture<LiveDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveDataComponent],
      providers: [{ provide: MarketDataService, useClass: MarketDataServiceStub }]
    }).compileComponents();

    fixture = TestBed.createComponent(LiveDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
