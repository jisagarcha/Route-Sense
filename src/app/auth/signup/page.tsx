"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("DISPATCHER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/auth/signin?registered=true");
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Kathmandu Artwork */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/ktm-hero.jpg"
          alt="Kathmandu Background"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* Frosted ambient backdrop */}
        <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="rounded-3xl border border-white/80 bg-white/90 backdrop-blur-2xl p-8 shadow-2xl">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-slate-950">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Join RouteSense to optimize your delivery routes
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                placeholder="John Doe"
              />
            </div>

            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="[email protected]"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full mt-1 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="DISPATCHER">Dispatcher</SelectItem>
                  <SelectItem value="DRIVER">Driver</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full bg-[#65000B] hover:bg-[#4d0008] text-white font-semibold transition"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <a href="/auth/signin" className="font-semibold text-[#65000B] hover:underline">
              Sign in
            </a>
          </div>
        </form>
      </Card>
      </div>
    </div>
  );
}
