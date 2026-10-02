import { register } from 'node:module'
register('./loader.mjs', import.meta.url)
await import('./utils.test.ts')
await import('./glb.test.ts')
