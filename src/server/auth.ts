import { type GetServerSidePropsContext } from "next";
import { createServerClient } from "@supabase/ssr";
import { type Session, type User } from "@supabase/supabase-js";
import { env } from "~/env.mjs";
import { prisma } from "~/server/db";

export interface SessionUser {
  id: string;
  email: string | undefined;
  name: string | null;
  image: string | null;
  stripeSubscriptionStatus: string | null;
}

export interface AuthSession {
  user: SessionUser;
  expires: string;
}

export const getServerAuthSession = async (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}): Promise<AuthSession | null> => {
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return ctx.req.cookies[name];
        },
        set(name: string, value: string, options: any) {
          ctx.res.setHeader("Set-Cookie", `${name}=${value}; Path=/; ${options.maxAge ? `Max-Age=${options.maxAge};` : ''} ${options.httpOnly ? 'HttpOnly;' : ''} ${options.secure ? 'Secure;' : ''} ${options.sameSite ? `SameSite=${options.sameSite};` : ''}`);
        },
        remove(name: string, options: any) {
          ctx.res.setHeader("Set-Cookie", `${name}=; Path=/; Max-Age=0`);
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const userProfile = await prisma.userProfile.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      avatarUrl: true,
      stripeSubscriptionStatus: true,
    },
  });

  if (!userProfile) {
    await prisma.userProfile.create({
      data: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
        avatarUrl: session.user.user_metadata?.avatar_url || null,
      },
    });
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: userProfile?.name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
      image: userProfile?.avatarUrl || session.user.user_metadata?.avatar_url || null,
      stripeSubscriptionStatus: userProfile?.stripeSubscriptionStatus || null,
    },
    expires: new Date(session.expires_at! * 1000).toISOString(),
  };
};

export const getServerUser = async (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}): Promise<User | null> => {
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return ctx.req.cookies[name];
        },
        set(name: string, value: string, options: any) {
          ctx.res.setHeader("Set-Cookie", `${name}=${value}; Path=/; ${options.maxAge ? `Max-Age=${options.maxAge};` : ''} ${options.httpOnly ? 'HttpOnly;' : ''} ${options.secure ? 'Secure;' : ''} ${options.sameSite ? `SameSite=${options.sameSite};` : ''}`);
        },
        remove(name: string, options: any) {
          ctx.res.setHeader("Set-Cookie", `${name}=; Path=/; Max-Age=0`);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
};
