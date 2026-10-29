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
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, all unit and database tests with coverage thresholds, and the Playwright end-to-end tests on every PR. On `main` it publishes the image `ghcr.io/mrahmadusama/rolepebble:main` (public).

## Things that are easy to get wrong

- **Don't rename internal identifiers** that still say `dossier`: the `dossier_session` cookie, the key-derivation strings (`dossier ${purpose} v1`), secret associated data, the `DOSSIER_*` environment variables, the export file format. Renaming them signs everyone out and makes stored API keys unreadable. User-facing text says RolePebble.
- **Feature switches:** `DOSSIER_GOOGLE=on` (Gmail, Calendar, Inbox) and `DOSSIER_CONNECTOR=on` (Claude connector, "Write it with Claude") are **off by default** for v1 (`src/lib/features.ts`). The end-to-end tests run with both on.
- **Removed from Dossier:** the usage ping and update check (their setting keys stay so old rows are still left out of exports), and the Bundesagentur source (its enum value `ARBEITSAGENTUR` stays only so old saved postings load; a saved choice of it reads as Off).
- **Who runs it:** `src/lib/operator.ts` (operator name, support email). **Links:** `src/lib/releases.ts`.
- **Still single-user:** sign-in is one password from `DOSSIER_PASSWORD`. Copy like "on your server" is from Dossier and gets reworded in Phase 2.
- The README's old screenshots in `.github/images/` are Dossier's, left over until RolePebble has its own.
- **The landing page** is `site/` (see [site/README.md](site/README.md)): static files, no build step, and one Cloudflare Pages Function for the waitlist. Its design follows a reference the owner liked (veltro-astro.pages.dev), above all the "How it works" steps that stick and stack as you scroll. The text on it is a draft for the owner to change. Keep it honest: no made-up numbers, reviews or customers.

## Deployment

`deploy/` has a Docker Compose setup (PostgreSQL, the app, Caddy for HTTPS, or a Cloudflare Tunnel) and a step-by-step guide. Planned:

- **Staging:** `staging.rolepebble.com` on a Hetzner CX22, running the image CI publishes from `main`, kept out of search engines. Later the production server.
- **Landing page:** `rolepebble.com` with a waitlist, on Cloudflare Pages, emails stored in Cloudflare D1. Built in `site/`; it goes live once the owner has the domain and follows the steps in `site/README.md`.

The owner's **personal** Dossier (plain upstream Dossier, for their own job search) runs separately from the old fork `mrahmadusama/dossier`. It isn't part of this repo; don't deploy RolePebble there.

## Roadmap

| Phase | What | Status |
|---|---|---|
| 0 | Validate: domain, waitlist, talk to job seekers, choose payments (Stripe isn't available to sellers in Pakistan: use a merchant of record like Paddle or Lemon Squeezy, after checking payouts to Pakistan) | In progress (owner) |
| 1 | Fork preparation: name, icon, policies, contact, AGPL links, remove calls home and the Bundesagentur, hide Gmail/Calendar and the connector, repo pages, staging, landing page | Code done (PRs #1, #3, #4), landing page built. Waiting on the domain to put it live, and on the Hetzner server for staging |
| 2 | Multi-tenancy: accounts (email + password, verification, reset), `userId` on every per-user model, a user-scoped Prisma client plus Postgres row-level security, isolation tests, per-user background jobs, `pg_dump` backups | Not started. The biggest piece: no model has an owner, ~430 queries, six schedulers |
| 3 | Billing and AI limits: included AI with monthly credits on a cheap model, plus bring-your-own-key; JSearch first | Not started |
| 4 | Infrastructure, legal (privacy policy reviewed by a lawyer, terms), security review of the isolation layer | Not started |
| 5 | Private beta from the waitlist, then public launch | Not started |
| Later | Gmail/Calendar (needs Google verification and a CASA assessment), Google sign-in, B2B for career coaches | |

**Phase 1, still open:** owner registers `rolepebble.com` (Cloudflare Registrar) with Email Routing for support@, then connects the landing page to Cloudflare Pages (`site/README.md`); owner creates the Hetzner CX22 and shares its IP, and the agent sets up staging. The landing page's text is waiting on the owner's review. The real logo replaces the placeholder cairn icon whenever the owner has it.

## For the next session

1. Read this file and check `git log --oneline -15` and open PRs (`GH_TOKEN=... gh pr list --repo mrahmadusama/rolepebble`).
2. Ask the owner what's done on their side (domain, server, landing page copy) before starting work that depends on it.
3. Keep this file's roadmap and "still open" list current.
