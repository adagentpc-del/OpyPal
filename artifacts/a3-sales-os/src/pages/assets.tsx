import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useGetAssets, useCreateAsset, useUpdateAsset, useDeleteAsset, getGetAssetsQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, File, Image as ImageIcon, Link as LinkIcon, Plus, Edit2, Trash2, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ASSET_CATEGORIES = ["Brochure", "Capabilities Deck", "Case Study", "Proposal Example", "Photos / Completed Work", "Brand Assets", "Outreach Docs"];

export default function Assets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const { data: assets, isLoading } = useGetAssets({ search: searchTerm || undefined, category: categoryFilter || undefined });
  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();
  const deleteMutation = useDeleteAsset();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [form, setForm] = useState({ title: "", category: "Brochure", description: "", url: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetAssetsQueryKey() });

  const openNew = () => {
    setEditingAsset(null);
    setForm({ title: "", category: "Brochure", description: "", url: "" });
    setModalOpen(true);
  };

  const openEdit = (a: any) => {
    setEditingAsset(a);
    setForm({ title: a.title, category: a.category, description: a.description || "", url: a.url || "" });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.title) { toast({ title: "Title is required", variant: "destructive" }); return; }
    const payload = { ...form, url: form.url || undefined, description: form.description || undefined };
    if (editingAsset) {
      updateMutation.mutate({ id: editingAsset.id, data: payload }, { onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Asset updated" }); } });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Asset added" }); } });
    }
  };

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    deleteMutation.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Asset deleted" }); } });
  };

  const getIcon = (cat: string) => {
    if (cat.includes("Photo") || cat.includes("Brand")) return <ImageIcon className="h-8 w-8 text-accent" />;
    if (cat.includes("Case")) return <File className="h-8 w-8 text-emerald-500" />;
    return <File className="h-8 w-8 text-primary" />;
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-5 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Marketing Assets</h1>
            <p className="text-muted-foreground text-sm mt-1">Decks, case studies, and brand collateral.</p>
          </div>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Asset
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search assets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:border-primary outline-none" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:border-primary outline-none">
            <option value="">All Categories</option>
            {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : assets?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No assets found. Add your first asset above.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {assets?.map((asset) => (
              <Card key={asset.id} className="bg-card border-border/50 rounded-2xl hover:shadow-md transition-all group overflow-hidden flex flex-col">
                <div className="h-28 bg-muted flex items-center justify-center border-b border-border/50 group-hover:bg-primary/5 transition-colors relative">
                  {getIcon(asset.category)}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {asset.url && (
                      <a href={asset.url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-background rounded-lg shadow-sm hover:text-primary">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button onClick={() => openEdit(asset)} className="p-1.5 bg-background rounded-lg shadow-sm hover:text-primary">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(asset.id, asset.title)} className="p-1.5 bg-background rounded-lg shadow-sm hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{asset.category}</span>
                  <h3 className="font-bold text-sm leading-tight">{asset.title}</h3>
                  {asset.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{asset.description}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">{editingAsset ? "Edit Asset" : "Add Asset"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                  {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">URL / Link</label>
                <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[70px] resize-y" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSave} className="bg-primary text-white rounded-xl">{editingAsset ? "Save" : "Add Asset"}</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
