import { AppHeader } from './AppHeader';
import { useAuthSessionContext } from '../context/AuthSessionContext';

export function AuthenticatedHeader({
  isLoading,
  onRefresh
}: {
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const { user, handleLogout } = useAuthSessionContext();

  if (!user) {
    return null;
  }

  return <AppHeader user={user} isLoading={isLoading} onRefresh={onRefresh} onLogout={handleLogout} />;
}
