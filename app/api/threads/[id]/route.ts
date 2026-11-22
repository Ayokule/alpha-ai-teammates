import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get thread with workspace access check
    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .select(`
        *,
        workspace:workspaces!inner(
          workspace_members!inner(user_id)
        )
      `)
      .eq("id", id)
      .eq("workspace.workspace_members.user_id", user.id)
      .single()

    if (threadError || !thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", id)
      .order("created_at", { ascending: true })

    if (messagesError) throw messagesError

    return NextResponse.json({ messages: messages || [] })
  } catch (error) {
    console.error("Thread API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}