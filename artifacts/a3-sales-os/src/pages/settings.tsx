import { Settings as SettingsIcon } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { AppLayout } from "@/components/layout";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PlaceholderPage
        title="Settings"
        description="Configure application settings, integrations, and preferences."
        icon={SettingsIcon}
        emptyStateText="Settings panel coming soon"
      />
    </AppLayout>
  );
}
