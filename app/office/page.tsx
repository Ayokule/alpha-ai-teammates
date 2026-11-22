"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Department, Bot } from "@/types"
import { Office3D } from "@/components/Office/Office3D"
import { ChatDrawer } from "@/components/Office/ChatDrawer"
import { ApprovalList } from "@/components/Approvals/ApprovalList"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Building2, MessageSquare, Bell, X, Bot as BotIcon } from "lucide-react"

export default function OfficePage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string>("")
  const [currentFloor, setCurrentFloor] = useState(0)
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null)
  const [chatThreadId, setChatThreadId] = useState<string | undefined>()
  const [showApprovals, setShowApprovals] = useState(false)

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
      await loadDepartments(wsId)
    } catch (err) {
      console.error("Error loading workspace:", err)
      setError(err instanceof Error ? err.message : "Failed to load workspace")
      setLoading(false)
    }
  }

  const loadDepartments = async (wsId: string) => {
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
    } catch (err) {
      console.error("Error loading departments:", err)
      setError(err instanceof Error ? err.message : "Failed to load departments")
    } finally {
      setLoading(false)
    }
  }

  const handleAskHead = useCallback(async (message: string) => {
    if (!selectedBot || !workspaceId) return

    try {
      // Find the Head bot
      const headBot = departments.flatMap(d => d.bots || []).find(b => b.role === "head")
      if (!headBot) {
        alert("Head bot not found")
        return
      }

      // Send message to Head bot via chat API
      const response = await fetch(`${window.location.origin}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Bot "${selectedBot.name}" asks: ${message}` }],
          botId: headBot.id,
          workspaceId,
        }),
      })

      if (!response.ok) throw new Error("Failed to ask Head")
    } catch (err) {
      console.error("Ask Head failed:", err)
      alert("Failed to send message to Head bot")
    }
  }, [selectedBot, workspaceId, departments])

  const handleDelegateTask = useCallback(async (taskDescription: string) => {
    if (!selectedBot || !workspaceId) return

    try {
      // Get all bots to show in selection
      const allBots = departments.flatMap(d => d.bots || []).filter(b => b.id !== selectedBot?.id)
      if (allBots.length === 0) {
        alert("No other bots available for delegation")
        return
      }

      // For now, delegate to first available worker (in production, show a picker)
      const targetBot = allBots.find(b => b.role === "worker") || allBots[0]

      const response = await fetch(`${window.location.origin}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: targetBot.id,
          workspaceId,
          payload: { description: taskDescription, fromBot: selectedBot.id },
          source: "delegation",
          priority: "urgent",
        }),
      })

      if (!response.ok) throw new Error("Failed to delegate task")

      alert(`Task delegated to ${targetBot.name}`)
    } catch (err) {
      console.error("Delegate task failed:", err)
      alert("Failed to delegate task")
    }
  }, [selectedBot, workspaceId, departments])

  const handleFloorChange = (floor: number) => {
    setCurrentFloor(floor)
  }

  const goUp = () => {
    setCurrentFloor((prev) => Math.min(prev + 1, departments.length))
  }

  const goDown = () => {
    setCurrentFloor((prev) => Math.max(prev - 1, 0))
  }

  const handleBotClick = useCallback((bot: Bot & { department?: Department }) => {
    setSelectedBot(bot)
    setChatThreadId(undefined) // New chat
  }, [])

  const closeChat = useCallback(() => {
    setSelectedBot(null)
    setChatThreadId(undefined)
  }, [])

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
          <h3 className="font-semibold text-lg mb-2">Failed to load office</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 relative">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Alpha Office</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goUp}
              disabled={currentFloor >= departments.length}
              aria-label="Go up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goDown}
              disabled={currentFloor <= 0}
              aria-label="Go down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <span className="px-3 py-1 text-sm font-medium bg-primary/10 text-primary rounded-full">
              Floor {currentFloor} / {departments.length}
            </span>
            <Button
              variant={showApprovals ? "default" : "outline"}
              onClick={() => setShowApprovals(!showApprovals)}
              className="relative"
            >
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => window.location.href = "/dashboard"}>
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* 3D Office View */}
      <main className="h-[calc(100vh-64px)] relative">
        <Office3D
          departments={departments}
          currentFloor={currentFloor}
          onFloorChange={handleFloorChange}
          onBotClick={handleBotClick}
        />
      </main>

      {/* Approvals Panel */}
      {showApprovals && workspaceId && (
        <div className="fixed right-0 top-64 bottom-0 w-full md:w-96 bg-background border-l border-border z-40 flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold">Approvals</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowApprovals(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ApprovalList workspaceId={workspaceId} />
          </div>
        </div>
      )}

      {/* Chat Drawer */}
      <ChatDrawer
        isOpen={!!selectedBot}
        onClose={closeChat}
        bot={selectedBot!}
        workspaceId={workspaceId}
        threadId={chatThreadId}
        onAskHead={handleAskHead}
        onDelegateTask={handleDelegateTask}
      />
    </div>
  )
}