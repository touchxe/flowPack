"use client";

import { useEffect, useState } from "react";

export type AuthProviderId = "credentials" | "google" | "kakao" | "apple";

/** Fail closed in the UI: a provider is shown only after NextAuth confirms it. */
export function useAuthProviders(): ReadonlySet<AuthProviderId> {
  const [providers, setProviders] = useState<ReadonlySet<AuthProviderId>>(new Set());

  useEffect(() => {
    let active = true;
    fetch("/api/auth/providers", { cache: "no-store", credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("provider inventory unavailable");
        return response.json() as Promise<Record<string, unknown>>;
      })
      .then((inventory) => {
        if (!active) return;
        const known: AuthProviderId[] = ["credentials", "google", "kakao", "apple"];
        setProviders(new Set(known.filter((providerId) => Object.hasOwn(inventory, providerId))));
      })
      .catch(() => {
        if (active) setProviders(new Set());
      });
    return () => {
      active = false;
    };
  }, []);

  return providers;
}
