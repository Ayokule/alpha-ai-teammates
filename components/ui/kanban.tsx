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
import { cn } from "@/lib/utils"

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

/** Columns configuration for the kanban board */
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

/** Main kanban board component */
export interface KanbanBoardProps {
  /** Columns configuration */
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