import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthSessionProvider, useAuthSessionContext } from './AuthSessionContext';
import { createStaffUser } from '../test/factories';

const staffUser = createStaffUser();

const authSession = {
  user: staffUser,
  email: 'staff@example.com',
  password: 'Staff123!',
  isIntroOpen: true,
  visitorCount: 4,
  isSessionLoading: false,
  isLoggingIn: false,
  setEmail: vi.fn(),
  setPassword: vi.fn(),
  openIntro: vi.fn(),
  closeIntro: vi.fn(),
  handleLogin: vi.fn(),
  handleLogout: vi.fn()
};

describe('AuthSessionContext', () => {
  it('provides the current auth session to child hooks', () => {
    const { result } = renderHook(() => useAuthSessionContext(), {
      wrapper: ({ children }) => (
        <AuthSessionProvider value={authSession}>{children}</AuthSessionProvider>
      )
    });

    expect(result.current.user).toEqual(staffUser);
    expect(result.current.email).toBe('staff@example.com');
    expect(result.current.visitorCount).toBe(4);
  });

  it('fails fast when used outside the provider', () => {
    expect(() => renderHook(() => useAuthSessionContext())).toThrow(
      'useAuthSessionContext must be used within AuthSessionProvider'
    );
  });
});
