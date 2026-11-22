import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Check if user has a workspace, create one if not
      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)

      if (!memberships || memberships.length === 0) {
        // Create default workspace for new user
        await supabase.rpc('create_workspace_with_defaults', {
          p_name: "My Workspace",
          p_icon: "🏢",
          p_owner_id: user.id,
          p_free_llmapi_url: process.env.FREE_LLMAPI_URL || "http://localhost:5173/v1",
          p_free_llmapi_key: process.env.FREE_LLMAPI_KEY || "",
        })
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}