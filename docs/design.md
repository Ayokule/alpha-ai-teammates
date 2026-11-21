# Alpha — AI-Teammate-Bots Design Document

## Overview
Alpha is a hosted web app where one person (or team) runs a team of AI bots inside a 3D isometric office building. The user manages bots across departments (floors), assigns tasks, and gets a "while you slept" morning recap.

---

## 1. Product Vision
- **One person runs a team of AI bots** inside a spatial 3D office
- **Workspace = one building**; each department = one floor
- **Head bot** (product manager) on top floor plans work for the whole team
- **Leads** per department + **Worker bots** under them
- User chats with bots via side drawer or Telegram
- Bots ask user when stuck; nothing destructive happens without approval
- Morning "while you slept" recap of all bot activity

---

## 2. Core Features

### 2.1 Workspaces & Authentication
- **Supabase Auth** with multi-tenant workspaces
- **One workspace = one building** (initially single-user; multi-user via invitations v2)
- Roles: **Owner**, **Admin**, **Member**
- Invite flow: Owner/Admin invites members via email

### 2.2 Department / Floor Model
- **Starter departments (floors):**
  - **Floor 1 — Assistant:** Email, calendar, daily brief
  - **Floor 2 — Research:** Web browsing, price watching
  - **Floor 3 — Content:** Writing, Slack notifications
  - **Floor 4 — Engineering:** Developer bots, sandbox coding, GitHub PRs
- **Custom departments:** Edit, reorder, delete via dialog
- **Department dialog:** Name, floor tint, reorder/delete with bot migration
- **Elevator navigation:** See ~4 floors at a time; ▲/▼ or scroll glides up/down; edge shows "3 more above" / "2 more below"; click floor in team list → jump

### 2.3 3D Office (React Three Fiber)
- **Style:** Low-poly isometric, cream "field notes" aesthetic
- **Floor rendering LOD (Level of Detail):**
  - **Full render:** Current floor ± 1 (avatars, desks, status rings)
  - **Simplified:** Floors ± 2–3 (baked textures, no avatars, single desk mesh)
  - **Slab:** Beyond ± 3 (single colored mesh per floor)
- **Instanced meshes** for repeated elements (desks, avatar bases)
- **Status rings:** HTML overlay (not Three.js) for accessibility & performance
- **Elevator smooth glide** on navigation; floor count indicators at edges
- **Garden/lobby** at bottom (ground floor always visible)

