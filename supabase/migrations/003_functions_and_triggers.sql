-- Alpha AI Teammates - Helper Functions & Triggers
-- Migration: 2026-11-21

-- =============================================================================
-- WORKSPACE CREATION WITH STARTER DEPARTMENTS & HEAD BOT
-- =============================================================================

CREATE OR REPLACE FUNCTION create_workspace_with_defaults(
    p_name TEXT,
    p_free_llmapi_url TEXT,
    p_free_llmapi_key TEXT,
    p_icon TEXT DEFAULT '🏢',
    p_owner_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
    v_workspace_id UUID;
    v_head_bot_id UUID;
    v_assistant_dept_id UUID;
    v_research_dept_id UUID;
    v_content_dept_id UUID;
    v_engineering_dept_id UUID;
BEGIN
    -- Create workspace
    INSERT INTO workspaces (name, icon, owner_id, free_llmapi_url, free_llmapi_key)
    VALUES (p_name, p_icon, p_owner_id, p_free_llmapi_url, p_free_llmapi_key)
    RETURNING id INTO v_workspace_id;

    -- Add owner as workspace member
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_owner_id, 'owner');

    -- Create starter departments (floors)
    -- Floor 1: Assistant (green tint)
    INSERT INTO departments (workspace_id, name, floor_tint, display_order)
    VALUES (v_workspace_id, 'Assistant', '#A8D5BA', 1)
    RETURNING id INTO v_assistant_dept_id;

    -- Floor 2: Research (blue tint)
    INSERT INTO departments (workspace_id, name, floor_tint, display_order)
    VALUES (v_workspace_id, 'Research', '#90CAF9', 2)
    RETURNING id INTO v_research_dept_id;

    -- Floor 3: Content (purple tint)
    INSERT INTO departments (workspace_id, name, floor_tint, display_order)
    VALUES (v_workspace_id, 'Content', '#CE93D8', 3)
    RETURNING id INTO v_content_dept_id;

    -- Floor 4: Engineering (orange tint)
    INSERT INTO departments (workspace_id, name, floor_tint, display_order)
    VALUES (v_workspace_id, 'Engineering', '#FFAB91', 4)
    RETURNING id INTO v_engineering_dept_id;

    -- Create Head Bot (immutable, top floor - Engineering floor)
    INSERT INTO bots (workspace_id, department_id, name, role, avatar_color, instructions, is_head_immutable)
    VALUES (
        v_workspace_id,
        v_engineering_dept_id,
        'Alpha Head',
        'head',
        '#6366F1',
        'You are the Head Bot (Product Manager) for the Alpha team. You sit on the top floor and plan work for the entire team. You can assign tasks to any bot on any floor. You break down high-level goals into actionable tasks for Leads and Workers. You also manage the prompt library for all bots. Always think strategically about team priorities.',
        TRUE
    )
    RETURNING id INTO v_head_bot_id;

    -- Create Assistant Lead
    INSERT INTO bots (workspace_id, department_id, name, role, avatar_color, instructions)
    VALUES (
        v_workspace_id,
        v_assistant_dept_id,
        'Assistant Lead',
        'lead',
        '#4CAF50',
        'You are the Lead for the Assistant department. You manage email, calendar, and daily briefs. You can assign tasks to Assistant Workers. You report to the Head Bot.'
    );

    -- Create Assistant Worker
    INSERT INTO bots (workspace_id, department_id, name, role, avatar_color, instructions)
    VALUES (
        v_workspace_id,
        v_assistant_dept_id,
        'Assistant Bot',
        'worker',
        '#66BB6A',
        'You are an Assistant Worker. You handle email drafting, calendar scheduling, and daily brief generation. You use Gmail and Calendar tools via Composio.'
    );

    -- Create Research Lead
    INSERT INTO bots (workspace_id, department_id, name, role, avatar_color, instructions)
    VALUES (
        v_workspace_id,
        v_research_dept_id,
        'Research Lead',
        'lead',
        '#2196F3',
        'You are the Lead for the Research department. You manage web browsing, price watching, and data gathering. You can assign tasks to Research Workers. You use Browserbase for web automation.'
    );

    -- Create Research Worker
    INSERT INTO bots (workspace_id, department_id, name, role, avatar_color, instructions)
    VALUES (
        v_workspace_id,
        v_research_dept_id,
        'Research Bot',
        'worker',
        '#42A5F5',
        'You are a Research Worker. You browse the web, watch prices, and gather information using Browserbase sessions. You report findings to the Research Lead.'
    );

    -- Create Content Lead
    INSERT INTO bots (workspace_id, department_id, name, role, avatar_color, instructions)
    VALUES (
        v_workspace_id,
        v_content_dept_id,
        'Content Lead',
        'lead',
        '#9C27B0',
        'You are the Lead for the Content department. You manage writing, editing, and Slack notifications. You can assign tasks to Content Workers.'
    );

    -- Create Content Worker
    INSERT INTO bots (workspace_id, department_id, name, role, avatar_color, instructions)
    VALUES (
        v_workspace_id,
        v_content_dept_id,
        'Content Bot',
        'worker',
        '#AB47BC',
        'You are a Content Worker. You write articles, create Slack messages, and edit content. You use the Composio Slack toolkit for notifications.'
    );

    -- Create Engineering Lead
    INSERT INTO bots (workspace_id, department_id, name, role, avatar_color, instructions)
    VALUES (
        v_workspace_id,
        v_engineering_dept_id,
        'Engineering Lead',
        'lead',
        '#FF9800',
        'You are the Lead for the Engineering department. You manage code tasks, GitHub PRs, and sandbox execution. You can assign tasks to Engineering Workers. You use Browserbase for sandbox coding and GitHub for PRs.'
    );

    -- Create Engineering Worker
    INSERT INTO bots (workspace_id, department_id, name, role, avatar_color, instructions)
    VALUES (
        v_workspace_id,
        v_engineering_dept_id,
        'Engineering Bot',
        'worker',
        '#FFB74D',
        'You are an Engineering Worker. You write code in Browserbase sandboxes, run tests, and open GitHub PRs. You report to the Engineering Lead.'
    );

    -- Create default tool configs for Head (none - planning only)
    -- Tool configs will be added when user connects Composio accounts

    -- Create prompt versions for each bot
    INSERT INTO prompt_versions (bot_id, version, system_prompt, tool_config, context_injection, created_by, is_active)
    VALUES
        (v_head_bot_id, 1,
            'You are the Head Bot (Product Manager) for the Alpha team. You sit on the top floor and plan work for the entire team. You can assign tasks to any bot on any floor. You break down high-level goals into actionable tasks for Leads and Workers. You also manage the prompt library for all bots. Always think strategically about team priorities.',
            '{"tool_access": "none"}',
            ARRAY['workspace', 'department', 'recent_tasks', 'approval_history'],
            'system', TRUE);

    RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- BUDGET ENFORCEMENT FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION check_workspace_budget(p_workspace_id UUID, p_estimated_cost NUMERIC)
