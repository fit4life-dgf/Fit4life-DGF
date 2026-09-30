-- 3D muscle workout & client assignment system. Additive only: no existing table is dropped or replaced.
create table if not exists fit.muscles (
  id text primary key,
  name text not null,
  group_name text not null,
  side text not null check (side in ('front','back','both')),
  sort smallint not null default 0
);
insert into fit.muscles (id,name,group_name,side,sort) values
 ('chest','Chest','Chest','front',1),('front_delts','Front shoulders','Shoulders','front',2),('side_delts','Side shoulders','Shoulders','both',3),
 ('rear_delts','Rear shoulders','Shoulders','back',4),('traps','Trapezius','Back','back',5),('biceps','Biceps','Arms','front',6),
 ('triceps','Triceps','Arms','back',7),('forearms','Forearms','Arms','both',8),('abs','Abs','Core','front',9),('obliques','Obliques','Core','front',10),
 ('lats','Lats','Back','back',11),('mid_back','Mid back','Back','back',12),('lower_back','Lower back','Back','back',13),
 ('glutes','Glutes','Legs','back',14),('quads','Quadriceps','Legs','front',15),('hamstrings','Hamstrings','Legs','back',16),
 ('calves','Calves','Legs','both',17),('adductors','Adductors','Legs','front',18)
on conflict (id) do nothing;
alter table fit.muscles enable row level security;
drop policy if exists muscles_read on fit.muscles;
create policy muscles_read on fit.muscles for select to authenticated using (true);

alter table fit.exercises
  add column if not exists primary_muscle text references fit.muscles(id),
  add column if not exists instructions text[] not null default '{}',
  add column if not exists video_url text,
  add column if not exists thumbnail_url text,
  add column if not exists animation_key text,
  add column if not exists is_active boolean not null default true;
create unique index if not exists exercises_global_name_uq on fit.exercises (lower(name)) where gym_id is null;
create index if not exists exercises_primary_muscle_idx on fit.exercises (primary_muscle);

create table if not exists fit.exercise_secondary_muscles (
  exercise_id uuid not null references fit.exercises(id) on delete cascade,
  muscle_id text not null references fit.muscles(id),
  primary key (exercise_id, muscle_id)
);
alter table fit.exercise_secondary_muscles enable row level security;
drop policy if exists esm_read on fit.exercise_secondary_muscles;
create policy esm_read on fit.exercise_secondary_muscles for select to authenticated using (true);
drop policy if exists esm_write on fit.exercise_secondary_muscles;
create policy esm_write on fit.exercise_secondary_muscles for all to authenticated
  using (fit.is_staff() and exists (select 1 from fit.exercises e where e.id = exercise_id and e.gym_id = fit.my_gym()))
  with check (fit.is_staff() and exists (select 1 from fit.exercises e where e.id = exercise_id and e.gym_id = fit.my_gym()));

alter table fit.workout_plans add column if not exists description text, add column if not exists start_date date, add column if not exists end_date date;
alter table fit.workout_days add column if not exists notes text;
alter table fit.workout_exercises
  add column if not exists weight_kg numeric check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 1000)),
  add column if not exists tempo text,
  add column if not exists rpe smallint check (rpe is null or (rpe between 1 and 10)),
  add column if not exists rir smallint check (rir is null or (rir between 0 and 10)),
  add column if not exists notes text;

alter table fit.workout_sessions
  add column if not exists client_key text,
  add column if not exists status text not null default 'completed',
  add column if not exists total_volume_kg numeric,
  add column if not exists summary jsonb;
alter table fit.workout_sessions drop constraint if exists workout_sessions_client_key_uq;
alter table fit.workout_sessions add constraint workout_sessions_client_key_uq unique (user_id, client_key);

alter table fit.workout_set_logs
  add column if not exists client_key text,
  add column if not exists rpe smallint check (rpe is null or (rpe between 1 and 10)),
  add column if not exists rir smallint check (rir is null or (rir between 0 and 10)),
  add column if not exists rest_sec smallint,
  add column if not exists is_pr boolean not null default false,
  add column if not exists e1rm_kg numeric;
