// Pipeline test for the 3D loader path with the committed diagnostic model:
// GLB loads -> scene exists -> expected mesh detected -> mesh recoloured -> clip detected -> animation runs -> pause holds -> disposal is clean.
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { inspectScene, disposeTree, layerFor } from '../src/components/muscle3d/glbModel'

let bad = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { bad++; console.error('FAIL', name, 'got', got, 'want', want) } else console.log('ok  ', name)
}
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) { bad++; console.error('FAIL', name, detail ?? '') } else console.log('ok  ', name)
}

const file = readFileSync(new URL('../public/models/test/diagnostic-test-model.glb', import.meta.url))
const ab = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
  new GLTFLoader().parse(ab, '', (g) => resolve(g), (e) => reject(e))
})

check('glb: scene created', gltf.scene instanceof THREE.Group && gltf.scene.children.length === 15, gltf.scene.children.length)

const r = inspectScene(gltf.scene, gltf.animations)
eq('glb: 15 meshes', r.meshes, 15)
eq('glb: 0 skinned meshes (test model is not rigged)', r.skinnedMeshes, 0)
eq('glb: 3 shared materials', r.materials, 3)
eq('glb: layers', r.layers, { muscle: 11, skin: 1, skeleton: 3, other: 0 })
eq('glb: clips detected', r.clips.map((c) => c.name), ['TestRep', 'TestSlow'])
eq('glb: clip duration', r.clips[0].duration, 2)
check('glb: expected mesh detected as chest, left', r.muscleMeshes.some((m) => m.mesh === 'muscle_pectoralis_major_L' && m.muscle === 'chest' && m.side === 'left'))
check('glb: biceps detected', r.muscleMeshes.some((m) => m.muscle === 'biceps'))
check('glb: missing muscles reported', r.missingMuscles.includes('rear_delts') && !r.missingMuscles.includes('chest'), r.missingMuscles)
check('glb: size measured', r.size != null && Math.abs(r.size[1] - 1.8) < 0.05, r.size)
check('glb: names listed', r.names.includes('Skin_Body') && r.names.includes('muscle_rectus_abdominis'))

const skin = gltf.scene.getObjectByName('Skin_Body')!
eq('glb: skin layer', layerFor(skin).layer, 'skin')

// recolour a selected muscle the way the viewer does (own material per mesh, then set colour)
const pec = gltf.scene.getObjectByName('muscle_pectoralis_major_L') as THREE.Mesh
const mat = new THREE.MeshStandardMaterial({ color: '#d98a86' })
pec.material = mat
mat.color.set('#22c55e')
eq('glb: mesh recoloured', (pec.material as THREE.MeshStandardMaterial).color.getHexString(), '22c55e')

// animation
const mixer = new THREE.AnimationMixer(gltf.scene)
const action = mixer.clipAction(gltf.animations[0])
action.play()
const biceps = gltf.scene.getObjectByName('muscle_biceps_brachii_L')!
const x0 = biceps.quaternion.x
mixer.update(0.5)
const x1 = biceps.quaternion.x
check('glb: animation starts (node rotates)', x1 < x0 - 0.1, [x0, x1])
action.paused = true
mixer.update(0.5)
eq('glb: pause holds the pose', biceps.quaternion.x, x1)
action.paused = false
mixer.update(0.25)
check('glb: resume moves again', biceps.quaternion.x !== x1)
mixer.setTime(0)
check('glb: restart returns to start pose', Math.abs(biceps.quaternion.x - x0) < 1e-6, biceps.quaternion.x)

// cleanup
let disposed = 0
gltf.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.addEventListener('dispose', () => { disposed++ }) })
mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene)
let threw = false
try { disposeTree(gltf.scene); disposeTree(gltf.scene) } catch { threw = true }
check('glb: disposal does not throw (twice)', !threw)
check('glb: geometries disposed', disposed >= 1, disposed)

if (bad) { console.error(bad + ' glb test(s) failed'); process.exitCode = 1 } else console.log('glb tests passed')
