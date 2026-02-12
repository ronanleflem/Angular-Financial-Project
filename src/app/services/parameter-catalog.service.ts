import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';

interface CatalogField {
  path: string;
  type: string;
  required?: boolean;
  enum_ref?: string;
}

interface CatalogSpec {
  fields?: CatalogField[];
  required?: string[];
}

interface FilterExpandedEntry {
  summary?: string;
  params?: Array<{ name: string; type: string }>;
}

export interface ParameterCatalog {
  meta?: { version?: string };
  enums?: Record<string, string[]>;
  specs?: Record<string, CatalogSpec>;
  filters_expanded?: { items?: Record<string, FilterExpandedEntry> };
}

@Injectable({ providedIn: 'root' })
export class ParameterCatalogService {
  private readonly http = inject(HttpClient);
  private readonly url = '/parameter_catalog.json';
  private catalog: ParameterCatalog | null = null;

  loadCatalog() {
    return this.http.get<ParameterCatalog>(this.url).pipe(
      tap(catalog => {
        this.catalog = catalog;
      }),
      catchError(err => {
        console.error('[Catalog] Failed to load parameter_catalog.json', err);
        return of(null);
      })
    );
  }

  enumTooltip(enumKey: string, value?: string): string | null {
    const options = this.catalog?.enums?.[enumKey];
    if (!options || options.length === 0) {
      return null;
    }
    const list = options.join(', ');
    if (value && !options.includes(value)) {
      return `Non supporte (catalog: ${list})`;
    }
    return `Catalog ${enumKey}: ${list}`;
  }

  filterTooltip(id: string): string | null {
    const entry = this.catalog?.filters_expanded?.items?.[id];
    if (!entry) {
      return 'Non supporte par le catalog';
    }
    const params = entry.params?.map(param => `${param.name}:${param.type}`).join(', ');
    return params ? `${entry.summary ?? id} (${params})` : entry.summary ?? id;
  }
}
