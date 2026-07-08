import { useEffect, useState, type FormEvent } from 'react';
import {
  clearStoredToken,
  fetchCurrentUser,
  getOrCreateDeviceId,
  login,
  registerDemoVisitor,
  storeToken
} from '../api';
import type { User } from '../types';

type UseAuthSessionOptions = {
  onAuthenticated: (user: User) => Promise<void>;
  onReset: () => void;
  onError: (message: string | null) => void;
};

export function useAuthSession({ onAuthenticated, onReset, onError }: UseAuthSessionOptions) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('staff@example.com');
  const [password, setPassword] = useState('Staff123!');
  const [isIntroOpen, setIsIntroOpen] = useState(true);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    void restoreSession();
    void registerVisitor();
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      resetSession();
      onError('Your session expired. Please sign in again.');
    }

    window.addEventListener('restaurant-ops:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('restaurant-ops:unauthorized', handleUnauthorized);
  }, []);

  async function restoreSession() {
    try {
      setIsSessionLoading(true);
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      await onAuthenticated(currentUser);
      onError(null);
    } catch {
      resetSession();
      onError(null);
    } finally {
      setIsSessionLoading(false);
    }
  }

  async function registerVisitor() {
    try {
      const result = await registerDemoVisitor(getOrCreateDeviceId());
      setVisitorCount(result.visitorCount);
    } catch {
      setVisitorCount(null);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsLoggingIn(true);
      const session = await login({ email, password });
      storeToken(session.accessToken);
      setUser(session.user);
      await onAuthenticated(session.user);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to log in');
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    resetSession();
    onError(null);
  }

  function resetSession() {
    clearStoredToken();
    setUser(null);
    onReset();
  }

  return {
    user,
    email,
    password,
    isIntroOpen,
    visitorCount,
    isSessionLoading,
    isLoggingIn,
    setEmail,
    setPassword,
    openIntro: () => setIsIntroOpen(true),
    closeIntro: () => setIsIntroOpen(false),
    handleLogin,
    handleLogout
  };
}
