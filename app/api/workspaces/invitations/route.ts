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
    const { email, workspace_id, role = "member" } = body

    if (!email || !workspace_id) {
      return NextResponse.json({ error: "Email and workspace_id are required" }, { status: 400 })
    }

    // Verify user is owner/admin of workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single()

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!["member", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email)

    let invitedUserId = existingUser?.user?.id

    // Check if already a member
    if (invitedUserId) {
      const { data: existingMember } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", invitedUserId)
        .single()

      if (existingMember) {
        return NextResponse.json({ error: "User is already a member" }, { status: 400 })
      }
    }

    // Create invitation token
    const invitationToken = uuidv4()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Store invitation
    const { error: inviteError } = await supabase
      .from("workspace_invitations")
      .insert({
        workspace_id,
        email,
        role,
        token: invitationToken,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })

    if (inviteError) throw inviteError

    // Send invitation email (in production, use email service)
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation?token=${invitationToken}`

    // Log for now - replace with actual email service
    console.log(`Invitation sent to ${email}: ${inviteUrl}`)

    return NextResponse.json({
      invitation: { email, role, expires_at: expiresAt.toISOString() },
      invite_url: inviteUrl // For testing - remove in production
    })
  } catch (error) {
    console.error("Invitation error:", error)
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
    const workspaceId = searchParams.get("workspace_id")

    if (!workspaceId) {
      return NextResponse.json({ error: "workspace_id required" }, { status: 400 })
    }

    // Verify user is owner/admin
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single()

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: invitations, error } = await supabase
      .from("workspace_invitations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ invitations: invitations || [] })
  } catch (error) {
    console.error("Get invitations error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}