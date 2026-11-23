# Alpha AI Teammates - Quick Start Guide

## 🚀 Project at a Glance

| Metric | Value |
|--------|-------|
| **Stack** | Next.js 16.4.6 + Supabase + FreeLLM + R3F |
| **Phase** | Infrastructure Complete → Bot UI Development |
| **TypeScript** | 0 errors |
| **Build** | ✅ Passing |
| **Dev Server** | `http://localhost:3000` |

---

## 📋 Current Roadmap Phase

```
✅ Phase 0: Infrastructure Setup (Complete)
   └── Auth, DB migrations, API routes, FreeLLM gateway, UI shell

🔄 Phase 1: Bot Management UI (In Progress)
   ├── [ ] Test real auth flow (signup → email → dashboard)
   ├── [ ] Build BotList component
   ├── [ ] Integrate BotDialog into Bots tab
   └── [ ] Verify Bot CRUD operations

⏳ Phase 2: 3D Office Visualization
   ├── [ ] Create R3F canvas with isometric camera
   ├── [ ] Implement Floor component
   ├── [ ] Add Avatar components with status rings
   └── [ ] Elevator navigation between floors

⏳ Phase 3: Chat Interface
   ├── [ ] Vercel Chat SDK integration
   ├── [ ] Thread/message APIs
   └── [ ] Real-time updates via Supabase Realtime

⏳ Phase 4: Background Workers
   ├── [ ] Upstash QStash setup
   ├── [ ] Scheduled bot jobs
   └── [ ] Task queue processing

⏳ Phase 5: Integrations
   ├── [ ] Composio OAuth flows
   ├── [ ] Telegram bot connectivity
   └── [ ] Morning recap system
```

---

## 🔑 Credentials (From .env)

| Service | Variable | Location |
|---------|----------|----------|
| **Supabase URL** | `NEXT_PUBLIC_SUPABASE_URL` | `.env` |
| **Supabase Key** | `SUPABASE_ANON_KEY` | `.env` |
| **Supabase Service Role** | `SUPABASE_SERVICE_ROLE_KEY` | `.env` |
| **FreeLLM URL** | `FREE_LLMAPI_URL` | `.env` |
| **FreeLLM Key** | `FREE_LLMAPI_KEY` | `.env` |

---

## ⚡ Quick-Start Commands

```bash
# Navigate to project
cd /home/godwin/personal-ai-team/alpha-ai-teammates

# Start dev server (if not running)
npm run dev

# Open browser
open http://localhost:3000/login

# Test auth flow
# 1. Click "Sign Up"
# 2. Enter email/password
# 3. Check email → click confirmation link
# 4. Should redirect to /dashboard

# Check FreeLLM models
curl http://localhost:5173/v1/models

# Verify Supabase connection
curl http://localhost:3000/api/workspaces
# (should redirect to login if unauthenticated)
```

---

## 📂 Key Files (Read in This Order)

1. **`app/dashboard/page.tsx`** — Main dashboard, all CRUD handlers
2. **`components/Bots/BotDialog.tsx`** — Complete bot configuration form
3. **`app/auth/callback/route.ts`** — OAuth code exchange + auto-workspace creation
4. **`lib/llm/gateway.ts`** — FreeLLM client with model routing
5. **`supabase/migrations/001_initial_schema.sql`** — Database schema
6. **`types/index.ts`** — TypeScript types

---

## 🚫 Known Landmines

| Issue | Location | Impact | Fix Status |
|-------|----------|--------|------------|
| **Email confirmation required** | Supabase Dashboard | New users stuck if not configured | Document only |
| **BotList placeholder** | Dashboard Bots tab | Empty table until implemented | Planned for Phase 1 |
| **Unused lint warnings** | Multiple files | Non-blocking, cosmetic | Deferred |
| **No production build tested on Android** | Any build command | May OOM on low-memory devices | Note for mobile testing |
| **Composio redirects misconfigured** | Later phase | OAuth flow breaks | Will address in Phase 5 |

---

## 🤖 Environment Notes

- **Node**: 20+ required
- **Package Manager**: npm
- **Turbopack**: Enabled for faster dev builds
- **Supabase Region**: eu-west-1
- **FreeLLM Instance**: Local workplace deployment (auto-routes to best model)

---

## 📞 Getting Help

Check these docs in order:
1. `HANDOFF.md` — Detailed session history
2. `node_modules/next/dist/docs/` — Next.js version-specific docs
3. `AGENTS.md` — Project instructions

---

## ✅ Success Criteria

When you can answer YES to these, Phase 1 is complete:
- [ ] I signed up with a real email and received the confirmation
- [ ] I landed on `/dashboard` after confirming
- [ ] I see my workspace's departments listed
- [ ] The "Bots" tab shows an "Add Bot" button
- [ ] I clicked it, filled out the form, and saved a bot
- [ ] The new bot appears in the list under its department