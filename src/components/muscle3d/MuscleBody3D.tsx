import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { buildParts, type BodyPart } from './parts'
import { BODY_COLORS } from './muscleMap'
import { layerOf, resolveMuscle, type Layer } from './meshMap'

export interface BodyControl { rotY: number; targetRotY: number; zoom: number; targetZoom: number }
export type ViewMode = 'muscle' | 'skin' | 'skeleton'
/** Playback state shared with the UI through a ref, so scrubbing never re-renders the 3D scene. */
export interface AnimControl { playing: boolean; speed: number; loop: boolean; seek: number | null; restart: boolean; time: number; duration: number }
export interface ModelStatus { state: 'loading' | 'ready' | 'placeholder'; progress: number; clips: string[]; hasSkin: boolean; hasSkeleton: boolean }

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
  /** First url to try; a missing or broken file falls through to `fallbackUrl`, then to the built-in placeholder body. */
  modelUrl: string | null
  fallbackUrl: string | null
  view: ViewMode
  clip: string | null
  anim: MutableRefObject<AnimControl>
  onStatus: (s: ModelStatus) => void
}

const BASE_Z = 3.75

function paint(m: string, p: { selected: string[]; secondary: string[]; colors: Record<string, string>; hover: string | null }) {
  const custom = p.colors[m]
  if (p.selected.includes(m)) return { color: BODY_COLORS.selected as string, emissive: BODY_COLORS.selected as string, glow: 0.4 }
  if (custom) return { color: custom, emissive: custom, glow: custom === BODY_COLORS.inactive ? 0 : 0.18 }
  if (p.secondary.includes(m)) return { color: BODY_COLORS.secondary as string, emissive: BODY_COLORS.secondary as string, glow: 0.15 }
  if (p.hover === m) return { color: BODY_COLORS.hover as string, emissive: '#000000', glow: 0 }
  return { color: BODY_COLORS.idle as string, emissive: '#000000', glow: 0 }
}

/** Smooth rotation and zoom shared by the procedural and the .glb body. */
function useRig(group: MutableRefObject<THREE.Group | null>, ctl: MutableRefObject<BodyControl>) {
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
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry?.dispose()
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose()
      mat.dispose()
    }
  })
}

const missingUrls = new Set<string>()

interface GlbState { state: 'loading' | 'ready' | 'missing'; progress: number; gltf: GLTF | null; url: string | null }

/** Loads the first usable .glb from the list. A 404, an HTML fallback page or a parse error all count as "missing". */
function useGlb(urls: (string | null)[]): GlbState {
  const key = urls.filter(Boolean).join('|')
  const [st, setSt] = useState<GlbState>({ state: key ? 'loading' : 'missing', progress: 0, gltf: null, url: null })
  useEffect(() => {
    const list = key ? key.split('|').filter((u) => !missingUrls.has(u)) : []
    if (!list.length) { setSt({ state: 'missing', progress: 0, gltf: null, url: null }); return }
    let dead = false
    let loaded: GLTF | null = null
    setSt({ state: 'loading', progress: 0, gltf: null, url: null })
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder())
    const attempt = (i: number) => {
      if (i >= list.length) { if (!dead) setSt({ state: 'missing', progress: 0, gltf: null, url: null }); return }
      loader.load(
        list[i],
        (g) => {
          if (dead) { disposeTree(g.scene); return }
          loaded = g
          setSt({ state: 'ready', progress: 1, gltf: g, url: list[i] })
        },
        (ev) => { if (!dead && ev.total) setSt((s) => (s.state === 'loading' ? { ...s, progress: Math.min(1, ev.loaded / ev.total) } : s)) },
        () => { missingUrls.add(list[i]); if (!dead) attempt(i + 1) },
      )
    }
    attempt(0)
    return () => { dead = true; if (loaded) disposeTree(loaded.scene) }
  }, [key])
  return st
}

