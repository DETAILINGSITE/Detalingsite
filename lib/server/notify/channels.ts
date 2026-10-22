import { Resend } from "resend";
import twilio from "twilio";
import { emailConfigured, env, smsConfigured } from "@/lib/env";

export type SendResult = { status: "sent"; providerId: string | null } | { status: "skipped"; reason: string };

let resend: Resend | undefined;
let twilioClient: ReturnType<typeof twilio> | undefined;

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; replyTo?: string }): Promise<SendResult> {
  const e = env();
  if (e.NOTIFY_DRIVER === "capture") return { status: "sent", providerId: "captured" };
  if (!emailConfigured(e)) {
    console.info(`[email:skipped] to=${msg.to} subject="${msg.subject}" (RESEND_API_KEY not set)`);
    return { status: "skipped", reason: "email_not_configured" };
  }
  resend ??= new Resend(e.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: e.EMAIL_FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: msg.replyTo,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { status: "sent", providerId: data?.id ?? null };
}

export async function sendSms(msg: { to: string; body: string }): Promise<SendResult> {
  const e = env();
  if (e.NOTIFY_DRIVER === "capture") return { status: "sent", providerId: "captured" };
  if (!smsConfigured(e)) {
    console.info(`[sms:skipped] to=${msg.to} (Twilio not configured)`);
    return { status: "skipped", reason: "sms_not_configured" };
  }
  twilioClient ??= twilio(e.TWILIO_ACCOUNT_SID, e.TWILIO_AUTH_TOKEN);
  const res = await twilioClient.messages.create({
    to: msg.to,
    messagingServiceSid: e.TWILIO_MESSAGING_SERVICE_SID,
    body: msg.body.slice(0, 640),
  });
  return { status: "sent", providerId: res.sid };
}
