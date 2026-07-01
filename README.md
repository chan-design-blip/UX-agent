# Handoff: UX Pilot — UI/UX Validation & Governance System

## Overview
**UX Pilot** is OrangeHRM's internal system to standardize, automate and enforce UI/UX
testing across all product teams. It replaces the current "log issues in a Google Doc"
process with a structured, trackable workflow and a mandatory validation gate that a
feature must pass before release.

Core capabilities the app must deliver:
1. **Submission portal** — any team submits a feature/screen for UI/UX testing (with the
   Figma design link + implementation source as required fields).
2. **AI validation** — compares the implemented UI against the finalized Figma design and
   auto-generates structured issues (spacing, typography, component usage, alignment).
3. **Issue tracking** — structured records (not free text) with a fixed workflow:
   **Open → In Progress → Fixed → Verified/Closed**, assignment to a Product Lead (PL),
   comments, activity log, SLA/due dates.
4. **Notifications & automation** — notify PL on submit, remind/escalate on SLA breach.
5. **Governance dashboards** — cross-team coverage table + recently-submitted feed +
   release-gate queue, giving leadership visibility of UX quality per team.

## About the Design Files
The file in this bundle (`Sentinel — Modern Dashboard.dc.html`) is a **design reference
created in HTML** — a high-fidelity, clickable prototype showing the intended look and
behavior. **It is not production code to copy.** There is no backend, database, auth,
email, or persistence; nav/screen switching and the login gate are simulated with local
component state.

The task is to **recreate these designs in a real application** using the stack below,
following that codebase's established patterns — not to ship the HTML directly.

## Fidelity
**High-fidelity (hifi).** Final colors, typography (Inter), spacing, radii, and component
styling are intentional and should be reproduced closely. All imagery (design-vs-impl
comparison panels) uses striped placeholders — swap in real Figma exports / screenshots.

## Recommended Architecture (for a working app on Vercel)
- **Framework:** Next.js (App Router) + React + TypeScript — deploys natively to Vercel.
- **Styling:** Tailwind CSS (map the design tokens below to `tailwind.config`) or CSS
  variables; the prototype uses plain inline styles you can translate 1:1.
- **Database:** Postgres — **Vercel Postgres** (or Neon/Supabase). Use Prisma or Drizzle.
- **Auth:** NextAuth/Auth.js with a SAML/OIDC provider wired to OrangeHRM SSO.
- **Email:** Resend or Amazon SES (transactional), triggered from API routes.
- **Notifications:** Slack/Teams incoming webhook posted from the submit handler.
- **Scheduled reminders/SLA escalations:** **Vercel Cron** hitting an API route daily.
- **AI validation:** a server route that calls the Claude API with the Figma frame +
  implementation screenshot/DOM and returns structured findings.
- **File uploads (screenshots):** Vercel Blob or S3.

> Fastest alternative for the tracking layer: back the issues onto **Jira** (custom fields
> + Automation rules for assignment/email/SLA) and use this app purely as the portal +
> dashboards, reading/writing via the Jira REST API.

## Screens / Views
The app is a left-sidebar shell (fixed 250px) + top bar + main content. A login gate
precedes the app. Screens are switched via the sidebar; on real build these become routes.

### 0. Sign In (`/login`)
- **Purpose:** SSO gate before entering the app; access limited to PLs & reviewers.
- **Layout:** Two columns. Left = brand panel (indigo→ gradient in prototype, but the app
  theme is **orange**; use the orange gradient `#4338ca→#6366f1` was replaced by orange —
  use `#c2410c → #ea580c → #fb923c`), UX Pilot logo, headline "The mandatory UI/UX gate
  for every release." + 3 value bullets, footer note. Right = 480px form column.
- **Form:** "Continue with OrangeHRM SSO" primary button (→ real SSO), OR divider,
  Work email + Password fields, Remember me + Forgot password, "Sign in with email"
  secondary button, "Request access" link. Both buttons currently just enter the app.

