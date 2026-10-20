"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { readItem, startAccount, writeItem } from "@/lib/storage";
import { THEME_KEY } from "@/lib/user-data";

export type AccountUser = { name: string; email: string; image?: string | null };
export type Account = { user: AccountUser; onboarded: boolean; data: Record<string, unknown> };

const AccountContext = createContext<AccountUser | null>(null);

/** The signed-in user, or null. */
export const useAccount = () => useContext(AccountContext);

/**
 * Signed in, every store reads and writes the account's data (loaded with the
 * page) instead of localStorage. This has to happen before any store is read,
 * so it runs while rendering, above everything that uses one.
 */
export function AccountProvider({ account, children }: { account: Account | null; children: React.ReactNode }) {
  if (account) startAccount(account.data);
  return (
    <AccountContext.Provider value={account?.user ?? null}>
      {children}
      {account && <ThemeSync />}
      {account && !account.onboarded && <OnboardingDialog />}
    </AccountContext.Provider>
  );
}

/** next-themes keeps the theme in localStorage; signed in, the account's copy wins and follows changes. */
function ThemeSync() {
  const { theme, setTheme } = useTheme();
  const loaded = useRef(false);
  useEffect(() => {
    if (!theme) return;
    const saved = readItem(THEME_KEY);
    if (!loaded.current) {
      loaded.current = true;
      if (typeof saved === "string" && saved !== theme) return setTheme(saved);
    }
    if (saved !== theme) writeItem(THEME_KEY, theme);
  }, [theme, setTheme]);
  return null;
}
