import "server-only";

import { TOKEN_LIFETIME_MS } from "@/lib/auth/tokens";
import { env } from "@/lib/env";
import { SUPPORT_EMAIL } from "@/lib/operator";

import { type EmailMessage, maskAddress } from "./transports";

// The account emails, in RolePebble's voice: short, plain and warm. Each has
// a text version and a simple HTML one, built from the same lines so they
// never say different things. Anything a user typed (their name, an address)
// is escaped in the HTML.

/** Where the links in emails lead; the account pages use the same paths. */
export const EMAIL_PATHS = {
  verifyEmail: "/verify-email",
  resetPassword: "/reset-password",
  signIn: "/login",
} as const;

// Without DOSSIER_PUBLIC_URL (development: env.ts requires it for Resend),
// links point at the development server.
const DEVELOPMENT_URL = "http://localhost:3000";

function link(path: string, token?: string): string {
  const base = env.DOSSIER_PUBLIC_URL ?? DEVELOPMENT_URL;
  return `${base}${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

/** A name fit for "Hi …,": on one line, without control characters, at most 80 characters. */
function greetingName(name: string | null | undefined): string {
  const clean = (name ?? "").replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim();
  return clean ? Array.from(clean).slice(0, 80).join("").trim() : "there";
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const hours = (ms: number) => {
  const count = Math.round(ms / (60 * 60 * 1000));
  return count === 1 ? "1 hour" : `${count} hours`;
};

type Draft = {
  to: string;
  subject: string;
  name: string | null | undefined;
  before: string[];
  action: { label: string; url: string };
  after: string[];
};

const SUPPORT_LINE = `Questions? Write to ${SUPPORT_EMAIL}.`;

function render({ to, subject, name, before, action, after }: Draft): EmailMessage {
  const greeting = `Hi ${greetingName(name)},`;
  const text = [greeting, ...before, action.url, ...after, SUPPORT_LINE, "RolePebble"].join("\n\n") + "\n";

  const paragraph = (line: string) => `<p style="margin:0 0 16px">${escapeHtml(line)}</p>`;
  const url = escapeHtml(action.url);
  const html = [
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1f2328;max-width:520px">`,
    paragraph(greeting),
    ...before.map(paragraph),
    `<p style="margin:0 0 16px"><a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#1f2328;color:#ffffff;text-decoration:none">${escapeHtml(action.label)}</a></p>`,
    `<p style="margin:0 0 16px;font-size:14px;color:#59636e">Or open this link: <a href="${url}" style="color:#59636e">${url}</a></p>`,
    ...after.map(paragraph),
    paragraph(SUPPORT_LINE),
    paragraph("RolePebble"),
    `</div>`,
  ].join("\n");

  return { to, subject, text, html };
}

type Recipient = { to: string; name?: string | null };

/** Sent after signing up: the link confirms the address. */
export function confirmEmailMessage({ to, name, token }: Recipient & { token: string }): EmailMessage {
  return render({
    to,
    name,
    subject: "Confirm your email for RolePebble",
    before: ["Thanks for signing up for RolePebble. Please confirm your email address with this link:"],
    action: { label: "Confirm my email", url: link(EMAIL_PATHS.verifyEmail, token) },
    after: [
      `The link works for ${hours(TOKEN_LIFETIME_MS.verifyEmail)}. If you didn't sign up, you can ignore this email.`,
    ],
  });
}

/** Sent when someone asks to reset the password: the link lets them choose a new one. */
export function resetPasswordMessage({ to, name, token }: Recipient & { token: string }): EmailMessage {
  return render({
    to,
    name,
    subject: "Reset your RolePebble password",
    before: ["Someone, hopefully you, asked to reset the password for your RolePebble account. Choose a new one here:"],
    action: { label: "Choose a new password", url: link(EMAIL_PATHS.resetPassword, token) },
    after: [
      `The link works once, for ${hours(TOKEN_LIFETIME_MS.resetPassword)}. If you didn't ask, ignore this email: your password stays as it is.`,
    ],
  });
}

/** Sent to the old address after the account's email address changes, in case it wasn't the owner. */
export function emailChangedMessage({ to, name, newEmail }: Recipient & { newEmail: string }): EmailMessage {
  return render({
    to,
    name,
    subject: "Your RolePebble email address was changed",
    before: [
      `The email address for your RolePebble account was just changed to ${maskAddress(newEmail)}. From now on, emails about your account go there instead of here.`,
      "If you made this change, there's nothing else to do. You can sign in as usual:",
    ],
    action: { label: "Sign in to RolePebble", url: link(EMAIL_PATHS.signIn) },
    after: [
      `If you didn't make this change, write to ${SUPPORT_EMAIL} right away and we'll help you get your account back.`,
    ],
  });
}
