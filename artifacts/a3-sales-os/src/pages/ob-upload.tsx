import { useState, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import {
  useImportContacts,
  useGetCampaigns,
  useGetTemplateSets,
  useGetImports,
  useBulkGeneratePersonalization,
  getGetContactsQueryKey,
  getGetOutboundAnalyticsQueryKey,
  getGetImportsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileText, CheckCircle2, X, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

type ParsedRow = {
  fullName: string;
  firstName?: string;
  lastName?: string;
  company: string;
  email: string;
  title?: string;
  phone?: string;
  location?: string;
  industry?: string;
  intentSignal?: string;
  customLine?: string;
  segmentType?: string;
};

const HEADER_MAP: Record<string, string> = {
  "full_name": "fullName", "full name": "fullName", "name": "fullName", "contact name": "fullName", "contact": "fullName",
  "first_name": "firstName", "first name": "firstName", "firstname": "firstName",
  "last_name": "lastName", "last name": "lastName", "lastname": "lastName",
  "company": "company", "company name": "company", "organization": "company",
  "email": "email", "email address": "email", "e-mail": "email",
  "title": "title", "job title": "title", "role": "title", "position": "title",
  "phone": "phone", "phone number": "phone", "mobile": "phone", "telephone": "phone",
  "location": "location", "city": "location", "state": "location", "region": "location",
  "industry": "industry",
  "intent": "intentSignal", "intent signal": "intentSignal", "intent_signal": "intentSignal",
  "custom_line": "customLine", "custom line": "customLine", "custom": "customLine",
  "segment": "segmentType", "segment_type": "segmentType", "segment type": "segmentType", "type": "segmentType",
};

const SEGMENT_TYPES = ["general", "hotel", "agency", "developer", "venue"];
const PERSONALIZATION_MODES = [
  { value: "off", label: "Off", desc: "No AI personalization" },
  { value: "safe", label: "Safe", desc: "Soft, generalized lines" },
  { value: "enhanced", label: "Enhanced", desc: "Stronger personalization using all data" },
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"(.*)"$/, "$1"));
  const rows = lines.slice(1).map(line => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  });
  return { headers, rows };
}

function mapHeaders(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  headers.forEach((h, i) => {
    const key = HEADER_MAP[h.toLowerCase()];
    if (key) map[i] = key;
  });
  return map;
}

