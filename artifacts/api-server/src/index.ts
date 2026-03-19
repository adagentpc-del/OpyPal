import app from "./app";
import { logger } from "./lib/logger";
import { testConnection, seedFromSheetIfEmpty } from "./lib/sheets-sync";
import { db, leadsTable } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  logger.info({ port }, "Server listening");

  try {
    const connected = await testConnection();
    if (connected) {
      logger.info("Google Sheets connection verified");

      const existingLeads = await db.select().from(leadsTable);
      if (existingLeads.length === 0) {
        const sheetLeads = await seedFromSheetIfEmpty(0);
        if (sheetLeads.length > 0) {
          for (const lead of sheetLeads) {
            const { id, forecastValue, ...rest } = lead;
            const fv = rest.proposalValue || rest.dealValueEstimate
              ? (((rest.proposalValue || rest.dealValueEstimate) * (rest.closeProbability || 0)) / 100).toFixed(2)
              : null;
            await db.insert(leadsTable).values({
              pipelineType: rest.pipelineType || "Event",
              companyName: rest.companyName,
              contactName: rest.contactName,
              title: rest.title || null,
              email: rest.email || null,
              phone: rest.phone || null,
              linkedin: rest.linkedin || null,
              location: rest.location || null,
              industry: rest.industry || null,
              venueProperty: rest.venueProperty || null,
              projectType: rest.projectType || null,
              estimatedBudget: rest.estimatedBudget?.toString() || null,
              status: rest.status || "New Lead",
              lastContactDate: rest.lastContactDate || null,
              nextStep: rest.nextStep || null,
              nextFollowUpDate: rest.nextFollowUpDate || null,
              notes: rest.notes || null,
              dealValueEstimate: rest.dealValueEstimate?.toString() || null,
              proposalValue: rest.proposalValue?.toString() || null,
              closeProbability: rest.closeProbability?.toString() || null,
              forecastValue: fv,
              source: rest.source || null,
            });
          }
          logger.info({ count: sheetLeads.length }, "Seeded CRM from Google Sheet MASTER CRM tab");
        }
      }
    } else {
      logger.warn("Google Sheets connection test failed - sync features will be unavailable");
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Google Sheets init check failed - sync features will be unavailable");
  }
});
