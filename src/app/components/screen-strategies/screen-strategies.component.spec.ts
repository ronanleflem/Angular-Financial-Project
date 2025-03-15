import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScreenStrategiesComponent } from './screen-strategies.component';

describe('ScreenStrategiesComponent', () => {
  let component: ScreenStrategiesComponent;
  let fixture: ComponentFixture<ScreenStrategiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScreenStrategiesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScreenStrategiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
