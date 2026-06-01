import { Link } from "wouter";
import { useClerk } from "@clerk/react";
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
  Check,
  ChevronsUpDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ReactNode } from "react";
import { PLATFORM } from "@/config/branding";
import { useWorkspace } from "@/hooks/use-workspace";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function WorkspaceSwitcher() {
  const { me, currentWorkspace, setCurrentWorkspaceId } = useWorkspace();
  const workspaces = me?.workspaces ?? [];

  if (!currentWorkspace) {
    return (
      <span className="font-bold text-xl tracking-tight text-primary leading-none">
        {PLATFORM.name}
      </span>
    );
  }

  // Only super admins (or users with >1 workspace) get an interactive switcher.
  const canSwitch = (me?.isSuperAdmin ?? false) || workspaces.length > 1;

  if (!canSwitch) {
    return (
      <div className="flex flex-col items-center">
        <span className="font-bold text-xl tracking-tight text-primary leading-none">
          {currentWorkspace.name}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mt-1">
          {currentWorkspace.roleLabel ?? PLATFORM.foundation}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent transition-colors outline-none">
        <Building2 className="w-4 h-4 text-primary" />
        <div className="flex flex-col items-start">
          <span className="font-bold text-base tracking-tight text-primary leading-none">
            {currentWorkspace.name}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mt-0.5">
            {me?.isSuperAdmin ? PLATFORM.name : currentWorkspace.roleLabel ?? PLATFORM.foundation}
          </span>
        </div>
        <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={() => setCurrentWorkspaceId(w.id)}
            className="flex items-center justify-between"
          >
            <span>{w.name}</span>
            {w.id === currentWorkspace.id && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {me?.isSuperAdmin && (
          <>
            <DropdownMenuSeparator />
            <Link href="/admin/workspaces">
              <DropdownMenuItem className="text-primary">
                Manage workspaces…
              </DropdownMenuItem>
            </Link>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();
  const { me } = useWorkspace();

  const handleLogout = () => {
    signOut({ redirectUrl: basePath || "/" });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gray-50">
        <Sidebar className="border-r border-gray-200">
          <SidebarHeader className="h-16 flex flex-col items-center justify-center border-b border-gray-200">
            <WorkspaceSwitcher />
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
              {me?.isSuperAdmin && (
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
                <div className="px-2 pb-2 text-xs text-muted-foreground truncate" title={me.email}>
                  {me.email}
                </div>
              )}
              <SidebarMenuButton
                onClick={handleLogout}
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
