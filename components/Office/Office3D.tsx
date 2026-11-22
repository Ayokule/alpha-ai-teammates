"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import { Tween, update as tweenUpdate, Easing } from "@tweenjs/tween.js"
import { Department, Bot } from "@/types"
import { BotStatusRing } from "./BotStatusRing"

// =============================================================================
// CONSTANTS & TYPES
// =============================================================================

const FLOOR_HEIGHT = 4
const FLOOR_WIDTH = 20
const FLOOR_DEPTH = 16
const DESK_WIDTH = 2.5
const DESK_DEPTH = 1.5
const AVATAR_RADIUS = 0.4

// "Cream field notes" color palette
const COLORS = {
  background: 0xF5F0E8,
  paper: 0xFDFBF7,
  ink: 0x2D2D2D,
  inkLight: 0x6B6B6B,
  grid: 0xE8E0D0,
  floorBase: 0xF5F0E8,
  elevator: 0xD4C4B0,
  elevatorAccent: 0x8B7D6B,
  lobby: 0xE8DFD4,
  garden: 0xD4E8D4,
  shadow: 0x000000,
}

type DetailLevel = "full" | "simplified" | "slab"

interface FloorData {
  index: number
  department: Department | null
  y: number
  detailLevel: DetailLevel
}

interface DeskPosition {
  x: number
  z: number
  botId: string
  botName: string
  avatarColor: string
  status: "online" | "offline" | "waiting_approval"
}

// =============================================================================
// LOD CALCULATION
// =============================================================================

function getDetailLevel(floorIndex: number, currentFloor: number, totalFloors: number): DetailLevel {
  const distance = Math.abs(floorIndex - currentFloor)
  if (distance <= 1) return "full"
  if (distance <= 3) return "simplified"
  return "slab"
}

// =============================================================================
// DESK POSITIONS GENERATOR
// =============================================================================

function generateDeskPositions(
  department: Department | null,
  floorIndex: number
): DeskPosition[] {
  if (!department || !department.bots) return []

  const positions: DeskPosition[] = []
  const cols = 3
  const rows = Math.ceil(department.bots.length / cols)
  const startX = -(cols - 1) * DESK_WIDTH / 2
  const startZ = -(rows - 1) * DESK_DEPTH / 2

  department.bots.forEach((bot, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.push({
      x: startX + col * DESK_WIDTH,
      z: startZ + row * DESK_DEPTH,
      botId: bot.id,
      botName: bot.name,
      avatarColor: bot.avatar_color,
      status: "online" as const, // TODO: derive from realtime
    })
  })

  return positions
}

// =============================================================================
// COMPONENTS
// =============================================================================

