import "server-only";

import { ActionError } from "@/lib/action";
import { env } from "@/lib/env";

// The integrations RolePebble's first version leaves out, each behind a
// server switch that's off unless set to on: DOSSIER_GOOGLE for Gmail,
// Calendar and the Inbox, DOSSIER_CONNECTOR for the Claude connector and the
// buttons that hand work to Claude chat. While one is off nothing of it
// shows, its routes answer 404, its actions refuse and its schedules don't
// start. The code stays, and its tests run with the switches on.
//
// Client components never read these: server components pass `features()`
// down.

export type Features = { google: boolean; connector: boolean };
export type Feature = keyof Features;

export const googleEnabled = (): boolean => env.DOSSIER_GOOGLE === "on";
export const connectorEnabled = (): boolean => env.DOSSIER_CONNECTOR === "on";

export const features = (): Features => ({ google: googleEnabled(), connector: connectorEnabled() });

/** For Server Actions: refuses while Gmail and Calendar are off. */
export function requireGoogle(): void {
  if (!googleEnabled()) throw new ActionError("Gmail and Google Calendar aren't available on this server.");
}

/** For Server Actions: refuses while the Claude connector is off. */
export function requireConnector(): void {
  if (!connectorEnabled()) throw new ActionError("The Claude connector isn't available on this server.");
}
