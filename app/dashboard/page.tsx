"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { DepartmentList } from "@/components/Departments/DepartmentList"
import { Department } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DashboardPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string>("")
  const [activeTab, setActiveTab] = useState("departments")

  const supabase = createClient()

  useEffect(() => {
    loadWorkspace()
  }, [])

  const loadWorkspace = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = "/login"
        return
      }

      // Get user's first workspace
      const { data: workspaces } = await supabase
        .from("workspaces")
        .select("id")
        .eq("workspace_members.user_id", user.id)
        .limit(1)

      if (workspaces && workspaces.length > 0) {
        setWorkspaceId(workspaces[0].id)
        loadDepartments(workspaces[0].id)
      }
    } catch (error) {
      console.error("Error loading workspace:", error)
    }
  }

  const loadDepartments = async (wsId: string) => {
    setLoading(true)
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
    } finally {
      setLoading(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Alpha Dashboard</h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => window.location.href = "/api/auth/signout"}>
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
            <Card>
              <CardHeader>
                <CardTitle>Bots Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Bot management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}