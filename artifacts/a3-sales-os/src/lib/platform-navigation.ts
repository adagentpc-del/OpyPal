import {
  LayoutDashboard,
  Building2,
  UserCog,
  Mail,
  FileText,
  ListOrdered,
  BarChart2,
  Activity,
  ShieldCheck,
  Settings,
} from "lucide-react";
import type { NavGroup } from "@/lib/navigation";

// Platform (super-admin) sidebar. Distinct from the workspace nav: these items
// operate across ALL workspaces. "Users" and "Permissions" intentionally reuse
// the existing cross-workspace pages (/users, /access).
export const platformNavigationConfig: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { name: "Dashboard", href: "/platform", icon: LayoutDashboard, description: "All workspaces and platform-wide metrics" },
      { name: "Workspaces", href: "/platform/workspaces", icon: Building2, description: "Create, edit, and enter workspaces" },
      { name: "Users", href: "/users", icon: UserCog, description: "Manage users across every workspace" },
      { name: "Provider Connections", href: "/platform/providers", icon: Mail, description: "Mailbox connection health across workspaces" },
    ],
  },
  {
    label: "Shared Content",
    items: [
      { name: "Global Templates", href: "/platform/templates", icon: FileText, description: "Template footprint across workspaces" },
      { name: "Global Sequences", href: "/platform/sequences", icon: ListOrdered, description: "Sequence footprint across workspaces" },
    ],
  },
  {
    label: "Insights",
    items: [
      { name: "Platform Analytics", href: "/platform/analytics", icon: BarChart2, description: "Aggregate metrics across all workspaces" },
      { name: "Audit Log", href: "/platform/audit-log", icon: Activity, description: "Platform-wide activity feed" },
    ],
  },
  {
    label: "Governance",
    items: [
      { name: "Permissions", href: "/access", icon: ShieldCheck, description: "Roles and what each can do" },
      { name: "Platform Settings", href: "/platform/settings", icon: Settings, description: "Platform configuration and super admins" },
    ],
  },
];

export function getPlatformPageTitle(path: string): string | undefined {
  for (const group of platformNavigationConfig) {
    for (const item of group.items) {
      if (item.href === path) return item.name;
    }
  }
  // Reused pages live at their own routes but belong to the platform shell.
  if (path === "/users") return "Users";
  if (path === "/access") return "Permissions";
  return undefined;
}

// Exact-match for "/platform" (so it isn't active on "/platform/workspaces"),
// prefix-match for the nested platform routes.
export function isPlatformActiveRoute(currentPath: string, itemHref: string): boolean {
  if (itemHref === "/platform") return currentPath === "/platform";
  return currentPath === itemHref || currentPath.startsWith(itemHref + "/");
}
