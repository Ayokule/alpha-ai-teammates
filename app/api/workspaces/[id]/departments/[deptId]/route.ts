import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deptId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id, deptId } = await params

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
    const { name, floor_tint, display_order, action } = body

    // Handle reorder action
    if (action === 'reorder' && typeof display_order === 'number') {
      const { data: currentDept } = await supabase
        .from('departments')
        .select('display_order')
        .eq('id', deptId)
        .single()

      if (!currentDept) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 })
      }

      const oldOrder = currentDept.display_order
      const newOrder = display_order

      if (oldOrder === newOrder) {
        return NextResponse.json({ success: true })
      }

      // Shift other departments
      if (oldOrder < newOrder) {
        // Moving down: shift departments between old and new up by 1
        await supabase
          .from('departments')
          .update({ display_order: display_order - 1 })
          .eq('workspace_id', id)
          .gt('display_order', oldOrder)
          .lte('display_order', newOrder)
      } else {
        // Moving up: shift departments between new and old down by 1
        await supabase
          .from('departments')
          .update({ display_order: display_order + 1 })
          .eq('workspace_id', id)
          .gte('display_order', newOrder)
          .lt('display_order', oldOrder)
      }

      const { data: department, error } = await supabase
        .from('departments')
        .update({ display_order: newOrder, updated_at: new Date().toISOString() })
        .eq('id', deptId)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ department })
    }

    // Regular update (name, floor_tint)
    const { data: department, error } = await supabase
      .from('departments')
      .update({
        name: name ?? undefined,
        floor_tint: floor_tint ?? undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', deptId)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deptId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id, deptId } = await params

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

    // Get department info first
    const { data: dept } = await supabase
      .from('departments')
      .select('display_order')
      .eq('id', deptId)
      .single()

    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    // Check for bots in this department
    const { data: bots } = await supabase
      .from('bots')
      .select('id, role')
      .eq('department_id', deptId)

    if (bots && bots.length > 0) {
      // Return bots that need to be moved
      return NextResponse.json({
        error: 'Department has bots',
        bots,
        requiresAction: true
      }, { status: 400 })
    }

    // Delete department
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', deptId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Shift remaining departments down
    await supabase
      .from('departments')
      .update({ display_order: dept.display_order - 1 })
      .eq('workspace_id', id)
      .gt('display_order', dept.display_order)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}