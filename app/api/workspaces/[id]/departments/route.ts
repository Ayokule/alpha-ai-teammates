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

    const { data: departments, error } = await supabase
      .from('departments')
      .select(`
        *,
        bots (id, name, role, avatar_color, is_head_immutable)
      `)
      .eq('workspace_id', id)
      .order('display_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ departments })
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
    const { name, floor_tint } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Get the next display order
    const { data: maxOrder } = await supabase
      .from('departments')
      .select('display_order')
      .eq('workspace_id', id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (maxOrder?.display_order ?? -1) + 1

    const { data: department, error } = await supabase
      .from('departments')
      .insert({
        workspace_id: id,
        name,
        floor_tint: floor_tint || '#F5F0E8',
        display_order: nextOrder,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ department })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}