-- Exercise goal prescriptions. Idempotent: safe to run more than once. Touches no existing data.
-- Concepts kept separate:
--   fit.exercises                     = ExerciseDefinition (what the exercise is)
--   fit.exercise_goal_prescriptions   = ExerciseGoalPrescription (recommended defaults per training goal)
--   fit.workout_templates             = program prescription (templates a trainer reuses)
--   fit.workout_exercises             = the assignment on a client's plan (trainer values for one client)
--   fit.workout_sessions/set_logs     = WorkoutLog (what the client actually did)
-- Note: fit.goals already exists (a client's personal goals), so training goals live in fit.training_goals.

alter table fit.exercises add column if not exists is_compound boolean;
alter table fit.exercises add column if not exists movement_pattern text;

create table if not exists fit.training_goals (
  id text primary key,
  name text not null,
  sort int not null default 0,
  active boolean not null default true
);
alter table fit.training_goals enable row level security;
drop policy if exists tg_read on fit.training_goals;
create policy tg_read on fit.training_goals for select using (true);
grant select on fit.training_goals to authenticated, anon;

-- Adding a goal later is an insert here (and prescriptions rows); no code or schema change.
insert into fit.training_goals (id, name, sort, active) values
  ('hypertrophy', 'Hypertrophy', 1, true),
  ('strength', 'Strength', 2, true),
  ('endurance', 'Muscular endurance', 3, true),
  ('beginner', 'Beginner / general fitness', 4, true),
  ('power', 'Power', 5, false),
  ('sports', 'Sports performance', 6, false),
  ('fat_loss', 'Fat loss / conditioning', 7, false),
  ('rehab', 'Rehabilitation / corrective', 8, false)
on conflict (id) do nothing;

create table if not exists fit.exercise_goal_prescriptions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references fit.exercises(id) on delete cascade,
  goal_id text not null references fit.training_goals(id),
  sets_min int not null check (sets_min > 0),
  sets_max int not null,
  reps_min int not null check (reps_min > 0),
  reps_max int not null,
  rest_min_seconds int not null check (rest_min_seconds >= 0),
  rest_max_seconds int not null,
  tempo text,
  source text not null default 'general guideline range',
  created_at timestamptz not null default now(),
  unique (exercise_id, goal_id),
  check (sets_max >= sets_min and reps_max >= reps_min and rest_max_seconds >= rest_min_seconds)
);
alter table fit.exercise_goal_prescriptions enable row level security;
drop policy if exists egp_read on fit.exercise_goal_prescriptions;
create policy egp_read on fit.exercise_goal_prescriptions for select using (true);
drop policy if exists egp_write on fit.exercise_goal_prescriptions;
create policy egp_write on fit.exercise_goal_prescriptions for all
  using (fit.is_staff() and exists (select 1 from fit.exercises e where e.id = exercise_id and e.gym_id = fit.my_gym()))
  with check (fit.is_staff() and exists (select 1 from fit.exercises e where e.id = exercise_id and e.gym_id = fit.my_gym()));
grant select on fit.exercise_goal_prescriptions to authenticated, anon;
grant insert, update, delete on fit.exercise_goal_prescriptions to authenticated;

-- Hand classification of multi-joint lifts (only fills rows that are still null, so staff edits survive a re-run).
update fit.exercises set is_compound = (name in (
 'Bench Press','Chest Dip','Dumbbell Bench Press','Incline Barbell Press','Incline Dumbbell Press','Push-up','Arnold Press','Dumbbell Shoulder Press','Overhead Press',
 'Hip Thrust','Kettlebell Swing','Sumo Deadlift','Romanian Deadlift','Bent-over Row','Chin-up','Lat Pulldown','One-arm Dumbbell Row','Pull-up','Deadlift',
 'Seated Cable Row','T-Bar Row','Barbell Back Squat','Bulgarian Split Squat','Front Squat','Goblet Squat','Hack Squat','Leg Press','Step-up','Walking Lunge',
 'Close-grip Bench Press','Bench Dip','Burpee','Rowing Machine')) where is_compound is null;

update fit.exercises set movement_pattern = case
 when name in ('Bench Press','Chest Dip','Dumbbell Bench Press','Incline Barbell Press','Incline Dumbbell Press','Push-up','Arnold Press','Dumbbell Shoulder Press','Overhead Press','Close-grip Bench Press','Bench Dip') then 'push'
 when name in ('Bent-over Row','Chin-up','Lat Pulldown','One-arm Dumbbell Row','Pull-up','Seated Cable Row','T-Bar Row','Rowing Machine') then 'pull'
 when name in ('Barbell Back Squat','Front Squat','Goblet Squat','Hack Squat','Leg Press') then 'squat'
 when name in ('Deadlift','Sumo Deadlift','Romanian Deadlift','Hip Thrust','Kettlebell Swing') then 'hinge'
 when name in ('Bulgarian Split Squat','Step-up','Walking Lunge') then 'lunge'
 when name in ('Burpee','Treadmill Run','Skipping Rope') then 'conditioning'
 when primary_muscle in ('abs','obliques') then 'core'
 else 'isolation' end
where movement_pattern is null;

-- General guideline ranges per goal, not individual prescriptions. Timed / cardio exercises are skipped.
-- Tempo is deliberately left empty: the app shows "Not prescribed" until a trainer sets one.
insert into fit.exercise_goal_prescriptions (exercise_id, goal_id, sets_min, sets_max, reps_min, reps_max, rest_min_seconds, rest_max_seconds)
select e.id, g.goal,
  case g.goal when 'strength' then 3 when 'hypertrophy' then 3 else 2 end,
  case g.goal when 'strength' then (case when e.is_compound then 5 else 4 end) when 'hypertrophy' then 4 else 3 end,
  case g.goal when 'strength' then (case when e.is_compound then 3 else 6 end)
              when 'hypertrophy' then (case when e.is_compound then 6 else 10 end)
              when 'endurance' then 15
              else (case when e.is_compound then 8 else 10 end) end,
  case g.goal when 'strength' then (case when e.is_compound then 6 else 10 end)
              when 'hypertrophy' then (case when e.is_compound then 12 else 15 end)
              when 'endurance' then 25
              else (case when e.is_compound then 12 else 15 end) end,
  case g.goal when 'strength' then (case when e.is_compound then 180 else 120 end)
              when 'hypertrophy' then (case when e.is_compound then 90 else 60 end)
              when 'endurance' then 30
              else (case when e.is_compound then 60 else 45 end) end,
  case g.goal when 'strength' then (case when e.is_compound then 300 else 180 end)
              when 'hypertrophy' then (case when e.is_compound then 150 else 90 end)
              when 'endurance' then 60
              else 90 end
from fit.exercises e
cross join (values ('beginner'),('hypertrophy'),('strength'),('endurance')) g(goal)
where e.is_active and e.name not in ('Plank','Side Plank','Skipping Rope','Treadmill Run','Rowing Machine')
on conflict (exercise_id, goal_id) do nothing;
