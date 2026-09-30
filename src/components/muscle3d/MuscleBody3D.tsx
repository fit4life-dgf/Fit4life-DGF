import { useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildParts, type BodyPart } from './parts'
import { BODY_COLORS } from './muscleMap'

export interface BodyControl { rotY: number; targetRotY: number; zoom: number; targetZoom: number }

export interface SceneProps {
  gender: 'male' | 'female'
  selected: string[]
  secondary: string[]
  colors: Record<string, string>
  pulse: string[]
  interactive: boolean
  ctl: MutableRefObject<BodyControl>
  onPick: (id: string) => void
  onHover: (id: string | null) => void
}

const BASE_Z = 3.75

interface PartProps {
  part: BodyPart
  geo: THREE.BufferGeometry
  color: string
  emissive: string
  glow: number
  pulse: boolean
  interactive: boolean
  onPick: (id: string) => void
  onHover: (id: string | null) => void
}

function Part({ part, geo, color, emissive, glow, pulse, interactive, onPick, onHover }: PartProps) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const m = mat.current
    if (m && pulse) m.emissiveIntensity = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2))
  })
  const id = part.muscle
  return (
    <mesh
      name={part.name}
      geometry={geo}
      position={part.position}
      rotation={part.rotation}
      scale={part.scale}
      onPointerOver={(e) => { e.stopPropagation(); if (interactive && id) onHover(id) }}
      onPointerOut={() => { if (interactive && id) onHover(null) }}
      onClick={(e) => {
        e.stopPropagation()
        if (!interactive || !id || e.delta > 5) return
        onPick(id)
      }}
    >
      <meshStandardMaterial ref={mat} color={color} emissive={emissive} emissiveIntensity={glow} roughness={0.55} metalness={0.05} />
    </mesh>
  )
}

function Body({ gender, selected, secondary, colors, pulse, interactive, ctl, onPick, onHover }: SceneProps) {
  const group = useRef<THREE.Group>(null)
  const parts = useMemo(() => buildParts(gender), [gender])
  const geos = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 28, 18)
    const caps = new Map<string, THREE.BufferGeometry>()
    for (const p of parts) if (p.capsule) { const k = p.capsule.join(':'); if (!caps.has(k)) caps.set(k, new THREE.CapsuleGeometry(p.capsule[0], p.capsule[1], 8, 20)) }
    return { sphere, caps }
  }, [parts])
  const [hover, setHover] = useState<string | null>(null)

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const c = ctl.current
    const k = Math.min(1, delta * 7)
    g.rotation.y += (c.targetRotY - g.rotation.y) * k
    c.rotY = g.rotation.y
    c.zoom += (c.targetZoom - c.zoom) * k
    state.camera.position.z = BASE_Z / c.zoom
  })

  const hoverTo = (id: string | null) => { setHover(id); onHover(id) }

  return (
    <group ref={group} position={[0, -0.02, 0]}>
      {parts.map((p) => {
        const m = p.muscle
        let color: string = BODY_COLORS.base
        let emissive = '#000000'
        let glow = 0
        if (m) {
          const custom = colors[m]
          if (custom) color = custom
          else if (selected.includes(m)) { color = BODY_COLORS.selected; emissive = BODY_COLORS.selected; glow = 0.35 }
          else if (secondary.includes(m)) { color = BODY_COLORS.secondary; emissive = BODY_COLORS.secondary; glow = 0.15 }
          else if (hover === m) color = BODY_COLORS.hover
          else color = BODY_COLORS.idle
        }
        return (
          <Part key={p.key} part={p} geo={p.capsule ? (geos.caps.get(p.capsule.join(':')) ?? geos.sphere) : geos.sphere} color={color} emissive={emissive} glow={glow}
            pulse={m != null && pulse.includes(m)} interactive={interactive} onPick={onPick} onHover={hoverTo} />
        )
      })}
    </group>
  )
}

/** The 3D scene. Loaded lazily so three.js is only downloaded when a body is shown. */
export default function BodyScene(props: SceneProps) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, BASE_Z], fov: 30, near: 0.1, far: 50 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.05} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.7} />
      <directionalLight position={[-3, 1.5, -4]} intensity={1.0} />
      <Body {...props} />
    </Canvas>
  )
}
