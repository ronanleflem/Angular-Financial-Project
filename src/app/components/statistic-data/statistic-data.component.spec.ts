import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatisticDataComponent } from './statistic-data.component';

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
});
