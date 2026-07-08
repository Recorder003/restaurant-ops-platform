import { createContext, useContext, type ReactNode } from 'react';
import type { useAuthSession } from '../hooks/useAuthSession';

type AuthSessionContextValue = ReturnType<typeof useAuthSession>;

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({
  children,
  value
}: {
  children: ReactNode;
  value: AuthSessionContextValue;
}) {
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSessionContext() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSessionContext must be used within AuthSessionProvider');
  }

  return context;
}
