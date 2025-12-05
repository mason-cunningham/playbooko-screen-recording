import {
  type GetServerSidePropsContext,
  type InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import Link from "next/link";
import { getServerAuthSession } from "~/server/auth";
import { supabase } from "~/lib/supabase";
import { useRouter } from "next/router";
import { useState } from "react";

const SignIn = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGitHubSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/videos`,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign in to Snapify</title>
        <meta
          name="description"
          content="Share high-quality videos asynchronously and collaborate on your own schedule"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f9fafb]">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <div className="animate-fade-in flex flex-col justify-center text-center">
            <span className="text-sm font-medium text-gray-700">
              Sign in with
            </span>
            {error && (
              <div className="mt-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="mt-6 grid grid-cols-1 gap-3">
              <button
                className="relative inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-lg text-sm font-medium text-gray-500 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                type="button"
                onClick={handleGitHubSignIn}
                disabled={loading}
              >
                <span className="flex flex-row">
                  <span>{loading ? "Signing in..." : "GitHub"}</span>
                </span>
              </button>
            </div>
            <p className="prose prose-sm mx-auto mt-6 max-w-[18rem] text-xs text-gray-500">
              By signing in, you agree to our{" "}
              <Link href="/legal/terms">Terms of Service</Link> and{" "}
              <Link href="/legal/privacy-policy">Privacy Policy</Link>.
            </p>
          </div>
        </div>
      </main>
    </>
  );
};

export default SignIn;

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerAuthSession(context);

  if (session) {
    return { redirect: { destination: "/videos" } };
  }

  return {
    props: {},
  };
}
