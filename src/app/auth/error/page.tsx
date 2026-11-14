"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: "Server Configuration Issue",
    description: "There is an issue with the authentication server configuration (e.g., missing NEXTAUTH_SECRET or database connection). If you are running locally, ensure your .env file is configured.",
  },
  AccessDenied: {
    title: "Access Denied",
    description: "You do not have permission to access this resource with your current account role.",
  },
  Verification: {
    title: "Verification Failed",
    description: "The verification link was invalid, expired, or has already been used.",
  },
  Default: {
    title: "Authentication Error",
    description: "An unexpected error occurred during the authentication process. Please try again.",
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorCode = searchParams.get("error") || "Default";
  const errorInfo = errorMessages[errorCode] || errorMessages.Default;

  return (
    <Card className="w-full max-w-md shadow-lg border-red-100">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="h-8 w-8" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">{errorInfo.title}</CardTitle>
        <CardDescription className="text-sm text-gray-600">
          {errorInfo.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {errorCode && (
          <div className="rounded-md bg-gray-50 p-3 text-center text-xs font-mono text-gray-500">
            Error Code: <span className="font-semibold text-gray-700">{errorCode}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={() => router.push("/auth/signin")}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sign In
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/")}
          className="w-full"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Go to Home
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <Suspense fallback={<div className="text-sm text-gray-500">Loading error details...</div>}>
        <AuthErrorContent />
      </Suspense>
    </div>
  );
}