RETURNS BOOLEAN AS $$
DECLARE
    v_budget NUMERIC;
    v_spent NUMERIC;
    v_threshold NUMERIC;
    v_auto_pause BOOLEAN;
    v_projected_percent NUMERIC;
BEGIN
    SELECT monthly_budget_usd, budget_alert_thresholds, auto_pause_at_limit
    INTO v_budget, v_threshold, v_auto_pause
    FROM workspaces WHERE id = p_workspace_id;

    IF v_budget IS NULL OR v_budget <= 0 THEN
        RETURN TRUE; -- No budget limit
    END IF;

    SELECT COALESCE(SUM(total_cost_usd), 0)
    INTO v_spent
    FROM monthly_usage
    WHERE workspace_id = p_workspace_id
        AND month = DATE_TRUNC('month', CURRENT_DATE)::DATE;

    v_projected_percent := (v_spent + p_estimated_cost) / v_budget;

    IF v_projected_percent >= 1 AND v_auto_pause THEN
        RETURN FALSE; -- Would exceed budget
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RECORD USAGE FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION record_usage(
    p_workspace_id UUID,
    p_component TEXT,
    p_quantity NUMERIC,
    p_cost_usd NUMERIC,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO daily_usage (workspace_id, date, component, quantity, cost_usd, metadata)
    VALUES (p_workspace_id, CURRENT_DATE, p_component, p_quantity, p_cost_usd, p_metadata)
    ON CONFLICT (workspace_id, date, component)
    DO UPDATE SET
        quantity = daily_usage.quantity + EXCLUDED.quantity,
        cost_usd = daily_usage.cost_usd + EXCLUDED.cost_usd,
        metadata = daily_usage.metadata || EXCLUDED.metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- APPROVAL STATE MACHINE HELPER
-- =============================================================================

CREATE OR REPLACE FUNCTION transition_approval(
    p_approval_id UUID,
    p_new_status approval_status,
    p_actor_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS approvals AS $$
DECLARE
    v_approval approvals;
    v_old_status approval_status;
BEGIN
    SELECT status INTO v_old_status FROM approvals WHERE id = p_approval_id;

    -- Valid transitions
    IF NOT (
        (p_new_status IN ('approved', 'denied', 'expired', 'executing') AND p_new_status != v_old_status)
        OR (p_new_status IN ('completed', 'failed') AND v_old_status = 'executing')
        OR (p_new_status = 'pending' AND v_old_status = 'failed')
    ) THEN
        RAISE EXCEPTION 'Invalid approval transition from % to %', v_old_status, p_new_status;
    END IF;

    UPDATE approvals
    SET status = p_new_status,
        resolved_by = CASE WHEN p_new_status IN ('approved', 'denied') THEN p_actor_id ELSE resolved_by END,
        resolved_at = CASE WHEN p_new_status IN ('approved', 'denied') THEN NOW() ELSE resolved_at END,
        resolution_note = COALESCE(p_note, resolution_note),
        updated_at = NOW()
    WHERE id = p_approval_id
    RETURNING * INTO v_approval;

    RETURN v_approval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION create_workspace_with_defaults TO authenticated;
GRANT EXECUTE ON FUNCTION check_workspace_budget TO authenticated;
GRANT EXECUTE ON FUNCTION record_usage TO authenticated;
GRANT EXECUTE ON FUNCTION transition_approval TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_usage_views TO authenticated;