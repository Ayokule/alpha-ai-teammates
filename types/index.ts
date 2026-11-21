/**
 * Type definitions for Alpha AI Teammates
 */

export interface Workspace {
  id: string
  name: string
  icon: string | null
  owner_id: string
  monthly_budget_usd: number
  budget_alert_thresholds: number[]
  auto_pause_at_limit: boolean
  free_llmapi_url: string | null
  free_llmapi_key: string | null
  plan_tier: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface Department {
  id: string
  workspace_id: string
  name: string
  floor_tint: string
  display_order: number
  created_at: string
  updated_at: string
  bots?: Bot[]
}

export type BotRole = 'head' | 'lead' | 'worker'

export interface Bot {
  id: string
  workspace_id: string
  department_id: string | null
  name: string
  role: BotRole
  avatar_color: string
  instructions: string
  monthly_budget_usd: number
  budget_alert_threshold: number
  free_llmapi_url: string | null
  free_llmapi_key: string | null
  is_head_immutable: boolean
  created_at: string
  updated_at: string
  department?: Department
  tool_configs?: BotToolConfig[]
}

export interface BotToolConfig {
  id: string
  bot_id: string
  toolkit: string
  composio_connection_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Thread {
  id: string
  workspace_id: string
  bot_id: string
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export type MessageRole = 'user' | 'assistant' | 'bot' | 'system'

export interface Message {
  id: string
  thread_id: string
  user_id: string | null
  role: MessageRole
  content: string
  metadata: Record<string, any>
  created_at: string
}

export type TaskSource = 'user_chat' | 'delegation' | 'scheduled' | 'approval_callback' | 'head_plan'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'queued' | 'cancelled'
export type TaskPriority = 'urgent' | 'scheduled' | 'background'

export interface Task {
  id: string
  workspace_id: string
  bot_id: string
  source: TaskSource
  priority: TaskPriority
  status: TaskStatus
  payload: Record<string, any>
  result: Record<string, any> | null
  error: string | null
  idempotency_key: string
  max_retries: number
  timeout_ms: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type ApprovalActionType =
  | 'send_email'
  | 'send_slack'
  | 'publish_content'
  | 'create_pr'
  | 'merge_pr'
  | 'delete_resource'
  | 'make_payment'
  | 'composio_oauth'
  | 'browserbase_action'
  | 'grant_tool_access'
  | 'reassign_task'

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'executing' | 'completed' | 'failed'

export interface Approval {
  id: string
  workspace_id: string
  bot_id: string | null
  task_id: string | null
  action_type: ApprovalActionType
  action_payload: Record<string, any>
  action_preview: string
  is_blocking: boolean
  status: ApprovalStatus
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  idempotency_key: string
  external_trigger_token: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export interface Recap {
  id: string
  workspace_id: string
  period_start: string
  period_end: string
  summary: string | null
  narrative: string | null
  metadata: Record<string, any>
  sent_at: string | null
  created_at: string
}

export interface RecapItem {
  id: string
  recap_id: string
  bot_id: string | null
  department_id: string | null
  type: string
  title: string
  description: string | null
  action_data: Record<string, any> | null
  metadata: Record<string, any>
  created_at: string
}

export interface ComposioConnection {
  id: string
  workspace_id: string
  bot_id: string | null
  toolkit: string
  composio_connection_id: string
  is_active: boolean
  scopes: string[] | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface DailyUsage {
  id: string
  workspace_id: string
  date: string
  component: 'ai_gateway' | 'browserbase' | 'composio' | 'qstash' | 'redis' | 'vercel' | 'supabase'
  quantity: number
  cost_usd: number
  metadata: Record<string, any>
}

export interface PromptVersion {
  id: string
  bot_id: string
  version: number
  system_prompt: string
  tool_config: Record<string, any>
  context_injection: string[]
  created_by: 'head_bot' | 'user' | 'system'
  eval_score: number | null
  is_active: boolean
  created_at: string
}

export interface PromptProposal {
  id: string
  head_task_id: string | null
  bot_id: string
  proposed_prompt: Record<string, any>
  test_cases: Record<string, any>
  eval_result: Record<string, any> | null
  status: 'pending' | 'evaluating' | 'approved' | 'rejected'
  created_at: string
}