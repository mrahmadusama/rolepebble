# AGENTS.md

Context for AI agents (and people) picking up work on RolePebble in a new session. Read this first, then [DEVELOPMENT.md](DEVELOPMENT.md) for the code itself. Keep this file current: when a phase or decision changes, update it in the same PR.

## What RolePebble is

RolePebble is a hosted job search app for job seekers: one profile, a resume and cover letter tailored to each posting (using only facts from the profile), and every application tracked from draft to offer. It's being turned from a single-user self-hosted app into a multi-user paid service.

It's a modified version of [Dossier](https://dossier.aien.me) by AienTech (`AienTech/dossier`), under the **GNU AGPL v3**. This repository (`mrahmadusama/rolepebble`) is its own repo, not a GitHub fork: forks didn't run GitHub Actions.

## Who's who and how we work

- **Owner: Ahmad Usama** (GitHub `mrahmadusama`). Product owner and designer. **Doesn't write code**: describes changes in plain words, screenshots or Figma, reviews them on the staging site, and approves merges.
- **AI agents (Claude Code) do all the coding.** Explain things in plain language, not jargon. Work in small PRs, each with tests. Never merge without the owner's go-ahead in the conversation.
- **Flow:** owner asks → agent builds on a branch and runs the checks → PR on GitHub, CI runs → owner reviews (on staging, once it exists) → owner approves → agent merges.

## AienTech's terms (agreed by email, 2026-10-28)

AienTech gave their blessing. Keep to what they asked:

- Credit as **"Built on Dossier by AienTech"**, linking to https://dossier.aien.me. `NOTICE` lists our changes.
- RolePebble has **its own icon, privacy policy, and support/security contact** (support@rolepebble.com), and says visibly that it's **run by Ahmad Usama, not the Dossier project**, so users don't end up in Dossier's tracker.
- **No Bundesagentur für Arbeit integration** (removed; its terms forbid this use).
- Fixes that help **self-hosters** may go upstream as PRs to `AienTech/dossier`. **Accounts, billing and other multi-user changes stay in RolePebble**: Dossier is deliberately single-user.
- **Taking Dossier's releases:** RolePebble follows them by merging the release commit (`git fetch upstream --tags`, `git merge upstream/main` on a branch, one PR per release). Conflicts come mostly from what RolePebble changed: keep RolePebble's README, PRIVACY.md and wording; keep the Bundesagentur removed; put new integrations that a hosted service can't use as-is behind a switch, off by default. Last merged: **Dossier 1.10.0** (2026-10-30).
- Thanks go through GitHub Sponsors (`github.com/sponsors/AienTech`), not a revenue share.
- They warned: **Adzuna's API terms allow personal job search**; ask Adzuna before using it in the paid product. Plan on JSearch first.

## AGPL obligations

- The app must always link to the **complete source of the version it runs** (sidebar "Source code" and Settings → About, from `src/lib/releases.ts`). Everything that runs in production is published in this repo.
- Keep `LICENSE` and `NOTICE`; add a line to `NOTICE` for notable changes.
- Nothing can be made closed-source without a separate license from AienTech.

## Accounts and tools

- **Commits and pushes use the owner's personal account only.** This checkout's local git config sets the author to `AHMAD USAMA <48976847+mrahmadusama@users.noreply.github.com>` and a credential helper that pushes as `mrahmadusama`. Never commit or push as another account, and never put a work email in commits.
- **The `gh` CLI's default account on this machine is a different (work) account.** For every `gh` command on this repo, use the personal one:
  `GH_TOKEN="$(gh auth token --user mrahmadusama)" gh ...`
- Don't switch `gh`'s active account or change global git config; the owner uses them for other work.

## Stack and checks

Next.js 16 (App Router), React 19, Prisma 7, PostgreSQL 18, Yarn 4 (via corepack), Playwright's Chromium for PDFs. Details in [DEVELOPMENT.md](DEVELOPMENT.md).

Before pushing, run locally (no Postgres here, so database and browser tests run in CI):

