"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Recap } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ChevronDown, ChevronUp, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface RecapCardProps {
  recap: Recap & {
    items?: Array<{
      id: string
      type: string
      title: string
      description: string | null
      action_data: Record<string, any> | null
      bot?: { name: string; avatar_color: string }
      department?: { name: string }
    }>
  }
  onItemAction?: (actionData: Record<string, any>) => void
}

export function RecapCard({ recap, onItemAction }: RecapCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (!recap.narrative && !recap.summary) {
    return null
  }

  return (
    <Card className="mb-4 border-l-4 border-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Morning Recap</CardTitle>
              <p className="text-sm text-muted-foreground">
                {format(new Date(recap.period_start), "MMM d")} - {format(new Date(recap.period_end), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {recap.sent_at ? "Sent" : "Draft"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {(recap.narrative || recap.summary) && (
          <div className="prose prose-sm max-w-none mb-4">
            <p className="whitespace-pre-wrap text-sm">{recap.narrative || recap.summary}</p>
          </div>
        )}

        {recap.items && recap.items.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Items ({recap.items.length})</h4>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {recap.items.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border border-border",
                    item.type === "approval_pending" && "bg-yellow-50 border-yellow-200",
                    item.type === "task_completed" && "bg-green-50 border-green-200",
                    item.type === "task_failed" && "bg-red-50 border-red-200"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.type === "approval_pending" && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          Approval
                        </span>
                      )}
                      {item.type === "task_completed" && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          Completed
                        </span>
                      )}
                      {item.type === "task_failed" && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          Failed
                        </span>
                      )}
                      {item.bot && (
                        <span className="text-xs text-muted-foreground">
                          {item.bot.name}
                        </span>
                      )}
                      {item.department && (
                        <span className="text-xs text-muted-foreground">
                          {" · " + item.department.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    )}
                    {item.action_data && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => onItemAction?.(item.action_data as Record<string, any>)}
                      >
                        {item.action_data.type === "view_approval" && "Review"}
                        {item.action_data.type === "view_task" && "View Task"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}