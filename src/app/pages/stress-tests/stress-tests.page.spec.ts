import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { StressTestsPageComponent } from './stress-tests.page';
import { StressTestsService } from '../../services/stress-tests.service';
import { StressTestsViewModel } from '../../models/stress-tests.models';

describe('StressTestsPageComponent', () => {
  let component: StressTestsPageComponent;
  let fixture: ComponentFixture<StressTestsPageComponent>;
  let serviceSpy: jasmine.SpyObj<StressTestsService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('StressTestsService', ['getStressTests']);
    const mockData: StressTestsViewModel = {
      meta: { runId: 'run-123', symbol: 'ES' },
      source: 'summary',
    };
    serviceSpy.getStressTests.and.returnValue(of(mockData));

    await TestBed.configureTestingModule({
      imports: [StressTestsPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'runId' ? 'run-123' : null)
              }
            }
          }
        },
        { provide: StressTestsService, useValue: serviceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StressTestsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads stress tests for the run id', () => {
    expect(serviceSpy.getStressTests).toHaveBeenCalledWith('run-123');
    expect(component.state().status).toBe('success');
    expect(component.state().data?.meta?.runId).toBe('run-123');
  });
});
