import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { botId, workspaceId, payload, priority = "scheduled", source = "delegation" } = body

    if (!botId || !workspaceId || !payload) {
      return NextResponse.json({ error: "botId, workspaceId, and payload are required" }, { status: 400 })
    }

    // Verify bot exists and user has access
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single()

    if (botError || !bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check budget before creating task
    const { data: budgetOk } = await supabase
      .rpc("check_workspace_budget", { p_workspace_id: workspaceId, p_estimated_cost: 0.01 })

    if (!budgetOk) {
      return NextResponse.json({ error: "Workspace budget exceeded" }, { status: 402 })
    }

    // Create task
    const idempotencyKey = uuidv4()
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        workspace_id: workspaceId,
        bot_id: botId,
        source,
        priority,
        status: "pending",
        payload,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single()

    if (error) throw error

    // Publish to QStash queue
    try {
      const qstashUrl = process.env.QSTASH_URL || "https://qstash.upstash.io/v2/publish"
      const qstashToken = process.env.QSTASH_TOKEN

      if (qstashToken) {
        await fetch(`${qstashUrl}/tasks/${task.id}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${qstashToken}`,
            "Content-Type": "application/json",
            "Upstash-Queue": priority,
          },
          body: JSON.stringify({
            taskId: task.id,
            botId: task.bot_id,
            workspaceId: task.workspace_id,
            payload: task.payload,
          }),
        })
      }
    } catch (queueError) {
      console.error("Failed to publish to queue:", queueError)
      // Don't fail the request - task is in DB
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error("Task creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get("workspaceId")
    const botId = searchParams.get("botId")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 })
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (botId) query = query.eq("bot_id", botId)
    if (status) query = query.eq("status", status)

    const { data: tasks, error } = await query

    if (error) throw error

    return NextResponse.json({ tasks: tasks || [] })
  } catch (error) {
    console.error("Tasks fetch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}