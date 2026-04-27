import { useState, useEffect, useRef } from 'react';
import { isAuthenticated, handleCallback, signIn, signOut } from '../lib/auth';

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const exchanged = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      if (exchanged.current) return;
      exchanged.current = true;
      handleCallback(code)
        .then(() => {
          setAuthenticated(true);
          window.history.replaceState({}, '', '/');
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setAuthenticated(isAuthenticated());
      setLoading(false);
    }
  }, []);

  return {
    authenticated,
    loading,
    login: signIn,
    logout: () => {
      signOut();
      setAuthenticated(false);
    },
  };
}
