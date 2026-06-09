import {
  LayoutDashboard,
  Users,
  Building2,
  Contact,
  Target,
  FileText,
  ListOrdered,
  Upload,
  Send,
  CalendarClock,
  PhoneForwarded,
  Shield,
  Mail,
  MousePointerClick,
  UserX,
  Zap,
  BarChart2,
  PieChart,
  KanbanSquare,
  Settings,
  StickyNote,
  Activity,
  Wrench,
  MessageCircle,
  UserCog,
  ShieldCheck,
  Users2,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/hooks/use-workspace";
import { roleAtLeast } from "@/lib/permissions";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  // Minimum role required to see/use this item. Defaults to "viewer".
  minRole?: AppRole;
  // When true, only the platform super admin sees this item.
  superAdminOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigationConfig: NavGroup[] = [
  {
    label: "Main",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, description: "Overview of your sales pipeline and activity" },
      { name: "Outreach Dashboard", href: "/outreach-dashboard", icon: Activity, description: "Activity-based outbound reporting" },
      { name: "Leads", href: "/leads", icon: Users, description: "Manage your leads and CRM data" },
      { name: "Companies", href: "/companies", icon: Building2, description: "Track companies and accounts" },
      { name: "Contacts", href: "/contacts", icon: Contact, description: "Manage outbound contacts" },
      { name: "Campaigns", href: "/campaigns", icon: Target, description: "Organize contacts into campaigns" },
      { name: "Email Templates", href: "/templates", icon: FileText, description: "Standardized outreach templates" },
      { name: "Sequences", href: "/sequences", icon: ListOrdered, description: "Multi-step email sequences" },
      { name: "CSV Uploads", href: "/csv-uploads", icon: Upload, description: "Import contacts via CSV" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { name: "Outbox", href: "/outbox", icon: Send, description: "Your outbound email queue" },
      { name: "Scheduled Emails", href: "/scheduled-emails", icon: CalendarClock, description: "Manage scheduled outbound sends" },
      { name: "Tasks", href: "/follow-ups", icon: PhoneForwarded, description: "Sales tasks and follow-ups" },
      { name: "Deliverability", href: "/deliverability", icon: Shield, description: "Monitor email deliverability health" },
      { name: "Opens and Clicks", href: "/opens-clicks", icon: MousePointerClick, description: "Track email engagement metrics" },
      { name: "Unsubscribes", href: "/unsubscribes", icon: UserX, description: "Manage suppression list" },
    ],
  },
  {
    label: "Qualification",
    items: [
      { name: "Intent Signals", href: "/intent-signals", icon: Zap, description: "Track buyer intent signals" },
      { name: "Lead Scoring", href: "/lead-scoring", icon: BarChart2, description: "Score and prioritize leads" },
      { name: "Segments", href: "/segments", icon: PieChart, description: "Group contacts by criteria" },
      { name: "Pipeline", href: "/pipeline", icon: KanbanSquare, description: "Visual deal pipeline" },
    ],
  },
  {
    label: "Admin",
    items: [
      { name: "Settings", href: "/settings", icon: Settings, description: "Application settings", minRole: "manager" },
      { name: "Email Providers", href: "/providers", icon: Mail, description: "Connect mailboxes and configure sending", minRole: "manager" },
      { name: "Reply Review", href: "/reply-review", icon: MessageCircle, description: "Review uncertain email replies" },
      { name: "Team Notes", href: "/team-notes", icon: StickyNote, description: "Shared notes and documentation" },
      { name: "Activity Log", href: "/activity-log", icon: Activity, description: "System activity history", minRole: "manager" },
      { name: "CRM Maintenance", href: "/crm-maintenance", icon: Wrench, description: "Reset outreach history for a clean campaign", minRole: "workspace_admin" },
    ],
  },
  {
    label: "User Management",
    items: [
      { name: "Workspace Members", href: "/members", icon: Users2, description: "Invite and manage members of this workspace", minRole: "workspace_admin" },
      { name: "Access & Permissions", href: "/access", icon: ShieldCheck, description: "Roles and what each can do" },
      { name: "All Users", href: "/users", icon: UserCog, description: "Manage users across every workspace", superAdminOnly: true },
    ],
  },
];

const legacyRouteAliases: Record<string, string> = {
  "/outreach": "/outbox",
  "/tasks": "/follow-ups",
  "/data": "/csv-uploads",
  "/ob/contacts": "/contacts",
  "/ob/upload": "/csv-uploads",
  "/ob/campaigns": "/campaigns",
  "/ob/sequences": "/sequences",
  "/ob/queue": "/scheduled-emails",
  "/ob/suppression": "/unsubscribes",
};

export function resolveCanonicalPath(path: string): string {
  return legacyRouteAliases[path] || path;
}

export function getPageTitle(path: string): string | undefined {
  const canonical = resolveCanonicalPath(path);
  for (const group of navigationConfig) {
    for (const item of group.items) {
      if (item.href === canonical) return item.name;
    }
  }
  return undefined;
}

export function isActiveRoute(currentPath: string, itemHref: string): boolean {
  const canonical = resolveCanonicalPath(currentPath);
  if (itemHref === "/") return canonical === "/";
  return canonical === itemHref || canonical.startsWith(itemHref + "/");
}

// True when a user with the given role (and super-admin flag) may see/use the
// nav item, honoring both superAdminOnly and minRole.
export function canSeeNavItem(
  item: NavItem,
  role: AppRole,
  isSuperAdmin: boolean,
): boolean {
  if (item.superAdminOnly) return isSuperAdmin;
  if (isSuperAdmin) return true;
  if (!item.minRole) return true;
  return roleAtLeast(role, item.minRole);
}

// Returns only the groups (and items) visible to the given role, dropping any
// group that ends up empty.
export function visibleNavigation(
  role: AppRole,
  isSuperAdmin: boolean,
): NavGroup[] {
  return navigationConfig
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canSeeNavItem(item, role, isSuperAdmin),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
