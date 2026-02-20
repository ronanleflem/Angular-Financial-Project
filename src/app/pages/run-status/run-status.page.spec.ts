import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { environment } from '../../../environments/environment';
import { RunStatusPageComponent } from './run-status.page';

describe('RunStatusPageComponent', () => {
  let fixture: ComponentFixture<RunStatusPageComponent>;
  let component: RunStatusPageComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RunStatusPageComponent, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ requestId: 'run-1' })) }
        }
      ]
    });

    fixture = TestBed.createComponent(RunStatusPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('stops polling on terminal status and loads result', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    const statusReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1`);
    statusReq.flush({ run_id: 'run-1', status: 'FAILED' });

    const resultReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1/result`);
    resultReq.flush({ run_id: 'run-1', result: { error: 'boom' } });

    expect(component.uiStatus()).toBe('failed');
    expect(component.polling()).toBeFalse();
    expect(component.result()).toEqual(jasmine.objectContaining({ runId: 'run-1' }));
  }));

  it('handles lifecycle QUEUED -> RUNNING -> SUCCEEDED', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    const queuedReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1`);
    queuedReq.flush({ run_id: 'run-1', request_id: 'run-1', status: 'QUEUED' });
    expect(component.uiStatus()).toBe('queued');
    expect(component.polling()).toBeTrue();

    tick(5000);
    const runningReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1`);
    runningReq.flush({ run_id: 'run-1', request_id: 'run-1', status: 'RUNNING' });
    expect(component.uiStatus()).toBe('running');

    tick(5000);
    const successReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1`);
    successReq.flush({ run_id: 'run-1', request_id: 'run-1', status: 'SUCCEEDED' });

    const resultReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1/result`);
    resultReq.flush({ run_id: 'run-1', request_id: 'run-1', status: 'SUCCEEDED', result: { ok: true } });

    expect(component.uiStatus()).toBe('succeeded');
    expect(component.polling()).toBeFalse();
    expect(component.result()?.result).toEqual({ ok: true });
    expect(component.status()?.runId).toBe('run-1');
    expect(component.status()?.requestId).toBe('run-1');
  }));

  it('shows non-blocking info when /result is not terminal yet', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    const statusReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1`);
    statusReq.flush({ run_id: 'run-1', status: 'SUCCEEDED' });

    const resultReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1/result`);
    resultReq.flush({ run_id: 'run-1', status: 'RUNNING' });

    fixture.detectChanges();
    expect(component.result()).toBeNull();
    expect(component.resultError()).toBeNull();
    expect(component.resultInfo()).toBe('Result not available yet');
  }));

  it('handles cancel 200 idempotent path', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    const initialReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1`);
    initialReq.flush({ run_id: 'run-1', status: 'RUNNING' });

    component.cancelRun();

    const cancelReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1/cancel`);
    cancelReq.flush({ run_id: 'run-1', request_id: 'run-1', status: 'CANCELED' });

    const resultReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1/result`);
    resultReq.flush({ run_id: 'run-1', status: 'CANCELED', result: { canceled: true } });

    expect(component.uiStatus()).toBe('canceled');
    expect(component.infoMessage()).toBe('Cancel accepte.');
    expect(component.errorMessage()).toBeNull();
  }));

  it('handles cancel 409 by refreshing status', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    const initialReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1`);
    initialReq.flush({ run_id: 'run-1', status: 'RUNNING' });

    component.cancelRun();

    const cancelReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1/cancel`);
    cancelReq.flush({ message: 'Already terminal' }, { status: 409, statusText: 'Conflict' });

    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1`);
    refreshReq.flush({ run_id: 'run-1', status: 'CANCELED' });

    const resultReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1/result`);
    resultReq.flush({ run_id: 'run-1', result: { canceled: true } });

    expect(component.errorMessage()).toBeNull();
    expect(component.infoMessage()).toContain('already_finished');
    expect(component.uiStatus()).toBe('canceled');
  }));

  it('shows not implemented runtime details on failed runs', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    const statusReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1`);
    statusReq.flush({
      run_id: 'run-1',
      status: 'FAILED',
      error: {
        code: 'not_implemented_feature',
        message: 'Feature not wired',
        details: [
          { field: 'signal.type', reason: 'accepted_but_not_wired', message: 'not wired' },
          { field: 'strategy.params.tp_sl', reason: 'accepted_but_not_wired', message: 'not wired' }
        ]
      }
    });

    const resultReq = httpMock.expectOne(`${environment.apiUrl}/api/runs/run-1/result`);
    resultReq.flush({ run_id: 'run-1', result: { error: { code: 'not_implemented_feature' } } });

    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.terminalMessage()).toBe('Feature not wired');
    expect(component.notImplementedFields()).toEqual(['signal.type', 'strategy.params.tp_sl']);
    expect(text).toContain('Champs non cables');
    expect(text).toContain('signal.type');
    expect(text).toContain('strategy.params.tp_sl');
  }));
});
