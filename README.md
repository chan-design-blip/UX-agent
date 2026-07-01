# UX Pilot — working app (Next.js + Postgres)

A real, deployable implementation of the UX Pilot UI/UX validation & governance system.
Submitting a feature **persists to Postgres**, auto-creates a tracked issue assigned to the
team's Product Lead, and fires a notification. The dashboard and Submissions list read live
from the database. Deploys to **Vercel**.

> This is the functional back end + a working baseline UI. For pixel-perfect screens, apply
> the design in `../design_handoff_ux_pilot/` (README + the HTML reference). This app already
> wires the data + flow those screens describe.

## What works today
- **Submit Feature** (`/submit`) → POST `/api/submissions` → row in `Submission`, an auto
  `Issue` assigned to the PL (5-day SLA), and a notification (console + Slack if configured).
- **Governance** (`/`) → team coverage table (Features/Screens/Defects/Open/In Prog./Verified
  + status) read from `Team`, plus the newest submissions.
- **Submissions** (`/submissions`) → every submitted feature from the DB.
- **SLA cron** → `/api/cron/sla-check` (daily via `vercel.json`) escalates overdue issues.

## Run locally
```bash
npm install
cp .env.example .env            # set DATABASE_URL (local Postgres, Neon, or Supabase)
npm run db:push                 # create tables
npm run db:seed                 # seed the 9 teams + product leads
npm run dev                     # http://localhost:3000
```

## Deploy to Vercel
1. Push this folder to a GitHub repo.
2. **Import Project** in Vercel (it auto-detects Next.js — no index.html needed).
3. Add a **Vercel Postgres** store (Storage tab) → it injects `DATABASE_URL`.
4. Add optional env vars: `SLACK_WEBHOOK_URL`, `RESEND_API_KEY`.
5. First deploy: run `npm run db:push` and `npm run db:seed` against the prod `DATABASE_URL`
   (locally with the prod URL, or via a one-off script). Then every push auto-deploys and the
   cron runs daily at 08:00 UTC.

## Included in this build
- **Auth / OrangeHRM SSO** — NextAuth is wired (`src/lib/auth.ts`, `/login`, `middleware.ts`).
  Set `OIDC_ISSUER`/`OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET` for real SSO; otherwise a dev fallback
  accepts any `@orangehrm.com` email. Set `NEXTAUTH_SECRET`. Routes `/`, `/submit`, `/submissions`
  are gated by middleware.
- **AI validation** — `src/lib/validation.ts` calls Claude (`ANTHROPIC_API_KEY`) to diff the Figma
  source vs. the implementation and return structured findings; submit turns each finding into a
  tracked `Issue` and sets the submission's compliance score + gate. Without a key it uses a
  deterministic mock so the flow still works. Re-run anytime via `POST /api/validation`.

## Remaining TODOs
- **Email** — replace the `sendEmail` stub in `src/lib/notify.ts` with Resend or Amazon SES.
- **Issue status workflow** — add `PATCH /api/issues/[id]` to move Open→In Progress→Fixed→
  Verified and a board view (the model + fields are already here).

## Structure
```
prisma/schema.prisma      Team, ProductLead, Submission, Issue, Comment
prisma/seed.ts            9 teams + PLs
src/lib/db.ts             Prisma singleton
src/lib/notify.ts         email + Slack (stubs)
src/app/layout.tsx        sidebar + topbar shell
src/app/page.tsx          Governance dashboard (DB-backed)
src/app/submit/page.tsx   Submit form (client) → API
src/app/submissions/…     Submissions table (DB-backed)
src/app/api/…             teams, submissions (GET/POST), cron/sla-check
vercel.json               daily SLA cron
```
