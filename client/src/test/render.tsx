import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { AppErrorProvider } from '../context/AppErrorContext';
import { AuthSessionProvider } from '../context/AuthSessionContext';
import { createStaffUser } from './factories';

type AuthSessionValue = React.ComponentProps<typeof AuthSessionProvider>['value'];
export type AuthSessionTestOverrides = Partial<AuthSessionValue>;

export function createAuthSessionValue(overrides: AuthSessionTestOverrides = {}): AuthSessionValue {
  const user = overrides.user === undefined ? createStaffUser() : overrides.user;

  return {
    user,
    email: user?.email ?? 'staff@example.com',
    password: 'Staff123!',
    isIntroOpen: true,
    visitorCount: 9,
    isSessionLoading: false,
    isLoggingIn: false,
    setEmail: vi.fn(),
    setPassword: vi.fn(),
    openIntro: vi.fn(),
    closeIntro: vi.fn(),
    handleLogin: vi.fn(),
    handleLogout: vi.fn(),
    ...overrides
  };
}

export function renderWithAppProviders(
  ui: ReactElement,
  options: RenderOptions & { authSession?: AuthSessionTestOverrides } = {}
) {
  const { authSession, ...renderOptions } = options;
  const value = createAuthSessionValue(authSession);

  return render(
    <AppErrorProvider>
      <AuthSessionProvider value={value}>{ui}</AuthSessionProvider>
    </AppErrorProvider>,
    renderOptions
  );
}