```bash
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 yarn install --immutable && yarn prisma generate
yarn lint
yarn typecheck
yarn vitest run --project node --project dom
yarn build   # catches what only the production build sees, e.g. a server-only import reaching the Edge bundle
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, all unit and database tests with coverage thresholds, and the Playwright end-to-end tests on every PR. On `main` it publishes the image `ghcr.io/mrahmadusama/rolepebble:main` (public).

## Things that are easy to get wrong

- **Don't rename internal identifiers** that still say `dossier`: the `dossier_session` cookie, the key-derivation strings (`dossier ${purpose} v1`), secret associated data, the `DOSSIER_*` environment variables, the export file format. Renaming them signs everyone out and makes stored API keys unreadable. User-facing text says RolePebble.
- **Feature switches:** `DOSSIER_GOOGLE=on` (Gmail, Calendar, Inbox) and `DOSSIER_CONNECTOR=on` (Claude connector, "Write it with Claude") are **off by default** for v1 (`src/lib/features.ts`). The end-to-end tests run with both on.
- **FreeHire** (job source from Dossier 1.10.0) is behind `DOSSIER_FREEHIRE=on`, **off by default**: its free use is for personal job search, and a hosted service like RolePebble needs one of its API plans (freehire.me/terms). While off it isn't listed in Settings, can't be saved, and a saved or environment choice of it reads as Off (`src/lib/job-search/config.ts`). Before switching it on in production: the owner buys a plan, and PRIVACY.md lists FreeHire among the job sources. The end-to-end tests run with it on.
- **Removed from Dossier:** the usage ping and update check (their setting keys stay so old rows are still left out of exports), and the Bundesagentur source (its enum value `ARBEITSAGENTUR` stays only so old saved postings load; a saved choice of it reads as Off).
- **Who runs it:** `src/lib/operator.ts` (operator name, support email). **Links:** `src/lib/releases.ts`.
- **Still single-user until Phase 2's switch (PR 10):** sign-in is one password from `DOSSIER_PASSWORD`. Copy like "on your server" is from Dossier and gets reworded in Phase 2.
- **Owners (Phase 2):** every per-user table has `userId`, filled in by the database from `app.user_id` (`rp_current_user_id()`), or the built-in `owner` account (`OWNER_ID` in `src/lib/db/owner.ts`) until sign-in knows users. **Reach a user's data through `userDb()` (`src/lib/db`), never `@/lib/prisma`:** see "Whose data" in DEVELOPMENT.md; `src/lib/db-audit.test.ts` holds the list of files not moved over yet, which PRs 3–8 shrink to the few system ones. Built-in themes have `userId` null, so create them with `userId: null`. Triggers (`rp_same_owner`) refuse a row that points at another user's row. Database tests run as the signed-in owner (`src/test/db-setup.ts`); `resetDatabase` keeps the owner account, `createTestUser` makes another, and `runAsUser` acts as them. Code that runs without a request (the job runner, the schedulers, print pages, the Claude connector) names its user with `runAsUser`.
- The README's old screenshots in `.github/images/` are Dossier's, left over until RolePebble has its own.
- **The landing page** is `site/` (see [site/README.md](site/README.md)): static files, no build step, and one Cloudflare Pages Function for the waitlist. Its design follows a reference the owner liked (veltro-astro.pages.dev), above all the "How it works" steps that stick and stack as you scroll. The text on it is a draft for the owner to change. Keep it honest: no made-up numbers, reviews or customers.

## Deployment

`deploy/` has a Docker Compose setup (PostgreSQL, the app, Caddy for HTTPS, or a Cloudflare Tunnel) and a step-by-step guide. Planned:

- **Staging:** `staging.rolepebble.com` on a Hetzner CX22, running the image CI publishes from `main`, kept out of search engines. Later the production server.
- **Landing page:** live at https://rolepebble.pages.dev (Cloudflare Pages project `rolepebble`, owner's Cloudflare account, production branch `main`, root directory `site`, output `public`). The waitlist is in the D1 database `rolepebble-waitlist`, bound as `DB`. Every merge to `main` deploys it; pull requests get preview links. `rolepebble.com` gets attached once the owner registers it.

The owner's **personal** Dossier (plain upstream Dossier, for their own job search) runs separately from the old fork `mrahmadusama/dossier`. It isn't part of this repo; don't deploy RolePebble there.

## Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | Validate: domain, waitlist, talk to job seekers, choose payments (Stripe isn't available to sellers in Pakistan: use a merchant of record like Paddle or Lemon Squeezy, after checking payouts to Pakistan) | In progress (owner) |
| 1 | Fork preparation: name, icon, policies, contact, AGPL links, remove calls home and the Bundesagentur, hide Gmail/Calendar and the connector, repo pages, staging, landing page | Code done (PRs #1, #3, #4); landing page live at rolepebble.pages.dev (PR #6). Waiting on the domain and the Hetzner server for staging |
| 2 | Multi-tenancy: accounts (email + password, verification, reset), `userId` on every per-user model, a user-scoped Prisma client plus Postgres row-level security, isolation tests, per-user background jobs, `pg_dump` backups | In progress, in 14 PRs (below) |
| 3 | Billing and AI limits: included AI with monthly credits on a cheap model, plus bring-your-own-key; JSearch first | Not started |
| 4 | Infrastructure, legal (privacy policy reviewed by a lawyer, terms), security review of the isolation layer | Not started |
| 5 | Private beta from the waitlist, then public launch | Not started |
| Later | Gmail/Calendar (needs Google verification and a CASA assessment), Google sign-in, B2B for career coaches | |

**Phase 1, still open:** owner registers `rolepebble.com` (Cloudflare Registrar) with Email Routing for support@, and attaches it to the Pages project; owner creates the Hetzner CX22 and shares its IP, and the agent sets up staging. The landing page's wordmark (pebble "o", in Outfit) and pebble icon are the owner's choices.

### Phase 2 plan (approved 2026-11-02)

Owner decisions: open sign-up behind `DOSSIER_SIGNUP` (keep production on invite/closed until Phase 3 limits exist); AI is the platform key by default plus each user's own key; local AI (Ollama, LM Studio, custom addresses) hidden for users; per-user nightly backups replaced by platform database backups (Phase 4), "Export my data" stays; email confirmation required; Startups and the job agent stay, per user; Gmail, Calendar and the Claude connector stay off. Until PR 10, everything belongs to the `owner` account and the app behaves as before.

| PR | What | Status |
|---|---|---|
| 1 | `User`, the owner account, `userId` on every per-user table, `rp_same_owner` triggers | Merged (#13) |
| 2 | Scoped client `src/lib/db/` (`userDb()`, `runAsUser`), `action()`/`route()` pass it, audit test against raw `prisma` imports | Merged (#14) |
| 3 | Profile, facts, themes, settings on the scoped client; per-user uniques | Merged (#15) |
| 4 | Applications, documents, status, PDFs, print tokens and held PDFs by owner | Open |
| 5 | Find jobs, job agent, Startups; per-user uniques | |
| 6 | Job queue per user with fair turns; schedulers loop over users; caches and downloads by user | |
| 7 | `InstallSetting` split; per-user AI config with platform fallback; local/custom AI refused; a no-op AI hook for Phase 3 credits | |
| 8 | Export/import per user (import remaps ids); "Delete everything" only deletes your data; in-app nightly backups off | |
| 9 | Email module `src/lib/email/` (log, file, Resend) and one-time link tokens | Open (#12) |
| 10 | The switch: email sign-in, sessions with `sub`/`ver`, throttle by IP and email, `DOSSIER_PASSWORD` retired, demo user, e2e as it | |
| 11 | Sign-up, email confirmation, forgot/reset password | |
| 12 | Account page: change password/email, sign out everywhere, delete account | |
| 13 | Isolation test suite (every table, operation and id route, two users) | |
| 14 | Postgres row-level security on (fallback if it misbehaves: layers 1–2 plus the suite, RLS in Phase 4) | |

## For the next session

1. Read this file and check `git log --oneline -15` and open PRs (`GH_TOKEN=... gh pr list --repo mrahmadusama/rolepebble`).
2. Ask the owner what's done on their side (domain, server, landing page copy) before starting work that depends on it.
3. Keep this file's roadmap and "still open" list current.
