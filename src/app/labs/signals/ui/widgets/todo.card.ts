import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignalsStore, Filter } from '../../state/signals.store';

@Component({
  selector: 'todo-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <article class="card">
      <header><h2>Todos (Signals)</h2></header>

      <form (ngSubmit)="add()" class="row">
        <input type="text" [(ngModel)]="title" name="title" placeholder="Add todo…" />
        <button type="submit">Add</button>
      </form>

      <nav class="filters">
        <button [class.active]="store.filter()==='all'" (click)="setFilter('all')">All</button>
        <button [class.active]="store.filter()==='active'" (click)="setFilter('active')">Active</button>
        <button [class.active]="store.filter()==='completed'" (click)="setFilter('completed')">Completed</button>
      </nav>

      <ul class="todos">
        <li *ngFor="let t of store.filteredTodos()">
          <label>
            <input type="checkbox" [checked]="t.completed" (change)="store.toggleTodo(t.id)" />
            <span [class.done]="t.completed">{{ t.title }}</span>
          </label>
          <button class="danger" (click)="store.removeTodo(t.id)">×</button>
        </li>
      </ul>

      <footer class="stats">
        <span>Active: {{ store.activeCount() }}</span>
        <span>Completed: {{ store.completedCount() }}</span>
        <button (click)="store.clearCompleted()" [disabled]="store.completedCount()===0">Clear completed</button>
      </footer>
    </article>
  `,
  styles: [`
    .card{border:1px solid #e1e1e1;border-radius:12px;padding:1rem}
    form.row{display:flex;gap:.5rem}
    input[type=text]{flex:1;padding:.5rem;border-radius:8px;border:1px solid #ccc}
    button{padding:.4rem .8rem;border-radius:8px;border:1px solid #ccc;background:#fafafa;cursor:pointer}
    .filters{display:flex;gap:.5rem;margin:.5rem 0}
    .filters .active{font-weight:700}
    ul.todos{list-style:none;padding:0;margin:.5rem 0;display:flex;flex-direction:column;gap:.25rem}
    li{display:flex;align-items:center;justify-content:space-between;border-bottom:1px dashed #eee;padding:.25rem 0}
    .done{opacity:.7;text-decoration:line-through}
    .danger{border-color:#e99;background:#fee}
    .stats{display:flex;gap:1rem;align-items:center;justify-content:space-between;margin-top:.5rem}
  `]
})
export class TodoCard {
  protected readonly store = inject(SignalsStore);
  protected title = '';
  add(){ this.store.addTodo(this.title); this.title=''; }
  setFilter(f: Filter){ this.store.filter.set(f); }
}
