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
