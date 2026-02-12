export type PresetCompatibility = 'compatible' | 'warning' | 'incompatible';

export interface PresetCompatibilityResult {
  status: PresetCompatibility;
  message: string;
}

export function evaluatePresetCompatibility(
  currentVersion: string,
  presetVersion: string
): PresetCompatibilityResult {
  const current = (currentVersion ?? '').trim();
  const preset = (presetVersion ?? '').trim();

  if (current && preset && current === preset) {
    return { status: 'compatible', message: 'Versions identiques.' };
  }

  const currentMajor = parseMajorVersion(current);
  const presetMajor = parseMajorVersion(preset);

  if (currentMajor === null || presetMajor === null) {
    return {
      status: 'warning',
      message: 'Version non semver detectee: chargement avec prudence.'
    };
  }

  if (currentMajor === presetMajor) {
    return {
      status: 'warning',
      message: 'Meme version majeure: chargement autorise avec avertissement.'
    };
  }

  return {
    status: 'incompatible',
    message: `Version majeure differente (${presetMajor} vs ${currentMajor}).`
  };
}

function parseMajorVersion(version: string): number | null {
  if (!version) {
    return null;
  }
  const normalized = version.trim().replace(/^v/i, '');
  const match = normalized.match(/^(\d+)(\.\d+)?(\.\d+)?/);
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  return Number.isFinite(major) ? major : null;
}
