# 3D muscle workout system

Flow: trainer picks a client -> 3D muscle selector -> exercise list -> exercise detail -> configure (sets/reps/kg/rest/tempo/RPE/RIR/notes) -> workout builder (days, reorder, templates) -> assign.
Client: Fitness tab -> Today's workout -> player (weight/reps/RPE, last performance, PR detection) -> rest timer -> summary (volume, PRs, muscles trained, recovery) -> recovery map and AI Coach.

## Integration
- Nav: new detail ids `muscles`, `builder`, `workoutday`, `recovery` (src/types, src/App.tsx).
- Entry points: ClientPage ("Build workout (3D)", training analytics, recovery), Fitness tab (Today's workout, Explore muscles, Recovery), Progress > Training (7d/30d/90d/1y).
- Code: `src/components/muscle3d/*` (three.js scene), `src/features/workout/*` (screens), `src/services/workoutSystem.ts`, `src/utils/workoutMath.ts` (tested pure logic).
- DB (migration `supabase/migrations/20260930_3d_workout_system.sql`, additive): `muscles`, `exercise_secondary_muscles`, `workout_templates`; extended `exercises` (primary_muscle, instructions, video_url...), `workout_exercises` (weight, tempo, rpe, rir, notes), `workout_sessions` (client_key, total_volume_kg...), `workout_set_logs` (client_key, rpe, is_pr, e1rm_kg...). 67 exercises seeded with muscle mapping. RLS on all new tables.
- Offline: finished workouts queue in localStorage and upload with idempotent keys.

## 3D body and licence
The body is procedural: original geometry built in code (no third-party or Apple assets, no licence obligations). Every muscle is a separately named mesh (see `parts.ts`, `MODEL_NAMES`). A downloaded .glb using those names could replace it; loading a .glb is NOT implemented yet.
Exercise demonstrations: muscle-activation view now; `exercises.video_url` plays an MP4/WebM if set. Animated movement demos are not included.

## Caveats
Muscle recovery and readiness are training-load estimates, not medical measurements.

## Dropping in a licensed anatomy model (GLB)

The viewer loads `/public/3d/anatomy/male-body.glb` (or `female-body.glb`) automatically. If the file is missing, or is not a valid
glTF (for example the host returns the app's HTML page), the built-in procedural placeholder body is used and a small badge says so.
An exercise can carry its own model: set `exercises.animation_url` (and optionally `animation_clip`) and that file is tried first,
then the anatomy model, then the placeholder.

Model requirements: glTF 2.0 / GLB, Meshopt compression is supported (Draco is not wired up), muscles as separate meshes, optional
skin and skeleton meshes, optional animation clips. The model is auto-scaled to a 1.8-unit height and centred.

Mesh names are never read outside `src/components/muscle3d/meshMap.ts`. `MUSCLE_MESH_MAP` lists alias fragments for each muscle id
(`muscle_pectoralis_major_L`, `Pectoralis_Major_Left`, `Biceps_Brachii_Right.001` all resolve). The longest alias wins, so
`biceps_femoris` is a hamstring. To support another vendor's names, push aliases into `MUSCLE_MESH_MAP` or edit it; no other code changes.
Meshes whose names contain words like `skin` or `bone` are put in the skin / skeleton layer (lists in the same file).

Colours: red primary, orange secondary, yellow stabilizer, grey not involved, green selected or inspected. Roles come from
`fit.exercises.primary_muscle` and `fit.exercise_secondary_muscles.role` (`secondary` or `stabilizer`).

Not included: the model itself (buy or commission one whose licence allows embedding in a distributed app), animation clips, equipment
models, and any asset from iMuscle or other third-party apps. The Muscle / Skin / Skeleton switch and playback controls are
only enabled when the installed model has those layers or clips. GLB support has been checked against the placeholder fallback path
only; it has not been tested with a real model file.
