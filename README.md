# Renesance

A personal task and project manager with a unified calendar, a Gantt view
for projects, and a time-allocation view across five life segments
(Family, Career Search, AI Learning, Passive Income, Others).

This is a real, deployable version of the prototype: React + Supabase
(storage and cross-device sync) + Vercel (hosting), installable as a PWA
on a phone. See `context.pdf` and `instructions.pdf` for the full
background and spec this was built from.

## 1. Prerequisites

- [Node.js](https://nodejs.org) 18 or newer
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account (for deployment)

## 2. Set up Supabase

1. Create a new Supabase project.
2. Open **SQL Editor** in the Supabase dashboard, paste in the contents of
   `supabase/schema.sql`, and run it. This creates the `tasks`, `projects`,
   and `project_tasks` tables, enables Row Level Security with permissive
   policies (fine for a private single-user app — see the comments in the
   file if you ever add real logins), and turns on realtime sync.
3. Go to **Project Settings -> API** and copy the **Project URL** and the
   **anon public key**.

## 3. Configure the app

```bash
cp .env.example .env.local
```

Paste your Supabase URL and anon key into `.env.local`.

## 4. Run it locally

```bash
npm install
npm run dev
```

This starts the app on your laptop. Because `dev` runs with `--host`, you
can also open it from your phone while both devices are on the same
Wi-Fi network — the terminal will print a `Network:` URL to use.

## 5. Deploy so it's reachable from anywhere

1. Push this project to a GitHub repository.
2. In Vercel, "Add New Project" and import that repository. Vercel
   auto-detects Vite; no extra config is needed.
3. In the Vercel project's **Settings -> Environment Variables**, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values
   as your `.env.local`.
4. Deploy. Vercel gives you a permanent `https://...vercel.app` URL.

## 6. Install it on your phone

1. Open the deployed URL in your phone's browser.
2. **iPhone (Safari):** tap the Share icon -> "Add to Home Screen."
   **Android (Chrome):** tap "Install app" if prompted, or open the ⋮ menu
   -> "Install app."
3. You'll now have a Renesance icon on your home screen that opens
   full-screen, like a native app.

Because both your laptop and phone talk to the same Supabase database,
adding a task on one shows up on the other within moments — no manual
sync step.

## Project structure

```
src/
  lib/           constants, date helpers, Supabase client, data-access layer
  components/    OverviewView, CalendarView, GanttView, PieView,
                 AddTaskForm, AddProjectForm, Modal
  App.jsx        wires it all together + realtime subscription
supabase/
  schema.sql     tables + RLS policies + realtime setup
public/icons/    PWA icons
```

## Views

- **Overview** (the landing page / default view): a filterable list of every
  task and project, with filters for segment, priority, and time frame
  (all / overdue / today / this week / this month / custom range). Clicking
  any row opens it for editing.
- **Calendar**: day/week/month, standalone tasks and project tasks combined.
- **Gantt**: one chart per project, filterable by segment, with dependency
  notes below each chart.
- **Time Allocation**: a donut chart of hours by segment for a chosen period.

## Editing

- Clicking a standalone task on the Overview page opens an edit modal for
  just that task (title, due date, priority, hours, segment), with a Delete
  option.
- Clicking a project (or one of its steps) opens an edit modal for the whole
  project. Because steps form a dependent sequence, editing works on the
  project as a unit: you can rename it, change its segment, edit any step's
  fields, add new steps, or remove steps, then save — the underlying
  sequence is rebuilt to match. There's also a Delete Project option, which
  removes all of its steps too.

## Known limitations / good next steps

- **Dependencies are a linear chain.** Each project step depends only on
  the one directly before it (matches the current UI). If you later want
  a step to depend on more than one predecessor, replace the single
  `depends_on` column with a join table, e.g.
  `project_task_dependencies(task_id, depends_on_task_id)`.
- **No authentication.** This is intentional for a private single-user
  tool using the Supabase anon key. If you ever share this with someone
  else, add Supabase Auth and scope the RLS policies to `auth.uid()`
  instead of the current "allow all" policies.
- **No offline mode.** The app assumes a network connection, which fits
  normal daily use. Add a data-caching strategy in `vite-plugin-pwa` later
  if you want it to work with no signal.
- **No notifications/reminders yet** for upcoming or overdue tasks — a
  natural next feature once the core app is in daily use.
