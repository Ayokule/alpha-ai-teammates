-- Alpha AI Teammates - Chat, Tasks, Approvals
-- Creates: threads, messages, tasks, approvals, recaps
-- Migration: 2026-11-21

-- =============================================================================
-- THREADS (Chat threads per bot)
-- =============================================================================

CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, bot_id)
);

CREATE INDEX idx_threads_workspace_id ON threads(workspace_id);
CREATE INDEX idx_threads_bot_id ON threads(bot_id);

-- =============================================================================
-- MESSAGES
-- =============================================================================

CREATE TYPE message_role AS ENUM ('user', 'assistant', 'bot', 'system');

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role message_role NOT NULL DEFAULT 'user',
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_created_at ON messages(thread_id, created_at);

-- =============================================================================
-- TASKS
-- =============================================================================

CREATE TYPE task_source AS ENUM ('user_chat', 'delegation', 'scheduled', 'approval_callback', 'head_plan');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'queued', 'cancelled');
CREATE TYPE task_priority AS ENUM ('urgent', 'scheduled', 'background');

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    source task_source NOT NULL DEFAULT 'user_chat',
    priority task_priority NOT NULL DEFAULT 'scheduled',
    status task_status NOT NULL DEFAULT 'pending',
    payload JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    max_retries INT NOT NULL DEFAULT 3,
    timeout_ms INT NOT NULL DEFAULT 300000,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_workspace_id ON tasks(workspace_id);
CREATE INDEX idx_tasks_bot_id ON tasks(bot_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- =============================================================================
-- APPROVALS
-- =============================================================================

CREATE TYPE approval_action_type AS ENUM (
    'send_email', 'send_slack', 'publish_content',
    'create_pr', 'merge_pr', 'delete_resource',
    'make_payment', 'composio_oauth', 'browserbase_action',
    'grant_tool_access', 'reassign_task'
);

CREATE TYPE approval_status AS ENUM (
    'pending', 'approved', 'denied', 'expired',
    'executing', 'completed', 'failed'
);

CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    action_type approval_action_type NOT NULL,
    action_payload JSONB NOT NULL,
    action_preview TEXT NOT NULL,
    is_blocking BOOLEAN NOT NULL DEFAULT TRUE,
    status approval_status NOT NULL DEFAULT 'pending',
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    external_trigger_token TEXT UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_workspace_status ON approvals(workspace_id, status, created_at DESC);
CREATE INDEX idx_approvals_bot_status ON approvals(bot_id, status)
WHERE status IN ('pending', 'approved');
CREATE INDEX idx_approvals_expires_at ON approvals(expires_at)
WHERE status = 'pending';
CREATE INDEX idx_approvals_external_token ON approvals(external_trigger_token)
WHERE external_trigger_token IS NOT NULL;

-- =============================================================================
-- RECAPS (Morning "while you slept" summaries)
-- =============================================================================

CREATE TABLE recaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    summary TEXT,
    narrative TEXT,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recaps_workspace_id ON recaps(workspace_id);
CREATE INDEX idx_recaps_period ON recaps(workspace_id, period_start DESC);

-- =============================================================================
-- RECAP ITEMS (Individual items in a recap)
-- =============================================================================

CREATE TABLE recap_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recap_id UUID NOT NULL REFERENCES recaps(id) ON DELETE CASCADE,
    bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    action_data JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recap_items_recap_id ON recap_items(recap_id);

-- =============================================================================
-- COMPOSIO CONNECTIONS
-- =============================================================================

CREATE TABLE composio_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
    toolkit TEXT NOT NULL,
    composio_connection_id TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    scopes TEXT[],
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, toolkit, bot_id)
);

CREATE INDEX idx_composio_connections_workspace_id ON composio_connections(workspace_id);
CREATE INDEX idx_composio_connections_bot_id ON composio_connections(bot_id);

-- =============================================================================
-- DAILY USAGE TRACKING
-- =============================================================================

CREATE TABLE daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    component TEXT NOT NULL CHECK (component IN (
        'ai_gateway', 'browserbase', 'composio', 'qstash', 'redis', 'vercel', 'supabase'
    )),
    quantity NUMERIC(12, 4) NOT NULL,
    cost_usd NUMERIC(10, 4) NOT NULL,
    metadata JSONB DEFAULT '{}',
    UNIQUE (workspace_id, date, component)
);

