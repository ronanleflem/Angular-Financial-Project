import { RunRequestInput, validateRunRequest } from './run-request-input.model';

describe('validateRunRequest stress_tests', () => {
  it('requires data.baseRunId for stress_tests', () => {
    const input = {
      runType: 'stress_tests',
      data: { baseRunId: '' },
      performance: {
        stressTests: { enabled: true, nSims: 1000 }
      }
    } as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors).toContain(jasmine.objectContaining({ path: 'data.baseRunId', message: 'required' }));
  });

  it('does not require symbol/timeframe/date fields for stress_tests', () => {
    const input = {
      runType: 'stress_tests',
      data: { baseRunId: 'run-123' },
      performance: {
        stressTests: { enabled: true, nSims: 1000 }
      }
    } as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors.find(error => error.path === 'data.symbol')).toBeUndefined();
    expect(errors.find(error => error.path === 'data.timeframe')).toBeUndefined();
    expect(errors.find(error => error.path === 'data.startDate')).toBeUndefined();
    expect(errors.find(error => error.path === 'data.endDate')).toBeUndefined();
  });

  it('requires scenarios[].name when scenarios are provided', () => {
    const input = {
      runType: 'stress_tests',
      data: { baseRunId: 'run-123' },
      performance: {
        stressTests: {
          enabled: true,
          nSims: 1000,
          scenarios: [
            { name: '', type: 'shock', shockPct: 10 } as any
          ]
        }
      }
    } as RunRequestInput;

    const errors = validateRunRequest(input);
    expect(errors).toContain(
      jasmine.objectContaining({
        path: 'performance.stressTests.scenarios[0].name',
        message: 'name is required'
      })
    );
  });
});
