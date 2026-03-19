import { getUncachableGoogleSheetClient } from "./google-sheets";
import { logger } from "./logger";

const SHEET_NAME = "MASTER CRM";
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || "";

const SHEET_HEADERS = [
  "App ID",
  "Pipeline Type",
  "Company Name",
  "Contact Name",
  "Title",
  "Email",
  "Phone",
  "LinkedIn",
  "Location",
  "Industry",
  "Venue / Property",
  "Project Type",
  "Estimated Budget",
  "Status",
  "Last Contact Date",
  "Next Step",
  "Next Follow-Up Date",
  "Notes",
  "Deal Value Estimate",
  "Proposal Value",
  "Close Probability",
  "Forecast Value",
  "Source",
];

type SyncStatus = {
  status: "connected" | "syncing" | "error" | "disconnected";
  lastSync: string | null;
  error: string | null;
};

let syncStatus: SyncStatus = {
  status: "disconnected",
  lastSync: null,
  error: null,
};

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

function setSyncing() {
  syncStatus = { status: "syncing", lastSync: syncStatus.lastSync, error: null };
}

function setConnected() {
  syncStatus = { status: "connected", lastSync: new Date().toISOString(), error: null };
}

function setError(msg: string) {
  syncStatus = { status: "error", lastSync: syncStatus.lastSync, error: msg };
}

function leadToRow(lead: any): string[] {
  return [
    String(lead.id),
    lead.pipelineType || "",
    lead.companyName || "",
    lead.contactName || "",
    lead.title || "",
    lead.email || "",
    lead.phone || "",
    lead.linkedin || "",
    lead.location || "",
    lead.industry || "",
    lead.venueProperty || "",
    lead.projectType || "",
    lead.estimatedBudget != null ? String(lead.estimatedBudget) : "",
    lead.status || "",
    lead.lastContactDate || "",
    lead.nextStep || "",
    lead.nextFollowUpDate || "",
    lead.notes || "",
    lead.dealValueEstimate != null ? String(lead.dealValueEstimate) : "",
    lead.proposalValue != null ? String(lead.proposalValue) : "",
    lead.closeProbability != null ? String(lead.closeProbability) : "",
    lead.forecastValue != null ? String(lead.forecastValue) : "",
    lead.source || "",
  ];
}

function rowToLead(row: string[], headers: string[]): Record<string, any> {
  const lead: Record<string, any> = {};
  const headerMap: Record<string, string> = {
    "App ID": "id",
    "Pipeline Type": "pipelineType",
    "Company Name": "companyName",
    "Contact Name": "contactName",
    "Title": "title",
    "Email": "email",
    "Phone": "phone",
    "LinkedIn": "linkedin",
    "Location": "location",
    "Industry": "industry",
    "Venue / Property": "venueProperty",
    "Project Type": "projectType",
    "Estimated Budget": "estimatedBudget",
    "Status": "status",
    "Last Contact Date": "lastContactDate",
    "Next Step": "nextStep",
    "Next Follow-Up Date": "nextFollowUpDate",
    "Notes": "notes",
    "Deal Value Estimate": "dealValueEstimate",
    "Proposal Value": "proposalValue",
    "Close Probability": "closeProbability",
    "Forecast Value": "forecastValue",
    "Source": "source",
  };

  headers.forEach((header, i) => {
    const field = headerMap[header];
    if (field && i < row.length) {
      const val = row[i]?.trim() || "";
      if (!val) return;
      if (["estimatedBudget", "dealValueEstimate", "proposalValue", "closeProbability", "forecastValue"].includes(field)) {
        const num = parseFloat(val.replace(/[$,]/g, ""));
        if (!isNaN(num)) lead[field] = num;
      } else if (field === "id") {
        const num = parseInt(val);
        if (!isNaN(num)) lead[field] = num;
      } else {
        lead[field] = val;
      }
    }
  });

  return lead;
}

async function ensureHeaders(sheets: any): Promise<string[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!1:1`,
  });

  const existingHeaders = res.data.values?.[0] as string[] | undefined;
  if (existingHeaders && existingHeaders.length > 0) {
    return existingHeaders;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [SHEET_HEADERS] },
  });

  return SHEET_HEADERS;
}

export async function readAllLeadsFromSheet(): Promise<{ headers: string[]; rows: string[][]; leads: Record<string, any>[] }> {
  const sheets = await getUncachableGoogleSheetClient();
  const headers = await ensureHeaders(sheets);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'`,
  });

  const allRows = res.data.values || [];
  const dataRows = allRows.slice(1);

  const leads = dataRows
    .filter((row: string[]) => row.some((cell: string) => cell?.trim()))
    .map((row: string[]) => rowToLead(row, headers));

  return { headers, rows: dataRows, leads };
}

