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
import CampaignDetail from "./pages/campaign-detail";
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

import PlatformDashboard from "./pages/platform-dashboard";
import WorkspacesPage from "./pages/workspaces";
import PlatformProviders from "./pages/platform-providers";
import PlatformTemplates from "./pages/platform-templates";
import PlatformSequences from "./pages/platform-sequences";
import PlatformAnalytics from "./pages/platform-analytics";
import PlatformAuditLog from "./pages/platform-audit-log";
import PlatformSettings from "./pages/platform-settings";

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
  const pillars: Array<[string, string]> = [
    ["Opportunity", PLATFORM.pillars.opportunity],
    ["Operations", PLATFORM.pillars.operations],
    ["Pal", PLATFORM.pillars.pal],
  ];
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0B2A20] text-[#F7F4EC]">
      {/* ambient brand glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[44rem] w-[44rem] -translate-x-1/2 rounded-full bg-[#1C5C44] opacity-40 blur-[130px]" />
        <div className="absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-[#C9A24B] opacity-[0.12] blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06),_transparent_55%)]" />
      </div>

      {/* top bar */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img
            src={`${basePath}/divini-logo-white.png`}
            alt="Divini Group"
            className="h-9 w-auto opacity-95"
          />
          <span className="hidden text-xs font-medium uppercase tracking-[0.3em] text-[#C9A24B] sm:inline">
            Divini Group
          </span>
        </div>
        <Link href="/sign-in">
          <Button
            variant="ghost"
            className="text-[#F7F4EC] hover:bg-white/10 hover:text-white"
          >
            Sign in
          </Button>
        </Link>
      </header>

      {/* hero */}
      <main className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-10 text-center sm:pt-16">
        <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#C9A24B]/40 bg-white/[0.04] px-4 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-[#E7D9AE]">
          OpyPal by Divini Group
        </span>

        <h1 className="font-display text-6xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          {PLATFORM.name}
        </h1>

        <div className="mt-6 h-px w-28 bg-gradient-to-r from-transparent via-[#C9A24B] to-transparent" />

        <p className="mt-6 font-display text-2xl font-medium tracking-tight text-[#F7F4EC] sm:text-3xl">
          {PLATFORM.tagline}
        </p>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[#F7F4EC]/70 sm:text-lg">
          {PLATFORM.fullName} — the all-in-one system that surfaces opportunity,
          runs your operations, and keeps every deal moving.
        </p>

        {/* pillars */}
        <div className="mt-12 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
          {pillars.map(([title, body]) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition-colors hover:border-[#C9A24B]/40 hover:bg-white/[0.07]"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24B]/70 to-transparent" />
              <p className="text-sm font-semibold uppercase tracking-wider text-[#C9A24B]">
                {title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#F7F4EC]/70">{body}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-12 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Link href="/sign-up" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full bg-[#C9A24B] px-8 font-semibold text-[#0B2A20] shadow-lg shadow-[#C9A24B]/20 hover:bg-[#d8b566] sm:w-auto"
            >
              Create account
            </Button>
          </Link>
          <Link href="/sign-in" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="w-full border-white/25 bg-transparent px-8 text-[#F7F4EC] hover:bg-white/10 hover:text-white sm:w-auto"
            >
              Sign in
            </Button>
          </Link>
        </div>

        <p className="mt-12 text-[0.7rem] uppercase tracking-[0.3em] text-[#F7F4EC]/40">
          A Divini Group Platform
        </p>
      </main>
    </div>
  );
}

function SignedInHome() {
  const { isLoading, me, scope } = useWorkspace();
  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }
  // Super admins land on the platform dashboard when in the platform shell, or
  // whenever they have no workspace to fall back to (so they're never stranded
  // on the "No workspace access" screen).
  if (me?.isSuperAdmin && (scope === "platform" || me.workspaces.length === 0)) {
    return <Redirect to="/platform" />;
  }
  return (
    <RequireWorkspace>
      <Dashboard />
    </RequireWorkspace>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <SignedInHome />
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
      const prev = prevUserIdRef.current;
      // Only clear the cache when a genuinely different signed-in user takes
      // over. We ignore null/undefined transitions, which fire repeatedly
      // during Clerk's auth handshake (token refresh, tab focus) and would
      // otherwise wipe the cache in a loop, causing a refetch storm that
      // flashes pages empty. We remember only signed-in ids so that
      // sign-out -> sign-in as a different user is still detected.
      if (prev != null && userId != null && prev !== userId) {
        qc.clear();
      }
      if (userId != null) {
        prevUserIdRef.current = userId;
      }
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function RequireWorkspace({ children }: { children: ReactNode }) {
  const { isLoading, me, currentWorkspace } = useWorkspace();
  const { signOut } = useClerk();

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
          administrator to invite you, or sign in with a different account.
        </p>
        <Button
          className="mt-6"
          onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}
        >
          Back to sign in
        </Button>
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

// Cross-workspace pages reused by the platform shell (/users, /access). Super
// admins reach these even with zero workspaces, so they bypass the workspace
// requirement; everyone else is still gated on workspace membership.
function RequireWorkspaceOrSuper({ children }: { children: ReactNode }) {
  const { isLoading, me } = useWorkspace();
  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }
  if (me?.isSuperAdmin) return <>{children}</>;
  return <RequireWorkspace>{children}</RequireWorkspace>;
}

function sharedRoute(
  Component: React.ComponentType,
  opts: { superAdminOnly?: boolean } = {},
) {
  return () => (
    <RequireAuth>
      <RequireWorkspaceOrSuper>
        {opts.superAdminOnly ? (
          <RequireRole superAdminOnly>
            <Component />
          </RequireRole>
        ) : (
          <Component />
        )}
      </RequireWorkspaceOrSuper>
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

// Platform (super-admin only) routes. Unlike workspace routes these do NOT
// require a workspace — a super admin manages the platform even with zero
// workspaces. Non-super-admins are redirected home so they never see platform
// chrome or URLs.
function RequirePlatform({ children }: { children: ReactNode }) {
  const { isLoading, me } = useWorkspace();
  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }
  if (!me?.isSuperAdmin) {
    return <Redirect to="/" />;
  }
  return <>{children}</>;
}

function platformRoute(Component: React.ComponentType) {
  return () => (
    <RequireAuth>
      <RequirePlatform>
        <Component />
      </RequirePlatform>
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

      {/* Platform (super-admin only) */}
      <Route path="/platform" component={platformRoute(PlatformDashboard)} />
      <Route path="/platform/workspaces" component={platformRoute(WorkspacesPage)} />
      <Route path="/platform/providers" component={platformRoute(PlatformProviders)} />
      <Route path="/platform/templates" component={platformRoute(PlatformTemplates)} />
      <Route path="/platform/sequences" component={platformRoute(PlatformSequences)} />
      <Route path="/platform/analytics" component={platformRoute(PlatformAnalytics)} />
      <Route path="/platform/audit-log" component={platformRoute(PlatformAuditLog)} />
      <Route path="/platform/settings" component={platformRoute(PlatformSettings)} />

      <Route path="/leads" component={protectedRoute(Leads)} />
      <Route path="/companies" component={protectedRoute(Companies)} />
      <Route path="/contacts" component={protectedRoute(ObContacts)} />
      <Route path="/campaigns/:id" component={protectedRoute(CampaignDetail)} />
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
      <Route path="/access" component={sharedRoute(Access)} />
      <Route path="/users" component={sharedRoute(Users, { superAdminOnly: true })} />

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
