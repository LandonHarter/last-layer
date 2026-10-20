"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export function signInWithGoogle() {
  return authClient.signIn.social({ provider: "google", callbackURL: window.location.pathname });
}

/** Sign out, then reload so every store goes back to this browser's data. */
export async function signOut() {
  await authClient.signOut();
  window.location.reload();
}
