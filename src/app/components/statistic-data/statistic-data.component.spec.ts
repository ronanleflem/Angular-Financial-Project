import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { buildChartDatasets, StatisticDataComponent } from './statistic-data.component';

describe('StatisticDataComponent', () => {
  let component: StatisticDataComponent;
  let fixture: ComponentFixture<StatisticDataComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, StatisticDataComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatisticDataComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('buildChartDatasets maps labels and timeframes to datasets', () => {
    const statistics = {
      '1h': { bullish: 12, bearish: 4 },
      '4h': { bullish: 8, bearish: 6 }
    };
    const statisticFields = ['bullish', 'bearish'];
    const selectedTimeframes = ['1h', '4h'];

    const result = buildChartDatasets(statistics, statisticFields, selectedTimeframes);

    expect(result.labels).toEqual(['bullish', 'bearish']);
    expect(result.datasets).toHaveSize(2);
    expect(result.datasets[0].label).toBe('1h');
    expect(result.datasets[0].data).toEqual([12, 4]);
    expect(result.datasets[1].label).toBe('4h');
    expect(result.datasets[1].data).toEqual([8, 6]);
  });

  it('buildChartDatasets fills missing or null values with zeros', () => {
    const statistics = {
      '1h': { bullish: 5, bearish: null },
      '4h': { bullish: 2 }
    };
    const statisticFields = ['bullish', 'bearish', 'neutral'];
    const selectedTimeframes = ['1h', '4h'];

    const result = buildChartDatasets(statistics, statisticFields, selectedTimeframes);

    expect(result.datasets).toHaveSize(2);
    expect(result.datasets[0].data).toEqual([5, 0, 0]);
    expect(result.datasets[1].data).toEqual([2, 0, 0]);
  });

  it('shows a fallback message when the statistics request fails', () => {
    const consoleSpy = spyOn(console, 'error');

    component.selectedSymbol = 'EURUSD';
    component.selectedAnalysis = 'bullish-bearish-all';

    expect(() => component.loadStatistics()).not.toThrow();

    const req = httpMock.expectOne('http://localhost:8090/filter/bullish-bearish-stats/all?symbol=EURUSD');
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });

    fixture.detectChanges();
    const errorMessage = fixture.nativeElement.querySelector('.error-message');

    expect(consoleSpy).toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
    expect(errorMessage?.textContent).toContain('Impossible de charger les statistiques');
  });
});
