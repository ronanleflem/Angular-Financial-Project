import { Injectable } from '@angular/core';
import { RunRequestInput } from '../models/run-request-input.model';

export type PresetTheme = 'dca' | 'backtests' | 'market-stats' | 'seasonality' | 'stress-tests';

export interface RunPreset {
  id: string;
  name: string;
  theme: PresetTheme;
  catalogVersion: string;
  createdAt: string;
  formValue: Record<string, unknown>;
  payload?: RunRequestInput;
  appVersion?: string;
  schemaVersion?: number;
}

interface SavePresetInput {
  name: string;
  theme: PresetTheme;
  catalogVersion: string;
  formValue: Record<string, unknown>;
  payload: RunRequestInput;
  appVersion?: string;
}

@Injectable({ providedIn: 'root' })
export class PresetsService {
  private readonly storageKey = 'strategy_launcher_presets';

  getAllPresets(): RunPreset[] {
    return this.readPresets();
  }

  getPreset(id: string): RunPreset | undefined {
    return this.readPresets().find(preset => preset.id === id);
  }

  savePreset(input: SavePresetInput): RunPreset {
    const presets = this.readPresets();
    const now = new Date().toISOString();
    const id = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const preset: RunPreset = {
      id,
      name: input.name,
      theme: input.theme,
      catalogVersion: input.catalogVersion,
      createdAt: now,
      formValue: input.formValue,
      payload: input.payload,
      appVersion: input.appVersion,
      schemaVersion: 1
    };

    const withoutSameName = presets.filter(
      existing => !(existing.theme === preset.theme && existing.name === preset.name)
    );
    withoutSameName.unshift(preset);
    this.writePresets(withoutSameName);
    return preset;
  }

  private readPresets(): RunPreset[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(item => item && typeof item.id === 'string') as RunPreset[];
    } catch {
      return [];
    }
  }

  private writePresets(presets: RunPreset[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(presets));
    } catch {
      // ignore storage errors
    }
  }
}
