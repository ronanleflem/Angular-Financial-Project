import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CounterCard } from './widgets/counter.card';
import { TodoCard } from './widgets/todo.card';

@Component({
  selector: 'app-signals-home',
  standalone: true,
  imports: [CommonModule, CounterCard, TodoCard],
  template: `
    <section class="container">
      <h1>Signals Lab</h1>
      <p class="subtitle">Demo of <strong>signal</strong>, <strong>computed</strong> and <strong>effect</strong>.</p>
      <div class="grid">
        <counter-card />
        <todo-card />
      </div>
    </section>
  `,
  styles: [`
    .container{padding:1rem;max-width:1000px;margin:0 auto}
    .subtitle{opacity:.7}
    .grid{display:grid;gap:1rem}
    @media(min-width:900px){.grid{grid-template-columns:1fr 1fr}}
  `]
})
export class SignalsHomePage {}
