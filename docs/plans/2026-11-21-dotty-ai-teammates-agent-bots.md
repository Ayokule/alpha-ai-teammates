# Alpha — AI-Teammate-Bots Implementation Plan

**Date:** 2026-11-21  
**Version:** 1.0 (v1 Launch)  
**Status:** ✅ Discovery Complete — Ready for Implementation

---

## 1. Specification Summary

### 1.1 Product
Alpha — a hosted web app where one person (or team) runs a team of AI bots inside a 3D isometric office building. User manages bots across departments (floors), assigns tasks, and gets a "while you slept" morning recap.

### 1.2 Primary User
Solo founders, indie hackers, small teams who want an "AI department" they can manage visually and conversationally from a 3D office or Telegram.

### 1.3 Core Outcome
User delegates recurring work (email, research, content, coding) to specialized bots that operate autonomously on schedules, ask for approval only when needed, and report back each morning — all from a spatial 3D office or Telegram.

### 1.4 Version-One Scope (Must Have)
- **Auth & Workspaces:** Supabase Auth, multi-user workspaces (Owner/Admin/Member), invitations, one building per workspace
- **Department/Floor Model:** Starter departments (Assistant, Research, Content, Engineering) as floors; custom departments via dialog (name, tint, order); edit/reorder/delete with bot migration
- **Bot Model:** Head bot (1 per workspace, top floor, immutable); per-department Lead (1) + Workers; bot dialog: name, role, department, Lead/Worker, avatar, color, instructions, tool access
- **3D Office (R3F):** Low-poly isometric, cream "field notes" style; elevator navigation (▲/▼/scroll, smooth glide, 4 floors visible +1 buffer); floor list → jump; garden/lobby at bottom
- **Chat (Vercel Chat SDK + AI SDK):** Side drawer per bot; one thread per bot; "New Chat" = divider (`── new chat · date ──`); bot only recalls messages after divider
- **Telegram:** Main routing bot + deep links to per-bot chats
- **Bot Runtime:** Upstash QStash queue → dedicated Node workers → Supabase Realtime updates; Browserbase sessions for Research/Engineering
- **Approvals:** Hybrid — blocking for destructive (send/pay/publish/delete/merge), non-blocking for read/browse; Waiting-on-me cards with "Give access" / "Hand to <bot>" / "Connect <app>"
- **Composio:** Workspace connections for common apps (Gmail, Calendar); per-bot for sensitive (GitHub, Slack); bot tool config = dynamic subset of connected toolkits + "All connected apps"
- **Prompt System:** Head bot writes/updates prompts for Leads/Workers as part of planning (self-improving prompt library, versioned, automated eval)
- **Task System:** Free-form natural language assignment from Head/Leads to any bot; target bot interprets + executes with its tools
- **Scheduling/Recap:** Cron jobs → aggregate activity → LLM narrative → interactive morning recap (approve/deny from email/Telegram/in-app)
- **GitHub App:** Engineering bots open PRs in sandbox → user approves → merge

### 1.5 Explicitly Out of Scope (v1)
- Multi-building workspaces
- Bot-to-bot chat (only Head/Lead → Worker assignment)
- Voice/video bot interaction
- Custom tool development (only Composio + Browserbase + GitHub)
- Mobile app (responsive web only)
- Analytics/dashboard beyond recap
- Per-bot budget allocation (v1: workspace-level only)
- Tiered SaaS plans (v1: hard budget only)

### 1.6 Confirmed Decisions (from Discovery)
| Area | Decision |
|------|----------|
| Bot Runtime | Dedicated workers (Upstash QStash) + Browserbase for heavy tasks |
| Approvals | Hybrid: blocking for destructive, non-blocking for read |
| Telegram | Main routing bot + deep links to per-bot chats |
| Composio | Hybrid: workspace connections (common) + per-bot (sensitive) |
| 3D Priority | Balanced: office for awareness, chat for deep work |
| Recap | Interactive with approval actions |
| Tenancy | Multi-user workspaces with roles + invitations |
| Prompts | Head bot manages prompt library for all bots |
| Deployment | Vercel-first, portable to self-hosted |
| Tasks | Free-form natural language assignment |
| Design | Build from "calm cream field notes" spec |
| AI Gateway | Required — all LLM calls route through it (FreeLLM) |
| Chat UI | Vercel Chat SDK components |

