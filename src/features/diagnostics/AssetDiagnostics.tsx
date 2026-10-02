import { useEffect, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { MuscleBodyView } from '../../components/muscle3d/MuscleBodyView'
import { anatomyUrl } from '../../components/muscle3d/meshMap'
import { MUSCLES, muscleName } from '../../components/muscle3d/muscleMap'
import type { SceneReport, TreeNode } from '../../components/muscle3d/glbModel'
import { useNav } from '../../contexts/NavContext'

export const TEST_MODEL_URL = '/models/test/diagnostic-test-model.glb'

type Result = { state: 'idle' } | { state: 'loading'; label: string } | { state: 'ok'; label: string; url: string; report: SceneReport } | { state: 'error'; label: string; message: string }

/** Loads a model, reads what is in it, and frees it again. The preview below loads its own copy. */
async function inspectUrl(url: string): Promise<SceneReport> {
  const [{ GLTFLoader }, { MeshoptDecoder }, glb] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    import('../../components/muscle3d/glbModel'),
  ])
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await new Promise<Awaited<ReturnType<typeof loader.loadAsync>>>((resolve, reject) => loader.load(url, resolve, undefined, (e) => reject(e)))
  try { return glb.inspectScene(gltf.scene, gltf.animations) } finally { glb.disposeTree(gltf.scene) }
}

const dim = (n: number) => n.toFixed(2)

function Tree({ node, depth, budget }: { node: TreeNode; depth: number; budget: { n: number } }) {
  if (budget.n <= 0) return null
  budget.n--
  const label = <span className="font-mono text-xs">{node.name} <span className="text-ink2">({node.type})</span></span>
  if (!node.children.length) return <li className="ml-4 py-0.5">{label}</li>
  return (
    <li className="py-0.5">
      <details open={depth < 1}>
        <summary className="cursor-pointer">{label} <span className="text-xs text-ink2">{node.children.length}</span></summary>
        <ul className="ml-3 border-l border-card2 pl-2">{node.children.map((c, i) => <Tree key={i} node={c} depth={depth + 1} budget={budget} />)}</ul>
      </details>
    </li>
  )
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return <div className="min-w-0 rounded-card bg-card2 px-2 py-2 text-center"><div className="text-[11px] text-ink2">{k}</div><div className="truncate text-sm font-bold">{v}</div></div>
}

