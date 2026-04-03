import { BarChart2 } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { AppLayout } from "@/components/layout";

export default function LeadScoring() {
  return (
    <AppLayout>
      <PlaceholderPage
        title="Lead Scoring"
        description="Score and prioritize leads based on engagement, fit, and behavior."
        icon={BarChart2}
        emptyStateText="No scoring rules configured yet"
        actionLabel="Create Scoring Rule"
      />
    </AppLayout>
  );
}
