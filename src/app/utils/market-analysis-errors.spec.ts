import {
  describeMarketAnalysisResultContractState,
  formatMarketAnalysisResultSource,
  mapMarketAnalysisHttpError
} from './market-analysis-errors';

describe('market-analysis-errors', () => {
  it('maps 422 responses to validation messages with field details', () => {
    const error = {
      status: 422,
      error: {
        errors: [
          {
            field: 'symbol',
            code: 'required',
            message: 'Symbol is required'
          }
        ]
      }
    };

    expect(mapMarketAnalysisHttpError(error, 'runs')).toEqual({
      kind: 'validation',
      message: 'Filtres invalides pour le catalogue des runs. symbol: Symbol is required',
      details: [
        {
          field: 'symbol',
          code: 'required',
          message: 'Symbol is required'
        }
      ]
    });
  });

  it('maps 404 responses to not_found messages', () => {
    expect(mapMarketAnalysisHttpError({ status: 404 }, 'run-detail')).toEqual({
      kind: 'not_found',
      message: 'Run introuvable.',
      details: []
    });
  });

  it('maps 409 result responses to result_pending info', () => {
    expect(mapMarketAnalysisHttpError({ status: 409 }, 'run-result')).toEqual({
      kind: 'result_pending',
      message: 'Resultat pas encore disponible pour ce run.',
      details: []
    });
  });

  it('maps 5xx and status 0 responses to service_unavailable', () => {
    expect(mapMarketAnalysisHttpError({ status: 503 }, 'runs').kind).toBe('service_unavailable');
    expect(mapMarketAnalysisHttpError({ status: 0 }, 'runs').message).toBe('Service indisponible temporairement. Reessayez.');
  });

  it('formats result sources explicitly', () => {
    expect(formatMarketAnalysisResultSource('persisted_tables')).toBe('Source: persisted_tables');
    expect(formatMarketAnalysisResultSource('result_json')).toBe('Source: result_json');
  });

  it('describes result_json-only payloads with partial metadata', () => {
    expect(
      describeMarketAnalysisResultContractState({
        source: 'result_json',
        hasStructuredRows: false,
        hasRawResult: true,
        hasMeta: false
      })
    ).toBe('Resultat disponible uniquement via result_json. Les metadonnees structurees peuvent etre partielles.');
  });
});
