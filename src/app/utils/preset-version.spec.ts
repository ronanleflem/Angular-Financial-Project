import { evaluatePresetCompatibility } from './preset-version';

describe('preset-version', () => {
  it('treats exact match as compatible', () => {
    const result = evaluatePresetCompatibility('v1.2.3', 'v1.2.3');
    expect(result.status).toBe('compatible');
  });

  it('treats same major as warning', () => {
    const result = evaluatePresetCompatibility('1.2.0', '1.0.5');
    expect(result.status).toBe('warning');
  });

  it('treats different major as incompatible', () => {
    const result = evaluatePresetCompatibility('2.0.0', '1.9.9');
    expect(result.status).toBe('incompatible');
  });

  it('falls back to warning for non semver', () => {
    const result = evaluatePresetCompatibility('vNext', 'legacy');
    expect(result.status).toBe('warning');
  });
});
