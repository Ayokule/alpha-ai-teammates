"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Approval, Bot } from "@/types"
import { ApprovalCard } from "./ApprovalCard"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Bell, CheckCircle2, XCircle, Filter, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface ApprovalListProps {
  workspaceId: string
  className?: string
}

export function ApprovalList({ workspaceId, className }: ApprovalListProps) {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "pending" | "blocking" | "non-blocking">("all")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const supabase = createClient()

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("approvals")
        .select(`
          *,
          bot:bots(
            id, name, role, avatar_color, department:departments(name)
          ),
          task:tasks(payload)
        `)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error
      setApprovals(data || [])
    } catch (err) {
      console.error("Failed to load approvals:", err)
      setError(err instanceof Error ? err.message : "Failed to load approvals")
    } finally {
      setLoading(false)
    }
  }, [workspaceId, supabase])

  useEffect(() => {
    fetchApprovals()

    // Set up realtime subscription
    const channel = supabase
      .channel(`approvals:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approvals",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setApprovals((prev) => [payload.new as Approval, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setApprovals((prev) =>
              prev.map((a) => (a.id === payload.new.id ? payload.new as Approval : a))
            )
          } else if (payload.eventType === "DELETE") {
            setApprovals((prev) => prev.filter((a) => a.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, supabase])

  const filteredApprovals = approvals.filter((a) => {
    if (filter === "all") return true
    if (filter === "pending") return a.status === "pending"
    if (filter === "blocking") return a.status === "pending" && a.is_blocking
    if (filter === "non-blocking") return a.status === "pending" && !a.is_blocking
    return true
  })

  const pendingCount = approvals.filter((a) => a.status === "pending").length
  const blockingCount = approvals.filter((a) => a.status === "pending" && a.is_blocking).length

  const handleApprove = async (approvalId: string) => {
    try {
      const response = await fetch(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      })
      if (!response.ok) throw new Error("Failed to approve")
    } catch (err) {
      console.error("Approve failed:", err)
      alert("Failed to approve")
    }
  }

  const handleDeny = async (approvalId: string) => {
    try {
      const response = await fetch(`/api/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "denied" }),
      })
      if (!response.ok) throw new Error("Failed to deny")
    } catch (err) {
      console.error("Deny failed:", err)
      alert("Failed to deny")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>Failed to load approvals: {error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Approvals</h3>
            <p className="text-sm text-muted-foreground">
              {pendingCount} pending {blockingCount > 0 && (
                <>
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                    {blockingCount} blocking
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
          >
            <option value="all">All ({approvals.length})</option>
            <option value="pending">Pending ({pendingCount})</option>
            <option value="blocking">Blocking ({blockingCount})</option>
            <option value="non-blocking">
              Non-blocking ({pendingCount - blockingCount})
            </option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchApprovals} disabled={loading}>
            <Loader2 className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Approval cards */}
      {filteredApprovals.length === 0 ? (
        <Alert variant="default" className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {filter === "all"
              ? "No approvals yet. All caught up!"
              : `No ${filter} approvals.`}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {filteredApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={handleApprove}
              onDeny={handleDeny}
              onGrantAccess={async () => {}}
              isLoading={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}