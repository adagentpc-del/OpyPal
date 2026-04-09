import { sendEmail } from "./resend";
import { sendViaOutlook, getPrimaryConnection, isOutlookConfigured } from "./outlook-graph";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface EmailAdapter {
  sendAdminNotification(data: AdminNotificationData): Promise<void>;
  sendSubmitterConfirmation(data: SubmitterConfirmationData): Promise<void>;
  sendStatusUpdate(data: StatusUpdateData): Promise<void>;
}

interface AdminNotificationData {
  partnerName: string;
  contactName: string;
  companyName: string;
  eventName: string;
  eventDate: string;
  categories: string[];
  requestId: number;
}

interface SubmitterConfirmationData {
  email: string;
  contactName: string;
  eventName: string;
}

interface StatusUpdateData {
  email: string;
  contactName: string;
  eventName: string;
  newStatus: string;
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "adeltorre@a3visual.com";
const APP_BASE_URL = process.env.APP_BASE_URL || "";

class ResendEmailAdapter implements EmailAdapter {
  async sendAdminNotification(data: AdminNotificationData): Promise<void> {
    const subject = `New A3 Partner Request | ${data.partnerName} | ${data.eventName} | ${data.eventDate}`;
    const detailLink = `${APP_BASE_URL}/a3-partner-portal/admin/requests/${data.requestId}`;

    await sendEmail({
      to: ADMIN_EMAIL,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">New Partner Request</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Partner</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.partnerName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Contact</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.contactName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Company</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.companyName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Event</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.eventName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Date</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.eventDate}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Categories</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${[...new Set(data.categories)].join(", ") || "None selected"}</td></tr>
          </table>
          <p style="margin-top: 20px;"><a href="${detailLink}" style="background: #1a365d; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Request Details</a></p>
        </div>
      `,
    });
  }

  async sendSubmitterConfirmation(data: SubmitterConfirmationData): Promise<void> {
    await sendEmail({
      to: data.email,
      subject: `A3 Visual — We received your request for ${data.eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">Thank you, ${data.contactName}!</h2>
          <p>We've received your request for <strong>${data.eventName}</strong> and our team is reviewing it now.</p>
          <p>You'll hear from us within 1-2 business days with next steps and a preliminary estimate.</p>
          <p style="color: #666; margin-top: 30px; font-size: 13px;">— The A3 Visual Team</p>
        </div>
      `,
    });
  }

  async sendStatusUpdate(data: StatusUpdateData): Promise<void> {
    await sendEmail({
      to: data.email,
      subject: `A3 Visual — Update on your request for ${data.eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">Request Update</h2>
          <p>Hi ${data.contactName},</p>
          <p>Your request for <strong>${data.eventName}</strong> has been updated to: <strong>${data.newStatus}</strong></p>
          <p>Our team will be in touch with next steps shortly.</p>
          <p style="color: #666; margin-top: 30px; font-size: 13px;">— The A3 Visual Team</p>
        </div>
      `,
    });
  }
}

class OutlookEmailAdapter implements EmailAdapter {
  async sendAdminNotification(data: AdminNotificationData): Promise<void> {
    const conn = await getPrimaryConnection();
    if (!conn) {
      return new ResendEmailAdapter().sendAdminNotification(data);
    }

    const subject = `New A3 Partner Request | ${data.partnerName} | ${data.eventName} | ${data.eventDate}`;
    const detailLink = `${APP_BASE_URL}/a3-partner-portal/admin/requests/${data.requestId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a365d;">New Partner Request</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Partner</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.partnerName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Contact</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.contactName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Company</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.companyName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Event</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.eventName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Date</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.eventDate}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Categories</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${[...new Set(data.categories)].join(", ") || "None selected"}</td></tr>
        </table>
        <p style="margin-top: 20px;"><a href="${detailLink}" style="background: #1a365d; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Request Details</a></p>
      </div>
    `;

    const result = await sendViaOutlook(conn.id, { to: ADMIN_EMAIL, subject, bodyHtml: html });
    if (!result.success) {
      console.error("[OutlookAdapter] Send failed, falling back to Resend:", result.error);
      await new ResendEmailAdapter().sendAdminNotification(data);
    }
  }

  async sendSubmitterConfirmation(data: SubmitterConfirmationData): Promise<void> {
    return new ResendEmailAdapter().sendSubmitterConfirmation(data);
  }

  async sendStatusUpdate(data: StatusUpdateData): Promise<void> {
    return new ResendEmailAdapter().sendStatusUpdate(data);
  }
}

async function getSendProvider(): Promise<"outlook" | "resend"> {
  try {
    const [setting] = await db.select().from(settingsTable).where(eq(settingsTable.key, "primary_send_provider"));
    if (setting?.value === "outlook" && isOutlookConfigured()) {
      const conn = await getPrimaryConnection();
      if (conn) return "outlook";
    }
  } catch {}
  return "resend";
}

export async function getActiveAdapter(): Promise<EmailAdapter> {
  const provider = await getSendProvider();
  if (provider === "outlook") return new OutlookEmailAdapter();
  return new ResendEmailAdapter();
}

export const sendAdminNotification = async (data: AdminNotificationData) => {
  const adapter = await getActiveAdapter();
  return adapter.sendAdminNotification(data);
};
export const sendSubmitterConfirmation = async (data: SubmitterConfirmationData) => {
  const adapter = await getActiveAdapter();
  return adapter.sendSubmitterConfirmation(data);
};
export const sendStatusUpdate = async (data: StatusUpdateData) => {
  const adapter = await getActiveAdapter();
  return adapter.sendStatusUpdate(data);
};
