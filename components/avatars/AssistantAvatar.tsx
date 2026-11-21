'use client'

import { useState, useEffect } from 'react'

/**
 * AssistantAvatar - The Assistant bot avatar in the 3D office
 *
 * Displays the Grok bot avatar with appropriate state based on the bot's activity.
 * Used in the 3D office floor panel for the Assistant department.
 *
 * @param isThinking - Whether the bot is thinking/processing
 * @param isWorking - Whether the bot is actively working on a task
 * @param isListening - Whether the bot is listening for input
 * @param showFace - Whether to show a face expression
 * @param face - Optional face expression (neutral, happy, surprised, etc.)
 * @param size - Avatar size in pixels (default: 64)
 * @param onStateChange - Callback when avatar state changes
 */
export function AssistantAvatar({
  isThinking = false,
  isWorking = false,
  isListening = false,
  showFace = false,
  face,
  size = 64,
  onStateChange,
}: {
  isThinking?: boolean
  isWorking?: boolean
  isListening?: boolean
  showFace?: boolean
  face?: 'neutral' | 'happy' | 'surprised' | 'sad' | 'sleepy' | 'squinted' | 'calm' | 'inspecting' | 'confused'
  size?: number
  onStateChange?: (state: string) => void
}) {
  const [state, setState] = useState<'idle' | 'thinking' | 'working' | 'listening'>('idle')

  // Determine the avatar state based on props priority
  useEffect(() => {
    if (isThinking) setState('thinking')
    else if (isWorking) setState('working')
    else if (isListening) setState('listening')
    else setState('idle')
  }, [isThinking, isWorking, isListening])

  // Update parent on state change
  const handleStateChange = (newState: string | null) => {
    const resolvedState = (newState ?? 'idle') as 'idle' | 'thinking' | 'working' | 'listening'
    setState(resolvedState)
    onStateChange?.(resolvedState)
  }

  // Use the explicit face if provided, otherwise undefined (no face change)
  const faceToUse = face

  // Simple stroke color for SVG
  const strokeColor = 'currentColor'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
      aria-label="Assistant Bot Grok"
      style={{
        overflow: 'visible',
        display: 'block',
        margin: '0 auto',
      }}
    >
      {/* Avatar SVG base structure - in production, @bible-strong/avatar-react renders animated SVG here */}
      <circle cx={12} cy={12} r={10} stroke={strokeColor} strokeWidth={1.5} />
      <line x1={8} y1={8} x2={16} y2={16} stroke={strokeColor} strokeWidth={1.5} />
      {/* Eyes would animate here via requestAnimationFrame in production */}
      {/* Mouth would change based on state */}
      <rect x={8} y={16} width={8} height={4} fill={state === 'thinking' ? strokeColor : 'none'} />
    </svg>
  )
}

/**
 * useAssistantAvatar - Hook that manages avatar state automatically
 *
 * Returns the current avatar state and helper functions
 * to toggle between different states.
 *
 * @returns Avatar state management object
 *
 * @example
 * ```tsx
 * import { useAssistantAvatar } from '@/components/avatars'
 *
 * const { isThinking, avatarState, setIsThinking } = useAssistantAvatar()
 * ```
 */
export function useAssistantAvatar() {
  const [isThinking, setIsThinking] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [isListening, setIsListening] = useState(false)

  const avatarState: 'idle' | 'thinking' | 'working' | 'listening' = isThinking
    ? 'thinking'
    : isWorking
      ? 'working'
      : isListening
        ? 'listening'
        : 'idle'

  return {
    isThinking,
    isWorking,
    isListening,
    avatarState,
    setIsThinking,
    setIsWorking,
    setIsListening,
  }
}

/**
 * Avatar state type for the Assistant bot
 */
export type AvatarState = 'idle' | 'thinking' | 'working' | 'listening'