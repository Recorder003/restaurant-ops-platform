import { AuthScreen } from './AuthScreen';
import { useAppError } from '../context/AppErrorContext';
import { useAuthSessionContext } from '../context/AuthSessionContext';

export function AuthGate({ isLoading }: { isLoading: boolean }) {
  const { error } = useAppError();
  const {
    email,
    password,
    isIntroOpen,
    visitorCount,
    isLoggingIn,
    setEmail,
    setPassword,
    openIntro,
    closeIntro,
    handleLogin
  } = useAuthSessionContext();

  return (
    <AuthScreen
      email={email}
      password={password}
      isIntroOpen={isIntroOpen}
      visitorCount={visitorCount}
      error={error}
      isLoggingIn={isLoggingIn}
      isLoading={isLoading}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onLogin={handleLogin}
      onOpenIntro={openIntro}
      onCloseIntro={closeIntro}
    />
  );
}
