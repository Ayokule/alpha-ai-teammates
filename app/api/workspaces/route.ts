import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, icon, free_llmapi_url, free_llmapi_key } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Call the database function to create workspace with defaults
    const { data: workspaceId, error } = await supabase.rpc('create_workspace_with_defaults', {
      p_name: name,
      p_icon: icon || '🏢',
      p_owner_id: user.id,
      p_free_llmapi_url: free_llmapi_url,
      p_free_llmapi_key: free_llmapi_key,
    })

    if (error) {
      console.error('Workspace creation error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch the created workspace
    const { data: workspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    return NextResponse.json({ workspace })
  } catch (error) {
    console.error('Workspace creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select(`
        *,
        workspace_members!inner(role)
      `)
      .eq('workspace_members.user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ workspaces })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}