import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormEvent, ReactElement } from 'react';
import { AuthenticatedHeader } from './AuthenticatedHeader';
import { AuthGate } from './AuthGate';
import { createStaffUser } from '../test/factories';
import { renderWithAppProviders, type AuthSessionTestOverrides } from '../test/render';

const staffUser = createStaffUser();

describe('auth context consumers', () => {
  it('renders the authenticated header from session context', async () => {
    const onRefresh = vi.fn();
    const handleLogout = vi.fn();

    renderWithAuth(
      <AuthenticatedHeader isLoading={false} onRefresh={onRefresh} />,
      { user: staffUser, handleLogout }
    );

    expect(screen.getByText('Kent · staff')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(handleLogout).toHaveBeenCalled();
  });

  it('renders the auth screen from session context', async () => {
    const setEmail = vi.fn();
    const handleLogin = vi.fn(async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    renderWithAuth(<AuthGate isLoading={false} />, {
      user: null,
      setEmail,
      handleLogin,
      isIntroOpen: false
    });

    expect(screen.getByDisplayValue('staff@example.com')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } });
    expect(setEmail).toHaveBeenLastCalledWith('admin@example.com');

    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(handleLogin).toHaveBeenCalled();
  });
});

function renderWithAuth(
  ui: ReactElement,
  overrides: AuthSessionTestOverrides = {}
) {
  return renderWithAppProviders(ui, { authSession: { user: staffUser, ...overrides } });
}
