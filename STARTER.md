# UX Pilot — Next.js + Vercel Starter

Paste these into a fresh repo to kick off implementation. Stack: **Next.js (App Router) +
TypeScript + Tailwind + Prisma + Vercel Postgres + Auth.js + Resend**.

---

## 0. Create the project
```bash
npx create-next-app@latest ux-pilot --ts --tailwind --app --eslint --src-dir --import-alias "@/*"
cd ux-pilot
npm i prisma @prisma/client next-auth @auth/prisma-adapter resend zod
npm i -D tsx
npx prisma init
```

---

## 1. File tree
```
ux-pilot/
├─ vercel.json
├─ prisma/
│  └─ schema.prisma
├─ src/
│  ├─ lib/
│  │  ├─ db.ts                 # Prisma client singleton
│  │  ├─ auth.ts               # Auth.js config (OIDC/SAML → OrangeHRM SSO)
│  │  ├─ email.ts              # Resend transactional email
│  │  ├─ slack.ts              # Slack/Teams webhook
│  │  └─ validation.ts         # Claude AI: Figma vs implementation
│  ├─ components/
│  │  ├─ Sidebar.tsx
│  │  ├─ Topbar.tsx
│  │  ├─ StatusChip.tsx
│  │  ├─ CoverageTable.tsx
│  │  ├─ RecentSubmissions.tsx
│  │  ├─ IssueBoard.tsx
│  │  └─ ValidationReport.tsx
│  ├─ app/
│  │  ├─ layout.tsx            # shell: <Sidebar/> + <Topbar/> + children
│  │  ├─ globals.css           # Tailwind + tokens (section 5)
│  │  ├─ login/page.tsx
│  │  ├─ page.tsx              # Governance dashboard (default)
│  │  ├─ submit/page.tsx
│  │  ├─ submissions/page.tsx
│  │  ├─ board/page.tsx
│  │  ├─ issues/[id]/page.tsx
│  │  ├─ validation/[submissionId]/page.tsx
│  │  └─ api/
│  │     ├─ auth/[...nextauth]/route.ts
│  │     ├─ submissions/route.ts          # POST create → validate → issues → notify
│  │     ├─ issues/route.ts               # GET list
│  │     ├─ issues/[id]/route.ts          # GET / PATCH (status, assignee)
│  │     ├─ issues/[id]/comments/route.ts # POST comment
│  │     ├─ validation/route.ts           # POST run AI validation
│  │     └─ cron/sla-check/route.ts       # GET (Vercel Cron) → escalate overdue
└─ .env                        # DB, SSO, RESEND_API_KEY, SLACK_WEBHOOK_URL, ANTHROPIC_API_KEY
```

---

## 2. vercel.json  (daily SLA reminder cron)
```json
{
  "crons": [
    { "path": "/api/cron/sla-check", "schedule": "0 8 * * *" }
  ]
}
```

---

## 3. prisma/schema.prisma
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Status  { open in_progress fixed verified }
enum Gate    { validating pending in_progress passed blocked }
enum Health  { on_track at_risk blocked }
enum Severity{ low medium high }

model Team {
  id          String       @id @default(cuid())
  name        String       @unique
  health      Health       @default(on_track)
  productLeads ProductLead[]
  submissions Submission[]
  issues      Issue[]
}

model ProductLead {
  id     String  @id @default(cuid())
  name   String
  email  String  @unique
  team   Team    @relation(fields: [teamId], references: [id])
  teamId String
  submissions Submission[]
  issues Issue[]
}

model Submission {
  id            String   @id @default(cuid())
  title         String
  team          Team     @relation(fields: [teamId], references: [id])
  teamId        String
  pl            ProductLead @relation(fields: [plId], references: [id])
  plId          String
  module        String?
  priority      String   @default("medium")
  figmaUrl      String
  implSource    String
  stagingUrl    String?
  notes         String?
  gate          Gate     @default(validating)
  compliance    Int      @default(0)
  submittedBy   String
  createdAt     DateTime @default(now())
  runs          ValidationRun[]
  issues        Issue[]
}

model ValidationRun {
  id           String   @id @default(cuid())
  submission   Submission @relation(fields: [submissionId], references: [id])
  submissionId String
  score        Int
  passed       Int
  warnings     Int
  violations   Int
  createdAt    DateTime @default(now())
  findings     Finding[]
}

model Finding {
  id         String   @id @default(cuid())
  run        ValidationRun @relation(fields: [runId], references: [id])
  runId      String
  category   String   // spacing | typography | component | alignment | color
  severity   Severity
  title      String
  description String
  found      String?
  expected   String?
}

model Issue {
  id           String   @id @default(cuid())
  submission   Submission? @relation(fields: [submissionId], references: [id])
  submissionId String?
  title        String
  category     String
  severity     Severity
  component    String?
  screen       String?
  team         Team     @relation(fields: [teamId], references: [id])
  teamId       String
  pl           ProductLead @relation(fields: [plId], references: [id])
  plId         String
  assigneeId   String?
  status       Status   @default(open)
  reportedBy   String   @default("AI Validation")
  figmaRef     String?
  prRef        String?
  createdAt    DateTime @default(now())
  dueAt        DateTime?
  comments     Comment[]
  events       ActivityEvent[]
}

