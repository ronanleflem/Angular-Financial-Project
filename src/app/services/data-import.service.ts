import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import {
  DataImportJob,
  DataImportJobRequest,
  DataImportJobStatus,
} from '../models/data-catalog.models';

@Injectable({ providedIn: 'root' })
export class DataImportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  createJob(request: DataImportJobRequest): Observable<DataImportJob> {
    return this.http.post<DataImportJob>(`${this.apiUrl}/api/data-import/jobs`, request).pipe(
      map(response => this.normalizeJob(response)),
      catchError(err => {
        console.error('[DataImportService] createJob failed', err);
        return throwError(() => err);
      })
    );
  }

  getJob(id: string): Observable<DataImportJob> {
    return this.http
      .get<DataImportJob>(`${this.apiUrl}/api/data-import/jobs/${id}`)
      .pipe(map(response => this.normalizeJob(response)));
  }

  private normalizeJob(job: DataImportJob): DataImportJob {
    const ensureIso = (value?: string) => {
      if (!value) {
        return value;
      }
      const ms = new Date(value).getTime();
      return Number.isNaN(ms) ? value : new Date(ms).toISOString();
    };

    return {
      ...job,
      startDate: ensureIso(job.startDate) ?? '',
      endDate: ensureIso(job.endDate) ?? '',
      createdAt: ensureIso(job.createdAt),
      updatedAt: ensureIso(job.updatedAt),
      status: this.normalizeStatus(job.status),
      progress: job.progress ?? 0,
    };
  }

  private normalizeStatus(status?: string): DataImportJobStatus {
    const normalized = (status ?? '').toUpperCase();
    switch (normalized) {
      case 'PENDING':
      case 'RUNNING':
      case 'COMPLETED':
      case 'FAILED':
      case 'CANCELLED':
        return normalized;
      default:
        return 'UNKNOWN';
    }
  }
}
