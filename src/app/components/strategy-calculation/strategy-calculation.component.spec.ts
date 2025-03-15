import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StrategyCalculationComponent } from './strategy-calculation.component';

describe('StrategyCalculationComponent', () => {
  let component: StrategyCalculationComponent;
  let fixture: ComponentFixture<StrategyCalculationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrategyCalculationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StrategyCalculationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
