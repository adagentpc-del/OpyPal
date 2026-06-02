import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";
import { getSchedulerStatus, startScheduler, stopScheduler } from "../lib/background-scheduler";

const router: IRouter = Router();

const SETTINGS_KEYS = [
  "primary_send_provider",
  "weekday_sending_only",
  "sending_start_hour",
  "sending_end_hour",
  "default_timezone",
  "throttle_per_hour",
  "min_delay_between_emails_seconds",
  "max_delay_between_emails_seconds",
  "auto_stop_on_human_reply",
  "ignore_auto_replies",
  "review_uncertain_replies",
  "scheduler_enabled",
  "outlook_sync_interval_minutes",
];

const DEFAULT_VALUES: Record<string, string> = {
  primary_send_provider: "resend",
  weekday_sending_only: "true",
  sending_start_hour: "8",
  sending_end_hour: "18",
  default_timezone: "America/Los_Angeles",
  throttle_per_hour: "50",
  min_delay_between_emails_seconds: "5",
  max_delay_between_emails_seconds: "30",
  auto_stop_on_human_reply: "true",
  ignore_auto_replies: "true",
  review_uncertain_replies: "true",
  scheduler_enabled: "true",
  outlook_sync_interval_minutes: "2",
};

router.get("/settings", async (req, res) => {
  try {
    const rows = await db.select().from(settingsTable)
      .where(eq(settingsTable.workspaceId, req.workspaceId!));
    const settings: Record<string, string> = {};

    for (const key of SETTINGS_KEYS) {
      const row = rows.find(r => r.key === key);
      settings[key] = row?.value || DEFAULT_VALUES[key] || "";
    }

    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/settings", requireRole("manager"), async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    const workspaceId = req.workspaceId!;

    for (const [key, value] of Object.entries(updates)) {
      if (!SETTINGS_KEYS.includes(key)) continue;

      const [existing] = await db.select().from(settingsTable)
        .where(and(eq(settingsTable.workspaceId, workspaceId), eq(settingsTable.key, key)));
      if (existing) {
        await db.update(settingsTable).set({ value, updatedAt: new Date() })
          .where(and(eq(settingsTable.workspaceId, workspaceId), eq(settingsTable.key, key)));
      } else {
        await db.insert(settingsTable).values({ key, value, workspaceId });
      }
    }

    const rows = await db.select().from(settingsTable)
      .where(eq(settingsTable.workspaceId, workspaceId));
    const settings: Record<string, string> = {};
    for (const key of SETTINGS_KEYS) {
      const row = rows.find(r => r.key === key);
      settings[key] = row?.value || DEFAULT_VALUES[key] || "";
    }

    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/scheduler/status", async (_req, res) => {
  try {
    const status = await getSchedulerStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/scheduler/start", async (_req, res) => {
  try {
    startScheduler();
    const status = await getSchedulerStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/scheduler/stop", async (_req, res) => {
  try {
    stopScheduler();
    const status = await getSchedulerStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