### 1.7 Assumptions (Defaults Needing Validation)
| Assumption | Risk if Wrong |
|------------|---------------|
| User provides FreeLLM key + endpoint format compatible with AI SDK | Integration blocker |
| Upstash QStash + Redis supports required throughput for bot queue | May need separate worker infra |
| Browserbase sessions can be pooled/reused across bot tasks | Cost/latency issues |
| Supabase Realtime handles per-bot status updates at scale | May need presence optimization |
| Vercel Chat SDK supports "divider" messages + thread-per-bot model | Custom components needed |
| Composio toolkits map cleanly to "connected apps" selector | Custom adapter layer needed |
| GitHub App permissions cover sandbox PR creation + merge | May need classic OAuth fallback |

### 1.8 Open Risks & Unknowns
| Priority | Risk | Plan Section |
|----------|------|--------------|
| P0 | Approval state machine (blocking/non-blocking + external triggers) | D12-D14 |
| P0 | Prompt management + automated eval harness | D08 |
| P1 | Worker scaling + priority queues | D05 |
| P1 | Multi-user RLS + Realtime policies | D02 |
| P1 | 3D LOD system performance | D10 |
| P2 | Cost controls + budget caps | D16 |
| P2 | Telegram deep link compatibility | D13 |

---

## 2. Implementation Plan — Phased Task List

### Overview
The plan is organized into **6 phases**. Phase 0 (foundation) must complete before any other phase can start. Phases 1-3 form the v1 launch; phases 4-6 are post-launch enhancements.

Each phase contains tasks with dependencies, acceptance criteria, and estimated effort.

---

### Phase 0: Foundation (2 weeks ⏱)

| Task | Description | Dependencies | Acceptance Criteria | Effort |
|------|-------------|--------------|---------------------|--------|
| **0.1** | Set up Supabase project | None | New Supabase project created; Auth, Postgres, Realtime enabled | 0.5 day |
| **0.2** | Initialize Next.js 14 project | 0.1 | `npx create-next-app@latest@alpha` with App Router, TypeScript, ESLint, Tailwind | 1 day |
| **0.3** | Configure Supabase credentials in `.env` | 0.1, 0.2 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env` | 0.5 day |
| **0.4** | Add FreeLLM env vars | 0.1 | `FREE_LLMAPI_URL=http://freellm.mycompany.com/v1`, `FREE_LLMAPI_KEY=sk-...` (or empty if no auth) | 0.5 day |
| **0.5** | Install core dependencies | 0.2, 0.3, 0.4 | `react`, `react-dom`, `next`, `supabase`, `ai`, `@vercel/chat-sdk`, `three`, `@tweenjs/tween.js`, `composio-ai`, `upstash-js` | 0.5 day |
| **0.6** | Set up repository structure | 0.5 | `docs/`, `app/`, `components/`, `lib/`, `workers/` directories; `tsconfig.json` configured; `next.config.ts` with correct aliases | 1 day |
| **0.7** | Add AGENTS.md pointer | 0.6 | `AGENTS.md` updated with `Project documents` block pointing to this plan file | < 0.5 day |

**Phase 0 Total:** ~5 days ⏱  
**Goal:** Fresh repo with all infra configured, env vars set, and plan pointer in place. All subsequent phases build on this foundation.

---

### Phase 1: Core Bots & Department Floors (3 weeks ⏱)

