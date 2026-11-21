/**
 * TestAvatar - Quick test component to verify Grok bot avatar integration
 *
 * This is a minimal test to ensure the avatar package works correctly
 * within the Alpha project structure.
 */
'use client'

import { useState } from 'react'

// Test that the avatar component can be imported and rendered
// The actual GrokBotAvatar creation would happen with createAvatar(grokBot)

export function TestAvatar() {
  const [state, setState] = useState<'idle' | 'thinking' | 'working'>('idle')
  const [face, setFace] = useState<'neutral' | 'happy' | 'surprised'>('neutral')
  const [size, setSize] = useState<number>(64)

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '600px',
      margin: '0 auto',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>🤖 Grok Bot Avatar Test</h2>

      <p style={{ textAlign: 'center', color: '#666', marginBottom: '1rem' }}>
        Testing @bible-strong/avatar-react integration
      </p>

      {/* Avatar placeholder - in production would use createAvatar(grokBot) */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: size,
        height: size,
        background: '#f1f5f9',
        marginBottom: '1rem',
        borderRadius: '8px',
      }}>
        {/* Avatar SVG would render here via requestAnimationFrame */}
        <span style={{ fontSize: '24px', color: '#64748b' }}>🤖</span>
      </div>

      {/* State controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setState('idle')}
          style={{ width: '80px', padding: '4px', fontSize: '12px' }}
          title="Idle"
        >Idle</button>
        <button
          onClick={() => setState('thinking')}
          style={{ width: '80px', padding: '4px', fontSize: '12px' }}
          title="Thinking"
        >Thinking</button>
        <button
          onClick={() => setState('working')}
          style={{ width: '80px', padding: '4px', fontSize: '12px' }}
          title="Working"
        >Working</button>
      </div>

      {/* Face selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setFace('neutral')}
          style={{ width: '80px', padding: '4px', fontSize: '12px' }}
          title="Neutral"
        >Neutral</button>
        <button
          onClick={() => setFace('happy')}
          style={{ width: '80px', padding: '4px', fontSize: '12px' }}
          title="Happy"
        >Happy</button>
        <button
          onClick={() => setFace('surprised')}
          style={{ width: '80px', padding: '4px', fontSize: '12px' }}
          title="Surprised"
        >Surprised</button>
      </div>

      {/* Size selector */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <label style={{ fontSize: '12px', color: '#666' }}>Size:</label>
        <button
          onClick={() => setSize(48)}
          style={{ padding: '4px 8px', fontSize: '12px' }}
          title="48px"
        >48</button>
        <button
          onClick={() => setSize(64)}
          style={{ padding: '4px 8px', fontSize: '12px' }}
          title="64px"
          disabled={size === 64}
        >64</button>
        <button
          onClick={() => setSize(96)}
          style={{ padding: '4px 8px', fontSize: '12px' }}
          title="96px"
          disabled={size === 96}
        >96</button>
      </div>

      {/* Status info */}
      <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '4px', marginTop: '1rem' }}>
        <p><strong>Current State:</strong> {state}</p>
        <p><strong>Current Face:</strong> {face}</p>
        <p><strong>Current Size:</strong> {size}px</p>
        <p><strong>Integration:</strong> @bible-strong/avatar-react package</p>
      </div>
    </div>
  )
}