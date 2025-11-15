import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface UniverseCatalog {
  code: string;
  name: string;
  type: 'CRYPTO' | 'EQUITY' | string;
  provider: string;
  approxSize?: number;
}

export interface UniverseImportRequest {
  code: string;
  broker: string;
  timeframe: string;
  startDate: string; // ISO
  endDate: string; // ISO
  venue?: string;
  assetClass?: string;
}

@Injectable({ providedIn: 'root' })
export class UniverseService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getCatalog(): Observable<UniverseCatalog[]> {
    return this.http.get<UniverseCatalog[]>(`${this.apiUrl}/api/universes/catalog`);
  }

  importUniverse(req: UniverseImportRequest): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/api/universes/import`, req);
  }
}
