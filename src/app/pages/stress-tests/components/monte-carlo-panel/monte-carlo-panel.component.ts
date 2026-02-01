import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MonteCarloViewModel } from '../../../../models/stress-tests.models';
import { EquityCurveChartComponent, EquityCurveSeries } from '../equity-curve-chart/equity-curve-chart.component';
import { PercentileRow, PercentileTableComponent } from '../percentile-table/percentile-table.component';

interface KpiItem {
  label: string;
  value?: number;
  suffix?: string;
}

@Component({
  selector: 'app-monte-carlo-panel',
  standalone: true,
  imports: [CommonModule, MatCardModule, EquityCurveChartComponent, PercentileTableComponent],
  templateUrl: './monte-carlo-panel.component.html',
  styleUrls: ['./monte-carlo-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonteCarloPanelComponent implements OnChanges {
  @Input() data?: MonteCarloViewModel;

  kpis: KpiItem[] = [];
  bandSeries: EquityCurveSeries[] = [];
  sampleSeries: EquityCurveSeries[] = [];
  percentileColumns: string[] = [];
  percentileRows: PercentileRow[] = [];
  showSampleLegend = true;
  parameterEntries: Array<{ key: string; value: string }> = [];

  ngOnChanges(): void {
    this.buildKpis();
    this.buildCharts();
    this.buildPercentileTable();
    this.buildParameters();
  }

  get hasData(): boolean {
    return Boolean(this.data);
  }

  get modeNotice(): string | null {
    const mode = this.data?.mode?.toLowerCase();
    if (mode === 'light' || mode === 'light_strict') {
      return 'Mode light: percentile band indisponible (equity_curves uniquement).';
    }
    return null;
  }

  private buildKpis(): void {
    if (!this.data) {
      this.kpis = [];
      return;
    }
    const ruin = this.normalizePercent(this.data.kpis.ruinProbability);
    this.kpis = [
      {
        label: 'Ruin probability',
        value: ruin.value,
        suffix: ruin.suffix,
      },
      {
        label: 'Median return',
        value: this.data.kpis.medianReturn,
      },
      {
        label: 'Median max drawdown',
        value: this.data.kpis.medianMaxDrawdown,
      },
    ];
  }

  private normalizePercent(value?: number): { value?: number; suffix?: string } {
    if (typeof value !== 'number') {
      return { value: undefined };
    }
    if (value > 0 && value <= 1) {
      return { value: Math.round(value * 10000) / 100, suffix: '%' };
    }
    return { value };
  }

  private buildCharts(): void {
    if (!this.data) {
      this.bandSeries = [];
      this.sampleSeries = [];
      this.showSampleLegend = true;
      return;
    }
    const band = this.data.percentileBand;
    const low = band?.p10 ?? band?.p5;
    const high = band?.p90 ?? band?.p95;
    const median = band?.p50;

    const series: EquityCurveSeries[] = [];
    if (low && high) {
      series.push({ label: low === band?.p10 ? 'P10' : 'P5', values: low, color: '#ef4444', fillToNext: true, borderWidth: 2 });
      series.push({ label: high === band?.p90 ? 'P90' : 'P95', values: high, color: '#22c55e', borderWidth: 2 });
      if (median) {
        series.push({ label: 'P50', values: median, color: '#0f172a', borderWidth: 2 });
      }
    } else if (median) {
      series.push({ label: 'P50', values: median, color: '#0f172a', borderWidth: 2 });
    }
    this.bandSeries = series;

    const palette = ['#2563eb', '#0ea5e9', '#14b8a6', '#f97316', '#f43f5e', '#a855f7'];
    this.sampleSeries = (this.data.curveSamples ?? []).map((curve, index) => ({
      label: `Sim ${index + 1}`,
      values: curve,
      color: palette[index % palette.length] + '88',
      borderWidth: 1,
    }));
    this.showSampleLegend = this.sampleSeries.length <= 8;

    if (!this.data.curveSamples?.length) {
      console.warn('[StressTests] monte carlo samples empty', { runId: this.data?.parameters?.['runId'] });
    } else if (!this.data.curveSamples[0]?.length) {
      console.warn('[StressTests] monte carlo samples empty curve', { sampleCount: this.data.curveSamples.length });
    }
  }

  private buildPercentileTable(): void {
    if (!this.data) {
      this.percentileColumns = [];
      this.percentileRows = [];
      return;
    }
    const metrics = this.data.metricsByDistribution ?? {};
    const metricKeys = Object.keys(metrics);
    const preferredKeys = this.selectMetricKeys(metricKeys);
    this.percentileColumns = ['p10', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99'];

    this.percentileRows = preferredKeys.map(metricName => {
      const row = metrics[metricName] ?? {};
      return {
        metric: this.formatMetricLabel(metricName),
        values: {
          p5: row.p5,
          p10: row.p10,
          p25: row.p25,
          p50: row.p50 ?? row.median,
          p75: row.p75,
          p90: row.p90,
          p95: row.p95,
          p99: row.p99,
          mean: row.mean,
          std: row.std,
        },
      } as PercentileRow;
    });
  }

  private selectMetricKeys(keys: string[]): string[] {
    if (!keys.length) {
      return [];
    }
    const scored = keys.map(key => ({ key, score: this.metricScore(key) }));
    scored.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    return scored.slice(0, 5).map(item => item.key);
  }

  private metricScore(key: string): number {
    const lower = key.toLowerCase();
    const boosts = [
      { match: 'return', score: 5 },
      { match: 'drawdown', score: 4 },
      { match: 'final', score: 3 },
      { match: 'capital', score: 3 },
      { match: 'vol', score: 2 },
      { match: 'risk', score: 2 },
    ];
    let score = 0;
    boosts.forEach(rule => {
      if (lower.includes(rule.match)) {
        score += rule.score;
      }
    });
    return score;
  }

  private formatMetricLabel(metric: string): string {
    return metric
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildParameters(): void {
    if (!this.data?.parameters) {
      this.parameterEntries = [];
      return;
    }
    this.parameterEntries = Object.entries(this.data.parameters)
      .slice(0, 8)
      .map(([key, value]) => ({
        key,
        value: this.formatParameterValue(value),
      }));
  }

  private formatParameterValue(value: unknown): string {
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
      if (value.length <= 6) {
        return value.map(item => this.formatParameterValue(item)).join(', ');
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
        .map(key => `${key}: ${this.formatParameterValue(record[key])}`)
        .join(', ');
      return `{ ${preview} }`;
    }
    return String(value);
  }

  trackByKpi(_: number, item: KpiItem): string {
    return item.label;
  }

  trackByParam(_: number, item: { key: string }): string {
    return item.key;
  }
}