// --- Floor Slab (LOD: slab) ---
function FloorSlab({ floorData, isCurrentFloor }: { floorData: FloorData; isCurrentFloor: boolean }) {
  const { department, y, detailLevel } = floorData
  const color = department?.floor_tint || COLORS.floorBase
  const isLobby = floorData.index === 0

  if (detailLevel !== "slab") return null

  return (
    <group position={[0, y, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[FLOOR_WIDTH, 0.3, FLOOR_DEPTH]} />
        <meshStandardMaterial
          color={isLobby ? COLORS.lobby : color}
          roughness={0.9}
          metalness={0}
        />
      </mesh>
      {isLobby && (
        <mesh position={[0, 0.2, 0]} receiveShadow>
          <planeGeometry args={[FLOOR_WIDTH * 0.8, FLOOR_DEPTH * 0.8]} />
          <meshStandardMaterial
            color={COLORS.garden}
            roughness={1}
            metalness={0}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  )
}

// --- Simplified Floor (LOD: simplified) ---
function SimplifiedFloor({ floorData }: { floorData: FloorData }) {
  const { department, y, detailLevel } = floorData
  const color = department?.floor_tint || COLORS.floorBase
  const isLobby = floorData.index === 0

  if (detailLevel !== "simplified") return null

  return (
    <group position={[0, y, 0]}>
      {/* Floor slab with baked texture look */}
      <mesh receiveShadow>
        <boxGeometry args={[FLOOR_WIDTH, 0.3, FLOOR_DEPTH]} />
        <meshStandardMaterial
          color={isLobby ? COLORS.lobby : color}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Single representative desk instance */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[DESK_WIDTH, 0.8, DESK_DEPTH]} />
        <meshStandardMaterial color={0xD4C4B0} roughness={0.7} metalness={0} />
      </mesh>

      {/* Department label as texture-like plane */}
      {department && (
        <mesh position={[0, 0.16, -FLOOR_DEPTH / 2 + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[8, 1.5]} />
          <meshBasicMaterial
            color={COLORS.ink}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

// --- Full Detail Floor (LOD: full) ---
function FullFloor({
  floorData,
  deskPositions,
  onBotClick,
}: {
  floorData: FloorData
  deskPositions: DeskPosition[]
  onBotClick: (bot: Bot & { department?: Department }) => void
}) {
  const { department, y, detailLevel, index } = floorData
  const color = department?.floor_tint || COLORS.floorBase
  const isLobby = index === 0

  if (detailLevel !== "full") return null

  return (
    <group position={[0, y, 0]}>
      {/* Floor slab */}
      <mesh receiveShadow>
        <boxGeometry args={[FLOOR_WIDTH, 0.3, FLOOR_DEPTH]} />
        <meshStandardMaterial
          color={isLobby ? COLORS.lobby : color}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Lobby garden decoration */}
      {isLobby && (
        <>
          <mesh position={[0, 0.2, 0]} receiveShadow>
            <planeGeometry args={[FLOOR_WIDTH * 0.8, FLOOR_DEPTH * 0.8]} />
            <meshStandardMaterial
              color={COLORS.garden}
              roughness={1}
              metalness={0}
              transparent
              opacity={0.4}
            />
          </mesh>
          {/* Decorative plants */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 6, 1, side * 4]}
              castShadow
            >
              <coneGeometry args={[0.8, 2, 8]} />
              <meshStandardMaterial color={0x4A7C4A} roughness={0.9} />
            </mesh>
          ))}
        </>
      )}

      {/* Desks with avatars */}
      {deskPositions.map((pos) => (
        <DeskWithAvatar
          key={pos.botId}
          position={[pos.x, 0.6, pos.z]}
          avatarColor={pos.avatarColor}
          botName={pos.botName}
          status={pos.status}
          onClick={() => {
            // Find the full bot object and call onBotClick
            const bot = {
              id: pos.botId,
              name: pos.botName,
              role: "worker" as const,
              avatar_color: pos.avatarColor,
              is_head_immutable: false,
              department_id: "",
              workspace_id: "",
              instructions: "",
              monthly_budget_usd: 0,
              budget_alert_threshold: 0,
              free_llmapi_url: null,
              free_llmapi_key: null,
              created_at: "",
              updated_at: "",
              department: floorData.department || undefined,
            }
            onBotClick(bot)
          }}
        />
      ))}

      {/* Department name label */}
      {department && (
        <Html
          position={[0, 0.5, -FLOOR_DEPTH / 2 + 1]}
          rotation={[-Math.PI / 2, 0, 0]}
          style={{
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#2D2D2D",
              textShadow: "0 0 4px rgba(255,255,255,0.8)",
              whiteSpace: "nowrap",
              opacity: 0.8,
            }}
          >
            {department.name}
          </div>
        </Html>
      )}
    </group>
  )
}

// --- Desk with Avatar (Instanced-ready) ---
function DeskWithAvatar({
  position,
  avatarColor,
  botName,
  status,
  onClick,
}: {
  position: [number, number, number]
  avatarColor: string
  botName: string
  status: "online" | "offline" | "waiting_approval"
  onClick?: () => void
}) {
  return (
    <group position={position} onClick={onClick}>
      {/* Desk */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[DESK_WIDTH, 0.8, DESK_DEPTH]} />
        <meshStandardMaterial color={0xD4C4B0} roughness={0.7} metalness={0} />
      </mesh>

      {/* Avatar base */}
      <mesh position={[0, 0.9, -DESK_DEPTH / 2 + 0.3]} castShadow>
        <cylinderGeometry args={[AVATAR_RADIUS, AVATAR_RADIUS, 1.2, 12]} />
        <meshStandardMaterial
          color={avatarColor}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* Avatar head */}
      <mesh position={[0, 1.7, -DESK_DEPTH / 2 + 0.3]} castShadow>
        <sphereGeometry args={[AVATAR_RADIUS * 0.7, 12, 12]} />
        <meshStandardMaterial
          color={avatarColor}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* Status ring - HTML overlay */}
      <BotStatusRing
        position={[0, 2.2, -DESK_DEPTH / 2 + 0.3]}
        status={status}
        botName={botName}
      />
    </group>
  )
}

