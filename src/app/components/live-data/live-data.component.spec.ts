import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiveDataComponent } from './live-data.component';

describe('LiveDataComponent', () => {
  let component: LiveDataComponent;
  let fixture: ComponentFixture<LiveDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveDataComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LiveDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
