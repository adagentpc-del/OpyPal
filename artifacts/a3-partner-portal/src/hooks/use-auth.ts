import { z } from "zod";
import { create } from "zustand";

interface AuthState {
  isAuthenticated: boolean;
  login: (password: string, email: string) => boolean;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  isAuthenticated: localStorage.getItem("a3_auth") === "true",
  login: (password, email) => {
    if (email === "admin@a3visual.com" && password === "a3visual2024") {
      localStorage.setItem("a3_auth", "true");
      set({ isAuthenticated: true });
      return true;
    }
    return false;
  },
  logout: () => {
    localStorage.removeItem("a3_auth");
    set({ isAuthenticated: false });
  },
}));
