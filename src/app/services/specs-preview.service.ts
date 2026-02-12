import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { RunRequestInput } from '../models/run-request-input.model';

export interface SpecPreviewResponse {
  spec: unknown;
  warnings?: string[];
}

@Injectable({ providedIn: 'root' })
export class SpecsPreviewService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  previewSpec(payload: RunRequestInput): Observable<SpecPreviewResponse> {
    return this.http.post<SpecPreviewResponse>(`${this.apiUrl}/api/specs/preview`, payload);
  }
}
