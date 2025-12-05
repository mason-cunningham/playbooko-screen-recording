import { type AppType } from "next/app";
import { api } from "~/utils/api";

import "~/styles/globals.css";
import CrispChat from "~/components/CrispChat";
import posthog from "posthog-js";
import { PostHogProvider, usePostHog } from "posthog-js/react";
import { env } from "~/env.mjs";
import { type ReactNode, useEffect, useState, createContext, useContext } from "react";
import { supabase } from "~/lib/supabase";
import { type User, type Session } from "@supabase/supabase-js";
import { useRouter } from "next/router";

// Check that PostHog is client-side (used to handle Next.js SSR)
if (
  typeof window !== "undefined" &&
  !!env.NEXT_PUBLIC_POSTHOG_KEY &&
  !!env.NEXT_PUBLIC_POSTHOG_PROXY_HOST
) {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: env.NEXT_PUBLIC_POSTHOG_PROXY_HOST,
    loaded: (posthog) => {
      if (process.env.NODE_ENV === "development") posthog.debug();
    },
  });
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <AuthProvider>
      <PostHogProvider client={posthog}>
        <PostHogIdentificationWrapper>
          <Component {...pageProps} />
        </PostHogIdentificationWrapper>
        <CrispChat />
      </PostHogProvider>
    </AuthProvider>
  );
};

const PostHogIdentificationWrapper = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { user, loading } = useAuth();
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog?.__loaded || loading) return;
    if (user) {
      posthog?.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
      });
    }
  }, [posthog, user, loading]);

  return <div>{children}</div>;
};

export default api.withTRPC(MyApp);
