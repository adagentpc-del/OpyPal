import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Save } from "lucide-react";

export default function AdminPartnerForm() {
  const [, params] = useRoute("/admin/partners/:id/edit");
  const partnerId = params?.id ? Number(params.id) : null;
  const isEditing = partnerId !== null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["partner", partnerId],
    queryFn: () => api.partners.get(partnerId!),
    enabled: isEditing,
  });

  const [form, setForm] = useState({
    companyName: "",
    slug: "",
    introHeadline: "",
    introText: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    venueAddress: "",
    industryFocus: "",
    logoUrl: "",
    globalSizzleReelUrl: "",
    partnerVideoUrl: "",
    pricingDisplayEnabled: true,
    isActive: true,
    smallA3BadgeEnabled: true,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        companyName: existing.companyName || "",
        slug: existing.slug || "",
        introHeadline: existing.introHeadline || "",
        introText: existing.introText || "",
        contactName: existing.contactName || "",
        contactEmail: existing.contactEmail || "",
        contactPhone: existing.contactPhone || "",
        venueAddress: existing.venueAddress || "",
        industryFocus: existing.industryFocus || "",
        logoUrl: existing.logoUrl || "",
        globalSizzleReelUrl: existing.globalSizzleReelUrl || "",
        partnerVideoUrl: existing.partnerVideoUrl || "",
        pricingDisplayEnabled: existing.pricingDisplayEnabled ?? true,
        isActive: existing.isActive ?? true,
        smallA3BadgeEnabled: existing.smallA3BadgeEnabled ?? true,
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) =>
      isEditing ? api.partners.update(partnerId!, data) : api.partners.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: isEditing ? "Partner updated" : "Partner created" });
      setLocation("/admin/partners");
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });

  const handleSlugify = (name: string) => {
    if (!isEditing) {
      setForm((f) => ({
        ...f,
        companyName: name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      }));
    } else {
      setForm((f) => ({ ...f, companyName: name }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/partners")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h2 className="text-2xl font-bold">{isEditing ? "Edit Partner" : "New Partner"}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={form.companyName} onChange={(e) => handleSlugify(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required placeholder="company-name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Industry Focus</Label>
                <Input value={form.industryFocus} onChange={(e) => setForm({ ...form, industryFocus: e.target.value })} placeholder="e.g. Hospitality, Corporate" />
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Portal Content</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Intro Headline</Label>
                <Input value={form.introHeadline} onChange={(e) => setForm({ ...form, introHeadline: e.target.value })} placeholder="Elevate Your Event Experience" />
              </div>
              <div className="space-y-2">
                <Label>Intro Text</Label>
                <Textarea value={form.introText} onChange={(e) => setForm({ ...form, introText: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Global Sizzle Reel URL (YouTube embed)</Label>
                <Input value={form.globalSizzleReelUrl} onChange={(e) => setForm({ ...form, globalSizzleReelUrl: e.target.value })} placeholder="https://www.youtube.com/embed/..." />
              </div>
              <div className="space-y-2">
                <Label>Partner Video URL (YouTube embed)</Label>
                <Input value={form.partnerVideoUrl} onChange={(e) => setForm({ ...form, partnerVideoUrl: e.target.value })} placeholder="https://www.youtube.com/embed/..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contact Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Venue Address</Label>
                  <Input value={form.venueAddress} onChange={(e) => setForm({ ...form, venueAddress: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show Starting-At Pricing</Label>
                <Switch checked={form.pricingDisplayEnabled} onCheckedChange={(v) => setForm({ ...form, pricingDisplayEnabled: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show "Powered by A3 Visual" Badge</Label>
                <Switch checked={form.smallA3BadgeEnabled} onCheckedChange={(v) => setForm({ ...form, smallA3BadgeEnabled: v })} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending} size="lg">
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : isEditing ? "Update Partner" : "Create Partner"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
