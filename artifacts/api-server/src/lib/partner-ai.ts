const UPSELL_MAP: Record<string, string[]> = {
  "Step and repeat": ["Stanchions", "Lighting", "Branded carpet", "Photo signage"],
  "Easy up tent": ["Table throws", "Feather flags", "Branded walls"],
  "Pull up banner": ["Registration signage", "Foam boards"],
  "Event signage": ["Decals", "Printed collateral"],
  "Projection mapping": ["Scenic fabrication", "Video loops"],
  "Custom fabrication needed": ["Concept development", "Premium install"],
  "Branded giveaways": ["Packaging", "Display items"],
  "Branded experience": ["Scenic fabrication", "LED visual support"],
  "Interactive activation": ["Projection mapping", "LED visual support"],
  "Vinyl graphics": ["Window graphics", "Decals"],
  "Backdrops": ["Lighting", "Stanchions", "Branded carpet"],
  "Pipe and drape": ["Branded walls", "Lighting"],
  "Apparel": ["Packaging", "Branded giveaways"],
};

export function getRecommendedUpsells(items: any[]): string[] {
  const upsells = new Set<string>();
  const selectedNames = new Set(items.map((i: any) => i.itemName));

  for (const item of items) {
    const matches = UPSELL_MAP[item.itemName] || [];
    for (const u of matches) {
      if (!selectedNames.has(u)) upsells.add(u);
    }
  }
  return Array.from(upsells);
}

export function estimateScopeLevel(items: any[], uploads: any[]): string {
  const categoryCount = new Set(items.map((i: any) => i.category)).size;
  const hasFab = items.some((i: any) => i.category === "Custom fabrication");
  const hasImmersive = items.some((i: any) => i.category === "Immersive experiences");
  const totalItems = items.length;

  if (hasFab && hasImmersive) return "High";
  if (categoryCount >= 4 || totalItems >= 8) return "High";
  if (categoryCount >= 2 || totalItems >= 4) return "Medium";
  return "Small";
}

export function generateInternalSummary(request: any, items: any[], uploads: any[]): string {
  const lines: string[] = [];
  lines.push("=== INTERNAL QUOTE PREP SUMMARY ===\n");

  lines.push("CONTACT:");
  lines.push(`  Name: ${request.contactName || "N/A"}`);
  lines.push(`  Company: ${request.companyName || "N/A"}`);
  lines.push(`  Email: ${request.email || "N/A"}`);
  lines.push(`  Phone: ${request.phone || "N/A"}\n`);

  lines.push("EVENT:");
  lines.push(`  Event: ${request.eventName || "N/A"}`);
  lines.push(`  Date: ${request.eventDate || "N/A"}`);
  lines.push(`  Venue: ${request.venueName || "N/A"} — ${request.venueAddress || "N/A"}`);
  lines.push(`  Install: ${request.installDatetime || "N/A"}`);
  lines.push(`  Removal: ${request.removalDatetime || "N/A"}`);
  lines.push(`  Post-event: ${request.postEventDisposition || "N/A"}\n`);

  const byCategory: Record<string, string[]> = {};
  for (const item of items) {
    const cat = item.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    const desc = [item.itemName, item.quantityNote, item.sizeNote].filter(Boolean).join(" — ");
    byCategory[cat].push(desc);
  }
  lines.push("REQUESTED ITEMS:");
  for (const [cat, catItems] of Object.entries(byCategory)) {
    lines.push(`  ${cat}:`);
    for (const ci of catItems) lines.push(`    • ${ci}`);
  }
  lines.push("");

  const uploadsByType: Record<string, string[]> = {};
  for (const u of uploads) {
    const t = u.uploadType || "Other";
    if (!uploadsByType[t]) uploadsByType[t] = [];
    uploadsByType[t].push(u.fileName || "file");
  }
  lines.push("UPLOADS RECEIVED:");
  if (uploads.length === 0) {
    lines.push("  None");
  } else {
    for (const [t, files] of Object.entries(uploadsByType)) {
      lines.push(`  ${t}: ${files.join(", ")}`);
    }
  }
  lines.push("");

  const hasDesign = items.some((i: any) => i.category === "Design and artwork");
  const hasFab = items.some((i: any) => i.category === "Custom fabrication");
  const hasImmersive = items.some((i: any) => i.category === "Immersive experiences");
  const hasPromo = items.some((i: any) => i.category === "Promotional items");
  const hasPrint = items.some((i: any) => i.category === "Printing");
  const hasArtwork = uploads.some((u: any) => u.uploadType === "Artwork");

  if (hasDesign) lines.push("DESIGN NEEDS: Design assistance requested — additional fees may apply");
  if (hasFab) lines.push("FABRICATION: Custom fabrication requested — concept review needed");
  if (hasImmersive) lines.push("IMMERSIVE: Immersive experience requested — technical scope review needed");
  if (hasPromo) lines.push("PROMO: Promotional items requested");

  const missing: string[] = [];
  if (hasPrint && !hasArtwork) missing.push("Print items selected but no artwork uploaded");
  if (!request.eventDate) missing.push("Event date not provided");
  if (!request.venueAddress) missing.push("Venue address not provided");
  if (missing.length) {
    lines.push("\nMISSING INFORMATION:");
    for (const m of missing) lines.push(`  ⚠ ${m}`);
  }

  lines.push("\nSUGGESTED NEXT ACTION:");
  if (missing.length > 0) {
    lines.push("  Follow up for missing details before preparing quote.");
  } else if (hasFab || hasImmersive) {
    lines.push("  Schedule scope review call to discuss technical requirements.");
  } else {
    lines.push("  Prepare estimate based on provided details.");
  }

  return lines.join("\n");
}

export async function generateAiSummary(request: any, items: any[], uploads: any[]): Promise<string> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    });

    const prompt = `You are an internal sales assistant for A3 Visual, a premier experiential marketing and event production company.

Analyze this partner request and provide a concise internal summary:

Contact: ${request.contactName} from ${request.companyName}
Email: ${request.email}, Phone: ${request.phone}
Event: ${request.eventName} on ${request.eventDate}
Venue: ${request.venueName} at ${request.venueAddress}
Install: ${request.installDatetime}, Removal: ${request.removalDatetime}
Industry: ${request.industry}, Use Case: ${request.useCase}
Post-event disposition: ${request.postEventDisposition}

Requested items (${items.length}):
${items.map((i: any) => `- ${i.category}: ${i.itemName}${i.quantityNote ? ` (${i.quantityNote})` : ""}${i.sizeNote ? ` [${i.sizeNote}]` : ""}`).join("\n")}

Uploads received: ${uploads.length} files (${uploads.map((u: any) => u.uploadType).filter(Boolean).join(", ") || "none"})
Design assistance: ${request.designAssistanceRequested || "No"}
Custom fabrication: ${request.customFabricationRequested || "No"}
Immersive: ${request.immersiveRequested || "No"}
Additional notes: ${request.additionalNotes || "None"}

Provide a brief internal summary covering:
1. Project Overview (2-3 sentences)
2. Complexity Estimate (Low/Medium/High with reason)
3. Timeline Sensitivity (any rush concerns)
4. Potential Risk Flags
5. Missing Details
6. Recommended Next Step`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    return textBlock ? (textBlock as any).text : "AI summary unavailable.";
  } catch (e: any) {
    console.error("AI summary error:", e.message);
    return "AI summary generation failed — manual review recommended.";
  }
}
