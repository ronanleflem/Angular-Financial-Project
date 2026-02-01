import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export interface PercentileRow {
  metric: string;
  values: Record<string, number | undefined>;
}

@Component({
  selector: 'app-percentile-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './percentile-table.component.html',
  styleUrls: ['./percentile-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PercentileTableComponent {
  @Input() title = 'Percentiles';
  @Input() columns: string[] = [];
  @Input() rows: PercentileRow[] = [];

  formatValue(row: PercentileRow, column: string): string {
    const value = row.values[column];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 'N/A';
    }
    const rounded = Math.round(value * 100) / 100;
    return rounded.toString();
  }

  formatColumn(column: string): string {
    return column.toUpperCase();
  }
}
