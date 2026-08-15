# Atlas

A calm second brain for tasks, notes, and time. One question, answered well:
**what should I do right now?**

No backend to run, no AI, no subscription. It's a static site: React in the
browser, Supabase for storage and sync, GitHub Pages for hosting.

---

## Run it right now

```bash
npm install && npm run dev
```

Open http://localhost:5173. That's it — no accounts, no keys.

With no Supabase credentials, Atlas runs in **local mode**: everything lives in
that browser's localStorage, and it's seeded with a few example tasks, notes and
habits so the screens aren't empty. Every feature works except syncing across
devices and sharing with a friend. Delete the examples whenever you like.

When you're ready for those two things, follow the setup below. Nothing you do
now is wasted — but note that local data does **not** migrate to the cloud
automatically. Export it first from **Settings → Data → Export** if you want to
keep it.

---

## Setting up Supabase

You need this for two things: using Atlas on your phone *and* laptop with the
same data, and sharing a workspace with a friend. It's free and takes about ten
minutes. You'll never write server code.

### 1. Create the project

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub login is
   fastest).
2. Click **New project**.
3. Name it `atlas`. Pick a region near you — this is the single biggest factor
   in how fast the app feels.
4. Set a database password. You won't need it for Atlas, but save it somewhere;
   there's no recovery.
5. Click **Create new project** and wait a minute or two while it provisions.

### 2. Create the tables

1. In the left sidebar, click **SQL Editor**, then **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repository, copy
   **all** of it, and paste it into the editor.
3. Click **Run**.

You should see `Success. No rows returned`. That one script creates every table,
turns on row level security, writes the access rules, and enables realtime.
Running it twice is harmless, so if you're unsure, run it again.

### 3. Copy your keys

1. Go to **Project Settings** (the gear icon) → **API Keys**.
2. Copy the **Publishable key** (`sb_publishable_...`). This is the
   browser-safe one. Ignore the **Secret keys** section entirely.
3. Go to **Project Settings → General** and copy the **Project URL**.
4. In this repository:

```bash
cp .env.example .env.local
```

5. Open `.env.local` and paste them in:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

6. Check it worked, then restart the dev server:

```bash
npm run check:supabase && npm run dev
```

`check:supabase` verifies the key is accepted, confirms all 14 tables exist,
and proves row level security is working by trying to read your tables while
signed out. If something's wrong it names the step to redo.

> **Older projects** show a *Legacy anon, service_role API keys* tab instead.
> The `anon` `public` key there (a long `eyJ...` token) works exactly the same.

Atlas will now show a sign-in screen instead of loading straight in. Create an
account and it'll set up your workspace with the same starter content.

> **Is it safe to publish that key?** Yes — publishable and anon keys are
> designed to be public, and only identify your project. What actually protects
> your data is row level security, which `schema.sql` turns on for every single
> table. Every policy derives your identity from the verified auth token, so
> nobody can read another person's workspace by editing the key or the request.
> Never publish an `sb_secret_...` or `service_role` key, though — those bypass
> all of it.

### 4. Skip email confirmation (optional, but do it while testing)

By default Supabase emails you a confirmation link before you can sign in, and
its built-in mail service is heavily rate-limited.

**Authentication → Providers → Email →** turn **Confirm email** off. You can
turn it back on later once you've wired up a real mail provider.

### 5. Invite your friend

1. They sign up in your deployed Atlas first (there's no server here to send an
   invitation email from, so the account has to exist).
2. You go to **Settings → Workspace**, type their email, and click **Invite**.
   Only the workspace owner can do this.

Inviting is **mutual**: they join your workspace and you join theirs, in one
step. Both of you keep your own workspace and switch between the two using the
switcher at the top of the sidebar. It only appears once you can reach more
than one, and your choice is remembered per device, so your laptop and your
phone can sit in different workspaces.

Removing someone undoes both directions at once — otherwise "removed" people
would keep read access to your side.

> Worth knowing: there is no accept step. The moment you invite someone, each
> of you can read and write the other's workspace. That's the intent for two
> people who trust each other; it is not a model for strangers. Per-item
> `private` flags still apply in both directions.

