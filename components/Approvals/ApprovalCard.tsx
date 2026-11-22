"use client"

import { useState } from "react"
import { Bot, Approval } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface ApprovalCardProps {
  approval: Approval & {
    bot?: Bot & { department?: { name: string } }
    task?: { payload: Record<string, any> }
  }
  onApprove: (approvalId: string) => Promise<void>
  onDeny: (approvalId: string) => Promise<void>
  onHandOff?: (approvalId: string, botId: string) => Promise<void>
  onGrantAccess?: (approvalId: string) => Promise<void>
  isLoading?: boolean
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  send_email: AlertTriangle,
  send_slack: AlertTriangle,
  publish_content: AlertTriangle,
  create_pr: AlertTriangle,
  merge_pr: AlertTriangle,
  delete_resource: XCircle,
  make_payment: AlertTriangle,
  composio_oauth: AlertTriangle,
  browserbase_action: AlertTriangle,
  grant_tool_access: AlertTriangle,
  reassign_task: AlertTriangle,
}

const ACTION_LABELS: Record<string, string> = {
  send_email: "Send Email",
  send_slack: "Send Slack Message",
  publish_content: "Publish Content",
  create_pr: "Create Pull Request",
  merge_pr: "Merge Pull Request",
  delete_resource: "Delete Resource",
  make_payment: "Make Payment",
  composio_oauth: "Connect App (OAuth)",
  browserbase_action: "Browser Action",
  grant_tool_access: "Grant Tool Access",
  reassign_task: "Reassign Task",
}

