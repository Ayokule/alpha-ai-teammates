-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Unschedule old jobs
SELECT cron.unschedule('daily-morning-recap');
SELECT cron.unschedule('cleanup-browserbase-sessions');
SELECT cron.unschedule('cleanup-expired-approvals');
SELECT cron.unschedule('process-pending-tasks');
SELECT cron.unschedule('cleanup-budget-queued');
SELECT cron.unschedule('refresh-usage-views');

-- 1. Daily Morning Recap at 7:00 AM UTC
SELECT cron.schedule(
  'daily-morning-recap',
  '0 7 * * *',
  $$
  DO $$
  DECLARE
    ws RECORD;
  BEGIN
    FOR ws IN SELECT id FROM workspaces WHERE monthly_budget_usd > 0 LOOP
      PERFORM net.http_post(
        url := 'https://alpha-ai-teammates.vercel.app/api/recaps/generate',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object('workspaceId', ws.id)
      );
    END LOOP;
  END $$;
  $$
);

-- 2. Cleanup expired browserbase sessions daily at 3:00 AM UTC
SELECT cron.schedule(
  'cleanup-browserbase-sessions',
  '0 3 * * *',
  $$
  UPDATE browserbase_sessions
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND status IN ('initializing', 'running');
  $$
);

-- 3. Cleanup expired approvals every hour
SELECT cron.schedule(
  'cleanup-expired-approvals',
  '0 * * * *',
  $$
  UPDATE approvals
  SET status = 'expired'
  WHERE expires_at < NOW()
    AND status = 'pending';
  $$
);

-- 4. Process pending tasks every 5 minutes
SELECT cron.schedule(
  'process-pending-tasks',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://alpha-ai-teammates.vercel.app/api/tasks/process-pending',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'
  );
  $$
);

-- 5. Cleanup expired budget-queued tasks daily at 4 AM
SELECT cron.schedule(
  'cleanup-budget-queued',
  '0 4 * * *',
  $$
  UPDATE budget_queued_tasks
  SET status = 'failed'
  WHERE status = 'queued'
    AND retry_after < NOW();
  $$
);

-- 6. Refresh materialized views daily at 2 AM
SELECT cron.schedule(
  'refresh-usage-views',
  '0 2 * * *',
  $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY queue_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_usage;
  REFRESH MATERIALIZED VIEW CONCURRENTLY bot_monthly_usage;
  $$
);

-- Verify
SELECT jobid, jobname, schedule, active FROM cron.job
WHERE jobname IN (
  'daily-morning-recap',
  'cleanup-browserbase-sessions',
  'cleanup-expired-approvals',
  'process-pending-tasks',
  'cleanup-budget-queued',
  'refresh-usage-views'
);