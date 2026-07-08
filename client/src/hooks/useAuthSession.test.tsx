import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthSession } from './useAuthSession';
import { createStaffUser } from '../test/factories';
import type { User } from '../types';

const api = vi.hoisted(() => ({
  clearStoredToken: vi.fn(),
  fetchCurrentUser: vi.fn(),
  getOrCreateDeviceId: vi.fn(() => 'device-1'),
  login: vi.fn(),
  registerDemoVisitor: vi.fn(),
  storeToken: vi.fn()
}));

vi.mock('../api', () => api);

const staffUser = createStaffUser();

describe('useAuthSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.registerDemoVisitor.mockResolvedValue({ visitorCount: 12 });
  });

  it('restores an existing session and registers the demo visitor', async () => {
    api.fetchCurrentUser.mockResolvedValue(staffUser);
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);
    const { result } = renderAuthHook({ onAuthenticated });

    await waitFor(() => expect(result.current.isSessionLoading).toBe(false));

    expect(result.current.user).toEqual(staffUser);
    expect(onAuthenticated).toHaveBeenCalledWith(staffUser);
    expect(api.registerDemoVisitor).toHaveBeenCalledWith('device-1');
    expect(result.current.visitorCount).toBe(12);
  });

  it('stores the access token and authenticates submitted credentials', async () => {
    api.fetchCurrentUser.mockRejectedValue(new Error('No stored session'));
    api.login.mockResolvedValue({ accessToken: 'token-123', user: staffUser });
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);
    const { result } = renderAuthHook({ onAuthenticated });
    await waitFor(() => expect(result.current.isSessionLoading).toBe(false));
    onAuthenticated.mockClear();

    await act(async () => {
      await result.current.handleLogin({ preventDefault: vi.fn() } as never);
    });

    expect(api.login).toHaveBeenCalledWith({
      email: 'staff@example.com',
      password: 'Staff123!'
    });
    expect(api.storeToken).toHaveBeenCalledWith('token-123');
    expect(onAuthenticated).toHaveBeenCalledWith(staffUser);
    expect(result.current.user).toEqual(staffUser);
    expect(result.current.isLoggingIn).toBe(false);
  });

  it('clears authentication and application data on logout', async () => {
    api.fetchCurrentUser.mockResolvedValue(staffUser);
    const onReset = vi.fn();
    const { result } = renderAuthHook({ onReset });
    await waitFor(() => expect(result.current.user).toEqual(staffUser));

    act(() => {
      result.current.handleLogout();
    });

    expect(api.clearStoredToken).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });
});

function renderAuthHook(overrides: {
  onAuthenticated?: (user: User) => Promise<void>;
  onReset?: () => void;
  onError?: (message: string | null) => void;
} = {}) {
  return renderHook(() => useAuthSession({
    onAuthenticated: overrides.onAuthenticated ?? vi.fn().mockResolvedValue(undefined),
    onReset: overrides.onReset ?? vi.fn(),
    onError: overrides.onError ?? vi.fn()
  }));
}
