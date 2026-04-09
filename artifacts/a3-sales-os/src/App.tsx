import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import TeamNotes from "./pages/team-notes";
import ActivityLog from "./pages/activity-log";
import ReplyReview from "./pages/reply-review";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Main */}
      <Route path="/" component={Dashboard} />
      <Route path="/leads" component={Leads} />
      <Route path="/companies" component={Companies} />
      <Route path="/contacts" component={ObContacts} />
      <Route path="/campaigns" component={ObCampaigns} />
      <Route path="/templates" component={Templates} />
      <Route path="/sequences" component={ObSequences} />
      <Route path="/csv-uploads" component={ObUpload} />

      {/* Outreach */}
      <Route path="/outbox" component={OutreachQueue} />
      <Route path="/scheduled-emails" component={ObQueue} />
      <Route path="/follow-ups" component={Tasks} />
      <Route path="/deliverability" component={Deliverability} />
      <Route path="/opens-clicks" component={OpensClicks} />
      <Route path="/unsubscribes" component={ObSuppression} />

      {/* Qualification */}
      <Route path="/intent-signals" component={IntentSignals} />
      <Route path="/lead-scoring" component={LeadScoring} />
      <Route path="/segments" component={Segments} />
      <Route path="/pipeline" component={Pipeline} />

      {/* Admin */}
      <Route path="/settings" component={SettingsPage} />
      <Route path="/reply-review" component={ReplyReview} />
      <Route path="/team-notes" component={TeamNotes} />
      <Route path="/activity-log" component={ActivityLog} />

      {/* Legacy routes — keep existing URLs working */}
      <Route path="/outreach" component={OutreachQueue} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/assets" component={Assets} />
      <Route path="/data" component={ImportExport} />
      <Route path="/ob/contacts" component={ObContacts} />
      <Route path="/ob/upload" component={ObUpload} />
      <Route path="/ob/campaigns" component={ObCampaigns} />
      <Route path="/ob/sequences" component={ObSequences} />
      <Route path="/ob/queue" component={ObQueue} />
      <Route path="/ob/replies" component={ObReplies} />
      <Route path="/ob/routing" component={ObRouting} />
      <Route path="/ob/analytics" component={ObAnalytics} />
      <Route path="/ob/suppression" component={ObSuppression} />

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
