import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type AppErrorContextValue = {
  error: string | null;
  setError: (message: string | null) => void;
  clearError: () => void;
};

const AppErrorContext = createContext<AppErrorContextValue | null>(null);

export function AppErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      error,
      setError,
      clearError: () => setError(null)
    }),
    [error]
  );

  return <AppErrorContext.Provider value={value}>{children}</AppErrorContext.Provider>;
}

export function useAppError() {
  const context = useContext(AppErrorContext);

  if (!context) {
    throw new Error('useAppError must be used within AppErrorProvider');
  }

  return context;
}
