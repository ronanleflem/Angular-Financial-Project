import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { SymbolRef } from '../../../../models/data-catalog.models';

@Component({
  selector: 'app-data-availability-filters',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
  ],
  templateUrl: './data-availability-filters.component.html',
  styleUrls: ['./data-availability-filters.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataAvailabilityFiltersComponent {
  @Input() filtersForm!: FormGroup;
  @Input() brokers: string[] = [];
  @Input() marketTypes: string[] = [];
  @Input() timeframePresets: string[] = [];
  @Input() allColumns: ReadonlyArray<{ key: string; label: string; locked: boolean }> = [];
  @Input() filteredSymbols$!: Observable<SymbolRef[]>;
}
