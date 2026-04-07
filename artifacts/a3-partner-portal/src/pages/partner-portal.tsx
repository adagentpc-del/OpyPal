import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle, ChevronRight, ChevronLeft, Upload, Printer,
  Tent, Palette, Hammer, Sparkles, Gift, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const INDUSTRIES = [
  "Corporate", "Hospitality", "Entertainment", "Sports", "Non-Profit",
  "Retail", "Technology", "Healthcare", "Education", "Government", "Other",
];

const USE_CASES = [
  "Trade Show / Expo", "Conference", "Gala / Awards", "Brand Activation",
  "Grand Opening", "Product Launch", "Experiential Pop-up", "Fundraiser",
  "Sporting Event", "Concert / Festival", "Corporate Meeting", "Other",
];

const SERVICE_CATEGORIES = [
  {
    name: "Printing",
    icon: Printer,
    items: [
      "Step and repeat", "Pull up banner", "Vinyl graphics", "Foam board signage",
      "Event signage", "Wayfinding", "Window graphics", "Table throws",
      "Backdrops", "Decals", "Large format prints",
    ],
  },
  {
    name: "Rentals",
    icon: Tent,
    items: [
      "Easy up tent", "Easels", "Stanchions", "Pipe and drape",
      "Display structures", "Screens", "LED furniture", "Event barriers",
    ],
  },
  {
    name: "Design and artwork",
    icon: Palette,
    items: [
      "I have final artwork", "I need edits to existing artwork", "I need full design support",
    ],
  },
  {
    name: "Custom fabrication",
    icon: Hammer,
    items: ["Custom fabrication needed", "Concept development needed"],
  },
  {
    name: "Immersive experiences",
    icon: Sparkles,
    items: [
      "Projection mapping", "Scenic environment", "Branded experience",
      "Interactive activation", "LED visual support",
    ],
  },
  {
    name: "Promotional items",
    icon: Gift,
    items: [
      "Branded giveaways", "Apparel", "Packaging", "Printed collateral",
      "Custom promo item request",
    ],
  },
];

const UPLOAD_TYPES = ["Floor maps", "Measurements", "Decks", "Artwork", "Inspiration files"];

interface FormData {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  eventName: string;
  eventDate: string;
  venueName: string;
  venueAddress: string;
  installDatetime: string;
  removalDatetime: string;
  postEventDisposition: string;
  industry: string;
  useCase: string;
  additionalNotes: string;
  items: { category: string; itemName: string; quantityNote: string; sizeNote: string }[];
  uploads: { uploadType: string; fileName: string }[];
}

const initialForm: FormData = {
  companyName: "", contactName: "", email: "", phone: "",
  eventName: "", eventDate: "", venueName: "", venueAddress: "",
  installDatetime: "", removalDatetime: "", postEventDisposition: "",
  industry: "", useCase: "", additionalNotes: "",
  items: [], uploads: [],
};

