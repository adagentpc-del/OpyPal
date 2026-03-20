import { useState, useRef, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useImportLeads, useGetLeads, useGetTasks } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X, Users, SkipForward, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const IMPORT_FIELDS = [
  { key: "companyName", label: "Company Name", required: true },
  { key: "contactName", label: "Contact Name", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "email", label: "Email", required: true },
  { key: "location", label: "Location", required: true },
  { key: "title", label: "Title / Role", required: false },
  { key: "industry", label: "Industry", required: false },
  { key: "pipelineType", label: "Pipeline Type", required: false },
  { key: "source", label: "Source", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "linkedin", label: "LinkedIn", required: false },
  { key: "venueProperty", label: "Venue / Property", required: false },
  { key: "projectType", label: "Project Type", required: false },
  { key: "estimatedBudget", label: "Estimated Budget", required: false },
];

const REQUIRED_KEYS = ["companyName", "contactName", "phone", "email", "location"];

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

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-/]+/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  company: "companyName", companyname: "companyName", "company name": "companyName",
  contact: "contactName", contactname: "contactName", "contact name": "contactName", name: "contactName",
  phone: "phone", phonenumber: "phone", "phone number": "phone",
  email: "email", emailaddress: "email", "email address": "email",
  location: "location", city: "location", state: "location", address: "location",
  title: "title", jobtitle: "title", role: "title", "title / role": "title", "title/role": "title",
  industry: "industry",
  pipeline: "pipelineType", pipelinetype: "pipelineType", type: "pipelineType",
  source: "source", leadsource: "source",
  linkedin: "linkedin",
  notes: "notes",
  venue: "venueProperty", property: "venueProperty", venueproperty: "venueProperty",
  projecttype: "projectType", project: "projectType",
  budget: "estimatedBudget", estimatedbudget: "estimatedBudget",
  "first name": "contactName", firstname: "contactName",
  "last name": "contactName",
};

