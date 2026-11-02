import "server-only";

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

// The ways an email can leave RolePebble (src/lib/email/index.ts picks one
// from DOSSIER_EMAIL_TRANSPORT). Each takes what it needs as arguments, so
// none reads the environment itself.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface Transport {
  send(message: EmailMessage): Promise<void>;
}

/** Thrown when an email couldn't be sent. The message never holds the API key or the email's content. */
export class EmailError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmailError";
  }
}

/** "j***@example.com": enough to tell emails apart in a log, without the whole address. */
export function maskAddress(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "***";
  return `${address[0]}***${address.slice(at)}`;
}

/**
 * Sends nothing: notes the email in the server log in one line. The default,
 * so a server without email set up never sends any. The body is left out,
 * since it holds one-time links that sign people in or reset passwords.
 */
export function logTransport(log: (line: string) => void = console.info): Transport {
  return {
    async send({ to, subject }) {
      log(`[email] Not sent (DOSSIER_EMAIL_TRANSPORT=log): "${subject}" to ${maskAddress(to)}`);
    },
  };
}

export type SentMail = EmailMessage & { sentAt: string };

/** The file the `file` transport writes to, in the mail folder. */
export const MAIL_FILE = "outbox.jsonl";

/**
 * Sends nothing: appends each email as one line of JSON to `outbox.jsonl` in
 * `dir` (DOSSIER_DATA_DIR/mail), where development and the browser tests read
 * the links in it.
 */
export function fileTransport(dir: string, now: () => Date = () => new Date()): Transport {
  return {
    async send(message) {
      const mail: SentMail = { sentAt: now().toISOString(), ...message };
      await mkdir(dir, { recursive: true });
      await appendFile(path.join(dir, MAIL_FILE), `${JSON.stringify(mail)}\n`);
    },
  };
}

/** What the `file` transport wrote to `dir`, oldest first; empty when nothing was sent. */
export async function readSentMail(dir: string): Promise<SentMail[]> {
  const content = await readFile(path.join(dir, MAIL_FILE), "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  return content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as SentMail);
}

export const RESEND_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 15_000;

/** Sends through Resend's HTTP API (resend.com/docs/api-reference/emails/send-email). */
export function resendTransport({
  apiKey,
  from,
  fetch = globalThis.fetch,
}: {
  apiKey: string;
  from: string;
  fetch?: typeof globalThis.fetch;
}): Transport {
  return {
    async send({ to, subject, text, html }) {
      let response: Response;
      try {
        response = await fetch(RESEND_URL, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ from, to: [to], subject, text, ...(html ? { html } : {}) }),
          signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        });
      } catch (error) {
        throw new EmailError("Resend didn't answer.", { cause: error });
      }
      if (response.ok) return;
      // Resend explains what went wrong in `message` (a bad key, an unverified domain…).
      const body: unknown = await response.json().catch(() => null);
      const reason =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? `: ${body.message.split("\n", 1)[0]}`
          : "";
      throw new EmailError(`Resend refused the email (${response.status})${reason}`);
    },
  };
}
