import { ReactNode, useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { useClerk } from "@clerk/react";
import { NotificationCenter } from "@/components/notification-center";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Check } from "lucide-react";
import { visibleNavigation, isActiveRoute, getPageTitle } from "@/lib/navigation";
import {
  platformNavigationConfig,
  getPlatformPageTitle,
  isPlatformActiveRoute,
} from "@/lib/platform-navigation";
import { PLATFORM, CURRENT_WORKSPACE } from "@/config/branding";
import { useWorkspace, type WorkspaceSummary } from "@/hooks/use-workspace";
import { roleLabel } from "@/lib/permissions";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const STORAGE_KEY = "a3-sidebar-collapsed";

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  return [collapsed, toggle] as const;
}

// ── White-label theming ────────────────────────────────────────────────────
// Convert a "#rrggbb" hex to the "H S% L%" triplet the app's --primary CSS var
// expects. Non-hex values (already a triplet) are returned untouched.
function hexToHslTriplet(value: string): string | null {
  const v = value.trim();
  if (!v.startsWith("#")) return v.length ? v : null;
  let hex = v.slice(1);
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const THEMED_VARS = ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"];

// Apply a workspace's primary color while in the workspace shell; clear it (so
// the OpyPal default from the stylesheet applies) on the platform shell.
function useApplyWorkspaceTheme(active: boolean, primaryColor?: string | null) {
  useEffect(() => {
    const root = document.documentElement;
    const triplet = active && primaryColor ? hexToHslTriplet(primaryColor) : null;
    if (triplet) {
      for (const v of THEMED_VARS) root.style.setProperty(v, triplet);
    } else {
      for (const v of THEMED_VARS) root.style.removeProperty(v);
    }
    return () => {
      for (const v of THEMED_VARS) root.style.removeProperty(v);
    };
  }, [active, primaryColor]);
}

// ── Brand marks ────────────────────────────────────────────────────────────
function PlatformBrand({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
        <div className="h-4 w-4 rounded-full border-[3px] border-accent" />
      </div>
    );
  }
  return (
    <img src={`${basePath}/logo.svg`} alt={PLATFORM.name} className="h-9 w-auto" />
  );
}

function WorkspaceBrand({
  collapsed,
  workspace,
}: {
  collapsed: boolean;
  workspace: WorkspaceSummary | null;
}) {
  const initials =
    workspace?.shortCode ?? workspace?.initials ?? CURRENT_WORKSPACE.initials;
  const name = workspace?.name ?? CURRENT_WORKSPACE.name;

  if (workspace?.logoUrl) {
    return (
      <img
        src={workspace.logoUrl}
        alt={name}
        className={collapsed ? "h-9 w-9 rounded-xl object-contain" : "h-9 w-auto max-w-[150px] object-contain"}
      />
    );
  }

  // Fallback: a branded initials badge (uses the workspace primary color via
  // the --primary CSS var applied by useApplyWorkspaceTheme).
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center shadow-md flex-shrink-0 text-primary-foreground text-xs font-bold">
        {initials}
      </div>
      {!collapsed && <span className="font-semibold truncate">{name}</span>}
    </div>
  );
}

