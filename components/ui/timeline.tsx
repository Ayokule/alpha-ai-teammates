/**
 * Timeline - Chat message timeline with thread indicators
 *
 * Used for displaying bot chat threads with "new chat" dividers,
 * message history, and approval cards.
 *
 * @example
 * ```tsx
 * <Timeline>
 *   <TimelineItem>
 *     <p>Message content</p>
 *     <TimelineItemArrow />
 *   </TimelineItem>
 * </Timeline>
 * ```
 */
import React from "react"
import { cn } from "@/lib/utils"

export interface TimelineItemProps {
  /** Content inside the timeline item */
  children: React.ReactNode
  /** Whether this is the first item in the timeline */
  first?: boolean
  /** Whether this is the last item in the timeline */
  last?: boolean
}

export const Timeline = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div className={cn("space-y-2", className)} {...props} ref={ref} />
))

Timeline.displayName = "Timeline"

export const TimelineItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { first?: boolean; last?: boolean }
>(({ className, first = false, last = false, children, ...props }, ref) => (
  <div
    className={cn(
      "flex items-start",
      first && "pt-0",
      last && "pb-0",
      className
    )}
    {...props}
    ref={ref}
  >
    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary transition-colors duration-300" />
    <div className="w-full px-2 pt-1">
      {children}
    </div>
  </div>
))

TimelineItem.displayName = "TimelineItem"

/**
 * TimelineItemArrow - Arrow connecting timeline items
 *
 * Renders the triangular arrow that connects message bubbles
 * in the chat timeline.
 */
export const TimelineItemArrow = React.forwardRef<
  SVGSVGElement,
  React.SVGAttributes<SVGSVGElement>
>(({ className, ...props }, ref) => (
  <svg
    className={cn("-ml-2 flex-shrink-0 h-2 w-2 rotate-6 fill-current", className)}
    ref={ref}
    viewBox="0 0 24 24"
    {...props}
  >
    <path d="M5 12h14m0 0l-7-7-7 7z" />
  </svg>
))

TimelineItemArrow.displayName = "TimelineItemArrow"

/**
 * TimelineSeparator - Separator between chat threads/dividers
 *
 * Used to visually separate "new chat" sections in the timeline.
 * Renders the "── new chat · date ──" divider.
 */
export const TimelineSeparator = ({
  date = new Date(),
  className,
}: {
  date?: Date
  className?: string
}) => {
  const formattedDate = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })

  return (
    <div
      className={cn(
        "flex items-center justify-center py-2",
        "text-sm text-muted-foreground",
        "break-words",
        className
      )}
    >
      {"── new chat · " + formattedDate + " ──"}
    </div>
  )
}

/**
 * MessageBubble - Message bubble in the chat timeline
 *
 * Renders a single message with avatar, author, content, and timestamp.
 * Supports both user messages and bot messages with different styling.
 */
export interface MessageBubbleProps {
  /** The message content */
  content: string
  /** The sender (user or bot) */
  sender: "user" | "bot"
  /** Optional avatar initials or name */
  avatar?: string
  /** Optional timestamp */
  timestamp?: Date
  /** Whether the message is from the current user */
  isOwn?: boolean
  /** Whether the message requires approval */
  requiresApproval?: boolean
  /** Callback when approval is toggled */
  onApprovalToggle?: () => void
}

