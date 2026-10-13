import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { solve, type Equip, type Joints, type Motion, type V2 } from './motions'
import type { SegmentKey } from './segments'

export interface DemoControl { playing: boolean; speed: number; t: number; yaw: number; targetYaw: number; restart: boolean }

const Z_LEG = 0.1
const Z_ARM = 0.2
const UP = new THREE.Vector3(0, 1, 0)

type P3 = [number, number, number]
const v3 = (p: V2, z = 0): P3 => [p[0], p[1], z]

function place(mesh: THREE.Object3D | null, a: P3, b: P3, r: number) {
  if (!mesh) return
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const d = B.clone().sub(A)
  const len = d.length()
  mesh.position.copy(A).addScaledVector(d, 0.5)
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(UP, d.normalize())
  mesh.scale.set(r, Math.max(len, 1e-4), r)
}

interface Seg { id: string; from: (j: Joints) => P3; to: (j: Joints) => P3; r: number; seg: SegmentKey | null }
interface Ball { id: string; at: (j: Joints) => P3; r: number; seg: SegmentKey | null }

const SEGS: Seg[] = []
const BALLS: Ball[] = []
for (const s of [-1, 1]) {
  const zl = s * Z_LEG
  const za = s * Z_ARM
  SEGS.push(
    { id: `shin${s}`, from: (j) => v3(j.ankle, zl), to: (j) => v3(j.knee, zl), r: 0.055, seg: 'shin' },
    { id: `thigh${s}`, from: (j) => v3(j.knee, zl), to: (j) => v3(j.hip, zl), r: 0.075, seg: 'thigh' },
    { id: `foot${s}`, from: (j) => v3(j.ankle, zl), to: (j) => v3(j.toe, zl), r: 0.04, seg: null },
    { id: `upper${s}`, from: (j) => v3(j.shoulder, za), to: (j) => v3(j.elbow, za), r: 0.05, seg: 'upperArm' },
    { id: `fore${s}`, from: (j) => v3(j.elbow, za), to: (j) => v3(j.wrist, za), r: 0.042, seg: 'foreArm' },
    { id: `hipbar${s}`, from: (j) => v3(j.hip, 0), to: (j) => v3(j.hip, zl), r: 0.06, seg: 'hip' },
    { id: `shbar${s}`, from: (j) => v3(j.shoulder, 0), to: (j) => v3(j.shoulder, za), r: 0.06, seg: 'shoulder' },
  )
  BALLS.push(
    { id: `knee${s}`, at: (j) => v3(j.knee, zl), r: 0.062, seg: 'thigh' },
    { id: `ankle${s}`, at: (j) => v3(j.ankle, zl), r: 0.05, seg: 'shin' },
    { id: `elbow${s}`, at: (j) => v3(j.elbow, za), r: 0.048, seg: 'upperArm' },
    { id: `wrist${s}`, at: (j) => v3(j.wrist, za), r: 0.04, seg: 'foreArm' },
    { id: `shoulder${s}`, at: (j) => v3(j.shoulder, za), r: 0.075, seg: 'shoulder' },
  )
}
SEGS.push({ id: 'torso', from: (j) => v3(j.hip), to: (j) => v3(j.shoulder), r: 0.11, seg: 'torso' })
BALLS.push(
  { id: 'pelvis', at: (j) => v3(j.hip), r: 0.115, seg: 'hip' },
  { id: 'chest', at: (j) => v3(j.shoulder), r: 0.12, seg: 'torso' },
  { id: 'head', at: (j) => v3(j.head), r: 0.105, seg: null },
)

const NEUTRAL = '#aab2c0'

