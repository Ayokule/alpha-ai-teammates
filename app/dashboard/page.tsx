"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DepartmentList } from "@/components/Departments/DepartmentList"
import { BotList } from "@/components/Bots/BotList"
import { Department } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus } from "lucide-react"

export default function DashboardPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string>("")
  const [activeTab, setActiveTab] = useState("departments")
  const [error, setError] = useState<string | null>(null)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  // Define loadDepartments first to avoid temporal dead zone
  const loadDepartments = useCallback(async (wsId: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from("departments")
        .select(`
          *,
          bots (id, name, role, avatar_color, is_head_immutable)
        `)
        .eq("workspace_id", wsId)
        .order("display_order", { ascending: true })

      if (error) throw error
      setDepartments(data || [])
    } catch (error) {
      console.error("Error loading departments:", error)
      setError(error instanceof Error ? error.message : "Failed to load departments")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Define loadWorkspace before useEffect to avoid hoisting issues
  const loadWorkspace = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      // Get user's first workspace
      const { data: memberships, error: wsError } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)

      if (wsError) {
        throw new Error(`Workspace query failed: ${wsError.message}`)
      }

      if (!memberships || memberships.length === 0) {
        // No workspace - show create workspace option
        setShowCreateWorkspace(true)
        setLoading(false)
        return
      }

      const workspaceId = memberships[0].workspace_id
      setWorkspaceId(workspaceId)
      await loadDepartments(workspaceId)
    } catch (error) {
      console.error("Error loading workspace:", error)
      setError(error instanceof Error ? error.message : "Failed to load workspace")
      setLoading(false)
      return
    }
  }, [supabase, router, loadDepartments])

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  const handleCreateWorkspace = async () => {
    setCreatingWorkspace(true)
    try {
      const response = await fetch(`${window.location.origin}/api/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: "My Workspace",
          icon: "🏢",
          free_llmapi_url: process.env.NEXT_PUBLIC_FREE_LLMAPI_URL || "http://localhost:5173/v1",
          free_llmapi_key: process.env.NEXT_PUBLIC_FREE_LLMAPI_KEY || "",
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create workspace")
      }

      const { workspace } = await response.json()
      setWorkspaceId(workspace.id)
      setShowCreateWorkspace(false)
      await loadDepartments(workspace.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace")
    } finally {
      setCreatingWorkspace(false)
    }
  }

  const handleCreateDepartment = async (data: { name: string; floor_tint: string }) => {
    const { data: department, error } = await supabase
      .from("departments")
      .insert({ workspace_id: workspaceId, ...data })
      .select()
      .single()

    if (error) throw error
    setDepartments(prev => [...prev, { ...department, bots: [] }].sort((a, b) => a.display_order - b.display_order))
  }

  const handleUpdateDepartment = async (deptId: string, data: { name: string; floor_tint: string }) => {
    const { error } = await supabase
      .from("departments")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", deptId)

    if (error) throw error
    setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, ...data } : d))
  }

  const handleReorderDepartment = async (deptId: string, newOrder: number) => {
    const { data: currentDept } = await supabase
      .from("departments")
      .select("display_order")
      .eq("id", deptId)
      .single()

    if (!currentDept) return

    const oldOrder = currentDept.display_order
    const newOrderClamped = Math.max(0, Math.min(newOrder, departments.length - 1))

    if (oldOrder === newOrderClamped) return

    // Shift other departments
    if (oldOrder < newOrderClamped) {
      await supabase
        .from("departments")
        .update((dept: Department) => ({ display_order: dept.display_order - 1 }))
        .eq("workspace_id", workspaceId)
        .gt("display_order", oldOrder)
        .lte("display_order", newOrderClamped)
    } else {
      await supabase
        .from("departments")
        .update((dept: Department) => ({ display_order: dept.display_order + 1 }))
        .eq("workspace_id", workspaceId)
        .gte("display_order", newOrderClamped)
        .lt("display_order", oldOrder)
    }

    await supabase
      .from("departments")
      .update({ display_order: newOrderClamped, updated_at: new Date().toISOString() })
      .eq("id", deptId)

    loadDepartments(workspaceId)
  }

  const handleDeleteDepartment = async (deptId: string, moveBotsTo?: string) => {
    // Check for bots in this department
    const { data: bots } = await supabase
      .from("bots")
      .select("id, role")
      .eq("department_id", deptId)

    if (bots && bots.length > 0 && !moveBotsTo) {
      throw new Error("Department has bots. Please move them first.")
    }

    // Move bots if specified
    if (moveBotsTo && bots && bots.length > 0) {
      await supabase
        .from("bots")
        .update({ department_id: moveBotsTo })
        .eq("department_id", deptId)
    }

    // Get display order before deleting
    const { data: dept } = await supabase
      .from("departments")
      .select("display_order")
      .eq("id", deptId)
      .single()

    // Delete department
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", deptId)

    if (error) throw error

    // Shift remaining departments
    if (dept) {
      await supabase
        .from("departments")
        .update((d: Department) => ({ display_order: d.display_order - 1 }))
        .eq("workspace_id", workspaceId)
        .gt("display_order", dept.display_order)
    }

    loadDepartments(workspaceId)
  }

  const handleCreateBot = async (data: any) => {
    const { data: bot, error } = await supabase
      .from("bots")
      .insert({ workspace_id: workspaceId, ...data })
      .select()
      .single()

    if (error) throw error
    // Refresh departments to include new bot
    loadDepartments(workspaceId)
  }

  const handleUpdateBot = async (botId: string, data: any) => {
    const { error } = await supabase
      .from("bots")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", botId)

    if (error) throw error
    loadDepartments(workspaceId)
  }

  const handleDeleteBot = async (botId: string) => {
    const { error } = await supabase
      .from("bots")
      .delete()
      .eq("id", botId)

    if (error) throw error
    loadDepartments(workspaceId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">Failed to load dashboard</h3>
            <AlertDescription>{error}</AlertDescription>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  if (showCreateWorkspace) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome to Alpha</CardTitle>
            <CardDescription>
              Create your first workspace to get started with AI teammates
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              className="w-full"
              size="lg"
              onClick={handleCreateWorkspace}
              disabled={creatingWorkspace}
            >
              {creatingWorkspace ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  Creating workspace...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create My Workspace
                </span>
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground mt-4">
              This will create a workspace with 4 starter departments (Assistant, Research, Content, Engineering)
              and 9 AI bots ready to work.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!workspaceId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Alpha Dashboard</h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="bots">Bots</TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <DepartmentList
              departments={departments}
              workspaceId={workspaceId}
              onCreate={handleCreateDepartment}
              onUpdate={handleUpdateDepartment}
              onReorder={handleReorderDepartment}
              onDelete={handleDeleteDepartment}
              isLoading={loading}
            />
          </TabsContent>

          <TabsContent value="bots">
            <BotList
              departments={departments}
              workspaceId={workspaceId}
              onCreate={handleCreateBot}
              onUpdate={handleUpdateBot}
              onDelete={handleDeleteBot}
              isLoading={loading}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}