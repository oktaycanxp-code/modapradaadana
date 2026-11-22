import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  idToken: string | null;
  isAdmin: boolean;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getFreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const verifyWithBackend = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setIdToken(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const token = await firebaseUser.getIdToken();
      setIdToken(token);
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { isAdmin: boolean };
        setIsAdmin(Boolean(data.isAdmin));
        setAuthError(null);
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      void verifyWithBackend(firebaseUser);
    });
    return () => unsub();
  }, [verifyWithBackend]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      await verifyWithBackend(result.user);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Google ile giriş yapılamadı.';
      setAuthError(message);
    }
  }, [verifyWithBackend]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setIdToken(null);
    setIsAdmin(false);
    setAuthError(null);
  }, []);

  const getFreshToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken(false);
    setIdToken(token);
    return token;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        isAdmin,
        loading,
        authError,
        signInWithGoogle,
        logout,
        getFreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