CREATE INDEX idx_daily_usage_workspace_date ON daily_usage(workspace_id, date DESC);

-- =============================================================================
-- DEAD LETTER QUEUE (Failed tasks for inspection)
-- =============================================================================

CREATE TABLE dead_letter_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_task JSONB NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    attempt_count INT NOT NULL,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_dead_letter_failed_at ON dead_letter_tasks(failed_at DESC);

-- =============================================================================
-- BUDGET QUEUED TASKS (Tasks waiting for budget reset)
-- =============================================================================

CREATE TABLE budget_queued_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL,
    task_payload JSONB NOT NULL,
    estimated_cost_usd NUMERIC(10, 4) NOT NULL,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retry_after TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_budget_queued_retry_after ON budget_queued_tasks(retry_after)
WHERE status = 'queued';

-- =============================================================================
-- PROMPT VERSIONS (For Head bot prompt management)
-- =============================================================================

CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    version INT NOT NULL,
    system_prompt TEXT NOT NULL,
    tool_config JSONB NOT NULL DEFAULT '{}',
    context_injection TEXT[] NOT NULL DEFAULT '{}',
    created_by TEXT NOT NULL CHECK (created_by IN ('head_bot', 'user', 'system')),
    eval_score NUMERIC(3, 2),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bot_id, version)
);

CREATE INDEX idx_prompt_versions_bot_active ON prompt_versions(bot_id, is_active)
WHERE is_active;

-- =============================================================================
-- PROMPT PROPOSALS (From Head bot, pending evaluation)
-- =============================================================================

CREATE TABLE prompt_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    head_task_id UUID REFERENCES tasks(id),
    bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    proposed_prompt JSONB NOT NULL,
    test_cases JSONB NOT NULL,
    eval_result JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'evaluating', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompt_proposals_bot_id ON prompt_proposals(bot_id);
CREATE INDEX idx_prompt_proposals_status ON prompt_proposals(status);

-- =============================================================================
-- QUEUE METRICS VIEW (Materialized view for monitoring)
-- =============================================================================

CREATE MATERIALIZED VIEW queue_metrics AS
SELECT
    priority,
    COUNT(*) as depth,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_wait_seconds,
    MAX(EXTRACT(EPOCH FROM (NOW() - created_at))) as max_wait_seconds
FROM tasks
WHERE status IN ('pending', 'in_progress')
GROUP BY priority;

CREATE UNIQUE INDEX idx_queue_metrics_priority ON queue_metrics(priority);

-- =============================================================================
-- MONTHLY USAGE VIEW
-- =============================================================================

CREATE MATERIALIZED VIEW monthly_usage AS
SELECT
    workspace_id,
    DATE_TRUNC('month', date)::DATE as month,
    component,
    SUM(quantity) as total_quantity,
    SUM(cost_usd) as total_cost_usd
FROM daily_usage
GROUP BY workspace_id, DATE_TRUNC('month', date), component;

CREATE UNIQUE INDEX idx_monthly_usage ON monthly_usage(workspace_id, month, component);

-- =============================================================================
-- BOT MONTHLY USAGE VIEW
-- =============================================================================

CREATE MATERIALIZED VIEW bot_monthly_usage AS
SELECT
    b.id as bot_id,
    b.workspace_id,
    DATE_TRUNC('month', du.date)::DATE as month,
    SUM(du.cost_usd) as total_cost_usd
FROM daily_usage du
JOIN bots b ON b.workspace_id = du.workspace_id
    AND du.metadata->>'bot_id' = b.id::text
GROUP BY b.id, b.workspace_id, DATE_TRUNC('month', du.date);

CREATE UNIQUE INDEX idx_bot_monthly_usage ON bot_monthly_usage(bot_id, month);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approvals_updated_at
    BEFORE UPDATE ON approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recaps_updated_at
    BEFORE UPDATE ON recaps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_composio_connections_updated_at
    BEFORE UPDATE ON composio_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- REFRESH MATERIALIZED VIEWS (Called by cron)
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_usage_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY queue_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_usage;
    REFRESH MATERIALIZED VIEW CONCURRENTLY bot_monthly_usage;
END;
$$ LANGUAGE plpgsql;