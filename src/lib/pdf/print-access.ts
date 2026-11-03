import "server-only";

import { headers } from "next/headers";

import { verifySession } from "@/lib/auth/session";
import { sessionUserId } from "@/lib/db";

import { PRINT_TOKEN_HEADER, verifyPrintToken } from "./print-token";

/**
 * Lets the PDF renderer in with its print token, and anyone signed in (handy
 * for checking a print page in the browser); sends everyone else to /login.
 * Answers whose document it prints, for the page to load it as them
 * (`runAsUser`): the PDF renderer has no session.
 */
export async function verifyPrintAccess(path: string): Promise<string> {
  const token = (await headers()).get(PRINT_TOKEN_HEADER);
  const printing = await verifyPrintToken(token, path);
  if (printing) return printing;
  return sessionUserId(await verifySession());
}
