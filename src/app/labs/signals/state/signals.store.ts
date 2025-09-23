import { Injectable, computed, effect, signal } from '@angular/core';

export type Todo = { id: string; title: string; completed: boolean };
export type Filter = 'all' | 'active' | 'completed';

function uid() { return Math.random().toString(36).slice(2, 9); }

@Injectable({ providedIn: 'root' })
export class SignalsStore {
  // Counter
  readonly count = signal<number>(0);

  // Counter derived status
  readonly countLabel = computed(() => {
    const c = this.count();
    if (c < 5) return 'Low';
    if (c < 10) return 'Medium';
    return 'High';
  });

  // Persist to localStorage
  private readonly persistEffect = effect(onCleanup => {
    const key = 'signals-demo:count';
    // load once
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const parsed = Number(stored);
      if (!Number.isNaN(parsed)) this.count.set(parsed);
    }
    const unsub = effect(() => {
      localStorage.setItem(key, String(this.count()));
    });
    onCleanup(() => unsub.destroy());
  });

  inc() { this.count.update(c => c + 1); }
  dec() { this.count.update(c => c - 1); }
  reset() { this.count.set(0); }

  // Todos
  readonly todos = signal<readonly Todo[]>([]);
  readonly filter = signal<Filter>('all');

  readonly activeCount = computed(() => this.todos().filter(t => !t.completed).length);
  readonly completedCount = computed(() => this.todos().filter(t => t.completed).length);
  readonly filteredTodos = computed(() => {
    const f = this.filter();
    const items = this.todos();
    switch (f) {
      case 'active': return items.filter(t => !t.completed);
      case 'completed': return items.filter(t => t.completed);
      default: return items;
    }
  });

  addTodo(title: string) {
    const t: Todo = { id: uid(), title: title.trim(), completed: false };
    if (!t.title) return;
    this.todos.update(list => [t, ...list]);
  }

  toggleTodo(id: string) {
    this.todos.update(list => list.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }

  removeTodo(id: string) {
    this.todos.update(list => list.filter(t => t.id !== id));
  }

  clearCompleted() {
    this.todos.update(list => list.filter(t => !t.completed));
  }
}
