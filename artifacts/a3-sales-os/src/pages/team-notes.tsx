import { StickyNote } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { AppLayout } from "@/components/layout";

export default function TeamNotes() {
  return (
    <AppLayout>
      <PlaceholderPage
        title="Team Notes"
        description="Shared notes, documentation, and internal knowledge base for the sales team."
        icon={StickyNote}
        emptyStateText="No team notes yet"
        actionLabel="New Note"
      />
    </AppLayout>
  );
}
