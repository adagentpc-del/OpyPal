import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export type AppRole =
  | "super_admin"
  | "workspace_admin"
  | "manager"
  | "operator"
  | "viewer"
  | "none";

// Which shell the super admin is currently in. Regular users are always in
// "workspace" scope and can never reach the platform shell.
export type Scope = "platform" | "workspace";

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
  // The signed-in user's role within this specific workspace.
  role?: AppRole;
}

export interface Me {
  email: string;
  isSuperAdmin: boolean;
  role: AppRole;
  platform: { name: string; foundation: string };
  workspaces: WorkspaceSummary[];
}

interface WorkspaceContextValue {
  me: Me | null;
  isLoading: boolean;
  currentWorkspace: WorkspaceSummary | null;
  // The user's effective role in the currently selected workspace
  // (super_admin everywhere for super admins).
  currentRole: AppRole;
  setCurrentWorkspaceId: (id: number) => void;
  // Platform ↔ workspace shell. Only super admins ever see "platform".
  scope: Scope;
  // Enter a workspace: select it and switch to the workspace shell.
  enterWorkspace: (id: number) => void;
  // Return to the platform shell (super admin only).
  returnToPlatform: () => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined,
);

const STORAGE_KEY = "opypal_current_workspace";
const SCOPE_KEY = "opypal_scope";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const [me, setMe] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentId, setCurrentId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [scope, setScope] = useState<Scope>(() => {
    return localStorage.getItem(SCOPE_KEY) === "workspace"
      ? "workspace"
      : "platform";
  });

  // Keep localStorage in sync so the fetch interceptor always stamps requests
  // with the active workspace, even on the very first render after load().
  useEffect(() => {
    if (currentId != null) {
      localStorage.setItem(STORAGE_KEY, String(currentId));
    }
  }, [currentId]);

  useEffect(() => {
    localStorage.setItem(SCOPE_KEY, scope);
  }, [scope]);

  // Keep the shell scope aligned with the current route for super admins, so
  // the platform/workspace shell never desyncs from the URL after a reload or
  // deep link. "/users", "/access" and "/" are neutral (shared between shells)
  // and keep whatever scope is already active.
  const [location] = useLocation();
  useEffect(() => {
    if (!me?.isSuperAdmin) return;
    const onPlatform =
      location === "/platform" || location.startsWith("/platform/");
    const neutral =
      location === "/users" || location === "/access" || location === "/";
    if (onPlatform) {
      setScope((s) => (s === "platform" ? s : "platform"));
    } else if (!neutral) {
      setScope((s) => (s === "workspace" ? s : "workspace"));
    }
  }, [location, me?.isSuperAdmin]);

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
      // Non-super-admins can never be in the platform shell.
      if (!data.isSuperAdmin) setScope("workspace");
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
    if (id === currentId) return;
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
    // Drop all cached data so nothing from the previous workspace bleeds into
    // the newly selected one; subsequent fetches re-run under the new context.
    queryClient.clear();
  };

  const enterWorkspace = (id: number) => {
    setCurrentWorkspaceId(id);
    setScope("workspace");
  };

  const returnToPlatform = () => {
    if (!me?.isSuperAdmin) return;
    setScope("platform");
  };

  const currentWorkspace =
    me?.workspaces.find((w) => w.id === currentId) ??
    me?.workspaces[0] ??
    null;

  const currentRole: AppRole = me?.isSuperAdmin
    ? "super_admin"
    : currentWorkspace?.role ?? "none";

  // Effective scope: only super admins may ever be in the platform shell.
  const effectiveScope: Scope = me?.isSuperAdmin ? scope : "workspace";

  return (
    <WorkspaceContext.Provider
      value={{
        me,
        isLoading,
        currentWorkspace,
        currentRole,
        setCurrentWorkspaceId,
        scope: effectiveScope,
        enterWorkspace,
        returnToPlatform,
        refresh: load,
      }}
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
