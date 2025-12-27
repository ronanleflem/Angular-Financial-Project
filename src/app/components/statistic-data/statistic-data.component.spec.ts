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

  it('loads statistics, builds datasets, and renders table rows', () => {
    spyOn(component, 'renderChart');
    component.selectedAnalysis = 'bullish-bearish-multi';
    component.selectedSymbol = 'EURUSD';
    component.selectedTimeframes = ['1h', '4h'];

    component.loadStatistics();

    const req = httpMock.expectOne((request) =>
      request.url === 'http://localhost:8090/filter/bullish-bearish-stats/multi-timeframes'
      && request.params.get('symbol') === 'EURUSD'
      && request.params.get('timeframes') === '1h,4h'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      '1h': { bullish: 12, bearish: 4 },
      '4h': { bullish: 8, bearish: 6 }
    });

    fixture.detectChanges();

    const datasetPayload = buildChartDatasets(
      component.statistics,
      component.statisticFields,
      component.selectedTimeframes
    );

    expect(datasetPayload.labels).toEqual(['bullish', 'bearish']);
    expect(datasetPayload.datasets).toHaveSize(2);
    expect(datasetPayload.datasets[0].data).toEqual([12, 4]);
    expect(datasetPayload.datasets[1].data).toEqual([8, 6]);

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('shows fallback message when statistics request fails', () => {
    component.selectedAnalysis = 'bullish-bearish-multi';
    component.selectedSymbol = 'EURUSD';
    component.selectedTimeframes = ['1h'];

    component.loadStatistics();

    const req = httpMock.expectOne((request) =>
      request.url === 'http://localhost:8090/filter/bullish-bearish-stats/multi-timeframes'
      && request.params.get('symbol') === 'EURUSD'
      && request.params.get('timeframes') === '1h'
    );

    req.flush('Not found', { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const errorMessage = fixture.nativeElement.querySelector('.error');
    expect(component.errorMessage).toBe('Erreur lors du chargement des statistiques.');
    expect(errorMessage?.textContent).toContain('Erreur lors du chargement des statistiques.');
  });
});