### 1. Governance Dashboard (`/` — default after login)
- **Purpose:** Leadership/PL overview of UX testing coverage & progress across all teams.
- **Layout:** Vertical stack, 24–30px padding.
  - **Mandatory-gate banner** (info, dismissible in real app).
  - **Team UX Testing Coverage** — section header ("Team UX Testing Coverage" + a green
    pulsing "Live" pill) above a single **table card**. Columns:
    `Team | Features | Screens | Defects | Open | In Prog. | Verified | Status`.
    Grid columns `1.9fr .8fr .8fr .8fr .8fr 1fr .9fr 1fr`, header row `#f8fafc`, rows
    separated by `1px #f1f5f9`. Team cell = 8px status dot + name. Numeric cells centered,
    weight 700; Open in slate `#64748b`, In Prog. blue `#2563eb`, Verified green `#059669`,
    Features/Screens/Defects in `#0f172a`. Status = pill chip (On track green / At risk
    amber / Blocked red). Blocked row gets a faint `#fef6f6` background tint.
  - **Two-column grid** (`1.7fr 1fr`):
    - Left: **Recently Submitted for Testing** card — header + "View all" link, then a list
      of rows (34px orange icon tile + feature name + `team · time · submitter` + status
      chip + chevron). **Each row navigates to the AI Validation report.**
    - Right: **Release Gate Queue** (dot + feature + team/context + status chip) and
      **Open Issues by Category** (labeled progress bars).
- **Data (seed):** 9 teams — Performance Pro (14/22/31, 7·9·15, On track), Performance
  Core (11/18/24, 5·6·13, On track), Roster (9/15/19, 8·4·7, At risk), Compensation
  Management (12/20/27, 6·8·13, At risk), CS Features (16/26/34, 11·7·16, At risk),
  Mobile (13/24/38, 14·9·15, Blocked), CAMI (7/11/13, 3·3·7, On track), AI Team
  (10/9/12, 2·4·6, On track), Marketing UI (8/14/17, 5·4·8, On track).
  Format = Features/Screens/Defects, Open·InProgress·Verified.

### 2. AI Validation Report (`/validation/:submissionId`) — the hero screen
- **Purpose:** Show design-vs-implementation compliance and turn findings into issues.
- **Layout:**
  - **Summary card:** conic-gradient **score ring** (e.g. 82%), submission title + team
    chip + build ref, counts "42 checks passed · 5 warnings · 3 violations", actions
    "Re-run validation" (primary), "Figma", "PR #482".
  - **Comparison card:** segmented control (Side by side / Overlay / Diff) + two panels
    "Figma — source of truth" and "Implementation — staging" (placeholder images; impl
    panel has dashed red/amber highlight boxes over diffs).
  - **Findings:** grouped cards by category (Spacing & layout / Component usage /
    Typography & color). Each finding row = severity chip (Violation red / Warning amber),
    title, description, `found:` vs `expected:` in monospace, and a **"Create issue"**
    button (→ Issue Detail).
- **Behavior:** "Create issue" and finding actions navigate to the issue detail; Re-run
  triggers the validation service.

### 3. Issue Board (`/board`)
- **Purpose:** Kanban of all UI/UX issues.
- **Layout:** Toolbar (segmented All teams/My assignments/Overdue, Sprint filter, Export,
  New issue) + 4 horizontally-scrolling columns: **Open (dot slate) · In Progress (blue) ·
  Fixed—awaiting verify (amber) · Verified·Closed (green)**, each with a count pill.
  Cards: category chip + severity, title, team chip + component, footer avatar + due/id.
  Verified cards are dimmed with strikethrough titles. **Cards navigate to Issue Detail.**

### 4. Issue Detail (`/issues/:id`)
- **Purpose:** The structured issue record (replaces the Google-Doc entry).
- **Layout:** Breadcrumb, then `1.9fr 1fr` grid.
  - Left: header (severity + category chips + id), title, **status stepper**
    (Open ✓ → In Progress ● → Fixed → Verified), action buttons (Mark as Fixed / Reassign
    / Open in Jira); **Details** card = 2-col field grid (Component, Screen, Team, Product
    Lead, Reported by [AI Validation], Assignee, Created, Due(SLA, red), References =
    Figma/GitHub/staging chips); **Description** + Expected vs Actual placeholder panels.
  - Right: **Activity** timeline and **Comments** thread + comment input.

### 5. Submissions (`/submissions`)
- **Purpose:** Searchable database of every feature submitted (Google-Doc replacement).
- **Layout:** Filter bar (search + Team + Gate-status dropdowns + Submit feature) + table:
  `Feature/Screen | Team | Product Lead | Design source | Submitted | Compliance |
  Issues | Gate`. Compliance = mini bar + %, Gate = status chip. Rows navigate (top row →
  AI Validation).

