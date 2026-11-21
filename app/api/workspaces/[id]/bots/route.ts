import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await params

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
    }

    const { data: bots, error } = await supabase
      .from('bots')
      .select(`
        *,
        department:departments(id, name, floor_tint),
        tool_configs:bot_tool_configs(toolkit, composio_connection_id, is_active)
      `)
      .eq('workspace_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ bots })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await params

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is owner/admin
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', user.id)
      .single()

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      role,
      department_id,
      avatar_color,
      instructions,
      tool_configs
    } = body

    if (!name || !role || !department_id) {
      return NextResponse.json({ error: 'Name, role, and department are required' }, { status: 400 })
    }

    // Check head bot uniqueness
    if (role === 'head') {
      const { data: existingHead } = await supabase
        .from('bots')
        .select('id')
        .eq('workspace_id', id)
        .eq('role', 'head')
        .single()

      if (existingHead) {
        return NextResponse.json({ error: 'Head bot already exists for this workspace' }, { status: 400 })
      }
    }

    // Check lead uniqueness per department
    if (role === 'lead') {
      const { data: existingLead } = await supabase
        .from('bots')
        .select('id')
        .eq('workspace_id', id)
        .eq('department_id', department_id)
        .eq('role', 'lead')
        .single()

      if (existingLead) {
        // We'll replace the existing lead - this is by design per the spec
      }
    }

    const { data: bot, error } = await supabase
      .from('bots')
      .insert({
        workspace_id: id,
        department_id,
        name,
        role,
        avatar_color: avatar_color || '#6366F1',
        instructions: instructions || '',
        is_head_immutable: role === 'head',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create tool configs if provided
    if (tool_configs && Array.isArray(tool_configs) && tool_configs.length > 0) {
      const toolConfigInserts = tool_configs.map((tc: any) => ({
        bot_id: bot.id,
        toolkit: tc.toolkit,
        composio_connection_id: tc.composio_connection_id,
        is_active: tc.is_active ?? true,
      }))

      await supabase
        .from('bot_tool_configs')
        .insert(toolConfigInserts)
    }

    // Fetch the created bot with relations
    const { data: botWithRelations } = await supabase
      .from('bots')
      .select(`
        *,
        department:departments(id, name, floor_tint),
        tool_configs:bot_tool_configs(toolkit, composio_connection_id, is_active)
      `)
      .eq('id', bot.id)
      .single()

    return NextResponse.json({ bot: botWithRelations })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}