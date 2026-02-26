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
  params?: Array<{ name: string; type: string; enum?: string[] }>;
}

interface CatalogParamEntry {
  name: string;
  type: string;
  enum?: string[];
  required?: boolean;
}

interface StatsExpandedEntry {
  params?: CatalogParamEntry[];
}

export interface ParameterCatalog {
  meta?: { version?: string };
  enums?: Record<string, string[]>;
  specs?: Record<string, CatalogSpec>;
  filters_expanded?: { items?: Record<string, FilterExpandedEntry> };
  stats_expanded?: {
    events?: Record<string, StatsExpandedEntry>;
    conditions?: Record<string, StatsExpandedEntry>;
    targets?: Record<string, StatsExpandedEntry>;
  };
  seasonality_expanded?: {
    profiles?: Record<string, StatsExpandedEntry>;
  };
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

  filterParams(id: string): Array<{ name: string; type: string; enum?: string[] }> {
    const entry = this.catalog?.filters_expanded?.items?.[id];
    if (!entry?.params || !Array.isArray(entry.params)) {
      return [];
    }
    return entry.params
      .filter(param => typeof param.name === 'string' && typeof param.type === 'string')
      .map(param => ({
        name: param.name,
        type: param.type,
        enum: Array.isArray(param.enum) ? param.enum.filter(value => typeof value === 'string') : undefined
      }));
  }

  statsParams(kind: 'events' | 'conditions' | 'targets', id: string): CatalogParamEntry[] {
    const entry = this.catalog?.stats_expanded?.[kind]?.[id];
    return this.normalizeCatalogParams(entry?.params);
  }

  seasonalityProfileParams(id: string): CatalogParamEntry[] {
    const entry = this.catalog?.seasonality_expanded?.profiles?.[id];
    return this.normalizeCatalogParams(entry?.params);
  }

  private normalizeCatalogParams(params: unknown): CatalogParamEntry[] {
    if (!Array.isArray(params)) {
      return [];
    }
    return params
      .filter(param => typeof param === 'object' && param !== null)
      .map(param => param as Record<string, unknown>)
      .filter(param => typeof param['name'] === 'string' && typeof param['type'] === 'string')
      .map(param => ({
        name: String(param['name']),
        type: String(param['type']),
        enum: Array.isArray(param['enum']) ? param['enum'].filter(value => typeof value === 'string') as string[] : undefined,
        required: typeof param['required'] === 'boolean' ? Boolean(param['required']) : undefined
      }));
  }
}
