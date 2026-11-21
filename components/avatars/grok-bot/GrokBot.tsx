'use client'

import { createAvatar } from '@bible-strong/avatar-react'
import grokBotData from './grok-bot.avatar.json'

// Create the avatar component - validates the character once at build time
const GrokBotAvatar = createAvatar(grokBotData)

/**
 * GrokBot - Alpha's AI Assistant Avatar
 *
 * A React 19 component that renders the Grok bot avatar using @bible-strong/avatar-react.
 * The avatar animates using requestAnimationFrame internally without React re-renders.
 *
 * @param state - Avatar state (idle, thinking, working, listening, etc.)
 * @param size - Size in pixels (default: 96)
 * @param face - Optional face expression (neutral, happy, surprised, sad, sleepy, squinted, calm, inspecting, confused)
 * @param lookAt - Point for the avatar to look at [x, y] where each is -1 to 1
 * @param followPointer - Whether the head should follow the mouse pointer
 * @param muted - Fades to grayscale (for reduced motion or inactive states)
 * @param paused - Pauses animation
 * @param settleAfterMs - Holds pose after last change (good for list items)
 * @param onStateChange - Callback when state changes
 * @param className - CSS class for the SVG element
 * @param style - Inline styles for the SVG element
 * @param ariaLabel - Accessible label
 */

export interface GrokBotProps {
  /** Current avatar state from the shared catalogue */
  state?: 'idle' | 'thinking' | 'working' | 'listening' | 'searching' |
        'sleeping' | 'waking' | 'excited' | 'bored' | 'suspicious' |
        'angry' | 'drowsy' | 'happy' | 'curious' | 'confused' |
        'surprised' | 'proud' | 'shy' | 'sad' | 'laughing' |
        'scared' | 'playful' | 'celebrate'

  /** Face expression (one of the nine standard faces) */
  face?: 'neutral' | 'happy' | 'surprised' | 'sad' | 'sleepy' |
         'squinted' | 'calm' | 'inspecting' | 'confused'

  /** Size in pixels (width = height) */
  size?: number

  /** Point to look at: [x, y] where each is -1 to 1 */
  lookAt?: [number, number] | null

  /** Whether head follows mouse pointer */
  followPointer?: boolean

  /** Fade to grayscale */
  muted?: boolean

  /** Pause animation */
  paused?: boolean

  /** Hold pose after last change (ms) */
  settleAfterMs?: number

  /** Callback when state changes */
  onStateChange?: (state: string | null) => void

  /** CSS class for the SVG */
  className?: string

  /** Inline styles for the SVG */
  style?: React.CSSProperties

  /** Accessible label */
  ariaLabel?: string
}

/**
 * GrokBot Component
 *
 * Usage:
 * ```tsx
 * <GrokBot
 *   state="thinking"
 *   size={96}
 *   face="curious"
 *   lookAt={[0, 0.2]}
 *   onStateChange={(s) => console.log('State:', s)}
 * />
 * ```
 */
export function GrokBot({
  state = 'idle',
  face,
  size = 96,
  lookAt = null,
  followPointer = false,
  muted = false,
  paused = false,
  settleAfterMs = 0,
  onStateChange,
  className,
  style,
  ariaLabel = 'Grok Bot Avatar'
}: GrokBotProps) {
  return (
    <GrokBotAvatar
      state={state}
      face={face}
      size={size}
      lookAt={lookAt}
      followPointer={followPointer}
      muted={muted}
      paused={paused}
      settleAfterMs={settleAfterMs}
      onStateChange={onStateChange}
      className={className}
      style={style}
      ariaLabel={ariaLabel}
    />
  )
}

/**
 * Helper: Create a GrokBot with specific states for common bot statuses
 */
export const GrokBotStates = {
  /** Default idle state */
  idle: 'idle' as const,

  /** Bot is processing/thinking */
  thinking: 'thinking' as const,

  /** Bot is actively working on a task */
  working: 'working' as const,

  /** Bot is listening for input */
  listening: 'listening' as const,

  /** Bot is searching/browsing */
  searching: 'searching' as const,

  /** Bot completed a task successfully */
  celebrate: 'celebrate' as const,

  /** Bot encountered an error */
  confused: 'confused' as const,

  /** Bot is waiting for approval */
  suspicious: 'suspicious' as const,

  /** Bot is offline/sleeping */
  sleeping: 'sleeping' as const,

  /** Bot just woke up */
  waking: 'waking' as const,

  /** Bot is happy/success */
  happy: 'happy' as const,

  /** Bot is curious about something */
  curious: 'curious' as const,
} as const

/**
 * Helper: Face expressions for common situations
 */
export const GrokBotFaces = {
  neutral: 'neutral' as const,
  happy: 'happy' as const,
  surprised: 'surprised' as const,
  sad: 'sad' as const,
  sleepy: 'sleepy' as const,
  squinted: 'squinted' as const,
  calm: 'calm' as const,
  inspecting: 'inspecting' as const,
  confused: 'confused' as const,
} as const

export default GrokBot