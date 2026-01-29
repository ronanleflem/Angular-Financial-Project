import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-data-availability-header',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule],
  templateUrl: './data-availability-header.component.html',
  styleUrls: ['./data-availability-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataAvailabilityHeaderComponent {
  @Input() loading = false;
  @Input() hasData = false;

  @Output() refresh = new EventEmitter<void>();
  @Output() exportCsv = new EventEmitter<void>();
  @Output() showHelp = new EventEmitter<void>();
}
