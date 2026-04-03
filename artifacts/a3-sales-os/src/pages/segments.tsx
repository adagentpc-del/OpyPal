import { PieChart } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { AppLayout } from "@/components/layout";

export default function Segments() {
  return (
    <AppLayout>
      <PlaceholderPage
        title="Segments"
        description="Group contacts into segments based on criteria, behavior, and attributes."
        icon={PieChart}
        emptyStateText="No segments created yet"
        actionLabel="Create Segment"
      />
    </AppLayout>
  );
}
