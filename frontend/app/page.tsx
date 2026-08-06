"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { login, setToken, getToken, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");

  // Already authenticated in this browser? Go straight to the dashboard.
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  const loginMutation = useMutation({
    mutationFn: (pw: string) => login(pw),
    onSuccess: (data) => {
      // Pilot-stage storage; see lib/api.ts for the httpOnly-cookie upgrade path.
      setToken(data.token);
      router.push("/dashboard");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loginMutation.isPending) return;
    loginMutation.mutate(password);
  };

  const errorMessage =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.status === 401
        ? "Incorrect password. Please try again."
        : loginMutation.error.message
      : loginMutation.error
        ? "Something went wrong. Please try again."
        : null;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-10 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold tracking-[-0.01em] text-foreground">
              Speclyn
            </h1>
            <p className="mt-3 text-sm tracking-[0.02em] text-muted">
              Clinical documentation intelligence
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-muted"
              >
                Access password
              </label>
              <input
                id="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="h-11 w-full rounded-lg border border-border-strong bg-background px-4 text-foreground placeholder-muted outline-none transition focus:border-primary"
              />
            </div>

            {errorMessage && (
              <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger-bright">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending || !password.trim()}
              className="h-11 w-full rounded-lg bg-primary-strong px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Demo environment · No real patient data
        </p>
      </div>
    </main>
  );
}
