"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Recap } from "@/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCw, Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns"
import { RecapCard } from "@/components/Recaps/RecapCard"

export default function RecapsPage() {
  const [recaps, setRecaps] = useState<Recap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string>("")
  const [currentPeriod, setCurrentPeriod] = useState<Date>(new Date())

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
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)

      if (wsError) throw wsError

      if (!memberships || memberships.length === 0) {
        window.location.href = "/dashboard"
        return
      }

      const wsId = memberships[0].workspace_id
      setWorkspaceId(wsId)
      await loadRecaps(wsId)
    } catch (err) {
      console.error("Error loading workspace:", err)
      setError(err instanceof Error ? err.message : "Failed to load workspace")
      setLoading(false)
    }
  }

  const loadRecaps = async (wsId: string, period?: Date) => {
    setLoading(true)
    setError(null)
    try {
      const targetPeriod = period || currentPeriod
      const periodStart = startOfMonth(targetPeriod)
      const periodEnd = endOfMonth(targetPeriod)

      const { data, error } = await supabase
        .from("recaps")
        .select(`
          *,
          items:recap_items(
            *,
            bot:bots(name, avatar_color),
            department:departments(name)
          )
        `)
        .eq("workspace_id", wsId)
        .gte("period_start", periodStart.toISOString())
        .lte("period_end", periodEnd.toISOString())
        .order("period_start", { ascending: false })

      if (error) throw error
      setRecaps(data || [])
    } catch (err) {
      console.error("Error loading recaps:", err)
      setError(err instanceof Error ? err.message : "Failed to load recaps")
    } finally {
      setLoading(false)
    }
  }

  const generateRecap = async () => {
    setLoading(true)
    try {
      const periodStart = startOfMonth(currentPeriod)
      const periodEnd = endOfMonth(currentPeriod)

      const response = await fetch(`${window.location.origin}/api/recaps/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate recap")
      }

      await loadRecaps(workspaceId)
    } catch (err) {
      console.error("Generate recap failed:", err)
      setError(err instanceof Error ? err.message : "Failed to generate recap")
    } finally {
      setLoading(false)
    }
  }

  const goToPreviousMonth = () => {
    const newPeriod = subMonths(currentPeriod, 1)
    setCurrentPeriod(newPeriod)
    loadRecaps(workspaceId, newPeriod)
  }

  const goToNextMonth = () => {
    const newPeriod = addMonths(currentPeriod, 1)
    if (newPeriod > new Date()) return
    setCurrentPeriod(newPeriod)
    loadRecaps(workspaceId, newPeriod)
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
          <h3 className="font-semibold text-lg mb-2">Failed to load recaps</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Morning Recaps</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-4 py-1 text-sm font-medium bg-primary/10 text-primary rounded-full">
              {format(currentPeriod, "MMMM yyyy")}
            </span>
            <Button variant="outline" size="icon" onClick={goToNextMonth} aria-label="Next month" disabled={currentPeriod >= new Date()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={generateRecap} disabled={loading} className="gap-2">
              <Loader2 className={cn("h-4 w-4", loading && "animate-spin")} />
              Generate Recap
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {recaps.length === 0 ? (
          <div className="text-center py-12">
            <Alert variant="default" className="max-w-2xl mx-auto">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <AlertDescription className="text-center">
                No recaps for {format(currentPeriod, "MMMM yyyy")}
                <br />
                <Button onClick={generateRecap} className="mt-4" disabled={loading}>
                  <Loader2 className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                  Generate Recap
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {recaps.map((recap) => (
              <RecapCard
                key={recap.id}
                recap={recap}
                onItemAction={(actionData) => {
                  if (actionData.type === "view_approval") {
                    // Open approval in approval panel
                    alert("Opening approval: " + actionData.approvalId)
                  } else if (actionData.type === "view_task") {
                    alert("Viewing task: " + actionData.taskId)
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Need to import subMonths and startOfMonth/endOfMonth
// Already imported from date-fns above