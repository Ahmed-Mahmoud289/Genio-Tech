-- Only needed if you already ran an earlier schema.sql that created the view with security_invoker.
drop view if exists public.student_course_xp;

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

