import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthScreen } from './AuthScreen';

const baseProps = {
  email: 'staff@example.com',
  password: 'Staff123!',
  isIntroOpen: false,
  visitorCount: null,
  error: null,
  isLoggingIn: false,
  isLoading: false,
  onEmailChange: () => {},
  onPasswordChange: () => {},
  onLogin: () => {},
  onOpenIntro: () => {},
  onCloseIntro: () => {}
};

describe('AuthScreen', () => {
  it('shows the normal sign-in action when idle', () => {
    render(<AuthScreen {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  it('shows a disabled progress action while signing in', () => {
    render(<AuthScreen {...baseProps} isLoggingIn />);

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  });

  it('renders the project guide when requested', () => {
    render(<AuthScreen {...baseProps} isIntroOpen />);

    expect(screen.getByRole('dialog', { name: 'Project introduction' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View GitHub repository' })).toHaveAttribute(
      'href',
      'https://github.com/Recorder003/restaurant-ops-platform'
    );
  });

  it('forwards login form edits, submit, and guide commands', async () => {
    const user = userEvent.setup();
    const onEmailChange = vi.fn();
    const onPasswordChange = vi.fn();
    const onLogin = vi.fn((event) => event.preventDefault());
    const onOpenIntro = vi.fn();
    const onCloseIntro = vi.fn();
    const { rerender } = render(<AuthScreen {...baseProps}
      visitorCount={42}
      error="Invalid credentials"
      onEmailChange={onEmailChange}
      onPasswordChange={onPasswordChange}
      onLogin={onLogin}
      onOpenIntro={onOpenIntro}
      onCloseIntro={onCloseIntro}
    />);

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), '.new');
    await user.type(screen.getByLabelText('Password'), '!');
    await user.click(screen.getByRole('button', { name: 'View Demo Guide' }));
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onEmailChange).toHaveBeenCalled();
    expect(onPasswordChange).toHaveBeenCalled();
    expect(onOpenIntro).toHaveBeenCalledOnce();
    expect(onLogin).toHaveBeenCalledOnce();

    rerender(<AuthScreen {...baseProps} isIntroOpen onCloseIntro={onCloseIntro} />);
    await user.click(screen.getByRole('button', { name: 'Start Demo' }));

    expect(onCloseIntro).toHaveBeenCalledOnce();
  });

  it('disables sign-in while the session is loading', () => {
    render(<AuthScreen {...baseProps} isLoading />);

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });
});
