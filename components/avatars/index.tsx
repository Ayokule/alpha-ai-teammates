/**
 * @file Avatar Index
 * @module components/avatars
 *
 * Exports all avatar-related components for Alpha's AI Teammate Bots.
 *
 * Usage:
 * ```tsx
 * import { AssistantAvatar, useAssistantAvatar } from '@/components/avatars'
 * ```
 */

// Re-export AssistantAvatar component (named export)
export { AssistantAvatar } from '@/components/avatars/AssistantAvatar'

// Re-export the useAssistantAvatar hook
export { useAssistantAvatar } from '@/components/avatars/AssistantAvatar'

// Default avatar configurations per bot department
export const defaultAvatarConfigs = {
  assistant: {
    state: 'idle',
    size: 64,
  },
  research: {
    state: 'searching',
    size: 72,
  },
  content: {
    state: 'writing',
    size: 64,
  },
  engineering: {
    state: 'working',
    size: 80,
  },
  head: {
    state: 'thinking',
    size: 96,
  },
}

// Avatar state descriptions for UI display
export const avatarStateDescriptions = {
  idle: 'Bot is ready and waiting',
  thinking: 'Bot is processing a request',
  working: 'Bot is executing a task',
  listening: 'Bot is waiting for input',
  searching: 'Bot is browsing for information',
  celebrate: 'Bot completed a task',
  confused: 'Bot encountered an error',
  suspicious: 'Bot awaiting approval',
  sleeping: 'Bot is offline',
  waking: 'Bot just woke up',
  happy: 'Bot is in a positive state',
  curious: 'Bot is exploring',
}