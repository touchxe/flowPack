"use client";

import { Suspense } from "react";
import { LoginForm } from "./login-form";

function LoginLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-pulse space-y-6">
        <div className="h-8 w-32 mx-auto bg-muted rounded" />
        <div className="h-4 w-48 mx-auto bg-muted rounded" />
        <div className="space-y-4">
          <div className="h-10 w-full bg-muted rounded" />
          <div className="h-10 w-full bg-muted rounded" />
          <div className="h-10 w-full bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Suspense fallback={<LoginLoading />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
