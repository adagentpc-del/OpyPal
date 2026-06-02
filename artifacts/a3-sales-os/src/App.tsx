import { useEffect, useRef, type ReactNode } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
} from "@clerk/react";
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
import { WorkspaceProvider, useWorkspace, type AppRole } from "@/hooks/use-workspace";
import { roleAtLeast, roleLabel } from "@/lib/permissions";
import { PLATFORM } from "@/config/branding";
import NotFound from "@/pages/not-found";

import Dashboard from "./pages/dashboard";
import Leads from "./pages/leads";
import Pipeline from "./pages/pipeline";
import OutreachQueue from "./pages/outreach-queue";
import Tasks from "./pages/tasks";
import Templates from "./pages/templates";
import Assets from "./pages/assets";
import ImportExport from "./pages/import-export";
import ObContacts from "./pages/ob-contacts";
import ObUpload from "./pages/ob-upload";
import ObCampaigns from "./pages/ob-campaigns";
import ObSequences from "./pages/ob-sequences";
import ObQueue from "./pages/ob-queue";
import ObReplies from "./pages/ob-replies";
import ObAnalytics from "./pages/ob-analytics";
import ObSuppression from "./pages/ob-suppression";
import ObRouting from "./pages/ob-routing";

import Companies from "./pages/companies";
import Deliverability from "./pages/deliverability";
import OpensClicks from "./pages/opens-clicks";
import IntentSignals from "./pages/intent-signals";
import LeadScoring from "./pages/lead-scoring";
import Segments from "./pages/segments";
import SettingsPage from "./pages/settings";
import ProvidersPage from "./pages/providers";
import TeamNotes from "./pages/team-notes";
import ActivityLog from "./pages/activity-log";
import ReplyReview from "./pages/reply-review";
import Members from "./pages/members";
import Users from "./pages/users";
import Access from "./pages/access";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function LandingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-white to-gray-50 px-6 text-center">
      <img src={`${basePath}/logo.svg`} alt={PLATFORM.name} className="h-12 mb-8" />
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {PLATFORM.tagline}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        {PLATFORM.fullName} — the system that supports and organizes your business.
      </p>
      <div className="mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        <div className="rounded-lg border bg-white/60 p-4">
          <p className="text-sm font-semibold text-foreground">Opportunity</p>
          <p className="mt-1 text-sm text-muted-foreground">{PLATFORM.pillars.opportunity}</p>
        </div>
        <div className="rounded-lg border bg-white/60 p-4">
          <p className="text-sm font-semibold text-foreground">Operations</p>
          <p className="mt-1 text-sm text-muted-foreground">{PLATFORM.pillars.operations}</p>
        </div>
        <div className="rounded-lg border bg-white/60 p-4">
          <p className="text-sm font-semibold text-foreground">Pal</p>
          <p className="mt-1 text-sm text-muted-foreground">{PLATFORM.pillars.pal}</p>
        </div>
      </div>
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
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <RequireWorkspace>
          <Dashboard />
        </RequireWorkspace>
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
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

