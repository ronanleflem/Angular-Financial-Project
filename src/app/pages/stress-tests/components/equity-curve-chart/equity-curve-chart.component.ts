import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartDataset, registerables } from 'chart.js';

Chart.register(...registerables);

export interface EquityCurveSeries {
  label: string;
  values: number[];
  color?: string;
  fillToNext?: boolean;
  borderWidth?: number;
}

@Component({
  selector: 'app-equity-curve-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './equity-curve-chart.component.html',
  styleUrls: ['./equity-curve-chart.component.scss'],
})
export class EquityCurveChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() title = '';
  @Input() series: EquityCurveSeries[] = [];
  @Input() height = 240;
  @Input() showLegend = true;
  @Input() lazy = true;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;

  private chart?: Chart<'line'>;
  private observer?: IntersectionObserver;
  private viewReady = false;
  private isVisible = false;
  private readonly maxPoints = 800;

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.lazy) {
      this.setupObserver();
    } else {
      this.isVisible = true;
      this.renderOrUpdate();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady || !changes['series']) {
      return;
    }
    if (!this.lazy) {
      this.renderOrUpdate();
      return;
    }
    if (this.isVisible) {
      this.renderOrUpdate();
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

  get hasData(): boolean {
    return Array.isArray(this.series) && this.series.length > 0 && this.series.some(item => item.values?.length);
  }

  private setupObserver(): void {
    if (!this.wrapperRef) {
      return;
    }
    this.observer = new IntersectionObserver(
      entries => {
        const isVisible = entries.some(entry => entry.isIntersecting);
        if (isVisible) {
          this.isVisible = true;
          this.renderOrUpdate();
          this.observer?.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );
    this.observer.observe(this.wrapperRef.nativeElement);
  }

  private renderOrUpdate(): void {
    if (!this.hasData || !this.canvasRef) {
      if (this.chart) {
        this.chart.destroy();
        this.chart = undefined;
      }
      return;
    }

    if (this.chart) {
      this.chart.data = this.buildChartConfig().data!;
      this.chart.options = this.buildChartConfig().options!;
      this.chart.update();
      return;
    }

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }
    this.chart = new Chart(ctx, this.buildChartConfig());
  }

  private buildChartConfig(): ChartConfiguration<'line'> {
    const downsampledSeries = this.downsampleSeries(this.series, this.maxPoints);
    const datasets: ChartDataset<'line', number[]>[] = downsampledSeries.map(item => ({
      label: item.label,
      data: item.values,
      borderColor: item.color ?? '#2563eb',
      backgroundColor: item.fillToNext ? (item.color ?? '#2563eb') + '33' : 'transparent',
      borderWidth: item.borderWidth ?? 2,
      pointRadius: 0,
      tension: 0.2,
      fill: item.fillToNext ? '+1' : false,
    }));

    const maxLength = Math.max(...downsampledSeries.map(item => item.values.length));
    const labels = Array.from({ length: maxLength }, (_, idx) => idx + 1);

    return {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        normalized: true,
        parsing: false,
        plugins: {
          legend: {
            display: this.showLegend,
            position: 'bottom',
          },
          title: {
            display: Boolean(this.title),
            text: this.title,
            color: '#0f172a',
            font: {
              size: 14,
              weight: 600,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 6,
              color: '#64748b',
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.15)',
            },
          },
          y: {
            ticks: {
              color: '#64748b',
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)',
            },
          },
        },
      },
    };
  }

  private downsampleSeries(series: EquityCurveSeries[], maxPoints: number): EquityCurveSeries[] {
    if (!series.length) {
      return [];
    }
    const maxLength = Math.max(...series.map(item => item.values?.length ?? 0));
    if (!maxLength || maxLength <= maxPoints) {
      return series;
    }
    const step = Math.ceil(maxLength / maxPoints);
    return series.map(item => ({
      ...item,
      values: this.downsampleValues(item.values, step),
    }));
  }

  private downsampleValues(values: number[], step: number): number[] {
    if (!Array.isArray(values) || !values.length || step <= 1) {
      return values;
    }
    const sampled: number[] = [];
    for (let i = 0; i < values.length; i += step) {
      sampled.push(values[i]);
    }
    return sampled;
  }
}