### 6. Submit Feature (`/submit`)
- **Purpose:** Intake form that starts the gate.
- **Layout:** `1.9fr 1fr` grid. Left = form card: Feature/Screen name*, Team* (select),
  Product Lead* (select), Module/route, Priority* (select), Figma design link* (icon
  input), Implementation source* (GitHub), Staging URL, Notes textarea, Screenshots
  dropzone; a toggle **"Run AI validation on submit"** (default on); "Save draft" +
  "Submit to gate" (→ AI Validation). Right = "What happens next" (3 steps) + "Integrations
  active" list (Figma, GitHub, Jira, Claude — all Connected). `*` = required.

## Interactions & Behavior
- **Auth gate:** unauthenticated → Sign In; on sign-in → Governance. Sign-out control in
  sidebar footer.
- **Navigation:** sidebar items switch screens; active item = orange tint bg + orange text.
  In the real app use routes; keep the active-state styling.
- **Recently Submitted rows, board cards, submission rows → open the relevant detail.**
- **Submit → run AI validation → generate issues → assign to PL → notify.**
- **Notifications:** on submit, email PL + UI/UX list, Slack webhook, in-app bell + recent
  feed. On SLA breach (status ≠ Verified past due), reminder + escalation (Vercel Cron).
- Transitions are subtle (0.12s bg/color on hover); the "Live" dot pulses (keyframe).

## State Management
- `authed` (bool), current user (from SSO), current route/screen.
- Entities: `Submission`, `Issue`, `Team`, `ProductLead`, `Comment`, `ActivityEvent`,
  `ValidationRun` (+ `Finding`).
- Derived dashboard aggregates (per-team counts, category breakdown, gate queue).
- Data fetching per route; mutations for submit / create-issue / transition / comment.

## Suggested Data Model (minimum)
- **teams**(id, name, status)
- **product_leads**(id, name, email, team_id)
- **submissions**(id, title, team_id, pl_id, module, priority, figma_url, impl_source,
  staging_url, notes, gate_status, compliance_score, created_at, submitted_by)
- **validation_runs**(id, submission_id, score, passed, warnings, violations, created_at)
- **findings**(id, run_id, category, severity, title, description, found, expected)
- **issues**(id, submission_id, title, category, severity, component, screen, team_id,
  pl_id, assignee_id, status[open|in_progress|fixed|verified], reported_by, created_at,
  due_at, figma_ref, pr_ref)
- **comments**(id, issue_id, author_id, body, created_at)
- **activity_events**(id, issue_id, actor_id, type, meta, created_at)

## Design Tokens
**Fonts:** Inter (400/500/600/700/800), loaded from Google Fonts. Icons: Bootstrap Icons.

**Colors**
- Background app `#f8fafc`; surface `#ffffff`; subtle fill `#f8fafc`/`#f1f5f9`.
- Text: primary `#0f172a`, secondary `#475569`, muted `#94a3b8`; slate `#64748b`.
- Borders: `#e2e8f0` (default), `#f1f5f9` (hairline).
- **Brand / primary (orange):** `#ea580c` (primary), hover/dark `#c2410c`, light `#fb923c`,
  lighter `#fdba74`; tints `#fff1e6` (active-nav/chip bg), `#fed7aa`, `#ffedd5`.
  Primary shadow `rgba(234,88,12,.4)`.
- **Semantic (status — keep, do not orange-ify):** success `#059669`/tint `#ecfdf5`;
  warning `#d97706`/tint `#fffbeb`; danger `#dc2626`/`#ef4444`/tint `#fef2f2`;
  info/in-progress `#2563eb`/`#3b82f6`/tint `#eff6ff`; open/neutral dot `#94a3b8`.

**Spacing:** 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 30 px.
**Radius:** inputs/buttons 9–11px; cards 14–16px; pills/chips 6px; full `999px`.
**Shadow (cards):** `0 1px 2px rgba(15,23,42,.04)`.
**Type sizes:** page title 17px/800; section title 15px/700; card numbers 18–30px/800;
body 13px; labels 10–12px/600–700 uppercase w/ letter-spacing.

## Assets
- **Logo/brand:** prototype uses an orange rounded-tile shield icon + "UX Pilot" wordmark.
  Use the official OrangeHRM brand assets in the real codebase.
- **Icons:** Bootstrap Icons (`bi-*`). Replace with the codebase's icon set if standardized.
- **Comparison images:** striped placeholders — replace with real Figma exports + captured
  implementation screenshots.

## Files
- `Sentinel — Modern Dashboard.dc.html` — the full high-fidelity prototype (all screens +
  login). Open in a browser to explore; click "Continue with OrangeHRM SSO" to enter.
- (Design-system source, if useful: this was themed away from OrangeHRM's OXD kit toward a
  modern Inter + orange look per stakeholder direction.)
