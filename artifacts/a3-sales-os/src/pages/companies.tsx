import { Building2 } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { AppLayout } from "@/components/layout";

export default function Companies() {
  return (
    <AppLayout>
      <PlaceholderPage
        title="Companies"
        description="Track companies, accounts, and organizational relationships."
        icon={Building2}
        emptyStateText="No companies added yet"
        actionLabel="Add Company"
      />
    </AppLayout>
  );
}
