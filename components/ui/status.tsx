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
import { cn } from "@/lib/utils"

export interface StatusBadgeProps {
  /** Bot state determines the badge color and icon */
  state: "idle" | "thinking" | "working" | "listening" | "error" | "celebrate"
  /** Additional CSS classes */
  className?: string
  /** Whether the badge is large (for floor panels) or small (for avatars) */
  size?: "sm" | "md" | "lg"
}

const statusStyles = {
  idle: {
    bg: "bg-cream text-cream-900",
    border: "border-cream-300",
    label: "Idle",
  },
  thinking: {
    bg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    label: "Thinking",
  },
  working: {
    bg: "bg-green-500/10 text-green-400 border-green-500/20",
    label: "Working",
  },
  listening: {
    bg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    label: "Listening",
  },
  error: {
    bg: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "Error",
  },
  celebrate: {
    bg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    label: "Celebrate",
  },
}

export const StatusBadge = ({
  state,
  className,
  size = "md",
}: StatusBadgeProps) => {
  const style = {
    idle: "bg-cream text-cream-900 border-cream-300",
    thinking: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    working: "bg-green-500/10 text-green-400 border-green-500/20",
    listening: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    celebrate: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  }[state as keyof typeof statusStyles] || statusStyles.idle

  const sizeClasses = {
    sm: "h-6 px-2 text-xs rounded-full",
    md: "h-8 px-3 text-sm rounded-full",
    lg: "h-10 px-4 text-base rounded-full",
  }

  return (
    <span
      className={cn(
        `inline-flex items-center ${sizeClasses[size]}`,
        style,
        "rounded-full",
        "gap-2",
        "font-medium",
        "align-middle",
        className
      )}
    >
      {/* Icon would be rendered here based on state */}
      <span>{state}</span>
    </span>
  )
}