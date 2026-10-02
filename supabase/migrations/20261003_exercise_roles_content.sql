-- Exercise muscle roles (secondary vs stabilizer) and richer exercise content.
-- Applied to the live project as `fit_exercise_roles_content`. This file holds the schema part; the seed rows
-- (stabilizer links and common_mistakes / breathing / tips for 13 core lifts) were loaded with that migration
-- and can be edited per exercise by staff.
insert into fit.muscles (id, name, group_name, side, sort)
select 'serratus', 'Serratus anterior', 'Core', 'front', 19
where not exists (select 1 from fit.muscles where id = 'serratus');

alter table fit.exercise_secondary_muscles add column if not exists role text not null default 'secondary';
do $$ begin
  alter table fit.exercise_secondary_muscles add constraint exercise_secondary_muscles_role_chk check (role in ('secondary','stabilizer'));
exception when duplicate_object then null; end $$;

alter table fit.exercises
  add column if not exists common_mistakes text[],
  add column if not exists breathing text,
  add column if not exists tips text[],
  add column if not exists animation_url text,
  add column if not exists animation_clip text;
