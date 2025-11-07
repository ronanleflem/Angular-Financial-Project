import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SymbolRef } from '../models/data-catalog.models';
import { DEFAULT_SYMBOLS } from '../mocks/data-catalog.mocks';

@Injectable({ providedIn: 'root' })
export class SymbolService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getAll(): Observable<SymbolRef[]> {
    return this.http.get<SymbolRef[]>(`${this.apiUrl}/api/finance/symbols`).pipe(
      tap(list => console.log('[SymbolService] list symbols', list?.length ?? 0)),
      map(list => (Array.isArray(list) ? list : [])),
      catchError(err => {
        console.warn('[SymbolService] fallback to default symbols', err);
        return of(DEFAULT_SYMBOLS);
      })
    );
  }
}

