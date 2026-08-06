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
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-10 shadow-2xl shadow-black/40">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Speclyn
          </h1>
          <p className="mt-3 text-base text-muted">
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
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder-muted/60 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-warning">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending || !password.trim()}
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loginMutation.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
