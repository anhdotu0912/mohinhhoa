"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AssignedDoctor, UserRole } from "./types";

export type AuthState = {
  token: string | null;
  role: UserRole | null;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  avatar: string | null;
  assignedDoctor: AssignedDoctor | null;
  setSession: (session: {
    token: string;
    role: UserRole;
    userId: string;
    email: string;
    displayName?: string | null;
    avatar?: string | null;
    assignedDoctor?: AssignedDoctor | null;
  }) => void;
  setUserProfile: (profile: {
    email?: string;
    displayName?: string | null;
    avatar?: string | null;
    assignedDoctor?: AssignedDoctor | null;
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
      assignedDoctor: null,
      setSession: ({ token, role, userId, email, displayName, avatar, assignedDoctor }) =>
        set({
          token,
          role,
          userId,
          email,
          displayName: displayName ?? get().displayName,
          avatar: avatar ?? get().avatar,
          assignedDoctor:
            assignedDoctor !== undefined ? assignedDoctor : get().assignedDoctor,
        }),
      setUserProfile: ({ displayName, avatar, assignedDoctor, email }) =>
        set((state) => ({
          displayName: displayName !== undefined ? displayName : state.displayName,
          email: email !== undefined ? email : state.email,
          avatar: avatar !== undefined ? avatar : state.avatar,
          assignedDoctor:
            assignedDoctor !== undefined ? assignedDoctor : state.assignedDoctor,
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
          assignedDoctor: null,
        }),
      isAuthenticated: () => Boolean(get().token),
    }),
    { name: "vmec-auth" }
  )
);

export function homePathForRole(role: UserRole | null | undefined): string {
  return role === "doctor" ? "/doctor" : "/patient";
}
