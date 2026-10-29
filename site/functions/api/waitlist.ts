// POST /api/waitlist: adds an email address to the waitlist, kept in a
// Cloudflare D1 database bound as DB (see site/README.md).
//
// The page's script posts with `Accept: application/json` and gets JSON back.
// Without the script, the form posts as usual and gets a redirect to a page.

// The parts of Cloudflare's D1 and Pages types used here, so the repository
// needs no Cloudflare packages.
interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
}

interface Env {
  DB: D1Database;
}

interface Context {
  request: Request;
  env: Env;
}

// Not a full check: enough to catch typos. The confirmation email at
// launch is what proves an address works.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const SOURCES = new Set(["hero", "footer"]);

function reply(request: Request, ok: boolean, status: number, error?: string) {
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  if (wantsJson) {
    return Response.json(ok ? { ok } : { ok, error }, { status });
  }
  const page = ok ? "/thanks" : "/?invalid#join";
  return Response.redirect(new URL(page, request.url).toString(), 303);
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(request, false, 400, "That didn't work. Please try again.");
  }

  // A field people can't see: only bots fill it in. They're told it worked.
  if (String(form.get("website") ?? "") !== "") return reply(request, true, 200);

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) {
    return reply(request, false, 400, "Please enter a valid email address.");
  }
  const source = String(form.get("source") ?? "");

  try {
    // Joining twice is fine: the first time is kept.
    await env.DB.prepare(
      "INSERT INTO waitlist (email, source, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING",
    )
      .bind(email, SOURCES.has(source) ? source : null, new Date().toISOString())
      .run();
  } catch {
    return reply(request, false, 500, "That didn't work. Please try again in a moment.");
  }
  return reply(request, true, 200);
}
