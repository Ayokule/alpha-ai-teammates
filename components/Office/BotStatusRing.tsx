"use client"

import { useFrame } from "@react-three/fiber"
import { useRef, useEffect } from "react"
import * as THREE from "three"

interface BotStatusRingProps {
  position: [number, number, number]
  status: "online" | "offline" | "waiting_approval"
  botName: string
}

const STATUS_COLORS = {
  online: "#4CAF50",
  offline: "#9E9E9E",
  waiting_approval: "#FF9800",
}

const STATUS_LABELS = {
  online: "● Online",
  offline: "○ Offline",
  waiting_approval: "◐ Waiting",
}

export function BotStatusRing({ position, status, botName }: BotStatusRingProps) {
  const ref = useRef<HTMLDivElement>(null)
  const worldPosition = new THREE.Vector3(...position)
  const cameraRef = useRef<THREE.Camera | null>(null)

  // Get camera reference
  useFrame((state) => {
    cameraRef.current = state.camera
  })

  // Project 3D position to 2D screen coordinates
  useFrame(() => {
    if (!ref.current || !cameraRef.current) return

    const vector = worldPosition.clone().project(cameraRef.current)
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight

    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
    ref.current.style.display = vector.z < 1 ? "flex" : "none"
  })

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 12,
        background: "rgba(255, 255, 255, 0.95)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        fontSize: "11px",
        fontWeight: 500,
        color: "#2D2D2D",
        whiteSpace: "nowrap",
        border: `1px solid ${STATUS_COLORS[status]}33`,
        backdropFilter: "blur(4px)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: STATUS_COLORS[status],
          boxShadow: `0 0 6px ${STATUS_COLORS[status]}`,
          animation: status === "waiting_approval" ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      />
      <span>{STATUS_LABELS[status]}</span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}