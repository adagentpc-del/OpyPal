import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminPartners from "@/pages/admin-partners";
import AdminPartnerForm from "@/pages/admin-partner-form";
import AdminRequests from "@/pages/admin-requests";
import AdminRequestDetail from "@/pages/admin-request-detail";
import AdminAssets from "@/pages/admin-assets";
import AdminPricing from "@/pages/admin-pricing";
import PartnerPortal from "@/pages/partner-portal";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  const { isAuthenticated } = useAuth();
  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Redirect to="/admin" /> : <Redirect to="/login" />}
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} />
      </Route>
      <Route path="/admin/partners">
        <ProtectedRoute component={AdminPartners} />
      </Route>
      <Route path="/admin/partners/new">
        <ProtectedRoute component={AdminPartnerForm} />
      </Route>
      <Route path="/admin/partners/:id/edit">
        <ProtectedRoute component={AdminPartnerForm} />
      </Route>
      <Route path="/admin/requests">
        <ProtectedRoute component={AdminRequests} />
      </Route>
      <Route path="/admin/requests/:id">
        <ProtectedRoute component={AdminRequestDetail} />
      </Route>
      <Route path="/admin/assets">
        <ProtectedRoute component={AdminAssets} />
      </Route>
      <Route path="/admin/pricing">
        <ProtectedRoute component={AdminPricing} />
      </Route>
      <Route path="/partner/:slug" component={PartnerPortal} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
