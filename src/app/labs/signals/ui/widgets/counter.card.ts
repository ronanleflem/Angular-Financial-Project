import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalsStore } from '../../state/signals.store';

@Component({
  selector: 'counter-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card">
      <header><h2>Counter (Signals)</h2></header>
      <div class="value">{{ store.count() }}</div>
      <div class="label">Status: {{ store.countLabel() }}</div>
      <div class="row">
        <button (click)="store.dec()">−</button>
        <button (click)="store.reset()">Reset</button>
        <button (click)="store.inc()">+</button>
      </div>
      <p class="hint">Value persists via <code>effect</code> → <code>localStorage</code>.</p>
    </article>
  `,
  styles: [`
    .card{border:1px solid #e1e1e1;border-radius:12px;padding:1rem}
    .row{display:flex;gap:.5rem;margin-top:.5rem}
    button{padding:.4rem .8rem;border-radius:8px;border:1px solid #ccc;background:#fafafa;cursor:pointer}
    .value{font-size:2.2rem;font-weight:700}
    .label{opacity:.8}
    .hint{opacity:.6;font-size:.9rem}
  `]
})
export class CounterCard {
  protected readonly store = inject(SignalsStore);
}