### 2.4 Bot Management
- **Head bot:** Exactly one per workspace, created by default, immutable (can't delete/add)
- **Per-department Lead:** One per floor; picking "Lead" on a floor that has one replaces it
- **Worker bots:** Unlimited per department
- **Bot dialog:** Name, role, department (floor), Lead/Worker, avatar, color, instructions, tool access
- **Edit/reorder/delete departments** with bot migration logic

### 2.5 Chat System (Vercel Chat SDK + AI SDK)
- **Side drawer** to chat with any bot
- **One thread per bot** — messages organized by bot
- **"New chat"** adds divider `── new chat · date ──` in same thread
- Bot only remembers messages **after** the divider; older messages stay visible above
- **Never delete messages**
- **Normal chat messages** stay normal messages (not tied to bot threads)
- **Quick Ask Head:** From any bot drawer, "ask the head a quick question"

### 2.6 Bot Tool Access (Composio + AI Gateway)
- **Composio toolkits:** Gmail, Google Calendar, Slack, GitHub, Linear, Notion, etc.
- **Integration model:** Hybrid — workspace-level connections for common apps; per-bot for sensitive
- **Bot tool config:** Dynamic subset of connected toolkits + "All connected apps" option
- **Default tool access:**
  - **Head bot:** None (planning only)
  - **Lead bots:** All connected apps
  - **Worker bots:** All connected apps
- **When bot needs app it doesn't have:** "Waiting-on-me" card with:
  - "Give access" (routes to OAuth)
  - "Hand it to <bot>" (reassign)
  - "Connect <app>" (if nothing connected)
- **Bot never grants itself access** — human must approve

### 2.7 Bot Instructions / Prompts
- **Head bot writes/updates** prompts for Leads/Workers as part of planning (self-improving prompt library)
- **Prompt versioning** in DB: `prompt_versions` table (bot_id, version, system_prompt, tool_config, is_active, eval_score)
- **Automated eval harness** before promoting new prompt:
  - Minimum 3 test cases per prompt change
  - Pass rate ≥ 0.8 + latency < 30s
- **Head bot output format:** `HeadPlanOutput` with `tasks`, `prompt_updates`, `department_priorities`, `recap_notes`

### 2.8 Task Assignment
- **Free-form natural language** from Head/Leads to any bot on any floor
- Target bot interprets and executes with its tools
- No structured task catalog — more agentic but harder to debug (deliberate choice for v1)

### 2.9 Scheduling & Morning Recap
- **Cron jobs** (Upstash QStash + Supabase Cron) run at night
- **Aggregate all bot activity:** tasks completed, questions asked, approvals needed, errors
- **LLM narrative** generates "while you slept" summary
- **Interactive recap:** User can approve/deny pending items directly from recap (email/Telegram/in-app buttons)
- **Per-department highlights:** Assistant → calendar summary, Research → price alerts found, etc.

### 2.10 Telegram Integration
- **Main routing bot** — user's entry point
- **Per-bot deep links:** `https://t.me/bot_username?start=payload`
- **Payload:** base64url-encoded `{type: 'chat'|'approval'|'task', botId, threadId, approvalId, taskId}`
- **Main bot `/start <payload>`** parses and redirects to correct bot chat
- **Fallback:** If per-bot chat not open, shows "Start" button first

### 2.11 Approvals (Hybrid Blocking/Non-Blocking)
- **Blocking for destructive:** Send/pay/publish/delete/merge → bot pauses, Waiting-on-me card
- **Non-blocking for read/browse:** Bot continues; approval is separate record
- **Approval state machine** (DB `approval_requests`):
  - `pending` → `approved`/`denied`/`expired`/`executing` → `completed`/`failed`
- **External triggers:** Email links & Telegram deep links resolve approvals
- **Composio OAuth callback** stores `approval_id` in OAuth state → resolves approval → resumes bot
- **Idempotency keys** on every approval action

### 2.12 Cost Controls (v1 — Hard Budget)
- **Per-workspace `monthly_budget_usd`** (default $50)
- **Alert thresholds:** 80%, 95%, 100%
- **Auto-pause at limit:** Scheduled tasks queue until next month
- **Daily usage tracking** in `daily_usage` table
- **Components tracked:** AI Gateway, Browserbase, Composio, QStash, Redis, Vercel, Supabase

---

## 3. Technology Stack
- **Frontend:** Next.js 14 (App Router), React Three Fiber (R3F), Vercel Chat SDK
- **Backend:** Supabase (Auth, Postgres, Realtime, Storage)
- **LLM:** FreeLLM API Gateway (workplace-hosted or SaaS free tier) — all calls route through it
- **Workflow:** Upstash QStash (queue) → Dedicated Node workers → Supabase Realtime
- **Browser automation:** Browserbase (Research/Engineering bots)
- **Tool integration:** Composio (Gmail, Slack, GitHub, etc.)
- **Deployment:** Vercel (Pro for Edge Functions, team features)
- **Mobile/Telegram:** Telegram Bot API (main routing + per-bot deep links)

---

## 4. Data Model Highlights

### 4.1 Core Tables
- `workspaces` — id, name, icon, owner_id, monthly_budget_usd, free_llmapi_url, free_llmapi_key, plan_tier, etc.
- `workspace_members` — id, workspace_id, user_id, role (owner/admin/member), joined_at
- `departments` — id, name, floor_tint, order, workspace_id
- `bots` — id, name, role (head/lead/worker), department_id, avatar_color, instructions, monthly_budget_usd, free_llmapi_url, free_llmapi_key, is_head_immutable
- `bot_tool_configs` — id, bot_id, toolkit, composio_connection_id, is_active
- `tasks` — id, workspace_id, bot_id (nullable, for delegation), type, payload, source (user/chat/cron/delegation), priority, status
- `approval_requests` — id, workspace_id, bot_id, task_id, action_type, is_blocking, status, is_blocking, idempotency_key, external_trigger_token, expires_at
- `threads` — id, bot_id, workspace_id, last_message_at
- `messages` — id, thread_id, user_id, role (user/assistant/bot), content, created_at
- `daily_usage` — id, workspace_id, date, component, quantity, cost_usd, metadata
- `prompt_versions` — id, bot_id, version, system_prompt, tool_config, context_injection, created_by, eval_score, is_active
- `credit_transactions` / `overage_charges` — (Phase 2, not v1)

### 4.2 RLS Policies (Row-Level Security)
- Every workspace-scoped table has `workspace_id` + RLS
- Helper functions: `current_workspace_role(workspace_id)`, `is_workspace_member(workspace_id)`
- Policies: owners/admins manage workspace; members read their workspace's data
- Service role key in workers only — never in client code
- Realtime publications have matching RSL policies (only publish to workspace members)

### 4.3 Indexes for Performance
- `idx_approvals_bot_status` on `approval_requests(bot_id, status)` where status IN ('pending', 'approved')
- `idx_approvals_workspace_status` on `approval_requests(workspace_id, status, created_at DESC)`
- `idx_daily_usage_workspace_date` on `daily_usage(workspace_id, date DESC)`
- `idx_bots_workspace_dept` on `bots(workspace_id, department_id)`
- etc.

---

## 5. API Endpoints (Key Ones)

| Path | Method | Description |
|------|--------|-------------|
| `/api/llm/settings` | PUT | Owner updates FreeLLM URL/key per workspace |
| `/api/approvals/[token]` | GET | Resolve approval via email/Telegram link |
| `/api/composio/callback` | GET | OAuth callback — resolves approval + stores connection |
| `/api/cron/monthly-budget-reset` | GET | Runs on 1st of month; requeues queued tasks |
| `/api/bots/[id]/chat` | WebSocket / long-poll | Bot's chat thread messages |
| `/api/workspaces/[id]/bots` | GET | List bots in workspace (with RSL) |
| `/api/telegram/webhook` | POST | Main bot webhook — routes /start payloads |

---

## 6. Non-Functional Requirements

### 6.1 Performance
- **3D office:** 60fps on 5-year-old laptop / mid mobile with LOD system
- **Chat:** < 500ms message display after send
- **Approval transitions:** < 2s DB write + realtime broadcast

### 6.2 Security
- **RLS on every workspace-scoped table** — members can't see other workspaces' data
- **Approval idempotency** — no duplicate executions
- **Bot tool config** never grants itself access — human always in loop
- **API keys** via environment variables only — never in client bundle

### 6.3 Observability
- **Queue depth metrics** (materialized view `queue_metrics`)
- **Budget spend tracking** per workspace per component
- **Prompt eval scores** stored per version
- **Error tracking** (Sentry or similar) for worker failures

### 6.4 Deployment
- **Vercel** with Pro plan (Edge Functions, ISR, team features)
- **Supabase Pro** (8GB DB, 100k MAU, Cron for scheduling)
- **Environment parity:** `.env.local` → Vercel env vars → same code works everywhere
- **Self-hostable:** All infra (Supabase can be self-hosted; FreeLLM can be self-hosted)

---

## 7. Phase Roadmap (High-Level)

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| **Phase 0** | Foundation | Supabase Auth + multi-workspace, basic 3D office (1 floor), Head bot, AI gateway config |
| **Phase 1** | Core Bots | Departments/floors, bot dialog, tool configs (Composio), free-form task assignment, chat per bot |
| **Phase 2** | Approvals & Recaps | Approval state machine, Waiting-on-me cards, cron scheduling, morning recap with interactive actions |
| **Phase 3** | Multi-User | Workspace invitations, roles (Owner/Admin/Member), per-bot budget allocation, tiered plans |
| **Phase 4** | Enterprise | SSO, advanced analytics, custom integrations, on-premise deployment options |

---

## 8. Open Questions / Risks (For Later Refinement)
1. Prompt management complexity — eval harness design
2. Worker scaling — priority queues + pools
3. 3D performance budget — LOD system validation
4. Approval state machine + external triggers
5. Multi-user RLS — test suite needed
6. Cost model — phased approach (hard budget → soft → tiered)
7. Telegram deep links — universal link compatibility

---
*Document version: 2026-11-21 — based on structured discovery with user*