interface Entry { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; muscle: string | null; layer: Layer }

function layerFor(mesh: THREE.Mesh): { layer: Layer; muscle: string | null } {
  for (const n of [mesh.name, mesh.parent?.name ?? '']) {
    if (!n) continue
    const l = layerOf(n)
    if (l !== 'other') return { layer: l, muscle: l === 'muscle' ? resolveMuscle(n) : null }
  }
  return { layer: 'other', muscle: null }
}

function GlbBody({ gltf, selected, secondary, colors, pulse, interactive, ctl, onPick, onHover, view, clip, anim }: SceneProps & { gltf: GLTF }) {
  const group = useRef<THREE.Group>(null)
  const [hover, setHover] = useState<string | null>(null)
  const built = useMemo(() => {
    const root = cloneSkinned(gltf.scene) as THREE.Object3D
    const box = new THREE.Box3().setFromObject(root, true)
    const size = box.getSize(new THREE.Vector3())
    const centre = box.getCenter(new THREE.Vector3())
    const k = size.y > 0 ? 1.8 / size.y : 1
    const entries: Entry[] = []
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const { layer, muscle } = layerFor(mesh)
      const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
      let mat: THREE.MeshStandardMaterial
      if (layer === 'muscle') mat = new THREE.MeshStandardMaterial({ color: BODY_COLORS.idle, roughness: 0.55, metalness: 0.05 })
      else if ((src as THREE.MeshStandardMaterial).isMeshStandardMaterial) mat = src.clone()
      else mat = new THREE.MeshStandardMaterial({ color: (src as { color?: THREE.Color }).color ?? BODY_COLORS.base, roughness: 0.7 })
      mesh.material = mat
      mesh.userData.muscle = muscle
      entries.push({ mesh, mat, muscle, layer })
    })
    return { root, entries, k, centre }
  }, [gltf])

  const { root, entries, k, centre } = built
  const hasSkin = entries.some((e) => e.layer === 'skin')
  const hasSkeleton = entries.some((e) => e.layer === 'skeleton')
  const pulseRef = useRef(pulse)
  pulseRef.current = pulse

  useEffect(() => () => { for (const e of entries) e.mat.dispose() }, [entries])

  // colours and layer visibility
  useEffect(() => {
    for (const e of entries) {
      const v = view === 'skin' && !hasSkin ? 'muscle' : view === 'skeleton' && !hasSkeleton ? 'muscle' : view
      let visible = true
      let ghost = false
      if (e.layer === 'muscle') { visible = v === 'muscle' || v === 'skeleton'; ghost = v === 'skeleton' }
      else if (e.layer === 'skin') visible = v === 'skin' || (v === 'muscle' && false)
      else if (e.layer === 'skeleton') visible = v === 'skeleton'
      e.mesh.visible = visible
      if (e.layer === 'muscle' && e.muscle) {
        const p = paint(e.muscle, { selected, secondary, colors, hover })
        e.mat.color.set(p.color)
        e.mat.emissive.set(p.emissive)
        e.mat.emissiveIntensity = p.glow
      }
      const t = ghost
      if (e.mat.transparent !== t) { e.mat.transparent = t; e.mat.needsUpdate = true }
      e.mat.opacity = t ? 0.14 : 1
      e.mat.depthWrite = !t
    }
  }, [entries, selected, secondary, colors, hover, view, hasSkin, hasSkeleton])

  // animation
  const clips = gltf.animations
  const mixer = useMemo(() => (clips.length ? new THREE.AnimationMixer(root) : null), [root, clips])
  const action = useRef<THREE.AnimationAction | null>(null)
  useEffect(() => {
    if (!mixer) { action.current = null; anim.current.duration = 0; return }
    const c = clips.find((x) => x.name === clip) ?? clips[0]
    const a = mixer.clipAction(c)
    a.reset().play()
    mixer.update(0)
    action.current = a
    anim.current.duration = c.duration
    anim.current.time = 0
    return () => { a.stop(); mixer.uncacheClip(c); action.current = null }
  }, [mixer, clips, clip, anim])
  useEffect(() => () => { mixer?.stopAllAction(); mixer?.uncacheRoot(root) }, [mixer, root])

  useRig(group, ctl)
  useFrame(({ clock }, delta) => {
    const a = action.current
    const c = anim.current
    if (mixer && a) {
      a.setLoop(c.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
      a.clampWhenFinished = true
      if (c.restart) { a.reset().play(); c.restart = false }
      if (c.seek != null) { a.enabled = true; a.paused = false; a.time = Math.max(0, Math.min(c.duration, c.seek)); mixer.update(0); c.seek = null }
      else if (c.playing) {
        if (!a.enabled) { a.reset().play() }
        mixer.update(delta * c.speed)
        if (!c.loop && a.time >= c.duration - 1e-3) c.playing = false
      }
      c.time = a.time
    }
    const p = pulseRef.current
    if (p.length) {
      const s = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2))
      for (const e of entries) if (e.muscle && p.includes(e.muscle) && e.mesh.visible) e.mat.emissiveIntensity = s
    }
  })

  const firstMuscle = (e: ThreeEvent<PointerEvent | MouseEvent>): string | null => {
    for (const i of e.intersections) {
      const m = i.object.userData.muscle as string | null | undefined
      if (i.object.visible && m) return m
      if (i.object.visible && i.object.userData.muscle === null) return null
    }
    return null
  }
  const active = interactive && view === 'muscle'

  return (
    <group ref={group} position={[0, -0.02, 0]}>
      <group scale={k} position={[-centre.x * k, -centre.y * k, -centre.z * k]}>
        <primitive
          object={root}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            if (!active) return
            e.stopPropagation()
            const m = firstMuscle(e)
            if (m !== hover) { setHover(m); onHover(m) }
          }}
          onPointerOut={() => { if (hover) { setHover(null); onHover(null) } }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (!active || e.delta > 5) return
            e.stopPropagation()
            const m = firstMuscle(e)
            if (m) onPick(m)
          }}
        />
      </group>
    </group>
  )
}

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

  useRig(group, ctl)

  const hoverTo = (id: string | null) => { setHover(id); onHover(id) }

  return (
    <group ref={group} position={[0, -0.02, 0]}>
      {parts.map((p) => {
        const m = p.muscle
        let color: string = BODY_COLORS.base
        let emissive = '#000000'
        let glow = 0
        if (m) ({ color, emissive, glow } = paint(m, { selected, secondary, colors, hover }))
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
  const glb = useGlb([props.modelUrl, props.fallbackUrl])
  const status = useRef(props.onStatus)
  status.current = props.onStatus
  const gltf = glb.gltf
  useEffect(() => {
    if (glb.state === 'ready' && gltf) {
      let hasSkin = false
      let hasSkeleton = false
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const l = layerFor(m).layer
        if (l === 'skin') hasSkin = true
        if (l === 'skeleton') hasSkeleton = true
      })
      status.current({ state: 'ready', progress: 1, clips: gltf.animations.map((a) => a.name), hasSkin, hasSkeleton })
    } else if (glb.state === 'loading') status.current({ state: 'loading', progress: glb.progress, clips: [], hasSkin: false, hasSkeleton: false })
    else status.current({ state: 'placeholder', progress: 1, clips: [], hasSkin: false, hasSkeleton: false })
  }, [glb.state, glb.progress, gltf])

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, BASE_Z], fov: 30, near: 0.1, far: 50 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.05} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.7} />
      <directionalLight position={[-3, 1.5, -4]} intensity={1.0} />
      {glb.state === 'ready' && gltf ? <GlbBody {...props} gltf={gltf} /> : glb.state === 'missing' ? <Body {...props} /> : null}
    </Canvas>
  )
}
