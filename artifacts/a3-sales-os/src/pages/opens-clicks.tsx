import { MousePointerClick } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { AppLayout } from "@/components/layout";

export default function OpensClicks() {
  return (
    <AppLayout>
      <PlaceholderPage
        title="Opens and Clicks"
        description="Track email engagement — opens, clicks, and link activity across campaigns."
        icon={MousePointerClick}
        emptyStateText="No engagement data yet"
      />
    </AppLayout>
  );
}
