/**
 * Mapping layer between the mesh names inside a .glb anatomy model and the app's muscle ids (the `fit.muscles` table).
 * Different vendors name meshes differently ("muscle_pectoralis_major_L", "Pectoralis_Major_Left", "Chest.001"), so nothing
 * else in the app reads mesh names: change a model by editing MUSCLE_MESH_MAP (or pushing to it at start-up), not the app.
 */

/** Alias fragments per muscle id, in normalised form (lower case, words joined with "_"). The longest matching alias wins. */
export const MUSCLE_MESH_MAP: Record<string, string[]> = {
  chest: ['pectoralis_major', 'pectoralis_minor', 'pectoralis', 'pecs', 'pec', 'chest'],
  front_delts: ['deltoid_anterior', 'anterior_deltoid', 'front_delt', 'delt_anterior', 'delt_front'],
  side_delts: ['deltoid_lateral', 'lateral_deltoid', 'side_delt', 'deltoid_medial', 'medial_deltoid', 'deltoid', 'deltoids', 'delt'],
  rear_delts: ['deltoid_posterior', 'posterior_deltoid', 'rear_delt', 'delt_posterior', 'delt_rear'],
  traps: ['trapezius', 'trapezius_upper', 'traps', 'trap'],
  biceps: ['biceps_brachii', 'biceps', 'brachialis'],
  triceps: ['triceps_brachii', 'triceps'],
  forearms: ['forearm', 'brachioradialis', 'flexor_carpi', 'extensor_carpi', 'wrist_flexor', 'wrist_extensor'],
  abs: ['rectus_abdominis', 'abdominis', 'abdominals', 'abs'],
  obliques: ['external_oblique', 'internal_oblique', 'oblique', 'obliques'],
  lats: ['latissimus_dorsi', 'latissimus', 'lats', 'lat'],
  mid_back: ['rhomboid_major', 'rhomboid_minor', 'rhomboid', 'rhomboids', 'teres_major', 'teres_minor', 'infraspinatus', 'mid_back'],
  lower_back: ['erector_spinae', 'erector', 'spinae', 'lower_back', 'quadratus_lumborum', 'multifidus'],
  glutes: ['gluteus_maximus', 'gluteus_medius', 'gluteus_minimus', 'gluteus', 'glute', 'glutes'],
  quads: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius', 'vastus', 'quadriceps', 'quadricep', 'quads', 'quad'],
  hamstrings: ['biceps_femoris', 'semitendinosus', 'semimembranosus', 'hamstrings', 'hamstring'],
  calves: ['gastrocnemius', 'soleus', 'calf', 'calves'],
  adductors: ['adductor_magnus', 'adductor_longus', 'adductor', 'adductors', 'gracilis', 'pectineus'],
  serratus: ['serratus_anterior', 'serratus'],
}

/** Words in a mesh name that mark it as part of the skin or the skeleton rather than a muscle. */
export const SKIN_WORDS = ['skin', 'body_mesh', 'epidermis', 'surface', 'hair', 'eyes', 'eyelash', 'teeth', 'tongue', 'nails']
export const SKELETON_WORDS = ['skeleton', 'bone', 'bones', 'skull', 'spine', 'vertebra', 'vertebrae', 'rib', 'ribs', 'sternum', 'clavicle', 'scapula', 'humerus', 'radius', 'ulna', 'femur', 'tibia', 'fibula', 'patella', 'pelvis_bone', 'sacrum', 'cranium', 'mandible']

export type Layer = 'muscle' | 'skin' | 'skeleton' | 'other'
export type Side = 'left' | 'right' | null

/** Lower-cases a mesh name, drops the importer's ".001" suffix and "muscle_"/"mus_" prefix, and splits out the left/right marker. */
export function normaliseMeshName(raw: string): { base: string; side: Side } {
  let s = raw.trim().toLowerCase().replace(/\.\d+$/, '').replace(/[\s.\-]+/g, '_').replace(/_+/g, '_')
  s = s.replace(/^(muscle|muscles|mus|m)_/, '')
  let side: Side = null
  const tail = s.match(/^(.*?)_(l|r|left|right)$/)
  const head = s.match(/^(l|r|left|right)_(.*)$/)
  if (tail) { s = tail[1]; side = tail[2].startsWith('l') ? 'left' : 'right' }
  else if (head) { s = head[2]; side = head[1].startsWith('l') ? 'left' : 'right' }
  return { base: s, side }
}

function hasWord(base: string, word: string): boolean {
  return ('_' + base + '_').includes('_' + word + '_')
}

/** Maps a mesh name to a muscle id using MUSCLE_MESH_MAP, or null. The longest matching alias wins ("biceps_femoris" is a hamstring). */
export function resolveMuscle(meshName: string, map: Record<string, string[]> = MUSCLE_MESH_MAP): string | null {
  const { base } = normaliseMeshName(meshName)
  let best: string | null = null
  let bestLen = 0
  for (const id of Object.keys(map)) {
    for (const alias of map[id]) {
      if (alias.length > bestLen && hasWord(base, alias)) { best = id; bestLen = alias.length }
    }
  }
  return best
}

/** Which view layer a mesh belongs to. A recognised muscle always wins. */
export function layerOf(meshName: string, map: Record<string, string[]> = MUSCLE_MESH_MAP): Layer {
  if (resolveMuscle(meshName, map)) return 'muscle'
  const { base } = normaliseMeshName(meshName)
  if (SKIN_WORDS.some((w) => hasWord(base, w))) return 'skin'
  if (SKELETON_WORDS.some((w) => hasWord(base, w))) return 'skeleton'
  return 'other'
}

/** Resolves a model url for an anatomy body. */
export const anatomyUrl = (gender: 'male' | 'female'): string => `/3d/anatomy/${gender}-body.glb`
