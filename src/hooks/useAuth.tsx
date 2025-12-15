import { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDemo: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isDemo: false,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent noisy re-renders on window refocus when Supabase emits duplicate auth events.
  const userIdRef = useRef<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Failsafe timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.log('Auth loading timeout, setting loading to false');
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    const applyAuthState = (event: string, nextSession: Session | null) => {
      if (!mounted) return;

      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const nextAccessToken = nextSession?.access_token ?? null;

      // If nothing materially changed (common on tab focus), ignore to avoid resetting pages/forms.
      if (
        event === 'SIGNED_IN' &&
        nextUserId &&
        userIdRef.current === nextUserId &&
        accessTokenRef.current === nextAccessToken
      ) {
        setLoading(false);
        clearTimeout(loadingTimeout);
        return;
      }

      console.log('Auth state change:', event, nextUser?.email);

      if (userIdRef.current !== nextUserId) {
        userIdRef.current = nextUserId;
        setUser(nextUser);
      }

      if (accessTokenRef.current !== nextAccessToken) {
        accessTokenRef.current = nextAccessToken;
        setSession(nextSession);
      }

      setLoading(false);
      clearTimeout(loadingTimeout);
    };

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      applyAuthState(event, nextSession);
    });

    // THEN check for existing session
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (!mounted) return;
        console.log('Get session result:', initialSession?.user?.email, error);
        applyAuthState('INITIAL_SESSION', initialSession);
      })
      .catch((error) => {
        console.error('Error getting session:', error);
        if (mounted) {
          setLoading(false);
          clearTimeout(loadingTimeout);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isDemo: !user && !loading,
      signOut,
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
