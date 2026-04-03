import { Activity } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { AppLayout } from "@/components/layout";

export default function ActivityLog() {
  return (
    <AppLayout>
      <PlaceholderPage
        title="Activity Log"
        description="Track all system activity — emails sent, status changes, and user actions."
        icon={Activity}
        emptyStateText="No activity recorded yet"
      />
    </AppLayout>
  );
}
