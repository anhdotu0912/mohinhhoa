"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "./types";

export type AuthState = {
  token: string | null;
  role: UserRole | null;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  setSession: (session: {
    token: string;
    role: UserRole;
    userId: string;
    email: string;
    displayName?: string | null;
  }) => void;
  setDisplayName: (name: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      role: null,
      userId: null,
      email: null,
      displayName: null,
      setSession: ({ token, role, userId, email, displayName }) =>
        set({
          token,
          role,
          userId,
          email,
          displayName: displayName ?? get().displayName,
        }),
      setDisplayName: (displayName) => set({ displayName }),
      logout: () =>
        set({
          token: null,
          role: null,
          userId: null,
          email: null,
          displayName: null,
        }),
      isAuthenticated: () => Boolean(get().token),
    }),
    { name: "vmec-auth" }
  )
);

export function homePathForRole(role: UserRole | null | undefined): string {
  return role === "doctor" ? "/doctor" : "/patient";
}
