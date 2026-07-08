import type { SetStateAction } from 'react';
import { vi } from 'vitest';

type MockSetter = ReturnType<typeof vi.fn>;

export function applyStateAction<T>(next: SetStateAction<T>, current: T): T {
  return typeof next === 'function' ? (next as (previous: T) => T)(current) : next;
}

export function createStateSetter<T>(initial: T) {
  let state = initial;
  const setter = vi.fn((next: SetStateAction<T>) => {
    state = applyStateAction(next, state);
  });

  return { setter, getState: () => state };
}

export function applyMockStateUpdate<T>(setter: MockSetter, initial: T): T {
  return applyMockStateUpdateAt(setter, initial, 0);
}

export function applyLastMockStateUpdate<T>(setter: MockSetter, initial: T): T {
  return applyMockStateUpdateAt(setter, initial, setter.mock.calls.length - 1);
}

function applyMockStateUpdateAt<T>(setter: MockSetter, initial: T, callIndex: number): T {
  const update = setter.mock.calls[callIndex][0] as SetStateAction<T>;
  return applyStateAction(update, initial);
}