export async function syncLeadToSheet(lead: any): Promise<void> {
  if (!SPREADSHEET_ID) return;
  try {
    setSyncing();
    const sheets = await getUncachableGoogleSheetClient();
    const headers = await ensureHeaders(sheets);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'`,
    });

    const allRows = res.data.values || [];
    const appIdCol = headers.indexOf("App ID");

    let existingRowIndex = -1;
    if (appIdCol >= 0) {
      for (let i = 1; i < allRows.length; i++) {
        if (allRows[i][appIdCol]?.trim() === String(lead.id)) {
          existingRowIndex = i;
          break;
        }
      }
    }

    const rowData = leadToRow(lead);
    const reorderedRow = headers.map((h) => {
      const idx = SHEET_HEADERS.indexOf(h);
      return idx >= 0 ? rowData[idx] : "";
    });

    if (existingRowIndex >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A${existingRowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [reorderedRow] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [reorderedRow] },
      });
    }

    setConnected();
    logger.info({ leadId: lead.id }, "Lead synced to Google Sheet");
  } catch (err: any) {
    setError(err.message || "Sync failed");
    logger.error({ err: err.message, leadId: lead.id }, "Failed to sync lead to Google Sheet");
  }
}

export async function deleteLeadFromSheet(leadId: number): Promise<void> {
  if (!SPREADSHEET_ID) return;
  try {
    setSyncing();
    const sheets = await getUncachableGoogleSheetClient();
    const headers = await ensureHeaders(sheets);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEET_NAME}'`,
    });

    const allRows = res.data.values || [];
    const appIdCol = headers.indexOf("App ID");

    if (appIdCol < 0) {
      setConnected();
      return;
    }

    let rowIndex = -1;
    for (let i = 1; i < allRows.length; i++) {
      if (allRows[i][appIdCol]?.trim() === String(leadId)) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex >= 0) {
      const sheetMetaRes = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const sheet = sheetMetaRes.data.sheets?.find(
        (s: any) => s.properties?.title === SHEET_NAME
      );
      const sheetId = sheet?.properties?.sheetId;

      if (sheetId != null) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: "ROWS",
                    startIndex: rowIndex,
                    endIndex: rowIndex + 1,
                  },
                },
              },
            ],
          },
        });
      }
    }

    setConnected();
    logger.info({ leadId }, "Lead deleted from Google Sheet");
  } catch (err: any) {
    setError(err.message || "Delete sync failed");
    logger.error({ err: err.message, leadId }, "Failed to delete lead from Google Sheet");
  }
}

export async function seedFromSheetIfEmpty(dbLeadCount: number): Promise<Record<string, any>[]> {
  if (dbLeadCount > 0) return [];
  if (!SPREADSHEET_ID) return [];

  try {
    setSyncing();
    const { leads } = await readAllLeadsFromSheet();
    const validLeads = leads.filter((l) => l.companyName && l.contactName);

    if (validLeads.length === 0) {
      setConnected();
      return [];
    }

    setConnected();
    logger.info({ count: validLeads.length }, "Seeding CRM from Google Sheet");
    return validLeads;
  } catch (err: any) {
    setError(err.message || "Seed failed");
    logger.error({ err: err.message }, "Failed to seed from Google Sheet");
    return [];
  }
}

export async function testConnection(): Promise<boolean> {
  if (!SPREADSHEET_ID) {
    setError("No spreadsheet ID configured");
    return false;
  }

  try {
    setSyncing();
    const sheets = await getUncachableGoogleSheetClient();
    await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    setConnected();
    return true;
  } catch (err: any) {
    setError(err.message || "Connection test failed");
    return false;
  }
}

export async function fullSyncToSheet(leads: any[]): Promise<void> {
  if (!SPREADSHEET_ID) return;
  try {
    setSyncing();
    const sheets = await getUncachableGoogleSheetClient();
    const headers = await ensureHeaders(sheets);

    const rows = leads.map((lead) => {
      const rowData = leadToRow(lead);
      return headers.map((h) => {
        const idx = SHEET_HEADERS.indexOf(h);
        return idx >= 0 ? rowData[idx] : "";
      });
    });

    const sheetMetaRes = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheet = sheetMetaRes.data.sheets?.find(
      (s: any) => s.properties?.title === SHEET_NAME
    );
    const sheetId = sheet?.properties?.sheetId;

    if (sheetId != null) {
      const currentRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'`,
      });
      const currentRowCount = (currentRes.data.values || []).length;

      if (currentRowCount > 1) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: "ROWS",
                    startIndex: 1,
                    endIndex: currentRowCount,
                  },
                },
              },
            ],
          },
        });
      }
    }

    if (rows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });
    }

    setConnected();
    logger.info({ count: leads.length }, "Full sync to Google Sheet complete");
  } catch (err: any) {
    setError(err.message || "Full sync failed");
    logger.error({ err: err.message }, "Failed to full sync to Google Sheet");
  }
}
