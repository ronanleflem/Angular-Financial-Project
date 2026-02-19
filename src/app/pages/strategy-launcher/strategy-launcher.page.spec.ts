import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { environment } from '../../../environments/environment';
import { StrategyLauncherPageComponent } from './strategy-launcher.page';

describe('StrategyLauncherPageComponent', () => {
  let fixture: ComponentFixture<StrategyLauncherPageComponent>;
  let component: StrategyLauncherPageComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StrategyLauncherPageComponent, HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule]
    });

    fixture = TestBed.createComponent(StrategyLauncherPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushInitRequests() {
    const catalogReq = httpMock.expectOne('/parameter_catalog.json');
    catalogReq.flush({ meta: { version: 'v1' } });
  }

  it('maps backend 422 errors to form controls and global panel', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.submitRun();

    const submitReq = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    submitReq.flush(
      {
        errors: [
          { field: 'data.symbol', code: 'required', message: 'Symbole requis' },
          { field: 'unknown.path', code: 'invalid', message: 'Bad field' }
        ]
      },
      { status: 422, statusText: 'Unprocessable' }
    );

    const symbolErrors = component.dcaForm.get('symbol')?.errors;
    expect(symbolErrors?.['backend']?.message).toBe('Symbole requis');
    expect(component.previewErrors().length).toBe(1);
    expect(component.previewErrors()[0].field).toBe('unknown.path');
  });

  it('shows a global error on submit 409', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.submitRun();

    const submitReq = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    submitReq.flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });

    expect(component.previewErrors().length).toBe(1);
    expect(component.previewErrors()[0].message).toBe('soumission echouee');
  });

  it('shows Not implemented yet markers in backtest unsupported sections', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toMatch(/Backtest \(signal\)[\s\S]*Not implemented yet/);
    expect(text).toMatch(/Dynamic SL[\s\S]*Not implemented yet/);
    expect(text).toMatch(/TP\/SL jitter[\s\S]*Not implemented yet/);
    expect(text).toMatch(/Filter rules[\s\S]*Not implemented yet/);
    expect(text).toMatch(/Screening \/ pruning[\s\S]*Not implemented yet/);
  });

  it('normalizes backend unsupported errors to Not implemented yet', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    component.submitRun();

    const submitReq = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    submitReq.flush(
      {
        errors: [
          {
            field: 'signal.type',
            code: 'not_implemented_feature',
            message: 'Feature not implemented for canonical backtest run'
          },
          {
            field: 'unknown.path',
            code: 'not_implemented_feature',
            message: 'accepted_but_not_wired'
          }
        ]
      },
      { status: 422, statusText: 'Unprocessable' }
    );

    const signalErrors = component.backtestForm.get('signalType')?.errors;
    expect(signalErrors?.['backend']?.message).toBe('Not implemented yet');
    expect(component.previewErrors()[0].message).toBe('Not implemented yet');
  });

  it('does not remap generic unsupported backend errors to Not implemented yet', () => {
    fixture.detectChanges();
    flushInitRequests();

    component.selectRun('backtests');
    component.submitRun();

    const submitReq = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    submitReq.flush(
      {
        errors: [
          {
            field: 'signal.type',
            code: 'unsupported_value',
            message: 'Unsupported signal type'
          }
        ]
      },
      { status: 422, statusText: 'Unprocessable' }
    );

    const signalErrors = component.backtestForm.get('signalType')?.errors;
    expect(signalErrors?.['backend']?.message).toBe('Unsupported signal type');
  });
});
