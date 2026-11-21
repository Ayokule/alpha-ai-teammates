-- Alpha AI Teammates - Initial Schema
-- Creates: workspaces, workspace_members, departments, bots
-- Migration: 2026-11-21

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- WORKSPACES
-- =============================================================================

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
    budget_alert_thresholds NUMERIC(3, 2)[] NOT NULL DEFAULT ARRAY[0.80, 0.95],
    auto_pause_at_limit BOOLEAN NOT NULL DEFAULT TRUE,
    free_llmapi_url TEXT,
    free_llmapi_key TEXT,
    plan_tier TEXT NOT NULL DEFAULT 'free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for owner lookups
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);

-- =============================================================================
-- WORKSPACE MEMBERS
-- =============================================================================

CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role workspace_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);

-- Indexes
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

-- =============================================================================
-- DEPARTMENTS (FLOORS)
-- =============================================================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    floor_tint TEXT NOT NULL DEFAULT '#F5F0E8',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, display_order)
);

-- Indexes
CREATE INDEX idx_departments_workspace_id ON departments(workspace_id);
CREATE INDEX idx_departments_display_order ON departments(workspace_id, display_order);

-- =============================================================================
-- BOTS
-- =============================================================================

CREATE TYPE bot_role AS ENUM ('head', 'lead', 'worker');

CREATE TABLE bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    role bot_role NOT NULL DEFAULT 'worker',
    avatar_color TEXT NOT NULL DEFAULT '#6366F1',
    instructions TEXT NOT NULL DEFAULT '',
    monthly_budget_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    budget_alert_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.80,
    free_llmapi_url TEXT,
    free_llmapi_key TEXT,
    is_head_immutable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bots_workspace_id ON bots(workspace_id);
CREATE INDEX idx_bots_department_id ON bots(department_id);
CREATE INDEX idx_bots_role ON bots(role);

-- Constraint: Only one head bot per workspace
CREATE UNIQUE INDEX idx_bots_one_head_per_workspace
ON bots(workspace_id)
WHERE role = 'head' AND is_head_immutable = TRUE;

-- =============================================================================
-- BOT TOOL CONFIGS
-- =============================================================================

CREATE TABLE bot_tool_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    toolkit TEXT NOT NULL,
    composio_connection_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bot_id, toolkit)
);

CREATE INDEX idx_bot_tool_configs_bot_id ON bot_tool_configs(bot_id);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bots_updated_at
    BEFORE UPDATE ON bots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_tool_configs_updated_at
    BEFORE UPDATE ON bot_tool_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_tool_configs ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS policies
CREATE OR REPLACE FUNCTION current_user_workspace_role(workspace_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM workspace_members
    WHERE workspace_id = $1 AND user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_workspace_member(workspace_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = $1 AND user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================================================
-- RLS POLICIES: WORKSPACES
-- =============================================================================

-- Members can view their workspace
CREATE POLICY "workspaces_select" ON workspaces FOR SELECT
USING (
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

-- Owner can create workspace
CREATE POLICY "workspaces_insert" ON workspaces FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Owner/Admin can update workspace
CREATE POLICY "workspaces_update" ON workspaces FOR UPDATE
USING (current_user_workspace_role(id) IN ('owner', 'admin'));

-- =============================================================================
-- RLS POLICIES: WORKSPACE MEMBERS
-- =============================================================================

CREATE POLICY "workspace_members_select" ON workspace_members FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_members_insert" ON workspace_members FOR INSERT
WITH CHECK (
    current_user_workspace_role(workspace_id) IN ('owner', 'admin')
    AND role IN ('member', 'admin')
);

CREATE POLICY "workspace_members_update" ON workspace_members FOR UPDATE
USING (
    current_user_workspace_role(workspace_id) = 'owner'
    OR (current_user_workspace_role(workspace_id) = 'admin' AND role != 'owner')
);

CREATE POLICY "workspace_members_delete" ON workspace_members FOR DELETE
USING (current_user_workspace_role(workspace_id) = 'owner');

-- =============================================================================
-- RLS POLICIES: DEPARTMENTS
-- =============================================================================

CREATE POLICY "departments_select" ON departments FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY "departments_insert" ON departments FOR INSERT
WITH CHECK (current_user_workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "departments_update" ON departments FOR UPDATE
USING (current_user_workspace_role(workspace_id) IN ('owner', 'admin'));

CREATE POLICY "departments_delete" ON departments FOR DELETE
USING (current_user_workspace_role(workspace_id) IN ('owner', 'admin'));

-- =============================================================================
-- RLS POLICIES: BOTS
-- =============================================================================

CREATE POLICY "bots_select" ON bots FOR SELECT
USING (is_workspace_member(workspace_id));

-- For INSERT: check if user is owner/admin of the workspace being inserted into
CREATE POLICY "bots_insert" ON bots FOR INSERT
WITH CHECK (
    current_user_workspace_role(workspace_id) IN ('owner', 'admin')
    AND NOT (
        role = 'head'
        AND EXISTS (
            SELECT 1 FROM bots WHERE workspace_id = bots.workspace_id AND role = 'head'
        )
    )
);

-- For UPDATE: check if user is owner/admin and not trying to modify head bot
CREATE POLICY "bots_update" ON bots FOR UPDATE
USING (
    current_user_workspace_role(workspace_id) IN ('owner', 'admin')
    AND NOT (role = 'head')
);

CREATE POLICY "bots_delete" ON bots FOR DELETE
USING (
    current_user_workspace_role(workspace_id) IN ('owner', 'admin')
    AND role != 'head'
);

-- =============================================================================
-- RLS POLICIES: BOT TOOL CONFIGS
-- =============================================================================

CREATE POLICY "bot_tool_configs_select" ON bot_tool_configs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM bots b
        JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
        WHERE b.id = bot_tool_configs.bot_id AND wm.user_id = auth.uid()
    )
);

CREATE POLICY "bot_tool_configs_insert" ON bot_tool_configs FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM bots b
        JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
        WHERE b.id = bot_id AND wm.user_id = auth.uid()
        AND current_user_workspace_role(b.workspace_id) IN ('owner', 'admin')
    )
);

CREATE POLICY "bot_tool_configs_update" ON bot_tool_configs FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM bots b
        JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
        WHERE b.id = bot_id AND wm.user_id = auth.uid()
        AND current_user_workspace_role(b.workspace_id) IN ('owner', 'admin')
    )
);

CREATE POLICY "bot_tool_configs_delete" ON bot_tool_configs FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM bots b
        JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
        WHERE b.id = bot_id AND wm.user_id = auth.uid()
        AND current_user_workspace_role(b.workspace_id) IN ('owner', 'admin')
    )
);