"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, signup, signInWithGoogle } from "@/actions/auth";

type AuthTab = "login" | "signup";

export function AuthSection() {
  const [tab, setTab] = useState<AuthTab>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const action = tab === "login" ? login : signup;
    const result = await action(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // If no error, the action redirects — no need to setLoading(false)
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <section
      id="auth-section"
      className="py-20 lg:py-28 bg-slate-900 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: CTA */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Play?
          </h2>
          <p className="text-lg text-slate-400 mb-8 leading-relaxed">
            Create your own pool and invite your crew, or join an existing one
            with a code from your commissioner. It takes 30 seconds to get
            started.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg">Create a Pool</Button>
            <Button variant="secondary" size="lg">
              Join with Code
            </Button>
          </div>
        </div>

        {/* Right: Auth Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md mx-auto lg:mx-0 w-full">
          {/* Tabs */}
          <div className="flex border-b border-slate-700 mb-6">
            <button
              onClick={() => { setTab("login"); setError(null); }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors cursor-pointer ${
                tab === "login"
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setTab("signup"); setError(null); }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors cursor-pointer ${
                tab === "signup"
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "signup" && (
              <Input
                id="display-name"
                name="display-name"
                label="Display Name"
                placeholder="Your name"
                required
              />
            )}
            <Input
              id="email"
              name="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              required
            />
            <Input
              id="password"
              name="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              minLength={6}
            />

            {tab === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading
                ? "Loading..."
                : tab === "login"
                  ? "Log In"
                  : "Create Account"}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500 uppercase">
              or continue with
            </span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* OAuth */}
          <Button
            variant="secondary"
            className="w-full gap-2"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          {tab === "signup" && (
            <p className="text-xs text-slate-500 text-center mt-4">
              By signing up you agree to our{" "}
              <a href="#" className="text-slate-400 hover:text-white">
                Terms
              </a>{" "}
              and{" "}
              <a href="#" className="text-slate-400 hover:text-white">
                Privacy Policy
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