export const MessageBubble = ({
  content,
  sender,
  avatar,
  timestamp,
  isOwn = false,
  requiresApproval = false,
  onApprovalToggle,
}: MessageBubbleProps) => {
  const classes = cn(
    "flex items-start gap-3 rounded-lg p-4 max-w-[80%] break-words",
    isOwn && "ml-auto justify-end bg-primary/10 text-primary",
    !isOwn && "mr-auto justify-start bg-secondary/10 text-secondary",
    requiresApproval && "border-l-4 border-warning"
  )

  const avatarClasses = cn(
    "w-6 h-6 rounded-full flex-shrink-0",
    isOwn && "bg-primary text-primary-foreground",
    !isOwn && "bg-secondary text-secondary-foreground"
  )

  return (
    <div className={classes}>
      {avatar && (
        <div className={avatarClasses}>
          {avatar.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", isOwn && "text-primary", !isOwn && "text-secondary")}>
          {sender === "user" ? "You" : "Bot"}
        </p>
        <p className="mt-1 break-all">{content}</p>
      </div>

      {timestamp && (
        <p className={cn(
          "mt-2 text-xs opacity-60",
          isOwn && "float-end",
          !isOwn && "float-start"
        )}>
          {timestamp.toLocaleTimeString()}
        </p>
      )}

      {requiresApproval && (
        <div className="mt-2 flex items-center gap-2 text-xs text-warning">
          <button
            onClick={onApprovalToggle}
            className="underline underline-offset-2 hover:text-warning"
          >
            Approve
          </button>
          <button
            onClick={onApprovalToggle}
            className="underline underline-offset-2 hover:text-warning"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * StatusBadge - Bot status indicator badge
 *
 * Displays the current state of a bot (idle, working, listening, etc.)
 * with color-coded badges. Used in the 3D office floor panel and user dashboard.
 *
 * @example
 * ```tsx
 * <StatusBadge state="thinking" />
 * <StatusBadge state="working" />
 * <StatusBadge state="idle" />
 * ```
 */
export interface StatusBadgeProps {
  /** Bot state determines the badge color and icon */
  state: "idle" | "thinking" | "working" | "listening" | "error" | "celebrate"
  /** Additional CSS classes */
  className?: string
  /** Whether the badge is large (for floor panels) or small (for avatars) */
  size?: "sm" | "md" | "lg"
}

const statusStyles = {
  idle: { bg: "bg-cream text-cream-900", border: "border-cream-300", icon: "🟢" },
  thinking: { bg: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: "🟡" },
  working: { bg: "bg-green-500/10 text-green-400 border-green-500/20", icon: "🟢" },
  listening: { bg: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: "🔵" },
  error: { bg: "bg-red-500/10 text-red-400 border-red-500/20", icon: "🔴" },
  celebrate: { bg: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: "🟣" },
} as const

export const StatusBadge = ({
  state,
  className,
  size = "md",
}: StatusBadgeProps) => {
  const style = (statusStyles as any)[state] || statusStyles.idle
  const sizeClasses = {
    sm: "h-6 px-2 text-xs rounded-full",
    md: "h-8 px-3 text-sm rounded-full",
    lg: "h-10 px-4 text-base rounded-full",
  }

  return (
    <span
      className={cn(
        `inline-flex items-center ${sizeClasses[size]}`,
        style.bg,
        style.border,
        "rounded-full",
        "gap-2",
        "font-medium",
        "align-middle",
        className
      )}
    >
      {style.icon}
      <span>{state}</span>
    </span>
  )
}

/**
 * KanbanBoard - Task board for bot task management
 *
 * A simple kanban board for visualizing bot task assignments.
 * Columns represent task status (To Do, In Progress, Review, Done).
 * Cards can be conceptually moved between columns to update task status.
 *
 * @example
 * ```tsx
 * <KanbanBoard
 *   onStatusChange={(taskId, newStatus) => console.log(taskId, newStatus)}
 * >
 *   <KanbanColumn title="To Do" tasks={todoTasks} />
 *   <KanbanColumn title="In Progress" tasks={inProgressTasks} />
 *   <KanbanColumn title="Review" tasks={reviewTasks} />
 *   <KanbanColumn title="Done" tasks={doneTasks} />
 * </KanbanBoard>
 * ```
 */
export interface KanbanColumnProps {
  /** Column title (e.g., "To Do", "In Progress") */
  title: string
  /** Tasks in this column */
  tasks: KanbanTask[]
  /** Callback when task status changes */
  onStatusChange?: (taskId: string, newStatus: string) => void
  /** Whether the column is draggable */
  draggable?: boolean
}

export interface KanbanTask {
  /** Unique task ID */
  id: string
  /** Task title/description */
  title: string
  /** Current status */
  status: "to-do" | "in-progress" | "review" | "done"
  /** Optional description */
  description?: string
  /** Optional bot assignment */
  assignedBot?: string
}

export interface KanbanBoardProps {
  /** Columns to render */
  columns: {
    title: string
    tasks: KanbanTask[]
  }[]
  /** Callback when task status changes */
  onStatusChange?: (taskId: string, newStatus: string, columnIndex?: number) => void
  /** Whether boards are draggable */
  draggable?: boolean
}

/**
 * Helper component for a single Kanban column
 */
export const KanbanColumn = ({
  title,
  tasks,
  onStatusChange,
  draggable = false,
}: KanbanColumnProps) => {
  const handleStatusChange = (taskId: string, newStatus: string) => {
    onStatusChange?.(taskId, newStatus)
  }

  return (
    <div className="bg-card border border-border p-6 rounded-lg shadow-sm">
      <h3 className="text-sm font-medium text-foreground mb-4">{title}</h3>
      {tasks.length === 0 && (
        <p className="text-sm opacity-60">No tasks</p>
      )}
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors cursor-pointer"
            onClick={() => handleStatusChange(task.id, getNextStatus(task.status))}
          >
            <span className="flex-1 truncate">{task.title}</span>
            <span className="text-xs font-medium capitalize">
              {task.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Helper to get the next status in the workflow */
const statuses = ["to-do", "in-progress", "review", "done"]

/** Get the next status in the workflow */
function getNextStatus(current: "to-do" | "in-progress" | "review" | "done"): "to-do" | "in-progress" | "review" | "done" {
  const currentIndex = statuses.indexOf(current)
  return statuses[(currentIndex + 1) % statuses.length] as "to-do" | "in-progress" | "review" | "done"
}

/** Main kanban board component */
export const KanbanBoard = ({
  columns,
  onStatusChange,
  draggable = false,
}: KanbanBoardProps) => (
  <div className="space-y-6">
    {columns.map((column, index) => (
      <KanbanColumn
        key={index}
        title={column.title}
        tasks={column.tasks}
        onStatusChange={onStatusChange}
        draggable={draggable}
      />
    ))}
  </div>
)