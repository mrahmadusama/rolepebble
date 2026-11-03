// Next.js calls register() once when a server starts, before it handles any
// request. It doesn't run during `next build`, so the build needs no secrets.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnvOnStartup } = await import("@/lib/env");
    checkEnvOnStartup();

    // Imported here, inside the Node.js check, so the Edge build leaves the
    // schedulers (and the PDF renderer they reach) out.
    const { startSchedules } = await import("@/lib/schedules");
    await startSchedules();
  }
}
