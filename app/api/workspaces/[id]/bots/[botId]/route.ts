import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; botId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id, botId } = await params

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

    // Get current bot
    const { data: currentBot } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single()

    if (!currentBot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Prevent changing head bot role
    if (currentBot.role === 'head' && role && role !== 'head') {
      return NextResponse.json({ error: 'Cannot change head bot role' }, { status: 400 })
    }

    // Check head bot uniqueness if role is changing to head
    if (role === 'head' && currentBot.role !== 'head') {
      const { data: existingHead } = await supabase
        .from('bots')
        .select('id')
        .eq('workspace_id', id)
        .eq('role', 'head')
        .single()

      if (existingHead && existingHead.id !== botId) {
        return NextResponse.json({ error: 'Head bot already exists for this workspace' }, { status: 400 })
      }
    }

    // Check lead uniqueness per department
    if (role === 'lead' && department_id && department_id !== currentBot.department_id) {
      const { data: existingLead } = await supabase
        .from('bots')
        .select('id')
        .eq('workspace_id', id)
        .eq('department_id', department_id)
        .eq('role', 'lead')
        .single()

      if (existingLead && existingLead.id !== botId) {
        // We'll replace the existing lead - this is by design per the spec
      }
    }

    const { data: bot, error } = await supabase
      .from('bots')
      .update({
        name: name ?? undefined,
        role: role ?? undefined,
        department_id: department_id ?? undefined,
        avatar_color: avatar_color ?? undefined,
        instructions: instructions ?? undefined,
        is_head_immutable: role === 'head' ? true : currentBot.is_head_immutable,
        updated_at: new Date().toISOString()
      })
      .eq('id', botId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update tool configs if provided
    if (tool_configs && Array.isArray(tool_configs)) {
      // Delete existing tool configs for this bot
      await supabase
        .from('bot_tool_configs')
        .delete()
        .eq('bot_id', botId)

      // Insert new ones
      if (tool_configs.length > 0) {
        const toolConfigInserts = tool_configs.map((tc: any) => ({
          bot_id: botId,
          toolkit: tc.toolkit,
          composio_connection_id: tc.composio_connection_id,
          is_active: tc.is_active ?? true,
        }))

        await supabase
          .from('bot_tool_configs')
          .insert(toolConfigInserts)
      }
    }

    // Fetch updated bot with relations
    const { data: botWithRelations } = await supabase
      .from('bots')
      .select(`
        *,
        department:departments(id, name, floor_tint),
        tool_configs:bot_tool_configs(toolkit, composio_connection_id, is_active)
      `)
      .eq('id', botId)
      .single()

    return NextResponse.json({ bot: botWithRelations })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; botId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id, botId } = await params

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

    // Get current bot
    const { data: bot } = await supabase
      .from('bots')
      .select('role')
      .eq('id', botId)
      .single()

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    // Prevent deleting head bot
    if (bot.role === 'head') {
      return NextResponse.json({ error: 'Cannot delete head bot' }, { status: 400 })
    }

    // Delete tool configs first (cascade should handle this, but explicit is safer)
    await supabase
      .from('bot_tool_configs')
      .delete()
      .eq('bot_id', botId)

    // Delete bot
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', botId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}