import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get("workspace_id")

    if (!workspaceId) {
      return NextResponse.json({ error: "workspace_id required" }, { status: 400 })
    }

    // Verify user is member
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: members, error } = await supabase
      .from("workspace_members")
      .select(`
        id,
        role,
        joined_at,
        user:users(id, email, raw_user_meta_data, created_at)
      `)
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true })

    if (error) throw error

    return NextResponse.json({ members: members || [] })
  } catch (error) {
    console.error("Get members error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, member_id, role } = body

    if (!workspace_id || !member_id || !role) {
      return NextResponse.json({ error: "workspace_id, member_id, and role required" }, { status: 400 })
    }

    if (!["member", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Verify current user is owner/admin
    const { data: currentMembership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single()

    if (!currentMembership || !["owner", "admin"].includes(currentMembership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Can't change owner role
    const { data: targetMember } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("id", member_id)
      .eq("workspace_id", workspace_id)
      .single()

    if (targetMember?.role === "owner") {
      return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 })
    }

    // Owner can promote to admin, admin can only demote to member
    if (currentMembership.role === "admin" && role === "admin") {
      return NextResponse.json({ error: "Admins cannot promote to admin" }, { status: 403 })
    }

    const { error } = await supabase
      .from("workspace_members")
      .update({ role })
      .eq("id", member_id)
      .eq("workspace_id", workspace_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update member role error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get("workspace_id")
    const memberId = searchParams.get("member_id")

    if (!workspaceId || !memberId) {
      return NextResponse.json({ error: "workspace_id and member_id required" }, { status: 400 })
    }

    // Verify current user is owner/admin
    const { data: currentMembership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single()

    if (!currentMembership || !["owner", "admin"].includes(currentMembership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Can't remove owner
    const { data: targetMember } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .single()

    if (targetMember?.role === "owner") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 })
    }

    // Admin can only remove members
    if (currentMembership.role === "admin" && targetMember?.role === "admin") {
      return NextResponse.json({ error: "Admins cannot remove other admins" }, { status: 403 })
    }

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Remove member error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}