function Figure({ motion, colors, equip, ctl }: { motion: Motion; colors: Record<SegmentKey, string>; equip: Equip; ctl: MutableRefObject<DemoControl> }) {
  const group = useRef<THREE.Group>(null)
  const segRefs = useRef<Record<string, THREE.Mesh | null>>({})
  const ballRefs = useRef<Record<string, THREE.Mesh | null>>({})
  const bar = useRef<THREE.Group>(null)
  const dumbL = useRef<THREE.Group>(null)
  const dumbR = useRef<THREE.Group>(null)

  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 14, 1), [])
  const ball = useMemo(() => new THREE.SphereGeometry(1, 16, 12), [])
  const plate = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 20), [])
  const mats = useMemo(() => {
    const m: Record<string, THREE.MeshStandardMaterial> = {}
    ;(Object.keys(colors) as SegmentKey[]).forEach((k) => { m[k] = new THREE.MeshStandardMaterial({ color: colors[k], roughness: 0.55, metalness: 0.05 }) })
    m.none = new THREE.MeshStandardMaterial({ color: NEUTRAL, roughness: 0.6 })
    m.iron = new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.4, metalness: 0.6 })
    m.bench = new THREE.MeshStandardMaterial({ color: '#3b4252', roughness: 0.8 })
    return m
  }, [colors])
  useEffect(() => () => { cyl.dispose(); ball.dispose(); plate.dispose() }, [cyl, ball, plate])
  useEffect(() => () => { Object.values(mats).forEach((m) => m.dispose()) }, [mats])

  useFrame((_, delta) => {
    const c = ctl.current
    if (c.restart) { c.t = 0; c.restart = false }
    if (c.playing) c.t = (c.t + (Math.min(delta, 0.1) * c.speed) / motion.seconds) % 1
    c.yaw += (c.targetYaw - c.yaw) * Math.min(1, delta * 6)
    if (group.current) group.current.rotation.y = c.yaw
    const j = solve(motion, c.t)
    for (const s of SEGS) place(segRefs.current[s.id], s.from(j), s.to(j), s.r)
    for (const b of BALLS) { const m = ballRefs.current[b.id]; if (m) m.position.set(...b.at(j)) }
    const hold = motion.holdAt === 'shoulder' ? j.shoulder : j.wrist
    if (bar.current) bar.current.position.set(hold[0] - (motion.holdAt === 'shoulder' ? 0.03 : 0), hold[1] + (motion.holdAt === 'shoulder' ? 0.06 : 0), 0)
    if (dumbL.current) dumbL.current.position.set(j.wrist[0], j.wrist[1], -Z_ARM)
    if (dumbR.current) dumbR.current.position.set(j.wrist[0], j.wrist[1], Z_ARM)
  })

  const mat = (k: SegmentKey | null) => (k ? mats[k] : mats.none)
  const barbell = equip === 'barbell' && !motion.fixedBar && motion.kind === 'chain'
  const dumbbells = equip === 'dumbbell' && !motion.fixedBar && motion.kind === 'chain'
  const anchor = solve(motion, 0).wrist

  return (
    <group ref={group}>
      {SEGS.map((s) => <mesh key={s.id} ref={(m) => { segRefs.current[s.id] = m }} geometry={cyl} material={mat(s.seg)} scale={[s.r, 1, s.r]} />)}
      {BALLS.map((b) => <mesh key={b.id} ref={(m) => { ballRefs.current[b.id] = m }} geometry={ball} material={mat(b.seg)} scale={b.r} />)}

      {barbell && (
        <group ref={bar}>
          <mesh geometry={cyl} material={mats.iron} rotation={[Math.PI / 2, 0, 0]} scale={[0.016, 1.5, 0.016]} />
          {[-0.62, 0.62].map((z) => <mesh key={z} geometry={plate} material={mats.iron} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} scale={[0.19, 0.045, 0.19]} />)}
        </group>
      )}
      {dumbbells && [dumbL, dumbR].map((r, i) => (
        <group key={i} ref={r}>
          <mesh geometry={cyl} material={mats.iron} rotation={[Math.PI / 2, 0, 0]} scale={[0.018, 0.22, 0.018]} />
          {[-0.1, 0.1].map((z) => <mesh key={z} geometry={plate} material={mats.iron} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} scale={[0.07, 0.04, 0.07]} />)}
        </group>
      ))}
      {motion.fixedBar && (
        <group position={[anchor[0], anchor[1] + 0.03, 0]}>
          <mesh geometry={cyl} material={mats.iron} rotation={[Math.PI / 2, 0, 0]} scale={[0.02, 1.2, 0.02]} />
          {[-0.6, 0.6].map((z) => <mesh key={z} geometry={cyl} material={mats.iron} position={[0, 0.9, z]} scale={[0.02, 1.8, 0.02]} />)}
        </group>
      )}
      {motion.bench && (
        <group>
          <mesh material={mats.bench} position={[-0.25, 0.32, 0]}><boxGeometry args={[1.25, 0.1, 0.34]} /></mesh>
          {[-0.75, 0.2].map((x) => <mesh key={x} material={mats.iron} position={[x, 0.135, 0]}><boxGeometry args={[0.05, 0.27, 0.34]} /></mesh>)}
        </group>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[1.5, 40]} />
        <meshStandardMaterial color="#222834" roughness={0.95} />
      </mesh>
    </group>
  )
}

/** Where to aim the camera and how far back to stand, from the extent of the whole repetition. */
export function frame(motion: Motion): { cx: number; cy: number; dist: number } {
  let minX = 9, maxX = -9, minY = 9, maxY = -9
  for (let i = 0; i < 24; i++) {
    const j = solve(motion, i / 24)
    for (const p of Object.values(j)) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]) }
  }
  minY = Math.min(minY, 0)
  const h = Math.max(maxY - minY, (maxX - minX) * 0.75) + 0.5
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, dist: h / (2 * Math.tan((30 * Math.PI) / 360)) }
}

export default function DemoScene({ motion, colors, equip, ctl }: { motion: Motion; colors: Record<SegmentKey, string>; equip: Equip; ctl: MutableRefObject<DemoControl> }) {
  const f = useMemo(() => frame(motion), [motion])
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [f.cx, f.cy, f.dist], fov: 30, near: 0.1, far: 60 }} gl={{ antialias: true, alpha: true }}
      onCreated={({ camera }) => camera.lookAt(f.cx, f.cy, 0)}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.5} />
      <group position={[0, 0, 0]}>
        <Figure motion={motion} colors={colors} equip={equip} ctl={ctl} />
      </group>
    </Canvas>
  )
}
