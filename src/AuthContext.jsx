import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { getProfile, onAuthStateChange } from './auth';

const AuthContext = createContext(null);

/**
 * Wraps the app, exposing { user, profile, loading, signedIn } via
 * useAuth(). `user` is the raw Supabase auth user (id, email); `profile`
 * is the row from public.profiles (name, etc). Both are null until a
 * session is resolved.
 *
 * This is what makes "log in from any device" work: on mount, it asks
 * Supabase for the current session (which Supabase persists itself), and
 * if one exists, the user is signed in immediately — no separate
 * device-pairing or manual sync step needed, because the account isn't
 * tied to this browser at all anymore.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadInitialSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        try {
          const p = await getProfile(session.user.id);
          if (mounted) setProfile(p);
        } catch (e) {
          // Profile row might not exist yet (race with the on_auth_user_created
          // trigger right after signup) — not fatal, it'll resolve on next load.
          console.warn('Could not load profile yet:', e.message);
        }
      }
      if (mounted) setLoading(false);
    }

    loadInitialSession();

    const unsubscribe = onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        try {
          const p = await getProfile(session.user.id);
          if (mounted) setProfile(p);
        } catch (e) {
          console.warn('Could not load profile:', e.message);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = {
    user,                 // Supabase auth user: { id, email, ... } | null
    profile,              // public.profiles row: { id, email, name } | null
    loading,               // true until the initial session check resolves
    signedIn: !!user,
    refreshProfile: async () => {
      if (!user) return;
      const p = await getProfile(user.id);
      setProfile(p);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
