import "server-only";

import path from "node:path";

import { type Env, env } from "@/lib/env";

import { type EmailMessage, fileTransport, logTransport, resendTransport, type Transport } from "./transports";

// Account emails (confirm your email, reset your password): how they go out
// is set by DOSSIER_EMAIL_TRANSPORT. The messages are in ./messages.ts.

export { EmailError, type EmailMessage, readSentMail, type SentMail, type Transport } from "./transports";

type EmailEnv = Pick<
  Env,
  "DOSSIER_EMAIL_TRANSPORT" | "DOSSIER_EMAIL_FROM" | "RESEND_API_KEY" | "DOSSIER_DATA_DIR"
>;

/** Where the `file` transport writes: DOSSIER_DATA_DIR/mail. */
export const mailDir = (config: Pick<Env, "DOSSIER_DATA_DIR"> = env) => path.join(config.DOSSIER_DATA_DIR, "mail");

/** The transport the environment asks for. */
export function transportFor(config: EmailEnv): Transport {
  switch (config.DOSSIER_EMAIL_TRANSPORT) {
    case "file":
      return fileTransport(mailDir(config));
    case "resend":
      // env.ts refuses to start with `resend` and either of these unset.
      return resendTransport({ apiKey: config.RESEND_API_KEY!, from: config.DOSSIER_EMAIL_FROM! });
    case "log":
      return logTransport();
  }
}

/** Sends an email the way DOSSIER_EMAIL_TRANSPORT says. Throws an EmailError when it can't. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  await transportFor(env).send(message);
}