| Task | Description | Dependencies | Acceptance Criteria | Effort |
|------|-------------|--------------|---------------------|--------|
| **1.1** | `workspaces` + `workspace_migrations` tables | 0.7 | Supabase migration creates `workspaces` (id, name, icon, owner_id, monthly_budget_usd, free_llmapi_url, free_llmapi_key, plan_tier, created_at) and `workspace_members` (id, workspace_id, user_id, role, joined_at) | 2 days |
| **1.2** | RLS policies for workspace-scoped tables | 1.1 | Row-level security policies on `workspaces`, `workspace_members`, `departments`, `bots` — members can only access their workspace's data | 2 days |
| **1.3** | Department/floor model UI | 1.2 | Department dialog (name, floor tint); add department creates floor in 3D office; edit/reorder deletes with bot migration logic | 3 days |
| **1.4** | Head bot creation (default with workspace) | 1.2, 1.3 | On workspace creation, Head bot auto-created: role=head, department=4 (top floor), immutable (can't delete/demote), avatar=PM icon, color=calm-blue | 2 days |
| **1.5** | Bot dialog component | 1.3, 1.4 | Bot form: name, role (lead/worker), department (floor selector), avatar (color picker), instructions textarea, tool access (Connected apps multi-select + "All connected apps") | 3 days |
| **1.6** | Bot list in team panel | 1.5 | Scrollable list of bots per floor; clicking bot → focus/selected state; status ring (HTML overlay) showing online/offline/waiting_approval | 2 days |
| **1.7** | Department reorder + bot migration | 1.3, 1.5 | Reordering floors moves all bots to new floor order; deleting floor prompts: "Move bots to floor X or delete?"; undo support | 2 days |

**Phase 1 Total:** ~3 weeks ⏱  
**Goal:** Users can create workspaces, add departments (floors), create the Head bot, add Worker/Lead bots, and see them in the 3D office.

---

### Phase 2: 3D Office & Navigation (3 weeks ⏱)

| Task | Description | Dependencies | Acceptance Criteria | Effort |
|------|-------------|--------------|---------------------|--------|
| **2.1** | R3F scene setup | 1.7 | `Canvas` from `react-three-fiber`; isometric camera; cream "field notes" colors (background, floor materials); basic lighting | 3 days |
| **2.2** | Floor rendering with LOD | 2.1 | **Full render** (currentFloor ± 1): avatars at desks, status rings, desk meshes; **Simplified** ( ± 2–3): baked textures, no avatars, single desk instance; **Slab** (beyond ± 3): single colored mesh per floor; LOD function: `getDetailLevel(floorIndex, currentFloor, totalFloors)` | 4 days |
| **2.3** | Instanced desks & avatars | 2.2 | `InstancedMesh` for repeated desk elements; avatar bases instanced; status rings as HTML overlay (not Three.js) using `useFrame` to project 3D→2D screen coordinates | 3 days |
| **2.4** | Elevator navigation controls | 2.2 | ▲/▼ buttons + mouse scroll → smooth glide to target floor; edge indicators: "3 more above" / "2 more below"; floor list in sidebar → jump to floor; garden/lobby at bottom always visible | 3 days |
| **2.5** | Performance budget & CI check | 2.3 | Playwright test: office with 15 floors maintains 60fps avg; p95 frame < 20ms; max frame < 50ms; CI fails if budget exceeded | 3 days |
| **2.6** | Floor count state management | 2.4 | `useState` for currentFloor (1-indexed); totalFloys derived from departments table; on mount → glide to floor 1 (lobby/garden) | 1 day |

**Phase 2 Total:** ~3 weeks ⏱  
**Goal:** Users can navigate the 3D office, see floors with LOD, and perform elevator navigation smoothly at 60fps.

---

### Phase 3: Chat, Tasks & Bot Runtime (4 weeks ⏱)

| Task | Description | Dependencies | Acceptance Criteria | Effort |
|------|-------------|--------------|---------------------|--------|
| **3.1** | Vercel Chat SDK setup | 2.6 | `NextChat` component from `@vercel/chat-sdk`; Thread/Message/Input components rendered in side drawer; chat loads per-bot thread | 3 days |
| **3.2** | Thread + Message model (Supabase) | 1.2, 3.1 | `threads` (id, bot_id, workspace_id, last_message_at); `messages` (id, thread_id, user_id, role, content, created_at); RLS policies | 3 days |
| **3.3** | "New chat" divider + thread logic | 3.2 | Clicking "New chat" adds divider `── new chat · Dec 20, 2026 ──` in same thread; bot only recalls messages **after** divider; older messages stay visible above | 3 days |
| **3.4** | Quick Ask Head from any bot | 3.3 | From any bot's side drawer → "Ask Head" → opens modal with text input; Head bot receives message + context (which bot asked); Head responds → reply appears in bot's thread | 3 days |
| **3.5** | FreeLLM provider + model routing | 0.4, 3.1 | `lib/llm/gateway.ts` reads `FREE_LLMAPI_URL/KEY`; `MODEL_ROUTING`: assistant→haiku, research→auto:smart, content→sonnet, engineering→gpt-4o-mini; AI SDK `generateText()` uses provider; fallback if free tier exhausted | 3 days |
| **3.6** | Task assignment (free-form) | 1.4, 3.3, 3.5 | Head/Lead selects bot → types natural language task → task created in DB with `source: 'delegation'`; bot worker picks up task → interprets + executes with its tools; task status: `pending` → `in_progress` → `completed`/`failed` | 4 days |
| **3.7** | Upstash QStash queue setup | 0.3 | QStash client initialized; queues: `urgent` (user-initiated), `scheduled` (cron), `background` (maintenance); publish task from UI → appears in queue | 2 days |
| **3.8** | Bot worker (Node) skeleton | 3.6, 3.7, 3.5 | Worker process: subscribes to QStash queues; picks up task → runs bot's system prompt + tool config → calls FreeLLM via AI SDK → returns result → updates task status; health check endpoint; dead-letter queue for failed tasks | 5 days |
| **3.9** | Browserbase integration (Research/Engineering) | 3.8 | Browserbase client initialized; Research bot task → creates Browserbase session → navigates to target URL → extracts data → returns to bot; Engineering bot → sandbox code execution in Browserbase session; session pooling + concurrency limits | 4 days |

**Phase 3 Total:** ~4 weeks ⏱  
**Goal:** Users can chat with bots, assign tasks via natural language, and bots execute using FreeLLM + their tool configs. Scheduled tasks flow through QStash workers.

---

### Phase 4: Approvals & Morning Recap (3 weeks ⏱) — *Post-v1*

| Task | Description | Dependencies | Acceptance Criteria | Effort |
|------|-------------|--------------|---------------------|--------|
| **4.1** | Approval request DB schema | 3.9 | `approval_requests` table (id, workspace_id, bot_id, task_id, action_type, is_blocking, action_payload, action_preview, status, is_blocking, resolved_by, resolved_at, resolution_note, idempotency_key, external_trigger_token, expires_at); migrations + RLS policies | 3 days |
| **4.2** | Approval state machine | 4.1 | Valid transitions: `pending` → `approved`/`denied`/`expired`/`executing`; `executing` → `completed`/`failed`/ `expired`; terminal states immutable; API handler with optimistic locking | 3 days |
| **4.3** | Waiting-on-me cards UI | 4.2 | When bot awaits approval → card in side drawer: "Awaiting approval for [action]"; preview of what will happen; "Approve" / "Deny" buttons | 3 days |
| **4.4** | Blocking vs non-blocking logic | 4.3 | `is_blocking=true` → bot polls `waitForApproval()` with exponential backoff, max 10min; `is_blocking=false` → bot continues other work; approval record separate | 3 days |
| **4.5** | External trigger endpoints (email/Telegram) | 4.3 | `GET /api/approvals/[token]` — resolves approval via link; renders approval page; on approve/deny → transitions state + realtime broadcast; Composio OAuth callback stores `approval_id` in OAuth state → resolves approval → resumes bot | 4 days |
| **4.6** | Morning recap cron job | 4.5 | Runs at 7AM daily (QStahc + Supabase Cron); aggregates all bot activity per workspace; LLM generates narrative ("while you slept"); includes interactive buttons: "Approve PR #42", "Reply to email", "Deny"; sends via email + Telegram | 4 days |
| **4.7** | Per-department recap highlights | 4.6 | Assistant → calendar/email summary; Research → price alerts found; Content → drafts ready; Engineering → PRs opened; user can expand each section | 2 days |

**Phase 4 Total:** ~3 weeks ⏱  
**Goal:** Users get interactive morning recap + can approve/deny from email/Telegram; blocking approvals work via bot polling; non-blocking approvals don't stall bot.

---

### Phase 5: Multi-User & Permissions (3 weeks ⏱) — *Post-v1*

| Task | Description | Dependencies | Acceptance Criteria | Effort |
|------|-------------|--------------|---------------------|--------|
| **5.1** | Workspace invitations flow | 4.7 | Owner/Admin invites member via email → member receives `/accept` link → role selection (member/admin); after accept → appears in workspace member list | 3 days |
| **5.2** | RLS policies for all workspace-scoped tables | 5.1 | All tables (`departments`, `bots`, `bot_tool_configs`, `tasks`, `approval_requests`, `threads`, `messages`, `composio_connections`, `recaps`) have proper RSL policies based on `current_workspace_role()` + `is_workspace_member()` | 5 days |
| **5.3** | Realtime publication policies | 5.2 | Supabase publication includes only tables where user is member; `bots` → `approval_requests` → `tasks` → `messages` filtered by workspace membership | 2 days |
| **5.4** | Per-workspace budget (v1 hard limit) | 4.7 | `workspaces.monthly_budget_usd` (default 50); `workspaces.budget_alert_thresholds` (JSON array [0.8, 0.95]); pre-flight `enforceBudget()` check before any billable action; dashboard shows spend + alerts | 3 days |
| **5.4** | Admin dashboard (basic) | 5.2, 5.3 | Shows: workspace member list, budget spend chart, bot list, approval queue, usage by component | 3 days |

**Phase 5 Total:** ~3 weeks ⏱  
**Goal:** Teammates can join workspaces, RLS prevents cross-workspace data leak, budget is enforced per-workspace.

---

### Phase 6: Cost Controls & Enterprise (3 weeks ⏱) — *Post-v1*

| Task | Description | Dependencies | Acceptance Criteria | Effort |
|------|-------------|--------------|---------------------|--------|
| **6.1** | Per-bot budget allocation (Phase 2 feature) | 5.4 | `bots.monthly_budget_usd` (0 = inherit from workspace); `bots.budget_alert_threshold`; per-bot usage tracking; reallocate from other bots if Owner | 3 days |
| **6.2** | Tiered plan config (Phase 3 feature) | 5.4 | `plan_limits` table (tier: free/starter/pro/team; monthly_tokens, monthly_browserbase_seconds, max_concurrent_browserbase_sessions, max_workers, overage_rate, price_usd); workspace has `plan_tier`; plan selector in settings | 3 days |
| **6.3** | Stripe integration (overages + subscriptions) | 6.2 | Stripe customer per workspace; monthly subscription handles plan tier; overage charges tracked in `overage_charges` table; invoices generated at month end | 4 days |
| **6.4** | Usage dashboard (enterprise) | 6.2, 6.3 | Graphs: tokens per day, Browserbase mins per day, QStash requests per day, cost per component; exportable CSV; alerts when approaching limits | 3 days |

**Phase 6 Total:** ~3 weeks ⏱  
**Goal:** Teams/enterprises can subscribe, pay for overages, and see detailed usage breakdowns.

---

### Phase 7: Telegram & Polishing (2 weeks ⏱) — *Post-v1*

| Task | Description | Dependencies | Acceptance Criteria | Effort |
|------|-------------|--------------|---------------------|--------|
| **7.1** | Main routing bot | 4.5 | Telegram BotFather setup; `/start` handler parses deep link payload `{type, botId, threadId}`; redirects user to correct bot chat or shows deep link URL | 2 days |
| **7.2** | Per-bot deep links | 7.1 | `https://t.me/bot_username?start=base64url(payload)` opens specific bot chat; payload decodes to `{type: 'chat'|'approval'|task', botId, threadId, approvalId, taskId}`; main bot handles routing | 3 days |
| **7.3** | Telegram webhook for approvals | 4.5, 7.2 | Webhook receives updates; if approval-related → resolves approval record + realtime broadcast; fallback: inline keyboard "Approve/Deny" in bot messages | 3 days |
| **7.4** | Polish: smooth glide, edge indicators, garden lobby | 2.4, 2.5 | Elevator glide animation; "3 more above / 2 more below" indicators; garden/lobby at floor 1 with subtle decoration; status ring animations polished; responsive on mobile | 3 days |

**Phase 7 Total:** ~2 weeks ⏱  
**Goal:** Telegram integration complete; 3D office polished for 60fps on mobile; all edge cases handled.

---

## 3. Complete Task Dependency Graph

```
Phase 0 (5d) → Phase 1 (3w) → Phase 2 (3w) → Phase 3 (4w) → Phase 4 (3w) → Phase 5 (3w) → Phase 6 (3w) → Phase 7 (2w)
     ↑              ↑              ↑              ↑              ↑              ↑              ↑              ↑
   0.7 AGENTS.md   1.2 RLS       2.1 R3F       3.5 FreeLLM   4.1 Approval    5.1 Invite      6.1 Per-bot   7.1 Main bot
   pointer        policies       scene         gateway       state machine   members       budget      bot
```

**Critical path:** Phase 0 → 1 → 2 → 3 → 4 (approvals are needed before recap can be interactive).

**Parallelizable pairs:**
- Phase 1: 1.3 + 1.5 + 1.6 can run in parallel (3 UI components)
- Phase 2: 2.2 + 2.3 (LOD + instancing) can run in parallel
- Phase 3: 3.1 + 3.5 (Chat SDK + FreeLLM) can run in parallel
- Phase 4: 4.2 + 4.5 (state machine + external endpoints) can run in parallel
- Phase 5: 5.2 + 5.3 (RLS + realtime) can run in parallel
- Phase 6: 6.1 + 6.2 (per-bot + tiered plans) can run in parallel
- Phase 7: 7.1 + 7.2 (main bot + deep links) can run in parallel

---

## 4. Acceptance Criteria for v1 Launch

The following must be true for "v1 launch" (internal beta or early access):

- ✅ User can sign up → create workspace (name + icon) → Head bot auto-created on top floor
- ✅ User can add departments (floors) via dialog; edit/reorder/delete with bot migration
- ✅ Bots appear at desks in 3D office; elevator navigation works (▲/▼/scroll, smooth glide, edge indicators)
- ✅ User can chat with any bot in side drawer; one thread per bot; "New chat" adds divider
- ✅ User can assign free-form tasks to any bot via delegation
- ✅ Bot executes task using FreeLLM + its tool config (Composio connections)
- ✅ Bot asks user when stuck (Waiting-on-me card); human grants access via OAuth or reassigns
- ✅ Morning recap email/Telegram at 7AM; includes interactive approval buttons
- ✅ Approvals work: blocking for destructive, non-blocking for read/browse
- ✅ RLS prevents users from seeing other workspaces' data
- ✅ FreeLLM gateway configured; model routing per department works
- ✅ 3D office maintains ~60fps with 10 floors + LOD system
- ✅ Budget enforcement: hard limit $50/mo default; alerts at 80%/95%; auto-pause at 100%

---

## 5. Success Metrics (Post-Launch)

| Metric | Target (v1) | Measurement |
|--------|-------------|-------------|
| **Time to first task** | < 5 minutes from sign-up to assigning first bot task | Time user spends in onboarding |
| **Bot task success rate** | ≥ 80% of delegated tasks complete without manual intervention | Worker logs / task status `completed` |
| **Approval card skip rate** | ≥ 70% of non-blocking approvals not needed (bot continues) | State machine transitions |
| **3D performance** | 60fps on 5-year-old laptop; no jank on mobile Safari/Chrome | Playwright CI + real device test |
| **Budget predictability** | User never surprised by overages (hard limit enforced) | Budget alert triggers + usage dashboard |
| **Telegram engagement** | ≥ 30% of users add Telegram as secondary chat channel | Survey + webhook stats |
| **Prompt eval pass rate** | ≥ 80% of Head-bot prompt changes pass automated eval | Eval harness results |

---

## 6. Rollback & Recovery

| Scenario | Rollback Plan |
|----------|---------------|
| **Migration fails** (RLS/policies) | Supabase has point-in-time recovery; restore DB to pre-migration state; revert code deploy |
| **Worker crashes** (infinite loop) | QStash dead-letter queue + max retries (3); failed tasks move to `dead_letter_tasks` table for manual inspection; worker process supervisor (PM2/Pino) auto-restarts |
| **Budget exceeded** (hard limit) | Tasks queued until next month; user can increase budget via dashboard; no data loss — task state preserved in DB |
| **FreeLLM API down** | Fallback to secondary provider (Anthropic key in .env as backup); graceful degradation: bot uses simpler model or waits; UI shows "AI service temporarily unavailable" |
| **3D performance regression** | LOD settings adjusted: reduce avatar count, lower texture resolution; feature flag to disable avatars if needed |

---

## 7. Glossary of Terms

| Term | Definition |
|------|------------|
| **Head bot** | The single product-manager bot on the top floor; plans work for the whole team; immutable (can't be deleted) |
| **Lead bot** | One per department/floor; can assign tasks to any bot on any floor; replacing Lead on a floor that already has one replaces it |
| **Worker bot** | Does the actual task execution; can be any number per department |
| **Elevator** | The navigation metaphor: ▲/▼ buttons or mouse scroll moves up/done one floor with smooth glide |
| **LOD (Level of Detail)** | Rendering strategy: full avatars/desks on currentFloor ± 1; simplified (baked textures, no avatars) on ± 2-3; slabs beyond |
| **Waiting-on-me card** | UI card shown when a bot awaits human approval; has "Approve" / "Deny" / "Hand it to <bot>" actions |
| **Idempotency key** | Unique key on approval actions to prevent duplicate execution if retry occurs |
| **FreeLLM** | The LLM gateway aggregating free-tier models behind one OpenAI-compatible key (your workplace instance) |
| **QStash** | Upstash queue service for background task processing (cron, scheduled, urgent) |
| **Browserbase** | Cloud browser sessions for Research/Engineering bots (web scraping, sandbox coding) |
| **Composio toolkit** | Pre-built integration (Gmail, Slack, GitHub, etc.) that bots can use via tool config |
| **RLS (Row-Level Security)** | Supabase feature that restricts which rows a user can see/ based on `workspace_id` + role |

---
*Implementation Plan version: 2026-11-21 — based on structured discovery with user; all confirmed decisions, assumptions, and open risks documented*