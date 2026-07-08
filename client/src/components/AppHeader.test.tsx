import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';
import { createStaffUser } from '../test/factories';

const staffUser = createStaffUser({ id: 'user-1' });

describe('AppHeader', () => {
  it('renders the current user name and role', () => {
    render(<AppHeader user={staffUser} isLoading={false} onRefresh={() => {}} onLogout={() => {}} />);

    expect(screen.getByText(/Kent/)).toHaveTextContent('Kent');
    expect(screen.getByText(/staff/)).toHaveTextContent('staff');
  });

  it('calls onRefresh when the user clicks Refresh', async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(<AppHeader user={staffUser} isLoading={false} onRefresh={onRefresh} onLogout={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('disables Refresh while data is loading', () => {
    render(<AppHeader user={staffUser} isLoading onRefresh={() => {}} onLogout={() => {}} />);

    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  });
});