**What the other person can see**

| | Shared | Personal |
| --- | --- | --- |
| Projects, tasks, notes, calendar events, labels, comments | ✅ both of you | |
| Anything flagged **private** | | 🔒 creator only |
| Habit definitions | ✅ same list | |
| Habit logs and streaks | | 🔒 yours alone |
| Notifications, settings, theme | | 🔒 yours alone |

So they see the Dashboard, Inbox, Board, Calendar, Projects and Notes filled
with the shared workspace's content, updating live. The private flag and the
habit split are enforced by row level security in the database, not by the
interface — a modified client cannot read past them.

---

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. If you're using Supabase, add two repository secrets under **Settings →
   Secrets and variables → Actions**: `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
4. Push to `main`. [`deploy.yml`](.github/workflows/deploy.yml) builds and
   publishes it.

Your site lands at `https://<you>.github.io/<repo>/`. The workflow sets the base
path from the repository name automatically. If you're deploying to a *user*
site (`<you>.github.io`), delete the `VITE_BASE` line from the workflow.

One more step for cloud mode: in Supabase, go to **Authentication → URL
Configuration** and add your Pages URL to **Redirect URLs**, otherwise magic
links and password resets will bounce back to localhost.

Atlas uses hash routing (`/#/board`), which is what makes deep links survive a
refresh on Pages without a custom 404 shim.

### Install it as an app

Atlas is a PWA. On iOS use Share → *Add to Home Screen*; on Android and desktop
Chrome there's an install button in the address bar. It opens full-screen and
loads offline — though in cloud mode you'll need a connection to see changes
made elsewhere.

---

## Using it

The whole app is reachable from the keyboard.

| Key | Does |
| --- | --- |
| `C` | Capture to Inbox |
| `⌘K` / `/` | Search everything |
| `G` then `D` `I` `B` `C` `P` `N` `H` | Jump to Today, Inbox, Board, Calendar, Projects, Notes, Habits |
| `?` | Shortcut list |
| `Esc` | Close whatever's open |

The capture box understands three shorthand tokens:

```
Submit the form !1 #college @deep-work
```

`!1`–`!4` sets priority, `#name` files it under a project, `@name` adds a label
(creating it if it's new). Everything else stays in the title verbatim — Atlas
won't quietly reinterpret your words as dates.

**The intended loop:** capture into Inbox without thinking. Sort later — drag on
the Board, or drop tasks onto the Calendar to block real time for them. A task
dragged onto the calendar keeps a two-way link: move the block and the task
follows.

---

## How it's built

```
src/
  components/   UI primitives (shadcn-style on Radix), layout, task widgets
  hooks/        shortcuts, realtime, notifications, media queries
  lib/          supabase client, date and utility helpers
  pages/        one file per route
  services/     the backend seam — see below
  store/        Zustand state and pure selectors
  types/        domain types, mirroring the SQL columns exactly
supabase/
  schema.sql    tables, RLS policies, realtime — the whole database
```

The one design decision worth knowing about is
[`services/backend.ts`](src/services/backend.ts). It defines a single interface
with two implementations: `LocalBackend` (localStorage) and `SupabaseBackend`
(Postgres). Nothing above that line knows which one it's talking to. That's why
the app is fully usable before you've created a Supabase project, and why
switching it on later changed no feature code.

Every mutation is optimistic — state updates immediately, the write follows, and
a failure rolls the change back and tells you. On a phone with bad signal that's
the difference between an app that feels instant and one that feels broken.

### Things that are honestly limited

- **Reminders only fire while a tab is open.** There's no server to wake up and
  push to you. Settings says so plainly rather than implying otherwise.
- **Invites need an existing account.** Same reason: nothing here can send an
  email.
- **Local mode is per-browser.** It isn't a sync fallback; it's a real, separate
  place your data can live.

### Commands

```bash
npm run dev             # dev server
npm run build           # typecheck + production build
npm run lint            # typecheck only
npm run preview         # serve the build locally
npm run test:workspace  # regression test for workspace selection
npm run check:supabase  # verify a Supabase project is wired up correctly
```
