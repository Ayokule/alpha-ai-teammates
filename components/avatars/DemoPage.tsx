/**
 * DemoPage - Demonstration of the Grok bot avatar integration
 *
 * Shows various avatar states and configurations for the Alpha app.
 * This is a demo page to verify the avatar integration works correctly.
 */
'use client'

import { useState, useEffect } from 'react'
import { AssistantAvatar, useAssistantAvatar } from '@/components/avatars'

export function DemoPage() {
  const { isThinking, isWorking, isListening, avatarState } = useAssistantAvatar()

  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '800px',
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>
        🤖 Alpha — Grok Bot Avatar Demo
      </h1>

      <p style={{ textAlign: 'center', color: '#666', marginBottom: '1rem' }}>
        Demonstrating @bible-strong/avatar-react integration with the Grok bot character
      </p>

      {/* Avatar States Showcase */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit', gap: '1rem', maxWidth: '600px', marginBottom: '2rem' }}>
        <div style={{ margin: '8px 0' }}>
          <span style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Idle</span>
          <AssistantAvatar isThinking={false} isWorking={false} isListening={false} size={48} />
        </div>

        <div style={{ margin: '8px 0' }}>
          <span style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Thinking</span>
          <AssistantAvatar isThinking={true} isWorking={false} isListening={false} size={48} />
        </div>

        <div style={{ margin: '8px 0' }}>
          <span style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Working</span>
          <AssistantAvatar isThinking={false} isWorking={true} isListening={false} size={48} />
        </div>

        <div style={{ margin: '8px 0' }}>
          <span style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Listening</span>
          <AssistantAvatar isThinking={false} isWorking={false} isListening={true} size={48} />
        </div>

        <div style={{ margin: '8px 0' }}>
          <span style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Current State: {avatarState}</span>
          <AssistantAvatar isThinking={avatarState === 'thinking'} isWorking={avatarState === 'working'} isListening={avatarState === 'listening'} size={48} />
        </div>
      </div>

      {/* useAssistantAvatar hook display */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
          useAssistantAvatar Hook
        </h3>

        <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
          Hook that automatically manages avatar state
        </p>

        <div style={{
          background: '#f9fafb',
          borderRadius: '6px',
          padding: '1rem',
          marginTop: '0.5rem',
          border: '1px solid #e5e7eb',
        }}>
          <p style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
            Current Avatar State: <span style={{ color: '#1e293b', fontFamily: 'monospace' }}>{avatarState}</span>
          </p>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            The avatar above displays this state automatically based on the bot's activity.
          </p>
        </div>
      </div>
    </div>
  )
}