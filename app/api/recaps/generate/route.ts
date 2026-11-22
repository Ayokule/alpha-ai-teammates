import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { freeLlmProvider } from "@/lib/llm/gateway"
import { streamText } from "ai"

interface Task {
  id: string
  bot_id: string
  status: string
  payload: Record<string, any>
  result?: Record<string, any>
  bot?: {
    department?: { id: string; name: string }
  }
}

interface Approval {
  id: string
  bot_id: string
  status: string
  action_type: string
  action_preview: string
  bot?: {
    department?: { id: string; name: string }
  }
}

interface Message {
  thread?: {
    bot?: {
      department?: { id: string; name: string }
    }
  }
}

interface Department {
  id: string
  name: string
}

interface DeptActivity {
  name: string
  tasksCompleted: number
  tasksFailed: number
  approvalsPending: number
  approvalsApproved: number
  approvalsDenied: number
  messagesCount: number
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Allow service role key for cron jobs
    const authHeader = request.headers.get("authorization")
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const isCronJob = authHeader === `Bearer ${serviceRoleKey}`

    const body = await request.json()
    const { workspaceId, periodStart, periodEnd } = body

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 })
    }

    if (!user && !isCronJob) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify workspace access (skip for cron jobs)
    if (!isCronJob) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user!.id)
        .single()

      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const start = periodStart ? new Date(periodStart) : new Date(Date.now() - 24 * 60 * 60 * 1000)
    const end = periodEnd ? new Date(periodEnd) : new Date()

    // Fetch all activity for the period
    const [
      { data: tasks },
      { data: approvals },
      { data: messages },
      { data: departments },
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, bot:bots(name, role, department:departments(name))")
        .eq("workspace_id", workspaceId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase
        .from("approvals")
        .select("*, bot:bots(name, role, department:departments(name))")
        .eq("workspace_id", workspaceId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase
        .from("messages")
        .select("*, thread:threads(bot:bots(name, role))")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase
        .from("departments")
        .select("id, name")
        .eq("workspace_id", workspaceId),
    ])

    // Aggregate by department
    const deptActivity = new Map<string, DeptActivity>()

    departments?.forEach((d: Department) => {
      deptActivity.set(d.id, { name: d.name, tasksCompleted: 0, tasksFailed: 0, approvalsPending: 0, approvalsApproved: 0, approvalsDenied: 0, messagesCount: 0 })
    })

    tasks?.forEach((t: Task) => {
      const deptId = t.bot?.department?.id
      if (deptId && deptActivity.has(deptId)) {
        const activity = deptActivity.get(deptId)!
        if (t.status === "completed") activity.tasksCompleted++
        if (t.status === "failed") activity.tasksFailed++
      }
    })

    approvals?.forEach((a: Approval) => {
      const deptId = a.bot?.department?.id
      if (deptId && deptActivity.has(deptId)) {
        const activity = deptActivity.get(deptId)!
        if (a.status === "pending") activity.approvalsPending++
        if (a.status === "approved") activity.approvalsApproved++
        if (a.status === "denied") activity.approvalsDenied++
      }
    })

    messages?.forEach((m: Message) => {
      const deptId = m.thread?.bot?.department?.id
      if (deptId && deptActivity.has(deptId)) {
        const activity = deptActivity.get(deptId)!
        activity.messagesCount++
      }
    })

    // Build prompt for LLM
    const activitySummary = Array.from(deptActivity.entries()).map(([id, act]) => `
Department: ${act.name}
- Tasks Completed: ${act.tasksCompleted}
- Tasks Failed: ${act.tasksFailed}
- Approvals Approved: ${act.approvalsApproved}
- Approvals Denied: ${act.approvalsDenied}
- Approvals Pending: ${act.approvalsPending}
- Messages: ${act.messagesCount}
`).join("\n")

    const prompt = `Generate a concise morning recap for an AI team manager.
Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}

Activity by department:
${activitySummary}

Write a friendly "while you slept" narrative summary (2-3 paragraphs) highlighting:
1. Key accomplishments per department
2. Any blockers or pending approvals
3. Overall team health

Keep it concise and actionable. Include a TL;DR at the top.`

    const model = freeLlmProvider.chat("head")
    const result = await streamText({
      model: model as any,
      system: "You are an executive assistant writing morning briefings for a busy founder.",
      messages: [{ role: "user", content: prompt }],
      maxSteps: 1,
    })

    const narrative = await result.text

    // Create recap record
    const { data: recap, error: recapError } = await supabase
      .from("recaps")
      .insert({
        workspace_id: workspaceId,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        narrative,
        metadata: {
          deptActivity: Object.fromEntries(deptActivity),
          totalTasks: tasks?.length || 0,
          totalApprovals: approvals?.length || 0,
        },
      })
      .select()
      .single()

    if (recapError) throw recapError

    // Create recap items for interactive elements
    const recapItems: Array<{
      recap_id: string
      bot_id: string
      department_id: string | null
      type: string
      title: string
      description: string | null
      action_data: Record<string, any>
    }> = []

    // Add completed tasks as items
    tasks?.filter((t: Task) => t.status === "completed").forEach((t: Task) => {
      recapItems.push({
        recap_id: recap.id,
        bot_id: t.bot_id,
        department_id: t.bot?.department?.id ?? null,
        type: "task_completed",
        title: `Task completed: ${t.payload?.description || "Task"}`,
        description: t.result?.response?.substring(0, 200) ?? null,
        action_data: { taskId: t.id, type: "view_task" },
      })
    })

    // Add pending approvals
    approvals?.filter((a: Approval) => a.status === "pending").forEach((a: Approval) => {
      recapItems.push({
        recap_id: recap.id,
        bot_id: a.bot_id,
        department_id: a.bot?.department?.id ?? null,
        type: "approval_pending",
        title: `Approval needed: ${a.action_type.replace(/_/g, " ")}`,
        description: a.action_preview,
        action_data: { approvalId: a.id, type: "view_approval" },
      })
    })

    if (recapItems.length > 0) {
      await supabase.from("recap_items").insert(recapItems)
    }

    return NextResponse.json({ recap, narrative })
  } catch (error) {
    console.error("Recap generation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}