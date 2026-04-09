import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Edit2, Trash2, X, Search, Globe, Phone, MapPin, Users, DollarSign, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL + "api";

interface Company {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  subIndustry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  notes: string | null;
  leadCount: number;
  totalDealValue: string | null;
  leads: Array<{ id: number; contactName: string; status: string; email: string; dealValueEstimate: string | null }>;
  actualLeadCount: number;
  totalValue: number;
}

const emptyForm = { name: "", website: "", industry: "", subIndustry: "", city: "", state: "", country: "", phone: "", notes: "" };

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/companies`);
      const data = await res.json();
      setCompanies(data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return companies;
    const q = search.toLowerCase();
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.industry || "").toLowerCase().includes(q) ||
      (c.city || "").toLowerCase().includes(q)
    );
  }, [companies, search]);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setModalOpen(true); };
  const openEdit = (c: Company) => {
    setForm({ name: c.name, website: c.website || "", industry: c.industry || "", subIndustry: c.subIndustry || "", city: c.city || "", state: c.state || "", country: c.country || "", phone: c.phone || "", notes: c.notes || "" });
    setEditingId(c.id);
    setModalOpen(true);
  };

  const save = async () => {
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_BASE}/companies/${editingId}` : `${API_BASE}/companies`;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Failed");
      toast({ title: editingId ? "Company updated" : "Company created" });
      setModalOpen(false);
      load();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const remove = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/companies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Company deleted" });
      load();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const syncFromLeads = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/companies/sync-from-leads`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast({ title: `Synced ${data.synced} companies (${data.created} new)` });
      load();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    }
    setSyncing(false);
  };

  const totalValue = companies.reduce((s, c) => s + (c.totalValue || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
            <p className="text-muted-foreground mt-1">{companies.length} companies · ${totalValue.toLocaleString()} total pipeline</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncFromLeads} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} /> Sync from Leads
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Add Company
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl bg-background text-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {search ? "No companies match your search" : "No companies yet. Click 'Sync from Leads' to auto-create companies from your lead data."}
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(company => (
              <Card key={company.id} className="overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{company.name}</h3>
                      {company.industry && <Badge variant="outline" className="text-xs">{company.industry}</Badge>}
                    </div>
                    <div className="flex items-center gap-4 mt-0.5 text-sm text-muted-foreground">
                      {(company.city || company.state) && (
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[company.city, company.state].filter(Boolean).join(", ")}</span>
                      )}
                      {company.website && (
                        <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                          <Globe className="h-3.5 w-3.5" />{company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      )}
                      {company.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{company.phone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm flex-shrink-0">
                    <div className="text-center">
                      <div className="font-semibold">{company.actualLeadCount}</div>
                      <div className="text-xs text-muted-foreground">Leads</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">${(company.totalValue || 0).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Value</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === company.id ? null : company.id)}>
                      {expandedId === company.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(company)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(company.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {expandedId === company.id && (
                  <div className="border-t px-4 py-3 bg-muted/30">
                    {company.notes && <p className="text-sm text-muted-foreground mb-3">{company.notes}</p>}
                    {company.leads && company.leads.length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Associated Leads</div>
                        {company.leads.map(lead => (
                          <div key={lead.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-sm">{lead.contactName}</span>
                              <span className="text-xs text-muted-foreground">{lead.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                              {lead.dealValueEstimate && <span className="text-xs font-medium">${parseFloat(lead.dealValueEstimate).toLocaleString()}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No leads associated with this company.</p>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalOpen(false)}>
          <Card className="w-full max-w-lg p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Company" : "Add Company"}</h2>
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Company Name *</label>
                <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Industry</label>
                  <input value={form.industry} onChange={(e) => setForm(f => ({ ...f, industry: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">Website</label>
                  <input value={form.website} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" placeholder="example.com" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">City</label>
                  <input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">State</label>
                  <input value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={!form.name}>{editingId ? "Update" : "Create"}</Button>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
