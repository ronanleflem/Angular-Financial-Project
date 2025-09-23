import { SignalsStore } from './signals.store';

describe('SignalsStore', () => {
  let store: SignalsStore;
  beforeEach(() => { store = new SignalsStore(); });

  it('increments/decrements/resets count', () => {
    expect(store.count()).toBe(0);
    store.inc();
    expect(store.count()).toBe(1);
    store.dec();
    expect(store.count()).toBe(0);
    store.reset();
    expect(store.count()).toBe(0);
  });

  it('manages todos', () => {
    store.addTodo('A');
    store.addTodo('B');
    const ids = store.todos().map(t => t.id);
    expect(store.todos().length).toBe(2);

    store.toggleTodo(ids[0]);
    expect(store.completedCount()).toBe(1);
    expect(store.activeCount()).toBe(1);

    store.removeTodo(ids[1]);
    expect(store.todos().length).toBe(1);

    store.clearCompleted();
    expect(store.todos().length).toBe(0);
  });
});