function RequireWorkspace({ children }: { children: ReactNode }) {
  const { isLoading, me, currentWorkspace } = useWorkspace();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  if (!me || me.workspaces.length === 0 || !currentWorkspace) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          No workspace access
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Your account isn’t a member of any workspace yet. Ask your workspace
          administrator to invite you.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function protectedRoute(Component: React.ComponentType) {
  return () => (
    <RequireAuth>
      <RequireWorkspace>
        <Component />
      </RequireWorkspace>
    </RequireAuth>
  );
}

// Gates a page on a minimum role (super admins always pass). Renders a clear
// "no access" message rather than redirecting, so the URL stays put.
function RequireRole({
  min,
  superAdminOnly = false,
  children,
}: {
  min?: AppRole;
  superAdminOnly?: boolean;
  children: ReactNode;
}) {
  const { currentRole, me } = useWorkspace();
  const isSuper = me?.isSuperAdmin ?? false;
  const allowed = superAdminOnly
    ? isSuper
    : isSuper || (min ? roleAtLeast(currentRole, min) : true);

  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          You don’t have access to this page
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Your role ({roleLabel(currentRole)}) doesn’t include this area. Contact
          a workspace admin if you need access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function roleRoute(
  Component: React.ComponentType,
  opts: { min?: AppRole; superAdminOnly?: boolean },
) {
  return () => (
    <RequireAuth>
      <RequireWorkspace>
        <RequireRole min={opts.min} superAdminOnly={opts.superAdminOnly}>
          <Component />
        </RequireRole>
      </RequireWorkspace>
    </RequireAuth>
  );
}

function AppRoutes() {
  return (
    <Switch>
      {/* Main */}
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/leads" component={protectedRoute(Leads)} />
      <Route path="/companies" component={protectedRoute(Companies)} />
      <Route path="/contacts" component={protectedRoute(ObContacts)} />
      <Route path="/campaigns" component={protectedRoute(ObCampaigns)} />
      <Route path="/templates" component={protectedRoute(Templates)} />
      <Route path="/sequences" component={protectedRoute(ObSequences)} />
      <Route path="/csv-uploads" component={protectedRoute(ObUpload)} />

      {/* Outreach */}
      <Route path="/outbox" component={protectedRoute(OutreachQueue)} />
      <Route path="/scheduled-emails" component={protectedRoute(ObQueue)} />
      <Route path="/follow-ups" component={protectedRoute(Tasks)} />
      <Route path="/deliverability" component={protectedRoute(Deliverability)} />
      <Route path="/opens-clicks" component={protectedRoute(OpensClicks)} />
      <Route path="/unsubscribes" component={protectedRoute(ObSuppression)} />

      {/* Qualification */}
      <Route path="/intent-signals" component={protectedRoute(IntentSignals)} />
      <Route path="/lead-scoring" component={protectedRoute(LeadScoring)} />
      <Route path="/segments" component={protectedRoute(Segments)} />
      <Route path="/pipeline" component={protectedRoute(Pipeline)} />

      {/* Admin */}
      <Route path="/settings" component={roleRoute(SettingsPage, { min: "manager" })} />
      <Route path="/providers" component={roleRoute(ProvidersPage, { min: "manager" })} />
      <Route path="/reply-review" component={protectedRoute(ReplyReview)} />
      <Route path="/team-notes" component={protectedRoute(TeamNotes)} />
      <Route path="/activity-log" component={roleRoute(ActivityLog, { min: "manager" })} />

      {/* User management */}
      <Route path="/members" component={roleRoute(Members, { min: "workspace_admin" })} />
      <Route path="/access" component={protectedRoute(Access)} />
      <Route path="/users" component={roleRoute(Users, { superAdminOnly: true })} />

      {/* Legacy routes — keep existing URLs working */}
      <Route path="/outreach" component={protectedRoute(OutreachQueue)} />
      <Route path="/tasks" component={protectedRoute(Tasks)} />
      <Route path="/assets" component={protectedRoute(Assets)} />
      <Route path="/data" component={protectedRoute(ImportExport)} />
      <Route path="/ob/contacts" component={protectedRoute(ObContacts)} />
      <Route path="/ob/upload" component={protectedRoute(ObUpload)} />
      <Route path="/ob/campaigns" component={protectedRoute(ObCampaigns)} />
      <Route path="/ob/sequences" component={protectedRoute(ObSequences)} />
      <Route path="/ob/queue" component={protectedRoute(ObQueue)} />
      <Route path="/ob/replies" component={protectedRoute(ObReplies)} />
      <Route path="/ob/routing" component={protectedRoute(ObRouting)} />
      <Route path="/ob/analytics" component={protectedRoute(ObAnalytics)} />
      <Route path="/ob/suppression" component={protectedRoute(ObSuppression)} />

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
