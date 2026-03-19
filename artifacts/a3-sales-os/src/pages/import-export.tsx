import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useImportLeads } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ImportExport() {
  const [jsonInput, setJsonInput] = useState("");
  const importMutation = useImportLeads();
  const { toast } = useToast();

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const leads = Array.isArray(parsed) ? parsed : [parsed];
      
      importMutation.mutate(
        { data: { leads } },
        {
          onSuccess: (res) => {
            toast({
              title: "Import Successful",
              description: `Imported ${res.imported} leads. Skipped ${res.skipped}.`,
            });
            setJsonInput("");
          },
          onError: () => {
            toast({
              title: "Import Failed",
              description: "There was an error processing the import on the server.",
              variant: "destructive"
            });
          }
        }
      );
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "Please check your format. Ensure it matches the LeadInput schema.",
        variant: "destructive"
      });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Data Management</h1>
          <p className="text-muted-foreground mt-1">Import leads or export your CRM data.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-card border-border/50 shadow-sm rounded-2xl flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display">Import Leads</h2>
                <p className="text-sm text-muted-foreground">Bulk create via JSON array</p>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-xl flex items-start gap-3 text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p>Paste a JSON array of Lead objects. Required fields: <code className="font-bold">companyName, contactName, pipelineType, status</code>.</p>
              </div>
              
              <textarea 
                className="flex-1 min-h-[200px] w-full p-4 font-mono text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                placeholder={`[\n  {\n    "companyName": "Acme Corp",\n    "contactName": "John Doe",\n    "pipelineType": "Event",\n    "status": "New Lead"\n  }\n]`}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
              
              <Button 
                onClick={handleImport} 
                disabled={importMutation.isPending || !jsonInput.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-6 text-lg shadow-lg shadow-primary/25"
              >
                {importMutation.isPending ? "Importing..." : "Process Import"}
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border/50 shadow-sm rounded-2xl flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-accent/20 text-yellow-700">
                <Download className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display">Export Data</h2>
                <p className="text-sm text-muted-foreground">Download CRM data as CSV</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <Button variant="outline" className="w-full justify-start h-16 rounded-xl border-border hover:bg-muted text-left px-6">
                <FileSpreadsheet className="h-5 w-5 mr-4 text-muted-foreground" />
                <div>
                  <div className="font-semibold text-foreground">Export All Leads</div>
                  <div className="text-xs text-muted-foreground font-normal">Full database dump</div>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start h-16 rounded-xl border-border hover:bg-muted text-left px-6">
                <FileSpreadsheet className="h-5 w-5 mr-4 text-muted-foreground" />
                <div>
                  <div className="font-semibold text-foreground">Export Tasks</div>
                  <div className="text-xs text-muted-foreground font-normal">Task history and metrics</div>
                </div>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
