import type { FormEvent } from 'react';

type AuthScreenProps = {
  email: string;
  password: string;
  isIntroOpen: boolean;
  visitorCount: number | null;
  error: string | null;
  isLoggingIn: boolean;
  isLoading: boolean;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onOpenIntro: () => void;
  onCloseIntro: () => void;
};

export function AuthScreen({
  email,
  password,
  isIntroOpen,
  visitorCount,
  error,
  isLoggingIn,
  isLoading,
  onEmailChange,
  onPasswordChange,
  onLogin,
  onOpenIntro,
  onCloseIntro
}: AuthScreenProps) {
  return (
    <main className="app-shell auth-shell">
      {isIntroOpen && <IntroModal onClose={onCloseIntro} />}

      <section className="login-panel">
        <p className="eyebrow">Restaurant Ops</p>
        <h1>Staff Sign In</h1>
        <a
          className="repo-link login-repo-link"
          href="https://github.com/Recorder003/restaurant-ops-platform"
          target="_blank"
          rel="noreferrer"
        >
          GitHub: Recorder003/restaurant-ops-platform
        </a>
        <button className="subtle-button guide-button" type="button" onClick={onOpenIntro}>
          View Demo Guide
        </button>

        {visitorCount !== null && (
          <div className="visitor-count">
            <span>Demo visitors</span>
            <strong>{visitorCount}</strong>
            <small>unique browser/device visits</small>
          </div>
        )}

        {error && <div className="alert">{error}</div>}

        <form className="login-form" onSubmit={onLogin}>
          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required
            />
          </label>

          <button className="primary-button" disabled={isLoggingIn || isLoading}>
            {isLoggingIn ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-accounts">
          <strong>Demo accounts</strong>
          <span>Staff: staff@example.com / Staff123!</span>
          <span>Chef: chef@example.com / Chef123!</span>
          <span>Admin: admin@example.com / Admin123!</span>
        </div>
      </section>
    </main>
  );
}

function IntroModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop intro-backdrop">
      <section className="intro-modal" role="dialog" aria-modal="true" aria-label="Project introduction">
        <p className="eyebrow">Live Demo Guide</p>
        <h2>Restaurant Operations Platform</h2>
        <p>
          This demo shows a restaurant workflow system for staff ordering, kitchen preparation,
          table management, checkout, receipts, split payments, menu combos, and admin operations.
        </p>
        <a
          className="repo-link"
          href="https://github.com/Recorder003/restaurant-ops-platform"
          target="_blank"
          rel="noreferrer"
        >
          View GitHub repository
        </a>

        <div className="intro-highlights">
          <span>Start with the prefilled staff account to create and manage orders.</span>
          <span>Use the chef account to prepare individual dishes and mark them ready.</span>
          <span>Use the admin account to manage menu items, tables, employees, and order history.</span>
        </div>

        <div className="intro-workflow">
          <strong>Suggested demo flow</strong>
          <ol>
            <li>Sign in as staff and create a dine-in order.</li>
            <li>Sign out, then sign in as chef to prepare the kitchen items.</li>
            <li>Mark dishes ready from the kitchen board.</li>
            <li>Sign back in as staff and mark ready dishes as served.</li>
            <li>Open checkout, apply a tip or split bill, then confirm payment.</li>
          </ol>
        </div>

        <div className="intro-accounts">
          <strong>Demo accounts</strong>
          <span>Staff: staff@example.com / Staff123!</span>
          <span>Chef: chef@example.com / Chef123!</span>
          <span>Admin: admin@example.com / Admin123!</span>
        </div>

        <button className="primary-button" type="button" onClick={onClose}>
          Start Demo
        </button>
      </section>
    </div>
  );
}
