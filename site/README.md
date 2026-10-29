# rolepebble.com

RolePebble's landing page and waitlist, on Cloudflare Pages.

- `public/`: the page as it's served. Plain HTML, CSS and a little JavaScript, no build step. Fonts are served from here (Outfit and Geist, both under the SIL Open Font License), so the page loads nothing from other sites.
- `functions/api/waitlist.ts`: the one server part, a Cloudflare Pages Function that saves an email address to the waitlist. Its tests run with the app's (`yarn vitest run --project node site/`).
- `schema.sql`: the waitlist table, in a Cloudflare D1 database.

## Photos

Both from Unsplash, under the [Unsplash License](https://unsplash.com/license) (free to use, including commercially). Resized to WebP in `public/images/`.

- `hero-*.webp`: [Christian Velitchkov](https://unsplash.com/@cvelitchkov), https://unsplash.com/photos/oCD1HUJmFIM
- `late-night-*.webp`: [Mina Rad](https://unsplash.com/@miinrad), https://unsplash.com/photos/TRNRxPvnF_g

## Preview

Any static server shows the page; only the waitlist form needs Cloudflare's tools:

```bash
npx serve site/public
```

With the form working, against a local database:

```bash
cd site
npx wrangler d1 execute rolepebble-waitlist --local --file schema.sql
npx wrangler pages dev public --d1 DB=rolepebble-waitlist
```

## Deploy (once)

1. **Database.** Cloudflare dashboard → Storage & Databases → D1 → Create, named `rolepebble-waitlist`. Open its Console, paste `schema.sql` and run it.
2. **Site.** Workers & Pages → Create → Pages → Connect to Git → `mrahmadusama/rolepebble`, with:
   - Production branch: `main`
   - Framework preset: None, and no build command
   - Root directory: `site`
   - Build output directory: `public`
3. **Waitlist.** The Pages project → Settings → Bindings → Add → D1 database: variable name `DB`, database `rolepebble-waitlist`. Add it to Production; leave Preview without one, so test pages can't fill the real list. Then redeploy.
4. **Domain.** The Pages project → Custom domains → `rolepebble.com`, and `www.rolepebble.com` redirected to it.

From then on, every merge to `main` that changes the site goes live in a minute or two, and every pull request gets its own preview address to look at first.

## The list

D1 → `rolepebble-waitlist` → Console:

```sql
SELECT email, source, ref, created_at FROM waitlist ORDER BY created_at;
```

How many joined from each place (`ref` is empty for people who came straight to the site):

```sql
SELECT ref, COUNT(*) AS people FROM waitlist GROUP BY ref ORDER BY people DESC;
```

## Links that count

Add `?ref=` and a short tag (lowercase letters, numbers and dashes) to any link to the site, and signups from it are counted under that tag:

| Where | Link |
|---|---|
| Instagram bio | `https://rolepebble.pages.dev/?ref=instagram` |
| Instagram story link sticker | `https://rolepebble.pages.dev/?ref=ig-story` |
| An Instagram ad | `https://rolepebble.pages.dev/?ref=ig-ad` |
| LinkedIn | `https://rolepebble.pages.dev/?ref=linkedin` |

The tag stays for the whole visit, so it counts even if someone scrolls around before joining.

To remove someone who asks (PRIVACY.md promises it):

```sql
DELETE FROM waitlist WHERE email = 'them@example.com';
```
