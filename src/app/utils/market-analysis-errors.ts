import { BackendValidationError, parseBackendValidationErrors } from './backend-validation';

export type MarketAnalysisErrorKind =
  | 'validation'
  | 'not_found'
  | 'result_pending'
  | 'service_unavailable'
  | 'unexpected';

export interface MarketAnalysisUiError {
  kind: MarketAnalysisErrorKind;
  message: string;
  details: BackendValidationError[];
}

export interface MarketAnalysisResultContractStateInput {
  source: string | null | undefined;
  hasStructuredRows: boolean;
  hasRawResult: boolean;
  hasMeta: boolean;
}

export function mapMarketAnalysisHttpError(error: unknown, context: 'runs' | 'run-detail' | 'run-result'): MarketAnalysisUiError {
  const status = Number((error as { status?: number } | null)?.status ?? 0);
  const details = parseBackendValidationErrors(error);

  if (status === 422) {
    return {
      kind: 'validation',
      message: buildValidationMessage(details, context),
      details
    };
  }

  if (status === 404) {
    return {
      kind: 'not_found',
      message: context === 'runs' ? 'Aucun run correspondant ou ressource introuvable.' : 'Run introuvable.',
      details: []
    };
  }

  if (status === 409 && context === 'run-result') {
    return {
      kind: 'result_pending',
      message: 'Resultat pas encore disponible pour ce run.',
      details: []
    };
  }

  if (status === 0 || status >= 500) {
    return {
      kind: 'service_unavailable',
      message: 'Service indisponible temporairement. Reessayez.',
      details: []
    };
  }

  return {
    kind: 'unexpected',
    message: 'Erreur inattendue lors du chargement.',
    details: []
  };
}

export function formatMarketAnalysisResultSource(source: string | null | undefined): string {
  if (source === 'persisted_tables') {
    return 'Source: persisted_tables';
  }
  if (source === 'result_json') {
    return 'Source: result_json';
  }
  if (!String(source ?? '').trim()) {
    return 'Source: inconnue';
  }
  return `Source: ${String(source).trim()}`;
}

export function describeMarketAnalysisResultContractState(
  input: MarketAnalysisResultContractStateInput
): string | null {
  if (input.hasStructuredRows && !input.hasMeta) {
    return 'Resultat tabulaire disponible. Certaines metadonnees ne sont pas fournies pour ce type de run.';
  }

  if (input.source === 'result_json' && input.hasRawResult && !input.hasStructuredRows) {
    return 'Resultat disponible uniquement via result_json. Les metadonnees structurees peuvent etre partielles.';
  }

  if (!input.hasStructuredRows && input.hasMeta) {
    return 'Resultat present avec metadonnees partielles. Les tableaux detailles ne sont pas disponibles pour cette source.';
  }

  if (!input.hasStructuredRows && !input.hasRawResult && !input.hasMeta) {
    return 'Resultat present mais sans contenu exploitable pour ce run.';
  }

  return null;
}

function buildValidationMessage(details: BackendValidationError[], context: 'runs' | 'run-detail' | 'run-result'): string {
  const prefix =
    context === 'runs'
      ? 'Filtres invalides pour le catalogue des runs.'
      : context === 'run-detail'
        ? 'Requete detail invalide.'
        : 'Requete resultat invalide.';

  if (!details.length) {
    return prefix;
  }

  const first = details[0];
  return `${prefix} ${first.field}: ${first.message ?? first.code ?? 'validation error'}`;
}
