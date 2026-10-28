"use server";

import { z } from "zod";

import { action } from "@/lib/action";
import { saveSettings } from "@/lib/settings-data";

/** Remembers the dashboard's period (E9-8), for the next visit. */
export const rememberDashboardPeriod = action(z.object({ period: z.enum(["30d", "90d", "all"]) }), async ({ period }) => {
  await saveSettings({ dashboardPeriod: period });
  return null;
});

/** Days without news before "Worth a look" suggests a follow-up (E9-9). */
export const rememberQuietDays = action(z.object({ days: z.number().int().min(1).max(60) }), async ({ days }) => {
  await saveSettings({ quietDays: days });
  return null;
});

