-- Geniotech: Supabase schema + Row Level Security
-- Run in Supabase Dashboard > SQL Editor (one run, top to bottom).
-- Login model: each person is a Supabase Auth user with a synthetic email
-- "<username>@geniotech.app"; the front end shows a username field only.

create extension if not exists pgcrypto;

create type app_role as enum ('admin','teacher','student','parent');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username = lower(username)),
  full_name text not null,
  role app_role not null,
  age int check (age between 3 and 99),
  created_at timestamptz not null default now()
);

create table public.parent_students (
  parent_id uuid references public.profiles(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  primary key (parent_id, student_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title_en text not null, title_ar text not null,
  desc_en text default '', desc_ar text default '',
  category text not null check (category in ('robotics','programming','game')),
  age_track int not null check (age_track in (4,7,10)),
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  thumb_path text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null default 0,
  title_en text not null, title_ar text not null,
  video_path text,                       -- path inside storage bucket lesson-videos
  demo_seconds int not null default 30,  -- used when there is no video
  xp int not null default 100
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  at_second int not null check (at_second >= 0),
  question text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_index int not null check (correct_index >= 0)
);

create table public.enrollments (
  student_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (student_id, course_id)
);

create table public.lesson_progress (
  student_id uuid references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create table public.quiz_attempts (
  student_id uuid references public.profiles(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete cascade,
  choice int not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (student_id, quiz_id)
);

create table public.last_activity (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  issued_at timestamptz not null default now(),
  unique (student_id, course_id)
);

-- ---------- helpers ----------
create function public.my_role() returns app_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() in ('admin','teacher'), false) $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() = 'admin', false) $$;

create function public.is_parent_of(sid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.parent_students where parent_id = auth.uid() and student_id = sid) $$;

create function public.age_track_of(a int) returns int
language sql immutable as $$ select case when a >= 10 then 10 when a >= 7 then 7 else 4 end $$;

-- Parent login check: the parent must give a child username linked to them.
create function public.verify_parent_child(child_username text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.parent_students ps
     join public.profiles s on s.id = ps.student_id
     where ps.parent_id = auth.uid() and s.username = lower(child_username)) $$;

-- ---------- quiz + progress functions (students cannot write these tables directly) ----------
-- Quizzes for a lesson WITHOUT the correct answer.
create function public.lesson_quizzes(p_lesson uuid)
returns table (id uuid, at_second int, question text, options jsonb)
language sql stable security definer set search_path = public as
$$ select q.id, q.at_second, q.question, q.options from public.quizzes q
   join public.lessons l on l.id = q.lesson_id
   where q.lesson_id = p_lesson
     and (public.is_staff() or exists (select 1 from public.enrollments e
          where e.student_id = auth.uid() and e.course_id = l.course_id))
   order by q.at_second $$;

-- Answer once; returns the verdict and the correct index immediately after answering.
create function public.submit_quiz_answer(p_quiz uuid, p_choice int)
returns table (is_correct boolean, correct_index int)
language plpgsql security definer set search_path = public as $$
declare q record;
begin
  if public.my_role() <> 'student' then raise exception 'students only'; end if;
  select qz.*, l.course_id into q from public.quizzes qz join public.lessons l on l.id = qz.lesson_id where qz.id = p_quiz;
  if not found then raise exception 'quiz not found'; end if;
  if not exists (select 1 from public.enrollments where student_id = auth.uid() and course_id = q.course_id) then
    raise exception 'not enrolled'; end if;
  insert into public.quiz_attempts (student_id, quiz_id, choice, is_correct)
  values (auth.uid(), p_quiz, p_choice, p_choice = q.correct_index)
  on conflict (student_id, quiz_id) do nothing;
  return query select a.is_correct, q.correct_index from public.quiz_attempts a
    where a.student_id = auth.uid() and a.quiz_id = p_quiz;
end $$;

-- Finish a lesson; issues the certificate when the whole course is done.
create function public.complete_lesson(p_lesson uuid)
returns table (course_done boolean)
language plpgsql security definer set search_path = public as $$
declare cid uuid; total int; done int;
begin
  if public.my_role() <> 'student' then raise exception 'students only'; end if;
  select course_id into cid from public.lessons where id = p_lesson;
  if not exists (select 1 from public.enrollments where student_id = auth.uid() and course_id = cid) then
    raise exception 'not enrolled'; end if;
  insert into public.lesson_progress (student_id, lesson_id) values (auth.uid(), p_lesson) on conflict do nothing;
  select count(*) into total from public.lessons where course_id = cid;
  select count(*) into done from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
    where lp.student_id = auth.uid() and l.course_id = cid;
  if done >= total then
    insert into public.certificates (student_id, course_id) values (auth.uid(), cid) on conflict do nothing;
  end if;
  return query select done >= total;
end $$;

-- XP per student per course: lesson XP + 10 per correct quiz answer.
-- Runs with owner rights (so it can count quizzes students cannot read) but only returns
-- rows the caller is allowed to see: own rows, linked children (parent), or everyone (staff).
create view public.student_course_xp as
select e.student_id, e.course_id,
  coalesce((select sum(l.xp) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
            where lp.student_id = e.student_id and l.course_id = e.course_id), 0)
  + 10 * coalesce((select count(*) from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
            join public.lessons l on l.id = q.lesson_id
            where a.student_id = e.student_id and l.course_id = e.course_id and a.is_correct), 0) as xp,
  coalesce((select sum(l.xp) from public.lessons l where l.course_id = e.course_id), 0)
  + 10 * coalesce((select count(*) from public.quizzes q join public.lessons l on l.id = q.lesson_id
            where l.course_id = e.course_id), 0) as max_xp,
  coalesce((select count(*) from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
            join public.lessons l on l.id = q.lesson_id
            where a.student_id = e.student_id and l.course_id = e.course_id and a.is_correct), 0) as right_answers,
  coalesce((select count(*) from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
            join public.lessons l on l.id = q.lesson_id
            where a.student_id = e.student_id and l.course_id = e.course_id), 0) as answered
from public.enrollments e
where e.student_id = auth.uid() or public.is_staff() or public.is_parent_of(e.student_id);
revoke all on public.student_course_xp from anon;
grant select on public.student_course_xp to authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles        enable row level security;
alter table public.parent_students enable row level security;
alter table public.courses         enable row level security;
alter table public.lessons         enable row level security;
alter table public.quizzes         enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts   enable row level security;
alter table public.last_activity   enable row level security;
alter table public.certificates    enable row level security;

-- profiles: own row, staff see all, parent sees linked children. Only admin edits (new users come from the Edge Function).
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or public.is_parent_of(id));
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy ps_read on public.parent_students for select to authenticated
  using (parent_id = auth.uid() or public.is_staff());
create policy ps_admin_write on public.parent_students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- catalog: any signed-in user reads, staff writes
create policy courses_read on public.courses for select to authenticated using (true);
create policy courses_write on public.courses for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy lessons_read on public.lessons for select to authenticated using (true);
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- Public catalog: visitors who are not signed in can see course and lesson titles on the landing page.
create policy courses_public_read on public.courses for select to anon using (true);
create policy lessons_public_read on public.lessons for select to anon using (true);
-- quizzes hold the answers: staff only (students use lesson_quizzes / submit_quiz_answer)
create policy quizzes_staff on public.quizzes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- enrollments: a student enrolls only in courses of their own age track
create policy enr_read on public.enrollments for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_parent_of(student_id));
create policy enr_student_insert on public.enrollments for insert to authenticated
  with check (student_id = auth.uid() and public.my_role() = 'student'
    and exists (select 1 from public.courses c join public.profiles p on p.id = auth.uid()
                where c.id = course_id and c.age_track = public.age_track_of(p.age)));
create policy enr_admin_write on public.enrollments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- progress tables: read-only for everyone allowed; writes happen only inside the security-definer functions
create policy lp_read on public.lesson_progress for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_parent_of(student_id));
create policy qa_read on public.quiz_attempts for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_parent_of(student_id));
create policy cert_read on public.certificates for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_parent_of(student_id));

create policy la_read on public.last_activity for select to authenticated
  using (student_id = auth.uid() or public.is_staff() or public.is_parent_of(student_id));
create policy la_own_write on public.last_activity for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---------- Storage: private video bucket ----------
insert into storage.buckets (id, name, public) values ('lesson-videos','lesson-videos', false)
on conflict (id) do nothing;
create policy videos_read on storage.objects for select to authenticated using (bucket_id = 'lesson-videos');
create policy videos_staff_write on storage.objects for all to authenticated
  using (bucket_id = 'lesson-videos' and public.is_staff())
  with check (bucket_id = 'lesson-videos' and public.is_staff());

-- ---------- First admin ----------
-- 1) Auth > Users > Add user: email admin@geniotech.app + a strong password.
-- 2) Then run (replace the id with that user's UUID):
-- insert into public.profiles (id, username, full_name, role) values ('<UUID>','admin','Head Admin','admin');
