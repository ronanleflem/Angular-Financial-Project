import { ComponentFixture, TestBed } from '@angular/core/testing';

import { buildChartDatasets, StatisticDataComponent } from './statistic-data.component';

describe('StatisticDataComponent', () => {
  let component: StatisticDataComponent;
  let fixture: ComponentFixture<StatisticDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticDataComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StatisticDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
});
