# RolePebble privacy policy

**Draft, not yet in effect.** RolePebble isn't open to the public yet. This policy describes what the software does today, and will be reviewed by a lawyer and dated before anyone outside the project signs up. Until then, the only data in RolePebble is its operator's own.

RolePebble is run by Ahmad Usama, Pakistan ("we"). RolePebble is built on [Dossier](https://dossier.aien.me) by AienTech, but the Dossier project doesn't run RolePebble and receives none of your data. For anything on this page, write to **support@rolepebble.com**.

In short: what you enter is kept in RolePebble's database on our server. What leaves it goes to the AI provider that writes your documents, the job source you search, Google if you connect Gmail and Calendar, Hacker News and startups' own sites if you use Startups, and Anthropic through Claude if you turn on the Claude connector. Nothing is sold, and nothing is used for advertising.

## Who is responsible

- **Controller:** Ahmad Usama, Pakistan, support@rolepebble.com.
- **Hosting:** RolePebble's server runs at Amazon Web Services, in its Sydney region (ap-southeast-2). If that changes, this page says so first.
- **Why we use your data:** to provide RolePebble to you, which is what you sign up for (Art. 6(1)(b) GDPR): keeping your profile, writing and keeping your applications, searching for jobs when you ask. Optional parts (Google, the Claude connector) only run once you turn them on.

## What RolePebble keeps

| What | Kept until |
|---|---|
| Your profile: basics with contact details and your photo, skills, languages, roles, projects, education, publications, references with their email and phone, and your facts about you | You change or delete it |
| Each application: the posting, what was read from it, the match, the facts you gave for it, its status history, its resume, cover letter and email with their earlier versions, the refine chat and your private notes | You delete the application |
| Postings you saved or dismissed in Find jobs, and your past searches with what they found | You remove them |
| The job agent's finds and drafts, and the scores of postings you or the agent scored | Dismissing a posting trims it and deletes its draft; Delete everything removes them all |
| Startups a refresh found, with the addresses they publish for applications. People's own addresses only when you ask, for 14 days unless you start an application to that startup | 45 days without being found again, unless you saved or contacted the startup; **Remove for good** deletes one at once |
| Task data: what each AI task was given and wrote | The task's application is deleted, or it's older than **Keep task data for** (Settings → Your data; 24 hours by default) |
| Mail from Gmail about your applications, once you connect Google (never attachments), and the connected account with Google's refresh token, encrypted | You delete the application, or **Disconnect** in Settings → Google |
| Settings, and API keys you enter, encrypted | You change them |
| Nightly backups: full copies of your data | 14 days |
| Failed sign-ins: the IP address and how many failed | A successful sign-in, or a day |

We log errors without the data involved. We don't use analytics or tracking cookies; the only cookies are the ones that keep you signed in and remember your screen settings.

## Who receives your data

| Who | When | What |
|---|---|---|
| The AI provider RolePebble uses (named in Settings → AI provider) | Each AI task: reading a posting, matching, writing or refining a document, importing a resume, scoring a posting, reading a reply from Gmail | See [below](#what-the-ai-provider-receives) |
| The job source (JSearch or Adzuna) | Each search in Find jobs, and the job agent's daily search while it's on | Only what you search for: keywords, place, country, radius and filters. Nothing from your profile |
| Google | Only while you've connected a Google account | Sending the emails you send and their PDFs, checking for new mail, reading your free times and adding the interviews you agree to your calendar |
| Hacker News, and startups' own sites | When you use Startups | Requests for public job posts and a few public pages of a startup's site. Nothing about you. See [Startups](#startups) |
| Anthropic, through Claude | Only while you've turned on the Claude connector | What Claude asks RolePebble for: your profile without contact details, postings and your applications. See [Claude connector](#claude-connector) |
| The site a posting is on | When you press **Fetch** on a new application | A request for the posting's page |

Nobody else receives your data. RolePebble doesn't send usage statistics anywhere, and your browser loads nothing from other sites.

### What the AI provider receives

Your profile **without contact details or references**: your name, headline, city and country, summary, skills, languages, roles, projects, education, the publications you show on resumes, and your facts. Also the posting, the job's details and the match, and what you ask for in the chat. Importing a resume sends the whole file's text, which the import page says first. Reading a reply from Gmail sends that mail.

Never sent in a prompt: your email, phone, address, date of birth and links, your references, and your private notes. A posting, an employer's mail or your own chat messages may still mention other people.

Before RolePebble opens to the public, this section will name the provider, link to its terms, and say how long it keeps what it receives and whether it trains on it.

### Startups

Startups lists startups that are hiring, from Hacker News' official API, ranked against your profile on our server without AI. It shows the address each startup publishes for applications; you decide whom to write to.

**If you run a website** and see requests from `RolePebble/<version>`: they come from RolePebble, looking for the address you publish for job applications. It reads your robots.txt first and follows it, under the product token `RolePebble`, then at most your home, `/careers`, `/jobs` and `/contact` pages, and `/about` and `/team` only when a user asks for people's addresses. It stops when your site answers 403 or 429, and keeps only email addresses on your own domain. To keep it out:

```
User-agent: RolePebble
Disallow: /
```

To have an address removed, write to support@rolepebble.com.

### Claude connector

The Claude connector lets you use RolePebble from Claude. It's off until you turn it on in Settings → Claude connector. What Claude reads through it goes to Anthropic under your own Claude account and its terms. Claude can save drafts and scores in RolePebble, and change an application's status; it can't delete, archive or send anything.

## The waitlist

The website, rolepebble.com, is hosted by Cloudflare. It sets no cookies and loads nothing from other sites; Cloudflare handles each visit, including your IP address, to deliver the page.

If you join the waitlist, we keep your email address, which of the page's forms you used, where you came from if the link you followed said so (for example "instagram"), and when you joined, in a Cloudflare D1 database. We use it only to invite you to the beta and to tell you when RolePebble opens, because you asked us to (Art. 6(1)(a) GDPR). We don't share it with anyone else. It's deleted when you ask, by writing to support@rolepebble.com or replying to any of our emails, and at the latest a year after RolePebble opens to the public.

## Your rights

You can, at any time:

- **Get a copy** of your data: **Export** in Settings → Your data.
- **Correct it:** edit it in RolePebble.
- **Delete it:** delete an application, or **Delete everything** in Settings → Your data. Backups taken before keep it for up to 14 days.
- **Ask us** for access, correction, erasure or a copy, or object to a use, by writing to support@rolepebble.com. We answer within a month.
- **Complain** to a data protection authority, for example the one where you live.

RolePebble makes no decisions about you automatically, beyond the match scores you see, which only order postings for you.

## Transfers outside your country

We are in Pakistan and the server is in Australia, so your data is processed outside your country, and outside the EU if you live there. Before RolePebble opens to the public, this section will say which safeguards cover those transfers, including for the AI provider.

## Changes

When this policy changes, the date at the top changes, and we tell signed-up users before a change takes effect.
