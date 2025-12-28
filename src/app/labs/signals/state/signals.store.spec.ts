import { TestBed } from '@angular/core/testing';
import { SignalsStore } from './signals.store';

describe('SignalsStore', () => {
  let store: SignalsStore;
  let getItemSpy: jasmine.Spy;
  let setItemSpy: jasmine.Spy;

  beforeEach(() => {
    getItemSpy = spyOn(localStorage, 'getItem').and.returnValue(null);
    setItemSpy = spyOn(localStorage, 'setItem');
    TestBed.configureTestingModule({});
    store = TestBed.runInInjectionContext(() => new SignalsStore());
    TestBed.flushEffects();
  });

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

  it('filters todos by status', () => {
    store.addTodo('A');
    store.addTodo('B');
    const [firstId] = store.todos().map(t => t.id);

    store.toggleTodo(firstId);

    store.filter.set('active');
    expect(store.filteredTodos().every(t => !t.completed)).toBeTrue();
    expect(store.filteredTodos().length).toBe(1);

    store.filter.set('completed');
    expect(store.filteredTodos().every(t => t.completed)).toBeTrue();
    expect(store.filteredTodos().length).toBe(1);

    store.filter.set('all');
    expect(store.filteredTodos().length).toBe(2);
  });

  it('persists count changes to localStorage', () => {
    const key = 'signals-demo:count';
    TestBed.flushEffects();
    expect(getItemSpy).toHaveBeenCalledWith(key);

    store.inc();
    TestBed.flushEffects();
    expect(setItemSpy).toHaveBeenCalledWith(key, '1');
  });
});
