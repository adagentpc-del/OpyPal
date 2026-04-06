import { ReactNode, useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, PanelLeftClose, PanelLeft } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { navigationConfig, isActiveRoute, getPageTitle } from "@/lib/navigation";

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

function SidebarContent({
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
  return (
    <>
      <div className={`flex items-center ${collapsed ? "justify-center p-4 pb-3" : "p-6 pb-4"}`}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-primary rounded-lg flex items-center justify-center font-bold text-sm text-white shadow-md flex-shrink-0">
            A3
          </div>
          {!collapsed && (
            <span className="font-bold text-xl tracking-tight text-sidebar-foreground whitespace-nowrap">
              Sales OS
            </span>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto py-2 space-y-1 ${collapsed ? "px-2" : "px-4"}`}>
        {navigationConfig.map((group, gi) => (
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

      <div className={`border-t border-border ${collapsed ? "p-2" : "p-4"}`}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
              AV
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate">A3 Visual</span>
              <span className="text-xs text-muted-foreground truncate">Sales Team</span>
            </div>
          </div>
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
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useCollapsed();

  const pageTitle = getPageTitle(location) || "A3 Sales OS";

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-sidebar h-full z-10 flex-shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <SidebarContent
          location={location}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
        />
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
            <SidebarContent
              location={location}
              collapsed={false}
              onToggle={() => {}}
              onNavigate={() => setMobileOpen(false)}
              showCollapseToggle={false}
            />
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
            <NotificationCenter />
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