export function ApprovalCard({
  approval,
  onApprove,
  onDeny,
  onHandOff,
  onGrantAccess,
  isLoading = false,
}: ApprovalCardProps) {
  const [expanding, setExpanding] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const Icon = ACTION_ICONS[approval.action_type] || AlertTriangle
  const actionLabel = ACTION_LABELS[approval.action_type] || approval.action_type
  const isBlocking = approval.is_blocking
  const isExternal = !!approval.external_trigger_token

  const handleApprove = async () => {
    setActionLoading("approve")
    try {
      await onApprove(approval.id)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeny = async () => {
    setActionLoading("deny")
    try {
      await onDeny(approval.id)
    } finally {
      setActionLoading(null)
    }
  }

  const handleHandOff = async () => {
    if (!onHandOff) return
    setActionLoading("handoff")
    try {
      await onHandOff(approval.id, "") // TODO: show bot selector
    } finally {
      setActionLoading(null)
    }
  }

  const handleGrantAccess = async () => {
    if (!onGrantAccess) return
    setActionLoading("grant")
    try {
      await onGrantAccess(approval.id)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusColor = () => {
    switch (approval.status) {
      case "pending": return "bg-yellow-500"
      case "approved": return "bg-green-500"
      case "denied": return "bg-red-500"
      case "executing": return "bg-blue-500"
      case "completed": return "bg-green-600"
      case "failed": return "bg-red-600"
      case "expired": return "bg-gray-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusLabel = () => {
    switch (approval.status) {
      case "pending": return isBlocking ? "Waiting for approval" : "Approval requested"
      case "approved": return "Approved"
      case "denied": return "Denied"
      case "executing": return "Executing..."
      case "completed": return "Completed"
      case "failed": return "Failed"
      case "expired": return "Expired"
      default: return approval.status
    }
  }

  return (
    <Card className={cn(
      "border-l-4 transition-all",
      approval.status === "pending" && "border-yellow-500 bg-yellow-50/50",
      approval.status === "approved" && "border-green-500 bg-green-50/50",
      approval.status === "denied" && "border-red-500 bg-red-50/50",
      approval.status === "executing" && "border-blue-500 bg-blue-50/50",
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", getStatusColor())}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-semibold truncate">{actionLabel}</CardTitle>
                {isBlocking && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                    Blocking
                  </span>
                )}
                {!isBlocking && approval.status === "pending" && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    Non-blocking
                  </span>
                )}
                {isExternal && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    External
                  </span>
                )}
              </div>
              <CardDescription className="text-sm">
                {approval.bot && (
                  <>
                    <span className="font-medium">{approval.bot.name}</span>
                    {approval.bot.department && (
                      <span className="text-muted-foreground ml-2">· {approval.bot.department.name}</span>
                    )}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                getStatusColor()
              )}
            />
            <span className="text-sm font-medium text-muted-foreground">
              {getStatusLabel()}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Action Preview */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              What will happen:
            </div>
            <p className="text-sm text-foreground font-mono whitespace-pre-wrap bg-background p-2 rounded border">
              {approval.action_preview}
            </p>
          </div>

          {/* Expandable Details */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-left p-2"
            onClick={() => setExpanding(!expanding)}
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Details</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {JSON.stringify(approval.action_payload).length} chars
              </span>
            </span>
          </Button>

          {expanding && (
            <div className="space-y-3 pt-2 border-t border-border">
              {/* Payload Details */}
              <details className="group">
                <summary className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer">
                  <AlertTriangle className="h-4 w-4" />
                  Action Payload
                </summary>
                <pre className="mt-2 p-3 bg-background rounded border text-xs overflow-x-auto text-foreground">
                  {JSON.stringify(approval.action_payload, null, 2)}
                </pre>
              </details>

              {/* Task Context */}
              {approval.task?.payload && (
                <details className="group">
                  <summary className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer">
                    <AlertTriangle className="h-4 w-4" />
                    Task Context
                  </summary>
                  <pre className="mt-2 p-3 bg-background rounded border text-xs overflow-x-auto text-foreground">
                    {JSON.stringify(approval.task.payload, null, 2)}
                  </pre>
                </details>
              )}

              {/* Metadata */}
              <details className="group">
                <summary className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer">
                  <AlertTriangle className="h-4 w-4" />
                  Metadata
                </summary>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Approval ID: <code className="font-mono">{approval.id.slice(0, 8)}...</code></div>
                  <div>Created: <code className="font-mono">{new Date(approval.created_at).toLocaleString()}</code></div>
                  {approval.expires_at && (
                    <div>Expires: <code className="font-mono">{new Date(approval.expires_at).toLocaleString()}</code></div>
                  )}
                  {approval.external_trigger_token && (
                    <div>External Token: <code className="font-mono">{approval.external_trigger_token.slice(0, 16)}...</code></div>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* Actions */}
          {approval.status === "pending" && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              {isExternal ? (
                <Button
                  variant="outline"
                  className="flex-1 min-w-[150px]"
                  onClick={() => {
                    const url = `${window.location.origin}/api/approvals/${approval.external_trigger_token}`
                    navigator.clipboard.writeText(url)
                  }}
                  disabled={actionLoading !== null}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Copy Approval Link
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleApprove}
                    disabled={actionLoading !== null || isLoading}
                    className="flex-1 min-w-[120px]"
                  >
                    {actionLoading === "approve" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeny}
                    disabled={actionLoading !== null || isLoading}
                    className="flex-1 min-w-[120px]"
                  >
                    {actionLoading === "deny" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Deny
                  </Button>
                </>
              )}

              {/* Additional actions for specific types */}
              {approval.action_type === "composio_oauth" && onGrantAccess && (
                <Button
                  variant="outline"
                  onClick={handleGrantAccess}
                  disabled={actionLoading !== null || isLoading}
                  className="flex-1 min-w-[150px]"
                >
                  {actionLoading === "grant" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mr-2" />
                  )}
                  Grant Access
                </Button>
              )}

              {approval.action_type === "reassign_task" && onHandOff && (
                <Button
                  variant="outline"
                  onClick={handleHandOff}
                  disabled={actionLoading !== null || isLoading}
                  className="flex-1 min-w-[150px]"
                >
                  {actionLoading === "handoff" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mr-2" />
                  )}
                  Hand Off
                </Button>
              )}
            </div>
          )}

          {/* Executed/Completed Status */}
          {["executing", "completed", "failed"].includes(approval.status) && (
            <Alert variant={approval.status === "failed" ? "destructive" : "default"} className="mt-2">
              <AlertDescription className="flex items-center gap-2">
                {approval.status === "executing" && <Loader2 className="h-4 w-4 animate-spin" />}
                {approval.status === "completed" && <CheckCircle2 className="h-4 w-4" />}
                {approval.status === "failed" && <XCircle className="h-4 w-4" />}
                <span>
                  {approval.status === "executing" && "Action is being executed..."}
                  {approval.status === "completed" && "Action completed successfully"}
                  {approval.status === "failed" && `Action failed: ${approval.resolution_note || "Unknown error"}`}
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Denied/Expired Status */}
          {["denied", "expired"].includes(approval.status) && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                <span>
                  {approval.status === "denied" && "Approval was denied"}
                  {approval.status === "expired" && "Approval request expired"}
                  {approval.resolution_note && ` — ${approval.resolution_note}`}
                </span>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}