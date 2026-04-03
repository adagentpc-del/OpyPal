import { Shield } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { AppLayout } from "@/components/layout";

export default function Deliverability() {
  return (
    <AppLayout>
      <PlaceholderPage
        title="Deliverability"
        description="Monitor email deliverability health, domain reputation, and inbox placement."
        icon={Shield}
        emptyStateText="No deliverability data yet"
      />
    </AppLayout>
  );
}
