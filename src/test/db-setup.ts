import { vi } from "vitest";

// Database tests run as the signed-in owner, as the app does in a request,
// so code that reads `userDb()` works without one. A test file that needs
// someone else, or nobody, mocks the session itself, or uses runAsUser.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  getSession: async () => ({ persistent: false, issuedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }),
}));