model Comment {
  id        String   @id @default(cuid())
  issue     Issue    @relation(fields: [issueId], references: [id])
  issueId   String
  authorId  String
  body      String
  createdAt DateTime @default(now())
}

model ActivityEvent {
  id        String   @id @default(cuid())
  issue     Issue    @relation(fields: [issueId], references: [id])
  issueId   String
  actorId   String
  type      String   // created | assigned | status_changed | commented
  meta      Json?
  createdAt DateTime @default(now())
}
```
Then: `npx prisma db push` (against Vercel Postgres) and `npx prisma generate`.

---

## 4. Key snippets

### src/lib/db.ts
```ts
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
```

### src/app/api/submissions/route.ts  (submit → validate → issues → notify)
```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runValidation } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { postSlack } from "@/lib/slack";

export async function POST(req: Request) {
  const body = await req.json(); // validate with zod in real code
  const sub = await db.submission.create({ data: {
    title: body.title, teamId: body.teamId, plId: body.plId,
    figmaUrl: body.figmaUrl, implSource: body.implSource,
    stagingUrl: body.stagingUrl, notes: body.notes,
    priority: body.priority, submittedBy: body.submittedBy,
  }});

  if (body.runValidation) {
    const result = await runValidation(sub);          // Claude call
    await db.validationRun.create({ data: { submissionId: sub.id, ...result.summary,
      findings: { create: result.findings } }});
    // turn violations into issues, auto-assigned to PL
    for (const f of result.findings.filter(f => f.severity !== "low")) {
      await db.issue.create({ data: {
        submissionId: sub.id, title: f.title, category: f.category,
        severity: f.severity, teamId: sub.teamId, plId: sub.plId,
        assigneeId: sub.plId, figmaRef: sub.figmaUrl,
        dueAt: new Date(Date.now() + 5*864e5), // 5-day SLA
      }});
    }
  }

  const pl = await db.productLead.findUnique({ where: { id: sub.plId }});
  await sendEmail(pl!.email, `New feature submitted for UI/UX testing: ${sub.title}`,
    `${sub.title} was submitted and assigned to you. Open UX Pilot to review.`);
  await postSlack(`:mag: *${sub.title}* submitted for UI/UX testing — assigned to ${pl!.name}`);

  return NextResponse.json({ id: sub.id });
}
```

### src/app/api/cron/sla-check/route.ts  (Vercel Cron → escalate overdue)
```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export async function GET() {
  const overdue = await db.issue.findMany({
    where: { status: { not: "verified" }, dueAt: { lt: new Date() } },
    include: { pl: true },
  });
  for (const i of overdue) {
    await sendEmail(i.pl.email, `Overdue UX issue: ${i.title}`,
      `Issue ${i.id} is past its SLA and still ${i.status}. Please action or escalate.`);
  }
  return NextResponse.json({ escalated: overdue.length });
}
```

### src/lib/validation.ts  (Claude — sketch)
```ts
import Anthropic from "@anthropic-ai/sdk"; // npm i @anthropic-ai/sdk
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runValidation(sub: { figmaUrl: string; implSource: string }) {
  // Fetch the Figma frame image + implementation screenshot, send both to Claude,
  // ask for JSON findings against your design-system rules. Parse & return:
  return {
    summary: { score: 82, passed: 42, warnings: 5, violations: 3 },
    findings: [
      { category: "spacing", severity: "high", title: "Card padding mismatch",
        description: "Renders 16px; design specifies 24px.", found: "16px", expected: "24px" },
    ],
  };
}
```

### .env (local + Vercel project env vars)
```
DATABASE_URL=postgres://...           # Vercel Postgres
NEXTAUTH_SECRET=...
OIDC_ISSUER=...  OIDC_CLIENT_ID=...  OIDC_CLIENT_SECRET=...   # OrangeHRM SSO
RESEND_API_KEY=...
SLACK_WEBHOOK_URL=...
ANTHROPIC_API_KEY=...
```

---

## 5. Tokens → Tailwind
Add to `tailwind.config.ts` `theme.extend.colors` (rest of tokens are in README.md):
```ts
colors: {
  brand:  { DEFAULT: "#ea580c", dark: "#c2410c", light: "#fb923c", tint: "#fff1e6" },
  ink:    { 1: "#0f172a", 2: "#475569", 3: "#94a3b8" },
  line:   { DEFAULT: "#e2e8f0", soft: "#f1f5f9" },
  ok: "#059669", warn: "#d97706", danger: "#dc2626", info: "#2563eb",
}
```
Set Inter as the base font in `globals.css` (`@import` Google Fonts or `next/font`).

---

## 6. Deploy
1. Push repo to GitHub → **Import Project** in Vercel.
2. Add a **Vercel Postgres** store (Storage tab); it injects `DATABASE_URL`.
3. Add the other env vars (SSO, Resend, Slack, Anthropic).
4. `npx prisma db push` once (locally against the prod DB, or a build step).
5. Every push auto-deploys; the cron runs daily at 08:00 UTC.

> Faster tracking option: skip building the issue workflow and back issues onto **Jira**
> (custom fields + Automation for assignment/email/SLA); keep this app as portal +
> dashboards reading the Jira REST API.
