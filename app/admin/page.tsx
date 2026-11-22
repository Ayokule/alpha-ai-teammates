"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Users, Bot, DollarSign, CreditCard, Shield, Trash2, FileText } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

interface AdminStats {
  totalMembers: number
  totalBots: number
  pendingApprovals: number
  monthlySpend: number
  budgetLimit: number
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("members")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string>("")
  const [members, setMembers] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalBots: 0,
    pendingApprovals: 0,
    monthlySpend: 0,
    budgetLimit: 50,
  })
  const [updatingMember, setUpdatingMember] = useState<string | null>(null)

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

      const { data: memberships, error: wsError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .limit(1)

      if (wsError) throw wsError

      if (!memberships || memberships.length === 0) {
        window.location.href = "/dashboard"
        return
      }

      const wsId = memberships[0].workspace_id
      const userRole = memberships[0].role
      setWorkspaceId(wsId)
      await loadData(wsId, userRole)
    } catch (err) {
      console.error("Error loading workspace:", err)
      setError(err instanceof Error ? err.message : "Failed to load workspace")
      setLoading(false)
    }
  }

  const loadData = async (wsId: string, userRole: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data: membersData, error: membersError } = await supabase
        .from("workspace_members")
        .select(`
          id,
          role,
          joined_at,
          user:users(id, email, raw_user_meta_data, created_at)
        `)
        .eq("workspace_id", wsId)
        .order("joined_at", { ascending: true })

      if (membersError) throw membersError
      setMembers(membersData || [])

      const [botsRes, approvalsRes, spendRes] = await Promise.all([
        supabase.from("bots").select("id", { count: "exact" }).eq("workspace_id", wsId),
        supabase.from("approvals").select("id", { count: "exact" }).eq("workspace_id", wsId).eq("status", "pending"),
        supabase.from("daily_usage").select("cost_usd").eq("workspace_id", wsId).gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ])

      const totalBots = botsRes.count || 0
      const pendingApprovals = approvalsRes.count || 0
      const monthlySpend = spendRes.data?.reduce((sum, d) => sum + (d.cost_usd || 0), 0) || 0

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("monthly_budget_usd")
        .eq("id", wsId)
        .single()

      setStats({
        totalMembers: membersData?.length || 0,
        totalBots,
        pendingApprovals,
        monthlySpend,
        budgetLimit: workspace?.monthly_budget_usd || 50,
      })
    } catch (err) {
      console.error("Error loading data:", err)
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: "member" | "admin") => {
    try {
      const { error } = await supabase
        .from("workspace_members")
        .update({ role: newRole })
        .eq("id", memberId)
        .eq("workspace_id", workspaceId)

      if (error) throw error

      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    } catch (err) {
      console.error("Role change error:", err)
      alert("Failed to update role")
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return

    try {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId)
        .eq("workspace_id", workspaceId)

      if (error) throw error

      setMembers(prev => prev.filter(m => m.id !== memberId))
      setStats(prev => ({ ...prev, totalMembers: prev.totalMembers - 1 }))
    } catch (err) {
      console.error("Remove member error:", err)
      alert("Failed to remove member")
    }
  }

  const handleInvite = async (email: string, role: "member" | "admin") => {
    try {
      const response = await fetch(`${window.location.origin}/api/workspaces/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, workspace_id: workspaceId, role }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send invitation")
      }

      alert("Invitation sent!")
    } catch (err) {
      console.error("Invite error:", err)
      alert(err instanceof Error ? err.message : "Failed to send invitation")
    }
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
        <div className="max-w-md mx-auto p-6 text-center">
          <h3 className="font-semibold text-lg mb-2">Failed to load admin panel</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  const budgetPercent = (stats.monthlySpend / stats.budgetLimit) * 100
  const isOverBudget = stats.monthlySpend > stats.budgetLimit
  const isNearBudget = stats.monthlySpend > stats.budgetLimit * 0.8

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => window.location.href = "/office"}>
              <Bot className="h-4 w-4 mr-2" />
              Office
            </Button>
            <Button variant="ghost" onClick={() => window.location.href = "/dashboard"}>
              <Users className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMembers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bots</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBots}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{stats.pendingApprovals}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.monthlySpend)}</div>
              <p className="text-xs text-muted-foreground">of {formatCurrency(stats.budgetLimit)} budget</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Budget Usage</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={isOverBudget ? "bg-red-500" : isNearBudget ? "bg-amber-500" : "bg-green-500"}
                  style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{budgetPercent.toFixed(1)}% used</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="bots">Bots</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <div className="flex flex-col gap-4 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Workspace Members</CardTitle>
                <Button onClick={() => {
                  const email = prompt("Enter email to invite:")
                  if (email) {
                    const role = confirm("Make admin?") ? "admin" : "member"
                    handleInvite(email, role)
                  }
                }}>
                  <Users className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </div>

              <Card>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-4 font-medium text-sm text-muted-foreground">Member</th>
                          <th className="text-left p-4 font-medium text-sm text-muted-foreground">Role</th>
                          <th className="text-left p-4 font-medium text-sm text-muted-foreground">Joined</th>
                          <th className="text-right p-4 font-medium text-sm text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member: any) => {
                          const isOwner = member.role === "owner"
                          return (
                            <tr key={member.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                                    {member.user?.email?.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-medium">{member.user?.raw_user_meta_data?.full_name || member.user?.email}</p>
                                    <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge variant={member.role === "owner" ? "default" : member.role === "admin" ? "secondary" : "outline"}>
                                  {member.role}
                                </Badge>
                              </td>
                              <td className="p-4 text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <select
                                    value={member.role}
                                    onChange={(e) => handleRoleChange(member.id, e.target.value as "member" | "admin")}
                                    disabled={updatingMember === member.id || member.role === "owner"}
                                    className="text-sm border border-border rounded px-2 py-1 bg-background"
                                  >
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveMember(member.id)}
                                    disabled={updatingMember === member.id || member.role === "owner"}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )}
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              </div>
            </TabsContent>

            <TabsContent value="bots">
              <Card>
                <CardHeader>
                  <CardTitle>Bots Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Bot management coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="approvals">
              <Card>
                <CardHeader>
                  <CardTitle>Approval Queue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Approval queue coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="usage">
              <Card>
                <CardHeader>
                  <CardTitle>Usage Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Usage analytics coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    )
  }

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}