import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppErrorProvider, useAppError } from './AppErrorContext';

describe('AppErrorContext', () => {
  it('stores and clears a shared app error', () => {
    const { result } = renderHook(() => useAppError(), {
      wrapper: AppErrorProvider
    });

    expect(result.current.error).toBeNull();

    act(() => result.current.setError('Something went wrong'));
    expect(result.current.error).toBe('Something went wrong');

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('fails fast when used outside the provider', () => {
    expect(() => renderHook(() => useAppError())).toThrow('useAppError must be used within AppErrorProvider');
  });
});
