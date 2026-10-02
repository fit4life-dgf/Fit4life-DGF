import * as THREE from 'three'
import { layerOf, normaliseMeshName, resolveMuscle, type Layer } from './meshMap'
import { MUSCLES } from './muscleMap'

/** Frees geometry, materials and textures. Safe to call on any object tree, more than once. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.geometry?.dispose()
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of mats) {
      if (!mat) continue
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose()
      mat.dispose()
    }
  })
}

/** Layer and muscle for a mesh. The mesh's own name is tried first, then its parent's (exporters sometimes name only the group). */
export function layerFor(mesh: THREE.Object3D): { layer: Layer; muscle: string | null } {
  for (const n of [mesh.name, mesh.parent?.name ?? '']) {
    if (!n) continue
    const l = layerOf(n)
    if (l !== 'other') return { layer: l, muscle: l === 'muscle' ? resolveMuscle(n) : null }
  }
  return { layer: 'other', muscle: null }
}

export interface TreeNode { name: string; type: string; children: TreeNode[] }
export interface SceneReport {
  meshes: number
  skinnedMeshes: number
  bones: number
  materials: number
  textures: number
  clips: { name: string; duration: number }[]
  size: [number, number, number] | null
  layers: Record<Layer, number>
  /** Mesh name -> muscle id, for every mesh the mapping layer recognised. */
  muscleMeshes: { mesh: string; muscle: string; side: 'left' | 'right' | null }[]
  /** Muscle ids with no mesh in the model. */
  missingMuscles: string[]
  /** Paired muscles that only have one side in the model. */
  oneSided: string[]
  names: string[]
  tree: TreeNode
  nodeCount: number
}

const UNPAIRED = new Set(['abs', 'lower_back'])

/** Counts and names everything in a loaded model. Pure: it only reads the scene. */
export function inspectScene(scene: THREE.Object3D, animations: THREE.AnimationClip[]): SceneReport {
  let meshes = 0, skinned = 0, bones = 0, nodeCount = 0
  const mats = new Set<THREE.Material>()
  const texs = new Set<THREE.Texture>()
  const layers: Record<Layer, number> = { muscle: 0, skin: 0, skeleton: 0, other: 0 }
  const muscleMeshes: SceneReport['muscleMeshes'] = []
  const names: string[] = []

  const build = (o: THREE.Object3D): TreeNode => {
    nodeCount++
    return { name: o.name || '(unnamed)', type: o.type, children: o.children.map(build) }
  }
  const tree = build(scene)

  scene.traverse((o) => {
    if (o.name) names.push(o.name)
    if ((o as THREE.Bone).isBone) bones++
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    meshes++
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned++
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!mat) continue
      mats.add(mat)
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) texs.add(v)
    }
    const { layer, muscle } = layerFor(m)
    layers[layer]++
    if (muscle) muscleMeshes.push({ mesh: m.name || m.parent?.name || '', muscle, side: normaliseMeshName(m.name || m.parent?.name || '').side })
  })

  const box = new THREE.Box3().setFromObject(scene, true)
  const size = box.isEmpty() ? null : (box.getSize(new THREE.Vector3()).toArray() as [number, number, number])
  const found = new Set(muscleMeshes.map((x) => x.muscle))
  const oneSided: string[] = []
  for (const id of found) {
    if (UNPAIRED.has(id)) continue
    const sides = new Set(muscleMeshes.filter((x) => x.muscle === id).map((x) => x.side))
    const hasL = sides.has('left'), hasR = sides.has('right')
    if ((hasL && !hasR) || (hasR && !hasL)) oneSided.push(id)
  }
  return {
    meshes, skinnedMeshes: skinned, bones, materials: mats.size, textures: texs.size,
    clips: animations.map((a) => ({ name: a.name, duration: a.duration })),
    size, layers, muscleMeshes,
    missingMuscles: MUSCLES.map((m) => m.id).filter((id) => !found.has(id)),
    oneSided, names, tree, nodeCount,
  }
}
