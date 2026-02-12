import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { RunRequestInput } from '../models/run-request-input.model';

export interface RunSubmitResponse {
  requestId: string;
}

export interface RunStatusResponse {
  requestId: string;
  status: 'PENDING' | 'RUNNING' | 'FAILED' | 'DONE';
  updatedAt?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class RunsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  submitRun(payload: RunRequestInput) {
    return this.http.post<RunSubmitResponse>(`${this.apiUrl}/api/runs`, payload);
  }

  getRunStatus(requestId: string) {
    return this.http.get<RunStatusResponse>(`${this.apiUrl}/api/runs/${requestId}`);
  }
}
