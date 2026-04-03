import { Zap } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { AppLayout } from "@/components/layout";

export default function IntentSignals() {
  return (
    <AppLayout>
      <PlaceholderPage
        title="Intent Signals"
        description="Track buyer intent signals, website visits, and engagement indicators."
        icon={Zap}
        emptyStateText="No intent signals detected yet"
      />
    </AppLayout>
  );
}
