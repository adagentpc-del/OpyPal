import { useClerk } from "@clerk/react";
import { Link } from "wouter";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  FileText,
  Image as ImageIcon,
  DollarSign,
  LogOut,
  Building2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ReactNode } from "react";
import { PLATFORM, CURRENT_WORKSPACE } from "@/config/branding";
import { useWorkspace } from "@/hooks/use-workspace";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();
  const { me, currentWorkspace, setCurrentWorkspaceId } = useWorkspace();

  const isSuper = me?.isSuperAdmin ?? false;
  const wsName = currentWorkspace?.name ?? CURRENT_WORKSPACE.name;
  const roleLabel = isSuper
    ? PLATFORM.name
    : currentWorkspace?.roleLabel ?? CURRENT_WORKSPACE.roleLabel;
  const workspaces = me?.workspaces ?? [];
  const showSwitcher = isSuper || workspaces.length > 1;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gray-50">
        <Sidebar className="border-r border-gray-200">
          <SidebarHeader className="flex flex-col items-stretch gap-3 border-b border-gray-200 p-4">
            <div className="flex flex-col items-center">
              <span className="font-bold text-xl tracking-tight text-primary leading-none">
                {wsName}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mt-1">
                {roleLabel}
              </span>
            </div>
            {showSwitcher && workspaces.length > 0 && (
              <select
                value={currentWorkspace?.id ?? ""}
                onChange={(e) => setCurrentWorkspaceId(Number(e.target.value))}
                className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Switch workspace"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            )}
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href="/admin">
                  <SidebarMenuButton>
                    <LayoutDashboard className="w-5 h-5 mr-2" />
                    Dashboard
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/admin/partners">
                  <SidebarMenuButton>
                    <Users className="w-5 h-5 mr-2" />
                    Partners
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/admin/requests">
                  <SidebarMenuButton>
                    <FileText className="w-5 h-5 mr-2" />
                    Requests
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/admin/assets">
                  <SidebarMenuButton>
                    <ImageIcon className="w-5 h-5 mr-2" />
                    Assets
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/admin/pricing">
                  <SidebarMenuButton>
                    <DollarSign className="w-5 h-5 mr-2" />
                    Pricing
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              {isSuper && (
                <SidebarMenuItem>
                  <Link href="/admin/workspaces">
                    <SidebarMenuButton>
                      <Building2 className="w-5 h-5 mr-2" />
                      Workspaces
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
            <div className="absolute bottom-4 left-4 right-4">
              {me?.email && (
                <p className="mb-2 truncate px-2 text-xs text-muted-foreground">
                  {me.email}
                </p>
              )}
              <SidebarMenuButton
                onClick={() => signOut({ redirectUrl: basePath || "/" })}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Logout
              </SidebarMenuButton>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-16 flex-shrink-0 bg-white border-b border-gray-200 flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <h1 className="text-xl font-semibold">Partner Portal Admin</h1>
          </header>
          <div className="flex-1 overflow-auto p-8">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
