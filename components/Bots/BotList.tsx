"use client"

import { useState } from "react"
import { Department, Bot, BotRole } from "@/types"
import { BotDialog } from "./BotDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Plus, Edit, Trash2, Bot as BotIcon, UserCog, Activity } from "lucide-react"

interface BotListProps {
  departments: Department[]
  workspaceId: string
  onCreate: (data: any) => Promise<void>
  onUpdate: (botId: string, data: any) => Promise<void>
  onDelete: (botId: string) => Promise<void>
  isLoading?: boolean
}

const ROLE_COLORS: Record<BotRole, string> = {
  head: "bg-purple-100 text-purple-800",
  lead: "bg-blue-100 text-blue-800",
  worker: "bg-green-100 text-green-800",
}

const ROLE_LABELS: Record<BotRole, string> = {
  head: "Head",
  lead: "Lead",
  worker: "Worker",
}

const STATUS_COLORS = {
  online: "bg-green-500",
  offline: "bg-gray-400",
  waiting_approval: "bg-yellow-500",
}

interface BotWithDept extends Bot {
  department_name: string
  department_id: string
  floor_tint: string
}

export function BotList({
  departments,
  workspaceId,
  onCreate,
  onUpdate,
  onDelete,
  isLoading,
}: BotListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBot, setEditingBot] = useState<Bot | null>(null)
  const [deletingBot, setDeletingBot] = useState<Bot | null>(null)

  const handleOpenCreate = (deptId?: string) => {
    setEditingBot(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (bot: Bot) => {
    setEditingBot(bot)
    setDialogOpen(true)
  }

  const handleOpenDelete = (bot: Bot) => {
    setDeletingBot(bot)
  }

  const handleSubmit = async (data: any) => {
    if (editingBot) {
      await onUpdate(editingBot.id, data)
    } else {
      await onCreate(data)
    }
    setDialogOpen(false)
  }

  const handleConfirmDelete = async () => {
    if (!deletingBot) return
    try {
      await onDelete(deletingBot.id)
    } catch (error) {
      console.error("Failed to delete bot:", error)
      alert("Failed to delete bot")
    }
  }

  // Flatten all bots from all departments
  const allBots: BotWithDept[] = departments.flatMap((dept) =>
    (dept.bots || []).map((bot) => ({
      ...bot,
      department_name: dept.name,
      department_id: dept.id,
      floor_tint: dept.floor_tint,
    }))
  )

  // Group bots by role
  const botsByRole = {
    head: allBots.filter((b) => b.role === "head"),
    lead: allBots.filter((b) => b.role === "lead"),
    worker: allBots.filter((b) => b.role === "worker"),
  }

  const renderLoading = () => (
    <div className="space-y-2" role="status" aria-label="Loading bots">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse h-16 bg-muted rounded-lg" />
      ))}
    </div>
  )

  const renderEmpty = () => (
    <div className="text-center py-8 text-muted-foreground">
      <BotIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p>No bots yet</p>
      <p className="text-sm">Click "Add Bot" to create your first bot</p>
    </div>
  )

  const RoleSection = ({ role, bots }: { role: BotRole; bots: BotWithDept[] }) => {
    if (bots.length === 0 && role !== "head") return null

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
            {ROLE_LABELS[role]}s ({bots.length})
          </h4>
          {(role === "worker" || role === "lead") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenCreate()}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              Add {ROLE_LABELS[role]}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {bots.map((bot) => (
            <BotRow
              key={bot.id}
              bot={bot}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
              isHead={bot.is_head_immutable}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isLoading ? renderLoading() : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Team Bots</h3>
            <Button onClick={() => handleOpenCreate()} disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bot
            </Button>
          </div>

          {allBots.length === 0 ? renderEmpty() : (
            <div className="space-y-6">
              <RoleSection role="head" bots={botsByRole.head} />
              <RoleSection role="lead" bots={botsByRole.lead} />
              <RoleSection role="worker" bots={botsByRole.worker} />
            </div>
          )}

          {/* Create/Edit Dialog */}
          <BotDialog
            open={dialogOpen}
            onOpenChange={(open: boolean) => setDialogOpen(open)}
            onSubmit={handleSubmit}
            departments={departments}
            bot={editingBot}
            isEditing={!!editingBot}
          />

          {/* Delete Confirmation Dialog */}
          {deletingBot && (
            <Dialog open onOpenChange={(open: boolean) => setDeletingBot(open ? deletingBot : null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete Bot</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete "{deletingBot.name}"? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeletingBot(null)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleConfirmDelete}>
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </div>
  )
}

function BotRow({
  bot,
  onEdit,
  onDelete,
  isHead,
}: {
  bot: BotWithDept
  onEdit: (bot: BotWithDept) => void
  onDelete: (bot: BotWithDept) => void
  isHead: boolean
}) {
  return (
    <Card className={cn("transition-shadow hover:shadow-md", isHead && "ring-2 ring-purple-200")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
            style={{ backgroundColor: bot.avatar_color }}
          >
            {bot.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{bot.name}</span>
              {isHead && (
                <Badge variant="outline" className="bg-primary/10 text-primary">
                  <BotIcon className="h-3 w-3 mr-1" />
                  Head
                </Badge>
              )}
              <Badge className={ROLE_COLORS[bot.role]}>
                {ROLE_LABELS[bot.role]}
              </Badge>
              <Badge variant="outline" className={cn(STATUS_COLORS.online)}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Online
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {bot.department_name} · Floor {bot.department_id ? "?" : "N/A"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(bot)}
              disabled={isHead}
              aria-label="Edit bot"
            >
              <Edit className="h-4 w-4" />
            </Button>
            {!isHead && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(bot)}
                aria-label="Delete bot"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}