import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { EquityCurveChartComponent, EquityCurveSeries } from '../equity-curve-chart/equity-curve-chart.component';
import { ScenariosViewModel, ScenarioViewModel } from '../../../../models/stress-tests.models';

@Component({
  selector: 'app-scenarios-panel',
  standalone: true,
  imports: [CommonModule, MatCardModule, EquityCurveChartComponent],
  templateUrl: './scenarios-panel.component.html',
  styleUrls: ['./scenarios-panel.component.scss'],
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
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
