import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
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
    const body = await request.json()
    const { status, resolution_note } = body

    if (!["approved", "denied"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Get approval with workspace access check
    const { data: approval, error: approvalError } = await supabase
      .from("approvals")
      .select(`
        *,
        workspace:workspaces!inner(
          workspace_members!inner(user_id)
        )
      `)
      .eq("id", id)
      .eq("workspace.workspace_members.user_id", user.id)
      .single()

    if (approvalError || !approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 })
    }

    if (approval.status !== "pending") {
      return NextResponse.json({ error: "Approval already resolved" }, { status: 400 })
    }

    // Use the state machine function
    const { data: updatedApproval, error: transitionError } = await supabase
      .rpc("transition_approval", {
        p_approval_id: id,
        p_new_status: status,
        p_actor_id: user.id,
        p_note: resolution_note,
      })

    if (transitionError) {
      console.error("Approval transition error:", transitionError)
      return NextResponse.json({ error: transitionError.message }, { status: 400 })
    }

    // If approved and blocking, the bot will pick it up via realtime
    // For non-blocking, we just record the approval

    return NextResponse.json({ approval: updatedApproval })
  } catch (error) {
    console.error("Approval PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    // Get approval with workspace access check
    const { data: approval, error: approvalError } = await supabase
      .from("approvals")
      .select(`
        *,
        bot:bots(
          id, name, role, avatar_color, department:departments(name)
        ),
        task:tasks(payload)
      `)
      .eq("id", id)
      .single()

    if (approvalError || !approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 })
    }

    // Verify workspace access
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", approval.workspace_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ approval })
  } catch (error) {
    console.error("Approval GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}