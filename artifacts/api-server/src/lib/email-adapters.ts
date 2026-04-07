import { sendEmail } from "./resend";

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

  async sendSubmitterConfirmation(_data: SubmitterConfirmationData): Promise<void> {
  }

  async sendStatusUpdate(_data: StatusUpdateData): Promise<void> {
  }
}

class MicrosoftGraphEmailAdapter implements EmailAdapter {
  async sendAdminNotification(_data: AdminNotificationData): Promise<void> {
    throw new Error("Microsoft Graph adapter not implemented yet");
  }
  async sendSubmitterConfirmation(_data: SubmitterConfirmationData): Promise<void> {
    throw new Error("Microsoft Graph adapter not implemented yet");
  }
  async sendStatusUpdate(_data: StatusUpdateData): Promise<void> {
    throw new Error("Microsoft Graph adapter not implemented yet");
  }
}

const adapter: EmailAdapter = new ResendEmailAdapter();

export const sendAdminNotification = (data: AdminNotificationData) => adapter.sendAdminNotification(data);
export const sendSubmitterConfirmation = (data: SubmitterConfirmationData) => adapter.sendSubmitterConfirmation(data);
export const sendStatusUpdate = (data: StatusUpdateData) => adapter.sendStatusUpdate(data);
