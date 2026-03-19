import { AppLayout } from "@/components/layout";
import { useGetTemplates } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, FileText, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Templates() {
  const { data: templates, isLoading } = useGetTemplates();
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Template body is ready to paste.",
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Message Templates</h1>
            <p className="text-muted-foreground mt-1">Standardized outreach and follow-up copy.</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25">
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading templates...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {templates?.map(template => (
              <Card key={template.id} className="bg-card border-border/50 shadow-sm rounded-2xl flex flex-col hover:shadow-md transition-shadow">
                <div className="p-5 border-b border-border/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">
                      {template.category}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(template.body)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-bold text-lg leading-tight mt-2">{template.name}</h3>
                  {template.subject && (
                    <p className="text-sm font-medium mt-2 text-foreground/80"><span className="text-muted-foreground font-normal">Subj:</span> {template.subject}</p>
                  )}
                </div>
                <div className="p-5 flex-1 bg-muted/20 rounded-b-2xl">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono line-clamp-6">
                    {template.body}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
