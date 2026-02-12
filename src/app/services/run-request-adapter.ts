import { RunRequestInput, RunType } from '../models/run-request-input.model';

export interface CanonicalRunRequest {
  spec_type: RunType;
  catalog_version: string;
  request_id?: string;
  [key: string]: unknown;
}

export interface CanonicalRunRequestOptions {
  catalogVersion?: string;
  requestId?: string;
}

export function mapRunRequestToCanonical(
  input: RunRequestInput,
  options: CanonicalRunRequestOptions = {}
): CanonicalRunRequest {
  const catalogVersion = options.catalogVersion?.trim() || 'v1';
  const requestId = options.requestId?.trim();
  const { runType, ...rest } = input as RunRequestInput & Record<string, unknown>;
  const payload = toSnakeCaseValue(rest) as Record<string, unknown>;

  const canonical: CanonicalRunRequest = {
    spec_type: runType,
    catalog_version: catalogVersion
  };

  if (requestId) {
    canonical.request_id = requestId;
  }

  return { ...canonical, ...payload };
}

function toSnakeCaseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => toSnakeCaseValue(entry));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isPlainObject(value)) {
    return toSnakeCaseObject(value);
  }
  return value;
}

function toSnakeCaseObject(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const snakeKey = toSnakeCaseKey(key);
    result[snakeKey] = toSnakeCaseValue(entry);
  });
  return result;
}

function toSnakeCaseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