export default function ImportExport() {
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportLeads();
  const { data: leads } = useGetLeads();
  const { data: tasks } = useGetTasks();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
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
      const used = new Set<string>();
      headers.forEach((h, i) => {
        const norm = normalizeHeader(h);
        let match = IMPORT_FIELDS.find((f) => normalizeHeader(f.key) === norm && !used.has(f.key));
        if (!match) {
          const aliasKey = HEADER_ALIASES[norm];
          if (aliasKey) match = IMPORT_FIELDS.find((f) => f.key === aliasKey && !used.has(f.key));
        }
        if (match) {
          autoMap[i] = match.key;
          used.add(match.key);
        }
      });
      setMapping(autoMap);
    };
    reader.readAsText(file);
  };

  const mappedValues = Object.values(mapping).filter(Boolean);
  const requiredMapped = REQUIRED_KEYS.filter((k) => mappedValues.includes(k));
  const requiredMissing = REQUIRED_KEYS.filter((k) => !mappedValues.includes(k));

  const previewLeads = useMemo(() => {
    if (!csvData) return [];
    return csvData.slice(0, 5).map((row) => {
      const lead: any = {};
      Object.entries(mapping).forEach(([colIdx, field]) => {
        const val = row[Number(colIdx)];
        if (val && field) lead[field] = val;
      });
      return lead;
    });
  }, [csvData, mapping]);

  const handleImport = () => {
    if (!csvData) return;
    setImporting(true);
    const mappedLeads = csvData.map((row) => {
      const lead: any = {};
      Object.entries(mapping).forEach(([colIdx, field]) => {
        const val = row[Number(colIdx)];
        if (val && field) {
          if (["estimatedBudget", "dealValueEstimate", "proposalValue", "closeProbability"].includes(field)) {
            lead[field] = parseFloat(val.replace(/[$,]/g, "")) || undefined;
          } else {
            lead[field] = val;
          }
        }
      });
      return lead;
    }).filter((l) => l.companyName && l.contactName && l.phone && l.email && l.location);

    if (mappedLeads.length === 0) {
      toast({ title: "No valid leads", description: "Each row needs Company Name, Contact Name, Phone, Email, and Location.", variant: "destructive" });
      setImporting(false);
      return;
    }

    importMutation.mutate({ data: { leads: mappedLeads } }, {
      onSuccess: (res) => {
        setImportResult(res);
        toast({ title: "Import complete", description: `${res.imported} imported, ${res.skipped} duplicates skipped.` });
        queryClient.invalidateQueries();
        setImporting(false);
      },
      onError: () => {
        toast({ title: "Import failed", variant: "destructive" });
        setImporting(false);
      },
    });
  };

  const clearImport = () => {
    setCsvData(null);
    setCsvHeaders([]);
    setMapping({});
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const exportLeads = () => {
    if (!leads?.length) { toast({ title: "No leads to export" }); return; }
    const headers = ["id", "companyName", "contactName", "phone", "email", "location", "pipelineType", "status", "lastContactDate", "nextStep", "nextFollowUpDate", "source", "title", "industry", "venueProperty", "projectType", "estimatedBudget", "notes", "dealValueEstimate", "proposalValue", "closeProbability", "forecastValue", "linkedin", "createdAt"];
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
                <p className="text-sm text-muted-foreground">Upload a CSV with lead data</p>
              </div>
            </div>

            {importResult ? (
              <div className="flex-1 flex flex-col gap-4">
                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-bold">Import Complete</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-2xl font-bold">{importResult.total}</div>
                      <div className="text-xs text-muted-foreground">Rows Uploaded</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-emerald-600">{importResult.imported}</div>
                      <div className="text-xs text-muted-foreground">Imported</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-2xl font-bold text-amber-600">{importResult.skipped}</div>
                      <div className="text-xs text-muted-foreground">Duplicates Skipped</div>
                    </div>
                  </div>
                  <p className="text-xs mt-3 text-emerald-700">
                    Auto-filled: Source = ZoomInfo, Status = New Lead, Next Step = Initial outreach, Follow-up = tomorrow. Pipeline inferred from company/title.
                  </p>
                </div>
                <Button onClick={clearImport} variant="outline" className="w-full rounded-xl">
                  Import More Leads
                </Button>
              </div>
            ) : !csvData ? (
              <div className="flex-1 flex flex-col gap-4">
                <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">Required CSV columns:</p>
                      <p>Company Name, Contact Name, Phone, Email, Location</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 pl-7">
                    All other fields auto-generated: Source = ZoomInfo, Status = New Lead, Pipeline = auto-inferred, Follow-up = tomorrow
                  </p>
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
                  <Button variant="ghost" size="sm" onClick={clearImport}>
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-1">
                  {REQUIRED_KEYS.map((k) => {
                    const mapped = mappedValues.includes(k);
                    const field = IMPORT_FIELDS.find((f) => f.key === k);
                    return (
                      <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${mapped ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {mapped ? "✓" : "✗"} {field?.label}
                      </span>
                    );
                  })}
                </div>

                <div className="border border-border rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
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
                              {IMPORT_FIELDS.map((f) => (
                                <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewLeads.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <p className="px-3 py-2 bg-muted/50 text-xs font-semibold">Preview (first {Math.min(5, previewLeads.length)} rows)</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/30">
                          <tr>
                            {Object.entries(mapping).filter(([, v]) => v).map(([i, field]) => {
                              const f = IMPORT_FIELDS.find((x) => x.key === field);
                              return <th key={i} className="px-3 py-1.5 font-medium text-left">{f?.label || field}</th>;
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {previewLeads.map((lead, ri) => (
                            <tr key={ri}>
                              {Object.entries(mapping).filter(([, v]) => v).map(([, field]) => (
                                <td key={field} className="px-3 py-1.5 truncate max-w-[150px]">{lead[field] || ""}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {requiredMissing.length > 0 && (
                  <div className="bg-red-50 text-red-700 p-2 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    Missing required: {requiredMissing.map((k) => IMPORT_FIELDS.find((f) => f.key === k)?.label).join(", ")}
                  </div>
                )}

                <Button onClick={handleImport}
                  disabled={importing || requiredMapped.length < 5}
                  className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-5 shadow-md">
                  {importing ? "Importing..." : `Import ${csvData.length} Leads`}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Duplicates (matching email or company+contact) will be skipped automatically.
                </p>
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
