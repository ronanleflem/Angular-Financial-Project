import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { EquityCurveChartComponent, EquityCurveSeries } from '../equity-curve-chart/equity-curve-chart.component';
import { ScenariosViewModel, ScenarioViewModel } from '../../../../models/stress-tests.models';

@Component({
  selector: 'app-scenarios-panel',
  standalone: true,
  imports: [CommonModule, MatCardModule, EquityCurveChartComponent],
  templateUrl: './scenarios-panel.component.html',
  styleUrls: ['./scenarios-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenariosPanelComponent {
  @Input() data?: ScenariosViewModel;

  get items(): ScenarioViewModel[] {
    return this.data?.items ?? [];
  }

  hasMetrics(item: ScenarioViewModel): boolean {
    return Boolean(item.metrics && Object.keys(item.metrics).length);
  }

  hasSettings(item: ScenarioViewModel): boolean {
    return Boolean(item.settings && Object.keys(item.settings).length);
  }

  scenarioSeries(item: ScenarioViewModel): EquityCurveSeries[] {
    if (!item.curve?.length) {
      return [];
    }
    return [{ label: 'Scenario', values: item.curve, color: '#2563eb', borderWidth: 2 }];
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'number') {
      return (Math.round(value * 100) / 100).toString();
    }
    if (Array.isArray(value)) {
      if (value.length <= 6) {
        return value.map(item => this.formatScalar(item)).join(', ');
      }
      return `[${value.length} valeurs]`;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);
      if (!keys.length) {
        return '{}';
      }
      if (keys.length > 8) {
        return `{${keys.length} clés}`;
      }
      const preview = keys
        .slice(0, 5)
        .map(key => `${key}: ${this.formatScalar(record[key])}`)
        .join(', ');
      return `{ ${preview} }`;
    }
    return String(value);
  }

  trackByScenario(_: number, item: ScenarioViewModel): string {
    return item.name;
  }

  private formatScalar(value: unknown): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'number') {
      return (Math.round(value * 100) / 100).toString();
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return `[${value.length}]`;
    }
    return '{…}';
  }
}
