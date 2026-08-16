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
  avatar: string | null;
  setSession: (session: {
    token: string;
    role: UserRole;
    userId: string;
    email: string;
    displayName?: string | null;
    avatar?: string | null;
  }) => void;
  setUserProfile: (profile: {
    displayName?: string | null;
    avatar?: string | null;
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
      avatar: null,
      setSession: ({ token, role, userId, email, displayName, avatar }) =>
        set({
          token,
          role,
          userId,
          email,
          displayName: displayName ?? get().displayName,
          avatar: avatar ?? get().avatar,
        }),
      setUserProfile: ({ displayName, avatar }) =>
        set((state) => ({
          displayName: displayName !== undefined ? displayName : state.displayName,
          avatar: avatar !== undefined ? avatar : state.avatar,
        })),
      setDisplayName: (displayName) => set({ displayName }),
      logout: () =>
        set({
          token: null,
          role: null,
          userId: null,
          email: null,
          displayName: null,
          avatar: null,
        }),
      isAuthenticated: () => Boolean(get().token),
    }),
    { name: "vmec-auth" }
  )
);

export function homePathForRole(role: UserRole | null | undefined): string {
  return role === "doctor" ? "/doctor" : "/patient";
}