/** Developer / admin tool: check any GLB before it is trusted by the app (3D asset diagnostics). */
export function AssetDiagnostics() {
  const nav = useNav()
  const [res, setRes] = useState<Result>({ state: 'idle' })
  const [url, setUrl] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const blob = useRef<string | null>(null)
  useEffect(() => () => { if (blob.current) URL.revokeObjectURL(blob.current) }, [])

  const run = async (target: string, label: string) => {
    setRes({ state: 'loading', label })
    setSelected([])
    try {
      const report = await inspectUrl(target)
      setRes({ state: 'ok', label, url: target, report })
    } catch (e) {
      const raw = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
      setRes({ state: 'error', label, message: `${raw || 'Could not load this file'}. If the file does not exist, the server may have returned a web page instead of a model.` })
    }
  }

  const onFile = (f: File | undefined) => {
    if (!f) return
    if (blob.current) URL.revokeObjectURL(blob.current)
    blob.current = URL.createObjectURL(f)
    setPicked(f.name)
    void run(blob.current, f.name)
  }

  const rep = res.state === 'ok' ? res.report : null
  const found = new Set(rep?.muscleMeshes.map((m) => m.muscle))
  const budget = { n: 600 }

  return (
    <div className="grid gap-4">
      <PageHeader title="3D asset diagnostics" onBack={nav.back} />
      <Card className="grid gap-3">
        <p className="text-sm text-ink2">Check any .glb file before the app depends on it. Nothing here is uploaded: a chosen file is read in this browser.</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-white">
            <Upload size={16} />Choose a .glb file
            <input type="file" accept=".glb,model/gltf-binary" className="sr-only" aria-label="Choose a GLB file" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <Button variant="soft" onClick={() => { setPicked(null); void run(TEST_MODEL_URL, 'diagnostic-test-model.glb') }}>Load test model</Button>
          <Button variant="soft" onClick={() => { setPicked(null); void run(anatomyUrl('male'), 'male-anatomy.glb (production)') }}>Check production model</Button>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) { setPicked(null); void run(url.trim(), url.trim()) } }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/models/anatomy/male-anatomy.glb" aria-label="Model URL" className="min-h-[44px] min-w-0 flex-1 rounded-full bg-card2 px-4 text-sm" />
          <Button type="submit" variant="soft">Load URL</Button>
        </form>
        <p className="text-xs text-ink2">The test model is a few boxes with muscle-style names. It only proves the pipeline works; it is not anatomy and is never shown on workout screens.</p>
      </Card>

      {res.state === 'loading' && <p role="status" className="text-sm text-ink2">Loading {res.label}…</p>}
      {res.state === 'error' && (
        <Card className="grid gap-1 border border-red-300" role="alert">
          <h2 className="text-sm font-bold">Failed to load</h2>
          <p className="text-sm"><span className="font-semibold">File: </span>{picked ?? res.label}</p>
          <p className="text-sm">{res.message}</p>
        </Card>
      )}

      {rep && res.state === 'ok' && (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="grid min-w-0 gap-2 lg:sticky lg:top-4">
            <MuscleBodyView modelUrl={res.url} noFallback selected={selected} onSelect={(id) => setSelected([id])} height="h-[360px]" controls viewModes animation label="Model preview" />
            <p className="text-xs text-ink2">Tap a muscle to recolour it green. Skin and Skeleton switch on only if the model has those layers.</p>
            {selected[0] && <p className="text-sm font-semibold">Selected: {muscleName(selected[0])}</p>}
          </div>
          <div className="grid min-w-0 gap-4">
            <Card className="grid gap-3">
              <h2 className="text-sm font-bold">Result: loaded</h2>
              <p className="text-sm"><span className="font-semibold">File: </span>{picked ?? res.label}</p>
              <div className="grid grid-cols-3 gap-2">
                <Stat k="Meshes" v={rep.meshes} /><Stat k="Skinned meshes" v={rep.skinnedMeshes} /><Stat k="Bones" v={rep.bones} />
                <Stat k="Materials" v={rep.materials} /><Stat k="Textures" v={rep.textures} /><Stat k="Animation clips" v={rep.clips.length} />
              </div>
              <p className="text-sm"><span className="font-semibold">Size: </span>{rep.size ? `${dim(rep.size[0])} x ${dim(rep.size[1])} x ${dim(rep.size[2])} units (scaled to 1.8 high for display)` : 'unknown'}</p>
              <p className="text-sm"><span className="font-semibold">Layers: </span>{rep.layers.muscle} muscle, {rep.layers.skin} skin, {rep.layers.skeleton} skeleton, {rep.layers.other} other</p>
            </Card>

            <Card className="grid gap-2">
              <h2 className="text-sm font-bold">Animation clips</h2>
              {rep.clips.length ? <ul className="grid gap-1 text-sm">{rep.clips.map((c) => <li key={c.name}>{c.name || '(unnamed)'} <span className="text-ink2">{c.duration.toFixed(2)}s</span></li>)}</ul> : <p className="text-sm text-ink2">No animation clips in this model.</p>}
            </Card>

            <Card className="grid gap-2">
              <h2 className="text-sm font-bold">Muscles</h2>
              <p className="text-xs text-ink2">{found.size} of {MUSCLES.length} muscle groups found. Names are matched through the mapping in meshMap.ts.</p>
              <ul className="grid gap-1 text-sm" aria-label="Required muscles">
                {MUSCLES.map((m) => {
                  const list = rep.muscleMeshes.filter((x) => x.muscle === m.id)
                  return <li key={m.id} className={list.length ? '' : 'text-ink2'}>{list.length ? 'Found' : 'Missing'}: {m.name}{list.length ? ` (${list.map((x) => x.mesh).join(', ')})` : ''}</li>
                })}
              </ul>
              {rep.oneSided.length > 0 && <p className="text-sm">Only one side found for: {rep.oneSided.map(muscleName).join(', ')}</p>}
            </Card>

            <Card className="grid gap-2">
              <h2 className="text-sm font-bold">Scene hierarchy ({rep.nodeCount} objects)</h2>
              <ul className="max-h-72 overflow-auto"><Tree node={rep.tree} depth={0} budget={budget} /></ul>
              {rep.nodeCount > 600 && <p className="text-xs text-ink2">Showing the first 600 objects.</p>}
            </Card>

            <Card className="grid gap-2">
              <h2 className="text-sm font-bold">All object names ({rep.names.length})</h2>
              <p className="max-h-40 overflow-auto break-words font-mono text-xs">{rep.names.join(', ') || 'No names'}</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
