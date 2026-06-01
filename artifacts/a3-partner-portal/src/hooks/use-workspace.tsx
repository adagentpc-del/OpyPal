import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";

export interface WorkspaceSummary {
  id: number;
  name: string;
  slug: string;
  shortCode?: string | null;
  initials?: string | null;
  roleLabel?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  isActive?: boolean;
}

export interface Me {
  email: string;
  isSuperAdmin: boolean;
  role: "super_admin" | "workspace_admin" | "none";
  platform: { name: string; foundation: string };
  workspaces: WorkspaceSummary[];
}

interface WorkspaceContextValue {
  me: Me | null;
  isLoading: boolean;
  currentWorkspace: WorkspaceSummary | null;
  setCurrentWorkspaceId: (id: number) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined,
);

const STORAGE_KEY = "opypal_pp_current_workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentId, setCurrentId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (!res.ok) {
        setMe(null);
        return;
      }
      const data: Me = await res.json();
      setMe(data);
      setCurrentId((prev) => {
        if (prev && data.workspaces.some((w) => w.id === prev)) return prev;
        return data.workspaces[0]?.id ?? null;
      });
    } catch {
      setMe(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      void load();
    } else {
      setMe(null);
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn, load]);

  const setCurrentWorkspaceId = (id: number) => {
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const currentWorkspace =
    me?.workspaces.find((w) => w.id === currentId) ??
    me?.workspaces[0] ??
    null;

  return (
    <WorkspaceContext.Provider
      value={{ me, isLoading, currentWorkspace, setCurrentWorkspaceId, refresh: load }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
