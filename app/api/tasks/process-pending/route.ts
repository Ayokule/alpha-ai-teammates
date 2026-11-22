import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Allow service role key for cron jobs
    const authHeader = request.headers.get("authorization")
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const isCronJob = authHeader === `Bearer ${serviceRoleKey}`

    if (!user && !isCronJob) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find pending tasks that need processing
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .limit(50)

    if (error) throw error

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ processed: 0, message: "No pending tasks" })
    }

    // Update tasks to in_progress
    const taskIds = tasks.map(t => t.id)
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .in("id", taskIds)

    if (updateError) throw updateError

    // For now, just return the tasks to be processed by worker
    // In production, this would publish to QStash or similar queue
    return NextResponse.json({
      processed: tasks.length,
      taskIds,
      message: "Tasks marked for processing"
    })
  } catch (error) {
    console.error("Process pending tasks error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}