alter table fit.workout_set_logs drop constraint if exists workout_set_logs_client_key_uq;
alter table fit.workout_set_logs add constraint workout_set_logs_client_key_uq unique (user_id, client_key);
create index if not exists workout_set_logs_user_ex_idx on fit.workout_set_logs (user_id, exercise_id, created_at desc);

create table if not exists fit.workout_templates (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references fit.gyms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  exercises jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table fit.workout_templates enable row level security;
drop policy if exists wt_all on fit.workout_templates;
create policy wt_all on fit.workout_templates for all to authenticated
  using (fit.is_staff() and gym_id = fit.my_gym())
  with check (fit.is_staff() and gym_id = fit.my_gym() and created_by = auth.uid());

grant select on fit.muscles, fit.exercise_secondary_muscles to authenticated;
grant insert, update, delete on fit.exercise_secondary_muscles to authenticated;
grant select, insert, update, delete on fit.workout_templates to authenticated;

-- seed: map every exercise to primary + secondary muscles; add ~40 more
create temp table seed (name text, grp text, prim text, equip text, lvl text, cue text, steps text, sec text);
insert into seed values
('Barbell Back Squat','Legs','quads','Barbell','Intermediate','Chest up, knees track over toes','Set the bar on your upper back|Sit down and back until thighs are parallel|Drive through mid-foot to stand','glutes,hamstrings,lower_back'),
('Barbell Curl','Arms','biceps','Barbell','Beginner','Elbows pinned to your sides','Hold the bar shoulder-width, palms up|Curl to shoulder height|Lower under control','forearms'),
('Bench Press','Chest','chest','Barbell','Intermediate','Shoulder blades pinched, feet planted','Lie back and grip just wider than shoulders|Lower the bar to mid-chest|Press up until arms lock out','front_delts,triceps'),
('Bent-over Row','Back','lats','Barbell','Intermediate','Flat back, pull to your belly','Hinge forward with a flat back|Row the bar to your lower ribs|Lower with control','mid_back,rear_delts,biceps,lower_back'),
('Burpee','Full body','quads','Bodyweight','Intermediate','Move fast but keep your form','Squat and place hands on floor|Jump feet back, lower chest to floor|Push up, jump feet in and leap up','chest,abs,front_delts'),
('Cable Fly','Chest','chest','Cable','Beginner','Soft elbows, hug a barrel','Set pulleys at chest height|Bring hands together in an arc|Open slowly until you feel a stretch','front_delts'),
('Deadlift','Back','lower_back','Barbell','Advanced','Bar close to shins, brace your core','Stand with bar over mid-foot|Hinge and grip the bar, flat back|Drive the floor away until standing tall','glutes,hamstrings,traps,forearms,lats'),
('Dumbbell Lateral Raise','Shoulders','side_delts','Dumbbell','Beginner','Lead with elbows, stop at shoulder height','Hold dumbbells at your sides|Raise arms out to shoulder height|Lower slowly','traps'),
('Face Pull','Shoulders','rear_delts','Cable','Beginner','Pull to your forehead, elbows high','Set a rope at face height|Pull the rope toward your face, elbows flared|Squeeze the shoulder blades, return slowly','mid_back,traps'),
('Goblet Squat','Legs','quads','Dumbbell','Beginner','Hold the weight at your chest','Hold a dumbbell at your chest|Squat between your knees|Stand up tall','glutes,abs'),
('Hammer Curl','Arms','biceps','Dumbbell','Beginner','Neutral grip, no swinging','Hold dumbbells with palms facing in|Curl up keeping elbows still|Lower slowly','forearms'),
('Hanging Knee Raise','Core','abs','Bodyweight','Intermediate','Curl your pelvis, do not swing','Hang from a bar|Raise knees toward your chest|Lower slowly','obliques'),
('Hip Thrust','Glutes','glutes','Barbell','Intermediate','Chin tucked, ribs down','Rest upper back on a bench, bar over hips|Drive hips up until body is straight|Squeeze at the top, lower','hamstrings'),
('Incline Dumbbell Press','Chest','chest','Dumbbell','Intermediate','Bench at 30 degrees, control the descent','Set the bench to a low incline|Press dumbbells above upper chest|Lower until elbows are just below the bench','front_delts,triceps'),
('Kettlebell Swing','Full body','glutes','Kettlebell','Intermediate','Snap the hips, arms are ropes','Hinge and hike the bell back|Snap hips forward to float the bell to chest height|Let it fall back into the hinge','hamstrings,lower_back,front_delts'),
('Lat Pulldown','Back','lats','Machine','Beginner','Pull elbows down to your sides','Grip the bar wider than shoulders|Pull to upper chest|Return slowly','biceps,mid_back'),
('Leg Press','Legs','quads','Machine','Beginner','Do not lock out your knees','Place feet shoulder-width on the platform|Lower until knees are near 90 degrees|Press away without locking out','glutes'),
('Overhead Press','Shoulders','front_delts','Barbell','Intermediate','Squeeze glutes, ribs down','Bar at collarbone, grip just outside shoulders|Press overhead, head through the window|Lower to collarbone','side_delts,triceps,traps'),
('Plank','Core','abs','Bodyweight','Beginner','Straight line, ribs tucked','Forearms on floor, elbows under shoulders|Lift hips into a straight line|Hold, breathing steadily','obliques,lower_back'),
('Pull-up','Back','lats','Bodyweight','Advanced','Start from a dead hang','Hang with an overhand grip|Pull chin over the bar|Lower fully','biceps,mid_back'),
('Push-up','Chest','chest','Bodyweight','Beginner','Body in one straight line','Hands under shoulders, body straight|Lower chest to the floor|Push back up','triceps,front_delts'),
('Romanian Deadlift','Hamstrings','hamstrings','Barbell','Intermediate','Push hips back, soft knees','Hold the bar at your thighs|Hinge back until you feel a hamstring stretch|Drive hips forward to stand','glutes,lower_back'),
('Rowing Machine','Cardio','lats','Machine','Beginner','Legs, then back, then arms','Strap in, arms straight|Drive with legs, lean back, pull handle to ribs|Reverse the sequence to return','quads,biceps'),
('Russian Twist','Core','obliques','Bodyweight','Beginner','Rotate through your ribs, not your arms','Sit and lean back slightly|Rotate torso side to side|Keep the chest lifted','abs'),
('Seated Cable Row','Back','mid_back','Cable','Beginner','Chest tall, squeeze shoulder blades','Sit with knees soft, grip the handle|Pull to your belly|Extend arms slowly','lats,biceps,rear_delts'),
('Skipping Rope','Cardio','calves','Rope','Beginner','Small hops, wrists do the turning','Hold handles at hip height|Turn the rope with your wrists|Hop lightly on the balls of your feet','quads,forearms'),
('Skull Crusher','Arms','triceps','Barbell','Intermediate','Upper arms stay vertical','Lie back holding the bar above your chest|Bend elbows to lower the bar toward your forehead|Extend back up','forearms'),
('Treadmill Run','Cardio','quads','Machine','Beginner','Land under your hips','Start with a brisk walk warm-up|Increase to a comfortable running pace|Cool down for two minutes','calves,hamstrings,glutes'),
('Triceps Pushdown','Arms','triceps','Cable','Beginner','Elbows tucked, full lockout','Grip the bar at chest height|Push down until arms are straight|Return to 90 degrees','forearms'),
('Walking Lunge','Legs','quads','Bodyweight','Beginner','Long step, torso upright','Step forward and lower the back knee|Drive through the front heel|Step through into the next rep','glutes,hamstrings'),
('Dumbbell Bench Press','Chest','chest','Dumbbell','Beginner','Wrists stacked over elbows','Lie back with dumbbells at chest level|Press up and slightly together|Lower under control','front_delts,triceps'),
('Incline Barbell Press','Chest','chest','Barbell','Intermediate','Touch the upper chest','Set the bench to 30 degrees|Lower the bar to upper chest|Press up','front_delts,triceps'),
('Chest Dip','Chest','chest','Bodyweight','Advanced','Lean forward slightly','Support yourself on parallel bars|Lower until shoulders are below elbows|Press back up','triceps,front_delts'),
('Pec Deck Machine','Chest','chest','Machine','Beginner','Lead with elbows','Adjust seat so handles are at chest height|Bring handles together|Return slowly','front_delts'),
('Arnold Press','Shoulders','front_delts','Dumbbell','Intermediate','Rotate as you press','Start with palms facing you|Rotate and press overhead|Reverse on the way down','side_delts,triceps'),
('Dumbbell Shoulder Press','Shoulders','front_delts','Dumbbell','Beginner','Press in a slight arc','Sit with dumbbells at shoulder height|Press overhead|Lower to ear level','side_delts,triceps'),
('Rear Delt Fly','Shoulders','rear_delts','Dumbbell','Beginner','Lead with the elbows','Hinge forward with dumbbells hanging|Raise arms out to the sides|Lower slowly','mid_back,traps'),
('Front Raise','Shoulders','front_delts','Dumbbell','Beginner','No swinging','Hold dumbbells in front of thighs|Raise to shoulder height|Lower slowly','side_delts'),
('Dumbbell Shrug','Back','traps','Dumbbell','Beginner','Lift shoulders straight up','Hold dumbbells at your sides|Shrug toward your ears|Lower slowly','forearms'),
('T-Bar Row','Back','mid_back','Machine','Intermediate','Chest supported, pull to ribs','Straddle the bar and hinge|Row the handle to your chest|Lower under control','lats,biceps,rear_delts'),
('One-arm Dumbbell Row','Back','lats','Dumbbell','Beginner','Pull the elbow to your hip','Support one hand on a bench|Row the dumbbell to your hip|Lower fully','mid_back,biceps,rear_delts'),
('Straight-arm Pulldown','Back','lats','Cable','Intermediate','Arms nearly straight throughout','Hold a bar overhead at arm''s length|Sweep it down to your thighs|Return slowly','abs'),
('Back Extension','Back','lower_back','Bodyweight','Beginner','Rise to neutral, do not over-arch','Lock feet in a hyperextension bench|Lower your torso with a flat back|Raise until body is straight','glutes,hamstrings'),
('Chin-up','Back','lats','Bodyweight','Intermediate','Palms facing you','Hang with an underhand grip|Pull chin over the bar|Lower fully','biceps,mid_back'),
('Preacher Curl','Arms','biceps','Dumbbell','Intermediate','Full stretch at the bottom','Rest upper arms on the pad|Curl to the top|Lower slowly','forearms'),
('Incline Dumbbell Curl','Arms','biceps','Dumbbell','Intermediate','Let the arms hang behind you','Sit on an incline bench, arms hanging|Curl without moving the elbows|Lower fully','forearms'),
('Overhead Triceps Extension','Arms','triceps','Dumbbell','Beginner','Elbows point forward','Hold one dumbbell overhead with both hands|Lower behind your head|Extend to lockout','forearms'),
('Close-grip Bench Press','Arms','triceps','Barbell','Intermediate','Hands shoulder-width apart','Grip the bar shoulder-width|Lower to lower chest with elbows in|Press up','chest,front_delts'),
('Bench Dip','Arms','triceps','Bodyweight','Beginner','Keep your back near the bench','Hands on a bench behind you|Lower until elbows are 90 degrees|Press up','front_delts,chest'),
('Wrist Curl','Arms','forearms','Dumbbell','Beginner','Only the wrists move','Rest forearms on your thighs, palms up|Curl the weight up|Lower slowly','biceps'),
('Front Squat','Legs','quads','Barbell','Advanced','Elbows high','Rest the bar on front shoulders|Squat keeping torso upright|Stand up','glutes,abs'),
('Bulgarian Split Squat','Legs','quads','Dumbbell','Intermediate','Front shin near vertical','Rear foot on a bench|Lower straight down|Drive through the front foot','glutes,hamstrings,adductors'),
('Leg Extension','Legs','quads','Machine','Beginner','Pause at the top','Sit and hook shins under the pad|Extend knees fully|Lower slowly',''),
('Leg Curl','Hamstrings','hamstrings','Machine','Beginner','Control the return','Lie face down, pad above heels|Curl heels toward glutes|Lower slowly','calves'),
('Standing Calf Raise','Legs','calves','Machine','Beginner','Full stretch, full squeeze','Stand with balls of feet on the platform|Rise onto your toes|Lower below the platform',''),
('Seated Calf Raise','Legs','calves','Machine','Beginner','Slow tempo','Sit with pads on your knees|Raise your heels|Lower fully',''),
('Hack Squat','Legs','quads','Machine','Intermediate','Feet forward on the platform','Back against the pad|Lower until thighs are parallel|Press up','glutes'),
('Step-up','Legs','quads','Dumbbell','Beginner','Drive through the top foot','Place one foot on a box|Step up fully|Lower with control','glutes,hamstrings'),
('Adductor Machine','Legs','adductors','Machine','Beginner','Smooth squeeze','Sit with legs apart on the pads|Bring legs together|Return slowly',''),
('Sumo Deadlift','Legs','glutes','Barbell','Intermediate','Push knees out','Wide stance, grip inside the knees|Drive up, chest tall|Lower along the legs','quads,adductors,hamstrings,lower_back'),
('Glute Bridge','Glutes','glutes','Bodyweight','Beginner','Squeeze at the top','Lie on your back, knees bent|Lift hips until body is straight|Lower slowly','hamstrings'),
('Cable Kickback','Glutes','glutes','Cable','Beginner','Do not arch your back','Attach an ankle strap|Kick the leg back|Return slowly','hamstrings'),
('Cable Crunch','Core','abs','Cable','Intermediate','Curl your ribs to your pelvis','Kneel below a rope|Crunch down|Return slowly','obliques'),
('Ab Wheel Rollout','Core','abs','Bodyweight','Advanced','Keep your hips tucked','Kneel with the wheel under shoulders|Roll out as far as you can control|Pull back in','lats,front_delts'),
('Side Plank','Core','obliques','Bodyweight','Beginner','Stack your hips','Lie on your side, elbow under shoulder|Lift hips into a straight line|Hold','abs,glutes'),
('Bicycle Crunch','Core','abs','Bodyweight','Beginner','Slow and controlled','Lie back, hands by your ears|Bring opposite elbow to knee|Alternate sides','obliques'),
('Lying Leg Raise','Core','abs','Bodyweight','Intermediate','Press the lower back down','Lie flat, legs straight|Raise legs to vertical|Lower slowly','obliques');

insert into fit.exercises (gym_id, name, muscle, equipment, level, cue)
select null, s.name, s.grp, s.equip, s.lvl, s.cue from seed s
where not exists (select 1 from fit.exercises e where lower(e.name) = lower(s.name));

update fit.exercises e set primary_muscle = s.prim, instructions = string_to_array(s.steps, '|')
from seed s where lower(e.name) = lower(s.name);

insert into fit.exercise_secondary_muscles (exercise_id, muscle_id)
select e.id, m from seed s join fit.exercises e on lower(e.name) = lower(s.name),
  unnest(string_to_array(nullif(s.sec,''), ',')) as m
where exists (select 1 from fit.muscles mm where mm.id = m)
on conflict do nothing;

drop table if exists seed;
