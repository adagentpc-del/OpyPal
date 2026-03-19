import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout";
import { useImportLeads, useGetLeads, useGetTasks } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const LEAD_FIELDS = [
  "pipelineType", "companyName", "contactName", "title", "email", "phone", "linkedin",
  "location", "industry", "venueProperty", "projectType", "estimatedBudget", "status",
  "lastContactDate", "nextStep", "nextFollowUpDate", "notes", "dealValueEstimate",
  "proposalValue", "closeProbability", "source",
];

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { row.push(current.trim()); current = ""; }
      else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        row.push(current.trim()); current = "";
        if (row.some((c) => c)) lines.push(row);
        row = [];
        if (ch === "\r") i++;
      } else { current += ch; }
    }
  }
  row.push(current.trim());
  if (row.some((c) => c)) lines.push(row);
  return lines;
}

function toCSV(headers: string[], rows: Record<string, any>[]): string {
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(escape).join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export default function ImportExport() {
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportLeads();
  const { data: leads } = useGetLeads();
  const { data: tasks } = useGetTasks();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        toast({ title: "Invalid CSV", description: "File must have headers and at least one row.", variant: "destructive" });
        return;
      }
      const headers = parsed[0];
      setCsvHeaders(headers);
      setCsvData(parsed.slice(1));
      const autoMap: Record<number, string> = {};
      headers.forEach((h, i) => {
        const lower = h.toLowerCase().replace(/[\s_-]+/g, "");
        const match = LEAD_FIELDS.find((f) => f.toLowerCase() === lower);
        if (match) autoMap[i] = match;
      });
      setMapping(autoMap);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!csvData) return;
    setImporting(true);
    const mappedLeads = csvData.map((row) => {
      const lead: any = { pipelineType: "Event", status: "New Lead", companyName: "", contactName: "" };
      Object.entries(mapping).forEach(([colIdx, field]) => {
        const val = row[Number(colIdx)];
        if (val) {
          if (["estimatedBudget", "dealValueEstimate", "proposalValue", "closeProbability"].includes(field)) {
            lead[field] = parseFloat(val.replace(/[$,]/g, "")) || undefined;
          } else {
            lead[field] = val;
          }
        }
      });
      return lead;
    }).filter((l) => l.companyName && l.contactName);

    if (mappedLeads.length === 0) {
      toast({ title: "No valid leads", description: "Ensure companyName and contactName are mapped.", variant: "destructive" });
      setImporting(false);
      return;
    }

    importMutation.mutate({ data: { leads: mappedLeads } }, {
      onSuccess: (res) => {
        toast({ title: "Import complete", description: `Imported ${res.imported}, skipped ${res.skipped} duplicates.` });
        setCsvData(null);
        setCsvHeaders([]);
        setMapping({});
        queryClient.invalidateQueries();
        setImporting(false);
      },
      onError: () => {
        toast({ title: "Import failed", variant: "destructive" });
        setImporting(false);
      },
    });
  };

  const exportLeads = () => {
    if (!leads?.length) { toast({ title: "No leads to export" }); return; }
    const headers = ["id", "pipelineType", "companyName", "contactName", "title", "email", "phone", "linkedin", "location", "industry", "venueProperty", "projectType", "estimatedBudget", "status", "lastContactDate", "nextStep", "nextFollowUpDate", "notes", "dealValueEstimate", "proposalValue", "closeProbability", "forecastValue", "source", "createdAt"];
    downloadCSV(toCSV(headers, leads), "a3-leads-export.csv");
  };

  const exportTasks = () => {
    if (!tasks?.length) { toast({ title: "No tasks to export" }); return; }
    const headers = ["id", "leadId", "taskType", "dueDate", "status", "notes", "leadCompanyName", "leadContactName", "createdAt"];
    downloadCSV(toCSV(headers, tasks), "a3-tasks-export.csv");
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Downloaded ${filename}` });
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Import / Export</h1>
          <p className="text-muted-foreground text-sm mt-1">Import leads from CSV or export your data.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-card border-border/50 rounded-2xl flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-xl bg-primary/10 text-primary"><UploadCloud className="h-6 w-6" /></div>
              <div>
                <h2 className="text-lg font-bold">Import Leads</h2>
                <p className="text-sm text-muted-foreground">Upload a CSV file with lead data</p>
              </div>
            </div>

            {!csvData ? (
              <div className="flex-1 flex flex-col gap-4">
                <div className="bg-blue-50 text-blue-800 p-3 rounded-xl flex items-start gap-3 text-sm">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p>Upload a CSV with headers. Required: <strong>companyName</strong>, <strong>contactName</strong>. Columns are auto-mapped when possible.</p>
                </div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
                <Button onClick={() => fileRef.current?.click()} variant="outline" className="w-full h-32 border-dashed border-2 rounded-xl flex flex-col gap-2 hover:bg-primary/5 hover:border-primary">
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to select CSV file</span>
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    {csvData.length} rows loaded, {csvHeaders.length} columns
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setCsvData(null); setCsvHeaders([]); setMapping({}); }}>
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                </div>

                <div className="border border-border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">CSV Column</th>
                        <th className="px-3 py-2 text-left font-semibold">Map To</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {csvHeaders.map((h, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{h}</td>
                          <td className="px-3 py-2">
                            <select value={mapping[i] || ""} onChange={(e) => setMapping({ ...mapping, [i]: e.target.value })}
                              className="w-full px-2 py-1 text-xs border border-border rounded-lg bg-background">
                              <option value="">— Skip —</option>
                              {LEAD_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                  <p className="px-3 py-2 bg-muted/50 text-xs font-semibold">Preview (first 3 rows)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/30">
                        <tr>
                          {Object.entries(mapping).filter(([, v]) => v).map(([i, field]) => (
                            <th key={i} className="px-3 py-1.5 font-medium text-left">{field}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {csvData.slice(0, 3).map((row, ri) => (
                          <tr key={ri}>
                            {Object.entries(mapping).filter(([, v]) => v).map(([i]) => (
                              <td key={i} className="px-3 py-1.5 truncate max-w-[150px]">{row[Number(i)] || ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Button onClick={handleImport} disabled={importing || Object.values(mapping).filter(Boolean).length < 2}
                  className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-5 shadow-md">
                  {importing ? "Importing..." : `Import ${csvData.length} Leads`}
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-6 bg-card border-border/50 rounded-2xl flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-xl bg-accent/20 text-yellow-700"><Download className="h-6 w-6" /></div>
              <div>
                <h2 className="text-lg font-bold">Export Data</h2>
                <p className="text-sm text-muted-foreground">Download your CRM data as CSV</p>
              </div>
            </div>

            <div className="space-y-4">
              <Button variant="outline" onClick={exportLeads} className="w-full justify-start h-16 rounded-xl border-border hover:bg-muted text-left px-6">
                <FileSpreadsheet className="h-5 w-5 mr-4 text-muted-foreground" />
                <div>
                  <div className="font-semibold">Export All Leads</div>
                  <div className="text-xs text-muted-foreground font-normal">{leads?.length || 0} leads in database</div>
                </div>
              </Button>
              <Button variant="outline" onClick={exportTasks} className="w-full justify-start h-16 rounded-xl border-border hover:bg-muted text-left px-6">
                <FileSpreadsheet className="h-5 w-5 mr-4 text-muted-foreground" />
                <div>
                  <div className="font-semibold">Export All Tasks</div>
                  <div className="text-xs text-muted-foreground font-normal">{tasks?.length || 0} tasks in database</div>
                </div>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
