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

    const initRunReq = httpMock.expectOne(`${environment.apiUrl}/api/runs`);
    initRunReq.flush({ request_id: 'init-1', status: 'PENDING' });
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
    expect(symbolErrors?.backend?.message).toBe('Symbole requis');
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
});
