import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DataCatalogService } from './data-catalog.service';
import { Candle } from '../models/data-catalog.models';

describe('DataCatalogService', () => {
  let service: DataCatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(DataCatalogService);
  });

  it('should compute coverage and gaps for hourly candles', () => {
    const base = Date.parse('2024-01-01T00:00:00Z');
    const candles: Candle[] = [0, 1, 2, 4].map(offset => {
      const time = base + offset * 60 * 60 * 1000;
      const price = 100 + offset;
      return { t: time, o: price, h: price + 1, l: price - 1, c: price + 0.5 };
    });

    const coverage = service.computeCoverage(candles, '1h');

    expect(coverage.count).toBe(4);
    expect(coverage.expected).toBe(5);
    expect(coverage.coveragePct).toBeCloseTo(80, 5);
    expect(coverage.gapsPct).toBeCloseTo(20, 5);
    expect(coverage.start).toBe(new Date(base).toISOString());
    expect(coverage.end).toBe(new Date(base + 4 * 60 * 60 * 1000).toISOString());
  });

  it('should handle empty candle list', () => {
    const coverage = service.computeCoverage([], '1h');
    expect(coverage.count).toBe(0);
    expect(coverage.expected).toBe(0);
    expect(coverage.coveragePct).toBe(0);
    expect(coverage.gapsPct).toBeUndefined();
    expect(coverage.start).toBe('');
    expect(coverage.end).toBe('');
  });
});
