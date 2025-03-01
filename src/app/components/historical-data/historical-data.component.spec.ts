import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoricalDataComponent } from './historical-data.component';

describe('HistoricalDataComponent', () => {
  let component: HistoricalDataComponent;
  let fixture: ComponentFixture<HistoricalDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoricalDataComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoricalDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
