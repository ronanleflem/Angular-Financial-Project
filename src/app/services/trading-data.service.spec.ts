import { TestBed } from '@angular/core/testing';

import { TradingDataService } from './trading-data.service';

describe('TradingDataService', () => {
  let service: TradingDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TradingDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
