"use client";

import { signIn } from "next-auth/react";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/" });
  };

  const handleDemoLogin = async (
    demoEmail: string,
    demoPassword: string,
    callbackUrl: string
  ) => {
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: demoEmail,
        password: demoPassword,
        redirect: false,
      });

      if (result?.error) {
        setError("Demo login failed. Please check credentials.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden px-4 py-8 sm:px-6 lg:px-8 flex items-center justify-center">
      {/* Background Kathmandu Artwork */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/ktm-hero.jpg"
          alt="Kathmandu Durbar Square Background"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* Soft frosted ambient backdrop */}
        <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl py-6">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left Column: Frosted Glass Panel */}
          <div className="rounded-3xl border border-white/80 bg-white/85 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="inline-flex items-center rounded-full border border-[#65000B]/25 bg-[#65000B]/10 px-3.5 py-1 text-xs font-semibold text-[#65000B]">
              RouteSense access
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                Sign in to RouteSense
              </h2>
              <p className="max-w-xl text-base leading-relaxed text-slate-700">
                Dispatch packages, track drivers, and manage live routes from a single workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() =>
                  handleDemoLogin(
                    "admin@admin.com",
                    "anihortes",
                    "/admin/map"
                  )
                }
                disabled={loading}
                className="h-12 justify-start border-white/80 bg-white/90 text-slate-900 shadow-2xs hover:border-[#65000B]/40 hover:bg-[#65000B]/10 transition"
              >
                Admin demo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() =>
                  handleDemoLogin(
                    "analyst@routesense.com",
                    "analyst",
                    "/admin/history"
                  )
                }
                disabled={loading}
                className="h-12 justify-start border-white/80 bg-white/90 text-slate-900 shadow-2xs hover:border-[#65000B]/40 hover:bg-[#65000B]/10 transition"
              >
                Analyst demo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() =>
                  handleDemoLogin(
                    "dispatcher@gmail.com",
                    "dispatcher",
                    "/dispatcher/routes/new"
                  )
                }
                disabled={loading}
                className="h-12 justify-start border-white/80 bg-white/90 text-slate-900 shadow-2xs hover:border-[#65000B]/40 hover:bg-[#65000B]/10 transition"
              >
                📦 Dispatcher demo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() =>
                  handleDemoLogin(
                    "rajesh.driver@delivery.com",
                    "driverdai",
                    "/driver"
                  )
                }
                disabled={loading}
                className="h-12 justify-start border-white/80 bg-white/90 text-slate-900 shadow-2xs hover:border-[#65000B]/40 hover:bg-[#65000B]/10 transition"
              >
                🚚 Driver demo
              </Button>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-sm p-4 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-[#65000B]">Manual access</p>
              <p className="mt-1 text-xs text-slate-600">
                Use your email and password to sign in, or continue with Google.
              </p>
            </div>
          </div>

          {/* Right Column: Frosted Login Card */}
          <Card className="rounded-3xl border border-white/80 bg-white/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-950">Welcome back</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Use your account to continue.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Email address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 bg-white/90"
                      placeholder="admin@admin.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 bg-white/90"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full bg-[#65000B] font-semibold text-white shadow-md hover:bg-[#4d0008] transition" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-slate-500 font-medium">Or continue with</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-slate-200 bg-white/95 text-slate-900 shadow-2xs hover:border-[#65000B]/40 hover:bg-[#65000B]/5 transition"
                  onClick={handleGoogleSignIn}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </Button>

                <div className="text-center text-sm text-slate-600">
                  Don&apos;t have an account?{" "}
                  <a href="/auth/signup" className="font-semibold text-[#65000B] hover:underline">
                    Sign up
                  </a>
                </div>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