export default function PartnerPortal() {
  const [, params] = useRoute("/partner/:slug");
  const slug = params?.slug || "";
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm);
  const [successOpen, setSuccessOpen] = useState(false);

  const { data: partner, isLoading, error } = useQuery({
    queryKey: ["partner-public", slug],
    queryFn: () => api.partners.getBySlug(slug),
    enabled: !!slug,
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => api.requests.create(data),
    onSuccess: () => setSuccessOpen(true),
  });

  const pricing = partner?.pricing || [];
  const pricingByCategory = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const p of pricing) {
      if (!m[p.category]) m[p.category] = [];
      m[p.category].push(p);
    }
    return m;
  }, [pricing]);

  const toggleItem = (category: string, itemName: string) => {
    setForm((f) => {
      const exists = f.items.find((i) => i.category === category && i.itemName === itemName);
      if (exists) {
        return { ...f, items: f.items.filter((i) => !(i.category === category && i.itemName === itemName)) };
      }
      return { ...f, items: [...f.items, { category, itemName, quantityNote: "", sizeNote: "" }] };
    });
  };

  const isItemSelected = (category: string, itemName: string) =>
    form.items.some((i) => i.category === category && i.itemName === itemName);

  const handleSubmit = () => {
    const hasCustomFab = form.items.some((i) => i.category === "Custom fabrication");
    const hasImmersive = form.items.some((i) => i.category === "Immersive experiences");
    const hasPrint = form.items.some((i) => i.category === "Printing");
    const hasArtwork = form.uploads.some((u) => u.uploadType === "Artwork");

    if (hasPrint && !hasArtwork) {
      const proceed = window.confirm("You selected print items but did not upload artwork. Continue anyway?");
      if (!proceed) return;
    }

    submitMutation.mutate({
      partnerId: partner.id,
      ...form,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Portal Not Found</h1>
          <p className="text-muted-foreground">This partner portal is not available.</p>
        </div>
      </div>
    );
  }

  const steps = ["Contact & Event", "Industry & Use Case", "Services", "Uploads", "Review & Submit"];
  const progressPercent = ((step + 1) / steps.length) * 100;

  const canNext = () => {
    if (step === 0) return form.contactName && form.email && form.eventName;
    if (step === 1) return form.industry;
    if (step === 2) return form.items.length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[hsl(215,79%,28%)] text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              {partner.logoUrl ? (
                <img src={partner.logoUrl} alt={partner.companyName} className="h-12 mb-2" />
              ) : (
                <h1 className="text-3xl font-bold tracking-tight">{partner.companyName}</h1>
              )}
            </div>
            {partner.smallA3BadgeEnabled && (
              <div className="text-xs opacity-70 flex items-center gap-1">
                Powered by <span className="font-semibold">A3 Visual</span>
              </div>
            )}
          </div>
          {partner.introHeadline && (
            <p className="text-xl mt-4 text-white/90 max-w-2xl">{partner.introHeadline}</p>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {partner.introText && (
          <div className="text-lg text-gray-600 max-w-3xl leading-relaxed">
            {partner.introText}
          </div>
        )}

        {partner.globalSizzleReelUrl && (
          <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
            <iframe
              src={partner.globalSizzleReelUrl}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="A3 Visual Sizzle Reel"
            />
          </div>
        )}

        {partner.partnerVideoUrl && (
          <div className="aspect-video rounded-xl overflow-hidden shadow-lg max-w-3xl mx-auto">
            <iframe
              src={partner.partnerVideoUrl}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Partner Video"
            />
          </div>
        )}

        {partner.pricingDisplayEnabled && pricing.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Starting-At Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(pricingByCategory).map(([cat, items]) => (
                <Card key={cat} className="overflow-hidden">
                  <div className="bg-[hsl(215,79%,28%)] text-white px-4 py-3">
                    <h3 className="font-semibold">{cat}</h3>
                  </div>
                  <CardContent className="p-0">
                    {items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between px-4 py-2.5 text-sm border-b last:border-0 hover:bg-muted/20">
                        <span>{item.itemName}</span>
                        <span className="font-medium text-primary">
                          {item.startingPrice ? `From $${item.startingPrice}` : "Get a Quote"}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <Separator />

        <section id="intake-form">
          <h2 className="text-2xl font-bold mb-2">Start Your Project</h2>
          <p className="text-muted-foreground mb-8">Tell us about your event and we will follow up with a custom proposal.</p>

          <div className="mb-8">
            <div className="flex items-center justify-between text-sm mb-2">
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => i <= step && setStep(i)}
                  className={`text-xs font-medium transition-colors ${i <= step ? "text-primary" : "text-muted-foreground"} ${i < step ? "cursor-pointer hover:underline" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Contact & Event Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Name *</Label>
                        <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Event Name *</Label>
                        <Input value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Event Date</Label>
                        <Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Venue Name</Label>
                        <Input value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Venue Address</Label>
                        <Input value={form.venueAddress} onChange={(e) => setForm({ ...form, venueAddress: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Install Date/Time</Label>
                        <Input type="datetime-local" value={form.installDatetime} onChange={(e) => setForm({ ...form, installDatetime: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Removal Date/Time</Label>
                        <Input type="datetime-local" value={form.removalDatetime} onChange={(e) => setForm({ ...form, removalDatetime: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Post-Event Disposition</Label>
                      <Select value={form.postEventDisposition} onValueChange={(v) => setForm({ ...form, postEventDisposition: v })}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Keep">Keep</SelectItem>
                          <SelectItem value="Remove">Remove</SelectItem>
                          <SelectItem value="Discard">Discard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 1 && (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Industry & Use Case</h3>
                    <div className="space-y-2">
                      <Label>Industry *</Label>
                      <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                        <SelectTrigger><SelectValue placeholder="Select industry..." /></SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Use Case</Label>
                      <Select value={form.useCase} onValueChange={(v) => setForm({ ...form, useCase: v })}>
                        <SelectTrigger><SelectValue placeholder="Select use case..." /></SelectTrigger>
                        <SelectContent>
                          {USE_CASES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Select Services</h3>
                  <p className="text-sm text-muted-foreground">Choose the items you need for your event. You can select multiple items across categories.</p>
                  {SERVICE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const catPricing = pricingByCategory[cat.name] || [];
                    return (
                      <Card key={cat.name}>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Icon className="w-5 h-5 text-primary" />
                            <h4 className="font-semibold text-lg">{cat.name}</h4>
                            {form.items.filter((i) => i.category === cat.name).length > 0 && (
                              <Badge variant="secondary" className="ml-auto">
                                {form.items.filter((i) => i.category === cat.name).length} selected
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {cat.items.map((item) => {
                              const selected = isItemSelected(cat.name, item);
                              const priceInfo = catPricing.find((p: any) => p.itemName === item);
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => toggleItem(cat.name, item)}
                                  className={`relative text-left p-4 rounded-lg border-2 transition-all ${
                                    selected
                                      ? "border-primary bg-primary/5 shadow-sm"
                                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                  }`}
                                >
                                  {selected && (
                                    <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-primary" />
                                  )}
                                  <p className="font-medium text-sm pr-6">{item}</p>
                                  {priceInfo && partner.pricingDisplayEnabled && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {priceInfo.startingPrice ? `From $${priceInfo.startingPrice}` : "Get a Quote"}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {form.items.some((i) => i.category === "Custom fabrication") && (
                    <Card className="border-amber-200 bg-amber-50/50">
                      <CardContent className="p-4">
                        <p className="text-sm font-medium text-amber-800">
                          Custom fabrication selected. Our team will follow up to discuss concept development and technical requirements.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {form.items.some((i) => i.category === "Immersive experiences") && (
                    <Card className="border-purple-200 bg-purple-50/50">
                      <CardContent className="p-4">
                        <p className="text-sm font-medium text-purple-800">
                          Immersive experience selected. Please share any inspiration images or concept briefs in the next step to help us scope your project.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {form.items.some((i) => i.itemName === "I need full design support") && (
                    <Card className="border-blue-200 bg-blue-50/50">
                      <CardContent className="p-4">
                        <p className="text-sm font-medium text-blue-800">
                          Full design support selected. Additional design fees will apply based on project scope.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {step === 3 && (
                <Card>
                  <CardContent className="p-6 space-y-6">
                    <h3 className="text-lg font-semibold">Upload Files</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload any relevant files to help us prepare your proposal. All file types accepted.
                    </p>
                    {UPLOAD_TYPES.map((type) => {
                      const existingUploads = form.uploads.filter((u) => u.uploadType === type);
                      return (
                        <div key={type} className="space-y-2">
                          <Label className="text-sm font-medium">{type}</Label>
                          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Drag and drop files here, or click to browse
                            </p>
                            <input
                              type="file"
                              multiple
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              style={{ position: "relative" }}
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                const newUploads = files.map((f) => ({
                                  uploadType: type,
                                  fileName: f.name,
                                }));
                                setForm((prev) => ({
                                  ...prev,
                                  uploads: [...prev.uploads, ...newUploads],
                                }));
                              }}
                            />
                          </div>
                          {existingUploads.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {existingUploads.map((u, i) => (
                                <Badge key={i} variant="secondary" className="gap-1">
                                  {u.fileName}
                                  <button
                                    type="button"
                                    className="ml-1 text-xs hover:text-destructive"
                                    onClick={() => {
                                      setForm((prev) => ({
                                        ...prev,
                                        uploads: prev.uploads.filter((_, idx) => {
                                          const uploadIdx = prev.uploads.findIndex(
                                            (x) => x.uploadType === type && x.fileName === u.fileName
                                          );
                                          return idx !== uploadIdx;
                                        }),
                                      }));
                                    }}
                                  >
                                    x
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="space-y-2">
                      <Label>Additional Notes</Label>
                      <Textarea
                        value={form.additionalNotes}
                        onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })}
                        rows={4}
                        placeholder="Any additional details, special requirements, or notes for our team..."
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 4 && (
                <Card>
                  <CardContent className="p-6 space-y-6">
                    <h3 className="text-lg font-semibold">Review Your Request</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Contact</h4>
                          <p className="font-medium">{form.contactName}</p>
                          {form.companyName && <p className="text-sm text-muted-foreground">{form.companyName}</p>}
                          <p className="text-sm">{form.email}</p>
                          {form.phone && <p className="text-sm">{form.phone}</p>}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Event</h4>
                          <p className="font-medium">{form.eventName}</p>
                          {form.eventDate && <p className="text-sm">Date: {new Date(form.eventDate).toLocaleDateString()}</p>}
                          {form.venueName && <p className="text-sm">Venue: {form.venueName}</p>}
                          {form.venueAddress && <p className="text-sm text-muted-foreground">{form.venueAddress}</p>}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Industry & Use Case</h4>
                          <p>{form.industry}</p>
                          {form.useCase && <p className="text-sm text-muted-foreground">{form.useCase}</p>}
                        </div>
                        {form.postEventDisposition && (
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Post-Event</h4>
                            <p>{form.postEventDisposition}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Selected Services ({form.items.length})</h4>
                      <div className="space-y-2">
                        {SERVICE_CATEGORIES.map((cat) => {
                          const catItems = form.items.filter((i) => i.category === cat.name);
                          if (catItems.length === 0) return null;
                          return (
                            <div key={cat.name}>
                              <p className="text-sm font-medium">{cat.name}</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {catItems.map((item) => (
                                  <Badge key={item.itemName} variant="outline">{item.itemName}</Badge>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {form.uploads.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Uploads ({form.uploads.length})</h4>
                          <div className="flex flex-wrap gap-2">
                            {form.uploads.map((u, i) => (
                              <Badge key={i} variant="secondary">{u.uploadType}: {u.fileName}</Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {form.additionalNotes && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Notes</h4>
                          <p className="text-sm">{form.additionalNotes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={step === 0}
              size="lg"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>

            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                size="lg"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                size="lg"
                className="bg-[hsl(44,100%,48%)] text-gray-900 hover:bg-[hsl(44,100%,42%)] font-semibold px-8"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Request"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </section>
      </div>

      <footer className="bg-gray-50 border-t mt-16 py-8">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>Powered by A3 Visual &middot; Premier Event Production</p>
        </div>
      </footer>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
              Request submitted successfully
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">
            Thank you. Your project request has been received. We will review the details and follow up as needed.
          </p>
          <Button onClick={() => { setSuccessOpen(false); setStep(0); setForm(initialForm); }} className="mt-2">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
