import { type LucideIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyStateText: string;
  actionLabel?: string;
}

export function PlaceholderPage({ title, description, icon: Icon, emptyStateText, actionLabel }: PlaceholderPageProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        {actionLabel && (
          <Button className="gap-2" disabled>
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-card p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{emptyStateText}</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          This section is coming soon. It will be available in a future update.
        </p>
      </div>
    </div>
  );
}
