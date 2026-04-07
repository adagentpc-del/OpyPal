import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, FileText, Image as ImageIcon, DollarSign, LogOut } from "lucide-react";
import { ReactNode } from "react";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gray-50">
        <Sidebar className="border-r border-gray-200">
          <SidebarHeader className="h-16 flex items-center justify-center border-b border-gray-200">
            <span className="font-bold text-xl tracking-tight text-primary">A3 Visual</span>
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
            </SidebarMenu>
            <div className="absolute bottom-4 left-4 right-4">
              <SidebarMenuButton onClick={handleLogout} className="w-full text-muted-foreground hover:text-foreground">
                <LogOut className="w-5 h-5 mr-2" />
                Logout
              </SidebarMenuButton>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="h-16 flex-shrink-0 bg-white border-b border-gray-200 flex items-center px-8">
            <h1 className="text-xl font-semibold">Partner Portal Admin</h1>
          </header>
          <div className="flex-1 overflow-auto p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}