function NavLink({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`
        flex items-center gap-3 rounded-xl font-medium transition-all duration-200 group text-sm
        ${collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"}
        ${isActive
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }
      `}
    >
      <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary transition-colors"}`} />
      {!collapsed && <span className="truncate">{item.name}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

function SidebarFooter({
  collapsed,
  onToggle,
  showCollapseToggle,
  initials,
  primaryLabel,
  secondaryLabel,
}: {
  collapsed: boolean;
  onToggle: () => void;
  showCollapseToggle: boolean;
  initials: string;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  const { signOut } = useClerk();
  return (
    <div className={`border-t border-border ${collapsed ? "p-2" : "p-4"}`}>
      {!collapsed && (
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
            {initials}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold truncate">{primaryLabel}</span>
            <span className="text-xs text-muted-foreground truncate">{secondaryLabel}</span>
          </div>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => signOut({ redirectUrl: basePath || "/" })}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Log out</TooltipContent>
          </Tooltip>
        </div>
      )}
      {collapsed && (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center justify-center rounded-xl w-full py-2.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>Log out</TooltipContent>
        </Tooltip>
      )}

      {showCollapseToggle && (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={onToggle}
              className={`
                flex items-center gap-3 rounded-xl font-medium transition-all duration-200 text-sm
                text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full
                ${collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5 mt-1"}
              `}
            >
              {collapsed ? (
                <PanelLeft className="h-5 w-5" />
              ) : (
                <>
                  <PanelLeftClose className="h-5 w-5 flex-shrink-0" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" sideOffset={8}>
              Expand sidebar
            </TooltipContent>
          )}
        </Tooltip>
      )}

      {!collapsed && (
        <div className="px-3 pt-3 mt-1 border-t border-border/60">
          <span className="text-[10px] text-muted-foreground/60">
            Powered by {PLATFORM.name}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Workspace shell sidebar ────────────────────────────────────────────────
function WorkspaceSidebar({
  location,
  collapsed,
  onToggle,
  onNavigate,
  showCollapseToggle = true,
}: {
  location: string;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
}) {
  const {
    me,
    currentWorkspace,
    currentRole,
    setCurrentWorkspaceId,
    returnToPlatform,
  } = useWorkspace();
  const [, setLocation] = useLocation();
  const workspaces = me?.workspaces ?? [];
  const isSuper = me?.isSuperAdmin ?? false;
  const canSwitch = workspaces.length > 1;
  const wsName = currentWorkspace?.name ?? CURRENT_WORKSPACE.name;
  const wsInitials = currentWorkspace?.initials ?? CURRENT_WORKSPACE.initials;
  const wsRoleLabel = isSuper ? "Super Admin" : roleLabel(currentRole);
  const navGroups = visibleNavigation(currentRole, isSuper);

  const goPlatform = () => {
    returnToPlatform();
    setLocation("/platform");
    onNavigate?.();
  };

  return (
    <>
      <div className={`flex items-center ${collapsed ? "justify-center p-4 pb-3" : "p-6 pb-4"}`}>
        {canSwitch ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex items-center gap-3 rounded-lg transition-colors hover:bg-sidebar-accent/60 ${collapsed ? "p-1" : "-mx-2 px-2 py-1.5 w-full"}`}
                aria-label="Switch workspace"
              >
                <WorkspaceBrand collapsed={collapsed} workspace={currentWorkspace} />
                {!collapsed && (
                  <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>
                {isSuper ? "Switch workspace" : "Your workspaces"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setCurrentWorkspaceId(ws.id)}
                  className="gap-2"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary flex-shrink-0">
                    {ws.shortCode ?? ws.initials ?? ws.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="truncate">{ws.name}</span>
                  {ws.id === currentWorkspace?.id && (
                    <Check className="ml-auto h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
              {isSuper && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={goPlatform} className="gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>Platform admin</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-3">
            <WorkspaceBrand collapsed={collapsed} workspace={currentWorkspace} />
          </div>
        )}
      </div>

      {isSuper && !collapsed && (
        <div className="px-4 pb-2">
          <button
            onClick={goPlatform}
            className="flex w-full items-center gap-2 rounded-lg border border-border/70 bg-sidebar-accent/40 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to platform
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto py-2 space-y-1 ${collapsed ? "px-2" : "px-4"}`}>
        {navGroups.map((group, gi) => (
          <div key={group.label}>
            <div className={gi > 0 ? "pt-4 pb-1" : "pb-1"}>
              {!collapsed ? (
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </span>
              ) : (
                gi > 0 && <div className="mx-auto w-8 border-t border-border" />
              )}
            </div>

            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActiveRoute(location, item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </div>

      <SidebarFooter
        collapsed={collapsed}
        onToggle={onToggle}
        showCollapseToggle={showCollapseToggle}
        initials={wsInitials ?? "AV"}
        primaryLabel={me?.email ?? wsName}
        secondaryLabel={wsRoleLabel}
      />
    </>
  );
}

// ── Platform shell sidebar ─────────────────────────────────────────────────
function PlatformSidebar({
  location,
  collapsed,
  onToggle,
  onNavigate,
  showCollapseToggle = true,
}: {
  location: string;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
}) {
  const { me } = useWorkspace();

  return (
    <>
      <div className={`flex items-center ${collapsed ? "justify-center p-4 pb-3" : "p-6 pb-4"}`}>
        <PlatformBrand collapsed={collapsed} />
        {!collapsed && (
          <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            Platform
          </span>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto py-2 space-y-1 ${collapsed ? "px-2" : "px-4"}`}>
        {platformNavigationConfig.map((group, gi) => (
          <div key={group.label}>
            <div className={gi > 0 ? "pt-4 pb-1" : "pb-1"}>
              {!collapsed ? (
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </span>
              ) : (
                gi > 0 && <div className="mx-auto w-8 border-t border-border" />
              )}
            </div>

            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                isActive={isPlatformActiveRoute(location, item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </div>

      <SidebarFooter
        collapsed={collapsed}
        onToggle={onToggle}
        showCollapseToggle={showCollapseToggle}
        initials="SA"
        primaryLabel={me?.email ?? "Super Admin"}
        secondaryLabel="Super Admin"
      />
    </>
  );
}

// ── Shell chrome (shared by both shells) ───────────────────────────────────
export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useCollapsed();
  const { scope, currentWorkspace } = useWorkspace();
  // The route is the source of truth for which shell renders: any "/platform/*"
  // page is always the platform shell (no flash even if persisted scope lags).
  // "/users" and "/access" are shared pages — they follow the active scope so a
  // super admin reaching them from the platform sidebar keeps the platform shell.
  const onPlatformRoute =
    location === "/platform" || location.startsWith("/platform/");
  const isSharedRoute = location === "/users" || location === "/access";
  const isPlatform = onPlatformRoute || (isSharedRoute && scope === "platform");

  useApplyWorkspaceTheme(!isPlatform, currentWorkspace?.primaryColor);

  const pageTitle = isPlatform
    ? getPlatformPageTitle(location) ?? PLATFORM.name
    : getPageTitle(location) || currentWorkspace?.name || CURRENT_WORKSPACE.name;

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const renderSidebar = (opts: {
    collapsed: boolean;
    onToggle: () => void;
    onNavigate?: () => void;
    showCollapseToggle?: boolean;
  }) =>
    isPlatform ? (
      <PlatformSidebar location={location} {...opts} />
    ) : (
      <WorkspaceSidebar location={location} {...opts} />
    );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-sidebar h-full z-10 flex-shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {renderSidebar({ collapsed, onToggle: toggleCollapsed })}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {renderSidebar({
              collapsed: false,
              onToggle: () => {},
              onNavigate: () => setMobileOpen(false),
              showCollapseToggle: false,
            })}
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-14 flex items-center justify-between px-4 sm:px-6 bg-card border-b border-border z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="font-semibold text-base truncate">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {!isPlatform && <NotificationCenter />}
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-muted/30 p-4 sm:p-6">
          <div className="mx-auto max-w-[1400px] h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