export default function ObUpload() {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [templateSetId, setTemplateSetId] = useState("");
  const [segmentType, setSegmentType] = useState("");
  const [autoEnroll, setAutoEnroll] = useState(true);
  const [reEnrollExisting, setReEnrollExisting] = useState(false);
  const [personalizationMode, setPersonalizationMode] = useState("safe");
  const [generateTiming, setGenerateTiming] = useState<"at_import" | "before_send">("at_import");
  const [result, setResult] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: campaigns } = useGetCampaigns();
  const { data: templateSets } = useGetTemplateSets();
  const { data: imports } = useGetImports();
  const importMut = useImportContacts();
  const bulkGenMut = useBulkGeneratePersonalization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setRawHeaders(headers);
      setRawRows(rows);
      const headerMap = mapHeaders(headers);
      const mapped: ParsedRow[] = rows.map(row => {
        const obj: any = {};
        Object.entries(headerMap).forEach(([idx, key]) => {
          obj[key] = row[parseInt(idx)] || "";
        });
        if (!obj.fullName && obj.firstName) {
          obj.fullName = [obj.firstName, obj.lastName].filter(Boolean).join(" ");
        }
        return obj as ParsedRow;
      }).filter(r => (r.fullName || (r.firstName && r.lastName)) && r.company && r.email);
      setParsedRows(mapped);
      setStep("preview");
    };
    reader.readAsText(file);
  }, []);

  const selectedCampaign = (campaigns || []).find((c: any) => String(c.id) === campaignId);
  const selectedSet = (templateSets || []).find((s: any) => String(s.id) === templateSetId);

  const handleImport = () => {
    importMut.mutate({
      data: {
        fileName,
        campaignId: campaignId || undefined,
        campaignName: selectedCampaign?.name || undefined,
        templateSetId: templateSetId || undefined,
        templateSetName: selectedSet?.name || undefined,
        segmentType: segmentType || undefined,
        autoEnroll,
        reEnrollExisting,
        rows: parsedRows,
      },
    }, {
      onSuccess: (data: any) => {
        setResult(data);
        setStep("result");
        queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOutboundAnalyticsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetImportsQueryKey() });

        if (personalizationMode !== "off" && generateTiming === "at_import" && data.importedContactIds?.length > 0) {
          setIsGenerating(true);
          bulkGenMut.mutate({
            data: {
              contactIds: data.importedContactIds,
              mode: personalizationMode as any,
            },
          }, {
            onSuccess: (genResult: any) => {
              setIsGenerating(false);
              toast({ title: `Personalization: ${genResult.generated} generated, ${genResult.failed} fallback` });
              queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
            },
            onError: () => {
              setIsGenerating(false);
              toast({ title: "Personalization generation had some issues", variant: "destructive" });
            },
          });
        }

        toast({ title: "Import complete" });
      },
      onError: (err: any) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
    });
  };

  const resetUpload = () => {
    setStep("upload");
    setRawHeaders([]);
    setRawRows([]);
    setParsedRows([]);
    setFileName("");
    setResult(null);
    setIsGenerating(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CSV Upload</h1>
          <p className="text-muted-foreground mt-1">Import contacts and auto-enroll in sequences.</p>
        </div>

        {step === "upload" && (
          <Card className="p-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Upload CSV File</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Required: Full Name (or First + Last), Company, Email. Optional: Title, Phone, Location, Industry, Intent Signal, Custom Line, Segment Type
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl cursor-pointer hover:bg-primary/90 transition">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Choose File</span>
                <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </label>
            </div>
          </Card>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Preview Import</h2>
                  <p className="text-sm text-muted-foreground">{fileName} - {parsedRows.length} valid contacts found</p>
                </div>
                <Button variant="ghost" size="sm" onClick={resetUpload}><X className="h-4 w-4 mr-1" /> Cancel</Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Campaign</label>
                  <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                    <option value="">No campaign</option>
                    {(campaigns || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Template Sequence</label>
                  <select value={templateSetId} onChange={(e) => setTemplateSetId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                    <option value="">No sequence</option>
                    {(templateSets || []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} {s.segmentType ? `(${s.segmentType})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Segment Type</label>
                  <select value={segmentType} onChange={(e) => setSegmentType(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                    <option value="">Auto / None</option>
                    {SEGMENT_TYPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={autoEnroll} onChange={(e) => setAutoEnroll(e.target.checked)} className="rounded" />
                    Auto-enroll in sequence
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={reEnrollExisting} onChange={(e) => setReEnrollExisting(e.target.checked)} className="rounded" />
                    Re-enroll paused/completed
                  </label>
                </div>
              </div>

              <Card className="p-4 border-violet-200 bg-violet-50/50 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <h3 className="text-sm font-semibold text-violet-900">AI Personalization</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-violet-700 block mb-1">Personalization Mode</label>
                    <select value={personalizationMode} onChange={(e) => setPersonalizationMode(e.target.value)}
                      className="w-full px-3 py-2 border border-violet-200 rounded-xl text-sm bg-white">
                      {PERSONALIZATION_MODES.map(m => (
                        <option key={m.value} value={m.value}>{m.label} - {m.desc}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-violet-700 block mb-1">Generate Timing</label>
                    <select value={generateTiming} onChange={(e) => setGenerateTiming(e.target.value as any)}
                      className="w-full px-3 py-2 border border-violet-200 rounded-xl text-sm bg-white"
                      disabled={personalizationMode === "off"}>
                      <option value="at_import">Generate at import</option>
                      <option value="before_send">Generate before send</option>
                    </select>
                  </div>
                </div>
                {personalizationMode !== "off" && (
                  <p className="text-xs text-violet-600 mt-2">
                    AI will generate a custom first line for each contact using available data ({personalizationMode === "enhanced" ? "title, segment, intent signal, why selected" : "company, title, segment"}).
                  </p>
                )}
              </Card>

              <div className="border border-border rounded-xl overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50">
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Company</th>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">Title</th>
                      <th className="text-left px-3 py-2 font-medium">Location</th>
                      <th className="text-left px-3 py-2 font-medium">Industry</th>
                      {parsedRows.some(r => r.customLine) && <th className="text-left px-3 py-2 font-medium">Custom Line</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-3 py-2">{r.fullName}</td>
                        <td className="px-3 py-2">{r.company}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.email}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.title || "-"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.location || "-"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.industry || "-"}</td>
                        {parsedRows.some(r => r.customLine) && <td className="px-3 py-2 text-muted-foreground text-xs">{r.customLine || "-"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 50 && <p className="text-xs text-center py-2 text-muted-foreground">Showing first 50 of {parsedRows.length}</p>}
              </div>
            </Card>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetUpload} className="rounded-xl">Cancel</Button>
              <Button onClick={handleImport} disabled={parsedRows.length === 0 || importMut.isPending}
                className="rounded-xl bg-primary text-white gap-2">
                <Upload className="h-4 w-4" />
                {importMut.isPending ? "Importing..." : `Import ${parsedRows.length} Contacts`}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <Card className="p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold">Import Complete</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 max-w-lg mx-auto">
                <div className="text-center">
                  <div className="text-2xl font-bold">{result.totalRows}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{result.imported}</div>
                  <div className="text-xs text-muted-foreground">Imported</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{result.duplicates}</div>
                  <div className="text-xs text-muted-foreground">Duplicates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{result.invalid}</div>
                  <div className="text-xs text-muted-foreground">Invalid</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{result.enrolled}</div>
                  <div className="text-xs text-muted-foreground">Enrolled</div>
                </div>
              </div>
              {isGenerating && (
                <div className="flex items-center justify-center gap-2 text-violet-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Generating AI personalization...</span>
                </div>
              )}
              <Button onClick={resetUpload} className="rounded-xl">Upload Another File</Button>
            </div>
          </Card>
        )}

        {imports && imports.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Import History</h2>
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium">File</th>
                    <th className="text-left px-4 py-2 font-medium">Total</th>
                    <th className="text-left px-4 py-2 font-medium">Imported</th>
                    <th className="text-left px-4 py-2 font-medium">Enrolled</th>
                    <th className="text-left px-4 py-2 font-medium">Skipped</th>
                    <th className="text-left px-4 py-2 font-medium">Sequence</th>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp: any) => (
                    <tr key={imp.id} className="border-b border-border/30">
                      <td className="px-4 py-2 font-medium">{imp.fileName}</td>
                      <td className="px-4 py-2">{imp.totalRows}</td>
                      <td className="px-4 py-2 text-emerald-600">{imp.importedRows}</td>
                      <td className="px-4 py-2 text-blue-600">{imp.enrolledRows || 0}</td>
                      <td className="px-4 py-2 text-amber-600">{imp.skippedRows}</td>
                      <td className="px-4 py-2 text-muted-foreground">{imp.templateSetName || "-"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{format(new Date(imp.importedAt), "MMM d, h:mm a")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
