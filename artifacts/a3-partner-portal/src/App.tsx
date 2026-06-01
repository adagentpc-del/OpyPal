import { useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import {
  Switch,
  Route,
  Link,
  Redirect,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { PLATFORM } from "@/config/branding";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminPartners from "@/pages/admin-partners";
import AdminPartnerForm from "@/pages/admin-partner-form";
import AdminRequests from "@/pages/admin-requests";
import AdminRequestDetail from "@/pages/admin-request-detail";
import AdminAssets from "@/pages/admin-assets";
import AdminPricing from "@/pages/admin-pricing";
import AdminWorkspaces from "@/pages/admin-workspaces";
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

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function LandingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-white to-gray-50 px-6 text-center">
      <img src={`${basePath}/logo.svg`} alt={PLATFORM.name} className="mb-8 h-12" />
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Partner Portal
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Manage partners, referral requests, assets, and pricing — powered by{" "}
        {PLATFORM.name}.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Link href="/sign-in">
          <Button size="lg">Sign in</Button>
        </Link>
        <Link href="/sign-up">
          <Button size="lg" variant="outline">
            Create account
          </Button>
        </Link>
      </div>
      <p className="mt-10 text-[11px] text-muted-foreground/60">
        Powered by {PLATFORM.name} · {PLATFORM.foundation}
      </p>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/admin" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function WorkspaceGate({ children }: { children: ReactNode }) {
  const { isLoading, me } = useWorkspace();

  if (isLoading || !me) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  if (!me.isSuperAdmin && me.workspaces.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">No workspace access</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your account ({me.email}) isn&apos;t assigned to any workspace yet.
          Please ask a super admin to grant you access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <WorkspaceGate>{children}</WorkspaceGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function protectedRoute(Component: React.ComponentType) {
  return () => (
    <RequireAuth>
      <Component />
    </RequireAuth>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/admin" component={protectedRoute(AdminDashboard)} />
      <Route path="/admin/partners" component={protectedRoute(AdminPartners)} />
      <Route path="/admin/partners/new" component={protectedRoute(AdminPartnerForm)} />
      <Route path="/admin/partners/:id/edit" component={protectedRoute(AdminPartnerForm)} />
      <Route path="/admin/requests" component={protectedRoute(AdminRequests)} />
      <Route path="/admin/requests/:id" component={protectedRoute(AdminRequestDetail)} />
      <Route path="/admin/assets" component={protectedRoute(AdminAssets)} />
      <Route path="/admin/pricing" component={protectedRoute(AdminPricing)} />
      <Route path="/admin/workspaces" component={protectedRoute(AdminWorkspaces)} />

      {/* Public per-partner page — keeps its own white-label branding */}
      <Route path="/partner/:slug" component={PartnerPortal} />

      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your workspace",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Get started with OpyPal",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <WorkspaceProvider>
          <TooltipProvider>
            <AppRoutes />
            <Toaster />
          </TooltipProvider>
        </WorkspaceProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