// --- Elevator Shaft ---
function ElevatorShaft({ totalFloors }: { totalFloors: number }) {
  const height = totalFloors * FLOOR_HEIGHT + 4

  return (
    <group position={[FLOOR_WIDTH / 2 + 2, height / 2, 0]}>
      {/* Shaft structure */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3, height, 3]} />
        <meshStandardMaterial
          color={COLORS.elevator}
          roughness={0.6}
          metalness={0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Elevator car - will be animated */}
      <ElevatorCar totalFloors={totalFloors} />
    </group>
  )
}

// --- Elevator Car (Animated) ---
function ElevatorCar({ totalFloors }: { totalFloors: number }) {
  const [currentFloor, setCurrentFloor] = useState(0)
  const [targetFloor, setTargetFloor] = useState(0)
  const carRef = useRef<THREE.Mesh>(null)
  const isMoving = useRef(false)

  const moveToFloor = useCallback((floor: number) => {
    if (floor < 0 || floor >= totalFloors) return
    if (floor === currentFloor) return

    setTargetFloor(floor)
    isMoving.current = true

    const startY = currentFloor * FLOOR_HEIGHT + 2
    const endY = floor * FLOOR_HEIGHT + 2

    // Animate with tween.js
    new Tween({ y: startY })
      .to({ y: endY }, 800)
      .easing(Easing.Quadratic.InOut)
      .onUpdate((obj) => {
        if (carRef.current) {
          carRef.current.position.y = obj.y
        }
      })
      .onComplete(() => {
        setCurrentFloor(floor)
        isMoving.current = false
      })
      .start()
  }, [currentFloor, totalFloors])

  // Update tweens each frame
  useFrame(() => {
    tweenUpdate()
  })

  return (
    <>
      <mesh
        ref={carRef}
        position={[0, currentFloor * FLOOR_HEIGHT + 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[2.5, FLOOR_HEIGHT - 1, 2.5]} />
        <meshStandardMaterial
          color={COLORS.elevatorAccent}
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      {/* Elevator call buttons on each floor */}
      {Array.from({ length: totalFloors }, (_, i) => (
        <ElevatorCallButton
          key={i}
          floor={i}
          currentFloor={currentFloor}
          targetFloor={targetFloor}
          isMoving={isMoving.current}
          onClick={moveToFloor}
          position={[1.8, i * FLOOR_HEIGHT + 2, 1.8]}
          totalFloors={totalFloors}
        />
      ))}
    </>
  )
}

// --- Elevator Call Button ---
function ElevatorCallButton({
  floor,
  currentFloor,
  targetFloor,
  isMoving,
  onClick,
  position,
  totalFloors,
}: {
  floor: number
  currentFloor: number
  targetFloor: number
  isMoving: boolean
  onClick: (floor: number) => void
  position: [number, number, number]
  totalFloors: number
}) {
  const isActive = currentFloor === floor || targetFloor === floor
  const isCalled = targetFloor === floor && isMoving

  return (
    <Html
      position={position}
      rotation={[0, -Math.PI / 2, 0]}
      style={{ transform: "translate(-50%, -50%)" }}
    >
      <button
        onClick={() => onClick(floor)}
        disabled={isMoving && currentFloor !== floor}
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "8px",
          border: "none",
          background: isActive
            ? isCalled
              ? "#8B7D6B"
              : "#D4C4B0"
            : "#E8E0D0",
          color: "#2D2D2D",
          fontSize: "14px",
          fontWeight: 600,
          cursor: isMoving && currentFloor !== floor ? "not-allowed" : "pointer",
          boxShadow: isActive
            ? "0 2px 8px rgba(0,0,0,0.15)"
            : "0 1px 3px rgba(0,0,0,0.1)",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {floor === 0 ? "🌿" : floor === totalFloors - 1 ? "🏢" : floor}
      </button>
    </Html>
  )
}

// =============================================================================
// MAIN OFFICE 3D COMPONENT
// =============================================================================

interface Office3DProps {
  departments: Department[]
  currentFloor: number
  onFloorChange: (floor: number) => void
  onBotClick: (bot: Bot & { department?: Department }) => void
}

export function Office3D({ departments, currentFloor, onFloorChange, onBotClick }: Office3DProps) {
  const floors = departments
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((dept, i) => ({
      index: i,
      department: dept,
      y: i * FLOOR_HEIGHT,
      detailLevel: getDetailLevel(i, currentFloor, departments.length),
    }))

  // Add lobby/garden at index 0
  const allFloors = [
    { index: 0, department: null, y: 0, detailLevel: getDetailLevel(0, currentFloor, departments.length + 1) },
    ...floors.map((f, i) => ({ ...f, index: i + 1 })),
  ]

  const totalFloors = allFloors.length

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{ position: [30, 15, 30], fov: 30 }}
        shadows
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#F5F0E8"]} />
        <fog attach="fog" args={["#F5F0E8", 20, 80]} />

        {/* Lighting */}
        <ambientLight intensity={0.6} color={COLORS.paper} />
        <directionalLight
          position={[20, 30, 20]}
          intensity={1.2}
          color={0xFFF8F0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={100}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <hemisphereLight color={0xFFF8F0} groundColor={COLORS.grid} intensity={0.4} />

        {/* Grid floor reference */}
        <gridHelper args={[80, 2, COLORS.grid, COLORS.inkLight]} position={[0, -0.01, 0]} />

        {/* Floors with LOD */}
        {allFloors.map((floorData) => {
          const deskPositions = generateDeskPositions(floorData.department, floorData.index)

          switch (floorData.detailLevel) {
            case "full":
              return (
                <FullFloor
                  key={floorData.index}
                  floorData={floorData}
                  deskPositions={deskPositions}
                  onBotClick={onBotClick}
                />
              )
            case "simplified":
              return <SimplifiedFloor key={floorData.index} floorData={floorData} />
            case "slab":
              return <FloorSlab key={floorData.index} floorData={floorData} isCurrentFloor={floorData.index === currentFloor} />
          }
        })}

        {/* Elevator shaft */}
        <ElevatorShaft totalFloors={totalFloors} />

        {/* Edge indicators */}
        {currentFloor > 0 && (
          <Html
            position={[FLOOR_WIDTH / 2 + 5, currentFloor * FLOOR_HEIGHT + 2, 0]}
            style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}
          >
            <div style={{ fontSize: "12px", color: "#8B7D6B", whiteSpace: "nowrap" }}>
              ▲ {currentFloor} more above
            </div>
          </Html>
        )}
        {currentFloor < allFloors.length - 1 && (
          <Html
            position={[FLOOR_WIDTH / 2 + 5, currentFloor * FLOOR_HEIGHT + 2, 0]}
            style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}
          >
            <div style={{ fontSize: "12px", color: "#8B7D6B", whiteSpace: "nowrap" }}>
              ▼ {allFloors.length - 1 - currentFloor} more below
            </div>
          </Html>
        )}
      </Canvas>

      {/* Floor navigator sidebar */}
      <FloorNavigator
        floors={allFloors}
        currentFloor={currentFloor}
        onFloorChange={onFloorChange}
      />
    </div>
  )
}

// --- Floor Navigator Sidebar ---
function FloorNavigator({
  floors,
  currentFloor,
  onFloorChange,
}: {
  floors: FloorData[]
  currentFloor: number
  onFloorChange: (floor: number) => void
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 20,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 10,
      }}
    >
      {floors
        .slice()
        .reverse()
        .map((floor) => (
          <button
            key={floor.index}
            onClick={() => onFloorChange(floor.index)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              border: "none",
              background: floor.index === currentFloor ? "#6366F1" : "#FFFFFF",
              color: floor.index === currentFloor ? "#FFFFFF" : "#2D2D2D",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <span>{floor.index === 0 ? "🌿" : floor.department?.floor_tint ? "■" : "▢"}</span>
            <span style={{ fontSize: "10px" }}>
              {floor.index === 0 ? "Lobby" : floor.department?.name?.slice(0, 3) || "F" + floor.index}
            </span>
          </button>
        ))}
    </div>
  )
}