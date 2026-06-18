import type { User } from '../types';

type AppHeaderProps = {
  user: User;
  isLoading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
};

export function AppHeader({ user, isLoading, onRefresh, onLogout }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Restaurant Ops</p>
        <h1>Restaurant Order Manager</h1>
      </div>
      <div className="user-actions">
        <span>{user.name} · {user.role}</span>
        <button className="ghost-button" onClick={onRefresh} disabled={isLoading}>
          Refresh
        </button>
        <button className="ghost-button" onClick={onLogout}>
          Sign Out
        </button>
      </div>
    </header>
  );
}
